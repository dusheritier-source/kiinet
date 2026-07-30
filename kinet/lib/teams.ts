import {
  addDoc,
  arrayUnion,
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
import { uploadToFirebaseStorage } from "@/lib/storage";
import { createNotification } from "@/lib/notifications";

export interface TeamMember {
  uid: string;
  role: "owner" | "admin" | "coach" | "captain" | "player";
  displayName: string;
  orgPermissions?: Array<"manage_roster" | "manage_events" | "manage_content" | "manage_recruiting">;
}

export interface TeamRecord {
  id: string;
  ownerId: string;
  adminIds: string[];
  name: string;
  sport: string;
  location: string;
  bio: string;
  memberIds: string[];
  members: TeamMember[];
  announcement?: string;
  createdAt?: { seconds?: number; nanoseconds?: number } | null;
}

export interface TeamInvite {
  id: string;
  teamId: string;
  teamName: string;
  inviterId: string;
  inviteeUid: string;
  role: TeamMember["role"];
  status: "pending" | "accepted" | "declined";
}

export interface TeamEvent {
  id: string;
  teamId: string;
  title: string;
  date: string;
  location: string;
  type: "practice" | "game" | "meeting" | "tryout";
  rsvpBy?: Record<string, "going" | "maybe" | "not_going">;
  remindersSentAt?: { seconds?: number; nanoseconds?: number } | null;
}

export interface TeamTryout {
  id: string;
  teamId: string;
  name: string;
  position: string;
  message: string;
  status: "pending" | "reviewed";
}

export interface TeamPost {
  id: string;
  teamId: string;
  authorId: string;
  content: string;
  type: "announcement" | "feed";
  pinned?: boolean;
  createdAt?: { seconds?: number; nanoseconds?: number } | null;
}

export interface TeamChatRoom {
  id: string;
  teamId: string;
  name: string;
  createdAt?: { seconds?: number; nanoseconds?: number } | null;
}

export interface TeamChatMessage {
  id: string;
  roomId: string;
  teamId: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt?: { seconds?: number; nanoseconds?: number } | null;
}

export interface TeamAttendanceRecord {
  id: string;
  teamId: string;
  eventId: string;
  memberUid: string;
  memberName: string;
  status: "present" | "late" | "absent";
}

export interface CoachFeedbackRecord {
  id: string;
  teamId: string;
  postId: string;
  athleteUid: string;
  coachUid: string;
  coachName: string;
  feedback: string;
  createdAt?: { seconds?: number; nanoseconds?: number } | null;
}

export interface TeamGalleryItem {
  id: string;
  teamId: string;
  mediaUrl: string;
  mediaType: "image" | "video";
  caption: string;
}

export interface StaffNoteRecord {
  id: string;
  teamId: string;
  memberUid: string;
  authorUid: string;
  authorName: string;
  note: string;
  createdAt?: { seconds?: number; nanoseconds?: number } | null;
}

function mapTeam(id: string, data: Record<string, unknown>): TeamRecord {
  return {
    id,
    ownerId: String(data.ownerId ?? ""),
    adminIds: Array.isArray(data.adminIds) ? (data.adminIds as string[]) : [],
    name: String(data.name ?? ""),
    sport: String(data.sport ?? ""),
    location: String(data.location ?? ""),
    bio: String(data.bio ?? ""),
    memberIds: Array.isArray(data.memberIds) ? (data.memberIds as string[]) : [],
    members: Array.isArray(data.members)
      ? ((data.members as Array<Record<string, unknown>>).map((member) => ({
          uid: String(member.uid ?? ""),
          role:
            member.role === "admin" ||
            member.role === "coach" ||
            member.role === "captain" ||
            member.role === "player"
              ? member.role
              : "owner",
          displayName: String(member.displayName ?? "Member"),
          orgPermissions: Array.isArray(member.orgPermissions)
            ? ((member.orgPermissions as string[]).filter(
                (permission) =>
                  permission === "manage_roster" ||
                  permission === "manage_events" ||
                  permission === "manage_content" ||
                  permission === "manage_recruiting"
              ) as TeamMember["orgPermissions"])
            : [],
        })) as TeamMember[])
      : [],
    announcement: data.announcement ? String(data.announcement) : "",
    createdAt:
      (data.createdAt as { seconds?: number; nanoseconds?: number } | null | undefined) ?? null,
  };
}

function mapEvent(id: string, data: Record<string, unknown>): TeamEvent {
  return {
    id,
    teamId: String(data.teamId ?? ""),
    title: String(data.title ?? ""),
    date: String(data.date ?? ""),
    location: String(data.location ?? ""),
    type:
      data.type === "game" || data.type === "meeting" || data.type === "tryout"
        ? data.type
        : "practice",
    rsvpBy:
      data.rsvpBy && typeof data.rsvpBy === "object"
        ? (data.rsvpBy as Record<string, "going" | "maybe" | "not_going">)
        : {},
    remindersSentAt:
      (data.remindersSentAt as { seconds?: number; nanoseconds?: number } | null | undefined) ??
      null,
  };
}

export async function createTeam(input: {
  name: string;
  sport: string;
  location: string;
  bio: string;
}) {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in to create a team.");
  }

  await addDoc(collection(db, "teams"), {
    ownerId: auth.currentUser.uid,
    adminIds: [auth.currentUser.uid],
    name: input.name.trim(),
    sport: input.sport.trim(),
    location: input.location.trim(),
    bio: input.bio.trim(),
    memberIds: [auth.currentUser.uid],
    members: [
      {
        uid: auth.currentUser.uid,
        role: "owner",
        displayName: auth.currentUser.displayName || "Team Owner",
        orgPermissions: [
          "manage_roster",
          "manage_events",
          "manage_content",
          "manage_recruiting",
        ],
      },
    ],
    announcement: "",
    createdAt: serverTimestamp(),
  });
}

