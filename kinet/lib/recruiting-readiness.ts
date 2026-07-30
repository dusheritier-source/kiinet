import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";

import { uploadToFirebaseStorage } from "@/lib/storage";
import { auth, db } from "@/lib/firebase";
import { getUserProfileById } from "@/lib/user-profile";

export interface RecruitingDeadlineRecord {
  id: string;
  title: string;
  dueDate: string;
  category: string;
}

export interface CollegeInterestRecord {
  id: string;
  schoolName: string;
  level: "low" | "medium" | "high";
  notes: string;
}

export interface CampusVisitRecord {
  id: string;
  schoolName: string;
  date: string;
  notes: string;
}

export interface RecommendationRequestRecord {
  id: string;
  coachName: string;
  coachEmail: string;
  status: "draft" | "sent" | "received";
  note: string;
}

export interface ReferenceLetterRecord {
  id: string;
  title: string;
  url: string;
  authorName: string;
}

export interface ScholarshipRecord {
  id: string;
  schoolName: string;
  amountLabel: string;
  status: "target" | "offered" | "accepted";
}

export interface OfferRecord {
  id: string;
  schoolName: string;
  level: string;
  packageLabel: string;
  status: "interested" | "offered" | "committed";
}

export interface ContactLogRecord {
  id: string;
  schoolName: string;
  contactName: string;
  channel: string;
  date: string;
  summary: string;
}

export interface OutreachTemplateRecord {
  id: string;
  name: string;
  subject: string;
  body: string;
}

export interface FollowUpReminderRecord {
  id: string;
  schoolName: string;
  dueDate: string;
  note: string;
  done: boolean;
}

export interface RecruitingReadinessProfile {
  academic: {
    gpa: string;
    graduationYear: string;
    eligibilityStatus: string;
    transcriptUrl: string;
    transcriptName: string;
    academicSummary: string;
  };
  compliance: {
    ncaaChecklist: Array<{ label: string; done: boolean }>;
    naiaChecklist: Array<{ label: string; done: boolean }>;
    internationalDocs: Array<{ label: string; done: boolean }>;
    visaChecklist: Array<{ label: string; done: boolean }>;
  };
  deadlines: RecruitingDeadlineRecord[];
  interests: CollegeInterestRecord[];
  campusVisits: CampusVisitRecord[];
  recommendationRequests: RecommendationRequestRecord[];
  referenceLetters: ReferenceLetterRecord[];
  scholarships: ScholarshipRecord[];
  offers: OfferRecord[];
  contacts: ContactLogRecord[];
  outreachTemplates: OutreachTemplateRecord[];
  followUps: FollowUpReminderRecord[];
}

const defaultProfile: RecruitingReadinessProfile = {
  academic: {
    gpa: "",
    graduationYear: "",
    eligibilityStatus: "",
    transcriptUrl: "",
    transcriptName: "",
    academicSummary: "",
  },
  compliance: {
    ncaaChecklist: [
      { label: "Core course review", done: false },
      { label: "Eligibility center account", done: false },
      { label: "Test / academic records submitted", done: false },
    ],
    naiaChecklist: [
      { label: "PlayNAIA registration", done: false },
      { label: "Transcripts submitted", done: false },
      { label: "Eligibility review complete", done: false },
    ],
    internationalDocs: [
      { label: "Passport valid", done: false },
      { label: "Academic translation ready", done: false },
      { label: "International records verified", done: false },
    ],
    visaChecklist: [
      { label: "Visa document packet started", done: false },
      { label: "School support letter requested", done: false },
      { label: "Interview prep complete", done: false },
    ],
  },
  deadlines: [],
  interests: [],
  campusVisits: [],
  recommendationRequests: [],
  referenceLetters: [],
  scholarships: [],
  offers: [],
  contacts: [],
  outreachTemplates: [],
  followUps: [],
};

function requireAuth() {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in.");
  }
}

function randomId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeChecklist(input: unknown, fallback: RecruitingReadinessProfile["compliance"]["ncaaChecklist"]) {
  if (!Array.isArray(input)) {
    return fallback;
  }
  return input.map((item) => {
    const record = (item as Record<string, unknown>) ?? {};
    return {
      label: String(record.label ?? ""),
      done: record.done === true,
    };
  });
}

