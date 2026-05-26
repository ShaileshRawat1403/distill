/**
 * GraphRAG enrichment — the frontier layer of Distill's knowledge graph.
 *
 * Instead of only linking note→note, we ask the active model (Ollama, a cloud
 * key, or the DAX/Rook subscription bridge) to extract the *concepts* and the
 * *relationships between them* from each note. Aggregated across the workspace,
 * this yields a typed concept graph: ideas as nodes, semantic relations as
 * edges, with back-pointers to the notes that mention each concept.
 *
 * Persisted as JSON in the settings KV store (keyed per workspace), so it needs
 * no schema migration and survives reloads.
 */

import type { Page } from "../App"
import { executePrompt, type APIKeys } from "./ai"
import { daxPrompt } from "./daxBridge"
import { getSetting, setSetting } from "../db"

export interface ConceptNode {
  id: string           // slug of the normalised name
  name: string         // display name
  type: string         // concept | technology | person | project | method | …
  mentions: string[]   // page ids that reference this concept
}

export interface ConceptRelation {
  source: string       // concept id
  target: string       // concept id
  label: string        // "depends on", "part of", "contrasts with", …
}

export interface ConceptGraph {
  concepts: ConceptNode[]
  relations: ConceptRelation[]
  builtAt: number
  noteCount: number
}

const SYSTEM = `You extract a knowledge graph from a single note.
Return ONLY JSON (no prose, no markdown fences):
{"entities":[{"name":string,"type":"concept"|"technology"|"person"|"project"|"method"|"org"}],
 "relations":[{"source":string,"target":string,"label":string}]}
Rules:
- 3-7 entities, the most important ideas in the note. Short canonical names (1-4 words).
- relations connect two entity names you listed; label is a short verb phrase.
- No commentary, no trailing text.`

function slug(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

interface RawExtract {
  entities?: { name?: string; type?: string }[]
  relations?: { source?: string; target?: string; label?: string }[]
}

function parseExtract(raw: string): RawExtract | null {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
  const start = cleaned.indexOf("{")
  const end = cleaned.lastIndexOf("}")
  if (start < 0 || end < 0) return null
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as RawExtract
  } catch {
    return null
  }
}

export interface BuildOptions {
  provider: string
  model: string
  apiKeys: APIKeys
  /** Max notes to process (cost guard). */
  limit?: number
  /** Progress callback: (done, total). */
  onProgress?: (done: number, total: number) => void
}

/**
 * Build the workspace concept graph by extracting from each note and merging.
 * Concepts are deduplicated by slug; mentions and relations accumulate.
 */
export async function buildConceptGraph(pages: Page[], opts: BuildOptions): Promise<ConceptGraph> {
  const candidates = pages
    .filter((p) => (p.content?.trim().length ?? 0) > 60)
    .slice(0, opts.limit ?? 30)

  const conceptMap = new Map<string, ConceptNode>()
  const relationSet = new Map<string, ConceptRelation>()

  // When routing through the DAX/Rook bridge, reuse a single agent session for
  // the whole build instead of spinning up a fresh one per note (much faster).
  const useDax = opts.provider === "dax" && !!opts.apiKeys.daxUrl
  const [daxProviderID, ...daxRest] = opts.model.split("/")
  const daxModelID = daxRest.join("/")
  let daxSession: string | undefined

  for (let i = 0; i < candidates.length; i++) {
    const page = candidates[i]
    opts.onProgress?.(i, candidates.length)
    try {
      const prompt = `Title: ${page.title}\n\n${page.content.slice(0, 2000)}`
      let raw: string
      if (useDax && daxProviderID && daxModelID) {
        const res = await daxPrompt({
          cfg: { url: opts.apiKeys.daxUrl!, password: opts.apiKeys.daxPassword },
          providerID: daxProviderID,
          modelID: daxModelID,
          prompt,
          system: SYSTEM,
          sessionID: daxSession,
        })
        daxSession = res.sessionID // reuse for subsequent notes
        raw = res.text
      } else {
        raw = await executePrompt({
          provider: opts.provider,
          model: opts.model,
          apiKeys: opts.apiKeys,
          systemPrompt: SYSTEM,
          prompt,
        })
      }
      const ex = parseExtract(raw)
      if (!ex) continue

      const localSlugs = new Map<string, string>() // raw name → slug for this note
      for (const e of ex.entities ?? []) {
        const name = (e.name ?? "").trim()
        if (!name) continue
        const id = slug(name)
        if (!id) continue
        localSlugs.set(name.toLowerCase(), id)
        const existing = conceptMap.get(id)
        if (existing) {
          if (!existing.mentions.includes(page.id)) existing.mentions.push(page.id)
        } else {
          conceptMap.set(id, { id, name, type: (e.type ?? "concept"), mentions: [page.id] })
        }
      }

      for (const r of ex.relations ?? []) {
        const s = localSlugs.get((r.source ?? "").toLowerCase()) ?? slug(r.source ?? "")
        const t = localSlugs.get((r.target ?? "").toLowerCase()) ?? slug(r.target ?? "")
        if (!s || !t || s === t) continue
        const key = `${s}>${t}:${(r.label ?? "").toLowerCase()}`
        if (!relationSet.has(key)) {
          relationSet.set(key, { source: s, target: t, label: (r.label ?? "related").trim() })
        }
      }
    } catch {
      // skip a failed note; keep going
    }
  }
  opts.onProgress?.(candidates.length, candidates.length)

  // Drop relations whose endpoints didn't survive as concepts.
  const concepts = [...conceptMap.values()]
  const ids = new Set(concepts.map((c) => c.id))
  const relations = [...relationSet.values()].filter((r) => ids.has(r.source) && ids.has(r.target))

  return { concepts, relations, builtAt: Date.now(), noteCount: candidates.length }
}

// ─── Persistence (settings KV, JSON) ──────────────────────────────────────────

const key = (workspace: string) => `graphrag_${workspace}`

export async function saveConceptGraph(workspace: string, graph: ConceptGraph): Promise<void> {
  await setSetting(key(workspace), JSON.stringify(graph))
}

export async function loadConceptGraph(workspace: string): Promise<ConceptGraph | null> {
  const raw = await getSetting(key(workspace))
  if (!raw) return null
  try {
    return JSON.parse(raw) as ConceptGraph
  } catch {
    return null
  }
}
