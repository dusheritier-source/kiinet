import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

import { uploadToFirebaseStorage } from "@/lib/storage";
import { auth, db } from "@/lib/firebase";
import { recordViewedPost } from "@/lib/history";
import { createNotification } from "@/lib/notifications";

export interface FeedPost {
  id: string;
  userId: string;
  caption: string;
  mediaUrl: string;
  mediaType: "image" | "video";
  mediaItems?: Array<{ url: string; type: "image" | "video"; path?: string }>;
  contentType: "post" | "reel";
  postType?: "standard" | "poll" | "qa";
  sport: string;
  createdAt?: { seconds?: number; nanoseconds?: number } | null;
  likes: string[];
  commentsCount: number;
  shares: number;
  saves: string[];
  hashtags: string[];
  views?: number;
  completedViews?: number;
  mentionUserIds?: string[];
  pinned?: boolean;
  editedAt?: { seconds?: number } | null;
  collaborators?: Array<{
    uid: string;
    name: string;
    username: string;
  }>;
  remixOf?: string | null;
  scheduledFor?: { seconds?: number; nanoseconds?: number } | null;
  visibility?: "public" | "subscribers" | "premium_group";
  premiumGroupId?: string | null;
  sponsored?: boolean;
  sponsorLabel?: string | null;
  autoCaption?: string | null;
  translatedCaption?: string | null;
  accessibilityLabel?: string | null;
  sensitive?: boolean;
  contentWarning?: string | null;
  aiHighlightAnalysis?: string | null;
  voiceoverScript?: string | null;
  thumbnailHint?: string | null;
  thumbnailUrl?: string | null;
  musicUrl?: string | null;
  musicTitle?: string | null;
  originalVolume?: number;
  musicVolume?: number;
  playbackRate?: number;
  visualFilter?: "none" | "warm" | "cool" | "mono" | "vivid";
  rotation?: 0 | 90 | 180 | 270;
  overlayText?: string | null;
  overlayPosition?: "top" | "center" | "bottom";
  sticker?: string | null;
  commentsEnabled?: boolean;
  allowRemix?: boolean;
  commentKeywords?: string[];
  clipStartSec?: number | null;
  clipEndSec?: number | null;
  watermarkEnabled?: boolean;
  downloadProtected?: boolean;
  rightClickProtected?: boolean;
  questionPrompt?: string | null;
  poll?: {
    options: Array<{
      label: string;
      votes: string[];
    }>;
  } | null;
  storagePath?: string;
  originalPostId?: string | null;
  author: {
    name: string;
    username: string;
    avatar: string;
    verified: boolean;
    role?: string | null;
    location?: string | null;
  };
}

export interface PostComment {
  id: string;
  postId: string;
  userId: string;
  text: string;
  parentCommentId?: string | null;
  reactions?: Record<string, string[]>;
  mentionUserIds?: string[];
  pinned?: boolean;
  editedAt?: { seconds?: number } | null;
  createdAt?: { seconds?: number; nanoseconds?: number } | null;
  author: {
    name: string;
    username: string;
    avatar: string;
  };
}

interface CreatePostInput {
  caption: string;
  sport?: string;
  file?: File | null;
  files?: File[];
  contentType?: "post" | "reel";
  postType?: "standard" | "poll" | "qa";
  questionPrompt?: string;
  pollOptions?: string[];
  collaborators?: string[];
  remixPostId?: string;
  scheduledFor?: string;
  visibility?: "public" | "subscribers" | "premium_group";
  premiumGroupId?: string;
  sponsored?: boolean;
  sponsorLabel?: string;
  autoCaption?: string;
  translatedCaption?: string;
  accessibilityLabel?: string;
  sensitive?: boolean;
  contentWarning?: string;
  aiHighlightAnalysis?: string;
  voiceoverScript?: string;
  thumbnailHint?: string;
  clipStartSec?: number;
  clipEndSec?: number;
  watermarkEnabled?: boolean;
  downloadProtected?: boolean;
  rightClickProtected?: boolean;
  coverFile?: File | null;
  onUploadProgress?: (progress: number) => void;
  signal?: AbortSignal;
  musicFile?: File | null;
  musicSourceUrl?: string;
  musicTitle?: string;
  originalVolume?: number;
  musicVolume?: number;
  playbackRate?: number;
  visualFilter?: "none" | "warm" | "cool" | "mono" | "vivid";
  rotation?: 0 | 90 | 180 | 270;
  overlayText?: string;
  overlayPosition?: "top" | "center" | "bottom";
  sticker?: string;
  commentsEnabled?: boolean;
  allowRemix?: boolean;
  commentKeywords?: string[];
}

type ListenerCleanup = () => void;

let cachedViewerProfile:
  | {
      uid: string;
      expiresAt: number;
      value: Awaited<ReturnType<typeof getCurrentAuthorProfile>>;
    }
  | null = null;

function assertFirebaseReady() {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in and Firebase must be configured.");
  }
}

