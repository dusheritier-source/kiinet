"use client";

import { ChangeEvent, FormEvent, Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Film, Image as ImageIcon, UploadCloud, Video, X } from "lucide-react";

import { AuthProvider, useAuthContext } from "@/components/AuthProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getOwnedPremiumGroups, type PremiumGroupRecord } from "@/lib/creator-hub";
import { deleteUploadDraft, getUploadDrafts, saveUploadDraft } from "@/lib/drafts";
import { createPost, getPostById } from "@/lib/posts";

function UploadPageContent() {
  const { user, loading } = useAuthContext();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [caption, setCaption] = useState("");
  const [contentType, setContentType] = useState<"post" | "reel">("post");
  const [postType, setPostType] = useState<"standard" | "poll" | "qa">("standard");
  const [questionPrompt, setQuestionPrompt] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [collaborators, setCollaborators] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [remixPostId, setRemixPostId] = useState("");
  const [visibility, setVisibility] = useState<"public" | "subscribers" | "premium_group">("public");
  const [premiumGroupId, setPremiumGroupId] = useState("");
  const [sponsored, setSponsored] = useState(false);
  const [sponsorLabel, setSponsorLabel] = useState("");
  const [autoCaption, setAutoCaption] = useState("");
  const [translatedCaption, setTranslatedCaption] = useState("");
  const [accessibilityLabel, setAccessibilityLabel] = useState("");
  const [aiHighlightAnalysis, setAiHighlightAnalysis] = useState("");
  const [voiceoverScript, setVoiceoverScript] = useState("");
  const [thumbnailHint, setThumbnailHint] = useState("");
  const [clipStartSec, setClipStartSec] = useState("");
  const [clipEndSec, setClipEndSec] = useState("");
  const [watermarkEnabled, setWatermarkEnabled] = useState(false);
  const [downloadProtected, setDownloadProtected] = useState(false);
  const [rightClickProtected, setRightClickProtected] = useState(false);
  const [premiumGroups, setPremiumGroups] = useState<PremiumGroupRecord[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [musicTitle, setMusicTitle] = useState("");
  const [musicSourceUrl, setMusicSourceUrl] = useState("");
  const [originalVolume, setOriginalVolume] = useState(1);
  const [musicVolume, setMusicVolume] = useState(0.7);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [visualFilter, setVisualFilter] = useState<"none" | "warm" | "cool" | "mono" | "vivid">("none");
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);
  const [overlayText, setOverlayText] = useState("");
  const [overlayPosition, setOverlayPosition] = useState<"top" | "center" | "bottom">("bottom");
  const [sticker, setSticker] = useState("");
  const [commentsEnabled, setCommentsEnabled] = useState(true);
  const [allowRemix, setAllowRemix] = useState(true);
  const [blockedCommentWords, setBlockedCommentWords] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [assistantLoading, setAssistantLoading] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [loadedDraftId, setLoadedDraftId] = useState<string | null>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!user) {
      setProfileLoading(false);
      return;
    }

    void getOwnedPremiumGroups()
      .then(setPremiumGroups)
      .finally(() => setProfileLoading(false));
  }, [user]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(file);
    setPreviewUrl(nextPreviewUrl);

    return () => {
      URL.revokeObjectURL(nextPreviewUrl);
    };
  }, [file]);

  useEffect(() => {
    const draftId = searchParams.get("draft");
    const initialCaption = searchParams.get("caption");
    const remixId = searchParams.get("remix");
    const requestedType = searchParams.get("type");
    const sourceAudioId = searchParams.get("sourceAudio");
    if (!draftId && (requestedType === "post" || requestedType === "reel")) {
      setContentType(requestedType);
    }
    if (initialCaption && !caption) {
      setCaption(initialCaption);
    }
    if (remixId && !remixPostId) {
      setRemixPostId(remixId);
      setCaption((current) => current || `Remix on @creator #remix`);
    }
    if (sourceAudioId && !musicSourceUrl) void getPostById(sourceAudioId).then((source) => { if (source?.musicUrl) { setMusicSourceUrl(source.musicUrl); setMusicTitle(source.musicTitle || "Reel audio"); setContentType("reel"); } });
    if (!draftId || loadedDraftId === draftId) {
      return;
    }

    getUploadDrafts().then((drafts) => {
      const draft = drafts.find((item: { id: string }) => item.id === draftId);
      if (!draft) {
        return;
      }

      setCaption(draft.caption);
      setContentType(draft.contentType);
      setPostType(draft.postType ?? "standard");
      setQuestionPrompt(draft.questionPrompt ?? "");
      setPollOptions(draft.pollOptions?.length ? draft.pollOptions : ["", ""]);
      setCollaborators((draft.collaborators ?? []).join(", "));
      setScheduledFor(draft.scheduledFor ?? "");
      setRemixPostId(draft.remixPostId ?? "");
      setVisibility(draft.visibility ?? "public");
      setPremiumGroupId(draft.premiumGroupId ?? "");
      setSponsored(Boolean(draft.sponsored));
      setSponsorLabel(draft.sponsorLabel ?? "");
      setAutoCaption(draft.autoCaption ?? "");
      setTranslatedCaption(draft.translatedCaption ?? "");
      setAccessibilityLabel(draft.accessibilityLabel ?? "");
      setAiHighlightAnalysis(draft.aiHighlightAnalysis ?? "");
      setVoiceoverScript(draft.voiceoverScript ?? "");
      setThumbnailHint(draft.thumbnailHint ?? "");
      setClipStartSec(draft.clipStartSec ? String(draft.clipStartSec) : "");
      setClipEndSec(draft.clipEndSec ? String(draft.clipEndSec) : "");
      setWatermarkEnabled(Boolean(draft.watermarkEnabled));
      setDownloadProtected(Boolean(draft.downloadProtected));
      setRightClickProtected(Boolean(draft.rightClickProtected));
      setLoadedDraftId(draft.id);
    });
  }, [caption, loadedDraftId, musicSourceUrl, remixPostId, searchParams]);

  const mediaKind = useMemo(() => {
    if (!file) return null;
    return file.type.startsWith("video/") ? "video" : "image";
  }, [file]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    setError("");
    if (nextFile && nextFile.size > 50 * 1024 * 1024) { setError("Uploads must be smaller than 50 MB."); event.target.value = ""; return; }
    if (contentType === "reel" && nextFile && !nextFile.type.startsWith("video/")) { setError("Choose a video file for your reel."); event.target.value = ""; return; }
    setFile(nextFile);
  };

  const runMediaAssist = async (task: "caption_rewrite" | "hashtags" | "translate" | "voiceover" | "thumbnail") => {
    setAssistantLoading(task);
    setError("");
    try {
      const response = await fetch("/api/media-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task,
          caption,
          autoCaption,
          targetLanguage: "Spanish",
        }),
      });
      const data = (await response.json()) as { result?: string; error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Media assist request failed.");
      }
      const result = data.result || "";
      if (task === "caption_rewrite") {
        setCaption(result);
      } else if (task === "hashtags") {
        setCaption((current) => [current.trim(), result.trim()].filter(Boolean).join(" "));
      } else if (task === "translate") {
        setTranslatedCaption(result);
      } else if (task === "voiceover") {
        setVoiceoverScript(result);
      } else if (task === "thumbnail") {
        setThumbnailHint(result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Media assist failed.");
    } finally {
      setAssistantLoading(null);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (contentType === "reel" && !file) {
      setError("Choose a video to upload.");
      return;
    }

    if (contentType === "reel" && file && !file.type.startsWith("video/")) {
      setError("Reels must use a video file.");
      return;
    }

    if (postType === "poll" && pollOptions.filter((option) => option.trim()).length < 2) {
      setError("Add at least two poll options.");
      return;
    }

    setSubmitting(true);
    setUploadProgress(0);
    const controller = new AbortController();
    uploadAbortRef.current = controller;

    try {
      console.log("Starting upload...", { contentType, postType, hasFile: !!file });
      await createPost({
        caption,
        file,
        contentType,
        postType,
        questionPrompt,
        pollOptions,
        collaborators: collaborators
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        remixPostId,
        scheduledFor,
        visibility,
        premiumGroupId,
        sponsored,
        sponsorLabel,
        autoCaption,
        translatedCaption,
        accessibilityLabel,
        aiHighlightAnalysis,
        voiceoverScript,
        thumbnailHint,
        clipStartSec: clipStartSec ? Number(clipStartSec) : undefined,
        clipEndSec: clipEndSec ? Number(clipEndSec) : undefined,
        watermarkEnabled,
        downloadProtected,
        rightClickProtected,
        coverFile: contentType === "reel" ? coverFile : null,
        onUploadProgress: setUploadProgress,
        signal: controller.signal,
        musicFile: contentType === "reel" ? musicFile : null,
        musicSourceUrl: contentType === "reel" ? musicSourceUrl : "",
        musicTitle,
        originalVolume,
        musicVolume,
        playbackRate,
        visualFilter,
        rotation,
        overlayText,
        overlayPosition,
        sticker,
        commentsEnabled,
        allowRemix,
        commentKeywords: blockedCommentWords.split(",").map((word) => word.trim()).filter(Boolean),
      });
      console.log("Upload successful!");
      if (loadedDraftId) {
        await deleteUploadDraft(loadedDraftId);
      }
      router.push(contentType === "reel" ? "/reels" : "/feed");
    } catch (err) {
      console.error("Upload failed:", err);
      const errorMessage = err instanceof Error ? err.message : "Your upload could not be published.";
      setError(errorMessage);
    } finally {
      setSubmitting(false);
      uploadAbortRef.current = null;
    }
  };

  if (loading || profileLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <div className="mx-auto max-w-2xl py-8">
        <Card>
          <CardContent className="p-6">
            <h1 className="text-2xl font-bold mb-1">Create content</h1>
            <p className="text-sm text-muted-foreground mb-6">Publish a standard post or a reel using the same media pipeline.</p>

            <form className="space-y-6" onSubmit={handleSubmit}>
              {/* Content Type Selection */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setContentType("post")}
                  className={`rounded-xl border-2 p-4 text-left transition ${contentType === "post" ? "border-primary bg-primary/5" : "border-muted hover:border-primary/50"}`}
                >
                  <ImageIcon className="mb-2 h-6 w-6 text-primary" />
                  <p className="font-semibold text-base">Post</p>
                  <p className="text-xs text-muted-foreground">Photos or videos in the main feed</p>
                </button>
                <button
                  type="button"
                  onClick={() => { setContentType("reel"); if (file && !file.type.startsWith("video/")) { setFile(null); setError("Choose a video file for your reel."); } }}
                  className={`rounded-xl border-2 p-4 text-left transition ${contentType === "reel" ? "border-primary bg-primary/5" : "border-muted hover:border-primary/50"}`}
                >
                  <Film className="mb-2 h-6 w-6 text-primary" />
                  <p className="font-semibold text-base">Reel</p>
                  <p className="text-xs text-muted-foreground">Vertical video for the reels feed</p>
                </button>
              </div>

              {/* Post Type Selection (only for posts) */}
              {contentType === "post" && (
                <div className="grid grid-cols-3 gap-3">
                  {([
                    { value: "standard", label: "Standard", hint: "Normal post" },
                    { value: "poll", label: "Poll", hint: "Collect votes" },
                    { value: "qa", label: "Q&A", hint: "Ask the community" },
                  ] as const).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setPostType(option.value)}
                      className={`rounded-xl border-2 p-3 text-left transition ${postType === option.value ? "border-primary bg-primary/5" : "border-muted hover:border-primary/50"}`}
                    >
                      <p className="font-semibold text-sm">{option.label}</p>
                      <p className="text-xs text-muted-foreground">{option.hint}</p>
                    </button>
                  ))}
                </div>
              )}

              {/* File Upload - modern social upload UI (no drag-and-drop) */}
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <div className="md:col-span-2">
                  <div className="rounded-xl border p-4 bg-muted/5">
                    <input
                      type="file"
                      accept={contentType === "reel" ? "video/*" : "image/*,video/*"}
                      onChange={handleFileChange}
                      disabled={submitting}
                      className="hidden"
                      id="file-upload"
                    />

                    <div className={`relative flex w-full items-center justify-center overflow-hidden rounded-lg bg-black/5 ${contentType === "reel" ? "mx-auto aspect-[9/16] max-h-[620px]" : "h-[420px]"}`}>
                      {previewUrl ? (
                        mediaKind === "video" ? (
                          <video src={previewUrl} controls onLoadedMetadata={(event) => { event.currentTarget.playbackRate = playbackRate; event.currentTarget.volume = originalVolume; }} className="h-full w-full object-cover" style={{ filter: visualFilter === "warm" ? "sepia(.25) saturate(1.25)" : visualFilter === "cool" ? "hue-rotate(175deg) saturate(1.1)" : visualFilter === "mono" ? "grayscale(1)" : visualFilter === "vivid" ? "saturate(1.7) contrast(1.1)" : "none", transform: `rotate(${rotation}deg)` }} />
                        ) : (
                          <img src={previewUrl} alt="Upload preview" className="w-full h-full object-cover" />
                        )
                      ) : (
                        <div className="text-center px-6">
                          <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground" />
                          <p className="mt-3 font-semibold">Tap to select a file</p>
                          <p className="mt-1 text-sm text-muted-foreground">{contentType === "reel" ? "Vertical videos up to 50 MB." : "Choose an image or video up to 50 MB."}</p>
                        </div>
                      )}
                      {contentType === "reel" && (overlayText || sticker) ? <div className={`pointer-events-none absolute inset-x-4 z-10 text-center text-white drop-shadow-lg ${overlayPosition === "top" ? "top-16" : overlayPosition === "center" ? "top-1/2 -translate-y-1/2" : "bottom-8"}`}><span className="rounded-xl bg-black/35 px-3 py-1 text-xl font-bold">{sticker ? `${sticker} ` : ""}{overlayText}</span></div> : null}
                      <label htmlFor="file-upload" className="absolute left-4 top-4">
                        <Button type="button" size="sm">Add media</Button>
                      </label>
                    </div>

                    <div className="mt-4 flex items-center gap-3">
                      {previewUrl ? (
                        <>
                          <Button type="button" onClick={() => { setFile(null); setPreviewUrl(""); }} variant="outline">Remove</Button>
                          <a href={previewUrl} target="_blank" rel="noreferrer" className="text-sm text-primary">Open preview</a>
                          {mediaKind === "video" && (
                            <Button type="button" variant="outline" onClick={() => void runMediaAssist("thumbnail")}>Select cover</Button>
                          )}
                        </>
                      ) : (
                        <label htmlFor="file-upload"><Button type="button">Choose file</Button></label>
                      )}
                    </div>
                    {contentType === "reel" ? <label className="mt-4 block rounded-xl border border-dashed p-3 text-sm font-medium">Reel cover image <span className="font-normal text-muted-foreground">(optional)</span><input type="file" accept="image/*" disabled={submitting} className="mt-2 block w-full text-xs" onChange={(event) => { const selected = event.target.files?.[0] ?? null; if (selected && selected.size > 5 * 1024 * 1024) { setError("Cover images must be smaller than 5 MB."); event.target.value = ""; return; } setCoverFile(selected); }} />{coverFile ? <span className="mt-2 block truncate text-xs text-primary">Selected: {coverFile.name}</span> : null}</label> : null}
                  </div>
                </div>

                <aside className="space-y-4">
                  <div className="rounded-xl border p-4">
                    <p className="text-sm font-medium">Caption</p>
                    <textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Write a caption..." className="mt-2 min-h-20 w-full rounded-md border px-3 py-2 text-sm" />
                    <Input value={collaborators} onChange={(e) => setCollaborators(e.target.value)} placeholder="Tag collaborators (comma separated)" className="mt-3" />
                  </div>

                  <div className="rounded-xl border p-4">
                    <p className="text-sm font-medium">Quick Trim</p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <input type="number" min={0} value={clipStartSec} onChange={(e) => setClipStartSec(e.target.value)} className="h-10 rounded-md border px-2" placeholder="Start (s)" />
                      <input type="number" min={0} value={clipEndSec} onChange={(e) => setClipEndSec(e.target.value)} className="h-10 rounded-md border px-2" placeholder="End (s)" />
                    </div>
                  </div>

                  <div className="rounded-xl border p-4">
                    <p className="text-sm font-medium">Visibility</p>
                    <select value={visibility} onChange={(e) => setVisibility(e.target.value as any)} className="mt-2 w-full h-10 rounded-md border px-2">
                      <option value="public">Public</option>
                      <option value="subscribers">Subscribers</option>
                      <option value="premium_group">Premium group</option>
                    </select>
                    {visibility === "premium_group" && (
                      <select value={premiumGroupId} onChange={(e) => setPremiumGroupId(e.target.value)} className="mt-2 w-full h-10 rounded-md border px-2">
                        <option value="">Choose group</option>
                        {premiumGroups.map((g) => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="rounded-xl border p-4">
                    <p className="text-sm font-medium">AI Tools</p>
                    <div className="mt-2 flex flex-col gap-2">
                      <Button type="button" variant="outline" onClick={() => void runMediaAssist("caption_rewrite")} disabled={assistantLoading !== null}>Rewrite Caption</Button>
                      <Button type="button" variant="outline" onClick={() => void runMediaAssist("hashtags")} disabled={assistantLoading !== null}>Add Hashtags</Button>
                    </div>
                  </div>
                </aside>
              </div>

              {/* Caption */}
              <div>
                <textarea
                  value={caption}
                  onChange={(event) => setCaption(event.target.value)}
                  placeholder="What's on your mind? Add #tags so people can discover it."
                  disabled={submitting}
                  className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              {/* Collaborators */}
              <Input
                value={collaborators}
                onChange={(event) => setCollaborators(event.target.value)}
                placeholder="Collaboration tags, comma separated usernames"
                disabled={submitting}
              />

              {/* Post Type Specific Fields */}
              {postType === "qa" && contentType === "post" && (
                <Input
                  value={questionPrompt}
                  onChange={(event) => setQuestionPrompt(event.target.value)}
                  placeholder="Ask a question to the community"
                  disabled={submitting}
                />
              )}

              {postType === "poll" && contentType === "post" && (
                <div className="space-y-3 rounded-xl border p-4">
                  <p className="text-sm font-medium">Poll Options</p>
                  {pollOptions.map((option, index) => (
                    <Input
                      key={index}
                      value={option}
                      onChange={(event) =>
                        setPollOptions((current) =>
                          current.map((currentOption, currentIndex) =>
                            currentIndex === index ? event.target.value : currentOption
                          )
                        )
                      }
                      placeholder={`Option ${index + 1}`}
                    />
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPollOptions((current) => [...current, ""])}
                  >
                    Add Option
                  </Button>
                </div>
              )}

              {/* Schedule */}
              <Input
                type="datetime-local"
                value={scheduledFor}
                onChange={(event) => setScheduledFor(event.target.value)}
                disabled={submitting}
              />

              {/* Visibility */}
              <div className="grid gap-3 md:grid-cols-2">
                <select value={visibility} onChange={(event) => setVisibility(event.target.value as "public" | "subscribers" | "premium_group")} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="public">Public</option>
                  <option value="subscribers">Subscribers only</option>
                  <option value="premium_group">Premium group only</option>
                </select>
                {visibility === "premium_group" && (
                  <select value={premiumGroupId} onChange={(event) => setPremiumGroupId(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                    <option value="">Choose premium group</option>
                    {premiumGroups.map((group) => (
                      <option key={group.id} value={group.id}>{group.name}</option>
                    ))}
                  </select>
                )}
              </div>

              {contentType === "reel" ? <details open className="rounded-xl border border-primary/25 p-4"><summary className="cursor-pointer font-semibold">Reel studio · Audio & editing</summary><div className="mt-4 space-y-4"><label className="block text-sm font-medium">Music or voice-over audio<input type="file" accept="audio/*" disabled={submitting} className="mt-2 block w-full text-xs" onChange={(event) => { const selected = event.target.files?.[0] ?? null; if (selected && selected.size > 20 * 1024 * 1024) { setError("Audio must be smaller than 20 MB."); event.target.value = ""; return; } setMusicFile(selected); setMusicTitle((current) => current || selected?.name.replace(/\.[^.]+$/, "") || ""); }} /></label>{musicFile ? <Input value={musicTitle} onChange={(event) => setMusicTitle(event.target.value)} maxLength={80} placeholder="Audio title" /> : null}<div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-medium">Video volume: {Math.round(originalVolume * 100)}%<input type="range" min="0" max="1" step="0.05" value={originalVolume} onChange={(event) => setOriginalVolume(Number(event.target.value))} className="mt-2 w-full" /></label><label className="text-xs font-medium">Music volume: {Math.round(musicVolume * 100)}%<input type="range" min="0" max="1" step="0.05" value={musicVolume} disabled={!musicFile} onChange={(event) => setMusicVolume(Number(event.target.value))} className="mt-2 w-full" /></label></div><div className="grid gap-3 sm:grid-cols-3"><label className="text-xs font-medium">Speed<select value={playbackRate} onChange={(event) => setPlaybackRate(Number(event.target.value))} className="mt-1 h-10 w-full rounded-md border bg-background px-2"><option value="0.5">0.5×</option><option value="0.75">0.75×</option><option value="1">1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option><option value="2">2×</option></select></label><label className="text-xs font-medium">Filter<select value={visualFilter} onChange={(event) => setVisualFilter(event.target.value as typeof visualFilter)} className="mt-1 h-10 w-full rounded-md border bg-background px-2"><option value="none">None</option><option value="warm">Warm</option><option value="cool">Cool</option><option value="mono">Mono</option><option value="vivid">Vivid</option></select></label><label className="text-xs font-medium">Rotation<select value={rotation} onChange={(event) => setRotation(Number(event.target.value) as typeof rotation)} className="mt-1 h-10 w-full rounded-md border bg-background px-2"><option value="0">0°</option><option value="90">90°</option><option value="180">180°</option><option value="270">270°</option></select></label></div><div className="grid gap-3 sm:grid-cols-[1fr,140px]"><Input value={overlayText} maxLength={120} onChange={(event) => setOverlayText(event.target.value)} placeholder="Text overlay" /><select value={overlayPosition} onChange={(event) => setOverlayPosition(event.target.value as typeof overlayPosition)} className="h-10 rounded-md border bg-background px-2 text-sm"><option value="top">Top</option><option value="center">Center</option><option value="bottom">Bottom</option></select></div><div><p className="mb-2 text-xs font-medium">Sticker</p><div className="flex gap-2">{["", "🔥", "❤️", "⭐", "💯", "🏆"].map((item) => <button key={item || "none"} type="button" onClick={() => setSticker(item)} className={`h-10 min-w-10 rounded-lg border px-2 text-xl ${sticker === item ? "border-primary bg-primary/10" : ""}`}>{item || "×"}</button>)}</div></div><p className="text-xs text-muted-foreground">Trim controls are available below. These edits stay reversible and are reproduced in the reel viewer.</p></div></details> : null}

              {contentType === "reel" ? <div className="space-y-3 rounded-xl border p-4"><p className="font-semibold">Comments and collaboration</p><div className="grid gap-2 sm:grid-cols-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={commentsEnabled} onChange={(event) => setCommentsEnabled(event.target.checked)} />Allow comments</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={allowRemix} onChange={(event) => setAllowRemix(event.target.checked)} />Allow remixes</label></div>{commentsEnabled ? <Input value={blockedCommentWords} onChange={(event) => setBlockedCommentWords(event.target.value)} placeholder="Blocked comment words, comma separated" /> : null}<p className="text-xs text-muted-foreground">Tagged collaborators appear with the reel. Remix permission controls whether others can create from it.</p></div> : null}

              {/* Advanced Options */}
              <details className="rounded-xl border p-4">
                <summary className="cursor-pointer font-semibold text-sm">Advanced Options</summary>
                <div className="mt-4 space-y-4">
                  <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                    <input type="checkbox" checked={sponsored} onChange={(event) => setSponsored(event.target.checked)} />
                    Mark as sponsored
                  </label>
                  {sponsored && (
                    <Input value={sponsorLabel} onChange={(event) => setSponsorLabel(event.target.value)} placeholder="Sponsor label" disabled={submitting} />
                  )}
                  <div className="grid gap-3 md:grid-cols-2">
                    <Input value={clipStartSec} onChange={(event) => setClipStartSec(event.target.value)} placeholder="Clip start (seconds)" disabled={submitting} />
                    <Input value={clipEndSec} onChange={(event) => setClipEndSec(event.target.value)} placeholder="Clip end (seconds)" disabled={submitting} />
                  </div>
                  <div className="grid gap-3 md:grid-cols-[1fr,auto]">
                    <Input value={autoCaption} onChange={(event) => setAutoCaption(event.target.value)} placeholder="Auto-caption text" disabled={submitting} />
                    <Button type="button" variant="outline" onClick={() => setAutoCaption(`${caption || file?.name || "Uploaded clip"}`)}>
                      Generate Caption
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={() => void runMediaAssist("caption_rewrite")} disabled={assistantLoading !== null}>
                      {assistantLoading === "caption_rewrite" ? "Rewriting..." : "AI Rewrite Caption"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => void runMediaAssist("hashtags")} disabled={assistantLoading !== null}>
                      {assistantLoading === "hashtags" ? "Suggesting..." : "AI Hashtags"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => void runMediaAssist("translate")} disabled={assistantLoading !== null}>
                      {assistantLoading === "translate" ? "Translating..." : "Translate Caption"}
                    </Button>
                  </div>
                  <textarea
                    value={translatedCaption}
                    onChange={(event) => setTranslatedCaption(event.target.value)}
                    placeholder="Translated caption"
                    disabled={submitting}
                    className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                  <Input
                    value={accessibilityLabel}
                    onChange={(event) => setAccessibilityLabel(event.target.value)}
                    placeholder="Screen-reader label for this media"
                    disabled={submitting}
                  />
                  <div className="grid gap-3 md:grid-cols-[1fr,auto]">
                    <textarea
                      value={aiHighlightAnalysis}
                      onChange={(event) => setAiHighlightAnalysis(event.target.value)}
                      placeholder="AI highlight analysis"
                      disabled={submitting}
                      className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={async () => {
                        const response = await fetch("/api/highlight-analysis", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ caption, contentType, autoCaption }),
                        });
                        const data = (await response.json()) as { analysis?: string };
                        setAiHighlightAnalysis(data.analysis || "No analysis returned.");
                      }}
                    >
                      Run AI Highlight Analysis
                    </Button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-[1fr,auto]">
                    <Input value={thumbnailHint} onChange={(event) => setThumbnailHint(event.target.value)} placeholder="Best thumbnail note" disabled={submitting} />
                    <Button type="button" variant="outline" onClick={() => void runMediaAssist("thumbnail")} disabled={assistantLoading !== null}>
                      {assistantLoading === "thumbnail" ? "Picking..." : "Best Thumbnail"}
                    </Button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-[1fr,auto]">
                    <textarea
                      value={voiceoverScript}
                      onChange={(event) => setVoiceoverScript(event.target.value)}
                      placeholder="Voiceover script for this clip"
                      disabled={submitting}
                      className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                    <Button type="button" variant="outline" onClick={() => void runMediaAssist("voiceover")} disabled={assistantLoading !== null}>
                      {assistantLoading === "voiceover" ? "Writing..." : "AI Voiceover"}
                    </Button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                      <input type="checkbox" checked={watermarkEnabled} onChange={(event) => setWatermarkEnabled(event.target.checked)} />
                      Watermark content
                    </label>
                    <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                      <input type="checkbox" checked={downloadProtected} onChange={(event) => setDownloadProtected(event.target.checked)} />
                      Hide download controls
                    </label>
                    <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                      <input type="checkbox" checked={rightClickProtected} onChange={(event) => setRightClickProtected(event.target.checked)} />
                      Block right click
                    </label>
                  </div>
                </div>
              </details>

              {remixPostId && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
                  Remixing post: {remixPostId}
                </div>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}
              {submitting ? <div role="progressbar" aria-label={`${contentType} upload progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={uploadProgress} className="rounded-xl border p-3"><div className="mb-2 flex justify-between text-xs"><span>Uploading {contentType}</span><span>{uploadProgress}%</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-[width]" style={{ width: `${uploadProgress}%` }} /></div><button type="button" className="mt-2 text-xs font-medium text-destructive" onClick={() => uploadAbortRef.current?.abort()}>Cancel upload</button></div> : null}

              {/* Action Buttons */}
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button type="submit" disabled={submitting} className="flex-1">
                  {submitting ? "Publishing..." : contentType === "reel" ? "Publish reel" : "Publish post"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    void saveUploadDraft({
                      caption,
                      contentType,
                      previewType: mediaKind ?? "unknown",
                      postType,
                      questionPrompt,
                      pollOptions,
                      collaborators: collaborators
                        .split(",")
                        .map((value) => value.trim())
                        .filter(Boolean),
                      remixPostId,
                      scheduledFor,
                      visibility,
                      premiumGroupId,
                      sponsored,
                      sponsorLabel,
                      autoCaption,
                      translatedCaption,
                      accessibilityLabel,
                      aiHighlightAnalysis,
                      voiceoverScript,
                      thumbnailHint,
                      clipStartSec: clipStartSec ? Number(clipStartSec) : undefined,
                      clipEndSec: clipEndSec ? Number(clipEndSec) : undefined,
                      watermarkEnabled,
                      downloadProtected,
                      rightClickProtected,
                    }).then(() => router.push("/drafts"))
                  }
                >
                  Save Draft
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link href={contentType === "reel" ? "/reels" : "/feed"}>Cancel</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  );
}

export default function UploadPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[70vh] items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" /></div>}>
      <AuthProvider>
        <UploadPageContent />
      </AuthProvider>
    </Suspense>
  );
}
