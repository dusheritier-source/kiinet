import { Search, X } from "lucide-react";

import { ProfileAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { SearchProfile } from "@/lib/user-profile";

interface NewConversationPanelProps {
  creating: boolean;
  creatingGroup: boolean;
  groupName: string;
  people: SearchProfile[];
  peopleSearch: string;
  selectedMemberIds: string[];
  onClose: () => void;
  onCreateGroup: () => void;
  onGroupNameChange: (value: string) => void;
  onModeChange: (group: boolean) => void;
  onPeopleSearchChange: (value: string) => void;
  onSelectPerson: (profile: SearchProfile) => void;
}

export default function NewConversationPanel(props: NewConversationPanelProps) {
  return <section aria-labelledby="new-conversation-title" className="mb-6 rounded-3xl border bg-background p-4 shadow-sm">
    <div className="mb-3 flex items-center justify-between">
      <h2 id="new-conversation-title" className="font-semibold">{props.creatingGroup ? "New group" : "New message"}</h2>
      <Button variant="ghost" size="icon" onClick={props.onClose} aria-label="Close new conversation"><X className="h-4 w-4" /></Button>
    </div>
    <div className="mb-3 flex gap-2" role="group" aria-label="Conversation type">
      <Button size="sm" variant={!props.creatingGroup ? "default" : "outline"} onClick={() => props.onModeChange(false)}>Direct</Button>
      <Button size="sm" variant={props.creatingGroup ? "default" : "outline"} onClick={() => props.onModeChange(true)}>Group</Button>
    </div>
    {props.creatingGroup ? <input aria-label="Group name" value={props.groupName} onChange={(event) => props.onGroupNameChange(event.target.value)} placeholder="Group name" maxLength={80} className="mb-3 h-10 w-full rounded-full border bg-muted/40 px-4 text-sm outline-none" /> : null}
    <label className="relative mb-3 block">
      <span className="sr-only">Search people</span>
      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
      <input value={props.peopleSearch} onChange={(event) => props.onPeopleSearchChange(event.target.value)} placeholder="Search people by name or username" className="h-10 w-full rounded-full border bg-muted/40 pl-10 pr-4 text-sm outline-none" autoFocus />
    </label>
    <div className="max-h-64 space-y-1 overflow-y-auto" aria-live="polite">
      {props.people.map((profile) => <button key={profile.uid} type="button" onClick={() => props.onSelectPerson(profile)} className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-muted ${props.selectedMemberIds.includes(profile.uid) ? "bg-primary/10" : ""}`} disabled={props.creating} aria-pressed={props.creatingGroup ? props.selectedMemberIds.includes(profile.uid) : undefined}>
        <ProfileAvatar src={profile.photoURL} username={profile.displayName || "Kinet User"} alt={profile.displayName || "Kinet User"} className="h-10 w-10" />
        <span className="min-w-0"><span className="block truncate font-medium">{profile.displayName || "Kinet User"}</span><span className="block truncate text-xs text-muted-foreground">{profile.username ? `@${profile.username}` : "Start a conversation"}</span></span>
      </button>)}
      {!props.creating && props.people.length === 0 ? <p className="p-4 text-center text-sm text-muted-foreground">No people found.</p> : null}
    </div>
    {props.creatingGroup ? <Button className="mt-3 w-full" onClick={props.onCreateGroup} disabled={props.creating || props.selectedMemberIds.length < 2 || props.groupName.trim().length < 2}>Create group ({props.selectedMemberIds.length + 1})</Button> : null}
  </section>;
}
