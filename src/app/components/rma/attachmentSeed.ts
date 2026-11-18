/**
 * Attachment seed generator — port of the Purchase Order module's
 * `generateAttachments` helper, with the document set remapped onto the
 * return-authorization domain. Used to populate the RMA Detail Attachments
 * tab so the ported tab lands visibly on first load without waiting for
 * backend wiring.
 */

import type { Attachment, RMAAttachmentLine } from "./attachmentTypes";

/* ── Thumbnail pool for jpg/png attachments ── */
const ATT_PREVIEW_POOL = [
  "https://images.unsplash.com/photo-1581094794329-c8112a89af12?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400",
  "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400",
  "https://images.unsplash.com/photo-1597692493715-cdec61b7dcb4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400",
  "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400",
  "https://images.unsplash.com/photo-1581093588401-fbb62a02f120?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400",
  "https://images.unsplash.com/photo-1576091160550-2173dba999ef?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400",
  "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400",
  "https://images.unsplash.com/photo-1580130732478-4e339fb33746?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400",
  "https://images.unsplash.com/photo-1530026405186-ed1f139313f8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400",
  "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400",
  "https://images.unsplash.com/photo-1554224155-6726b3ff858f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400",
  "https://images.unsplash.com/photo-1518770660439-4636190af475?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400",
];

const PREVIEW = (i: number): string => ATT_PREVIEW_POOL[i % ATT_PREVIEW_POOL.length]!;

