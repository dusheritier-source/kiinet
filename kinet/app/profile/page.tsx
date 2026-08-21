"use client";
/* eslint-disable @next/next/no-img-element -- Legacy inline highlight controls support dynamic user hosts. */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Archive, BadgeCheck, BarChart3, Bookmark, ChevronLeft, ChevronRight, Ellipsis, Eye, Film, Globe2, Grid3X3, Heart, LayoutGrid, Link2, Mail, MapPin, Music2, Pencil, Pin, PlaySquare, Plus, Repeat2, Settings, Share2, Sparkles, Tag, Trash2, UserCheck, UserX } from "lucide-react";
import { History } from "lucide-react";

import { AuthProvider, useAuthContext } from "@/components/AuthProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { deletePost, subscribeToUserPosts, togglePostLike, type FeedPost } from "@/lib/posts";
import { getCurrentUserSettings, togglePinnedPost, type UserSettings } from "@/lib/settings";
import { getCurrentUserProfile, subscribeToUserProfile, type SearchProfile } from "@/lib/user-profile";
import { getProfilesByIds, getSuggestedSocialProfiles, getTaggedProfilePosts, removeFollower, respondToFollowRequest, setPrivateProfile, subscribeToFollowRequests, type FollowRequest } from "@/lib/profile-social";
import { createProfileHighlight, deleteProfileHighlight, getProfileStories, moveProfileHighlight, renameProfileHighlight, subscribeToProfileHighlights, type ProfileHighlight } from "@/lib/profile-highlights";
import type { StoryItem } from "@/lib/stories";
import { useSearchParams } from "next/navigation";
import OptimizedMedia from "@/components/OptimizedMedia";
import KinetSignal from "@/components/KinetSignal";
import KinetVerifiedBadge from "@/components/KinetVerifiedBadge";

interface StoredProfile {
  uid?: string;
  displayName?: string;
  username?: string;
  photoURL?: string;
  coverPhotoURL?: string;
  profileTheme?: string;
  savedPosts?: string[];
  bio?: string;
  pronouns?: string;
  category?: string;
  website?: string;
  socialLinks?: Array<{ label: string; url: string }>;
  location?: string;
  role?: { bio?: string };
  followers?: string[];
  following?: string[];
  postsCount?: number;
  reelsCount?: number;
  verified?: boolean;
  settings?: { privateAccount?: boolean };
  status?: string; musicUrl?: string; accentColor?: string; contactEmail?: string;
  actionButton?: { label: string; url: string } | null;
  profileLayout?: "highlights_first" | "content_first";
  previousPhotoURL?: string | null; temporaryAvatarExpiresAt?: { seconds?: number } | null;
  avatarAlt?: string | null; coverAlt?: string | null;
  business?: {
    supportUrl?: string;
    merchUrl?: string;
    collaborationPitch?: string;
    consultation?: {
      enabled?: boolean;
      priceLabel?: string;
    };
  };
}

function normalizeStoredProfile(value: unknown): StoredProfile | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const normalized = { ...raw } as StoredProfile;
  normalized.followers = Array.isArray(raw.followers) ? raw.followers.filter((item): item is string => typeof item === "string") : [];
  normalized.following = Array.isArray(raw.following) ? raw.following.filter((item): item is string => typeof item === "string") : [];
  normalized.savedPosts = Array.isArray(raw.savedPosts) ? raw.savedPosts.filter((item): item is string => typeof item === "string") : [];
  normalized.socialLinks = Array.isArray(raw.socialLinks)
    ? raw.socialLinks.flatMap((item) => item && typeof item === "object"
      ? [{ label: String((item as Record<string, unknown>).label ?? "Link"), url: String((item as Record<string, unknown>).url ?? "") }]
      : []).filter((item) => item.url)
    : [];
  normalized.settings = raw.settings && typeof raw.settings === "object" ? raw.settings as StoredProfile["settings"] : {};
  normalized.role = raw.role && typeof raw.role === "object" ? raw.role as StoredProfile["role"] : {};
  normalized.business = raw.business && typeof raw.business === "object" ? raw.business as StoredProfile["business"] : undefined;
  normalized.actionButton = raw.actionButton && typeof raw.actionButton === "object" ? raw.actionButton as StoredProfile["actionButton"] : null;
  return normalized;
}

