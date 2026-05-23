import { useState, useEffect } from "react"
import { Sparkles, Scale, CheckCircle2, XCircle, Clock, HelpCircle, RefreshCw } from "lucide-react"
import { executePrompt } from "../utils/ai"

interface DecisionUnpackerProps {
  provider: string
  model: string
  apiKeys: {
    openai: string
    anthropic: string
    gemini: string
  }
}

interface DecisionAnalysis {
  pros: string[]
  cons: string[]
  shortTerm: string
  longTerm: string
  riskRating: "Low" | "Medium" | "High"
  actionableStep: string
}

export default function DecisionUnpacker({ provider, model, apiKeys }: DecisionUnpackerProps) {
  const [decision, setDecision] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [analysis, setAnalysis] = useState<DecisionAnalysis | null>(null)
  
  // Interactive Slider Weights state
  const [proWeights, setProWeights] = useState<number[]>([])
  const [conWeights, setConWeights] = useState<number[]>([])

  // Initialize weights when analysis is fetched
  useEffect(() => {
    if (analysis) {
      setProWeights(new Array(analysis.pros.length).fill(5))
      setConWeights(new Array(analysis.cons.length).fill(5))
    }
  }, [analysis])

  const handleUnpack = async () => {
    if (!decision.trim()) return
    setIsLoading(true)
    setError("")
    setAnalysis(null)

    const prompt = `Unpack and analyze the following decision: "${decision}"

Please format your response strictly as a JSON object with exactly these keys: "pros", "cons", "shortTerm", "longTerm", "riskRating", "actionableStep".

Key descriptions:
- "pros": Array of strings listing clear, high-impact benefits or positive outcomes
- "cons": Array of strings listing clear, high-impact risks or negative outcomes
- "shortTerm": A brief description of the impact in the next 3 months
- "longTerm": A brief description of the impact in the next 1 to 5 years
- "riskRating": The string "Low", "Medium", or "High" reflecting the severity of risk
- "actionableStep": A single, concrete first step the user should take right now to validate or make this decision.`

    const systemPrompt = `You are an elite strategic decision advisor and rational thinker. You help unpack complex choices into balanced, realistic pros/cons, short/long-term timelines, and risk assessments. You must format your final response strictly as a parseable JSON object. Do not wrap in markdown \`\`\`json blocks.`

    try {
      const result = await executePrompt({
        provider,
        model,
        prompt,
        systemPrompt,
        apiKeys,
      })

      let cleanJson = result.trim()
      if (cleanJson.startsWith("```json")) {
        cleanJson = cleanJson.slice(7)
      }
      if (cleanJson.endsWith("```")) {
        cleanJson = cleanJson.slice(0, -3)
      }

      const parsed = JSON.parse(cleanJson.trim()) as DecisionAnalysis
      setAnalysis(parsed)
    } catch (err: any) {
      setError(err.message || "Failed to analyze decision. Please ensure the model returns clean, parseable JSON.")
    } finally {
      setIsLoading(false)
    }
  }

  const getRiskColor = (rating: "Low" | "Medium" | "High") => {
    if (rating === "Low") return "var(--accent-success)"
    if (rating === "Medium") return "var(--accent-warning)"
    return "var(--accent-secondary)"
  }

  // Calculate Weighted Rationality Index
  const calculateRationalScore = () => {
    const sumPros = proWeights.reduce((a, b) => a + b, 0)
    const sumCons = conWeights.reduce((a, b) => a + b, 0)
    const total = sumPros + sumCons
    if (total === 0) return 50
    return Math.round((sumPros / total) * 100)
  }

  const rationalScore = calculateRationalScore()

  // Get dynamic status context of decision
  const getDialStatus = (score: number) => {
    if (score > 62) return { text: "OPPORTUNITY LEANING", color: "var(--accent-success)" }
    if (score < 38) return { text: "RISK AVOIDANCE ADVISED", color: "var(--accent-secondary)" }
    return { text: "RATIONALLY BALANCED", color: "var(--accent-info)" }
  }

  const dialStatus = getDialStatus(rationalScore)

  // Circular SVG offset values
  const radius = 64
  const stroke = 6
  const normalizedRadius = radius - stroke * 2
  const circumference = normalizedRadius * 2 * Math.PI
  const strokeDashoffset = circumference - (rationalScore / 100) * circumference

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{ background: "rgba(99, 102, 241, 0.1)", border: "1px solid var(--border-muted)", padding: "10px", borderRadius: "var(--radius-sm)" }}>
          <Scale size={22} className="gradient-accent-text" />
        </div>
        <div>
          <h2 style={{ fontSize: "20px", fontWeight: "700", fontFamily: "var(--font-display)" }}>
            Decision Unpacker
          </h2>
          <p style={{ fontSize: "14px", color: "var(--text-muted)" }}>
            Analyze high-stakes choices through structured rational matrices, short/long-term trade-offs, and risk indicators.
          </p>
        </div>
      </div>

      <div className="glass-card" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
        <label style={{ fontSize: "12.5px", fontWeight: "600", color: "var(--text-secondary)", fontFamily: "var(--font-display)" }}>
          What decision or dilemma are you weighing?
        </label>
        <div style={{ display: "flex", gap: "12px" }}>
          <input
            type="text"
            value={decision}
            onChange={(e) => setDecision(e.target.value)}
            placeholder="e.g. Should I join an early-stage startup or stay at my corporate tech job? Should we relocate?"
            className="input-premium"
            style={{ flex: 1 }}
            disabled={isLoading}
          />
          <button
            onClick={handleUnpack}
            disabled={isLoading || !decision.trim()}
            className="btn-premium"
            style={{ padding: "10px 24px", minWidth: "140px" }}
          >
            {isLoading ? (
              <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} />
            ) : (
              <>
                <Sparkles size={14} /> Unpack Matrix
              </>
            )}
          </button>
        </div>

        {error && (
          <div style={{ background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.2)", padding: "12px", borderRadius: "var(--radius-sm)", color: "var(--accent-secondary)", fontSize: "13px" }}>
            {error}
          </div>
        )}
      </div>

      {analysis && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* Main Visual Dial & Metric Row */}
          <div className="glass-card" style={{ padding: "24px", display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "28px", alignItems: "center" }}>
            {/* SVG Circular Dial */}
            <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
              <div style={{ position: "relative", width: "128px", height: "128px", flexShrink: 0 }}>
                <svg width="128" height="128" style={{ transform: "rotate(-90deg)" }}>
                  {/* Track ring */}
                  <circle
                    stroke="rgba(255, 255, 255, 0.03)"
                    fill="transparent"
                    strokeWidth={stroke}
                    r={normalizedRadius}
                    cx="64"
                    cy="64"
                  />
                  {/* Value progress ring */}
                  <circle
                    stroke={dialStatus.color}
                    fill="transparent"
                    strokeWidth={stroke}
                    strokeDasharray={circumference + " " + circumference}
                    style={{ strokeDashoffset, transition: "stroke-dashoffset 0.4s ease" }}
                    r={normalizedRadius}
                    cx="64"
                    cy="64"
                    strokeLinecap="round"
                  />
                </svg>
                {/* Center score readout */}
                <div style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  lineHeight: 1
                }}>
                  <span style={{ fontSize: "28px", fontWeight: "800", color: "#ffffff", fontFamily: "var(--font-display)" }}>
                    {rationalScore}
                  </span>
                  <span style={{ fontSize: "9px", color: "var(--text-muted)", fontWeight: "700", marginTop: "2px" }}>
                    INDEX
                  </span>
                </div>
              </div>

              <div>
                <span style={{ fontSize: "10px", fontWeight: "700", color: "var(--text-muted)", letterSpacing: "0.08em", fontFamily: "var(--font-mono)" }}>
                  DECISION ENGINE RATING
                </span>
                <h4 style={{ fontSize: "18px", fontWeight: "800", color: dialStatus.color, marginTop: "2px", fontFamily: "var(--font-display)" }}>
                  {dialStatus.text}
                </h4>
                <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px", lineHeight: "1.4" }}>
                  Tweak the weights of individual pros and cons below to dynamically recalculate your prospective rational index.
                </p>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", borderLeft: "1px solid var(--border-muted)", paddingLeft: "24px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "10px", fontWeight: "700", color: "var(--text-muted)", letterSpacing: "0.05em", fontFamily: "var(--font-mono)" }}>RISK ASSESSMENT</span>
                <div style={{ display: "inline-flex", alignSelf: "flex-start", padding: "4px 10px", borderRadius: "20px", background: "rgba(0,0,0,0.2)", border: `1px solid ${getRiskColor(analysis.riskRating)}`, color: getRiskColor(analysis.riskRating), fontSize: "10.5px", fontWeight: "800", letterSpacing: "0.05em" }}>
                  {analysis.riskRating.toUpperCase()} RISK
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "10px", fontWeight: "700", color: "var(--text-muted)", letterSpacing: "0.05em", fontFamily: "var(--font-mono)" }}>TIMELINE OUTLOOK</span>
                <span style={{ fontSize: "12px", color: "#ffffff", fontWeight: "600" }}>3M to 5Y Horizon</span>
              </div>
            </div>
          </div>

          {/* Pros & Cons Weighted Sliders Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "20px" }}>
            
            {/* Pros List with Sliders */}
            <div className="glass-card" style={{ padding: "24px", borderColor: "rgba(16, 185, 129, 0.15)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", borderBottom: "1px solid var(--border-muted)", paddingBottom: "10px", marginBottom: "16px" }}>
                <CheckCircle2 size={16} style={{ color: "var(--accent-success)" }} />
                <h4 style={{ fontSize: "14px", fontWeight: "700", color: "var(--accent-success)", fontFamily: "var(--font-display)" }}>
                  Pros & Opportunities
                </h4>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {analysis.pros.map((pro, idx) => (
                  <div key={idx} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                      <span style={{ color: "var(--accent-success)", marginTop: "2px" }}>•</span>
                      <span style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: "1.4" }}>{pro}</span>
                    </div>
                    {/* Weight slider */}
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", paddingLeft: "14px" }}>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={proWeights[idx] || 5}
                        onChange={(e) => {
                          const newWeights = [...proWeights]
                          newWeights[idx] = parseInt(e.target.value)
                          setProWeights(newWeights)
                        }}
                        className="weight-slider"
                        style={{ flex: 1 }}
                      />
                      <span style={{ fontSize: "10.5px", fontFamily: "var(--font-mono)", color: "var(--accent-success)", fontWeight: "700", width: "40px", textAlign: "right" }}>
                        W: {proWeights[idx] || 5}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cons List with Sliders */}
            <div className="glass-card" style={{ padding: "24px", borderColor: "rgba(244, 63, 94, 0.15)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", borderBottom: "1px solid var(--border-muted)", paddingBottom: "10px", marginBottom: "16px" }}>
                <XCircle size={16} style={{ color: "var(--accent-secondary)" }} />
                <h4 style={{ fontSize: "14px", fontWeight: "700", color: "var(--accent-secondary)", fontFamily: "var(--font-display)" }}>
                  Cons & Risks
                </h4>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {analysis.cons.map((con, idx) => (
                  <div key={idx} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                      <span style={{ color: "var(--accent-secondary)", marginTop: "2px" }}>•</span>
                      <span style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: "1.4" }}>{con}</span>
                    </div>
                    {/* Weight slider */}
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", paddingLeft: "14px" }}>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={conWeights[idx] || 5}
                        onChange={(e) => {
                          const newWeights = [...conWeights]
                          newWeights[idx] = parseInt(e.target.value)
                          setConWeights(newWeights)
                        }}
                        className="weight-slider"
                        style={{ flex: 1 }}
                      />
                      <span style={{ fontSize: "10.5px", fontFamily: "var(--font-mono)", color: "var(--accent-secondary)", fontWeight: "700", width: "40px", textAlign: "right" }}>
                        W: {conWeights[idx] || 5}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Timeline Board */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
            <div className="glass-card" style={{ padding: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", borderBottom: "1px solid var(--border-muted)", paddingBottom: "10px", marginBottom: "12px" }}>
                <Clock size={15} style={{ color: "var(--accent-info)" }} />
                <h4 style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
                  3-Month Outlook (Short-Term)
                </h4>
              </div>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: "1.6" }}>
                {analysis.shortTerm}
              </p>
            </div>

            <div className="glass-card" style={{ padding: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", borderBottom: "1px solid var(--border-muted)", paddingBottom: "10px", marginBottom: "12px" }}>
                <Clock size={15} style={{ color: "var(--accent-primary)" }} />
                <h4 style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
                  1 to 5 Year Outlook (Long-Term)
                </h4>
              </div>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: "1.6" }}>
                {analysis.longTerm}
              </p>
            </div>
          </div>

          {/* Actionable Next Step card */}
          <div className="glass-card" style={{ padding: "24px", background: "linear-gradient(135deg, var(--glow-color) 0%, rgba(0,0,0,0) 100%)", borderColor: "rgba(99,102,241,0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
              <HelpCircle size={16} style={{ color: "var(--accent-primary)" }} />
              <h4 style={{ fontSize: "14px", fontWeight: "700", color: "#ffffff", fontFamily: "var(--font-display)" }}>
                First Critical Validation Step
              </h4>
            </div>
            <p style={{ fontSize: "13.5px", color: "var(--text-secondary)", lineHeight: "1.6", fontWeight: "500" }}>
              {analysis.actionableStep}
            </p>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="glass-card" style={{ padding: "60px 20px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px" }}>
          <RefreshCw size={32} style={{ animation: "spin 1.5s linear infinite", color: "var(--accent-primary)" }} />
          <span style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
            Running rational prospective simulation on your choice...
          </span>
        </div>
      )}
    </div>
  )
}
