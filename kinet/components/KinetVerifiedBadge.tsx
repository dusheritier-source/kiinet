import { BadgeCheck } from "lucide-react";

export default function KinetVerifiedBadge({ compact = false, showLabel = false }: { compact?: boolean; showLabel?: boolean }) {
  return <span title="Verified on Kinet" aria-label="Verified on Kinet" className={`inline-flex shrink-0 items-center gap-1 font-bold ${showLabel ? "rounded-full bg-white px-2 py-1 text-xs text-slate-950 shadow-sm" : ""}`}>
    <BadgeCheck aria-hidden="true" className={`${compact ? "h-4 w-4" : "h-5 w-5"} fill-white text-slate-950 drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]`} />
    {showLabel ? "Verified" : null}
  </span>;
}
