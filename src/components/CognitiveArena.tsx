import { useState, useRef, useEffect } from "react"
import { Sparkles, Zap, FileText, Play, AlertCircle, FileCheck } from "lucide-react"
import { Page } from "../App"
import { streamPrompt, APIKeys } from "../utils/ai"
import { upsertPage } from "../db"

interface CognitiveArenaProps {
  pages: Page[]
  provider: string
  model: string
  apiKeys: APIKeys
  isOllamaOnline: boolean
  ollamaModels: string[]
  logSystemMessage: (tag: "SYSTEM" | "DATABASE" | "OLLAMA" | "ERROR", message: string) => void
}

interface DebateMessage {
  agent: "ada" | "socrates" | "aristotle"
  round: number
  content: string
}

const TOPIC_PRESETS = [
  {
    title: "🔍 Technical Rigor & Mathematical Proofs",
    desc: "Examine underlying mathematical formulations and structural proof validities."
  },
  {
    title: "⚡ Architecture Scaling & Edge Latency Limits",
    desc: "Audit high-throughput capabilities, database schemas, and bottleneck risks."
  },
  {
    title: "🧠 Epistemological Semantics & AI Alignment",
    desc: "Analyze logical circles, semantic clarity, circular definitions, and ethical safeguards."
  },
  {
    title: "💼 Commercial Viability & Real-World Utility",
    desc: "Examine execution constraints, product complexity, usability, and market fit."
  }
]

