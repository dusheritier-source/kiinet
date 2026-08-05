import { updateProfile as updateFirebaseProfile } from "firebase/auth";
import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, db, isTransientFirestoreError, storage } from "@/lib/firebase";
import { createNotification } from "@/lib/notifications";
import { recordFollowerGrowth } from "@/lib/profile-analytics";

export type KinetRole = "athlete" | "coach" | "scout" | "fan";

export interface CompleteProfileInput {
  role: KinetRole;
  sport: string;
  bio: string;
  username?: string;
  position?: string;
  team?: string;
  experience?: string;
  age?: number;
  height?: string;
  location?: string;
  stats?: {
    pointsPerGame?: number;
    assistsPerGame?: number;
    reboundsPerGame?: number;
  };
  skills?: string[];
  achievements?: string[];
  gameLogs?: Array<{
    opponent: string;
    date: string;
    points?: number;
    assists?: number;
    rebounds?: number;
    result?: string;
  }>;
}

export interface SearchProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  username?: string | null;
  coverPhotoURL?: string | null;
  profileTheme?: string | null;
  verified: boolean;
  followers: string[];
  following: string[];
  location?: string | null;
  bio?: string | null;
  pronouns?: string | null;
  category?: string | null;
  website?: string | null;
  socialLinks?: Array<{ label: string; url: string }>;
  status?: string | null;
  musicUrl?: string | null;
  accentColor?: string | null;
  contactEmail?: string | null;
  actionButton?: { label: string; url: string } | null;
  profileLayout?: "highlights_first" | "content_first";
  previousPhotoURL?: string | null;
  temporaryAvatarExpiresAt?: { seconds?: number } | null;
  avatarAlt?: string | null;
  coverAlt?: string | null;
  interests?: string[];
  discoveryMutualCount?: number;
  discoveryIsFollowing?: boolean;
  privateAccount?: boolean;
  role?: {
    type?: string | null;
    sport?: string | null;
    position?: string | null;
    team?: string | null;
    experience?: string | null;
    bio?: string | null;
    age?: number | null;
    height?: string | null;
  };
  athleteProfile?: {
    stats?: {
      pointsPerGame?: number | null;
      assistsPerGame?: number | null;
      reboundsPerGame?: number | null;
    };
    skills?: string[];
    achievements?: string[];
    gameLogs?: Array<{
      opponent?: string | null;
      date?: string | null;
      points?: number | null;
      assists?: number | null;
      rebounds?: number | null;
      result?: string | null;
    }>;
  };
}

async function ensureUsernameAvailable(username: string, currentUid?: string) {
  if (!db) {
    return;
  }

  const normalized = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (!normalized) {
    throw new Error("Username is required.");
  }

  let snapshot;
  try {
    snapshot = await getDocs(query(collection(db, "users"), limit(100)));
  } catch (error) {
    // A profile update should not be blocked only because Firestore's read
    // channel is temporarily offline. Security rules remain the final guard.
    if (isTransientFirestoreError(error)) return;
    throw error;
  }
  const taken = snapshot.docs.some((docSnapshot: { id: string; data: () => Record<string, unknown> }) => {
    const data = docSnapshot.data() as Record<string, unknown>;
    return (
      docSnapshot.id !== currentUid &&
      String(data.username ?? "").toLowerCase() === normalized
    );
  });

  if (taken) {
    throw new Error("That username is already taken.");
  }
}

function normalizeUsername(input: string, fallbackUid: string) {
  const normalized = input.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
  return normalized || fallbackUid.slice(0, 8).toLowerCase();
}

function normalizeExternalUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try { const parsed = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`); return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : ""; }
  catch { return ""; }
}

async function uploadProfileImage(file: File, path: string) {
  if (!storage) throw new Error("Image storage is unavailable.");
  const extension = file.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "") || "jpg";
  const reference = ref(storage, `${path}/${Date.now()}.${extension}`);
  await uploadBytes(reference, file, { contentType: file.type || "image/jpeg" });
  return getDownloadURL(reference);
}

export async function saveUserProfile(input: CompleteProfileInput) {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in and Firebase must be configured.");
  }

  const user = auth.currentUser;
  const trimmedSport = input.sport.trim();
  const trimmedBio = input.bio.trim();
  const trimmedPosition = input.position?.trim() ?? "";
  const trimmedTeam = input.team?.trim() ?? "";
  const trimmedExperience = input.experience?.trim() ?? "";
  const trimmedHeight = input.height?.trim() ?? "";
  const trimmedLocation = input.location?.trim() ?? "";
  const normalizedUsername = normalizeUsername(input.username ?? "", user.uid);

  await ensureUsernameAvailable(normalizedUsername, user.uid);

  await setDoc(
    doc(db, "users", user.uid),
    {
      uid: user.uid,
      email: user.email ?? "",
      displayName: user.displayName ?? "",
      photoURL: user.photoURL ?? "",
      username: normalizedUsername,
      coverPhotoURL: "",
      profileTheme: "classic",
      role: {
        type: input.role,
        sport: trimmedSport,
        position: trimmedPosition || null,
        team: trimmedTeam || null,
        experience: trimmedExperience || null,
        age: input.age ?? null,
        height: trimmedHeight || null,
        bio: trimmedBio,
      },
      followers: [],
      following: [],
      savedPosts: [],
      postsCount: 0,
      reelsCount: 0,
      verified: false,
      athleteProfile: {
        stats: {
          pointsPerGame: input.stats?.pointsPerGame ?? null,
          assistsPerGame: input.stats?.assistsPerGame ?? null,
          reboundsPerGame: input.stats?.reboundsPerGame ?? null,
        },
        skills: input.skills ?? [],
        achievements: input.achievements ?? [],
        gameLogs: input.gameLogs ?? [],
      },
      location: trimmedLocation || null,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function updateCurrentUserProfile(input: {
  displayName: string;
  username?: string;
  sport?: string;
  bio: string;
  pronouns?: string;
  category?: string;
  website?: string;
  socialLinks?: Array<{ label: string; url: string }>;
  status?: string;
  musicUrl?: string;
  accentColor?: string;
  contactEmail?: string;
  actionButton?: { label: string; url: string };
  profileLayout?: "highlights_first" | "content_first";
  temporaryAvatarDays?: number;
  avatarAlt?: string;
  coverAlt?: string;
  position?: string;
  team?: string;
  experience?: string;
  age?: number;
  height?: string;
  location?: string;
  avatarFile?: File | null;
  coverPhotoFile?: File | null;
  profileTheme?: string;
  stats?: {
    pointsPerGame?: number;
    assistsPerGame?: number;
    reboundsPerGame?: number;
  };
  skills?: string[];
  achievements?: string[];
  gameLogs?: Array<{
    opponent: string;
    date: string;
    points?: number;
    assists?: number;
    rebounds?: number;
    result?: string;
  }>;
}) {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in and Firebase must be configured.");
  }

  const user = auth.currentUser;
  let photoURL = user.photoURL ?? "";
  let coverPhotoURL = "";

  let currentProfile: Record<string, unknown> | null = null;
  try {
    const currentProfileSnapshot = await getDoc(doc(db, "users", user.uid));
    currentProfile = currentProfileSnapshot.exists()
      ? (currentProfileSnapshot.data() as Record<string, unknown>)
      : null;
  } catch (error) {
    if (!isTransientFirestoreError(error)) throw error;
  }
  coverPhotoURL = String(currentProfile?.coverPhotoURL ?? "");
  const normalizedUsername = normalizeUsername(input.username ?? String(currentProfile?.username ?? ""), user.uid);

  const usernameChanged = normalizedUsername !== String(currentProfile?.username ?? "").trim().toLowerCase();
  const [nextPhotoURL, nextCoverPhotoURL] = await Promise.all([
    input.avatarFile ? uploadProfileImage(input.avatarFile, `Kinet/avatars/${user.uid}`) : Promise.resolve(photoURL),
    input.coverPhotoFile ? uploadProfileImage(input.coverPhotoFile, `Kinet/covers/${user.uid}`) : Promise.resolve(coverPhotoURL),
    usernameChanged ? ensureUsernameAvailable(normalizedUsername, user.uid) : Promise.resolve(),
  ]);
  photoURL = nextPhotoURL;
  coverPhotoURL = nextCoverPhotoURL;

  const profileDocumentUpdate = setDoc(
    doc(db, "users", user.uid),
    {
      displayName: input.displayName.trim(),
      photoURL,
      username: normalizedUsername,
      coverPhotoURL,
      profileTheme: input.profileTheme?.trim() || String(currentProfile?.profileTheme ?? "classic"),
      bio: input.bio.trim(),
      pronouns: input.pronouns?.trim() || null,
      category: input.category?.trim() || "Personal",
      website: normalizeExternalUrl(input.website ?? "") || null,
      socialLinks: (input.socialLinks ?? []).map((link) => ({ label: link.label.trim() || "Link", url: normalizeExternalUrl(link.url) })).filter((link) => link.url).slice(0, 5),
      status: input.status?.trim().slice(0, 80) || null,
      musicUrl: normalizeExternalUrl(input.musicUrl ?? "") || null,
      accentColor: /^#[0-9a-f]{6}$/i.test(input.accentColor ?? "") ? input.accentColor : "#6366f1",
      contactEmail: input.contactEmail?.trim().toLowerCase() || null,
      actionButton: input.actionButton && normalizeExternalUrl(input.actionButton.url) ? { label: input.actionButton.label.trim().slice(0, 30) || "Visit", url: normalizeExternalUrl(input.actionButton.url) } : null,
      profileLayout: input.profileLayout === "content_first" ? "content_first" : "highlights_first",
      avatarAlt: input.avatarAlt?.trim().slice(0, 160) || null,
      coverAlt: input.coverAlt?.trim().slice(0, 160) || null,
      ...(input.avatarFile ? {
        previousPhotoURL: input.temporaryAvatarDays ? String(currentProfile?.photoURL ?? user.photoURL ?? "") || null : null,
        temporaryAvatarExpiresAt: input.temporaryAvatarDays ? new Date(Date.now() + input.temporaryAvatarDays * 86_400_000) : null,
      } : {}),
      role: {
        type: input.category?.trim() || String((currentProfile?.role as Record<string, unknown> | undefined)?.type ?? "personal"),
        sport: input.sport?.trim() || null,
        position: input.position?.trim() || null,
        team: input.team?.trim() || null,
        experience: input.experience?.trim() || null,
        age: input.age ?? null,
        height: input.height?.trim() || null,
        bio: input.bio.trim(),
      },
      athleteProfile: {
        stats: {
          pointsPerGame: input.stats?.pointsPerGame ?? null,
          assistsPerGame: input.stats?.assistsPerGame ?? null,
          reboundsPerGame: input.stats?.reboundsPerGame ?? null,
        },
        skills: input.skills ?? [],
        achievements: input.achievements ?? [],
        gameLogs: input.gameLogs ?? [],
      },
      location: input.location?.trim() || null,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  await Promise.all([
    updateFirebaseProfile(user as never, {
      displayName: input.displayName.trim(),
      photoURL: photoURL || null,
    } as never),
    profileDocumentUpdate,
  ]);
}

export async function getCurrentUserProfile() {
  if (!auth?.currentUser || !db) {
    return null;
  }

  try {
    const snapshot = await getDoc(doc(db, "users", auth.currentUser.uid));
    return snapshot.exists() ? snapshot.data() : null;
  } catch (error) {
    if (isTransientFirestoreError(error)) {
      return null;
    }
    throw error;
  }
}

export async function checkUsernameAvailability(username: string) {
  try {
    await ensureUsernameAvailable(username, auth?.currentUser?.uid);
    return true;
  } catch {
    return false;
  }
}

export async function getUserProfileById(uid: string) {
  if (!db) {
    return null;
  }

  try {
    const snapshot = await getDoc(doc(db, "users", uid));
    return snapshot.exists() ? snapshot.data() : null;
  } catch (error) {
    if (isTransientFirestoreError(error)) {
      return null;
    }
    throw error;
  }
}

export async function toggleFollowUser(targetUid: string, isFollowing: boolean) {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in to follow users.");
  }

  const currentUid = auth.currentUser.uid;
  if (currentUid === targetUid) {
    return;
  }

  if (!isFollowing) {
    const targetBefore = await getDoc(doc(db, "users", targetUid));
    const targetSettings = targetBefore.exists() ? ((targetBefore.data().settings as Record<string, unknown> | undefined) ?? {}) : {};
    if (targetSettings.privateAccount === true || targetSettings.profileVisibility === "private") {
      const requestRef = doc(db, "followRequests", `${currentUid}_${targetUid}`);
      const existingRequest = await getDoc(requestRef);
      if (existingRequest.exists() && existingRequest.data().status === "pending") return "requested" as const;
      await setDoc(requestRef, { requesterId: currentUid, recipientId: targetUid, status: "pending", createdAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
      await createNotification({ type: "follow_request", recipientId: targetUid, actorId: currentUid, actorName: auth.currentUser.displayName || "Kinet User", actorAvatar: auth.currentUser.photoURL || "", message: `${auth.currentUser.displayName || "Someone"} requested to follow you.` });
      return "requested" as const;
    }
  }

  await setDoc(
    doc(db, "users", currentUid),
    {
      following: isFollowing ? arrayRemove(targetUid) : arrayUnion(targetUid),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  await setDoc(
    doc(db, "users", targetUid),
    {
      followers: isFollowing ? arrayRemove(currentUid) : arrayUnion(currentUid),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  const targetSnapshot = await getDoc(doc(db, "users", targetUid));
  const targetData = targetSnapshot.exists() ? (targetSnapshot.data() as Record<string, unknown>) : null;
  const nextFollowers = Array.isArray(targetData?.followers) ? (targetData?.followers as string[]) : [];
  await recordFollowerGrowth(targetUid, nextFollowers.length);

  if (!isFollowing) {
    await createNotification({
      type: "follow",
      recipientId: targetUid,
      actorId: currentUid,
      actorName: auth.currentUser.displayName || "Kinet User",
      actorAvatar: auth.currentUser.photoURL || "",
      message: `${auth.currentUser.displayName || "Someone"} followed you.`,
    });
  }
  return isFollowing ? "unfollowed" as const : "following" as const;
}

export function subscribeToUserProfile(uid: string, callback: (profile: Record<string, unknown> | null) => void) {
  if (!db) { callback(null); return () => undefined; }
  return onSnapshot(doc(db, "users", uid), (snapshot) => callback(snapshot.exists() ? snapshot.data() as Record<string, unknown> : null), () => callback(null));
}

export async function searchProfiles(searchTerm: string) {
  if (!db) {
    return [];
  }

  const [snapshot, currentUserSnapshot] = await Promise.all([
    getDocs(query(collection(db, "users"), limit(50))),
    auth?.currentUser ? getDoc(doc(db, "users", auth.currentUser.uid)) : Promise.resolve(null),
  ]);
  const normalized = searchTerm.trim().toLowerCase();
  const currentUserData = currentUserSnapshot?.exists()
    ? (currentUserSnapshot.data() as Record<string, unknown>)
    : null;
  const blockedUsers = Array.isArray(currentUserData?.blockedUsers)
    ? (currentUserData?.blockedUsers as string[])
    : [];

  const visibleProfiles = snapshot.docs
    .map((docSnapshot) => ({
      ...docSnapshot.data(),
      // Older profiles may not contain uid. The document ID is authoritative.
      uid: docSnapshot.id,
    }) as SearchProfile)
    .filter((profile: SearchProfile) => !blockedUsers.includes(profile.uid))
    .filter((profile: SearchProfile) => {
      const targetBlocked = (profile as unknown as Record<string, unknown>).blockedUsers;
      return !auth.currentUser || !Array.isArray(targetBlocked) || !targetBlocked.includes(auth.currentUser.uid);
    })
    .map((profile: SearchProfile) => {
      const settings = ((profile as unknown as Record<string, unknown>).settings ?? {}) as Record<string, unknown>;
      const isPrivate = settings.privateAccount === true || settings.profileVisibility === "private";
      const canSeeDetails = !isPrivate || !auth.currentUser || profile.uid === auth.currentUser.uid || (profile.followers ?? []).includes(auth.currentUser.uid);
      return canSeeDetails ? { ...profile, privateAccount: isPrivate } : {
        ...profile,
        privateAccount: true,
        interests: [],
        location: null,
        role: profile.role ? { ...profile.role, bio: null } : profile.role,
      };
    })
    .filter((profile: SearchProfile) => {
      if (!normalized) {
        return true;
      }

      const haystack = [
        profile.displayName,
        profile.username,
        profile.location,
        profile.role?.bio,
        ...(profile.interests ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalized);
    });

  return visibleProfiles.sort((first, second) => {
    const score = (profile: SearchProfile) => {
      const username = String(profile.username ?? "").toLowerCase();
      const name = String(profile.displayName ?? "").toLowerCase();
      if (username === normalized) return 100;
      if (name === normalized) return 90;
      if (username.startsWith(normalized)) return 80;
      if (name.startsWith(normalized)) return 70;
      return (profile.verified ? 5 : 0) + (profile.followers?.length ?? 0) / 1000;
    };

    return score(second) - score(first);
  });
}

export async function getSuggestedProfiles(maxResults = 12) {
  if (!db || !auth?.currentUser) {
    return [];
  }

  const currentUserId = auth.currentUser.uid;
  const [profilesSnapshot, currentUserSnapshot] = await Promise.all([
    getDocs(query(collection(db, "users"), limit(100))),
    getDoc(doc(db, "users", currentUserId)),
  ]);
  const currentUser = currentUserSnapshot.exists()
    ? (currentUserSnapshot.data() as SearchProfile)
    : null;
  const following = new Set(currentUser?.following ?? []);
  const blockedUsers = new Set(
    Array.isArray((currentUser as unknown as Record<string, unknown> | null)?.blockedUsers)
      ? ((currentUser as unknown as Record<string, unknown>).blockedUsers as string[])
      : []
  );
  const location = String(currentUser?.location ?? "").trim().toLowerCase();

  return profilesSnapshot.docs
    .map((docSnapshot) => docSnapshot.data() as SearchProfile)
    .filter((profile) => profile.uid !== currentUserId && !blockedUsers.has(profile.uid))
    .map((profile) => {
      const mutualCount = (profile.followers ?? []).filter((uid) => following.has(uid)).length;
      const sameLocation = Boolean(location) && String(profile.location ?? "").toLowerCase() === location;
      const score = mutualCount * 10 + (sameLocation ? 3 : 0) + (profile.verified ? 2 : 0) + Math.min((profile.followers ?? []).length / 100, 2);
      return { profile, mutualCount, score };
    })
    .sort((first, second) => second.score - first.score)
    .slice(0, maxResults);
}
