// Item Dashboard KPI catalog — Items-native version of Partners' DASH_KPI_DEFS.
// Categories: Inventory / Financial / Operational. Tooltips preserve the
// secondary info that used to live as a sub-line on Items' legacy KPI cards.
import * as React from "react";
import {
  Boxes,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  DollarSign,
  BarChart3,
  ShoppingCart,
  Users,
  Clock,
  Package,
  MapPin,
  Truck,
  Warehouse,
  Activity,
  Calendar,
  Star,
  Percent,
  Repeat,
  CheckCircle2,
  UserPlus,
  XCircle,
  Target,
  Banknote,
  type LucideIcon,
} from "lucide-react";
import { baseCompact, baseMoney } from "@/app/currency/itemMoney";
import { BASE_CURRENCY } from "@/app/currency/currencies";
import { formatMoney as formatInCurrency } from "@/app/currency/money";
import { usdToBase } from "@/app/currency/vendorFx";

export type ItemDashKpiCategory = "Inventory" | "Financial" | "Operational";

export interface ItemDashKpiDef {
  key: string;
  label: string;
  category: ItemDashKpiCategory;
  iconName: string;
  subtitle: string;
  /** Tooltip body — surfaces the secondary detail that legacy cards
   *  rendered as a sub-line (e.g. "3 Active · Value $12,500"). */
  tooltip?: string;
}

export const ITEM_DASH_KPI_DEFS: ItemDashKpiDef[] = [
  // ── Inventory ──
  { key: "on_hand_qty",      label: "On Hand Qty",       category: "Inventory",   iconName: "Boxes",       subtitle: "Across all locations", tooltip: "Total quantity currently on hand across every stocking location. Reconciled nightly against location ledgers." },
  { key: "available",        label: "Available",         category: "Inventory",   iconName: "TrendingUp",  subtitle: "Sellable / unreserved",  tooltip: "On-hand minus committed reservations. Represents what can be promised to new orders right now." },
  { key: "on_order",         label: "On Order",          category: "Inventory",   iconName: "AlertCircle", subtitle: "Inbound from vendors",   tooltip: "Quantity currently on open purchase orders awaiting receipt. Includes draft and confirmed POs." },
  { key: "reorder_point",    label: "Reorder Point",     category: "Inventory",   iconName: "Package",     subtitle: "Trigger threshold",      tooltip: "Stock level at which a replenishment PO is automatically suggested. Configured in the Inventory tab." },
  { key: "stock_health",     label: "Stock Health",      category: "Inventory",   iconName: "Activity",    subtitle: "Composite status",       tooltip: "Composite health score combining stock level, days of supply, and demand trend. Flags items at risk of stockout." },
  // ── Financial ──
  /* Item cost and stock value are in the base currency (Currency Touchpoints
     Map, Items 3): a receipt from a vendor in another currency is converted
     at the rate on its date. A currency-free icon, not $. */
  { key: "avg_cost",         label: "Avg Cost",          category: "Financial",   iconName: "Banknote",    subtitle: "Weighted average",       tooltip: "Weighted-average landed cost across receipts in the selected period, in PKR, the base currency. Mocked — pulls from costing layer in production." },
  { key: "total_value",      label: "Total Value",       category: "Financial",   iconName: "BarChart3",   subtitle: "On-hand × avg cost",     tooltip: "On-hand quantity multiplied by weighted-average cost, in PKR, the base currency. Mocked total inventory valuation for this item." },
  { key: "last_purchase",    label: "Last Purchase Price", category: "Financial", iconName: "Banknote",    subtitle: "Most recent receipt",    tooltip: "Unit price on the most recently received PO line, in PKR, the base currency. Tracked vs avg cost to surface price drift." },
  { key: "last_sale_price",  label: "Last Sale Price",   category: "Financial",   iconName: "Banknote",    subtitle: "Most recent SO",         tooltip: "Net unit price on the most recent shipped sales order line for this item, in PKR, the base currency." },
  // ── Operational ──
  { key: "open_po",          label: "Open Purchase Orders", category: "Operational", iconName: "ShoppingCart", subtitle: "Active POs",          tooltip: `Open purchase orders containing this item. 3 Active · Value ${baseCompact(12500)}.` },
  { key: "open_so",          label: "Open Sales Orders", category: "Operational", iconName: "Users",       subtitle: "Active SOs",             tooltip: "Open sales orders containing this item. 5 active · Total demand 450 EA." },
  { key: "avg_lead_time",    label: "Avg Lead Time",     category: "Operational", iconName: "Clock",       subtitle: "Vendor → receipt",       tooltip: "Average days from PO release to receipt across the trailing 90 days. Standard target 15 days." },
  { key: "locations",        label: "Locations",         category: "Operational", iconName: "MapPin",      subtitle: "Stocking sites",         tooltip: "Number of warehouse locations currently stocking this item." },
  { key: "primary_vendor",   label: "Primary Vendor",    category: "Operational", iconName: "Truck",       subtitle: "Default supplier",       tooltip: "Default qualified vendor used for replenishment. Configured under Qualified Vendors." },
];

