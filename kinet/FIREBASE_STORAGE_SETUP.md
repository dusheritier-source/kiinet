# Firebase Storage Setup Guide

Your upload functionality has been migrated from Cloudinary to Firebase Storage. Follow these steps to activate it:

## Step 1: Deploy Storage Rules

Run this command in your terminal from the `kinet` folder:

```bash
firebase deploy --only storage
```

Or if you're using the Firebase CLI from the root:
```bash
cd kinet && firebase deploy --only storage
```

## Step 2: Enable Firebase Storage (First Time Only)

If you haven't enabled Firebase Storage yet:

1. Go to https://console.firebase.google.com
2. Select your project: **kinet-3a9b6**
3. Click **Storage** in the left sidebar
4. Click **Get Started**
5. Select **Start in production mode** (we already have security rules configured)
6. Click **Done**

## Step 3: Test the Upload

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Go to http://localhost:3000/upload
3. Sign in to your account
4. Try uploading an image or video
5. Check the browser console for upload progress logs

## What Was Changed

### Files Modified:
- **kinet/lib/cloudinary.ts** - Now uses Firebase Storage instead of Cloudinary
- **kinet/firebase.json** - Added storage rules configuration

### Files Created:
- **kinet/storage.rules** - Security rules for Firebase Storage

## Security Rules

The storage rules allow:
- **Public read access** - Anyone can view uploaded media
- **Authenticated write** - Only logged-in users can upload
- **File size limit** - Maximum 50MB per file
- **File types** - Images and videos only

## Free Tier Limits

Firebase Storage free tier includes:
- **5 GB** of storage
- **1 GB** download per day
- **100,000** operations per month

## Troubleshooting

### Upload fails with permission error:
- Make sure you've deployed the storage rules: `firebase deploy --only storage`
- Verify you're signed in to the app
- Check that Firebase Storage is enabled in the Firebase Console

### Upload fails with "not configured" error:
- Verify `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` is set in `.env.local`
- Check that the Firebase SDK is properly initialized

### Files not showing up:
- Check the browser console for errors
- Verify the download URL is being saved to Firestore
- Check Firebase Console > Storage to see if files were uploaded

## Monitoring Usage

View your storage usage at:
https://console.firebase.google.com/project/kinet-3a9b6/storage

## Need Help?

If you encounter issues:
1. Check the browser console for error messages
2. Check the Firebase Console for storage activity
3. Verify all environment variables are set correctly