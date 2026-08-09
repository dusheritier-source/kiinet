"use client";

import { addDoc, collection, doc, onSnapshot, orderBy, query, runTransaction, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { createNotification } from "@/lib/notifications";

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
    participantIds.filter((uid) => uid !== String(missed.callerId ?? "")).forEach((uid) => void createNotification({ type: "missed_call", recipientId: uid, actorId: String(missed.callerId ?? ""), actorName: auth.currentUser?.displayName || "Someone", actorAvatar: auth.currentUser?.photoURL || "", message: `You missed a ${String(missed.type ?? "audio")} call.`, conversationId: String(missed.conversationId ?? "") }).catch(() => undefined));
  }
}

export const addCallCandidate = async (callId: string, side: "caller" | "callee", candidate: RTCIceCandidateInit) =>
  addDoc(collection(requireDb(), "calls", callId, `${side}Candidates`), candidate);

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
