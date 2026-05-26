import { daxPrompt } from "./daxBridge"

// ─── Shared API Keys type ────────────────────────────────────────────────────
export interface APIKeys {
  openai: string
  anthropic: string
  gemini: string
  groq: string
  /** When true, the "dax" provider routes through the local DAX/Rook bridge. */
  useSubscription?: boolean
  /** Base URL of the local dax/rook server (e.g. http://127.0.0.1:4096). */
  daxUrl?: string
  /** Optional DAX_SERVER_PASSWORD for the bridge. */
  daxPassword?: string
}

/**
 * Route a prompt through the local DAX/Rook bridge. `model` is encoded as
 * "providerID/modelID" (e.g. "openai/gpt-5.2", "google/gemini-flash-latest").
 */
async function executeDax(model: string, prompt: string, system: string, apiKeys: APIKeys): Promise<string> {
  const url = apiKeys.daxUrl
  if (!url) throw new Error("DAX/Rook bridge not configured. Set the server URL in Workspace Sync → Subscription.")
  const [providerID, ...rest] = model.split("/")
  const modelID = rest.join("/")
  if (!providerID || !modelID) throw new Error(`Pick a DAX model first (got "${model}").`)
  const { text } = await daxPrompt({
    cfg: { url, password: apiKeys.daxPassword },
    providerID,
    modelID,
    prompt,
    system,
  })
  return text
}

// ─── Execute (single-shot, returns full string) ───────────────────────────────
interface ExecutePromptArgs {
  provider: string
  model: string
  prompt: string
  systemPrompt?: string
  apiKeys: APIKeys
}

