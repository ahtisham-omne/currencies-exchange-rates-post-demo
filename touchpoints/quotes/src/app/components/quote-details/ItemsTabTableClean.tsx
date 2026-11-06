import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, Package, ChevronDown, ChevronsDown, ChevronsUp, Copy, X, Layers, Info, Pencil } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip';
import { Checkbox } from '@/app/components/ui/checkbox';
import { NumberPill } from '@/app/components/shared/NumberPill';
import { ItemDescription } from '@/app/components/shared/ItemDescription';
import { LotTrackingTag } from '@/app/components/shared/LotTrackingTag';
import { InactiveItemPill } from '@/app/components/shared/InactiveItemPill';
import { useItemQuickView, type ItemQuickViewItem } from '@/app/components/shared/ItemQuickView';
import { EmptyPlaceholder } from '@/app/components/shared/EmptyPlaceholder';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { LineItemConfigModal } from '../quote-creation/LineItemConfigModal';
import { ProductPickerModal } from './ProductPickerModal';
import { PriceScopeModal, type PriceScope } from './PriceScopeModal';
import { PriceBreakdownHoverCard } from './PriceBreakdownHoverCard';
import { requiresNewDraftFirst } from '../../utils/versioningEngine';
import { getCreatedQuoteLineItems, CreatedLineItem } from '../../data/quoteStore';
import { getLineItemImage } from '../../data/lineItemImage';
import { PRODUCTS } from '../../data/products';
import type { WarehousePickupSelection } from '../quote-creation/WarehouseSelectionModal';
import './line-table-responsive.css';

/* Pickup-warehouse seed map — keyed by productId so duplicated lines
   share the same `pickupLocation`. Now multi-warehouse: the chassis
   line, for example, can be picked from OH (primary) *or* the
   secondary lot in WA, and the user can confirm both during pickup
   planning. Some products are intentionally left out so those lines
   start in the "Decide later" state. */
const PICKUP_BY_PRODUCT: Record<string, WarehousePickupSelection> = {
  // Ford E-450 chassis — OH primary, WA secondary lot.
  '000-100-002': { warehouseIds: ['wh-001', 'wh-004'] },
  // Type III ambulance module — PA assembly only.
  '000-100-019': { warehouseIds: ['wh-002'] },
  // Whelen lightbar — OH + WA cross-dock both stock it.
  '000-100-026': { warehouseIds: ['wh-001', 'wh-004'] },
  // Federal Signal siren — OH + WA cross-dock.
  '000-100-041': { warehouseIds: ['wh-001', 'wh-004'] },
  // Motorola APX radio — refurb-ready at IL hub.
  '000-100-049': { warehouseIds: ['wh-005'] },
  // Stryker stretcher — TX South Build.
  '000-100-059': { warehouseIds: ['wh-003'] },
  // Stryker mount — TX South Build (bundles with stretcher).
  '000-100-061': { warehouseIds: ['wh-003'] },
  // Kussmaul shoreline — OH + WA carry it.
  '000-100-079': { warehouseIds: ['wh-001', 'wh-004'] },
  // AIMS inverter — PA component staging.
  '000-100-081': { warehouseIds: ['wh-002'] },
  // Patient compartment A/C — PA component staging.
  '000-100-093': { warehouseIds: ['wh-002'] },
  // Build labor — PA Packout.
  '000-100-171': { warehouseIds: ['wh-002'] },
  // Final QC — PA Packout.
  '000-100-175': { warehouseIds: ['wh-002'] },
};

function pickupFor(productId: string): WarehousePickupSelection | undefined {
  const sel = PICKUP_BY_PRODUCT[productId];
  return sel ? { warehouseIds: [...sel.warehouseIds] } : undefined;
}

interface PricingRule {
  id: string;
  name: string;
  type: 'discount' | 'premium';
  value: number;
  amountType: '%' | '$';
}

interface OneTimeAdjustment {
  id: string;
  type: 'discount' | 'premium';
  amountType: '$' | '%';
  amount: number;
  label: string;
}

/* UoM data — pulled from the central `data/uomSets` module so every
   consumer (this table, the Step 3 capsule, the Add Line Item dialog,
   the configurator) shares one source of truth. `UOM_OPTIONS` is
   retained as the discrete set's alias so any legacy lookup keeps
   working until it's switched to a per-product set. */
import {
  UOM_SETS,
  type UomOption,
  getUomSetForProduct,
  getPrimaryUomForProduct,
  findUomById,
  multiplierWithinSet,
  pickSeededUomForLine,
  getUomSetIdForProduct,
} from '../../data/uomSets';
import { useDocCurrency } from '@/app/components/currency/docCurrencyContext';
import { formatAmount, formatMoney, moneyPrefix } from '@/app/currency/money';
import { roundTo } from '@/app/currency/qFx';
import { formatWhole } from '@/app/currency/quoteMoney';
import { scaleQuoteLine } from './quoteCurrency';
const UOM_OPTIONS: UomOption[] = UOM_SETS.discrete;

/* Demo quote-level freight charge. Drives the split-confirmation
   preview math when the user overrides a line's freight for the
   first time. Will be replaced by a real value lifted from
   QuoteDetails once quote-level shipment cost is a first-class
   field on the quote object. */
const DEMO_QUOTE_DEFAULT_FREIGHT = 2000;

interface LineItem {
  id: string;
  productId: string;
  productName: string;
  description: string;
  image?: string;
  quantity: number;
  uom: string;
  defaultUom: string;
  unitPrice: number;
  pricingRules: PricingRule[];
  oneTimeAdjustments: OneTimeAdjustment[];
  subtotal: number;
  total: number;
  /* Optional per-line freight override + the full shipment config.
     When set, this line is in per-line freight mode. The freight
     breakdown modal and line config modal both read from / write to
     this same field so the two surfaces stay in sync. */
  shipmentConfig?: {
    shipmentCost?: number;
    /** Per-line pickup override — warehouse + nested location path.
     *  When set, this line is shipped from a different warehouse
     *  than the quote-wide default. Lines that share a productId
     *  are seeded with the same selection so duplicates stay
     *  internally consistent. */
    pickupLocation?: WarehousePickupSelection;
    [k: string]: any;
  };
}

// Twelve baseline line items used to seed both the small dataset and the
// expanded 50-item dataset that exercises the sticky-header scrolling.
/* Raw baseline rows — `shipmentConfig.pickupLocation` is stamped in
   from `PICKUP_BY_PRODUCT` further down so the per-product mapping
   stays in one table instead of being duplicated on every row. */
