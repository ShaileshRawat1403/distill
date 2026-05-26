import { useEffect, useRef, useState } from "react"
import Graph from "graphology"
import Sigma from "sigma"
import forceAtlas2 from "graphology-layout-forceatlas2"
import { Sparkles, Loader2, Network, ArrowUpRight, RefreshCw } from "lucide-react"
import type { Page } from "../App"
import type { APIKeys } from "../utils/ai"
import {
  buildConceptGraph, saveConceptGraph, loadConceptGraph, type ConceptGraph as ConceptGraphData, type ConceptNode,
} from "../utils/graphRag"

interface ConceptGraphProps {
  pages: Page[]
  workspace: string
  provider: string
  model: string
  apiKeys: APIKeys
  isOllamaOnline: boolean
  onNavigate: (id: string) => void
  logSystemMessage?: (tag: "SYSTEM" | "DATABASE" | "OLLAMA" | "ERROR", message: string) => void
}

const TYPE_COLOR: Record<string, string> = {
  concept: "#6366f1",
  technology: "#3b82f6",
  person: "#ec4899",
  project: "#10b981",
  method: "#f59e0b",
  org: "#a855f7",
}
const colorFor = (type: string) => TYPE_COLOR[type] ?? "#94a3b8"

export default function ConceptGraph({ pages, workspace, provider, model, apiKeys, isOllamaOnline, onNavigate, logSystemMessage }: ConceptGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sigmaRef = useRef<Sigma | null>(null)
  const [graph, setGraph] = useState<ConceptGraphData | null>(null)
  const [building, setBuilding] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState("")
  const [selected, setSelected] = useState<ConceptNode | null>(null)

  const aiReady = !!(provider && apiKeys && (provider !== "ollama" || isOllamaOnline) && (provider !== "dax" || (apiKeys.daxUrl && model)))

  // Load any previously-built concept graph for this workspace.
  useEffect(() => {
    let cancelled = false
    loadConceptGraph(workspace).then((g) => { if (!cancelled) setGraph(g) })
    return () => { cancelled = true }
  }, [workspace])

  // (Re)render the Sigma graph whenever the concept data changes.
  useEffect(() => {
    if (!containerRef.current || !graph || graph.concepts.length === 0) return

    const g = new Graph()
    const maxMentions = Math.max(1, ...graph.concepts.map((c) => c.mentions.length))
    graph.concepts.forEach((c, i) => {
      const angle = (i / graph.concepts.length) * Math.PI * 2
      g.addNode(c.id, {
        label: c.name,
        x: Math.cos(angle) * 10 + Math.random(),
        y: Math.sin(angle) * 10 + Math.random(),
        size: 5 + (c.mentions.length / maxMentions) * 14,
        color: colorFor(c.type),
      })
    })
    graph.relations.forEach((r) => {
      if (g.hasNode(r.source) && g.hasNode(r.target) && !g.hasEdge(r.source, r.target)) {
        g.addEdge(r.source, r.target, { label: r.label, size: 1.5, type: "arrow", color: "rgba(255,255,255,0.18)" })
      }
    })

    forceAtlas2.assign(g, { iterations: 200, settings: { gravity: 1.2, scalingRatio: 12, slowDown: 4, barnesHutOptimize: true } })

    sigmaRef.current?.kill()
    const renderer = new Sigma(g, containerRef.current, {
      renderEdgeLabels: true,
      labelColor: { color: "#cbd5e1" },
      edgeLabelColor: { color: "#64748b" },
      labelFont: "Inter, sans-serif",
      labelSize: 12,
      defaultEdgeType: "arrow",
    })
    renderer.on("clickNode", ({ node }) => {
      setSelected(graph.concepts.find((c) => c.id === node) ?? null)
    })
    renderer.on("clickStage", () => setSelected(null))
    sigmaRef.current = renderer

    return () => { renderer.kill(); sigmaRef.current = null }
  }, [graph])

  const handleBuild = async () => {
    if (!aiReady) return
    setBuilding(true); setError(""); setProgress({ done: 0, total: 0 })
    try {
      const built = await buildConceptGraph(pages, {
        provider, model, apiKeys, limit: 30,
        onProgress: (done, total) => setProgress({ done, total }),
      })
      if (built.concepts.length === 0) throw new Error("No concepts extracted — try notes with more content.")
      await saveConceptGraph(workspace, built)
      setGraph(built)
      logSystemMessage?.("SYSTEM", `Concept graph built: ${built.concepts.length} concepts, ${built.relations.length} relations from ${built.noteCount} notes`)
    } catch (e) {
      setError((e as Error).message || "Build failed")
    } finally {
      setBuilding(false); setProgress(null)
    }
  }

  const mentioningPages = selected
    ? selected.mentions.map((id) => pages.find((p) => p.id === id)).filter((p): p is Page => !!p)
    : []

  return (
    <div className="glass-card" style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: "560px", padding: 0, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: "1px solid var(--border-muted)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Network size={18} style={{ color: "var(--accent-secondary)" }} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <h2 style={{ fontSize: "16px", fontWeight: 700, fontFamily: "var(--font-display)", margin: 0 }}>Concept Map</h2>
            <span style={{ fontSize: "10.5px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
              {graph ? `${graph.concepts.length} CONCEPTS · ${graph.relations.length} RELATIONS · GraphRAG` : "AI-EXTRACTED KNOWLEDGE GRAPH"}
            </span>
          </div>
        </div>
        <button onClick={handleBuild} disabled={building || !aiReady} className="btn-premium" style={{ padding: "8px 16px", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "6px" }}>
          {building ? <><Loader2 size={13} className="spin-icon" /> {progress ? `Extracting ${progress.done}/${progress.total}` : "Building…"}</>
            : graph ? <><RefreshCw size={13} /> Rebuild</> : <><Sparkles size={13} /> Build with AI</>}
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, position: "relative", display: "flex" }}>
        <div ref={containerRef} style={{ flex: 1, background: "radial-gradient(circle at center, rgba(14,10,32,0.5) 0%, var(--bg-primary) 100%)" }} />

        {/* Empty / error state */}
        {(!graph || graph.concepts.length === 0) && !building && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", color: "var(--text-muted)", textAlign: "center", padding: "20px" }}>
            <Network size={30} style={{ opacity: 0.4 }} />
            <span style={{ fontSize: "13px", maxWidth: "360px" }}>
              No concept graph yet. <strong>Build with AI</strong> extracts the ideas and how they relate across your notes — powered by the active model{provider === "dax" ? " (DAX subscription bridge)" : ""}.
            </span>
            {!aiReady && <span style={{ fontSize: "11.5px", color: "var(--accent-warning)" }}>Connect a provider first (Workspace Sync).</span>}
            {error && <span style={{ fontSize: "11.5px", color: "var(--accent-danger)" }}>{error}</span>}
          </div>
        )}
        {error && graph && graph.concepts.length > 0 && (
          <div style={{ position: "absolute", top: 12, left: 12, fontSize: "11.5px", color: "var(--accent-danger)" }}>{error}</div>
        )}

        {/* Selected concept panel */}
        {selected && (
          <div className="liquid-glass" style={{ position: "absolute", top: 12, right: 12, width: "260px", borderRadius: "var(--radius-md)", padding: "16px", maxHeight: "calc(100% - 24px)", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
              <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: colorFor(selected.type), flexShrink: 0 }} />
              <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>{selected.name}</span>
            </div>
            <span style={{ fontSize: "10px", fontFamily: "var(--font-mono)", color: "var(--text-muted)", textTransform: "uppercase" }}>{selected.type} · {selected.mentions.length} mentions</span>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "12px" }}>
              {mentioningPages.map((p) => (
                <button key={p.id} onClick={() => onNavigate(p.id)} className="related-item" style={{ padding: "8px 10px" }}>
                  <span className="related-title" style={{ fontSize: "12.5px" }}>{p.title || "Untitled"}</span>
                  <ArrowUpRight size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
