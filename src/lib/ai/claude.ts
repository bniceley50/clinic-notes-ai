import "server-only";

import {
  aiClaudeTimeoutMs,
  aiRealApisEnabled,
  aiStubApisEnabled,
  anthropicApiKey,
  anthropicModel,
} from "@/lib/config";
import { NOTE_TYPE_PROMPTS } from "@/lib/prompts/note-prompts";

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

export async function generateNote(input: {
  transcript: string;
  noteType: string;
}): Promise<{ content: string | null; error: string | null }> {
  if (aiStubApisEnabled()) {
    return {
      content:
        "SUBJECTIVE:\nClient reports improvement.\n\nOBJECTIVE:\nClient appeared engaged.\n\nASSESSMENT:\nProgress noted.\n\nPLAN:\nContinue current treatment.",
      error: null,
    };
  }

  if (!aiRealApisEnabled()) {
    return { content: null, error: "Real AI APIs are disabled" };
  }

  let apiKey: string;
  try {
    apiKey = anthropicApiKey();
  } catch {
    return { content: null, error: "ANTHROPIC_API_KEY is missing" };
  }

  try {
    const promptKey = input.noteType.toUpperCase();
    const systemPrompt =
      NOTE_TYPE_PROMPTS[promptKey] ??
      NOTE_TYPE_PROMPTS[input.noteType.toLowerCase()] ??
      NOTE_TYPE_PROMPTS.SOAP;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), aiClaudeTimeoutMs());

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: anthropicModel(),
          max_tokens: 1024,
          system: systemPrompt,
          messages: [
            {
              role: "user",
              content: input.transcript,
            },
          ],
        }),
        signal: controller.signal,
      });

      const payload = (await response.json().catch(() => null)) as AnthropicResponse | null;

      if (!response.ok || !payload) {
        return {
          content: null,
          error: payload?.error?.message ?? `Claude request failed (${response.status})`,
        };
      }

      const firstTextBlock = payload.content?.find(
        (block): block is AnthropicTextBlock => block.type === "text",
      );

      if (!firstTextBlock?.text) {
        return { content: null, error: "Claude returned no text content" };
      }

      return { content: firstTextBlock.text, error: null };
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    return {
      content: null,
      error: error instanceof Error ? error.message : "Claude note generation failed",
    };
  }
}
