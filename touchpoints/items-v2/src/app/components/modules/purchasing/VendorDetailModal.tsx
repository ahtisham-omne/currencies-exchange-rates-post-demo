/**
 * VendorDetailModal — Partner Detail center modal ported from the
 * Qualified Vendors reference project's `vendor-detail-drawer.tsx`.
 */
import { useEffect, useMemo, useState } from "react";
import {
  X,
  Plus,
  Edit,
  Pencil,
  Trash2,
  Mail,
  Phone,
  Smartphone,
  Globe,
  FileText,
  Activity,
  Users,
  ShoppingCart,
  CreditCard,
  ArrowUpRight,
  Tag as TagIcon,
  Search,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Info,
  Landmark,
  TrendingDown,
  ChevronsLeft,
  ChevronsRight,
  Filter,
  List,
  LayoutGrid,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlignJustify,
  Building2,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";
import fedexLogo from "@/assets/fedex-logo.png";
import { usePurchasing } from "../../../context/PurchasingContext";
import type {
  PurchaseOrder,
  POStatus,
  QualifiedVendor,
  VendorContact,
} from "../../../context/purchasing/types";
import { PO_STATUS_CONFIG } from "../../../context/purchasing/types";
import { PRICING_RULES, PricingRulesPicker, RuleCard } from "./pricingRules";
import { InitialAvatar, getAvatarTint, getInitials as getInitialsAtom } from "../../items-v3/InitialAvatar";

export interface VendorDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendor: QualifiedVendor | null;
  itemId: string;
}

type TabKey = "details" | "analytics" | "contacts" | "orders" | "payment";
type ContactDepartment = "Sales" | "Procurement" | "Finance";
type ChartViewMode = "price" | "quantity";

type ChartPoint = {
  date: string;
  fullDate: string;
  dayIdx: number;
  lastPO: number | null;
  avgPO: number | null;
  lastQty: number | null;
  avgQty: number | null;
  poNumber?: string;
  poStatus?: POStatus;
  orderedItems?: string;
  orderedItemsMore?: number;
  pointOfContact?: string;
  location?: string;
  dueDate?: string;
};

const TABS: { key: TabKey; label: string; icon: typeof FileText }[] = [
  { key: "details", label: "Details & Pricing", icon: FileText },
  { key: "analytics", label: "Analytics", icon: Activity },
  { key: "contacts", label: "Point of Contacts", icon: Users },
  { key: "orders", label: "Purchase Orders", icon: ShoppingCart },
  { key: "payment", label: "Payment & Shipping", icon: CreditCard },
];

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const PRICE_SEEDS = [700, 560, 650, 480, 260, 630, 720, 680, 480, 740, 610, 520, 690, 580, 450, 710, 630, 550, 670, 590, 500];
const QTY_SEEDS = [150, 120, 135, 90, 55, 130, 160, 145, 100, 170, 125, 110, 155, 115, 85, 165, 130, 105, 140, 120, 95];
const TODAY_IDX = 10;
const WINDOW_SIZE = 7;

function formatPriorityLabel(priority: number): string {
  if (priority === 1) return "1st Priority";
  if (priority === 2) return "2nd Priority";
  if (priority === 3) return "3rd Priority";
  return `${priority}th Priority`;
}

/**
 * Static priority badge classes — every vendor must render with the same
 * treatment based on numeric priority (no dependency on optional vendor data).
 * Priority 1 → emerald, 2-3 → blue, 4+ → slate.
 */
function priorityBadgeClasses(priority: number): string {
  if (priority === 1) {
    return "border-emerald-600 bg-emerald-50 text-emerald-700";
  }
  if (priority <= 3) {
    return "border-blue-500 bg-blue-50 text-blue-700";
  }
  return "border-slate-300 bg-slate-50 text-slate-600";
}

/**
 * Saturated avatar palette — every vendor avatar uses a deep brand-style
 * background with white initials. Color is deterministic per vendor name
 * so the same vendor always renders identically across the app.
 */
const SATURATED_AVATAR_PALETTE = [
  "#1E3A8A", // navy
  "#B91C1C", // crimson
  "#047857", // emerald
  "#7C3AED", // violet
  "#B45309", // amber
  "#0E7490", // teal
  "#0F172A", // slate
  "#BE185D", // pink
] as const;

function getSaturatedAvatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = ((h << 5) - h) + name.charCodeAt(i);
    h |= 0;
  }
  return SATURATED_AVATAR_PALETTE[Math.abs(h) % SATURATED_AVATAR_PALETTE.length];
}

