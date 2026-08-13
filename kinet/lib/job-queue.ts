import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminFirestore, getAdminMessaging } from "@/lib/firebase-admin";

export type JobType = "push" | "email_digest";
export type JobStatus = "queued" | "processing" | "completed" | "failed";
export interface JobPayload { [key: string]: unknown }

export function stableJobId(scope: string, idempotencyKey: string) {
  const data = new TextEncoder().encode(`${scope}:${idempotencyKey}`);
  let hash = 2166136261;
  data.forEach((byte) => { hash ^= byte; hash = Math.imul(hash, 16777619); });
  return `${scope}_${(hash >>> 0).toString(36)}`;
}

export async function enqueueJob(type: JobType, payload: JobPayload, idempotencyKey: string, runAfter = new Date()) {
  const database = getAdminFirestore();
  const id = stableJobId(type, idempotencyKey);
  const reference = database.collection("backgroundJobs").doc(id);
  await database.runTransaction(async (transaction) => {
    const existing = await transaction.get(reference);
    if (existing.exists && ["queued", "processing", "completed"].includes(String(existing.data()?.status))) return;
    transaction.set(reference, { type, payload, idempotencyKey, status: "queued", attempts: 0, maxAttempts: 5, runAfter: Timestamp.fromDate(runAfter), createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  });
  return id;
}

async function deliver(job: FirebaseFirestore.DocumentData) {
  const payload = job.payload as JobPayload;
  if (job.type === "push") {
    const message = { token: String(payload.token), notification: { title: String(payload.title || "Kinet"), body: String(payload.body || "You have a new update.") }, webpush: { fcmOptions: { link: String(payload.link || "/notifications") }, notification: { icon: String(payload.icon || "/icon.svg"), tag: String(payload.tag || "kinet-notification") } } };
    if (process.env.PUSH_DELIVERY_WEBHOOK_URL) {
      const response = await fetch(process.env.PUSH_DELIVERY_WEBHOOK_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error(`Push webhook returned ${response.status}.`);
    } else await getAdminMessaging().send(message);
    return;
  }
  if (!process.env.EMAIL_DIGEST_WEBHOOK_URL) throw new Error("EMAIL_DIGEST_WEBHOOK_URL is not configured.");
  const response = await fetch(process.env.EMAIL_DIGEST_WEBHOOK_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  if (!response.ok) throw new Error(`Email webhook returned ${response.status}.`);
}

export async function processDueJobs(limit = 50) {
  const database = getAdminFirestore();
  const expiredLeases = await database.collection("backgroundJobs").where("status", "==", "processing").where("leaseExpiresAt", "<=", Timestamp.now()).limit(limit).get();
  await Promise.all(expiredLeases.docs.map((item) => item.ref.update({ status: "queued", runAfter: Timestamp.now(), updatedAt: FieldValue.serverTimestamp() })));
  const snapshot = await database.collection("backgroundJobs").where("status", "==", "queued").where("runAfter", "<=", Timestamp.now()).limit(limit).get();
  let completed = 0; let failed = 0;
  for (const document of snapshot.docs) {
    const claimed = await database.runTransaction<JobPayload & { attempts: number; maxAttempts?: number; type?: JobType } | null>(async (transaction) => {
      const fresh = await transaction.get(document.ref);
      if (!fresh.exists || fresh.data()?.status !== "queued") return null;
      transaction.update(document.ref, { status: "processing", attempts: FieldValue.increment(1), leaseExpiresAt: Timestamp.fromMillis(Date.now() + 60_000), updatedAt: FieldValue.serverTimestamp() });
      return { ...fresh.data(), attempts: Number(fresh.data()?.attempts || 0) + 1 };
    });
    if (!claimed) continue;
    try {
      await deliver(claimed);
      await document.ref.update({ status: "completed", completedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), lastError: FieldValue.delete() }); completed += 1;
    } catch (error) {
      const terminal = claimed.attempts >= Number(claimed.maxAttempts || 5);
      const delay = Math.min(60 * 60_000, 2 ** claimed.attempts * 30_000);
      await document.ref.update({ status: terminal ? "failed" : "queued", runAfter: Timestamp.fromMillis(Date.now() + delay), lastError: error instanceof Error ? error.message.slice(0, 500) : "Delivery failed", updatedAt: FieldValue.serverTimestamp() }); failed += 1;
    }
  }
  return { claimed: snapshot.size, completed, failed };
}

export async function runMaintenance() {
  const database = getAdminFirestore(); const now = Timestamp.now(); let deletedStories = 0; let deletedNotifications = 0; let publishedPosts = 0; let missedCalls = 0;
  const expiredStories = await database.collection("stories").where("expiresAt", "<=", now).limit(200).get();
  const scheduledPosts = await database.collection("posts").where("scheduledFor", "<=", now).limit(100).get();
  const staleCalls = await database.collection("calls").where("status", "==", "ringing").where("ringExpiresAt", "<=", now).limit(100).get();
  const expiredNotifications = await database.collection("notifications").where("expiresAt", "<=", now).limit(200).get();
  for (const [kind, group] of [["story", expiredStories.docs], ["notification", expiredNotifications.docs], ["post", scheduledPosts.docs], ["call", staleCalls.docs]] as const) {
    for (let offset = 0; offset < group.length; offset += 400) {
      const batch = database.batch();
      group.slice(offset, offset + 400).forEach((item) => {
        if (kind === "story") { batch.delete(item.ref); deletedStories += 1; }
        else if (kind === "notification") { batch.delete(item.ref); deletedNotifications += 1; }
        else if (kind === "post") { batch.update(item.ref, { scheduledFor: null, publishedAt: now, updatedAt: now }); publishedPosts += 1; }
        else { batch.update(item.ref, { status: "missed", pendingParticipantIds: [], endedAt: now, updatedAt: now }); missedCalls += 1; }
      });
      await batch.commit();
    }
  }
  return { deletedStories, deletedNotifications, publishedPosts, missedCalls };
}
