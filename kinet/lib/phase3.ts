import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

import { uploadToFirebaseStorage } from "@/lib/storage";
import { auth, db } from "@/lib/firebase";

export interface ProspectTimelineItem {
  id: string;
  date: string;
  title: string;
  type: "interest" | "offer" | "visit" | "academic" | "family" | "transfer";
  note: string;
}

export interface OfferReminderRecord {
  id: string;
  schoolName: string;
  status: "watching" | "offered" | "accepted" | "expired";
  expiresOn: string;
  packageLabel: string;
}

export interface InterestPipelineRecord {
  id: string;
  schoolName: string;
  stage: "discovered" | "contacted" | "warm" | "serious" | "offer";
  notes: string;
}

export interface PaymentApprovalRecord {
  id: string;
  label: string;
  amountLabel: string;
  status: "pending" | "approved" | "declined";
}

export interface TravelConsentRecord {
  id: string;
  eventName: string;
  travelDate: string;
  guardianName: string;
  status: "pending" | "approved";
}

export interface HousingChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface TutorBookingRecord {
  id: string;
  subject: string;
  tutorName: string;
  scheduledFor: string;
  status: "requested" | "confirmed";
}

export interface ClassScheduleRecord {
  id: string;
  course: string;
  day: string;
  time: string;
}

export interface AttendanceAlertRecord {
  id: string;
  course: string;
  riskLevel: "low" | "medium" | "high";
  note: string;
}

export interface HomeworkRecord {
  id: string;
  course: string;
  task: string;
  dueDate: string;
  done: boolean;
}

export interface StudyHallCheckInRecord {
  id: string;
  date: string;
  durationMinutes: number;
  focus: string;
}

export interface TestPrepRecord {
  id: string;
  exam: "SAT" | "ACT";
  targetScore: string;
  examDate: string;
  status: "planning" | "registered" | "completed";
}

export interface LanguageCertificateRecord {
  id: string;
  label: string;
  issuer: string;
  url: string;
}

export interface TransferPortalRecord {
  id: string;
  schoolName: string;
  status: "monitoring" | "entered" | "committed";
  note: string;
}

export interface TransferInterestBoardRecord {
  id: string;
  athleteName: string;
  currentSchool: string;
  interestLevel: "low" | "medium" | "high";
  note: string;
}

export interface PathwaysProfile {
  family: {
    guardianName: string;
    guardianEmail: string;
    sharedCalendarEmail: string;
    recruitingNotes: string;
    advisorName: string;
    advisorNotes: string;
  };
  timeline: ProspectTimelineItem[];
  offers: OfferReminderRecord[];
  pipeline: InterestPipelineRecord[];
  payments: PaymentApprovalRecord[];
  travelConsents: TravelConsentRecord[];
  housingChecklist: HousingChecklistItem[];
  tutorBookings: TutorBookingRecord[];
  classSchedule: ClassScheduleRecord[];
  attendanceAlerts: AttendanceAlertRecord[];
  homework: HomeworkRecord[];
  studyHall: StudyHallCheckInRecord[];
  testPrep: TestPrepRecord[];
  languageCertificates: LanguageCertificateRecord[];
  transferPortal: TransferPortalRecord[];
  transferBoard: TransferInterestBoardRecord[];
}

const defaultProfile: PathwaysProfile = {
  family: {
    guardianName: "",
    guardianEmail: "",
    sharedCalendarEmail: "",
    recruitingNotes: "",
    advisorName: "",
    advisorNotes: "",
  },
  timeline: [],
  offers: [],
  pipeline: [],
  payments: [],
  travelConsents: [],
  housingChecklist: [
    { id: "housing-1", label: "Shortlist housing options", done: false },
    { id: "housing-2", label: "Review move-in checklist", done: false },
    { id: "housing-3", label: "Confirm roommate and essentials", done: false },
  ],
  tutorBookings: [],
  classSchedule: [],
  attendanceAlerts: [],
  homework: [],
  studyHall: [],
  testPrep: [],
  languageCertificates: [],
  transferPortal: [],
  transferBoard: [],
};

function requireUser() {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in.");
  }
  return auth.currentUser;
}

function randomId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function mapArray<T>(value: unknown, mapper: (item: Record<string, unknown>) => T) {
  return Array.isArray(value) ? value.map((item) => mapper((item as Record<string, unknown>) ?? {})) : [];
}

