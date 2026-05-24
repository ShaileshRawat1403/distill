import { useState, useRef } from "react"
import { Sparkles, Zap, FileText, CheckCircle2, Pin, BarChart2, AlertCircle, XCircle } from "lucide-react"
import { Page } from "../App"
import { streamPrompt, APIKeys } from "../utils/ai"

interface CognitiveArenaProps {
  pages: Page[]
  provider: string
  model: string
  apiKeys: APIKeys
  isOllamaOnline: boolean
  ollamaModels: string[]
  logSystemMessage: (tag: "SYSTEM" | "DATABASE" | "OLLAMA" | "ERROR", message: string) => void
}

interface PerformanceMetric {
  latencyMs: number
  tokensPerSec: number
  tokenCount: number
  overallScore: number
}

// Per-engine config: provider key + display model label
interface EngineConfig {
  provider: string
  model: string
}

const PROVIDER_OPTIONS = [
  { key: "ollama",    label: "Local Ollama",     modelLabel: "local model"         },
  { key: "openai",    label: "OpenAI",            modelLabel: "gpt-4o-mini"         },
  { key: "gemini",    label: "Gemini",            modelLabel: "gemini-2.0-flash"    },
  { key: "groq",      label: "Groq",              modelLabel: "llama-3.3-70b-versatile" },
  { key: "anthropic", label: "Anthropic",         modelLabel: "claude-3-5-sonnet"   },
]

function buildKnowledgeContext(pages: Page[], pinnedIds: string[]): string {
  if (!pinnedIds.length) return ""
  return pinnedIds.map((id) => {
    const p = pages.find((page) => page.id === id)
    if (!p) return null
    const preview = p.content.substring(0, 1500) + (p.content.length > 1500 ? "\n…[truncated]" : "")
    return `--- "${p.title}" [${p.type.toUpperCase()}] ---\n${preview}`
  }).filter(Boolean).join("\n\n")
}

