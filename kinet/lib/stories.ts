import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { deleteObject, ref as storageRef } from "firebase/storage";

import { uploadToFirebaseStorage } from "@/lib/storage";
import { auth, db, storage } from "@/lib/firebase";
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
  audience: "everyone" | "followers" | "close_friends" | "selected";
  allowedViewerIds: string[];
  hiddenViewerIds: string[];
  replyAudience: "everyone" | "followers" | "no_one";
  canReply: boolean;
  mediaPath?: string;
  reactions: Record<string, string[]>;
  replyCount: number;
  thumbnailUrl?: string;
  altText: string;
  sensitiveContent: boolean;
  captionsUrl?: string;
}

let activeStoriesCache: { userId: string; expiresAt: number; stories: StoryItem[] } | null = null;
const clearActiveStoriesCache = () => { activeStoriesCache = null; };

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
    audience: data.audience === "followers" || data.audience === "close_friends" || data.audience === "selected" ? data.audience : "everyone",
    allowedViewerIds: Array.isArray(data.allowedViewerIds) ? data.allowedViewerIds as string[] : [],
    hiddenViewerIds: Array.isArray(data.hiddenViewerIds) ? data.hiddenViewerIds as string[] : [],
    replyAudience: data.replyAudience === "followers" || data.replyAudience === "no_one" ? data.replyAudience : "everyone",
    canReply: true,
    mediaPath: data.mediaPath ? String(data.mediaPath) : undefined,
    reactions: (data.reactions as Record<string, string[]> | undefined) ?? {},
    replyCount: Number(data.replyCount ?? 0),
    thumbnailUrl: data.thumbnailUrl ? String(data.thumbnailUrl) : undefined,
    altText: String(data.altText ?? ""),
    sensitiveContent: data.sensitiveContent === true,
    captionsUrl: data.captionsUrl ? String(data.captionsUrl) : undefined,
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

