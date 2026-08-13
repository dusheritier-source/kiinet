import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

export interface SavedCollection {
  id: string;
  name: string;
  postIds: string[];
  createdAt?: { seconds?: number; nanoseconds?: number } | null;
}

export async function createSavedCollection(name: string) {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in.");
  }

  const trimmedName = name.trim().slice(0, 60);
  if (!trimmedName) {
    throw new Error("Enter a collection name.");
  }

  await addDoc(collection(db, "collections"), {
    userId: auth.currentUser.uid,
    name: trimmedName,
    postIds: [],
    createdAt: serverTimestamp(),
  });
}

export async function getSavedCollections() {
  if (!auth?.currentUser || !db) {
    return [];
  }

  const snapshot = await getDocs(
    query(
      collection(db, "collections"),
      where("userId", "==", auth.currentUser.uid),
      orderBy("createdAt", "desc"),
      limit(30)
    )
  );

  return snapshot.docs.map((docSnapshot: { id: string; data: () => Record<string, unknown> }) => {
    const data = docSnapshot.data() as Record<string, unknown>;
    return {
      id: docSnapshot.id,
      name: String(data.name ?? ""),
      postIds: Array.isArray(data.postIds) ? (data.postIds as string[]) : [],
      createdAt:
        (data.createdAt as { seconds?: number; nanoseconds?: number } | null | undefined) ?? null,
    } satisfies SavedCollection;
  });
}

export async function togglePostInCollection(
  collectionId: string,
  postId: string,
  isIncluded: boolean
) {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in.");
  }

  await setDoc(
    doc(db, "collections", collectionId),
    {
      postIds: isIncluded ? arrayRemove(postId) : arrayUnion(postId),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
