import { fileURLToPath } from 'url';
import { dirname } from 'path';
const here = dirname(fileURLToPath(import.meta.url));
process.chdir(here);
// The preview harness assigns a free port via the PORT env var (autoPort).
// Forward it to vite EXPLICITLY here so we never fall back to a hardcoded
// 8080 that could collide with another chat's dev server. Plain local
// `node run-dev.mjs` (no PORT) uses vite.config.ts's 8080 default.
const args = ['vite', '--host', '127.0.0.1'];
if (process.env.PORT) args.push('--port', String(process.env.PORT));
process.argv = [process.argv[0], ...args];
await import('./node_modules/vite/bin/vite.js');
