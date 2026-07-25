"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, ChevronDown, ChevronUp, Heart, MessageCircle, Save, Send, Share2, Volume2, VolumeX } from "lucide-react";

import { AuthProvider, useAuthContext } from "@/components/AuthProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import {
  PostComment,
  addPostComment,
  FeedPost,
  recordPostView,
  repostPost,
  subscribeToComments,
  subscribeToReels,
  togglePostLike,
  toggleSavePost,
} from "@/lib/posts";

function ReelsPageContent() {
  const { user } = useAuthContext();
  const searchParams = useSearchParams();
  const [reels, setReels] = useState<FeedPost[]>([]);
  const [currentReel, setCurrentReel] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [comments, setComments] = useState<PostComment[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [commenting, setCommenting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  const [muted, setMuted] = useState(true);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToReels(
      (nextReels) => {
        setReels(nextReels);
        setError("");
        setLoading(false);
      },
      (nextError) => {
        setError(nextError.message || "Could not load reels.");
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    const reel = reels[currentReel];
    if (!reel) {
      setComments([]);
      setCommentsOpen(false);
      return;
    }

    void recordPostView(reel.id);

    return subscribeToComments(reel.id, setComments);
  }, [currentReel, reels]);

  useEffect(() => {
    const reelId = searchParams.get("reel");
    if (!reelId || reels.length === 0) {
      return;
    }

    const index = reels.findIndex((item) => item.id === reelId);
    if (index >= 0) {
      setCurrentReel(index);
    }
  }, [reels, searchParams]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    video.muted = muted;
    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => undefined);
    }
  }, [currentReel, muted, reels]);

  useEffect(() => {
    if (!shareMessage) {
      return;
    }

    const timeout = window.setTimeout(() => setShareMessage(""), 1800);
    return () => window.clearTimeout(timeout);
  }, [shareMessage]);

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="flex min-h-[70vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      </ProtectedRoute>
    );
  }

  if (error) {
    return (
      <ProtectedRoute>
        <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 p-8 text-center">
          <h2 className="text-2xl font-bold">Reels could not load</h2>
          <p className="max-w-md text-muted-foreground">
            {error.includes("index")
              ? "Firebase needs a reels index before uploaded videos can appear here. Create the index from the Firebase link, then refresh."
              : error}
          </p>
          <Button asChild>
            <Link href="/upload">Upload again</Link>
          </Button>
        </div>
      </ProtectedRoute>
    );
  }

  if (reels.length === 0) {
    return (
      <ProtectedRoute>
        <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 p-8">
          <h2 className="text-2xl font-bold">No reels yet</h2>
          <p className="text-muted-foreground">Upload your first reel to kick off the vertical feed.</p>
          <Button asChild>
            <Link href="/upload">Create reel</Link>
          </Button>
        </div>
      </ProtectedRoute>
    );
  }

  const reel = reels[currentReel];

  const updateCurrentReel = (updater: (current: FeedPost) => FeedPost) => {
    setReels((current) =>
      current.map((item, index) => (index === currentReel ? updater(item) : item))
    );
  };

  const handleLike = async () => {
    const hasLiked = reel.likes.includes(user.uid);
    updateCurrentReel((current) => ({
      ...current,
      likes: hasLiked
        ? current.likes.filter((id) => id !== user.uid)
        : [...current.likes, user.uid],
    }));

    try {
      await togglePostLike(reel.id, hasLiked);
    } catch {
      updateCurrentReel((current) => ({
        ...current,
        likes: hasLiked
          ? [...current.likes, user.uid]
          : current.likes.filter((id) => id !== user.uid),
      }));
    }
  };

  const handleSave = async () => {
    const isSaved = reel.saves.includes(user.uid);
    updateCurrentReel((current) => ({
      ...current,
      saves: isSaved
        ? current.saves.filter((id) => id !== user.uid)
        : [...current.saves, user.uid],
    }));

    try {
      await toggleSavePost(reel.id, isSaved);
    } catch {
      updateCurrentReel((current) => ({
        ...current,
        saves: isSaved
          ? [...current.saves, user.uid]
          : current.saves.filter((id) => id !== user.uid),
      }));
    }
  };

  const handleShare = async () => {
    if (typeof window === "undefined") {
      return;
    }

    const shareUrl = `${window.location.origin}/reels?reel=${reel.id}`;
    const canNativeShare = typeof navigator.share === "function";
    setSharing(true);

    try {
      if (canNativeShare) {
        await navigator.share({
          title: "Kinet Reel",
          text: reel.caption || "Check out this reel on Kinet",
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
      }

      await repostPost(reel.id);
      updateCurrentReel((current) => ({ ...current, shares: current.shares + 1 }));
      setShareMessage(canNativeShare ? "Shared" : "Link copied");
    } catch {
      setShareMessage("Share cancelled");
    } finally {
      setSharing(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="mx-auto max-w-sm space-y-4 bg-black p-4 text-white">
        <div className="relative flex h-[80vh] flex-col justify-between overflow-hidden rounded-3xl">
          <video
            ref={videoRef}
            src={reel.mediaUrl}
            className="absolute inset-0 h-full w-full object-cover"
            controlsList={reel.downloadProtected ? "nodownload" : undefined}
            aria-label={reel.accessibilityLabel || reel.caption || "Reel video"}
            autoPlay
            muted={muted}
            loop
            playsInline
            preload="metadata"
            onContextMenu={reel.rightClickProtected ? (event) => event.preventDefault() : undefined}
            onClick={() => {
              const video = videoRef.current;
              if (!video) {
                return;
              }

              if (video.paused) {
                void video.play();
              } else {
                video.pause();
              }
            }}
            onLoadedMetadata={(event) => {
              if (typeof reel.clipStartSec === "number") {
                event.currentTarget.currentTime = reel.clipStartSec;
              }
            }}
            onTimeUpdate={(event) => {
              if (typeof reel.clipEndSec === "number" && event.currentTarget.currentTime >= reel.clipEndSec) {
                event.currentTarget.pause();
              }
            }}
            onEnded={() => void recordPostView(reel.id, true)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
          {reel.watermarkEnabled ? (
            <div className="pointer-events-none absolute bottom-4 right-4 z-10 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white">
              {reel.author.username}
            </div>
          ) : null}
          {shareMessage ? (
            <div className="absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white">
              {shareMessage}
            </div>
          ) : null}

          <div className="relative z-10 flex justify-between p-4">
            <Button variant="ghost" size="icon" className="rounded-full bg-white/10 text-white hover:bg-white/20" onClick={() => setCurrentReel((current) => (current - 1 + reels.length) % reels.length)}>
              <ChevronUp className="h-5 w-5" />
            </Button>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full bg-white/10 text-white hover:bg-white/20"
                onClick={() => setMuted((current) => !current)}
              >
                {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </Button>
              <Button variant="ghost" size="icon" className="rounded-full bg-white/10 text-white hover:bg-white/20" onClick={() => setCurrentReel((current) => (current + 1) % reels.length)}>
                <ChevronDown className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <div className="relative z-10 flex items-end justify-between p-4">
            <div className="max-w-[75%]">
              <p className="text-lg font-bold">{reel.author.name}</p>
              {reel.sponsored ? <p className="mt-1 text-xs font-semibold uppercase text-amber-300">{reel.sponsorLabel || "Sponsored"}</p> : null}
              <p className="mt-2 text-sm text-white/80">{reel.caption}</p>
              {reel.autoCaption ? <p className="mt-2 text-xs text-white/70">{reel.autoCaption}</p> : null}
              {reel.translatedCaption ? <p className="mt-2 text-xs text-white/70">{reel.translatedCaption}</p> : null}
              {reel.aiHighlightAnalysis ? <p className="mt-2 text-xs text-white/70">{reel.aiHighlightAnalysis}</p> : null}
              {reel.voiceoverScript ? <p className="mt-2 text-xs text-white/70">{reel.voiceoverScript}</p> : null}
              {reel.thumbnailHint ? <p className="mt-2 text-xs text-white/70">Thumbnail: {reel.thumbnailHint}</p> : null}
              {reel.accessibilityLabel ? <p className="mt-2 text-xs text-white/70">Accessibility: {reel.accessibilityLabel}</p> : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {reel.hashtags.map((tag) => (
                  <Link key={tag} href={`/topics/${tag}`} className="text-xs text-white/80 underline">
                    #{tag}
                  </Link>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col items-center gap-1">
                <Button variant="ghost" size="icon" className="rounded-full bg-white/10 text-white hover:bg-white/20" onClick={() => void handleLike()}>
                  <Heart className={`h-5 w-5 ${reel.likes.includes(user.uid) ? "fill-current text-red-400" : ""}`} />
                </Button>
                <span className="text-xs text-white/80">{reel.likes.length}</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full bg-white/10 text-white hover:bg-white/20"
                  onClick={() => setCommentsOpen(true)}
                >
                  <MessageCircle className="h-5 w-5" />
                </Button>
                <span className="text-xs text-white/80">{comments.length}</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Button variant="ghost" size="icon" className="rounded-full bg-white/10 text-white hover:bg-white/20" onClick={() => void handleSave()}>
                  <Save className={`h-5 w-5 ${reel.saves.includes(user.uid) ? "fill-current text-emerald-300" : ""}`} />
                </Button>
                <span className="text-xs text-white/80">{reel.saves.length}</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Button variant="ghost" size="icon" className="rounded-full bg-white/10 text-white hover:bg-white/20" disabled={sharing} onClick={() => void handleShare()}>
                  <Share2 className="h-5 w-5" />
                </Button>
                <span className="text-xs text-white/80">{reel.shares}</span>
              </div>
              <Button variant="ghost" size="icon" className="rounded-full bg-white/10 text-white hover:bg-white/20" asChild>
                <Link href={`/upload?remix=${reel.id}`}>
                  <span className="text-xs font-semibold">RMX</span>
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
      {commentsOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm"
          onClick={() => setCommentsOpen(false)}
        >
          <div
            className="max-h-[78vh] w-full rounded-t-[28px] bg-background text-foreground shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mt-3 h-1.5 w-14 rounded-full bg-muted-foreground/30" />
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h2 className="font-semibold">Comments</h2>
                <p className="text-sm text-muted-foreground">{comments.length} total</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setCommentsOpen(false)}>
                Close
              </Button>
            </div>

            <div className="max-h-[52vh] space-y-3 overflow-y-auto px-5 py-4">
              {comments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No comments yet. Start the conversation.</p>
              ) : (
                comments
                  .filter((comment) => !comment.parentCommentId)
                  .map((comment) => (
                    <div key={comment.id} className="rounded-2xl bg-muted/60 p-3">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-semibold">{comment.author.name}</span>
                        <span className="text-muted-foreground">{comment.author.username}</span>
                      </div>
                      <p className="mt-1 text-sm">{comment.text}</p>
                    </div>
                  ))
              )}
            </div>

            <div className="border-t px-5 py-4">
              <div className="flex items-center gap-2 rounded-full border bg-background px-3 py-2">
                <input
                  value={commentDraft}
                  onChange={(event) => setCommentDraft(event.target.value)}
                  placeholder="Add a comment..."
                  className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
                <Button
                  size="icon"
                  className="rounded-full"
                  disabled={commenting || !commentDraft.trim()}
                  onClick={async () => {
                    if (!commentDraft.trim()) {
                      return;
                    }

                    setCommenting(true);
                    try {
                      await addPostComment(reel.id, commentDraft);
                      setCommentDraft("");
                      updateCurrentReel((current) => ({
                        ...current,
                        commentsCount: current.commentsCount + 1,
                      }));
                    } finally {
                      setCommenting(false);
                    }
                  }}
                >
                  {commenting ? <Check className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </ProtectedRoute>
  );
}

export default function ReelsPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[70vh] items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" /></div>}>
      <AuthProvider>
        <ReelsPageContent />
      </AuthProvider>
    </Suspense>
  );
}
