This folder contains the code files for the Distill app.

## What Distill is
A **local-first cognitive companion & AI workspace** (React 19 + TypeScript + Vite, no backend). Guiding vision: *no thought wasted, everything semantically tagged, all connected in a knowledge graph.* Data lives on-device (Dexie/IndexedDB; embeddings cached in OPFS). AI is optional/pluggable.

## Conventions
- **Package manager: bun.** Single lockfile `bun.lock`. Do not add `package-lock.json` (gitignored). Use `bun add` / `bun install`.
- **Verify before claiming done:** `bun run typecheck` and `bun run build` must pass; `bun run test` for the pure utils.
- **Styling:** CSS variables + classes in `src/index.css` (themeable via `[data-theme=…]`). Reuse `.glass-card` / `.liquid-glass` / `.btn-premium`. Avoid one-off hardcoded colors.
- **Graph rule:** edge *computation* lives in `utils/knowledgeGraph.ts` (pluggable scorers → typed edges); components only *render*. Add new connection signals there, not in views.
- **AI rule:** all model calls go through `utils/ai.ts` (`executePrompt` / `streamPrompt`). Provider `dax` routes through the local DAX/Rook bridge (`utils/daxBridge.ts`). Never hardcode keys or fake responses.

## Architecture map
- `src/App.tsx` — shell: workspace context, page routing (special routes: `copilot`, `arena`, `map`, `concepts`, `inbox`, `settings`), provider/model selection, quick-capture, DAX bridge connect.
- `src/db/index.ts` — Dexie tables (pages, settings, embeddings) + helpers + localStorage→IDB migration.
- `src/utils/` — `embeddings` (MiniLM), `semanticSearch` (cosine), `knowledgeGraph` (edges/backlinks), `localTagger` + `autoTag`, `daxBridge`, `graphRag` (concept extraction), `ai` (dispatch).
- `src/components/` — DocumentEditor, KanbanBoard (SDLC sprint board), CelestialMap (note graph), ConceptGraph (Sigma/graphology concept map), QuickCapture, RelatedThoughts, AEyeAssistant, WorkspaceCopilot, etc.

## Gotchas
- Embedding model (~23 MB) downloads on first use; semantic features (Related rail, Concept Map) stay quiet until it's ready, then OPFS-cached.
- Anthropic direct browser calls are CORS-limited — prefer Ollama/OpenAI/Gemini/Groq/dax in-browser.
- The DAX bridge requires the user to run `dax auth login` + `dax serve --port 4096` locally; it's CORS-enabled so the browser can call it.

## Deferred / not done
- SQLite-WASM + sqlite-vec storage migration (still on Dexie + brute-force cosine).
- Google Drive is a demo mock (real access intended via an MCP server through DAX).
