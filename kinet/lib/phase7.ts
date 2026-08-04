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

export interface LiveRoomRecord {
  id: string;
  hostId: string;
  title: string;
  teamId?: string | null;
  sponsorLabel?: string | null;
  scoreOverlay?: string | null;
  paidTicketLabel?: string | null;
  status: "live" | "ended";
  createdAt?: { seconds?: number; nanoseconds?: number } | null;
}

export interface LiveChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  text: string;
  pinned?: boolean;
  createdAt?: { seconds?: number; nanoseconds?: number } | null;
}

export interface ReplayClipRecord {
  id: string;
  roomId: string;
  title: string;
  startSec: number;
  endSec: number;
  createdAt?: { seconds?: number; nanoseconds?: number } | null;
}

export interface LiveQuestionRecord {
  id: string;
  roomId: string;
  askerName: string;
  question: string;
  answered: boolean;
  createdAt?: { seconds?: number; nanoseconds?: number } | null;
}

export interface AudioSpaceRecord {
  id: string;
  teamId: string;
  title: string;
  topic: string;
  status: "scheduled" | "live" | "ended";
}

export interface PodcastEpisodeRecord {
  id: string;
  creatorId: string;
  title: string;
  summary: string;
  audioUrl: string;
  guestName?: string | null;
  chapters: Array<{ title: string; minuteMark: number }>;
  createdAt?: { seconds?: number; nanoseconds?: number } | null;
}

export interface GuestSlotRecord {
  id: string;
  creatorId: string;
  guestUid: string;
  guestName: string;
  scheduledFor: string;
  notes: string;
}

export interface AnonymousFeedbackRecord {
  id: string;
  teamId: string;
  message: string;
  createdAt?: { seconds?: number; nanoseconds?: number } | null;
}

export interface PostgameReflectionRecord {
  id: string;
  teamId: string;
  eventId: string;
  userId: string;
  reflection: string;
  createdAt?: { seconds?: number; nanoseconds?: number } | null;
}

export interface VoteRecord {
  id: string;
  scope: "mvp" | "award";
  teamId: string;
  title: string;
  candidateNames: string[];
  votesByUser: Record<string, string>;
}

export interface PredictionContestRecord {
  id: string;
  teamId: string;
  prompt: string;
  options: string[];
  picksByUser: Record<string, string>;
}

export interface FantasyLeagueRecord {
  id: string;
  teamId: string;
  name: string;
  members: string[];
  scoringRule: string;
}

export async function createLiveRoom(input: {
  title: string;
  teamId?: string;
  sponsorLabel?: string;
  scoreOverlay?: string;
  paidTicketLabel?: string;
}) {
  const user = requireUser();
  const roomRef = await addDoc(collection(db!, "liveRooms"), {
    hostId: user.uid,
    title: input.title.trim(),
    teamId: input.teamId?.trim() || null,
    sponsorLabel: input.sponsorLabel?.trim() || null,
    scoreOverlay: input.scoreOverlay?.trim() || null,
    paidTicketLabel: input.paidTicketLabel?.trim() || null,
    status: "live",
    createdAt: serverTimestamp(),
  });
  const hostSnapshot = await getDoc(doc(db!, "users", user.uid));
  const followers = hostSnapshot.exists() && Array.isArray(hostSnapshot.data().followers) ? hostSnapshot.data().followers as string[] : [];
  await Promise.all(followers.slice(0, 100).map((recipientId) => createNotification({ type: "live", recipientId, actorId: user.uid, actorName: user.displayName || "Someone", actorAvatar: user.photoURL || "", message: `${user.displayName || "Someone"} started a live stream: ${input.title.trim()}`, targetUrl: `/live?room=${roomRef.id}` }).catch(() => undefined)));
}

export async function getLiveRooms() {
  if (!db) return [];
  const snapshot = await getDocs(query(collection(db, "liveRooms"), orderBy("createdAt", "desc"), limit(30)));
  return snapshot.docs.map((docSnapshot: { id: string; data: () => Record<string, unknown> }) => {
    const data = docSnapshot.data();
    return {
      id: docSnapshot.id,
      hostId: String(data.hostId ?? ""),
      title: String(data.title ?? ""),
      teamId: data.teamId ? String(data.teamId) : null,
      sponsorLabel: data.sponsorLabel ? String(data.sponsorLabel) : null,
      scoreOverlay: data.scoreOverlay ? String(data.scoreOverlay) : null,
      paidTicketLabel: data.paidTicketLabel ? String(data.paidTicketLabel) : null,
      status: data.status === "ended" ? "ended" : "live",
      createdAt: mapTime(data.createdAt),
    } satisfies LiveRoomRecord;
  });
}

