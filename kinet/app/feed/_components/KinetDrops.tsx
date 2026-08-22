"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Sparkles, X } from "lucide-react";

import { useAuthContext } from "@/components/AuthProvider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { createNote, deleteNote, getActiveNotesForUser, subscribeToNotesForUsers, type NoteItem } from "@/lib/notes";
import { getProfilesByIds } from "@/lib/profile-social";
import { subscribeToUserProfile, type SearchProfile } from "@/lib/user-profile";

export default function KinetDrops({ userIds = [] }: { userIds?: string[] }) {
  const { user } = useAuthContext();
  const [following, setFollowing] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<SearchProfile[]>([]);
  const [drops, setDrops] = useState<Map<string, NoteItem>>(new Map());
  const [ownDrop, setOwnDrop] = useState<NoteItem | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [text, setText] = useState("");
  const [audience, setAudience] = useState<NoteItem["audience"]>("everyone");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    return subscribeToUserProfile(user.uid, (profile) => setFollowing(Array.isArray(profile?.following) ? (profile.following as string[]).slice(0, 30) : []));
  }, [user]);
  const dropUserIds = useMemo(() => Array.from(new Set([...following, ...userIds])).filter((uid) => uid && uid !== user?.uid).slice(0, 30), [following, user?.uid, userIds]);
  const dropUserIdsKey = dropUserIds.join("|");
  useEffect(() => { if (dropUserIds.length) void getProfilesByIds(dropUserIds).then(setProfiles); else setProfiles([]); }, [dropUserIdsKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!user || !dropUserIds.length) { setDrops(new Map()); return; } return subscribeToNotesForUsers(dropUserIds, user.uid, setDrops); }, [dropUserIdsKey, user]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!user) return; const refresh = () => void getActiveNotesForUser(user.uid, user.uid).then((items) => setOwnDrop(items[0] ?? null)); refresh(); window.addEventListener("kinet:drop-changed", refresh); return () => window.removeEventListener("kinet:drop-changed", refresh); }, [user]);

  const visible = useMemo(() => profiles.flatMap((profile) => { const drop = drops.get(profile.uid); return drop ? [{ profile, drop }] : []; }), [drops, profiles]);
  if (!user) return null;
  const submit = async (event: FormEvent) => { event.preventDefault(); if (!text.trim()) return; setSaving(true); try { if (ownDrop) await deleteNote(ownDrop.id); await createNote(text, audience); setText(""); setComposerOpen(false); window.dispatchEvent(new Event("kinet:drop-changed")); } finally { setSaving(false); } };

  return <section aria-label="Kinet Drops" className="mx-auto max-w-2xl px-2 py-3 sm:px-4">
    <div className="mb-2 flex items-center justify-between"><h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"><Sparkles className="h-4 w-4 text-primary" />Kinet Drops</h2><span className="text-[11px] text-muted-foreground">Disappear after 24h</span></div>
    <div className="scrollbar-hide flex gap-3 overflow-x-auto pb-2">
      <button type="button" onClick={() => setComposerOpen(true)} className="group w-28 shrink-0 text-left"><span className="relative block min-h-16 rounded-[22px_22px_22px_7px] border border-dashed border-primary/50 bg-primary/5 p-3 text-xs text-muted-foreground transition group-hover:bg-primary/10">{ownDrop ? <span className="line-clamp-2 text-foreground">{ownDrop.text}</span> : "Share a quick thought"}<Plus className="absolute -bottom-2 -right-1 h-6 w-6 rounded-full bg-primary p-1 text-primary-foreground" /></span><span className="mt-2 block truncate text-center text-[11px] font-medium">Your Drop</span></button>
      {visible.map(({ profile, drop }) => <Link key={drop.id} href={`/profile/${profile.uid}`} className="group w-28 shrink-0"><span className="relative block min-h-16 rounded-[22px_22px_22px_7px] border bg-card p-3 text-xs leading-5 shadow-sm transition group-hover:-translate-y-0.5 group-hover:border-primary/40"><span className="line-clamp-2">{drop.text}</span><Avatar className="absolute -bottom-3 -right-1 h-7 w-7 border-2 border-background"><AvatarImage src={profile.photoURL} alt="" /><AvatarFallback>{profile.displayName?.slice(0, 1) || "K"}</AvatarFallback></Avatar></span><span className="mt-3 block truncate text-center text-[11px] font-medium">{profile.displayName}</span></Link>)}
    </div>
    {composerOpen ? <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"><form onSubmit={submit} className="w-full max-w-md rounded-[30px_30px_30px_10px] border bg-card p-5 shadow-2xl"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">New Kinet Drop</p><h3 className="mt-1 text-xl font-bold">What’s on your mind?</h3></div><Button type="button" size="icon" variant="ghost" onClick={() => setComposerOpen(false)}><X className="h-5 w-5" /></Button></div><textarea autoFocus value={text} onChange={(event) => setText(event.target.value)} maxLength={60} placeholder="A thought, mood, question…" className="mt-5 min-h-28 w-full resize-none rounded-2xl border bg-background p-4 text-lg outline-none focus:ring-2 focus:ring-primary" /><div className="mt-2 flex items-center justify-between text-xs text-muted-foreground"><select value={audience} onChange={(event) => setAudience(event.target.value as NoteItem["audience"])} className="h-9 rounded-full border bg-background px-3"><option value="everyone">Everyone</option><option value="following">People who follow you</option></select><span>{text.length}/60</span></div><Button className="mt-4 w-full rounded-full" disabled={saving || !text.trim()}>{saving ? "Dropping…" : ownDrop ? "Replace Drop" : "Share Drop"}</Button></form></div> : null}
  </section>;
}