function generateAttachments(index: number, _lines: RMAAttachmentLine[]): Attachment[] {
  const rnd = (n: number) => {
    let s = "";
    const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    for (let i = 0; i < n; i++) s += c[Math.floor(Math.random() * c.length)];
    return s;
  };
  const legA = `RTN-${String(index + 1).padStart(3, "0")}`;
  const legB = `RTN-${String(index + 50).padStart(3, "0")}`;
  const owner = ["Sarah Chen", "Michael Rodriguez", "Emily Rios", "David Kowalski"][index % 4]!;

  const atts: Attachment[] = [
    /* ── Return Authorization ── */
    { id: `ATT-${index}-auth1`, name: `Vendor_RMA_Authorization_${rnd(6)}.pdf`, description: "Vendor return authorization, signed copy", size: "1.8 MB", uploadedBy: owner, date: "01/15", category: "authorization", fileKind: "pdf", inOrder: true, tag: "authorization" },
    { id: `ATT-${index}-auth2`, name: `Vendor_Authorization_Email.pdf`, description: "Vendor email confirming the RMA number and return address", size: "340 KB", uploadedBy: owner, date: "01/15", category: "authorization", fileKind: "pdf", inOrder: true, tag: "authorization" },
    { id: `ATT-${index}-auth3`, name: `Return_Request_Form_Signed.pdf`, description: "Internal return request form, approved", size: "2.1 MB", uploadedBy: "Emily Rios", date: "01/18", category: "authorization", fileKind: "pdf", inOrder: false },
    { id: `ATT-${index}-auth4`, name: `Warranty_Terms_Excerpt.pdf`, description: "Warranty clause the return is claimed under", size: "180 KB", uploadedBy: owner, date: "02/02", category: "authorization", fileKind: "pdf", inOrder: false },

    /* ── RMA Attachments ── */
    { id: `ATT-${index}-rma1`, name: `RMA_Summary_v3.pdf`, description: "Return authorization summary, revision 3", size: "2.4 MB", uploadedBy: owner, date: "02/05", category: "rma-docs", fileKind: "pdf", inOrder: true },
    { id: `ATT-${index}-rma2`, name: `Inspection_Report_Incoming.pdf`, description: "Receiving inspection report the return was raised from", size: "890 KB", uploadedBy: "Michael Rodriguez", date: "02/04", category: "rma-docs", fileKind: "pdf", inOrder: true },
    { id: `ATT-${index}-rma3`, name: `Original_Receipt_Copy.pdf`, description: "Copy of the receipt the goods were booked in on", size: "1.1 MB", uploadedBy: owner, date: "01/28", category: "rma-docs", fileKind: "pdf", inOrder: true },
    { id: `ATT-${index}-rma4`, name: `Quality_Hold_Notice.docx`, description: "Quality hold notice raised against the received lot", size: "240 KB", uploadedBy: owner, date: "04/12", category: "rma-docs", fileKind: "doc", inOrder: false },
    { id: `ATT-${index}-rma5`, name: `Damage_Photo_Received_Pallet.jpg`, description: "Damage found on the pallet at receiving", size: "3.6 MB", uploadedBy: owner, date: "04/22", category: "rma-docs", fileKind: "jpg", inOrder: true, previewUrl: PREVIEW(1) },
    { id: `ATT-${index}-rma6`, name: `Discrepancy_Log.xlsx`, description: "Line by line discrepancy log against the receipt", size: "780 KB", uploadedBy: "Michael Rodriguez", date: "05/04", category: "rma-docs", fileKind: "xlsx", inOrder: false },
    { id: `ATT-${index}-rma7`, name: `Serial_Numbers_Returned.csv`, description: "Serial numbers on the units being returned", size: "62 KB", uploadedBy: "Emily Rios", date: "02/04", category: "rma-docs", fileKind: "csv", inOrder: false },

    /* ── Shipping & Logistics ── */
    { id: `ATT-${index}-shp1`, name: `Carrier_Return_Label_${legA}.pdf`, description: "Carrier return label for the first return leg", size: "450 KB", uploadedBy: "David Kowalski", date: "02/12", category: "shipping", fileKind: "pdf", inOrder: true, shipmentId: legA },
    { id: `ATT-${index}-shp2`, name: `Bill_of_Lading_${legA}.pdf`, description: "Bill of lading, carrier signed copy", size: "1.3 MB", uploadedBy: "David Kowalski", date: "02/14", category: "shipping", fileKind: "pdf", inOrder: true, shipmentId: legA },
    { id: `ATT-${index}-shp3`, name: `Packing_Slip_${legA}.pdf`, description: "Packing slip enclosed with the return shipment", size: "380 KB", uploadedBy: owner, date: "02/16", category: "shipping", fileKind: "pdf", inOrder: true, shipmentId: legA },
    { id: `ATT-${index}-shp4`, name: `Sealed_Return_Carton_Photo.jpg`, description: "Photo of the sealed return carton before pickup", size: "4.2 MB", uploadedBy: "David Kowalski", date: "02/15", category: "shipping", fileKind: "jpg", inOrder: false, shipmentId: legA, previewUrl: PREVIEW(3) },
    { id: `ATT-${index}-shp5`, name: `Vendor_Receipt_Confirmation_${legB}.pdf`, description: "Vendor confirmation that the return was received", size: "520 KB", uploadedBy: "David Kowalski", date: "02/18", category: "shipping", fileKind: "pdf", inOrder: true, shipmentId: legB },
    { id: `ATT-${index}-shp6`, name: `Freight_Quote_Return_Leg.pdf`, description: "Freight quote for the return leg", size: "190 KB", uploadedBy: owner, date: "02/17", category: "shipping", fileKind: "pdf", inOrder: false, shipmentId: legB },

    /* ── Credit Notes & Financial ── */
    { id: `ATT-${index}-crd1`, name: `Vendor_Credit_Memo_${rnd(6)}.pdf`, description: "Vendor credit memo settling the return", size: "1.6 MB", uploadedBy: owner, date: "02/18", category: "credit", fileKind: "pdf", inOrder: true },
    { id: `ATT-${index}-crd2`, name: `Restocking_Fee_Breakdown.xlsx`, description: "Restocking fee the vendor deducted from the credit", size: "520 KB", uploadedBy: "Michael Rodriguez", date: "02/20", category: "credit", fileKind: "xlsx", inOrder: false },
    { id: `ATT-${index}-crd3`, name: `Original_Vendor_Invoice_Copy.pdf`, description: "Vendor invoice the credit is applied against", size: "290 KB", uploadedBy: owner, date: "02/22", category: "credit", fileKind: "pdf", inOrder: true },
    { id: `ATT-${index}-crd4`, name: `GL_Reclass_Entry_Snapshot.xlsx`, description: "Reclass entry posted when the goods left the dock", size: "120 KB", uploadedBy: "Michael Rodriguez", date: "04/30", category: "credit", fileKind: "xlsx", inOrder: false },
    { id: `ATT-${index}-crd5`, name: `Credit_Application_Schedule.csv`, description: "Schedule showing how the credit is applied", size: "18 KB", uploadedBy: "Michael Rodriguez", date: "04/15", category: "credit", fileKind: "csv", inOrder: false },

    /* ── Media samples, exercising the inline audio and video preview ── */
    { id: `ATT-${index}-med1`, name: `Vendor_Call_Authorization_Confirmation.mp3`, description: "Recorded call where the vendor confirmed the authorization", size: "412 KB", uploadedBy: owner, date: "02/19", category: "authorization", fileKind: "mp3", inOrder: false, previewUrl: "https://commondatastorage.googleapis.com/codeskulptor-demos/DDR_assets/Kangaroo_MusiQue_-_The_Neverwritten_Role_Playing_Game.mp3" },
    { id: `ATT-${index}-med2`, name: `Return_Dock_Handover.mp4`, description: "Walkaround video of the handover at the return dock", size: "8.4 MB", uploadedBy: "David Kowalski", date: "02/16", category: "shipping", fileKind: "mp4", inOrder: false, shipmentId: legA, previewUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4" },

    /* ── Rejection Attachments ── */
    { id: `ATT-${index}-rej1`, name: `Vendor_Rejection_Notice.pdf`, description: "Vendor notice declining part of the return", size: "310 KB", uploadedBy: owner, date: "03/02", category: "rejection", fileKind: "pdf", inOrder: false, tag: "rejection" },
    { id: `ATT-${index}-rej2`, name: `Rejected_Unit_Condition_Photo.jpg`, description: "Condition of the unit the vendor refused", size: "2.8 MB", uploadedBy: "Emily Rios", date: "03/03", category: "rejection", fileKind: "jpg", inOrder: false, previewUrl: PREVIEW(5) },
  ];

  // Item-level attachments deliberately not seeded here — they come from the
  // shared `rmaItemAttachmentsStore` populated by the line-item picker. The
  // RMA Detail Attachments tab resolves picked IDs against the item library
  // and injects them at render time.
  return atts;
}

export { generateAttachments };
