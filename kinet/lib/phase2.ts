import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";

import { uploadToFirebaseStorage } from "@/lib/storage";
import { auth, db } from "@/lib/firebase";

function requireUser() {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in.");
  }
  return auth.currentUser;
}

function mapTime(value: unknown) {
  return (value as { seconds?: number; nanoseconds?: number } | null | undefined) ?? null;
}

export interface CameraSceneRecord {
  id: string;
  roomId: string;
  label: string;
  angle: string;
  active: boolean;
  createdAt?: { seconds?: number; nanoseconds?: number } | null;
}

export interface LiveStatOverlayRecord {
  id: string;
  roomId: string;
  headline: string;
  statLine: string;
  createdAt?: { seconds?: number; nanoseconds?: number } | null;
}

export interface FilmSessionRecord {
  id: string;
  teamId: string;
  title: string;
  agenda: string;
  status: "scheduled" | "live" | "closed";
  createdAt?: { seconds?: number; nanoseconds?: number } | null;
}

export interface ClipAssignmentRecord {
  id: string;
  postId: string;
  athleteName: string;
  focus: string;
  createdAt?: { seconds?: number; nanoseconds?: number } | null;
}

export interface DrillRubricRecord {
  id: string;
  drillTitle: string;
  metrics: Array<{ label: string; weight: number }>;
  createdAt?: { seconds?: number; nanoseconds?: number } | null;
}

export interface VoiceNoteRecord {
  id: string;
  label: string;
  transcript: string;
  audioUrl?: string | null;
  createdAt?: { seconds?: number; nanoseconds?: number } | null;
}

export interface CollaborationBoardRecord {
  id: string;
  title: string;
  postIds: string[];
  notes: string;
  createdAt?: { seconds?: number; nanoseconds?: number } | null;
}

export interface VideoReviewTaskRecord {
  id: string;
  athleteName: string;
  postId: string;
  task: string;
  status: "open" | "done";
  createdAt?: { seconds?: number; nanoseconds?: number } | null;
}

export interface CommentaryThreadRecord {
  id: string;
  postId: string;
  authorName: string;
  comment: string;
  createdAt?: { seconds?: number; nanoseconds?: number } | null;
}

export interface PressCredentialRecord {
  id: string;
  roomId: string;
  requesterName: string;
  outlet: string;
  status: "pending" | "approved";
  createdAt?: { seconds?: number; nanoseconds?: number } | null;
}

export async function saveCameraScene(input: { roomId: string; label: string; angle: string; active: boolean }) {
  requireUser();
  await addDoc(collection(db!, "cameraScenes"), {
    roomId: input.roomId,
    label: input.label.trim(),
    angle: input.angle.trim(),
    active: input.active,
    createdAt: serverTimestamp(),
  });
}

export async function getCameraScenes(roomId: string) {
  if (!db || !roomId.trim()) return [];
  const snapshot = await getDocs(query(collection(db, "cameraScenes"), where("roomId", "==", roomId), orderBy("createdAt", "desc"), limit(20)));
  return snapshot.docs.map((docSnapshot: { id: string; data: () => Record<string, unknown> }) => {
    const data = docSnapshot.data();
    return {
      id: docSnapshot.id,
      roomId: String(data.roomId ?? ""),
      label: String(data.label ?? ""),
      angle: String(data.angle ?? ""),
      active: data.active === true,
      createdAt: mapTime(data.createdAt),
    } satisfies CameraSceneRecord;
  });
}

export async function saveLiveStatOverlay(input: { roomId: string; headline: string; statLine: string }) {
  requireUser();
  await addDoc(collection(db!, "liveStatOverlays"), {
    roomId: input.roomId,
    headline: input.headline.trim(),
    statLine: input.statLine.trim(),
    createdAt: serverTimestamp(),
  });
}

export async function getLiveStatOverlays(roomId: string) {
  if (!db || !roomId.trim()) return [];
  const snapshot = await getDocs(query(collection(db, "liveStatOverlays"), where("roomId", "==", roomId), orderBy("createdAt", "desc"), limit(20)));
  return snapshot.docs.map((docSnapshot: { id: string; data: () => Record<string, unknown> }) => {
    const data = docSnapshot.data();
    return {
      id: docSnapshot.id,
      roomId: String(data.roomId ?? ""),
      headline: String(data.headline ?? ""),
      statLine: String(data.statLine ?? ""),
      createdAt: mapTime(data.createdAt),
    } satisfies LiveStatOverlayRecord;
  });
}

export async function createFilmSession(input: { teamId: string; title: string; agenda: string }) {
  requireUser();
  await addDoc(collection(db!, "filmSessions"), {
    teamId: input.teamId.trim(),
    title: input.title.trim(),
    agenda: input.agenda.trim(),
    status: "scheduled",
    createdAt: serverTimestamp(),
  });
}

