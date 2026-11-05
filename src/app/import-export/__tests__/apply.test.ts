import { describe, expect, it } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { mockVendors, type Vendor } from "../../data/vendors";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Minimal renderHook (the repo has no @testing-library/dom). */
function renderHook<T>(useHook: () => T, { wrapper: Wrapper }: { wrapper: React.ComponentType<{ children: React.ReactNode }> }) {
  const result = { current: undefined as unknown as T };
  function Probe() {
    result.current = useHook();
    return null;
  }
  const root = createRoot(document.createElement("div"));
  act(() => {
    root.render(React.createElement(Wrapper, null, React.createElement(Probe)));
  });
  return { result };
}
import { PARTNER_GROUPS } from "../../components/vendors/partnerConstants";
import { VendorProvider, useVendors } from "../../context/VendorContext";
import { PartnerGroupsProvider, usePartnerGroups } from "../../context/PartnerGroupsContext";
import { emptyRow, PARTNER_GROUPS_IMPORT_SPEC, PARTNERS_IMPORT_SPEC } from "../spec";
import { buildVendorFromImport, patchVendorFromImport } from "../partnersApply";
import { buildGroupPayloadFromImport } from "../partnerGroupsApply";

const NOW = "2026-09-29T12:00:00.000Z";
const groups = [
  { id: "PG-1", name: "Tier 1 Automotive OEMs", scope: ["vendor", "customer"] as ("vendor" | "customer")[], template: { currency: "eur", paymentTermId: "pt-3", pricingRuleIds: ["pr-2"], creditEnforcement: "soft_warning", paymentMethodTypes: ["wire"] } },
  { id: "PG-2", name: "Nordic Countries", scope: ["vendor"] as ("vendor" | "customer")[] },
];

describe("buildVendorFromImport", () => {
  it("maps every column, keeps email/status/description, writes labels top-level and ids into configData", () => {
    const row = {
      ...emptyRow(PARTNERS_IMPORT_SPEC),
      partnerName: " Acme Supply Co. ", status: "Inactive", partnerGroups: "Nordic Countries|Tier 1 Automotive OEMs", primaryPartnerGroup: "tier 1 automotive oems",
      partnerTypes: "Vendor|Customer", vendorSubTypes: "Carrier", customerSubTypes: "Customer Rules", phoneCode: "+46", phone: "8 123 456 78",
      email: "contact@acme.com", website: "https://acme.com", address: "123 Oak St", description: "Steel brackets.", pointsOfContact: "Issac Archer|Nobody",
      currency: "usd", creditEnforcement: "Hard Block", paymentTerm: "net 30", pricingRules: "Standard Discount, Value (Single-Tier)", paymentMethods: "ACH|Wire", carriers: "FedEx|UPS",
    };
    const v = buildVendorFromImport(row, { groups, now: NOW }, { id: "v-900", code: "VND-900" });
    expect(v).toMatchObject({
      id: "v-900", code: "VND-900", companyName: "Acme Supply Co.", displayName: "Acme Supply Co.", status: "inactive",
      partnerTypes: ["vendor", "customer"], vendorSubTypes: ["Vendor Rules", "Carrier"], customerSubTypes: ["Customer Rules"], vendorType: "Vendor",
      partnerGroup: "PG-1", partnerGroups: ["PG-1", "PG-2"], partnerGroupName: "Tier 1 Automotive OEMs",
      phone: "+46 8 123 456 78", country: "Sweden", emailAddress: "contact@acme.com", website: "https://acme.com", description: "Steel brackets.",
      createdAt: NOW, updatedAt: NOW, defaultCarrierVendor: "FedEx Express",
    });
    expect(v.createdByContact.name).toBe("Ahtisham Ahmad");
    expect(v.primaryContact).toMatchObject({ name: "Acme Supply Co.", email: "contact@acme.com", phone: "+46 8 123 456 78" });
    expect(v.billingAddress.street).toBe("123 Oak St");
    expect(v.globalPointOfContacts.map((c) => c.name)).toEqual(["Issac Archer"]);
    expect(v.configData).toMatchObject({
      vendorSubTypes: ["vendor_rules", "carrier"], customerSubTypes: ["customer_rules"], description: "Steel brackets.",
      creditLimitConfig: { currency: "usd", enforcement: "hard_block" },
      paymentTermConfig: { id: "pt-3", name: "Net 30" },
    });
    expect(v.configData?.pricingRules?.map((r) => r.id)).toEqual(["pr-1"]);
    expect(v.configData?.paymentMethods?.map((m) => m.type)).toEqual(["ach", "wire"]);
    expect(v.configData?.shippingConfig?.vendorPreferences).toEqual([
      { carrier: "fedex", methods: ["fedex-air"], isDefault: true },
      { carrier: "ups", methods: expect.any(Array), isDefault: false },
    ]);
    expect(v.configData?.pointsOfContact?.[0]).toMatchObject({ id: "C-001", name: "Issac Archer" });
  });
  it("blank cells inherit from the primary group's template / scope, else defaults", () => {
    const v = buildVendorFromImport({ ...emptyRow(PARTNERS_IMPORT_SPEC), partnerName: "Inherit Co", primaryPartnerGroup: "Tier 1 Automotive OEMs" }, { groups, now: NOW }, { id: "v-1", code: "VND-1" });
    expect(v.partnerTypes).toEqual(["vendor", "customer"]);
    expect(v.status).toBe("active");
    expect(v.configData?.creditLimitConfig).toMatchObject({ currency: "eur", enforcement: "soft_warning" });
    expect(v.configData?.paymentTermConfig?.id).toBe("pt-3");
    expect(v.configData?.pricingRules?.map((r) => r.id)).toEqual(["pr-2"]);
    expect(v.configData?.paymentMethods?.map((m) => m.type)).toEqual(["wire"]);
    expect(v.phone).toBe("");
    expect(v.country).toBe("United States");
    const bare = buildVendorFromImport({ ...emptyRow(PARTNERS_IMPORT_SPEC), partnerName: "Bare", primaryPartnerGroup: "Unknown Group" }, { groups, now: NOW }, { id: "v-2", code: "VND-2" });
    expect(bare.partnerTypes).toEqual(["vendor"]);
    expect(bare.partnerGroup).toBe("");
    expect(bare.configData?.creditLimitConfig?.currency).toBe("usd");
  });
  it("falls back to the seed PARTNER_GROUPS when no groups are passed", () => {
    const v = buildVendorFromImport({ ...emptyRow(PARTNERS_IMPORT_SPEC), partnerName: "Seed", primaryPartnerGroup: PARTNER_GROUPS[0].name }, { now: NOW }, { id: "v-3", code: "VND-3" });
    expect(v.partnerGroup).toBe(PARTNER_GROUPS[0].id);
  });
});

