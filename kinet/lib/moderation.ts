import {
  addDoc,
  arrayRemove,
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";
import { writeAuditLog } from "@/lib/admin";
import { createNotification } from "@/lib/notifications";

export interface ReportRecord {
  id: string;
  reporterId: string;
  targetId: string;
  targetType: "user" | "post" | "comment" | "message" | "conversation";
  reason: string;
  details: string;
  status?: "open" | "resolved" | "dismissed";
  resolutionNote?: string;
  reviewerId?: string | null;
  escalationStatus?: "normal" | "escalated";
  escalationReason?: string;
  createdAt?: { seconds?: number; nanoseconds?: number } | null;
}

type ListenerCleanup = () => void;

export async function reportEntity(input: {
  targetId: string;
  targetType: "user" | "post" | "comment" | "message" | "conversation";
  reason: string;
  details?: string;
}) {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in to report content.");
  }

  await addDoc(collection(db, "reports"), {
    reporterId: auth.currentUser.uid,
    targetId: input.targetId,
    targetType: input.targetType,
    reason: input.reason,
    details: input.details?.trim() || "",
    status: "open",
    resolutionNote: "",
    reviewerId: null,
    createdAt: serverTimestamp(),
  });

  await createNotification({
    type: "report",
    recipientId: auth.currentUser.uid,
    actorId: auth.currentUser.uid,
    actorName: "Moderation",
    actorAvatar: "",
    message: `Your ${input.targetType} report was submitted.`,
  });
}

