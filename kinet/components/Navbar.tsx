"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Clapperboard, CirclePlay, Compass, GraduationCap, Home, LineChart, LogIn, LogOut, Map, Menu, MessageCircle, Newspaper, Plus, Radio, Search, Settings, Shield, UserPlus, Users } from "lucide-react";
import { markNotificationDelivered, subscribeToNotifications, type AppNotification } from "@/lib/notifications";
import { getCurrentUserSettings } from "@/lib/settings";
import { useAdminClaim } from "@/hooks/useAdminClaim";
import { useAuthContext } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { subscribeToConversations, type ConversationSummary } from "@/lib/messaging";
import OptimizedMedia from "@/components/OptimizedMedia";
import InstallAppButton from "@/components/InstallAppButton";

const primaryNav = [
  { href: "/feed", label: "Feed", icon: Home },
  { href: "/search", label: "Search", icon: Search },
  { href: "/stories", label: "Stories", icon: CirclePlay },
  { href: "/reels", label: "Reels", icon: Clapperboard },
  { href: "/notifications", label: "Alerts", icon: Bell, isAlert: true },
  { href: "/profile", label: "Profile" },
  { href: "/messages", label: "Messages" },
];

export default function Navbar() {
  const { isAdmin } = useAdminClaim();
  const { user, loading } = useAuthContext();
  const pathname = usePathname();
  const router = useRouter();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [pushEnabled, setPushEnabled] = useState(false);
  const previousNotificationIds = useRef<string[]>([]);
  const deliveredNotificationIds = useRef<Set<string>>(new Set());

  const isAuthPage = pathname === "/login" || pathname === "/signup";

  useEffect(() => {
    if (!user) return;

    // Messages is a high-frequency destination and has a large interactive bundle.
    // Warm it as soon as authentication is ready so opening the inbox does not wait
    // for a route request after the user taps the icon.
    router.prefetch("/messages");

    const prefetchCommonRoutes = () => {
      ["/feed", "/search", "/stories", "/reels", "/notifications", "/profile", "/upload"].forEach((route) => {
        router.prefetch(route);
      });
    };

    const requestIdle = window.requestIdleCallback;
    if (typeof requestIdle === "function") {
      const idleId = requestIdle(prefetchCommonRoutes, { timeout: 2000 });
      return () => window.cancelIdleCallback(idleId);
    }

    const timer = window.setTimeout(prefetchCommonRoutes, 500);
    return () => window.clearTimeout(timer);
  }, [router, user]);

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
      .filter((notification) => !(pathname === "/messages" && notification.conversationId && new URLSearchParams(window.location.search).get("conversation") === notification.conversationId))
      .slice(0, 3)
      .forEach((notification) => {
        new Notification("Kinet", {
          body: notification.message,
        });
      });

    previousNotificationIds.current = notifications.map((notification) => notification.id);
  }, [notifications, pathname, pushEnabled, user]);

  useEffect(() => {
    if (!user) return;
    notifications.filter((item) => !deliveredNotificationIds.current.has(item.id) && item.deliveryStatus === "queued").forEach((item) => { deliveredNotificationIds.current.add(item.id); void markNotificationDelivered(item.id); });
  }, [notifications, user]);

  const unreadCount = user
    ? notifications.filter((notification) => !notification.readBy?.includes(user.uid)).length
    : 0;
  const unreadMessages = user
    ? conversations.filter((conversation) => conversation.unreadBy.includes(user.uid)).length
    : 0;

  return (
    <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-screen-2xl items-center justify-between">
        <Link href={user ? "/feed" : "/"} aria-label="Kinet home" className="flex items-center gap-2">
          <OptimizedMedia src="/icon-192.png" alt="" width={36} height={36} priority className="h-9 w-9 rounded-xl object-cover shadow-sm" />
          <span className="hidden text-2xl font-bold gradient-text sm:inline">Kinet</span>
        </Link>

        <div className="flex items-center gap-2">
          <div className="hidden sm:block"><InstallAppButton /></div>
          <div className="sm:hidden"><InstallAppButton compact /></div>
          {!loading && user && !isAuthPage ? (
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

                      <div className="grid grid-cols-2 gap-2 border-t pt-3">
                        {isAdmin ? (
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
                        <Button variant="outline" size="sm" className="col-span-2" asChild>
                          <Link href="/feed">
                            Continue
                            <LogOut className="ml-2 h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                </details>
              </div>
              <div className="hidden items-center gap-1 lg:flex">
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
              {isAdmin ? (
                <Button variant="ghost" size="sm" asChild className="hidden xl:inline-flex">
                  <Link href="/admin">
                    <Shield className="mr-2 h-4 w-4" />
                    Admin
                  </Link>
                </Button>
              ) : null}
              <Button variant="ghost" size="sm" asChild className="hidden xl:inline-flex">
                <Link href="/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </Button>
              <Button variant="outline" size="sm" className="hidden xl:inline-flex" asChild>
                <Link href="/feed">
                  Continue
                  <LogOut className="ml-2 h-4 w-4" />
                </Link>
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