const RAW_BASE_LINE_ITEMS: LineItem[] = [
  {
    id: '1',
    productId: '000-100-002',
    productName: 'Ford E-450 Super Duty Stripped Chassis — Ambulance Prep Package',
    /* Long on purpose: exercises the reader's 320px cap and its internal
       scroll. Real spec prose rather than filler, so the wrapping and the
       scroll length behave like production copy. */
    description:
      'E-450 stripped chassis, 176" WB, 7.3L V8, DRW, 16,000 GVWR, ambulance prep with reinforced ' +
      'frame, heavy-duty alternator, and dual batteries. Includes extended-idle package and PTO-ready ' +
      'wiring. Drivetrain: 7.3L OHV V8 rated 350 hp and 468 lb-ft, paired to a TorqShift 10-speed ' +
      'automatic with tow/haul and live-drive PTO provision on the driver side. Rear axle is a 4.88 ' +
      'limited-slip on a 10,000 lb Dana unit; front is a 6,000 lb twin I-beam with 55 mm gas shocks and ' +
      'a 1.57 in stabiliser bar. Electrical: dual 78 Ah AGM batteries on an isolator relay, 240 A ' +
      'pad-mount alternator with remote sense, and a 250 A mega-fuse at the distribution block. The ' +
      'body-builder harness terminates behind the seat riser with 14 labelled circuits, six of them ' +
      'ignition-switched, and a dedicated 8 AWG feed for the module disconnect. Idle control holds ' +
      '1,150 rpm on a fast-idle input and drops out on brake or shift from park, which keeps the ' +
      'inverter and the O2 warmer alive without a shoreline. Frame: rails are 36,000 psi with a ' +
      'full-length C-channel insert from the cab back, drilled to the KKK-A-1822F bolt pattern so the ' +
      'module mounts without site welding. Rear overhang is trimmed for a 96 in module with a 14 in ' +
      'tail, and the fuel fill is relocated to the driver rear quarter to clear the compartment. Brakes ' +
      'and steering: four-wheel discs with a hydro-boost assist shared with the power steering circuit, ' +
      'and a reserve accumulator good for three stops with the engine off. ABS is four-channel with a ' +
      'load-sensing rear proportioning valve calibrated for the loaded module weight, not the bare ' +
      'chassis. Delivery notes: chassis ships on its own wheels with a 40 gal fill, PDI completed, and ' +
      'the body-builder book in the glovebox. Lead time runs 21 days from the published floor and slips ' +
      'if the 240 A alternator is back-ordered, which has happened twice this year. Warranty is 3 yr / ' +
      '36,000 mi bumper-to-bumper and 5 yr / 60,000 mi on the powertrain, transferable once to the end ' +
      'agency at no cost. Service access: the oil filter and the fuel-water separator are both ' +
      'reachable without pulling the engine cover, which matters once a module is on and the doghouse ' +
      'is captive under the console. Recommended interval is 5,000 mi on synthetic, halved for services ' +
      'running heavy idle hours; the chassis logs idle separately from road time so the agency can bill ' +
      'maintenance against the right programme. Known issues on this platform: the factory rear ' +
      'air-conditioning line runs close to the frame insert and should be re-clipped during upfit, and ' +
      'the driver-side body ground is undersized for a full module load, so we add a 4 AWG strap to the ' +
      'block as standard rather than leaving it to the installer. Neither shows up in the build book.',    image: '',
    quantity: 2,
    uom: 'EA',
    defaultUom: 'EA',
    unitPrice: 48200,
    pricingRules: [
      { id: 'fleet-vol', name: 'Fleet Volume Discount', type: 'discount', value: 4, amountType: '%' },
      { id: 'gov-pricing', name: 'Government Contract Pricing', type: 'discount', value: 3, amountType: '%' },
    ],
    oneTimeAdjustments: [
      { id: 'delivery', type: 'premium', amountType: '$', amount: 1200, label: 'Chassis Delivery & Prep Fee' },
    ],
    subtotal: 96400,
    total: 90876,
  },
  {
    id: '2',
    productId: '000-100-019',
    productName: 'Type III Ambulance Module — Standard 152" Patient Compartment',
    /* Long on purpose: exercises the reader's 320px cap and its internal
       scroll. Real spec prose rather than filler, so the wrapping and the
       scroll length behave like production copy. */
    description:
      'Cutaway-mount modular body, 152" compartment, 72" headroom, full walk-through cab access, ' +
      'aluminum/composite construction, KKK-A-1822F compliant. Shell is 0.125 in 5052-H32 aluminium on ' +
      'a welded 6061-T6 skeleton, with the roof formed as a single sheet so there is no seam over the ' +
      'patient area. Exterior panels are bonded rather than riveted along the belt line, which keeps ' +
      'the surface flat for graphics and removes the usual corrosion path at the fastener heads. ' +
      'Interior: seamless one-piece vinyl floor coved 4 in up the walls and heat-welded at every joint, ' +
      'so a wash-down cannot find a way into the substrate. Cabinet faces are 0.090 in aluminium with ' +
      'radiused edges and captive latches; the action-area shelving is on 1 in centres so the agency ' +
      'can re-layout without drilling. The squad bench seats three with integrated child-seat anchors ' +
      'and a 300 lb capacity per position. Electrical: 100 A distribution panel with a Class T main, ' +
      'LED interior on two independently dimmable circuits, and a load-shed relay that drops the ' +
      'non-critical bus when the shoreline is pulled and battery falls under 11.9 V. Every circuit ' +
      'lands on a labelled terminal strip behind the action-area door, and the loom is run in split ' +
      'conduit clear of the O2 lines. Climate: 30,000 BTU rear heat and 24,000 BTU cooling on a ' +
      'dedicated compressor, ducted to six ceiling registers with a return behind the CPR seat. The ' +
      'unit will hold 68 F at the patient position with an 8 F outside temperature and the rear doors ' +
      'cycling. Compliance: built to KKK-A-1822F and tested to the SAE J3043, J3044 and J3045 series ' +
      'for cot retention, seating and storage-device retention. Certificates ship with the unit, and ' +
      'the test reports are available on request for grant documentation. Lead time is 5 days on the ' +
      'accessory floor, though the bariatric variant adds two weeks for the widened rear door frame. ' +
      'Oxygen: the main cylinder sits in a rear-access compartment with a strap-and-cradle retention ' +
      'rated to the J3045 pull, and the regulator panel is inside the action area at chest height so ' +
      'the medic is not reaching across the cot. Lines are copper to the outlets with a shutoff behind ' +
      'a labelled access door. Lighting over the cot measures 120 fc at the patient surface with both ' +
      'circuits up, which is above the 100 fc the specification asks for and enough to run a line ' +
      'without a headlamp. Field notes from the last four builds: agencies consistently ask to move the ' +
      'sharps container off the action-area door and onto the bulkhead, and to swap one upper cabinet ' +
      'for open shelving. Both are no-cost changes if they are called before the interior goes in, and ' +
      'neither affects the compliance certificates.',    image: '',
    quantity: 2,
    uom: 'EA',
    defaultUom: 'EA',
    unitPrice: 94200,
    pricingRules: [
      { id: 'multi-unit', name: 'Multi-Unit Build Discount', type: 'discount', value: 5, amountType: '%' },
    ],
    oneTimeAdjustments: [
      { id: 'eng', type: 'premium', amountType: '$', amount: 3500, label: 'Engineering / Custom Layout' },
    ],
    subtotal: 188400,
    total: 182480,
  },
  {
    id: '2b',
    productId: '000-100-019',
    productName: 'Type III Ambulance Module — Standard 152" Patient Compartment',
    description: 'Same module spec as line 2 but configured as bariatric-ready variant with 96" interior width option, reinforced stretcher rail, and widened rear entry door frame. Includes bariatric stretcher rail spacers.',
    image: '',
    quantity: 1,
    uom: 'EA',
    defaultUom: 'EA',
    unitPrice: 94200,
    pricingRules: [
      { id: 'custom-config', name: 'Custom Configuration Premium', type: 'premium', value: 8, amountType: '%' },
    ],
    oneTimeAdjustments: [],
    subtotal: 94200,
    total: 101736,
  },
  {
    id: '3',
    productId: '000-100-026',
    productName: 'Whelen Liberty II LED Lightbar 54" — Red/White Split',
    /* Long on purpose: exercises the reader's 320px cap and its internal
       scroll. Real spec prose rather than filler, so the wrapping and the
       scroll length behave like production copy. */
    description:
      '54" full-size LED lightbar with 16 modules, red/white split for ambulance, integrated ' +
      'alley/takedown lights, programmable flash patterns, low-profile aerodynamic housing. Each module ' +
      'carries six 3 W Gen-4 emitters behind a collimating optic, and the reflector is tuned per ' +
      'position so the corners throw to the side rather than wasting output down the centreline. Rated ' +
      '62 flash patterns with a traffic advisor mode across the rear eight modules, selectable left, ' +
      'right, centre-out and a steady bar. Photometrics: certified to SAE J595 Class 1 in both the red ' +
      'and the white halves, measured with the lens at 30 C rather than cold, which is where most bars ' +
      'quietly lose a class. Cruise mode drops output to 30 percent for scene work without cycling the ' +
      'emitters, so colour temperature holds at 5,700 K instead of drifting warm as the junction heats. ' +
      'Housing is a single extrusion with cast end caps and a UV-stabilised polycarbonate lens, 3.1 in ' +
      'tall at the centre and swept to 2.4 in at the ends. Wind noise measures under 3 dBA over bare ' +
      'roof at 60 mph. Mounting feet are adjustable fore and aft on the extrusion channel, and the kit ' +
      'includes gutter, permanent and modular-roof hardware. Electronics are conformally coated and ' +
      'sealed to IP67, with a single Deutsch DT connector carrying power, ground, pattern select and ' +
      'the sync line. Two bars can be synchronised without a control head. Current draw is 11.4 A at ' +
      'full output and 3.8 A in cruise, low enough to sit on the existing 15 A emergency circuit ' +
      'without a rework. Warranty is 5 years on the LEDs and drivers, 3 years on the housing, with ' +
      'advance replacement inside the first year. Failures cluster in the first 90 days when they ' +
      'happen at all, almost always a pinched harness at the roof penetration rather than the bar ' +
      'itself. Installation: the roof penetration should be a single 1.5 in grommeted pass-through ' +
      'behind the front module bank, sealed with butyl rather than silicone, since silicone lifts the ' +
      'paint over a couple of winters. Leave a 6 in service loop inside the headliner so the bar can be ' +
      'dropped for a driver swap without cutting the loom. Torque the feet to 12 Nm and re-check at the ' +
      '30-day service; the extrusion relaxes slightly after the first heat cycles and a loose foot is ' +
      'the usual cause of a rattle complaint that gets reported as an electrical fault. Compatibility: ' +
      'the sync line is compatible with our siren and switch panel, but not with third-party ' +
      'controllers that pull the line high rather than switching it to ground, which will hold the bar ' +
      'in a single pattern with no error shown anywhere.',    image: '',
    quantity: 3,
    uom: 'EA',
    defaultUom: 'EA',
    unitPrice: 3250,
    pricingRules: [
      { id: 'qty-break', name: 'Quantity Break Discount', type: 'discount', value: 6, amountType: '%' },
    ],
    oneTimeAdjustments: [],
    subtotal: 9750,
    total: 9165,
  },
  {
    id: '4',
    productId: '000-100-041',
    productName: 'Federal Signal Pathfinder Siren/PA 200W',
    description: '200-watt electronic siren with PA, wail/yelp/phaser/hi-lo tones, radio rebroadcast input, backlit controls. Includes mounting bracket and wiring harness.',
    image: '',
    quantity: 3,
    uom: 'EA',
    defaultUom: 'EA',
    unitPrice: 685,
    pricingRules: [],
    oneTimeAdjustments: [],
    subtotal: 2055,
    total: 2055,
  },
  {
    id: '5',
    productId: '000-100-049',
    productName: 'Motorola APX 8500 All-Band Mobile Radio',
    description: 'Multi-band P25 Phase II mobile, VHF/UHF/700/800 MHz, TDMA, AES 256 encryption, GPS, Bluetooth, OTAP ready. Includes remote head kit and antenna cables.',
    image: '',
    quantity: 3,
    uom: 'EA',
    defaultUom: 'EA',
    unitPrice: 7850,
    pricingRules: [
      { id: 'state-contract', name: 'State Contract Pricing', type: 'discount', value: 12, amountType: '%' },
    ],
    oneTimeAdjustments: [
      { id: 'programming', type: 'premium', amountType: '$', amount: 450, label: 'Radio Programming & Encryption' },
    ],
    subtotal: 23550,
    total: 21174,
  },
  {
    id: '6',
    productId: '000-100-059',
    productName: 'Stryker Power-PRO XT Powered Stretcher System',
    description: 'Powered hydraulic stretcher, 700 lb capacity, battery operated, auto-loading with isokinetic lowering. Power-LOAD compatible interface.',
    image: '',
    quantity: 3,
    uom: 'EA',
    defaultUom: 'EA',
    unitPrice: 18500,
    pricingRules: [
      { id: 'oem-rebate', name: 'OEM Manufacturer Rebate', type: 'discount', value: 3, amountType: '%' },
      { id: 'bundle', name: 'Stretcher + Mount Bundle', type: 'discount', value: 2, amountType: '%' },
    ],
    oneTimeAdjustments: [
      { id: 'training', type: 'premium', amountType: '$', amount: 800, label: 'Operator Training (per unit)' },
    ],
    subtotal: 55500,
    total: 55025,
  },
  {
    id: '7',
    productId: '000-100-061',
    productName: 'Stretcher Mount — Power-LOAD Cot Fastening System',
    description: 'Stryker Power-LOAD cot fastening system with automatic loading/unloading, floor rail integration, interlock safety, anti-tip mechanism.',
    image: '',
    quantity: 3,
    uom: 'EA',
    defaultUom: 'EA',
    unitPrice: 12500,
    pricingRules: [
      { id: 'bundle', name: 'Stretcher + Mount Bundle', type: 'discount', value: 2, amountType: '%' },
    ],
    oneTimeAdjustments: [],
    subtotal: 37500,
    total: 36750,
  },
  {
    id: '8',
    productId: '000-100-079',
    productName: 'Kussmaul Auto Eject Shoreline 20A',
    description: 'Automatic shoreline power inlet, auto-eject on engine start, 20A 120VAC, weatherproof, with exterior receptacle and indicator light.',
    image: '',
    quantity: 3,
    uom: 'EA',
    defaultUom: 'EA',
    unitPrice: 485,
    pricingRules: [],
    oneTimeAdjustments: [],
    subtotal: 1455,
    total: 1455,
  },
  {
    id: '9',
    productId: '000-100-081',
    productName: 'AIMS 3000W Pure Sine Inverter/Charger',
    description: '3000W pure sine wave inverter with 75A battery charger, auto transfer switch, remote panel, 12VDC input. Powers patient compartment 120VAC loads.',
    image: '',
    quantity: 3,
    uom: 'EA',
    defaultUom: 'EA',
    unitPrice: 1650,
    pricingRules: [
      { id: 'elec-bundle', name: 'Electrical Package Bundle', type: 'discount', value: 4, amountType: '%' },
    ],
    oneTimeAdjustments: [],
    subtotal: 4950,
    total: 4752,
  },
  {
    id: '10',
    productId: '000-100-093',
    productName: 'Patient Compartment A/C System — Roof Mount',
    description: 'Roof-mount A/C unit for ambulance module, 24,000 BTU, R-134a refrigerant, thermostat controlled with ducted distribution system.',
    image: '',
    quantity: 3,
    uom: 'EA',
    defaultUom: 'EA',
    unitPrice: 5200,
    pricingRules: [
      { id: 'hvac-pkg', name: 'HVAC Package Discount', type: 'discount', value: 3, amountType: '%' },
    ],
    oneTimeAdjustments: [],
    subtotal: 15600,
    total: 15132,
  },
  {
    id: '11',
    productId: '000-100-171',
    productName: 'Type III Ambulance Build Labor — Complete',
    description: 'Full Type III ambulance build labor on cutaway chassis, cab mod, module integration, electrical, HVAC, medical gas, graphics. 500+ labor hours.',
    image: '',
    quantity: 3,
    uom: 'EA',
    defaultUom: 'EA',
    unitPrice: 28000,
    pricingRules: [
      { id: 'multi-build', name: 'Multi-Unit Build Labor Discount', type: 'discount', value: 7, amountType: '%' },
    ],
    oneTimeAdjustments: [
      { id: 'overtime', type: 'premium', amountType: '$', amount: 4500, label: 'Expedited Build Schedule Premium' },
    ],
    subtotal: 84000,
    total: 82620,
  },
  {
    id: '12',
    productId: '000-100-175',
    productName: 'Final QC Inspection & Road Test',
    description: 'Comprehensive quality control inspection: 200+ checkpoint list, road test, weight certification, fluid levels, and full documentation per KKK spec.',
    image: '',
    quantity: 3,
    uom: 'EA',
    defaultUom: 'EA',
    unitPrice: 1200,
    pricingRules: [],
    oneTimeAdjustments: [],
    subtotal: 3600,
    total: 3600,
  },
  // Sample Lot-Serialized line item — exercises the lot+serial allocation
  // flow. productId 000-100-195 maps to the AED Defibrillator template
  // added to PRODUCTS with both `isSerialized` and `isLotControlled` true,
  // so the LotTrackingTag renders the "serialized" variant on this row.
  {
    id: '13',
    productId: '000-100-195',
    productName: 'AED Defibrillator with Smart Battery Pack',
    description: 'Field-ready AED with traceable battery. Unique serial per unit and lot-numbered battery cells for recall + expiration management. FDA Class III, CE marked, 8-year shelf life.',
    image: '',
    quantity: 4,
    uom: 'EA',
    defaultUom: 'EA',
    unitPrice: 2150,
    pricingRules: [],
    oneTimeAdjustments: [],
    subtotal: 8600,
    total: 8600,
  },
];

/* Replace the seed's hardcoded `uom: 'EA'` / `defaultUom: 'EA'` with
   per-product set lookups. Each line carries a deterministically-
   seeded UoM drawn from its product's set (so liquids get
   Liter/Gallon/Drum, lengths get Foot/Yard/Roll, rest stay on
   EA/Box/Carton/Pallet), and a `defaultUom` pointing at the set's
   primary so dropdowns can render the "Primary" pill. The seed
   itself is left verbatim so the price/quantity/adjustments tests
   keep working. */
const BASE_LINE_ITEMS_WITH_UOM: LineItem[] = RAW_BASE_LINE_ITEMS.map((item) => {
  const product = PRODUCTS.find((p) => p.id === item.productId);
  if (!product) return item;
  const setId = getUomSetIdForProduct(product);
  const primaryName = findUomById(getPrimaryUomForProduct(product))?.name || 'EA';
  const seededUom = pickSeededUomForLine(item.id, setId).name;
  return { ...item, uom: seededUom, defaultUom: primaryName };
});

/* Stamp the per-product pickup selection onto every base line. Lines
   that share a productId (e.g. the two "Type III Ambulance Module"
   rows) end up with the same `pickupLocation`, while different
   products get different warehouses — that's the demo state the
   user expects when they open the Freight & Logistics modal on any
   line out of the box. */
export const BASE_LINE_ITEMS: LineItem[] = BASE_LINE_ITEMS_WITH_UOM.map((item) => {
  const sel = pickupFor(item.productId);
  if (!sel) return item;
  return {
    ...item,
    shipmentConfig: {
      ...(item.shipmentConfig ?? {}),
      pickupLocation: sel,
    },
  };
});

/**
 * MOCK_LINE_ITEMS — 50 line items derived from the 12 baseline rows above.
 * Wide datasets across every quote state are needed to exercise the sticky
 * header / stepper / tab scroll behavior on detail pages. We repeat the
 * baseline rows with slight quantity tweaks and unique IDs so React keys
 * remain stable. The first 12 IDs match the legacy values so any tests or
 * URL deep-links still resolve.
 */