function getInitials(name: string): string {
  return name
    .split(/[\s()]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function getCreditTone(pct: number): { bar: string; text: string } {
  if (pct >= 85) return { bar: "bg-destructive", text: "text-destructive" };
  if (pct >= 60) return { bar: "bg-chart-3", text: "text-chart-3" };
  return { bar: "bg-chart-2", text: "text-chart-2" };
}

function getPOStatusTone(status: POStatus): { bg: string; text: string; border: string } {
  switch (status) {
    case "draft":
      return {
        bg: "hsl(var(--secondary))",
        text: "hsl(var(--muted-foreground))",
        border: "hsl(var(--border))",
      };
    case "sent":
    case "confirmed":
      return {
        bg: "hsl(var(--accent))",
        text: "hsl(var(--primary))",
        border: "hsl(var(--primary) / 0.25)",
      };
    case "active_with_cancellation":
      return {
        bg: "hsl(var(--chart-3) / 0.14)",
        text: "hsl(var(--chart-3))",
        border: "hsl(var(--chart-3) / 0.35)",
      };
    case "partially_received":
      return {
        bg: "hsl(var(--chart-3) / 0.12)",
        text: "hsl(var(--chart-3))",
        border: "hsl(var(--chart-3) / 0.28)",
      };
    case "cancelled":
      return {
        bg: "hsl(var(--destructive) / 0.1)",
        text: "hsl(var(--destructive))",
        border: "hsl(var(--destructive) / 0.24)",
      };
    case "fully_received":
      return {
        bg: "hsl(var(--chart-2) / 0.14)",
        text: "hsl(var(--chart-2))",
        border: "hsl(var(--chart-2) / 0.28)",
      };
  }
}

function CustomDot(props: any) {
  const { cx, cy, payload, dataKey } = props;
  const valueKey = dataKey ?? "lastPO";
  const avgKey = valueKey === "lastQty" ? "avgQty" : "avgPO";
  if (!payload || payload[valueKey] == null) return null;
  const isGray = payload[avgKey] != null;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={4.5}
      fill={isGray ? "hsl(var(--foreground) / 0.3)" : "hsl(var(--chart-3))"}
      stroke="hsl(var(--background))"
      strokeWidth={2}
    />
  );
}

function buildChartPoints(pos: PurchaseOrder[]): ChartPoint[] {
  const fallback = pos[0];
  return PRICE_SEEDS.map((price, index) => {
    const month = index < 7 ? 8 : 9;
    const day = index < 7 ? 24 + index : index < 17 ? index - 7 + 1 : index - 17 + 11;
    const monthName = MONTH_NAMES[month];
    const dateLabel = `${monthName} ${String(day).padStart(2, "0")}`;
    const isToday = index === TODAY_IDX;
    const isFuture = index > TODAY_IDX;
    const po = pos[index % Math.max(pos.length, 1)] ?? fallback;

    return {
      date: isToday ? `${dateLabel} (Today)` : dateLabel,
      fullDate: `${monthName} ${day}, 2024`,
      dayIdx: index,
      lastPO: isFuture ? null : price,
      avgPO: isToday ? 780 : null,
      lastQty: isFuture ? null : QTY_SEEDS[index],
      avgQty: isToday ? 140 : null,
      poNumber: isFuture ? undefined : po?.poNumber,
      poStatus: isFuture ? undefined : po?.status,
      orderedItems: isFuture ? undefined : po?.orderedItems,
      orderedItemsMore: isFuture ? undefined : po?.orderedItemsMore,
      pointOfContact: isFuture ? undefined : po?.pointOfContact,
      location: isFuture ? undefined : po?.location,
      dueDate: isFuture ? undefined : po?.dueDeliveryDate,
    };
  });
}

export function VendorDetailModal({
  open,
  onOpenChange,
  vendor,
  itemId,
}: VendorDetailModalProps) {
  const { posByItem } = usePurchasing();
  const [activeTab, setActiveTab] = useState<TabKey>("details");
  const [appliedRuleIds, setAppliedRuleIds] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  const vendorKey = vendor?.id ?? "";
  useEffect(() => {
    setActiveTab("details");
    setAppliedRuleIds(["pr-1", "pr-2"]);
  }, [vendorKey]);

  const vendorPOs = useMemo(() => {
    if (!vendor) return [] as PurchaseOrder[];
    const byName = (posByItem[itemId] ?? []).filter(
      (po) => po.partnerName.toLowerCase() === vendor.vendorName.toLowerCase(),
    );
    if (byName.length > 0) return byName;
    return (posByItem[itemId] ?? []).filter((po) => po.vendorId === vendor.vendorId);
  }, [itemId, posByItem, vendor]);

  if (!vendor) return null;

  const creditLimit = vendor.creditLimit ?? 20000;
  const creditUsed = vendor.creditUsed ?? 19879.24;
  const creditPct = Math.min(100, Math.round((creditUsed / creditLimit) * 100));
  const creditTone = getCreditTone(creditPct);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        className="bg-white flex flex-col p-0 gap-0 border-0 sm:border !fixed !top-[50%] !left-[50%] !translate-x-[-50%] !translate-y-[-50%] !w-[calc(100%-2rem)] transition-[max-width,max-height,border-radius] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] !max-w-[100%] sm:!max-w-[min(70vw,1320px)] !max-h-[100dvh] sm:!max-h-[90vh] rounded-none sm:!rounded-2xl sm:overflow-hidden"
      >
        <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-border bg-[#F0F7FF] px-5 py-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-foreground/50 transition-colors hover:bg-secondary hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
            <DialogTitle className="text-sm font-semibold text-foreground">
              Partner Detail
            </DialogTitle>
          </div>
          <DialogDescription className="sr-only">
            View and manage vendor partner details.
          </DialogDescription>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="shrink-0 px-5 pt-5">
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ backgroundColor: getSaturatedAvatarColor(vendor.vendorName) }}
                    aria-hidden
                  >
                    {getInitialsAtom(vendor.vendorName)}
                  </div>
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="whitespace-nowrap text-sm font-semibold text-foreground">
                        {vendor.vendorName}
                      </span>
                      <span
                        className={cn(
                          "inline-flex whitespace-nowrap rounded-md border px-2 py-px text-[11px] font-medium",
                          priorityBadgeClasses(vendor.priority),
                        )}
                      >
                        {formatPriorityLabel(vendor.priority)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-foreground/55">
                      <span>{vendor.tier ?? vendor.partnerGroup ?? "Vendor Group A"}</span>
                      <span className="text-foreground/25" aria-hidden>·</span>
                      <span>{vendor.location}</span>
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  className="h-7 gap-1.5 px-3 text-xs"
                  onClick={() => toast.info("Create PO coming in Slice 2B")}
                >
                  <Plus className="h-3 w-3" />
                  Create New PO
                </Button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border/60 pt-3 text-xs text-foreground/55">
                {[
                  { icon: Mail, value: vendor.email ?? "contact@vendor.com" },
                  { icon: Phone, value: vendor.phone ?? "+1 (555) 000-0000" },
                  { icon: Globe, value: vendor.website ?? "www.vendor.com" },
                ].map((item, index) => (
                  <div key={item.value} className="inline-flex items-center gap-2">
                    {index > 0 && (
                      <span className="text-foreground/25" aria-hidden>
                        ·
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <item.icon className="h-3.5 w-3.5 shrink-0 text-foreground/40" />
                      <span>{item.value}</span>
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-3 border-t border-border/60 pt-3">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="shrink-0 text-[10px] font-semibold uppercase leading-none tracking-wider text-muted-foreground">
                    Vendor Credit
                  </span>
                  <div className="flex items-end gap-1">
                    <span className={cn("text-xs font-semibold tabular-nums", creditTone.text)}>
                      ${creditUsed.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      / ${creditLimit.toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className={cn("h-full rounded-full transition-all", creditTone.bar)}
                    style={{ width: `${creditPct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex shrink-0 gap-1 overflow-x-auto border-b border-border px-5">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs whitespace-nowrap transition-colors",
                    isActive
                      ? "border-primary font-semibold text-primary"
                      : "border-transparent font-medium text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className={cn("h-3.5 w-3.5", isActive ? "text-primary" : "text-muted-foreground")} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            {activeTab === "details" && (
              <DetailsTab
                vendor={vendor}
                appliedRuleIds={appliedRuleIds}
                onOpenPicker={() => setPickerOpen(true)}
                onRemoveRule={(id) => setAppliedRuleIds((prev) => prev.filter((ruleId) => ruleId !== id))}
              />
            )}
            {activeTab === "analytics" && (
              <AnalyticsTab vendor={vendor} pos={vendorPOs} />
            )}
            {activeTab === "contacts" && <ContactsTab vendor={vendor} />}
            {activeTab === "orders" && <OrdersTab pos={vendorPOs} />}
            {activeTab === "payment" && <PaymentTab vendor={vendor} />}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-5 py-3">
          <Button variant="outline" className="h-8 px-4 text-xs" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="h-8 gap-1.5 px-4 text-xs"
            onClick={() => toast.info("Partner profile navigation coming soon")}
          >
            <ArrowUpRight className="h-3 w-3" />
            Go to Partner Profile
          </Button>
        </div>

        <PricingRulesPicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          initialSelected={appliedRuleIds}
          onApply={(ids) => {
            setAppliedRuleIds(ids);
            setPickerOpen(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function DetailsTab({
  vendor,
  appliedRuleIds,
  onOpenPicker,
  onRemoveRule,
}: {
  vendor: QualifiedVendor;
  appliedRuleIds: string[];
  onOpenPicker: () => void;
  onRemoveRule: (id: string) => void;
}) {
  const appliedRules = PRICING_RULES.filter((rule) => appliedRuleIds.includes(rule.id));
  const [editing, setEditing] = useState(false);
  const initialDraft = useMemo(
    () => ({
      pricePerUnit: String(vendor.pricePerUnit ?? 0),
      vendorUOM: vendor.vendorUOM ?? "ea (Each)",
      acceptedDeviation: String(vendor.acceptedDeviation ?? 0),
      minOrderQty: String(vendor.minOrderQty ?? 0),
      maxOrderQty: String(vendor.maxOrderQty ?? 0),
      multiples: String(vendor.multiples ?? 0),
    }),
    [vendor],
  );
  const [draft, setDraft] = useState(initialDraft);
  useEffect(() => {
    setDraft(initialDraft);
    setEditing(false);
  }, [initialDraft]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Details &amp; Pricing</h3>
        {editing ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setDraft(initialDraft);
                setEditing(false);
              }}
              className="inline-flex items-center gap-1 text-xs font-medium text-foreground/60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                toast.success("Changes saved");
                setEditing(false);
              }}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary"
            >
              ✓ Save
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary"
          >
            <Edit className="h-3.5 w-3.5" />
            Edit
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DetailCard title="Pricing">
          {editing ? (
            <>
              <EditableRow
                label="Price per unit"
                value={draft.pricePerUnit}
                onChange={(value) => setDraft((prev) => ({ ...prev, pricePerUnit: value }))}
              />
              <EditableRow
                label="Unit of Measure"
                value={draft.vendorUOM}
                onChange={(value) => setDraft((prev) => ({ ...prev, vendorUOM: value }))}
              />
              <EditableRow
                label="Accepted Deviation"
                value={draft.acceptedDeviation}
                onChange={(value) => setDraft((prev) => ({ ...prev, acceptedDeviation: value }))}
                last
              />
            </>
          ) : (
            <>
              <DetailRow
                label="Price per unit"
                value={`$${vendor.pricePerUnit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
              />
              <DetailRow label="Unit of Measure" value={vendor.vendorUOM ?? "ea (Each)"} />
              <DetailRow label="Accepted Deviation" value={`${vendor.acceptedDeviation ?? 0}%`} last />
            </>
          )}
        </DetailCard>

        <DetailCard title="Order Constraints">
          {editing ? (
            <>
              <EditableRow
                label="Min Order Qty"
                value={draft.minOrderQty}
                onChange={(value) => setDraft((prev) => ({ ...prev, minOrderQty: value }))}
              />
              <EditableRow
                label="Max Order Qty"
                value={draft.maxOrderQty}
                onChange={(value) => setDraft((prev) => ({ ...prev, maxOrderQty: value }))}
              />
              <EditableRow
                label="Multiples"
                value={draft.multiples}
                onChange={(value) => setDraft((prev) => ({ ...prev, multiples: value }))}
                last
              />
            </>
          ) : (
            <>
              <DetailRow label="Min Order Qty" value={`${(vendor.minOrderQty ?? 0).toLocaleString()} units`} />
              <DetailRow label="Max Order Qty" value={`${(vendor.maxOrderQty ?? 0).toLocaleString()} units`} />
              <DetailRow label="Multiples" value={`${(vendor.multiples ?? 0).toLocaleString()} units`} last />
            </>
          )}
        </DetailCard>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border bg-secondary px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground">Applied Pricing Rules</span>
            {appliedRules.length > 0 && (
              <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
                {appliedRules.length}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onOpenPicker}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary"
          >
            <Plus className="h-[11px] w-[11px]" />
            Add Rule
          </button>
        </div>
        <div className="px-4 py-3">
          {appliedRules.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-6">
              <TagIcon className="mb-2 h-6 w-6 text-foreground/15" />
              <p className="mb-1 text-xs font-medium text-foreground/40">No pricing rules applied</p>
              <p className="text-[11px] text-foreground/30">
                Click &quot;Add Rule&quot; to attach discount or premium rules
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {appliedRules.map((rule) => (
                <RuleCard key={rule.id} rule={rule} onRemove={() => onRemoveRule(rule.id)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="border-b border-border bg-secondary px-4 py-2">
        <span className="text-xs font-semibold text-foreground">{title}</span>
      </div>
      <div>{children}</div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  last,
  icon,
}: {
  label: string;
  value: string;
  last?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3 px-4 py-2", !last && "border-b border-border")}>
      <span className="text-xs text-foreground/50">{label}</span>
      <div className="flex min-w-0 items-center gap-2">
        {icon}
        <span className="truncate text-xs font-semibold text-foreground">{value}</span>
      </div>
    </div>
  );
}

function EditableRow({
  label,
  value,
  onChange,
  last,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  last?: boolean;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3 px-4 py-1.5", !last && "border-b border-border")}>
      <span className="text-xs text-foreground/50">{label}</span>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-7 max-w-[10rem] text-xs"
      />
    </div>
  );
}

function AnalyticsTab({ vendor, pos }: { vendor: QualifiedVendor; pos: PurchaseOrder[] }) {
  const [chartViewMode, setChartViewMode] = useState<ChartViewMode>("price");
  const [chartDateOffset, setChartDateOffset] = useState(0);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [avgPricePeriod, setAvgPricePeriod] = useState<"7d" | "30d" | "90d" | "180d" | "365d">("30d");

  const avgPricePeriodConfig: Record<typeof avgPricePeriod, { label: string; multiplier: number; deltaLabel: string }> = {
    "7d": { label: "Last 7 days", multiplier: 1.04, deltaLabel: "+4.0% from prior 7d" },
    "30d": { label: "Last 30 days", multiplier: 1.0, deltaLabel: "+10.5% from prior 30d" },
    "90d": { label: "Last 90 days", multiplier: 0.97, deltaLabel: "+6.2% from prior 90d" },
    "180d": { label: "Last 180 days", multiplier: 0.94, deltaLabel: "+3.1% from prior 180d" },
    "365d": { label: "Last 365 days", multiplier: 0.9, deltaLabel: "-1.4% from prior 365d" },
  };
  const avgPriceCfg = avgPricePeriodConfig[avgPricePeriod];
  const avgPriceValue = (vendor.averagePricePerUnit ?? 0) * avgPriceCfg.multiplier;

  const isPrice = chartViewMode === "price";
  const points = useMemo(() => buildChartPoints(pos), [pos]);
  const defaultStart = TODAY_IDX - 3;
  const windowStart = Math.max(0, Math.min(points.length - WINDOW_SIZE, defaultStart + chartDateOffset));
  const visiblePoints = points.slice(windowStart, windowStart + WINDOW_SIZE);

  // Map ChartPoint dayIdx → real Date (points are seeded across Aug/Sep/Oct 2024).
  const pointDates = useMemo(
    () =>
      points.map((p) => {
        const [monStr, dayStr] = p.fullDate.replace(", 2024", "").split(" ");
        const monthIdx = MONTH_NAMES.indexOf(monStr);
        return new Date(2024, monthIdx, parseInt(dayStr, 10));
      }),
    [points],
  );
  const selectedRange = {
    from: pointDates[windowStart],
    to: pointDates[Math.min(windowStart + WINDOW_SIZE - 1, pointDates.length - 1)],
  };
  const handleCalendarSelect = (range: { from?: Date; to?: Date } | undefined) => {
    if (!range?.from) return;
    const target = range.from.getTime();
    let bestIdx = 0;
    let bestDelta = Infinity;
    pointDates.forEach((d, i) => {
      const delta = Math.abs(d.getTime() - target);
      if (delta < bestDelta) {
        bestDelta = delta;
        bestIdx = i;
      }
    });
    const newWindowStart = Math.max(0, Math.min(points.length - WINDOW_SIZE, bestIdx));
    setChartDateOffset(newWindowStart - defaultStart);
    if (range.to) setCalendarOpen(false);
  };

  const canGoBack = windowStart > 0;
  const canGoForward = windowStart + WINDOW_SIZE < points.length;
  const rangeLabel = visiblePoints.length
    ? `${visiblePoints[0].fullDate.replace(", 2024", "")} - ${visiblePoints[visiblePoints.length - 1].fullDate.replace(", 2024", "")}`
    : "";

  const metricCards = isPrice
    ? [
        {
          label: "Avg Price / Unit",
          value: `$${avgPriceValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          sub: avgPriceCfg.deltaLabel,
          trend: "down" as const,
          period: true as const,
        },
        {
          label: "Last PO Total",
          value: `$${(vendor.lastPOTotalAmount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
          sub: "12 Oct 2024",
          trend: null,
        },
        {
          label: "Last PO Price / Unit",
          value: `$${(vendor.lastPOPricePerUnit ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
          sub: "12 Oct 2024",
          trend: null,
        },
      ]
    : [
        {
          label: "Avg Order Qty",
          value: `${(vendor.minOrderQty && vendor.maxOrderQty ? Math.round((vendor.minOrderQty + vendor.maxOrderQty) / 2) : 140).toLocaleString()} units`,
          sub: "+8.2% from 30 days",
          trend: "up" as const,
        },
        {
          label: "Last PO Qty",
          value: "170 units",
          sub: "12 Oct 2024",
          trend: null,
        },
        {
          label: "Lot Per Lead Time",
          value: `${vendor.lotPerLeadTime ?? 24} units`,
          sub: `${vendor.averageLeadTime ?? 5} day avg lead`,
          trend: null,
        },
      ];

  const yDomain: [number, number] = isPrice ? [0, 800] : [0, 200];
  const yTicks = isPrice
    ? [0, 100, 200, 300, 400, 500, 600, 700, 800]
    : [0, 25, 50, 75, 100, 125, 150, 175, 200];
  const refLine1Y = isPrice ? 500 : 100;
  const refLine2Y = isPrice ? 750 : 175;
  const lineDataKey = isPrice ? "lastPO" : "lastQty";
  const areaDataKey = isPrice ? "lastPO" : "lastQty";

  const statusColors: Record<POStatus, string> = {
    draft: "hsl(var(--foreground) / 0.5)",
    sent: "hsl(var(--primary))",
    active_with_cancellation: "hsl(var(--accent-foreground))",
    confirmed: "hsl(var(--primary))",
    partially_received: "hsl(var(--chart-3))",
    cancelled: "hsl(var(--destructive))",
    fully_received: "hsl(var(--chart-2))",
  };

  const statusLabels: Record<POStatus, string> = {
    draft: "Draft",
    sent: "Sent",
    active_with_cancellation: "Active",
    confirmed: "Confirmed",
    partially_received: "Partial",
    cancelled: "Cancelled",
    fully_received: "Received",
  };

  const tooltipContent = ({ active, payload }: any) => {
    if (!active || !payload || !payload[0]) return null;
    const point = payload[0].payload as ChartPoint;
    const value = isPrice ? point.lastPO : point.lastQty;
    if (value == null) return null;

    return (
      <div className="min-w-[13rem] rounded-lg border border-border bg-card p-3 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] text-foreground/50">{point.fullDate}</span>
          {point.poStatus && (
            <span className="text-[11px] font-medium" style={{ color: statusColors[point.poStatus] }}>
              {statusLabels[point.poStatus]}
            </span>
          )}
        </div>

        <div className="mb-2">
          <span className="text-base font-semibold text-chart-2">
            {isPrice ? `$${value}k` : `${value} units`}
          </span>
          <span className="ml-1 text-[11px] text-foreground/40">
            {isPrice ? "Last PO Price" : "Last PO Qty"}
          </span>
        </div>

        {point.poNumber && (
          <div className="flex flex-col gap-1 border-t border-border pt-2">
            <TooltipRow label="PO Number" value={point.poNumber} />
            <TooltipRow
              label="Items"
              value={`${point.orderedItems ?? ""}${point.orderedItemsMore ? ` +${point.orderedItemsMore}` : ""}`}
            />
            {point.pointOfContact && <TooltipRow label="Contact" value={point.pointOfContact} />}
            {point.location && <TooltipRow label="Location" value={point.location} truncate />}
            {point.dueDate && <TooltipRow label="Due" value={point.dueDate} />}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div>
        <span className="inline-block rounded-full border border-chart-2 px-3 py-1 text-[11px] font-medium text-chart-2">
          {isPrice ? "Price Trends" : "Quantity Trends"}
        </span>
      </div>

      <div className="grid grid-cols-1 overflow-hidden rounded-md border border-border bg-card sm:grid-cols-3">
        {metricCards.map((card, index) => (
          <div key={card.label} className={cn("px-4 py-3", index > 0 && "sm:border-l border-border")}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="text-[11px] text-foreground/50">{card.label}</p>
              {(card as any).period && (
                <Select value={avgPricePeriod} onValueChange={(v) => setAvgPricePeriod(v as typeof avgPricePeriod)}>
                  <SelectTrigger className="h-5 w-auto gap-1 rounded border-border px-1.5 text-[10px] text-foreground/60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7d">Last 7 days</SelectItem>
                    <SelectItem value="30d">Last 30 days</SelectItem>
                    <SelectItem value="90d">Last 90 days</SelectItem>
                    <SelectItem value="180d">Last 180 days</SelectItem>
                    <SelectItem value="365d">Last 365 days</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <p className="mb-[2px] text-base font-semibold text-foreground">{card.value}</p>
            {card.trend === "down" ? (
              <div className="flex items-center gap-[2px]">
                <TrendingDown className="h-[11px] w-[11px] text-destructive" />
                <span className="text-[11px] font-medium text-destructive">{card.sub}</span>
              </div>
            ) : card.trend === "up" ? (
              <div className="flex items-center gap-[2px]">
                <span className="text-[11px] font-medium text-chart-2">↗</span>
                <span className="text-[11px] font-medium text-chart-2">{card.sub}</span>
              </div>
            ) : (
              <p className="text-[11px] text-foreground/40">{card.sub}</p>
            )}
          </div>
        ))}
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <span className="text-sm font-semibold text-foreground">
              {isPrice ? "Price Trends" : "Quantity Trends"}
            </span>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-chart-3" />
                <span className="text-xs text-foreground/60">
                  {isPrice ? "Last PO Price" : "Last PO Qty"}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-foreground/30" />
                <span className="text-xs text-foreground/60">
                  {isPrice ? "Average PO Price" : "Average PO Qty"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setChartDateOffset(0)}
              className={cn(
                "rounded-md border px-2 py-[2px] text-xs font-medium",
                chartDateOffset === 0
                  ? "border-primary text-primary"
                  : "border-border text-foreground/50",
              )}
            >
              Today
            </button>
            <div className="flex items-center gap-1 rounded-md border border-border px-2 py-[2px]">
              <button
                type="button"
                onClick={() => canGoBack && setChartDateOffset((value) => value - 1)}
                disabled={!canGoBack}
                className="disabled:cursor-default disabled:opacity-30"
              >
                <ChevronLeft className="h-3 w-3 text-foreground/50" />
              </button>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="min-w-[7.5rem] cursor-pointer text-center text-xs text-foreground/60 hover:text-foreground"
                  >
                    {rangeLabel}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="center">
                  <Calendar
                    mode="range"
                    selected={selectedRange as any}
                    onSelect={handleCalendarSelect as any}
                    defaultMonth={selectedRange.from}
                    numberOfMonths={2}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              <button
                type="button"
                onClick={() => canGoForward && setChartDateOffset((value) => value + 1)}
                disabled={!canGoForward}
                className="disabled:cursor-default disabled:opacity-30"
              >
                <ChevronRight className="h-3 w-3 text-foreground/50" />
              </button>
            </div>
            <Select value={chartViewMode} onValueChange={(value) => setChartViewMode(value as ChartViewMode)}>
              <SelectTrigger className="h-[26px] w-28 rounded-md border-border px-2 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="price">Price</SelectItem>
                <SelectItem value="quantity">Quantity</SelectItem>
              </SelectContent>
            </Select>
            <button
              type="button"
              className="inline-flex h-[26px] w-[26px] items-center justify-center rounded-md border border-border bg-card"
              aria-label="Expand"
              onClick={() => toast.info("Expanded analytics coming soon")}
            >
              <Maximize2 className="h-3 w-3 text-foreground/50" />
            </button>
          </div>
        </div>

        <div className="rounded-md border border-border bg-card pt-3 pr-2">
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={visiblePoints} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
              <defs>
                <linearGradient id="analyticsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--chart-2) / 0.18)" />
                  <stop offset="100%" stopColor="hsl(var(--chart-2) / 0.02)" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="0" stroke="hsl(var(--border))" vertical horizontal={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))" }}
                tick={({ x, y, payload }: any) => {
                  if (!payload?.value) return <g />;
                  const isToday = String(payload.value).includes("(Today)");
                  return (
                    <text
                      x={x}
                      y={y + 12}
                      textAnchor="middle"
                      fill={isToday ? "hsl(var(--primary))" : "hsl(var(--foreground) / 0.4)"}
                      style={{ fontSize: 11 }}
                    >
                      {payload.value}
                    </text>
                  );
                }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                domain={yDomain}
                ticks={yTicks}
                tickFormatter={isPrice ? ((value) => (value === 0 ? "0k" : `${value}k`)) : ((value) => `${value}`)}
                width={40}
                tick={{ fill: "hsl(var(--foreground) / 0.4)", fontSize: 11 }}
              />
              <ReferenceLine y={refLine1Y} stroke="hsl(var(--accent-foreground))" strokeDasharray="8 6" strokeWidth={1.5} strokeOpacity={0.5} />
              <ReferenceLine y={refLine2Y} stroke="hsl(var(--chart-3))" strokeDasharray="8 6" strokeWidth={1.5} strokeOpacity={0.5} />
              <Tooltip content={tooltipContent} cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }} wrapperStyle={{ zIndex: 50 }} />
              <Area
                type="monotone"
                dataKey={areaDataKey}
                stroke="none"
                fill="url(#analyticsFill)"
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey={lineDataKey}
                stroke="hsl(var(--chart-2))"
                strokeWidth={2}
                dot={<CustomDot dataKey={lineDataKey} />}
                activeDot={{ r: 6, fill: "hsl(var(--chart-2))", stroke: "hsl(var(--background))", strokeWidth: 2 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function TooltipRow({
  label,
  value,
  truncate,
}: {
  label: string;
  value: string;
  truncate?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-foreground/40">{label}</span>
      <span className={cn("text-[11px] font-medium text-foreground", truncate && "max-w-[8rem] truncate text-right")}>
        {value}
      </span>
    </div>
  );
}

type ContactSortKey = "name" | "title" | "department" | "phone" | "email";
const CONTACT_COLS: { key: ContactSortKey; label: string; width: number; sortable?: boolean }[] = [
  { key: "name", label: "Contact", width: 240, sortable: true },
  { key: "title", label: "Title", width: 200, sortable: true },
  { key: "department", label: "Department", width: 150, sortable: true },
  { key: "phone", label: "Phone", width: 200 },
  { key: "email", label: "Email", width: 260, sortable: true },
];

function ContactsTab({ vendor }: { vendor: QualifiedVendor }) {
  const allContacts = useMemo(() => generateSeedContacts(vendor.id), [vendor.id]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeDept, setActiveDept] = useState<"all" | ContactDepartment>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(20);
  const [sortKey, setSortKey] = useState<ContactSortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [density, setDensity] = useState<"condensed" | "comfort">("comfort");
  const isComfort = density === "comfort";

  const deptCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allContacts.length };
    for (const contact of allContacts) {
      if (contact.department) counts[contact.department] = (counts[contact.department] || 0) + 1;
    }
    return counts;
  }, [allContacts]);

  const filtered = useMemo(() => {
    let list = allContacts;
    if (activeDept !== "all") {
      list = list.filter((contact) => contact.department === activeDept);
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      list = list.filter(
        (contact) =>
          contact.name.toLowerCase().includes(query) ||
          contact.title.toLowerCase().includes(query) ||
          contact.email.toLowerCase().includes(query) ||
          contact.phone.includes(query),
      );
    }
    return list;
  }, [activeDept, allContacts, searchQuery]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av = String(a[sortKey] ?? "").toLowerCase();
      const bv = String(b[sortKey] ?? "").toLowerCase();
      const r = av.localeCompare(bv);
      return sortDir === "asc" ? r : -r;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / recordsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = sorted.slice((safePage - 1) * recordsPerPage, safePage * recordsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeDept, searchQuery, recordsPerPage]);

  const departments: ("all" | ContactDepartment)[] = ["all", "Sales", "Procurement", "Finance"];

  const handleSort = (key: ContactSortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search point of contact"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-3 text-xs text-foreground outline-none"
          />
        </div>
        <div className="inline-flex shrink-0 items-center rounded-lg border border-border bg-card p-0.5">
          {([
            { key: "condensed" as const, Icon: AlignJustify, label: "Condensed" },
            { key: "comfort" as const, Icon: List, label: "Comfort" },
          ]).map(({ key, Icon, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setDensity(key)}
              title={label}
              aria-label={label}
              className={cn(
                "inline-flex h-7 w-8 items-center justify-center rounded-md transition-colors",
                density === key ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {departments.map((department) => {
          const isActive = activeDept === department;
          const label = department === "all"
            ? `All (${deptCounts.all ?? 0})`
            : `${department} (${deptCounts[department] ?? 0})`;

          return (
            <button
              key={department}
              type="button"
              onClick={() => setActiveDept(department)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium",
                isActive
                  ? "border-primary text-primary"
                  : "border-border text-foreground/60",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table style={{ minWidth: 1114 }}>
          <TableHeader className="sticky top-0 z-20 bg-card">
            <TableRow className={cn("bg-muted/30 hover:bg-muted/30", isComfort ? "[&>th]:h-9" : "[&>th]:h-8")}>
              {CONTACT_COLS.map((col) => {
                const active = sortKey === col.key ? sortDir : null;
                const isName = col.key === "name";
                return (
                  <TableHead
                    key={col.key}
                    style={{ width: col.width, minWidth: col.width }}
                    className={cn("whitespace-nowrap", isName && "sticky left-0 z-20 bg-[#F8FAFC]")}
                  >
                    {col.sortable ? (
                      <button
                        type="button"
                        onClick={() => handleSort(col.key)}
                        className="group/sort inline-flex cursor-pointer items-center gap-1"
                      >
                        <span className="text-[13px]" style={active ? { color: "hsl(var(--primary))" } : undefined}>{col.label}</span>
                        {active === "asc" && <ArrowUp className="h-3 w-3 shrink-0" style={{ color: "hsl(var(--primary))" }} />}
                        {active === "desc" && <ArrowDown className="h-3 w-3 shrink-0" style={{ color: "hsl(var(--primary))" }} />}
                        {!active && <ArrowUpDown className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/sort:opacity-100" />}
                      </button>
                    ) : (
                      <span className="text-[13px]">{col.label}</span>
                    )}
                  </TableHead>
                );
              })}
              <TableHead className="sticky right-0 z-20 w-[64px] bg-[#F8FAFC] !pr-3 text-right">
                <span className="text-[13px] text-muted-foreground">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={CONTACT_COLS.length + 1} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Users className="h-8 w-8" />
                    <p className="text-sm">No contacts found</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((contact) => (
                <TableRow
                  key={contact.id}
                  className={cn(
                    "group cursor-default hover:bg-[#F0F7FF]",
                    isComfort ? "[&>td]:py-2 [&>td]:pl-4 [&>td]:pr-2" : "[&>td]:py-1 [&>td]:pl-4 [&>td]:pr-2",
                  )}
                >
                  <TableCell style={{ width: 240, minWidth: 240 }} className="sticky left-0 z-10 bg-card group-hover:bg-[#F0F7FF]">
                    <ContactNameCell contact={contact} isComfort={isComfort} />
                  </TableCell>
                  <TableCell style={{ width: 200, minWidth: 200 }}>
                    <span className={cn(isComfort ? "text-[13.5px]" : "text-sm", "text-foreground")}>{contact.title || "—"}</span>
                  </TableCell>
                  <TableCell style={{ width: 150, minWidth: 150 }}>
                    {contact.department ? (
                      <span
                        className={cn("inline-flex items-center rounded-md border", isComfort ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-xs")}
                        style={{ fontWeight: 500, backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))", borderColor: "hsl(var(--border))" }}
                      >
                        {contact.department}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">{"—"}</span>
                    )}
                  </TableCell>
                  <TableCell style={{ width: 200, minWidth: 200 }}>
                    <div className="min-w-0">
                      <span className={cn(isComfort ? "text-[13.5px]" : "text-sm", "tabular-nums")} style={{ fontWeight: 500 }}>
                        {contact.phone}
                        {contact.ext && <span className="ml-1.5 text-[11px] font-normal text-muted-foreground/70">{contact.ext}</span>}
                      </span>
                      {isComfort && contact.mobile && (
                        <span className="block text-[10px] text-muted-foreground/60">Mobile · {contact.mobile}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell style={{ width: 260, minWidth: 260 }}>
                    <span className={cn(isComfort ? "text-[13.5px]" : "text-sm", "block truncate text-foreground")}>{contact.email}</span>
                  </TableCell>
                  <TableCell style={{ width: 64, minWidth: 64 }} className="sticky right-0 z-10 bg-card !pr-3 group-hover:bg-[#F0F7FF]">
                    <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); toast.info("Coming soon"); }}
                        className="inline-flex h-7 w-7 items-center justify-center rounded text-foreground/40 hover:bg-secondary hover:text-foreground"
                        aria-label="Edit contact"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); toast.info("Coming soon"); }}
                        className="inline-flex h-7 w-7 items-center justify-center rounded text-destructive/70 hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Delete contact"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {filtered.length > 0 && (
        <SimplePagination
          currentPage={safePage}
          totalPages={totalPages}
          recordsPerPage={recordsPerPage}
          totalCount={filtered.length}
          onPageChange={setCurrentPage}
          onRecordsPerPageChange={setRecordsPerPage}
          options={[8, 12, 20]}
        />
      )}
    </div>
  );
}

function ContactNameCell({ contact, isComfort }: { contact: VendorContact; isComfort: boolean }) {
  return (
    <div className={cn("flex items-center", isComfort ? "gap-3" : "gap-2.5")}>
      <HoverCard openDelay={200} closeDelay={80}>
        <HoverCardTrigger asChild>
          <button
            type="button"
            className="cursor-pointer"
            onClick={(e) => e.stopPropagation()}
            aria-label={`View ${contact.name}`}
          >
            <InitialAvatar name={contact.name} size={isComfort ? "md" : "sm"} />
          </button>
        </HoverCardTrigger>
        <HoverCardContent
          side="bottom"
          align="start"
          className="z-[300] w-[280px] overflow-hidden rounded-xl border-0 p-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)]"
        >
          <div className="relative overflow-hidden bg-gradient-to-br from-slate-800 to-slate-700 px-4 py-3">
            <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-white/[0.04]" />
            <div className="relative flex items-center gap-3">
              <InitialAvatar name={contact.name} size="lg" />
              <div className="min-w-0">
                <p className="truncate text-[14px] text-white" style={{ fontWeight: 600 }}>{contact.name}</p>
                <p className="truncate text-[11px] text-slate-400">{contact.title || contact.department}</p>
              </div>
            </div>
          </div>
          <div className="space-y-2 bg-white px-4 py-3">
            {contact.email && (
              <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
                <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="truncate">{contact.email}</span>
              </div>
            )}
            {contact.department && (
              <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
                <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span>{contact.department}</span>
              </div>
            )}
            {contact.phone && (
              <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
                <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span>{contact.phone}{contact.ext ? ` ${contact.ext}` : ""}</span>
              </div>
            )}
            {contact.mobile && (
              <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
                <Smartphone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span>{contact.mobile}</span>
              </div>
            )}
          </div>
        </HoverCardContent>
      </HoverCard>
      <div className="min-w-0">
        <span
          className={cn(
            isComfort ? "text-[13.5px]" : "text-sm",
            "block cursor-pointer truncate text-slate-800 transition-colors hover:text-primary hover:underline",
          )}
          style={{ fontWeight: 500 }}
          onClick={(e) => { e.stopPropagation(); toast.info(`${contact.name} — contact detail coming soon`); }}
        >
          {contact.name}
        </span>
        {isComfort && contact.email && (
          <span className="block truncate text-xs text-muted-foreground/60">{contact.email}</span>
        )}
      </div>
    </div>
  );
}

function OrdersTab({ pos }: { pos: PurchaseOrder[] }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(20);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  // Filter to open POs only (mirror reference: exclude cancelled / fully_received)
  const openRows = useMemo(() => {
    return pos
      .filter((po) => po.status !== "cancelled" && po.status !== "fully_received")
      .map((po) => {
        const h = hashStr(po.id);
        const units = 50 + (h % 451);
        const address = PO_ADDRESSES[h % PO_ADDRESSES.length];
        return { po, units, address };
      });
  }, [pos]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return openRows;
    const q = searchQuery.toLowerCase();
    return openRows.filter(
      (r) =>
        r.po.poNumber.toLowerCase().includes(q) ||
        r.po.pointOfContact.toLowerCase().includes(q) ||
        r.address.toLowerCase().includes(q),
    );
  }, [openRows, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / recordsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const pageRows = filtered.slice((safePage - 1) * recordsPerPage, safePage * recordsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, recordsPerPage]);

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:flex-none">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-[13px] w-[13px] -translate-y-1/2 text-foreground/35" />
            <input
              type="text"
              placeholder="Search purchase orders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-full rounded-md border border-border bg-background pl-8 pr-3 text-xs text-foreground outline-none sm:w-[14rem]"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 rounded-md px-3 text-xs"
            onClick={() => toast.info("Filters coming soon")}
          >
            <Filter className="h-[13px] w-[13px]" />
            Filters
          </Button>
        </div>

        <div className="flex items-center justify-end gap-2">
          <span className="text-[11px] font-medium text-foreground/40">{filtered.length}</span>
          <div className="flex items-center overflow-hidden rounded-md border border-border">
            {(["list", "grid"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setViewMode(m)}
                className={cn(
                  "flex h-7 w-7 items-center justify-center transition-colors",
                  viewMode === m ? "bg-secondary text-foreground/70" : "text-foreground/30",
                )}
              >
                {m === "list" ? <List className="h-3.5 w-3.5" /> : <LayoutGrid className="h-3.5 w-3.5" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] border-collapse">
            <thead className="bg-muted/30">
              <tr className="border-b border-border h-8">
                {[
                  "PO No",
                  "Due Delivery Date",
                  "Order Date",
                  "Point of Contact",
                  "Partner Location",
                  "Units",
                  "Status",
                ].map((label, i) => (
                  <th
                    key={label}
                    className="px-3 text-left text-[13px] font-medium text-muted-foreground whitespace-nowrap"
                  >
                    <div className="flex items-center gap-[3px]">
                      <span>{label}</span>
                      {i < 6 && <ArrowUpDown className="h-[9px] w-[9px] opacity-50" />}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-[13px] text-muted-foreground">
                    No open purchase orders found
                  </td>
                </tr>
              ) : (
                pageRows.map(({ po, units, address }) => (
                  <tr
                    key={po.id}
                    onClick={() => toast.info("PO detail coming in Slice 2C")}
                    className="cursor-pointer border-b border-border/60 transition-colors hover:bg-[#F0F7FF]"
                  >
                    <td className="whitespace-nowrap px-3 py-1.5 text-[13px] font-medium text-primary hover:underline">{po.poNumber}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-[13px] text-foreground">{po.dueDeliveryDate || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-[13px] text-foreground">{po.orderDate || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-[13px] text-foreground">{po.pointOfContact || "—"}</td>
                    <td className="px-3 py-1.5">
                      <span className="block max-w-[12rem] truncate text-[13px] text-foreground">{address || "—"}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-[13px] tabular-nums text-foreground">{units.toLocaleString()}</td>
                    <td className="whitespace-nowrap px-3 py-1.5">
                      <POStatusInline status={po.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {filtered.length > 0 && (
        <SimplePagination
          currentPage={safePage}
          totalPages={totalPages}
          recordsPerPage={recordsPerPage}
          totalCount={filtered.length}
          onPageChange={setCurrentPage}
          onRecordsPerPageChange={setRecordsPerPage}
          options={[10, 20, 50, 100]}
          showingLabel
        />
      )}
    </div>
  );
}

function PaymentTab({ vendor }: { vendor: QualifiedVendor }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const method = SHIPPING_METHODS[activeIndex];
  const total = SHIPPING_METHODS.length;
  const prev = () => setActiveIndex((i) => (i === 0 ? total - 1 : i - 1));
  const next = () => setActiveIndex((i) => (i === total - 1 ? 0 : i + 1));

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border bg-secondary px-4 py-2">
          <span className="text-sm font-medium text-foreground">Payments &amp; Shipping Information</span>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center text-foreground/60"
            aria-label="Edit"
            onClick={() => toast.info("Edit coming soon")}
          >
            <Edit className="h-4 w-4" />
          </button>
        </div>

        <DetailRow
          label="Payment method"
          value={vendor.paymentMethod ?? "ACH/Direct Deposit"}
          icon={<Landmark className="h-3 w-3 text-foreground/60" />}
        />
        <DetailRow label="Billed to" value="FR Conversion, Westminster (Default)" />
        <DetailRow label="Paid to" value="BMW International, Toronto (Default)" last />
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border bg-secondary px-4 py-2">
          <FileText className="h-3.5 w-3.5 text-foreground/50" />
          <span className="text-xs font-medium text-foreground">Payment Terms</span>
        </div>
        <div className="px-4 py-3">
          <div className="flex overflow-hidden rounded-md border border-primary bg-[hsl(var(--primary)/0.02)]">
            <div className="w-[3px] shrink-0 bg-primary" />
            <div className="flex min-w-0 flex-1 gap-3 px-3 py-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary">
                <span className="text-[11px] font-bold tracking-[0.04em] text-primary-foreground">NET</span>
              </div>
              <div className="flex min-w-0 flex-col gap-[2px]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-xs font-medium text-foreground">
                    Net 30 Post Shipping (Standard Payment Terms)
                  </span>
                  <span className="rounded-sm bg-[hsl(var(--chart-3)/0.15)] px-1.5 py-px text-[10px] font-semibold text-chart-3">
                    Production Start
                  </span>
                </div>
                <span className="text-[11px] text-foreground/50">
                  The payment must be completed in full 30 days after the goods are shipped by the vendor.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border bg-secondary px-4 py-2">
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-foreground">Carrier &amp; Shipping Method</span>
            <Info className="h-3 w-3 text-foreground/30" />
          </div>
          <div className="flex items-center gap-3">
            {/* Carousel nav */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={prev}
                className="flex h-5 w-5 items-center justify-center rounded-full border border-border bg-card shadow-sm"
                aria-label="Previous shipping method"
              >
                <ChevronLeft className="h-2.5 w-2.5 text-foreground/60" />
              </button>
              <span className="text-[11px] font-medium text-foreground/50 tabular-nums">
                {activeIndex + 1} / {total}
              </span>
              <button
                type="button"
                onClick={next}
                className="flex h-5 w-5 items-center justify-center rounded-full border border-border bg-card shadow-sm"
                aria-label="Next shipping method"
              >
                <ChevronRight className="h-2.5 w-2.5 text-foreground/60" />
              </button>
            </div>
            <button
              type="button"
              className="inline-flex h-6 w-6 items-center justify-center text-foreground/40"
              aria-label="Edit"
              onClick={() => toast.info("Edit coming soon")}
            >
              <Pencil className="h-[13px] w-[13px]" />
            </button>
          </div>
        </div>

        <div className="px-4 py-3">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-card">
              <img src={fedexLogo} alt={method.carrierName} className="h-8 w-8 rounded-full object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">{method.carrierName}</span>
                {method.isDefault && <DefaultBadge />}
              </div>
              <span className="text-xs text-foreground/50">{method.carrierDescription}</span>
            </div>
          </div>

          <div className="overflow-hidden rounded-md border border-border bg-secondary">
            <div className="border-b border-border px-3 py-3">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                  {method.methodName} <span className="text-foreground/50">({method.methodType})</span>
                </span>
                {method.isDefault && <DefaultBadge />}
              </div>
              <p className="text-xs text-foreground/50">
                {method.methodDescription}
              </p>
            </div>
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <div className="flex items-center gap-1">
                <span className="text-xs font-medium text-foreground/50">Minimum Days</span>
                <Info className="h-[11px] w-[11px] text-foreground/20" />
              </div>
              <span className="text-xs font-medium text-foreground">{method.minDays}</span>
            </div>
            <div className="flex items-center justify-between px-3 py-2">
              <div className="flex items-center gap-1">
                <span className="text-xs font-medium text-foreground/50">Maximum Days</span>
                <Info className="h-[11px] w-[11px] text-foreground/20" />
              </div>
              <span className="text-xs font-medium text-foreground">{method.maxDays}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DefaultBadge() {
  return (
    <span className="inline-flex shrink-0 items-center rounded-md border border-primary bg-[hsl(var(--primary)/0.08)] px-2 text-[10px] font-medium text-primary">
      Default
    </span>
  );
}

/* ================================================================
   Seed-based deterministic helpers + mock data
   (ported from reference vendor-contacts-tab + partner-detail-modal-po
    + carrier-shipping-section)
   ================================================================ */

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

const FIRST_NAMES = [
  "Emily", "James", "Sarah", "Michael", "Olivia",
  "David", "Sophia", "Robert", "Linda", "Thomas",
  "Jessica", "Daniel", "Ashley", "Chris", "Maria",
  "Kevin", "Laura", "Brian", "Rachel", "Andrew",
];
const LAST_NAMES = [
  "Turner", "Anderson", "Mitchell", "Garcia", "Nguyen",
  "Patel", "Kim", "Williams", "Chen", "Martinez",
  "Brooks", "Foster", "Hayes", "Ross", "Webb",
  "Cole", "Rivera", "Schmidt", "Tanaka", "Jensen",
];
const ROLES: Record<ContactDepartment, string[]> = {
  Sales: ["Sales Rep", "Account Manager", "Sales Director", "Regional Lead"],
  Procurement: ["Buyer", "Procurement Specialist", "Supply Chain Analyst", "Category Manager", "Procurement Lead"],
  Finance: ["Accounts Payable", "Finance Analyst", "Credit Controller", "Billing Specialist", "Finance Manager"],
};

function generateSeedContacts(vendorId: string): VendorContact[] {
  const seed = hashStr(vendorId);
  const departments: ContactDepartment[] = ["Sales", "Procurement", "Finance"];
  const deptCounts: Record<ContactDepartment, number> = { Sales: 2, Procurement: 4, Finance: 4 };
  const contacts: VendorContact[] = [];

  let idx = 0;
  for (const dept of departments) {
    const count = deptCounts[dept];
    const roles = ROLES[dept];
    for (let i = 0; i < count; i++) {
      const fIdx = (seed + idx * 7 + i * 3) % FIRST_NAMES.length;
      const lIdx = (seed + idx * 11 + i * 5 + 1) % LAST_NAMES.length;
      const rIdx = (seed + idx + i) % roles.length;
      const first = FIRST_NAMES[fIdx];
      const last = LAST_NAMES[lIdx];
      const areaCode = String(100 + ((seed + idx) % 900)).padStart(3, "0");
      const phoneNum = `${String(100 + ((seed * 3 + idx * 17) % 900)).padStart(3, "0")}-${String(1000 + ((seed * 7 + idx * 13) % 9000)).padStart(4, "0")}`;
      const mobileNum = `${String(100 + ((seed * 5 + idx * 23) % 900)).padStart(3, "0")}-${String(1000 + ((seed * 11 + idx * 19) % 9000)).padStart(4, "0")}`;
      const ext = String(1000 + ((seed + idx * 37) % 9000));

      contacts.push({
        id: `${vendorId}-c${idx}`,
        name: `${first} ${last}`,
        title: roles[rIdx],
        department: dept,
        phone: `(${areaCode}) ${phoneNum}`,
        ext: `Ext. ${ext}`,
        mobile: `(${areaCode}) ${mobileNum}`,
        email: `${first.toLowerCase()}.${last.toLowerCase()}@company.com`,
      });
      idx++;
    }
  }
  return contacts;
}

const PO_ADDRESSES = [
  "1240 N Main St, Pasadena, OK 73058",
  "801 Commerce Dr, Great Falls, MD 21050",
  "455 Industrial Blvd, Lansing, IL 60438",
  "1928 SE Division St, Portland, IL 62670",
  "750 Mt Diablo Blvd, Lafayette, CA 94549",
  "320 Elm St, Stockton, NH 03244",
  "2100 W Big Beaver Rd, Troy, MI 48084",
  "555 Aviation Blvd, El Segundo, CA 90245",
  "1 American Rd, Dearborn, MI 48126",
  "4500 S Congress Ave, Austin, TX 78745",
];

/** Inline status (no badge box) — matches reference partner-detail-modal-po */
function POStatusInline({ status }: { status: POStatus }) {
  const config = PO_STATUS_CONFIG[status];
  const tone = getPOStatusTone(status);
  const showDot = status === "active_with_cancellation";
  const isDraft = status === "draft";
  return (
    <span
      className={cn("inline-flex items-center gap-1 text-xs font-medium", isDraft && "opacity-50")}
      style={{ color: tone.text }}
    >
      {showDot && (
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: tone.text }}
        />
      )}
      {config.label}
    </span>
  );
}

/** Reusable pagination strip — used by Contacts and Orders */
function SimplePagination({
  currentPage,
  totalPages,
  recordsPerPage,
  totalCount,
  onPageChange,
  onRecordsPerPageChange,
  options,
  showingLabel,
}: {
  currentPage: number;
  totalPages: number;
  recordsPerPage: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onRecordsPerPageChange: (val: number) => void;
  options: number[];
  showingLabel?: boolean;
}) {
  const pages: (number | "ellipsis")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push("ellipsis");
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push("ellipsis");
    pages.push(totalPages);
  }

  const si = (currentPage - 1) * recordsPerPage;
  const ei = Math.min(si + recordsPerPage, totalCount);

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-foreground/60">Records per page</span>
        <Select value={String(recordsPerPage)} onValueChange={(v) => onRecordsPerPageChange(Number(v))}>
          <SelectTrigger className="h-7 w-16 rounded-sm border-border px-2 text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((v) => (
              <SelectItem key={v} value={String(v)}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-[2px]">
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="flex h-7 w-7 items-center justify-center rounded-sm border border-border text-foreground/60 disabled:opacity-30"
          aria-label="First page"
        >
          <ChevronsLeft className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="flex h-7 items-center gap-1 rounded-sm border border-border px-2 text-[11px] font-medium text-foreground/60 disabled:opacity-30"
        >
          <ChevronLeft className="h-3 w-3" />
          Prev
        </button>

        {pages.map((p, i) =>
          p === "ellipsis" ? (
            <span key={`e-${i}`} className="px-1 text-[11px] text-foreground/40">…</span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-sm text-[11px] font-medium",
                p === currentPage
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-foreground/60",
              )}
            >
              {p}
            </button>
          ),
        )}

        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="flex h-7 items-center gap-1 rounded-sm border border-border px-2 text-[11px] font-medium text-foreground/60 disabled:opacity-30"
        >
          Next
          <ChevronRight className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="flex h-7 w-7 items-center justify-center rounded-sm border border-border text-foreground/60 disabled:opacity-30"
          aria-label="Last page"
        >
          <ChevronsRight className="h-3 w-3" />
        </button>
      </div>

      {showingLabel && (
        <span className="hidden text-[11px] text-foreground/45 sm:inline">
          Showing {totalCount > 0 ? si + 1 : 0}-{ei} of {totalCount}
        </span>
      )}
    </div>
  );
}

/* Carrier shipping methods catalog (ported from carrier-shipping-section.tsx) */
interface ShippingMethod {
  id: string;
  carrierName: string;
  carrierDescription: string;
  isDefault: boolean;
  methodName: string;
  methodType: string;
  methodDescription: string;
  minDays: string;
  maxDays: string;
}

const SHIPPING_METHODS: ShippingMethod[] = [
  {
    id: "sm-1",
    carrierName: "FedEx Express",
    carrierDescription: "For fastest delivery in USA",
    isDefault: true,
    methodName: "FedEx Express",
    methodType: "Air",
    methodDescription:
      "A cost-effective shipping method that uses road transportation to deliver packages. Suitable for non-urgent deliveries.",
    minDays: "1 day",
    maxDays: "2 days",
  },
  {
    id: "sm-2",
    carrierName: "FedEx Express",
    carrierDescription: "For fastest delivery in USA",
    isDefault: false,
    methodName: "FedEx Ground",
    methodType: "Ground",
    methodDescription:
      "Standard ground shipping for cost-effective delivery within the continental US. Typical transit time is 3–5 business days.",
    minDays: "3 days",
    maxDays: "5 days",
  },
  {
    id: "sm-3",
    carrierName: "FedEx Express",
    carrierDescription: "For fastest delivery in USA",
    isDefault: false,
    methodName: "FedEx Freight",
    methodType: "LTL",
    methodDescription:
      "Less-than-truckload freight service for large shipments. Ideal for palletised goods and bulk orders.",
    minDays: "5 days",
    maxDays: "7 days",
  },
];
