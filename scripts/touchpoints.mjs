// Shared helpers for running the touchpoint apps that live under /touchpoints.
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const touchpoints = JSON.parse(
  readFileSync(path.join(root, "touchpoints", "touchpoints.json"), "utf8"),
).map((t) => ({ ...t, dir: path.join(root, "touchpoints", t.slug), base: `/touchpoint-apps/${t.slug}/` }));

export const viteBin = (dir) => path.join(dir, "node_modules", ".bin", "vite");

export const isInstalled = (t) => existsSync(viteBin(t.dir));

/** Runs a command, prefixing each output line with `[name]`. Resolves with the exit code. */
export function run(name, cmd, args, cwd) {
  const child = spawn(cmd, args, { cwd, env: { ...process.env, FORCE_COLOR: "1" } });
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
