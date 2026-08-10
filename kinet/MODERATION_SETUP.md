# Sensitive-content moderation

Server uploads use OpenAI `omni-moderation-latest` before media is stored. Images are sent as data URLs. Video frame sampling via `ffmpeg-static` is skipped on Vercel Lambda (the binary does not resolve in the serverless runtime); images and text are still moderated. Captions, comments, message text, and story text are checked through `/api/moderate` before their Firestore write.

## Server environment

Set these only on the server deployment, never as `NEXT_PUBLIC_*` values:

```env
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_STORAGE_BUCKET=kinet-media
```

The existing Firebase client environment is still required for authentication. The server upload route verifies the Firebase bearer token before accepting a file.

## Moderation events

Run `supabase/moderation_events.sql` in Supabase. Only the service-role server client can insert event metadata. Blocked media bytes are never inserted into this table and are not retained by the upload route.

## Behavior

- Posts, reels, stories, avatars, covers, comments with media, DMs, and group-chat attachments use the server upload route.
- Images and videos are rejected before storage if moderation flags them.
- Text is rejected before the post/story/comment/message record is created.
- A blocked request returns `This media violates Kinet Community Guidelines and cannot be shared.`
- No automatic account ban is performed. The event table records status, user, purpose, and media kind for later review.

Deploy the updated `storage.rules` and Supabase configuration together. Existing Firebase media remains readable; new Kinet media can no longer be written directly from a client.
