"use client";

import { useEffect, useState } from "react";
import { Check, Contact, Copy, Share2 } from "lucide-react";
import { AuthProvider, useAuthContext } from "@/components/AuthProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUserProfile, type SearchProfile } from "@/lib/user-profile";

function ShareProfileContent() {
  const { user } = useAuthContext();
  const [profile, setProfile] = useState<SearchProfile | null>(null);
  const [copied, setCopied] = useState("");
  useEffect(() => { if (user) void getCurrentUserProfile().then((data) => setProfile(data as SearchProfile | null)); }, [user]);
  if (!user || !profile) return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" /></div>;
  const url = typeof window === "undefined" ? "" : `${window.location.origin}/profile/${user.uid}`;
  const copy = async (value: string, key: string) => { await navigator.clipboard.writeText(value); setCopied(key); window.setTimeout(() => setCopied(""), 1500); };
  const downloadContact = () => { const safe = (value: string) => value.replace(/[\\,;]/g, "\\$&").replace(/\n/g, "\\n"); const card = [`BEGIN:VCARD`, `VERSION:3.0`, `FN:${safe(profile.displayName || "Kinet user")}`, `NICKNAME:${safe(profile.username || "")}`, profile.contactEmail ? `EMAIL:${safe(profile.contactEmail)}` : "", profile.website ? `URL:${safe(profile.website)}` : `URL:${safe(url)}`, `NOTE:${safe(profile.bio || `Follow me on Kinet: ${url}`)}`, `END:VCARD`].filter(Boolean).join("\r\n"); const anchor = document.createElement("a"); anchor.href = URL.createObjectURL(new Blob([card], { type: "text/vcard" })); anchor.download = `${profile.username || "kinet-profile"}.vcf`; anchor.click(); URL.revokeObjectURL(anchor.href); };
  return <ProtectedRoute><main className="mx-auto max-w-2xl space-y-6 px-4 py-8"><div><h1 className="text-3xl font-bold">Share your profile</h1><p className="text-muted-foreground">Help people find and save your Kinet identity.</p></div><Card className="overflow-hidden"><div className="h-28" style={{ backgroundImage: `linear-gradient(135deg, ${profile.accentColor || "#6366f1"}, #111827)` }} /><CardContent className="-mt-10 p-6"><Avatar className="h-20 w-20 border-4 border-background"><AvatarImage src={profile.photoURL || ""} /><AvatarFallback>{profile.displayName?.slice(0, 1) || "U"}</AvatarFallback></Avatar><h2 className="mt-3 text-2xl font-bold">{profile.displayName}</h2><p className="text-sm text-muted-foreground">@{profile.username}</p><p className="mt-3 text-sm">{profile.bio}</p></CardContent></Card><Card><CardHeader><CardTitle>Discovery tools</CardTitle></CardHeader><CardContent className="space-y-3"><Button className="w-full justify-start" onClick={() => void (navigator.share ? navigator.share({ title: `${profile.displayName} on Kinet`, text: profile.bio || "View my Kinet profile", url }) : copy(url, "link"))}><Share2 className="mr-2 h-4 w-4" />Share profile</Button><Button className="w-full justify-start" variant="outline" onClick={() => void copy(url, "link")}>{copied === "link" ? <Check className="mr-2 h-4 w-4 text-green-600" /> : <Copy className="mr-2 h-4 w-4" />}Copy profile link</Button><Button className="w-full justify-start" variant="outline" onClick={() => void copy(`@${profile.username}`, "username")}>{copied === "username" ? <Check className="mr-2 h-4 w-4 text-green-600" /> : <Copy className="mr-2 h-4 w-4" />}Copy username</Button><Button className="w-full justify-start" variant="outline" onClick={downloadContact}><Contact className="mr-2 h-4 w-4" />Download contact card</Button></CardContent></Card></main></ProtectedRoute>;
}

export default function ShareProfilePage() { return <AuthProvider><ShareProfileContent /></AuthProvider>; }
