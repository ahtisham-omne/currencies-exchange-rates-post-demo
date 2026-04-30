import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type {
  SalesOrder, SOLine, SOStatus, Shipment, ShipmentStatus, ShipmentLine,
  WarehouseInventory, Allocation, CatalogItem, ActivityEntry, InventoryMovement,
  LinkedTransaction, Attachment, AttachmentCategory, FileKind, SalesRep, PickRecord,
  SOPriority, SOVersion, ShipmentMethod,
  ProcurementOrder, ProcurementItem, ProcurementStatus, BackorderRecord, BackorderStatus, SourcingStatus,
} from "./types";
import { ARCHIVABLE_STATES } from "./types";

// ===== Mock Catalog =====
export const CATALOG: CatalogItem[] = [
  { code: "000-100-001", name: "Cutaway cab-chassis with 178\" wheelbase, 10,360 GVWR, 3.5L EcoBoost V6 turbocharged engine with 10-speed automatic transmission, factory ambulance prep package includes heavy-duty alternator (240A), auxiliary idle control, and reinforced rear frame section for modular body mounting", description: "Heavy-duty ambulance chassis", type: "Serialized", unitPrice: 42500, category: "Base Vehicles", inStock: 3 },
  { code: "000-100-002", name: "E-450 stripped chassis, 176\" WB, 7.3L V8 gas engine, dual rear wheels, 16,000 GVWR, heavy-duty front and rear stabilizer bars, ambulance prep with reinforced frame rails, upgraded 210A alternator, engine block heater, and transmission PTO provision for hydraulic equipment", description: "Ambulance prep with reinforced frame", type: "Serialized", unitPrice: 48200, category: "Base Vehicles", inStock: 117 },
  { code: "000-100-003", name: "ProMaster 3500 extended 159\" WB, high-roof body, front-wheel drive, 3.6L Pentastar V6 with 9-speed automatic, ambulance chassis package includes upgraded suspension with load-leveling rear air springs, heavy-duty brakes, and dual battery system with smart isolator relay", description: "3.6L Pentastar ambulance chassis", type: "Serialized", unitPrice: 39800, category: "Base Vehicles", inStock: 64 },
  { code: "000-100-026", name: "54\" full-size LED lightbar with 16 independently addressable modules in red/white split pattern for ambulance application, integrated alley lights and takedown floods, 62 programmable flash patterns with traffic advisor mode, low-profile aerodynamic housing with UV-stabilized polycarbonate lens, conformal-coated electronics rated IP67", description: "Integrated alley/takedown lights, programmable flash patterns", type: "Non-Serialized", unitPrice: 3250, category: "Lighting", inStock: 156 },
  { code: "000-100-041", name: "200-watt electronic siren amplifier with integrated PA system, includes wail, yelp, phaser, and hi-lo tone selections with configurable priority override, radio rebroadcast input for simultaneous PA and radio operation, backlit tactile controls with night-mode dimming, meets SAE J1849 and KKK-A-1822F specifications", description: "Radio rebroadcast input, backlit controls", type: "Non-Serialized", unitPrice: 685, category: "Audio", inStock: 89 },
  { code: "000-100-049", name: "Multi-band P25 Phase II digital mobile radio covering VHF (136-174 MHz), UHF (380-512 MHz), 700 MHz, and 800 MHz bands with TDMA technology, AES-256 and DES-OFB encryption, integrated GPS receiver with location reporting, Bluetooth 5.0, Over-The-Air Programming (OTAP) ready, built-in IP packet data modem for AVL and messaging", description: "AES 256 encryption, GPS, Bluetooth, OTAP ready", type: "Serialized", unitPrice: 7850, category: "Communications", inStock: 45 },
  { code: "000-100-059", name: "Powered hydraulic stretcher with 700 lb patient capacity, battery-operated lift mechanism with proportional hydraulic control, auto-loading base with isokinetic lowering system, compatible with Power-LOAD cot fastener, Fowler/Trendelenburg positioning, retractable head section, IV pole mount, integrated CPR platform, antimicrobial powder-coated aluminum frame with stainless steel components", description: "Auto-loading with isokinetic lowering, Power-LOAD compatible", type: "Serialized", unitPrice: 18500, category: "Patient Care", inStock: 23 },
  { code: "000-100-079", name: "Automatic shoreline power inlet with auto-eject on engine start, 20A/125V marine-grade weatherproof connector with corrosion-resistant stainless steel housing, includes integrated GFCI protection, LED status indicator for shore power connection state, and auto-transfer relay that switches between shore and inverter power sources without interrupting patient compartment equipment", description: "Weatherproof marine-grade connector", type: "Lot Controlled", unitPrice: 1250, category: "Electrical", inStock: 200 },
  { code: "000-100-171", name: "Complete body preparation, prime, paint, and graphics installation labor package including surface prep with DA sanding and chemical etching, high-build epoxy primer with moisture barrier, base coat/clear coat in Imron polyurethane with UV protection, full agency decal/stripe/Chevron graphics per customer-supplied artwork and NFPA 1901 retroreflective markings", description: "Complete vehicle finishing service", type: "Non-Serialized", unitPrice: 5200, category: "Services", inStock: 999 },
  { code: "000-100-175", name: "8-hour on-site operator training session covering all installed vehicle systems including chassis operation, emergency lighting and siren controls, HVAC and climate management, electrical distribution panels, patient compartment equipment orientation, radio programming basics, Power-LOAD stretcher loading/unloading procedures with hands-on practicals and written competency assessment", description: "Patient compartment equipment orientation", type: "Non-Serialized", unitPrice: 1500, category: "Services", inStock: 999 },
];

// ===== Mock Inventory =====
const initialInventory: WarehouseInventory[] = [
  { warehouse: "Main Warehouse", itemCode: "000-100-001", onHand: 3, reserved: 0, serialNumbers: [{ serial: "SN-001-A1", available: true }, { serial: "SN-001-A2", available: true }, { serial: "SN-001-A3", available: true }] },
  { warehouse: "Main Warehouse", itemCode: "000-100-002", onHand: 117, reserved: 0, serialNumbers: Array.from({ length: 10 }, (_, i) => ({ serial: `SN-002-${String.fromCharCode(65 + i)}${i + 1}`, available: true })) },
  { warehouse: "Main Warehouse", itemCode: "000-100-003", onHand: 64, reserved: 0, serialNumbers: Array.from({ length: 10 }, (_, i) => ({ serial: `SN-003-${String.fromCharCode(65 + i)}${i + 1}`, available: true })) },
  { warehouse: "Main Warehouse", itemCode: "000-100-026", onHand: 156, reserved: 0 },
  { warehouse: "Main Warehouse", itemCode: "000-100-041", onHand: 89, reserved: 0 },
  { warehouse: "Main Warehouse", itemCode: "000-100-049", onHand: 45, reserved: 0, serialNumbers: Array.from({ length: 10 }, (_, i) => ({ serial: `SN-049-${String.fromCharCode(65 + i)}${i + 1}`, available: true })) },
  { warehouse: "Main Warehouse", itemCode: "000-100-059", onHand: 23, reserved: 0, serialNumbers: Array.from({ length: 10 }, (_, i) => ({ serial: `SN-059-${String.fromCharCode(65 + i)}${i + 1}`, available: true })) },
  { warehouse: "Main Warehouse", itemCode: "000-100-079", onHand: 200, reserved: 0, lots: [{ lotNumber: "LOT-079-2025A", qty: 80, reserved: 0 }, { lotNumber: "LOT-079-2025B", qty: 70, reserved: 0 }, { lotNumber: "LOT-079-2026A", qty: 50, reserved: 0 }] },
  { warehouse: "Main Warehouse", itemCode: "000-100-171", onHand: 999, reserved: 0 },
  { warehouse: "Main Warehouse", itemCode: "000-100-175", onHand: 999, reserved: 0 },
  { warehouse: "East Hub", itemCode: "000-100-002", onHand: 30, reserved: 0, serialNumbers: Array.from({ length: 10 }, (_, i) => ({ serial: `SN-002-E${i + 1}`, available: true })) },
  { warehouse: "East Hub", itemCode: "000-100-026", onHand: 50, reserved: 0 },
  { warehouse: "East Hub", itemCode: "000-100-041", onHand: 40, reserved: 0 },
  { warehouse: "East Hub", itemCode: "000-100-079", onHand: 100, reserved: 0, lots: [{ lotNumber: "LOT-079-E2025", qty: 60, reserved: 0 }, { lotNumber: "LOT-079-E2026", qty: 40, reserved: 0 }] },
  { warehouse: "West Depot", itemCode: "000-100-001", onHand: 5, reserved: 0, serialNumbers: Array.from({ length: 5 }, (_, i) => ({ serial: `SN-001-W${i + 1}`, available: true })) },
  { warehouse: "West Depot", itemCode: "000-100-049", onHand: 20, reserved: 0, serialNumbers: Array.from({ length: 10 }, (_, i) => ({ serial: `SN-049-W${i + 1}`, available: true })) },
  { warehouse: "West Depot", itemCode: "000-100-059", onHand: 15, reserved: 0, serialNumbers: Array.from({ length: 10 }, (_, i) => ({ serial: `SN-059-W${i + 1}`, available: true })) },
];

// ===== Mock SOs =====
/**
 * Shipment data is generated AFTER SOs so that line IDs and quantities are consistent.
 * Populated by buildShipmentsForSOs() below.
 */
function generateMockShipments(): Shipment[] {
  // Placeholder — overwritten by buildShipmentsForSOs after SO generation
  return [];
}

/**
 * Build shipments that accurately match SO line data.
 *
 * Rules:
 * - Shipped SOs: ALL active line quantities must be covered → no Create Shipment button
 * - Partially Shipped SOs: SOME quantities covered, remaining unfulfilled → Create Shipment shows
 * - Cleared SOs w/ shipments: shipments in early stages (preparing/picking)
 */
