"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AuthProvider, useAuthContext } from "@/components/AuthProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  buildCountdownWidget,
  buildGamedayGraphic,
  buildPrintablePoster,
  buildReplayEnhancementSummary,
  buildSocialHighlightCard,
  createFilmSession,
  getCameraScenes,
  getClipAssignments,
  getCollaborationBoards,
  getCommentaryThreads,
  getDrillRubrics,
  getFilmSessions,
  getGuidedWorkouts,
  getLiveStatOverlays,
  getPressCredentials,
  getVideoReviewTasks,
  getVoiceNotes,
  saveCameraScene,
  saveClipAssignment,
  saveCollaborationBoard,
  saveCommentaryThread,
  saveDrillRubric,
  saveLiveStatOverlay,
  savePressCredential,
  saveVideoReviewTask,
  saveVoiceNote,
  type CameraSceneRecord,
  type ClipAssignmentRecord,
  type CollaborationBoardRecord,
  type CommentaryThreadRecord,
  type DrillRubricRecord,
  type FilmSessionRecord,
  type LiveStatOverlayRecord,
  type PressCredentialRecord,
  type VideoReviewTaskRecord,
  type VoiceNoteRecord,
} from "@/lib/phase2";
import { getLiveRooms, getReplayClips, type LiveRoomRecord, type ReplayClipRecord } from "@/lib/phase7";
import { subscribeToUserPosts, type FeedPost } from "@/lib/posts";

