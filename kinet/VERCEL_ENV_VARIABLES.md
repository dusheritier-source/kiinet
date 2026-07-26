# Vercel Environment Variables

This document lists all environment variables required for the Kinet application, grouped by category for easy setup in Vercel.

## 📋 How to Add to Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add each variable below, selecting the appropriate environment(s) (Production, Preview, Development)
4. Click **Save** after adding each variable

---

## 🔥 Firebase Configuration (Client-side)

These variables are prefixed with `NEXT_PUBLIC_` because they're exposed to the browser. They're required for Firebase authentication, Firestore, and Analytics.

| Variable Name | Value (from .env.local) | Description |
|--------------|------------------------|-------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | `AIzaSyCBuRIXM36SnhoNaPZi1Wl9dWdXzZjN7CE` | Firebase API key for client-side authentication |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `kinet-3a9b6.firebaseapp.com` | Firebase authentication domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `kinet-3a9b6` | Firebase project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `kinet-3a9b6.firebasestorage.app` | Firebase storage bucket for file uploads |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `919183651612` | Firebase Cloud Messaging sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `1:919183651612:web:58b55e27330a00abe5c0d9` | Firebase app ID |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | `G-W1SVHLK71K` | Firebase Analytics measurement ID (Google Analytics) |

**Used in:** `kinet/lib/firebase.ts`

---

## 🤖 AI/ML Services (Server-side)

These variables are server-side only (no `NEXT_PUBLIC_` prefix) for security. They're used in API routes for AI-powered features.

### OpenAI

| Variable Name | Description | Required |
|--------------|-------------|----------|
| `OPENAI_API_KEY` | OpenAI API key for GPT models and highlight analysis | Yes |
| `OPENAI_MODEL` | OpenAI model to use (default: `gpt-5.2`) | No |

**Used in:**
- `kinet/app/api/ai-coach/route.ts`
- `kinet/app/api/highlight-analysis/route.ts`
- `kinet/app/api/media-assist/route.ts`
- `kinet/lib/recruiting-readiness.ts`

### Groq (Alternative AI Provider)

| Variable Name | Description | Required |
|--------------|-------------|----------|
| `GROQ_API_KEY` | Groq API key for Llama models (alternative to OpenAI) | No |
| `GROQ_MODEL` | Groq model to use (default: `llama-3.3-70b-versatile`) | No |

**Used in:** `kinet/app/api/ai-coach/route.ts`

**Note:** If `GROQ_API_KEY` is set, it takes priority over `OPENAI_API_KEY` in the AI Coach feature.

---

## 📸 Cloudinary (Media Storage)

Client-side variables for Cloudinary image/video uploads and transformations.

| Variable Name | Description | Required |
|--------------|-------------|----------|
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | Yes |
| `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | Cloudinary upload preset for unsigned uploads | Yes |

**Used in:** `kinet/lib/cloudinary.ts`

---

## 🔔 Notifications & Webhooks (Server-side)

### Push Notifications

| Variable Name | Description | Required |
|--------------|-------------|----------|
| `PUSH_DELIVERY_WEBHOOK_URL` | Webhook URL for push notification delivery (e.g., OneSignal, Firebase Cloud Messaging) | No |

**Used in:** `kinet/app/api/notifications/push/route.ts`

### Email Digests

| Variable Name | Description | Required |
|--------------|-------------|----------|
| `EMAIL_DIGEST_WEBHOOK_URL` | Webhook URL for email digest delivery (e.g., SendGrid, Mailgun, Resend) | No |

**Used in:** `kinet/app/api/notifications/digest/route.ts`

---

## 🔐 Admin & Moderation (Client-side)

| Variable Name | Description | Required |
|--------------|-------------|----------|
| `NEXT_PUBLIC_KINET_ADMIN_UIDS` | Comma-separated list of Firebase UIDs with admin privileges | No |

**Used in:** `kinet/lib/moderation.ts`

**Example value:** `uid1,uid2,uid3`

**Example value:** `uid1,uid2,uid3`

---

## 📊 Summary by Environment

### Required for Basic Functionality
- ✅ All Firebase variables (7 variables)
- ✅ Cloudinary variables (2 variables)

### Required for AI Features
- ✅ `OPENAI_API_KEY` (or `GROQ_API_KEY` as alternative)

### Optional (Enhanced Features)
- ⚠️ `PUSH_DELIVERY_WEBHOOK_URL` - Push notifications
- ⚠️ `EMAIL_DIGEST_WEBHOOK_URL` - Email digests
- ⚠️ `NEXT_PUBLIC_Kinet_ADMIN_UIDS` - Admin panel access
- ⚠️ `GROQ_API_KEY` + `GROQ_MODEL` - Alternative AI provider

---

## 🚀 Quick Setup Checklist

- [ ] Add all 7 Firebase variables
- [ ] Add 2 Cloudinary variables
- [ ] Add `OPENAI_API_KEY` (or `GROQ_API_KEY`)
- [ ] (Optional) Add webhook URLs for notifications
- [ ] (Optional) Add admin UIDs
- [ ] Redeploy your Vercel project
- [ ] Test the application

---

## 📝 Notes

1. **NEXT_PUBLIC_ prefix**: Variables with this prefix are accessible in the browser (client-side). Never add sensitive secrets with this prefix.
2. **Server-side only**: Variables without `NEXT_PUBLIC_` are only available in API routes and server components.
3. **Default values**: Some variables have fallback defaults in the code (e.g., `OPENAI_MODEL` defaults to `gpt-5.2`).
4. **Security**: Keep API keys secure. Rotate them regularly and never commit them to version control.

---

## 🔍 Where Variables Are Used

| Variable | File Path | Purpose |
|----------|-----------|---------|
| `NEXT_PUBLIC_FIREBASE_*` | `kinet/lib/firebase.ts` | Firebase initialization |
| `OPENAI_API_KEY` | `kinet/app/api/ai-coach/route.ts` | AI Coach feature |
| `OPENAI_API_KEY` | `kinet/app/api/highlight-analysis/route.ts` | Video highlight analysis |
| `OPENAI_API_KEY` | `kinet/app/api/media-assist/route.ts` | Media assistance |
| `OPENAI_API_KEY` | `kinet/lib/recruiting-readiness.ts` | Recruiting analysis |
| `GROQ_API_KEY` | `kinet/app/api/ai-coach/route.ts` | Alternative AI provider |
| `NEXT_PUBLIC_CLOUDINARY_*` | `kinet/lib/cloudinary.ts` | Media uploads |
| `PUSH_DELIVERY_WEBHOOK_URL` | `kinet/app/api/notifications/push/route.ts` | Push notifications |
| `EMAIL_DIGEST_WEBHOOK_URL` | `kinet/app/api/notifications/digest/route.ts` | Email digests |
| `NEXT_PUBLIC_Kinet_ADMIN_UIDS` | `kinet/lib/moderation.ts` | Admin access control |

---

## 🆘 Troubleshooting

**Firebase not working?**
- Ensure all 7 Firebase variables are correctly set
- Check that the Firebase project exists and is active
- Verify API keys haven't expired

**AI features not working?**
- Ensure either `OPENAI_API_KEY` or `GROQ_API_KEY` is set
- Check API key has sufficient credits/quota
- Verify the API key has access to the specified model

**Media uploads failing?**
- Verify Cloudinary credentials are correct
- Check upload preset is configured in Cloudinary dashboard
- Ensure the preset allows unsigned uploads if not using authentication

**Notifications not sending?**
- Verify webhook URLs are correct and accessible
- Check webhook service is running and configured
- Review Vercel function logs for errors