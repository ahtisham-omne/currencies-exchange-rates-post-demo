/**
 * Widget System — barrel export.
 *
 * Import everything from this index:
 *   import { WidgetCard, KpiCard, StockHealthGauge, ... } from "./widgets";
 *
 * Or cherry-pick individual files for maximum portability.
 */

/* ── Utilities ── */
export { FONT, resolveVar, resolveFont, withAlpha } from "./widget-utils";

/* ── Primitives ── */
export { WidgetCard, WidgetHeader, SmallSelect, KpiCard, WidgetControlsContext } from "./widget-primitives";
export type { WidgetSize, WidgetControls } from "./widget-primitives";

/* ── Chart Widgets ── */
export { StockHealthGauge } from "./stock-health-gauge";
export { InventoryTrend } from "./inventory-trend";
export { TransactionActivity } from "./transaction-activity";
export { TopLocations } from "./top-locations";
export { OnHandByUOM } from "./on-hand-by-uom";
export { AcquisitionMix } from "./acquisition-mix";

/* ── New Chart Widgets ── */
export { CountAccuracyTrend } from "./count-accuracy-trend";
export { AgingAnalysis } from "./aging-analysis";
export { AdjustmentSummary } from "./adjustment-summary";
export { ShrinkageBreakdown } from "./shrinkage-breakdown";