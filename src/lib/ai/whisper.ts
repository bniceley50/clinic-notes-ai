import "server-only";

type WhisperSuccess = {
  text: string;
};

export async function transcribeAudio(
  audioBlob: Blob,
  filename: string,
): Promise<{ text: string | null; error: string | null }> {
  if (process.env.AI_ENABLE_STUB_APIS === "1") {
    return {
      text:
        "[00:00:12] Provider: How are you feeling today?\n[00:00:18] Client: Better than last week.",
      error: null,
    };
  }

  if (process.env.AI_ENABLE_REAL_APIS !== "1") {
    return { text: null, error: "Real AI APIs are disabled" };
  }

  if (!process.env.OPENAI_API_KEY) {
    return { text: null, error: "OPENAI_API_KEY is missing" };
  }

  try {
    const formData = new FormData();
    formData.append("model", "whisper-1");
    formData.append("file", audioBlob, filename);

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: formData,
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
  } catch (error) {
    return {
      text: null,
      error: error instanceof Error ? error.message : "Whisper transcription failed",
    };
  }
}
