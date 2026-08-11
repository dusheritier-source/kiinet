"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, Trash2, X } from "lucide-react";

import { useAuthContext } from "@/components/AuthProvider";
import { deleteStory, getActiveStories, markStorySeen, reactToStory, recordStoryReply, type StoryItem } from "@/lib/stories";
import { createOrGetConversation, sendConversationMessage } from "@/lib/messaging";
import { getProfilesByIds } from "@/lib/profile-social";
import type { SearchProfile } from "@/lib/user-profile";

const STORY_DURATION_MS = 5000;
const STORY_REACTIONS = ["❤️", "😂", "🔥", "👏", "😍", "😮", "😢", "💯"];

export default function StoriesOverlay() {
  const { user } = useAuthContext();
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [replySending, setReplySending] = useState(false);
  const [interactionStatus, setInteractionStatus] = useState("");
  const [reactingEmoji, setReactingEmoji] = useState("");
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false);
  const [safetyMenuOpen, setSafetyMenuOpen] = useState(false);
  const [revealedStoryIds, setRevealedStoryIds] = useState<string[]>([]);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [loading, setLoading] = useState(false);
  const [viewersOpen, setViewersOpen] = useState(false);
  const [viewerProfiles, setViewerProfiles] = useState<SearchProfile[]>([]);
  const [viewersLoading, setViewersLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    const handler = async (event: Event) => {
      const custom = event as CustomEvent<{ storyId?: string }>;
      const storyId = custom.detail?.storyId;
      if (!storyId) return;
      setLoading(true);
      try {
        const items = await getActiveStories();
        const muted = JSON.parse(localStorage.getItem("kinet:muted-story-creators") || "[]") as string[];
        const filtered = items.filter((story) => !muted.includes(story.userId));
        setStories(filtered);
        const foundIndex = filtered.findIndex((story) => story.id === storyId);
        if (foundIndex >= 0) {
          setActiveIndex(foundIndex);
          setPaused(false);
          setViewerOpen(true);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    window.addEventListener("open-stories", handler as EventListener);
    return () => window.removeEventListener("open-stories", handler as EventListener);
  }, []);

  useEffect(() => {
    if (!activeIndex || !stories[activeIndex]) return;
    const storyId = stories[activeIndex].id;
    void markStorySeen(storyId);
    if (user?.uid) {
      setStories((current) => current.map((story) => story.id === storyId ? { ...story, seenBy: Array.from(new Set([...(story.seenBy ?? []), user.uid])) } : story));
    }
    setProgress(0);
    setReplyText("");
    setInteractionStatus("");
    setReactionPickerOpen(false);
    setSafetyMenuOpen(false);
    setViewersOpen(false);
  }, [activeIndex, stories, user?.uid]);

  useEffect(() => {
    if (!viewerOpen || !stories[activeIndex] || paused || reducedMotion || stories[activeIndex].sensitiveContent && !revealedStoryIds.includes(stories[activeIndex].id) || stories[activeIndex].mediaType === "video") return;

    const startedAt = Date.now();
    const startingProgress = progress;
    const remainingDuration = STORY_DURATION_MS * (1 - startingProgress / 100);
    const interval = window.setInterval(() => {
      setProgress((current) => {
        const nextProgress = Math.min(startingProgress + ((Date.now() - startedAt) / remainingDuration) * (100 - startingProgress), 100);
        if (nextProgress >= 100) {
          if (activeIndex + 1 < stories.length) {
            setActiveIndex((index) => index + 1);
          } else {
            setViewerOpen(false);
          }
        }
        return nextProgress;
      });
    }, 100);

    return () => window.clearInterval(interval);
  }, [viewerOpen, activeIndex, paused, reducedMotion, stories, progress, revealedStoryIds]);

  useEffect(() => {
    if (!viewerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setViewerOpen(false);
      if (event.key === "ArrowLeft") setActiveIndex((index) => Math.max(0, index - 1));
      if (event.key === "ArrowRight") setActiveIndex((index) => Math.min(stories.length - 1, index + 1));
      if (event.key === " ") { event.preventDefault(); setPaused((value) => !value); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", onKeyDown); };
  }, [stories.length, viewerOpen]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stories[activeIndex] || stories[activeIndex].mediaType !== "video") return;
    if (paused || stories[activeIndex].sensitiveContent && !revealedStoryIds.includes(stories[activeIndex].id)) video.pause();
    else void video.play().catch(() => undefined);
  }, [activeIndex, stories, paused, revealedStoryIds, viewerOpen]);

  const activeStory = stories[activeIndex] ?? null;
  const activeStoryId = activeStory?.id;
  const activeStoryConcealed = Boolean(activeStory?.sensitiveContent && activeStoryId && !revealedStoryIds.includes(activeStoryId));
  const activeCreatorStories = useMemo(() => stories.filter((story) => story.userId === activeStory?.userId), [activeStory?.userId, stories]);
  const activeCreatorPosition = activeCreatorStories.findIndex((story) => story.id === activeStoryId);
  const groupedCount = useMemo(() => stories.filter((story) => story.userId === activeStory?.userId).length, [activeStory?.userId, stories]);

  const openViewers = async () => {
    if (!activeStory || activeStory.userId !== user?.uid) return;
    setPaused(true);
    setViewersOpen(true);
    setViewersLoading(true);
    try {
      setViewerProfiles(await getProfilesByIds((activeStory.seenBy ?? []).filter((uid) => uid !== user.uid)));
    } finally {
      setViewersLoading(false);
    }
  };

  const removeActiveStory = async () => {
    if (!activeStory || activeStory.userId !== user?.uid || deleting) return;
    setDeleting(true);
    try {
      await deleteStory(activeStory);
      const remaining = stories.filter((story) => story.id !== activeStory.id);
      setStories(remaining);
      setViewersOpen(false);
      window.dispatchEvent(new CustomEvent("kinet:story-created"));
      if (!remaining.length) setViewerOpen(false);
      else setActiveIndex((index) => Math.min(index, remaining.length - 1));
    } finally {
      setDeleting(false);
    }
  };

  if (!viewerOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black">
      <div
        className="relative h-dvh w-full max-w-[520px] bg-black"
        onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX ?? null; }}
        onTouchEnd={(event) => {
          if (touchStartX.current === null) return;
          const distance = (event.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
          if (distance > 50) setActiveIndex((index) => Math.max(0, index - 1));
          if (distance < -50) setActiveIndex((index) => Math.min(stories.length - 1, index + 1));
          touchStartX.current = null;
        }}
      >
        <div className="absolute inset-0 z-[5] flex">
          <button type="button" className="h-full w-1/3" onClick={() => setActiveIndex((index) => Math.max(0, index - 1))} aria-label="Previous story" />
          <button type="button" className="h-full w-1/3" onClick={() => setPaused((value) => !value)} aria-label={paused ? "Resume" : "Pause"} />
          <button type="button" className="h-full w-1/3" onClick={() => setActiveIndex((index) => Math.min(stories.length - 1, index + 1))} aria-label="Next story" />
        </div>
        <div className="absolute left-0 right-0 top-0 z-10 flex gap-1 p-3">
          {activeCreatorStories.map((story, index) => (
            <div key={story.id} className="h-1 flex-1 rounded-full bg-white/20">
              <div className="h-full rounded-full bg-white transition-all" style={{ width: index < activeCreatorPosition ? "100%" : index === activeCreatorPosition ? `${progress}%` : "0%" }} />
            </div>
          ))}
        </div>
        <div className="absolute right-3 top-7 z-30 flex gap-1">
          <button type="button" onClick={() => setPaused((value) => !value)} className="rounded-full bg-black/70 p-2 text-white ring-1 ring-white/30 hover:bg-black">{paused ? "▶" : "⏸"}</button>
          <button type="button" onClick={() => setMuted((value) => !value)} className="rounded-full bg-black/70 p-2 text-white ring-1 ring-white/30 hover:bg-black">{muted ? "🔇" : "🔊"}</button>
          <button type="button" onClick={() => setViewerOpen(false)} className="rounded-full bg-black/70 p-2 text-white ring-1 ring-white/30 hover:bg-black"><X className="h-5 w-5" /></button>
        </div>
        {activeStory?.mediaType === "video" ? (
          <video ref={videoRef} key={activeStory.id} src={activeStory.mediaUrl} autoPlay playsInline muted={muted} onPlay={() => setPaused(false)} onPause={() => setPaused(true)} onTimeUpdate={(event) => { const video = event.currentTarget; if (video.duration) setProgress(Math.min((video.currentTime / video.duration) * 100, 100)); }} onEnded={() => setActiveIndex((index) => { if (index + 1 < stories.length) return index + 1; setViewerOpen(false); return index; })} className="h-full w-full object-cover" />
        ) : (
          <img src={activeStory.mediaUrl} alt={activeStory.altText || activeStory.caption || "Story"} className="h-full w-full object-cover" />
        )}
        {activeStory?.sensitiveContent && !revealedStoryIds.includes(activeStory.id) ? (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/90 p-8 text-center text-white">
            <p className="mb-4 text-lg font-semibold">Sensitive content</p>
            <button type="button" className="rounded-full bg-white px-6 py-2 text-black" onClick={() => setRevealedStoryIds((ids) => [...ids, activeStory.id])}>View</button>
          </div>
        ) : null}
        <div className="absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-4 text-white">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold">{activeStory?.authorName}</p>
              <span className="text-xs text-white/70">{new Date(activeStory?.createdAt?.seconds ? activeStory.createdAt.seconds * 1000 : Date.now()).toLocaleString()}</span>
            </div>
            <p className="text-xs text-white/70">{groupedCount} active {groupedCount === 1 ? "story" : "stories"}</p>
          </div>
          {activeStory?.caption ? <p className="mt-2 text-sm text-white/80">{activeStory.caption}</p> : null}
          {user && activeStory?.userId !== user.uid ? (
            <div className="mt-3 space-y-2">
              <div className="relative w-fit">
                <button type="button" aria-expanded={reactionPickerOpen} onClick={() => setReactionPickerOpen((open) => !open)} className="inline-flex h-10 items-center gap-2 rounded-full bg-white/15 px-3 text-sm font-medium hover:bg-white/25">😀 React</button>
                {reactionPickerOpen ? (
                  <div className="absolute bottom-12 left-0 z-40 grid grid-cols-4 gap-1 rounded-2xl border border-white/15 bg-black/90 p-2 shadow-2xl" role="dialog">
                    {STORY_REACTIONS.map((emoji) => (
                      <button key={emoji} type="button" disabled={Boolean(reactingEmoji)} onClick={() => { setReactingEmoji(emoji); setInteractionStatus(""); void reactToStory(activeStory.id, emoji).then(() => { setInteractionStatus(`Reaction ${emoji} sent.`); setReactionPickerOpen(false); }).catch(() => setInteractionStatus("Reaction could not be sent.")).finally(() => setReactingEmoji("")); }} className={`flex h-11 w-11 items-center justify-center rounded-xl text-2xl hover:bg-white/20 disabled:opacity-50 ${reactingEmoji === emoji ? "scale-110 bg-white/25" : ""}`}>{emoji}</button>
                    ))}
                  </div>
                ) : null}
              </div>
              {activeStory.canReply ? (
                <div className="flex gap-2">
                  <input value={replyText} maxLength={1000} disabled={replySending} onChange={(event) => setReplyText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) event.preventDefault(); }} placeholder="Reply to this story" className="h-10 w-full rounded-md border border-white/20 bg-black/30 px-3 text-sm text-white placeholder:text-white/60" />
                  <button type="button" disabled={replySending || !replyText.trim()} onClick={async () => { const message = replyText.trim(); if (!message || replySending) return; setReplySending(true); setInteractionStatus(""); try { const conversationId = await createOrGetConversation(activeStory.userId); await sendConversationMessage(conversationId, `Story reply: ${message}`, null, undefined, undefined, undefined, { notificationType: "story_reply", storyId: activeStory.id }); await recordStoryReply(activeStory.id); setReplyText(""); setInteractionStatus("Reply sent privately."); } catch { setInteractionStatus("Reply could not be sent."); } finally { setReplySending(false); } }} className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90 disabled:opacity-50">{replySending ? "Sending…" : "Reply"}</button>
                </div>
              ) : <p className="text-xs text-white/70">Replies are turned off for this story.</p>}
              {interactionStatus ? <p aria-live="polite" className="text-xs text-white/80">{interactionStatus}</p> : null}
            </div>
          ) : user && activeStory?.userId === user.uid ? (
            <div className="mt-4 flex items-center justify-between gap-3">
              <button type="button" onClick={() => void openViewers()} className="inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/30"><Eye className="h-5 w-5" />Viewers · {(activeStory.seenBy ?? []).filter((uid) => uid !== user.uid).length}</button>
              <button type="button" disabled={deleting} onClick={() => void removeActiveStory()} className="inline-flex items-center gap-2 rounded-full bg-red-500/30 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500/45 disabled:opacity-50"><Trash2 className="h-5 w-5" />{deleting ? "Deleting…" : "Delete"}</button>
            </div>
          ) : null}
        </div>
        {viewersOpen && activeStory?.userId === user?.uid ? <div className="absolute inset-x-0 bottom-0 z-50 max-h-[72%] overflow-hidden rounded-t-[28px] bg-background text-foreground shadow-2xl"><div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted-foreground/30" /><div className="flex items-center justify-between border-b px-5 py-4"><div><p className="font-semibold">Story viewers</p><p className="text-xs text-muted-foreground">{viewerProfiles.length} people</p></div><button type="button" onClick={() => { setViewersOpen(false); setPaused(false); }} aria-label="Close viewers"><X className="h-5 w-5" /></button></div><div className="max-h-[48vh] overflow-y-auto p-3">{viewersLoading ? <p className="py-10 text-center text-sm text-muted-foreground">Loading viewers…</p> : viewerProfiles.length ? viewerProfiles.map((viewer) => <a key={viewer.uid} href={`/profile/${viewer.uid}`} className="flex items-center gap-3 rounded-xl p-3 hover:bg-muted"><img src={viewer.photoURL || ""} alt="" className="h-11 w-11 rounded-full bg-muted object-cover" /><div className="min-w-0"><p className="truncate font-medium">{viewer.displayName || "Kinet user"}</p><p className="truncate text-xs text-muted-foreground">@{viewer.username || viewer.uid.slice(0, 8)}</p></div></a>) : <p className="py-10 text-center text-sm text-muted-foreground">No viewers yet.</p>}</div><div className="border-t p-3"><button type="button" disabled={deleting} onClick={() => void removeActiveStory()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-destructive px-4 py-3 font-medium text-destructive-foreground disabled:opacity-50"><Trash2 className="h-4 w-4" />{deleting ? "Deleting story…" : "Delete story"}</button></div></div> : null}
        <button type="button" onClick={() => setActiveIndex((current) => Math.max(0, current - 1))} disabled={activeIndex === 0} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 disabled:opacity-30">←</button>
        <button type="button" onClick={() => setActiveIndex((current) => Math.min(stories.length - 1, current + 1))} disabled={activeIndex === stories.length - 1} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 disabled:opacity-30">→</button>
      </div>
    </div>
  );
}
