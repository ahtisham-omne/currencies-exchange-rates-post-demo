import { Fragment, useEffect, useRef, useState, type CSSProperties } from "react";
import { ChevronDown, ChevronLeft, FileText, X } from "lucide-react";

import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "../ui/dialog";
import { TEAM, LOG_TYPE_VERBS, type ActivityEvent, type EventDetail } from "./data";
import {
  detailAttachment as attachment,
  detailEmpty as empty,
  detailMarked as marked,
  detailText as text,
  diffMarked,
  diffParagraphs,
  type ChangeSection,
  type DetailAccordionGroup,
  type DetailBadge,
  type DetailFieldAccordion,
  type DetailItemBar,
  type DetailLongTextValue,
  type DetailRow,
  type DetailSectionEntry,
  type DetailSubHeading,
  type DetailValue,
  type MarkSegment,
  type ParagraphBlock,
} from "./types";

/**
 * One data-driven renderer for the Activity Log "View details" modal —
 * ported from warehouse-whispers-34's ActivityDetailModal.tsx, restyled
 * onto this app's own tokens (theme.css). Rows whose EventDetail is the
 * legacy fields/attachment/tag shape (the bulk-generated history) are
 * adapted at render time into a single unnamed section, same as the
 * source. Partner-group-specific entries (partnerHeading) don't exist
 * here — no partner module in this app — so that branch was dropped.
 *
 * Token translations from the source app (not present here under these
 * names, mapped to the nearest real equivalent):
 *   --danger-soft / --danger     -> color-mix(...var(--destructive)...)
 *   --success-soft               -> color-mix(...var(--success)...)
 *   --accent-soft / --accent-strong -> color-mix(...var(--warning)...)
 *   --surface-secondary           -> var(--background) (#F8FAFC — this
 *     app's --muted is #F1F5F9, visibly darker than the source's own
 *     #F9FAFB; --background is the closer match for a field's own fill)
 *   --surface                     -> var(--page-background)
 *   --border-strong                -> var(--border) (this app has one border token)
 *   --shadow-panel                  -> var(--elevation-modal)
 *   --modal-max-h (clamp token)      -> inlined "min(85vh, 840px)"
 *   --text-secondary                 -> var(--muted-foreground)
 *   bg-info-soft / text-info          -> var(--primary-tint-bg) / var(--primary-tint-text)
 *   --color-slate-100                 -> #F1F5F9 (Tailwind's own slate-100)
 */

const DANGER_SOFT = "color-mix(in srgb, var(--destructive) 12%, white)";
const SUCCESS_SOFT = "color-mix(in srgb, var(--success) 12%, white)";
const WARNING_SOFT = "color-mix(in srgb, var(--warning) 14%, white)";
const MODAL_MAX_H = "min(85vh, 840px)";

function formatDetailTimestamp(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  return `${date} · ${time}`;
}

function buildDetailTitle(event: ActivityEvent): string {
  return `${event.actor.name} ${LOG_TYPE_VERBS[event.logType]} ${event.entityCode ?? ""}`.replace(/\s+$/, "");
}

function subtitleEntity(event: ActivityEvent): string {
  if (event.entityCode && event.logType.startsWith("warehouse.")) return `Warehouse ${event.entityCode}`;
  if (event.entityCode && event.logType.startsWith("location.")) return `Location ${event.entityCode}`;
  return event.entityLabel;
}

