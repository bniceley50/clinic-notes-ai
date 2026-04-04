export const ErrorCodes = {
  UNAUTHORIZED: "UNAUTHORIZED",
  AUDIO_URL_SIGN_FAILED: "AUDIO_URL_SIGN_FAILED",
  JOB_CREATE_FAILED: "JOB_CREATE_FAILED",
  JOB_CANCEL_FAILED: "JOB_CANCEL_FAILED",
  JOB_TRIGGER_FAILED: "JOB_TRIGGER_FAILED",
  JOB_PROCESS_FAILED: "JOB_PROCESS_FAILED",
  JOB_STATUS_CONFLICT: "JOB_STATUS_CONFLICT",
  JOB_PROCESSOR_ERROR: "JOB_PROCESSOR_ERROR",
  JOB_UPLOAD_URL_FAILED: "JOB_UPLOAD_URL_FAILED",
  JOB_UPLOAD_COMPLETE_FAILED: "JOB_UPLOAD_COMPLETE_FAILED",
  JOB_UPLOAD_FAILED: "JOB_UPLOAD_FAILED",
  JOB_EVENTS_STREAM_ERROR: "JOB_EVENTS_STREAM_ERROR",
  EHR_EXTRACTION_FAILED: "EHR_EXTRACTION_FAILED",
  NOTE_GENERATION_FAILED: "NOTE_GENERATION_FAILED",
  NOTE_UPDATE_FAILED: "NOTE_UPDATE_FAILED",
  SESSION_CREATE_FAILED: "SESSION_CREATE_FAILED",
  SESSION_DELETE_FAILED: "SESSION_DELETE_FAILED",
  DEV_LOGIN_FAILED: "DEV_LOGIN_FAILED",
  DEV_BOOTSTRAP_FAILED: "DEV_BOOTSTRAP_FAILED",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export type ErrorResponseBody = {
  error: {
    code: string;
    message: string;
  };
};

export function readErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const error = (payload as { error?: unknown }).error;
  if (typeof error === "string") {
    return error;
  }

  if (!error || typeof error !== "object") {
    return null;
  }

  const message = (error as { message?: unknown }).message;
  return typeof message === "string" ? message : null;
}
