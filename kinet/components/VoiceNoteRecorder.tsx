"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Pause, Play, Send, X } from "lucide-react";

interface VoiceNoteRecorderProps {
  onSend: (file: File, duration: number) => void;
  onCancel: () => void;
  conversationId?: string | null;
}

type RecorderState = "idle" | "recording" | "preview" | "sending";

export default function VoiceNoteRecorder({ onSend, onCancel, conversationId: _conversationId }: VoiceNoteRecorderProps) {
  const [state, setState] = useState<RecorderState>("idle");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewDuration, setPreviewDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const startYRef = useRef(0);
  const startTimeRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopStreamAndTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
  }, []);

  const cleanup = useCallback(() => {
    stopStreamAndTimer();
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, [previewUrl, stopStreamAndTimer]);

  const startRecording = useCallback(async () => {
    if (state === "recording" || state === "preview" || state === "sending") {
      return;
    }

    try {
      setPreviewUrl(null);
      setPreviewDuration(0);
      setIsPlaying(false);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);

        setPreviewUrl(url);
        setPreviewDuration(recordingSeconds);

        const audio = new Audio(url);
        audioRef.current = audio;
        audio.addEventListener("loadedmetadata", () => {
          setPreviewDuration(audio.duration || recordingSeconds);
        });

        stopStreamAndTimer();
        setState("preview");
      };

      mediaRecorder.start();
      setState("recording");
      setRecordingSeconds(0);
      startTimeRef.current = Date.now();

      timerRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setRecordingSeconds(elapsed);
        if (elapsed >= 60) {
          stopRecording();
        }
      }, 100);
    } catch {
      onCancel();
    }
  }, [cleanup, onCancel, recordingSeconds, stopStreamAndTimer]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  useEffect(() => {
    if (state === "idle") {
      void startRecording();
    }
  }, [state, startRecording]);

  const cancelRecording = useCallback(() => {
    cleanup();
    setState("idle");
    setRecordingSeconds(0);
    setPreviewUrl(null);
    setPreviewDuration(0);
    onCancel();
  }, [cleanup, onCancel]);

  const sendPreview = useCallback((fileOverride?: File) => {
    if (!previewUrl && !fileOverride) return;
    setState("sending");

    const sendAudio = async () => {
      try {
        let file = fileOverride;
        if (!file) {
          const response = await fetch(previewUrl!);
          const blob = await response.blob();
          file = new File([blob], `voice-note-${Date.now()}.webm`, { type: "audio/webm" });
        }

        onSend(file, previewDuration);
        cleanup();
        setState("idle");
        setPreviewUrl(null);
        setPreviewDuration(0);
        setRecordingSeconds(0);
        setIsPlaying(false);
      } catch {
        setState("preview");
      }
    };

    void sendAudio();
  }, [previewUrl, previewDuration, onSend, cleanup]);

  const handleTouchStart = useCallback(
    (clientY: number) => {
      if (state !== "idle") return;
      startYRef.current = clientY;
      setIsDragging(true);
      setDragY(0);
      void startRecording();
    },
    [state, startRecording]
  );

  const handleTouchMove = useCallback(
    (clientY: number) => {
      if (!isDragging || state !== "recording") return;
      const deltaY = startYRef.current - clientY;
      setDragY(Math.max(0, deltaY));
    },
    [isDragging, state]
  );

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    if (state === "recording") {
      if (dragY > 80) {
        cancelRecording();
      } else {
        stopRecording();
      }
    }
    setDragY(0);
  }, [state, dragY, stopRecording, cancelRecording]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      handleTouchStart(e.clientY);
    },
    [handleTouchStart]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      handleTouchMove(e.clientY);
    },
    [handleTouchMove]
  );

  const handleMouseUp = useCallback(() => {
    handleTouchEnd();
  }, [handleTouchEnd]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (state === "idle") {
    return (
      <div className="flex items-center gap-3 rounded-2xl border bg-background px-4 py-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-sm text-muted-foreground">Preparing microphone…</span>
      </div>
    );
  }

  if (state === "sending") {
    return (
      <div className="flex items-center gap-3 rounded-2xl border bg-background px-4 py-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-sm text-muted-foreground">Sending voice note...</span>
      </div>
    );
  }

  if (state === "preview") {
    return (
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 to-background p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (!audioRef.current) return;
              if (audioRef.current.paused) {
                void audioRef.current.play();
                setIsPlaying(true);
              } else {
                audioRef.current.pause();
                setIsPlaying(false);
              }
            }}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md"
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </button>
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-semibold">Voice note ready</span>
              <span className="text-xs text-muted-foreground">{formatTime(previewDuration)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.min(100, Math.max(12, (previewDuration / 60) * 100))}%` }} />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={cancelRecording}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100 text-red-600 transition hover:bg-red-200"
            >
              <X className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => sendPreview()}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100 text-green-600 transition hover:bg-green-200"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative flex flex-col items-center justify-center rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-primary/5 px-4 py-6 shadow-sm select-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={(e) => handleTouchStart(e.touches[0].clientY)}
      onTouchMove={(e) => handleTouchMove(e.touches[0].clientY)}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          {[18, 24, 16, 30, 20, 34, 24, 28, 18, 32, 22, 26].map((height, i) => (
            <div
              key={i}
              className="w-1 rounded-full bg-primary/80"
              style={{
                height: `${height}px`,
                animation: `voiceWave 0.8s ease-in-out infinite alternate`,
                animationDelay: `${i * 0.05}s`,
              }}
            />
          ))}
        </div>
        <span className="text-lg font-semibold">{formatTime(recordingSeconds)}</span>
      </div>

      <div className="mt-4 flex items-center gap-4">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            cancelRecording();
          }}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 transition hover:bg-red-200"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-primary/20">
          <Mic className="h-6 w-6" />
        </div>
        <div className="w-12" />
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        {dragY > 80 ? "Release to cancel" : "Slide up to lock · Release to send"}
      </p>

      <style jsx>{`
        @keyframes voiceWave {
          0% { transform: scaleY(0.5); opacity: 0.6; }
          100% { transform: scaleY(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
