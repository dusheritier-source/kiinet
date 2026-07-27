"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, Briefcase, CalendarDays, ChevronDown, Compass, Cpu, Dumbbell, Film, Gem, GraduationCap, Home, LineChart, LogIn, LogOut, Map, Menu, MessageCircle, Mic2, Newspaper, Plus, Radio, Search, Settings, Shield, ShoppingBag, Sparkles, Target, Ticket, Tv2, UserPlus, Wallet, Workflow, Users } from "lucide-react";
import { signOut } from "firebase/auth";

import { auth } from "@/lib/firebase";
import { subscribeToNotifications, type AppNotification } from "@/lib/notifications";
import { getCurrentUserSettings } from "@/lib/settings";
import { isCurrentUserAdmin } from "@/lib/moderation";
import { useAuthContext } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { subscribeToConversations, type ConversationSummary } from "@/lib/messaging";

const primaryNav = [
  { href: "/feed", label: "Feed", icon: Home },
  { href: "/search", label: "Search", icon: Search },
  { href: "/notifications", label: "Alerts", icon: Bell, isAlert: true },
  { href: "/profile", label: "Profile" },
  { href: "/messages", label: "Messages" },
];

const workspaceGroups = [
  {
    label: "Discover",
    items: [
      { href: "/saved", label: "Saved" },
      { href: "/topics", label: "Topics" },
      { href: "/media-lab", label: "Media Lab", icon: Film },
      { href: "/growth", label: "Growth", icon: Sparkles },
      { href: "/marketplace", label: "Marketplace", icon: ShoppingBag },
      { href: "/bookings", label: "Bookings", icon: CalendarDays },
    ],
  },
  {
    label: "Social",
    items: [
      { href: "/groups", label: "Groups", icon: Gem },
      { href: "/live", label: "Live", icon: Radio },
      { href: "/podcasts", label: "Podcasts", icon: Mic2 },
      { href: "/community", label: "Community" },
      { href: "/events", label: "Events", icon: Ticket },
    ],
  },
  {
    label: "Tools",
    items: [
      { href: "/business", label: "Business", icon: Briefcase },
      { href: "/billing", label: "Billing", icon: Wallet },
      { href: "/platform", label: "Platform", icon: Workflow },
      { href: "/intelligence", label: "Intelligence", icon: Cpu },
      { href: "/strategy", label: "Strategy", icon: Target },
      { href: "/media-center", label: "Media", icon: Newspaper },
      { href: "/studio", label: "Studio", icon: Tv2 },
    ],
  },
];

