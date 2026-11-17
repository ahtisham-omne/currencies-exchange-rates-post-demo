import { Children, Fragment, cloneElement, createContext, isValidElement, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { format, isSameDay } from "date-fns";
import type { DateRange } from "react-day-picker";
import {
  Bot,
  Briefcase,
  Building2,
  ExternalLink,
  File,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  Globe,
  Linkedin,
  Mail,
  Phone,
  Plug,
  Search,
  Truck,
  Twitter,
  X,
  Sparkles,
} from "lucide-react";

import { cn } from "../ui/utils";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../ui/hover-card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { DateRangeField, type DatePresetKey, LOG_TODAY } from "./date-range-field";
import { MeModeChip, MultiSelectFilterPill } from "./multi-view";
import { CompareBody } from "./detail-modal";
import { diffMarked, diffParagraphs, diffUnified, type MarkSegment, type DetailLongTextValue } from "./types";
import { splitOnQuery } from "./search";
import { CURRENT_USER } from "./data";
import { personPhotoFor } from "./person-photos";
import {
  ACTORS,
  getActivity,
  type AttachmentFile,
  type FieldChange,
  type FieldValue,
  type ActivityEvent,
} from "./activity-data";
import { AttachmentPreviewModal, type AttachmentPreviewData } from "./attachment-preview-modal";
import { ExportLogButton, ExportLogModal, type ExportRow } from "./export-log";
import "./activity-log.css";
import {
  GENERIC_CHANGED_LABELS,
  GENERIC_FIELD_TO_CHANGED_KEY,
  MODULE_PROFILE,
  type EntityProfile,
  type EventParts,
} from "./activity-profile";

/**
 * A single warehouse's own Activity Log — the entity-level view from the
 * 2026-10-05 review with Eli (the global, cross-module log is a separate,
 * later effort). Everything a row needs is inline: who, what changed (from
 * -> to), when. No "View details" pop-up — a multi-field save expands IN
 * PLACE instead.
 */

/* ─────────────────────── search / highlight ─────────────────────── */

export function Hit({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  return (
    <>
      {splitOnQuery(text, query).map((seg, i) =>
        seg.marked ? (
          <mark key={i} className="rounded-[2px] px-0 text-inherit" style={{ backgroundColor: "var(--highlight-bg)" }}>
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </>
  );
}

/** Hit's own highlighting, for a run of text that's already inside a
 * diff's own colouring (a removed/added mark, an unchanged passage) —
 * color: "inherit" is what makes this safe to nest: a matched run inside
 * a removed segment is already --destructive, inside an added one it's
 * the success green at weight 600, and the mark only replaces the
 * background, never the colour, so it still reads as a change (red or
 * green text, strikethrough intact where there is one) with a yellow
 * fill on top for exactly the matched characters. */
function marks(text: string, query: string) {
  if (!query.trim()) return text;
  return splitOnQuery(text, query).map((seg, i) =>
    seg.marked ? (
      <mark key={i} className="rounded-[2px] px-0" style={{ backgroundColor: "var(--highlight-bg)", color: "inherit" }}>
        {seg.text}
      </mark>
    ) : (
      <span key={i}>{seg.text}</span>
    ),
  );
}

/** Marks every plain run of text inside a sentence, so a query that
 * matched on a word the sentence actually says is visible on the card —
 * "updated", "removed", "Tags", "description", not just the values.
 *
 * Recurses through fragments and plain elements and STOPS at every
 * custom component. That boundary is the whole design: a chip, a link, a
 * status pill and a person already highlight their own text, so
 * descending into them would double-mark, and React cannot see inside
 * them from here anyway. It also means a component that renders sentence
 * words of its own has to be wrapped where IT is defined, not where it is
 * used — see FieldChangeClause and FieldSubRow below.
 *
 * Numbers are left alone. Counts are not in the search index, and a mark
 * landing on the "3" in "removed 3" reads as a bug. */
function Sentence({ query, children }: { query: string; children: React.ReactNode }) {
  const walk = (node: React.ReactNode): React.ReactNode => {
    if (typeof node === "string") return marks(node, query);
    if (Array.isArray(node)) return Children.map(node, walk);
    if (isValidElement(node)) {
      const isPlain = typeof node.type === "string" || node.type === Fragment;
      if (!isPlain) return node;
      const kids = (node.props as { children?: React.ReactNode }).children;
      if (kids === undefined) return node;
      return cloneElement(node, undefined, walk(kids));
    }
    return node;
  };
  return <>{walk(children)}</>;
}

function fieldValueText(v: FieldValue): string {
  switch (v.kind) {
    case "text":
    case "code":
      return v.text;
    case "status":
      return v.label;
    case "person":
      return v.name ?? "";
    case "tags":
      return v.items.join(" ");
    case "attachments":
      return v.items.map((f) => f.name).join(" ");
    case "entity":
      return v.text;
  }
}

/* ─────────────────────── the "to"/"from" separator ─────────────────────── */

type ValueKind = "text" | "code" | "status" | "tags" | "person" | "attachment" | "empty" | "entity";

/** How much space the word "to" needs beside each kind of value for the
 * gaps to LOOK equal. They are not equal numbers on purpose: a pill and
 * an avatar have their own hard edge, so less space reads as more; bare
 * text ends at a glyph with its own side bearing, so it needs more to
 * separate at all. Every new loggable action type added later declares
 * its value kind and inherits the right spacing — nobody tunes a margin
 * again. */
const GAP: Record<ValueKind, number> = {
  text: 8,
  code: 8,
  status: 5, // pill — has a border and its own padding
  tags: 5, // pill
  person: 5, // avatar — solid edge
  // 12, not 5 — bigger than any other kind's. Everything else in this
  // table is the SEPARATOR's own clearance; this one instead has to read
  // as the gap between the word before it and a tight tile+filename pair
  // that must look tighter internally (6px) than the space outside it.
  attachment: 12,
  empty: 8, // "Removed" / "Not set" is text
  // Never actually reached — the "added" clause short-circuits before
  // FromToValue/Sep/Lead — but ValueKind must stay exhaustive.
  entity: 8,
};

/** A person value that's null ("Not set"/"Removed") renders as plain
 * text, not an avatar, so it takes the text-sized gap rather than the
 * avatar-sized one. Only ever called on a person value (FromToValue's own
 * person branch) — narrowed to that variant so its return type doesn't
 * have to account for every FieldValue kind that will never reach it. */
function gapKindOf(v: Extract<FieldValue, { kind: "person" }>): ValueKind {
  return v.name === null ? "empty" : "person";
}

/** The one separator component, used everywhere a from-to clause needs
 * the word "to" — never a literal `{" to "}`. Always text-muted-foreground:
 * it is connective prose, not a value, and must never inherit the
 * sentence's own colour. */
export function Sep({ before, after, query }: { before: ValueKind; after: ValueKind; query: string }) {
  return (
    <span className="text-muted-foreground" style={{ marginLeft: GAP[before], marginRight: GAP[after] }}>
      {marks("to", query)}
    </span>
  );
}

/** The leading "from" before a from-to clause's first value — spaced by
 * the same table, from the value kind it precedes. Plain sentence colour
 * (unlike Sep): "from" has never been muted in this file, only "to" was
 * ever the inconsistent one. */
export function Lead({ before, query }: { before: ValueKind; query: string }) {
  return <span style={{ marginRight: GAP[before] }}>{marks("from", query)}</span>;
}

/* ─────────────────────── value diffing ─────────────────────── */

// This repo's own convention for a soft destructive/success tint (see
// detail-modal.tsx) — color-mix over the real --destructive/--success
// tokens, not a new hex value.
const MARK_REMOVED = { backgroundColor: "color-mix(in srgb, var(--destructive) 12%, white)", color: "var(--destructive)" };
const MARK_ADDED = { backgroundColor: "color-mix(in srgb, var(--success) 12%, white)", color: "color-mix(in srgb, var(--success) 70%, black)", fontWeight: 600 };

/** Whether removed/added runs get the red/green comparison tint
 * (MARK_REMOVED/MARK_ADDED) — toggled by the "Hide/Show comparison" ghost
 * button. A context rather than a prop: renderMarkSegs/TextFromTo/TagChip
 * are reached from
 * several call sites, and threading one boolean through all of them is
 * churn for no benefit. This does NOT gate the search <mark> (Hit above)
 * — that answers "where's the word I typed" and has to keep working
 * regardless of this setting. */
const HighlightChangesContext = createContext(true);

/** The warehouse this whole log belongs to — only the person-detail
 * dialog's "Warehouse" stat cell needs it, four components down from
 * where it's known (EventCard -> ActorAvatarTrigger/PersonValue ->
 * PersonDetailDialog), so it's a context rather than a prop threaded
 * through layers that have no other reason to know it. */
const EntityContext = createContext<{ code: string; name: string; profile: EntityProfile }>({ code: "", name: "", profile: MODULE_PROFILE });

/** The one rule for how a REMOVED value's text renders, used by every
 * removed-value renderer in this file (tag chips, attachment chips, and
 * any removed run going through renderMarkSegs): the strike is
 * structure — it says the thing is gone — so it survives Hide
 * comparison, greyscale, and anyone who can't separate red from green.
 * The red is a contrast judgement, and that's the only thing the toggle
 * owns. One helper, not a copy per chip: two of them drifting apart is
 * what produced the bug this replaced. `removed` lets a single component
 * that renders BOTH states (AttachmentChip) call this unconditionally
 * instead of branching itself. */
function removedValueStyle(removed: boolean, highlight: boolean): React.CSSProperties {
  return {
    color: removed && highlight ? "var(--destructive)" : "var(--foreground)",
    textDecoration: removed ? "line-through" : undefined,
    textDecorationColor: removed ? (highlight ? "var(--destructive)" : "var(--muted-foreground)") : undefined,
  };
}

function renderMarkSegs(segs: MarkSegment[], tone: "removed" | "added", highlight: boolean, query: string) {
  return segs.map((seg, i) => {
    if (!seg.marked) return <span key={i}>{marks(seg.text, query)}</span>;
    if (tone === "removed") {
      // Highlighted ON keeps the existing tinted-box treatment
      // (unchanged); OFF still shows a muted strike instead of looking
      // identical to unmarked text — same "survives Hide comparison"
      // rule every other removed value in this file now follows.
      return highlight ? (
        <span key={i} className="rounded-[3px] px-[2px]" style={MARK_REMOVED}>
          {marks(seg.text, query)}
        </span>
      ) : (
        <span key={i} style={{ textDecoration: "line-through", textDecorationColor: "var(--muted-foreground)" }}>
          {marks(seg.text, query)}
        </span>
      );
    }
    return highlight ? (
      <span key={i} className="rounded-[3px] px-[2px]" style={MARK_ADDED}>
        {marks(seg.text, query)}
      </span>
    ) : (
      <span key={i}>{marks(seg.text, query)}</span>
    );
  });
}

export function TextFromTo({ before, after, query }: { before: string; after: string; query: string }) {
  // Both sides shown in full — a long value (an address) already gets
  // its own line below the timestamp via isLongPair, so there's no
  // inline-crowding reason left to abbreviate either side. diffMarked's
  // own character-level marking is what keeps a long shared run readable.
  const highlight = useContext(HighlightChangesContext);
  const { before: bSeg, after: aSeg } = diffMarked(before, after);
  return (
    // A plain inline span, NOT inline-flex: both sides are text, so they
    // must share the sentence's own baseline. inline-flex plus align-middle
    // made this an inline box centred against the line, which floated every
    // numeric pair a pixel or two above the words around it.
    <span>
      <span className="font-medium text-foreground">{renderMarkSegs(bSeg, "removed", highlight, query)}</span>
      <Sep before="text" after="text" query={query} />
      <span className="font-medium text-foreground">{renderMarkSegs(aSeg, "added", highlight, query)}</span>
    </span>
  );
}

// Tone follows the LABEL, not just an active/inactive boolean — Inactive and
// Archived are different real statuses (amber vs. rose, per the design
// system's own tokens) and collapsing them into one "not active" gray lost
// that distinction. `active` is kept only as the fallback for any other
// label this log doesn't know about yet.
export function StatusPillNode({ label, active, query }: { label: string; active: boolean; query: string }) {
  const l = label.toLowerCase();
  const tone =
    l === "active" ? "active" : l === "inactive" ? "inactive" : l === "archived" ? "archived" : active ? "active" : "neutral";
  const styleFor = {
    active: { borderColor: "var(--status-active-border)", backgroundColor: "var(--status-active-bg)", color: "var(--status-active-text)" },
    inactive: { borderColor: "var(--status-inactive-border)", backgroundColor: "var(--status-inactive-bg)", color: "var(--status-inactive-text)" },
    archived: { borderColor: "var(--status-archived-border)", backgroundColor: "var(--status-archived-bg)", color: "var(--status-archived-text)" },
    neutral: { borderColor: "var(--border)", backgroundColor: "var(--muted)", color: "var(--muted-foreground)" },
  }[tone];
  // Dense box, not the page-header StatusBadge size — this pill sits
  // inline in a sentence beside a 22px tag chip (TagChipShell, same
  // file), not alone at the top of a page, so it matches THAT box model
  // (px-2, 12px/500, 22px tall) instead, same as the AdvancedInvoiceTable
  // status badge in vendor-invoicing-payments. Colour treatment (the
  // --status-*-bg/-text/-border tokens, the border, rounded-full) is
  // untouched — only the box got smaller. No dot: neither reference badge
  // actually renders the `dot` token it defines.
  return (
    <span
      className="inline-flex items-center rounded-full border px-2 whitespace-nowrap"
      style={{ ...styleFor, height: 22, paddingTop: 2, paddingBottom: 2, fontSize: 12, fontWeight: 500 }}
    >
      <Hit text={label} query={query} />
    </span>
  );
}

/** The EntityTagChip spec (shipped 21 Aug 2026, Cycle Count + Partners):
 * #F8FAFC surface, 1px #E2E8F0 border, #1E293B text, 8px corner, 12px/500
 * type, 22px chip height. This log is read-only history, not an editor,
 * so the spec's remove (x) and Add Tag affordances don't apply here. */
export function TagChipShell({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center rounded-[8px] border px-2 text-[12px] leading-4 font-medium whitespace-nowrap"
      style={{ height: 22, paddingTop: 2, paddingBottom: 2, borderColor: "var(--tag-chip-border)", backgroundColor: "var(--tag-chip-bg)", color: "var(--tag-chip-text)" }}
    >
      {children}
    </span>
  );
}

function TagList({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex flex-wrap items-center gap-1 align-middle">{children}</span>;
}

// Same removedValueStyle every removed value in this file uses — see its
// own doc comment. Kept in sync with AttachmentChip by construction, not
// by two copies of the same three properties.
function RemovedTagChip({ text, highlight, query }: { text: string; highlight: boolean; query: string }) {
  return (
    <TagChipShell>
      <span style={removedValueStyle(true, highlight)}>{marks(text, query)}</span>
    </TagChipShell>
  );
}

/** No tint — a tag that's simply now present has nothing to compare it
 * to, so nothing to mark. Only a removal or a rename has a "before" to
 * show the change against. */
function AddedTagChip({ text, query }: { text: string; query: string }) {
  return <TagChipShell>{marks(text, query)}</TagChipShell>;
}

function RenamedTagPair({ before, after, highlight, query }: { before: string; after: string; highlight: boolean; query: string }) {
  const { before: bSeg, after: aSeg } = diffMarked(before, after);
  return (
    // No gap utility here — Sep's own margins (the "tags" kind, same
    // table the status pills use) are the only spacing either side of
    // "to" now, same as every other pill-to-pill from/to pair.
    <span className="inline-flex items-center">
      <TagChipShell>{renderMarkSegs(bSeg, "removed", highlight, query)}</TagChipShell>
      <Sep before="tags" after="tags" query={query} />
      <TagChipShell>{renderMarkSegs(aSeg, "added", highlight, query)}</TagChipShell>
    </span>
  );
}

type TagRename = { before: string; after: string };
type TagChangeSet = { removed: string[]; added: string[]; renames: TagRename[] };

/** Same word-boundary-free prefix/suffix measure as diffMarked's own
 * boundary search, reduced to a single 0-1 ratio: how much of the two
 * strings' combined length sits in a shared prefix or suffix. Used only
 * to decide "close enough to be a rename", not to render anything. */
function sharedBoundaryRatio(a: string, b: string): number {
  let start = 0;
  const maxStart = Math.min(a.length, b.length);
  while (start < maxStart && a[start] === b[start]) start++;
  let end = 0;
  const maxEnd = Math.min(a.length, b.length) - start;
  while (end < maxEnd && a[a.length - 1 - end] === b[b.length - 1 - end]) end++;
  const longer = Math.max(a.length, b.length);
  return longer === 0 ? 0 : (start + end) / longer;
}

/** A removed tag and an added tag pair as a rename when they share MOST
 * of their length at the edges — ratio > 0.5 — greedily matching each
 * removed tag to its best remaining candidate. A straight swap of two
 * unrelated tags (near-zero shared boundary) stays a remove and an add. */
function pairTagRenames(removed: string[], added: string[]): TagChangeSet {
  const remainingRemoved = [...removed];
  const remainingAdded = [...added];
  const renames: TagRename[] = [];
  for (const r of [...remainingRemoved]) {
    let bestIdx = -1;
    let bestRatio = 0.5;
    for (let i = 0; i < remainingAdded.length; i++) {
      const ratio = sharedBoundaryRatio(r, remainingAdded[i]);
      if (ratio > bestRatio) {
        bestRatio = ratio;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0) {
      renames.push({ before: r, after: remainingAdded[bestIdx] });
      remainingAdded.splice(bestIdx, 1);
      remainingRemoved.splice(remainingRemoved.indexOf(r), 1);
    }
  }
  return { renames, removed: remainingRemoved, added: remainingAdded };
}

/** A tag present on both sides and unchanged is dropped entirely — that
 * is the point: a ten-tag record with two real edits prints two chips,
 * not twenty. */
function computeTagChanges(before: string[], after: string[]): TagChangeSet {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  const removed = before.filter((t) => !afterSet.has(t));
  const added = after.filter((t) => !beforeSet.has(t));
  return pairTagRenames(removed, added);
}

// Removed + added + renames, a rename counting once — the same number
// that decides whether a tags change gets the inline chip treatment or
// the counted sentence plus the block below.
function tagChangeCount(changes: TagChangeSet): number {
  return changes.removed.length + changes.added.length + changes.renames.length;
}

/** How many of the three groups actually have members. Drives three
 * decisions that must agree: whether TagChangeBlock shows its label
 * column, whether the block gets SpillBlock's border at the top level,
 * and whether the sentence above it carries counts. They were computed
 * separately and had already diverged — `boxed` tested removed && added,
 * which left a removed-plus-renamed change labelled but unbordered. */
function tagGroupCount(changes: TagChangeSet): number {
  return [changes.removed.length > 0, changes.added.length > 0, changes.renames.length > 0].filter(Boolean).length;
}

/** "added 10 tags", "removed 3 attachments" — the sentence for a block
 * that carries no labels of its own. One builder for both kinds so the
 * wording cannot drift apart. */
function sideClause(verb: string, n: number, singular: string): string {
  return `${verb} ${n} ${n === 1 ? singular : `${singular}s`}`;
}

/** The verb a tags sentence takes. "updated" only when more than one
 * group changed — with a single group the verb IS the direction, and
 * "updated, added 10" said it twice. */
function tagVerb(changes: TagChangeSet): string {
  if (tagGroupCount(changes) > 1) return "updated";
  if (changes.added.length > 0) return "added";
  if (changes.removed.length > 0) return "removed";
  return "renamed";
}

function tagSideClause(changes: TagChangeSet): string {
  if (changes.added.length > 0) return sideClause("added", changes.added.length, "tag");
  if (changes.removed.length > 0) return sideClause("removed", changes.removed.length, "tag");
  return sideClause("renamed", changes.renames.length, "tag");
}

// The one inline-vs-block test, for both tags and attachments: the total
// count of changed chips, mixed or not. Three or fewer reads fine as a
// sentence ("removed X and added Y"); a mixed removal+addition doesn't
// get special treatment here — "removed 1 and added 1" is still just 2.
const INLINE_CHIP_CEILING = 3;

/** The tags sentence as text, for search and export: "added the tags
 * Fleet Build Repeat Customer". Same rule as the card: the field is named
 * only when tags moved one way, three or fewer, and none was renamed. */
function tagHeadText(field: string, before: string[], after: string[]): string {
  const noun = fieldVerb(field);
  const ch = computeTagChanges(before, after);
  const count = ch.removed.length + ch.added.length + ch.renames.length;
  const groups = [ch.removed.length > 0, ch.added.length > 0, ch.renames.length > 0].filter(Boolean).length;
  const named = groups === 1 && count <= INLINE_CHIP_CEILING && !ch.renames.length;
  const the = (n: number) => (named ? `the ${tagNounFor(noun, n)} ` : "");
  const parts: string[] = [];
  if (ch.removed.length) parts.push(`removed ${the(ch.removed.length)}${ch.removed.join(" ")}`);
  if (ch.added.length) parts.push(`added ${the(ch.added.length)}${ch.added.join(" ")}`);
  if (ch.renames.length) parts.push(`renamed ${ch.renames.map((r) => `${r.before} to ${r.after}`).join(" ")}`);
  if (!parts.length) return "";
  return groups > 1 ? `updated the ${noun}, ${parts.join(" and ")}` : parts.join(" and ");
}

/** Prose join, not a CSV: "removed X and added Y" at two groups,
 * "removed X, added Y, and renamed Z" (Oxford comma) at three — never
 * ", " on every separator, which reads as a list rendered by a computer
 * rather than a sentence written by one. Shared by the inline chip
 * sentence and the counted sentence — same groups, same order, only the
 * group's own content (chips vs. a number) differs. */
function joinProse(groups: React.ReactNode[]): React.ReactNode {
  if (groups.length === 0) return null;
  const last = groups.length - 1;
  return groups.map((g, i) => (
    <span key={i}>
      {i > 0 && (i === last ? (groups.length > 2 ? ", and " : " and ") : ", ")}
      {g}
    </span>
  ));
}

/** Only the groups that have members appear. Null means nothing actually
 * changed — the caller falls back to a plain "updated the tags" rather
 * than claiming a change that isn't there. Chips inline, uncapped — only
 * used for a changeCount of 3 or fewer; past that, tagCountClause below
 * takes over the sentence and the chips move to TagChangeBlock. */
/** "tag" for one chip, "tags" for two or three — the field's own noun, so
 * a module whose field isn't called Tags keeps its word. */
const tagNounFor = (noun: string, n: number) =>
  n === 1 ? (noun.endsWith("ies") ? `${noun.slice(0, -3)}y` : noun.replace(/s$/, "")) : noun;

/** `noun`: name the field before the chips ("added the tag [X]"). Passed
 * only when tags moved one way, three or fewer — never for a rename. */
function renderTagChangeGroups(changes: TagChangeSet, highlight: boolean, query: string, noun?: string): React.ReactNode | null {
  const the = (n: number) => (noun ? `the ${tagNounFor(noun, n)} ` : "");
  const groups: React.ReactNode[] = [];
  if (changes.removed.length > 0) {
    groups.push(
      <span key="removed">
        removed {the(changes.removed.length)}
        <TagList>
          {changes.removed.map((t) => (
            <RemovedTagChip key={t} text={t} highlight={highlight} query={query} />
          ))}
        </TagList>
      </span>,
    );
  }
  if (changes.added.length > 0) {
    groups.push(
      <span key="added">
        added {the(changes.added.length)}
        <TagList>
          {changes.added.map((t) => (
            <AddedTagChip key={t} text={t} query={query} />
          ))}
        </TagList>
      </span>,
    );
  }
  if (changes.renames.length > 0) {
    groups.push(
      <span key="renamed">
        renamed{" "}
        <TagList>
          {changes.renames.map((r) => (
            <RenamedTagPair key={`${r.before}→${r.after}`} before={r.before} after={r.after} highlight={highlight} query={query} />
          ))}
        </TagList>
      </span>,
    );
  }
  return joinProse(groups);
}

/** One labelled row inside a change block — tags' Removed/Added/Renamed
 * and attachments' Removed/Added both use it. The label column matches
 * LabelledFromTo's own (10.5px/600/0.05em/muted-foreground, same 16px
 * gap) so every long-row treatment lines up when they appear on different
 * cards: From/To/Removed/Added all start at the same x, and their values
 * all start at the same x. line-height: rowHeight (not a guessed top
 * padding, and not hardcoded to one chip's height) is what centres the
 * label on the chip row's FIRST line exactly — a tag chip is 22px tall,
 * an attachment chip is 40px (ATTACHMENT_CHIP_HEIGHT — its 32px tile plus
 * the chip's own 4px top/bottom padding), and a label centred for one
 * would sit noticeably off on the other. items-start on the row
 * keeps the label pinned to that first line even once the chips wrap to a
 * second one, instead of items-center dropping it between both lines. */
export function GroupRow({ label, rowHeight, query, children }: { label: string; rowHeight: number; query: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4">
      {/* 88px, not the 48 this was: a label is a module's own field name now
         (Expected Date, Ships From, Reference), not just From / To / Removed /
         Added. Nothing stops it wrapping either — a label that outgrows the
         column should take a second line, never run under its own value. */}
      <span
        className="w-[88px] shrink-0 text-[10.5px] font-semibold tracking-[0.05em] text-muted-foreground"
        style={{ lineHeight: `${rowHeight}px` }}
      >
        {marks(label, query)}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

const CHIP_GAP = 8; // gap-2 between chips

/** Fits a group to 2 lines by measurement, not by a fixed chip count — a
 * constant cap means whether "+ N more" lands beside a chip or alone on
 * its own line depends entirely on how wide that count's worth of tag
 * names happen to be.
 *
 * The measurement always runs against EVERY item, never just however
 * many are currently visible — a hidden shadow copy (visibility:hidden,
 * position:absolute, so it's laid out for real but paints nothing and
 * takes no space of its own) renders the full list at the same width as
 * the real row. Measuring only the visible subset was the first attempt
 * here, and it doesn't converge: once a trim shows only 8 of 24 chips,
 * re-measuring sees just those 8, concludes "everything fits" against
 * the ORIGINAL count of 24, restores all 24, overflows again, trims back
 * to 8, forever — confirmed live as a real "Maximum update depth
 * exceeded" crash, not a theoretical risk. Measuring the full set every
 * time removes the feedback loop: the answer no longer depends on what
 * the previous render happened to show. */
function useChipLineFit(itemCount: number) {
  const [fitCount, setFitCount] = useState<number | null>(null);
  const shadowRowRef = useRef<HTMLDivElement>(null);
  const shadowChipRefs = useRef<(HTMLElement | null)[]>([]);
  const shadowExpanderRef = useRef<HTMLButtonElement>(null);

  const measure = useCallback(() => {
    const row = shadowRowRef.current;
    const chips = shadowChipRefs.current.slice(0, itemCount).filter((el): el is HTMLElement => !!el);
    if (!row || chips.length !== itemCount) return;
    const rowRect = row.getBoundingClientRect();
    if (rowRect.width === 0) return;

    // Group chips into lines by their own top position — unaffected by
    // whatever the trailing expander does, since flex-wrap places each
    // item based only on what comes before it.
    let line = 1;
    let lineTop = chips[0].getBoundingClientRect().top;
    const chipLine: number[] = [1];
    for (let i = 1; i < chips.length; i++) {
      const top = chips[i].getBoundingClientRect().top;
      if (top > lineTop + 1) {
        line++;
        lineTop = top;
      }
      chipLine.push(line);
    }

    if (line <= 2) {
      setFitCount(itemCount);
      return;
    }

    // Some chips spill past line 2 — trimming is needed. The expander's
    // own width doesn't depend on where it sits, so measuring it in its
    // current (trailing) position is enough to test every candidate cut
    // point by arithmetic, with no further re-rendering required.
    const expanderWidth = shadowExpanderRef.current?.getBoundingClientRect().width ?? 0;
    let fit = 0;
    for (let i = 0; i < chips.length; i++) {
      if (chipLine[i] > 2) break;
      const rect = chips[i].getBoundingClientRect();
      const rightEdge = rect.right - rowRect.left;
      if (rightEdge + CHIP_GAP + expanderWidth <= rowRect.width) {
        fit = i + 1;
      }
    }
    setFitCount(fit);
  }, [itemCount]);

  // Resets whenever the item set itself changes.
  useLayoutEffect(() => {
    setFitCount(null);
  }, [itemCount]);

  // Re-measures any time there's no current answer — covers the initial
  // mount AND any later reset. This has to run on EVERY render (not
  // keyed to `measure`, i.e. to itemCount) because the ResizeObserver
  // below can reset fitCount to null well after mount, from a plain
  // setTimeout outside any layout-effect cycle; keying this off `measure`
  // alone meant that reset was never followed by a new measurement,
  // stranding fitCount at null forever — confirmed live as every group's
  // expander permanently reading "+ 0 more" a moment after a correct
  // measurement had already landed.
  useLayoutEffect(() => {
    if (fitCount === null) measure();
  });

  useEffect(() => {
    const row = shadowRowRef.current;
    if (!row) return;
    let timer: ReturnType<typeof setTimeout>;
    const ro = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => setFitCount(null), 100);
    });
    ro.observe(row);
    return () => {
      clearTimeout(timer);
      ro.disconnect();
    };
  }, []);

  return { fitCount, shadowRowRef, shadowChipRefs, shadowExpanderRef };
}

/** Caps one group (removed/added/renamed) at however many chips fit
 * across 2 lines; past that, "+ N more" expands it in place. An expanded
 * group is capped in HEIGHT, not content (max-h-[180px], scrolls), so a
 * fifty-tag change stays on the card instead of growing it without
 * bound. Auto-expands when a hidden chip matches the active search, the
 * same reasoning as the card's own hidden-match auto-expand: a match
 * that's technically rendered but still capped behind its own expander
 * isn't actually findable. A manual click always wins over that once
 * made, until the query changes. */
export function CappedChipGroup<T>({
  label,
  chipHeight,
  items,
  textFor,
  query,
  renderChip,
}: {
  /** Omitted when the block holds only this one group — a lone label
   * column would be a column of one, so the chips start at the block's
   * own padding instead. */
  label?: string;
  /** This group's own chip height (TAG_CHIP_HEIGHT or
   * ATTACHMENT_CHIP_HEIGHT) — sizes the expander link's own box so it
   * sits on the same line as a real chip, whichever kind this group's
   * chips are. */
  chipHeight: number;
  items: T[];
  textFor: (item: T) => string;
  query: string;
  renderChip: (item: T) => React.ReactNode;
}) {
  const [manualExpanded, setManualExpanded] = useState<boolean | null>(null);
  useEffect(() => setManualExpanded(null), [query]);

  const { fitCount, shadowRowRef, shadowChipRefs, shadowExpanderRef } = useChipLineFit(items.length);
  // Until measured, show everything (corrected before paint by the
  // layout effect above) — never a flash of a wrong, too-small count.
  const collapsedCount = fitCount ?? items.length;
  const showExpander = fitCount === null || fitCount < items.length;
  const hiddenCount = items.length - collapsedCount;

  const q = query.trim().toLowerCase();
  const hasHiddenMatch = q.length > 0 && hiddenCount > 0 && items.slice(collapsedCount).some((item) => textFor(item).toLowerCase().includes(q));
  const expanded = manualExpanded ?? hasHiddenMatch;
  const linkClass = "cursor-pointer whitespace-nowrap text-[12.5px] font-medium text-primary underline decoration-1 underline-offset-2";
  const expanderBoxClass = cn(linkClass, "flex items-center");
  const expanderBoxStyle = { height: chipHeight };

  const content = !expanded ? (
    <div className="relative">
      {/* The measurement copy — always every item, at the same width
       * as the real row, laid out for real (visibility:hidden keeps
       * real geometry) but painting nothing and taking no space of
       * its own (position:absolute). Its expander text is pinned to
       * itemCount, never to the real hiddenCount, so its width never
       * depends on the answer the measurement is about to produce —
       * that dependency is what caused the infinite loop this
       * replaced (measuring only the visible subset after a trim
       * made "everything fits" true again at the wrong count,
       * restoring all of them, overflowing, trimming again, forever). */}
      <div
        aria-hidden="true"
        ref={shadowRowRef}
        className="absolute top-0 left-0 flex w-full flex-wrap items-center gap-2"
        style={{ visibility: "hidden" }}
      >
        {items.map((item, i) => (
          <span
            key={textFor(item) + i}
            ref={(el) => {
              shadowChipRefs.current[i] = el;
            }}
            className="inline-flex"
          >
            {renderChip(item)}
          </span>
        ))}
        <button ref={shadowExpanderRef} type="button" tabIndex={-1} className={expanderBoxClass} style={expanderBoxStyle}>
          + {items.length} more
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {items.slice(0, collapsedCount).map(renderChip)}
        {/* A link, not an eleventh chip — no border, no fill, no chip
         * padding, so it reads as a counter rather than a tag. The
         * same 22px line box as a chip, centred on it rather than on
         * the text baseline, so it sits ON the line next to them. */}
        {showExpander && (
          <button type="button" onClick={() => setManualExpanded(true)} className={expanderBoxClass} style={expanderBoxStyle}>
            + {hiddenCount} more
          </button>
        )}
      </div>
    </div>
  ) : (
    <div className="flex flex-col items-start gap-2">
      {/* The scroll box caps HEIGHT, not content — a 400-tag group
       * scrolls inside the same 180px a 40-tag one does, which is what
       * keeps one bulk re-tag from deforming the card. "Show less" sits
       * OUTSIDE that box, not as its last scrollable item, so it's
       * reachable without scrolling to the bottom of an unbounded list. */}
      <div className="flex max-h-[180px] w-full flex-wrap items-center gap-2 overflow-y-auto">{items.map(renderChip)}</div>
      <button type="button" onClick={() => setManualExpanded(false)} className={linkClass}>
        Show less
      </button>
    </div>
  );

  return label === undefined ? content : (
    <GroupRow label={label} rowHeight={chipHeight} query={query}>
      {content}
    </GroupRow>
  );
}

/** The one "this continues below its own sentence" box — a sentence that
 * names a change, with its real content (chips, files, a from/to pair)
 * spilling onto the lines under it, draws exactly this shape: a seam
 * lighter than the card's own border, not a second nested card. No margin
 * of its own — callers place it (12px under a single-change event's own
 * timestamp via the shared longRow wrapper, SUBROW_BLOCK_GAP under a
 * multi-change sub-row's own sentence, where it competes with the next
 * sub-row for attention and has to read as closer to the one above it). */
export function SpillBlock({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-[8px] border border-border-subtle", className)} style={{ padding: "9px 11px" }}>
      {children}
    </div>
  );
}

// The gap from a multi-change sub-row's own sentence down to its block —
// deliberately HALF of pb-3 (the 12px gap from one sub-row to the next,
// EventCard), so a block reads as belonging to the sentence above it, not
// floating between it and the next change. One constant, not three call
// sites each picking a number: tags, attachments, and a long address's
// From/To pair all take it. The top-level single-change longRow case is
// NOT this — it keeps its own established 12px, shared with Show N more
// and Show Comparison, since there's no following sub-row for it to
// compete with.
export const SUBROW_BLOCK_GAP = "mt-1.5"; // 6px

/** The block a tags change moves to once changeCount is past 3 — one
 * component, called from both the single-change longRow slot and
 * directly under a multi-change sub-row's own sentence, so there's one
 * definition of how a large tag change renders, not two.
 *
 * `boxed` decides whether SpillBlock's border actually renders: the
 * border is for separating this change from a SIBLING — another group in
 * the same change, or another sub-row on the same card — so a
 * single-change event with only one direction changed (all removed, or
 * all added, never both) has nothing to separate from and gets the bare
 * capped chip row instead. A sub-row inside a multi-change card always
 * has the Status/Address/… siblings around it, so it's always boxed
 * regardless of how many groups it itself has.
 *
 * Labels ("Removed"/"Added"/"Renamed") are a separate decision from
 * boxing: they show only once more than one group actually has members —
 * a lone group's label column would be a column of one, whether or not
 * the block around it has a border. */
function TagChangeBlock({ changes, highlight, query, boxed }: { changes: TagChangeSet; highlight: boolean; query: string; boxed: boolean }) {
  const showLabels = tagGroupCount(changes) > 1;
  const content = (
    <div className="flex flex-col gap-3">
      {changes.removed.length > 0 && (
        <CappedChipGroup
          label={showLabels ? "Removed" : undefined}
          chipHeight={TAG_CHIP_HEIGHT}
          items={changes.removed}
          textFor={(t) => t}
          query={query}
          renderChip={(t) => <RemovedTagChip key={t} text={t} highlight={highlight} query={query} />}
        />
      )}
      {changes.added.length > 0 && (
        <CappedChipGroup
          label={showLabels ? "Added" : undefined}
          chipHeight={TAG_CHIP_HEIGHT}
          items={changes.added}
          textFor={(t) => t}
          query={query}
          renderChip={(t) => <AddedTagChip key={t} text={t} query={query} />}
        />
      )}
      {changes.renames.length > 0 && (
        <CappedChipGroup
          label={showLabels ? "Renamed" : undefined}
          chipHeight={TAG_CHIP_HEIGHT}
          items={changes.renames}
          textFor={(r) => `${r.before} ${r.after}`}
          query={query}
          renderChip={(r) => <RenamedTagPair key={`${r.before}→${r.after}`} before={r.before} after={r.after} highlight={highlight} query={query} />}
        />
      )}
    </div>
  );
  return boxed ? <SpillBlock>{content}</SpillBlock> : content;
}

/** Renders the leading "from" too (spaced from the BEFORE value's own
 * kind), so callers never write a literal "from" themselves and never
 * have to know what kind of value follows it. */
/** A text or code pair with one side empty: an addition or a removal, never
 * a from/to. Only these two value kinds — person, tags, attachments and
 * entity each handle their own empty side, and a status always has a label. */
function emptyTextSide(before: FieldValue, after: FieldValue): "added" | "removed" | null {
  if ((before.kind !== "text" && before.kind !== "code") || (after.kind !== "text" && after.kind !== "code")) return null;
  const bEmpty = before.text.trim() === "";
  const aEmpty = after.text.trim() === "";
  if (bEmpty && !aEmpty) return "added";
  if (!bEmpty && aEmpty) return "removed";
  return null;
}

/** One value that arrived or left — the from/to sides' own weight and
 * colour, and no diff mark: nothing changed, it arrived. */
function PlainValue({ text, query }: { text: string; query: string }) {
  return (
    <span className="font-medium text-foreground">
      <Hit text={text} query={query} />
    </span>
  );
}

function FromToValue({ before, after, query }: { before: FieldValue; after: FieldValue; query: string }) {
  if ((before.kind === "text" || before.kind === "code") && (after.kind === "text" || after.kind === "code")) {
    return (
      <>
        <Lead before="text" query={query} />
        <TextFromTo before={before.text} after={after.text} query={query} />
      </>
    );
  }
  if (before.kind === "status" && after.kind === "status") {
    return (
      <>
        <Lead before="status" query={query} />
        <span className="inline-flex flex-wrap items-center align-middle">
          <StatusPillNode label={before.label} active={before.active} query={query} />
          <Sep before="status" after="status" query={query} />
          <StatusPillNode label={after.label} active={after.active} query={query} />
        </span>
      </>
    );
  }
  // Two records, one on each side (a location moved to another warehouse):
  // both are links, the same as a person pair shows both people.
  if (before.kind === "entity" && after.kind === "entity") {
    return (
      <>
        <Lead before="entity" query={query} />
        <EntityLink href={before.href} text={before.text} query={query} />
        <Sep before="entity" after="entity" query={query} />
        <EntityLink href={after.href} text={after.text} query={query} />
      </>
    );
  }
  if (before.kind === "person" && after.kind === "person") {
    const beforeKind = gapKindOf(before);
    const afterKind = gapKindOf(after);
    return (
      <>
        <Lead before={beforeKind} query={query} />
        <span className="inline-flex flex-wrap items-center align-middle">
          {before.name ? <PersonValue name={before.name} query={query} /> : <span className="text-muted-foreground">Not set</span>}
          <Sep before={beforeKind} after={afterKind} query={query} />
          {after.name ? <PersonValue name={after.name} query={query} /> : <span className="text-muted-foreground">Removed</span>}
        </span>
      </>
    );
  }
  return null;
}

/* ─────────────────────── per-field sentence ─────────────────────── */

// Field names whose sentence form is not just the lower-cased name —
// acronyms would otherwise come out as "base uom". (Items' names live
// here for now; unused keys cost the other modules nothing.)
const FIELD_VERB: Record<string, string> = {
  "point of contact": "point of contact",
  "base uom": "Base UOM",
  "po recommendation rule": "PO recommendation rule",
  mpn: "MPN",
};

function fieldVerb(field: string): string {
  return FIELD_VERB[field.toLowerCase()] ?? field.toLowerCase();
}

/** The one match test for a change hidden behind "Show N more" — field
 * name plus both sides' text, lowercased, same as eventSearchText's own
 * shape. Shared by the per-card notice and the list-level bar so there's
 * one definition of "hidden match" rather than two that can drift. */
function hiddenChangeMatches(event: ActivityEvent, query: string, profile: EntityProfile): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  if (event.kind === "fields") {
    return event.changes.slice(3).some((c) => (fieldVerb(c.field) + fieldValueText(c.before) + fieldValueText(c.after)).toLowerCase().includes(q));
  }
  // A creation's starting values get the same "Show N more" cut as any
  // other multi-change card, so a match sitting past the first 3 needs
  // the same auto-expand — otherwise search finds the card but the
  // highlighted value stays hidden behind the fold.
  if (event.kind === "created") {
    return event.initial.slice(3).some((i) => (i.field + fieldValueText(i.value)).toLowerCase().includes(q));
  }
  // A custom kind's sub-rows take the same cut, so the same rule.
  const spec = profile.extraKinds[(event as { kind: string }).kind];
  return (spec?.subRowText?.(event) ?? []).slice(3).some((t) => t.toLowerCase().includes(q));
}

/** A pair that will not sit on one line with the sentence. Measured on
 * the two values together, because a short before and a long after is
 * just as unreadable as two long ones. Field name is the wrong test: a
 * short description should stay inline, and a long code should not. */
const LONG_VALUE_CHARS = 60;
function isLongPair(before: FieldValue, after: FieldValue) {
  return fieldValueText(before).length + fieldValueText(after).length > LONG_VALUE_CHARS;
}

function FieldChangeClause(props: { change: FieldChange; query: string; onOpenAttachment?: (file: AttachmentFile) => void }) {
  const highlight = useContext(HighlightChangesContext);
  const { entityNoun, statusVerbs } = useContext(EntityContext).profile;
  // The body is CALLED, not rendered as <FieldChangeClauseBody />: its
  // sentence words have to arrive as this Sentence's own children, and a
  // custom component element is exactly what the walker steps over.
  return <Sentence query={props.query}>{fieldChangeClauseBody({ ...props, highlight, entityNoun, statusVerbs: statusVerbs !== false })}</Sentence>;
}

function fieldChangeClauseBody({
  change,
  query,
  onOpenAttachment,
  highlight,
  entityNoun,
  statusVerbs,
}: {
  change: FieldChange;
  query: string;
  onOpenAttachment?: (file: AttachmentFile) => void;
  highlight: boolean;
  entityNoun: string;
  statusVerbs: boolean;
}) {
  const { field, before, after } = change;
  // A person field cleared or filled is a removal or an assignment, not an
  // edit "to Removed". A warehouse can have several points of contact, so
  // that one is "a point of contact"; any other person field is a single
  // seat, "the finance owner".
  if (before.kind === "person" && after.kind === "person") {
    const isPoc = field.toLowerCase() === "point of contact";
    if (after.name === null && before.name) {
      return (
        <>
          removed <PersonValue name={before.name} query={query} /> as {isPoc ? "a point of contact" : <>the {fieldVerb(field)}</>}
        </>
      );
    }
    if (before.name === null && after.name) {
      return isPoc ? (
        <>
          added <PersonValue name={after.name} query={query} /> as a point of contact
        </>
      ) : (
        <>
          added <PersonValue name={after.name} query={query} /> as the {fieldVerb(field)}
        </>
      );
    }
  }
  // A profile whose status is one plain field (statusVerbs: false — every
  // module now) keeps the pair: Active, Inactive and Archived are one field,
  // so every change to it reads "updated the status from X to Y".
  if (statusVerbs && before.kind === "status" && after.kind === "status") {
    if (after.label === "Archived" && before.label !== "Archived") return <>archived this {entityNoun}</>;
    if (before.label === "Archived" && after.label !== "Archived") return <>restored this {entityNoun} from the archive</>;
  }
  // The value kind alone says this is a tag list: "Additional categories"
  // and "Selling partners" are tag-valued too, and must get the chips.
  if (before.kind === "tags" && after.kind === "tags") {
    const noun = fieldVerb(field);
    const tagChanges = computeTagChanges(before.items, after.items);
    const count = tagChangeCount(tagChanges);
    if (count === 0) return <>updated the {noun}</>;
    // The ONLY test is the total count, mixed or not — three or fewer
    // changed chips read fine as a sentence ("removed X and added Y");
    // past that, the sentence carries counts only and the chips move to
    // TagChangeBlock, rendered by whichever caller has a slot for it
    // (getEventParts' longRow for a single-change event, inline below the
    // sentence for a sub-row).
    // Labelled block below → the sentence says only what changed, not how
    // much. Single-group block → no labels down there, so the verb and
    // count have to live here.
    if (count > INLINE_CHIP_CEILING) {
      // Mirrors the attachments sentence exactly: "updated the tags" when
      // the block below labels its groups, a verb-led clause when it has
      // only one and no labels to carry the direction.
      return tagGroupCount(tagChanges) > 1 ? <>updated the {noun}</> : <>{tagSideClause(tagChanges)}</>;
    }
    // The verb names the direction: one way only reads "added [chips]" or
    // "removed [chips]"; "updated the tags, …" only when both moved.
    return tagGroupCount(tagChanges) > 1 ? (
      <>updated the {noun}, {renderTagChangeGroups(tagChanges, highlight, query)}</>
    ) : (
      <>{renderTagChangeGroups(tagChanges, highlight, query, tagChanges.renames.length ? undefined : noun)}</>
    );
  }
  if (field.toLowerCase() === "attachments" && before.kind === "attachments" && after.kind === "attachments") {
    const changes = computeAttachmentChanges(before.items, after.items);
    if (attachmentChangeCount(changes) === 0) return <>updated the attachments</>;
    // Both directions changed: the block below labels its own Removed
    // and Added rows, so repeating the counts here says nothing the
    // reader cannot already see. One direction only: that block has no
    // labels, so this sentence is the only thing naming the verb.
    const mixed = changes.removed.length > 0 && changes.added.length > 0;
    if (mixed) return <>updated the attachments</>;
    return <>{attachmentChangeClause(changes.removed, changes.added)}</>;
  }
  if (after.kind === "entity" && before.kind !== "entity") {
    return (
      <>
        {fieldVerb(field)} <EntityLink href={after.href} text={after.text} query={query} /> added
      </>
    );
  }
  // Empty is never shown: nothing -> value is an addition, value -> nothing
  // a removal. Only value-to-value takes from/to.
  const emptySide = emptyTextSide(before, after);
  if (emptySide === "added" && (after.kind === "text" || after.kind === "code")) {
    return (
      <>
        set the {fieldVerb(field)} to <PlainValue text={after.text} query={query} />
      </>
    );
  }
  // Name what was cleared: "removed the staging location" records that
  // something went without recording what. Symmetric with the add form
  // above, and with "removed Bob Jones as the finance owner".
  if (emptySide === "removed" && (before.kind === "text" || before.kind === "code")) {
    return (
      <>
        removed the {fieldVerb(field)} <PlainValue text={before.text} query={query} />
      </>
    );
  }
  return (
    <>
      updated the {fieldVerb(field)} <FromToValue before={before} after={after} query={query} />
    </>
  );
}

/** One FieldValue with no counterpart — a creation's starting value. The
 * pair renderers all assume a before and an after, so this is the single
 * -sided case, built from the same leaf components rather than a second
 * set: the status pill, the person with their avatar, the tag chips. */
function FieldValueNode({ value, query }: { value: FieldValue; query: string }) {
  switch (value.kind) {
    case "status":
      return <StatusPillNode label={value.label} active={value.active} query={query} />;
    case "person":
      return value.name ? (
        <PersonValue name={value.name} query={query} />
      ) : (
        <span className="text-muted-foreground">Not set</span>
      );
    case "tags":
      return (
        <span className="inline-flex flex-wrap items-center gap-2 align-middle">
          {value.items.map((t) => (
            <AddedTagChip key={t} text={t} query={query} />
          ))}
        </span>
      );
    case "attachments":
      return (
        <span className="inline-flex flex-wrap items-center gap-2 align-middle">
          {value.items.map((f) => (
            <AttachmentChip key={f.name} file={f} removed={false} highlight={false} query={query} onOpen={() => {}} />
          ))}
        </span>
      );
    case "entity":
      return <EntityLink href={value.href} text={value.text} query={query} />;
    default:
      return (
        <span className="font-medium text-foreground">
          <Hit text={fieldValueText(value)} query={query} />
        </span>
      );
  }
}

/** A creation's sub-row. "set to" rather than "updated from … to …"
 * because there is no before; "added" for a group, which is the rule
 * already settled for a single-group change — the verb names the
 * direction. Same shape as FieldSubRow: field name first, then verb,
 * then value, so the two read as one list when a reader scans the card. */
function CreatedSubRow({ field, value, query }: { field: string; value: FieldValue; query: string }) {
  const verb = value.kind === "tags" || value.kind === "attachments" ? "added" : "set to";
  return (
    <Sentence query={query}>
      {field} {verb} <FieldValueNode value={value} query={query} />
    </Sentence>
  );
}

/** One field change, as a standalone sentence clause with "X updated from
 * ... to ..." capitalized at the front — used in the "Show more" list. */
function FieldSubRow(props: {
  change: FieldChange;
  onOpenCompare?: (before: string, after: string) => void;
  onOpenAttachment?: (file: AttachmentFile) => void;
  query: string;
}) {
  const highlight = useContext(HighlightChangesContext);
  // The module's long-text field (notes, description…) gets the in-place
  // marked passage and Show Comparison, same as a description.
  const longTextField = useContext(EntityContext).profile.longTextNoun?.toLowerCase();
  return <Sentence query={props.query}>{fieldSubRowBody({ ...props, highlight, longTextField })}</Sentence>;
}

function fieldSubRowBody({
  change,
  onOpenCompare,
  onOpenAttachment,
  query,
  highlight,
  longTextField,
}: {
  change: FieldChange;
  onOpenCompare?: (before: string, after: string) => void;
  onOpenAttachment?: (file: AttachmentFile) => void;
  query: string;
  highlight: boolean;
  longTextField?: string;
}) {
  const { field, before, after } = change;
  if (before.kind === "person" && after.kind === "person" && (after.name === null || before.name === null)) {
    return <FieldChangeClause change={change} query={query} />;
  }
  if (before.kind === "tags" && after.kind === "tags") {
    const tagChanges = computeTagChanges(before.items, after.items);
    const count = tagChangeCount(tagChanges);
    if (count === 0) return <>{field} updated</>;
    // No longRow slot inside a sub-row, so the block wraps directly
    // under the sentence, in the same text column, at SUBROW_BLOCK_GAP —
    // tighter than the gap to the NEXT sub-row, so the block reads as
    // belonging to this sentence, not floating between it and the next
    // change. Always boxed here (unlike the single-change case): a
    // sub-row always has siblings on the same card to separate from,
    // whether this particular change has one group or two.
    if (count > INLINE_CHIP_CEILING) {
      return (
        <span className="block">
          <span className="block">{field} {tagVerb(tagChanges)}</span>
          <div className={SUBROW_BLOCK_GAP}>
            <TagChangeBlock changes={tagChanges} highlight={highlight} query={query} boxed />
          </div>
        </span>
      );
    }
    return (
      <>
        {field} updated, {renderTagChangeGroups(tagChanges, highlight, query)}
      </>
    );
  }
  if (field.toLowerCase() === "attachments" && before.kind === "attachments" && after.kind === "attachments") {
    const changes = computeAttachmentChanges(before.items, after.items);
    if (attachmentChangeCount(changes) === 0) return <>{field} updated</>;
    const mixed = changes.removed.length > 0 && changes.added.length > 0;
    // Same rule as tags above. The count that used to sit here is already
    // on screen: the chips are right below, and a fitted group's
    // "+ N more" states whatever is not shown.
    const verb = mixed ? "updated" : changes.added.length > 0 ? "added" : "removed";
    return (
      <span className="block">
        <span className="block">{field} {verb}</span>
        <div className={SUBROW_BLOCK_GAP}>
          <AttachmentChangeBlock changes={changes} highlight={highlight} query={query} onOpen={onOpenAttachment!} boxed />
        </div>
      </span>
    );
  }
  // Description is prose, not a value to compare side by side — same
  // in-place-marked passage a top-level descriptionEdited event gets,
  // just reached from inside a multi-change save instead.
  if ((field.toLowerCase() === "description" || (longTextField !== undefined && field.toLowerCase() === longTextField)) && (before.kind === "text" || before.kind === "code") && (after.kind === "text" || after.kind === "code")) {
    return (
      <span className="block">
        <span className="block">{field} updated</span>
        <div className={SUBROW_BLOCK_GAP}>
          <SpillBlock>
            <DescriptionPassage before={before.text} after={after.text} query={query} onOpenCompare={() => onOpenCompare?.(before.text, after.text)} />
          </SpillBlock>
        </div>
      </span>
    );
  }
  if (after.kind === "entity" && before.kind !== "entity") {
    return (
      <>
        {field} <EntityLink href={after.href} text={after.text} query={query} /> added
      </>
    );
  }
  // Empty is never shown — field-led, verb last, like every other sub-line.
  const emptySide = emptyTextSide(before, after);
  if (emptySide === "added" && (after.kind === "text" || after.kind === "code")) {
    return (
      <>
        {field} set to <PlainValue text={after.text} query={query} />
      </>
    );
  }
  if (emptySide === "removed" && (before.kind === "text" || before.kind === "code")) {
    return (
      <>
        {field} <PlainValue text={before.text} query={query} /> removed
      </>
    );
  }
  // A pair too long to sit on one line with the sentence (an address)
  // gets the same labelled From/To rows a single-change event's own
  // longRow does. LabelledFromTo itself stays bare (From/To is one value
  // in two parts, not a Removed/Added pair of groups) — the box here
  // comes from this sub-row having siblings to separate from, the same
  // reason tags/attachments are always boxed in this context, so it's
  // applied at this call site rather than inside the component.
  if ((before.kind === "text" || before.kind === "code") && (after.kind === "text" || after.kind === "code") && isLongPair(before, after)) {
    return (
      <span className="block">
        <span className="block">{field} updated</span>
        <div className={SUBROW_BLOCK_GAP}>
          <SpillBlock>
            <LabelledFromTo before={before.text} after={after.text} query={query} />
          </SpillBlock>
        </div>
      </span>
    );
  }
  return (
    <>
      {field} updated <FromToValue before={before} after={after} query={query} />
    </>
  );
}

/* ─────────────────────── the actor hover card ─────────────────────── */

/** A photo when one exists for this person — full name first (so two
 * people sharing a first name never wear the same face), then first
 * name, lifted into person-photos.ts so both this and the contact
 * directory import one copy — with tinted initials sitting behind it as
 * the fallback, so a name with no photo, or a photo that fails to load,
 * still renders exactly as it did before photos existed. */
function ActorAvatar({ name, size = 32 }: { name: string; size?: number }) {
  const info = ACTORS[name];
  const initials = info?.initials ?? name.slice(0, 2).toUpperCase();
  const photo = personPhotoFor(name);
  const [failed, setFailed] = useState(false);
  // Not a person: a neutral grey disc with an icon, never initials or a photo.
  if (info?.kind && info.kind !== "person") {
    const Icon = info.kind === "carrier" ? Truck : info.kind === "integration" ? Plug : Bot;
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-full"
        style={{ width: size, height: size, backgroundColor: "var(--muted)", color: "var(--muted-foreground)" }}
        aria-label={name}
      >
        <Icon style={{ width: Math.round(size * 0.5), height: Math.round(size * 0.5) }} />
      </span>
    );
  }
  return (
    <span
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-full text-[11px]"
      style={{ width: size, height: size, backgroundColor: info?.avatarBg ?? "var(--muted)", color: info?.avatarFg ?? "var(--muted-foreground)", fontWeight: 600 }}
    >
      {initials}
      {photo && !failed && (
        <img src={photo} alt="" onError={() => setFailed(true)} className="absolute inset-0 size-full rounded-full object-cover" />
      )}
    </span>
  );
}

/** A person sitting in a VALUE position — the old or new point of
 * contact, not the actor. Same avatar as the row's own, at 26px. No
 * margin of its own — Sep/Lead own all the spacing around a value now,
 * so this just sets gap-1 between the avatar and its own name. The
 * avatar carries the card; the name is a separate click target. */
export function PersonValue({ name, query }: { name: string; query: string }) {
  // Two triggers, side by side (Rumaisa, 3 Nov): the avatar opens the card,
  // the name only turns blue and opens the person on click. ActorAvatar,
  // not ActorAvatarTrigger, inside — that is a PersonTrigger itself, and
  // nesting two gives the card competing timers. font-medium, not the
  // actor's semibold — a person as a value weighs the same as any value.
  const avatar = <ActorAvatar name={name} size={26} />;
  const label = <Hit text={name} query={query} />;
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      <PersonTrigger name={name} fallback={avatar}>
        {avatar}
      </PersonTrigger>
      <PersonTrigger name={name} card={false} fallback={<span className="font-medium text-foreground">{label}</span>}>
        <span className="font-medium text-foreground cursor-pointer hover:text-primary hover:underline underline-offset-2 decoration-1 transition-colors">{label}</span>
      </PersonTrigger>
    </span>
  );
}

/** Four numbers this log has no real figures for, so they're invented —
 * deterministically, from a hash of the name (same shape as Vendor
 * Payments' getContactStats), so a given person always shows the same
 * numbers rather than reshuffling on every render. Do not mistake these
 * for real counts if you're reading this later: nothing here is computed
 * from actual change history. */
function getContactStats(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  // Unsigned shift, not Math.abs + signed shift: the source's own
  // formula (Math.abs(h) then `>>`) goes negative whenever a name hashes
  // to exactly Int32.MIN_VALUE, since Math.abs of that is 2^31, and a
  // SIGNED right-shift of a value past 2^31-1 re-wraps negative after
  // ToInt32. `>>>` on `h` directly sidesteps the whole edge case.
  const abs = h >>> 0;
  return {
    changesMade: ((abs >>> 3) % 80) + 10,
    locationsManaged: ((abs >>> 7) % 6) + 1,
    attachments: ((abs >>> 5) % 25) + 1,
  };
}

// Blue-600, deliberately NOT --primary — Vendor Payments' source
// distinguishes "+N more" and the CTA's hover state from the app's own
// brand blue on purpose, and reusing --primary here would quietly erase
// that distinction.
const QUICK_VIEW_BLUE_600 = "#0866E0";

const QUICK_VIEW_SOCIALS: { id: string; label: string; icon: typeof Linkedin; color: string; url: string }[] = [
  { id: "s1", label: "LinkedIn", icon: Linkedin, color: "#0A66C2", url: "#" },
  { id: "s2", label: "X (Twitter)", icon: Twitter, color: "#000000", url: "#" },
  { id: "s3", label: "Website", icon: Globe, color: "var(--primary)", url: "#" },
];

/** The full-size person card a click opens — Vendor Payments' own
 * ContactFullCard (InvoiceDataTable.tsx:934-1278), mirrored structurally
 * and re-expressed in this repo's tokens, not VendorFullCard (705-911,
 * the near-twin for the vendor column) and not a port of Partner
 * Management's QuickViewPanel, which carries that module's item/
 * location/carrier types this one has no use for.
 *
 * Role/department/phone/email come from THIS file's own ACTORS registry,
 * not a hash — that data already exists and already drives the small
 * hover card two components away; hash-generating a second, different
 * answer here would just contradict it. Only the four stats below are
 * invented, because nothing resembling them exists anywhere yet. */
// "Line items" -> "Line Items", for the stat cell that names the module's child entity.
const titleCase = (s: string) => s.replace(/\b\p{L}/gu, (c) => c.toUpperCase());

function PersonDetailDialog({ name, open, onOpenChange }: { name: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const info = ACTORS[name];
  const entity = useContext(EntityContext);
  const photo = personPhotoFor(name);
  const [heroFailed, setHeroFailed] = useState(false);
  if (!info) return null;
  const showPhoto = !!photo && !heroFailed;
  const stats = getContactStats(name);

  // Mocked second phone/email so "+1 more" has something to show — same
  // convention the source uses (last-digit swap, gmail-domain swap).
  const phones = [
    { id: "p1", type: "Office", number: info.phone },
    { id: "p2", type: "Mobile", number: info.phone.replace(/\d(?=\D*$)/, "9") },
  ];
  const emails = [
    { id: "e1", type: "Work", address: info.email },
    { id: "e2", type: "Personal", address: info.email.replace(/@.*/, "@gmail.com") },
  ];

  const activePillStyle = { backgroundColor: "var(--status-active-bg)", color: "var(--status-active-text)", borderColor: "var(--status-active-border)" };
  const deptChipStyle = { backgroundColor: "var(--status-active-bg)", color: "var(--status-active-text)", borderColor: "var(--status-active-border)" };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="activity-log-portal w-[calc(100vw-32px)] sm:max-w-[480px] md:max-w-[540px] lg:max-w-[600px] p-0 overflow-hidden border-0 rounded-2xl bg-card flex flex-col max-h-[calc(100vh-48px)] [&>button:last-child]:hidden"
        style={{ boxShadow: "0 0 0 1px rgba(0,0,0,0.03), 0 8px 20px rgba(0,0,0,0.08), 0 24px 56px rgba(0,0,0,0.14)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <DialogTitle className="sr-only">{name}, contact details</DialogTitle>
        <DialogDescription className="sr-only">
          Quick reference for {name}: role, {entity.profile.entityNoun}, department, phone, email, and social handles.
        </DialogDescription>

        {/* Direct child of DialogContent, not of the hero — stays pinned
         * while the body beneath it scrolls. */}
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute top-3 right-3 z-50 w-8 h-8 rounded-full flex items-center justify-center bg-white/90 hover:bg-white shadow-md transition-all cursor-pointer border border-border"
          aria-label="Close"
        >
          <X className="w-4 h-4 text-slate-700" />
        </button>

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <div
            className="relative overflow-hidden shrink-0"
            style={{
              height: "clamp(200px, 45vh, 420px)",
              background: showPhoto ? "#1E293B" : "linear-gradient(135deg, var(--muted) 0%, var(--muted) 55%, #1E293B 100%)",
            }}
          >
            {showPhoto ? (
              <img src={photo} alt={name} className="w-full h-full object-cover" onError={() => setHeroFailed(true)} />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div
                  className="w-28 h-28 rounded-full flex items-center justify-center text-[40px] shadow-[0_6px_24px_rgba(0,0,0,0.25)] border-2 border-white/30"
                  style={{ fontWeight: 700, backgroundColor: info.avatarBg, color: info.avatarFg }}
                >
                  {info.initials}
                </div>
              </div>
            )}

            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />

            <span className="absolute top-3 left-3 inline-flex items-center px-2.5 py-1 rounded-full text-[11px] border backdrop-blur-sm" style={{ fontWeight: 600, ...activePillStyle }}>
              Active
            </span>

            {/* No zoom button — the source's is a dead control
             * (onClick is only e.stopPropagation(), nothing else).
             * Shipping a no-op because the reference has one is copying
             * a bug, not mirroring the design. */}

            <div className="absolute bottom-3 left-4 right-4">
              <p className="text-[16px] text-white truncate" style={{ fontWeight: 700 }}>
                {name}
              </p>
              <div className="text-[11px] text-white/80 mt-0.5 truncate" style={{ fontWeight: 500 }}>
                {info.role}
              </div>
            </div>
          </div>

          <div className="px-5 pt-4 pb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 text-[12px] text-slate-500" style={{ fontWeight: 500 }}>
                <Building2 className="w-3 h-3" />
                {entity.name}
              </span>
              <span className="text-slate-300">•</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] border" style={{ fontWeight: 600, ...deptChipStyle }}>
                <Briefcase className="w-3 h-3" />
                {info.department}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 divide-x divide-border rounded-xl border border-border overflow-hidden [&>*:nth-child(n+3)]:border-t [&>*:nth-child(n+3)]:sm:border-t-0">
              <div className="px-2.5 py-2.5 text-center">
                <div className="text-[13px] text-foreground truncate" style={{ fontWeight: 700 }} title={entity.name}>
                  {entity.name.split(" ").slice(0, 2).join(" ")}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>
                  {entity.profile.entityLabel}
                </div>
              </div>
              <div className="px-2.5 py-2.5 text-center">
                <div className="text-[15px] text-foreground" style={{ fontWeight: 700 }}>
                  {stats.changesMade}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>
                  Changes Made
                </div>
              </div>
              <div className="px-2.5 py-2.5 text-center">
                <div className="text-[15px] text-foreground" style={{ fontWeight: 700 }}>
                  {stats.locationsManaged}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>
                  {titleCase(entity.profile.childChangedLabel)} Managed
                </div>
              </div>
              <div className="px-2.5 py-2.5 text-center">
                <div className="text-[15px] text-foreground" style={{ fontWeight: 700 }}>
                  {stats.attachments}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>
                  Attachments
                </div>
              </div>
            </div>

            <div className="mt-3 space-y-1">
              <div className="flex items-center gap-2.5 py-1">
                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <a
                  href={`tel:${phones[0].number.replace(/[^\d+]/g, "")}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-[13px] text-foreground hover:text-primary hover:underline transition-colors min-w-0 truncate"
                  style={{ fontWeight: 500 }}
                >
                  {phones[0].number}
                </a>
                {phones.length > 1 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-[11px] shrink-0 cursor-default leading-none ml-0.5" style={{ fontWeight: 600, color: QUICK_VIEW_BLUE_600 }}>
                        +{phones.length - 1} more
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="activity-log-portal wh-log-tooltip z-[300] max-w-[300px]">
                      <div className="space-y-1.5">
                        {phones.slice(1).map((p) => (
                          <div key={p.id} className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400 shrink-0" style={{ fontWeight: 500 }}>
                              {p.type}
                            </span>
                            <span className="text-[11px] text-slate-700">{p.number}</span>
                          </div>
                        ))}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>

              <div className="flex items-center gap-2.5 py-1">
                <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <a
                  href={`mailto:${emails[0].address}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-[13px] text-foreground hover:text-primary hover:underline transition-colors min-w-0 truncate"
                  style={{ fontWeight: 500 }}
                >
                  {emails[0].address}
                </a>
                {emails.length > 1 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-[11px] shrink-0 cursor-default leading-none ml-0.5" style={{ fontWeight: 600, color: QUICK_VIEW_BLUE_600 }}>
                        +{emails.length - 1} more
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="activity-log-portal wh-log-tooltip z-[300] max-w-[300px]">
                      <div className="space-y-1.5">
                        {emails.slice(1).map((e) => (
                          <div key={e.id} className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400 shrink-0" style={{ fontWeight: 500 }}>
                              {e.type}
                            </span>
                            <span className="text-[11px] text-slate-700">{e.address}</span>
                          </div>
                        ))}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>

              <div className="flex items-center gap-2.5 pt-1.5">
                <span className="text-[11px] text-muted-foreground/70 shrink-0" style={{ fontWeight: 600 }}>
                  Connect
                </span>
                <div className="flex items-center gap-1">
                  {QUICK_VIEW_SOCIALS.map((s) => {
                    const SIcon = s.icon;
                    return (
                      <Tooltip key={s.id}>
                        <TooltipTrigger asChild>
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="group/social relative w-6 h-6 rounded flex items-center justify-center transition-all duration-150 hover:bg-muted"
                          >
                            <SIcon className="w-3.5 h-3.5 text-slate-400 group-hover/social:opacity-0 transition-opacity duration-150" />
                            <SIcon className="w-3.5 h-3.5 absolute opacity-0 group-hover/social:opacity-100 transition-opacity duration-150" style={{ color: s.color }} />
                          </a>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="activity-log-portal wh-log-tooltip z-[300]">
                          <span className="text-[11px]">{s.label}</span>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sibling of the scroll region, not inside it — stays put while
         * the hero/body scroll. The base DialogContent is `grid gap-4`;
         * this flex-flow override beats `grid` but the `gap-4` survives
         * (tailwind-merge only touches conflicting utilities), giving a
         * deliberate 16px gap above this bar — kept, not accidental. */}
        <div className="px-5 py-3 border-t border-border/40 flex items-center justify-between bg-muted/30 shrink-0">
          <button type="button" onClick={() => onOpenChange(false)} className="text-[13px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer" style={{ fontWeight: 500 }}>
            Close
          </button>
          <a
            href={`/contacts/${encodeURIComponent(name)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onOpenChange(false)}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[13px] text-white transition-colors cursor-pointer"
            style={{ fontWeight: 600, backgroundColor: "var(--primary)" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = QUICK_VIEW_BLUE_600)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--primary)")}
          >
            View profile
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** A person's hover card and detail dialog. The card opens from the
 * avatar alone (ActorAvatarTrigger, PersonValue's avatar); a name passes
 * `card={false}` and opens only the dialog on click (ActorLink,
 * PersonValue's name). One
 * implementation, so the two can never drift apart. 400ms open / 200ms close (Partner
 * Management's PocPillComponents.tsx useHoverIntent values), passed
 * explicitly here rather than changed on the shared primitive, which
 * other screens in this repo still rely on at its own default timing.
 * Clicking closes the hover card and opens the full-size dialog instead
 * — two cards for the same person on screen at once is the usual bug
 * this pattern ships with. */
function PersonTrigger({ name, fallback, children, card = true }: { name: string; fallback: React.ReactNode; children: React.ReactNode; card?: boolean }) {
  const info = ACTORS[name];
  const [hoverOpen, setHoverOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  // Nothing to hover or open for a system, carrier or integration.
  if (!info || (info.kind && info.kind !== "person")) return <>{fallback}</>;
  // A person's NAME (Rumaisa, 3 Nov): black at rest, blue and underlined
  // under the pointer, never a card — the card opens from the avatar only.
  // Its click still opens the person, as the combined trigger's did.
  if (!card)
    return (
      <>
        <span
          className="cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            setDetailOpen(true);
          }}
        >
          {children}
        </span>
        <PersonDetailDialog name={name} open={detailOpen} onOpenChange={setDetailOpen} />
      </>
    );
  return (
    <>
      <HoverCard open={hoverOpen} onOpenChange={setHoverOpen} openDelay={400} closeDelay={200}>
        <HoverCardTrigger asChild>
          <span
            className="cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              setHoverOpen(false);
              setDetailOpen(true);
            }}
          >
            {children}
          </span>
        </HoverCardTrigger>
        <HoverCardContent
          side="bottom"
          align="start"
          className="activity-log-portal w-[280px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-4 py-3 relative overflow-hidden">
            <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
            <div className="flex items-center gap-3 relative">
              <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-white/20 shrink-0 flex items-center justify-center" style={{ backgroundColor: info.avatarBg }}>
                <span className="text-[13px]" style={{ fontWeight: 700, color: info.avatarFg }}>
                  {info.initials}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>
                  {name}
                </p>
                <p className="text-[11px] text-slate-400 truncate">{info.role}</p>
              </div>
            </div>
          </div>
          <div className="bg-white px-4 py-3 space-y-2">
            <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
              <span className="truncate">{info.email}</span>
            </div>
            <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
              <span>{info.department}</span>
            </div>
            <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
              <span>{info.phone}</span>
            </div>
          </div>
        </HoverCardContent>
      </HoverCard>
      <PersonDetailDialog name={name} open={detailOpen} onOpenChange={setDetailOpen} />
    </>
  );
}

function ActorAvatarTrigger({ name, size }: { name: string; size: number }) {
  const avatar = <ActorAvatar name={name} size={size} />;
  return <PersonTrigger name={name} fallback={avatar}>{avatar}</PersonTrigger>;
}

/** The actor's name: black at rest, blue and underlined on hover, and a
 * click opens the person. The card is the avatar's alone (Rumaisa,
 * 3 Nov), so hovering the name never opens it. A non-person actor stays
 * plain, with no hover state. */
export function ActorLink({ name, query }: { name: string; query: string }) {
  const text = <Hit text={name} query={query} />;
  return (
    <PersonTrigger name={name} card={false} fallback={<span className="font-semibold text-foreground">{text}</span>}>
      <span className="font-semibold text-foreground cursor-pointer hover:text-primary hover:underline underline-offset-2 decoration-1 transition-colors">{text}</span>
    </PersonTrigger>
  );
}

/** Opens in a new tab — the whole point of this list is that you're
 * scanning it, and following a link should not cost you your place, your
 * filters or your scroll position. noopener/noreferrer: a bare
 * target="_blank" hands the opened page a reference back to this one. */
export function EntityLink({ href, text, query }: { href: string; text: string; query: string }) {
  // mr-1 is structural, not a space character in the sentence — a bare
  // newline between two JSX elements (no text between them at all)
  // collapses to NOTHING, not even one space, which is what produced
  // "LOC-YARD-01from". A margin on the element itself can't disappear
  // that way.
  // No target in this prototype: say the name, don't promise a page.
  if (!href) {
    return (
      <span className="mr-1 font-medium text-foreground">
        <Hit text={text} query={query} />
      </span>
    );
  }
  // A same-page anchor stays in this tab; another record opens in a new one.
  // Every app-relative link goes through the app's base path, so it still
  // resolves when the module is mounted under /apps/<name>/ in the hub.
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const resolved = href.startsWith("/") && base && !href.startsWith(`${base}/`) ? `${base}${href}` : href;
  const link = href.startsWith("#") ? (
    <a href={href} className="mr-1 font-medium text-primary underline underline-offset-2 decoration-1">
      <Hit text={text} query={query} />
    </a>
  ) : (
    <a href={resolved} target="_blank" rel="noopener noreferrer" className="mr-1 font-medium text-primary underline underline-offset-2 decoration-1">
      <Hit text={text} query={query} />
    </a>
  );
  // The module's own hover card, where it has one for this record
  // (CLAUDE.md rule 8). The link and its click are unchanged.
  return <EntityHover text={text}>{link}</EntityHover>;
}

/** Wraps a linked entity in the module's hover card through the profile's
 * `entityHover`, resolved by name. A module without one, or a name that
 * resolves to nothing, gets the link back untouched. */
function EntityHover({ text, children }: { text: string; children: React.ReactNode }) {
  const hover = useContext(EntityContext).profile.entityHover;
  return <>{hover?.(text, children) ?? children}</>;
}

/** A file, not just a link to one — the ERP's own attachment treatment
 * (AttachmentsTab.tsx: a filled, info-tinted tile with the file icon
 * inside it), scaled to sit in a line of 13.5px text. Tighter between
 * the tile and the filename than either side of them, the same rule the
 * person pair follows. Used wherever an attachment is named. */
/** Cycle Count's attachment file-row spec (section 2), mapped onto this
 * app's own --file-* tokens. Two departures, both because this sits
 * inline in a 13.5px sentence rather than a 36px list row: the tile is
 * 20px (36px would set the line height and tower over the words beside
 * it), and there's no corner type badge (unreadable at this size — the
 * extension in the filename already carries that information). */
const FILE_TYPE_ICON: Record<string, typeof FileText> = {
  PDF: FileText,
  DOC: FileText,
  DOCX: FileText,
  TXT: FileText,
  PNG: FileImage,
  JPG: FileImage,
  JPEG: FileImage,
  XLSX: FileSpreadsheet,
  XLS: FileSpreadsheet,
  CSV: FileSpreadsheet,
  ZIP: FileArchive,
  RAR: FileArchive,
};
const FILE_TYPE_TOKEN: Record<string, "pdf" | "doc" | "image" | "sheet" | "archive"> = {
  PDF: "pdf",
  DOC: "doc",
  DOCX: "doc",
  TXT: "doc",
  PNG: "image",
  JPG: "image",
  JPEG: "image",
  XLSX: "sheet",
  XLS: "sheet",
  CSV: "sheet",
  ZIP: "archive",
  RAR: "archive",
};

function fileExt(filename: string): string {
  return filename.split(".").pop()?.toUpperCase() ?? "";
}

// The attachment chip's own box model, named rather than typed as a bare
// 36 or 40 wherever something needs its total height — GroupRow's label
// line-height and CappedChipGroup's expander box both derive from THESE
// numbers (ATTACHMENT_CHIP_HEIGHT below), so resizing the tile here can't
// silently misalign either of them again.
const ATTACHMENT_TILE_SIZE = 32; // size-8
const ATTACHMENT_CHIP_PADDING_Y = 4; // py-1, top and bottom
const ATTACHMENT_CHIP_HEIGHT = ATTACHMENT_TILE_SIZE + ATTACHMENT_CHIP_PADDING_Y * 2;
export const TAG_CHIP_HEIGHT = 22; // TagChipShell's own fixed height

/** The one attachment treatment in this log: a chip holding the tile and
 * the filename together, the tag chip's own tokens (TagChipShell, same
 * file) at a larger size, not an invented grey. A file never renders any
 * other way — no bare inline tile+filename, whether there's one file or
 * six, so there's exactly one place to look for how a file is drawn.
 * Each chip is a filled, bordered shape rather than a bare tile+name+gap
 * (the gap inside a file and the gap between two files read as nearly
 * equal without the fill, so three ran together as one strip the first
 * time this was tried) — the fill settles the grouping by shape instead
 * of by tuning two gaps against each other. The WHOLE chip is the click
 * target, a button rather than a link — it opens the preview modal in
 * place, not a dead /attachments/ href — with hover tint via
 * .wh-attachment-chip (theme.css) since the base colours live there too,
 * not as an inline style a hover: rule can't outrank.
 *
 * A removed file follows RemovedTagChip's own rule exactly: the filename
 * struck through always, red only while comparison highlighting is on —
 * the line is structure (the file is gone), the colour is a judgement
 * Hide comparison can turn off. The tile itself is never tinted or
 * dimmed; the file is what it is, the strike says it left.
 * A removed file is not openable: the chip drops its button, its pointer
 * and its hover tint, and a tooltip on hover says the file is gone. Eli
 * caught a struck-out floor plan still opening its preview in the Oct 9
 * review; there is no file behind it to show. */
export function AttachmentChip({
  file,
  removed,
  highlight,
  query,
  onOpen,
}: {
  file: AttachmentFile;
  removed: boolean;
  highlight: boolean;
  query: string;
  onOpen: () => void;
}) {
  const ext = fileExt(file.name);
  const Icon = FILE_TYPE_ICON[ext] ?? File;
  const token = FILE_TYPE_TOKEN[ext] ?? "other";
  const inner = (
    <>
      <span
        className="relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border"
        style={{ backgroundColor: `var(--file-${token}-bg)`, color: `var(--file-${token})` }}
      >
        <Icon className="size-4" />
        <span
          className="absolute right-[1px] bottom-[1px] rounded-[2px] border border-border px-[2px] font-semibold uppercase"
          style={{ backgroundColor: "var(--input-background)", color: `var(--file-${token})`, fontSize: 7, lineHeight: "11px", letterSpacing: "0.03em" }}
        >
          {ext}
        </span>
      </span>
      {/* Hit, not EntityLink's own text — search highlighting still
       * works, the filename just isn't blue. */}
      <span className="max-w-[180px] truncate text-[12.5px] font-medium" style={removedValueStyle(removed, highlight)}>
        <Hit text={file.name} query={query} />
      </span>
    </>
  );

  // A removed file is not a button: no pointer, no hover tint, nothing
  // behind it to open. The tooltip is on hover deliberately — letting
  // someone click and then telling them it does not work is worse than
  // not offering the click. Shell follows the blocked-action tooltip
  // already used across the ERP (PaymentTermDetailsModal.tsx:344 in
  // vendor-invoicing-payments): a span trigger, bottom, sideOffset 6,
  // 260px, 11px/1.5, and content that says why before what remains.
  if (removed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="wh-attachment-chip wh-attachment-chip--removed inline-flex cursor-default items-center gap-2 rounded-lg py-1 pr-2.5 pl-1 text-left">
            {inner}
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6} className="activity-log-portal wh-log-tooltip z-[300] max-w-[260px] text-[11px] leading-[1.5]">
          This file was removed from this record, so there is nothing to open. The log keeps the <span className="font-semibold">record</span> that it was here.
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="wh-attachment-chip inline-flex cursor-pointer items-center gap-2 rounded-lg py-1 pr-2.5 pl-1 text-left"
    >
      {inner}
    </button>
  );
}

/** Same before/after-snapshot diff as computeTagChanges, keyed on
 * filename — no rename pairing (a swapped file is a removal and an
 * addition, never a rename: nothing about two filenames shares a "same
 * thing, new name" relationship the way two tag strings can). */
function computeAttachmentChanges(before: AttachmentFile[], after: AttachmentFile[]): { removed: AttachmentFile[]; added: AttachmentFile[] } {
  const beforeNames = new Set(before.map((f) => f.name));
  const afterNames = new Set(after.map((f) => f.name));
  return {
    removed: before.filter((f) => !afterNames.has(f.name)),
    added: after.filter((f) => !beforeNames.has(f.name)),
  };
}

function attachmentChangeCount(changes: { removed: AttachmentFile[]; added: AttachmentFile[] }): number {
  return changes.removed.length + changes.added.length;
}

function attachmentSideClause(verb: string, files: AttachmentFile[]): string | null {
  if (files.length === 0) return null;
  return files.length === 1 ? `${verb} an attachment` : `${verb} ${files.length} attachments`;
}

/** The one sentence shape for an attachment change, shared by the
 * top-level attachmentsChanged event and the "Attachments" field inside a
 * multi-change save — removed before added, same order tags always use,
 * one verb ("removed", never "deleted") so tags and files read the same
 * way. */
function attachmentChangeClause(removed: AttachmentFile[], added: AttachmentFile[]): React.ReactNode {
  const removedClause = attachmentSideClause("removed", removed);
  const addedClause = attachmentSideClause("added", added);
  const mixed = removed.length > 0 && added.length > 0;
  return (
    <>
      {removedClause}
      {mixed && " and "}
      {addedClause}
    </>
  );
}

/** The attachment block — same conditional-SpillBlock shell as
 * TagChangeBlock (see its own doc comment for the `boxed` rule): bordered
 * only when there's a sibling to separate from (a multi-change sub-row,
 * always; a single-change event, only when both Removed and Added are
 * non-empty). Labels appear only once both groups are present — a lone
 * label column would be a column of one, so a single-direction change's
 * chips start at the block's own padding (or the card's own sentence
 * margin, when it's bare) instead. */
function AttachmentChangeBlock({
  changes,
  highlight,
  query,
  onOpen,
  boxed,
}: {
  changes: { removed: AttachmentFile[]; added: AttachmentFile[] };
  highlight: boolean;
  query: string;
  onOpen: (file: AttachmentFile) => void;
  boxed: boolean;
}) {
  const twoGroups = changes.removed.length > 0 && changes.added.length > 0;
  const content = (
    <div className="flex flex-col gap-3">
      {changes.removed.length > 0 && (
        <CappedChipGroup
          label={twoGroups ? "Removed" : undefined}
          chipHeight={ATTACHMENT_CHIP_HEIGHT}
          items={changes.removed}
          textFor={(f) => f.name}
          query={query}
          renderChip={(f) => <AttachmentChip key={f.name} file={f} removed highlight={highlight} query={query} onOpen={() => onOpen(f)} />}
        />
      )}
      {changes.added.length > 0 && (
        <CappedChipGroup
          label={twoGroups ? "Added" : undefined}
          chipHeight={ATTACHMENT_CHIP_HEIGHT}
          items={changes.added}
          textFor={(f) => f.name}
          query={query}
          renderChip={(f) => <AttachmentChip key={f.name} file={f} removed={false} highlight={highlight} query={query} onOpen={() => onOpen(f)} />}
        />
      )}
    </div>
  );
  return boxed ? <SpillBlock>{content}</SpillBlock> : content;
}

/* ─────────────────────── structured long values (address, etc.) ─────────────────────── */

/** A structured value (both sides the same shape, differing in one part)
 * shown as two labelled rows instead of inline "from X to Y". The
 * alignment IS the feature: From and To share one label column, so the
 * one changed part lands in the same horizontal position on both lines
 * and the eye finds it without reading either value through. No "to"
 * here — the labels replace it, so GAP/Sep don't apply.
 *
 * Always bare — From/To is one value shown in two parts, not a Removed/
 * Added pair of groups, so it never gets SpillBlock's border itself: a
 * single-change address has nothing to separate from, and a sub-row
 * address (which DOES, from its siblings) wraps THIS in a SpillBlock at
 * its own call site (FieldSubRow) instead of this component owning one.
 * No margin of its own either — the top-level longRow wrapper supplies
 * 12px, a sub-row's own wrapper supplies SUBROW_BLOCK_GAP (6px). */
export function LabelledFromTo({ before, after, query }: { before: string; after: string; query: string }) {
  const highlight = useContext(HighlightChangesContext);
  const { before: bSeg, after: aSeg } = diffMarked(before, after);
  return (
    <div className="space-y-[3px]">
      <div className="flex items-baseline gap-4">
        <span className="w-12 shrink-0 text-[10.5px] font-semibold tracking-[0.05em] text-muted-foreground">{marks("From", query)}</span>
        <span className="text-[12.5px] text-muted-foreground">{renderMarkSegs(bSeg, "removed", highlight, query)}</span>
      </div>
      <div className="flex items-baseline gap-4">
        <span className="w-12 shrink-0 text-[10.5px] font-semibold tracking-[0.05em] text-muted-foreground">{marks("To", query)}</span>
        <span className="text-[12.5px] font-medium text-foreground">{renderMarkSegs(aSeg, "added", highlight, query)}</span>
      </div>
    </div>
  );
}

/* ─────────────────────── description: one marked-in-place passage ─────────────────────── */

function renderUnifiedSegs(segs: { text: string; type: "same" | "removed" | "added" }[], highlight: boolean, query: string) {
  return segs.map((seg, i) => {
    if (seg.type === "same") return <span key={i}>{marks(seg.text, query)}</span>;
    // Removed holds the same line regardless of highlight — see
    // removedValueStyle's own doc comment. Added still goes fully plain
    // when highlight is off, since there's no structural fact left to
    // show once the tint is gone (nothing was deleted).
    if (seg.type === "removed") {
      return (
        <span key={i} style={removedValueStyle(true, highlight)}>
          {marks(seg.text, query)}
        </span>
      );
    }
    if (!highlight) return <span key={i}>{marks(seg.text, query)}</span>;
    return (
      <span key={i} className="rounded-[3px] px-[2px]" style={MARK_ADDED}>
        {marks(seg.text, query)}
      </span>
    );
  });
}

/** A description change read as ONE edited passage — sentence by
 * sentence (diffParagraphs), with a changed sentence further marked at
 * the character level (diffUnified) so the removal sits struck through
 * right where it was removed and the addition sits highlighted right
 * where it was added. Prose doesn't align line-by-line the way a
 * structured value does, so there's no "From"/"To" here — you read the
 * edit once, in place, instead of two near-duplicate paragraphs. */
export function DescriptionPassage({
  before,
  after,
  onOpenCompare,
  query,
}: {
  before: string;
  after: string;
  onOpenCompare: () => void;
  query: string;
}) {
  const highlight = useContext(HighlightChangesContext);
  const blocks = useMemo(() => diffParagraphs(before, after), [before, after]);
  return (
    // block, not inline — a top margin on the button below only gets
    // honoured once this wrapper is a block itself. The clamped span
    // above is already a block (-webkit-box), so this was actually
    // already stacking on its own line for free; the real gap was 0
    // because nothing but a stray space character sat between them.
    <span className="block">
      <span
        className="text-foreground"
        style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
      >
        {blocks.map((block, i) => {
          if (block.kind === "equal") return <span key={i}>{marks(block.text, query)} </span>;
          if (block.kind === "pair") return <span key={i}>{renderUnifiedSegs(diffUnified(block.before, block.after), highlight, query)} </span>;
          if (block.kind === "before-only") return <span key={i}>{renderUnifiedSegs([{ text: block.text, type: "removed" }], highlight, query)} </span>;
          return <span key={i}>{renderUnifiedSegs([{ text: block.text, type: "added" }], highlight, query)} </span>;
        })}
      </span>
      {/* No left margin — Show more carries ml-[14px] to align under the
       * sub-row text column, past the bullet; this aligns to the
       * description's own left edge instead, which is this wrapper's. */}
      <button
        type="button"
        onClick={onOpenCompare}
        className="block mt-2 text-[12.5px] font-medium text-primary underline underline-offset-2 decoration-1 cursor-pointer whitespace-nowrap"
      >
        Show Comparison
      </button>
    </span>
  );
}

function formatCompareTimestamp(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${date}, ${time}`;
}

/** uploadedDate/uploadedTime for the attachment preview modal — always
 * the OWNING EVENT's own actor/timestamp, never stored per file: a file
 * has no save of its own apart from the event that added or removed it. */
function formatAttachmentDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase();
  return { date, time };
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** The real comparison view — CompareBody, ported from detail-modal.tsx's
 * own agreed design (PREVIOUS/NEW word counts, changed sentences marked,
 * unchanged ones dimmed), not a bespoke two-column dump. This dialog is
 * only the shell: the Dialog, the open state, and a header matching that
 * same design (back chevron, title, attribution subtitle). */
function FullCompareDialog({
  open,
  onOpenChange,
  beforeText,
  afterText,
  actor,
  timestamp,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  beforeText: string;
  afterText: string;
  actor: string;
  timestamp: string;
}) {
  const blocks = useMemo(() => diffParagraphs(beforeText, afterText), [beforeText, afterText]);
  const longTextNoun = useContext(EntityContext).profile.longTextNoun ?? "description";
  const before: DetailLongTextValue = { kind: "longText", text: beforeText, words: wordCount(beforeText) };
  const after: DetailLongTextValue = { kind: "longText", text: afterText, words: wordCount(afterText) };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="activity-log-portal flex flex-col gap-0 overflow-hidden p-0 [&>button:last-child]:hidden"
        style={{ width: "min(92vw, 988px)", maxWidth: "none", height: "auto", maxHeight: "min(85vh, 840px)" }}
      >
        {/* bg-card, not the dialog's own default bg-background — that
         * token is a faint grey (see theme.css), which read as a toolbar
         * strip sitting over the two genuinely-white compare cards below. */}
        <div className="relative shrink-0 border-b border-border bg-card px-6 py-5">
          <div className="min-w-0 pr-10">
            <DialogTitle asChild>
              <h2 className="text-foreground" style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.4 }}>
                {actor} updated the {longTextNoun}
              </h2>
            </DialogTitle>
            {/* No warehouse, no actor — both already said: the actor is
             * now in the title, and the warehouse is implied by the page
             * this modal opens over, the same rule every row follows. */}
            <DialogDescription asChild>
              <p className="text-muted-foreground" style={{ fontSize: 12.5, marginTop: 4 }}>
                {formatCompareTimestamp(timestamp)}
              </p>
            </DialogDescription>
          </div>
          {/* This modal opens OVER the log, not forward from it — a back
           * chevron implied a view to return to and didn't act like one.
           * Vendor Invoicing's own modal close (InvoiceTypeSelectionModal.tsx:35-41):
           * a plain square, no border/shadow, background only on hover —
           * distinct from the circular one on the contact card, which
           * sits over a photo and needs the contrast. */}
          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-muted hover:text-slate-600"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <CompareBody before={before} after={after} blocks={blocks} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────── one event's text, for search ─────────────────────── */

function eventSearchText(event: ActivityEvent, profile: EntityProfile): string {
  const parts: string[] = [event.actor];
  switch (event.kind) {
    case "created":
      parts.push(`created this ${profile.entityNoun}`);
      // The sentence only ever says "created this warehouse", but the
      // sub-row list underneath it names and shows every starting value
      // — so a search for one of those values (a person, a tag, an
      // address) has to be able to find this card too, the same as it
      // would for that value appearing in any other event.
      for (const i of event.initial) parts.push(i.field, fieldValueText(i.value));
      break;
    case "childAdded":
      parts.push(`added the ${profile.childNoun}`, event.childCode);
      break;
    case "childStatusChanged":
      if (profile.statusVerbs !== false && event.after.label === "Archived" && event.before.label !== "Archived") parts.push(`archived the ${profile.childNoun}`, event.childCode);
      else if (profile.statusVerbs !== false && event.before.label === "Archived" && event.after.label !== "Archived") parts.push(`restored the ${profile.childNoun}`, event.childCode, "from the archive");
      else parts.push(`updated the status of the ${profile.childNoun}`, event.childCode, event.before.label, event.after.label);
      break;
    case "attachmentsChanged":
      if (event.removed.length > 0) parts.push("removed the attachments", ...event.removed.map((f) => f.name));
      if (event.added.length > 0) parts.push("added the attachments", ...event.added.map((f) => f.name));
      break;
    case "fields":
      if (event.section && event.changes.length > 1) parts.push(`changes to the ${event.section}`);
      for (const c of event.changes) {
        // The field name alone is not what the card says. A sub-row reads
        // "Tags added" or "Attachments updated", so the verb has to be in
        // the index too — otherwise the sentence shows a word the search
        // cannot find.
        parts.push(`${c.field} updated`, fieldValueText(c.before), fieldValueText(c.after));
        // A value with no before reads "set to": index both wordings.
        if (emptyTextSide(c.before, c.after) === "added") parts.push(`${c.field} set to set the ${fieldVerb(c.field)} to`);
        if (c.before.kind === "tags" && c.after.kind === "tags") {
          parts.push(`${c.field} ${tagVerb(computeTagChanges(c.before.items, c.after.items))}`);
          parts.push(tagHeadText(c.field, c.before.items, c.after.items));
        }
        if (c.before.kind === "attachments" && c.after.kind === "attachments") {
          const ch = computeAttachmentChanges(c.before.items, c.after.items);
          if (ch.added.length > 0) parts.push(`${c.field} added`);
          if (ch.removed.length > 0) parts.push(`${c.field} removed`);
        }
      }
      break;
    case "descriptionEdited":
      parts.push(`updated the ${profile.longTextNoun ?? "description"}`, event.before, event.after);
      break;
    case "descriptionRewritten":
      parts.push(`updated the ${profile.longTextNoun ?? "description"}`, event.beforeText, event.afterText);
      break;
    default: {
      // A kind only this module logs — its profile owns the words. Its
      // sub-rows are searchable too, the way a fields event's changes are.
      const spec = profile.extraKinds[(event as { kind: string }).kind];
      if (spec) parts.push(...spec.searchText(event), ...(spec.subRowText?.(event) ?? []));
    }
  }
  // "applied from the deactivation of C-1005" sits on the timestamp line, but a search for it must still find the card.
  const appliedFrom = "appliedFrom" in event ? (event as { appliedFrom?: string }).appliedFrom : undefined;
  if (appliedFrom) parts.push("applied from", appliedFrom);
  // Made through the Omne connector: "Claude" finds every such entry.
  if ((event as { connector?: string }).connector === "claude") parts.push("through Claude");
  // A system action's trigger sits on the timestamp line too.
  const trigger = "trigger" in event ? (event as { trigger?: string }).trigger : undefined;
  if (trigger) parts.push(trigger);
  return parts.join(" ");
}

/** The sentence as a person would read it, for the export file. eventSearchText
 * deliberately drops "from"/"to" (they would only add noise to the index); an
 * exported row has to keep them or "Active Archived" reads as two values with
 * no direction. Kinds a profile adds fall back to their search text. */
function eventPlainText(event: ActivityEvent, profile: EntityProfile): string {
  const ft = (field: string, before: FieldValue, after: FieldValue) => {
    if (before.kind === "tags" && after.kind === "tags") {
      const t = tagHeadText(field, before.items, after.items);
      if (t) return t;
    }
    const emptySide = emptyTextSide(before, after);
    if (emptySide === "added") return `set the ${fieldVerb(field)} to ${fieldValueText(after)}`;
    if (emptySide === "removed") return `removed the ${fieldVerb(field)} ${fieldValueText(before)}`;
    if (profile.statusVerbs !== false && before.kind === "status" && after.kind === "status" && after.label === "Archived" && before.label !== "Archived") return `archived this ${profile.entityNoun}`;
    if (profile.statusVerbs !== false && before.kind === "status" && after.kind === "status" && before.label === "Archived" && after.label !== "Archived") return `restored this ${profile.entityNoun} from the archive`;
    return `updated the ${fieldVerb(field)} from ${fieldValueText(before) || "not set"} to ${fieldValueText(after) || "removed"}`;
  };
  switch (event.kind) {
    case "created":
      return `created this ${profile.entityNoun}` + (event.initial.length ? ` with ${event.initial.map((i) => `${i.field}: ${fieldValueText(i.value)}`).join("; ")}` : "");
    case "childAdded":
      return `added the ${profile.childNoun} ${event.childCode}`;
    case "childStatusChanged":
      if (profile.statusVerbs !== false && event.after.label === "Archived" && event.before.label !== "Archived") return `archived the ${profile.childNoun} ${event.childCode}`;
      if (profile.statusVerbs !== false && event.before.label === "Archived" && event.after.label !== "Archived") return `restored the ${profile.childNoun} ${event.childCode} from the archive`;
      return `updated the status of the ${profile.childNoun} ${event.childCode} from ${event.before.label} to ${event.after.label}`;
    case "attachmentsChanged": {
      const parts: string[] = [];
      if (event.removed.length) parts.push(`removed ${event.removed.map((f) => f.name).join(", ")}`);
      if (event.added.length) parts.push(`added ${event.added.map((f) => f.name).join(", ")}`);
      return parts.join(" and ");
    }
    case "fields": {
      const appliedFrom = "appliedFrom" in event ? (event as { appliedFrom?: string }).appliedFrom : undefined;
      const lead = event.section && event.changes.length > 1 ? `made ${event.changes.length} changes to the ${event.section}: ` : "";
      return lead + event.changes.map((c) => ft(c.field, c.before, c.after)).join("; ") + (appliedFrom ? ` · applied from ${appliedFrom}` : "");
    }
    case "descriptionEdited":
      return `updated the ${profile.longTextNoun ?? "description"} from "${event.before}" to "${event.after}"`;
    case "descriptionRewritten":
      return `rewrote the ${profile.longTextNoun ?? "description"} (${event.beforeWords} → ${event.afterWords} words)`;
    default: {
      const text = eventSearchText(event, profile);
      const actor = (event as { actor: string }).actor;
      return text.startsWith(`${actor} `) ? text.slice(actor.length + 1) : text;
    }
  }
}

/* ─────────────────────── the event card ─────────────────────── */

/**
 * Splits an event into the SHORT head clause that sits on the actor's own
 * line, and an optional long-row that drops beneath the timestamp. A
 * long-row only exists when a value pair won't sit on one line with the
 * sentence (isLongPair) — a code or a name keeps the old-value/new-value
 * pair inline; a description or a long address pushes it below.
 */
function getEventParts(
  event: ActivityEvent,
  query: string,
  highlight: boolean,
  onOpenCompare: (() => void) | undefined,
  onOpenAttachment: ((file: AttachmentFile) => void) | undefined,
  profile: EntityProfile,
): EventParts {
  switch (event.kind) {
    case "created":
      return {
        head: (
          <>
            <ActorLink name={event.actor} query={query} /> created this {profile.entityNoun}
          </>
        ),
        longRow: null,
      };
    case "childAdded":
      return {
        head: (
          <>
            <ActorLink name={event.actor} query={query} /> added the {profile.childNoun} <EntityLink href={event.href} text={event.childCode} query={query} />
          </>
        ),
        longRow: null,
      };
    case "childStatusChanged":
      // With statusVerbs off (every module now) a child's status change is
      // the same pair as the record's own: "updated the status of the
      // location LOC-F2 from Active to Archived". The verbs remain for a
      // profile that turns them back on.
      if (profile.statusVerbs !== false && event.after.label === "Archived" && event.before.label !== "Archived") {
        return {
          head: (
            <>
              <ActorLink name={event.actor} query={query} /> archived the {profile.childNoun} <EntityLink href={event.href} text={event.childCode} query={query} />
            </>
          ),
          longRow: null,
        };
      }
      if (profile.statusVerbs !== false && event.before.label === "Archived" && event.after.label !== "Archived") {
        return {
          head: (
            <>
              <ActorLink name={event.actor} query={query} /> restored the {profile.childNoun} <EntityLink href={event.href} text={event.childCode} query={query} /> from the archive
            </>
          ),
          longRow: null,
        };
      }
      return {
        head: (
          <>
            <ActorLink name={event.actor} query={query} /> updated the status of the {profile.childNoun}{" "}
            <EntityLink href={event.href} text={event.childCode} query={query} />
            <Lead before="status" query={query} />
            <span className="inline-flex flex-wrap items-center align-middle">
              <StatusPillNode label={event.before.label} active={event.before.active} query={query} />
              <Sep before="status" after="status" query={query} />
              <StatusPillNode label={event.after.label} active={event.after.active} query={query} />
            </span>
          </>
        ),
        longRow: null,
      };
    case "attachmentsChanged": {
      const changes = { added: event.added, removed: event.removed };
      // No inline path at any count. An attachment chip carries a 26px
      // file tile and a filename; two of them inside a sentence push the
      // line box past every other row in the list and the sentence stops
      // reading as one.
      const mixed = changes.removed.length > 0 && changes.added.length > 0;
      return {
        head: (
          <>
            <ActorLink name={event.actor} query={query} />{" "}
            {mixed ? "updated the attachments" : attachmentChangeClause(changes.removed, changes.added)}
          </>
        ),
        longRow: <AttachmentChangeBlock changes={changes} highlight={highlight} query={query} onOpen={onOpenAttachment!} boxed={mixed} />,
      };
    }
    case "descriptionEdited":
      return {
        head: (
          <>
            <ActorLink name={event.actor} query={query} /> updated the {profile.longTextNoun ?? "description"}
          </>
        ),
        longRow: <DescriptionPassage before={event.before} after={event.after} query={query} onOpenCompare={onOpenCompare!} />,
      };
    case "descriptionRewritten":
      return {
        head: (
          <>
            <ActorLink name={event.actor} query={query} /> updated the {profile.longTextNoun ?? "description"}
          </>
        ),
        longRow: <DescriptionPassage before={event.beforeText} after={event.afterText} query={query} onOpenCompare={onOpenCompare!} />,
      };
    case "fields": {
      if (event.changes.length === 1) {
        const change = event.changes[0];
        const { field, before, after } = change;
        // Any person field with one side empty gets its own sentence
        // ("removed X as the finance owner"), not a from/to pair.
        const isPocEdgeCase =
          before.kind === "person" &&
          after.kind === "person" &&
          (after.name === null || before.name === null);
        // Tags always go through FieldChangeClause's own changed-only
        // treatment, never the long-row labelled rows — a tags field can
        // trip isLongPair on raw character count (many tags joined) even
        // when only one actually changed, and joining the full lists as
        // plain text would reintroduce the "print both lists in full"
        // problem this was built to avoid.
        const isTagsCase = before.kind === "tags" && after.kind === "tags";
        const isAttachmentsCase = field.toLowerCase() === "attachments" && before.kind === "attachments" && after.kind === "attachments";
        // Past 3 changed tags (INLINE_CHIP_CEILING, same test
        // FieldChangeClause already applies to build the sentence), the
        // chips come back as a block in the longRow slot instead of
        // inline — the one case where a tags change DOES use a longRow,
        // for a reason unrelated to isLongPair's character-count test.
        // Boxed only when BOTH Removed and Added are non-empty: a
        // single-change event with only one direction changed has no
        // sibling on the card to separate from, so it renders bare.
        if (isTagsCase && before.kind === "tags" && after.kind === "tags") {
          const tagChanges = computeTagChanges(before.items, after.items);
          if (tagChangeCount(tagChanges) > INLINE_CHIP_CEILING) {
            const boxed = tagGroupCount(tagChanges) > 1;
            return {
              head: (
                <>
                  <ActorLink name={event.actor} query={query} /> <FieldChangeClause change={change} query={query} />
                </>
              ),
              longRow: <TagChangeBlock changes={tagChanges} highlight={highlight} query={query} boxed={boxed} />,
            };
          }
        }
        // Same rule, restated for attachments — a FieldValue "attachments"
        // field only ever appears here as one of several changes inside a
        // multi-change save, but the single-change shape stays handled
        // for consistency with tags.
        if (isAttachmentsCase && before.kind === "attachments" && after.kind === "attachments") {
          const changes = computeAttachmentChanges(before.items, after.items);
          const boxed = changes.removed.length > 0 && changes.added.length > 0;
          return {
            head: (
              <>
                <ActorLink name={event.actor} query={query} /> <FieldChangeClause change={change} query={query} onOpenAttachment={onOpenAttachment} />
              </>
            ),
            longRow: <AttachmentChangeBlock changes={changes} highlight={highlight} query={query} onOpen={onOpenAttachment!} boxed={boxed} />,
          };
        }
        if (!isPocEdgeCase && !isTagsCase && !isAttachmentsCase && !emptyTextSide(before, after) && isLongPair(before, after)) {
          return {
            head: (
              <>
                <ActorLink name={event.actor} query={query} /> updated the {fieldVerb(field)}
              </>
            ),
            longRow: <LabelledFromTo before={fieldValueText(before)} after={fieldValueText(after)} query={query} />,
          };
        }
        return {
          head: (
            <>
              <ActorLink name={event.actor} query={query} /> <FieldChangeClause change={change} query={query} onOpenAttachment={onOpenAttachment} />
            </>
          ),
          longRow: null,
        };
      }
      return {
        head: (
          <>
            <ActorLink name={event.actor} query={query} /> made {event.changes.length} changes{event.section && <> to the {event.section}</>}
          </>
        ),
        longRow: null,
      };
    }
    default: {
      // A kind only this module logs — its profile builds the sentence from
      // the same leaf primitives the built-in kinds use.
      const unknown = event as { kind: string; actor: string };
      const spec = profile.extraKinds[unknown.kind];
      if (spec) return spec.parts(event, { query, highlight, onOpenCompare, onOpenAttachment });
      return {
        head: (
          <>
            <ActorLink name={unknown.actor} query={query} /> updated this {profile.entityNoun}
          </>
        ),
        longRow: null,
      };
    }
  }
}

// The event rail's 9px dot: pt-[19px] already puts its
// centre at 19 + 9/2 = 23.5px from the rail's own top, so an explicit
// box of double that (47) reproduces that exact, already-tuned centre as
// box-height / 2 — needed so the spans below can share the box as their
// positioning context instead of a separately-guessed left offset.
const EVENT_DOT_SIZE = 9;
const EVENT_ROW_FIRST_LINE_H = 47;
const EVENT_DOT_CENTER = EVENT_ROW_FIRST_LINE_H / 2; // 23.5
const EVENT_UPPER_SPAN_H = Math.floor(EVENT_DOT_CENTER - EVENT_DOT_SIZE / 2); // 19
const EVENT_LOWER_SPAN_TOP = Math.ceil(EVENT_DOT_CENTER + EVENT_DOT_SIZE / 2); // 28

// The sub-row dot belongs to the sub-row's first line, always — not to
// whatever variable-height content (a tag chip block) might hang below
// it. Pinned, not centred by flex, so a tall row can't drift it: the
// sentence line is leading-[26px], so its centre is a FIXED 13px from
// the row's own top regardless of how tall the row's content ends up
// being. bottom-[calc(50%+4px)]/top-[calc(50%+4px)] (the old approach)
// resolve against the ROW's own height, which is exactly why a tall row
// moved the dot down with it.
const SUBROW_DOT_CENTER = 13; // leading-[26px] / 2
const SUBROW_DOT_CLEARANCE = 4; // air between the dot and each rail span
const SUBROW_UPPER_SPAN_H = SUBROW_DOT_CENTER - SUBROW_DOT_CLEARANCE; // 9
const SUBROW_LOWER_SPAN_TOP = SUBROW_DOT_CENTER + SUBROW_DOT_CLEARANCE; // 17

// The lower span's reach past the row's own stretched box: normally just
// the row's own pb-4 (16px), to land exactly on the row's true bottom
// edge where the next same-day card begins immediately. Crossing into
// the next day inserts real extra space first — that day's own mt-4,
// then the sticky band itself (measured: 36.5px, py-2 + the 13px label's
// line-height + its 1px border) — so the reach has to clear all three,
// not just the row's own padding, for the line to pass behind the band
// and reappear below it instead of stopping dead.
const EVENT_ROW_GAP = 16; // pb-4
const DAY_GROUP_MARGIN = 16; // mt-4 on the next day's group wrapper
const DAY_BAND_HEIGHT = 36.5; // measured: py-2 + 13px/semibold label + border-b
const DAY_BOUNDARY_RAIL_GAP = EVENT_ROW_GAP + DAY_GROUP_MARGIN + DAY_BAND_HEIGHT;

function EventCard({
  event,
  query,
  isFirst,
  isLast,
  isLastOfDay,
  expanded,
  onToggle,
}: {
  event: ActivityEvent;
  query: string;
  isFirst: boolean;
  isLast: boolean;
  isLastOfDay: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const highlight = useContext(HighlightChangesContext);
  const entity = useContext(EntityContext);
  // One compare target for the whole card, whichever description it came
  // from — the top-level event's own description, or one Description
  // FieldChange inside a multi-change save. Open = non-null.
  const [compareTexts, setCompareTexts] = useState<{ before: string; after: string } | null>(null);
  // One attachment preview target for the whole card, same pattern as
  // Show Comparison — whichever chip was tapped, wherever it sits (the
  // top-level attachment row, a tags-style block, an inline sub-row
  // clause). Each opener closes the other's state first — nothing on this
  // card can ever show both at once, even on a hypothetical card with
  // both a description AND an attachment change to open from.
  const [previewFile, setPreviewFile] = useState<AttachmentFile | null>(null);
  const openCompare = (before: string, after: string) => {
    setPreviewFile(null);
    setCompareTexts({ before, after });
  };
  const openAttachment = (file: AttachmentFile) => {
    setCompareTexts(null);
    setPreviewFile(file);
  };
  const time = format(new Date(event.timestamp), "h:mm a");
  // Only modules that cascade changes set this on their own event types.
  const appliedFrom = "appliedFrom" in event ? (event as { appliedFrom?: string }).appliedFrom : undefined;
  // What set a system action off ("FedEx integration"), beside the time.
  const trigger = "trigger" in event ? (event as { trigger?: string }).trigger : undefined;

  const { head, longRow, subRows } = getEventParts(
    event,
    query,
    highlight,
    () => {
      if (event.kind === "descriptionEdited") openCompare(event.before, event.after);
      else if (event.kind === "descriptionRewritten") openCompare(event.beforeText, event.afterText);
    },
    (file) => openAttachment(file),
    entity.profile,
  );

  // One list, three kinds of row — a field change, a creation's starting
  // value, or a custom kind's own sub-rows. Everything below this (the
  // three-row cut, the dots, the hairlines, "Show N more") is shared, so
  // a creation or a custom kind gets the whole multi-change treatment
  // without a second copy of it.
  const allRows: ({ kind: "change"; change: FieldChange } | { kind: "initial"; field: string; value: FieldValue } | { kind: "custom"; node: React.ReactNode })[] =
    event.kind === "fields"
      ? event.changes.map((change) => ({ kind: "change" as const, change }))
      : event.kind === "created"
        ? event.initial.map((i) => ({ kind: "initial" as const, field: i.field, value: i.value }))
        : (subRows ?? []).map((r) => ({ kind: "custom" as const, node: r.node }));
  // A change has a handful of facts, never fifty. The cut is for a save that
  // touched many things; on a single-change card it only hides a fact a
  // reader came for.
  const singleChange = !!entity.profile?.extraKinds?.[(event as { kind: string }).kind]?.singleChange;
  const collapses = allRows.length > 3 && !singleChange;
  const visibleChanges = expanded || !collapses ? allRows : allRows.slice(0, 3);
  const hiddenCount = collapses ? Math.max(allRows.length - 3, 0) : 0;
  const hasMore = collapses;

  const { date: previewDate, time: previewTime } = formatAttachmentDateTime(event.timestamp);

  return (
    <div className="wh-activity-row relative flex gap-3.5 pb-4">
      {/* `relative` — the dot's own column, not the row, is the
       * positioning context for the spans below, so the line and the dot
       * share one centre (left-1/2 -translate-x-1/2) by construction
       * instead of two independently-guessed left offsets. This column
       * still stretches to the row's content-box height exactly as
       * before; the lower span's negative bottom compensates for that
       * content box excluding the row's own pb-4 (or, at a day boundary,
       * pb-4 plus the next day's mt-4 plus the band itself), reaching
       * the true start of whatever comes next the same way bottom-0
       * against the row used to for an immediate same-day neighbour. */}
      <div className="relative flex w-[9px] shrink-0 flex-col items-center pt-[19px]">
        {!isFirst && (
          <span
            className="absolute left-1/2 top-0 w-px -translate-x-1/2"
            style={{ height: EVENT_UPPER_SPAN_H, backgroundColor: "var(--border)" }}
          />
        )}
        {/* Hover response, not an ambient pulse — a loop across a list of
         * forty dots would be noise. .wh-activity-row:hover (theme.css)
         * drives this, not a local :hover, because the dot is a sibling
         * that comes BEFORE .wh-activity-card in the DOM — a hover
         * target that small is too easy to miss on purpose anyway. */}
        <span className="wh-activity-dot relative z-10 size-[9px] shrink-0 rounded-full bg-primary" />
        {!isLast && (
          <span
            className="absolute left-1/2 w-px -translate-x-1/2"
            style={{
              top: EVENT_LOWER_SPAN_TOP,
              bottom: -(isLastOfDay ? DAY_BOUNDARY_RAIL_GAP : EVENT_ROW_GAP),
              backgroundColor: "var(--border)",
            }}
          />
        )}
      </div>
      <div className="wh-activity-card min-w-0 flex-1 rounded-[10px] bg-white px-3.5 py-3">
        <div className="flex items-center gap-2.5">
          <ActorAvatarTrigger name={event.actor} size={32} />
          <div className="min-w-0 flex-1">
            {/* leading-[26px], not a relative line-height — 26px is the
             * tallest inline object a sentence can hold (the inline
             * avatar), so every row reserves the same line box whether
             * or not it actually has one, and the text baseline lands in
             * the same place across plain-text and avatar rows alike. */}
            <div className="text-[13.5px] leading-[26px] text-foreground">{<Sentence query={query}>{head}</Sentence>}</div>
            {/* Provenance is metadata about origin, not part of the
             * sentence: a change applied from a parent record says so on
             * the timestamp line, in the same muted type. */}
            <div className="mt-[2px] text-[11.5px] leading-none text-muted-foreground/70">
              {time}
              {(event as { connector?: string }).connector === "claude" && (
                <>
                  {" · "}
                  <span className="inline-flex items-center gap-1 align-middle">
                    <Sparkles aria-hidden className="size-3" />
                    through Claude
                  </span>
                </>
              )}
              {appliedFrom && <> · applied from {appliedFrom}</>}
              {trigger && <> · {trigger}</>}
            </div>
          </div>
        </div>
        {/* mt-3 (12px) — the same gap "Show N more" and "Compare
         * Versions" use under a sentence, so this row doesn't tune its
         * own fourth number. One gap under the sentence, everywhere. */}
        {longRow && <div className="ml-[42px] mt-3 text-[12.5px] text-foreground/80">{longRow}</div>}

        {/* A generic kind with one change says it inline in the head, so a
         * lone sub-row would repeat it. A custom kind has no inline
         * fallback: its rows are the only place its detail exists, so they
         * render from the first one. */}
        {(allRows.length > 1 || allRows[0]?.kind === "custom") && (
          <div className="mt-3">
            {visibleChanges.map((c, i) => (
              <div
                key={i}
                className={cn(
                  "wh-change-row flex items-start gap-2.5",
                  i === visibleChanges.length - 1 ? "pb-0" : "pb-3",
                )}
              >
                {/* items-start on the row, not items-center — the dot
                 * belongs to the sub-row's first line, always, whatever
                 * variable-height content (a tag chip block) hangs below
                 * it on a tall row. Centring by flex resolves against the
                 * ROW's own height, which is exactly why a tall row used
                 * to drift the dot down with it. Pinned instead: the
                 * sentence is leading-[26px], so its centre is a FIXED
                 * 13px from the top regardless of what follows, and
                 * self-stretch still gives this column a real height for
                 * the lower span's reach into the next row's gap (same
                 * reasoning as before — a column with no height of its
                 * own is only as tall as its content, which would make
                 * that reach resolve against nothing). */}
                <div className="relative flex w-[5px] shrink-0 self-stretch">
                  {i > 0 && (
                    <span
                      className="absolute left-1/2 top-0 w-px -translate-x-1/2"
                      style={{ height: SUBROW_UPPER_SPAN_H, backgroundColor: "var(--border-subtle)" }}
                    />
                  )}
                  <span
                    className="wh-change-dot absolute left-1/2 z-10 size-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted-foreground/40"
                    style={{ top: SUBROW_DOT_CENTER }}
                  />
                  {i < visibleChanges.length - 1 && (
                    <span
                      className="absolute left-1/2 bottom-[-12px] w-px -translate-x-1/2"
                      style={{ top: SUBROW_LOWER_SPAN_TOP, backgroundColor: "var(--border-subtle)" }}
                    />
                  )}
                </div>
                <span className="min-w-0 flex-1 text-[12.5px] leading-[26px] text-foreground/80">
                  {c.kind === "change" ? (
                    <FieldSubRow change={c.change} onOpenCompare={openCompare} onOpenAttachment={openAttachment} query={query} />
                  ) : c.kind === "initial" ? (
                    <CreatedSubRow field={c.field} value={c.value} query={query} />
                  ) : (
                    // Through Sentence like every other row, so a search
                    // match in the row's plain words is highlighted too.
                    <Sentence query={query}>{c.node}</Sentence>
                  )}
                </span>
              </div>
            ))}
            {hasMore && (
              <button
                type="button"
                onClick={onToggle}
                className="ml-[14px] mt-3 cursor-pointer text-[12.5px] font-medium text-primary underline decoration-1 underline-offset-2"
              >
                {expanded ? "Show less" : `Show ${hiddenCount} more`}
              </button>
            )}
          </div>
        )}

        <FullCompareDialog
          open={compareTexts !== null}
          onOpenChange={(v) => !v && setCompareTexts(null)}
          beforeText={compareTexts?.before ?? ""}
          afterText={compareTexts?.after ?? ""}
          actor={event.actor}
          timestamp={event.timestamp}
        />

        {previewFile && (
          <AttachmentPreviewModal
            attachment={{
              fileName: previewFile.name,
              fileType: fileExt(previewFile.name),
              fileSize: previewFile.size,
              uploadedBy: event.actor,
              uploadedDate: previewDate,
              uploadedTime: previewTime,
              source: `${entity.profile.entityLabel} ${entity.code}`,
            }}
            onClose={() => setPreviewFile(null)}
          />
        )}
      </div>
    </div>
  );
}

/* ─────────────────────── day grouping ─────────────────────── */

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayBandLabel(iso: string): string {
  const d = new Date(iso);
  // Same rule the date range pill follows: the current year is the
  // reader's own and goes unsaid, any other year is stated. Today can
  // only ever fall in the current year, so the prefix and the year
  // suffix never collide.
  const sameYear = d.getFullYear() === LOG_TODAY.getFullYear();
  const weekday = format(d, sameYear ? "EEEE, MMMM d" : "EEEE, MMMM d, yyyy");
  return isSameDay(d, LOG_TODAY) ? `Today · ${weekday}` : weekday;
}

/** The stroke under a sticky day band only while it's actually stuck — at
 * rest, in normal flow, it's a line separating nothing. Each band tracks
 * its own stuck state independently via IntersectionObserver against the
 * scroll container: the root's own -1px top margin is what makes this
 * work, since a band in normal flow sits fully inside the root
 * (intersectionRatio 1), while one pinned at top:0 overlaps the 1px the
 * margin removed (ratio drops below 1, stuck). The border itself is
 * ALWAYS in the box — only its colour animates to transparent — so a
 * band sticking or unsticking never shifts the list by the border's own
 * width, which would otherwise make DAY_BAND_HEIGHT a lie. */
function DayBand({ label, scrollRef }: { label: string; scrollRef: React.RefObject<HTMLDivElement | null> }) {
  const ref = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const el = ref.current;
    const root = scrollRef.current;
    if (!el || !root) return;
    // 0 < ratio < 0.99, not entry.isIntersecting or a plain `< 1`.
    //
    // A band that hasn't scrolled into view yet reports ratio 0 at the
    // moment it's first observed (every band mounts at once, most of
    // them off-screen below the fold) — the `> 0` half excludes that;
    // without it every band below the fold started "stuck" and only
    // corrected once actually scrolled fully into view (confirmed live).
    //
    // isIntersecting looked like the fix for that, but it's unreliable
    // here: logging real callbacks showed the SAME pinned entry
    // (ratio 0.973) reporting isIntersecting: true from an ad-hoc
    // observer and isIntersecting: false from this one, for identical
    // geometry — not safe to branch on.
    //
    // A plain `< 1` has its own failure: this band's fractional 36.5px
    // height means its "fully visible, not stuck" ratio is ~0.9999, not
    // a clean 1.0 (sub-pixel rounding), so `< 1` alone misreads that as
    // stuck too. 0.99 sits in the gap between the two real states —
    // confirmed live: 0.973 when genuinely pinned, ~0.9999 when not — so
    // sub-pixel noise near 1.0 can't cross it by accident.
    //
    // threshold: [0, 0.99], not just [0.99] — a band that scrolls fully
    // away after being pinned goes 0.973 (stuck) straight to 0
    // (off-screen) without ever crossing back above 0.99, so a
    // single-0.99 observer never fires again and the band is stuck=true
    // forever even once it's gone (confirmed live). The 0 threshold
    // catches that transition too, so leaving the screen entirely always
    // resets it.
    const io = new IntersectionObserver(
      ([entry]) => setStuck(entry.intersectionRatio > 0 && entry.intersectionRatio < 0.99),
      { root, rootMargin: "-1px 0px 0px 0px", threshold: [0, 0.99] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [scrollRef]);

  return (
    <div
      ref={ref}
      className="sticky top-0 z-30 border-b bg-[#F5F7FA] transition-colors"
      style={{ transitionDuration: "150ms", borderBottomColor: stuck ? "var(--border)" : "transparent" }}
    >
      <div className="mx-auto w-full max-w-[900px] px-4 py-2 text-[13px] font-semibold text-foreground">{label}</div>
    </div>
  );
}

/* ─────────────────────── toolbar event/user options ─────────────────────── */

type EventFilterKey = "created" | "added" | "removed" | "updated" | "deleted";

const EVENT_LABELS: Record<EventFilterKey, string> = {
  created: "Created",
  added: "Added",
  removed: "Removed",
  updated: "Updated",
  // A module that can delete a record (Security Settings, 9 Nov 2026).
  deleted: "Deleted",
};

function eventKindOf(event: ActivityEvent, profile: EntityProfile): EventFilterKey {
  const spec = profile.extraKinds[(event as { kind: string }).kind];
  if (spec) return spec.eventKind(event);
  if (event.kind === "created") return "created";
  if (event.kind === "childAdded") return "added";
  if (event.kind === "attachmentsChanged") {
    if (event.added.length > 0 && event.removed.length === 0) return "added";
    if (event.removed.length > 0 && event.added.length === 0) return "removed";
    return "updated";
  }
  if (event.kind === "fields" && event.changes.length === 1) {
    const c = event.changes[0];
    // Clearing any person field is a removal, whatever the seat is called.
    if (c.before.kind === "person" && c.after.kind === "person" && c.after.name === null && c.before.name) return "removed";
  }
  return "updated";
}

/** What a save TOUCHED, as opposed to what it did — the Event pill's
 * verb answers "was something removed", this answers "did the address
 * change". An event can touch several fields at once, so unlike
 * eventKindOf this returns a LIST and an event appears under every key
 * it touched. "created" is deliberately absent: the Event pill already
 * has Created, and a creation touches everything, which would make it
 * noise under every option here. */
type ChangedFilterKey = string;

/** The generic keys every module shares, plus whatever this module's
 * profile adds (its own fields, its child entity). */
function changedLabelsFor(profile: EntityProfile): Record<string, string> {
  return { ...GENERIC_CHANGED_LABELS, ...profile.changedLabels, [profile.childChangedKey]: profile.childChangedLabel };
}

/** Field names as the data writes them, mapped to a filter key. A field
 * with no entry here simply does not appear in the pill rather than
 * inventing an option nobody asked for. */
function fieldToChangedKeyFor(profile: EntityProfile): Record<string, string> {
  return { ...GENERIC_FIELD_TO_CHANGED_KEY, ...profile.fieldToChangedKey };
}

function changedFieldsOf(event: ActivityEvent, profile: EntityProfile): ChangedFilterKey[] {
  switch (event.kind) {
    case "attachmentsChanged":
      return ["attachments"];
    case "childAdded":
    case "childStatusChanged":
      return [profile.childChangedKey];
    case "descriptionEdited":
    case "descriptionRewritten":
      return ["description"];
    case "fields": {
      const map = fieldToChangedKeyFor(profile);
      const keys = new Set<ChangedFilterKey>();
      for (const c of event.changes) {
        const key = map[c.field.toLowerCase()];
        if (key) keys.add(key);
      }
      return [...keys];
    }
    default:
      return profile.extraKinds[(event as { kind: string }).kind]?.changedFields(event) ?? [];
  }
}

// range.from/to are typed optional by react-day-picker's own DateRange,
// but this field has no empty state any more — the initial state, every
// preset, and Apply all guarantee both are set — so asserting them here
// is trusting an invariant this component owns, not skipping real
// validation.
function matchesDateRange(event: ActivityEvent, range: DateRange): boolean {
  const ts = new Date(event.timestamp).getTime();
  const from = new Date(range.from!);
  from.setHours(0, 0, 0, 0);
  const to = new Date(range.to!);
  to.setHours(23, 59, 59, 999);
  return ts >= from.getTime() && ts <= to.getTime();
}

/* ─────────────────────── the component ─────────────────────── */

/** This module's log for one record: its own data, its own profile. */
export function ModuleActivityLog({ code, name }: { code: string; name: string }) {
  const events = useMemo(() => getActivity(code), [code]);
  return <EntityActivityLog entityCode={code} entityName={name} events={events} profile={MODULE_PROFILE} />;
}

/** The name this app's own pages were written against. */
export function WarehouseActivityLog({ warehouseCode, warehouseName }: { warehouseCode: string; warehouseName: string }) {
  return <ModuleActivityLog code={warehouseCode} name={warehouseName} />;
}

/** The one log every module renders. Same component, same logic and
 * interactions everywhere; `profile` is what makes it read as this module's. */
export function EntityActivityLog({
  entityCode,
  entityName,
  events,
  profile,
}: {
  entityCode: string;
  entityName: string;
  events: ActivityEvent[];
  profile: EntityProfile;
}) {
  const allEvents = events;

  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Last 30 days, applied up front as actual state rather than a
  // null/undefined placeholder resolved later — per the review, "the
  // default date range should be preset to 30 days regardless", and this
  // field has no empty state to fall back to any more.
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const to = new Date(LOG_TODAY);
    const from = new Date(LOG_TODAY);
    from.setDate(from.getDate() - 30);
    return { from, to };
  });
  const [datePreset, setDatePreset] = useState<DatePresetKey | null>("last_30");
  const [meMode, setMeMode] = useState(false);
  const [eventFilter, setEventFilter] = useState<EventFilterKey[]>([]);
  const [changedFilter, setChangedFilter] = useState<ChangedFilterKey[]>([]);
  const [userFilter, setUserFilter] = useState<string[]>([]);
  const [exportOpen, setExportOpen] = useState(false);

  // Lifted out of EventCard so a search match can open a card on its
  // own (below), not only a click. userCollapsedIds is the override: a
  // card the search auto-opened still has to close, and stay closed,
  // when "Show less" is pressed — without it, auto-expand would fight
  // the user's own click on every re-render. Both clear whenever the
  // query or a filter changes — a card opened to show a match shouldn't
  // stay open once that search is gone.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [userCollapsedIds, setUserCollapsedIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    setExpandedIds(new Set());
    setUserCollapsedIds(new Set());
  }, [query, dateRange, meMode, eventFilter, userFilter]);
  const toggleExpanded = (id: string, isOpen: boolean) => {
    if (isOpen) {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setUserCollapsedIds((prev) => new Set(prev).add(id));
    } else {
      setExpandedIds((prev) => new Set(prev).add(id));
      setUserCollapsedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const ALL_USERS = useMemo(() => Array.from(new Set(allEvents.map((e) => e.actor))).sort(), [allEvents]);
  const USER_OPTIONS = ALL_USERS.map((name) => ({ key: name, label: name }));
  // Always the same four, in this order, whatever the data holds — a pill
  // whose options change per record is a pill nobody can learn.
  // A profile may name its own options (eventOptions); otherwise the four.
  const EVENT_OPTIONS = ((profile.eventOptions ?? ["added", "created", "removed", "updated"]) as EventFilterKey[]).map((k) => ({ key: k, label: EVENT_LABELS[k] }));
  const ALL_CHANGED_KEYS = useMemo(
    () => Array.from(new Set(allEvents.flatMap((e) => changedFieldsOf(e, profile)))),
    [allEvents, profile],
  );
  const CHANGED_LABELS = changedLabelsFor(profile);
  // Sorted by the label the user reads, not the internal key.
  const CHANGED_OPTIONS = ALL_CHANGED_KEYS.map((k) => ({ key: k, label: CHANGED_LABELS[k] ?? k })).sort((a, b) => a.label.localeCompare(b.label));
  // Me mode means the signed-in user of this module, not a fixed name.
  const me = profile.currentUser ?? CURRENT_USER;

  // The set each pill counts against: the date window, Me mode and the
  // search, but NOT the three pills themselves. Counting against every
  // event regardless of range would promise entries the current window
  // can never show ("Removed 12" with three in view); counting against
  // the fully filtered list would make a pill's own numbers collapse as
  // you tick its options. This is the set the pills actually choose from.
  const countBase = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allEvents
      .filter((e) => matchesDateRange(e, dateRange))
      .filter((e) => !meMode || e.actor === me)
      .filter((e) => !q || eventSearchText(e, profile).toLowerCase().includes(q));
  }, [allEvents, dateRange, meMode, query]);

  const eventCounts = useMemo(() => {
    const out: Partial<Record<EventFilterKey, number>> = {};
    for (const o of EVENT_OPTIONS) out[o.key] = 0;
    for (const e of countBase) out[eventKindOf(e, profile)] = (out[eventKindOf(e, profile)] ?? 0) + 1;
    return out;
  }, [countBase, EVENT_OPTIONS]);

  const userCounts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const o of USER_OPTIONS) out[o.key] = 0;
    for (const e of countBase) out[e.actor] = (out[e.actor] ?? 0) + 1;
    return out;
  }, [countBase, USER_OPTIONS]);

  // One event can touch several fields, so it is counted once per key it
  // touched. These therefore sum to more than the entry count, which is
  // correct: the number answers "how many entries would this option
  // show", not "what share of the list is this".
  const changedCounts = useMemo(() => {
    const out: Partial<Record<ChangedFilterKey, number>> = {};
    for (const o of CHANGED_OPTIONS) out[o.key] = 0;
    for (const e of countBase) {
      for (const k of changedFieldsOf(e, profile)) out[k] = (out[k] ?? 0) + 1;
    }
    return out;
  }, [countBase, CHANGED_OPTIONS]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allEvents
      .filter((e) => matchesDateRange(e, dateRange))
      .filter((e) => !meMode || e.actor === me)
      .filter((e) => eventFilter.length === 0 || eventFilter.includes(eventKindOf(e, profile)))
      .filter((e) => changedFilter.length === 0 || changedFieldsOf(e, profile).some((k) => changedFilter.includes(k)))
      .filter((e) => userFilter.length === 0 || userFilter.includes(e.actor))
      .filter((e) => !q || eventSearchText(e, profile).toLowerCase().includes(q))
      .sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp));
  }, [allEvents, dateRange, meMode, eventFilter, changedFilter, userFilter, query]);

  const groups = useMemo(() => {
    const map = new Map<string, ActivityEvent[]>();
    for (const e of filtered) {
      const k = dayKey(e.timestamp);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(e);
    }
    return Array.from(map.entries());
  }, [filtered]);

  // A card opens on its own when the query only matches a change hidden
  // behind "Show N more" — the search highlighting (renderMarkSegs etc.)
  // is what makes that worth doing; without it this would open a row
  // with nothing visibly matched. userCollapsedIds is the escape hatch:
  // "Show less" on a card the search opened has to actually close it and
  // keep it closed while that query stands, not fight the auto-expand.
  const autoExpandedIds = useMemo(() => {
    if (!query.trim()) return new Set<string>();
    return new Set(filtered.filter((e) => hiddenChangeMatches(e, query, profile)).map((e) => e.id));
  }, [filtered, query]);

  // One row per event, exactly as filtered on screen — the export promises
  // "what you see", so it reads from `filtered`, not allEvents.
  const exportRows = useMemo<ExportRow[]>(
    () =>
      filtered.map((e) => {
        const d = new Date(e.timestamp);
        return {
          date: format(d, "yyyy-MM-dd"),
          time: format(d, "h:mm a"),
          user: e.actor,
          event: EVENT_LABELS[eventKindOf(e, profile)],
          changed: changedFieldsOf(e, profile).map((k) => CHANGED_LABELS[k] ?? k).join(", "),
          details: eventPlainText(e, profile),
        };
      }),
    [filtered, profile, CHANGED_LABELS],
  );
  const inRangeCount = useMemo(() => allEvents.filter((e) => matchesDateRange(e, dateRange)).length, [allEvents, dateRange]);
  const rangeLabel = datePreset === "all" ? "All time" : `${format(dateRange.from!, "MMM d, yyyy")} – ${format(dateRange.to!, "MMM d, yyyy")}`;

  return (
    <EntityContext.Provider value={{ code: entityCode, name: entityName, profile }}>
    <div className="activity-log-root flex h-full flex-col rounded-xl border border-border bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="flex shrink-0 flex-col bg-white">
        <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-2">
          <div className="relative min-w-[200px] max-w-[340px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/60" />
            <input
              ref={searchInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search activity…"
              className="h-9 w-full rounded-lg border border-border/80 bg-white pl-9 pr-8 text-sm shadow-sm outline-none placeholder:text-muted-foreground/50 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
            />
            {/* Vendor Invoicing's own search clear
             * (InvoiceListScreen.tsx:1296-1302) — the pills and the date
             * field already have a way to clear themselves; this was the
             * one control in the row that didn't. */}
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  searchInputRef.current?.focus();
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
          <DateRangeField
            dateRange={dateRange}
            datePreset={datePreset}
            onChange={({ dateRange: next, datePreset: nextPreset }) => {
              setDateRange(next);
              setDatePreset(nextPreset);
            }}
          />
          <div className="ml-auto shrink-0">
            <ExportLogButton onClick={() => setExportOpen(true)} />
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-4 pb-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <MeModeChip active={meMode} onClick={() => setMeMode((v) => !v)} />
          <div className="h-5 w-px shrink-0 bg-border" />
          <MultiSelectFilterPill
            label="Event"
            options={EVENT_OPTIONS}
            selected={eventFilter}
            onToggle={(k) => setEventFilter((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]))}
            onClear={() => setEventFilter([])}
            counts={eventCounts}
          />
          <MultiSelectFilterPill
            label="Changed"
            options={CHANGED_OPTIONS}
            selected={changedFilter}
            onToggle={(k) => setChangedFilter((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]))}
            onClear={() => setChangedFilter([])}
            counts={changedCounts}
          />
          <MultiSelectFilterPill
            label="User"
            options={USER_OPTIONS}
            selected={userFilter}
            onToggle={(k) => setUserFilter((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]))}
            onClear={() => setUserFilter([])}
            searchable
            avatars
            renderAvatar={(name) => <ActorAvatar name={name} size={22} />}
            counts={userCounts}
          />
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto bg-[#F5F7FA] pb-4">
        {groups.length === 0 ? (
          <p className="mx-auto w-full max-w-[900px] px-4 py-8 text-center text-sm text-muted-foreground">No activity matches these filters.</p>
        ) : (
          groups.map(([key, events], gi) => (
            <div key={key} className={gi === 0 ? "mt-2" : "mt-4"}>
              {/* Full-bleed band — the grey fill runs the whole scroller
               * width so no card edge or rail segment ever shows beside
               * it, while the label stays centred in the same 900px
               * column at the same 16px padding it always had. A sticky
               * element never carries its own top margin (it would just
               * scroll the band away from top:0), so mt-2/mt-4 lives on
               * this group wrapper instead. */}
              <DayBand label={dayBandLabel(events[0].timestamp)} scrollRef={scrollRef} />
              <div className="mx-auto w-full max-w-[900px] px-4">
                {events.map((e, i) => {
                  // Explicit collapse wins over both a click-to-open and
                  // the search's own auto-open, so "Show less" actually
                  // closes a card the query opened, not just toggles it
                  // open again on the next render.
                  const isOpen = !userCollapsedIds.has(e.id) && (expandedIds.has(e.id) || autoExpandedIds.has(e.id));
                  return (
                    <EventCard
                      key={e.id}
                      event={e}
                      query={query}
                      isFirst={e === filtered[0]}
                      isLast={e === filtered[filtered.length - 1]}
                      isLastOfDay={i === events.length - 1}
                      expanded={isOpen}
                      onToggle={() => toggleExpanded(e.id, isOpen)}
                    />
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
      <ExportLogModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        entityLabel={profile.entityLabel}
        entityCode={entityCode}
        rows={exportRows}
        totalInRange={inRangeCount}
        rangeLabel={rangeLabel}
      />
    </EntityContext.Provider>
  );
}
