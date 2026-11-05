/**
 * Diff two configData snapshots into a human-readable list of changes
 * for the GroupBulkApplyModal "Changes you made" panel.
 *
 * Both inputs are the nested shape ConfigPageContent writes:
 *   {
 *     configCreditLimit: { currency, enforcement, maxCreditLimit, ... },
 *     configPaymentTerm: { id, name, ... },
 *     configPricingRules: [{ id, name, ... }, ...],
 *     configPaymentMethods: [{ id, type, typeLabel, ... }, ...],
 *     configBillingType: "domestic" | ...,
 *     configShipping: { carrierServices: [...], vendorPreferences: [...] },
 *     configCustomMethods: { self: [{ id, name, mode, ... }, ...] },
 *   }
 *
 * The output is a flat array — each entry is a single user-perceivable
 * change with a label and (where it makes sense) before/after strings.
 */
import { CURRENCY_OPTIONS } from "./partnerConstants";

export interface ConfigChangeItem {
  field: string;
  previous?: string;
  next?: string;
}

const ENFORCEMENT_LABEL: Record<string, string> = {
  none: "No Enforcement",
  soft_warning: "Soft Warning",
  hard_block: "Hard Block",
};

/** Written ISO code for a stored currency id ("usd" → "USD"), from the currency catalog. */
function currencyCode(id: string | undefined): string | undefined {
  if (!id) return undefined;
  const opt = CURRENCY_OPTIONS.find((c) => c.id === id);
  return opt ? opt.label.split(",")[0] : id;
}

function getCurrency(o: unknown): string | undefined {
  const cl = (o as Record<string, unknown> | undefined)?.["configCreditLimit"] as
    | { currency?: string }
    | undefined;
  return cl?.currency;
}

function readPaymentTerm(o: unknown): { id?: string; name?: string } | undefined {
  return (o as Record<string, unknown> | undefined)?.["configPaymentTerm"] as
    | { id?: string; name?: string }
    | undefined;
}

function readCreditLimit(o: unknown) {
  return (o as Record<string, unknown> | undefined)?.["configCreditLimit"] as
    | {
        currency?: string;
        enforcement?: string;
        maxCreditLimit?: string;
        warningThreshold?: string;
        hardBlockRecipients?: string[];
        softWarningRecipients?: string[];
      }
    | undefined;
}

function readPricingRules(o: unknown): Array<{ id?: string; name?: string }> {
  return ((o as Record<string, unknown> | undefined)?.["configPricingRules"] as
    | Array<{ id?: string; name?: string }>
    | undefined) ?? [];
}

function readPaymentMethods(o: unknown): Array<{ id?: string; typeLabel?: string; nickname?: string }> {
  return ((o as Record<string, unknown> | undefined)?.["configPaymentMethods"] as
    | Array<{ id?: string; typeLabel?: string; nickname?: string }>
    | undefined) ?? [];
}

function readShipping(o: unknown) {
  return ((o as Record<string, unknown> | undefined)?.["configShipping"] as
    | {
        carrierServices?: Array<{ name?: string }>;
        vendorPreferences?: Array<{ carrier?: string }>;
      }
    | undefined) ?? {};
}

function readCarrierSelfMethods(o: unknown): Array<{ id?: string; name?: string }> {
  const cm = (o as Record<string, unknown> | undefined)?.["configCustomMethods"] as
    | Record<string, Array<{ id?: string; name?: string }>>
    | undefined;
  return cm?.["self"] ?? [];
}

function setDiff<T>(a: T[], b: T[], key: (x: T) => string) {
  const ak = new Set(a.map(key));
  const bk = new Set(b.map(key));
  const added = b.filter((x) => !ak.has(key(x)));
  const removed = a.filter((x) => !bk.has(key(x)));
  return { added, removed };
}

