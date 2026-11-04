// Installs dependencies for every touchpoint app, in parallel.
import { run, touchpoints } from "./touchpoints.mjs";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const codes = await Promise.all(
  touchpoints.map((t) => run(t.slug, npm, ["install", "--legacy-peer-deps", "--no-audit", "--no-fund"], t.dir).done),
);
process.exitCode = codes.some((c) => c !== 0) ? 1 : 0;
