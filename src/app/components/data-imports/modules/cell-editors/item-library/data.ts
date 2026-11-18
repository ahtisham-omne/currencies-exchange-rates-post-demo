/* Display data for the Item Library cell editors, lifted from nimble-palette's
 * Create New Item flow so each picker reads exactly like the field it stands
 * in for. Option VALUES stay the import's file vocabulary (spec.data.mjs);
 * only the labels, descriptions, icons and colours come from the home module.
 *
 * Sources (nimble-palette, read only):
 *   CreateItemModal.tsx        STATUS descriptions + tones, MOCK_USERS (roles,
 *                              permissions), category card icons
 *   ItemDefinitionSection.tsx  inventory type, control type, lot tracking,
 *                              lot ID assignment, acquisition cards
 *   ProcurementSection.tsx     SHORTAGE_RULES (PO Recommendation Rules)
 *   SellingSection.tsx         selling scope radio copy
 *   GovernanceSection.tsx      valuation cards, OWNER_SLOTS permissions
 *   MaterialHandlingSection    MOCK_APPROVERS (initials, colours), scan rows
 *   purchasing/mockData.ts     VENDOR_PROFILE (avatar code, colour, address)
 */

import type { LucideIcon } from "lucide-react";
import {
  Box,
  CircleDot,
  Cog,
  Cpu,
  Factory,
  Layers,
  Package,
  Shield,
  ShoppingCart,
  Wind,
  Wrench,
  Zap,
} from "lucide-react";

/* ─── Status (Basic Information > Status) ─── */
export const STATUS_META: Record<string, { bg: string; text: string; border: string; description: string }> = {
  Active: {
    bg: "#ECFDF5",
    text: "#065F46",
    border: "#A7F3D0",
    description: "Item is currently in use, available for sale, or included in ongoing projects.",
  },
  Inactive: {
    bg: "#FFFBEB",
    text: "#92400E",
    border: "#FDE68A",
    description: "Item is no longer in use, discontinued, or temporarily taken out of circulation.",
  },
};

/* ─── Item Definition ─── */
export const INVENTORY_TYPES = ["Stock", "Non-stock", "Asset"] as const;

export const CONTROL_TYPES: { value: string; label: string; desc: string }[] = [
  { value: "Serialized", label: "Serialized", desc: "Unique ID per unit." },
  { value: "Non-Serialized", label: "Non-serialized", desc: "Tracked in bulk by quantity." },
];

export const LOT_ID_SOURCES: { value: string; label: string; desc: string }[] = [
  { value: "System Generated", label: "System Generated", desc: "Auto-generate IDs based on prefix." },
  { value: "Vendor Lot", label: "Use vendor lot as lot ID", desc: "Vendor lot number becomes Lot ID." },
];

export const SHELF_LIFE_UNITS = ["Days", "Months", "Years"] as const;

export interface AcquisitionMeta {
  value: string;
  label: string;
  desc: string;
  Icon: LucideIcon;
  accent: string;
  bgSelected: string;
  borderSelected: string;
  iconBgSelected: string;
}
export const ACQUISITION_METHODS: AcquisitionMeta[] = [
  {
    value: "Purchased",
    label: "Purchased",
    desc: "Sourced from a vendor, triggers a Purchase Order recommendation.",
    Icon: ShoppingCart,
    accent: "#0A77FF",
    bgSelected: "#EFF6FF",
    borderSelected: "#93C5FD",
    iconBgSelected: "#D6E8FF",
  },
  {
    value: "Manufactured",
    label: "Manufactured",
    desc: "Produced in-house, triggers a Work Order recommendation.",
    Icon: Wrench,
    accent: "#D97706",
    bgSelected: "#FFFBEB",
    borderSelected: "#FCD34D",
    iconBgSelected: "#FEF3C7",
  },
];

/* ─── Procurement > PO Recommendation Rules ─── */
export const SHORTAGE_RULES: { value: string; title: string; desc: string }[] = [
  { value: "Demand", title: "Recommend based on demand", desc: "Triggers when stock is reserved for demand, e.g. a scheduled Work Order." },
  { value: "Min", title: "Recommend when stock hits min. threshold", desc: "Triggers when available stock falls to or below the minimum threshold." },
  { value: "Zero", title: "Recommend if stock falls below zero", desc: "Triggers when available stock falls below zero. Stock sitting at zero is normal, so it will not trigger." },
  { value: "Off", title: "Disable Purchase Order Recommendations", desc: "No recommendations. Monitor shortages and replenish manually." },
];

/* ─── Selling > Selling Scope ─── */
export const SELLING_SCOPES: { value: string; label: string; desc: string }[] = [
  { value: "All", label: "Sell to all partners (customers)", desc: "This item is available to all partners with no exception." },
  {
    value: "Specific",
    label: "Sell to specific partners only",
    desc: "Restricts this item to a selected list of partners only. Useful for exclusive products or contract-based arrangements.",
  },
];

/* ─── Governance > Inventory Valuation ─── */
export const VALUATION_METHODS: { value: string; title: string; subtitle: string; desc: string }[] = [
  { value: "FIFO", title: "FIFO", subtitle: "First-In, First-Out", desc: "Oldest inventory sold first" },
  { value: "LIFO", title: "LIFO", subtitle: "Last-In, First-Out", desc: "Newest inventory sold first" },
  { value: "WAC", title: "WAC", subtitle: "Weighted Average Cost", desc: "Average cost of all units" },
  { value: "Specific", title: "Specific", subtitle: "Specific Identification", desc: "Track each unit individually" },
];

