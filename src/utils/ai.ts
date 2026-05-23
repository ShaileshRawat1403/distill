interface APIKeys {
  openai: string
  anthropic: string
  gemini: string
}

interface ExecutePromptArgs {
  provider: string
  model: string
  prompt: string
  systemPrompt?: string
  apiKeys: APIKeys
}

export async function executePrompt({ provider, model, prompt, systemPrompt, apiKeys }: ExecutePromptArgs): Promise<string> {
  const system = systemPrompt || "You are a helpful cognitive assistant."
  
  if (provider === "ollama") {
    const url = "http://localhost:11434/api/generate"
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        prompt: prompt,
        system: system,
        stream: false,
      }),
    })

    if (!response.ok) {
      throw new Error(`Ollama server error: ${response.statusText}`)
    }

    const data = await response.json()
    return data.response
  }

  if (provider === "openai") {
    if (!apiKeys.openai) {
      throw new Error("OpenAI API key is missing. Add it in the settings panel.")
    }
    const url = "https://api.openai.com/v1/chat/completions"
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKeys.openai}`,
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

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err.error?.message || `OpenAI error: ${response.statusText}`)
    }

    const data = await response.json()
    return data.choices[0].message.content
  }

  if (provider === "gemini") {
    if (!apiKeys.gemini) {
      throw new Error("Gemini API key is missing. Add it in the settings panel.")
    }
    // Mapping standard model IDs to exact API endpoints
    const apiModel = model || "gemini-2.5-flash"
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${apiModel}:generateContent?key=${apiKeys.gemini}`
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ],
        systemInstruction: {
          parts: [{ text: system }]
        },
        generationConfig: {
          temperature: 0.7,
        }
      }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err.error?.message || `Gemini error: ${response.statusText}`)
    }

    const data = await response.json()
    return data.candidates[0].content.parts[0].text
  }

  if (provider === "anthropic") {
    if (!apiKeys.anthropic) {
      throw new Error("Anthropic API key is missing. Add it in the settings panel.")
    }
    // Anthropic API strictly enforces CORS on client-side requests.
    // For direct client-side execution, we will attempt the direct call but handle error with advice.
    const url = "https://api.anthropic.com/v1/messages"
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKeys.anthropic,
          "anthropic-version": "2023-06-01",
          "dangerously-allow-browser": "true", // Custom header for browser environments
        } as any,
        body: JSON.stringify({
          model: model || "claude-3-5-sonnet-latest",
          max_tokens: 4096,
          system: system,
          messages: [
            { role: "user", content: prompt }
          ]
        }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error?.message || `Anthropic error: ${response.statusText}`)
      }

      const data = await response.json()
      return data.content[0].text
    } catch (e: any) {
      if (e.message?.includes("Failed to fetch") || e.name === "TypeError") {
        throw new Error(
          "CORS Policy Blocked direct client call to Anthropic API. " +
          "To use Claude models directly in client-side apps, please run a CORS proxy or use OpenAI/Gemini/Ollama which support direct endpoint connections."
        )
      }
      throw e
    }
  }

  throw new Error(`Unsupported provider: ${provider}`)
}