function extractHashtags(caption: string) {
  const matches = caption.match(/#[a-z0-9_]+/gi) ?? [];
  return Array.from(new Set(matches.map((tag) => tag.replace("#", "").toLowerCase())));
}

function extractMentionTokens(text: string) {
  const matches = text.match(/@[a-z0-9_]+/gi) ?? [];
  return Array.from(new Set(matches.map((token) => token.replace("@", "").toLowerCase())));
}

async function resolveMentionedUserIds(text: string): Promise<string[]> {
  if (!db) {
    return [];
  }

  const mentionTokens = extractMentionTokens(text);
  if (mentionTokens.length === 0) {
    return [];
  }

  const usersSnapshot = await getDocs(query(collection(db, "users"), limit(100)));
  const matchedUserIds = usersSnapshot.docs
    .map((docSnapshot: { id: string; data: () => Record<string, unknown> }) => {
      const data = docSnapshot.data() as Record<string, unknown>;
      const displayName = String(data.displayName ?? "").toLowerCase().replace(/\s+/g, "");
      const username = docSnapshot.id.slice(0, 8).toLowerCase();
      const explicitUsername = String(data.username ?? "").toLowerCase();
      const matchesToken = mentionTokens.some(
        (token) => token === username || token === explicitUsername || token === displayName
      );
      return matchesToken ? docSnapshot.id : null;
    })
    .filter((value: string | null): value is string => Boolean(value));

  return Array.from(new Set(matchedUserIds));
}

async function resolveTaggedUsers(tokens: string[]): Promise<
  Array<{ uid: string; name: string; username: string }>
> {
  if (!db) {
    return [];
  }

  const normalizedTokens = tokens
    .map((token) => token.trim().replace(/^@/, "").toLowerCase())
    .filter(Boolean);

  if (normalizedTokens.length === 0) {
    return [];
  }

  const usersSnapshot = await getDocs(query(collection(db, "users"), limit(100)));
  const matches = usersSnapshot.docs
    .map((docSnapshot: { id: string; data: () => Record<string, unknown> }) => {
      const data = docSnapshot.data() as Record<string, unknown>;
      const displayName = String(data.displayName ?? "");
      const displayNameSlug = displayName.toLowerCase().replace(/\s+/g, "");
      const username = docSnapshot.id.slice(0, 8).toLowerCase();
      const explicitUsername = String(data.username ?? "").toLowerCase();
      const matched = normalizedTokens.some(
        (token) =>
          token === username ||
          token === explicitUsername ||
          token === displayNameSlug ||
          token === docSnapshot.id.toLowerCase()
      );

      if (!matched) {
        return null;
      }

      return {
        uid: docSnapshot.id,
        name: displayName || "Kinet User",
        username: `@${explicitUsername || username}`,
      } as { uid: string; name: string; username: string };
    })
    .filter(
      (
        value: { uid: string; name: string; username: string } | null
      ): value is { uid: string; name: string; username: string } => Boolean(value)
    );

  return Array.from(
    new Map<string, { uid: string; name: string; username: string }>(
      matches.map((item: { uid: string; name: string; username: string }) => [item.uid, item])
    ).values()
  );
}

function mapPost(id: string, data: Record<string, unknown>): FeedPost {
  const author = (data.author as Record<string, unknown> | undefined) ?? {};

  return {
    id,
    userId: String(data.userId ?? ""),
    caption: String(data.caption ?? ""),
    mediaUrl: String(data.mediaUrl ?? ""),
    mediaType: data.mediaType === "video" ? "video" : "image",
    mediaItems: Array.isArray(data.mediaItems) ? (data.mediaItems as Array<Record<string, unknown>>).map((item) => ({ url: String(item.url ?? ""), type: (item.type === "video" ? "video" : "image") as "image" | "video", path: item.path ? String(item.path) : undefined })).filter((item) => item.url) : [],
    contentType: data.contentType === "reel" ? "reel" : "post",
    postType:
      data.postType === "poll" || data.postType === "qa" ? data.postType : "standard",
    sport: String(data.sport ?? ""),
    createdAt:
      (data.createdAt as { seconds?: number; nanoseconds?: number } | null | undefined) ?? null,
    likes: Array.isArray(data.likes) ? (data.likes as string[]) : [],
    commentsCount: Number(data.commentsCount ?? 0),
    shares: Number(data.shares ?? 0),
    saves: Array.isArray(data.saves) ? (data.saves as string[]) : [],
    hashtags: Array.isArray(data.hashtags) ? (data.hashtags as string[]) : [],
    views: Number(data.views ?? 0),
    completedViews: Number(data.completedViews ?? 0),
    mentionUserIds: Array.isArray(data.mentionUserIds) ? (data.mentionUserIds as string[]) : [],
    pinned: data.pinned === true,
    editedAt: (data.editedAt as { seconds?: number } | null | undefined) ?? null,
    collaborators: Array.isArray(data.collaborators)
      ? (data.collaborators as Array<Record<string, unknown>>).map((collaborator) => ({
          uid: String(collaborator.uid ?? ""),
          name: String(collaborator.name ?? "Kinet User"),
          username: String(collaborator.username ?? "@player"),
        }))
      : [],
    remixOf: data.remixOf ? String(data.remixOf) : null,
    scheduledFor:
      (data.scheduledFor as { seconds?: number; nanoseconds?: number } | null | undefined) ?? null,
    visibility:
      data.visibility === "subscribers" || data.visibility === "premium_group"
        ? data.visibility
        : "public",
    premiumGroupId: data.premiumGroupId ? String(data.premiumGroupId) : null,
    sponsored: data.sponsored === true,
    sponsorLabel: data.sponsorLabel ? String(data.sponsorLabel) : null,
    autoCaption: data.autoCaption ? String(data.autoCaption) : null,
    translatedCaption: data.translatedCaption ? String(data.translatedCaption) : null,
    accessibilityLabel: data.accessibilityLabel ? String(data.accessibilityLabel) : null,
    sensitive: data.sensitive === true,
    contentWarning: data.contentWarning ? String(data.contentWarning) : null,
    aiHighlightAnalysis: data.aiHighlightAnalysis ? String(data.aiHighlightAnalysis) : null,
    voiceoverScript: data.voiceoverScript ? String(data.voiceoverScript) : null,
    thumbnailHint: data.thumbnailHint ? String(data.thumbnailHint) : null,
    thumbnailUrl: data.thumbnailUrl ? String(data.thumbnailUrl) : null,
    musicUrl: data.musicUrl ? String(data.musicUrl) : null,
    musicTitle: data.musicTitle ? String(data.musicTitle) : null,
    originalVolume: Number(data.originalVolume ?? 1),
    musicVolume: Number(data.musicVolume ?? 0.7),
    playbackRate: Number(data.playbackRate ?? 1),
    visualFilter: data.visualFilter === "warm" || data.visualFilter === "cool" || data.visualFilter === "mono" || data.visualFilter === "vivid" ? data.visualFilter : "none",
    rotation: data.rotation === 90 || data.rotation === 180 || data.rotation === 270 ? data.rotation : 0,
    overlayText: data.overlayText ? String(data.overlayText) : null,
    overlayPosition: data.overlayPosition === "top" || data.overlayPosition === "center" ? data.overlayPosition : "bottom",
    sticker: data.sticker ? String(data.sticker) : null,
    commentsEnabled: data.commentsEnabled !== false,
    allowRemix: data.allowRemix !== false,
    commentKeywords: Array.isArray(data.commentKeywords) ? data.commentKeywords as string[] : [],
    clipStartSec: typeof data.clipStartSec === "number" ? data.clipStartSec : null,
    clipEndSec: typeof data.clipEndSec === "number" ? data.clipEndSec : null,
    watermarkEnabled: data.watermarkEnabled === true,
    downloadProtected: data.downloadProtected === true,
    rightClickProtected: data.rightClickProtected === true,
    questionPrompt: data.questionPrompt ? String(data.questionPrompt) : null,
    poll:
      data.poll && typeof data.poll === "object"
        ? {
            options: Array.isArray((data.poll as { options?: unknown[] }).options)
              ? ((data.poll as { options?: Array<Record<string, unknown>> }).options ?? []).map(
                  (option) => ({
                    label: String(option.label ?? ""),
                    votes: Array.isArray(option.votes) ? (option.votes as string[]) : [],
                  })
                )
              : [],
          }
        : null,
    storagePath: data.storagePath ? String(data.storagePath) : undefined,
    originalPostId: data.originalPostId ? String(data.originalPostId) : null,
    author: {
      name: String(author.name ?? "Kinet User"),
      username: String(author.username ?? "@player"),
      avatar: String(author.avatar ?? ""),
      verified: Boolean(author.verified),
      role: author.role ? String(author.role) : null,
      location: author.location ? String(author.location) : null,
    },
  };
}

function mapComment(id: string, data: Record<string, unknown>): PostComment {
  const author = (data.author as Record<string, unknown> | undefined) ?? {};

  return {
    id,
    postId: String(data.postId ?? ""),
    userId: String(data.userId ?? ""),
    text: String(data.text ?? ""),
    parentCommentId: data.parentCommentId ? String(data.parentCommentId) : null,
    reactions:
      data.reactions && typeof data.reactions === "object"
        ? Object.fromEntries(
            Object.entries(data.reactions as Record<string, unknown>).map(([emoji, users]) => [
              emoji,
              Array.isArray(users) ? (users as string[]) : [],
            ])
          )
        : {},
    mentionUserIds: Array.isArray(data.mentionUserIds) ? (data.mentionUserIds as string[]) : [],
    pinned: data.pinned === true,
    editedAt: (data.editedAt as { seconds?: number } | null | undefined) ?? null,
    createdAt:
      (data.createdAt as { seconds?: number; nanoseconds?: number } | null | undefined) ?? null,
    author: {
      name: String(author.name ?? "Kinet User"),
      username: String(author.username ?? "@player"),
      avatar: String(author.avatar ?? ""),
    },
  };
}

async function getCurrentAuthorProfile() {
  assertFirebaseReady();

  const user = auth.currentUser!;
  const profileSnapshot = await getDoc(doc(db!, "users", user.uid));
  const profile = profileSnapshot.exists()
    ? (profileSnapshot.data() as Record<string, unknown>)
    : null;
  const role = (profile?.role as Record<string, unknown> | undefined) ?? {};

  return {
    profile,
    author: {
      name: user.displayName || String(profile?.displayName ?? "Kinet User"),
      username: `@${String(profile?.username ?? user.uid.slice(0, 8))}`,
      avatar: user.photoURL || String(profile?.photoURL ?? ""),
      verified: Boolean(profile?.verified),
      role: role.type ? String(role.type) : null,
      location: profile?.location ? String(profile.location) : null,
    },
    defaultSport: role.sport ? String(role.sport) : "",
    following: Array.isArray(profile?.following) ? (profile?.following as string[]) : [],
    blockedUsers: Array.isArray(profile?.blockedUsers) ? (profile?.blockedUsers as string[]) : [],
  };
}

async function getCachedViewerProfile() {
  if (!auth?.currentUser) {
    return null;
  }

  const uid = auth.currentUser.uid;
  const now = Date.now();
  if (cachedViewerProfile && cachedViewerProfile.uid === uid && cachedViewerProfile.expiresAt > now) {
    return cachedViewerProfile.value;
  }

  const value = await getCurrentAuthorProfile();
  cachedViewerProfile = {
    uid,
    expiresAt: now + 30_000,
    value,
  };
  return value;
}

async function incrementUserCounter(userId: string, field: "postsCount" | "reelsCount", amount: number) {
  await setDoc(
    doc(db!, "users", userId),
    {
      [field]: increment(amount),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function createPost({
  caption,
  sport,
  file,
  files = [],
  contentType = "post",
  postType = "standard",
  questionPrompt = "",
  pollOptions = [],
  collaborators = [],
  remixPostId,
  scheduledFor = "",
  visibility = "public",
  premiumGroupId = "",
  sponsored = false,
  sponsorLabel = "",
  autoCaption = "",
  translatedCaption = "",
  accessibilityLabel = "",
  sensitive = false,
  contentWarning = "",
  aiHighlightAnalysis = "",
  voiceoverScript = "",
  thumbnailHint = "",
  clipStartSec,
  clipEndSec,
  watermarkEnabled = false,
  downloadProtected = false,
  rightClickProtected = false,
  coverFile = null,
  onUploadProgress,
  signal,
  musicFile = null,
  musicSourceUrl = "",
  musicTitle = "",
  originalVolume = 1,
  musicVolume = 0.7,
  playbackRate = 1,
  visualFilter = "none",
  rotation = 0,
  overlayText = "",
  overlayPosition = "bottom",
  sticker = "",
  commentsEnabled = true,
  allowRemix = true,
  commentKeywords = [],
}: CreatePostInput) {
  assertFirebaseReady();

  const user = auth!.currentUser;
  const { author } = await getCurrentAuthorProfile();

  const selectedFiles = (files.length ? files : file ? [file] : []).slice(0, 10);
  const [uploadedItems, uploadedCover, uploadedMusic] = await Promise.all([
    Promise.all(selectedFiles.map(async (selectedFile, index) => { const uploaded = await uploadToFirebaseStorage(selectedFile, `Kinet/${contentType === "reel" ? "reels" : "posts"}/${user!.uid}`, index === 0 ? onUploadProgress : undefined, signal); return { url: uploaded.url, path: uploaded.path, type: selectedFile.type.startsWith("video/") ? "video" as const : "image" as const }; })),
    coverFile ? uploadToFirebaseStorage(coverFile, `Kinet/reel-covers/${user!.uid}`, undefined, signal) : Promise.resolve(null),
    musicFile ? uploadToFirebaseStorage(musicFile, `Kinet/reel-audio/${user!.uid}`, undefined, signal) : Promise.resolve(null),
  ]);
  const uploadedMedia = uploadedItems[0] ?? null;
  const mediaType = uploadedMedia?.type ?? "image";
  const mediaUrl = uploadedMedia?.url ?? "";
  const trimmedCaption = caption.trim();
  const mentionUserIds = await resolveMentionedUserIds(
    [trimmedCaption, questionPrompt.trim()].filter(Boolean).join(" ")
  );
  const collaboratorRecords = await resolveTaggedUsers(collaborators);
  const scheduledDate = scheduledFor.trim().length > 0 ? new Date(scheduledFor) : null;
  const normalizedPollOptions =
    postType === "poll"
      ? pollOptions.map((option: string) => option.trim()).filter(Boolean)
      : [];

  if (postType === "poll" && normalizedPollOptions.length < 2) {
    throw new Error("Polls need at least two options.");
  }

  const postRef = await addDoc(collection(db!, "posts"), {
    userId: user!.uid,
    caption: trimmedCaption,
    mediaUrl,
    mediaType,
    mediaItems: uploadedItems,
    contentType,
    postType,
    sport: sport?.trim() || "",
    likes: [],
    commentsCount: 0,
    shares: 0,
    saves: [],
    hashtags: extractHashtags(trimmedCaption),
    views: 0,
    completedViews: 0,
    mentionUserIds,
    collaborators: collaboratorRecords,
    remixOf: remixPostId?.trim() || null,
    scheduledFor:
      scheduledDate && !Number.isNaN(scheduledDate.getTime()) && scheduledDate.getTime() > Date.now()
        ? scheduledDate
        : null,
    visibility,
    premiumGroupId: visibility === "premium_group" ? premiumGroupId.trim() || null : null,
    sponsored,
    sponsorLabel: sponsored ? sponsorLabel.trim() || "Sponsored" : null,
    autoCaption: autoCaption.trim() || null,
    translatedCaption: translatedCaption.trim() || null,
    accessibilityLabel: accessibilityLabel.trim() || null,
    sensitive,
    contentWarning: sensitive ? contentWarning.trim().slice(0, 120) || "Sensitive content" : null,
    aiHighlightAnalysis: aiHighlightAnalysis.trim() || null,
    voiceoverScript: voiceoverScript.trim() || null,
    thumbnailHint: thumbnailHint.trim() || null,
    thumbnailUrl: uploadedCover?.url || null,
    musicUrl: uploadedMusic?.url || musicSourceUrl || null,
    musicTitle: uploadedMusic || musicSourceUrl ? musicTitle.trim().slice(0, 80) || musicFile?.name || "Original audio" : null,
    originalVolume: Math.max(0, Math.min(1, originalVolume)),
    musicVolume: Math.max(0, Math.min(1, musicVolume)),
    playbackRate: [0.5, 0.75, 1, 1.25, 1.5, 2].includes(playbackRate) ? playbackRate : 1,
    visualFilter,
    rotation,
    overlayText: overlayText.trim().slice(0, 120) || null,
    overlayPosition,
    sticker: sticker.slice(0, 8) || null,
    commentsEnabled,
    allowRemix,
    commentKeywords: commentKeywords.map((word) => word.trim().toLowerCase()).filter(Boolean).slice(0, 30),
    clipStartSec: typeof clipStartSec === "number" ? clipStartSec : null,
    clipEndSec: typeof clipEndSec === "number" ? clipEndSec : null,
    watermarkEnabled,
    downloadProtected,
    rightClickProtected,
    questionPrompt: postType === "qa" ? questionPrompt.trim() || trimmedCaption : null,
    poll:
      postType === "poll"
        ? {
            options: normalizedPollOptions.map((label: string) => ({ label, votes: [] })),
          }
        : null,
    author,
    storagePath: uploadedMedia?.path ?? "",
    createdAt: serverTimestamp(),
  });

  await Promise.all(
    mentionUserIds
      .filter((mentionedUserId) => mentionedUserId !== user!.uid)
      .map((mentionedUserId) =>
        createNotification({
          type: "mention",
          recipientId: mentionedUserId,
          actorId: user!.uid,
          actorName: author.name,
          actorAvatar: author.avatar,
          message: `${author.name} mentioned you in a post.`,
          postId: postRef.id,
          thumbnailUrl: mediaUrl || undefined,
        }).catch(() => undefined)
      )
  );

  await Promise.all(
    collaboratorRecords
      .filter((collaborator) => collaborator.uid !== user!.uid)
      .map((collaborator) =>
        createNotification({
          type: "collaboration_invite",
          recipientId: collaborator.uid,
          actorId: user!.uid,
          actorName: author.name,
          actorAvatar: author.avatar,
          message: `${author.name} tagged you as a collaborator on a post.`,
          postId: postRef.id,
          thumbnailUrl: mediaUrl || undefined,
        }).catch(() => undefined)
      )
  );

  const creatorSnapshot = await getDoc(doc(db!, "users", user!.uid));
  const followers = creatorSnapshot.exists() && Array.isArray(creatorSnapshot.data().followers) ? creatorSnapshot.data().followers as string[] : [];
  await Promise.all(followers.slice(0, 100).map((recipientId) => createNotification({ type: "creator_update", recipientId, actorId: user!.uid, actorName: author.name, actorAvatar: author.avatar, message: `${author.name} shared a new ${contentType === "reel" ? "video" : "post"}.`, postId: postRef.id, thumbnailUrl: mediaUrl || undefined }).catch(() => undefined)));

  await incrementUserCounter(user!.uid, contentType === "reel" ? "reelsCount" : "postsCount", 1).catch(() => undefined);
  return postRef.id;
}

export async function updatePost(postId: string, input: { caption: string; sport: string }) {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in to edit posts.");
  }

  const trimmedCaption = input.caption.trim();
  await updateDoc(doc(db, "posts", postId), {
    caption: trimmedCaption,
    sport: input.sport.trim(),
    hashtags: extractHashtags(trimmedCaption),
    mentionUserIds: await resolveMentionedUserIds(trimmedCaption),
    updatedAt: serverTimestamp(),
  });
}

export async function deletePost(postId: string) {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in to delete posts.");
  }

  const snapshot = await getDoc(doc(db, "posts", postId));
  if (!snapshot.exists()) {
    return;
  }

  const post = snapshot.data() as Record<string, unknown>;
  if (String(post.userId ?? "") !== auth.currentUser.uid) {
    throw new Error("You can only delete your own posts.");
  }

  await deleteDoc(doc(db, "posts", postId));
  await incrementUserCounter(
    auth.currentUser.uid,
    post.contentType === "reel" ? "reelsCount" : "postsCount",
    -1
  );
}

export async function getCurrentUserSport() {
  const result = await getCurrentAuthorProfile();
  return result.defaultSport;
}

export async function togglePostLike(postId: string, hasLiked: boolean) {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in to like posts.");
  }

  const userId = auth.currentUser.uid;
  const postSnapshot = await getDoc(doc(db, "posts", postId));
  const post = postSnapshot.exists() ? (postSnapshot.data() as Record<string, unknown>) : null;

  await updateDoc(doc(db, "posts", postId), {
    likes: hasLiked ? arrayRemove(userId) : arrayUnion(userId),
  });

  if (!hasLiked && post) {
    await createNotification({
      type: "like",
      recipientId: String(post.userId ?? ""),
      actorId: userId,
      actorName: auth.currentUser.displayName || "Kinet User",
      actorAvatar: auth.currentUser.photoURL || "",
      message: `${auth.currentUser.displayName || "Someone"} liked your post.`,
      postId,
      thumbnailUrl: typeof post.mediaUrl === "string" ? post.mediaUrl : undefined,
    });
  }
}

export async function toggleSavePost(postId: string, isSaved: boolean) {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in to save posts.");
  }

  const userId = auth.currentUser.uid;
  await updateDoc(doc(db, "posts", postId), {
    saves: isSaved ? arrayRemove(userId) : arrayUnion(userId),
  });

  await setDoc(
    doc(db, "users", userId),
    {
      savedPosts: isSaved ? arrayRemove(postId) : arrayUnion(postId),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function repostPost(postId: string) {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in to repost.");
  }

  const snapshot = await getDoc(doc(db, "posts", postId));
  if (!snapshot.exists()) {
    throw new Error("Post not found.");
  }

  const post = mapPost(snapshot.id, snapshot.data() as Record<string, unknown>);
  const { author } = await getCurrentAuthorProfile();

  await addDoc(collection(db, "posts"), {
    userId: auth.currentUser.uid,
    caption: `Reposted: ${post.caption}`.trim(),
    mediaUrl: post.mediaUrl,
    mediaType: post.mediaType,
    contentType: post.contentType,
    sport: post.sport,
    likes: [],
    commentsCount: 0,
    shares: 0,
    saves: [],
    hashtags: post.hashtags,
    views: 0,
    completedViews: 0,
    author,
    originalPostId: postId,
    createdAt: serverTimestamp(),
  });

  await updateDoc(doc(db, "posts", postId), {
    shares: increment(1),
  });

  await incrementUserCounter(
    auth.currentUser.uid,
    post.contentType === "reel" ? "reelsCount" : "postsCount",
    1
  );

  await createNotification({
    type: "repost",
    recipientId: post.userId,
    actorId: auth.currentUser.uid,
    actorName: auth.currentUser.displayName || "Kinet User",
    actorAvatar: auth.currentUser.photoURL || "",
    message: `${auth.currentUser.displayName || "Someone"} reposted your ${post.contentType}.`,
    postId,
  });
}

export async function togglePollVote(postId: string, optionIndex: number) {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in to vote.");
  }

  const snapshot = await getDoc(doc(db, "posts", postId));
  if (!snapshot.exists()) {
    throw new Error("Post not found.");
  }

  const post = snapshot.data() as Record<string, unknown>;
  const pollOptions = Array.isArray((post.poll as { options?: unknown[] } | undefined)?.options)
    ? (((post.poll as { options?: Array<Record<string, unknown>> }).options ?? []).map((option) => ({
        label: String(option.label ?? ""),
        votes: Array.isArray(option.votes) ? (option.votes as string[]) : [],
      })) as Array<{ label: string; votes: string[] }>)
    : [];

  const nextPollOptions = pollOptions.map((option, index) => {
    const withoutCurrentUser = option.votes.filter((uid) => uid !== auth.currentUser?.uid);
    return {
      ...option,
      votes:
        index === optionIndex
          ? option.votes.includes(auth.currentUser!.uid)
            ? withoutCurrentUser
            : [...withoutCurrentUser, auth.currentUser!.uid]
          : withoutCurrentUser,
    };
  });

  await updateDoc(doc(db, "posts", postId), {
    poll: { options: nextPollOptions },
  });

  if (String(post.userId ?? "") !== auth.currentUser.uid) {
    await createNotification({
      type: "poll_vote",
      recipientId: String(post.userId ?? ""),
      actorId: auth.currentUser.uid,
      actorName: auth.currentUser.displayName || "Kinet User",
      actorAvatar: auth.currentUser.photoURL || "",
      message: `${auth.currentUser.displayName || "Someone"} voted in your poll.`,
      postId,
    });
  }
}

export async function recordPostView(postId: string, completed = false) {
  if (!db) {
    return;
  }

  await recordViewedPost(postId);
  await updateDoc(doc(db, "posts", postId), {
    views: increment(1),
    ...(completed ? { completedViews: increment(1) } : {}),
  });
}

export async function addPostComment(postId: string, text: string, parentCommentId?: string) {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in to comment.");
  }

  const trimmedText = text.trim();
  if (!trimmedText) {
    throw new Error("Comment cannot be empty.");
  }

  const { author } = await getCurrentAuthorProfile();
  const postSnapshot = await getDoc(doc(db, "posts", postId));
  const post = postSnapshot.exists() ? (postSnapshot.data() as Record<string, unknown>) : null;
  if (post?.commentsEnabled === false) throw new Error("Comments are turned off for this reel.");
  const blockedCommentWords = Array.isArray(post?.commentKeywords) ? post.commentKeywords as string[] : [];
  if (blockedCommentWords.some((word) => trimmedText.toLowerCase().includes(word.toLowerCase()))) throw new Error("This comment contains a word blocked by the creator.");

  const commentRef = await addDoc(collection(db, "comments"), {
    postId,
    userId: auth.currentUser.uid,
    text: trimmedText,
    parentCommentId: parentCommentId ?? null,
    mentionUserIds: await resolveMentionedUserIds(trimmedText),
    reactions: {},
    author: {
      name: author.name,
      username: author.username,
      avatar: author.avatar,
    },
    createdAt: serverTimestamp(),
  });

  await updateDoc(doc(db, "posts", postId), {
    commentsCount: increment(1),
  });

  if (post) {
    await createNotification({
      type: "comment",
      recipientId: String(post.userId ?? ""),
      actorId: auth.currentUser.uid,
      actorName: author.name,
      actorAvatar: author.avatar,
      message: `${author.name} commented on your post.`,
      postId,
      commentId: commentRef.id,
      thumbnailUrl: typeof post.mediaUrl === "string" ? post.mediaUrl : undefined,
    });
  }

  const mentionedUserIds = await resolveMentionedUserIds(trimmedText);
  await Promise.all(
    mentionedUserIds
      .filter((mentionedUserId) => mentionedUserId !== auth.currentUser?.uid)
      .map((mentionedUserId) =>
        createNotification({
          type: "mention",
          recipientId: mentionedUserId,
          actorId: auth.currentUser!.uid,
          actorName: author.name,
          actorAvatar: author.avatar,
          message: `${author.name} mentioned you in a comment.`,
          postId,
          commentId: commentRef.id,
        })
      )
  );
  if (parentCommentId) {
    const parentSnapshot = await getDoc(doc(db, "comments", parentCommentId));
    if (parentSnapshot.exists()) await createNotification({ type: "comment_reply", recipientId: String(parentSnapshot.data().userId ?? ""), actorId: auth.currentUser.uid, actorName: author.name, actorAvatar: author.avatar, message: `${author.name} replied to your comment.`, postId, commentId: commentRef.id });
  }
}

