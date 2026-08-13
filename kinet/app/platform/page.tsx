"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { AuthProvider } from "@/components/AuthProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  addOrgNote,
  addOrgStaffDirectoryEntry,
  applyHighContrastPreference,
  buildAppleCalendarIcs,
  buildGoogleCalendarLink,
  createBulkImportJob,
  createCoachVerification,
  createPartnerApiKey,
  createReleaseNote,
  createSchoolAdminAccount,
  getBulkImportJobs,
  getCoachVerifications,
  getIntegrations,
  getOrgStaffDirectory,
  getPaidOrgTools,
  getPartnerApiKeys,
  getPlatformPreferences,
  getReleaseNotes,
  getSchoolAdminAccounts,
  getWebhooks,
  getWhiteLabelPortals,
  saveIntegration,
  savePaidOrgTools,
  saveWebhook,
  saveWhiteLabelPortal,
  subscribeToOrgNotes,
  updatePlatformPreferences,
  type BulkImportJobRecord,
  type CoachVerificationRecord,
  type OrgNoteRecord,
  type OrgStaffDirectoryRecord,
  type PartnerApiKeyRecord,
  type PlatformPreferences,
  type ReleaseNoteRecord,
  type SchoolAdminAccountRecord,
  type WebhookRecord,
  type WhiteLabelPortalRecord,
} from "@/lib/phase9";

const PAID_TOOLS = ["crm_sync", "white_label", "api_access", "calendar_sync", "translation_suite"] as const;

