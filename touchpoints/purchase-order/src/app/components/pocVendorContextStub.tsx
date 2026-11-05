/**
 * Stub for the Partners `VendorContext` used by the ported
 * `ContactsDirectoryPage`. The PO-Detail surface doesn't have access to
 * the real Partners vendor store, so we expose a fixed mock array that
 * matches the `Vendor` shape the directory reads (just `id`,
 * `displayName`, `companyName` — that's all `useVendors()` is consumed
 * for in the table).
 *
 * Keep the mock list aligned with the partner-name pool in
 * `pocDirectoryData.ts` so the linked-partner pills resolve to vendor
 * ids consistently.
 */
import React, { useMemo } from "react";

/** Minimal Vendor shape consumed by ContactsDirectoryPage. */
export interface Vendor {
  id: string;
  displayName: string;
  companyName: string;
}

/** Hand-curated vendor list — matches the linked-partner pool from
 *  `pocDirectoryData.ts` plus a few extras so the linked-partners
 *  popover always resolves to a known vendor. */
const MOCK_VENDORS: Vendor[] = [
  { id: "v-acme",      displayName: "Acme Corp",            companyName: "Acme Corp" },
  { id: "v-techvault", displayName: "TechVault",            companyName: "TechVault" },
  { id: "v-nexgen",    displayName: "NexGen Solutions",     companyName: "NexGen Solutions" },
  { id: "v-apex",      displayName: "Apex Industries",      companyName: "Apex Industries" },
  { id: "v-summit",    displayName: "Summit Group",         companyName: "Summit Group" },
  { id: "v-vertex",    displayName: "Vertex Labs",          companyName: "Vertex Labs" },
  { id: "v-pioneer",   displayName: "Pioneer Systems",      companyName: "Pioneer Systems" },
  { id: "v-atlas",     displayName: "Atlas Logistics",      companyName: "Atlas Logistics" },
  { id: "v-beacon",    displayName: "Beacon Analytics",     companyName: "Beacon Analytics" },
  { id: "v-cascade",   displayName: "Cascade Networks",     companyName: "Cascade Networks" },
  { id: "v-delta",     displayName: "Delta Manufacturing",  companyName: "Delta Manufacturing" },
  { id: "v-echo",      displayName: "Echo Enterprises",     companyName: "Echo Enterprises" },
  { id: "v-falcon",    displayName: "Falcon Dynamics",      companyName: "Falcon Dynamics" },
  { id: "v-granite",   displayName: "Granite Holdings",     companyName: "Granite Holdings" },
  { id: "v-horizon",   displayName: "Horizon Partners",     companyName: "Horizon Partners" },
];

interface VendorContextValue {
  vendors: Vendor[];
}

/** Drop-in replacement for the Partners `useVendors()` hook — returns a
 *  fixed mock list. */
export function useVendors(): VendorContextValue {
  return useMemo(() => ({ vendors: MOCK_VENDORS }), []);
}

/** Optional provider for parity with the Partners source — currently a
 *  no-op since we don't need to mutate the list inside the PO modal. */
export function VendorProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