export async function toggleCommentReaction(commentId: string, emoji: string) {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in to react.");
  }

  const snapshot = await getDoc(doc(db, "comments", commentId));
  if (!snapshot.exists()) {
    throw new Error("Comment not found.");
  }

  const comment = snapshot.data() as Record<string, unknown>;
  const reactions = (comment.reactions as Record<string, unknown> | undefined) ?? {};
  const currentUsers = Array.isArray(reactions[emoji]) ? (reactions[emoji] as string[]) : [];
  const nextUsers = currentUsers.includes(auth.currentUser.uid)
    ? currentUsers.filter((uid) => uid !== auth.currentUser?.uid)
    : [...currentUsers, auth.currentUser.uid];

  await setDoc(
    doc(db, "comments", commentId),
    {
      reactions: {
        ...reactions,
        [emoji]: nextUsers,
      },
    },
    { merge: true }
  );
  if (!currentUsers.includes(auth.currentUser.uid)) {
    await createNotification({ type: "comment_reaction", recipientId: String(comment.userId ?? ""), actorId: auth.currentUser.uid, actorName: auth.currentUser.displayName || "Someone", actorAvatar: auth.currentUser.photoURL || "", message: `${auth.currentUser.displayName || "Someone"} reacted ${emoji} to your comment.`, postId: String(comment.postId ?? ""), commentId });
  }
}

