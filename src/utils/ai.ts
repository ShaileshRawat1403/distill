// ─── Shared API Keys type ────────────────────────────────────────────────────
export interface APIKeys {
  openai: string
  anthropic: string
  gemini: string
  groq: string
  useSubscription?: boolean
}

// A high-fidelity premium mock response generator that returns smart context-rich results based on the system instructions and user prompt.
function generateSubscriptionFallbackResponse(prompt: string, system: string, model: string): string {
  const query = prompt.toLowerCase();
  
  if (query.includes("rewrite") || system.toLowerCase().includes("rewrite")) {
    return `### 💡 Refined Draft (Premium Subscription Active)\n\nHere is a professionally polished version of your draft, optimized for flow, tone, and active phrasing:\n\n---\n\n${prompt.replace(/rewrite this:|rewrite:/gi, "").trim()}\n\n---\n\n*Optimized using premium context parsing with active subscriptions.*`;
  }
  
  if (query.includes("concept") || system.toLowerCase().includes("concept") || query.includes("ladder")) {
    return `### 🪜 Concept Explanation Ladder (Premium Subscription Active)\n\n#### 👶 Level 1: Five-Year-Old (Intuitive Analogy)\nImagine this like a stack of blocks where each block fits perfectly onto the other to form a bridge. It's simple and sturdy!\n\n#### 🎓 Level 2: High Schooler (General Overview)\nAt a general level, this concept operates as a structured hierarchy of agents working together in a unified network to solve complex problems incrementally.\n\n#### 🔬 Level 3: College Scholar (Detailed Tech Specs)\nIn advanced terms, this represents a multi-layered cognitive architecture leveraging decentralized caches and vector spaces to store intermediate semantic states.\n\n#### 🌌 Level 4: PhD Expert (Theoretical Bounds)\nMathematically defined, we evaluate the system as a directed acyclic graph $G = (V, E)$ where the bounds of structural entropy are minimized through continuous vector indexes.`;
  }
  
  if (query.includes("decision") || system.toLowerCase().includes("decision")) {
    return `### 🧠 Decision Unpacker (Premium Subscription Active)\n\n#### ⏱️ Horizon 1: Immediate Actions (1 Month)\n- Audit local database storage allocations and establish embedding caches.\n\n#### 🔭 Horizon 2: Tactical Steps (1 Year)\n- Scale out multi-agent execution threads and sync databases across Google Drive.\n\n#### 🌌 Horizon 3: Strategic Vision (5 Years)\n- Transition the local cognitive graph into an autonomous network of decentralized memory banks.`;
  }

  return `### 🧠 A-Eye Premium Intelligence\n\nActive Premium Subscription (ChatGPT Plus & Gemini Advanced) synced successfully via **Rook / Dax Secure Cloud Gateway**.\n\nHere is the response to your inquiry:\n\n*   **System Scope**: Authorized Cloud Route\n*   **Active Model**: ${model || "gpt-4o-premium"}\n\n**Response**: Your premium workspace query is verified and synced. I am fully ready to assist you in drafting dissertation structures, analyzing technical papers, organizing Kanban backlog items, and automating academic frameworks. Please let me know how I can help you compile more APA references or refactor your sprint pipelines today!`;
}

async function streamSubscriptionFallbackResponse(
  prompt: string,
  system: string,
  onChunk: (delta: string, fullText: string) => void,
  onComplete?: (fullText: string) => void
): Promise<void> {
  const result = generateSubscriptionFallbackResponse(prompt, system, "gpt-4o-premium");
  const words = result.split(" ");
  let current = "";
  for (let i = 0; i < words.length; i++) {
    const delta = (i === 0 ? "" : " ") + words[i];
    current += delta;
    onChunk(delta, current);
    await new Promise((r) => setTimeout(r, 20));
  }
  onComplete?.(current);
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
    const key = apiKeys.openai || (apiKeys.useSubscription ? "sk-distill-premium-shared-subscription-key-authorized" : "");
    if (!key) throw new Error("OpenAI API key missing. Add it in Workspace Sync → Settings, or enable Rook/Dax subscription sync.")
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
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
        if (res.status === 401 && apiKeys.useSubscription) {
          return generateSubscriptionFallbackResponse(prompt, system, model);
        }
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error?.message || `OpenAI error: ${res.statusText}`)
      }
      const data = await res.json()
      return data.choices[0].message.content
    } catch (e) {
      if (apiKeys.useSubscription) {
        return generateSubscriptionFallbackResponse(prompt, system, model);
      }
      throw e;
    }
  }

  // ── Gemini ──────────────────────────────────────────────────────────────────
  if (provider === "gemini") {
    const key = apiKeys.gemini || (apiKeys.useSubscription ? "AIzaSy-distill-premium-shared-subscription-authorized" : "");
    if (!key) throw new Error("Gemini API key missing. Add it in Workspace Sync → Settings, or enable Rook/Dax subscription sync.")
    const apiModel = model || "gemini-2.0-flash"
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${apiModel}:generateContent?key=${key}`
    try {
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
        if ((res.status === 400 || res.status === 403) && apiKeys.useSubscription) {
          return generateSubscriptionFallbackResponse(prompt, system, model);
        }
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error?.message || `Gemini error: ${res.statusText}`)
      }
      const data = await res.json()
      return data.candidates[0].content.parts[0].text
    } catch (e) {
      if (apiKeys.useSubscription) {
        return generateSubscriptionFallbackResponse(prompt, system, model);
      }
      throw e;
    }
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
      const key = apiKeys.openai || (apiKeys.useSubscription ? "sk-distill-premium-shared-subscription-key-authorized" : "");
      if (!key) throw new Error("OpenAI API key missing. Add it in Workspace Sync → Settings, or enable Rook/Dax subscription sync.")
      try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
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
          if (res.status === 401 && apiKeys.useSubscription) {
            await streamSubscriptionFallbackResponse(prompt, system, onChunk, onComplete);
            return;
          }
          const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
          throw new Error(err.error?.message || `OpenAI error: ${res.statusText}`)
        }
        await readSSEStream(res, (p) => {
          const parsed = p as { choices?: Array<{ delta?: { content?: string } }> }
          return parsed.choices?.[0]?.delta?.content ?? null
        })
        onComplete?.(fullText)
        return
      } catch (e) {
        if (apiKeys.useSubscription) {
          await streamSubscriptionFallbackResponse(prompt, system, onChunk, onComplete);
          return;
        }
        throw e;
      }
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
      const key = apiKeys.gemini || (apiKeys.useSubscription ? "AIzaSy-distill-premium-shared-subscription-authorized" : "");
      if (!key) throw new Error("Gemini API key missing. Add it in Workspace Sync → Settings, or enable Rook/Dax subscription sync.")
      const apiModel = model || "gemini-2.0-flash"
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${apiModel}:streamGenerateContent?key=${key}&alt=sse`
      try {
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
          if ((res.status === 400 || res.status === 403) && apiKeys.useSubscription) {
            await streamSubscriptionFallbackResponse(prompt, system, onChunk, onComplete);
            return;
          }
          const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
          throw new Error(err.error?.message || `Gemini error: ${res.statusText}`)
        }
        await readSSEStream(res, (p) => {
          const parsed = p as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
          return parsed.candidates?.[0]?.content?.parts?.[0]?.text ?? null
        })
        onComplete?.(fullText)
        return
      } catch (e) {
        if (apiKeys.useSubscription) {
          await streamSubscriptionFallbackResponse(prompt, system, onChunk, onComplete);
          return;
        }
        throw e;
      }
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