function formatCompareTimestamp(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${date}, ${time}`;
}

function findLongTextRow(sections: ChangeSection[], field: string): { before: DetailLongTextValue; after: DetailLongTextValue } | null {
  for (const section of sections) {
    for (const entry of section.entries) {
      if ("before" in entry && entry.before.kind === "longText" && entry.after.kind === "longText" && entry.field === field) {
        return { before: entry.before, after: entry.after };
      }
    }
  }
  return null;
}

function sectionsHaveAccordion(sections: ChangeSection[]): boolean {
  return sections.some((s) => s.entries.some((e) => !("before" in e) && (e.kind === "accordionGroup" || e.kind === "fieldAccordion" || e.kind === "itemBar")));
}

function statusTone(label: string): "success" | "accent" | "neutral" {
  const l = label.toLowerCase();
  if (l === "active") return "success";
  if (l === "on hold" || l === "overdue" || l === "partially received") return "accent";
  return "neutral";
}

function adaptLegacyDetail(detail: EventDetail | undefined): ChangeSection[] {
  if (!detail) return [];

  if (detail.kind === "fields") {
    return [
      {
        entries: detail.fields.map((f): DetailRow => {
          if (f.field.toLowerCase() === "point of contact") {
            return {
              field: f.field,
              before: f.from === "—" ? empty("Not set") : { kind: "person", name: f.from },
              after: f.to === "—" ? empty("Removed") : { kind: "person", name: f.to },
            };
          }
          return {
            field: f.field,
            before: f.pill ? { kind: "statusPill", label: f.from, tone: statusTone(f.from) } : marked(f.from),
            after: f.pill ? { kind: "statusPill", label: f.to, tone: statusTone(f.to) } : marked(f.to),
          };
        }),
      },
    ];
  }

  if (detail.kind === "attachment") {
    const row: DetailRow =
      detail.action === "added"
        ? { field: null, before: empty("None"), after: attachment(detail.filename) }
        : detail.action === "removed"
          ? { field: null, before: attachment(detail.filename), after: empty("Deleted") }
          : { field: null, before: text("Previous file"), after: attachment(detail.filename) };
    return [{ entries: [row] }];
  }

  if (detail.kind !== "tag") return [];
  const row: DetailRow =
    detail.action === "added"
      ? { field: null, before: empty("None"), after: { kind: "pillList", items: [{ text: detail.tag }] } }
      : { field: null, before: { kind: "pillList", items: [{ text: detail.tag }] }, after: empty("Removed") };
  return [{ entries: [row] }];
}

function textContent(value: DetailValue): string | null {
  if (value.kind === "text") return value.parts.map((p) => p.text).join("");
  if (value.kind === "code") return value.text;
  return null;
}

function valuesEqual(a: DetailValue, b: DetailValue): boolean {
  if (a.kind !== b.kind) return false;
  const at = textContent(a);
  const bt = textContent(b);
  return at !== null && at === bt;
}

function PersonAvatar({ name }: { name: string }) {
  const actor = TEAM[name];
  const [failed, setFailed] = useState(false);
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full"
      style={{ width: 22, height: 22, backgroundColor: "var(--accent)", color: "var(--primary)", fontSize: 9.5, fontWeight: 700 }}
    >
      {actor?.initials ?? name.slice(0, 2).toUpperCase()}
      {!failed && actor?.avatar && (
        <img src={actor.avatar} alt="" onError={() => setFailed(true)} className="absolute inset-0 size-full object-cover" />
      )}
    </span>
  );
}

function MarkedSpans({ segments, side }: { segments: MarkSegment[]; side: "before" | "after" }) {
  return (
    <>
      {segments.map((seg, i) =>
        seg.marked ? (
          <mark
            key={i}
            className="rounded-[3px]"
            style={{
              padding: "0 3px",
              ...(side === "before"
                ? { backgroundColor: DANGER_SOFT, color: "var(--destructive)" }
                : { backgroundColor: SUCCESS_SOFT, color: "color-mix(in srgb, var(--success) 70%, black)", fontWeight: 600 }),
            }}
          >
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </>
  );
}

function ValueCell({ value, side, counterpart, marks, forceMuted }: { value: DetailValue; side: "before" | "after"; counterpart: DetailValue; marks: MarkSegment[] | null; forceMuted: boolean }) {
  const afterActive = side === "after" && !forceMuted;
  const baseClassName = afterActive ? "text-foreground" : "text-slate-500";
  const baseWeight: CSSProperties = { fontWeight: afterActive ? 500 : 400 };

  switch (value.kind) {
    case "text":
      return (
        <span className={baseClassName} style={baseWeight}>
          {value.parts.map((p, i) =>
            p.marked ? (
              <MarkedSpans key={i} segments={[{ text: p.text, marked: true }]} side={side} />
            ) : (
              <span key={i} className={p.mono ? "font-mono" : undefined} style={p.dim ? { color: "var(--muted-foreground)", fontSize: 11.5, fontWeight: 400 } : undefined}>
                {p.text}
              </span>
            ),
          )}
        </span>
      );

    case "empty":
      return (
        <span className={`italic ${baseClassName}`} style={baseWeight}>
          {value.label}
        </span>
      );

    case "code":
      return (
        <span className={`font-mono ${baseClassName}`} style={{ ...baseWeight, fontSize: 11.5 }}>
          {value.text}
        </span>
      );

    case "attachment":
      return (
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: "var(--primary-tint-bg)", color: "var(--primary-tint-text)" }}>
            <FileText className="size-3.5" />
          </span>
          <span className="truncate text-sm font-medium text-foreground">{value.filename}</span>
        </span>
      );

    case "statusPill": {
      const toneStyle =
        value.tone === "success"
          ? { backgroundColor: SUCCESS_SOFT, color: "var(--success)" }
          : value.tone === "accent"
            ? { backgroundColor: WARNING_SOFT, color: "var(--warning)" }
            : { backgroundColor: "var(--muted)", color: "var(--muted-foreground)" };
      return (
        <span className="inline-flex items-center rounded-full" style={{ ...toneStyle, padding: "2px 10px", fontSize: 11.5, fontWeight: 600 }}>
          {value.label}
        </span>
      );
    }

    case "person":
      return (
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <PersonAvatar name={value.name} />
          <span className={`truncate ${baseClassName}`} style={baseWeight}>
            {value.name}
          </span>
        </span>
      );

    case "pillList": {
      const counterpartIsPillList = counterpart.kind === "pillList";
      const counterpartTexts = counterpartIsPillList ? counterpart.items.map((i) => i.text) : [];
      return (
        <>
          {value.items.map((item, i) => {
            const isNew = side === "after" && !counterpartTexts.includes(item.text);
            const isRemoved = side === "before" && counterpartIsPillList && !counterpartTexts.includes(item.text);
            return (
              <span key={`${item.text}-${i}`} className="inline-flex items-center rounded-full border" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--muted-foreground)", padding: "3px 11px", fontSize: 11.5 }}>
                <span className={item.mono ? "font-mono" : undefined}>
                  {isNew || isRemoved ? <MarkedSpans segments={[{ text: item.text, marked: true }]} side={side} /> : item.text}
                </span>
              </span>
            );
          })}
        </>
      );
    }

    case "marked": {
      const segments = marks ?? [{ text: value.text, marked: false }];
      return (
        <span className={`${baseClassName} ${value.mono ? "font-mono" : ""}`} style={baseWeight}>
          <MarkedSpans segments={segments} side={side} />
        </span>
      );
    }

    case "count": {
      const counterpartCount = counterpart.kind === "count" ? counterpart : null;
      const numberChanged = counterpartCount ? counterpartCount.number !== value.number : false;
      const bracketChanged = counterpartCount ? (counterpartCount.bracket ?? "") !== (value.bracket ?? "") : false;
      return (
        <span className={`${baseClassName} tabular-nums`} style={baseWeight}>
          {numberChanged ? <MarkedSpans segments={[{ text: value.number, marked: true }]} side={side} /> : value.number}{" "}
          <span className="text-slate-500" style={{ fontWeight: 400 }}>{value.unit}</span>
          {value.bracket && (
            <span style={{ color: "var(--muted-foreground)", fontSize: 11.5 }}>
              {" ("}
              <span className={value.bracketMono ? "font-mono" : undefined}>
                {bracketChanged ? <MarkedSpans segments={[{ text: value.bracket, marked: true }]} side={side} /> : value.bracket}
              </span>
              {")"}
            </span>
          )}
        </span>
      );
    }

    case "longText":
      return null;
  }
}

function RowView({ row, isLast }: { row: DetailRow; isLast?: boolean }) {
  let beforeMarks: MarkSegment[] | null = null;
  let afterMarks: MarkSegment[] | null = null;
  if (row.before.kind === "marked" && row.after.kind === "marked") {
    const d = diffMarked(row.before.text, row.after.text);
    beforeMarks = d.before;
    afterMarks = d.after;
  }
  const unchanged = valuesEqual(row.before, row.after);
  const cellBase: CSSProperties = { border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "9px 12px", minHeight: 20, fontSize: 12.5 };

  return (
    <div style={{ marginBottom: isLast ? 0 : 16 }}>
      {row.field &&
        (typeof row.field === "string" ? (
          <p className="text-muted-foreground" style={{ fontSize: 12, fontWeight: 600, marginBottom: 7 }}>{row.field}</p>
        ) : (
          <div className="flex items-center gap-2" style={{ marginBottom: 7 }}>
            <span className="font-mono" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--foreground)" }}>{row.field.code}</span>
            {row.field.badges.map((b, i) => (
              <BadgeView key={i} badge={b} />
            ))}
          </div>
        ))}
      <div className="grid gap-[14px]" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)" }}>
        <div className="flex flex-wrap items-center gap-1.5" style={{ ...cellBase, backgroundColor: "var(--background)" }}>
          <ValueCell value={row.before} side="before" counterpart={row.after} marks={beforeMarks} forceMuted={false} />
        </div>
        <div className="flex flex-wrap items-center gap-1.5" style={{ ...cellBase, backgroundColor: "var(--card)" }}>
          <ValueCell value={row.after} side="after" counterpart={row.before} marks={afterMarks} forceMuted={unchanged} />
        </div>
      </div>
    </div>
  );
}

function LongTextRow({ row, onOpenCompare, isLast }: { row: DetailRow; onOpenCompare: (field: string) => void; isLast?: boolean }) {
  if (row.before.kind !== "longText" || row.after.kind !== "longText") return null;
  const before = row.before;
  const after = row.after;
  const { before: beforeMarks, after: afterMarks } = diffMarked(before.text, after.text);
  const cellBase: CSSProperties = { border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "9px 12px", fontSize: 12.5, lineHeight: 1.5 };
  const clampStyle: CSSProperties = { display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 4, overflow: "hidden" };
  return (
    <div style={{ marginBottom: isLast ? 0 : 16 }}>
      {row.field && <p className="text-muted-foreground" style={{ fontSize: 12, fontWeight: 600, marginBottom: 7 }}>{row.field as string}</p>}
      <div className="grid gap-[14px]" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)" }}>
        <div className="text-slate-500" style={{ ...cellBase, backgroundColor: "var(--background)", fontWeight: 400 }}>
          <p style={clampStyle}><MarkedSpans segments={beforeMarks} side="before" /></p>
        </div>
        <div className="text-foreground" style={{ ...cellBase, backgroundColor: "var(--card)", fontWeight: 500 }}>
          <p style={clampStyle}><MarkedSpans segments={afterMarks} side="after" /></p>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 rounded-[8px]" style={{ border: "1px solid var(--border)", backgroundColor: "var(--background)", padding: "11px 14px" }}>
        <span style={{ fontSize: 12.5, color: "var(--muted-foreground)" }}>{row.field as string} too long to view here</span>
        <button type="button" onClick={() => onOpenCompare((row.field as string) ?? "")} className="shrink-0 cursor-pointer" style={{ fontSize: 12.5, fontWeight: 500, color: "var(--primary)" }}>
          Open full comparison →
        </button>
      </div>
    </div>
  );
}

function HeadingBar({ text: label, note, isFirst = false }: { text: string; note?: string; isFirst?: boolean }) {
  return (
    <div style={{ display: "block", marginTop: isFirst ? 0 : 20, paddingTop: isFirst ? 0 : 20, borderTop: isFirst ? undefined : "1px solid var(--border)", marginBottom: 10 }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", whiteSpace: "nowrap", color: "var(--muted-foreground)" }}>{label}</span>
      {note && <span className="tabular-nums" style={{ float: "right", fontSize: 11.5, color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>{note}</span>}
    </div>
  );
}

function isRow(entry: DetailSectionEntry): entry is DetailRow {
  return "before" in entry;
}

function firstHeadingIndex(entries: DetailSectionEntry[]): number {
  return entries.findIndex((e) => !isRow(e) && e.kind === "heading");
}

type RenderCtx = { onOpenCompare: (field: string) => void };

function SectionEntryItem({ entry, ctx, isLast, isFirstHeading }: { entry: DetailSectionEntry; ctx: RenderCtx; isLast?: boolean; isFirstHeading?: boolean }) {
  if (isRow(entry)) {
    const isLong = entry.before.kind === "longText" || entry.after.kind === "longText";
    return isLong ? <LongTextRow row={entry} onOpenCompare={ctx.onOpenCompare} isLast={isLast} /> : <RowView row={entry} isLast={isLast} />;
  }
  if (entry.kind === "rowGap") return <div style={{ height: 10 }} />;
  if (entry.kind === "itemBar") return null;
  if (entry.kind === "accordionGroup") return <AccordionGroupView group={entry} />;
  if (entry.kind === "fieldAccordion") return <FieldAccordionView accordion={entry} ctx={ctx} />;
  const heading = entry as DetailSubHeading;
  return <HeadingBar text={heading.text} note={heading.note} isFirst={isFirstHeading ?? false} />;
}

function groupByItemBar(entries: DetailSectionEntry[]): { leading: DetailSectionEntry[]; items: { bar: DetailItemBar; body: DetailSectionEntry[] }[] } {
  const leading: DetailSectionEntry[] = [];
  const items: { bar: DetailItemBar; body: DetailSectionEntry[] }[] = [];
  for (const entry of entries) {
    if (!isRow(entry) && entry.kind === "itemBar") {
      items.push({ bar: entry, body: [] });
      continue;
    }
    if (items.length > 0) items[items.length - 1].body.push(entry);
    else leading.push(entry);
  }
  return { leading, items };
}

function BadgeView({ badge }: { badge: DetailBadge }) {
  const isLot = Array.isArray(badge);
  const kind = isLot ? badge[1] : badge;
  return (
    <span className="inline-flex items-center overflow-hidden whitespace-nowrap" style={{ height: 20, border: "1px solid var(--border)", borderRadius: "var(--radius-md)", fontSize: 9.5, letterSpacing: "0.03em" }}>
      {isLot && (
        <span className="flex h-full items-center" style={{ backgroundColor: "#F1F5F9", color: "var(--foreground)", fontWeight: 700, padding: "0 6px", borderRight: "1px solid var(--border)" }}>
          {badge[0]}
        </span>
      )}
      <span className="flex h-full items-center" style={{ backgroundColor: "var(--card)", color: "var(--muted-foreground)", fontWeight: 600, padding: "0 7px" }}>{kind}</span>
    </span>
  );
}

const STICKY_THRESHOLD = 10;
const ACCORDION_EASE = "cubic-bezier(0.4, 0, 0.2, 1)";

function AccordionGroupView({ group }: { group: DetailAccordionGroup }) {
  const [open, setOpen] = useState(false);
  const sticky = open && group.count > STICKY_THRESHOLD;
  return (
    <div style={{ overflow: "visible", marginTop: 16 }}>
      <div style={{ backgroundColor: "var(--card)", paddingTop: 4, ...(sticky ? { position: "sticky", top: 0, zIndex: 20 } : null) }}>
        <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2" style={{ padding: "12px 14px", backgroundColor: "var(--background)", border: "1px solid var(--border)", borderBottom: open ? "0" : "1px solid var(--border)", borderRadius: open ? "var(--radius-lg) var(--radius-lg) 0 0" : "var(--radius-lg)" }}>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)", transition: `transform 240ms ${ACCORDION_EASE}` }} />
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted-foreground)" }}>{group.title}</span>
          <span className="ml-auto tabular-nums" style={{ fontSize: 11.5, color: "var(--text-tertiary)" }}>{group.count} affected</span>
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateRows: open ? "1fr" : "0fr", transition: `grid-template-rows 240ms ${ACCORDION_EASE}`, ...(open ? { border: "1px solid var(--border)", borderTop: "0", borderRadius: "0 0 var(--radius-lg) var(--radius-lg)" } : { border: "0" }) }}>
        <div style={{ overflow: "hidden", minHeight: 0 }}>
          <div style={{ padding: "14px 14px 16px", opacity: open ? 1 : 0, transition: `opacity 140ms ease ${open ? 80 : 0}ms` }}>
            {group.rows.map((row, i) => (
              <RowView key={i} row={row} isLast={i === group.rows.length - 1} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldAccordionView({ accordion, ctx }: { accordion: DetailFieldAccordion; ctx: RenderCtx }) {
  const [open, setOpen] = useState(false);
  const firstIdx = firstHeadingIndex(accordion.entries);
  const sticky = open && accordion.count > STICKY_THRESHOLD;
  return (
    <div style={{ overflow: "visible", marginTop: 8 }}>
      <div style={{ backgroundColor: "var(--card)", paddingTop: 4, ...(sticky ? { position: "sticky", top: 0, zIndex: 20 } : null) }}>
        <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2" style={{ padding: "13px 14px", backgroundColor: "var(--background)", border: "1px solid var(--border)", borderBottom: open ? "0" : "1px solid var(--border)", borderRadius: open ? "var(--radius-lg) var(--radius-lg) 0 0" : "var(--radius-lg)" }}>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)", transition: `transform 240ms ${ACCORDION_EASE}` }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{accordion.title}</span>
          <span className="ml-auto tabular-nums" style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.04em", color: "var(--text-tertiary)" }}>
            {accordion.countLabel ?? `${accordion.count} CHANGE${accordion.count === 1 ? "" : "S"}`}
          </span>
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateRows: open ? "1fr" : "0fr", transition: `grid-template-rows 240ms ${ACCORDION_EASE}`, ...(open ? { border: "1px solid var(--border)", borderTop: "0", borderRadius: "0 0 var(--radius-lg) var(--radius-lg)" } : { border: "0" }) }}>
        <div style={{ overflow: "hidden", minHeight: 0 }}>
          <div style={{ padding: "4px 14px 16px", opacity: open ? 1 : 0, transition: `opacity 140ms ease ${open ? 80 : 0}ms` }}>
            {accordion.entries.map((entry, i) => (
              <SectionEntryItem key={i} entry={entry} ctx={ctx} isLast={i === accordion.entries.length - 1} isFirstHeading={i === firstIdx} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ItemAccordionCard({ bar, body, ctx }: { bar: DetailItemBar; body: DetailSectionEntry[]; ctx: RenderCtx }) {
  const [open, setOpen] = useState(true);
  const firstIdx = firstHeadingIndex(body);
  return (
    <div style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-xl)", boxShadow: "var(--elevation-xs)", overflow: "hidden", marginTop: 12 }}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2" style={{ padding: "12px 16px", backgroundColor: "color-mix(in srgb, var(--page-background) 50%, white)", borderBottom: "1px solid var(--border)" }}>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)", transition: `transform 240ms ${ACCORDION_EASE}` }} />
        <span className="font-mono" style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{bar.code}</span>
        {bar.badges.map((b, bi) => (
          <BadgeView key={bi} badge={b} />
        ))}
      </button>
      <div style={{ display: "grid", gridTemplateRows: open ? "1fr" : "0fr", transition: `grid-template-rows 240ms ${ACCORDION_EASE}` }}>
        <div style={{ overflow: "hidden", minHeight: 0 }}>
          <div style={{ padding: "14px 16px 16px", opacity: open ? 1 : 0, transition: `opacity 140ms ease ${open ? 80 : 0}ms` }}>
            {body.map((entry, i) => (
              <SectionEntryItem key={i} entry={entry} ctx={ctx} isLast={i === body.length - 1} isFirstHeading={i === firstIdx} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionEntriesView({ entries, ctx }: { entries: DetailSectionEntry[]; ctx: RenderCtx }) {
  const hasItemBar = entries.some((e) => !isRow(e) && e.kind === "itemBar");
  if (!hasItemBar) {
    const firstIdx = firstHeadingIndex(entries);
    return (
      <>
        {entries.map((entry, i) => (
          <SectionEntryItem key={i} entry={entry} ctx={ctx} isLast={i === entries.length - 1} isFirstHeading={i === firstIdx} />
        ))}
      </>
    );
  }
  const { leading, items } = groupByItemBar(entries);
  const leadingFirstIdx = firstHeadingIndex(leading);
  return (
    <>
      {leading.map((entry, i) => (
        <SectionEntryItem key={`leading-${i}`} entry={entry} ctx={ctx} isLast={i === leading.length - 1} isFirstHeading={i === leadingFirstIdx} />
      ))}
      {items.map((group, gi) => (
        <ItemAccordionCard key={gi} bar={group.bar} body={group.body} ctx={ctx} />
      ))}
    </>
  );
}

function ComparePara({ block, side }: { block: ParagraphBlock; side: "before" | "after" }) {
  if (block.kind === "equal") {
    return <p style={{ color: "var(--text-tertiary)", marginBottom: 12 }}>{block.text}</p>;
  }
  if (block.kind === "pair") {
    const diff = diffMarked(block.before, block.after);
    const segments = side === "before" ? diff.before : diff.after;
    return (
      <p style={{ color: "var(--foreground)", marginBottom: 12 }}>
        <MarkedSpans segments={segments} side={side} />
      </p>
    );
  }
  if (block.kind === "before-only" && side === "before") {
    return <p style={{ marginBottom: 12 }}><MarkedSpans segments={[{ text: block.text, marked: true }]} side="before" /></p>;
  }
  if (block.kind === "after-only" && side === "after") {
    return <p style={{ marginBottom: 12 }}><MarkedSpans segments={[{ text: block.text, marked: true }]} side="after" /></p>;
  }
  return null;
}

export function CompareBody({ before, after, blocks }: { before: DetailLongTextValue; after: DetailLongTextValue; blocks: ParagraphBlock[] }) {
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);

  const sync = (source: React.RefObject<HTMLDivElement | null>, target: React.RefObject<HTMLDivElement | null>) => () => {
    if (syncing.current) return;
    syncing.current = true;
    if (source.current && target.current) target.current.scrollTop = source.current.scrollTop;
    syncing.current = false;
  };

  const paneStyle: CSSProperties = { backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-xl)", padding: "20px 22px" };
  // 0.02em, not 0.07em — that wider tracking existed to open up ALL CAPS;
  // under Title case it just reads stretched.
  const labelStyle: CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: "0.02em", color: "var(--muted-foreground)", marginBottom: 10 };

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 min-[1100px]:grid-cols-2">
      <div className="flex min-h-0 flex-col" style={paneStyle}>
        <p style={labelStyle}>
          Previous
          {before.lastEditedOn && ` · last edited ${before.lastEditedOn}`}
          {before.lastEditedBy && ` by ${before.lastEditedBy}`}
        </p>
        <div ref={leftRef} onScroll={sync(leftRef, rightRef)} className="min-h-0 flex-1 overflow-y-auto" style={{ fontSize: 13, lineHeight: 1.7 }}>
          {blocks.map((block, i) => (
            <ComparePara key={i} block={block} side="before" />
          ))}
        </div>
      </div>
      <div className="flex min-h-0 flex-col" style={paneStyle}>
        <p style={labelStyle}>Updated</p>
        <div ref={rightRef} onScroll={sync(rightRef, leftRef)} className="min-h-0 flex-1 overflow-y-auto" style={{ fontSize: 13, lineHeight: 1.7 }}>
          {blocks.map((block, i) => (
            <ComparePara key={i} block={block} side="after" />
          ))}
        </div>
      </div>
    </div>
  );
}

function ModalCloseButton() {
  return (
    <DialogClose asChild>
      <button type="button" className="shrink-0 cursor-pointer" style={{ width: 28, height: 28, display: "grid", placeItems: "center", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", backgroundColor: "var(--card)" }}>
        <X className="size-4" style={{ color: "var(--muted-foreground)" }} />
      </button>
    </DialogClose>
  );
}

export function ActivityDetailModal({ event, onClose }: { event: ActivityEvent | null; onClose: () => void }) {
  const [view, setView] = useState<"detail" | "compare">("detail");
  const [compareField, setCompareField] = useState<string | null>(null);

  useEffect(() => {
    setView("detail");
    setCompareField(null);
  }, [event?.id]);

  if (!event) return null;

  const sections: ChangeSection[] = event.detail?.kind === "sections" ? event.detail.sections : adaptLegacyDetail(event.detail);
  const title = buildDetailTitle(event);
  const openCompare = (field: string) => {
    setCompareField(field);
    setView("compare");
  };
  const ctx: RenderCtx = { onOpenCompare: openCompare };
  const firstSectionHeadingIdx = sections.findIndex((s) => !!s.heading);
  const hasAccordion = sectionsHaveAccordion(sections);

  const compareRow = compareField ? findLongTextRow(sections, compareField) : null;
  const isComparing = view === "compare" && compareRow !== null;
  const compareBlocks: ParagraphBlock[] = compareRow ? diffParagraphs(compareRow.before.text, compareRow.after.text) : [];

  return (
    <Dialog open={!!event} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="activity-log-portal flex flex-col gap-0 overflow-hidden p-0 [&>button:last-child]:hidden"
        style={{
          width: "92vw",
          maxWidth: isComparing ? 1200 : 760,
          height: isComparing ? MODAL_MAX_H : hasAccordion ? "min(85vh, 720px)" : undefined,
          maxHeight: isComparing || hasAccordion ? undefined : MODAL_MAX_H,
          transition: "max-width 240ms ease, max-height 240ms ease, height 240ms ease",
          backgroundColor: "var(--card)",
          borderRadius: "var(--radius-xl)",
          boxShadow: "var(--elevation-modal)",
        }}
      >
        {isComparing && compareRow ? (
          <>
            <div className="flex shrink-0 items-center" style={{ gap: 10, backgroundColor: "var(--page-background)", padding: "22px 24px", borderBottom: "1px solid var(--border)" }}>
              <button type="button" onClick={() => setView("detail")} aria-label="Back to change details" className="flex size-[30px] shrink-0 items-center justify-center rounded-[8px] border border-border bg-white shadow-sm transition-colors" style={{ transitionDuration: "150ms" }}>
                <ChevronLeft className="size-[15px]" style={{ color: "var(--muted-foreground)" }} />
              </button>
              <div className="min-w-0">
                <DialogTitle asChild>
                  <h2 style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.4, color: "var(--foreground)" }}>
                    Full {compareField!.charAt(0).toLowerCase() + compareField!.slice(1)}
                  </h2>
                </DialogTitle>
                <DialogDescription asChild>
                  <p className="text-muted-foreground" style={{ fontSize: 12.5, marginTop: 4 }}>
                    {subtitleEntity(event)} · {event.actor.name} · {formatCompareTimestamp(event.timestamp)}
                  </p>
                </DialogDescription>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col" style={{ backgroundColor: "var(--page-background)", padding: "20px 24px" }}>
              <CompareBody before={compareRow.before} after={compareRow.after} blocks={compareBlocks} />
            </div>
          </>
        ) : (
          <>
            <div className="flex shrink-0 flex-col" style={{ backgroundColor: "var(--page-background)", padding: "22px 24px 14px", borderBottom: "1px solid var(--border)" }}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <DialogTitle asChild>
                    <h2 style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.4, color: "var(--foreground)" }}>{title}</h2>
                  </DialogTitle>
                  <DialogDescription asChild>
                    <p className="text-muted-foreground" style={{ fontSize: 12.5, marginTop: 4 }}>{formatDetailTimestamp(event.timestamp)}</p>
                  </DialogDescription>
                </div>
                <ModalCloseButton />
              </div>
              <div className="grid grid-cols-2" style={{ gap: 14, marginTop: 16 }}>
                {(["BEFORE", "AFTER"] as const).map((label) => (
                  <div key={label} style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", color: "var(--muted-foreground)" }}>{label}</div>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto" style={{ backgroundColor: "var(--card)" }}>
              <div style={{ padding: "18px 24px 24px" }}>
                {sections.map((section, si) => (
                  <Fragment key={si}>
                    {section.heading && <HeadingBar text={section.heading} note={section.note} isFirst={si === firstSectionHeadingIdx} />}
                    <SectionEntriesView entries={section.entries} ctx={ctx} />
                  </Fragment>
                ))}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
