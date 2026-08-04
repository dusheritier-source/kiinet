"use client";

import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { searchPosts, type FeedPost } from "@/lib/posts";
import { getSuggestedProfiles, searchProfiles, type SearchProfile } from "@/lib/user-profile";
import { intelligentMatch, parseSearchIntent, suggestCorrection } from "@/lib/search-intelligence";

export type SearchCategory = "all" | "people" | "posts" | "videos" | "groups" | "messages";
export interface GroupSearchResult { id: string; name: string; photoURL: string; members: number; lastMessage: string; }
export interface MessageSearchResult {
  id: string; conversationId: string; name: string; senderName: string; lastMessage: string;
  attachmentName?: string | null; attachmentType?: string | null; pinned: boolean; saved: boolean;
  archived: boolean; request: boolean; updatedAt?: { seconds?: number } | null;
}
export interface UniversalSearchResults {
  people: SearchProfile[]; posts: FeedPost[]; videos: FeedPost[];
  groups: GroupSearchResult[]; messages: MessageSearchResult[];
  intelligence?: { correction: string | null; relatedQueries: string[]; interpretedAs: string | null };
}

const searchCache = new Map<string, { expiresAt: number; results: UniversalSearchResults }>();
const searchesInFlight = new Map<string, Promise<UniversalSearchResults>>();
const SEARCH_CACHE_MS = 60_000;
const MAX_CACHE_ENTRIES = 40;

export function clearUniversalSearchCache() {
  searchCache.clear();
}

export function universalSearch(searchTerm: string): Promise<UniversalSearchResults> {
  const key = `${auth.currentUser?.uid ?? "guest"}:${searchTerm.trim().toLowerCase()}`;
  const cached = searchCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.results);
  const active = searchesInFlight.get(key);
  if (active) return active;
  const request = runUniversalSearch(searchTerm).then((results) => {
    if (searchCache.size >= MAX_CACHE_ENTRIES) searchCache.delete(searchCache.keys().next().value ?? "");
    searchCache.set(key, { results, expiresAt: Date.now() + SEARCH_CACHE_MS });
    return results;
  }).finally(() => searchesInFlight.delete(key));
  searchesInFlight.set(key, request);
  return request;
}

