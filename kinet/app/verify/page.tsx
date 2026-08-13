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

function VerifyPageContent() {
  const [emailStatus, setEmailStatus] = useState("");
  const [category, setCategory] = useState("athlete");
  const [details, setDetails] = useState("");
  const [requests, setRequests] = useState<Array<Record<string, unknown>>>([]);
  const [appeals, setAppeals] = useState<Array<Record<string, unknown>>>([]);
  const [appealRequestId, setAppealRequestId] = useState("");
  const [appealMessage, setAppealMessage] = useState("");

  useEffect(() => {
    void Promise.all([getVerificationRequests(), getVerificationAppeals()]).then(([nextRequests, nextAppeals]) => {
      setRequests(nextRequests);
      setAppeals(nextAppeals);
    });
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
                <select value={category} onChange={(event) => setCategory(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="athlete">Athlete</option>
                  <option value="coach">Coach</option>
                  <option value="scout">Scout</option>
                  <option value="organization">Organization</option>
                </select>
                <textarea value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Share school, club, achievements, links, or official context." className="min-h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                <Button type="submit" disabled={!details.trim()}>Submit request</Button>
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
