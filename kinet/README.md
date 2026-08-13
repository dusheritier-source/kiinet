# Kinet

Kinet is a sports-focused social platform built with Next.js 14, TypeScript, Firebase, and Supabase Storage.

## Runtime architecture

- Next.js App Router hosts the web UI and authenticated server endpoints.
- Firebase Authentication provides email/password and Google sign-in.
- Cloud Firestore stores profiles, posts, messaging, teams, notifications, moderation, and product data.
- Firebase Realtime Database supports presence and selected real-time workflows.
- Supabase Storage stores media accepted by the server moderation endpoint.
- Firebase Cloud Messaging provides browser push tokens; delivery is delegated to a trusted webhook.
- A Firestore-backed job queue provides idempotent notification delivery, exponential retries, lease recovery, scheduled publishing, expiry cleanup, and missed-call finalization.

Prisma, PostgreSQL, NextAuth, Cloudflare R2, and direct client-side Supabase uploads are not part of the runtime.

## Local setup

1. Copy `.env.example` to `.env.local` and fill in Firebase and Supabase values.
2. Run `npm install`.
3. Run `npm run dev`.

Useful checks:

```bash
npm run typecheck
npm run lint
npm test
npm run test:rules
npm run test:security
npm run test:smoke
npm run audit:production
npm run build
```

## Production requirements

- Set `KINET_SESSION_SECRET` to a strong random secret.
- Set `CRON_SECRET` and configure Firebase Admin credentials for `/api/jobs/run`.
- Configure Firebase custom claims (`admin` or `moderator`) for staff accounts.
- Deploy `firestore.rules`, `storage.rules`, and `database.rules.json`.
- Keep `SUPABASE_SERVICE_ROLE_KEY`, AI keys, and delivery webhooks server-only.
- Leave `TEST_ALLOW_BYPASS` and `DISABLE_MODERATION` disabled.

See [ARCHITECTURE.md](ARCHITECTURE.md) for component boundaries and [API_KEYS_NEEDED.md](API_KEYS_NEEDED.md) for configuration details.

## Continuous integration

GitHub Actions runs unit/API tests, Firestore emulator rule tests, TypeScript, ESLint, a production build, HTTP smoke tests, and Android unit tests. Run `npm run quality` for the main local web pipeline; `npm run test:rules` additionally requires Java and downloads the Firestore emulator on first use.

Use [LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md) for production sign-off. The `/api/health` endpoint and structured worker events support uptime monitoring and operational alerts.
