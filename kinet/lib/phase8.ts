import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";
import { createNotification } from "@/lib/notifications";

type ListenerCleanup = () => void;

function requireUser() {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in.");
  }
  return auth.currentUser;
}

function mapTime(value: unknown) {
  return (value as { seconds?: number; nanoseconds?: number } | null | undefined) ?? null;
}

export interface SecurityPreferences {
  twoFactorEnabled: boolean;
  magicLinkEnabled: boolean;
  agePrivacyEnabled: boolean;
  guardianLinked: boolean;
  activeAccountLabel: string;
}

export interface LoginHistoryRecord {
  id: string;
  userId: string;
  email: string;
  method: string;
  deviceLabel: string;
  createdAt?: { seconds?: number; nanoseconds?: number } | null;
}

export interface ManagedDeviceRecord {
  id: string;
  userId: string;
  label: string;
  platform: string;
  lastSeenAt?: { seconds?: number; nanoseconds?: number } | null;
}

export interface GuardianLinkRecord {
  id: string;
  athleteUid: string;
  guardianName: string;
  guardianEmail: string;
  relationship: string;
  createdAt?: { seconds?: number; nanoseconds?: number } | null;
}

export interface ConsentRecord {
  id: string;
  userId: string;
  type: "legal_consent" | "media_release" | "policy_ack" | "code_of_conduct";
  label: string;
  signedAt?: { seconds?: number; nanoseconds?: number } | null;
}

export interface TeamDocumentRecord {
  id: string;
  teamId: string;
  title: string;
  body: string;
  createdBy: string;
  createdAt?: { seconds?: number; nanoseconds?: number } | null;
}

export interface AdminAnnouncementRecord {
  id: string;
  title: string;
  message: string;
  createdBy: string;
  createdAt?: { seconds?: number; nanoseconds?: number } | null;
}

export interface SuspiciousAlertRecord {
  id: string;
  userId: string;
  reason: string;
  severity: "low" | "medium" | "high";
  createdAt?: { seconds?: number; nanoseconds?: number } | null;
}

export interface BanAppealRecord {
  id: string;
  userId: string;
  message: string;
  status: "pending" | "approved" | "rejected";
  reviewNote?: string | null;
  createdAt?: { seconds?: number; nanoseconds?: number } | null;
}

export interface ShadowBanCaseRecord {
  id: string;
  userId: string;
  note: string;
  status: "open" | "reviewed";
  createdAt?: { seconds?: number; nanoseconds?: number } | null;
}

export interface TrustedReporterNomination {
  id: string;
  userId: string;
  note: string;
  status: "pending" | "approved" | "rejected";
  createdAt?: { seconds?: number; nanoseconds?: number } | null;
}

export interface StaffPermissionMatrix {
  id: string;
  teamId: string;
  roles: Record<string, string[]>;
}

export async function getCurrentSecurityPreferences() {
  if (!auth?.currentUser || !db) {
    return {
      twoFactorEnabled: false,
      magicLinkEnabled: false,
      agePrivacyEnabled: false,
      guardianLinked: false,
      activeAccountLabel: "default",
    } satisfies SecurityPreferences;
  }

  const snapshot = await getDoc(doc(db, "users", auth.currentUser.uid));
  const data = snapshot.exists() ? (snapshot.data() as Record<string, unknown>) : {};
  const security = (data.security as Record<string, unknown> | undefined) ?? {};
  return {
    twoFactorEnabled: security.twoFactorEnabled === true,
    magicLinkEnabled: security.magicLinkEnabled === true,
    agePrivacyEnabled: security.agePrivacyEnabled === true,
    guardianLinked: security.guardianLinked === true,
    activeAccountLabel: String(security.activeAccountLabel ?? "default"),
  } satisfies SecurityPreferences;
}

