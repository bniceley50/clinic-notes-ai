import "server-only";

import {
  aiRealApisEnabled,
  aiStubApisEnabled,
  aiWhisperTimeoutMs,
  openaiApiKey,
} from "@/lib/config";

type WhisperSuccess = {
  text: string;
};

export async function transcribeAudio(
  audioBlob: Blob,
  filename: string,
): Promise<{ text: string | null; error: string | null }> {
  if (aiStubApisEnabled()) {
    return {
      text:
        "[00:00:12] Provider: How are you feeling today?\n[00:00:18] Client: Better than last week.",
      error: null,
    };
  }

  if (!aiRealApisEnabled()) {
    return { text: null, error: "Real AI APIs are disabled" };
  }

  let apiKey: string;
  try {
    apiKey = openaiApiKey();
  } catch {
    return { text: null, error: "OPENAI_API_KEY is missing" };
  }

  try {
    const formData = new FormData();
    formData.append("model", "whisper-1");
    formData.append("file", audioBlob, filename);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), aiWhisperTimeoutMs());

    try {
      const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
        signal: controller.signal,
      });

      const payload = (await response.json().catch(() => null)) as
        | WhisperSuccess
        | { error?: { message?: string } }
        | null;

      if (!response.ok || !payload || !("text" in payload)) {
        return {
          text: null,
          error:
            (payload &&
              "error" in payload &&
              payload.error &&
              payload.error.message) ||
            `Whisper request failed (${response.status})`,
        };
      }

      return { text: payload.text, error: null };
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    return {
      text: null,
      error: error instanceof Error ? error.message : "Whisper transcription failed",
    };
  }
}
const WHISPER_CHUNK_BYTES = 23 * 1024 * 1024; // 23 MB - safe margin under 25 MB limit

export async function transcribeAudioChunked(
  audioBlob: Blob,
  filename: string,
  onChunkComplete?: (chunkIndex: number, totalChunks: number) => Promise<void>,
): Promise<{ text: string | null; error: string | null }> {
  if (audioBlob.size <= WHISPER_CHUNK_BYTES) {
    return transcribeAudio(audioBlob, filename);
  }

  const ext = filename.includes(".") ? filename.split(".").pop()! : "webm";
  const totalChunks = Math.ceil(audioBlob.size / WHISPER_CHUNK_BYTES);
  const parts: string[] = [];

  for (let i = 0; i < totalChunks; i++) {
    const start = i * WHISPER_CHUNK_BYTES;
    const end = Math.min(start + WHISPER_CHUNK_BYTES, audioBlob.size);
    const chunkBlob = audioBlob.slice(start, end);
    const chunkFilename = `${filename.replace(`.${ext}`, "")}-part-${String(i + 1).padStart(3, "0")}.${ext}`;

    const result = await transcribeAudio(chunkBlob, chunkFilename);
    if (result.error || !result.text) {
      return {
        text: null,
        error: `Chunk ${i + 1}/${totalChunks} failed: ${result.error ?? "empty transcript"}`,
      };
    }

    parts.push(result.text.trim());

    if (onChunkComplete) {
      await onChunkComplete(i + 1, totalChunks);
    }
  }

  return { text: parts.join("\n"), error: null };
}
