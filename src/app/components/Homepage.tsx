import React from "react";
import { useNavigate } from "react-router-dom";
import {
  ClipboardEdit,
  ClipboardList,
  FileText,
  Mail,
  Plus,
  PackageCheck,
  Send,
  TrendingUp,
} from "lucide-react";
import { BaseModulePage } from "./BaseModulePage";
import type {
  ModuleCardItem,
  QuickActionItem,
  ActivityItem,
} from "./layout/ModuleHomePage";

/* ────────────────────────────────────────────────────────────
   DATA — Module cards, quick actions, activity feed
   ──────────────────────────────────────────────────────────── */

const modules: ModuleCardItem[] = [
  {
    id: "purchase-orders",
    icon: ClipboardList,
    title: "Purchase Orders",
    description: "Create, track, and manage all vendor purchase orders.",
    iconBg: "hsl(var(--primary-tint))",
    iconColor: "hsl(var(--primary))",
    path: "/purchase-orders",
    badge: "8 pending",
  },
  {
    id: "procurement-planning",
    icon: TrendingUp,
    title: "Procurement Planning",
    description: "Spot upcoming shortages and plan supply against demand.",
    iconBg: "hsl(var(--accent))",
    iconColor: "hsl(var(--primary))",
    path: "/procurement-planning",
    badge: "5 signals",
  },
  {
    id: "purchase-requests",
    icon: ClipboardEdit,
    title: "Purchase Requests",
    description:
      "Track requests raised across Items, Sales Orders, and Physical Inventory.",
    iconBg: "hsl(var(--accent))",
    iconColor: "hsl(var(--primary))",
    path: "/purchase-requests",
    badge: "3 open",
  },
  {
    id: "receiving-documents",
    icon: FileText,
    title: "Receiving Documents",
    description: "Log and verify inbound goods against purchase orders.",
    iconBg: "hsl(var(--success-tint))",
    iconColor: "hsl(var(--success))",
    path: "/receiving-documents",
    badge: "3 new",
  },
  {
    id: "emails",
    icon: Mail,
    title: "Emails",
    description: "View and manage procurement-related email correspondence.",
    iconBg: "hsl(var(--warning-tint))",
    iconColor: "hsl(var(--warning))",
    path: "/emails",
    badge: "12 unread",
  },
];

const quickActions: QuickActionItem[] = [
  {
    id: "create-po",
    icon: Plus,
    title: "Create Purchase Order",
    description: "Draft a new PO for a vendor.",
    iconColor: "hsl(var(--primary))",
    iconBg: "hsl(var(--primary-tint))",
  },
  {
    id: "verify-delivery",
    icon: PackageCheck,
    title: "Verify Delivery",
    description: "Match received goods to PO #8820.",
    iconColor: "hsl(var(--success))",
    iconBg: "hsl(var(--success-tint))",
  },
  {
    id: "reply-vendor",
    icon: Send,
    title: "Reply to Vendor",
    description: "Respond to TechParts inquiry.",
    iconColor: "hsl(var(--warning))",
    iconBg: "hsl(var(--warning-tint))",
  },
];

const recentActivity: ActivityItem[] = [
  { id: "a1", label: "PO #8821 submitted", time: "2h ago", dotColor: "hsl(var(--primary))" },
  { id: "a2", label: "Receiving Doc #3042 verified", time: "4h ago", dotColor: "hsl(var(--success))" },
  { id: "a3", label: "Email from VendorCo received", time: "1d ago", dotColor: "hsl(var(--warning))" },
  { id: "a4", label: "PO #8819 approved", time: "1d ago", dotColor: "hsl(var(--primary))" },
  { id: "a5", label: "Receiving Doc #3039 flagged", time: "2d ago", dotColor: "hsl(var(--danger))" },
];

/* ────────────────────────────────────────────────────────────
   HOMEPAGE — Items & Inventory module home
   Uses BaseModulePage driven by module-registry.
   ──────────────────────────────────────────────────────────── */

export default function Homepage() {
  const navigate = useNavigate();

  const actionsWithHandlers: QuickActionItem[] = quickActions.map((a) => {
    if (a.id === "create-po") {
      return {
        ...a,
        onClick: () =>
          navigate("/purchase-orders", { state: { openSearchModal: true } }),
      };
    }
    return a;
  });

  return (
    <BaseModulePage
      moduleId="items-inventory"
      cards={modules}
      actions={actionsWithHandlers}
      activity={recentActivity}
      learnMoreUrl="#"
      gridCols={3}
      draggable
      onViewMoreActivity={() => {}}
    />
  );
}