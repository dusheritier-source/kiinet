# Kinet architecture

## System boundaries

```text
Browser / Capacitor shell
  ├─ Firebase Auth
  ├─ Firestore listeners and owner-scoped writes
  └─ Next.js authenticated APIs
       ├─ Firebase token verification
       ├─ AI and notification integrations
       └─ moderated upload → Supabase Storage
```

## Authentication

Clients authenticate with Firebase and attach an ID token to protected API calls. The session endpoint verifies that token and issues a signed, short-lived HttpOnly navigation cookie. API authorization always verifies the Firebase bearer token; the cookie is only a middleware navigation gate.

Staff authorization uses Firebase custom claims. Public environment variables never grant privileges.

## Data

Firestore is the application database. Security rules are the final authorization boundary for browser operations. Sensitive server endpoints additionally authenticate, validate, and rate-limit requests.

Supabase is storage-only. Uploads go through `/api/upload`, where identity, type, size, path, and moderation are checked before the service-role client writes the object.

## Background work

Notification endpoints enqueue deterministic `backgroundJobs` documents. Vercel Cron invokes `/api/jobs/run` every five minutes with `CRON_SECRET`; the worker claims jobs transactionally, applies a 60-second lease, retries failures with exponential backoff, and stops after five attempts. The same run publishes scheduled posts, expires stories and notifications, and finalizes stale ringing calls. Firebase security rules deny all client access to job records.

Push jobs use Firebase Cloud Messaging directly when no trusted push webhook is configured. Email delivery requires `EMAIL_DIGEST_WEBHOOK_URL`.

## Environments

Use separate Firebase and Supabase projects for development, staging, and production. Never reuse production service-role keys locally. Templates are provided in `.env.example`, `.env.development.example`, and `.env.production.example`.
