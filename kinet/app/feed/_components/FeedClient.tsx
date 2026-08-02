"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Virtuoso } from "react-virtuoso";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Avatar } from "@/components/ui/avatar";
import {
  Heart,
  MessageCircle,
  Repeat2,
  Share2,
  Bookmark,
  ImagePlus,
  MoreHorizontal,
  TrendingUp,
  Users,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Image from "next/image";
import { auth } from "@/lib/firebase";
import { useAuthContext } from "@/components/AuthProvider";

async function getAuthHeaders() {
  if (!auth?.currentUser) {
    return {};
  }
  const idToken = await auth.currentUser.getIdToken();
  return idToken ? { Authorization: `Bearer ${idToken}` } : {};
}

async function fetchWithAuth(input: RequestInfo, init: RequestInit = {}) {
  const authHeaders = await getAuthHeaders();
  const headers = new Headers(init.headers ?? {});

  Object.entries(authHeaders).forEach(([key, value]) => {
    if (value) {
      headers.set(key, value);
    }
  });

  return fetch(input, {
    ...init,
    headers,
  });
}

interface Post {
  id: string;
  content: string;
  mediaUrl?: string;
  mediaType?: string;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
  };
  likes: string[];
  comments: number;
  reposts: number;
  shares: number;
  saves: string[];
  createdAt: string;
  currentUserLiked: boolean;
  currentUserSaved: boolean;
}

interface FeedResponse {
  posts: Post[];
  nextCursor?: string;
  hasMore: boolean;
}

async function fetchFeed({
  pageParam = null,
  signal,
}: {
  pageParam: string | null;
  signal?: AbortSignal;
}): Promise<FeedResponse> {
  const url = new URL("/api/feed", window.location.origin);
  if (pageParam) {
    url.searchParams.set("cursor", pageParam);
  }

  const response = await fetchWithAuth(url.toString(), { signal });

  if (!response.ok) {
    throw new Error("Failed to fetch feed");
  }

  return response.json();
}

