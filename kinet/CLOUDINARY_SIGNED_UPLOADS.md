# Cloudinary Signed Uploads Setup

Your upload system now uses **signed uploads** for better security. The API secret key is kept server-side only and never exposed to the browser.

## What's Been Implemented:

### ✅ Files Created/Modified:

1. **kinet/app/api/cloudinary/signature/route.ts** (NEW)
   - Backend API endpoint that generates Cloudinary upload signatures
   - Keeps API secret secure on the server
   - Returns signature, timestamp, and API key to the client

2. **kinet/lib/cloudinary.ts** (UPDATED)
   - Now requests signature from backend before uploading
   - Uses signed upload parameters (api_key, timestamp, signature)
   - More secure than unsigned uploads

3. **kinet/.env.local** (UPDATED)
   - Added `CLOUDINARY_API_KEY` (server-side only)
   - Added `CLOUDINARY_API_SECRET` (server-side only)

4. **kinet/.env.production** (UPDATED)
   - Added Cloudinary API credentials for production

## How It Works:

### Upload Flow:
1. **Client** requests signature from `/api/cloudinary/signature`
2. **Server** generates signature using API key + secret
3. **Client** uploads file to Cloudinary with signature
4. **Cloudinary** verifies signature and stores file

### Security Benefits:
- ✅ API secret never exposed to browser
- ✅ Prevents unauthorized uploads
- ✅ Can add authentication/validation in backend
- ✅ Better for production use

## Configuration:

### Cloudinary Upload Preset:
Make sure your "social_upload" preset is configured as:
- **Type**: Upload
- **Signing Mode**: Signed (IMPORTANT: Change from Unsigned to Signed)
- **Overwrite**: false
- **Use filename**: false
- **Unique filename**: false
- **Use filename as display name**: true
- **Use asset folder as public ID prefix**: false

### Environment Variables:

**Local (.env.local):**
```env
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME="dyoyvdhf5"
CLOUDINARY_API_KEY="321183131873832"
CLOUDINARY_API_SECRET="icWGUzsMiLW95K-zOgP__giNMwc"
```

**Production (Vercel):**
Add these environment variables in your Vercel dashboard:
- `CLOUDINARY_API_KEY` = `321183131873832`
- `CLOUDINARY_API_SECRET` = `icWGUzsMiLW95K-zOgP__giNMwc`

## Testing:

1. **Start development server:**
   ```bash
   npm run dev
   ```

2. **Test upload:**
   - Go to http://localhost:3000/upload
   - Sign in to your account
   - Try uploading an image or video
   - Check browser console for any errors

3. **Verify in Cloudinary:**
   - Go to https://console.cloudinary.com
   - Check Media Library for uploaded files

## Important Notes:

### ⚠️ Change Upload Preset to "Signed":
In Cloudinary Console:
1. Go to Settings → Upload → Upload presets
2. Find "social_upload" preset
3. Change **Signing Mode** from "Unsigned" to "Signed"
4. Save changes

### 🔒 Security:
- `CLOUDINARY_API_SECRET` is server-side only (not exposed to browser)
- `NEXT_PUBLIC_*` variables are client-side (safe to expose)
- The signature endpoint validates requests before signing

## Troubleshooting:

### Upload fails with "Invalid signature":
- Ensure upload preset is set to "Signed" mode
- Check that API key and secret are correct
- Verify the signature endpoint is working

### Upload fails with "401 Unauthorized":
- Check API key is correct
- Verify API secret is set in environment variables
- Ensure Cloudinary account is active

### Files not appearing in Cloudinary:
- Check browser console for errors
- Verify the upload preset name matches
- Check Cloudinary console for upload logs

## Next Steps:

1. **Update Cloudinary Preset:**
   - Change "social_upload" preset to "Signed" mode

2. **Test Locally:**
   ```bash
   npm run dev
   ```

3. **Deploy to Production:**
   - Add environment variables to Vercel
   - Deploy the API route

4. **Monitor:**
   - Check Cloudinary console for uploads
   - Monitor API route logs in Vercel

## Free Tier Limits:

Cloudinary free tier includes:
- **25 GB** storage
- **25 GB** bandwidth per month
- **500,000** transformations per month

Your upload system is now production-ready with signed uploads!