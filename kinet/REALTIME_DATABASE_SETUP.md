# Firebase Realtime Database Setup Guide

This guide will help you set up Firebase Realtime Database for real-time messaging, likes, and other features in your Kinet app.

## 📋 Prerequisites

- Firebase project created (kinet-3a9b6)
- Firebase CLI installed (`npm install -g firebase-tools`)
- Firebase authenticated (`firebase login`)

## 🚀 Step 1: Enable Realtime Database

1. Go to the [Firebase Console](https://console.firebase.google.com/project/kinet-3a9b6/database)
2. Click on "Realtime Database" in the left sidebar
3. Click "Create Database"
4. Select a location (choose the same as your Firestore database)
5. **Start in test mode** (we'll deploy secure rules in the next step)

## 🔒 Step 2: Deploy Security Rules

The security rules are already defined in `database.rules.json`. Deploy them using:

```bash
firebase deploy --only database
```

Or if you want to deploy all Firebase services:

```bash
firebase deploy
```

### Security Rules Overview

The rules in `database.rules.json` provide:

- **Messages**: Only authenticated users can read/write their own messages
- **Likes**: Users can only toggle their own likes
- **Typing**: Users can only update their own typing status
- **Presence**: Users can only update their own presence status
- **Notifications**: Users can only read their own notifications
- **Comments**: Users can only modify their own comments
- **Reactions**: Users can only toggle their own reactions

## 📦 Step 3: Install Dependencies

The Firebase SDK v10+ is already installed in your project. The Realtime Database module is included in the base `firebase` package.

Verify your `package.json` includes:
```json
{
  "dependencies": {
    "firebase": "^10.14.1"
  }
}
```

## 🔧 Step 4: Configuration Files

The following files have been created/updated:

### 1. `kinet/lib/firebase.ts`
- Added `getDatabase` import from Firebase
- Created `rtdb` export for Realtime Database instance

### 2. `kinet/firebase.json`
- Added database configuration pointing to `database.rules.json`

### 3. `kinet/database.rules.json`
- Complete security rules for all Realtime Database features

### 4. `kinet/lib/realtime-db.ts`
- Complete library with all Realtime Database operations:
  - Messages (send, delete, mark as read, subscribe)
  - Typing indicators
  - User presence (online/offline)
  - Likes (toggle, count, subscribe)
  - Comment reactions
  - Notifications
  - Utility functions

### 5. `kinet/lib/realtime-db-example.tsx`
- Example React components demonstrating usage:
  - `RealtimeMessagesExample` - Real-time messaging
  - `TypingIndicatorExample` - Typing indicators
  - `RealtimeLikesExample` - Real-time likes
  - `UserPresenceExample` - User online/offline status
  - `RealtimeChatExample` - Complete chat component

## 💻 Step 5: Usage Examples

### Real-Time Messages

```tsx
import { subscribeToMessages, sendRTDBMessage } from "@/lib/realtime-db";

function ChatComponent({ conversationId }: { conversationId: string }) {
  const [messages, setMessages] = useState({});

  useEffect(() => {
    const unsubscribe = subscribeToMessages(conversationId, (msgs) => {
      setMessages(msgs);
    });
    return () => unsubscribe?.();
  }, [conversationId]);

  const sendMessage = async (text: string) => {
    await sendRTDBMessage(conversationId, text);
  };

  return (
    <div>
      {Object.entries(messages).map(([id, msg]) => (
        <div key={id}>{msg.text}</div>
      ))}
    </div>
  );
}
```

### Real-Time Likes

```tsx
import { subscribeToPostLikes, togglePostLike } from "@/lib/realtime-db";

function LikeButton({ postId }: { postId: string }) {
  const [likes, setLikes] = useState({});
  const [hasLiked, setHasLiked] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToPostLikes(postId, (likesData) => {
      setLikes(likesData);
      setHasLiked(likesData[auth.currentUser?.uid]?.liked || false);
    });
    return () => unsubscribe?.();
  }, [postId]);

  const toggleLike = async () => {
    await togglePostLike(postId, auth.currentUser.uid, !hasLiked);
  };

  return (
    <button onClick={toggleLike}>
      {hasLiked ? "❤️" : "🤍"} {Object.keys(likes).length}
    </button>
  );
}
```

### Typing Indicators

```tsx
import { subscribeToTypingStatus, setTypingStatus } from "@/lib/realtime-db";

function TypingIndicator({ conversationId }: { conversationId: string }) {
  const [typingUsers, setTypingUsers] = useState({});

  useEffect(() => {
    const unsubscribe = subscribeToTypingStatus(conversationId, setTypingUsers);
    return () => unsubscribe?.();
  }, [conversationId]);

  return (
    <div>
      {Object.values(typingUsers).some(t => t.isTyping) && (
        <p>Someone is typing...</p>
      )}
    </div>
  );
}
```

### User Presence

```tsx
import { setupPresenceListener, setUserOnline } from "@/lib/realtime-db";

function UserStatus({ userId }: { userId: string }) {
  const [presence, setPresence] = useState(null);

  useEffect(() => {
    setUserOnline();
    const unsubscribe = setupPresenceListener(userId, setPresence);
    return () => unsubscribe?.();
  }, [userId]);

  return (
    <div>
      <span className={`dot ${presence?.status === 'online' ? 'green' : 'gray'}`} />
      {presence?.status === 'online' ? 'Online' : 'Offline'}
    </div>
  );
}
```

## 🗄️ Database Structure

```
realtime-database/
├── messages/
│   └── {conversationId}/
│       └── {messageId}/
│           ├── conversationId: string
│           ├── senderId: string
│           ├── text: string
│           ├── attachmentUrl: string | null
│           ├── attachmentType: string | null
│           ├── deleted: boolean
│           ├── readBy: string[]
│           └── createdAt: number
│
├── likes/
│   └── {postId}/
│       └── {userId}/
│           ├── liked: boolean
│           └── timestamp: number
│
├── typing/
│   └── {conversationId}/
│       └── {userId}/
│           ├── isTyping: boolean
│           └── timestamp: number
│
├── presence/
│   └── {userId}/
│       ├── status: "online" | "offline"
│       └── lastSeen: number
│
├── notifications/
│   └── {userId}/
│       └── {notificationId}/
│           ├── type: string
│           ├── message: string
│           ├── actorId: string
│           ├── read: boolean
│           └── createdAt: number
│
├── comments/
│   └── {commentId}/
│       └── {emoji}/
│           └── {userId}/
│               ├── emoji: string
│               ├── userId: string
│               └── timestamp: number
│
└── reactions/
    └── {commentId}/
        └── {emoji}/
            └── {userId}: boolean
```

## 🔄 Real-Time Synchronization

All data is synchronized in real-time using Firebase's `onValue` listeners. When data changes in the database, all connected clients receive updates immediately.

### Key Features:

1. **Messages**: Instant message delivery and updates
2. **Likes**: Real-time like counts and status
3. **Typing**: Live typing indicators with auto-clear
4. **Presence**: Online/offline status with last seen
5. **Notifications**: Instant notification delivery

## 🧪 Testing

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Import and use example components in your pages:
   ```tsx
   import { RealtimeChatExample } from "@/lib/realtime-db-example";
   
   export default function ChatPage() {
     return <RealtimeChatExample conversationId="test-conversation" />;
   }
   ```

3. Open the app in multiple browser windows to test real-time sync

## 📊 Monitoring

Monitor your Realtime Database usage in the Firebase Console:
- **Usage tab**: See read/write operations
- **Data tab**: Browse and edit data
- **Rules tab**: Test and deploy security rules

## ⚠️ Important Notes

1. **Firebase Plan**: Realtime Database has usage limits on the free tier. Monitor your usage in the Firebase Console.

2. **Offline Support**: Firebase Realtime Database has built-in offline support. Data is cached locally and synced when connection is restored.

3. **Security**: Always deploy security rules before going to production. Never leave the database in test mode.

4. **Performance**: 
   - Keep data structures flat for better performance
   - Use indexes for complex queries
   - Limit data size per node (256MB max per node)

5. **Cleanup**: Always unsubscribe from listeners when components unmount to prevent memory leaks.

## 🚢 Deployment

When deploying to production:

1. Deploy security rules:
   ```bash
   firebase deploy --only database
   ```

2. Deploy your Next.js app:
   ```bash
   npm run build
   npm start
   ```

3. Monitor usage and adjust limits as needed

## 📚 Additional Resources

- [Firebase Realtime Database Documentation](https://firebase.google.com/docs/database)
- [Security Rules Documentation](https://firebase.google.com/docs/database/security)
- [Firebase SDK Reference](https://firebase.google.com/docs/reference/js/database)

## 🐛 Troubleshooting

### Permission Denied Errors
- Check that security rules are deployed
- Verify user is authenticated
- Check rule conditions match your data structure

### Real-Time Updates Not Working
- Ensure listeners are properly subscribed
- Check browser console for errors
- Verify network connectivity

### TypeScript Errors
- Make sure all imports are correct
- Check that `rtdb` is properly exported from `firebase.ts`
- Verify TypeScript types match Firebase SDK v10+

## ✨ Features Implemented

✅ Real-time messaging with instant sync
✅ Typing indicators with auto-clear
✅ User presence (online/offline)
✅ Real-time likes with counts
✅ Comment reactions
✅ Notifications
✅ Complete TypeScript support
✅ Security rules
✅ Example components
✅ Offline support (built-in)

## 📝 Next Steps

1. Enable Realtime Database in Firebase Console
2. Deploy security rules: `firebase deploy --only database`
3. Test with example components
4. Integrate into your existing messaging system
5. Monitor usage and optimize as needed