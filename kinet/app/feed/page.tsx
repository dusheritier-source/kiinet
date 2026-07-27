"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Bookmark,
  CornerDownRight,
  Heart,
  MessageCircle,
  Pencil,
  Repeat2,
  Share2,
  ShieldAlert,
  Trash2,
} from "lucide-react";

import { AuthProvider, useAuthContext } from "@/components/AuthProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  FeedPost,
  PostComment,
  addPostComment,
  deletePost,
  formatTimeAgo,
  recordPostView,
  repostPost,
  subscribeToComments,
  subscribeToFeed,
  toggleCommentReaction,
  togglePollVote,
  togglePostLike,
  toggleSavePost,
  updatePost,
} from "@/lib/posts";
import { reportEntity } from "@/lib/moderation";
import { formatStoryTime, getActiveStories, type StoryItem } from "@/lib/stories";

const COMMENT_REACTIONS = ["🔥", "👏", "💯"];

function RichText({ text }: { text: string }) {
  const parts = text.split(/(\#[a-z0-9_]+|\@[a-z0-9_]+)/gi);

  return (
    <>
      {parts.map((part, index) => {
        if (!part) {
          return null;
        }

        if (part.startsWith("#")) {
          const tag = part.replace("#", "").toLowerCase();
          return (
            <Link key={`${part}-${index}`} href={`/topics/${tag}`} className="font-medium text-primary hover:underline">
              {part}
            </Link>
          );
        }

        if (part.startsWith("@")) {
          return (
            <Link key={`${part}-${index}`} href={`/search?q=${encodeURIComponent(part)}`} className="font-medium text-primary hover:underline">
              {part}
            </Link>
          );
        }

        return <Fragment key={`${part}-${index}`}>{part}</Fragment>;
      })}
    </>
  );
}

function FeedPageContent() {
  const { user, loading } = useAuthContext();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [feedError, setFeedError] = useState("");
  const [pendingPostId, setPendingPostId] = useState<string | null>(null);
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentsByPost, setCommentsByPost] = useState<Record<string, PostComment[]>>({});
  const [pendingCommentPostId, setPendingCommentPostId] = useState<string | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editCaption, setEditCaption] = useState("");
  const [editSport, setEditSport] = useState("");
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null);
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [sharePostId, setSharePostId] = useState<string | null>(null);

  useEffect(() => {
    const loadingFallback = window.setTimeout(() => {
      setPostsLoading(false);
      setFeedError((current) => current || "Feed is taking too long to load.");
    }, 10000);

    const unsubscribe = subscribeToFeed(
      (nextPosts) => {
        setPosts(nextPosts);
        setFeedError("");
        setPostsLoading(false);
        window.clearTimeout(loadingFallback);
      },
      (error) => {
        setFeedError(error.message || "Could not load the feed.");
        setPostsLoading(false);
        window.clearTimeout(loadingFallback);
      }
    );

    return () => {
      window.clearTimeout(loadingFallback);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    void getActiveStories().then(setStories);
  }, []);

  useEffect(() => {
    const activePostIds = Object.entries(openComments)
      .filter(([, isOpen]) => isOpen)
      .map(([postId]) => postId);

    const cleanups = activePostIds.map((postId) =>
      subscribeToComments(postId, (comments) => {
        setCommentsByPost((current) => ({ ...current, [postId]: comments }));
      })
    );

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [openComments]);

  const shareLinks = useMemo(() => {
    if (!sharePostId || typeof window === "undefined") {
      return null;
    }

    const shareUrl = `${window.location.origin}/feed?post=${sharePostId}`;
    const shareText = encodeURIComponent("Check this out on Kinet");

    return {
      copy: async () => navigator.clipboard.writeText(shareUrl),
      x: `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${shareText}`,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(`Check this out on Kinet ${shareUrl}`)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
    };
  }, [sharePostId]);

  const storyHighlights = useMemo(() => {
    const uniqueStories = new Map<string, StoryItem>();

    stories.forEach((story) => {
      if (!uniqueStories.has(story.userId)) {
        uniqueStories.set(story.userId, story);
      }
    });

    return Array.from(uniqueStories.values());
  }, [stories]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const handleLike = async (postId: string, hasLiked: boolean) => {
    setPendingPostId(postId);
    try {
      await togglePostLike(postId, hasLiked);
    } finally {
      setPendingPostId(null);
    }
  };

  const handleSave = async (postId: string, isSaved: boolean) => {
    setPendingPostId(postId);
    try {
      await toggleSavePost(postId, isSaved);
    } finally {
      setPendingPostId(null);
    }
  };

  const toggleComments = (postId: string) => {
    setOpenComments((current) => ({ ...current, [postId]: !current[postId] }));
  };

  const handleCommentSubmit = async (postId: string, parentCommentId?: string) => {
    const draft = commentDrafts[parentCommentId || postId] ?? "";
    if (!draft.trim()) {
      return;
    }

    setPendingCommentPostId(postId);
    try {
      await addPostComment(postId, draft, parentCommentId);
      setCommentDrafts((current) => ({ ...current, [parentCommentId || postId]: "" }));
      setOpenComments((current) => ({ ...current, [postId]: true }));
      setReplyingToCommentId(null);
    } finally {
      setPendingCommentPostId(null);
    }
  };

  return (
    <ProtectedRoute>
      <div className="mx-auto max-w-2xl space-y-6 pb-24">
        {/* Create Post - Instagram Style */}
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-3">
              <Image src={user.photoURL || "https://placehold.co/80x80?text=U"} alt="Your avatar" width={40} height={40} className="rounded-full" />
              <Button variant="ghost" className="h-10 flex-1 justify-start rounded-full border bg-muted/50 px-4 text-sm text-muted-foreground hover:bg-muted" asChild>
                <Link href="/upload">What's happening in your sport today?</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stories - Instagram Style Circular Rail */}
        {stories.length > 0 && (
          <div className="rounded-2xl border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Stories</h3>
              <Link href="/stories" className="text-xs text-primary hover:underline">
                View all
              </Link>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
              {/* Your Story - Add Button */}
              <Link href="/stories" className="flex flex-shrink-0 flex-col items-center gap-2">
                <div className="relative">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 via-rose-500 to-amber-400 p-[2px]">
                    <div className="flex h-full w-full items-center justify-center rounded-full bg-background">
                      <Image
                        src={user.photoURL || "https://placehold.co/80x80?text=Y"}
                        alt="Your story"
                        width={60}
                        height={60}
                        className="rounded-full object-cover"
                      />
                    </div>
                  </div>
                  <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground ring-2 ring-background">
                    +
                  </span>
                </div>
                <span className="max-w-[72px] truncate text-center text-xs font-medium">Your story</span>
              </Link>

              {/* Other Stories */}
              {storyHighlights.map((story) => (
                <Link key={story.id} href={`/stories?story=${story.id}`} className="flex flex-shrink-0 flex-col items-center gap-2">
                  <div className={`rounded-full bg-gradient-to-br from-fuchsia-500 via-rose-500 to-amber-400 p-[2px] ${story.seenBy?.includes(user.uid) ? "opacity-50" : ""}`}>
                    <div className="rounded-full bg-background p-[2px]">
                      <Image
                        src={story.authorAvatar || "https://placehold.co/80x80?text=S"}
                        alt={story.authorName}
                        width={60}
                        height={60}
                        className="rounded-full object-cover"
                      />
                    </div>
                  </div>
                  <span className="max-w-[72px] truncate text-center text-xs font-medium">{story.authorName}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {postsLoading ? (
          <div className="flex min-h-[30vh] items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
          </div>
        ) : null}

        {!postsLoading && feedError ? (
          <Card>
            <CardContent className="p-6 text-center">
              <h2 className="text-lg font-semibold">Feed could not load</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {feedError.includes("permissions")
                  ? "Firestore rules are still blocking this feed. Deploy the rules, then refresh."
                  : feedError}
              </p>
            </CardContent>
          </Card>
        ) : null}

        {!postsLoading && !feedError && posts.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <h2 className="text-xl font-semibold mb-2">Be the first to share!</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Your feed is empty. Start by creating your first post or reel to share with the community.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button asChild>
                  <Link href="/upload">Create Post</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/reels">Make a Reel</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {!feedError ? posts.map((post) => (
          <Card key={post.id} className="overflow-hidden">
            <div className="border-b p-5">
              <div className="flex items-center gap-3">
                <Image src={post.author.avatar || "https://placehold.co/64x64?text=H"} alt={`${post.author.name} avatar`} width={40} height={40} className="rounded-full" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link href={`/profile/${post.userId}`} className="truncate text-sm font-semibold hover:underline">
                      {post.author.name}
                    </Link>
                    <span className="text-sm text-muted-foreground">{post.author.username}</span>
                    {post.sponsored ? <span className="rounded-full bg-amber-500/15 px-2 py-1 text-[10px] font-semibold text-amber-700">SPONSORED</span> : null}
                    {post.visibility === "subscribers" ? <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">SUBSCRIBERS</span> : null}
                    {post.visibility === "premium_group" ? <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">PREMIUM GROUP</span> : null}
                    {post.postType === "poll" ? <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">POLL</span> : null}
                    {post.postType === "qa" ? <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">Q&A</span> : null}
                  </div>
                  <span className="text-xs text-muted-foreground">{formatTimeAgo(post.createdAt)}</span>
                </div>
                {post.userId === user.uid ? (
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingPostId(post.id);
                        setEditCaption(post.caption);
                        setEditSport(post.sport);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => void deletePost(post.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  ) : (
                    <div className="flex flex-wrap gap-2 text-xs">
                      {post.sponsored ? (
                        <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-800">
                          {post.sponsorLabel || "Sponsored"}
                        </span>
                      ) : null}
                    </div>
                  )}
              </div>
            </div>

            {post.mediaUrl ? (
              <button
                type="button"
                className="relative block w-full text-left"
                onClick={() => void recordPostView(post.id)}
                onContextMenu={post.rightClickProtected ? (event) => event.preventDefault() : undefined}
              >
                {post.mediaType === "video" ? (
                  <video
                    src={post.mediaUrl}
                    controlsList={post.downloadProtected ? "nodownload" : undefined}
                    aria-label={post.accessibilityLabel || post.caption || "Post media"}
                    className="aspect-video w-full bg-black object-cover"
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    onClick={(event) => {
                      const video = event.currentTarget;
                      if (video.paused) {
                        void video.play();
                      } else {
                        video.pause();
                      }
                    }}
                  />
                  ) : (
                    <Image
                      src={post.mediaUrl}
                      alt={post.accessibilityLabel || post.caption || "Post media"}
                      width={800}
                      height={450}
                      className="aspect-video w-full object-cover"
                      loading="lazy"
                    />
                  )}
                {post.watermarkEnabled ? (
                  <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white">
                    {post.author.username}
                  </span>
                ) : null}
              </button>
            ) : null}

            <div className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-muted-foreground">
                  <Button variant="ghost" size="sm" className="h-9 w-9 p-0" disabled={pendingPostId === post.id} onClick={() => handleLike(post.id, post.likes.includes(user.uid))}>
                    <Heart className={`h-5 w-5 ${post.likes.includes(user.uid) ? "fill-current text-red-500" : ""}`} />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={() => toggleComments(post.id)}>
                    <MessageCircle className={`h-5 w-5 ${openComments[post.id] ? "text-primary" : ""}`} />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={() => void repostPost(post.id)}>
                    <Repeat2 className="h-5 w-5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={() => setSharePostId(sharePostId === post.id ? null : post.id)}>
                    <Share2 className="h-5 w-5" />
                  </Button>
                </div>
                <Button variant="ghost" size="sm" className="h-9 w-9 p-0" disabled={pendingPostId === post.id} onClick={() => handleSave(post.id, post.saves.includes(user.uid))}>
                  <Bookmark className={`h-5 w-5 ${post.saves.includes(user.uid) ? "fill-current text-emerald-500" : ""}`} />
                </Button>
              </div>

              {sharePostId === post.id && shareLinks ? (
                <div className="flex flex-wrap gap-2 rounded-xl border p-3">
                  <Button size="sm" variant="outline" onClick={() => void shareLinks.copy()}>
                    Copy Link
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <a href={shareLinks.x} target="_blank" rel="noreferrer">Share to X</a>
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <a href={shareLinks.whatsapp} target="_blank" rel="noreferrer">WhatsApp</a>
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <a href={shareLinks.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>
                  </Button>
                </div>
              ) : null}

              <div className="text-sm">
                <span className="font-semibold">{post.likes.length.toLocaleString()}</span> likes
                <span className="ml-3 text-muted-foreground">{post.commentsCount} comments</span>
                <span className="ml-3 text-muted-foreground">{post.shares} reposts</span>
              </div>

              {editingPostId === post.id ? (
                <div className="space-y-2 rounded-xl border p-3">
                  <input value={editSport} onChange={(event) => setEditSport(event.target.value)} className="h-10 w-full rounded-md border border-input px-3 text-sm" />
                  <textarea value={editCaption} onChange={(event) => setEditCaption(event.target.value)} className="min-h-24 w-full rounded-md border border-input px-3 py-2 text-sm" />
                  <div className="flex gap-2">
                    <Button type="button" size="sm" onClick={async () => {
                      await updatePost(post.id, { caption: editCaption, sport: editSport });
                      setEditingPostId(null);
                    }}>
                      Save Changes
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => setEditingPostId(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-muted px-2 py-1 text-muted-foreground">
                      {post.visibility === "subscribers"
                        ? "Subscribers only"
                        : post.visibility === "premium_group"
                          ? "Premium group"
                          : "Public"}
                    </span>
                    {post.sponsored ? (
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-800">
                        {post.sponsorLabel || "Sponsored"}
                      </span>
                    ) : null}
                  </div>
                  {post.collaborators?.length ? (
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">Collaborators:</span>
                      {post.collaborators.map((collaborator) => (
                        <Link key={collaborator.uid} href={`/profile/${collaborator.uid}`} className="rounded-full bg-muted px-2 py-1 hover:text-primary">
                          {collaborator.username}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                  {post.remixOf ? (
                    <div className="text-xs text-muted-foreground">
                      Remix of <Link href={`/feed?post=${post.remixOf}`} className="text-primary hover:underline">another Kinet post</Link>
                    </div>
                  ) : null}
                  {post.autoCaption ? (
                    <div className="rounded-xl bg-muted p-3 text-sm">
                      <span className="font-semibold">Caption:</span> {post.autoCaption}
                    </div>
                  ) : null}
                  {post.translatedCaption ? (
                    <div className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
                      <span className="font-semibold text-foreground">Translation:</span> {post.translatedCaption}
                    </div>
                  ) : null}
                  {post.aiHighlightAnalysis ? (
                    <div className="rounded-xl bg-primary/5 p-3 text-sm text-muted-foreground">
                      <span className="font-semibold text-primary">AI Analysis:</span> {post.aiHighlightAnalysis}
                    </div>
                  ) : null}
                  {post.voiceoverScript ? (
                    <div className="rounded-xl bg-primary/5 p-3 text-sm text-muted-foreground">
                      <span className="font-semibold text-primary">Voiceover:</span> {post.voiceoverScript}
                    </div>
                  ) : null}
                  {post.thumbnailHint ? (
                    <div className="text-xs text-muted-foreground">
                      Best thumbnail: {post.thumbnailHint}
                    </div>
                  ) : null}
                  {post.clipStartSec !== null || post.clipEndSec !== null ? (
                    <div className="text-xs text-muted-foreground">
                      Clip range: {post.clipStartSec ?? 0}s - {post.clipEndSec ?? "end"}s
                    </div>
                  ) : null}
                  {post.accessibilityLabel ? (
                    <div className="text-xs text-muted-foreground">
                      Accessibility label: {post.accessibilityLabel}
                    </div>
                  ) : null}

                  {post.postType === "qa" && post.questionPrompt ? (
                    <div className="rounded-xl bg-primary/5 p-3 text-sm">
                      <span className="font-semibold text-primary">Question:</span>{" "}
                      <RichText text={post.questionPrompt} />
                    </div>
                  ) : null}

                  {post.caption ? (
                    <p className="text-sm leading-relaxed">
                      <RichText text={post.caption} />
                    </p>
                  ) : null}

                  {post.postType === "poll" && post.poll?.options?.length ? (
                    <div className="space-y-2 rounded-xl border p-3">
                      {post.poll.options.map((option, index) => {
                        const totalVotes = post.poll?.options.reduce((sum, current) => sum + current.votes.length, 0) ?? 0;
                        const percentage = totalVotes ? Math.round((option.votes.length / totalVotes) * 100) : 0;
                        const hasVoted = option.votes.includes(user.uid);
                        return (
                          <button
                            key={`${option.label}-${index}`}
                            type="button"
                            className={`w-full rounded-xl border p-3 text-left ${hasVoted ? "border-primary bg-primary/5" : ""}`}
                            onClick={() => void togglePollVote(post.id, index)}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span>{option.label}</span>
                              <span className="text-xs text-muted-foreground">{option.votes.length} votes • {percentage}%</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </>
              )}

              {openComments[post.id] ? (
                <div className="space-y-3 rounded-xl border bg-muted/40 p-3">
                  <div className="space-y-3">
                    {(commentsByPost[post.id] ?? []).filter((comment) => !comment.parentCommentId).length === 0 ? (
                      <p className="text-sm text-muted-foreground">No comments yet. Start the conversation.</p>
                    ) : (
                      (commentsByPost[post.id] ?? [])
                        .filter((comment) => !comment.parentCommentId)
                        .map((comment) => (
                          <div key={comment.id} className="flex gap-3">
                            <Image src={comment.author.avatar || "https://placehold.co/48x48?text=C"} alt={`${comment.author.name} avatar`} width={32} height={32} className="rounded-full" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 text-sm">
                                <span className="truncate font-semibold">{comment.author.name}</span>
                                <span className="text-muted-foreground">{comment.author.username}</span>
                                <span className="text-xs text-muted-foreground">{formatTimeAgo(comment.createdAt)}</span>
                              </div>
                              <p className="text-sm leading-relaxed"><RichText text={comment.text} /></p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {COMMENT_REACTIONS.map((emoji) => (
                                  <button
                                    key={emoji}
                                    type="button"
                                    className="rounded-full border px-2 py-1 text-xs"
                                    onClick={() => void toggleCommentReaction(comment.id, emoji)}
                                  >
                                    {emoji} {comment.reactions?.[emoji]?.length ?? 0}
                                  </button>
                                ))}
                              </div>
                              <button
                                type="button"
                                className="mt-2 inline-flex items-center gap-1 text-xs text-primary"
                                onClick={() => setReplyingToCommentId(replyingToCommentId === comment.id ? null : comment.id)}
                              >
                                <CornerDownRight className="h-3 w-3" />
                                Reply
                              </button>
                              <div className="mt-2 space-y-2">
                                {(commentsByPost[post.id] ?? [])
                                  .filter((reply) => reply.parentCommentId === comment.id)
                                  .map((reply) => (
                                    <div key={reply.id} className="rounded-lg bg-background/70 p-2">
                                      <div className="flex items-center gap-2 text-xs">
                                        <span className="font-semibold">{reply.author.name}</span>
                                        <span className="text-muted-foreground">{reply.author.username}</span>
                                        <span className="text-muted-foreground">{formatTimeAgo(reply.createdAt)}</span>
                                      </div>
                                      <p className="mt-1 text-sm"><RichText text={reply.text} /></p>
                                    </div>
                                  ))}
                              </div>
                              {replyingToCommentId === comment.id ? (
                                <div className="mt-2 flex gap-2">
                                  <input
                                    value={commentDrafts[comment.id] ?? ""}
                                    onChange={(event) => setCommentDrafts((current) => ({ ...current, [comment.id]: event.target.value }))}
                                    placeholder={`Reply to ${comment.author.name} with @mentions...`}
                                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                  />
                                  <Button type="button" size="sm" onClick={() => handleCommentSubmit(post.id, comment.id)}>
                                    Reply
                                  </Button>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ))
                    )}
                  </div>

                  <div className="flex gap-2">
                    <input
                      value={commentDrafts[post.id] ?? ""}
                      onChange={(event) => setCommentDrafts((current) => ({ ...current, [post.id]: event.target.value }))}
                      placeholder={post.postType === "qa" ? "Answer the question or mention someone..." : "Write a comment with @mentions..."}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      disabled={pendingCommentPostId === post.id}
                    />
                    <Button type="button" size="sm" disabled={pendingCommentPostId === post.id || !(commentDrafts[post.id] ?? "").trim()} onClick={() => handleCommentSubmit(post.id)}>
                      Post
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </Card>
        )) : null}
      </div>
    </ProtectedRoute>
  );
}

export default function FeedPage() {
  return (
    <AuthProvider>
      <FeedPageContent />
    </AuthProvider>
  );
}
