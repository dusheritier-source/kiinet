# Kinet - System Architecture

## Overview

Kinet is a modern, high-performance social media platform built with Next.js 14, featuring real-time updates, infinite scrolling feeds, and a scalable PostgreSQL database.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Client Layer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Landing    │  │     Feed     │  │   Profile    │     │
│  │   Page       │  │   Page       │  │   Pages      │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      Next.js 14 App Router                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Server Components (RSC)                             │  │
│  │  - Initial page load                                 │  │
│  │  - SEO optimization                                  │  │
│  │  - Authentication checks                             │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Client Components                                   │  │
│  │  - Interactive UI                                    │  │
│  │  - TanStack Query hooks                              │  │
│  │  - Optimistic updates                                │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                        API Layer                             │
│  ┌────────────┐  ┌────────────┐  ┌──────────────────────┐  │
│  │   NextAuth │  │   Feed     │  │   Posts              │  │
│  │   Routes   │  │   API      │  │   API                │  │
│  └────────────┘  └────────────┘  └──────────────────────┘  │
│  ┌────────────┐  ┌────────────┐  ┌──────────────────────┐  │
│  │   Upload   │  │   Like/    │  │   Save/Bookmark      │  │
│  │   API      │  │   Save     │  │   API                │  │
│  └────────────┘  └────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      Business Logic Layer                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  lib/                                                │  │
│  │  - auth.ts      (NextAuth config)                    │  │
│  │  - prisma.ts    (Database client)                    │  │
│  │  - storage.ts   (R2 uploads)                         │  │
│  │  - store.ts     (Zustand state)                      │  │
│  │  - admin.ts     (App settings)                       │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                        Data Layer                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  PostgreSQL (Supabase/Neon)                          │  │
│  │  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐   │  │
│  │  │  User  │  │  Post  │  │  Like  │  │ Comment│   │  │
│  │  └────────┘  └────────┘  └────────┘  └────────┘   │  │
│  │  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐   │  │
│  │  │ Follow │  │ Bookmark│ │ Repost│  │ Notif. │   │  │
│  │  └────────┘  └────────┘  └────────┘  └────────┘   │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      Storage Layer                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Cloudflare R2 (S3-compatible)                       │  │
│  │  - User avatars                                      │  │
│  │  - Post media (images/videos)                        │  │
│  │  - Reels                                             │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### Feed Loading Flow

```
1. User visits /feed
   ↓
2. Server Component (app/feed/page.tsx)
   - Checks authentication via getServerSession()
   - Returns null if not authenticated
   ↓
3. Client Component (FeedClient)
   - Initializes TanStack Query
   - Fetches first page from /api/feed
   ↓
4. API Route (app/api/feed/route.ts)
   - Validates session
   - Queries database with cursor-based pagination
   - Returns formatted posts
   ↓
5. Prisma Query
   - SELECT with WHERE parentId IS NULL
   - ORDER BY createdAt DESC
   - LIMIT 20 + 1
   - Includes author, likes, bookmarks
   ↓
6. Response cached in TanStack Query
   - staleTime: 60s
   - gcTime: 5min
   ↓
7. UI renders posts
   - Infinite scroll loads more on scroll
   - Virtuoso for virtualization (future)
```

### Like/Unlike Flow (Optimistic UI)

```
1. User clicks Like button
   ↓
2. Optimistic Update (immediate)
   - Update TanStack Query cache
   - Toggle like status in UI
   - Increment/decrement count
   ↓
3. API Request (background)
   - POST /api/posts/[postId]/like
   - Body: { action: "like" | "unlike" }
   ↓
4. Server Processing
   - Validate session
   - Create/Delete Like record
   ↓
5. Response
   - Success: Keep optimistic update
   - Error: Rollback to previous state
   ↓
6. Refetch (optional)
   - Ensure consistency
   - Update any stale data
```

### File Upload Flow

```
1. User selects file
   ↓
2. Client-side Compression (optional)
   - browser-image-compression
   - Max 1920x1920, 1MB
   ↓
3. Upload to API
   - POST /api/upload
   - FormData with file
   ↓
4. Server Processing
   - Validate session
   - Check file type/size
   - Generate unique filename
   ↓
5. Upload to R2
   - S3-compatible API
   - Public-read ACL
   ↓
6. Return URL
   - Public R2 URL
   - Used in post creation
```