export async function getPostById(postId: string) {
  if (!db) return null;
  const snapshot = await getDoc(doc(db, "posts", postId));
  return snapshot.exists() ? mapPost(snapshot.id, snapshot.data() as Record<string, unknown>) : null;
}

export async function editPostComment(commentId: string, text: string) { if (!auth.currentUser || !db || !text.trim()) return; await updateDoc(doc(db, "comments", commentId), { text: text.trim().slice(0, 500), editedAt: serverTimestamp() }); }
export async function deletePostComment(commentId: string, postId: string) { if (!auth.currentUser || !db) return; await deleteDoc(doc(db, "comments", commentId)); await updateDoc(doc(db, "posts", postId), { commentsCount: increment(-1) }); }
export async function togglePinnedComment(commentId: string, pinned: boolean) { if (!auth.currentUser || !db) return; await updateDoc(doc(db, "comments", commentId), { pinned: !pinned }); }

export async function quotePost(postId: string, caption: string) {
  if (!auth?.currentUser || !db) throw new Error("You must be signed in to quote a post.");
  const snapshot = await getDoc(doc(db, "posts", postId));
  if (!snapshot.exists()) throw new Error("Post not found.");
  const original = mapPost(snapshot.id, snapshot.data() as Record<string, unknown>);
  const { author } = await getCurrentAuthorProfile();
  await addDoc(collection(db, "posts"), { userId: auth.currentUser.uid, caption: caption.trim(), mediaUrl: original.mediaUrl, mediaType: original.mediaType, contentType: "post", postType: "standard", sport: "", likes: [], commentsCount: 0, shares: 0, saves: [], hashtags: extractHashtags(caption), views: 0, completedViews: 0, author, originalPostId: postId, createdAt: serverTimestamp() });
  await updateDoc(doc(db, "posts", postId), { shares: increment(1) });
  await incrementUserCounter(auth.currentUser.uid, "postsCount", 1);
  await createNotification({ type: "repost", recipientId: original.userId, actorId: auth.currentUser.uid, actorName: author.name, actorAvatar: author.avatar, message: `${author.name} quoted your post.`, postId });
}

