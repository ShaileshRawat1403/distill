/**
 * SearchModal — global Cmd+K search overlay.
 *
 * Hybrid search: keyword filter runs instantly on every keystroke,
 * semantic search fires after a 300ms debounce (if embedding model is ready).
 * Results are merged and deduplicated, ranked by semantic score first,
 * then keyword match, then recency.
 */

import { useState, useEffect, useRef, useCallback } from "react"
import {
  Search, X, FileText, Brain, ListTodo, Database,
  Feather, BookOpen, Zap, Hash, ArrowRight, Image
} from "lucide-react"
import { Page } from "../App"
import { semanticSearch, type SemanticResult } from "../utils/semanticSearch"
import type { EmbedStatus } from "../utils/embeddings"

interface SearchModalProps {
  pages: Page[]
  workspace: string
  embedStatus: EmbedStatus
  onNavigate: (pageId: string) => void
  onClose: () => void
}

interface SearchResult {
  page: Page
  score: number          // 0–1, higher = more relevant
  matchType: "semantic" | "keyword" | "title" | "tag"
  snippet: string        // content preview around match
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  note:      <Feather size={13} />,
  document:  <BookOpen size={13} />,
  journal:   <Brain size={13} />,
  planner:   <ListTodo size={13} />,
  table:     <Database size={13} />,
  moodboard: <Image size={13} />,
}

const TYPE_COLOR: Record<string, string> = {
  note:      "var(--accent-secondary)",
  document:  "var(--accent-primary)",
  journal:   "#ec4899",
  planner:   "var(--accent-warning)",
  table:     "var(--accent-success)",
  moodboard: "#f97316",
}

function getSnippet(content: string, query: string, maxLen = 120): string {
  if (!query.trim()) return content.slice(0, maxLen) + (content.length > maxLen ? "…" : "")
  const idx = content.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return content.slice(0, maxLen) + (content.length > maxLen ? "…" : "")
  const start = Math.max(0, idx - 40)
  const end = Math.min(content.length, idx + 80)
  return (start > 0 ? "…" : "") + content.slice(start, end) + (end < content.length ? "…" : "")
}

function keywordScore(page: Page, query: string): number {
  if (!query.trim()) return 0
  const q = query.toLowerCase()
  let score = 0
  if (page.title.toLowerCase().includes(q)) score += 0.9
  if (page.tags?.some((t) => t.toLowerCase().includes(q))) score += 0.7
  if (page.content.toLowerCase().includes(q)) score += 0.4
  return Math.min(score, 1)
}

