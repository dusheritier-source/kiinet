"use client";

import { ChangeEvent, FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArrowLeft,
  BellOff,
  Circle,
  Info,
  ImagePlus,
  MoreHorizontal,
  Pencil,
  Phone,
  Search,
  SendHorizontal,
  Trash2,
  Video,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

import { AuthProvider, useAuthContext } from "@/components/AuthProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import {
  createOrGetConversation,
  deleteConversationMessage,
  markConversationRead,
  sendConversationMessage,
  setConversationTyping,
  subscribeToConversationMessages,
  subscribeToConversations,
  updateConversationMessage,
  updateConversationState,
  type ConversationMessage,
  type ConversationSummary,
} from "@/lib/messaging";
import { getPlatformPreferences, translateMessagePreview } from "@/lib/phase9";
import { formatTimeAgo } from "@/lib/posts";

function MessagesPageContent() {
  const { user } = useAuthContext();
  const currentUserId = user?.uid ?? "";
  const searchParams = useSearchParams();
  const starterUser = searchParams.get("user");
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

  useEffect(() => {
    if (!user) {
      return;
    }

    return subscribeToConversations(user.uid, setConversations);
  }, [user]);

  useEffect(() => {
    void getPlatformPreferences().then((preferences) => {
      setAutoTranslate(preferences.autoTranslateDms);
      setDmLanguage(preferences.dmTranslationLanguage);
    });
  }, []);

  useEffect(() => {
    if (!user || !starterUser || starterUser === user.uid) {
      return;
    }

    setCreating(true);
    createOrGetConversation(starterUser)
      .then((conversationId) => setActiveConversationId(conversationId))
      .finally(() => setCreating(false));
  }, [starterUser, user]);

  useEffect(() => {
    if (!activeConversationId) {
      return;
    }

    void markConversationRead(activeConversationId);
    return subscribeToConversationMessages(activeConversationId, setMessages);
  }, [activeConversationId]);

  const visibleConversations = useMemo(() => {
    if (!user) {
      return [];
    }

    return conversations
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
      });
  }, [conversations, searchTerm, showArchived, user]);

  const activeConversation = useMemo(
    () => visibleConversations.find((conversation) => conversation.id === activeConversationId) ?? null,
    [activeConversationId, visibleConversations]
  );

  const directPeople = useMemo(
    () =>
      visibleConversations.slice(0, 10).map((conversation) => {
        const other =
          conversation.participantProfiles.find((profile) => profile.uid !== currentUserId) ??
          conversation.participantProfiles[0];

        return {
          conversationId: conversation.id,
          displayName: other?.displayName || "Conversation",
          photoURL: other?.photoURL || "https://placehold.co/80x80?text=D",
          unread: conversation.unreadBy.includes(currentUserId),
        };
      }),
    [currentUserId, visibleConversations]
  );

  if (!user) {
    return null;
  }

  const showConversationPane = Boolean(activeConversation);
  const activeOtherUser =
    activeConversation?.participantProfiles.find((profile) => profile.uid !== currentUserId) ??
    activeConversation?.participantProfiles[0] ??
    null;

  const handleSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeConversationId || (!draft.trim() && !attachment)) {
      return;
    }

    await sendConversationMessage(activeConversationId, draft, attachment);
    setDraft("");
    setAttachment(null);
    await setConversationTyping(activeConversationId, false);
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
          <Button variant="outline" size="icon">
            <Pencil className="h-4 w-4" />
          </Button>
        </div>

        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold">Active people</p>
            <Button variant="ghost" size="sm" onClick={() => setShowArchived((current) => !current)}>
              {showArchived ? "Back to inbox" : "Archived"}
            </Button>
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
                        <img
                          src={other?.photoURL || "https://placehold.co/64x64?text=M"}
                          alt={other?.displayName || "Conversation"}
                          className="h-14 w-14 rounded-full object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate font-semibold">{other?.displayName || "Conversation"}</p>
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
                            {unreadCount ? "New message" : "Open chat"}
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
                    <img
                      src={activeOtherUser?.photoURL || "https://placehold.co/64x64?text=C"}
                      alt={activeOtherUser?.displayName || "Conversation"}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                    <div>
                      <Link
                        href={activeOtherUser ? `/profile/${activeOtherUser.uid}` : "#"}
                        className="font-semibold hover:underline"
                      >
                        {activeOtherUser?.displayName || "Conversation"}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {activeConversation.typingBy.includes(activeOtherUser?.uid || "")
                          ? "Typing..."
                          : "Active now"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {autoTranslate ? (
                      <span className="hidden rounded-full border px-2 py-1 text-xs md:inline-flex">
                        Translate: {dmLanguage}
                      </span>
                    ) : null}
                    <Button variant="ghost" size="icon">
                      <Phone className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <Video className="h-4 w-4" />
                    </Button>
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
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(244,114,182,0.08),_transparent_30%)] p-4">
                  {messages.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
                      Say hi and start the conversation.
                    </div>
                  ) : (
                    messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.senderId === currentUserId ? "justify-end" : "justify-start"}`}
                      >
                        <div className={`flex max-w-[86%] items-end gap-2 ${message.senderId === currentUserId ? "flex-row-reverse" : ""}`}>
                          {message.senderId !== currentUserId ? (
                            <img
                              src={activeOtherUser?.photoURL || "https://placehold.co/64x64?text=C"}
                              alt={activeOtherUser?.displayName || "Conversation"}
                              className="h-7 w-7 rounded-full object-cover"
                            />
                          ) : null}
                          <div className="max-w-[82%]">
                          {message.attachmentUrl ? (
                            message.attachmentType?.startsWith("image/") ? (
                              <img
                                src={message.attachmentUrl}
                                alt="Attachment"
                                className="mb-2 max-h-64 rounded-3xl object-cover shadow-sm"
                              />
                            ) : (
                              <a
                                href={message.attachmentUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="mb-2 block rounded-2xl border px-4 py-3 text-sm underline"
                              >
                                Open attachment
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
                                {message.text ? <p>{message.text}</p> : null}
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
                            {message.senderId === currentUserId && message.readBy.length > 1 ? " • Seen" : ""}
                          </div>

                          {message.senderId === currentUserId && !message.deleted ? (
                            <div className="mt-1 flex gap-3 px-2 text-xs text-muted-foreground">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingMessageId(message.id);
                                  setEditingText(message.text);
                                }}
                              >
                                <Pencil className="mr-1 inline h-3 w-3" />
                                Edit
                              </button>
                              <button type="button" onClick={() => void deleteConversationMessage(message.id)}>
                                <Trash2 className="mr-1 inline h-3 w-3" />
                                Delete
                              </button>
                            </div>
                          ) : null}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <form className="border-t bg-background p-4" onSubmit={handleSend}>
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

                  <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full bg-muted px-3 py-1">Send photo</span>
                    <span className="rounded-full bg-muted px-3 py-1">Share reel</span>
                    <span className="rounded-full bg-muted px-3 py-1">Voice soon</span>
                  </div>

                  <div className="flex items-center gap-2 rounded-full border bg-background px-3 py-2 shadow-sm">
                    <label className="flex cursor-pointer items-center justify-center text-muted-foreground">
                      <ImagePlus className="h-5 w-5" />
                      <input
                        type="file"
                        accept="image/*,video/*,.pdf,.doc,.docx"
                        className="hidden"
                        onChange={(event: ChangeEvent<HTMLInputElement>) => setAttachment(event.target.files?.[0] ?? null)}
                      />
                    </label>
                    <input
                      value={draft}
                      onChange={async (event) => {
                        setDraft(event.target.value);
                        if (activeConversationId) {
                          await setConversationTyping(activeConversationId, Boolean(event.target.value.trim()));
                        }
                      }}
                      placeholder="Message..."
                      className="h-10 w-full bg-transparent px-1 text-sm outline-none"
                    />
                    <Button type="submit" size="icon" className="rounded-full" disabled={!draft.trim() && !attachment}>
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
