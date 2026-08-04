import { doc, getDoc, increment, serverTimestamp, setDoc } from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

export async function recordProfileVisit(targetUid: string) {
  if (!auth?.currentUser || !db || auth.currentUser.uid === targetUid) {
    return;
  }
  const visitorSnapshot = await getDoc(doc(db, "users", auth.currentUser.uid));
  const visitorSettings = visitorSnapshot.exists() ? (visitorSnapshot.data().settings as Record<string, unknown> | undefined) : undefined;
  if (visitorSettings?.shareProfileViews === false) return;

  await setDoc(
    doc(db, "profileVisits", `${targetUid}_${auth.currentUser.uid}`),
    {
      targetUid,
      visitorUid: auth.currentUser.uid,
      visitCount: increment(1),
      lastVisitedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function recordFollowerGrowth(targetUid: string, nextFollowerCount: number) {
  if (!db) {
    return;
  }

  const snapshot = await getDoc(doc(db, "users", targetUid));
  const data = snapshot.exists() ? (snapshot.data() as Record<string, unknown>) : {};
  const analytics = (data.analytics as Record<string, unknown> | undefined) ?? {};
  const history = Array.isArray(analytics.followerHistory)
    ? (analytics.followerHistory as Array<Record<string, unknown>>)
    : [];
  const today = new Date().toISOString().slice(5, 10);
  const nextHistory = [
    ...history.filter((entry) => String(entry.label ?? "") !== today),
    { label: today, value: nextFollowerCount },
  ].slice(-14);

  await setDoc(
    doc(db, "users", targetUid),
    {
      analytics: {
        ...analytics,
        followerHistory: nextHistory,
      },
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