/** 8 KPIs shown on first load — matches the spec list. */
export const DEFAULT_ITEM_DASH_KPIS: string[] = [
  "on_hand_qty",
  "available",
  "on_order",
  "avg_cost",
  "total_value",
  "open_po",
  "open_so",
  "avg_lead_time",
];

/** Compute a value string for an item KPI. Mocked where source-of-truth
 *  data isn't yet wired in — same posture as the legacy widgets.
 *  Avg Cost and Total Value are in the base currency, to the cent ("₨6,823.74",
 *  "₨1,692,287.52"): the design's USD cost is restated in PKR (usdToBase), and
 *  the value is on-hand × that base cost, so the two agree. */
export function computeItemDashKpiValue(
  key: string,
  item: any,
): { value: string; change?: string; changeColor?: string } {
  const onHand = Number(item?.onHand ?? item?.stock ?? item?.quantity ?? 248);
  const available = Math.max(0, onHand - 32);
  const avgCost = usdToBase(Number(item?.avgCost ?? item?.cost ?? 24));
  const totalValue = Math.round(onHand * avgCost * 100) / 100;
  switch (key) {
    case "on_hand_qty":     return { value: `${onHand} EA` };
    case "available":       return { value: `${available} EA`, change: "↗ 4%", changeColor: "hsl(var(--success))" };
    case "on_order":        return { value: "120 EA" };
    case "reorder_point":   return { value: "75 EA" };
    case "stock_health":    return { value: "Healthy", change: "98%", changeColor: "hsl(var(--success))" };
    case "avg_cost":        return { value: formatInCurrency(avgCost, BASE_CURRENCY) };
    case "total_value":     return { value: formatInCurrency(totalValue, BASE_CURRENCY) };
    case "last_purchase":   return { value: baseMoney(24.5), change: "↗ 2%", changeColor: "hsl(var(--destructive))" };
    case "last_sale_price": return { value: baseMoney(32) };
    case "open_po":         return { value: "3" };
    case "open_so":         return { value: "5", change: "High", changeColor: "hsl(var(--primary))" };
    case "avg_lead_time":   return { value: "14 Days", change: "Target", changeColor: "hsl(var(--success))" };
    case "locations":       return { value: "4" };
    case "primary_vendor":  return { value: item?.primaryVendor ?? "Acme Supply" };
    default:                return { value: "—" };
  }
}

const ICON_MAP: Record<string, LucideIcon> = {
  Boxes, TrendingUp, TrendingDown, AlertCircle, DollarSign, BarChart3, ShoppingCart,
  Users, Clock, Package, MapPin, Truck, Warehouse, Activity, Calendar, Star,
  Percent, Repeat, CheckCircle2, UserPlus, XCircle, Target, Banknote,
};

export function ItemDashKpiIcon({
  name,
  className,
  style,
}: { name: string; className?: string; style?: React.CSSProperties }) {
  const Icon = ICON_MAP[name] ?? Activity;
  return <Icon className={className} style={style} />;
}

export const ITEM_DASH_KPI_DND_TYPE = "ITEM_DASH_KPI_CARD";
export const ITEM_DASH_WIDGET_DND_TYPE = "ITEM_DASH_WIDGET_CARD";