/* ═══════════════════════════════════════════════════════════════════
 *  Field requirements: one source of truth for "is this field
 *  required, when, and what do we show when it is empty".
 *
 *  Partners only requires a customer's name, so every other piece of
 *  customer data (contacts, addresses, payment terms, payment method,
 *  sales rep) can legitimately be missing. Instead of each screen
 *  deciding on its own, every validation, red outline, helper message
 *  and empty-state label in this module reads from FIELD_RULES below.
 *
 *  To make a field required, set `requiredAt` on its rule. Nothing
 *  else needs to change: the creation modal, the detail page and the
 *  release checks all pick it up.
 *
 *  Kept identical between the Quotes and Sales Order repos, except
 *  for the FIELD_RULES table, which is module specific.
 * ═══════════════════════════════════════════════════════════════════ */
import type { CSSProperties, ReactNode } from "react";

/** The moments a record is validated, in order. `create` runs on the
 *  creation modal's Continue / Create buttons. `send` runs when a quote
 *  is sent to the customer. `release` runs when a Sales Order is
 *  submitted for review or released (cleared), and when a quote is
 *  converted to a Sales Order, since the order it creates has to meet
 *  the same bar. */
export type RequirementStage = "create" | "send" | "release";

export type FieldKey =
  | "customer"
  | "poc"
  | "customerAddress"
  | "billTo"
  | "shipTo"
  | "paymentTerms"
  | "paymentMethod"
  | "salesRep"
  | "lineItems";

export interface FieldRule {
  key: FieldKey;
  /** Human label, used in summaries ("Ship to"). */
  label: string;
  /** Stage at which an empty value blocks the action. `null` = optional. */
  requiredAt: RequirementStage | null;
  /** Inline helper shown under the field when it blocks an action. */
  missingMessage: string;
  /** Neutral copy for an empty optional value (Partners vocabulary). */
  emptyLabel: string;
  /** Optional heads-up shown in an earlier stage for a field that is
   *  required later (e.g. Ship to is needed before release). */
  laterHint?: string;
}

/* ── Value checks ── */

/** True when a value counts as "not provided". Handles the shapes
 *  this module stores: strings, arrays, null/undefined and objects
 *  with a `name`/`id`. */
export function isMissing(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") {
    const v = value as { name?: unknown; id?: unknown };
    if ("name" in v || "id" in v) return isMissing(v.name) && isMissing(v.id);
  }
  return false;
}

export type FieldValues = Partial<Record<FieldKey, unknown>>;

/** Rules that are required at `stage` (or any earlier stage) and are
 *  empty in `values`. Order follows FIELD_RULES, which follows the
 *  on-screen order, so the first entry is the field to focus. */
export function getMissingFields(values: FieldValues, stage: RequirementStage): FieldRule[] {
  const order: RequirementStage[] = ["create", "send", "release"];
  const reach = order.indexOf(stage);
  return (Object.values(FIELD_RULES) as FieldRule[]).filter((rule) => {
    if (!rule.requiredAt) return false;
    if (order.indexOf(rule.requiredAt) > reach) return false;
    if (!(rule.key in values)) return false;
    return isMissing(values[rule.key]);
  });
}

/** Convenience map for render code: `errors.shipTo` → message. */
export function toErrorMap(missing: FieldRule[]): Partial<Record<FieldKey, string>> {
  const map: Partial<Record<FieldKey, string>> = {};
  for (const rule of missing) map[rule.key] = rule.missingMessage;
  return map;
}

/** Display helper: the value, or the field's empty label. */
export function displayOrEmpty(key: FieldKey, value: string | null | undefined): string {
  return isMissing(value) ? FIELD_RULES[key].emptyLabel : (value as string);
}

/** "Point of contact and Ship to" style join for summaries. */
export function joinLabels(rules: FieldRule[]): string {
  const labels = rules.map((r) => r.label);
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

/* ── Error chrome (Partners CreatePartnerModal field error) ── */

/** Tailwind classes for a field in its error state. */
export const FIELD_ERROR_CLASS =
  "!border-red-400 hover:!border-red-500 shadow-[0_0_0_3px_rgba(239,68,68,0.12)]";

/** Inline-style equivalent for components styled with `style={}`. */
export const FIELD_ERROR_STYLE: CSSProperties = {
  borderColor: "#F87171",
  boxShadow: "0 0 0 3px rgba(239,68,68,0.12)",
};

/** Red helper text under a field. `id` pairs with aria-describedby. */
export function FieldErrorText({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className="text-red-500 text-xs mt-1">
      {children}
    </p>
  );
}

/** Muted hint for a field that is optional now but required later. */
export function FieldLaterHint({ children }: { children: ReactNode }) {
  return <p className="text-[11px] text-slate-500 mt-1">{children}</p>;
}

/** Scroll the first invalid field into view. Fields opt in by
 *  rendering `data-field="<FieldKey>"` on their outer element. */
export function focusFirstMissing(missing: FieldRule[], root: ParentNode = document) {
  const first = missing[0];
  if (!first) return;
  requestAnimationFrame(() => {
    const el = root.querySelector<HTMLElement>(`[data-field="${first.key}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

/* ── Sales Order field rules ──
   Creation gates on customer and point of contact. Release (clear)
   gates on customer, a shipping address and at least one active line,
   matching validateForConfirmation in store.tsx, which now reads
   these rules. */
export const FIELD_RULES: Record<FieldKey, FieldRule> = {
  customer: {
    key: "customer", label: "Customer", requiredAt: "create",
    missingMessage: "Select a customer and point of contact to continue.",
    emptyLabel: "No customer selected",
  },
  poc: {
    key: "poc", label: "Point of contact", requiredAt: "create",
    missingMessage: "Select a point of contact to continue.",
    emptyLabel: "No primary contact",
  },
  customerAddress: {
    key: "customerAddress", label: "Customer address", requiredAt: null,
    missingMessage: "Add a customer address.",
    emptyLabel: "No address on file",
  },
  billTo: {
    key: "billTo", label: "Bill to", requiredAt: null,
    missingMessage: "Add a billing address.",
    emptyLabel: "No billing address added",
  },
  shipTo: {
    key: "shipTo", label: "Ship to", requiredAt: "release",
    missingMessage: "Add a shipping address before releasing this order.",
    emptyLabel: "No shipping address added",
    laterHint: "Needed before this order can be released.",
  },
  paymentTerms: {
    key: "paymentTerms", label: "Payment terms", requiredAt: null,
    missingMessage: "Select payment terms.",
    emptyLabel: "No payment terms configured",
  },
  paymentMethod: {
    key: "paymentMethod", label: "Payment method", requiredAt: null,
    missingMessage: "Select a payment method.",
    emptyLabel: "No payment method added yet",
  },
  salesRep: {
    key: "salesRep", label: "Sales rep", requiredAt: null,
    missingMessage: "Assign a sales rep.",
    emptyLabel: "Unassigned",
  },
  lineItems: {
    key: "lineItems", label: "Line items", requiredAt: "release",
    missingMessage: "Add at least one active line item before releasing this order.",
    emptyLabel: "No items selected",
  },
};
