/**
 * MoodBoard — visual inspiration / reference board.
 *
 * Cards can be:
 *   - image (URL)
 *   - link  (URL + title + description)
 *   - color (hex swatch)
 *   - text  (short snippet or quote)
 *
 * Board state is serialised into page.content as JSON.
 */

import { useState, useCallback } from "react"
import { Plus, X, Image, Link, Palette, Type, ExternalLink, Copy, Check, GripVertical } from "lucide-react"
import { Page } from "../App"

// ─── Card types ───────────────────────────────────────────────────────────────

type CardType = "image" | "link" | "color" | "text"

interface MoodCard {
  id: string
  type: CardType
  // image
  imageUrl?: string
  imageAlt?: string
  // link
  linkUrl?: string
  linkTitle?: string
  linkDesc?: string
  // color
  colorHex?: string
  colorName?: string
  // text
  textContent?: string
  textSize?: "sm" | "md" | "lg"
}

interface MoodBoardData {
  cards: MoodCard[]
  columns: 2 | 3 | 4
  title: string
}

function parseBoardData(content: string, title: string): MoodBoardData {
  try {
    const parsed = JSON.parse(content)
    if (parsed && Array.isArray(parsed.cards)) return parsed as MoodBoardData
  } catch {/* fall through */}
  return { cards: [], columns: 3, title }
}

function serialiseBoard(data: MoodBoardData): string {
  return JSON.stringify(data)
}

// ─── Individual card renderers ────────────────────────────────────────────────