export const MOCK_LINE_ITEMS: LineItem[] = (() => {
  const out: LineItem[] = [];
  // Aiming for ~50 items so quotes have enough rows to push the page deep
  // below the fold and the sticky compact header has room to engage.
  const targetCount = 50;
  for (let i = 0; i < targetCount; i++) {
    const base = BASE_LINE_ITEMS[i % BASE_LINE_ITEMS.length];
    const lap = Math.floor(i / BASE_LINE_ITEMS.length); // 0,1,2,…
    if (lap === 0) {
      out.push(base);
      continue;
    }
    const qty = Math.max(1, base.quantity + lap);
    out.push({
      ...base,
      id: `${base.id}-r${lap}`,
      quantity: qty,
      subtotal: qty * base.unitPrice,
      total: Math.round(qty * base.unitPrice * (base.total / Math.max(base.subtotal, 1))),
    });
  }
  return out;
})();

interface ItemRowProps {
  item: LineItem;
  index: number;
  itemNumber: string;
  parentGroupNumber: number | null;
  originalItemNumber: number | null;
  isFirstInDuplicateGroup: boolean;
  isInDuplicateGroup: boolean;
  duplicateGroupSize: number;
  isSelected: boolean;
  isHovered: boolean;
  isEditable: boolean;
  isEditMode: boolean;
  isNewlyAdded: boolean;
  editingCell: { itemId: string; field: 'quantity' | 'unitPrice' } | null;
  onHover: (id: string | null) => void;
  onToggleSelect: (id: string) => void;
  onOpenConfigurator: (item: LineItem) => void;
  onPreviewItem: (item: LineItem) => void;
  onStartEdit: (itemId: string, field: 'quantity' | 'unitPrice') => void;
  onCommitEdit: (itemId: string, field: 'quantity' | 'unitPrice', value: number) => void;
  onCancelEdit: () => void;
  onUomChange: (itemId: string, newUom: string) => void;
  onDeleteRow: (itemId: string) => void;
  formatCurrency: (amount: number) => string;
  getNetAdjustmentPercent: (item: LineItem) => number | null;
  /* Shared pricing/adjustments APIs so the TOTAL column can render
     the line's true total (subtotal + line-scoped rules + line-scoped
     adjustments). Without these the column shows the bare subtotal,
     which drifted from the Advanced Configurator's "Total" tile. */
  pricingAPI?: import('./usePricingRules').PricingRulesAPI;
  adjustmentsAPI?: import('./useAdjustments').AdjustmentsAPI;
}

// Helper: returns one of the four canonical tracking labels — Serialized,
// Non-Serialized, Lot Serialized, Lot Non-Serialized — derived from the
// product's two flags. The pill uses neutral surface-secondary chrome and
// differentiates Serialized vs Non-Serialized variants via the barcode
// glyph (struck-through for Non-Serialized), matching Physical Inventory.
function getTrackingType(productId: string): { label: string; isSerialized: boolean } {
  const product = PRODUCTS.find(p => p.id === productId);
  const serialized = !!product?.isSerialized;
  const lot = !!product?.isLotControlled;
  if (lot && serialized)   return { label: 'Lot Serialized',     isSerialized: true };
  if (lot && !serialized)  return { label: 'Lot Non-Serialized', isSerialized: false };
  if (serialized)          return { label: 'Serialized',         isSerialized: true };
  return                          { label: 'Non-Serialized',     isSerialized: false };
}

/* Inline tracking-type glyphs ported verbatim from Physical Inventory's
   `ControlTypeBadge` (shared-badges.tsx). Same SVG paths so Serialized /
   Non-Serialized read identically to that module. */
const SERIALIZED_ICON = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
    <path
      d="M2.91 12.36H1.45V3.64H2.91M4.36 12.36H3.64V3.64H4.36M7.27 12.36H5.09V3.64H7.27M8.73 12.36H8V3.64H8.73M10.91 12.36H9.45V3.64H10.91M12.36 12.36H11.64V3.64H12.36M14.55 12.36H13.09V3.64H14.55V12.36Z"
      fill="currentColor"
    />
  </svg>
);

const NON_SERIALIZED_ICON = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
    <path
      d="M13.89 15.15L10.67 11.93V12H9.33V10.59L8 9.26V12H7.33V8.59L6.67 7.93V12H4.67V5.93L4 5.26V12H3.33V4.59L0.74 2L1.59 1.15L4.67 4.23L6.67 6.23L7.33 6.89L8 7.56L9.33 8.9V8.89L10.67 10.23V10.23L11.33 10.9V10.89L12.44 12H12.43L14.74 14.31L13.89 15.15ZM10.67 4H9.33V7.2L10.67 8.53V4ZM8 4H7.33V5.2L8 5.87V4ZM13.33 4H11.33V9.2L13.33 11.2V4ZM14.67 12V4H14V11.87L14.13 12H14.67ZM6.67 4H6.13L6.67 4.53V4ZM1.33 12H2.67V4H1.33V12Z"
      fill="currentColor"
    />
  </svg>
);

