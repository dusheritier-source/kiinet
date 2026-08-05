"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { AuthProvider } from "@/components/AuthProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCreatorAnalytics } from "@/lib/analytics";

function PostAnalyticsPageContent() {
  const params = useParams<{ postId: string }>();
  const [post, setPost] = useState<
    NonNullable<Awaited<ReturnType<typeof getCreatorAnalytics>>>["postBreakdown"][number] | null
  >(null);

  useEffect(() => {
    getCreatorAnalytics().then((analytics) => {
      const match = analytics?.postBreakdown.find((entry) => entry.id === params.postId) ?? null;
      setPost(match);
    });
  }, [params.postId]);

  if (!post) {
    return (
      <ProtectedRoute>
        <div className="mx-auto max-w-3xl py-8">Post analytics not found.</div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="mx-auto max-w-3xl py-8">
        <Card>
          <CardHeader>
            <CardTitle>Post Analytics</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl bg-muted p-4">
              <p className="text-sm text-muted-foreground">Views</p>
              <p className="text-2xl font-bold">{post.views}</p>
            </div>
            <div className="rounded-xl bg-muted p-4">
              <p className="text-sm text-muted-foreground">Likes</p>
              <p className="text-2xl font-bold">{post.likes}</p>
            </div>
            <div className="rounded-xl bg-muted p-4">
              <p className="text-sm text-muted-foreground">Comments</p>
              <p className="text-2xl font-bold">{post.comments}</p>
            </div>
            <div className="rounded-xl bg-muted p-4">
              <p className="text-sm text-muted-foreground">Saves</p>
              <p className="text-2xl font-bold">{post.saves}</p>
            </div>
            <div className="rounded-xl bg-muted p-4">
              <p className="text-sm text-muted-foreground">Reposts</p>
              <p className="text-2xl font-bold">{post.shares}</p>
            </div>
            {post.type === "reel" ? <>
              <div className="rounded-xl bg-muted p-4">
                <p className="text-sm text-muted-foreground">Completed plays</p>
                <p className="text-2xl font-bold">{post.completedViews}</p>
              </div>
              <div className="rounded-xl bg-muted p-4">
                <p className="text-sm text-muted-foreground">Completion rate</p>
                <p className="text-2xl font-bold">{post.completionRate}%</p>
              </div>
              <div className="rounded-xl bg-muted p-4">
                <p className="text-sm text-muted-foreground">Engagement rate</p>
                <p className="text-2xl font-bold">{post.engagementRate}%</p>
              </div>
            </> : null}
            <div className="rounded-xl bg-muted p-4">
              <p className="text-sm text-muted-foreground">Hashtag count</p>
              <p className="text-2xl font-bold">{post.hashtagCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  );
}

export default function PostAnalyticsPage() {
  return (
    <AuthProvider>
      <PostAnalyticsPageContent />
    </AuthProvider>
  );
}
