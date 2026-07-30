import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

import { uploadToFirebaseStorage } from "@/lib/storage";
import { auth, db } from "@/lib/firebase";

export interface DrillRecord {
  id: string;
  ownerId: string;
  title: string;
  category: string;
  description: string;
  savedBy: string[];
}

export interface TeamPracticePlanRecord {
  id: string;
  teamId: string;
  title: string;
  date: string;
  focus: string;
  drills: string[];
  coachIds: string[];
}

export interface PlaybookBoardRecord {
  id: string;
  teamId: string;
  title: string;
  imageUrl: string;
}

export interface SkillProgressRecord {
  id: string;
  userId: string;
  skillName: string;
  currentLevel: number;
  targetLevel: number;
}

export interface ConditioningLogRecord {
  id: string;
  userId: string;
  date: string;
  workoutType: string;
  durationMinutes: number;
  intensity: number;
}

export interface NutritionJournalRecord {
  id: string;
  userId: string;
  date: string;
  meals: string;
  hydrationOz: number;
}

export interface RecoveryAppointmentRecord {
  id: string;
  requesterId: string;
  hostId: string;
  hostName: string;
  type: "recovery" | "physio";
  scheduledFor: string;
  note: string;
  status: "pending" | "accepted" | "completed";
}

export interface MedicalClearanceRecord {
  id: string;
  userId: string;
  title: string;
  imageUrl: string;
  status: "pending" | "cleared";
}

export interface ReturnToPlayChecklistRecord {
  id: string;
  userId: string;
  title: string;
  items: Array<{ label: string; done: boolean }>;
}

export interface RehabAssignmentRecord {
  id: string;
  userId: string;
  coachName: string;
  title: string;
  notes: string;
  completed: boolean;
}

export interface CoachCheckInRecord {
  id: string;
  userId: string;
  coachUid: string;
  coachName: string;
  reflection: string;
  burnoutScore: number;
}

export interface GoalRecord {
  id: string;
  userId: string;
  title: string;
  category: string;
  progress: number;
  target: number;
}

function requireAuth() {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in.");
  }
}

function mapSimple<T>(docSnapshot: { id: string; data: () => Record<string, unknown> }, mapper: (id: string, data: Record<string, unknown>) => T) {
  return mapper(docSnapshot.id, docSnapshot.data() as Record<string, unknown>);
}

export async function createDrill(input: { title: string; category: string; description: string }) {
  requireAuth();
  await addDoc(collection(db!, "drills"), {
    ownerId: auth!.currentUser!.uid,
    title: input.title.trim(),
    category: input.category.trim(),
    description: input.description.trim(),
    savedBy: [],
    createdAt: serverTimestamp(),
  });
}

export async function getDrills() {
  if (!db) {
    return [];
  }
  const snapshot = await getDocs(query(collection(db, "drills"), limit(100)));
  return snapshot.docs.map((docSnapshot: { id: string; data: () => Record<string, unknown> }) =>
    mapSimple(docSnapshot, (id, data) => ({
      id,
      ownerId: String(data.ownerId ?? ""),
      title: String(data.title ?? ""),
      category: String(data.category ?? ""),
      description: String(data.description ?? ""),
      savedBy: Array.isArray(data.savedBy) ? (data.savedBy as string[]) : [],
    } satisfies DrillRecord))
  );
}

export async function saveDrill(drillId: string) {
  requireAuth();
  await updateDoc(doc(db!, "drills", drillId), {
    savedBy: arrayUnion(auth!.currentUser!.uid),
  });
}

export async function createTeamPracticePlan(input: {
  teamId: string;
  title: string;
  date: string;
  focus: string;
  drills: string[];
}) {
  requireAuth();
  await addDoc(collection(db!, "teamPracticePlans"), {
    teamId: input.teamId,
    title: input.title.trim(),
    date: input.date.trim(),
    focus: input.focus.trim(),
    drills: input.drills,
    coachIds: [auth!.currentUser!.uid],
    createdAt: serverTimestamp(),
  });
}

