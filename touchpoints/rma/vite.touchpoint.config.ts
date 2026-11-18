/* The shell's Vite config for this app (see src/embedding.ts), named in the
 * shell's touchpoints/touchpoints.json. vite.config.ts, as the design repo
 * ships it, builds a TanStack Start server; the shell serves every module as
 * static files from public/touchpoint-apps/<slug>/, so it runs and builds
 * this one as a single-page app: index.html → src/touchpoint.tsx, with the
 * React, Tailwind and "@/" path setup the Lovable config gives the app. */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    tsconfigPaths: true,
    dedupe: ["react", "react-dom", "@tanstack/react-router", "@tanstack/react-query"],
  },
});
