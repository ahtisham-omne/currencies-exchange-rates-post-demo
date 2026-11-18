/**
 * Bridge between the RMA data model (`mockRMAs`) and the ported attachment
 * components. The RMA interface carries only a thin `{ name }[]` list at the
 * header and per line, so this module widens those into the richer
 * `Attachment` shape the ported tab, cards and preview modal expect, and
 * seeds the rest from `generateAttachments`.
 */

import type { RMA, RMALineItem } from "@/app/data/mockRMAs";
import type { Attachment, FileKind, RMAAttachmentLine } from "./attachmentTypes";
import { generateAttachments } from "./attachmentSeed";

/** Map a file extension onto the icon-colour kind used by the cards. */
export function fileKindFromName(name: string): FileKind {
  const ext = (name.split(".").pop() || "").toLowerCase();
  const map: Record<string, FileKind> = {
    pdf: "pdf",
    xlsx: "xlsx",
    xls: "xlsx",
    csv: "csv",
    doc: "doc",
    docx: "doc",
    png: "png",
    jpg: "jpg",
    jpeg: "jpg",
    gif: "png",
    mp3: "mp3",
    mp4: "mp4",
    dxf: "dxf",
    stl: "stl",
    dwg: "dwg",
    cfg: "cfg",
  };
  return map[ext] ?? "pdf";
}

/** Stable per-RMA index so the same return always seeds the same documents. */
function seedIndexFor(rma: RMA): number {
  let h = 0;
  for (let i = 0; i < rma.rmaNumber.length; i++) h = (h * 31 + rma.rmaNumber.charCodeAt(i)) | 0;
  return Math.abs(h) % 24;
}

/** The slice of each RMA line the Attachments tab reads. */
export function rmaAttachmentLines(rma: RMA): RMAAttachmentLine[] {
  return rma.items.map((li: RMALineItem) => ({
    id: li.id,
    itemCode: li.sku,
    itemName: li.description,
    cancelled: li.approvedQty === 0,
  }));
}

/**
 * Full attachment set for a return: the seeded document set, plus anything
 * the RMA itself carries at the header (folded into the RMA Attachments
 * bucket) and on its lines (folded into Item Attachments).
 */
export function rmaAttachments(rma: RMA): Attachment[] {
  const lines = rmaAttachmentLines(rma);
  const seeded = generateAttachments(seedIndexFor(rma), lines);

  const header: Attachment[] = (rma.attachments ?? []).map((a, i) => ({
    id: `${rma.id}-hdr-${i}`,
    name: a.name,
    size: "—",
    uploadedBy: rma.createdBy,
    date: rma.createdDate,
    category: "rma-docs",
    fileKind: fileKindFromName(a.name),
    inOrder: true,
  }));

  const perLine: Attachment[] = rma.items.flatMap((li, li_i) =>
    (li.attachments ?? []).map((a, i) => ({
      id: `${rma.id}-line-${li_i}-${i}`,
      name: a.name,
      size: "—",
      uploadedBy: rma.createdBy,
      date: rma.createdDate,
      category: "item" as const,
      fileKind: fileKindFromName(a.name),
      lineItemId: li.id,
      inOrder: false,
    })),
  );

  return [...header, ...perLine, ...seeded];
}
