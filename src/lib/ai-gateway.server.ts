import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export function createAiProvider(
  apiKey: string,
  options?: { structuredOutputs?: boolean },
) {
  return createOpenAICompatible({
    name: "cloud-ai",
    baseURL: process.env["AI_BASE_URL"] ?? "https://api.openai.com/v1",
    supportsStructuredOutputs: options?.structuredOutputs ?? false,
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
}

export function requireAiApiKey(): string {
  const key = process.env["AI_API_KEY"];
  if (!key) throw new Error("AI is not configured yet. Please try again later.");
  return key;
}

export const CHAT_MODEL = process.env["AI_MODEL"] ?? "gpt-4o-mini";
