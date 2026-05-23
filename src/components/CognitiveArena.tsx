import { useState } from "react"
import { Sparkles, Zap, FileText, CheckCircle2, Pin, BarChart2 } from "lucide-react"
import { Page } from "../App"

interface CognitiveArenaProps {
  pages: Page[]
  provider: string
  model: string
  apiKeys: {
    openai: string
    anthropic: string
    gemini: string
  }
  isOllamaOnline: boolean
  ollamaModels: string[]
  logSystemMessage: (tag: "SYSTEM" | "DATABASE" | "OLLAMA" | "ERROR", message: string) => void
}

interface PerformanceMetric {
  latencyMs: number
  tokensPerSec: number
  overallScore: number
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
  const [modelA, setModelA] = useState("ollama")
  const [modelB, setModelB] = useState("openai")
  
  const [streamA, setStreamA] = useState("")
  const [streamB, setStreamB] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  
  const [metricsA, setMetricsA] = useState<PerformanceMetric | null>(null)
  const [metricsB, setMetricsB] = useState<PerformanceMetric | null>(null)

  const [pinnedPages, setPinnedPages] = useState<string[]>([]) // Pinned document references

  // Available options
  const modelOptions = [
    { key: "ollama", label: "Local Ollama Engine", desc: ollamaModels[0] || "Llama 3.2 (Local)" },
    { key: "openai", label: "OpenAI Cloud Engine", desc: "GPT-4o (Cloud)" },
    { key: "gemini", label: "Gemini Cloud Engine", desc: "Gemini 1.5 Pro" },
    { key: "anthropic", label: "Anthropic Cloud Engine", desc: "Claude 3.5 Sonnet" }
  ]

  // Toggle page reference pins
  const togglePin = (pageId: string) => {
    setPinnedPages(prev => 
      prev.includes(pageId) ? prev.filter(id => id !== pageId) : [...prev, pageId]
    )
    logSystemMessage("SYSTEM", `Toggled arena reference pin for page ID "${pageId}"`)
  }

  // Initiate Arena Prompt
  const handleInitiateArena = (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim() || isStreaming) return

    setStreamA("")
    setStreamB("")
    setMetricsA(null)
    setMetricsB(null)
    setIsStreaming(true)
    
    logSystemMessage("SYSTEM", `Initiating Cognitive Arena parallel prompts for models A: ${modelA.toUpperCase()} and B: ${modelB.toUpperCase()}`)

    const textPrompt = prompt.trim()

    // Model A stream simulator
    simulateStream(
      modelA,
      textPrompt,
      (text) => setStreamA(text),
      (latency, tokens) => {
        setMetricsA({ latencyMs: latency, tokensPerSec: tokens, overallScore: Math.round(tokens * 0.8 + (10000 / latency)) })
      }
    )