async function runUniversalSearch(searchTerm: string): Promise<UniversalSearchResults> {
  const normalized = searchTerm.trim().replace(/^[@#]/, "").toLowerCase();
  const [searchedPeople, suggestedPeople, allContent, viewerSnapshot, commentsSnapshot] = await Promise.all([
    searchProfiles(""),
    normalized ? Promise.resolve([]) : getSuggestedProfiles(20),
    searchPosts(""),
    db && auth.currentUser ? getDoc(doc(db, "users", auth.currentUser.uid)) : Promise.resolve(null),
    db ? getDocs(query(collection(db, "comments"), limit(100))) : Promise.resolve(null),
  ]);
  const rawPeople = normalized ? searchedPeople : suggestedPeople.map((item) => item.profile);
  const viewerData = viewerSnapshot?.exists() ? viewerSnapshot.data() : {};
  const viewerFollowing = Array.isArray(viewerData.following) ? viewerData.following as string[] : [];
  const intent = parseSearchIntent(searchTerm);
  const matchingQuery = normalized
    .replace(/\b(recent|latest|new|today|this|week|popular|trending|viral|top|videos?|reels?|clips?|posts?|photos?|pictures?|people|users|accounts|creators|by|from)\b/g, " ")
    .replace(intent.creator ?? "", " ")
    .replace(/\s+/g, " ")
    .trim();
  const people = rawPeople.map((profile) => {
    const match = intelligentMatch(`${profile.displayName} ${profile.username ?? ""} ${profile.location ?? ""} ${profile.role?.bio ?? ""} ${(profile.interests ?? []).join(" ")}`, matchingQuery);
    return {
      ...profile,
      discoveryIsFollowing: viewerFollowing.includes(profile.uid),
      discoveryMutualCount: (profile.followers ?? []).filter((uid) => viewerFollowing.includes(uid)).length,
      _searchScore: match.score + (viewerFollowing.includes(profile.uid) ? 20 : 0),
      _searchMatches: match.matches,
    };
  }).filter((profile) => !matchingQuery || profile._searchMatches).sort((a, b) => b._searchScore - a._searchScore);
  const matchingCommentPostIds = new Set(
    (commentsSnapshot?.docs ?? [])
      .filter((item) => String(item.data().text ?? "").toLowerCase().includes(normalized))
      .map((item) => String(item.data().postId ?? ""))
  );
  const content = allContent.filter((post) => {
    if (!normalized) return true;
    const searchable = [
      post.caption, post.author.name, post.author.username, post.autoCaption,
      post.translatedCaption, post.accessibilityLabel, post.questionPrompt,
      ...post.hashtags,
      ...(post.collaborators ?? []).flatMap((person) => [person.name, person.username]),
    ].filter(Boolean).join(" ").toLowerCase();
    const match = intelligentMatch(searchable, matchingQuery);
    const creatorMatches = !intent.creator || `${post.author.name} ${post.author.username}`.toLowerCase().includes(intent.creator);
    return creatorMatches && (!matchingQuery || match.matches || matchingCommentPostIds.has(post.id));
  }).sort((a, b) => {
    if (intent.recent) return (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0);
    if (intent.popular) return (b.likes.length + b.commentsCount * 2 + b.shares * 3) - (a.likes.length + a.commentsCount * 2 + a.shares * 3);
    const first = intelligentMatch(`${a.caption} ${a.author.name} ${a.hashtags.join(" ")}`, matchingQuery).score + (viewerFollowing.includes(a.userId) ? 15 : 0);
    const second = intelligentMatch(`${b.caption} ${b.author.name} ${b.hashtags.join(" ")}`, matchingQuery).score + (viewerFollowing.includes(b.userId) ? 15 : 0);
    return second - first;
  });
  let groups: GroupSearchResult[] = [];
  let messages: MessageSearchResult[] = [];

  if (db && auth.currentUser) {
    const snapshot = await getDocs(query(collection(db, "conversations"), where("participantIds", "array-contains", auth.currentUser.uid), limit(50)));
    const conversations = snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as Record<string, unknown> & { id: string }));
    groups = conversations
      .filter((item) => item.kind === "group" && !(Array.isArray(item.hiddenBy) && item.hiddenBy.includes(auth.currentUser!.uid)))
      .map((item) => ({ id: item.id, name: String(item.groupName ?? "Group"), photoURL: String(item.groupPhotoURL ?? ""), members: Array.isArray(item.participantIds) ? item.participantIds.length : 0, lastMessage: String(item.lastMessage ?? "") }))
      .filter((item) => !normalized || intelligentMatch(`${item.name} ${item.lastMessage}`, normalized).matches);
    if (normalized) {
    const visibleConversations = conversations.filter((item) => !(Array.isArray(item.hiddenBy) && item.hiddenBy.includes(auth.currentUser!.uid))).slice(0, 12);
    const messageBatches = await Promise.all(visibleConversations.map(async (conversation) => {
      const messageSnapshot = await getDocs(query(collection(db!, "messages"), where("conversationId", "==", conversation.id), limit(40)));
      const profiles = Array.isArray(conversation.participantProfiles) ? conversation.participantProfiles as Array<{ uid: string; displayName: string }> : [];
      const other = profiles.find((profile) => profile.uid !== auth.currentUser!.uid);
      const conversationName = conversation.kind === "group" ? String(conversation.groupName ?? "Group") : other?.displayName || "Conversation";
      return messageSnapshot.docs.map((messageDocument) => {
        const message = messageDocument.data();
        const sender = profiles.find((profile) => profile.uid === message.senderId);
        return {
          id: messageDocument.id,
          conversationId: conversation.id,
          name: conversationName,
          senderName: sender?.displayName || "User",
          lastMessage: String(message.text ?? ""),
          attachmentName: message.attachmentName ? String(message.attachmentName) : null,
          attachmentType: message.attachmentType ? String(message.attachmentType) : null,
          pinned: Array.isArray(message.pinnedBy) && message.pinnedBy.includes(auth.currentUser!.uid),
          saved: Array.isArray(message.savedBy) && message.savedBy.includes(auth.currentUser!.uid),
          archived: Array.isArray(conversation.archivedBy) && conversation.archivedBy.includes(auth.currentUser!.uid),
          request: conversation.requestStatus === "pending" && conversation.requestedBy !== auth.currentUser!.uid,
          updatedAt: message.createdAt as MessageSearchResult["updatedAt"],
        } satisfies MessageSearchResult;
      });
    }));
    messages = messageBatches.flat().filter((item) => !normalized || intelligentMatch(`${item.name} ${item.senderName} ${item.lastMessage} ${item.attachmentName ?? ""}`, normalized).matches);
    }
  }

  const candidates = [
    ...people.flatMap((profile) => [profile.displayName, profile.username ?? ""]),
    ...content.flatMap((post) => post.hashtags),
  ].filter(Boolean);
  const interpreted = [intent.contentType, intent.creator ? `by @${intent.creator}` : null, intent.recent ? "recent" : null, intent.popular ? "popular" : null].filter(Boolean).join(" · ") || null;
  return {
    people: intent.contentType && intent.contentType !== "people" ? [] : people,
    posts: content.filter((post) => post.contentType === "post" && (!intent.contentType || intent.contentType === "posts")),
    videos: content.filter((post) => (post.contentType === "reel" || post.mediaType === "video") && (!intent.contentType || intent.contentType === "videos")),
    groups: intent.contentType ? [] : groups,
    messages: intent.contentType ? [] : messages,
    intelligence: {
      correction: suggestCorrection(searchTerm, candidates),
      relatedQueries: Array.from(new Set(content.flatMap((post) => post.hashtags))).slice(0, 5).map((tag) => `#${tag.replace(/^#/, "")}`),
      interpretedAs: interpreted,
    },
  };
}
