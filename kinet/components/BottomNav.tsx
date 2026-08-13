"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Clapperboard, Home, PlusSquare, Search, User } from "lucide-react";

import { useAuthContext } from "@/components/AuthProvider";
export default function BottomNav() {
  const { user } = useAuthContext();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isConversationOpen = pathname.startsWith("/messages") && searchParams.has("conversation");

  if (!user || pathname === "/login" || pathname === "/signup" || isConversationOpen) {
    return null;
  }

  const items = [
    { href: "/feed", label: "Home", icon: Home },
    { href: "/search", label: "Search", icon: Search },
    { href: "/upload", label: "Create", icon: PlusSquare },
    { href: "/reels", label: "Reels", icon: Clapperboard },
    { href: "/profile", label: "Profile", icon: User },
  ];

  return (
    <nav aria-label="Primary mobile navigation" className="fixed inset-x-0 bottom-0 z-[90] border-t border-border bg-background pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(0,0,0,0.35)] md:hidden">
      <div className="mx-auto grid min-h-[4.5rem] w-full max-w-lg grid-cols-5 items-center px-2 pt-1">
        {items.map((item) => {
          const active = pathname === item.href || (item.href !== "/feed" && pathname.startsWith(`${item.href}/`));
          const Icon = item.icon;
          return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`relative flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] transition-colors active:scale-95 ${active ? "bg-primary/10 font-bold text-primary" : "font-medium text-foreground/75"}`}><Icon className={`h-7 w-7 ${active ? "stroke-[2.8]" : "stroke-2"}`} /><span>{item.label}</span>{active ? <span className="absolute bottom-1 h-1 w-4 rounded-full bg-primary" /> : null}</Link>;
        })}
      </div>
    </nav>
  );
}