function getProfileThemeClass(theme?: string) {
  if (theme === "sunset") return "from-orange-500 via-rose-500 to-amber-400";
  if (theme === "court") return "from-emerald-600 via-lime-500 to-yellow-300";
  if (theme === "midnight") return "from-slate-900 via-blue-900 to-cyan-700";
  return "from-primary to-secondary";
}

import { Suspense } from "react";

function ProfilePageContent() {
  const { user } = useAuthContext();
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<StoredProfile | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [profileLoading, setProfileLoading] = useState(true);
  const [pendingPostId, setPendingPostId] = useState<string | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [contentView, setContentView] = useState<"posts" | "reels" | "reposts" | "tagged">("posts");
  const [taggedPosts, setTaggedPosts] = useState<FeedPost[]>([]);
  const [visibleCount, setVisibleCount] = useState(12);
  const [followRequests, setFollowRequests] = useState<FollowRequest[]>([]);
  const [suggestions, setSuggestions] = useState<SearchProfile[]>([]);
  const [connectionTitle, setConnectionTitle] = useState("");
  const [connectionProfiles, setConnectionProfiles] = useState<SearchProfile[]>([]);
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [shared, setShared] = useState(false);
  const [highlights, setHighlights] = useState<ProfileHighlight[]>([]);
  const [storyArchive, setStoryArchive] = useState<StoryItem[]>([]);
  const [highlightTitle, setHighlightTitle] = useState("");
  const [selectedStories, setSelectedStories] = useState<string[]>([]);
  const [showHighlightCreator, setShowHighlightCreator] = useState(false);

  useEffect(() => {
    if (!user) {
      setProfileLoading(false);
      return;
    }

    let cancelled = false;
    const refresh = searchParams.get("refresh") === "1";

    getCurrentUserProfile()
      .then((data) => {
        if (!cancelled) {
          setProfile(normalizeStoredProfile(data));
        }
      })
      .then(() => getCurrentUserSettings())
      .then((nextSettings) => {
        if (!cancelled) {
          setSettings({
            ...nextSettings,
            pinnedPosts: Array.isArray(nextSettings?.pinnedPosts) ? nextSettings.pinnedPosts.filter((item): item is string => typeof item === "string") : [],
          });
        }
      })
      .catch(() => {
        if (!cancelled) setSettings(null);
      })
      .finally(() => {
        if (!cancelled) {
          setProfileLoading(false);
        }
      });

    const unsubscribe = subscribeToUserPosts(user.uid, setPosts);
    const unsubscribeProfile = subscribeToUserProfile(user.uid, (data) => { setProfile(normalizeStoredProfile(data)); });
    const unsubscribeHighlights = subscribeToProfileHighlights(user.uid, setHighlights);
    void getProfileStories(user.uid).then(setStoryArchive).catch(() => setStoryArchive([]));
    return () => {
      cancelled = true;
      unsubscribe();
      unsubscribeProfile();
      unsubscribeHighlights();
    };
  }, [user, searchParams]);

  useEffect(() => {
    if (!user || !profile) return;
    void getTaggedProfilePosts(user.uid).then(setTaggedPosts).catch(() => setTaggedPosts([]));
    void getSuggestedSocialProfiles({ ...profile, uid: user.uid, displayName: profile.displayName || user.displayName || "User", photoURL: profile.photoURL || "", verified: Boolean(profile.verified), followers: profile.followers ?? [], following: profile.following ?? [] } as SearchProfile).then(setSuggestions).catch(() => setSuggestions([]));
    return subscribeToFollowRequests(setFollowRequests);
  }, [profile, user]);

  const initials = useMemo(() => {
    const name = profile?.displayName || user?.displayName || "Kinet User";
    return name
      .split(" ")
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");
  }, [profile?.displayName, user?.displayName]);

  const standardPosts = useMemo(
    () => posts.filter((post) => post.contentType === "post" && !post.originalPostId),
    [posts]
  );

  const reelPosts = useMemo(
    () => posts.filter((post) => post.contentType === "reel" && !post.originalPostId),
    [posts]
  );

  const reposts = useMemo(() => posts.filter((post) => Boolean(post.originalPostId)), [posts]);
  const visibleContent = (contentView === "reels" ? reelPosts : contentView === "reposts" ? reposts : contentView === "tagged" ? taggedPosts : standardPosts).slice(0, visibleCount);
  const avatarUrl = profile?.photoURL || user?.photoURL || "";
  const completionItems = [{ label: "Profile photo", complete: Boolean(avatarUrl) }, { label: "Cover image", complete: Boolean(profile?.coverPhotoURL) }, { label: "Bio", complete: Boolean(profile?.bio) }, { label: "Location", complete: Boolean(profile?.location) }, { label: "Link", complete: Boolean(profile?.website || profile?.socialLinks?.length) }, { label: "Image descriptions", complete: Boolean(profile?.avatarAlt && profile?.coverAlt) }];
  const completion = Math.round(completionItems.filter((item) => item.complete).length / completionItems.length * 100);

  const openConnections = async (title: string, ids: string[]) => {
    setConnectionTitle(title);
    setConnectionProfiles([]);
    setConnectionsLoading(true);
    try {
      setConnectionProfiles(await getProfilesByIds(ids));
    } finally {
      setConnectionsLoading(false);
    }
  };

  const highlightSection = <Card className="mx-4 mt-6"><CardContent className="p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">Story highlights</h2><p className="text-xs text-muted-foreground">Keep your favorite stories on your profile.</p></div><Button size="sm" variant="outline" onClick={() => setShowHighlightCreator((value) => !value)}><Plus className="mr-1 h-4 w-4" />New</Button></div>{showHighlightCreator ? <div className="mb-5 rounded-2xl border p-4"><Input value={highlightTitle} onChange={(event) => setHighlightTitle(event.target.value)} placeholder="Highlight title" className="mb-3" /><div className="max-h-48 space-y-2 overflow-y-auto">{storyArchive.length ? storyArchive.map((story) => <label key={story.id} className="flex cursor-pointer items-center gap-3 rounded-xl border p-2 text-sm"><input type="checkbox" checked={selectedStories.includes(story.id)} onChange={() => setSelectedStories((items) => items.includes(story.id) ? items.filter((id) => id !== story.id) : [...items, story.id])} /><img src={story.mediaUrl} alt="Story" className="h-10 w-10 rounded-lg object-cover" /><span>{(story.expiresAt?.seconds ?? 0) * 1000 < Date.now() ? "Archived story" : "Active story"}</span></label>) : <p className="text-sm text-muted-foreground">Create a story first, then save it here.</p>}</div><Button className="mt-3" size="sm" disabled={!selectedStories.length} onClick={() => void createProfileHighlight(highlightTitle, storyArchive.filter((story) => selectedStories.includes(story.id)), highlights.length).then(() => { setHighlightTitle(""); setSelectedStories([]); setShowHighlightCreator(false); })}>Create highlight</Button></div> : null}<div className="flex gap-4 overflow-x-auto pb-2">{highlights.map((highlight, index) => <div key={highlight.id} className="w-24 shrink-0 text-center"><Link href={`/highlights/${highlight.id}`}><img src={highlight.coverUrl} alt={highlight.title} className="mx-auto h-20 w-20 rounded-full border-4 object-cover" style={{ borderColor: profile?.accentColor || "#6366f1" }} /><p className="mt-1 truncate text-sm font-medium">{highlight.title}</p></Link><div className="mt-1 flex justify-center"><button aria-label="Move left" disabled={index === 0} onClick={() => void moveProfileHighlight(highlights, highlight.id, -1)}><ChevronLeft className="h-4 w-4" /></button><button aria-label="Rename" className="px-1 text-[10px] text-muted-foreground" onClick={() => { const title = window.prompt("Rename highlight", highlight.title); if (title) void renameProfileHighlight(highlight.id, title); }}>Edit</button><button aria-label="Delete" onClick={() => void deleteProfileHighlight(highlight.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></button><button aria-label="Move right" disabled={index === highlights.length - 1} onClick={() => void moveProfileHighlight(highlights, highlight.id, 1)}><ChevronRight className="h-4 w-4" /></button></div></div>)}</div></CardContent></Card>;

  const primaryActions = [
    {
      href: "/edit-profile",
      label: "Edit Profile",
      icon: Pencil,
      variant: "outline" as const,
    },
    {
      href: "/upload",
      label: "New Post",
      variant: "default" as const,
    },
  ];

  const moreToolsLinks = [
    { href: `/profile/${user?.uid || ""}`, label: "Public Preview", icon: Eye },
    { href: "/profile/insights", label: "Profile Insights", icon: BarChart3 },
    { href: "/profile/share", label: "Share & Contact Card", icon: Share2 },
    { href: "/profile/data", label: "Profile Data", icon: Archive },
    { href: "/saved", label: "Saved", icon: Bookmark },
    { href: "/drafts", label: "Drafts", icon: Film },
    { href: "/verify", label: "Verify", icon: BadgeCheck },
    { href: "/history", label: "History", icon: History },
    { href: "/media-lab", label: "Media Lab", icon: Film },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  if (profileLoading || !user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <div className="mx-auto max-w-3xl pb-20">
        <div className="px-4 pt-4">
          <div className={`relative h-52 overflow-hidden rounded-[28px] bg-gradient-to-r ${getProfileThemeClass(profile?.profileTheme)}`} style={profile?.accentColor ? { backgroundImage: `linear-gradient(135deg, ${profile.accentColor}, #111827)` } : undefined}>
            {profile?.coverPhotoURL ? (
              <OptimizedMedia src={profile.coverPhotoURL} alt={profile.coverAlt || `${profile.displayName || "User"} cover`} width={1600} height={480} sizes="100vw" priority className="absolute inset-0 h-full w-full object-cover" />
            ) : null}
            <div className="absolute inset-0 bg-black/25" />
          </div>
        </div>

        <Card className="mx-4 -mt-14 rounded-[28px] border-border/60 shadow-lg">
          <CardContent className="space-y-6 p-6">
            <div className="flex flex-col gap-5 md:flex-row md:items-start">
              <Avatar className="h-28 w-28 shrink-0 shadow-lg" style={{ boxShadow: `0 0 0 4px ${highlights.length ? (profile?.accentColor || "#6366f1") : "var(--background)"}` }}>
                <AvatarImage src={avatarUrl} alt={profile?.avatarAlt || `${profile?.displayName || "User"} profile photo`} />
                <AvatarFallback className="bg-yellow-400 text-2xl font-bold text-yellow-950">{initials || "U"}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 space-y-3 text-center md:pt-6 md:text-left">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
                    <h1 className="break-words text-3xl font-bold leading-tight">
                      {profile?.displayName || user.displayName || "Kinet User"}
                    </h1>
                    {profile?.verified ? <KinetVerifiedBadge /> : null}
                  </div>
                  <p className="text-sm text-muted-foreground">@{profile?.username || user.uid.slice(0, 8)}</p>
                  {profile?.status ? <p className="text-sm font-medium" style={{ color: profile.accentColor }}>{profile.status}</p> : null}
                  <div className="flex flex-wrap justify-center gap-2 text-xs text-muted-foreground md:justify-start">{profile?.pronouns ? <span>{profile.pronouns}</span> : null}{profile?.category ? <Badge variant="outline">{profile.category}</Badge> : null}</div>
                </div>

                {settings?.headline ? <p className="text-sm font-medium text-primary">{settings.headline}</p> : null}
                {settings?.showActivityStatus ? <div className="flex justify-center md:justify-start"><KinetSignal state={settings.availabilityStatus} isOnline /></div> : null}

                <p className="mx-auto max-w-2xl text-sm leading-7 text-muted-foreground md:mx-0 md:text-base">
                  {profile?.bio || profile?.role?.bio || "Add a bio to tell people about yourself."}
                </p>
                <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm md:justify-start">{profile?.location ? <span className="inline-flex items-center gap-1 text-muted-foreground"><MapPin className="h-4 w-4" />{profile.location}</span> : null}{profile?.website ? <a href={profile.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline"><Globe2 className="h-4 w-4" />Website</a> : null}{profile?.musicUrl ? <a href={profile.musicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary"><Music2 className="h-4 w-4" />Profile song</a> : null}{profile?.contactEmail ? <a href={`mailto:${profile.contactEmail}`} className="inline-flex items-center gap-1 text-primary"><Mail className="h-4 w-4" />Contact</a> : null}{profile?.socialLinks?.map((link) => <a key={`${link.label}-${link.url}`} href={link.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{link.label}</a>)}</div>
                {profile?.actionButton ? <Button size="sm" asChild style={{ backgroundColor: profile.accentColor || undefined }}><a href={profile.actionButton.url} target="_blank" rel="noreferrer">{profile.actionButton.label}</a></Button> : null}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <button type="button" onClick={() => void openConnections("With You", profile?.followers ?? [])} className="cursor-pointer rounded-2xl bg-muted/70 p-4 text-center hover:bg-muted active:scale-[0.98]">
                <div className="text-2xl font-bold text-primary">{profile?.followers?.length ?? 0}</div>
                <div className="text-sm text-muted-foreground">With You</div>
              </button>
              <button type="button" onClick={() => void openConnections("You’re With", profile?.following ?? [])} className="cursor-pointer rounded-2xl bg-muted/70 p-4 text-center hover:bg-muted active:scale-[0.98]">
                <div className="text-2xl font-bold">{profile?.following?.length ?? 0}</div>
                <div className="text-sm text-muted-foreground">You’re With</div>
              </button>
              <div className="rounded-2xl bg-muted/70 p-4 text-center">
                <div className="text-2xl font-bold">{standardPosts.length}</div>
                <div className="text-sm text-muted-foreground">Posts</div>
              </div>
              <div className="rounded-2xl bg-muted/70 p-4 text-center">
                <div className="text-2xl font-bold">{reelPosts.length}</div>
                <div className="text-sm text-muted-foreground">Reels</div>
              </div>
            </div>

            <div className="flex flex-col gap-3 md:flex-row">
              {primaryActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Button key={action.href} className="h-11 md:flex-1" variant={action.variant} asChild>
                    <Link href={action.href}>
                      {Icon ? <Icon className="mr-2 h-4 w-4" /> : null}
                      {action.label}
                    </Link>
                  </Button>
                );
              })}
              <Button
                className="h-11 md:flex-1"
                variant="outline"
                onClick={async () => { const url = `${window.location.origin}/profile/${user.uid}`; if (navigator.share) await navigator.share({ title: user.displayName || "Kinet profile", url }); else await navigator.clipboard.writeText(url); setShared(true); window.setTimeout(() => setShared(false), 1600); }}
              >
                {shared ? <Link2 className="mr-2 h-4 w-4 text-green-600" /> : <Share2 className="mr-2 h-4 w-4" />}{shared ? "Profile shared" : "Share profile"}
              </Button>
            </div>
            <label className="flex items-center justify-between rounded-xl border p-3 text-sm"><span><span className="block font-medium">Private account</span><span className="text-xs text-muted-foreground">Approve people before they can see your content.</span></span><input type="checkbox" checked={Boolean(profile?.settings?.privateAccount)} onChange={(event) => { const privateAccount = event.target.checked; setProfile((current) => current ? { ...current, settings: { ...current.settings, privateAccount } } : current); void setPrivateProfile(privateAccount); }} /></label>
          </CardContent>
        </Card>

        {profile?.profileLayout !== "content_first" ? highlightSection : null}

        {completion < 100 ? <Card className="mx-4 mt-6"><CardContent className="p-5"><div className="flex items-center justify-between"><h2 className="flex items-center gap-2 font-semibold"><Sparkles className="h-4 w-4 text-primary" />Complete your profile</h2><span className="text-sm font-semibold">{completion}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${completion}%` }} /></div><div className="mt-3 flex flex-wrap gap-2">{completionItems.filter((item) => !item.complete).map((item) => <span key={item.label} className="rounded-full bg-muted px-3 py-1 text-xs">Add {item.label.toLowerCase()}</span>)}</div><Button className="mt-4" size="sm" variant="outline" asChild><Link href="/edit-profile">Improve profile</Link></Button></CardContent></Card> : null}

        <div className="px-4 py-4">
          <details className="group">
            <summary className="list-none">
              <Card className="cursor-pointer transition-colors group-open:border-primary/40">
                <CardContent className="flex items-center justify-between p-5">
                  <div className="flex items-center gap-2">
                    <LayoutGrid className="h-4 w-4 text-primary" />
                    <h2 className="font-semibold">More Tools</h2>
                  </div>
                  <span className="text-sm text-muted-foreground group-open:hidden">Show</span>
                  <span className="hidden text-sm text-muted-foreground group-open:inline">Hide</span>
                </CardContent>
              </Card>
            </summary>
            <Card className="mt-3">
              <CardContent className="p-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  {moreToolsLinks.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Button key={item.href} variant="ghost" asChild className="justify-start">
                        <Link href={item.href}>
                          <Icon className="mr-2 h-4 w-4" />
                          {item.label}
                        </Link>
                      </Button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </details>
        </div>

        {profile?.business ? (
          <Card className="mx-4">
            <CardContent className="p-5">
              <h2 className="mb-3 font-semibold">Business</h2>
              <div className="flex flex-wrap gap-2">
                {profile.business.supportUrl ? (
                  <Button variant="outline" asChild>
                    <a href={profile.business.supportUrl} target="_blank" rel="noreferrer">Support Link</a>
                  </Button>
                ) : null}
                {profile.business.merchUrl ? (
                  <Button variant="outline" asChild>
                    <a href={profile.business.merchUrl} target="_blank" rel="noreferrer">Merch Link</a>
                  </Button>
                ) : null}
                <Button variant="outline" asChild>
                  <Link href="/business">Manage Business</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/bookings">Bookings</Link>
                </Button>
              </div>
              {profile.business.collaborationPitch ? (
                <p className="mt-3 text-sm text-muted-foreground">{profile.business.collaborationPitch}</p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {followRequests.length ? <Card className="mx-4 mt-6"><CardContent className="p-5"><h2 className="mb-3 flex items-center gap-2 font-semibold"><UserCheck className="h-4 w-4 text-primary" />Follow requests</h2><div className="space-y-2">{followRequests.map((request) => <div key={request.id} className="flex items-center gap-3 rounded-xl border p-3"><Avatar><AvatarImage src={request.requester?.photoURL || ""} /><AvatarFallback>{request.requester?.displayName?.slice(0, 1) || "U"}</AvatarFallback></Avatar><Link href={`/profile/${request.requesterId}`} className="min-w-0 flex-1"><p className="truncate font-medium">{request.requester?.displayName || "Kinet user"}</p><p className="truncate text-xs text-muted-foreground">@{request.requester?.username || request.requesterId.slice(0, 8)}</p></Link><Button size="sm" onClick={() => void respondToFollowRequest(request, true)}>Accept</Button><Button size="sm" variant="outline" onClick={() => void respondToFollowRequest(request, false)}>Delete</Button></div>)}</div></CardContent></Card> : null}

        {suggestions.length ? <Card className="mx-4 mt-6"><CardContent className="p-5"><h2 className="mb-3 font-semibold">People you may know</h2><div className="flex gap-3 overflow-x-auto pb-2">{suggestions.map((suggestion) => <Link key={suggestion.uid} href={`/profile/${suggestion.uid}`} className="min-w-40 rounded-2xl border p-4 text-center hover:bg-muted/40"><Avatar className="mx-auto h-14 w-14"><AvatarImage src={suggestion.photoURL || ""} /><AvatarFallback>{suggestion.displayName?.slice(0, 1) || "U"}</AvatarFallback></Avatar><p className="mt-2 truncate text-sm font-medium">{suggestion.displayName || "Kinet user"}</p><p className="truncate text-xs text-muted-foreground">@{suggestion.username || suggestion.uid.slice(0, 8)}</p></Link>)}</div></CardContent></Card> : null}

        <div className="grid gap-6 px-4">
          {settings?.pinnedPosts?.length ? (
            <Card>
              <CardContent className="p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Pin className="h-4 w-4 text-primary" />
                  <h2 className="font-semibold">Pinned Content</h2>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {posts
                    .filter((post) => settings.pinnedPosts?.includes(post.id))
                    .map((post) => (
                      <div key={post.id} className="overflow-hidden rounded-lg bg-muted">
                        {post.mediaType === "video" ? (
                          <video src={post.mediaUrl} className="aspect-square w-full object-cover" />
                        ) : (
                          <OptimizedMedia src={post.mediaUrl} alt={post.caption || "Pinned post"} width={480} height={480} sizes="33vw" className="aspect-square w-full object-cover" />
                        )}
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardContent className="p-5">
              <div className="mb-4 flex items-center gap-2">
                <Bookmark className="h-4 w-4 text-primary" />
                <h2 className="font-semibold">Saved Highlights</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                You have {profile?.savedPosts?.length ?? 0} saved posts.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Film className="h-4 w-4 text-primary" />
                  <h2 className="font-semibold">Your Content</h2>
                </div>
                <div className="flex gap-1 overflow-x-auto rounded-2xl bg-muted p-1">{([{ id: "posts", label: "Posts", icon: Grid3X3 }, { id: "reels", label: "Videos", icon: PlaySquare }, { id: "reposts", label: "Reposts", icon: Repeat2 }, { id: "tagged", label: "Tagged", icon: Tag }] as const).map((tab) => { const Icon = tab.icon; return <button key={tab.id} type="button" onClick={() => { setContentView(tab.id); setVisibleCount(12); }} className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium ${contentView === tab.id ? "bg-background shadow-sm" : "text-muted-foreground"}`}><Icon className="h-4 w-4" />{tab.label}</button>; })}</div>
              </div>

              {visibleContent.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-8 text-center">
                  <p className="font-medium">
                    {contentView === "reels" ? "No videos yet" : contentView === "reposts" ? "No reposts yet" : contentView === "tagged" ? "No tagged posts yet" : "No posts yet"}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {contentView === "tagged" ? "Posts that mention or tag you will appear here." : `Your ${contentView} will appear here.`}
                  </p>
                  <Button className="mt-4" asChild>
                    <Link href={contentView === "reels" ? "/upload" : "/upload"}>
                      {contentView === "reels" ? "Upload Reel" : "Create Post"}
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {visibleContent.map((post) => (
                    <div key={post.id} className="group relative aspect-square overflow-hidden rounded-lg bg-muted">
                      <Link
                        href={post.contentType === "reel" ? `/reels?reel=${post.id}` : `/feed?post=${post.id}`}
                        className="absolute inset-0 z-10"
                        aria-label={post.contentType === "reel" ? "Open reel" : "Open post"}
                      />
                      {post.mediaType === "video" ? (
                        <>
                          <video src={post.mediaUrl} className="h-full w-full object-cover" />
                          {post.contentType === "reel" ? (
                            <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/60 px-2 py-1 text-[11px] font-semibold text-white">
                              Reel
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <OptimizedMedia src={post.mediaUrl} alt={post.caption || "Post media"} width={640} height={640} sizes="(min-width: 768px) 33vw, 50vw" className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-110" />
                      )}
                      <button
                        type="button"
                        className="absolute bottom-2 left-2 z-20 flex items-center gap-2 rounded-full bg-black/60 px-3 py-2 text-white opacity-0 transition-all group-hover:opacity-100"
                        disabled={pendingPostId === post.id}
                        onClick={async (event) => {
                          event.preventDefault();
                          setPendingPostId(post.id);
                          try {
                            await togglePostLike(post.id, post.likes.includes(user.uid));
                          } finally {
                            setPendingPostId(null);
                          }
                        }}
                      >
                        <span className="flex items-center gap-2 text-white">
                          <Heart className={`h-5 w-5 ${post.likes.includes(user.uid) ? "fill-current text-red-400" : "fill-current"}`} />
                          <span className="text-sm font-semibold">{post.likes.length}</span>
                        </span>
                      </button>
                      {post.userId === user.uid ? <details className="absolute right-2 top-2 z-20">
                        <summary className="flex list-none items-center justify-center rounded-full bg-black/60 p-2 text-white marker:hidden">
                          <Ellipsis className="h-4 w-4" />
                        </summary>
                        <div className="absolute right-0 top-10 z-20 min-w-[140px] overflow-hidden rounded-xl border bg-background shadow-lg">
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                            onClick={() =>
                              void togglePinnedPost(
                                post.id,
                                Boolean(settings?.pinnedPosts?.includes(post.id))
                              ).then(() => getCurrentUserSettings().then(setSettings))
                            }
                          >
                            <Pin className={`h-4 w-4 ${settings?.pinnedPosts?.includes(post.id) ? "fill-current text-yellow-500" : ""}`} />
                            {settings?.pinnedPosts?.includes(post.id) ? "Unpin" : "Pin"}
                          </button>
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-muted"
                            onClick={async () => {
                              setPendingPostId(post.id);
                              try {
                                await deletePost(post.id);
                              } finally {
                                setPendingPostId(null);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </button>
                        </div>
                      </details> : null}
                    </div>
                  ))}
                </div>
              )}
              {visibleContent.length < (contentView === "reels" ? reelPosts : contentView === "reposts" ? reposts : contentView === "tagged" ? taggedPosts : standardPosts).length ? <div className="mt-5 text-center"><Button variant="outline" onClick={() => setVisibleCount((count) => count + 12)}>Load more</Button></div> : null}
            </CardContent>
          </Card>
        </div>
        {profile?.profileLayout === "content_first" ? highlightSection : null}
        {connectionTitle ? <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={() => setConnectionTitle("")}><div className="max-h-[75vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-background p-5 sm:rounded-3xl" onClick={(event) => event.stopPropagation()}><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-semibold">{connectionTitle}</h2><Button variant="ghost" size="sm" onClick={() => setConnectionTitle("")}>Close</Button></div>{connectionsLoading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading people…</p> : connectionProfiles.length ? <div className="space-y-2">{connectionProfiles.map((item) => <div key={item.uid} className="flex items-center gap-3 rounded-xl border p-3"><Avatar><AvatarImage src={item.photoURL} /><AvatarFallback>{item.displayName?.slice(0, 1) || "U"}</AvatarFallback></Avatar><Link href={`/profile/${item.uid}`} className="min-w-0 flex-1" onClick={() => setConnectionTitle("")}><p className="truncate font-medium">{item.displayName || "Kinet user"}</p><p className="truncate text-xs text-muted-foreground">@{item.username || item.uid.slice(0, 8)}</p></Link>{connectionTitle === "Followers" ? <Button size="sm" variant="outline" onClick={() => void removeFollower(item.uid).then(() => setConnectionProfiles((current) => current.filter((profileItem) => profileItem.uid !== item.uid)))}><UserX className="mr-1 h-4 w-4" />Remove</Button> : null}</div>)}</div> : <p className="py-8 text-center text-sm text-muted-foreground">No people to show.</p>}</div></div> : null}
      </div>
    </ProtectedRoute>
  );
}

export default function ProfilePage() {
  return (
    <AuthProvider>
      <Suspense fallback={<div className="flex min-h-[70vh] items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" /></div>}>
        <ProfilePageContent />
      </Suspense>
    </AuthProvider>
  );
}
