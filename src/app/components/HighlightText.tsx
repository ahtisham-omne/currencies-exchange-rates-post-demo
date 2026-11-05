/* Re-export shim — keeps the import path `@/app/components/HighlightText`
   aligned between the Quote and SO repos. The actual implementation lives
   under `shared/` in this module; Quote keeps it at the root. The shim
   removes a per-module branch from every consumer that pulls the
   yellow-highlight span. */
export { HighlightText } from "./shared/HighlightText";
