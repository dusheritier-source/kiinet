"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";

import { useAuthContext } from "@/components/AuthProvider";
import { getActiveStories, type StoryItem } from "@/lib/stories";

export default function FeedStories() {
  const { user } = useAuthContext();
  const router = useRouter();
  const [stories, setStories] = useState<StoryItem[]>([]);

  useEffect(() => {
    if (!user) return;
    void getActiveStories().then(setStories).catch(() => setStories([]));
  }, [user]);

  const creators = useMemo(() => {
    const seen = new Set<string>();
    return stories.filter((story) => {
      if (seen.has(story.userId)) return false;
      seen.add(story.userId);
      return true;
    });
  }, [stories]);

  if (!user) return null;

  const openStory = (storyId: string) => {
    window.dispatchEvent(new CustomEvent("open-stories", { detail: { storyId } }));
  };

  return <section aria-label="Stories" className="mx-auto max-w-2xl overflow-hidden border-b px-2 py-3 sm:px-4">
    <div className="scrollbar-hide flex gap-4 overflow-x-auto">
      <button type="button" onClick={() => { router.push("/stories?create=1"); }} className="w-16 shrink-0 text-center">
        <span className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-primary bg-muted"><Plus className="h-6 w-6 text-primary" /></span>
        <span className="mt-1 block truncate text-[11px]">Your story</span>
      </button>
      {creators.map((story) => <button key={story.userId} type="button" onClick={() => openStory(story.id)} className="w-16 shrink-0 text-center">
        <span className="mx-auto block rounded-full bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600 p-[2px]"><span className="block rounded-full bg-background p-[2px]"><img src={story.authorAvatar || story.thumbnailUrl || story.mediaUrl} alt={`${story.authorName}'s story`} className="h-12 w-12 rounded-full object-cover" /></span></span>
        <span className="mt-1 block truncate text-[11px]">{story.userId === user.uid ? "Your story" : story.authorName}</span>
      </button>)}
    </div>
  </section>;
}