function ItemRow({
  item,
  index,
  itemNumber,
  parentGroupNumber,
  originalItemNumber,
  isFirstInDuplicateGroup,
  isInDuplicateGroup,
  duplicateGroupSize,
  isSelected,
  isHovered,
  isEditable,
  isEditMode,
  isNewlyAdded,
  editingCell,
  onHover,
  onToggleSelect,
  onOpenConfigurator,
  onPreviewItem,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  onUomChange,
  onDeleteRow,
  formatCurrency,
  getNetAdjustmentPercent,
  pricingAPI,
  adjustmentsAPI,
}: ItemRowProps) {
  /* Price per unit in the quote's currency (spec 4.3): its symbol or code
     and its minor unit. */
  const { currency: docCurrency } = useDocCurrency();
  const pricePrefix = moneyPrefix(docCurrency).trim();
  const ref = useRef<HTMLTableRowElement>(null);
  const uomDropdownRef = useRef<HTMLDivElement>(null);
  const uomPanelRef = useRef<HTMLDivElement>(null);
  const adjPct = getNetAdjustmentPercent(item);
  const isEditingQty = editingCell?.itemId === item.id && editingCell?.field === 'quantity';
  const isEditingPrice = editingCell?.itemId === item.id && editingCell?.field === 'unitPrice';
  const [showUomDropdown, setShowUomDropdown] = useState(false);
  /* Dropdown is portalled to <body> so the table's overflow:auto
     can't clip it. Position is recomputed from the capsule's
     getBoundingClientRect on open, plus on scroll/resize while open.
     For upward placement (last-row case) we anchor by `bottom`
     instead of `top` so the panel hugs the trigger regardless of
     how tall its actual content renders. */
  const [uomPanelPos, setUomPanelPos] = useState<{ left: number; top?: number; bottom?: number; maxHeight: number } | null>(null);

  // Edit affordances only show when the global edit mode toggle is on
  const showEditAffordance = isEditMode;

  // Close UoM dropdown on outside click — must consider both the
  // capsule trigger and the portalled panel as inside-clicks.
  useEffect(() => {
    if (!showUomDropdown) { setUomPanelPos(null); return; }
    const reposition = () => {
      const rect = uomDropdownRef.current?.getBoundingClientRect();
      if (!rect) return;
      const margin = 12;
      const spaceBelow = window.innerHeight - rect.bottom - margin;
      const spaceAbove = rect.top - margin;
      /* Prefer below; flip above only if there's clearly more room
         there. Cap maxHeight to whichever side we're using so the
         panel never spills past the viewport — the internal list
         scrolls when it overflows. */
      const placeBelow = spaceBelow >= 240 || spaceBelow >= spaceAbove;
      const maxHeight = Math.max(160, placeBelow ? spaceBelow : spaceAbove);
      const left = rect.left + rect.width / 2;
      if (placeBelow) {
        setUomPanelPos({ left, top: rect.bottom + 4, maxHeight });
      } else {
        /* Anchor by `bottom` so the panel's bottom edge sits 4 px
           above the trigger regardless of how tall it actually
           renders — fixes the large gap that appeared when we
           subtracted maxHeight from rect.top while the panel was
           shorter than maxHeight. */
        setUomPanelPos({ left, bottom: window.innerHeight - rect.top + 4, maxHeight });
      }
    };
    reposition();
    const handleClickOutside = (event: MouseEvent) => {
      const t = event.target as Node;
      if (uomDropdownRef.current?.contains(t) || uomPanelRef.current?.contains(t)) return;
      setShowUomDropdown(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [showUomDropdown]);

  // Selection chrome: Purchase Order's selected-row tint (#EBF3FF,
  // PODemands), plain white otherwise. Row hover tint matches Purchase Order's `hover:bg-muted/30`
  // — a near-transparent slate wash — so the row reads as tappable
  // without competing with the per-row Pencil / X affordances.
  const rowBg = isNewlyAdded
    ? undefined
    : isSelected
      ? '#EBF3FF'
      : isHovered
        ? 'color-mix(in srgb, var(--muted) 30%, transparent)'
        : '#FFFFFF';

  // Scroll into view when newly added
  useEffect(() => {
    if (isNewlyAdded && ref.current) {
      // Small delay to let the DOM settle after state update
      const timer = setTimeout(() => {
        ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isNewlyAdded]);

  const handleKeyDown = (e: React.KeyboardEvent, field: 'quantity' | 'unitPrice') => {
    if (e.key === 'Enter') {
      const value = parseFloat((e.target as HTMLInputElement).value);
      if (!isNaN(value) && value > 0) {
        onCommitEdit(item.id, field, value);
      } else {
        onCancelEdit();
      }
    } else if (e.key === 'Escape') {
      onCancelEdit();
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>, field: 'quantity' | 'unitPrice') => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value > 0) {
      onCommitEdit(item.id, field, value);
    } else {
      onCancelEdit();
    }
  };

  return (
    <motion.tr
      ref={ref}
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, height: 0, overflow: 'hidden' }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      onMouseEnter={() => onHover(item.id)}
      onMouseLeave={() => onHover(null)}
      onClick={(e) => {
        /* Row-level click opens the Advanced Configurator (Purchase
           Order parity). Inline edit affordances (qty / unitPrice
           inputs, UoM dropdown, action buttons) stop propagation in
           their own handlers so they don't bubble here, but we also
           early-return if a stray child somehow surfaced — checking the
           composedPath for `input`, `button`, `select`, or `[role=button]`
           protects against future inline edits inside the row body. */
        const t = e.target as HTMLElement;
        if (t.closest('input, button, select, [role="button"]')) return;
        onOpenConfigurator(item);
      }}
      className={isNewlyAdded ? 'li-row newly-added-row' : 'li-row'}
      style={{
        // 40%-opacity border so row dividers read as airy hairlines.
        borderTop: isInDuplicateGroup && !isFirstInDuplicateGroup
          ? '1px dashed color-mix(in srgb, var(--border) 60%, transparent)'
          : '1px solid color-mix(in srgb, var(--border) 60%, transparent)',
        backgroundColor: isNewlyAdded ? undefined : rowBg,
        transition: isNewlyAdded ? undefined : 'background-color 120ms ease',
        boxShadow: isNewlyAdded ? 'inset 3px 0 0 var(--primary)' : undefined,
        cursor: 'pointer',
      }}
    >
      {/* Row checkbox: Purchase Order's table checkbox (PODemands). The
          cell stops the click so ticking a line never opens the
          configurator. Top padding centres the box on the item code. */}
      <td
        className="li-sel"
        onClick={(e) => e.stopPropagation()}
        style={{
          padding: isEditMode ? '12px 0 0 16px' : '0',
          width: isEditMode ? undefined : '0px',
          verticalAlign: 'top',
        }}
      >
        {isEditable && isEditMode && (
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleSelect(item.id)}
            aria-label={isSelected ? `Deselect line ${itemNumber}` : `Select line ${itemNumber}`}
          />
        )}
      </td>

      {/* Item Number — plain text */}
      <td className="li-num" style={{ padding: '12px 0 0', textAlign: 'center', verticalAlign: 'top' }}>
        <span style={{
          fontSize: '11px',
          fontWeight: 500,
          color: 'var(--muted-foreground)',
          lineHeight: '1',
        }}>
          {itemNumber}
        </span>
      </td>

      {/* Product — SKU + type pill + description format.
          `maxWidth: 0` is the classic table-cell shrink hack: under
          `tableLayout: auto`, the cell would otherwise grow to fit
          the widest description content. Setting maxWidth to 0 makes
          the cell willing to shrink under pressure from the fixed-
          width columns, so a narrow viewport (e.g. 1280×768 with the
          300 px RightSidebar visible) tightens the description first
          before the row reflows (see line-table-responsive.css). */}
      <td className="li-main" style={{ padding: '10px 12px', verticalAlign: 'top', maxWidth: 0, minWidth: 220 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
          {/* Compact rounded thumbnail — Shipment line-item pattern: 40×40
              square so the thumb visually matches the height of the SKU +
              single-line description block, instead of dwarfing it. */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onPreviewItem(item); }}
            aria-label={`Preview ${item.productName}`}
            style={{
              width: 40,
              height: 40,
              borderRadius: 6,
              border: '1px solid var(--border)',
              padding: 0,
              flexShrink: 0,
              cursor: 'pointer',
              background: 'transparent',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(27, 110, 243, 0.45)'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(27, 110, 243, 0.10)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            {/* Always render a thumbnail. Use the per-line image when
                set, otherwise fall back to the hashed sample image
                cycle so the line items table never reads as a wall of
                Package icons. */}
            <img
              src={item.image || getLineItemImage(item.productId)}
              alt={item.productName}
              loading="lazy"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              draggable={false}
            />
          </button>
          <div style={{ minWidth: 0, flex: 1 }}>
            {/* Row 1: SKU + Type pill + variant tag */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--foreground-soft)', lineHeight: '1' }}>
                {item.productId}
              </span>
              {/* Item-master status, straight after the code and before the
                  tracking chip, the order PO uses. Renders nothing for an
                  active item. */}
              <InactiveItemPill code={item.productId} size="md" noun="quote" />
              {(() => {
                const tracking = getTrackingType(item.productId);
                // Lot variants render via the shared two-segment LotTrackingTag;
                // non-lot variants keep the Physical Inventory ControlTypeBadge
                // chrome.
                if (tracking.label === 'Lot Serialized') return <LotTrackingTag type="serialized" />;
                if (tracking.label === 'Lot Non-Serialized') return <LotTrackingTag type="non-serialized" />;
                return (
                  <span
                    className="inline-flex items-center gap-1 border shrink-0 whitespace-nowrap"
                    style={{
                      background: 'var(--surface-secondary)',
                      color: 'var(--foreground)',
                      borderColor: 'var(--border)',
                      padding: '2px 8px',
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 500,
                      lineHeight: 'normal',
                    }}
                  >
                    {tracking.isSerialized ? SERIALIZED_ICON : NON_SERIALIZED_ICON}
                    {tracking.label}
                  </span>
                );
              })()}
              {isInDuplicateGroup && !isFirstInDuplicateGroup && originalItemNumber != null && (
                // Duplicate pill — white bg + purple outline, lighter feel
                // (system-wide treatment for duplicate badges).
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 11, fontWeight: 500, color: '#7C3AED',
                  backgroundColor: '#FFFFFF', border: '1px solid #DDD6FE',
                  padding: '2px 10px', borderRadius: 9999, lineHeight: 1.4,
                  whiteSpace: 'nowrap',
                }}>
                  <Layers style={{ width: 11, height: 11, flexShrink: 0 }} />
                  Duplicate of #{String(originalItemNumber).padStart(3, "0")}
                </span>
              )}
            </div>
            {/* Row 2: Description. One line with an inline `more ⌄`
                toggle that expands it in place and `less ⌃` to collapse,
                PO `TruncatedItemName` parity. `ItemDescription` is the
                shared clamp-and-toggle; read only here, since the grid
                does not edit descriptions. */}
            <ItemDescription text={item.description} maxLines={1} />
          </div>
        </div>
      </td>

      {/* Qty / UOM — Shipment-style inline display when read-only:
          bold black qty + small slimmer gray UOM (no capsule, no slash).
          Capsule chrome only renders when the row is editable. */}
      <td className="li-fig" data-label="Qty / UoM" onClick={(e) => e.stopPropagation()} style={{ padding: '0 12px', textAlign: 'left', verticalAlign: 'middle' }}>
        {!showEditAffordance && !isEditingQty && !showUomDropdown ? (
          <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4, fontFamily: 'Inter, system-ui, sans-serif' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', lineHeight: 1, whiteSpace: 'nowrap' }}>
              {item.quantity.toLocaleString()}
            </span>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', lineHeight: 1, whiteSpace: 'nowrap' }}>
              {item.uom}
            </span>
          </span>
        ) : (
        <div
          ref={uomDropdownRef}
          style={{
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'stretch',
            height: '32px',
            borderRadius: '6px',
            border: `1px solid ${isEditingQty ? 'var(--primary)' : showUomDropdown ? 'var(--accent)' : showEditAffordance ? 'var(--border)' : 'transparent'}`,
            backgroundColor: isEditingQty || showUomDropdown || showEditAffordance ? '#FFFFFF' : 'transparent',
            overflow: 'visible',
            transition: 'border-color 100ms, background-color 100ms',
            boxShadow: isEditingQty ? '0 0 0 2px rgba(59, 130, 246, 0.10)' : 'none',
          }}
        >
            {/* LEFT — Quantity input/display: STATIC 64px width sized for
                5-digit values so the cell doesn't grow when the user taps
                in to edit. Both the read button and the edit input share
                the same width so the row layout stays stable. */}
            {isEditingQty ? (
              <div style={{ display: 'flex', alignItems: 'center', width: 64, padding: 0 }}>
                <input
                  type="number"
                  defaultValue={item.quantity}
                  min={1}
                  step={1}
                  inputMode="numeric"
                  autoFocus
                  onKeyDown={(e) => handleKeyDown(e, 'quantity')}
                  onBlur={(e) => handleBlur(e, 'quantity')}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    textAlign: 'center',
                    outline: 'none',
                    fontSize: '13px',
                    fontWeight: 500, color: 'var(--foreground-soft)',
                    fontFamily: 'Inter, system-ui, sans-serif',
                    backgroundColor: 'transparent',
                    padding: 0,
                  }}
                />
              </div>
            ) : (
              <button
                onClick={() => isEditable && isEditMode && onStartEdit(item.id, 'quantity')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  width: 64,
                  border: 'none',
                  backgroundColor: 'transparent',
                  cursor: showEditAffordance ? 'text' : 'default',
                  fontFamily: 'Inter, system-ui, sans-serif',
                }}
                title={showEditAffordance ? 'Click to edit quantity' : undefined}
              >
                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--foreground-soft)', lineHeight: '1', whiteSpace: 'nowrap' }}>
                  {item.quantity.toLocaleString()}
                </span>
              </button>
            )}

            {/* Hairline divider between qty input and UoM selector — used
                only in editable capsule mode (read-only mode is handled by
                the inline shipment-style block above). */}
            <div style={{ width: '1px', backgroundColor: 'var(--border)', flexShrink: 0, alignSelf: 'stretch' }} />

            {/* RIGHT — UoM selector */}
            <button
              onClick={(e) => {
                if (!isEditable || !isEditMode) return;
                e.stopPropagation();
                setShowUomDropdown(!showUomDropdown);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '0 8px',
                minWidth: '36px',
                border: 'none',
                backgroundColor: showUomDropdown ? 'var(--muted)' : 'transparent',
                cursor: showEditAffordance ? 'pointer' : 'default',
                transition: 'background-color 100ms',
                fontFamily: 'Inter, system-ui, sans-serif',
                borderRadius: '0 5px 5px 0',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                if (showEditAffordance && !showUomDropdown) e.currentTarget.style.backgroundColor = 'var(--muted)';
              }}
              onMouseLeave={(e) => {
                if (!showUomDropdown) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {/* Cap to ~6 characters so the capsule doesn't expand
                  when a user picks a longer UoM. Anything past 6 chars
                  truncates with an ellipsis. */}
              <span title={item.uom} style={{ fontSize: '12px', fontWeight: 500, color: 'var(--foreground-soft)', lineHeight: '1', maxWidth: 52, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.uom}
              </span>
              {showEditAffordance && (
                <ChevronDown style={{ width: '11px', height: '11px', color: 'var(--muted-foreground)', flexShrink: 0 }} />
              )}
            </button>

            {/* UoM dropdown — portalled to <body> so the line items
                table's overflow:auto doesn't crop it. Fixed-positioned
                from the capsule's bounding rect; recomputes on scroll
                and resize via the effect above. When the trigger sits
                near the viewport bottom (last row in a 768 px window),
                placement flips to 'top' and the panel renders above
                the trigger instead. Cap maxHeight to the available
                side so the panel never extends past the viewport
                edge; internal scroll handles long UoM sets. */}
            {showUomDropdown && uomPanelPos && typeof document !== 'undefined' && createPortal(
              <div
                ref={uomPanelRef}
                onMouseDown={(e) => e.stopPropagation()}
                style={{
                  position: 'fixed',
                  top: uomPanelPos.top,
                  bottom: uomPanelPos.bottom,
                  left: uomPanelPos.left,
                  transform: 'translateX(-50%)',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
                  zIndex: 12500,
                  minWidth: '200px',
                  maxHeight: Math.min(uomPanelPos.maxHeight, 320),
                  overflowY: 'auto',
                  fontFamily: 'Inter, system-ui, sans-serif',
                }}
              >
                {(() => {
                  /* Per-product set + primary id, resolved from the
                     product registry. Liquid/length products show the
                     matching set; the rest show discrete. */
                  const product = PRODUCTS.find((p) => p.id === item.productId);
                  const itemSet = product ? getUomSetForProduct(product) : UOM_OPTIONS;
                  const itemPrimary = product ? getPrimaryUomForProduct(product) : 'ea';
                  return itemSet;
                })().map((option) => {
                  const isActive = item.uom.toLowerCase() === option.name.toLowerCase() || item.uom.toLowerCase() === option.id;
                  /* "Primary" pill follows the product's primary id,
                     not the line's previous `defaultUom`. The line's
                     defaultUom is now seeded from the same source so
                     these match — kept the lookup product-keyed as the
                     canonical reference (the line can drift, the
                     product cannot). */
                  const product = PRODUCTS.find((p) => p.id === item.productId);
                  const itemPrimary = product ? getPrimaryUomForProduct(product) : 'ea';
                  const isPrimary = option.id === itemPrimary;
                  return (
                    <button
                      key={option.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onUomChange(item.id, option.name);
                        setShowUomDropdown(false);
                      }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        borderTop: 'none',
                        borderRight: 'none',
                        borderBottom: '1px solid var(--muted)',
                        borderLeft: 'none',
                        backgroundColor: isActive ? 'var(--muted)' : 'transparent',
                        cursor: 'pointer',
                        transition: 'background-color 80ms',
                        fontFamily: 'Inter, system-ui, sans-serif',
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) e.currentTarget.style.backgroundColor = 'var(--muted)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '13px', fontWeight: isActive ? 600 : 500, color: 'var(--foreground)', lineHeight: '1', textAlign: 'left' }}>
                            {option.name}
                          </span>
                          {isPrimary && (
                            /* Partner Management's "Primary" pill —
                               accent-tinted chip that surfaces the
                               item's preferred UoM at a glance. */
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                fontSize: '9px',
                                fontWeight: 600,
                                color: '#1B6EF3',
                                backgroundColor: '#EFF6FF',
                                border: '1px solid #BFDBFE',
                                padding: '1px 5px',
                                borderRadius: '3px',
                                lineHeight: '1',
                                textTransform: 'uppercase' as const,
                                letterSpacing: '0.2px',
                              }}
                            >
                              Primary
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--muted-foreground)', lineHeight: '1', textAlign: 'left' }}>
                          {option.fullName}
                        </span>
                      </div>
                      {isActive && (
                        <div style={{
                          width: '14px',
                          height: '14px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                            <path d="M1 3L3 5L7 1" stroke="var(--background)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>,
              document.body
            )}
        </div>
        )}
      </td>

      {/* PPU (Price Per Unit) — Shipment-style inline display when read-only:
          bold black price + small slimmer gray UOM ("Each") on the same baseline.
          The capsule chrome only appears when the row is editable. */}
      <td className="li-fig" data-label="Price per unit" onClick={(e) => e.stopPropagation()} style={{ padding: '0 12px', textAlign: 'left', verticalAlign: 'middle' }}>
        {!showEditAffordance && !isEditingPrice ? (
          <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4, fontFamily: 'Inter, system-ui, sans-serif' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)', lineHeight: 1 }}>{pricePrefix}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', lineHeight: 1, whiteSpace: 'nowrap' }}>
              {formatAmount(item.unitPrice, docCurrency)}
            </span>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', lineHeight: 1, whiteSpace: 'nowrap' }}>
              {findUomById(item.uom)?.fullName || item.uom}
            </span>
          </span>
        ) : (
        <div style={{ position: 'relative', display: 'inline-block', width: '110px' }}>
          {/* Price input/display — centered in row */}
          {isEditingPrice ? (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                width: '100%',
                height: '32px',
                padding: '0 8px',
                gap: '1px',
                borderRadius: '6px',
                border: '1px solid var(--primary)',
                backgroundColor: '#FFFFFF',
                boxShadow: '0 0 0 2px rgba(59, 130, 246, 0.10)',
                boxSizing: 'border-box',
              }}
            >
              <span style={{ fontSize: '12px', color: 'var(--muted-foreground)', fontWeight: 600, lineHeight: '1', flexShrink: 0 }}>{pricePrefix}</span>
              <input
                type="number"
                defaultValue={item.unitPrice}
                min={0}
                step={1}
                inputMode="numeric"
                autoFocus
                onKeyDown={(e) => handleKeyDown(e, 'unitPrice')}
                onBlur={(e) => handleBlur(e, 'unitPrice')}
                /* `flex: 1, minWidth: 0` lets the input shrink and grow
                   inside the capsule so a long value scrolls within the
                   field instead of overflowing the column. */
                style={{
                  flex: 1,
                  minWidth: 0,
                  height: '100%',
                  border: 'none',
                  outline: 'none',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: 'var(--foreground)',
                  padding: '0 2px',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  backgroundColor: 'transparent',
                }}
              />
            </div>
          ) : (
            <button
              onClick={() => isEditable && isEditMode && onStartEdit(item.id, 'unitPrice')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '1px',
                width: '100%',
                height: showEditAffordance ? '30px' : 'auto',
                padding: showEditAffordance ? '0 10px' : '0',
                borderRadius: '6px',
                border: `1px solid ${showEditAffordance ? 'var(--border)' : 'transparent'}`,
                backgroundColor: showEditAffordance ? '#FFFFFF' : 'transparent',
                cursor: showEditAffordance ? 'text' : 'default',
                transition: 'all 100ms',
                fontFamily: 'Inter, system-ui, sans-serif',
                boxSizing: 'border-box',
              }}
              title={showEditAffordance ? `Click to edit · ${formatMoney(item.unitPrice, docCurrency)}` : undefined}
            >
              <span style={{ fontSize: 12, color: 'var(--muted-foreground)', fontWeight: 600, lineHeight: 1, flexShrink: 0 }}>{pricePrefix}</span>
              {/* Long values truncate with an ellipsis inside the capsule
                  rather than spilling into the next column. The button's
                  `title` surfaces the full value on hover. */}
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', lineHeight: 1, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>
                {formatAmount(item.unitPrice, docCurrency)}
              </span>
            </button>
          )}
          
          {/* Unit label below PPU — only shown in editable mode; the
              read-only branch above uses an inline UOM next to the price. */}
          <span style={{
            position: 'absolute',
            top: '100%',
            left: '0',
            marginTop: '2px',
            fontSize: '10px', fontWeight: 400, color: 'var(--muted-foreground)', lineHeight: '1',
            userSelect: 'none', whiteSpace: 'nowrap',
          }}>
            {findUomById(item.uom)?.fullName || item.uom}
          </span>
        </div>
        )}
      </td>

      {/* Total — line TOTAL = baseSubtotal + line-scoped pricing-rule
          impact + line-scoped one-time adjustment net (same math the
          Advanced Configurator's "Total" tile already runs). The
          breakdown sub-line was replaced with a hover card that lists
          each rule and adjustment separately so users see the full
          composition without polluting every row. */}
      <td className="li-fig li-end" data-label="Total" style={{ padding: '0 12px', textAlign: 'right', verticalAlign: 'middle', maxWidth: 0 }}>
        {(() => {
          /* Base for rule + adjustment overlays is the line's RAW
             subtotal (qty × unit price), not `item.total` which
             already has a legacy pre-baked discount inside it. The
             pricingAPI breakdowns and the configurator both compute
             rules off raw subtotal, so we must use the same base
             here or the column drifts away from the hover card +
             configurator (was rendering 101k while the breakdown +
             configurator agreed on 107k). */
          const baseSubtotal = item.quantity * item.unitPrice;
          const ruleBreakdown = pricingAPI?.breakdowns?.find((b: any) => b.lineId === item.id);
          const ruleDelta = ruleBreakdown ? (ruleBreakdown.premiumAmount - ruleBreakdown.discountAmount) : 0;
          const adjBreakdown = adjustmentsAPI?.lineBreakdowns?.get(item.id);
          const adjDelta = adjBreakdown ? adjBreakdown.net : 0;
          const lineTotal = baseSubtotal + ruleDelta + adjDelta;
          const hasOverlay = ruleDelta !== 0 || adjDelta !== 0;
          return (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <PriceBreakdownHoverCard
                line={{ id: item.id, productId: item.productId, quantity: item.quantity, unitPrice: item.unitPrice }}
                pricingAPI={pricingAPI as any}
                adjustmentsAPI={adjustmentsAPI as any}
                formatCurrency={formatCurrency}
              >
                {/* Hover affordance moved to PriceBreakdownHoverCard's
                    outer wrapper (border-bottom dotted line on the
                    inline-flex container) — renders reliably across
                    layouts where the prior text-decoration on this
                    block-level inner span occasionally got dropped. */}
                <span
                  className="tabular-nums"
                  style={{
                    fontSize: 13, fontWeight: 700, color: 'var(--foreground)', lineHeight: 1,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%',
                  }}
                >
                  {formatCurrency(lineTotal)}
                </span>
              </PriceBreakdownHoverCard>
            </div>
          );
        })()}
      </td>

      {/* Row actions — Pencil (advanced configurator) is always available;
          delete X only renders in edit mode. Pure Tailwind hover chrome
          (Purchase Order `LineItemsPanel` parity, line for line). The
          stopPropagation wrapper keeps row-level onClick from firing when
          the user actually targets one of the action buttons. */}
      <td
        className="li-act"
        style={{
          padding: '0 4px 0 0',
          verticalAlign: 'middle',
          textAlign: 'center',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="inline-flex items-center justify-end gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onOpenConfigurator(item); }}
            className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors duration-150 cursor-pointer"
            title="Edit line"
            aria-label="Edit line"
          >
            <Pencil className="size-3.5" />
          </button>
          {isEditable && isEditMode && (
            <button
              onClick={(e) => { e.stopPropagation(); onDeleteRow(item.id); }}
              className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors duration-150 cursor-pointer"
              title="Remove line item"
              aria-label="Remove line item"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </td>
    </motion.tr>
  );
}

interface ItemsTabTableCleanProps {
  quoteStatus?: string;
  quoteId?: string;
  /** Key for the shared line-item attachment registry in `quoteStore`.
   *  This is the quote NUMBER, not `quoteId` — the Attachments tab reads
   *  the registry by number, so the configurator has to write by number
   *  or the two surfaces silently diverge. */
  attachmentQuoteKey?: string;
  readOnly?: boolean;
  /** Called when a material line-item change occurs (add/delete/modify/qty/uom/pricing) */
  onMaterialChange?: (fieldKey: string, fieldLabel: string, oldValue?: string, newValue?: string) => void;
  /** Called when a per-line pricing-rule or adjustment change in the
   *  configurator constitutes a material event. Parent decides version
   *  prompting; matches the RightSidebar's onAskUserChange contract.
   *  The optional `onRevert` callback runs when the user discards the
   *  version prompt so the per-line mutation can be undone. */
  onAskUserChange?: (fieldKey: string, fieldLabel: string, changeDescription: string, onRevert?: () => void) => void;
  /** Customer this quote is for — forwarded to LineItemConfigModal so the
   *  Pricing Rules Library header shows the correct name + initials. */
  customerName?: string;
  /** Shared pricing-rules API from QuoteDetails. Forwarded to the
   *  configurator so summary + configurator stay in lockstep. */
  pricingAPI?: import('./usePricingRules').PricingRulesAPI;
  /** Shared adjustments API from QuoteDetails. Same purpose for one-time
   *  premiums/discounts. */
  adjustmentsAPI?: import('./useAdjustments').AdjustmentsAPI;
  /** Quote-level freight default — drives the configurator's split
   *  preview math when the user makes the first per-line override. */
  quoteDefaultFreight?: number;
  /** Per-line freight overrides keyed by line id. Lifted to
   *  QuoteDetails so the freight summary modal and the configurator
   *  read from / write to the same source of truth. */
  lineFreightCosts?: Record<string, number>;
  /** Per-line freight setter (parent-owned). Called by the configurator
   *  on save and by the seed callback for siblings. */
  onSetLineFreightCost?: (lineId: string, cost: number | undefined) => void;
  /** Bulk seed used by the configurator's split confirmation — writes
   *  the same share onto every sibling line in one parent update. */
  onSeedLineFreightCosts?: (map: Record<string, number>) => void;
  /** Inline PPU edits on a post-Confirmation quote need the version-bump
   *  consent BEFORE the scope modal — otherwise the user is effectively
   *  editing a read-only quote. The parent supplies this callback; the
   *  scope modal opens only after applyCallback runs. */
  onRequestPriceVersionConfirm?: (fieldLabel: string, oldValue: string, newValue: string, applyCallback: () => void) => void;
  /** Called whenever the internal line-item state changes (initial mount
   *  + every mutation). Lets the parent — QuoteDetails — keep its own
   *  copy of the live lines and pass them down to the sidebar so the
   *  header Ship By derivation reads the same data the table is editing.
   *  Without this, the sidebar would read the stale module-level
   *  MOCK_LINE_ITEMS constant. */
  onLinesChange?: (lines: LineItem[]) => void;
  /** What one of the design's USD dollars is in the quote's currency: the
   *  mock lines open restated by it (QuoteDetails' designFactor). */
  lineFactor?: number;
  /** A currency change from Quote Summary: convert every line once. */
  conversion?: { id: number; factor: number; code: string } | null;
}

function ItemsTable({
  quoteStatus, quoteId, attachmentQuoteKey, readOnly, onMaterialChange, onAskUserChange,
  customerName, pricingAPI, adjustmentsAPI,
  quoteDefaultFreight, lineFreightCosts, onSetLineFreightCost, onSeedLineFreightCosts,
  onRequestPriceVersionConfirm, onLinesChange, lineFactor = 1, conversion,
}: ItemsTabTableCleanProps) {
  const { currency: docCurrency } = useDocCurrency();
  // Item quick-view peek modal (opens from any line-item thumbnail).
  const { open: openItemQuickView, modal: itemQuickViewModal } = useItemQuickView();
  const previewLineItem = (item: LineItem) => {
    const product = PRODUCTS.find((p) => p.id === item.productId);
    const peek: ItemQuickViewItem = {
      code: item.productId,
      description: item.description,
      images: item.image ? [item.image] : (product?.images?.length ? product.images : undefined),
      primaryTag: (() => {
        const ser = !!product?.isSerialized;
        const lot = !!product?.isLotControlled;
        if (lot && ser) return 'Primary: Lot Serialized';
        if (lot && !ser) return 'Primary: Lot Non-Serialized';
        if (ser) return 'Primary: Serialized';
        return 'Primary: Non-Serialized';
      })(),
      material: product?.category,
      uom: item.uom,
      onHand: product?.stockQuantity,
      metrics: [
        { label: 'Unit Price', value: formatMoney(item.unitPrice, docCurrency), caption: 'Unit Price' },
        ...(product?.stockQuantity !== undefined
          ? [{ label: 'In Stock', value: `${product.stockQuantity.toLocaleString()} ${item.uom}`, caption: 'In Stock' }]
          : []),
        { label: 'Qty', value: `${item.quantity} ${item.uom}`, caption: 'On this Quote' },
      ],
    };
    openItemQuickView(peek);
  };

  // Check if there are created line items for this quote
  const createdItems = quoteId ? getCreatedQuoteLineItems(quoteId) : undefined;
  
  const initialItems: LineItem[] = createdItems && createdItems.length > 0
    ? createdItems.map((ci, idx) => ({
        id: ci.id || String(idx + 1),
        productId: ci.productId,
        productName: ci.name,
        description: ci.description,
        image: ci.image,
        quantity: ci.quantity,
        uom: 'EA',
        defaultUom: 'EA',
        unitPrice: ci.unitPrice,
        pricingRules: [],
        oneTimeAdjustments: [],
        subtotal: ci.quantity * ci.unitPrice,
        total: ci.total || ci.quantity * ci.unitPrice,
      }))
    : MOCK_LINE_ITEMS.map((l) => scaleQuoteLine(l, lineFactor, docCurrency));
    
  const [items, setItems] = useState<LineItem[]>(initialItems);
  /* Apply each currency change once (by its id). The page converts a
     created quote's stored lines (QuoteDetails handleCurrencyChange), so a
     table mounted after the change starts from converted lines. */
  const appliedConversion = useRef(conversion?.id ?? 0);
  useEffect(() => {
    if (!conversion || conversion.id === appliedConversion.current) return;
    appliedConversion.current = conversion.id;
    setItems((prev) => prev.map((l) => scaleQuoteLine(l, conversion.factor, conversion.code)));
  }, [conversion]);
  /* Bubble live line-item state up to the parent (QuoteDetails). The
     sidebar needs the latest shipmentConfig.expectedShipDate per line to
     compute the order-header Ship By + divergence warning; without this
     callback the sidebar would only ever see the seed MOCK_LINE_ITEMS. */
  useEffect(() => {
    onLinesChange?.(items);
  }, [items, onLinesChange]);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{ itemId: string; field: 'quantity' | 'unitPrice' } | null>(null);
  const [configuratorItem, setConfiguratorItem] = useState<LineItem | null>(null);
  const [showProductPicker, setShowProductPicker] = useState(false);
  // PPU edits route through the same scope modal the configurator uses,
  // so the question ("this quote only" vs "update item master") is asked
  // consistently regardless of where the user changes the price.
  const [pendingPriceEdit, setPendingPriceEdit] = useState<{ itemId: string; newPrice: number; silent?: boolean } | null>(null);

  // Track newly added item IDs for highlight micro-animation
  const [newlyAddedIds, setNewlyAddedIds] = useState<Set<string>>(new Set());
  const newlyAddedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Editable in draft, sent, and confirmed states — not in converted/cancelled/archived/expired
  const isEditable = (quoteStatus === 'draft' || quoteStatus === 'sent' || quoteStatus === 'confirmed') && !readOnly;
  const isEditMode = isEditable;

  // Clear selection and editing state when leaving draft mode
  useEffect(() => {
    if (!isEditable) {
      setSelectedRows(new Set());
      setEditingCell(null);
    }
  }, [isEditable]);

  /* Mirror parent-owned per-line freight overrides into the local
     items state. Freight is authoritative in QuoteDetails so changes
     made via the FreightBreakdownModal land here too, keeping the
     items table totals and the configurator's freight row in sync. */
  useEffect(() => {
    if (!lineFreightCosts) return;
    setItems((prev) => {
      let changed = false;
      const next = prev.map((item) => {
        const incoming = lineFreightCosts[item.id];
        const current = item.shipmentConfig?.shipmentCost;
        if (incoming === current) return item;
        changed = true;
        if (typeof incoming === 'number') {
          return recalcItem({
            ...item,
            shipmentConfig: { ...(item.shipmentConfig || {}), shipmentCost: incoming },
          });
        }
        const sc = { ...(item.shipmentConfig || {}) } as any;
        delete sc.shipmentCost;
        return recalcItem({ ...item, shipmentConfig: Object.keys(sc).length ? sc : undefined });
      });
      return changed ? next : prev;
    });
    // recalcItem is declared below — referencing it via closure is
    // safe because the function identity is stable across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineFreightCosts]);

  /* In the quote's currency (spec 4.3); whole amounts drop the minor unit, as before. */
  const formatCurrency = (amount: number) =>
    amount % 1 !== 0 ? formatMoney(amount, docCurrency) : formatWhole(amount, docCurrency);

  const toggleRowSelection = (itemId: string) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedRows(newSelected);
  };

  const allRowsSelected = items.length > 0 && selectedRows.size === items.length;
  const toggleAllRows = () => {
    if (allRowsSelected) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(items.map(i => i.id)));
    }
  };

  const getNetAdjustmentPercent = (item: LineItem): number | null => {
    let totalDiscountPercent = 0;
    let totalPremiumPercent = 0;

    item.pricingRules.forEach(rule => {
      if (rule.amountType === '%') {
        if (rule.type === 'discount') totalDiscountPercent += rule.value;
        else totalPremiumPercent += rule.value;
      }
    });

    item.oneTimeAdjustments.forEach(adj => {
      if (adj.amountType === '%') {
        if (adj.type === 'discount') totalDiscountPercent += adj.amount;
        else totalPremiumPercent += adj.amount;
      } else {
        if (item.subtotal > 0) {
          const pct = (adj.amount / item.subtotal) * 100;
          if (adj.type === 'discount') totalDiscountPercent += pct;
          else totalPremiumPercent += pct;
        }
      }
    });

    const net = totalPremiumPercent - totalDiscountPercent;
    if (net === 0 && totalDiscountPercent === 0 && totalPremiumPercent === 0) return null;
    return Math.round(net * 10) / 10;
  };

  const handleDeleteSelected = () => {
    const count = selectedRows.size;
    if (count === 0) return;
    const remainingIds = new Set(selectedRows);
    const applyDelete = () => {
      setItems(items.filter(item => !remainingIds.has(item.id)));
      setSelectedRows(new Set());
      /* Confirmation toast mirrors the SO line removal flow so a
         delete reads the same way in both modules. */
      toast.success(count > 1 ? `${count} lines removed` : 'Line removed');
    };
    if (requiresNewDraftFirst(quoteStatus || '') && onRequestPriceVersionConfirm) {
      onRequestPriceVersionConfirm(
        `Remove ${count} line item${count > 1 ? 's' : ''}`,
        `${items.length} items`,
        `${items.length - count} items`,
        applyDelete,
      );
      return;
    }
    applyDelete();
    onMaterialChange?.('line_item_delete', `Removed ${count} line item${count > 1 ? 's' : ''}`, `${count} items`, '0 items');
  };

  const handleDeleteRow = (itemId: string) => {
    const deleted = items.find(i => i.id === itemId);
    if (!deleted) return;
    const applyDelete = () => {
      setItems(prev => prev.filter(item => item.id !== itemId));
      setSelectedRows(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
      /* Confirmation toast mirrors the SO line removal flow so a
         delete reads the same way in both modules. */
      toast.success('Line removed');
    };
    if (requiresNewDraftFirst(quoteStatus || '') && onRequestPriceVersionConfirm) {
      onRequestPriceVersionConfirm(
        `Remove ${deleted.productName}`,
        `${items.length} items`,
        `${items.length - 1} items`,
        applyDelete,
      );
      return;
    }
    applyDelete();
    onMaterialChange?.('line_item_delete', `Removed ${deleted.productName}`);
  };

  const handleDuplicateSelected = () => {
    const newItems: LineItem[] = [];
    const addedIds: string[] = [];
    const dupToastSeeds: Array<{ itemNum: string; productName: string }> = [];
    const { numbers: dupItemNumbers } = getItemMeta();
    items.forEach(item => {
      newItems.push(item);
      if (selectedRows.has(item.id)) {
        const newId = `${item.id}-dup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        newItems.push({ ...item, id: newId });
        addedIds.push(newId);
        dupToastSeeds.push({ itemNum: dupItemNumbers[item.id] || '?', productName: item.productName });
      }
    });
    const count = newItems.length - items.length;
    if (count === 0) return;

    const applyDup = () => {
      setItems(newItems);
      setSelectedRows(new Set());
      if (addedIds.length > 0) {
        setNewlyAddedIds(new Set(addedIds));
        if (newlyAddedTimerRef.current) clearTimeout(newlyAddedTimerRef.current);
        newlyAddedTimerRef.current = setTimeout(() => setNewlyAddedIds(new Set()), 2000);
      }
      for (const seed of dupToastSeeds) {
        toast.custom((id) => (
          <div
            onClick={() => toast.dismiss(id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '10px 14px', borderRadius: '8px',
              backgroundColor: '#FFFFFF', border: '1px solid var(--border)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.03)',
              fontFamily: 'Inter, system-ui, sans-serif',
              width: '320px', cursor: 'pointer',
            }}
          >
            <div style={{
              width: '28px', height: '28px', borderRadius: '6px',
              backgroundColor: 'var(--accent)', border: '1px solid #DDD6FE',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Layers style={{ width: '14px', height: '14px', color: 'var(--primary)' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--foreground-soft)', lineHeight: 1.2 }}>
                Duplicate of Item #{seed.itemNum} added
              </div>
              <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginTop: '2px', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {seed.productName}
              </div>
            </div>
          </div>
        ), { position: 'top-right', duration: 3000 });
      }
    };

    if (requiresNewDraftFirst(quoteStatus || '') && onRequestPriceVersionConfirm) {
      onRequestPriceVersionConfirm(
        `Duplicate ${count} line item${count > 1 ? 's' : ''}`,
        `${items.length} items`,
        `${items.length + count} items`,
        applyDup,
      );
      return;
    }
    applyDup();
    onMaterialChange?.('line_item_add', `Duplicated ${count} line item${count > 1 ? 's' : ''}`);
  };

  const recalcItem = (item: LineItem): LineItem => {
    const subtotal = item.quantity * item.unitPrice;
    let discounts = 0;
    let premiums = 0;

    item.pricingRules.forEach(rule => {
      const impact = rule.amountType === '%' ? (subtotal * rule.value) / 100 : rule.value;
      if (rule.type === 'discount') discounts += impact;
      else premiums += impact;
    });

    item.oneTimeAdjustments.forEach(adj => {
      const impact = adj.amountType === '%' ? (subtotal * adj.amount) / 100 : adj.amount;
      if (adj.type === 'discount') discounts += impact;
      else premiums += impact;
    });

    /* Per-line freight override adds onto the line total so the items
       table reflects the override the user just confirmed in the
       configurator. Quote-level (no shipmentCost) lines contribute $0
       here — that freight is summed separately at the quote level. */
    const lineFreight = typeof item.shipmentConfig?.shipmentCost === 'number'
      ? (item.shipmentConfig.shipmentCost as number)
      : 0;

    return { ...item, subtotal, total: subtotal - discounts + premiums + lineFreight };
  };

  const handleStartEdit = (itemId: string, field: 'quantity' | 'unitPrice') => {
    setEditingCell({ itemId, field });
  };

  const applyEdit = (itemId: string, field: 'quantity' | 'unitPrice', value: number, opts?: { silent?: boolean }) => {
    const oldItem = items.find(i => i.id === itemId);
    setItems(prevItems =>
      prevItems.map(item => {
        if (item.id !== itemId) return item;
        const updated = { ...item, [field]: field === 'quantity' ? Math.round(value) : value };
        return recalcItem(updated);
      })
    );
    setEditingCell(null);
    /* `silent` skips the onMaterialChange notification. Set by the
       version-first qty path so we don't re-open the AutoVersionConfirm
       modal: the parent already created the new draft for this edit,
       and the stale-closure copy of `onMaterialChange` captured by the
       deferred callback would otherwise read the pre-bump quoteStatus
       and open a second confirmation. */
    if (oldItem && !opts?.silent) {
      const fieldKey = field === 'quantity' ? 'quantity' : 'unit_price';
      const label = field === 'quantity' ? `Quantity · ${oldItem.productName}` : `Unit Price · ${oldItem.productName}`;
      onMaterialChange?.(fieldKey, label, String(oldItem[field]), String(value));
    }
  };

  const handleCommitEdit = (itemId: string, field: 'quantity' | 'unitPrice', value: number) => {
    const oldItem = items.find(i => i.id === itemId);
    // PPU edits surface the scope modal (this quote only vs item master)
    // before committing — only when the value actually changed.
    if (field === 'unitPrice' && oldItem && value !== oldItem.unitPrice) {
      setEditingCell(null);
      // On a post-Confirmation quote the version-bump consent has to come
      // FIRST — otherwise the user is editing a read-only quote. The
      // scope modal opens via the apply callback only after the parent
      // creates the new draft version.
      if (requiresNewDraftFirst(quoteStatus || '') && onRequestPriceVersionConfirm) {
        onRequestPriceVersionConfirm(
          `Unit Price · ${oldItem.productName}`,
          formatMoney(oldItem.unitPrice, docCurrency),
          formatMoney(value, docCurrency),
          /* `silent` flag carried through pendingPriceEdit so the
             applyEdit downstream of the scope modal doesn't fire a
             second onMaterialChange — the version bump already counts
             as the material change. */
          () => setPendingPriceEdit({ itemId, newPrice: value, silent: true }),
        );
      } else {
        setPendingPriceEdit({ itemId, newPrice: value });
      }
      return;
    }
    // Quantity edits: same version-first guard as PPU. Without this,
    // applyEdit mutates `items` immediately and a subsequent Discard on
    // the AutoVersionConfirm modal leaves the new qty stranded in the UI.
    if (field === 'quantity' && oldItem && value !== oldItem.quantity) {
      if (requiresNewDraftFirst(quoteStatus || '') && onRequestPriceVersionConfirm) {
        setEditingCell(null);
        onRequestPriceVersionConfirm(
          `Quantity · ${oldItem.productName}`,
          String(oldItem.quantity),
          String(value),
          // `silent` so the deferred apply doesn't fire a second
          // onMaterialChange — the version bump already counts as
          // the material change for this edit.
          () => applyEdit(itemId, 'quantity', value, { silent: true }),
        );
        return;
      }
    }
    applyEdit(itemId, field, value);
  };

  const handlePriceScopeChoice = (scope: PriceScope) => {
    if (!pendingPriceEdit) return;
    const { itemId, newPrice, silent } = pendingPriceEdit;
    setPendingPriceEdit(null);
    applyEdit(itemId, 'unitPrice', newPrice, { silent });
    if (scope === 'master') {
      toast.success('Item master price updated — future quotes will use this price');
    } else {
      toast.success('Price updated for this quote only');
    }
  };

  const handleCancelEdit = () => {
    setEditingCell(null);
  };

  const handleConfiguratorSave = (updatedItem: LineItem) => {
    const applyConfig = () => {
      setItems(prevItems =>
        prevItems.map(item => {
          if (item.id !== updatedItem.id) return item;
          return recalcItem(updatedItem);
        })
      );
      /* Bubble the freight cost change to the parent map so the
         FreightBreakdownModal and any other consumer that reads from
         lineFreightCosts pick it up immediately. */
      const nextCost = updatedItem.shipmentConfig?.shipmentCost;
      onSetLineFreightCost?.(updatedItem.id, typeof nextCost === 'number' ? nextCost : undefined);
    };

    // Version-first gate: post-Sent edits to a line via the configurator
    // are material — defer the local-state mutation until the user has
    // agreed to fork a new draft. Without this, the configurator changes
    // landed immediately and persisted even when the user picked Discard
    // on the AutoVersionConfirm modal.
    if (requiresNewDraftFirst(quoteStatus || '') && onRequestPriceVersionConfirm) {
      onRequestPriceVersionConfirm(
        `Configuration · ${updatedItem.productName}`,
        'Previous configuration',
        'Updated configuration',
        applyConfig,
      );
      return;
    }

    applyConfig();
    onMaterialChange?.('line_item_modify', `Modified ${updatedItem.productName}`);
  };

  const handleAddProducts = (products: { product: any; quantity: number }[]) => {
    const addedIds: string[] = [];
    const current = [...items];
    const duplicateNames: string[] = [];

    for (const { product, quantity } of products) {
      const subtotal = quantity * product.unitPrice;
      const newId = `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${product.id}`;
      const newItem: LineItem = {
        id: newId,
        productId: product.id,
        productName: product.name,
        description: product.description,
        image: product.images?.[0],
        quantity,
        uom: 'EA',
        defaultUom: 'EA',
        unitPrice: product.unitPrice,
        pricingRules: [],
        oneTimeAdjustments: [],
        subtotal,
        total: subtotal,
      };
      addedIds.push(newId);
      const lastIndex = current.map(i => i.productId).lastIndexOf(product.id);
      if (lastIndex !== -1) {
        const existingItem = current.find(i => i.productId === product.id);
        duplicateNames.push(existingItem?.productName || product.name);
        current.splice(lastIndex + 1, 0, newItem);
      } else {
        current.push(newItem);
      }
    }

    // Version-first gate: adding a line to a post-Sent quote is material.
    // Defer the actual `setItems` (plus the duplicate toasts + highlight
    // pulse) until the user has confirmed the version bump. Discarding
    // leaves the line list untouched.
    const applyAdd = () => {
      setItems(current);
      for (const name of duplicateNames) {
        toast.custom((tid) => (
          <div
            onClick={() => toast.dismiss(tid)}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '10px 14px', borderRadius: '8px',
              backgroundColor: '#FFFFFF', border: '1px solid var(--border)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.03)',
              fontFamily: 'Inter, system-ui, sans-serif',
              width: '320px', cursor: 'pointer',
            }}
          >
            <div style={{
              width: '28px', height: '28px', borderRadius: '6px',
              backgroundColor: 'var(--accent)', border: '1px solid #DDD6FE',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Layers style={{ width: '14px', height: '14px', color: 'var(--primary)' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--foreground-soft)', lineHeight: 1.2 }}>
                Duplicate of {name} added
              </div>
              <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginTop: '2px', lineHeight: 1.3 }}>
                Item already exists, added as a separate line
              </div>
            </div>
          </div>
        ), { position: 'top-right', duration: 3000 });
      }
      if (addedIds.length > 0) {
        setNewlyAddedIds(new Set(addedIds));
        if (newlyAddedTimerRef.current) clearTimeout(newlyAddedTimerRef.current);
        newlyAddedTimerRef.current = setTimeout(() => setNewlyAddedIds(new Set()), 2000);
      }
    };

    if (requiresNewDraftFirst(quoteStatus || '') && onRequestPriceVersionConfirm) {
      const names = products.map(p => p.product.name).join(', ');
      onRequestPriceVersionConfirm(
        `Add line item${products.length > 1 ? 's' : ''}`,
        `${items.length} items`,
        `${items.length + products.length} items (added: ${names})`,
        applyAdd,
      );
      return;
    }

    applyAdd();
    const namesForToast = products.map(p => p.product.name).join(', ');
    onMaterialChange?.('line_item_add', `Added ${products.length} item${products.length > 1 ? 's' : ''}: ${namesForToast}`);
  };

  const handleUomChange = (itemId: string, newUom: string) => {
    const oldItem = items.find(i => i.id === itemId);
    if (!oldItem || oldItem.uom === newUom) return;

    /* Unit changes scale PPU by the conversion factor between units.
       If the line was priced at $10 / EA and the user switches to a
       Box (12 EA), the PPU becomes $120 / Box so the per-line total
       (and the quote grand total downstream) stays consistent with
       the underlying item cost. The shared `UOM_OPTIONS` `multiplier`
       field is the number of base units (EA) per one of the chosen
       unit, so the scale factor is `new / old`. Unknown UoMs fall
       back to a 1× factor and just rename the unit. */
    /* Multiplier resolved within the item's product set — a Liter and
       a Box never interconvert, so cross-set conversions fall back to
       1× via `multiplierWithinSet`. */
    const productForRescale = PRODUCTS.find((p) => p.id === oldItem.productId);
    const itemSet = productForRescale ? getUomSetForProduct(productForRescale) : UOM_OPTIONS;
    const oldMult = multiplierWithinSet(oldItem.uom, itemSet);
    const newMult = multiplierWithinSet(newUom, itemSet);
    const scaleFactor = newMult / oldMult;
    const scaledUnitPrice = roundTo(docCurrency, oldItem.unitPrice * scaleFactor);
    const oldUnitPrice = oldItem.unitPrice;

    const applyUom = () => {
      setItems(prevItems =>
        prevItems.map(item => {
          if (item.id !== itemId) return item;
          const updated = { ...item, uom: newUom, unitPrice: scaledUnitPrice };
          return recalcItem(updated);
        })
      );
    };

    const fmtPpu = (v: number) => formatMoney(v, docCurrency);

    /* Version-first gate: on sent/confirmed quotes, defer the UoM
       mutation until the user has agreed to fork a new draft. The
       confirm modal carries both the UoM swap AND the PPU rescale, so
       cancelling the prompt rolls back to the original unit price too
       (otherwise we'd strand a $120 / EA on the line when the user
       walks away). The `oldValue` / `newValue` strings spell out both
       sides of the change so the autoversion overlay reads honestly. */
    if (requiresNewDraftFirst(quoteStatus || '') && onRequestPriceVersionConfirm) {
      onRequestPriceVersionConfirm(
        `UOM · ${oldItem.productName}`,
        `${oldItem.uom} · ${fmtPpu(oldUnitPrice)} / ${oldItem.uom}`,
        `${newUom} · ${fmtPpu(scaledUnitPrice)} / ${newUom}`,
        applyUom,
      );
      return;
    }

    applyUom();
    onMaterialChange?.(
      'uom',
      `UOM · ${oldItem.productName}`,
      `${oldItem.uom} · ${fmtPpu(oldUnitPrice)} / ${oldItem.uom}`,
      `${newUom} · ${fmtPpu(scaledUnitPrice)} / ${newUom}`,
    );
  };

  // Sequential numbering (1, 2, 3, 4…) — no sub-numbering for duplicates
  // Also computes originalItemNumber for "Duplicate of #N" labels
  const getItemMeta = () => {
    const numbers: { [itemId: string]: string } = {};
    const parentGroupNumbers: { [itemId: string]: number | null } = {};
    const originalItemNumbers: { [itemId: string]: number | null } = {};

    // Track the first occurrence line number for each productId
    const firstOccurrence: { [productId: string]: number } = {};

    items.forEach((item, index) => {
      const lineNum = index + 1;
      // Shipment-style 3-digit zero-padded numbering: 1 → "001"
      numbers[item.id] = String(lineNum).padStart(3, "0");

      if (!(item.productId in firstOccurrence)) {
        // This is the original item
        firstOccurrence[item.productId] = lineNum;
        parentGroupNumbers[item.id] = null;
        originalItemNumbers[item.id] = null;
      } else {
        // This is a duplicate
        parentGroupNumbers[item.id] = firstOccurrence[item.productId];
        originalItemNumbers[item.id] = firstOccurrence[item.productId];
      }
    });
    return { numbers, parentGroupNumbers, originalItemNumbers };
  };

  const { numbers: itemNumbers, parentGroupNumbers, originalItemNumbers } = getItemMeta();

  // Count unique products for display
  const uniqueProductCount = new Set(items.map(i => i.productId)).size;

  return (
    <>
      {/* CSS keyframes for newly-added row highlight */}
      <style>{`
        @keyframes newRowHighlight {
          0% { background-color: var(--accent); }
          40% { background-color: var(--accent); }
          100% { background-color: var(--background); }
        }
        .newly-added-row {
          animation: newRowHighlight 2s ease-out forwards;
        }
      `}</style>
      {/* Unified table card — single border on all four sides + elevation-1
          shadow, matching SO `SOLineGrid` (`bg-card border border-border`
          + `rounded-xl`). The header and body live as children of this
          one wrapper so the chrome reads as a single card and the header
          row doesn't appear to float. */}
      <div
        className="bg-card border border-border"
        style={{ borderRadius: 12, boxShadow: 'var(--elevation-1)', overflow: 'hidden' }}
      >
      {/* Sticky toolbar — only the bottom divider; the outer wrapper owns
          the card's external borders. */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          /* On a narrow card the buttons wrap under the title rather
             than squeezing it onto two lines. */
          flexWrap: 'wrap',
          gap: 8,
          padding: '10px 16px',
          backgroundColor: 'var(--card)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        {/* Title — Partner DashInfoCard pattern (icon chip + title + Info tooltip) */}
        <div className="flex items-center gap-2 whitespace-nowrap">
          <div className="w-6 h-6 rounded-md bg-accent flex items-center justify-center shrink-0">
            <Package className="w-3 h-3 text-primary" />
          </div>
          <span className="text-[13px] text-slate-700" style={{ fontWeight: 600, lineHeight: 1 }}>
            Line Items
          </span>
          <NumberPill count={items.length} />
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex shrink-0 cursor-help">
                <Info className="w-3 h-3 text-slate-300 hover:text-slate-400 transition-colors" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] z-[300]">
              Products and services included on this quote. Add items from the catalog, configure quantities, and apply pricing rules per line.
            </TooltipContent>
          </Tooltip>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
          {/* Bulk actions when items are selected */}
          {isEditable && selectedRows.size > 0 ? (
            <>
              <span style={{
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--muted-foreground)',
                lineHeight: '1',
                whiteSpace: 'nowrap',
              }}>
                {selectedRows.size} selected
              </span>
              <button
                onClick={handleDuplicateSelected}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  height: '32px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  backgroundColor: '#FFFFFF',
                  color: 'var(--foreground)',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  lineHeight: '1',
                  transition: 'all 150ms',
                  fontFamily: 'Inter, system-ui, sans-serif',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; e.currentTarget.style.borderColor = 'var(--border)'; }}
              >
                <Copy style={{ width: '12px', height: '12px' }} />
                Duplicate
              </button>
              <button
                onClick={handleDeleteSelected}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  height: '32px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  border: '1px solid #FCA5A5',
                  backgroundColor: '#FFFFFF',
                  color: 'var(--destructive)',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  lineHeight: '1',
                  transition: 'all 150ms',
                  fontFamily: 'Inter, system-ui, sans-serif',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(220, 38, 38, 0.1)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
              >
                <Trash2 style={{ width: '12px', height: '12px' }} />
                Delete
              </button>
              <div style={{ width: '1px', height: '18px', backgroundColor: 'var(--border)', flexShrink: 0 }} />
              <button
                onClick={() => setSelectedRows(new Set())}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  backgroundColor: '#FFFFFF',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'all 150ms',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                title="Clear selection"
              >
                <X style={{ width: '13px', height: '13px', color: 'var(--muted-foreground)' }} />
              </button>
            </>
          ) : isEditable ? (
            /* Partner v7 primary top-right button chrome —
               VendorDetailsPage.tsx:5224. Same h-9 / rounded-lg /
               shadow as the white twin used in SO. */
            <button
              type="button"
              onClick={() => setShowProductPicker(true)}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-primary hover:bg-[#0862D0] text-white shadow-sm transition-colors cursor-pointer"
              style={{ fontSize: 13, fontWeight: 600 }}
            >
              <Plus className="w-3.5 h-3.5" />
              Add Line Item
            </button>
          ) : null}
        </div>
      </div>

      {/* Table body container — sits inside the unified card wrapper
          above, so no extra borders or shadow here. */}
      <div
        style={{
          backgroundColor: 'var(--card)',
        }}
      >
        {/* Table */}
        {items.length === 0 ? (
          <div className="flex items-center justify-center px-10" style={{ padding: '64px 40px', minHeight: '400px' }}>
            <EmptyPlaceholder
              icon={Package}
              title="No line items yet"
              description="Add products from the catalog to start building this quote."
              actionLabel={isEditable ? 'Add Items' : undefined}
              onAction={isEditable ? () => setShowProductPicker(true) : undefined}
            />
          </div>
        ) : (
        <div className="li-wrap">
          {/* Never scrolls sideways. Below ~840px of card width each row
              brings its figures down under the item instead; the gutter
              and action widths below feed that layout
              (line-table-responsive.css). */}
          <table
            className="li-table"
            style={{
              width: '100%', borderCollapse: 'collapse', tableLayout: 'auto',
              ['--li-sel-w' as any]: isEditMode ? '44px' : '0px',
              ['--li-num-w' as any]: '44px',
              ['--li-act-w' as any]: isEditMode ? '76px' : '40px',
            }}
          >
            <colgroup>
              <col style={{ width: isEditMode ? '44px' : '0px' }} />
              <col style={{ width: '44px' }} />
              <col />
              {/* QTY / UoM, PPU, TOTAL — column widths act as a minimum
                  hint under auto table layout, so a longer-label UoM
                  (Pallet, Bundle, Carton) grows the column to fit
                  instead of getting cropped. Matches the Sales Order
                  table behaviour. */}
              <col style={{ width: '132px' }} />
              <col style={{ width: '128px' }} />
              <col style={{ width: '124px' }} />
              {/* Action column — Pencil is always rendered (view or edit
                  Advanced Configurator), so the column needs width even
                  outside edit mode. In edit mode the destructive X joins
                  Pencil so the column widens enough for two 32×32 hit
                  targets plus the 4px gap between them (32+32+4 = 68;
                  +8 padding gives 76). */}
              <col style={{ width: isEditMode ? '76px' : '40px' }} />
            </colgroup>
            <thead>
              <tr style={{ height: '32px', borderBottom: '1px solid var(--border)' }}>
                {/* Select-all: Purchase Order's table checkbox (PODemands):
                    ticked when every line is selected, the minus glyph
                    when some are. Clicking from either of those states
                    selects all; clicking a ticked box clears. */}
                <th className="li-sel" style={{ padding: isEditMode ? '0 0 0 16px' : '0', width: isEditMode ? undefined : '0px', textAlign: 'left', verticalAlign: 'middle' }}>
                  {isEditable && isEditMode && (
                    <Checkbox
                      checked={allRowsSelected ? true : selectedRows.size > 0 ? 'indeterminate' : false}
                      onCheckedChange={toggleAllRows}
                      aria-label={allRowsSelected ? 'Deselect all lines' : 'Select all lines'}
                      className="translate-y-[1px]"
                    />
                  )}
                </th>
                <th className="li-num" style={{ padding: '0 8px', textAlign: 'center', verticalAlign: 'middle' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', lineHeight: 1 }}>
                    #
                  </span>
                </th>
                <th className="li-main" style={{ padding: '0 12px', textAlign: 'left', verticalAlign: 'middle' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', lineHeight: 1 }}>
                    LINE ITEMS
                  </span>
                </th>
                <th className="li-fig" style={{ padding: '0 12px', textAlign: 'left', verticalAlign: 'middle' }}>
                  <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase' as const, letterSpacing: '0.5px', lineHeight: '1', whiteSpace: 'nowrap' }}>
                    QTY / UOM
                  </span>
                </th>
                <th className="li-fig" style={{ padding: '0 12px', textAlign: 'left', verticalAlign: 'middle' }}>
                  <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase' as const, letterSpacing: '0.5px', lineHeight: '1', whiteSpace: 'nowrap' }}>
                    Price Per Unit
                  </span>
                </th>
                <th className="li-fig" style={{ padding: '0 12px', textAlign: 'right', verticalAlign: 'middle' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', lineHeight: 1 }}>
                    TOTAL
                  </span>
                </th>
                <th className="li-act" style={{ padding: 0, width: isEditMode ? undefined : '0px' }} />
              </tr>
            </thead>
            <tbody>
            <AnimatePresence initial={false}>
              {items.map((item, index) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  index={index}
                  itemNumber={itemNumbers[item.id]}
                  parentGroupNumber={parentGroupNumbers[item.id]}
                  originalItemNumber={originalItemNumbers[item.id]}
                  isFirstInDuplicateGroup={(() => {
                    const sameProductItems = items.filter(i => i.productId === item.productId);
                    return sameProductItems.length > 1 && sameProductItems[0].id === item.id;
                  })()}
                  isInDuplicateGroup={items.filter(i => i.productId === item.productId).length > 1}
                  duplicateGroupSize={items.filter(i => i.productId === item.productId).length}
                  isSelected={selectedRows.has(item.id)}
                  isHovered={hoveredRow === item.id}
                  isEditable={isEditable}
                  isEditMode={isEditMode}
                  isNewlyAdded={newlyAddedIds.has(item.id)}
                  editingCell={editingCell}
                  onHover={setHoveredRow}
                  onToggleSelect={toggleRowSelection}
                  onOpenConfigurator={setConfiguratorItem}
                  onPreviewItem={previewLineItem}
                  onStartEdit={handleStartEdit}
                  onCommitEdit={handleCommitEdit}
                  onCancelEdit={handleCancelEdit}
                  onUomChange={handleUomChange}
                  onDeleteRow={handleDeleteRow}
                  formatCurrency={formatCurrency}
                  getNetAdjustmentPercent={getNetAdjustmentPercent}
                  pricingAPI={pricingAPI}
                  adjustmentsAPI={adjustmentsAPI}
                />
              ))}
            </AnimatePresence>
            </tbody>
          </table>
        </div>
        )}

      </div>
      </div>

      {/* PPU scope modal — same dialog the configurator shows when the user
          edits unit price. Cancelling here discards the new price; picking
          a scope applies it and forwards to the parent material-change flow
          (which opens the version-bump prompt for Confirmed quotes). */}
      {pendingPriceEdit && (
        <PriceScopeModal
          newPrice={pendingPriceEdit.newPrice}
          onApply={handlePriceScopeChoice}
          onCancel={() => setPendingPriceEdit(null)}
        />
      )}

      {/* Advanced Configurator Modal */}
      {configuratorItem && (() => {
        /* Hydrate the configurator's prop with the product's own
           tracking + sourcing flags so its header pills (Lot tag,
           Serialized/Non-Serialized, Purchased/Manufactured) match
           the line items table. Without this lookup the configurator
           rendered `itemTypeLabel(undefined, undefined)` → bare
           "Non-Serialized" for every line, dropping the Lot prefix on
           lot-controlled rows. */
        const productForConfig = PRODUCTS.find((p) => p.id === configuratorItem.productId);
        return (
        <LineItemConfigModal
          isOpen={true}
          onClose={() => setConfiguratorItem(null)}
          item={{
            id: configuratorItem.id,
            productId: configuratorItem.productId,
            name: configuratorItem.productName,
            description: configuratorItem.description,
            quantity: configuratorItem.quantity,
            unitPrice: configuratorItem.unitPrice,
            discount: 0,
            total: configuratorItem.total,
            image: configuratorItem.image,
            /* Hand the configurator the line's saved shipment state so
               the freight row opens with the right per-line value
               (instead of falling back to DEFAULT_SHIPMENT every open). */
            shipmentConfig: configuratorItem.shipmentConfig,
            /* Forward the line's stored UoM so the configurator's
               Qty/Unit field opens on the same unit the row shows in
               the table. */
            uom: configuratorItem.uom,
            /* Product-derived tracking + sourcing flags — the header
               pills key off these. */
            isSerialized: productForConfig?.isSerialized,
            isLotControlled: productForConfig?.isLotControlled,
            sourceType: productForConfig?.sourceType,
          }}
          // Split-context props enable the Partner-style "Split and
          // switch to per-line" confirmation on the Override button
          // when this is the FIRST per-line override across the quote.
          // - quoteDefaultFreight: lifted from QuoteDetails, falling
          //   back to the local demo constant only when this component
          //   is rendered standalone (e.g. Storybook).
          // - anyOtherLineHasOverride: derived from the parent's
          //   freight map (single source of truth).
          // - onSeedSiblingFreightShares: bulk-writes the same share
          //   onto every sibling via the parent setter so the
          //   FreightBreakdownModal and items table both reflect the
          //   conversion in one update.
          quoteDefaultFreight={typeof quoteDefaultFreight === 'number' ? quoteDefaultFreight : DEMO_QUOTE_DEFAULT_FREIGHT}
          /* Enable the internal-notes link picker inside the shared
             AdjustmentFormModal by handing down the quote id +
             current user. */
          docId={quoteId}
          attachmentScopeKey={attachmentQuoteKey}
          currentUser="Sarah Chen"
          siblingLineCount={items.length}
          anyOtherLineHasOverride={items.some((i) =>
            i.id !== configuratorItem.id &&
            (typeof lineFreightCosts?.[i.id] === 'number' || typeof i.shipmentConfig?.shipmentCost === 'number')
          )}
          onSeedSiblingFreightShares={(sharePerLine) => {
            const map: Record<string, number> = {};
            items.forEach((i) => { if (i.id !== configuratorItem.id) map[i.id] = sharePerLine; });
            if (onSeedLineFreightCosts) {
              onSeedLineFreightCosts(map);
            } else {
              /* Fallback for the standalone case (no parent wiring):
                 mutate local items directly so the demo still works. */
              setItems((prev) => prev.map((i) =>
                i.id === configuratorItem.id
                  ? i
                  : recalcItem({ ...i, shipmentConfig: { ...(i.shipmentConfig || {}), shipmentCost: sharePerLine } }),
              ));
            }
          }}
          onSave={(updatedItem: any) => {
            handleConfiguratorSave({
              ...configuratorItem,
              quantity: updatedItem.quantity ?? configuratorItem.quantity,
              unitPrice: updatedItem.unitPrice ?? configuratorItem.unitPrice,
              /* Persist the configurator's shipment config back to the
                 line so the items table + freight breakdown modal can
                 both read the same per-line value. */
              shipmentConfig: updatedItem.shipmentConfig ?? configuratorItem.shipmentConfig,
            });
            setConfiguratorItem(null);
          }}
          readOnly={!isEditable}
          customerName={customerName}
          pricingAPI={pricingAPI}
          adjustmentsAPI={adjustmentsAPI}
          lineId={configuratorItem.id}
          // Post-draft: library Apply/Remove/Activate/Deactivate stage
          // on the next version. Per-line/adjustment actions still apply
          // locally with the version prompt.
          stageLibraryChanges={quoteStatus === 'sent' || quoteStatus === 'confirmed'}
          onMaterialEvent={(description, onRevert) =>
            onAskUserChange?.('line_item_pricing', 'Line Item Pricing', description, onRevert)
          }
        />
        );
      })()}

      {/* Product Picker Modal — now passes per-line lock signals and a
          material-change callback so edits on already-saved lines kick
          off the auto-version draft flow. A line is locked when the
          parent quote is converted OR when units have shipped from it. */}
      <ProductPickerModal
        isOpen={showProductPicker}
        onClose={() => setShowProductPicker(false)}
        onAddProducts={handleAddProducts}
        existingProductIds={items.map(i => i.productId)}
        existingItems={items.map(i => ({
          productId: i.productId,
          quantity: i.quantity,
          productName: i.productName,
          shippedQty: (i as any).shippedQty ?? 0,
          isLocked: quoteStatus === 'converted',
          /* Forward the line's existing UoM + unit price so the
             picker opens each row on the unit it already uses
             instead of defaulting every line back to EA. */
          uom: i.uom,
          unitPrice: i.unitPrice,
        }))}
        quoteIsConverted={quoteStatus === 'converted'}
        onMaterialChange={(description) => onMaterialChange?.('line_item_picker_edit', description)}
        onUpdateExisting={(updates) => {
          /* Apply the picker's staged edits to the live items list.
             Removes are processed first so the remaining lineIndex
             pointers from the picker still address the correct row.
             We sort removals descending so each splice doesn't shift
             the indices of pending removals further down. UoM + unit
             price edits land alongside qty edits so a picker-side
             unit swap (EA → Box) lands in the live table verbatim. */
          if (updates.length === 0) return;
          const removals = updates
            .filter(u => u.remove && typeof u.lineIndex === 'number')
            .sort((a, b) => b.lineIndex - a.lineIndex);
          const inPlaceEdits = updates.filter(u => !u.remove && (typeof u.quantity === 'number' || typeof u.uom === 'string' || typeof u.unitPrice === 'number'));
          setItems(prev => {
            let next = prev.slice();
            for (const u of inPlaceEdits) {
              const target = next[u.lineIndex];
              if (!target || target.productId !== u.productId) continue;
              const newQty = typeof u.quantity === 'number' ? u.quantity : target.quantity;
              const newUnitPrice = typeof u.unitPrice === 'number' ? u.unitPrice : target.unitPrice;
              const newUom = typeof u.uom === 'string' ? u.uom : target.uom;
              const subtotal = newQty * newUnitPrice;
              next[u.lineIndex] = { ...target, quantity: newQty, unitPrice: newUnitPrice, uom: newUom, subtotal, total: subtotal };
            }
            for (const u of removals) {
              const target = next[u.lineIndex];
              if (!target || target.productId !== u.productId) continue;
              next.splice(u.lineIndex, 1);
            }
            return next;
          });
        }}
      />

      {/* Item peek modal — opens on thumbnail click anywhere in the line-item table */}
      {itemQuickViewModal}

    </>
  );
}

export function ItemsTabTableClean({
  quoteStatus, quoteId, attachmentQuoteKey, readOnly, onMaterialChange, onAskUserChange,
  customerName, pricingAPI, adjustmentsAPI,
  quoteDefaultFreight, lineFreightCosts, onSetLineFreightCost, onSeedLineFreightCosts,
  onRequestPriceVersionConfirm, onLinesChange, lineFactor, conversion,
}: ItemsTabTableCleanProps) {
  return (
    <ItemsTable
      quoteStatus={quoteStatus}
      quoteId={quoteId}
      attachmentQuoteKey={attachmentQuoteKey}
      readOnly={readOnly}
      onMaterialChange={onMaterialChange}
      onAskUserChange={onAskUserChange}
      customerName={customerName}
      pricingAPI={pricingAPI}
      adjustmentsAPI={adjustmentsAPI}
      quoteDefaultFreight={quoteDefaultFreight}
      lineFreightCosts={lineFreightCosts}
      onSetLineFreightCost={onSetLineFreightCost}
      onSeedLineFreightCosts={onSeedLineFreightCosts}
      onRequestPriceVersionConfirm={onRequestPriceVersionConfirm}
      onLinesChange={onLinesChange}
      lineFactor={lineFactor}
      conversion={conversion}
    />
  );
}