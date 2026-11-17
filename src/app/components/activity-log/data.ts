import type { ChangeSection } from "./types";

/**
 * Activity Log data model — ported from warehouse-whispers-34's
 * company-setup-activity.ts, trimmed to the two modules this app actually
 * has: Warehouses and Locations. Every other kind (purchase orders,
 * movements, item categories, partner groups) existed there as demo-only
 * placeholders for modules not yet built; none of that crosses over here.
 *
 * Real entities only: warehouse codes/names come from warehouse-listing-
 * page.tsx's MOCK_WAREHOUSES, location codes/names from location-listing-
 * page.tsx's MOCK_LOCATIONS, actors from warehouse-listing-page.tsx's
 * TEAM_AVATARS. The current user (for "Me mode") is Ahtsham Ahmad — he's
 * the signed-in user shown in every page's own top-right avatar.
 */

/**
 * Every Company Setup module (company-setup-page.tsx's own module grid),
 * not just the two with real activity data — the Module filter lists all
 * of them so the other modules read as "0" (not yet instrumented) rather
 * than simply not existing. Every ActivityEvent.module value in this file
 * is still only ever "Warehouses" or "Locations"; the rest of the union
 * exists purely so MODULE_OPTIONS in multi-view.tsx can show the whole
 * list with accurate (zero) counts.
 */
export type ActivityModule =
  | "Warehouses"
  | "Locations"
  | "Work Centers"
  | "Shift Policies"
  | "Clock In / Clock Out"
  | "Overtime Policies"
  | "Authentication Policies"
  | "Unit Conversions";

export type ActionKind = "created" | "updated" | "activated" | "deactivated" | "added" | "removed" | "deleted" | "archived";

export const ACTION_KIND_LABELS: Record<ActionKind, string> = {
  created: "Created",
  updated: "Updated",
  activated: "Activated",
  deactivated: "Deactivated",
  added: "Added",
  removed: "Removed",
  deleted: "Deleted",
  archived: "Archived",
};

export type Actor = { name: string; initials: string; avatar: string };

export const TEAM: Record<string, Actor> = {
  "Ahtsham Ahmad": { name: "Ahtsham Ahmad", initials: "AA", avatar: "https://images.unsplash.com/photo-1701463387028-3947648f1337?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzb3V0aCUyMGFzaWFuJTIwbWFuJTIwcHJvZmVzc2lvbmFsJTIwaGVhZHNob3R8ZW58MXx8fHwxNzcxODA2ODk0fDA&ixlib=rb-4.1.0&q=80&w=1080" },
  "Faizan Khan": { name: "Faizan Khan", initials: "FK", avatar: "https://images.unsplash.com/photo-1651596082255-bcb4993cee27?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwYWtpc3RhbmklMjBtYW4lMjBidXNpbmVzcyUyMHBvcnRyYWl0fGVufDF8fHx8MTc3MTg3ODcyMHww&ixlib=rb-4.1.0&q=80&w=1080" },
  "Areeb Tanveer": { name: "Areeb Tanveer", initials: "AT", avatar: "https://images.unsplash.com/photo-1676304918177-d60a7e1c7218?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtaWRkbGUlMjBlYXN0ZXJuJTIwbWFuJTIwcHJvZmVzc2lvbmFsJTIwcGhvdG98ZW58MXx8fHwxNzcxODc4NzE5fDA&ixlib=rb-4.1.0&q=80&w=1080" },
  "Nophil Anwer": { name: "Nophil Anwer", initials: "NA", avatar: "https://images.unsplash.com/photo-1543132220-e7fef0b974e7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx5b3VuZyUyMG1hbiUyMGJ1c2luZXNzJTIwcG9ydHJhaXQlMjBzdHVkaW98ZW58MXx8fHwxNzcxODc4NzE4fDA&ixlib=rb-4.1.0&q=80&w=1080" },
  "Irtaza Abid": { name: "Irtaza Abid", initials: "IA", avatar: "https://images.unsplash.com/photo-1672685667592-0392f458f46f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBtYW4lMjBoZWFkc2hvdCUyMHBvcnRyYWl0fGVufDF8fHx8MTc3MTgxODAxMHww&ixlib=rb-4.1.0&q=80&w=1080" },
  "Eli Rosenbloom": { name: "Eli Rosenbloom", initials: "ER", avatar: "https://images.unsplash.com/photo-1691316749874-e89297ee4cf3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjYXVjYXNpYW4lMjBtYW4lMjBjb3Jwb3JhdGUlMjBoZWFkc2hvdHxlbnwxfHx8fDE3NzE4Nzg3MTl8MA&ixlib=rb-4.1.0&q=80&w=1080" },
  "Eesha Imtiaz": { name: "Eesha Imtiaz", initials: "EI", avatar: "https://images.unsplash.com/photo-1708491191986-f7a710ee4675?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzb3V0aCUyMGFzaWFuJTIwd29tYW4lMjBwcm9mZXNzaW9uYWwlMjBoZWFkc2hvdHxlbnwxfHx8fDE3NzMzMjQwMzh8MA&ixlib=rb-4.1.0&q=80&w=1080" },
};

