# Kinet - Modern Social Media Platform

A high-performance, real-time social media web application built with Next.js 14, TypeScript, Prisma, and PostgreSQL.

## 🚀 Tech Stack

### Core Framework
- **Next.js 14** (App Router, React Server Components, Server Actions)
- **TypeScript** (Strict mode enabled)
- **Tailwind CSS** (Dark-mode first design with shadcn/ui components)

### Database & ORM
- **PostgreSQL** (Hosted on Supabase or Neon)
- **Prisma ORM** (Connection pooling, optimized queries)
- **Cursor-based pagination** for efficient data fetching

### Authentication
- **NextAuth.js v5** (JWT strategy)
- **Credentials Provider** (Email/Password with bcrypt)
- **Google OAuth** Provider
- **Prisma Adapter** for session management

### State Management & Data Fetching
- **TanStack Query (React Query)** v5 (Infinite queries, optimistic updates)
- **Zustand** (Global client state)
- **React Virtuoso** (List virtualization for performance)

### File Storage
- **Cloudflare R2** (S3-compatible object storage)
- Client-side image compression before upload

### Real-Time Features
- **Supabase Realtime** or **Pusher** (Ready for integration)
- WebSocket support for instant notifications and messaging

## 📁 Project Structure

```
kinet/
├── prisma/
│   └── schema.prisma          # Database schema with optimized indices
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/ # NextAuth.js API route
│   │   ├── feed/route.ts      # Cursor-based feed API
│   │   ├── posts/
│   │   │   ├── route.ts       # Create post endpoint
│   │   │   └── [postId]/
│   │   │       ├── like/route.ts   # Like/unlike post
│   │   │       └── save/route.ts   # Bookmark/unbookmark
│   │   └── upload/route.ts    # File upload to R2
│   ├── _components/
│   │   ├── LandingPageClient.tsx  # Modern hero section
│   │   └── FeedClient.tsx         # 3-column feed layout
│   ├── feed/
│   │   ├── page.tsx           # Server component
│   │   └── _components/
│   │       └── FeedClient.tsx # Client component with infinite scroll
│   ├── page.tsx               # Landing page (server component)
│   └── layout.tsx             # Root layout with providers
├── components/
│   ├── ui/                    # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── textarea.tsx
│   │   └── avatar.tsx
│   ├── QueryProvider.tsx      # TanStack Query provider
│   ├── ProtectedRoute.tsx     # Route guard component
│   └── AuthProvider.tsx       # Authentication context
├── lib/
│   ├── auth.ts                # NextAuth configuration
│   ├── prisma.ts              # Prisma client singleton
│   ├── storage.ts             # R2 upload utilities
│   ├── utils.ts               # cn() utility function
│   ├── store.ts               # Zustand stores
│   └── admin.ts               # App settings
├── middleware.ts              # Next.js middleware for route protection
├── package.json
└── .env.example               # Environment variables template
```

## 🗄️ Database Schema

### Core Models

#### User
- `id`, `username`, `email`, `passwordHash`, `avatarUrl`, `bio`
- Relations: posts, likes, bookmarks, followers, following, comments

#### Post
- `id`, `content`, `mediaUrl`, `mediaType`, `authorId`, `parentId`
- Supports threaded comments via `parentId`
- Relations: author, likes, bookmarks, comments, replies

#### Follow
- Composite unique key: `[followerId, followingId]`
- Bidirectional relationship mapping

#### Like & Bookmark
- Composite unique keys prevent duplicates
- Optimized indices for user and post queries

#### Comment
- Supports nested replies via `parentCommentId`
- Recursive relationship for comment threads

#### Notification
- Types: like, comment, follow, repost
- Indexed by `[userId, read]` and `[userId, createdAt]`

#### Message
- Direct messaging support
- Indexed by `senderId` and `createdAt`

### Performance Indices
- `User`: username, email, createdAt
- `Post`: authorId, parentId, createdAt DESC, [authorId, createdAt DESC]
- `Follow`: followerId, followingId, createdAt
- `Like/Bookmark`: userId, postId, createdAt
- `Comment`: userId, postId, parentCommentId, createdAt
- `Notification`: [userId, read], [userId, createdAt DESC]

## 🎨 UI/UX Features

### Landing Page (`app/page.tsx`)
- **Server-side authentication check** - Redirects authenticated users to `/feed`
- **Modern hero section** with gradient branding
- **Feature showcase** (Real-Time, Rich Media, Community)
- **Trending preview** section
- **CTA buttons** for signup/login
- **Fully responsive** design

### Feed Page (`app/feed/page.tsx`)
- **3-column responsive layout**:
  - Left: Navigation sidebar (Home, Profile, Messages, Bookmarks)
  - Center: Post creation + infinite scroll feed
  - Right: Trending hashtags + "Who to follow" suggestions
- **Infinite scrolling** with TanStack Query
- **Cursor-based pagination** for optimal database performance
- **Optimistic UI updates** for likes, saves, and reposts
- **Post creation** with text input
- **Media support** (images/videos)
- **Interactive buttons**: Like, Comment, Repost, Share, Bookmark