export default function FeedClient() {
  const { user } = useAuthContext();
  const [newPostContent, setNewPostContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["feed"],
    queryFn: fetchFeed,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: null,
  });

  const posts = data?.pages.flatMap((page) => page.posts) ?? [];

  const handleCreatePost = async () => {
    if (!newPostContent.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await fetchWithAuth("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newPostContent }),
      });

      if (!response.ok) throw new Error("Failed to create post");

      setNewPostContent("");
      refetch();
    } catch (error) {
      console.error("Error creating post:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLike = async (postId: string, hasLiked: boolean) => {
    // Optimistic update
    // Implementation would update the cache immediately
    try {
      await fetchWithAuth("/api/posts/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, action: hasLiked ? "unlike" : "like" }),
      });
      refetch();
    } catch (error) {
      console.error("Error toggling like:", error);
    }
  };

  const handleSave = async (postId: string, isSaved: boolean) => {
    try {
      await fetchWithAuth("/api/posts/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, action: isSaved ? "unsave" : "save" }),
      });
      refetch();
    } catch (error) {
      console.error("Error toggling save:", error);
    }
  };

  const handleRepost = async (postId: string) => {
    try {
      await fetchWithAuth("/api/posts/repost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
      });
      refetch();
    } catch (error) {
      console.error("Error reposting:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-cyan-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Sidebar - Navigation */}
        <aside className="hidden lg:block lg:col-span-3">
          <Card className="sticky top-6 border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-blue-500/5 backdrop-blur-sm">
            <CardContent className="p-4">
              <nav className="space-y-2">
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 text-white hover:bg-cyan-500/10"
                >
                  <TrendingUp className="h-5 w-5 text-cyan-400" />
                  <span className="font-semibold">Home</span>
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 text-gray-300 hover:bg-cyan-500/10 hover:text-white"
                >
                  <Users className="h-5 w-5" />
                  <span>Profile</span>
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 text-gray-300 hover:bg-cyan-500/10 hover:text-white"
                >
                  <MessageCircle className="h-5 w-5" />
                  <span>Messages</span>
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 text-gray-300 hover:bg-cyan-500/10 hover:text-white"
                >
                  <Bookmark className="h-5 w-5" />
                  <span>Bookmarks</span>
                </Button>
              </nav>
            </CardContent>
          </Card>
        </aside>

        {/* Center Column - Feed */}
        <main className="col-span-1 lg:col-span-6">
          {/* Post Creation */}
          <Card className="mb-6 border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-blue-500/5 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex gap-3">
                <Avatar className="h-10 w-10">
                  {user?.photoURL ? (
                    <Image
                      src={user.photoURL}
                      alt={user.displayName || "User"}
                      width={40}
                      height={40}
                      className="rounded-full"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-cyan-400 to-blue-600 text-white">
                      {user?.displayName?.charAt(0).toUpperCase() || "U"}
                    </div>
                  )}
                </Avatar>
                <div className="flex-1">
                  <Textarea
                    placeholder="What's happening?"
                    value={newPostContent}
                    onChange={(e) => setNewPostContent(e.target.value)}
                    className="min-h-[80px] resize-none border-cyan-500/20 bg-white/5 text-white placeholder:text-gray-400 focus:border-cyan-400"
                  />
                  <div className="mt-3 flex items-center justify-between">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-cyan-400 hover:text-cyan-300"
                    >
                      <ImagePlus className="h-5 w-5" />
                    </Button>
                    <Button
                      onClick={handleCreatePost}
                      disabled={!newPostContent.trim() || isSubmitting}
                      className="bg-gradient-to-r from-cyan-400 to-blue-600 hover:from-cyan-500 hover:to-blue-700"
                    >
                      {isSubmitting ? "Posting..." : "Post"}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Posts Feed */}
          <div className="space-y-4">
            {posts.map((post) => (
              <Card
                key={post.id}
                className="border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-blue-500/5 backdrop-blur-sm transition-all hover:border-cyan-400/40"
              >
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    <Avatar className="h-10 w-10">
                      {post.author.avatarUrl ? (
                        <Image
                          src={post.author.avatarUrl}
                          alt={post.author.displayName}
                          width={40}
                          height={40}
                          className="rounded-full"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-cyan-400 to-blue-600 text-white">
                          {post.author.displayName[0]}
                        </div>
                      )}
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">
                          {post.author.displayName}
                        </span>
                        <span className="text-sm text-gray-400">
                          @{post.author.username}
                        </span>
                        <span className="text-sm text-gray-500">
                          · {formatDistanceToNow(new Date(post.createdAt))}
                        </span>
                      </div>
                      <p className="mt-2 text-gray-200">{post.content}</p>
                      {post.mediaUrl && (
                        <div className="mt-3 overflow-hidden rounded-lg">
                          <Image
                            src={post.mediaUrl}
                            alt="Post media"
                            width={600}
                            height={400}
                            className="w-full object-cover"
                          />
                        </div>
                      )}
                      <div className="mt-3 flex items-center gap-6">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleLike(post.id, post.currentUserLiked)}
                          className={`gap-2 ${
                            post.currentUserLiked
                              ? "text-red-400"
                              : "text-gray-400 hover:text-red-400"
                          }`}
                        >
                          <Heart
                            className={`h-5 w-5 ${
                              post.currentUserLiked ? "fill-current" : ""
                            }`}
                          />
                          <span className="text-sm">{post.likes.length}</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-2 text-gray-400 hover:text-cyan-400"
                        >
                          <MessageCircle className="h-5 w-5" />
                          <span className="text-sm">{post.comments}</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRepost(post.id)}
                          className="gap-2 text-gray-400 hover:text-green-400"
                        >
                          <Repeat2 className="h-5 w-5" />
                          <span className="text-sm">{post.reposts}</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-2 text-gray-400 hover:text-cyan-400"
                        >
                          <Share2 className="h-5 w-5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSave(post.id, post.currentUserSaved)}
                          className={`gap-2 ${
                            post.currentUserSaved
                              ? "text-cyan-400"
                              : "text-gray-400 hover:text-cyan-400"
                          }`}
                        >
                          <Bookmark
                            className={`h-5 w-5 ${
                              post.currentUserSaved ? "fill-current" : ""
                            }`}
                          />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {hasNextPage && (
              <div className="flex justify-center py-4">
                <Button
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  variant="outline"
                  className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
                >
                  {isFetchingNextPage ? "Loading..." : "Load More"}
                </Button>
              </div>
            )}
          </div>
        </main>

        {/* Right Sidebar - Trending & Suggestions */}
        <aside className="hidden lg:block lg:col-span-3">
          <div className="sticky top-6 space-y-4">
            {/* Trending */}
            <Card className="border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-blue-500/5 backdrop-blur-sm">
              <CardContent className="p-4">
                <h3 className="mb-4 flex items-center gap-2 font-semibold text-white">
                  <TrendingUp className="h-5 w-5 text-cyan-400" />
                  Trending
                </h3>
                <div className="space-y-3">
                  {[
                    { tag: "#TechInnovation", posts: "12.5K" },
                    { tag: "#CreativeArts", posts: "8.3K" },
                    { tag: "#FitnessMotivation", posts: "15.2K" },
                    { tag: "#WebDevelopment", posts: "6.7K" },
                    { tag: "#DesignThinking", posts: "4.2K" },
                  ].map((trend) => (
                    <div
                      key={trend.tag}
                      className="cursor-pointer rounded-lg p-2 transition-colors hover:bg-cyan-500/10"
                    >
                      <p className="text-sm font-medium text-cyan-400">
                        {trend.tag}
                      </p>
                      <p className="text-xs text-gray-400">
                        {trend.posts} posts
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Who to Follow */}
            <Card className="border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-blue-500/5 backdrop-blur-sm">
              <CardContent className="p-4">
                <h3 className="mb-4 flex items-center gap-2 font-semibold text-white">
                  <Users className="h-5 w-5 text-cyan-400" />
                  Who to Follow
                </h3>
                <div className="space-y-3">
                  {[
                    { name: "Tech Daily", username: "@techdaily" },
                    { name: "Design Hub", username: "@designhub" },
                    { name: "Code Masters", username: "@codemasters" },
                  ].map((user) => (
                    <div
                      key={user.username}
                      className="flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-cyan-500/10"
                    >
                      <div>
                        <p className="text-sm font-medium text-white">
                          {user.name}
                        </p>
                        <p className="text-xs text-gray-400">{user.username}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
                      >
                        Follow
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </aside>
      </div>
    </div>
  );
}