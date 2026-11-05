import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { PARTNER_GROUPS, type PartnerGroup, type PartnerGroupTemplate } from "../components/vendors/partnerConstants";
import { CURRENT_USER, type CreatedByPerson } from "../data/currentUser";
import type { ImportRow } from "../import-export/spec";
import { buildGroupPayloadFromImport, findGroupByName, type GroupsApplyContext } from "../import-export/partnerGroupsApply";
import { syncPartnerGroups } from "../currency/partnerCurrency";

export interface ImportUpsertResult {
  created: number;
  updated: number;
}

/**
 * Optional fields a freshly-created group may carry beyond the base
 * PartnerGroup shape. We keep the underlying interface unchanged but
 * stash the richer fields the create/edit modal collects (status, scope,
 * sub-types, members, etc.) on the same record so the listing and
 * detail surfaces can render them without a separate join.
 */
export interface PartnerGroupExtras {
  status?: "Active" | "Inactive" | "Archived";
  scope?: ("vendor" | "customer")[];
  defaultVendorSubTypes?: string[];
  defaultCustomerSubTypes?: string[];
  pocIds?: string[];
  memberIds?: string[];
  attachments?: { id: string; name: string; size: string; type: string }[];
  /**
   * Full Step 3 (Template Configuration) payload as written by
   * ConfigPageContent. Stores everything the form collects so the same
   * values flow back into the edit dialog. Keeps the original nested
   * keys (configCreditLimit, configPaymentTerm, configPricingRules,
   * configPaymentMethods, configBillingType, configShipping,
   * configPointsOfContact) so consumers can introspect anything.
   */
  configData?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: CreatedByPerson;
}

export type PartnerGroupRecord = PartnerGroup & PartnerGroupExtras;

interface PartnerGroupsContextType {
  groups: PartnerGroupRecord[];
  getGroup: (id: string) => PartnerGroupRecord | undefined;
  addGroup: (data: Record<string, unknown>) => PartnerGroupRecord;
  updateGroup: (id: string, data: Record<string, unknown>) => PartnerGroupRecord | undefined;
  deleteGroup: (id: string) => void;
  /**
   * Fold reviewed import rows into the store through `payloadToRecord`. A row
   * whose Group Name matches an existing group (trim, case-insensitive)
   * updates it; every other row creates one. Pass `ctx.partners` (the vendor
   * store) so Linked Partners / Primary Partners names resolve to ids.
   */
  upsertImportedGroups: (rows: ImportRow[], ctx?: GroupsApplyContext) => ImportUpsertResult;
}

const PartnerGroupsContext = createContext<PartnerGroupsContextType | undefined>(undefined);

let groupSeq = 9000;
function nextGroupId() {
  groupSeq += 1;
  return `PG-NEW-${groupSeq}`;
}

/**
 * Pick out the flat template fields (currency, payment term id, etc.)
 * from the nested ConfigPageContent payload. ConfigPageContent emits
 * `configCreditLimit`, `configPaymentTerm`, `configPricingRules`, and
 * `configPaymentMethods`; we read those once into the legacy template
 * shape so existing surfaces (PARTNER_GROUPS-driven displays) keep
 * working.
 */
function deriveTemplateFromConfig(
  cfg: Record<string, unknown>,
  fallback?: PartnerGroupTemplate,
): PartnerGroupTemplate | undefined {
  const tpl: PartnerGroupTemplate = { ...(fallback ?? {}) };

  const cl = cfg.configCreditLimit as { currency?: string; enforcement?: string } | undefined;
  if (cl?.currency) tpl.currency = cl.currency;
  if (cl?.enforcement) tpl.creditEnforcement = cl.enforcement;

  const pt = cfg.configPaymentTerm as { id?: string } | undefined;
  if (pt?.id) tpl.paymentTermId = pt.id;

  const pr = cfg.configPricingRules as Array<{ id?: string }> | undefined;
  if (Array.isArray(pr) && pr.length > 0) {
    const ids = pr.map((r) => r.id).filter((x): x is string => typeof x === "string");
    if (ids.length) tpl.pricingRuleIds = ids;
  }

  const pm = cfg.configPaymentMethods as Array<{ type?: string }> | undefined;
  if (Array.isArray(pm) && pm.length > 0) {
    const types = pm.map((m) => m.type).filter((x): x is string => typeof x === "string");
    if (types.length) tpl.paymentMethodTypes = Array.from(new Set(types));
  }

  return Object.keys(tpl).length ? tpl : undefined;
}