export const CURRENT_USER = "Ahtsham Ahmad";

export const WAREHOUSES = [
  { code: "WH-1001", name: "Main Distribution Center" },
  { code: "WH-1002", name: "East Coast Warehouse" },
  { code: "WH-1003", name: "EU Fulfillment Center" },
] as const;
type WarehouseCode = (typeof WAREHOUSES)[number]["code"];

export const LOCATIONS_BY_WAREHOUSE: Record<WarehouseCode, { code: string; name: string }[]> = {
  "WH-1001": [
    { code: "LOC-1001", name: "Zone A — Receiving" },
    { code: "LOC-1002", name: "Zone B — Storage" },
    { code: "LOC-1004", name: "Zone D — Shipping" },
    { code: "LOC-1006", name: "Returns Processing" },
    { code: "LOC-1009", name: "QA Inspection" },
  ],
  "WH-1002": [
    { code: "LOC-1003", name: "Zone C — Picking" },
    { code: "LOC-1007", name: "Hazmat Storage" },
    { code: "LOC-1010", name: "Equipment Bay" },
  ],
  "WH-1003": [
    { code: "LOC-1005", name: "Cold Storage" },
    { code: "LOC-1005-A", name: "Freezer Aisle A" },
    { code: "LOC-1005-B", name: "Refrigerated Bay B" },
    { code: "LOC-1008", name: "Bulk Storage" },
  ],
};

export type ActivityLogType =
  | "warehouse.updated"
  | "location.updated"
  | "warehouse.created"
  | "warehouse.code_modified"
  | "warehouse.name_modified"
  | "warehouse.activated"
  | "warehouse.deactivated"
  | "warehouse.archived"
  | "warehouse.description_modified"
  | "warehouse.address_modified"
  | "warehouse.poc_modified"
  | "warehouse.poc_removed"
  | "warehouse.poc_added"
  | "warehouse.attachment_added"
  | "warehouse.attachment_deleted"
  | "warehouse.attachment_modified"
  | "location.created"
  | "location.code_modified"
  | "location.name_modified"
  | "location.description_modified"
  | "location.address_modified"
  | "location.tag_added"
  | "location.tag_removed"
  | "location.tag_modified"
  | "location.poc_modified"
  | "location.poc_removed"
  | "location.poc_added"
  | "location.attachment_added"
  | "location.attachment_deleted"
  | "location.attachment_modified"
  | "location.parent_assigned"
  | "location.parent_modified"
  | "location.activated"
  | "location.deactivated"
  | "location.archived";

export const LOG_TYPE_VERBS: Record<ActivityLogType, string> = {
  "warehouse.updated": "updated warehouse",
  "location.updated": "updated location",
  "warehouse.created": "created warehouse",
  "warehouse.code_modified": "updated code",
  "warehouse.name_modified": "updated name",
  "warehouse.activated": "activated",
  "warehouse.deactivated": "deactivated",
  "warehouse.archived": "archived",
  "warehouse.description_modified": "updated description",
  "warehouse.address_modified": "updated address",
  "warehouse.poc_modified": "updated point of contact",
  "warehouse.poc_removed": "removed point of contact",
  "warehouse.poc_added": "added point of contact",
  "warehouse.attachment_added": "added attachment",
  "warehouse.attachment_deleted": "deleted attachment",
  "warehouse.attachment_modified": "updated attachment",
  "location.created": "created location",
  "location.code_modified": "updated code in location",
  "location.name_modified": "updated name in location",
  "location.description_modified": "updated description in location",
  "location.address_modified": "updated address in location",
  "location.tag_added": "added tag to",
  "location.tag_removed": "removed tag from",
  "location.tag_modified": "updated tag on",
  "location.poc_modified": "updated point of contact in location",
  "location.poc_removed": "removed point of contact in location",
  "location.poc_added": "added point of contact in location",
  "location.attachment_added": "added attachment in location",
  "location.attachment_deleted": "deleted attachment in location",
  "location.attachment_modified": "updated attachment in location",
  "location.parent_assigned": "assigned parent location",
  "location.parent_modified": "updated parent location",
  "location.activated": "activated",
  "location.deactivated": "deactivated",
  "location.archived": "archived",
};

