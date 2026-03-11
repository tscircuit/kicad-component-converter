import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tsconfigPaths from "vite-tsconfig-paths"

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  define: {
    global: "globalThis",
  },
  optimizeDeps: {
    exclude: ["@resvg/resvg-js"],
  },
  build: {
    outDir: "static-site",
    rollupOptions: {
      external: ["@resvg/resvg-js"],
    },
  },
})