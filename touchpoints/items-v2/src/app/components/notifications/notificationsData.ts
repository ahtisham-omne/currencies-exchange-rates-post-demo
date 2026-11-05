/* Ported from the Calendars app (calendar-omne: src/app/components/notificationsData.ts). */
export interface NotificationTriggeredBy {
  name: string;
  initials: string;
  isSystem: boolean;
}

export interface AppNotification {
  id: string;
  title: string;
  contextLine: string;
  module: string;
  triggeredBy: NotificationTriggeredBy;
  timestamp: Date;
  isRead: boolean;
  isActionRequired: boolean;
  isMandatory: boolean;
  isSystem: boolean;
  /** Route opened on click; omitted when the screen isn't in this app yet. */
  navigationTarget?: string;
}

/* ── Module badge colors ── */
const defaultBadge = { bg: "#F1F5F9", text: "#475569" };
const unreadBadge = { bg: "#F1F5F9", text: "#475569" };

export function getModuleBadgeColor(_module: string, isUnread: boolean = false) {
  return isUnread ? unreadBadge : defaultBadge;
}

/* ── Relative time helper ── */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/* ── Mock notifications: realistic Tuesday afternoon inbox ── */
const now = Date.now();
const MIN = 60000;
const HR = 3600000;
const DAY = 86400000;

export const mockNotifications: AppNotification[] = [
  {
    id: "n1",
    title: "Cycle Count Plan Discrepancy: Approval Required",
    contextLine: "Plan #CC-0847 submitted by Sarah Mitchell. 3 line items show variance exceeding 5% threshold",
    module: "Cycle Count",
    triggeredBy: { name: "Sarah Mitchell", initials: "SM", isSystem: false },
    timestamp: new Date(now - 8 * MIN),
    isRead: false,
    isActionRequired: true,
    isMandatory: false,
    isSystem: false,
  },
  {
    id: "n2",
    title: "Damaged Items Received",
    contextLine: "PO #6219 from GlobalTech Supply. 12 units of SKU-3380 flagged with photo evidence",
    module: "Purchase Orders",
    triggeredBy: { name: "Bishrant Ghimire", initials: "BG", isSystem: false },
    timestamp: new Date(now - 34 * MIN),
    isRead: false,
    isActionRequired: true,
    isMandatory: false,
    isSystem: false,
  },
  {
    id: "n3",
    title: "Lot Expiry Warning",
    contextLine: "Lot #BX-9920 expires in 14 days. 340 units of 'Nitrile Seals' in Warehouse B, Zone 2",
    module: "Lot Control",
    triggeredBy: { name: "System", initials: "", isSystem: true },
    timestamp: new Date(now - 2 * HR),
    isRead: true,
    isActionRequired: true,
    isMandatory: false,
    isSystem: false,
  },
  {
    id: "n4",
    title: "Pick Task Assignment",
    contextLine: "Pick task PT-2291 assigned to you. Warehouse A, Zone 3, 8 line items",
    module: "Shipping",
    triggeredBy: { name: "Taylor Dimas", initials: "TD", isSystem: false },
    timestamp: new Date(now - 3 * HR),
    isRead: true,
    isActionRequired: true,
    isMandatory: false,
    isSystem: false,
  },
  {
    id: "n5",
    title: "Part Number Updated",
    contextLine: "SKU-7210 'Hydraulic Coupling Assembly'. Part number changed from PN-441 to PN-441-R2",
    module: "Item",
    triggeredBy: { name: "Areeb Khan", initials: "AK", isSystem: false },
    timestamp: new Date(now - 5 * HR),
    isRead: true,
    isActionRequired: false,
    isMandatory: false,
    isSystem: false,
    navigationTarget: "/items",
  },
  {
    id: "n6",
    title: "Over Receipt Detected",
    contextLine: "PO #6140. Line 3: received 127 units vs 100 ordered for SKU-5501 'Bearing Kit'",
    module: "Receiving App",
    triggeredBy: { name: "System", initials: "", isSystem: true },
    timestamp: new Date(now - 1 * DAY - 4.5 * HR),
    isRead: true,
    isActionRequired: true,
    isMandatory: false,
    isSystem: false,
  },
  {
    id: "n7",
    title: "Profile Updated by Admin",
    contextLine: "Your notification email was updated to a.malik@omnesoft.com by system admin",
    module: "System",
    triggeredBy: { name: "System", initials: "", isSystem: true },
    timestamp: new Date(now - 1 * DAY - 9 * HR),
    isRead: true,
    isActionRequired: false,
    isMandatory: true,
    isSystem: true,
  },
  {
    id: "n8",
    title: "Vendor Removed from QVL",
    contextLine: "Vendor 'Pacific Components Ltd' removed from Qualified Vendor List for SKU-2290",
    module: "Item",
    triggeredBy: { name: "Fatima Rida", initials: "FR", isSystem: false },
    timestamp: new Date(now - 1 * DAY - 11 * HR),
    isRead: true,
    isActionRequired: false,
    isMandatory: false,
    isSystem: false,
    navigationTarget: "/items",
  },
  {
    id: "n9",
    title: "Cycle Count Plan Cancelled",
    contextLine: "Plan #CC-0831 for Warehouse C cancelled. Reassigned to Q2 schedule",
    module: "Cycle Count",
    triggeredBy: { name: "Ahtisham Ahmad", initials: "AA", isSystem: false },
    timestamp: new Date(now - 2 * DAY),
    isRead: true,
    isActionRequired: false,
    isMandatory: false,
    isSystem: false,
  },
  {
    id: "n10",
    title: "Sales Order Cancelled",
    contextLine: "SO #8834 for TechnoVault Ltd cancelled from order management",
    module: "Sales Order",
    triggeredBy: { name: "Taylor Dimas", initials: "TD", isSystem: false },
    timestamp: new Date(now - 3 * DAY),
    isRead: true,
    isActionRequired: false,
    isMandatory: false,
    isSystem: false,
  },
];
