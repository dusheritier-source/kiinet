Supabase Storage Integration

1) Environment variables (add to .env.local):

NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-public-key>
# For server-side administrative operations (keep secret)
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

2) Usage (client-side upload example):

import { uploadFile, getPublicUrl } from '@/lib/supabase-storage';

// Upload a File object
const { error, publicUrl } = await uploadFile('kinet-media', 'uploads/myvideo.mp4', file, { cacheControl: '86400' });
if (!error) {
  console.log('Public URL:', publicUrl);
}

3) Public URL format:

https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>

4) Notes:
- Use the anon key in browser; never expose the service role key client-side.
- Set proper `cacheControl` for media (images/videos) to leverage CDN caching.
  - The helper defaults to long cache for images (`max-age=31536000, immutable`) and one-day cache for videos; you can override via `uploadFile` options.
- If you need signed URLs for private content, use server-side client with `SUPABASE_SERVICE_ROLE_KEY`.

5) Next.js optimized image example

If you use `next/image`, add the Supabase host to `next.config.js` (see file) and use the `OptimizedImage` wrapper:

```tsx
import OptimizedImage from '@/components/OptimizedImage';

// Show an image stored at `avatars/123.jpg` in `kinet-media`
<OptimizedImage srcPath={'avatars/123.jpg'} width={400} height={400} />
```

This uses Supabase public URLs and lets Next.js serve optimized formats.
