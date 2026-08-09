"use client";

import { useEffect, useRef, useState } from "react";
import { History, Mic, MicOff, MonitorUp, Phone, PhoneOff, PictureInPicture, Video, VideoOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addCallCandidate, createCallRecord, markCallMissedIfRinging, subscribeCall, subscribeCallCandidates, subscribeCallHistory, subscribeIncomingCalls, updateCallRecord, type CallRecord, type CallType } from "@/lib/calls";

const rtcConfig: RTCConfiguration = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }] };

export default function CallPanel({ currentUserId, conversationId, participantIds, title }: { currentUserId: string; conversationId?: string; participantIds?: string[]; title: string }) {
  const [call, setCall] = useState<CallRecord | null>(null);
  const [incoming, setIncoming] = useState<CallRecord | null>(null);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<CallRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [duration, setDuration] = useState(0);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const cleanupsRef = useRef<Array<() => void>>([]);

  useEffect(() => subscribeIncomingCalls(currentUserId, (calls) => setIncoming(calls[0] ?? null), (cause) => setError(cause.message.includes("index") ? "Calls need the latest Firestore index deployment." : "Calls are unavailable right now.")), [currentUserId]);
  useEffect(() => subscribeCallHistory(currentUserId, setHistory), [currentUserId]);
  useEffect(() => () => stopMedia(), []);
  useEffect(() => {
    if (call?.status !== "active") { setDuration(0); return; }
    const started = Date.now();
    const timer = window.setInterval(() => setDuration(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [call?.id, call?.status]);

  const stopMedia = () => {
    cleanupsRef.current.forEach((cleanup) => cleanup()); cleanupsRef.current = [];
    peerRef.current?.close(); peerRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop()); localStreamRef.current = null;
  };

  const preparePeer = async (type: CallType, callId: string, side: "caller" | "callee") => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: type === "video" });
    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    const peer = new RTCPeerConnection(rtcConfig); peerRef.current = peer;
    stream.getTracks().forEach((track) => peer.addTrack(track, stream));
    peer.ontrack = (event) => { if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0]; };
    peer.onicecandidate = (event) => { if (event.candidate) void addCallCandidate(callId, side, event.candidate.toJSON()); };
    const remoteSide = side === "caller" ? "callee" : "caller";
    cleanupsRef.current.push(subscribeCallCandidates(callId, remoteSide, (candidate) => void peer.addIceCandidate(candidate).catch(() => undefined)));
    return peer;
  };

  const startCall = async (type: CallType) => {
    if (!conversationId || !participantIds) return;
    if (participantIds.length !== 2) return setError("Group calls require a conferencing server and are not enabled yet.");
    try {
      const callId = await createCallRecord(conversationId, participantIds, type);
      const nextCall: CallRecord = { id: callId, conversationId, participantIds, callerId: currentUserId, type, status: "preparing" };
      setCall(nextCall);
      const peer = await preparePeer(type, callId, "caller");
      const offer = await peer.createOffer(); await peer.setLocalDescription(offer);
      await updateCallRecord(callId, { offer: { type: offer.type, sdp: offer.sdp }, status: "ringing" });
      window.setTimeout(() => void markCallMissedIfRinging(callId), 30000);
      cleanupsRef.current.push(subscribeCall(callId, (record) => {
        if (!record) return;
        setCall(record);
        if (record.answer && !peer.currentRemoteDescription) void peer.setRemoteDescription(record.answer);
        if (["declined", "missed", "ended"].includes(record.status)) stopMedia();
      }));
    } catch (cause) { stopMedia(); setCall(null); setError(cause instanceof Error ? cause.message : "Could not start call."); }
  };

  const answerCall = async () => {
    if (!incoming?.offer) return;
    try {
      setCall(incoming); setIncoming(null);
      const peer = await preparePeer(incoming.type, incoming.id, "callee");
      await peer.setRemoteDescription(incoming.offer);
      const answer = await peer.createAnswer(); await peer.setLocalDescription(answer);
      await updateCallRecord(incoming.id, { answer: { type: answer.type, sdp: answer.sdp }, status: "active", answeredAt: new Date() });
      cleanupsRef.current.push(subscribeCall(incoming.id, (record) => { if (record) setCall(record); if (record?.status === "ended") stopMedia(); }));
    } catch (cause) { stopMedia(); setCall(null); setError(cause instanceof Error ? cause.message : "Could not answer call."); }
  };

  const endCall = async () => { const active = call; stopMedia(); setCall(null); if (active) await updateCallRecord(active.id, { status: "ended", endedAt: new Date() }); };
  const decline = async () => { if (!incoming) return; await updateCallRecord(incoming.id, { status: "declined", endedAt: new Date() }); setIncoming(null); };
  const toggleAudio = () => { const next = !muted; localStreamRef.current?.getAudioTracks().forEach((track) => { track.enabled = !next; }); setMuted(next); };
  const toggleVideo = () => { const next = !cameraOff; localStreamRef.current?.getVideoTracks().forEach((track) => { track.enabled = !next; }); setCameraOff(next); };
  const shareScreen = async () => {
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = display.getVideoTracks()[0];
      const sender = peerRef.current?.getSenders().find((item) => item.track?.kind === "video");
      await sender?.replaceTrack(screenTrack);
      screenTrack.onended = () => {
        const cameraTrack = localStreamRef.current?.getVideoTracks()[0];
        if (cameraTrack) void sender?.replaceTrack(cameraTrack);
      };
    } catch { /* The user cancelled screen sharing. */ }
  };
  const openPictureInPicture = async () => {
    if (remoteVideoRef.current && document.pictureInPictureEnabled) await remoteVideoRef.current.requestPictureInPicture().catch(() => undefined);
  };
  const formatDuration = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;

  return <>
    {conversationId && participantIds ? <><Button variant="ghost" size="icon" title="Voice call" onClick={() => void startCall("audio")}><Phone className="h-4 w-4" /></Button>
    <Button variant="ghost" size="icon" title="Video call" onClick={() => void startCall("video")}><Video className="h-4 w-4" /></Button></> : null}
    <Button variant="ghost" size="icon" title="Call history" onClick={() => setShowHistory(true)}><History className="h-4 w-4" /></Button>
    {showHistory ? <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/50 p-4"><div className="max-h-[70vh] w-full max-w-md overflow-hidden rounded-2xl border bg-background shadow-2xl"><div className="flex items-center justify-between border-b p-4"><h2 className="font-semibold">Call history</h2><Button variant="ghost" size="icon" onClick={() => setShowHistory(false)}><X className="h-4 w-4" /></Button></div><div className="max-h-[55vh] space-y-1 overflow-y-auto p-3">{history.map((item) => <div key={item.id} className="flex items-center justify-between rounded-xl p-3 hover:bg-muted"><div><p className="text-sm font-medium">{item.callerId === currentUserId ? "Outgoing" : "Incoming"} {item.type} call</p><p className="text-xs text-muted-foreground">{item.createdAt?.seconds ? new Date(item.createdAt.seconds * 1000).toLocaleString() : "Just now"}</p></div><span className={`text-xs capitalize ${item.status === "missed" || item.status === "declined" ? "text-red-600" : "text-muted-foreground"}`}>{item.status}</span></div>)}{history.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">No calls yet.</p> : null}</div></div></div> : null}
    {incoming ? <div className="fixed inset-x-4 top-20 z-[80] mx-auto flex max-w-md items-center justify-between rounded-2xl border bg-background p-4 shadow-2xl"><div><p className="font-semibold">Incoming {incoming.type} call</p><p className="text-sm text-muted-foreground">{title}</p></div><div className="flex gap-2"><Button size="icon" onClick={() => void answerCall()}><Phone className="h-4 w-4" /></Button><Button size="icon" variant="destructive" onClick={() => void decline()}><PhoneOff className="h-4 w-4" /></Button></div></div> : null}
    {call ? <div className="fixed inset-0 z-[90] flex flex-col bg-slate-950 text-white"><div className="relative flex flex-1 items-center justify-center"><video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-contain" /><video ref={localVideoRef} autoPlay playsInline muted className="absolute bottom-4 right-4 h-36 w-28 rounded-xl border object-cover" /><div className="absolute top-6 text-center"><p className="font-semibold">{title}</p><p className="text-sm text-white/70">{call.status === "ringing" ? "Ringing…" : call.status === "active" ? "Connected" : "Connecting…"}</p></div></div><div className="flex justify-center gap-3 p-6"><Button size="icon" variant="secondary" onClick={toggleAudio}>{muted ? <MicOff /> : <Mic />}</Button>{call.type === "video" ? <><Button size="icon" variant="secondary" onClick={toggleVideo}>{cameraOff ? <VideoOff /> : <Video />}</Button><Button size="icon" variant="secondary" title="Share screen" onClick={() => void shareScreen()}><MonitorUp /></Button><Button size="icon" variant="secondary" title="Picture in picture" onClick={() => void openPictureInPicture()}><PictureInPicture /></Button></> : null}<Button size="icon" variant="destructive" onClick={() => void endCall()}><PhoneOff /></Button></div></div> : null}
    {error ? <div className="fixed bottom-4 right-4 z-[100] rounded-lg bg-red-600 px-4 py-3 text-sm text-white" onClick={() => setError("")}>{error}</div> : null}
  </>;
}
