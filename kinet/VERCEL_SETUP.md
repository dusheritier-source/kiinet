# Vercel Environment Variables Setup

Copy and paste these variables into Vercel → Settings → Environment Variables

---

## 🔥 Firebase (REQUIRED)

```
NEXT_PUBLIC_FIREBASE_API_KEY = AIzaSyCBuRIXM36SnhoNaPZi1Wl9dWdXzZjN7CE
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = kinet-3a9b6.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID = kinet-3a9b6
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = kinet-3a9b6.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = 919183651612
NEXT_PUBLIC_FIREBASE_APP_ID = 1:919183651612:web:58b55e27330a00abe5c0d9
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID = G-W1SVHLK71K
```

---

## 📸 Cloudinary (REQUIRED)

```
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = your_cloud_name_here
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET = your_upload_preset_here
```

**Note:** Replace with your actual Cloudinary credentials from https://cloudinary.com/console

---

## 🤖 OpenAI AI (REQUIRED for AI features)

```
OPENAI_API_KEY = sk-your-openai-api-key-here
OPENAI_MODEL = gpt-5.2
```

**Note:** Get your API key from https://platform.openai.com/api-keys

---

## 🔔 Optional: Notifications

```
PUSH_DELIVERY_WEBHOOK_URL = https://your-push-webhook-url.com
EMAIL_DIGEST_WEBHOOK_URL = https://your-email-webhook-url.com
```

---

## 🔐 Optional: Admin Access

```
NEXT_PUBLIC_KINET_ADMIN_UIDS = uid1,uid2,uid3
```

**Note:** Replace with actual Firebase User IDs of admins

---

## 📝 Instructions

1. Go to https://vercel.com/your-project/settings/environment-variables
2. For each variable above:
   - Click **Add New**
   - Paste the **Name** (left side)
   - Paste the **Value** (right side)
   - Select environments: Production, Preview, Development
   - Click **Save**
3. Click **Redeploy** to apply changes

---

## ✅ Minimum Required Setup

For the app to work, you MUST add:
- ✅ All 7 Firebase variables
- ✅ 2 Cloudinary variables (get from https://cloudinary.com)
- ✅ OPENAI_API_KEY (get from https://platform.openai.com)

Everything else is optional!