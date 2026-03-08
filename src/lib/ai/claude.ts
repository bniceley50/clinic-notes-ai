import "server-only";

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
  if (process.env.AI_ENABLE_STUB_APIS === "1") {
    return {
      content:
        "SUBJECTIVE:\nClient reports improvement.\n\nOBJECTIVE:\nClient appeared engaged.\n\nASSESSMENT:\nProgress noted.\n\nPLAN:\nContinue current treatment.",
      error: null,
    };
  }

  if (process.env.AI_ENABLE_REAL_APIS !== "1") {
    return { content: null, error: "Real AI APIs are disabled" };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return { content: null, error: "ANTHROPIC_API_KEY is missing" };
  }

  try {
    const promptKey = input.noteType.toUpperCase();
    const systemPrompt =
      NOTE_TYPE_PROMPTS[promptKey] ??
      NOTE_TYPE_PROMPTS[input.noteType.toLowerCase()] ??
      NOTE_TYPE_PROMPTS.SOAP;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: input.transcript,
          },
        ],
      }),
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
  } catch (error) {
    return {
      content: null,
      error: error instanceof Error ? error.message : "Claude note generation failed",
    };
  }
}