/** Map a CreatePartnerGroupModal payload onto our PartnerGroupRecord shape. */
function payloadToRecord(
  data: Record<string, unknown>,
  base?: PartnerGroupRecord,
): PartnerGroupRecord {
  // Preserve seed memberCount on partial updates that don't pass
  // memberIds — without this, saving a per-profile config from the
  // detail page would clobber a 187-member group down to 0.
  const explicitMemberIds = data.memberIds as string[] | undefined;
  const memberIds = explicitMemberIds ?? base?.memberIds ?? [];
  const memberCount = explicitMemberIds
    ? memberIds.length
    : (base?.memberCount ?? memberIds.length);

  // The Step 3 payload is spread flat into `data` by handleSave (so
  // `configCreditLimit`, `configPaymentTerm`, etc. live at the top
  // level). Stash that whole bundle on `configData` so it round-trips
  // verbatim into the edit dialog.
  const KNOWN_NON_CONFIG_KEYS = new Set([
    "kind", "groupName", "status", "country", "countryFlag", "description",
    "scope", "defaultVendorSubTypes", "defaultCustomerSubTypes", "pocIds",
    "attachments", "memberIds",
  ]);
  const configData: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (!KNOWN_NON_CONFIG_KEYS.has(k)) configData[k] = v;
  }
  // Merge with prior config (so a partial-section save doesn't blow
  // away other sections).
  const mergedConfig = { ...(base?.configData ?? {}), ...configData };

  const template = deriveTemplateFromConfig(mergedConfig, base?.template);

  // Status from the modal arrives as "Active" / "Inactive" / "Archived".
  // Archive/unarchive is a header action on the details page so it must
  // be a valid value here, not collapsed back to Active.
  const statusRaw = (data.status as string | undefined) ?? base?.status ?? "Active";
  const status = (statusRaw === "Inactive"
    ? "Inactive"
    : statusRaw === "Archived"
      ? "Archived"
      : "Active") as "Active" | "Inactive" | "Archived";

  const now = new Date().toISOString();
  return {
    id: base?.id ?? nextGroupId(),
    name: ((data.groupName as string) || base?.name || "").trim(),
    description: (data.description as string) ?? base?.description ?? "",
    country: (data.country as string) ?? base?.country ?? "",
    countryFlag: (data.countryFlag as string) ?? base?.countryFlag ?? "",
    memberCount,
    template,
    status,
    scope: (data.scope as PartnerGroupExtras["scope"]) ?? base?.scope ?? [],
    defaultVendorSubTypes: (data.defaultVendorSubTypes as string[]) ?? base?.defaultVendorSubTypes ?? [],
    defaultCustomerSubTypes: (data.defaultCustomerSubTypes as string[]) ?? base?.defaultCustomerSubTypes ?? [],
    pocIds: (data.pocIds as string[]) ?? base?.pocIds ?? [],
    memberIds,
    attachments: (data.attachments as PartnerGroupExtras["attachments"]) ?? base?.attachments ?? [],
    configData: mergedConfig,
    createdAt: base?.createdAt ?? now,
    updatedAt: now,
    createdBy: base?.createdBy ?? CURRENT_USER,
  };
}

/**
 * Showcase configuration applied to the first seed group ("Americas",
 * PG-1-1). This is the row stakeholders demo against — every section
 * is populated with realistic dummy data so the listing flags, the
 * detail-page Configuration tab, and the edit modal all render a
 * complete, real-world example. Other seed groups stay sparse to
 * highlight what an under-configured group looks like.
 */
