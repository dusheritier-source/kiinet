"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Archive, ChevronLeft, ChevronRight, Plus, RotateCcw, Trash2 } from "lucide-react";
import { AuthProvider, useAuthContext } from "@/components/AuthProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createProfileHighlight, deleteProfileHighlight, getProfileStories, moveProfileHighlight, renameProfileHighlight, subscribeToProfileHighlights, updateProfileHighlightCover, updateProfileHighlightStories, type ProfileHighlight } from "@/lib/profile-highlights";
import { restoreArchivedStory, type StoryItem } from "@/lib/stories";

function ArchiveContent() {
  const { user } = useAuthContext();
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [highlights, setHighlights] = useState<ProfileHighlight[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [coverStoryId, setCoverStoryId] = useState("");
  const [status, setStatus] = useState("");

  const refresh = async () => { if (user) setStories(await getProfileStories(user.uid)); };
  useEffect(() => {
    if (!user) return;
    void refresh();
    return subscribeToProfileHighlights(user.uid, setHighlights);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const grouped = useMemo(() => stories.reduce<Record<string, StoryItem[]>>((groups, story) => {
    const date = story.createdAt?.seconds ? new Date(story.createdAt.seconds * 1000) : new Date();
    const key = date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    groups[key] = [...(groups[key] ?? []), story];
    return groups;
  }, {}), [stories]);
  const chosenStories = stories.filter((story) => selected.includes(story.id));
  const coverStory = stories.find((story) => story.id === coverStoryId) ?? chosenStories[0];

  return <ProtectedRoute><main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
    <header className="flex items-start justify-between gap-3"><div><h1 className="flex items-center gap-2 text-3xl font-bold"><Archive className="h-7 w-7" />Story archive</h1><p className="mt-1 text-sm text-muted-foreground">Only you can manage this archive. Restore stories or keep them on your profile as highlights.</p></div><Button asChild variant="outline"><Link href="/stories">Back to stories</Link></Button></header>

    <Card><CardHeader><CardTitle>Create highlight</CardTitle></CardHeader><CardContent className="space-y-3"><Input value={title} maxLength={30} onChange={(event) => setTitle(event.target.value)} placeholder="Highlight name" />{chosenStories.length ? <div><p className="mb-2 text-sm font-medium">Choose a cover</p><div className="flex gap-2 overflow-x-auto">{chosenStories.map((story) => <button type="button" key={story.id} onClick={() => setCoverStoryId(story.id)} className={`shrink-0 rounded-xl border-2 p-1 ${coverStory?.id === story.id ? "border-primary" : "border-transparent"}`}><img src={story.mediaUrl} alt="Highlight cover option" className="h-16 w-16 rounded-lg object-cover" /></button>)}</div></div> : null}<Button disabled={!chosenStories.length} onClick={() => void createProfileHighlight(title, chosenStories, highlights.length, coverStory?.mediaUrl).then(() => { setTitle(""); setSelected([]); setCoverStoryId(""); setStatus("Highlight created."); })}><Plus className="mr-2 h-4 w-4" />Create from {chosenStories.length} selected</Button></CardContent></Card>

    {Object.entries(grouped).map(([month, items]) => <section key={month}><h2 className="mb-3 text-lg font-semibold">{month}</h2><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">{items.map((story) => { const archived = (story.expiresAt?.seconds ?? 0) * 1000 <= Date.now(); return <article key={story.id} className={`overflow-hidden rounded-2xl border ${selected.includes(story.id) ? "ring-2 ring-primary" : ""}`}><button type="button" onClick={() => setSelected((ids) => ids.includes(story.id) ? ids.filter((id) => id !== story.id) : [...ids, story.id])} className="relative block aspect-[9/12] w-full bg-black">{story.mediaType === "video" ? <video src={story.mediaUrl} muted preload="metadata" className="h-full w-full object-cover" /> : <img src={story.mediaUrl} alt={story.caption || "Archived story"} loading="lazy" className="h-full w-full object-cover" />}<span className="absolute left-2 top-2 rounded-full bg-black/65 px-2 py-1 text-[11px] text-white">{archived ? "Archived" : "Active"}</span></button><div className="space-y-2 p-3"><p className="line-clamp-2 text-sm">{story.caption || "No caption"}</p>{archived ? <Button size="sm" variant="outline" className="w-full" onClick={() => void restoreArchivedStory(story).then(() => { void refresh(); setStatus("Story restored for 24 hours."); })}><RotateCcw className="mr-1 h-3.5 w-3.5" />Restore</Button> : null}</div></article>; })}</div></section>)}

    <Card><CardHeader><CardTitle>Manage highlights</CardTitle></CardHeader><CardContent><div className="space-y-4">{highlights.map((highlight, index) => <div key={highlight.id} className="rounded-2xl border p-4"><div className="flex items-center gap-3"><img src={highlight.coverUrl} alt={highlight.title} className="h-16 w-16 rounded-full object-cover" /><div className="min-w-0 flex-1"><p className="truncate font-semibold">{highlight.title}</p><p className="text-xs text-muted-foreground">{highlight.storyIds.length} stories</p></div><button aria-label="Move highlight left" disabled={index === 0} onClick={() => void moveProfileHighlight(highlights, highlight.id, -1)}><ChevronLeft className="h-5 w-5" /></button><button aria-label="Move highlight right" disabled={index === highlights.length - 1} onClick={() => void moveProfileHighlight(highlights, highlight.id, 1)}><ChevronRight className="h-5 w-5" /></button><button aria-label="Delete highlight" onClick={() => { if (window.confirm("Delete this highlight? Archived stories will be kept.")) void deleteProfileHighlight(highlight.id); }}><Trash2 className="h-4 w-4 text-destructive" /></button></div><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => { const next = window.prompt("Rename highlight", highlight.title); if (next?.trim()) void renameProfileHighlight(highlight.id, next); }}>Rename</Button><Button size="sm" variant="outline" disabled={!selected.length} onClick={() => { const nextIds = Array.from(new Set([...highlight.storyIds, ...selected])); void updateProfileHighlightStories(highlight.id, nextIds).then(() => setStatus("Stories added to highlight.")); }}>Add selected</Button>{highlight.storyIds.map((storyId) => { const story = stories.find((item) => item.id === storyId); return story ? <button key={storyId} type="button" title="Click to use as cover" onClick={() => void updateProfileHighlightCover(highlight.id, story.mediaUrl)} className="group relative"><img src={story.mediaUrl} alt="Highlight story" className="h-10 w-10 rounded-lg object-cover" /><span className="absolute inset-0 hidden items-center justify-center rounded-lg bg-black/60 text-[9px] text-white group-hover:flex">Cover</span><span onClick={(event) => { event.stopPropagation(); const remaining = highlight.storyIds.filter((id) => id !== storyId); if (!remaining.length) { setStatus("A highlight must keep at least one story."); return; } void updateProfileHighlightStories(highlight.id, remaining, highlight.coverUrl === story.mediaUrl ? stories.find((item) => item.id === remaining[0])?.mediaUrl : undefined).then(() => setStatus("Story removed from highlight; archive kept.")); }} className="absolute -right-1 -top-1 rounded-full bg-destructive px-1 text-[9px] text-white">×</span></button> : null; })}</div></div>)}{!highlights.length ? <p className="text-sm text-muted-foreground">No highlights yet.</p> : null}</div>{status ? <p role="status" className="mt-4 text-sm text-primary">{status}</p> : null}</CardContent></Card>
  </main></ProtectedRoute>;
}

export default function StoryArchivePage() { return <AuthProvider><ArchiveContent /></AuthProvider>; }
