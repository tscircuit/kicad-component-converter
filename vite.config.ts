import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tsconfigPaths from "vite-tsconfig-paths"

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  define: {
    global: "globalThis",
  },
  build: {
    outDir: "static-site",
  },
  optimizeDeps: {
    exclude: [
      "@resvg/resvg-js",
      "@anthropic-ai/sdk",
      "bun:sqlite",
      "onnxruntime-node",
      "sharp",
    ],
  },
  ssr: {
    noExternal: [],
  },
})