function ImageCard({ card, onDelete }: { card: MoodCard; onDelete: () => void }) {
  const [imgError, setImgError] = useState(false)
  return (
    <div style={{ position: "relative", borderRadius: "10px", overflow: "hidden", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-muted)", aspectRatio: "4/3" }}>
      {!imgError ? (
        <img
          src={card.imageUrl}
          alt={card.imageAlt || ""}
          onError={() => setImgError(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)", gap: "8px" }}>
          <Image size={24} style={{ opacity: 0.4 }} />
          <span style={{ fontSize: "11px" }}>Image unavailable</span>
        </div>
      )}
      <DeleteBtn onDelete={onDelete} />
    </div>
  )
}

function LinkCard({ card, onDelete }: { card: MoodCard; onDelete: () => void }) {
  return (
    <div style={{ position: "relative", padding: "14px", borderRadius: "10px", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-muted)", display: "flex", flexDirection: "column", gap: "8px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
        <div style={{ width: "32px", height: "32px", flexShrink: 0, borderRadius: "8px", background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Link size={14} style={{ color: "var(--accent-secondary)" }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {card.linkTitle || card.linkUrl}
          </p>
          {card.linkDesc && (
            <p style={{ fontSize: "11.5px", color: "var(--text-muted)", margin: "3px 0 0", lineHeight: "1.4", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {card.linkDesc}
            </p>
          )}
        </div>
      </div>
      <a
        href={card.linkUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", color: "var(--accent-secondary)", fontFamily: "var(--font-mono)", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
      >
        <ExternalLink size={10} />
        {card.linkUrl}
      </a>
      <DeleteBtn onDelete={onDelete} />
    </div>
  )
}

function ColorCard({ card, onDelete }: { card: MoodCard; onDelete: () => void }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(card.colorHex || "")
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div style={{ position: "relative", borderRadius: "10px", overflow: "hidden", border: "1px solid var(--border-muted)" }}>
      <div style={{ height: "90px", background: card.colorHex || "#888" }} />
      <div style={{ padding: "10px 12px", background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-primary)", margin: 0, fontFamily: "var(--font-mono)" }}>{card.colorHex?.toUpperCase()}</p>
          {card.colorName && <p style={{ fontSize: "10.5px", color: "var(--text-muted)", margin: "2px 0 0" }}>{card.colorName}</p>}
        </div>
        <button onClick={copy} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px", fontSize: "10.5px" }}>
          {copied ? <Check size={12} style={{ color: "var(--accent-success)" }} /> : <Copy size={12} />}
        </button>
      </div>
      <DeleteBtn onDelete={onDelete} />
    </div>
  )
}

function TextCard({ card, onDelete }: { card: MoodCard; onDelete: () => void }) {
  const sizeMap = { sm: "12px", md: "14px", lg: "18px" }
  return (
    <div style={{ position: "relative", padding: "16px", borderRadius: "10px", background: "rgba(255,255,255,0.025)", border: "1px solid var(--border-muted)" }}>
      <p style={{ margin: 0, fontSize: sizeMap[card.textSize || "md"], color: "var(--text-primary)", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>
        {card.textContent}
      </p>
      <DeleteBtn onDelete={onDelete} />
    </div>
  )
}

function DeleteBtn({ onDelete }: { onDelete: () => void }) {
  return (
    <button
      onClick={onDelete}
      className="card-delete-btn"
      style={{
        position: "absolute", top: "6px", right: "6px",
        width: "22px", height: "22px", borderRadius: "50%",
        background: "rgba(0,0,0,0.6)", border: "none", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "rgba(255,255,255,0.7)", opacity: 0, transition: "opacity 0.15s",
      }}
    >
      <X size={11} />
    </button>
  )
}

// ─── Add card form ────────────────────────────────────────────────────────────

interface AddCardFormProps {
  onAdd: (card: MoodCard) => void
  onCancel: () => void
}

function AddCardForm({ onAdd, onCancel }: AddCardFormProps) {
  const [type, setType] = useState<CardType>("image")
  const [imageUrl, setImageUrl] = useState("")
  const [imageAlt, setImageAlt] = useState("")
  const [linkUrl, setLinkUrl] = useState("")
  const [linkTitle, setLinkTitle] = useState("")
  const [linkDesc, setLinkDesc] = useState("")
  const [colorHex, setColorHex] = useState("#6366f1")
  const [colorName, setColorName] = useState("")
  const [textContent, setTextContent] = useState("")
  const [textSize, setTextSize] = useState<"sm" | "md" | "lg">("md")

  const isValid = () => {
    if (type === "image") return !!imageUrl.trim()
    if (type === "link") return !!linkUrl.trim()
    if (type === "color") return /^#[0-9a-f]{6}$/i.test(colorHex)
    if (type === "text") return !!textContent.trim()
    return false
  }

  const handleAdd = () => {
    const id = Math.random().toString(36).substring(2, 9)
    let card: MoodCard = { id, type }
    if (type === "image") card = { ...card, imageUrl, imageAlt }
    if (type === "link") card = { ...card, linkUrl, linkTitle, linkDesc }
    if (type === "color") card = { ...card, colorHex, colorName }
    if (type === "text") card = { ...card, textContent, textSize }
    onAdd(card)
  }

  const TAB_TYPES: { key: CardType; label: string; icon: React.ReactNode }[] = [
    { key: "image",  label: "Image",  icon: <Image size={12} /> },
    { key: "link",   label: "Link",   icon: <Link size={12} /> },
    { key: "color",  label: "Color",  icon: <Palette size={12} /> },
    { key: "text",   label: "Text",   icon: <Type size={12} /> },
  ]

  return (
    <div className="glass-card" style={{ padding: "18px", display: "flex", flexDirection: "column", gap: "14px" }}>
      {/* Type selector */}
      <div style={{ display: "flex", gap: "4px", background: "rgba(0,0,0,0.3)", padding: "3px", borderRadius: "8px" }}>
        {TAB_TYPES.map((t) => (
          <button
            key={t.key}
            onClick={() => setType(t.key)}
            style={{
              flex: 1, padding: "6px", borderRadius: "5px", border: "none",
              background: type === t.key ? "rgba(255,255,255,0.06)" : "transparent",
              color: type === t.key ? "#fff" : "var(--text-muted)",
              cursor: "pointer", fontSize: "11px", fontWeight: "600",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "5px",
            }}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Fields */}
      {type === "image" && (
        <>
          <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="Image URL (https://…)" className="input-premium" style={{ fontSize: "12.5px" }} />
          <input value={imageAlt} onChange={(e) => setImageAlt(e.target.value)} placeholder="Alt text (optional)" className="input-premium" style={{ fontSize: "12.5px" }} />
        </>
      )}
      {type === "link" && (
        <>
          <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="URL (https://…)" className="input-premium" style={{ fontSize: "12.5px" }} />
          <input value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} placeholder="Title (optional)" className="input-premium" style={{ fontSize: "12.5px" }} />
          <input value={linkDesc} onChange={(e) => setLinkDesc(e.target.value)} placeholder="Description (optional)" className="input-premium" style={{ fontSize: "12.5px" }} />
        </>
      )}
      {type === "color" && (
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <input type="color" value={colorHex} onChange={(e) => setColorHex(e.target.value)} style={{ width: "48px", height: "40px", padding: "2px", borderRadius: "8px", border: "1px solid var(--border-muted)", background: "transparent", cursor: "pointer" }} />
          <input value={colorHex} onChange={(e) => setColorHex(e.target.value)} placeholder="#6366f1" className="input-premium" style={{ fontSize: "12.5px", fontFamily: "var(--font-mono)", flex: 1 }} />
          <input value={colorName} onChange={(e) => setColorName(e.target.value)} placeholder="Name (e.g. Indigo)" className="input-premium" style={{ fontSize: "12.5px", flex: 1 }} />
        </div>
      )}
      {type === "text" && (
        <>
          <textarea value={textContent} onChange={(e) => setTextContent(e.target.value)} placeholder="Your text, quote, or thought…" className="input-premium" style={{ fontSize: "12.5px", height: "80px", resize: "none" }} />
          <div style={{ display: "flex", gap: "6px" }}>
            {(["sm", "md", "lg"] as const).map((s) => (
              <button key={s} onClick={() => setTextSize(s)} style={{ padding: "5px 12px", borderRadius: "6px", border: "1px solid var(--border-muted)", background: textSize === s ? "rgba(255,255,255,0.06)" : "transparent", color: textSize === s ? "#fff" : "var(--text-muted)", cursor: "pointer", fontSize: s === "sm" ? "11px" : s === "md" ? "13px" : "16px", fontWeight: "600" }}>
                {s.toUpperCase()}
              </button>
            ))}
          </div>
        </>
      )}

      <div style={{ display: "flex", gap: "8px" }}>
        <button onClick={handleAdd} disabled={!isValid()} className="btn-premium" style={{ flex: 1, padding: "9px", fontSize: "12.5px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
          <Plus size={13} /> Add Card
        </button>
        <button onClick={onCancel} className="btn-secondary" style={{ padding: "9px 14px", fontSize: "12.5px" }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── Main MoodBoard component ─────────────────────────────────────────────────

interface MoodBoardProps {
  page: Page
  onUpdatePage: (page: Page) => void
}

export default function MoodBoard({ page, onUpdatePage }: MoodBoardProps) {
  const [board, setBoard] = useState<MoodBoardData>(() => parseBoardData(page.content, page.title))
  const [isAdding, setIsAdding] = useState(false)

  const persist = useCallback((updated: MoodBoardData) => {
    setBoard(updated)
    onUpdatePage({ ...page, content: serialiseBoard(updated), updatedAt: Date.now() })
  }, [page, onUpdatePage])

  const addCard = (card: MoodCard) => {
    persist({ ...board, cards: [...board.cards, card] })
    setIsAdding(false)
  }

  const deleteCard = (id: string) => {
    persist({ ...board, cards: board.cards.filter((c) => c.id !== id) })
  }

  const setColumns = (cols: 2 | 3 | 4) => {
    persist({ ...board, columns: cols })
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", height: "100%", overflow: "hidden" }}>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <h2 style={{ fontSize: "18px", fontWeight: "700", fontFamily: "var(--font-display)", margin: 0 }}>
            {page.title}
          </h2>
          <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: "3px" }}>
            {board.cards.length} card{board.cards.length !== 1 ? "s" : ""} · Moodboard
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* Column selector */}
          <div style={{ display: "flex", gap: "4px", background: "rgba(0,0,0,0.3)", padding: "3px", borderRadius: "8px", border: "1px solid var(--border-muted)" }}>
            {([2, 3, 4] as const).map((n) => (
              <button
                key={n}
                onClick={() => setColumns(n)}
                style={{
                  width: "28px", height: "28px", borderRadius: "5px", border: "none",
                  background: board.columns === n ? "rgba(255,255,255,0.07)" : "transparent",
                  color: board.columns === n ? "#fff" : "var(--text-muted)",
                  cursor: "pointer", fontSize: "11px", fontWeight: "700", fontFamily: "var(--font-mono)"
                }}
              >
                {n}
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsAdding(true)}
            className="btn-premium"
            style={{ padding: "8px 16px", fontSize: "12.5px", display: "flex", alignItems: "center", gap: "6px" }}
          >
            <Plus size={13} /> Add Card
          </button>
        </div>
      </div>

      {/* Add card form */}
      {isAdding && (
        <AddCardForm onAdd={addCard} onCancel={() => setIsAdding(false)} />
      )}

      {/* Board grid */}
      <div
        style={{
          flex: 1, overflowY: "auto", paddingRight: "4px",
          display: "grid",
          gridTemplateColumns: `repeat(${board.columns}, 1fr)`,
          gap: "14px",
          alignContent: "start",
        }}
        className="moodboard-grid"
      >
        {board.cards.length === 0 && !isAdding && (
          <div style={{
            gridColumn: `1 / -1`,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            padding: "80px 20px", gap: "14px", color: "var(--text-muted)"
          }}>
            <div style={{ display: "flex", gap: "12px", opacity: 0.4 }}>
              <Image size={24} /><Link size={24} /><Palette size={24} /><Type size={24} />
            </div>
            <p style={{ fontSize: "13px", textAlign: "center", maxWidth: "260px", lineHeight: "1.6", margin: 0 }}>
              Your moodboard is empty. Add images, links, color swatches, or text cards to start building your visual reference.
            </p>
            <button onClick={() => setIsAdding(true)} className="btn-secondary" style={{ fontSize: "12.5px", display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px" }}>
              <Plus size={12} /> Add your first card
            </button>
          </div>
        )}

        {board.cards.map((card) => {
          const props = { card, onDelete: () => deleteCard(card.id) }
          return (
            <div key={card.id} className="moodboard-card" style={{ position: "relative" }}>
              <div className="drag-handle" style={{ position: "absolute", top: "6px", left: "6px", zIndex: 1, color: "rgba(255,255,255,0.3)", cursor: "grab", opacity: 0, transition: "opacity 0.15s" }}>
                <GripVertical size={13} />
              </div>
              {card.type === "image"  && <ImageCard  {...props} />}
              {card.type === "link"   && <LinkCard   {...props} />}
              {card.type === "color"  && <ColorCard  {...props} />}
              {card.type === "text"   && <TextCard   {...props} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
