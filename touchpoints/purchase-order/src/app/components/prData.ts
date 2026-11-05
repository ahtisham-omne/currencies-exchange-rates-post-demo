/* ═══════════════════════════════════════════════════════════════
   Purchase Request — data layer

   Types + mock records for the Purchase Requests (PR) surface.
   The requester side of the flow — a technician (Rida) submits a
   request; the buyer sees them elsewhere in the app (planner
   workspace, PR queue) and acts on them.

   Kept as a thin in-memory store so the whole flow (submit →
   listing → detail → state changes) is exercisable without a
   backend. `addPR` mutates the module-scoped array and returns
   the new record; listing / detail pages read from `MY_PRS`.
   ═══════════════════════════════════════════════════════════════ */

export type PRUrgency = "high" | "standard" | "low";
export type PRStatus = "submitted" | "denied" | "deferred" | "po-created";

/** Auto-populated from the logged-in user's profile. */
export interface PRRequester {
  id: string;
  name: string;
  initials: string;
  role: string;
  avatarColor: string;
}

/** Config-flag branch — separate concern from the PR itself, but
 *  raised through the same form when an item is already flagged
 *  Below Minimum by the system (PRs are blocked in that case). */
export interface PRConfigFlag {
  target: "min-stock" | "max-stock" | "on-hand" | "vendor-info" | "other";
  currentValue: string;
  correctValue: string;
  explanation: string;
}

/** Human-readable label per config-flag target. Detail views + the
 *  Configuration flag section on the PR page read from here so the
 *  slug (`min-stock`) never leaks into the UI. Kept next to the type
 *  so any new target adds one line and picks up everywhere. */
export const CONFIG_TARGET_LABEL: Record<PRConfigFlag["target"], string> = {
  "min-stock": "Minimum stock level",
  "max-stock": "Maximum stock level",
  "on-hand": "On-hand count",
  "vendor-info": "Vendor information",
  other: "Other",
};

/** Attachment record — mock only, no real upload. */
export interface PRAttachment {
  id: string;
  filename: string;
  sizeKb: number;
}

/** State transition entry — powers the progress tracker + notification
 *  history on the detail view. */
export interface PRStateEntry {
  status: PRStatus;
  at: string; // ISO
  /** Buyer note — mandatory on Denied / Deferred per spec. */
  note?: string;
  /** PO reference set only when status === "po-created". */
  poRef?: string;
}

/** A single line item on a PR. Each row carries its own item
 *  reference, quantity, and (optional) est. unit price + vendor
 *  preference. Mirrors the PO line-item shape so the detail page's
 *  Line Items table renders the same way. */
export interface PRLineItem {
  /** Local id — used as the React key + for remove/edit ops. */
  id: string;
  /** Set when the row references an existing catalog item. */
  itemId?: string;
  /** True when the buyer is requesting an item that isn't in
   *  the Items Master yet. */
  isNewItem: boolean;
  /** Free-text description for new-item rows. */
  newItemName?: string;
  /** Free-text vendor notes for new-item rows. */
  newItemVendorNotes?: string;
  /** Reference link (URL / spec sheet). */
  referenceLinkOrFile?: string;
  quantity: number;
  uom: string;
  estimatedUnitPrice?: number;
  preferredVendor?: string;
}

export interface PurchaseRequest {
  id: string; // PR-XXXXX
  submittedAt: string; // ISO
  requester: PRRequester;

  /** One or more items being requested. Config-flag PRs still use
   *  the first entry as the item being flagged. */
  lineItems: PRLineItem[];

  needBy: string; // ISO (date-only) — start of the need-by window
  /** Optional end of a need-by RANGE (ISO date). When set, the PR
   *  display renders "Jul 15 – Jul 22, 2026" style instead of a
   *  single date. Buyers use ranges when they can accept the goods
   *  any time within a delivery window rather than a hard-set date. */
  needByEnd?: string;
  urgency: PRUrgency;

  reason: string;
  referenceDoc?: string;
  attachments: PRAttachment[];

  /** Optional config-flag payload when the requester raised the
   *  alt branch instead of a purchase ask. Always references the
   *  first line item. */
  configFlag?: PRConfigFlag;

