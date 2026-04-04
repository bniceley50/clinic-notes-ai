"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { readErrorMessage } from "@/lib/errors/codes";

type AudioPlayerProps = {
  jobId: string;
  compact?: boolean;
};

type AudioUrlResponse = {
  url: string;
  filename: string;
};

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

const PLAYER_MESSAGE_CLASS = "rounded border border-border-subtle px-3 py-2 text-xs text-text-muted";
const PLAYER_ERROR_CLASS = "rounded border border-[#F4CCCC] px-3 py-2 text-xs text-[#B42318]";
const PLAYER_SURFACE_CLASS = "rounded border border-border-subtle bg-white";
const PLAYER_PRIMARY_BUTTON_CLASS = "rounded bg-primary px-3 py-1 text-xs font-semibold text-white";
const PLAYER_SECONDARY_BUTTON_CLASS = "rounded bg-border-subtle px-2 py-1 text-xs font-semibold text-accent";
const PLAYER_SPEED_SELECT_CLASS = "rounded border border-[#D6DADE] bg-white px-2 py-1 text-xs";

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
  const [downloading, setDownloading] = useState(false);
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
          | null;

        if (!response.ok || !payload || !("url" in payload)) {
          if (!cancelled) {
            setError(readErrorMessage(payload) ?? "No audio available");
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

  async function handleDownload() {
    if (!signedUrl || downloading) return;

    setDownloading(true);
    setError(null);

    try {
      const response = await fetch(signedUrl);
      if (!response.ok) {
        throw new Error("Failed to download audio");
      }

      const blob = await response.blob();
      if (blob.size === 0) {
        throw new Error("Downloaded audio was empty");
      }

      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = fileName;
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      window.setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
        document.body.removeChild(anchor);
      }, 1_000);
    } catch {
      setError("Download failed. Opening audio in a new tab instead.");
      window.open(signedUrl, "_blank", "noopener,noreferrer");
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return (
      <div className={PLAYER_MESSAGE_CLASS}>
        Loading audio...
      </div>
    );
  }

  if (error || !signedUrl) {
    return (
      <div className={PLAYER_ERROR_CLASS}>
        {error || "No audio available"}
      </div>
    );
  }

  return (
    <div
      className={`${PLAYER_SURFACE_CLASS} ${compact ? "px-3 py-2" : "p-4"}`}
    >
      <audio ref={audioRef} preload="metadata" src={signedUrl} />

      <div className={`flex ${compact ? "flex-nowrap items-center gap-2" : "flex-col gap-3"}`}>
        <div className={`flex ${compact ? "items-center gap-2" : "flex-wrap items-center gap-2"}`}>
          <button
            type="button"
            onClick={() => void togglePlayback()}
            className={PLAYER_PRIMARY_BUTTON_CLASS}
            aria-label={isPlaying ? "Pause recording" : "Play recording"}
          >
            {isPlaying ? "Pause" : "Play"}
          </button>
          <button
            type="button"
            onClick={() => skipBy(-10)}
            className={PLAYER_SECONDARY_BUTTON_CLASS}
            aria-label="Skip back 10 seconds"
          >
            -10s
          </button>
          <button
            type="button"
            onClick={() => skipBy(10)}
            className={PLAYER_SECONDARY_BUTTON_CLASS}
            aria-label="Skip forward 10 seconds"
          >
            +10s
          </button>
          {!compact && (
            <label className="flex items-center gap-2 text-xs text-text-body">
              <span>Speed</span>
              <select
                value={playbackRate}
                onChange={(event) => setPlaybackRate(Number(event.target.value))}
                className={PLAYER_SPEED_SELECT_CLASS}
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
          <span className="shrink-0 text-xs tabular-nums text-[#555555]">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
          <button
            type="button"
            onClick={() => void handleDownload()}
            disabled={downloading}
            className="shrink-0 text-xs font-medium text-accent"
          >
            {downloading ? "Downloading..." : "Download"}
          </button>
        </div>
      </div>
    </div>
  );
}