export function subscribeToTeams(callback: (teams: TeamRecord[]) => void) {
  if (!db) {
    callback([]);
    return () => undefined;
  }

  return onSnapshot(
    query(collection(db, "teams"), orderBy("createdAt", "desc")),
    (snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => {
      callback(snapshot.docs.map((docSnapshot) => mapTeam(docSnapshot.id, docSnapshot.data())));
    }
  );
}

export async function getTeam(teamId: string) {
  if (!db) {
    return null;
  }

  const snapshot = await getDoc(doc(db, "teams", teamId));
  return snapshot.exists() ? mapTeam(snapshot.id, snapshot.data() as Record<string, unknown>) : null;
}

export async function joinTeam(teamId: string, role: TeamMember["role"] = "player") {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in to join a team.");
  }

  const team = await getTeam(teamId);
  if (!team) {
    throw new Error("Team not found.");
  }

  const nextMembers = [
    ...team.members.filter((member) => member.uid !== auth.currentUser?.uid),
    {
      uid: auth.currentUser.uid,
      role,
      displayName: auth.currentUser.displayName || "Team Member",
    },
  ];

  await updateDoc(doc(db, "teams", teamId), {
    memberIds: arrayUnion(auth.currentUser.uid),
    members: nextMembers,
    updatedAt: serverTimestamp(),
  });
}

