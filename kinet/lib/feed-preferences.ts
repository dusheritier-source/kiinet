"use client";

import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export interface FeedPreferences { mutedUserIds: string[]; mutedWords: string[]; mutedTopics: string[]; snoozedUsers: Record<string, number>; contentFilter: "all" | "media" | "text"; sensitiveContent: "show" | "warn" | "hide"; hideEngagementCounts: boolean; }
export const defaultFeedPreferences: FeedPreferences = { mutedUserIds: [], mutedWords: [], mutedTopics: [], snoozedUsers: {}, contentFilter: "all", sensitiveContent: "warn", hideEngagementCounts: false };

export async function getFeedPreferences() {
  if (!auth.currentUser || !db) return defaultFeedPreferences;
  const snapshot = await getDoc(doc(db, "users", auth.currentUser.uid)); const raw = snapshot.data()?.feedPreferences as Partial<FeedPreferences> | undefined;
  return { mutedUserIds: Array.isArray(raw?.mutedUserIds) ? raw.mutedUserIds : [], mutedWords: Array.isArray(raw?.mutedWords) ? raw.mutedWords : [], mutedTopics: Array.isArray(raw?.mutedTopics) ? raw.mutedTopics : [], snoozedUsers: raw?.snoozedUsers && typeof raw.snoozedUsers === "object" ? raw.snoozedUsers : {}, contentFilter: raw?.contentFilter === "media" || raw?.contentFilter === "text" ? raw.contentFilter : "all", sensitiveContent: raw?.sensitiveContent === "show" || raw?.sensitiveContent === "hide" ? raw.sensitiveContent : "warn", hideEngagementCounts: raw?.hideEngagementCounts === true } as FeedPreferences;
}
export async function saveFeedPreferences(preferences: FeedPreferences) { if (!auth.currentUser || !db) throw new Error("You must be signed in."); await setDoc(doc(db, "users", auth.currentUser.uid), { feedPreferences: preferences, updatedAt: serverTimestamp() }, { merge: true }); }
