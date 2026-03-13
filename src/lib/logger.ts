import "server-only";

import { type NextRequest } from "next/server";

type LogEntry = {
  timestamp: string;
  route: string;
  method: string;
  status: number;
  duration_ms: number;
  error: string | null;
  request_id: string;
};

type RouteHandler<TArgs extends unknown[]> = (
  request: NextRequest,
  ...args: TArgs
) => Response | Promise<Response>;

function writeLog(entry: LogEntry): void {
  console.log(JSON.stringify(entry));
}function getRoutePath(request: NextRequest): string {
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

export function withLogging<TArgs extends unknown[]>(
  handler: RouteHandler<TArgs>,
): RouteHandler<TArgs> {
  return (async (request: NextRequest, ...args: TArgs): Promise<Response> => {
    const startedAt = Date.now();
    const requestId = crypto.randomUUID();

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
  }) as RouteHandler<TArgs>;
}
