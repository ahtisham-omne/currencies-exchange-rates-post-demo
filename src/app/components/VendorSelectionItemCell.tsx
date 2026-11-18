import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Hash, Layers, ShoppingCart } from 'lucide-react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/app/components/ui/hover-card';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';

/**
 * Item-cell presentation shared by every surface that lists a line item —
 * the vendor lens's PO and receipt tables, and the flat Item / PO /
 * Receiving lenses. It lived inside VendorSelectionModalNested until the
 * flat lenses needed the same cell; importing it back from there would
 * have made the two modules circular, so it moved here instead.
 *
 * All the mock master-data helpers are deterministic on the item number,
 * so the same item draws the same image and metadata on every surface.
 */


// External Items module URL — opened in a new tab when an item code is
// clicked, matching partner Items column behavior.
export const ITEMS_MODULE_URL = 'https://nimble-palette.lovable.app';

// Deterministic per-item image picker — same partner pattern: a stable
// FNV-style string hash picks one of N pre-vetted Unsplash photos so every
// item number gets a unique image. IDs match the partner Items column + the proven
// set already used in mockVendors so we know they resolve.
const ITEM_IMAGES = [
  'photo-1772209049802-cd0e0ff1a5d3',
  'photo-1713575882582-8938739db351',
  'photo-1737223450913-2af6885945e1',
  'photo-1759159091728-e2c87b9d9315',
  'photo-1661069387900-54d5843b704d',
  'photo-1758873263527-ca53b938fbd4',
  'photo-1672689933227-2ce1249c46a9',
  'photo-1767340078306-89630b12d81c',
  'photo-1769355104335-acef3aa4c9b6',
  'photo-1758857087505-957823893209',
];
export const imageForSku = (sku: string) => {
  let h = 0;
  for (let i = 0; i < sku.length; i++) h = sku.charCodeAt(i) + ((h << 5) - h);
  const photo = ITEM_IMAGES[Math.abs(h) % ITEM_IMAGES.length];
  return `https://images.unsplash.com/${photo}?w=160&h=160&fit=crop&auto=format&q=80`;
};

// Partner ItemQuickView parity: stable string hash + a multi-photo pool so
// every item number resolves a deterministic 2-3 image carousel set, plus mock
// master-data metadata (category, UOM, inventory control, acquisition,
// unit price, lead time) for the rich detail modal opened on item-image
// click. No stock-level data — vendor invoices don't surface it.
const hashStr = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
};
const ITEM_PHOTOS_LARGE = ITEM_IMAGES.map(p => `https://images.unsplash.com/${p}?w=600&h=400&fit=crop&auto=format&q=80`);
export const photosForSku = (sku: string) => {
  const base = hashStr(sku);
  const count = (base % 2) + 2; // 2 or 3 photos
  return Array.from({ length: count }, (_, i) => ITEM_PHOTOS_LARGE[(base + i) % ITEM_PHOTOS_LARGE.length]);
};
const ITEM_UOMS = ['EA', 'FT', 'PK', 'RL', 'KG', 'LB', 'BOX', 'SET'];
export const formatCurrency = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
// Full deterministic item data — combines hover-card meta with extras
// needed by the QuickView (UOM, leadTime, longer desc).
export function mockItemDataFull(sku: string, fallbackDesc?: string) {
  const meta = itemMetaFor(sku);
  const h = hashStr(sku);
  const uom = ITEM_UOMS[h % ITEM_UOMS.length];
  const unitPrice = ((hashStr(sku + 'p') % 500) + 10) + 0.99;
  const leadTime = (hashStr(sku + 'l') % 14) + 3;
  const desc = longDescriptionFor(sku, fallbackDesc || '');
  return { ...meta, uom, unitPrice, leadTime, desc };
}

