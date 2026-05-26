/// <reference lib="webworker" />
/**
 * SQLite runs in this dedicated worker because the OPFS SAH-Pool VFS needs
 * `createSyncAccessHandle`, which browsers only expose in workers (not the main
 * thread). The SAH-Pool VFS also avoids SharedArrayBuffer, so no COOP/COEP
 * headers are required (those would break loading the MiniLM / web-llm models
 * from CDNs).
 *
 * Protocol: main thread posts { id, sql, bind, rowMode?, returnValue? };
 * we reply { id, ok, rows? , error? }. Only SELECTs (returnValue:"resultRows")
 * send rows back — never the non-serialisable DB handle.
 */
import sqlite3InitModule from "@sqlite.org/sqlite-wasm"

interface SqliteDb {
  exec: (opts: { sql: string; bind?: unknown[]; rowMode?: string; returnValue?: string }) => unknown[]
}

let db: SqliteDb | null = null
let ready: Promise<void> | null = null

async function init(): Promise<void> {
  const sqlite3 = (await sqlite3InitModule()) as unknown as {
    oo1: { DB: new (file: string, mode?: string) => SqliteDb }
    installOpfsSAHPoolVfs?: (opts: { name: string }) => Promise<{ OpfsSAHPoolDb: new (file: string) => SqliteDb }>
  }
  try {
    if (sqlite3.installOpfsSAHPoolVfs) {
      const pool = await sqlite3.installOpfsSAHPoolVfs({ name: "distill-opfs" })
      db = new pool.OpfsSAHPoolDb("/distill.sqlite3")
    } else {
      db = new sqlite3.oo1.DB(":memory:", "ct")
    }
  } catch {
    db = new sqlite3.oo1.DB(":memory:", "ct")
  }
  db.exec({
    sql: `
      CREATE TABLE IF NOT EXISTS pages (
        workspace TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL,
        updatedAt INTEGER, type TEXT, PRIMARY KEY (workspace, id)
      );
      CREATE INDEX IF NOT EXISTS idx_pages_ws ON pages (workspace, updatedAt DESC);
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
      CREATE TABLE IF NOT EXISTS embeddings (
        workspace TEXT NOT NULL, pageId TEXT NOT NULL, vector TEXT NOT NULL,
        embeddedAt INTEGER, contentHash INTEGER, PRIMARY KEY (workspace, pageId)
      );
    `,
  })
}

function ensure(): Promise<void> {
  if (!ready) ready = init()
  return ready
}

self.onmessage = async (e: MessageEvent) => {
  const { id, sql, bind, rowMode, returnValue } = e.data as {
    id: number; sql: string; bind?: unknown[]; rowMode?: string; returnValue?: string
  }
  try {
    await ensure()
    if (returnValue === "resultRows") {
      const rows = db!.exec({ sql, bind, rowMode, returnValue })
      ;(self as unknown as Worker).postMessage({ id, ok: true, rows })
    } else {
      db!.exec({ sql, bind })
      ;(self as unknown as Worker).postMessage({ id, ok: true })
    }
  } catch (err) {
    ;(self as unknown as Worker).postMessage({ id, ok: false, error: (err as Error)?.message ?? String(err) })
  }
}