export const LOG_TYPE_ACTIVITY: Record<ActivityLogType, string> = {
  "warehouse.updated": "warehouse",
  "warehouse.created": "warehouse",
  "warehouse.archived": "warehouse",
  "warehouse.activated": "warehouse",
  "warehouse.deactivated": "warehouse",
  "warehouse.code_modified": "code in warehouse",
  "warehouse.name_modified": "name in warehouse",
  "warehouse.description_modified": "description in warehouse",
  "warehouse.address_modified": "address in warehouse",
  "warehouse.poc_modified": "point of contact in warehouse",
  "warehouse.poc_added": "point of contact in warehouse",
  "warehouse.poc_removed": "point of contact in warehouse",
  "warehouse.attachment_added": "attachment to warehouse",
  "warehouse.attachment_deleted": "attachment from warehouse",
  "warehouse.attachment_modified": "attachment in warehouse",
  "location.updated": "location",
  "location.created": "location",
  "location.archived": "location",
  "location.activated": "location",
  "location.deactivated": "location",
  "location.code_modified": "code in location",
  "location.name_modified": "name in location",
  "location.description_modified": "description in location",
  "location.address_modified": "address in location",
  "location.poc_modified": "point of contact in location",
  "location.poc_added": "point of contact in location",
  "location.poc_removed": "point of contact in location",
  "location.attachment_added": "attachment to location",
  "location.attachment_deleted": "attachment from location",
  "location.attachment_modified": "attachment in location",
  "location.tag_added": "tag to location",
  "location.tag_removed": "tag from location",
  "location.tag_modified": "tag on location",
  "location.parent_assigned": "parent of location",
  "location.parent_modified": "parent of location",
};

export type FieldChange = { field: string; from: string; to: string; pill?: boolean };

export type EventDetail =
  | { kind: "fields"; fields: FieldChange[] }
  | { kind: "attachment"; action: "added" | "removed" | "updated"; filename: string }
  | { kind: "tag"; action: "added" | "removed"; tag: string }
  | { kind: "sections"; sections: ChangeSection[] };

export type ActivityEvent = {
  id: string;
  module: ActivityModule;
  entityId: string;
  entityLabel: string;
  logType: ActivityLogType;
  entityCode?: string;
  parentLabel?: string;
  parentCode?: string;
  actor: Actor;
  timestamp: string;
  actionKind: ActionKind;
  detail?: EventDetail;
};

function todayAt(hour: number, minute: number): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0).toISOString();
}

/* ─── One rich hand-authored demo record, in the modern "sections" shape
 * — Status/POC/Address/Tags/Description, the same case WAREHOUSE_SECTIONS
 * proved in the source app, now against the real WH-1001. Plus one record
 * using the exact WH-1001-OLD -> WH-1001 code-change case, so the
 * diffMarked fix (hyphen counts as a boundary) is visibly exercised. ─── */

const WAREHOUSE_SECTIONS: ChangeSection[] = [
  {
    entries: [
      {
        field: "Status",
        before: { kind: "statusPill", label: "Deactivated", tone: "neutral" },
        after: { kind: "statusPill", label: "Active", tone: "success" },
      },
      {
        field: "Point of contact",
        before: { kind: "person", name: "Diane Wu" },
        after: { kind: "person", name: "Priya Anand" },
      },
      {
        field: "Address",
        before: { kind: "marked", text: "4750 W Fullerton Ave, Chicago, IL 60601, United States" },
        after: { kind: "marked", text: "4750 W Fullerton Ave, Chicago, IL 60602, United States" },
      },
      {
        field: "Tags",
        before: { kind: "pillList", items: [{ text: "Downtown" }, { text: "Operations" }] },
        after: { kind: "pillList", items: [{ text: "Operations" }, { text: "Cold Chain" }] },
      },
      {
        field: "Description",
        before: {
          kind: "longText",
          text: "Primary distribution hub for all regions. Durable floors and climate control keep the facility running through peak season, with a layout organized around high-throughput receiving and dispatch lanes.",
          words: 2840,
          lastEditedBy: "Ahtsham Ahmad",
          lastEditedOn: "Sep 12",
        },
        after: {
          kind: "longText",
          text: "Primary distribution hub for all regions, recently expanded with a dedicated cold-chain wing and an automated sortation line. Durable floors and climate control keep the facility running through peak season, with a layout organized around high-throughput receiving and dispatch lanes.",
          words: 3214,
        },
      },
    ],
  },
];

