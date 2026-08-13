"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { History, Mic, MicOff, MonitorUp, Phone, PhoneOff, PictureInPicture, Video, VideoOff, X, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { acceptCallRecord, addCallCandidate, createCallRecord, markCallMissedIfRinging, subscribeCall, subscribeCallCandidates, subscribeCallHistory, subscribeIncomingCalls, updateCallRecord, addParticipantOffer, subscribeOffers, addParticipantAnswer, subscribeAnswers, addGroupCandidate, subscribeGroupCandidates, type CallRecord, type CallType } from "@/lib/calls";
import { getUserProfileById } from "@/lib/user-profile";
import { sendConversationMessage } from "@/lib/messaging";
import { buildRtcConfiguration } from "@/lib/rtc-config";

const TURN_URL = process.env.NEXT_PUBLIC_TURN_URL || "";
const TURN_USERNAME = process.env.NEXT_PUBLIC_TURN_USERNAME || "";
const TURN_CREDENTIAL = process.env.NEXT_PUBLIC_TURN_CREDENTIAL || "";
const rtcConfig = buildRtcConfiguration({ turnUrl: TURN_URL, username: TURN_USERNAME, credential: TURN_CREDENTIAL });

export default function CallPanel({ currentUserId, conversationId, participantIds, title }: { currentUserId: string; conversationId?: string; participantIds?: string[]; title: string }) {
  const [call, setCall] = useState<CallRecord | null>(null);
  const [incoming, setIncoming] = useState<CallRecord | null>(null);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [videoDeviceIds, setVideoDeviceIds] = useState<string[]>([]);
  const [currentVideoDeviceId, setCurrentVideoDeviceId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<CallRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioPlaybackBlocked, setAudioPlaybackBlocked] = useState(false);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>("new");
  const reconnectAttemptsRef = useRef(0);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideosRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const [participantProfilesMap, setParticipantProfilesMap] = useState<Map<string, { displayName: string; photoURL?: string }>>(new Map());
  const cleanupsRef = useRef<Array<() => void>>([]);

  useEffect(() => subscribeIncomingCalls(currentUserId, (calls) => setIncoming(calls[0] ?? null), (cause) => setError(cause.message.includes("index") ? "Calls need the latest Firestore index deployment." : "Calls are unavailable right now.")), [currentUserId]);
  useEffect(() => subscribeCallHistory(currentUserId, setHistory), [currentUserId]);
  useEffect(() => () => stopMedia(), []);
  useEffect(() => {
    if (!call && !incoming) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [call, incoming]);
  useEffect(() => {
    if (call?.status !== "active") { setDuration(0); return; }
    const started = Date.now();
    const timer = window.setInterval(() => setDuration(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [call?.id, call?.status]);

  const stopMedia = () => {
    cleanupsRef.current.forEach((cleanup) => cleanup()); cleanupsRef.current = [];
    // close any per-participant peers
    peersRef.current.forEach((pc) => { try { pc.close(); } catch {} }); peersRef.current.clear();
    peerRef.current?.close(); peerRef.current = null;
    // stop and clear local stream
    localStreamRef.current?.getTracks().forEach((track) => track.stop()); localStreamRef.current = null;
    // clear remote video elements
    remoteVideosRef.current.forEach((el) => { try { el.srcObject = null; } catch {} }); remoteVideosRef.current.clear();
    remoteStreamsRef.current.clear();
    pendingCandidatesRef.current.clear();
    setAudioPlaybackBlocked(false);
  };

  const attachRemoteStream = (remoteId: string, stream: MediaStream) => {
    remoteStreamsRef.current.set(remoteId, stream);
    const element = remoteVideosRef.current.get(remoteId);
    if (!element) return;
    element.srcObject = stream;
    element.muted = false;
    element.volume = 1;
    void element.play().then(() => setAudioPlaybackBlocked(false)).catch(() => setAudioPlaybackBlocked(true));
  };

  const enableRemoteAudio = () => {
    const elements = Array.from(remoteVideosRef.current.values());
    void Promise.all(elements.map(async (element) => {
      element.muted = false;
      element.volume = 1;
      await element.play();
    })).then(() => setAudioPlaybackBlocked(false)).catch(() => setError("Audio could not start. Check Safari microphone and speaker permissions."));
  };

  const addOrQueueCandidate = (peerId: string, peer: RTCPeerConnection, candidate: RTCIceCandidateInit) => {
    if (peer.remoteDescription) {
      void peer.addIceCandidate(candidate).catch(() => undefined);
      return;
    }
    const pending = pendingCandidatesRef.current.get(peerId) ?? [];
    pending.push(candidate);
    pendingCandidatesRef.current.set(peerId, pending);
  };

  const flushCandidates = async (peerId: string, peer: RTCPeerConnection) => {
    const pending = pendingCandidatesRef.current.get(peerId) ?? [];
    pendingCandidatesRef.current.delete(peerId);
    for (const candidate of pending) await peer.addIceCandidate(candidate).catch(() => undefined);
  };

  const preparePeer = async (type: CallType, callId: string, side: "caller" | "callee") => {
    const videoConstraints: boolean | MediaTrackConstraints = type === "video" ? (currentVideoDeviceId ? { deviceId: { exact: currentVideoDeviceId } } : true) : false;
    // Ensure local stream exists and reuse it for multiple peers (star topology)
    if (!localStreamRef.current) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 }, video: videoConstraints });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    }
    const peer = new RTCPeerConnection(rtcConfig);
    peer.onconnectionstatechange = () => {
      setConnectionState(peer.connectionState);
      if (["disconnected", "failed"].includes(peer.connectionState) && reconnectAttemptsRef.current < 2) {
        reconnectAttemptsRef.current += 1;
        window.setTimeout(() => { if (peer.connectionState !== "connected" && peer.signalingState !== "closed") peer.restartIce(); }, 1500 * reconnectAttemptsRef.current);
      }
      if (peer.connectionState === "connected") reconnectAttemptsRef.current = 0;
    };
    // add existing local tracks to the peer
    localStreamRef.current.getTracks().forEach((track) => peer.addTrack(track, localStreamRef.current!));
    peer.ontrack = (event) => {
      const stream = event.streams[0];
      const remoteId = (call?.participantIds ?? participantIds ?? []).find((id) => id !== currentUserId);
      if (remoteId && stream) {
        attachRemoteStream(remoteId, stream);
      }
    };
    peer.onicecandidate = (event) => { if (event.candidate) { /* caller/callee will add candidate per-pair */ } };
    return peer;
  };

  // Enumerate available video input devices so users can switch the camera (front/back) on mobile.
  useEffect(() => {
    let mounted = true;
    const updateDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === "videoinput").map((d) => d.deviceId);
        if (!mounted) return;
        setVideoDeviceIds(videoInputs);
        if (!currentVideoDeviceId && videoInputs.length) setCurrentVideoDeviceId(videoInputs[0]);
      } catch {
        // ignore
      }
    };
    void updateDevices();
    navigator.mediaDevices.addEventListener("devicechange", updateDevices);
    return () => { mounted = false; navigator.mediaDevices.removeEventListener("devicechange", updateDevices); };
  }, [currentVideoDeviceId]);

  const switchCamera = async () => {
    if (videoDeviceIds.length < 2) return;
    const currentIndex = videoDeviceIds.findIndex((id) => id === currentVideoDeviceId);
    const nextIndex = (currentIndex + 1) % videoDeviceIds.length;
    const nextDeviceId = videoDeviceIds[nextIndex];
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: nextDeviceId } }, audio: false });
      const newTrack = newStream.getVideoTracks()[0];
      // Replace track in local stream
      const local = localStreamRef.current;
      if (local) {
        // Stop previous video tracks and remove
        local.getVideoTracks().forEach((t) => { t.stop(); local.removeTrack(t); });
        local.addTrack(newTrack);
        localStreamRef.current = local;
      } else {
        localStreamRef.current = newStream;
      }
      if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
      // Replace track on the active peer sender(s)
      if (newTrack) {
        const pcs = Array.from(peersRef.current.values());
        await Promise.all(pcs.flatMap((pc) => pc.getSenders().filter((s) => s.track?.kind === "video").map((s) => s.replaceTrack(newTrack))));
        const pcSingle = peerRef.current;
        if (pcSingle) await Promise.all(pcSingle.getSenders().filter((s) => s.track?.kind === "video").map((s) => s.replaceTrack(newTrack)));
      }
      setCurrentVideoDeviceId(nextDeviceId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not switch camera.");
    }
  };

  // Fetch participant profiles for display names overlay
  useEffect(() => {
    let mounted = true;
    const loadProfiles = async () => {
      const ids = call?.participantIds ?? participantIds ?? [];
      const map = new Map<string, { displayName: string; photoURL?: string }>();
      await Promise.all(ids.map(async (id) => {
        try {
          const profile = await getUserProfileById(id);
          if (!mounted) return;
          map.set(id, { displayName: String(profile?.displayName ?? (id === currentUserId ? "You" : "User")), photoURL: String(profile?.photoURL ?? "") });
        } catch {
          if (!mounted) return;
          map.set(id, { displayName: id === currentUserId ? "You" : "User" });
        }
      }));
      if (mounted) setParticipantProfilesMap(map);
    };
    void loadProfiles();
    return () => { mounted = false; };
  }, [call?.participantIds, participantIds, currentUserId]);

  const startCall = async (type: CallType) => {
    if (!conversationId || !participantIds) return;
    // Allow group calls via star topology (caller connects directly to each participant)
    try {
      const callId = await createCallRecord(conversationId, participantIds, type);
      const nextCall: CallRecord = { id: callId, conversationId, participantIds, callerId: currentUserId, type, status: "preparing", answeredBy: [currentUserId], pendingParticipantIds: participantIds.filter((id) => id !== currentUserId) };
      setCall(nextCall);
      // For each other participant create a peer and send an individual offer
      const others = participantIds.filter((id) => id !== currentUserId);
      // ensure local stream is prepared
      await preparePeer(type, callId, "caller");
      // For each target, create a dedicated RTCPeerConnection, offer and write to offers collection
      await Promise.all(others.map(async (targetId) => {
        const pc = new RTCPeerConnection(rtcConfig);
        peersRef.current.set(targetId, pc);
        // add local tracks
        localStreamRef.current?.getTracks().forEach((t) => pc.addTrack(t, localStreamRef.current!));
        pc.ontrack = (event) => {
          if (event.streams[0]) attachRemoteStream(targetId, event.streams[0]);
        };
        pc.onicecandidate = (event) => { if (event.candidate) void addGroupCandidate(callId, currentUserId, targetId, event.candidate.toJSON()); };
        const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
        await addParticipantOffer(callId, currentUserId, targetId, { type: offer.type, sdp: offer.sdp });
        // subscribe for answer from this target
        const cleanupAnswer = subscribeAnswers(callId, currentUserId, async (answerDoc) => {
          if (answerDoc.from !== targetId) return;
          const ans = answerDoc.answer as RTCSessionDescriptionInit;
          if (ans && !pc.currentRemoteDescription) {
            await pc.setRemoteDescription(ans);
            await flushCandidates(targetId, pc);
          }
        });
        cleanupsRef.current.push(cleanupAnswer);
        // subscribe for candidates from target->caller
        const cleanupCandidates = subscribeGroupCandidates(callId, targetId, currentUserId, (candidate) => addOrQueueCandidate(targetId, pc, candidate));
        cleanupsRef.current.push(cleanupCandidates);
      }));
      // mark call as ringing
      await updateCallRecord(callId, { status: "ringing" });
      window.setTimeout(() => void markCallMissedIfRinging(callId), 30000);
      // subscribe to call record changes for lifecycle updates
      cleanupsRef.current.push(subscribeCall(callId, (record) => {
        if (!record) return;
        setCall(record);
        if (["declined", "missed"].includes(record.status)) { stopMedia(); setCall(null); }
        if (record.status === "ended") { stopMedia(); setCall(null); }
      }));
    } catch (cause) { stopMedia(); setCall(null); setError(cause instanceof Error ? cause.message : "Could not start call."); }
  };

  const answerCall = async () => {
    const incomingCall = incoming;
    if (!incomingCall) return;

    setIncoming(null);
    setCall({ ...incomingCall, status: "active" });
    try {
      // Accept immediately so every participant stops showing a ringing call while
      // media permissions and WebRTC negotiation continue in the background.
      await acceptCallRecord(incomingCall.id);
    } catch (cause) {
      setCall(null);
      setError(cause instanceof Error ? cause.message : "Could not answer call.");
      return;
    }

    // Support old call records that stored a single offer directly on the call.
    if (incomingCall.offer) {
      try {
        const peer = await preparePeer(incomingCall.type, incomingCall.id, "callee");
        peerRef.current = peer;
        await peer.setRemoteDescription(incomingCall.offer);
        const answer = await peer.createAnswer(); await peer.setLocalDescription(answer);
        await updateCallRecord(incomingCall.id, { answer: { type: answer.type, sdp: answer.sdp } });
        cleanupsRef.current.push(subscribeCall(incomingCall.id, (record) => {
          if (!record) return;
          if (record.status === "ended") { stopMedia(); setCall(null); return; }
          setCall(record);
        }));
      } catch (cause) {
        stopMedia();
        setCall(null);
        await updateCallRecord(incomingCall.id, { status: "ended", endedAt: new Date() }).catch(() => undefined);
        setError(cause instanceof Error ? cause.message : "Could not answer call.");
      }
      return;
    }

    // For group calls: listen for offers targeted to me and respond with individual answers
    const groupCallId = incomingCall.id;
    // subscribeOffers will invoke callback for any offers targeted to current user
    const cleanupOffers = subscribeOffers(groupCallId, currentUserId, async (offerDoc) => {
      try {
        const { from: callerId, offer } = offerDoc;
        // create peer per callerId
        const pc = new RTCPeerConnection(rtcConfig);
        peersRef.current.set(callerId, pc);
        // ensure local stream
        if (!localStreamRef.current) await preparePeer(incomingCall.type, groupCallId, "callee");
        localStreamRef.current?.getTracks().forEach((t) => pc.addTrack(t, localStreamRef.current!));
        pc.ontrack = (event) => {
          if (event.streams[0]) attachRemoteStream(callerId, event.streams[0]);
        };
        pc.onicecandidate = (event) => { if (event.candidate) void addGroupCandidate(groupCallId, currentUserId, callerId, event.candidate.toJSON()); };
        await pc.setRemoteDescription(offer as RTCSessionDescriptionInit);
        const answer = await pc.createAnswer(); await pc.setLocalDescription(answer);
        await addParticipantAnswer(groupCallId, currentUserId, callerId, { type: answer.type, sdp: answer.sdp });
        // subscribe to caller's candidates -> me
        const cleanupCands = subscribeGroupCandidates(groupCallId, callerId, currentUserId, (candidate) => addOrQueueCandidate(callerId, pc, candidate));
        cleanupsRef.current.push(cleanupCands);
      } catch (cause) {
        stopMedia();
        setCall(null);
        await updateCallRecord(groupCallId, { status: "ended", endedAt: new Date() }).catch(() => undefined);
        setError(cause instanceof Error ? cause.message : "Could not answer call.");
      }
    });
    cleanupsRef.current.push(cleanupOffers);
    cleanupsRef.current.push(subscribeCall(groupCallId, (record) => {
      if (!record) return;
      if (["ended", "declined", "missed"].includes(record.status)) {
        stopMedia(); setCall(null);
        return;
      }
      setCall(record);
    }));
  };

  const endCall = async () => {
    const active = call;
    stopMedia();
    setCall(null);
    if (active) {
      await updateCallRecord(active.id, { status: "ended", endedAt: new Date() });
      const label = active.type === "video" ? "Video call ended" : "Voice call ended";
      const elapsed = duration ? ` • ${formatDuration(duration)}` : "";
      await sendConversationMessage(active.conversationId, `${label}${elapsed}`).catch(() => undefined);
    }
  };
  const decline = async () => {
    if (!incoming) return;
    const declinedCall = incoming;
    await updateCallRecord(declinedCall.id, { status: "declined", endedAt: new Date() });
    setIncoming(null);
    await sendConversationMessage(declinedCall.conversationId, `Declined ${declinedCall.type === "video" ? "video" : "voice"} call`).catch(() => undefined);
  };
  const toggleAudio = () => { const next = !muted; localStreamRef.current?.getAudioTracks().forEach((track) => { track.enabled = !next; }); setMuted(next); };
  const toggleVideo = () => { const next = !cameraOff; localStreamRef.current?.getVideoTracks().forEach((track) => { track.enabled = !next; }); setCameraOff(next); };
  const shareScreen = async () => {
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = display.getVideoTracks()[0];
      // Replace video track across all peers
      const pcs = Array.from(peersRef.current.values());
      await Promise.all(pcs.flatMap((pc) => pc.getSenders().filter((s) => s.track?.kind === "video").map((s) => s.replaceTrack(screenTrack))));
      if (peerRef.current) await Promise.all(peerRef.current.getSenders().filter((s) => s.track?.kind === "video").map((s) => s.replaceTrack(screenTrack)));
      screenTrack.onended = () => {
        const cameraTrack = localStreamRef.current?.getVideoTracks()[0];
        if (cameraTrack) {
          peersRef.current.forEach((pc) => pc.getSenders().filter((s) => s.track?.kind === "video").forEach((s) => { try { s.replaceTrack(cameraTrack); } catch {} }));
          if (peerRef.current) peerRef.current.getSenders().filter((s) => s.track?.kind === "video").forEach((s) => { try { s.replaceTrack(cameraTrack); } catch {} });
        }
      };
    } catch { /* The user cancelled screen sharing. */ }
  };
  const openPictureInPicture = async () => {
    const first = remoteVideosRef.current.values().next();
    const el = first && first.value ? first.value : null;
    if (el && document.pictureInPictureEnabled) await el.requestPictureInPicture().catch(() => undefined);
  };
  const formatDuration = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;

  const callOverlays = typeof document === "undefined" ? null : createPortal(<>
    {incoming ? <div className="fixed inset-0 z-[110] flex min-h-[100dvh] flex-col items-center justify-between bg-slate-950 px-6 pb-[max(3rem,env(safe-area-inset-bottom))] pt-[max(4rem,env(safe-area-inset-top))] text-center text-white"><div><p className="text-sm text-white/60">Incoming {incoming.type === "video" ? "video" : "voice"} call</p><h2 className="mt-3 text-3xl font-semibold">{title}</h2></div><div className="flex gap-12"><div className="flex flex-col items-center gap-2"><Button size="icon" className="h-16 w-16 rounded-full bg-emerald-500 hover:bg-emerald-600" onClick={() => void answerCall()}><Phone className="h-7 w-7" /></Button><span className="text-sm">Answer</span></div><div className="flex flex-col items-center gap-2"><Button size="icon" variant="destructive" className="h-16 w-16 rounded-full" onClick={() => void decline()}><PhoneOff className="h-7 w-7" /></Button><span className="text-sm">Decline</span></div></div></div> : null}
    {call ? (
      <div className="fixed inset-0 z-[120] flex min-h-[100dvh] w-screen flex-col bg-slate-950 text-white">
        <div className="relative flex min-h-0 flex-1 items-center justify-center">
          {call.participantIds.filter((id) => id !== currentUserId).length <= 1 ? (
            <>{call.participantIds.filter((id) => id !== currentUserId).map((id) => {
              const name = participantProfilesMap.get(id)?.displayName ?? "User";
              return <div key={id} className="relative h-full w-full"><video ref={(el) => { if (el) { remoteVideosRef.current.set(id, el); const stream = remoteStreamsRef.current.get(id); if (stream) attachRemoteStream(id, stream); } }} autoPlay playsInline className="h-full w-full object-cover" /><div className="absolute left-4 top-[max(1rem,env(safe-area-inset-top))] rounded-full bg-black/60 px-3 py-1.5 text-sm font-medium">{name}</div></div>;
            })}</>
          ) : <div className="grid h-full w-full grid-cols-2 gap-2 p-2">{call.participantIds.filter((id) => id !== currentUserId).map((id) => <div key={id} className="relative h-full w-full"><video ref={(el) => { if (el) { remoteVideosRef.current.set(id, el); const stream = remoteStreamsRef.current.get(id); if (stream) attachRemoteStream(id, stream); } }} autoPlay playsInline className="h-full w-full rounded-xl object-cover" /><div className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-1 text-xs font-medium">{participantProfilesMap.get(id)?.displayName ?? "User"}</div></div>)}</div>}
          <video ref={localVideoRef} autoPlay playsInline muted className="absolute bottom-4 right-4 h-36 w-28 rounded-2xl border border-white/30 bg-black object-cover shadow-xl" />
          {audioPlaybackBlocked ? <Button type="button" className="absolute bottom-6 left-1/2 z-20 -translate-x-1/2 rounded-full" onClick={enableRemoteAudio}><Mic className="mr-2 h-4 w-4" />Enable audio</Button> : null}
          <div className="pointer-events-none absolute top-[max(1rem,env(safe-area-inset-top))] text-center"><p className="font-semibold">{title}</p><p className="text-sm text-white/70">{connectionState === "disconnected" || connectionState === "failed" ? "Reconnecting…" : call.status === "ringing" ? "Ringing…" : call.status === "active" ? formatDuration(duration) : "Connecting…"}</p></div>
        </div>
        <div className="flex flex-wrap justify-center gap-3 bg-slate-950/95 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4"><Button size="icon" variant="secondary" className="rounded-full" onClick={toggleAudio}>{muted ? <MicOff /> : <Mic />}</Button>{call.type === "video" ? <><Button size="icon" variant="secondary" className="rounded-full" onClick={toggleVideo}>{cameraOff ? <VideoOff /> : <Video />}</Button><Button size="icon" variant="secondary" className="rounded-full" title="Switch camera" onClick={() => void switchCamera()}><RotateCw /></Button><Button size="icon" variant="secondary" className="hidden rounded-full sm:inline-flex" title="Share screen" onClick={() => void shareScreen()}><MonitorUp /></Button><Button size="icon" variant="secondary" className="hidden rounded-full sm:inline-flex" title="Picture in picture" onClick={() => void openPictureInPicture()}><PictureInPicture /></Button></> : null}<Button size="icon" variant="destructive" className="rounded-full" onClick={() => void endCall()}><PhoneOff /></Button></div>
      </div>
    ) : null}
  </>, document.body);

  return <>
    {conversationId && participantIds ? <><Button variant="ghost" size="icon" title="Voice call" aria-label="Start voice call" className="h-9 w-9" onClick={() => void startCall("audio")}><Phone className="h-4 w-4" /></Button>
    <Button variant="ghost" size="icon" title="Video call" aria-label="Start video call" className="h-9 w-9" onClick={() => void startCall("video")}><Video className="h-4 w-4" /></Button></> : null}
    <Button variant="ghost" size="icon" title="Call history" aria-label="Open call history" className="hidden h-9 w-9 sm:inline-flex" onClick={() => setShowHistory(true)}><History className="h-4 w-4" /></Button>
    {showHistory ? <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/50 p-4"><div className="max-h-[70vh] w-full max-w-md overflow-hidden rounded-2xl border bg-background shadow-2xl"><div className="flex items-center justify-between border-b p-4"><h2 className="font-semibold">Call history</h2><Button variant="ghost" size="icon" onClick={() => setShowHistory(false)}><X className="h-4 w-4" /></Button></div><div className="max-h-[55vh] space-y-1 overflow-y-auto p-3">{history.map((item) => <div key={item.id} className="flex items-center justify-between rounded-xl p-3 hover:bg-muted"><div><p className="text-sm font-medium">{item.callerId === currentUserId ? "Outgoing" : "Incoming"} {item.type} call</p><p className="text-xs text-muted-foreground">{item.createdAt?.seconds ? new Date(item.createdAt.seconds * 1000).toLocaleString() : "Just now"}</p></div><span className={`text-xs capitalize ${item.status === "missed" || item.status === "declined" ? "text-red-600" : "text-muted-foreground"}`}>{item.status}</span></div>)}{history.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">No calls yet.</p> : null}</div></div></div> : null}
    {callOverlays}
    {error ? <div className="fixed bottom-4 right-4 z-[100] rounded-lg bg-red-600 px-4 py-3 text-sm text-white" onClick={() => setError("")}>{error}</div> : null}
  </>;
}