export async function getTeamPracticePlans(teamId: string) {
  if (!db) {
    return [];
  }
  const snapshot = await getDocs(query(collection(db, "teamPracticePlans"), where("teamId", "==", teamId), limit(30)));
  return snapshot.docs.map((docSnapshot: { id: string; data: () => Record<string, unknown> }) =>
    mapSimple(docSnapshot, (id, data) => ({
      id,
      teamId: String(data.teamId ?? ""),
      title: String(data.title ?? ""),
      date: String(data.date ?? ""),
      focus: String(data.focus ?? ""),
      drills: Array.isArray(data.drills) ? (data.drills as string[]) : [],
      coachIds: Array.isArray(data.coachIds) ? (data.coachIds as string[]) : [],
    } satisfies TeamPracticePlanRecord))
  );
}

export async function createPlaybookBoard(input: { teamId: string; title: string; imageFile: File }) {
  requireAuth();
  const upload = await uploadToFirebaseStorage(input.imageFile, `Kinet/playbooks/${input.teamId}`);
  await addDoc(collection(db!, "playbookBoards"), {
    teamId: input.teamId,
    title: input.title.trim(),
    imageUrl: upload.url,
    createdAt: serverTimestamp(),
  });
}

export async function getPlaybookBoards(teamId: string) {
  if (!db) {
    return [];
  }
  const snapshot = await getDocs(query(collection(db, "playbookBoards"), where("teamId", "==", teamId), limit(20)));
  return snapshot.docs.map((docSnapshot: { id: string; data: () => Record<string, unknown> }) =>
    mapSimple(docSnapshot, (id, data) => ({
      id,
      teamId: String(data.teamId ?? ""),
      title: String(data.title ?? ""),
      imageUrl: String(data.imageUrl ?? ""),
    } satisfies PlaybookBoardRecord))
  );
}

export async function upsertSkillProgress(input: { skillName: string; currentLevel: number; targetLevel: number }) {
  requireAuth();
  await addDoc(collection(db!, "skillProgress"), {
    userId: auth!.currentUser!.uid,
    skillName: input.skillName.trim(),
    currentLevel: input.currentLevel,
    targetLevel: input.targetLevel,
    updatedAt: serverTimestamp(),
  });
}

export async function getCurrentUserSkillProgress() {
  requireAuth();
  const snapshot = await getDocs(query(collection(db!, "skillProgress"), where("userId", "==", auth!.currentUser!.uid), limit(40)));
  return snapshot.docs.map((docSnapshot: { id: string; data: () => Record<string, unknown> }) =>
    mapSimple(docSnapshot, (id, data) => ({
      id,
      userId: String(data.userId ?? ""),
      skillName: String(data.skillName ?? ""),
      currentLevel: Number(data.currentLevel ?? 0),
      targetLevel: Number(data.targetLevel ?? 10),
    } satisfies SkillProgressRecord))
  );
}

export async function addConditioningLog(input: { date: string; workoutType: string; durationMinutes: number; intensity: number }) {
  requireAuth();
  await addDoc(collection(db!, "conditioningLogs"), {
    userId: auth!.currentUser!.uid,
    date: input.date.trim(),
    workoutType: input.workoutType.trim(),
    durationMinutes: input.durationMinutes,
    intensity: input.intensity,
    createdAt: serverTimestamp(),
  });
}

export async function getCurrentUserConditioningLogs() {
  requireAuth();
  const snapshot = await getDocs(query(collection(db!, "conditioningLogs"), where("userId", "==", auth!.currentUser!.uid), limit(40)));
  return snapshot.docs.map((docSnapshot: { id: string; data: () => Record<string, unknown> }) =>
    mapSimple(docSnapshot, (id, data) => ({
      id,
      userId: String(data.userId ?? ""),
      date: String(data.date ?? ""),
      workoutType: String(data.workoutType ?? ""),
      durationMinutes: Number(data.durationMinutes ?? 0),
      intensity: Number(data.intensity ?? 0),
    } satisfies ConditioningLogRecord))
  );
}

export async function addNutritionJournalEntry(input: { date: string; meals: string; hydrationOz: number }) {
  requireAuth();
  await addDoc(collection(db!, "nutritionJournal"), {
    userId: auth!.currentUser!.uid,
    date: input.date.trim(),
    meals: input.meals.trim(),
    hydrationOz: input.hydrationOz,
    createdAt: serverTimestamp(),
  });
}

