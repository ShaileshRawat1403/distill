/**
 * WebLLM — runs LLMs directly in the browser via WebGPU / WASM.
 * No Ollama, no server, no API key required.
 *
 * Models are downloaded once and cached in OPFS (Origin Private File System).
 * Subsequent loads are instant.
 *
 * Supported models (small enough for most consumer GPUs):
 *   - Phi-3.5-mini-instruct-q4f16_1-MLC   (~2.4 GB)
 *   - Llama-3.2-3B-Instruct-q4f16_1-MLC   (~1.9 GB)
 *   - gemma-2-2b-it-q4f16_1-MLC           (~1.5 GB)
 *   - Qwen2.5-1.5B-Instruct-q4f16_1-MLC   (~1.0 GB)
 */

import type { MLCEngine, InitProgressReport } from "@mlc-ai/web-llm"

export type WebLLMStatus = "idle" | "loading" | "ready" | "generating" | "error"

export interface WebLLMModel {
  id: string
  label: string
  sizeGb: number
}

export const WEBLLM_MODELS: WebLLMModel[] = [
  { id: "Phi-3.5-mini-instruct-q4f16_1-MLC",  label: "Phi-3.5 Mini (2.4 GB)",   sizeGb: 2.4 },
  { id: "Llama-3.2-3B-Instruct-q4f16_1-MLC",  label: "Llama 3.2 3B (1.9 GB)",   sizeGb: 1.9 },
  { id: "gemma-2-2b-it-q4f16_1-MLC",          label: "Gemma 2 2B (1.5 GB)",     sizeGb: 1.5 },
  { id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",  label: "Qwen 2.5 1.5B (1.0 GB)", sizeGb: 1.0 },
]

// Singleton engine instance
let engine: MLCEngine | null = null
let currentModelId: string | null = null
let engineStatus: WebLLMStatus = "idle"

type StatusListener = (status: WebLLMStatus, progress?: number, text?: string) => void
const listeners: StatusListener[] = []

export function onWebLLMStatus(cb: StatusListener) {
  listeners.push(cb)
  return () => {
    const idx = listeners.indexOf(cb)
    if (idx !== -1) listeners.splice(idx, 1)
  }
}

function notify(status: WebLLMStatus, progress?: number, text?: string) {
  engineStatus = status
  listeners.forEach((cb) => cb(status, progress, text))
}

export function getWebLLMStatus(): WebLLMStatus {
  return engineStatus
}

export function getLoadedModel(): string | null {
  return currentModelId
}

/** Check if WebGPU is available in this browser */
export function isWebGPUSupported(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator
}

// ─── Load (or switch) model ───────────────────────────────────────────────────
export async function loadModel(modelId: string): Promise<void> {
  if (currentModelId === modelId && engineStatus === "ready") return

  notify("loading", 0, "Initialising WebLLM engine…")

  const { CreateMLCEngine } = await import("@mlc-ai/web-llm")

  engine = await CreateMLCEngine(modelId, {
    initProgressCallback: (report: InitProgressReport) => {
      const pct = Math.round((report.progress ?? 0) * 100)
      notify("loading", pct, report.text ?? "Loading…")
    },
  })

  currentModelId = modelId
  notify("ready", 100, "Model ready")
}

// ─── Generate (single-shot) ───────────────────────────────────────────────────
export async function webllmGenerate(
  prompt: string,
  systemPrompt?: string
): Promise<string> {
  if (!engine || engineStatus !== "ready") {
    throw new Error("WebLLM engine not loaded. Load a model first.")
  }

  notify("generating")

  const messages: { role: "system" | "user"; content: string }[] = []
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt })
  messages.push({ role: "user", content: prompt })

  const reply = await engine.chat.completions.create({
    messages,
    temperature: 0.7,
    max_tokens: 1024,
  })

  notify("ready")
  return reply.choices[0].message.content ?? ""
}

// ─── Stream (token by token) ──────────────────────────────────────────────────
export async function webllmStream(
  prompt: string,
  systemPrompt: string | undefined,
  onChunk: (delta: string, fullText: string) => void,
  onComplete?: (fullText: string) => void,
  onError?: (msg: string) => void
): Promise<void> {
  if (!engine || engineStatus !== "ready") {
    onError?.("WebLLM engine not loaded. Load a model first.")
    return
  }

  notify("generating")

  const messages: { role: "system" | "user"; content: string }[] = []
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt })
  messages.push({ role: "user", content: prompt })

  try {
    let fullText = ""
    const stream = await engine.chat.completions.create({
      messages,
      temperature: 0.7,
      max_tokens: 1024,
      stream: true,
    })

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? ""
      if (delta) {
        fullText += delta
        onChunk(delta, fullText)
      }
    }

    notify("ready")
    onComplete?.(fullText)
  } catch (e: unknown) {
    notify("ready")
    onError?.((e as Error).message || "WebLLM stream failed")
  }
}

/** Unload engine to free GPU memory */
export async function unloadModel(): Promise<void> {
  if (engine) {
    await engine.unload()
    engine = null
    currentModelId = null
    notify("idle")
  }
}
