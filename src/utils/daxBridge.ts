/**
 * DAX / Rook bridge — the *real* replacement for the old faked "subscription"
 * path. Instead of bogus shared keys and canned responses, Distill talks to a
 * locally-running `dax serve` (or `rook serve`) HTTP server that already holds
 * the user's ChatGPT Plus / Gemini Advanced / Claude subscription auth (via
 * `dax auth login`). No API keys live in the browser; the local agent owns them.
 *
 * Setup the user does once, outside Distill:
 *   $ dax auth login           # sign in to ChatGPT / Gemini / Claude
 *   $ dax serve --port 4096    # expose the local gateway
 *
 * The server enables CORS, so the browser can call it directly. If launched
 * with DAX_SERVER_PASSWORD, requests use HTTP basic auth (username "dax").
 *
 * API (from the dax OpenAPI contract, verified against dax 1.1.x):
 *   GET  /global/health                  → { healthy, version }
 *   GET  /config/providers               → { providers[], default{} }
 *   POST /session                        → { id, ... }
 *   POST /session/{id}/message           → { info, parts[] }   (parts hold text)
 */

export interface DaxConfig {
  /** Base URL of the local dax/rook server, e.g. http://127.0.0.1:4096 */
  url: string
  /** Optional DAX_SERVER_PASSWORD; username is always "dax". */
  password?: string
}

export interface DaxModel {
  providerID: string
  modelID: string
  name: string
}

export interface DaxProvidersResult {
  models: DaxModel[]
  /** providerID → default modelID */
  defaults: Record<string, string>
}

function authHeaders(cfg: DaxConfig): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" }
  if (cfg.password) h["Authorization"] = "Basic " + btoa(`dax:${cfg.password}`)
  return h
}

function trimUrl(url: string): string {
  return url.replace(/\/+$/, "")
}

/** Liveness + version check. Throws a friendly error if the server is down. */
export async function checkDaxHealth(cfg: DaxConfig): Promise<{ healthy: boolean; version: string }> {
  let res: Response
  try {
    res = await fetch(`${trimUrl(cfg.url)}/global/health`, { headers: authHeaders(cfg) })
  } catch {
    throw new Error(
      `Can't reach the DAX/Rook server at ${cfg.url}. Start it with: dax serve --port 4096`
    )
  }
  if (res.status === 401) throw new Error("DAX server rejected auth — check the server password.")
  if (!res.ok) throw new Error(`DAX server unhealthy: ${res.statusText}`)
  return res.json()
}

/** Discover the subscription-authed providers + models the server exposes. */
export async function listDaxModels(cfg: DaxConfig): Promise<DaxProvidersResult> {
  const res = await fetch(`${trimUrl(cfg.url)}/config/providers`, { headers: authHeaders(cfg) })
  if (!res.ok) throw new Error(`Failed to load DAX providers: ${res.statusText}`)
  const data = await res.json() as {
    providers: { id: string; name: string; models: Record<string, { id: string; name: string }> }[]
    default: Record<string, string>
  }
  const models: DaxModel[] = []
  for (const p of data.providers) {
    for (const mid of Object.keys(p.models)) {
      models.push({ providerID: p.id, modelID: mid, name: `${p.name} · ${p.models[mid].name}` })
    }
  }
  return { models, defaults: data.default ?? {} }
}

/** Pull the concatenated text out of a session.prompt response. */
function extractText(parts: { type: string; text?: string }[]): string {
  return parts
    .filter((p) => p.type === "text" && typeof p.text === "string")
    .map((p) => p.text as string)
    .join("")
    .trim()
}

export interface DaxPromptArgs {
  cfg: DaxConfig
  providerID: string
  modelID: string
  prompt: string
  system?: string
  /** Reuse an existing session id to keep conversation context; omit to create one. */
  sessionID?: string
}

export interface DaxPromptResult {
  text: string
  sessionID: string
}

/**
 * Send a single prompt through the bridge and return the model's text reply.
 * Creates a session on first use; pass the returned sessionID back to continue
 * the same conversation.
 */
