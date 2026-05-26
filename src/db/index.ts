import Dexie, { type Table } from "dexie"
import type { Page, KanbanTask, SpreadsheetRow } from "../App"

// ─── Re-export the App types so db consumers can import from one place ────────
export type { Page, KanbanTask, SpreadsheetRow }

export interface SettingRow {
  key: string
  value: string
}

export interface PageRow extends Page {
  workspace: string
}

export interface EmbeddingRow {
  workspace: string
  pageId: string
  vector: number[]
  embeddedAt: number
  contentHash: number
}

/**
 * Persistence layer — SQLite-WASM with durable OPFS storage.
 *
 * Pages, settings and embeddings live in one embedded SQLite database
 * (`/distill.sqlite3`) persisted to the Origin Private File System via the
 * official SAH-Pool VFS (works on the main thread, no COOP/COEP headers).
 *
 * The public helper API is identical to the previous Dexie/IndexedDB layer, so
 * no consumer changed. Existing users' data is migrated once from the old Dexie
 * `DistillDB` on first run (see migrateFromLocalStorage).
 *
 * If OPFS is unavailable (private mode, sandboxed runtime), we fall back to an
 * in-memory database so the app still runs — it just won't persist that session.
 */

// SQLite runs in a worker (OPFS sync access handles are worker-only). We talk to
// it over a tiny promise-based RPC. The worker self-initialises on first message.
let worker: Worker | null = null
const pending = new Map<number, { resolve: (rows: unknown[] | undefined) => void; reject: (e: Error) => void }>()
let seq = 0

function getWorker(): Worker {
  if (worker) return worker
  worker = new Worker(new URL("./sqliteWorker.ts", import.meta.url), { type: "module" })
  worker.onmessage = (e: MessageEvent) => {
    const { id, ok, rows, error } = e.data as { id: number; ok: boolean; rows?: unknown[]; error?: string }
    const p = pending.get(id)
    if (!p) return
    pending.delete(id)
    if (ok) p.resolve(rows)
    else p.reject(new Error(error ?? "sqlite worker error"))
  }
  worker.onerror = (e) => {
    // Reject everything in flight so callers fail fast instead of hanging.
    for (const [, p] of pending) p.reject(new Error(`sqlite worker crashed: ${e.message}`))
    pending.clear()
  }
  return worker
}

function call(sql: string, bind: unknown[], rowMode?: string, returnValue?: string): Promise<unknown[] | undefined> {
  const id = ++seq
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    getWorker().postMessage({ id, sql, bind, rowMode, returnValue })
  })
}

async function query<T = Record<string, unknown>>(sql: string, bind: unknown[] = []): Promise<T[]> {
  const rows = await call(sql, bind, "object", "resultRows")
  return (rows ?? []) as T[]
}

async function run(sql: string, bind: unknown[] = []): Promise<void> {
  await call(sql, bind)
}

/** Ensure the worker + DB schema are initialised (a trivial round-trip). */
async function ensureDb(): Promise<void> {
  await query("SELECT 1")
}

// ─── Page helpers ─────────────────────────────────────────────────────────────

/** Load all pages for a workspace, newest first */
export async function loadPages(workspace: string): Promise<Page[]> {
  const rows = await query<{ data: string }>(
    "SELECT data FROM pages WHERE workspace = ? ORDER BY updatedAt DESC",
    [workspace],
  )
  return rows.map((r) => JSON.parse(r.data) as Page)
}

/** Upsert a single page */
export async function upsertPage(workspace: string, page: Page): Promise<void> {
  await run(
    "INSERT OR REPLACE INTO pages (workspace, id, data, updatedAt, type) VALUES (?, ?, ?, ?, ?)",
    [workspace, page.id, JSON.stringify(page), page.updatedAt ?? Date.now(), page.type],
  )
}

/** Upsert many pages at once (one transaction) */
export async function bulkUpsertPages(workspace: string, pages: Page[]): Promise<void> {
  if (pages.length === 0) return
  await run("BEGIN")
  try {
    for (const p of pages) {
      await run(
        "INSERT OR REPLACE INTO pages (workspace, id, data, updatedAt, type) VALUES (?, ?, ?, ?, ?)",
        [workspace, p.id, JSON.stringify(p), p.updatedAt ?? Date.now(), p.type],
      )
    }
    await run("COMMIT")
  } catch (e) {
    await run("ROLLBACK")
    throw e
  }
}

/** Delete a single page */
export async function deletePage(workspace: string, id: string): Promise<void> {
  await run("DELETE FROM pages WHERE workspace = ? AND id = ?", [workspace, id])
}

/** Replace all pages in a workspace (used for import / clear) */
export async function replaceWorkspace(workspace: string, pages: Page[]): Promise<void> {
  await run("BEGIN")
  try {
    await run("DELETE FROM pages WHERE workspace = ?", [workspace])
    for (const p of pages) {
      await run(
        "INSERT OR REPLACE INTO pages (workspace, id, data, updatedAt, type) VALUES (?, ?, ?, ?, ?)",
        [workspace, p.id, JSON.stringify(p), p.updatedAt ?? Date.now(), p.type],
      )
    }
    await run("COMMIT")
  } catch (e) {
    await run("ROLLBACK")
    throw e
  }
}

