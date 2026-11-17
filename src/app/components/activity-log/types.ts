/**
 * Generic, data-driven shape for the Activity Log "View details" modal.
 * Ported from warehouse-whispers-34's activity-detail-types.ts — pure
 * logic, no styling, no JSX, so it crosses over unchanged.
 */

export type DetailTextValue = {
  kind: "text";
  parts: { text: string; dim?: boolean; mono?: boolean; marked?: boolean }[];
};

export type DetailEmptyValue = { kind: "empty"; label: string };
export type DetailCodeValue = { kind: "code"; text: string };
export type DetailAttachmentValue = { kind: "attachment"; filename: string };

export type DetailStatusPillValue = {
  kind: "statusPill";
  label: string;
  tone: "success" | "accent" | "neutral";
};

export type DetailPersonValue = { kind: "person"; name: string };

export type DetailPillListValue = {
  kind: "pillList";
  items: { text: string; mono?: boolean }[];
};

/** A value whose BEFORE/AFTER are diffed at render time (see diffMarked):
 * only the differing run is marked, and only when some of the value
 * survived the change — a wholesale replacement marks nothing, because
 * the two columns already say it. */
export type DetailMarkedValue = { kind: "marked"; text: string; mono?: boolean };

export type DetailLongTextValue = {
  kind: "longText";
  text: string;
  words: number;
  lastEditedBy?: string;
  lastEditedOn?: string;
};

export type DetailCountValue = {
  kind: "count";
  number: string;
  unit: string;
  bracket?: string;
  bracketMono?: boolean;
};

export type DetailValue =
  | DetailTextValue
  | DetailEmptyValue
  | DetailCodeValue
  | DetailAttachmentValue
  | DetailStatusPillValue
  | DetailPersonValue
  | DetailPillListValue
  | DetailMarkedValue
  | DetailLongTextValue
  | DetailCountValue;

export type DetailRowField = string | { code: string; badges: DetailBadge[] };

export type DetailRow = {
  kind?: "row";
  field: DetailRowField | null;
  before: DetailValue;
  after: DetailValue;
};

export type DetailRowGap = { kind: "rowGap" };
export type DetailBadge = string | [string, string];
export type DetailItemBar = { kind: "itemBar"; code: string; badges: DetailBadge[] };
export type DetailSubHeading = { kind: "heading"; text: string; note?: string };

export type DetailAccordionGroup = {
  kind: "accordionGroup";
  title: string;
  count: number;
  rows: DetailRow[];
};

export type DetailFieldAccordion = {
  kind: "fieldAccordion";
  title: string;
  count: number;
  countLabel?: string;
  entries: DetailSectionEntry[];
};

export type DetailSectionEntry =
  | DetailRow
  | DetailRowGap
  | DetailItemBar
  | DetailSubHeading
  | DetailAccordionGroup
  | DetailFieldAccordion;

export type DetailSection = {
  heading?: string;
  note?: string;
  entries: DetailSectionEntry[];
};

export type ChangeSection = DetailSection;

export type MarkSegment = { text: string; marked: boolean };

/**
 * The whole marking rule in code: find the common prefix/suffix (widened
 * to word boundaries so a mark never starts or ends mid-word), and mark
 * only the differing middle run. If nothing is shared at a boundary at
 * all — the value was wholesale-replaced — mark nothing on either side.
 *
 *   pure deletion    the removed run marks on BEFORE, AFTER marks nothing
 *   pure insertion   the added run marks on AFTER, BEFORE marks nothing
 *   replacement      both sides mark their own changed run
 *   whole value      neither side marks — the two values already say it
 *
 * Widening runs through letters only, never digits: a mark never starts
 * or ends inside a word, but may inside a number, so "473 to 475" marks
 * only the 3 and the 5, and "$16,480.00 to $15,900.00" only "6,48" and
 * "5,90". Email addresses take their own branch first (see diffEmail).
 */
/** Both sides are email addresses. */
function bothEmail(a: string, b: string): boolean {
  const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
  return isEmail(a) && isEmail(b);
}

/** One part of an address (the name or the domain). Unchanged: unmarked. A
 * small edit — after trimming the shared start and end, two characters or
 * fewer changed on each side — marks only those characters. Anything bigger
 * marks the whole part. */
