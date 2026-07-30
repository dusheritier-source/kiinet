"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Bookmark, Dribbble, Ellipsis, Film, Grid3X3, Heart, LayoutGrid, Link2, Pencil, Pin, PlaySquare, Settings, Trash2 } from "lucide-react";
import { History } from "lucide-react";

import { AuthProvider, useAuthContext } from "@/components/AuthProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { deletePost, subscribeToUserPosts, togglePostLike, type FeedPost } from "@/lib/posts";
import { getCurrentUserSettings, togglePinnedPost, type UserSettings } from "@/lib/settings";
import { getCurrentUserProfile } from "@/lib/user-profile";

interface StoredProfile {
  uid?: string;
  displayName?: string;
  username?: string;
  photoURL?: string;
  coverPhotoURL?: string;
  profileTheme?: string;
  savedPosts?: string[];
  bio?: string;
  role?: { bio?: string };
  followers?: string[];
  following?: string[];
  postsCount?: number;
  reelsCount?: number;
  verified?: boolean;
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

function getProfileThemeClass(theme?: string) {
  if (theme === "sunset") return "from-orange-500 via-rose-500 to-amber-400";
  if (theme === "court") return "from-emerald-600 via-lime-500 to-yellow-300";
  if (theme === "midnight") return "from-slate-900 via-blue-900 to-cyan-700";
  return "from-primary to-secondary";
}

function ProfilePageContent() {
  const { user } = useAuthContext();
  const [profile, setProfile] = useState<StoredProfile | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [profileLoading, setProfileLoading] = useState(true);
  const [pendingPostId, setPendingPostId] = useState<string | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [contentView, setContentView] = useState<"posts" | "reels">("posts");

  useEffect(() => {
    if (!user) {
      setProfileLoading(false);
      return;
    }

    let cancelled = false;

    getCurrentUserProfile()
      .then((data) => {
        if (!cancelled) {
          setProfile((data as StoredProfile | null) ?? null);
        }
      })
      .then(() => getCurrentUserSettings())
      .then((nextSettings) => {
        if (!cancelled) {
          setSettings(nextSettings);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setProfileLoading(false);
        }
      });

    const unsubscribe = subscribeToUserPosts(user.uid, setPosts);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [user]);

  const initials = useMemo(() => {
    const name = user?.displayName || profile?.displayName || "Kinet User";
    return name
      .split(" ")
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");
  }, [profile?.displayName, user?.displayName]);

  const standardPosts = useMemo(
    () => posts.filter((post) => post.contentType === "post"),
    [posts]
  );

  const reelPosts = useMemo(
    () => posts.filter((post) => post.contentType === "reel"),
    [posts]
  );

  const visibleContent = contentView === "reels" ? reelPosts : standardPosts;

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
          <div className={`relative h-52 overflow-hidden rounded-[28px] bg-gradient-to-r ${getProfileThemeClass(profile?.profileTheme)}`}>
            {profile?.coverPhotoURL ? (
              <img src={profile.coverPhotoURL} alt="Cover" className="absolute inset-0 h-full w-full object-cover" />
            ) : null}
            <div className="absolute inset-0 bg-black/25" />
          </div>
        </div>

        <Card className="mx-4 -mt-14 rounded-[28px] border-border/60 shadow-lg">
          <CardContent className="space-y-6 p-6">
            <div className="flex flex-col gap-5 md:flex-row md:items-start">
              <Avatar className="h-28 w-28 shrink-0 ring-4 ring-background shadow-lg">
                <AvatarImage src={user.photoURL || profile?.photoURL || ""} />
                <AvatarFallback className="bg-yellow-400 text-2xl font-bold text-yellow-950">{initials || "U"}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 space-y-3 text-center md:pt-6 md:text-left">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
                    <h1 className="break-words text-3xl font-bold leading-tight">
                      {user.displayName || profile?.displayName || "Kinet User"}
                    </h1>
                    {profile?.verified ? (
                      <Badge variant="secondary" className="gap-1">
                        <Dribbble className="h-3 w-3" />
                        Verified
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-sm text-muted-foreground">@{profile?.username || user.uid.slice(0, 8)}</p>
                </div>

                {settings?.headline ? <p className="text-sm font-medium text-primary">{settings.headline}</p> : null}

                <p className="mx-auto max-w-2xl text-sm leading-7 text-muted-foreground md:mx-0 md:text-base">
                  {profile?.bio || profile?.role?.bio || "Add a bio to tell people about yourself."}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-2xl bg-muted/70 p-4 text-center">
                <div className="text-2xl font-bold text-primary">{profile?.followers?.length ?? 0}</div>
                <div className="text-sm text-muted-foreground">Followers</div>
              </div>
              <div className="rounded-2xl bg-muted/70 p-4 text-center">
                <div className="text-2xl font-bold">{profile?.following?.length ?? 0}</div>
                <div className="text-sm text-muted-foreground">Following</div>
              </div>
              <div className="rounded-2xl bg-muted/70 p-4 text-center">
                <div className="text-2xl font-bold">{profile?.postsCount ?? standardPosts.length}</div>
                <div className="text-sm text-muted-foreground">Posts</div>
              </div>
              <div className="rounded-2xl bg-muted/70 p-4 text-center">
                <div className="text-2xl font-bold">{profile?.reelsCount ?? reelPosts.length}</div>
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
                onClick={() => void navigator.clipboard.writeText(`${window.location.origin}/profile/${user.uid}`)}
              >
                <Link2 className="mr-2 h-4 w-4" />
                Copy Profile Link
              </Button>
            </div>
          </CardContent>
        </Card>

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
                    .filter((post) => settings.pinnedPosts.includes(post.id))
                    .map((post) => (
                      <div key={post.id} className="overflow-hidden rounded-lg bg-muted">
                        {post.mediaType === "video" ? (
                          <video src={post.mediaUrl} className="aspect-square w-full object-cover" />
                        ) : (
                          <img src={post.mediaUrl} alt={post.caption || "Pinned post"} className="aspect-square w-full object-cover" />
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
                      ? "Upload a reel and it will appear here on your profile."
                      : "Create a post and it will appear here on your profile."}
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
                        <img src={post.mediaUrl} alt={post.caption || "Post media"} className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-110" />
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
                      <details className="absolute right-2 top-2 z-20">
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
                      </details>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  );
}

export default function ProfilePage() {
  return (
    <AuthProvider>
      <ProfilePageContent />
    </AuthProvider>
  );
}
