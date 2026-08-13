"use client";

import { FormEvent, useEffect, useState } from "react";
import { Bell, ChevronRight, CircleUserRound, Download, LockKeyhole, LogOut, Search, ShieldCheck, UserRoundCog } from "lucide-react";
import { useRouter } from "next/navigation";

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
import { signOut } from "@/lib/firebase-auth";

function SettingsPageContent() {
  const router = useRouter();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [devices, setDevices] = useState<PushDeviceRecord[]>([]);
  const [pushStatus, setPushStatus] = useState("");
  const [privacyStatus, setPrivacyStatus] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

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
      <div className="mx-auto max-w-2xl px-4 py-6 sm:py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Settings and activity</h1>
          <label className="mt-4 flex items-center gap-3 rounded-xl bg-muted px-4 py-3">
            <Search className="h-5 w-5 text-muted-foreground" />
            <input aria-label="Search settings" placeholder="Search settings" className="w-full bg-transparent text-sm outline-none" />
          </label>
        </div>
        <Link href="/security" className="mb-6 flex items-center gap-3 rounded-2xl border p-4 hover:bg-muted/40">
          <span className="rounded-full bg-primary/10 p-2 text-primary"><CircleUserRound className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1"><span className="block font-semibold">Accounts Center</span><span className="block text-xs text-muted-foreground">Password, security and account information</span></span>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </Link>
        <Card className="overflow-hidden rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UserRoundCog className="h-5 w-5" />How others can interact with you</CardTitle>
            <CardDescription>Control your privacy, messages, mentions, stories and notifications.</CardDescription>
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
                <h3 className="flex items-center gap-2 font-semibold"><LockKeyhole className="h-4 w-4" />Account privacy</h3>
                <div className="rounded-2xl border p-4">
                  <label className="flex cursor-pointer items-center justify-between gap-4">
                    <span><span className="block font-medium">Private account</span><span className="mt-1 block text-xs text-muted-foreground">When your account is private, only people you approve can see your posts, reels, stories, followers and following.</span></span>
                    <span className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${settings.privateAccount ? "bg-primary" : "bg-muted-foreground/30"}`}>
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={settings.privateAccount}
                        onChange={(event) => {
                          const privateAccount = event.target.checked;
                          const previous = settings.privateAccount;
                          setSettings({ ...settings, privateAccount });
                          setPrivacyStatus("Saving…");
                          void updateCurrentUserSettings({ privateAccount })
                            .then(() => setPrivacyStatus(privateAccount ? "Your account is now private." : "Your account is now public."))
                            .catch(() => { setSettings((current) => current ? { ...current, privateAccount: previous } : current); setPrivacyStatus("Could not change account privacy."); });
                        }}
                      />
                      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${settings.privateAccount ? "translate-x-6" : "translate-x-1"}`} />
                    </span>
                  </label>
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4" /><span>{settings.privateAccount ? "Private · follow requests require your approval" : "Public · anyone can see your content"}</span></div>
                  {privacyStatus ? <p role="status" className="mt-2 text-xs font-medium text-primary">{privacyStatus}</p> : null}
                </div>
                <h3 className="pt-2 font-semibold">Interactions</h3>
                <div className="grid gap-3 sm:grid-cols-2">{([['showActivityStatus', 'Show activity status'], ['showFollowerCounts', 'Show follower counts'], ['allowProfileSharing', 'Allow profile sharing'], ['shareProfileViews', 'Appear in profile visitor lists']] as const).map(([key, label]) => <label key={key} className="flex items-center justify-between rounded-xl border p-3 text-sm"><span>{label}</span><input type="checkbox" checked={settings[key]} onChange={(event) => setSettings({ ...settings, [key]: event.target.checked })} /></label>)}</div>
                <div className="grid gap-3 sm:grid-cols-3"><label className="text-sm">Who can message you<select value={settings.messagePrivacy} onChange={(event) => setSettings({ ...settings, messagePrivacy: event.target.value as UserSettings['messagePrivacy'] })} className="mt-1 h-10 w-full rounded-md border bg-background px-3"><option value="everyone">Everyone</option><option value="following">People you follow</option><option value="no_one">Nobody</option></select></label><label className="text-sm">Who can mention/tag you<select value={settings.mentionPrivacy} onChange={(event) => setSettings({ ...settings, mentionPrivacy: event.target.value as UserSettings['mentionPrivacy'] })} className="mt-1 h-10 w-full rounded-md border bg-background px-3"><option value="everyone">Everyone</option><option value="following">People you follow</option><option value="no_one">Nobody</option></select></label><label className="text-sm">Story replies<select value={settings.storyReplyAudience} onChange={(event) => setSettings({ ...settings, storyReplyAudience: event.target.value as UserSettings['storyReplyAudience'] })} className="mt-1 h-10 w-full rounded-md border bg-background px-3"><option value="everyone">Everyone</option><option value="following">People you follow</option><option value="no_one">Off</option></select></label></div>
              </div>

              <div className="space-y-3">
                <h3 className="flex items-center gap-2 font-semibold"><Bell className="h-4 w-4" />Notifications</h3>
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
                  <div className="mt-3 flex gap-2"><Button type="button" size="sm" disabled={settings.pushNotificationsEnabled} onClick={() => { setPushStatus("Connecting…"); void enableFirebasePush(() => setPushStatus("Push received while Kinet is open.")).then(async () => { setSettings((current) => current ? { ...current, pushNotificationsEnabled: true, pushPermission: "granted" } : current); setDevices(await getPushDevices()); setPushStatus("Notifications are on for this device."); }).catch((error) => setPushStatus(error instanceof Error ? error.message : "Push setup failed.")); }}>Turn on notifications</Button><Button type="button" variant="outline" size="sm" disabled={!settings.pushNotificationsEnabled} onClick={() => { setPushStatus("Turning notifications off…"); void disableFirebasePush().then(async () => { setSettings((current) => current ? { ...current, pushNotificationsEnabled: false } : current); setDevices(await getPushDevices()); setPushStatus("Notifications are off for this device."); }).catch(() => setPushStatus("Notifications could not be turned off.")); }}>Turn off notifications</Button></div>
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

              <Button type="submit" disabled={saving} className="w-full rounded-xl">
                {saving ? "Saving..." : "Save settings"}
              </Button>
              <div className="grid gap-2 border-t pt-5 sm:grid-cols-2">
                <Link href="/install" className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-3 text-sm font-semibold text-primary hover:bg-primary/10"><Download className="h-4 w-4" />Install Kinet</Link>
                <Link href="/platform" className="rounded-xl border px-3 py-2 text-sm hover:bg-muted/40">Accessibility and language</Link>
                <Link href="/intelligence" className="rounded-xl border px-3 py-2 text-sm hover:bg-muted/40">AI features</Link>
                <Link href="/feed/preferences" className="rounded-xl border px-3 py-2 text-sm hover:bg-muted/40">Content preferences</Link>
                <Link href="/feed/safety" className="rounded-xl border px-3 py-2 text-sm hover:bg-muted/40">Hidden words and safety</Link>
                <Link href="/feed/creator" className="rounded-xl border px-3 py-2 text-sm hover:bg-muted/40">Creator tools</Link>
              </div>
              <div className="border-t pt-5">
                <p className="mb-1 font-semibold">Login</p>
                <p className="mb-3 text-sm text-muted-foreground">Sign out of this account on this device.</p>
                <Button
                  type="button"
                  variant="outline"
                  disabled={loggingOut}
                  className="w-full justify-center border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={async () => {
                    if (!window.confirm("Log out of Kinet?")) return;
                    setLoggingOut(true);
                    setLogoutError("");
                    const result = await signOut();
                    if (result.error) {
                      setLogoutError(result.error);
                      setLoggingOut(false);
                      return;
                    }
                    router.replace("/login");
                    router.refresh();
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  {loggingOut ? "Logging out…" : "Log out"}
                </Button>
                {logoutError ? <p role="alert" className="mt-2 text-sm text-destructive">{logoutError}</p> : null}
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
