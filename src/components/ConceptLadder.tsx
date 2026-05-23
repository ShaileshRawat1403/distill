import { useState, useEffect } from "react"
import { Sparkles, Brain, Check, RefreshCw, Layers, Volume2, VolumeX } from "lucide-react"
import { executePrompt } from "../utils/ai"

interface ConceptLadderProps {
  provider: string
  model: string
  apiKeys: {
    openai: string
    anthropic: string
    gemini: string
  }
}

interface LadderSteps {
  level1: string
  level2: string
  level3: string
  level4: string
  level5: string
}

export default function ConceptLadder({ provider, model, apiKeys }: ConceptLadderProps) {
  const [concept, setConcept] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  
  const [steps, setSteps] = useState<LadderSteps | null>(null)
  const [activeLevel, setActiveLevel] = useState<1 | 2 | 3 | 4 | 5>(1)
  
  // TTS State
  const [isPlayingSpeech, setIsPlayingSpeech] = useState(false)

  // Stop speech synthesis on change of level or unmount
  useEffect(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
    setIsPlayingSpeech(false)
  }, [activeLevel])

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  const handleGenerate = async () => {
    if (!concept.trim()) return
    setIsLoading(true)
    setError("")
    setSteps(null)
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
    setIsPlayingSpeech(false)

    const prompt = `Explain the following concept: "${concept}"

Please provide exactly 5 explanations at 5 different cognitive levels. Format your output strictly as a JSON object, with exactly these keys: "level1", "level2", "level3", "level4", "level5". Do not include any other markdown code blocks or text around the JSON.

Descriptions of the levels:
- "level1": Explain Like I'm 5 (Simple words, basic definitions, easy for a child)
- "level2": High School Student (Relatable context, teenager level, standard vocabulary)
- "level3": College Student (Academic, thorough definitions, suitable for undergrad study)
- "level4": Subject Matter Expert (Technical detail, professional precision, expert terms)
- "level5": Creative Analogy (A vivid metaphor or analogy to solidify intuitive understanding)`

    const systemPrompt = `You are a world-class cognitive science educator. You explain complex topics simply, progressively, and creatively. You must format your final response strictly as a parseable JSON object with keys "level1", "level2", "level3", "level4", "level5". Do not wrap in markdown \`\`\`json blocks.`

    try {
      const result = await executePrompt({
        provider,
        model,
        prompt,
        systemPrompt,
        apiKeys,
      })
      
      // Clean up markdown markers if the model included them anyway
      let cleanJson = result.trim()
      if (cleanJson.startsWith("```json")) {
        cleanJson = cleanJson.slice(7)
      }
      if (cleanJson.endsWith("```")) {
        cleanJson = cleanJson.slice(0, -3)
      }
      
      const parsed = JSON.parse(cleanJson.trim()) as LadderSteps
      setSteps(parsed)
      setActiveLevel(1)
    } catch (err: any) {
      setError(err.message || "Failed to generate ladder explanations. Make sure to use a model that supports clean JSON output.")
    } finally {
      setIsLoading(false)
    }
  }

  const speakActiveExplanation = () => {
    if (!steps) return
    
    if (typeof window === "undefined" || !window.speechSynthesis) {
      alert("Text-to-Speech is not supported in your browser.")
      return
    }
    
    if (isPlayingSpeech) {
      window.speechSynthesis.cancel()
      setIsPlayingSpeech(false)
      return
    }

    const textToSpeak = 
      activeLevel === 1 ? steps.level1 :
      activeLevel === 2 ? steps.level2 :
      activeLevel === 3 ? steps.level3 :
      activeLevel === 4 ? steps.level4 :
      steps.level5

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(textToSpeak)
    utterance.onend = () => setIsPlayingSpeech(false)
    utterance.onerror = () => setIsPlayingSpeech(false)
    
    setIsPlayingSpeech(true)
    window.speechSynthesis.speak(utterance)
  }

  const levelLabels = {
    1: "🧒 Child (ELI5)",
    2: "🎒 Teenager (High School)",
    3: "🎓 Scholar (College)",
    4: "💼 Specialist (Expert)",
    5: "💡 Analogy (Creative)"
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{ background: "rgba(99, 102, 241, 0.1)", border: "1px solid var(--border-muted)", padding: "10px", borderRadius: "var(--radius-sm)" }}>
          <Brain size={22} className="gradient-accent-text" />
        </div>
        <div>
          <h2 style={{ fontSize: "20px", fontWeight: "700", fontFamily: "var(--font-display)" }}>
            Concept Ladder
          </h2>
          <p style={{ fontSize: "14px", color: "var(--text-muted)" }}>
            Deconstruct complex terms into five progressive stages of explanation from ELI5 to Expert.
          </p>
        </div>
      </div>

      <div className="glass-card" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
        <label style={{ fontSize: "12.5px", fontWeight: "600", color: "var(--text-secondary)", fontFamily: "var(--font-display)" }}>
          What concept or topic do you want to learn?
        </label>
        <div style={{ display: "flex", gap: "12px" }}>
          <input
            type="text"
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            placeholder="e.g. Quantum Entanglement, WebSockets, Inflation, Docker..."
            className="input-premium"
            style={{ flex: 1 }}
            disabled={isLoading}
          />
          <button
            onClick={handleGenerate}
            disabled={isLoading || !concept.trim()}
            className="btn-premium"
            style={{ padding: "10px 24px", minWidth: "140px" }}
          >
            {isLoading ? (
              <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} />
            ) : (
              <>
                <Sparkles size={14} /> Deconstruct
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

      {steps && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "28px", alignItems: "start" }}>
          {/* Vertical Connective Ladder Navigation */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0px", position: "relative" }}>
            <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", letterSpacing: "0.08em", paddingLeft: "26px", marginBottom: "12px", fontFamily: "var(--font-mono)" }}>
              COGNITIVE PATHWAY
            </span>
            
            {/* Sleek dynamic vertical timeline guide line */}
            <div style={{
              position: "absolute",
              left: "14px",
              top: "38px",
              bottom: "28px",
              width: "2px",
              background: "linear-gradient(to bottom, var(--accent-primary) 0%, var(--accent-secondary) 100%)",
              zIndex: 1,
              opacity: 0.25
            }}></div>

            {(Object.keys(levelLabels) as unknown as Array<1 | 2 | 3 | 4 | 5>).reverse().map((lvl) => {
              const isActive = activeLevel === lvl;
              return (
                <div key={lvl} style={{ display: "flex", alignItems: "center", position: "relative", zIndex: 2 }}>
                  {/* Timeline point node */}
                  <div style={{
                    width: "10px",
                    height: "10px",
                    borderRadius: "50%",
                    background: isActive ? "var(--accent-primary)" : "var(--bg-secondary)",
                    border: `2px solid ${isActive ? "var(--text-primary)" : "var(--border-muted)"}`,
                    marginRight: "16px",
                    marginLeft: "10px",
                    boxShadow: isActive ? "0 0 10px var(--accent-primary)" : "none",
                    transition: "var(--transition-smooth)"
                  }}></div>

                  <button
                    onClick={() => setActiveLevel(lvl)}
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "12px 16px",
                      margin: "6px 0",
                      background: isActive ? "rgba(255, 255, 255, 0.035)" : "transparent",
                      border: `1px solid ${isActive ? "var(--border-active)" : "transparent"}`,
                      borderRadius: "var(--radius-sm)",
                      color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                      cursor: "pointer",
                      fontSize: "13px",
                      fontWeight: isActive ? "600" : "500",
                      textAlign: "left",
                      transition: "var(--transition-smooth)"
                    }}
                    className={isActive ? "ladder-rung-active" : "btn-secondary"}
                  >
                    <Layers size={13} style={{ color: isActive ? "var(--accent-secondary)" : "var(--text-muted)" }} />
                    <span>{levelLabels[lvl]}</span>
                  </button>
                </div>
              );
            })}
          </div>

          {/* Explanation Display Panel */}
          <div className="glass-card" style={{ padding: "30px", minHeight: "310px", display: "flex", flexDirection: "column", justifyContent: "space-between", gridColumn: "span 2" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border-muted)", paddingBottom: "12px" }}>
                <span className="gradient-accent-text" style={{ fontSize: "12px", fontWeight: "700", letterSpacing: "0.08em", fontFamily: "var(--font-mono)" }}>
                  EXPLANATION LEVEL {activeLevel}
                </span>

                <div style={{ display: "flex", gap: "10px" }}>
                  {/* TTS Voice Trigger */}
                  <button
                    onClick={speakActiveExplanation}
                    className="btn-secondary"
                    style={{
                      padding: "6px 12px",
                      fontSize: "11.5px",
                      borderRadius: "6px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                    title={isPlayingSpeech ? "Stop Audio" : "Listen to Explanation"}
                  >
                    {isPlayingSpeech ? (
                      <>
                        <VolumeX size={13} style={{ color: "var(--accent-danger)" }} />
                        <span style={{ color: "var(--accent-danger)" }}>Stop Audio</span>
                      </>
                    ) : (
                      <>
                        <Volume2 size={13} style={{ color: "var(--accent-secondary)" }} />
                        <span>Speak Explanation</span>
                      </>
                    )}
                  </button>

                  <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--accent-success)", fontWeight: "500" }}>
                    <Check size={14} /> Active
                  </span>
                </div>
              </div>

              <p style={{ fontSize: "14.5px", lineHeight: "1.8", color: "var(--text-primary)", whiteSpace: "pre-wrap" }}>
                {activeLevel === 1 && steps.level1}
                {activeLevel === 2 && steps.level2}
                {activeLevel === 3 && steps.level3}
                {activeLevel === 4 && steps.level4}
                {activeLevel === 5 && steps.level5}
              </p>
            </div>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="glass-card" style={{ padding: "60px 20px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px" }}>
          <RefreshCw size={32} style={{ animation: "spin 1.5s linear infinite", color: "var(--accent-primary)" }} />
          <span style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
            Building cognitive learning ladder for "{concept}"...
          </span>
        </div>
      )}
    </div>
  )
}
