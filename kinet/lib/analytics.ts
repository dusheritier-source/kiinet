import { collection, getDocs, limit, query, where } from "firebase/firestore";

import { auth, db } from "@/lib/firebase";
import type { FeedPost } from "@/lib/posts";
import { getCurrentUserProfile } from "@/lib/user-profile";

export interface CreatorAnalytics {
  totalPosts: number;
  totalReels: number;
  totalLikes: number;
  totalComments: number;
  totalSaves: number;
  totalShares: number;
  totalViews: number;
  averageEngagement: number;
  reelCompletionRate: number;
  topSport: string;
  topHashtag: string;
  followers: number;
  following: number;
  profileCompletion: number;
  visitorCount: number;
  followerGrowth: Array<{ label: string; value: number }>;
  hashtagPerformance: Array<{ tag: string; posts: number; views: number }>;
  postBreakdown: Array<{
    id: string;
    caption: string;
    type: "post" | "reel";
    views: number;
    completedViews: number;
    completionRate: number;
    engagementRate: number;
    likes: number;
    comments: number;
    saves: number;
    shares: number;
    hashtagCount: number;
  }>;
  recentPosts: FeedPost[];
}

function mapAnalyticsPost(id: string, data: Record<string, unknown>): FeedPost {
  const author = (data.author as Record<string, unknown> | undefined) ?? {};

  return {
    id,
    userId: String(data.userId ?? ""),
    caption: String(data.caption ?? ""),
    mediaUrl: String(data.mediaUrl ?? ""),
    mediaType: data.mediaType === "video" ? "video" : "image",
    contentType: data.contentType === "reel" ? "reel" : "post",
    sport: String(data.sport ?? ""),
    createdAt:
      (data.createdAt as { seconds?: number; nanoseconds?: number } | null | undefined) ?? null,
    likes: Array.isArray(data.likes) ? (data.likes as string[]) : [],
    commentsCount: Number(data.commentsCount ?? 0),
    shares: Number(data.shares ?? 0),
    saves: Array.isArray(data.saves) ? (data.saves as string[]) : [],
    hashtags: Array.isArray(data.hashtags) ? (data.hashtags as string[]) : [],
    storagePath: data.storagePath ? String(data.storagePath) : undefined,
    originalPostId: data.originalPostId ? String(data.originalPostId) : null,
    views: Number(data.views ?? 0),
    completedViews: Number(data.completedViews ?? 0),
    author: {
      name: String(author.name ?? "Kinet User"),
      username: String(author.username ?? "@player"),
      avatar: String(author.avatar ?? ""),
      verified: Boolean(author.verified),
      role: author.role ? String(author.role) : null,
    },
  };
}

