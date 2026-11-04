// Builds every touchpoint into dist/touchpoint-apps/<slug>/ so the main build serves them.
// Run after `vite build` (see the build:all script).
import path from "node:path";
import { isInstalled, root, run, touchpoints, viteBin } from "./touchpoints.mjs";

for (const t of touchpoints) {
  if (!isInstalled(t)) {
    console.error(`[${t.slug}] dependencies not installed (run \`npm run touchpoints:install\`)`);
    process.exit(1);
  }
  const outDir = path.join(root, "dist", "touchpoint-apps", t.slug);
  const code = await run(t.slug, viteBin(t.dir), ["build", "--base", t.base, "--outDir", outDir, "--emptyOutDir"], t.dir).done;
  if (code !== 0) process.exit(code);
}
