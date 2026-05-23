import { useState } from "react"
import { Plus, Trash2, Calendar, HelpCircle, Activity } from "lucide-react"
import { Page, SpreadsheetRow } from "../App"

interface DatabaseTableProps {
  page: Page
  onUpdatePage: (updatedPage: Page) => void
}

export default function DatabaseTable({ page, onUpdatePage }: DatabaseTableProps) {
  const [newRowTitle, setNewRowTitle] = useState("")

  const rows = page.rows || []

  // Add a new row to the table spreadsheet
  const handleAddRow = (e: React.FormEvent) => {
    e.preventDefault()
    
    const newRow: SpreadsheetRow = {
      id: Math.random().toString(36).substring(2, 9),
      title: newRowTitle.trim() || "New Database Item",
      status: "To-Do",
      assignee: "Me",
      priority: "Medium",
      date: new Date().toISOString().substring(0, 10)
    }

    const updatedRows = [...rows, newRow]
    onUpdatePage({ ...page, rows: updatedRows })
    setNewRowTitle("")
  }

  // Update cell field in a row
  const handleUpdateCell = (rowId: string, field: keyof SpreadsheetRow, value: string) => {
    const updatedRows = rows.map(r => {
      if (r.id === rowId) {
        return { ...r, [field]: value }
      }
      return r
    })
    onUpdatePage({ ...page, rows: updatedRows })
  }

  // Delete row
  const handleDeleteRow = (rowId: string) => {
    const updatedRows = rows.filter(r => r.id !== rowId)
    onUpdatePage({ ...page, rows: updatedRows })
  }

  // Database progress calculation
  const completedRows = rows.filter(r => r.status === "Done").length
  const completionRate = rows.length > 0 ? Math.round((completedRows / rows.length) * 100) : 0

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
            placeholder="Untitled Spreadsheet Database"
          />
          <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontWeight: "600" }}>
            NOTION-STYLE SPREADSHEET DATABASE TABLE
          </span>
        </div>

        {/* Dynamic Database Statistics */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", background: "rgba(0,0,0,0.25)", border: "1px solid var(--border-muted)", padding: "8px 14px", borderRadius: "var(--radius-sm)" }}>
          <Activity size={14} style={{ color: "var(--accent-success)" }} />
          <span style={{ fontSize: "12px", color: "var(--text-secondary)", fontFamily: "var(--font-mono)", fontWeight: "700" }}>
            DATABASE PROGRESS: {completionRate}% DONE ({completedRows}/{rows.length})
          </span>
        </div>
      </div>

      {/* Spreadsheet database table container */}
      <div className="db-table-container">
        <table className="db-table">
          <thead>
            <tr>
              <th className="db-header-cell" style={{ width: "35%" }}>DATABASE ITEM TITLE</th>
              <th className="db-header-cell" style={{ width: "15%" }}>STATUS</th>
              <th className="db-header-cell" style={{ width: "15%" }}>ASSIGNEE</th>
              <th className="db-header-cell" style={{ width: "15%" }}>PRIORITY</th>
              <th className="db-header-cell" style={{ width: "15%" }}>TARGET DATE</th>
              <th className="db-header-cell" style={{ width: "5%", textAlign: "center" }}>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id} className="db-row">
                
                {/* Title cell */}
                <td className="db-cell">
                  <input
                    type="text"
                    value={row.title}
                    onChange={(e) => handleUpdateCell(row.id, "title", e.target.value)}
                    className="db-cell-input"
                  />
                </td>

                {/* Status select cell */}
                <td className="db-cell">
                  <select
                    value={row.status}
                    onChange={(e) => handleUpdateCell(row.id, "status", e.target.value)}
                    className="db-cell-input"
                    style={{ background: "rgba(0,0,0,0.3)" }}
                  >
                    <option value="To-Do">To-Do</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Done">Done</option>
                  </select>
                </td>

                {/* Assignee select cell */}
                <td className="db-cell">
                  <select
                    value={row.assignee}
                    onChange={(e) => handleUpdateCell(row.id, "assignee", e.target.value)}
                    className="db-cell-input"
                    style={{ background: "rgba(0,0,0,0.3)" }}
                  >
                    <option value="Me">Me (Owner)</option>
                    <option value="AI Agent">AI Agent</option>
                    <option value="Team Partner">Team Partner</option>
                  </select>
                </td>

                {/* Priority select cell */}
                <td className="db-cell">
                  <select
                    value={row.priority}
                    onChange={(e) => handleUpdateCell(row.id, "priority", e.target.value)}
                    className="db-cell-input"
                    style={{ background: "rgba(0,0,0,0.3)" }}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </td>

                {/* Target Date cell */}
                <td className="db-cell">
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Calendar size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                    <input
                      type="date"
                      value={row.date}
                      onChange={(e) => handleUpdateCell(row.id, "date", e.target.value)}
                      className="db-cell-input"
                      style={{ fontSize: "12px" }}
                    />
                  </div>
                </td>

                {/* Delete row action */}
                <td className="db-cell" style={{ textAlign: "center" }}>
                  <button
                    onClick={() => handleDeleteRow(row.id)}
                    style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", transition: "var(--transition-smooth)" }}
                    title="Delete row item"
                  >
                    <Trash2 size={13} className="trash-hover" />
                  </button>
                </td>

              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)", fontSize: "13px" }}>
                  Spreadsheet database is empty. Type a name below to add rows!
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Append Row form bar */}
        <form onSubmit={handleAddRow} style={{ display: "flex", gap: "10px", padding: "12px 16px", background: "rgba(255,255,255,0.01)", borderTop: "1px solid var(--border-muted)" }}>
          <input
            type="text"
            value={newRowTitle}
            onChange={(e) => setNewRowTitle(e.target.value)}
            placeholder="Type a new item name and hit Enter to append row..."
            className="input-premium"
            style={{ flex: 1, fontSize: "12.5px" }}
          />
          <button type="submit" className="btn-premium" style={{ padding: "8px 14px", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
            <Plus size={14} />
            <span>Add Row</span>
          </button>
        </form>
      </div>

      {/* Info card help */}
      <div className="glass-card" style={{ padding: "18px 24px", display: "flex", alignItems: "center", gap: "10px", background: "rgba(0,0,0,0.15)" }}>
        <HelpCircle size={15} style={{ color: "var(--accent-info)" }} />
        <span style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.5" }}>
          <strong>Spreadsheet Features</strong>: All cell entries support **direct inline edits**. Updates immediately persist to local storage. Database metrics are computed live inside the status header.
        </span>
      </div>

    </div>
  )
}
