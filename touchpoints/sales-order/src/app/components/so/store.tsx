import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type {
  SalesOrder, SOLine, SOStatus, Shipment, ShipmentStatus, ShipmentLine,
  WarehouseInventory, Allocation, CatalogItem, ActivityEntry, InventoryMovement,
  LinkedTransaction, Attachment, AttachmentCategory, FileKind, SalesRep, PickRecord,
  SOPriority, SOVersion, ShipmentMethod,
  ProcurementOrder, ProcurementItem, ProcurementStatus, BackorderRecord, BackorderStatus, SourcingStatus,
  SORejectionReason,
} from "./types";
import { ARCHIVABLE_STATES } from "./types";
import { seedLineItemAttachments } from "./lineItemAttachmentsStore";
import { getCustomerDefaults, SAMPLE_EMPTY_CUSTOMER } from "@/app/components/shared/customerDefaults";
import { getMissingFields, type FieldRule } from "@/app/components/shared/fieldRequirements";
import { SHIPMENT_CARRIERS, DEFAULT_SHIPMENT } from "./ShipmentMethodModal";
import { WAREHOUSES } from "./WarehouseSelectionModal";
import {
  getUomSetIdForProduct,
  getPrimaryUomForProduct,
  findUomById,
  pickSeededUomForLine,
} from "../../data/uomSets";

// ===== Mock Catalog =====
/* Pickup-warehouse seed map — keyed by itemCode so duplicated lines
   share the same `pickupLocation`. Multi-warehouse: each product
   maps to one or more warehouses, mirroring real-world fan-out
   (chassis can ship from OH primary or WA cross-dock, etc). Some
   itemCodes are intentionally omitted so those lines open in the
   "Decide later" state. */
const PICKUP_BY_ITEM: Record<string, { warehouseIds: string[] }> = {
  // Chassis: OH primary + WA secondary lot.
  '000-100-001': { warehouseIds: ['wh-001', 'wh-004'] },
  '000-100-002': { warehouseIds: ['wh-001', 'wh-004'] },
  '000-100-003': { warehouseIds: ['wh-001'] },
  // Lighting + siren: OH + WA cross-dock both stock.
  '000-100-026': { warehouseIds: ['wh-001', 'wh-004'] },
  '000-100-041': { warehouseIds: ['wh-001', 'wh-004'] },
  // Motorola radio: refurb-ready at IL returns hub.
  '000-100-049': { warehouseIds: ['wh-005'] },
  // Stryker stretcher: TX South Build finished goods only.
  '000-100-059': { warehouseIds: ['wh-003'] },
  // Kussmaul shoreline: OH + WA carry it.
  '000-100-079': { warehouseIds: ['wh-001', 'wh-004'] },
  // Paint/labor: PA Packout.
  '000-100-171': { warehouseIds: ['wh-002'] },
  // Operator training: PA Packout.
  '000-100-175': { warehouseIds: ['wh-002'] },
};

function pickupForItem(code: string): { warehouseIds: string[] } | undefined {
  const sel = PICKUP_BY_ITEM[code];
  return sel ? { warehouseIds: [...sel.warehouseIds] } : undefined;
}

export const CATALOG: CatalogItem[] = [
  /* `isRecentlyOrdered` tags items the customer has ordered recently
     across past SOs — surfaced by both pickers' no-search state, capped
     at 6 in the UI. Without a tagged set the empty state used to slice
     the whole catalogue, mixing in items the customer has never bought. */
  { code: "000-100-001", name: "Cutaway cab-chassis with 178\" wheelbase, 10,360 GVWR, 3.5L EcoBoost V6 turbocharged engine with 10-speed automatic transmission, factory ambulance prep package includes heavy-duty alternator (240A), auxiliary idle control, and reinforced rear frame section for modular body mounting", description: "Heavy-duty ambulance chassis", type: "Serialized", unitPrice: 42500, category: "Base Vehicles", inStock: 3, isRecentlyOrdered: true },
  { code: "000-100-002", name: "E-450 stripped chassis, 176\" WB, 7.3L V8 gas engine, dual rear wheels, 16,000 GVWR, heavy-duty front and rear stabilizer bars, ambulance prep with reinforced frame rails, upgraded 210A alternator, engine block heater, and transmission PTO provision for hydraulic equipment", description: "Ambulance prep with reinforced frame", type: "Serialized", unitPrice: 48200, category: "Base Vehicles", inStock: 117, isRecentlyOrdered: true },
  { code: "000-100-003", name: "ProMaster 3500 extended 159\" WB, high-roof body, front-wheel drive, 3.6L Pentastar V6 with 9-speed automatic, ambulance chassis package includes upgraded suspension with load-leveling rear air springs, heavy-duty brakes, and dual battery system with smart isolator relay", description: "3.6L Pentastar ambulance chassis", type: "Serialized", unitPrice: 39800, category: "Base Vehicles", inStock: 64 },
  { code: "000-100-026", name: "54\" full-size LED lightbar with 16 independently addressable modules in red/white split pattern for ambulance application, integrated alley lights and takedown floods, 62 programmable flash patterns with traffic advisor mode, low-profile aerodynamic housing with UV-stabilized polycarbonate lens, conformal-coated electronics rated IP67", description: "Integrated alley/takedown lights, programmable flash patterns", type: "Non-Serialized", unitPrice: 3250, category: "Lighting", inStock: 156, isRecentlyOrdered: true },
  { code: "000-100-041", name: "200-watt electronic siren amplifier with integrated PA system, includes wail, yelp, phaser, and hi-lo tone selections with configurable priority override, radio rebroadcast input for simultaneous PA and radio operation, backlit tactile controls with night-mode dimming, meets SAE J1849 and KKK-A-1822F specifications", description: "Radio rebroadcast input, backlit controls", type: "Non-Serialized", unitPrice: 685, category: "Audio", inStock: 89, isRecentlyOrdered: true },
  { code: "000-100-049", name: "Multi-band P25 Phase II digital mobile radio covering VHF (136-174 MHz), UHF (380-512 MHz), 700 MHz, and 800 MHz bands with TDMA technology, AES-256 and DES-OFB encryption, integrated GPS receiver with location reporting, Bluetooth 5.0, Over-The-Air Programming (OTAP) ready, built-in IP packet data modem for AVL and messaging", description: "AES 256 encryption, GPS, Bluetooth, OTAP ready", type: "Serialized", unitPrice: 7850, category: "Communications", inStock: 45, isRecentlyOrdered: true },
  { code: "000-100-059", name: "Powered hydraulic stretcher with 700 lb patient capacity, battery-operated lift mechanism with proportional hydraulic control, auto-loading base with isokinetic lowering system, compatible with Power-LOAD cot fastener, Fowler/Trendelenburg positioning, retractable head section, IV pole mount, integrated CPR platform, antimicrobial powder-coated aluminum frame with stainless steel components", description: "Auto-loading with isokinetic lowering, Power-LOAD compatible", type: "Serialized", unitPrice: 18500, category: "Patient Care", inStock: 23, isRecentlyOrdered: true },
  { code: "000-100-079", name: "Automatic shoreline power inlet with auto-eject on engine start, 20A/125V marine-grade weatherproof connector with corrosion-resistant stainless steel housing, includes integrated GFCI protection, LED status indicator for shore power connection state, and auto-transfer relay that switches between shore and inverter power sources without interrupting patient compartment equipment", description: "Weatherproof marine-grade connector", type: "Lot Non-Serialized", unitPrice: 1250, category: "Electrical", inStock: 200 },
  { code: "000-100-171", name: "Complete body preparation, prime, paint, and graphics installation labor package including surface prep with DA sanding and chemical etching, high-build epoxy primer with moisture barrier, base coat/clear coat in Imron polyurethane with UV protection, full agency decal/stripe/Chevron graphics per customer-supplied artwork and NFPA 1901 retroreflective markings", description: "Complete vehicle finishing service", type: "Non-Serialized", unitPrice: 5200, category: "Services", inStock: 999, isRecentlyOrdered: true },
  { code: "000-100-175", name: "8-hour on-site operator training session covering all installed vehicle systems including chassis operation, emergency lighting and siren controls, HVAC and climate management, electrical distribution panels, patient compartment equipment orientation, radio programming basics, Power-LOAD stretcher loading/unloading procedures with hands-on practicals and written competency assessment", description: "Patient compartment equipment orientation", type: "Non-Serialized", unitPrice: 1500, category: "Services", inStock: 999 },
  // Sample Lot Serialized item — exercises the lot + serial allocation
  // path. Each AED ships with a unique serial number and is tracked in
  // batches by lot for recall / expiration management. Inventory below
  // carries both `lots` and `serialNumbers` so the allocation modal can
  // pick a specific lot AND specific serial.
  { code: "000-100-195", name: "Field-ready AED with traceable smart battery. Unique per-unit serial number for asset/warranty tracking AND lot-numbered battery cells for recall + expiration management. FDA Class III, CE marked, 8-year shelf life, biphasic 200J defibrillator with metronome-guided CPR coaching.", description: "Serial-tracked AED with lot-controlled battery cells", type: "Lot Serialized", unitPrice: 2150, category: "Patient Care", inStock: 60 },
  /* Genuine liquid-set items — names spell out a container size
     (Gallon / Drum) so the data layer's strict heuristic routes
     them to the liquid UoM set (Liter / Gallon / Drum). The
     capsule dropdown renders the "Primary" pill on Liter. */
  { code: "000-100-220", name: "DEF Fluid - 2.5 Gallon Jug. Diesel exhaust fluid, API certified, 32.5% urea solution, meets ISO 22241, for SCR-equipped vehicles. Sold per liter.", description: "DEF, 2.5-gallon jug", type: "Lot Non-Serialized", unitPrice: 18, category: "Consumables", inStock: 240, isRecentlyOrdered: true },
  { code: "000-100-221", name: "Hydraulic Fluid AW-46 - 5 Gallon Pail. Premium anti-wear hydraulic fluid, AW-46 viscosity, zinc-based additive package, suitable for stretcher systems. Sold per liter.", description: "AW-46 hydraulic fluid, 5-gallon pail", type: "Lot Non-Serialized", unitPrice: 45, category: "Consumables", inStock: 90 },
  { code: "000-100-222", name: "Long-Life Coolant 50/50 - 1 Gallon Bottle. OAT extended-life engine coolant pre-mixed 50/50 with deionised water, meets ASTM D3306. Sold per liter.", description: "OAT coolant, 1-gallon bottle", type: "Lot Non-Serialized", unitPrice: 22, category: "Consumables", inStock: 180 },
  { code: "000-100-223", name: "Synthetic Motor Oil 15W-40 - 55 Gallon Drum. CK-4 synthetic blend diesel engine oil 15W-40, API CK-4 / SN, meets Cummins CES 20086. Sold per liter.", description: "15W-40 diesel oil, 55-gallon drum", type: "Lot Non-Serialized", unitPrice: 1450, category: "Consumables", inStock: 14 },
  /* Genuine length-set items — Spool naming routes them to the
     length set (Foot / Yard / Roll). Primary pill on Foot. */
  { code: "000-100-230", name: "14 AWG Stranded Primary Wire - 500 ft Spool. GPT-rated, 105°C insulation, abrasion-resistant PVC jacket. Sold per foot.", description: "Primary wire, 500-ft spool", type: "Lot Non-Serialized", unitPrice: 95, category: "Electrical", inStock: 60 },
  { code: "000-100-231", name: "4-Conductor Trailer Cable - 100 ft Spool. Color-coded 16 AWG copper, PVC jacket, UV stabilized, for module sub-harnesses. Sold per foot.", description: "Trailer cable, 100-ft spool", type: "Lot Non-Serialized", unitPrice: 145, category: "Electrical", inStock: 35, isRecentlyOrdered: true },
  /* ── Varied-prefix items ──
     Same catalogue spans multiple class-code prefixes so the line-
     item picker's search returns hits for partial ids like "001-100"
     or "002-" — the catalogue used to be uniformly "000-…" prefixed,
     so any user typing a different prefix dead-ended at zero results
     even though the search predicate is functioning. */
  { code: "001-100-010", name: "Whelen Cencom Carbide siren controller, 200W dual-tone capable, four hardwired light outputs with separate flash patterns, programmable park-kill, manual override switch, includes mounting bracket and 12-pin Deutsch connector harness for clean install in an ambulance dash cluster", description: "Carbide siren + light controller with park-kill", type: "Non-Serialized", unitPrice: 925, category: "Audio", inStock: 42 },
  { code: "001-100-022", name: "Federal Signal Pathfinder dual-color LED beacon, surface-mount with low-profile aerodynamic housing, dual-color red/white split with synchronized flash patterns, SAE J845 Class 1, 12-24V universal input, 5-year warranty for fleet rooftop installations", description: "Dual-color LED beacon, SAE J845 Class 1", type: "Non-Serialized", unitPrice: 415, category: "Lighting", inStock: 78 },
  { code: "001-100-070", name: "Knaack 60\" job-site weatherproof storage box for spare oxygen cylinders, locks for security, mounted to the cabinet rail, ventilation grilles for safe storage of compressed gas in the patient compartment of an ambulance, MIL-STD-810 rated against vibration and shock", description: "Weatherproof O2 cylinder storage", type: "Non-Serialized", unitPrice: 685, category: "Storage", inStock: 36 },
  { code: "002-100-001", name: "Kenwood NX-5800 P25 Phase II mobile transceiver, 700/800 MHz with TDMA, AES-256 encryption, integrated GPS and Bluetooth, designed for first-responder use with priority-scan, emergency button, MIL-STD-810G environmental sealing", description: "P25 Phase II mobile transceiver, AES-256", type: "Serialized", unitPrice: 4250, category: "Communications", inStock: 24 },
  { code: "002-100-014", name: "Stryker Power-LOAD cot fastener system for ambulances, integrates with Power-PRO XT, lifts and lowers automatically to reduce caregiver lifting injuries, includes mounting plate, hydraulic actuator, and safety harness anchors", description: "Power-LOAD cot fastener with safety anchors", type: "Serialized", unitPrice: 22800, category: "Patient Care", inStock: 12 },
];

