import type { ChangeSection, DetailBadge, DetailSectionEntry, DetailValue, MarkSegment } from "./types";
import { ACTION_KIND_LABELS, LOG_TYPE_ACTIVITY, type ActivityEvent } from "./data";

/** Ported from warehouse-whispers-34's activity-search.ts. Search behind
 * the Activity Log: text extraction/matching for the row list
 * (rowSearchText), each row's own "View details" pop-up (detailSearchText),
 * and the character-level highlighter (splitOnQuery). */

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  return `${date} · ${time}`;
}

export function splitOnQuery(text: string, query: string): MarkSegment[] {
  const q = query.trim();
  if (!q) return [{ text, marked: false }];

  const lowerText = text.toLowerCase();
  const lowerQuery = q.toLowerCase();
  const segments: MarkSegment[] = [];
  let i = 0;
  while (i < text.length) {
    const hit = lowerText.indexOf(lowerQuery, i);
    if (hit === -1) {
      segments.push({ text: text.slice(i), marked: false });
      break;
    }
    if (hit > i) segments.push({ text: text.slice(i, hit), marked: false });
    segments.push({ text: text.slice(hit, hit + q.length), marked: true });
    i = hit + q.length;
  }
  return segments;
}

/** Every string a row renders that search can see, by name. Timestamps
 * are absent on purpose — a date is how the list is ordered, not
 * something you search it by. entityLabel is absent too — it's never
 * actually rendered by any of the three views, only entityCode is. */
export function rowFields(event: ActivityEvent) {
  return {
    actor: event.actor.name,
    action: ACTION_KIND_LABELS[event.actionKind],
    activity: LOG_TYPE_ACTIVITY[event.logType],
    entityCode: event.entityCode ?? "",
    parentLabel: event.parentLabel ?? "",
    parentCode: event.parentCode ?? "",
  };
}

export function rowSearchText(event: ActivityEvent): string {
  return Object.values(rowFields(event)).join(" ");
}

function flattenBadge(badge: DetailBadge): string {
  return Array.isArray(badge) ? badge.join(" ") : badge;
}

function flattenBadges(badges: DetailBadge[]): string {
  return badges.map(flattenBadge).join(" ");
}

function valueText(value: DetailValue): string {
  switch (value.kind) {
    case "text":
      return value.parts.map((p) => p.text).join("");
    case "empty":
      return value.label;
    case "code":
      return value.text;
    case "attachment":
      return value.filename;
    case "statusPill":
      return value.label;
    case "person":
      return value.name;
    case "pillList":
      return value.items.map((i) => i.text).join(" ");
    case "marked":
      return value.text;
    case "longText":
      return value.text;
    case "count":
      return `${value.number} ${value.unit} ${value.bracket ?? ""}`.trim();
  }
}

function entryText(entry: DetailSectionEntry): string {
  if ("before" in entry) {
    const field = entry.field;
    const fieldText = field === null ? "" : typeof field === "string" ? field : `${field.code} ${flattenBadges(field.badges)}`;
    return `${fieldText} ${valueText(entry.before)} ${valueText(entry.after)}`;
  }
  switch (entry.kind) {
    case "rowGap":
      return "";
    case "itemBar":
      return `${entry.code} ${flattenBadges(entry.badges)}`;
    case "heading":
      return `${entry.text} ${entry.note ?? ""}`;
    case "accordionGroup":
      return `${entry.title} ${entry.rows.map(entryText).join(" ")}`;
    case "fieldAccordion":
      return `${entry.title} ${entry.entries.map(entryText).join(" ")}`;
  }
}

function sectionText(section: ChangeSection): string {
  return `${section.heading ?? ""} ${section.note ?? ""} ${section.entries.map(entryText).join(" ")}`;
}

export function detailSearchText(event: ActivityEvent): string {
  if (event.detail?.kind !== "sections") return "";
  return event.detail.sections.map(sectionText).join(" ");
}
