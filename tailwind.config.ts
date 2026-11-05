import type { Config } from "tailwindcss";

// Tailwind v4 — token mappings live in src/styles/tailwind.css via @theme inline.
// Class detection is automatic; this file only exists so dark-mode and content
// hints can be tweaked if needed.
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: {} },
  plugins: [],
} satisfies Config;