  status: PRStatus;
  history: PRStateEntry[];
}

/* ═══════════════════════════════════════════════════════════════
   Mock logged-in user — Rida Iftikhar, Maintenance Technician.
   ═══════════════════════════════════════════════════════════════ */

export const CURRENT_USER: PRRequester = {
  id: "user-areeb",
  name: "Areeb Tanvir",
  initials: "AT",
  role: "Maintenance Technician",
  avatarColor: "#8B5CF6", // violet — distinct from any vendor palette
};

/* Additional shop-floor / operations personas used in the mock PR
   seed so the Requested By column shows variety instead of Rida on
   every row. `isCurrentUserPR` on PurchaseRequestsPage still keys off
   `user-rida`, so the Me toggle continues to work as expected. */
export const REQUESTER_OMAR: PRRequester = {
  id: "user-omar",
  name: "Omar Malik",
  initials: "OM",
  role: "Inventory Clerk",
  avatarColor: "#EA580C", // orange
};

/* Ancillary requesters — names align with the demand-source
   references in the planner (PODemands seed) so clicking a Request
   pill from there routes cleanly to a real PR detail. */
export const REQUESTER_SARA: PRRequester = {
  id: "user-nophil",
  name: "Nophil Anwer",
  initials: "NA",
  role: "Operations Lead",
  avatarColor: "#0D9488", // teal
};

export const REQUESTER_KAMRAN: PRRequester = {
  id: "user-shehryar",
  name: "Shehryar Hasan",
  initials: "SH",
  role: "Safety Officer",
  avatarColor: "#E11D48", // rose
};

/* ═══════════════════════════════════════════════════════════════
   Seed data — a handful of the requester's past PRs so the listing
   isn't empty on first paint. Covers every terminal status plus
   an in-flight Submitted.
   ═══════════════════════════════════════════════════════════════ */