export async function getFilmSessions(teamId: string) {
  if (!db || !teamId.trim()) return [];
  const snapshot = await getDocs(query(collection(db, "filmSessions"), where("teamId", "==", teamId), orderBy("createdAt", "desc"), limit(30)));
  return snapshot.docs.map((docSnapshot: { id: string; data: () => Record<string, unknown> }) => {
    const data = docSnapshot.data();
    return {
      id: docSnapshot.id,
      teamId: String(data.teamId ?? ""),
      title: String(data.title ?? ""),
      agenda: String(data.agenda ?? ""),
      status: data.status === "live" || data.status === "closed" ? data.status : "scheduled",
      createdAt: mapTime(data.createdAt),
    } satisfies FilmSessionRecord;
  });
}

export async function saveClipAssignment(input: { postId: string; athleteName: string; focus: string }) {
  requireUser();
  await addDoc(collection(db!, "clipAssignments"), {
    postId: input.postId,
    athleteName: input.athleteName.trim(),
    focus: input.focus.trim(),
    createdAt: serverTimestamp(),
  });
}

export async function getClipAssignments(postId: string) {
  if (!db || !postId.trim()) return [];
  const snapshot = await getDocs(query(collection(db, "clipAssignments"), where("postId", "==", postId), orderBy("createdAt", "desc"), limit(20)));
  return snapshot.docs.map((docSnapshot: { id: string; data: () => Record<string, unknown> }) => {
    const data = docSnapshot.data();
    return {
      id: docSnapshot.id,
      postId: String(data.postId ?? ""),
      athleteName: String(data.athleteName ?? ""),
      focus: String(data.focus ?? ""),
      createdAt: mapTime(data.createdAt),
    } satisfies ClipAssignmentRecord;
  });
}

export async function saveDrillRubric(input: { drillTitle: string; metrics: Array<{ label: string; weight: number }> }) {
  requireUser();
  await addDoc(collection(db!, "drillRubrics"), {
    drillTitle: input.drillTitle.trim(),
    metrics: input.metrics,
    createdAt: serverTimestamp(),
  });
}

export async function getDrillRubrics() {
  if (!db) return [];
  const snapshot = await getDocs(query(collection(db, "drillRubrics"), orderBy("createdAt", "desc"), limit(30)));
  return snapshot.docs.map((docSnapshot: { id: string; data: () => Record<string, unknown> }) => {
    const data = docSnapshot.data();
    return {
      id: docSnapshot.id,
      drillTitle: String(data.drillTitle ?? ""),
      metrics: Array.isArray(data.metrics)
        ? (data.metrics as Array<Record<string, unknown>>).map((metric) => ({
            label: String(metric.label ?? ""),
            weight: Number(metric.weight ?? 0),
          }))
        : [],
      createdAt: mapTime(data.createdAt),
    } satisfies DrillRubricRecord;
  });
}

export async function saveVoiceNote(input: { label: string; transcript: string; audioFile?: File | null }) {
  requireUser();
  const upload = input.audioFile ? await uploadToFirebaseStorage(input.audioFile, `Kinet/voice-notes/${auth!.currentUser!.uid}`) : null;
  await addDoc(collection(db!, "voiceNotes"), {
    label: input.label.trim(),
    transcript: input.transcript.trim(),
    audioUrl: upload?.url ?? null,
    createdAt: serverTimestamp(),
  });
}

export async function getVoiceNotes() {
  if (!db) return [];
  const snapshot = await getDocs(query(collection(db, "voiceNotes"), orderBy("createdAt", "desc"), limit(30)));
  return snapshot.docs.map((docSnapshot: { id: string; data: () => Record<string, unknown> }) => {
    const data = docSnapshot.data();
    return {
      id: docSnapshot.id,
      label: String(data.label ?? ""),
      transcript: String(data.transcript ?? ""),
      audioUrl: data.audioUrl ? String(data.audioUrl) : null,
      createdAt: mapTime(data.createdAt),
    } satisfies VoiceNoteRecord;
  });
}

export async function saveCollaborationBoard(input: { title: string; postIds: string[]; notes: string }) {
  requireUser();
  await addDoc(collection(db!, "collaborationBoards"), {
    title: input.title.trim(),
    postIds: input.postIds,
    notes: input.notes.trim(),
    createdAt: serverTimestamp(),
  });
}

export async function getCollaborationBoards() {
  if (!db) return [];
  const snapshot = await getDocs(query(collection(db, "collaborationBoards"), orderBy("createdAt", "desc"), limit(30)));
  return snapshot.docs.map((docSnapshot: { id: string; data: () => Record<string, unknown> }) => {
    const data = docSnapshot.data();
    return {
      id: docSnapshot.id,
      title: String(data.title ?? ""),
      postIds: Array.isArray(data.postIds) ? (data.postIds as string[]) : [],
      notes: String(data.notes ?? ""),
      createdAt: mapTime(data.createdAt),
    } satisfies CollaborationBoardRecord;
  });
}

export async function saveVideoReviewTask(input: { athleteName: string; postId: string; task: string }) {
  requireUser();
  await addDoc(collection(db!, "videoReviewTasks"), {
    athleteName: input.athleteName.trim(),
    postId: input.postId,
    task: input.task.trim(),
    status: "open",
    createdAt: serverTimestamp(),
  });
}

