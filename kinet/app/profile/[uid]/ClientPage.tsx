"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Grid3X3, PlaySquare, ShieldAlert, UserX } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { reportEntity, toggleBlockedUser } from "@/lib/moderation";
import { subscribeToUserPosts, type FeedPost } from "@/lib/posts";
import { recordProfileVisit } from "@/lib/profile-analytics";
import { getUserProfileById, toggleFollowUser } from "@/lib/user-profile";

interface PublicProfile {
  uid?: string;
  displayName?: string;
  username?: string;
  photoURL?: string;
  coverPhotoURL?: string;
  profileTheme?: string;
  verified?: boolean;
  blockedUsers?: string[];
  followers?: string[];
  following?: string[];
  subscriberIds?: string[];
  premiumGroupIds?: string[];
  pinnedPosts?: string[];
  settings?: {
    availabilityStatus?: string;
    headline?: string;
  };
  presence?: {
    isOnline?: boolean;
  };
  role?: {
    type?: string;
    bio?: string;
  };
}

function getProfileThemeClass(theme?: string) {
  if (theme === "sunset") return "from-orange-500 via-rose-500 to-amber-400";
  if (theme === "court") return "from-emerald-600 via-lime-500 to-yellow-300";
  if (theme === "midnight") return "from-slate-900 via-blue-900 to-cyan-700";
  return "from-primary to-secondary";
}

export default function PublicProfilePageContent() {
  const params = useParams<{ uid: string }>();
  const uid = params.uid;
  const { user } = useAuth();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [contentView, setContentView] = useState<"posts" | "reels">("posts");

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;

    getUserProfileById(uid)
      .then((data) => {
        if (!cancelled) {
          setProfile((data as PublicProfile | null) ?? null);
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));

    void recordProfileVisit(uid);

    const unsubscribe = subscribeToUserPosts(uid, setPosts);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [uid]);

  const initials = useMemo(() => {
    const name = profile?.displayName || "User";
    return name
      .split(" ")
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");
  }, [profile?.displayName]);

  const standardPosts = useMemo(
    () => posts.filter((post) => post.contentType === "post"),
    [posts]
  );

  const reelPosts = useMemo(
    () => posts.filter((post) => post.contentType === "reel"),
    [posts]
  );

  const visibleContent = contentView === "reels" ? reelPosts : standardPosts;

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (!profile || !uid) {
    return <div className="mx-auto max-w-2xl py-8">Profile not found.</div>;
  }

  const isSelf = user?.uid === uid;
  const isFollowing = Boolean(user && profile.followers?.includes(user.uid));

  return (
    <div className="mx-auto max-w-3xl py-8">
      <Card>
        <CardContent className="p-6">
          <div className={`-mx-6 -mt-6 mb-6 h-40 overflow-hidden bg-gradient-to-r ${getProfileThemeClass(profile.profileTheme)}`}>
            {profile.coverPhotoURL ? (
              <img src={profile.coverPhotoURL} alt="Cover" className="h-full w-full object-cover" />
            ) : null}
          </div>
          <div className="flex flex-col gap-6 sm:flex-row">
            <Avatar className="h-28 w-28">
              <AvatarImage src={profile.photoURL || ""} />
              <AvatarFallback className="text-2xl font-bold">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="mb-2 flex items-center gap-2">
                <h1 className="text-3xl font-bold">{profile.displayName || "User"}</h1>
                {profile.verified ? <Badge variant="secondary">Verified</Badge> : null}
              </div>
              <p className="text-sm text-muted-foreground">@{profile.username || uid.slice(0, 8)}</p>
              {profile.settings?.headline ? <p className="mt-1 text-sm font-medium text-primary">{profile.settings.headline}</p> : null}
              <p className="mt-2">{profile.role?.bio || "No bio yet."}</p>
              <div className="mt-4 flex gap-4 text-sm text-muted-foreground">
                <span>{profile.followers?.length ?? 0} followers</span>
                <span>{profile.following?.length ?? 0} following</span>
                <span>{standardPosts.length} posts</span>
                <span>{reelPosts.length} reels</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                {isSelf ? (
                  <Button asChild>
                    <Link href="/edit-profile">Edit profile</Link>
                  </Button>
                ) : (
                  <>
                    <Button
                      disabled={!user || pending}
                      onClick={async () => {
                        setPending(true);
                        try {
                          await toggleFollowUser(uid, isFollowing);
                          const refreshed = await getUserProfileById(uid);
                          setProfile((refreshed as PublicProfile | null) ?? null);
                        } finally {
                          setPending(false);
                        }
                      }}
                    >
                      {isFollowing ? "Following" : "Follow"}
                    </Button>
                    <Button variant="outline" asChild>
                      <Link href={`/messages?user=${uid}`}>Message</Link>
                    </Button>
                    <Button
                      variant="outline"
                      disabled={blocking}
                      onClick={async () => {
                        setBlocking(true);
                        try {
                          await toggleBlockedUser(uid, false);
                        } finally {
                          setBlocking(false);
                        }
                      }}
                    >
                      <UserX className="mr-2 h-4 w-4" />
                      Block
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        void reportEntity({
                          targetId: uid,
                          targetType: "user",
                          reason: "profile",
                          details: "Reported from public profile page.",
                        })
                      }
                    >
                      <ShieldAlert className="mr-2 h-4 w-4" />
                      Report
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 rounded-xl border p-4">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-semibold">Content</h2>
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-muted p-1">
            <button
              type="button"
              onClick={() => setContentView("posts")}
              className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
                contentView === "posts" ? "bg-background shadow-sm" : "text-muted-foreground"
              }`}
            >
              <Grid3X3 className="h-4 w-4" />
              Posts
            </button>
            <button
              type="button"
              onClick={() => setContentView("reels")}
              className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
                contentView === "reels" ? "bg-background shadow-sm" : "text-muted-foreground"
              }`}
            >
              <PlaySquare className="h-4 w-4" />
              Reels
            </button>
          </div>
        </div>

        {visibleContent.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-8 text-center">
            <p className="font-medium">
              {contentView === "reels" ? "No reels yet" : "No posts yet"}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {contentView === "reels"
                ? "Reels will appear here when this user publishes them."
                : "Posts will appear here when this user publishes them."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {visibleContent.map((post) => (
              <Link
                key={post.id}
                href={post.contentType === "reel" ? `/reels?reel=${post.id}` : `/feed?post=${post.id}`}
                className="group relative aspect-square overflow-hidden rounded-xl bg-muted"
              >
                {post.mediaType === "video" ? (
                  <video src={post.mediaUrl} className="h-full w-full object-cover" />
                ) : (
                  <img src={post.mediaUrl} alt={post.caption} className="h-full w-full object-cover" />
                )}
                {post.contentType === "reel" ? (
                  <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/60 px-2 py-1 text-[11px] font-semibold text-white">
                    Reel
                  </span>
                ) : null}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}