export const MY_PRS: PurchaseRequest[] = [
  {
    id: "PR-10247",
    submittedAt: "2026-06-22T09:14:00Z",
    requester: CURRENT_USER,
    lineItems: [
      {
        id: "li-10247-1",
        itemId: "cat-2", // Hydraulic Pump
        isNewItem: false,
        quantity: 25,
        uom: "Unit",
        estimatedUnitPrice: 340,
        preferredVendor: "Toyota Technical Center (TTC)",
      },
    ],
    needBy: "2026-06-28",
    urgency: "high",
    reason:
      "Pumps on Line 3 have been failing intermittently — two swap-outs in the last week. Need spares on the shelf before end of month so we don't stop the line.",
    attachments: [],
    status: "submitted",
    history: [{ status: "submitted", at: "2026-06-22T09:14:00Z" }],
  },
  {
    id: "PR-10231",
    submittedAt: "2026-06-20T13:41:00Z",
    requester: REQUESTER_SARA,
    /* Multi-item seed — shows how the listing / detail render a
       PR with more than one item ("+N more" badge on the listing,
       three rows in the detail table). */
    lineItems: [
      {
        id: "li-10231-1",
        itemId: "cat-1", // Brake Pad Assembly Kit
        isNewItem: false,
        quantity: 10,
        uom: "Kit",
        estimatedUnitPrice: 87.5,
        preferredVendor: "General Motors (GM)",
      },
      {
        id: "li-10231-2",
        itemId: "cat-6", // Spark Plug Set
        isNewItem: false,
        quantity: 4,
        uom: "Box",
        estimatedUnitPrice: 54.6,
        preferredVendor: "Honda Motor Co., Ltd. (USA)",
      },
      {
        id: "li-10231-3",
        itemId: "cat-8", // Coolant Hose Kit
        isNewItem: false,
        quantity: 6,
        uom: "Kit",
        estimatedUnitPrice: 36.4,
        preferredVendor: "Rivian Automotive",
      },
    ],
    needBy: "2026-07-05",
    urgency: "standard",
    reason:
      "Restocking bay 4 after last week's job run. Bundling three complementary items so the buyer can consolidate ordering and delivery.",
    attachments: [],
    status: "po-created",
    history: [
      { status: "submitted", at: "2026-06-20T13:41:00Z" },
      { status: "po-created", at: "2026-06-21T11:22:00Z", poRef: "PO-42817" },
    ],
  },
  {
    id: "PR-10256",
    submittedAt: "2026-06-30T08:03:00Z",
    requester: REQUESTER_OMAR,
    lineItems: [
      {
        id: "li-10256-1",
        itemId: "cat-9", // Air Filter
        isNewItem: false,
        quantity: 50,
        uom: "Element",
      },
    ],
    /* Example of a need-by RANGE — the buyer told the vendor any
       delivery inside the Jul 15 → Jul 22 window is acceptable. Both
       the detail card's Need by field and the listing's Need By
       column render the range verbatim via `formatPRDateRange`. */
    needBy: "2026-07-15",
    needByEnd: "2026-07-22",
    urgency: "low",
    reason:
      "Routine top-up. Filters on the compressor shed are due for changeover next quarter — booking ahead so we're not scrambling.",
    attachments: [],
    status: "submitted",
    history: [{ status: "submitted", at: "2026-06-30T08:03:00Z" }],
  },
  {
    /* Denied — mixes a Below-Min catalog line with a new-item ask
       (unqualified vendor), plus attachments and a reference doc. The
       buyer's rejection note tells the requester why. Exercises: the
       denied status stepper (XCircle in the middle slot), the buyer-
       action banner with a rejection reason, the New-item chip +
       vendor-notes callout on the line-items table, the Attachments
       card, and the reference-doc chip on the sidebar's reason
       section. */
    id: "PR-10262",
    submittedAt: "2026-06-27T11:02:00Z",
    requester: CURRENT_USER,
    lineItems: [
      {
        id: "li-10262-1",
        itemId: "cat-4", // Precision Bearing Set — 8/100, Below-Min
        isNewItem: false,
        quantity: 40,
        uom: "Each",
        estimatedUnitPrice: 28.9,
        preferredVendor: "Tesla, Inc.",
      },
    ],
    needBy: "2026-07-08",
    urgency: "high",
    reason:
      "Bearing replacements are overdue on the compressor shed — Line 2 is chewing through them faster than we can restock.",
    referenceDoc: "WO-2026-0483",
    attachments: [
      { id: "att-10262-1", filename: "compressor-shed-vibration-log.pdf", sizeKb: 342 },
    ],
    status: "denied",
    history: [
      { status: "submitted", at: "2026-06-27T11:02:00Z" },
      {
        status: "denied",
        at: "2026-06-30T09:47:00Z",
        note:
          "Bearing supply is already scheduled next week from Tesla — hold off and re-submit if the shipment slips.",
      },
    ],
  },
  {
    /* New-item request — mirrors the same operational narrative as
       PR-10262 (dampener would solve the mounting-vibration root
       cause) but on the new-item flow, since that vendor isn't
       qualified yet. Split out from the earlier mixed-line PR so
       every seed request stays homogeneous (either all catalogue
       lines or all new-item lines). */
    id: "PR-10269",
    submittedAt: "2026-06-27T11:07:00Z",
    requester: CURRENT_USER,
    lineItems: [
      {
        id: "li-10269-1",
        isNewItem: true,
        newItemName:
          "Industrial Vibration Dampener — 4\" mounting flange, EPDM core, rated 500 lb per unit",
        referenceLinkOrFile: "https://www.mason-industries.com/products/nd-neoprene-dampener",
        quantity: 12,
        uom: "Unit",
        estimatedUnitPrice: 46,
        preferredVendor: "Mason Industries",
      },
    ],
    needBy: "2026-07-08",
    urgency: "high",
    reason:
      "Compressor shed mounting vibration on Line 2 is chewing through bearings — dampeners would fix the root cause. Mason ND is what a sister site is running.",
    referenceDoc: "WO-2026-0483",
    attachments: [
      { id: "att-10269-1", filename: "mason-nd-datasheet.pdf", sizeKb: 1240 },
    ],
    status: "denied",
    history: [
      { status: "submitted", at: "2026-06-27T11:07:00Z" },
      {
        status: "denied",
        at: "2026-06-30T09:47:00Z",
        note:
          "Mason ND needs a full spec review before we can qualify a new vendor. Please open a Vendor Onboarding request first.",
      },
    ],
  },
  {
    /* Configuration-flag PR — exercises the alt branch. The line item
       is a placeholder against the flagged catalog record (quantity 0)
       and the real content lives in `configFlag`. Detail page renders
       the amber "Configuration flag" section card instead of a
       purchase story. */
    id: "PR-10268",
    submittedAt: "2026-07-01T14:22:00Z",
    requester: REQUESTER_KAMRAN,
    lineItems: [
      {
        id: "li-10268-1",
        itemId: "cat-8", // Coolant Hose Kit — currentStock 0 in mock
        isNewItem: false,
        quantity: 0,
        uom: "Kit",
      },
    ],
    needBy: "2026-07-01",
    urgency: "standard",
    reason:
      "Configuration flag raised: on-hand count is wrong — 22 kits sitting in bay 4 this morning, system reads 0.",
    attachments: [],
    configFlag: {
      target: "on-hand",
      currentValue: "0 Kit",
      correctValue: "22 Kit",
      explanation:
        "Cycle count this morning found 22 kits in bay 4, position B-14. System still shows 0 — likely a receipt from last week that never posted. Please have accounting reconcile so the planner picks these up.",
    },
    status: "submitted",
    history: [{ status: "submitted", at: "2026-07-01T14:22:00Z" }],
  },
];

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */

