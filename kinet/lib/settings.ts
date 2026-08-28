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
  privateAccount: boolean;
  availabilityStatus: "available" | "locked_in" | "recovering";
  headline: string;
  emailDigestFrequency: "off" | "daily" | "weekly";
  pushNotificationsEnabled: boolean;
  pushPermission: "default" | "granted" | "denied";
  notificationAudience: "everyone" | "following" | "no_one";
  notificationChannels: { inApp: boolean; push: boolean; email: boolean };
  quietHours: { enabled: boolean; start: string; end: string };
  notificationPreview: "full" | "sender_only" | "hidden";
  notificationSound: boolean;
  notificationVibration: boolean;
  notificationPreferences: {
    likes: boolean;
    comments: boolean;
    replies: boolean;
    mentions: boolean;
    tags: boolean;
    follows: boolean;
    followRequests: boolean;
    messages: boolean;
    groupMessages: boolean;
    storyActivity: boolean;
    live: boolean;
    creatorUpdates: boolean;
    reposts: boolean;
    reports: boolean;
    recommendations: boolean;
  };
  followedTopics: string[];
  pinnedPosts: string[];
  messagePrivacy: "everyone" | "following" | "no_one";
  showActivityStatus: boolean;
  showFollowerCounts: boolean;
  allowProfileSharing: boolean;
  shareProfileViews: boolean;
  mentionPrivacy: "everyone" | "following" | "no_one";
  storyReplyAudience: "everyone" | "following" | "no_one";
}

