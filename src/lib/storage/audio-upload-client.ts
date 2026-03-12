import { createClient } from "@supabase/supabase-js";

const MAX_SIZE_MB = 24;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

const EXTENSION_TO_MIME: Record<string, string> = {
  webm: "audio/webm",
  mp3: "audio/mpeg",
  mp4: "audio/mp4",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
  wav: "audio/wav",
};

type SignedUploadPayload = {
  path: string;
  token: string;
};

type UploadCompletePayload = {
  audio_storage_path: string;
};

let storageClient:
  | ReturnType<typeof createClient>
  | null = null;

function getStorageClient() {
  if (storageClient) {
    return storageClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase client is not configured for browser uploads");
  }

  storageClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return storageClient;
}

function extensionForFile(name: string): string | null {
  const ext = name.split(".").pop()?.toLowerCase();
  return ext && ext in EXTENSION_TO_MIME ? ext : null;
}

function normalizeAudioContentType(file: File): string | null {
  const normalized = file.type.toLowerCase();
  if (normalized === "audio/webm" || normalized === "audio/webm;codecs=opus") {
    return "audio/webm";
  }
  if (normalized === "audio/mp4" || normalized === "audio/x-m4a" || normalized === "audio/m4a") {
    return "audio/mp4";
  }
  if (normalized === "audio/mpeg" || normalized === "audio/mp3") {
    return "audio/mpeg";
  }
  if (normalized === "audio/ogg") {
    return "audio/ogg";
  }
  if (normalized === "audio/wav" || normalized === "audio/x-wav") {
    return "audio/wav";
  }

  const ext = extensionForFile(file.name);
  return ext ? EXTENSION_TO_MIME[ext] : null;
}

function isValidAudioSignature(bytes: Uint8Array): boolean {
  return (
    (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) ||
    (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) ||
    (bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) ||
    (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) ||
    (bytes[0] === 0xff && (bytes[1] === 0xfb || bytes[1] === 0xf3 || bytes[1] === 0xf2)) ||
    (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33)
  );
}

async function parseError(response: Response, fallback: string): Promise<string> {
  const payload = await response.json().catch(() => null) as { error?: string } | null;
  return payload?.error ?? fallback;
}

export async function validateAudioFile(file: File): Promise<string | null> {
  const contentType = normalizeAudioContentType(file);
  if (!contentType) {
    return `Invalid file type: ${file.type || file.name}. Please select a supported audio file.`;
  }

  if (file.size > MAX_SIZE_BYTES) {
    return `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max is 24 MB. For longer sessions, record in a compressed format — a 60-min session in WebM, M4A, or MP3 at standard quality is typically under 15 MB.`;
  }

  const headerBytes = await file.slice(0, 12).arrayBuffer();
  const bytes = new Uint8Array(headerBytes);
  if (!isValidAudioSignature(bytes)) {
    return "File content does not match a supported audio format.";
  }

  return null;
}

export async function uploadAudioForJobDirect(
  jobId: string,
  file: File,
): Promise<string> {
  const contentType = normalizeAudioContentType(file);
  if (!contentType) {
    throw new Error("Unsupported audio format");
  }

  const initResponse = await fetch(`/api/jobs/${jobId}/upload-url`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fileName: file.name,
      contentType,
    }),
  });

  if (!initResponse.ok) {
    throw new Error(await parseError(initResponse, `Upload failed (${initResponse.status})`));
  }

  const initPayload = await initResponse.json() as SignedUploadPayload;
  const supabase = getStorageClient();
  const { error: uploadError } = await supabase.storage
    .from("audio")
    .uploadToSignedUrl(initPayload.path, initPayload.token, file, {
      contentType,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const completeResponse = await fetch(`/api/jobs/${jobId}/upload-complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fileName: file.name,
      fileSizeBytes: file.size,
    }),
  });

  if (!completeResponse.ok) {
    throw new Error(await parseError(completeResponse, `Upload failed (${completeResponse.status})`));
  }

  const completePayload = await completeResponse.json() as UploadCompletePayload;
  return completePayload.audio_storage_path;
}