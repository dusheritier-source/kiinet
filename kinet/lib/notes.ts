import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

export interface NoteItem {
  id: string;
  userId: string;
  text: string;
  createdAt?: { seconds?: number; nanoseconds?: number } | null;
  expiresAt?: { seconds?: number; nanoseconds?: number } | null;
  audience: "everyone" | "following" | "close_friends" | "selected";
  allowedViewerIds: string[];
  hiddenBy: string[];
}

type ListenerCleanup = () => void;

function mapNote(id: string, data: Record<string, unknown>): NoteItem {
  return {
    id,
    userId: String(data.userId ?? ""),
    text: String(data.text ?? "").slice(0, 60),
    createdAt: (data.createdAt as NoteItem["createdAt"]) ?? null,
    expiresAt: (data.expiresAt as NoteItem["expiresAt"]) ?? null,
    audience: data.audience === "following" || data.audience === "close_friends" || data.audience === "selected" ? data.audience : "everyone",
    allowedViewerIds: Array.isArray(data.allowedViewerIds) ? data.allowedViewerIds as string[] : [],
    hiddenBy: Array.isArray(data.hiddenBy) ? data.hiddenBy as string[] : [],
  };
}

export async function createNote(text: string, audience: NoteItem["audience"] = "everyone", allowedViewerIds: string[] = []) {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in.");
  }
  const trimmed = text.trim().slice(0, 60);
  if (!trimmed) {
    throw new Error("Note cannot be empty.");
  }
  const now = Date.now();
  const expiresAt = new Date(now + 24 * 60 * 60 * 1000);
  const profileSnapshot = audience === "following" || audience === "close_friends" ? await getDoc(doc(db, "users", auth.currentUser.uid)) : null;
  const profile = profileSnapshot?.exists() ? profileSnapshot.data() : {};
  const audienceViewerIds = audience === "following"
    ? (Array.isArray(profile.followers) ? profile.followers as string[] : [])
    : audience === "close_friends"
      ? (Array.isArray(profile.closeFriends) ? profile.closeFriends as string[] : [])
      : allowedViewerIds;

  await setDoc(doc(collection(db, "notes")), {
    userId: auth.currentUser.uid,
    text: trimmed,
    createdAt: serverTimestamp(),
    expiresAt,
    audience,
    allowedViewerIds: Array.from(new Set(audienceViewerIds)).slice(0, 100),
    hiddenBy: [],
  });
}

export async function deleteNote(noteId: string) {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in.");
  }
  await deleteDoc(doc(db, "notes", noteId));
}

export async function hideNote(noteId: string) {
  if (!auth?.currentUser || !db) {
    return;
  }
  await setDoc(doc(db, "notes", noteId), {
    hiddenBy: arrayUnion(auth.currentUser.uid),
  }, { merge: true });
}

export async function getActiveNotesForUser(targetUserId: string, viewerId: string) {
  if (!db) {
    return [];
  }
  const snapshot = await getDocs(
    query(collection(db, "notes"), where("userId", "==", targetUserId), orderBy("createdAt", "desc"), limit(1))
  );
  const nowSeconds = Math.floor(Date.now() / 1000);
  const notes = snapshot.docs
    .map((docSnapshot: { id: string; data: () => Record<string, unknown> }) => mapNote(docSnapshot.id, docSnapshot.data()))
    .filter((note: NoteItem) => (note.expiresAt?.seconds ?? 0) > nowSeconds && !note.hiddenBy.includes(viewerId));

  if (notes.length === 0) return [];
  return [notes[0]];
}

export function subscribeToNotesForUsers(userIds: string[], viewerId: string, callback: (notes: Map<string, NoteItem>) => void): ListenerCleanup | undefined {
  if (!db || userIds.length === 0) {
    return undefined;
  }
  const notesMap = new Map<string, NoteItem>();
  const candidates = new Map<string, Map<string, NoteItem>>();
  const firestore = db;

  const unsubscribers: ListenerCleanup[] = [];
  const updateCandidates = (uid: string, source: string, snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const userNotes = snapshot.docs
        .map((docSnapshot: { id: string; data: () => Record<string, unknown> }) => mapNote(docSnapshot.id, docSnapshot.data()))
        .filter((note: NoteItem) => (note.expiresAt?.seconds ?? 0) > nowSeconds && !note.hiddenBy.includes(viewerId));
      const sources = candidates.get(uid) ?? new Map<string, NoteItem>();
      const note = userNotes[0];
      if (note) sources.set(source, note); else sources.delete(source);
      candidates.set(uid, sources);
      const newest = Array.from(sources.values()).sort((left, right) => (right.createdAt?.seconds ?? 0) - (left.createdAt?.seconds ?? 0))[0];
      if (newest) {
        notesMap.set(uid, newest);
      } else {
        notesMap.delete(uid);
      }
      callback(new Map(notesMap));
  };

  userIds.forEach((uid) => {
    const publicQuery = query(collection(firestore, "notes"), where("userId", "==", uid), where("audience", "==", "everyone"), orderBy("createdAt", "desc"), limit(1));
    const allowedQuery = query(collection(firestore, "notes"), where("userId", "==", uid), where("allowedViewerIds", "array-contains", viewerId), orderBy("createdAt", "desc"), limit(1));
    unsubscribers.push(onSnapshot(publicQuery, (snapshot) => updateCandidates(uid, "public", snapshot)));
    unsubscribers.push(onSnapshot(allowedQuery, (snapshot) => updateCandidates(uid, "allowed", snapshot)));
  });

  return () => {
    unsubscribers.forEach((unsub) => unsub());
  };
}
