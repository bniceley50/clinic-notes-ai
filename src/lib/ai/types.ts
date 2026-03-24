export type AnthropicTextBlock = {
  type: "text";
  text: string;
};

export type AnthropicResponse = {
  content?: Array<AnthropicTextBlock | { type: string }>;
  error?: {
    message?: string;
  };
};

/**
 * Keep AI error text short and remove anything that looks like prompt content.
 */
export function sanitizeAiError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "AI service error";
  }

  const truncated = error.message.slice(0, 200);
  return truncated.replace(/\bprompt\b[\s\S]*$/i, "[prompt content redacted]");
}
