import { useState } from "react"
import { Scissors, AlertTriangle, CheckCircle2, Copy, ChevronDown, ChevronUp, Zap, Lightbulb } from "lucide-react"
import { executePrompt, APIKeys } from "../utils/ai"

interface PromptSurgeonProps {
  provider: string
  model: string
  apiKeys: APIKeys
  isOllamaOnline: boolean
  logSystemMessage: (tag: "SYSTEM" | "DATABASE" | "OLLAMA" | "ERROR", message: string) => void
}

interface Diagnosis {
  severity: "critical" | "warning" | "ok"
  category: string
  finding: string
  fix: string
}

interface SurgeonReport {
  diagnoses: Diagnosis[]
  improvedPrompt: string
  summary: string
  qualityScore: number
}

// ─── Severity config ──────────────────────────────────────────────────────────
const SEVERITY_STYLE: Record<string, { color: string; bg: string; border: string; icon: React.ReactNode }> = {
  critical: {
    color: "var(--accent-danger)",
    bg: "rgba(239, 68, 68, 0.06)",
    border: "rgba(239, 68, 68, 0.2)",
    icon: <AlertTriangle size={13} />,
  },
  warning: {
    color: "var(--accent-warning)",
    bg: "rgba(245, 158, 11, 0.06)",
    border: "rgba(245, 158, 11, 0.2)",
    icon: <Zap size={13} />,
  },
  ok: {
    color: "var(--accent-success)",
    bg: "rgba(16, 185, 129, 0.06)",
    border: "rgba(16, 185, 129, 0.2)",
    icon: <CheckCircle2 size={13} />,
  },
}

// ─── Surgeon system prompt ────────────────────────────────────────────────────
const SURGEON_SYSTEM_PROMPT = `You are a prompt engineering expert called "Prompt Surgeon." Your job is to diagnose and improve AI prompts.

When given a prompt, analyze it and return a structured JSON response with this exact shape:

{
  "qualityScore": <integer 0-100, where 100 is perfect>,
  "summary": "<one sentence overall assessment>",
  "diagnoses": [
    {
      "severity": "<one of: critical | warning | ok>",
      "category": "<one of: Intent, Context, Constraints, Tone, Format, Specificity, Role, Length>",
      "finding": "<what is wrong or right, 1-2 sentences>",
      "fix": "<how to fix it, 1-2 sentences. If severity is ok, describe what is done well.>"
    }
  ],
  "improvedPrompt": "<the fully rewritten, improved version of the prompt>"
}

Diagnose these dimensions in order:
1. Intent — Is the goal clear and unambiguous?
2. Context — Does the prompt give the model enough background?
3. Constraints — Are scope/format/length limits specified?
4. Tone — Is the expected tone or voice defined?
5. Role — Should there be a system role or persona defined?
6. Specificity — Are vague words like "good", "better", "useful" avoided?
7. Format — Is the desired output format explicit (list, table, paragraph, JSON, etc.)?

Only output valid JSON. No markdown, no backticks, no preamble.`