const SHOWCASE_OVERRIDES: Partial<PartnerGroupRecord> = {
  status: "Active",
  scope: ["vendor", "customer"],
  defaultVendorSubTypes: ["vendor_rules", "carrier"],
  defaultCustomerSubTypes: ["customer_rules"],
  memberIds: Array.from({ length: 187 }, (_, i) => `mock-partner-${i}`),
  configData: {
    configBillingType: "domestic",
    configCreditLimit: {
      currency: "usd",
      enforcement: "soft_warning",
      maxCreditLimit: "100000",
      warningThreshold: "80",
      // Recipient ids match SearchableUserPicker source (U-001..U-010
      // in partnerConstants.tsx). Picks: Supply Chain Lead, CFO, Buyer,
      // Warehouse Lead — same set the creation form's reference shows.
      hardBlockRecipients: ["U-005", "U-002"],
      softWarningRecipients: ["U-003", "U-005", "U-006", "U-008"],
    },
    configPaymentTerm: {
      id: "pt-3",
      name: "Net 30",
      type: "Net",
      trigger: "Shipping",
      description: "Payment is due 30 days after shipment.",
      duration: "30",
    },
    configPricingRules: [
      {
        id: "pr-1",
        name: "Standard Discount, Value (Single-Tier)",
        type: "discount",
        basis: "value",
        description: "10% off on orders over $1,000",
      },
      {
        id: "pr-3",
        name: "Tiered Discount, Value (Multi-Tier)",
        type: "discount",
        basis: "value",
        description: "Tiered discounts on $1K / $10K / $50K thresholds",
      },
      {
        id: "pr-5",
        name: "Standard Premium, Value (Single-Tier)",
        type: "premium",
        basis: "value",
        description: "5% premium on rush orders",
      },
    ],
    configPaymentMethods: [
      {
        id: "pm-1", type: "ach", typeLabel: "ACH / Direct Deposit",
        isPrimary: true, isSaved: true, expanded: false,
        nickname: "Primary ACH",
        bankName: "Bank of America", accountTitle: "Americas Operations",
        accountNumber: "****6789", routingNumber: "021000322",
        swiftCode: "", accountType: "checking",
        cardholderName: "", cardNumber: "", expiryDate: "", billingAddress: "",
        walletProvider: "", walletId: "",
        payeeName: "", mailingAddress: "",
        recipientName: "", collectionPoint: "",
        methodName: "", description: "", documentLink: "",
        phone: "", countryCode: "+1", specialInstructions: "",
        applyDiscount: true, discountPercent: "1.5", discountMode: "percent",
      },
      {
        id: "pm-2", type: "wire", typeLabel: "Wire Transfer",
        isPrimary: false, isSaved: true, expanded: false,
        nickname: "International Wire",
        bankName: "JPMorgan Chase", accountTitle: "Americas Operations",
        accountNumber: "****4321", routingNumber: "021000021",
        swiftCode: "CHASUS33", accountType: "checking",
        cardholderName: "", cardNumber: "", expiryDate: "", billingAddress: "",
        walletProvider: "", walletId: "",
        payeeName: "", mailingAddress: "",
        recipientName: "", collectionPoint: "",
        methodName: "", description: "", documentLink: "",
        phone: "", countryCode: "+1", specialInstructions: "",
        applyDiscount: false, discountPercent: "", discountMode: "percent",
      },
      {
        id: "pm-3", type: "card", typeLabel: "Credit / Debit Card",
        isPrimary: false, isSaved: true, expanded: false,
        nickname: "Corporate Card",
        bankName: "", accountTitle: "", accountNumber: "", routingNumber: "",
        swiftCode: "", accountType: "",
        cardholderName: "Americas Operations", cardNumber: "**** **** **** 4242",
        expiryDate: "12/28", billingAddress: "100 Wall St, New York, NY",
        walletProvider: "", walletId: "",
        payeeName: "", mailingAddress: "",
        recipientName: "", collectionPoint: "",
        methodName: "", description: "", documentLink: "",
        phone: "", countryCode: "+1", specialInstructions: "",
        applyDiscount: false, discountPercent: "", discountMode: "percent",
      },
    ],
    // Carrier-self methods — methods this group offers AS A CARRIER
    // (when viewing the Carrier profile). Renders via
    // CarrierSelfMethodCard. Three populated cards span Air / Ground /
    // Sea modes so stakeholders see a full mode-mix demo.
    configCustomMethods: {
      self: [
        {
          id: "self-1",
          name: "Same-Day Air",
          shortName: "Same-Day",
          desc: "Priority air freight for time-critical inbound shipments. Customs cleared on arrival.",
          minDays: 1,
          maxDays: 1,
          cost: "—",
          isDefault: true,
          mode: "air" as const,
          leadTimeUnit: "days" as const,
          packageTypes: ["parcel", "box"] as const,
          regions: ["North America", "EMEA"],
        },
        {
          id: "self-2",
          name: "Standard Ground",
          shortName: "Ground",
          desc: "Cost-efficient regional truck delivery, 5 to 7 business days door-to-door.",
          minDays: 5,
          maxDays: 7,
          cost: "—",
          isDefault: false,
          mode: "ground" as const,
          leadTimeUnit: "days" as const,
          packageTypes: ["parcel", "box", "pallet"] as const,
          regions: ["North America"],
        },
        {
          id: "self-3",
          name: "Ocean FCL",
          shortName: "FCL",
          desc: "Full-container ocean freight for bulk + heavy cargo, port-to-port.",
          minDays: 4,
          maxDays: 8,
          cost: "—",
          isDefault: false,
          mode: "sea" as const,
          leadTimeUnit: "weeks" as const,
          packageTypes: ["ftl", "pallet"] as const,
          regions: ["Global"],
        },
      ],
    },
    configShipping: {
      carrierServices: [
        { name: "Ground Standard", description: "5 to 7 business days domestic ground", minDays: 5, maxDays: 7, isDefault: true },
        { name: "Express 2-Day", description: "2 business days, signature required", minDays: 2, maxDays: 2, isDefault: false },
        { name: "Overnight", description: "Next business day before noon", minDays: 1, maxDays: 1, isDefault: false },
      ],
      // Carrier ids must match SHIPPING_CARRIER_CATALOG; method ids
      // must match SHIPPING_CARRIER_METHODS — otherwise the saved
      // card renders "Unknown Carrier".
      vendorPreferences: [
        { carrier: "fedex", methods: ["fedex-ground", "fedex-air"], isDefault: true, primaryMethod: "fedex-ground" },
        { carrier: "ups", methods: ["ups-ground", "ups-next-day"], isDefault: false, primaryMethod: "ups-ground" },
        { carrier: "dhl", methods: ["dhl-express", "dhl-freight"], isDefault: false, primaryMethod: "dhl-express" },
      ],
    },
    configPointsOfContact: [],
  },
  createdAt: "2024-01-15T10:00:00.000Z",
  createdBy: CURRENT_USER,
};

