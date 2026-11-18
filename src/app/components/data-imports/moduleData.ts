import type { ElementType } from "react";
import { isNewTenant } from "../../data/tenant";
import {
  ArrowLeftRight,
  BadgeCheck,
  BarChart3,
  Bell,
  Boxes,
  Building2,
  ClipboardList,
  Contact,
  CreditCard,
  FileInput,
  FileText,
  FolderTree,
  Handshake,
  Lock,
  Map,
  MapPin,
  Network,
  Package,
  Receipt,
  RefreshCw,
  Ruler,
  ShoppingCart,
  SlidersHorizontal,
  Truck,
  Users,
  UsersRound,
  Warehouse,
} from "lucide-react";

export type LastImportStatus = "completed" | "inProgress" | "failed";

/** An import surface that lives inside a parent card as a tab rather than
 *  getting its own card on the listing. User Access Control houses Users and
 *  Roles this way: one card, two tabs, one import history per tab. */
export interface DataImportModuleTab {
  /** Route slug the tab's import history and record payloads are keyed by. */
  slug: string;
  label: string;
  /** Header primary-button label while this tab is active. */
  importLabel: string;
}

export interface DataImportModuleCard {
  id: string;
  /** Header primary-button label. Falls back to "Import data" when absent;
   *  a tabbed card takes its label from the active tab instead. */
  importLabel?: string;
  /** Position among the available modules, lowest first. Cards without one
   *  keep their category order behind those that have one. Used to lead with
   *  User Access Control, then Quotes, then Sales Orders, then the Items &
   *  Inventory and Partners modules. */
  order?: number;
  slug: string;
  title: string;
  description: string;
  icon: ElementType;
  hasTemplates?: boolean;
  /** Present when the module's imports are split across tabs. The card links
   *  to the parent slug; the detail page renders these as its tab bar. */
  tabs?: DataImportModuleTab[];
  importsCount: number;
  /** Status of the most recent import. `null` when there are no imports yet. */
  lastImportStatus: LastImportStatus | null;
  /** Pre-formatted relative timestamp, e.g. "2d ago". Empty when there are no imports yet. */
  lastImportRelative: string;
}

export const categoryNav = [
  { id: "items-inventory", label: "Items & Inventory" },
  { id: "partners", label: "Partners Management" },
  { id: "supply-chain", label: "Supply Chain Management" },
  { id: "sales", label: "Sales" },
  { id: "people", label: "People" },
  { id: "company-setup", label: "Company Setup" },
];

/** Icon + label used by the empty state when a search clears out every card in
 *  the selected category, so the empty panel still reads as that category. */
export const emptySectionMeta: Record<string, { icon: ElementType; label: string }> = {
  "items-inventory": { icon: Boxes, label: "Items & Inventory" },
  partners: { icon: Handshake, label: "Partners Management" },
  "supply-chain": { icon: Package, label: "Supply Chain Management" },
  sales: { icon: Receipt, label: "Sales" },
  people: { icon: UsersRound, label: "People" },
  "company-setup": { icon: Building2, label: "Company Setup" },
};

