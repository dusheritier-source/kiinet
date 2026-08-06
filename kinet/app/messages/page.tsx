"use client";

import { ChangeEvent, FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArrowLeft,
  BellOff,
  Bookmark,
  CheckSquare,
  Circle,
  Copy,
  EyeOff,
  Forward,
  Info,
  ImagePlus,
  Mail,
  MapPin,
  MoreHorizontal,
  MoreVertical,
  Pencil,
  Phone,
  Pin,
  Reply,
  Sparkles,
  Search,
  SendHorizontal,
  Trash2,
  X,
  Video,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

import { AuthProvider, useAuthContext } from "@/components/AuthProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import {
  createOrGetConversation,
  createGroupConversation,
  deleteConversationMessage,
  getOlderConversationMessages,
  getConversationMessage,
  markConversationRead,
  markConversationUnread,
  leaveGroupConversation,
  respondToMessageRequest,
  sendConversationMessage,
  setConversationTyping,
  subscribeToConversationMessages,
  subscribeToConversations,
  toggleConversationMessageFlag,
  toggleConversationMessageReaction,
  updateConversationMessage,
  updateConversationState,
  type ConversationMessage,
  type ConversationSummary,
} from "@/lib/messaging";
import { getPlatformPreferences, translateMessagePreview } from "@/lib/phase9";
import { isTransientFirestoreError } from "@/lib/firebase";
import { formatTimeAgo } from "@/lib/posts";
import DefaultAvatar from "@/components/DefaultAvatar";
import { searchProfiles, type SearchProfile } from "@/lib/user-profile";
import { setUserOffline, setUserOnline, setupPresenceListener, type UserPresence } from "@/lib/realtime-db";
import { validateMessageAttachment } from "@/lib/message-attachments";
import CallPanel from "@/components/CallPanel";
import { reportEntity, toggleBlockedUser } from "@/lib/moderation";
import { getCurrentUserSettings, updateCurrentUserSettings, type UserSettings } from "@/lib/settings";

interface QueuedMessage {
  id: string;
  conversationId: string;
  text: string;
  replyTo?: ConversationMessage["replyTo"];
  expiresInSeconds?: number | null;
}

function MessageText({ text }: { text: string }) {
  return <p className="whitespace-pre-wrap break-words">{text.split(/(https?:\/\/[^\s]+)/g).map((part, index) => part.startsWith("http") ? <a key={`${part}-${index}`} href={part} target="_blank" rel="noreferrer" className="underline">{part}</a> : part)}</p>;
}