function diffEmailPart(before: string, after: string): { before: MarkSegment[]; after: MarkSegment[] } {
  if (before === after) return { before: [{ text: before, marked: false }], after: [{ text: after, marked: false }] };
  let start = 0;
  const maxStart = Math.min(before.length, after.length);
  while (start < maxStart && before[start] === after[start]) start++;
  let end = 0;
  const maxEnd = maxStart - start;
  while (end < maxEnd && before[before.length - 1 - end] === after[after.length - 1 - end]) end++;
  const small = before.length - end - start <= 2 && after.length - end - start <= 2;
  const split = (s: string): MarkSegment[] =>
    small
      ? [
          { text: s.slice(0, start), marked: false },
          { text: s.slice(start, s.length - end), marked: true },
          { text: s.slice(s.length - end), marked: false },
        ].filter((seg) => seg.text.length > 0)
      : [{ text: s, marked: true }];
  return { before: split(before), after: split(after) };
}

/** Two addresses, split at the @: the name and the domain are compared
 * separately, and the @ is never marked. */
function diffEmail(before: string, after: string): { before: MarkSegment[]; after: MarkSegment[] } {
  const at = (s: string) => s.lastIndexOf("@");
  const b = at(before);
  const a = at(after);
  const name = diffEmailPart(before.slice(0, b), after.slice(0, a));
  const domain = diffEmailPart(before.slice(b + 1), after.slice(a + 1));
  const atSeg: MarkSegment = { text: "@", marked: false };
  return { before: [...name.before, atSeg, ...domain.before], after: [...name.after, atSeg, ...domain.after] };
}

/** "{amount} per {unit}" — a price with its unit. */
const PRICE_PER = /^(.+?) per (\S.*)$/;

/** A price with a unit, split at "per": the amount takes the number rule,
 * the unit the word rule, and " per " is never marked. A unit that changed
 * outright is marked whole — it is a word, not a number, so "EA to CASE"
 * is the change itself. */
function diffPricePer(before: RegExpMatchArray, after: RegExpMatchArray): { before: MarkSegment[]; after: MarkSegment[] } {
  const amount = diffMarked(before[1], after[1]);
  const unitBefore = before[2];
  const unitAfter = after[2];
  const unit =
    unitBefore === unitAfter
      ? { before: [{ text: unitBefore, marked: false }], after: [{ text: unitAfter, marked: false }] }
      : (() => {
          const d = diffMarked(unitBefore, unitAfter);
          const anyMark = [...d.before, ...d.after].some((seg) => seg.marked);
          return anyMark ? d : { before: [{ text: unitBefore, marked: true }], after: [{ text: unitAfter, marked: true }] };
        })();
  const per: MarkSegment = { text: " per ", marked: false };
  return { before: [...amount.before, per, ...unit.before], after: [...amount.after, per, ...unit.after] };
}

/** The changed runs on both sides are whole numbers — no digit touches
 * either end — so the two numbers share no digits: "10 EA to 25 EA". Like
 * "56 to 68", neither side is marked. */
function unsharedNumbers(before: string, after: string, start: number, end: number): boolean {
  const isNumber = (t: string) => /^[0-9][0-9.,]*$/.test(t) && /[0-9]$/.test(t);
  const isDigitAt = (t: string, i: number) => i >= 0 && i < t.length && /[0-9]/.test(t[i]);
  const whole = (t: string) => {
    const mid = t.slice(start, t.length - end);
    return isNumber(mid) && !isDigitAt(t, start - 1) && !isDigitAt(t, t.length - end);
  };
  return whole(before) && whole(after);
}

