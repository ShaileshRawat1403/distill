import { Component, type ErrorInfo, type ReactNode } from "react"

/**
 * App-wide safety net. A render error in any component is caught here and shown
 * as a recoverable panel instead of white-screening the whole workspace. The
 * user's data is safe on disk (IndexedDB) — only the in-memory view crashed.
 */
interface Props {
  children: ReactNode
  /** Optional label so we can scope boundaries (e.g. "Concept Map"). */
  label?: string
}
interface State {
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface it for debugging; data persists in IndexedDB regardless.
    console.error(`[Distill] render error${this.props.label ? ` in ${this.props.label}` : ""}:`, error, info.componentStack)
  }

  handleReset = () => this.setState({ error: null })

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div
        role="alert"
        style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: "14px", padding: "48px 24px", minHeight: "320px", textAlign: "center",
          fontFamily: "var(--font-body, sans-serif)", color: "var(--text-secondary, #94a3b8)",
        }}
      >
        <div style={{ fontSize: "34px" }}>🛟</div>
        <h2 style={{ fontFamily: "var(--font-display, sans-serif)", fontSize: "18px", color: "var(--text-primary, #f8fafc)", margin: 0 }}>
          Something broke in {this.props.label ?? "this view"}
        </h2>
        <p style={{ fontSize: "13px", maxWidth: "440px", lineHeight: 1.6 }}>
          Your notes are safe — they live in local storage, not in this screen. Try again, or switch to another view.
        </p>
        <pre style={{
          fontSize: "11px", fontFamily: "var(--font-mono, monospace)", color: "var(--accent-danger, #ef4444)",
          background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.18)", borderRadius: "8px",
          padding: "10px 14px", maxWidth: "560px", overflow: "auto", whiteSpace: "pre-wrap", textAlign: "left",
        }}>
          {this.state.error.message}
        </pre>
        <button
          onClick={this.handleReset}
          className="btn-premium"
          style={{ padding: "8px 18px", fontSize: "13px" }}
        >
          Try again
        </button>
      </div>
    )
  }
}