export default function SearchModal({ pages, workspace, embedStatus, onNavigate, onClose }: SearchModalProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowDown") setSelectedIdx((i) => Math.min(i + 1, results.length - 1))
      if (e.key === "ArrowUp") setSelectedIdx((i) => Math.max(i - 1, 0))
      if (e.key === "Enter" && results[selectedIdx]) {
        onNavigate(results[selectedIdx].page.id)
        onClose()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [results, selectedIdx, onClose, onNavigate])

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      // Show recent pages when query is empty
      const recent = [...pages]
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 8)
        .map((page) => ({
          page,
          score: 0,
          matchType: "keyword" as const,
          snippet: page.content.slice(0, 100) + (page.content.length > 100 ? "…" : ""),
        }))
      setResults(recent)
      setIsSearching(false)
      return
    }

    setIsSearching(true)

    // Step 1: instant keyword pass
    const keywordResults: SearchResult[] = pages
      .map((page) => {
        const score = keywordScore(page, q)
        let matchType: SearchResult["matchType"] = "keyword"
        if (page.title.toLowerCase().includes(q.toLowerCase())) matchType = "title"
        else if (page.tags?.some((t) => t.toLowerCase().includes(q.toLowerCase()))) matchType = "tag"
        return { page, score, matchType, snippet: getSnippet(page.content, q) }
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)

    setResults(keywordResults.slice(0, 10))
    setSelectedIdx(0)

    // Step 2: semantic pass (if model ready)
    if (embedStatus === "ready") {
      try {
        const semanticResults: SemanticResult[] = await semanticSearch(q, workspace, pages, 6, 0.2)

        // Merge: build a map keyed by page id, prefer higher score
        const merged = new Map<string, SearchResult>()

        for (const r of keywordResults) {
          merged.set(r.page.id, r)
        }
        for (const sr of semanticResults) {
          const existing = merged.get(sr.page.id)
          const combinedScore = existing
            ? Math.max(existing.score, sr.score * 0.9) + 0.1
            : sr.score
          merged.set(sr.page.id, {
            page: sr.page,
            score: Math.min(combinedScore, 1),
            matchType: "semantic",
            snippet: getSnippet(sr.page.content, q),
          })
        }

        const sorted = Array.from(merged.values())
          .sort((a, b) => b.score - a.score)
          .slice(0, 10)

        setResults(sorted)
        setSelectedIdx(0)
      } catch {
        // semantic failed — keyword results still shown
      }
    }

    setIsSearching(false)
  }, [pages, workspace, embedStatus])

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runSearch(query), query ? 280 : 0)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, runSearch])

  // Initial load — show recents
  useEffect(() => { runSearch("") }, [runSearch])

  const MATCH_TYPE_LABEL: Record<SearchResult["matchType"], string> = {
    semantic: "SEMANTIC",
    keyword:  "KEYWORD",
    title:    "TITLE",
    tag:      "TAG",
  }

  const MATCH_TYPE_COLOR: Record<SearchResult["matchType"], string> = {
    semantic: "var(--accent-secondary)",
    keyword:  "var(--text-muted)",
    title:    "var(--accent-primary)",
    tag:      "var(--accent-success)",
  }

  return (
    /* Backdrop */
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(8px)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        paddingTop: "10vh",
      }}
    >
      {/* Modal */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(680px, 92vw)",
          background: "rgba(10,10,14,0.97)",
          border: "1px solid var(--border-active)",
          borderRadius: "14px",
          boxShadow: "0 32px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04)",
          overflow: "hidden",
          display: "flex", flexDirection: "column",
          maxHeight: "70vh",
        }}
      >
        {/* Search input row */}
        <div style={{
          display: "flex", alignItems: "center", gap: "12px",
          padding: "16px 20px",
          borderBottom: "1px solid var(--border-muted)",
        }}>
          {isSearching
            ? <Zap size={17} style={{ color: "var(--accent-secondary)", flexShrink: 0, animation: "pulse 1s infinite" }} />
            : <Search size={17} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          }
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages, notes, tasks… or ask a question"
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              fontSize: "16px", color: "var(--text-primary)", fontFamily: "var(--font-body)",
            }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
            {embedStatus === "ready" && (
              <span style={{
                fontSize: "9.5px", fontFamily: "var(--font-mono)", fontWeight: "700",
                color: "var(--accent-success)", background: "rgba(16,185,129,0.08)",
                border: "1px solid rgba(16,185,129,0.2)", padding: "2px 7px", borderRadius: "8px"
              }}>
                SEMANTIC
              </span>
            )}
            <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Results */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          {results.length === 0 && query && !isSearching && (
            <div style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
              No pages match "{query}"
            </div>
          )}

          {!query && (
            <div style={{ padding: "8px 20px 4px", fontSize: "10px", fontFamily: "var(--font-mono)", fontWeight: "700", color: "var(--text-muted)", letterSpacing: "0.08em" }}>
              RECENT PAGES
            </div>
          )}

          {query && results.length > 0 && (
            <div style={{ padding: "8px 20px 4px", fontSize: "10px", fontFamily: "var(--font-mono)", fontWeight: "700", color: "var(--text-muted)", letterSpacing: "0.08em" }}>
              {results.length} RESULT{results.length !== 1 ? "S" : ""}
            </div>
          )}

          {results.map((r, idx) => {
            const isSelected = idx === selectedIdx
            return (
              <button
                key={r.page.id}
                onClick={() => { onNavigate(r.page.id); onClose() }}
                onMouseEnter={() => setSelectedIdx(idx)}
                style={{
                  width: "100%", padding: "12px 20px",
                  display: "flex", alignItems: "flex-start", gap: "12px",
                  background: isSelected ? "rgba(99,102,241,0.08)" : "transparent",
                  border: "none", cursor: "pointer", textAlign: "left",
                  borderLeft: isSelected ? "2px solid var(--accent-secondary)" : "2px solid transparent",
                  transition: "background 0.1s",
                }}
              >
                {/* Type icon */}
                <div style={{
                  width: "30px", height: "30px", flexShrink: 0,
                  borderRadius: "7px", display: "flex", alignItems: "center", justifyContent: "center",
                  background: `${TYPE_COLOR[r.page.type] ?? "var(--accent-primary)"}18`,
                  color: TYPE_COLOR[r.page.type] ?? "var(--accent-primary)",
                  marginTop: "1px",
                }}>
                  {TYPE_ICON[r.page.type] ?? <FileText size={13} />}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
                    <span style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.page.title}
                    </span>
                    {r.score > 0 && (
                      <span style={{
                        fontSize: "9px", fontFamily: "var(--font-mono)", fontWeight: "700",
                        color: MATCH_TYPE_COLOR[r.matchType],
                        background: `${MATCH_TYPE_COLOR[r.matchType]}18`,
                        padding: "1px 6px", borderRadius: "6px", flexShrink: 0
                      }}>
                        {MATCH_TYPE_LABEL[r.matchType]}
                        {r.matchType === "semantic" ? ` ${Math.round(r.score * 100)}%` : ""}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.5", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                    {r.snippet}
                  </div>
                  {r.page.tags && r.page.tags.length > 0 && (
                    <div style={{ display: "flex", gap: "4px", marginTop: "5px", flexWrap: "wrap" }}>
                      {r.page.tags.slice(0, 4).map((tag) => (
                        <span key={tag} style={{
                          display: "flex", alignItems: "center", gap: "3px",
                          fontSize: "9.5px", color: "var(--text-muted)",
                          background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-muted)",
                          padding: "1px 7px", borderRadius: "8px", fontFamily: "var(--font-mono)"
                        }}>
                          <Hash size={8} />{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Navigate hint */}
                {isSelected && (
                  <ArrowRight size={14} style={{ color: "var(--accent-secondary)", flexShrink: 0, marginTop: "6px" }} />
                )}
              </button>
            )
          })}
        </div>

        {/* Footer */}
        <div style={{
          padding: "10px 20px",
          borderTop: "1px solid var(--border-muted)",
          display: "flex", alignItems: "center", gap: "16px",
          fontSize: "10.5px", color: "var(--text-muted)", fontFamily: "var(--font-mono)"
        }}>
          <span><kbd style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--border-muted)", borderRadius: "4px", padding: "1px 5px" }}>↑↓</kbd> navigate</span>
          <span><kbd style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--border-muted)", borderRadius: "4px", padding: "1px 5px" }}>↵</kbd> open</span>
          <span><kbd style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--border-muted)", borderRadius: "4px", padding: "1px 5px" }}>esc</kbd> close</span>
          <span style={{ marginLeft: "auto" }}>{pages.length} pages in workspace</span>
        </div>
      </div>
    </div>
  )
}
