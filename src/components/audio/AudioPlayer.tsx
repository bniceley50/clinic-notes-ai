"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  jobId: string;
  storagePath: string;
  compact?: boolean;
};

const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }

  const wholeSeconds = Math.floor(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const remainder = wholeSeconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

export function AudioPlayer({ jobId, storagePath, compact = false }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadAudioUrl() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/jobs/${jobId}/audio-url`, {
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as
          | { url?: string; error?: string }
          | null;

        if (!response.ok || !payload?.url) {
          throw new Error(payload?.error ?? "Failed to load audio");
        }

        if (!cancelled) {
          setAudioUrl(payload.url);
        }
      } catch (loadError) {
        if (!cancelled) {
          setAudioUrl(null);
          setError(
            loadError instanceof Error ? loadError.message : "Failed to load audio",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadAudioUrl();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [jobId, storagePath]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => setDuration(audio.duration || 0);
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime || 0);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);
    const handleError = () => {
      setError("Audio playback is unavailable for this recording.");
      setIsPlaying(false);
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
    };
  }, [audioUrl]);

  const timeLabel = useMemo(
    () => `${formatTime(currentTime)} / ${formatTime(duration)}`,
    [currentTime, duration],
  );

  function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      void audio.play().catch(() => {
        setError("Unable to start audio playback.");
      });
      return;
    }

    audio.pause();
  }

  function seekTo(seconds: number) {
    const audio = audioRef.current;
    if (!audio) return;

    const nextTime = Math.min(Math.max(seconds, 0), duration || 0);
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  }

  function skipBy(deltaSeconds: number) {
    seekTo(currentTime + deltaSeconds);
  }

  function updatePlaybackRate(nextRate: number) {
    const audio = audioRef.current;
    setPlaybackRate(nextRate);
    if (audio) {
      audio.playbackRate = nextRate;
    }
  }

  return (
    <div
      className={`rounded border ${compact ? "p-3" : "p-4"}`}
      style={{ borderColor: "#E7E9EC", backgroundColor: compact ? "#FBFCFD" : "#FFFFFF" }}
      data-testid={compact ? "audio-player-compact" : "audio-player"}
    >
      <audio ref={audioRef} src={audioUrl ?? undefined} preload="metadata" />

      {loading ? (
        <p className="text-xs" style={{ color: "#777777" }}>
          Loading audio...
        </p>
      ) : error ? (
        <p className="text-xs font-medium" style={{ color: "#CC2200" }} role="alert">
          {error}
        </p>
      ) : (
        <div className={compact ? "space-y-2" : "space-y-3"}>
          {!compact && (
            <div>
              <p className="ql-kicker">Audio Review</p>
              <h3 className="text-sm font-semibold" style={{ color: "#0B1215" }}>
                Playback
              </h3>
            </div>
          )}

          <div
            className={`flex ${compact ? "flex-wrap items-center gap-2" : "flex-col gap-3"}`}
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={togglePlayback}
                className="rounded px-3 py-1 text-xs font-semibold"
                style={{ backgroundColor: "#3B276A", color: "#FFFFFF" }}
              >
                {isPlaying ? "Pause" : "Play"}
              </button>
              <button
                type="button"
                onClick={() => skipBy(-10)}
                className="rounded px-3 py-1 text-xs font-semibold"
                style={{ backgroundColor: "#E7E9EC", color: "#517AB7" }}
              >
                -10s
              </button>
              <button
                type="button"
                onClick={() => skipBy(10)}
                className="rounded px-3 py-1 text-xs font-semibold"
                style={{ backgroundColor: "#E7E9EC", color: "#517AB7" }}
              >
                +10s
              </button>
            </div>

            <div className={`flex ${compact ? "min-w-[240px] flex-1 items-center gap-2" : "items-center gap-3"}`}>
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={Math.min(currentTime, duration || 0)}
                onChange={(event) => seekTo(Number(event.target.value))}
                className="flex-1"
                aria-label="Seek audio"
              />
              <span className="text-xs tabular-nums" style={{ color: "#555555" }}>
                {timeLabel}
              </span>
              <select
                value={playbackRate}
                onChange={(event) => updatePlaybackRate(Number(event.target.value))}
                className="rounded border px-2 py-1 text-xs"
                style={{ borderColor: "#D1D5DB", color: "#0B1215" }}
                aria-label="Playback speed"
              >
                {PLAYBACK_SPEEDS.map((speed) => (
                  <option key={speed} value={speed}>
                    {speed}x
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
