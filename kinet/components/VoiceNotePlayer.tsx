"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface VoiceNotePlayerProps {
  url: string;
  duration?: number;
  isOwn?: boolean;
}

export default function VoiceNotePlayer({ url, duration, isOwn = false }: VoiceNotePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [displayDuration, setDisplayDuration] = useState(duration ?? 0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(url);
    audioRef.current = audio;

    audio.addEventListener("loadedmetadata", () => {
      setDisplayDuration(audio.duration || duration || 0);
    });

    audio.addEventListener("timeupdate", () => {
      setCurrentTime(audio.currentTime);
    });

    audio.addEventListener("ended", () => {
      setIsPlaying(false);
      setCurrentTime(0);
    });

    return () => {
      audio.pause();
      audio.src = "";
    };
  }, [url, duration]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play();
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const progress = displayDuration > 0 ? (currentTime / displayDuration) * 100 : 0;

  const barCount = 32;
  const activeBars = Math.floor((progress / 100) * barCount);

  return (
    <div className={`flex items-center gap-3 rounded-2xl px-3 py-2 ${isOwn ? "bg-white/20" : "bg-muted/60"} min-w-[200px]`}>
      <button
        type="button"
        onClick={togglePlay}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/90 text-primary shadow-sm hover:bg-white"
      >
        {isPlaying ? (
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current ml-0.5">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      <div className="flex-1">
        <div className="flex items-center gap-[2px] h-8">
          {[...Array(barCount)].map((_, i) => {
            const height = 20 + Math.sin(i * 0.8) * 8 + Math.random() * 12;
            const isActive = i < activeBars;
            return (
              <div
                key={i}
                className="w-1 shrink-0 rounded-full transition-all duration-150"
                style={{
                  height: `${height}px`,
                  backgroundColor: isActive
                    ? isOwn
                      ? "rgba(255,255,255,0.95)"
                      : "rgb(var(--primary))"
                    : isOwn
                      ? "rgba(255,255,255,0.4)"
                      : "rgb(var(--muted-foreground) / 0.4)",
                }}
              />
            );
          })}
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-muted-foreground">
            {isPlaying ? formatTime(currentTime) : formatTime(0)}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {formatTime(displayDuration)}
          </span>
        </div>
      </div>
    </div>
  );
}