export async function recordPostShare(postId: string) {
  if (!db) return;
  await updateDoc(doc(db, "posts", postId), { shares: increment(1) });
}

function scorePosts(posts: FeedPost[], following: string[], _legacyPreference: string) {
  const now = Date.now() / 1000;
  const scored = [...posts].sort((a, b) => {
    const score = (post: FeedPost) => {
      const ageHours = Math.max(0, (now - (post.createdAt?.seconds ?? now)) / 3600);
      const recency = Math.max(0, 5 - ageHours / 12);
      const engagement = Math.log2(1 + post.likes.length + post.commentsCount * 2 + post.shares * 3 + post.saves.length * 2);
      const completionRate = (post.completedViews ?? 0) / Math.max(1, post.views ?? 0);
      return recency + engagement + completionRate * 5 + (following.includes(post.userId) ? 3 : 0);
    };
    return score(b) - score(a);
  });
  for (let index = 1; index < scored.length - 1; index += 1) {
    if (scored[index].userId === scored[index - 1].userId) {
      const alternative = scored.findIndex((post, candidate) => candidate > index && post.userId !== scored[index - 1].userId);
      if (alternative > index) [scored[index], scored[alternative]] = [scored[alternative], scored[index]];
    }
  }
  return scored;
}

function isVisiblePost(post: FeedPost) {
  const scheduledSeconds = post.scheduledFor?.seconds ?? 0;
  return !scheduledSeconds || scheduledSeconds <= Math.floor(Date.now() / 1000);
}