/* Cap seeded unit prices so larger UoM choices (Pallet × 480, Carton ×
   24, etc.) don't produce visually unreadable line totals in the demo
   data. Real-world chassis and modules are five-figures-plus; the cap
   trades that realism for a clean presentation in the listing and the
   line items table. */
/* ── Long line descriptions, for exercising the reader ──────────────
   A handful of items carry full spec prose so the hover reader's 320px
   cap and its internal scroll get tested against production-length
   copy rather than a short name that never overflows. Applied at the
   LINE, not to CATALOG: the pickers show the catalogue name, and they
   should stay scannable. Keyed by item code. */
const LONG_LINE_SPECS: Record<string, string> = {
  "000-100-002":
"E-450 stripped chassis, 176\" WB, 7.3L V8, DRW, 16,000 GVWR, ambulance prep with reinforced " +
    "frame, heavy-duty alternator, and dual batteries. Includes extended-idle package and PTO-ready " +
    "wiring. Drivetrain: 7.3L OHV V8 rated 350 hp and 468 lb-ft, paired to a TorqShift 10-speed " +
    "automatic with tow/haul and live-drive PTO provision on the driver side. Rear axle is a 4.88 " +
    "limited-slip on a 10,000 lb Dana unit; front is a 6,000 lb twin I-beam with 55 mm gas shocks and " +
    "a 1.57 in stabiliser bar. Electrical: dual 78 Ah AGM batteries on an isolator relay, 240 A " +
    "pad-mount alternator with remote sense, and a 250 A mega-fuse at the distribution block. The " +
    "body-builder harness terminates behind the seat riser with 14 labelled circuits, six of them " +
    "ignition-switched, and a dedicated 8 AWG feed for the module disconnect. Idle control holds " +
    "1,150 rpm on a fast-idle input and drops out on brake or shift from park, which keeps the " +
    "inverter and the O2 warmer alive without a shoreline. Frame: rails are 36,000 psi with a " +
    "full-length C-channel insert from the cab back, drilled to the KKK-A-1822F bolt pattern so the " +
    "module mounts without site welding. Rear overhang is trimmed for a 96 in module with a 14 in " +
    "tail, and the fuel fill is relocated to the driver rear quarter to clear the compartment. Brakes " +
    "and steering: four-wheel discs with a hydro-boost assist shared with the power steering circuit, " +
    "and a reserve accumulator good for three stops with the engine off. ABS is four-channel with a " +
    "load-sensing rear proportioning valve calibrated for the loaded module weight, not the bare " +
    "chassis. Delivery notes: chassis ships on its own wheels with a 40 gal fill, PDI completed, and " +
    "the body-builder book in the glovebox. Lead time runs 21 days from the published floor and slips " +
    "if the 240 A alternator is back-ordered, which has happened twice this year. Warranty is 3 yr / " +
    "36,000 mi bumper-to-bumper and 5 yr / 60,000 mi on the powertrain, transferable once to the end " +
    "agency at no cost. Service access: the oil filter and the fuel-water separator are both " +
    "reachable without pulling the engine cover, which matters once a module is on and the doghouse " +
    "is captive under the console. Recommended interval is 5,000 mi on synthetic, halved for services " +
    "running heavy idle hours; the chassis logs idle separately from road time so the agency can bill " +
    "maintenance against the right programme. Known issues on this platform: the factory rear " +
    "air-conditioning line runs close to the frame insert and should be re-clipped during upfit, and " +
    "the driver-side body ground is undersized for a full module load, so we add a 4 AWG strap to the " +
    "block as standard rather than leaving it to the installer. Neither shows up in the build book. ",
  "000-100-019":
"Cutaway-mount modular body, 152\" compartment, 72\" headroom, full walk-through cab access, " +
    "aluminum/composite construction, KKK-A-1822F compliant. Shell is 0.125 in 5052-H32 aluminium on " +
    "a welded 6061-T6 skeleton, with the roof formed as a single sheet so there is no seam over the " +
    "patient area. Exterior panels are bonded rather than riveted along the belt line, which keeps " +
    "the surface flat for graphics and removes the usual corrosion path at the fastener heads. " +
    "Interior: seamless one-piece vinyl floor coved 4 in up the walls and heat-welded at every joint, " +
    "so a wash-down cannot find a way into the substrate. Cabinet faces are 0.090 in aluminium with " +
    "radiused edges and captive latches; the action-area shelving is on 1 in centres so the agency " +
    "can re-layout without drilling. The squad bench seats three with integrated child-seat anchors " +
    "and a 300 lb capacity per position. Electrical: 100 A distribution panel with a Class T main, " +
    "LED interior on two independently dimmable circuits, and a load-shed relay that drops the " +
    "non-critical bus when the shoreline is pulled and battery falls under 11.9 V. Every circuit " +
    "lands on a labelled terminal strip behind the action-area door, and the loom is run in split " +
    "conduit clear of the O2 lines. Climate: 30,000 BTU rear heat and 24,000 BTU cooling on a " +
    "dedicated compressor, ducted to six ceiling registers with a return behind the CPR seat. The " +
    "unit will hold 68 F at the patient position with an 8 F outside temperature and the rear doors " +
    "cycling. Compliance: built to KKK-A-1822F and tested to the SAE J3043, J3044 and J3045 series " +
    "for cot retention, seating and storage-device retention. Certificates ship with the unit, and " +
    "the test reports are available on request for grant documentation. Lead time is 5 days on the " +
    "accessory floor, though the bariatric variant adds two weeks for the widened rear door frame. " +
    "Oxygen: the main cylinder sits in a rear-access compartment with a strap-and-cradle retention " +
    "rated to the J3045 pull, and the regulator panel is inside the action area at chest height so " +
    "the medic is not reaching across the cot. Lines are copper to the outlets with a shutoff behind " +
    "a labelled access door. Lighting over the cot measures 120 fc at the patient surface with both " +
    "circuits up, which is above the 100 fc the specification asks for and enough to run a line " +
    "without a headlamp. Field notes from the last four builds: agencies consistently ask to move the " +
    "sharps container off the action-area door and onto the bulkhead, and to swap one upper cabinet " +
    "for open shelving. Both are no-cost changes if they are called before the interior goes in, and " +
    "neither affects the compliance certificates. ",
  "000-100-026":
"54\" full-size LED lightbar with 16 modules, red/white split for ambulance, integrated " +
    "alley/takedown lights, programmable flash patterns, low-profile aerodynamic housing. Each module " +
    "carries six 3 W Gen-4 emitters behind a collimating optic, and the reflector is tuned per " +
    "position so the corners throw to the side rather than wasting output down the centreline. Rated " +
    "62 flash patterns with a traffic advisor mode across the rear eight modules, selectable left, " +
    "right, centre-out and a steady bar. Photometrics: certified to SAE J595 Class 1 in both the red " +
    "and the white halves, measured with the lens at 30 C rather than cold, which is where most bars " +
    "quietly lose a class. Cruise mode drops output to 30 percent for scene work without cycling the " +
    "emitters, so colour temperature holds at 5,700 K instead of drifting warm as the junction heats. " +
    "Housing is a single extrusion with cast end caps and a UV-stabilised polycarbonate lens, 3.1 in " +
    "tall at the centre and swept to 2.4 in at the ends. Wind noise measures under 3 dBA over bare " +
    "roof at 60 mph. Mounting feet are adjustable fore and aft on the extrusion channel, and the kit " +
    "includes gutter, permanent and modular-roof hardware. Electronics are conformally coated and " +
    "sealed to IP67, with a single Deutsch DT connector carrying power, ground, pattern select and " +
    "the sync line. Two bars can be synchronised without a control head. Current draw is 11.4 A at " +
    "full output and 3.8 A in cruise, low enough to sit on the existing 15 A emergency circuit " +
    "without a rework. Warranty is 5 years on the LEDs and drivers, 3 years on the housing, with " +
    "advance replacement inside the first year. Failures cluster in the first 90 days when they " +
    "happen at all, almost always a pinched harness at the roof penetration rather than the bar " +
    "itself. Installation: the roof penetration should be a single 1.5 in grommeted pass-through " +
    "behind the front module bank, sealed with butyl rather than silicone, since silicone lifts the " +
    "paint over a couple of winters. Leave a 6 in service loop inside the headliner so the bar can be " +
    "dropped for a driver swap without cutting the loom. Torque the feet to 12 Nm and re-check at the " +
    "30-day service; the extrusion relaxes slightly after the first heat cycles and a loose foot is " +
    "the usual cause of a rattle complaint that gets reported as an electrical fault. Compatibility: " +
    "the sync line is compatible with our siren and switch panel, but not with third-party " +
    "controllers that pull the line high rather than switching it to ground, which will hold the bar " +
    "in a single pattern with no error shown anywhere. ",
};

