"use client";

import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db, isPermissionDeniedFirestoreError } from "@/lib/firebase";
import type { SearchCategory } from "@/lib/search";

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  category: SearchCategory;
  sortBy: "relevance" | "recent" | "popular";
  dateRange: "any" | "week" | "month";
  verifiedOnly: boolean;
  followingOnly: boolean;
  location: string;
  exactPhrase: boolean;
  creator: string;
  savedOnly: boolean;
  likedOnly: boolean;
  messageScope: "all" | "files" | "pinned" | "saved" | "archived" | "requests";
  alertsEnabled: boolean;
  createdAt: number;
}

export interface SearchPreferences {
  history: string[];
  savedSearches: SavedSearch[];
}

const emptyPreferences: SearchPreferences = { history: [], savedSearches: [] };

function preferenceRef() {
  if (!db || !auth.currentUser) throw new Error("Sign in to save searches.");
  return doc(db, "searchPreferences", auth.currentUser.uid);
}

export function subscribeSearchPreferences(callback: (preferences: SearchPreferences) => void) {
  if (!db || !auth.currentUser) {
    callback(emptyPreferences);
    return () => undefined;
  }
  return onSnapshot(preferenceRef(), (snapshot) => {
    const data = snapshot.data();
    callback({
      history: Array.isArray(data?.history) ? data.history.filter((item): item is string => typeof item === "string").slice(0, 20) : [],
      savedSearches: Array.isArray(data?.savedSearches) ? data.savedSearches as SavedSearch[] : [],
    });
  }, () => callback(emptyPreferences));
}

async function persist(preferences: SearchPreferences) {
  try {
    await setDoc(preferenceRef(), { ...preferences, userId: auth.currentUser!.uid, updatedAt: serverTimestamp() }, { merge: true });
  } catch (error) {
    if (!isPermissionDeniedFirestoreError(error)) {
      console.warn("Could not persist search preferences.", error);
    }
  }
}

export async function recordSearch(query: string, current: SearchPreferences) {
  const cleaned = query.trim();
  if (!cleaned || !auth.currentUser || !db) return;
  const history = [cleaned, ...current.history.filter((item) => item.toLowerCase() !== cleaned.toLowerCase())].slice(0, 20);
  await persist({ ...current, history });
}

export async function clearSearchHistory(current: SearchPreferences) {
  await persist({ ...current, history: [] });
}

export async function saveSearch(search: Omit<SavedSearch, "id" | "createdAt">, current: SearchPreferences) {
  const duplicate = current.savedSearches.find((item) => item.query.toLowerCase() === search.query.toLowerCase() && item.category === search.category);
  const saved: SavedSearch = { ...search, id: duplicate?.id ?? crypto.randomUUID(), createdAt: duplicate?.createdAt ?? Date.now() };
  const savedSearches = duplicate ? current.savedSearches.map((item) => item.id === duplicate.id ? saved : item) : [saved, ...current.savedSearches].slice(0, 25);
  await persist({ ...current, savedSearches });
  return saved;
}

export async function removeSavedSearch(id: string, current: SearchPreferences) {
  await persist({ ...current, savedSearches: current.savedSearches.filter((item) => item.id !== id) });
}

export async function toggleSearchAlert(id: string, current: SearchPreferences) {
  await persist({ ...current, savedSearches: current.savedSearches.map((item) => item.id === id ? { ...item, alertsEnabled: !item.alertsEnabled } : item) });
}
