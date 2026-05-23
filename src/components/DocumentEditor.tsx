import { useState, useRef } from "react"
import { Sparkles, Edit3, Eye, FileText, Clock, HelpCircle, ArrowUpRight, Heading1, Heading2, ListTodo, Code, Calendar, Copy, Check, Download } from "lucide-react"
import { Page } from "../App"

interface DocumentEditorProps {
  page: Page
  onUpdatePage: (updatedPage: Page) => void
  provider: string
  model: string
  apiKeys: {
    openai: string
    anthropic: string
    gemini: string
  }
  onTriggerAI: (tool: "rewrite" | "ladder" | "decision" | "reading") => void
}

type EditMode = "edit" | "preview"

interface SlashOption {
  key: string
  label: string
  desc: string
  icon: React.ReactNode
  template: string
}

export default function DocumentEditor({ page, onUpdatePage, onTriggerAI }: DocumentEditorProps) {
  const [editMode, setEditMode] = useState<EditMode>("edit")
  const [showSlashMenu, setShowSlashMenu] = useState(false)
  const [slashSearch, setSlashSearch] = useState("")
  const [menuIndex, setMenuIndex] = useState(0)
  
  const [copiedRaw, setCopiedRaw] = useState(false)
  
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleCopyRaw = () => {
    navigator.clipboard.writeText(page.content)
    setCopiedRaw(true)
    setTimeout(() => setCopiedRaw(false), 2000)
  }

  const handleExportMarkdown = () => {
    const blob = new Blob([page.content], { type: "text/markdown;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${page.title.toLowerCase().replace(/\s+/g, "_")}.md`
    link.click()
    URL.revokeObjectURL(url)
  }

  // Floating Slash Command options inspired by Notion block types
  const slashOptions: SlashOption[] = [
    { key: "h1", label: "Heading 1", desc: "Large workspace header", icon: <Heading1 size={14} />, template: "# " },
    { key: "h2", label: "Heading 2", desc: "Medium section header", icon: <Heading2 size={14} />, template: "## " },
    { key: "todo", label: "To-Do Checklist", desc: "Task checklist item", icon: <ListTodo size={14} />, template: "- [ ] " },
    { key: "code", label: "Code Block", desc: "Monospace syntax block", icon: <Code size={14} />, template: "\n```javascript\n\n```\n" },
    { key: "time", label: "Current Time", desc: "Insert local timestamp", icon: <Calendar size={14} />, template: new Date().toLocaleString() },
    { key: "ai", label: "Ask Notion AI", desc: "Slide open AI Dialogue sidecar", icon: <Sparkles size={14} style={{ color: "var(--accent-primary)" }} />, template: "" }
  ]

  // Track text changes to trigger `/` popup
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value
    onUpdatePage({ ...page, content: text })

    const selectionStart = e.target.selectionStart
    const beforeCursor = text.substring(0, selectionStart)
    const lines = beforeCursor.split("\n")
    const activeLine = lines[lines.length - 1]

    if (activeLine.startsWith("/")) {
      setShowSlashMenu(true)
      setSlashSearch(activeLine.substring(1).toLowerCase())
      setMenuIndex(0)
    } else {
      setShowSlashMenu(false)
    }
  }

  // Handle Slash menu command execution
  const executeCommand = (option: SlashOption) => {
    if (!textareaRef.current) return
    const text = page.content
    const cursorPosition = textareaRef.current.selectionStart
    
    // Find index of `/` on the active line
    const beforeCursor = text.substring(0, cursorPosition)
    const lastSlashIdx = beforeCursor.lastIndexOf("/")

    if (lastSlashIdx !== -1) {
      if (option.key === "ai") {
        // Special case: Trigger AI Dialogue panel immediately
        onTriggerAI("rewrite")
        const cleanContent = text.substring(0, lastSlashIdx) + text.substring(cursorPosition)
        onUpdatePage({ ...page, content: cleanContent })
      } else {
        const insertion = option.template
        const newContent = text.substring(0, lastSlashIdx) + insertion + text.substring(cursorPosition)
        onUpdatePage({ ...page, content: newContent })
        
        // Reset cursor focus after state update
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.focus()
            const newCursor = lastSlashIdx + insertion.length
            textareaRef.current.setSelectionRange(newCursor, newCursor)
          }
        }, 50)
      }
    }
    setShowSlashMenu(false)
  }

  // Handle key listeners for navigation in popup
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSlashMenu) {
      const filtered = slashOptions.filter(opt => opt.label.toLowerCase().includes(slashSearch))
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setMenuIndex(prev => (prev + 1) % (filtered.length || 1))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setMenuIndex(prev => (prev - 1 + filtered.length) % (filtered.length || 1))
      } else if (e.key === "Enter") {
        e.preventDefault()
        if (filtered[menuIndex]) {
          executeCommand(filtered[menuIndex])
        }
      } else if (e.key === "Escape") {
        e.preventDefault()
        setShowSlashMenu(false)
      }
    }
  }

  // Selections filter
  const filteredOptions = slashOptions.filter(opt => opt.label.toLowerCase().includes(slashSearch))

  // Stats calculation
  const wordsCount = page.content.trim() ? page.content.trim().split(/\s+/).length : 0
  const charCount = page.content.length
  const readTime = Math.max(1, Math.round(wordsCount / 200))

  // Custom client Markdown parser compiling visual representations
  const renderMarkdownPreview = (text: string) => {
    const lines = text.split("\n")
    return lines.map((line, idx) => {
      // H1 Header
      if (line.startsWith("# ")) {
        return (
          <h1 key={idx} className="gradient-accent-text" style={{ fontSize: "28px", fontWeight: "800", marginTop: "24px", marginBottom: "12px", borderBottom: "1px solid var(--border-muted)", paddingBottom: "6px" }}>
            {line.substring(2)}
          </h1>
        )
      }
      // H2 Header
      if (line.startsWith("## ")) {
        return (
          <h2 key={idx} style={{ fontSize: "20px", fontWeight: "700", marginTop: "20px", marginBottom: "10px", color: "#ffffff" }}>
            {line.substring(3)}
          </h2>
        )
      }
      // Task Todo checklist item
      if (line.startsWith("- [ ] ") || line.startsWith("- [x] ")) {
        const checked = line.startsWith("- [x] ")
        return (
          <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: "10px", margin: "6px 0" }}>
            <input 
              type="checkbox" 
              checked={checked} 
              readOnly
              className="editor-todo-checkbox" 
            />
            <span style={{ fontSize: "14px", textDecoration: checked ? "line-through" : "none", color: checked ? "var(--text-muted)" : "var(--text-secondary)" }}>
              {line.substring(6)}
            </span>
          </div>
        )
      }
      // Bullet list
      if (line.startsWith("- ")) {
        return (
          <li key={idx} style={{ fontSize: "14px", color: "var(--text-secondary)", margin: "4px 0", marginLeft: "16px" }}>
            {line.substring(2)}
          </li>
        )
      }
      // Code blocks
      if (line.startsWith("```")) {
        return null // Simplify raw tags in compact previewer
      }
      // Clean spacing paragraphs
      return line.trim() === "" ? (
        <div key={idx} style={{ height: "12px" }}></div>
      ) : (
        <p key={idx} style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.7", margin: "8px 0" }}>
          {line}
        </p>
      )
    })
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", position: "relative" }}>
      
      {/* Editor Slate Header card */}
      <div className="glass-card" style={{ padding: "20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "70%" }}>
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
            placeholder="Untitled Document"
          />
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "2px" }}>
            <span className="priority-pill low" style={{ textTransform: "uppercase" }}>{page.type}</span>
            {page.tags?.map(t => (
              <span key={t} style={{ fontSize: "10px", color: "var(--text-muted)" }}>#{t}</span>
            ))}
          </div>
        </div>

        {/* Edit mode switches */}
        <div style={{ display: "flex", gap: "8px" }}>
          <div style={{ display: "flex", background: "rgba(255,255,255,0.02)", padding: "3px", borderRadius: "8px", border: "1px solid var(--border-muted)" }}>
            <button
              onClick={() => setEditMode("edit")}
              style={{
                padding: "6px 12px",
                fontSize: "11px",
                background: editMode === "edit" ? "rgba(255, 255, 255, 0.05)" : "transparent",
                border: "none",
                borderRadius: "6px",
                color: editMode === "edit" ? "#ffffff" : "var(--text-secondary)",
                cursor: "pointer",
                fontWeight: "700",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                transition: "var(--transition-smooth)"
              }}
            >
              <Edit3 size={12} />
              <span>EDIT</span>
            </button>

            <button
              onClick={() => setEditMode("preview")}
              style={{
                padding: "6px 12px",
                fontSize: "11px",
                background: editMode === "preview" ? "rgba(255, 255, 255, 0.05)" : "transparent",
                border: "none",
                borderRadius: "6px",
                color: editMode === "preview" ? "#ffffff" : "var(--text-secondary)",
                cursor: "pointer",
                fontWeight: "700",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                transition: "var(--transition-smooth)"
              }}
            >
              <Eye size={12} />
              <span>PREVIEW</span>
            </button>
          </div>

          <button
            onClick={handleCopyRaw}
            className="btn-secondary"
            style={{ padding: "8px 12px", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            {copiedRaw ? <Check size={12} style={{ color: "var(--accent-success)" }} /> : <Copy size={12} />}
            <span>{copiedRaw ? "Copied" : "Copy Raw"}</span>
          </button>

          <button
            onClick={handleExportMarkdown}
            className="btn-secondary"
            style={{ padding: "8px 12px", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <Download size={12} />
            <span>Export MD</span>
          </button>

          <button
            onClick={() => onTriggerAI("rewrite")}
            className="btn-premium"
            style={{ padding: "8px 14px", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <Sparkles size={12} />
            <span>Notion AI Refine</span>
          </button>
        </div>
      </div>

      {/* Writing board slate */}
      <div style={{ position: "relative" }}>
        
        {editMode === "edit" ? (
          <>
            <textarea
              ref={textareaRef}
              value={page.content}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              placeholder="Start drafting here... Type '/' to summon the Notion block dropdown."
              className="input-premium"
              style={{
                width: "100%",
                height: "460px",
                background: "rgba(0, 0, 0, 0.25)",
                border: "1px solid var(--border-muted)",
                borderRadius: "var(--radius-md)",
                color: "var(--text-primary)",
                padding: "20px",
                fontSize: "14.5px",
                fontFamily: "var(--font-body)",
                resize: "none",
                outline: "none",
                lineHeight: "1.7"
              }}
            />

            {/* Slash popover dropdown */}
            {showSlashMenu && filteredOptions.length > 0 && (
              <div 
                className="slash-popover"
                style={{
                  left: "24px",
                  bottom: "32px"
                }}
              >
                <div style={{ fontSize: "9px", color: "var(--text-muted)", padding: "4px 8px", fontWeight: "700", borderBottom: "1px solid var(--border-muted)", marginBottom: "4px" }}>
                  INSERT NOTION BLOCKS
                </div>
                {filteredOptions.map((opt, i) => (
                  <button
                    key={opt.key}
                    onClick={() => executeCommand(opt)}
                    className={`slash-item ${menuIndex === i ? "selected" : ""}`}
                  >
                    {opt.icon}
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span>{opt.label}</span>
                      <span style={{ fontSize: "9px", color: "var(--text-muted)" }}>{opt.desc}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          /* Preview Mode viewport compiles standard blocks representation */
          <div className="glass-card" style={{ padding: "30px", height: "460px", overflowY: "auto", background: "rgba(0,0,0,0.15)", border: "1px solid var(--border-muted)" }}>
            {page.content.trim() ? renderMarkdownPreview(page.content) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)", gap: "8px" }}>
                <HelpCircle size={22} style={{ opacity: 0.5 }} />
                <span style={{ fontSize: "13px" }}>This document card is empty. Hit 'Edit' tab to add thoughts.</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Editor Slate Status bar */}
      <div className="glass-card" style={{ padding: "10px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(0,0,0,0.3)" }}>
        <div style={{ display: "flex", gap: "16px", color: "var(--text-muted)", fontSize: "11px", fontFamily: "var(--font-mono)", fontWeight: "600" }}>
          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <FileText size={12} />
            <span>{wordsCount} WORDS</span>
          </span>
          <span>{charCount} CHARACTERS</span>
          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <Clock size={12} />
            <span>{readTime} MIN READ</span>
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "var(--text-secondary)", fontFamily: "var(--font-mono)", fontWeight: "600" }}>
          <span>SLASH MENU DETECTED:</span>
          <span style={{ color: "var(--accent-secondary)" }}>ACTIVE</span>
          <ArrowUpRight size={12} style={{ color: "var(--accent-secondary)" }} />
        </div>
      </div>

    </div>
  )
}