export function diffMarked(before: string, after: string): { before: MarkSegment[]; after: MarkSegment[] } {
  if (before === after) {
    return { before: [{ text: before, marked: false }], after: [{ text: after, marked: false }] };
  }

  // An email address splits at the @ and each part is compared on its own,
  // before the general rule: the digit rule below never reaches an address.
  if (bothEmail(before, after)) return diffEmail(before, after);

  // A price with a unit splits at "per", after the email branch and before
  // the general rule.
  const priceBefore = before.match(PRICE_PER);
  const priceAfter = after.match(PRICE_PER);
  if (priceBefore && priceAfter) return diffPricePer(priceBefore, priceAfter);

  let start = 0;
  const maxStart = Math.min(before.length, after.length);
  while (start < maxStart && before[start] === after[start]) start++;

  let end = 0;
  const maxEnd = Math.min(before.length, after.length) - start;
  while (end < maxEnd && before[before.length - 1 - end] === after[after.length - 1 - end]) end++;

  // A boundary is whitespace, punctuation, OR a code separator — a hyphen/
  // underscore/slash inside a code (e.g. "WH-1001-OLD" -> "WH-1001") must
  // count too, or the mid-word retreat guard below walks straight through
  // the whole code looking for a boundary that's never there.
  const isBoundary = (ch: string | undefined) => ch === undefined || /[\s,.;:!?()\-_/]/.test(ch);
  const isDigit = (ch: string | undefined) => ch !== undefined && /[0-9]/.test(ch);

  // Widen the prefix and suffix to word boundaries so a mark never starts
  // or ends mid-word. Only through letters: a digit stops the widening, so
  // a number is marked by digit ("100 EA to 150 EA" marks the 0 and the 5).
  const continuesWord = (s: string, idx: number) => idx < s.length && !isBoundary(s[idx]);
  while (start > 0 && !isBoundary(before[start - 1]) && !isDigit(before[start - 1]) && (continuesWord(before, start) || continuesWord(after, start))) {
    start--;
  }

  const precededByWord = (s: string, idx: number) => idx > 0 && !isBoundary(s[idx - 1]);
  while (
    end > 0 &&
    !isBoundary(before[before.length - end]) &&
    !isDigit(before[before.length - end]) &&
    (precededByWord(before, before.length - end) || precededByWord(after, after.length - end))
  ) {
    end--;
  }

  // Nothing shared at either edge: the value was replaced outright, so
  // neither side marks. For a number that means every digit changed —
  // "56 to 68" — and marking all of both sides would say nothing the two
  // values do not already say.
  if (start === 0 && end === 0) {
    return { before: [{ text: before, marked: false }], after: [{ text: after, marked: false }] };
  }

  // The same for two numbers that share no digits, even with a unit
  // around them: "10 EA to 25 EA" marks nothing.
  if (unsharedNumbers(before, after, start, end)) {
    return { before: [{ text: before, marked: false }], after: [{ text: after, marked: false }] };
  }

  const build = (value: string): MarkSegment[] =>
    [
      { text: value.slice(0, start), marked: false },
      { text: value.slice(start, value.length - end), marked: true },
      { text: value.slice(value.length - end), marked: false },
    ].filter((s) => s.text.length > 0);

  return { before: build(before), after: build(after) };
}

export type UnifiedSegment = { text: string; type: "same" | "removed" | "added" };

/** Same prefix/suffix boundary rule as diffMarked above, but as ONE
 * interleaved sequence (a removed run immediately followed by its added
 * replacement) instead of two parallel before/after arrays — for
 * rendering a single edited passage in place rather than a two-column
 * comparison. Deliberately duplicates diffMarked's boundary logic rather
 * than refactoring it to share internals, since diffMarked is load-
 * bearing for the existing two-column view and this is a new, separate
 * consumer. */
