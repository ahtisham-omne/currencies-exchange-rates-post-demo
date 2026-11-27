#!/usr/bin/env node
/* Self-check a module's currencies and exchange rates before it goes to the BA.
 *
 *   node <skill>/scripts/check-currencies.mjs <module-src-dir> [--dir app/currency-kit]
 *
 * Three parts:
 *  A. KIT: every kit file matches the hash the installer wrote
 *     (kit.lock.json). An edited kit file is a fork of the shared design.
 *  B. PROBLEMS in the module's own code: patterns that have each cost a
 *     review round (a hard-coded base currency, money formatted by hand, the
 *     switch in a page header, a listing without "Show values as", ...).
 *     Heuristics: read the line before changing it; a hit is usually real.
 *  C. TRACE LIST: where each kit pattern is used, with its party and copy.
 *     Match every line to a screen in the BA's document, and every screen in
 *     the document to a line here.
 * Exit code 1 when A or B finds a problem (warnings don't fail).
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i > -1 ? args[i + 1] : undefined;
};
const positional = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1] === '--dir'));
if (!positional[0]) {
  console.error('usage: check-currencies.mjs <module-src-dir> [--dir app/currency-kit]');
  process.exit(2);
}
let src = path.resolve(positional[0]);
if (path.basename(src) !== 'src' && existsSync(path.join(src, 'src'))) src = path.join(src, 'src');
const kitDir = path.join(src, opt('--dir') ?? path.join('app', 'currency-kit'));
const posix = (p) => p.split(path.sep).join('/');
const relSrc = (f) => posix(path.relative(src, f));
const sha = (s) => createHash('sha256').update(s).digest('hex');

if (!existsSync(path.join(kitDir, 'kit.lock.json'))) {
  console.error(`check-currencies: no kit.lock.json in ${relSrc(kitDir)}. Install the kit first (install-currency-kit.mjs), or pass --dir.`);
  process.exit(2);
}

const problems = [];
const warnings = [];
const hit = (list, file, line, rule, text = '') => list.push({ file: relSrc(file), line, rule, text: text.trim().slice(0, 140) });

/* ── A. the kit ───────────────────────────────────────────────────────── */
const lock = JSON.parse(readFileSync(path.join(kitDir, 'kit.lock.json'), 'utf8'));
for (const [name, hash] of Object.entries(lock.files ?? {})) {
  const f = path.join(kitDir, name);
  if (!existsSync(f)) hit(problems, f, 0, 'kit file missing: run the installer again');
  else if (sha(readFileSync(f, 'utf8')) !== hash) hit(problems, f, 0, 'kit file edited in the module: the kit is the shared design. Move the change out, or run the installer with --force to restore it');
}
for (const n of readdirSync(kitDir)) {
  if (n === 'kit.lock.json' || lock.files?.[n]) continue;
  hit(warnings, path.join(kitDir, n), 0, 'module file inside the kit folder: keep module code outside it, so a kit update never touches it');
}

/* ── B. the module's code ─────────────────────────────────────────────── */
function walk(d, out = []) {
  for (const n of readdirSync(d)) {
    if (n === 'node_modules' || n.startsWith('.')) continue;
    const p = path.join(d, n);
    if (p === kitDir) continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?)$/.test(n) && !/\.(test|spec)\.[tj]sx?$/.test(n) && !/\.d\.ts$/.test(n)) out.push(p);
  }
  return out;
}
const uiDir = lock.uiFolder ? path.join(src, lock.uiFolder) : null;
const moduleFiles = walk(src).filter((f) => !(uiDir && f.startsWith(uiDir + path.sep)) && !/[\\/]__tests__[\\/]/.test(f));

/* Blank out comments, keeping line numbers. */
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:"'`\\])\/\/.*$/gm, (m, p1) => p1 + ' '.repeat(m.length - p1.length));

const texts = new Map(moduleFiles.map((f) => [f, stripComments(readFileSync(f, 'utf8'))]));
const usesKit = (t) => /currency-kit/.test(t);
const all = [...texts.values()].join('\n');

