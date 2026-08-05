"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { BadgeCheck, Globe2, Grid3X3, Heart, Lock, Mail, MapPin, Music2, PlaySquare, Repeat2, Share2, ShieldAlert, Star, Tag, UserX } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { reportEntity, toggleBlockedUser } from "@/lib/moderation";
import { subscribeToUserPosts, type FeedPost } from "@/lib/posts";
import { recordProfileVisit } from "@/lib/profile-analytics";
import { getUserProfileById, subscribeToUserProfile, toggleFollowUser } from "@/lib/user-profile";
import { getTaggedProfilePosts, hasPendingFollowRequest, toggleSocialList } from "@/lib/profile-social";
import DefaultAvatar from "@/components/DefaultAvatar";
import { subscribeToProfileHighlights, type ProfileHighlight } from "@/lib/profile-highlights";

interface PublicProfile {
  uid?: string;
  displayName?: string;
  username?: string;
  photoURL?: string;
  coverPhotoURL?: string;
  profileTheme?: string;
  verified?: boolean;
  bio?: string;
  pronouns?: string;
  category?: string;
  location?: string;
  website?: string;
  socialLinks?: Array<{ label: string; url: string }>;
  status?: string; musicUrl?: string; accentColor?: string; contactEmail?: string;
  actionButton?: { label: string; url: string } | null;
  previousPhotoURL?: string | null; temporaryAvatarExpiresAt?: { seconds?: number } | null;
  avatarAlt?: string | null; coverAlt?: string | null;
  closeFriends?: string[];
  favoriteUsers?: string[];
  blockedUsers?: string[];
  followers?: string[];
  following?: string[];
  subscriberIds?: string[];
  premiumGroupIds?: string[];
  pinnedPosts?: string[];
  settings?: {
    availabilityStatus?: string;
    headline?: string;
    privateAccount?: boolean;
    showActivityStatus?: boolean;
    showFollowerCounts?: boolean;
    allowProfileSharing?: boolean;
    storyReplyAudience?: "everyone" | "following" | "no_one";
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
  const [contentView, setContentView] = useState<"posts" | "reels" | "reposts" | "tagged">("posts");
  const [taggedPosts, setTaggedPosts] = useState<FeedPost[]>([]);
  const [currentProfile, setCurrentProfile] = useState<PublicProfile | null>(null);
  const [visibleCount, setVisibleCount] = useState(12);
  const [followRequested, setFollowRequested] = useState(false);
  const [shared, setShared] = useState(false);
  const [highlights, setHighlights] = useState<ProfileHighlight[]>([]);

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
    if (user) void getUserProfileById(user.uid).then((data) => setCurrentProfile(data as PublicProfile | null));
    const unsubscribeProfile = subscribeToUserProfile(uid, (data) => { if (data) setProfile(data as PublicProfile); });
    if (user && user.uid !== uid) void hasPendingFollowRequest(uid).then(setFollowRequested);
    return () => {
      cancelled = true;
      unsubscribeProfile();
    };
  }, [uid, user]);

  const viewerCanViewContent = Boolean(profile && (user?.uid === uid || profile.settings?.privateAccount !== true || (user && profile.followers?.includes(user.uid))));

  useEffect(() => {
    if (!uid || !viewerCanViewContent) {
      setPosts([]);
      setTaggedPosts([]);
      setHighlights([]);
      return;
    }
    const unsubscribePosts = subscribeToUserPosts(uid, setPosts);
    const unsubscribeHighlights = subscribeToProfileHighlights(uid, setHighlights);
    void getTaggedProfilePosts(uid).then(setTaggedPosts);
    return () => {
      unsubscribePosts();
      unsubscribeHighlights();
    };
  }, [uid, viewerCanViewContent]);

  const initials = useMemo(() => {
    const name = profile?.displayName || "User";
    return name
      .split(" ")
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");
  }, [profile?.displayName]);

  const standardPosts = useMemo(
    () => posts.filter((post) => post.contentType === "post" && !post.originalPostId),
    [posts]
  );

  const reelPosts = useMemo(
    () => posts.filter((post) => post.contentType === "reel" && !post.originalPostId),
    [posts]
  );

  const reposts = useMemo(() => posts.filter((post) => Boolean(post.originalPostId)), [posts]);
  const allVisibleContent = contentView === "reels" ? reelPosts : contentView === "reposts" ? reposts : contentView === "tagged" ? taggedPosts : standardPosts;
  const visibleContent = allVisibleContent.slice(0, visibleCount);

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
  const isPrivate = profile.settings?.privateAccount === true;
  const canViewContent = isSelf || isFollowing || !isPrivate;
  const mutualCount = (profile.followers ?? []).filter((followerId) => currentProfile?.following?.includes(followerId)).length;
  const temporaryAvatarActive = Boolean(profile.temporaryAvatarExpiresAt?.seconds && profile.temporaryAvatarExpiresAt.seconds * 1000 > Date.now());
  const avatarUrl = temporaryAvatarActive ? (profile.photoURL || "") : (profile.previousPhotoURL || profile.photoURL || "");

  return (
    <div className="mx-auto max-w-3xl py-8">
      <Card>
        <CardContent className="p-6">
          <div className={`-mx-6 -mt-6 mb-6 h-40 overflow-hidden bg-gradient-to-r ${getProfileThemeClass(profile.profileTheme)}`} style={profile.accentColor ? { backgroundImage: `linear-gradient(135deg, ${profile.accentColor}, #111827)` } : undefined}>
            {profile.coverPhotoURL ? (
              <img src={profile.coverPhotoURL} alt={profile.coverAlt || `${profile.displayName || "User"} cover`} fetchPriority="high" className="h-full w-full object-cover" />
            ) : null}
          </div>
          <div className="flex flex-col gap-6 sm:flex-row">
            <Avatar className="h-28 w-28" style={{ boxShadow: highlights.length ? `0 0 0 4px ${profile.accentColor || "#6366f1"}` : undefined }}>
              {avatarUrl ? (
                <AvatarImage src={avatarUrl} alt={profile.avatarAlt || `${profile.displayName || "User"} profile photo`} />
              ) : (
                <AvatarFallback>
                  <DefaultAvatar username={profile.displayName || "User"} className="h-full w-full" />
                </AvatarFallback>
              )}
            </Avatar>
            <div className="flex-1">
              <div className="mb-2 flex items-center gap-2">
                <h1 className="text-3xl font-bold">{profile.displayName || "User"}</h1>
                {profile.verified ? <Badge variant="secondary" className="gap-1"><BadgeCheck className="h-3 w-3 text-primary" />Verified</Badge> : null}
              </div>
              <p className="text-sm text-muted-foreground">@{profile.username || uid.slice(0, 8)}</p>
              {profile.status ? <p className="mt-1 text-sm font-medium" style={{ color: profile.accentColor }}>{profile.status}</p> : null}
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">{profile.pronouns ? <span>{profile.pronouns}</span> : null}{profile.category ? <Badge variant="outline">{profile.category}</Badge> : null}</div>
              {profile.settings?.headline ? <p className="mt-1 text-sm font-medium text-primary">{profile.settings.headline}</p> : null}
              {profile.settings?.showActivityStatus !== false ? <p className="mt-1 text-xs text-muted-foreground">{profile.presence?.isOnline ? "● Active now" : "Offline"}</p> : null}
              <p className="mt-2 leading-6">{profile.bio || profile.role?.bio || "No bio yet."}</p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">{profile.location ? <span className="inline-flex items-center gap-1 text-muted-foreground"><MapPin className="h-4 w-4" />{profile.location}</span> : null}{profile.website ? <a href={profile.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline"><Globe2 className="h-4 w-4" />Website</a> : null}{profile.musicUrl ? <a href={profile.musicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary"><Music2 className="h-4 w-4" />Profile song</a> : null}{profile.contactEmail ? <a href={`mailto:${profile.contactEmail}`} className="inline-flex items-center gap-1 text-primary"><Mail className="h-4 w-4" />Contact</a> : null}{profile.socialLinks?.map((link) => <a key={`${link.label}-${link.url}`} href={link.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{link.label}</a>)}</div>
              {profile.actionButton ? <Button className="mt-3" size="sm" asChild style={{ backgroundColor: profile.accentColor || undefined }}><a href={profile.actionButton.url} target="_blank" rel="noreferrer">{profile.actionButton.label}</a></Button> : null}
              <div className="mt-4 flex gap-4 text-sm text-muted-foreground">
                {profile.settings?.showFollowerCounts !== false ? <>
                <span>{profile.followers?.length ?? 0} followers</span>
                <span>{profile.following?.length ?? 0} following</span>
                </> : null}
                <span>{standardPosts.length} posts</span>
                <span>{reelPosts.length} reels</span>
                {mutualCount ? <span className="text-primary">{mutualCount} mutual</span> : null}
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
                          const result = await toggleFollowUser(uid, isFollowing);
                          if (result === "requested") setFollowRequested(true);
                          const refreshed = await getUserProfileById(uid);
                          setProfile((refreshed as PublicProfile | null) ?? null);
                        } finally {
                          setPending(false);
                        }
                      }}
                    >
                      {isFollowing ? "Following" : followRequested ? "Requested" : "Follow"}
                    </Button>
                    <Button variant="outline" asChild>
                      <Link href={`/messages?user=${uid}`}>Message</Link>
                    </Button>
                    {profile.settings?.allowProfileSharing !== false ? <Button variant="outline" onClick={async () => { const url = window.location.href; if (navigator.share) await navigator.share({ title: profile.displayName || "Kinet profile", url }); else await navigator.clipboard.writeText(url); setShared(true); window.setTimeout(() => setShared(false), 1600); }}><Share2 className="mr-2 h-4 w-4" />{shared ? "Shared" : "Share"}</Button> : null}
                    {isFollowing ? <Button variant="outline" onClick={() => void toggleSocialList(uid, "closeFriends", Boolean(currentProfile?.closeFriends?.includes(uid))).then(() => setCurrentProfile((current) => current ? { ...current, closeFriends: current.closeFriends?.includes(uid) ? current.closeFriends.filter((id) => id !== uid) : [...(current.closeFriends ?? []), uid] } : current))}><Star className="mr-2 h-4 w-4" />{currentProfile?.closeFriends?.includes(uid) ? "Close friend" : "Close Friends"}</Button> : null}
                    <Button variant="outline" onClick={() => void toggleSocialList(uid, "favoriteUsers", Boolean(currentProfile?.favoriteUsers?.includes(uid))).then(() => setCurrentProfile((current) => current ? { ...current, favoriteUsers: current.favoriteUsers?.includes(uid) ? current.favoriteUsers.filter((id) => id !== uid) : [...(current.favoriteUsers ?? []), uid] } : current))}><Heart className={`mr-2 h-4 w-4 ${currentProfile?.favoriteUsers?.includes(uid) ? "fill-current text-red-500" : ""}`} />Favorite</Button>
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
      {canViewContent && highlights.length ? <Card className="mt-6"><CardContent className="p-5"><h2 className="mb-4 font-semibold">Story highlights</h2><div className="flex gap-4 overflow-x-auto pb-2">{highlights.map((highlight) => <Link key={highlight.id} href={`/highlights/${highlight.id}`} className="w-24 shrink-0 text-center"><img src={highlight.coverUrl} alt={highlight.title} loading="lazy" className="mx-auto h-20 w-20 rounded-full border-4 object-cover" style={{ borderColor: profile.accentColor || "#6366f1" }} /><p className="mt-1 truncate text-sm font-medium">{highlight.title}</p></Link>)}</div></CardContent></Card> : null}

      {canViewContent && profile.pinnedPosts?.length ? <section className="mt-6 rounded-2xl border p-4"><h2 className="mb-3 font-semibold">Pinned posts</h2><div className="grid grid-cols-3 gap-2">{posts.filter((post) => profile.pinnedPosts?.includes(post.id)).slice(0, 3).map((post) => <Link key={post.id} href={`/post/${post.id}`} className="aspect-square overflow-hidden rounded-xl bg-muted">{post.mediaType === "video" ? <video src={post.mediaUrl} muted className="h-full w-full object-cover" /> : <img src={post.mediaUrl} alt={post.caption} className="h-full w-full object-cover" />}</Link>)}</div></section> : null}

      <div className="mt-6 rounded-xl border p-4">
        {!canViewContent ? <div className="py-14 text-center"><Lock className="mx-auto h-10 w-10 text-muted-foreground" /><h2 className="mt-3 font-semibold">This account is private</h2><p className="mt-1 text-sm text-muted-foreground">Follow this account to see its posts and videos.</p></div> : <>
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-semibold">Content</h2>
          <div className="flex gap-1 overflow-x-auto rounded-2xl bg-muted p-1">{([{ id: "posts", label: "Posts", icon: Grid3X3 }, { id: "reels", label: "Videos", icon: PlaySquare }, { id: "reposts", label: "Reposts", icon: Repeat2 }, { id: "tagged", label: "Tagged", icon: Tag }] as const).map((tab) => { const Icon = tab.icon; return <button key={tab.id} type="button" onClick={() => { setContentView(tab.id); setVisibleCount(12); }} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-xl px-3 py-2 text-sm ${contentView === tab.id ? "bg-background shadow-sm" : "text-muted-foreground"}`}><Icon className="h-4 w-4" />{tab.label}</button>; })}</div>
        </div>

        {visibleContent.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-8 text-center">
            <p className="font-medium">
              {contentView === "reels" ? "No videos yet" : contentView === "reposts" ? "No reposts yet" : contentView === "tagged" ? "No tagged posts yet" : "No posts yet"}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {contentView === "tagged" ? "Posts mentioning this person will appear here." : `This person's ${contentView} will appear here.`}
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
        {visibleContent.length < allVisibleContent.length ? <div className="mt-5 text-center"><Button variant="outline" onClick={() => setVisibleCount((count) => count + 12)}>Load more</Button></div> : null}
        </>}
      </div>
    </div>
  );
}
