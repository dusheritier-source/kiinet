"use client";

import { ChangeEvent, FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Film, Image as ImageIcon, UploadCloud, Video } from "lucide-react";

import { AuthProvider, useAuthContext } from "@/components/AuthProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getOwnedPremiumGroups, type PremiumGroupRecord } from "@/lib/creator-hub";
import { deleteUploadDraft, getUploadDrafts, saveUploadDraft } from "@/lib/drafts";
import { createPost } from "@/lib/posts";

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
  const [previewUrl, setPreviewUrl] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [assistantLoading, setAssistantLoading] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [loadedDraftId, setLoadedDraftId] = useState<string | null>(null);

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
    if (initialCaption && !caption) {
      setCaption(initialCaption);
    }
    if (remixId && !remixPostId) {
      setRemixPostId(remixId);
      setCaption((current) => current || `Remix on @creator #remix`);
    }
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
  }, [caption, loadedDraftId, remixPostId, searchParams]);

  const mediaKind = useMemo(() => {
    if (!file) return null;
    return file.type.startsWith("video/") ? "video" : "image";
  }, [file]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    setError("");
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

    try {
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
      });
      if (loadedDraftId) {
        await deleteUploadDraft(loadedDraftId);
      }
      router.push(contentType === "reel" ? "/reels" : "/feed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Your upload could not be published.");
    } finally {
      setSubmitting(false);
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
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UploadCloud className="h-5 w-5 text-primary" />
              Create content
            </CardTitle>
            <CardDescription>
              Publish a standard post or a reel using the same media pipeline.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setContentType("post")}
                  className={`rounded-xl border p-4 text-left ${contentType === "post" ? "border-primary bg-primary/5" : ""}`}
                >
                  <ImageIcon className="mb-2 h-5 w-5 text-primary" />
                  <p className="font-semibold">Post</p>
                  <p className="text-sm text-muted-foreground">Photos or videos in the main feed.</p>
                </button>
                <button
                  type="button"
                  onClick={() => setContentType("reel")}
                  className={`rounded-xl border p-4 text-left ${contentType === "reel" ? "border-primary bg-primary/5" : ""}`}
                >
                  <Film className="mb-2 h-5 w-5 text-primary" />
                  <p className="font-semibold">Reel</p>
                  <p className="text-sm text-muted-foreground">Vertical video for the reels feed.</p>
                </button>
              </div>

              {contentType === "post" ? (
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
                      className={`rounded-xl border p-4 text-left ${postType === option.value ? "border-primary bg-primary/5" : ""}`}
                    >
                      <p className="font-semibold">{option.label}</p>
                      <p className="text-sm text-muted-foreground">{option.hint}</p>
                    </button>
                  ))}
                </div>
              ) : null}

              <Input
                type="file"
                accept={contentType === "reel" ? "video/*" : "image/*,video/*"}
                onChange={handleFileChange}
                disabled={submitting}
              />

              {previewUrl ? (
                <div className="overflow-hidden rounded-xl border bg-muted">
                  {mediaKind === "video" ? (
                    <video src={previewUrl} controls className="max-h-[420px] w-full bg-black object-cover" />
                  ) : (
                    <img src={previewUrl} alt="Upload preview" className="max-h-[420px] w-full object-cover" />
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed p-8 text-center">
                  {contentType === "reel" ? (
                    <Video className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                  ) : (
                    <ImageIcon className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                  )}
                  <p className="font-medium">
                    {contentType === "reel" ? "Choose a video for your reel." : "Choose media for your post."}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Use hashtags in the caption like `#travel` to appear in topic feeds.
                  </p>
                </div>
              )}

              {postType === "qa" && contentType === "post" ? (
                <Input
                  value={questionPrompt}
                  onChange={(event) => setQuestionPrompt(event.target.value)}
                  placeholder="Ask a question to the community"
                  disabled={submitting}
                />
              ) : null}

              {postType === "poll" && contentType === "post" ? (
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
              ) : null}

              <textarea
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                placeholder="What's on your mind? Add #tags so people can discover it."
                disabled={submitting}
                className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />

              <Input
                value={collaborators}
                onChange={(event) => setCollaborators(event.target.value)}
                placeholder="Collaboration tags, comma separated usernames"
                disabled={submitting}
              />

              <Input
                type="datetime-local"
                value={scheduledFor}
                onChange={(event) => setScheduledFor(event.target.value)}
                disabled={submitting}
              />
              <div className="grid gap-3 md:grid-cols-2">
                <select value={visibility} onChange={(event) => setVisibility(event.target.value as "public" | "subscribers" | "premium_group")} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="public">Public</option>
                  <option value="subscribers">Subscribers only</option>
                  <option value="premium_group">Premium group only</option>
                </select>
                {visibility === "premium_group" ? (
                  <select value={premiumGroupId} onChange={(event) => setPremiumGroupId(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                    <option value="">Choose premium group</option>
                    {premiumGroups.map((group) => (
                      <option key={group.id} value={group.id}>{group.name}</option>
                    ))}
                  </select>
                ) : null}
              </div>
              <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <input type="checkbox" checked={sponsored} onChange={(event) => setSponsored(event.target.checked)} />
                Mark as sponsored
              </label>
              {sponsored ? (
                <Input value={sponsorLabel} onChange={(event) => setSponsorLabel(event.target.value)} placeholder="Sponsor label" disabled={submitting} />
              ) : null}
              <div className="grid gap-3 md:grid-cols-2">
                <Input value={clipStartSec} onChange={(event) => setClipStartSec(event.target.value)} placeholder="Clip start (seconds)" disabled={submitting} />
                <Input value={clipEndSec} onChange={(event) => setClipEndSec(event.target.value)} placeholder="Clip end (seconds)" disabled={submitting} />
              </div>
              <div className="grid gap-3 md:grid-cols-[1fr,auto]">
                <Input value={autoCaption} onChange={(event) => setAutoCaption(event.target.value)} placeholder="Auto-caption text" disabled={submitting} />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAutoCaption(`${caption || file?.name || "Uploaded clip"}`)}
                >
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
              {remixPostId ? (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
                  Remixing post: {remixPostId}
                </div>
              ) : null}

              {error ? <p className="text-sm text-destructive">{error}</p> : null}

              <div className="flex gap-3">
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