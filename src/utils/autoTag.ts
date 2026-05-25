/**
 * Auto-tagger — suggests 2-3 semantic tags for a page using the active AI provider.
 *
 * Design constraints:
 * - Fires in background, never blocks the UI
 * - Skips if no AI provider is connected
 * - Skips if the page content is too short to tag meaningfully
 * - Deduplicates against existing tags (case-insensitive)
 * - Caps at 5 total tags per page
 * - Returns the updated tags array (caller decides whether to persist)
 */

import { executePrompt, type APIKeys } from "./ai"
import { extractKeyphrases, normalizeTags } from "./localTagger"

const SYSTEM_PROMPT = `You are a concise content tagger. Given a document title and content, output 2-3 short semantic tags that describe the main topic, domain, or intent.

Rules:
- Output ONLY a JSON array of strings, e.g. ["product design", "roadmap", "Q3"]
- Each tag: 1-3 words, lowercase, no special characters
- Choose specific, meaningful tags — not generic ones like "document" or "note"
- No trailing text, no explanation, no markdown`

export async function suggestTags(
  title: string,
  content: string,
  existingTags: string[],
  provider: string,
  model: string,
  apiKeys: APIKeys,
  isOllamaOnline: boolean
): Promise<string[]> {
  // Guard: skip if no provider available
  const hasProvider =
    (provider === "ollama" && isOllamaOnline) ||
    (provider === "openai" && !!apiKeys.openai) ||
    (provider === "gemini" && !!apiKeys.gemini) ||
    (provider === "groq" && !!apiKeys.groq) ||
    (provider === "anthropic" && !!apiKeys.anthropic) ||
    provider === "webllm"

  // Guard: too little content to tag
  const text = `${title} ${content}`.trim()
  if (text.length < 40) return existingTags

  // No AI provider? Fall back to the offline extractive tagger so a thought is
  // never left untagged. This is the floor; the LLM path below is the upgrade.
  if (!hasProvider) {
    const local = extractKeyphrases(title, content)
    return normalizeTags([...existingTags, ...local])
  }

  try {
    const raw = await executePrompt({
      provider,
      model,
      apiKeys,
      prompt: `Title: "${title}"\n\nContent (first 600 chars):\n${content.slice(0, 600)}`,
      systemPrompt: SYSTEM_PROMPT,
    })

    // Strip possible markdown fences
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
    const suggested: unknown = JSON.parse(cleaned)

    if (!Array.isArray(suggested)) return existingTags

    const newTags = (suggested as unknown[])
      .filter((t): t is string => typeof t === "string" && t.length > 0 && t.length < 40)
      .map((t) => t.toLowerCase().trim())
      .filter((t) => !existingTags.map((e) => e.toLowerCase()).includes(t))

    // Merge existing + LLM suggestions, then canonicalise the vocabulary.
    return normalizeTags([...existingTags, ...newTags])
  } catch {
    // API/parse failure — degrade to the offline tagger rather than giving up.
    const local = extractKeyphrases(title, content)
    return normalizeTags([...existingTags, ...local])
  }
}
