/**
 * WebLLMManager — UI for loading and managing browser-native LLM models.
 * Shows download progress, GPU memory requirements, and model status.
 * Rendered in the Settings panel alongside OllamaManager.
 */

import { useState, useEffect } from "react"
import { Cpu, Download, CheckCircle2, AlertTriangle, X, Zap } from "lucide-react"
import {
  WEBLLM_MODELS,
  loadModel,
  unloadModel,
  onWebLLMStatus,
  getWebLLMStatus,
  getLoadedModel,
  isWebGPUSupported,
  type WebLLMStatus,
} from "../utils/webllm"

interface WebLLMManagerProps {
  onModelReady: (modelId: string) => void
  onModelUnloaded: () => void
}

export default function WebLLMManager({ onModelReady, onModelUnloaded }: WebLLMManagerProps) {
  const [status, setStatus] = useState<WebLLMStatus>(getWebLLMStatus)
  const [progress, setProgress] = useState(0)
  const [progressText, setProgressText] = useState("")
  const [loadedModel, setLoadedModel] = useState<string | null>(getLoadedModel)
  const [selectedModel, setSelectedModel] = useState(WEBLLM_MODELS[0].id)
  const [error, setError] = useState<string | null>(null)
  const gpuSupported = isWebGPUSupported()

  useEffect(() => {
    const unsub = onWebLLMStatus((s, pct, text) => {
      setStatus(s)
      if (pct !== undefined) setProgress(pct)
      if (text) setProgressText(text)
      if (s === "ready") {
        const m = getLoadedModel()
        setLoadedModel(m)
        if (m) onModelReady(m)
      }
      if (s === "idle") {
        setLoadedModel(null)
        onModelUnloaded()
      }
    })
    return unsub
  }, [onModelReady, onModelUnloaded])

  const handleLoad = async () => {
    setError(null)
    try {
      await loadModel(selectedModel)
    } catch (e: unknown) {
      setError((e as Error).message || "Failed to load model")
      setStatus("error")
    }
  }

  const handleUnload = async () => {
    await unloadModel()
  }

  const modelInfo = WEBLLM_MODELS.find((m) => m.id === selectedModel)

  return (
    <div className="glass-card" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", borderBottom: "1px solid var(--border-muted)", paddingBottom: "12px" }}>
        <Cpu size={18} style={{ color: "var(--accent-secondary)" }} />
        <h3 style={{ fontSize: "15px", fontWeight: "700", fontFamily: "var(--font-display)" }}>
          WebLLM — Browser-Native Models
        </h3>
      </div>

      {!gpuSupported && (
        <div style={{ display: "flex", gap: "8px", padding: "10px 12px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "8px", fontSize: "12px", color: "var(--accent-danger)" }}>
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: "1px" }} />
          <span>WebGPU not available in this browser. Chrome 113+ or Edge 113+ required. Firefox and Safari do not yet support WebGPU.</span>
        </div>
      )}

      <p style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.6" }}>
        Run small language models directly in your browser — no server, no API key, no Ollama required. Models are downloaded once and cached locally via OPFS.
      </p>

      {/* Model selector */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <label style={{ fontSize: "11px", color: "var(--text-secondary)", fontWeight: "700", fontFamily: "var(--font-mono)" }}>
          SELECT MODEL
        </label>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {WEBLLM_MODELS.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelectedModel(m.id)}
              disabled={status === "loading" || status === "generating"}
              style={{
                padding: "10px 12px",
                borderRadius: "8px",
                border: selectedModel === m.id ? "1px solid var(--accent-secondary)" : "1px solid var(--border-muted)",
                background: selectedModel === m.id ? "rgba(99,102,241,0.08)" : "rgba(255,255,255,0.02)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                cursor: "pointer", textAlign: "left",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {loadedModel === m.id && (
                  <CheckCircle2 size={12} style={{ color: "var(--accent-success)", flexShrink: 0 }} />
                )}
                <span style={{ fontSize: "12.5px", color: "var(--text-primary)", fontWeight: selectedModel === m.id ? "600" : "400" }}>
                  {m.label}
                </span>
              </div>
              <span style={{ fontSize: "10px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                {m.sizeGb} GB
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Load progress */}
      {(status === "loading") && (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", fontFamily: "var(--font-mono)" }}>
            <span style={{ color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "80%" }}>
              {progressText || "Loading…"}
            </span>
            <span style={{ color: "var(--accent-secondary)", flexShrink: 0 }}>{progress}%</span>
          </div>
          <div style={{ height: "4px", background: "rgba(255,255,255,0.05)", borderRadius: "2px", overflow: "hidden" }}>
            <div style={{ width: `${progress}%`, height: "100%", background: "var(--accent-secondary)", transition: "width 0.3s ease" }} />
          </div>
        </div>
      )}

      {/* Loaded model badge */}
      {status === "ready" && loadedModel && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Zap size={13} style={{ color: "var(--accent-success)" }} />
            <span style={{ fontSize: "12px", color: "var(--accent-success)", fontWeight: "700" }}>
              {WEBLLM_MODELS.find((m) => m.id === loadedModel)?.label ?? loadedModel} — READY
            </span>
          </div>
          <button
            onClick={handleUnload}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", alignItems: "center" }}
            title="Unload model (free GPU memory)"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ display: "flex", gap: "8px", padding: "10px 12px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "8px", fontSize: "12px", color: "var(--accent-danger)" }}>
          <AlertTriangle size={13} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: "10px" }}>
        <button
          onClick={handleLoad}
          disabled={!gpuSupported || status === "loading" || status === "generating" || (status === "ready" && loadedModel === selectedModel)}
          className="btn-premium"
          style={{ flex: 1, padding: "10px", fontSize: "12.5px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
        >
          <Download size={13} />
          {status === "loading"
            ? `Loading… ${progress}%`
            : loadedModel === selectedModel
              ? "Already Loaded"
              : `Load ${modelInfo?.label ?? selectedModel}`
          }
        </button>
      </div>

      <p style={{ fontSize: "10.5px", color: "var(--text-muted)", lineHeight: "1.5" }}>
        First load downloads the model (~{modelInfo?.sizeGb} GB). Cached in browser OPFS. Subsequent loads are instant. Requires a dedicated GPU with 4+ GB VRAM for smooth inference.
      </p>
    </div>
  )
}
