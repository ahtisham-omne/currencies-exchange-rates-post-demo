// Starts the main app plus every installed touchpoint dev server.
// The main Vite server proxies /touchpoint-apps/<slug>/ to each touchpoint started
// here (named in TOUCHPOINTS_LIVE); the rest are served from their built copies.
import { builtHash, isInstalled, root, run, sourceHash, touchpoints, viteBin } from "./touchpoints.mjs";

const children = [];
const live = [];

for (const t of touchpoints) {
  if (!isInstalled(t)) {
    console.warn(`[${t.slug}] not installed, serving its built copy (run \`npm run touchpoints:install\` for live editing)`);
    continue;
  }
  // The built copy is what Lovable and any deploy show, so flag one that lags its source.
  if (builtHash(t) !== sourceHash(t)) {
    console.warn(`[${t.slug}] built copy is out of date: run \`npm run touchpoints:build\` and commit public/touchpoint-apps/${t.slug}`);
  }
  children.push(run(t.slug, viteBin(t.dir), ["--base", t.base, "--port", String(t.port), "--strictPort"], t.dir));
  live.push(t.slug);
}

const main = run("main", viteBin(root), process.argv.slice(2), root, { TOUCHPOINTS_LIVE: live.join(",") });
children.push(main);

const stopAll = () => children.forEach((c) => c.exitCode === null && c.kill());
process.on("SIGINT", stopAll);
process.on("SIGTERM", stopAll);

process.exitCode = await main.done;
stopAll();
