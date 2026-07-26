import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { auth, db, isTransientFirestoreError } from "@/lib/firebase";

export interface UserSettings {
  availabilityStatus: "available" | "locked_in" | "recovering";
  headline: string;
  emailDigestFrequency: "off" | "daily" | "weekly";
  pushNotificationsEnabled: boolean;
  pushPermission: "default" | "granted" | "denied";
  notificationPreferences: {
    likes: boolean;
    comments: boolean;
    follows: boolean;
    messages: boolean;
    reposts: boolean;
    reports: boolean;
  };
  followedTopics: string[];
  pinnedPosts: string[];
}

const defaultSettings: UserSettings = {
  availabilityStatus: "available",
  headline: "",
  emailDigestFrequency: "off",
  pushNotificationsEnabled: false,
  pushPermission: "default",
  notificationPreferences: {
    likes: true,
    comments: true,
    follows: true,
    messages: true,
    reposts: true,
    reports: true,
  },
  followedTopics: [],
  pinnedPosts: [],
};

export async function getCurrentUserSettings(): Promise<UserSettings> {
  if (!auth?.currentUser || !db) {
    return defaultSettings;
  }

  try {
    const snapshot = await getDoc(doc(db, "users", auth.currentUser.uid));
    const data = snapshot.exists() ? (snapshot.data() as Record<string, unknown>) : {};
    const settings = (data.settings as Record<string, unknown> | undefined) ?? {};
    const notificationPreferences =
      (settings.notificationPreferences as Record<string, unknown> | undefined) ?? {};

    return {
      availabilityStatus:
        settings.availabilityStatus === "locked_in" || settings.availabilityStatus === "recovering"
          ? settings.availabilityStatus
          : "available",
      headline: String(settings.headline ?? ""),
      emailDigestFrequency:
        settings.emailDigestFrequency === "daily" || settings.emailDigestFrequency === "weekly"
          ? settings.emailDigestFrequency
          : "off",
      pushNotificationsEnabled: settings.pushNotificationsEnabled === true,
      pushPermission:
        settings.pushPermission === "granted" || settings.pushPermission === "denied"
          ? settings.pushPermission
          : "default",
      notificationPreferences: {
        likes: notificationPreferences.likes !== false,
        comments: notificationPreferences.comments !== false,
        follows: notificationPreferences.follows !== false,
        messages: notificationPreferences.messages !== false,
        reposts: notificationPreferences.reposts !== false,
        reports: notificationPreferences.reports !== false,
      },
      followedTopics: Array.isArray(data.followedTopics) ? (data.followedTopics as string[]) : [],
      pinnedPosts: Array.isArray(data.pinnedPosts) ? (data.pinnedPosts as string[]) : [],
    };
  } catch (error) {
    if (isTransientFirestoreError(error)) {
      return defaultSettings;
    }
    throw error;
  }
}

export async function updateCurrentUserSettings(input: Partial<UserSettings>) {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in.");
  }

  await setDoc(
    doc(db, "users", auth.currentUser.uid),
    {
      settings: {
        ...(input.availabilityStatus ? { availabilityStatus: input.availabilityStatus } : {}),
        ...(typeof input.headline === "string" ? { headline: input.headline.trim() } : {}),
        ...(input.emailDigestFrequency
          ? { emailDigestFrequency: input.emailDigestFrequency }
          : {}),
        ...(typeof input.pushNotificationsEnabled === "boolean"
          ? { pushNotificationsEnabled: input.pushNotificationsEnabled }
          : {}),
        ...(input.pushPermission ? { pushPermission: input.pushPermission } : {}),
        ...(input.notificationPreferences
          ? { notificationPreferences: input.notificationPreferences }
          : {}),
      },
      ...(input.followedTopics ? { followedTopics: input.followedTopics } : {}),
      ...(input.pinnedPosts ? { pinnedPosts: input.pinnedPosts } : {}),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function syncPushNotificationPreference(enabled: boolean) {
  const permission =
    typeof Notification === "undefined" ? "default" : Notification.permission;

  await updateCurrentUserSettings({
    pushNotificationsEnabled: enabled && permission === "granted",
    pushPermission:
      permission === "granted" || permission === "denied" ? permission : "default",
  });
}

export async function requestPushNotificationPermission() {
  if (typeof Notification === "undefined") {
    throw new Error("This browser does not support push-style notifications.");
  }

  const permission = await Notification.requestPermission();
  await updateCurrentUserSettings({
    pushNotificationsEnabled: permission === "granted",
    pushPermission:
      permission === "granted" || permission === "denied" ? permission : "default",
  });

  return permission;
}

export async function setPresence(isOnline: boolean) {
  if (!auth?.currentUser || !db) {
    return;
  }

  try {
    await setDoc(
      doc(db, "users", auth.currentUser.uid),
      {
        presence: {
          isOnline,
          lastSeenAt: serverTimestamp(),
        },
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    if (!isTransientFirestoreError(error)) {
      throw error;
    }
  }
}

export async function toggleTopicFollow(topic: string, isFollowing: boolean) {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in.");
  }

  await setDoc(
    doc(db, "users", auth.currentUser.uid),
    {
      followedTopics: isFollowing
        ? arrayRemove(topic.toLowerCase())
        : arrayUnion(topic.toLowerCase()),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function togglePinnedPost(postId: string, isPinned: boolean) {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in.");
  }

  await setDoc(
    doc(db, "users", auth.currentUser.uid),
    {
      pinnedPosts: isPinned ? arrayRemove(postId) : arrayUnion(postId),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function getTrendingTopics() {
  if (!db) {
    return [];
  }

  const snapshot = await getDocs(query(collection(db, "posts"), limit(100)));
  const counts = new Map<string, number>();

  snapshot.docs.forEach((docSnapshot: { data: () => Record<string, unknown> }) => {
    const data = docSnapshot.data() as Record<string, unknown>;
    const hashtags = Array.isArray(data.hashtags) ? (data.hashtags as string[]) : [];
    hashtags.forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1));
  });

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 20)
    .map(([tag, count]) => ({ tag, count }));
}