/** Requester's list — for the "My Purchase Requests" tab. */
export function getMyPRs(): PurchaseRequest[] {
  // Newest first — the requester almost always cares about their
  // most recent submission (or the one just deferred).
  return [...MY_PRS].sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
  );
}

export function getPRById(id: string): PurchaseRequest | undefined {
  return MY_PRS.find((p) => p.id === id);
}

/** Very simple duplicate detection — same item on any line item,
 *  still open (Submitted status only), submitted within the last
 *  14 days. Powers the soft warning on the form. */
export function findRecentDuplicates(itemId: string | undefined): PurchaseRequest[] {
  if (!itemId) return [];
  const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
  return MY_PRS.filter(
    (p) =>
      p.status === "submitted" &&
      new Date(p.submittedAt).getTime() >= cutoff &&
      p.lineItems.some((li) => li.itemId === itemId),
  );
}

/** Suggest an urgency based on Need By + item's stock health.
 *  - Past-due or within 3 days of needing it → High
 *  - Item is at/below min stock → High
 *  - Need By within 10 days → Standard
 *  - Otherwise → Low
 *  Returned suggestion is a hint only; the requester can override. */
export function suggestUrgency(opts: {
  needByISO?: string;
  currentStock?: number;
  minStock?: number;
}): PRUrgency | null {
  const { needByISO, currentStock, minStock } = opts;
  if (!needByISO) return null;
  const days = Math.round(
    (new Date(needByISO).getTime() - Date.now()) / (24 * 60 * 60 * 1000),
  );
  if (days <= 3) return "high";
  if (
    typeof currentStock === "number" &&
    typeof minStock === "number" &&
    currentStock <= minStock
  ) {
    return "high";
  }
  if (days <= 10) return "standard";
  return "low";
}

/** Save a new PR to the in-memory store. Returns the persisted
 *  record so callers can navigate straight to its detail view. */
export function addPR(
  draft: Omit<PurchaseRequest, "id" | "submittedAt" | "status" | "history" | "requester">,
): PurchaseRequest {
  const now = new Date().toISOString();
  const id = `PR-${10300 + MY_PRS.length}`;
  const record: PurchaseRequest = {
    ...draft,
    id,
    submittedAt: now,
    requester: CURRENT_USER,
    status: "submitted",
    history: [{ status: "submitted", at: now }],
  };
  MY_PRS.unshift(record);
  return record;
}

/** Update a PR's status and append a history entry. Returns the
 *  patched record, or undefined when the id doesn't resolve. Used by
 *  the buyer-side actions (Defer / Deny / Create PO) surfaced on the
 *  PR detail page when arriving from the planner. */
