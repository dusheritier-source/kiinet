"use client";

import { FormEvent, useEffect, useState } from "react";
import { sendEmailVerification } from "firebase/auth";

import { AuthProvider } from "@/components/AuthProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getVerificationAppeals,
  getVerificationRequests,
  submitVerificationAppeal,
  submitVerificationRequest,
} from "@/lib/recruiting";
import { getCurrentUserProfile } from "@/lib/user-profile";
import KinetVerifiedBadge from "@/components/KinetVerifiedBadge";

const MINIMUM_FOLLOWERS = 50;

function VerifyPageContent() {
  const [emailStatus, setEmailStatus] = useState("");
  const [category, setCategory] = useState("athlete");
  const [details, setDetails] = useState("");
  const [requests, setRequests] = useState<Array<Record<string, unknown>>>([]);
  const [appeals, setAppeals] = useState<Array<Record<string, unknown>>>([]);
  const [appealRequestId, setAppealRequestId] = useState("");
  const [appealMessage, setAppealMessage] = useState("");
  const [followerCount, setFollowerCount] = useState<number | null>(null);

  useEffect(() => {
    void Promise.all([getVerificationRequests(), getVerificationAppeals()]).then(([nextRequests, nextAppeals]) => {
      setRequests(nextRequests);
      setAppeals(nextAppeals);
    });
    void getCurrentUserProfile().then((profile) => setFollowerCount(Array.isArray(profile?.followers) ? profile.followers.length : 0));
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if ((followerCount ?? 0) < MINIMUM_FOLLOWERS) return;
    await submitVerificationRequest({ category, details });
    setDetails("");
    const [nextRequests, nextAppeals] = await Promise.all([getVerificationRequests(), getVerificationAppeals()]);
    setRequests(nextRequests);
    setAppeals(nextAppeals);
  };

  return (
    <ProtectedRoute>
      <div className="mx-auto max-w-4xl space-y-6 py-8">
        <div>
          <h1 className="text-3xl font-bold">Verification</h1>
          <p className="text-muted-foreground">Submit your role, achievements, and supporting context to request a verified badge.</p>
        </div>

        <Card className="overflow-hidden rounded-[28px_28px_28px_9px] border-white/15 bg-gradient-to-br from-white/10 to-transparent">
          <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[26px_26px_26px_8px] bg-slate-950"><KinetVerifiedBadge showLabel={false} /></div>
            <div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Kinet trust mark</p><h2 className="mt-1 text-xl font-bold">White Kinet Verification</h2><p className="mt-1 text-sm text-muted-foreground">Profiles with at least {MINIMUM_FOLLOWERS} followers can request review. Approval confirms authenticity—the follower count alone never creates the badge.</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-white transition-all" style={{ width: `${Math.min(100, ((followerCount ?? 0) / MINIMUM_FOLLOWERS) * 100)}%` }} /></div><p className="mt-2 text-xs font-medium">{followerCount === null ? "Checking eligibility…" : followerCount >= MINIMUM_FOLLOWERS ? `${followerCount} followers · Eligible for review` : `${followerCount}/${MINIMUM_FOLLOWERS} followers · ${MINIMUM_FOLLOWERS - followerCount} more needed`}</p></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Email verification</CardTitle><CardDescription>Confirm that you control the email address connected to this account.</CardDescription></CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <span className="text-sm">{auth.currentUser?.emailVerified ? "Email verified" : "Email not verified"}</span>
            {!auth.currentUser?.emailVerified ? <Button type="button" onClick={() => { if (!auth.currentUser) return; void sendEmailVerification(auth.currentUser).then(() => setEmailStatus("Verification email sent. Check your inbox and spam folder.")).catch(() => setEmailStatus("Could not send the verification email. Please try again shortly.")); }}>Send verification email</Button> : null}
            {emailStatus ? <p role="status" className="w-full text-sm text-muted-foreground">{emailStatus}</p> : null}
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-[0.95fr,1.05fr]">
          <Card>
            <CardHeader>
              <CardTitle>Request Review</CardTitle>
              <CardDescription>Share enough detail for admins to validate your identity or role.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={handleSubmit}>
                <select disabled={(followerCount ?? 0) < MINIMUM_FOLLOWERS} value={category} onChange={(event) => setCategory(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50">
                  <option value="athlete">Athlete</option>
                  <option value="coach">Coach</option>
                  <option value="scout">Scout</option>
                  <option value="organization">Organization</option>
                  <option value="creator">Creator</option>
                </select>
                <textarea disabled={(followerCount ?? 0) < MINIMUM_FOLLOWERS} value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Share school, club, achievements, links, or official context." className="min-h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50" />
                <Button type="submit" disabled={!details.trim() || (followerCount ?? 0) < MINIMUM_FOLLOWERS}>Submit request</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your Requests</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {requests.length === 0 ? (
                <div className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">No verification requests yet.</div>
              ) : (
                requests.map((request) => (
                  <div key={String(request.id)} className="rounded-xl border p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold capitalize">{String(request.category ?? "profile")}</p>
                      <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary capitalize">
                        {String(request.status ?? "pending")}
                      </span>
                    </div>
                    <p className="mt-2 text-sm">{String(request.details ?? "")}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-[0.95fr,1.05fr]">
          <Card>
            <CardHeader>
              <CardTitle>Appeal a Decision</CardTitle>
              <CardDescription>If a request was rejected, send additional context for one more review.</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-3"
                onSubmit={async (event) => {
                  event.preventDefault();
                  await submitVerificationAppeal({ requestId: appealRequestId, message: appealMessage });
                  setAppealMessage("");
                  setAppealRequestId("");
                  setAppeals(await getVerificationAppeals());
                }}
              >
                <select value={appealRequestId} onChange={(event) => setAppealRequestId(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">Choose rejected request</option>
                  {requests
                    .filter((request) => String(request.status ?? "") === "rejected")
                    .map((request) => (
                      <option key={String(request.id)} value={String(request.id)}>
                        {String(request.category ?? "profile")} request
                      </option>
                    ))}
                </select>
                <textarea value={appealMessage} onChange={(event) => setAppealMessage(event.target.value)} placeholder="Add missing context, links, achievements, or identity proof." className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                <Button type="submit" disabled={!appealRequestId || !appealMessage.trim()}>Submit appeal</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your Appeals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {appeals.length === 0 ? (
                <div className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">No appeals yet.</div>
              ) : (
                appeals.map((appeal) => (
                  <div key={String(appeal.id)} className="rounded-xl border p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">Appeal for {String(appeal.requestId)}</p>
                      <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary capitalize">
                        {String(appeal.status ?? "pending")}
                      </span>
                    </div>
                    <p className="mt-2 text-sm">{String(appeal.message ?? "")}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  );
}

export default function VerifyPage() {
  return (
    <AuthProvider>
      <VerifyPageContent />
    </AuthProvider>
  );
}
