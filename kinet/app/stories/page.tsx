"use client";

import { FormEvent, Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Archive, ChevronLeft, ChevronRight, Download, Eye, ImagePlus, Pause, Play, Settings2, Share2, ShieldAlert, SmilePlus, Trash2, Volume2, VolumeX, X } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { AuthProvider, useAuthContext } from "@/components/AuthProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createOrGetConversation, sendConversationMessage } from "@/lib/messaging";
import { createStory, deleteStory, formatStoryTime, getActiveStories, markStorySeen, reactToStory, recordStoryReply, updateStoryReplyAudience, type StoryItem } from "@/lib/stories";
import { searchProfiles, type SearchProfile } from "@/lib/user-profile";
import { reportEntity, toggleBlockedUser } from "@/lib/moderation";

const STORY_DURATION_MS = 5000;
const STORY_REACTIONS = ["❤️", "😂", "🔥", "👏", "😍", "😮", "😢", "💯"];

function StoriesPageContent() {
  const { user } = useAuthContext();
  const searchParams = useSearchParams();
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [audience, setAudience] = useState<StoryItem["audience"]>("everyone");
  const [allowedViewerIds, setAllowedViewerIds] = useState<string[]>([]);
  const [hiddenViewerIds, setHiddenViewerIds] = useState<string[]>([]);
  const [replyAudience, setReplyAudience] = useState<StoryItem["replyAudience"]>("everyone");
  const [altText, setAltText] = useState("");
  const [sensitiveContent, setSensitiveContent] = useState(false);
  const [captionsFile, setCaptionsFile] = useState<File | null>(null);
  const [audiencePeople, setAudiencePeople] = useState<SearchProfile[]>([]);
  const [saving, setSaving] = useState(false);
  const [online, setOnline] = useState(true);
  const [lastUploadFailed, setLastUploadFailed] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [creatorError, setCreatorError] = useState("");
  const [creatorSuccess, setCreatorSuccess] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
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
  const [ownerControlsOpen, setOwnerControlsOpen] = useState(false);
  const [storyViewersOpen, setStoryViewersOpen] = useState(false);
  const [deletingStory, setDeletingStory] = useState(false);
  const [ownerActionStatus, setOwnerActionStatus] = useState("");
  const [safetyMenuOpen, setSafetyMenuOpen] = useState(false);
  const [revealedStoryIds, setRevealedStoryIds] = useState<string[]>([]);
  const [reducedMotion, setReducedMotion] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const creatorRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const touchStartX = useRef<number | null>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    void getActiveStories().then((items) => {
      const muted = JSON.parse(localStorage.getItem("kinet:muted-story-creators") || "[]") as string[];
      setStories(items.filter((story) => !muted.includes(story.userId)));
    }).catch((cause) => {
      setCreatorError(cause instanceof Error ? cause.message : "Stories could not be loaded.");
    });
    void searchProfiles("").then((profiles) => setAudiencePeople(profiles.filter((profile) => profile.uid !== user?.uid)));
  }, [user?.uid]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!file) { setPreviewUrl(""); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const updateConnection = () => setOnline(navigator.onLine);
    updateConnection();
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);
    return () => { window.removeEventListener("online", updateConnection); window.removeEventListener("offline", updateConnection); };
  }, []);

  useEffect(() => {
    const storyId = searchParams.get("story");
    if (!storyId || stories.length === 0) {
      return;
    }

    const foundIndex = stories.findIndex((story) => story.id === storyId);
    if (foundIndex >= 0) {
      setActiveIndex(foundIndex);
      setViewerOpen(true);
    }
  }, [searchParams, stories]);

  const activeStory = stories[activeIndex] ?? null;
  const activeStoryId = activeStory?.id;
  const activeStoryConcealed = Boolean(activeStory?.sensitiveContent && activeStoryId && !revealedStoryIds.includes(activeStoryId));
  const creatorGroups = useMemo(() => {
    const groups = new Map<string, StoryItem[]>();
    stories.forEach((story) => groups.set(story.userId, [...(groups.get(story.userId) ?? []), story]));
    return Array.from(groups.entries()).map(([userId, items]) => ({
      userId,
      stories: items,
      representative: items[items.length - 1],
      firstIndex: stories.findIndex((story) => story.userId === userId),
      hasUnseen: items.some((story) => !story.seenBy?.includes(user?.uid || "")),
    }));
  }, [stories, user?.uid]);
  const ownStories = useMemo(() => stories.filter((story) => story.userId === user?.uid), [stories, user?.uid]);
  const activeCreatorStories = useMemo(() => stories.filter((story) => story.userId === activeStory?.userId), [activeStory?.userId, stories]);
  const activeCreatorPosition = activeCreatorStories.findIndex((story) => story.id === activeStoryId);
  const groupedCount = useMemo(
    () => stories.filter((story) => story.userId === activeStory?.userId).length,
    [activeStory?.userId, stories]
  );

  useEffect(() => {
    if (!activeStoryId) {
      return;
    }

    void markStorySeen(activeStoryId);
    if (user?.uid) {
      setStories((current) => current.map((story) => story.id === activeStoryId
        ? { ...story, seenBy: Array.from(new Set([...(story.seenBy ?? []), user.uid])) }
        : story));
    }
    setProgress(0);
    setReplyText("");
    setInteractionStatus("");
    setReactionPickerOpen(false);
    setOwnerControlsOpen(false);
    setStoryViewersOpen(false);
    setSafetyMenuOpen(false);
    setOwnerActionStatus("");
  }, [activeStoryId, user?.uid]);

  const handleDeleteStory = async (story: StoryItem) => {
    if (deletingStory || !window.confirm("Delete this story permanently?")) return;
    setDeletingStory(true);
    try {
      await deleteStory(story);
      setStories((items) => items.filter((item) => item.id !== story.id));
      setStoryViewersOpen(false);
      setOwnerControlsOpen(false);
      setViewerOpen(false);
    } catch (cause) {
      setOwnerActionStatus(cause instanceof Error ? cause.message : "Story could not be deleted.");
    } finally {
      setDeletingStory(false);
    }
  };

  useEffect(() => {
    if (!viewerOpen || !activeStoryId || paused || reducedMotion || activeStoryConcealed || activeStory?.mediaType === "video") return;

    const startedAt = Date.now();
    const startingProgress = progress;
    const remainingDuration = STORY_DURATION_MS * (1 - startingProgress / 100);
    const interval = window.setInterval(() => {
      const nextProgress = Math.min(startingProgress + ((Date.now() - startedAt) / remainingDuration) * (100 - startingProgress), 100);
      setProgress(nextProgress);

      if (nextProgress >= 100) {
        setActiveIndex((current) => {
          if (current + 1 < stories.length) return current + 1;
          setViewerOpen(false);
          return current;
        });
      }
    }, 100);

    return () => window.clearInterval(interval);
    // progress is intentionally captured only when playback starts or resumes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStoryConcealed, activeStoryId, activeStory?.mediaType, paused, reducedMotion, stories.length, viewerOpen]);

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
    if (!video || activeStory?.mediaType !== "video") return;
    if (paused || activeStoryConcealed) video.pause();
    else void video.play().catch(() => undefined);
  }, [activeStory?.mediaType, activeStoryConcealed, activeStoryId, paused]);

  useEffect(() => {
    const nextStory = stories[activeIndex + 1];
    if (!viewerOpen || !nextStory) return;
    if (nextStory.mediaType === "image") {
      const preload = new Image();
      preload.src = nextStory.mediaUrl;
    } else {
      const preload = document.createElement("video");
      preload.preload = "metadata";
      preload.src = nextStory.mediaUrl;
    }
  }, [activeIndex, stories, viewerOpen]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) {
      return;
    }

    setSaving(true);
    setLastUploadFailed(false);
    setUploadProgress(0);
    setCreatorError("");
    setCreatorSuccess("");
    const controller = new AbortController();
    uploadAbortRef.current = controller;
    try {
      await createStory(file, caption, setUploadProgress, { audience, allowedViewerIds, hiddenViewerIds, replyAudience, altText, sensitiveContent, captionsFile }, controller.signal);
      setCaption("");
      setFile(null);
      setAllowedViewerIds([]);
      setHiddenViewerIds([]);
      setAltText("");
      setSensitiveContent(false);
      setCaptionsFile(null);
      setCreatorSuccess("Your story is live for 24 hours.");
      window.dispatchEvent(new CustomEvent("kinet:story-created"));
      try {
        const nextStories = await getActiveStories(true);
        setStories(nextStories);
        const ownStoryIndex = nextStories.findIndex((story) => story.userId === user?.uid);
        if (ownStoryIndex >= 0) setActiveIndex(ownStoryIndex);
      } catch {
        // The upload already succeeded. A list refresh failure must never invite
        // the user to upload the same story a second time.
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Your story could not be posted.";
      setCreatorError(message.toLowerCase().includes("cancel") ? "Upload canceled. Your draft is still here." : online ? message : "You are offline. Reconnect and try again; your draft is still here.");
      setLastUploadFailed(!message.toLowerCase().includes("cancel"));
    } finally {
      setSaving(false);
      uploadAbortRef.current = null;
    }
  };

  return (
    <ProtectedRoute>
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-6 md:py-8">
        <div className="flex items-start justify-between gap-3">
          <div><h1 className="text-3xl font-bold">Stories</h1><p className="text-muted-foreground">Post 24-hour updates with a tap-through viewer, circle rail, and story replies.</p></div>
          <Button asChild variant="outline"><Link href="/stories/archive"><Archive className="mr-2 h-4 w-4" />Archive</Link></Button>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-2">
          <button
            type="button"
            onClick={() => {
              creatorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
              window.setTimeout(() => fileInputRef.current?.click(), 350);
            }}
            className="flex min-w-[84px] flex-col items-center gap-2"
          >
            <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 via-rose-500 to-amber-400 p-[2px]">
              <div className="flex h-full w-full items-center justify-center rounded-full bg-background">
                <img
                  src={user?.photoURL || "https://placehold.co/80x80?text=Y"}
                  alt="Your story"
                  className="h-[70px] w-[70px] rounded-full object-cover"
                />
              </div>
              <span className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                +
              </span>
              {ownStories.length ? <span className="absolute -left-1 top-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1 text-[10px] font-bold text-background">{ownStories.length}</span> : null}
            </div>
            <span className="max-w-[84px] truncate text-center text-xs font-medium">Your story</span>
          </button>

          {creatorGroups.filter((group) => group.userId !== user?.uid).map((group) => {
            const story = group.representative;
            return (
            <button
              key={group.userId}
              type="button"
              onClick={() => {
                if (group.firstIndex >= 0) {
                  setActiveIndex(group.firstIndex);
                  setPaused(false);
                  setViewerOpen(true);
                }
              }}
              className="flex min-w-[84px] flex-col items-center gap-2"
            >
              <div className={`relative rounded-full p-[2px] ${group.hasUnseen ? "bg-gradient-to-br from-fuchsia-500 via-rose-500 to-amber-400" : "bg-muted-foreground/35"}`}>
                <div className="rounded-full bg-background p-[2px]">
                  <img
                    src={story.authorAvatar || "https://placehold.co/80x80?text=S"}
                    alt={story.authorName}
                    className="h-[70px] w-[70px] rounded-full object-cover"
                  />
                </div>
                {group.stories.length > 1 ? <span className="absolute -right-1 top-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1 text-[10px] font-bold text-background">{group.stories.length}</span> : null}
              </div>
              <div className="text-center">
                <span className="block max-w-[84px] truncate text-xs font-medium">{story.authorName}</span>
                <span className="text-[11px] text-muted-foreground">{formatStoryTime(story.createdAt)}</span>
              </div>
            </button>
          ); })}
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.9fr,1.1fr]">
          <Card ref={creatorRef}>
            <CardHeader>
              <CardTitle>Create Story</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={handleSubmit}>
                <input ref={fileInputRef} type="file" accept="image/*,video/*" className="sr-only" onChange={(event) => {
                  const selected = event.target.files?.[0] ?? null;
                  setCreatorError("");
                  if (selected && !selected.type.startsWith("image/") && !selected.type.startsWith("video/")) { setCreatorError("Choose an image or video."); event.target.value = ""; return; }
                  if (selected && selected.size > 50 * 1024 * 1024) { setCreatorError("Stories must be smaller than 50 MB."); event.target.value = ""; return; }
                  setFile(selected);
                }} />
                {file && previewUrl ? <div className="relative overflow-hidden rounded-2xl bg-black"><div className="absolute right-2 top-2 z-10 flex gap-2"><button type="button" disabled={saving} onClick={() => fileInputRef.current?.click()} className="rounded-full bg-black/60 px-3 py-2 text-xs font-medium text-white disabled:opacity-50">Replace</button><button type="button" disabled={saving} aria-label="Remove selected media" onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="rounded-full bg-black/60 p-2 text-white disabled:opacity-50"><X className="h-4 w-4" /></button></div>{file.type.startsWith("video/") ? <video src={previewUrl} controls playsInline className="aspect-[9/12] w-full object-contain" /> : <img src={previewUrl} alt="Story preview" className="aspect-[9/12] w-full object-contain" />}</div> : <button type="button" onClick={() => fileInputRef.current?.click()} className="flex min-h-52 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-muted/30 p-6 text-center hover:border-primary hover:bg-primary/5"><ImagePlus className="mb-3 h-10 w-10 text-primary" /><span className="font-semibold">Choose a photo or video</span><span className="mt-1 text-xs text-muted-foreground">Your story disappears after 24 hours · Max 50 MB</span></button>}
                <textarea maxLength={220} value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Add a quick caption" className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                <Input maxLength={240} value={altText} onChange={(event) => setAltText(event.target.value)} placeholder="Describe the media for screen readers" aria-label="Story media description" />
                {file?.type.startsWith("video/") ? <label className="block rounded-xl border p-3 text-sm font-medium">Video captions (optional)<span className="mt-1 block text-xs font-normal text-muted-foreground">Upload a WebVTT (.vtt) captions file, up to 2 MB.</span><input type="file" accept=".vtt,text/vtt" className="mt-2 block w-full text-xs" onChange={(event) => setCaptionsFile(event.target.files?.[0] ?? null)} /></label> : null}
                <label className="flex items-center gap-3 rounded-xl border p-3 text-sm"><input type="checkbox" checked={sensitiveContent} onChange={(event) => setSensitiveContent(event.target.checked)} /><span><span className="block font-medium">Sensitive-content warning</span><span className="text-xs text-muted-foreground">Viewers must choose to reveal this story.</span></span></label>
                <label className="block text-sm font-medium">Who can see this story?<select value={audience} onChange={(event) => setAudience(event.target.value as StoryItem["audience"])} className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="everyone">Everyone</option><option value="followers">Followers</option><option value="close_friends">Close Friends</option><option value="selected">Selected people</option></select></label>
                <label className="block text-sm font-medium">Who can reply?<select value={replyAudience} onChange={(event) => setReplyAudience(event.target.value as StoryItem["replyAudience"])} className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="everyone">Everyone who can view</option><option value="followers">Followers</option><option value="no_one">Turn off replies</option></select></label>
                {audience === "selected" ? <div className="rounded-xl border p-3"><p className="mb-2 text-sm font-medium">Selected people</p><div className="max-h-40 space-y-1 overflow-y-auto">{audiencePeople.map((person) => <label key={person.uid} className="flex cursor-pointer items-center gap-2 rounded-lg p-2 text-sm hover:bg-muted"><input type="checkbox" checked={allowedViewerIds.includes(person.uid)} onChange={() => { setAllowedViewerIds((ids) => ids.includes(person.uid) ? ids.filter((id) => id !== person.uid) : [...ids, person.uid]); setHiddenViewerIds((ids) => ids.filter((id) => id !== person.uid)); }} /><span className="truncate">{person.displayName} <span className="text-muted-foreground">@{person.username || person.uid.slice(0, 8)}</span></span></label>)}</div>{!allowedViewerIds.length ? <p className="mt-2 text-xs text-destructive">Select at least one person.</p> : null}</div> : null}
                <details className="rounded-xl border p-3"><summary className="cursor-pointer text-sm font-medium">Hide story from people</summary><div className="mt-2 max-h-40 space-y-1 overflow-y-auto">{audiencePeople.map((person) => <label key={person.uid} className="flex cursor-pointer items-center gap-2 rounded-lg p-2 text-sm hover:bg-muted"><input type="checkbox" checked={hiddenViewerIds.includes(person.uid)} disabled={allowedViewerIds.includes(person.uid)} onChange={() => setHiddenViewerIds((ids) => ids.includes(person.uid) ? ids.filter((id) => id !== person.uid) : [...ids, person.uid])} /><span className="truncate">{person.displayName} <span className="text-muted-foreground">@{person.username || person.uid.slice(0, 8)}</span></span></label>)}</div></details>
                {!online ? <p role="status" className="rounded-xl bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">You are offline. Your selected media and caption will stay here until you reconnect.</p> : null}
                <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{caption.length}/220</span><Button type="submit" disabled={!online || saving || !file || (audience === "selected" && !allowedViewerIds.length)}>{saving ? "Posting story…" : lastUploadFailed ? "Retry upload" : "Share story"}</Button></div>
                {saving ? <div role="progressbar" aria-label="Story upload progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={uploadProgress}><div className="mb-1 flex items-center justify-between text-xs text-muted-foreground"><span>Optimizing and uploading</span><span>{uploadProgress}%</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${uploadProgress}%` }} /></div><button type="button" onClick={() => uploadAbortRef.current?.abort()} className="mt-2 text-xs font-medium text-destructive">Cancel upload</button></div> : null}
                {creatorError ? <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{creatorError}</p> : null}
                {creatorSuccess ? <p role="status" className="rounded-xl bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-400">{creatorSuccess}</p> : null}
              </form>
            </CardContent>
          </Card>

          <Card className={viewerOpen ? "fixed inset-0 z-[100] overflow-hidden rounded-none border-0 bg-black" : "overflow-hidden rounded-[28px]"}>
            <CardContent className="p-0">
              {!activeStory ? (
                <div className="flex aspect-[9/16] items-center justify-center bg-muted p-6 text-sm text-muted-foreground">
                  No active stories yet.
                </div>
              ) : (
                <div
                  className={viewerOpen ? "relative mx-auto h-dvh max-w-[520px] bg-black" : "relative aspect-[9/16] bg-black"}
                  onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX ?? null; }}
                  onTouchEnd={(event) => {
                    if (touchStartX.current === null) return;
                    const distance = (event.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
                    if (distance > 50) setActiveIndex((index) => Math.max(0, index - 1));
                    if (distance < -50) setActiveIndex((index) => Math.min(stories.length - 1, index + 1));
                    touchStartX.current = null;
                  }}
                >
                  <div className="absolute left-0 right-0 top-0 z-10 flex gap-1 p-3">
                    {activeCreatorStories.map((story, index) => (
                      <div key={story.id} className="h-1 flex-1 rounded-full bg-white/20">
                        <div
                          className="h-full rounded-full bg-white transition-all"
                          style={{
                            width:
                              index < activeCreatorPosition
                                ? "100%"
                                : index === activeCreatorPosition
                                  ? `${progress}%`
                                  : "0%",
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  {viewerOpen ? <div className="absolute right-3 top-7 z-30 flex gap-1"><Button type="button" variant="ghost" size="icon" aria-label={paused ? "Resume story" : "Pause story"} className="rounded-full bg-black/70 text-white ring-1 ring-white/30 hover:bg-black" onClick={() => setPaused((value) => !value)}>{paused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}</Button><Button type="button" variant="ghost" size="icon" aria-label={muted ? "Unmute story" : "Mute story"} className="rounded-full bg-black/70 text-white ring-1 ring-white/30 hover:bg-black" onClick={() => setMuted((value) => !value)}>{muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}</Button>{activeStory.userId === user?.uid ? <Button type="button" variant="ghost" size="icon" aria-label="Story settings" className="rounded-full bg-black/70 text-white ring-1 ring-white/30 hover:bg-black" onClick={() => { setOwnerControlsOpen((open) => !open); setPaused(true); }}><Settings2 className="h-5 w-5" /></Button> : <Button type="button" variant="ghost" size="icon" aria-label="Story safety options" className="rounded-full bg-black/70 text-white ring-1 ring-white/30 hover:bg-black" onClick={() => setSafetyMenuOpen((open) => !open)}><ShieldAlert className="h-5 w-5" /></Button>}<Button type="button" variant="ghost" size="icon" aria-label="Close stories" className="rounded-full bg-black/70 text-white ring-1 ring-white/30 hover:bg-black" onClick={() => setViewerOpen(false)}><X className="h-5 w-5" /></Button></div> : null}
                  {ownerControlsOpen && activeStory.userId === user?.uid ? <aside className="absolute inset-x-3 top-20 z-40 max-h-[70vh] overflow-y-auto rounded-2xl border border-white/15 bg-black/90 p-4 text-white shadow-2xl backdrop-blur"><div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">Story controls</h3><button type="button" onClick={() => { setOwnerControlsOpen(false); setPaused(false); }} aria-label="Close story controls"><X className="h-5 w-5" /></button></div><div className="grid grid-cols-3 gap-2 text-center text-xs"><button type="button" onClick={() => { setOwnerControlsOpen(false); setStoryViewersOpen(true); }} className="rounded-xl bg-white/10 p-3"><Eye className="mx-auto mb-1 h-5 w-5" />{activeStory.seenBy?.filter((id) => id !== user.uid).length ?? 0} viewers</button><div className="rounded-xl bg-white/10 p-3"><SmilePlus className="mx-auto mb-1 h-5 w-5" />{Object.values(activeStory.reactions).reduce((count, ids) => count + ids.length, 0)} reactions</div><div className="rounded-xl bg-white/10 p-3">{activeStory.replyCount}<br />replies</div></div><p className="mt-3 text-xs text-white/70">Expires {activeStory.expiresAt?.seconds ? new Date(activeStory.expiresAt.seconds * 1000).toLocaleString() : "within 24 hours"}</p><label className="mt-3 block text-xs font-medium">Story replies<select value={activeStory.replyAudience} onChange={(event) => { const next = event.target.value as StoryItem["replyAudience"]; void updateStoryReplyAudience(activeStory.id, next).then(() => { setStories((items) => items.map((item) => item.id === activeStory.id ? { ...item, replyAudience: next } : item)); setOwnerActionStatus("Reply setting updated."); }); }} className="mt-1 h-9 w-full rounded-md border border-white/20 bg-black px-2"><option value="everyone">Everyone</option><option value="followers">Followers</option><option value="no_one">Off</option></select></label><div className="mt-3 grid grid-cols-3 gap-2"><button type="button" onClick={() => void (navigator.share ? navigator.share({ title: "Kinet story", url: `${window.location.origin}/stories?story=${activeStory.id}` }) : navigator.clipboard.writeText(`${window.location.origin}/stories?story=${activeStory.id}`)).then(() => setOwnerActionStatus("Story link shared."))} className="rounded-xl bg-white/10 p-3 text-xs"><Share2 className="mx-auto mb-1 h-5 w-5" />Share</button><a href={activeStory.mediaUrl} target="_blank" rel="noreferrer" download className="rounded-xl bg-white/10 p-3 text-center text-xs"><Download className="mx-auto mb-1 h-5 w-5" />Save</a><button type="button" disabled={deletingStory} onClick={() => void handleDeleteStory(activeStory)} className="rounded-xl bg-red-500/20 p-3 text-xs text-red-200 disabled:opacity-50"><Trash2 className="mx-auto mb-1 h-5 w-5" />{deletingStory ? "Deleting…" : "Delete"}</button></div>{ownerActionStatus ? <p aria-live="polite" className="mt-3 text-xs text-white/80">{ownerActionStatus}</p> : null}</aside> : null}
                  {storyViewersOpen && activeStory.userId === user?.uid ? <aside className="absolute inset-x-0 bottom-0 z-50 max-h-[72%] overflow-hidden rounded-t-[28px] bg-background text-foreground shadow-2xl"><div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted-foreground/30" /><div className="flex items-center justify-between border-b px-5 py-4"><div><h3 className="font-semibold">Story activity</h3><p className="text-xs text-muted-foreground">{(activeStory.seenBy ?? []).filter((id) => id !== user.uid).length} viewers</p></div><button type="button" onClick={() => { setStoryViewersOpen(false); setPaused(false); }} aria-label="Close viewers"><X className="h-5 w-5" /></button></div><div className="max-h-[52vh] overflow-y-auto p-3">{(activeStory.seenBy ?? []).filter((id) => id !== user.uid).map((viewerId) => { const viewer = audiencePeople.find((person) => person.uid === viewerId); return <div key={viewerId} className="flex items-center gap-3 rounded-xl p-3 hover:bg-muted"><img src={viewer?.photoURL || "https://placehold.co/80x80?text=K"} alt="" className="h-11 w-11 rounded-full object-cover" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{viewer?.displayName || `User ${viewerId.slice(0, 8)}`}</p><p className="truncate text-xs text-muted-foreground">{viewer?.username ? `@${viewer.username}` : "Viewed your story"}</p></div><button type="button" onClick={() => void toggleBlockedUser(viewerId, false).then(() => setOwnerActionStatus("Viewer blocked."))} className="rounded-lg px-2 py-1 text-xs font-medium text-destructive">Block</button></div>; })}{!(activeStory.seenBy ?? []).some((id) => id !== user.uid) ? <div className="px-6 py-12 text-center"><Eye className="mx-auto mb-3 h-9 w-9 text-muted-foreground" /><p className="font-medium">No viewers yet</p><p className="mt-1 text-sm text-muted-foreground">People who view your story will appear here.</p></div> : null}</div><div className="border-t p-3"><Button type="button" variant="destructive" className="w-full" disabled={deletingStory} onClick={() => void handleDeleteStory(activeStory)}><Trash2 className="mr-2 h-4 w-4" />{deletingStory ? "Deleting story…" : "Delete story"}</Button></div></aside> : null}
                  {safetyMenuOpen && activeStory.userId !== user?.uid ? <aside className="absolute right-3 top-20 z-40 w-56 rounded-2xl border border-white/20 bg-black/95 p-3 text-white shadow-2xl"><p className="mb-2 text-sm font-semibold">Story safety</p><button type="button" onClick={() => void reportEntity({ targetId: activeStory.id, targetType: "post", reason: "story", details: `Reported story by ${activeStory.userId}.` }).then(() => { setInteractionStatus("Story reported for review."); setSafetyMenuOpen(false); })} className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-white/10">Report story</button><button type="button" onClick={() => { const muted = JSON.parse(localStorage.getItem("kinet:muted-story-creators") || "[]") as string[]; localStorage.setItem("kinet:muted-story-creators", JSON.stringify(Array.from(new Set([...muted, activeStory.userId])))); setStories((items) => items.filter((item) => item.userId !== activeStory.userId)); setViewerOpen(false); }} className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-white/10">Mute this creator</button><button type="button" onClick={() => void toggleBlockedUser(activeStory.userId, false).then(() => { setStories((items) => items.filter((item) => item.userId !== activeStory.userId)); setViewerOpen(false); })} className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-300 hover:bg-white/10">Block this creator</button></aside> : null}
                  {activeStory.mediaType === "video" ? (
                    <video
                      ref={videoRef}
                      key={activeStory.id}
                      src={activeStory.mediaUrl}
                      autoPlay
                      playsInline
                      muted={muted}
                      onPlay={() => setPaused(false)}
                      onPause={() => setPaused(true)}
                      onTimeUpdate={(event) => { const video = event.currentTarget; if (video.duration) setProgress(Math.min((video.currentTime / video.duration) * 100, 100)); }}
                      onEnded={() => setActiveIndex((index) => { if (index + 1 < stories.length) return index + 1; setViewerOpen(false); return index; })}
                      className="h-full w-full object-cover"
                    >{activeStory.captionsUrl ? <track kind="captions" src={activeStory.captionsUrl} srcLang="en" label="Captions" default /> : null}</video>
                  ) : (
                    <img src={activeStory.mediaUrl} alt={activeStory.altText || activeStory.caption || "Story"} className="h-full w-full object-cover" />
                  )}
                  {activeStory.sensitiveContent && !revealedStoryIds.includes(activeStory.id) ? <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/90 p-8 text-center text-white"><ShieldAlert className="mb-3 h-12 w-12" /><h3 className="text-lg font-semibold">Sensitive content</h3><p className="mt-2 max-w-xs text-sm text-white/70">This creator marked the story as potentially sensitive.</p><Button type="button" className="mt-4" onClick={() => setRevealedStoryIds((ids) => [...ids, activeStory.id])}>View story</Button></div> : null}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-4 text-white">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold">{activeStory.authorName}</p>
                      <span className="text-xs text-white/70">{formatStoryTime(activeStory.createdAt)}</span>
                    </div>
                    <p className="mt-1 text-sm text-white/80">{activeStory.caption || "No caption"}</p>
                    <p className="mt-2 text-xs text-white/70">
                      {groupedCount} active {groupedCount === 1 ? "story" : "stories"} from this creator
                      {user ? ` • ${activeStory.seenBy?.includes(user.uid) ? "Seen" : "New"}` : ""}
                    </p>
                    {user && activeStory.userId !== user.uid ? (
                      <div className="mt-3 space-y-2">
                        <div className="relative w-fit"><button type="button" aria-expanded={reactionPickerOpen} aria-label="Choose a story reaction" onClick={() => setReactionPickerOpen((open) => !open)} className="inline-flex h-10 items-center gap-2 rounded-full bg-white/15 px-3 text-sm font-medium hover:bg-white/25"><SmilePlus className="h-5 w-5" />React</button>{reactionPickerOpen ? <div className="absolute bottom-12 left-0 z-40 grid grid-cols-4 gap-1 rounded-2xl border border-white/15 bg-black/90 p-2 shadow-2xl backdrop-blur" role="dialog" aria-label="Story reaction emojis">{STORY_REACTIONS.map((emoji) => <button key={emoji} type="button" disabled={Boolean(reactingEmoji)} onClick={() => { setReactingEmoji(emoji); setInteractionStatus(""); void reactToStory(activeStory.id, emoji).then((added) => { setInteractionStatus(added ? `Reaction ${emoji} sent.` : `You already reacted ${emoji}.`); setReactionPickerOpen(false); }).catch(() => setInteractionStatus("Reaction could not be sent.")).finally(() => setReactingEmoji("")); }} className={`flex h-11 w-11 items-center justify-center rounded-xl text-2xl hover:bg-white/20 disabled:opacity-50 ${reactingEmoji === emoji ? "scale-110 bg-white/25" : ""}`} aria-label={`React with ${emoji}`}>{emoji}</button>)}</div> : null}</div>
                        {activeStory.canReply ? <div className="flex gap-2"><input value={replyText} maxLength={1000} disabled={replySending} onChange={(event) => setReplyText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) event.preventDefault(); }} placeholder="Reply to this story" className="h-10 w-full rounded-md border border-white/20 bg-black/30 px-3 text-sm text-white placeholder:text-white/60" /><Button type="button" size="sm" disabled={replySending || !replyText.trim()} onClick={async () => { const message = replyText.trim(); if (!message || replySending) return; setReplySending(true); setInteractionStatus(""); try { const conversationId = await createOrGetConversation(activeStory.userId); await sendConversationMessage(conversationId, `Story reply: ${message}`, null, undefined, undefined, undefined, { notificationType: "story_reply", storyId: activeStory.id }); await recordStoryReply(activeStory.id); setReplyText(""); setInteractionStatus("Reply sent privately."); } catch { setInteractionStatus("Reply could not be sent."); } finally { setReplySending(false); } }}>{replySending ? "Sending…" : "Reply"}</Button></div> : <p className="text-xs text-white/70">Replies are turned off for this story.</p>}
                        {interactionStatus ? <p aria-live="polite" className="text-xs text-white/80">{interactionStatus}</p> : null}
                      </div>
                    ) : user && activeStory.userId === user.uid ? <div className="mt-4 flex items-center justify-between gap-3"><button type="button" onClick={() => { setStoryViewersOpen(true); setPaused(true); }} className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/25"><Eye className="h-5 w-5" />Activity · {(activeStory.seenBy ?? []).filter((id) => id !== user.uid).length}</button><button type="button" disabled={deletingStory} onClick={() => void handleDeleteStory(activeStory)} className="inline-flex items-center gap-2 rounded-full bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-100 hover:bg-red-500/30 disabled:opacity-50"><Trash2 className="h-5 w-5" />Delete</button></div> : null}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 text-white hover:bg-white/20"
                    onClick={() => setActiveIndex((current) => Math.max(0, current - 1))}
                    disabled={activeIndex === 0}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 text-white hover:bg-white/20"
                    onClick={() => setActiveIndex((current) => Math.min(stories.length - 1, current + 1))}
                    disabled={activeIndex === stories.length - 1}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          {stories.map((story, index) => (
            <button
              key={story.id}
              type="button"
              onClick={() => { setActiveIndex(index); setPaused(false); setViewerOpen(true); }}
              className={`rounded-xl border p-3 text-left ${index === activeIndex ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}
            >
              <p className="font-medium">{story.authorName}</p>
              <p className="text-sm text-muted-foreground">{story.caption || "No caption"}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {story.seenBy?.includes(user?.uid || "") ? "Seen" : "New"}
              </p>
            </button>
          ))}
        </div>
      </div>
    </ProtectedRoute>
  );
}

export default function StoriesPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[70vh] items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" /></div>}>
      <AuthProvider>
        <StoriesPageContent />
      </AuthProvider>
    </Suspense>
  );
}