export default function PromptSurgeon({
  provider,
  model,
  apiKeys,
  isOllamaOnline,
  logSystemMessage,
}: PromptSurgeonProps) {
  const [inputPrompt, setInputPrompt] = useState("")
  const [report, setReport] = useState<SurgeonReport | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedImproved, setCopiedImproved] = useState(false)
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  const canRun = !!inputPrompt.trim() && !isAnalyzing && (
    isOllamaOnline || apiKeys.openai || apiKeys.gemini || apiKeys.groq || apiKeys.anthropic
  )

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canRun) return

    setIsAnalyzing(true)
    setReport(null)
    setError(null)
    logSystemMessage("SYSTEM", `Prompt Surgeon: analyzing prompt (${inputPrompt.length} chars) via ${provider.toUpperCase()}`)

    try {
      const raw = await executePrompt({
        provider,
        model,
        prompt: `Analyze this prompt:\n\n"""\n${inputPrompt.trim()}\n"""`,
        systemPrompt: SURGEON_SYSTEM_PROMPT,
        apiKeys,
      })

      // Strip possible markdown fences if model adds them anyway
      const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
      const parsed: SurgeonReport = JSON.parse(cleaned)
      setReport(parsed)
      logSystemMessage("SYSTEM", `Prompt Surgeon: diagnosis complete — score ${parsed.qualityScore}/100`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error"
      setError(`Analysis failed: ${msg}`)
      logSystemMessage("ERROR", `Prompt Surgeon: ${msg}`)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const copyImproved = () => {
    if (!report) return
    navigator.clipboard.writeText(report.improvedPrompt)
    setCopiedImproved(true)
    setTimeout(() => setCopiedImproved(false), 2000)
  }

  const scoreColor = (score: number) =>
    score >= 75 ? "var(--accent-success)" : score >= 45 ? "var(--accent-warning)" : "var(--accent-danger)"

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", height: "100%", overflowY: "auto" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{
          width: "32px", height: "32px", borderRadius: "8px",
          background: "linear-gradient(135deg, rgba(167, 139, 250, 0.2) 0%, rgba(139, 92, 246, 0.1) 100%)",
          border: "1px solid rgba(167, 139, 250, 0.3)",
          display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          <Scissors size={16} style={{ color: "#a78bfa" }} />
        </div>
        <div>
          <h3 style={{ fontSize: "15px", fontWeight: "700", fontFamily: "var(--font-display)", marginBottom: "2px" }}>
            Prompt Surgeon
          </h3>
          <p style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            Diagnose, annotate, and improve your prompts
          </p>
        </div>
      </div>

      {/* Input */}
      <div className="glass-card" style={{ padding: "18px" }}>
        <form onSubmit={handleAnalyze} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
            PROMPT TO DIAGNOSE
          </label>
          <textarea
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            placeholder="Paste any prompt here — a system prompt, user message, or task instruction. The Surgeon will find what's vague, missing, or conflicting."
            className="input-premium"
            disabled={isAnalyzing}
            style={{ height: "120px", resize: "none", fontSize: "13px", lineHeight: "1.6" }}
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
              {inputPrompt.length} chars · via {provider.toUpperCase()} / {model || "default"}
            </span>
            <button
              type="submit"
              disabled={!canRun}
              className="btn-premium"
              style={{ padding: "8px 18px", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <Scissors size={13} />
              <span>{isAnalyzing ? "Analyzing…" : "Run Diagnosis"}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Error state */}
      {error && (
        <div style={{ display: "flex", gap: "8px", color: "var(--accent-danger)", fontSize: "12.5px", padding: "12px 14px", background: "rgba(239,68,68,0.06)", borderRadius: "8px", border: "1px solid rgba(239,68,68,0.2)" }}>
          <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: "1px" }} />
          <span>{error}</span>
        </div>
      )}

      {/* Report */}
      {report && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Score + Summary */}
          <div className="glass-card" style={{ padding: "16px", display: "flex", alignItems: "center", gap: "20px" }}>
            {/* Score dial */}
            <div style={{ textAlign: "center", flexShrink: 0 }}>
              <div style={{
                width: "60px", height: "60px", borderRadius: "50%",
                border: `3px solid ${scoreColor(report.qualityScore)}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexDirection: "column",
                boxShadow: `0 0 12px ${scoreColor(report.qualityScore)}44`,
              }}>
                <span style={{ fontSize: "18px", fontWeight: "800", color: scoreColor(report.qualityScore), lineHeight: 1 }}>
                  {report.qualityScore}
                </span>
                <span style={{ fontSize: "8px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>/100</span>
              </div>
            </div>
            <div>
              <p style={{ fontSize: "13px", color: "var(--text-primary)", lineHeight: "1.5", margin: 0 }}>
                {report.summary}
              </p>
              <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "6px", fontFamily: "var(--font-mono)" }}>
                {report.diagnoses.filter(d => d.severity === "critical").length} critical ·{" "}
                {report.diagnoses.filter(d => d.severity === "warning").length} warnings ·{" "}
                {report.diagnoses.filter(d => d.severity === "ok").length} passing
              </p>
            </div>
          </div>

          {/* Diagnoses */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
              <AlertTriangle size={14} style={{ color: "var(--accent-warning)" }} />
              <h4 style={{ fontSize: "13px", fontWeight: "700", fontFamily: "var(--font-display)" }}>
                Surgical Findings
              </h4>
            </div>

            {report.diagnoses.map((d, idx) => {
              const style = SEVERITY_STYLE[d.severity] || SEVERITY_STYLE.ok
              const isExpanded = expandedIdx === idx
              return (
                <div
                  key={idx}
                  style={{
                    borderRadius: "8px",
                    border: `1px solid ${style.border}`,
                    background: style.bg,
                    overflow: "hidden",
                  }}
                >
                  <button
                    onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                    style={{
                      width: "100%", padding: "10px 14px",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      background: "transparent", border: "none", cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ color: style.color }}>{style.icon}</span>
                      <span style={{ fontSize: "11.5px", fontWeight: "700", color: style.color, fontFamily: "var(--font-mono)", textTransform: "uppercase" }}>
                        {d.category}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)", textAlign: "right", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {d.finding}
                      </span>
                      {isExpanded ? <ChevronUp size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} /> : <ChevronDown size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div style={{ padding: "0 14px 12px", display: "flex", flexDirection: "column", gap: "8px", borderTop: `1px solid ${style.border}` }}>
                      <div style={{ paddingTop: "10px" }}>
                        <span style={{ fontSize: "10px", fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontWeight: "700" }}>FINDING</span>
                        <p style={{ fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: "1.5", margin: "4px 0 0" }}>
                          {d.finding}
                        </p>
                      </div>
                      <div>
                        <span style={{ fontSize: "10px", fontFamily: "var(--font-mono)", color: style.color, fontWeight: "700" }}>PRESCRIPTION</span>
                        <p style={{ fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: "1.5", margin: "4px 0 0" }}>
                          {d.fix}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Improved Prompt */}
          <div className="glass-card" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Lightbulb size={14} style={{ color: "var(--accent-success)" }} />
                <h4 style={{ fontSize: "13px", fontWeight: "700", fontFamily: "var(--font-display)" }}>
                  Improved Prompt
                </h4>
              </div>
              <button
                onClick={copyImproved}
                style={{
                  display: "flex", alignItems: "center", gap: "5px",
                  fontSize: "11px", color: copiedImproved ? "var(--accent-success)" : "var(--text-muted)",
                  background: "transparent", border: "none", cursor: "pointer",
                  fontFamily: "var(--font-mono)", fontWeight: "600",
                  transition: "color 0.2s",
                }}
              >
                <Copy size={12} />
                {copiedImproved ? "Copied!" : "Copy"}
              </button>
            </div>

            <div style={{
              background: "rgba(0,0,0,0.25)",
              borderRadius: "6px",
              padding: "14px",
              fontSize: "13px",
              color: "var(--text-primary)",
              lineHeight: "1.7",
              whiteSpace: "pre-wrap",
              border: "1px solid rgba(16, 185, 129, 0.15)",
              fontFamily: "var(--font-mono)",
            }}>
              {report.improvedPrompt}
            </div>

            <button
              onClick={() => setInputPrompt(report.improvedPrompt)}
              style={{
                alignSelf: "flex-start", fontSize: "11.5px",
                color: "var(--accent-secondary)", background: "transparent",
                border: "1px solid rgba(99, 102, 241, 0.3)", borderRadius: "6px",
                padding: "5px 12px", cursor: "pointer",
                fontFamily: "var(--font-mono)", fontWeight: "600",
                display: "flex", alignItems: "center", gap: "5px",
              }}
            >
              <Scissors size={11} />
              Re-diagnose improved prompt
            </button>
          </div>

        </div>
      )}

      {/* Empty state */}
      {!report && !isAnalyzing && !error && (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: "10px", padding: "40px 20px", color: "var(--text-muted)", textAlign: "center"
        }}>
          <Scissors size={28} style={{ opacity: 0.3 }} />
          <p style={{ fontSize: "13px", lineHeight: "1.6", maxWidth: "260px" }}>
            Paste any prompt and the Surgeon will identify what's vague, missing, or conflicting — then rewrite it.
          </p>
        </div>
      )}

    </div>
  )
}
