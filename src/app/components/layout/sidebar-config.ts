import {
  Package,
  Handshake,
  Truck,
  BarChart3,
  ShoppingCart,
  Calculator,
  Users,
  Building2,
  ClipboardList,
  ClipboardEdit,
  FileText,
  Mail,
  LayoutDashboard,
  TrendingUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */

export interface NavChild {
  label: string;
  path: string;
  icon?: LucideIcon;
}

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  path: string;
  disabled?: boolean;
  children?: NavChild[];
}

/* ═══════════════════════════════════════════════════════════════
   MAIN NAVIGATION ITEMS
   ═══════════════════════════════════════════════════════════════ */

export const NAV_ITEMS: NavItem[] = [
  {
    id: "items-inventory",
    label: "Items & Inventory",
    icon: Package,
    path: "/items",
    disabled: false,
  },
  {
    id: "partners-management",
    label: "Partners Management",
    icon: Handshake,
    path: "/partners",
    disabled: true,
  },
  {
    id: "supply-chain",
    label: "Supply Chain Management",
    icon: Truck,
    path: "/supply-chain",
    disabled: false,
    children: [
      { label: "Purchase Orders", path: "/purchase-orders", icon: ClipboardList },
      /* Sibling tabs to Purchase Orders — each has its own
         dedicated route so buyers can bookmark or deep-link
         straight in. All three routes render the same
         PurchaseOrdersListing under the hood with the initial
         top tab preselected. */
      { label: "Procurement Planning", path: "/procurement-planning", icon: TrendingUp },
      { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
      /* Purchase Requests — requester-side surface for raising
         ad-hoc buy asks (technician → buyer). Distinct from
         Purchase Orders (which is the buyer's execution
         surface). Lives here because it's the same audience:
         everyone in Supply Chain. */
      { label: "Purchase Requests", path: "/purchase-requests", icon: ClipboardEdit },
      { label: "Receiving Docs", path: "/receiving-documents", icon: FileText },
      { label: "Emails", path: "/emails", icon: Mail },
    ],
  },
  {
    id: "production-planning",
    label: "Production & Planning",
    icon: BarChart3,
    path: "/production",
    disabled: true,
  },
  {
    id: "sales",
    label: "Sales",
    icon: ShoppingCart,
    path: "/sales",
    disabled: true,
  },
  {
    id: "accounting-finance",
    label: "Accounting & Finance",
    icon: Calculator,
    path: "/accounting",
    disabled: true,
  },
  {
    id: "people-management",
    label: "People Management",
    icon: Users,
    path: "/people",
    disabled: true,
  },
  {
    id: "company-setup",
    label: "Company Setup",
    icon: Building2,
    path: "/company-setup",
    disabled: true,
  },
];