function PlatformPageContent() {
  const [preferences, setPreferences] = useState<PlatformPreferences | null>(null);
  const [schools, setSchools] = useState<SchoolAdminAccountRecord[]>([]);
  const [coachVerifications, setCoachVerifications] = useState<CoachVerificationRecord[]>([]);
  const [portals, setPortals] = useState<WhiteLabelPortalRecord[]>([]);
  const [apiKeys, setApiKeys] = useState<PartnerApiKeyRecord[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookRecord[]>([]);
  const [integrations, setIntegrations] = useState<Array<{ id: string; type: string; label: string; config: string; active: boolean }>>([]);
  const [staffDirectory, setStaffDirectory] = useState<OrgStaffDirectoryRecord[]>([]);
  const [imports, setImports] = useState<BulkImportJobRecord[]>([]);
  const [releaseNotes, setReleaseNotes] = useState<ReleaseNoteRecord[]>([]);
  const [orgNotes, setOrgNotes] = useState<OrgNoteRecord[]>([]);
  const [orgId, setOrgId] = useState("default-org");
  const [paidTools, setPaidTools] = useState<string[]>([]);
  const [calendarForm, setCalendarForm] = useState({
    title: "Kinet Ops Review",
    details: "Org sync and planning review",
    location: "Remote",
    start: "2026-04-02T10:00:00Z",
    end: "2026-04-02T11:00:00Z",
  });
  const [schoolForm, setSchoolForm] = useState({ schoolName: "", contactEmail: "", region: "" });
  const [coachForm, setCoachForm] = useState({ coachName: "", organization: "" });
  const [portalForm, setPortalForm] = useState({ orgName: "", themeName: "", accentColor: "#111827", customDomain: "" });
  const [apiForm, setApiForm] = useState({ label: "", scope: "read" });
  const [webhookForm, setWebhookForm] = useState({ label: "", url: "", eventType: "user.updated", active: true });
  const [integrationForm, setIntegrationForm] = useState({ type: "zapier" as const, label: "", config: "" });
  const [staffForm, setStaffForm] = useState({ orgName: "", memberName: "", title: "", region: "", timezone: "UTC" });
  const [orgNoteDraft, setOrgNoteDraft] = useState("");
  const [bulkImportForm, setBulkImportForm] = useState({ teamId: "", csv: "Jane Doe,jane@example.com,player" });
  const [releaseForm, setReleaseForm] = useState({ version: "", title: "", summary: "" });

  const refresh = useCallback(async (nextOrgId = "default-org") => {
    const [
      nextPreferences,
      nextSchools,
      nextCoaches,
      nextPortals,
      nextApiKeys,
      nextHooks,
      nextIntegrations,
      nextStaff,
      nextImports,
      nextNotes,
      nextPaidTools,
    ] = await Promise.all([
      getPlatformPreferences(),
      getSchoolAdminAccounts(),
      getCoachVerifications(),
      getWhiteLabelPortals(),
      getPartnerApiKeys(),
      getWebhooks(),
      getIntegrations(),
      getOrgStaffDirectory(),
      getBulkImportJobs(),
      getReleaseNotes(),
      getPaidOrgTools(nextOrgId),
    ]);
    setPreferences(nextPreferences);
    setSchools(nextSchools);
    setCoachVerifications(nextCoaches);
    setPortals(nextPortals);
    setApiKeys(nextApiKeys);
    setWebhooks(nextHooks);
    setIntegrations(nextIntegrations);
    setStaffDirectory(nextStaff);
    setImports(nextImports);
    setReleaseNotes(nextNotes);
    setPaidTools(nextPaidTools);
    applyHighContrastPreference(nextPreferences.highContrast);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    return subscribeToOrgNotes(orgId, setOrgNotes);
  }, [orgId]);

  const googleCalendarUrl = useMemo(() => buildGoogleCalendarLink(calendarForm), [calendarForm]);

  if (!preferences) {
    return null;
  }

  return (
    <ProtectedRoute>
      <div className="mx-auto max-w-7xl space-y-6 py-8">
        <div>
          <h1 className="text-3xl font-bold">Platform Ops</h1>
          <p className="text-muted-foreground">School admins, partner integrations, org controls, accessibility presets, localization, and release management.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Localization</CardTitle>
              <CardDescription>Multi-language profile support, DM translation, time zone scheduling, and accessibility presets.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input value={preferences.language} onChange={(event) => setPreferences((current) => current ? { ...current, language: event.target.value } : current)} placeholder="Profile language" />
              <Input value={preferences.dmTranslationLanguage} onChange={(event) => setPreferences((current) => current ? { ...current, dmTranslationLanguage: event.target.value } : current)} placeholder="DM translation target" />
              <Input value={preferences.timezone} onChange={(event) => setPreferences((current) => current ? { ...current, timezone: event.target.value } : current)} placeholder="Timezone" />
              <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={preferences.accessibilityPreset} onChange={(event) => setPreferences((current) => current ? { ...current, accessibilityPreset: event.target.value as PlatformPreferences["accessibilityPreset"] } : current)}>
                <option value="default">Default</option>
                <option value="focused">Focused</option>
                <option value="accessible">Accessible</option>
              </select>
              <label className="flex items-center justify-between rounded-xl border p-3 text-sm">
                <span>Auto-translate DMs</span>
                <input type="checkbox" checked={preferences.autoTranslateDms} onChange={(event) => setPreferences((current) => current ? { ...current, autoTranslateDms: event.target.checked } : current)} />
              </label>
              <label className="flex items-center justify-between rounded-xl border p-3 text-sm">
                <span>High-contrast theme</span>
                <input type="checkbox" checked={preferences.highContrast} onChange={(event) => {
                  const enabled = event.target.checked;
                  setPreferences((current) => current ? { ...current, highContrast: enabled } : current);
                  applyHighContrastPreference(enabled);
                }} />
              </label>
              <Button onClick={() => void updatePlatformPreferences(preferences).then(() => refresh())}>Save Platform Preferences</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>School and Coach Access</CardTitle>
              <CardDescription>School admin account intake and coach/staff verification.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Input value={schoolForm.schoolName} onChange={(event) => setSchoolForm((current) => ({ ...current, schoolName: event.target.value }))} placeholder="School name" />
                <Input value={schoolForm.contactEmail} onChange={(event) => setSchoolForm((current) => ({ ...current, contactEmail: event.target.value }))} placeholder="Contact email" />
                <Input value={schoolForm.region} onChange={(event) => setSchoolForm((current) => ({ ...current, region: event.target.value }))} placeholder="Region" />
                <Button onClick={() => void createSchoolAdminAccount(schoolForm).then(() => { setSchoolForm({ schoolName: "", contactEmail: "", region: "" }); return refresh(); })}>Create School Admin Account</Button>
              </div>
              <div className="space-y-2 border-t pt-4">
                <Input value={coachForm.coachName} onChange={(event) => setCoachForm((current) => ({ ...current, coachName: event.target.value }))} placeholder="Coach name" />
                <Input value={coachForm.organization} onChange={(event) => setCoachForm((current) => ({ ...current, organization: event.target.value }))} placeholder="Organization" />
                <Button variant="outline" onClick={() => void createCoachVerification(coachForm).then(() => { setCoachForm({ coachName: "", organization: "" }); return refresh(); })}>Verify Coach Staff</Button>
              </div>
              <div className="space-y-2 border-t pt-4 text-sm">
                {schools.slice(0, 3).map((school) => <div key={school.id} className="rounded-lg bg-muted p-3">{school.schoolName} • {school.region} • {school.status}</div>)}
                {coachVerifications.slice(0, 3).map((item) => <div key={item.id} className="rounded-lg bg-muted p-3">{item.coachName} • {item.organization} • {item.status}</div>)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>White-Label and Paid Tools</CardTitle>
              <CardDescription>Org portal branding plus premium admin tool switches.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input value={portalForm.orgName} onChange={(event) => setPortalForm((current) => ({ ...current, orgName: event.target.value }))} placeholder="Org name" />
              <Input value={portalForm.themeName} onChange={(event) => setPortalForm((current) => ({ ...current, themeName: event.target.value }))} placeholder="Theme name" />
              <Input value={portalForm.accentColor} onChange={(event) => setPortalForm((current) => ({ ...current, accentColor: event.target.value }))} placeholder="Accent color" />
              <Input value={portalForm.customDomain} onChange={(event) => setPortalForm((current) => ({ ...current, customDomain: event.target.value }))} placeholder="Custom domain" />
              <Button onClick={() => void saveWhiteLabelPortal(portalForm).then(() => refresh())}>Save White-Label Portal</Button>
              <Input value={orgId} onChange={(event) => setOrgId(event.target.value)} placeholder="Org id for paid tools" />
              <div className="flex flex-wrap gap-2">
                {PAID_TOOLS.map((tool) => {
                  const active = paidTools.includes(tool);
                  return (
                    <button
                      key={tool}
                      type="button"
                      className={`rounded-full border px-3 py-2 text-xs ${active ? "border-primary bg-primary/5 text-primary" : ""}`}
                      onClick={() => setPaidTools((current) => active ? current.filter((item) => item !== tool) : [...current, tool])}
                    >
                      {tool}
                    </button>
                  );
                })}
              </div>
              <Button variant="outline" onClick={() => void savePaidOrgTools({ orgId, tools: paidTools }).then(() => refresh(orgId))}>Save Paid Admin Tools</Button>
              <div className="space-y-2 border-t pt-4 text-sm">
                {portals.slice(0, 2).map((portal) => <div key={portal.id} className="rounded-lg bg-muted p-3">{portal.orgName} • {portal.themeName} • {portal.customDomain || "No domain"}</div>)}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Partner API and Automation</CardTitle>
              <CardDescription>API keys, webhooks, Zapier/Make integrations, CRM sync, and Google Calendar sync.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <Input value={apiForm.label} onChange={(event) => setApiForm((current) => ({ ...current, label: event.target.value }))} placeholder="API key label" />
                <Input value={apiForm.scope} onChange={(event) => setApiForm((current) => ({ ...current, scope: event.target.value }))} placeholder="Scope" />
              </div>
              <Button onClick={() => void createPartnerApiKey(apiForm.label, apiForm.scope).then(() => { setApiForm({ label: "", scope: "read" }); return refresh(); })}>Create API Key</Button>
              <div className="space-y-2">
                {apiKeys.map((key) => <div key={key.id} className="rounded-lg bg-muted p-3 text-sm">{key.label} • {key.scope} • {key.preview}</div>)}
              </div>

              <div className="grid gap-3 border-t pt-4">
                <Input value={webhookForm.label} onChange={(event) => setWebhookForm((current) => ({ ...current, label: event.target.value }))} placeholder="Webhook label" />
                <Input value={webhookForm.url} onChange={(event) => setWebhookForm((current) => ({ ...current, url: event.target.value }))} placeholder="Webhook URL" />
                <Input value={webhookForm.eventType} onChange={(event) => setWebhookForm((current) => ({ ...current, eventType: event.target.value }))} placeholder="Event type" />
                <Button variant="outline" onClick={() => void saveWebhook(webhookForm).then(() => { setWebhookForm({ label: "", url: "", eventType: "user.updated", active: true }); return refresh(); })}>Save Webhook</Button>
              </div>
              <div className="space-y-2 text-sm">
                {webhooks.map((item) => <div key={item.id} className="rounded-lg bg-muted p-3">{item.label} • {item.eventType} • {item.url}</div>)}
              </div>

              <div className="grid gap-3 border-t pt-4 md:grid-cols-3">
                <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={integrationForm.type} onChange={(event) => setIntegrationForm((current) => ({ ...current, type: event.target.value as typeof current.type }))}>
                  <option value="zapier">Zapier</option>
                  <option value="make">Make</option>
                  <option value="crm">CRM</option>
                  <option value="google_calendar">Google Calendar</option>
                </select>
                <Input value={integrationForm.label} onChange={(event) => setIntegrationForm((current) => ({ ...current, label: event.target.value }))} placeholder="Integration label" />
                <Input value={integrationForm.config} onChange={(event) => setIntegrationForm((current) => ({ ...current, config: event.target.value }))} placeholder="Config / endpoint" />
              </div>
              <Button variant="outline" onClick={() => void saveIntegration({ ...integrationForm, active: true }).then(() => setIntegrationForm({ type: "zapier", label: "", config: "" }))}>Save Integration</Button>
              <div className="space-y-2 text-sm">
                {integrations.map((item) => <div key={item.id} className="rounded-lg bg-muted p-3">{item.type} • {item.label} • {item.config}</div>)}
              </div>

              <div className="rounded-xl border p-4 text-sm">
                <p className="font-semibold">Calendar Sync</p>
                <div className="mt-3 grid gap-2">
                  <Input value={calendarForm.title} onChange={(event) => setCalendarForm((current) => ({ ...current, title: event.target.value }))} placeholder="Event title" />
                  <Input value={calendarForm.details} onChange={(event) => setCalendarForm((current) => ({ ...current, details: event.target.value }))} placeholder="Details" />
                  <Input value={calendarForm.location} onChange={(event) => setCalendarForm((current) => ({ ...current, location: event.target.value }))} placeholder="Location" />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a className="rounded-md border px-3 py-2 text-xs hover:bg-muted/40" href={googleCalendarUrl} target="_blank" rel="noreferrer">Google Calendar Sync</a>
                  <button type="button" className="rounded-md border px-3 py-2 text-xs hover:bg-muted/40" onClick={() => {
                    const ics = buildAppleCalendarIcs(calendarForm);
                    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
                    const url = URL.createObjectURL(blob);
                    const anchor = document.createElement("a");
                    anchor.href = url;
                    anchor.download = "Kinet-event.ics";
                    anchor.click();
                    URL.revokeObjectURL(url);
                  }}>
                    Apple Calendar Export
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Org Ops Workspace</CardTitle>
              <CardDescription>Bulk imports, staffing directory, internal notes, and changelog center.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <Input value={staffForm.orgName} onChange={(event) => setStaffForm((current) => ({ ...current, orgName: event.target.value }))} placeholder="Org name" />
                <Input value={staffForm.memberName} onChange={(event) => setStaffForm((current) => ({ ...current, memberName: event.target.value }))} placeholder="Staff member" />
                <Input value={staffForm.title} onChange={(event) => setStaffForm((current) => ({ ...current, title: event.target.value }))} placeholder="Title" />
                <Input value={staffForm.region} onChange={(event) => setStaffForm((current) => ({ ...current, region: event.target.value }))} placeholder="Region" />
                <Input value={staffForm.timezone} onChange={(event) => setStaffForm((current) => ({ ...current, timezone: event.target.value }))} placeholder="Timezone" />
              </div>
              <Button onClick={() => void addOrgStaffDirectoryEntry(staffForm).then(() => { setStaffForm({ orgName: "", memberName: "", title: "", region: "", timezone: "UTC" }); return refresh(); })}>Add Staffing Directory Entry</Button>
              <div className="space-y-2 text-sm">
                {staffDirectory.map((entry) => <div key={entry.id} className="rounded-lg bg-muted p-3">{entry.memberName} • {entry.title} • {entry.region} • {entry.timezone}</div>)}
              </div>

              <div className="grid gap-3 border-t pt-4">
                <Input value={bulkImportForm.teamId} onChange={(event) => setBulkImportForm((current) => ({ ...current, teamId: event.target.value }))} placeholder="Team id" />
                <textarea value={bulkImportForm.csv} onChange={(event) => setBulkImportForm((current) => ({ ...current, csv: event.target.value }))} className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Name,email,role" />
                <Button variant="outline" onClick={() => void createBulkImportJob(bulkImportForm.teamId, bulkImportForm.csv).then(() => refresh())}>Queue Bulk Import</Button>
                {imports.map((job) => <div key={job.id} className="rounded-lg bg-muted p-3 text-sm">{job.teamId} • {job.rows.length} rows queued</div>)}
              </div>

              <div className="grid gap-3 border-t pt-4">
                <Input value={orgId} onChange={(event) => setOrgId(event.target.value)} placeholder="Org id for notes" />
                <textarea value={orgNoteDraft} onChange={(event) => setOrgNoteDraft(event.target.value)} className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Internal org note" />
                <Button variant="outline" onClick={() => void addOrgNote(orgId, orgNoteDraft).then(() => setOrgNoteDraft(""))}>Save Org Note</Button>
                {orgNotes.map((note) => <div key={note.id} className="rounded-lg bg-muted p-3 text-sm">{note.note}</div>)}
              </div>

              <div className="grid gap-3 border-t pt-4">
                <Input value={releaseForm.version} onChange={(event) => setReleaseForm((current) => ({ ...current, version: event.target.value }))} placeholder="Version" />
                <Input value={releaseForm.title} onChange={(event) => setReleaseForm((current) => ({ ...current, title: event.target.value }))} placeholder="Release title" />
                <textarea value={releaseForm.summary} onChange={(event) => setReleaseForm((current) => ({ ...current, summary: event.target.value }))} className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Release summary" />
                <Button onClick={() => void createReleaseNote(releaseForm).then(() => { setReleaseForm({ version: "", title: "", summary: "" }); return refresh(); })}>Publish Release Note</Button>
                {releaseNotes.map((note) => <div key={note.id} className="rounded-lg bg-muted p-3 text-sm"><span className="font-semibold">{note.version}</span> • {note.title}<div className="mt-1 text-muted-foreground">{note.summary}</div></div>)}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  );
}

export default function PlatformPage() {
  return (
    <AuthProvider>
      <PlatformPageContent />
    </AuthProvider>
  );
}