// Deterministic per-item item metadata (category / inventory control /
// acquisition / price / short HoverCard description). Mirrors the
// Inventory > Items master-data fields — stock-level status is
// intentionally NOT surfaced here: on a vendor invoice you bill what
// was ordered/received, so on-hand / out-of-stock isn't relevant.
const ITEM_CATEGORIES = ['Raw Material', 'Component', 'Assembly', 'Consumable', 'Finished Good'];
const ITEM_INVENTORY_CONTROLS = ['Serialized', 'Non-Serialized'] as const;
const ITEM_ACQUISITIONS = ['Purchase', 'Manufacturing'] as const;
const ITEM_SHORT_DESCS = [
  'Industrial-grade component, batch-tracked, ready for production.',
  'Mill-certified raw material, ASTM-compliant.',
  'High-tolerance machined part for OEM assembly.',
  'Consumable supply, replenished on PAR-level schedule.',
  'Finished-good inventory item, pick-pack-ready.',
];
export const itemMetaFor = (sku: string) => {
  let h = 0;
  for (let i = 0; i < sku.length; i++) h = sku.charCodeAt(i) + ((h << 5) - h);
  const ah = Math.abs(h);
  const category = ITEM_CATEGORIES[ah % ITEM_CATEGORIES.length];
  const inventoryControl = ITEM_INVENTORY_CONTROLS[ah % ITEM_INVENTORY_CONTROLS.length];
  const acquisition = ITEM_ACQUISITIONS[(ah * 3) % ITEM_ACQUISITIONS.length];
  const shortDesc = ITEM_SHORT_DESCS[ah % ITEM_SHORT_DESCS.length];
  const price = `$${(((ah * 7) % 500) + 10).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return { category, inventoryControl, acquisition, shortDesc, price };
};

// Synthesize a longer realistic item description for any item number. Keeps the
// underlying mockVendors.ts shape untouched — wraps the existing
// description with category-specific tail text for visual variety.
export const DEFAULT_ITEM_TAIL =
  'Industrial-grade component sourced from a certified mill, batch-tracked through receiving QA, and approved for production-line use. Includes COA and mill-test report on request.';

/** What each part actually is, in the words a buyer or a storeman would use.
 *
 *  These were keyed on the SKU's prefix, which meant every ELEC- part was
 *  described as a 450V power management IC, every SAFE- part as a hard hat,
 *  and everything whose prefix was not in the list -- most of the book --
 *  carried one identical paragraph about a certified mill. On a return listing
 *  eight parts, seven of them read the same.
 *
 *  One per part. A washer is not a bolt, a fibre trunk is not a mains cable,
 *  and a vest is not a helmet. */
const ITEM_TAILS: Record<string, string> = {
  // Electronics -- serialized, one serial per physical unit.
  'ELEC-M-992':
    'Synchronous buck controller in a TO-263 package, 450V input, 92% peak efficiency at 10A. Rated -40 to 125C, IEC 60068 qualified, shipped in anti-static tubes with per-unit traceability.',
  'ELEC-CAP-470':
    'Radial aluminium electrolytic, 470uF at 50V, 105C rated with 5,000-hour endurance and low ESR for switching supplies. Sleeve-marked with date code and lot.',
  'ELEC-PCB-A4':
    'Single-layer FR4 substrate, 1.6mm, 1oz copper with HASL finish and IPC-A-600 Class 2 acceptance. Panelised four-up, V-scored, solder-mask green over bare copper.',
  'ELEC-LED-W5':
    '5W white LED module, 4000K neutral, 620 lumens on an MCPCB star with Zhaga-compatible footprint. Binned to a 3-step MacAdam ellipse for run-to-run colour match.',
  'ELEC-SENS-T1':
    'PT100 class-A RTD in a 6mm stainless sheath with M12 connection head, -50 to 400C, 3-wire. Individually calibrated against a traceable reference, certificate per serial.',

  // Cabling.
  'CAB-XL-10':
    '10 AWG stranded tinned copper with XLPE insulation and a braided drain shield, 600V NEC. Sunlight and oil resistant, for motor leads, panel feeds and outdoor runs.',
  'CAB-FOC-12':
    '12-strand single-mode OS2 loose-tube trunk, gel-filled with a corrugated steel armour and LSZH jacket. Direct-burial rated, factory OTDR-tested end to end.',
  'CAB-CAT6-FT':
    'Plenum-rated CAT6 with a solid bare-copper core and a cross-filler spline, CMP jacket to NFPA 262. Sweep-tested to 550MHz, supplied on numbered 1000ft reels.',

  // Hardware.
  'BRKT-IND-22':
    '12 gauge hot-dipped galvanized mounting bracket, 90 degree, pre-drilled on a 3/8 inch hole pattern. Powder-coated over the zinc for indoor or outdoor service, hardware included.',
  'BOLT-M12-H':
    'M12 x 50mm hex head cap screw in A2-70 stainless, fully threaded, DIN 933. Rolled thread for fatigue strength, non-magnetic, supplied 100 to the box.',
  'NUT-M12-L':
    'M12 nyloc lock nut, A2 stainless, DIN 985, with a polyamide insert rated to 120C. Reusable up to five times before the insert loses grip, 200 to the box.',
  'WASH-M12':
    'M12 flat washer, zinc-plated carbon steel to DIN 125A, 24mm outside diameter and 2.5mm thick. Spreads load under a hex head on soft or oversized holes, batch-numbered per unit.',

  // Raw material.
  'STEEL-001':
    '2 inch schedule 40 pipe, ASTM A53 Grade B seamless, mill certified to ISO 9001 and supplied in 21 foot random lengths. Plain ends, black finish, heat number rolled into the wall.',
  'STEEL-SHEET-4':
    '4mm hot-rolled sheet, ASTM A36, 1250 x 2500mm with mill scale left on. Normalized and stress-relieved so it stays flat through laser cutting and forming.',
  'ALU-EXT-2X':
    '2 x 2 inch T-slot extrusion in 6105-T5 aluminium, clear anodized, with four 10mm slots on a 20mm boss. Cut to length by the foot for frames, guarding and conveyor stands.',
  'COPPER-042':
    '1/2 inch NPT wrought copper fitting, 99.9% pure, ASME B16.22, deburred and chamfered for a clean solder joint. RoHS compliant, for potable water and HVAC line sets.',

  // Welding and tools.
  'WELD-99':
    'E7018 low-hydrogen electrode, 1/8 inch, AWS A5.1, with an iron-powder flux that runs a quiet arc in all positions. Hermetically sealed; rebake at 250C if the tin has been open.',
  'WELD-WIRE-S':
    'ER70S-6 solid MIG wire, 0.045 inch, copper-coated and layer-wound on a 33lb spool. High silicon and manganese for wetting through mill scale and light rust.',
  'TOOL-DRL-18V':
    '18V brushless drill driver, 1/2 inch metal chuck, 60Nm of torque across two speeds and a 20-position clutch. Kit includes two 4.0Ah packs, a fast charger and a moulded case.',
  'TOOL-WRN-MET':
    '12-piece combination wrench set, 8 to 19mm, chrome-vanadium steel with a mirror-polished finish. Offset 12-point ring end, open end broached to 15 degrees, roll pouch included.',
  'TOOL-CAL-DG':
    '6 inch digital caliper in hardened stainless, 0.01mm resolution with an IP54 seal against coolant and swarf. Inside, outside, depth and step jaws, with a calibration certificate.',

  // Sold by one vendor group each, across both of that group's branches.
  'PUMP-CI-40':
    'Close-coupled centrifugal pump with a cast iron casing and a 40mm discharge, bronze impeller on a stainless shaft. Mechanical seal, flange mounted to a 2-pole motor, for clean water duty.',
  'PLATE-AL-6':
    '6mm 5052-H32 aluminium plate, mill finish, 1220 x 2440mm. Marine grade and readily formed, so it takes a brake and welds without cracking at the bend.',

  // Hydraulic.
  'HYD-FL-5L':
    'ISO VG 46 anti-wear hydraulic oil, zinc additive, oxidation stabilized for long drain intervals. Meets Denison HF-0 and Vickers M-2950-S, 5 litre pack.',
  'HYD-HOSE-1':
    '1 inch two-wire braid hose to SAE 100R2AT, 4,000 psi working pressure, with an oil-resistant nitrile tube and an abrasion-resistant cover. Cut and crimped to length.',
  'HYD-PMP-A2':
    'External gear pump, 2.5 GPM at 1800 rpm, 3,000 psi continuous, with an aluminium body and a SAE A 9-tooth spline. Bidirectional, for power packs and mobile circuits.',

  // Safety and PPE.
  'SAFE-H-01':
    'Type I Class E hard hat to ANSI Z89.1, dielectric to 20kV, with a 4-point ratchet suspension and a vented shell. Replaceable sweatband, accessory slots for muffs and a face shield.',
  'SAFE-GLASS':
    'Wraparound safety spectacle, polycarbonate lens to ANSI Z87.1+, anti-fog inside and hard-coated outside. 99.9% UV block, soft nose bridge, adjustable temples.',
  'SAFE-VEST-HV':
    'Class 2 high-visibility vest to ANSI/ISEA 107, fluorescent yellow with 2 inch silver retroreflective tape. Breathable knit, five pockets, hook-and-loop front.',
  'GLOVE-B':
    'Cut level ANSI A4 glove on an HPPE and glass-fibre liner with a polyurethane palm coat. Touchscreen-capable fingertips, machine washable, sold loose by weight.',
  'EAR-PRO-PK':
    'Disposable tapered foam plug, NRR 32dB, slow-recovery polyurethane that seals without pressure. Uncorded, individually wrapped, 200 pairs to the box.',

  // Office and tech.
  'TECH-PC-01':
    'Small form-factor workstation, 8-core CPU, 32GB ECC memory and a 1TB NVMe drive, with a VESA mount and a keyboard and mouse. Imaged to the standard build, 3-year onsite warranty.',
  'TECH-MON-27':
    '27 inch 4K IPS monitor, 3840 x 2160 at 60Hz, 400 nits and 99% sRGB, with HDMI 2.0 and DisplayPort 1.4. Height, tilt and pivot stand, VESA 100 pattern behind it.',
  'OFFICE-CHR':
    'Mesh-back task chair with a synchro-tilt mechanism, adjustable lumbar and 4D arms, rated to 135kg. BIFMA tested, gas lift with a 120mm stroke, carpet castors fitted.',

  // Packaging and consumables.
  'PKG-BOX-L':
    '18 x 18 x 18 inch regular slotted carton in 32 ECT double-wall board, kraft, plain. Ships flat and folds without a scorer, stacks four high on a pallet.',
  'PKG-WRAP-R':
    '18 inch cast stretch film, 80 gauge, 1500 foot roll on a 3 inch core with a quiet release. 250% stretch, clings on one side only so pallets do not bond to each other.',
  'PKG-LABEL-4':
    '4 x 6 inch direct thermal label, perforated, 250 to the stack, with a permanent acrylic adhesive that holds on corrugate at freezer temperature. No ribbon required.',

  // Stock with no receiver behind it.
  'MISC-BRG-88':
    '88mm tapered roller bearing, cup and cone, case-hardened chrome steel to ABEC-1. Takes combined radial and thrust load on gearbox and wheel-hub shafts.',
  'MISC-VLV-12':
    '1/2 inch brass gate valve, non-rising stem, 200 WOG, with a solid wedge and a threaded bonnet. Full bore when open, for on-off isolation rather than throttling.',
  'MISC-GSKT-KIT':
    'Assorted gasket and seal kit: nitrile O-rings, fibre washers and a compressed sheet set, in a partitioned case. Covers the common imperial and metric sizes for pump and valve rebuilds.',
};

export const longDescriptionFor = (sku: string, baseDescription: string): string => {
  // By part, then by family, then the catch-all. A part number the catalogue
  // does not carry is still described by what it evidently is.
  const byPrefix: Record<string, string> = {
    STEEL: 'Mill certified and batch-traceable from receiving through QA inspection.',
    ELEC: 'Industrial grade, IEC 60068 environmental compliance, with full traceability documentation.',
    CAB: 'Industrial grade conductor, suitable for control panels, motor leads and outdoor runs.',
    HYD: 'Oxidation stabilized for extended service on industrial gear and hydraulic systems.',
    SAFE: 'Certified personal protective equipment, inspected before issue and replaced on schedule.',
    PKG: 'Warehouse consumable, stocked to a PAR level and replenished on a standing order.',
  };
  const prefix = sku.split(/[-_\s]/)[0]?.toUpperCase() ?? '';
  const tail = ITEM_TAILS[sku] ?? byPrefix[prefix] ?? DEFAULT_ITEM_TAIL;
  return baseDescription ? `${baseDescription}, ${tail}` : tail;
};

// Item image with partner-pattern HoverCard preview. Hovering the image
// opens a quick-preview card (slate-800 gradient header + white details:
// category, on-hand qty, unit price, status pill). Clicking still fires
// the lightbox preview wiring.
export function ItemImageWithPreview({
  sku,
  src,
  alt,
  onPreview,
  size = 36,
  disabled = false,
}: {
  sku: string;
  src: string;
  alt: string;
  onPreview: () => void;
  size?: 32 | 36;
  /** When true the HoverCard quick-preview is force-closed — used while
      the full ItemQuickView modal is open so the small card never stacks
      in front of (or behind) the big modal. */
  disabled?: boolean;
}) {
  const meta = itemMetaFor(sku);
  const dim = size === 32 ? 'w-8 h-8' : 'w-9 h-9';
  return (
    <HoverCard openDelay={300} closeDelay={80} open={disabled ? false : undefined}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onPreview(); }}
          className={`${dim} rounded-lg border border-border bg-slate-50 overflow-hidden flex-shrink-0 cursor-zoom-in hover:border-primary/40 transition-colors group/img`}
        >
          <ImageWithFallback
            src={src}
            alt={alt}
            className="w-full h-full object-cover group-hover/img:scale-110 transition-transform duration-300"
          />
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        side="right"
        align="start"
        sideOffset={8}
        className="w-[280px] p-0 rounded-xl border-0 overflow-hidden z-[70]"
        style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-3.5 py-3 relative overflow-hidden">
          <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
          <div className="flex items-center gap-3 relative">
            <div className="w-9 h-9 rounded-lg bg-white/10 overflow-hidden shrink-0">
              <ImageWithFallback src={src} alt={alt} className="w-full h-full object-cover" />
            </div>
            <div className="min-w-0">
              <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>{sku}</p>
              <p className="text-[11px] text-slate-400 truncate">{meta.shortDesc}</p>
            </div>
          </div>
        </div>
        <div className="bg-white px-3.5 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
              <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{meta.category}</span>
            </div>
            <span className="text-[12px] text-slate-700" style={{ fontWeight: 600 }}>
              {meta.price}
              <span className="text-slate-400 ml-1" style={{ fontWeight: 400 }}>/ unit</span>
            </span>
          </div>
          {/* Master-data attributes (neutral pills) — no stock status. */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] bg-slate-50 text-slate-600 border border-slate-200" style={{ fontWeight: 500 }}>
              <Hash className="w-3 h-3 text-slate-400" />
              {meta.inventoryControl}
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] bg-slate-50 text-slate-600 border border-slate-200" style={{ fontWeight: 500 }}>
              <ShoppingCart className="w-3 h-3 text-slate-400" />
              {meta.acquisition}
            </span>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

// Per-row description truncation with inline "more / Show less" toggle —
// partner Lovable Purchase Orders item-row pattern. State is local to each
// item so toggling one doesn't expand all.
export function ItemDescriptionWithToggle({
  description,
  highlightText,
  itemSearch,
  widthClass = 'w-[240px] max-w-[240px]',
  hugText = false,
  textClass = 'text-[11px]',
}: {
  description: string;
  highlightText: (text: string, query: string) => React.ReactNode;
  itemSearch: string;
  /** The cap that keeps both states the same width. A table cell wants the
   *  fixed one; a flex row wants to fill what it was given. */
  widthClass?: string;
  /** Where "more" sits. A narrow table column wants it pinned to a constant
   *  right edge so the column reads straight. A wide row wants it against the
   *  text it belongs to, or a short description leaves it stranded half a
   *  column away from the words it is about. */
  hugText?: boolean;
  /** Type size for the description. A table cell keeps it small; a roomier row
   *  scales it up so the identity block holds its own against the controls
   *  opposite. */
  textClass?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!description) return null;
  // Width cap on the root keeps the description column width identical in
  // both states — collapsed truncates inside the cap, expanded wraps to
  // multiple lines inside the same cap. Right-side columns never reflow.
  // The inner collapsed flex uses w-full + flex-1 so the "more" button
  // sits at a consistent right edge (12px from the next column) instead
  // of floating next to a short string of text.
  return (
    <div className={`${textClass} text-slate-500 font-normal leading-snug mt-0.5 ${widthClass}`}>
      {expanded ? (
        <span className="block">
          {highlightText(description, itemSearch)}{' '}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setExpanded(false); }}
            className={`inline-flex items-center gap-0.5 text-primary hover:text-blue-700 transition-colors align-baseline ${textClass}`}
            style={{ fontWeight: 500 }}
          >
            Show less
            <ChevronUp className="w-3 h-3" />
          </button>
        </span>
      ) : (
        <span className="flex items-center gap-1 w-full">
          <span className={`truncate min-w-0 ${hugText ? '' : 'flex-1'}`}>{highlightText(description, itemSearch)}</span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
            className={`inline-flex items-center gap-0.5 text-primary hover:text-blue-700 transition-colors shrink-0 ${textClass}`}
            style={{ fontWeight: 500 }}
          >
            more
            <ChevronDown className="w-3 h-3" />
          </button>
        </span>
      )}
    </div>
  );
}
