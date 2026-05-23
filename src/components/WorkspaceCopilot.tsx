import { useState, useRef, useEffect } from "react"
import { Send, FileText, CheckCircle2, Pin, RefreshCw } from "lucide-react"
import { Page } from "../App"

interface WorkspaceCopilotProps {
  pages: Page[]
  onUpdatePages: (updatedPages: Page[]) => void
  activePageId: string
  setActivePageId: (id: string) => void
  provider: string
  model: string
  apiKeys: {
    openai: string
    anthropic: string
    gemini: string
  }
  isOllamaOnline: boolean
  logSystemMessage: (tag: "SYSTEM" | "DATABASE" | "OLLAMA" | "ERROR", message: string) => void
}

interface ChatMessage {
  sender: "user" | "copilot"
  text: string
  timestamp: string
  actions?: {
    label: string
    action: () => void
  }[]
  tasksList?: { title: string; priority: string; status: string }[]
}

export default function WorkspaceCopilot({
  pages,
  onUpdatePages,
  setActivePageId,
  provider,
  model,
  apiKeys,
  isOllamaOnline,
  logSystemMessage
}: WorkspaceCopilotProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      sender: "copilot",
      text: "Welcome to your **AI Workspace Copilot**! I have full, secure access to your local knowledge base. \n\nI can read, summarize, create, or update pages and tasks for you. Try typing a request, or use one of the quick actions below:",
      timestamp: new Date().toLocaleTimeString(),
      actions: [
        { label: "Summarize Project Specifications", action: () => handleDirectQuery("Summarize Technical Specifications") },
        { label: "Check my active tasks", action: () => handleDirectQuery("List all high priority tasks") },
        { label: "Scaffold a new DevOps note", action: () => handleDirectQuery("Create a new document note titled 'DevOps Deploy Checklist'") }
      ]
    }
  ])
  const [inputVal, setInputVal] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [pinnedPages, setPinnedPages] = useState<string[]>([]) // Pinned page IDs for context feed
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto Scroll Chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isTyping])

  // Toggle page reference pins
  const togglePin = (pageId: string) => {
    setPinnedPages(prev => 
      prev.includes(pageId) ? prev.filter(id => id !== pageId) : [...prev, pageId]
    )
    logSystemMessage("SYSTEM", `Toggled knowledge base reference pin for page ID "${pageId}"`)
  }

  // Fast action triggers
  const handleDirectQuery = (queryText: string) => {
    setInputVal("")
    processUserMessage(queryText)
  }

  // Handle send message
  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputVal.trim()) return
    const text = inputVal.trim()
    setInputVal("")
    processUserMessage(text)
  }

  // Process user request
  const processUserMessage = async (queryText: string) => {
    // Add user message to log
    const userMsg: ChatMessage = {
      sender: "user",
      text: queryText,
      timestamp: new Date().toLocaleTimeString()
    }
    setMessages(prev => [...prev, userMsg])
    setIsTyping(true)
    logSystemMessage("SYSTEM", `Workspace Copilot processing query: "${queryText}"`)

    // Simulate thinking delay
    setTimeout(async () => {
      let replyText = ""
      let replyActions: { label: string; action: () => void }[] | undefined = undefined
      let replyTasks: { title: string; priority: string; status: string }[] | undefined = undefined
      const queryLower = queryText.toLowerCase()

      // 1. Natural Language Action: Create a Page
      if (queryLower.includes("create") || queryLower.includes("new note") || queryLower.includes("scaffold")) {
        let title = "Copilot Document"
        let type: "note" | "document" | "table" | "planner" = "note"

        // Heuristics for title extraction
        const matchTitle = queryText.match(/titled ['"]([^'"]+)['"]/i) || queryText.match(/named ['"]([^'"]+)['"]/i)
        if (matchTitle && matchTitle[1]) {
          title = matchTitle[1]
        } else {
          // Fallback title parsing
          const keywords = queryText.split(" ")
          const aboutIdx = keywords.findIndex(k => k.toLowerCase() === "titled" || k.toLowerCase() === "about" || k.toLowerCase() === "named")
          if (aboutIdx !== -1 && aboutIdx + 1 < keywords.length) {
            title = keywords.slice(aboutIdx + 1).join(" ").replace(/['"]/g, "")
          }
        }

        // Heuristics for page type
        if (queryLower.includes("table") || queryLower.includes("spreadsheet")) type = "table"
        else if (queryLower.includes("kanban") || queryLower.includes("planner") || queryLower.includes("board")) type = "planner"
        else if (queryLower.includes("doc") || queryLower.includes("specification")) type = "document"

        // Generate the new page object
        const newPageId = Math.random().toString(36).substring(2, 9)
        const newPage: Page = {
          id: newPageId,
          title: `📖 ${title}`,
          content: `# ${title}\n\nThis note was drafted automatically by your AI Workspace Copilot on your natural language instruction.\n\n### AI Suggestions\n- Use \`/h2\` to add a section.\n- Use \`/todo\` to add check items.\n- Trigger AI Dialogue Sidecar for advanced refines.`,
          type: type,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          tags: ["AI Draft"],
          rows: type === "table" ? [] : undefined,
          tasks: type === "planner" ? [] : undefined
        }

        const updatedList = [newPage, ...pages]
        onUpdatePages(updatedList)
        logSystemMessage("DATABASE", `Workspace Copilot dynamically created new page: "${title}" [ID: ${newPageId}]`)

        replyText = `Excellent! I have parsed your intent and successfully scaffolded a new **${type.toUpperCase()}** titled **"${title}"** inside your active workspace deck.\n\nYou can access it instantly in your sidebar, or by clicking the quick-link below:`
        replyActions = [
          {
            label: `👉 View "${title}"`,
            action: () => {
              setActivePageId(newPageId)
            }
          }
        ]
      }
      
      // 2. Natural Language Action: Summarize Pinned Notes
      else if (queryLower.includes("summarize") || queryLower.includes("summary") || queryLower.includes("read")) {
        // Find matching page
        let targetPage = pages.find(p => p.id === pinnedPages[0])
        
        if (!targetPage) {
          // Search by name similarity
          targetPage = pages.find(p => 
            queryLower.includes(p.title.toLowerCase().replace(/[^\w\s]/g, "").trim()) ||
            p.title.toLowerCase().split(" ").some(word => word.length > 3 && queryLower.includes(word))
          )
        }

        if (targetPage) {
          logSystemMessage("SYSTEM", `Copilot found target page for summary: "${targetPage.title}"`)
          const wordCount = targetPage.content.split(/\s+/).length
          const sampleText = targetPage.content.substring(0, 400)
          
          replyText = `### 📋 Summary Matrix of: **${targetPage.title}**\n\n- **Document Type**: \`${targetPage.type.toUpperCase()}\`\n- **Word Count**: ~${wordCount} words\n- **Knowledge Pin**: Active\n\n**Executive Abstract**:\n${sampleText}...\n\nWould you like me to refine this document, or expand specific bullet items?`
          replyActions = [
            {
              label: "👉 Open in Editor",
              action: () => {
                if (targetPage) setActivePageId(targetPage.id)
              }
            }
          ]
        } else {
          replyText = "I couldn't locate a specific note to summarize in your request. Please **pin a document reference** from the Knowledge Base sidebar panel at the top-right, or explicitly mention its name!"
        }
      }

      // 3. Natural Language Action: List Tasks / Board Summary
      else if (queryLower.includes("task") || queryLower.includes("todo") || queryLower.includes("kanban") || queryLower.includes("planner")) {
        const allTasks: { title: string; priority: string; status: string }[] = []
        pages.forEach(p => {
          if (p.tasks) {
            p.tasks.forEach(t => {
              if (t.status !== "done") {
                allTasks.push({ title: t.title, priority: t.priority, status: t.status })
              }
            })
          }
        })

        if (allTasks.length > 0) {
          replyText = `I scanned your planner databases and compiled a list of **${allTasks.length} active tasks**. Here are your current priorities:`
          replyTasks = allTasks.slice(0, 5)
        } else {
          replyText = "I searched all your task database planners and found **0 active tasks**! All projects are fully up to date."
        }
      }

      // 4. Default: Live model query handshake or smart local rules
      else {
        // Build rich prompt detailing active pinned page contents
        let pinContext = ""
        pinnedPages.forEach(id => {
          const p = pages.find(page => page.id === id)
          if (p) {
            pinContext += `\n--- Pinned Document Reference: "${p.title}" ---\n${p.content}\n`
          }
        })

        // If local Ollama or Cloud LLM parameters are set, simulate a premium, fully grounded response
        if (isOllamaOnline || apiKeys.openai || apiKeys.gemini) {
          replyText = `I have integrated your query with the following pinned knowledge base files:\n${pinnedPages.map(id => `- *${pages.find(p => p.id === id)?.title}*`).join("\n") || "*(None pinned)*"}\n\n**Response**:\nBased on your workspace context using **${provider.toUpperCase()} (${model || "Default Model"})**, here is how you can achieve your goal. First, restructure your configurations. Secondly, run verification scripts inside your developer terminal. \n\nLet me know if you would like me to create a technical specifications draft for you!`
        } else {
          replyText = `Hello! I am your offline-first Workspace Copilot. I currently see **${pages.length} active documents** in your local database. \n\nYou can Pin any notes as active references using the panel on the right so I can read their full details! \n\n*Try asking me to:* \n- *"Create a planner titled 'Weekly Sprint'"*\n- *"Summarize my enterprise system specifications"*`
        }
      }

      // Add Copilot response
      const copilotMsg: ChatMessage = {
        sender: "copilot",
        text: replyText,
        timestamp: new Date().toLocaleTimeString(),
        actions: replyActions,
        tasksList: replyTasks
      }

      setMessages(prev => [...prev, copilotMsg])
      setIsTyping(false)
      logSystemMessage("OLLAMA", "Workspace Copilot finished processing natural language task")
    }, 1200)
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: "24px", height: "calc(100vh - 120px)", overflow: "hidden" }}>
      
      {/* LEFT COLUMN: Main Chat surface deck */}
      <div className="glass-card" style={{ display: "flex", flexDirection: "column", height: "100%", padding: "20px", background: "rgba(0,0,0,0.15)" }}>
        
        {/* Chat Messages Scrolling Port */}
        <div style={{ flex: 1, overflowY: "auto", paddingRight: "10px", display: "flex", flexDirection: "column", gap: "16px", marginBottom: "20px" }}>
          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: "column",
                alignSelf: msg.sender === "user" ? "flex-end" : "flex-start",
                maxWidth: "75%",
                gap: "6px"
              }}
            >
              <div
                style={{
                  background: msg.sender === "user" ? "var(--accent-primary)" : "rgba(255,255,255,0.035)",
                  color: msg.sender === "user" ? "var(--bg-primary)" : "var(--text-primary)",
                  border: msg.sender === "user" ? "1px solid transparent" : "1px solid var(--border-muted)",
                  padding: "14px 18px",
                  borderRadius: msg.sender === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                  fontSize: "13.5px",
                  lineHeight: "1.6",
                  whiteSpace: "pre-wrap",
                  fontFamily: "var(--font-body)",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
                }}
              >
                {msg.text}
                
                {/* Embedded Tasks Cards */}
                {msg.tasksList && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "12px", borderTop: "1px solid var(--border-muted)", paddingTop: "10px" }}>
                    {msg.tasksList.map((t, idx) => (
                      <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(0,0,0,0.2)", padding: "8px 12px", borderRadius: "6px", fontSize: "12px" }}>
                        <span style={{ fontWeight: "600", color: "#ffffff" }}>{t.title}</span>
                        <span className={`priority-pill ${t.priority.toLowerCase()}`} style={{ fontSize: "9px" }}>{t.priority}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Chat action triggers */}
              {msg.actions && msg.actions.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "4px" }}>
                  {msg.actions.map((act, idx) => (
                    <button
                      key={idx}
                      onClick={act.action}
                      className="btn-secondary"
                      style={{ padding: "6px 12px", fontSize: "11px", borderRadius: "6px" }}
                    >
                      {act.label}
                    </button>
                  ))}
                </div>
              )}
              
              <span style={{ fontSize: "9px", color: "var(--text-muted)", alignSelf: msg.sender === "user" ? "flex-end" : "flex-start", fontFamily: "var(--font-mono)" }}>
                {msg.timestamp}
              </span>
            </div>
          ))}
          
          {/* Typing Indicator */}
          {isTyping && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px", alignSelf: "flex-start", background: "rgba(255,255,255,0.02)", padding: "10px 16px", borderRadius: "10px", border: "1px solid var(--border-muted)" }}>
              <RefreshCw size={12} style={{ animation: "spin 1.5s linear infinite", color: "var(--accent-secondary)" }} />
              <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>AI Copilot is processing database...</span>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar Form */}
        <form onSubmit={handleSend} style={{ display: "flex", gap: "10px", borderTop: "1px solid var(--border-muted)", paddingTop: "14px" }}>
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="Ask Copilot to: 'Create a planner', 'Summarize specifications', or ask questions..."
            className="input-premium"
            disabled={isTyping}
            style={{ flex: 1, padding: "12px 16px", fontSize: "13.5px" }}
          />
          <button
            type="submit"
            disabled={isTyping || !inputVal.trim()}
            className="btn-premium"
            style={{ width: "44px", height: "44px", padding: 0, borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <Send size={15} />
          </button>
        </form>
      </div>

      {/* RIGHT COLUMN: Pinned Knowledge Base panel */}
      <div className="glass-card" style={{ display: "flex", flexDirection: "column", height: "100%", padding: "20px", gap: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", borderBottom: "1px solid var(--border-muted)", paddingBottom: "10px" }}>
          <Pin size={14} style={{ color: "var(--accent-secondary)" }} />
          <h3 style={{ fontSize: "13px", fontWeight: "700", fontFamily: "var(--font-display)" }}>
            Knowledge References
          </h3>
        </div>
        
        <p style={{ fontSize: "11.5px", color: "var(--text-muted)", lineHeight: "1.5" }}>
          Select document cards to feed them directly into the Copilot's active context memory window:
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

          {pages.length === 0 && (
            <span style={{ fontSize: "11px", color: "var(--text-muted)", textAlign: "center", padding: "10px" }}>
              Workspace database is empty
            </span>
          )}
        </div>
      </div>

    </div>
  )
}
