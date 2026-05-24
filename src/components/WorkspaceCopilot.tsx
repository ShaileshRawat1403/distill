import { useState, useRef, useEffect } from "react"
import {
  Send, FileText, CheckCircle2, Pin, Sparkles, Brain, User,
  Activity, AlertCircle, Search, Cpu
} from "lucide-react"
import { Page } from "../App"
import { executePrompt, APIKeys } from "../utils/ai"
import { semanticSearch, buildSemanticContext, syncPageEmbedding } from "../utils/semanticSearch"
import type { EmbedStatus } from "../utils/embeddings"

interface WorkspaceCopilotProps {
  pages: Page[]
  onUpdatePages: (updatedPages: Page[]) => void
  activePageId: string
  setActivePageId: (id: string) => void
  provider: string
  model: string
  apiKeys: APIKeys
  isOllamaOnline: boolean
  logSystemMessage: (tag: "SYSTEM" | "DATABASE" | "OLLAMA" | "ERROR", message: string) => void
  workspace: string
  embedStatus: EmbedStatus
}

interface ChatMessage {
  sender: "user" | "copilot"
  text: string
  timestamp: string
  isError?: boolean
  contextUsed?: string[]       // page titles retrieved semantically
  actions?: { label: string; action: () => void }[]
  tasksList?: { title: string; priority: string; status: string }[]
}

function hasAIProvider(provider: string, isOllamaOnline: boolean, apiKeys: APIKeys): boolean {
  if (provider === "ollama") return isOllamaOnline
  if (provider === "openai") return !!apiKeys.openai
  if (provider === "gemini") return !!apiKeys.gemini
  if (provider === "groq") return !!apiKeys.groq
  if (provider === "anthropic") return !!apiKeys.anthropic
  return false
}

// Embed status badge
const EMBED_STATUS_LABEL: Record<EmbedStatus, string> = {
  idle: "EMBED IDLE",
  loading: "LOADING MODEL",
  ready: "SEMANTIC READY",
  error: "EMBED ERROR",
}
const EMBED_STATUS_COLOR: Record<EmbedStatus, string> = {
  idle: "var(--text-muted)",
  loading: "var(--accent-warning)",
  ready: "var(--accent-success)",
  error: "var(--accent-danger)",
}