function mapProfile(data: Record<string, unknown> | null | undefined): PathwaysProfile {
  const family = (data?.family as Record<string, unknown> | undefined) ?? {};

  return {
    family: {
      guardianName: String(family.guardianName ?? ""),
      guardianEmail: String(family.guardianEmail ?? ""),
      sharedCalendarEmail: String(family.sharedCalendarEmail ?? ""),
      recruitingNotes: String(family.recruitingNotes ?? ""),
      advisorName: String(family.advisorName ?? ""),
      advisorNotes: String(family.advisorNotes ?? ""),
    },
    timeline: mapArray(data?.timeline, (item) => ({
      id: String(item.id ?? randomId("timeline")),
      date: String(item.date ?? ""),
      title: String(item.title ?? ""),
      type:
        item.type === "interest" ||
        item.type === "offer" ||
        item.type === "visit" ||
        item.type === "academic" ||
        item.type === "family" ||
        item.type === "transfer"
          ? item.type
          : "interest",
      note: String(item.note ?? ""),
    })),
    offers: mapArray(data?.offers, (item) => ({
      id: String(item.id ?? randomId("offer")),
      schoolName: String(item.schoolName ?? ""),
      status:
        item.status === "offered" || item.status === "accepted" || item.status === "expired"
          ? item.status
          : "watching",
      expiresOn: String(item.expiresOn ?? ""),
      packageLabel: String(item.packageLabel ?? ""),
    })),
    pipeline: mapArray(data?.pipeline, (item) => ({
      id: String(item.id ?? randomId("pipeline")),
      schoolName: String(item.schoolName ?? ""),
      stage:
        item.stage === "contacted" ||
        item.stage === "warm" ||
        item.stage === "serious" ||
        item.stage === "offer"
          ? item.stage
          : "discovered",
      notes: String(item.notes ?? ""),
    })),
    payments: mapArray(data?.payments, (item) => ({
      id: String(item.id ?? randomId("payment")),
      label: String(item.label ?? ""),
      amountLabel: String(item.amountLabel ?? ""),
      status: item.status === "approved" || item.status === "declined" ? item.status : "pending",
    })),
    travelConsents: mapArray(data?.travelConsents, (item) => ({
      id: String(item.id ?? randomId("consent")),
      eventName: String(item.eventName ?? ""),
      travelDate: String(item.travelDate ?? ""),
      guardianName: String(item.guardianName ?? ""),
      status: item.status === "approved" ? "approved" : "pending",
    })),
    housingChecklist: mapArray(data?.housingChecklist, (item) => ({
      id: String(item.id ?? randomId("housing")),
      label: String(item.label ?? ""),
      done: item.done === true,
    })),
    tutorBookings: mapArray(data?.tutorBookings, (item) => ({
      id: String(item.id ?? randomId("tutor")),
      subject: String(item.subject ?? ""),
      tutorName: String(item.tutorName ?? ""),
      scheduledFor: String(item.scheduledFor ?? ""),
      status: item.status === "confirmed" ? "confirmed" : "requested",
    })),
    classSchedule: mapArray(data?.classSchedule, (item) => ({
      id: String(item.id ?? randomId("class")),
      course: String(item.course ?? ""),
      day: String(item.day ?? ""),
      time: String(item.time ?? ""),
    })),
    attendanceAlerts: mapArray(data?.attendanceAlerts, (item) => ({
      id: String(item.id ?? randomId("attendance")),
      course: String(item.course ?? ""),
      riskLevel: item.riskLevel === "medium" || item.riskLevel === "high" ? item.riskLevel : "low",
      note: String(item.note ?? ""),
    })),
    homework: mapArray(data?.homework, (item) => ({
      id: String(item.id ?? randomId("homework")),
      course: String(item.course ?? ""),
      task: String(item.task ?? ""),
      dueDate: String(item.dueDate ?? ""),
      done: item.done === true,
    })),
    studyHall: mapArray(data?.studyHall, (item) => ({
      id: String(item.id ?? randomId("study")),
      date: String(item.date ?? ""),
      durationMinutes: Number(item.durationMinutes ?? 0),
      focus: String(item.focus ?? ""),
    })),
    testPrep: mapArray(data?.testPrep, (item) => ({
      id: String(item.id ?? randomId("test")),
      exam: item.exam === "ACT" ? "ACT" : "SAT",
      targetScore: String(item.targetScore ?? ""),
      examDate: String(item.examDate ?? ""),
      status: item.status === "registered" || item.status === "completed" ? item.status : "planning",
    })),
    languageCertificates: mapArray(data?.languageCertificates, (item) => ({
      id: String(item.id ?? randomId("lang")),
      label: String(item.label ?? ""),
      issuer: String(item.issuer ?? ""),
      url: String(item.url ?? ""),
    })),
    transferPortal: mapArray(data?.transferPortal, (item) => ({
      id: String(item.id ?? randomId("portal")),
      schoolName: String(item.schoolName ?? ""),
      status: item.status === "entered" || item.status === "committed" ? item.status : "monitoring",
      note: String(item.note ?? ""),
    })),
    transferBoard: mapArray(data?.transferBoard, (item) => ({
      id: String(item.id ?? randomId("board")),
      athleteName: String(item.athleteName ?? ""),
      currentSchool: String(item.currentSchool ?? ""),
      interestLevel:
        item.interestLevel === "low" || item.interestLevel === "high" ? item.interestLevel : "medium",
      note: String(item.note ?? ""),
    })),
  };
}