export const moduleCards: Record<string, DataImportModuleCard[]> = {
  "items-inventory": [
    { id: "ii__item-library", slug: "item-library", title: "Item Library", importLabel: "Import items", order: 4, description: "Configure import templates for item creation, updates, and catalog data.", icon: Boxes, hasTemplates: true, importsCount: 3, lastImportStatus: "failed", lastImportRelative: "1mo ago" },
    { id: "ii__categories", slug: "categories", title: "Categories", importLabel: "Import categories", order: 5, description: "Set up category import rules and hierarchy mapping.", icon: FolderTree, hasTemplates: true, importsCount: 3, lastImportStatus: "failed", lastImportRelative: "1mo ago" },
  ],
  partners: [
    { id: "p__partners", slug: "partners", title: "Partners", importLabel: "Import partners", order: 6, description: "Set up partner import templates for onboarding and profile data.", icon: Handshake, hasTemplates: true, importsCount: 3, lastImportStatus: "failed", lastImportRelative: "1mo ago" },
    { id: "p__partner-group", slug: "partner-groups", title: "Partner Group", importLabel: "Import partner groups", order: 7, description: "Configure group import rules, hierarchy, and shared commercial terms.", icon: Network, hasTemplates: true, importsCount: 3, lastImportStatus: "failed", lastImportRelative: "1mo ago" },
    { id: "p__contact-directory", slug: "contact-directory", title: "Contact Directory", description: "Bulk load partner contacts, roles, and communication preferences.", icon: Contact, hasTemplates: false, importsCount: 7, lastImportStatus: "completed", lastImportRelative: "1d ago" },
    { id: "p__credit-management", slug: "credit-management", title: "Credit Management", description: "Import credit limits, payment terms, and risk classifications.", icon: CreditCard, hasTemplates: false, importsCount: 2, lastImportStatus: "failed", lastImportRelative: "4d ago" },
    { id: "p__carrier-management", slug: "carrier-management", title: "Carrier Management", description: "Set up carrier records, service levels, and freight account details.", icon: Truck, hasTemplates: false, importsCount: 3, lastImportStatus: "completed", lastImportRelative: "1w ago" },
    { id: "p__partner-locations", slug: "partner-locations", title: "Partner Locations", description: "Import ship-to, bill-to, and remit-to addresses in bulk.", icon: MapPin, hasTemplates: false, importsCount: 5, lastImportStatus: "completed", lastImportRelative: "2d ago" },
    { id: "p__qualified-vendors", slug: "qualified-vendors", title: "Qualified Vendors", description: "Configure vendor qualification records, item links, and lead times.", icon: BadgeCheck, hasTemplates: false, importsCount: 6, lastImportStatus: "completed", lastImportRelative: "3d ago" },
    { id: "p__reports", slug: "partner-reports", title: "Reports & Analytics", description: "Import saved report definitions, scorecards, and analytics baselines.", icon: BarChart3, hasTemplates: false, importsCount: 0, lastImportStatus: null, lastImportRelative: "" },
  ],
  "supply-chain": [
    { id: "sc__cycle-count", slug: "cycle-count", title: "Cycle Count", description: "Set up import templates for count schedules, tasks, and counted quantities.", icon: RefreshCw, hasTemplates: false, importsCount: 8, lastImportStatus: "completed", lastImportRelative: "12h ago" },
    { id: "sc__inventory-movement", slug: "inventory-movement", title: "Inventory Movement", description: "Configure import templates for movement and transfer records.", icon: ArrowLeftRight, hasTemplates: false, importsCount: 4, lastImportStatus: "completed", lastImportRelative: "1w ago" },
    {
      id: "sc__physical-inventory",
      slug: "physical-inventory",
      title: "Physical Inventory",
      importLabel: "Import stock",
      order: 8,
      description: "Import opening balances, stock snapshots, and serial or lot detail.",
      icon: ClipboardList,
      hasTemplates: true,
      /* One tab per control type, each Physical Inventory's own Adjust
       * Inventory import for that type (modules/physical-inventory/). */
      tabs: [
        { slug: "physical-inventory-serialized", label: "Serialized", importLabel: "Import serial units" },
        { slug: "physical-inventory-non-serialized", label: "Non-Serialized", importLabel: "Import stock lines" },
        { slug: "physical-inventory-lot-serialized", label: "LOT Serialized", importLabel: "Import LOT serial units" },
        { slug: "physical-inventory-lot", label: "LOT", importLabel: "Import LOT units" },
      ],
      importsCount: 12,
      lastImportStatus: "failed",
      lastImportRelative: "1mo ago",
    },
    { id: "sc__shipment", slug: "shipment", title: "Shipment", description: "Configure import templates for shipment and delivery records.", icon: Package, hasTemplates: false, importsCount: 1, lastImportStatus: "completed", lastImportRelative: "1w ago" },
    { id: "sc__purchase-orders", slug: "purchase-orders", title: "Purchase Orders", description: "Set up PO import templates and approval workflows.", icon: ShoppingCart, hasTemplates: false, importsCount: 9, lastImportStatus: "completed", lastImportRelative: "6h ago" },
  ],
  sales: [
    { id: "s__quotes", slug: "quotes", title: "Quotes", importLabel: "Import quotes", order: 2, description: "Bulk load quotes with their line items, pricing rules, discounts, dates and points of contact.", icon: FileText, hasTemplates: true, importsCount: 3, lastImportStatus: "failed", lastImportRelative: "1mo ago" },
    { id: "s__sales-order", slug: "sales-orders", title: "Sales Orders", importLabel: "Import sales orders", order: 3, description: "Bulk load sales orders with their line items, pricing rules, discounts, ship dates and points of contact.", icon: Receipt, hasTemplates: true, importsCount: 3, lastImportStatus: "failed", lastImportRelative: "1mo ago" },
  ],
  /* No import surfaces yet — the chip stays on the filter row at zero and the
   * grid falls back to the coming-soon empty state. */
  people: [],
  "company-setup": [
    {
      id: "cs__user-access-control",
      slug: "user-access-control",
      title: "User Access Control",
      order: 1,
      description: "Add or update users and roles in bulk, set their licenses, and assign owners and access.",
      icon: Users,
      hasTemplates: true,
      tabs: [
        { slug: "users", label: "Users", importLabel: "Import users" },
        { slug: "roles", label: "Roles", importLabel: "Import roles" },
      ],
      importsCount: 6,
      lastImportStatus: "failed",
      lastImportRelative: "1mo ago",
    },
    { id: "cs__warehouse-management", slug: "warehouse-management", title: "Warehouse Management", description: "Import warehouse records, zones, and storage configuration.", icon: Warehouse, hasTemplates: false, importsCount: 4, lastImportStatus: "completed", lastImportRelative: "3d ago" },
    { id: "cs__location-management", slug: "location-management", title: "Location Management", description: "Bulk load bins, racks, and the location hierarchy beneath each warehouse.", icon: Map, hasTemplates: false, importsCount: 6, lastImportStatus: "completed", lastImportRelative: "2d ago" },
    { id: "cs__module-defaults", slug: "module-defaults", title: "Module Defaults", description: "Import company-wide default behaviours and numbering rules per module.", icon: SlidersHorizontal, hasTemplates: false, importsCount: 1, lastImportStatus: "completed", lastImportRelative: "1w ago" },
    { id: "cs__alerts-settings", slug: "alerts-settings", title: "Alerts Settings", description: "Import alert thresholds, escalation rules, and delivery channels.", icon: Bell, hasTemplates: false, importsCount: 2, lastImportStatus: "inProgress", lastImportRelative: "5h ago" },
    { id: "cs__security-settings", slug: "security-settings", title: "Security Settings (MFA)", description: "Import MFA enforcement scopes, exemptions, and session policy overrides.", icon: Lock, hasTemplates: false, importsCount: 0, lastImportStatus: null, lastImportRelative: "" },
    { id: "cs__data-imports-exports", slug: "data-imports-exports", title: "Data Imports and Exports", description: "Import saved template mappings and export presets used across modules.", icon: FileInput, hasTemplates: false, importsCount: 0, lastImportStatus: null, lastImportRelative: "" },
    { id: "cs__general-settings", slug: "general-settings", title: "General Settings", description: "Import company profile, legal entity, and tenant-wide format defaults.", icon: Building2, hasTemplates: false, importsCount: 1, lastImportStatus: "failed", lastImportRelative: "6d ago" },
    { id: "cs__units-of-measure", slug: "units-of-measure", title: "Units of Measure", description: "Bulk load measurement units, precision rules, and conversion factors.", icon: Ruler, hasTemplates: false, importsCount: 3, lastImportStatus: "completed", lastImportRelative: "4d ago" },
  ],
};

