"use client";

import { useEffect, useState } from "react";

import { AuthProvider, useAuthContext } from "@/components/AuthProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { escalateReport, reviewReport, subscribeToAllReports, type ReportRecord } from "@/lib/moderation";
import { useAdminClaim } from "@/hooks/useAdminClaim";
import {
  createShadowBanCase,
  reviewBanAppeal,
  reviewShadowBanCase,
  subscribeToBanAppeals,
  subscribeToShadowBanCases,
  type BanAppealRecord,
  type ShadowBanCaseRecord,
} from "@/lib/phase8";
import { formatTimeAgo } from "@/lib/posts";
import {
  reviewVerificationAppeal,
  reviewVerificationRequest,
  subscribeToAllVerificationRequests,
  subscribeToVerificationAppeals,
  type VerificationAppealRecord,
  type VerificationRequestRecord,
} from "@/lib/recruiting";

function getSlaLabel(createdAt?: { seconds?: number; nanoseconds?: number } | null) {
  if (!createdAt?.seconds) {
    return "SLA pending";
  }

  const createdMs = createdAt.seconds * 1000;
  const elapsedHours = (Date.now() - createdMs) / (1000 * 60 * 60);
  const remainingHours = 48 - elapsedHours;

  if (remainingHours <= 0) {
    return `SLA overdue by ${Math.abs(Math.round(remainingHours))}h`;
  }

  return `SLA due in ${Math.round(remainingHours)}h`;
}

