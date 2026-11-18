// ─── View in Module Preview Types ─────────────────────────────────────────────

export const OMNE_BLUE = "#4361EE";
export const OMNE_BLUE_LIGHT = "#EEF2FF";
export const OMNE_BLUE_BORDER = "#A5B4FC";

// ─── Preview Data Types ──────────────────────────────────────────────────────

export interface ListingPreviewData {
  type: "listing";
  toolbarButtons: { label: string; highlighted: boolean }[];
  columns: { header: string; highlighted: boolean }[];
  sampleRows: { cells: string[]; rowHighlighted?: boolean }[];
  rowActions?: { label: string; highlighted: boolean }[];
}

export interface DetailPreviewData {
  type: "detail";
  headerTitle: string;
  fields: {
    label: string;
    value: string;
    highlighted: boolean;
    offState: "hidden" | "readonly" | "disabled";
  }[];
  actionButtons?: { label: string; highlighted: boolean }[];
}

export interface SidebarNavPreviewData {
  type: "sidebarNav";
  moduleEntries: { label: string; isTarget: boolean }[];
  pageTitle: string;
}

export interface ActionsMenuPreviewData {
  type: "actionsMenu";
  contextLabel: string;
  actions: { label: string; highlighted: boolean; isDestructive?: boolean }[];
  annotationText?: string;
}

export interface MobilePreviewData {
  type: "mobile";
  appName: string;
  screenElements: {
    label: string;
    highlighted: boolean;
    offState: "hidden" | "disabled";
  }[];
}

export type PreviewData =
  | ListingPreviewData
  | DetailPreviewData
  | SidebarNavPreviewData
  | ActionsMenuPreviewData
  | MobilePreviewData;

export interface ViewInModuleEntry {
  permissionName: string;
  moduleName: string;
  /** Legacy recreation-preview data. Superseded by real screenshots (imageOn/imageOff); optional. */
  previewData?: PreviewData;
  infoNoteOn: string;
  infoNoteOff: string;
  path: string;
  /** Real screenshot of the module with the permission ON. Relative to /public. */
  imageOn?: string;
  /** Real screenshot of the module with the permission OFF (gated element removed). */
  imageOff?: string;
  /** Animated highlight over the relevant element in the ON screenshot (normalized % of the image). */
  hotspotOn?: Hotspot;
  /** Animated highlight over the relevant element in the OFF screenshot. */
  hotspotOff?: Hotspot;
}

/** A highlight region on a screenshot, expressed as percentages (0–100) of the image. */
export interface Hotspot {
  left: number;
  top: number;
  width: number;
  height: number;
}