/** Every card, flattened, with the category it belongs to. The import counts
 *  and last-import stamps above are the sample company's; a company from
 *  onboarding has imported nothing, so each card reads "No Imports Yet". */
export function getAllModuleCards(): Array<DataImportModuleCard & { _category: string }> {
  const fresh = isNewTenant();
  return Object.entries(moduleCards).flatMap(([catId, cards]) =>
    cards.map((card) => ({
      ...card,
      ...(fresh ? { importsCount: 0, lastImportStatus: null, lastImportRelative: "" } : {}),
      _category: catId,
    })),
  );
}

/** Resolve a route slug to the card that owns it. A tab slug (e.g. `users`)
 *  resolves to its parent card plus the tab, so deep links straight into a
 *  tab's import history and record pages keep working. */
export function resolveImportSurface(
  slug: string,
): { card: DataImportModuleCard; tab?: DataImportModuleTab } | undefined {
  for (const list of Object.values(moduleCards)) {
    for (const card of list) {
      if (card.slug === slug) return { card };
      const tab = card.tabs?.find((t) => t.slug === slug);
      if (tab) return { card, tab };
    }
  }
  return undefined;
}

/** The module definition for a slug. Tab slugs return the parent card carrying
 *  the tab's own title, so history names and record-page headers read as
 *  "Users" / "Roles" rather than the parent's name. */
export function getModuleBySlug(slug: string): DataImportModuleCard | undefined {
  const resolved = resolveImportSurface(slug);
  if (!resolved) return undefined;
  const { card, tab } = resolved;
  return tab ? { ...card, slug: tab.slug, title: tab.label } : card;
}
