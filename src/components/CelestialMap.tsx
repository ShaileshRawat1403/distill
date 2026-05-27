import { useState, useEffect, useRef } from "react"
import Graph from "graphology"
import Sigma from "sigma"
import forceAtlas2 from "graphology-layout-forceatlas2"
import { Orbit, Search, ArrowRight, Maximize2, Loader2 } from "lucide-react"
import { Page } from "../App"
import { loadEmbeddings } from "../db"
import { buildEdges, type EdgeKind } from "../utils/knowledgeGraph"

interface CelestialMapProps {
  pages: Page[]
  workspace: string
  onNavigate: (id: string) => void
}

// Document-type → colour (kept from the original celestial palette).
function getTypeColor(type: string): string {
  switch (type) {
    case "document": return "#6366f1"
    case "note": return "#3b82f6"
    case "planner": return "#10b981"
    case "table": return "#ec4899"
    case "journal": return "#a855f7"
    case "moodboard": return "#f59e0b"
    default: return "#94a3b8"
  }
}

// Edge styling per relationship kind (Sigma has no dashes, so colour+weight encode kind).
const EDGE_STYLE: Record<EdgeKind, { color: string; size: number }> = {
  link: { color: "rgba(168, 85, 247, 0.85)", size: 2.4 },
  semantic: { color: "rgba(99, 102, 241, 0.45)", size: 1.4 },
  tag: { color: "rgba(255, 255, 255, 0.12)", size: 0.9 },
}