/* ─── Governance > Ownership & Responsibility ─── */
export interface ItemUser {
  name: string;
  role: string;
  initials: string;
  /** Tailwind-free tint pair taken from the home MOCK_USERS colour classes. */
  bg: string;
  text: string;
  permissions: string[];
}
export const ITEM_USERS: ItemUser[] = [
  { name: "Alice Smith", role: "Engineer", initials: "AS", bg: "#DBEAFE", text: "#1D4ED8", permissions: ["receiving", "shipping"] },
  { name: "Bob Jones", role: "Purchasing", initials: "BJ", bg: "#DCFCE7", text: "#15803D", permissions: ["purchasing"] },
  { name: "Charlie Day", role: "Scheduler", initials: "CD", bg: "#FEF3C7", text: "#B45309", permissions: ["receiving", "movement"] },
  { name: "Diana Prince", role: "Sales", initials: "DP", bg: "#F3E8FF", text: "#7E22CE", permissions: ["finance"] },
  { name: "Evan Peters", role: "Finance", initials: "EP", bg: "#FFE4E6", text: "#BE123C", permissions: ["shipping", "movement"] },
  { name: "Frank Reynolds", role: "Manager", initials: "FR", bg: "#F1F5F9", text: "#334155", permissions: ["gl", "finance"] },
  { name: "Grace Hopper", role: "QA", initials: "GH", bg: "#CFFAFE", text: "#0E7490", permissions: ["purchasing"] },
];

/** Owner slot -> the permissions that make a user "Suggested" (soft filter). */
export const OWNER_SLOT_PERMISSIONS: Record<string, string[]> = {
  "owners.materialHandling": ["receiving", "shipping", "movement"],
  "owners.purchasing": ["purchasing"],
  "owners.finance": ["finance", "gl"],
};

/* ─── Material Handling > Approver ─── */
export const APPROVER_META: Record<string, { initials: string; color: string }> = {
  "Ahtsham Ahmad": { initials: "AA", color: "#0A77FF" },
  "Faizan Khan": { initials: "FK", color: "#059669" },
  "Areeb Tanveer": { initials: "AT", color: "#7C3AED" },
  "Nophil Anwer": { initials: "NA", color: "#D97706" },
  "Irtaza Abid": { initials: "IA", color: "#DC2626" },
  "Eli Rosenbloom": { initials: "ER", color: "#059669" },
  "Sarah Chen": { initials: "SC", color: "#6366F1" },
  "James Wilson": { initials: "JW", color: "#0891B2" },
};

/* ─── Material Handling > Scan Enforcement ─── */
export const SCAN_ROWS: Record<string, { label: string; desc: string }> = {
  scanLocation: { label: "Location Scan", desc: "Require location barcode scan before proceeding" },
  scanItem: { label: "Item / Part Number Scan", desc: "Require item barcode scan for identification" },
  scanLot: { label: "Lot Control Scan", desc: "Require lot number barcode scan for lot-tracked items" },
  scanSerial: { label: "Serial Scan", desc: "Require serial number scan for serialized items" },
};

/* ─── Selling > Specific Partners (Select Customers modal avatars) ─── */
export const PARTNER_PROFILE: Record<string, { code: string; color: string; address: string }> = {
  "General Motors (GM)": { code: "GM", color: "#1E3A8A", address: "300 Renaissance Center, Detroit, Michigan 48243" },
  "Toyota Technical Center (TTC)": { code: "TT", color: "#B91C1C", address: "1555 Woodridge Ave., Ann Arbor, Michigan 48105" },
  "Ford Motor Company": { code: "Fd", color: "#0F172A", address: "1 American Road, Dearborn, Michigan 48126" },
  "Tesla, Inc.": { code: "T", color: "#111111", address: "1 Tesla Road, Austin, Texas 78725" },
  "Chrysler (Stellantis N.V.)": { code: "C", color: "#475569", address: "1000 Chrysler Drive, Auburn Hills, Michigan 48326" },
  "Rivian Automotive": { code: "R", color: "#64748B", address: "100 N Riverview Dr., Plymouth, Michigan 48170" },
  "Lucid Motors": { code: "L", color: "#1F2937", address: "7373 Gateway Blvd., Newark, California 94560" },
  "Honda Motor Co., Ltd. (USA)": { code: "H", color: "#B91C1C", address: "1919 Torrance Blvd., Torrance, California 90501" },
  "Nissan North America": { code: "N", color: "#0F172A", address: "1 Nissan Way, Franklin, Tennessee 37067" },
  "BMW of North America": { code: "BMW", color: "#1E40AF", address: "300 Chestnut Ridge Rd., Woodcliff Lake, New Jersey 07677" },
  "Hyundai Motor America": { code: "HY", color: "#0E7490", address: "10550 Talbert Ave., Fountain Valley, California 92708" },
  "Volkswagen Group of America": { code: "VW", color: "#1E3A8A", address: "2200 Ferdinand Porsche Dr., Herndon, Virginia 20171" },
};

/* ─── Category Selection cards ─── */
export const CATEGORY_ICONS: LucideIcon[] = [Cpu, Wrench, Cog, Zap, Wind, Shield, Factory, Package, Layers, Box, CircleDot];
