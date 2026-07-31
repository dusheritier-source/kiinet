# Kinet - Deployment Guide

Complete guide to deploy the Kinet social media platform to production.

## 📋 Prerequisites

- Node.js 18+ installed
- PostgreSQL database (Supabase or Neon)
- Cloudflare R2 account for file storage
- Google OAuth credentials (optional)
- Vercel account (recommended for deployment)

## 🚀 Step-by-Step Deployment

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd kinet
npm install
```

### 2. Database Setup

#### Option A: Supabase (Recommended)
1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Settings → Database → Connection string
3. Copy the "Connection pooler" URL (port 6543)
4. Update your `.env` file:

```env
DATABASE_URL="postgresql://postgres:[password]@[host]:6543/postgres?pgbouncer=true"
```

#### Option B: Neon
1. Create account at [neon.tech](https://neon.tech)
2. Create a new project
3. Copy the connection string
4. Update `.env`:

```env
DATABASE_URL="postgresql://[user]:[password]@[host]/[database]"
```

### 3. Initialize Database

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Or create and run migrations
npm run db:migrate
```

### 4. Cloudflare R2 Setup

1. Create R2 bucket at [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Create API token with R2 permissions
3. Note your endpoint, access key, and secret
4. Update `.env`:

```env
R2_ENDPOINT="https://[account-id].r2.cloudflarestorage.com"
R2_ACCESS_KEY_ID="your-access-key"
R2_SECRET_ACCESS_KEY="your-secret-key"
R2_BUCKET_NAME="kinet-bucket"
R2_PUBLIC_URL="https://[your-domain].com"
```

5. Set up custom domain (optional but recommended):
   - In R2 dashboard, go to your bucket
   - Settings → Public access → Connect custom domain
   - Add your domain (e.g., `cdn.kinet.com`)

### 5. Google OAuth Setup (Optional)

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (dev)
   - `https://your-domain.vercel.app/api/auth/callback/google` (prod)
6. Update `.env`:

```env
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"
```

### 6. NextAuth Configuration

Generate a secret key:

```bash
openssl rand -base64 32
```

Update `.env`:

```env
NEXTAUTH_URL="http://localhost:3000"  # Change to production URL
NEXTAUTH_SECRET="your-generated-secret"
```

### 7. Environment Variables

Create `.env.local` in the `kinet/` directory:

```env
# Database
DATABASE_URL="postgresql://..."

# NextAuth
NEXTAUTH_URL="https://your-domain.vercel.app"
NEXTAUTH_SECRET="..."

# Google OAuth (optional)
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."

# Cloudflare R2
R2_ENDPOINT="..."
R2_ACCESS_KEY_ID="..."
R2_SECRET_ACCESS_KEY="..."
R2_BUCKET_NAME="kinet-bucket"
R2_PUBLIC_URL="https://cdn.your-domain.com"

# Optional: Real-time
NEXT_PUBLIC_SUPABASE_URL="..."
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
```

### 8. Deploy to Vercel

#### Option A: Via CLI
```bash
npm install -g vercel
vercel
```

#### Option B: Via GitHub
1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import repository
4. Add environment variables
5. Deploy

### 9. Post-Deployment

#### Update Next.js Config
Edit `next.config.js` to allow R2 images:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.your-domain.com',
      },
    ],
  },
};

module.exports = nextConfig;
```

#### Run Database Migrations (if using migrations)
```bash
# On Vercel, add to package.json scripts:
vercel env pull .env.local
npm run db:migrate
```

## 🔍 Verification Checklist

- [ ] Database connection successful
- [ ] Prisma client generated
- [ ] All tables created in database
- [ ] R2 bucket accessible
- [ ] File upload working
- [ ] Authentication working (signup/login)
- [ ] Feed loading with posts
- [ ] Like/save functionality working
- [ ] Landing page accessible
- [ ] Middleware protecting routes

## 🐛 Common Issues

### Issue: "Cannot find module 'next-auth'"
**Solution**: Run `npm install` to install all dependencies

### Issue: Database connection timeout
**Solution**: 
- Check DATABASE_URL is correct
- Ensure database is running
- For Supabase, use connection pooler (port 6543)

### Issue: R2 upload failing
**Solution**:
- Verify R2 credentials
- Check bucket permissions
- Ensure CORS is configured on R2 bucket

### Issue: Google OAuth not working
**Solution**:
- Verify redirect URIs match exactly
- Check client ID and secret
- Ensure Google+ API is enabled

## 📊 Performance Optimization

### Database
```bash
# Run ANALYZE on tables after initial data load
npm run db:studio  # Use Prisma Studio to verify
```

### Caching
- Enable Vercel Edge Cache for static assets
- Configure CDN for R2 bucket
- Set appropriate cache headers in API routes

### Monitoring
- Enable Vercel Analytics
- Set up database monitoring (Supabase/Neon)
- Monitor R2 usage and costs

## 🔒 Security Checklist

- [ ] NEXTAUTH_SECRET is strong and random
- [ ] Database credentials are secure
- [ ] R2 bucket has appropriate permissions
- [ ] API routes validate authentication
- [ ] Input validation on all forms
- [ ] CORS configured correctly
- [ ] HTTPS enabled (automatic on Vercel)

## 📈 Scaling Considerations

### Database
- Use connection pooling (PgBouncer)
- Monitor query performance
- Add read replicas if needed
- Consider database partitioning for large datasets

### Storage
- R2 scales automatically
- Monitor egress costs
- Use CDN for frequently accessed assets

### Application
- Enable Vercel Pro for better performance
- Use Edge Functions for low-latency routes
- Implement Redis for session caching (optional)

## 🚨 Backup Strategy

### Database
```bash
# Supabase: Automated backups available
# Neon: Branch-based backups
# Manual backup:
pg_dump $DATABASE_URL > backup.sql
```

### Files
- R2 has versioning (enable in settings)
- Regular exports recommended for critical data

## 📞 Support

If you encounter issues:
1. Check Vercel logs
2. Check database logs
3. Review environment variables
4. Consult README.md for architecture details

---

**Deployment completed!** 🎉

Your Kinet app should now be live at `https://your-app.vercel.app`