function canAccessPost(
  post: FeedPost,
  viewerProfile: {
    profile?: Record<string, unknown> | null;
  } | null
) {
  if (post.visibility === "public") {
    return true;
  }

  const subscribedCreators = Array.isArray(viewerProfile?.profile?.subscribedCreators)
    ? (viewerProfile?.profile?.subscribedCreators as string[])
    : [];
  if (post.visibility === "subscribers") {
    return subscribedCreators.includes(post.userId) || auth?.currentUser?.uid === post.userId;
  }

  const premiumGroupIds = Array.isArray(viewerProfile?.profile?.premiumGroupIds)
    ? (viewerProfile?.profile?.premiumGroupIds as string[])
    : [];
  return premiumGroupIds.includes(post.premiumGroupId || "") || auth?.currentUser?.uid === post.userId;
}

function matchesFeedPreferences(post: FeedPost, profile?: Record<string, unknown> | null) {
  const preferences = (profile?.feedPreferences as Record<string, unknown> | undefined) ?? {};
  const mutedUsers = Array.isArray(preferences.mutedUserIds) ? preferences.mutedUserIds as string[] : [];
  const mutedWords = Array.isArray(preferences.mutedWords) ? preferences.mutedWords as string[] : [];
  const mutedTopics = Array.isArray(preferences.mutedTopics) ? preferences.mutedTopics as string[] : [];
  const snoozed = (preferences.snoozedUsers as Record<string, number> | undefined) ?? {};
  const text = post.caption.toLowerCase();
  if (mutedUsers.some((value) => value === post.userId || value === post.author.username.replace(/^@/, "").toLowerCase())) return false;
  if ((snoozed[post.userId] ?? 0) > Date.now()) return false;
  if (mutedWords.some((word) => word && text.includes(word.toLowerCase()))) return false;
  if (post.hashtags.some((tag) => mutedTopics.includes(tag.toLowerCase()))) return false;
  if (preferences.contentFilter === "media" && !post.mediaUrl && !post.mediaItems?.length) return false;
  if (preferences.contentFilter === "text" && (post.mediaUrl || post.mediaItems?.length)) return false;
  if (preferences.sensitiveContent === "hide" && post.sensitive) return false;
  return true;
}

