"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export type RecorderState = "idle" | "requesting" | "recording" | "stopped" | "error";

export type UseAudioRecorderResult = {
  state: RecorderState;
  elapsed: number; // seconds
  blob: Blob | null;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
  reset: () => void;
};

export function useAudioRecorder(): UseAudioRecorderResult {
  const [state, setState] = useState<RecorderState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setBlob(null);
    chunksRef.current = [];
    setState("requesting");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setState("error");
      setError("Microphone access denied. Please allow microphone access and try again.");
      return;
    }

    streamRef.current = stream;

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";

    const recorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const recorded = new Blob(chunksRef.current, { type: mimeType });
      setBlob(recorded);
      setState("stopped");
      stopStream();
    };

    recorder.start(250); // collect chunks every 250ms
    setState("recording");
    setElapsed(0);

    timerRef.current = setInterval(() => {
      setElapsed((s) => s + 1);
    }, 1000);
  }, [stopStream]);

  const stop = useCallback(() => {
    stopTimer();
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
  }, [stopTimer]);

  const reset = useCallback(() => {
    stopTimer();
    stopStream();
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    setBlob(null);
    setError(null);
    setElapsed(0);
    setState("idle");
  }, [stopTimer, stopStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimer();
      stopStream();
    };
  }, [stopTimer, stopStream]);

  return { state, elapsed, blob, error, start, stop, reset };
}