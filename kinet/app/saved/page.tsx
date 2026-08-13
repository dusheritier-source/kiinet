"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { AuthProvider, useAuthContext } from "@/components/AuthProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createSavedCollection, getSavedCollections, togglePostInCollection, type SavedCollection } from "@/lib/collections";
import { getPostsByIds, type FeedPost } from "@/lib/posts";
import { getCurrentUserSettings } from "@/lib/settings";
import { getCurrentUserProfile } from "@/lib/user-profile";
import OptimizedMedia from "@/components/OptimizedMedia";

function SavedPageContent() {
  const { user } = useAuthContext();
  const [savedPosts, setSavedPosts] = useState<FeedPost[]>([]);
  const [followedTopics, setFollowedTopics] = useState<string[]>([]);
  const [collections, setCollections] = useState<SavedCollection[]>([]);
  const [collectionName, setCollectionName] = useState("");

  useEffect(() => {
    if (!user) {
      return;
    }

    const loadSaved = async () => {
      const profile = (await getCurrentUserProfile()) as { savedPosts?: string[] } | null;
      const settings = await getCurrentUserSettings();
      const savedCollections = await getSavedCollections();
      const savedIds = profile?.savedPosts ?? [];
      const exactSavedPosts = await getPostsByIds(savedIds);
      setSavedPosts(exactSavedPosts);
      setFollowedTopics(settings.followedTopics);
      setCollections(savedCollections);
    };

    void loadSaved();
  }, [user]);

  if (!user) {
    return null;
  }

  return (
    <ProtectedRoute>
      <div className="mx-auto max-w-4xl py-8">
        <Card>
          <CardHeader>
            <CardTitle>Saved Posts</CardTitle>
            <CardDescription>Your bookmarked highlights and posts.</CardDescription>
          </CardHeader>
          <CardContent>
            {followedTopics.length > 0 ? (
              <div className="mb-6 flex flex-wrap gap-2">
                {followedTopics.map((topic) => (
                  <Link key={topic} href={`/topics/${topic}`} className="rounded-full border px-3 py-2 text-sm hover:bg-muted/40">
                    #{topic}
                  </Link>
                ))}
              </div>
            ) : null}
            {savedPosts.length === 0 ? (
              <div className="rounded-xl bg-muted p-6 text-sm text-muted-foreground">
                No saved posts yet. Save highlights from the feed or reels.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <input
                    className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                    placeholder="New collection name"
                    value={collectionName}
                    onChange={(event) => setCollectionName(event.target.value)}
                  />
                  <Button
                    onClick={() =>
                      void createSavedCollection(collectionName).then(async () => {
                        setCollectionName("");
                        setCollections(await getSavedCollections());
                      })
                    }
                  >
                    Create Folder
                  </Button>
                </div>
                {collections.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {collections.map((collection) => (
                      <span key={collection.id} className="rounded-full border px-3 py-2 text-sm">
                        {collection.name} ({collection.postIds.length})
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="grid gap-4 md:grid-cols-2">
                {savedPosts.map((post) => (
                  <div key={post.id} className="rounded-xl border p-4">
                    <Link href={post.contentType === "reel" ? "/reels" : "/feed"} className="block overflow-hidden rounded-xl hover:bg-muted/40">
                      {post.mediaUrl ? (
                        <div className="relative mb-3 overflow-hidden rounded-xl bg-muted">
                          {post.mediaType === "video" ? (
                            <video src={post.mediaUrl} className="h-48 w-full object-cover" />
                          ) : (
                            <OptimizedMedia src={post.mediaUrl} alt={post.caption || post.sport} width={640} height={192} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="h-48 w-full object-cover" />
                          )}
                          {post.contentType === "reel" ? (
                            <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-1 text-[11px] font-semibold text-white">
                              Reel
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                      <p className="font-semibold">{post.author.name}</p>
                      <p className="text-sm text-muted-foreground">{post.caption || post.sport}</p>
                    </Link>
                    {collections.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {collections.map((collection) => {
                          const isIncluded = collection.postIds.includes(post.id);
                          return (
                            <button
                              key={collection.id}
                              type="button"
                              className={`rounded-full border px-2 py-1 text-xs ${isIncluded ? "border-primary bg-primary/5 text-primary" : ""}`}
                              onClick={() =>
                                void togglePostInCollection(collection.id, post.id, isIncluded).then(async () =>
                                  setCollections(await getSavedCollections())
                                )
                              }
                            >
                              {collection.name}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  );
}

export default function SavedPage() {
  return (
    <AuthProvider>
      <SavedPageContent />
    </AuthProvider>
  );
}
