import { useState, useEffect, useRef } from "react"
import { Orbit, Search, ArrowRight, Calendar, Compass, ZoomIn, ZoomOut, Maximize2, Sliders } from "lucide-react"
import { Page } from "../App"
import { loadEmbeddings } from "../db"
import { buildEdges, type EdgeKind } from "../utils/knowledgeGraph"

interface CelestialMapProps {
  pages: Page[]
  workspace: string
  onNavigate: (id: string) => void
}

interface Node {
  id: string
  title: string
  type: string
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  tags: string[]
  contentLength: number
}

interface Link {
  source: string
  target: string
  weight: number
  kind: EdgeKind
}

type GravityMode = "galaxy" | "orbit" | "constellation"

export default function CelestialMap({ pages, workspace, onNavigate }: CelestialMapProps) {
  const [nodes, setNodes] = useState<Node[]>([])
  const [links, setLinks] = useState<Link[]>([])
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  
  // Gravity physics mode: galaxy (pulls to center), orbit (circular orbits), constellation (spring linked clusters)
  const [gravityMode, setGravityMode] = useState<GravityMode>("constellation")

  // Dragging states
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null)
  const [isWarping, setIsWarping] = useState(false)
  const [warpTargetId, setWarpTargetId] = useState<string | null>(null)

  // Zoom & Pan states
  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const requestRef = useRef<number | null>(null)

  const [searchQuery, setSearchQuery] = useState("")

  // Color mappings for document categories
  const getTypeColor = (type: string) => {
    switch (type) {
      case "document": return "var(--accent-primary, #6366f1)" // Indigo
      case "note": return "#3b82f6" // Sapphire
      case "planner": return "var(--accent-success, #10b981)" // Emerald
      case "table": return "#ec4899" // Cyberpunk pink
      case "journal": return "#a855f7" // Purple Amethyst
      case "moodboard": return "#f59e0b" // Warm Amber
      default: return "#94a3b8"
    }
  }

  // Initialize nodes and compute relationships
  useEffect(() => {
    if (pages.length === 0) return

    const width = 800
    const height = 500

    // 1. Map pages to physics nodes
    const initialNodes: Node[] = pages.map((page, idx) => {
      // Position nodes in a spiral or orbit format
      const angle = (idx / pages.length) * Math.PI * 2
      const radius = 120 + Math.random() * 100
      const contentStr = page.content || ""
      return {
        id: page.id,
        title: page.title || "Untitled Note",
        type: page.type || "note",
        x: width / 2 + Math.cos(angle) * radius,
        y: height / 2 + Math.sin(angle) * radius,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: Math.max(12, Math.min(24, 11 + Math.log2(contentStr.length + 1) * 1.6)),
        tags: page.tags ?? [],
        contentLength: contentStr.length
      }
    })

    setNodes(initialNodes)

    // 2. Compute typed edges via the shared knowledge-graph layer.
    //    Explicit [[wikilinks]] + tag edges are synchronous; semantic edges
    //    need the stored embeddings, so we load those and rebuild once ready.
    let cancelled = false

    // First pass: links + tags only, so the graph is never empty while we wait.
    setLinks(buildEdges(pages, { includeTagEdges: true }))

    loadEmbeddings(workspace)
      .then((rows) => {
        if (cancelled) return
        const vectors = new Map<string, number[]>()
        for (const row of rows) vectors.set(row.pageId, row.vector)
        setLinks(buildEdges(pages, { vectors, includeTagEdges: true }))
      })
      .catch(() => {/* embeddings unavailable — keep link/tag edges */})

    return () => { cancelled = true }
  }, [pages, workspace])

  // Physics animation loop (Force-Directed simulation with rubbery spring parameters!)
  useEffect(() => {
    if (nodes.length === 0) return

    const tick = () => {
      setNodes(prevNodes => {
        const width = 800
        const height = 500
        const kCenter = gravityMode === "galaxy" ? 0.015 : 0.005 // Center gravity pull
        const kSpring = 0.09   // Increased spring force for maximum rubbery snap!
        const friction = 0.93  // Rubbery bouncy slide (reduced friction damping)

        const nextNodes = prevNodes.map(n => ({ ...n }))

        // A. Repulsion between all node pairs
        for (let i = 0; i < nextNodes.length; i++) {
          for (let j = i + 1; j < nextNodes.length; j++) {
            const na = nextNodes[i]
            const nb = nextNodes[j]
            const dx = nb.x - na.x
            const dy = nb.y - na.y
            const distSq = dx * dx + dy * dy + 0.1
            const dist = Math.sqrt(distSq)

            const minDistance = na.radius + nb.radius + 60 // Keep them separated!
            if (dist < minDistance) {
              const force = (minDistance - dist) * 0.35 // Rubbery bounce away!
              const fx = (dx / dist) * force
              const fy = (dy / dist) * force

              // Only apply velocity if not dragged
              if (na.id !== draggedNodeId) {
                na.vx -= fx
                na.vy -= fy
              }
              if (nb.id !== draggedNodeId) {
                nb.vx += fx
                nb.vy += fy
              }
            }
          }
        }

        // B. Spring force pulling connected links (Rubbery elasticity)
        links.forEach(link => {
          const sourceNode = nextNodes.find(n => n.id === link.source)
          const targetNode = nextNodes.find(n => n.id === link.target)

          if (sourceNode && targetNode) {
            const dx = targetNode.x - sourceNode.x
            const dy = targetNode.y - sourceNode.y
            const dist = Math.sqrt(dx * dx + dy * dy) || 0.1
            const idealDist = 130
            const force = (dist - idealDist) * kSpring * link.weight

            const fx = (dx / dist) * force
            const fy = (dy / dist) * force

            if (sourceNode.id !== draggedNodeId) {
              sourceNode.vx += fx
              sourceNode.vy += fy
            }
            if (targetNode.id !== draggedNodeId) {
              targetNode.vx -= fx
              targetNode.vy -= fy
            }
          }
        })

        // C. Center Gravity force / Orbit mechanics and velocity integration
        nextNodes.forEach((node, idx) => {
          if (node.id === draggedNodeId) return // Skip movement calculations for dragged node

          // Pull forces depending on Gravity physics mode
          if (gravityMode === "orbit") {
            const angle = (idx / nextNodes.length) * Math.PI * 2 + (Date.now() / 40000)
            const orbitRadius = 150 + (idx % 3) * 45
            const tx = width / 2 + Math.cos(angle) * orbitRadius
            const ty = height / 2 + Math.sin(angle) * orbitRadius
            node.vx += (tx - node.x) * 0.04
            node.vy += (ty - node.y) * 0.04
          } else {
            const dx = width / 2 - node.x
            const dy = height / 2 - node.y
            node.vx += dx * kCenter
            node.vy += dy * kCenter
          }

          // Apply velocity and damping
          node.vx *= friction
          node.vy *= friction

          node.x += node.vx
          node.y += node.vy

          // Contain nodes within general boundary
          node.x = Math.max(40, Math.min(width - 40, node.x))
          node.y = Math.max(40, Math.min(height - 40, node.y))
        })

        return nextNodes
      })

      requestRef.current = requestAnimationFrame(tick)
    }

    requestRef.current = requestAnimationFrame(tick)
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current)
    }
  }, [links, nodes.length, gravityMode, draggedNodeId])

  // Coordinate conversion: Viewport to SVG coordinates
  const getSvgCoordinates = (clientX: number, clientY: number) => {
    if (!svgRef.current) return { x: 0, y: 0 }
    const rect = svgRef.current.getBoundingClientRect()
    return {
      x: (clientX - rect.left - pan.x) / scale,
      y: (clientY - rect.top - pan.y) / scale
    }
  }

  // Mouse Drag handlers (panning canvas vs dragging node!)
  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as SVGElement
    const nodeId = target.getAttribute("data-node-id")

    if (nodeId) {
      // User clicked a node - initiate drag!
      setDraggedNodeId(nodeId)
      const node = nodes.find(n => n.id === nodeId)
      if (node) {
        setSelectedNode(node)
      }
    } else {
      // User clicked canvas background - initiate pan!
      setIsDraggingCanvas(true)
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggedNodeId) {
      // Dragging a node - update its coordinates directly!
      const coords = getSvgCoordinates(e.clientX, e.clientY)
      
      setNodes(prev => prev.map(n => {
        if (n.id === draggedNodeId) {
          // Compute velocity while dragging to support fluid throwing mechanics!
          const vx = coords.x - n.x
          const vy = coords.y - n.y
          return { ...n, x: coords.x, y: coords.y, vx: vx * 0.5, vy: vy * 0.5 }
        }
        return n
      }))
    } else if (isDraggingCanvas) {
      // Panning the canvas
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      })
    }
  }

  const handleMouseUp = () => {
    setDraggedNodeId(null)
    setIsDraggingCanvas(false)
  }

  // Trigger Warp portal navigation
  const triggerWarpToEditor = (node: Node) => {
    setIsWarping(true)
    setWarpTargetId(node.id)

    setTimeout(() => {
      onNavigate(node.id)
    }, 1100) // Warp animation duration
  }

  const filteredNodes = nodes.filter(node => 
    (node.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (node.tags ?? []).some(tag => (tag || "").toLowerCase().includes(searchQuery.toLowerCase()))
  )

  return (
    <div 
      ref={containerRef}
      style={{
        display: "flex",
        height: "100%",
        width: "100%",
        position: "relative",
        background: "radial-gradient(circle at center, rgba(14, 10, 32, 0.5) 0%, var(--bg-primary) 100%)",
        overflow: "hidden",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--border-active)"
      }}
    >
      {/* Space Constellation Particle Overlay */}
      <div 
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: "none",
          backgroundImage: "radial-gradient(1px 1px at 30px 40px, #eee, rgba(0,0,0,0)), radial-gradient(1.5px 1.5px at 120px 80px, #a855f7, rgba(0,0,0,0)), radial-gradient(2px 2px at 180px 240px, rgba(99, 102, 241, 0.4), rgba(0,0,0,0)), radial-gradient(1px 1px at 250px 140px, #3b82f6, rgba(0,0,0,0))",
          backgroundSize: "300px 300px",
          opacity: 0.45,
          animation: "pulse 8s infinite ease-in-out"
        }}
      />

      {/* Floating Header Cockpit */}
      <div 
        style={{
          position: "absolute",
          top: "20px",
          left: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          zIndex: 10
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Orbit size={20} style={{ color: "var(--accent-secondary)", animation: "spin 12s linear infinite" }} />
          <h2 style={{ fontSize: "16px", fontWeight: "700", fontFamily: "var(--font-display)", color: "#ffffff", margin: 0, letterSpacing: "0.02em" }}>
            Celestial Semantic thought-Graph
          </h2>
          <span 
            style={{ 
              fontSize: "9px", 
              fontFamily: "var(--font-mono)", 
              background: "rgba(99, 102, 241, 0.15)", 
              border: "1px solid rgba(99, 102, 241, 0.3)", 
              color: "var(--accent-primary)", 
              padding: "2px 8px", 
              borderRadius: "20px",
              fontWeight: "bold",
              textTransform: "uppercase"
            }}
          >
            {workspace} SPACE
          </span>
        </div>
        <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0, maxWidth: "340px" }}>
          Drag stars to stretch links and release to trigger elastic, rubbery spring recoil physics!
        </p>
      </div>

      {/* Mode Controls and Search Cockpit */}
      <div 
        style={{
          position: "absolute",
          top: "20px",
          right: "20px",
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          gap: "10px"
        }}
      >
        {/* Gravity Force-Selector Mode Toggle */}
        <div 
          style={{ 
            display: "flex", 
            background: "rgba(0,0,0,0.5)", 
            border: "1px solid var(--border-muted)", 
            borderRadius: "var(--radius-sm)", 
            padding: "2px",
            alignItems: "center",
            gap: "2px"
          }}
        >
          <Sliders size={12} style={{ color: "var(--text-muted)", margin: "0 6px" }} />
          {[
            { key: "constellation", label: "Cluster" },
            { key: "galaxy", label: "Galaxy" },
            { key: "orbit", label: "Orbit" }
          ].map(opt => (
            <button
              key={opt.key}
              onClick={() => setGravityMode(opt.key as GravityMode)}
              className="action-pill-premium"
              style={{
                fontSize: "10px",
                padding: "3px 8px",
                borderRadius: "4px",
                background: gravityMode === opt.key ? "var(--text-primary)" : "transparent",
                color: gravityMode === opt.key ? "var(--bg-primary)" : "var(--text-primary)",
                border: "none",
                fontWeight: "700"
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ position: "relative" }}>
          <Search 
            size={13} 
            style={{ 
              position: "absolute", 
              left: "12px", 
              top: "50%", 
              transform: "translateY(-50%)", 
              color: "var(--text-muted)" 
            }} 
          />
          <input 
            type="text"
            placeholder="Search star field..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-premium"
            style={{
              padding: "8px 12px 8px 32px",
              width: "180px",
              fontSize: "12px"
            }}
          />
        </div>

        {/* Zoom Controls */}
        <div 
          style={{ 
            display: "flex", 
            background: "rgba(0,0,0,0.4)", 
            border: "1px solid var(--border-muted)", 
            borderRadius: "var(--radius-sm)", 
            overflow: "hidden" 
          }}
        >
          <button 
            onClick={() => setScale(s => Math.min(2, s + 0.15))} 
            title="Zoom In"
            className="btn-secondary"
            style={{ padding: "6px 8px", border: "none", borderRadius: 0 }}
          >
            <ZoomIn size={12} />
          </button>
          <button 
            onClick={() => setScale(s => Math.max(0.5, s - 0.15))} 
            title="Zoom Out"
            className="btn-secondary"
            style={{ padding: "6px 8px", border: "none", borderRadius: 0 }}
          >
            <ZoomOut size={12} />
          </button>
          <button 
            onClick={() => { setScale(1); setPan({ x: 0, y: 0 }) }} 
            title="Reset Map Layout"
            className="btn-secondary"
            style={{ padding: "6px 8px", border: "none", borderRadius: 0 }}
          >
            <Maximize2 size={12} />
          </button>
        </div>
      </div>

      {/* Main Drag-Pan SVG Viewport Star field */}
      <svg 
        ref={svgRef}
        width="100%" 
        height="100%" 
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          cursor: draggedNodeId ? "grabbing" : isDraggingCanvas ? "grabbing" : "grab",
          userSelect: "none"
        }}
      >
        <defs>
          {/* Glowing node shadow filter */}
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          
          <filter id="linkGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}>
          {/* 1. Rendering Constellation similarity links with animated stardust laser lines! */}
          {links.map((link, idx) => {
            const sourceNode = nodes.find(n => n.id === link.source)
            const targetNode = nodes.find(n => n.id === link.target)

            if (!sourceNode || !targetNode) return null

            // Determine if source or target are selected/hovered to increase glow
            const isHighlight =
              (hoveredNode && (hoveredNode.id === link.source || hoveredNode.id === link.target)) ||
              (selectedNode && (selectedNode.id === link.source || selectedNode.id === link.target))

            // Style by edge kind: explicit wikilinks read as solid/bright,
            // semantic edges as dashed, shared-tag edges as faint dotted.
            const kindStyle = {
              link:     { color: "rgba(168, 85, 247, 0.8)",  dash: "0",     base: 1.6 },
              semantic: { color: "rgba(99, 102, 241, 0.45)", dash: "6,6",   base: 1.1 },
              tag:      { color: "rgba(255, 255, 255, 0.1)",  dash: "2,9",   base: 0.8 },
            }[link.kind]

            return (
              <line
                key={idx}
                x1={sourceNode.x}
                y1={sourceNode.y}
                x2={targetNode.x}
                y2={targetNode.y}
                stroke={isHighlight ? "rgba(99, 102, 241, 0.75)" : kindStyle.color}
                strokeWidth={isHighlight ? 2.5 : kindStyle.base + link.weight}
                strokeDasharray={isHighlight ? "6,6" : kindStyle.dash}
                filter={isHighlight ? "url(#linkGlow)" : ""}
                style={{
                  transition: "stroke 0.3s, stroke-width 0.3s",
                  animation: isHighlight ? "stardustFlow 1s linear infinite" : "none"
                }}
              />
            )
          })}

          {/* 2. Rendering Planet Stars nodes */}
          {filteredNodes.map(node => {
            const isSelected = selectedNode?.id === node.id
            const isHovered = hoveredNode?.id === node.id
            const nodeColor = getTypeColor(node.type)

            return (
              <g 
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                onMouseEnter={() => setHoveredNode(node)}
                onMouseLeave={() => setHoveredNode(null)}
                style={{ transition: "transform 0.1s ease-out" }}
              >
                {/* Pulsar wave orbital rings */}
                {(isHovered || isSelected) && (
                  <circle
                    r={node.radius + 15}
                    fill="none"
                    stroke={nodeColor}
                    strokeWidth="1.5"
                    strokeOpacity="0.25"
                    style={{
                      animation: "pulse 1.8s infinite ease-in-out",
                      transformOrigin: "center"
                    }}
                  />
                )}

                {/* Star base shadow glow */}
                <circle
                  r={node.radius + 6}
                  fill={nodeColor}
                  fillOpacity={isHovered || isSelected ? 0.35 : 0.08}
                  filter="url(#glow)"
                />

                {/* Main draggable center SVG node */}
                <circle
                  r={node.radius}
                  data-node-id={node.id}
                  fill={nodeColor}
                  stroke="#ffffff"
                  strokeWidth={isSelected ? 2.5 : isHovered ? 1.5 : 0}
                  style={{
                    boxShadow: "0 0 15px " + nodeColor,
                    cursor: "grab",
                    transition: "r 0.3s"
                  }}
                />

                {/* Translucent glassmorphic text label badge */}
                {(isHovered || isSelected) ? (
                  <g transform={`translate(0, ${node.radius + 12})`}>
                    <rect
                      x={-70}
                      y={-9}
                      width={140}
                      height={18}
                      rx={4}
                      fill="rgba(10, 8, 22, 0.82)"
                      stroke={nodeColor}
                      strokeWidth={0.5}
                    />
                    <text
                      textAnchor="middle"
                      y={3}
                      fill="#ffffff"
                      style={{
                        fontSize: "9.5px",
                        fontWeight: "bold",
                        fontFamily: "var(--font-mono)",
                        pointerEvents: "none"
                      }}
                    >
                      {node.title.replace(/^[^\w]*/, "").substring(0, 16) + (node.title.length > 16 ? "…" : "")}
                    </text>
                  </g>
                ) : (
                  <text
                    y={node.radius + 14}
                    textAnchor="middle"
                    fill="var(--text-muted)"
                    style={{
                      fontSize: "9px",
                      fontWeight: "500",
                      fontFamily: "var(--font-mono)",
                      pointerEvents: "none",
                      textShadow: "0 1px 2px rgba(0,0,0,0.8)"
                    }}
                  >
                    {node.title.replace(/^[^\w]*/, "").substring(0, 12) + (node.title.length > 12 ? "…" : "")}
                  </text>
                )}
              </g>
            )
          })}
        </g>
      </svg>

      {/* Dynamic Floating Glassmorphic Details HUD Overlay */}
      {selectedNode && (
        <div 
          className="glass-card" 
          style={{
            position: "absolute",
            bottom: "20px",
            left: "20px",
            right: "20px",
            padding: "20px",
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(10, 8, 20, 0.84)",
            border: "1px solid var(--border-active)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
            backdropFilter: "blur(20px)",
            borderRadius: "var(--radius-md)",
            zIndex: 10,
            animation: "slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)"
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxWidth: "70%" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span 
                style={{
                  fontSize: "9px",
                  fontWeight: "bold",
                  fontFamily: "var(--font-mono)",
                  padding: "1px 6px",
                  borderRadius: "4px",
                  background: getTypeColor(selectedNode.type) + "25",
                  border: "1px solid " + getTypeColor(selectedNode.type) + "40",
                  color: getTypeColor(selectedNode.type),
                  textTransform: "uppercase"
                }}
              >
                {selectedNode.type}
              </span>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                <Calendar size={10} />
                {(selectedNode.contentLength / 6).toFixed(0)} words
              </span>
            </div>

            <h3 style={{ fontSize: "15px", fontWeight: "700", fontFamily: "var(--font-display)", color: "#ffffff", margin: "2px 0 0 0" }}>
              {selectedNode.title}
            </h3>

            {/* Tag list */}
            {selectedNode.tags.length > 0 ? (
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "4px" }}>
                {selectedNode.tags.map(tag => (
                  <span 
                    key={tag} 
                    style={{
                      fontSize: "9px", 
                      background: "rgba(255,255,255,0.04)", 
                      border: "1px solid var(--border-muted)", 
                      color: "var(--text-secondary)", 
                      borderRadius: "4px", 
                      padding: "1px 6px"
                    }}
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            ) : (
              <span style={{ fontSize: "10.5px", color: "var(--text-muted)", fontStyle: "italic", marginTop: "2px" }}>No tags indexed</span>
            )}
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button 
              onClick={() => setSelectedNode(null)} 
              className="btn-secondary"
              style={{ padding: "8px 14px", fontSize: "12px" }}
            >
              Close
            </button>
            
            <button 
              onClick={() => triggerWarpToEditor(selectedNode)} 
              className="btn-premium"
              style={{ 
                padding: "8px 18px", 
                fontSize: "12px", 
                display: "inline-flex", 
                alignItems: "center", 
                gap: "6px",
                borderColor: getTypeColor(selectedNode.type)
              }}
            >
              <span>Warp to Workspace</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Screen-Wide Warp Speed Flight Overlay Portal */}
      {isWarping && (
        <div 
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 100,
            background: "#080614",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            animation: "fadeIn 0.4s forwards"
          }}
        >
          {/* Warp speed flight overlay stardust particles */}
          <div 
            style={{
              position: "absolute",
              width: "100%",
              height: "100%",
              backgroundImage: "radial-gradient(1px 1px at 50% 50%, #ffffff, rgba(0,0,0,0))",
              backgroundSize: "100% 100%",
              transform: "scale(1.5)",
              opacity: 0.9,
              animation: "warpSpeed 1.1s cubic-bezier(0.85, 0, 0.15, 1) forwards"
            }}
          />

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", zIndex: 101 }}>
            <Compass 
              size={48} 
              style={{ 
                color: "var(--accent-primary)", 
                animation: "spin 0.6s cubic-bezier(0.7, 0, 0.3, 1) infinite" 
              }} 
            />
            
            <div style={{ textAlign: "center" }}>
              <div 
                style={{ 
                  fontSize: "11px", 
                  fontFamily: "var(--font-mono)", 
                  color: "var(--accent-secondary)", 
                  letterSpacing: "0.15em",
                  fontWeight: "bold",
                  textTransform: "uppercase"
                }}
              >
                Engaging Workspace Warp Drive
              </div>
              <div 
                style={{ 
                  fontSize: "14px", 
                  color: "#ffffff", 
                  fontWeight: "700", 
                  fontFamily: "var(--font-display)",
                  marginTop: "6px"
                }}
              >
                Opening: {pages.find(p => p.id === warpTargetId)?.title || "Loading..."}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inline styles helper for warp-speed and stardust-flow laser animations */}
      <style>{`
        @keyframes warpSpeed {
          0% { transform: scale(1); opacity: 0.3; filter: blur(0px); }
          50% { opacity: 1; filter: blur(2.5px); }
          100% { transform: scale(32); opacity: 0; filter: blur(9px); }
        }
        @keyframes slideUp {
          from { transform: translateY(30px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes stardustFlow {
          from { stroke-dashoffset: 24; }
          to { stroke-dashoffset: 0; }
        }
      `}</style>
    </div>
  )
}
