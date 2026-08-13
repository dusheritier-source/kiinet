"use client";

import { useState } from "react";
import Link from "next/link";
import { Archive, Download, Eye, Trash2 } from "lucide-react";
import { AuthProvider, useAuthContext } from "@/components/AuthProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { downloadProfileArchive } from "@/lib/profile-export";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

function ProfileDataContent() {
  const { user } = useAuthContext();
  const [status, setStatus] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const deleteAccount = async () => {
    if (confirmation !== "DELETE KINET ACCOUNT") return;
    setStatus("Deleting your account…");
    const response = await authenticatedFetch("/api/account", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation }),
    });
    const result = await response.json() as { error?: string };
    if (!response.ok) throw new Error(result.error || "Account deletion failed.");
    await signOut(auth);
    window.location.assign("/");
  };
  return <ProtectedRoute><main className="mx-auto max-w-2xl space-y-6 px-4 py-8"><div><h1 className="text-3xl font-bold">Profile data</h1><p className="text-muted-foreground">Preview your public identity or keep a portable copy of your content.</p></div><Card><CardHeader><CardTitle className="flex items-center gap-2"><Eye className="h-5 w-5 text-primary" />Public preview</CardTitle><CardDescription>See the same profile presentation other signed-in people see.</CardDescription></CardHeader><CardContent><Button asChild><Link href={`/profile/${user?.uid || ""}`}>Preview my profile</Link></Button></CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2"><Archive className="h-5 w-5 text-primary" />Download archive</CardTitle><CardDescription>Export your profile, posts, stories, and highlights as a readable JSON file.</CardDescription></CardHeader><CardContent><Button onClick={() => { setStatus("Preparing your archive…"); void downloadProfileArchive().then(() => setStatus("Archive downloaded.")).catch((error) => setStatus(error instanceof Error ? error.message : "Export failed.")); }}><Download className="mr-2 h-4 w-4" />Download my data</Button>{status ? <p role="status" className="mt-3 text-sm text-muted-foreground">{status}</p> : null}</CardContent></Card><Card className="border-destructive/50"><CardHeader><CardTitle className="flex items-center gap-2 text-destructive"><Trash2 className="h-5 w-5" />Delete account</CardTitle><CardDescription>Permanently delete your Kinet profile and owned content. Download your archive first. This cannot be undone.</CardDescription></CardHeader><CardContent className="space-y-3"><label className="block text-sm">Type <strong>DELETE KINET ACCOUNT</strong> to confirm.</label><input className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /><Button variant="destructive" disabled={confirmation !== "DELETE KINET ACCOUNT"} onClick={() => void deleteAccount().catch((error) => setStatus(error instanceof Error ? error.message : "Account deletion failed."))}>Delete my account permanently</Button></CardContent></Card></main></ProtectedRoute>;
}

export default function ProfileDataPage() { return <AuthProvider><ProfileDataContent /></AuthProvider>; }