export async function createStory(
  file: File,
  caption: string,
  onProgress?: (progress: number) => void,
  privacy?: { audience?: StoryItem["audience"]; allowedViewerIds?: string[]; hiddenViewerIds?: string[]; replyAudience?: StoryItem["replyAudience"]; altText?: string; sensitiveContent?: boolean; captionsFile?: File | null },
  signal?: AbortSignal
) {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in to post a story.");
  }
  if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
    throw new Error("Choose an image or video.");
  }
  if (file.size > 50 * 1024 * 1024) {
    throw new Error("Stories must be smaller than 50 MB.");
  }

  let optimizedFile = file;
  let thumbnailFile: File | null = null;
  if (file.type.startsWith("image/")) {
    const { default: imageCompression } = await import("browser-image-compression");
    optimizedFile = await imageCompression(file, { maxSizeMB: 8, maxWidthOrHeight: 1920, useWebWorker: true, initialQuality: 0.86, signal });
    thumbnailFile = await imageCompression(file, { maxSizeMB: 0.25, maxWidthOrHeight: 420, useWebWorker: true, initialQuality: 0.72, signal });
  }
  if (signal?.aborted) throw new Error("Upload canceled.");
  if (privacy?.captionsFile && (privacy.captionsFile.size > 2 * 1024 * 1024 || !/\.(vtt)$/i.test(privacy.captionsFile.name))) throw new Error("Captions must be a WebVTT (.vtt) file smaller than 2 MB.");
  const [uploadedStory, uploadedThumbnail, uploadedCaptions] = await Promise.all([
    uploadToFirebaseStorage(optimizedFile, `Kinet/stories/${auth.currentUser.uid}`, onProgress, signal),
    thumbnailFile ? uploadToFirebaseStorage(thumbnailFile, `Kinet/story-thumbnails/${auth.currentUser.uid}`, undefined, signal) : Promise.resolve(null),
    privacy?.captionsFile ? uploadToFirebaseStorage(privacy.captionsFile, `Kinet/story-captions/${auth.currentUser.uid}`, undefined, signal) : Promise.resolve(null),
  ]);
  const mediaUrl = uploadedStory.url;
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await addDoc(collection(db, "stories"), {
    userId: auth.currentUser.uid,
    mediaUrl,
    mediaPath: uploadedStory.path,
    thumbnailUrl: uploadedThumbnail?.url || mediaUrl,
    altText: privacy?.altText?.trim().slice(0, 240) || "",
    sensitiveContent: privacy?.sensitiveContent === true,
    captionsUrl: uploadedCaptions?.url || null,
    mediaType: file.type.startsWith("video/") ? "video" : "image",
    caption: caption.trim().slice(0, 220),
    authorName: auth.currentUser.displayName || "Kinet User",
    authorAvatar: auth.currentUser.photoURL || "",
    createdAt: serverTimestamp(),
    expiresAt,
    seenBy: [],
    audience: privacy?.audience ?? "everyone",
    allowedViewerIds: Array.from(new Set(privacy?.allowedViewerIds ?? [])).slice(0, 100),
    hiddenViewerIds: Array.from(new Set(privacy?.hiddenViewerIds ?? [])).slice(0, 100),
    replyAudience: privacy?.replyAudience ?? "everyone",
    reactions: {},
    replyCount: 0,
  });
  clearActiveStoriesCache();
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
  let currentProfile: Record<string, unknown> | null = null;

  if (auth?.currentUser) {
    const profileSnapshot = await getDoc(doc(db, "users", auth.currentUser.uid));
    const profile = profileSnapshot.exists()
      ? (profileSnapshot.data() as Record<string, unknown>)
      : null;
    currentProfile = profile;
    following = Array.isArray(profile?.following) ? (profile.following as string[]) : [];
  }
  let activeStories = snapshot.docs
    .map((docSnapshot: { id: string; data: () => Record<string, unknown> }) =>
      mapStory(docSnapshot.id, docSnapshot.data() as Record<string, unknown>)
    )
    .filter((story: StoryItem) => (story.expiresAt?.seconds ?? 0) > nowSeconds);

  const currentUserId = auth?.currentUser?.uid ?? "";
  if (currentUserId) {
    const creatorIds = Array.from(new Set(activeStories.map((story) => story.userId)));
    const creatorProfiles = new Map<string, Record<string, unknown>>();
    await Promise.all(creatorIds.map(async (uid) => {
      const creatorSnapshot = await getDoc(doc(db!, "users", uid));
      if (creatorSnapshot.exists()) creatorProfiles.set(uid, creatorSnapshot.data() as Record<string, unknown>);
    }));
    const viewerBlocked = Array.isArray(currentProfile?.blockedUsers) ? currentProfile.blockedUsers as string[] : [];
    activeStories = activeStories.flatMap((story) => {
      if (story.userId === currentUserId) return [{ ...story, canReply: false }];
      const creator = creatorProfiles.get(story.userId);
      if (!creator) return [];
      const followers = Array.isArray(creator.followers) ? creator.followers as string[] : [];
      const closeFriends = Array.isArray(creator.closeFriends) ? creator.closeFriends as string[] : [];
      const creatorBlocked = Array.isArray(creator.blockedUsers) ? creator.blockedUsers as string[] : [];
      const settings = (creator.settings ?? {}) as Record<string, unknown>;
      if (viewerBlocked.includes(story.userId) || creatorBlocked.includes(currentUserId) || story.hiddenViewerIds.includes(currentUserId)) return [];
      if (settings.privateAccount === true && !followers.includes(currentUserId)) return [];
      if (story.audience === "followers" && !followers.includes(currentUserId)) return [];
      if (story.audience === "close_friends" && !closeFriends.includes(currentUserId)) return [];
      if (story.audience === "selected" && !story.allowedViewerIds.includes(currentUserId)) return [];
      const profileReplyAudience = settings.storyReplyAudience === "following" ? "followers" : settings.storyReplyAudience === "no_one" ? "no_one" : "everyone";
      const effectiveReplyAudience = story.replyAudience === "everyone" ? profileReplyAudience : story.replyAudience;
      return [{ ...story, canReply: effectiveReplyAudience !== "no_one" && (effectiveReplyAudience !== "followers" || followers.includes(currentUserId)) }];
    });
  }
  const cacheUserId = auth?.currentUser?.uid ?? "guest";
  if (activeStoriesCache?.userId === cacheUserId && activeStoriesCache.expiresAt > Date.now()) return activeStoriesCache.stories;

  const grouped = new Map<string, StoryItem[]>();
  activeStories.forEach((story) => grouped.set(story.userId, [...(grouped.get(story.userId) ?? []), story]));
  const creatorIds = Array.from(grouped.keys()).sort((firstId, secondId) => {
    const firstStories = grouped.get(firstId) ?? [];
    const secondStories = grouped.get(secondId) ?? [];
    const priority = (uid: string, items: StoryItem[]) =>
      (uid === currentUserId ? 100 : 0) +
      (following.includes(uid) ? 20 : 0) +
      (items.some((story) => !story.seenBy?.includes(currentUserId)) ? 5 : 0);
    const priorityDifference = priority(secondId, secondStories) - priority(firstId, firstStories);
    if (priorityDifference) return priorityDifference;
    const firstNewest = Math.max(...firstStories.map((story) => story.createdAt?.seconds ?? 0));
    const secondNewest = Math.max(...secondStories.map((story) => story.createdAt?.seconds ?? 0));
    return secondNewest - firstNewest;
  });

  // Keep every creator's stories together and play their oldest active story
  // first, matching the familiar tap-through story experience.
  const sortedStories = creatorIds.flatMap((uid) =>
    [...(grouped.get(uid) ?? [])].sort((a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0))
  );
  activeStoriesCache = { userId: cacheUserId, expiresAt: Date.now() + 20_000, stories: sortedStories };
  return sortedStories;
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
  const result = await runTransaction(firestore, async (transaction) => {
    const storyRef = doc(firestore, "stories", storyId);
    const snapshot = await transaction.get(storyRef);
    if (!snapshot.exists()) throw new Error("Story not found.");
    const data = snapshot.data() as Record<string, unknown>;
    const reactions = (data.reactions as Record<string, string[]> | undefined) ?? {};
    const users = Array.isArray(reactions[emoji]) ? reactions[emoji] : [];
    if (users.includes(auth.currentUser!.uid)) return { data, added: false };
    transaction.update(storyRef, { reactions: { ...reactions, [emoji]: Array.from(new Set([...users, auth.currentUser!.uid])) } });
    return { data, added: true };
  });
  if (!result.added) return false;
  await createNotification({ type: "story_reaction", recipientId: String(result.data.userId ?? ""), actorId: auth.currentUser.uid, actorName: auth.currentUser.displayName || "Someone", actorAvatar: auth.currentUser.photoURL || "", message: `${auth.currentUser.displayName || "Someone"} reacted ${emoji} to your story.`, storyId, thumbnailUrl: String(result.data.mediaUrl ?? "") });
  clearActiveStoriesCache();
  return true;
}