export default function WorkspaceCopilot({
  pages,
  onUpdatePages,
  setActivePageId,
  provider,
  model,
  apiKeys,
  isOllamaOnline,
  logSystemMessage,
  workspace,
  embedStatus,
}: WorkspaceCopilotProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      sender: "copilot",
      text: "Welcome to your **AI Workspace Copilot**.\n\nI use semantic search to automatically find the most relevant documents in your knowledge base — no manual pinning required. You can still pin specific pages to force-include them.\n\nAsk me anything about your notes, create new pages, or analyse your tasks.",
      timestamp: new Date().toLocaleTimeString(),
      actions: [
        { label: "Summarize my notes", action: () => handleDirectQuery("Summarize what's in my knowledge base") },
        { label: "List active tasks", action: () => handleDirectQuery("What are all my active tasks across all planners?") },
        { label: "What am I working on?", action: () => handleDirectQuery("What are the main themes and topics in my workspace?") },
      ],
    },
  ])
  const [inputVal, setInputVal] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [pinnedPages, setPinnedPages] = useState<string[]>([])  // manual overrides
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isTyping])

  const togglePin = (pageId: string) => {
    setPinnedPages((prev) =>
      prev.includes(pageId) ? prev.filter((id) => id !== pageId) : [...prev, pageId]
    )
    logSystemMessage("SYSTEM", `Toggled manual pin for page "${pageId}"`)
  }

  const handleDirectQuery = (queryText: string) => processUserMessage(queryText)

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputVal.trim()) return
    const text = inputVal.trim()
    setInputVal("")
    processUserMessage(text)
  }

  const appendMessage = (msg: ChatMessage) => setMessages((prev) => [...prev, msg])

  // ─── Core message processor ────────────────────────────────────────────────
  const processUserMessage = async (queryText: string) => {
    appendMessage({ sender: "user", text: queryText, timestamp: new Date().toLocaleTimeString() })
    setIsTyping(true)
    logSystemMessage("SYSTEM", `Copilot: "${queryText}"`)

    const queryLower = queryText.toLowerCase()
    let replyText = ""
    let replyActions: ChatMessage["actions"]
    let replyTasks: ChatMessage["tasksList"]
    let contextUsed: string[] = []
    let isError = false

    try {
      // ── 1. CREATE PAGE ─────────────────────────────────────────────────────
      if (
        queryLower.includes("create") ||
        queryLower.includes("new note") ||
        queryLower.includes("scaffold") ||
        queryLower.includes("add a page")
      ) {
        let title = "New Document"
        let type: "note" | "document" | "table" | "planner" = "note"

        const matchTitle =
          queryText.match(/titled\s+['"]([^'"]+)['"]/i) ||
          queryText.match(/named\s+['"]([^'"]+)['"]/i) ||
          queryText.match(/called\s+['"]([^'"]+)['"]/i)
        if (matchTitle?.[1]) {
          title = matchTitle[1]
        } else {
          const words = queryText.split(" ")
          const idx = words.findIndex((w) =>
            ["titled", "about", "named", "called", "for"].includes(w.toLowerCase())
          )
          if (idx !== -1 && idx + 1 < words.length) {
            title = words.slice(idx + 1).join(" ").replace(/['"]/g, "").trim()
          }
        }

        if (queryLower.includes("table") || queryLower.includes("spreadsheet")) type = "table"
        else if (queryLower.includes("kanban") || queryLower.includes("planner") || queryLower.includes("board")) type = "planner"
        else if (queryLower.includes("doc") || queryLower.includes("spec") || queryLower.includes("report")) type = "document"

        const newPageId = Math.random().toString(36).substring(2, 9)
        const newPage: Page = {
          id: newPageId,
          title: `📖 ${title}`,
          content: `# ${title}\n\n`,
          type,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          tags: ["Copilot Draft"],
          rows: type === "table" ? [] : undefined,
          tasks: type === "planner" ? [] : undefined,
        }

        onUpdatePages([newPage, ...pages])
        // Embed the new page in background
        syncPageEmbedding(workspace, newPage).catch(() => {/* silent */})
        logSystemMessage("DATABASE", `Copilot created "${title}" [${type}]`)

        replyText = `Created a new **${type}** titled **"${title}"** in your workspace.`
        replyActions = [{ label: `Open "${title}"`, action: () => setActivePageId(newPageId) }]
      }

      // ── 2. TASKS ───────────────────────────────────────────────────────────
      else if (
        queryLower.includes("task") ||
        queryLower.includes("todo") ||
        queryLower.includes("kanban") ||
        queryLower.includes("planner") ||
        queryLower.includes("what's on my plate")
      ) {
        const allTasks: { title: string; priority: string; status: string; board: string }[] = []
        pages.forEach((p) => {
          if (p.tasks) p.tasks.forEach((t) =>
            allTasks.push({ title: t.title, priority: t.priority, status: t.status, board: p.title })
          )
        })

        if (allTasks.length === 0) {
          replyText = "No tasks found across your workspace. Create a Planner page to start tracking tasks."
        } else {
          const activeTasks = allTasks.filter((t) => t.status !== "done")
          const doneTasks = allTasks.filter((t) => t.status === "done")
          replyText = `Found **${allTasks.length} total tasks** — ${activeTasks.length} active, ${doneTasks.length} done.`
          replyTasks = activeTasks.slice(0, 8)

          if (hasAIProvider(provider, isOllamaOnline, apiKeys) && activeTasks.length > 0) {
            const taskList = activeTasks
              .map((t) => `- [${t.priority.toUpperCase()}] ${t.title} (${t.status}) — "${t.board}"`)
              .join("\n")
            const insight = await executePrompt({
              provider, model, apiKeys,
              prompt: `Given these active tasks:\n${taskList}\n\nGive a 2-sentence prioritization insight — what should be tackled first and why?`,
              systemPrompt: "You are a concise productivity assistant. Be direct and specific.",
            })
            replyText += `\n\n**Copilot Insight:** ${insight.trim()}`
          }
        }
      }

      // ── 3. SUMMARIZE ───────────────────────────────────────────────────────
      else if (
        queryLower.includes("summarize") ||
        queryLower.includes("summary") ||
        queryLower.includes("what does") ||
        queryLower.includes("what is in") ||
        queryLower.includes("tell me about")
      ) {
        // Try semantic search first; fall back to name match
        let targetPage: Page | undefined
        if (embedStatus === "ready") {
          const results = await semanticSearch(queryText, workspace, pages, 1, 0.2)
          if (results.length > 0) {
            targetPage = results[0].page
            contextUsed = [targetPage.title]
          }
        }
        if (!targetPage) {
          targetPage = pages.find((p) => pinnedPages.includes(p.id))
        }
        if (!targetPage) {
          targetPage = pages.find((p) =>
            p.title.toLowerCase().split(" ").some(
              (word) => word.length > 3 && queryLower.includes(word.toLowerCase())
            )
          )
        }

        if (!targetPage) {
          replyText = "I couldn't identify which document to summarize. Mention its name directly or try asking more specifically."
        } else if (!hasAIProvider(provider, isOllamaOnline, apiKeys)) {
          const wordCount = targetPage.content.split(/\s+/).length
          replyText = `**${targetPage.title}** — ${wordCount} words, ${targetPage.type}.\n\nExcerpt:\n${targetPage.content.substring(0, 400)}…`
          replyActions = [{ label: "Open in Editor", action: () => setActivePageId(targetPage!.id) }]
        } else {
          logSystemMessage("SYSTEM", `Summarizing: "${targetPage.title}"`)
          const summary = await executePrompt({
            provider, model, apiKeys,
            prompt: `Document title: "${targetPage.title}"\n\n${targetPage.content}`,
            systemPrompt: `You are a workspace analyst. Summarize this document concisely:

**Core Purpose** (1-2 sentences)
**Key Points** (3-5 bullets)
**Open Questions or Gaps** (1-2 bullets if any)

Be direct. No filler.`,
          })
          replyText = summary.trim()
          replyActions = [{ label: `Open "${targetPage.title}"`, action: () => setActivePageId(targetPage!.id) }]
        }
      }

      // ── 4. DEFAULT — semantic retrieval + AI ───────────────────────────────
      else {
        if (!hasAIProvider(provider, isOllamaOnline, apiKeys)) {
          replyText = `No AI model connected.\n- **Local:** Launch Ollama and select a model\n- **Cloud:** Add an API key in Workspace Sync → Settings`
        } else {
          let knowledgeContext = ""

          // Step 1: Semantic retrieval (if model is ready)
          if (embedStatus === "ready" && pages.length > 0) {
            const semanticResults = await semanticSearch(queryText, workspace, pages, 4, 0.25)
            if (semanticResults.length > 0) {
              knowledgeContext = buildSemanticContext(semanticResults)
              contextUsed = semanticResults.map((r) => r.page.title)
              logSystemMessage("SYSTEM", `Semantic retrieval: ${semanticResults.length} relevant pages found`)
            }
          }

          // Step 2: Layer in any manually pinned pages not already retrieved
          const retrievedIds = new Set(
            pages.filter((p) => contextUsed.includes(p.title)).map((p) => p.id)
          )
          const extraPinned = pinnedPages
            .filter((id) => !retrievedIds.has(id))
            .map((id) => pages.find((p) => p.id === id))
            .filter(Boolean) as Page[]

          if (extraPinned.length > 0) {
            const pinnedContext = extraPinned
              .map((p) => {
                const preview = p.content.slice(0, 1500) + (p.content.length > 1500 ? "\n…[truncated]" : "")
                return `--- "${p.title}" [${p.type.toUpperCase()}] [PINNED] ---\n${preview}`
              })
              .join("\n\n")
            knowledgeContext = knowledgeContext
              ? `${knowledgeContext}\n\n${pinnedContext}`
              : pinnedContext
            contextUsed = [...contextUsed, ...extraPinned.map((p) => p.title)]
          }

          const systemPrompt = knowledgeContext
            ? `You are a knowledgeable workspace assistant with access to the user's personal knowledge base. Use the context below to answer accurately and specifically. If the context is insufficient, say so and give your best answer.\n\nKNOWLEDGE BASE:\n${knowledgeContext}`
            : `You are a helpful workspace assistant. The user has ${pages.length} document(s) in their workspace. Answer from your general knowledge.`

          logSystemMessage(
            "OLLAMA",
            `Querying ${provider.toUpperCase()} — semantic context: ${contextUsed.length} page(s)`
          )

          replyText = await executePrompt({
            provider, model, apiKeys,
            prompt: queryText,
            systemPrompt,
          })
          logSystemMessage("OLLAMA", "Copilot query completed")
        }
      }
    } catch (err: unknown) {
      const e = err as Error
      replyText = `**Error:** ${e.message || "Something went wrong."}`
      isError = true
      logSystemMessage("ERROR", e.message || "Copilot query failed")
    }

    appendMessage({
      sender: "copilot",
      text: replyText,
      timestamp: new Date().toLocaleTimeString(),
      isError,
      contextUsed: contextUsed.length > 0 ? contextUsed : undefined,
      actions: replyActions,
      tasksList: replyTasks,
    })
    setIsTyping(false)
  }

  const modelAvailable = hasAIProvider(provider, isOllamaOnline, apiKeys)

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: "24px", height: "calc(100vh - 120px)", overflow: "hidden" }}>

      {/* LEFT: Chat surface */}
      <div className="glass-card" style={{ display: "flex", flexDirection: "column", height: "100%", padding: "20px", background: "rgba(0,0,0,0.15)" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border-muted)", paddingBottom: "14px", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div className="copilot-avatar-ring" style={{ width: "24px", height: "24px", borderColor: "var(--accent-secondary)" }}>
              <Sparkles size={11} style={{ color: "var(--accent-secondary)" }} />
            </div>
            <div>
              <h3 style={{ fontSize: "13px", fontWeight: "700", fontFamily: "var(--font-display)", color: "#ffffff" }}>
                AI Workspace Copilot
              </h3>
              <span style={{ fontSize: "10px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                {provider.toUpperCase()} / {model || "default"} · {pages.length} pages indexed
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {/* Embed model status */}
            <span style={{
              fontSize: "9.5px", fontFamily: "var(--font-mono)", fontWeight: "700",
              color: EMBED_STATUS_COLOR[embedStatus],
              background: `${EMBED_STATUS_COLOR[embedStatus]}11`,
              border: `1px solid ${EMBED_STATUS_COLOR[embedStatus]}33`,
              padding: "2px 7px", borderRadius: "10px",
              display: "flex", alignItems: "center", gap: "4px"
            }}>
              <Cpu size={9} />
              {EMBED_STATUS_LABEL[embedStatus]}
            </span>

            <span style={{
              width: "6px", height: "6px", borderRadius: "50%",
              background: modelAvailable ? "var(--accent-success)" : "var(--accent-warning)",
              boxShadow: modelAvailable ? "0 0 8px var(--accent-success)" : "none",
              display: "inline-block"
            }} />
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", paddingRight: "10px", display: "flex", flexDirection: "column", gap: "16px", marginBottom: "20px" }}>
          {messages.map((msg, i) => {
            const isUser = msg.sender === "user"
            return (
              <div key={i} style={{
                display: "flex", gap: "12px",
                alignSelf: isUser ? "flex-end" : "flex-start",
                maxWidth: "88%",
                flexDirection: isUser ? "row-reverse" : "row",
                alignItems: "flex-start"
              }}>
                {isUser ? (
                  <div className="user-avatar-ring" title="You">
                    <User size={13} style={{ color: "var(--bg-primary)" }} />
                  </div>
                ) : (
                  <div className="copilot-avatar-ring" title="Copilot">
                    <Brain size={13} style={{ color: msg.isError ? "var(--accent-danger)" : "var(--accent-secondary)" }} />
                  </div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: isUser ? "flex-end" : "flex-start" }}>
                  <div style={{
                    background: isUser
                      ? "var(--accent-primary)"
                      : msg.isError
                        ? "rgba(239,68,68,0.06)"
                        : "rgba(255,255,255,0.035)",
                    color: isUser ? "var(--bg-primary)" : "var(--text-primary)",
                    border: isUser
                      ? "1px solid transparent"
                      : msg.isError
                        ? "1px solid rgba(239,68,68,0.2)"
                        : "1px solid var(--border-muted)",
                    padding: "12px 16px",
                    borderRadius: isUser ? "14px 14px 2px 14px" : "14px 14px 14px 2px",
                    fontSize: "13.5px", lineHeight: "1.6",
                    whiteSpace: "pre-wrap",
                    fontFamily: "var(--font-body)",
                  }}>
                    {msg.isError && (
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px", color: "var(--accent-danger)" }}>
                        <AlertCircle size={13} />
                        <span style={{ fontSize: "11px", fontWeight: "700" }}>Error</span>
                      </div>
                    )}
                    {msg.text}

                    {msg.tasksList && msg.tasksList.length > 0 && (
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

                  {/* Semantic context attribution */}
                  {msg.contextUsed && msg.contextUsed.length > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: "5px", flexWrap: "wrap", marginTop: "2px" }}>
                      <Search size={9} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                      {msg.contextUsed.map((title, idx) => (
                        <span key={idx} style={{
                          fontSize: "9.5px", color: "var(--accent-secondary)",
                          background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)",
                          padding: "1px 6px", borderRadius: "8px", fontFamily: "var(--font-mono)"
                        }}>
                          {title.length > 22 ? title.slice(0, 22) + "…" : title}
                        </span>
                      ))}
                    </div>
                  )}

                  {msg.actions && msg.actions.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "4px" }}>
                      {msg.actions.map((act, idx) => (
                        <button key={idx} onClick={act.action} className="action-pill-premium">
                          {act.label}
                        </button>
                      ))}
                    </div>
                  )}

                  <span style={{ fontSize: "9.5px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: "2px" }}>
                    {msg.timestamp}
                  </span>
                </div>
              </div>
            )
          })}

          {isTyping && (
            <div style={{ display: "flex", gap: "12px", alignSelf: "flex-start", alignItems: "center" }}>
              <div className="copilot-avatar-ring" style={{ width: "32px", height: "32px" }}>
                <Brain size={13} style={{ color: "var(--accent-secondary)" }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "rgba(255,255,255,0.02)", padding: "12px 18px", borderRadius: "14px 14px 14px 2px", border: "1px solid var(--border-muted)" }}>
                <div className="bouncing-dots-loader"><span /><span /><span /></div>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                  Thinking…
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSend} style={{ display: "flex", gap: "10px", borderTop: "1px solid var(--border-muted)", paddingTop: "14px" }}>
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder={
              modelAvailable
                ? embedStatus === "ready"
                  ? "Ask anything — semantic search will find relevant context automatically…"
                  : "Ask anything about your workspace…"
                : "Connect a model first (Ollama or API key in Settings)…"
            }
            className="input-premium"
            disabled={isTyping}
            style={{ flex: 1, padding: "12px 16px", fontSize: "13px" }}
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

      {/* RIGHT: Context panel */}
      <div className="glass-card" style={{ display: "flex", flexDirection: "column", height: "100%", padding: "20px", gap: "16px" }}>

        {/* Semantic status block */}
        <div style={{
          padding: "10px 12px", borderRadius: "8px",
          background: embedStatus === "ready" ? "rgba(16,185,129,0.05)" : "rgba(245,158,11,0.05)",
          border: `1px solid ${embedStatus === "ready" ? "rgba(16,185,129,0.2)" : "rgba(245,158,11,0.2)"}`,
          display: "flex", flexDirection: "column", gap: "4px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Search size={12} style={{ color: embedStatus === "ready" ? "var(--accent-success)" : "var(--accent-warning)" }} />
            <span style={{ fontSize: "11px", fontWeight: "700", color: embedStatus === "ready" ? "var(--accent-success)" : "var(--accent-warning)" }}>
              {embedStatus === "ready" ? "Semantic Search Active" : embedStatus === "loading" ? "Loading Embedding Model…" : "Semantic Search Offline"}
            </span>
          </div>
          <p style={{ fontSize: "10.5px", color: "var(--text-muted)", lineHeight: "1.4", margin: 0 }}>
            {embedStatus === "ready"
              ? `${pages.length} pages indexed. Relevant context is retrieved automatically for every query.`
              : embedStatus === "loading"
                ? "all-MiniLM-L6-v2 (~23 MB) is loading. Queries still work — semantic retrieval activates when ready."
                : "Embedding model not loaded. Queries use pinned pages only."}
          </p>
        </div>

        {/* Manual pins header */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", borderBottom: "1px solid var(--border-muted)", paddingBottom: "10px" }}>
          <Pin size={14} style={{ color: "var(--accent-secondary)" }} />
          <h3 style={{ fontSize: "13px", fontWeight: "700", fontFamily: "var(--font-display)" }}>
            Manual Pins
          </h3>
          {pinnedPages.length > 0 && (
            <span style={{
              marginLeft: "auto", fontSize: "10px", fontWeight: "700", fontFamily: "var(--font-mono)",
              background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.2)",
              color: "var(--accent-primary)", padding: "1px 7px", borderRadius: "10px"
            }}>
              {pinnedPages.length} PINNED
            </span>
          )}
        </div>

        <p style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: "1.5" }}>
          Pin pages to force-include them in every query, even if semantic search wouldn't retrieve them.
        </p>

        {!modelAvailable && (
          <div style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", padding: "10px 12px", borderRadius: "6px", fontSize: "11.5px", color: "var(--accent-warning)", lineHeight: "1.5" }}>
            No model connected. Launch Ollama or add an API key in Settings.
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "6px", overflowY: "auto", flex: 1 }}>
          {pages.length === 0 && (
            <span style={{ fontSize: "11px", color: "var(--text-muted)", textAlign: "center", padding: "10px" }}>
              No documents in workspace yet.
            </span>
          )}
          {pages.map((p) => {
            const isPinned = pinnedPages.includes(p.id)
            return (
              <button
                key={p.id}
                onClick={() => togglePin(p.id)}
                className={`sidebar-page-item ${isPinned ? "active" : ""}`}
                style={{ width: "100%", padding: "8px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12.5px" }}
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

        {/* Provider status */}
        <div style={{ borderTop: "1px solid var(--border-muted)", paddingTop: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
          <span style={{ fontSize: "9px", fontWeight: "700", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>ACTIVE ROUTE</span>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Activity size={12} style={{ color: "var(--accent-secondary)" }} />
            <span style={{ fontSize: "11.5px", color: "var(--text-secondary)", fontFamily: "var(--font-mono)", fontWeight: "600" }}>
              {provider.toUpperCase()} / {model || "default"}
            </span>
          </div>
        </div>
      </div>

    </div>
  )
}
