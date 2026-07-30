"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BarChart3, Bookmark, Eye, MessageCircle, PlayCircle, Repeat2, Users } from "lucide-react";

import { AuthProvider } from "@/components/AuthProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCreatorAnalytics, type CreatorAnalytics } from "@/lib/analytics";

function AnalyticsPageContent() {
  const [analytics, setAnalytics] = useState<CreatorAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "posts" | "reels">("all");

  useEffect(() => {
    getCreatorAnalytics()
      .then(setAnalytics)
      .finally(() => setLoading(false));
  }, []);

  const filteredPosts = useMemo(() => {
    if (!analytics) {
      return [];
    }

    const source = analytics.recentPosts;
    if (filter === "posts") {
      return source.filter((post) => post.contentType === "post");
    }

    if (filter === "reels") {
      return source.filter((post) => post.contentType === "reel");
    }

    return source;
  }, [analytics, filter]);

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" /></div>;
  }

  if (!analytics) {
    return (
      <ProtectedRoute>
        <div className="mx-auto max-w-3xl py-8">Analytics are available after you publish content.</div>
      </ProtectedRoute>
    );
  }

  const stats = [
    { label: "Post likes", value: analytics.totalLikes, icon: BarChart3 },
    { label: "Comments", value: analytics.totalComments, icon: MessageCircle },
    { label: "Saves", value: analytics.totalSaves, icon: Bookmark },
    { label: "Reposts", value: analytics.totalShares, icon: Repeat2 },
    { label: "Views", value: analytics.totalViews, icon: Eye },
    { label: "Visitors", value: analytics.visitorCount, icon: Users },
    { label: "Followers", value: analytics.followers, icon: Users },
    { label: "Reel completion", value: `${analytics.reelCompletionRate}%`, icon: PlayCircle },
  ];

  return (
    <ProtectedRoute>
      <div className="mx-auto max-w-6xl space-y-6 py-8">
        <div>
          <h1 className="text-3xl font-bold">Creator Analytics</h1>
          <p className="text-muted-foreground">Track engagement, profile visitors, follower movement, reel watch-time, and hashtag performance.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardContent className="flex items-center gap-4 p-5">
                <div className="rounded-xl bg-primary/10 p-3 text-primary">
                  <stat.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.95fr,1.05fr]">
          <Card>
            <CardHeader>
              <CardTitle>Performance Snapshot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>You have {analytics.totalPosts} posts and {analytics.totalReels} reels live.</p>
              <p>Average engagement per upload: <span className="font-semibold">{analytics.averageEngagement.toFixed(1)}</span></p>
              <p>Top topic: <span className="font-semibold">{analytics.topHashtag ? `#${analytics.topHashtag}` : "Not enough data yet"}</span></p>
              <p>Top hashtag: <span className="font-semibold">{analytics.topHashtag ? `#${analytics.topHashtag}` : "Use hashtags to build reach"}</span></p>
              <p>Profile completion: <span className="font-semibold">{analytics.profileCompletion}%</span></p>
              <p>Recent profile visitors: <span className="font-semibold">{analytics.visitorCount}</span></p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Follower Growth</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {analytics.followerGrowth.length === 0 ? (
                <p className="text-sm text-muted-foreground">Follower growth will appear after people start following you.</p>
              ) : (
                analytics.followerGrowth.map((entry) => (
                  <div key={entry.label} className="flex items-center gap-3">
                    <span className="w-16 text-xs text-muted-foreground">{entry.label}</span>
                    <div className="h-3 flex-1 rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(entry.value * 10, 100)}%` }} />
                    </div>
                    <span className="text-sm font-medium">{entry.value}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.95fr,1.05fr]">
          <Card>
            <CardHeader>
              <CardTitle>Hashtag Performance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {analytics.hashtagPerformance.map((entry) => (
                <div key={entry.tag} className="rounded-xl border p-4">
                  <p className="font-semibold">#{entry.tag}</p>
                  <p className="text-sm text-muted-foreground">{entry.posts} posts • {entry.views} views</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <CardTitle>Recent Content</CardTitle>
                <div className="flex gap-2">
                  {(["all", "posts", "reels"] as const).map((value) => (
                    <Button key={value} type="button" size="sm" variant={filter === value ? "default" : "outline"} onClick={() => setFilter(value)}>
                      {value}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {filteredPosts.length === 0 ? (
                <div className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">No content in this filter yet.</div>
              ) : (
                filteredPosts.map((post) => {
                  const breakdown = analytics.postBreakdown.find((entry) => entry.id === post.id);
                  return (
                    <Link key={post.id} href={`/analytics/${post.id}`} className="flex items-center gap-4 rounded-xl border p-3 hover:bg-muted/40">
                      {post.mediaType === "video" ? (
                        <video src={post.mediaUrl} className="h-20 w-20 rounded-xl object-cover" />
                      ) : (
                        <img src={post.mediaUrl} alt={post.caption || "Recent post"} className="h-20 w-20 rounded-xl object-cover" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{post.caption || "Untitled upload"}</p>
                        <p className="text-sm text-muted-foreground">
                          {breakdown?.likes ?? 0} likes • {breakdown?.comments ?? 0} comments • {breakdown?.saves ?? 0} saves
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {breakdown?.views ?? 0} views • {breakdown?.shares ?? 0} reposts
                        </p>
                      </div>
                    </Link>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  );
}

export default function AnalyticsPage() {
  return (
    <AuthProvider>
      <AnalyticsPageContent />
    </AuthProvider>
  );
}