function mapProfile(data: Record<string, unknown> | null | undefined): RecruitingReadinessProfile {
  const academic = (data?.academic as Record<string, unknown> | undefined) ?? {};
  const compliance = (data?.compliance as Record<string, unknown> | undefined) ?? {};
  const mapArray = <T>(value: unknown, mapper: (item: Record<string, unknown>) => T): T[] =>
    Array.isArray(value) ? value.map((item) => mapper((item as Record<string, unknown>) ?? {})) : [];

  return {
    academic: {
      gpa: String(academic.gpa ?? ""),
      graduationYear: String(academic.graduationYear ?? ""),
      eligibilityStatus: String(academic.eligibilityStatus ?? ""),
      transcriptUrl: String(academic.transcriptUrl ?? ""),
      transcriptName: String(academic.transcriptName ?? ""),
      academicSummary: String(academic.academicSummary ?? ""),
    },
    compliance: {
      ncaaChecklist: normalizeChecklist(compliance.ncaaChecklist, defaultProfile.compliance.ncaaChecklist),
      naiaChecklist: normalizeChecklist(compliance.naiaChecklist, defaultProfile.compliance.naiaChecklist),
      internationalDocs: normalizeChecklist(compliance.internationalDocs, defaultProfile.compliance.internationalDocs),
      visaChecklist: normalizeChecklist(compliance.visaChecklist, defaultProfile.compliance.visaChecklist),
    },
    deadlines: mapArray(data?.deadlines, (item) => ({
      id: String(item.id ?? randomId("deadline")),
      title: String(item.title ?? ""),
      dueDate: String(item.dueDate ?? ""),
      category: String(item.category ?? ""),
    })),
    interests: mapArray(data?.interests, (item) => ({
      id: String(item.id ?? randomId("interest")),
      schoolName: String(item.schoolName ?? ""),
      level: item.level === "high" || item.level === "low" ? item.level : "medium",
      notes: String(item.notes ?? ""),
    })),
    campusVisits: mapArray(data?.campusVisits, (item) => ({
      id: String(item.id ?? randomId("visit")),
      schoolName: String(item.schoolName ?? ""),
      date: String(item.date ?? ""),
      notes: String(item.notes ?? ""),
    })),
    recommendationRequests: mapArray(data?.recommendationRequests, (item) => ({
      id: String(item.id ?? randomId("rec")),
      coachName: String(item.coachName ?? ""),
      coachEmail: String(item.coachEmail ?? ""),
      status: item.status === "sent" || item.status === "received" ? item.status : "draft",
      note: String(item.note ?? ""),
    })),
    referenceLetters: mapArray(data?.referenceLetters, (item) => ({
      id: String(item.id ?? randomId("ref")),
      title: String(item.title ?? ""),
      url: String(item.url ?? ""),
      authorName: String(item.authorName ?? ""),
    })),
    scholarships: mapArray(data?.scholarships, (item) => ({
      id: String(item.id ?? randomId("sch")),
      schoolName: String(item.schoolName ?? ""),
      amountLabel: String(item.amountLabel ?? ""),
      status: item.status === "offered" || item.status === "accepted" ? item.status : "target",
    })),
    offers: mapArray(data?.offers, (item) => ({
      id: String(item.id ?? randomId("offer")),
      schoolName: String(item.schoolName ?? ""),
      level: String(item.level ?? ""),
      packageLabel: String(item.packageLabel ?? ""),
      status: item.status === "offered" || item.status === "committed" ? item.status : "interested",
    })),
    contacts: mapArray(data?.contacts, (item) => ({
      id: String(item.id ?? randomId("contact")),
      schoolName: String(item.schoolName ?? ""),
      contactName: String(item.contactName ?? ""),
      channel: String(item.channel ?? ""),
      date: String(item.date ?? ""),
      summary: String(item.summary ?? ""),
    })),
    outreachTemplates: mapArray(data?.outreachTemplates, (item) => ({
      id: String(item.id ?? randomId("template")),
      name: String(item.name ?? ""),
      subject: String(item.subject ?? ""),
      body: String(item.body ?? ""),
    })),
    followUps: mapArray(data?.followUps, (item) => ({
      id: String(item.id ?? randomId("follow")),
      schoolName: String(item.schoolName ?? ""),
      dueDate: String(item.dueDate ?? ""),
      note: String(item.note ?? ""),
      done: item.done === true,
    })),
  };
}

export async function getCurrentRecruitingReadiness() {
  requireAuth();
  const snapshot = await getDoc(doc(db!, "recruitingReadiness", auth!.currentUser!.uid));
  return snapshot.exists() ? mapProfile(snapshot.data() as Record<string, unknown>) : defaultProfile;
}