export async function getVideoReviewTasks(postId: string) {
  if (!db || !postId.trim()) return [];
  const snapshot = await getDocs(query(collection(db, "videoReviewTasks"), where("postId", "==", postId), orderBy("createdAt", "desc"), limit(30)));
  return snapshot.docs.map((docSnapshot: { id: string; data: () => Record<string, unknown> }) => {
    const data = docSnapshot.data();
    return {
      id: docSnapshot.id,
      athleteName: String(data.athleteName ?? ""),
      postId: String(data.postId ?? ""),
      task: String(data.task ?? ""),
      status: data.status === "done" ? "done" : "open",
      createdAt: mapTime(data.createdAt),
    } satisfies VideoReviewTaskRecord;
  });
}

export async function saveCommentaryThread(input: { postId: string; authorName: string; comment: string }) {
  requireUser();
  await addDoc(collection(db!, "commentaryThreads"), {
    postId: input.postId,
    authorName: input.authorName.trim(),
    comment: input.comment.trim(),
    createdAt: serverTimestamp(),
  });
}

export async function getCommentaryThreads(postId: string) {
  if (!db || !postId.trim()) return [];
  const snapshot = await getDocs(query(collection(db, "commentaryThreads"), where("postId", "==", postId), orderBy("createdAt", "desc"), limit(50)));
  return snapshot.docs.map((docSnapshot: { id: string; data: () => Record<string, unknown> }) => {
    const data = docSnapshot.data();
    return {
      id: docSnapshot.id,
      postId: String(data.postId ?? ""),
      authorName: String(data.authorName ?? ""),
      comment: String(data.comment ?? ""),
      createdAt: mapTime(data.createdAt),
    } satisfies CommentaryThreadRecord;
  });
}

export async function savePressCredential(input: { roomId: string; requesterName: string; outlet: string }) {
  requireUser();
  await addDoc(collection(db!, "pressCredentials"), {
    roomId: input.roomId,
    requesterName: input.requesterName.trim(),
    outlet: input.outlet.trim(),
    status: "pending",
    createdAt: serverTimestamp(),
  });
}

export async function getPressCredentials(roomId: string) {
  if (!db || !roomId.trim()) return [];
  const snapshot = await getDocs(query(collection(db, "pressCredentials"), where("roomId", "==", roomId), orderBy("createdAt", "desc"), limit(30)));
  return snapshot.docs.map((docSnapshot: { id: string; data: () => Record<string, unknown> }) => {
    const data = docSnapshot.data();
    return {
      id: docSnapshot.id,
      roomId: String(data.roomId ?? ""),
      requesterName: String(data.requesterName ?? ""),
      outlet: String(data.outlet ?? ""),
      status: data.status === "approved" ? "approved" : "pending",
      createdAt: mapTime(data.createdAt),
    } satisfies PressCredentialRecord;
  });
}

export function getGuidedWorkouts() {
  return [
    { id: "gw1", title: "Pregame Activation", durationMin: 12, type: "guided_workout", summary: "Mobility, foot activation, and controlled acceleration before competition." },
    { id: "gw2", title: "Post-Lift Reset", durationMin: 8, type: "focus_mode", summary: "Breathe down, reset attention, and finish the session calm instead of rushed." },
    { id: "gw3", title: "Sleep Wind-Down", durationMin: 10, type: "meditation", summary: "A quiet recovery track to help you disconnect after late sessions." },
    { id: "gw4", title: "Box Breathing", durationMin: 4, type: "breathwork", summary: "A simple 4-4-4-4 cadence to bring stress and heart rate down." },
  ] as Array<{ id: string; title: string; durationMin: number; type: "guided_workout" | "focus_mode" | "meditation" | "breathwork"; summary: string }>;
}

export function buildSocialHighlightCard(input: { athlete: string; headline: string; stat: string }) {
  return `${input.athlete || "Kinet Athlete"}\n${input.headline || "New highlight drop"}\n${input.stat || "Impact stat goes here"}\nKinet.app`;
}

export function buildGamedayGraphic(input: { matchup: string; tipoff: string; venue: string }) {
  return {
    title: "Gameday Graphic",
    headline: input.matchup || "Team A vs Team B",
    subhead: `${input.tipoff || "7:00 PM"} • ${input.venue || "Home Court"}`,
  };
}

export function buildPrintablePoster(input: { title: string; subtitle: string; callout: string }) {
  return `${input.title || "Kinet Poster"}\n${input.subtitle || "Season spotlight"}\n${input.callout || "Bring energy. Own the moment."}`;
}

export function buildCountdownWidget(input: { label: string; eventDate: string }) {
  const target = new Date(input.eventDate);
  const diff = target.getTime() - Date.now();
  const days = Number.isFinite(diff) ? Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24))) : 0;
  return `${input.label || "Big Event"} starts in ${days} day${days === 1 ? "" : "s"}.`;
}

export function buildReplayEnhancementSummary(durationSec: number) {
  return `Replay enhancement: clip window is ${durationSec}s. Best replay treatment is one quick hook at the start, one teaching moment in the middle, and one clean finish frame for retention.`;
}
