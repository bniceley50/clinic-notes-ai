"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export type RecorderState =
  | "idle"
  | "requesting"
  | "recording"
  | "paused"
  | "stopped"
  | "error";

export type UseAudioRecorderResult = {
  state: RecorderState;
  elapsed: number;
  blob: Blob | null;
  error: string | null;
  start: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  reset: () => void;
};

const RECORDER_TIMESLICE_MS = 1_000;
const RECORDER_AUDIO_BITS_PER_SECOND = 128_000;
const PREFERRED_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
] as const;

function resolveRecorderMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") {
    return null;
  }

  for (const candidate of PREFERRED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }

  return null;
}

function hasUsableAudioTrack(stream: MediaStream): boolean {
  const tracks = stream.getAudioTracks();
  return tracks.some((track) => track.readyState === "live" && track.enabled);
}

export function useAudioRecorder(): UseAudioRecorderResult {
  const [state, setState] = useState<RecorderState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mimeTypeRef = useRef<string>("audio/webm");

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    timerRef.current = setInterval(() => {
      setElapsed((seconds) => seconds + 1);
    }, 1000);
  }, [stopTimer]);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const finalizeRecording = useCallback(() => {
    const totalBytes = chunksRef.current.reduce((sum, chunk) => sum + chunk.size, 0);
    mediaRecorderRef.current = null;

    if (totalBytes === 0) {
      setBlob(null);
      setState("error");
      setError("No audio was captured. Check your microphone input and try again.");
      stopStream();
      return;
    }

    const recorded = new Blob(chunksRef.current, { type: mimeTypeRef.current });
    setBlob(recorded);
    setState("stopped");
    stopStream();
  }, [stopStream]);

  const start = useCallback(async () => {
    setError(null);
    setBlob(null);
    chunksRef.current = [];
    setState("requesting");

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== "function"
    ) {
      setState("error");
      setError("This browser cannot access a microphone. Use Chrome or Edge and try again.");
      return;
    }

    if (typeof MediaRecorder === "undefined") {
      setState("error");
      setError("This browser does not support in-app recording. Use Chrome or Edge and try again.");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setState("error");
      setError("Microphone access denied. Please allow microphone access and try again.");
      return;
    }

    streamRef.current = stream;

    if (!hasUsableAudioTrack(stream)) {
      stopStream();
      setState("error");
      setError("No usable microphone input was found. Check your selected microphone and try again.");
      return;
    }

    const mimeType = resolveRecorderMimeType();

    let recorder: MediaRecorder;
    try {
      recorder = mimeType
        ? new MediaRecorder(stream, {
            mimeType,
            audioBitsPerSecond: RECORDER_AUDIO_BITS_PER_SECOND,
          })
        : new MediaRecorder(stream, {
            audioBitsPerSecond: RECORDER_AUDIO_BITS_PER_SECOND,
          });
    } catch {
      stopStream();
      setState("error");
      setError("Unable to start recording with this browser configuration. Use Chrome or Edge and try again.");
      return;
    }

    mimeTypeRef.current = recorder.mimeType || mimeType || "audio/webm";
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };

    recorder.onerror = () => {
      stopTimer();
      mediaRecorderRef.current = null;
      setState("error");
      setError("Recording failed. Check your microphone input and try again.");
      stopStream();
    };

    recorder.onstop = finalizeRecording;

    try {
      recorder.start(RECORDER_TIMESLICE_MS);
      setState("recording");
      setElapsed(0);
      startTimer();
    } catch {
      mediaRecorderRef.current = null;
      stopStream();
      setState("error");
      setError("Failed to start recording. Check your microphone and try again.");
    }
  }, [finalizeRecording, startTimer, stopStream, stopTimer]);

  const pause = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.pause();
      stopTimer();
      setState("paused");
    }
  }, [stopTimer]);

  const resume = useCallback(() => {
    if (mediaRecorderRef.current?.state === "paused") {
      mediaRecorderRef.current.resume();
      startTimer();
      setState("recording");
    }
  }, [startTimer]);

  const stop = useCallback(() => {
    stopTimer();
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.requestData();
      } catch {
        /* ignore requestData failures and rely on stop */
      }
      recorder.stop();
    }
  }, [stopTimer]);

  const reset = useCallback(() => {
    stopTimer();
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.ondataavailable = null;
      recorder.onerror = null;
      recorder.onstop = null;
      try {
        recorder.stop();
      } catch {
        /* ignore stop errors during reset */
      }
    }
    stopStream();
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    setBlob(null);
    setError(null);
    setElapsed(0);
    setState("idle");
  }, [stopTimer, stopStream]);

  useEffect(() => {
    return () => {
      stopTimer();
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.ondataavailable = null;
        recorder.onerror = null;
        recorder.onstop = null;
        try {
          recorder.stop();
        } catch {
          /* ignore stop errors on unmount */
        }
      }
      stopStream();
    };
  }, [stopTimer, stopStream]);

  return { state, elapsed, blob, error, start, pause, resume, stop, reset };
}