export default function Navbar() {
  const { user, loading } = useAuthContext();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [pushEnabled, setPushEnabled] = useState(false);
  const previousNotificationIds = useRef<string[]>([]);

  useEffect(() => {
    if (!user) {
      return;
    }

    void getCurrentUserSettings().then((settings) => {
      setPushEnabled(settings.pushNotificationsEnabled);
    });

    return subscribeToNotifications(user.uid, setNotifications);
  }, [user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    return subscribeToConversations(user.uid, setConversations);
  }, [user]);

  useEffect(() => {
    if (!user || !pushEnabled || typeof Notification === "undefined" || Notification.permission !== "granted") {
      previousNotificationIds.current = notifications.map((notification) => notification.id);
      return;
    }

    const previousIds = new Set(previousNotificationIds.current);
    notifications
      .filter((notification) => !previousIds.has(notification.id))
      .filter((notification) => !notification.readBy?.includes(user.uid))
      .slice(0, 3)
      .forEach((notification) => {
        new Notification("Kinet", {
          body: notification.message,
        });
      });

    previousNotificationIds.current = notifications.map((notification) => notification.id);
  }, [notifications, pushEnabled, user]);

  const unreadCount = user
    ? notifications.filter((notification) => !notification.readBy?.includes(user.uid)).length
    : 0;
  const unreadMessages = user
    ? conversations.filter((conversation) => conversation.unreadBy.includes(user.uid)).length
    : 0;

  return (
    <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-screen-2xl items-center justify-between">
        <Link href={user ? "/feed" : "/"} className="text-2xl font-bold gradient-text">
          Kinet
        </Link>

        <div className="flex items-center gap-2">
          {!loading && user ? (
            <>
              <div className="flex items-center gap-2 lg:hidden">
                <Link href="/feed" className="px-2 text-base font-semibold text-foreground">
                  Feed
                </Link>
                <Button variant="ghost" size="icon" asChild>
                  <Link href="/messages" className="relative">
                    <MessageCircle className="h-5 w-5" />
                    {unreadMessages ? (
                      <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                        {unreadMessages}
                      </span>
                    ) : null}
                  </Link>
                </Button>
                <Button variant="ghost" size="icon" asChild>
                  <Link href="/notifications" className="relative">
                    <Bell className="h-5 w-5" />
                    {unreadCount ? (
                      <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                        {unreadCount}
                      </span>
                    ) : null}
                  </Link>
                </Button>
                <details className="relative lg:hidden">
                  <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-md border">
                    <Menu className="h-5 w-5" />
                  </summary>
                  <div className="absolute right-0 top-12 z-50 w-[min(92vw,380px)] rounded-2xl border bg-background p-4 shadow-lg">
                    <div className="space-y-4">
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          Core
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {primaryNav.filter((item) => !["/feed", "/notifications", "/messages"].includes(item.href)).map((item) => {
                            const Icon = item.icon;
                            return (
                              <Button key={item.href} variant="ghost" size="sm" asChild className="justify-start">
                                <Link href={item.href}>
                                  {Icon ? <Icon className="mr-2 h-4 w-4" /> : null}
                                  {item.label}
                                </Link>
                              </Button>
                            );
                          })}
                        </div>
                      </div>

                      {workspaceGroups.map((group) => (
                        <div key={group.label}>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            {group.label}
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            {group.items.map((item) => {
                              const Icon = item.icon;
                              return (
                                <Button key={item.href} variant="ghost" size="sm" asChild className="justify-start">
                                  <Link href={item.href}>
                                    {Icon ? <Icon className="mr-2 h-4 w-4" /> : null}
                                    {item.label}
                                  </Link>
                                </Button>
                              );
                            })}
                          </div>
                        </div>
                      ))}

                      <div className="grid grid-cols-2 gap-2 border-t pt-3">
                        {isCurrentUserAdmin() ? (
                          <Button variant="ghost" size="sm" asChild className="justify-start">
                            <Link href="/admin">
                              <Shield className="mr-2 h-4 w-4" />
                              Admin
                            </Link>
                          </Button>
                        ) : null}
                        <Button variant="ghost" size="sm" asChild className="justify-start">
                          <Link href="/settings">
                            <Settings className="mr-2 h-4 w-4" />
                            Settings
                          </Link>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="col-span-2"
                          onClick={() => {
                            if (auth) {
                              void signOut(auth);
                            }
                          }}
                        >
                          Logout
                          <LogOut className="ml-2 h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </details>
              </div>
              <div className="hidden items-center gap-1 xl:flex">
                {primaryNav.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Button key={item.href} variant="ghost" size="sm" asChild>
                      <Link href={item.href} className={item.isAlert ? "relative" : undefined}>
                        {Icon ? <Icon className="mr-2 h-4 w-4" /> : null}
                        {item.label}
                        {item.isAlert && unreadCount ? (
                          <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                            {unreadCount}
                          </span>
                        ) : null}
                      </Link>
                    </Button>
                  );
                })}
                <Button size="sm" asChild>
                  <Link href="/upload">Create</Link>
                </Button>
              </div>
              <details className="relative hidden lg:block">
                <summary className="flex h-9 cursor-pointer list-none items-center gap-2 rounded-md border px-3 text-sm font-medium">
                  Workspaces
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </summary>
                <div className="absolute right-0 top-11 z-50 w-[420px] rounded-xl border bg-background p-4 shadow-lg">
                  <div className="space-y-4">
                    {workspaceGroups.map((group) => (
                      <div key={group.label}>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          {group.label}
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {group.items.map((item) => {
                            const Icon = item.icon;
                            return (
                              <Button key={item.href} variant="ghost" size="sm" asChild className="justify-start">
                                <Link href={item.href}>
                                  {Icon ? <Icon className="mr-2 h-4 w-4" /> : null}
                                  {item.label}
                                </Link>
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </details>
              {isCurrentUserAdmin() ? (
                <Button variant="ghost" size="sm" asChild className="hidden lg:inline-flex">
                  <Link href="/admin">
                    <Shield className="mr-2 h-4 w-4" />
                    Admin
                  </Link>
                </Button>
              ) : null}
              <Button variant="ghost" size="sm" asChild className="hidden lg:inline-flex">
                <Link href="/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="hidden lg:inline-flex"
                onClick={() => {
                  if (auth) {
                    void signOut(auth);
                  }
                }}
              >
                Logout
                <LogOut className="ml-2 h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">
                  Login
                  <LogIn className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/signup">
                  Sign Up
                  <UserPlus className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
