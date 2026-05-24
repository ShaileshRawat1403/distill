import { useState, useEffect, useRef } from "react"
import { Eye, Volume2, VolumeX, X, Send, Sliders, MessageSquare, Type, Zap, AlertTriangle, Play, Square, Mic, MicOff } from "lucide-react"
import { streamPrompt, APIKeys } from "../utils/ai"
import { Page } from "../App"

interface AEyeAssistantProps {
  activePage: Page | undefined
  theme: string
  setTheme: (t: any) => void
  provider: string
  model: string
  apiKeys: APIKeys
}

export default function AEyeAssistant({
  activePage,
  theme,
  setTheme,
  provider,
  model,
  apiKeys
}: AEyeAssistantProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<"chat" | "dock">("chat")
  const [chatInput, setChatInput] = useState("")
  const [messages, setMessages] = useState<Array<{ role: "assistant" | "user"; content: string }>>([
    {
      role: "assistant",
      content: "Hello! I am **A-Eye**, your smart accessibility copilot. I can read your pages out loud, simplify complex text, adjust text scaling, enable high contrast, or summarize active notes! How can I assist you today?"
    }
  ])
  const [isStreaming, setIsStreaming] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [fontSize, setFontSize] = useState(100)
  const [highContrast, setHighContrast] = useState(false)
  const [isDictating, setIsDictating] = useState(false)
  const chatRecognitionRef = useRef<any>(null)

  // Initialize speech recognition for A-Eye chat
  useEffect(() => {
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognition) {
      const rec = new SpeechRecognition()
      rec.continuous = false
      rec.interimResults = false
      rec.lang = "en-US"
      rec.onresult = (e: any) => {
        const trans = e.results[0][0].transcript
        if (trans) setChatInput(prev => prev ? prev + " " + trans : trans)
      }
      rec.onend = () => setIsDictating(false)
      chatRecognitionRef.current = rec
    }
  }, [])

  const handleToggleDictation = () => {
    if (!chatRecognitionRef.current) {
      alert("Voice speech recognition not supported on this browser context.")
      return
    }
    if (isDictating) {
      chatRecognitionRef.current.stop()
      setIsDictating(false)
    } else {
      try {
        chatRecognitionRef.current.start()
        setIsDictating(true)
      } catch {
        // Silent
      }
    }
  }

  const chatEndRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Stop TTS speech on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel()
    }
  }, [])

  // Speech Reader synthesis trigger
  const handleSpeakDocument = () => {
    if (!activePage) {
      alert("No active document loaded to read out loud.")
      return
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
      return
    }

    // Clean markdown elements from content for natural voice reader synthesis
    const cleanText = `${activePage.title}. ${activePage.content
      .replace(/[#*`[\]\-]/g, "")
      .replace(/!\[.*?\]\(.*?\)/g, "")}`

    const utterance = new SpeechSynthesisUtterance(cleanText)
    
    // Attempt to set a high-fidelity natural voice if loaded in browser
    const voices = window.speechSynthesis.getVoices()
    const preferredVoice = voices.find(
      v => v.name.includes("Google US English") || v.name.includes("Natural") || v.lang.startsWith("en-")
    )
    if (preferredVoice) utterance.voice = preferredVoice

    utterance.rate = 1.05
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)

    setIsSpeaking(true)
    window.speechSynthesis.speak(utterance)
  }

  // Accessibility Scaling Handler
  const applyFontSize = (scale: number) => {
    setFontSize(scale)
    document.body.style.zoom = `${scale}%`
  }

  // Accessibility Contrast Mode Overrides
  const toggleHighContrast = () => {
    const nextContrast = !highContrast
    setHighContrast(nextContrast)
    if (nextContrast) {
      document.documentElement.setAttribute("data-accessibility-contrast", "high")
    } else {
      document.documentElement.removeAttribute("data-accessibility-contrast")
    }
  }

  // Chat message query handler
  const handleSendMessage = async (customPrompt?: string) => {
    const promptText = customPrompt || chatInput
    if (!promptText.trim()) return

    const userMsg = { role: "user" as const, content: promptText }
    setMessages(prev => [...prev, userMsg])
    setChatInput("")
    setIsStreaming(true)

    // Add empty message for assistant streaming
    setMessages(prev => [...prev, { role: "assistant", content: "" }])

    let accumulatedResponse = ""

    try {
      let finalPrompt = promptText
      if (customPrompt && activePage) {
        finalPrompt = `${promptText}\n\nDocument Title: ${activePage.title}\nDocument Content:\n${activePage.content}`
      }

      const systemPrompt = "You are 'A-Eye', a dedicated accessibility and smart productivity copilot for the Distill workspace. Assist the user with summaries, simplified layouts, translations, accessibility advice, and formatting. Keep responses highly clear, concise, and structured. Use Markdown formatting when helpful."

      await streamPrompt({
        provider,
        model,
        prompt: finalPrompt,
        systemPrompt,
        apiKeys,
        onChunk: (delta) => {
          accumulatedResponse += delta
          setMessages(prev => {
            const updated = [...prev]
            if (updated.length > 0) {
              updated[updated.length - 1] = {
                role: "assistant",
                content: accumulatedResponse
              }
            }
            return updated
          })
        },
        onComplete: () => {
          setIsStreaming(false)
        },
        onError: (err) => {
          setIsStreaming(false)
          setMessages(prev => {
            const updated = [...prev]
            if (updated.length > 0) {
              updated[updated.length - 1] = {
                role: "assistant",
                content: `Error occurred during response stream: ${err}`
              }
            }
            return updated
          })
        }
      })
    } catch (e: any) {
      setIsStreaming(false)
      setMessages(prev => {
        const updated = [...prev]
        if (updated.length > 0) {
          updated[updated.length - 1] = {
            role: "assistant",
            content: `Failed to initiate A-Eye connection: ${e?.message || e}`
          }
        }
        return updated
      })
    }
  }

  return (
    <>
      {/* Levitating Circular Pulse Toggle Badge */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`aeye-bubble ${isOpen ? "aeye-bubble-active" : ""}`}
        title="Open A-Eye Accessibility Assistant"
      >
        {isOpen ? <X size={20} /> : <Eye size={20} />}
      </button>

      {/* Floating Interaction Window overlay */}
      {isOpen && (
        <div className="aeye-window">
          {/* Header Panel */}
          <div className="aeye-header">
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Eye size={16} style={{ color: "var(--accent-primary)" }} />
              <span style={{ fontSize: "14px", fontWeight: "700", fontFamily: "var(--font-display)", color: "#ffffff" }}>
                A-Eye Accessibility Copilot
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
            >
              <X size={15} />
            </button>
          </div>

          {/* Interactive Navigation Tab deck */}
          <div className="aeye-tab-bar">
            <button
              onClick={() => setActiveTab("chat")}
              className={`aeye-tab ${activeTab === "chat" ? "active" : ""}`}
            >
              <MessageSquare size={13} style={{ marginRight: "6px", display: "inline" }} />
              A-Eye AI Assistant
            </button>
            <button
              onClick={() => setActiveTab("dock")}
              className={`aeye-tab ${activeTab === "dock" ? "active" : ""}`}
            >
              <Sliders size={13} style={{ marginRight: "6px", display: "inline" }} />
              Accessibility Dock
            </button>
          </div>

          {/* Tab Content Display */}
          {activeTab === "chat" ? (
            <>
              {/* Message History Deck */}
              <div className="aeye-chat-container">
                {messages.map((msg, index) => (
                  <div key={index} className={`aeye-chat-bubble ${msg.role}`}>
                    {/* Render simple HTML bold markup parsing helper */}
                    <span 
                      style={{ whiteSpace: "pre-wrap" }}
                      dangerouslySetInnerHTML={{
                        __html: msg.content
                          .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                          .replace(/`(.*?)`/g, "<code style='background:rgba(255,255,255,0.06);padding:2px 4px;border-radius:3px;font-family:var(--font-mono);font-size:11px;'>$1</code>")
                      }} 
                    />
                  </div>
                ))}
                {isStreaming && messages[messages.length - 1].content === "" && (
                  <div className="aeye-chat-bubble assistant" style={{ display: "flex", alignItems: "center" }}>
                    <div className="bouncing-dots-loader">
                      <span></span><span></span><span></span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Action shortcut chips bar */}
              <div style={{ display: "flex", gap: "6px", overflowX: "auto", padding: "0 16px 8px 16px", whiteSpace: "nowrap" }}>
                <button
                  disabled={!activePage || isStreaming}
                  onClick={() => handleSendMessage("Please write a highly structured, clear summary of this document.")}
                  className="action-pill-premium"
                  style={{ fontSize: "10.5px", padding: "4px 10px" }}
                >
                  🔍 Summarize active doc
                </button>
                <button
                  disabled={!activePage || isStreaming}
                  onClick={() => handleSendMessage("Please simplify this document's text for extremely high readability, breaking down complex sentences and outlining key points.")}
                  className="action-pill-premium"
                  style={{ fontSize: "10.5px", padding: "4px 10px" }}
                >
                  ✍️ Simplify active text
                </button>
                <button
                  disabled={isStreaming}
                  onClick={() => handleSendMessage("Give me three best practice tips for designing web apps with maximum accessibility (a11y).")}
                  className="action-pill-premium"
                  style={{ fontSize: "10.5px", padding: "4px 10px" }}
                >
                  💡 a11y Tips
                </button>
              </div>

              {/* Input Message panel */}
              <div className="aeye-input-bar" style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                  placeholder={isDictating ? "Listening, speak now..." : "Ask A-Eye anything..."}
                  className="input-premium"
                  style={{ flex: 1, padding: "8px 12px", borderColor: isDictating ? "var(--accent-danger)" : "var(--border-muted)" }}
                />
                
                <button
                  onClick={handleToggleDictation}
                  className={`btn-secondary ${isDictating ? "active" : ""}`}
                  style={{ 
                    padding: "8px", 
                    width: "36px", 
                    height: "36px", 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "center",
                    color: isDictating ? "var(--accent-danger)" : "var(--text-primary)",
                    borderColor: isDictating ? "rgba(239,68,68,0.4)" : "var(--border-muted)"
                  }}
                  title={isDictating ? "Stop voice dictation" : "Dictate query"}
                >
                  {isDictating ? <MicOff size={13} style={{ animation: "pulse 1s infinite" }} /> : <Mic size={13} />}
                </button>

                <button
                  onClick={() => handleSendMessage()}
                  className="btn-premium"
                  style={{ padding: "8px 12px", width: "40px", height: "36px" }}
                >
                  <Send size={12} />
                </button>
              </div>
            </>
          ) : (
            <div className="aeye-dock">
              {/* Font scaling control section */}
              <div className="aeye-control-section">
                <h4><Type size={11} style={{ marginRight: "6px", display: "inline" }} /> Text Font Scale</h4>
                <div className="aeye-button-row">
                  <button onClick={() => applyFontSize(100)} className={`btn-secondary ${fontSize === 100 ? "active" : ""}`} style={{ flex: 1, fontSize: "11px", padding: "6px" }}>100%</button>
                  <button onClick={() => applyFontSize(110)} className={`btn-secondary ${fontSize === 110 ? "active" : ""}`} style={{ flex: 1, fontSize: "11px", padding: "6px" }}>110%</button>
                  <button onClick={() => applyFontSize(120)} className={`btn-secondary ${fontSize === 120 ? "active" : ""}`} style={{ flex: 1, fontSize: "11px", padding: "6px" }}>120%</button>
                  <button onClick={() => applyFontSize(130)} className={`btn-secondary ${fontSize === 130 ? "active" : ""}`} style={{ flex: 1, fontSize: "11px", padding: "6px" }}>130%</button>
                </div>
              </div>

              {/* Contrast and themes controls */}
              <div className="aeye-control-section">
                <h4><Zap size={11} style={{ marginRight: "6px", display: "inline" }} /> Contrast Overrides</h4>
                <button
                  onClick={toggleHighContrast}
                  className={`btn-secondary ${highContrast ? "active" : ""}`}
                  style={{ width: "100%", fontSize: "12px", padding: "8px", fontWeight: "600", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                >
                  <AlertTriangle size={13} style={{ color: highContrast ? "var(--accent-warning)" : "inherit" }} />
                  <span>{highContrast ? "Disable High Contrast" : "Enable High Contrast Mode"}</span>
                </button>
              </div>

              {/* Speech reader synthesis control */}
              <div className="aeye-control-section">
                <h4>{isSpeaking ? <Volume2 size={11} style={{ marginRight: "6px", display: "inline" }} /> : <VolumeX size={11} style={{ marginRight: "6px", display: "inline" }} />} Voice Screen Reader</h4>
                
                {isSpeaking && (
                  <div className="aeye-tts-speech-meter">
                    <div className="aeye-tts-wave">
                      <span></span><span></span><span></span><span></span>
                    </div>
                    <span style={{ fontSize: "11.5px", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                      Synthesising active content...
                    </span>
                  </div>
                )}
                
                <button
                  onClick={handleSpeakDocument}
                  className={`btn-premium`}
                  style={{ width: "100%", fontSize: "12px", padding: "10px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", background: isSpeaking ? "var(--accent-danger)" : "var(--accent-primary)" }}
                >
                  {isSpeaking ? <Square size={13} /> : <Play size={13} />}
                  <span>{isSpeaking ? "Stop voice synthesis reader" : "Read active document out loud"}</span>
                </button>
              </div>

              {/* Themes list shortcuts */}
              <div className="aeye-control-section" style={{ borderTop: "1px solid var(--border-muted)", paddingTop: "16px" }}>
                <h4>🎨 Shortcut Theme Palette</h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  <button onClick={() => setTheme("neon")} className={`btn-secondary ${theme === "neon" ? "active" : ""}`} style={{ fontSize: "10.5px", padding: "6px" }}>Midnight Neon</button>
                  <button onClick={() => setTheme("frost")} className={`btn-secondary ${theme === "frost" ? "active" : ""}`} style={{ fontSize: "10.5px", padding: "6px" }}>Glacier Frost</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}
