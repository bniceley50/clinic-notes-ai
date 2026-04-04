import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import { type NextRequest } from "next/server";

export type LoggingContext = {
  requestId: string;
};

type LogEntry = {
  timestamp: string;
  route: string;
  method: string;
  status: number;
  duration_ms: number;
  error: string | null;
  request_id: string;
};

export interface StructuredErrorLog {
  code: string;
  message: string;
  cause?: unknown;
  jobId?: string;
  sessionId?: string;
  orgId?: string;
  userId?: string;
  requestId?: string;
  [key: string]: unknown;
}

type RouteHandler<TArgs extends unknown[]> = (
  request: NextRequest,
  ...args: TArgs
) => Response | Promise<Response>;

const loggingContextStorage = new AsyncLocalStorage<LoggingContext>();

function writeLog(entry: LogEntry): void {
  console.log(JSON.stringify(entry));
}

function getRoutePath(request: NextRequest): string {
  const maybeNextUrl = (request as NextRequest & { nextUrl?: URL }).nextUrl;
  if (maybeNextUrl?.pathname) {
    return maybeNextUrl.pathname;
  }

  try {
    return new URL(request.url).pathname;
  } catch {
    return request.url;
  }
}

function serializeCause(cause: unknown): unknown {
  if (cause instanceof Error) {
    return {
      message: cause.message,
      stack: cause.stack,
    };
  }

  return cause;
}

export function logError(entry: StructuredErrorLog): void {
  const requestId = entry.requestId ?? getRequestId();
  console.error(
    JSON.stringify({
      level: "error",
      timestamp: new Date().toISOString(),
      ...entry,
      requestId,
      cause: serializeCause(entry.cause),
    }),
  );
}

export function getLoggingContext(): LoggingContext | undefined {
  return loggingContextStorage.getStore();
}

export function getRequestId(): string | undefined {
  return getLoggingContext()?.requestId;
}

export function withLogging<TArgs extends unknown[]>(
  handler: RouteHandler<TArgs>,
): RouteHandler<TArgs> {
  return async (request: NextRequest, ...args: TArgs): Promise<Response> => {
    const startedAt = Date.now();
    const requestId = crypto.randomUUID();

    return loggingContextStorage.run({ requestId }, async () => {
      try {
        const response = await handler(request, ...args);
        writeLog({
          timestamp: new Date().toISOString(),
          route: getRoutePath(request),
          method: request.method,
          status: response.status,
          duration_ms: Date.now() - startedAt,
          error: null,
          request_id: requestId,
        });
        return response;
      } catch (error) {
        writeLog({
          timestamp: new Date().toISOString(),
          route: getRoutePath(request),
          method: request.method,
          status: 500,
          duration_ms: Date.now() - startedAt,
          error: error instanceof Error ? error.message : "Unknown error",
          request_id: requestId,
        });
        throw error;
      }
    });
  };
}