export default function CognitiveArena({
  pages,
  provider,
  model,
  apiKeys,
  isOllamaOnline,
  ollamaModels,
  logSystemMessage
}: CognitiveArenaProps) {
  const [prompt, setPrompt] = useState("")

  // Each engine now tracks provider + model separately
  const [engineA, setEngineA] = useState<EngineConfig>({ provider: "ollama", model: ollamaModels[0] || "" })
  const [engineB, setEngineB] = useState<EngineConfig>({ provider: "openai",  model: "gpt-4o-mini" })

  const [streamA, setStreamA] = useState("")
  const [streamB, setStreamB] = useState("")
  const [errorA, setErrorA] = useState<string | null>(null)
  const [errorB, setErrorB] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)

  const [metricsA, setMetricsA] = useState<PerformanceMetric | null>(null)
  const [metricsB, setMetricsB] = useState<PerformanceMetric | null>(null)

  const [pinnedPages, setPinnedPages] = useState<string[]>([])

  // Ref flags for tracking which streams are still live
  const doneA = useRef(false)
  const doneB = useRef(false)

  const togglePin = (pageId: string) => {
    setPinnedPages(prev =>
      prev.includes(pageId) ? prev.filter(id => id !== pageId) : [...prev, pageId]
    )
    logSystemMessage("SYSTEM", `Toggled arena context pin for page "${pageId}"`)
  }

  const handleInitiateArena = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim() || isStreaming) return

    const textPrompt = prompt.trim()
    const knowledgeContext = buildKnowledgeContext(pages, pinnedPages)

    const systemPrompt = knowledgeContext
      ? `You are a precise analytical engine. Answer concisely and accurately.\n\nThe user has provided the following knowledge context:\n\n${knowledgeContext}`
      : "You are a precise analytical engine. Answer concisely and accurately."

    // Reset all state
    setStreamA("")
    setStreamB("")
    setErrorA(null)
    setErrorB(null)
    setMetricsA(null)
    setMetricsB(null)
    setIsStreaming(true)
    doneA.current = false
    doneB.current = false

    logSystemMessage(
      "SYSTEM",
      `Arena: firing parallel streams — A: ${engineA.provider.toUpperCase()} / B: ${engineB.provider.toUpperCase()} — context pages: ${pinnedPages.length}`
    )

    const checkBothDone = () => {
      if (doneA.current && doneB.current) {
        setIsStreaming(false)
        logSystemMessage("SYSTEM", "Arena: both streams completed")
      }
    }

    // ── Engine A ──────────────────────────────────────────────────────────────
    const startA = performance.now()
    let tokenCountA = 0

    streamPrompt({
      provider: engineA.provider,
      model: engineA.model,
      prompt: textPrompt,
      systemPrompt,
      apiKeys,
      onChunk: (delta, fullText) => {
        setStreamA(fullText)
        tokenCountA += delta.split(/\s+/).filter(Boolean).length
      },
      onComplete: (fullText) => {
        const latency = Math.round(performance.now() - startA)
        const tokensPerSec = latency > 0 ? Math.round((tokenCountA / latency) * 1000) : 0
        setMetricsA({
          latencyMs: latency,
          tokensPerSec,
          tokenCount: tokenCountA,
          overallScore: Math.round(tokensPerSec * 0.8 + (10000 / Math.max(latency, 1))),
        })
        logSystemMessage("OLLAMA", `Arena A (${engineA.provider}): ${fullText.length} chars in ${latency}ms`)
        doneA.current = true
        checkBothDone()
      },
      onError: (msg) => {
        setErrorA(msg)
        logSystemMessage("ERROR", `Arena A (${engineA.provider}) error: ${msg}`)
        doneA.current = true
        checkBothDone()
      },
    })

    // ── Engine B ──────────────────────────────────────────────────────────────
    const startB = performance.now()
    let tokenCountB = 0

    streamPrompt({
      provider: engineB.provider,
      model: engineB.model,
      prompt: textPrompt,
      systemPrompt,
      apiKeys,
      onChunk: (delta, fullText) => {
        setStreamB(fullText)
        tokenCountB += delta.split(/\s+/).filter(Boolean).length
      },
      onComplete: (fullText) => {
        const latency = Math.round(performance.now() - startB)
        const tokensPerSec = latency > 0 ? Math.round((tokenCountB / latency) * 1000) : 0
        setMetricsB({
          latencyMs: latency,
          tokensPerSec,
          tokenCount: tokenCountB,
          overallScore: Math.round(tokensPerSec * 0.85 + (12000 / Math.max(latency, 1))),
        })
        logSystemMessage("OLLAMA", `Arena B (${engineB.provider}): ${fullText.length} chars in ${latency}ms`)
        doneB.current = true
        checkBothDone()
      },
      onError: (msg) => {
        setErrorB(msg)
        logSystemMessage("ERROR", `Arena B (${engineB.provider}) error: ${msg}`)
        doneB.current = true
        checkBothDone()
      },
    })
  }

  const fasterModel = (() => {
    if (!metricsA || !metricsB) return null
    return metricsA.latencyMs <= metricsB.latencyMs ? "A" : "B"
  })()

  const EngineSelector = ({
    label,
    value,
    onChange,
    disabled,
  }: {
    label: string
    value: EngineConfig
    onChange: (cfg: EngineConfig) => void
    disabled: boolean
  }) => {
    const selected = PROVIDER_OPTIONS.find(o => o.key === value.provider)
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600", fontFamily: "var(--font-mono)" }}>
          {label}:
        </span>
        <select
          value={value.provider}
          onChange={(e) => {
            const opt = PROVIDER_OPTIONS.find(o => o.key === e.target.value)!
            onChange({ provider: opt.key, model: opt.key === "ollama" ? (ollamaModels[0] || "") : opt.modelLabel })
          }}
          className="input-premium"
          disabled={disabled}
          style={{ width: "140px", padding: "6px 10px", fontSize: "11.5px" }}
        >
          {PROVIDER_OPTIONS.map(opt => (
            <option key={opt.key} value={opt.key}>{opt.label}</option>
          ))}
        </select>

        {/* Ollama sub-model picker */}
        {value.provider === "ollama" && ollamaModels.length > 1 && (
          <select
            value={value.model}
            onChange={(e) => onChange({ ...value, model: e.target.value })}
            className="input-premium"
            disabled={disabled}
            style={{ width: "130px", padding: "6px 10px", fontSize: "11px" }}
          >
            {ollamaModels.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        )}

        {value.provider !== "ollama" && (
          <span style={{ fontSize: "10.5px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            {selected?.modelLabel}
          </span>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: "24px", height: "calc(100vh - 120px)", overflow: "hidden" }}>

      {/* LEFT COLUMN */}
      <div style={{ display: "flex", flexDirection: "column", gap: "20px", height: "100%", overflow: "hidden" }}>

        {/* Cockpit Prompt Input */}
        <div className="glass-card" style={{ padding: "20px" }}>
          <form onSubmit={handleInitiateArena} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Zap size={18} style={{ color: "var(--accent-warning)" }} />
              <h3 style={{ fontSize: "15px", fontWeight: "700", fontFamily: "var(--font-display)" }}>
                AI Cognitive Arena
              </h3>
              {pinnedPages.length > 0 && (
                <span style={{
                  fontSize: "10px", fontFamily: "var(--font-mono)", fontWeight: "600",
                  color: "var(--accent-secondary)",
                  background: "rgba(99, 102, 241, 0.1)",
                  padding: "2px 8px", borderRadius: "10px",
                  border: "1px solid rgba(99, 102, 241, 0.25)"
                }}>
                  {pinnedPages.length} context page{pinnedPages.length !== 1 ? "s" : ""} pinned
                </span>
              )}
            </div>

            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter a prompt to fire both engines in parallel and compare live responses..."
              className="input-premium"
              disabled={isStreaming}
              style={{ height: "70px", resize: "none", fontSize: "13px" }}
            />

            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
              <EngineSelector label="ENGINE A" value={engineA} onChange={setEngineA} disabled={isStreaming} />
              <EngineSelector label="ENGINE B" value={engineB} onChange={setEngineB} disabled={isStreaming} />

              <button
                type="submit"
                disabled={isStreaming || !prompt.trim()}
                className="btn-premium"
                style={{ padding: "8px 16px", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <Sparkles size={13} />
                <span>{isStreaming ? "Streaming…" : "Initiate Arena"}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Side-by-Side Viewports */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", flex: 1, overflow: "hidden" }}>

          {/* VIEWPORT A */}
          <div className="glass-card" style={{ display: "flex", flexDirection: "column", height: "100%", padding: "20px", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border-muted)", paddingBottom: "10px", marginBottom: "14px" }}>
              <span style={{ fontSize: "12px", fontWeight: "700", color: "#ffffff", fontFamily: "var(--font-display)" }}>
                A: {engineA.provider.toUpperCase()}
              </span>
              {metricsA && (
                <div style={{ display: "flex", gap: "8px", fontSize: "10px", fontFamily: "var(--font-mono)", fontWeight: "700" }}>
                  <span style={{ color: "var(--accent-secondary)" }}>{metricsA.latencyMs}ms</span>
                  <span style={{ color: "var(--accent-success)" }}>{metricsA.tokensPerSec} t/s</span>
                  {fasterModel === "A" && (
                    <span style={{ color: "var(--accent-warning)", background: "rgba(245, 158, 11, 0.08)", padding: "1px 6px", borderRadius: "8px" }}>
                      FASTER
                    </span>
                  )}
                </div>
              )}
            </div>

            <div style={{ flex: 1, overflowY: "auto", fontSize: "13px", color: "var(--text-secondary)", lineHeight: "1.7", whiteSpace: "pre-wrap" }}>
              {errorA ? (
                <div style={{ display: "flex", gap: "8px", color: "var(--accent-danger)", fontSize: "12px", padding: "10px", background: "rgba(239,68,68,0.06)", borderRadius: "6px", border: "1px solid rgba(239,68,68,0.2)" }}>
                  <XCircle size={14} style={{ flexShrink: 0, marginTop: "1px" }} />
                  <span>{errorA}</span>
                </div>
              ) : streamA ? (
                streamA
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)", fontSize: "12px" }}>
                  {isStreaming
                    ? <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><Sparkles size={12} />Streaming from {engineA.provider}…</span>
                    : "Awaiting engine A…"
                  }
                </div>
              )}
            </div>
          </div>

          {/* VIEWPORT B */}
          <div className="glass-card" style={{ display: "flex", flexDirection: "column", height: "100%", padding: "20px", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border-muted)", paddingBottom: "10px", marginBottom: "14px" }}>
              <span style={{ fontSize: "12px", fontWeight: "700", color: "#ffffff", fontFamily: "var(--font-display)" }}>
                B: {engineB.provider.toUpperCase()}
              </span>
              {metricsB && (
                <div style={{ display: "flex", gap: "8px", fontSize: "10px", fontFamily: "var(--font-mono)", fontWeight: "700" }}>
                  <span style={{ color: "var(--accent-secondary)" }}>{metricsB.latencyMs}ms</span>
                  <span style={{ color: "var(--accent-success)" }}>{metricsB.tokensPerSec} t/s</span>
                  {fasterModel === "B" && (
                    <span style={{ color: "var(--accent-warning)", background: "rgba(245, 158, 11, 0.08)", padding: "1px 6px", borderRadius: "8px" }}>
                      FASTER
                    </span>
                  )}
                </div>
              )}
            </div>

            <div style={{ flex: 1, overflowY: "auto", fontSize: "13px", color: "var(--text-secondary)", lineHeight: "1.7", whiteSpace: "pre-wrap" }}>
              {errorB ? (
                <div style={{ display: "flex", gap: "8px", color: "var(--accent-danger)", fontSize: "12px", padding: "10px", background: "rgba(239,68,68,0.06)", borderRadius: "6px", border: "1px solid rgba(239,68,68,0.2)" }}>
                  <XCircle size={14} style={{ flexShrink: 0, marginTop: "1px" }} />
                  <span>{errorB}</span>
                </div>
              ) : streamB ? (
                streamB
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)", fontSize: "12px" }}>
                  {isStreaming
                    ? <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><Sparkles size={12} />Streaming from {engineB.provider}…</span>
                    : "Awaiting engine B…"
                  }
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* RIGHT COLUMN */}
      <div className="glass-card" style={{ display: "flex", flexDirection: "column", height: "100%", padding: "20px", gap: "16px" }}>

        {/* Connection HUD */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", borderBottom: "1px solid var(--border-muted)", paddingBottom: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{
              display: "inline-block", width: "8px", height: "8px", borderRadius: "50%",
              background: isOllamaOnline ? "var(--accent-success)" : "var(--accent-danger)",
              boxShadow: isOllamaOnline ? "0 0 8px var(--accent-success)" : "0 0 8px var(--accent-danger)"
            }}></span>
            <h3 style={{ fontSize: "13px", fontWeight: "700", fontFamily: "var(--font-display)" }}>
              Engine Status
            </h3>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
            {[
              { label: "Ollama (Local)", ready: isOllamaOnline },
              { label: "OpenAI",         ready: !!apiKeys.openai },
              { label: "Gemini",          ready: !!apiKeys.gemini },
              { label: "Groq",            ready: !!apiKeys.groq },
              { label: "Anthropic",       ready: !!apiKeys.anthropic },
            ].map(({ label, ready }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{label}</span>
                <span style={{ color: ready ? "var(--accent-success)" : "var(--accent-warning)", fontWeight: "bold" }}>
                  {ready ? "READY" : "NO KEY"}
                </span>
              </div>
            ))}

            <div style={{ borderTop: "1px dashed var(--border-muted)", marginTop: "4px", paddingTop: "4px", fontSize: "10px", color: "var(--text-muted)" }}>
              <span>Workspace route: </span>
              <span style={{ color: "var(--text-secondary)" }}>{provider.toUpperCase()} / {model || "—"}</span>
            </div>
          </div>
        </div>

        {/* Context Pins */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", borderBottom: "1px solid var(--border-muted)", paddingBottom: "10px" }}>
          <Pin size={14} style={{ color: "var(--accent-secondary)" }} />
          <h3 style={{ fontSize: "13px", fontWeight: "700", fontFamily: "var(--font-display)" }}>
            Context Pins
          </h3>
        </div>

        <p style={{ fontSize: "11.5px", color: "var(--text-muted)", lineHeight: "1.5" }}>
          Pinned pages are injected into both engine prompts as shared context:
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px", overflowY: "auto", flex: 1 }}>
          {pages.length === 0 && (
            <span style={{ fontSize: "11px", color: "var(--text-muted)", fontStyle: "italic" }}>
              No pages in workspace yet.
            </span>
          )}
          {pages.map((p) => {
            const isPinned = pinnedPages.includes(p.id)
            return (
              <button
                key={p.id}
                onClick={() => togglePin(p.id)}
                className={`sidebar-page-item ${isPinned ? "active" : ""}`}
                style={{ width: "100%", padding: "8px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12.5px" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", width: "85%" }}>
                  <FileText size={12} style={{ flexShrink: 0, opacity: 0.8 }} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.title}
                  </span>
                </div>
                {isPinned && <CheckCircle2 size={12} style={{ color: "var(--accent-success)", flexShrink: 0 }} />}
              </button>
            )
          })}
        </div>

        {/* Performance Radar */}
        {metricsA && metricsB && (
          <div style={{ borderTop: "1px solid var(--border-muted)", paddingTop: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <BarChart2 size={14} style={{ color: "var(--accent-success)" }} />
              <span style={{ fontSize: "12px", fontWeight: "700" }}>Performance Radar</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "11px", background: "rgba(0,0,0,0.2)", padding: "10px", borderRadius: "6px" }}>
              {[
                { label: `A · ${engineA.provider}`, metrics: metricsA, color: "var(--accent-secondary)" },
                { label: `B · ${engineB.provider}`, metrics: metricsB, color: "var(--accent-success)" },
              ].map(({ label, metrics, color }) => (
                <div key={label}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ color: "var(--text-muted)" }}>{label}</span>
                    <span style={{ fontWeight: "700" }}>
                      {metrics.latencyMs}ms · {metrics.tokensPerSec} t/s
                    </span>
                  </div>
                  <div style={{ height: "4px", background: "rgba(255,255,255,0.05)", borderRadius: "2px", overflow: "hidden" }}>
                    <div style={{ width: `${Math.min(100, metrics.overallScore / 2)}%`, height: "100%", background: color }}></div>
                  </div>
                  <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "3px", textAlign: "right" }}>
                    score {metrics.overallScore}
                  </div>
                </div>
              ))}

              <div style={{ borderTop: "1px dashed var(--border-muted)", paddingTop: "8px", fontSize: "10px", color: "var(--text-muted)", textAlign: "center" }}>
                {fasterModel === "A"
                  ? `Engine A (${engineA.provider}) responded faster by ${metricsB.latencyMs - metricsA.latencyMs}ms`
                  : `Engine B (${engineB.provider}) responded faster by ${metricsA.latencyMs - metricsB.latencyMs}ms`
                }
              </div>
            </div>
          </div>
        )}

        {/* Warn if both engines are the same provider */}
        {engineA.provider === engineB.provider && (
          <div style={{ display: "flex", gap: "6px", fontSize: "11px", color: "var(--accent-warning)", padding: "8px", background: "rgba(245,158,11,0.06)", borderRadius: "6px", border: "1px solid rgba(245,158,11,0.2)" }}>
            <AlertCircle size={13} style={{ flexShrink: 0, marginTop: "1px" }} />
            <span>Both engines use the same provider. Select different providers to compare meaningfully.</span>
          </div>
        )}
      </div>

    </div>
  )
}
