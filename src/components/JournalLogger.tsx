import { Calendar, Zap, Brain, Smile, Activity } from "lucide-react"
import { Page } from "../App"

interface JournalLoggerProps {
  page: Page
  onUpdatePage: (updatedPage: Page) => void
}

export default function JournalLogger({ page, onUpdatePage }: JournalLoggerProps) {
  // Grab metrics with defaults
  const metrics = page.metrics || { energy: 5, focus: 5, mood: 5 }

  const handleMetricChange = (metric: "energy" | "focus" | "mood", val: number) => {
    const updatedMetrics = { ...metrics, [metric]: val }
    onUpdatePage({ ...page, metrics: updatedMetrics })
  }

  // Formatting date string
  const createdDate = new Date(page.createdAt)
  const dayName = createdDate.toLocaleDateString(undefined, { weekday: 'long' })
  const monthName = createdDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  const timeName = createdDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

  // Cognitive Score Dial
  const cognitiveScore = Math.round(((metrics.energy + metrics.focus + metrics.mood) / 30) * 100)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      
      {/* Workspace Hub card */}
      <div className="glass-card" style={{ padding: "24px", display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "24px", alignItems: "center" }}>
        <div>
          <input
            type="text"
            value={page.title}
            onChange={(e) => onUpdatePage({ ...page, title: e.target.value })}
            style={{ 
              background: "transparent", 
              border: "none", 
              fontSize: "20px", 
              fontWeight: "800", 
              color: "#ffffff", 
              outline: "none",
              fontFamily: "var(--font-display)",
              width: "100%"
            }}
            placeholder="Untitled Journal Log"
          />
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px" }}>
            <Calendar size={13} style={{ color: "var(--accent-secondary)" }} />
            <span style={{ fontSize: "11px", color: "var(--text-secondary)", fontFamily: "var(--font-mono)", fontWeight: "600" }}>
              {dayName.toUpperCase()}, {monthName.toUpperCase()} AT {timeName}
            </span>
          </div>
        </div>

        {/* Cognitive Index Score Badge */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px", justifyContent: "flex-end", borderLeft: "1px solid var(--border-muted)", paddingLeft: "24px" }}>
          <div style={{ position: "relative", width: "56px", height: "56px", flexShrink: 0 }}>
            <svg width="56" height="56" style={{ transform: "rotate(-90deg)" }}>
              <circle stroke="rgba(255,255,255,0.03)" fill="transparent" strokeWidth="4" r="24" cx="28" cy="28" />
              <circle stroke="var(--accent-secondary)" fill="transparent" strokeWidth="4" r="24" cx="28" cy="28"
                strokeDasharray={`${2 * Math.PI * 24}`}
                strokeDashoffset={`${2 * Math.PI * 24 * (1 - cognitiveScore / 100)}`}
                strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 0.4s ease" }}
              />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12.5px", fontWeight: "800", color: "#ffffff", fontFamily: "var(--font-mono)" }}>
              {cognitiveScore}%
            </div>
          </div>
          <div>
            <span style={{ fontSize: "9px", fontWeight: "700", color: "var(--text-muted)", letterSpacing: "0.05em", fontFamily: "var(--font-mono)" }}>
              COGNITIVE WELLNESS INDEX
            </span>
            <h4 style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-primary)", marginTop: "2px" }}>
              {cognitiveScore > 75 ? "Optimal Focus Resonance" : cognitiveScore > 45 ? "Standard Flow Balance" : "Cognitive Friction High"}
            </h4>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "24px", alignItems: "start" }}>
        
        {/* Metric Ranges Panel */}
        <div className="glass-card" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
          <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", letterSpacing: "0.08em", fontFamily: "var(--font-mono)", borderBottom: "1px solid var(--border-muted)", paddingBottom: "8px" }}>
            DAILY RESIDUE METRICS
          </span>

          {/* Energy Slider */}
          <div className="journal-metric-container">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "12.5px", color: "#ffffff", fontWeight: "600", display: "flex", alignItems: "center", gap: "8px" }}>
                <Zap size={14} style={{ color: "var(--accent-warning)" }} />
                <span>Physical Energy</span>
              </span>
              <span style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--accent-warning)", fontWeight: "700" }}>
                {metrics.energy} / 10
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={metrics.energy}
              onChange={(e) => handleMetricChange("energy", parseInt(e.target.value))}
              className="weight-slider"
              style={{ width: "100%", marginTop: "4px" }}
            />
          </div>

          {/* Focus Slider */}
          <div className="journal-metric-container">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "12.5px", color: "#ffffff", fontWeight: "600", display: "flex", alignItems: "center", gap: "8px" }}>
                <Brain size={14} style={{ color: "var(--accent-primary)" }} />
                <span>Cognitive Focus</span>
              </span>
              <span style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--accent-primary)", fontWeight: "700" }}>
                {metrics.focus} / 10
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={metrics.focus}
              onChange={(e) => handleMetricChange("focus", parseInt(e.target.value))}
              className="weight-slider"
              style={{ width: "100%", marginTop: "4px" }}
            />
          </div>

          {/* Mood Slider */}
          <div className="journal-metric-container">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "12.5px", color: "#ffffff", fontWeight: "600", display: "flex", alignItems: "center", gap: "8px" }}>
                <Smile size={14} style={{ color: "var(--accent-secondary)" }} />
                <span>Resonance / Mood</span>
              </span>
              <span style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--accent-secondary)", fontWeight: "700" }}>
                {metrics.mood} / 10
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={metrics.mood}
              onChange={(e) => handleMetricChange("mood", parseInt(e.target.value))}
              className="weight-slider"
              style={{ width: "100%", marginTop: "4px" }}
            />
          </div>
        </div>

        {/* Structured Writing Area */}
        <div className="glass-card" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "14px", gridColumn: "span 1" }}>
          <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-secondary)", fontFamily: "var(--font-display)", display: "flex", alignItems: "center", gap: "6px" }}>
            <Activity size={14} style={{ color: "var(--accent-secondary)" }} />
            <span>DAILY THOUGHTS & LOGS</span>
          </label>
          <textarea
            value={page.content}
            onChange={(e) => onUpdatePage({ ...page, content: e.target.value })}
            placeholder="Record your daily learnings, focus wins, and reflection insights..."
            className="input-premium"
            style={{
              width: "100%",
              height: "230px",
              background: "rgba(0,0,0,0.25)",
              border: "1px solid var(--border-muted)",
              borderRadius: "var(--radius-sm)",
              padding: "12px",
              fontSize: "13.5px",
              lineHeight: "1.6",
              resize: "none",
              outline: "none"
            }}
          />
        </div>

      </div>

    </div>
  )
}
