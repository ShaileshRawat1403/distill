import Dexie, { type Table } from "dexie"
import type { Page, KanbanTask, SpreadsheetRow } from "../App"

// ─── Re-export the App types so db consumers can import from one place ────────
export type { Page, KanbanTask, SpreadsheetRow }

// ─── Settings row stored as a key/value pair ─────────────────────────────────
export interface SettingRow {
  key: string
  value: string
}

// ─── Workspace page row ───────────────────────────────────────────────────────
export interface PageRow extends Page {
  workspace: string
}

// ─── Embedding row ────────────────────────────────────────────────────────────
// Stores a serialised vector (number[]) alongside the page it belongs to.
// Keyed on [workspace+pageId] to mirror the pages table.
export interface EmbeddingRow {
  workspace: string
  pageId: string
  vector: number[]      // Float32Array serialised as plain array for IDB compat
  embeddedAt: number    // timestamp — lets us detect stale embeddings
  contentHash: number   // cheap hash of page content to skip re-embedding unchanged pages
}

// ─── Database definition ──────────────────────────────────────────────────────
class DistillDB extends Dexie {
  pages!: Table<PageRow, string>
  settings!: Table<SettingRow, string>
  embeddings!: Table<EmbeddingRow, [string, string]>

  constructor() {
    super("DistillDB")

    this.version(1).stores({
      pages: "[workspace+id], workspace, id, updatedAt, type",
      settings: "key",
    })

    // Version 2 adds the embeddings table — existing v1 data is preserved
    this.version(2).stores({
      pages: "[workspace+id], workspace, id, updatedAt, type",
      settings: "key",
      embeddings: "[workspace+pageId], workspace, pageId, embeddedAt",
    })
  }
}

export const db = new DistillDB()

// ─── Page helpers ─────────────────────────────────────────────────────────────

/** Load all pages for a workspace, newest first */
export async function loadPages(workspace: string): Promise<Page[]> {
  const rows = await db.pages
    .where("workspace")
    .equals(workspace)
    .reverse()
    .sortBy("updatedAt")
  return rows.map(({ workspace: _ws, ...page }) => page as Page)
}

/** Upsert a single page */
export async function upsertPage(workspace: string, page: Page): Promise<void> {
  await db.pages.put({ ...page, workspace })
}

/** Upsert many pages at once (bulk write) */
export async function bulkUpsertPages(workspace: string, pages: Page[]): Promise<void> {
  await db.pages.bulkPut(pages.map((p) => ({ ...p, workspace })))
}

/** Delete a single page */
export async function deletePage(workspace: string, id: string): Promise<void> {
  await db.pages
    .where("[workspace+id]")
    .equals([workspace, id])
    .delete()
}

/** Replace all pages in a workspace (used for import / clear) */
export async function replaceWorkspace(workspace: string, pages: Page[]): Promise<void> {
  await db.transaction("rw", db.pages, async () => {
    await db.pages.where("workspace").equals(workspace).delete()
    if (pages.length > 0) {
      await db.pages.bulkAdd(pages.map((p) => ({ ...p, workspace })))
    }
  })
}

// ─── Settings helpers ─────────────────────────────────────────────────────────

export async function getSetting(key: string): Promise<string | undefined> {
  const row = await db.settings.get(key)
  return row?.value
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db.settings.put({ key, value })
}

// ─── Embedding helpers ────────────────────────────────────────────────────────

/** Cheap djb2 hash — used to detect unchanged page content */
export function hashContent(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = (((h << 5) + h) ^ s.charCodeAt(i)) >>> 0
  }
  return h
}

/** Store or update an embedding for a page */
export async function upsertEmbedding(
  workspace: string,
  pageId: string,
  vector: number[],
  contentHash: number
): Promise<void> {
  await db.embeddings.put({ workspace, pageId, vector, embeddedAt: Date.now(), contentHash })
}

/** Load all embeddings for a workspace */
export async function loadEmbeddings(workspace: string): Promise<EmbeddingRow[]> {
  return db.embeddings.where("workspace").equals(workspace).toArray()
}

/** Delete the embedding for a deleted page */
export async function deleteEmbedding(workspace: string, pageId: string): Promise<void> {
  await db.embeddings.where("[workspace+pageId]").equals([workspace, pageId]).delete()
}

/** Check whether a page's embedding is still fresh */
export async function isEmbeddingFresh(
  workspace: string,
  pageId: string,
  currentHash: number
): Promise<boolean> {
  const row = await db.embeddings.where("[workspace+pageId]").equals([workspace, pageId]).first()
  return !!row && row.contentHash === currentHash
}

// ─── Migration helper ─────────────────────────────────────────────────────────
// On first run, import any data that was already stored in localStorage
// so existing users don't lose their work.

export async function migrateFromLocalStorage(): Promise<void> {
  const migrated = await getSetting("__migrated_v1")
  if (migrated === "true") return

  const workspaces = ["enterprise", "startup", "personal"]
  for (const ws of workspaces) {
    const raw = localStorage.getItem(`distill_pages_${ws}`)
    if (!raw) continue
    try {
      const pages = JSON.parse(raw) as Page[]
      if (Array.isArray(pages) && pages.length > 0) {
        await bulkUpsertPages(ws, pages)
      }
    } catch {
      // corrupted — skip
    }
  }

  // Also migrate active workspace setting
  const activeWs = localStorage.getItem("distill_active_workspace")
  if (activeWs) await setSetting("active_workspace", activeWs)

  // Mark done so we don't re-run
  await setSetting("__migrated_v1", "true")
}
