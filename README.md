# Distill

**A local-first cognitive companion & AI workspace** — capture, learning, writing, and sprint planning where *no thought is wasted, everything is semantically tagged, and it all lives in a connected knowledge graph.*

Distill runs entirely in the browser. Your notes, embeddings, and graph stay on your device (IndexedDB / OPFS). AI is optional and pluggable: local models (Ollama, WebLLM), your own cloud keys, or your real **ChatGPT / Gemini / Claude subscription** routed through a local DAX/Rook agent — no keys in the browser.

## Quick start

```bash
bun install      # this project uses bun (single lockfile: bun.lock)
bun run dev      # http://localhost:5173
bun run build    # type-check + production build
bun run test     # unit tests (vitest)
bun run typecheck
```

## Core ideas (the four pillars)

| Pillar | What it does | Where |
|---|---|---|
| **Capture** | Frictionless quick-capture (⌘/Ctrl+Shift+K) → Inbox; nothing is lost | `QuickCapture.tsx`, Inbox view in `App.tsx` |
| **Tag** | Always-on semantic tagging — offline extractive tagger + normalization, LLM as an upgrade | `utils/localTagger.ts`, `utils/autoTag.ts` |
| **Connect** | Knowledge graph from explicit `[[wikilinks]]` + embedding similarity + shared tags | `utils/knowledgeGraph.ts`, `CelestialMap.tsx` |
| **Resurface** | Semantically-nearest past notes surface as you write | `utils/semanticSearch.ts`, `RelatedThoughts.tsx` |

Plus a **GraphRAG Concept Map** (AI-extracted concepts + relations, rendered with Sigma/graphology) and a production **SDLC Kanban / sprint board** with an AI Sprint Planner.

## Architecture

- **Stack:** React 19 + TypeScript + Vite. No backend.
- **Persistence:** Dexie/IndexedDB (`src/db/index.ts`) — pages, settings, embedding vectors.
- **Embeddings:** `@xenova/transformers` MiniLM, in-browser, cached in OPFS (`utils/embeddings.ts`).
- **Graph:** edge computation is separated from rendering. `utils/knowledgeGraph.ts` emits typed edges (`link` / `semantic` / `tag`) via pluggable scorers; views only render.
- **AI providers:** `utils/ai.ts` dispatches to Ollama, OpenAI, Gemini, Groq, Anthropic, WebLLM, and **`dax`** (the DAX/Rook bridge, `utils/daxBridge.ts`).

### DAX / Rook subscription bridge

Use your ChatGPT/Gemini/Claude subscription with no API keys: run a local agent that holds your sign-in, then point Distill at it (Settings → DAX/Rook Subscription Bridge).

```bash
dax auth login            # sign in to your provider(s)
dax serve --port 4096     # expose the local gateway (CORS-enabled)
```

Distill discovers the authed models and routes prompts through the agent's session API. See `utils/daxBridge.ts`.

## Project layout

```
src/
  App.tsx                 # shell: workspace, routing, providers, capture, inbox
  db/index.ts             # Dexie persistence + localStorage→IDB migration
  utils/
    embeddings.ts         # MiniLM pipeline (lazy, OPFS-cached)
    semanticSearch.ts     # cosine search over stored vectors
    knowledgeGraph.ts     # typed edge scorers (link/semantic/tag), backlinks
    localTagger.ts        # offline keyphrase tagger + tag normalization
    autoTag.ts            # LLM tagging with local fallback
    daxBridge.ts          # DAX/Rook local agent client
    graphRag.ts           # LLM concept/relation extraction → concept graph
    ai.ts                 # provider dispatch (incl. dax)
  components/
    DocumentEditor, KanbanBoard, CelestialMap, ConceptGraph,
    QuickCapture, RelatedThoughts, …
```

## Roadmap / known follow-ups

- Storage migration to SQLite-WASM + sqlite-vec (ANN search at scale) — deferred.
- Optionally port CelestialMap onto the Sigma/graphology engine for one unified renderer.
- GraphRAG reuses a fresh DAX session per note today — reuse one session to speed up.
- Google Drive is currently a demo/mock; real access intended via an MCP server connected through DAX.

## Privacy

Everything is local by default. Cloud AI is only used if you add a key or connect the DAX bridge. No telemetry, no server.
