import { NextResponse, type NextRequest } from "next/server";
import {
  aiRealApisEnabled,
  aiStubApisEnabled,
  jobsRunnerToken,
} from "@/lib/config";
import { listQueuedJobs } from "@/lib/jobs/queries";

function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000")
  );
}

function isDebugAllowed(request: NextRequest): boolean {
  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  const secret = request.nextUrl.searchParams.get("secret");
  const token = jobsRunnerToken();
  return Boolean(token && secret === token);
}

async function readJsonSafely(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function GET(request: NextRequest) {
  if (!isDebugAllowed(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const runnerToken = jobsRunnerToken();
  const baseUrl = getBaseUrl();
  const queued = await listQueuedJobs();
  const oldestQueued = queued.data.slice(0, 3).map((job) => ({
    id: job.id,
    created_at: job.created_at,
    audio_storage_path_present: Boolean(job.audio_storage_path),
  }));

  let runnerTest: {
    processUrl: string | null;
    status: number | null;
    body: unknown;
  } = {
    processUrl: null,
    status: null,
    body: null,
  };

  const firstQueued = queued.data[0];
  if (firstQueued) {
    const processUrl = new URL(`/api/jobs/${firstQueued.id}/process`, baseUrl).toString();

    try {
      const response = await fetch(processUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${runnerToken ?? ""}`,
        },
      });

      runnerTest = {
        processUrl,
        status: response.status,
        body: await readJsonSafely(response),
      };
    } catch (error) {
      runnerTest = {
        processUrl,
        status: null,
        body:
          error instanceof Error
            ? { error: error.message }
            : { error: "Runner test failed" },
      };
    }
  }

  return NextResponse.json({
    jobsRunnerTokenPresent: Boolean(runnerToken),
    nextPublicAppUrl: process.env.NEXT_PUBLIC_APP_URL ?? null,
    vercelUrl: process.env.VERCEL_URL ?? null,
    nodeEnv: process.env.NODE_ENV ?? null,
    aiEnableRealApis: aiRealApisEnabled(),
    aiEnableStubApis: aiStubApisEnabled(),
    openAiApiKeyPresent: Boolean(process.env.OPENAI_API_KEY),
    anthropicApiKeyPresent: Boolean(process.env.ANTHROPIC_API_KEY),
    oldestQueuedJobs: oldestQueued,
    runnerBaseUrl: baseUrl,
    listQueuedJobs: {
      count: queued.data.length,
      error: queued.error,
    },
    runnerTest,
  });
}