import type { ComponentType } from "react";
import {
  Boxes,
  Handshake,
  Truck,
  Factory,
  ShoppingCart,
  Calculator,
  UsersRound,
  Building,
} from "lucide-react";

export interface NavChild {
  label: string;
  path: string;
  /** When set, clicking the nav item opens this URL in a new tab instead of navigating in-app. */
  externalUrl?: string;
}

export interface NavItem {
  label: string;
  icon: ComponentType<{ className?: string }>;
  path: string;
  disabled?: boolean;
  children?: NavChild[];
  /** When set, clicking the parent nav item opens this URL in a new tab instead of navigating in-app. */
  externalUrl?: string;
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Items & Inventory",
    icon: Boxes,
    path: "/items-inventory",
    disabled: true,
    children: [
      { label: "Overview", path: "/items-inventory" },
      { label: "Items Library", path: "/items-inventory/items-library" },
      { label: "Categories", path: "/items-inventory/categories" },
      { label: "Physical Inventory", path: "/items-inventory/physical-inventory" },
      { label: "Inventory Movement", path: "/items-inventory/inventory-movement" },
      { label: "Items Maintenance", path: "/items-inventory/items-maintenance" },
      { label: "Lot Management", path: "/items-inventory/lot-management" },
      { label: "Location Management", path: "/items-inventory/location-management" },
      { label: "Warehouse Management", path: "/items-inventory/warehouse-management" },
    ],
  },
  {
    label: "Partners Management",
    icon: Handshake,
    path: "/partners",
    disabled: true,
    children: [
      { label: "Overview", path: "/partners" },
      { label: "Partners", path: "/vendors" },
      { label: "Partners Groups", path: "/partners/groups" },
      { label: "Reports", path: "/partners/reports" },
    ],
  },
  {
    label: "Supply Chain Management",
    icon: Truck,
    path: "/supply-chain",
    disabled: true,
    children: [
      { label: "Overview", path: "/supply-chain" },
      { label: "Shipment", path: "/supply-chain/shipment" },
      { label: "Quotes & Proposals", path: "/supply-chain/quotes" },
      { label: "Sales Orders", path: "/supply-chain/orders" },
      { label: "Purchase Orders", path: "/supply-chain/purchase-orders" },
      { label: "Receiving Documents", path: "/supply-chain/receiving-documents" },
    ],
  },
  {
    label: "Production & Planning",
    icon: Factory,
    path: "/production",
    disabled: true,
    children: [{ label: "Overview", path: "/production" }],
  },
  {
    label: "Sales",
    icon: ShoppingCart,
    path: "/sales",
    disabled: true,
    children: [{ label: "Overview", path: "/sales" }],
  },
  {
    label: "Accounting & Finance",
    icon: Calculator,
    path: "/accounting",
    disabled: true,
    children: [{ label: "Overview", path: "/accounting" }],
  },
  {
    label: "People Management",
    icon: UsersRound,
    path: "/people",
    disabled: true,
    externalUrl: "https://alert-settings-omne.lovable.app/people",
    children: [
      { label: "Overview", path: "/people" },
      { label: "Users", path: "/people/users" },
      { label: "Invite Request", path: "/people/invite-request" },
    ],
  },
  {
    label: "Company Setup",
    icon: Building,
    path: "/company-settings",
    children: [
      { label: "Overview", path: "/company-settings" },
      { label: "General Settings", path: "/company-settings/general" },
      { label: "Alert Settings", path: "/company-settings/alerts", externalUrl: "https://alert-settings-omne.lovable.app/company-settings/alerts" },
      { label: "Module Defaults", path: "/company-settings/module-defaults", externalUrl: "https://module-defaults.lovable.app/company-settings/modules" },
      { label: "Security Settings", path: "/company-settings/security", externalUrl: "https://fusion-zen.lovable.app/company-settings/security" },
      { label: "User Access Control", path: "/company-settings/user-access-control" },
      { label: "Units of Measure", path: "/company-settings/units-of-measure" },
    ],
  },
];

/** Root paths that need NavLink `end` matching to avoid false active state. */
export const EXACT_MATCH_PATHS = new Set([
  "/vendors",
  "/partners",
  "/items-inventory",
  "/supply-chain",
  "/company-settings",
  "/accounting",
  "/sales",
  "/people",
  "/production",
]);