export function PartnerGroupsProvider({ children }: { children: React.ReactNode }) {
  const [groups, setGroups] = useState<PartnerGroupRecord[]>(() => {
    return PARTNER_GROUPS.map((g, idx) => {
      // First seed row — apply the showcase overrides so stakeholders
      // see a fully configured group out of the box.
      if (idx === 0) {
        return { ...g, ...SHOWCASE_OVERRIDES };
      }
      return { ...g };
    });
  });

  // Currency resolution outside React reads the store's groups (see syncPartnerGroups).
  syncPartnerGroups(groups);

  const getGroup = useCallback((id: string) => groups.find((g) => g.id === id), [groups]);

  const addGroup = useCallback((data: Record<string, unknown>) => {
    const record = payloadToRecord(data);
    setGroups((prev) => [record, ...prev]);
    return record;
  }, []);

  const updateGroup = useCallback((id: string, data: Record<string, unknown>) => {
    let next: PartnerGroupRecord | undefined;
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== id) return g;
        next = payloadToRecord(data, g);
        return next;
      }),
    );
    return next;
  }, []);

  const deleteGroup = useCallback((id: string) => {
    setGroups((prev) => prev.filter((g) => g.id !== id));
  }, []);

  /* Latest list, so the import upsert can return counts synchronously. */
  const groupsRef = useRef<PartnerGroupRecord[]>(groups);
  groupsRef.current = groups;

  const upsertImportedGroups = useCallback((rows: ImportRow[], ctx: GroupsApplyContext = {}): ImportUpsertResult => {
    const next = [...groupsRef.current];
    let created = 0;
    let updated = 0;
    for (const row of rows) {
      const name = (row.groupName ?? "").trim();
      if (!name) continue;
      const existing = findGroupByName(next, name);
      if (existing) {
        const record = payloadToRecord(buildGroupPayloadFromImport(row, ctx, existing), existing);
        next[next.findIndex((g) => g.id === existing.id)] = record;
        updated++;
      } else {
        next.unshift(payloadToRecord(buildGroupPayloadFromImport(row, ctx)));
        created++;
      }
    }
    groupsRef.current = next;
    setGroups(next);
    return { created, updated };
  }, []);

  return (
    <PartnerGroupsContext.Provider value={{ groups, getGroup, addGroup, updateGroup, deleteGroup, upsertImportedGroups }}>
      {children}
    </PartnerGroupsContext.Provider>
  );
}

export function usePartnerGroups() {
  const ctx = useContext(PartnerGroupsContext);
  if (!ctx) throw new Error("usePartnerGroups must be used within a PartnerGroupsProvider");
  return ctx;
}
