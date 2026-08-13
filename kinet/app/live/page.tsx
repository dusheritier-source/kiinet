"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { AuthProvider } from "@/components/AuthProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  askLiveQuestion,
  createLiveRoom,
  createReplayClip,
  endLiveRoom,
  getLiveQuestions,
  getLiveRooms,
  getReplayClips,
  pinLiveComment,
  sendLiveChatMessage,
  subscribeToLiveChat,
  type LiveChatMessage,
  type LiveQuestionRecord,
  type LiveRoomRecord,
  type ReplayClipRecord,
} from "@/lib/phase7";

function LivePageContent() {
  const [rooms, setRooms] = useState<LiveRoomRecord[]>([]);
  const [activeRoomId, setActiveRoomId] = useState("");
  const [chatMessages, setChatMessages] = useState<LiveChatMessage[]>([]);
  const [questions, setQuestions] = useState<LiveQuestionRecord[]>([]);
  const [replayClips, setReplayClips] = useState<ReplayClipRecord[]>([]);
  const [roomForm, setRoomForm] = useState({ title: "", sponsorLabel: "", scoreOverlay: "", paidTicketLabel: "" });
  const [chatDraft, setChatDraft] = useState("");
  const [questionDraft, setQuestionDraft] = useState("");
  const [replayForm, setReplayForm] = useState({ title: "", startSec: "0", endSec: "30" });

  const refresh = useCallback(async (roomId = "") => {
    const nextRooms = await getLiveRooms();
    setRooms(nextRooms);
    if (roomId) {
      const [nextQuestions, nextReplays] = await Promise.all([
        getLiveQuestions(roomId),
        getReplayClips(roomId),
      ]);
      setQuestions(nextQuestions);
      setReplayClips(nextReplays);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!activeRoomId && rooms[0]) {
      setActiveRoomId(rooms[0].id);
    }
  }, [activeRoomId, rooms]);

  useEffect(() => {
    if (!activeRoomId) {
      setChatMessages([]);
      return;
    }
    void refresh(activeRoomId);
    return subscribeToLiveChat(activeRoomId, setChatMessages);
  }, [activeRoomId, refresh]);

  const activeRoom = useMemo(() => rooms.find((room) => room.id === activeRoomId) ?? null, [activeRoomId, rooms]);

  return (
    <ProtectedRoute>
      <div className="mx-auto max-w-7xl space-y-6 py-8">
        <div>
          <h1 className="text-3xl font-bold">Live Rooms</h1>
          <p className="text-muted-foreground">Host livestream rooms, run live chat, pin comments, save replay clips, sell tickets, and surface sponsor plus scoreboard overlays.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.9fr,1.1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Go Live</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input value={roomForm.title} onChange={(event) => setRoomForm((current) => ({ ...current, title: event.target.value }))} placeholder="Live room title" />
              <Input value={roomForm.sponsorLabel} onChange={(event) => setRoomForm((current) => ({ ...current, sponsorLabel: event.target.value }))} placeholder="Sponsor overlay label" />
              <Input value={roomForm.scoreOverlay} onChange={(event) => setRoomForm((current) => ({ ...current, scoreOverlay: event.target.value }))} placeholder="Scoreboard overlay text" />
              <Input value={roomForm.paidTicketLabel} onChange={(event) => setRoomForm((current) => ({ ...current, paidTicketLabel: event.target.value }))} placeholder="Paid ticket label" />
              <Button onClick={() => void createLiveRoom(roomForm).then(() => { setRoomForm({ title: "", sponsorLabel: "", scoreOverlay: "", paidTicketLabel: "" }); refresh(); })}>
                Create Live Room
              </Button>
              <div className="space-y-2">
                {rooms.map((room) => (
                  <button key={room.id} type="button" onClick={() => setActiveRoomId(room.id)} className={`w-full rounded-xl border p-3 text-left ${activeRoomId === room.id ? "border-primary bg-primary/5" : ""}`}>
                    <p className="font-semibold">{room.title}</p>
                    <p className="text-xs text-muted-foreground">{[room.status, room.sponsorLabel, room.scoreOverlay, room.paidTicketLabel].filter(Boolean).join(" • ")}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{activeRoom?.title || "Select a room"}</CardTitle>
              <CardDescription>Live chat, pinned comments, Q&A, and replay workflow.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {activeRoom ? (
                <>
                  <div className="rounded-2xl border bg-black p-6 text-white">
                    <p className="text-lg font-semibold">Live preview placeholder</p>
                    {activeRoom.sponsorLabel ? <p className="mt-2 text-amber-300">Sponsor: {activeRoom.sponsorLabel}</p> : null}
                    {activeRoom.scoreOverlay ? <p className="mt-2 text-sm">Scoreboard: {activeRoom.scoreOverlay}</p> : null}
                    {activeRoom.paidTicketLabel ? <p className="mt-2 text-sm">Ticketed access: {activeRoom.paidTicketLabel}</p> : null}
                    <Button className="mt-4" variant="outline" onClick={() => void endLiveRoom(activeRoom.id).then(() => refresh(activeRoom.id))}>End Stream</Button>
                  </div>

                  <div className="grid gap-6 lg:grid-cols-2">
                    <div className="space-y-3">
                      <p className="font-semibold">Live Chat</p>
                      <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border p-3">
                        {chatMessages.map((message) => (
                          <div key={message.id} className="rounded-lg bg-muted p-2 text-sm">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium">{message.senderName}</span>
                              <Button size="sm" variant="outline" onClick={() => void pinLiveComment(message.id, !message.pinned).then(() => refresh(activeRoom.id))}>
                                {message.pinned ? "Unpin" : "Pin"}
                              </Button>
                            </div>
                            <p className="mt-1">{message.text}</p>
                            {message.pinned ? <p className="mt-1 text-xs text-primary">Pinned comment</p> : null}
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-3">
                        <Input value={chatDraft} onChange={(event) => setChatDraft(event.target.value)} placeholder="Send live chat message" />
                        <Button onClick={() => void sendLiveChatMessage(activeRoom.id, chatDraft).then(() => setChatDraft(""))}>Send</Button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <p className="font-semibold">Live Q&A</p>
                      <textarea value={questionDraft} onChange={(event) => setQuestionDraft(event.target.value)} placeholder="Ask a live question" className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                      <Button onClick={() => void askLiveQuestion(activeRoom.id, questionDraft).then(() => { setQuestionDraft(""); refresh(activeRoom.id); })}>Submit Question</Button>
                      <div className="space-y-2">
                        {questions.map((question) => (
                          <div key={question.id} className="rounded-xl border p-3 text-sm">
                            <p className="font-medium">{question.askerName}</p>
                            <p className="text-muted-foreground">{question.question}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border p-4">
                    <p className="font-semibold">Replay Archive</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-4">
                      <Input value={replayForm.title} onChange={(event) => setReplayForm((current) => ({ ...current, title: event.target.value }))} placeholder="Clip title" />
                      <Input value={replayForm.startSec} onChange={(event) => setReplayForm((current) => ({ ...current, startSec: event.target.value }))} placeholder="Start sec" />
                      <Input value={replayForm.endSec} onChange={(event) => setReplayForm((current) => ({ ...current, endSec: event.target.value }))} placeholder="End sec" />
                      <Button onClick={() => void createReplayClip({ roomId: activeRoom.id, title: replayForm.title, startSec: Number(replayForm.startSec), endSec: Number(replayForm.endSec) }).then(() => { setReplayForm({ title: "", startSec: "0", endSec: "30" }); refresh(activeRoom.id); })}>Save Replay Clip</Button>
                    </div>
                    <div className="mt-3 space-y-2">
                      {replayClips.map((clip) => (
                        <div key={clip.id} className="rounded-lg bg-muted p-3 text-sm">
                          <p className="font-medium">{clip.title}</p>
                          <p className="text-muted-foreground">{clip.startSec}s - {clip.endSec}s</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">Create or select a live room to manage it.</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  );
}

export default function LivePage() {
  return (
    <AuthProvider>
      <LivePageContent />
    </AuthProvider>
  );
}
