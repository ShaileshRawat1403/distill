import { useState, useEffect, useCallback } from "react"
import { Server, CheckCircle2, AlertTriangle, RefreshCw, Download, Layers } from "lucide-react"

interface OllamaModel {
  name: string
  details?: {
    parameter_size?: string
    quantization_level?: string
    family?: string
  }
}

interface OllamaManagerProps {
  onModelsLoaded?: (models: string[]) => void
  selectedModel: string
  onSelectModel: (model: string) => void
}

export default function OllamaManager({ onModelsLoaded, selectedModel, onSelectModel }: OllamaManagerProps) {
  const [isConnected, setIsConnected] = useState<boolean | null>(null)
  const [models, setModels] = useState<OllamaModel[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [pullModelName, setPullModelName] = useState("")
  const [pullStatus, setPullStatus] = useState("")
  const [isPulling, setIsPulling] = useState(false)

  const checkOllamaConnection = useCallback(async () => {
    setIsLoading(true)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 2000)
    try {
      const response = await fetch("http://localhost:11434/api/tags", {
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      if (response.ok) {
        const data = await response.json()
        const fetchedModels = data.models || []
        setModels(fetchedModels)
        setIsConnected(true)
        if (onModelsLoaded) {
          onModelsLoaded(fetchedModels.map((m: OllamaModel) => m.name))
        }
        // Auto-select first model if none selected
        if (fetchedModels.length > 0 && !selectedModel) {
          onSelectModel(fetchedModels[0].name)
        }
      } else {
        setIsConnected(false)
      }
    } catch {
      clearTimeout(timeoutId)
      setIsConnected(false)
    } finally {
      setIsLoading(false)
    }
  }, [onModelsLoaded, selectedModel, onSelectModel])

  useEffect(() => {
    checkOllamaConnection()
  }, [checkOllamaConnection])

  const handlePullModel = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pullModelName.trim()) return

    setIsPulling(true)
    setPullStatus("Initiating download...")

    try {
      const response = await fetch("http://localhost:11434/api/pull", {
        method: "POST",
        body: JSON.stringify({ name: pullModelName.trim(), stream: true }),
      })

      if (!response.ok) {
        throw new Error("Failed to pull model")
      }

      const reader = response.body?.getReader()
      if (!reader) {
        setPullStatus("Model download started! Refresh to check completion.")
        setIsPulling(false)
        return
      }

      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split("\n")
        
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const progress = JSON.parse(line)
            if (progress.status === "downloading" && progress.completed && progress.total) {
              const percent = Math.round((progress.completed / progress.total) * 100)
              setPullStatus(`Downloading: ${percent}%`)
            } else if (progress.status) {
              setPullStatus(progress.status)
            }
          } catch {
            // Ignore parse errors from partial chunks
          }
        }
      }

      setPullStatus("Model successfully installed!")
      setPullModelName("")
      await checkOllamaConnection()
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error"
      setPullStatus(`Error: ${errorMsg}. Make sure Ollama is running and the model name is correct.`)
    } finally {
      setIsPulling(false)
    }
  }

  return (
    <div className="glass-card" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Server size={20} className="gradient-accent-text" />
          <h3 style={{ fontSize: "16px", fontWeight: "600", fontFamily: "var(--font-display)" }}>
            Local Ollama Engine
          </h3>
        </div>
        
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {isConnected === true ? (
            <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", color: "var(--accent-success)", fontWeight: "500" }}>
              <CheckCircle2 size={14} /> Active
            </span>
          ) : isConnected === false ? (
            <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", color: "var(--accent-warning)", fontWeight: "500" }}>
              <AlertTriangle size={14} /> Offline
            </span>
          ) : (
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Checking...</span>
          )}

          <button 
            onClick={checkOllamaConnection} 
            disabled={isLoading}
            className="btn-secondary" 
            style={{ padding: "6px", display: "flex", alignItems: "center", justifyContent: "center" }}
            title="Refresh Connection"
          >
            <RefreshCw size={12} style={{ animation: isLoading ? "spin 1s linear infinite" : "none" }} />
          </button>
        </div>
      </div>

      {isConnected === false && (
        <div style={{ background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.2)", padding: "12px", borderRadius: "var(--radius-sm)", fontSize: "13px", color: "var(--accent-warning)" }}>
          Ollama server is not running on <code>http://localhost:11434</code>. Please launch Ollama on your computer to use free local models.
        </div>
      )}

      {isConnected === true && (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "12px", fontWeight: "500", color: "var(--text-secondary)" }}>
              Installed Models ({models.length})
            </label>
            {models.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "150px", overflowY: "auto", paddingRight: "4px" }}>
                {models.map((model) => (
                  <button
                    key={model.name}
                    onClick={() => onSelectModel(model.name)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      background: selectedModel === model.name ? "rgba(168, 85, 247, 0.15)" : "rgba(255, 255, 255, 0.03)",
                      border: `1px solid ${selectedModel === model.name ? "var(--accent-primary)" : "var(--border-muted)"}`,
                      borderRadius: "var(--radius-sm)",
                      color: "var(--text-primary)",
                      cursor: "pointer",
                      fontSize: "13px",
                      textAlign: "left",
                      transition: "var(--transition-smooth)"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <Layers size={14} style={{ color: selectedModel === model.name ? "var(--accent-primary)" : "var(--text-muted)" }} />
                      <span>{model.name}</span>
                    </div>
                    {model.details?.parameter_size && (
                      <span style={{ fontSize: "10px", color: "var(--text-muted)", background: "rgba(0,0,0,0.2)", padding: "2px 6px", borderRadius: "10px" }}>
                        {model.details.parameter_size}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ color: "var(--text-muted)", fontSize: "13px", textAlign: "center", padding: "12px 0" }}>
                No local models installed. Pull a model below!
              </div>
            )}
          </div>

          <form onSubmit={handlePullModel} style={{ display: "flex", flexDirection: "column", gap: "8px", borderTop: "1px solid var(--border-muted)", paddingTop: "12px" }}>
            <label style={{ fontSize: "12px", fontWeight: "500", color: "var(--text-secondary)" }}>
              Download New Model
            </label>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                value={pullModelName}
                onChange={(e) => setPullModelName(e.target.value)}
                placeholder="e.g. llama3.2, gemma2:2b"
                disabled={isPulling}
                className="input-premium"
                style={{ flex: 1 }}
              />
              <button
                type="submit"
                disabled={isPulling || !pullModelName.trim()}
                className="btn-premium"
                style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <Download size={14} />
              </button>
            </div>
            {pullStatus && (
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
                {pullStatus}
              </div>
            )}
          </form>
        </>
      )}
    </div>
  )
}