const handAuthoredActivity: ActivityEvent[] = [
  {
    id: "CSA-1",
    module: "Warehouses",
    entityId: "wh-1001",
    entityLabel: "Warehouse WH-1001 — Main Distribution Center",
    logType: "warehouse.updated",
    entityCode: "WH-1001",
    actor: TEAM["Ahtsham Ahmad"],
    timestamp: todayAt(16, 0),
    actionKind: "updated",
    detail: { kind: "sections", sections: WAREHOUSE_SECTIONS },
  },
  {
    id: "CSA-2",
    module: "Warehouses",
    entityId: "wh-1001",
    entityLabel: "Warehouse WH-1001 — Main Distribution Center",
    logType: "warehouse.code_modified",
    entityCode: "WH-1001",
    actor: TEAM["Faizan Khan"],
    timestamp: todayAt(9, 30),
    actionKind: "updated",
    detail: { kind: "fields", fields: [{ field: "Code", from: "WH-1001-OLD", to: "WH-1001" }] },
  },
];

/* ─── Deterministic generated history, same pattern as the source app's
 * generateHistoricalActivity: fixed-seed PRNG so the feed never reshuffles
 * between loads, ~60 days of history across the three warehouses that
 * actually have real locations. ─── */

function mulberry32(seed: number) {
  return function rng() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(20261005);
function randInt(min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}
function pick<T>(arr: readonly T[]): T {
  return arr[randInt(0, arr.length - 1)];
}

const GENERATED_ACTORS = ["Ahtsham Ahmad", "Faizan Khan", "Areeb Tanveer", "Nophil Anwer", "Irtaza Abid", "Eli Rosenbloom"] as const;

const POC_NAMES = ["Diane Wu", "Priya Anand", "Sarah Kim", "Tom Reyes", "Elena Cruz", "Marcus Doyle"];
const DESCRIPTION_REVISIONS: [string, string][] = [
  ["Storage area for overflow inventory.", "Storage area for overflow inventory, climate-controlled."],
  ["General purpose storage bay.", "General purpose storage bay with reinforced flooring."],
  ["Staging area for outbound shipments.", "Staging area for outbound shipments, expanded to 2 bays."],
  ["Receiving dock for incoming freight.", "Receiving dock for incoming freight, added forklift access."],
];
const ADDRESS_REVISIONS: [string, string][] = [
  ["4750 W Fullerton Ave, Chicago, IL 60601, United States", "4750 W Fullerton Ave, Suite 200, Chicago, IL 60601, United States"],
  ["1250 Middle Harbor Rd, Newark, NJ 07114, United States", "1250 Middle Harbor Rd, Building B, Newark, NJ 07114, United States"],
  ["200 Logistics Way, Frankfurt, Germany", "215 Logistics Way, Frankfurt, Germany"],
];
const TAGS = ["Downtown", "Fragile", "Priority", "Cold Chain", "Hazmat", "Overflow", "Seasonal", "Express"];
const ATTACHMENT_FILES = ["floor-plan.pdf", "safety-inspection.pdf", "lease-agreement.pdf", "insurance-certificate.pdf", "fire-safety-certificate.pdf", "zoning-permit.pdf"];

const WAREHOUSE_LOG_TYPES: ActivityLogType[] = [
  "warehouse.description_modified",
  "warehouse.address_modified",
  "warehouse.poc_modified",
  "warehouse.poc_removed",
  "warehouse.poc_added",
  "warehouse.attachment_added",
  "warehouse.attachment_deleted",
  "warehouse.attachment_modified",
];
const LOCATION_LOG_TYPES: ActivityLogType[] = [
  "location.description_modified",
  "location.address_modified",
  "location.tag_added",
  "location.tag_removed",
  "location.tag_modified",
  "location.poc_modified",
  "location.poc_removed",
  "location.poc_added",
  "location.attachment_added",
  "location.attachment_deleted",
  "location.attachment_modified",
  "location.activated",
  "location.deactivated",
];

function actionKindForLogType(logType: ActivityLogType): ActionKind {
  if (logType.endsWith(".created")) return "created";
  if (logType.endsWith(".archived")) return "archived";
  if (logType.endsWith(".activated")) return "activated";
  if (logType.endsWith(".deactivated")) return "deactivated";
  if (logType.endsWith("_added")) return "added";
  if (logType.endsWith("_removed")) return "removed";
  if (logType.endsWith("_deleted")) return "deleted";
  return "updated";
}

function detailForLogType(logType: ActivityLogType, warehouseCode: WarehouseCode): EventDetail | undefined {
  switch (logType) {
    case "warehouse.description_modified":
    case "location.description_modified": {
      const [from, to] = pick(DESCRIPTION_REVISIONS);
      return { kind: "fields", fields: [{ field: "Description", from, to }] };
    }
    case "warehouse.address_modified":
    case "location.address_modified": {
      const [from, to] = pick(ADDRESS_REVISIONS);
      return { kind: "fields", fields: [{ field: "Address", from, to }] };
    }
    case "warehouse.poc_modified":
    case "location.poc_modified":
      return { kind: "fields", fields: [{ field: "Point of Contact", from: pick(POC_NAMES), to: pick(POC_NAMES) }] };
    case "warehouse.poc_removed":
    case "location.poc_removed":
      return { kind: "fields", fields: [{ field: "Point of Contact", from: pick(POC_NAMES), to: "—" }] };
    case "warehouse.poc_added":
    case "location.poc_added":
      return { kind: "fields", fields: [{ field: "Point of Contact", from: "—", to: pick(POC_NAMES) }] };
    case "warehouse.attachment_added":
    case "location.attachment_added":
      return { kind: "attachment", action: "added", filename: pick(ATTACHMENT_FILES) };
    case "warehouse.attachment_deleted":
    case "location.attachment_deleted":
      return { kind: "attachment", action: "removed", filename: pick(ATTACHMENT_FILES) };
    case "warehouse.attachment_modified":
    case "location.attachment_modified":
      return { kind: "attachment", action: "updated", filename: pick(ATTACHMENT_FILES) };
    case "location.tag_added":
      return { kind: "tag", action: "added", tag: pick(TAGS) };
    case "location.tag_removed":
      return { kind: "tag", action: "removed", tag: pick(TAGS) };
    case "location.tag_modified":
      return { kind: "fields", fields: [{ field: "Tag", from: pick(TAGS), to: pick(TAGS) }] };
    case "location.activated":
      return { kind: "fields", fields: [{ field: "Status", from: "Deactivated", to: "Active", pill: true }] };
    case "location.deactivated":
      return { kind: "fields", fields: [{ field: "Status", from: "Active", to: "Deactivated", pill: true }] };
    default:
      return undefined;
  }
}

function generateHistoricalActivity(): ActivityEvent[] {
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const events: ActivityEvent[] = [];
  let counter = 1;

  for (let dayOffset = 1; dayOffset <= 60; dayOffset++) {
    const day = new Date(today - dayOffset * 24 * 60 * 60 * 1000);
    const dow = day.getUTCDay();
    const isWeekend = dow === 0 || dow === 6;
    const count = isWeekend ? randInt(1, 3) : randInt(2, 5);

    for (let i = 0; i < count; i++) {
      const hour = randInt(8, 17);
      const minute = randInt(0, 59);
      const timestamp = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour, minute, 0)).toISOString();

      const isWarehouseEvent = rng() < 0.35;
      const actorName = pick(GENERATED_ACTORS);
      const warehouse = pick(WAREHOUSES);

      if (isWarehouseEvent) {
        const logType = pick(WAREHOUSE_LOG_TYPES);
        const detail = detailForLogType(logType, warehouse.code);
        events.push({
          id: `GEN-${counter++}`,
          module: "Warehouses",
          entityId: warehouse.code.toLowerCase(),
          entityLabel: `Warehouse ${warehouse.code} — ${warehouse.name}`,
          logType,
          entityCode: warehouse.code,
          actor: TEAM[actorName],
          timestamp,
          actionKind: actionKindForLogType(logType),
          ...(detail ? { detail } : {}),
        });
      } else {
        const location = pick(LOCATIONS_BY_WAREHOUSE[warehouse.code]);
        const logType = pick(LOCATION_LOG_TYPES);
        const detail = detailForLogType(logType, warehouse.code);
        events.push({
          id: `GEN-${counter++}`,
          module: "Locations",
          entityId: location.code.toLowerCase(),
          entityLabel: `Location ${location.code} — Warehouse ${warehouse.code}`,
          logType,
          entityCode: location.code,
          parentLabel: "warehouse",
          parentCode: warehouse.code,
          actor: TEAM[actorName],
          timestamp,
          actionKind: actionKindForLogType(logType),
          ...(detail ? { detail } : {}),
        });
      }
    }
  }

  return events;
}

export const activityLog: ActivityEvent[] = [...handAuthoredActivity, ...generateHistoricalActivity()].sort(
  (a, b) => +new Date(b.timestamp) - +new Date(a.timestamp),
);