function buildShipmentsForSOs(sos: SalesOrder[]): { shipments: Shipment[]; refs: Record<string, string[]> } {
  const shipments: Shipment[] = [];
  const refs: Record<string, string[]> = {};

  for (const so of sos) {
    const effectiveStatus = so.status === "Archived" ? (so.previousStatus || "Shipped") : so.status;
    const activeLines = so.lines.filter(l => !l.cancelled);

    if (effectiveStatus === "Shipped") {
      // Fully shipped — cover all quantities across 1-2 shipments
      const shipId1 = `SHIP-${so.id}-A`;
      const shipId2 = `SHIP-${so.id}-B`;
      const splitAt = activeLines.length > 3 ? Math.ceil(activeLines.length / 2) : activeLines.length;
      const batch1 = activeLines.slice(0, splitAt);
      const batch2 = activeLines.slice(splitAt);

      shipments.push({
        id: shipId1,
        shipmentNumber: `SH-${so.soNumber.replace(/SO-000-000-/, "")}A`,
        status: "Shipped",
        shipmentType: "Standard",
        lines: batch1.map((l, li) => ({
          id: `SHL-${so.id}-A-${li}`, soId: so.id, soLineId: l.id,
          allocationId: l.allocations[0]?.id || `ALLOC-${l.id}-0`,
          itemCode: l.itemCode, itemName: l.itemName,
          selectedQty: l.orderedQty, pickedQty: l.orderedQty, shippedQty: l.orderedQty,
          pickLocation: "Aisle B, Rack 3, Shelf 2", stagedLocation: "Dock A - Bay 2",
        })),
        createdDate: so.orderDate,
        warehouse: so.warehouse,
        trackingCode: `1Z${so.id.replace(/-/g, "")}${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        carrier: "UPS", shippingMode: "LTL Freight",
        shipDate: so.orderDate,
        estimatedDelivery: so.requestedDeliveryDate,
        shipFrom: "1200 Industrial Pkwy, Main Warehouse, Columbus, OH 43204",
        shipTo: so.shippingAddress,
        assignedTo: "Marcus Chen", assignedToInitials: "MC",
        confirmedBy: "Diana Reyes", confirmedByInitials: "DR",
        driverName: "Tony Mitchell",
        pickupLocation: "Conversion Plant - OH",
      });
      refs[so.id] = [shipId1];

      if (batch2.length > 0) {
        shipments.push({
          id: shipId2,
          shipmentNumber: `SH-${so.soNumber.replace(/SO-000-000-/, "")}B`,
          status: "Shipped",
          shipmentType: "Split",
          lines: batch2.map((l, li) => ({
            id: `SHL-${so.id}-B-${li}`, soId: so.id, soLineId: l.id,
            allocationId: l.allocations[0]?.id || `ALLOC-${l.id}-0`,
            itemCode: l.itemCode, itemName: l.itemName,
            selectedQty: l.orderedQty, pickedQty: l.orderedQty, shippedQty: l.orderedQty,
            pickLocation: "Aisle D, Rack 1, Shelf 4", stagedLocation: "Dock B - Bay 1",
          })),
          createdDate: so.orderDate,
          warehouse: so.warehouse,
          trackingCode: `794${so.id.replace(/-/g, "")}${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
          carrier: "FedEx", shippingMode: "FTL Freight",
          shipDate: so.orderDate,
          estimatedDelivery: so.requestedDeliveryDate,
          shipFrom: "4500 Logistics Ave, East Hub, Newark, NJ 07102",
          shipTo: so.shippingAddress,
          assignedTo: "James Park", assignedToInitials: "JP",
          confirmedBy: "Sarah Chen", confirmedByInitials: "SC",
          driverName: "Robert Davis",
        });
        refs[so.id].push(shipId2);
      }

    } else if (effectiveStatus === "Partially Shipped") {
      // Partial — create shipments that match the SO line shippedQty values
      const shippedLines = activeLines.filter(l => l.shippedQty > 0);
      const unshippedWithAlloc = activeLines.filter(l => l.shippedQty === 0 && l.allocatedQty > 0);
      const shipId = `SHIP-${so.id}-P`;
      const shipIds: string[] = [];

      // Shipment A: covers all lines that have been shipped
      if (shippedLines.length > 0) {
        shipments.push({
          id: shipId,
          shipmentNumber: `SH-${so.soNumber.replace(/SO-000-000-/, "")}A`,
          status: "Shipped",
          shipmentType: "Split",
          lines: shippedLines.map((l, li) => ({
            id: `SHL-${so.id}-P-${li}`, soId: so.id, soLineId: l.id,
            allocationId: l.allocations[0]?.id || `ALLOC-${l.id}-0`,
            itemCode: l.itemCode, itemName: l.itemName,
            selectedQty: l.shippedQty, pickedQty: l.shippedQty, shippedQty: l.shippedQty,
            pickLocation: "Aisle A, Rack 2, Shelf 1", stagedLocation: "Dock A - Bay 1",
          })),
          createdDate: so.orderDate,
          warehouse: so.warehouse,
          trackingCode: `9400${so.id.replace(/-/g, "")}${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
          carrier: "R+L Carriers", shippingMode: "LTL Freight",
          shipDate: so.orderDate,
          estimatedDelivery: so.requestedDeliveryDate,
          shipFrom: "1200 Industrial Pkwy, Main Warehouse, Columbus, OH 43204",
          shipTo: so.shippingAddress,
          assignedTo: "Emily Rios", assignedToInitials: "ER",
          confirmedBy: "Marcus Chen", confirmedByInitials: "MC",
          driverName: "Jake Sullivan",
          pickupLocation: "Conversion Plant - OH",
        });
        shipIds.push(shipId);
      }

      // Shipment B: lines with allocation but not yet shipped → "In Progress"
      if (unshippedWithAlloc.length > 0) {
        const secondShipId = `SHIP-${so.id}-Q`;
        const prepLine = unshippedWithAlloc[0];
        const prepQty = Math.max(1, Math.floor(prepLine.allocatedQty / 2));
        shipments.push({
          id: secondShipId,
          shipmentNumber: `SH-${so.soNumber.replace(/SO-000-000-/, "")}B`,
          status: "In Progress",
          shipmentType: "Split",
          lines: [{
            id: `SHL-${so.id}-Q-0`, soId: so.id, soLineId: prepLine.id,
            allocationId: prepLine.allocations[0]?.id || `ALLOC-${prepLine.id}-0`,
            itemCode: prepLine.itemCode, itemName: prepLine.itemName,
            selectedQty: prepQty, pickedQty: Math.floor(prepQty / 2), shippedQty: 0,
            pickLocation: "Aisle C, Rack 5, Shelf 3",
          }],
          createdDate: so.orderDate,
          warehouse: so.warehouse,
          carrier: "R+L Carriers", shippingMode: "LTL Freight",
          estimatedDelivery: so.requestedDeliveryDate,
          shipFrom: "1200 Industrial Pkwy, Main Warehouse, Columbus, OH 43204",
          shipTo: so.shippingAddress,
          assignedTo: "James Park", assignedToInitials: "JP",
          pickupLocation: "Conversion Plant - OH",
        });
        shipIds.push(secondShipId);
      }

      if (shipIds.length > 0) refs[so.id] = shipIds;
    }
  }

  return { shipments, refs };
}

function generateLinkedTransactions(index: number, _soId: string, total: number, soNumber: string, reps: string[], status: SOStatus): LinkedTransaction[] {
  const rep = reps[index % reps.length];
  const ri = rep.split(" ").map(w => w[0]).join("");
  const txns: LinkedTransaction[] = [];

  /* ── Source Documents ── */
  if (index % 3 === 0 || index % 2 === 0) {
    txns.push({ id: `LT-${index}-q`, type: "Quote", number: `Q-2026-${String(index).padStart(4, "0")}`, description: `EMS Fleet (Phase ${1 + (index % 3)})`, date: `02/${String(5 + (index % 20)).padStart(2, "0")}/2026`, status: "Converted", amount: total, createdBy: rep, createdByInitials: ri });
  }
  if (index % 4 === 0) {
    txns.push({ id: `LT-${index}-ct`, type: "Contract", number: `CTR-2026-${String(index + 20).padStart(4, "0")}`, description: "Master Supply Agreement — Annual", date: `01/${String(10 + (index % 18)).padStart(2, "0")}/2026`, status: "Active", amount: 0, createdBy: rep, createdByInitials: ri });
  }

  /* ── Fulfillment Transactions ── */
  if (status !== "Draft" && status !== "Cleared") {
    const r3 = reps[(index + 2) % reps.length];
    const r3i = r3.split(" ").map(w => w[0]).join("");
    txns.push({ id: `LT-${index}-pk`, type: "Pick Ticket", number: `PKT-2026-${String(index * 2 + 10).padStart(4, "0")}`, description: "Warehouse Pick — Chassis Components", date: `02/${String(10 + (index % 15)).padStart(2, "0")}/2026`, status: ["Partially Shipped"].includes(status) ? "In Progress" : "Completed", amount: 0, createdBy: r3, createdByInitials: r3i, reference: `via ${soNumber}` });
  }
   if (["Shipped", "Partially Shipped"].includes(status)) {
    const r3 = reps[(index + 2) % reps.length];
    const r3i = r3.split(" ").map(w => w[0]).join("");
    txns.push({ id: `LT-${index}-sh`, type: "Shipment", number: `SHP-2026-${String(index * 2 + 34).padStart(4, "0")}`, description: "Chassis & Modules Shipment", date: `02/${String(12 + (index % 15)).padStart(2, "0")}/2026`, status: status === "Partially Shipped" ? "Shipped" : "Shipped", amount: Math.round(total * 0.65), createdBy: r3, createdByInitials: r3i, reference: `via ${soNumber}` });
  }
  if (status === "Shipped") {
    const r3 = reps[(index + 2) % reps.length];
    const r3i = r3.split(" ").map(w => w[0]).join("");
    txns.push({ id: `LT-${index}-dc`, type: "Delivery Confirmation", number: `DLV-2026-${String(index + 50).padStart(4, "0")}`, description: "Final Delivery — Customer Site", date: `02/${String(18 + (index % 8)).padStart(2, "0")}/2026`, status: "Delivered", amount: 0, createdBy: r3, createdByInitials: r3i, reference: `via SHP-2026-${String(index * 2 + 34).padStart(4, "0")}` });
  }

  /* ── Financial Transactions ── */
  if (status !== "Draft" && index % 2 === 0) {
    const r2 = reps[(index + 1) % reps.length];
    const r2i = r2.split(" ").map(w => w[0]).join("");
    txns.push({ id: `LT-${index}-inv1`, type: "Invoice", number: `INV-2026-${String(index * 3).padStart(4, "0")}`, description: "Phase 1 Deposit (50%)", date: `02/${String(11 + (index % 15)).padStart(2, "0")}/2026`, status: "Invoiced", amount: Math.round(total * 0.5), createdBy: r2, createdByInitials: r2i, reference: `via ${soNumber}` });
  }
  if (status !== "Draft" && index % 4 === 0) {
    const r2 = reps[(index + 1) % reps.length];
    const r2i = r2.split(" ").map(w => w[0]).join("");
    txns.push({ id: `LT-${index}-inv2`, type: "Invoice", number: `INV-2026-${String(index * 3 + 1).padStart(4, "0")}`, description: "Phase 1 Final Balance", date: `02/${String(16 + (index % 10)).padStart(2, "0")}/2026`, status: "Draft", amount: Math.round(total * 0.5), createdBy: r2, createdByInitials: r2i, reference: `via ${soNumber}` });
  }
  if (index % 5 === 0 && status !== "Draft") {
    txns.push({ id: `LT-${index}-pmt`, type: "Payment Receipt", number: `PMT-2026-${String(index + 78).padStart(4, "0")}`, description: "Wire Transfer — Phase 1 Deposit", date: `02/${String(13 + (index % 14)).padStart(2, "0")}/2026`, status: "Paid", amount: Math.round(total * 0.5), createdBy: rep, createdByInitials: ri, reference: `via INV-2026-${String(index * 3).padStart(4, "0")}` });
  }
  if (index % 3 === 0 && status !== "Draft") {
    txns.push({ id: `LT-${index}-pmt2`, type: "Payment Receipt", number: `PMT-2026-${String(index + 95).padStart(4, "0")}`, description: "ACH Payment — Partial Balance", date: `02/${String(19 + (index % 7)).padStart(2, "0")}/2026`, status: "Partially Paid", amount: Math.round(total * 0.25), createdBy: rep, createdByInitials: ri, reference: `via INV-2026-${String(index * 3 + 1).padStart(4, "0")}` });
  }
  if (index % 7 === 0 && status !== "Draft") {
    txns.push({ id: `LT-${index}-cm`, type: "Credit Memo", number: `CM-2026-${String(index + 12).padStart(4, "0")}`, description: "Pricing Adjustment — Volume Discount", date: `02/${String(14 + (index % 13)).padStart(2, "0")}/2026`, status: "Issued", amount: Math.round(total * 0.02), createdBy: rep, createdByInitials: ri, reference: `via ${soNumber}` });
  }
  return txns;
}

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
    { id: `ATT-${index}-ps1`, name: `DOC-${rnd(5)}.pdf`, description: "Original customer request for quotation", size: "1.8 MB", uploadedBy: rep, date: "01/15", category: "pre-sales", fileKind: "pdf", inOrder: false, tag: "rfq/rfp" },
    { id: `ATT-${index}-ps2`, name: `RPT-${rnd(6)}.xlsx`, description: "Fleet requirements specification spreadsheet", size: "340 KB", uploadedBy: rep, date: "01/15", category: "pre-sales", fileKind: "xlsx", inOrder: false, tag: "rfq/rfp" },
    { id: `ATT-${index}-ps3`, name: `TSS-${rnd(4)}.pdf`, description: "Technical specification sheet v2", size: "2.1 MB", uploadedBy: "Emily Rios", date: "01/18", category: "pre-sales", fileKind: "pdf", inOrder: false },
    // ── Sales Order Documents ──
    { id: `ATT-${index}-so1`, name: `CNF-${rnd(5)}.pdf`, description: "Sales order confirmation document v3", size: "2.4 MB", uploadedBy: rep, date: "02/05", category: "so-docs", fileKind: "pdf", inOrder: true },
    { id: `ATT-${index}-so2`, name: `APR-${rnd(4)}.xlsx`, description: "Internal approval sheet with sign-off records", size: "890 KB", uploadedBy: "Michael Rodriguez", date: "02/04", category: "so-docs", fileKind: "xlsx", inOrder: false },
    { id: `ATT-${index}-so3`, name: `TNC-${rnd(5)}.pdf`, description: "Terms and conditions 2026 edition", size: "1.1 MB", uploadedBy: rep, date: "01/28", category: "so-docs", fileKind: "pdf", inOrder: true },
    // ── Fulfillment & Shipping Documents ──
    { id: `ATT-${index}-fs1`, name: `PKS-${rnd(5)}.pdf`, description: "Packing slip for first shipment", size: "450 KB", uploadedBy: "David Kowalski", date: "02/12", category: "fulfillment", fileKind: "pdf", inOrder: true, shipmentId: shipIds[0] },
    { id: `ATT-${index}-fs2`, name: `BOL-${rnd(6)}.pdf`, description: "Bill of lading — carrier signed copy", size: "1.3 MB", uploadedBy: "David Kowalski", date: "02/14", category: "fulfillment", fileKind: "pdf", inOrder: true, shipmentId: shipIds[0] },
    { id: `ATT-${index}-fs3`, name: `DNT-${rnd(4)}.pdf`, description: "Delivery note for second shipment", size: "380 KB", uploadedBy: rep, date: "02/16", category: "fulfillment", fileKind: "pdf", inOrder: false, shipmentId: shipIds[1] },
    { id: `ATT-${index}-fs4`, name: `SCE-${rnd(5)}.pdf`, description: "Shipping confirmation email export", size: "210 KB", uploadedBy: "Emily Rios", date: "02/15", category: "fulfillment", fileKind: "pdf", inOrder: false, shipmentId: shipIds[1] },
    { id: `ATT-${index}-fs5`, name: `POD-${rnd(4)}.pdf`, description: "Proof of delivery — signed receipt", size: "520 KB", uploadedBy: "David Kowalski", date: "02/18", category: "fulfillment", fileKind: "pdf", inOrder: true, shipmentId: shipIds[0] },
    { id: `ATT-${index}-fs6`, name: `CMR-${rnd(5)}.pdf`, description: "Carrier manifest report", size: "190 KB", uploadedBy: rep, date: "02/17", category: "fulfillment", fileKind: "pdf", inOrder: false, shipmentId: shipIds[1] },
    // ── Invoices & Financial Documents ──
    { id: `ATT-${index}-inv1`, name: `INV-${rnd(6)}.pdf`, description: "Primary invoice for this order", size: "1.6 MB", uploadedBy: rep, date: "02/18", category: "invoices", fileKind: "pdf", inOrder: true },
    { id: `ATT-${index}-inv2`, name: `CMO-${rnd(5)}.pdf`, description: "Credit memo adjustment document", size: "520 KB", uploadedBy: "Michael Rodriguez", date: "02/20", category: "invoices", fileKind: "pdf", inOrder: false },
    { id: `ATT-${index}-inv3`, name: `RCP-${rnd(4)}.pdf`, description: "Payment receipt — bank confirmed", size: "290 KB", uploadedBy: rep, date: "02/22", category: "invoices", fileKind: "pdf", inOrder: true },
  ];
  // Pre-Sales item-level sub-attachments
  const preSalesItemDescs = ["Quote breakdown for this line item", "Supplier pricing data for item", "Compliance datasheet from vendor"];
  lines.filter(l => !l.cancelled).slice(0, 3).forEach((line, li) => {
    const fk2: FileKind = li % 2 === 0 ? "pdf" : "xlsx";
    const sz2 = `${(Math.random() * 3 + 0.4).toFixed(1)} MB`;
    atts.push({ id: `ATT-${index}-psi${li}`, name: `${["QBK","SPD","CMP"][li % 3]}-${rnd(4)}.${fk2}`, description: preSalesItemDescs[li % 3], size: sz2, uploadedBy: li % 2 === 0 ? rep : "Emily Rios", date: `01/${String(16 + (li % 5)).padStart(2, "0")}`, category: "pre-sales", fileKind: fk2, lineItemId: line.id, inOrder: false });
  });
  // Item Attachments
  const itemDescs = ["Compliance checklist for this item", "Module specifications and drawings", "Warranty certificate — extended coverage", "Programming template configuration file"];
  lines.filter(l => !l.cancelled).slice(0, 4).forEach((line, li) => {
    const fk3: FileKind = li === 3 ? "cfg" : "pdf";
    const sz3 = ["3.2 MB", "4.7 MB", "520 KB", "1.8 MB"][li % 4];
    atts.push({ id: `ATT-${index}-it${li}`, name: `${["CHK","MDS","WRC","CFG"][li % 4]}-${rnd(4)}.${fk3}`, description: itemDescs[li % 4], size: sz3, uploadedBy: li % 2 === 0 ? rep : "Emily Rios", date: `01/${String(22 + (li % 6)).padStart(2, "0")}`, category: "item" as const, fileKind: fk3, lineItemId: line.id, inOrder: li < 2 });
  });
  return atts;
}

// ===== Sourcing & Production mock data generator =====

const SOURCING_VENDORS = [
  { name: "Wheeled Coach Industries", initials: "WC" },
  { name: "Federal Signal Corp", initials: "FS" },
  { name: "Stryker Medical", initials: "SM" },
  { name: "Whelen Engineering", initials: "WE" },
  { name: "Motorola Solutions", initials: "MS" },
  { name: "Braun Ambulances", initials: "BA" },
  { name: "REV Group Inc", initials: "RG" },
  { name: "Demers Ambulances", initials: "DA" },
];

function generateSourcingData(
  index: number,
  lines: SOLine[],
  status: SOStatus,
  previousStatus?: SOStatus,
  orderDate?: string,
): { procurementOrders: ProcurementOrder[]; backorders: BackorderRecord[]; sourcingStatus: SourcingStatus } {
  const effectiveStatus = status === "Archived" ? (previousStatus || "Shipped") : status;

  // Draft & Cancelled → no sourcing
  if (effectiveStatus === "Draft" || effectiveStatus === "Cancelled") {
    return { procurementOrders: [], backorders: [], sourcingStatus: "N/A" };
  }

  const activeLines = lines.filter(l => !l.cancelled && l.allocatedQty > 0);
  if (activeLines.length < 2) {
    return { procurementOrders: [], backorders: [], sourcingStatus: "N/A" };
  }

  const pos: ProcurementOrder[] = [];
  const bos: BackorderRecord[] = [];

  // --- Build PO groups (pair lines into POs for variety) ---
  const groups: SOLine[][] = [];
  let cur: SOLine[] = [];
  // Only ~70% of active lines need procurement (the rest are "in stock")
  const procLines = activeLines.filter((_, li) => li % 3 !== 2);
  procLines.forEach((l, li) => {
    cur.push(l);
    if (cur.length >= 2 || li === procLines.length - 1) {
      groups.push([...cur]);
      cur = [];
    }
  });

  // Status distribution per SO status
  const statusByStage: Record<string, ProcurementStatus[]> = {
    "Pending Review": ["Draft", "Submitted", "Draft", "Submitted"],
    "Cleared":        ["Submitted", "Acknowledged", "Submitted", "Partially Received"],
    "Partially Shipped": ["Acknowledged", "Partially Received", "Received", "Partially Received"],
    "Shipped":        ["Received", "Received", "Received", "Received"],
  };
  const statusPool = statusByStage[effectiveStatus] || ["Submitted", "Acknowledged", "Partially Received", "Received"];

  groups.forEach((group, gi) => {
    const vendor = SOURCING_VENDORS[(index * 3 + gi) % SOURCING_VENDORS.length];
    const poStatus = statusPool[gi % statusPool.length];
    const receivedPct =
      poStatus === "Received" ? 100
      : poStatus === "Partially Received" ? (30 + ((index * 7 + gi * 13) % 50))
      : poStatus === "Acknowledged" ? 0
      : 0;

    const items: ProcurementItem[] = group.map(l => {
      const orderedQty = Math.max(1, Math.ceil(l.allocatedQty * (0.4 + (((index + gi) % 5) * 0.1))));
      const receivedQty =
        poStatus === "Received" ? orderedQty
        : poStatus === "Partially Received" ? Math.max(1, Math.floor(orderedQty * receivedPct / 100))
        : 0;
      return {
        soLineId: l.id,
        itemCode: l.itemCode,
        itemName: l.itemName,
        orderedQty,
        receivedQty,
        unitCost: Math.round(l.unitPrice * (0.55 + ((index % 4) * 0.05))),
      };
    });

    const monthNum = 1 + ((index + gi) % 12);
    const dayOrd = 5 + (gi * 3 % 23);
    const dayExp = 15 + (gi * 5 % 14);

    pos.push({
      id: `po-${index}-${gi}`,
      poNumber: `PO-2026-${String(4200 + index * 10 + gi).padStart(4, "0")}`,
      vendor: vendor.name,
      vendorInitials: vendor.initials,
      status: poStatus,
      soLineIds: group.map(l => l.id),
      items,
      orderedDate: `${String(monthNum).padStart(2, "0")}/${String(dayOrd).padStart(2, "0")}/2026`,
      expectedDate: poStatus === "Received"
        ? `${String(monthNum).padStart(2, "0")}/${String(dayExp).padStart(2, "0")}/2026`
        : `${String(Math.min(12, monthNum + 1)).padStart(2, "0")}/${String(dayExp).padStart(2, "0")}/2026`,
      totalAmount: items.reduce((s, it) => s + it.orderedQty * it.unitCost, 0),
      receivedPct,
    });
  });

  // --- Build backorders (subset of lines with simulated shortfalls) ---
  const boStatusByStage: Record<string, BackorderStatus[]> = {
    "Pending Review": ["Pending", "Pending", "Pending"],
    "Cleared": ["Pending", "On Order", "On Order"],
    "Partially Shipped": ["On Order", "Partially Fulfilled", "On Order", "Fulfilled"],
    "Shipped": ["Fulfilled", "Fulfilled", "Fulfilled"],
  };
  const boPool = boStatusByStage[effectiveStatus] || ["Pending", "On Order"];

  // ~30-50% of active lines get backorders depending on stage
  const boFreq = effectiveStatus === "Shipped" ? 4 : 3;
  activeLines.forEach((l, li) => {
    if ((li + index) % boFreq !== 0) return;
    const boStatus = boPool[li % boPool.length];
    const backorderedQty = Math.max(1, Math.ceil((l.orderedQty - l.allocatedQty) * 0.5) || Math.ceil(l.orderedQty * 0.15));
    const matchingPO = pos.find(po => po.soLineIds.includes(l.id));

    bos.push({
      id: `bo-${index}-${li}`,
      soLineId: l.id,
      itemCode: l.itemCode,
      itemName: l.itemName,
      backorderedQty,
      allocatedQty: l.allocatedQty,
      status: boStatus,
      linkedPONumber: (boStatus === "On Order" || boStatus === "Partially Fulfilled" || boStatus === "Fulfilled")
        ? (matchingPO?.poNumber || `PO-2026-${String(4200 + index * 10 + li).padStart(4, "0")}`)
        : null,
      expectedDate: boStatus === "Pending" ? null
        : boStatus === "Fulfilled" ? `${String(1 + ((index + li) % 12)).padStart(2, "0")}/${String(10 + (li * 3 % 18)).padStart(2, "0")}/2026`
        : `${String(Math.min(12, 2 + ((index + li) % 11))).padStart(2, "0")}/${String(15 + (li % 14)).padStart(2, "0")}/2026`,
      createdDate: orderDate || `01/${String(10 + (index % 18)).padStart(2, "0")}/2026`,
    });
  });

  // Derive sourcing status
  let sourcingStatus: SourcingStatus = "N/A";
  if (pos.length > 0) {
    const allReceived = pos.every(po => po.status === "Received");
    const anyReceived = pos.some(po => po.status === "Received" || po.status === "Partially Received");
    if (allReceived && bos.every(bo => bo.status === "Fulfilled")) {
      sourcingStatus = "Fully Sourced";
    } else if (anyReceived) {
      sourcingStatus = "Partially Sourced";
    } else {
      sourcingStatus = "Sourcing";
    }
  } else if ((effectiveStatus as string) === "Draft") {
    sourcingStatus = "Not Started";
  }

  return { procurementOrders: pos, backorders: bos, sourcingStatus };
}

function generateMockSOs(): SalesOrder[] {
  const customers = [
    { name: "Metro City Fire & Rescue", initials: "MC" },
    { name: "Tri-County EMS Authority", initials: "TE" },
    { name: "Lakewood Community Hospital", initials: "LC" },
    { name: "Pinecrest Volunteer Fire Dept", initials: "PV" },
    { name: "Summit Regional Medical Center", initials: "SR" },
    { name: "Eagle County Sheriff's Office", initials: "EC" },
    { name: "Pacific Northwest Ambulance", initials: "PN" },
    { name: "Riverside Utility District", initials: "RU" },
    { name: "Heartland Air Ambulance", initials: "HA" },
    { name: "Great Plains Fire Protection", initials: "GP" },
    { name: "Coastal Search & Rescue", initials: "CS" },
    { name: "Valley Health Systems", initials: "VH" },
    { name: "Northern Plains Medical Transport", initials: "NP" },
    { name: "Bay Area Critical Care", initials: "BA" },
    { name: "Appalachian Rescue Teams", initials: "AR" },
  ];
  // Wide range of statuses including Archived entries
  const statuses: (SOStatus | { status: SOStatus; previousStatus?: SOStatus })[] = [
    "Draft",
    "Draft",
    "Pending Review",
    "Cleared",
    "Cleared",
    "Partially Shipped",
    "Shipped",
    "Shipped",
    "Shipped",
    "Cancelled",
    "Cleared",
    "Cleared",
    "Partially Shipped",
    "Shipped",
    "Shipped",
    "Shipped",
    "Pending Review",
    "Partially Shipped",
    { status: "Archived", previousStatus: "Shipped" },
    { status: "Archived", previousStatus: "Cancelled" },
    { status: "Archived", previousStatus: "Shipped" },
    "Draft",
    "Pending Review",
    "Cleared",
    "Shipped",
    "Partially Shipped",
    "Cancelled",
    { status: "Archived", previousStatus: "Shipped" },
    { status: "Archived", previousStatus: "Cancelled" },
    "Partially Cancelled",
    "Partially Cancelled",
    "Partially Cancelled",
  ];
  const reps = ["Sarah Lindquist", "Michael Tran", "Emily Rios", "David Kowalski", "Jessica Mbeki", "Robert Navarro", "Amanda Chen", "James Hatfield"];
  const freightMethods = ["FOB Origin", "FOB Destination", "CIF", "FCA", "EXW", "DAP"];
  const tagPool = ["fleet-build", "government", "rush", "grant-funded", "multi-year", "demo-unit", "trade-in", "warranty-ext", "custom-paint", "remote-area"];
  const addresses = [
    "1420 Industrial Blvd, Suite 200, Denver, CO 80216",
    "890 Commerce Dr, Portland, OR 97201",
    "3300 Lake Shore Dr, Chicago, IL 60657",
    "2100 Pacific Coast Hwy, Malibu, CA 90265",
    "555 Emergency Services Rd, Phoenix, AZ 85034",
    "1800 First Responder Way, Seattle, WA 98101",
  ];
  const sos: SalesOrder[] = [];
  // shipmentRefs will be populated after SO generation by buildShipmentsForSOs
  const shipmentRefs: Record<string, string[]> = {};
  for (let i = 0; i < 30; i++) {
    const cust = customers[i % customers.length];
    const statusEntry = statuses[i % statuses.length];
    const status = typeof statusEntry === "string" ? statusEntry : statusEntry.status;
    const previousStatus = typeof statusEntry === "object" ? statusEntry.previousStatus : undefined;
    const lineCount = 2 + (i % 5);
    const lines: SOLine[] = [];
    for (let j = 0; j < lineCount; j++) {
      const item = CATALOG[(i + j) % CATALOG.length];
      const orderedQty = item.type === "Serialized" ? 1 + (j % 3) : 3 + (j * 2);
      const isPendingConfirm = status === "Pending Review";
      const effectiveStatus = status === "Archived" ? (previousStatus || "Shipped") : status;
      const isPartiallyCancelledSO = status === "Partially Cancelled";
      const shipped = effectiveStatus === "Shipped" ? orderedQty : effectiveStatus === "Partially Shipped" ? Math.floor(orderedQty / 2) : 0;
      const delivered = effectiveStatus === "Shipped" ? orderedQty : effectiveStatus === "Partially Shipped" ? Math.floor(orderedQty / 2) : 0;
      const allocated = ["Pending Review", "Cleared", "Shipped", "Partially Shipped", "Partially Cancelled"].includes(effectiveStatus)
        ? orderedQty
        : 0;
      const picked = ["Shipped", "Partially Shipped"].includes(effectiveStatus) ? shipped : 0;
      // Add some cancelled lines for variety — but NOT for partially shipped orders (they need meaningful partial cancellation)
      const isPartiallyShippedSO = effectiveStatus === "Partially Shipped";
      // For Partially Cancelled SOs: cancel the last 1-2 lines, keep others active
      const isCancelledLine = isPartiallyCancelledSO
        ? (j >= lineCount - 1 - (i % 2)) // cancel last 1 or 2 lines
        : status === "Cancelled" || (!isPartiallyShippedSO && ((i === 5 && j === lineCount - 1) || (i === 17 && j >= 2)));
      const lineAllocated = isCancelledLine && status !== "Cancelled" ? 0 : allocated;
      const isReadyToPick = lineAllocated > 0 && !isCancelledLine && ["Cleared", "Shipped", "Partially Shipped"].includes(effectiveStatus);
      lines.push({
        id: `SOL-${i}-${j}`,
        itemCode: item.code,
        itemName: item.name,
        itemType: item.type,
        warehouse: j % 3 === 2 ? "East Hub" : "Main Warehouse",
        orderedQty,
        allocatedQty: lineAllocated,
        pickedQty: isCancelledLine ? 0 : picked,
        shippedQty: isCancelledLine && status !== "Cancelled" ? 0 : shipped,
        deliveredQty: isCancelledLine ? 0 : delivered,
        unitPrice: item.unitPrice,
        taxRate: 0.08,
        allocations: (!isCancelledLine && lineAllocated > 0) ? (() => {
          const wh = j % 3 === 2 ? "East Hub" : "Main Warehouse";
          const baseAlloc: Allocation = { id: `ALLOC-${i}-${j}-0`, warehouse: wh, qty: lineAllocated, locked: shipped > 0 };
          if (item.type === "Serialized") {
            baseAlloc.serialNumbers = Array.from({ length: lineAllocated }, (_, si) => `SN-${item.code.slice(-3)}-${String.fromCharCode(65 + ((i + j + si) % 26))}${i * 10 + si + 1}`);
          }
          if (item.type === "Lot Controlled") {
            baseAlloc.lotNumber = `LOT-${item.code.slice(-3)}-${2025 + Math.floor(i / 15)}${String.fromCharCode(65 + (j % 3))}`;
          }
          if (lineAllocated > 4 && j % 2 === 0) {
            const qty1 = Math.ceil(lineAllocated / 2);
            const qty2 = lineAllocated - qty1;
            const wh2 = wh === "Main Warehouse" ? "East Hub" : "Main Warehouse";
            const alloc1: Allocation = { ...baseAlloc, qty: qty1 };
            const alloc2: Allocation = { id: `ALLOC-${i}-${j}-1`, warehouse: wh2, qty: qty2, locked: shipped > 0 };
            if (item.type === "Serialized") {
              alloc1.serialNumbers = baseAlloc.serialNumbers?.slice(0, qty1);
              alloc2.serialNumbers = baseAlloc.serialNumbers?.slice(qty1);
            }
            if (item.type === "Lot Controlled") {
              alloc1.lotNumber = baseAlloc.lotNumber;
              alloc2.lotNumber = `LOT-${item.code.slice(-3)}-${2025 + Math.floor(i / 15)}${String.fromCharCode(65 + ((j + 1) % 3))}`;
            }
            return [alloc1, alloc2];
          }
          return [baseAlloc];
        })() : [],
        cancelled: isCancelledLine,
        cancelledReason: isCancelledLine ? (status === "Cancelled" ? "Full SO cancellation" : "Customer requested removal") : undefined,
        cancelledQty: isCancelledLine ? orderedQty : 0,
        readyToPick: isReadyToPick,
      });
    }
    // ── Add a duplicate-itemCode line for SO-000 and SO-002 to showcase the "Duplicate of #N" badge ──
    if (i === 0 || i === 2) {
      const dupSource = lines[1]; // duplicate the 2nd line
      lines.push({
        ...dupSource,
        id: `SOL-${i}-dup`,
        itemName: `Same module spec as line 2 but configured as bariatric-ready variant with 96" interior width option, reinforced stretcher rail, upgraded HVAC unit`,
        orderedQty: 1,
        unitPrice: Math.round(dupSource.unitPrice * 1.08),
        allocations: [],
        allocatedQty: 0,
        pickedQty: 0,
        shippedQty: 0,
        deliveredQty: 0,
        cancelled: false,
        cancelledReason: undefined,
        cancelledQty: 0,
        readyToPick: false,
      });
    }
    const total = lines.reduce((s, l) => s + l.orderedQty * l.unitPrice * (1 + l.taxRate), 0);
    const soId = `SO-${String(i).padStart(3, "0")}`;

    // Generate richer activity logs
    const activityLog: ActivityEntry[] = [
      { id: `ACT-${i}-0`, timestamp: `2025/${String(1 + (i % 12)).padStart(2, "0")}/10 09:00`, user: reps[i % reps.length], action: "Created", details: "Sales Order created" },
      { id: `ACT-${i}-1`, timestamp: `2025/${String(1 + (i % 12)).padStart(2, "0")}/10 09:05`, user: reps[i % reps.length], action: "Updated", details: "Added line items" },
    ];
    if (status !== "Draft") {
      activityLog.push({ id: `ACT-${i}-2`, timestamp: `2025/${String(1 + (i % 12)).padStart(2, "0")}/11 10:00`, user: reps[i % reps.length], action: "Cleared", details: "Sales Order cleared — ready for shipping" });
    }
    if (["Pending Review", "Cleared", "Shipped", "Partially Shipped"].includes(status === "Archived" ? (previousStatus || "") : status)) {
      activityLog.push({ id: `ACT-${i}-3`, timestamp: `2025/${String(1 + (i % 12)).padStart(2, "0")}/13 14:30`, user: reps[(i + 1) % reps.length], action: "Allocated", details: "Inventory allocated for all active lines" });
    }
    if (status === "Cancelled") {
      activityLog.push({ id: `ACT-${i}-4`, timestamp: `2025/${String(1 + (i % 12)).padStart(2, "0")}/14 16:00`, user: reps[i % reps.length], action: "Cancelled", details: "Sales Order cancelled — unshipped reservations released" });
    }
    if (status === "Archived") {
      activityLog.push({ id: `ACT-${i}-5`, timestamp: `2025/${String(1 + (i % 12)).padStart(2, "0")}/20 11:00`, user: reps[i % reps.length], action: "Archived", details: `Sales Order archived from ${previousStatus} state` });
    }

    // Generate inventory movements for non-draft orders
    const inventoryMovements: InventoryMovement[] = [];
    if (status !== "Draft") {
      lines.filter(l => l.allocatedQty > 0).forEach((l, mi) => {
        inventoryMovements.push({
          id: `MOV-${i}-${mi}-0`, type: "Reserve", qty: l.allocatedQty, warehouse: l.warehouse,
          reference: `Allocated for ${l.id}`, timestamp: `2025/${String(1 + (i % 12)).padStart(2, "0")}/13 14:30`, itemCode: l.itemCode,
        });
      });
      if (status === "Shipped" || (status === "Archived" && (previousStatus === "Shipped"))) {
        lines.filter(l => l.shippedQty > 0).forEach((l, mi) => {
          inventoryMovements.push({
            id: `MOV-${i}-${mi}-1`, type: "Issue", qty: l.shippedQty, warehouse: l.warehouse,
            reference: `Shipped via shipment`, timestamp: `2025/${String(1 + (i % 12)).padStart(2, "0")}/18 09:00`, itemCode: l.itemCode,
          });
        });
      }
      if (status === "Cancelled") {
        lines.filter(l => l.cancelled).forEach((l, mi) => {
          inventoryMovements.push({
            id: `MOV-${i}-${mi}-2`, type: "Release", qty: l.orderedQty, warehouse: l.warehouse,
            reference: "SO Cancelled — allocation released", timestamp: `2025/${String(1 + (i % 12)).padStart(2, "0")}/14 16:00`, itemCode: l.itemCode,
          });
        });
      }
    }

    // Generate pick records for orders that have picking activity
    const pickers = ["David Kowalski", "James Hatfield", "Robert Navarro", "Amanda Chen"];
    const pickerInitials = pickers.map(p => p.split(" ").map(w => w[0]).join(""));
    const locations = ["Aisle A1, Rack 2, Bin 5", "Aisle B3, Rack 4, Bin 12", "Aisle C2, Rack 1, Bin 8", "Aisle D5, Rack 3, Bin 1", "Aisle A4, Rack 6, Bin 3"];
    const pickRecords: PickRecord[] = [];
    const effectiveForPick = status === "Archived" ? (previousStatus || "Shipped") : status;
    if (["Shipped", "Partially Shipped"].includes(effectiveForPick)) {
      lines.filter(l => !l.cancelled && l.pickedQty > 0).forEach((l, pi) => {
        const pickerIdx = (i + pi) % pickers.length;
        const locIdx = (i + pi) % locations.length;
        // Split into 1-2 pick records for variety
        if (l.pickedQty > 2 && pi % 3 === 0) {
          const half = Math.floor(l.pickedQty / 2);
          pickRecords.push({
            id: `PICK-${i}-${pi}-0`, soLineId: l.id, itemCode: l.itemCode, itemName: l.itemName,
            pickedQty: half, pickedBy: pickers[pickerIdx], pickedByInitials: pickerInitials[pickerIdx],
            pickedAt: `2025/${String(1 + (i % 12)).padStart(2, "0")}/14 10:${String(15 + pi).padStart(2, "0")}`,
            warehouse: l.warehouse, location: locations[locIdx], allocationId: l.allocations[0]?.id || "",
          });
          pickRecords.push({
            id: `PICK-${i}-${pi}-1`, soLineId: l.id, itemCode: l.itemCode, itemName: l.itemName,
            pickedQty: l.pickedQty - half, pickedBy: pickers[(pickerIdx + 1) % pickers.length], pickedByInitials: pickerInitials[(pickerIdx + 1) % pickers.length],
            pickedAt: `2025/${String(1 + (i % 12)).padStart(2, "0")}/14 14:${String(30 + pi).padStart(2, "0")}`,
            warehouse: l.warehouse, location: locations[(locIdx + 1) % locations.length], allocationId: l.allocations[0]?.id || "",
          });
        } else {
          pickRecords.push({
            id: `PICK-${i}-${pi}-0`, soLineId: l.id, itemCode: l.itemCode, itemName: l.itemName,
            pickedQty: l.pickedQty, pickedBy: pickers[pickerIdx], pickedByInitials: pickerInitials[pickerIdx],
            pickedAt: `2025/${String(1 + (i % 12)).padStart(2, "0")}/14 ${String(9 + (pi % 8)).padStart(2, "0")}:${String(10 + pi * 7).padStart(2, "0")}`,
            warehouse: l.warehouse, location: locations[locIdx], allocationId: l.allocations[0]?.id || "",
          });
        }
      });
    }

    // Generate sourcing & production data
    const soOrderDate = `${2025 + Math.floor(i / 15)}/${String(1 + (i % 12)).padStart(2, "0")}/${String(10 + (i % 18)).padStart(2, "0")}`;
    const sourcingData = generateSourcingData(i, lines, status, previousStatus, soOrderDate);

    sos.push({
      id: soId,
      soNumber: `SO-000-000-${String(i).padStart(3, "0")}`,
      customer: cust.name,
      customerInitials: cust.initials,
      orderDate: soOrderDate,
      warehouse: i % 5 === 4 ? "East Hub" : i % 7 === 6 ? "West Depot" : "Main Warehouse",
      currency: "USD",
      paymentTerms: i % 4 === 0 ? "Net 30" : i % 4 === 1 ? "Net 60" : i % 4 === 2 ? "Due on Receipt" : "Net 45",
      shippingAddress: addresses[i % addresses.length],
      status,
      previousStatus,
      description: `Sales order for ${cust.name} — ${lineCount} line items`,
      lines,
      shipmentIds: shipmentRefs[soId] || [],
      activityLog,
      inventoryMovements,
      linkedTransactions: generateLinkedTransactions(i, soId, total, `SO-000-000-${String(i).padStart(3, "0")}`, reps, status),
      attachments: generateAttachments(i, lines),
      pickRecords,
      salesRep: reps[i % reps.length],
      createdDate: `2025/${String(1 + (i % 12)).padStart(2, "0")}/10`,
      total,
      /* ── Deal Information fields ── */
      sourceQuoteRef: i % 3 !== 1 ? `Q-000-${String(100 + i).padStart(3, "0")}-${String(i * 3 + 1).padStart(3, "0")}` : "",
      rfqRef: i % 3 === 0 ? `RFQ-${cust.initials}-${2025 + Math.floor(i / 15)}-${String(i + 1).padStart(3, "0")}` : "",
      tags: [tagPool[i % tagPool.length], ...(i % 3 === 0 ? [tagPool[(i + 3) % tagPool.length]] : [])],
      internalNotes: i % 2 === 0 ? `Dock door #${(i % 6) + 1} preferred. Contact warehouse lead before delivery.` : "",
      warehouses: i % 5 === 4
        ? ["East Hub", "Main Warehouse"]
        : i % 7 === 6
          ? ["West Depot"]
          : i % 3 === 0
            ? ["Main Warehouse", "East Hub"]
            : ["Main Warehouse"],
      requestedDeliveryDate: `${2025 + Math.floor(i / 15)}/${String(2 + (i % 11)).padStart(2, "0")}/${String(1 + (i % 28)).padStart(2, "0")}`,
      freightMethod: freightMethods[i % freightMethods.length],
      salesReps: [
        { name: reps[i % reps.length], primary: true },
        ...(i % 3 === 0 ? [{ name: reps[(i + 2) % reps.length], primary: false }, { name: reps[(i + 4) % reps.length], primary: false }] : i % 2 === 0 ? [{ name: reps[(i + 1) % reps.length], primary: false }] : []),
      ],
      /* ── Versioning & Priority ── */
      version: {
        number: 1 + (i % 4),
        label: i % 3 === 0 ? "Last Approved" : "Latest",
        date: `2025/${String(1 + (i % 12)).padStart(2, "0")}/${String(10 + (i % 18)).padStart(2, "0")}`,
      } as SOVersion,
      priority: (["Low", "Standard", "High"] as SOPriority[])[i % 3],
      versions: Array.from({ length: 1 + (i % 4) }, (_, vi) => ({
        number: vi + 1,
        label: (vi === (i % 4) ? (i % 3 === 0 ? "Last Approved" : "Latest") : "Superseded") as SOVersion["label"],
        date: `2025/${String(1 + ((i + vi) % 12)).padStart(2, "0")}/${String(10 + (vi * 3 % 18)).padStart(2, "0")}`,
      })),
      /* ── Sourcing & Production ── */
      procurementOrders: sourcingData.procurementOrders,
      backorders: sourcingData.backorders,
      sourcingStatus: sourcingData.sourcingStatus,
    });
  }
  return sos;
}

/** Build SOs first, then derive accurate shipments and patch shipmentIds */
function initializeMockData(): { sos: SalesOrder[]; shipments: Shipment[] } {
  const rawSOs = generateMockSOs();
  const { shipments, refs } = buildShipmentsForSOs(rawSOs);
  // Patch shipmentIds into each SO
  const sos = rawSOs.map(so => ({
    ...so,
    shipmentIds: refs[so.id] || [],
  }));
  return { sos, shipments };
}

const _initData = initializeMockData();

// ===== Validation helpers =====
export interface ConfirmValidation {
  valid: boolean;
  errors: string[];
}

export function validateForConfirmation(so: SalesOrder): ConfirmValidation {
  const errors: string[] = [];
  if (so.status !== "Pending Review" && so.status !== "Draft") errors.push("SO must be in Draft or Pending Review status to clear.");
  if (!so.customer || so.customer.trim().length === 0) errors.push("Customer is required.");
  const activeLines = so.lines.filter(l => !l.cancelled);
  if (activeLines.length === 0) errors.push("At least one active line item is required.");
  if (!so.shippingAddress || so.shippingAddress.trim().length === 0) errors.push("Shipping address is required.");
  return { valid: errors.length === 0, errors };
}

/** Detect over-allocation on a single line */
export function getLineOverAllocation(line: SOLine): number {
  if (line.cancelled) return 0;
  return Math.max(0, line.allocatedQty - line.orderedQty);
}

/** Check if SO has any over-allocated lines */
export function hasOverAllocation(so: SalesOrder): boolean {
  return so.lines.some(l => !l.cancelled && l.allocatedQty > l.orderedQty);
}

// ===== Store Context =====
interface SOStore {
  salesOrders: SalesOrder[];
  shipments: Shipment[];
  inventory: WarehouseInventory[];
  // SO Actions (closeSO removed)
  createSO: (so: Partial<SalesOrder>) => SalesOrder;
  updateSO: (id: string, updates: Partial<SalesOrder>) => void;
  markUnconfirmed: (id: string) => void;
  confirmSO: (id: string) => ConfirmValidation;
  cancelSO: (id: string, reason?: string, reasonText?: string) => void;
  cancelSOLines: (soId: string, lineIds: string[], reason?: string, cancelQtys?: Record<string, number>) => void;
  deliverSO: (id: string, deliveryQtys?: Record<string, number>) => void;
  archiveSO: (id: string) => void;
  unarchiveSO: (id: string) => void;
  reactivateSO: (id: string) => void;
  createVersionDraft: (id: string) => void;
  addSOLine: (soId: string, line: Partial<SOLine>) => void;
  updateSOLine: (soId: string, lineId: string, updates: Partial<SOLine>) => void;
  deleteSOLine: (soId: string, lineId: string) => boolean;
  // Allocation
  allocate: (soId: string, lineId: string, allocations: Allocation[]) => boolean;
  deallocate: (soId: string, lineId: string, allocationId: string) => void;
  // Shipments
  createShipment: (soId: string, lines: { soLineId: string; allocationId: string; qty: number }[], warehouse: string, method?: ShipmentMethod, carrier?: string, pickupLocation?: string) => Shipment | null;
  updateShipmentStatus: (shipmentId: string, status: ShipmentStatus) => void;
  updateShipmentLinePicked: (shipmentId: string, lineId: string, pickedQty: number) => void;
  deleteShipment: (shipmentId: string) => void;
  reverseShipment: (shipmentId: string) => void;
  // Inventory
  getAvailable: (warehouse: string, itemCode: string) => number;
  getInventoryForItem: (itemCode: string) => WarehouseInventory[];
  // Derivation
  deriveSOStatus: (so: SalesOrder) => SOStatus;
}

const SOContext = createContext<SOStore | null>(null);

export function useSOStore(): SOStore {
  const ctx = useContext(SOContext);
  if (!ctx) throw new Error("useSOStore must be used within SOStoreProvider");
  return ctx;
}

let shipmentCounter = 105;
let soCounter = 30;

export function SOStoreProvider({ children }: { children: ReactNode }) {
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>(() => _initData.sos);
  const [shipments, setShipments] = useState<Shipment[]>(() => _initData.shipments);
  const [inventory, setInventory] = useState<WarehouseInventory[]>(initialInventory);

  // ===== Status Derivation =====
  // Pipeline: Draft → Pending Review → Cleared → Partially Shipped → Shipped
  // Shipped is the final successful state. Closed is an administrative wrap-up.
  const deriveSOStatus = useCallback((so: SalesOrder): SOStatus => {
    // Terminal/manual states are sticky
    if (so.status === "Draft" || so.status === "Cancelled" || so.status === "Archived") return so.status;
    // Partially Cancelled is sticky — some lines cancelled, others still active
    if (so.status === "Partially Cancelled") return "Partially Cancelled";
    
    const activeLines = so.lines.filter(l => !l.cancelled);
    if (activeLines.length === 0) return so.status;
    
    // Shipped: all units shipped
    const allShipped = activeLines.every(l => l.shippedQty >= l.orderedQty);
    if (allShipped) return "Shipped";
    
    // Partially Shipped: some units shipped
    const anyShipped = activeLines.some(l => l.shippedQty > 0);
    if (anyShipped) return "Partially Shipped";
    
    // Pending Review: not yet cleared
    if (so.status === "Pending Review") return "Pending Review";
    // Cleared with allocations ready for shipping
    return "Cleared";
  }, []);

  const addActivity = (so: SalesOrder, action: string, details: string): ActivityEntry => ({
    id: `ACT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toLocaleString(),
    user: "Current User",
    action,
    details,
  });

  const addMovement = (_so: SalesOrder, type: InventoryMovement["type"], qty: number, warehouse: string, reference: string, itemCode: string, extra?: Partial<InventoryMovement>): InventoryMovement => ({
    id: `MOV-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    qty,
    warehouse,
    reference,
    timestamp: new Date().toLocaleString(),
    itemCode,
    ...extra,
  });

  const updateInventoryReserve = (warehouse: string, itemCode: string, qtyDelta: number, lotNumber?: string) => {
    setInventory(prev => prev.map(inv => {
      if (inv.warehouse !== warehouse || inv.itemCode !== itemCode) return inv;
      const updated = { ...inv, reserved: inv.reserved + qtyDelta };
      if (lotNumber && updated.lots) {
        updated.lots = updated.lots.map(l => l.lotNumber === lotNumber ? { ...l, reserved: l.reserved + qtyDelta } : l);
      }
      return updated;
    }));
  };

  const updateInventoryOnHand = (warehouse: string, itemCode: string, qtyDelta: number) => {
    setInventory(prev => prev.map(inv => {
      if (inv.warehouse !== warehouse || inv.itemCode !== itemCode) return inv;
      return { ...inv, onHand: inv.onHand + qtyDelta };
    }));
  };

  const markSerialsAvailability = (warehouse: string, itemCode: string, serials: string[], available: boolean) => {
    setInventory(prev => prev.map(inv => {
      if (inv.warehouse !== warehouse || inv.itemCode !== itemCode || !inv.serialNumbers) return inv;
      return {
        ...inv,
        serialNumbers: inv.serialNumbers.map(sn => serials.includes(sn.serial) ? { ...sn, available } : sn),
      };
    }));
  };

  const recalcSOStatus = (so: SalesOrder): SalesOrder => {
    const newStatus = deriveSOStatus(so);
    return { ...so, status: newStatus };
  };

  // ===== releaseLineAllocations — shared helper for cancellation =====
  const releaseLineAllocations = (line: SOLine) => {
    const unshippedAllocs = line.allocations.filter(a => !a.locked);
    unshippedAllocs.forEach(a => {
      if (a.qty > 0) {
        updateInventoryReserve(a.warehouse, line.itemCode, -a.qty, a.lotNumber);
        if (a.serialNumbers) markSerialsAvailability(a.warehouse, line.itemCode, a.serialNumbers, true);
      }
    });
  };

  // ===== SO Actions =====
  const createSO = useCallback((partial: Partial<SalesOrder>): SalesOrder => {
    const id = `SO-${String(soCounter++).padStart(3, "0")}`;
    const incomingLines = (partial.lines || []).map((l, j) => ({
      ...l,
      id: l.id || `SOL-${Date.now()}-${j}-${Math.random().toString(36).slice(2, 6)}`,
      allocatedQty: l.allocatedQty ?? 0,
      pickedQty: l.pickedQty ?? 0,
      shippedQty: l.shippedQty ?? 0,
      deliveredQty: l.deliveredQty ?? 0,
      taxRate: l.taxRate ?? 0.08,
      allocations: l.allocations ?? [],
      cancelled: l.cancelled ?? false,
      cancelledQty: l.cancelledQty ?? 0,
      readyToPick: l.readyToPick ?? false,
    }));
    const total = incomingLines.length > 0
      ? incomingLines.reduce((s, l) => s + l.orderedQty * l.unitPrice * (1 + l.taxRate), 0)
      : (partial.total || 0);
    const so: SalesOrder = {
      id,
      soNumber: `SO-000-000-${id.split("-")[1]}`,
      customer: partial.customer || "",
      customerInitials: partial.customerInitials || (partial.customer || "").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase(),
      orderDate: partial.orderDate || new Date().toISOString().split("T")[0].replace(/-/g, "/"),
      warehouse: partial.warehouse || "Main Warehouse",
      currency: partial.currency || "USD",
      paymentTerms: partial.paymentTerms || "Net 30",
      shippingAddress: partial.shippingAddress || "",
      status: "Draft",
      description: partial.description || "",
      lines: incomingLines,
      shipmentIds: [],
      activityLog: [
        { id: `ACT-${Date.now()}`, timestamp: new Date().toLocaleString(), user: "Current User", action: "Created", details: "Sales Order created" },
        ...(incomingLines.length > 0 ? [{ id: `ACT-${Date.now()}-l`, timestamp: new Date().toLocaleString(), user: "Current User", action: "Lines Added", details: `${incomingLines.length} line item(s) added during creation` }] : []),
      ],
      inventoryMovements: [],
      linkedTransactions: [],
      attachments: [],
      pickRecords: [],
      salesRep: partial.salesRep || "Current User",
      createdDate: new Date().toISOString().split("T")[0].replace(/-/g, "/"),
      total,
      /* ── Deal Information fields ── */
      sourceQuoteRef: partial.sourceQuoteRef || "",
      rfqRef: partial.rfqRef || "",
      tags: partial.tags || [],
      internalNotes: partial.internalNotes || "",
      warehouses: partial.warehouses || [partial.warehouse || "Main Warehouse"],
      requestedDeliveryDate: partial.requestedDeliveryDate || "",
      freightMethod: partial.freightMethod || "FOB Origin",
      salesReps: partial.salesReps || [{ name: partial.salesRep || "Current User", primary: true }],
      /* ── Versioning & Priority ── */
      version: partial.version || { number: 1, label: "Latest", date: new Date().toISOString().split("T")[0].replace(/-/g, "/") },
      priority: partial.priority || "Standard",
      versions: partial.versions || [{ number: 1, label: "Latest", date: new Date().toISOString().split("T")[0].replace(/-/g, "/") }],
      /* ── Sourcing & Production ── */
      procurementOrders: partial.procurementOrders || [],
      backorders: partial.backorders || [],
      sourcingStatus: partial.sourcingStatus || "Not Started",
    };
    setSalesOrders(prev => [so, ...prev]);
    return so;
  }, []);

  const updateSO = useCallback((id: string, updates: Partial<SalesOrder>) => {
    setSalesOrders(prev => prev.map(so => {
      if (so.id !== id) return so;
      const updated = { ...so, ...updates };
      updated.total = updated.lines.reduce((s, l) => s + l.orderedQty * l.unitPrice * (1 + l.taxRate), 0);
      return updated;
    }));
  }, []);

  // Mark as Pending Review: Draft → Pending Review
  const markUnconfirmed = useCallback((id: string) => {
    setSalesOrders(prev => prev.map(s => {
      if (s.id !== id || s.status !== "Draft") return s;
      return {
        ...s,
        status: "Pending Review" as const,
        activityLog: [...s.activityLog, addActivity(s, "Status Change", "Sales Order submitted for review")],
      };
    }));
  }, []);

  // Confirm (Clear): validates then transitions Pending Review → Cleared
  const confirmSO = useCallback((id: string): ConfirmValidation => {
    const so = salesOrders.find(s => s.id === id);
    if (!so) return { valid: false, errors: ["SO not found"] };
    
    const validation = validateForConfirmation(so);
    if (!validation.valid) return validation;
    
    setSalesOrders(prev => prev.map(s => {
      if (s.id !== id || (s.status !== "Draft" && s.status !== "Pending Review")) return s;
      return {
        ...s,
        status: "Cleared" as const,
        activityLog: [...s.activityLog, addActivity(s, "Cleared", "Sales Order cleared — ready for shipping")],
      };
    }));
    return validation;
  }, [salesOrders]);

  // Full Cancellation — cancels all unshipped lines, blocks if all shipped
  const cancelSO = useCallback((id: string, reason?: string, reasonText?: string) => {
    setSalesOrders(prev => prev.map(so => {
      if (so.id !== id) return so;
      if (["Cancelled", "Archived"].includes(so.status)) return so;
      const activeLines = so.lines.filter(l => !l.cancelled);
      const allFullyShipped = activeLines.length > 0 && activeLines.every(l => l.shippedQty >= l.orderedQty);
      if (allFullyShipped) return so;
      
      const movements: InventoryMovement[] = [];
      const reasonStr = reason === "Other" && reasonText ? `${reason}: ${reasonText}` : reason || "Full SO cancellation";
      const clearedLines = so.lines.map(l => {
        if (l.cancelled) return l;
        const unshippedAllocs = l.allocations.filter(a => !a.locked);
        unshippedAllocs.forEach(a => {
          if (a.qty > 0) {
            updateInventoryReserve(a.warehouse, l.itemCode, -a.qty, a.lotNumber);
            if (a.serialNumbers) markSerialsAvailability(a.warehouse, l.itemCode, a.serialNumbers, true);
            movements.push(addMovement(so, "Release", a.qty, a.warehouse, `SO Cancelled — ${reasonStr}`, l.itemCode));
          }
        });
        return {
          ...l,
          allocatedQty: l.allocations.filter(a => a.locked).reduce((s, a) => s + a.qty, 0),
          allocations: l.allocations.filter(a => a.locked),
          cancelled: true,
          cancelledQty: l.orderedQty - l.shippedQty,
          cancelledReason: reasonStr,
        };
      });
      return {
        ...so,
        previousStatus: so.status,
        status: "Cancelled" as const,
        cancellationReason: (reason || undefined) as any,
        cancellationReasonText: reasonText || undefined,
        cancellationRequestedAt: new Date().toISOString(),
        cancellationRequestedBy: "Current User",
        lines: clearedLines,
        activityLog: [...so.activityLog, addActivity(so, "Cancelled",
          `Sales Order cancelled from ${so.status} — reason: ${reasonStr}. Unshipped reservations released.`
        )],
        inventoryMovements: [...so.inventoryMovements, ...movements],
      };
    }));
  }, []);

  // Partial Cancellation — cancel specific lines (with optional qty per line)
  const cancelSOLines = useCallback((soId: string, lineIds: string[], reason?: string, cancelQtys?: Record<string, number>) => {
    setSalesOrders(prev => prev.map(so => {
      if (so.id !== soId) return so;
      if (["Cancelled", "Archived"].includes(so.status)) return so;
      
      const movements: InventoryMovement[] = [];
      const updatedLines = so.lines.map(l => {
        if (!lineIds.includes(l.id) || l.cancelled) return l;
        if (l.shippedQty >= l.orderedQty) return l;
        
        const qtyToCancel = cancelQtys?.[l.id] ?? (l.orderedQty - l.shippedQty);
        const unshippedAllocs = l.allocations.filter(a => !a.locked);
        unshippedAllocs.forEach(a => {
          if (a.qty > 0) {
            updateInventoryReserve(a.warehouse, l.itemCode, -a.qty, a.lotNumber);
            if (a.serialNumbers) markSerialsAvailability(a.warehouse, l.itemCode, a.serialNumbers, true);
            movements.push(addMovement(so, "Release", a.qty, a.warehouse, `Line cancelled: ${l.itemCode}`, l.itemCode));
          }
        });
        
        const isFullLineCancel = qtyToCancel >= (l.orderedQty - l.shippedQty);
        return {
          ...l,
          allocatedQty: l.allocations.filter(a => a.locked).reduce((s, a) => s + a.qty, 0),
          allocations: l.allocations.filter(a => a.locked),
          cancelled: isFullLineCancel,
          cancelledQty: (l.cancelledQty || 0) + qtyToCancel,
          cancelledReason: reason || "Partial cancellation",
        };
      });
      
      const cancelledCount = lineIds.filter(lid => {
        const line = updatedLines.find(l => l.id === lid);
        return line?.cancelled;
      }).length;
      
      // Check if all lines are now cancelled
      const activeRemaining = updatedLines.filter(l => !l.cancelled);
      
      const updated = {
        ...so,
        previousStatus: so.status,
        lines: updatedLines,
        cancellationReason: (reason || so.cancellationReason) as any,
        activityLog: [...so.activityLog, addActivity(so, "Lines Cancelled",
          `${cancelledCount} line(s) cancelled from ${so.status}${reason ? ` — ${reason}` : ""}. Unshipped allocations released.`
        )],
        inventoryMovements: [...so.inventoryMovements, ...movements],
      };
      
      // Determine new status
      if (activeRemaining.length === 0) {
        return { ...updated, status: "Cancelled" as const };
      }
      if (cancelledCount > 0 && activeRemaining.length > 0) {
        return recalcSOStatus({ ...updated, status: "Partially Cancelled" as const });
      }
      return recalcSOStatus(updated);
    }));
  }, [deriveSOStatus]);

  // closeSO removed — "Closed" state no longer exists

  // Deliver: supports partial (per-line qty map) or complete (all shipped → delivered)
  const deliverSO = useCallback((id: string, deliveryQtys?: Record<string, number>) => {
    setSalesOrders(prev => prev.map(so => {
      if (so.id !== id || (so.status !== "Shipped" && so.status !== "Partially Shipped")) return so;
      const isPartial = !!deliveryQtys;
      const updatedLines = so.lines.map(l => {
        if (l.cancelled) return l;
        if (isPartial) {
          const addQty = deliveryQtys[l.id];
          if (addQty === undefined || addQty <= 0) return l;
          return { ...l, deliveredQty: Math.min(l.shippedQty, l.deliveredQty + addQty) };
        }
        // Complete: deliver everything that's been shipped
        return { ...l, deliveredQty: l.shippedQty };
      });
      const activeLines = updatedLines.filter(l => !l.cancelled);
      const allFulfilled = activeLines.every(l => l.deliveredQty >= l.orderedQty);
      const anyDelivered = activeLines.some(l => l.deliveredQty > 0);
      const deliveredCount = isPartial ? Object.values(deliveryQtys!).reduce((s, v) => s + v, 0) : activeLines.reduce((s, l) => s + l.shippedQty, 0);
      const updated = {
        ...so,
        lines: updatedLines,
        activityLog: [...so.activityLog, addActivity(so,
          allFulfilled ? "Shipped" : "Partially Shipped",
          allFulfilled
            ? "All shipments confirmed delivered — order complete"
            : `${deliveredCount} unit(s) confirmed delivered — partial shipment`
        )],
      };
      return recalcSOStatus(updated);
    }));
  }, [deriveSOStatus]);

  // Archive: soft-delete for terminal states
  const archiveSO = useCallback((id: string) => {
    setSalesOrders(prev => prev.map(so => {
      if (so.id !== id) return so;
      if (so.status === "Archived") return so;
      return {
        ...so,
        previousStatus: so.status,
        status: "Archived" as const,
        activityLog: [...so.activityLog, addActivity(so, "Archived", `Sales Order archived from ${so.status} state`)],
      };
    }));
  }, []);

  // Unarchive: restore from archive to previous terminal state
  const unarchiveSO = useCallback((id: string) => {
    setSalesOrders(prev => prev.map(so => {
      if (so.id !== id || so.status !== "Archived") return so;
      const restored = so.previousStatus || "Shipped" as SOStatus;
      return {
        ...so,
        status: restored,
        previousStatus: undefined,
        activityLog: [...so.activityLog, addActivity(so, "Unarchived", `Sales Order restored to ${restored} state`)],
      };
    }));
  }, []);

  // Reactivate: create a new version as Draft from Cancelled or Archived
  const reactivateSO = useCallback((id: string) => {
    setSalesOrders(prev => prev.map(so => {
      if (so.id !== id) return so;
      if (so.status !== "Cancelled" && so.status !== "Partially Cancelled" && so.status !== "Archived") return so;
      const newVersionNum = (so.version?.number ?? 1) + 1;
      const newVersion: SOVersion = { number: newVersionNum, label: "Latest", date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) };
      return {
        ...so,
        status: "Draft" as SOStatus,
        previousStatus: so.status,
        cancellationReason: undefined,
        cancellationReasonText: undefined,
        cancellationRequestedAt: undefined,
        cancellationRequestedBy: undefined,
        version: newVersion,
        versions: [...(so.versions || []), newVersion],
        lines: so.lines.map(l => ({
          ...l,
          cancelled: false,
          cancelledQty: 0,
          cancelledReason: undefined,
          cancelAction: undefined,
        })),
        activityLog: [...so.activityLog, addActivity(so, "Reactivated", `Sales Order reactivated as V${newVersionNum} Draft`)],
      };
    }));
  }, []);

  // Create a new version draft from a non-Draft SO (used by auto-versioning)
  const createVersionDraft = useCallback((id: string) => {
    setSalesOrders(prev => prev.map(so => {
      if (so.id !== id) return so;
      if (so.status === "Draft") return so; // Already draft, no-op
      const newVersionNum = (so.version?.number ?? 1) + 1;
      const newVersion: SOVersion = { number: newVersionNum, label: "Latest", date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) };
      // Mark the current version as "Last Approved" before creating new draft
      const updatedVersions = (so.versions || []).map(v =>
        v.number === so.version?.number ? { ...v, label: "Last Approved" as const } : v
      );
      return {
        ...so,
        status: "Draft" as SOStatus,
        previousStatus: so.status,
        version: newVersion,
        versions: [...updatedVersions, newVersion],
        activityLog: [...so.activityLog, addActivity(so, "Version Created", `Auto-created V${newVersionNum} Draft from ${so.status} — material change detected`)],
      };
    }));
  }, []);

  const addSOLine = useCallback((soId: string, line: Partial<SOLine>) => {
    setSalesOrders(prev => prev.map(so => {
      if (so.id !== soId) return so;
      const newLine: SOLine = {
        id: `SOL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        itemCode: line.itemCode || "",
        itemName: line.itemName || "",
        itemType: line.itemType || "Non-Serialized",
        warehouse: line.warehouse || so.warehouse,
        orderedQty: line.orderedQty || 1,
        allocatedQty: 0,
        pickedQty: 0,
        shippedQty: 0,
        deliveredQty: 0,
        unitPrice: line.unitPrice || 0,
        taxRate: line.taxRate || 0.08,
        allocations: [],
        cancelled: false,
        cancelledQty: 0,
        readyToPick: false,
      };
      const updated = {
        ...so,
        lines: [...so.lines, newLine],
        activityLog: [...so.activityLog, addActivity(so, "Line Added", `Added ${newLine.itemCode}`)],
      };
      updated.total = updated.lines.reduce((s, l) => s + l.orderedQty * l.unitPrice * (1 + l.taxRate), 0);
      return updated;
    }));
  }, []);

  const updateSOLine = useCallback((soId: string, lineId: string, updates: Partial<SOLine>) => {
    setSalesOrders(prev => prev.map(so => {
      if (so.id !== soId) return so;
      const updatedLines = so.lines.map(l => {
        if (l.id !== lineId) return l;
        if (l.cancelled) return l; // can't edit cancelled lines
        // Prevent reducing ordered qty below shipped
        if (updates.orderedQty !== undefined && updates.orderedQty < l.shippedQty) {
          return l;
        }
        return { ...l, ...updates };
      });
      const updated = { ...so, lines: updatedLines };
      updated.total = updated.lines.reduce((s, l) => s + l.orderedQty * l.unitPrice * (1 + l.taxRate), 0);
      return recalcSOStatus(updated);
    }));
  }, [deriveSOStatus]);

  const deleteSOLine = useCallback((soId: string, lineId: string): boolean => {
    let success = false;
    setSalesOrders(prev => prev.map(so => {
      if (so.id !== soId) return so;
      const line = so.lines.find(l => l.id === lineId);
      if (!line || line.shippedQty > 0) return so;
      // Release allocations
      releaseLineAllocations(line);
      success = true;
      const updated = {
        ...so,
        lines: so.lines.filter(l => l.id !== lineId),
        activityLog: [...so.activityLog, addActivity(so, "Line Removed", `Removed ${line.itemCode}`)],
      };
      updated.total = updated.lines.reduce((s, l) => s + l.orderedQty * l.unitPrice * (1 + l.taxRate), 0);
      return recalcSOStatus(updated);
    }));
    return success;
  }, [deriveSOStatus]);

  const allocate = useCallback((soId: string, lineId: string, newAllocations: Allocation[]): boolean => {
    let success = true;
    // Find the line to calculate effective available (accounting for allocations that will be released)
    const soRef = salesOrders.find(s => s.id === soId);
    const lineRef = soRef?.lines.find(l => l.id === lineId);
    const itemCode = lineRef?.itemCode;
    if (!itemCode) return false;

    // Build map: warehouse → qty that will be freed when existing unlocked allocations are released
    const releasableByWh = new Map<string, number>();
    (lineRef?.allocations.filter(a => !a.locked) || []).forEach(a => {
      releasableByWh.set(a.warehouse, (releasableByWh.get(a.warehouse) || 0) + a.qty);
    });

    // Build map: warehouse → total qty demanded by new allocations
    const demandByWh = new Map<string, number>();
    for (const alloc of newAllocations) {
      demandByWh.set(alloc.warehouse, (demandByWh.get(alloc.warehouse) || 0) + alloc.qty);
    }

    // Validate: warehouse must exist in inventory (over-allocation allowed with warning)
    for (const [warehouse] of demandByWh.entries()) {
      const inv = inventory.find(i => i.warehouse === warehouse && i.itemCode === itemCode);
      if (!inv) { success = false; break; }
    }
    if (!success) return false;

    setSalesOrders(prev => prev.map(so => {
      if (so.id !== soId) return so;
      const updatedLines = so.lines.map(l => {
        if (l.id !== lineId || l.cancelled) return l;
        // Release old unshipped allocations
        const oldUnshipped = l.allocations.filter(a => !a.locked);
        oldUnshipped.forEach(a => {
          updateInventoryReserve(a.warehouse, l.itemCode, -a.qty, a.lotNumber);
          if (a.serialNumbers) markSerialsAvailability(a.warehouse, l.itemCode, a.serialNumbers, true);
        });
        // Apply new allocations
        newAllocations.forEach(a => {
          updateInventoryReserve(a.warehouse, l.itemCode, a.qty, a.lotNumber);
          if (a.serialNumbers) markSerialsAvailability(a.warehouse, l.itemCode, a.serialNumbers, false);
        });
        const lockedAllocs = l.allocations.filter(a => a.locked);
        const allAllocs = [...lockedAllocs, ...newAllocations];
        const totalAllocated = allAllocs.reduce((s, a) => s + a.qty, 0);
        return { ...l, allocatedQty: totalAllocated, allocations: allAllocs };
      });
      const line = updatedLines.find(l => l.id === lineId)!;
      const newMovements = newAllocations.map(a => addMovement(so, "Reserve", a.qty, a.warehouse, `Allocated for ${lineId}`, line.itemCode));
      // Auto-transition Draft → Pending Review when first allocation is made
      const newStatus = so.status === "Draft" ? "Pending Review" as const : so.status;
      const statusLog = so.status === "Draft" ? [addActivity(so, "Status Changed", "Order moved to Pending Review — awaiting clearance")] : [];
      const updated = {
        ...so,
        status: newStatus,
        lines: updatedLines.map(l => ({ ...l, readyToPick: l.allocatedQty > 0 && !l.cancelled })),
        activityLog: [...so.activityLog, ...statusLog, addActivity(so, "Allocated", `Allocated ${line.itemCode}`)],
        inventoryMovements: [...so.inventoryMovements, ...newMovements],
      };
      return recalcSOStatus(updated);
    }));
    return true;
  }, [inventory, salesOrders, deriveSOStatus]);

  const deallocate = useCallback((soId: string, lineId: string, allocationId: string) => {
    setSalesOrders(prev => prev.map(so => {
      if (so.id !== soId) return so;
      const updatedLines = so.lines.map(l => {
        if (l.id !== lineId) return l;
        const alloc = l.allocations.find(a => a.id === allocationId);
        if (!alloc || alloc.locked) return l;
        updateInventoryReserve(alloc.warehouse, l.itemCode, -alloc.qty, alloc.lotNumber);
        if (alloc.serialNumbers) markSerialsAvailability(alloc.warehouse, l.itemCode, alloc.serialNumbers, true);
        const remaining = l.allocations.filter(a => a.id !== allocationId);
        return { ...l, allocatedQty: remaining.reduce((s, a) => s + a.qty, 0), allocations: remaining };
      });
      const line = updatedLines.find(l => l.id === lineId)!;
      const updated = {
        ...so,
        lines: updatedLines,
        activityLog: [...so.activityLog, addActivity(so, "Deallocated", `Released allocation for ${line.itemCode}`)],
        inventoryMovements: [...so.inventoryMovements, addMovement(so, "Release", 0, "", `Deallocated ${allocationId}`, line.itemCode)],
      };
      // SO can regress (e.g., Fully Allocated → Cleared)
      return recalcSOStatus(updated);
    }));
  }, [deriveSOStatus]);

  const createShipment = useCallback((soId: string, lines: { soLineId: string; allocationId: string; qty: number }[], warehouse: string, method?: ShipmentMethod, carrier?: string, pickupLocation?: string): Shipment | null => {
    const so = salesOrders.find(s => s.id === soId);
    if (!so) return null;
    /* Guard: shipment creation requires a confirmed (Cleared+) SO */
    const confirmedStatuses: SOStatus[] = ["Cleared", "Partially Shipped", "Shipped"];
    if (!confirmedStatuses.includes(so.status)) return null;
    const shipId = `SHIP-${String(shipmentCounter++).padStart(3, "0")}`;
    const shipLines: ShipmentLine[] = lines.map(sl => {
      const soLine = so.lines.find(l => l.id === sl.soLineId)!;
      return {
        id: `SHL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        soId,
        soLineId: sl.soLineId,
        allocationId: sl.allocationId,
        itemCode: soLine.itemCode,
        itemName: soLine.itemName,
        selectedQty: sl.qty,
        pickedQty: 0,
        shippedQty: 0,
      };
    });
    const shipment: Shipment = {
      id: shipId,
      shipmentNumber: `SH-000-${String(shipmentCounter).padStart(3, "0")}`,
      status: "Draft",
      shipmentType: "Standard",
      lines: shipLines,
      createdDate: new Date().toISOString().split("T")[0].replace(/-/g, "/"),
      warehouse,
      shippingMode: method,
      carrier,
      pickupLocation,
      shipTo: so.shippingAddress,
    };
    // Lock allocations
    setSalesOrders(prev => prev.map(s => {
      if (s.id !== soId) return s;
      const updatedLines = s.lines.map(l => {
        const shipLine = lines.find(sl => sl.soLineId === l.id);
        if (!shipLine) return l;
        return {
          ...l,
          allocations: l.allocations.map(a => a.id === shipLine.allocationId ? { ...a, locked: true } : a),
        };
      });
      return {
        ...s,
        lines: updatedLines,
        shipmentIds: [...s.shipmentIds, shipId],
        activityLog: [...s.activityLog, addActivity(s, "Shipment Created", `Shipment ${shipment.shipmentNumber} created`)],
      };
    }));
    setShipments(prev => [...prev, shipment]);
    return shipment;
  }, [salesOrders]);

  const updateShipmentStatus = useCallback((shipmentId: string, status: ShipmentStatus) => {
    setShipments(prev => prev.map(sh => {
      if (sh.id !== shipmentId) return sh;
      if (status === "Shipped") {
        // Process shipping
        const updatedLines = sh.lines.map(sl => ({ ...sl, shippedQty: sl.pickedQty }));
        // Update SO lines
        setSalesOrders(prevSOs => prevSOs.map(so => {
          const hasLine = updatedLines.some(sl => sl.soId === so.id);
          if (!hasLine) return so;
          const soLines = so.lines.map(l => {
            const shipLine = updatedLines.find(sl => sl.soLineId === l.id);
            if (!shipLine) return l;
            const newShipped = l.shippedQty + shipLine.shippedQty;
            return { ...l, shippedQty: newShipped, pickedQty: l.pickedQty + shipLine.pickedQty };
          });
          // Decrease on hand and reserved
          updatedLines.forEach(sl => {
            const soLine = so.lines.find(l => l.id === sl.soLineId);
            if (!soLine) return;
            const alloc = soLine.allocations.find(a => a.id === sl.allocationId);
            if (!alloc) return;
            updateInventoryOnHand(alloc.warehouse, soLine.itemCode, -sl.shippedQty);
            updateInventoryReserve(alloc.warehouse, soLine.itemCode, -sl.shippedQty, alloc.lotNumber);
          });
          const movements = updatedLines.filter(sl => sl.soId === so.id).map(sl => {
            const soLine = so.lines.find(l => l.id === sl.soLineId)!;
            return addMovement(so, "Issue", sl.shippedQty, sh.warehouse, `Shipped via ${sh.shipmentNumber}`, soLine.itemCode);
          });
          const updated = {
            ...so,
            lines: soLines,
            activityLog: [...so.activityLog, addActivity(so, "Shipped", `Shipment ${sh.shipmentNumber} shipped`)],
            inventoryMovements: [...so.inventoryMovements, ...movements],
          };
          return recalcSOStatus(updated);
        }));
        return { ...sh, status, lines: updatedLines };
      }
      return { ...sh, status };
    }));
  }, [deriveSOStatus]);

  const updateShipmentLinePicked = useCallback((shipmentId: string, lineId: string, pickedQty: number) => {
    setShipments(prev => prev.map(sh => {
      if (sh.id !== shipmentId) return sh;
      return {
        ...sh,
        lines: sh.lines.map(l => {
          if (l.id !== lineId) return l;
          const clamped = Math.min(pickedQty, l.selectedQty);
          return { ...l, pickedQty: clamped };
        }),
      };
    }));
  }, []);

  const deleteShipment = useCallback((shipmentId: string) => {
    const sh = shipments.find(s => s.id === shipmentId);
    if (!sh || sh.status === "Shipped") return;
    // Unlock allocations
    setSalesOrders(prev => prev.map(so => {
      const hasLine = sh.lines.some(sl => sl.soId === so.id);
      if (!hasLine) return so;
      const updatedLines = so.lines.map(l => {
        const shipLine = sh.lines.find(sl => sl.soLineId === l.id);
        if (!shipLine) return l;
        return {
          ...l,
          allocations: l.allocations.map(a => a.id === shipLine.allocationId ? { ...a, locked: false } : a),
        };
      });
      const updated = {
        ...so,
        lines: updatedLines,
        shipmentIds: so.shipmentIds.filter(id => id !== shipmentId),
        activityLog: [...so.activityLog, addActivity(so, "Shipment Deleted", `Shipment ${sh.shipmentNumber} deleted`)],
      };
      // SO can regress
      return recalcSOStatus(updated);
    }));
    setShipments(prev => prev.filter(s => s.id !== shipmentId));
  }, [shipments, deriveSOStatus]);

  const reverseShipment = useCallback((shipmentId: string) => {
    const sh = shipments.find(s => s.id === shipmentId);
    if (!sh || sh.status !== "Shipped") return;
    // Restore on hand and reserved
    setSalesOrders(prev => prev.map(so => {
      const hasLine = sh.lines.some(sl => sl.soId === so.id);
      if (!hasLine) return so;
      const soLines = so.lines.map(l => {
        const shipLine = sh.lines.find(sl => sl.soLineId === l.id);
        if (!shipLine) return l;
        return { ...l, shippedQty: l.shippedQty - shipLine.shippedQty, pickedQty: l.pickedQty - shipLine.pickedQty };
      });
      sh.lines.filter(sl => sl.soId === so.id).forEach(sl => {
        const soLine = so.lines.find(l => l.id === sl.soLineId);
        if (!soLine) return;
        const alloc = soLine.allocations.find(a => a.id === sl.allocationId);
        if (!alloc) return;
        updateInventoryOnHand(alloc.warehouse, soLine.itemCode, sl.shippedQty);
        updateInventoryReserve(alloc.warehouse, soLine.itemCode, sl.shippedQty, alloc.lotNumber);
      });
      const updated = {
        ...so,
        lines: soLines,
        activityLog: [...so.activityLog, addActivity(so, "Shipment Reversed", `Shipment ${sh.shipmentNumber} reversed — SO can regress`)],
      };
      return recalcSOStatus(updated);
    }));
    setShipments(prev => prev.map(s => s.id === shipmentId ? { ...s, status: "Draft" as const, lines: s.lines.map(l => ({ ...l, shippedQty: 0, pickedQty: 0 })) } : s));
  }, [shipments, deriveSOStatus]);

  const getAvailable = useCallback((warehouse: string, itemCode: string): number => {
    const inv = inventory.find(i => i.warehouse === warehouse && i.itemCode === itemCode);
    if (!inv) return 0;
    return inv.onHand - inv.reserved;
  }, [inventory]);

  const getInventoryForItem = useCallback((itemCode: string): WarehouseInventory[] => {
    return inventory.filter(i => i.itemCode === itemCode);
  }, [inventory]);

  const store: SOStore = {
    salesOrders, shipments, inventory,
    createSO, updateSO, markUnconfirmed, confirmSO, cancelSO, cancelSOLines, deliverSO, archiveSO, unarchiveSO, reactivateSO, createVersionDraft,
    addSOLine, updateSOLine, deleteSOLine,
    allocate, deallocate,
    createShipment, updateShipmentStatus, updateShipmentLinePicked, deleteShipment, reverseShipment,
    getAvailable, getInventoryForItem, deriveSOStatus,
  };

  return <SOContext.Provider value={store}>{children}</SOContext.Provider>;
}