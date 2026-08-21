import { Sparkle } from "lucide-react";

export default function KinetVerifiedBadge({ compact = false, showLabel = true }: { compact?: boolean; showLabel?: boolean }) {
  return <span title="Verified on Kinet" aria-label="Verified on Kinet" className={`inline-flex shrink-0 items-center gap-1.5 bg-white font-bold text-slate-950 shadow-[0_4px_16px_rgba(255,255,255,0.18)] ${compact ? "rounded-[12px_12px_12px_4px] px-1.5 py-1 text-[10px]" : "rounded-[15px_15px_15px_5px] px-2.5 py-1.5 text-xs"}`}>
    <Sparkle className={`${compact ? "h-3 w-3" : "h-3.5 w-3.5"} fill-slate-950`} />
    {showLabel ? "Verified" : null}
  </span>;
}
