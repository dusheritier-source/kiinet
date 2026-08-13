"use client";

import { useEffect, useState } from "react";

import { AuthProvider } from "@/components/AuthProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createInviteCode,
  getAppAccessSettings,
  subscribeToAuditLogs,
  subscribeToInviteCodes,
  subscribeToManagedUsers,
  toggleInviteCode,
  updateAppAccessSettings,
  updateManagedUser,
  type AppAccessSettings,
  type AuditLogRecord,
  type InviteCodeRecord,
  type ManagedUserRecord,
} from "@/lib/admin";
import { subscribeToWaitlistEntries, type WaitlistEntryRecord } from "@/lib/business";
import { useAdminClaim } from "@/hooks/useAdminClaim";
import {
  createAdminAnnouncement,
  createSuspiciousAlert,
  reviewTrustedReporterNomination,
  subscribeToAdminAnnouncements,
  subscribeToSuspiciousAlerts,
  subscribeToTrustedReporterNominations,
  updateCommunityTrust,
  type AdminAnnouncementRecord,
  type SuspiciousAlertRecord,
  type TrustedReporterNomination,
} from "@/lib/phase8";
import { formatTimeAgo } from "@/lib/posts";

function AdminPageContent() {
  const { isAdmin, checking } = useAdminClaim();
  const [settings, setSettings] = useState<AppAccessSettings | null>(null);
  const [users, setUsers] = useState<ManagedUserRecord[]>([]);
  const [inviteCodes, setInviteCodes] = useState<InviteCodeRecord[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntryRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [announcements, setAnnouncements] = useState<AdminAnnouncementRecord[]>([]);
  const [alerts, setAlerts] = useState<SuspiciousAlertRecord[]>([]);
  const [trustedReporterNominations, setTrustedReporterNominations] = useState<TrustedReporterNomination[]>([]);
  const [draftInviteCode, setDraftInviteCode] = useState("");
  const [draftInviteNote, setDraftInviteNote] = useState("");
  const [draftInviteUses, setDraftInviteUses] = useState(10);
  const [announcementForm, setAnnouncementForm] = useState({ title: "", message: "" });
  const [alertForm, setAlertForm] = useState({ userId: "", reason: "", severity: "medium" as SuspiciousAlertRecord["severity"] });
  const [userNotes, setUserNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isAdmin) return;
    void getAppAccessSettings().then(setSettings);
    const unsubscribeUsers = subscribeToManagedUsers(setUsers);
    const unsubscribeCodes = subscribeToInviteCodes(setInviteCodes);
    const unsubscribeWaitlist = subscribeToWaitlistEntries(setWaitlist);
    const unsubscribeAudit = subscribeToAuditLogs(setAuditLogs);
    const unsubscribeAnnouncements = subscribeToAdminAnnouncements(setAnnouncements);
    const unsubscribeAlerts = subscribeToSuspiciousAlerts(setAlerts);
    const unsubscribeTrusted = subscribeToTrustedReporterNominations(setTrustedReporterNominations);
    return () => {
      unsubscribeUsers();
      unsubscribeCodes();
      unsubscribeWaitlist();
      unsubscribeAudit();
      unsubscribeAnnouncements();
      unsubscribeAlerts();
      unsubscribeTrusted();
    };
  }, [isAdmin]);

  if (checking || !isAdmin) {
    return (
      <ProtectedRoute>
        <div className="mx-auto max-w-2xl py-8">
          <Card>
            <CardHeader>
              <CardTitle>Admin</CardTitle>
              <CardDescription>This area is only available to configured Kinet admins.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="mx-auto max-w-7xl space-y-6 py-8">
        <div>
          <h1 className="text-3xl font-bold">Admin Center</h1>
          <p className="text-muted-foreground">Manage access, invite codes, user safety states, and audit history.</p>
        </div>

        {settings ? (
          <Card>
            <CardHeader>
              <CardTitle>App Access</CardTitle>
              <CardDescription>Control whether signup is open, invite-only, or waitlist-driven.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <label className="flex items-center justify-between rounded-xl border p-3 text-sm">
                <span>Require invite code on signup</span>
                <input
                  type="checkbox"
                  checked={settings.requireInvite}
                  onChange={(event) => setSettings((current) => current ? { ...current, requireInvite: event.target.checked } : current)}
                />
              </label>
              <label className="flex items-center justify-between rounded-xl border p-3 text-sm">
                <span>Keep waitlist open</span>
                <input
                  type="checkbox"
                  checked={settings.waitlistOpen}
                  onChange={(event) => setSettings((current) => current ? { ...current, waitlistOpen: event.target.checked } : current)}
                />
              </label>
              <textarea
                className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm md:col-span-2"
                value={settings.inviteOnlyMessage}
                onChange={(event) => setSettings((current) => current ? { ...current, inviteOnlyMessage: event.target.value } : current)}
              />
              <Button className="md:col-span-2" onClick={() => settings ? void updateAppAccessSettings(settings) : undefined}>
                Save Access Settings
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Internal Admin Announcements</CardTitle>
              <CardDescription>Publish internal notices for the operations team.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <input className="h-11 rounded-md border border-input bg-background px-3 text-sm" placeholder="Announcement title" value={announcementForm.title} onChange={(event) => setAnnouncementForm((current) => ({ ...current, title: event.target.value }))} />
              <textarea className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Announcement message" value={announcementForm.message} onChange={(event) => setAnnouncementForm((current) => ({ ...current, message: event.target.value }))} />
              <Button onClick={() => void createAdminAnnouncement(announcementForm.title, announcementForm.message).then(() => setAnnouncementForm({ title: "", message: "" }))}>Post Announcement</Button>
              {announcements.map((announcement) => (
                <div key={announcement.id} className="rounded-xl border p-4">
                  <p className="font-semibold">{announcement.title}</p>
                  <p className="mt-2 text-sm">{announcement.message}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Suspicious Activity Alerts</CardTitle>
              <CardDescription>Flag suspicious behavior for later review.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <input className="h-11 rounded-md border border-input bg-background px-3 text-sm" placeholder="User id" value={alertForm.userId} onChange={(event) => setAlertForm((current) => ({ ...current, userId: event.target.value }))} />
              <input className="h-11 rounded-md border border-input bg-background px-3 text-sm" placeholder="Reason" value={alertForm.reason} onChange={(event) => setAlertForm((current) => ({ ...current, reason: event.target.value }))} />
              <select className="h-11 rounded-md border border-input bg-background px-3 text-sm" value={alertForm.severity} onChange={(event) => setAlertForm((current) => ({ ...current, severity: event.target.value as SuspiciousAlertRecord["severity"] }))}>
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
              </select>
              <Button onClick={() => void createSuspiciousAlert(alertForm).then(() => setAlertForm({ userId: "", reason: "", severity: "medium" }))}>Create Alert</Button>
              {alerts.map((alert) => (
                <div key={alert.id} className="rounded-xl border p-4">
                  <p className="font-semibold">{alert.userId}</p>
                  <p className="text-sm text-muted-foreground">{alert.severity}</p>
                  <p className="mt-2 text-sm">{alert.reason}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Invite Codes</CardTitle>
              <CardDescription>Create codes for creator campaigns, scouting groups, or private launches.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-[1fr,120px]">
                <input
                  className="h-11 rounded-md border border-input bg-background px-3 text-sm"
                  placeholder="HOOP-FOUNDERS"
                  value={draftInviteCode}
                  onChange={(event) => setDraftInviteCode(event.target.value)}
                />
                <input
                  className="h-11 rounded-md border border-input bg-background px-3 text-sm"
                  type="number"
                  min={1}
                  value={draftInviteUses}
                  onChange={(event) => setDraftInviteUses(Number(event.target.value))}
                />
              </div>
              <input
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                placeholder="Optional note"
                value={draftInviteNote}
                onChange={(event) => setDraftInviteNote(event.target.value)}
              />
              <Button
                onClick={() =>
                  void createInviteCode({
                    code: draftInviteCode,
                    maxUses: draftInviteUses,
                    note: draftInviteNote,
                  }).then(() => {
                    setDraftInviteCode("");
                    setDraftInviteNote("");
                    setDraftInviteUses(10);
                  })
                }
              >
                Create Invite Code
              </Button>
              <div className="space-y-3">
                {inviteCodes.map((inviteCode) => (
                  <div key={inviteCode.id} className="rounded-xl border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">{inviteCode.code}</p>
                        <p className="text-sm text-muted-foreground">
                          {inviteCode.uses}/{inviteCode.maxUses} uses • {inviteCode.note || "No note"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Referrals: {inviteCode.referralCount ?? inviteCode.uses}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void toggleInviteCode(inviteCode.code, !inviteCode.active)}
                      >
                        {inviteCode.active ? "Disable" : "Enable"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Waitlist</CardTitle>
              <CardDescription>See who is asking to join before you send invites.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {waitlist.length === 0 ? (
                <div className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">No waitlist entries yet.</div>
              ) : (
                waitlist.map((entry) => (
                  <div key={entry.id} className="rounded-xl border p-4">
                    <p className="font-semibold">{entry.name}</p>
                    <p className="text-sm text-muted-foreground">{entry.email} • {entry.role}</p>
                    {entry.note ? <p className="mt-2 text-sm">{entry.note}</p> : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>User Management</CardTitle>
            <CardDescription>Update trust state, verification, and admin notes for member accounts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {users.map((managedUser) => (
              <div key={managedUser.uid} className="rounded-xl border p-4">
                <div className="grid gap-3 lg:grid-cols-[1.2fr,180px,180px,1fr,auto]">
                  <div>
                    <p className="font-semibold">{managedUser.displayName}</p>
                    <p className="text-sm text-muted-foreground">
                      {managedUser.email || managedUser.uid} • {managedUser.roleType}
                    </p>
                  </div>
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    defaultValue={managedUser.accessStatus}
                    onChange={(event) =>
                      void updateManagedUser(managedUser.uid, {
                        accessStatus: event.target.value as ManagedUserRecord["accessStatus"],
                        verified: managedUser.verified,
                        adminNote: userNotes[managedUser.uid] ?? managedUser.adminNote,
                      })
                    }
                  >
                    <option value="active">active</option>
                    <option value="watch">watch</option>
                    <option value="suspended">suspended</option>
                  </select>
                  <label className="flex items-center gap-2 rounded-md border px-3 text-sm">
                    <input
                      type="checkbox"
                      defaultChecked={managedUser.verified}
                      onChange={(event) =>
                        void updateManagedUser(managedUser.uid, {
                          accessStatus: managedUser.accessStatus,
                          verified: event.target.checked,
                          adminNote: userNotes[managedUser.uid] ?? managedUser.adminNote,
                        })
                      }
                    />
                    Verified
                  </label>
                  <input
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    placeholder="Admin note"
                    defaultValue={managedUser.adminNote}
                    onChange={(event) =>
                      setUserNotes((current) => ({ ...current, [managedUser.uid]: event.target.value }))
                    }
                  />
                  <Button
                    variant="outline"
                    onClick={() =>
                      void updateManagedUser(managedUser.uid, {
                        accessStatus: managedUser.accessStatus,
                        verified: managedUser.verified,
                        adminNote: userNotes[managedUser.uid] ?? managedUser.adminNote,
                      })
                    }
                  >
                    Save
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Trusted Reporter Program</CardTitle>
            <CardDescription>Approve nominations and optionally upgrade trust.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {trustedReporterNominations.map((nomination) => (
              <div key={nomination.id} className="rounded-xl border p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{nomination.userId}</p>
                    <p className="text-sm text-muted-foreground">{nomination.status}</p>
                    <p className="mt-2 text-sm">{nomination.note}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => void reviewTrustedReporterNomination(nomination.id, "approved").then(() => void updateCommunityTrust({ uid: nomination.userId, reputationScore: 85, trustedReporter: true }))}>
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void reviewTrustedReporterNomination(nomination.id, "rejected")}>
                      Reject
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Audit Log</CardTitle>
            <CardDescription>Every moderation and admin review action lands here.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {auditLogs.map((log) => (
              <div key={log.id} className="rounded-xl border p-4">
                <p className="font-semibold">{log.summary}</p>
                <p className="text-sm text-muted-foreground">
                  {log.action} • {log.targetType} • {log.targetId}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{formatTimeAgo(log.createdAt)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  );
}

export default function AdminPage() {
  return (
    <AuthProvider>
      <AdminPageContent />
    </AuthProvider>
  );
}
