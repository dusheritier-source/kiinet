"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck, MessageCircle, Search, Trash2, UserPlus } from "lucide-react";

import { AuthProvider, useAuthContext } from "@/components/AuthProvider";
import DefaultAvatar from "@/components/DefaultAvatar";
import OptimizedMedia from "@/components/OptimizedMedia";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import {
  deleteNotification,
  cleanupExpiredNotifications,
  getNotificationTarget,
  markAllNotificationsRead,
  markNotificationRead,
  restoreNotification,
  subscribeToNotifications,
  type AppNotification,
} from "@/lib/notifications";
import { formatTimeAgo } from "@/lib/posts";

type NotificationTab = "all" | "unread" | "mentions" | "messages";
type NotificationGroup = { key: string; notifications: AppNotification[]; latest: AppNotification };

const mentionTypes = new Set(["mention", "tag", "comment_reply", "story_mention", "collaboration_invite"]);
const messageTypes = new Set(["message", "message_reply", "message_reaction", "group_message", "call", "missed_call", "story_reply"]);

function dateSection(notification: AppNotification) {
  const seconds = notification.createdAt?.seconds ?? 0;
  if (!seconds) return "Earlier";
  const date = new Date(seconds * 1000);
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const time = date.getTime();
  if (time >= startToday) return "Today";
  if (time >= startToday - 86_400_000) return "Yesterday";
  return "Earlier";
}

function groupSimilar(items: AppNotification[]) {
  const groups = new Map<string, NotificationGroup>();
  items.forEach((notification) => {
    const key = `${dateSection(notification)}:${notification.type}:${notification.postId ?? notification.conversationId ?? notification.id}`;
    const current = groups.get(key);
    if (current) current.notifications.push(notification);
    else groups.set(key, { key, notifications: [notification], latest: notification });
  });
  return Array.from(groups.values());
}