export async function daxPrompt(args: DaxPromptArgs): Promise<DaxPromptResult> {
  const base = trimUrl(args.cfg.url)
  const headers = authHeaders(args.cfg)

  let sessionID = args.sessionID
  if (!sessionID) {
    const sres = await fetch(`${base}/session`, {
      method: "POST",
      headers,
      body: JSON.stringify({ title: "Distill" }),
    })
    if (!sres.ok) throw new Error(`DAX session create failed: ${sres.statusText}`)
    sessionID = (await sres.json()).id as string
  }

  const body: Record<string, unknown> = {
    model: { providerID: args.providerID, modelID: args.modelID },
    parts: [{ type: "text", text: args.prompt }],
  }
  if (args.system) body.system = args.system

  const res = await fetch(`${base}/session/${sessionID}/message`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.data?.message || err?.message || `DAX prompt failed: ${res.statusText}`)
  }
  const data = await res.json() as { info?: { error?: unknown }; parts: { type: string; text?: string }[] }
  if (data.info?.error) {
    throw new Error(`DAX model error: ${JSON.stringify(data.info.error).slice(0, 200)}`)
  }
  return { text: extractText(data.parts), sessionID }
}

// ─── MCP server management ────────────────────────────────────────────────────
// DAX hosts Model Context Protocol servers (Google Drive, GitHub, …) and runs
// their OAuth — the browser-SPA can't do that itself, so Distill drives DAX's
// /mcp API. Once a server is connected & authed in DAX, the agent can use its
// tools whenever Distill prompts it. This is the real path for Google Drive.

export interface McpServerStatus {
  name: string
  state: string         // "connected" | "needs_auth" | "failed" | "disabled" | …
  toolCount?: number
}

/** Raw MCP config sent to DAX. Either a local stdio command or a remote URL. */
export type McpConfig =
  | { type: "local"; command: string[]; environment?: Record<string, string>; enabled?: boolean }
  | { type: "remote"; url: string; headers?: Record<string, string>; enabled?: boolean }

export async function listMcpServers(cfg: DaxConfig): Promise<McpServerStatus[]> {
  const res = await fetch(`${trimUrl(cfg.url)}/mcp`, { headers: authHeaders(cfg) })
  if (!res.ok) throw new Error(`Failed to list MCP servers: ${res.statusText}`)
  const data = (await res.json()) as Record<string, { state?: string; status?: string; tools?: unknown[] }>
  return Object.entries(data).map(([name, s]) => ({
    name,
    state: s.state ?? s.status ?? "unknown",
    toolCount: Array.isArray(s.tools) ? s.tools.length : undefined,
  }))
}

export async function addMcpServer(cfg: DaxConfig, name: string, config: McpConfig): Promise<void> {
  const res = await fetch(`${trimUrl(cfg.url)}/mcp`, {
    method: "POST",
    headers: authHeaders(cfg),
    body: JSON.stringify({ name, config }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.data?.message || err?.message || `Failed to add MCP server: ${res.statusText}`)
  }
}

export async function connectMcpServer(cfg: DaxConfig, name: string): Promise<void> {
  const res = await fetch(`${trimUrl(cfg.url)}/mcp/${encodeURIComponent(name)}/connect`, { method: "POST", headers: authHeaders(cfg) })
  if (!res.ok) throw new Error(`Failed to connect "${name}": ${res.statusText}`)
}

export async function disconnectMcpServer(cfg: DaxConfig, name: string): Promise<void> {
  const res = await fetch(`${trimUrl(cfg.url)}/mcp/${encodeURIComponent(name)}/disconnect`, { method: "POST", headers: authHeaders(cfg) })
  if (!res.ok) throw new Error(`Failed to disconnect "${name}": ${res.statusText}`)
}

/**
 * Begin an MCP server's OAuth (e.g. Google Drive). DAX runs the browser flow and
 * a localhost callback. Returns an authorization URL to open, when provided.
 */
export async function startMcpAuth(cfg: DaxConfig, name: string): Promise<{ url?: string }> {
  const res = await fetch(`${trimUrl(cfg.url)}/mcp/${encodeURIComponent(name)}/auth`, { method: "POST", headers: authHeaders(cfg) })
  if (!res.ok) throw new Error(`Failed to start auth for "${name}": ${res.statusText}`)
  const data = await res.json().catch(() => ({})) as { url?: string; authorization?: { url?: string } }
  return { url: data.url ?? data.authorization?.url }
}