function MessagesPageContent() {
  const { user } = useAuthContext();
  const currentUserId = user?.uid ?? "";
  const searchParams = useSearchParams();
  const starterUser = searchParams.get("user");
  const starterConversation = searchParams.get("conversation");
  const highlightedMessageId = searchParams.get("message");
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [autoTranslate, setAutoTranslate] = useState(false);
  const [dmLanguage, setDmLanguage] = useState("en");
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [peopleSearch, setPeopleSearch] = useState("");
  const [people, setPeople] = useState<SearchProfile[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [olderMessagesLoading, setOlderMessagesLoading] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [otherPresence, setOtherPresence] = useState<UserPresence | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [replyingTo, setReplyingTo] = useState<ConversationMessage | null>(null);
  const [messageSearch, setMessageSearch] = useState("");
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [forwardingMessage, setForwardingMessage] = useState<ConversationMessage | null>(null);
  const [openMessageMenuId, setOpenMessageMenuId] = useState<string | null>(null);
  const [showConversationInfo, setShowConversationInfo] = useState(false);
  const [showRequests, setShowRequests] = useState(false);
  const [messagePrivacy, setMessagePrivacy] = useState<UserSettings["messagePrivacy"]>("everyone");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<string[]>([]);
  const [expiresInSeconds, setExpiresInSeconds] = useState<number | null>(null);
  const [clock, setClock] = useState(Date.now());
  const [showSummary, setShowSummary] = useState(false);

  useEffect(() => {
    if (!user) {
      return;
    }

    return subscribeToConversations(user.uid, setConversations);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void setUserOnline();
    return () => { void setUserOffline(); };
  }, [user]);

  useEffect(() => {
    const updateConnection = () => setIsOnline(navigator.onLine);
    updateConnection();
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);
    return () => {
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
    };
  }, []);

  useEffect(() => {
    if (!isOnline || !user) return;
    const queueKey = `kinet:message-queue:${user.uid}`;
    const queued = JSON.parse(localStorage.getItem(queueKey) || "[]") as QueuedMessage[];
    if (queued.length === 0) return;

    void (async () => {
      const remaining: QueuedMessage[] = [];
      for (const item of queued) {
        try {
          setMessages((current) => current.map((message) => message.id === item.id ? { ...message, clientStatus: "pending" } : message));
          await sendConversationMessage(item.conversationId, item.text, null, item.id, undefined, item.replyTo, { expiresInSeconds: item.expiresInSeconds });
        } catch {
          remaining.push(item);
          setMessages((current) => current.map((message) => message.id === item.id ? { ...message, clientStatus: "failed" } : message));
        }
      }
      localStorage.setItem(queueKey, JSON.stringify(remaining));
    })();
  }, [isOnline, user]);

  useEffect(() => {
    void getPlatformPreferences()
      .then((preferences) => {
        setAutoTranslate(preferences.autoTranslateDms);
        setDmLanguage(preferences.dmTranslationLanguage);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    void getCurrentUserSettings().then((settings) => setMessagePrivacy(settings.messagePrivacy));
  }, []);

  useEffect(() => {
    if (!user || !starterUser || starterUser === user.uid) {
      return;
    }

    setCreating(true);
    createOrGetConversation(starterUser)
      .then((conversationId) => setActiveConversationId(conversationId))
      .catch((conversationError: unknown) => {
        if (!isTransientFirestoreError(conversationError)) {
          setError(conversationError instanceof Error ? conversationError.message : "Could not start conversation.");
        }
      })
      .finally(() => setCreating(false));
  }, [starterUser, user]);

  useEffect(() => {
    if (starterConversation) setActiveConversationId(starterConversation);
  }, [starterConversation]);

  useEffect(() => {
    if (!highlightedMessageId || !activeConversationId) return;
    void getConversationMessage(highlightedMessageId)
      .then((message) => {
        if (!message || message.conversationId !== activeConversationId) return;
        setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message].sort((a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0)));
        window.setTimeout(() => document.getElementById(`message-${message.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
      })
      .catch(() => undefined);
  }, [activeConversationId, highlightedMessageId]);

  useEffect(() => {
    if (!showNewMessage || !user) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void searchProfiles(peopleSearch)
        .then((results) => {
          if (!cancelled) setPeople(results.filter((profile) => profile.uid !== user.uid));
        })
        .catch(() => {
          if (!cancelled) setError("Could not load people. Please try again.");
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [peopleSearch, showNewMessage, user]);

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }

    setMessages([]);
    setMessagesLoading(true);
    void markConversationRead(activeConversationId).catch(() => undefined);
    return subscribeToConversationMessages(
      activeConversationId,
      (nextMessages, hasOlder) => {
        setMessages((current) => {
          const nextIds = new Set(nextMessages.map((message) => message.id));
          const oldestLiveSeconds = nextMessages[0]?.createdAt?.seconds ?? Number.POSITIVE_INFINITY;
          const previouslyLoadedOlder = current.filter(
            (message) =>
              !nextIds.has(message.id) &&
              (message.clientStatus === "queued" ||
                message.clientStatus === "pending" ||
                message.clientStatus === "failed" ||
                (message.createdAt?.seconds ?? Number.NEGATIVE_INFINITY) <= oldestLiveSeconds)
          );
          return [...previouslyLoadedOlder, ...nextMessages];
        });
        setHasOlderMessages(hasOlder);
        setMessagesLoading(false);
      },
      (subscriptionError) => {
        if (!isTransientFirestoreError(subscriptionError)) {
          setError("Messages could not be loaded. Please try again.");
        }
        setMessagesLoading(false);
      }
    );
  }, [activeConversationId]);

  const visibleConversations = useMemo(() => {
    if (!user) {
      return [];
    }

    return conversations
      .filter((conversation) => !conversation.hiddenBy.includes(currentUserId))
      .filter((conversation) => showRequests
        ? conversation.requestStatus === "pending" && conversation.requestedBy !== currentUserId
        : true)
      .filter((conversation) =>
        showArchived
          ? conversation.archivedBy.includes(currentUserId)
          : !conversation.archivedBy.includes(currentUserId)
      )
      .filter((conversation) => {
        const other =
          conversation.participantProfiles.find((profile) => profile.uid !== currentUserId) ??
          conversation.participantProfiles[0];
        const haystack = `${other?.displayName || ""} ${conversation.lastMessage || ""}`.toLowerCase();
        return haystack.includes(searchTerm.trim().toLowerCase());
      })
      .sort((first, second) => Number(second.pinnedBy.includes(currentUserId)) - Number(first.pinnedBy.includes(currentUserId)));
  }, [conversations, currentUserId, searchTerm, showArchived, showRequests, user]);

  const activeConversation = useMemo(
    () => visibleConversations.find((conversation) => conversation.id === activeConversationId) ?? null,
    [activeConversationId, visibleConversations]
  );
  const activeOtherUserId = activeConversation?.participantIds.find((uid) => uid !== currentUserId) ?? null;

  useEffect(() => {
    if (!activeOtherUserId) {
      setOtherPresence(null);
      return;
    }
    return setupPresenceListener(activeOtherUserId, setOtherPresence) ?? undefined;
  }, [activeOtherUserId]);

  useEffect(() => {
    if (!activeConversationId) {
      setDraft("");
      return;
    }
    setDraft(localStorage.getItem(`kinet:message-draft:${activeConversationId}`) ?? "");
  }, [activeConversationId]);

  const directPeople = useMemo(
    () =>
      visibleConversations.slice(0, 10).map((conversation) => {
        const other =
          conversation.participantProfiles.find((profile) => profile.uid !== currentUserId) ??
          conversation.participantProfiles[0];

        return {
          conversationId: conversation.id,
          displayName: conversation.kind === "group" ? conversation.groupName || "Group" : other?.displayName || "Conversation",
          photoURL: conversation.kind === "group" ? conversation.groupPhotoURL || "https://placehold.co/80x80?text=G" : other?.photoURL || "https://placehold.co/80x80?text=D",
          unread: conversation.unreadBy.includes(currentUserId),
        };
      }),
    [currentUserId, visibleConversations]
  );
  const visibleMessages = useMemo(() => {
    const normalized = messageSearch.trim().toLowerCase();
    return messages.filter((message) =>
      !message.hiddenFor.includes(currentUserId) &&
      (!(message.expiresAt && "seconds" in message.expiresAt) || !message.expiresAt.seconds || message.expiresAt.seconds * 1000 > clock) &&
      (!normalized || message.text.toLowerCase().includes(normalized) || message.attachmentName?.toLowerCase().includes(normalized))
    );
  }, [clock, currentUserId, messageSearch, messages]);
  const conversationSummary = useMemo(() => {
    const recent = visibleMessages.filter((message) => message.text).slice(-20);
    if (!recent.length) return "There are no text messages to summarize yet.";
    const participants = new Set(recent.map((message) => message.senderId)).size;
    const topics = recent.map((message) => message.text).join(" ").toLowerCase().match(/[a-z]{5,}/g) ?? [];
    const common = Array.from(new Set(topics)).slice(0, 5).join(", ");
    return `${recent.length} recent messages from ${participants} participant${participants === 1 ? "" : "s"}. Recent topics include ${common || "general conversation"}.`;
  }, [visibleMessages]);
  const smartReplies = useMemo(() => {
    const lastIncoming = [...visibleMessages].reverse().find((message) => message.senderId !== currentUserId)?.text.toLowerCase() || "";
    if (lastIncoming.includes("thank")) return ["You're welcome!", "Anytime!", "Glad I could help."];
    if (lastIncoming.includes("?")) return ["Yes", "Let me check", "I’ll get back to you soon."];
    return ["Sounds good!", "Got it", "Tell me more."];
  }, [currentUserId, visibleMessages]);

  if (!user) {
    return null;
  }

  const showConversationPane = Boolean(activeConversation);
  const activeOtherUser =
    activeConversation?.participantProfiles.find((profile) => profile.uid !== currentUserId) ??
    activeConversation?.participantProfiles[0] ??
    null;
  const canSendToActiveConversation = activeConversation?.requestStatus !== "declined" &&
    !(activeConversation?.requestStatus === "pending" && activeConversation.requestedBy !== currentUserId);
  const getMessageSender = (senderId: string) =>
    activeConversation?.participantProfiles.find((profile) => profile.uid === senderId) ?? activeOtherUser;

  const handleSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeConversationId || (!draft.trim() && !attachment)) {
      return;
    }
    if (!isOnline && attachment) {
      setError("Reconnect before sending an attachment. Text messages can be queued offline.");
      return;
    }

    const messageText = draft.trim();
    const optimisticId = crypto.randomUUID();
    const optimisticMessage: ConversationMessage = {
      id: optimisticId,
      conversationId: activeConversationId,
      senderId: currentUserId,
      text: messageText,
      attachmentUrl: null,
      attachmentType: attachment?.type ?? null,
      attachmentName: attachment?.name ?? null,
      attachmentSize: attachment?.size ?? null,
      readBy: [currentUserId],
      createdAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
      clientStatus: isOnline ? "pending" : "queued",
      replyTo: replyingTo ? { id: replyingTo.id, senderId: replyingTo.senderId, text: replyingTo.text.slice(0, 160) } : null,
      reactions: {},
      pinnedBy: [],
      savedBy: [],
      hiddenFor: [],
      expiresAt: expiresInSeconds ? { seconds: Math.floor(Date.now() / 1000) + expiresInSeconds, nanoseconds: 0 } : null,
    };

    setError("");
    setMessages((current) => [...current, optimisticMessage]);
    setDraft("");
    localStorage.removeItem(`kinet:message-draft:${activeConversationId}`);
    if (!isOnline) {
      const queueKey = `kinet:message-queue:${currentUserId}`;
      const queue = JSON.parse(localStorage.getItem(queueKey) || "[]") as QueuedMessage[];
      localStorage.setItem(queueKey, JSON.stringify([...queue, { id: optimisticId, conversationId: activeConversationId, text: messageText, replyTo: optimisticMessage.replyTo, expiresInSeconds }]));
      setReplyingTo(null);
      return;
    }

    setSending(true);
    try {
      setUploadProgress(attachment ? 0 : null);
      await sendConversationMessage(
        activeConversationId,
        messageText,
        attachment,
        optimisticId,
        setUploadProgress,
        optimisticMessage.replyTo,
        { expiresInSeconds }
      );
      setAttachment(null);
      setReplyingTo(null);
      setExpiresInSeconds(null);
      await setConversationTyping(activeConversationId, false);
    } catch (sendError) {
      if (attachment) {
        setMessages((current) => current.filter((message) => message.id !== optimisticId));
        setDraft(messageText);
        localStorage.setItem(`kinet:message-draft:${activeConversationId}`, messageText);
      } else {
        setMessages((current) => current.map((message) => message.id === optimisticId ? { ...message, clientStatus: "failed" } : message));
      }
      if (!isTransientFirestoreError(sendError)) {
        setError(sendError instanceof Error ? sendError.message : "Message could not be sent.");
      }
    } finally {
      setSending(false);
      setUploadProgress(null);
    }
  };

  const retryMessage = async (message: ConversationMessage) => {
    if (!activeConversationId || message.clientStatus !== "failed") return;
    setMessages((current) => current.map((item) => item.id === message.id ? { ...item, clientStatus: "pending" } : item));
    try {
      await sendConversationMessage(activeConversationId, message.text, null, message.id);
    } catch (retryError) {
      setMessages((current) => current.map((item) => item.id === message.id ? { ...item, clientStatus: "failed" } : item));
      if (!isTransientFirestoreError(retryError)) {
        setError(retryError instanceof Error ? retryError.message : "Message retry failed.");
      }
    }
  };

  const startConversation = async (profile: SearchProfile) => {
    setCreating(true);
    setError("");
    try {
      const conversationId = await createOrGetConversation(profile.uid);
      setActiveConversationId(conversationId);
      setShowNewMessage(false);
      setPeopleSearch("");
    } catch (conversationError) {
      if (!isTransientFirestoreError(conversationError)) {
        setError(conversationError instanceof Error ? conversationError.message : "Could not start conversation.");
      }
    } finally {
      setCreating(false);
    }
  };

  const startGroupConversation = async () => {
    setCreating(true);
    setError("");
    try {
      const conversationId = await createGroupConversation(groupName, selectedGroupMembers);
      setActiveConversationId(conversationId);
      setShowNewMessage(false);
      setCreatingGroup(false);
      setGroupName("");
      setSelectedGroupMembers([]);
    } catch (groupError) {
      if (!isTransientFirestoreError(groupError)) {
        setError(groupError instanceof Error ? groupError.message : "Could not create group.");
      }
    } finally {
      setCreating(false);
    }
  };

  const loadOlderMessages = async () => {
    if (!activeConversationId || !messages[0]?.createdAt || olderMessagesLoading) return;
    setOlderMessagesLoading(true);
    try {
      const result = await getOlderConversationMessages(activeConversationId, messages[0].createdAt);
      setMessages((current) => {
        const existingIds = new Set(current.map((message) => message.id));
        return [...result.messages.filter((message) => !existingIds.has(message.id)), ...current];
      });
      setHasOlderMessages(result.hasOlder);
    } catch (loadError) {
      if (!isTransientFirestoreError(loadError)) {
        setError(loadError instanceof Error ? loadError.message : "Older messages could not be loaded.");
      }
    } finally {
      setOlderMessagesLoading(false);
    }
  };

  const shareLocation = () => {
    if (!navigator.geolocation) return setError("Location sharing is not supported by this browser.");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setDraft(`https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`),
      () => setError("Location permission was denied.")
    );
  };

  const remindAboutMessage = (message: ConversationMessage) => {
    const reminder = { messageId: message.id, conversationId: message.conversationId, text: message.text, remindAt: Date.now() + 60 * 60 * 1000 };
    const reminders = JSON.parse(localStorage.getItem("kinet:message-reminders") || "[]") as typeof reminder[];
    localStorage.setItem("kinet:message-reminders", JSON.stringify([...reminders, reminder]));
    window.setTimeout(() => {
      if (Notification.permission === "granted") new Notification("Message reminder", { body: message.text || "Open your saved message." });
    }, 60 * 60 * 1000);
    setError("Reminder set for one hour from now.");
  };

  return (
    <ProtectedRoute>
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-muted-foreground">
              {user.displayName || "Inbox"}
            </p>
            <h1 className="text-3xl font-bold">Messages</h1>
            <p className="text-sm text-muted-foreground">Story replies and direct messages, Instagram style.</p>
          </div>
          <Button variant="outline" size="icon" onClick={() => setShowNewMessage(true)} aria-label="New message">
            <Pencil className="h-4 w-4" />
          </Button>
        </div>

        {error ? (
          <div className="mb-4 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span>{error}</span>
            <button type="button" onClick={() => setError("")} aria-label="Dismiss error"><X className="h-4 w-4" /></button>
          </div>
        ) : null}

        {!isOnline ? (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            You are offline. Your draft is saved; reconnect before sending.
          </div>
        ) : null}

        {showNewMessage ? (
          <div className="mb-6 rounded-3xl border bg-background p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">{creatingGroup ? "New group" : "New message"}</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowNewMessage(false)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="mb-3 flex gap-2">
              <Button size="sm" variant={!creatingGroup ? "default" : "outline"} onClick={() => setCreatingGroup(false)}>Direct</Button>
              <Button size="sm" variant={creatingGroup ? "default" : "outline"} onClick={() => setCreatingGroup(true)}>Group</Button>
            </div>
            {creatingGroup ? <input value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="Group name" maxLength={80} className="mb-3 h-10 w-full rounded-full border bg-muted/40 px-4 text-sm outline-none" /> : null}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <input value={peopleSearch} onChange={(event) => setPeopleSearch(event.target.value)} placeholder="Search people by name or username" className="h-10 w-full rounded-full border bg-muted/40 pl-10 pr-4 text-sm outline-none" autoFocus />
            </div>
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {people.map((profile) => (
                <button key={profile.uid} type="button" onClick={() => creatingGroup ? setSelectedGroupMembers((current) => current.includes(profile.uid) ? current.filter((uid) => uid !== profile.uid) : [...current, profile.uid]) : void startConversation(profile)} className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-muted ${selectedGroupMembers.includes(profile.uid) ? "bg-primary/10" : ""}`} disabled={creating}>
                  {profile.photoURL ? <img src={profile.photoURL} alt="" className="h-10 w-10 rounded-full object-cover" /> : <DefaultAvatar username={profile.displayName || "User"} className="h-10 w-10 rounded-full" />}
                  <div className="min-w-0"><p className="truncate font-medium">{profile.displayName || "Kinet User"}</p><p className="truncate text-xs text-muted-foreground">{profile.username ? `@${profile.username}` : "Start a conversation"}</p></div>
                </button>
              ))}
              {!creating && people.length === 0 ? <p className="p-4 text-center text-sm text-muted-foreground">No people found.</p> : null}
            </div>
            {creatingGroup ? <Button className="mt-3 w-full" onClick={() => void startGroupConversation()} disabled={creating || selectedGroupMembers.length < 2 || groupName.trim().length < 2}>Create group ({selectedGroupMembers.length + 1})</Button> : null}
          </div>
        ) : null}

        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold">Active people</p>
            <div className="flex gap-2">
              <Button variant={showRequests ? "secondary" : "ghost"} size="sm" onClick={() => { setShowRequests((current) => !current); setShowArchived(false); setActiveConversationId(null); }}>
                Requests ({conversations.filter((conversation) => conversation.requestStatus === "pending" && conversation.requestedBy !== currentUserId && !conversation.hiddenBy.includes(currentUserId)).length})
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setShowArchived((current) => !current); setShowRequests(false); }}>
                {showArchived ? "Back to inbox" : "Archived"}
              </Button>
            </div>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {directPeople.length === 0 ? (
              <div className="rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">
                No active chats yet.
              </div>
            ) : (
              directPeople.map((person) => (
                <button
                  key={person.conversationId}
                  type="button"
                  onClick={() => setActiveConversationId(person.conversationId)}
                  className="flex min-w-[84px] flex-col items-center gap-2"
                >
                  <div
                    className={`rounded-full p-[2px] ${
                      person.unread ? "bg-gradient-to-br from-fuchsia-500 via-rose-500 to-amber-400" : "bg-muted"
                    }`}
                  >
                    <div className="rounded-full bg-background p-[2px]">
                      <img
                        src={person.photoURL}
                        alt={person.displayName}
                        className="h-[68px] w-[68px] rounded-full object-cover"
                      />
                    </div>
                  </div>
                  <span className="max-w-[84px] truncate text-center text-xs font-medium">{person.displayName}</span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-[330px,1fr]">
          <div className={`space-y-3 ${showConversationPane ? "hidden md:block" : ""}`}>
            <div className="relative">
              <Search className="absolute left-4 top-3.5 h-4 w-4 text-muted-foreground" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search messages"
                className="h-11 w-full rounded-full border border-input bg-muted/50 pl-11 pr-4 text-sm"
              />
            </div>

            {creating ? <p className="text-sm text-muted-foreground">Starting conversation...</p> : null}

            <div className="space-y-2">
              {visibleConversations.length === 0 ? (
                <div className="rounded-3xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No conversations yet. Start one from a profile or reply to a story.
                </div>
              ) : (
                visibleConversations.map((conversation) => {
                  const other =
                    conversation.participantProfiles.find((profile) => profile.uid !== currentUserId) ??
                    conversation.participantProfiles[0];
                  const unreadCount = conversation.unreadBy.includes(currentUserId) ? 1 : 0;
                  const muted = conversation.mutedBy.includes(currentUserId);

                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => setActiveConversationId(conversation.id)}
                    className={`w-full rounded-[28px] border p-3 text-left transition ${
                        activeConversationId === conversation.id ? "border-primary/20 bg-muted/80" : "border-transparent hover:bg-muted/60"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {other?.photoURL ? (
                          <img src={other.photoURL} alt={other.displayName || "Conversation"} className="h-14 w-14 rounded-full object-cover" />
                        ) : (
                          <DefaultAvatar username={other?.displayName || "User"} className="h-14 w-14 rounded-full" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate font-semibold">{conversation.kind === "group" ? conversation.groupName || "Group" : other?.displayName || "Conversation"}</p>
                            {conversation.pinnedBy.includes(currentUserId) ? <Pin className="h-3.5 w-3.5 shrink-0 fill-current text-primary" /> : null}
                            {conversation.updatedAt ? (
                              <span className="text-xs text-muted-foreground">
                                {formatTimeAgo(conversation.updatedAt)}
                              </span>
                            ) : null}
                          </div>
                          <p className="truncate text-sm text-muted-foreground">
                            {conversation.typingBy.includes(other?.uid || "")
                              ? "Typing..."
                              : `${conversation.lastSenderId === currentUserId ? "You: " : ""}${
                                  conversation.lastMessage || "Sent a photo"
                                }`}
                          </p>
                          <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                            <Circle className={`h-2.5 w-2.5 fill-current ${unreadCount ? "text-primary" : "text-muted-foreground/40"}`} />
                            {conversation.requestStatus === "pending" && conversation.requestedBy !== currentUserId
                              ? "Message request · Tap to review"
                              : unreadCount ? "New message" : "Open chat"}
                          </div>
                          {muted ? <p className="mt-1 text-[11px] font-medium text-muted-foreground">Muted</p> : null}
                        </div>
                        {unreadCount ? (
                          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-2 text-xs font-semibold text-primary-foreground">
                            {unreadCount}
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div
            className={`flex min-h-[640px] flex-col overflow-hidden rounded-[32px] border bg-background shadow-sm ${
              !showConversationPane ? "hidden md:flex" : ""
            }`}
          >
            {activeConversation ? (
              <>
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="md:hidden"
                      onClick={() => setActiveConversationId(null)}
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </Button>
                    {(activeConversation.kind === "group" ? activeConversation.groupPhotoURL : activeOtherUser?.photoURL) ? (
                      <img src={activeConversation.kind === "group" ? activeConversation.groupPhotoURL! : activeOtherUser!.photoURL} alt={activeConversation.kind === "group" ? activeConversation.groupName || "Group" : activeOtherUser?.displayName || "Conversation"} className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <DefaultAvatar username={activeOtherUser?.displayName || "User"} className="h-10 w-10 rounded-full" />
                    )}
                    <div>
                      <Link
                        href={activeOtherUser ? `/profile/${activeOtherUser.uid}` : "#"}
                        className="font-semibold hover:underline"
                      >
                        {activeConversation.kind === "group" ? activeConversation.groupName || "Group" : activeOtherUser?.displayName || "Conversation"}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {activeConversation.typingBy.includes(activeOtherUser?.uid || "")
                          ? "Typing..."
                          : activeConversation.kind === "group"
                            ? `${activeConversation.participantIds.length} members`
                          : otherPresence?.status === "online"
                            ? "Active now"
                            : otherPresence?.lastSeen
                              ? `Last seen ${formatTimeAgo({ seconds: Math.floor(otherPresence.lastSeen / 1000) })}`
                              : "Offline"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {autoTranslate ? (
                      <span className="hidden rounded-full border px-2 py-1 text-xs md:inline-flex">
                        Translate: {dmLanguage}
                      </span>
                    ) : null}
                    <CallPanel currentUserId={currentUserId} conversationId={activeConversation.id} participantIds={activeConversation.participantIds} title={activeConversation.kind === "group" ? activeConversation.groupName || "Group" : activeOtherUser?.displayName || "Conversation"} />
                    <Button
                      variant="ghost"
                      size="icon"
                          onClick={() =>
                            void updateConversationState(
                              activeConversation.id,
                              "mutedBy",
                              !activeConversation.mutedBy.includes(currentUserId)
                            )
                          }
                    >
                      <BellOff className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                          onClick={() =>
                            void updateConversationState(
                              activeConversation.id,
                              "archivedBy",
                              !activeConversation.archivedBy.includes(currentUserId)
                            )
                          }
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Pin conversation" onClick={() => void updateConversationState(activeConversation.id, "pinnedBy", !activeConversation.pinnedBy.includes(currentUserId))}>
                      <Pin className={`h-4 w-4 ${activeConversation.pinnedBy.includes(currentUserId) ? "fill-current text-primary" : ""}`} />
                    </Button>
                    <Button variant="ghost" size="icon" title="Mark unread" onClick={() => void markConversationUnread(activeConversation.id)}>
                      <Mail className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Conversation details" onClick={() => setShowConversationInfo((current) => !current)}>
                      <Info className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {activeConversation.requestStatus === "pending" && activeConversation.requestedBy !== currentUserId ? (
                  <div className="flex items-center justify-between gap-3 border-b bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <span>This person wants to message you. Accept before replying.</span>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => void respondToMessageRequest(activeConversation.id, true)}>Accept</Button>
                      <Button size="sm" variant="outline" onClick={() => void respondToMessageRequest(activeConversation.id, false).then(() => setActiveConversationId(null))}>Decline</Button>
                    </div>
                  </div>
                ) : null}

                {showConversationInfo ? (
                  <div className="border-b bg-muted/20 p-4">
                    <div className="mb-3 flex items-center justify-between"><div><p className="font-semibold">Conversation details</p><p className="text-xs text-muted-foreground">Media, files and privacy controls</p></div><Button variant="ghost" size="icon" onClick={() => setShowConversationInfo(false)}><X className="h-4 w-4" /></Button></div>
                    <div className="mb-4 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => void updateConversationState(activeConversation.id, "mutedBy", !activeConversation.mutedBy.includes(currentUserId))}>{activeConversation.mutedBy.includes(currentUserId) ? "Unmute" : "Mute notifications"}</Button>
                      <Button size="sm" variant="outline" onClick={() => void updateConversationState(activeConversation.id, "archivedBy", !activeConversation.archivedBy.includes(currentUserId))}>{activeConversation.archivedBy.includes(currentUserId) ? "Unarchive" : "Archive"}</Button>
                      <Button size="sm" variant="destructive" onClick={() => void updateConversationState(activeConversation.id, "hiddenBy", true).then(() => { setActiveConversationId(null); setShowConversationInfo(false); })}><EyeOff className="mr-1 h-4 w-4" />Delete chat for me</Button>
                      <Button size="sm" variant="outline" onClick={() => {
                        if (!activeOtherUser) return;
                        void reportEntity({ targetId: activeConversation.id, targetType: "conversation", reason: "unsafe_message", details: `Conversation with ${activeOtherUser.uid}` }).then(() => setError("Conversation reported to moderation."));
                      }}>Report conversation</Button>
                      <Button size="sm" variant="destructive" onClick={() => {
                        if (!activeOtherUser) return;
                        void toggleBlockedUser(activeOtherUser.uid, false).then(() => updateConversationState(activeConversation.id, "hiddenBy", true)).then(() => { setActiveConversationId(null); setError("User blocked."); });
                      }}>Block user</Button>
                      {activeConversation.kind === "group" ? <Button size="sm" variant="destructive" onClick={() => void leaveGroupConversation(activeConversation.id).then(() => { setActiveConversationId(null); setShowConversationInfo(false); })}>Leave group</Button> : null}
                    </div>
                    {activeConversation.kind === "group" ? (
                      <div className="mb-4"><p className="mb-2 text-sm font-medium">Members ({activeConversation.participantProfiles.length})</p><div className="flex flex-wrap gap-2">{activeConversation.participantProfiles.map((profile) => <span key={profile.uid} className="rounded-full border bg-background px-3 py-1 text-xs">{profile.displayName}{activeConversation.adminIds.includes(profile.uid) ? " · Admin" : ""}</span>)}</div></div>
                    ) : null}
                    <label className="mb-4 block text-sm font-medium">Who can send you new messages?
                      <select value={messagePrivacy} onChange={(event) => {
                        const value = event.target.value as UserSettings["messagePrivacy"];
                        setMessagePrivacy(value);
                        void updateCurrentUserSettings({ messagePrivacy: value });
                      }} className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm">
                        <option value="everyone">Everyone</option>
                        <option value="following">People who follow me</option>
                        <option value="no_one">No one</option>
                      </select>
                    </label>
                    <p className="mb-2 text-sm font-medium">Shared media and files</p>
                    <div className="grid max-h-52 grid-cols-3 gap-2 overflow-y-auto md:grid-cols-5">
                      {messages.filter((message) => message.attachmentUrl).map((message) => message.attachmentType?.startsWith("image/") ? (
                        <a key={message.id} href={message.attachmentUrl!} target="_blank" rel="noreferrer"><img src={message.attachmentUrl!} alt={message.attachmentName || "Shared image"} className="aspect-square w-full rounded-lg object-cover" /></a>
                      ) : (
                        <a key={message.id} href={message.attachmentUrl!} target="_blank" rel="noreferrer" className="flex aspect-square items-center justify-center rounded-lg border bg-background p-2 text-center text-xs">{message.attachmentName || "Open file"}</a>
                      ))}
                      {!messages.some((message) => message.attachmentUrl) ? <p className="col-span-full text-sm text-muted-foreground">No shared media yet.</p> : null}
                    </div>
                  </div>
                ) : null}

                <div className="flex items-center gap-2 border-b px-4 py-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <input value={messageSearch} onChange={(event) => setMessageSearch(event.target.value)} placeholder="Search this conversation" className="h-8 flex-1 bg-transparent text-sm outline-none" />
                  {selectedMessageIds.length ? (
                    <>
                      <span className="text-xs text-muted-foreground">{selectedMessageIds.length} selected</span>
                      <Button size="sm" variant="ghost" onClick={() => {
                        void Promise.all(selectedMessageIds.map((id) => toggleConversationMessageFlag(id, "hiddenFor"))).then(() => setSelectedMessageIds([]));
                      }}>Delete for me</Button>
                      <Button size="sm" variant="ghost" onClick={() => setSelectedMessageIds([])}>Cancel</Button>
                    </>
                  ) : <Button size="sm" variant="ghost" onClick={() => setShowSummary((current) => !current)}><Sparkles className="mr-1 h-3.5 w-3.5" />Summary</Button>}
                </div>
                {showSummary ? <div className="border-b bg-primary/5 px-4 py-3 text-sm"><p className="mb-1 font-medium">Conversation summary</p><p className="text-muted-foreground">{conversationSummary}</p></div> : null}

                {forwardingMessage ? (
                  <div className="border-b bg-muted/30 p-3">
                    <div className="mb-2 flex items-center justify-between"><span className="text-sm font-medium">Forward to</span><button type="button" onClick={() => setForwardingMessage(null)}><X className="h-4 w-4" /></button></div>
                    <div className="flex gap-2 overflow-x-auto">
                      {conversations.filter((conversation) => conversation.id !== activeConversationId).map((conversation) => {
                        const recipient = conversation.participantProfiles.find((profile) => profile.uid !== currentUserId);
                        return <Button key={conversation.id} size="sm" variant="outline" onClick={() => {
                          const forwardedText = forwardingMessage.text || forwardingMessage.attachmentUrl || "Shared attachment";
                          void sendConversationMessage(conversation.id, forwardedText).then(() => setForwardingMessage(null));
                        }}>{recipient?.displayName || "Conversation"}</Button>;
                      })}
                    </div>
                  </div>
                ) : null}

                <div className="flex-1 space-y-3 overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(244,114,182,0.08),_transparent_30%)] p-4">
                  {hasOlderMessages ? (
                    <div className="text-center">
                      <Button type="button" variant="ghost" size="sm" onClick={() => void loadOlderMessages()} disabled={olderMessagesLoading}>
                        {olderMessagesLoading ? "Loading..." : "Load older messages"}
                      </Button>
                    </div>
                  ) : null}
                  {messagesLoading ? (
                    <div className="flex h-full items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" /></div>
                  ) : visibleMessages.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
                      {messageSearch ? "No matching messages." : "Say hi and start the conversation."}
                    </div>
                  ) : (
                    visibleMessages.map((message) => (
                      <div
                        key={message.id}
                        id={`message-${message.id}`}
                        className={`flex rounded-xl transition ${message.id === highlightedMessageId ? "bg-primary/10 ring-2 ring-primary/30" : ""} ${message.senderId === currentUserId ? "justify-end" : "justify-start"}`}
                      >
                        <div className={`flex max-w-[86%] items-end gap-2 ${message.senderId === currentUserId ? "flex-row-reverse" : ""}`}>
                          {message.senderId !== currentUserId ? (
                            getMessageSender(message.senderId)?.photoURL ? (
                              <img src={getMessageSender(message.senderId)!.photoURL} alt={getMessageSender(message.senderId)?.displayName || "Conversation"} className="h-7 w-7 rounded-full object-cover" />
                            ) : (
                              <DefaultAvatar username={getMessageSender(message.senderId)?.displayName || "User"} className="h-7 w-7 rounded-full" />
                            )
                          ) : null}
                          <div className="max-w-[82%]">
                          {message.replyTo ? (
                            <div className="mb-1 rounded-xl border-l-2 border-primary bg-muted/70 px-3 py-2 text-xs text-muted-foreground">
                              <p className="font-medium">Replying to {message.replyTo.senderId === currentUserId ? "yourself" : activeOtherUser?.displayName || "message"}</p>
                              <p className="truncate">{message.replyTo.text || "Attachment"}</p>
                            </div>
                          ) : null}
                          {message.attachmentUrl ? (
                            message.attachmentType?.startsWith("image/") ? (
                              <img
                                src={message.attachmentUrl}
                                alt="Attachment"
                                className="mb-2 max-h-64 rounded-3xl object-cover shadow-sm"
                              />
                            ) : message.attachmentType?.startsWith("video/") ? (
                              <video src={message.attachmentUrl} controls preload="metadata" className="mb-2 max-h-72 rounded-3xl" />
                            ) : message.attachmentType?.startsWith("audio/") ? (
                              <audio src={message.attachmentUrl} controls preload="metadata" className="mb-2 max-w-full" />
                            ) : (
                              <a
                                href={message.attachmentUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="mb-2 block rounded-2xl border px-4 py-3 text-sm underline"
                              >
                                {message.attachmentName || "Open attachment"}
                              </a>
                            )
                          ) : null}

                          <div
                            className={`rounded-[24px] px-4 py-3 text-sm shadow-sm ${
                              message.senderId === currentUserId
                                ? "bg-gradient-to-r from-fuchsia-500 via-rose-500 to-orange-400 text-white"
                                : "border border-border/60 bg-white"
                            }`}
                          >
                            {editingMessageId === message.id ? (
                              <div className="space-y-2">
                                <input
                                  value={editingText}
                                  onChange={(event) => setEditingText(event.target.value)}
                                  className="h-9 w-full rounded-full border border-input bg-background px-3 text-sm text-foreground"
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    type="button"
                                    onClick={() =>
                                      void updateConversationMessage(message.id, editingText).then(() =>
                                        setEditingMessageId(null)
                                      )
                                    }
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    type="button"
                                    onClick={() => setEditingMessageId(null)}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <>
                                {message.text ? <MessageText text={message.text} /> : null}
                                {autoTranslate && message.senderId !== currentUserId && message.text ? (
                                  <p className="mt-2 text-xs text-muted-foreground">
                                    {translateMessagePreview(message.text, dmLanguage)}
                                  </p>
                                ) : null}
                              </>
                            )}
                          </div>

                          <div
                            className={`mt-1 px-2 text-xs text-muted-foreground ${
                              message.senderId === currentUserId ? "text-right" : "text-left"
                            }`}
                          >
                            {formatTimeAgo(message.createdAt)}
                            {message.senderId === currentUserId
                              ? message.clientStatus === "queued"
                                ? " • Queued"
                                : message.clientStatus === "pending"
                                  ? " • Sending..."
                                : message.clientStatus === "failed"
                                  ? " • Failed"
                                  : message.readBy.length > 1
                                    ? " • Seen"
                                    : " • Sent"
                              : ""}
                          </div>

                          {message.senderId === currentUserId && message.clientStatus === "failed" ? (
                            <button type="button" className="mt-1 px-2 text-xs font-medium text-red-600" onClick={() => void retryMessage(message)}>
                              Retry
                            </button>
                          ) : null}

                          {Object.entries(message.reactions).some(([, users]) => users.length) ? (
                            <div className="mt-1 flex flex-wrap gap-1 px-1">
                              {Object.entries(message.reactions).filter(([, users]) => users.length).map(([emoji, users]) => (
                                <button key={emoji} type="button" onClick={() => void toggleConversationMessageReaction(message.id, emoji)} className={`rounded-full border px-2 py-0.5 text-xs ${users.includes(currentUserId) ? "bg-primary/10" : "bg-background"}`}>{emoji} {users.length}</button>
                              ))}
                            </div>
                          ) : null}

                          {!message.clientStatus ? (
                            <div className={`relative mt-1 flex px-1 ${message.senderId === currentUserId ? "justify-end" : "justify-start"}`}>
                              <button type="button" aria-label="Message options" aria-expanded={openMessageMenuId === message.id} onClick={() => setOpenMessageMenuId((current) => current === message.id ? null : message.id)} className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><MoreVertical className="h-4 w-4" /></button>
                              {openMessageMenuId === message.id ? (
                                <div className={`absolute top-7 z-40 w-48 overflow-hidden rounded-2xl border bg-background p-1.5 text-sm shadow-xl ${message.senderId === currentUserId ? "right-0" : "left-0"}`}>
                                  <button type="button" onClick={() => { setReplyingTo(message); setOpenMessageMenuId(null); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 hover:bg-muted"><Reply className="h-4 w-4" />Reply</button>
                                  <button type="button" onClick={() => { void toggleConversationMessageReaction(message.id, "❤️"); setOpenMessageMenuId(null); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 hover:bg-muted"><span>❤️</span>React</button>
                                  <button type="button" onClick={() => { void navigator.clipboard.writeText(message.text); setOpenMessageMenuId(null); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 hover:bg-muted"><Copy className="h-4 w-4" />Copy</button>
                                  <button type="button" onClick={() => { setForwardingMessage(message); setOpenMessageMenuId(null); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 hover:bg-muted"><Forward className="h-4 w-4" />Forward</button>
                                  <button type="button" onClick={() => { void toggleConversationMessageFlag(message.id, "pinnedBy"); setOpenMessageMenuId(null); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 hover:bg-muted"><Pin className="h-4 w-4" />{message.pinnedBy.includes(currentUserId) ? "Unpin" : "Pin"}</button>
                                  <button type="button" onClick={() => { void toggleConversationMessageFlag(message.id, "savedBy"); setOpenMessageMenuId(null); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 hover:bg-muted"><Bookmark className="h-4 w-4" />{message.savedBy.includes(currentUserId) ? "Unsave" : "Save"}</button>
                                  <button type="button" onClick={() => { setSelectedMessageIds((current) => current.includes(message.id) ? current.filter((id) => id !== message.id) : [...current, message.id]); setOpenMessageMenuId(null); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 hover:bg-muted"><CheckSquare className="h-4 w-4" />Select</button>
                                  <button type="button" onClick={() => { void reportEntity({ targetId: message.id, targetType: "message", reason: "unsafe_message", details: message.text.slice(0, 500) }).then(() => setError("Message reported to moderation.")); setOpenMessageMenuId(null); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-destructive hover:bg-destructive/10"><Info className="h-4 w-4" />Report</button>
                                  {message.senderId === currentUserId && !message.deleted ? <div className="mt-1 border-t pt-1"><button type="button" onClick={() => { setEditingMessageId(message.id); setEditingText(message.text); setOpenMessageMenuId(null); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 hover:bg-muted"><Pencil className="h-4 w-4" />Edit</button><button type="button" onClick={() => { void deleteConversationMessage(message.id); setOpenMessageMenuId(null); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" />Unsend</button></div> : null}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <form className="border-t bg-background p-4" onSubmit={handleSend}>
                  {replyingTo ? (
                    <div className="mb-3 flex items-center justify-between rounded-2xl border-l-2 border-primary bg-muted px-4 py-2 text-sm">
                      <div className="min-w-0"><p className="text-xs font-medium">Replying to {replyingTo.senderId === currentUserId ? "yourself" : activeOtherUser?.displayName}</p><p className="truncate text-xs text-muted-foreground">{replyingTo.text || "Attachment"}</p></div>
                      <button type="button" onClick={() => setReplyingTo(null)}><X className="h-4 w-4" /></button>
                    </div>
                  ) : null}
                  {attachment ? (
                    <div className="mb-3 flex items-center justify-between rounded-2xl bg-muted px-4 py-3 text-sm">
                      <span className="truncate">Ready to send: {attachment.name}</span>
                      <button
                        type="button"
                        className="text-xs font-medium text-muted-foreground"
                        onClick={() => setAttachment(null)}
                      >
                        Remove
                      </button>
                    </div>
                  ) : null}
                  {uploadProgress !== null ? (
                    <div className="mb-3">
                      <div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>Uploading attachment</span><span>{uploadProgress}%</span></div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${uploadProgress}%` }} /></div>
                    </div>
                  ) : null}

                  <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full bg-muted px-3 py-1">Send photo</span>
                    <span className="rounded-full bg-muted px-3 py-1">Share reel</span>
                    <span className="rounded-full bg-muted px-3 py-1">Voice soon</span>
                  </div>

                  <div className="mb-3 flex gap-2 overflow-x-auto">
                    {smartReplies.map((reply) => <button key={reply} type="button" onClick={() => setDraft(reply)} className="whitespace-nowrap rounded-full border bg-background px-3 py-1.5 text-xs hover:bg-muted">{reply}</button>)}
                  </div>

                  <div className="mb-3 flex items-center gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={shareLocation}><MapPin className="mr-1 h-4 w-4" />Location</Button>
                    <select value={expiresInSeconds ?? ""} onChange={(event) => setExpiresInSeconds(event.target.value ? Number(event.target.value) : null)} className="h-9 rounded-md border bg-background px-3 text-xs">
                      <option value="">Keep message</option>
                      <option value="300">Disappear after 5 minutes</option>
                      <option value="3600">Disappear after 1 hour</option>
                      <option value="86400">Disappear after 24 hours</option>
                      <option value="604800">Disappear after 7 days</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2 rounded-full border bg-background px-3 py-2 shadow-sm">
                    <label className="flex cursor-pointer items-center justify-center text-muted-foreground">
                      <ImagePlus className="h-5 w-5" />
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime,audio/*,.pdf,.doc,.docx,.txt"
                        className="hidden"
                        onChange={(event: ChangeEvent<HTMLInputElement>) => {
                          const file = event.target.files?.[0] ?? null;
                          if (!file) return setAttachment(null);
                          try {
                            validateMessageAttachment(file);
                            setError("");
                            setAttachment(file);
                          } catch (validationError) {
                            setAttachment(null);
                            setError(validationError instanceof Error ? validationError.message : "Invalid attachment.");
                            event.target.value = "";
                          }
                        }}
                      />
                    </label>
                    <input
                      value={draft}
                      disabled={!canSendToActiveConversation}
                      onChange={async (event) => {
                        setDraft(event.target.value);
                        if (activeConversationId) {
                          localStorage.setItem(`kinet:message-draft:${activeConversationId}`, event.target.value);
                          await setConversationTyping(activeConversationId, Boolean(event.target.value.trim()));
                        }
                      }}
                      placeholder={canSendToActiveConversation ? "Message..." : "Accept this request to reply"}
                      className="h-10 w-full bg-transparent px-1 text-sm outline-none"
                    />
                    <Button type="submit" size="icon" className="rounded-full" disabled={!canSendToActiveConversation || sending || (!draft.trim() && !attachment)}>
                      <SendHorizontal className="h-4 w-4" />
                    </Button>
                  </div>
                </form>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center px-6 text-center">
                <div>
                  <h2 className="text-xl font-semibold">Your messages</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Send private photos, story replies, and direct messages.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[70vh] items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" /></div>}>
      <AuthProvider>
        <MessagesPageContent />
      </AuthProvider>
    </Suspense>
  );
}
