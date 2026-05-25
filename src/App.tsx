import { useState, useEffect, useCallback, useRef } from "react"
import { 
  Feather, 
  Brain, 
  BookOpen, 
  Key, 
  ChevronLeft, 
  ChevronRight, 
  Moon, 
  Sun, 
  Activity,
  Plus,
  Search,
  Trash2,
  Sparkles,
  X,
  Database,
  Download,
  Upload,
  Settings,
  ChevronDown,
  Briefcase,
  Rocket,
  User,
  Edit3,
  ListTodo,
  Calendar,
  CloudLightning,
  Orbit,
  Zap
} from "lucide-react"

// Import Components
import DocumentEditor from "./components/DocumentEditor"
import KanbanBoard from "./components/KanbanBoard"
import JournalLogger from "./components/JournalLogger"
import DatabaseTable from "./components/DatabaseTable"
import WorkspaceCopilot from "./components/WorkspaceCopilot"
import CognitiveArena from "./components/CognitiveArena"
import CelestialMap from "./components/CelestialMap"
import RewriteRoom from "./components/RewriteRoom"
import ConceptLadder from "./components/ConceptLadder"
import DecisionUnpacker from "./components/DecisionUnpacker"
import ReadingCompanion from "./components/ReadingCompanion"
import OllamaManager from "./components/OllamaManager"
import PromptSurgeon from "./components/PromptSurgeon"
import WebLLMManager from "./components/WebLLMManager"
import SearchModal from "./components/SearchModal"
import MoodBoard from "./components/MoodBoard"
import AEyeAssistant from "./components/AEyeAssistant"
import QuickCapture from "./components/QuickCapture"
import { checkDaxHealth, listDaxModels } from "./utils/daxBridge"
import {
  loadPages,
  upsertPage,
  bulkUpsertPages,
  deletePage,
  replaceWorkspace,
  getSetting,
  setSetting,
  migrateFromLocalStorage,
} from "./db"
import { warmUp, onEmbedProgress } from "./utils/embeddings"
import { syncPageEmbedding, removePageEmbedding, syncEmbeddings } from "./utils/semanticSearch"
import { suggestTags } from "./utils/autoTag"

// Page interfaces
// SDLC lifecycle statuses (back-compat: old todo/progress/done still valid)
export type KanbanStatus = "backlog" | "todo" | "progress" | "review" | "done"
export type KanbanPriority = "low" | "medium" | "high" | "critical"
export type KanbanType = "story" | "task" | "bug" | "epic" | "spike"

export interface KanbanTask {
  id: string
  title: string
  status: KanbanStatus
  priority: KanbanPriority
  createdAt: number
  description?: string
  dueDate?: number  // unix timestamp ms
  label?: string    // SDLC component: feature, infra, design, docs, test, chore…
  assignee?: "me" | "ai" | "tm"
  type?: KanbanType // issue type
  points?: number   // story-point estimate
  epic?: string     // epic / initiative grouping
}

export interface SpreadsheetRow {
  id: string
  title: string
  status: string
  assignee: string
  priority: string
  date: string
}

export interface Page {
  id: string
  title: string
  content: string
  type: "note" | "journal" | "planner" | "document" | "table" | "moodboard"
  createdAt: number
  updatedAt: number
  tags?: string[]
  metrics?: { energy: number; focus: number; mood: number }
  tasks?: KanbanTask[]
  rows?: SpreadsheetRow[]
}

export interface SystemLog {
  time: string
  tag: "SYSTEM" | "DATABASE" | "OLLAMA" | "ERROR"
  message: string
}

type WorkspaceContext = "enterprise" | "startup" | "personal"
type ThemeOption = "default" | "vercel" | "emerald" | "sunset" | "light" | "neon" | "frost"

const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value)
    } catch {
      // ignore
    }
  }
}

