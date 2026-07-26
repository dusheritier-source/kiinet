# Deploy Firestore Security Rules

## The Problem
Your current Firestore rules block ALL access:
```javascript
match /{document=**} {
  allow read, write: if false;
}
```

This is why login and signup don't work!

## Solution: Deploy the New Rules

### Option 1: Firebase Console (Easiest)

1. **Open Firebase Console:**
   ```
   https://console.firebase.google.com/project/kinet-3a9b6/firestore/rules
   ```

2. **Delete existing rules:**
   - Press Ctrl+A (or Cmd+A on Mac) to select all
   - Press Delete to clear the editor

3. **Copy new rules:**
   - Open `kinet/firestore.rules` in your code editor
   - Press Ctrl+A (or Cmd+A) to select all
   - Press Ctrl+C (or Cmd+C) to copy

4. **Paste and publish:**
   - Go back to Firebase Console
   - Press Ctrl+V (or Cmd+V) to paste
   - Click the **"Publish"** button
   - Wait for "Rules published" confirmation

### Option 2: Firebase CLI (Command Line)

If you have Firebase CLI installed:

```bash
# Login to Firebase
firebase login

# Deploy only Firestore rules
cd kinet
firebase deploy --only firestore:rules
```

### Option 3: Install Firebase CLI First

If you don't have Firebase CLI:

```bash
# Install Firebase CLI globally
npm install -g firebase-tools

# Login
firebase login

# Initialize Firebase (if first time)
firebase init firestore

# Deploy rules
cd kinet
firebase deploy --only firestore:rules
```

## Verify It Worked

After deploying, test your app:
1. Go to `/signup` - should be able to create account
2. Go to `/login` - should be able to sign in
3. No more permission errors!

## What the New Rules Do

The new rules in `kinet/firestore.rules`:
- ✅ Allow users to create their own profile
- ✅ Allow users to read/write their own data
- ✅ Allow authenticated users to access app features
- ✅ Maintain security (users can only access their own data)
- ✅ Enable all Firestore operations needed by the app

## Need Help?

If you're stuck:
1. Make sure you're logged into the correct Google account
2. Make sure you're on the `kinet-3a9b6` project
3. The Publish button should be blue/enabled after pasting rules
4. Check browser console for any errors