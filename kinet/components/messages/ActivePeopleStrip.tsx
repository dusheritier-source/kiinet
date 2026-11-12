import { ProfileAvatar } from "@/components/ui/avatar";

export interface ActivePerson {
  conversationId: string;
  displayName: string;
  photoURL: string;
  unread: boolean;
}

export default function ActivePeopleStrip({ people, loading, onOpen, onPrefetch }: { people: ActivePerson[]; loading: boolean; onOpen: (id: string) => void; onPrefetch: (id: string) => void }) {
  return <div className="flex gap-4 overflow-x-auto overflow-y-hidden pb-2" aria-busy={loading}>
    {loading ? <div className="flex gap-3" aria-label="Loading active conversations">{[0, 1, 2, 3].map((index) => <div key={index} className="flex w-[84px] shrink-0 flex-col items-center gap-2 opacity-60"><div className="h-[68px] w-[68px] animate-pulse rounded-full bg-muted/60" /><div className="h-3 w-20 animate-pulse rounded bg-muted/60" /></div>)}</div>
    : people.length === 0 ? <div className="rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">No active chats yet.</div>
    : people.map((person) => <button key={person.conversationId} type="button" onClick={() => onOpen(person.conversationId)} onMouseEnter={() => onPrefetch(person.conversationId)} className="flex w-[84px] shrink-0 flex-col items-center gap-2">
      <span className={`rounded-full p-[2px] ${person.unread ? "bg-gradient-to-br from-fuchsia-500 via-rose-500 to-amber-400" : "bg-muted"}`}><span className="block rounded-full bg-background p-[2px]"><ProfileAvatar src={person.photoURL} username={person.displayName} alt={person.displayName} className="h-[68px] w-[68px]" /></span></span>
      <span className="max-w-[84px] truncate text-center text-xs font-medium">{person.displayName}</span>
    </button>)}
  </div>;
}