export async function executePrompt({
  provider,
  model,
  prompt,
  systemPrompt,
  apiKeys,
}: ExecutePromptArgs): Promise<string> {
  const system = systemPrompt || "You are a helpful cognitive assistant."

  // ── DAX / Rook bridge (real ChatGPT/Gemini/Claude subscription auth) ────────
  if (provider === "dax") {
    return executeDax(model, prompt, system, apiKeys)
  }

  // ── Ollama (local) ──────────────────────────────────────────────────────────
  if (provider === "ollama") {
    const res = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, system, stream: false }),
    })
    if (!res.ok) throw new Error(`Ollama error: ${res.statusText}`)
    const data = await res.json()
    return data.response
  }

  // ── OpenAI ──────────────────────────────────────────────────────────────────
  if (provider === "openai") {
    if (!apiKeys.openai) throw new Error("OpenAI API key missing. Add it in Workspace Sync → Settings, or use the DAX/Rook bridge for subscription access.")
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKeys.openai}`,
      },
      body: JSON.stringify({
        model: model || "gpt-4o-mini",
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error?.message || `OpenAI error: ${res.statusText}`)
    }
    const data = await res.json()
    return data.choices[0].message.content
  }

  // ── Gemini ──────────────────────────────────────────────────────────────────
  if (provider === "gemini") {
    if (!apiKeys.gemini) throw new Error("Gemini API key missing. Add it in Workspace Sync → Settings, or use the DAX/Rook bridge for subscription access.")
    const apiModel = model || "gemini-2.0-flash"
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${apiModel}:generateContent?key=${apiKeys.gemini}`
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: system }] },
        generationConfig: { temperature: 0.7 },
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error?.message || `Gemini error: ${res.statusText}`)
    }
    const data = await res.json()
    return data.candidates[0].content.parts[0].text
  }

  // ── Groq (OpenAI-compatible, open models, fast inference) ───────────────────
  if (provider === "groq") {
    if (!apiKeys.groq) throw new Error("Groq API key missing. Add it in Workspace Sync → Settings.")
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKeys.groq}`,
      },
      body: JSON.stringify({
        model: model || "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error?.message || `Groq error: ${res.statusText}`)
    }
    const data = await res.json()
    return data.choices[0].message.content
  }

  // ── Anthropic (browser CORS limited — surfaced gracefully) ──────────────────
  if (provider === "anthropic") {
    if (!apiKeys.anthropic) throw new Error("Anthropic API key missing. Add it in Workspace Sync → Settings.")
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKeys.anthropic,
          "anthropic-version": "2023-06-01",
          "dangerously-allow-browser": "true",
        } as Record<string, string>,
        body: JSON.stringify({
          model: model || "claude-3-5-sonnet-latest",
          max_tokens: 4096,
          system,
          messages: [{ role: "user", content: prompt }],
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error?.message || `Anthropic error: ${res.statusText}`)
      }
      const data = await res.json()
      return data.content[0].text
    } catch (e: unknown) {
      const err = e as Error
      if (err.message?.includes("Failed to fetch") || err.name === "TypeError") {
        throw new Error(
          "Anthropic CORS policy blocks direct browser calls. Switch to Ollama, OpenAI, Gemini, or Groq for browser use — or route via a backend proxy."
        )
      }
      throw e
    }
  }

  // ── WebLLM (browser-native, WebGPU, no API key needed) ─────────────────────
  if (provider === "webllm") {
    const { webllmGenerate } = await import("./webllm")
    return webllmGenerate(prompt, system)
  }

  throw new Error(`Unsupported provider: "${provider}"`)
}

// ─── Stream (real-time token-by-token, calls onChunk as chunks arrive) ────────
interface StreamPromptArgs extends ExecutePromptArgs {
  onChunk: (delta: string, fullText: string) => void
  onComplete?: (fullText: string) => void
  onError?: (message: string) => void
}

export async function streamPrompt({
  provider,
  model,
  prompt,
  systemPrompt,
  apiKeys,
  onChunk,
  onComplete,
  onError,
}: StreamPromptArgs): Promise<void> {
  const system = systemPrompt || "You are a helpful cognitive assistant."
  let fullText = ""

  const readSSEStream = async (
    res: Response,
    extractDelta: (parsed: unknown) => string | null
  ) => {
    const reader = res.body?.getReader()
    if (!reader) throw new Error("No response body from server.")
    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const lines = decoder.decode(value, { stream: true }).split("\n")
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue
        const raw = line.slice(6)
        if (raw === "[DONE]") continue
        try {
          const parsed = JSON.parse(raw)
          const delta = extractDelta(parsed)
          if (delta) {
            fullText += delta
            onChunk(delta, fullText)
          }
        } catch {
          /* partial JSON chunk — safe to ignore */
        }
      }
    }
  }

  try {
    // ── DAX / Rook bridge (non-streamed; emit the full reply at once) ─────────
    if (provider === "dax") {
      const text = await executeDax(model, prompt, system, apiKeys)
      fullText = text
      onChunk(text, fullText)
      onComplete?.(fullText)
      return
    }

    // ── Ollama (NDJSON stream) ────────────────────────────────────────────────
    if (provider === "ollama") {
      const res = await fetch("http://localhost:11434/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt, system, stream: true }),
      })
      if (!res.ok) throw new Error(`Ollama error: ${res.statusText}`)
      const reader = res.body?.getReader()
      if (!reader) throw new Error("No response body from Ollama.")
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const lines = decoder.decode(value, { stream: true }).split("\n").filter(Boolean)
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line) as { response?: string }
            if (parsed.response) {
              fullText += parsed.response
              onChunk(parsed.response, fullText)
            }
          } catch {
            /* partial NDJSON line */
          }
        }
      }
      onComplete?.(fullText)
      return
    }

    // ── OpenAI SSE ───────────────────────────────────────────────────────────
    if (provider === "openai") {
      if (!apiKeys.openai) throw new Error("OpenAI API key missing. Add it in Workspace Sync → Settings, or use the DAX/Rook bridge for subscription access.")
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKeys.openai}`,
        },
        body: JSON.stringify({
          model: model || "gpt-4o-mini",
          messages: [
            { role: "system", content: system },
            { role: "user", content: prompt },
          ],
          temperature: 0.7,
          stream: true,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
        throw new Error(err.error?.message || `OpenAI error: ${res.statusText}`)
      }
      await readSSEStream(res, (p) => {
        const parsed = p as { choices?: Array<{ delta?: { content?: string } }> }
        return parsed.choices?.[0]?.delta?.content ?? null
      })
      onComplete?.(fullText)
      return
    }

    // ── Groq SSE (OpenAI-compatible) ─────────────────────────────────────────
    if (provider === "groq") {
      if (!apiKeys.groq) throw new Error("Groq API key missing.")
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKeys.groq}`,
        },
        body: JSON.stringify({
          model: model || "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: system },
            { role: "user", content: prompt },
          ],
          temperature: 0.7,
          stream: true,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
        throw new Error(err.error?.message || `Groq error: ${res.statusText}`)
      }
      await readSSEStream(res, (p) => {
        const parsed = p as { choices?: Array<{ delta?: { content?: string } }> }
        return parsed.choices?.[0]?.delta?.content ?? null
      })
      onComplete?.(fullText)
      return
    }

    // ── Gemini SSE ───────────────────────────────────────────────────────────
    if (provider === "gemini") {
      if (!apiKeys.gemini) throw new Error("Gemini API key missing. Add it in Workspace Sync → Settings, or use the DAX/Rook bridge for subscription access.")
      const apiModel = model || "gemini-2.0-flash"
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${apiModel}:streamGenerateContent?key=${apiKeys.gemini}&alt=sse`
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          systemInstruction: { parts: [{ text: system }] },
          generationConfig: { temperature: 0.7 },
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
        throw new Error(err.error?.message || `Gemini error: ${res.statusText}`)
      }
      await readSSEStream(res, (p) => {
        const parsed = p as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
        return parsed.candidates?.[0]?.content?.parts?.[0]?.text ?? null
      })
      onComplete?.(fullText)
      return
    }

    // ── WebLLM: native streaming via WebGPU ──────────────────────────────────
    if (provider === "webllm") {
      const { webllmStream } = await import("./webllm")
      await webllmStream(prompt, system, onChunk, onComplete, onError)
      return
    }

    // ── Anthropic: no browser streaming — fall back to full executePrompt ─────
    if (provider === "anthropic") {
      const result = await executePrompt({ provider, model, prompt, systemPrompt: system, apiKeys })
      // Word-by-word trickle to keep the streaming UX consistent
      const words = result.split(" ")
      for (let i = 0; i < words.length; i++) {
        const delta = (i === 0 ? "" : " ") + words[i]
        fullText += delta
        onChunk(delta, fullText)
        await new Promise((r) => setTimeout(r, 18))
      }
      onComplete?.(fullText)
      return
    }

    throw new Error(`Unsupported provider: "${provider}"`)
  } catch (e: unknown) {
    const err = e as Error
    onError?.(err.message || "Stream failed")
  }
}
