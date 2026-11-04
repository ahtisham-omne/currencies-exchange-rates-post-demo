import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";
import touchpoints from "./touchpoints/touchpoints.json";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    // Each touchpoint runs its own dev server (scripts/dev.mjs); proxy it under /touchpoint-apps/<slug>/.
    proxy: Object.fromEntries(
      touchpoints.map((t) => [`/touchpoint-apps/${t.slug}/`, { target: `http://localhost:${t.port}`, ws: true }]),
    ),
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
