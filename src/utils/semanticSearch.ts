/**
 * Semantic search over the current workspace.
 *
 * Flow:
 *   1. embed(query) → queryVec
 *   2. Load all EmbeddingRows for the workspace from IndexedDB
 *   3. Cosine similarity(queryVec, pageVec) for each row
 *   4. Return top-k Page objects sorted by score
 *
 * This runs entirely in-browser — no network call, no backend.
 */

import type { Page } from "../App"
import {
  loadEmbeddings,
  hashContent,
  upsertEmbedding,
  isEmbeddingFresh,
  deleteEmbedding,
} from "../db"
import { embed, embedBatch, cosineSimilarity, vecToArray, arrayToVec } from "./embeddings"

// ─── Build a single text to embed for a page ─────────────────────────────────
// Title is weighted higher by repeating it.
function pageToText(page: Page): string {
  const tags = page.tags?.join(" ") ?? ""
  return `${page.title} ${page.title} ${tags} ${page.content}`.trim().slice(0, 2000)
}

// ─── Ensure all pages have fresh embeddings ───────────────────────────────────
// Called on workspace load and after every page save.
export async function syncEmbeddings(workspace: string, pages: Page[]): Promise<void> {
  const toEmbed: Page[] = []

  for (const page of pages) {
    const text = pageToText(page)
    const hash = hashContent(text)
    const fresh = await isEmbeddingFresh(workspace, page.id, hash)
    if (!fresh) toEmbed.push(page)
  }

  if (toEmbed.length === 0) return

  const texts = toEmbed.map(pageToText)
  const vectors = await embedBatch(texts)

  for (let i = 0; i < toEmbed.length; i++) {
    const page = toEmbed[i]
    const text = pageToText(page)
    await upsertEmbedding(workspace, page.id, vecToArray(vectors[i]), hashContent(text))
  }
}

// ─── Embed and immediately store a single updated page ────────────────────────
export async function syncPageEmbedding(workspace: string, page: Page): Promise<void> {
  const text = pageToText(page)
  const hash = hashContent(text)
  const fresh = await isEmbeddingFresh(workspace, page.id, hash)
  if (fresh) return
  const vec = await embed(text)
  await upsertEmbedding(workspace, page.id, vecToArray(vec), hash)
}

// ─── Remove embedding when a page is deleted ─────────────────────────────────
export async function removePageEmbedding(workspace: string, pageId: string): Promise<void> {
  await deleteEmbedding(workspace, pageId)
}

// ─── Semantic search ──────────────────────────────────────────────────────────

export interface SemanticResult {
  page: Page
  score: number  // cosine similarity, 0–1
}

/**
 * Find the top-k pages most semantically relevant to `query`.
 * Falls back gracefully to empty array if no embeddings exist yet.
 */
export async function semanticSearch(
  query: string,
  workspace: string,
  pages: Page[],
  topK = 4,
  minScore = 0.25
): Promise<SemanticResult[]> {
  if (!query.trim() || pages.length === 0) return []

  // Embed the query
  const queryVec = await embed(query)

  // Load stored page vectors
  const rows = await loadEmbeddings(workspace)
  if (rows.length === 0) return []

  // Build a lookup map
  const vecMap = new Map<string, Float32Array>()
  for (const row of rows) {
    vecMap.set(row.pageId, arrayToVec(row.vector))
  }

  // Score every page that has an embedding
  const scored: SemanticResult[] = []
  for (const page of pages) {
    const vec = vecMap.get(page.id)
    if (!vec) continue
    const score = cosineSimilarity(queryVec, vec)
    if (score >= minScore) scored.push({ page, score })
  }

  // Return top-k sorted by score descending
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
}

// ─── Build context string from semantic results ───────────────────────────────
// Drop-in replacement for the manual buildKnowledgeContext in WorkspaceCopilot.

export function buildSemanticContext(results: SemanticResult[]): string {
  if (results.length === 0) return ""
  return results.map(({ page, score }) => {
    const relevance = `[relevance: ${(score * 100).toFixed(0)}%]`
    const preview = page.content.slice(0, 1500) + (page.content.length > 1500 ? "\n…[truncated]" : "")
    return `--- "${page.title}" [${page.type.toUpperCase()}] ${relevance} ---\n${preview}`
  }).join("\n\n")
}
