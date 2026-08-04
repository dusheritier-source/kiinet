"use client";

import { FormEvent, useEffect, useState } from "react";

import { AuthProvider } from "@/components/AuthProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import {
  getCurrentUserSettings,
  updateCurrentUserSettings,
  type UserSettings,
} from "@/lib/settings";
import {
  getNotificationDigest,
  getPushDevices,
  sendTestEmailDigest,
  type PushDeviceRecord,
} from "@/lib/notifications";
import { auth } from "@/lib/firebase";
import { disableFirebasePush, enableFirebasePush, getPushCapability } from "@/lib/push-notifications";

function SettingsPageContent() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [devices, setDevices] = useState<PushDeviceRecord[]>([]);
  const [pushStatus, setPushStatus] = useState("");

  useEffect(() => {
    void getCurrentUserSettings().then(setSettings);
    void getPushDevices().then(setDevices);
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!settings) {
      return;
    }

    setSaving(true);
    try {
      await updateCurrentUserSettings(settings);
    } finally {
      setSaving(false);
    }
  };

  if (!settings) {
    return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" /></div>;
  }

  return (
    <ProtectedRoute>
      <div className="mx-auto max-w-4xl py-8">
        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
            <CardDescription>Manage notification preferences, profile availability, and the vibe of your public presence.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-3">
                <h3 className="font-semibold">Availability</h3>
                <select
                  value={settings.availabilityStatus}
                  onChange={(event) =>
                    setSettings((current) =>
                      current ? { ...current, availabilityStatus: event.target.value as UserSettings["availabilityStatus"] } : current
                    )
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="available">Available</option>
                  <option value="locked_in">Locked In</option>
                  <option value="recovering">Recovering</option>
                </select>
                <input
                  value={settings.headline}
                  onChange={(event) =>
                    setSettings((current) => (current ? { ...current, headline: event.target.value } : current))
                  }
                  placeholder="Short public headline"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                />
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold">Profile privacy & audience</h3>
                <div className="grid gap-3 sm:grid-cols-2">{([['showActivityStatus', 'Show activity status'], ['showFollowerCounts', 'Show follower counts'], ['allowProfileSharing', 'Allow profile sharing'], ['shareProfileViews', 'Appear in profile visitor lists']] as const).map(([key, label]) => <label key={key} className="flex items-center justify-between rounded-xl border p-3 text-sm"><span>{label}</span><input type="checkbox" checked={settings[key]} onChange={(event) => setSettings({ ...settings, [key]: event.target.checked })} /></label>)}</div>
                <div className="grid gap-3 sm:grid-cols-3"><label className="text-sm">Who can message you<select value={settings.messagePrivacy} onChange={(event) => setSettings({ ...settings, messagePrivacy: event.target.value as UserSettings['messagePrivacy'] })} className="mt-1 h-10 w-full rounded-md border bg-background px-3"><option value="everyone">Everyone</option><option value="following">People you follow</option><option value="no_one">Nobody</option></select></label><label className="text-sm">Who can mention/tag you<select value={settings.mentionPrivacy} onChange={(event) => setSettings({ ...settings, mentionPrivacy: event.target.value as UserSettings['mentionPrivacy'] })} className="mt-1 h-10 w-full rounded-md border bg-background px-3"><option value="everyone">Everyone</option><option value="following">People you follow</option><option value="no_one">Nobody</option></select></label><label className="text-sm">Story replies<select value={settings.storyReplyAudience} onChange={(event) => setSettings({ ...settings, storyReplyAudience: event.target.value as UserSettings['storyReplyAudience'] })} className="mt-1 h-10 w-full rounded-md border bg-background px-3"><option value="everyone">Everyone</option><option value="following">People you follow</option><option value="no_one">Off</option></select></label></div>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold">Notifications</h3>
                {Object.entries(settings.notificationPreferences).map(([key, value]) => (
                  <label key={key} className="flex items-center justify-between rounded-xl border p-3 text-sm">
                    <span className="capitalize">{key}</span>
                    <input
                      type="checkbox"
                      checked={value}
                      onChange={(event) =>
                        setSettings((current) =>
                          current
                            ? {
                                ...current,
                                notificationPreferences: {
                                  ...current.notificationPreferences,
                                  [key]: event.target.checked,
                                },
                              }
                            : current
                        )
                      }
                    />
                  </label>
                ))}
                <div className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2">
                  <label className="text-sm font-medium">Who can notify you<select value={settings.notificationAudience} onChange={(event) => setSettings({ ...settings, notificationAudience: event.target.value as UserSettings["notificationAudience"] })} className="mt-2 h-10 w-full rounded-md border bg-background px-3"><option value="everyone">Everyone</option><option value="following">People you follow</option><option value="no_one">Nobody</option></select></label>
                  <label className="text-sm font-medium">Lock-screen preview<select value={settings.notificationPreview} onChange={(event) => setSettings({ ...settings, notificationPreview: event.target.value as UserSettings["notificationPreview"] })} className="mt-2 h-10 w-full rounded-md border bg-background px-3"><option value="full">Show full message</option><option value="sender_only">Show sender only</option><option value="hidden">Hide sensitive details</option></select></label>
                </div>
                <div className="rounded-xl border p-4"><p className="mb-3 text-sm font-medium">Delivery channels</p><div className="grid gap-3 sm:grid-cols-3">{(["inApp", "push", "email"] as const).map((channel) => <label key={channel} className="flex items-center justify-between rounded-lg bg-muted p-3 text-sm capitalize">{channel === "inApp" ? "In app" : channel}<input type="checkbox" checked={settings.notificationChannels[channel]} onChange={(event) => setSettings({ ...settings, notificationChannels: { ...settings.notificationChannels, [channel]: event.target.checked } })} /></label>)}</div></div>
                <div className="rounded-xl border p-4"><label className="flex items-center justify-between text-sm font-medium">Quiet hours<input type="checkbox" checked={settings.quietHours.enabled} onChange={(event) => setSettings({ ...settings, quietHours: { ...settings.quietHours, enabled: event.target.checked } })} /></label>{settings.quietHours.enabled ? <div className="mt-3 grid grid-cols-2 gap-3"><label className="text-xs text-muted-foreground">From<input type="time" value={settings.quietHours.start} onChange={(event) => setSettings({ ...settings, quietHours: { ...settings.quietHours, start: event.target.value } })} className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" /></label><label className="text-xs text-muted-foreground">Until<input type="time" value={settings.quietHours.end} onChange={(event) => setSettings({ ...settings, quietHours: { ...settings.quietHours, end: event.target.value } })} className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" /></label></div> : null}</div>
                <div className="grid gap-3 sm:grid-cols-2"><label className="flex items-center justify-between rounded-xl border p-3 text-sm">Notification sound<input type="checkbox" checked={settings.notificationSound} onChange={(event) => setSettings({ ...settings, notificationSound: event.target.checked })} /></label><label className="flex items-center justify-between rounded-xl border p-3 text-sm">Vibration<input type="checkbox" checked={settings.notificationVibration} onChange={(event) => setSettings({ ...settings, notificationVibration: event.target.checked })} /></label></div>
                <div className="rounded-xl border p-3">
                  <p className="mb-2 text-sm font-medium">Email Digest</p>
                  <select
                    value={settings.emailDigestFrequency}
                    onChange={(event) =>
                      setSettings((current) =>
                        current
                          ? {
                              ...current,
                              emailDigestFrequency: event.target.value as UserSettings["emailDigestFrequency"],
                            }
                          : current
                      )
                    }
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="off">Off</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
                <div className="rounded-xl border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Firebase push notifications</p>
                      <p className="text-xs text-muted-foreground">Browser permission: {getPushCapability()}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${settings.pushNotificationsEnabled ? "bg-green-100 text-green-700" : "bg-muted"}`}>{settings.pushNotificationsEnabled ? "Enabled" : "Off"}</span>
                  </div>
                  <div className="mt-3 flex gap-2"><Button type="button" size="sm" onClick={() => { setPushStatus("Connecting…"); void enableFirebasePush(() => setPushStatus("Push received while Kinet is open.")).then(async () => { setSettings((current) => current ? { ...current, pushNotificationsEnabled: true, pushPermission: "granted" } : current); setDevices(await getPushDevices()); setPushStatus("This device is connected."); }).catch((error) => setPushStatus(error instanceof Error ? error.message : "Push setup failed.")); }}>Enable on this device</Button>{settings.pushNotificationsEnabled ? <Button type="button" variant="outline" size="sm" onClick={() => { void disableFirebasePush().then(async () => { setSettings((current) => current ? { ...current, pushNotificationsEnabled: false } : current); setDevices(await getPushDevices()); setPushStatus("Push disabled on this device."); }); }}>Disable</Button> : null}</div>
                  {pushStatus ? <p className="mt-2 text-xs text-muted-foreground">{pushStatus}</p> : null}
                </div>
                <div className="rounded-xl border p-3 space-y-3">
                  <p className="text-sm font-medium">Connected push devices</p>
                  {!devices.length ? <p className="text-xs text-muted-foreground">No browser has registered for Firebase push yet.</p> : null}
                  {devices.map((device) => (
                    <div key={device.id} className="rounded-lg bg-muted p-3 text-sm">
                      <p className="font-medium">{device.label}</p>
                      <p className="text-xs text-muted-foreground">{device.platform} · token registered</p>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={async () => {
                      const digest = await getNotificationDigest();
                      if (auth?.currentUser?.email) {
                        await sendTestEmailDigest(auth.currentUser.email, digest);
                      }
                    }}
                  >
                    Send Test Email Digest
                  </Button>
                </div>
              </div>

              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save settings"}
              </Button>
              <div className="flex flex-wrap gap-2">
                <Link href="/platform" className="rounded-full border px-3 py-2 text-sm hover:bg-muted/40">Platform Ops</Link>
                <Link href="/intelligence" className="rounded-full border px-3 py-2 text-sm hover:bg-muted/40">AI & Intelligence</Link>
                <Link href="/feed/preferences" className="rounded-full border px-3 py-2 text-sm hover:bg-muted/40">Feed controls</Link>
                <Link href="/feed/safety" className="rounded-full border px-3 py-2 text-sm hover:bg-muted/40">Feed safety</Link>
                <Link href="/feed/creator" className="rounded-full border px-3 py-2 text-sm hover:bg-muted/40">Creator feed studio</Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  );
}

export default function SettingsPage() {
  return (
    <AuthProvider>
      <SettingsPageContent />
    </AuthProvider>
  );
}
