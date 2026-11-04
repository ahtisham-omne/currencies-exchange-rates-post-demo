// Builds every touchpoint into public/touchpoint-apps/<slug>/, the copy the main app
// serves as static files - locally without the live servers, on Lovable, and in the
// main build (vite copies public/ into dist). Run after changing a touchpoint, then
// commit the rebuilt copy with the source change.
import { writeFileSync } from "node:fs";
import path from "node:path";
import { HASH_FILE, isInstalled, run, sourceHash, touchpoints, viteBin } from "./touchpoints.mjs";

// `npm run touchpoints:build -- vendor-invoicing` builds just the named ones.
const only = process.argv.slice(2);
const unknown = only.filter((slug) => !touchpoints.some((t) => t.slug === slug));
if (unknown.length) {
  console.error(`Unknown touchpoint: ${unknown.join(", ")} (see touchpoints/touchpoints.json)`);
  process.exit(1);
}

for (const t of touchpoints.filter((t) => only.length === 0 || only.includes(t.slug))) {
  if (!isInstalled(t)) {
    console.error(`[${t.slug}] dependencies not installed (run \`npm run touchpoints:install\`)`);
    process.exit(1);
  }
  const code = await run(t.slug, viteBin(t.dir), ["build", "--base", t.base, "--outDir", t.builtDir, "--emptyOutDir"], t.dir).done;
  if (code !== 0) process.exit(code);
  writeFileSync(path.join(t.builtDir, HASH_FILE), sourceHash(t) + "\n");
}