export function updatePRStatus(
  id: string,
  next: PRStatus,
  opts: { note?: string; poRef?: string } = {},
): PurchaseRequest | undefined {
  const idx = MY_PRS.findIndex((p) => p.id === id);
  if (idx < 0) return undefined;
  const now = new Date().toISOString();
  const entry: PRStateEntry = {
    status: next,
    at: now,
    ...(opts.note ? { note: opts.note } : {}),
    ...(opts.poRef ? { poRef: opts.poRef } : {}),
  };
  const patched: PurchaseRequest = {
    ...MY_PRS[idx],
    status: next,
    history: [...MY_PRS[idx].history, entry],
  };
  MY_PRS[idx] = patched;
  return patched;
}

/** Best-match PR id for a source reference — used by the planner's
 *  Request source pill to link into the PR detail page. Prefers the
 *  most recent Submitted PR from a requester whose name matches;
 *  falls back to the newest PR from that requester if none are
 *  Submitted. Returns undefined when no requester name matches. */
export function findPRIdByRequesterName(name: string): string | undefined {
  const trimmed = name.trim().toLowerCase();
  if (!trimmed) return undefined;
  const matches = MY_PRS.filter(
    (p) => p.requester.name.trim().toLowerCase() === trimmed,
  );
  if (matches.length === 0) return undefined;
  const submitted = matches
    .filter((p) => p.status === "submitted")
    .sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
    );
  if (submitted.length > 0) return submitted[0].id;
  const newest = [...matches].sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
  )[0];
  return newest.id;
}

/* ═══════════════════════════════════════════════════════════════
   Presentation helpers — kept next to the data so listing +
   detail + form all format the same way.
   ═══════════════════════════════════════════════════════════════ */

export const URGENCY_META: Record<
  PRUrgency,
  { label: string; bg: string; fg: string; border: string; hint: string }
> = {
  high: {
    label: "High",
    bg: "#FEF2F2",
    fg: "#991B1B",
    border: "#FECACA",
    hint: "Delay will impact operations, production, or a customer commitment.",
  },
  standard: {
    label: "Standard",
    bg: "#F1F5F9",
    fg: "#334155",
    border: "#CBD5E1",
    hint: "Needed within the normal procurement window. No immediate operational impact.",
  },
  low: {
    label: "Low",
    bg: "#F0FDF4",
    fg: "#166534",
    border: "#BBF7D0",
    hint: "Nice to have. Can wait if a higher urgency request needs to be addressed first.",
  },
};

export const STATUS_META: Record<
  PRStatus,
  { label: string; bg: string; fg: string; border: string; note: string }
> = {
  submitted: {
    label: "Submitted",
    bg: "#EFF6FF",
    fg: "#1E40AF",
    border: "#BFDBFE",
    note: "Waiting for buyer review.",
  },
  denied: {
    label: "Denied",
    bg: "#FEF2F2",
    fg: "#991B1B",
    border: "#FECACA",
    note: "Buyer has rejected this request.",
  },
  deferred: {
    label: "Deferred",
    bg: "#FFFBEB",
    fg: "#92400E",
    border: "#FDE68A",
    note: "Buyer has pushed this out — see reason below.",
  },
  "po-created": {
    label: "PO Created",
    bg: "#F0FDF4",
    fg: "#166534",
    border: "#BBF7D0",
    note: "A purchase order has been raised against this request.",
  },
};

/** Human-readable date, matching the rest of the app. */
export function formatPRDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

/** Format a need-by window that can be a single ISO date or a
 *  [start, end] range. Renders "Jul 15, 2026" (single), or
 *  "Jul 15 – Jul 22, 2026" (same year), or "Dec 28, 2026 – Jan 5, 2027"
 *  (cross-year). Used by the PR detail card + the listing's Need By
 *  column so both surfaces speak the same range grammar. */
export function formatPRDateRange(startIso: string, endIso?: string): string {
  const startDate = new Date(startIso);
  if (!endIso) {
    return startDate.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    });
  }
  const endDate = new Date(endIso);
  const sameYear = startDate.getFullYear() === endDate.getFullYear();
  const startFmt = startDate.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  const endFmt = endDate.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
  return `${startFmt} – ${endFmt}`;
}