// ─── Settings helpers ─────────────────────────────────────────────────────────

export async function getSetting(key: string): Promise<string | undefined> {
  const rows = await query<{ value: string }>("SELECT value FROM settings WHERE key = ?", [key])
  return rows[0]?.value
}

export async function setSetting(key: string, value: string): Promise<void> {
  await run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [key, value])
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
  contentHash: number,
): Promise<void> {
  await run(
    "INSERT OR REPLACE INTO embeddings (workspace, pageId, vector, embeddedAt, contentHash) VALUES (?, ?, ?, ?, ?)",
    [workspace, pageId, JSON.stringify(vector), Date.now(), contentHash],
  )
}

/** Load all embeddings for a workspace */
export async function loadEmbeddings(workspace: string): Promise<EmbeddingRow[]> {
  const rows = await query<{ workspace: string; pageId: string; vector: string; embeddedAt: number; contentHash: number }>(
    "SELECT workspace, pageId, vector, embeddedAt, contentHash FROM embeddings WHERE workspace = ?",
    [workspace],
  )
  return rows.map((r) => ({
    workspace: r.workspace,
    pageId: r.pageId,
    vector: JSON.parse(r.vector) as number[],
    embeddedAt: r.embeddedAt,
    contentHash: r.contentHash,
  }))
}

/** Delete the embedding for a deleted page */
export async function deleteEmbedding(workspace: string, pageId: string): Promise<void> {
  await run("DELETE FROM embeddings WHERE workspace = ? AND pageId = ?", [workspace, pageId])
}

/** Check whether a page's embedding is still fresh */
export async function isEmbeddingFresh(
  workspace: string,
  pageId: string,
  currentHash: number,
): Promise<boolean> {
  const rows = await query<{ contentHash: number }>(
    "SELECT contentHash FROM embeddings WHERE workspace = ? AND pageId = ?",
    [workspace, pageId],
  )
  return rows.length > 0 && rows[0].contentHash === currentHash
}

// ─── Migration ────────────────────────────────────────────────────────────────
// One-time import of any prior data: first from the old Dexie `DistillDB`
// (IndexedDB) for existing users, then from raw localStorage for very old ones.

interface LegacyPageRow extends Page { workspace: string }
interface LegacyEmbeddingRow { workspace: string; pageId: string; vector: number[]; embeddedAt: number; contentHash: number }

class LegacyDexieDB extends Dexie {
  pages!: Table<LegacyPageRow, [string, string]>
  settings!: Table<SettingRow, string>
  embeddings!: Table<LegacyEmbeddingRow, [string, string]>
  constructor() {
    super("DistillDB")
    this.version(2).stores({
      pages: "[workspace+id], workspace, id, updatedAt, type",
      settings: "key",
      embeddings: "[workspace+pageId], workspace, pageId, embeddedAt",
    })
  }
}

async function migrateFromDexie(): Promise<number> {
  let moved = 0
  try {
    const legacy = new LegacyDexieDB()
    const [pages, settings, embeddings] = await Promise.all([
      legacy.pages.toArray().catch(() => []),
      legacy.settings.toArray().catch(() => []),
      legacy.embeddings.toArray().catch(() => []),
    ])
    for (const row of pages) {
      const { workspace, ...page } = row
      await upsertPage(workspace, page as Page)
      moved++
    }
    for (const s of settings) {
      if (s.key.startsWith("__migrated")) continue
      await setSetting(s.key, s.value)
    }
    for (const e of embeddings) {
      await upsertEmbedding(e.workspace, e.pageId, e.vector, e.contentHash)
    }
    legacy.close()
  } catch {
    // No legacy DB / blocked — nothing to migrate.
  }
  return moved
}

async function migrateFromLocalStorageRaw(): Promise<void> {
  const workspaces = ["enterprise", "startup", "personal"]
  for (const ws of workspaces) {
    let raw: string | null = null
    try {
      raw = localStorage.getItem(`distill_pages_${ws}`)
    } catch {
      /* localStorage blocked */
    }
    if (!raw) continue
    try {
      const pages = JSON.parse(raw) as Page[]
      if (Array.isArray(pages) && pages.length > 0) await bulkUpsertPages(ws, pages)
    } catch {
      /* corrupted — skip */
    }
  }
  let activeWs: string | null = null
  try {
    activeWs = localStorage.getItem("distill_active_workspace")
  } catch {
    /* blocked */
  }
  if (activeWs) await setSetting("active_workspace", activeWs)
}

/**
 * Initialise the database and import legacy data exactly once. Kept under the
 * original name so the App bootstrap call is unchanged.
 */
export async function migrateFromLocalStorage(): Promise<void> {
  await ensureDb()

  let done: string | undefined
  try {
    done = await getSetting("__migrated_sqlite")
  } catch {
    /* fresh db */
  }
  if (done === "true") return

  await migrateFromDexie()
  await migrateFromLocalStorageRaw()

  try {
    await setSetting("__migrated_sqlite", "true")
  } catch {
    /* best effort */
  }
}
