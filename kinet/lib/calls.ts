"use client";

import { addDoc, collection, doc, onSnapshot, orderBy, query, runTransaction, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { createNotification } from "@/lib/notifications";
import { sendConversationMessage } from "@/lib/messaging";

export type CallType = "audio" | "video";
export type CallStatus = "preparing" | "ringing" | "active" | "declined" | "missed" | "ended";
export interface CallRecord {
  id: string; conversationId: string; callerId: string; participantIds: string[];
  type: CallType; status: CallStatus; offer?: RTCSessionDescriptionInit | null;
  answer?: RTCSessionDescriptionInit | null;
  createdAt?: { seconds?: number; nanoseconds?: number } | null;
}

const requireDb = () => { if (!db || !auth.currentUser) throw new Error("You must be signed in."); return db; };

export async function createCallRecord(conversationId: string, participantIds: string[], type: CallType) {
  const firestore = requireDb();
  const created = await addDoc(collection(firestore, "calls"), {
    conversationId, participantIds, callerId: auth.currentUser!.uid, type,
    status: "preparing", offer: null, answer: null, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  participantIds.filter((uid) => uid !== auth.currentUser!.uid).forEach((uid) => {
    void createNotification({
      type: "call", recipientId: uid, actorId: auth.currentUser!.uid,
      actorName: auth.currentUser!.displayName || "Someone", actorAvatar: auth.currentUser!.photoURL || "",
      message: `Incoming ${type} call.`, conversationId,
    }).catch(() => undefined);
  });
  return created.id;
}

export const updateCallRecord = async (callId: string, data: Record<string, unknown>) =>
  updateDoc(doc(requireDb(), "calls", callId), { ...data, updatedAt: serverTimestamp() });

export async function acceptCallRecord(callId: string) {
  const firestore = requireDb();
  await runTransaction(firestore, async (transaction) => {
    const callRef = doc(firestore, "calls", callId);
    const snapshot = await transaction.get(callRef);
    if (!snapshot.exists()) throw new Error("This call is no longer available.");

    const status = snapshot.data().status as CallStatus;
    if (status === "active") return;
    if (status !== "ringing") throw new Error("This call is no longer ringing.");

    transaction.update(callRef, {
      status: "active",
      answeredAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

export async function markCallMissedIfRinging(callId: string) {
  const firestore = requireDb();
  const missed = await runTransaction(firestore, async (transaction) => {
    const callRef = doc(firestore, "calls", callId);
    const snapshot = await transaction.get(callRef);
    if (snapshot.exists() && snapshot.data().status === "ringing") {
      transaction.update(callRef, { status: "missed", endedAt: serverTimestamp(), updatedAt: serverTimestamp() });
      return snapshot.data() as Record<string, unknown>;
    }
    return null;
  });
  if (missed) {
    const participantIds = Array.isArray(missed.participantIds) ? missed.participantIds as string[] : [];
    const missedType = String(missed.type ?? "audio") === "video" ? "video" : "voice";
    void sendConversationMessage(String(missed.conversationId ?? ""), `Missed ${missedType} call`).catch(() => undefined);
    participantIds.filter((uid) => uid !== String(missed.callerId ?? "")).forEach((uid) => void createNotification({ type: "missed_call", recipientId: uid, actorId: String(missed.callerId ?? ""), actorName: auth.currentUser?.displayName || "Someone", actorAvatar: auth.currentUser?.photoURL || "", message: `You missed a ${String(missed.type ?? "audio")} call.`, conversationId: String(missed.conversationId ?? "") }).catch(() => undefined));
  }
}

export const addCallCandidate = async (callId: string, side: "caller" | "callee", candidate: RTCIceCandidateInit) =>
  addDoc(collection(requireDb(), "calls", callId, `${side}Candidates`), candidate);

// Group call helpers: offers/answers/candidates per participant for multi-party (star) topology.
export const addParticipantOffer = async (callId: string, from: string, to: string, offer: RTCSessionDescriptionInit) =>
  updateDoc(doc(requireDb(), "calls", callId), { updatedAt: serverTimestamp() }).catch(() => undefined).then(() =>
    addDoc(collection(requireDb(), "calls", callId, "offers"), { from, to, offer })
  );

export function subscribeOffers(callId: string, myUserId: string, callback: (offer: { id: string; from: string; to: string; offer: RTCSessionDescriptionInit }) => void) {
  if (!db) return () => undefined;
  const offersCollection = collection(db, "calls", callId, "offers");
  const q = query(offersCollection, where("to", "==", myUserId), orderBy("from"));
  return onSnapshot(q, (snapshot) => {
    snapshot.docChanges().filter((c) => c.type === "added").forEach((change) => callback({ id: change.doc.id, ...(change.doc.data() as any) }));
  });
}

export const addParticipantAnswer = async (callId: string, from: string, to: string, answer: RTCSessionDescriptionInit) =>
  addDoc(collection(requireDb(), "calls", callId, "answers"), { from, to, answer });

export function subscribeAnswers(callId: string, targetFrom: string, callback: (answer: { id: string; from: string; to: string; answer: RTCSessionDescriptionInit }) => void) {
  if (!db) return () => undefined;
  const answersCollection = collection(db, "calls", callId, "answers");
  const q = query(answersCollection, where("to", "==", targetFrom));
  return onSnapshot(q, (snapshot) => {
    snapshot.docChanges().filter((c) => c.type === "added").forEach((change) => callback({ id: change.doc.id, ...(change.doc.data() as any) }));
  });
}

export const addGroupCandidate = async (callId: string, from: string, to: string, candidate: RTCIceCandidateInit) =>
  addDoc(collection(requireDb(), "calls", callId, `candidates_${from}_${to}`), candidate);

export function subscribeGroupCandidates(callId: string, from: string, to: string, callback: (candidate: RTCIceCandidateInit) => void) {
  if (!db) return () => undefined;
  return onSnapshot(collection(db, "calls", callId, `candidates_${from}_${to}`), (snapshot) => {
    snapshot.docChanges().filter((change) => change.type === "added").forEach((change) => callback(change.doc.data() as RTCIceCandidateInit));
  });
}

export function subscribeCall(callId: string, callback: (call: CallRecord | null) => void) {
  if (!db) return () => undefined;
  return onSnapshot(doc(db, "calls", callId), (snapshot) => callback(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } as CallRecord : null));
}

export function subscribeCallCandidates(callId: string, side: "caller" | "callee", callback: (candidate: RTCIceCandidateInit) => void) {
  if (!db) return () => undefined;
  return onSnapshot(collection(db, "calls", callId, `${side}Candidates`), (snapshot) => {
    snapshot.docChanges().filter((change) => change.type === "added").forEach((change) => callback(change.doc.data() as RTCIceCandidateInit));
  });
}

export function subscribeIncomingCalls(userId: string, callback: (calls: CallRecord[]) => void, onError?: (error: Error) => void) {
  if (!db) return () => undefined;
  return onSnapshot(query(collection(db, "calls"), where("participantIds", "array-contains", userId), orderBy("createdAt", "desc")), (snapshot) => {
    callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as CallRecord)).filter((call) => call.callerId !== userId && call.status === "ringing").slice(0, 1));
  }, (error) => onError?.(error));
}

export function subscribeCallHistory(userId: string, callback: (calls: CallRecord[]) => void) {
  if (!db) return () => undefined;
  return onSnapshot(query(collection(db, "calls"), where("participantIds", "array-contains", userId), orderBy("createdAt", "desc")), (snapshot) => {
    callback(snapshot.docs.slice(0, 30).map((item) => ({ id: item.id, ...item.data() } as CallRecord)));
  });
}