### Optimistic UI Implementation
```typescript
// Instant UI update before server confirmation
const handleLike = async (postId: string, hasLiked: boolean) => {
  // Update cache immediately
  queryClient.setQueryData(["feed"], (old) => {
    // Optimistic update logic
  });
  
  // Send request to server
  await fetch("/api/posts/like", { ... });
  
  // Refetch to ensure consistency
  refetch();
};
```

## 🔐 Authentication & Security

### NextAuth.js Configuration
- **JWT strategy** for session management
- **Credentials provider** with bcrypt password hashing
- **Google OAuth** integration
- **Custom callbacks** for user ID in session

### Middleware Protection
```typescript
// Protected routes
export const config = {
  matcher: [
    "/feed/:path*",
    "/messages/:path*",
    "/settings/:path*",
    "/upload/:path*",
    "/notifications/:path*",
    "/bookmarks/:path*",
  ],
};
```

### API Route Protection
All API routes verify session:
```typescript
const session = await getServerSession(authOptions);
if (!session?.user?.id) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

## 📤 File Upload Pipeline

### Client-Side Compression
```typescript
// Compress image before upload
const compressedFile = await imageCompression(file, {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
});
```

### Server-Side Upload to R2
```typescript
// Upload to Cloudflare R2
const publicUrl = await uploadToR2(
  buffer,
  fileName,
  contentType,
  folder
);
```

### Supported Formats
- **Images**: JPEG, PNG, GIF, WebP
- **Videos**: MP4, WebM
- **Max size**: 50MB

## 🚀 Performance Optimizations

### Database
- **Cursor-based pagination** (no OFFSET)
- **Composite indices** for common queries
- **Connection pooling** via Prisma
- **Selective field inclusion** to reduce payload

### Frontend
- **React Server Components** for initial load
- **List virtualization** with react-virtuoso
- **Image optimization** via Next.js Image
- **Query caching** with TanStack Query
- **Optimistic UI** for instant feedback

### Caching Strategy
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,      // 1 minute
      gcTime: 5 * 60 * 1000,     // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
```

## 🛠️ Setup Instructions

### 1. Install Dependencies
```bash
cd kinet
npm install
```

### 2. Set Up Environment Variables
```bash
cp .env.example .env.local
```

Fill in:
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_URL` - Your app URL
- `NEXTAUTH_SECRET` - Generate with `openssl rand -base64 32`
- `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET` - Google OAuth
- `R2_*` - Cloudflare R2 credentials

### 3. Set Up Database
```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Or run migrations
npm run db:migrate
```

### 4. Run Development Server
```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## 📦 Key Dependencies

```json
{
  "dependencies": {
    "@next-auth/prisma-adapter": "^1.0.7",
    "@prisma/client": "^5.22.0",
    "@tanstack/react-query": "^5.62.0",
    "@tanstack/react-query-devtools": "^5.62.0",
    "next-auth": "^5.0.0-beta.25",
    "react-virtuoso": "^4.12.3",
    "zustand": "^5.0.3",
    "browser-image-compression": "^2.0.2",
    "@aws-sdk/client-s3": "^3.0.0",
    "bcryptjs": "^2.4.3",
    "date-fns": "^4.1.0"
  }
}
```

## 🎯 Features Implemented

### ✅ Completed
- [x] Modern landing page with hero section
- [x] 3-column responsive feed layout
- [x] Infinite scroll with cursor-based pagination
- [x] Optimistic UI for likes, saves, reposts
- [x] NextAuth.js with credentials and Google OAuth
- [x] Prisma schema with optimized indices
- [x] Middleware for route protection
- [x] File upload API with R2 integration
- [x] TanStack Query setup with caching
- [x] Zustand global state management
- [x] shadcn/ui components (Button, Card, Textarea, Avatar)
- [x] Post creation functionality
- [x] Like/unlike functionality
- [x] Bookmark/save functionality

### 🔄 Ready for Integration
- [ ] Real-time notifications (Supabase Realtime/Pusher)
- [ ] Direct messaging system
- [ ] User profiles with edit functionality
- [ ] Image/video compression on client
- [ ] Repost/retweet functionality
- [ ] Comment threads with nested replies
- [ ] Search functionality
- [ ] Hashtag system
- [ ] User follow/unfollow
- [ ] Admin dashboard

## 🔧 Configuration

### Next.js Config (`next.config.js`)
```javascript
{
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'your-r2-domain.com' }
    ]
  }
}
```

### Tailwind Config
- Dark mode enabled by default
- Custom color scheme (cyan/blue gradients)
- CSS variables for theming

## 📝 Environment Variables

See `.env.example` for complete list. Key variables:

```env
# Database
DATABASE_URL="postgresql://..."

# Auth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="..."
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."

# Storage
R2_ENDPOINT="..."
R2_ACCESS_KEY_ID="..."
R2_SECRET_ACCESS_KEY="..."
R2_BUCKET_NAME="kinet-bucket"
R2_PUBLIC_URL="..."
```

## 🚢 Deployment

### Vercel (Recommended)
1. Push to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

### Database
- **Supabase**: Free tier available, PostgreSQL included
- **Neon**: Serverless PostgreSQL with branching

### Storage
- **Cloudflare R2**: 10GB free, no egress fees

## 📄 License

MIT © 2026 Kinet Technologies

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

---

Built with ❤️ by the Kinet Team