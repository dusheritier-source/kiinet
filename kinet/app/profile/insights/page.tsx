"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Eye, Repeat2, Users } from "lucide-react";
import { AuthProvider } from "@/components/AuthProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getProfileVisitInsights, type ProfileVisitInsight } from "@/lib/profile-insights";

function InsightsContent() {
  const [visits, setVisits] = useState<ProfileVisitInsight[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { void getProfileVisitInsights().then(setVisits).finally(() => setLoading(false)); }, []);
  const totalVisits = useMemo(() => visits.reduce((sum, visit) => sum + (visit.visitCount || 1), 0), [visits]);
  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" /></div>;
  return <ProtectedRoute><main className="mx-auto max-w-3xl space-y-6 px-4 py-8"><div><h1 className="text-3xl font-bold">Profile insights</h1><p className="text-muted-foreground">Understand how people discover and return to your profile.</p></div><div className="grid gap-3 sm:grid-cols-3"><Card><CardContent className="p-5"><Eye className="mb-2 h-5 w-5 text-primary" /><p className="text-2xl font-bold">{totalVisits}</p><p className="text-xs text-muted-foreground">Total profile views</p></CardContent></Card><Card><CardContent className="p-5"><Users className="mb-2 h-5 w-5 text-primary" /><p className="text-2xl font-bold">{visits.length}</p><p className="text-xs text-muted-foreground">Unique visitors</p></CardContent></Card><Card><CardContent className="p-5"><Repeat2 className="mb-2 h-5 w-5 text-primary" /><p className="text-2xl font-bold">{visits.filter((visit) => visit.visitCount > 1).length}</p><p className="text-xs text-muted-foreground">Returning visitors</p></CardContent></Card></div><Card><CardHeader><CardTitle>Recent visitors</CardTitle></CardHeader><CardContent className="space-y-2">{visits.length ? visits.map((visit) => <Link key={visit.id} href={`/profile/${visit.visitorUid}`} className="flex items-center gap-3 rounded-xl border p-3 hover:bg-muted/40"><Avatar><AvatarImage src={visit.visitor?.photoURL || ""} /><AvatarFallback>{visit.visitor?.displayName?.slice(0, 1) || "U"}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><p className="truncate font-medium">{visit.visitor?.displayName || "Kinet user"}</p><p className="truncate text-xs text-muted-foreground">@{visit.visitor?.username || visit.visitorUid.slice(0, 8)}</p></div><div className="text-right text-xs text-muted-foreground"><p>{visit.visitCount || 1} view{visit.visitCount === 1 ? "" : "s"}</p><p>{visit.lastVisitedAt?.seconds ? new Date(visit.lastVisitedAt.seconds * 1000).toLocaleDateString() : "Recently"}</p></div></Link>) : <p className="py-10 text-center text-sm text-muted-foreground">Your visitors will appear here.</p>}</CardContent></Card></main></ProtectedRoute>;
}

export default function ProfileInsightsPage() { return <AuthProvider><InsightsContent /></AuthProvider>; }
