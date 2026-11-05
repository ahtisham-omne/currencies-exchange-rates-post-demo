/**
 * Attachment seed generator — verbatim port of the Sales-Order-V5
 * `generateAttachments` helper in `so/store.tsx`. Used to populate the
 * PO Detail Attachments tab with the same mock data set the SO detail
 * page ships with, so the ported tab lands visibly on first load
 * without waiting for backend wiring.
 */

import type { Attachment, SOLine, FileKind } from "./types";

/* ── Unsplash thumbnail pool for jpg/png attachments ── */
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

function generateAttachments(index: number, lines: SOLine[]): Attachment[] {
  const rnd = (n: number) => {
    let s = ""; const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    for (let i = 0; i < n; i++) s += c[Math.floor(Math.random() * c.length)];
    return s;
  };
  const shipIds = [`SHP-${String(index + 1).padStart(3, "0")}`, `SHP-${String(index + 50).padStart(3, "0")}`];
  const rep = ["Sarah Chen", "Michael Rodriguez", "Emily Rios", "David Kowalski"][index % 4];
  const atts: Attachment[] = [
    // ── Pre-Sales Documents ──
    { id: `ATT-${index}-ps1`, name: `RFQ-2026-TC-0042_Original_Request.pdf`, description: "Original customer request for quotation", size: "1.8 MB", uploadedBy: rep, date: "01/15", category: "pre-sales", fileKind: "pdf", inOrder: false, tag: "rfq/rfp" },
    { id: `ATT-${index}-ps2`, name: `Fleet_Requirements_Spec.xlsx`, description: "Fleet requirements specification spreadsheet", size: "340 KB", uploadedBy: rep, date: "01/15", category: "pre-sales", fileKind: "xlsx", inOrder: false, tag: "rfq/rfp" },
    { id: `ATT-${index}-ps3`, name: `Technical_Spec_Sheet_v2.pdf`, description: "Technical specification sheet v2", size: "2.1 MB", uploadedBy: "Emily Rios", date: "01/18", category: "pre-sales", fileKind: "pdf", inOrder: false },
    { id: `ATT-${index}-ps4`, name: `Site_Walkthrough_Photo_01.jpg`, description: "Site walkthrough photo from customer location", size: "2.1 MB", uploadedBy: "James Wilson", date: "01/17", category: "pre-sales", fileKind: "jpg", inOrder: false, previewUrl: ATT_PREVIEW_POOL[0] },
    { id: `ATT-${index}-ps5`, name: `Vehicle_Bay_Measurements.png`, description: "Bay layout and measurements", size: "1.4 MB", uploadedBy: "James Wilson", date: "01/17", category: "pre-sales", fileKind: "png", inOrder: false, previewUrl: ATT_PREVIEW_POOL[2] },
    { id: `ATT-${index}-ps6`, name: `Bidder_QA_Summary.docx`, description: "Bidder Q&A summary captured", size: "180 KB", uploadedBy: rep, date: "02/02", category: "pre-sales", fileKind: "doc", inOrder: false },
    { id: `ATT-${index}-ps7`, name: `Equipment_Schedule_Detail.csv`, description: "Detailed equipment schedule", size: "62 KB", uploadedBy: "Emily Rios", date: "02/04", category: "pre-sales", fileKind: "csv", inOrder: false },
    // ── Sales Order Documents ──
    { id: `ATT-${index}-so1`, name: `Sales_Order_Confirmation_v3.pdf`, description: "Sales order confirmation document v3", size: "2.4 MB", uploadedBy: rep, date: "02/05", category: "so-docs", fileKind: "pdf", inOrder: true },
    { id: `ATT-${index}-so2`, name: `Internal_Approval_Sheet.xlsx`, description: "Internal approval sheet with sign-off records", size: "890 KB", uploadedBy: "Michael Rodriguez", date: "02/04", category: "so-docs", fileKind: "xlsx", inOrder: false },
    { id: `ATT-${index}-so3`, name: `Terms_and_Conditions_2026.pdf`, description: "Terms and conditions 2026 edition", size: "1.1 MB", uploadedBy: rep, date: "01/28", category: "so-docs", fileKind: "pdf", inOrder: true },
    { id: `ATT-${index}-so4`, name: `Cover_Letter_Final.docx`, description: "Customer cover letter — final", size: "240 KB", uploadedBy: rep, date: "04/12", category: "so-docs", fileKind: "doc", inOrder: true },
    { id: `ATT-${index}-so5`, name: `Reference_Customer_Photo.jpg`, description: "Reference vehicle delivered to similar customer", size: "3.6 MB", uploadedBy: rep, date: "04/22", category: "so-docs", fileKind: "jpg", inOrder: true, previewUrl: ATT_PREVIEW_POOL[1] },
    { id: `ATT-${index}-so6`, name: `Executive_Summary_v2.pdf`, description: "Executive summary v2", size: "780 KB", uploadedBy: rep, date: "05/04", category: "so-docs", fileKind: "pdf", inOrder: true },
    // ── Fulfillment & Shipping Documents ──
    { id: `ATT-${index}-fs1`, name: `Packing_Slip_${shipIds[0]}.pdf`, description: "Packing slip for first shipment", size: "450 KB", uploadedBy: "David Kowalski", date: "02/12", category: "fulfillment", fileKind: "pdf", inOrder: true, shipmentId: shipIds[0] },
    { id: `ATT-${index}-fs2`, name: `Bill_of_Lading_${shipIds[0]}.pdf`, description: "Bill of lading — carrier signed copy", size: "1.3 MB", uploadedBy: "David Kowalski", date: "02/14", category: "fulfillment", fileKind: "pdf", inOrder: true, shipmentId: shipIds[0] },
    { id: `ATT-${index}-fs3`, name: `Delivery_Note_${shipIds[1]}.pdf`, description: "Delivery note for second shipment", size: "380 KB", uploadedBy: rep, date: "02/16", category: "fulfillment", fileKind: "pdf", inOrder: false, shipmentId: shipIds[1] },
    { id: `ATT-${index}-fs4`, name: `Loaded_Truck_Photo.jpg`, description: "Photo of loaded vehicle on carrier", size: "4.2 MB", uploadedBy: "David Kowalski", date: "02/15", category: "fulfillment", fileKind: "jpg", inOrder: false, shipmentId: shipIds[0], previewUrl: ATT_PREVIEW_POOL[1] },
    { id: `ATT-${index}-fs5`, name: `Proof_of_Delivery_Signed.pdf`, description: "Proof of delivery — signed receipt", size: "520 KB", uploadedBy: "David Kowalski", date: "02/18", category: "fulfillment", fileKind: "pdf", inOrder: true, shipmentId: shipIds[0] },
    { id: `ATT-${index}-fs6`, name: `Carrier_Manifest_Report.pdf`, description: "Carrier manifest report", size: "190 KB", uploadedBy: rep, date: "02/17", category: "fulfillment", fileKind: "pdf", inOrder: false, shipmentId: shipIds[1] },
    // ── Invoices & Financial Documents ──
    { id: `ATT-${index}-inv1`, name: `Invoice_${rnd(6)}.pdf`, description: "Primary invoice for this order", size: "1.6 MB", uploadedBy: rep, date: "02/18", category: "invoices", fileKind: "pdf", inOrder: true },
    { id: `ATT-${index}-inv2`, name: `Credit_Memo_${rnd(5)}.pdf`, description: "Credit memo adjustment document", size: "520 KB", uploadedBy: "Michael Rodriguez", date: "02/20", category: "invoices", fileKind: "pdf", inOrder: false },
    { id: `ATT-${index}-inv3`, name: `Payment_Receipt_${rnd(4)}.pdf`, description: "Payment receipt — bank confirmed", size: "290 KB", uploadedBy: rep, date: "02/22", category: "invoices", fileKind: "pdf", inOrder: true },
    { id: `ATT-${index}-inv4`, name: `AR_Aging_Snapshot.xlsx`, description: "AR aging snapshot at month close", size: "120 KB", uploadedBy: "Michael Rodriguez", date: "04/30", category: "invoices", fileKind: "xlsx", inOrder: false },
    { id: `ATT-${index}-inv5`, name: `Discount_Schedule.csv`, description: "Discount schedule applied to this order", size: "18 KB", uploadedBy: "Michael Rodriguez", date: "04/15", category: "invoices", fileKind: "csv", inOrder: false },
    // ── Media samples — exercise the new audio/video inline preview ──
    { id: `ATT-${index}-med1`, name: `Customer_Call_Order_Confirmation.mp3`, description: "Recorded confirmation call with customer", size: "412 KB", uploadedBy: rep, date: "02/19", category: "so-docs", fileKind: "mp3", inOrder: false, previewUrl: "https://commondatastorage.googleapis.com/codeskulptor-demos/DDR_assets/Kangaroo_MusiQue_-_The_Neverwritten_Role_Playing_Game.mp3" },
    { id: `ATT-${index}-med2`, name: `Loading_Dock_Inspection.mp4`, description: "Walkaround video at the loading dock", size: "8.4 MB", uploadedBy: "David Kowalski", date: "02/16", category: "fulfillment", fileKind: "mp4", inOrder: false, shipmentId: shipIds[0], previewUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4" },
    // ── CAD / 3D samples (exercises inline DXF / STL viewers in the
    //    preview modal). DWG keeps the placeholder fallback per design.
    { id: `ATT-${index}-cad1`, name: `Floor_Plan_Bay_Layout.dxf`, description: "Service bay floor plan — DXF line drawing", size: "85 KB", uploadedBy: "James Wilson", date: "04/25", category: "so-docs", fileKind: "dxf", inOrder: false, previewUrl: "https://raw.githubusercontent.com/gdsestimating/three-dxf/master/sample/floor_plan.dxf" },
    { id: `ATT-${index}-cad2`, name: `Bracket_Mount.stl`, description: "Bracket mount — STL mesh for inspection", size: "62 KB", uploadedBy: "Daniel Adams", date: "04/28", category: "so-docs", fileKind: "stl", inOrder: false, previewUrl: "https://raw.githubusercontent.com/IsaacGuan/PointNet-Plane-Detection/master/test_data/Bunny.stl" },
  ];
  // Item-level attachments deliberately not seeded here — they now come
  // from the shared `poItemAttachmentsStore` populated by the Item Detail
  // modal's picker. The PO Detail Attachments tab resolves picked IDs
  // against the item library and injects them at render time.
  return atts;
}

export { generateAttachments };

