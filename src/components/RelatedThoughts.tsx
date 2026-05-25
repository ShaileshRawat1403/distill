import { useState, useEffect } from "react"
import { Sparkles, ArrowUpRight } from "lucide-react"
import type { Page } from "../App"
import { semanticSearch, type SemanticResult } from "../utils/semanticSearch"

/**
 * Resurfacing — closes the "no thought wasted" loop. As you work on a page, this
 * rail surfaces past thoughts that are semantically nearest to it, so related
 * ideas resurface on their own instead of being lost.
 *
 * Runs entirely on the in-browser embeddings; debounced so it doesn't fire on
 * every keystroke. The current page is excluded from its own results.
 */
interface RelatedThoughtsProps {
  page: Page
  pages: Page[]
  workspace: string
  onNavigate?: (id: string) => void
}

export default function RelatedThoughts({ page, pages, workspace, onNavigate }: RelatedThoughtsProps) {
  const [results, setResults] = useState<SemanticResult[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    const query = `${page.title}\n${page.content}`.trim()
    if (query.length < 20 || pages.length < 2) {
      setResults([])
      return
    }

    setLoading(true)
    const handle = setTimeout(async () => {
      try {
        const others = pages.filter((p) => p.id !== page.id)
        const found = await semanticSearch(query, workspace, others, 5, 0.3)
        if (!cancelled) setResults(found)
      } catch {
        if (!cancelled) setResults([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 600)

    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [page.id, page.title, page.content, pages, workspace])

  if (!loading && results.length === 0) return null

  return (
    <div className="glass-card related-rail">
      <div className="related-header">
        <Sparkles size={13} style={{ color: "var(--accent-secondary)" }} />
        <span>RELATED THOUGHTS</span>
        {loading && <span className="related-pulse" />}
      </div>

      <div className="related-list">
        {results.map(({ page: p, score }) => (
          <button key={p.id} className="related-item" onClick={() => onNavigate?.(p.id)}>
            <div className="related-item-main">
              <span className="related-title">{p.title || "Untitled"}</span>
              <span className="related-preview">
                {p.content.replace(/\s+/g, " ").slice(0, 90) || "—"}
              </span>
            </div>
            <div className="related-meta">
              <span className="related-score">{Math.round(score * 100)}%</span>
              <ArrowUpRight size={13} style={{ color: "var(--text-muted)" }} />
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
