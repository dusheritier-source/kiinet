"use client";

import { useEffect, useRef, useState } from "react";
import { History, Mic, MicOff, MonitorUp, Phone, PhoneOff, PictureInPicture, Star, Video, VideoOff, X, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addCallCandidate, createCallRecord, markCallMissedIfRinging, subscribeCall, subscribeCallCandidates, subscribeCallHistory, subscribeIncomingCalls, updateCallRecord, addParticipantOffer, subscribeOffers, addParticipantAnswer, subscribeAnswers, addGroupCandidate, subscribeGroupCandidates, type CallRecord, type CallType } from "@/lib/calls";
import { getUserProfileById } from "@/lib/user-profile";

const TURN_URL = process.env.NEXT_PUBLIC_TURN_URL || "";
const TURN_USERNAME = process.env.NEXT_PUBLIC_TURN_USERNAME || "";
const TURN_CREDENTIAL = process.env.NEXT_PUBLIC_TURN_CREDENTIAL || "";
const rtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    ...(TURN_URL ? [{ urls: TURN_URL, username: TURN_USERNAME, credential: TURN_CREDENTIAL }] : []),
  ],
};

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
  const [ratingCall, setRatingCall] = useState<CallRecord | null>(null);
  const [rating, setRating] = useState(0);
  const [duration, setDuration] = useState(0);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideosRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const [participantProfilesMap, setParticipantProfilesMap] = useState<Map<string, { displayName: string; photoURL?: string }>>(new Map());
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
    // close any per-participant peers
    peersRef.current.forEach((pc) => { try { pc.close(); } catch {} }); peersRef.current.clear();
    peerRef.current?.close(); peerRef.current = null;
    // stop and clear local stream
    localStreamRef.current?.getTracks().forEach((track) => track.stop()); localStreamRef.current = null;
    // clear remote video elements
    remoteVideosRef.current.forEach((el) => { try { el.srcObject = null; } catch {} }); remoteVideosRef.current.clear();
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
    // add existing local tracks to the peer
    localStreamRef.current.getTracks().forEach((track) => peer.addTrack(track, localStreamRef.current!));
    peer.ontrack = (event) => {
      // for group calls, the incoming stream may belong to a specific remote participant
      // the caller/callee code will set the appropriate remote video element when wiring peers
      const stream = event.streams[0];
      // attempt to attach to any matching remote video element later
      // fallback handled by caller/callee wiring
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
      const nextCall: CallRecord = { id: callId, conversationId, participantIds, callerId: currentUserId, type, status: "preparing" };
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
          const remoteEl = remoteVideosRef.current.get(targetId);
          if (remoteEl) remoteEl.srcObject = event.streams[0];
        };
        pc.onicecandidate = (event) => { if (event.candidate) void addGroupCandidate(callId, currentUserId, targetId, event.candidate.toJSON()); };
        const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
        await addParticipantOffer(callId, currentUserId, targetId, { type: offer.type, sdp: offer.sdp });
        // subscribe for answer from this target
        const cleanupAnswer = subscribeAnswers(callId, currentUserId, async (answerDoc) => {
          if (answerDoc.from !== targetId) return;
          const ans = answerDoc.answer as RTCSessionDescriptionInit;
          if (ans && !pc.currentRemoteDescription) await pc.setRemoteDescription(ans);
        });
        cleanupsRef.current.push(cleanupAnswer);
        // subscribe for candidates from target->caller
        const cleanupCandidates = subscribeGroupCandidates(callId, targetId, currentUserId, (candidate) => void pc.addIceCandidate(candidate).catch(() => undefined));
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
        if (record.status === "ended") { stopMedia(); setCall(null); setRatingCall(record); }
      }));
    } catch (cause) { stopMedia(); setCall(null); setError(cause instanceof Error ? cause.message : "Could not start call."); }
  };

  const answerCall = async () => {
    const incomingCall = incoming;
    if (!incomingCall) return;

    // Support old call records that stored a single offer directly on the call.
    if (incomingCall.offer) {
      try {
        setCall(incomingCall); setIncoming(null);
        const peer = await preparePeer(incomingCall.type, incomingCall.id, "callee");
        peerRef.current = peer;
        await peer.setRemoteDescription(incomingCall.offer);
        const answer = await peer.createAnswer(); await peer.setLocalDescription(answer);
        await updateCallRecord(incomingCall.id, { answer: { type: answer.type, sdp: answer.sdp }, status: "active", answeredAt: new Date() });
        cleanupsRef.current.push(subscribeCall(incomingCall.id, (record) => {
          if (!record) return;
          if (record.status === "ended") { stopMedia(); setCall(null); setRatingCall(record); return; }
          setCall(record);
        }));
      } catch (cause) { stopMedia(); setCall(null); setError(cause instanceof Error ? cause.message : "Could not answer call."); }
      return;
    }

    // For group calls: listen for offers targeted to me and respond with individual answers
    const groupCallId = incomingCall.id;
    setCall(incomingCall);
    setIncoming(null);
    let answered = false;
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
          let el = remoteVideosRef.current.get(callerId);
          if (!el) {
            // nothing to attach to yet; ignore
            return;
          }
          el.srcObject = event.streams[0];
        };
        pc.onicecandidate = (event) => { if (event.candidate) void addGroupCandidate(groupCallId, currentUserId, callerId, event.candidate.toJSON()); };
        await pc.setRemoteDescription(offer as RTCSessionDescriptionInit);
        const answer = await pc.createAnswer(); await pc.setLocalDescription(answer);
        await addParticipantAnswer(groupCallId, currentUserId, callerId, { type: answer.type, sdp: answer.sdp });
        if (!answered) {
          answered = true;
          await updateCallRecord(groupCallId, { status: "active", answeredAt: new Date() });
        }
        // subscribe to caller's candidates -> me
        const cleanupCands = subscribeGroupCandidates(groupCallId, callerId, currentUserId, (candidate) => void pc.addIceCandidate(candidate).catch(() => undefined));
        cleanupsRef.current.push(cleanupCands);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not answer call.");
      }
    });
    cleanupsRef.current.push(cleanupOffers);
    cleanupsRef.current.push(subscribeCall(groupCallId, (record) => {
      if (!record) return;
      if (["ended", "declined", "missed"].includes(record.status)) {
        stopMedia(); setCall(null);
        if (record.status === "ended") setRatingCall(record);
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
      setRatingCall(active);
    }
  };
  const submitRating = async () => {
    if (!ratingCall || !rating) return;
    await updateCallRecord(ratingCall.id, { rating, ratingBy: currentUserId, ratedAt: new Date() }).catch(() => undefined);
    setRatingCall(null);
    setRating(0);
  };
  const decline = async () => { if (!incoming) return; await updateCallRecord(incoming.id, { status: "declined", endedAt: new Date() }); setIncoming(null); };
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

  return <>
    {conversationId && participantIds ? <><Button variant="ghost" size="icon" title="Voice call" onClick={() => void startCall("audio")}><Phone className="h-4 w-4" /></Button>
    <Button variant="ghost" size="icon" title="Video call" onClick={() => void startCall("video")}><Video className="h-4 w-4" /></Button></> : null}
    <Button variant="ghost" size="icon" title="Call history" onClick={() => setShowHistory(true)}><History className="h-4 w-4" /></Button>
    {showHistory ? <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/50 p-4"><div className="max-h-[70vh] w-full max-w-md overflow-hidden rounded-2xl border bg-background shadow-2xl"><div className="flex items-center justify-between border-b p-4"><h2 className="font-semibold">Call history</h2><Button variant="ghost" size="icon" onClick={() => setShowHistory(false)}><X className="h-4 w-4" /></Button></div><div className="max-h-[55vh] space-y-1 overflow-y-auto p-3">{history.map((item) => <div key={item.id} className="flex items-center justify-between rounded-xl p-3 hover:bg-muted"><div><p className="text-sm font-medium">{item.callerId === currentUserId ? "Outgoing" : "Incoming"} {item.type} call</p><p className="text-xs text-muted-foreground">{item.createdAt?.seconds ? new Date(item.createdAt.seconds * 1000).toLocaleString() : "Just now"}</p></div><span className={`text-xs capitalize ${item.status === "missed" || item.status === "declined" ? "text-red-600" : "text-muted-foreground"}`}>{item.status}</span></div>)}{history.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">No calls yet.</p> : null}</div></div></div> : null}
    {incoming ? <div className="fixed inset-x-4 top-20 z-[80] mx-auto flex max-w-md items-center justify-between rounded-2xl border bg-background p-4 shadow-2xl"><div><p className="font-semibold">Incoming {incoming.type} call</p><p className="text-sm text-muted-foreground">{title}</p></div><div className="flex gap-2"><Button size="icon" onClick={() => void answerCall()}><Phone className="h-4 w-4" /></Button><Button size="icon" variant="destructive" onClick={() => void decline()}><PhoneOff className="h-4 w-4" /></Button></div></div> : null}
    {call ? (
      <div className="fixed inset-0 z-[90] flex flex-col bg-slate-950 text-white">
        <div className="relative flex flex-1 items-center justify-center">
          {call.participantIds.filter((id) => id !== currentUserId).length <= 1 ? (
            // single remote (1:1) large view
            <>
              {call.participantIds.filter((id) => id !== currentUserId).map((id) => {
                const name = participantProfilesMap.get(id)?.displayName ?? (id === currentUserId ? "You" : "User");
                return (
                <div key={id} className="relative h-full w-full">
                  <video ref={(el) => { if (el) remoteVideosRef.current.set(id, el); }} autoPlay playsInline className="h-full w-full object-contain" />
                  <div className="absolute left-3 top-3 rounded-full bg-black/60 px-2 py-1 text-xs font-medium">{name}</div>
                </div>
                );
              })}
            </>
          ) : (
            // group grid
            <div className="grid h-full w-full grid-cols-2 gap-2 p-2">
              {call.participantIds.filter((id) => id !== currentUserId).map((id) => {
                const name = participantProfilesMap.get(id)?.displayName ?? (id === currentUserId ? "You" : "User");
                return (
                <div key={id} className="relative h-full w-full">
                  <video ref={(el) => { if (el) remoteVideosRef.current.set(id, el); }} autoPlay playsInline className="h-full w-full rounded-md object-cover" />
                  <div className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-1 text-xs font-medium">{name}</div>
                </div>
                );
              })}
            </div>
          )}
          <video ref={localVideoRef} autoPlay playsInline muted className="absolute bottom-4 right-4 h-36 w-28 rounded-xl border object-cover" />
          <div className="absolute top-6 text-center"><p className="font-semibold">{title}</p><p className="text-sm text-white/70">{call.status === "ringing" ? "Ringing…" : call.status === "active" ? "Connected" : "Connecting…"}</p></div>
        </div>
        <div className="flex justify-center gap-3 p-6"><Button size="icon" variant="secondary" onClick={toggleAudio}>{muted ? <MicOff /> : <Mic />}</Button>{call.type === "video" ? <><Button size="icon" variant="secondary" onClick={toggleVideo}>{cameraOff ? <VideoOff /> : <Video />}</Button><Button size="icon" variant="secondary" title="Switch camera" onClick={() => void switchCamera()}><RotateCw /></Button><Button size="icon" variant="secondary" title="Share screen" onClick={() => void shareScreen()}><MonitorUp /></Button><Button size="icon" variant="secondary" title="Picture in picture" onClick={() => void openPictureInPicture()}><PictureInPicture /></Button></> : null}<Button size="icon" variant="destructive" onClick={() => void endCall()}><PhoneOff /></Button></div>
      </div>
    ) : null}
    {ratingCall ? <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 p-4"><div className="w-full max-w-sm rounded-2xl bg-background p-6 text-center shadow-2xl"><h2 className="text-lg font-semibold">How was your call?</h2><p className="mt-1 text-sm text-muted-foreground">Rate the call quality with {title}.</p><div className="my-5 flex justify-center gap-2">{[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" aria-label={`${value} stars`} onClick={() => setRating(value)} className={value <= rating ? "text-amber-400" : "text-muted-foreground/40"}><Star className="h-8 w-8 fill-current" /></button>)}</div><div className="flex gap-2"><Button variant="outline" className="flex-1" onClick={() => setRatingCall(null)}>Skip</Button><Button className="flex-1" disabled={!rating} onClick={() => void submitRating()}>Submit</Button></div></div></div> : null}
    {error ? <div className="fixed bottom-4 right-4 z-[100] rounded-lg bg-red-600 px-4 py-3 text-sm text-white" onClick={() => setError("")}>{error}</div> : null}
  </>;
}