export async function linkUserToTeam(teamId: string, teamName: string) {
  if (!auth?.currentUser || !db) {
    return;
  }

  await setDoc(
    doc(db, "users", auth.currentUser.uid),
    {
      "role.team": teamName,
      teamId,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function inviteToTeam(teamId: string, inviteeUid: string, role: TeamMember["role"]) {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in.");
  }

  const team = await getTeam(teamId);
  if (!team) {
    throw new Error("Team not found.");
  }

  await addDoc(collection(db, "teamInvites"), {
    teamId,
    teamName: team.name,
    inviterId: auth.currentUser.uid,
    inviteeUid,
    role,
    status: "pending",
    createdAt: serverTimestamp(),
  });
}

export async function getTeamInvites() {
  if (!auth?.currentUser || !db) {
    return [];
  }

  const snapshot = await getDocs(
    query(
      collection(db, "teamInvites"),
      where("inviteeUid", "==", auth.currentUser.uid),
      limit(30)
    )
  );

  return snapshot.docs.map((docSnapshot: { id: string; data: () => Record<string, unknown> }) => ({
    id: docSnapshot.id,
    ...(docSnapshot.data() as Record<string, unknown>),
  })) as TeamInvite[];
}

export async function respondToTeamInvite(inviteId: string, status: "accepted" | "declined") {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in.");
  }

  const snapshot = await getDoc(doc(db, "teamInvites", inviteId));
  if (!snapshot.exists()) {
    throw new Error("Invite not found.");
  }

  const invite = snapshot.data() as Record<string, unknown>;
  await setDoc(
    doc(db, "teamInvites", inviteId),
    { status, respondedAt: serverTimestamp() },
    { merge: true }
  );

  if (status === "accepted") {
    await joinTeam(String(invite.teamId ?? ""), (invite.role as TeamMember["role"]) ?? "player");
    await linkUserToTeam(String(invite.teamId ?? ""), String(invite.teamName ?? ""));
  }
}

export async function createTeamEvent(teamId: string, input: Omit<TeamEvent, "id" | "teamId">) {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in.");
  }

  await addDoc(collection(db, "teamEvents"), {
    teamId,
    ...input,
    createdAt: serverTimestamp(),
  });
}

export async function getTeamEvents(teamId: string) {
  if (!db) {
    return [];
  }

  const snapshot = await getDocs(
    query(collection(db, "teamEvents"), where("teamId", "==", teamId), limit(50))
  );
  return snapshot.docs.map((docSnapshot: { id: string; data: () => Record<string, unknown> }) =>
    mapEvent(docSnapshot.id, docSnapshot.data() as Record<string, unknown>)
  );
}

export async function createTeamPost(teamId: string, content: string, type: "announcement" | "feed") {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in.");
  }

  await addDoc(collection(db, "teamPosts"), {
    teamId,
    authorId: auth.currentUser.uid,
    content: content.trim(),
    type,
    pinned: false,
    createdAt: serverTimestamp(),
  });
}

export async function getTeamPosts(teamId: string) {
  if (!db) {
    return [];
  }

  const snapshot = await getDocs(
    query(collection(db, "teamPosts"), where("teamId", "==", teamId), orderBy("createdAt", "desc"), limit(50))
  );
  return snapshot.docs.map((docSnapshot: { id: string; data: () => Record<string, unknown> }) => {
    const data = docSnapshot.data() as Record<string, unknown>;
    return {
      id: docSnapshot.id,
      teamId: String(data.teamId ?? ""),
      authorId: String(data.authorId ?? ""),
      content: String(data.content ?? ""),
      type: data.type === "announcement" ? "announcement" : "feed",
      pinned: data.pinned === true,
      createdAt:
        (data.createdAt as { seconds?: number; nanoseconds?: number } | null | undefined) ?? null,
    } satisfies TeamPost;
  });
}

export async function updateTeamAnnouncement(teamId: string, announcement: string) {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in.");
  }

  await setDoc(doc(db, "teams", teamId), { announcement: announcement.trim() }, { merge: true });
  if (announcement.trim()) {
    await createTeamPost(teamId, announcement, "announcement");
  }
}

export async function pinTeamPost(postId: string, pinned: boolean) {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in.");
  }

  await setDoc(doc(db, "teamPosts", postId), { pinned, updatedAt: serverTimestamp() }, { merge: true });
}

export async function submitTryoutApplication(teamId: string, input: Omit<TeamTryout, "id" | "teamId" | "status">) {
  if (!db) {
    throw new Error("Database unavailable.");
  }

  await addDoc(collection(db, "teamTryouts"), {
    teamId,
    ...input,
    status: "pending",
    createdAt: serverTimestamp(),
  });
}

