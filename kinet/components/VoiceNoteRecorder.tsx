"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface VoiceNoteRecorderProps {
  onSend: (file: File, duration: number) => void;
  onCancel: () => void;
  conversationId: string;
}

type RecorderState = "idle" | "recording" | "preview" | "sending";

export default function VoiceNoteRecorder({ onSend, onCancel, conversationId }: VoiceNoteRecorderProps) {
  const [state, setState] = useState<RecorderState>("idle");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewDuration, setPreviewDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragY, setDragY] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const startYRef = useRef(0);
  const startTimeRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
  }, [previewUrl]);

  const startRecording = useCallback(async () => {
    try {
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
        const file = new File([blob], `voice-note-${Date.now()}.webm`, { type: "audio/webm" });

        setPreviewUrl(url);
        setPreviewDuration(recordingSeconds);

        const audio = new Audio(url);
        audioRef.current = audio;
        audio.addEventListener("loadedmetadata", () => {
          setPreviewDuration(audio.duration || recordingSeconds);
        });

        setState("preview");
        cleanup();
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
  }, [cleanup, onCancel, recordingSeconds]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const cancelRecording = useCallback(() => {
    cleanup();
    setState("idle");
    setRecordingSeconds(0);
    setPreviewUrl(null);
    setPreviewDuration(0);
    onCancel();
  }, [cleanup, onCancel]);

  const sendPreview = useCallback(() => {
    if (!previewUrl) return;
    setState("sending");

    fetch(previewUrl)
      .then((res) => res.blob())
      .then((blob) => {
        const file = new File([blob], `voice-note-${Date.now()}.webm`, { type: "audio/webm" });
        onSend(file, previewDuration);
        cleanup();
        setState("idle");
        setPreviewUrl(null);
        setPreviewDuration(0);
        setRecordingSeconds(0);
      })
      .catch(() => {
        setState("preview");
      });
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
    return null;
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
      <div className="flex items-center gap-3 rounded-2xl border bg-background px-4 py-3">
        <button
          type="button"
          onClick={() => {
            if (audioRef.current) {
              if (audioRef.current.paused) {
                audioRef.current.play();
              } else {
                audioRef.current.pause();
              }
            }
          }}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <div className="h-8 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-1/3 rounded-full bg-primary/30" />
            </div>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{formatTime(previewDuration)}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={cancelRecording}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-600 hover:bg-red-200"
          >
            <X className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={sendPreview}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600 hover:bg-green-200"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 px-4 py-6 select-none"
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
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="w-1 rounded-full bg-primary transition-all"
              style={{
                height: `${Math.max(8, Math.random() * 32)}px`,
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
          className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 hover:bg-red-200"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
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