const defaultSettings: UserSettings = {
  privateAccount: false,
  availabilityStatus: "available",
  headline: "",
  emailDigestFrequency: "off",
  pushNotificationsEnabled: true,
  pushPermission: "default",
  notificationAudience: "everyone",
  notificationChannels: { inApp: true, push: true, email: false },
  quietHours: { enabled: false, start: "22:00", end: "07:00" },
  notificationPreview: "full",
  notificationSound: true,
  notificationVibration: true,
  notificationPreferences: {
    likes: true,
    comments: true,
    replies: true,
    mentions: true,
    tags: true,
    follows: true,
    followRequests: true,
    messages: true,
    groupMessages: true,
    storyActivity: true,
    live: true,
    creatorUpdates: true,
    reposts: true,
    reports: true,
    recommendations: true,
  },
  followedTopics: [],
  pinnedPosts: [],
  messagePrivacy: "everyone",
  showActivityStatus: true,
  showFollowerCounts: true,
  allowProfileSharing: true,
  shareProfileViews: true,
  mentionPrivacy: "everyone",
  storyReplyAudience: "everyone",
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
    const channels = (settings.notificationChannels as Record<string, unknown> | undefined) ?? {};
    const quietHours = (settings.quietHours as Record<string, unknown> | undefined) ?? {};

    const pushNotificationsEnabled = settings.pushNotificationsEnabled === true || settings.pushNotificationsEnabled === undefined;
    const notificationChannels = {
      inApp: channels.inApp !== false,
      push: channels.push !== false,
      email: channels.email === true,
    };

    if (!pushNotificationsEnabled || !notificationChannels.push) {
      void updateCurrentUserSettings({
        pushNotificationsEnabled: true,
        notificationChannels: {
          ...notificationChannels,
          push: true,
          inApp: true,
        },
      }).catch(() => undefined);
    }

    return {
      privateAccount: settings.privateAccount === true || settings.profileVisibility === "private",
      availabilityStatus:
        settings.availabilityStatus === "locked_in" || settings.availabilityStatus === "recovering"
          ? settings.availabilityStatus
          : "available",
      headline: String(settings.headline ?? ""),
      emailDigestFrequency:
        settings.emailDigestFrequency === "daily" || settings.emailDigestFrequency === "weekly"
          ? settings.emailDigestFrequency
          : "off",
      pushNotificationsEnabled,
      pushPermission:
        settings.pushPermission === "granted" || settings.pushPermission === "denied"
          ? settings.pushPermission
          : "default",
      notificationAudience: settings.notificationAudience === "following" || settings.notificationAudience === "no_one" ? settings.notificationAudience : "everyone",
      notificationChannels,
      quietHours: { enabled: quietHours.enabled === true, start: String(quietHours.start ?? "22:00"), end: String(quietHours.end ?? "07:00") },
      notificationPreview: settings.notificationPreview === "sender_only" || settings.notificationPreview === "hidden" ? settings.notificationPreview : "full",
      notificationSound: settings.notificationSound !== false,
      notificationVibration: settings.notificationVibration !== false,
      notificationPreferences: {
        likes: notificationPreferences.likes !== false,
        comments: notificationPreferences.comments !== false,
        replies: notificationPreferences.replies !== false,
        mentions: notificationPreferences.mentions !== false,
        tags: notificationPreferences.tags !== false,
        follows: notificationPreferences.follows !== false,
        followRequests: notificationPreferences.followRequests !== false,
        messages: notificationPreferences.messages !== false,
        groupMessages: notificationPreferences.groupMessages !== false,
        storyActivity: notificationPreferences.storyActivity !== false,
        live: notificationPreferences.live !== false,
        creatorUpdates: notificationPreferences.creatorUpdates !== false,
        reposts: notificationPreferences.reposts !== false,
        reports: notificationPreferences.reports !== false,
        recommendations: notificationPreferences.recommendations !== false,
      },
      followedTopics: Array.isArray(data.followedTopics) ? (data.followedTopics as string[]) : [],
      pinnedPosts: Array.isArray(data.pinnedPosts) ? (data.pinnedPosts as string[]) : [],
      messagePrivacy:
        settings.messagePrivacy === "following" || settings.messagePrivacy === "no_one"
          ? settings.messagePrivacy
          : "everyone",
      showActivityStatus: settings.showActivityStatus !== false,
      showFollowerCounts: settings.showFollowerCounts !== false,
      allowProfileSharing: settings.allowProfileSharing !== false,
      shareProfileViews: settings.shareProfileViews !== false,
      mentionPrivacy: settings.mentionPrivacy === "following" || settings.mentionPrivacy === "no_one" ? settings.mentionPrivacy : "everyone",
      storyReplyAudience: settings.storyReplyAudience === "following" || settings.storyReplyAudience === "no_one" ? settings.storyReplyAudience : "everyone",
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
        ...(typeof input.privateAccount === "boolean"
          ? { privateAccount: input.privateAccount, profileVisibility: input.privateAccount ? "private" : "public" }
          : {}),
        ...(input.availabilityStatus ? { availabilityStatus: input.availabilityStatus } : {}),
        ...(typeof input.headline === "string" ? { headline: input.headline.trim() } : {}),
        ...(input.emailDigestFrequency
          ? { emailDigestFrequency: input.emailDigestFrequency }
          : {}),
        ...(typeof input.pushNotificationsEnabled === "boolean"
          ? { pushNotificationsEnabled: input.pushNotificationsEnabled }
          : {}),
        ...(input.pushPermission ? { pushPermission: input.pushPermission } : {}),
        ...(input.notificationAudience ? { notificationAudience: input.notificationAudience } : {}),
        ...(input.notificationChannels ? { notificationChannels: input.notificationChannels } : {}),
        ...(input.quietHours ? { quietHours: input.quietHours } : {}),
        ...(input.notificationPreview ? { notificationPreview: input.notificationPreview } : {}),
        ...(typeof input.notificationSound === "boolean" ? { notificationSound: input.notificationSound } : {}),
        ...(typeof input.notificationVibration === "boolean" ? { notificationVibration: input.notificationVibration } : {}),
        ...(input.messagePrivacy ? { messagePrivacy: input.messagePrivacy } : {}),
        ...(typeof input.showActivityStatus === "boolean" ? { showActivityStatus: input.showActivityStatus } : {}),
        ...(typeof input.showFollowerCounts === "boolean" ? { showFollowerCounts: input.showFollowerCounts } : {}),
        ...(typeof input.allowProfileSharing === "boolean" ? { allowProfileSharing: input.allowProfileSharing } : {}),
        ...(typeof input.shareProfileViews === "boolean" ? { shareProfileViews: input.shareProfileViews } : {}),
        ...(input.mentionPrivacy ? { mentionPrivacy: input.mentionPrivacy } : {}),
        ...(input.storyReplyAudience ? { storyReplyAudience: input.storyReplyAudience } : {}),
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
