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
    // A touchpoint whose dev server scripts/dev.mjs started (it lists them in
    // TOUCHPOINTS_LIVE) is proxied under /touchpoint-apps/<slug>/, with hot reload.
    // Every other touchpoint is served from its built copy in public/touchpoint-apps
    // (npm run touchpoints:build), which is also all a host like Lovable runs.
    proxy: Object.fromEntries(
      touchpoints
        .filter((t) => (process.env.TOUCHPOINTS_LIVE ?? "").split(",").includes(t.slug))
        .map((t) => [`/touchpoint-apps/${t.slug}/`, { target: `http://localhost:${t.port}`, ws: true }]),
    ),
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