const CATALOG_PRICE_CAP = 1500;
CATALOG.forEach(item => { if (item.unitPrice > CATALOG_PRICE_CAP) item.unitPrice = CATALOG_PRICE_CAP; });

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
  // Lot + Serial inventory for the sample AED — three lots (different
  // expiration batches), each with their own per-unit serial pool. This
  // lets the allocation modal demonstrate picking a specific serial
  // within a specific lot.
  { warehouse: "Main Warehouse", itemCode: "000-100-195", onHand: 30, reserved: 0,
    lots: [
      { lotNumber: "LOT-195-2025Q4", qty: 12, reserved: 0, status: "Active" },
      { lotNumber: "LOT-195-2026Q1", qty: 10, reserved: 0, status: "Active" },
      { lotNumber: "LOT-195-2026Q2", qty: 8,  reserved: 0, status: "Active" },
      { lotNumber: "LOT-195-2025Q3", qty: 6,  reserved: 0, status: "Quarantine" },
    ],
    serialNumbers: Array.from({ length: 30 }, (_, i) => ({ serial: `SN-195-M${String(i + 1).padStart(3, "0")}`, available: true })),
  },
  { warehouse: "East Hub", itemCode: "000-100-195", onHand: 18, reserved: 0,
    lots: [
      { lotNumber: "LOT-195-2025Q4", qty: 10, reserved: 0 },
      { lotNumber: "LOT-195-2026Q1", qty: 8,  reserved: 0 },
    ],
    serialNumbers: Array.from({ length: 18 }, (_, i) => ({ serial: `SN-195-E${String(i + 1).padStart(3, "0")}`, available: true })),
  },
  { warehouse: "West Depot", itemCode: "000-100-195", onHand: 12, reserved: 0,
    lots: [
      { lotNumber: "LOT-195-2026Q1", qty: 7, reserved: 0 },
      { lotNumber: "LOT-195-2026Q2", qty: 5, reserved: 0 },
    ],
    serialNumbers: Array.from({ length: 12 }, (_, i) => ({ serial: `SN-195-W${String(i + 1).padStart(3, "0")}`, available: true })),
  },
  /* Inventory for the varied-prefix catalogue items so they don't
     read as 0 ATP everywhere. Mirrors the on-hand figures declared
     against each catalogue entry. */
  { warehouse: "Main Warehouse", itemCode: "001-100-010", onHand: 42, reserved: 0 },
  { warehouse: "Main Warehouse", itemCode: "001-100-022", onHand: 78, reserved: 0 },
  { warehouse: "Main Warehouse", itemCode: "001-100-070", onHand: 36, reserved: 0 },
  { warehouse: "Main Warehouse", itemCode: "002-100-001", onHand: 24, reserved: 0, serialNumbers: Array.from({ length: 10 }, (_, i) => ({ serial: `SN-2-001-${String(i + 1).padStart(3, "0")}`, available: true })) },
  { warehouse: "Main Warehouse", itemCode: "002-100-014", onHand: 12, reserved: 0, serialNumbers: Array.from({ length: 10 }, (_, i) => ({ serial: `SN-2-014-${String(i + 1).padStart(3, "0")}`, available: true })) },
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

  /* Per-line picker roster — pickers are now item-level rather
     than a single shipment-wide assignee. Rotates so demo cards
     show two or three distinct pickers per shipment. */
  const LINE_PICKERS: Array<{ name: string; initials: string }> = [
    { name: "David Kowalski", initials: "DK" },
    { name: "James Hatfield", initials: "JH" },
    { name: "Robert Navarro", initials: "RN" },
    { name: "Amanda Chen",   initials: "AC" },
    { name: "Emily Rios",    initials: "ER" },
    { name: "Marcus Chen",   initials: "MC" },
  ];
  const stampLinePickers = <T extends { pickedQty: number }>(lines: T[], seed: number): (T & { pickedBy?: string; pickedByInitials?: string })[] =>
    lines.map((l, li) => {
      if (l.pickedQty <= 0) return l;
      const p = LINE_PICKERS[(seed + li) % LINE_PICKERS.length];
      return { ...l, pickedBy: p.name, pickedByInitials: p.initials };
    });

  /* Resolve the SO's persisted Freight & Logistics config into the
     handful of primitives the shipment card actually renders. Falls
     back to sensible defaults when the SO doesn't yet carry a
     `shipmentConfig` (legacy fixtures, mid-migration data). */
  const resolveShipmentContext = (so: SalesOrder): {
    departureType: "carrier" | "customer-pickup";
    carrierName?: string;
    modeName?: string;
    carrierMethod?: { minDays: number; maxDays: number; shortName: string };
    pickupWarehouseName?: string;
    pickupWarehouseAddress?: string;
    authorizedPickupName?: string;
    authorizedPickupPhone?: string;
  } => {
    const cfg: any = (so as any).shipmentConfig;
    const carrier = SHIPMENT_CARRIERS.find(c => c.id === cfg?.carrierId);
    const method = carrier?.methods.find(m => m.id === cfg?.carrierMethodId) ?? carrier?.methods.find(m => m.isDefault);
    const warehouseId = cfg?.pickupLocation?.warehouseIds?.[0];
    const warehouse = WAREHOUSES.find(w => w.id === warehouseId);
    const isCustomerPickup = cfg?.method === "customer-pickup";
    return {
      departureType: isCustomerPickup ? "customer-pickup" : "carrier",
      carrierName: carrier?.name,
      modeName: method?.name,
      carrierMethod: method ? { minDays: method.minDays, maxDays: method.maxDays, shortName: method.shortName } : undefined,
      pickupWarehouseName: warehouse?.name,
      pickupWarehouseAddress: warehouse?.address,
      authorizedPickupName: cfg?.authorizedPersonName,
      authorizedPickupPhone: cfg?.authorizedPersonPhone,
    };
  };

  let shipmentCounter = 0;
  /* Rotating handoff evidence — Shipment2's carrier-freight tab
     captures Email / Signature file / Handoff photo at ship time, and
     the warehouse verifies a government ID at pickup. We mirror the
     same fields on the SO side so the driver handoff card can render
     scalable evidence rows on shipped shipments. */
  const HANDOFF_EVIDENCE: Array<{
    driverEmail: string;
    driverIdNumber: string;
    handoffAt: string;
    handoffSignatureCount: number;
    handoffPhotoCount: number;
  }> = [
    { driverEmail: "tony.mitchell@ups-freight.com",   driverIdNumber: "CDL-OH-84302",     handoffAt: "2026/07/12 · 14:32", handoffSignatureCount: 1, handoffPhotoCount: 2 },
    { driverEmail: "robert.davis@fedex-freight.com",  driverIdNumber: "CDL-PA-19477",     handoffAt: "2026/07/14 · 09:18", handoffSignatureCount: 1, handoffPhotoCount: 3 },
    { driverEmail: "jake.sullivan@rl-carriers.com",   driverIdNumber: "CDL-TX-56201",     handoffAt: "2026/07/18 · 16:04", handoffSignatureCount: 1, handoffPhotoCount: 1 },
  ];
  const stampDeparture = (so: SalesOrder): {
    departureType: "carrier" | "customer-pickup";
    driverPhone?: string;
    authorizedPickupName?: string;
    authorizedPickupPhone?: string;
    createdBy: string;
    createdByInitials: string;
    /* New: resolved F&L context so downstream call sites don't have
       to redo the lookup — carrier name, mode name, pickup warehouse
       name + address. */
    carrierName?: string;
    modeName?: string;
    pickupWarehouseName?: string;
    pickupWarehouseAddress?: string;
  } => {
    /* Departure type + carrier + pickup warehouse now come from the
       SO's persisted Freight & Logistics config (`so.shipmentConfig`)
       — not a shipmentCounter round-robin. This keeps the shipment
       tab in sync with what the user actually picked in the F&L
       modal for the SO / line. */
    shipmentCounter += 1;
    const ctx = resolveShipmentContext(so);
    const salesRep = so.salesReps?.[0];
    const creator = salesRep?.name || "Yahya Naveed";
    const creatorInitials = salesRep?.initials || (creator.split(" ").map(w => w[0]).join(""));
    return {
      departureType: ctx.departureType,
      driverPhone: ctx.departureType === "carrier" ? "+1 (555) 630-2214" : undefined,
      authorizedPickupName: ctx.authorizedPickupName,
      authorizedPickupPhone: ctx.authorizedPickupPhone,
      createdBy: creator,
      createdByInitials: creatorInitials,
      carrierName: ctx.carrierName,
      modeName: ctx.modeName,
      pickupWarehouseName: ctx.pickupWarehouseName,
      pickupWarehouseAddress: ctx.pickupWarehouseAddress,
    };
  };
  let handoffCursor = 0;
  const nextHandoff = () => {
    const h = HANDOFF_EVIDENCE[handoffCursor % HANDOFF_EVIDENCE.length];
    handoffCursor += 1;
    return h;
  };

  /* Carrier-side PoC roster — the dispatcher / account manager
     from the carrier who owns communication about this shipment.
     Keyed by carrier name so the PoC feels tied to the carrier
     rather than random. Falls back to a generic entry when the
     carrier isn't in the roster. */
  /* Keyed by the carrier NAME (as it appears in SHIPMENT_CARRIERS)
     so the PoC resolver stays tied to the F&L catalog. Adding a new
     carrier just means adding a row here. */
  const CARRIER_POCS: Record<string, { name: string; role: string; phone: string; email: string }> = {
    "DHL Express":       { name: "Priya Nair",     role: "Freight Dispatcher", phone: "+1 (800) 225-5345 · ext. 4102", email: "priya.nair@dhl-express.com" },
    "Aramex":            { name: "Lena Petrov",    role: "Dispatch Lead",      phone: "+1 (800) 272-6394 · ext. 5518", email: "lena.petrov@aramex.com" },
    "USPS Priority Mail":{ name: "Chris Whitfield",role: "Dispatch Ops",       phone: "+1 (800) 275-8777",             email: "dispatch@usps-priority.com" },
    "Blue Dart":         { name: "Anika Menon",    role: "Account Manager",    phone: "+1 (800) 555-2583",             email: "anika.menon@bluedart.com" },
    "FedEx Freight":     { name: "Marcus Delaney", role: "Account Manager",    phone: "+1 (800) 463-3339 · ext. 2231", email: "marcus.delaney@fedex-freight.com" },
  };
  const DEFAULT_CARRIER_POC = { name: "Chris Whitfield", role: "Dispatch Ops", phone: "+1 (800) 555-0184", email: "dispatch@carrier-ops.com" };
  const pocForCarrier = (carrier?: string) => (carrier && CARRIER_POCS[carrier]) || DEFAULT_CARRIER_POC;

  /* Sample reroute scenarios — the demo cycles through these so the
     Reroutes section on the shipment card has realistic content
     without every shipment sharing identical wording. Each entry is
     applied at the call site (staging vs address, whole-shipment vs
     per-line) with the appropriate `lineId` filled in. */
  let changeIdCursor = 0;
  const nextChangeId = () => `SHCHG-${String(++changeIdCursor).padStart(4, "0")}`;
  const STAGING_REROUTE_POOL: Array<{ previous: string; next: string; reason: string; at: string; by: string; byInitials: string }> = [
    { previous: "Dock A - Bay 2", next: "Dock C - Bay 1", reason: "Units at original staging spot were water-damaged during overnight sprinkler test. Repicked from adjacent aisle and moved to Dock C to keep the pick-to-ship path unblocked.", at: "2026/07/22 · 10:15", by: "Amanda Chen", byInitials: "AC" },
    { previous: "Dock B - Bay 1", next: "Dock B - Bay 4", reason: "Forklift traffic on Bay 1 blocked outbound access. Warehouse lead relocated staged pallets so the driver can back in without re-routing around the pick floor.", at: "2026/07/23 · 08:42", by: "David Kowalski", byInitials: "DK" },
    { previous: "Dock A - Bay 1", next: "Dock D - Bay 3", reason: "Pallet count exceeded Bay 1 floor markings. Restaged at Bay 3 to accommodate the full lot before the carrier arrives.", at: "2026/07/24 · 15:08", by: "Emily Rios",    byInitials: "ER" },
  ];
  const ADDRESS_REROUTE_POOL: Array<{ previous: string; next: string; reason: string; at: string; by: string; byInitials: string }> = [
    { previous: "220 Riverside Dr, Cleveland, OH 44113", next: "1400 Innovation Way · Suite 300, Cleveland, OH 44114", reason: "Customer requested delivery to their downtown office instead of the warehouse dock. Address updated after loading was confirmed, no impact to ship date.", at: "2026/07/25 · 11:27", by: "Diana Reyes", byInitials: "DR" },
    { previous: "5000 Commerce Pkwy, Columbus, OH 43228", next: "2100 Distribution Rd, Groveport, OH 43125", reason: "Original receiving dock closed for HVAC maintenance the day of delivery. Routed to the customer's secondary DC that can accept freight on the same window.", at: "2026/07/26 · 09:04", by: "Sarah Chen",  byInitials: "SC" },
  ];
  let stagingCursor = 0, addressCursor = 0;
  const nextStagingReroute = () => STAGING_REROUTE_POOL[stagingCursor++ % STAGING_REROUTE_POOL.length];
  const nextAddressReroute = () => ADDRESS_REROUTE_POOL[addressCursor++ % ADDRESS_REROUTE_POOL.length];

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

      /* Cross-shipment line split — when the SO has both an A and a
         B shipment, the FIRST line of batch1 is intentionally split
         across both. Shipment A carries 60% of that line's qty and
         Shipment B carries the remaining 40%. Totals across A + B
         still equal the SO line's `orderedQty` (== `shippedQty` for
         a fully-shipped SO), so aggregates in the sidebar / by-item
         view stay accurate. This gives the by-item view a real
         "line item in multiple shipments" case for the split
         cluster to render against. */
      const canSplitFirst = batch1.length > 0 && batch2.length > 0;
      const splitLine = canSplitFirst ? batch1[0] : null;
      const splitQtyA = splitLine ? Math.ceil(splitLine.orderedQty * 0.6) : 0;
      const splitQtyB = splitLine ? splitLine.orderedQty - splitQtyA : 0;

      {
        const dep = stampDeparture(so);
        const linesA = stampLinePickers(batch1.map((l, li) => {
          const isSplit = splitLine && li === 0;
          const qty = isSplit ? splitQtyA : l.orderedQty;
          return {
            id: `SHL-${so.id}-A-${li}`, soId: so.id, soLineId: l.id,
            allocationId: l.allocations[0]?.id || `ALLOC-${l.id}-0`,
            itemCode: l.itemCode, itemName: l.itemName,
            selectedQty: qty, pickedQty: qty, shippedQty: qty,
            pickLocation: "Aisle B, Rack 3, Shelf 2", stagedLocation: "Dock A - Bay 2",
          };
        }), 0);
        shipments.push({
          id: shipId1,
          shipmentNumber: `SH-${so.soNumber.replace(/SO-000-000-/, "")}A`,
          status: "Shipped",
          shipmentType: "Standard",
          lines: linesA,
          createdDate: so.orderDate,
          warehouse: so.warehouse,
          departureType: dep.departureType,
          ...(dep.departureType === "carrier" ? (() => {
            const h = nextHandoff();
            const poc = pocForCarrier(dep.carrierName);
            return {
              trackingCode: `1Z${so.id.replace(/-/g, "")}${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
              carrier: dep.carrierName,
              shippingMode: dep.modeName,
              driverName: "Tony Mitchell",
              driverPhone: dep.driverPhone,
              driverEmail: h.driverEmail,
              driverIdNumber: h.driverIdNumber,
              handoffAt: h.handoffAt,
              handoffSignatureCount: h.handoffSignatureCount,
              handoffPhotoCount: h.handoffPhotoCount,
              carrierContactName: poc.name,
              carrierContactRole: poc.role,
              carrierContactPhone: poc.phone,
              carrierContactEmail: poc.email,
            };
          })() : {
            authorizedPickupName: dep.authorizedPickupName,
            authorizedPickupPhone: dep.authorizedPickupPhone,
          }),
          shipDate: so.orderDate,
          estimatedDelivery: so.requestedDeliveryDate,
          /* Origin address = the pickup warehouse the user picked in
             the F&L modal (via so.shipmentConfig.pickupLocation).
             Same address flows through as the pickupLocation label. */
          shipFrom: dep.pickupWarehouseAddress,
          shipTo: so.shippingAddress,
          confirmedBy: "Diana Reyes", confirmedByInitials: "DR",
          createdBy: dep.createdBy, createdByInitials: dep.createdByInitials,
          pickupLocation: dep.pickupWarehouseName,
          /* Every 3rd fully-shipped Shipment A gets a shipment-level
             address reroute so the demo listing has visible change
             activity without every card being noisy. */
          ...(shipmentCounter % 3 === 0 ? (() => {
            const r = nextAddressReroute();
            return {
              changes: [{
                id: nextChangeId(),
                type: "ship-address" as const,
                previous: r.previous,
                next: r.next,
                reason: r.reason,
                at: r.at,
                by: r.by,
                byInitials: r.byInitials,
              }],
            };
          })() : {}),
        });
      }
      refs[so.id] = [shipId1];

      if (batch2.length > 0) {
        const depB = stampDeparture(so);
        /* Prepend the split first-line remainder so Shipment B also
           carries units of `batch1[0]`. Combined with Shipment A's
           60% slice, the by-item view now shows this line in two
           slice pills. */
        const sharedRow = splitLine ? [{
          id: `SHL-${so.id}-B-shared`, soId: so.id, soLineId: splitLine.id,
          allocationId: splitLine.allocations[0]?.id || `ALLOC-${splitLine.id}-0`,
          itemCode: splitLine.itemCode, itemName: splitLine.itemName,
          selectedQty: splitQtyB, pickedQty: splitQtyB, shippedQty: splitQtyB,
          pickLocation: "Aisle B, Rack 3, Shelf 2", stagedLocation: "Dock B - Bay 3",
        }] : [];
        const linesB = stampLinePickers([
          ...sharedRow,
          ...batch2.map((l, li) => ({
            id: `SHL-${so.id}-B-${li}`, soId: so.id, soLineId: l.id,
            allocationId: l.allocations[0]?.id || `ALLOC-${l.id}-0`,
            itemCode: l.itemCode, itemName: l.itemName,
            selectedQty: l.orderedQty, pickedQty: l.orderedQty, shippedQty: l.orderedQty,
            pickLocation: "Aisle D, Rack 1, Shelf 4", stagedLocation: "Dock B - Bay 1",
          })),
        ], 2);
        shipments.push({
          id: shipId2,
          shipmentNumber: `SH-${so.soNumber.replace(/SO-000-000-/, "")}B`,
          status: "Shipped",
          shipmentType: "Standard",
          lines: linesB,
          createdDate: so.orderDate,
          warehouse: so.warehouse,
          departureType: depB.departureType,
          ...(depB.departureType === "carrier" ? (() => {
            const h = nextHandoff();
            const poc = pocForCarrier(depB.carrierName);
            return {
              trackingCode: `794${so.id.replace(/-/g, "")}${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
              carrier: depB.carrierName,
              shippingMode: depB.modeName,
              driverName: "Robert Davis",
              driverPhone: depB.driverPhone,
              driverEmail: h.driverEmail,
              driverIdNumber: h.driverIdNumber,
              handoffAt: h.handoffAt,
              handoffSignatureCount: h.handoffSignatureCount,
              handoffPhotoCount: h.handoffPhotoCount,
              carrierContactName: poc.name,
              carrierContactRole: poc.role,
              carrierContactPhone: poc.phone,
              carrierContactEmail: poc.email,
            };
          })() : {
            authorizedPickupName: depB.authorizedPickupName,
            authorizedPickupPhone: depB.authorizedPickupPhone,
          }),
          shipDate: so.orderDate,
          estimatedDelivery: so.requestedDeliveryDate,
          shipFrom: depB.pickupWarehouseAddress,
          shipTo: so.shippingAddress,
          confirmedBy: "Sarah Chen", confirmedByInitials: "SC",
          createdBy: depB.createdBy, createdByInitials: depB.createdByInitials,
          /* Attach a per-line staging-location reroute so the demo
             shows the item-scoped variant (line item code appears as
             the scope pill). Skipped when the shipment has no lines. */
          ...(linesB.length > 0 ? (() => {
            const r = nextStagingReroute();
            return {
              changes: [{
                id: nextChangeId(),
                type: "staging-location" as const,
                lineId: linesB[0].soLineId,
                previous: r.previous,
                next: r.next,
                reason: r.reason,
                at: r.at,
                by: r.by,
                byInitials: r.byInitials,
              }],
            };
          })() : {}),
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
        const depP = stampDeparture(so);
        const linesP = stampLinePickers(shippedLines.map((l, li) => ({
          id: `SHL-${so.id}-P-${li}`, soId: so.id, soLineId: l.id,
          allocationId: l.allocations[0]?.id || `ALLOC-${l.id}-0`,
          itemCode: l.itemCode, itemName: l.itemName,
          selectedQty: l.shippedQty, pickedQty: l.shippedQty, shippedQty: l.shippedQty,
          pickLocation: "Aisle A, Rack 2, Shelf 1", stagedLocation: "Dock A - Bay 1",
        })), 4);
        shipments.push({
          id: shipId,
          shipmentNumber: `SH-${so.soNumber.replace(/SO-000-000-/, "")}A`,
          status: "Shipped",
          shipmentType: "Standard",
          lines: linesP,
          createdDate: so.orderDate,
          warehouse: so.warehouse,
          departureType: depP.departureType,
          ...(depP.departureType === "carrier" ? (() => {
            const h = nextHandoff();
            const poc = pocForCarrier(depP.carrierName);
            return {
              trackingCode: `9400${so.id.replace(/-/g, "")}${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
              carrier: depP.carrierName,
              shippingMode: depP.modeName,
              driverName: "Jake Sullivan",
              driverPhone: depP.driverPhone,
              driverEmail: h.driverEmail,
              driverIdNumber: h.driverIdNumber,
              handoffAt: h.handoffAt,
              handoffSignatureCount: h.handoffSignatureCount,
              handoffPhotoCount: h.handoffPhotoCount,
              carrierContactName: poc.name,
              carrierContactRole: poc.role,
              carrierContactPhone: poc.phone,
              carrierContactEmail: poc.email,
            };
          })() : {
            authorizedPickupName: depP.authorizedPickupName,
            authorizedPickupPhone: depP.authorizedPickupPhone,
          }),
          shipDate: so.orderDate,
          estimatedDelivery: so.requestedDeliveryDate,
          shipFrom: depP.pickupWarehouseAddress,
          shipTo: so.shippingAddress,
          confirmedBy: "Marcus Chen", confirmedByInitials: "MC",
          createdBy: depP.createdBy, createdByInitials: depP.createdByInitials,
          pickupLocation: depP.pickupWarehouseName,
        });
        shipIds.push(shipId);
      }

      // Shipment B: lines with allocation but not yet shipped → "In Progress"
      if (unshippedWithAlloc.length > 0) {
        const secondShipId = `SHIP-${so.id}-Q`;
        const prepLine = unshippedWithAlloc[0];
        const prepQty = Math.max(1, Math.floor(prepLine.allocatedQty / 2));
        const depQ = stampDeparture(so);
        const linesQ = stampLinePickers([{
          id: `SHL-${so.id}-Q-0`, soId: so.id, soLineId: prepLine.id,
          allocationId: prepLine.allocations[0]?.id || `ALLOC-${prepLine.id}-0`,
          itemCode: prepLine.itemCode, itemName: prepLine.itemName,
          selectedQty: prepQty, pickedQty: Math.floor(prepQty / 2), shippedQty: 0,
          pickLocation: "Aisle C, Rack 5, Shelf 3",
        }], 5);
        shipments.push({
          id: secondShipId,
          shipmentNumber: `SH-${so.soNumber.replace(/SO-000-000-/, "")}B`,
          status: "In Progress",
          shipmentType: "Standard",
          lines: linesQ,
          createdDate: so.orderDate,
          warehouse: so.warehouse,
          departureType: depQ.departureType,
          ...(depQ.departureType === "carrier" ? (() => {
            const poc = pocForCarrier(depQ.carrierName);
            return {
              carrier: depQ.carrierName,
              shippingMode: depQ.modeName,
              driverPhone: depQ.driverPhone,
              carrierContactName: poc.name,
              carrierContactRole: poc.role,
              carrierContactPhone: poc.phone,
              carrierContactEmail: poc.email,
            };
          })() : {
            authorizedPickupName: depQ.authorizedPickupName,
            authorizedPickupPhone: depQ.authorizedPickupPhone,
          }),
          estimatedDelivery: so.requestedDeliveryDate,
          shipFrom: depQ.pickupWarehouseAddress,
          shipTo: so.shippingAddress,
          createdBy: depQ.createdBy, createdByInitials: depQ.createdByInitials,
          pickupLocation: depQ.pickupWarehouseName,
          /* In-progress shipments frequently see staging-location
             swaps mid-pick (damaged units, blocked docks). Seeded on
             every In Progress card so users see the change log
             during the picking phase, scoped to the specific line
             that was restaged. */
          changes: [(() => {
            const r = nextStagingReroute();
            return {
              id: nextChangeId(),
              type: "staging-location" as const,
              lineId: prepLine.id,
              previous: r.previous,
              next: r.next,
              reason: r.reason,
              at: r.at,
              by: r.by,
              byInitials: r.byInitials,
            };
          })()],
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

function generateAttachments(index: number, soId: string, lines: SOLine[]): Attachment[] {
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
  // Pre-Sales item-level sub-attachments
  const preSalesItemDescs = ["Quote breakdown for this line item", "Supplier pricing data for item", "Compliance datasheet from vendor"];
  lines.filter(l => !l.cancelled).slice(0, 3).forEach((line, li) => {
    const fk2: FileKind = li % 2 === 0 ? "pdf" : "xlsx";
    const sz2 = `${(Math.random() * 3 + 0.4).toFixed(1)} MB`;
    atts.push({ id: `ATT-${index}-psi${li}`, name: `${["Quote_Breakdown","Supplier_Pricing","Compliance_Datasheet"][li % 3]}_${line.itemCode}.${fk2}`, description: preSalesItemDescs[li % 3], size: sz2, uploadedBy: li % 2 === 0 ? rep : "Emily Rios", date: `01/${String(16 + (li % 5)).padStart(2, "0")}`, category: "pre-sales", fileKind: fk2, lineItemId: line.id, inOrder: false });
  });
  /* Item Attachments are NOT pushed onto `so.attachments` — they live in
     `lineItemAttachmentsStore`, which the line-item configurator and the
     Attachments tab's Item Attachments folder both read. Seeding them
     there is what makes a delete on either surface show up on the other.
     Each line gets a document plus a visual reference; the second one is
     marked as copied in from the item master's gallery so the
     configurator's gallery view has something already-added to show. */
  const itemDescs = ["Compliance checklist for this item", "Module specifications and drawings", "Warranty certificate for extended coverage", "Programming template configuration file"];
  lines.filter(l => !l.cancelled).slice(0, 4).forEach((line, li) => {
    const fk3: FileKind = li === 3 ? "cfg" : "pdf";
    const sz3 = ["3.2 MB", "4.7 MB", "520 KB", "1.8 MB"][li % 4];
    seedLineItemAttachments(soId, line.id, [
      {
        id: `ATT-${index}-it${li}`,
        name: `${["Compliance_Checklist","Module_Specs","Warranty_Cert","Programming_Template"][li % 4]}_${line.itemCode}.${fk3 === "cfg" ? "pdf" : fk3}`,
        description: itemDescs[li % 4],
        size: sz3,
        uploadedBy: li % 2 === 0 ? rep : "Emily Rios",
        date: `01/${String(22 + (li % 6)).padStart(2, "0")}`,
        fileKind: fk3 === "cfg" ? "pdf" : fk3,
        lineItemId: line.id,
      },
      {
        id: `ATT-${index}-iti${li}`,
        name: `${["Render","Wiring","Mount","Schematic"][li % 4]}_${line.itemCode}.${li % 2 === 0 ? "jpg" : "png"}`,
        description: "Visual reference copied from the item master gallery",
        size: `${(Math.random() * 3 + 1).toFixed(1)} MB`,
        uploadedBy: li % 2 === 0 ? "Maria Garcia" : "Daniel Adams",
        date: `0${2 + (li % 3)}/${String(8 + (li % 10)).padStart(2, "0")}`,
        fileKind: li % 2 === 0 ? "jpg" : "png",
        lineItemId: line.id,
        previewUrl: ATT_PREVIEW_POOL[(li + index) % ATT_PREVIEW_POOL.length],
        galleryId: `gal-${(li % 4) + 1}`,
      },
    ]);
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
    /* SO rejection flow is hidden — the previously-Rejected demo
       records revert to plain Pending Review so the listing has no
       Rejected pills. Quotes still own the reject/reactivate story. */
    "Pending Review",
    "Cleared",
    "Partially Shipped",
    "Shipped",
    "Shipped",
    "Shipped",
    "Cancelled",
    "Cleared",
    "Pending Review",
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
  /* "Yahya Naveed" represents the signed-in user — seeded as the
     first entry so every Nth-mod-len SO lands on the current user
     as primary, and the additionalSalesReps shuffle naturally picks
     them up in other rows. Without this seed Me mode in the listing
     would return zero records. */
  const reps = ["Yahya Naveed", "Sarah Lindquist", "Michael Tran", "Emily Rios", "David Kowalski", "Jessica Mbeki", "Robert Navarro", "Amanda Chen", "James Hatfield"];
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
    // Every 4th SO gets ~50 line items so the sticky-header / stepper /
    // tab scroll behavior is exercised in every status. Other SOs keep the
    // small 2–6 line spread used elsewhere across the module.
    /* Per-SO line count — varies more obviously across the index so
       the listing doesn't read as "every SO has 49 lines". A handful
       of SOs still get a wider spread (10-15) so the line-grid scroll
       behavior is exercised; the rest range 2-9. The previous 48-55
       ceiling made every fourth SO look identical in the listing
       and crowded the AddLineItemDialog with the same pile of seeded
       pending rows on every open. */
    const lineCount = (i % 7 === 0) ? 10 + (i % 6) : 2 + (i % 8);
    const lines: SOLine[] = [];
    // Code 000-100-195 is the Lot Serialized AED — surfaced on every SO
    // as the second line (j === 1) so the lot+serial allocation flow can
    // be exercised without hunting through 50-line SOs.
    const lotSerializedItem = CATALOG.find(c => c.code === "000-100-195");
    for (let j = 0; j < lineCount; j++) {
      const item = (j === 1 && lotSerializedItem)
        ? lotSerializedItem
        : CATALOG[(i + j) % CATALOG.length];
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
      const pickupSel = pickupForItem(item.code);
      /* Per-line UoM — deterministically seeded from the item's set so
         the table reads with variety (some lines on the primary, some
         on Box/Carton/Pallet or Gallon/Drum / Yard/Roll) without
         every refresh flipping the assignments around. */
      const lineId = `SOL-${i}-${j}`;
      const setId = getUomSetIdForProduct({ itemCode: item.code, itemName: item.name, category: item.category });
      const seededUom = pickSeededUomForLine(lineId, setId).name;
      lines.push({
        id: lineId,
        itemCode: item.code,
        itemName: LONG_LINE_SPECS[item.code] ?? item.name,
        itemType: item.type,
        warehouse: j % 3 === 2 ? "East Hub" : "Main Warehouse",
        orderedQty,
        allocatedQty: lineAllocated,
        pickedQty: isCancelledLine ? 0 : picked,
        shippedQty: isCancelledLine && status !== "Cancelled" ? 0 : shipped,
        deliveredQty: isCancelledLine ? 0 : delivered,
        unitPrice: item.unitPrice,
        uom: seededUom,
        taxRate: 0.08,
        /* Stamp the product-mapped pickup selection so opening the
           Freight & Logistics modal on this line already shows the
           right warehouse + nested location. Same productId → same
           pickup across lines. */
        shipmentConfig: pickupSel ? { pickupLocation: pickupSel } : undefined,
        allocations: (!isCancelledLine && lineAllocated > 0) ? (() => {
          const wh = j % 3 === 2 ? "East Hub" : "Main Warehouse";
          const baseAlloc: Allocation = { id: `ALLOC-${i}-${j}-0`, warehouse: wh, qty: lineAllocated, locked: shipped > 0 };
          if (item.type === "Serialized") {
            baseAlloc.serialNumbers = Array.from({ length: lineAllocated }, (_, si) => `SN-${item.code.slice(-3)}-${String.fromCharCode(65 + ((i + j + si) % 26))}${i * 10 + si + 1}`);
          }
          if (item.type === "Lot Non-Serialized") {
            baseAlloc.lotNumber = `LOT-${item.code.slice(-3)}-${2025 + Math.floor(i / 15)}${String.fromCharCode(65 + (j % 3))}`;
          }
          // Lot Serialized — seed BOTH a lot number AND per-unit serial
          // numbers so the existing allocation card classifies the entry
          // as "Lot + Serial" rather than falling back to plain serial.
          if (item.type === "Lot Serialized") {
            baseAlloc.lotNumber = `LOT-${item.code.slice(-3)}-${2025 + Math.floor(i / 15)}${String.fromCharCode(65 + (j % 3))}`;
            baseAlloc.serialNumbers = Array.from({ length: lineAllocated }, (_, si) => `SN-${item.code.slice(-3)}-${String.fromCharCode(65 + ((i + j + si) % 26))}${String(i * 10 + si + 1).padStart(3, "0")}`);
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
            if (item.type === "Lot Non-Serialized") {
              alloc1.lotNumber = baseAlloc.lotNumber;
              alloc2.lotNumber = `LOT-${item.code.slice(-3)}-${2025 + Math.floor(i / 15)}${String.fromCharCode(65 + ((j + 1) % 3))}`;
            }
            if (item.type === "Lot Serialized") {
              // Split both the serial pool and assign a different lot to
              // the second allocation entry so the demo shows multi-lot
              // multi-location lot+serial allocations.
              alloc1.lotNumber = baseAlloc.lotNumber;
              alloc1.serialNumbers = baseAlloc.serialNumbers?.slice(0, qty1);
              alloc2.lotNumber = `LOT-${item.code.slice(-3)}-${2025 + Math.floor(i / 15)}${String.fromCharCode(65 + ((j + 1) % 3))}`;
              alloc2.serialNumbers = baseAlloc.serialNumbers?.slice(qty1);
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

    /* Generate richer activity logs. Every seeded SO writes its own
       transition chain so the header hover-card timeline reads
       authentic — Rejected rows show "Submitted for Review → Rejected"
       (not "Cleared"), Cleared rows show "Submitted for Review →
       Cleared", etc. */
    const monthPad = String(1 + (i % 12)).padStart(2, "0");
    const activityLog: ActivityEntry[] = [
      { id: `ACT-${i}-0`, timestamp: `2025/${monthPad}/10 09:00`, user: reps[i % reps.length], action: "Created", details: "Sales Order created" },
      { id: `ACT-${i}-1`, timestamp: `2025/${monthPad}/10 09:05`, user: reps[i % reps.length], action: "Updated", details: "Added line items" },
    ];
    /* Effective downstream status — for Archived rows, unfold to the
       state that preceded archival so the pre-archive chain still
       renders on the timeline. */
    const effective = (status === "Archived" ? (previousStatus || "Draft") : status) as SOStatus;

    if (effective !== "Draft") {
      // Submitted for review — every path beyond Draft passes through here.
      activityLog.push({ id: `ACT-${i}-sub`, timestamp: `2025/${monthPad}/11 10:00`, user: reps[i % reps.length], action: "Status Change", details: "Sales Order submitted for review" });
    }
    if (effective === "Rejected") {
      activityLog.push({ id: `ACT-${i}-rej`, timestamp: `2025/${monthPad}/11 14:15`, user: reps[(i + 2) % reps.length], action: "Rejected", details: "Rejected on review — see banner for reason" });
    } else if (previousStatus === "Rejected") {
      /* Reactivated-from-Rejected — the SO went through Rejected and
         has been brought back to Pending Review. Timeline shows the
         full Reject → Reactivate → Pending Review chain. */
      activityLog.push({ id: `ACT-${i}-rej`, timestamp: `2025/${monthPad}/11 14:15`, user: reps[(i + 2) % reps.length], action: "Rejected", details: "Rejected on review — see banner for reason" });
      activityLog.push({ id: `ACT-${i}-react`, timestamp: `2025/${monthPad}/11 16:00`, user: reps[i % reps.length], action: "Status Change", details: "Reactivated — restored to Pending Review" });
    } else if (["Cleared", "Partially Shipped", "Shipped", "Partially Cancelled"].includes(effective)) {
      activityLog.push({ id: `ACT-${i}-clr`, timestamp: `2025/${monthPad}/11 15:30`, user: reps[(i + 2) % reps.length], action: "Cleared", details: "Sales Order cleared — ready for shipping" });
    }
    if (["Pending Review", "Cleared", "Shipped", "Partially Shipped"].includes(effective)) {
      activityLog.push({ id: `ACT-${i}-alloc`, timestamp: `2025/${monthPad}/13 14:30`, user: reps[(i + 1) % reps.length], action: "Allocated", details: "Inventory allocated for all active lines" });
    }
    if (effective === "Partially Shipped" || effective === "Shipped") {
      activityLog.push({ id: `ACT-${i}-ship`, timestamp: `2025/${monthPad}/15 09:45`, user: reps[(i + 3) % reps.length], action: effective === "Shipped" ? "Shipped" : "Partially Shipped", details: effective === "Shipped" ? "All lines shipped" : "First tranche shipped; balance pending" });
    }
    if (status === "Cancelled" || effective === "Cancelled") {
      activityLog.push({ id: `ACT-${i}-cnl`, timestamp: `2025/${monthPad}/14 16:00`, user: reps[i % reps.length], action: "Cancelled", details: "Sales Order cancelled — unshipped reservations released" });
    }
    if (effective === "Partially Cancelled") {
      activityLog.push({ id: `ACT-${i}-pcnl`, timestamp: `2025/${monthPad}/16 11:20`, user: reps[i % reps.length], action: "Lines Cancelled", details: "Some lines cancelled; remaining active lines continue processing" });
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
    /* Dates relative to the real today so every board time preset has
       orders in it: by i % 6, 1 in 6 is within the last week, 2 in 6
       within 30 days, 1 in 6 within 6 months, 1 in 6 within 12 months
       and 1 in 6 older. Requested-on sits a few days before created,
       last-updated a few days after (never in the future). */
    const soDaysAgo = [
      1 + (i * 3) % 6,          // last 7 days
      8 + (i * 7) % 21,         // last 30 days
      10 + (i * 5) % 19,        // last 30 days
      35 + (i * 13) % 135,      // last 6 months
      190 + (i * 11) % 160,     // last 12 months
      400 + (i * 17) % 100,     // older
    ][i % 6];
    const soDay = (daysBack: number) => {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - daysBack);
      return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
    };
    const soCreatedDate = soDay(soDaysAgo);
    const soOrderDate = soDay(soDaysAgo + (i % 5));
    const soLastUpdated = soDay(Math.max(0, soDaysAgo - (5 + (i * 5) % 23)));
    const sourcingData = generateSourcingData(i, lines, status, previousStatus, soOrderDate);

    /* Hydrate per-SO PoCs from the customer's partner record so the
       sidebar's "Point of contacts" tile reads the same names as the
       listing/kanban for the same SO. Without this, SOSidebar fell
       back to its hardcoded six-name SEEDED_POCS. */
    const customerDefaults = getCustomerDefaults(cust.name);
    const soPocs = customerDefaults.pocs.map((p) => ({
      id: `${soId}-${p.id}`,
      name: p.name,
      email: p.email,
      phone: p.phone || undefined,
      initials: p.initials,
      title: p.role,
      isPrimary: p.isPrimary,
    }));
    const soPrimaryPocId = soPocs.find((p) => p.isPrimary)?.id || soPocs[0]?.id || "";

    sos.push({
      id: soId,
      soNumber: `SO-000-000-${String(i).padStart(3, "0")}`,
      customer: cust.name,
      customerInitials: cust.initials,
      customerId: `cust-${cust.initials.toLowerCase()}-${i % 20}`,
      pocs: soPocs,
      primaryPocId: soPrimaryPocId,
      orderDate: soOrderDate,
      warehouse: i % 5 === 4 ? "East Hub" : i % 7 === 6 ? "West Depot" : "Main Warehouse",
      currency: "USD",
      paymentTerms: i % 4 === 0 ? "Net 30" : i % 4 === 1 ? "Net 60" : i % 4 === 2 ? "Due on Receipt" : "Net 45",
      shippingAddress: addresses[i % addresses.length],
      status,
      previousStatus,
      /* Seed rejection reason + comments on any Rejected SO — plus
         reactivated-from-Rejected records (previousStatus === "Rejected")
         so the reactivated state carries the reason forward and both
         banners stack on open. */
      ...(status === "Rejected" || previousStatus === "Rejected" ? {
        rejectionReason: (["Insufficient stock", "Credit limit exceeded or customer on hold", "Pricing or discount outside approved threshold", "Line item error", "Requested delivery date not feasible"] as const)[i % 5],
        rejectionReasonText: (
          i % 5 === 0 ? "Confirm the warehouse pick and re-submit — inventory dropped after the last cycle count."
          : i % 5 === 1 ? "Customer sits above their credit cap; get Finance to release before resubmitting."
          : i % 5 === 2 ? "Discount tier exceeds the 12% cap; reprice per the customer's contract."
          : i % 5 === 3 ? "Duplicate line detected on rows 3-4; consolidate and reduce qty."
          : "Requested delivery slips the chassis 21-day floor; push out or split the order."
        ),
        rejectedAt: new Date().toISOString(),
        rejectedBy: "Approver User",
      } : {}),
      description: [
        `Sales order #${soId} placed by ${cust.name} for ${lineCount} line items totalling $${total.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}.`,
        `Order combines ambulance chassis, lighting, audio, and conversion components. Customer requested split shipment with the chassis lot consolidated under freight forwarder ${reps[0] ?? "TBA"} and the lighting / audio bundle on a separate ground LTL release.`,
        `Internal context: pricing ratified against the customer's master agreement (rev 2024-Q4) — early-pay 2% within 10 days, otherwise net 30 from delivery. Lead times honour the published 21-day floor on chassis and 5-day floor on accessories; any line that slips beyond the floor automatically opens a procurement flag in the Sourcing tab.`,
        `Quality-control gating: chassis lines require VIN attestation prior to invoicing, and serialized lighting bars need photo-doc on each unit before the shipment is released. The customer's QA contact will receive an automated callback when the pick is staged at the dock.`,
        `History: previous orders against this customer have averaged a 4.6-day delta between requested and confirmed delivery, with zero open RMAs in the last twelve months. Treat this as a long-tail relationship — exceptions go to the account-team Slack first, ticket second.`,
      ].join(" "),
      lines,
      shipmentIds: shipmentRefs[soId] || [],
      activityLog,
      inventoryMovements,
      linkedTransactions: generateLinkedTransactions(i, soId, total, `SO-000-000-${String(i).padStart(3, "0")}`, reps, status),
      attachments: generateAttachments(i, soId, lines),
      pickRecords,
      salesRep: reps[i % reps.length],
      createdDate: soCreatedDate,
      /* `lastUpdated` — 5-27 days after createdDate; derived off the
         index so the value stays stable across renders and matches the
         SOList's `dates.lastUpdated` display. Persisted on the record
         (rather than derived at render time) so the advanced-filter
         modal's `lastUpdated` date filter can compare against it. */
      lastUpdated: soLastUpdated,
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
      /* Freight & Logistics config — deterministic per SO index so the
         shipment tab reads a real carrier + method + pickup warehouse
         rather than falling back to seeder-invented strings. Rotates
         through the five SHIPMENT_CARRIERS and picks a default method
         per carrier. Every 4th SO uses customer pickup so both
         departure flavors are covered in the demo.
         `pickupLocation` is the *staging* warehouse — the warehouse
         the carrier / customer collects from — and drives both the
         shipment's ship-from address and the pickup-location field. */
      shipmentConfig: (() => {
        const carrier = SHIPMENT_CARRIERS[i % SHIPMENT_CARRIERS.length];
        const method = carrier.methods.find(m => m.isDefault) ?? carrier.methods[0];
        const warehouse = WAREHOUSES[i % WAREHOUSES.length];
        const isCustomerPickup = i % 4 === 3;
        return {
          ...DEFAULT_SHIPMENT,
          method: (isCustomerPickup ? "customer-pickup" : "courier-pickup") as any,
          carrierId: carrier.id,
          carrierMethodId: method.id,
          pickupLocation: { warehouseIds: [warehouse.id] },
          ...(isCustomerPickup ? {
            authorizedPersonName: "Jordan Reeves",
            authorizedPersonPhone: "+1 (555) 218-4472",
          } : {}),
        };
      })(),
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
/* Name-only customer demo. SO-000-000-019 (first row of listing page
   2) is rewritten as a fresh Draft for SAMPLE_EMPTY_CUSTOMER, which has
   nothing on file but its name. Every customer-derived field is set to
   an explicit empty value ('' / []) so each surface renders its empty
   state instead of invented data. Runs before shipments are built so
   no shipment, pick or invoice is generated for it. */
const EMPTY_CUSTOMER_SO_NUMBER = "SO-000-000-019";
function applyEmptyCustomerDemo(sos: SalesOrder[]): void {
  const so = sos.find((s) => s.soNumber === EMPTY_CUSTOMER_SO_NUMBER);
  if (!so) return;
  Object.assign(so, {
    customer: SAMPLE_EMPTY_CUSTOMER.name,
    customerInitials: SAMPLE_EMPTY_CUSTOMER.initials,
    customerId: SAMPLE_EMPTY_CUSTOMER.id,
    pocs: [],
    primaryPocId: "",
    shippingAddress: "",
    billingAddress: "",
    paymentTerms: "",
    paymentMethod: "",
    salesRep: "",
    salesReps: [],
    description: "",
    status: "Draft" as SOStatus,
    previousStatus: undefined,
    rejectionReason: undefined,
    rejectionReasonText: undefined,
    rejectedAt: undefined,
    rejectedBy: undefined,
    sourceQuoteRef: "",
    rfqRef: "",
    tags: [],
    internalNotes: "",
    shipmentIds: [],
    inventoryMovements: [],
    pickRecords: [],
    linkedTransactions: [],
    procurementOrders: [],
    backorders: [],
    sourcingStatus: "N/A" as SourcingStatus,
    version: { number: 1, label: "Latest", date: so.createdDate } as SOVersion,
    versions: [{ number: 1, label: "Latest", date: so.createdDate } as SOVersion],
    activityLog: [
      { id: `ACT-${so.id}-created`, timestamp: so.createdDate, user: "Current User", action: "Created", details: "Sales Order created" },
    ],
    lines: so.lines.map((l) => ({
      ...l,
      allocatedQty: 0,
      pickedQty: 0,
      shippedQty: 0,
      deliveredQty: 0,
      allocations: [],
      cancelled: false,
      cancelledQty: 0,
      cancelledReason: undefined,
      cancelAction: undefined,
      readyToPick: false,
    })),
  });
}

function initializeMockData(): { sos: SalesOrder[]; shipments: Shipment[] } {
  const rawSOs = generateMockSOs();
  applyEmptyCustomerDemo(rawSOs);
  const { shipments, refs } = buildShipmentsForSOs(rawSOs);
  // Patch shipmentIds into each SO
  const sos = rawSOs.map(so => ({
    ...so,
    shipmentIds: refs[so.id] || [],
  }));

  /* Hero record for the "Outdated Configurations" demo. Its stable
     id (`so-outdated-demo`) is the key the shared outdatedConfigs
     registry populates — every other SO returns [] and reads as up
     to date. Clone sos[0] so the lines / activity log / sourcing
     data are all realistic, then override identity + surface metadata.
     Splice at index 2 so it sits at listing position #3. */
  if (sos.length > 0) {
    const template = sos[0];
    const hero: SalesOrder = {
      ...template,
      id: 'so-outdated-demo',
      soNumber: 'SO-000-000-042',
      customer: 'Metro City Fire & Rescue',
      customerInitials: 'MC',
      customerId: 'cust-mc-outdated',
      status: 'Draft',
      priority: 'High',
      orderDate: '2026/05/28',
      createdDate: '2026/05/14',
      currency: 'USD',
      description: 'Type III ambulance conversion — Metro City Fire & Rescue. Configuration is drifting from upstream modules (currency, ship-to, pricing rule tier, sales rep). Review the pending updates from the header pill.',
      shipmentIds: [],
      /* Fresh activityLog copy so mutations on the hero don't leak
         back into template records via shared reference. */
      activityLog: [...(template.activityLog || [])],
    };
    sos.splice(2, 0, hero);
  }

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
  /* Ship to + active lines come from the shared FIELD_RULES so the
     detail page can outline the same fields this check blocks on. */
  for (const rule of getReleaseBlockers(so)) errors.push(rule.missingMessage);
  return { valid: errors.length === 0, errors };
}

/** Release-stage fields that are still empty on this SO, in display
 *  order. Drives both the confirm check above and the inline red
 *  outlines on the detail page. */
export function getReleaseBlockers(so: SalesOrder): FieldRule[] {
  return getMissingFields(
    {
      shipTo: so.shippingAddress,
      lineItems: so.lines.filter((l) => !l.cancelled),
    },
    "release",
  );
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
  /** Approver-only. Moves the SO into Rejected + records reason and
   *  optional comments. Releases every non-locked allocation back to
   *  available stock so held units don't linger. Reactivation happens
   *  through `reactivateRejectedSO`; the rejection fields stay on the
   *  SO so the banner keeps rendering after reactivation. */
  rejectSO: (id: string, reason: SORejectionReason, reasonText: string, attachments?: File[]) => void;
  /** Restores a rejected SO to the state it was in before the reject
   *  (typically Pending Review) on the SAME version. Mirrors the
   *  Cancel + Archive reactivation semantics. */
  reactivateRejectedSO: (id: string) => void;
  /** Alternative reactivation path: creates a new draft version
   *  (V+1) from the current rejected SO so the sales rep can revise
   *  line items / terms before re-submitting. The prior version is
   *  preserved in `versions[]`; rejection fields are cleared on the
   *  new draft so the banner doesn't leak forward. */
  reactivateRejectedAsNewDraft: (id: string) => void;
  cancelSO: (id: string, reason?: string, reasonText?: string) => void;
  cancelSOLines: (soId: string, lineIds: string[], reason?: string, cancelQtys?: Record<string, number>) => void;
  deliverSO: (id: string, deliveryQtys?: Record<string, number>) => void;
  archiveSO: (id: string) => void;
  unarchiveSO: (id: string) => void;
  reactivateSO: (id: string) => void;
  createVersionDraft: (id: string) => void;
  revertToVersion: (id: string, fromVersion: number) => void;
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

/* ── One-time adjustments on imported orders ──
   An order brought in from a legacy file can arrive with discounts and
   premiums already on it, at order level and at line level. They are not
   part of the `SalesOrder` record (the module keeps adjustments in its own
   `useAdjustments` layer), so they wait here until the detail page opens
   and seeds that layer from them. */
const importedAdjustments: Map<string, unknown[]> = new Map();

export function setImportedAdjustments(soId: string, adjustments: unknown[]): void {
  if (adjustments.length > 0) importedAdjustments.set(soId, adjustments);
}

export function getImportedAdjustments(soId: string): unknown[] | undefined {
  return importedAdjustments.get(soId);
}

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
      /* Normally the store numbers the order itself. A legacy import
         passes the number its old system printed, and keeping it is the
         point of that import, so an incoming number wins. */
      soNumber: partial.soNumber || `SO-000-000-${id.split("-")[1]}`,
      customer: partial.customer || "",
      customerInitials: partial.customerInitials || (partial.customer || "").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase(),
      customerId: partial.customerId,
      pocs: partial.pocs,
      primaryPocId: partial.primaryPocId,
      orderDate: partial.orderDate || new Date().toISOString().split("T")[0].replace(/-/g, "/"),
      warehouse: partial.warehouse || "Main Warehouse",
      currency: partial.currency || "USD",
      /* `??` not `||`: an explicit "" means "not set" (e.g. a name-only
         customer) and must stay empty instead of becoming Net 30. */
      paymentTerms: partial.paymentTerms ?? "Net 30",
      shippingAddress: partial.shippingAddress ?? "",
      billingAddress: partial.billingAddress,
      paymentMethod: partial.paymentMethod,
      /* Same reasoning as the number: an order that shipped in the
         legacy system should not arrive here as a fresh Draft. */
      status: partial.status || "Draft",
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
      salesRep: partial.salesRep ?? "Current User",
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
      salesReps: partial.salesReps ?? (partial.salesRep === "" ? [] : [{ name: partial.salesRep || "Current User", primary: true }]),
      /* ── Versioning & Priority ── */
      version: partial.version || { number: 1, label: "Latest", date: new Date().toISOString().split("T")[0].replace(/-/g, "/") },
      priority: partial.priority || "Standard",
      versions: partial.versions || [{ number: 1, label: "Latest", date: new Date().toISOString().split("T")[0].replace(/-/g, "/") }],
      /* ── Sourcing & Production ── */
      procurementOrders: partial.procurementOrders || [],
      backorders: partial.backorders || [],
      sourcingStatus: partial.sourcingStatus || "Not Started",
      legacyImport: partial.legacyImport,
      createdViaUI: true,
    };
    setSalesOrders(prev => [so, ...prev]);
    return so;
  }, []);

  const updateSO = useCallback((id: string, updates: Partial<SalesOrder>) => {
    setSalesOrders(prev => prev.map(so => {
      if (so.id !== id) return so;
      const updated = { ...so, ...updates };
      /* Recompute total to include freight, mirroring updateSOLine.
         When a per-line override exists on any line, the inherited
         lines fall back to the order-level freight; when no line has
         an override the order-level freight is the single charge. */
      const anyLineOverride = updated.lines.some((l) => typeof l.shipmentCost === 'number');
      const linesSubtotal = updated.lines.reduce((s, l) => s + l.orderedQty * l.unitPrice * (1 + l.taxRate), 0);
      const freightTotal = anyLineOverride
        ? updated.lines.reduce((s, l) => s + (typeof l.shipmentCost === 'number' ? l.shipmentCost : (updated.freightCost ?? 0)), 0)
        : (updated.freightCost ?? 0);
      updated.total = linesSubtotal + freightTotal;
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
        /* Fresh submission — clear any lingering rejection state so
           the reactivated draft graduates cleanly. The banner falls
           away once the SO is back in review. */
        rejectionReason: undefined,
        rejectionReasonText: undefined,
        rejectedAt: undefined,
        rejectedBy: undefined,
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
        /* Fresh clearance — wipe any lingering rejection state so the
           reactivated + resubmitted draft graduates cleanly. */
        rejectionReason: undefined,
        rejectionReasonText: undefined,
        rejectedAt: undefined,
        rejectedBy: undefined,
        activityLog: [...s.activityLog, addActivity(s, "Cleared", "Sales Order cleared — ready for shipping")],
      };
    }));
    return validation;
  }, [salesOrders]);

  /* Reject SO — approver-only. Pending Review → Rejected. Records the
     approver's structured reason + mandatory comments and releases
     every non-locked allocation on the SO so held stock returns to
     available inventory. Locked allocations (already shipped units)
     stay put — the "Rejected" flow is a work-instruction back to the
     sales rep, not a cancellation. */
  const rejectSO = useCallback((id: string, reason: SORejectionReason, reasonText: string, attachments?: File[]) => {
    setSalesOrders(prev => prev.map(s => {
      if (s.id !== id || s.status !== "Pending Review") return s;
      /* Release unlocked allocations back to stock. Locked ones stay
         (they belong to units already committed downstream and are
         out of scope for a review-time rejection). */
      const releasedLines = s.lines.map(l => ({
        ...l,
        allocations: l.allocations.filter(a => a.locked),
      }));
      /* Persist files from the reject modal as Attachment records
         under the "rejection" category so they surface in the
         Attachments tab as a dedicated source. `URL.createObjectURL`
         gives images a live blob preview for the session; non-image
         files show as icon cards. */
      const newAttachments: Attachment[] = (attachments ?? []).map((f, idx) => {
        const ext = (f.name.split(".").pop() || "").toLowerCase();
        const fileKind: FileKind = (
          ext === "pdf" ? "pdf"
          : ext === "xlsx" || ext === "xls" ? "xlsx"
          : ext === "docx" || ext === "doc" ? "doc"
          : ext === "csv" ? "csv"
          : ext === "png" ? "png"
          : ext === "jpg" || ext === "jpeg" ? "jpg"
          : ext === "mp3" ? "mp3"
          : ext === "mp4" ? "mp4"
          : ext === "dxf" ? "dxf"
          : ext === "stl" ? "stl"
          : ext === "dwg" ? "dwg"
          : "pdf"
        );
        const sizeStr = f.size < 1024 ? `${f.size} B`
          : f.size < 1024 * 1024 ? `${(f.size / 1024).toFixed(1)} KB`
          : `${(f.size / (1024 * 1024)).toFixed(1)} MB`;
        const isImage = fileKind === "png" || fileKind === "jpg";
        return {
          id: `ATT-${s.id}-rej-${Date.now()}-${idx}`,
          name: f.name,
          description: `Uploaded with rejection: ${reason}`,
          size: sizeStr,
          uploadedBy: "Current User",
          date: (() => {
            const d = new Date();
            return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
          })(),
          category: "rejection",
          fileKind,
          inOrder: false,
          previewUrl: isImage ? URL.createObjectURL(f) : undefined,
        };
      });
      return {
        ...s,
        status: "Rejected" as const,
        /* Record where the SO paused so Reactivate can resume the same
           version at the same state (parity with Cancel + Archive). */
        previousStatus: s.status,
        lines: releasedLines,
        rejectionReason: reason,
        rejectionReasonText: reasonText,
        rejectedAt: new Date().toISOString(),
        rejectedBy: "Current User",
        attachments: [...s.attachments, ...newAttachments],
        activityLog: [
          ...s.activityLog,
          addActivity(s, "Rejected", `Rejected on review. ${reason}${reasonText ? `. ${reasonText}` : ""}${newAttachments.length ? ` (${newAttachments.length} attachment${newAttachments.length === 1 ? "" : "s"})` : ""}`),
        ],
      };
    }));
  }, []);

  /* Reactivate from Rejected — resume the same version at the state
     the SO was in before rejection (mirrors reactivateSO / unarchiveSO
     semantics for Cancel + Archive). No new draft version; the ask is
     "restore, not fork". */
  const reactivateRejectedSO = useCallback((id: string) => {
    setSalesOrders(prev => prev.map(s => {
      if (s.id !== id || s.status !== "Rejected") return s;
      const restored = (s.previousStatus as SOStatus) || "Pending Review";
      return {
        ...s,
        status: restored,
        previousStatus: undefined,
        /* Rejection reason + timestamp stay on the record so the banner
           keeps rendering after reactivation — the rep still needs to
           see what to fix. Cleared when the SO progresses to a fresh
           review / clearance (markUnconfirmed / confirmSO both wipe). */
        activityLog: [
          ...s.activityLog,
          addActivity(s, "Reactivated", `Sales Order reactivated to ${restored} state after rejection`),
        ],
      };
    }));
  }, []);

  /* Alternative reactivation from Rejected — spins up a V+1 Draft
     from the rejected SO. Prior version is preserved in `versions[]`
     (labeled "Last Approved" so the version dropdown still surfaces
     it); the new draft carries a fresh slate — rejection fields
     cleared, unlocked allocations released. Rep can now revise the
     draft and re-submit. */
  const reactivateRejectedAsNewDraft = useCallback((id: string) => {
    setSalesOrders(prev => prev.map(s => {
      if (s.id !== id || s.status !== "Rejected") return s;
      const newVersionNum = (s.version?.number ?? 1) + 1;
      const newVersion: SOVersion = {
        number: newVersionNum,
        label: "Latest",
        date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      };
      const updatedVersions = (s.versions || []).map(v =>
        v.number === s.version?.number ? { ...v, label: "Last Approved" as const } : v
      );
      /* Release any non-locked allocations (same as `rejectSO`) so
         the new draft starts with a clean stock picture. */
      const releasedLines = s.lines.map(l => ({
        ...l,
        allocations: l.allocations.filter(a => a.locked),
      }));
      return {
        ...s,
        status: "Draft" as SOStatus,
        previousStatus: undefined,
        version: newVersion,
        versions: [...updatedVersions, newVersion],
        lines: releasedLines,
        rejectionReason: undefined,
        rejectionReasonText: undefined,
        rejectedAt: undefined,
        rejectedBy: undefined,
        activityLog: [
          ...s.activityLog,
          addActivity(s, "Version Created", `Started V${newVersionNum} draft from Rejected. Revise and re-submit.`),
        ],
      };
    }));
  }, []);

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

  // Reactivate: restore a Cancelled or Archived SO to its prior state
  // in-place — no version bump. Mirrors `unarchiveSO`. The active
  // version and its data are preserved exactly; the SO simply resumes
  // from whatever status it held before the cancel/archive transition.
  const reactivateSO = useCallback((id: string) => {
    setSalesOrders(prev => prev.map(so => {
      if (so.id !== id) return so;
      if (so.status !== "Cancelled" && so.status !== "Partially Cancelled" && so.status !== "Archived") return so;
      const restored = (so.previousStatus as SOStatus | undefined) || ("Draft" as SOStatus);
      return {
        ...so,
        status: restored,
        previousStatus: undefined,
        cancellationReason: undefined,
        cancellationReasonText: undefined,
        cancellationRequestedAt: undefined,
        cancellationRequestedBy: undefined,
        lines: so.lines.map(l => ({
          ...l,
          cancelled: false,
          cancelledQty: 0,
          cancelledReason: undefined,
          cancelAction: undefined,
        })),
        activityLog: [...so.activityLog, addActivity(so, "Reactivated", `Sales Order reactivated to ${restored} state`)],
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
        activityLog: [...so.activityLog, addActivity(so, "Version Created", `Started V${newVersionNum} draft from ${so.status} after a material change.`)],
      };
    }));
  }, []);

  // Revert-in-place: V[fromVersion] becomes the SO's active version
  // without adding a new entry. The SO's status flips back to
  // whatever V[fromVersion] historically had. A subsequent material
  // change will trigger the normal auto-version flow which creates
  // V[max+1] via createVersionDraft.
  const revertToVersion = useCallback((id: string, fromVersion: number) => {
    setSalesOrders(prev => prev.map(so => {
      if (so.id !== id) return so;
      const allVersions = so.versions || [];
      const targetEntry = allVersions.find(v => v.number === fromVersion);
      if (!targetEntry) return so;
      // Update the labels: target becomes "Latest", others lose "Latest"
      const updatedVersions = allVersions.map(v => ({
        ...v,
        label: v.number === fromVersion ? ('Latest' as const) : (v.label === 'Latest' ? ('Last Approved' as const) : v.label),
      }));
      // Restore historical status if recorded on the version entry; else
      // keep current status. SOVersion may have a `status` field — if
      // not, default to "Cleared" as a safe restore.
      const restoredStatus = (targetEntry as any).status as SOStatus | undefined;
      return {
        ...so,
        status: restoredStatus || so.status,
        version: { ...targetEntry, label: 'Latest' as const },
        versions: updatedVersions,
        activityLog: [...so.activityLog, addActivity(so, 'Version Reverted', `Reverted to V${fromVersion} — now the latest version`)],
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
        uom: line.uom || "EA",
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
      /* SO total = sum(line subtotal × (1 + tax)) + per-line freight
         overrides + (order-level freight when no line carries one).
         When at least one line has a per-line `shipmentCost`, the
         order-level `freightCost` becomes the fallback for inherited
         lines: each line uses its own override OR the order default
         so the math stays consistent with FreightBreakdownModal. */
      const anyLineOverride = updated.lines.some((l) => typeof l.shipmentCost === 'number');
      const linesSubtotal = updated.lines.reduce((s, l) => s + l.orderedQty * l.unitPrice * (1 + l.taxRate), 0);
      const freightTotal = anyLineOverride
        ? updated.lines.reduce((s, l) => s + (typeof l.shipmentCost === 'number' ? l.shipmentCost : (updated.freightCost ?? 0)), 0)
        : (updated.freightCost ?? 0);
      updated.total = linesSubtotal + freightTotal;
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
    createSO, updateSO, markUnconfirmed, confirmSO, rejectSO, reactivateRejectedSO, reactivateRejectedAsNewDraft, cancelSO, cancelSOLines, deliverSO, archiveSO, unarchiveSO, reactivateSO, createVersionDraft, revertToVersion,
    addSOLine, updateSOLine, deleteSOLine,
    allocate, deallocate,
    createShipment, updateShipmentStatus, updateShipmentLinePicked, deleteShipment, reverseShipment,
    getAvailable, getInventoryForItem, deriveSOStatus,
  };

  return <SOContext.Provider value={store}>{children}</SOContext.Provider>;
}