"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TrendingUp, Users } from "lucide-react";
import { useAuthContext } from "@/components/AuthProvider";
import { ProfileAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { subscribeToFeed, type FeedPost } from "@/lib/posts";
import { getSuggestedSocialProfiles } from "@/lib/profile-social";
import { getCurrentUserProfile, toggleFollowUser, type SearchProfile } from "@/lib/user-profile";

export default function FeedDiscovery() {
  const { user } = useAuthContext();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [suggestions, setSuggestions] = useState<SearchProfile[]>([]);

  useEffect(() => {
    if (!user) return;

    void getCurrentUserProfile()
      .then((profile) => getSuggestedSocialProfiles(profile as SearchProfile | null))
      .then(setSuggestions);

    return subscribeToFeed(setPosts);
  }, [user]);

  const topics = useMemo(() => {
    const counts = new Map<string, number>();

    posts.forEach((post) =>
      post.hashtags.forEach((tag) =>
        counts.set(tag, (counts.get(tag) || 0) + 1)
      )
    );

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [posts]);

  if (!topics.length && !suggestions.length) return null;

  return (
    <section className="mx-auto grid max-w-2xl gap-4 px-3 pt-5 sm:px-4 md:grid-cols-2">
      {topics.length ? (
        <Card>
          <CardContent className="p-4">
            <h2 className="mb-3 flex items-center gap-2 font-semibold">
              <TrendingUp className="h-4 w-4 text-primary" />
              Trending topics
            </h2>
            <div className="flex flex-wrap gap-2">
              {topics.map(([tag, count]) => (
                <Link
                  key={tag}
                  href={`/topics/${tag}`}
                  className="rounded-full bg-muted px-3 py-1.5 text-sm hover:bg-primary/10"
                >
                  #{tag} <span className="text-xs text-muted-foreground">{count}</span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {suggestions.length ? (
        <Card>
          <CardContent className="p-4">
            <h2 className="mb-3 flex items-center gap-2 font-semibold">
              <Users className="h-4 w-4 text-primary" />
              People to discover
            </h2>
            <div className="space-y-2">
              {suggestions.slice(0, 3).map((profile) => (
                <div key={profile.uid} className="flex items-center gap-2">
                  <Link
                    href={`/profile/${profile.uid}`}
                    title={profile.bio || profile.displayName}
                    className="block shrink-0"
                  >
                    <ProfileAvatar
                      src={profile.photoURL}
                      username={profile.displayName}
                      alt={profile.displayName || "User"}
                      className="h-9 w-9"
                    />
                  </Link>
                  <Link href={`/profile/${profile.uid}`} className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{profile.displayName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      @{profile.username}
                    </p>
                  </Link>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void toggleFollowUser(profile.uid, false).then(() =>
                        setSuggestions((items) =>
                          items.filter((item) => item.uid !== profile.uid)
                        )
                      )
                    }
                  >
                    Kinet With
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
