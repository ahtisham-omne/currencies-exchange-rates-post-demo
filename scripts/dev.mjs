// Starts the main app plus every installed touchpoint dev server.
// The main Vite server proxies /touchpoint-apps/<slug>/ to each touchpoint's port.
import { isInstalled, root, run, touchpoints, viteBin } from "./touchpoints.mjs";

const children = [];

for (const t of touchpoints) {
  if (!isInstalled(t)) {
    console.warn(`[${t.slug}] skipped: dependencies not installed (run \`npm run touchpoints:install\`)`);
    continue;
  }
  children.push(run(t.slug, viteBin(t.dir), ["--base", t.base, "--port", String(t.port), "--strictPort"], t.dir));
}

const main = run("main", viteBin(root), process.argv.slice(2), root);
children.push(main);

const stopAll = () => children.forEach((c) => c.exitCode === null && c.kill());
process.on("SIGINT", stopAll);
process.on("SIGTERM", stopAll);

process.exitCode = await main.done;
stopAll();