function NotificationsPageContent() {
  const { user } = useAuthContext();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [tab, setTab] = useState<NotificationTab>("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(20);
  const [loading, setLoading] = useState(true);
  const [deleted, setDeleted] = useState<AppNotification[]>([]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    void cleanupExpiredNotifications();
    return subscribeToNotifications(user.uid, (next) => { setNotifications(next); setLoading(false); });
  }, [user]);

  const unreadCount = notifications.filter((item) => !item.readBy?.includes(user?.uid ?? "")).length;
  const availableTypes = useMemo(() => Array.from(new Set(notifications.map((item) => item.type))).filter(Boolean).sort(), [notifications]);
  const filtered = useMemo(() => notifications.filter((notification) => {
    const unread = !notification.readBy?.includes(user?.uid ?? "");
    if (tab === "unread" && !unread) return false;
    if (tab === "mentions" && !mentionTypes.has(notification.type)) return false;
    if (tab === "messages" && !messageTypes.has(notification.type)) return false;
    if (typeFilter !== "all" && notification.type !== typeFilter) return false;
    if (priorityFilter !== "all" && notification.priority !== priorityFilter) return false;
    const query = search.trim().toLowerCase();
    return !query || `${notification.actorName} ${notification.message} ${notification.type}`.toLowerCase().includes(query);
  }).sort((left, right) => {
    const weight = { critical: 4, high: 3, normal: 2, low: 1 };
    const priorityDifference = weight[right.priority ?? "normal"] - weight[left.priority ?? "normal"];
    return priorityDifference || (right.createdAt?.seconds ?? 0) - (left.createdAt?.seconds ?? 0);
  }), [notifications, priorityFilter, search, tab, typeFilter, user?.uid]);

  const sections = useMemo(() => {
    const visible = filtered.slice(0, visibleCount);
    return ["Today", "Yesterday", "Earlier"].map((label) => ({ label, groups: groupSimilar(visible.filter((item) => dateSection(item) === label)) })).filter((section) => section.groups.length);
  }, [filtered, visibleCount]);

  const removeGroup = async (group: NotificationGroup) => {
    setDeleted(group.notifications);
    await Promise.all(group.notifications.map((item) => deleteNotification(item.id)));
  };

  const undoDelete = async () => {
    const restore = deleted; setDeleted([]);
    await Promise.all(restore.map(restoreNotification));
  };

  if (!user) return null;

  return <ProtectedRoute><main className="mx-auto min-h-screen max-w-3xl px-4 py-6 md:px-6">
    <header className="mb-6 flex items-start justify-between gap-4"><div><h1 className="text-3xl font-bold">Notifications</h1><p className="mt-1 text-sm text-muted-foreground">Keep up with conversations and activity around your account.</p></div>{unreadCount ? <Button variant="outline" size="sm" onClick={() => void markAllNotificationsRead(notifications)}><CheckCheck className="mr-2 h-4 w-4" />Mark all read</Button> : null}</header>

    <section className="mb-5 rounded-2xl border bg-background p-3 shadow-sm">
      <div className="flex gap-2 overflow-x-auto pb-2">{(["all", "unread", "mentions", "messages"] as const).map((value) => <button key={value} type="button" onClick={() => { setTab(value); setVisibleCount(20); }} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium capitalize ${tab === value ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{value}{value === "unread" && unreadCount ? ` ${unreadCount}` : ""}</button>)}</div>
      <div className="grid gap-2 border-t pt-3 sm:grid-cols-[1fr_180px_150px]"><label className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search notifications" className="h-9 w-full rounded-full bg-muted pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary" /></label><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm"><option value="all">All activity types</option>{availableTypes.map((type) => <option key={type} value={type}>{type.replace(/_/g, " ")}</option>)}</select><select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm"><option value="all">All priorities</option><option value="critical">Critical</option><option value="high">Important</option><option value="normal">Normal</option><option value="low">Suggestions</option></select></div>
    </section>

    {loading ? <div className="space-y-3">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-24 animate-pulse rounded-2xl bg-muted" />)}</div> : null}
    {!loading && !filtered.length ? <div className="rounded-3xl border border-dashed px-6 py-16 text-center"><Bell className="mx-auto h-10 w-10 text-muted-foreground" /><h2 className="mt-3 font-semibold">You’re all caught up</h2><p className="mt-1 text-sm text-muted-foreground">New social activity will appear here in real time.</p></div> : null}

    {!loading ? <div className="space-y-7">{sections.map((section) => <section key={section.label}><h2 className="mb-3 text-sm font-semibold text-muted-foreground">{section.label}</h2><div className="space-y-2">{section.groups.map((group) => <NotificationCard key={group.key} group={group} userId={user.uid} onDelete={() => void removeGroup(group)} />)}</div></section>)}{visibleCount < filtered.length ? <div className="text-center"><Button variant="outline" onClick={() => setVisibleCount((count) => count + 20)}>Load more</Button></div> : null}</div> : null}

    {deleted.length ? <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-full bg-foreground px-5 py-3 text-sm text-background shadow-xl"><span>Notification deleted</span><button type="button" className="font-semibold text-primary" onClick={() => void undoDelete()}>Undo</button></div> : null}
  </main></ProtectedRoute>;
}

function NotificationCard({ group, userId, onDelete }: { group: NotificationGroup; userId: string; onDelete: () => void }) {
  const notification = group.latest;
  const unread = group.notifications.some((item) => !item.readBy?.includes(userId));
  const actors = Array.from(new Map(group.notifications.map((item) => [item.actorId, item])).values());
  const message = actors.length > 1 ? `${actors[0].actorName} and ${actors.length - 1} other${actors.length > 2 ? "s" : ""} ${notification.message.replace(notification.actorName, "").trim()}` : notification.message;
  const Icon = messageTypes.has(notification.type) ? MessageCircle : notification.type === "follow" || notification.type === "follow_request" ? UserPlus : Bell;
  return <article className={`relative flex gap-3 rounded-2xl border p-4 transition hover:bg-muted/40 ${unread ? "border-primary/40 bg-primary/5" : ""}`}>
    <div className="relative h-11 w-11 shrink-0">{notification.actorAvatar ? <OptimizedMedia src={notification.actorAvatar} alt="" width={44} height={44} sizes="44px" className="h-11 w-11 rounded-full object-cover" /> : <DefaultAvatar username={notification.actorName || "User"} className="h-11 w-11 rounded-full" />}{group.notifications.length > 1 ? <span className="absolute -bottom-1 -right-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">{group.notifications.length}</span> : <span className="absolute -bottom-1 -right-1 rounded-full border bg-background p-1"><Icon className="h-3 w-3" /></span>}</div>
    <Link href={getNotificationTarget(notification)} onClick={() => { void Promise.all(group.notifications.map((item) => markNotificationRead(item.id))); }} className="min-w-0 flex-1"><p className="text-sm leading-5">{message}</p><div className="mt-1 flex items-center gap-2"><p className="text-xs text-muted-foreground">{formatTimeAgo(notification.createdAt)}</p>{notification.priority === "critical" || notification.priority === "high" ? <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${notification.priority === "critical" ? "bg-red-100 text-red-700" : "bg-primary/10 text-primary"}`}>{notification.priority === "critical" ? "Critical" : "Important"}</span> : null}</div></Link>
    {notification.thumbnailUrl ? <OptimizedMedia src={notification.thumbnailUrl} alt="Related content" width={48} height={48} sizes="48px" className="h-12 w-12 shrink-0 rounded-lg object-cover" /> : null}
    <button type="button" onClick={onDelete} aria-label="Delete notification" className="self-start rounded-full p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
    {unread ? <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" /> : null}
  </article>;
}

export default function NotificationsPage() {
  return <AuthProvider><NotificationsPageContent /></AuthProvider>;
}
