"use client";

import { collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { getCurrentUserProfile } from "@/lib/user-profile";

async function ownedCollection(name: string, userId: string) {
  if (!db) return [];
  const snapshot = await getDocs(query(collection(db, name), where("userId", "==", userId)));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function buildProfileArchive() {
  if (!auth.currentUser || !db) throw new Error("You must be signed in.");
  const userId = auth.currentUser.uid;
  const [profile, posts, stories, highlights] = await Promise.all([
    getCurrentUserProfile(),
    ownedCollection("posts", userId),
    ownedCollection("stories", userId),
    ownedCollection("profileHighlights", userId),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    format: "kinet-profile-archive-v1",
    account: { uid: userId, email: auth.currentUser.email, createdAt: auth.currentUser.metadata.creationTime },
    profile,
    posts,
    stories,
    highlights,
  };
}

export async function downloadProfileArchive() {
  const archive = await buildProfileArchive();
  const blobUrl = URL.createObjectURL(new Blob([JSON.stringify(archive, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  anchor.download = `kinet-profile-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
}
