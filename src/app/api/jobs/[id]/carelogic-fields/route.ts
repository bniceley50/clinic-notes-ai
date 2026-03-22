import type { NextRequest } from "next/server";
import { loadCurrentUser } from "@/lib/auth/loader";
import {
  getExtractionForTranscript,
  getTranscriptForJob,
  upsertExtraction,
} from "@/lib/clinical/queries";
import { writeAuditLog } from "@/lib/audit";
import { anthropicApiKey, aiRealApisEnabled } from "@/lib/config";
import { jsonNoStore } from "@/lib/http/response";
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

function getAnthropicApiKeyOrError(): { key: string | null; error: string | null } {
  try {
    return { key: anthropicApiKey(), error: null };
  } catch {
    return {
      key: null,
      error: "Anthropic EHR field extraction is not configured",
    };
  }
}

export const GET = withLogging(async (request: NextRequest, ctx: RouteContext) => {
  const result = await loadCurrentUser();

  if (result.status !== "authenticated") {
    return jsonNoStore({ error: "Unauthorized" }, { status: 401 });
  }

  const identifier = getIdentifier(request, result.user.userId);
  const limited = await checkRateLimit(apiLimit, identifier);
  if (limited) return limited;

  const { id } = await ctx.params;
  const jobResult = await getMyJob(result.user, id);

  if (jobResult.error || !jobResult.data) {
    return jsonNoStore({ error: "Job not found" }, { status: 404 });
  }

  const sessionResult = await getMySession(result.user, jobResult.data.session_id);
  if (sessionResult.error || !sessionResult.data) {
    return jsonNoStore({ error: "Session not found" }, { status: 404 });
  }

  const transcriptResult = await getTranscriptForJob(
    result.user,
    jobResult.data.session_id,
    jobResult.data.id,
  );

  if (transcriptResult.error) {
    return jsonNoStore(
      { error: "Failed to load transcript" },
      { status: 500 },
    );
  }

  if (!transcriptResult.data) {
    return jsonNoStore({ error: "Transcript not found" }, { status: 404 });
  }

  const extractionResult = await getExtractionForTranscript(
    result.user,
    transcriptResult.data.id,
  );

  if (extractionResult.error) {
    return jsonNoStore(
      { error: "Failed to load stored EHR fields" },
      { status: 500 },
    );
  }

  if (extractionResult.data) {
    return jsonNoStore({
      fields: extractionResult.data.fields,
      generated_at: extractionResult.data.generated_at,
      sessionType: extractionResult.data.session_type,
    });
  }

  if (!aiRealApisEnabled()) {
    return jsonNoStore(
      { error: "EHR field extraction is unavailable" },
      { status: 503 },
    );
  }

  const { key: apiKey, error: apiKeyError } = getAnthropicApiKeyOrError();
  if (apiKeyError || !apiKey) {
    return jsonNoStore(
      { error: apiKeyError ?? "EHR field extraction is unavailable" },
      { status: 503 },
    );
  }

  try {
    const prompt =
      sessionResult.data.session_type === "intake"
        ? CARELOGIC_INTAKE_PROMPT
        : CARELOGIC_SESSION_PROMPT;
    const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
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
      return jsonNoStore(
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
      return jsonNoStore(
        { error: "Claude returned no text content" },
        { status: 502 },
      );
    }

    let fields: Record<string, string>;
    try {
      fields = parseJsonPayload(firstTextBlock.text);
    } catch {
      return jsonNoStore(
        { error: "Anthropic returned invalid JSON for EHR fields" },
        { status: 502 },
      );
    }

    const storedExtraction = await upsertExtraction(result.user, {
      sessionId: jobResult.data.session_id,
      jobId: jobResult.data.id,
      transcriptId: transcriptResult.data.id,
      sessionType: sessionResult.data.session_type,
      fields,
    });

    if (storedExtraction.error || !storedExtraction.data) {
      return jsonNoStore(
        { error: "Failed to store EHR fields" },
        { status: 500 },
      );
    }

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

    return jsonNoStore({
      fields: storedExtraction.data.fields,
      generated_at: storedExtraction.data.generated_at,
      sessionType: sessionResult.data.session_type,
    });
  } catch (error) {
    const detail =
      error instanceof Error
        ? error.message
        : "Failed to generate EHR fields";

    console.error(
      JSON.stringify({
        route: "/api/jobs/[id]/carelogic-fields",
        error: detail,
        job_id: jobResult.data.id,
      }),
    );

    return jsonNoStore(
      {
        error: detail,
      },
      { status: detail.includes("fetch") ? 502 : 500 },
    );
  }
});
