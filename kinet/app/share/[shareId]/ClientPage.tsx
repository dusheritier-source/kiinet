"use client";
/* eslint-disable @next/next/no-img-element -- Public shares may reference dynamic user media hosts. */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getExpiringShare, getPostById } from "@/lib/media-lab";

export default function SharedClipPageContent() {
  const params = useParams<{ shareId: string }>();
  const shareId = params.shareId;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [post, setPost] = useState<Awaited<ReturnType<typeof getPostById>>>(null);

  useEffect(() => {
    if (!shareId) return;
    let cancelled = false;

    getExpiringShare(shareId)
      .then(async (share) => {
        if (!share) {
          throw new Error("This private link was not found.");
        }

        if (share.expiresAt?.seconds && share.expiresAt.seconds * 1000 < Date.now()) {
          throw new Error("This private link has expired.");
        }

        return getPostById(share.postId);
      })
      .then((nextPost) => {
        if (!cancelled) {
          setPost(nextPost);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "This share link is unavailable.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [shareId]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl py-10">
      <Card>
        <CardHeader>
          <CardTitle>Private Shared Clip</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : post ? (
            <>
              {post.mediaType === "video" ? (
                <video
                  src={post.mediaUrl}
                  controls
                  aria-label={post.accessibilityLabel || post.caption || "Shared clip"}
                  className="aspect-video w-full rounded-xl bg-black object-cover"
                />
              ) : (
                <img
                  src={post.mediaUrl}
                  alt={post.accessibilityLabel || post.caption || "Shared clip"}
                  className="aspect-video w-full rounded-xl object-cover"
                />
              )}
              <div>
                <p className="text-lg font-semibold">{post.caption || "Untitled clip"}</p>
                <p className="text-sm text-muted-foreground">
                  {post.author?.name || "HoopLink User"} • {post.sport}
                </p>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">This shared clip could not be loaded.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
