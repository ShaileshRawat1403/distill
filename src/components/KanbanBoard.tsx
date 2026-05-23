import { useState } from "react"
import { Plus, Trash2, ChevronLeft, ChevronRight, AlertCircle } from "lucide-react"
import { Page, KanbanTask } from "../App"

interface KanbanBoardProps {
  page: Page
  onUpdatePage: (updatedPage: Page) => void
}

export default function KanbanBoard({ page, onUpdatePage }: KanbanBoardProps) {
  const [newTaskTitle, setNewTaskTitle] = useState("")
  const [newTaskPriority, setNewTaskPriority] = useState<"low" | "medium" | "high">("medium")
  const [showAddForm, setShowAddForm] = useState(false)

  const tasks = page.tasks || []

  // Add a task
  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTaskTitle.trim()) return

    const newTask: KanbanTask = {
      id: Math.random().toString(36).substring(2, 9),
      title: newTaskTitle.trim(),
      status: "todo",
      priority: newTaskPriority,
      createdAt: Date.now()
    }

    const updatedTasks = [...tasks, newTask]
    onUpdatePage({ ...page, tasks: updatedTasks })
    setNewTaskTitle("")
    setShowAddForm(false)
  }

  // Delete a task
  const handleDeleteTask = (taskId: string) => {
    const updatedTasks = tasks.filter(t => t.id !== taskId)
    onUpdatePage({ ...page, tasks: updatedTasks })
  }

  // Shift status lane
  const handleShiftStatus = (taskId: string, direction: "left" | "right") => {
    const statusOrder: ("todo" | "progress" | "done")[] = ["todo", "progress", "done"]
    
    const updatedTasks = tasks.map(t => {
      if (t.id === taskId) {
        const currentIdx = statusOrder.indexOf(t.status)
        let newIdx = currentIdx
        if (direction === "left") newIdx = Math.max(0, currentIdx - 1)
        if (direction === "right") newIdx = Math.min(statusOrder.length - 1, currentIdx + 1)
        return { ...t, status: statusOrder[newIdx] }
      }
      return t
    })

    onUpdatePage({ ...page, tasks: updatedTasks })
  }

  // Cyclic priority toggling: clicking tag cycles priority
  const handleCyclePriority = (taskId: string) => {
    const priorityOrder: ("low" | "medium" | "high")[] = ["low", "medium", "high"]
    const updatedTasks = tasks.map(t => {
      if (t.id === taskId) {
        const currentIdx = priorityOrder.indexOf(t.priority)
        const nextIdx = (currentIdx + 1) % priorityOrder.length
        return { ...t, priority: priorityOrder[nextIdx] }
      }
      return t
    })
    onUpdatePage({ ...page, tasks: updatedTasks })
  }

  // Separate tasks by column status
  const todoTasks = tasks.filter(t => t.status === "todo")
  const progressTasks = tasks.filter(t => t.status === "progress")
  const doneTasks = tasks.filter(t => t.status === "done")

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      
      {/* Title Hub card */}
      <div className="glass-card" style={{ padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
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
            placeholder="Untitled Sprint Board"
          />
          <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontWeight: "600" }}>
            NOTION KANBAN PLANNER BOARD DATABASE
          </span>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="btn-premium"
          style={{ padding: "8px 16px", fontSize: "12.5px", display: "inline-flex", alignItems: "center", gap: "6px" }}
        >
          <Plus size={14} />
          <span>New Task Block</span>
        </button>
      </div>

      {/* Add Task Quick Form */}
      {showAddForm && (
        <form className="glass-card" onSubmit={handleAddTask} style={{ padding: "20px", display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
          <div style={{ flex: 1, minWidth: "260px" }}>
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="E.g. Complete responsive interface overlays..."
              className="input-premium"
              required
            />
          </div>
          
          <div>
            <select
              value={newTaskPriority}
              onChange={(e) => setNewTaskPriority(e.target.value as any)}
              className="input-premium"
              style={{ width: "130px" }}
            >
              <option value="low">🔵 Low Priority</option>
              <option value="medium">🟡 Medium Priority</option>
              <option value="high">🔴 High Priority</option>
            </select>
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button type="submit" className="btn-premium" style={{ padding: "8px 14px", fontSize: "12.5px" }}>Create</button>
            <button type="button" onClick={() => setShowAddForm(false)} className="btn-secondary" style={{ padding: "8px 14px", fontSize: "12.5px" }}>Cancel</button>
          </div>
        </form>
      )}

      {/* Kanban lanes column grid */}
      <div className="kanban-board">
        
        {/* TO DO LANE */}
        <div className="kanban-column">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border-muted)", paddingBottom: "8px", marginBottom: "4px" }}>
            <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--accent-secondary)" }}></span>
              <span>BACKLOG / TO DO</span>
            </span>
            <span className="kbd-badge">{todoTasks.length}</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px", minHeight: "360px" }}>
            {todoTasks.map(task => (
              <div key={task.id} className="kanban-card">
                <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
                  <span style={{ fontSize: "13px", color: "#ffffff", fontWeight: "500", lineHeight: "1.4" }}>{task.title}</span>
                  <button onClick={() => handleDeleteTask(task.id)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", transition: "var(--transition-smooth)" }}>
                    <Trash2 size={12} className="trash-hover" />
                  </button>
                </div>
                
                {/* Footer metrics and shift handlers */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "4px" }}>
                  <button 
                    onClick={() => handleCyclePriority(task.id)}
                    className={`priority-pill ${task.priority}`}
                    style={{ border: "none", cursor: "pointer" }}
                    title="Click to cycle priority"
                  >
                    {task.priority}
                  </button>

                  <div style={{ display: "flex", gap: "4px" }}>
                    <button disabled style={{ opacity: 0.2, background: "transparent", border: "none", color: "var(--text-muted)" }}>
                      <ChevronLeft size={14} />
                    </button>
                    <button onClick={() => handleShiftStatus(task.id, "right")} className="btn-secondary" style={{ padding: "3px 6px", borderRadius: "4px" }}>
                      <ChevronRight size={14} style={{ color: "var(--accent-primary)" }} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            
            {todoTasks.length === 0 && (
              <div style={{ display: "flex", flex: 1, border: "1.5px dashed var(--border-muted)", borderRadius: "var(--radius-sm)", alignItems: "center", justifyContent: "center", minHeight: "100px", color: "var(--text-muted)" }}>
                <span style={{ fontSize: "11.5px" }}>No tasks in backlog</span>
              </div>
            )}
          </div>
        </div>

        {/* IN PROGRESS LANE */}
        <div className="kanban-column">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border-muted)", paddingBottom: "8px", marginBottom: "4px" }}>
            <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--accent-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="pulse-dot" style={{ backgroundColor: "var(--accent-primary)", boxShadow: "0 0 8px var(--accent-primary)" }}></span>
              <span>IN PROGRESS</span>
            </span>
            <span className="kbd-badge">{progressTasks.length}</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px", minHeight: "360px" }}>
            {progressTasks.map(task => (
              <div key={task.id} className="kanban-card" style={{ borderColor: "rgba(99,102,241,0.15)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
                  <span style={{ fontSize: "13px", color: "#ffffff", fontWeight: "500", lineHeight: "1.4" }}>{task.title}</span>
                  <button onClick={() => handleDeleteTask(task.id)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                    <Trash2 size={12} className="trash-hover" />
                  </button>
                </div>
                
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "4px" }}>
                  <button 
                    onClick={() => handleCyclePriority(task.id)}
                    className={`priority-pill ${task.priority}`}
                    style={{ border: "none", cursor: "pointer" }}
                    title="Click to cycle priority"
                  >
                    {task.priority}
                  </button>

                  <div style={{ display: "flex", gap: "4px" }}>
                    <button onClick={() => handleShiftStatus(task.id, "left")} className="btn-secondary" style={{ padding: "3px 6px", borderRadius: "4px" }}>
                      <ChevronLeft size={14} style={{ color: "var(--accent-primary)" }} />
                    </button>
                    <button onClick={() => handleShiftStatus(task.id, "right")} className="btn-secondary" style={{ padding: "3px 6px", borderRadius: "4px" }}>
                      <ChevronRight size={14} style={{ color: "var(--accent-primary)" }} />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {progressTasks.length === 0 && (
              <div style={{ display: "flex", flex: 1, border: "1.5px dashed var(--border-muted)", borderRadius: "var(--radius-sm)", alignItems: "center", justifyContent: "center", minHeight: "100px", color: "var(--text-muted)" }}>
                <span style={{ fontSize: "11.5px" }}>No tasks in progress</span>
              </div>
            )}
          </div>
        </div>

        {/* DONE LANE */}
        <div className="kanban-column">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border-muted)", paddingBottom: "8px", marginBottom: "4px" }}>
            <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--accent-success)", display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--accent-success)" }}></span>
              <span>COMPLETED</span>
            </span>
            <span className="kbd-badge">{doneTasks.length}</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px", minHeight: "360px" }}>
            {doneTasks.map(task => (
              <div key={task.id} className="kanban-card" style={{ borderColor: "rgba(16,185,129,0.15)", background: "rgba(16,185,129,0.01)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
                  <span style={{ fontSize: "13px", color: "var(--text-secondary)", textDecoration: "line-through", lineHeight: "1.4" }}>{task.title}</span>
                  <button onClick={() => handleDeleteTask(task.id)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                    <Trash2 size={12} className="trash-hover" />
                  </button>
                </div>
                
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "4px" }}>
                  <button 
                    onClick={() => handleCyclePriority(task.id)}
                    className={`priority-pill ${task.priority}`}
                    style={{ border: "none", cursor: "pointer" }}
                    title="Click to cycle priority"
                  >
                    {task.priority}
                  </button>

                  <div style={{ display: "flex", gap: "4px" }}>
                    <button onClick={() => handleShiftStatus(task.id, "left")} className="btn-secondary" style={{ padding: "3px 6px", borderRadius: "4px" }}>
                      <ChevronLeft size={14} style={{ color: "var(--accent-primary)" }} />
                    </button>
                    <button disabled style={{ opacity: 0.2, background: "transparent", border: "none", color: "var(--text-muted)" }}>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {doneTasks.length === 0 && (
              <div style={{ display: "flex", flex: 1, border: "1.5px dashed var(--border-muted)", borderRadius: "var(--radius-sm)", alignItems: "center", justifyContent: "center", minHeight: "100px", color: "var(--text-muted)" }}>
                <span style={{ fontSize: "11.5px" }}>No completed tasks</span>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Info card help */}
      <div className="glass-card" style={{ padding: "18px 24px", display: "flex", alignItems: "center", gap: "10px", background: "rgba(0,0,0,0.15)" }}>
        <AlertCircle size={15} style={{ color: "var(--accent-info)" }} />
        <span style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.5" }}>
          <strong>Micro-Interactions</strong>: Click directly on the priority badge of any task card to cyclically switch its priority scale (Low → Medium → High). Click status lane shift buttons to instantly advance tasks!
        </span>
      </div>

    </div>
  )
}