export async function toggleBlockedUser(targetUid: string, isBlocked: boolean) {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in to block users.");
  }

  const userId = auth.currentUser.uid;
  const currentSnapshot = await getDoc(doc(db, "users", userId));
  const current = currentSnapshot.exists()
    ? (currentSnapshot.data() as Record<string, unknown>)
    : null;
  const blockedUsers = Array.isArray(current?.blockedUsers) ? (current?.blockedUsers as string[]) : [];
  const nextBlockedUsers = isBlocked
    ? blockedUsers.filter((id) => id !== targetUid)
    : Array.from(new Set([...blockedUsers, targetUid]));

  await setDoc(
    doc(db, "users", userId),
    {
      blockedUsers: nextBlockedUsers,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  if (!isBlocked) {
    // Blocking also severs existing follows and pending requests. Keep this
    // cleanup best-effort so older rules cannot prevent the block itself.
    await Promise.allSettled([
      setDoc(doc(db, "users", userId), { following: arrayRemove(targetUid), followers: arrayRemove(targetUid) }, { merge: true }),
      setDoc(doc(db, "users", targetUid), { following: arrayRemove(userId), followers: arrayRemove(userId) }, { merge: true }),
      deleteDoc(doc(db, "follows", `${userId}_${targetUid}`)),
      deleteDoc(doc(db, "follows", `${targetUid}_${userId}`)),
      deleteDoc(doc(db, "followRequests", `${userId}_${targetUid}`)),
      deleteDoc(doc(db, "followRequests", `${targetUid}_${userId}`)),
    ]);
  }
}

export async function getBlockedUsers() {
  if (!auth?.currentUser || !db) {
    return [];
  }

  const snapshot = await getDoc(doc(db, "users", auth.currentUser.uid));
  if (!snapshot.exists()) {
    return [];
  }

  const data = snapshot.data() as Record<string, unknown>;
  return Array.isArray(data.blockedUsers) ? (data.blockedUsers as string[]) : [];
}

export function isCurrentUserAdmin() {
  const currentUid = auth?.currentUser?.uid;
  const raw = process.env.NEXT_PUBLIC_KINET_ADMIN_UIDS ?? "";
  const allowed = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return Boolean(currentUid && allowed.includes(currentUid));
}

export function subscribeToReports(
  reporterId: string,
  callback: (reports: ReportRecord[]) => void
): ListenerCleanup {
  if (!db) {
    callback([]);
    return () => undefined;
  }

  const reportsQuery = query(
    collection(db, "reports"),
    where("reporterId", "==", reporterId),
    orderBy("createdAt", "desc"),
    limit(50)
  );

  return onSnapshot(
    reportsQuery,
    (snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => {
      callback(
        snapshot.docs.map((docSnapshot) => {
          const data = docSnapshot.data();
          return {
            id: docSnapshot.id,
            reporterId: String(data.reporterId ?? ""),
            targetId: String(data.targetId ?? ""),
            targetType: (data.targetType as ReportRecord["targetType"]) ?? "post",
            reason: String(data.reason ?? ""),
            details: String(data.details ?? ""),
            status: (data.status as ReportRecord["status"]) ?? "open",
            resolutionNote: String(data.resolutionNote ?? ""),
            reviewerId: data.reviewerId ? String(data.reviewerId) : null,
            escalationStatus:
              data.escalationStatus === "escalated" ? "escalated" : "normal",
            escalationReason: String(data.escalationReason ?? ""),
            createdAt:
              (data.createdAt as { seconds?: number; nanoseconds?: number } | null | undefined) ??
              null,
          };
        })
      );
    }
  );
}

export function subscribeToAllReports(callback: (reports: ReportRecord[]) => void): ListenerCleanup {
  if (!db) {
    callback([]);
    return () => undefined;
  }

  const reportsQuery = query(collection(db, "reports"), orderBy("createdAt", "desc"), limit(100));

  return onSnapshot(
    reportsQuery,
    (snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => {
      callback(
        snapshot.docs.map((docSnapshot) => {
          const data = docSnapshot.data();
          return {
            id: docSnapshot.id,
            reporterId: String(data.reporterId ?? ""),
            targetId: String(data.targetId ?? ""),
            targetType: (data.targetType as ReportRecord["targetType"]) ?? "post",
            reason: String(data.reason ?? ""),
            details: String(data.details ?? ""),
            status: (data.status as ReportRecord["status"]) ?? "open",
            resolutionNote: String(data.resolutionNote ?? ""),
            reviewerId: data.reviewerId ? String(data.reviewerId) : null,
            escalationStatus:
              data.escalationStatus === "escalated" ? "escalated" : "normal",
            escalationReason: String(data.escalationReason ?? ""),
            createdAt:
              (data.createdAt as { seconds?: number; nanoseconds?: number } | null | undefined) ??
              null,
          };
        })
      );
    }
  );
}

export async function reviewReport(reportId: string, status: "resolved" | "dismissed", resolutionNote: string) {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in.");
  }

  const reportSnapshot = await getDoc(doc(db, "reports", reportId));
  await setDoc(
    doc(db, "reports", reportId),
    {
      status,
      resolutionNote: resolutionNote.trim(),
      reviewerId: auth.currentUser.uid,
      reviewedAt: serverTimestamp(),
    },
    { merge: true }
  );

  await writeAuditLog({
    action: `report_${status}`,
    targetType: "report",
    targetId: reportId,
    summary: `${status === "resolved" ? "Resolved" : "Dismissed"} report ${reportId}.`,
  });
  if (reportSnapshot.exists()) await createNotification({ type: "report_update", recipientId: String(reportSnapshot.data().reporterId ?? ""), actorId: auth.currentUser.uid, actorName: "Kinet Safety", actorAvatar: "", message: `Your report was ${status}.${resolutionNote.trim() ? ` ${resolutionNote.trim()}` : ""}`, targetUrl: "/notifications" });
}

export async function escalateReport(reportId: string, escalationReason: string) {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in.");
  }

  await setDoc(
    doc(db, "reports", reportId),
    {
      escalationStatus: "escalated",
      escalationReason: escalationReason.trim(),
      escalatedAt: serverTimestamp(),
      escalatedBy: auth.currentUser.uid,
    },
    { merge: true }
  );

  await writeAuditLog({
    action: "report_escalated",
    targetType: "report",
    targetId: reportId,
    summary: `Escalated report ${reportId}.`,
  });
}
