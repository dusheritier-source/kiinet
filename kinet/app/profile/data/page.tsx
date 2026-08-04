"use client";

import { useState } from "react";
import Link from "next/link";
import { Archive, Download, Eye } from "lucide-react";
import { AuthProvider, useAuthContext } from "@/components/AuthProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { downloadProfileArchive } from "@/lib/profile-export";

function ProfileDataContent() {
  const { user } = useAuthContext();
  const [status, setStatus] = useState("");
  return <ProtectedRoute><main className="mx-auto max-w-2xl space-y-6 px-4 py-8"><div><h1 className="text-3xl font-bold">Profile data</h1><p className="text-muted-foreground">Preview your public identity or keep a portable copy of your content.</p></div><Card><CardHeader><CardTitle className="flex items-center gap-2"><Eye className="h-5 w-5 text-primary" />Public preview</CardTitle><CardDescription>See the same profile presentation other signed-in people see.</CardDescription></CardHeader><CardContent><Button asChild><Link href={`/profile/${user?.uid || ""}`}>Preview my profile</Link></Button></CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2"><Archive className="h-5 w-5 text-primary" />Download archive</CardTitle><CardDescription>Export your profile, posts, stories, and highlights as a readable JSON file.</CardDescription></CardHeader><CardContent><Button onClick={() => { setStatus("Preparing your archive…"); void downloadProfileArchive().then(() => setStatus("Archive downloaded.")).catch((error) => setStatus(error instanceof Error ? error.message : "Export failed.")); }}><Download className="mr-2 h-4 w-4" />Download my data</Button>{status ? <p role="status" className="mt-3 text-sm text-muted-foreground">{status}</p> : null}</CardContent></Card></main></ProtectedRoute>;
}

export default function ProfileDataPage() { return <AuthProvider><ProfileDataContent /></AuthProvider>; }
