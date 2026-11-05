import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    /* Port resolution: the preview harness assigns a free port via
       the PORT env var (`autoPort: true` in .claude/launch.json).
       Falls back to 8080 for plain `npm run dev` so local non-
       preview workflows still bind there by default. */
    port: process.env.PORT ? Number(process.env.PORT) : 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
  },
}));
