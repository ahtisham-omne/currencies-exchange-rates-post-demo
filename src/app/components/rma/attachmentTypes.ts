/**
 * Attachment types for the RMA module — ported from the Purchase Order
 * module's `po/types.tsx` (lines 294-323). The six PO attachment sources
 * are remapped onto their return-authorization equivalents; the shape is
 * otherwise unchanged so the shared attachment cards, preview modal and
 * folder tree work without adaptation.
 */

export type AttachmentCategory =
  | "authorization"
  | "rma-docs"
  | "shipping"
  | "credit"
  | "item"
  | "rejection";

export type FileKind =
  | "pdf"
  | "xlsx"
  | "doc"
  | "cfg"
  | "png"
  | "jpg"
  | "csv"
  | "sheet"
  | "mp3"
  | "mp4"
  | "dxf"
  | "stl"
  | "dwg";

export interface Attachment {
  id: string;
  name: string;
  /** Human-readable description shown on hover tooltip */
  description?: string;
  /** Human-readable size string, for example "2.4 MB" */
  size: string;
  uploadedBy: string;
  date: string;
  category: AttachmentCategory;
  /** The file extension / kind for icon colour coding */
  fileKind: FileKind;
  /** Only for category === "item" — which RMA line this is attached to */
  lineItemId?: string;
  /** Only for category === "shipping" — which return leg this belongs to */
  shipmentId?: string;
  /** Is this attachment marked as "In Return" (eye icon visible) */
  inOrder: boolean;
  /** A small label tag, for example "authorization" */
  tag?: string;
  /** Optional thumbnail preview URL (for png/jpg) shown in the attachment cards */
  previewUrl?: string | null;
  /** Upload-in-progress flag. When true, renders as a shimmer placeholder
   *  card until progress hits 100. */
  uploading?: boolean;
  progress?: number;
}

/**
 * The slice of an RMA line the Attachments tab actually reads. Kept as its
 * own type so the tab does not depend on the full `RMALineItem` shape, and
 * so the create flow (which holds draft lines, not saved ones) can feed the
 * same components.
 */
export interface RMAAttachmentLine {
  id: string;
  itemCode: string;
  itemName: string;
  cancelled: boolean;
}
