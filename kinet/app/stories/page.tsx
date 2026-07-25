"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { AuthProvider, useAuthContext } from "@/components/AuthProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createOrGetConversation, sendConversationMessage } from "@/lib/messaging";
import { createStory, formatStoryTime, getActiveStories, markStorySeen, type StoryItem } from "@/lib/stories";

const STORY_DURATION_MS = 5000;

function StoriesPageContent() {
  const { user } = useAuthContext();
  const searchParams = useSearchParams();
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [saving, setSaving] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [replyText, setReplyText] = useState("");

  useEffect(() => {
    void getActiveStories().then(setStories);
  }, []);

  useEffect(() => {
    const storyId = searchParams.get("story");
    if (!storyId || stories.length === 0) {
      return;
    }

    const foundIndex = stories.findIndex((story) => story.id === storyId);
    if (foundIndex >= 0) {
      setActiveIndex(foundIndex);
    }
  }, [searchParams, stories]);

  const activeStory = stories[activeIndex] ?? null;
  const storyCreators = useMemo(() => {
    const uniqueStories = new Map<string, StoryItem>();

    stories.forEach((story) => {
      if (!uniqueStories.has(story.userId)) {
        uniqueStories.set(story.userId, story);
      }
    });

    return Array.from(uniqueStories.values());
  }, [stories]);
  const groupedCount = useMemo(
    () => stories.filter((story) => story.userId === activeStory?.userId).length,
    [activeStory?.userId, stories]
  );

  useEffect(() => {
    if (!activeStory) {
      return;
    }

    void markStorySeen(activeStory.id);
    setProgress(0);

    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      const nextProgress = Math.min(((Date.now() - startedAt) / STORY_DURATION_MS) * 100, 100);
      setProgress(nextProgress);

      if (nextProgress >= 100) {
        setActiveIndex((current) => (current + 1 < stories.length ? current + 1 : current));
      }
    }, 100);

    return () => window.clearInterval(interval);
  }, [activeStory?.id, stories.length]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) {
      return;
    }

    setSaving(true);
    try {
      await createStory(file, caption);
      setCaption("");
      setFile(null);
      setStories(await getActiveStories());
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-6 md:py-8">
        <div>
          <h1 className="text-3xl font-bold">Stories</h1>
          <p className="text-muted-foreground">Post 24-hour updates with a tap-through viewer, circle rail, and story replies.</p>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-2">
          <button
            type="button"
            onClick={() => setActiveIndex(0)}
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
            </div>
            <span className="max-w-[84px] truncate text-center text-xs font-medium">Your story</span>
          </button>

          {storyCreators.map((story) => (
            <button
              key={story.id}
              type="button"
              onClick={() => {
                const storyIndex = stories.findIndex((candidate) => candidate.id === story.id);
                if (storyIndex >= 0) {
                  setActiveIndex(storyIndex);
                }
              }}
              className="flex min-w-[84px] flex-col items-center gap-2"
            >
              <div className="rounded-full bg-gradient-to-br from-fuchsia-500 via-rose-500 to-amber-400 p-[2px]">
                <div className="rounded-full bg-background p-[2px]">
                  <img
                    src={story.authorAvatar || "https://placehold.co/80x80?text=S"}
                    alt={story.authorName}
                    className={`h-[70px] w-[70px] rounded-full object-cover ${story.seenBy?.includes(user?.uid || "") ? "opacity-75" : ""}`}
                  />
                </div>
              </div>
              <div className="text-center">
                <span className="block max-w-[84px] truncate text-xs font-medium">{story.authorName}</span>
                <span className="text-[11px] text-muted-foreground">{formatStoryTime(story.createdAt)}</span>
              </div>
            </button>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.9fr,1.1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Create Story</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={handleSubmit}>
                <input type="file" accept="image/*,video/*" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
                <textarea value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Add a quick caption" className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                <Button type="submit" disabled={saving || !file}>{saving ? "Posting..." : "Post story"}</Button>
              </form>
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-[28px]">
            <CardContent className="p-0">
              {!activeStory ? (
                <div className="flex aspect-[9/16] items-center justify-center bg-muted p-6 text-sm text-muted-foreground">
                  No active stories yet.
                </div>
              ) : (
                <div className="relative aspect-[9/16] bg-black">
                  <div className="absolute left-0 right-0 top-0 z-10 flex gap-1 p-3">
                    {stories.map((story, index) => (
                      <div key={story.id} className="h-1 flex-1 rounded-full bg-white/20">
                        <div
                          className="h-full rounded-full bg-white transition-all"
                          style={{
                            width:
                              index < activeIndex
                                ? "100%"
                                : index === activeIndex
                                  ? `${progress}%`
                                  : "0%",
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  {activeStory.mediaType === "video" ? (
                    <video
                      src={activeStory.mediaUrl}
                      controls
                      autoPlay
                      muted
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <img src={activeStory.mediaUrl} alt={activeStory.caption || "Story"} className="h-full w-full object-cover" />
                  )}
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
                      <div className="mt-3 flex gap-2">
                        <input
                          value={replyText}
                          onChange={(event) => setReplyText(event.target.value)}
                          placeholder="Reply to this story"
                          className="h-10 w-full rounded-md border border-white/20 bg-black/30 px-3 text-sm text-white placeholder:text-white/60"
                        />
                        <Button
                          type="button"
                          size="sm"
                          onClick={async () => {
                            const conversationId = await createOrGetConversation(activeStory.userId);
                            await sendConversationMessage(
                              conversationId,
                              `Story reply: ${replyText || activeStory.caption || "Reacted to your story."}`
                            );
                            setReplyText("");
                          }}
                        >
                          Reply
                        </Button>
                      </div>
                    ) : null}
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
              onClick={() => setActiveIndex(index)}
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