export async function getTeamTryouts(teamId: string) {
  if (!db) {
    return [];
  }

  const snapshot = await getDocs(
    query(collection(db, "teamTryouts"), where("teamId", "==", teamId), limit(50))
  );
  return snapshot.docs.map((docSnapshot: { id: string; data: () => Record<string, unknown> }) => ({
    id: docSnapshot.id,
    ...(docSnapshot.data() as Record<string, unknown>),
  })) as TeamTryout[];
}

export async function updateTeamMemberRole(teamId: string, memberUid: string, role: TeamMember["role"]) {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in.");
  }

  const team = await getTeam(teamId);
  if (!team) {
    throw new Error("Team not found.");
  }

  const nextMembers = team.members.map((member) =>
    member.uid === memberUid
      ? {
          ...member,
          role,
          orgPermissions:
            member.orgPermissions && member.orgPermissions.length > 0
              ? member.orgPermissions
              : role === "owner" || role === "admin" || role === "coach"
                ? ["manage_roster", "manage_events", "manage_content"]
                : [],
        }
      : member
  );
  const nextAdminIds = Array.from(
    new Set(
      nextMembers
        .filter((member) => member.role === "owner" || member.role === "admin" || member.role === "coach")
        .map((member) => member.uid)
    )
  );

  await setDoc(
    doc(db, "teams", teamId),
    {
      members: nextMembers,
      adminIds: nextAdminIds,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function getOrganizationTeams() {
  if (!auth?.currentUser || !db) {
    return [];
  }

  const snapshot = await getDocs(
    query(collection(db, "teams"), where("adminIds", "array-contains", auth.currentUser.uid), limit(50))
  );
  return snapshot.docs.map((docSnapshot: { id: string; data: () => Record<string, unknown> }) =>
    mapTeam(docSnapshot.id, docSnapshot.data() as Record<string, unknown>)
  );
}

export async function updateOrganizationPermissions(
  teamId: string,
  memberUid: string,
  permissions: TeamMember["orgPermissions"]
) {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in.");
  }

  const team = await getTeam(teamId);
  if (!team) {
    throw new Error("Team not found.");
  }

  const nextMembers = team.members.map((member) =>
    member.uid === memberUid ? { ...member, orgPermissions: permissions ?? [] } : member
  );

  await setDoc(doc(db, "teams", teamId), { members: nextMembers, updatedAt: serverTimestamp() }, { merge: true });
}

export async function createTeamChatRoom(teamId: string, name: string) {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in.");
  }

  await addDoc(collection(db, "teamChatRooms"), {
    teamId,
    name: name.trim(),
    createdAt: serverTimestamp(),
  });
}

export async function getTeamChatRooms(teamId: string) {
  if (!db) {
    return [];
  }

  const snapshot = await getDocs(
    query(collection(db, "teamChatRooms"), where("teamId", "==", teamId), orderBy("createdAt", "asc"), limit(20))
  );

  return snapshot.docs.map((docSnapshot: { id: string; data: () => Record<string, unknown> }) => {
    const data = docSnapshot.data() as Record<string, unknown>;
    return {
      id: docSnapshot.id,
      teamId: String(data.teamId ?? ""),
      name: String(data.name ?? "Room"),
      createdAt:
        (data.createdAt as { seconds?: number; nanoseconds?: number } | null | undefined) ?? null,
    } satisfies TeamChatRoom;
  });
}

export async function sendTeamChatMessage(teamId: string, roomId: string, text: string) {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in.");
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return;
  }

  await addDoc(collection(db, "teamChatMessages"), {
    teamId,
    roomId,
    senderId: auth.currentUser.uid,
    senderName: auth.currentUser.displayName || "Team Member",
    text: trimmed,
    createdAt: serverTimestamp(),
  });
}

