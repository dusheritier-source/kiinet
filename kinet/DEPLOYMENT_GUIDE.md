# Kinet deployment guide

## 1. Provision isolated production services

- Create a production Firebase project with Authentication, Firestore, Realtime Database, Cloud Messaging, and authorized production domains.
- Create a production Supabase project and a public `kinet-media` storage bucket.
- Do not reuse development service-role keys in production.

## 2. Configure environment variables

Copy the variable names from `.env.production.example` and `.env.example` into the hosting provider. Required values are:

- all Firebase client variables;
- `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`;
- `KINET_SESSION_SECRET` with at least 32 random bytes;
- `CRON_SECRET` with at least 32 random bytes;
- Firebase Admin service credentials using `FIREBASE_SERVICE_ACCOUNT_KEY` or the three split credential variables;
- `NEXT_PUBLIC_SITE_URL` using the canonical HTTPS origin.

Configure push, email, AI, and TURN variables only when those integrations are enabled. Keep `TEST_ALLOW_BYPASS=false` and `DISABLE_MODERATION=false`.

## 3. Configure staff access

Grant staff accounts Firebase custom claims such as `{ admin: true }` or `{ moderator: true }`. Sign out and back in after changing claims so Firebase issues a refreshed ID token.

## 4. Deploy security configuration

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage,database
```

Review rule changes in a non-production Firebase project before promoting them.

## 5. Validate the release

```bash
npm ci
npm run test:security
npm run typecheck
npm run lint
npm run build
```

Load the real production environment locally or in a protected deployment job, then run `npm run release:check`. It fails on missing credentials, weak secrets, insecure origins, unsafe test switches, and incomplete TURN settings.

## 6. Deploy Next.js

Deploy the `kinet` directory to Vercel or another Next.js-compatible host. The build command is `npm run vercel-build` and the output is `.next`.

After deployment, verify sign-in, signed navigation sessions, Firestore access, moderated uploads, admin claims, notifications, and account sign-out. Confirm that `/test-env` and `/test-realtime` return 404.

Configure uptime monitoring against `GET /api/health`. A `200` response means the required server configuration and Firestore connection are healthy; `503` means the deployment must be investigated. Forward JSON application logs to the hosting provider's alerting system and alert on `jobs.failed` and repeated `health.firestore_failed` events.

Verify that Vercel Cron calls `/api/jobs/run` every five minutes and that queued jobs transition to `completed`. Deploy the new Firestore indexes before enabling the worker. Production calling should use a credentialed `turn:` or `turns:` relay; STUN-only calls are not considered production-ready.

## Rollback

Keep the prior application deployment and prior Firebase ruleset available. If authorization failures spike, roll back the application and rules together to avoid client/rule schema mismatches.
