import React, { createContext, useContext, useState, useCallback } from "react";
import {
  Vendor,
  mockVendors,
  generateVendorId,
  generateVendorCode,
} from "../data/vendors";

interface VendorContextType {
  vendors: Vendor[];
  getVendor: (id: string) => Vendor | undefined;
  addVendor: (vendor: Omit<Vendor, "id" | "code" | "createdAt" | "updatedAt" | "totalOrders" | "totalSpent" | "outstandingBalance" | "rating">) => Vendor;
  updateVendor: (id: string, updates: Partial<Vendor>) => void;
  archiveVendor: (id: string) => void;
  restoreVendor: (id: string) => void;
  deleteVendor: (id: string) => void;
}

const VendorContext = createContext<VendorContextType | undefined>(undefined);

export function VendorProvider({ children }: { children: React.ReactNode }) {
  const [vendors, setVendors] = useState<Vendor[]>(mockVendors);

  const getVendor = useCallback(
    (id: string) => vendors.find((v) => v.id === id),
    [vendors]
  );

  const addVendor = useCallback(
    (
      vendorData: Omit<Vendor, "id" | "code" | "createdAt" | "updatedAt" | "totalOrders" | "totalSpent" | "outstandingBalance" | "rating">
    ): Vendor => {
      const now = new Date().toISOString();
      const newVendor: Vendor = {
        ...vendorData,
        id: generateVendorId(),
        code: generateVendorCode(),
        totalOrders: 0,
        totalSpent: 0,
        outstandingBalance: 0,
        rating: 0,
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
