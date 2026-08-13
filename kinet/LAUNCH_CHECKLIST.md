# Kinet launch checklist

## Release gate

- Run `npm ci`, `npm run quality`, and `npm run release:check` against the production configuration.
- Deploy Firestore, Storage, and Realtime Database rules and Firestore indexes before the application.
- Confirm that test bypasses and moderation bypasses are disabled.
- Confirm that session and cron secrets are unique production values with at least 32 characters.

## Functional verification

- Test sign-up, sign-in, sign-out, password recovery, onboarding, and protected-route redirects.
- Test posting, uploads, feeds, messaging, notifications, reporting, moderation, and admin authorization with production-like accounts.
- Test audio/video calls across separate networks and confirm that TURN relay candidates work.
- Confirm scheduled posts, expired stories, missed calls, push jobs, and digest jobs are processed by the cron worker.

## Operations

- Monitor `/api/health` from outside the hosting provider.
- Alert on HTTP 5xx rate, job failures, degraded health, authentication failures, and moderation provider failures.
- Verify Firebase, Supabase, email, push, AI, TURN, and Vercel quotas and billing alerts.
- Document the on-call owner and test the application-and-rules rollback procedure.

## Launch decision

- Record the deployed commit, Firebase rules release, database index state, mobile build number, and rollback target.
- Require sign-off for security, moderation, privacy, support, and product acceptance before public release.
