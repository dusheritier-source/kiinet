"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BarChart3, Check, ChevronDown, ChevronUp, Eye, EyeOff, Flag, Heart, Loader2, MapPin, MessageCircle, MoreHorizontal, Music2, Play, Save, Send, Share2, ShieldAlert, UserX, Volume2, VolumeX } from "lucide-react";

import { AuthProvider, useAuthContext } from "@/components/AuthProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import OptimizedMedia from "@/components/OptimizedMedia";
import KinetVerifiedBadge from "@/components/KinetVerifiedBadge";
import {
  PostComment,
  addPostComment,
  FeedPost,
  recordPostView,
  repostPost,
  subscribeToComments,
  subscribeToReels,
  toggleCommentReaction,
  togglePinnedComment,
  togglePostLike,
  toggleSavePost,
} from "@/lib/posts";
import { getCurrentUserProfile, toggleFollowUser } from "@/lib/user-profile";
import { getBlockedUsers, reportEntity, toggleBlockedUser } from "@/lib/moderation";

function ReelsPageContent() {
  const { user } = useAuthContext();
  const searchParams = useSearchParams();
  const [allReels, setReels] = useState<FeedPost[]>([]);
  const [feedMode, setFeedMode] = useState<"for_you" | "following" | "latest">("for_you");
  const [hiddenReelIds, setHiddenReelIds] = useState<string[]>([]);
  const [blockedCreatorIds, setBlockedCreatorIds] = useState<string[]>([]);
  const [revealedSensitiveIds, setRevealedSensitiveIds] = useState<string[]>([]);
  const [moreOpen, setMoreOpen] = useState(false);
  const [actionStatus, setActionStatus] = useState("");
  const [currentReel, setCurrentReel] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [comments, setComments] = useState<PostComment[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [commenting, setCommenting] = useState(false);
  const [replyTo, setReplyTo] = useState<PostComment | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [likeBurst, setLikeBurst] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const touchStartY = useRef<number | null>(null);
  const wheelLocked = useRef(false);
  const playbackPositions = useRef(new Map<string, number>());
  const reels = useMemo(() => {
    const visible = allReels.filter((item) => !hiddenReelIds.includes(item.id) && !blockedCreatorIds.includes(item.userId));
    if (feedMode === "following") return visible.filter((item) => followingIds.includes(item.userId) || item.userId === user?.uid);
    if (feedMode === "latest") return [...visible].sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
    return visible;
  }, [allReels, blockedCreatorIds, feedMode, followingIds, hiddenReelIds, user?.uid]);

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
    setHiddenReelIds(JSON.parse(localStorage.getItem("kinet:hidden-reels") || "[]") as string[]);
    void getBlockedUsers().then(setBlockedCreatorIds);
  }, []);

  useEffect(() => { setCurrentReel(0); }, [feedMode]);

  useEffect(() => {
    setMoreOpen(false);
  }, [currentReel]);

  useEffect(() => {
    if (!actionStatus) return;
    const timeout = window.setTimeout(() => setActionStatus(""), 2200);
    return () => window.clearTimeout(timeout);
  }, [actionStatus]);

  useEffect(() => {
    if (user) void getCurrentUserProfile().then((profile) => setFollowingIds(Array.isArray(profile?.following) ? profile.following as string[] : []));
  }, [user]);

  useEffect(() => {
    const reel = reels[currentReel];
    if (!reel) {
      setComments([]);
      setCommentsOpen(false);
      return;
    }

    void recordPostView(reel.id);
    setCaptionExpanded(false);
    setReplyTo(null);

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
    const active = reels[currentReel];
    if (!video || !active) {
      return;
    }

    video.muted = muted;
    video.volume = active.originalVolume ?? 1;
    video.playbackRate = active.playbackRate ?? 1;
    if (audioRef.current) { audioRef.current.muted = muted; audioRef.current.volume = active.musicVolume ?? 0.7; audioRef.current.playbackRate = active.playbackRate ?? 1; audioRef.current.currentTime = 0; void audioRef.current.play().catch(() => undefined); }
    setBuffering(true);
    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => undefined);
    }
    setPaused(false);
  }, [currentReel, muted, reels]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!reels.length || commentsOpen) return;
      if (event.key === "ArrowDown") setCurrentReel((current) => (current + 1) % reels.length);
      if (event.key === "ArrowUp") setCurrentReel((current) => (current - 1 + reels.length) % reels.length);
      if (event.key === " ") { event.preventDefault(); const video = videoRef.current; if (!video) return; if (video.paused) void video.play(); else video.pause(); }
      if (event.key.toLowerCase() === "m") setMuted((value) => !value);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [commentsOpen, reels.length]);

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
          <h2 className="text-2xl font-bold">Upload your first reel</h2>
          <p className="max-w-md text-muted-foreground">
            Share a video with the Kinet community and start the reels feed.
          </p>
          <Button asChild>
            <Link href="/upload">Upload your first reel</Link>
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
      <div className="mx-auto min-h-dvh max-w-md space-y-3 bg-black p-3 text-white sm:rounded-[32px]">
        <div className="flex items-center justify-between gap-2 px-1 py-1">
          <div>
            <p className="text-base font-bold">Reels</p>
            <p className="text-xs text-white/65">Short videos, made to discover</p>
          </div>
          <Link href="/upload?type=reel" className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-black">Create</Link>
        </div>
        <div className="flex gap-1 rounded-full bg-white/10 p-1">{([{ id: "for_you", label: "For You" }, { id: "following", label: "Following" }, { id: "latest", label: "Latest" }] as const).map((tab) => <button key={tab.id} type="button" onClick={() => setFeedMode(tab.id)} className={`flex-1 rounded-full px-2 py-1.5 text-xs font-semibold ${feedMode === tab.id ? "bg-white text-black" : "text-white/70"}`}>{tab.label}</button>)}</div>
        <div className="relative flex h-[calc(100dvh-76px)] min-h-[560px] flex-col justify-between overflow-hidden rounded-3xl" onTouchStart={(event) => { touchStartY.current = event.touches[0]?.clientY ?? null; }} onTouchEnd={(event) => { if (touchStartY.current === null) return; const distance = (event.changedTouches[0]?.clientY ?? touchStartY.current) - touchStartY.current; if (distance < -55) setCurrentReel((current) => (current + 1) % reels.length); if (distance > 55) setCurrentReel((current) => (current - 1 + reels.length) % reels.length); touchStartY.current = null; }} onWheel={(event) => { if (wheelLocked.current || Math.abs(event.deltaY) < 20) return; wheelLocked.current = true; setCurrentReel((current) => event.deltaY > 0 ? (current + 1) % reels.length : (current - 1 + reels.length) % reels.length); window.setTimeout(() => { wheelLocked.current = false; }, 450); }}>
          <video
            ref={videoRef}
            src={reel.mediaUrl}
            poster={reel.thumbnailUrl || undefined}
            className="absolute inset-0 h-full w-full object-cover"
            style={{ filter: reel.visualFilter === "warm" ? "sepia(.25) saturate(1.25)" : reel.visualFilter === "cool" ? "hue-rotate(175deg) saturate(1.1)" : reel.visualFilter === "mono" ? "grayscale(1)" : reel.visualFilter === "vivid" ? "saturate(1.7) contrast(1.1)" : "none", transform: `rotate(${reel.rotation ?? 0}deg)` }}
            controlsList={reel.downloadProtected ? "nodownload" : undefined}
            aria-label={reel.accessibilityLabel || reel.caption || "Reel video"}
            autoPlay
            muted={muted}
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
            onDoubleClick={() => { if (!reel.likes.includes(user.uid)) void handleLike(); setLikeBurst(true); window.setTimeout(() => setLikeBurst(false), 700); }}
            onPlay={() => { setPaused(false); setBuffering(false); if (audioRef.current) void audioRef.current.play().catch(() => undefined); }}
            onPause={() => { setPaused(true); audioRef.current?.pause(); }}
            onWaiting={() => setBuffering(true)}
            onCanPlay={() => setBuffering(false)}
            onLoadedMetadata={(event) => {
              if (typeof reel.clipStartSec === "number") {
                event.currentTarget.currentTime = reel.clipStartSec;
              } else { event.currentTarget.currentTime = playbackPositions.current.get(reel.id) ?? 0; }
            }}
            onTimeUpdate={(event) => {
              playbackPositions.current.set(reel.id, event.currentTarget.currentTime);
              if (audioRef.current && Math.abs(audioRef.current.currentTime - Math.max(0, event.currentTarget.currentTime - (reel.clipStartSec ?? 0))) > 0.35) audioRef.current.currentTime = Math.max(0, event.currentTarget.currentTime - (reel.clipStartSec ?? 0));
              if (typeof reel.clipEndSec === "number" && event.currentTarget.currentTime >= reel.clipEndSec) {
                event.currentTarget.pause();
              }
            }}
            onEnded={() => void recordPostView(reel.id, true)}
          />
          {reel.musicUrl ? <audio ref={audioRef} src={reel.musicUrl} preload="auto" loop /> : null}
          {reels[currentReel + 1] ? <video src={reels[currentReel + 1].mediaUrl} preload="metadata" muted className="hidden" aria-hidden="true" /> : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
          {buffering ? <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-white" /></div> : null}
          {paused && !buffering ? <button type="button" aria-label="Resume reel" onClick={() => void videoRef.current?.play()} className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/60 p-4 text-white"><Play className="h-8 w-8 fill-current" /></button> : null}
          {likeBurst ? <div className="pointer-events-none absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2 animate-ping"><Heart className="h-24 w-24 fill-white text-white drop-shadow-2xl" /></div> : null}
          {reel.overlayText || reel.sticker ? <div className={`pointer-events-none absolute inset-x-6 z-10 text-center text-white drop-shadow-xl ${reel.overlayPosition === "top" ? "top-24" : reel.overlayPosition === "center" ? "top-1/2 -translate-y-1/2" : "bottom-36"}`}><span className="rounded-xl bg-black/30 px-3 py-1 text-xl font-bold">{reel.sticker ? `${reel.sticker} ` : ""}{reel.overlayText}</span></div> : null}
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
          {actionStatus ? <div role="status" className="absolute left-1/2 top-14 z-40 -translate-x-1/2 rounded-full bg-black/80 px-4 py-2 text-xs font-semibold text-white">{actionStatus}</div> : null}
          {reel.sensitive && !revealedSensitiveIds.includes(reel.id) ? <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-black/95 px-8 text-center"><ShieldAlert className="h-10 w-10" /><div><p className="font-bold">Sensitive content</p><p className="mt-1 text-sm text-white/70">{reel.contentWarning || "This reel may contain sensitive material."}</p></div><Button type="button" variant="secondary" onClick={() => setRevealedSensitiveIds((ids) => [...ids, reel.id])}><Eye className="mr-2 h-4 w-4" />View reel</Button><button type="button" className="text-xs text-white/70 underline" onClick={() => { const next = [...hiddenReelIds, reel.id]; setHiddenReelIds(next); localStorage.setItem("kinet:hidden-reels", JSON.stringify(next)); }}>Skip this reel</button></div> : null}
          <button type="button" onClick={() => { const next = [...hiddenReelIds, reel.id]; setHiddenReelIds(next); localStorage.setItem("kinet:hidden-reels", JSON.stringify(next)); setCurrentReel((current) => Math.min(current, Math.max(0, reels.length - 2))); }} className="absolute left-4 top-16 z-20 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white">Not interested</button>
          <div className="absolute right-4 top-16 z-20"><button type="button" aria-label="More reel actions" onClick={() => setMoreOpen((value) => !value)} className="rounded-full bg-black/60 p-2"><MoreHorizontal className="h-5 w-5" /></button>{moreOpen ? <div className="mt-2 w-48 overflow-hidden rounded-2xl bg-black/90 p-1 text-sm shadow-xl">{reel.userId === user.uid ? <Link href={`/analytics/${reel.id}`} className="flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-white/10"><BarChart3 className="h-4 w-4" />View insights</Link> : <><button type="button" className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-white/10" onClick={() => void reportEntity({ targetId: reel.id, targetType: "post", reason: "unsafe_reel", details: reel.caption.slice(0, 300) }).then(() => { setActionStatus("Report submitted"); setMoreOpen(false); }).catch(() => setActionStatus("Could not submit report"))}><Flag className="h-4 w-4" />Report reel</button><button type="button" className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-red-300 hover:bg-white/10" onClick={() => void toggleBlockedUser(reel.userId, false).then(() => { setBlockedCreatorIds((ids) => [...ids, reel.userId]); setActionStatus("Creator blocked"); }).catch(() => setActionStatus("Could not block creator"))}><UserX className="h-4 w-4" />Block creator</button></>}<button type="button" className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-white/10" onClick={() => { const next = [...hiddenReelIds, reel.id]; setHiddenReelIds(next); localStorage.setItem("kinet:hidden-reels", JSON.stringify(next)); }}><EyeOff className="h-4 w-4" />Hide reel</button></div> : null}</div>

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
              <div className="flex items-center gap-2"><Link href={`/profile/${reel.userId}`} className="flex min-w-0 items-center gap-2"><OptimizedMedia src={reel.author.avatar || "https://placehold.co/40x40?text=K"} alt={`${reel.author.name} profile`} width={40} height={40} sizes="40px" className="h-10 w-10 rounded-full border border-white/40 object-cover" /><span className="min-w-0"><span className="flex items-center gap-1 truncate text-base font-bold">{reel.author.name}{reel.author.verified ? <KinetVerifiedBadge compact /> : null}</span><span className="block truncate text-xs text-white/65">{reel.author.username}</span></span></Link>{reel.userId !== user.uid ? <Button size="sm" variant={followingIds.includes(reel.userId) ? "secondary" : "default"} className="h-8 rounded-full px-3 text-xs" onClick={() => { const following = followingIds.includes(reel.userId); void toggleFollowUser(reel.userId, following).then((result) => { if (result !== "requested") setFollowingIds((ids) => following ? ids.filter((id) => id !== reel.userId) : [...ids, reel.userId]); }); }}>{followingIds.includes(reel.userId) ? "Following" : "Follow"}</Button> : null}</div>
              {reel.sponsored ? <p className="mt-1 text-xs font-semibold uppercase text-amber-300">{reel.sponsorLabel || "Sponsored"}</p> : null}
              {reel.author.location ? <p className="mt-2 flex items-center gap-1 text-xs text-white/70"><MapPin className="h-3.5 w-3.5" />{reel.author.location}</p> : null}
              <button type="button" onClick={() => setCaptionExpanded((value) => !value)} className={`mt-2 block w-full text-left text-sm text-white/85 ${captionExpanded ? "" : "line-clamp-2"}`}><RichReelCaption text={reel.caption} />{reel.caption.length > 90 ? <span className="ml-1 font-semibold text-white">{captionExpanded ? "less" : "more"}</span> : null}</button>
              <Link href={`/search?q=${encodeURIComponent(reel.musicTitle || reel.author.username.replace(/^@/, ""))}&type=videos`} className="mt-2 flex items-center gap-1 text-xs text-white/75"><Music2 className="h-3.5 w-3.5" />{reel.musicTitle || `Original audio · ${reel.author.username}`}</Link>
              {reel.musicUrl ? <Link href={`/upload?type=reel&sourceAudio=${reel.id}`} className="mt-1 inline-block text-xs font-semibold text-white">Use audio</Link> : null}
              {reel.collaborators?.length ? <p className="mt-2 text-xs text-white/70">With {reel.collaborators.map((person) => `@${person.username.replace(/^@/, "")}`).join(", ")}</p> : null}
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
              <div className="flex flex-col items-center gap-1"><Eye className="h-5 w-5" /><span className="text-xs text-white/80">{reel.views ?? 0}</span></div>
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
                  disabled={reel.commentsEnabled === false}
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
              {reel.allowRemix !== false ? <Button variant="ghost" size="icon" className="rounded-full bg-white/10 text-white hover:bg-white/20" asChild>
                <Link href={`/upload?remix=${reel.id}`}>
                  <span className="text-xs font-semibold">RMX</span>
                </Link>
              </Button> : null}
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
                    <div key={comment.id} className="space-y-2"><div className={`rounded-2xl p-3 ${comment.pinned ? "border border-primary/40 bg-primary/10" : "bg-muted/60"}`}><div className="flex items-center gap-2 text-sm"><span className="font-semibold">{comment.author.name}</span><span className="text-muted-foreground">{comment.author.username}</span>{comment.pinned ? <span className="ml-auto text-[10px] font-semibold text-primary">Pinned</span> : null}</div><p className="mt-1 text-sm">{comment.text}</p><div className="mt-2 flex gap-3 text-xs text-muted-foreground"><button type="button" onClick={() => { setReplyTo(comment); setCommentDraft(`@${comment.author.username.replace(/^@/, "")} `); }}>Reply</button><button type="button" onClick={() => void toggleCommentReaction(comment.id, "❤️")}> ❤️ {comment.reactions?.["❤️"]?.length ?? 0}</button>{reel.userId === user.uid ? <button type="button" onClick={() => void togglePinnedComment(comment.id, Boolean(comment.pinned))}>{comment.pinned ? "Unpin" : "Pin"}</button> : null}</div></div>{comments.filter((reply) => reply.parentCommentId === comment.id).map((reply) => <div key={reply.id} className="ml-8 rounded-2xl border bg-background p-3"><div className="flex items-center gap-2 text-xs"><span className="font-semibold">{reply.author.name}</span><span className="text-muted-foreground">{reply.author.username}</span></div><p className="mt-1 text-sm">{reply.text}</p><button type="button" onClick={() => void toggleCommentReaction(reply.id, "❤️")} className="mt-2 text-xs text-muted-foreground">❤️ {reply.reactions?.["❤️"]?.length ?? 0}</button></div>)}</div>
                  ))
              )}
            </div>

            <div className="border-t px-5 py-4">
              {replyTo ? <div className="mb-2 flex items-center justify-between rounded-xl bg-muted px-3 py-2 text-xs"><span>Replying to {replyTo.author.name}</span><button type="button" onClick={() => { setReplyTo(null); setCommentDraft(""); }}>Cancel</button></div> : null}
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
                      await addPostComment(reel.id, commentDraft, replyTo?.id);
                      setCommentDraft("");
                      setReplyTo(null);
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

function RichReelCaption({ text }: { text: string }) {
  return <>{text.split(/([#@][a-z0-9_]+)/gi).map((part, index) => {
    if (part.startsWith("#")) return <Link key={`${part}-${index}`} href={`/topics/${part.slice(1).toLowerCase()}`} onClick={(event) => event.stopPropagation()} className="font-semibold text-white">{part}</Link>;
    if (part.startsWith("@")) return <Link key={`${part}-${index}`} href={`/search?q=${encodeURIComponent(part)}&type=people`} onClick={(event) => event.stopPropagation()} className="font-semibold text-white">{part}</Link>;
    return <span key={index}>{part}</span>;
  })}</>;
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
