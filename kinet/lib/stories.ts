import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDocs,
  getDoc,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { uploadToFirebaseStorage } from "@/lib/storage";
import { auth, db } from "@/lib/firebase";
import { createNotification } from "@/lib/notifications";

export interface StoryItem {
  id: string;
  userId: string;
  mediaUrl: string;
  mediaType: "image" | "video";
  caption: string;
  seenBy?: string[];
  createdAt?: { seconds?: number; nanoseconds?: number } | null;
  expiresAt?: { seconds?: number; nanoseconds?: number } | null;
  authorName: string;
  authorAvatar: string;
}

function mapStory(id: string, data: Record<string, unknown>): StoryItem {
  return {
    id,
    userId: String(data.userId ?? ""),
    mediaUrl: String(data.mediaUrl ?? ""),
    mediaType: data.mediaType === "video" ? "video" : "image",
    caption: String(data.caption ?? ""),
    seenBy: Array.isArray(data.seenBy) ? (data.seenBy as string[]) : [],
    createdAt:
      (data.createdAt as { seconds?: number; nanoseconds?: number } | null | undefined) ?? null,
    expiresAt:
      (data.expiresAt as { seconds?: number; nanoseconds?: number } | null | undefined) ?? null,
    authorName: String(data.authorName ?? "Kinet User"),
    authorAvatar: String(data.authorAvatar ?? ""),
  };
}

export function formatStoryTime(createdAt?: { seconds?: number } | null) {
  if (!createdAt?.seconds) {
    return "now";
  }

  const diffSeconds = Math.max(1, Math.floor(Date.now() / 1000) - createdAt.seconds);
  if (diffSeconds < 60) {
    return `${diffSeconds}s`;
  }

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes}m`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
}

export async function createStory(file: File, caption: string) {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in to post a story.");
  }

  const uploadedStory = await uploadToFirebaseStorage(file, `Kinet/stories/${auth.currentUser.uid}`);
  const mediaUrl = uploadedStory.url;
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await addDoc(collection(db, "stories"), {
    userId: auth.currentUser.uid,
    mediaUrl,
    mediaType: file.type.startsWith("video/") ? "video" : "image",
    caption: caption.trim(),
    authorName: auth.currentUser.displayName || "Kinet User",
    authorAvatar: auth.currentUser.photoURL || "",
    createdAt: serverTimestamp(),
    expiresAt,
    seenBy: [],
  });
}

export async function getActiveStories() {
  if (!db) {
    return [];
  }

  const snapshot = await getDocs(
    query(collection(db, "stories"), orderBy("createdAt", "desc"), limit(50))
  );
  const nowSeconds = Math.floor(Date.now() / 1000);
  let following: string[] = [];

  if (auth?.currentUser) {
    const profileSnapshot = await getDoc(doc(db, "users", auth.currentUser.uid));
    const profile = profileSnapshot.exists()
      ? (profileSnapshot.data() as Record<string, unknown>)
      : null;
    following = Array.isArray(profile?.following) ? (profile.following as string[]) : [];
  }
  const activeStories = snapshot.docs
    .map((docSnapshot: { id: string; data: () => Record<string, unknown> }) =>
      mapStory(docSnapshot.id, docSnapshot.data() as Record<string, unknown>)
    )
    .filter((story: StoryItem) => (story.expiresAt?.seconds ?? 0) > nowSeconds);

  const currentUserId = auth?.currentUser?.uid ?? "";

  return activeStories.sort((a: StoryItem, b: StoryItem) => {
    const aOwn = a.userId === currentUserId ? 1 : 0;
    const bOwn = b.userId === currentUserId ? 1 : 0;
    if (aOwn !== bOwn) {
      return bOwn - aOwn;
    }

    const aFollowing = following.includes(a.userId) ? 1 : 0;
    const bFollowing = following.includes(b.userId) ? 1 : 0;
    if (aFollowing !== bFollowing) {
      return bFollowing - aFollowing;
    }

    const aSeen = a.seenBy?.includes(currentUserId) ? 1 : 0;
    const bSeen = b.seenBy?.includes(currentUserId) ? 1 : 0;
    if (aSeen !== bSeen) {
      return aSeen - bSeen;
    }

    return (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0);
  });
}

export async function markStorySeen(storyId: string) {
  if (!auth?.currentUser || !db) {
    return;
  }

  await setDoc(
    doc(db, "stories", storyId),
    {
      seenBy: arrayUnion(auth.currentUser.uid),
    },
    { merge: true }
  );
}

export async function reactToStory(storyId: string, emoji: string) {
  if (!auth.currentUser || !db) throw new Error("You must be signed in.");
  const firestore = db;
  const story = await runTransaction(firestore, async (transaction) => {
    const storyRef = doc(firestore, "stories", storyId);
    const snapshot = await transaction.get(storyRef);
    if (!snapshot.exists()) throw new Error("Story not found.");
    const data = snapshot.data() as Record<string, unknown>;
    const reactions = (data.reactions as Record<string, string[]> | undefined) ?? {};
    const users = Array.isArray(reactions[emoji]) ? reactions[emoji] : [];
    transaction.update(storyRef, { reactions: { ...reactions, [emoji]: Array.from(new Set([...users, auth.currentUser!.uid])) } });
    return data;
  });
  await createNotification({ type: "story_reaction", recipientId: String(story.userId ?? ""), actorId: auth.currentUser.uid, actorName: auth.currentUser.displayName || "Someone", actorAvatar: auth.currentUser.photoURL || "", message: `${auth.currentUser.displayName || "Someone"} reacted ${emoji} to your story.`, storyId, thumbnailUrl: String(story.mediaUrl ?? "") });
}
