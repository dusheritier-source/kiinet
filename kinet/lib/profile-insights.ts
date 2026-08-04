"use client";

import { collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { getProfilesByIds } from "@/lib/profile-social";
import type { SearchProfile } from "@/lib/user-profile";

export interface ProfileVisitInsight {
  id: string;
  visitorUid: string;
  visitCount: number;
  lastVisitedAt?: { seconds?: number } | null;
  visitor?: SearchProfile;
}

export async function getProfileVisitInsights(): Promise<ProfileVisitInsight[]> {
  if (!auth.currentUser || !db) return [];
  const snapshot = await getDocs(query(collection(db, "profileVisits"), where("targetUid", "==", auth.currentUser.uid)));
  const visits = snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as ProfileVisitInsight));
  const profiles = await getProfilesByIds(visits.map((visit) => visit.visitorUid));
  const profileMap = new Map(profiles.map((profile) => [profile.uid, profile]));
  return visits.map((visit) => ({ ...visit, visitor: profileMap.get(visit.visitorUid) })).sort((a, b) => (b.lastVisitedAt?.seconds ?? 0) - (a.lastVisitedAt?.seconds ?? 0));
}