export function subscribeToFeed(
  callback: (posts: FeedPost[]) => void,
  onError?: (error: Error) => void
): ListenerCleanup {
  if (!db) {
    callback([]);
    return () => undefined;
  }

  const feedQuery = query(
    collection(db, "posts"),
    where("contentType", "==", "post"),
    orderBy("createdAt", "desc"),
    limit(60)
  );

  let stopped = false;

  const unsubscribe = onSnapshot(
    feedQuery,
    async (snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => {
      try {
        const rawPosts = snapshot.docs.map((postDoc) => mapPost(postDoc.id, postDoc.data()));
        const profile = await getCachedViewerProfile();
        const preferredSport = profile?.defaultSport ?? "";
        const following = profile?.following ?? [];
        const blockedUsers = profile?.blockedUsers ?? [];

        if (!stopped) {
          callback(
            scorePosts(
              rawPosts.filter(
                (post) =>
                  post.contentType === "post" &&
                  !blockedUsers.includes(post.userId) &&
                  isVisiblePost(post) &&
                  matchesFeedPreferences(post, profile?.profile) &&
                  canAccessPost(post, profile)
              ),
              following,
              preferredSport
            )
          );
        }
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error("Could not load the feed."));
      }
    },
    (error: Error) => {
      onError?.(error);
    }
  );

  return () => {
    stopped = true;
    unsubscribe();
  };
}

