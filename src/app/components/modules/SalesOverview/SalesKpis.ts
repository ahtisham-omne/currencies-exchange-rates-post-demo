// Sales KPI catalog — sibling to ItemDashKpis. Sales-specific semantics.
// Categories: Revenue / Orders / Customers. Tooltips surface the
// secondary detail that legacy KPI cards rendered as a sub-line.

export type SalesKpiCategory = "Revenue" | "Orders" | "Customers";

export interface SalesKpiDef {
  key: string;
  label: string;
  category: SalesKpiCategory;
  iconName: string;
  tooltip?: string;
}

export const SALES_KPI_DEFS: SalesKpiDef[] = [
  // ── Revenue ──
  { key: "total_revenue",     label: "Total Revenue",      category: "Revenue",   iconName: "DollarSign",    tooltip: "Gross sales-order value across the selected period. Includes booked + invoiced revenue." },
  { key: "revenue_at_risk",   label: "Revenue at Risk",    category: "Revenue",   iconName: "TrendingDown",  tooltip: "Open order value flagged by overdue, on-hold, or stockout risk. 3 orders at risk." },
  { key: "avg_order_value",   label: "Avg Order Value",    category: "Revenue",   iconName: "BarChart3",     tooltip: "Total revenue divided by total orders in the selected period." },
  { key: "top_customer_value",label: "Top Customer Value", category: "Revenue",   iconName: "Star",          tooltip: "Revenue contributed by the single highest-spending customer in the selected period." },
  { key: "lost_value",        label: "Lost / Cancelled",   category: "Revenue",   iconName: "XCircle",       tooltip: "Total value of cancelled or lost orders in the selected period." },
  // ── Orders ──
  { key: "total_orders",      label: "Total Orders",       category: "Orders",    iconName: "ShoppingCart",  tooltip: "All sales orders booked in the selected period, regardless of status." },
  { key: "pending_approval",  label: "Pending Approval",   category: "Orders",    iconName: "Clock",         tooltip: "Sales orders awaiting internal approval before fulfillment can proceed." },
  { key: "overdue_orders",    label: "Overdue Orders",     category: "Orders",    iconName: "AlertCircle",   tooltip: "Open orders past their committed ship-by date. Surfaces fulfillment risk." },
  { key: "fulfillment_rate",  label: "Fulfillment Rate",   category: "Orders",    iconName: "CheckCircle2",  tooltip: "Percentage of orders shipped on or before their committed date in the selected period." },
  { key: "quote_to_order",    label: "Quote-to-Order",     category: "Orders",    iconName: "Repeat",        tooltip: "Conversion rate: orders booked divided by quotes issued in the selected period." },
  // ── Customers ──
  { key: "active_customers",  label: "Active Customers",   category: "Customers", iconName: "Users",         tooltip: "Distinct customers with at least one order in the selected period." },
  { key: "new_customers",     label: "New Customers",      category: "Customers", iconName: "UserPlus",      tooltip: "First-time buyers in the selected period." },
];

/** 5 KPIs shown on first load — preserves the legacy Sales KPI strip. */
export const DEFAULT_SALES_KPIS: string[] = [
  "total_revenue",
  "total_orders",
  "pending_approval",
  "overdue_orders",
  "revenue_at_risk",
];

export const SALES_KPI_CATEGORY_ORDER: SalesKpiCategory[] = [
  "Revenue", "Orders", "Customers",
];

/** Compute a value string for a Sales KPI. Mocked — preserves legacy values
 *  for the 5 defaults, fills new catalog KPIs with realistic mock data. */
export function computeSalesKpiValue(
  key: string,
): { value: string; change?: string; changeColor?: string } {
  switch (key) {
    // 5 legacy defaults — values match the previous SalesKpiStrip exactly.
    case "total_revenue":      return { value: "$6,186,595", change: "+12.5%", changeColor: "hsl(var(--success))" };
    case "total_orders":       return { value: "60",         change: "-10.5%", changeColor: "hsl(var(--destructive))" };
    case "pending_approval":   return { value: "14",         change: "+5.1%",  changeColor: "hsl(var(--success))" };
    case "overdue_orders":     return { value: "2",          change: "+15.0%", changeColor: "hsl(var(--destructive))" };
    case "revenue_at_risk":    return { value: "$174,575",   change: "-5.4%",  changeColor: "hsl(var(--success))" };
    // Extended catalog — mocked.
    case "avg_order_value":    return { value: "$103,110",   change: "+8.2%",  changeColor: "hsl(var(--success))" };
    case "top_customer_value": return { value: "$842,300" };
    case "lost_value":         return { value: "$58,400",    change: "-2.1%",  changeColor: "hsl(var(--success))" };
    case "fulfillment_rate":   return { value: "94.5%",      change: "+1.8%",  changeColor: "hsl(var(--success))" };
    case "quote_to_order":     return { value: "32.6%",      change: "+3.4%",  changeColor: "hsl(var(--success))" };
    case "active_customers":   return { value: "47",         change: "+6",     changeColor: "hsl(var(--success))" };
    case "new_customers":      return { value: "9",          change: "+2",     changeColor: "hsl(var(--success))" };
    default:                   return { value: "—" };
  }
}