## Database Schema

### Entity Relationship Diagram

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│    User     │───────│    Post     │───────│    Like     │
│             │       │             │       │             │
│ id (PK)     │       │ id (PK)     │       │ id (PK)     │
│ username    │       │ content     │       │ userId (FK) │
│ email       │       │ authorId    │       │ postId (FK) │
│ passwordHash│       │ parentId    │       │ createdAt   │
│ avatarUrl   │       │ createdAt   │       │             │
│ bio         │       │             │       │ UNIQUE:     │
│ createdAt   │       │ FK: author  │       │ [userId,    │
└─────────────┘       └─────────────┘       │  postId]    │
       │                    │              └─────────────┘
       │                    │
       │                    │
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   Follow    │       │  Comment    │       │  Bookmark   │
│             │       │             │       │             │
│ id (PK)     │       │ id (PK)     │       │ id (PK)     │
│ followerId  │       │ text        │       │ userId (FK) │
│ followingId │       │ userId (FK) │       │ postId (FK) │
│ createdAt   │       │ postId (FK) │       │ createdAt   │
│             │       │ parentId    │       │             │
│ UNIQUE:     │       │ createdAt   │       │ UNIQUE:     │
│ [follower,  │       │             │       │ [userId,    │
│  following] │       │ FK: parent  │       │  postId]    │
└─────────────┘       └─────────────┘       └─────────────┘
```

### Index Strategy

```sql
-- User lookups
CREATE INDEX idx_user_username ON "User"(username);
CREATE INDEX idx_user_email ON "User"(email);
CREATE INDEX idx_user_created_at ON "User"(createdAt);

-- Post queries
CREATE INDEX idx_post_author ON "Post"(authorId);
CREATE INDEX idx_post_parent ON "Post"(parentId);
CREATE INDEX idx_post_created_at ON "Post"(createdAt DESC);
CREATE INDEX idx_post_author_created ON "Post"(authorId, createdAt DESC);

-- Social graph
CREATE INDEX idx_follow_follower ON "Follow"(followerId);
CREATE INDEX idx_follow_following ON "Follow"(followingId);
CREATE UNIQUE INDEX idx_follow_unique ON "Follow"(followerId, followingId);

-- Interactions
CREATE UNIQUE INDEX idx_like_unique ON "Like"(userId, postId);
CREATE INDEX idx_like_user ON "Like"(userId);
CREATE INDEX idx_like_post ON "Like"(postId);

CREATE UNIQUE INDEX idx_bookmark_unique ON "Bookmark"(userId, postId);
CREATE INDEX idx_bookmark_user ON "Bookmark"(userId);
CREATE INDEX idx_bookmark_post ON "Bookmark"(postId);

-- Comments
CREATE INDEX idx_comment_post ON "Comment"(postId);
CREATE INDEX idx_comment_parent ON "Comment"(parentCommentId);
CREATE INDEX idx_comment_user ON "Comment"(userId);

-- Notifications
CREATE INDEX idx_notification_user_read ON "Notification"(userId, read);
CREATE INDEX idx_notification_user_created ON "Notification"(userId, createdAt DESC);
```

## State Management

### Client State (Zustand)

```typescript
// User state
const useUserStore = create<UserState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  clearUser: () => set({ user: null }),
}));

// UI state
const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  theme: "dark",
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setTheme: (theme) => set({ theme }),
}));
```

### Server State (TanStack Query)

```typescript
// Feed query
const { data, fetchNextPage, hasNextPage } = useInfiniteQuery({
  queryKey: ["feed"],
  queryFn: fetchFeed,
  getNextPageParam: (lastPage) => lastPage.nextCursor,
});

// Optimistic update
useMutation({
  mutationFn: toggleLike,
  onMutate: async (newData) => {
    await queryClient.cancelQueries({ queryKey: ["feed"] });
    const previousData = queryClient.getQueryData(["feed"]);
    queryClient.setQueryData(["feed"], (old) => optimisticUpdate(old, newData));
    return { previousData };
  },
  onError: (err, newData, context) => {
    queryClient.setQueryData(["feed"], context?.previousData);
  },
});
```

## Security Architecture

### Authentication Flow

```
1. User submits credentials
   ↓