function ModerationPageContent() {
  const { user } = useAuthContext();
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [verificationRequests, setVerificationRequests] = useState<VerificationRequestRecord[]>([]);
  const [verificationAppeals, setVerificationAppeals] = useState<VerificationAppealRecord[]>([]);
  const [banAppeals, setBanAppeals] = useState<BanAppealRecord[]>([]);
  const [shadowBanCases, setShadowBanCases] = useState<ShadowBanCaseRecord[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const { isAdmin } = useAdminClaim();

  useEffect(() => {
    if (!user || !isAdmin) {
      return;
    }

    return subscribeToAllReports(setReports);
  }, [user, isAdmin]);

  useEffect(() => {
    if (!user || !isAdmin) {
      return;
    }

    return subscribeToAllVerificationRequests(setVerificationRequests);
  }, [user, isAdmin]);

  useEffect(() => {
    if (!user || !isAdmin) {
      return;
    }

    return subscribeToVerificationAppeals(setVerificationAppeals);
  }, [user, isAdmin]);

  useEffect(() => {
    if (!user || !isAdmin) {
      return;
    }

    const unsubscribeAppeals = subscribeToBanAppeals(setBanAppeals);
    const unsubscribeShadowCases = subscribeToShadowBanCases(setShadowBanCases);
    return () => {
      unsubscribeAppeals();
      unsubscribeShadowCases();
    };
  }, [user, isAdmin]);

  if (!user) {
    return null;
  }

  if (!isAdmin) {
    return (
      <ProtectedRoute>
        <div className="mx-auto max-w-2xl py-8">
          <Card>
            <CardHeader>
              <CardTitle>Moderation</CardTitle>
              <CardDescription>This workspace is configured for admin-only moderation review.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Ask an administrator to grant the Firebase <code>admin</code> or <code>moderator</code> custom claim.
              </p>
            </CardContent>
          </Card>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="mx-auto max-w-5xl space-y-6 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Verification Review</CardTitle>
            <CardDescription>Approve or reject badge requests from athletes, coaches, scouts, and organizations.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {verificationRequests.length === 0 ? (
              <div className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">No verification requests yet.</div>
            ) : (
              verificationRequests.map((request) => (
                <div key={request.id} className="rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium capitalize">{request.category} verification</p>
                      <p className="text-sm text-muted-foreground">User: {request.userId}</p>
                      <p className="mt-2 text-sm">{request.details}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {formatTimeAgo(request.createdAt)} • Status: {request.status}
                      </p>
                      {request.reviewNote ? (
                        <p className="mt-2 text-sm text-muted-foreground">Review note: {request.reviewNote}</p>
                      ) : null}
                    </div>
                    <div className="w-full max-w-xs space-y-2">
                      <textarea
                        value={notes[`verification-${request.id}`] ?? ""}
                        onChange={(event) =>
                          setNotes((current) => ({
                            ...current,
                            [`verification-${request.id}`]: event.target.value,
                          }))
                        }
                        placeholder="Admin note"
                        className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() =>
                            void reviewVerificationRequest(
                              request.id,
                              request.userId,
                              "approved",
                              notes[`verification-${request.id}`] ?? ""
                            )
                          }
                        >
                          Approve
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void reviewVerificationRequest(
                              request.id,
                              request.userId,
                              "rejected",
                              notes[`verification-${request.id}`] ?? ""
                            )
                          }
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Verification Appeals</CardTitle>
            <CardDescription>Review rejected verification requests that came back with additional context.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {verificationAppeals.length === 0 ? (
              <div className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">No appeals yet.</div>
            ) : (
              verificationAppeals.map((appeal) => (
                <div key={appeal.id} className="rounded-xl border p-4">
                  <p className="font-medium">Request: {appeal.requestId}</p>
                  <p className="mt-2 text-sm">{appeal.message}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {formatTimeAgo(appeal.createdAt)} • {appeal.status}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void reviewVerificationAppeal(appeal.id, "approved", notes[`appeal-${appeal.id}`] ?? "")}
                    >
                      Approve Appeal
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void reviewVerificationAppeal(appeal.id, "rejected", notes[`appeal-${appeal.id}`] ?? "")}
                    >
                      Reject Appeal
                    </Button>
                  </div>
                  <textarea
                    value={notes[`appeal-${appeal.id}`] ?? ""}
                    onChange={(event) =>
                      setNotes((current) => ({
                        ...current,
                        [`appeal-${appeal.id}`]: event.target.value,
                      }))
                    }
                    placeholder="Appeal note"
                    className="mt-3 min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Moderation Review</CardTitle>
            <CardDescription>Review, resolve, dismiss, escalate, and shadow-review incoming reports.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {reports.length === 0 ? (
              <div className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">No reports in queue.</div>
            ) : (
              reports.map((report) => (
                <div key={report.id} className="rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium capitalize">
                        {report.targetType} report • {report.reason}
                      </p>
                      <p className="text-sm text-muted-foreground">Reporter: {report.reporterId}</p>
                      <p className="text-sm text-muted-foreground">Target: {report.targetId}</p>
                      {report.details ? <p className="mt-2 text-sm">{report.details}</p> : null}
                      <p className="mt-2 text-xs text-muted-foreground">
                        {formatTimeAgo(report.createdAt)} • Status: {report.status || "open"} • {getSlaLabel(report.createdAt)}
                      </p>
                      {report.resolutionNote ? (
                        <p className="mt-2 text-sm text-muted-foreground">Resolution: {report.resolutionNote}</p>
                      ) : null}
                      {report.escalationStatus === "escalated" ? (
                        <p className="mt-2 text-sm text-primary">Escalated: {report.escalationReason || "Priority review"}</p>
                      ) : null}
                    </div>
                    <div className="w-full max-w-xs space-y-2">
                      <textarea
                        value={notes[report.id] ?? ""}
                        onChange={(event) => setNotes((current) => ({ ...current, [report.id]: event.target.value }))}
                        placeholder="Resolution note"
                        className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" onClick={() => void reviewReport(report.id, "resolved", notes[report.id] ?? "")}>
                          Resolve
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => void reviewReport(report.id, "dismissed", notes[report.id] ?? "")}>
                          Dismiss
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => void escalateReport(report.id, notes[report.id] ?? "")}>
                          Escalate
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void createShadowBanCase(report.targetId, notes[report.id] || `Shadow review created from report ${report.id}`)
                          }
                        >
                          Shadow Review
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Ban Appeals</CardTitle>
              <CardDescription>Review account ban appeals and return a decision with notes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {banAppeals.length === 0 ? (
                <div className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">No ban appeals yet.</div>
              ) : (
                banAppeals.map((appeal) => (
                  <div key={appeal.id} className="rounded-xl border p-4">
                    <p className="font-medium">{appeal.userId}</p>
                    <p className="mt-2 text-sm">{appeal.message}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {formatTimeAgo(appeal.createdAt)} • {appeal.status}
                    </p>
                    {appeal.reviewNote ? <p className="mt-2 text-sm text-muted-foreground">{appeal.reviewNote}</p> : null}
                    <textarea
                      value={notes[`ban-${appeal.id}`] ?? ""}
                      onChange={(event) =>
                        setNotes((current) => ({
                          ...current,
                          [`ban-${appeal.id}`]: event.target.value,
                        }))
                      }
                      placeholder="Ban appeal review note"
                      className="mt-3 min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                    <div className="mt-3 flex gap-2">
                      <Button type="button" size="sm" onClick={() => void reviewBanAppeal(appeal.id, "approved", notes[`ban-${appeal.id}`] ?? "")}>
                        Approve
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => void reviewBanAppeal(appeal.id, "rejected", notes[`ban-${appeal.id}`] ?? "")}>
                        Reject
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Shadow-Ban Reviews</CardTitle>
              <CardDescription>Track low-visibility enforcement reviews before broader action.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {shadowBanCases.length === 0 ? (
                <div className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">No shadow-ban reviews open.</div>
              ) : (
                shadowBanCases.map((shadowCase) => (
                  <div key={shadowCase.id} className="rounded-xl border p-4">
                    <p className="font-medium">{shadowCase.userId}</p>
                    <p className="mt-2 text-sm">{shadowCase.note}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {formatTimeAgo(shadowCase.createdAt)} • {shadowCase.status}
                    </p>
                    <Button type="button" size="sm" className="mt-3" variant="outline" onClick={() => void reviewShadowBanCase(shadowCase.id)}>
                      Mark Reviewed
                    </Button>
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

export default function ModerationPage() {
  return (
    <AuthProvider>
      <ModerationPageContent />
    </AuthProvider>
  );
}
