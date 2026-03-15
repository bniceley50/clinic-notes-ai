"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type AudioPlayerProps = {
  jobId: string;
  compact?: boolean;
};

type AudioUrlResponse = {
  url: string;
  filename: string;
};

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";

  const totalSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export function AudioPlayer({ jobId, compact = false }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("session-recording.webm");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  useEffect(() => {
    let cancelled = false;

    async function loadAudioUrl() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/jobs/${jobId}/audio-url`);
        const payload = (await response.json().catch(() => null)) as
          | AudioUrlResponse
          | { error?: string }
          | null;

        if (!response.ok || !payload || !("url" in payload)) {
          if (!cancelled) {
            setError(
              (payload && "error" in payload && payload.error) ||
                "No audio available",
            );
          }
          return;
        }

        if (!cancelled) {
          setSignedUrl(payload.url);
          setFileName(payload.filename || "session-recording.webm");
        }
      } catch {
        if (!cancelled) {
          setError("No audio available");
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
    };
  }, [jobId]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.playbackRate = playbackRate;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
    };
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(audio.duration || 0);
    };
    const handlePause = () => {
      setIsPlaying(false);
    };
    const handlePlay = () => {
      setIsPlaying(true);
    };
    const handleError = () => {
      setError("Unable to play this recording");
      setIsPlaying(false);
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("error", handleError);
    };
  }, [playbackRate, signedUrl]);

  const progressMax = useMemo(() => Math.max(duration, 0), [duration]);

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        setError("Unable to start audio playback");
      }
      return;
    }

    audio.pause();
  }

  function seekTo(nextTime: number) {
    const audio = audioRef.current;
    if (!audio) return;

    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  }

  function skipBy(delta: number) {
    const audio = audioRef.current;
    if (!audio) return;

    const nextTime = Math.min(
      Math.max(audio.currentTime + delta, 0),
      audio.duration || duration || 0,
    );
    seekTo(nextTime);
  }

  if (loading) {
    return (
      <div className="rounded border px-3 py-2 text-xs" style={{ borderColor: "#E7E9EC", color: "#777777" }}>
        Loading audio...
      </div>
    );
  }

  if (error || !signedUrl) {
    return (
      <div className="rounded border px-3 py-2 text-xs" style={{ borderColor: "#F4CCCC", color: "#B42318" }}>
        {error || "No audio available"}
      </div>
    );
  }

  return (
    <div
      className={`rounded border ${compact ? "px-3 py-2" : "p-4"}`}
      style={{ borderColor: "#E7E9EC", backgroundColor: "#FFFFFF" }}
    >
      <audio ref={audioRef} preload="metadata" src={signedUrl} />

      <div className={`flex ${compact ? "flex-nowrap items-center gap-2" : "flex-col gap-3"}`}>
        <div className={`flex ${compact ? "items-center gap-2" : "flex-wrap items-center gap-2"}`}>
          <button
            type="button"
            onClick={() => void togglePlayback()}
            className="rounded px-3 py-1 text-xs font-semibold"
            style={{ backgroundColor: "#3B276A", color: "#FFFFFF" }}
            aria-label={isPlaying ? "Pause recording" : "Play recording"}
          >
            {isPlaying ? "Pause" : "Play"}
          </button>
          <button
            type="button"
            onClick={() => skipBy(-10)}
            className="rounded px-2 py-1 text-xs font-semibold"
            style={{ backgroundColor: "#E7E9EC", color: "#517AB7" }}
            aria-label="Skip back 10 seconds"
          >
            -10s
          </button>
          <button
            type="button"
            onClick={() => skipBy(10)}
            className="rounded px-2 py-1 text-xs font-semibold"
            style={{ backgroundColor: "#E7E9EC", color: "#517AB7" }}
            aria-label="Skip forward 10 seconds"
          >
            +10s
          </button>
          {!compact && (
            <label className="flex items-center gap-2 text-xs" style={{ color: "#555555" }}>
              <span>Speed</span>
              <select
                value={playbackRate}
                onChange={(event) => setPlaybackRate(Number(event.target.value))}
                className="rounded border px-2 py-1 text-xs"
                style={{ borderColor: "#D6DADE", backgroundColor: "#FFFFFF" }}
                aria-label="Playback speed"
              >
                {SPEED_OPTIONS.map((speed) => (
                  <option key={speed} value={speed}>
                    {speed}x
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className={`flex ${compact ? "min-w-0 flex-1 items-center gap-2" : "items-center gap-3"}`}>
          <input
            type="range"
            min={0}
            max={progressMax || 0}
            step={0.1}
            value={Math.min(currentTime, progressMax || 0)}
            onChange={(event) => seekTo(Number(event.target.value))}
            className="min-w-0 flex-1 accent-[#3B276A]"
            aria-label="Seek audio"
          />
          <span className="shrink-0 text-xs tabular-nums" style={{ color: "#555555" }}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
          <a
            href={signedUrl}
            download={fileName}
            className="shrink-0 text-xs font-medium no-underline"
            style={{ color: "#517AB7" }}
          >
            Download
          </a>
        </div>
      </div>
    </div>
  );
}