export function diffUnified(before: string, after: string): UnifiedSegment[] {
  if (before === after) return [{ text: before, type: "same" }];

  let start = 0;
  const maxStart = Math.min(before.length, after.length);
  while (start < maxStart && before[start] === after[start]) start++;

  let end = 0;
  const maxEnd = Math.min(before.length, after.length) - start;
  while (end < maxEnd && before[before.length - 1 - end] === after[after.length - 1 - end]) end++;

  const isBoundary = (ch: string | undefined) => ch === undefined || /[\s,.;:!?()\-_/]/.test(ch);
  const isDigit = (ch: string | undefined) => ch !== undefined && /[0-9]/.test(ch);
  const continuesWord = (s: string, idx: number) => idx < s.length && !isBoundary(s[idx]);
  while (start > 0 && !isBoundary(before[start - 1]) && !isDigit(before[start - 1]) && (continuesWord(before, start) || continuesWord(after, start))) {
    start--;
  }
  const precededByWord = (s: string, idx: number) => idx > 0 && !isBoundary(s[idx - 1]);
  while (
    end > 0 &&
    !isBoundary(before[before.length - end]) &&
    !isDigit(before[before.length - end]) &&
    (precededByWord(before, before.length - end) || precededByWord(after, after.length - end))
  ) {
    end--;
  }

  if (start === 0 && end === 0) {
    return ([{ text: before, type: "removed" }, { text: after, type: "added" }] as UnifiedSegment[]).filter((s) => s.text.length > 0);
  }

  const prefix = before.slice(0, start);
  const removedMid = before.slice(start, before.length - end);
  const addedMid = after.slice(start, after.length - end);
  const suffix = before.slice(before.length - end);

  const segs: UnifiedSegment[] = [];
  if (prefix) segs.push({ text: prefix, type: "same" });
  if (removedMid) segs.push({ text: removedMid, type: "removed" });
  if (addedMid) segs.push({ text: addedMid, type: "added" });
  if (suffix) segs.push({ text: suffix, type: "same" });
  return segs;
}

export const detailText = (s: string): DetailValue => ({ kind: "text", parts: [{ text: s }] });
export const detailCode = (s: string): DetailValue => ({ kind: "code", text: s });
export const detailAttachment = (filename: string): DetailValue => ({ kind: "attachment", filename });
export const detailEmpty = (label: string): DetailValue => ({ kind: "empty", label });
export const detailMarked = (s: string, mono = false): DetailValue => ({ kind: "marked", text: s, mono });
export const detailCount = (number: string, unit: string, bracket?: string, bracketMono = true): DetailValue =>
  bracket === undefined
    ? { kind: "count", number, unit }
    : { kind: "count", number, unit, bracket, bracketMono };

export function splitSentences(text: string): string[] {
  const matches = text.match(/[^.!?]+[.!?]+(?:\s+|$)/g);
  return (matches ?? [text]).map((s) => s.trim()).filter(Boolean);
}

export type SentenceOp =
  | { type: "equal"; before: string; after: string }
  | { type: "before-only"; before: string }
  | { type: "after-only"; after: string };

export function diffSentences(before: string[], after: string[]): SentenceOp[] {
  const n = before.length;
  const m = after.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = before[i] === after[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ops: SentenceOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (before[i] === after[j]) {
      ops.push({ type: "equal", before: before[i], after: after[j] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ type: "before-only", before: before[i] });
      i++;
    } else {
      ops.push({ type: "after-only", after: after[j] });
      j++;
    }
  }
  while (i < n) {
    ops.push({ type: "before-only", before: before[i] });
    i++;
  }
  while (j < m) {
    ops.push({ type: "after-only", after: after[j] });
    j++;
  }
  return ops;
}

export type ParagraphBlock =
  | { kind: "equal"; text: string }
  | { kind: "pair"; before: string; after: string }
  | { kind: "before-only"; text: string }
  | { kind: "after-only"; text: string };

export function buildParagraphBlocks(ops: SentenceOp[]): ParagraphBlock[] {
  const blocks: ParagraphBlock[] = [];
  let i = 0;
  while (i < ops.length) {
    const op = ops[i];
    if (op.type === "equal") {
      blocks.push({ kind: "equal", text: op.before });
      i++;
      continue;
    }
    const runStart = i;
    while (i < ops.length && ops[i].type !== "equal") i++;
    const run = ops.slice(runStart, i);
    const removed = run.filter((o) => o.type === "before-only").map((o) => (o as { before: string }).before);
    const added = run.filter((o) => o.type === "after-only").map((o) => (o as { after: string }).after);
    const pairCount = Math.min(removed.length, added.length);
    for (let k = 0; k < pairCount; k++) blocks.push({ kind: "pair", before: removed[k], after: added[k] });
    for (let k = pairCount; k < removed.length; k++) blocks.push({ kind: "before-only", text: removed[k] });
    for (let k = pairCount; k < added.length; k++) blocks.push({ kind: "after-only", text: added[k] });
  }
  return blocks;
}

export function diffParagraphs(before: string, after: string): ParagraphBlock[] {
  return buildParagraphBlocks(diffSentences(splitSentences(before), splitSentences(after)));
}
