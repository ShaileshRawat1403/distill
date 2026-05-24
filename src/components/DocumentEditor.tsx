import { useState, useRef, useEffect } from "react"
import { Sparkles, Edit3, Eye, FileText, Clock, HelpCircle, ArrowUpRight, Heading1, Heading2, ListTodo, Code, Calendar, Copy, Check, Download, BarChart2, Mail, Share2, CloudLightning, Send, X, BookOpen, Mic, MicOff, Printer, Play } from "lucide-react"
import { Page } from "../App"

interface DocumentEditorProps {
  page: Page
  pages: Page[]
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
type CompilerLayout = "arxiv" | "ieee" | "thesis"

interface SlashOption {
  key: string
  label: string
  desc: string
  icon: React.ReactNode
  template: string
}

export default function DocumentEditor({ page, pages, onUpdatePage, onTriggerAI }: DocumentEditorProps) {
  const [editMode, setEditMode] = useState<EditMode>("edit")
  const [showSlashMenu, setShowSlashMenu] = useState(false)
  const [slashSearch, setSlashSearch] = useState("")
  const [menuIndex, setMenuIndex] = useState(0)
  
  const [copiedRaw, setCopiedRaw] = useState(false)
  
  // Share & Email Dispatch states
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [emailRecipient, setEmailRecipient] = useState("")
  const [emailSubject, setEmailSubject] = useState(page.title)
  const [emailMessage, setEmailMessage] = useState("Hello,\n\nI wanted to share this note workspace page with you from my Distill environment.\n\nBest regards")
  const [isDispatching, setIsDispatching] = useState(false)
  const [dispatchComplete, setDispatchComplete] = useState(false)
  const [isBackingUpDrive, setIsBackingUpDrive] = useState(false)
  const [driveBackupComplete, setDriveBackupComplete] = useState(false)

  // Paperplane dispatcher flight animation flag
  const [triggerPlaneFly, setTriggerPlaneFly] = useState(false)

  // Voice-to-Text Dictation States
  const [isDictating, setIsDictating] = useState(false)
  const recognitionRef = useRef<any>(null)

  // Scholar's Sanctum States
  const [isAcademicHubOpen, setIsAcademicHubOpen] = useState(false)
  const [sanctumTab, setSanctumTab] = useState<"sources" | "compiler">("sources")
  const [compilerLayout, setCompilerLayout] = useState<CompilerLayout>("arxiv")
  const [isCompilerOpen, setIsCompilerOpen] = useState(false)

  const [citations, setCitations] = useState([
    { id: "c1", author: "Rawat, S.", title: "Autonomous Multi-Agent Networks", year: "2026", doi: "10.1007/s11276-026-04" },
    { id: "c2", author: "Layek, A.", title: "Decentralized Cached Index Topologies", year: "2026", doi: "10.1109/tsc.2026.1" },
    { id: "c3", author: "Borg, O.", title: "Glowmorphic Vector Processing", year: "2025", doi: "10.1145/3571884" }
  ])
  const [newAuthor, setNewAuthor] = useState("")
  const [newTitle, setNewTitle] = useState("")
  const [newYear, setNewYear] = useState("")
  const [newDoi, setNewDoi] = useState("")

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setEmailSubject(page.title)
    setDispatchComplete(false)
    setDriveBackupComplete(false)
    setAppendixInjected(false)
  }, [page])

  // Initialize Speech Recognition API
  useEffect(() => {
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = "en-US"

      recognition.onresult = (event: any) => {
        const textarea = textareaRef.current
        if (!textarea) return

        let interimTranscript = ""
        let finalTranscript = ""

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript
          } else {
            interimTranscript += event.results[i][0].transcript
          }
        }

        if (finalTranscript) {
          const text = page.content
          const start = textarea.selectionStart
          const end = textarea.selectionEnd
          const processedText = finalTranscript.startsWith(" ") ? finalTranscript : " " + finalTranscript
          const updatedContent = text.substring(0, start) + processedText + text.substring(end)
          
          onUpdatePage({ ...page, content: updatedContent })
          
          // Re-adjust caret position after appending text
          setTimeout(() => {
            textarea.focus()
            textarea.setSelectionRange(start + processedText.length, start + processedText.length)
          }, 40)
        }
      }

      recognition.onend = () => {
        setIsDictating(false)
      }

      recognitionRef.current = recognition
    }
  }, [page, onUpdatePage])

  // Toggle Voice Recognition Dictation
  const handleToggleDictation = () => {
    if (!recognitionRef.current) {
      alert("Browser native Web Speech API not supported on this browser context. Please use Chrome, Safari or Edge.")
      return
    }

    if (isDictating) {
      recognitionRef.current.stop()
      setIsDictating(false)
    } else {
      setEditMode("edit")
      setTimeout(() => {
        try {
          recognitionRef.current.start()
          setIsDictating(true)
        } catch {
          // Already running
        }
      }, 100)
    }
  }

  // Simulate dispatching email with paperplane fly animation
  const handleDispatchEmail = (e: React.FormEvent) => {
    e.preventDefault()
    if (!emailRecipient.trim()) return

    setIsDispatching(true)
    setDispatchComplete(false)
    setTriggerPlaneFly(true)

    setTimeout(() => {
      setIsDispatching(false)
      setDispatchComplete(true)
      setTriggerPlaneFly(false)
      
      const mailtoLink = `mailto:${emailRecipient}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(`${emailMessage}\n\n---\n\n${page.content}`)}`
      
      console.log(`Document dispatched successfully to ${emailRecipient}`)
      
      setTimeout(() => {
        window.location.href = mailtoLink
      }, 700)
    }, 1400)
  }

  // Simulate Drive Backup
  const handleBackupToDrive = () => {
    setIsBackingUpDrive(true)
    setDriveBackupComplete(false)
    setTimeout(() => {
      setIsBackingUpDrive(false)
      setDriveBackupComplete(true)
      console.log(`Backup completed to Google Drive: ${page.title}`)
    }, 1500)
  }

  // Prose Calculations
  const paragraphsCount = page.content.split(/\n\s*\n/).filter(Boolean).length
  const sentencesCount = page.content.split(/[.!?]+/).filter(s => s.trim().length > 0).length

  const calculateReadingLevel = () => {
    const words = wordsCount
    const sentences = sentencesCount || 1
    if (words < 10) return "Starter Scale"
    const wordsPerSentence = words / sentences
    const grade = Math.round(0.39 * wordsPerSentence + 11.8 * (15 / 100) - 15.59)
    const clamp = Math.max(5, Math.min(18, grade))
    if (clamp >= 17) return "PhD Scholar (17+)"
    if (clamp >= 15) return "Grad Student (15+)"
    if (clamp >= 12) return "University Level"
    if (clamp >= 9) return "High School"
    return "Middle School"
  }

  const scanPassiveVoice = () => {
    const matches = page.content.match(/\b(is|was|were|been|be|are|am|has\s+been|had\s+been|have\s+been)\s+([a-z]+ed|analyzed|established|verified|developed|created|written|run|pushed|saved|compiled|built)\b/gi)
    return matches ? matches.length : 0
  }

  // Insert Inline Citation
  const insertInlineCitation = (citation: typeof citations[0]) => {
    const textarea = textareaRef.current
    if (!textarea) return
    
    const text = page.content
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    
    const inlineStr = ` [${citation.author.split(",")[0]} et al., ${citation.year}]`
    const updatedContent = text.substring(0, start) + inlineStr + text.substring(end)
    
    onUpdatePage({ ...page, content: updatedContent })
    
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + inlineStr.length, start + inlineStr.length)
    }, 50)
  }

  // Compile bibliography references
  const [appendixInjected, setAppendixInjected] = useState(false)

  const handleCompileBibliography = () => {
    if (page.content.includes("### References") || page.content.includes("### Bibliography")) {
      alert("References bibliography are already compiled inside this document!")
      return
    }
    
    let bibText = "\n\n### References\n"
    citations.forEach((c, index) => {
      bibText += `${index + 1}. ${c.author} (${c.year}). *"${c.title}"*. DOI: [${c.doi}](https://doi.org/${c.doi})\n`
    })
    
    onUpdatePage({ ...page, content: page.content + bibText })
    setAppendixInjected(true)
  }

  // Add a citation reference source
  const handleAddCitation = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newAuthor.trim() || !newTitle.trim() || !newYear.trim()) return

    const newCitation = {
      id: Math.random().toString(36).substring(2, 9),
      author: newAuthor.trim(),
      title: newTitle.trim(),
      year: newYear.trim(),
      doi: newDoi.trim() || "10.1145/unknown"
    }

    setCitations(prev => [...prev, newCitation])
    setNewAuthor("")
    setNewTitle("")
    setNewYear("")
    setNewDoi("")
  }

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

  // Hidden print iframe compiler logic
  const handlePrintPDF = () => {
    const printContent = document.getElementById("academic-preview-sheet")?.innerHTML || ""
    
    // Create print-specific iframe
    const iframe = document.createElement("iframe")
    iframe.style.position = "fixed"
    iframe.style.right = "0"
    iframe.style.bottom = "0"
    iframe.style.width = "0"
    iframe.style.height = "0"
    iframe.style.border = "none"
    document.body.appendChild(iframe)

    const doc = iframe.contentWindow?.document
    if (doc) {
      doc.open()
      doc.write(`
        <html>
          <head>
            <title>${page.title}</title>
            <style>
              body {
                font-family: "Times New Roman", Times, Georgia, serif;
                color: #000000;
                background: #ffffff;
                padding: 2.2cm 2cm;
                line-height: 1.6;
                font-size: 11pt;
              }
              h1, h2, h3, h4 {
                font-family: "Times New Roman", serif;
                color: #000000;
                font-weight: bold;
              }
              h1 {
                font-size: 20pt;
                text-align: center;
                margin-bottom: 0.8cm;
              }
              h2 {
                font-size: 14pt;
                margin-top: 1.2cm;
                border-bottom: 0.5px solid #333333;
                padding-bottom: 4px;
              }
              p {
                margin: 0.6em 0;
                text-align: justify;
              }
              
              /* NEURIPS / ARXIV PREPRINT STYLES */
              ${compilerLayout === "arxiv" ? `
                body {
                  max-width: 17cm;
                  margin: 0 auto;
                }
                .abstract-block {
                  background: #f8f9fa;
                  border: 1px solid #e9ecef;
                  padding: 18px;
                  margin: 1.5cm 0;
                  border-radius: 4px;
                  font-size: 10pt;
                }
                .abstract-title {
                  font-weight: bold;
                  text-align: center;
                  margin-bottom: 6px;
                  text-transform: uppercase;
                  letter-spacing: 0.08em;
                }
              ` : ""}

              /* IEEE DOUBLE COLUMN STYLES */
              ${compilerLayout === "ieee" ? `
                body {
                  column-count: 2;
                  column-gap: 1.2cm;
                  padding: 1.6cm 1.4cm;
                  font-size: 9.5pt;
                }
                .title-header-block {
                  column-span: all;
                  text-align: center;
                  margin-bottom: 1.2cm;
                }
                .abstract-block {
                  font-weight: bold;
                  margin-bottom: 1cm;
                }
                h2 {
                  text-transform: uppercase;
                  font-size: 10pt;
                  text-align: center;
                  border-bottom: none;
                }
              ` : ""}

              /* PHD DISSERTATION BOUNDS */
              ${compilerLayout === "thesis" ? `
                body {
                  font-size: 12pt;
                  line-height: 1.95;
                  padding-left: 3.5cm; /* left binding margin safety */
                }
                h1 {
                  font-size: 22pt;
                  text-transform: uppercase;
                  margin-top: 4cm;
                  margin-bottom: 1.5cm;
                }
                h2 {
                  font-size: 15pt;
                  margin-top: 1.5cm;
                }
              ` : ""}

              .math-block {
                text-align: center;
                font-family: "Cambria Math", "Times New Roman", serif;
                font-size: 12pt;
                margin: 1.4em 0;
                font-style: italic;
                display: flex;
                align-items: center;
                justify-content: center;
                position: relative;
              }
              .math-number {
                position: absolute;
                right: 0;
                font-style: normal;
              }
            </style>
          </head>
          <body>
            <div class="${compilerLayout === "ieee" ? "title-header-block" : ""}">
              <h1>${page.title.replace(/^[^\w]*/, "")}</h1>
              <div style="text-align: center; font-size: 10pt; color: #555555; margin-bottom: 1.5em; font-family: sans-serif;">
                <strong>Distill AI Workspace Collaborators</strong> &bull; Seseeded Research preprint
              </div>
            </div>
            ${printContent}
          </body>
        </html>
      `)
      doc.close()

      // Fire browser printing sheet
      setTimeout(() => {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
        document.body.removeChild(iframe)
      }, 400)
    }
  }

  // Floating Slash Command options inspired by Distill block types
  const slashOptions: SlashOption[] = [
    { key: "h1", label: "Heading 1", desc: "Large workspace header", icon: <Heading1 size={14} />, template: "# " },
    { key: "h2", label: "Heading 2", desc: "Medium section header", icon: <Heading2 size={14} />, template: "## " },
    { key: "todo", label: "To-Do Checklist", desc: "Task checklist item", icon: <ListTodo size={14} />, template: "- [ ] " },
    { key: "code", label: "Code Block", desc: "Monospace syntax block", icon: <Code size={14} />, template: "\n```javascript\n\n```\n" },
    { key: "chart", label: "Interactive Database Chart", desc: "Embed dynamic visual database chart block", icon: <BarChart2 size={14} style={{ color: "var(--accent-success)" }} />, template: "\n[chart]\n" },
    { key: "time", label: "Current Time", desc: "Insert local timestamp", icon: <Calendar size={14} />, template: new Date().toLocaleString() },
    { key: "ai", label: "Ask Distill AI", desc: "Slide open AI Dialogue sidecar", icon: <Sparkles size={14} style={{ color: "var(--accent-primary)" }} />, template: "" }
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
  const renderMarkdownPreview = (text: string, isCompiler: boolean = false) => {
    const lines = text.split("\n")
    let inAbstract = false
    let equationIndex = 0

    return lines.map((line, idx) => {
      // Inline equation or TeX math blocks parsing
      if (line.startsWith("$$") || line.endsWith("$$")) {
        const formula = line.replace(/\$\$/g, "").trim()
        if (!formula) return null
        equationIndex++
        return (
          <div 
            key={idx} 
            className="math-block" 
            style={{ 
              textAlign: "center", 
              fontFamily: '"Cambria Math", "Times New Roman", Times, serif', 
              fontSize: isCompiler ? "16px" : "15px", 
              margin: "18px 0",
              color: isCompiler ? "#000000" : "var(--text-primary)",
              fontStyle: "italic",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative"
            }}
          >
            <span>{formula}</span>
            <span style={{ position: "absolute", right: "10px", fontStyle: "normal", fontSize: "12px", opacity: 0.6 }}>
              ({equationIndex})
            </span>
          </div>
        )
      }

      // Special abstract block markers
      if (line.startsWith("### Abstract")) {
        inAbstract = true
        return (
          <div key={idx} className="abstract-block" style={{ 
            background: isCompiler ? "#f8f9fa" : "rgba(255,255,255,0.02)",
            border: isCompiler ? "1px solid #e9ecef" : "1px solid var(--border-muted)",
            padding: "16px",
            margin: "20px 0",
            borderRadius: "4px",
            fontSize: "13.5px",
            color: isCompiler ? "#000000" : "var(--text-secondary)"
          }}>
            <div style={{ fontWeight: "bold", textAlign: "center", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.08em", color: isCompiler ? "#000" : "var(--text-primary)" }}>
              Abstract
            </div>
            <p style={{ margin: 0, textAlign: "justify", fontStyle: isCompiler ? "italic" : "normal" }}>
              {line.substring(12).trim() || lines[idx+1] || ""}
            </p>
          </div>
        )
      }

      if (inAbstract && line.trim() === "") {
        inAbstract = false
      }

      // Skip lines that have been processed inside Abstract block
      if (inAbstract && !line.startsWith("### Abstract")) return null

      // Interactive [chart] block compiler
      if (line.trim() === "[chart]") {
        if (isCompiler) return null // Hide chart widgets in printed academic layout papers!
        const tablePage = pages.find(p => p.type === "table" && p.rows && p.rows.length > 0)
        if (!tablePage || !tablePage.rows) {
          return (
            <div key={idx} className="glass-card" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "10px", margin: "16px 0", background: "rgba(0,0,0,0.2)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <BarChart2 size={16} style={{ color: "var(--accent-warning)" }} />
                <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-primary)" }}>Interactive Database Chart</span>
              </div>
              <span style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.5" }}>
                Active reference tables not found. Please **create a new Table block** in your sidebar and add rows to dynamically render visual data diagrams!
              </span>
            </div>
          )
        }

        // Count row statuses
        const statusMap = { "To-Do": 0, "In Progress": 0, "Done": 0 }
        tablePage.rows.forEach(r => {
          if (r.status === "Done") statusMap["Done"]++
          else if (r.status === "In Progress" || r.status === "In-Progress") statusMap["In Progress"]++
          else statusMap["To-Do"]++
        })

        const maxVal = Math.max(1, statusMap["To-Do"], statusMap["In Progress"], statusMap["Done"])
        const pctToDo = (statusMap["To-Do"] / maxVal) * 100
        const pctProgress = (statusMap["In Progress"] / maxVal) * 100
        const pctDone = (statusMap["Done"] / maxVal) * 100

        return (
          <div key={idx} className="glass-card" style={{ padding: "24px", margin: "20px 0", display: "flex", flexDirection: "column", gap: "16px", background: "rgba(0,0,0,0.25)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <BarChart2 size={16} style={{ color: "var(--accent-success)" }} />
                <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-primary)" }}>
                  Status Distribution: {tablePage.title.replace(/^[^\w]*/, "")}
                </span>
              </div>
              <span style={{ fontSize: "10px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontWeight: "600" }}>
                LIVE DATABASE WIDGET
              </span>
            </div>

            {/* Glowing SVG Charts Canvas */}
            <div style={{ display: "flex", justifyContent: "space-around", alignItems: "flex-end", height: "140px", padding: "10px 0", borderBottom: "1px solid var(--border-muted)" }}>
              {/* Bar 1: To-Do */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", width: "25%" }}>
                <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--accent-warning)" }}>{statusMap["To-Do"]}</div>
                <div style={{ 
                  width: "28px", 
                  height: `${Math.max(6, pctToDo * 0.9)}px`, 
                  background: "rgba(245, 158, 11, 0.2)",
                  border: "1px solid var(--accent-warning)",
                  borderRadius: "4px 4px 0 0",
                  transition: "height 0.5s ease",
                  boxShadow: "0 0 10px rgba(245, 158, 11, 0.1)"
                }}></div>
                <span style={{ fontSize: "10.5px", color: "var(--text-secondary)", fontWeight: "600" }}>To-Do</span>
              </div>

              {/* Bar 2: In Progress */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", width: "25%" }}>
                <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--accent-info)" }}>{statusMap["In Progress"]}</div>
                <div style={{ 
                  width: "28px", 
                  height: `${Math.max(6, pctProgress * 0.9)}px`, 
                  background: "rgba(59, 130, 246, 0.2)",
                  border: "1px solid var(--accent-info)",
                  borderRadius: "4px 4px 0 0",
                  transition: "height 0.5s ease",
                  boxShadow: "0 0 10px rgba(59, 130, 246, 0.1)"
                }}></div>
                <span style={{ fontSize: "10.5px", color: "var(--text-secondary)", fontWeight: "600" }}>In Progress</span>
              </div>

              {/* Bar 3: Done */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", width: "25%" }}>
                <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--accent-success)" }}>{statusMap["Done"]}</div>
                <div style={{ 
                  width: "28px", 
                  height: `${Math.max(6, pctDone * 0.9)}px`, 
                  background: "rgba(16, 185, 129, 0.2)",
                  border: "1px solid var(--accent-success)",
                  borderRadius: "4px 4px 0 0",
                  transition: "height 0.5s ease",
                  boxShadow: "0 0 10px rgba(16, 185, 129, 0.1)"
                }}></div>
                <span style={{ fontSize: "10.5px", color: "var(--text-secondary)", fontWeight: "600" }}>Done</span>
              </div>
            </div>
          </div>
        )
      }

      // H1 Header
      if (line.startsWith("# ")) {
        return (
          <h1 
            key={idx} 
            className={isCompiler ? "" : "gradient-accent-text"} 
            style={{ 
              fontSize: isCompiler ? "22px" : "28px", 
              fontWeight: "800", 
              marginTop: "24px", 
              marginBottom: "12px", 
              borderBottom: isCompiler ? "none" : "1px solid var(--border-muted)", 
              paddingBottom: "6px",
              color: isCompiler ? "#000" : "var(--text-primary)",
              textAlign: isCompiler ? "center" : "left",
              fontFamily: isCompiler ? '"Times New Roman", Times, serif' : 'var(--font-display)'
            }}
          >
            {line.substring(2)}
          </h1>
        )
      }
      // H2 Header
      if (line.startsWith("## ")) {
        return (
          <h2 
            key={idx} 
            style={{ 
              fontSize: isCompiler ? "16px" : "20px", 
              fontWeight: "700", 
              marginTop: "20px", 
              marginBottom: "10px", 
              color: isCompiler ? "#000" : "var(--text-primary)",
              fontFamily: isCompiler ? '"Times New Roman", Times, serif' : 'var(--font-display)',
              borderBottom: isCompiler && compilerLayout === "ieee" ? "none" : isCompiler ? "0.5px solid #aaa" : "none",
              textTransform: isCompiler && compilerLayout === "ieee" ? "uppercase" : "none",
              textAlign: isCompiler && compilerLayout === "ieee" ? "center" : "left",
            }}
          >
            {line.substring(3)}
          </h2>
        )
      }
      // Task Todo checklist item
      if (line.startsWith("- [ ] ") || line.startsWith("- [x] ")) {
        const checked = line.startsWith("- [x] ")
        return (
          <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: "10px", margin: "6px 0" }}>
            {!isCompiler && (
              <input 
                type="checkbox" 
                checked={checked} 
                readOnly
                className="editor-todo-checkbox" 
              />
            )}
            <span 
              style={{ 
                fontSize: "14px", 
                textDecoration: checked && !isCompiler ? "line-through" : "none", 
                color: isCompiler ? "#111" : checked ? "var(--text-muted)" : "var(--text-secondary)",
                paddingLeft: isCompiler ? "12px" : "0"
              }}
            >
              {isCompiler ? `\u2022 ${line.substring(6)}` : line.substring(6)}
            </span>
          </div>
        )
      }
      // Bullet list
      if (line.startsWith("- ")) {
        return (
          <li 
            key={idx} 
            style={{ 
              fontSize: "14px", 
              color: isCompiler ? "#111" : "var(--text-secondary)", 
              margin: "4px 0", 
              marginLeft: "16px",
              listStyleType: isCompiler ? "disc" : "square"
            }}
          >
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
        <p 
          key={idx} 
          style={{ 
            fontSize: isCompiler ? "14.5px" : "14px", 
            color: isCompiler ? "#111" : "var(--text-secondary)", 
            lineHeight: isCompiler && compilerLayout === "thesis" ? "1.9" : "1.7", 
            margin: "8px 0",
            textAlign: isCompiler ? "justify" : "left",
            fontFamily: isCompiler ? '"Times New Roman", Times, Georgia, serif' : 'inherit'
          }}
        >
          {line}
        </p>
      )
    })
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", position: "relative" }}>
      
      {/* Editor Slate Header card */}
      <div className="glass-card" style={{ padding: "20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "50%" }}>
          <input
            type="text"
            value={page.title}
            onChange={(e) => onUpdatePage({ ...page, title: e.target.value })}
            style={{ 
              background: "transparent", 
              border: "none", 
              fontSize: "20px", 
              fontWeight: "800", 
              color: "var(--text-primary)", 
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
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          
          {/* Voice dictation companion trigger button */}
          <button
            onClick={handleToggleDictation}
            className={`btn-secondary ${isDictating ? "active" : ""}`}
            style={{
              padding: "8px 12px",
              fontSize: "12px",
              borderColor: isDictating ? "rgba(239, 68, 68, 0.4)" : "var(--border-muted)",
              boxShadow: isDictating ? "0 0 10px rgba(239,68,68,0.2)" : "none",
              color: isDictating ? "var(--accent-danger)" : "var(--text-primary)",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px"
            }}
            title={isDictating ? "Stop speech recognition dictation" : "Initiate live voice dictation"}
          >
            {isDictating ? (
              <>
                <MicOff size={13} style={{ animation: "pulse 1s infinite" }} />
                <span>Stop Dictating</span>
              </>
            ) : (
              <>
                <Mic size={13} />
                <span>Dictate Text</span>
              </>
            )}
          </button>

          <div style={{ display: "flex", background: "rgba(255,255,255,0.02)", padding: "3px", borderRadius: "8px", border: "1px solid var(--border-muted)" }}>
            <button
              onClick={() => setEditMode("edit")}
              style={{
                padding: "6px 12px",
                fontSize: "11px",
                background: editMode === "edit" ? "var(--text-primary)" : "transparent",
                border: "none",
                borderRadius: "6px",
                color: editMode === "edit" ? "var(--bg-primary)" : "var(--text-secondary)",
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
                background: editMode === "preview" ? "var(--text-primary)" : "transparent",
                border: "none",
                borderRadius: "6px",
                color: editMode === "preview" ? "var(--bg-primary)" : "var(--text-secondary)",
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
            onClick={() => setIsShareOpen(true)}
            className="btn-secondary"
            style={{ padding: "8px 12px", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <Share2 size={12} />
            <span>Share</span>
          </button>

          <button
            onClick={() => setIsAcademicHubOpen(true)}
            className="btn-secondary"
            style={{ padding: "8px 12px", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <BookOpen size={12} style={{ color: "var(--accent-primary)" }} />
            <span>Scholar's Sanctum</span>
          </button>

          <button
            onClick={() => onTriggerAI("rewrite")}
            className="btn-premium"
            style={{ padding: "8px 14px", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <Sparkles size={12} />
            <span>Refine</span>
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
              placeholder="Start drafting here... Type '/' to summon the Distill block dropdown."
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
                  INSERT DISTILL BLOCKS
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
        <div style={{ display: "flex", gap: "16px", color: "var(--text-muted)", fontSize: "11px", fontFamily: "var(--font-mono)", fontWeight: "600", alignItems: "center" }}>
          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <FileText size={12} />
            <span>{wordsCount} WORDS</span>
          </span>
          <span>{charCount} CHARACTERS</span>
          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <Clock size={12} />
            <span>{readTime} MIN READ</span>
          </span>
          
          {/* Speech Equalizer Ripple bar animation */}
          {isDictating && (
            <div style={{ display: "flex", gap: "2.5px", alignItems: "flex-end", height: "10px", marginLeft: "14px" }}>
              <span className="equalizer-bar" style={{ animationDelay: "0.1s" }} />
              <span className="equalizer-bar" style={{ animationDelay: "0.3s" }} />
              <span className="equalizer-bar" style={{ animationDelay: "0.5s" }} />
              <span className="equalizer-bar" style={{ animationDelay: "0.2s" }} />
              <span className="equalizer-bar" style={{ animationDelay: "0.4s" }} />
              <span style={{ fontSize: "9px", fontFamily: "var(--font-mono)", color: "var(--accent-danger)", paddingLeft: "4px", alignSelf: "center", fontWeight: "700" }}>LISTENING LIVE</span>
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "var(--text-secondary)", fontFamily: "var(--font-mono)", fontWeight: "600" }}>
          <span>SLASH MENU DETECTED:</span>
          <span style={{ color: "var(--accent-secondary)" }}>ACTIVE</span>
          <ArrowUpRight size={12} style={{ color: "var(--accent-secondary)" }} />
        </div>
      </div>

      {/* Premium Sliding Share & Document Dispatch Drawer */}
      <aside className={`share-drawer ${isShareOpen ? "" : "closed"}`}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border-muted)", paddingBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Share2 size={16} style={{ color: "var(--accent-primary)" }} />
            <span style={{ fontSize: "14px", fontWeight: "700", fontFamily: "var(--font-display)", color: "var(--text-primary)" }}>
              Share & Dispatch Note
            </span>
          </div>
          <button 
            onClick={() => setIsShareOpen(false)}
            style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Dispatch Progress Tracker */}
        <div style={{ padding: "4px 0", display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontWeight: "bold" }}>
            <span>PROGRESS TRACK:</span>
            <span style={{ color: isDispatching ? "var(--accent-secondary)" : dispatchComplete ? "var(--accent-success)" : "var(--text-muted)" }}>
              {isDispatching ? "IN-FLIGHT DISPATCH" : dispatchComplete ? "DELIVERED TO PUBLISHER" : "DRAFT QUEUED"}
            </span>
          </div>
          <div style={{ height: "4px", background: "rgba(255,255,255,0.03)", borderRadius: "2px", overflow: "hidden", border: "1px solid var(--border-muted)" }}>
            <div style={{ width: isDispatching ? "55%" : dispatchComplete ? "100%" : "15%", height: "100%", background: dispatchComplete ? "var(--accent-success)" : "var(--accent-primary)", transition: "width 1s cubic-bezier(0.16, 1, 0.3, 1)" }} />
          </div>
        </div>

        {/* Google Drive quick backup */}
        <div className="glass-card" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "10px", background: "rgba(0,0,0,0.15)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <CloudLightning size={14} style={{ color: "var(--accent-success)" }} />
            <span style={{ fontSize: "12px", fontWeight: "650", color: "var(--text-primary)" }}>Google Drive Sync</span>
          </div>
          <p style={{ fontSize: "11px", color: "var(--text-secondary)", lineHeight: "1.4" }}>
            Instantly sync and create a backup copy of this document note directly in Google Drive cloud storage.
          </p>
          <button
            onClick={handleBackupToDrive}
            disabled={isBackingUpDrive}
            className="btn-premium"
            style={{ width: "100%", fontSize: "11px", padding: "6px 12px", background: driveBackupComplete ? "rgba(16, 185, 129, 0.1)" : "var(--accent-primary)", border: driveBackupComplete ? "1px solid var(--accent-success)" : "none", color: driveBackupComplete ? "var(--accent-success)" : "var(--bg-primary)" }}
          >
            {isBackingUpDrive ? "Syncing..." : driveBackupComplete ? "Synced to Drive!" : "Sync to Google Drive"}
          </button>
        </div>

        {/* Email Dispatch form */}
        <form onSubmit={handleDispatchEmail} style={{ display: "flex", flexDirection: "column", gap: "14px", flex: 1, position: "relative" }}>
          
          {/* Cyberpunk Paperplane fly flight overlay */}
          {triggerPlaneFly && (
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(10,8,20,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, borderRadius: "8px" }}>
              <Send 
                size={36} 
                style={{ 
                  color: "var(--accent-primary)", 
                  animation: "flyOff 1.3s cubic-bezier(0.16, 1, 0.3, 1) forwards" 
                }} 
              />
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Mail size={14} style={{ color: "var(--accent-primary)" }} />
            <span style={{ fontSize: "12px", fontWeight: "650", color: "var(--text-primary)" }}>Email Document</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "10px", color: "var(--text-secondary)", fontWeight: "700" }}>RECIPIENT EMAIL</label>
            <input
              type="email"
              value={emailRecipient}
              onChange={(e) => setEmailRecipient(e.target.value)}
              placeholder="e.g. partner@enterprise.com"
              className="input-premium"
              required
              style={{ padding: "8px 10px", fontSize: "12.5px" }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "10px", color: "var(--text-secondary)", fontWeight: "700" }}>SUBJECT</label>
            <input
              type="text"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              placeholder="Email Subject"
              className="input-premium"
              required
              style={{ padding: "8px 10px", fontSize: "12.5px" }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1 }}>
            <label style={{ fontSize: "10px", color: "var(--text-secondary)", fontWeight: "700" }}>MESSAGE INTRO</label>
            <textarea
              value={emailMessage}
              onChange={(e) => setEmailMessage(e.target.value)}
              className="input-premium"
              style={{ padding: "8px 10px", fontSize: "12.5px", resize: "none", height: "100px", fontFamily: "var(--font-body)" }}
            />
          </div>

          <button
            type="submit"
            disabled={isDispatching}
            className="btn-premium"
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
          >
            {isDispatching ? (
              <span>Dispatching note...</span>
            ) : dispatchComplete ? (
              <>
                <Check size={13} style={{ color: "var(--accent-success)" }} />
                <span>Dispatched successfully!</span>
              </>
            ) : (
              <>
                <Mail size={13} />
                <span>Dispatch Document</span>
              </>
            )}
          </button>
        </form>
      </aside>

      {/* Premium Sliding Scholar's Sanctum (Academic & Reference Hub) Drawer */}
      <aside className={`share-drawer ${isAcademicHubOpen ? "" : "closed"}`}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border-muted)", paddingBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <BookOpen size={16} style={{ color: "var(--accent-primary)" }} />
            <span style={{ fontSize: "14px", fontWeight: "700", fontFamily: "var(--font-display)", color: "var(--text-primary)" }}>
              Scholar's Sanctum
            </span>
          </div>
          <button 
            onClick={() => setIsAcademicHubOpen(false)}
            style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs for Sanctum Drawer */}
        <div style={{ display: "flex", gap: "4px", background: "rgba(0,0,0,0.3)", padding: "2px", borderRadius: "6px", border: "1px solid var(--border-muted)" }}>
          <button
            onClick={() => setSanctumTab("sources")}
            className={`btn-secondary ${sanctumTab === "sources" ? "active" : ""}`}
            style={{ flex: 1, padding: "6px", fontSize: "11px", border: "none", background: sanctumTab === "sources" ? "var(--text-primary)" : "transparent", color: sanctumTab === "sources" ? "var(--bg-primary)" : "var(--text-primary)" }}
          >
            Sources & Audits
          </button>
          <button
            onClick={() => setSanctumTab("compiler")}
            className={`btn-secondary ${sanctumTab === "compiler" ? "active" : ""}`}
            style={{ flex: 1, padding: "6px", fontSize: "11px", border: "none", background: sanctumTab === "compiler" ? "var(--text-primary)" : "transparent", color: sanctumTab === "compiler" ? "var(--bg-primary)" : "var(--text-primary)" }}
          >
            TeX PDF Compiler
          </button>
        </div>

        {sanctumTab === "sources" ? (
          <>
            {/* Prose Audit HUD */}
            <div className="prose-analytics-card" style={{ marginTop: "4px" }}>
              <div style={{ fontSize: "10.5px", fontWeight: "700", color: "var(--text-primary)", borderBottom: "1px solid var(--border-muted)", paddingBottom: "6px", fontFamily: "var(--font-mono)", letterSpacing: "0.08em" }}>
                PROSE AUDIT HUD METRICS
              </div>
              <div className="prose-audit-metric-row">
                <span className="prose-audit-label">EST. READING GRADE</span>
                <span className="prose-audit-value">{calculateReadingLevel()}</span>
              </div>
              <div className="prose-audit-metric-row">
                <span className="prose-audit-label">PASSIVE VOICE DETECTED</span>
                <span className={`prose-audit-value ${scanPassiveVoice() > 3 ? "warning" : ""}`}>
                  {scanPassiveVoice()} PHRASES
                </span>
              </div>
              <div className="prose-audit-metric-row">
                <span className="prose-audit-label">PARAGRAPHS TOTAL</span>
                <span className="prose-audit-value">{paragraphsCount} BLOCKS</span>
              </div>
              <div className="prose-audit-metric-row">
                <span className="prose-audit-label">SENTENCES SCANNED</span>
                <span className="prose-audit-value">{sentencesCount} CLAUSES</span>
              </div>
            </div>

            {/* Citations List reference manager */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", flex: 1, overflowY: "auto", paddingRight: "2px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "10.5px", color: "var(--text-secondary)", fontWeight: "700", fontFamily: "var(--font-mono)" }}>
                  BIBLIOGRAPHY SOURCES ({citations.length})
                </span>
                
                {!appendixInjected ? (
                  <button
                    type="button"
                    onClick={handleCompileBibliography}
                    className="action-pill-premium"
                    style={{ fontSize: "9.5px", padding: "2px 8px" }}
                    title="Compile all references as APA/IEEE bibliography at bottom of text"
                  >
                    Compile References
                  </button>
                ) : (
                  <span style={{ fontSize: "9.5px", color: "var(--accent-success)", fontFamily: "var(--font-mono)", fontWeight: "700" }}>COMPILED ✓</span>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {citations.map(c => (
                  <div key={c.id} className="citation-row-item">
                    <div style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-primary)" }}>{c.title}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "10px", color: "var(--text-muted)", marginTop: "2px" }}>
                      <span>{c.author} ({c.year})</span>
                      <button
                        type="button"
                        disabled={editMode !== "edit"}
                        onClick={() => insertInlineCitation(c)}
                        className="action-pill-premium"
                        style={{ fontSize: "9px", padding: "1px 6px" }}
                        title="Insert inline citation at cursor position"
                      >
                        Insert inline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Add Source form */}
            <form onSubmit={handleAddCitation} style={{ borderTop: "1px solid var(--border-muted)", paddingTop: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <span style={{ fontSize: "10px", color: "var(--text-secondary)", fontWeight: "700", fontFamily: "var(--font-mono)" }}>
                ADD CITATION SOURCE
              </span>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "8px" }}>
                <input
                  type="text"
                  value={newAuthor}
                  onChange={(e) => setNewAuthor(e.target.value)}
                  placeholder="e.g. Rawat, S."
                  className="input-premium"
                  required
                  style={{ padding: "6px 8px", fontSize: "11.5px" }}
                />
                <input
                  type="text"
                  value={newYear}
                  onChange={(e) => setNewYear(e.target.value)}
                  placeholder="Year"
                  className="input-premium"
                  required
                  style={{ padding: "6px 8px", fontSize: "11.5px" }}
                />
              </div>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Paper title"
                className="input-premium"
                required
                style={{ padding: "6px 8px", fontSize: "11.5px" }}
              />
              <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr", gap: "8px" }}>
                <input
                  type="text"
                  value={newDoi}
                  onChange={(e) => setNewDoi(e.target.value)}
                  placeholder="DOI (e.g. 10.1109/tsc...)"
                  className="input-premium"
                  style={{ padding: "6px 8px", fontSize: "11.5px" }}
                />
                <button type="submit" className="btn-premium" style={{ padding: "6px", fontSize: "11.5px" }}>Add</button>
              </div>
            </form>
          </>
        ) : (
          /* TeX Academic compiler tab */
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "10px", flex: 1 }}>
            <span style={{ fontSize: "10px", color: "var(--text-secondary)", fontWeight: "700", fontFamily: "var(--font-mono)" }}>
              AI DISSERTATION PDF COMPILER
            </span>

            <p style={{ fontSize: "11.5px", color: "var(--text-muted)", lineHeight: "1.5" }}>
              Compile mathematical notation, citations, and abstracts into professional AI publications using high-end academic templates.
            </p>

            {/* Layout selector presets */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <span style={{ fontSize: "9.5px", color: "var(--text-secondary)", fontWeight: "bold" }}>CHOOSE PAPER TEMPLATE LAYOUT:</span>
              
              {[
                { key: "arxiv", label: "NeurIPS AI Preprint", desc: "ArXiv-standard computer science serif outline layout." },
                { key: "ieee", label: "IEEE Systems Journal", desc: "Two-column tight grid standard conference design." },
                { key: "thesis", label: "PhD Thesis Standard", desc: "Wide binding margins, double-spaced formal review." }
              ].map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setCompilerLayout(opt.key as CompilerLayout)}
                  className="btn-secondary"
                  style={{
                    padding: "10px",
                    textAlign: "left",
                    borderRadius: "6px",
                    border: compilerLayout === opt.key ? "1px solid var(--border-active)" : "1px solid var(--border-muted)",
                    background: compilerLayout === opt.key ? "rgba(255,255,255,0.03)" : "transparent",
                    display: "flex",
                    flexDirection: "column",
                    gap: "2px"
                  }}
                >
                  <span style={{ fontSize: "12px", fontWeight: "700", color: "#ffffff" }}>{opt.label}</span>
                  <span style={{ fontSize: "9.5px", color: "var(--text-muted)" }}>{opt.desc}</span>
                </button>
              ))}
            </div>

            <button
              onClick={() => setIsCompilerOpen(true)}
              className="btn-premium"
              style={{ width: "100%", padding: "10px 14px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px", marginTop: "auto" }}
            >
              <Play size={13} fill="currentColor" />
              <span>Run Compiler & Preview</span>
            </button>
          </div>
        )}
      </aside>

      {/* Screen-Wide Academic Compiler splitscreen Preview Frame overlay */}
      {isCompilerOpen && (
        <div 
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "#0c0a18",
            zIndex: 1000,
            display: "grid",
            gridTemplateColumns: "1fr 1.1fr",
            animation: "fadeIn 0.3s forwards"
          }}
        >
          {/* Left panel: raw code editor */}
          <div style={{ display: "flex", flexDirection: "column", borderRight: "1px solid var(--border-muted)", height: "100%", overflow: "hidden" }}>
            <div style={{ background: "rgba(0,0,0,0.3)", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-muted)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Code size={16} style={{ color: "var(--accent-secondary)" }} />
                <span style={{ fontSize: "13px", fontWeight: "700", color: "#ffffff", fontFamily: "var(--font-mono)" }}>
                  source_code.md
                </span>
              </div>
              
              <div style={{ display: "flex", gap: "10px" }}>
                <div style={{ background: "rgba(255,255,255,0.02)", padding: "4px 8px", border: "1px solid var(--border-muted)", borderRadius: "4px", fontSize: "11px", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                  LaTeX & Math Parser: Active
                </div>
              </div>
            </div>
            
            <textarea
              value={page.content}
              onChange={(e) => onUpdatePage({ ...page, content: e.target.value })}
              className="input-premium"
              style={{
                flex: 1,
                border: "none",
                background: "transparent",
                color: "var(--text-secondary)",
                padding: "24px",
                fontSize: "13.5px",
                fontFamily: "var(--font-mono)",
                lineHeight: "1.7",
                resize: "none",
                outline: "none"
              }}
            />
          </div>

          {/* Right panel: compiled paper preview */}
          <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "#f8f9fa" }}>
            <div style={{ background: "#ffffff", borderBottom: "1px solid #e9ecef", padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Printer size={16} style={{ color: "#4f46e5" }} />
                <span style={{ fontSize: "13px", fontWeight: "700", color: "#1f2937", fontFamily: "var(--font-display)" }}>
                  Academic Typeset Previewer ({compilerLayout.toUpperCase()})
                </span>
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={handlePrintPDF}
                  className="btn-premium"
                  style={{ background: "#4f46e5", color: "#ffffff", padding: "6px 16px", fontSize: "12px", border: "none" }}
                >
                  Download Publication PDF
                </button>
                <button
                  onClick={() => setIsCompilerOpen(false)}
                  style={{ background: "#e5e7eb", color: "#374151", border: "none", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}
                >
                  Close Compiler
                </button>
              </div>
            </div>

            {/* Compiled Typeset Sheet Page viewport */}
            <div 
              style={{ 
                flex: 1, 
                overflowY: "auto", 
                padding: "2.5cm 2.2cm", 
                background: "#ffffff",
                boxShadow: "inset 0 0 20px rgba(0,0,0,0.06)",
                display: "flex",
                justifyContent: "center"
              }}
            >
              <div 
                id="academic-preview-sheet"
                style={{
                  width: "100%",
                  maxWidth: "16.5cm",
                  background: "#ffffff",
                  color: "#000000",
                  fontFamily: '"Times New Roman", Times, Georgia, serif',
                  lineHeight: compilerLayout === "thesis" ? "1.9" : "1.65",
                  fontSize: compilerLayout === "thesis" ? "12pt" : "10.5pt",
                  textAlign: "justify",
                  columnCount: compilerLayout === "ieee" ? 2 : 1,
                  columnGap: compilerLayout === "ieee" ? "1cm" : "0"
                }}
              >
                {/* Formal Thesis chapters styling if dissertation selected */}
                {compilerLayout === "thesis" && (
                  <div style={{ fontSize: "16pt", fontWeight: "bold", textAlign: "center", marginBottom: "2cm", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                    CHAPTER I: FRAMEWORK SPECIFICATION
                  </div>
                )}

                {/* Print Title Block */}
                {compilerLayout !== "ieee" && (
                  <div style={{ borderBottom: "0.5px solid #000", paddingBottom: "1.2cm", marginBottom: "1.5cm" }}>
                    <h1 style={{ fontSize: "22pt", textAlign: "center", fontWeight: "bold", margin: "0 0 10px 0", color: "#000000" }}>
                      {page.title.replace(/^[^\w]*/, "")}
                    </h1>
                    <div style={{ textAlign: "center", fontSize: "10pt", color: "#555555" }}>
                      Seseeded AI research manuscript by the Distill Workspace Editor Hub
                    </div>
                  </div>
                )}

                {renderMarkdownPreview(page.content, true)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Embedded inline styles for speech visualizers */}
      <style>{`
        .equalizer-bar {
          display: inline-block;
          width: 2px;
          height: 100%;
          background-color: var(--accent-danger, #ef4444);
          animation: bounceEqualizer 0.8s ease-in-out infinite alternate;
          border-radius: 1px;
        }
        @keyframes bounceEqualizer {
          0% { height: 2px; }
          100% { height: 10px; }
        }
        @keyframes flyOff {
          0% { transform: translate(0, 0) scale(1); opacity: 1; }
          40% { transform: translate(40px, -40px) scale(0.85); opacity: 0.9; }
          100% { transform: translate(400px, -400px) scale(0.2); opacity: 0; }
        }
        .dispatch-plane-fly {
          animation: pulse 1s infinite alternate;
        }
      `}</style>
    </div>
  )
}
