/* Plain ESM, no TypeScript: the CSV template and the companion Guide txt,
 * in the User Access Control format. Shared by the app (`templateCsv.ts`)
 * and the Node generator (`scripts/gen-import-templates.mjs`). */

import { templateHeaders } from "./templateLayout.mjs";

/* ───────── CSV ───────── */

/** RFC-4180: quote only when needed, double internal quotes. */
export function csvCell(value) {
  const v = String(value ?? "");
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** UTF-8 (no BOM), LF line endings, trailing newline, header + two example rows. */
export function buildTemplateCsv(data) {
  const rows = [templateHeaders(data), ...data.examples];
  return rows.map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
}

/* ───────── Guide txt ───────── */

export const GUIDE_WIDTH = 66;
const BANNER_LINE = "=".repeat(GUIDE_WIDTH);
const DIVIDER = "-".repeat(GUIDE_WIDTH);

/** Greedy word wrap to `width` columns. Never splits a word. */
export function wrap(text, width = GUIDE_WIDTH) {
  const words = String(text ?? "").split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = "";
  for (const w of words) {
    if (!cur) cur = w;
    else if (cur.length + 1 + w.length <= width) cur += ` ${w}`;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Longest label that still shares its line with the description. */
const MAX_INLINE_LABEL = 40;
/** Widest label column that gets padded for alignment. */
const MAX_PADDED_LABEL = 24;

/** "Label  description" with continuation lines aligned under the description.
 *  A label longer than MAX_INLINE_LABEL goes on its own line, body below it
 *  indented by two spaces, so no line ever exceeds the 66-column width. */
function labeled(label, body, indent = "", gap = 2) {
  if (label.trimEnd().length > MAX_INLINE_LABEL) {
    const inner = `${indent}  `;
    return [`${indent}${label.trimEnd()}`, ...wrap(body, GUIDE_WIDTH - inner.length).map((l) => inner + l)];
  }
  const prefix = `${indent}${label}${" ".repeat(gap)}`;
  const width = Math.max(20, GUIDE_WIDTH - prefix.length);
  const lines = wrap(body, width);
  if (lines.length === 0) return [prefix.trimEnd()];
  return lines.map((l, i) => (i === 0 ? prefix + l : " ".repeat(prefix.length) + l));
}

/** Aligned label column: labels padded to the widest one in the group, as
 *  long as that width is reasonable; wider labels are simply not padded. */
function labeledGroup(items, indent = "  ") {
  const widest = Math.max(...items.map(([l]) => l.length));
  const w = widest <= MAX_PADDED_LABEL ? widest : Math.min(widest, MAX_PADDED_LABEL);
  const out = [];
  for (const [label, body] of items) {
    out.push(...labeled(label.length <= w ? label.padEnd(w) : label, body, indent, 3));
  }
  return out;
}

function section(title) {
  return [DIVIDER, title, DIVIDER, ""];
}

function subHeader(title) {
  return [title, "-".repeat(title.length)];
}

/** A heading that must fit on one 66-column line (sub-headers are not wrapped). */
function shortHeading(h) {
  if (h.length <= GUIDE_WIDTH) return h;
  const cut = h.indexOf(" (");
  return cut > 0 ? h.slice(0, cut) : h.slice(0, GUIDE_WIDTH);
}

export function buildGuideText(data) {
  const L = [];
  L.push(BANNER_LINE, `Omne ${data.entity} Import Guide`, data.moduleLine, BANNER_LINE, "");
  for (const p of data.guide.intro) L.push(...wrap(p), "");
  L.push("");

  /* QUICK START */
  L.push(...section("Quick Start"));
  const steps = data.guide.quickStart ?? data.instructions.quickStart;
  steps.forEach((t, i) => {
    L.push(...labeled(`Step ${i + 1}`, t, "", 3), "");
  });
  L.push("");

  /* HOW <ENTITIES> ARE MATCHED */
  const matched = data.instructions.sections.find((s) => /matched/i.test(s.heading));
  if (matched) {
    L.push(...section(matched.heading));
    if (matched.intro) L.push(...wrap(matched.intro), "");
    for (const ms of data.guide.matchedSections) {
      L.push(...subHeader(ms.title));
      L.push(...wrap(ms.lead), "");
      L.push(...labeledGroup(ms.items), "");
    }
    L.push("");
  }

  /* COPYING FROM ANOTHER SYSTEM + FILE LIMITS + IMPORTANT NOTES */
  const copying = data.instructions.sections.find((s) => /copying/i.test(s.heading));
  if (copying?.intro) L.push(...section(copying.heading), ...wrap(copying.intro), "", "");
  const notes = data.instructions.sections.find((s) => /important notes/i.test(s.heading));
  const fileLimits = notes?.items?.find(([l]) => l === "File Limits");
  if (fileLimits) L.push(...section("File Limits"), ...wrap(fileLimits[1]), "", "");
  if (notes?.items?.length) {
    const rest = notes.items.filter(([l]) => l !== "File Limits");
    L.push(...section("Important Notes"));
    for (const [label, body] of rest) L.push(...labeled(label, body), "");
    L.push("");
  }

  /* FIELD REFERENCE */
  L.push(...section("Field Reference"));
  const byKey = new Map(data.columns.map((c) => [c.key, c]));
  for (const g of data.guide.fieldGroups) {
    L.push(...subHeader(g.title), "");
    for (const k of g.keys) {
      const c = byKey.get(k);
      if (!c) continue;
      L.push(...labeled(c.label, c.description), "");
    }
  }
  L.push("");

  /* VALID VALUES (skip the first "new vs existing" block, mirrored from UAC) */
  L.push(...section("Valid Values"));
  data.validValues.slice(1).forEach((block, i, arr) => {
    L.push(...subHeader(shortHeading(block.heading)));
    if (block.rows?.length) L.push(...labeledGroup(block.rows, ""));
    if (block.note) L.push(...wrap(block.note));
    if (i < arr.length - 1) L.push("");
  });
  L.push("");

  return L.join("\n");
}
