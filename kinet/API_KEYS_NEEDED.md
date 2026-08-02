# API Keys and Configuration Needed

## Firebase Configuration

Your Firebase project is configured with the following credentials in `.env.local`:

### Client-side (NEXT_PUBLIC_*)
- `NEXT_PUBLIC_FIREBASE_API_KEY` - Firebase API key
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` - Firebase auth domain
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID` - Firebase project ID
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` - Firebase storage bucket
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` - Firebase messaging sender ID
- `NEXT_PUBLIC_FIREBASE_APP_ID` - Firebase app ID
- `NEXT_PUBLIC_FIREBASE_DATABASE_URL` - Firebase Realtime Database URL
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` - Firebase analytics measurement ID

### Server-side (for Firebase Admin SDK)
To enable server-side Firebase Admin authentication, add these to your `.env.local`:

**Option 1: Service Account Key (Recommended)**
```env
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"kinet-3a9b6",...}
```

**Option 2: Individual Credentials**
```env
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@kinet-3a9b6.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_PROJECT_ID=kinet-3a9b6
```

## Google OAuth Configuration

### In Google Cloud Console:
1. Go to https://console.cloud.google.com/apis/credentials
2. Create OAuth 2.0 Client ID
3. Add authorized domains:
   - `localhost:3000` (for development)
   - Your production domain
4. Add authorized redirect URIs:
   - `http://localhost:3000/login`
   - `https://your-domain.vercel.app/login`

### In Firebase Console:
1. Go to https://console.firebase.google.com
2. Select project: `kinet-3a9b6`
3. Go to Authentication → Sign-in method
4. Enable **Google** provider
5. Add your email as a test user (if in testing mode)
6. Configure OAuth consent screen in Google Cloud Console

## Important Notes

- **Google Auth is handled by Firebase Auth**, not NextAuth
- The app uses Firebase Client SDK directly for authentication
- No NextAuth configuration is needed
- Make sure Google sign-in is enabled in Firebase Console

## Current Status

✅ Firebase client credentials configured in `.env.local`
✅ Firebase Auth being used directly (not NextAuth)
⚠️  Google OAuth needs to be enabled in Firebase Console
⚠️  Firebase Admin SDK credentials may need to be added for server-side operations