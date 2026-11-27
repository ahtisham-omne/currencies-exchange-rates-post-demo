#!/usr/bin/env node
/* Install OMNE's shared currency kit into a module's app.
 *
 *   node <skill>/scripts/install-currency-kit.mjs <module-src-dir> [--force] [--dir app/currency-kit]
 *
 * <module-src-dir> is the module's src folder (the repo root works too).
 * Re-runnable. What it does:
 *  1. Finds the module's shadcn ui folder (the one holding tooltip.tsx,
 *     hover-card.tsx and popover.tsx) and stops if one is missing, with the
 *     command that adds it.
 *  2. Copies every kit file to <src>/app/currency-kit/ (or --dir, relative to
 *     src), pointing its ui imports at that folder.
 *  3. Writes kit.lock.json: the kit version and each file's hash. The check
 *     script compares against it, so an edited kit file is caught.
 *  4. Refuses to overwrite a kit file that was changed in the module (its
 *     hash differs from the lock), or a file of the same name it didn't
 *     install, unless --force. Nothing is written when it refuses.
 *  5. Checks the packages the kit imports and the Tailwind content globs, and
 *     says where flags come from.
 * It prints what it did and anything it could not do.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath, not new URL().pathname: the plugin may live under a path
// with spaces ("Application Support"), which a URL path keeps as %20.
const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KIT = path.join(SKILL, 'assets', 'kit');

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => {
  const i = args.indexOf(name);
  return i > -1 ? args[i + 1] : undefined;
};
const positional = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1] === '--dir'));
if (!positional[0]) fail('usage: install-currency-kit.mjs <module-src-dir> [--force] [--dir app/currency-kit]');

let src = path.resolve(positional[0]);
if (!existsSync(src)) fail(`no such folder: ${src}`);
if (path.basename(src) !== 'src' && existsSync(path.join(src, 'src'))) src = path.join(src, 'src');
const repo = findUp(src, 'package.json') ?? path.dirname(src);
const dest = path.join(src, opt('--dir') ?? path.join('app', 'currency-kit'));
const force = flag('--force');

const sha = (s) => createHash('sha256').update(s).digest('hex');
const posix = (p) => p.split(path.sep).join('/');

function walk(d, out = []) {
  for (const n of readdirSync(d)) {
    if (n === 'node_modules' || n.startsWith('.')) continue;
    const p = path.join(d, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
function findUp(from, name) {
  let d = from;
  for (;;) {
    if (existsSync(path.join(d, name))) return d;
    const up = path.dirname(d);
    if (up === d) return null;
    d = up;
  }
}

/* 1. the ui folder */
const NEEDED = {
  tooltip: ['Tooltip', 'TooltipTrigger', 'TooltipContent'],
  'hover-card': ['HoverCard', 'HoverCardTrigger', 'HoverCardContent'],
  popover: ['Popover', 'PopoverTrigger', 'PopoverContent'],
};
const files = walk(src).filter((f) => !f.startsWith(dest + path.sep));
const uiDirs = [...new Set(files.filter((f) => /[\\/]components[\\/]ui[\\/][^\\/]+\.tsx$/.test(f)).map((f) => path.dirname(f)))];
const score = (d) => Object.keys(NEEDED).filter((n) => existsSync(path.join(d, `${n}.tsx`))).length * 10 + (posix(d).endsWith('app/components/ui') ? 1 : 0);
uiDirs.sort((a, b) => score(b) - score(a));
const uiDir = uiDirs[0];
if (!uiDir) fail(`no components/ui folder under ${src}. Add shadcn/ui first: npx shadcn@latest add tooltip hover-card popover`);
if (uiDirs.length > 1) console.warn(`  note: ${uiDirs.length} components/ui folders; using ${posix(path.relative(src, uiDir))}`);
const missingUi = [];
for (const [name, exportsWanted] of Object.entries(NEEDED)) {
  const f = path.join(uiDir, `${name}.tsx`);
  if (!existsSync(f)) {
    missingUi.push(name);
    continue;
  }
  const text = readFileSync(f, 'utf8');
  const lacking = exportsWanted.filter((e) => !new RegExp(`\\b${e}\\b`).test(text));
  if (lacking.length) missingUi.push(`${name} (no ${lacking.join(', ')})`);
}
if (missingUi.length) fail(`the ui folder ${posix(path.relative(src, uiDir))} lacks ${missingUi.join(', ')}. Add them: npx shadcn@latest add ${missingUi.map((m) => m.split(' ')[0]).join(' ')}`);

