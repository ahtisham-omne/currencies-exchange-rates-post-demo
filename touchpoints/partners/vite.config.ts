import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  /* react-is is CommonJS and only reached from lazily loaded routes (the
     partner detail page's charts), so the optimizer can miss it and serve it
     raw, which breaks its named exports ("does not provide an export named
     isFragment"). Pre-bundle it up front. */
  optimizeDeps: {
    include: ["react-is"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