export async function getCurrentUserNutritionJournal() {
  requireAuth();
  const snapshot = await getDocs(query(collection(db!, "nutritionJournal"), where("userId", "==", auth!.currentUser!.uid), limit(40)));
  return snapshot.docs.map((docSnapshot: { id: string; data: () => Record<string, unknown> }) =>
    mapSimple(docSnapshot, (id, data) => ({
      id,
      userId: String(data.userId ?? ""),
      date: String(data.date ?? ""),
      meals: String(data.meals ?? ""),
      hydrationOz: Number(data.hydrationOz ?? 0),
    } satisfies NutritionJournalRecord))
  );
}

export async function createRecoveryAppointment(input: { hostId: string; hostName: string; type: "recovery" | "physio"; scheduledFor: string; note: string }) {
  requireAuth();
  await addDoc(collection(db!, "recoveryAppointments"), {
    requesterId: auth!.currentUser!.uid,
    hostId: input.hostId,
    hostName: input.hostName,
    type: input.type,
    scheduledFor: input.scheduledFor.trim(),
    note: input.note.trim(),
    status: "pending",
    createdAt: serverTimestamp(),
  });
}

export async function getCurrentUserRecoveryAppointments() {
  requireAuth();
  const [incoming, outgoing] = await Promise.all([
    getDocs(query(collection(db!, "recoveryAppointments"), where("hostId", "==", auth!.currentUser!.uid), limit(30))),
    getDocs(query(collection(db!, "recoveryAppointments"), where("requesterId", "==", auth!.currentUser!.uid), limit(30))),
  ]);
  const mapRecord = (docSnapshot: { id: string; data: () => Record<string, unknown> }) =>
    mapSimple(docSnapshot, (id, data) => ({
      id,
      requesterId: String(data.requesterId ?? ""),
      hostId: String(data.hostId ?? ""),
      hostName: String(data.hostName ?? ""),
      type: data.type === "physio" ? "physio" : "recovery",
      scheduledFor: String(data.scheduledFor ?? ""),
      note: String(data.note ?? ""),
      status: data.status === "accepted" || data.status === "completed" ? data.status : "pending",
    } satisfies RecoveryAppointmentRecord));
  return {
    incoming: incoming.docs.map(mapRecord),
    outgoing: outgoing.docs.map(mapRecord),
  };
}

export async function addMedicalClearance(input: { title: string; imageFile: File }) {
  requireAuth();
  const upload = await uploadToFirebaseStorage(input.imageFile, `Kinet/medical/${auth!.currentUser!.uid}`);
  await addDoc(collection(db!, "medicalClearances"), {
    userId: auth!.currentUser!.uid,
    title: input.title.trim(),
    imageUrl: upload.url,
    status: "pending",
    createdAt: serverTimestamp(),
  });
}

export async function getCurrentUserMedicalClearances() {
  requireAuth();
  const snapshot = await getDocs(query(collection(db!, "medicalClearances"), where("userId", "==", auth!.currentUser!.uid), limit(20)));
  return snapshot.docs.map((docSnapshot: { id: string; data: () => Record<string, unknown> }) =>
    mapSimple(docSnapshot, (id, data) => ({
      id,
      userId: String(data.userId ?? ""),
      title: String(data.title ?? ""),
      imageUrl: String(data.imageUrl ?? ""),
      status: data.status === "cleared" ? "cleared" : "pending",
    } satisfies MedicalClearanceRecord))
  );
}

