import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  // sqlite-wasm ships its own .wasm + loader; don't let Vite pre-bundle it.
  optimizeDeps: {
    exclude: ["@sqlite.org/sqlite-wasm"],
  },
})
