#!/usr/bin/env node
/* Check a "Currencies & Exchange Rates: <Module>" document is complete
 * before it goes to the designer.
 *
 *   node <skill>/scripts/check-doc.mjs <document.md> [--template]
 *
 * The designer's skill runs the same check and sends back a document that
 * fails it, so passing here saves a round trip. It checks the structure,
 * every screen's fields, the rulings that are easy to get wrong (the switch
 * in a header, a listing without "Show values as", KPIs not in base) and the
 * open questions a module usually owes. It cannot check that a screen or a
 * label is really in the prototype: that is the BA's job (see the trace it
 * prints).
 * --template checks only the structure, for the blank template itself.
 * Exit code 1 when something required is missing.
 */
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const templateMode = args.includes('--template');
if (!file) {
  console.error('usage: check-doc.mjs <document.md> [--template]');
  process.exit(2);
}
const raw = readFileSync(file, 'utf8');
// Code fences and HTML comments are examples, not the document.
const stripped = raw.replace(/```[\s\S]*?```/g, (m) => m.replace(/[^\n]/g, ' ')).replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
// The template's own <placeholders> stand for their content in --template mode.
const text = templateMode ? stripped.replace(/<([A-Z][^<>\n]*)>/g, '$1') : stripped;
const problems = [];
const warn = [];