export async function getCurrentPathwaysProfile() {
  requireUser();
  const snapshot = await getDoc(doc(db!, "pathwaysProfiles", auth!.currentUser!.uid));
  return snapshot.exists() ? mapProfile(snapshot.data() as Record<string, unknown>) : defaultProfile;
}

export async function saveCurrentPathwaysProfile(profile: PathwaysProfile) {
  requireUser();
  await setDoc(
    doc(db!, "pathwaysProfiles", auth!.currentUser!.uid),
    {
      ...profile,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function uploadLanguageCertificate(file: File, label: string, issuer: string) {
  requireUser();
  const upload = await uploadToFirebaseStorage(file, `Kinet/pathways/language/${auth!.currentUser!.uid}`);
  const current = await getCurrentPathwaysProfile();
  current.languageCertificates.unshift({
    id: randomId("lang"),
    label: label.trim() || file.name,
    issuer: issuer.trim(),
    url: upload.url,
  });
  await saveCurrentPathwaysProfile(current);
}

export async function addPathwaysItem<
  K extends "timeline" | "offers" | "pipeline" | "payments" | "travelConsents" | "housingChecklist" | "tutorBookings" | "classSchedule" | "attendanceAlerts" | "homework" | "studyHall" | "testPrep" | "transferPortal" | "transferBoard"
>(key: K, item: PathwaysProfile[K][number]) {
  requireUser();
  const current = await getCurrentPathwaysProfile();
  (current[key] as Array<unknown>).unshift(item);
  await saveCurrentPathwaysProfile(current);
}

export async function toggleChecklistItem(itemId: string, done: boolean) {
  requireUser();
  const current = await getCurrentPathwaysProfile();
  current.housingChecklist = current.housingChecklist.map((item) => (item.id === itemId ? { ...item, done } : item));
  await saveCurrentPathwaysProfile(current);
}

export async function toggleHomeworkItem(itemId: string, done: boolean) {
  requireUser();
  const current = await getCurrentPathwaysProfile();
  current.homework = current.homework.map((item) => (item.id === itemId ? { ...item, done } : item));
  await saveCurrentPathwaysProfile(current);
}

export function getOfferExpirationWarnings(profile: PathwaysProfile) {
  return profile.offers
    .filter((offer) => offer.status !== "accepted")
    .map((offer) => {
      const diff = offer.expiresOn ? Math.ceil((new Date(offer.expiresOn).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
      return {
        ...offer,
        daysRemaining: diff,
      };
    })
    .sort((left, right) => (left.daysRemaining ?? 9999) - (right.daysRemaining ?? 9999));
}

export function getInternationalRecruiterMatches() {
  return [
    { id: "intl-1", region: "Europe", org: "Rising Hoops Europe", note: "Looks for academically stable guards and wings." },
    { id: "intl-2", region: "Canada", org: "North Circuit Recruiting", note: "Strong fit for athletes with two-way film and good school discipline." },
    { id: "intl-3", region: "Middle East", org: "Global Academy Pathways", note: "Interested in international-ready athletes with language documentation prepared." },
  ];
}

export function getBoardingSchoolOptions() {
  return [
    { id: "board-1", name: "North Ridge Academy", focus: "Prep basketball and academic support", region: "US Northeast" },
    { id: "board-2", name: "Summit International School", focus: "International athlete transition and SAT prep", region: "Canada" },
    { id: "board-3", name: "Coastal Prep Institute", focus: "Boarding plus college placement support", region: "US South" },
  ];
}
