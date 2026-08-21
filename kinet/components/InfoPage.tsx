import Link from "next/link";
import { ArrowLeft, type LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

export type InfoSection = { title: string; content: React.ReactNode };

export default function InfoPage({ eyebrow, title, description, icon: Icon, sections, updated }: { eyebrow: string; title: string; description: string; icon: LucideIcon; sections: InfoSection[]; updated?: string }) {
  return (
    <div className="mx-auto max-w-3xl px-1 py-6 sm:py-10">
      <Link href="/settings" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Back to settings</Link>
      <header className="mb-8 rounded-3xl border bg-gradient-to-br from-primary/15 via-background to-background p-6 sm:p-10">
        <span className="mb-5 inline-flex rounded-2xl bg-primary/10 p-3 text-primary"><Icon className="h-7 w-7" /></span>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-primary">{eyebrow}</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">{description}</p>
        {updated ? <p className="mt-4 text-xs text-muted-foreground">Last updated: {updated}</p> : null}
      </header>
      <div className="space-y-4">{sections.map((section) => <Card key={section.title} className="rounded-2xl"><CardContent className="p-6"><h2 className="text-xl font-semibold">{section.title}</h2><div className="mt-3 space-y-3 text-sm leading-7 text-muted-foreground">{section.content}</div></CardContent></Card>)}</div>
      <nav aria-label="Kinet information" className="mt-8 flex flex-wrap gap-x-5 gap-y-3 border-t pt-6 text-sm text-muted-foreground">
        <Link className="hover:text-primary" href="/about">About</Link><Link className="hover:text-primary" href="/contact">Contact</Link><Link className="hover:text-primary" href="/help">Help Center</Link><Link className="hover:text-primary" href="/privacy">Privacy</Link><Link className="hover:text-primary" href="/terms">Terms</Link><Link className="hover:text-primary" href="/community-guidelines">Community Guidelines</Link>
      </nav>
    </div>
  );
}
