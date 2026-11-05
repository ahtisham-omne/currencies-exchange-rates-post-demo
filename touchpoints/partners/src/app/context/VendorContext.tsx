import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import {
  Vendor,
  mockVendors,
  generateVendorId,
  generateVendorCode,
} from "../data/vendors";
import type { ImportRow } from "../import-export/spec";
import {
  buildVendorFromImport,
  findVendorByName,
  patchVendorFromImport,
  type PartnersApplyContext,
} from "../import-export/partnersApply";

export interface ImportUpsertResult {
  created: number;
  updated: number;
}

interface VendorContextType {
  vendors: Vendor[];
  getVendor: (id: string) => Vendor | undefined;
  addVendor: (vendor: Omit<Vendor, "id" | "code" | "createdAt" | "updatedAt" | "totalOrders" | "totalSpent" | "outstandingBalance">) => Vendor;
  updateVendor: (id: string, updates: Partial<Vendor>) => void;
  archiveVendor: (id: string) => void;
  restoreVendor: (id: string) => void;
  deleteVendor: (id: string) => void;
  /**
   * Fold reviewed import rows into the store. A row whose Partner Name
   * matches an existing displayName / companyName (trim, case-insensitive)
   * patches that partner; every other row creates a full Vendor record.
   * Pass `ctx.groups` (session + seed partner groups) so group names resolve.
   */
  upsertImportedVendors: (rows: ImportRow[], ctx?: PartnersApplyContext) => ImportUpsertResult;
}

const VendorContext = createContext<VendorContextType | undefined>(undefined);

export function VendorProvider({ children }: { children: React.ReactNode }) {
  const [vendors, setVendors] = useState<Vendor[]>(mockVendors);
  /* Latest list, so the import upsert can return counts synchronously. */
  const vendorsRef = useRef<Vendor[]>(vendors);
  vendorsRef.current = vendors;

  const getVendor = useCallback(
    (id: string) => vendors.find((v) => v.id === id),
    [vendors]
  );

  const addVendor = useCallback(
    (
      vendorData: Omit<Vendor, "id" | "code" | "createdAt" | "updatedAt" | "totalOrders" | "totalSpent" | "outstandingBalance">
    ): Vendor => {
      const now = new Date().toISOString();
      const newVendor: Vendor = {
        ...vendorData,
        id: generateVendorId(),
        code: generateVendorCode(),
        totalOrders: 0,
        totalSpent: 0,
        outstandingBalance: 0,
        createdAt: now,
        updatedAt: now,
      };
      setVendors((prev) => [newVendor, ...prev]);
      return newVendor;
    },
    []
  );

  const updateVendor = useCallback((id: string, updates: Partial<Vendor>) => {
    setVendors((prev) =>
      prev.map((v) =>
        v.id === id
          ? { ...v, ...updates, updatedAt: new Date().toISOString() }
          : v
      )
    );
  }, []);

  const archiveVendor = useCallback((id: string) => {
    setVendors((prev) =>
      prev.map((v) =>
        v.id === id
          ? { ...v, status: "archived" as const, updatedAt: new Date().toISOString() }
          : v
      )
    );
  }, []);

  const restoreVendor = useCallback((id: string) => {
    setVendors((prev) =>
      prev.map((v) =>
        v.id === id
          ? { ...v, status: "active" as const, updatedAt: new Date().toISOString() }
          : v
      )
    );
  }, []);

  const deleteVendor = useCallback((id: string) => {
    setVendors((prev) => prev.filter((v) => v.id !== id));
  }, []);

  const upsertImportedVendors = useCallback((rows: ImportRow[], ctx: PartnersApplyContext = {}): ImportUpsertResult => {
    const applyCtx: PartnersApplyContext = { ...ctx, now: ctx.now ?? new Date().toISOString() };
    const next = [...vendorsRef.current];
    let created = 0;
    let updated = 0;
    for (const row of rows) {
      const name = (row.partnerName ?? "").trim();
      if (!name) continue;
      const existing = findVendorByName(next, name);
      if (existing) {
        const patched = patchVendorFromImport(existing, row, applyCtx);
        next[next.findIndex((v) => v.id === existing.id)] = patched;
        updated++;
      } else {
        /* id first so the code carries the same number and the counter advances. */
        const id = generateVendorId();
        next.unshift(buildVendorFromImport(row, applyCtx, { id, code: `VND-${id.slice(2)}` }));
        created++;
      }
    }
    vendorsRef.current = next;
    setVendors(next);
    return { created, updated };
  }, []);

  return (
    <VendorContext.Provider
      value={{
        vendors,
        getVendor,
        addVendor,
        updateVendor,
        archiveVendor,
        restoreVendor,
        deleteVendor,
        upsertImportedVendors,
      }}
    >
      {children}
    </VendorContext.Provider>
  );
}

export function useVendors() {
  const context = useContext(VendorContext);
  if (!context) {
    throw new Error("useVendors must be used within a VendorProvider");
  }
  return context;
}
