"use client";

import { arrayRemove, arrayUnion, collection, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { createNotification } from "@/lib/notifications";
import { getUserProfileById, searchProfiles, type SearchProfile } from "@/lib/user-profile";

export interface FollowRequest { id: string; requesterId: string; recipientId: string; status: "pending" | "accepted" | "rejected"; createdAt?: { seconds?: number } | null; requester?: SearchProfile | null }

export function subscribeToFollowRequests(callback: (requests: FollowRequest[]) => void) {
  if (!db || !auth.currentUser) { callback([]); return () => undefined; }
  return onSnapshot(query(collection(db, "followRequests"), where("recipientId", "==", auth.currentUser.uid)), async (snapshot) => {
    const pending = snapshot.docs.filter((item) => item.data().status === "pending");
    const requests = await Promise.all(pending.map(async (item) => ({ id: item.id, requesterId: String(item.data().requesterId ?? ""), recipientId: String(item.data().recipientId ?? ""), status: "pending" as const, createdAt: item.data().createdAt ?? null, requester: await getUserProfileById(String(item.data().requesterId ?? "")) as SearchProfile | null })));
    callback(requests);
  }, () => callback([]));
}

export async function respondToFollowRequest(request: FollowRequest, accept: boolean) {
  if (!db || !auth.currentUser || request.recipientId !== auth.currentUser.uid) throw new Error("This follow request is unavailable.");
  const batch = writeBatch(db); const requestRef = doc(db, "followRequests", request.id);
  batch.set(requestRef, { status: accept ? "accepted" : "rejected", respondedAt: serverTimestamp() }, { merge: true });
  if (accept) { batch.set(doc(db, "users", request.recipientId), { followers: arrayUnion(request.requesterId), updatedAt: serverTimestamp() }, { merge: true }); batch.set(doc(db, "users", request.requesterId), { following: arrayUnion(request.recipientId), updatedAt: serverTimestamp() }, { merge: true }); }
  await batch.commit();
  if (accept) await createNotification({ type: "follow_request_accepted", recipientId: request.requesterId, actorId: request.recipientId, actorName: auth.currentUser.displayName || "Someone", actorAvatar: auth.currentUser.photoURL || "", message: `${auth.currentUser.displayName || "Someone"} accepted your follow request.` });
}

export async function removeFollower(followerId: string) {
  if (!db || !auth.currentUser) throw new Error("You must be signed in."); const uid = auth.currentUser.uid; const batch = writeBatch(db);
  batch.set(doc(db, "users", uid), { followers: arrayRemove(followerId), updatedAt: serverTimestamp() }, { merge: true }); batch.set(doc(db, "users", followerId), { following: arrayRemove(uid), updatedAt: serverTimestamp() }, { merge: true }); await batch.commit();
}

export async function getProfilesByIds(ids: string[]) {
  if (!db) return [];
  const profiles = await Promise.all(ids.slice(0, 100).map(async (uid) => { const snapshot = await getDoc(doc(db!, "users", uid)); return snapshot.exists() ? ({ uid: snapshot.id, ...snapshot.data() } as SearchProfile) : null; }));
  return profiles.filter((profile): profile is SearchProfile => Boolean(profile));
}

export async function getSuggestedSocialProfiles(current: SearchProfile | null) {
  const profiles = await searchProfiles(""); const connected = new Set([current?.uid, ...(current?.followers ?? []), ...(current?.following ?? [])]);
  return profiles.filter((profile) => !connected.has(profile.uid)).sort((a, b) => (b.followers ?? []).filter((uid) => current?.following.includes(uid)).length - (a.followers ?? []).filter((uid) => current?.following.includes(uid)).length).slice(0, 6);
}

export async function toggleSocialList(targetUid: string, field: "closeFriends" | "favoriteUsers", enabled: boolean) {
  if (!db || !auth.currentUser) throw new Error("You must be signed in."); await setDoc(doc(db, "users", auth.currentUser.uid), { [field]: enabled ? arrayRemove(targetUid) : arrayUnion(targetUid), updatedAt: serverTimestamp() }, { merge: true });
}

export async function setPrivateProfile(privateAccount: boolean) {
  if (!db || !auth.currentUser) throw new Error("You must be signed in."); await updateDoc(doc(db, "users", auth.currentUser.uid), { "settings.privateAccount": privateAccount, updatedAt: serverTimestamp() });
}

export async function getTaggedProfilePosts(uid: string) {
  const { searchPosts } = await import("@/lib/posts"); const posts = await searchPosts("");
  return posts.filter((post) => (post.mentionUserIds ?? []).includes(uid) || (post.collaborators ?? []).some((person) => person.uid === uid));
}
