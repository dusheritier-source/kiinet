"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, BellRing, Send, Trash2 } from "lucide-react";
import { AuthProvider } from "@/components/AuthProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isCurrentUserAdmin } from "@/lib/moderation";
import { deleteNotificationTemplate, dispatchDueNotificationBroadcasts, getNotificationAnalytics, getNotificationTemplates, saveNotificationTemplate, scheduleNotificationBroadcast, type NotificationAnalytics, type NotificationTemplate } from "@/lib/notification-admin";

function NotificationAdminContent() {
  const [analytics, setAnalytics] = useState<NotificationAnalytics>({ sent: 0, delivered: 0, opened: 0, dismissed: 0, openRate: 0 });
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [form, setForm] = useState({ title: "", body: "", targetUrl: "/notifications", segment: "all" as "all" | "verified" | "active", scheduledFor: "" });
  const [status, setStatus] = useState("");
  const admin = isCurrentUserAdmin();
  const refresh = async () => { setTemplates(await getNotificationTemplates()); setAnalytics(await getNotificationAnalytics()); };

  useEffect(() => { if (admin) void dispatchDueNotificationBroadcasts().then(refresh).catch((error) => setStatus(error instanceof Error ? error.message : "Admin data could not be loaded.")); }, [admin]);
  if (!admin) return <ProtectedRoute><main className="mx-auto max-w-2xl p-8"><h1 className="text-2xl font-bold">Notification administration</h1><p className="mt-3 text-muted-foreground">Your account does not have notification administrator access.</p></main></ProtectedRoute>;

  const broadcast = async (event: FormEvent) => { event.preventDefault(); setStatus("Scheduling…"); try { await scheduleNotificationBroadcast({ title: form.title.trim(), body: form.body.trim(), targetUrl: form.targetUrl.trim(), segment: form.segment, scheduledFor: form.scheduledFor ? new Date(form.scheduledFor) : null }); setStatus(form.scheduledFor ? "Broadcast scheduled." : "Broadcast sent."); setForm({ title: "", body: "", targetUrl: "/notifications", segment: "all", scheduledFor: "" }); await refresh(); } catch (error) { setStatus(error instanceof Error ? error.message : "Broadcast failed."); } };

  return <ProtectedRoute><main className="mx-auto max-w-5xl space-y-6 px-4 py-8"><header className="flex items-center justify-between"><div><h1 className="text-3xl font-bold">Notification operations</h1><p className="text-sm text-muted-foreground">Broadcasts, templates and delivery performance.</p></div><Button variant="outline" asChild><Link href="/admin">Back to admin</Link></Button></header>
    <section className="grid gap-3 sm:grid-cols-5">{[{ label: "Sent", value: analytics.sent }, { label: "Delivered", value: analytics.delivered }, { label: "Opened", value: analytics.opened }, { label: "Dismissed", value: analytics.dismissed }, { label: "Open rate", value: `${analytics.openRate}%` }].map((item) => <Card key={item.label}><CardContent className="p-5"><BarChart3 className="mb-2 h-5 w-5 text-primary" /><p className="text-2xl font-bold">{item.value}</p><p className="text-xs text-muted-foreground">{item.label}</p></CardContent></Card>)}</section>
    <div className="grid gap-6 lg:grid-cols-2"><Card><CardHeader><CardTitle className="flex items-center gap-2"><Send className="h-5 w-5" />Create broadcast</CardTitle></CardHeader><CardContent><form onSubmit={broadcast} className="space-y-3"><input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Notification title" className="h-10 w-full rounded-md border px-3" /><textarea required value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} placeholder="Message" className="min-h-28 w-full rounded-md border p-3" /><input value={form.targetUrl} onChange={(event) => setForm({ ...form, targetUrl: event.target.value })} placeholder="/feed" className="h-10 w-full rounded-md border px-3" /><div className="grid grid-cols-2 gap-3"><select value={form.segment} onChange={(event) => setForm({ ...form, segment: event.target.value as typeof form.segment })} className="h-10 rounded-md border px-3"><option value="all">All users</option><option value="verified">Verified users</option><option value="active">Active users</option></select><input type="datetime-local" value={form.scheduledFor} onChange={(event) => setForm({ ...form, scheduledFor: event.target.value })} className="h-10 rounded-md border px-3" /></div><div className="flex gap-2"><Button type="submit" disabled={!form.title.trim() || !form.body.trim()}>Send or schedule</Button><Button type="button" variant="outline" onClick={() => void saveNotificationTemplate({ name: form.title || "Untitled", title: form.title, body: form.body, targetUrl: form.targetUrl }).then(refresh)}>Save template</Button></div>{status ? <p className="text-sm text-muted-foreground">{status}</p> : null}</form></CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><BellRing className="h-5 w-5" />Templates</CardTitle></CardHeader><CardContent className="space-y-2">{templates.length ? templates.map((template) => <div key={template.id} className="flex items-start gap-3 rounded-xl border p-3"><button className="min-w-0 flex-1 text-left" onClick={() => setForm((current) => ({ ...current, title: template.title, body: template.body, targetUrl: template.targetUrl }))}><p className="font-medium">{template.name}</p><p className="line-clamp-2 text-xs text-muted-foreground">{template.body}</p></button><Button size="icon" variant="ghost" onClick={() => void deleteNotificationTemplate(template.id).then(refresh)}><Trash2 className="h-4 w-4" /></Button></div>) : <p className="text-sm text-muted-foreground">No templates yet.</p>}</CardContent></Card></div>
  </main></ProtectedRoute>;
}

export default function NotificationAdminPage() { return <AuthProvider><NotificationAdminContent /></AuthProvider>; }
