import {
  Package,
  ClipboardList,
  FileText,
  Mail,
  Users,
  type LucideIcon,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════
   MODULE REGISTRY — Single source of truth for all ERP modules.
   To add a new module, add an entry here and create a thin
   page component that passes data to <BaseModulePage>.
   ═══════════════════════════════════════════════════════════════ */

export interface ModuleConfig {
  /** Unique key used for storageKey, routing, etc. */
  id: string;
  /** Display title in TopBar and page header */
  title: string;
  /** Short description shown below the title */
  subtitle: string;
  /** Module icon (from lucide-react) */
  icon: LucideIcon;
  /** Theme color hex — used for icon badges, tints, etc. */
  themeColor: string;
  /** Light tint background for icon badges */
  themeColorBg: string;
  /** Base route path */
  path: string;
}

export const MODULE_REGISTRY: Record<string, ModuleConfig> = {
  "items-inventory": {
    id: "items-inventory",
    title: "Supply Chain Management",
    subtitle:
      "Set up and manage procurement, inventory, and fulfillment in one place",
    icon: Package,
    themeColor: "hsl(var(--primary))",
    themeColorBg: "hsl(var(--primary-tint))",
    path: "/",
  },
  partners: {
    id: "partners",
    title: "Partners Management",
    subtitle: "Manage your vendors, customers, and partner operations.",
    icon: Users,
    themeColor: "hsl(var(--primary))",
    themeColorBg: "hsl(var(--primary-tint))",
    path: "/partners",
  },
  "purchase-orders": {
    id: "purchase-orders",
    title: "Purchase Orders",
    subtitle: "Create, track, and manage all vendor purchase orders.",
    icon: ClipboardList,
    themeColor: "hsl(var(--primary))",
    themeColorBg: "hsl(var(--primary-tint))",
    path: "/purchase-orders",
  },
  "receiving-documents": {
    id: "receiving-documents",
    title: "Receiving Documents",
    subtitle: "Log and verify inbound goods against purchase orders.",
    icon: FileText,
    themeColor: "hsl(var(--success))",
    themeColorBg: "hsl(var(--success-tint))",
    path: "/receiving-documents",
  },
  emails: {
    id: "emails",
    title: "Emails",
    subtitle:
      "View and manage procurement-related email correspondence.",
    icon: Mail,
    themeColor: "hsl(var(--warning))",
    themeColorBg: "hsl(var(--warning-tint))",
    path: "/emails",
  },
};