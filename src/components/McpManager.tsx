import { useState, useEffect, useCallback } from "react"
import { Plug, Plus, RefreshCw, Loader2, KeyRound, Link2, Link2Off } from "lucide-react"
import {
  listMcpServers, addMcpServer, connectMcpServer, disconnectMcpServer, startMcpAuth,
  type McpServerStatus, type McpConfig,
} from "../utils/daxBridge"

/**
 * Manage the MCP servers hosted by the connected DAX/Rook agent — the real path
 * for Google Drive (and GitHub, etc.). DAX runs each server's OAuth (which a
 * browser SPA can't), so here we just list/add/connect them and kick off auth.
 * Once a server is connected & authed, the DAX agent can use its tools whenever
 * Distill prompts through the bridge.
 */
interface McpManagerProps {
  daxUrl: string
  daxPassword: string
  connected: boolean
  logSystemMessage?: (tag: "SYSTEM" | "DATABASE" | "OLLAMA" | "ERROR", message: string) => void
}

export default function McpManager({ daxUrl, daxPassword, connected, logSystemMessage }: McpManagerProps) {
  const cfg = { url: daxUrl, password: daxPassword }
  const [servers, setServers] = useState<McpServerStatus[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [showAdd, setShowAdd] = useState(false)

  // Add-form state
  const [name, setName] = useState("")
  const [kind, setKind] = useState<"remote" | "local">("remote")
  const [url, setUrl] = useState("")
  const [command, setCommand] = useState("")

  const refresh = useCallback(async () => {
    if (!connected) return
    setBusy(true); setError("")
    try {
      setServers(await listMcpServers(cfg))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, daxUrl, daxPassword])

  useEffect(() => { refresh() }, [refresh])

  const wrap = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true); setError("")
    try {
      await fn()
      logSystemMessage?.("SYSTEM", ok)
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const handleAdd = () => {
    if (!name.trim()) return
    const config: McpConfig = kind === "remote"
      ? { type: "remote", url: url.trim(), enabled: true }
      : { type: "local", command: command.trim().split(/\s+/).filter(Boolean), enabled: true }
    wrap(() => addMcpServer(cfg, name.trim(), config), `Added MCP server "${name.trim()}"`).then(() => {
      setShowAdd(false); setName(""); setUrl(""); setCommand("")
    })
  }

  const handleAuth = async (s: string) => {
    setError("")
    try {
      const { url } = await startMcpAuth(cfg, s)
      if (url) window.open(url, "_blank", "noopener")
      logSystemMessage?.("SYSTEM", `Started auth for MCP server "${s}"`)
      setTimeout(refresh, 1500)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  if (!connected) return null

  const stateColor = (state: string) =>
    /connect/i.test(state) ? "var(--accent-success)" : /auth/i.test(state) ? "var(--accent-warning)" : /fail|error/i.test(state) ? "var(--accent-danger)" : "var(--text-muted)"

  return (
    <div className="glass-card" style={{ padding: "30px", display: "flex", flexDirection: "column", gap: "14px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border-muted)", paddingBottom: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Plug size={18} style={{ color: "var(--accent-primary)" }} />
          <h3 style={{ fontSize: "16px", fontWeight: 600, fontFamily: "var(--font-display)" }}>MCP Servers (via DAX/Rook)</h3>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={refresh} disabled={busy} className="btn-secondary" style={{ padding: "6px 10px", fontSize: "11.5px" }}>
            {busy ? <Loader2 size={12} className="spin-icon" /> : <RefreshCw size={12} />}
          </button>
          <button onClick={() => setShowAdd(!showAdd)} className="btn-premium" style={{ padding: "6px 12px", fontSize: "11.5px", display: "inline-flex", alignItems: "center", gap: "5px" }}>
            <Plus size={12} /> Add
          </button>
        </div>
      </div>

      <p style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
        Connect tool servers (e.g. <strong>Google Drive</strong>, GitHub) to the DAX agent. DAX runs their OAuth; once connected, the agent can read/act on them when you prompt through the bridge.
      </p>

      {showAdd && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", background: "rgba(255,255,255,0.015)", border: "1px solid var(--border-muted)", borderRadius: "var(--radius-sm)", padding: "14px" }}>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (e.g. gdrive)" className="input-premium" style={{ flex: "1 1 140px" }} />
            <select value={kind} onChange={(e) => setKind(e.target.value as "remote" | "local")} className="input-premium" style={{ width: "120px" }}>
              <option value="remote">Remote URL</option>
              <option value="local">Local command</option>
            </select>
          </div>
          {kind === "remote" ? (
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://mcp.example.com/sse" className="input-premium" />
          ) : (
            <input value={command} onChange={(e) => setCommand(e.target.value)} placeholder="npx -y @some/mcp-google-drive" className="input-premium" />
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
            <button onClick={() => setShowAdd(false)} className="btn-secondary" style={{ padding: "6px 12px", fontSize: "12px" }}>Cancel</button>
            <button onClick={handleAdd} disabled={!name.trim()} className="btn-premium" style={{ padding: "6px 14px", fontSize: "12px" }}>Add server</button>
          </div>
        </div>
      )}

      {error && <span style={{ fontSize: "11.5px", color: "var(--accent-danger)" }}>{error}</span>}

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {servers.length === 0 && !busy && (
          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>No MCP servers yet. Add one above (e.g. a Google Drive MCP).</span>
        )}
        {servers.map((s) => {
          const needsAuth = /auth/i.test(s.state)
          const isConnected = /connect/i.test(s.state)
          return (
            <div key={s.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "10px 14px", border: "1px solid var(--border-muted)", borderRadius: "var(--radius-sm)", background: "rgba(255,255,255,0.012)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                <span className="pulse-dot" style={{ background: stateColor(s.state), boxShadow: `0 0 8px ${stateColor(s.state)}` }} />
                <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                  <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>{s.name}</span>
                  <span style={{ fontSize: "10px", fontFamily: "var(--font-mono)", color: stateColor(s.state), textTransform: "uppercase" }}>
                    {s.state}{s.toolCount != null ? ` · ${s.toolCount} tools` : ""}
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                {needsAuth && (
                  <button onClick={() => handleAuth(s.name)} className="btn-premium" style={{ padding: "5px 10px", fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <KeyRound size={11} /> Authenticate
                  </button>
                )}
                {isConnected ? (
                  <button onClick={() => wrap(() => disconnectMcpServer(cfg, s.name), `Disconnected "${s.name}"`)} className="btn-secondary" style={{ padding: "5px 10px", fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <Link2Off size={11} /> Disconnect
                  </button>
                ) : (
                  <button onClick={() => wrap(() => connectMcpServer(cfg, s.name), `Connected "${s.name}"`)} className="btn-secondary" style={{ padding: "5px 10px", fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <Link2 size={11} /> Connect
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
