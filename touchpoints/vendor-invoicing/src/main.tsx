import { createRoot } from "react-dom/client";
import { sharedStorageKey } from "./embedding";
import App from "./App.tsx";
import "./index.css";

/* ── Fresh state on every browser refresh (feedback 8/13/26) ─────────
 * This is a design prototype run through back-to-back user tests: each
 * participant must start from the factory defaults. All personalization
 * (hidden KPI widgets, column layouts, saved filters, density, sidebar
 * width, module order, recents, system settings, vendor defaults) is
 * keyed under the app's own prefixes, so it's swept ONCE at boot. Within
 * a session the keys still read/write normally, so preferences keep
 * following the user across in-app navigation; only a reload resets.
 * Foreign keys on the origin (e.g. Supabase auth "sb-*") are untouched. */
const APP_STORAGE_PREFIXES = ["omnesoft:", "omne.", "vendor-invoicing-"];
try {
  for (const key of Object.keys(localStorage)) {
    if (APP_STORAGE_PREFIXES.some((p) => key.startsWith(p)) && !sharedStorageKey(key)) {
      localStorage.removeItem(key);
    }
  }
} catch {
  // localStorage unavailable (private mode / quota) — nothing to reset.
}

createRoot(document.getElementById("root")!).render(<App />);