export function subscribeToReels(
  callback: (posts: FeedPost[]) => void,
  onError?: (error: Error) => void
): ListenerCleanup {
  if (!db) {
    callback([]);
    return () => undefined;
  }

  const reelsQuery = query(
    collection(db, "posts"),
    where("contentType", "==", "reel"),
    orderBy("createdAt", "desc"),
    limit(24)
  );

  let stopped = false;

  const unsubscribe = onSnapshot(
    reelsQuery,
    async (snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => {
      try {
        const rawPosts = snapshot.docs
          .map((postDoc) => mapPost(postDoc.id, postDoc.data()));
        const profile = await getCachedViewerProfile();
        const preferredSport = profile?.defaultSport ?? "";
        const following = profile?.following ?? [];
        const blockedUsers = profile?.blockedUsers ?? [];

        if (!stopped) {
          callback(
            scorePosts(
              rawPosts.filter((post) => !blockedUsers.includes(post.userId) && isVisiblePost(post) && canAccessPost(post, profile)),
              following,
              preferredSport
            )
          );
        }
      } catch (error) {
        if (!stopped) {
          onError?.(error instanceof Error ? error : new Error("Could not load reels."));
          callback([]);
        }
      }
    },
    (error: Error) => {
      onError?.(error);
    }
  );

  return () => {
    stopped = true;
    unsubscribe();
  };
}

export function subscribeToUserPosts(
  userId: string,
  callback: (posts: FeedPost[]) => void
): ListenerCleanup {
  if (!db) {
    callback([]);
    return () => undefined;
  }

  const postsQuery = query(
    collection(db, "posts"),
    where("userId", "==", userId)
  );

  let stopped = false;

  const unsubscribe = onSnapshot(
    postsQuery,
    async (snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => {
      const profile = await getCachedViewerProfile();
      const blockedUsers = profile?.blockedUsers ?? [];
      const filteredPosts = snapshot.docs
        .map((postDoc) => mapPost(postDoc.id, postDoc.data()))
        .filter((post) => !blockedUsers.includes(post.userId))
        .filter(isVisiblePost)
        .filter((post) => canAccessPost(post, profile))
        .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));

      if (!stopped) {
        callback(filteredPosts);
      }
    }
  );

  return () => {
    stopped = true;
    unsubscribe();
  };
}

export function subscribeToTopicPosts(
  hashtag: string,
  callback: (posts: FeedPost[]) => void
): ListenerCleanup {
  if (!db) {
    callback([]);
    return () => undefined;
  }

  const postsQuery = query(
    collection(db, "posts"),
    where("hashtags", "array-contains", hashtag.toLowerCase()),
    orderBy("createdAt", "desc"),
    limit(25)
  );

  let stopped = false;

  const unsubscribe = onSnapshot(
    postsQuery,
    async (snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => {
      const profile = await getCachedViewerProfile();
      const blockedUsers = profile?.blockedUsers ?? [];
      const filteredPosts = snapshot.docs
        .map((postDoc) => mapPost(postDoc.id, postDoc.data()))
        .filter((post) => !blockedUsers.includes(post.userId))
        .filter(isVisiblePost)
        .filter((post) => canAccessPost(post, profile));

      if (!stopped) {
        callback(filteredPosts);
      }
    }
  );

  return () => {
    stopped = true;
    unsubscribe();
  };
}

export async function searchPosts(searchTerm: string) {
  if (!db) {
    return [];
  }

  const snapshot = await getDocs(query(collection(db, "posts"), limit(50)));
  const normalized = searchTerm.trim().toLowerCase();
  const profile = await getCachedViewerProfile();
  const blockedUsers = profile?.blockedUsers ?? [];

  return snapshot.docs
    .map((docSnapshot: { id: string; data: () => Record<string, unknown> }) =>
      mapPost(docSnapshot.id, docSnapshot.data() as Record<string, unknown>)
    )
    .filter((post: FeedPost) => !blockedUsers.includes(post.userId))
    .filter(isVisiblePost)
    .filter((post: FeedPost) => canAccessPost(post, profile))
    .filter((post: FeedPost) => {
      if (!normalized) {
        return true;
      }

      const haystack = [post.caption, post.sport, post.author.name, ...post.hashtags]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    });
}

export async function getPostsByIds(postIds: string[]) {
  if (!db || postIds.length === 0) {
    return [];
  }

  const database = db;
  const profile = await getCachedViewerProfile();
  const blockedUsers = profile?.blockedUsers ?? [];

  const snapshots = await Promise.all(
    postIds.map(async (postId) => {
      const snapshot = await getDoc(doc(database, "posts", postId));
      if (!snapshot.exists()) {
        return null;
      }

      return mapPost(snapshot.id, snapshot.data() as Record<string, unknown>);
    })
  );

  const order = new Map(postIds.map((id, index) => [id, index]));

  return snapshots
    .filter((post): post is FeedPost => Boolean(post))
    .filter((post) => !blockedUsers.includes(post.userId))
    .filter(isVisiblePost)
    .filter((post) => canAccessPost(post, profile))
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

export function subscribeToComments(
  postId: string,
  callback: (comments: PostComment[]) => void
): ListenerCleanup {
  if (!db) {
    callback([]);
    return () => undefined;
  }

  const commentsQuery = query(
    collection(db, "comments"),
    where("postId", "==", postId),
    orderBy("createdAt", "desc"),
    limit(10)
  );

  return onSnapshot(
    commentsQuery,
    (snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => {
      callback(snapshot.docs.map((commentDoc) => mapComment(commentDoc.id, commentDoc.data())));
    }
  );
}

export function formatTimeAgo(createdAt?: { seconds?: number } | null) {
  if (!createdAt?.seconds) {
    return "Just now";
  }

  const diffMs = Date.now() - createdAt.seconds * 1000;
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));

  if (diffMinutes < 60) {
    return `${diffMinutes}m`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays}d`;
  }

  const diffWeeks = Math.floor(diffDays / 7);
  return `${diffWeeks}w`;
}