/* 2. what each kit file becomes in this module */
const rel = posix(path.relative(dest, uiDir));
const uiImport = rel.startsWith('.') ? rel : `./${rel}`;
const rewrite = (s) => s.replace(/(["'])@\/app\/components\/ui\//g, `$1${uiImport}/`);
const kitFiles = readdirSync(KIT).filter((f) => /\.(ts|tsx)$/.test(f)).sort();
const pkgKit = JSON.parse(readFileSync(path.join(SKILL, '..', '..', '.claude-plugin', 'plugin.json'), 'utf8'));
const planned = kitFiles.map((name) => {
  const text = rewrite(readFileSync(path.join(KIT, name), 'utf8'));
  return { name, text, hash: sha(text) };
});

/* 3. what's there now */
const lockFile = path.join(dest, 'kit.lock.json');
const lock = existsSync(lockFile) ? JSON.parse(readFileSync(lockFile, 'utf8')) : null;
const refused = [];
const actions = [];
for (const p of planned) {
  const at = path.join(dest, p.name);
  if (!existsSync(at)) {
    actions.push([p, 'added']);
    continue;
  }
  const current = sha(readFileSync(at, 'utf8'));
  if (current === p.hash) {
    actions.push([p, 'unchanged']);
    continue;
  }
  const installed = lock?.files?.[p.name];
  if (installed && installed === current) actions.push([p, 'updated']);
  else if (force) actions.push([p, installed ? 'overwritten (was edited in the module)' : 'overwritten (not installed by the kit)']);
  else refused.push(`${p.name}: ${installed ? 'edited in the module since it was installed' : 'already there, not installed by the kit'}`);
}
if (refused.length) {
  console.error(`install-currency-kit: refused, nothing written. These files would be overwritten:`);
  for (const r of refused) console.error(`   ${posix(path.relative(src, dest))}/${r}`);
  console.error(`A kit file is the shared design: don't edit it in a module. Move the module's change out of the kit folder, or ask the kit's owner for it. Run again with --force to replace them.`);
  process.exit(1);
}

mkdirSync(dest, { recursive: true });
// Files an earlier kit installed that this one doesn't have: removed when
// untouched since, kept (and reported) when the module edited them.
const removed = [];
const stale = [];
for (const n of lock ? Object.keys(lock.files ?? {}).filter((n) => !kitFiles.includes(n)) : []) {
  const at = path.join(dest, n);
  if (!existsSync(at)) continue;
  if (sha(readFileSync(at, 'utf8')) === lock.files[n]) {
    unlinkSync(at);
    removed.push(n);
  } else stale.push(n);
}
for (const [p, what] of actions) if (what !== 'unchanged') writeFileSync(path.join(dest, p.name), p.text);
writeFileSync(
  lockFile,
  JSON.stringify(
    {
      kit: 'omne-currencies',
      version: pkgKit.version,
      note: 'Written by install-currency-kit.mjs. Each kit file\'s sha256 as installed; check-currencies.mjs compares against it. Do not edit.',
      uiFolder: posix(path.relative(src, uiDir)),
      files: Object.fromEntries(planned.map((p) => [p.name, p.hash])),
    },
    null,
    2,
  ) + '\n',
);

/* 4. packages, Tailwind, flags */
const notes = [];
const pkgPath = path.join(repo, 'package.json');
if (existsSync(pkgPath)) {
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const want = ['react', 'lucide-react', '@radix-ui/react-hover-card', '@radix-ui/react-tooltip', '@radix-ui/react-popover'];
  const lacking = want.filter((d) => !deps[d]);
  if (lacking.length) notes.push(`!! package.json lacks ${lacking.join(', ')}. Run: npm install ${lacking.join(' ')}`);
  const tw = String(deps.tailwindcss ?? '');
  if (/^\D*3/.test(tw)) {
    const cfg = ['tailwind.config.ts', 'tailwind.config.js', 'tailwind.config.cjs', 'tailwind.config.mjs'].map((f) => path.join(repo, f)).find(existsSync);
    const content = cfg ? readFileSync(cfg, 'utf8') : '';
    const covered = /["'`]\.\/src\/\*\*\/\*/.test(content) || content.includes(posix(path.relative(repo, dest)));
    if (!covered) notes.push(`!! Tailwind v3: make sure the content globs in ${cfg ? path.basename(cfg) : 'tailwind.config'} include ${posix(path.relative(repo, dest))}/**/*.{ts,tsx}`);
  }
} else notes.push('!! no package.json found above the src folder; check react, lucide-react and the Radix packages are installed');
const tooltipText = readFileSync(path.join(uiDir, 'tooltip.tsx'), 'utf8');
const selfProvided = /function Tooltip\([\s\S]{0,400}TooltipProvider/.test(tooltipText);
if (!selfProvided && !files.some((f) => /\.tsx$/.test(f) && /<TooltipProvider\b/.test(readFileSync(f, 'utf8'))))
  notes.push('!! no <TooltipProvider> found: wrap the app in one (shadcn tooltip needs it), or the kit\'s tooltips will throw');
if (!existsSync(path.join(repo, 'public', 'flags', '4x3'))) notes.push('flags: FlagImage reads /flags/4x3/<code>.svg, which the OMNE shell serves. Run on its own, the app shows the two-letter fallback; copy the shell\'s public/flags into public/ to see flags.');

console.log(`Installed the OMNE currency kit ${pkgKit.version} into ${posix(path.relative(repo, dest))}/`);
console.log(`  ui folder: ${posix(path.relative(repo, uiDir))} (imports point at ${uiImport})`);
const by = (w) => actions.filter(([, x]) => x.startsWith(w)).map(([p]) => p.name);
for (const w of ['added', 'updated', 'overwritten', 'unchanged']) {
  const xs = by(w);
  if (xs.length) console.log(`  ${w}: ${w === 'unchanged' ? xs.length + ' files' : xs.join(', ')}`);
}
if (removed.length) console.log(`  removed (no longer in the kit): ${removed.join(', ')}`);
if (stale.length) console.log(`  !! no longer in the kit but edited in the module, so kept: ${stale.join(', ')}. Delete them once nothing imports them.`);
for (const n of notes) console.log(`  ${n}`);
console.log(`  next: wire the screens from the BA's document (references/patterns.md), import from '${posix(path.relative(src, dest))}' via its index, then run check-currencies.mjs.`);

function fail(msg) {
  console.error('install-currency-kit: ' + msg);
  process.exit(1);
}