export async function saveReturnToPlayChecklist(input: { title: string; items: string[] }) {
  requireAuth();
  await setDoc(
    doc(db!, "returnToPlay", auth!.currentUser!.uid),
    {
      userId: auth!.currentUser!.uid,
      title: input.title.trim(),
      items: input.items.map((label) => ({ label, done: false })),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function toggleReturnToPlayItem(index: number, done: boolean) {
  requireAuth();
  const snapshot = await getDocs(query(collection(db!, "returnToPlay"), where("userId", "==", auth!.currentUser!.uid), limit(1)));
  const match = snapshot.docs[0];
  if (!match) {
    return;
  }
  const data = match.data() as Record<string, unknown>;
  const items = Array.isArray(data.items) ? (data.items as Array<Record<string, unknown>>) : [];
  items[index] = { ...(items[index] ?? {}), done };
  await updateDoc(doc(db!, "returnToPlay", match.id), { items });
}

export async function getCurrentUserReturnToPlayChecklist() {
  requireAuth();
  const snapshot = await getDocs(query(collection(db!, "returnToPlay"), where("userId", "==", auth!.currentUser!.uid), limit(1)));
  const match = snapshot.docs[0];
  if (!match) {
    return null;
  }
  const data = match.data() as Record<string, unknown>;
  return {
    id: match.id,
    userId: String(data.userId ?? ""),
    title: String(data.title ?? ""),
    items: Array.isArray(data.items)
      ? (data.items as Array<Record<string, unknown>>).map((item) => ({
          label: String(item.label ?? ""),
          done: item.done === true,
        }))
      : [],
  } satisfies ReturnToPlayChecklistRecord;
}

export async function addRehabAssignment(input: { title: string; notes: string }) {
  requireAuth();
  await addDoc(collection(db!, "rehabAssignments"), {
    userId: auth!.currentUser!.uid,
    coachName: auth!.currentUser!.displayName || "Coach",
    title: input.title.trim(),
    notes: input.notes.trim(),
    completed: false,
    createdAt: serverTimestamp(),
  });
}

export async function getCurrentUserRehabAssignments() {
  requireAuth();
  const snapshot = await getDocs(query(collection(db!, "rehabAssignments"), where("userId", "==", auth!.currentUser!.uid), limit(30)));
  return snapshot.docs.map((docSnapshot: { id: string; data: () => Record<string, unknown> }) =>
    mapSimple(docSnapshot, (id, data) => ({
      id,
      userId: String(data.userId ?? ""),
      coachName: String(data.coachName ?? ""),
      title: String(data.title ?? ""),
      notes: String(data.notes ?? ""),
      completed: data.completed === true,
    } satisfies RehabAssignmentRecord))
  );
}

export async function addCoachCheckIn(input: { reflection: string; burnoutScore: number }) {
  requireAuth();
  await addDoc(collection(db!, "coachCheckIns"), {
    userId: auth!.currentUser!.uid,
    coachUid: auth!.currentUser!.uid,
    coachName: auth!.currentUser!.displayName || "Coach",
    reflection: input.reflection.trim(),
    burnoutScore: input.burnoutScore,
    createdAt: serverTimestamp(),
  });
}

export async function getCurrentUserCoachCheckIns() {
  requireAuth();
  const snapshot = await getDocs(query(collection(db!, "coachCheckIns"), where("userId", "==", auth!.currentUser!.uid), limit(30)));
  return snapshot.docs.map((docSnapshot: { id: string; data: () => Record<string, unknown> }) =>
    mapSimple(docSnapshot, (id, data) => ({
      id,
      userId: String(data.userId ?? ""),
      coachUid: String(data.coachUid ?? ""),
      coachName: String(data.coachName ?? ""),
      reflection: String(data.reflection ?? ""),
      burnoutScore: Number(data.burnoutScore ?? 0),
    } satisfies CoachCheckInRecord))
  );
}

export async function createGoal(input: { title: string; category: string; target: number }) {
  requireAuth();
  await addDoc(collection(db!, "trainingGoals"), {
    userId: auth!.currentUser!.uid,
    title: input.title.trim(),
    category: input.category.trim(),
    progress: 0,
    target: input.target,
    createdAt: serverTimestamp(),
  });
}

export async function updateGoalProgress(goalId: string, progress: number) {
  requireAuth();
  await updateDoc(doc(db!, "trainingGoals", goalId), { progress });
}

export async function getCurrentUserGoals() {
  requireAuth();
  const snapshot = await getDocs(query(collection(db!, "trainingGoals"), where("userId", "==", auth!.currentUser!.uid), limit(30)));
  return snapshot.docs.map((docSnapshot: { id: string; data: () => Record<string, unknown> }) =>
    mapSimple(docSnapshot, (id, data) => ({
      id,
      userId: String(data.userId ?? ""),
      title: String(data.title ?? ""),
      category: String(data.category ?? ""),
      progress: Number(data.progress ?? 0),
      target: Number(data.target ?? 1),
    } satisfies GoalRecord))
  );
}

export async function getPracticeAttendanceStreak() {
  requireAuth();
  const snapshot = await getDocs(query(collection(db!, "teamAttendance"), where("memberUid", "==", auth!.currentUser!.uid), limit(100)));
  return snapshot.docs.filter((docSnapshot: { data: () => Record<string, unknown> }) => {
    const data = docSnapshot.data();
    return data.status === "present" || data.status === "late";
  }).length;
}
