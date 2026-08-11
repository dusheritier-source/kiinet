# Kinet Native App Release Guide

This project is prepared for a Capacitor wrapper so you can ship it to the App Store and Google Play.

## Recommended Architecture

Use the deployed Kinet web app inside a Capacitor shell.

Why this is the best fit here:
- Kinet is already a working Next.js app
- Firebase auth/database and Cloudinary uploads are already web-based
- you can ship mobile apps faster without rewriting everything in React Native

## Production configuration

The Android and iOS shells load the production application from:

- `https://kinett.vercel.app`
- application ID / bundle ID: `com.kinet.app`
- deep-link scheme: `kinet://`

Camera, microphone, photo-library, notification, and internet permissions are
declared in the native projects. Run `npm run cap:sync` after every native
configuration or plugin change.

## Android / Google Play

Use Android Studio's bundled JDK 21 (or another supported JDK 21), then run:

```powershell
npm run cap:sync:android
npm run cap:open:android
```

For a signed Play Store bundle, copy `android/keystore.properties.example` to
`android/keystore.properties`, fill in the release keystore values, and run:

```powershell
npm run android:bundle:release
```

The `.aab` is created at
`android/app/build/outputs/bundle/release/app-release.aab`.

Increase `versionCode` and `versionName` in `android/app/build.gradle` for each
Play Store release. Never commit `keystore.properties` or the keystore.

## iOS / App Store

iOS releases require macOS with Xcode:

```bash
npm run cap:sync
npm run cap:open:ios
```

In Xcode, select the Apple Developer team, verify bundle ID `com.kinet.app`,
increment the build number, archive the app, and upload it through Organizer.

## Deep links

The custom `kinet://` scheme is registered on both platforms. Verified HTTPS
links additionally require files served by the production domain:

- Android: `/.well-known/assetlinks.json`
- iOS: `/.well-known/apple-app-site-association`

Add these only after the Google Play signing certificate SHA-256 and Apple Team
ID are known.

## Store submission checklist

- Apple Developer and Google Play Console accounts
- Android upload keystore and Apple distribution signing
- unique screenshots for required phone/tablet sizes
- privacy-policy and support URLs
- App Privacy and Google Play Data Safety declarations
- content rating and age-rating questionnaires
- real-device tests for login, uploads, voice notes, calls, notifications, and links
- production Firebase authorized domains include `kinett.vercel.app`

## Current architecture

Kinet is a Capacitor native shell around the hosted Next.js application. This
keeps server routes, Firebase, and Supabase working while providing installable
Android and iOS binaries. Store releases therefore require the production site
to remain available over HTTPS.

