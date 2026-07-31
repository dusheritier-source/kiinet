"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import {
  subscribeToMessages,
  sendRTDBMessage,
  subscribeToTypingStatus,
  setTypingStatus,
  subscribeToPostLikes,
  togglePostLike,
  setupPresenceListener,
  setUserOnline,
  RTDBMessage,
  TypingStatus,
  LikeStatus,
  UserPresence,
} from "@/lib/realtime-db";

const getCurrentUser = () => auth?.currentUser;

// ==================== EXAMPLE 1: REAL-TIME MESSAGES ====================

export function RealtimeMessagesExample({ conversationId }: { conversationId: string }) {
  const [messages, setMessages] = useState<Record<string, RTDBMessage>>({});
  const [newMessage, setNewMessage] = useState("");

  useEffect(() => {
    const unsubscribe = subscribeToMessages(conversationId, (msgs) => {
      setMessages(msgs);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [conversationId]);

  const currentUser = getCurrentUser();

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !currentUser) return;
    await sendRTDBMessage(conversationId, newMessage);
    setNewMessage("");
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <h2 className="text-xl font-bold">Real-Time Messages</h2>
      
      {/* Messages List */}
      <div className="h-96 overflow-y-auto border rounded-lg p-4">
        {Object.entries(messages).map(([messageId, message]) => (
          <div
            key={messageId}
            className={`mb-2 p-2 rounded ${
              message.senderId === currentUser?.uid
                ? "bg-blue-100 ml-auto"
                : "bg-gray-100"
            }`}
          >
            <p>{message.text}</p>
            <span className="text-xs text-gray-500">
              {new Date(message.createdAt || 0).toLocaleTimeString()}
            </span>
          </div>
        ))}
      </div>

      {/* Message Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
          placeholder="Type a message..."
          className="flex-1 p-2 border rounded"
        />
        <button
          onClick={handleSendMessage}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Send
        </button>
      </div>
    </div>
  );
}

// ==================== EXAMPLE 2: TYPING INDICATORS ====================

export function TypingIndicatorExample({ conversationId }: { conversationId: string }) {
  const [typingUsers, setTypingUsers] = useState<Record<string, TypingStatus>>({});
  const [message, setMessage] = useState("");

  useEffect(() => {
    const unsubscribe = subscribeToTypingStatus(conversationId, (typing) => {
      setTypingUsers(typing);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [conversationId]);

  const handleTyping = async () => {
    await setTypingStatus(conversationId, message.length > 0);
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Typing Indicators</h2>
      
      {/* Typing Status */}
      {Object.entries(typingUsers).some(([_, status]) => status.isTyping) && (
        <p className="text-gray-500 italic mb-2">Someone is typing...</p>
      )}

      <input
        type="text"
        value={message}
        onChange={(e) => {
          setMessage(e.target.value);
          handleTyping();
        }}
        placeholder="Type to see typing indicator..."
        className="w-full p-2 border rounded"
      />
    </div>
  );
}

// ==================== EXAMPLE 3: REAL-TIME LIKES ====================

export function RealtimeLikesExample({ postId }: { postId: string }) {
  const [likes, setLikes] = useState<Record<string, LikeStatus>>({});
  const [hasLiked, setHasLiked] = useState(false);
  const currentUser = getCurrentUser();

  useEffect(() => {
    const unsubscribe = subscribeToPostLikes(postId, (likesData) => {
      setLikes(likesData);
      if (currentUser) {
        setHasLiked(likesData[currentUser.uid]?.liked || false);
      }
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [postId]);

  const handleToggleLike = async () => {
    if (!currentUser) return;
    await togglePostLike(postId, currentUser.uid, !hasLiked);
    setHasLiked(!hasLiked);
  };

  const likesCount = Object.keys(likes).length;

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Real-Time Likes</h2>
      
      <div className="flex items-center gap-4">
        <button
          onClick={handleToggleLike}
          className={`px-6 py-2 rounded-lg ${
            hasLiked
              ? "bg-red-500 text-white"
              : "bg-gray-200 text-gray-700"
          }`}
        >
          {hasLiked ? "❤️ Liked" : "🤍 Like"}
        </button>
        
        <span className="text-lg font-semibold">
          {likesCount} {likesCount === 1 ? "like" : "likes"}
        </span>
      </div>

      {/* Show who liked */}
      <div className="mt-4">
        <p className="text-sm text-gray-600">
          Liked by: {Object.keys(likes).slice(0, 5).join(", ")}
          {likesCount > 5 && ` and ${likesCount - 5} more`}
        </p>
      </div>
    </div>
  );
}

// ==================== EXAMPLE 4: USER PRESENCE ====================

export function UserPresenceExample({ userId }: { userId: string }) {
  const [presence, setPresence] = useState<UserPresence | null>(null);

  useEffect(() => {
    // Set current user online
    setUserOnline();

    // Listen to presence changes
    const unsubscribe = setupPresenceListener(userId, (userPresence) => {
      setPresence(userPresence);
    });

    // Cleanup on unmount
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [userId]);

  const isOnline = presence?.status === "online";
  const lastSeen = presence?.lastSeen
    ? new Date(presence.lastSeen).toLocaleString()
    : "Unknown";

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">User Presence</h2>
      
      <div className="flex items-center gap-2">
        <div
          className={`w-3 h-3 rounded-full ${
            isOnline ? "bg-green-500" : "bg-gray-400"
          }`}
        />
        <span className="font-medium">
          {isOnline ? "Online" : "Offline"}
        </span>
      </div>

      <p className="text-sm text-gray-600 mt-2">
        Last seen: {lastSeen}
      </p>
    </div>
  );
}

// ==================== EXAMPLE 5: COMBINED CHAT COMPONENT ====================

export function RealtimeChatExample({ conversationId }: { conversationId: string }) {
  const [messages, setMessages] = useState<Record<string, RTDBMessage>>({});
  const [typingUsers, setTypingUsers] = useState<Record<string, TypingStatus>>({});
  const [newMessage, setNewMessage] = useState("");
  const currentUser = getCurrentUser();

  useEffect(() => {
    // Subscribe to messages
    const unsubscribeMessages = subscribeToMessages(conversationId, (msgs) => {
      setMessages(msgs);
    });

    // Subscribe to typing status
    const unsubscribeTyping = subscribeToTypingStatus(conversationId, (typing) => {
      setTypingUsers(typing);
    });

    // Set user online
    setUserOnline();

    return () => {
      if (unsubscribeMessages) unsubscribeMessages();
      if (unsubscribeTyping) unsubscribeTyping();
    };
  }, [conversationId]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !currentUser) return;
    await sendRTDBMessage(conversationId, newMessage);
    setNewMessage("");
  };

  const handleTyping = async () => {
    await setTypingStatus(conversationId, newMessage.length > 0);
  };

  const isSomeoneTyping = Object.values(typingUsers).some((status) => status.isTyping);

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Real-Time Chat</h2>

      {/* Messages */}
      <div className="h-96 overflow-y-auto border rounded-lg p-4 mb-4">
        {Object.entries(messages).map(([messageId, message]) => (
          <div
            key={messageId}
            className={`mb-3 ${
              message.senderId === currentUser?.uid ? "text-right" : "text-left"
            }`}
          >
            <div
              className={`inline-block p-3 rounded-lg ${
                message.senderId === currentUser?.uid
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-gray-900"
              }`}
            >
              <p>{message.text}</p>
              {message.attachmentUrl && (
                <img
                  src={message.attachmentUrl}
                  alt="Attachment"
                  className="mt-2 max-w-xs rounded"
                />
              )}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {new Date(message.createdAt || 0).toLocaleTimeString()}
              {message.readBy.length > 1 && " ✓✓"}
            </div>
          </div>
        ))}
      </div>

      {/* Typing Indicator */}
      {isSomeoneTyping && (
        <p className="text-sm text-gray-500 italic mb-2">Someone is typing...</p>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => {
            setNewMessage(e.target.value);
            handleTyping();
          }}
          onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
          placeholder="Type a message..."
          className="flex-1 p-3 border rounded-lg"
        />
        <button
          onClick={handleSendMessage}
          className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          Send
        </button>
      </div>
    </div>
  );
}

// ==================== USAGE INSTRUCTIONS ====================

/**
 * HOW TO USE THESE EXAMPLES:
 * 
 * 1. REAL-TIME MESSAGES:
 *    <RealtimeMessagesExample conversationId="conversation_123" />
 * 
 * 2. TYPING INDICATORS:
 *    <TypingIndicatorExample conversationId="conversation_123" />
 * 
 * 3. REAL-TIME LIKES:
 *    <RealtimeLikesExample postId="post_123" />
 * 
 * 4. USER PRESENCE:
 *    <UserPresenceExample userId="user_123" />
 * 
 * 5. FULL CHAT:
 *    <RealtimeChatExample conversationId="conversation_123" />
 * 
 * NOTE: Make sure to:
 * - Enable Firebase Realtime Database in your Firebase Console
 * - Deploy the database.rules.json file
 * - Import and use these components in your pages
 */