"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getProfileHighlight, type ProfileHighlight } from "@/lib/profile-highlights";
import type { StoryItem } from "@/lib/stories";

export default function HighlightViewerPage() {
  const { id } = useParams<{ id: string }>();
  const [highlight, setHighlight] = useState<ProfileHighlight | null>(null);
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (!id) return; void getProfileHighlight(id).then((result) => { if (result) { setHighlight(result.highlight); setStories(result.stories); } }).finally(() => setLoading(false)); }, [id]);
  useEffect(() => { const onKeyDown = (event: KeyboardEvent) => { if (event.key === "ArrowLeft") setIndex((value) => Math.max(0, value - 1)); if (event.key === "ArrowRight") setIndex((value) => Math.min(stories.length - 1, value + 1)); if (event.key === "Escape" && highlight) window.location.assign(`/profile/${highlight.userId}`); }; window.addEventListener("keydown", onKeyDown); return () => window.removeEventListener("keydown", onKeyDown); }, [highlight, stories.length]);
  const story = stories[index];
  if (loading) return <div className="flex min-h-screen items-center justify-center bg-black"><div className="h-10 w-10 animate-spin rounded-full border-b-2 border-white" /></div>;
  if (!highlight || !story) return <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black text-white"><p>This highlight is unavailable.</p><Button asChild variant="secondary"><Link href="/">Go home</Link></Button></div>;

  return <main aria-label={`${highlight.title} highlight viewer`} className="relative flex min-h-screen items-center justify-center bg-black text-white"><div className="absolute left-4 right-4 top-4 z-20 flex gap-1" role="progressbar" aria-valuemin={1} aria-valuemax={stories.length} aria-valuenow={index + 1}>{stories.map((item, itemIndex) => <div key={item.id} className={`h-1 flex-1 rounded ${itemIndex <= index ? "bg-white" : "bg-white/30"}`} />)}</div><div className="absolute left-4 top-8 z-20"><p className="font-semibold">{highlight.title}</p><p aria-live="polite" className="text-xs text-white/70">{index + 1} of {stories.length}</p></div><Button asChild size="icon" variant="ghost" className="absolute right-4 top-7 z-20 text-white hover:bg-white/20"><Link href={`/profile/${highlight.userId}`} aria-label="Close highlight"><X /></Link></Button>{story.mediaType === "video" ? <video key={story.id} src={story.mediaUrl} controls autoPlay playsInline className="max-h-screen max-w-full object-contain" /> : <img src={story.mediaUrl} alt={story.caption || highlight.title} className="max-h-screen max-w-full object-contain" />}{story.caption ? <p className="absolute bottom-10 max-w-xl rounded-full bg-black/60 px-5 py-2 text-center text-sm">{story.caption}</p> : null}<Button aria-label="Previous story" size="icon" variant="ghost" disabled={index === 0} onClick={() => setIndex((value) => value - 1)} className="absolute left-3 text-white hover:bg-white/20"><ChevronLeft /></Button><Button aria-label="Next story" size="icon" variant="ghost" disabled={index === stories.length - 1} onClick={() => setIndex((value) => value + 1)} className="absolute right-3 text-white hover:bg-white/20"><ChevronRight /></Button></main>;
}