export async function recordStoryReply(storyId: string) {
  if (!auth.currentUser || !db) return;
  const firestore = db;
  await runTransaction(firestore, async (transaction) => {
    const storyRef = doc(firestore, "stories", storyId);
    const snapshot = await transaction.get(storyRef);
    if (!snapshot.exists()) throw new Error("Story not found.");
    transaction.update(storyRef, { replyCount: Number(snapshot.data().replyCount ?? 0) + 1 });
  });
}

export async function updateStoryReplyAudience(storyId: string, replyAudience: StoryItem["replyAudience"]) {
  if (!auth.currentUser || !db) throw new Error("You must be signed in.");
  await updateDoc(doc(db, "stories", storyId), { replyAudience });
}

export async function deleteStory(story: StoryItem) {
  if (!auth.currentUser || !db || story.userId !== auth.currentUser.uid) throw new Error("This story cannot be deleted.");
  await deleteDoc(doc(db, "stories", story.id));
  if (story.mediaPath && storage) await deleteObject(storageRef(storage, story.mediaPath)).catch(() => undefined);
  clearActiveStoriesCache();
}

export async function restoreArchivedStory(story: StoryItem) {
  if (!auth.currentUser || !db || story.userId !== auth.currentUser.uid) throw new Error("This story cannot be restored.");
  await updateDoc(doc(db, "stories", story.id), { createdAt: serverTimestamp(), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), seenBy: [] });
  clearActiveStoriesCache();
}