export function diffConfigData(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined,
): ConfigChangeItem[] {
  if (!after) return [];
  const items: ConfigChangeItem[] = [];

  // ─ Currency ─
  const prevCurrency = getCurrency(before);
  const nextCurrency = getCurrency(after);
  if (prevCurrency !== nextCurrency && nextCurrency) {
    items.push({
      field: "Currency",
      previous: currencyCode(prevCurrency),
      next: currencyCode(nextCurrency),
    });
  }

  // ─ Payment Term ─
  const prevPt = readPaymentTerm(before);
  const nextPt = readPaymentTerm(after);
  if ((prevPt?.id ?? null) !== (nextPt?.id ?? null)) {
    items.push({
      field: "Payment Term",
      previous: prevPt?.name ?? (prevPt?.id ? "—" : "Not Set"),
      next: nextPt?.name ?? (nextPt?.id ? "—" : "Removed"),
    });
  }

  // ─ Credit Limit fields ─
  const prevCL = readCreditLimit(before);
  const nextCL = readCreditLimit(after);
  if ((prevCL?.enforcement ?? "none") !== (nextCL?.enforcement ?? "none")) {
    items.push({
      field: "Credit Enforcement",
      previous: ENFORCEMENT_LABEL[prevCL?.enforcement ?? "none"],
      next: ENFORCEMENT_LABEL[nextCL?.enforcement ?? "none"],
    });
  }
  if ((prevCL?.maxCreditLimit ?? "") !== (nextCL?.maxCreditLimit ?? "")) {
    items.push({
      field: "Max Credit Limit",
      previous: prevCL?.maxCreditLimit || "Not Set",
      next: nextCL?.maxCreditLimit || "Removed",
    });
  }
  if ((prevCL?.warningThreshold ?? "") !== (nextCL?.warningThreshold ?? "")) {
    items.push({
      field: "Warning Threshold",
      previous: prevCL?.warningThreshold ? `${prevCL.warningThreshold}%` : "Not Set",
      next: nextCL?.warningThreshold ? `${nextCL.warningThreshold}%` : "Removed",
    });
  }
  const prevSW = (prevCL?.softWarningRecipients ?? []).slice().sort();
  const nextSW = (nextCL?.softWarningRecipients ?? []).slice().sort();
  if (JSON.stringify(prevSW) !== JSON.stringify(nextSW)) {
    items.push({
      field: "Soft-Warning Recipients",
      previous: `${prevSW.length} recipient${prevSW.length === 1 ? "" : "s"}`,
      next: `${nextSW.length} recipient${nextSW.length === 1 ? "" : "s"}`,
    });
  }
  const prevHB = (prevCL?.hardBlockRecipients ?? []).slice().sort();
  const nextHB = (nextCL?.hardBlockRecipients ?? []).slice().sort();
  if (JSON.stringify(prevHB) !== JSON.stringify(nextHB)) {
    items.push({
      field: "Hard-Block Recipients",
      previous: `${prevHB.length} recipient${prevHB.length === 1 ? "" : "s"}`,
      next: `${nextHB.length} recipient${nextHB.length === 1 ? "" : "s"}`,
    });
  }

  // ─ Pricing Rules ─
  const prevPR = readPricingRules(before);
  const nextPR = readPricingRules(after);
  const prDiff = setDiff(prevPR, nextPR, (r) => r.id ?? "");
  for (const r of prDiff.added) {
    items.push({ field: "Pricing Rule Added", next: r.name ?? r.id ?? "—" });
  }
  for (const r of prDiff.removed) {
    items.push({ field: "Pricing Rule Removed", previous: r.name ?? r.id ?? "—" });
  }

  // ─ Payment Methods ─
  const prevPM = readPaymentMethods(before);
  const nextPM = readPaymentMethods(after);
  const pmDiff = setDiff(prevPM, nextPM, (m) => m.id ?? "");
  for (const m of pmDiff.added) {
    items.push({ field: "Payment Method Added", next: m.nickname || m.typeLabel || m.id || "—" });
  }
  for (const m of pmDiff.removed) {
    items.push({ field: "Payment Method Removed", previous: m.nickname || m.typeLabel || m.id || "—" });
  }

  // ─ Carrier Self Methods (Carrier profile) ─
  const prevCSM = readCarrierSelfMethods(before);
  const nextCSM = readCarrierSelfMethods(after);
  const csmDiff = setDiff(prevCSM, nextCSM, (m) => m.id ?? "");
  for (const m of csmDiff.added) {
    items.push({ field: "Shipping Method Added", next: m.name ?? "—" });
  }
  for (const m of csmDiff.removed) {
    items.push({ field: "Shipping Method Removed", previous: m.name ?? "—" });
  }

  // ─ Vendor Shipping Prefs (carrier picks) ─
  const prevSh = readShipping(before);
  const nextSh = readShipping(after);
  const prevVP = prevSh.vendorPreferences ?? [];
  const nextVP = nextSh.vendorPreferences ?? [];
  const vpDiff = setDiff(prevVP, nextVP, (p) => p.carrier ?? "");
  for (const p of vpDiff.added) {
    items.push({ field: "Carrier Added", next: p.carrier ?? "—" });
  }
  for (const p of vpDiff.removed) {
    items.push({ field: "Carrier Removed", previous: p.carrier ?? "—" });
  }

  return items;
}
