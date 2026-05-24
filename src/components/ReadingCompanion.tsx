import { useState, useEffect } from "react"
import { BookOpen, Check, Copy, FileText, Compass, ListCollapse, RefreshCw, HelpCircle, Download } from "lucide-react"
import { executePrompt, APIKeys } from "../utils/ai"

interface ReadingCompanionProps {
  provider: string
  model: string
  apiKeys: APIKeys
}

interface ReadingAnalysis {
  summary: string
  concepts: { term: string; definition: string }[]
  thesis: string
  discussionPrompts: string[]
}

type CompanionSubTab = "summary" | "thesis" | "concepts" | "reflection"

export default function ReadingCompanion({ provider, model, apiKeys }: ReadingCompanionProps) {
  const [text, setText] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [analysis, setAnalysis] = useState<ReadingAnalysis | null>(null)
  
  // Custom Study Guide states
  const [activeSubTab, setActiveSubTab] = useState<CompanionSubTab>("summary")
  const [flippedCardIdx, setFlippedCardIdx] = useState<number | null>(null)
  const [reflectionAnswers, setReflectionAnswers] = useState<string[]>(["", "", ""])
  
  const [copied, setCopied] = useState(false)

  // Reset states when analysis changes
  useEffect(() => {
    if (analysis) {
      setActiveSubTab("summary")
      setFlippedCardIdx(null)
      setReflectionAnswers(new Array(analysis.discussionPrompts.length).fill(""))
    }
  }, [analysis])

  const handleAnalyze = async () => {
    if (!text.trim()) return
    setIsLoading(true)
    setError("")
    setAnalysis(null)

    const prompt = `Analyze the following text or document:
"${text}"

Please format your response strictly as a JSON object with exactly these keys: "summary", "concepts", "thesis", "discussionPrompts".

Key descriptions:
- "summary": A high-impact 3-sentence executive summary
- "concepts": An array of objects, each with "term" and "definition", outlining the major ideas or terms introduced in the text
- "thesis": A detailed statement of the core argument, driving thesis, or main purpose of the text
- "discussionPrompts": An array of 3 thought-provoking reflection questions for further learning`

    const systemPrompt = `You are a world-class literary researcher, scholar, and critical reader. You extract underlying arguments, vocabulary, and thesis statements with exceptional depth. You must format your final response strictly as a parseable JSON object.`

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

      const parsed = JSON.parse(cleanJson.trim()) as ReadingAnalysis
      setAnalysis(parsed)
    } catch (err: any) {
      setError(err.message || "Failed to analyze document. Please check the network and ensure the model supports parseable JSON.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopySummary = () => {
    if (!analysis) return
    navigator.clipboard.writeText(analysis.summary)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // File Download logic
  const handleDownloadWorkbook = () => {
    if (!analysis) return
    const content = `=========================================
DISTILL INTELLECTUAL WORKSPACE: STUDY GUIDE
=========================================

1. EXECUTIVE SUMMARY:
-----------------------------------------
${analysis.summary}

2. ARGUMENTATIVE THESIS:
-----------------------------------------
${analysis.thesis}

3. CONCEPT CARD GLOSSARY:
-----------------------------------------
${analysis.concepts.map((c, i) => `${i + 1}. [${c.term}] - ${c.definition}`).join("\n")}

4. REFLECTIONS & DIALOGUE WORKBOOK:
-----------------------------------------
${analysis.discussionPrompts.map((p, i) => `Q: ${p}\nMy Thoughts: ${reflectionAnswers[i] || "No response recorded."}`).join("\n\n")}

=========================================
Generated via Distill AI Client. All execution local.`

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `Distill_Study_Guide_${Date.now().toString().slice(-6)}.txt`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{ background: "rgba(99, 102, 241, 0.1)", border: "1px solid var(--border-muted)", padding: "10px", borderRadius: "var(--radius-sm)" }}>
          <BookOpen size={22} className="gradient-accent-text" />
        </div>
        <div>
          <h2 style={{ fontSize: "20px", fontWeight: "700", fontFamily: "var(--font-display)" }}>
            Reading Companion
          </h2>
          <p style={{ fontSize: "14px", color: "var(--text-muted)" }}>
            Deconstruct complex papers, articles, or chapters into structured summaries, key themes, and critical analyses.
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: "24px" }}>
        {/* Input panel */}
        <div className="glass-card" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "18px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "12.5px", fontWeight: "600", color: "var(--text-secondary)", fontFamily: "var(--font-display)" }}>
              Paste Document or Chapter
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste the chapter, news article, blog post, or raw notes you want to break down..."
              style={{
                width: "100%",
                height: "360px",
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

          <button
            onClick={handleAnalyze}
            disabled={isLoading || !text.trim()}
            className="btn-premium"
            style={{ width: "100%" }}
          >
            {isLoading ? (
              <>
                <RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} /> Generating Analysis...
              </>
            ) : (
              <>
                <BookOpen size={16} /> Analyze Document
              </>
            )}
          </button>
        </div>

        {/* Output Panel */}
        <div className="glass-card" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "18px", minHeight: "440px", justifyContent: "space-between" }}>
          {error && (
            <div style={{ background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.2)", padding: "12px", borderRadius: "var(--radius-sm)", color: "var(--accent-secondary)", fontSize: "13px" }}>
              {error}
            </div>
          )}

          {analysis ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px", height: "100%" }}>
              
              {/* Study Desk Tab Selector */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", background: "rgba(255,255,255,0.02)", padding: "3px", borderRadius: "8px", border: "1px solid var(--border-muted)" }}>
                {(["summary", "thesis", "concepts", "reflection"] as CompanionSubTab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveSubTab(tab)}
                    style={{
                      flex: 1,
                      padding: "6px 12px",
                      fontSize: "11px",
                      background: activeSubTab === tab ? "rgba(255, 255, 255, 0.05)" : "transparent",
                      border: "none",
                      borderRadius: "6px",
                      color: activeSubTab === tab ? "#ffffff" : "var(--text-secondary)",
                      cursor: "pointer",
                      fontWeight: "700",
                      textAlign: "center",
                      fontFamily: "var(--font-display)",
                      transition: "var(--transition-smooth)"
                    }}
                  >
                    {tab.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Sub-Tab Viewports */}
              <div style={{ flex: 1, height: "310px", overflowY: "auto", paddingRight: "4px" }}>
                
                {/* Executive Summary Tab */}
                {activeSubTab === "summary" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border-muted)", paddingBottom: "8px" }}>
                      <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--accent-primary)", display: "flex", alignItems: "center", gap: "6px", fontFamily: "var(--font-mono)" }}>
                        <FileText size={14} /> DECONSTRUCTED SYNOPSIS
                      </span>
                      <button
                        onClick={handleCopySummary}
                        className="btn-secondary"
                        style={{ padding: "4px 8px", fontSize: "10.5px", display: "inline-flex", alignItems: "center", gap: "4px", borderRadius: "4px" }}
                      >
                        {copied ? <Check size={12} style={{ color: "var(--accent-success)" }} /> : <Copy size={12} />}
                        {copied ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <p style={{ fontSize: "13.5px", color: "var(--text-primary)", lineHeight: "1.7", whiteSpace: "pre-wrap" }}>
                      {analysis.summary}
                    </p>
                  </div>
                )}

                {/* Core Thesis Tab */}
                {activeSubTab === "thesis" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div style={{ borderBottom: "1px solid var(--border-muted)", paddingBottom: "8px" }}>
                      <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--accent-secondary)", display: "flex", alignItems: "center", gap: "6px", fontFamily: "var(--font-mono)" }}>
                        <Compass size={14} /> CENTRAL INTELLECT THESIS
                      </span>
                    </div>
                    <p style={{ fontSize: "13.5px", color: "var(--text-primary)", lineHeight: "1.7", whiteSpace: "pre-wrap" }}>
                      {analysis.thesis}
                    </p>
                  </div>
                )}

                {/* Interactive Vocabulary Flip Flashcards Tab */}
                {activeSubTab === "concepts" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div style={{ borderBottom: "1px solid var(--border-muted)", paddingBottom: "8px", marginBottom: "4px" }}>
                      <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--accent-info)", display: "flex", alignItems: "center", gap: "6px", fontFamily: "var(--font-mono)" }}>
                        <ListCollapse size={14} /> CONCEPT GLOSSARY MATRIX (TAP TO FLIP)
                      </span>
                    </div>
                    
                    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "12px" }}>
                      {analysis.concepts.map((concept, idx) => {
                        const isFlipped = flippedCardIdx === idx
                        return (
                          <div 
                            key={idx} 
                            onClick={() => setFlippedCardIdx(isFlipped ? null : idx)}
                            style={{ 
                              height: "76px", 
                              perspective: "1000px", 
                              cursor: "pointer" 
                            }}
                          >
                            <div className={`flashcard-inner ${isFlipped ? "flipped" : ""}`}>
                              
                              {/* Front Face: The Term */}
                              <div 
                                className="flashcard-face glass-card"
                                style={{ 
                                  position: "absolute",
                                  display: "flex", 
                                  alignItems: "center", 
                                  padding: "0 18px", 
                                  background: "rgba(255,255,255,0.02)",
                                  borderColor: "var(--border-muted)"
                                }}
                              >
                                <strong style={{ fontSize: "13.5px", color: "var(--accent-info)", fontFamily: "var(--font-display)" }}>
                                  {concept.term}
                                </strong>
                                <span style={{ marginLeft: "auto", fontSize: "9px", color: "var(--text-muted)", fontWeight: "600", letterSpacing: "0.05em" }}>
                                  REVEAL DEF
                                </span>
                              </div>

                              {/* Back Face: Definition */}
                              <div 
                                className="flashcard-face flashcard-back glass-card"
                                style={{ 
                                  position: "absolute",
                                  display: "flex", 
                                  alignItems: "center", 
                                  padding: "0 18px", 
                                  background: "rgba(99, 102, 241, 0.05)",
                                  borderColor: "rgba(99, 102, 241, 0.2)"
                                }}
                              >
                                <p style={{ fontSize: "12px", color: "var(--text-primary)", lineHeight: "1.4" }}>
                                  {concept.definition}
                                </p>
                              </div>

                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Reflection Dialogue Desk */}
                {activeSubTab === "reflection" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div style={{ borderBottom: "1px solid var(--border-muted)", paddingBottom: "8px" }}>
                      <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--accent-warning)", display: "flex", alignItems: "center", gap: "6px", fontFamily: "var(--font-mono)" }}>
                        💡 CRITICAL DIALOGUE WORKBOOK
                      </span>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                      {analysis.discussionPrompts.map((prompt, idx) => (
                        <div key={idx} style={{ display: "flex", flexDirection: "column", gap: "8px", background: "rgba(255,255,255,0.01)", border: "1px solid var(--border-muted)", padding: "14px", borderRadius: "var(--radius-sm)" }}>
                          <span style={{ fontSize: "12.5px", color: "var(--text-primary)", fontWeight: "600", display: "flex", gap: "6px" }}>
                            <HelpCircle size={14} style={{ color: "var(--accent-warning)", flexShrink: 0, marginTop: "2px" }} />
                            <span>{prompt}</span>
                          </span>
                          <textarea
                            value={reflectionAnswers[idx] || ""}
                            onChange={(e) => {
                              const newAns = [...reflectionAnswers]
                              newAns[idx] = e.target.value
                              setReflectionAnswers(newAns)
                            }}
                            placeholder="Type your notes or reflection arguments here..."
                            rows={3}
                            className="input-premium"
                            style={{ 
                              background: "rgba(0,0,0,0.2)",
                              border: "1px solid var(--border-muted)", 
                              borderRadius: "6px",
                              fontSize: "12px",
                              resize: "none",
                              padding: "8px 10px",
                              outline: "none"
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>

              {/* Action buttons footer */}
              <div style={{ display: "flex", justifyContent: "flex-end", borderTop: "1px solid var(--border-muted)", paddingTop: "14px", marginTop: "4px" }}>
                <button
                  onClick={handleDownloadWorkbook}
                  className="btn-premium"
                  style={{ fontSize: "12.5px", padding: "8px 16px", display: "flex", alignItems: "center", gap: "6px" }}
                >
                  <Download size={13} />
                  <span>Download Study Guide</span>
                </button>
              </div>

            </div>
          ) : !isLoading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", minHeight: "360px", color: "var(--text-muted)", gap: "10px" }}>
              <BookOpen size={24} style={{ opacity: 0.5, color: "var(--accent-primary)", filter: "drop-shadow(0 0 4px var(--accent-primary))" }} />
              <span style={{ fontSize: "13px", fontWeight: "500" }}>Input your document on the left and click 'Analyze' to begin.</span>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", minHeight: "360px", color: "var(--text-muted)", gap: "16px" }}>
              <RefreshCw size={28} style={{ animation: "spin 1.5s linear infinite", color: "var(--accent-primary)" }} />
              <span style={{ fontSize: "13px", fontWeight: "500", fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>Deconstructing arguments and building study guide...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