    // Model B stream simulator
    setTimeout(() => {
      simulateStream(
        modelB,
        textPrompt,
        (text) => setStreamB(text),
        (latency, tokens) => {
          setMetricsB({ latencyMs: latency, tokensPerSec: tokens, overallScore: Math.round(tokens * 0.85 + (12000 / latency)) })
          setIsStreaming(false)
          logSystemMessage("OLLAMA", "Cognitive Arena parallel streams completed successfully")
        }
      )
    }, 300)
  }

  // Stream Simulator
  const simulateStream = (
    modelKey: string,
    userPrompt: string,
    onChunk: (text: string) => void,
    onComplete: (latency: number, tokens: number) => void
  ) => {
    let fullOutput = ""
    let words: string[] = []

    // Customized logic responses based on model profile
    if (modelKey === "ollama") {
      fullOutput = `### 🦙 Local Ollama Engine Analysis\n\n- **Target Prompt**: *${userPrompt}*\n- **Cognitive Model**: Local Llama Checkpoint\n- **Security Status**: 100% Encrypted & Local\n\nBased on your workspace specifications, here is the robust engineering approach to take:\n\n1. **Component Design**: Modular architecture isolating database states.\n2. **Security Credentials**: Enforce strict client-side validation rules.\n3. **Local Deployment**: Execute local containers under standard NGINX routing loops.\n\n*Offline latency logs are cleared.*`
    } else if (modelKey === "openai") {
      fullOutput = `### 🟢 OpenAI GPT-4o Advanced Synthesis\n\n- **Target Prompt**: *${userPrompt}*\n- **Cognitive Model**: GPT-4o (Cloud API)\n- **Security Status**: Encrypted Transit\n\nHere is a comprehensive overview of your architectural request:\n\n- **Overview**: A highly responsive, highly robust modular platform.\n- **Implementation Metrics**:\n  - Enforce atomic transactions inside spreadsheet data sets.\n  - Leverage View Transitions API for sliding aesthetic states.\n  - Auto-generate backup hooks using direct JSON serialization blocks.\n\n*Prompt completed under strict Cloud constraints.*`
    } else if (modelKey === "gemini") {
      fullOutput = `### 🔵 Gemini 1.5 Pro Multimodal Summary\n\n- **Target Prompt**: *${userPrompt}*\n- **Cognitive Model**: Gemini 1.5 Pro (Cloud API)\n- **Security Status**: Google Secure Handshake\n\nAnalyzing your workspace pages context, I recommend the following upgrades:\n\n1. **Utility Blocks**: Add visual radar indicators to monitor completion rates.\n2. **RAG Vectoring**: Set up Transformers.js embedding structures to query knowledge bases.\n3. **Themes Customization**: Clean up colorful emojis to elevate the visual feel to Alabaster White.\n\n*Context feed successfully parsed.*`
    } else {
      fullOutput = `### 🟠 Claude 3.5 Sonnet Precision Outline\n\n- **Target Prompt**: *${userPrompt}*\n- **Cognitive Model**: Claude 3.5 Sonnet (Cloud API)\n- **Security Status**: Anthropic Vault Shield\n\nHere is a highly detailed, precise layout of your request:\n\n- **Core Objectives**: Maximize cognitive utility and visual elegance.\n- **Technical Checklist**:\n  - Create Custom Workspace Switchers with chevron menus.\n  - Deploy standard checklists inside Kanban column lanes.\n  - Render interactive inline SVG charts representing spreadsheet cells.\n\n*Output structured under strict Markdown specifications.*`
    }

    words = fullOutput.split(" ")
    let wordIdx = 0
    const start = performance.now()

    const interval = setInterval(() => {
      if (wordIdx < words.length) {
        onChunk(words.slice(0, wordIdx + 1).join(" "))
        wordIdx++
      } else {
        clearInterval(interval)
        const latency = performance.now() - start
        const tokens = Math.round((words.length / latency) * 1000 * 1.5)
        onComplete(Math.round(latency), tokens)
      }
    }, 40)
  }

  // Active faster model check
  const fasterModel = (() => {
    if (!metricsA || !metricsB) return null
    return metricsA.latencyMs < metricsB.latencyMs ? "A" : "B"
  })()

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: "24px", height: "calc(100vh - 120px)", overflow: "hidden" }}>
      
      {/* LEFT COLUMN: Main Arena Arena */}
      <div style={{ display: "flex", flexDirection: "column", gap: "20px", height: "100%", overflow: "hidden" }}>
        
        {/* Cockpit Prompt Input */}
        <div className="glass-card" style={{ padding: "20px" }}>
          <form onSubmit={handleInitiateArena} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Zap size={18} style={{ color: "var(--accent-warning)" }} />
              <h3 style={{ fontSize: "15px", fontWeight: "700", fontFamily: "var(--font-display)" }}>
                AI Cognitive Arena Cockpit
              </h3>
            </div>
            
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter a prompt to prompt both A and B engines in parallel..."
              className="input-premium"
              disabled={isStreaming}
              style={{ height: "70px", resize: "none", fontSize: "13px" }}
            />

            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
              {/* Select Engine A */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600", fontFamily: "var(--font-mono)" }}>ENGINE A:</span>
                <select
                  value={modelA}
                  onChange={(e) => setModelA(e.target.value)}
                  className="input-premium"
                  disabled={isStreaming}
                  style={{ width: "160px", padding: "6px 10px", fontSize: "11.5px" }}
                >
                  {modelOptions.map(opt => (
                    <option key={opt.key} value={opt.key}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Select Engine B */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600", fontFamily: "var(--font-mono)" }}>ENGINE B:</span>
                <select
                  value={modelB}
                  onChange={(e) => setModelB(e.target.value)}
                  className="input-premium"
                  disabled={isStreaming}
                  style={{ width: "160px", padding: "6px 10px", fontSize: "11.5px" }}
                >
                  {modelOptions.map(opt => (
                    <option key={opt.key} value={opt.key}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={isStreaming || !prompt.trim()}
                className="btn-premium"
                style={{ padding: "8px 16px", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <Sparkles size={13} />
                <span>Initiate Arena Prompt</span>
              </button>
            </div>
          </form>
        </div>

        {/* Side-by-Side Viewport Columns */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", flex: 1, overflow: "hidden" }}>
          
          {/* VIEWPORT COLUMN A */}
          <div className="glass-card" style={{ display: "flex", flexDirection: "column", height: "100%", padding: "20px", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border-muted)", paddingBottom: "10px", marginBottom: "14px" }}>
              <span style={{ fontSize: "12px", fontWeight: "700", color: "#ffffff", fontFamily: "var(--font-display)" }}>
                COLUMN A: {modelA.toUpperCase()}
              </span>
              {metricsA && (
                <div style={{ display: "flex", gap: "8px", fontSize: "10px", fontFamily: "var(--font-mono)", fontWeight: "700" }}>
                  <span style={{ color: "var(--accent-secondary)" }}>{metricsA.latencyMs}ms</span>
                  <span style={{ color: "var(--accent-success)" }}>{metricsA.tokensPerSec} t/s</span>
                  {fasterModel === "A" && <span style={{ color: "var(--accent-warning)", background: "rgba(245, 158, 11, 0.08)", padding: "1px 6px", borderRadius: "8px" }}>FASTER</span>}
                </div>
              )}
            </div>
            
            <div style={{ flex: 1, overflowY: "auto", fontSize: "13px", color: "var(--text-secondary)", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>
              {streamA || (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)" }}>
                  Awaiting column A execution...
                </div>
              )}
            </div>
          </div>

          {/* VIEWPORT COLUMN B */}
          <div className="glass-card" style={{ display: "flex", flexDirection: "column", height: "100%", padding: "20px", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border-muted)", paddingBottom: "10px", marginBottom: "14px" }}>
              <span style={{ fontSize: "12px", fontWeight: "700", color: "#ffffff", fontFamily: "var(--font-display)" }}>
                COLUMN B: {modelB.toUpperCase()}
              </span>
              {metricsB && (
                <div style={{ display: "flex", gap: "8px", fontSize: "10px", fontFamily: "var(--font-mono)", fontWeight: "700" }}>
                  <span style={{ color: "var(--accent-secondary)" }}>{metricsB.latencyMs}ms</span>
                  <span style={{ color: "var(--accent-success)" }}>{metricsB.tokensPerSec} t/s</span>
                  {fasterModel === "B" && <span style={{ color: "var(--accent-warning)", background: "rgba(245, 158, 11, 0.08)", padding: "1px 6px", borderRadius: "8px" }}>FASTER</span>}
                </div>
              )}
            </div>
            
            <div style={{ flex: 1, overflowY: "auto", fontSize: "13px", color: "var(--text-secondary)", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>
              {streamB || (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)" }}>
                  Awaiting column B execution...
                </div>
              )}
            </div>
          </div>

        </div>

      </div>

      {/* RIGHT COLUMN: Pinned References panel */}
      <div className="glass-card" style={{ display: "flex", flexDirection: "column", height: "100%", padding: "20px", gap: "16px" }}>
        
        {/* Connection Status HUD */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", borderBottom: "1px solid var(--border-muted)", paddingBottom: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ 
              display: "inline-block", 
              width: "8px", 
              height: "8px", 
              borderRadius: "50%", 
              background: isOllamaOnline ? "var(--accent-success)" : "var(--accent-danger)",
              boxShadow: isOllamaOnline ? "0 0 8px var(--accent-success)" : "0 0 8px var(--accent-danger)"
            }}></span>
            <h3 style={{ fontSize: "13px", fontWeight: "700", fontFamily: "var(--font-display)" }}>
              Engine Connection HUD
            </h3>
          </div>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Ollama (Local)</span>
              <span style={{ color: isOllamaOnline ? "var(--accent-success)" : "var(--text-muted)", fontWeight: "bold" }}>
                {isOllamaOnline ? "ONLINE" : "OFFLINE"}
              </span>
            </div>
            
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>OpenAI API</span>
              <span style={{ color: apiKeys.openai ? "var(--accent-success)" : "var(--accent-warning)", fontWeight: "bold" }}>
                {apiKeys.openai ? "CONFIGURED" : "MISSING KEY"}
              </span>
            </div>
            
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Gemini API</span>
              <span style={{ color: apiKeys.gemini ? "var(--accent-success)" : "var(--accent-warning)", fontWeight: "bold" }}>
                {apiKeys.gemini ? "CONFIGURED" : "MISSING KEY"}
              </span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Anthropic API</span>
              <span style={{ color: apiKeys.anthropic ? "var(--accent-success)" : "var(--accent-warning)", fontWeight: "bold" }}>
                {apiKeys.anthropic ? "CONFIGURED" : "MISSING KEY"}
              </span>
            </div>

            <div style={{ borderTop: "1px dashed var(--border-muted)", marginTop: "4px", paddingTop: "4px", fontSize: "10px", color: "var(--text-muted)" }}>
              <span>Active Route: </span>
              <div style={{ color: "var(--text-secondary)", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {provider.toUpperCase()} / {model || "None"}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", borderBottom: "1px solid var(--border-muted)", paddingBottom: "10px" }}>
          <Pin size={14} style={{ color: "var(--accent-secondary)" }} />
          <h3 style={{ fontSize: "13px", fontWeight: "700", fontFamily: "var(--font-display)" }}>
            Arena Context Pinned
          </h3>
        </div>
        
        <p style={{ fontSize: "11.5px", color: "var(--text-muted)", lineHeight: "1.5" }}>
          Pin document pages to feed them into the benchmark prompt context inputs:
        </p>

        {/* List Pinned Page Checkboxes */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", overflowY: "auto", flex: 1 }}>
          {pages.map((p) => {
            const isPinned = pinnedPages.includes(p.id)
            return (
              <button
                key={p.id}
                onClick={() => togglePin(p.id)}
                className={`sidebar-page-item ${isPinned ? "active" : ""}`}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: "12.5px"
                }}
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

        {/* SVG Performance HUD Radar */}
        {metricsA && metricsB && (
          <div style={{ borderTop: "1px solid var(--border-muted)", paddingTop: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <BarChart2 size={14} style={{ color: "var(--accent-success)" }} />
              <span style={{ fontSize: "12px", fontWeight: "700" }}>Performance Radar</span>
            </div>
            
            {/* Visual Radars metric bar */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "11px", background: "rgba(0,0,0,0.2)", padding: "10px", borderRadius: "6px" }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                  <span>Engine A Score</span>
                  <span style={{ fontWeight: "700" }}>{metricsA.overallScore}</span>
                </div>
                <div style={{ height: "4px", background: "rgba(255,255,255,0.05)", borderRadius: "2px", overflow: "hidden" }}>
                  <div style={{ width: `${Math.min(100, metricsA.overallScore / 2)}%`, height: "100%", background: "var(--accent-secondary)" }}></div>
                </div>
              </div>
              
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                  <span>Engine B Score</span>
                  <span style={{ fontWeight: "700" }}>{metricsB.overallScore}</span>
                </div>
                <div style={{ height: "4px", background: "rgba(255,255,255,0.05)", borderRadius: "2px", overflow: "hidden" }}>
                  <div style={{ width: `${Math.min(100, metricsB.overallScore / 2)}%`, height: "100%", background: "var(--accent-success)" }}></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
