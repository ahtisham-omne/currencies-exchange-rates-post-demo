// Shared helpers for running the touchpoint apps that live under /touchpoints.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/* Each touchpoint's built copy lives in public/touchpoint-apps/<slug>/, so the main
   app serves it as static files wherever it runs (locally, Lovable, any host). */
export const touchpoints = JSON.parse(
  readFileSync(path.join(root, "touchpoints", "touchpoints.json"), "utf8"),
).map((t) => ({
  ...t,
  dir: path.join(root, "touchpoints", t.slug),
  base: `/touchpoint-apps/${t.slug}/`,
  builtDir: path.join(root, "public", "touchpoint-apps", t.slug),
}));

export const viteBin = (dir) => path.join(dir, "node_modules", ".bin", "vite");

export const isInstalled = (t) => existsSync(viteBin(t.dir));

/** Written beside a built copy: the fingerprint of the source it was built from. */
export const HASH_FILE = ".source-hash";

/** A fingerprint of a touchpoint's source (everything but installs and build output). */
export function sourceHash(t) {
  const hash = createHash("sha1");
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (["node_modules", "dist", ".git"].includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) hash.update(path.relative(t.dir, full)).update(readFileSync(full));
    }
  };
  walk(t.dir);
  return hash.digest("hex");
}

/** The fingerprint the built copy was made from, or null when there is none. */
export function builtHash(t) {
  const file = path.join(t.builtDir, HASH_FILE);
  return existsSync(file) ? readFileSync(file, "utf8").trim() : null;
}

/** Runs a command, prefixing each output line with `[name]`. Resolves with the exit code. */
export function run(name, cmd, args, cwd, env = {}) {
  const child = spawn(cmd, args, { cwd, env: { ...process.env, FORCE_COLOR: "1", ...env } });
  const prefix = (stream, out) => {
    let buffered = "";
    stream.on("data", (chunk) => {
      const lines = (buffered + chunk).split("\n");
      buffered = lines.pop();
      for (const line of lines) out.write(`[${name}] ${line}\n`);
    });
    stream.on("end", () => buffered && out.write(`[${name}] ${buffered}\n`));
  };
  prefix(child.stdout, process.stdout);
  prefix(child.stderr, process.stderr);
  child.done = new Promise((resolve) => child.on("close", (code) => resolve(code ?? 1)));
  return child;
}