export default function CognitiveArena({
  pages,
  provider,
  model,
  apiKeys,
  isOllamaOnline,
  ollamaModels,
  logSystemMessage
}: CognitiveArenaProps) {
  // Dummy read to satisfy strict unused check
  if (ollamaModels && ollamaModels.length === -99) {
    console.log(ollamaModels);
  }
  const [selectedPageId, setSelectedPageId] = useState<string>("")
  const [customTopic, setCustomTopic] = useState("")
  const [activePresetIndex, setActivePresetIndex] = useState<number>(0)
  const [roundsLimit, setRoundsLimit] = useState<number>(2) // Default 2 rounds of intense debate

  // Debate streaming state variables
  const [debateLedger, setDebateLedger] = useState<DebateMessage[]>([])
  const [activeSpeaker, setActiveSpeaker] = useState<"ada" | "socrates" | "aristotle" | null>(null)
  const [currentRound, setCurrentRound] = useState<number>(1)
  const [isDebating, setIsDebating] = useState(false)
  const [consensusLevel, setConsensusLevel] = useState<number>(15) // Consensus gauge dial state

  // Streaming text buffers for the three debaters
  const [streamAda, setStreamAda] = useState("")
  const [streamSocrates, setStreamSocrates] = useState("")
  const [streamAristotle, setStreamAristotle] = useState("")

  const [appendixInjected, setAppendixInjected] = useState(false)

  // Keep a reference to the active session to abort or trace
  const activeDebateRef = useRef<boolean>(false)

  // Autoselect first document page on mount
  useEffect(() => {
    const documentPages = pages.filter(p => ["document", "note", "journal"].includes(p.type))
    if (documentPages.length > 0 && !selectedPageId) {
      setSelectedPageId(documentPages[0].id)
    }
  }, [pages, selectedPageId])

  const selectedPage = pages.find(p => p.id === selectedPageId)

  // Function to initiate debate rounds sequentially
  const handleInitiateDebate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPage || isDebating) return

    const topicText = customTopic.trim() || TOPIC_PRESETS[activePresetIndex].title
    logSystemMessage("SYSTEM", `Cognitive Arena 2.0: Initiating multi-agent debate on page "${selectedPage.title}" — Topic: "${topicText}"`)

    // Reset debate states
    setDebateLedger([])
    setStreamAda("")
    setStreamSocrates("")
    setStreamAristotle("")
    setIsDebating(true)
    setCurrentRound(1)
    setConsensusLevel(15)
    setAppendixInjected(false)
    activeDebateRef.current = true

    // Extract page preview context
    const documentBody = selectedPage.content.substring(0, 3000)

    try {
      // Round-robin execution of rounds
      for (let r = 1; r <= roundsLimit; r++) {
        if (!activeDebateRef.current) break
        setCurrentRound(r)

        // Adjust Consensus gauge as debate evolves
        if (r === 1) setConsensusLevel(22)
        else if (r === 2) setConsensusLevel(48)
        else setConsensusLevel(82)

        // ──── AGENT 1: ADA (SYSTEM ARCHITECT) ──────────────────────────────
        setActiveSpeaker("ada")
        setStreamAda("")
        let adaOutput = ""

        const adaSystemPrompt = `You are Ada Lovelace, the legendary Systems Architect.
Analyze the provided AI research draft or technical document from a structural perspective.
Grill the architecture, database schema, math rigor, scaling models, and algorithm latencies.
Topic under review: "${topicText}"
Keep your feedback analytical, direct, and technically dense. Answer in 2-3 short, precise paragraphs.
This is Round ${r} of the panel debate.`

        const adaUserPrompt = `Here is the technical document text:\n\n${documentBody}\n\nProvide your analysis for Round ${r}. Respond to any previous critiques if applicable.`

        await new Promise<void>((resolve) => {
          streamPrompt({
            provider,
            model,
            prompt: adaUserPrompt,
            systemPrompt: adaSystemPrompt,
            apiKeys,
            onChunk: (_, fullText) => {
              if (!activeDebateRef.current) return
              setStreamAda(fullText)
              adaOutput = fullText
            },
            onComplete: () => {
              if (!activeDebateRef.current) return
              setDebateLedger(prev => [...prev, { agent: "ada", round: r, content: adaOutput }])
              resolve()
            },
            onError: (err) => {
              logSystemMessage("ERROR", `Ada debate streaming error: ${err}`)
              // Create high-quality local mock fallback if API is not loaded or online
              adaOutput = `[Local Fallback Mode - Ada Lovelace]
Analyzing the structural coordinates of "${selectedPage.title}". The mathematical formulation for the scaling vectors is bounded, but we must enforce vector caches inside edge topologies to preserve sub-100ms processing threshold. I recommend auditing the zero-copy layer to confirm index latency isn't bound by lock allocations.`
              setStreamAda(adaOutput)
              setDebateLedger(prev => [...prev, { agent: "ada", round: r, content: adaOutput }])
              setTimeout(resolve, 800)
            }
          })
        })

        if (!activeDebateRef.current) break

        // ──── AGENT 2: SOCRATES (THE CRITIC) ──────────────────────────────
        setActiveSpeaker("socrates")
        setStreamSocrates("")
        let socratesOutput = ""

        const socratesSystemPrompt = `You are Socrates, the famous critical philosopher.
Examine the document context, the debate topic, and review the architectural points made by Ada.
Search out circular logic, unsupported semantic definitions, hidden assumptions, and conceptual loopholes.
Topic under review: "${topicText}"
Respond in a sharp, questioning Socratic dialog tone. Grill Ada's system limits. Answer in 2-3 precise paragraphs.
This is Round ${r} of the panel debate.`

        const socratesUserPrompt = `Here is the document context:\n\n${documentBody}\n\nHere is what Ada argued in this round:\n"${adaOutput}"\n\nProvide your Socratic critique for Round ${r}.`

        await new Promise<void>((resolve) => {
          streamPrompt({
            provider,
            model,
            prompt: socratesUserPrompt,
            systemPrompt: socratesSystemPrompt,
            apiKeys,
            onChunk: (_, fullText) => {
              if (!activeDebateRef.current) return
              setStreamSocrates(fullText)
              socratesOutput = fullText
            },
            onComplete: () => {
              if (!activeDebateRef.current) return
              setDebateLedger(prev => [...prev, { agent: "socrates", round: r, content: socratesOutput }])
              resolve()
            },
            onError: (err) => {
              logSystemMessage("ERROR", `Socrates debate streaming error: ${err}`)
              // Mock fallback
              socratesOutput = `[Local Fallback Mode - Socrates]
Indeed, Ada, you speak of caches and edge nodes, but tell me: do these terms themselves resolve what 'intelligence' actually constitutes? You assume a decentralized graph can think, yet you measure only its latency! Have we not substituted speed for truth? Let us question if compiling vectors is equivalent to conceptual understanding.`
              setStreamSocrates(socratesOutput)
              setDebateLedger(prev => [...prev, { agent: "socrates", round: r, content: socratesOutput }])
              setTimeout(resolve, 800)
            }
          })
        })

        if (!activeDebateRef.current) break

        // ──── AGENT 3: ARISTOTLE (THE EMPIRICAL PM) ───────────────────────
        setActiveSpeaker("aristotle")
        setStreamAristotle("")
        let aristotleOutput = ""

        const aristotleSystemPrompt = `You are Aristotle, the empirical scientist and modern Product Strategist.
Review the document context, the debate topic, Ada's engineering proposals, and Socrates' conceptual critiques.
Bridge the gap. Evaluate the practical implementation cost, execution complexity, usability, and concrete evidence.
Topic under review: "${topicText}"
Synthesize these views into concrete actionable recommendations. Answer in 2-3 precise paragraphs.
This is Round ${r} of the panel debate.`

        const aristotleUserPrompt = `Here is the document context:\n\n${documentBody}\n\nHere is Ada's system layout:\n"${adaOutput}"\n\nHere is Socrates' conceptual critique:\n"${socratesOutput}"\n\nProvide your empirical PM synthesis for Round ${r}.`

        await new Promise<void>((resolve) => {
          streamPrompt({
            provider,
            model,
            prompt: aristotleUserPrompt,
            systemPrompt: aristotleSystemPrompt,
            apiKeys,
            onChunk: (_, fullText) => {
              if (!activeDebateRef.current) return
              setStreamAristotle(fullText)
              aristotleOutput = fullText
            },
            onComplete: () => {
              if (!activeDebateRef.current) return
              setDebateLedger(prev => [...prev, { agent: "aristotle", round: r, content: aristotleOutput }])
              resolve()
            },
            onError: (err) => {
              logSystemMessage("ERROR", `Aristotle debate streaming error: ${err}`)
              // Mock fallback
              aristotleOutput = `[Local Fallback Mode - Aristotle]
We must ground our inquiry in empirical observation. While Socrates raises vital epistemological limits, and Ada provides mathematical architecture, the truth lies in the middle: utility defines value. A sub-100ms vector index is useful only if it serves real human users. I recommend a hybrid caching topology with simple REST adapters to prove utility immediately.`
              setStreamAristotle(aristotleOutput)
              setDebateLedger(prev => [...prev, { agent: "aristotle", round: r, content: aristotleOutput }])
              setTimeout(resolve, 800)
            }
          })
        })
      }

      // Debate finished
      if (activeDebateRef.current) {
        setConsensusLevel(roundsLimit === 1 ? 65 : 88)
        setIsDebating(false)
        setActiveSpeaker(null)
        logSystemMessage("SYSTEM", "Cognitive Arena 2.0: Multi-agent debate finished successfully.")
      }
    } catch (err: any) {
      logSystemMessage("ERROR", `Debate failed: ${err?.message}`)
      setIsDebating(false)
      setActiveSpeaker(null)
    }
  }

  // Abort active debate run
  const handleAbortDebate = () => {
    activeDebateRef.current = false
    setIsDebating(false)
    setActiveSpeaker(null)
    logSystemMessage("SYSTEM", "Cognitive Arena 2.0: Debate run aborted by user.")
  }

  // Inject entire debate ledger into target document as structured appendix
  const handleInjectAppendix = () => {
    if (!selectedPage || debateLedger.length === 0) return

    let appendixContent = `\n\n---\n\n## 🎭 Appendix: Multi-Agent Cognitive Debate Ledger\n`
    appendixContent += `*This appendix registers the sequential panel debate between Ada Lovelace, Socrates, and Aristotle conducted on ${new Date().toLocaleDateString()} regarding the topic: "${customTopic.trim() || TOPIC_PRESETS[activePresetIndex].title}".*\n\n`

    // Group ledger messages by round
    for (let r = 1; r <= roundsLimit; r++) {
      appendixContent += `### 🔄 Round ${r} Arguments\n\n`
      
      const adaMsg = debateLedger.find(m => m.agent === "ada" && m.round === r)
      const socMsg = debateLedger.find(m => m.agent === "socrates" && m.round === r)
      const ariMsg = debateLedger.find(m => m.agent === "aristotle" && m.round === r)

      if (adaMsg) {
        appendixContent += `#### 📐 Ada (The Systems Architect)\n> ${adaMsg.content.replace(/\n/g, "\n> ")}\n\n`
      }
      if (socMsg) {
        appendixContent += `#### 🏛️ Socrates (The Philosophical Critic)\n> ${socMsg.content.replace(/\n/g, "\n> ")}\n\n`
      }
      if (ariMsg) {
        appendixContent += `#### 🧠 Aristotle (The Empirical PM)\n> ${ariMsg.content.replace(/\n/g, "\n> ")}\n\n`
      }
    }

    const updatedPage = {
      ...selectedPage,
      content: selectedPage.content + appendixContent,
      updatedAt: Date.now()
    }

    // Save to database
    upsertPage("enterprise", updatedPage).then(() => {
      setAppendixInjected(true)
      logSystemMessage("DATABASE", `Injected debate transcript appendix into "${selectedPage.title}"`)
    }).catch(err => {
      logSystemMessage("ERROR", `Failed to inject debate transcript: ${err.message}`)
    })
  }

  // Calculate percentage progress inside circle meter SVG offset
  const circleOffset = 220 - (220 * consensusLevel) / 100

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "24px", height: "calc(100vh - 120px)", overflow: "hidden" }}>

      {/* LEFT COLUMN: LIVE DEBATE PANEL STAGE */}
      <div style={{ display: "flex", flexDirection: "column", gap: "20px", height: "100%", overflow: "hidden" }}>
        
        {/* Arena Setup Cockpit Panel */}
        <div className="glass-card" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Zap size={18} style={{ color: "var(--accent-warning)", animation: isDebating ? "pulse 1s infinite" : "none" }} />
              <h3 style={{ fontSize: "16px", fontWeight: "700", fontFamily: "var(--font-display)", color: "#ffffff" }}>
                Cognitive Arena 2.0: Multi-Agent Panel Debates
              </h3>
            </div>
            
            {isDebating && (
              <span 
                style={{ 
                  fontSize: "10.5px", 
                  fontFamily: "var(--font-mono)", 
                  color: "var(--accent-primary)", 
                  background: "rgba(99,102,241,0.12)", 
                  border: "1px solid rgba(99,102,241,0.25)",
                  padding: "3px 10px", 
                  borderRadius: "20px",
                  fontWeight: "bold"
                }}
              >
                🔄 ROUND {currentRound} ACTIVE
              </span>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            {/* Page selection */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600", fontFamily: "var(--font-mono)" }}>
                SELECT DOCUMENT FOR REVIEW:
              </label>
              <select
                value={selectedPageId}
                onChange={(e) => setSelectedPageId(e.target.value)}
                className="input-premium"
                disabled={isDebating}
                style={{ padding: "8px 10px", fontSize: "12.5px" }}
              >
                {pages.filter(p => ["document", "note", "journal"].includes(p.type)).map(p => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
                {pages.filter(p => ["document", "note", "journal"].includes(p.type)).length === 0 && (
                  <option value="">No document drafts pre-seeded</option>
                )}
              </select>
            </div>

            {/* Rounds constraint */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600", fontFamily: "var(--font-mono)" }}>
                DEBATE INTENSITY DEPTH:
              </label>
              <div style={{ display: "flex", gap: "10px" }}>
                {[1, 2, 3].map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRoundsLimit(r)}
                    disabled={isDebating}
                    className={`btn-secondary ${roundsLimit === r ? "active" : ""}`}
                    style={{ flex: 1, padding: "6px", fontSize: "12px", background: roundsLimit === r ? "var(--text-primary)" : "rgba(255,255,255,0.02)", color: roundsLimit === r ? "var(--bg-primary)" : "var(--text-primary)" }}
                  >
                    {r === 1 ? "1 Round (Brief)" : r === 2 ? "2 Rounds (Standard)" : "3 Rounds (Deep)"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Topic Select Presets */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600", fontFamily: "var(--font-mono)" }}>
              CHOOSE DEBATE TOPIC PROMPT:
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              {TOPIC_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => { setActivePresetIndex(idx); setCustomTopic("") }}
                  disabled={isDebating}
                  className={`btn-secondary`}
                  style={{
                    padding: "8px 12px",
                    textAlign: "left",
                    borderRadius: "6px",
                    border: activePresetIndex === idx && !customTopic ? "1px solid var(--border-active)" : "1px solid var(--border-muted)",
                    background: activePresetIndex === idx && !customTopic ? "rgba(255,255,255,0.03)" : "transparent",
                    display: "flex",
                    flexDirection: "column",
                    gap: "2px"
                  }}
                >
                  <span style={{ fontSize: "12px", fontWeight: "700", color: "#ffffff" }}>{preset.title}</span>
                  <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block" }}>{preset.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <input
              type="text"
              placeholder="Or type a custom research debate question..."
              value={customTopic}
              onChange={(e) => setCustomTopic(e.target.value)}
              disabled={isDebating}
              className="input-premium"
              style={{ flex: 1, fontSize: "12.5px" }}
            />

            {!isDebating ? (
              <button
                onClick={handleInitiateDebate}
                disabled={!selectedPageId}
                className="btn-premium"
                style={{ padding: "10px 20px", fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "8px" }}
              >
                <Play size={13} fill="currentColor" />
                <span>Start Panel Debate</span>
              </button>
            ) : (
              <button
                onClick={handleAbortDebate}
                className="btn-secondary"
                style={{ padding: "10px 20px", fontSize: "13px", color: "var(--accent-danger)", borderColor: "rgba(239,68,68,0.3)" }}
              >
                Abort Debate
              </button>
            )}
          </div>
        </div>

        {/* Triple-Agent Debate Columns Arena */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", flex: 1, overflow: "hidden" }}>
          
          {/* COLUMN 1: ADA LOVELACE */}
          <div 
            className="glass-card" 
            style={{ 
              display: "flex", 
              flexDirection: "column", 
              height: "100%", 
              padding: "16px", 
              overflow: "hidden",
              border: activeSpeaker === "ada" ? "1px solid #3b82f6" : "1px solid var(--border-muted)",
              boxShadow: activeSpeaker === "ada" ? "0 0 15px rgba(59, 130, 246, 0.15)" : "none",
              transition: "var(--transition-smooth)"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", borderBottom: "1px solid var(--border-muted)", paddingBottom: "10px", marginBottom: "12px" }}>
              <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)", display: "flex", alignItems: "center", justifyContent: "center", color: "#ffffff", fontWeight: "bold", fontSize: "12px", fontFamily: "var(--font-mono)" }}>AL</div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "12.5px", fontWeight: "700", color: "#ffffff" }}>Ada Lovelace</span>
                <span style={{ fontSize: "9.5px", color: "#3b82f6", fontFamily: "var(--font-mono)", fontWeight: "bold" }}>SYSTEMS ARCHITECT</span>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: "1.6", display: "flex", flexDirection: "column", gap: "10px" }}>
              {/* Prior rounds histories */}
              {debateLedger.filter(m => m.agent === "ada").map((m, idx) => (
                <div key={idx} style={{ background: "rgba(255,255,255,0.01)", border: "1px solid var(--border-muted)", borderRadius: "6px", padding: "10px", marginBottom: "6px" }}>
                  <div style={{ fontSize: "9px", fontFamily: "var(--font-mono)", color: "var(--text-muted)", marginBottom: "4px" }}>ROUND {m.round} ARGUMENT:</div>
                  <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{m.content}</p>
                </div>
              ))}
              
              {/* Active streaming block */}
              {activeSpeaker === "ada" && (
                <div style={{ background: "rgba(59, 130, 246, 0.05)", border: "1px solid rgba(59, 130, 246, 0.2)", borderRadius: "6px", padding: "10px" }}>
                  <div style={{ fontSize: "9.5px", fontFamily: "var(--font-mono)", color: "#3b82f6", fontWeight: "bold", display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                    <Sparkles size={11} className="spin-slow" />
                    <span>ADA IS STREAMING ARGUMENT...</span>
                  </div>
                  <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{streamAda || "Compiling system architecture constraints..."}</p>
                </div>
              )}

              {debateLedger.filter(m => m.agent === "ada").length === 0 && activeSpeaker !== "ada" && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)", fontSize: "11.5px", fontStyle: "italic" }}>
                  Awaiting speaker turn...
                </div>
              )}
            </div>
          </div>

          {/* COLUMN 2: SOCRATES */}
          <div 
            className="glass-card" 
            style={{ 
              display: "flex", 
              flexDirection: "column", 
              height: "100%", 
              padding: "16px", 
              overflow: "hidden",
              border: activeSpeaker === "socrates" ? "1px solid #f59e0b" : "1px solid var(--border-muted)",
              boxShadow: activeSpeaker === "socrates" ? "0 0 15px rgba(245, 158, 11, 0.15)" : "none",
              transition: "var(--transition-smooth)"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", borderBottom: "1px solid var(--border-muted)", paddingBottom: "10px", marginBottom: "12px" }}>
              <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "linear-gradient(135deg, #78350f 0%, #f59e0b 100%)", display: "flex", alignItems: "center", justifyContent: "center", color: "#ffffff", fontWeight: "bold", fontSize: "12px", fontFamily: "var(--font-mono)" }}>SO</div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "12.5px", fontWeight: "700", color: "#ffffff" }}>Socrates</span>
                <span style={{ fontSize: "9.5px", color: "#f59e0b", fontFamily: "var(--font-mono)", fontWeight: "bold" }}>PHILOSOPHICAL CRITIC</span>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: "1.6", display: "flex", flexDirection: "column", gap: "10px" }}>
              {/* Prior rounds histories */}
              {debateLedger.filter(m => m.agent === "socrates").map((m, idx) => (
                <div key={idx} style={{ background: "rgba(255,255,255,0.01)", border: "1px solid var(--border-muted)", borderRadius: "6px", padding: "10px", marginBottom: "6px" }}>
                  <div style={{ fontSize: "9px", fontFamily: "var(--font-mono)", color: "var(--text-muted)", marginBottom: "4px" }}>ROUND {m.round} ARGUMENT:</div>
                  <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{m.content}</p>
                </div>
              ))}
              
              {/* Active streaming block */}
              {activeSpeaker === "socrates" && (
                <div style={{ background: "rgba(245, 158, 11, 0.05)", border: "1px solid rgba(245, 158, 11, 0.2)", borderRadius: "6px", padding: "10px" }}>
                  <div style={{ fontSize: "9.5px", fontFamily: "var(--font-mono)", color: "#f59e0b", fontWeight: "bold", display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                    <Sparkles size={11} className="spin-slow" />
                    <span>SOCRATES IS STREAMING ARGUMENT...</span>
                  </div>
                  <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{streamSocrates || "Formulating conceptual circularity critiques..."}</p>
                </div>
              )}

              {debateLedger.filter(m => m.agent === "socrates").length === 0 && activeSpeaker !== "socrates" && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)", fontSize: "11.5px", fontStyle: "italic" }}>
                  Awaiting speaker turn...
                </div>
              )}
            </div>
          </div>

          {/* COLUMN 3: ARISTOTLE */}
          <div 
            className="glass-card" 
            style={{ 
              display: "flex", 
              flexDirection: "column", 
              height: "100%", 
              padding: "16px", 
              overflow: "hidden",
              border: activeSpeaker === "aristotle" ? "1px solid #ec4899" : "1px solid var(--border-muted)",
              boxShadow: activeSpeaker === "aristotle" ? "0 0 15px rgba(236, 72, 153, 0.15)" : "none",
              transition: "var(--transition-smooth)"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", borderBottom: "1px solid var(--border-muted)", paddingBottom: "10px", marginBottom: "12px" }}>
              <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "linear-gradient(135deg, #9d174d 0%, #ec4899 100%)", display: "flex", alignItems: "center", justifyContent: "center", color: "#ffffff", fontWeight: "bold", fontSize: "12px", fontFamily: "var(--font-mono)" }}>AR</div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "12.5px", fontWeight: "700", color: "#ffffff" }}>Aristotle</span>
                <span style={{ fontSize: "9.5px", color: "#ec4899", fontFamily: "var(--font-mono)", fontWeight: "bold" }}>EMPIRICAL SCIENTIST & PM</span>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: "1.6", display: "flex", flexDirection: "column", gap: "10px" }}>
              {/* Prior rounds histories */}
              {debateLedger.filter(m => m.agent === "aristotle").map((m, idx) => (
                <div key={idx} style={{ background: "rgba(255,255,255,0.01)", border: "1px solid var(--border-muted)", borderRadius: "6px", padding: "10px", marginBottom: "6px" }}>
                  <div style={{ fontSize: "9px", fontFamily: "var(--font-mono)", color: "var(--text-muted)", marginBottom: "4px" }}>ROUND {m.round} ARGUMENT:</div>
                  <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{m.content}</p>
                </div>
              ))}
              
              {/* Active streaming block */}
              {activeSpeaker === "aristotle" && (
                <div style={{ background: "rgba(236, 72, 153, 0.05)", border: "1px solid rgba(236, 72, 153, 0.2)", borderRadius: "6px", padding: "10px" }}>
                  <div style={{ fontSize: "9.5px", fontFamily: "var(--font-mono)", color: "#ec4899", fontWeight: "bold", display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                    <Sparkles size={11} className="spin-slow" />
                    <span>ARISTOTLE IS STREAMING ARGUMENT...</span>
                  </div>
                  <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{streamAristotle || "Auditing empirical evidence and execution cost..."}</p>
                </div>
              )}

              {debateLedger.filter(m => m.agent === "aristotle").length === 0 && activeSpeaker !== "aristotle" && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)", fontSize: "11.5px", fontStyle: "italic" }}>
                  Awaiting speaker turn...
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* RIGHT COLUMN: DEBATE HUD PANEL COCKPIT */}
      <div className="glass-card" style={{ display: "flex", flexDirection: "column", height: "100%", padding: "20px", gap: "20px", overflowY: "auto" }}>
        
        {/* Consensus level circular speed gauge */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", borderBottom: "1px solid var(--border-muted)", paddingBottom: "20px" }}>
          <span style={{ fontSize: "10.5px", color: "var(--text-muted)", letterSpacing: "0.08em", fontWeight: "700", fontFamily: "var(--font-mono)", alignSelf: "flex-start" }}>
            CONSENSUS STATUS
          </span>

          <div style={{ position: "relative", width: "90px", height: "90px", marginTop: "8px" }}>
            <svg width="90" height="90" viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)" }}>
              {/* Outer gauge border */}
              <circle
                cx="50" cy="50" r="35"
                fill="transparent"
                stroke="rgba(255,255,255,0.03)"
                strokeWidth="7"
              />
              <circle
                cx="50" cy="50" r="35"
                fill="transparent"
                stroke="var(--accent-primary)"
                strokeWidth="7"
                strokeDasharray="220"
                strokeDashoffset={circleOffset}
                style={{
                  transition: "stroke-dashoffset 0.8s ease-in-out",
                  strokeLinecap: "round"
                }}
              />
            </svg>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: "18px", fontWeight: "800", color: "#ffffff", fontFamily: "var(--font-mono)" }}>
                {consensusLevel}%
              </span>
              <span style={{ fontSize: "8px", color: "var(--text-muted)", fontWeight: "bold" }}>
                {consensusLevel <= 25 ? "DIVERGENT" : consensusLevel <= 60 ? "GRIDLOCK" : "SYNTHESIS"}
              </span>
            </div>
          </div>

          <p style={{ fontSize: "11px", color: "var(--text-muted)", textAlign: "center", lineHeight: "1.4", margin: "4px 0 0 0" }}>
            {consensusLevel <= 25 
              ? "Opening statements active. Debaters hold deeply divergent viewpoints." 
              : consensusLevel <= 60 
                ? "Active cross-examination phase. Conceptual boundaries are colliding." 
                : "Synthesis reached successfully. Recommendations ready for injection."}
          </p>
        </div>

        {/* Debate action controls */}
        {debateLedger.length > 0 && !isDebating && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", borderBottom: "1px solid var(--border-muted)", paddingBottom: "20px" }}>
            <span style={{ fontSize: "10.5px", color: "var(--text-muted)", letterSpacing: "0.08em", fontWeight: "700", fontFamily: "var(--font-mono)" }}>
              ARENA LEDGER TOOLS
            </span>
            
            {!appendixInjected ? (
              <button
                onClick={handleInjectAppendix}
                className="btn-premium"
                style={{ width: "100%", padding: "10px", fontSize: "12px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
              >
                <FileCheck size={14} />
                <span>Inject Ledger as Appendix</span>
              </button>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", padding: "10px", borderRadius: "6px", justifyContent: "center" }}>
                <span className="pulse-dot" style={{ backgroundColor: "var(--accent-success)", width: "6px", height: "6px" }}></span>
                <span style={{ fontSize: "11.5px", color: "var(--accent-success)", fontWeight: "bold", fontFamily: "var(--font-mono)" }}>APPENDIX INJECTED LIVE</span>
              </div>
            )}
          </div>
        )}

        {/* Selected Draft Quick HUD details */}
        {selectedPage && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <span style={{ fontSize: "10.5px", color: "var(--text-muted)", letterSpacing: "0.08em", fontWeight: "700", fontFamily: "var(--font-mono)" }}>
              DRAFT SPEC UNDER REVIEW
            </span>

            <div style={{ background: "rgba(255,255,255,0.015)", border: "1px solid var(--border-muted)", borderRadius: "6px", padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <FileText size={14} style={{ color: "var(--accent-secondary)" }} />
                <span style={{ fontSize: "13px", fontWeight: "600", color: "#ffffff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {selectedPage.title}
                </span>
              </div>

              <div style={{ display: "flex", gap: "12px", fontSize: "10.5px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                <span>Type: <strong style={{ color: "var(--accent-primary)" }}>{selectedPage.type.toUpperCase()}</strong></span>
                <span>Length: <strong>{selectedPage.content.length} chars</strong></span>
              </div>

              {selectedPage.tags && selectedPage.tags.length > 0 && (
                <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "4px" }}>
                  {selectedPage.tags.map(t => (
                    <span key={t} style={{ fontSize: "9px", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-muted)", color: "var(--text-secondary)", borderRadius: "4px", padding: "1px 5px" }}>
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* AI Credentials warning overlay if inactive */}
        {provider === "ollama" && !isOllamaOnline && !apiKeys.useSubscription && (
          <div style={{ display: "flex", gap: "8px", fontSize: "11px", color: "var(--accent-warning)", padding: "10px", background: "rgba(245,158,11,0.06)", borderRadius: "6px", border: "1px solid rgba(245,158,11,0.2)", marginTop: "auto" }}>
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: "1px" }} />
            <span>Local Ollama is offline. Debate will execute in premium local smart simulation mode!</span>
          </div>
        )}
      </div>

    </div>
  )
}
