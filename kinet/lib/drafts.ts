import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

export interface UploadDraft {
  id: string;
  caption: string;
  sport?: string;
  contentType: "post" | "reel";
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
  aiHighlightAnalysis?: string;
  voiceoverScript?: string;
  thumbnailHint?: string;
  clipStartSec?: number;
  clipEndSec?: number;
  watermarkEnabled?: boolean;
  downloadProtected?: boolean;
  rightClickProtected?: boolean;
  previewType: "image" | "video" | "unknown";
  createdAt?: { seconds?: number; nanoseconds?: number } | null;
}

export async function saveUploadDraft(input: {
  caption: string;
  sport?: string;
  contentType: "post" | "reel";
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
  aiHighlightAnalysis?: string;
  voiceoverScript?: string;
  thumbnailHint?: string;
  clipStartSec?: number;
  clipEndSec?: number;
  watermarkEnabled?: boolean;
  downloadProtected?: boolean;
  rightClickProtected?: boolean;
  previewType?: "image" | "video" | "unknown";
}) {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in.");
  }

  await addDoc(collection(db, "drafts"), {
    userId: auth.currentUser.uid,
    caption: input.caption.trim(),
    sport: input.sport?.trim() || "",
    contentType: input.contentType,
    postType: input.postType ?? "standard",
    questionPrompt: input.questionPrompt?.trim() ?? "",
    pollOptions: input.pollOptions ?? [],
    collaborators: input.collaborators ?? [],
    remixPostId: input.remixPostId?.trim() ?? "",
    scheduledFor: input.scheduledFor?.trim() ?? "",
    visibility: input.visibility ?? "public",
    premiumGroupId: input.premiumGroupId?.trim() ?? "",
    sponsored: Boolean(input.sponsored),
    sponsorLabel: input.sponsorLabel?.trim() ?? "",
    autoCaption: input.autoCaption?.trim() ?? "",
    translatedCaption: input.translatedCaption?.trim() ?? "",
    accessibilityLabel: input.accessibilityLabel?.trim() ?? "",
    aiHighlightAnalysis: input.aiHighlightAnalysis?.trim() ?? "",
    voiceoverScript: input.voiceoverScript?.trim() ?? "",
    thumbnailHint: input.thumbnailHint?.trim() ?? "",
    clipStartSec: typeof input.clipStartSec === "number" ? input.clipStartSec : null,
    clipEndSec: typeof input.clipEndSec === "number" ? input.clipEndSec : null,
    watermarkEnabled: Boolean(input.watermarkEnabled),
    downloadProtected: Boolean(input.downloadProtected),
    rightClickProtected: Boolean(input.rightClickProtected),
    previewType: input.previewType ?? "unknown",
    createdAt: serverTimestamp(),
  });
}

export async function getUploadDrafts() {
  if (!auth?.currentUser || !db) {
    return [];
  }

  const snapshot = await getDocs(
    query(
      collection(db, "drafts"),
      where("userId", "==", auth.currentUser.uid),
      orderBy("createdAt", "desc"),
      limit(30)
    )
  );

  return snapshot.docs.map((docSnapshot: { id: string; data: () => Record<string, unknown> }) => {
    const data = docSnapshot.data() as Record<string, unknown>;
    return {
      id: docSnapshot.id,
      caption: String(data.caption ?? ""),
      sport: String(data.sport ?? ""),
      contentType: data.contentType === "reel" ? "reel" : "post",
      postType:
        data.postType === "poll" || data.postType === "qa" ? data.postType : "standard",
      questionPrompt: String(data.questionPrompt ?? ""),
      pollOptions: Array.isArray(data.pollOptions) ? (data.pollOptions as string[]) : [],
      collaborators: Array.isArray(data.collaborators) ? (data.collaborators as string[]) : [],
      remixPostId: String(data.remixPostId ?? ""),
      scheduledFor: String(data.scheduledFor ?? ""),
      visibility:
        data.visibility === "subscribers" || data.visibility === "premium_group"
          ? data.visibility
          : "public",
      premiumGroupId: String(data.premiumGroupId ?? ""),
      sponsored: Boolean(data.sponsored),
      sponsorLabel: String(data.sponsorLabel ?? ""),
      autoCaption: String(data.autoCaption ?? ""),
      translatedCaption: String(data.translatedCaption ?? ""),
      accessibilityLabel: String(data.accessibilityLabel ?? ""),
      aiHighlightAnalysis: String(data.aiHighlightAnalysis ?? ""),
      voiceoverScript: String(data.voiceoverScript ?? ""),
      thumbnailHint: String(data.thumbnailHint ?? ""),
      clipStartSec:
        typeof data.clipStartSec === "number" ? data.clipStartSec : undefined,
      clipEndSec: typeof data.clipEndSec === "number" ? data.clipEndSec : undefined,
      watermarkEnabled: Boolean(data.watermarkEnabled),
      downloadProtected: Boolean(data.downloadProtected),
      rightClickProtected: Boolean(data.rightClickProtected),
      previewType:
        data.previewType === "image" || data.previewType === "video"
          ? data.previewType
          : "unknown",
      createdAt:
        (data.createdAt as { seconds?: number; nanoseconds?: number } | null | undefined) ?? null,
    } satisfies UploadDraft;
  });
}

export async function deleteUploadDraft(draftId: string) {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in.");
  }

  await deleteDoc(doc(db, "drafts", draftId));
}
