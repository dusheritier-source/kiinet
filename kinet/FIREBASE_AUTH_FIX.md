# Firebase Auth Not Working - Diagnosis and Fix

## Current Authentication Setup

Your app uses **Firebase Auth directly** (NOT NextAuth):
- Email/Password authentication ✅
- Google OAuth via Firebase Auth ⚠️ (needs configuration)
- Magic Link authentication ✅

## Why Firebase Auth is Failing

### Most Common Issue: Google Provider Not Enabled

**Google sign-in will fail with error `auth/operation-not-allowed` if:**
1. Google provider is not enabled in Firebase Console
2. OAuth consent screen is not configured
3. Project is in testing mode without your email added

## Step-by-Step Fix

### 1. Enable Google Sign-In in Firebase Console

1. Go to https://console.firebase.google.com
2. Select project: **kinet-3a9b6**
3. Click **Authentication** in the left sidebar
4. Click **Sign-in method** tab
5. Click **Google** in the providers list
6. Toggle **Enable** to ON
7. Configure:
   - **Project support email**: Your email address
   - **OAuth consent screen**: Will redirect you to Google Cloud Console
8. Click **Save**

### 2. Configure OAuth Consent Screen (Google Cloud Console)

If prompted, configure the OAuth consent screen:

1. Go to https://console.cloud.google.com/apis/credentials
2. Select your project (kinet-3a9b6)
3. Click **OAuth consent screen**
4. Choose **External** (unless you have Google Workspace)
5. Fill in:
   - **App name**: Kinet
   - **User support email**: Your email
   - **Developer contact information**: Your email
6. Click **Save and Continue**
7. **Scopes**: Click **Add or Remove Scopes**, add:
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
   - `openid`
8. Click **Save and Continue**
9. **Test users**: Add your email address (while in testing mode)
10. Click **Save and Continue**
11. Click **Back to Dashboard**

### 3. Verify Firebase Configuration

Check that your `.env.local` has these values:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyCBuRIXM36SnhoNaPZi1Wl9dWdXzZjN7CE
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=kinet-3a9b6.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=kinet-3a9b6
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=kinet-3a9b6.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=919183651612
NEXT_PUBLIC_FIREBASE_APP_ID=1:919183651612:web:58b55e27330a00abe5c0d9
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://kinet-3a9b6-default-rtdb.firebaseio.com
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-W1SVHLK71K
```

✅ These are already configured in your `.env.local`

### 4. Check Browser Console for Errors

Open your browser's Developer Console (F12) and look for Firebase Auth errors:

**Common errors and solutions:**

| Error Code | Meaning | Solution |
|------------|---------|----------|
| `auth/operation-not-allowed` | Google provider not enabled | Enable in Firebase Console (Step 1) |
| `auth/unauthorized-domain` | Domain not authorized | Add domain to Firebase Console |
| `auth/popup-blocked` | Browser blocked popup | Allow popups or use redirect |
| `auth/account-exists-with-different-credential` | Email already registered | Sign in with original method |
| `auth/invalid-credential` | Wrong email/password | Check credentials |

### 5. Test Authentication

1. **Email/Password Test:**
   - Go to http://localhost:3000/signup
   - Create account with email/password
   - Should redirect to /onboarding

2. **Google Sign-In Test:**
   - Go to http://localhost:3000/login
   - Click "Google" button
   - Should open Google sign-in popup
   - After signing in, should redirect to /feed or /onboarding

## Additional Issues to Check

### Issue: Firebase Not Initialized

Check `lib/firebase.ts` line 33-35:
```typescript
export const isFirebaseConfigured = requiredFirebaseConfigValues.every(
  (value) => value.trim().length > 0 && !value.startsWith("your-")
);
```

This checks if Firebase is configured. Your config looks good.

### Issue: Auth Listener Not Starting

Check `hooks/useAuth.ts`:
- The `onAuthStateChanged` listener should fire when user signs in
- If it's not firing, check browser console for errors

### Issue: User Not Persisting

Firebase Auth uses `browserLocalPersistence` (set in `lib/firebase.ts` line 52-56).
If sessions aren't persisting:
- Check if browser allows localStorage
- Check if incognito/private mode is being used
- Check if browser extensions are blocking storage

## Quick Diagnostic Commands

Run these in your browser console on http://localhost:3000:

```javascript
// Check if Firebase is configured
console.log('Firebase configured:', typeof auth !== 'undefined');

// Check if user is signed in
import { onAuthStateChanged } from 'firebase/auth';
onAuthStateChanged(auth, (user) => {
  console.log('Current user:', user);
});
```

## Still Not Working?

1. **Clear browser data:**
   - Open DevTools (F12)
   - Application tab → Clear storage → Clear site data
   - Refresh page

2. **Check Firebase Console:**
   - Go to Authentication → Users
   - See if users are being created
   - Check if there are any error logs

3. **Verify network requests:**
   - Open DevTools Network tab
   - Try to sign in
   - Look for failed requests to `identitytoolkit.googleapis.com`

4. **Check Firebase project status:**
   - Go to https://status.firebase.google.com
   - Ensure all services are operational

## Summary

The most likely issue is that **Google sign-in is not enabled in Firebase Console**. 

**Action Required:**
1. Enable Google provider in Firebase Console → Authentication → Sign-in method
2. Configure OAuth consent screen in Google Cloud Console
3. Add your email as a test user
4. Test again

Email/Password and Magic Link should work without additional configuration.