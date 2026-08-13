"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

import { getUserProfileById } from "@/lib/user-profile";
import OptimizedMedia from "@/components/OptimizedMedia";

export default function EmbeddedProfileWidgetContent() {
  const params = useParams<{ uid: string }>();
  const uid = params.uid;
  const { user } = useAuth();
  const [profile, setProfile] = useState<Awaited<ReturnType<typeof getUserProfileById>> | null>(null);

  useEffect(() => {
    if (!uid) return;
    void getUserProfileById(uid).then(setProfile);
  }, [uid]);

  const isSelf = user?.uid === uid;
  const isFollowing = Boolean(user && profile?.followers?.includes(user.uid));
  const isFollowedBy = Boolean(user && profile?.following?.includes(user.uid));
  const isPrivate = profile?.settings?.privateAccount === true;
  const canViewProfile = isSelf || !isPrivate || (isFollowing && isFollowedBy);

  const entry = profile as { displayName?: string; photoURL?: string; role?: { sport?: string; position?: string; team?: string }; settings?: { headline?: string } } | null;

  if (!canViewProfile) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-2xl border bg-background p-4">
        <p className="text-sm text-muted-foreground">This account is private.</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full rounded-2xl border bg-background p-4">
      <div className="flex items-center gap-3">
        <OptimizedMedia src={entry?.photoURL || "https://placehold.co/96x96?text=HL"} alt={entry?.displayName || "Profile"} width={64} height={64} sizes="64px" className="h-16 w-16 rounded-full object-cover" />
        <div>
          <p className="font-semibold">{entry?.displayName || "Kinet User"}</p>
          <p className="text-sm text-muted-foreground">{[entry?.role?.sport, entry?.role?.position, entry?.role?.team].filter(Boolean).join(" • ")}</p>
          {entry?.settings?.headline ? <p className="text-xs text-primary">{entry.settings.headline}</p> : null}
        </div>
      </div>
    </div>
  );
}