describe("patchVendorFromImport", () => {
  it("blank leaves values unchanged, the name is never changed, non-blank fields patch", () => {
    const base: Vendor = { ...mockVendors[0], displayName: "Toyota International", emailAddress: "old@toyota.com", status: "active" };
    const patched = patchVendorFromImport(base, { ...emptyRow(PARTNERS_IMPORT_SPEC), partnerName: "TOYOTA international", status: "Inactive", website: "https://new.example" }, { groups, now: NOW });
    expect(patched.displayName).toBe("Toyota International");
    expect(patched.emailAddress).toBe("old@toyota.com");
    expect(patched.status).toBe("inactive");
    expect(patched.website).toBe("https://new.example");
    expect(patched.updatedAt).toBe(NOW);
    expect(patched.createdAt).toBe(base.createdAt);
    const regrouped = patchVendorFromImport(base, { ...emptyRow(PARTNERS_IMPORT_SPEC), partnerName: base.displayName, primaryPartnerGroup: "Nordic Countries", currency: "SEK" }, { groups, now: NOW });
    expect(regrouped.partnerGroup).toBe("PG-2");
    expect(regrouped.configData?.creditLimitConfig?.currency).toBe("sek");
  });
});

describe("buildGroupPayloadFromImport", () => {
  const partners = [{ id: "v-001", displayName: "Toyota International", companyName: "Toyota Motor" }, { id: "v-002", displayName: "NTN", companyName: "NTN Corporation" }];
  it("create: modal-shaped payload with template defaults and resolved member ids", () => {
    const row = {
      ...emptyRow(PARTNER_GROUPS_IMPORT_SPEC),
      groupName: " Maryland Dealers ", status: "inactive", country: "united states", description: "d", scope: "Vendor|Customer", defaultVendorSubTypes: "Vendor Rules|Carrier",
      memberIds: "toyota international|NTN Corporation|Ghost", primaryMemberIds: "Toyota International|Ghost", billingType: "International", currency: "SEK", creditEnforcement: "Soft Warning",
      maxCreditLimit: "100,000", warningThreshold: "80", paymentTerm: "Net 30", pricingRules: "Tiered Discount, Value (Multi-Tier)", paymentMethods: "Card", carriers: "DHL",
    };
    const p = buildGroupPayloadFromImport(row, { partners });
    expect(p).toMatchObject({
      kind: "partner-group", groupName: "Maryland Dealers", status: "Inactive", country: "United States", countryFlag: "\u{1F1FA}\u{1F1F8}", description: "d",
      scope: ["vendor", "customer"], defaultVendorSubTypes: ["vendor_rules", "carrier"], memberIds: ["v-001", "v-002"], primaryMemberIds: ["v-001"],
      configBillingType: "international", configCreditLimit: { currency: "sek", enforcement: "soft_warning", maxCreditLimit: "100000", warningThreshold: "80" },
      configPaymentTerm: { id: "pt-3" },
    });
    expect((p.configPricingRules as { id: string }[]).map((r) => r.id)).toEqual(["pr-3"]);
    expect((p.configPaymentMethods as { type: string }[]).map((m) => m.type)).toEqual(["card"]);
    expect((p.configShipping as { vendorPreferences: { carrier: string }[] }).vendorPreferences[0].carrier).toBe("dhl");
    const bare = buildGroupPayloadFromImport({ ...emptyRow(PARTNER_GROUPS_IMPORT_SPEC), groupName: "Bare" }, {});
    expect(bare).toMatchObject({ status: "Active", configBillingType: "domestic", configCreditLimit: { currency: "usd", enforcement: "none" } });
    expect(bare.memberIds).toBeUndefined();
  });
  it("update: only non-blank fields are in the payload", () => {
    const base = { id: "PG-9", name: "Old", description: "keep", country: "", countryFlag: "", memberCount: 1, memberIds: ["v-001"], configData: { configBillingType: "domestic", configCreditLimit: { currency: "usd", enforcement: "none", maxCreditLimit: "5", warningThreshold: "" } } };
    const p = buildGroupPayloadFromImport({ ...emptyRow(PARTNER_GROUPS_IMPORT_SPEC), groupName: "old", warningThreshold: "50" }, { partners }, base);
    expect(Object.keys(p).sort()).toEqual(["configCreditLimit", "groupName", "kind"]);
    expect(p.configCreditLimit).toEqual({ currency: "usd", enforcement: "none", maxCreditLimit: "5", warningThreshold: "50" });
  });
});