/* ── the frame ────────────────────────────────────────────────────────── */
const title = (text.match(/^#\s+Currencies & Exchange Rates:\s*(.+)$/m) || [])[1];
if (!title) problems.push('title should read "# Currencies & Exchange Rates: <Module>"');
const SECTIONS = ['Sources', 'Rulings this document follows', 'The module at a glance', 'Screens', 'FX gain and loss', 'Activity log', 'Open questions'];
const sectionBody = (name) => {
  const m = text.match(new RegExp(`^##\\s+${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'm'));
  if (!m) return null;
  const rest = text.slice(m.index + m[0].length);
  const next = rest.search(/^##\s+/m);
  return next === -1 ? rest : rest.slice(0, next);
};
for (const s of SECTIONS) if (sectionBody(s) == null) problems.push(`no "## ${s}" section`);

/* ── at a glance ──────────────────────────────────────────────────────── */
const glance = sectionBody('The module at a glance') ?? '';
const glanceRows = Object.fromEntries(
  glance
    .split('\n')
    .filter((l) => /^\|.*\|\s*$/.test(l) && !/^\|\s*-/.test(l))
    .map((l) => l.trim().slice(1, -1).split('|').map((c) => c.trim()))
    .filter((r) => r.length >= 2)
    .map((r) => [r[0].toLowerCase(), r[1]]),
);
const GLANCE = ['Base currency', 'Party', 'Document currency', 'Rate type', 'Rate date', 'Locks', 'Pay from / receive into', 'FX gain or loss'];
for (const g of GLANCE) {
  const v = glanceRows[g.toLowerCase()];
  if (v == null) problems.push(`at a glance: no "${g}" row`);
  else if (!v) problems.push(`at a glance: "${g}" has no answer`);
}
if (glanceRows['base currency'] && /\bset (it|the base) (per|in this) module\b|module setting/i.test(glanceRows['base currency']) && !/never/i.test(glanceRows['base currency']))
  problems.push('at a glance: the base currency is per company (R1), never a module setting');

/* ── screens ──────────────────────────────────────────────────────────── */
const screensBody = sectionBody('Screens') ?? '';
const parts = screensBody.split(/^###\s+Screen\s+/m).slice(1);
if (!parts.length) problems.push('no screens: each reads "### Screen <n>: <name>"');
const KINDS = ['Listing', 'KPIs', 'Detail page', 'Create/edit', 'Print', 'Configuration dialog', 'Activity log', 'Other'];
const FIELDS = ['Kind', 'Where', 'Amounts', 'Switch', 'Show values as', 'Currency column', 'Rate', 'Lock', 'Pay from', 'FX gain/loss', 'Copy'];
const DATE_WORD = /\b(document|PO|order|quote|posting|payment|receiving|invoice|return) date\b|\btoday\b|two amounts|completes|own rate|the day it/i;
const NONE = /^(none|no\b|not applicable|n\/a)/i;
const field = (body, name) => {
  const m = body.match(new RegExp(`^\\s*\\*\\*${name.replace(/[/]/g, '\\/')}\\*\\*[ \\t]*(.*)$`, 'm'));
  return m ? m[1].trim() : null;
};
const summary = [];
let anyPayFrom = false;
for (const part of parts) {
  const head = part.split('\n')[0].trim();
  const id = `Screen ${head}`;
  for (const f of FIELDS) {
    const v = field(part, f);
    if (v == null) problems.push(`${id}: no **${f}**`);
    else if (!v && f !== 'Amounts') problems.push(`${id}: **${f}** is empty; write "None" or "Not applicable" with a reason`);
  }
  const kind = field(part, 'Kind') ?? '';
  const kindName = KINDS.find((k) => kind.toLowerCase().startsWith(k.toLowerCase()));
  if (kind && !kindName) problems.push(`${id}: Kind "${kind}" is not one of ${KINDS.join(', ')}`);

  // The amounts table.
  const amountsAt = part.search(/^\s*\*\*Amounts\*\*/m);
  const afterAmounts = amountsAt > -1 ? part.slice(amountsAt).split('\n').slice(1) : [];
  const tableLines = [];
  for (const l of afterAmounts) {
    if (/^\s*$/.test(l) && !tableLines.length) continue;
    if (/^\|/.test(l.trim())) tableLines.push(l.trim());
    else break;
  }
  const rows = tableLines.filter((l) => !/^\|\s*-/.test(l)).map((l) => l.slice(1, -1).split('|').map((c) => c.trim()));
  const header = rows.shift() ?? [];
  const shownCol = header.findIndex((h) => /shown in/i.test(h));
  const amountsNone = /^\s*\*\*Amounts\*\*\s+(None|No money)/im.test(part);
  if (!rows.length && !amountsNone && kindName !== 'Activity log') problems.push(`${id}: no Amounts table (Amount | Shown in | Hover | Estimate), or "**Amounts** None" with why`);
  if (rows.length && shownCol === -1) problems.push(`${id}: the Amounts table has no "Shown in" column`);

  const sw = field(part, 'Switch') ?? '';
  const sva = field(part, 'Show values as') ?? '';
  const rate = field(part, 'Rate') ?? '';
  const lock = field(part, 'Lock') ?? '';
  const pay = field(part, 'Pay from') ?? '';
  const copy = field(part, 'Copy') ?? '';
  if (pay && !NONE.test(pay)) anyPayFrom = true;

  // Where the switch goes (R7).
  if (/\bheader\b/i.test(sw) && !/\b(never|not)\b[^.]*\bheader\b/i.test(sw))
    problems.push(`${id}: the switch is in the header. Detail pages put it in the line items toolbar, never the header (R7)`);
  if (kindName === 'Detail page' && sw && !NONE.test(sw) && !/toolbar|card/i.test(sw))
    warn.push(`${id}: say where the switch sits: the line items toolbar, or the first card that lists the document's money (R7)`);
  if (kindName === 'Detail page' && rows.some((r) => /\bGL\b|journal/i.test(r[0] ?? '') && shownCol > -1 && !/base/i.test(r[shownCol] ?? '')))
    problems.push(`${id}: GL Impact stays in base whatever the switch shows (R7)`);

  // Listings (R5, R6).
  if (kindName === 'Listing') {
    if (sw && !NONE.test(sw)) problems.push(`${id}: a listing gets no switch; each money column's menu gets "Show values as" (R5)`);
    if (NONE.test(sva) && !/no money columns|R6|own currency/i.test(sva))
      problems.push(`${id}: a listing with money columns needs "Show values as" on each (R5), or say "No money columns", or cite R6`);
    if (/^no\b/i.test(field(part, 'Currency column') ?? '') && !/because|R\d|why/i.test(field(part, 'Currency column') ?? ''))
      warn.push(`${id}: every listing has a Currency column (R5); say why this one doesn't`);
  }
  // KPIs (R3, R4).
  if (kindName === 'KPIs' && shownCol > -1)
    for (const r of rows) if (!/base/i.test(r[shownCol] ?? '')) problems.push(`${id}: KPI "${r[0]}" is not in base. KPIs are in base; a record's own currency is only an extra (R3, R4)`);
  // Print (R22).
  if (kindName === 'Print') {
    if (!/base currency/i.test(sw)) warn.push(`${id}: the print preview has "Base Currency | <Party> Currency" (R22)`);
    if (!/All amounts in/i.test(copy)) warn.push(`${id}: give the footnote: "All amounts in ..." (R22)`);
  }
  // Configuration dialog (R11, R15, R17).
  if (kindName === 'Configuration dialog') {
    if (NONE.test(lock)) warn.push(`${id}: a configuration dialog says when its rate locks (R11, R15)`);
    if (!/rate info|info icon|both rates/i.test(part) && /vendor|customer/i.test(glanceRows['party'] ?? ''))
      warn.push(`${id}: put the rate info icon (both rates, R17) after the rate type choice`);
  }
  // Rate day (R14).
  if (rate && !NONE.test(rate) && !DATE_WORD.test(rate)) warn.push(`${id}: Rate names no day (document date, posting date, payment date, today...) (R14)`);
  if (['Configuration dialog', 'Create/edit'].includes(kindName ?? '') && rate && !/daily market|corporate|company default|rate type/i.test(rate))
    warn.push(`${id}: Rate names no rate type (daily market rate, corporate rate, or the company default) (R13)`);
  if (/mid-?market/i.test(part)) warn.push(`${id}: says "mid-market": the rate is the "daily market rate" (R26, Eli 26 Nov 2026)`);

  // Copy (R26).
  for (const q of copy.match(/"[^"]*"/g) ?? []) {
    if (/—/.test(q)) problems.push(`${id}: em dash in UI copy ${q}; write a full stop or a comma (R26)`);
    if (/→/.test(q)) warn.push(`${id}: "→" in UI copy ${q}; write "to" (R26)`);
  }
  summary.push(`${head} · ${kindName ?? '?'} · switch: ${sw || '?'} · show values as: ${sva || '?'}`);
}

/* ── the rest ─────────────────────────────────────────────────────────── */
const rulings = sectionBody('Rulings this document follows') ?? '';
if (!/\bR\d+\b/.test(rulings)) warn.push('Rulings cites no rule from rules.md by number (R1 to R28)');
const activity = sectionBody('Activity log') ?? '';
if (activity && !/Activity Logs:|no activity|nothing is logged|doesn.t exist yet/i.test(activity)) warn.push('Activity log: name the module\'s "Activity Logs: <Module>" document, or say it doesn\'t exist yet');
const fx = sectionBody('FX gain and loss') ?? '';
if (fx && !/\|/.test(fx) && !/^\s*None/im.test(fx)) warn.push('FX gain and loss: a table of postings, or "None: this module never books"');

const oq = sectionBody('Open questions') ?? '';
if (sectionBody('Open questions') != null && !oq.trim()) problems.push('Open questions is empty; if nothing is open, write "None"');
const oqHas = (re) => re.test(oq);
if (anyPayFrom && !oqHas(/book balance/i)) warn.push('a screen names a pay-from account: list P2 (whether the buyer sees the account\'s book balance) under Open questions');
if (/FX variance/i.test(screensBody) && !oqHas(/FX variance/i)) warn.push('the document shows an FX variance: list P3 (which date it uses) under Open questions');
if (/\b(unit price|price per unit|selling price|item price|regional)\b/i.test(screensBody) && !oqHas(/regional/i)) warn.push('the document shows item prices: list P1 (regional item prices, waiting on Eli) under Open questions');
if (/mark as paid/i.test(screensBody) && !oqHas(/3\.5|mark as paid/i)) warn.push('the document has Mark as paid: list P4 (spec 3.5, corporate-only rate changes) under Open questions');

// Unfilled template text.
if (!templateMode) {
  const left = [...text.matchAll(/<(?!\/?(br|b|i|em|strong|code)\b)[A-Za-z][^<>\n]{0,80}>/g)].map((m) => m[0]);
  if (left.length) problems.push(`${left.length} unfilled placeholder${left.length === 1 ? '' : 's'} from the template: ${[...new Set(left)].slice(0, 6).join(' · ')}${left.length > 6 ? ' …' : ''}`);
}

console.log(`\n${file}: ${title ? `"${title.trim()}", ` : ''}${parts.length} screen${parts.length === 1 ? '' : 's'}${templateMode ? ' (template mode: structure only)' : ''}`);
console.log(`\nMissing (${problems.length})`);
console.log(problems.length ? problems.map((p) => '   ' + p).join('\n') : '   none');
if (templateMode) warn.length = 0;
console.log(`\nWorth a look (${warn.length})${templateMode ? ' (content checks skipped)' : ''}`);
console.log(warn.length ? warn.map((p) => '   ' + p).join('\n') : '   none');
if (summary.length) console.log(`\nScreens\n${summary.map((s) => '   ' + s).join('\n')}`);
console.log(`\nTrace: check every screen, label and amount against the current prototype before sending.\n`);
process.exit(problems.length ? 1 : 0);
