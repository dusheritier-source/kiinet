import { collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type TimestampLike = { seconds?: number; nanoseconds?: number } | null;

export type AppAccessSettings = {
  requireInvite: boolean;
  waitlistOpen: boolean;
  inviteOnlyMessage: string;
  maintenanceMode: boolean;
};

export type InviteCodeRecord = {
  id: string; code: string; active: boolean; uses: number; maxUses: number; note: string; referralCount?: number;
  createdAt?: TimestampLike;
};

export type ManagedUserRecord = {
  uid: string; displayName: string; email: string; roleType: string;
  accessStatus: "active" | "watch" | "suspended"; verified: boolean; adminNote: string;
};

export type AuditLogRecord = {
  id: string; action: string; targetType: string; targetId: string; summary: string; createdAt?: TimestampLike;
};

export type AuditLogInput = Omit<AuditLogRecord, "id" | "createdAt"> & { metadata?: Record<string, unknown> };

const DEFAULT_SETTINGS: AppAccessSettings = {
  requireInvite: false,
  waitlistOpen: true,
  inviteOnlyMessage: "This app is currently invite-only. Please request an invitation from an existing member.",
  maintenanceMode: false,
};

function requireAdminContext() {
  if (!auth.currentUser || !db) throw new Error("Administrator authentication is required.");
  return { user: auth.currentUser, database: db };
}

export async function getAppAccessSettings(): Promise<AppAccessSettings> {
  if (!db) return DEFAULT_SETTINGS;
  try {
    const snapshot = await getDoc(doc(db, "appSettings", "access"));
    return snapshot.exists() ? { ...DEFAULT_SETTINGS, ...snapshot.data() } as AppAccessSettings : DEFAULT_SETTINGS;
  } catch {
    // Anonymous visitors may not have permission to read operational settings.
    return DEFAULT_SETTINGS;
  }
}

export async function updateAppAccessSettings(settings: Partial<AppAccessSettings>) {
  const { database } = requireAdminContext();
  await setDoc(doc(database, "appSettings", "access"), { ...settings, updatedAt: serverTimestamp() }, { merge: true });
  return { ...DEFAULT_SETTINGS, ...settings };
}

export async function createInviteCode(input: { code: string; maxUses: number; note?: string }) {
  const { user, database } = requireAdminContext();
  const code = input.code.trim().toUpperCase();
  if (!code) throw new Error("Invite code is required.");
  await setDoc(doc(database, "inviteCodes", code), { code, maxUses: Math.max(1, input.maxUses), uses: 0, referralCount: 0, note: input.note?.trim() || "", active: true, createdBy: user.uid, createdAt: serverTimestamp() });
}

export async function toggleInviteCode(code: string, active: boolean) {
  const { database } = requireAdminContext();
  await setDoc(doc(database, "inviteCodes", code), { active, updatedAt: serverTimestamp() }, { merge: true });
}

export async function updateManagedUser(userId: string, data: Pick<ManagedUserRecord, "accessStatus" | "verified" | "adminNote">) {
  const { database } = requireAdminContext();
  await setDoc(doc(database, "users", userId), { ...data, updatedAt: serverTimestamp() }, { merge: true });
}

export function subscribeToManagedUsers(callback: (users: ManagedUserRecord[]) => void) {
  if (!db) { callback([]); return () => undefined; }
  return onSnapshot(query(collection(db, "users"), orderBy("createdAt", "desc")), (snapshot) => callback(snapshot.docs.map((entry) => {
    const data = entry.data();
    return { uid: entry.id, displayName: String(data.displayName || data.username || "Kinet user"), email: String(data.email || ""), roleType: String(data.roleType || "member"), accessStatus: (["watch", "suspended"].includes(data.accessStatus) ? data.accessStatus : "active") as ManagedUserRecord["accessStatus"], verified: data.verified === true, adminNote: String(data.adminNote || "") };
  })));
}

export function subscribeToInviteCodes(callback: (codes: InviteCodeRecord[]) => void) {
  if (!db) { callback([]); return () => undefined; }
  return onSnapshot(collection(db, "inviteCodes"), (snapshot) => callback(snapshot.docs.map((entry) => ({ id: entry.id, code: String(entry.data().code || entry.id), active: entry.data().active !== false, uses: Number(entry.data().uses || 0), maxUses: Number(entry.data().maxUses || 1), note: String(entry.data().note || ""), referralCount: Number(entry.data().referralCount || 0), createdAt: entry.data().createdAt || null }))));
}

export function subscribeToAuditLogs(callback: (logs: AuditLogRecord[]) => void) {
  if (!db) { callback([]); return () => undefined; }
  return onSnapshot(query(collection(db, "auditLogs"), orderBy("createdAt", "desc")), (snapshot) => callback(snapshot.docs.map((entry) => ({ id: entry.id, action: String(entry.data().action || ""), targetType: String(entry.data().targetType || ""), targetId: String(entry.data().targetId || ""), summary: String(entry.data().summary || ""), createdAt: entry.data().createdAt || null }))));
}

export async function writeAuditLog(input: AuditLogInput) {
  const { user, database } = requireAdminContext();
  const reference = doc(collection(database, "auditLogs"));
  await setDoc(reference, { ...input, actorId: user.uid, createdAt: serverTimestamp() });
}
