import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";
import { writeAuditLog } from "@/lib/admin";
import { createNotification } from "@/lib/notifications";

export interface RecruitTarget {
  id: string;
  targetUid: string;
  scoutId: string;
  note: string;
  stage: string;
  tags?: string[];
  reportTemplate?: string;
  sharedWith?: string[];
  createdAt?: { seconds?: number; nanoseconds?: number } | null;
}

export interface RecruiterSavedSearch {
  id: string;
  scoutId: string;
  name: string;
  query: string;
  filters: {
    sport?: string;
    position?: string;
    team?: string;
  };
}

export interface RecruitBoardShare {
  id: string;
  ownerId: string;
  recipientUid: string;
  note: string;
  targetIds: string[];
  createdAt?: { seconds?: number; nanoseconds?: number } | null;
}

export interface VerificationRequestRecord {
  id: string;
  userId: string;
  category: string;
  details: string;
  status: "pending" | "approved" | "rejected";
  reviewNote?: string;
  reviewerId?: string | null;
  createdAt?: { seconds?: number; nanoseconds?: number } | null;
}

export interface VerificationAppealRecord {
  id: string;
  requestId: string;
  userId: string;
  message: string;
  status: "pending" | "approved" | "rejected";
  reviewerId?: string | null;
  reviewNote?: string;
  createdAt?: { seconds?: number; nanoseconds?: number } | null;
}

function mapTarget(id: string, data: Record<string, unknown>): RecruitTarget {
  return {
    id,
    targetUid: String(data.targetUid ?? ""),
    scoutId: String(data.scoutId ?? ""),
    note: String(data.note ?? ""),
    stage: String(data.stage ?? "watchlist"),
    tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
    reportTemplate: data.reportTemplate ? String(data.reportTemplate) : "",
    sharedWith: Array.isArray(data.sharedWith) ? (data.sharedWith as string[]) : [],
    createdAt:
      (data.createdAt as { seconds?: number; nanoseconds?: number } | null | undefined) ?? null,
  };
}

