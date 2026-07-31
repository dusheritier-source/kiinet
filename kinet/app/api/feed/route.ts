import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor");
    const limit = parseInt(searchParams.get("limit") || "20");

    const where = {
      parentId: null, // Only top-level posts
    };

    const posts = await prisma.post.findMany({
      where,
      take: limit + 1,
      ...(cursor && {
        skip: 1,
        cursor: { id: cursor },
      }),
      orderBy: {
        createdAt: "desc",
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        likes: {
          select: {
            userId: true,
          },
        },
        bookmarks: {
          select: {
            userId: true,
          },
        },
        _count: {
          select: {
            comments: true,
          },
        },
      },
    });

    const hasMore = posts.length > limit;
    const nextCursor = hasMore ? posts[posts.length - 1].id : undefined;

    const formattedPosts = posts.slice(0, limit).map((post) => ({
      id: post.id,
      content: post.content,
      mediaUrl: post.mediaUrl,
      mediaType: post.mediaType,
      author: {
        id: post.author.id,
        username: post.author.username,
        displayName: post.author.displayName,
        avatarUrl: post.author.avatarUrl,
      },
      likes: post.likes.map((like) => like.userId),
      comments: post._count.comments,
      reposts: 0, // TODO: Implement repost count
      shares: 0, // TODO: Implement share count
      saves: post.bookmarks.map((bookmark) => bookmark.userId),
      createdAt: post.createdAt.toISOString(),
      currentUserLiked: post.likes.some((like) => like.userId === session.user.id),
      currentUserSaved: post.bookmarks.some((bookmark) => bookmark.userId === session.user.id),
    }));

    return NextResponse.json({
      posts: formattedPosts,
      nextCursor,
      hasMore,
    });
  } catch (error) {
    console.error("Error fetching feed:", error);
    return NextResponse.json(
      { error: "Failed to fetch feed" },
      { status: 500 }
    );
  }
}