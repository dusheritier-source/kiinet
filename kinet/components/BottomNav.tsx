"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clapperboard, Home, PlusSquare, Search, User } from "lucide-react";

import { useAuthContext } from "@/components/AuthProvider";
export default function BottomNav() {
  const { user } = useAuthContext();
  const pathname = usePathname();

  if (!user || pathname === "/login" || pathname === "/signup") {
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
    <nav aria-label="Primary mobile navigation" className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
      <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center px-1">
        {items.map((item) => {
          const active = pathname === item.href || (item.href !== "/feed" && pathname.startsWith(`${item.href}/`));
          const Icon = item.icon;
          return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[10px] transition-colors active:scale-95 ${active ? "font-semibold text-foreground" : "text-muted-foreground"}`}><Icon className={`h-6 w-6 ${active ? "stroke-[2.6]" : "stroke-[1.8]"}`} /><span>{item.label}</span>{active ? <span className="absolute bottom-0 h-1 w-1 rounded-full bg-primary" /> : null}</Link>;
        })}
      </div>
    </nav>
  );
}
