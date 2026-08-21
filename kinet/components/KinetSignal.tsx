import { Focus, Leaf, RadioTower } from "lucide-react";

export type KinetSignalState = "available" | "locked_in" | "recovering";

const signalStyles = {
  available: { label: "Open to connect", Icon: RadioTower, className: "border-cyan-400/25 bg-cyan-400/10 text-cyan-300", dot: "bg-cyan-300" },
  locked_in: { label: "In the zone", Icon: Focus, className: "border-violet-400/25 bg-violet-400/10 text-violet-300", dot: "bg-violet-300" },
  recovering: { label: "Recharging", Icon: Leaf, className: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300", dot: "bg-emerald-300" },
} satisfies Record<KinetSignalState, { label: string; Icon: typeof RadioTower; className: string; dot: string }>;

export default function KinetSignal({ state = "available", isOnline, compact = false }: { state?: KinetSignalState; isOnline?: boolean; compact?: boolean }) {
  const signal = signalStyles[state];
  const Icon = signal.Icon;
  return <span title="Kinet Signal" className={`inline-flex items-center gap-2 rounded-[999px_999px_999px_8px] border font-medium ${compact ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs"} ${signal.className}`}>
    <span className="relative"><Icon className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />{isOnline ? <span className={`absolute -right-0.5 -top-0.5 h-1.5 w-1.5 animate-pulse rounded-full ring-2 ring-background ${signal.dot}`} /> : null}</span>
    {signal.label}
  </span>;
}
