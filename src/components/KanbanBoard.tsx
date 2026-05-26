import { useState } from "react"
import {
  Plus, Trash2, ChevronLeft, ChevronRight, Calendar, X, Check, Edit3,
  Sparkles, BookOpen, Bug, Zap, Layers, FlaskConical, Loader2, GripVertical
} from "lucide-react"
import { Page, KanbanTask, KanbanStatus, KanbanPriority, KanbanType } from "../App"
import { executePrompt, type APIKeys } from "../utils/ai"

interface KanbanBoardProps {
  page: Page
  onUpdatePage: (updatedPage: Page) => void
  provider?: string
  model?: string
  apiKeys?: APIKeys
  isOllamaOnline?: boolean
  logSystemMessage?: (tag: "SYSTEM" | "DATABASE" | "OLLAMA" | "ERROR", message: string) => void
}

// ─── SDLC lane definitions (order = left→right flow) ──────────────────────────
const LANES: { key: KanbanStatus; label: string; color: string }[] = [
  { key: "backlog", label: "BACKLOG", color: "var(--text-muted)" },
  { key: "todo", label: "TO DO", color: "var(--accent-secondary)" },
  { key: "progress", label: "IN PROGRESS", color: "var(--accent-info)" },
  { key: "review", label: "IN REVIEW", color: "var(--accent-warning)" },
  { key: "done", label: "DONE", color: "var(--accent-success)" },
]
const LANE_ORDER: KanbanStatus[] = LANES.map((l) => l.key)

const TYPE_META: Record<KanbanType, { icon: typeof BookOpen; color: string; label: string }> = {
  story: { icon: BookOpen, color: "#22c55e", label: "Story" },
  task: { icon: Check, color: "#3b82f6", label: "Task" },
  bug: { icon: Bug, color: "#ef4444", label: "Bug" },
  epic: { icon: Layers, color: "#a855f7", label: "Epic" },
  spike: { icon: FlaskConical, color: "#f59e0b", label: "Spike" },
}

const PRIORITIES: KanbanPriority[] = ["low", "medium", "high", "critical"]
const SDLC_LABELS = ["feature", "bug", "infra", "design", "docs", "test", "chore"]