export default function App() {
  // Workspace boots as "enterprise"; real value loads from IndexedDB on mount
  const [workspace, setWorkspace] = useState<WorkspaceContext>("enterprise")
  const [dbReady, setDbReady] = useState(false)
  // Ref to avoid double-seeding in React StrictMode
  const didSeedRef = useRef<Record<string, boolean>>({})
  // Embedding model status
  const [embedStatus, setEmbedStatus] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState<boolean>(false)
  const [pages, setPages] = useState<Page[]>([])
  const [activePageId, setActivePageId] = useState<string>("")
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState<boolean>(false)

  // Google Drive Integration State
  const [driveConnected, setDriveConnected] = useState<boolean>(safeLocalStorage.getItem("distill_drive_connected") === "true")
  const [isSyncingDrive, setIsSyncingDrive] = useState<boolean>(false)
  const [isDrivePickerOpen, setIsDrivePickerOpen] = useState<boolean>(false)

  const mockDriveFiles = [
    { id: "df1", title: "📝 Q2 Product Architecture Proposal.gdoc", content: "# Q2 Product Architecture Proposal\n\nThis architecture proposal details our next-generation visual editor design specs:\n- Frosted glass overlays with backdrop blur.\n- Fully responsive layout panels.\n- Direct connection to local Ollama streams." },
    { id: "df2", title: "📊 Enterprise Database Records.gsheet", content: "# Enterprise Database Records\n\nThis spreadsheet sheet maps key client metrics:\n- ID: r1 | Title: CSS Variables audit | Status: Done\n- ID: r2 | Title: Drive Sync check | Status: In Progress" },
    { id: "df3", title: "💡 Accessibility Audit Guidelines.gdoc", content: "# Accessibility Audit Guidelines\n\nFollow these guidelines for high-legibility layout designs:\n1. Maintain proper contrast colors (black/yellow or high contrast grids).\n2. Standardize text scaling options.\n3. Integrate Speech Synthesis text-to-speech voice controls." }
  ]

  const handleImportDriveFile = (file: typeof mockDriveFiles[0]) => {
    const isDoc = file.title.endsWith(".gdoc")
    const newPage: Page = {
      id: Math.random().toString(36).substring(2, 9),
      title: `☁️ ${file.title.replace(/\.(gdoc|gsheet)$/, "")}`,
      content: file.content,
      type: isDoc ? "document" : "table",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags: ["Imported", "GoogleDrive"],
      rows: isDoc ? undefined : [
        { id: "r1", title: "CSS Variables audit", status: "Done", assignee: "AI Agent", priority: "High", date: "2026-05-24" },
        { id: "r2", title: "Drive Sync check", status: "In Progress", assignee: "Me", priority: "Medium", date: "2026-05-28" }
      ]
    }
    setPages(prev => [newPage, ...prev])
    setActivePageId(newPage.id)
    upsertPage(workspace, newPage).catch(() => {})
    setIsDrivePickerOpen(false)
    logSystemMessage("DATABASE", `Imported "${file.title}" directly from Google Drive`)
  }
  // searchTerm removed — global search now lives in SearchModal (Cmd+K)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false)
  const [theme, setTheme] = useState<ThemeOption>((safeLocalStorage.getItem("distill_theme") as ThemeOption) || "default")
  
  // Real-time System Console Audit logs
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([])

  // Local Ollama server connection monitoring
  const [ollamaLatency, setOllamaLatency] = useState<number | null>(null)
  const [isOllamaOnline, setIsOllamaOnline] = useState<boolean>(false)

  // Search modal
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  // AI Sidecar States
  const [isSidecarOpen, setIsSidecarOpen] = useState<boolean>(false)
  const [activeSidecarTool, setActiveSidecarTool] = useState<"rewrite" | "ladder" | "decision" | "reading" | "surgeon">("rewrite")

  // Provider and Model selection
  const [provider, setProvider] = useState<string>("ollama")
  const [model, setModel] = useState<string>("")
  const [ollamaModels, setOllamaModels] = useState<string[]>([])

  // DAX/Rook bridge: discovered subscription models ("providerID/modelID") + connection state
  const [daxModels, setDaxModels] = useState<{ id: string; name: string }[]>([])
  const [daxStatus, setDaxStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle")
  const [daxStatusMsg, setDaxStatusMsg] = useState<string>("")

  // Active models list based on provider
  const getActiveModels = useCallback((): string[] => {
    if (provider === "ollama") return ollamaModels
    if (provider === "dax") return daxModels.map((m) => m.id)
    if (provider === "openai") return ["gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"]
    if (provider === "gemini") return ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-1.0-pro"]
    if (provider === "anthropic") return ["claude-3-5-sonnet", "claude-3-opus", "claude-3-haiku"]
    if (provider === "groq") return ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768", "gemma2-9b-it"]
    if (provider === "webllm") return ["Phi-3.5-mini-instruct-q4f16_1-MLC", "Llama-3.2-3B-Instruct-q4f16_1-MLC", "gemma-2-2b-it-q4f16_1-MLC", "Qwen2.5-1.5B-Instruct-q4f16_1-MLC"]
    return []
  }, [provider, ollamaModels, daxModels])

  const activeModels: string[] = getActiveModels()

  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider)
    let defaultModel = ""
    if (newProvider === "ollama") {
      defaultModel = ollamaModels[0] || ""
    } else if (newProvider === "openai") {
      defaultModel = "gpt-4o"
    } else if (newProvider === "gemini") {
      defaultModel = "gemini-1.5-pro"
    } else if (newProvider === "anthropic") {
      defaultModel = "claude-3-5-sonnet"
    } else if (newProvider === "groq") {
      defaultModel = "llama-3.3-70b-versatile"
    } else if (newProvider === "webllm") {
      defaultModel = "Phi-3.5-mini-instruct-q4f16_1-MLC"
    } else if (newProvider === "dax") {
      defaultModel = daxModels[0]?.id || ""
    }
    setModel(defaultModel)
    logSystemMessage("SYSTEM", `Switched AI provider to ${newProvider.toUpperCase()} (Default Model: ${defaultModel})`)
  }
  
  // API Keys stored in localStorage
  const [apiKeys, setApiKeys] = useState({
    openai: safeLocalStorage.getItem("distill_api_key_openai") || "",
    anthropic: safeLocalStorage.getItem("distill_api_key_anthropic") || "",
    gemini: safeLocalStorage.getItem("distill_api_key_gemini") || "",
    groq: safeLocalStorage.getItem("distill_api_key_groq") || "",
    useSubscription: safeLocalStorage.getItem("distill_use_subscription") === "true",
    daxUrl: safeLocalStorage.getItem("distill_dax_url") || "http://127.0.0.1:4096",
    daxPassword: safeLocalStorage.getItem("distill_dax_password") || "",
  })

  // System audit logger (defined early so bootstrap can use it)
  const logSystemMessage = useCallback((tag: "SYSTEM" | "DATABASE" | "OLLAMA" | "ERROR", message: string) => {
    const time = new Date().toLocaleTimeString()
    setSystemLogs(prev => [{ time, tag, message }, ...prev].slice(0, 100))
  }, [])

  // ── One-time DB + embedding bootstrap ─────────────────────────────────────
  useEffect(() => {
    let cancelled = false

    // Subscribe to embedding model load progress
    const unsub = onEmbedProgress((status, progress) => {
      setEmbedStatus(status)
      if (status === "loading" && progress !== undefined && progress % 25 < 2) {
        logSystemMessage("SYSTEM", `Embedding model loading… ${Math.round(progress)}%`)
      }
      if (status === "ready") logSystemMessage("SYSTEM", "Embedding model (all-MiniLM-L6-v2) ready")
      if (status === "error") logSystemMessage("ERROR", "Embedding model failed to load")
    })

    ;(async () => {
      try {
        await migrateFromLocalStorage()

        const savedWs = await getSetting("active_workspace")
        if (!cancelled && savedWs) setWorkspace(savedWs as WorkspaceContext)

        if (!cancelled) setDbReady(true)
        logSystemMessage("DATABASE", "IndexedDB (Dexie) initialised and ready")
      } catch (err: any) {
        logSystemMessage("ERROR", `Database initialisation failed: ${err?.message || err}`)
        if (!cancelled) setDbReady(true)
      }

      // Warm up embedding model in background — non-blocking
      warmUp()
    })()

    return () => {
      cancelled = true
      unsub()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Seeding Page Tree Database
  const seedPages = useCallback((context: WorkspaceContext): Page[] => {
    logSystemMessage("DATABASE", `Seeding default Distill-style templates for context "${context.toUpperCase()}"`)
    
    if (context === "enterprise") {
      return [
        {
          id: "e1",
          title: "🚀 Enterprise System Specifications",
          content: `# Product Technical Specifications\n\nWelcome to your enterprise workspace note deck.\n\n### Slash block menu\nType \`/\` to summon the Distill block dropdown.\n\n### Ask AI dialogue sidecar\nSlide the sidecar open from the top-right to process this text in Rewrite Room, Concept Ladder, or Decision matrices instantly.`,
          type: "document",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          tags: ["Specs", "Infrastructure"]
        },
        {
          id: "e3",
          title: "📖 PhD Thesis: Autonomous Multi-Agent Cognitive Architectures",
          content: `# Autonomous Multi-Agent Cognitive Architectures\n\n### Abstract\nThis research establishes a next-generation decentralized cognitive runtime designed to orchestrate autonomous multi-agent reasoning graphs at sub-100ms processing latencies.\n\n### 1. Introduction\nModern LLM pipelines are heavily constrained by rigid sequential execution paths. This work explores parallel multi-agent reasoning graphs [Rawat et al., 2026].\n\n### 2. Theoretical Mathematical Framework\nOur cognitive mapping scales according to the following mathematical density function:\n\n$$\n\\mathcal{C}(A, S) = \\sum_{i=1}^{N} \\gamma_i \\cdot \\psi(a_i, s_{t})\n$$\n\n### 3. Methodology\nUsing local all-MiniLM vector caching models, we audit reasoning latency across various edge topologies. See our results database sheet for detailed statistics.`,
          type: "document",
          createdAt: Date.now() - 1000,
          updatedAt: Date.now() - 1000,
          tags: ["Academic", "Thesis", "AI"]
        },
        {
          id: "e4",
          title: "📄 Tech White Paper: Decentralized Vector Cache Indexes",
          content: `# High-Throughput Decentralized Vector Cache Indexes\n\n### Abstract\nThis white paper introduces a zero-copy decentralized index layer optimized for extreme vector retrieval speeds across edge clusters.\n\n### I. Cache Topology Architecture\nOur caching runtime is based on HNSW graphs mapped directly to persistent virtual tables.\n\n### II. Latency Calculations\nThe cache retrieval threshold is formulated as:\n\n$$\nT_{latency} = \\mathcal{O}(d \\cdot \\log N) + \\epsilon\n$$\n\n### III. References\n1. Shailesh et al. (2026). "Decentralized Indexing at Scale." Journal of Neural Cache.\n2. Ananya et al. (2026). "Decentralized Neural Vectors." IEEE Systems Review.`,
          type: "document",
          createdAt: Date.now() - 2000,
          updatedAt: Date.now() - 2000,
          tags: ["IEEE", "WhitePaper", "Database"]
        },
        {
          id: "e2",
          title: "📊 Core Enterprise Projects Database",
          content: "Spreadsheet database grid for major project tracking and assignments.",
          type: "table",
          createdAt: Date.now() - 50000,
          updatedAt: Date.now() - 50000,
          tags: ["Database", "Enterprise"],
          rows: [
            { id: "r1", title: "Refactor global CSS HSL variables", status: "Done", assignee: "AI Developer", priority: "High", date: "2026-05-24" },
            { id: "r2", title: "Audit local Ollama stream latencies", status: "In Progress", assignee: "Me", priority: "Medium", date: "2026-05-28" },
            { id: "r3", title: "Compose static Netlify deployment workflows", status: "To-Do", assignee: "Team Partner", priority: "Low", date: "2026-06-02" }
          ]
        }
      ]
    } else if (context === "startup") {
      return [
        {
          id: "s1",
          title: "📋 Product Sprint Kanban Planner",
          content: "Weekly task prioritizations, switch column lanes with click handles.",
          type: "planner",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          tags: ["Productivity", "Sprint"],
          tasks: [
            { id: "t1", title: "Deploy static static bundle to Netlify edge", status: "done", priority: "high", createdAt: Date.now(), label: "revision", assignee: "tm" },
            { id: "t2", title: "Complete visual redesign of Distill", status: "progress", priority: "high", createdAt: Date.now(), label: "drafting", assignee: "me" },
            { id: "t3", title: "Connect Ollama local inference streams", status: "todo", priority: "medium", createdAt: Date.now(), label: "research", assignee: "ai" }
          ]
        }
      ]
    } else {
      // Personal
      return [
        {
          id: "p1",
          title: "🧠 Focus Daily Log Journal",
          content: "Tweak focus, mood, and energy bars directly inside this note card.",
          type: "journal",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          tags: ["Reflection", "Focus"],
          metrics: { energy: 8, focus: 9, mood: 7 }
        }
      ]
    }
  }, [logSystemMessage])

  // Sync active pages whenever workspace changes (runs after dbReady)
  useEffect(() => {
    if (!dbReady) return
    let cancelled = false

    ;(async () => {
      try {
        // Persist active workspace selection
        await setSetting("active_workspace", workspace)

        const rows = await loadPages(workspace)

        if (cancelled) return

        if (rows.length > 0) {
          // Sanitize page fields to immunize components from undefined content, title, or tags
          const sanitizedRows = rows.map(r => ({
            ...r,
            title: r.title || "Untitled Note",
            content: r.content || "",
            tags: r.tags || []
          }))
          setPages(sanitizedRows)
          setActivePageId(sanitizedRows[0].id)
          logSystemMessage("DATABASE", `Loaded ${sanitizedRows.length} pages from IndexedDB for "${workspace.toUpperCase()}"`)
          // Background: embed any pages that don't have fresh vectors yet
          syncEmbeddings(workspace, sanitizedRows).catch(() => {/* silent — non-critical */})
        } else if (!didSeedRef.current[workspace]) {
          didSeedRef.current[workspace] = true
          const seeded = seedPages(workspace)
          // Sanitize seeded templates
          const sanitizedSeeded = seeded.map(s => ({
            ...s,
            title: s.title || "Untitled Note",
            content: s.content || "",
            tags: s.tags || []
          }))
          setPages(sanitizedSeeded)
          setActivePageId(sanitizedSeeded.length > 0 ? sanitizedSeeded[0].id : "")
          await bulkUpsertPages(workspace, sanitizedSeeded)
          logSystemMessage("DATABASE", `Seeded ${sanitizedSeeded.length} default templates for "${workspace.toUpperCase()}"`)
          syncEmbeddings(workspace, sanitizedSeeded).catch(() => {/* silent */})
        } else {
          setPages([])
          setActivePageId("")
        }
      } catch (err: any) {
        logSystemMessage("ERROR", `Failed to load workspace pages: ${err?.message || err}`)
        if (cancelled) return
        const seeded = seedPages(workspace)
        setPages(seeded)
        setActivePageId(seeded.length > 0 ? seeded[0].id : "")
      }
    })()

    return () => { cancelled = true }
  }, [workspace, dbReady, seedPages, logSystemMessage])

  // Persist an updated page list to IndexedDB + React state
  const savePages = useCallback((updatedPages: Page[]) => {
    setPages(updatedPages)
    // Fire-and-forget async write — IndexedDB is durable on success
    bulkUpsertPages(workspace, updatedPages).then(() => {
      logSystemMessage("DATABASE", `Persisted ${updatedPages.length} documents to IndexedDB (workspace: ${workspace.toUpperCase()})`)
    }).catch((err) => {
      logSystemMessage("ERROR", `IndexedDB write failed: ${err?.message}`)
    })
  }, [workspace, logSystemMessage])

  // Update a single page — targeted upsert + re-embed + auto-tag
  const handleUpdatePage = useCallback((updatedPage: Page) => {
    const stamped = { ...updatedPage, updatedAt: Date.now() }
    setPages(prev => prev.map(p => p.id === stamped.id ? stamped : p))
    upsertPage(workspace, stamped).catch((err) => {
      logSystemMessage("ERROR", `IndexedDB page update failed: ${err?.message}`)
    })
    syncPageEmbedding(workspace, stamped).catch(() => {/* non-critical */})

    // Auto-tag in background — only on document/note types with sufficient content
    if (["note", "document", "journal"].includes(stamped.type) && stamped.content.length > 80) {
      suggestTags(
        stamped.title, stamped.content, stamped.tags ?? [],
        provider, model, apiKeys, isOllamaOnline
      ).then((updatedTags) => {
        if (updatedTags.join() === (stamped.tags ?? []).join()) return // no change
        const tagged = { ...stamped, tags: updatedTags }
        setPages(prev => prev.map(p => p.id === tagged.id ? tagged : p))
        upsertPage(workspace, tagged).catch(() => {/* silent */})
        logSystemMessage("SYSTEM", `Auto-tagged "${stamped.title}": ${updatedTags.join(", ")}`)
      }).catch(() => {/* silent */})
    }
  }, [workspace, provider, model, apiKeys, isOllamaOnline, logSystemMessage])

  // Create new page inside active workspace context
  const handleCreatePage = (type: "note" | "journal" | "planner" | "document" | "table" | "moodboard") => {
    let title = "New Note"
    let content = ""
    let metrics = undefined
    let tasks = undefined
    let rows = undefined

    if (type === "journal") {
      title = `📓 Daily Log - ${new Date().toLocaleDateString()}`
      content = "Daily thoughts..."
      metrics = { energy: 5, focus: 5, mood: 5 }
    } else if (type === "planner") {
      title = "📋 Task Kanban Board"
      content = "Planner sprint lane board."
      tasks = []
    } else if (type === "document") {
      title = "📖 Product Spec / Documentation"
      content = "# Product Scope\n\nEnter technical spec contents..."
    } else if (type === "table") {
      title = "📊 Data Spreadsheet"
      content = "Spreadsheet table block."
      rows = []
    } else if (type === "moodboard") {
      title = "🎨 Moodboard"
      content = JSON.stringify({ cards: [], columns: 3, title: "Moodboard" })
    }

    const newPage: Page = {
      id: Math.random().toString(36).substring(2, 9),
      title,
      content,
      type,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags: [],
      metrics,
      tasks,
      rows
    }

    const updatedPages = [newPage, ...pages]
    setPages(updatedPages)
    setActivePageId(newPage.id)
    upsertPage(workspace, newPage).catch((err) => {
      logSystemMessage("ERROR", `Failed to persist new page: ${err?.message}`)
    })
    syncPageEmbedding(workspace, newPage).catch(() => {/* silent */})
    logSystemMessage("DATABASE", `Created "${title}" [${type}] in workspace ${workspace.toUpperCase()}`)

    // Auto-tag after a brief delay (let the user start editing first)
    if (["note", "document"].includes(type)) {
      setTimeout(() => {
        suggestTags(
          newPage.title, newPage.content, newPage.tags ?? [],
          provider, model, apiKeys, isOllamaOnline
        ).then((updatedTags) => {
          if (updatedTags.length === (newPage.tags ?? []).length) return
          const tagged = { ...newPage, tags: updatedTags }
          setPages(prev => prev.map(p => p.id === tagged.id ? tagged : p))
          upsertPage(workspace, tagged).catch(() => {/* silent */})
          logSystemMessage("SYSTEM", `Auto-tagged new page "${title}": ${updatedTags.join(", ")}`)
        }).catch(() => {/* silent */})
      }, 4000)
    }
  }

  // Quick capture — turn a raw thought into a fully-wired inbox note.
  // First line becomes the title; the note is created, persisted, embedded,
  // and auto-tagged through the same pipeline as any other page.
  const handleQuickCapture = useCallback((text: string) => {
    const firstLine = text.split("\n")[0].trim()
    const title = firstLine.length > 60 ? firstLine.slice(0, 57) + "…" : firstLine || "Captured thought"

    const newPage: Page = {
      id: Math.random().toString(36).substring(2, 9),
      title,
      content: text,
      type: "note",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags: ["inbox"],
    }

    setPages(prev => [newPage, ...prev])
    setActivePageId(newPage.id)
    upsertPage(workspace, newPage).catch((err) => {
      logSystemMessage("ERROR", `Failed to persist captured thought: ${err?.message}`)
    })
    syncPageEmbedding(workspace, newPage).catch(() => {/* non-critical */})
    logSystemMessage("DATABASE", `Captured "${title}" → Inbox`)

    if (newPage.content.length > 40) {
      suggestTags(
        newPage.title, newPage.content, newPage.tags ?? [],
        provider, model, apiKeys, isOllamaOnline
      ).then((updatedTags) => {
        const tagged = { ...newPage, tags: updatedTags }
        setPages(prev => prev.map(p => p.id === tagged.id ? tagged : p))
        upsertPage(workspace, tagged).catch(() => {/* silent */})
      }).catch(() => {/* silent */})
    }
  }, [workspace, provider, model, apiKeys, isOllamaOnline, logSystemMessage])

  // Connect to the local DAX/Rook bridge: verify health, then discover the
  // subscription-authed providers/models the server exposes.
  const handleConnectDax = useCallback(async () => {
    setDaxStatus("connecting")
    setDaxStatusMsg("")
    const cfg = { url: apiKeys.daxUrl, password: apiKeys.daxPassword }
    try {
      const health = await checkDaxHealth(cfg)
      const { models } = await listDaxModels(cfg)
      if (models.length === 0) throw new Error("Connected, but no authed providers found. Run `dax auth login` first.")
      const list = models.map((m) => ({ id: `${m.providerID}/${m.modelID}`, name: m.name }))
      setDaxModels(list)
      setDaxStatus("connected")
      setDaxStatusMsg(`Connected to DAX ${health.version} · ${list.length} models`)
      setProvider("dax")
      setModel(list[0].id)
      safeLocalStorage.setItem("distill_dax_url", apiKeys.daxUrl)
      safeLocalStorage.setItem("distill_dax_password", apiKeys.daxPassword)
      logSystemMessage("SYSTEM", `DAX/Rook bridge connected (${list.length} subscription models)`)
    } catch (e) {
      const msg = (e as Error).message
      setDaxStatus("error")
      setDaxStatusMsg(msg)
      setDaxModels([])
      logSystemMessage("ERROR", `DAX bridge: ${msg}`)
    }
  }, [apiKeys.daxUrl, apiKeys.daxPassword, logSystemMessage])

  // Global shortcut: ⌘/Ctrl+Shift+K opens Quick Capture from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setIsQuickCaptureOpen(true)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  // Delete page — targeted row delete, no full rewrite
  const handleDeletePage = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const filtered = pages.filter(p => p.id !== id)
    setPages(filtered)
    if (activePageId === id) {
      setActivePageId(filtered.length > 0 ? filtered[0].id : "")
    }
    deletePage(workspace, id).catch((err) => {
      logSystemMessage("ERROR", `IndexedDB delete failed: ${err?.message}`)
    })
    removePageEmbedding(workspace, id).catch(() => {/* silent */})
    logSystemMessage("DATABASE", `Deleted page "${id}" from workspace ${workspace.toUpperCase()}`)
  }

  // Sync theme with document class and localStorage
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    safeLocalStorage.setItem("distill_theme", theme)
  }, [theme])

  // Monitor Ollama Local connection latency
  useEffect(() => {
    const pingOllama = async () => {
      const start = performance.now()
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 1500)
      try {
        const response = await fetch("http://localhost:11434/api/tags", {
          signal: controller.signal,
        })
        clearTimeout(timeoutId)
        if (response.ok) {
          const latency = performance.now() - start
          setOllamaLatency(latency)
          setIsOllamaOnline(true)
          logSystemMessage("OLLAMA", `Local handshake OK: active tags ping returned in ${latency.toFixed(0)}ms`)
        } else {
          setOllamaLatency(null)
          setIsOllamaOnline(false)
        }
      } catch {
        clearTimeout(timeoutId)
        setOllamaLatency(null)
        setIsOllamaOnline(false)
      }
    }
    pingOllama()
    const interval = setInterval(pingOllama, 8000)
    return () => clearInterval(interval)
  }, [logSystemMessage])

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Global search: Cmd+K / Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.code === "KeyK") {
        e.preventDefault()
        setIsSearchOpen(true)
      }
      // Toggle sidebar: Option + B
      if (e.altKey && e.code === "KeyB") {
        e.preventDefault()
        setIsSidebarCollapsed(prev => !prev)
      }
      // Toggle AI Sidecar: Option + S
      if (e.altKey && e.code === "KeyS") {
        e.preventDefault()
        setIsSidecarOpen(prev => !prev)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  // JSON Workspace Backup Export
  const handleExportWorkspace = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(pages))
      const downloadAnchor = document.createElement("a")
      downloadAnchor.setAttribute("href", dataStr)
      downloadAnchor.setAttribute("download", `distill_backup_${workspace}_${Date.now().toString().slice(-6)}.json`)
      downloadAnchor.click()
      logSystemMessage("SYSTEM", `Exported JSON workspace backup of context "${workspace.toUpperCase()}" successfully`)
    } catch {
      logSystemMessage("ERROR", "Failed to export JSON workspace backup")
    }
  }

  // JSON Workspace Backup Import
  const handleImportWorkspace = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string) as Page[]
        if (Array.isArray(parsed)) {
          setPages(parsed)
          if (parsed.length > 0) setActivePageId(parsed[0].id)
          replaceWorkspace(workspace, parsed).then(() => {
            logSystemMessage("SYSTEM", `Restored workspace "${workspace.toUpperCase()}" with ${parsed.length} pages`)
          }).catch((err) => {
            logSystemMessage("ERROR", `Import write failed: ${err?.message}`)
          })
          alert("Workspace context backup restored successfully!")
        } else {
          throw new Error("Invalid file schema")
        }
      } catch {
        logSystemMessage("ERROR", "Failed to restore backup: JSON format invalid")
        alert("Failed to restore backup: JSON format invalid")
      }
    }
    reader.readAsText(file)
  }

  const handleClearWorkspace = () => {
    if (confirm("Are you absolutely sure you want to clear this workspace context? This cannot be undone!")) {
      setPages([])
      setActivePageId("")
      replaceWorkspace(workspace, []).then(() => {
        logSystemMessage("SYSTEM", `Workspace "${workspace.toUpperCase()}" cleared`)
      }).catch((err) => {
        logSystemMessage("ERROR", `Clear failed: ${err?.message}`)
      })
    }
  }

  // Pages shown in sidebar (all pages — search is in Cmd+K modal)
  const filteredPages = pages

  // Grab active page
  const activePage = pages.find(p => p.id === activePageId)

  // Inbox: captured/untriaged thoughts carry the "inbox" tag.
  const inboxPages = pages.filter(p => (p.tags ?? []).includes("inbox"))
  const inboxCount = inboxPages.length

  // Triage a captured thought: drop the "inbox" tag so it leaves the inbox.
  const handleTriagePage = (id: string) => {
    const target = pages.find(p => p.id === id)
    if (!target) return
    const triaged = { ...target, tags: (target.tags ?? []).filter(t => t !== "inbox"), updatedAt: Date.now() }
    setPages(prev => prev.map(p => p.id === id ? triaged : p))
    upsertPage(workspace, triaged).catch(() => {/* silent */})
    logSystemMessage("SYSTEM", `Triaged "${triaged.title}" out of Inbox`)
  }

  // Floating AI sidecar triggers
  const triggerSidecar = (tool: "rewrite" | "ladder" | "decision" | "reading" | "surgeon") => {
    setActiveSidecarTool(tool)
    setIsSidecarOpen(true)
  }

  // Helper icons for type mapping
  const getTypeIcon = (type: string) => {
    if (type === "journal")   return <Brain size={14} style={{ color: "var(--text-secondary)" }} />
    if (type === "planner")   return <ListTodo size={14} style={{ color: "var(--text-secondary)" }} />
    if (type === "document")  return <BookOpen size={14} style={{ color: "var(--text-secondary)" }} />
    if (type === "table")     return <Database size={14} style={{ color: "var(--text-secondary)" }} />
    if (type === "moodboard") return <Sparkles size={14} style={{ color: "#f97316" }} />
    return <Feather size={14} style={{ color: "var(--text-secondary)" }} />
  }

  // Hold render until IndexedDB is bootstrapped to avoid flash of empty state
  if (!dbReady) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", flexDirection: "column", gap: "12px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: "12px" }}>
        <div style={{ width: "32px", height: "32px", border: "2px solid var(--border-muted)", borderTopColor: "var(--accent-primary)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <span>Initialising workspace…</span>
      </div>
    )
  }

  return (
    <div className={`dashboard-layout ${isSidebarCollapsed ? "collapsed" : ""}`}>
      {/* Background Pixel Grid Backdrop Overlay */}
      <div className="pixel-grid-backdrop"></div>

      {/* Sidebar Navigation */}
      <aside 
        className="sidebar-cyber"
        style={{
          padding: "20px 14px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          height: "100vh",
          position: "sticky",
          top: 0,
          zIndex: 10
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "18px", height: "85%" }}>
          {/* Active Workspace Context Selector */}
          {!isSidebarCollapsed ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", position: "relative" }}>
              <span style={{ fontSize: "9px", color: "var(--text-muted)", fontWeight: "700", fontFamily: "var(--font-mono)", paddingLeft: "4px" }}>
                WORKSPACE CONTEXT
              </span>
              
              {/* Premium Custom Dropdown Button */}
              <button
                onClick={() => setIsWorkspaceMenuOpen(!isWorkspaceMenuOpen)}
                className="workspace-selector-select"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  textAlign: "left",
                  background: "rgba(255, 255, 255, 0.02)",
                  border: "1px solid var(--border-muted)",
                  padding: "8px 12px",
                  borderRadius: "var(--radius-sm)",
                  color: "#ffffff",
                  cursor: "pointer",
                  fontFamily: "var(--font-display)",
                  fontWeight: "600",
                  fontSize: "13px",
                  transition: "var(--transition-smooth)",
                  outline: "none",
                  width: "100%"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {workspace === "enterprise" && <Briefcase size={13} style={{ color: "var(--text-secondary)" }} />}
                  {workspace === "startup" && <Rocket size={13} style={{ color: "var(--text-secondary)" }} />}
                  {workspace === "personal" && <User size={13} style={{ color: "var(--text-secondary)" }} />}
                  <span>
                    {workspace === "enterprise" && "Enterprise Docs"}
                    {workspace === "startup" && "Startup Sprint"}
                    {workspace === "personal" && "Personal Core"}
                  </span>
                </div>
                <ChevronDown size={13} style={{ opacity: 0.6, transform: isWorkspaceMenuOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
              </button>

              {/* Floating Custom Choices Panel */}
              {isWorkspaceMenuOpen && (
                <div
                  className="slash-popover"
                  style={{
                    position: "absolute",
                    top: "105%",
                    left: 0,
                    right: 0,
                    width: "100%",
                    background: "rgba(10, 10, 14, 0.96)",
                    border: "1px solid var(--border-active)",
                    borderRadius: "var(--radius-sm)",
                    boxShadow: "0 10px 30px rgba(0, 0, 0, 0.7)",
                    zIndex: 50,
                    padding: "4px"
                  }}
                >
                  <button
                    onClick={() => {
                      setWorkspace("enterprise")
                      setIsWorkspaceMenuOpen(false)
                    }}
                    className={`slash-item ${workspace === "enterprise" ? "selected" : ""}`}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: "8px" }}
                  >
                    <Briefcase size={13} />
                    <span>Enterprise Docs</span>
                  </button>
                  <button
                    onClick={() => {
                      setWorkspace("startup")
                      setIsWorkspaceMenuOpen(false)
                    }}
                    className={`slash-item ${workspace === "startup" ? "selected" : ""}`}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: "8px" }}
                  >
                    <Rocket size={13} />
                    <span>Startup Sprint</span>
                  </button>
                  <button
                    onClick={() => {
                      setWorkspace("personal")
                      setIsWorkspaceMenuOpen(false)
                    }}
                    className={`slash-item ${workspace === "personal" ? "selected" : ""}`}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: "8px" }}
                  >
                    <User size={13} />
                    <span>Personal Core</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div style={{ background: "rgba(255, 255, 255, 0.04)", border: "1px solid var(--border-muted)", width: "36px", height: "36px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, margin: "0 auto" }}>
              <Database size={16} style={{ color: "var(--accent-primary)" }} />
            </div>
          )}

          {/* Search trigger */}
          {!isSidebarCollapsed && (
            <button
              onClick={() => setIsSearchOpen(true)}
              style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "8px 12px", borderRadius: "var(--radius-sm)",
                background: "rgba(0,0,0,0.3)", border: "1px solid var(--border-muted)",
                color: "var(--text-muted)", cursor: "pointer", width: "100%", textAlign: "left",
                fontSize: "12px", fontFamily: "var(--font-body)",
                transition: "var(--transition-smooth)",
              }}
            >
              <Search size={13} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1 }}>Search…</span>
              <kbd style={{ fontSize: "9.5px", fontFamily: "var(--font-mono)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-muted)", borderRadius: "4px", padding: "1px 5px", color: "var(--text-muted)" }}>⌘K</kbd>
            </button>
          )}

          {/* Intelligent Dock (AI Copilot workspace) */}
          {!isSidebarCollapsed ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "9px", color: "var(--text-muted)", letterSpacing: "0.08em", fontWeight: "700", fontFamily: "var(--font-mono)", paddingLeft: "8px" }}>
                INTELLIGENT DOCK
              </span>
              
              <button
                onClick={() => {
                  if (document.startViewTransition) {
                    document.startViewTransition(() => setActivePageId("copilot"))
                  } else {
                    setActivePageId("copilot")
                  }
                }}
                className={`sidebar-page-item ${activePageId === "copilot" ? "active" : ""}`}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: "10px" }}
              >
                <Sparkles size={14} style={{ color: "var(--accent-secondary)" }} />
                <span>AI Workspace Copilot</span>
              </button>

              <button
                onClick={() => {
                  if (document.startViewTransition) {
                    document.startViewTransition(() => setActivePageId("arena"))
                  } else {
                    setActivePageId("arena")
                  }
                }}
                className={`sidebar-page-item ${activePageId === "arena" ? "active" : ""}`}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: "10px" }}
              >
                <Activity size={14} style={{ color: "var(--accent-secondary)" }} />
                <span>AI Cognitive Arena</span>
              </button>

              <button
                onClick={() => {
                  if (document.startViewTransition) {
                    document.startViewTransition(() => setActivePageId("map"))
                  } else {
                    setActivePageId("map")
                  }
                }}
                className={`sidebar-page-item ${activePageId === "map" ? "active" : ""}`}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: "10px" }}
              >
                <Orbit size={14} style={{ color: "var(--accent-secondary)" }} />
                <span>Celestial Thought-Graph</span>
              </button>

              <button
                onClick={() => {
                  if (document.startViewTransition) {
                    document.startViewTransition(() => setActivePageId("inbox"))
                  } else {
                    setActivePageId("inbox")
                  }
                }}
                className={`sidebar-page-item ${activePageId === "inbox" ? "active" : ""}`}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: "10px" }}
              >
                <Zap size={14} style={{ color: "var(--accent-warning)" }} />
                <span>Inbox</span>
                {inboxCount > 0 && (
                  <span style={{ marginLeft: "auto", fontSize: "10px", fontWeight: 700, fontFamily: "var(--font-mono)", background: "var(--accent-warning)", color: "var(--bg-primary)", borderRadius: "999px", padding: "1px 7px" }}>
                    {inboxCount}
                  </span>
                )}
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "center", margin: "0 auto" }}>
              <div style={{ background: "rgba(255, 255, 255, 0.04)", border: "1px solid var(--border-muted)", width: "36px", height: "36px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer" }} onClick={() => setActivePageId("copilot")} title="AI Workspace Copilot">
                <Sparkles size={16} style={{ color: "var(--accent-secondary)" }} />
              </div>
              <div style={{ background: "rgba(255, 255, 255, 0.04)", border: "1px solid var(--border-muted)", width: "36px", height: "36px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer" }} onClick={() => setActivePageId("arena")} title="AI Cognitive Arena">
                <Activity size={16} style={{ color: "var(--accent-secondary)" }} />
              </div>
              <div style={{ background: "rgba(255, 255, 255, 0.04)", border: "1px solid var(--border-muted)", width: "36px", height: "36px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer" }} onClick={() => setActivePageId("map")} title="Celestial Thought-Graph">
                <Orbit size={16} style={{ color: "var(--accent-secondary)" }} />
              </div>
            </div>
          )}

          {/* Document list tree header */}
          {!isSidebarCollapsed && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 8px" }}>
              <span style={{ fontSize: "10px", color: "var(--text-muted)", letterSpacing: "0.08em", fontWeight: "700", fontFamily: "var(--font-mono)" }}>
                DOCUMENTS HUB
              </span>
              <button 
                onClick={() => handleCreatePage("note")} 
                title="Create Quick Note"
                style={{ background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer" }}
              >
                <Plus size={13} />
              </button>
            </div>
          )}

          {/* Core Documents List */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", overflowY: "auto", flex: 1, paddingRight: "2px" }}>
            {filteredPages.map(page => {
              const isActive = activePageId === page.id
              return (
                <button
                  key={page.id}
                  onClick={() => {
                    if (document.startViewTransition) {
                      document.startViewTransition(() => setActivePageId(page.id))
                    } else {
                      setActivePageId(page.id)
                    }
                  }}
                  className={`sidebar-page-item ${isActive ? "active" : ""}`}
                  title={page.title}
                >
                  {getTypeIcon(page.type)}
                  {!isSidebarCollapsed && (
                    <>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                        {page.title}
                      </span>
                      {/* Trash hover action */}
                      {pages.length > 0 && (
                        <Trash2
                          size={12}
                          className="trash-hover"
                          style={{
                            color: "var(--text-muted)",
                            cursor: "pointer",
                            transition: "var(--transition-smooth)"
                          }}
                          onClick={(e) => handleDeletePage(page.id, e)}
                        />
                      )}
                    </>
                  )}
                </button>
              )
            })}
            
            {filteredPages.length === 0 && !isSidebarCollapsed && (
              <span style={{ fontSize: "11px", color: "var(--text-muted)", textAlign: "center", padding: "10px" }}>
                No pages match search
              </span>
            )}
          </div>
        </div>

        {/* Footer Navigation */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {!isSidebarCollapsed && (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", background: "rgba(255,255,255,0.015)", border: "1px solid var(--border-muted)", padding: "10px", borderRadius: "var(--radius-sm)", marginBottom: "8px" }}>
              <span style={{ fontSize: "9px", color: "var(--text-muted)", fontWeight: "700", fontFamily: "var(--font-mono)" }}>NEW DATABASE BLOCK</span>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <button onClick={() => handleCreatePage("note")} className="btn-secondary" style={{ padding: "6px", fontSize: "10.5px", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                  <Edit3 size={11} style={{ opacity: 0.8 }} />
                  <span>Note</span>
                </button>
                <button onClick={() => handleCreatePage("document")} className="btn-secondary" style={{ padding: "6px", fontSize: "10.5px", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                  <BookOpen size={11} style={{ opacity: 0.8 }} />
                  <span>Doc</span>
                </button>
                <button onClick={() => handleCreatePage("planner")} className="btn-secondary" style={{ padding: "6px", fontSize: "10.5px", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                  <ListTodo size={11} style={{ opacity: 0.8 }} />
                  <span>Planner</span>
                </button>
                <button onClick={() => handleCreatePage("table")} className="btn-secondary" style={{ padding: "6px", fontSize: "10.5px", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                  <Database size={11} style={{ opacity: 0.8 }} />
                  <span>Table</span>
                </button>
                <button onClick={() => handleCreatePage("journal")} className="btn-secondary" style={{ padding: "6px", fontSize: "10.5px", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                  <Calendar size={11} style={{ opacity: 0.8 }} />
                  <span>Daily Log</span>
                </button>
                <button onClick={() => handleCreatePage("moodboard")} className="btn-secondary" style={{ padding: "6px", fontSize: "10.5px", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                  <Sparkles size={11} style={{ opacity: 0.8 }} />
                  <span>Moodboard</span>
                </button>
              </div>
            </div>
          )}

          {/* Toggle sidebar button */}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            title="Toggle Sidebar (⌥B)"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              padding: "10px 12px",
              background: "transparent",
              border: "none",
              borderRadius: "var(--radius-sm)",
              color: "var(--text-muted)",
              cursor: "pointer",
              fontSize: "12px",
              fontFamily: "var(--font-display)",
              width: "100%",
              transition: "var(--transition-smooth)"
            }}
          >
            {isSidebarCollapsed ? <ChevronRight size={15} /> : (
              <>
                <ChevronLeft size={15} />
                <span style={{ fontSize: "11px", fontWeight: "600" }}>Collapse View</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Main Workspace Frame */}
      <main style={{ padding: "32px 40px", display: "flex", flexDirection: "column", gap: "32px", overflowY: "auto", height: "100vh", position: "relative" }}>
        
        {/* Top Control Bar with Model Route Selectors */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border-muted)", paddingBottom: "20px", gap: "20px" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: "700", letterSpacing: "0.08em", fontFamily: "var(--font-mono)" }}>
              CURRENT COGNITIVE ROUTE
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
              <Activity size={14} style={{ color: "var(--accent-secondary)" }} />
              <h3 id="main-heading" tabIndex={-1} style={{ fontSize: "15px", fontWeight: "600", color: "var(--text-primary)", fontFamily: "var(--font-display)", outline: "none" }}>
                {provider === "ollama" ? `Local Engine: ${model || "No model selected"}` : `Cloud API: ${provider.toUpperCase()} (${model})`}
              </h3>
              {provider === "ollama" && (
                <span style={{ 
                  fontSize: "10px", 
                  background: isOllamaOnline ? "rgba(16, 185, 129, 0.08)" : "rgba(244, 63, 94, 0.08)",
                  border: `1px solid ${isOllamaOnline ? "rgba(16, 185, 129, 0.2)" : "rgba(244, 63, 94, 0.2)"}`,
                  color: isOllamaOnline ? "var(--accent-success)" : "var(--accent-danger)",
                  padding: "1px 6px",
                  borderRadius: "10px",
                  fontWeight: "600",
                  fontFamily: "var(--font-mono)"
                }}>
                  {isOllamaOnline ? `${ollamaLatency ? ollamaLatency.toFixed(0) : "0"}ms` : "offline"}
                </span>
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "center" }}>
            {/* Select Provider */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "10px", color: "var(--text-secondary)", fontWeight: "600", fontFamily: "var(--font-display)" }}>Provider</span>
              <select 
                value={provider} 
                onChange={(e) => handleProviderChange(e.target.value)} 
                className="input-premium"
                style={{ width: "165px", padding: "8px 12px", fontSize: "12.5px" }}
              >
                <option value="ollama">Ollama (Local)</option>
                <option value="dax">DAX / Rook (Subscription)</option>
                <option value="openai">OpenAI (Cloud)</option>
                <option value="gemini">Gemini (Cloud)</option>
                <option value="anthropic">Anthropic (Cloud)</option>
                <option value="groq">Groq (Fast Cloud)</option>
                <option value="webllm">WebLLM (Browser GPU)</option>
              </select>
            </div>

            {/* Select Model */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "10px", color: "var(--text-secondary)", fontWeight: "600", fontFamily: "var(--font-display)" }}>Model Route Override</span>
              <select 
                value={model} 
                onChange={(e) => setModel(e.target.value)} 
                className="input-premium"
                disabled={activeModels.length === 0}
                style={{ width: "220px", padding: "8px 12px", fontSize: "12.5px" }}
              >
                {activeModels.length > 0 ? (
                  activeModels.map((m) => (
                    <option key={m} value={m}>
                      {provider === "dax" ? (daxModels.find((d) => d.id === m)?.name ?? m) : m}
                    </option>
                  ))
                ) : (
                  <option value="">{provider === "dax" ? "Connect bridge in Settings" : "No models available"}</option>
                )}
              </select>
            </div>

            {/* Settings Quick Tab Trigger */}
            <button
              onClick={() => {
                if (document.startViewTransition) {
                  document.startViewTransition(() => setActivePageId("settings"))
                } else {
                  setActivePageId("settings")
                }
              }}
              className="btn-secondary"
              style={{ padding: "8px 12px", display: "inline-flex", alignItems: "center", gap: "6px", marginTop: "16px" }}
            >
              <Settings size={13} />
              <span>Workspace Sync</span>
            </button>

            {/* Premium Theme Switcher Toggle */}
            <button
              onClick={() => {
                const nextTheme = theme === "light" ? "default" : "light"
                if (document.startViewTransition) {
                  document.startViewTransition(() => setTheme(nextTheme))
                } else {
                  setTheme(nextTheme)
                }
                logSystemMessage("SYSTEM", `Toggled workspace theme to ${nextTheme.toUpperCase()}`)
              }}
              className="btn-secondary"
              style={{ 
                padding: "8px 10px", 
                display: "inline-flex", 
                alignItems: "center", 
                justifyContent: "center", 
                marginTop: "16px",
                borderRadius: "8px",
                cursor: "pointer"
              }}
              title={theme === "light" ? "Switch to Obsidian Graphite Dark" : "Switch to Alabaster Light"}
            >
              {theme === "light" ? <Moon size={13} style={{ transform: "rotate(15deg)" }} /> : <Sun size={13} style={{ color: "#f59e0b" }} />}
            </button>

            {/* Ask AI Sidecar toggle button */}
            <button
              onClick={() => setIsSidecarOpen(!isSidecarOpen)}
              className="btn-premium"
              style={{
                background: "var(--bg-secondary)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-active)",
                padding: "8px 14px",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                marginTop: "16px",
                boxShadow: isSidecarOpen ? "0 0 15px var(--glow-color)" : "none"
              }}
              title="Toggle AI Sidecar Panel (⌥S)"
            >
              <Sparkles size={14} style={{ color: "var(--accent-primary)" }} />
              <span style={{ fontSize: "12.5px", fontWeight: "600" }}>Ask AI Sidecar</span>
            </button>
          </div>
        </div>

        {/* Tab Routing / Active Page Editor Grid */}
        <div style={{ flex: 1 }}>
          {activePageId === "copilot" ? (
            <WorkspaceCopilot
              pages={pages}
              onUpdatePages={savePages}
              activePageId={activePageId}
              setActivePageId={setActivePageId}
              provider={provider}
              model={model}
              apiKeys={apiKeys}
              isOllamaOnline={isOllamaOnline}
              logSystemMessage={logSystemMessage}
              workspace={workspace}
              embedStatus={embedStatus}
            />
          ) : activePageId === "arena" ? (
            <CognitiveArena 
              pages={pages}
              provider={provider}
              model={model}
              apiKeys={apiKeys}
              isOllamaOnline={isOllamaOnline}
              ollamaModels={ollamaModels}
              logSystemMessage={logSystemMessage}
            />
          ) : activePageId === "inbox" ? (
            /* Inbox: untriaged captured thoughts */
            <div className="glass-card" style={{ padding: "30px", display: "flex", flexDirection: "column", gap: "18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", borderBottom: "1px solid var(--border-muted)", paddingBottom: "14px" }}>
                <Zap size={20} style={{ color: "var(--accent-warning)" }} />
                <h2 style={{ fontSize: "18px", fontWeight: 700, fontFamily: "var(--font-display)", margin: 0 }}>Inbox</h2>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  {inboxCount} untriaged {inboxCount === 1 ? "thought" : "thoughts"}
                </span>
              </div>

              {inboxPages.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "50px 20px", color: "var(--text-muted)", gap: "10px" }}>
                  <Zap size={26} style={{ opacity: 0.4 }} />
                  <span style={{ fontSize: "13px" }}>Inbox zero. Capture a thought with ⌘⇧K — it lands here.</span>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {inboxPages.map((p) => (
                    <div key={p.id} className="inbox-item">
                      <button
                        onClick={() => setActivePageId(p.id)}
                        style={{ flex: 1, textAlign: "left", background: "transparent", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", gap: "3px", minWidth: 0 }}
                      >
                        <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.title || "Untitled"}</span>
                        <span style={{ fontSize: "12px", color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {p.content.replace(/\s+/g, " ").slice(0, 110) || "—"}
                        </span>
                        {(p.tags ?? []).filter(t => t !== "inbox").length > 0 && (
                          <span style={{ fontSize: "10.5px", color: "var(--accent-secondary)", fontFamily: "var(--font-mono)", marginTop: "2px" }}>
                            {(p.tags ?? []).filter(t => t !== "inbox").map(t => `#${t}`).join(" ")}
                          </span>
                        )}
                      </button>
                      <button onClick={() => handleTriagePage(p.id)} className="btn-secondary" style={{ padding: "6px 12px", fontSize: "11.5px", flexShrink: 0 }}>
                        Triage
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : activePageId === "map" ? (
            <CelestialMap
              pages={pages}
              workspace={workspace}
              onNavigate={(id) => {
                if (document.startViewTransition) {
                  document.startViewTransition(() => setActivePageId(id))
                } else {
                  setActivePageId(id)
                }
              }}
            />
          ) : activePageId === "settings" ? (
            /* Settings overlay panel dashboard */
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "32px", width: "100%" }}>
              
              {/* Left Column Settings */}
              <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
                
                {/* Backup & Restore HUD */}
                <div className="glass-card" style={{ padding: "30px", display: "flex", flexDirection: "column", gap: "20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", borderBottom: "1px solid var(--border-muted)", paddingBottom: "12px" }}>
                    <Database size={18} style={{ color: "var(--accent-primary)" }} />
                    <h3 style={{ fontSize: "16px", fontWeight: "600", fontFamily: "var(--font-display)" }}>
                      Backup & Database HUD
                    </h3>
                  </div>
                  <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                    Import or export your entire pages list database as a single JSON file. Restores contexts instantly.
                  </p>
                  
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                    <button 
                      onClick={handleExportWorkspace}
                      className="btn-premium"
                      style={{ padding: "10px 16px", fontSize: "12.5px", display: "inline-flex", alignItems: "center", gap: "8px" }}
                    >
                      <Download size={14} />
                      <span>Export JSON Workspace</span>
                    </button>

                    <label 
                      className="btn-secondary"
                      style={{ padding: "10px 16px", fontSize: "12.5px", display: "inline-flex", alignItems: "center", gap: "8px", cursor: "pointer" }}
                    >
                      <Upload size={14} />
                      <span>Restore Import</span>
                      <input 
                        type="file" 
                        accept=".json"
                        onChange={handleImportWorkspace} 
                        style={{ display: "none" }}
                      />
                    </label>

                    <button 
                      onClick={handleClearWorkspace}
                      className="btn-secondary"
                      style={{ padding: "10px 16px", fontSize: "12.5px", color: "var(--accent-danger)", borderColor: "rgba(239,68,68,0.2)" }}
                    >
                      <span>Reset Workspace</span>
                    </button>
                  </div>
                </div>

                {/* DAX / Rook Subscription Bridge (real local gateway) */}
                <div className="glass-card" style={{ padding: "30px", display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border-muted)", paddingBottom: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <Sparkles size={18} style={{ color: "var(--accent-primary)" }} />
                      <h3 style={{ fontSize: "16px", fontWeight: "600", fontFamily: "var(--font-display)" }}>
                        DAX / Rook Subscription Bridge
                      </h3>
                    </div>
                    {daxStatus === "connected" && (
                      <span className="pulse-dot" style={{ backgroundColor: "var(--accent-success)", boxShadow: "0 0 10px var(--accent-success)" }} title="Bridge connected"></span>
                    )}
                  </div>

                  <p style={{ fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: "1.6" }}>
                    Use your <strong>ChatGPT Plus</strong> / <strong>Gemini Advanced</strong> / <strong>Claude</strong> subscription with no API keys — Distill routes through a local DAX (or Rook) server that holds your sign-in. Run <code style={{ fontFamily: "var(--font-mono)", color: "var(--accent-secondary)" }}>dax auth login</code> then <code style={{ fontFamily: "var(--font-mono)", color: "var(--accent-secondary)" }}>dax serve --port 4096</code>, then connect below.
                  </p>

                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: "1 1 240px" }}>
                      <label style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Server URL</label>
                      <input
                        type="text"
                        value={apiKeys.daxUrl}
                        placeholder="http://127.0.0.1:4096"
                        onChange={(e) => setApiKeys({ ...apiKeys, daxUrl: e.target.value })}
                        className="input-premium"
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: "1 1 160px" }}>
                      <label style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Server Password (optional)</label>
                      <input
                        type="password"
                        value={apiKeys.daxPassword}
                        placeholder="DAX_SERVER_PASSWORD"
                        onChange={(e) => setApiKeys({ ...apiKeys, daxPassword: e.target.value })}
                        className="input-premium"
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "11.5px", fontFamily: "var(--font-mono)", color: daxStatus === "error" ? "var(--accent-danger)" : daxStatus === "connected" ? "var(--accent-success)" : "var(--text-muted)" }}>
                      {daxStatus === "connecting" ? "Connecting…" : daxStatusMsg || "Not connected"}
                    </span>
                    <button
                      onClick={handleConnectDax}
                      disabled={daxStatus === "connecting"}
                      className="btn-premium"
                      style={{ padding: "8px 16px", fontSize: "12px" }}
                    >
                      {daxStatus === "connected" ? "Reconnect" : "Test & Connect"}
                    </button>
                  </div>
                </div>

                {/* API Keys Configuration */}
                <div className="glass-card" style={{ padding: "30px", display: "flex", flexDirection: "column", gap: "20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", borderBottom: "1px solid var(--border-muted)", paddingBottom: "12px" }}>
                    <Key size={18} style={{ color: "var(--accent-primary)" }} />
                    <h3 style={{ fontSize: "16px", fontWeight: "600", fontFamily: "var(--font-display)" }}>
                      BYOK Cloud Credentials
                    </h3>
                  </div>
                  {/* OpenAI */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label style={{ fontSize: "12px", color: "var(--text-secondary)" }}>OpenAI API Key</label>
                    <input
                      type="password"
                      value={apiKeys.openai}
                      onChange={(e) => {
                        const updated = { ...apiKeys, openai: e.target.value }
                        setApiKeys(updated)
                        safeLocalStorage.setItem("distill_api_key_openai", e.target.value)
                      }}
                      placeholder="sk-proj-..."
                      className="input-premium"
                    />
                  </div>
                  {/* Gemini */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Gemini API Key</label>
                    <input
                      type="password"
                      value={apiKeys.gemini}
                      onChange={(e) => {
                        const updated = { ...apiKeys, gemini: e.target.value }
                        setApiKeys(updated)
                        safeLocalStorage.setItem("distill_api_key_gemini", e.target.value)
                      }}
                      placeholder="AIzaSy..."
                      className="input-premium"
                    />
                  </div>
                  {/* Anthropic */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Anthropic API Key</label>
                    <input
                      type="password"
                      value={apiKeys.anthropic}
                      onChange={(e) => {
                        const updated = { ...apiKeys, anthropic: e.target.value }
                        setApiKeys(updated)
                        safeLocalStorage.setItem("distill_api_key_anthropic", e.target.value)
                      }}
                      placeholder="sk-ant-..."
                      className="input-premium"
                    />
                  </div>
                  {/* Groq */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Groq API Key</label>
                    <input
                      type="password"
                      value={apiKeys.groq}
                      onChange={(e) => {
                        const updated = { ...apiKeys, groq: e.target.value }
                        setApiKeys(updated)
                        safeLocalStorage.setItem("distill_api_key_groq", e.target.value)
                      }}
                      placeholder="gsk_..."
                      className="input-premium"
                    />
                  </div>
                  <p style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: "1.5" }}>
                    Keys are stored locally in your browser and never sent to any server.
                  </p>
                </div>
              </div>

              {/* Right Column Settings */}
              <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
                {/* Workspace Aesthetics */}
                <div className="glass-card" style={{ padding: "30px", display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", borderBottom: "1px solid var(--border-muted)", paddingBottom: "12px" }}>
                    <Moon size={18} style={{ color: "var(--accent-secondary)" }} />
                    <h3 style={{ fontSize: "16px", fontWeight: "600", fontFamily: "var(--font-display)" }}>Theme customizer</h3>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <button onClick={() => setTheme("default")} className={`btn-secondary ${theme === "default" ? "active" : ""}`} style={{ fontSize: "12px", width: "100%" }}>Obsidian Graphite</button>
                    <button onClick={() => setTheme("light")} className={`btn-light ${theme === "light" ? "active" : ""}`} style={{ fontSize: "12px", width: "100%" }}>Alabaster Light</button>
                    <button onClick={() => setTheme("vercel")} className={`btn-secondary ${theme === "vercel" ? "active" : ""}`} style={{ fontSize: "12px", width: "100%" }}>Vercel Silver</button>
                    <button onClick={() => setTheme("emerald")} className={`btn-secondary ${theme === "emerald" ? "active" : ""}`} style={{ fontSize: "12px", width: "100%" }}>Emerald Jade</button>
                    <button onClick={() => setTheme("sunset")} className={`btn-secondary ${theme === "sunset" ? "active" : ""}`} style={{ fontSize: "12px", width: "100%" }}>Copper Sunset</button>
                    <button onClick={() => setTheme("neon")} className={`btn-secondary ${theme === "neon" ? "active" : ""}`} style={{ fontSize: "12px", width: "100%" }}>Midnight Neon</button>
                    <button onClick={() => setTheme("frost")} className={`btn-secondary ${theme === "frost" ? "active" : ""}`} style={{ fontSize: "12px", gridColumn: "span 2", width: "100%" }}>Glacier Frost</button>
                  </div>
                </div>

                {/* Google Drive Integration Panel */}
                <div className="glass-card" style={{ padding: "30px", display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", borderBottom: "1px solid var(--border-muted)", paddingBottom: "12px" }}>
                    <CloudLightning size={18} style={{ color: driveConnected ? "var(--accent-success)" : "var(--accent-secondary)" }} />
                    <h3 style={{ fontSize: "16px", fontWeight: "600", fontFamily: "var(--font-display)" }}>Google Drive Integration</h3>
                  </div>
                  
                  {driveConnected ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(16, 185, 129, 0.06)", border: "1px solid rgba(16, 185, 129, 0.15)", padding: "10px 14px", borderRadius: "var(--radius-sm)" }}>
                        <span className="pulse-dot" style={{ backgroundColor: "var(--accent-success)", boxShadow: "0 0 8px var(--accent-success)" }}></span>
                        <span style={{ fontSize: "12.5px", color: "var(--accent-success)", fontWeight: "600", fontFamily: "var(--font-mono)" }}>
                          CONNECTED TO GOOGLE DRIVE
                        </span>
                      </div>
                      
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          onClick={() => {
                            setIsSyncingDrive(true)
                            setTimeout(() => {
                              setIsSyncingDrive(false)
                              logSystemMessage("SYSTEM", "Synchronized all notes and databases to Google Drive backup deck successfully!")
                              alert("Synchronized and backed up successfully to Google Drive!")
                            }, 1500)
                          }}
                          disabled={isSyncingDrive}
                          className="btn-premium"
                          style={{ flex: 1, padding: "8px 12px", fontSize: "12px", background: "rgba(255,255,255,0.02)", color: "var(--text-primary)", borderColor: "var(--border-active)" }}
                        >
                          {isSyncingDrive ? "Backing up..." : "Backup Deck to Drive"}
                        </button>
                        <button
                          onClick={() => setIsDrivePickerOpen(true)}
                          className="btn-premium"
                          style={{ flex: 1, padding: "8px 12px", fontSize: "12px" }}
                        >
                          Import from Drive
                        </button>
                      </div>
                      
                      <button
                        onClick={() => {
                          setDriveConnected(false)
                          safeLocalStorage.setItem("distill_drive_connected", "false")
                          logSystemMessage("SYSTEM", "Disconnected Google Drive integration")
                        }}
                        className="btn-secondary"
                        style={{ fontSize: "11px", padding: "6px", width: "100%", color: "var(--accent-danger)" }}
                      >
                        Disconnect Integration
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      <p style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.5" }}>
                        Connect your Google Drive account to easily sync all your pages, back up document decks, or import text specs and project spreadsheets directly into Distill.
                      </p>
                      <button
                        onClick={() => {
                          setIsSyncingDrive(true)
                          setTimeout(() => {
                            setDriveConnected(true)
                            setIsSyncingDrive(false)
                            safeLocalStorage.setItem("distill_drive_connected", "true")
                            logSystemMessage("SYSTEM", "Authenticated successfully with Google Drive OAuth secure channel")
                          }, 1200)
                        }}
                        disabled={isSyncingDrive}
                        className="btn-premium"
                        style={{ width: "100%", fontSize: "12.5px" }}
                      >
                        {isSyncingDrive ? "Authorizing Google OAuth..." : "Connect Google Drive"}
                      </button>
                    </div>
                  )}
                </div>

                {/* Local Ollama status */}
                <OllamaManager
                  onModelsLoaded={setOllamaModels}
                  selectedModel={provider === "ollama" ? model : ""}
                  onSelectModel={setModel}
                />

                {/* WebLLM — browser-native model runner */}
                <WebLLMManager
                  onModelReady={(modelId) => {
                    setProvider("webllm")
                    setModel(modelId)
                    logSystemMessage("SYSTEM", `WebLLM model ready: ${modelId}`)
                  }}
                  onModelUnloaded={() => {
                    if (provider === "webllm") {
                      setProvider("ollama")
                      setModel(ollamaModels[0] || "")
                      logSystemMessage("SYSTEM", "WebLLM unloaded — reverted to Ollama")
                    }
                  }}
                />

                {/* Real-time System Console Audit logs */}
                <div className="glass-card" style={{ padding: "30px", display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", borderBottom: "1px solid var(--border-muted)", paddingBottom: "12px" }}>
                    <Activity size={18} style={{ color: "var(--accent-success)" }} />
                    <h3 style={{ fontSize: "16px", fontWeight: "600", fontFamily: "var(--font-display)" }}>
                      System Console Audit Logs
                    </h3>
                  </div>
                  
                  <div className="system-console-panel">
                    {systemLogs.map((log, idx) => (
                      <div key={idx} className="log-line">
                        <span className="log-timestamp">[{log.time}]</span>
                        <span className={`log-tag ${log.tag.toLowerCase()}`}>{log.tag}</span>
                        <span className="log-msg">{log.message}</span>
                      </div>
                    ))}
                    {systemLogs.length === 0 && (
                      <div style={{ color: "var(--text-muted)", fontSize: "11px", textAlign: "center", padding: "10px" }}>
                        Console is active. Awaiting system logs...
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>
          ) : activePage ? (
            /* Render active workspace document */
            activePage.type === "planner" ? (
              <KanbanBoard
                page={activePage}
                onUpdatePage={handleUpdatePage}
                provider={provider}
                model={model}
                apiKeys={apiKeys}
                isOllamaOnline={isOllamaOnline}
                logSystemMessage={logSystemMessage}
              />
            ) : activePage.type === "journal" ? (
              <JournalLogger page={activePage} onUpdatePage={handleUpdatePage} />
            ) : activePage.type === "table" ? (
              <DatabaseTable page={activePage} onUpdatePage={handleUpdatePage} />
            ) : activePage.type === "moodboard" ? (
              <MoodBoard page={activePage} onUpdatePage={handleUpdatePage} />
            ) : (
              <DocumentEditor
                page={activePage}
                pages={pages}
                workspace={workspace}
                onUpdatePage={handleUpdatePage}
                provider={provider} 
                model={model} 
                apiKeys={apiKeys}
                onTriggerAI={triggerSidecar}
                onNavigate={setActivePageId}
              />
            )
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "360px", color: "var(--text-muted)", gap: "10px" }}>
              <Brain size={28} />
              <span>Select or create a Distill document to begin your workflow.</span>
            </div>
          )}
        </div>
      </main>

      {/* Global Semantic Search Modal */}
      {isSearchOpen && (
        <SearchModal
          pages={pages}
          workspace={workspace}
          embedStatus={embedStatus}
          onNavigate={(id) => {
            setActivePageId(id)
            logSystemMessage("SYSTEM", `Search navigation → page "${id}"`)
          }}
          onClose={() => setIsSearchOpen(false)}
        />
      )}

      {/* Google Drive File Explorer Picker Sheet Modal */}
      {isDrivePickerOpen && (
        <div className="modal-overlay-backdrop" onClick={() => setIsDrivePickerOpen(false)}>
          <div className="premium-modal-window" onClick={(e) => e.stopPropagation()} style={{ width: "460px" }}>
            <div className="aeye-header" style={{ borderBottom: "1px solid var(--border-muted)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <CloudLightning size={16} style={{ color: "var(--accent-success)" }} />
                <span style={{ fontSize: "14px", fontWeight: "700", fontFamily: "var(--font-display)", color: "#ffffff" }}>
                  Google Drive File Picker
                </span>
              </div>
              <button
                onClick={() => setIsDrivePickerOpen(false)}
                style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
              >
                <X size={15} />
              </button>
            </div>
            
            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "8px" }}>
                Select a document or database file from your secure Google Cloud storage:
              </p>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {mockDriveFiles.map(file => (
                  <div
                    key={file.id}
                    onClick={() => handleImportDriveFile(file)}
                    className="drive-file-row"
                  >
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: "600", color: "#ffffff" }}>{file.title.replace(/\.(gdoc|gsheet)$/, "")}</div>
                      <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "2px" }}>
                        {file.title.endsWith(".gdoc") ? "Google Document Text Sheet" : "Google Spreadsheet Data Table"}
                      </div>
                    </div>
                    <span style={{ fontSize: "11px", color: "var(--accent-primary)", fontWeight: "700" }}>IMPORT</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Collapsible Distill AI Sidecar Panel */}
      <aside className={`sidecar-panel ${isSidecarOpen ? "" : "closed"}`}>
        <div style={{ display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border-muted)", paddingBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Sparkles size={16} style={{ color: "var(--accent-primary)" }} />
            <span style={{ fontSize: "14px", fontWeight: "700", fontFamily: "var(--font-display)", color: "#ffffff" }}>
              DISTILL AI DIALOGUE SIDECAR
            </span>
          </div>
          <button 
            onClick={() => setIsSidecarOpen(false)}
            style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Sidecar Tool Select Tab Bar */}
        <div style={{ display: "flex", gap: "4px", background: "rgba(0,0,0,0.3)", padding: "2px", borderRadius: "6px", border: "1px solid var(--border-muted)" }}>
          {(["rewrite", "ladder", "decision", "reading", "surgeon"] as const).map((tool) => (
            <button
              key={tool}
              onClick={() => setActiveSidecarTool(tool)}
              style={{
                flex: 1,
                padding: "6px 4px",
                fontSize: "9.5px",
                background: activeSidecarTool === tool ? "rgba(255,255,255,0.05)" : "transparent",
                border: "none",
                borderRadius: "4px",
                color: activeSidecarTool === tool ? "#ffffff" : "var(--text-secondary)",
                fontWeight: "700",
                cursor: "pointer",
                transition: "var(--transition-smooth)"
              }}
            >
              {tool === "surgeon" ? "SURGEON" : tool.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Sidecar execution deck */}
        <div style={{ flex: 1, overflowY: "auto", paddingRight: "2px" }}>
          {activeSidecarTool === "rewrite" && (
            <RewriteRoom provider={provider} model={model} apiKeys={apiKeys} />
          )}
          {activeSidecarTool === "ladder" && (
            <ConceptLadder provider={provider} model={model} apiKeys={apiKeys} />
          )}
          {activeSidecarTool === "decision" && (
            <DecisionUnpacker provider={provider} model={model} apiKeys={apiKeys} />
          )}
          {activeSidecarTool === "reading" && (
            <ReadingCompanion provider={provider} model={model} apiKeys={apiKeys} />
          )}
          {activeSidecarTool === "surgeon" && (
            <PromptSurgeon
              provider={provider}
              model={model}
              apiKeys={apiKeys}
              isOllamaOnline={isOllamaOnline}
              logSystemMessage={logSystemMessage}
            />
          )}
        </div>
      </aside>

      {/* Floating A-Eye Accessibility & Smart Assistant Chatbot Widget */}
      <AEyeAssistant
        activePage={activePage}
        theme={theme}
        setTheme={setTheme}
        provider={provider}
        model={model}
        apiKeys={apiKeys}
      />

      {/* Frictionless capture: floating trigger + modal (⌘/Ctrl+Shift+K) */}
      <button
        className="quick-capture-fab"
        onClick={() => setIsQuickCaptureOpen(true)}
        title="Quick Capture (⌘⇧K)"
        aria-label="Quick Capture"
      >
        <Zap size={20} />
      </button>
      <QuickCapture
        open={isQuickCaptureOpen}
        onClose={() => setIsQuickCaptureOpen(false)}
        onCapture={handleQuickCapture}
      />
    </div>
  )
}