export async function getCreatorAnalytics(): Promise<CreatorAnalytics | null> {
  if (!auth?.currentUser || !db) {
    return null;
  }

  const snapshot = await getDocs(
    query(collection(db, "posts"), where("userId", "==", auth.currentUser.uid), limit(100))
  );
  const posts = snapshot.docs.map((docSnapshot: { id: string; data: () => Record<string, unknown> }) =>
    mapAnalyticsPost(docSnapshot.id, docSnapshot.data() as Record<string, unknown>)
  );

  const totals = posts.reduce(
    (
      accumulator: {
        likes: number;
        comments: number;
        saves: number;
        shares: number;
        views: number;
        completedViews: number;
        sportCounts: Record<string, number>;
        hashtagCounts: Record<string, number>;
      },
      post: FeedPost
    ) => {
      accumulator.likes += post.likes.length;
      accumulator.comments += post.commentsCount;
      accumulator.saves += post.saves.length;
      accumulator.shares += post.shares;
      accumulator.views += post.views ?? 0;
      accumulator.completedViews += post.completedViews ?? 0;
      accumulator.sportCounts[post.sport] = (accumulator.sportCounts[post.sport] ?? 0) + 1;

      for (const hashtag of post.hashtags) {
        accumulator.hashtagCounts[hashtag] = (accumulator.hashtagCounts[hashtag] ?? 0) + 1;
      }

      return accumulator;
    },
    {
      likes: 0,
      comments: 0,
      saves: 0,
      shares: 0,
      views: 0,
      completedViews: 0,
      sportCounts: {} as Record<string, number>,
      hashtagCounts: {} as Record<string, number>,
    }
  );

  const sportEntries = Object.entries(totals.sportCounts) as Array<[string, number]>;
  const hashtagEntries = Object.entries(totals.hashtagCounts) as Array<[string, number]>;
  const topSport = sportEntries.sort((left, right) => right[1] - left[1])[0]?.[0] ?? "";
  const topHashtag = hashtagEntries.sort((left, right) => right[1] - left[1])[0]?.[0] ?? "";
  const totalPosts = posts.filter((post: FeedPost) => post.contentType === "post").length;
  const totalReels = posts.filter((post: FeedPost) => post.contentType === "reel").length;
  const denominator = Math.max(posts.length, 1);
  const profile = (await getCurrentUserProfile()) as
    | {
        followers?: string[];
        following?: string[];
        role?: Record<string, unknown>;
        location?: string | null;
        photoURL?: string | null;
        analytics?: Record<string, unknown>;
      }
    | null;
  const role = profile?.role ?? {};
  const completionFields = [
    role.sport,
    role.position,
    role.team,
    role.experience,
    role.bio,
    profile?.location,
    profile?.photoURL,
  ];
  const analyticsData = (profile?.analytics as Record<string, unknown> | undefined) ?? {};
  const visitorCount = Number(analyticsData.profileVisitors ?? 0);
  const followerHistory = Array.isArray(analyticsData.followerHistory)
    ? (analyticsData.followerHistory as Array<Record<string, unknown>>)
    : [];
  const hashtagPerformance = hashtagEntries.map(([tag, count]) => ({
    tag,
    posts: count,
    views: posts
      .filter((post: FeedPost) => post.hashtags.includes(tag))
      .reduce((sum: number, post: FeedPost) => sum + (post.views ?? 0), 0),
  }));

  return {
    totalPosts,
    totalReels,
    totalLikes: totals.likes,
    totalComments: totals.comments,
    totalSaves: totals.saves,
    totalShares: totals.shares,
    totalViews: totals.views,
    averageEngagement:
      (totals.likes + totals.comments + totals.saves + totals.shares) / denominator,
    reelCompletionRate:
      totals.views > 0 ? Math.round((totals.completedViews / totals.views) * 100) : 0,
    topSport,
    topHashtag,
    followers: profile?.followers?.length ?? 0,
    following: profile?.following?.length ?? 0,
    profileCompletion: Math.round(
      (completionFields.filter((value) => String(value ?? "").trim()).length /
        completionFields.length) *
        100
    ),
    visitorCount,
    followerGrowth: followerHistory.map((entry) => ({
      label: String(entry.label ?? ""),
      value: Number(entry.value ?? 0),
    })),
    hashtagPerformance,
    postBreakdown: posts.map((post: FeedPost) => ({
      id: post.id,
      caption: post.caption,
      type: post.contentType,
      views: post.views ?? 0,
      completedViews: post.completedViews ?? 0,
      completionRate: (post.views ?? 0) > 0
        ? Math.round(((post.completedViews ?? 0) / (post.views ?? 1)) * 100)
        : 0,
      engagementRate: (post.views ?? 0) > 0
        ? Math.round(
            ((post.likes.length + post.commentsCount + post.saves.length + post.shares) /
              (post.views ?? 1)) *
              1000
          ) / 10
        : 0,
      likes: post.likes.length,
      comments: post.commentsCount,
      saves: post.saves.length,
      shares: post.shares,
      hashtagCount: post.hashtags.length,
    })),
    recentPosts: posts
      .sort((left: FeedPost, right: FeedPost) => (right.createdAt?.seconds ?? 0) - (left.createdAt?.seconds ?? 0))
      .slice(0, 6),
  };
}