function StudioPageContent() {
  const { user } = useAuthContext();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [rooms, setRooms] = useState<LiveRoomRecord[]>([]);
  const [replayClips, setReplayClips] = useState<ReplayClipRecord[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [selectedPostId, setSelectedPostId] = useState("");
  const [cameraScenes, setCameraScenes] = useState<CameraSceneRecord[]>([]);
  const [statOverlays, setStatOverlays] = useState<LiveStatOverlayRecord[]>([]);
  const [filmSessions, setFilmSessions] = useState<FilmSessionRecord[]>([]);
  const [clipAssignments, setClipAssignments] = useState<ClipAssignmentRecord[]>([]);
  const [drillRubrics, setDrillRubrics] = useState<DrillRubricRecord[]>([]);
  const [voiceNotes, setVoiceNotes] = useState<VoiceNoteRecord[]>([]);
  const [boards, setBoards] = useState<CollaborationBoardRecord[]>([]);
  const [videoTasks, setVideoTasks] = useState<VideoReviewTaskRecord[]>([]);
  const [threads, setThreads] = useState<CommentaryThreadRecord[]>([]);
  const [credentials, setCredentials] = useState<PressCredentialRecord[]>([]);
  const [cameraForm, setCameraForm] = useState({ label: "", angle: "", active: false });
  const [overlayForm, setOverlayForm] = useState({ headline: "", statLine: "" });
  const [filmForm, setFilmForm] = useState({ teamId: "", title: "", agenda: "" });
  const filmTeamIdRef = useRef("");
  filmTeamIdRef.current = filmForm.teamId;
  const [assignmentForm, setAssignmentForm] = useState({ athleteName: "", focus: "" });
  const [rubricForm, setRubricForm] = useState({ drillTitle: "", metrics: "Footwork:4,Reads:3,Finish:3" });
  const [voiceForm, setVoiceForm] = useState({ label: "", transcript: "" });
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [boardForm, setBoardForm] = useState({ title: "", notes: "" });
  const [taskForm, setTaskForm] = useState({ athleteName: "", task: "" });
  const [threadForm, setThreadForm] = useState({ authorName: "", comment: "" });
  const [credentialForm, setCredentialForm] = useState({ requesterName: "", outlet: "" });
  const [graphicsForm, setGraphicsForm] = useState({ athlete: "Kinet Athlete", headline: "Locked in for game day", stat: "24 PTS • 8 AST", matchup: "Hoopers vs Rivals", tipoff: "7:00 PM", venue: "Downtown Arena", posterTitle: "Big Night", posterSubtitle: "Built for the moment", posterCallout: "Show up loud.", countdownLabel: "Showcase Weekend", countdownDate: "2026-04-20" });

  const refresh = useCallback(async (roomId = "", postId = "", teamId = filmTeamIdRef.current) => {
    const [nextRooms, nextFilmSessions, nextRubrics, nextVoiceNotes, nextBoards] = await Promise.all([
      getLiveRooms(),
      teamId ? getFilmSessions(teamId) : Promise.resolve([]),
      getDrillRubrics(),
      getVoiceNotes(),
      getCollaborationBoards(),
    ]);
    setRooms(nextRooms);
    setFilmSessions(nextFilmSessions);
    setDrillRubrics(nextRubrics);
    setVoiceNotes(nextVoiceNotes);
    setBoards(nextBoards);

    if (roomId) {
      const [nextScenes, nextOverlays, nextCredentials, nextReplays] = await Promise.all([
        getCameraScenes(roomId),
        getLiveStatOverlays(roomId),
        getPressCredentials(roomId),
        getReplayClips(roomId),
      ]);
      setCameraScenes(nextScenes);
      setStatOverlays(nextOverlays);
      setCredentials(nextCredentials);
      setReplayClips(nextReplays);
    } else {
      setCameraScenes([]);
      setStatOverlays([]);
      setCredentials([]);
      setReplayClips([]);
    }

    if (postId) {
      const [nextAssignments, nextTasks, nextThreads] = await Promise.all([
        getClipAssignments(postId),
        getVideoReviewTasks(postId),
        getCommentaryThreads(postId),
      ]);
      setClipAssignments(nextAssignments);
      setVideoTasks(nextTasks);
      setThreads(nextThreads);
    } else {
      setClipAssignments([]);
      setVideoTasks([]);
      setThreads([]);
    }
  }, []);

  useEffect(() => {
    void refresh("", "", "");
  }, [refresh]);

  useEffect(() => {
    if (!selectedRoomId && rooms[0]) {
      setSelectedRoomId(rooms[0].id);
    }
  }, [rooms, selectedRoomId]);

  useEffect(() => {
    if (selectedRoomId || selectedPostId) {
      void refresh(selectedRoomId, selectedPostId, filmForm.teamId);
    }
  }, [filmForm.teamId, refresh, selectedPostId, selectedRoomId]);

  useEffect(() => {
    if (!user) {
      return;
    }
    return subscribeToUserPosts(user.uid, (nextPosts) => {
      setPosts(nextPosts.filter((post) => Boolean(post.mediaUrl)));
    });
  }, [user]);

  const selectedReplayInsight = useMemo(() => {
    const clip = replayClips[0];
    if (!clip) return "Create or select a replay clip to unlock enhancement suggestions.";
    return buildReplayEnhancementSummary(Math.max(0, clip.endSec - clip.startSec));
  }, [replayClips]);

  const socialCard = useMemo(() => buildSocialHighlightCard(graphicsForm), [graphicsForm]);
  const gamedayGraphic = useMemo(() => buildGamedayGraphic(graphicsForm), [graphicsForm]);
  const posterCopy = useMemo(() => buildPrintablePoster({ title: graphicsForm.posterTitle, subtitle: graphicsForm.posterSubtitle, callout: graphicsForm.posterCallout }), [graphicsForm.posterCallout, graphicsForm.posterSubtitle, graphicsForm.posterTitle]);
  const countdownWidget = useMemo(() => buildCountdownWidget({ label: graphicsForm.countdownLabel, eventDate: graphicsForm.countdownDate }), [graphicsForm.countdownDate, graphicsForm.countdownLabel]);

  return (
    <ProtectedRoute>
      <div className="mx-auto max-w-7xl space-y-6 py-8">
        <div>
          <h1 className="text-3xl font-bold">Broadcast Studio</h1>
          <p className="text-muted-foreground">Multi-camera livestream control, stat overlays, film rooms, clip assignments, scout voice notes, guided sessions, replay upgrades, and creative assets.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Broadcast Control</CardTitle>
              <CardDescription>Multi-camera switching, live stat overlays, replay enhancements, and press credential review.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={selectedRoomId} onChange={(event) => setSelectedRoomId(event.target.value)}>
                <option value="">Choose live room</option>
                {rooms.map((room) => <option key={room.id} value={room.id}>{room.title}</option>)}
              </select>
              <div className="grid gap-3 md:grid-cols-3">
                <Input value={cameraForm.label} onChange={(event) => setCameraForm((current) => ({ ...current, label: event.target.value }))} placeholder="Camera label" />
                <Input value={cameraForm.angle} onChange={(event) => setCameraForm((current) => ({ ...current, angle: event.target.value }))} placeholder="Angle / zone" />
                <label className="flex items-center justify-between rounded-md border px-3 text-sm">
                  <span>Active</span>
                  <input type="checkbox" checked={cameraForm.active} onChange={(event) => setCameraForm((current) => ({ ...current, active: event.target.checked }))} />
                </label>
              </div>
              <Button disabled={!selectedRoomId} onClick={() => void saveCameraScene({ roomId: selectedRoomId, ...cameraForm }).then(() => { setCameraForm({ label: "", angle: "", active: false }); return refresh(selectedRoomId, selectedPostId); })}>Save Camera Scene</Button>
              <div className="space-y-2 text-sm">
                {cameraScenes.map((scene) => <div key={scene.id} className="rounded-lg bg-muted p-3">{scene.label} • {scene.angle} • {scene.active ? "Live angle" : "Standby"}</div>)}
              </div>

              <div className="grid gap-3 border-t pt-4 md:grid-cols-2">
                <Input value={overlayForm.headline} onChange={(event) => setOverlayForm((current) => ({ ...current, headline: event.target.value }))} placeholder="Overlay headline" />
                <Input value={overlayForm.statLine} onChange={(event) => setOverlayForm((current) => ({ ...current, statLine: event.target.value }))} placeholder="Stat line" />
              </div>
              <Button variant="outline" disabled={!selectedRoomId} onClick={() => void saveLiveStatOverlay({ roomId: selectedRoomId, ...overlayForm }).then(() => { setOverlayForm({ headline: "", statLine: "" }); return refresh(selectedRoomId, selectedPostId); })}>Add Stat Overlay</Button>
              <div className="space-y-2 text-sm">
                {statOverlays.map((overlay) => <div key={overlay.id} className="rounded-lg bg-muted p-3">{overlay.headline} • {overlay.statLine}</div>)}
              </div>

              <div className="rounded-xl border p-4 text-sm">{selectedReplayInsight}</div>
              <div className="space-y-2 text-sm">
                {replayClips.map((clip) => <div key={clip.id} className="rounded-lg bg-muted p-3">{clip.title} • {clip.startSec}s-{clip.endSec}s</div>)}
              </div>

              <div className="grid gap-3 border-t pt-4 md:grid-cols-2">
                <Input value={credentialForm.requesterName} onChange={(event) => setCredentialForm((current) => ({ ...current, requesterName: event.target.value }))} placeholder="Press requester" />
                <Input value={credentialForm.outlet} onChange={(event) => setCredentialForm((current) => ({ ...current, outlet: event.target.value }))} placeholder="Outlet" />
              </div>
              <Button variant="outline" disabled={!selectedRoomId} onClick={() => void savePressCredential({ roomId: selectedRoomId, ...credentialForm }).then(() => { setCredentialForm({ requesterName: "", outlet: "" }); return refresh(selectedRoomId, selectedPostId); })}>Save Press Credential Request</Button>
              <div className="space-y-2 text-sm">
                {credentials.map((item) => <div key={item.id} className="rounded-lg bg-muted p-3">{item.requesterName} • {item.outlet} • {item.status}</div>)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Film and Clip Review</CardTitle>
              <CardDescription>Film session rooms, clip assignments, collaboration boards, review tasks, and commentary threads.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <Input value={filmForm.teamId} onChange={(event) => setFilmForm((current) => ({ ...current, teamId: event.target.value }))} placeholder="Team id" />
                <Input value={filmForm.title} onChange={(event) => setFilmForm((current) => ({ ...current, title: event.target.value }))} placeholder="Film session title" />
                <Input value={filmForm.agenda} onChange={(event) => setFilmForm((current) => ({ ...current, agenda: event.target.value }))} placeholder="Agenda" />
              </div>
              <Button onClick={() => void createFilmSession(filmForm).then(() => { setFilmForm((current) => ({ ...current, title: "", agenda: "" })); return refresh(selectedRoomId, selectedPostId); })}>Create Film Session Room</Button>
              <div className="space-y-2 text-sm">
                {filmSessions.map((session) => <div key={session.id} className="rounded-lg bg-muted p-3">{session.title} • {session.teamId} • {session.agenda}</div>)}
              </div>

              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={selectedPostId} onChange={(event) => setSelectedPostId(event.target.value)}>
                <option value="">Choose clip</option>
                {posts.map((post) => <option key={post.id} value={post.id}>{post.caption || post.id}</option>)}
              </select>
              <div className="grid gap-3 md:grid-cols-2">
                <Input value={assignmentForm.athleteName} onChange={(event) => setAssignmentForm((current) => ({ ...current, athleteName: event.target.value }))} placeholder="Athlete name" />
                <Input value={assignmentForm.focus} onChange={(event) => setAssignmentForm((current) => ({ ...current, focus: event.target.value }))} placeholder="Assignment focus" />
              </div>
              <Button variant="outline" disabled={!selectedPostId} onClick={() => void saveClipAssignment({ postId: selectedPostId, ...assignmentForm }).then(() => { setAssignmentForm({ athleteName: "", focus: "" }); return refresh(selectedRoomId, selectedPostId); })}>Assign Clip to Player</Button>
              <div className="space-y-2 text-sm">
                {clipAssignments.map((assignment) => <div key={assignment.id} className="rounded-lg bg-muted p-3">{assignment.athleteName} • {assignment.focus}</div>)}
              </div>

              <div className="grid gap-3 border-t pt-4 md:grid-cols-2">
                <Input value={boardForm.title} onChange={(event) => setBoardForm((current) => ({ ...current, title: event.target.value }))} placeholder="Board title" />
                <Input value={boardForm.notes} onChange={(event) => setBoardForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Board notes" />
              </div>
              <Button variant="outline" disabled={!selectedPostId} onClick={() => void saveCollaborationBoard({ title: boardForm.title, notes: boardForm.notes, postIds: selectedPostId ? [selectedPostId] : [] }).then(() => { setBoardForm({ title: "", notes: "" }); return refresh(selectedRoomId, selectedPostId); })}>Save Collaboration Board</Button>
              <div className="space-y-2 text-sm">
                {boards.map((board) => <div key={board.id} className="rounded-lg bg-muted p-3">{board.title} • {board.postIds.length} clip(s) • {board.notes}</div>)}
              </div>

              <div className="grid gap-3 border-t pt-4 md:grid-cols-2">
                <Input value={taskForm.athleteName} onChange={(event) => setTaskForm((current) => ({ ...current, athleteName: event.target.value }))} placeholder="Athlete for review task" />
                <Input value={taskForm.task} onChange={(event) => setTaskForm((current) => ({ ...current, task: event.target.value }))} placeholder="Review task" />
              </div>
              <Button variant="outline" disabled={!selectedPostId} onClick={() => void saveVideoReviewTask({ postId: selectedPostId, ...taskForm }).then(() => { setTaskForm({ athleteName: "", task: "" }); return refresh(selectedRoomId, selectedPostId); })}>Save Video Review Task</Button>
              <div className="space-y-2 text-sm">
                {videoTasks.map((task) => <div key={task.id} className="rounded-lg bg-muted p-3">{task.athleteName} • {task.task} • {task.status}</div>)}
              </div>

              <div className="grid gap-3 border-t pt-4 md:grid-cols-2">
                <Input value={threadForm.authorName} onChange={(event) => setThreadForm((current) => ({ ...current, authorName: event.target.value }))} placeholder="Commentator name" />
                <Input value={threadForm.comment} onChange={(event) => setThreadForm((current) => ({ ...current, comment: event.target.value }))} placeholder="Commentary note" />
              </div>
              <Button variant="outline" disabled={!selectedPostId} onClick={() => void saveCommentaryThread({ postId: selectedPostId, ...threadForm }).then(() => { setThreadForm({ authorName: "", comment: "" }); return refresh(selectedRoomId, selectedPostId); })}>Add Commentary Thread</Button>
              <div className="space-y-2 text-sm">
                {threads.map((thread) => <div key={thread.id} className="rounded-lg bg-muted p-3">{thread.authorName} • {thread.comment}</div>)}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Coach and Scout Tools</CardTitle>
              <CardDescription>Coach grading rubrics by drill and scout voice-note uploads.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3">
                <Input value={rubricForm.drillTitle} onChange={(event) => setRubricForm((current) => ({ ...current, drillTitle: event.target.value }))} placeholder="Drill title" />
                <textarea value={rubricForm.metrics} onChange={(event) => setRubricForm((current) => ({ ...current, metrics: event.target.value }))} className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Metric:Weight, Metric:Weight" />
              </div>
              <Button onClick={() => void saveDrillRubric({
                drillTitle: rubricForm.drillTitle,
                metrics: rubricForm.metrics.split(",").map((item) => item.trim()).filter(Boolean).map((item) => {
                  const [label, rawWeight] = item.split(":");
                  return { label: (label || "Metric").trim(), weight: Number(rawWeight || 0) };
                }),
              }).then(() => { setRubricForm({ drillTitle: "", metrics: "Footwork:4,Reads:3,Finish:3" }); return refresh(selectedRoomId, selectedPostId); })}>
                Save Drill Rubric
              </Button>
              <div className="space-y-2 text-sm">
                {drillRubrics.map((rubric) => <div key={rubric.id} className="rounded-lg bg-muted p-3">{rubric.drillTitle} • {rubric.metrics.map((metric) => `${metric.label} ${metric.weight}`).join(" • ")}</div>)}
              </div>

              <div className="grid gap-3 border-t pt-4">
                <Input value={voiceForm.label} onChange={(event) => setVoiceForm((current) => ({ ...current, label: event.target.value }))} placeholder="Voice note label" />
                <textarea value={voiceForm.transcript} onChange={(event) => setVoiceForm((current) => ({ ...current, transcript: event.target.value }))} className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Scout voice-note transcript" />
                <input type="file" accept="audio/*" onChange={(event) => setVoiceFile(event.target.files?.[0] ?? null)} />
              </div>
              <Button variant="outline" onClick={() => void saveVoiceNote({ label: voiceForm.label, transcript: voiceForm.transcript, audioFile: voiceFile }).then(() => { setVoiceForm({ label: "", transcript: "" }); setVoiceFile(null); return refresh(selectedRoomId, selectedPostId); })}>
                Save Scout Voice Note
              </Button>
              <div className="space-y-2 text-sm">
                {voiceNotes.map((note) => <div key={note.id} className="rounded-lg bg-muted p-3">{note.label} • {note.transcript}{note.audioUrl ? " • audio attached" : ""}</div>)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Guided Performance Modes</CardTitle>
              <CardDescription>Audio guided workouts, focus sessions, meditation, and breathwork timers.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {getGuidedWorkouts().map((session) => (
                <div key={session.id} className="rounded-xl border p-4 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{session.title}</p>
                      <p className="text-muted-foreground">{session.type.replace("_", " ")} • {session.durationMin} min</p>
                    </div>
                    <Button size="sm" variant="outline">Start</Button>
                  </div>
                  <p className="mt-2">{session.summary}</p>
                  {session.type === "breathwork" ? (
                    <div className="mt-3 rounded-lg bg-muted p-3 text-xs">Timer cue: inhale 4s • hold 4s • exhale 4s • hold 4s</div>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Creative Assets</CardTitle>
            <CardDescription>Auto-generated social cards, gameday graphics, printable posters, and countdown widgets for big events.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              <Input value={graphicsForm.athlete} onChange={(event) => setGraphicsForm((current) => ({ ...current, athlete: event.target.value }))} placeholder="Athlete" />
              <Input value={graphicsForm.headline} onChange={(event) => setGraphicsForm((current) => ({ ...current, headline: event.target.value }))} placeholder="Headline" />
              <Input value={graphicsForm.stat} onChange={(event) => setGraphicsForm((current) => ({ ...current, stat: event.target.value }))} placeholder="Stat" />
              <Input value={graphicsForm.matchup} onChange={(event) => setGraphicsForm((current) => ({ ...current, matchup: event.target.value }))} placeholder="Matchup" />
              <Input value={graphicsForm.tipoff} onChange={(event) => setGraphicsForm((current) => ({ ...current, tipoff: event.target.value }))} placeholder="Tipoff" />
              <Input value={graphicsForm.venue} onChange={(event) => setGraphicsForm((current) => ({ ...current, venue: event.target.value }))} placeholder="Venue" />
              <Input value={graphicsForm.posterTitle} onChange={(event) => setGraphicsForm((current) => ({ ...current, posterTitle: event.target.value }))} placeholder="Poster title" />
              <Input value={graphicsForm.posterSubtitle} onChange={(event) => setGraphicsForm((current) => ({ ...current, posterSubtitle: event.target.value }))} placeholder="Poster subtitle" />
              <Input value={graphicsForm.posterCallout} onChange={(event) => setGraphicsForm((current) => ({ ...current, posterCallout: event.target.value }))} placeholder="Poster callout" />
              <Input value={graphicsForm.countdownLabel} onChange={(event) => setGraphicsForm((current) => ({ ...current, countdownLabel: event.target.value }))} placeholder="Countdown label" />
              <Input value={graphicsForm.countdownDate} onChange={(event) => setGraphicsForm((current) => ({ ...current, countdownDate: event.target.value }))} placeholder="YYYY-MM-DD" />
            </div>
            <div className="grid gap-4 lg:grid-cols-4">
              <div className="rounded-xl border p-4 text-sm whitespace-pre-wrap">{socialCard}</div>
              <div className="rounded-xl border p-4 text-sm"><p className="font-semibold">{gamedayGraphic.title}</p><p className="mt-2">{gamedayGraphic.headline}</p><p className="mt-2 text-muted-foreground">{gamedayGraphic.subhead}</p></div>
              <div className="rounded-xl border p-4 text-sm whitespace-pre-wrap">{posterCopy}</div>
              <div className="rounded-xl border p-4 text-sm whitespace-pre-wrap">{countdownWidget}</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  );
}

export default function StudioPage() {
  return (
    <AuthProvider>
      <StudioPageContent />
    </AuthProvider>
  );
}