2. NextAuth validates
   - Credentials: bcrypt.compare()
   - Google: OAuth token verification
   ↓
3. JWT creation
   - Payload: { id, email, name, picture }
   - Signed with NEXTAUTH_SECRET
   ↓
4. Session cookie
   - HttpOnly
   - Secure (HTTPS only)
   - SameSite: Lax
   ↓
5. Middleware validation
   - Checks for session cookie
   - Redirects to /login if missing
```

### Authorization

```typescript
// Middleware protects routes
export const config = {
  matcher: ["/feed/:path*", "/messages/:path*", ...],
};

// API routes validate
const session = await getServerSession(authOptions);
if (!session?.user?.id) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

// Database queries filter by user
const posts = await prisma.post.findMany({
  where: { authorId: session.user.id },
});
```

## Performance Optimizations

### Database

1. **Cursor-based Pagination**
   ```typescript
   // Instead of OFFSET
   const posts = await prisma.post.findMany({
     take: 20,
     skip: 1,
     cursor: { id: lastPostId },
   });
   ```

2. **Composite Indices**
   ```prisma
   @@index([authorId, createdAt(sort: Desc)])
   ```

3. **Selective Fields**
   ```typescript
   include: {
     author: {
       select: { id: true, username: true }, // Only needed fields
     },
   }
   ```

### Frontend

1. **React Server Components**
   - Initial page load is server-rendered
   - Reduces client JavaScript bundle

2. **List Virtualization**
   ```typescript
   <Virtuoso
     totalCount={posts.length}
     itemContent={(index) => <PostCard post={posts[index]} />}
   />
   ```

3. **Image Optimization**
   ```typescript
   <Image
     src={url}
     alt="Post media"
     width={800}
     height={600}
     loading="lazy"
   />
   ```

4. **Query Caching**
   ```typescript
   staleTime: 60 * 1000,  // 1 minute
   gcTime: 5 * 60 * 1000, // 5 minutes
   ```

## Scalability Considerations

### Horizontal Scaling

- **Next.js**: Deploy to Vercel (auto-scaling)
- **Database**: Supabase/Neon (managed PostgreSQL with read replicas)
- **Storage**: Cloudflare R2 (globally distributed, unlimited scale)

### Connection Pooling

```env
# Supabase pooler
DATABASE_URL="postgresql://...?pgbouncer=true"

# Prisma connection limit
DATABASE_CONNECTION_LIMIT=10
```

### Caching Strategy

```
┌─────────────┐
│   Browser   │  ← Cache-Control: max-age=3600
└─────────────┘
       │
       ▼
┌─────────────┐
│  Vercel CDN │  ← Edge Cache for static assets
└─────────────┘
       │
       ▼
┌─────────────┐
│   Next.js   │  ← Server-side caching
│   Server    │
└─────────────┘
       │
       ▼
┌─────────────┐
│  Database   │  ← Query result caching
│  (Postgres) │
└─────────────┘
```

## Monitoring & Observability

### Metrics to Track

1. **Performance**
   - API response times
   - Database query times
   - Page load times
   - Time to first byte (TTFB)

2. **Business**
   - Daily active users
   - Posts created per day
   - Likes/comments per post
   - User engagement rate

3. **Infrastructure**
   - Database connection pool usage
   - R2 storage usage
   - Vercel function execution time
   - Error rates

### Tools

- **Vercel Analytics**: Built-in performance monitoring
- **Prisma Studio**: Database browser
- **Supabase Dashboard**: Database metrics
- **Cloudflare Analytics**: R2 usage stats

## Future Enhancements

### Phase 2
- [ ] Real-time notifications (Supabase Realtime)
- [ ] Direct messaging with WebSocket
- [ ] Advanced search with Algolia/Meilisearch
- [ ] Image/video transcoding
- [ ] Content moderation AI

### Phase 3
- [ ] Mobile apps (React Native)
- [ ] Push notifications
- [ ] Advanced analytics dashboard
- [ ] Monetization features
- [ ] API for third-party integrations

---

This architecture ensures Kinet is:
- **Scalable**: Handles millions of users
- **Performant**: Sub-second load times
- **Maintainable**: Clean separation of concerns
- **Secure**: Industry-standard auth and validation
- **Cost-effective**: Optimized for minimal hosting costs