/* Strings the user reads: quoted literals and JSX text. */
function copyPieces(line) {
  const out = [];
  for (const m of line.matchAll(/(["'`])((?:\\.|(?!\1).)*)\1/g)) out.push(m[2]);
  for (const m of line.matchAll(/[>}]([^<>{}]+)(?=[<{])/g)) out.push(m[1]);
  return out;
}
const isImportLine = (l) => /^\s*(import|export)\b.*\bfrom\b/.test(l) || /^\s*import\s+["']/.test(l);

/* For each line, the columns that sit inside a template literal's text (so
 * an HTML string's ">${value}" isn't read as JSX writing "$" before an
 * amount). A small scanner: quotes, template text, ${ } nesting. */
function templateColumns(text) {
  const perLine = [new Set()];
  const stack = ['code'];
  const depth = [0];
  let quote = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const top = stack[stack.length - 1];
    if (c === '\n') {
      perLine.push(new Set());
      if (quote) quote = null; // an unterminated quote ends at the line
      continue;
    }
    if (top === 'tpl') {
      perLine[perLine.length - 1].add(i - text.lastIndexOf('\n', i - 1) - 1);
      if (c === '\\') i++;
      else if (c === '`') stack.pop();
      else if (c === '$' && text[i + 1] === '{') {
        stack.push('code');
        depth.push(0);
        i++;
      }
      continue;
    }
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") quote = c;
    else if (c === '`') stack.push('tpl');
    else if (c === '{') depth[depth.length - 1]++;
    else if (c === '}') {
      if (depth[depth.length - 1] === 0 && stack.length > 1) {
        stack.pop();
        depth.pop();
      } else depth[depth.length - 1]--;
    }
  }
  return perLine;
}

const RULES_BASE = [
  // A hard-coded base currency: the base is per company (getBaseCurrency()).
  [(piece) => /\bPKR\b/.test(piece), 'hard-coded "PKR": the base currency is per company. Use getBaseCurrency(), or a kit component that names it'],
  [(piece) => /₨/.test(piece), 'hard-coded "₨": format money with the kit (formatMoney, BaseMoney, DocMoney)'],
  [(piece) => /(^|[^A-Za-z])Rs\.?(\s?[\d$]|\s*$)/.test(piece), 'hard-coded "Rs": format money with the kit (formatMoney, BaseMoney, DocMoney)'],
];

for (const [file, text] of texts) {
  const lines = text.split('\n');
  const name = path.basename(file);
  const inTemplate = templateColumns(text);
  lines.forEach((l, i) => {
    if (isImportLine(l)) return;
    const pieces = copyPieces(l);
    for (const [test, rule] of RULES_BASE) if (pieces.some(test)) hit(problems, file, i + 1, rule, l);

    // Money formatted by hand. ">${x}" counts only in JSX, not in a template string's text.
    const jsxDollar = [...l.matchAll(/>\s*\$\{/g)].some((m) => !inTemplate[i]?.has(m.index));
    if (/style\s*:\s*["']currency["']/.test(l) || /Intl\.NumberFormat\([^)]*currency/.test(l))
      hit(problems, file, i + 1, 'money formatted with Intl: use the kit (formatMoney writes each currency\'s symbol and decimals)', l);
    if (/`\$\$\{/.test(l) || /["']\$["']\s*\+/.test(l) || jsxDollar)
      hit(problems, file, i + 1, 'a "$" written by hand before an amount: amounts have their own currency. Use formatMoney / Money / DocMoney', l);

    // The module's own copy of the kit.
    if (/export\s+(const|let|function)\s+(BASE_CURRENCY|CURRENCIES|formatMoney|rateSentence|moneyPrefix|midRateOn|rateOn)\b/.test(l))
      hit(problems, file, i + 1, 'the module defines its own copy of a kit export: import it from the kit instead', l);

    // UI copy rules.
    if (usesKit(text) && pieces.some((p) => /\s—\s|—/.test(p) && p.trim() !== '—'))
      hit(warnings, file, i + 1, 'em dash in UI copy: write a full stop or a comma instead', l);
    if (usesKit(text) && pieces.some((p) => /→/.test(p))) hit(warnings, file, i + 1, '"→" in UI copy: write "to"', l);
  });

  // The detail-page switch: line items toolbar, never the page header.
  lines.forEach((l, i) => {
    if (!/<DocViewSwitch\b/.test(l)) return;
    if (/header/i.test(name)) return hit(problems, file, i + 1, 'DocViewSwitch in a header file: it goes in the line items toolbar, never the page header', l);
    const before = lines.slice(0, i + 1).join('\n');
    const opens = (before.match(/<(header|[A-Z]\w*Header)\b[^>]*?(?<!\/)>/g) || []).length;
    const closes = (before.match(/<\/(header|[A-Z]\w*Header)>/g) || []).length;
    if (opens > closes) hit(problems, file, i + 1, 'DocViewSwitch inside a <header>: it goes in the line items toolbar, never the page header', l);
    if (/(List|Listing|Table|Index)\w*\.(t|j)sx$/.test(name) && !/LineItem/i.test(name))
      hit(warnings, file, i + 1, 'DocViewSwitch in what looks like a listing: listings use "Show values as" in each money column\'s menu', l);
  });

  // A switch built by hand from the kit's parts.
  lines.forEach((l, i) => {
    if (/<(CurrencyViewFrame|Segment)\b/.test(l) && usesKit(text))
      hit(warnings, file, i + 1, 'switch built from CurrencyViewFrame/Segment: use DocViewSwitch, OverviewCurrencySwitch or PrintCurrencySwitch so the copy is the shared copy', l);
    if (/role=["']radiogroup["']/.test(l) && /Base Currency/.test(lines.slice(i, i + 12).join('\n')))
      hit(problems, file, i + 1, 'a Base Currency switch built by hand: use the kit\'s switches', l);
    if (/<PrintCurrencySwitch\b/.test(l) && /send|email/i.test(name))
      hit(warnings, file, i + 1, 'PrintCurrencySwitch in a send flow: the partner always gets the document in their currency', l);
  });

  // A Radix popover inside a dialog needs modal, or the wheel won't scroll.
  if (/<Dialog(Content)?\b/.test(text)) {
    lines.forEach((l, i) => {
      if (/<Popover\b(?![^>]*\bmodal\b)/.test(l)) hit(warnings, file, i + 1, 'Popover in a file with a Dialog: add `modal`, or its list won\'t scroll inside the dialog', l);
    });
  }

  // GL Impact posts in base: never through the page's view.
  if (/(GL|Journal|Ledger)\w*\.(t|j)sx$/.test(name) || /GL Impact/.test(text)) {
    lines.forEach((l, i) => {
      if (/<DocMoney\b|useDocMoney\(/.test(l) && /(GL|Journal|Ledger)/.test(name))
        hit(warnings, file, i + 1, 'DocMoney in a GL or journal view: GL Impact stays in base whatever the switch says. Use formatMoney(amount, getBaseCurrency())', l);
    });
  }
}

// Module-wide pairings.
if (/useColumnCurrencyViews\(/.test(all) && !/<ShowValuesAsSection\b/.test(all))
  problems.push({ file: '(module)', line: 0, rule: 'useColumnCurrencyViews without ShowValuesAsSection: each money column\'s header menu needs the "Show values as" section', text: '' });
if (/<ColumnMoney\b/.test(all) && !/useColumnCurrencyViews\(/.test(all))
  warnings.push({ file: '(module)', line: 0, rule: 'ColumnMoney without useColumnCurrencyViews: keep each column\'s view per table for the session', text: '' });
if (/<DocMoney\b|useDocMoney\(|useDocView\(/.test(all) && !/<DocCurrencyProvider\b/.test(all))
  problems.push({ file: '(module)', line: 0, rule: 'DocMoney without a DocCurrencyProvider: amounts fall back to base with no rate. Wrap the document page in DocCurrencyProvider', text: '' });
if (/<DocViewSwitch\b/.test(all) && !/useDocViewOf\(/.test(all))
  problems.push({ file: '(module)', line: 0, rule: 'DocViewSwitch but nothing reads useDocViewOf(viewKey) into the provider\'s view: the switch would change nothing', text: '' });
if (/<RateTypeToggle\b/.test(all) && !/<CompareRates\b/.test(all))
  warnings.push({ file: '(module)', line: 0, rule: 'RateTypeToggle without CompareRates: sales and purchase orders put the Compare rates hover right after it', text: '' });
const setBase = [...all.matchAll(/setBaseCurrency\(/g)].length;
if (setBase > 1) warnings.push({ file: '(module)', line: 0, rule: `setBaseCurrency called ${setBase} times: set the company's base once, at start-up`, text: '' });
if (!/currency-kit/.test(all)) warnings.push({ file: '(module)', line: 0, rule: 'nothing imports the kit yet', text: '' });

/* ── C. trace list ────────────────────────────────────────────────────── */
const PATTERNS = [
  ['DocViewSwitch', /<DocViewSwitch\b([^>]*)/],
  ['OverviewCurrencySwitch', /<OverviewCurrencySwitch\b([^>]*)/],
  ['PrintCurrencySwitch', /<PrintCurrencySwitch\b([^>]*)/],
  ['ShowValuesAsSection', /<ShowValuesAsSection\b([^>]*)/],
  ['ColumnMoney', /<ColumnMoney\b([^>]*)/],
  ['EstimateMoney', /<EstimateMoney\b([^>]*)/],
  ['KpiMoney', /<KpiMoney\b([^>]*)/],
  ['DocCurrencyProvider', /<DocCurrencyProvider\b([^>]*)/],
  ['CurrencyBlock', /<CurrencyBlock\b([^>]*)/],
  ['RateTypeToggle', /<RateTypeToggle\b([^>]*)/],
  ['CompareRates', /<CompareRates\b([^>]*)/],
  ['LockLine', /<LockLine\b([^>]*)/],
  ['PayFromAccountPicker', /<PayFromAccountPicker\b([^>]*)/],
  ['BankRateField', /<BankRateField\b([^>]*)/],
  ['CurrencyPill', /<CurrencyPill\b([^>]*)/],
  ['CurrencyCodeCell', /<CurrencyCodeCell\b([^>]*)/],
  ['documentFx', /documentFx\(\{([^}]*)/],
];
const trace = new Map(PATTERNS.map(([n]) => [n, []]));
for (const [file, text] of texts) {
  text.split('\n').forEach((l, i) => {
    for (const [n, re] of PATTERNS) {
      const m = l.match(re);
      if (!m) continue;
      const attrs = (m[1] ?? '').match(/\b(party|documentNoun|recordNoun|dateLabel|label|locksWhen|lockedWhen|role|rateType)=?\s*:?\s*["'{]([^"'}]+)["'}]/g) ?? [];
      trace.get(n).push(`${relSrc(file)}:${i + 1}${attrs.length ? '  ' + attrs.join(' ') : ''}`);
    }
  });
}

/* ── report ───────────────────────────────────────────────────────────── */
const kitProblems = problems.filter((p) => p.file.startsWith(relSrc(kitDir)));
const codeProblems = problems.filter((p) => !p.file.startsWith(relSrc(kitDir)));
const show = (p) => console.log(`   ${p.file}${p.line ? ':' + p.line : ''}  ${p.rule}${p.text ? '\n      ' + p.text : ''}`);

console.log(`\nOMNE currency kit ${lock.version} in ${relSrc(kitDir)} · ${moduleFiles.length} module files checked`);
console.log(`\nA. Kit (${kitProblems.length})`);
if (!kitProblems.length) console.log(`   all ${Object.keys(lock.files ?? {}).length} kit files match kit.lock.json`);
kitProblems.forEach(show);
console.log(`\nB. Problems (${codeProblems.length})`);
if (!codeProblems.length) console.log('   none found');
codeProblems.forEach(show);
console.log(`\n   Worth a look (${warnings.length})`);
if (!warnings.length) console.log('   none');
warnings.forEach(show);
console.log(`\nC. Trace every line to a screen in the BA's document, and every screen to a line. Not in the document = take it out.`);
for (const [n, xs] of trace) console.log(`   ${n} (${xs.length})${xs.length ? '\n      ' + xs.join('\n      ') : ''}`);
console.log(`\nThen walk references/checklist.md in the browser.\n`);
process.exit(problems.length ? 1 : 0);
