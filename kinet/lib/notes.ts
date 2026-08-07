import {
  arrayRemove,
  collection,
  deleteDoc,
  doc,
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

  await setDoc(doc(collection(db, "notes")), {
    userId: auth.currentUser.uid,
    text: trimmed,
    createdAt: serverTimestamp(),
    expiresAt,
    audience,
    allowedViewerIds: Array.from(new Set(allowedViewerIds)).slice(0, 100),
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
    hiddenBy: arrayRemove(auth.currentUser.uid),
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
  const firestore = db;

  const unsubscribers: ListenerCleanup[] = [];
  userIds.forEach((uid) => {
    const q = query(collection(firestore, "notes"), where("userId", "==", uid), orderBy("createdAt", "desc"), limit(1));
    const unsub = onSnapshot(q, (snapshot) => {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const userNotes = snapshot.docs
        .map((docSnapshot: { id: string; data: () => Record<string, unknown> }) => mapNote(docSnapshot.id, docSnapshot.data()))
        .filter((note: NoteItem) => (note.expiresAt?.seconds ?? 0) > nowSeconds && !note.hiddenBy.includes(viewerId));
      if (userNotes.length > 0) {
        notesMap.set(uid, userNotes[0]);
      } else {
        notesMap.delete(uid);
      }
      callback(new Map(notesMap));
    });
    unsubscribers.push(unsub);
  });

  return () => {
    unsubscribers.forEach((unsub) => unsub());
  };
}