export default function CelestialMap({ pages, workspace, onNavigate }: CelestialMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sigmaRef = useRef<Sigma | null>(null)
  const graphRef = useRef<Graph | null>(null)
  const searchRef = useRef<string>("")
  const selectedRef = useRef<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selected, setSelected] = useState<Page | null>(null)
  const [stats, setStats] = useState({ nodes: 0, edges: 0 })

  // Build the graph (load embeddings → typed edges → ForceAtlas2 → Sigma).
  useEffect(() => {
    if (!containerRef.current || pages.length === 0) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)

    ;(async () => {
      let vectors: Map<string, number[]> | undefined
      try {
        const rows = await loadEmbeddings(workspace)
        vectors = new Map(rows.map((r) => [r.pageId, r.vector]))
      } catch {
        /* embeddings optional */
      }
      if (cancelled || !containerRef.current) return

      const edges = buildEdges(pages, { vectors, includeTagEdges: true })

      const g = new Graph({ multi: false })
      pages.forEach((p, i) => {
        const angle = (i / pages.length) * Math.PI * 2
        const len = (p.content || "").length
        g.addNode(p.id, {
          label: p.title || "Untitled",
          x: Math.cos(angle) * 10 + Math.random(),
          y: Math.sin(angle) * 10 + Math.random(),
          size: Math.max(4, Math.min(16, 4 + Math.log2(len + 1) * 1.3)),
          color: getTypeColor(p.type),
          pageType: p.type,
        })
      })
      for (const e of edges) {
        if (g.hasNode(e.source) && g.hasNode(e.target) && !g.hasEdge(e.source, e.target)) {
          const st = EDGE_STYLE[e.kind]
          g.addEdge(e.source, e.target, { color: st.color, size: st.size, kind: e.kind })
        }
      }

      forceAtlas2.assign(g, { iterations: 220, settings: { gravity: 1, scalingRatio: 14, slowDown: 5, barnesHutOptimize: true } })

      sigmaRef.current?.kill()
      const renderer = new Sigma(g, containerRef.current, {
        labelColor: { color: "#cbd5e1" },
        labelFont: "Inter, sans-serif",
        labelSize: 12,
        labelDensity: 0.6,
        labelRenderedSizeThreshold: 6,
      })

      // Highlight selected node + neighbours and dim on search miss.
      renderer.setSetting("nodeReducer", (node, data) => {
        const res = { ...data }
        const q = searchRef.current.trim().toLowerCase()
        const sel = selectedRef.current
        if (q && !String(data.label).toLowerCase().includes(q)) {
          res.color = "rgba(120,120,140,0.25)"
          res.label = ""
        }
        if (sel) {
          const isFocus = node === sel || g.areNeighbors(sel, node)
          if (!isFocus) { res.color = "rgba(120,120,140,0.2)"; res.label = "" }
        }
        return res
      })
      renderer.setSetting("edgeReducer", (edge, data) => {
        const res = { ...data }
        const sel = selectedRef.current
        if (sel && !g.extremities(edge).includes(sel)) res.hidden = true
        return res
      })

      renderer.on("clickNode", ({ node }) => {
        selectedRef.current = node
        setSelected(pages.find((p) => p.id === node) ?? null)
        renderer.refresh()
      })
      renderer.on("clickStage", () => {
        selectedRef.current = null
        setSelected(null)
        renderer.refresh()
      })

      sigmaRef.current = renderer
      graphRef.current = g
      setStats({ nodes: g.order, edges: g.size })
      setLoading(false)
    })()

    return () => {
      cancelled = true
      sigmaRef.current?.kill()
      sigmaRef.current = null
    }
  }, [pages, workspace])

  // Re-apply reducers when the search query changes.
  useEffect(() => {
    searchRef.current = searchQuery
    sigmaRef.current?.refresh()
  }, [searchQuery])

  const resetView = () => sigmaRef.current?.getCamera().animatedReset()

  return (
    <div className="glass-card" style={{ position: "relative", display: "flex", flexDirection: "column", height: "100%", minHeight: "560px", padding: 0, overflow: "hidden" }}>
      {/* Cockpit header */}
      <div style={{ position: "absolute", top: "18px", left: "20px", zIndex: 10, display: "flex", alignItems: "center", gap: "10px" }}>
        <Orbit size={18} style={{ color: "var(--accent-secondary)" }} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <h2 style={{ fontSize: "15px", fontWeight: 700, fontFamily: "var(--font-display)", color: "#fff", margin: 0 }}>Celestial Thought-Graph</h2>
          <span style={{ fontSize: "10px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            {stats.nodes} NODES · {stats.edges} LINKS · {workspace.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Search + reset */}
      <div style={{ position: "absolute", top: "18px", right: "20px", zIndex: 10, display: "flex", gap: "8px" }}>
        <div style={{ position: "relative" }}>
          <Search size={13} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input
            type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search star field…" className="input-premium"
            style={{ padding: "8px 12px 8px 32px", width: "180px", fontSize: "12px" }}
          />
        </div>
        <button onClick={resetView} title="Reset view" className="btn-secondary" style={{ padding: "6px 10px" }}>
          <Maximize2 size={13} />
        </button>
      </div>

      {/* Sigma canvas */}
      <div ref={containerRef} style={{ flex: 1, background: "radial-gradient(circle at center, rgba(14,10,32,0.5) 0%, var(--bg-primary) 100%)" }} />

      {loading && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", color: "var(--text-muted)" }}>
          <Loader2 size={16} className="spin-icon" /><span style={{ fontSize: "13px" }}>Mapping constellations…</span>
        </div>
      )}
      {!loading && pages.length === 0 && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "13px" }}>
          No notes yet — create some to see the graph.
        </div>
      )}

      {/* Legend */}
      <div style={{ position: "absolute", bottom: "14px", left: "20px", zIndex: 10, display: "flex", gap: "14px", fontSize: "10px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
        <span><span style={{ color: "#a855f7" }}>━</span> link</span>
        <span><span style={{ color: "#6366f1" }}>┄</span> semantic</span>
        <span><span style={{ opacity: 0.5 }}>┈</span> tag</span>
      </div>

      {/* Selected node panel */}
      {selected && (
        <div className="liquid-glass" style={{ position: "absolute", bottom: "14px", right: "20px", zIndex: 10, width: "260px", borderRadius: "var(--radius-md)", padding: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: getTypeColor(selected.type), flexShrink: 0 }} />
            <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected.title || "Untitled"}</span>
          </div>
          <span style={{ fontSize: "10px", fontFamily: "var(--font-mono)", color: "var(--text-muted)", textTransform: "uppercase" }}>{selected.type}</span>
          {selected.tags && selected.tags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "10px" }}>
              {selected.tags.slice(0, 6).map((t) => (
                <span key={t} style={{ fontSize: "10px", color: "var(--accent-secondary)", background: "var(--glow-color)", border: "1px solid var(--border-muted)", borderRadius: "999px", padding: "1px 7px" }}>#{t}</span>
              ))}
            </div>
          )}
          <button onClick={() => onNavigate(selected.id)} className="btn-premium" style={{ marginTop: "12px", width: "100%", padding: "8px", fontSize: "12px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
            Warp to editor <ArrowRight size={13} />
          </button>
        </div>
      )}
    </div>
  )
}