export async function updateCurrentSecurityPreferences(input: SecurityPreferences) {
  const user = requireUser();
  await setDoc(
    doc(db!, "users", user.uid),
    {
      security: {
        twoFactorEnabled: input.twoFactorEnabled,
        magicLinkEnabled: input.magicLinkEnabled,
        agePrivacyEnabled: input.agePrivacyEnabled,
        guardianLinked: input.guardianLinked,
        activeAccountLabel: input.activeAccountLabel.trim() || "default",
      },
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function recordLoginActivity(input: { email: string; method: string; deviceLabel: string }) {
  if (!auth?.currentUser || !db) {
    return;
  }

  const existing = await getDocs(query(collection(db, "loginHistory"), where("userId", "==", auth.currentUser.uid), limit(50)));
  const normalizedDevice = input.deviceLabel.trim() || "Browser";
  const knownDevice = existing.docs.some((item) => String(item.data().deviceLabel ?? "").toLowerCase() === normalizedDevice.toLowerCase());
  await addDoc(collection(db, "loginHistory"), {
    userId: auth.currentUser.uid,
    email: input.email.trim(),
    method: input.method.trim(),
    deviceLabel: normalizedDevice,
    createdAt: serverTimestamp(),
  });
  if (!knownDevice) await createNotification({ type: "security_alert", recipientId: auth.currentUser.uid, actorId: "security-system", actorName: "Kinet Security", actorAvatar: "", message: `New sign-in detected on ${normalizedDevice} using ${input.method.trim() || "your account"}.`, targetUrl: "/security" });
}

export async function getLoginHistory() {
  if (!auth?.currentUser || !db) return [];
  const snapshot = await getDocs(query(collection(db, "loginHistory"), where("userId", "==", auth.currentUser.uid), orderBy("createdAt", "desc"), limit(50)));
  return snapshot.docs.map((docSnapshot: { id: string; data: () => Record<string, unknown> }) => {
    const data = docSnapshot.data();
    return {
      id: docSnapshot.id,
      userId: String(data.userId ?? ""),
      email: String(data.email ?? ""),
      method: String(data.method ?? ""),
      deviceLabel: String(data.deviceLabel ?? ""),
      createdAt: mapTime(data.createdAt),
    } satisfies LoginHistoryRecord;
  });
}

export async function registerManagedDevice(input: { label: string; platform: string }) {
  const user = requireUser();
  await addDoc(collection(db!, "managedDevices"), {
    userId: user.uid,
    label: input.label.trim(),
    platform: input.platform.trim(),
    lastSeenAt: serverTimestamp(),
  });
}

export async function getManagedDevices() {
  if (!auth?.currentUser || !db) return [];
  const snapshot = await getDocs(query(collection(db, "managedDevices"), where("userId", "==", auth.currentUser.uid), orderBy("lastSeenAt", "desc"), limit(50)));
  return snapshot.docs.map((docSnapshot: { id: string; data: () => Record<string, unknown> }) => {
    const data = docSnapshot.data();
    return {
      id: docSnapshot.id,
      userId: String(data.userId ?? ""),
      label: String(data.label ?? ""),
      platform: String(data.platform ?? ""),
      lastSeenAt: mapTime(data.lastSeenAt),
    } satisfies ManagedDeviceRecord;
  });
}

export async function linkGuardianAccount(input: { guardianName: string; guardianEmail: string; relationship: string }) {
  const user = requireUser();
  await addDoc(collection(db!, "guardianLinks"), {
    athleteUid: user.uid,
    guardianName: input.guardianName.trim(),
    guardianEmail: input.guardianEmail.trim(),
    relationship: input.relationship.trim(),
    createdAt: serverTimestamp(),
  });
  await setDoc(doc(db!, "users", user.uid), { security: { guardianLinked: true } }, { merge: true });
}

export async function getGuardianLinks() {
  if (!auth?.currentUser || !db) return [];
  const snapshot = await getDocs(query(collection(db, "guardianLinks"), where("athleteUid", "==", auth.currentUser.uid), limit(20)));
  return snapshot.docs.map((docSnapshot: { id: string; data: () => Record<string, unknown> }) => {
    const data = docSnapshot.data();
    return {
      id: docSnapshot.id,
      athleteUid: String(data.athleteUid ?? ""),
      guardianName: String(data.guardianName ?? ""),
      guardianEmail: String(data.guardianEmail ?? ""),
      relationship: String(data.relationship ?? ""),
      createdAt: mapTime(data.createdAt),
    } satisfies GuardianLinkRecord;
  });
}

export async function signConsent(type: ConsentRecord["type"], label: string) {
  const user = requireUser();
  await addDoc(collection(db!, "consents"), {
    userId: user.uid,
    type,
    label: label.trim(),
    signedAt: serverTimestamp(),
  });
}

export async function getSignedConsents() {
  if (!auth?.currentUser || !db) return [];
  const snapshot = await getDocs(query(collection(db, "consents"), where("userId", "==", auth.currentUser.uid), orderBy("signedAt", "desc"), limit(50)));
  return snapshot.docs.map((docSnapshot: { id: string; data: () => Record<string, unknown> }) => {
    const data = docSnapshot.data();
    return {
      id: docSnapshot.id,
      userId: String(data.userId ?? ""),
      type: String(data.type ?? "legal_consent") as ConsentRecord["type"],
      label: String(data.label ?? ""),
      signedAt: mapTime(data.signedAt),
    } satisfies ConsentRecord;
  });
}

export async function addTeamDocument(teamId: string, title: string, body: string) {
  const user = requireUser();
  await addDoc(collection(db!, "teamDocuments"), {
    teamId,
    title: title.trim(),
    body: body.trim(),
    createdBy: user.uid,
    createdAt: serverTimestamp(),
  });
}

export async function getTeamDocuments(teamId: string) {
  if (!db) return [];
  const snapshot = await getDocs(query(collection(db, "teamDocuments"), where("teamId", "==", teamId), orderBy("createdAt", "desc"), limit(50)));
  return snapshot.docs.map((docSnapshot: { id: string; data: () => Record<string, unknown> }) => {
    const data = docSnapshot.data();
    return {
      id: docSnapshot.id,
      teamId: String(data.teamId ?? ""),
      title: String(data.title ?? ""),
      body: String(data.body ?? ""),
      createdBy: String(data.createdBy ?? ""),
      createdAt: mapTime(data.createdAt),
    } satisfies TeamDocumentRecord;
  });
}

export async function createAdminAnnouncement(title: string, message: string) {
  const user = requireUser();
  await addDoc(collection(db!, "adminAnnouncements"), {
    title: title.trim(),
    message: message.trim(),
    createdBy: user.uid,
    createdAt: serverTimestamp(),
  });
}

export function subscribeToAdminAnnouncements(callback: (items: AdminAnnouncementRecord[]) => void): ListenerCleanup {
  if (!db) {
    callback([]);
    return () => undefined;
  }
  return onSnapshot(
    query(collection(db, "adminAnnouncements"), orderBy("createdAt", "desc"), limit(30)),
    (snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => {
      callback(snapshot.docs.map((docSnapshot) => {
        const data = docSnapshot.data();
        return {
          id: docSnapshot.id,
          title: String(data.title ?? ""),
          message: String(data.message ?? ""),
          createdBy: String(data.createdBy ?? ""),
          createdAt: mapTime(data.createdAt),
        } satisfies AdminAnnouncementRecord;
      }));
    }
  );
}

export async function createSuspiciousAlert(input: { userId: string; reason: string; severity: SuspiciousAlertRecord["severity"] }) {
  requireUser();
  await addDoc(collection(db!, "suspiciousAlerts"), {
    userId: input.userId,
    reason: input.reason.trim(),
    severity: input.severity,
    createdAt: serverTimestamp(),
  });
}

export function subscribeToSuspiciousAlerts(callback: (items: SuspiciousAlertRecord[]) => void): ListenerCleanup {
  if (!db) {
    callback([]);
    return () => undefined;
  }
  return onSnapshot(
    query(collection(db, "suspiciousAlerts"), orderBy("createdAt", "desc"), limit(50)),
    (snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => {
      callback(snapshot.docs.map((docSnapshot) => {
        const data = docSnapshot.data();
        return {
          id: docSnapshot.id,
          userId: String(data.userId ?? ""),
          reason: String(data.reason ?? ""),
          severity: data.severity === "low" || data.severity === "high" ? data.severity : "medium",
          createdAt: mapTime(data.createdAt),
        } satisfies SuspiciousAlertRecord;
      }));
    }
  );
}

export async function submitBanAppeal(message: string) {
  const user = requireUser();
  await addDoc(collection(db!, "banAppeals"), {
    userId: user.uid,
    message: message.trim(),
    status: "pending",
    createdAt: serverTimestamp(),
  });
}

export async function getMyBanAppeals() {
  if (!auth?.currentUser || !db) return [];
  const snapshot = await getDocs(query(collection(db, "banAppeals"), where("userId", "==", auth.currentUser.uid), limit(20)));
  return snapshot.docs.map((docSnapshot: { id: string; data: () => Record<string, unknown> }) => {
    const data = docSnapshot.data();
    return {
      id: docSnapshot.id,
      userId: String(data.userId ?? ""),
      message: String(data.message ?? ""),
      status: data.status === "approved" || data.status === "rejected" ? data.status : "pending",
      reviewNote: data.reviewNote ? String(data.reviewNote) : null,
      createdAt: mapTime(data.createdAt),
    } satisfies BanAppealRecord;
  });
}

export function subscribeToBanAppeals(callback: (items: BanAppealRecord[]) => void): ListenerCleanup {
  if (!db) {
    callback([]);
    return () => undefined;
  }
  return onSnapshot(
    query(collection(db, "banAppeals"), orderBy("createdAt", "desc"), limit(50)),
    (snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => {
      callback(snapshot.docs.map((docSnapshot) => {
        const data = docSnapshot.data();
        return {
          id: docSnapshot.id,
          userId: String(data.userId ?? ""),
          message: String(data.message ?? ""),
          status: data.status === "approved" || data.status === "rejected" ? data.status : "pending",
          reviewNote: data.reviewNote ? String(data.reviewNote) : null,
          createdAt: mapTime(data.createdAt),
        } satisfies BanAppealRecord;
      }));
    }
  );
}

export async function reviewBanAppeal(appealId: string, status: "approved" | "rejected", reviewNote: string) {
  requireUser();
  await updateDoc(doc(db!, "banAppeals", appealId), {
    status,
    reviewNote: reviewNote.trim(),
    reviewedAt: serverTimestamp(),
  });
}

export async function createShadowBanCase(userId: string, note: string) {
  requireUser();
  await addDoc(collection(db!, "shadowBanCases"), {
    userId,
    note: note.trim(),
    status: "open",
    createdAt: serverTimestamp(),
  });
}

export function subscribeToShadowBanCases(callback: (items: ShadowBanCaseRecord[]) => void): ListenerCleanup {
  if (!db) {
    callback([]);
    return () => undefined;
  }
  return onSnapshot(
    query(collection(db, "shadowBanCases"), orderBy("createdAt", "desc"), limit(50)),
    (snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => {
      callback(snapshot.docs.map((docSnapshot) => {
        const data = docSnapshot.data();
        return {
          id: docSnapshot.id,
          userId: String(data.userId ?? ""),
          note: String(data.note ?? ""),
          status: data.status === "reviewed" ? "reviewed" : "open",
          createdAt: mapTime(data.createdAt),
        } satisfies ShadowBanCaseRecord;
      }));
    }
  );
}

export async function reviewShadowBanCase(caseId: string) {
  requireUser();
  await updateDoc(doc(db!, "shadowBanCases", caseId), { status: "reviewed", reviewedAt: serverTimestamp() });
}

export async function getCurrentTrustSnapshot() {
  if (!auth?.currentUser || !db) {
    return { reputationScore: 50, trustedReporter: false };
  }
  const snapshot = await getDoc(doc(db, "users", auth.currentUser.uid));
  const data = snapshot.exists() ? (snapshot.data() as Record<string, unknown>) : {};
  const community = (data.community as Record<string, unknown> | undefined) ?? {};
  return {
    reputationScore: Number(community.reputationScore ?? 50),
    trustedReporter: community.trustedReporter === true,
  };
}

export async function updateCommunityTrust(input: { uid: string; reputationScore: number; trustedReporter: boolean }) {
  requireUser();
  await setDoc(doc(db!, "users", input.uid), {
    community: {
      reputationScore: input.reputationScore,
      trustedReporter: input.trustedReporter,
    },
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function nominateTrustedReporter(note: string) {
  const user = requireUser();
  await addDoc(collection(db!, "trustedReporterNominations"), {
    userId: user.uid,
    note: note.trim(),
    status: "pending",
    createdAt: serverTimestamp(),
  });
}

export function subscribeToTrustedReporterNominations(callback: (items: TrustedReporterNomination[]) => void): ListenerCleanup {
  if (!db) {
    callback([]);
    return () => undefined;
  }
  return onSnapshot(
    query(collection(db, "trustedReporterNominations"), orderBy("createdAt", "desc"), limit(50)),
    (snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => {
      callback(snapshot.docs.map((docSnapshot) => {
        const data = docSnapshot.data();
        return {
          id: docSnapshot.id,
          userId: String(data.userId ?? ""),
          note: String(data.note ?? ""),
          status: data.status === "approved" || data.status === "rejected" ? data.status : "pending",
          createdAt: mapTime(data.createdAt),
        } satisfies TrustedReporterNomination;
      }));
    }
  );
}

export async function reviewTrustedReporterNomination(nominationId: string, status: "approved" | "rejected") {
  requireUser();
  await updateDoc(doc(db!, "trustedReporterNominations", nominationId), { status, reviewedAt: serverTimestamp() });
}

export async function getRolePermissionMatrix(teamId: string) {
  if (!db) {
    return {
      id: teamId,
      teamId,
      roles: {
        owner: ["all"],
        admin: ["manage_roster", "manage_events", "manage_content", "manage_recruiting"],
        coach: ["manage_events", "manage_content"],
        captain: ["manage_content"],
        player: [],
      },
    } satisfies StaffPermissionMatrix;
  }
  const snapshot = await getDoc(doc(db, "staffPermissionMatrix", teamId));
  const data = snapshot.exists() ? (snapshot.data() as Record<string, unknown>) : {};
  return {
    id: snapshot.id || teamId,
    teamId,
    roles: (data.roles as Record<string, string[]> | undefined) ?? {
      owner: ["all"],
      admin: ["manage_roster", "manage_events", "manage_content", "manage_recruiting"],
      coach: ["manage_events", "manage_content"],
      captain: ["manage_content"],
      player: [],
    },
  } satisfies StaffPermissionMatrix;
}

export async function updateRolePermissionMatrix(teamId: string, roles: Record<string, string[]>) {
  requireUser();
  await setDoc(doc(db!, "staffPermissionMatrix", teamId), { teamId, roles, updatedAt: serverTimestamp() }, { merge: true });
}