export async function saveCurrentRecruitingReadiness(profile: RecruitingReadinessProfile) {
  requireAuth();
  await setDoc(
    doc(db!, "recruitingReadiness", auth!.currentUser!.uid),
    {
      ...profile,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function uploadTranscript(file: File, title: string) {
  requireAuth();
  const upload = await uploadToFirebaseStorage(file, `Kinet/recruiting/transcripts/${auth!.currentUser!.uid}`);
  const current = await getCurrentRecruitingReadiness();
  current.academic.transcriptUrl = upload.url;
  current.academic.transcriptName = title.trim() || file.name;
  await saveCurrentRecruitingReadiness(current);
}

export async function addReferenceLetter(file: File, title: string, authorName: string) {
  requireAuth();
  const upload = await uploadToFirebaseStorage(file, `Kinet/recruiting/references/${auth!.currentUser!.uid}`);
  const current = await getCurrentRecruitingReadiness();
  current.referenceLetters.unshift({
    id: randomId("ref"),
    title: title.trim() || file.name,
    url: upload.url,
    authorName: authorName.trim(),
  });
  await saveCurrentRecruitingReadiness(current);
}

export async function addRecruitingCollectionItem<
  K extends "deadlines" | "interests" | "campusVisits" | "recommendationRequests" | "scholarships" | "offers" | "contacts" | "outreachTemplates" | "followUps"
>(key: K, item: RecruitingReadinessProfile[K][number]) {
  requireAuth();
  const current = await getCurrentRecruitingReadiness();
  (current[key] as Array<unknown>).unshift(item);
  await saveCurrentRecruitingReadiness(current);
}

export async function updateRecruitingChecklist(
  key: keyof RecruitingReadinessProfile["compliance"],
  index: number,
  done: boolean
) {
  requireAuth();
  const current = await getCurrentRecruitingReadiness();
  const nextChecklist = [...current.compliance[key]];
  nextChecklist[index] = { ...nextChecklist[index], done };
  current.compliance[key] = nextChecklist;
  await saveCurrentRecruitingReadiness(current);
}

export async function updateFollowUpStatus(followUpId: string, done: boolean) {
  requireAuth();
  const current = await getCurrentRecruitingReadiness();
  current.followUps = current.followUps.map((item) =>
    item.id === followUpId ? { ...item, done } : item
  );
  await saveCurrentRecruitingReadiness(current);
}

export async function getPublicResumeData(uid: string) {
  if (!db) {
    return null;
  }
  const [profile, readinessSnapshot] = await Promise.all([
    getUserProfileById(uid),
    getDoc(doc(db, "recruitingReadiness", uid)),
  ]);
  return {
    profile,
    readiness: readinessSnapshot.exists()
      ? mapProfile(readinessSnapshot.data() as Record<string, unknown>)
      : defaultProfile,
  };
}

export function getRecruitingInterestHeatmap(profile: RecruitingReadinessProfile) {
  return profile.interests
    .map((item) => ({
      schoolName: item.schoolName,
      score: item.level === "high" ? 3 : item.level === "medium" ? 2 : 1,
      notes: item.notes,
    }))
    .sort((left, right) => right.score - left.score);
}

export function getSchoolFitScores(
  profile: RecruitingReadinessProfile,
  athleteProfile: Record<string, unknown> | null | undefined
) {
  const stats = ((athleteProfile?.stats as Record<string, unknown> | undefined) ?? {});
  const points = Number(stats.pointsPerGame ?? 0);
  const assists = Number(stats.assistsPerGame ?? 0);
  const rebounds = Number(stats.reboundsPerGame ?? 0);
  return profile.interests.map((school) => {
    const fitScore =
      (school.level === "high" ? 70 : school.level === "medium" ? 55 : 40) +
      Math.min(points * 2, 10) +
      Math.min(assists + rebounds, 10);
    return {
      schoolName: school.schoolName,
      fitScore: Math.min(99, Math.round(fitScore)),
      notes: school.notes,
    };
  });
}

export async function generateRecruitingFitSummary(input: {
  schoolName: string;
  athleteBio: string;
  sport: string;
  position: string;
  achievements: string[];
}) {
  const fallback = `${input.schoolName} fit looks strongest when you position yourself as a ${input.position || input.sport} with clear role value, verified academics, and recent achievement proof. Lead with one stat, one impact clip, and one reason that school matches your long-term development path.`;

  if (!process.env.OPENAI_API_KEY) {
    return fallback;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.2",
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: "You write concise recruiting fit summaries for student-athletes." }],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `School: ${input.schoolName}\nSport: ${input.sport}\nPosition: ${input.position}\nBio: ${input.athleteBio}\nAchievements: ${input.achievements.join(", ") || "None"}\n\nWrite 2-3 sentences on recruiting fit and what the athlete should emphasize.`,
              },
            ],
          },
        ],
      }),
    });
    const data = (await response.json().catch(() => ({}))) as { output_text?: string };
    return data.output_text || fallback;
  } catch {
    return fallback;
  }
}

export async function getSchoolResumeIndex() {
  if (!db) {
    return [];
  }
  const snapshot = await getDocs(query(collection(db, "recruitingReadiness"), limit(100)));
  return snapshot.docs.map((docSnapshot: { id: string; data: () => Record<string, unknown> }) => ({
    uid: docSnapshot.id,
    readiness: mapProfile(docSnapshot.data() as Record<string, unknown>),
  }));
}
