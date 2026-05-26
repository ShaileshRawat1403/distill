import { useState, useRef, useEffect } from "react"
import { Zap, X, CornerDownLeft } from "lucide-react"

/**
 * Frictionless capture — the front of the "no thought wasted" funnel.
 *
 * Opens from anywhere (Cmd/Ctrl+Shift+K or the floating button), takes a raw
 * thought, and hands it to the parent to persist as an inbox note. Auto-tagging
 * and embedding sync happen downstream via the normal create path, so a fleeting
 * idea lands fully wired into the graph without any extra effort.
 */
interface QuickCaptureProps {
  open: boolean
  onClose: () => void
  onCapture: (text: string) => void
}

export default function QuickCapture({ open, onClose, onCapture }: QuickCaptureProps) {
  const [text, setText] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) {
      setText("")
      // Focus once the entrance transition has begun.
      setTimeout(() => textareaRef.current?.focus(), 60)
    }
  }, [open])

  const submit = () => {
    const trimmed = text.trim()
    if (!trimmed) return
    onCapture(trimmed)
    setText("")
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // ⌘/Ctrl+Enter or plain Enter (without Shift) commits the thought.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      submit()
    } else if (e.key === "Escape") {
      e.preventDefault()
      onClose()
    }
  }

  if (!open) return null

  return (
    <div className="qc-overlay" onMouseDown={onClose}>
      <div className="qc-panel liquid-glass" onMouseDown={(e) => e.stopPropagation()}>
        <div className="qc-header">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Zap size={16} style={{ color: "var(--accent-warning)" }} />
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "14px" }}>
              Quick Capture
            </span>
            <span className="qc-kbd">⌘⇧K</span>
          </div>
          <button onClick={onClose} className="qc-close" aria-label="Close">
            <X size={15} />
          </button>
        </div>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What's on your mind? Capture it before it's gone…"
          className="qc-textarea"
          rows={4}
        />

        <div className="qc-footer">
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            Lands in your Inbox · auto-tagged · added to the graph
          </span>
          <button onClick={submit} disabled={!text.trim()} className="btn-premium qc-submit">
            <CornerDownLeft size={13} /> Capture
          </button>
        </div>
      </div>
    </div>
  )
}
