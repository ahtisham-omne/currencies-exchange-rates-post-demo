import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import tailwindcss from "@tailwindcss/vite";

// https://vitejs.dev/config/
//
// `lovable-tagger` is intentionally omitted: its peer dep is `vite >=5 <8`,
// but we're on Vite 8. It only runs in dev mode, so its incompatibility
// surfaces as a dev-mode blank screen while production builds pass.
// Re-add when an updated `lovable-tagger` ships with Vite 8 support.
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