export function subscribeToTeamChatMessages(
  roomId: string,
  callback: (messages: TeamChatMessage[]) => void
) {
  if (!db) {
    callback([]);
    return () => undefined;
  }

  return onSnapshot(
    query(
      collection(db, "teamChatMessages"),
      where("roomId", "==", roomId),
      orderBy("createdAt", "asc"),
      limit(100)
    ),
    (snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => {
      callback(
        snapshot.docs.map((docSnapshot) => {
          const data = docSnapshot.data() as Record<string, unknown>;
          return {
            id: docSnapshot.id,
            roomId: String(data.roomId ?? ""),
            teamId: String(data.teamId ?? ""),
            senderId: String(data.senderId ?? ""),
            senderName: String(data.senderName ?? "Team Member"),
            text: String(data.text ?? ""),
            createdAt:
              (data.createdAt as { seconds?: number; nanoseconds?: number } | null | undefined) ??
              null,
          } satisfies TeamChatMessage;
        })
      );
    }
  );
}

export async function updateEventRsvp(
  eventId: string,
  status: "going" | "maybe" | "not_going"
) {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in.");
  }

  await setDoc(
    doc(db, "teamEvents", eventId),
    {
      [`rsvpBy.${auth.currentUser.uid}`]: status,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function sendEventRsvpReminders(teamId: string, event: TeamEvent, teamName: string) {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in.");
  }

  const team = await getTeam(teamId);
  if (!team) {
    throw new Error("Team not found.");
  }

  const respondedIds = new Set(Object.keys(event.rsvpBy ?? {}));
  await Promise.all(
    team.memberIds
      .filter((memberUid) => memberUid !== auth.currentUser?.uid)
      .filter((memberUid) => !respondedIds.has(memberUid))
      .map((memberUid) =>
        createNotification({
          type: "team_rsvp",
          recipientId: memberUid,
          actorId: auth.currentUser!.uid,
          actorName: auth.currentUser!.displayName || teamName,
          actorAvatar: auth.currentUser!.photoURL || "",
          message: `RSVP reminder: ${event.title} is coming up for ${teamName}.`,
        })
      )
  );

  await setDoc(doc(db, "teamEvents", event.id), { remindersSentAt: serverTimestamp() }, { merge: true });
}

export async function markAttendance(
  teamId: string,
  eventId: string,
  memberUid: string,
  memberName: string,
  status: TeamAttendanceRecord["status"]
) {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in.");
  }

  await setDoc(
    doc(db, "teamAttendance", `${eventId}__${memberUid}`),
    {
      teamId,
      eventId,
      memberUid,
      memberName,
      status,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function getTeamAttendance(teamId: string, eventId: string) {
  if (!db) {
    return [];
  }

  const snapshot = await getDocs(
    query(
      collection(db, "teamAttendance"),
      where("teamId", "==", teamId),
      where("eventId", "==", eventId),
      limit(100)
    )
  );

  return snapshot.docs.map((docSnapshot: { id: string; data: () => Record<string, unknown> }) => {
    const data = docSnapshot.data() as Record<string, unknown>;
    return {
      id: docSnapshot.id,
      teamId: String(data.teamId ?? ""),
      eventId: String(data.eventId ?? ""),
      memberUid: String(data.memberUid ?? ""),
      memberName: String(data.memberName ?? "Member"),
      status:
        data.status === "late" || data.status === "absent" ? data.status : "present",
    } satisfies TeamAttendanceRecord;
  });
}

export async function addCoachFeedback(
  teamId: string,
  postId: string,
  athleteUid: string,
  feedback: string
) {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in.");
  }

  const trimmed = feedback.trim();
  if (!trimmed) {
    return;
  }

  await addDoc(collection(db, "coachFeedback"), {
    teamId,
    postId,
    athleteUid,
    coachUid: auth.currentUser.uid,
    coachName: auth.currentUser.displayName || "Coach",
    feedback: trimmed,
    createdAt: serverTimestamp(),
  });

  if (athleteUid !== auth.currentUser.uid) {
    await createNotification({
      type: "coach_feedback",
      recipientId: athleteUid,
      actorId: auth.currentUser.uid,
      actorName: auth.currentUser.displayName || "Coach",
      actorAvatar: auth.currentUser.photoURL || "",
      message: `${auth.currentUser.displayName || "A coach"} left feedback on your post.`,
      postId,
    });
  }
}

export function subscribeToCoachFeedback(
  postId: string,
  callback: (feedback: CoachFeedbackRecord[]) => void
) {
  if (!db) {
    callback([]);
    return () => undefined;
  }

  return onSnapshot(
    query(collection(db, "coachFeedback"), where("postId", "==", postId), orderBy("createdAt", "desc"), limit(20)),
    (snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => {
      callback(
        snapshot.docs.map((docSnapshot) => {
          const data = docSnapshot.data() as Record<string, unknown>;
          return {
            id: docSnapshot.id,
            teamId: String(data.teamId ?? ""),
            postId: String(data.postId ?? ""),
            athleteUid: String(data.athleteUid ?? ""),
            coachUid: String(data.coachUid ?? ""),
            coachName: String(data.coachName ?? "Coach"),
            feedback: String(data.feedback ?? ""),
            createdAt:
              (data.createdAt as { seconds?: number; nanoseconds?: number } | null | undefined) ??
              null,
          } satisfies CoachFeedbackRecord;
        })
      );
    }
  );
}

export async function addTeamGalleryItem(teamId: string, file: File, caption: string) {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in.");
  }

  const uploaded = await uploadToFirebaseStorage(file, `Kinet/team-galleries/${teamId}`);
  await addDoc(collection(db, "teamGallery"), {
    teamId,
    mediaUrl: uploaded.url,
    mediaType: file.type.startsWith("video/") ? "video" : "image",
    caption: caption.trim(),
    createdAt: serverTimestamp(),
  });
}

export async function getTeamGallery(teamId: string) {
  if (!db) {
    return [];
  }

  const snapshot = await getDocs(
    query(collection(db, "teamGallery"), where("teamId", "==", teamId), limit(50))
  );

  return snapshot.docs.map((docSnapshot: { id: string; data: () => Record<string, unknown> }) => {
    const data = docSnapshot.data() as Record<string, unknown>;
    return {
      id: docSnapshot.id,
      teamId: String(data.teamId ?? ""),
      mediaUrl: String(data.mediaUrl ?? ""),
      mediaType: data.mediaType === "video" ? "video" : "image",
      caption: String(data.caption ?? ""),
    } satisfies TeamGalleryItem;
  });
}

export async function addStaffNote(teamId: string, memberUid: string, note: string) {
  if (!auth?.currentUser || !db) {
    throw new Error("You must be signed in.");
  }

  await addDoc(collection(db, "staffNotes"), {
    teamId,
    memberUid,
    authorUid: auth.currentUser.uid,
    authorName: auth.currentUser.displayName || "Staff",
    note: note.trim(),
    createdAt: serverTimestamp(),
  });
}

export async function getStaffNotes(teamId: string, memberUid: string) {
  if (!db) {
    return [];
  }

  const snapshot = await getDocs(
    query(
      collection(db, "staffNotes"),
      where("teamId", "==", teamId),
      where("memberUid", "==", memberUid),
      limit(50)
    )
  );

  return snapshot.docs.map((docSnapshot: { id: string; data: () => Record<string, unknown> }) => {
    const data = docSnapshot.data() as Record<string, unknown>;
    return {
      id: docSnapshot.id,
      teamId: String(data.teamId ?? ""),
      memberUid: String(data.memberUid ?? ""),
      authorUid: String(data.authorUid ?? ""),
      authorName: String(data.authorName ?? "Staff"),
      note: String(data.note ?? ""),
      createdAt:
        (data.createdAt as { seconds?: number; nanoseconds?: number } | null | undefined) ?? null,
    } satisfies StaffNoteRecord;
  });
}
