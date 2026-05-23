import { useState } from "react"
import { Sparkles, Copy, Check, CornerDownRight, RotateCcw, Feather, BookOpen, Smile, Zap, List } from "lucide-react"
import { executePrompt } from "../utils/ai"

interface RewriteRoomProps {
  provider: string
  model: string
  apiKeys: {
    openai: string
    anthropic: string
    gemini: string
  }
}

type OutputViewMode = "output" | "diff"

export default function RewriteRoom({ provider, model, apiKeys }: RewriteRoomProps) {
  const [inputText, setInputText] = useState("")
  const [tone, setTone] = useState("Professional")
  const [length, setLength] = useState("Keep Same")
  const [format, setFormat] = useState("Plain Text")
  const [customGoal, setCustomGoal] = useState("")
  
  const [outputText, setOutputText] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState("")
  const [viewMode, setViewMode] = useState<OutputViewMode>("output")

  const handleRewrite = async (overrideParams?: { tone?: string; length?: string; format?: string; customGoal?: string }) => {
    const activeInput = inputText.trim()
    if (!activeInput) return
    setIsLoading(true)
    setError("")
    setOutputText("")

    const finalTone = overrideParams?.tone ?? tone
    const finalLength = overrideParams?.length ?? length
    const finalFormat = overrideParams?.format ?? format
    const finalGoal = overrideParams?.customGoal ?? customGoal

    const prompt = `Please rewrite the following text:
"${activeInput}"

Rewrite details:
- Tone: ${finalTone}
- Length: ${finalLength}
- Format: ${finalFormat}
${finalGoal.trim() ? `- Additional Goal: ${finalGoal.trim()}` : ""}

Please provide ONLY the final rewritten output, with no conversational preamble or postamble.`

    const systemPrompt = `You are an expert editor and writing refinement engine. Your goal is to rewrite the user's text to match their specified tone, length, and format guidelines with premium, high-impact language. Return only the final revised text.`

    try {
      const result = await executePrompt({
        provider,
        model,
        prompt,
        systemPrompt,
        apiKeys,
      })
      setOutputText(result.trim())
      setViewMode("output") // Default back to output view for fresh results
    } catch (err: any) {
      setError(err.message || "Failed to execute rewrite request.")
    } finally {
      setIsLoading(false)
    }
  }

  // Pre-configured Quick Action presets that execute immediately
  const handleQuickAction = async (action: string) => {
    if (!inputText.trim()) return
    let params = {}
    if (action === "simplify") {
      params = { tone: "Casual", length: "Shorter", format: "Plain Text", customGoal: "Explain it in simple, crystal-clear terms." }
      setTone("Casual")
      setLength("Shorter")
      setFormat("Plain Text")
      setCustomGoal("Explain it in simple, crystal-clear terms.")
    } else if (action === "punchy") {
      params = { tone: "Sharp", length: "Keep Same", format: "Plain Text", customGoal: "Make it extremely high-impact, direct, and persuasive." }
      setTone("Sharp")
      setLength("Keep Same")
      setFormat("Plain Text")
      setCustomGoal("Make it extremely high-impact, direct, and persuasive.")
    } else if (action === "professional") {
      params = { tone: "Professional", length: "Keep Same", format: "Plain Text", customGoal: "" }
      setTone("Professional")
      setLength("Keep Same")
      setFormat("Plain Text")
      setCustomGoal("")
    } else if (action === "bulletize") {
      params = { tone: "Sharp", length: "Keep Same", format: "Bullets", customGoal: "" }
      setTone("Sharp")
      setLength("Keep Same")
      setFormat("Bullets")
      setCustomGoal("")
    }
    
    await handleRewrite(params)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(outputText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{ background: "rgba(99, 102, 241, 0.1)", border: "1px solid var(--border-muted)", padding: "10px", borderRadius: "var(--radius-sm)" }}>
          <Feather size={22} className="gradient-accent-text" />
        </div>
        <div>
          <h2 style={{ fontSize: "20px", fontWeight: "700", fontFamily: "var(--font-display)" }}>
            Rewrite Room
          </h2>
          <p style={{ fontSize: "14px", color: "var(--text-muted)" }}>
            Polish, refine, and transform your writing's tone, structure, and impact instantly.
          </p>
        </div>
      </div>

      {/* Floating Quick Action Preset Bar */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px", background: "rgba(255, 255, 255, 0.02)", border: "1px solid var(--border-muted)", padding: "8px 12px", borderRadius: "var(--radius-sm)" }}>
        <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", letterSpacing: "0.05em", fontFamily: "var(--font-mono)", marginRight: "4px" }}>
          QUICK TRIGGER PRESETS:
        </span>
        <button
          onClick={() => handleQuickAction("simplify")}
          disabled={isLoading || !inputText.trim()}
          className="btn-secondary"
          style={{ padding: "6px 12px", fontSize: "11.5px", display: "inline-flex", alignItems: "center", gap: "6px", borderRadius: "6px" }}
        >
          <Smile size={13} style={{ color: "var(--accent-secondary)" }} />
          <span>Explain Simply</span>
        </button>

        <button
          onClick={() => handleQuickAction("punchy")}
          disabled={isLoading || !inputText.trim()}
          className="btn-secondary"
          style={{ padding: "6px 12px", fontSize: "11.5px", display: "inline-flex", alignItems: "center", gap: "6px", borderRadius: "6px" }}
        >
          <Zap size={13} style={{ color: "var(--accent-warning)" }} />
          <span>Make Punchy</span>
        </button>

        <button
          onClick={() => handleQuickAction("professional")}
          disabled={isLoading || !inputText.trim()}
          className="btn-secondary"
          style={{ padding: "6px 12px", fontSize: "11.5px", display: "inline-flex", alignItems: "center", gap: "6px", borderRadius: "6px" }}
        >
          <BookOpen size={13} style={{ color: "var(--accent-info)" }} />
          <span>Professionalize</span>
        </button>

        <button
          onClick={() => handleQuickAction("bulletize")}
          disabled={isLoading || !inputText.trim()}
          className="btn-secondary"
          style={{ padding: "6px 12px", fontSize: "11.5px", display: "inline-flex", alignItems: "center", gap: "6px", borderRadius: "6px" }}
        >
          <List size={13} style={{ color: "var(--accent-primary)" }} />
          <span>Deconstruct Bullets</span>
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: "24px" }}>
        {/* Input Panel */}
        <div className="glass-card" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "18px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)", fontFamily: "var(--font-display)" }}>
              Original Draft Workspace
            </label>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste your rough draft, quick email, paragraph, or bullet points here..."
              style={{
                width: "100%",
                height: "230px",
                background: "rgba(0, 0, 0, 0.3)",
                border: "1px solid var(--border-muted)",
                borderRadius: "var(--radius-sm)",
                color: "var(--text-primary)",
                padding: "12px",
                fontSize: "14px",
                fontFamily: "var(--font-body)",
                resize: "none",
                outline: "none",
                lineHeight: "1.6",
                transition: "var(--transition-smooth)"
              }}
              className="input-premium"
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-secondary)", fontFamily: "var(--font-display)" }}>Tone Tuning</label>
              <select value={tone} onChange={(e) => setTone(e.target.value)} className="input-premium">
                <option value="Professional">💼 Professional</option>
                <option value="Casual">☕ Casual & Friendly</option>
                <option value="Academic">🎓 Academic & Detailed</option>
                <option value="Sharp">⚡ Sharp & Concise</option>
                <option value="Persuasive">🔥 Highly Persuasive</option>
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-secondary)", fontFamily: "var(--font-display)" }}>Length Profile</label>
              <select value={length} onChange={(e) => setLength(e.target.value)} className="input-premium">
                <option value="Keep Same">↔️ Keep Same</option>
                <option value="Shorter">📉 Condense / Shorter</option>
                <option value="Longer">📈 Expand / Longer</option>
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "12px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-secondary)", fontFamily: "var(--font-display)" }}>Format Type</label>
              <select value={format} onChange={(e) => setFormat(e.target.value)} className="input-premium">
                <option value="Plain Text">📝 Plain Paragraph</option>
                <option value="Markdown">💾 Styled Markdown</option>
                <option value="Bullets">📊 Key Bullet Points</option>
                <option value="Email">📧 Ready Email</option>
              </select>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-secondary)", fontFamily: "var(--font-display)" }}>Additional Objectives (Optional)</label>
            <input
              type="text"
              value={customGoal}
              onChange={(e) => setCustomGoal(e.target.value)}
              placeholder="e.g. Write it like Steve Jobs, include a call to action..."
              className="input-premium"
            />
          </div>

          <button
            onClick={() => handleRewrite()}
            disabled={isLoading || !inputText.trim()}
            className="btn-premium"
            style={{ width: "100%", marginTop: "6px" }}
          >
            {isLoading ? (
              <>
                <RotateCcw size={16} style={{ animation: "spin 1s linear infinite" }} /> Refining Language...
              </>
            ) : (
              <>
                <Sparkles size={16} /> Execute Rewrite
              </>
            )}
          </button>
        </div>

        {/* Output Panel */}
        <div className="glass-card" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "18px", minHeight: "420px", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px", height: "100%" }}>
            
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border-muted)", paddingBottom: "10px" }}>
              <div style={{ display: "flex", gap: "6px", background: "rgba(255,255,255,0.02)", padding: "2px", borderRadius: "6px", border: "1px solid var(--border-muted)" }}>
                <button
                  onClick={() => setViewMode("output")}
                  disabled={!outputText}
                  style={{
                    padding: "4px 10px",
                    fontSize: "11px",
                    background: viewMode === "output" ? "rgba(255,255,255,0.05)" : "transparent",
                    border: "none",
                    borderRadius: "4px",
                    color: viewMode === "output" ? "#ffffff" : "var(--text-muted)",
                    cursor: "pointer",
                    fontWeight: "600",
                    transition: "var(--transition-smooth)"
                  }}
                >
                  Refined Draft
                </button>
                <button
                  onClick={() => setViewMode("diff")}
                  disabled={!outputText}
                  style={{
                    padding: "4px 10px",
                    fontSize: "11px",
                    background: viewMode === "diff" ? "rgba(255,255,255,0.05)" : "transparent",
                    border: "none",
                    borderRadius: "4px",
                    color: viewMode === "diff" ? "#ffffff" : "var(--text-muted)",
                    cursor: "pointer",
                    fontWeight: "600",
                    transition: "var(--transition-smooth)"
                  }}
                >
                  Diff Compare
                </button>
              </div>

              {outputText && (
                <button
                  onClick={handleCopy}
                  className="btn-secondary"
                  style={{ padding: "6px 12px", fontSize: "11.5px", display: "inline-flex", alignItems: "center", gap: "6px", borderRadius: "6px" }}
                >
                  {copied ? <Check size={14} style={{ color: "var(--accent-success)" }} /> : <Copy size={14} />}
                  {copied ? "Copied" : "Copy Output"}
                </button>
              )}
            </div>

            {error && (
              <div style={{ background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.2)", padding: "12px", borderRadius: "var(--radius-sm)", color: "var(--accent-secondary)", fontSize: "13px" }}>
                {error}
              </div>
            )}

            {/* Main viewports */}
            {outputText ? (
              viewMode === "output" ? (
                <div style={{
                  background: "rgba(0, 0, 0, 0.2)",
                  border: "1px solid var(--border-muted)",
                  borderRadius: "var(--radius-sm)",
                  padding: "16px",
                  fontSize: "14px",
                  color: "var(--text-primary)",
                  fontFamily: format === "Markdown" ? "var(--font-mono)" : "var(--font-body)",
                  whiteSpace: "pre-wrap",
                  height: "380px",
                  overflowY: "auto",
                  lineHeight: "1.7",
                  boxShadow: "inset 0 2px 8px rgba(0,0,0,0.3)"
                }}>
                  {outputText}
                </div>
              ) : (
                /* Comparison Side-by-Side Diff view */
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", height: "380px" }}>
                  {/* Original */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <span style={{ fontSize: "10px", fontWeight: "700", color: "var(--text-muted)", letterSpacing: "0.05em", fontFamily: "var(--font-mono)" }}>ORIGINAL DRAFT</span>
                    <div style={{
                      flex: 1,
                      background: "rgba(239, 68, 68, 0.02)",
                      border: "1px solid rgba(239, 68, 68, 0.1)",
                      borderRadius: "var(--radius-sm)",
                      padding: "12px",
                      fontSize: "12.5px",
                      color: "var(--text-secondary)",
                      overflowY: "auto",
                      lineHeight: "1.6"
                    }}>
                      {inputText}
                    </div>
                  </div>
                  {/* Refined */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <span style={{ fontSize: "10px", fontWeight: "700", color: "var(--accent-success)", letterSpacing: "0.05em", fontFamily: "var(--font-mono)" }}>REFINED</span>
                    <div style={{
                      flex: 1,
                      background: "rgba(16, 185, 129, 0.02)",
                      border: "1px solid rgba(16, 185, 129, 0.1)",
                      borderRadius: "var(--radius-sm)",
                      padding: "12px",
                      fontSize: "12.5px",
                      color: "var(--text-primary)",
                      overflowY: "auto",
                      lineHeight: "1.6"
                    }}>
                      {outputText}
                    </div>
                  </div>
                </div>
              )
            ) : !isLoading && !error ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "380px", color: "var(--text-muted)", gap: "10px" }}>
                <CornerDownRight size={24} style={{ opacity: 0.5, color: "var(--accent-primary)", filter: "drop-shadow(0 0 4px var(--accent-primary))" }} />
                <span style={{ fontSize: "13px", fontWeight: "500" }}>Paste your text draft and click 'Execute' to begin.</span>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "380px", color: "var(--text-muted)", gap: "16px" }}>
                <RotateCcw size={28} style={{ animation: "spin 1.5s linear infinite", color: "var(--accent-primary)" }} />
                <span style={{ fontSize: "13px", fontWeight: "500", fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>Synthesizing advanced lexical changes...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