export async function endLiveRoom(roomId: string) {
  requireUser();
  await setDoc(doc(db!, "liveRooms", roomId), { status: "ended", updatedAt: serverTimestamp() }, { merge: true });
}

export async function sendLiveChatMessage(roomId: string, text: string) {
  const user = requireUser();
  await addDoc(collection(db!, "liveChatMessages"), {
    roomId,
    senderId: user.uid,
    senderName: user.displayName || "Kinet User",
    text: text.trim(),
    pinned: false,
    createdAt: serverTimestamp(),
  });
}

export function subscribeToLiveChat(roomId: string, callback: (messages: LiveChatMessage[]) => void): ListenerCleanup {
  if (!db) {
    callback([]);
    return () => undefined;
  }
  return onSnapshot(
    query(collection(db, "liveChatMessages"), where("roomId", "==", roomId), orderBy("createdAt", "asc"), limit(100)),
    (snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => {
      callback(
        snapshot.docs.map((docSnapshot) => {
          const data = docSnapshot.data();
          return {
            id: docSnapshot.id,
            roomId: String(data.roomId ?? ""),
            senderId: String(data.senderId ?? ""),
            senderName: String(data.senderName ?? ""),
            text: String(data.text ?? ""),
            pinned: data.pinned === true,
            createdAt: mapTime(data.createdAt),
          } satisfies LiveChatMessage;
        })
      );
    }
  );
}

export async function pinLiveComment(messageId: string, pinned: boolean) {
  requireUser();
  await setDoc(doc(db!, "liveChatMessages", messageId), { pinned, updatedAt: serverTimestamp() }, { merge: true });
}

export async function createReplayClip(input: { roomId: string; title: string; startSec: number; endSec: number }) {
  requireUser();
  await addDoc(collection(db!, "replayClips"), {
    roomId: input.roomId,
    title: input.title.trim(),
    startSec: input.startSec,
    endSec: input.endSec,
    createdAt: serverTimestamp(),
  });
}

export async function getReplayClips(roomId: string) {
  if (!db) return [];
  const snapshot = await getDocs(query(collection(db, "replayClips"), where("roomId", "==", roomId), orderBy("createdAt", "desc"), limit(50)));
  return snapshot.docs.map((docSnapshot: { id: string; data: () => Record<string, unknown> }) => {
    const data = docSnapshot.data();
    return {
      id: docSnapshot.id,
      roomId: String(data.roomId ?? ""),
      title: String(data.title ?? ""),
      startSec: Number(data.startSec ?? 0),
      endSec: Number(data.endSec ?? 0),
      createdAt: mapTime(data.createdAt),
    } satisfies ReplayClipRecord;
  });
}

export async function askLiveQuestion(roomId: string, question: string) {
  const user = requireUser();
  await addDoc(collection(db!, "liveQuestions"), {
    roomId,
    askerName: user.displayName || "Fan",
    question: question.trim(),
    answered: false,
    createdAt: serverTimestamp(),
  });
}

export async function getLiveQuestions(roomId: string) {
  if (!db) return [];
  const snapshot = await getDocs(query(collection(db, "liveQuestions"), where("roomId", "==", roomId), orderBy("createdAt", "desc"), limit(50)));
  return snapshot.docs.map((docSnapshot: { id: string; data: () => Record<string, unknown> }) => {
    const data = docSnapshot.data();
    return {
      id: docSnapshot.id,
      roomId: String(data.roomId ?? ""),
      askerName: String(data.askerName ?? ""),
      question: String(data.question ?? ""),
      answered: data.answered === true,
      createdAt: mapTime(data.createdAt),
    } satisfies LiveQuestionRecord;
  });
}

export async function createAudioSpace(input: { teamId: string; title: string; topic: string }) {
  requireUser();
  await addDoc(collection(db!, "audioSpaces"), {
    teamId: input.teamId,
    title: input.title.trim(),
    topic: input.topic.trim(),
    status: "scheduled",
    createdAt: serverTimestamp(),
  });
}

export async function getAudioSpaces(teamId: string) {
  if (!db) return [];
  const snapshot = await getDocs(query(collection(db, "audioSpaces"), where("teamId", "==", teamId), limit(50)));
  return snapshot.docs.map((docSnapshot: { id: string; data: () => Record<string, unknown> }) => ({
    id: docSnapshot.id,
    teamId: String(docSnapshot.data().teamId ?? ""),
    title: String(docSnapshot.data().title ?? ""),
    topic: String(docSnapshot.data().topic ?? ""),
    status: docSnapshot.data().status === "live" || docSnapshot.data().status === "ended" ? docSnapshot.data().status : "scheduled",
  })) as AudioSpaceRecord[];
}

export async function publishPodcastEpisode(input: {
  title: string;
  summary: string;
  audioUrl: string;
  guestName?: string;
  chapters?: Array<{ title: string; minuteMark: number }>;
}) {
  const user = requireUser();
  await addDoc(collection(db!, "podcastEpisodes"), {
    creatorId: user.uid,
    title: input.title.trim(),
    summary: input.summary.trim(),
    audioUrl: input.audioUrl.trim(),
    guestName: input.guestName?.trim() || null,
    chapters: input.chapters ?? [],
    createdAt: serverTimestamp(),
  });
}

export async function getPodcastEpisodes(creatorId?: string) {
  if (!db) return [];
  const constraints = creatorId
    ? [where("creatorId", "==", creatorId), orderBy("createdAt", "desc"), limit(50)] as const
    : [orderBy("createdAt", "desc"), limit(50)] as const;
  const snapshot = await getDocs(query(collection(db, "podcastEpisodes"), ...constraints));
  return snapshot.docs.map((docSnapshot: { id: string; data: () => Record<string, unknown> }) => {
    const data = docSnapshot.data();
    return {
      id: docSnapshot.id,
      creatorId: String(data.creatorId ?? ""),
      title: String(data.title ?? ""),
      summary: String(data.summary ?? ""),
      audioUrl: String(data.audioUrl ?? ""),
      guestName: data.guestName ? String(data.guestName) : null,
      chapters: Array.isArray(data.chapters) ? (data.chapters as Array<{ title: string; minuteMark: number }>) : [],
      createdAt: mapTime(data.createdAt),
    } satisfies PodcastEpisodeRecord;
  });
}

export async function scheduleGuestCoHost(input: { guestUid: string; guestName: string; scheduledFor: string; notes: string }) {
  const user = requireUser();
  await addDoc(collection(db!, "guestSlots"), {
    creatorId: user.uid,
    guestUid: input.guestUid,
    guestName: input.guestName,
    scheduledFor: input.scheduledFor,
    notes: input.notes.trim(),
    createdAt: serverTimestamp(),
  });
}

export async function getGuestSlots() {
  if (!auth?.currentUser || !db) return [];
  const snapshot = await getDocs(query(collection(db, "guestSlots"), where("creatorId", "==", auth.currentUser.uid), limit(50)));
  return snapshot.docs.map((docSnapshot: { id: string; data: () => Record<string, unknown> }) => ({
    id: docSnapshot.id,
    creatorId: String(docSnapshot.data().creatorId ?? ""),
    guestUid: String(docSnapshot.data().guestUid ?? ""),
    guestName: String(docSnapshot.data().guestName ?? ""),
    scheduledFor: String(docSnapshot.data().scheduledFor ?? ""),
    notes: String(docSnapshot.data().notes ?? ""),
  })) as GuestSlotRecord[];
}

export async function submitAnonymousFeedback(teamId: string, message: string) {
  await addDoc(collection(db!, "anonymousTeamFeedback"), {
    teamId,
    message: message.trim(),
    createdAt: serverTimestamp(),
  });
}

export async function getAnonymousFeedback(teamId: string) {
  if (!db) return [];
  const snapshot = await getDocs(query(collection(db, "anonymousTeamFeedback"), where("teamId", "==", teamId), orderBy("createdAt", "desc"), limit(50)));
  return snapshot.docs.map((docSnapshot: { id: string; data: () => Record<string, unknown> }) => ({
    id: docSnapshot.id,
    teamId: String(docSnapshot.data().teamId ?? ""),
    message: String(docSnapshot.data().message ?? ""),
    createdAt: mapTime(docSnapshot.data().createdAt),
  })) as AnonymousFeedbackRecord[];
}

export async function addPostgameReflection(teamId: string, eventId: string, reflection: string) {
  const user = requireUser();
  await addDoc(collection(db!, "postgameReflections"), {
    teamId,
    eventId,
    userId: user.uid,
    reflection: reflection.trim(),
    createdAt: serverTimestamp(),
  });
}

export async function getPostgameReflections(teamId: string) {
  if (!db) return [];
  const snapshot = await getDocs(query(collection(db, "postgameReflections"), where("teamId", "==", teamId), orderBy("createdAt", "desc"), limit(50)));
  return snapshot.docs.map((docSnapshot: { id: string; data: () => Record<string, unknown> }) => ({
    id: docSnapshot.id,
    teamId: String(docSnapshot.data().teamId ?? ""),
    eventId: String(docSnapshot.data().eventId ?? ""),
    userId: String(docSnapshot.data().userId ?? ""),
    reflection: String(docSnapshot.data().reflection ?? ""),
    createdAt: mapTime(docSnapshot.data().createdAt),
  })) as PostgameReflectionRecord[];
}

export async function createVote(input: { scope: "mvp" | "award"; teamId: string; title: string; candidateNames: string[] }) {
  requireUser();
  await addDoc(collection(db!, "teamVotes"), {
    scope: input.scope,
    teamId: input.teamId,
    title: input.title.trim(),
    candidateNames: input.candidateNames,
    votesByUser: {},
    createdAt: serverTimestamp(),
  });
}

export async function castVote(voteId: string, candidateName: string) {
  const user = requireUser();
  await setDoc(doc(db!, "teamVotes", voteId), { [`votesByUser.${user.uid}`]: candidateName }, { merge: true });
}

export async function getVotes(teamId: string, scope?: "mvp" | "award") {
  if (!db) return [];
  const base = query(collection(db, "teamVotes"), where("teamId", "==", teamId), limit(50));
  const snapshot = await getDocs(base);
  return snapshot.docs
    .map((docSnapshot: { id: string; data: () => Record<string, unknown> }) => {
      const data = docSnapshot.data();
      return {
        id: docSnapshot.id,
        scope: data.scope === "award" ? "award" : "mvp",
        teamId: String(data.teamId ?? ""),
        title: String(data.title ?? ""),
        candidateNames: Array.isArray(data.candidateNames) ? (data.candidateNames as string[]) : [],
        votesByUser: (data.votesByUser as Record<string, string> | undefined) ?? {},
      } satisfies VoteRecord;
    })
    .filter((vote: VoteRecord) => !scope || vote.scope === scope);
}

export async function createPredictionContest(input: { teamId: string; prompt: string; options: string[] }) {
  requireUser();
  await addDoc(collection(db!, "predictionContests"), {
    teamId: input.teamId,
    prompt: input.prompt.trim(),
    options: input.options,
    picksByUser: {},
    createdAt: serverTimestamp(),
  });
}

export async function pickPrediction(contestId: string, option: string) {
  const user = requireUser();
  await setDoc(doc(db!, "predictionContests", contestId), { [`picksByUser.${user.uid}`]: option }, { merge: true });
}

export async function getPredictionContests(teamId: string) {
  if (!db) return [];
  const snapshot = await getDocs(query(collection(db, "predictionContests"), where("teamId", "==", teamId), limit(50)));
  return snapshot.docs.map((docSnapshot: { id: string; data: () => Record<string, unknown> }) => ({
    id: docSnapshot.id,
    teamId: String(docSnapshot.data().teamId ?? ""),
    prompt: String(docSnapshot.data().prompt ?? ""),
    options: Array.isArray(docSnapshot.data().options) ? (docSnapshot.data().options as string[]) : [],
    picksByUser: (docSnapshot.data().picksByUser as Record<string, string> | undefined) ?? {},
  })) as PredictionContestRecord[];
}

export async function createFantasyLeague(input: { teamId: string; name: string; scoringRule: string }) {
  const user = requireUser();
  await addDoc(collection(db!, "fantasyLeagues"), {
    teamId: input.teamId,
    name: input.name.trim(),
    scoringRule: input.scoringRule.trim(),
    members: [user.uid],
    createdAt: serverTimestamp(),
  });
}

export async function getFantasyLeagues(teamId: string) {
  if (!db) return [];
  const snapshot = await getDocs(query(collection(db, "fantasyLeagues"), where("teamId", "==", teamId), limit(50)));
  return snapshot.docs.map((docSnapshot: { id: string; data: () => Record<string, unknown> }) => ({
    id: docSnapshot.id,
    teamId: String(docSnapshot.data().teamId ?? ""),
    name: String(docSnapshot.data().name ?? ""),
    members: Array.isArray(docSnapshot.data().members) ? (docSnapshot.data().members as string[]) : [],
    scoringRule: String(docSnapshot.data().scoringRule ?? ""),
  })) as FantasyLeagueRecord[];
}