describe("store upserts", () => {
  it("VendorContext.upsertImportedVendors creates and updates, returning counts synchronously", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => React.createElement(VendorProvider, null, children);
    const { result } = renderHook(() => useVendors(), { wrapper });
    const before = result.current.vendors.length;
    const existingName = result.current.vendors[0].displayName;
    let res: { created: number; updated: number } | undefined;
    act(() => {
      res = result.current.upsertImportedVendors(
        [
          { ...emptyRow(PARTNERS_IMPORT_SPEC), partnerName: "Brand New Co", primaryPartnerGroup: "Nordic Countries", email: "n@new.co" },
          { ...emptyRow(PARTNERS_IMPORT_SPEC), partnerName: existingName.toUpperCase(), website: "https://patched.example" },
        ],
        { groups },
      );
    });
    expect(res).toEqual({ created: 1, updated: 1 });
    expect(result.current.vendors).toHaveLength(before + 1);
    expect(result.current.vendors[0]).toMatchObject({ displayName: "Brand New Co", emailAddress: "n@new.co", partnerGroup: "PG-2" });
    expect(result.current.vendors[0].code).toBe(`VND-${result.current.vendors[0].id.slice(2)}`);
    expect(result.current.vendors.find((v) => v.displayName === existingName)?.website).toBe("https://patched.example");
  });
  it("PartnerGroupsContext.upsertImportedGroups goes through payloadToRecord", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => React.createElement(PartnerGroupsProvider, null, children);
    const { result } = renderHook(() => usePartnerGroups(), { wrapper });
    const before = result.current.groups.length;
    const existing = result.current.groups[1];
    let res: { created: number; updated: number } | undefined;
    act(() => {
      res = result.current.upsertImportedGroups(
        [
          { ...emptyRow(PARTNER_GROUPS_IMPORT_SPEC), groupName: "Imported Group", memberIds: "Toyota International", currency: "EUR" },
          { ...emptyRow(PARTNER_GROUPS_IMPORT_SPEC), groupName: existing.name.toLowerCase(), status: "Inactive" },
        ],
        { partners: [{ id: "v-001", displayName: "Toyota International", companyName: "Toyota" }] },
      );
    });
    expect(res).toEqual({ created: 1, updated: 1 });
    expect(result.current.groups).toHaveLength(before + 1);
    const created = result.current.groups[0];
    expect(created).toMatchObject({ name: "Imported Group", status: "Active", memberIds: ["v-001"], memberCount: 1, template: { currency: "eur", creditEnforcement: "none" } });
    expect(created.createdBy?.name).toBe("Ahtisham Ahmad");
    expect(created.id).toMatch(/^PG-NEW-/);
    const updated = result.current.groups.find((g) => g.id === existing.id)!;
    expect(updated.status).toBe("Inactive");
    expect(updated.description).toBe(existing.description);
    expect(updated.memberCount).toBe(existing.memberCount);
  });
});