export async function toggleShortlistProfile(targetUid: string, isShortlisted: boolean) {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in to manage scout shortlists.");
  }

  await setDoc(
    doc(db, "users", auth.currentUser.uid),
    {
      shortlist: isShortlisted ? arrayRemove(targetUid) : arrayUnion(targetUid),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function upsertRecruitTarget(
  targetUid: string,
  note: string,
  stage: string,
  extra?: { tags?: string[]; reportTemplate?: string }
) {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in to manage recruiting.");
  }

  const snapshot = await getDocs(
    query(
      collection(db, "recruitTargets"),
      where("scoutId", "==", auth.currentUser.uid),
      where("targetUid", "==", targetUid),
      limit(1)
    )
  );

  if (snapshot.docs[0]) {
    await setDoc(
      doc(db, "recruitTargets", snapshot.docs[0].id),
      {
        note: note.trim(),
        stage: stage.trim() || "watchlist",
        tags: extra?.tags ?? [],
        reportTemplate: extra?.reportTemplate ?? "",
        sharedWith: snapshot.docs[0].data().sharedWith ?? [],
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return;
  }

  await addDoc(collection(db, "recruitTargets"), {
    scoutId: auth.currentUser.uid,
    targetUid,
    note: note.trim(),
    stage: stage.trim() || "watchlist",
    tags: extra?.tags ?? [],
    reportTemplate: extra?.reportTemplate ?? "",
    sharedWith: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function getRecruitTargets() {
  if (!auth?.currentUser || !db) {
    return [];
  }

  const snapshot = await getDocs(
    query(
      collection(db, "recruitTargets"),
      where("scoutId", "==", auth.currentUser.uid),
      limit(50)
    )
  );

  return snapshot.docs.map((docSnapshot: { id: string; data: () => Record<string, unknown> }) =>
    mapTarget(docSnapshot.id, docSnapshot.data() as Record<string, unknown>)
  );
}

export async function deleteRecruitTarget(targetId: string) {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in to manage recruiting.");
  }

  await deleteDoc(doc(db, "recruitTargets", targetId));
}

export async function shareRecruitBoard(recipientUid: string, targetIds: string[], note: string) {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in.");
  }

  const uniqueTargetIds = Array.from(new Set(targetIds.filter(Boolean)));
  if (!recipientUid || uniqueTargetIds.length === 0) {
    throw new Error("Choose a recipient and at least one prospect.");
  }

  await addDoc(collection(db, "recruitBoardShares"), {
    ownerId: auth.currentUser.uid,
    recipientUid,
    note: note.trim(),
    targetIds: uniqueTargetIds,
    createdAt: serverTimestamp(),
  });

  await Promise.all(
    uniqueTargetIds.map((targetId) =>
      setDoc(
        doc(db, "recruitTargets", targetId),
        { sharedWith: arrayUnion(recipientUid), updatedAt: serverTimestamp() },
        { merge: true }
      )
    )
  );
}

export async function getRecruitBoardShares() {
  if (!auth?.currentUser || !db) {
    return [];
  }

  const snapshot = await getDocs(
    query(
      collection(db, "recruitBoardShares"),
      where("recipientUid", "==", auth.currentUser.uid),
      limit(20)
    )
  );

  return snapshot.docs.map((docSnapshot: { id: string; data: () => Record<string, unknown> }) => {
    const data = docSnapshot.data() as Record<string, unknown>;
    return {
      id: docSnapshot.id,
      ownerId: String(data.ownerId ?? ""),
      recipientUid: String(data.recipientUid ?? ""),
      note: String(data.note ?? ""),
      targetIds: Array.isArray(data.targetIds) ? (data.targetIds as string[]) : [],
      createdAt:
        (data.createdAt as { seconds?: number; nanoseconds?: number } | null | undefined) ?? null,
    } satisfies RecruitBoardShare;
  });
}

export async function saveRecruiterSearch(input: {
  name: string;
  query: string;
  filters: { sport?: string; position?: string; team?: string };
}) {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in.");
  }

  await addDoc(collection(db, "recruiterSearches"), {
    scoutId: auth.currentUser.uid,
    name: input.name.trim(),
    query: input.query.trim(),
    filters: input.filters,
    createdAt: serverTimestamp(),
  });
}

export async function getRecruiterSearches() {
  if (!auth?.currentUser || !db) {
    return [];
  }

  const snapshot = await getDocs(
    query(
      collection(db, "recruiterSearches"),
      where("scoutId", "==", auth.currentUser.uid),
      limit(20)
    )
  );

  return snapshot.docs.map((docSnapshot: { id: string; data: () => Record<string, unknown> }) => {
    const data = docSnapshot.data();
    return {
      id: docSnapshot.id,
      scoutId: String(data.scoutId ?? ""),
      name: String(data.name ?? ""),
      query: String(data.query ?? ""),
      filters:
        (data.filters as RecruiterSavedSearch["filters"] | undefined) ?? {},
    } satisfies RecruiterSavedSearch;
  });
}

export const scoutReportTemplates = [
  {
    id: "athletic-upside",
    name: "Athletic Upside",
    text: "Elite movement tools. Strong burst, motor, and transition impact. Needs reps to sharpen decision-making and consistency under pressure.",
  },
  {
    id: "two-way-starter",
    name: "Two-Way Starter",
    text: "Reliable two-way projection. Brings role clarity, defensive floor, and enough offensive processing to fit winning lineups.",
  },
  {
    id: "high-feel-creator",
    name: "High Feel Creator",
    text: "Advanced feel with playmaking instincts. Generates advantages, sees the next pass early, and raises team spacing and rhythm.",
  },
];

export async function submitVerificationRequest(input: {
  details: string;
  category: string;
}) {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in to request verification.");
  }

  await addDoc(collection(db, "verificationRequests"), {
    userId: auth.currentUser.uid,
    category: input.category.trim() || "profile",
    details: input.details.trim(),
    status: "pending",
    createdAt: serverTimestamp(),
  });
}

export async function getVerificationRequests() {
  if (!auth?.currentUser || !db) {
    return [];
  }

  const snapshot = await getDocs(
    query(
      collection(db, "verificationRequests"),
      where("userId", "==", auth.currentUser.uid),
      limit(20)
    )
  );

  return snapshot.docs.map((docSnapshot: { id: string; data: () => Record<string, unknown> }) => ({
    id: docSnapshot.id,
    ...(docSnapshot.data() as Record<string, unknown>),
  }));
}

export function subscribeToAllVerificationRequests(
  callback: (requests: VerificationRequestRecord[]) => void
) {
  if (!db) {
    callback([]);
    return () => undefined;
  }

  return onSnapshot(
    collection(db, "verificationRequests"),
    (snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => {
    callback(
      snapshot.docs
        .map((docSnapshot: { id: string; data: () => Record<string, unknown> }) => {
          const data = docSnapshot.data() as Record<string, unknown>;
          return {
            id: docSnapshot.id,
            userId: String(data.userId ?? ""),
            category: String(data.category ?? "profile"),
            details: String(data.details ?? ""),
            status:
              data.status === "approved" || data.status === "rejected" ? data.status : "pending",
            reviewNote: String(data.reviewNote ?? ""),
            reviewerId: data.reviewerId ? String(data.reviewerId) : null,
            createdAt:
              (data.createdAt as
                | { seconds?: number; nanoseconds?: number }
                | null
                | undefined) ?? null,
          } satisfies VerificationRequestRecord;
        })
        .sort(
          (left: VerificationRequestRecord, right: VerificationRequestRecord) =>
            (right.createdAt?.seconds ?? 0) - (left.createdAt?.seconds ?? 0)
        )
    );
    }
  );
}

export async function reviewVerificationRequest(
  requestId: string,
  userId: string,
  status: "approved" | "rejected",
  reviewNote: string
) {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in.");
  }

  await setDoc(
    doc(db, "verificationRequests", requestId),
    {
      status,
      reviewNote: reviewNote.trim(),
      reviewerId: auth.currentUser.uid,
      reviewedAt: serverTimestamp(),
    },
    { merge: true }
  );

  if (status === "approved") {
    await setDoc(
      doc(db, "users", userId),
      {
        verified: true,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  await writeAuditLog({
    action: `verification_${status}`,
    targetType: "verification_request",
    targetId: requestId,
    summary: `${status === "approved" ? "Approved" : "Rejected"} verification request ${requestId}.`,
    metadata: { userId },
  });
  await createNotification({ type: "verification_update", recipientId: userId, actorId: auth.currentUser.uid, actorName: "Kinet verification", actorAvatar: "", message: status === "approved" ? "Your account verification was approved." : `Your verification request was not approved${reviewNote.trim() ? `: ${reviewNote.trim()}` : "."}`, targetUrl: "/verify" });
}

export async function submitVerificationAppeal(input: { requestId: string; message: string }) {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in.");
  }

  await addDoc(collection(db, "verificationAppeals"), {
    requestId: input.requestId,
    userId: auth.currentUser.uid,
    message: input.message.trim(),
    status: "pending",
    createdAt: serverTimestamp(),
  });
}

export async function getVerificationAppeals() {
  if (!auth?.currentUser || !db) {
    return [];
  }

  const snapshot = await getDocs(
    query(
      collection(db, "verificationAppeals"),
      where("userId", "==", auth.currentUser.uid),
      limit(20)
    )
  );

  return snapshot.docs.map((docSnapshot: { id: string; data: () => Record<string, unknown> }) => {
    const data = docSnapshot.data() as Record<string, unknown>;
    return {
      id: docSnapshot.id,
      requestId: String(data.requestId ?? ""),
      userId: String(data.userId ?? ""),
      message: String(data.message ?? ""),
      status:
        data.status === "approved" || data.status === "rejected" ? data.status : "pending",
      reviewerId: data.reviewerId ? String(data.reviewerId) : null,
      reviewNote: String(data.reviewNote ?? ""),
      createdAt:
        (data.createdAt as { seconds?: number; nanoseconds?: number } | null | undefined) ?? null,
    } satisfies VerificationAppealRecord;
  });
}

export function subscribeToVerificationAppeals(
  callback: (appeals: VerificationAppealRecord[]) => void
) {
  if (!db) {
    callback([]);
    return () => undefined;
  }

  return onSnapshot(
    collection(db, "verificationAppeals"),
    (snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => {
      callback(
        snapshot.docs
          .map((docSnapshot) => {
            const data = docSnapshot.data() as Record<string, unknown>;
            return {
              id: docSnapshot.id,
              requestId: String(data.requestId ?? ""),
              userId: String(data.userId ?? ""),
              message: String(data.message ?? ""),
              status:
                data.status === "approved" || data.status === "rejected" ? data.status : "pending",
              reviewerId: data.reviewerId ? String(data.reviewerId) : null,
              reviewNote: String(data.reviewNote ?? ""),
              createdAt:
                (data.createdAt as { seconds?: number; nanoseconds?: number } | null | undefined) ?? null,
            } satisfies VerificationAppealRecord;
          })
          .sort((left, right) => (right.createdAt?.seconds ?? 0) - (left.createdAt?.seconds ?? 0))
      );
    }
  );
}

export async function reviewVerificationAppeal(
  appealId: string,
  status: "approved" | "rejected",
  reviewNote: string
) {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in.");
  }

  await setDoc(
    doc(db, "verificationAppeals", appealId),
    {
      status,
      reviewNote: reviewNote.trim(),
      reviewerId: auth.currentUser.uid,
      reviewedAt: serverTimestamp(),
    },
    { merge: true }
  );

  await writeAuditLog({
    action: `verification_appeal_${status}`,
    targetType: "verification_appeal",
    targetId: appealId,
    summary: `${status === "approved" ? "Approved" : "Rejected"} verification appeal ${appealId}.`,
  });
}
