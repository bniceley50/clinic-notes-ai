import { NextResponse, type NextRequest } from "next/server";
import { loadCurrentUser } from "@/lib/auth/loader";
import { getLatestTranscriptForSession } from "@/lib/clinical/queries";
import { writeAuditLog } from "@/lib/audit";
import { anthropicApiKey, aiRealApisEnabled } from "@/lib/config";
import { getMyJob } from "@/lib/jobs/queries";
import {
  CARELOGIC_INTAKE_PROMPT,
  CARELOGIC_SESSION_PROMPT,
} from "@/lib/prompts/carelogic-prompts";
import { apiLimit, checkRateLimit, getIdentifier } from "@/lib/rate-limit";
import { getMySession } from "@/lib/sessions/queries";
import { withLogging } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string }> };

type AnthropicTextBlock = {
  type: "text";
  text: string;
};

type AnthropicResponse = {
  content?: Array<AnthropicTextBlock | { type: string }>;
  error?: {
    message?: string;
  };
};

function parseJsonPayload(text: string): Record<string, string> {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");
  return JSON.parse(cleaned) as Record<string, string>;
}

export const GET = withLogging(async (request: NextRequest, ctx: RouteContext) => {
  const result = await loadCurrentUser();

  if (result.status !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const identifier = getIdentifier(request, result.user.userId);
  const limited = await checkRateLimit(apiLimit, identifier);
  if (limited) return limited;

  const { id } = await ctx.params;
  const jobResult = await getMyJob(result.user, id);

  if (jobResult.error || !jobResult.data) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const sessionResult = await getMySession(result.user, jobResult.data.session_id);
  if (sessionResult.error || !sessionResult.data) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const transcriptResult = await getLatestTranscriptForSession(
    result.user,
    jobResult.data.session_id,
  );

  if (transcriptResult.error) {
    return NextResponse.json(
      { error: "Failed to load transcript" },
      { status: 500 },
    );
  }

  if (!transcriptResult.data) {
    return NextResponse.json({ error: "Transcript not found" }, { status: 404 });
  }

  if (!aiRealApisEnabled()) {
    return NextResponse.json(
      { error: "CareLogic field generation is unavailable" },
      { status: 503 },
    );
  }

  try {
    const prompt =
      sessionResult.data.session_type === "intake"
        ? CARELOGIC_INTAKE_PROMPT
        : CARELOGIC_SESSION_PROMPT;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicApiKey(),
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        system: prompt,
        messages: [
          {
            role: "user",
            content: transcriptResult.data.content,
          },
        ],
      }),
    });

    const payload = (await response.json().catch(() => null)) as AnthropicResponse | null;

    if (!response.ok || !payload) {
      return NextResponse.json(
        {
          error:
            payload?.error?.message ??
            `Claude request failed (${response.status})`,
        },
        { status: 502 },
      );
    }

    const firstTextBlock = payload.content?.find(
      (block): block is AnthropicTextBlock => block.type === "text",
    );

    if (!firstTextBlock?.text) {
      return NextResponse.json(
        { error: "Claude returned no text content" },
        { status: 502 },
      );
    }

    const fields = parseJsonPayload(firstTextBlock.text);

    void writeAuditLog({
      orgId: result.user.orgId,
      actorId: result.user.userId,
      sessionId: jobResult.data.session_id,
      jobId: jobResult.data.id,
      action: "carelogic_fields_generated",
      vendor: "anthropic",
      requestId: request.headers.get("x-vercel-id") ?? undefined,
      metadata: {
        session_type: sessionResult.data.session_type,
      },
    });

    return NextResponse.json({
      fields,
      sessionType: sessionResult.data.session_type,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate CareLogic fields",
      },
      { status: 500 },
    );
  }
});