export default function KanbanBoard({ page, onUpdatePage, provider, model, apiKeys, isOllamaOnline, logSystemMessage }: KanbanBoardProps) {
  const [newTaskTitle, setNewTaskTitle] = useState("")
  const [newTaskType, setNewTaskType] = useState<KanbanType>("task")
  const [newTaskPriority, setNewTaskPriority] = useState<KanbanPriority>("medium")
  const [newTaskPoints, setNewTaskPoints] = useState<number>(3)
  const [showAddForm, setShowAddForm] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState<KanbanType | "">("")

  // Drag state
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverLane, setDragOverLane] = useState<KanbanStatus | null>(null)

  // AI sprint planner
  const [showPlanner, setShowPlanner] = useState(false)
  const [plannerGoal, setPlannerGoal] = useState("")
  const [isPlanning, setIsPlanning] = useState(false)
  const [plannerError, setPlannerError] = useState("")

  // Detail modal
  const [selectedTask, setSelectedTask] = useState<KanbanTask | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const tasks = page.tasks || []
  const update = (next: KanbanTask[]) => onUpdatePage({ ...page, tasks: next })

  // ─── CRUD ───────────────────────────────────────────────────────────────────
  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTaskTitle.trim()) return
    const newTask: KanbanTask = {
      id: Math.random().toString(36).substring(2, 9),
      title: newTaskTitle.trim(),
      status: "backlog",
      priority: newTaskPriority,
      type: newTaskType,
      points: newTaskPoints,
      createdAt: Date.now(),
    }
    update([...tasks, newTask])
    setNewTaskTitle(""); setNewTaskType("task"); setNewTaskPriority("medium"); setNewTaskPoints(3)
    setShowAddForm(false)
  }

  const handleDeleteTask = (taskId: string) => update(tasks.filter((t) => t.id !== taskId))

  const moveToStatus = (taskId: string, status: KanbanStatus) =>
    update(tasks.map((t) => (t.id === taskId ? { ...t, status } : t)))

  const handleShiftStatus = (taskId: string, direction: "left" | "right") => {
    update(tasks.map((t) => {
      if (t.id !== taskId) return t
      const idx = LANE_ORDER.indexOf(t.status)
      const nextIdx = direction === "left" ? Math.max(0, idx - 1) : Math.min(LANE_ORDER.length - 1, idx + 1)
      return { ...t, status: LANE_ORDER[nextIdx] }
    }))
  }

  const handleCyclePriority = (taskId: string) => {
    update(tasks.map((t) => {
      if (t.id !== taskId) return t
      const idx = PRIORITIES.indexOf(t.priority)
      return { ...t, priority: PRIORITIES[(idx + 1) % PRIORITIES.length] }
    }))
  }

  // ─── Drag & drop across lanes ─────────────────────────────────────────────────
  const handleDrop = (status: KanbanStatus) => {
    if (draggedId) moveToStatus(draggedId, status)
    setDraggedId(null); setDragOverLane(null)
  }

  // ─── Detail modal ─────────────────────────────────────────────────────────────
  const openModal = (task: KanbanTask) => { setSelectedTask({ ...task }); setIsModalOpen(true) }
  const saveModal = () => {
    if (!selectedTask) return
    update(tasks.map((t) => (t.id === selectedTask.id ? selectedTask : t)))
    setIsModalOpen(false); setSelectedTask(null)
  }
  const patchSelected = (patch: Partial<KanbanTask>) =>
    setSelectedTask((s) => (s ? { ...s, ...patch } : s))

  // ─── AI sprint planner (routes through the active provider, incl. DAX bridge) ─
  const handlePlanSprint = async () => {
    if (!plannerGoal.trim() || !apiKeys || !provider) return
    setIsPlanning(true); setPlannerError("")
    const system = `You are a senior engineering planner. Break the user's goal into a concrete software sprint backlog.
Return ONLY a JSON array (no prose, no markdown fences). Each item:
{"title": string, "type": "story"|"task"|"bug"|"epic"|"spike", "priority": "low"|"medium"|"high"|"critical", "points": number (1,2,3,5,8), "label": "feature"|"bug"|"infra"|"design"|"docs"|"test"|"chore", "description": string}
6-10 items, ordered by sensible delivery sequence, covering build + test + docs.`
    try {
      const raw = await executePrompt({ provider, model: model || "", apiKeys, prompt: `Goal: ${plannerGoal.trim()}`, systemPrompt: system })
      const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
      const start = cleaned.indexOf("["); const end = cleaned.lastIndexOf("]")
      const parsed = JSON.parse(start >= 0 ? cleaned.slice(start, end + 1) : cleaned) as Partial<KanbanTask>[]
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("No tasks returned")
      const generated: KanbanTask[] = parsed.slice(0, 12).map((p) => ({
        id: Math.random().toString(36).substring(2, 9),
        title: String(p.title || "Untitled").slice(0, 160),
        status: "backlog" as KanbanStatus,
        priority: (PRIORITIES.includes(p.priority as KanbanPriority) ? p.priority : "medium") as KanbanPriority,
        type: (p.type && TYPE_META[p.type as KanbanType] ? p.type : "task") as KanbanType,
        points: typeof p.points === "number" ? p.points : 3,
        label: typeof p.label === "string" ? p.label : undefined,
        description: typeof p.description === "string" ? p.description : undefined,
        createdAt: Date.now(),
        assignee: "ai",
      }))
      update([...tasks, ...generated])
      logSystemMessage?.("SYSTEM", `AI sprint planner added ${generated.length} issues for "${plannerGoal.trim()}"`)
      setShowPlanner(false); setPlannerGoal("")
    } catch (e) {
      setPlannerError((e as Error).message || "Planning failed")
    } finally {
      setIsPlanning(false)
    }
  }

  // ─── Filters + stats ──────────────────────────────────────────────────────────
  const filteredTasks = tasks.filter((t) => {
    if (typeFilter && t.type !== typeFilter) return false
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return [t.title, t.description, t.label, t.assignee, t.priority, t.type, t.epic]
      .some((v) => (v || "").toString().toLowerCase().includes(q))
  })

  const pts = (list: KanbanTask[]) => list.reduce((sum, t) => sum + (t.points || 0), 0)
  const totalPoints = pts(tasks)
  const donePoints = pts(tasks.filter((t) => t.status === "done"))
  const completion = totalPoints > 0 ? Math.round((donePoints / totalPoints) * 100) : 0
  const criticalCount = tasks.filter((t) => t.priority === "critical").length

  const aiReady = !!(provider && apiKeys && (provider !== "ollama" || isOllamaOnline) && (provider !== "dax" || (apiKeys.daxUrl && model)))

  // ─── Card renderer ──────────────────────────────────────────────────────────
  const renderCard = (task: KanbanTask, laneIdx: number) => {
    const TypeIcon = TYPE_META[task.type || "task"].icon
    const typeColor = TYPE_META[task.type || "task"].color
    const overdue = task.dueDate && task.dueDate < Date.now() && task.status !== "done"
    return (
      <div
        key={task.id}
        className="kanban-card"
        draggable
        onDragStart={() => setDraggedId(task.id)}
        onDragEnd={() => { setDraggedId(null); setDragOverLane(null) }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
            <GripVertical size={12} style={{ color: "var(--text-muted)", opacity: 0.5, flexShrink: 0 }} />
            <TypeIcon size={13} style={{ color: typeColor, flexShrink: 0 }} />
            {task.label && <span className="kanban-component-badge">{task.label}</span>}
          </div>
          <button onClick={() => handleDeleteTask(task.id)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", flexShrink: 0 }}>
            <Trash2 size={12} className="trash-hover" />
          </button>
        </div>

        <span
          onClick={() => openModal(task)}
          className="card-title-hover"
          style={{ fontSize: "13px", color: task.status === "done" ? "var(--text-secondary)" : "var(--text-primary)", textDecoration: task.status === "done" ? "line-through" : "none", fontWeight: 500, lineHeight: 1.4, cursor: "pointer" }}
        >
          {task.title}
        </span>

        {task.dueDate && (
          <div className={`kanban-date-badge ${overdue ? "overdue" : ""}`} style={{ alignSelf: "flex-start" }}>
            <Calendar size={10} /><span>{new Date(task.dueDate).toLocaleDateString()}</span>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "2px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <button onClick={() => handleCyclePriority(task.id)} className={`priority-pill ${task.priority}`} style={{ border: "none", cursor: "pointer" }} title="Cycle priority">
              {task.priority}
            </button>
            {typeof task.points === "number" && <span className="story-points" title="Story points">{task.points}</span>}
            {task.assignee && <span className={`assignee-avatar-badge ${task.assignee}`} title={`Assignee: ${task.assignee.toUpperCase()}`}>{task.assignee.toUpperCase()}</span>}
          </div>
          <div style={{ display: "flex", gap: "4px" }}>
            <button disabled={laneIdx === 0} onClick={() => handleShiftStatus(task.id, "left")} className="btn-secondary" style={{ padding: "3px 5px", borderRadius: "4px", opacity: laneIdx === 0 ? 0.2 : 1 }}>
              <ChevronLeft size={13} />
            </button>
            <button disabled={laneIdx === LANES.length - 1} onClick={() => handleShiftStatus(task.id, "right")} className="btn-secondary" style={{ padding: "3px 5px", borderRadius: "4px", opacity: laneIdx === LANES.length - 1 ? 0.2 : 1 }}>
              <ChevronRight size={13} style={{ color: "var(--accent-primary)" }} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header + sprint stats */}
      <div className="glass-card" style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
          <div style={{ minWidth: "200px", flex: 1 }}>
            <input
              type="text"
              value={page.title}
              onChange={(e) => onUpdatePage({ ...page, title: e.target.value })}
              style={{ background: "transparent", border: "none", fontSize: "20px", fontWeight: 800, color: "var(--text-primary)", outline: "none", fontFamily: "var(--font-display)", width: "100%" }}
              placeholder="Untitled Sprint Board"
            />
            <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontWeight: 600 }}>
              SDLC SPRINT BOARD · {tasks.length} ISSUES
            </span>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={() => setShowPlanner(true)} className="btn-secondary" style={{ padding: "8px 14px", fontSize: "12.5px", display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <Sparkles size={14} style={{ color: "var(--accent-primary)" }} /><span>Plan with AI</span>
            </button>
            <button onClick={() => setShowAddForm(!showAddForm)} className="btn-premium" style={{ padding: "8px 16px", fontSize: "12.5px", display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <Plus size={14} /><span>New Issue</span>
            </button>
          </div>
        </div>

        {/* Sprint progress bar */}
        <div style={{ display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "5px", flex: 1, minWidth: "240px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-secondary)", fontFamily: "var(--font-mono)", fontWeight: 600 }}>
              <span>SPRINT PROGRESS</span>
              <span>{donePoints}/{totalPoints} pts · {completion}%</span>
            </div>
            <div className="sprint-progress-track"><div className="sprint-progress-fill" style={{ width: `${completion}%` }} /></div>
          </div>
          <div style={{ display: "flex", gap: "16px" }}>
            {LANES.map((l) => (
              <div key={l.key} style={{ textAlign: "center" }}>
                <div style={{ fontSize: "16px", fontWeight: 800, fontFamily: "var(--font-display)", color: l.color }}>
                  {tasks.filter((t) => t.status === l.key).length}
                </div>
                <div style={{ fontSize: "8.5px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>{l.label}</div>
              </div>
            ))}
            {criticalCount > 0 && (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "16px", fontWeight: 800, fontFamily: "var(--font-display)", color: "var(--accent-danger)" }}>{criticalCount}</div>
                <div style={{ fontSize: "8.5px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>CRITICAL</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="glass-card" style={{ padding: "12px 18px", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", background: "rgba(255,255,255,0.01)" }}>
        <input
          type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search issues…" className="input-premium"
          style={{ padding: "6px 12px", fontSize: "12px", flex: 1, minWidth: "200px" }}
        />
        <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
          <button onClick={() => setTypeFilter("")} className="action-pill-premium" style={{ fontSize: "9.5px", padding: "3px 9px", opacity: typeFilter === "" ? 1 : 0.55 }}>All</button>
          {(Object.keys(TYPE_META) as KanbanType[]).map((t) => (
            <button key={t} onClick={() => setTypeFilter(typeFilter === t ? "" : t)} className="action-pill-premium" style={{ fontSize: "9.5px", padding: "3px 9px", opacity: typeFilter === t ? 1 : 0.55, textTransform: "capitalize" }}>
              {TYPE_META[t].label}
            </button>
          ))}
        </div>
      </div>

      {/* Add issue form */}
      {showAddForm && (
        <form className="glass-card" onSubmit={handleAddTask} style={{ padding: "18px", display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center" }}>
          <input type="text" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} placeholder="Issue summary…" className="input-premium" style={{ flex: 1, minWidth: "240px" }} required />
          <select value={newTaskType} onChange={(e) => setNewTaskType(e.target.value as KanbanType)} className="input-premium" style={{ width: "120px" }}>
            {(Object.keys(TYPE_META) as KanbanType[]).map((t) => <option key={t} value={t}>{TYPE_META[t].label}</option>)}
          </select>
          <select value={newTaskPriority} onChange={(e) => setNewTaskPriority(e.target.value as KanbanPriority)} className="input-premium" style={{ width: "120px" }}>
            {PRIORITIES.map((p) => <option key={p} value={p} style={{ textTransform: "capitalize" }}>{p}</option>)}
          </select>
          <select value={newTaskPoints} onChange={(e) => setNewTaskPoints(Number(e.target.value))} className="input-premium" style={{ width: "90px" }}>
            {[1, 2, 3, 5, 8, 13].map((p) => <option key={p} value={p}>{p} pts</option>)}
          </select>
          <button type="submit" className="btn-premium" style={{ padding: "8px 14px", fontSize: "12.5px" }}>Create</button>
          <button type="button" onClick={() => setShowAddForm(false)} className="btn-secondary" style={{ padding: "8px 14px", fontSize: "12.5px" }}>Cancel</button>
        </form>
      )}

      {/* SDLC lanes */}
      <div className="kanban-board sdlc">
        {LANES.map((lane, laneIdx) => {
          const laneTasks = filteredTasks.filter((t) => t.status === lane.key)
          return (
            <div
              key={lane.key}
              className={`kanban-column ${dragOverLane === lane.key ? "drag-over" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDragOverLane(lane.key) }}
              onDragLeave={() => setDragOverLane((c) => (c === lane.key ? null : c))}
              onDrop={() => handleDrop(lane.key)}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border-muted)", paddingBottom: "8px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: lane.color, display: "flex", alignItems: "center", gap: "7px" }}>
                  <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: lane.color }} />
                  {lane.label}
                </span>
                <span className="kbd-badge">{laneTasks.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "9px", minHeight: "340px" }}>
                {laneTasks.map((t) => renderCard(t, laneIdx))}
                {laneTasks.length === 0 && (
                  <div style={{ display: "flex", flex: 1, border: "1.5px dashed var(--border-muted)", borderRadius: "var(--radius-sm)", alignItems: "center", justifyContent: "center", minHeight: "90px", color: "var(--text-muted)" }}>
                    <span style={{ fontSize: "11px" }}>Drop issues here</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* AI Sprint Planner modal */}
      {showPlanner && (
        <div className="modal-overlay-backdrop" onClick={() => !isPlanning && setShowPlanner(false)}>
          <div className="premium-modal-window liquid-glass" onClick={(e) => e.stopPropagation()} style={{ width: "520px" }}>
            <div className="aeye-header">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Sparkles size={15} style={{ color: "var(--accent-primary)" }} />
                <span style={{ fontSize: "14px", fontWeight: 700, fontFamily: "var(--font-display)" }}>AI Sprint Planner</span>
              </div>
              <button onClick={() => !isPlanning && setShowPlanner(false)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={15} /></button>
            </div>
            <div style={{ padding: "22px", display: "flex", flexDirection: "column", gap: "14px" }}>
              <p style={{ fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                Describe a goal or feature. The active model ({provider?.toUpperCase() || "—"}) breaks it into a sequenced backlog of stories, tasks, bugs and spikes with estimates — dropped straight into your Backlog.
              </p>
              <textarea
                value={plannerGoal} onChange={(e) => setPlannerGoal(e.target.value)}
                placeholder="e.g. Ship user auth with email + OAuth, rate limiting, and audit logging"
                className="input-premium" style={{ height: "90px", resize: "none", fontSize: "13px", lineHeight: 1.6 }}
                disabled={isPlanning}
              />
              {!aiReady && <span style={{ fontSize: "11.5px", color: "var(--accent-warning)" }}>Connect a provider first (Workspace Sync → Provider / DAX bridge).</span>}
              {plannerError && <span style={{ fontSize: "11.5px", color: "var(--accent-danger)" }}>{plannerError}</span>}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <button onClick={() => setShowPlanner(false)} disabled={isPlanning} className="btn-secondary" style={{ padding: "8px 14px", fontSize: "12px" }}>Cancel</button>
                <button onClick={handlePlanSprint} disabled={isPlanning || !aiReady || !plannerGoal.trim()} className="btn-premium" style={{ padding: "8px 18px", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  {isPlanning ? <><Loader2 size={13} className="spin-icon" /> Planning…</> : <><Zap size={13} /> Generate Backlog</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Issue detail modal */}
      {isModalOpen && selectedTask && (
        <div className="modal-overlay-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="premium-modal-window" onClick={(e) => e.stopPropagation()} style={{ width: "520px" }}>
            <div className="aeye-header">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Edit3 size={15} style={{ color: "var(--accent-primary)" }} />
                <span style={{ fontSize: "14px", fontWeight: 700, fontFamily: "var(--font-display)" }}>Issue Detail</span>
              </div>
              <button onClick={() => setIsModalOpen(false)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={15} /></button>
            </div>
            <div style={{ padding: "22px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <input type="text" value={selectedTask.title} onChange={(e) => patchSelected({ title: e.target.value })} className="input-premium" style={{ fontSize: "14.5px", fontWeight: 600 }} />
              <textarea value={selectedTask.description || ""} onChange={(e) => patchSelected({ description: e.target.value })} placeholder="Acceptance criteria, technical notes, scope…" className="input-premium" style={{ fontSize: "13px", height: "100px", resize: "none", lineHeight: 1.6 }} />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                <Field label="TYPE">
                  <select value={selectedTask.type || "task"} onChange={(e) => patchSelected({ type: e.target.value as KanbanType })} className="input-premium" style={{ fontSize: "12.5px", padding: "6px 8px" }}>
                    {(Object.keys(TYPE_META) as KanbanType[]).map((t) => <option key={t} value={t}>{TYPE_META[t].label}</option>)}
                  </select>
                </Field>
                <Field label="PRIORITY">
                  <select value={selectedTask.priority} onChange={(e) => patchSelected({ priority: e.target.value as KanbanPriority })} className="input-premium" style={{ fontSize: "12.5px", padding: "6px 8px", textTransform: "capitalize" }}>
                    {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </Field>
                <Field label="POINTS">
                  <select value={selectedTask.points ?? 3} onChange={(e) => patchSelected({ points: Number(e.target.value) })} className="input-premium" style={{ fontSize: "12.5px", padding: "6px 8px" }}>
                    {[0, 1, 2, 3, 5, 8, 13, 21].map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </Field>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                <Field label="STATUS">
                  <select value={selectedTask.status} onChange={(e) => patchSelected({ status: e.target.value as KanbanStatus })} className="input-premium" style={{ fontSize: "12.5px", padding: "6px 8px" }}>
                    {LANES.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
                  </select>
                </Field>
                <Field label="COMPONENT">
                  <select value={selectedTask.label || ""} onChange={(e) => patchSelected({ label: e.target.value || undefined })} className="input-premium" style={{ fontSize: "12.5px", padding: "6px 8px" }}>
                    <option value="">None</option>
                    {SDLC_LABELS.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </Field>
                <Field label="ASSIGNEE">
                  <select value={selectedTask.assignee || ""} onChange={(e) => patchSelected({ assignee: (e.target.value || undefined) as KanbanTask["assignee"] })} className="input-premium" style={{ fontSize: "12.5px", padding: "6px 8px" }}>
                    <option value="">Unassigned</option>
                    <option value="me">Me</option>
                    <option value="ai">AI</option>
                    <option value="tm">Team</option>
                  </select>
                </Field>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <Field label="EPIC / INITIATIVE">
                  <input type="text" value={selectedTask.epic || ""} onChange={(e) => patchSelected({ epic: e.target.value || undefined })} placeholder="e.g. Auth revamp" className="input-premium" style={{ fontSize: "12.5px", padding: "6px 10px" }} />
                </Field>
                <Field label="DUE DATE">
                  <input type="date" value={selectedTask.dueDate ? new Date(selectedTask.dueDate).toISOString().substring(0, 10) : ""} onChange={(e) => patchSelected({ dueDate: e.target.value ? new Date(e.target.value).getTime() : undefined })} className="input-premium" style={{ fontSize: "12px", padding: "6px 10px" }} />
                </Field>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", borderTop: "1px solid var(--border-muted)", paddingTop: "14px" }}>
                <button onClick={() => setIsModalOpen(false)} className="btn-secondary" style={{ padding: "6px 14px", fontSize: "12px" }}>Cancel</button>
                <button onClick={saveModal} className="btn-premium" style={{ padding: "6px 18px", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "4px" }}><Check size={12} /> Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <label style={{ fontSize: "10px", color: "var(--text-secondary)", fontWeight: 700, fontFamily: "var(--font-mono)", letterSpacing: "0.05em" }}>{label}</label>
      {children}
    </div>
  )
}
