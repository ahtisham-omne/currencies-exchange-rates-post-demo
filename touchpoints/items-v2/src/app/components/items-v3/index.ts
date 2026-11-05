// Slice 1a + 1b helpers for the Items V3 fork.
// Kept isolated from the broken `items/` Phase 2 files until Slice 2 lands.
export { OverflowTooltip } from "./OverflowTooltip";
export type { OverflowItem, QuickViewCategory } from "./OverflowTooltip";

export { ItemStatusBadge, getItemStatusDotColor } from "./ItemStatusBadge";
export type { ItemStatus } from "./ItemStatusBadge";

export { TransactionStatusBadge } from "./TransactionStatusBadge";

export { ColumnSelector, ColumnSelectorTrigger } from "./ColumnSelector";
export type { ColumnConfig } from "./ColumnSelector";

export {
  ColumnHeaderMenu,
  ColumnFilterChip,
  ActiveFiltersBar,
  applyColumnFilters,
  createBlankFilter,
  isFilterActive,
  getFilterType,
  getUniqueValues,
} from "./ColumnHeaderMenu";
export type {
  ColumnFilterState,
  FilterType,
  SortConfig,
  SortDirection,
} from "./ColumnHeaderMenu";

export {
  KpiInsightsPanel,
  KpiIcon,
  ALL_KPI_DEFINITIONS,
  DEFAULT_ACTIVE_KPIS,
  computeKpiValue,
} from "./KpiInsightsPanel";
export type { KpiDefinition } from "./KpiInsightsPanel";

export {
  FiltersModal,
  DEFAULT_FILTERS,
  countActiveFilters,
} from "./FiltersModal";
export type { AdvancedFilters } from "./FiltersModal";

export { ItemQuickViewModal, useItemQuickView } from "./ItemQuickViewModal";
export type { ItemQuickViewModalProps } from "./ItemQuickViewModal";

export { InitialAvatar, getInitials, getAvatarTint } from "./InitialAvatar";
export type { InitialAvatarProps } from "./InitialAvatar";

export {
  UserHoverCard,
  UserCell,
  getUserTint,
  getUserInitials,
  getPersonAvatar,
  getContactDetails,
} from "./UserHoverCard";
export type { UserHoverCardProps, UserCellProps } from "./UserHoverCard";

export { UserDetailModal } from "./UserDetailModal";
export type { UserDetailModalProps } from "./UserDetailModal";

export {
  StatusPill,
  getSalesOrderStatusTone,
  getShipmentStatusTone,
  normalizeShipmentStatusLabel,
} from "./StatusPill";
export type { StatusPillProps, StatusTone } from "./StatusPill";

export { ComingSoonEmptyState } from "./ComingSoonEmptyState";

export { LotPill } from "./LotPill";
export {
  AcquisitionPills,
  AcquisitionPill,
  AcquisitionMethodsList,
  PreferredAcquisition,
} from "./AcquisitionPills";
export type { AcquisitionMethod, AcquisitionPillsProps } from "./AcquisitionPills";
