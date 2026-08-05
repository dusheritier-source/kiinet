"use client";

import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { StoryItem } from "@/lib/stories";

export interface ProfileHighlight { id: string; userId: string; title: string; coverUrl: string; storyIds: string[]; order: number; createdAt?: { seconds?: number } | null }

export function subscribeToProfileHighlights(userId: string, callback: (items: ProfileHighlight[]) => void) {
  if (!db) { callback([]); return () => undefined; }
  return onSnapshot(query(collection(db, "profileHighlights"), where("userId", "==", userId)), (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as ProfileHighlight)).sort((a, b) => a.order - b.order)), () => callback([]));
}

export async function getProfileStories(userId: string) {
  if (!db || !auth.currentUser || auth.currentUser.uid !== userId) return [];
  const snapshot = await getDocs(query(collection(db, "stories"), where("userId", "==", userId)));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as StoryItem)).sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
}

export async function createProfileHighlight(title: string, stories: StoryItem[], currentCount: number, coverUrl?: string) {
  if (!db || !auth.currentUser || !stories.length) throw new Error("Select at least one story.");
  await addDoc(collection(db, "profileHighlights"), { userId: auth.currentUser.uid, title: title.trim().slice(0, 30) || "Highlight", coverUrl: coverUrl || stories[0].mediaUrl, storyIds: stories.map((story) => story.id).slice(0, 100), order: currentCount, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
}

export async function renameProfileHighlight(id: string, title: string) {
  if (!db || !auth.currentUser) return; await setDoc(doc(db, "profileHighlights", id), { title: title.trim().slice(0, 30), updatedAt: serverTimestamp() }, { merge: true });
}

export async function updateProfileHighlightStories(id: string, storyIds: string[], coverUrl?: string) {
  if (!db || !auth.currentUser || !storyIds.length) throw new Error("A highlight needs at least one story.");
  await setDoc(doc(db, "profileHighlights", id), { storyIds: Array.from(new Set(storyIds)).slice(0, 100), ...(coverUrl ? { coverUrl } : {}), updatedAt: serverTimestamp() }, { merge: true });
}

export async function updateProfileHighlightCover(id: string, coverUrl: string) {
  if (!db || !auth.currentUser || !coverUrl) return;
  await setDoc(doc(db, "profileHighlights", id), { coverUrl, updatedAt: serverTimestamp() }, { merge: true });
}

export async function deleteProfileHighlight(id: string) { if (!db || !auth.currentUser) return; await deleteDoc(doc(db, "profileHighlights", id)); }

export async function moveProfileHighlight(items: ProfileHighlight[], id: string, direction: -1 | 1) {
  if (!db || !auth.currentUser) return; const index = items.findIndex((item) => item.id === id); const otherIndex = index + direction; if (index < 0 || otherIndex < 0 || otherIndex >= items.length) return;
  await Promise.all([setDoc(doc(db, "profileHighlights", items[index].id), { order: otherIndex, updatedAt: serverTimestamp() }, { merge: true }), setDoc(doc(db, "profileHighlights", items[otherIndex].id), { order: index, updatedAt: serverTimestamp() }, { merge: true })]);
}

export async function getProfileHighlight(id: string) {
  if (!db) return null; const highlight = await getDoc(doc(db, "profileHighlights", id)); if (!highlight.exists()) return null; const data = highlight.data() as Omit<ProfileHighlight, "id">;
  const stories = await Promise.all(data.storyIds.map(async (storyId) => { const snapshot = await getDoc(doc(db!, "stories", storyId)); return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as StoryItem) : null; }));
  return { highlight: { id: highlight.id, ...data } as ProfileHighlight, stories: stories.filter((story): story is StoryItem => Boolean(story)) };
}
