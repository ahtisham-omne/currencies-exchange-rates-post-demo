export interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  unitPrice: number;
  images: string[];
  stockQuantity: number;
  badges: string[];
  isSerialized: boolean;
  sourceType: 'Manufactured' | 'Purchased';
  isLotControlled: boolean;
  isRecentlyOrdered: boolean;
  sku?: string;
}

import { getLineItemImage } from './lineItemImage';

/* ─── SVG placeholder generator (still used for the SKU watermark
       fallback when a sample photo can't be reached) ─── */
function makeSvg(label: string, bg: string, fg: string): string {
  const escaped = label.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const svg = `<svg width="400" height="400" xmlns="http://www.w3.org/2000/svg"><rect width="400" height="400" fill="${bg}"/><text x="50%" y="50%" font-family="system-ui" font-size="14" fill="${fg}" text-anchor="middle" dy=".3em">${escaped}</text></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

const CAT_COLORS: Record<string, [string, string]> = {
  'Base Vehicles':        ['#DBEAFE', '#1E40AF'],
  'Ambulance Modules':    ['#FEE2E2', '#991B1B'],
  'Emergency Lighting':   ['#FEF3C7', '#92400E'],
  'Sirens & Warning':     ['#FCE8E4', '#792616'],
  'Communication':        ['#E0E7FF', '#3730A3'],
  'Interior Upfitting':   ['#DCFCE7', '#065F46'],
  'Electrical Systems':   ['#E9D5FF', '#6B21A8'],
  'HVAC & Climate':       ['#E0F2FE', '#0369A1'],
  'Medical Equipment':    ['#FEE2E2', '#991B1B'],
  'Paint & Graphics':     ['#FFF3C7', '#92400E'],
  'Suspension & Brakes':  ['#FCE8E4', '#792616'],
  'Storage & Organization': ['#DCFCE7', '#065F46'],
  'Flooring & Insulation':['#F3F4F6', '#374151'],
  'Power Management':     ['#E9D5FF', '#6B21A8'],
  'Safety & Compliance':  ['#FEF3C7', '#92400E'],
  'Towing & Recovery':    ['#E0F2FE', '#0369A1'],
  'Fleet Telematics':     ['#DBEAFE', '#1E40AF'],
  'Labor & Services':     ['#F3F4F6', '#374151'],
  'Consumables':          ['#DCFCE7', '#065F46'],
  'Exterior Accessories': ['#E0E7FF', '#3730A3'],
};

/* Returns the sample photo for a product followed by an SVG watermark
   carrying the SKU/label. The first entry is what most viewers render
   (sample product photo, cycled deterministically), and the SVG stays
   as a safety net for offline / blocked-network scenarios. */
function imgFor(cat: string, label: string): string[] {
  const [bg, fg] = CAT_COLORS[cat] || ['#F3F4F6', '#374151'];
  return [getLineItemImage(label), makeSvg(label, bg, fg)];
}

/* ─── Seeded RNG ─── */
function seededRng(seed: number) {
  let s = seed;
  return () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ─── Product templates per category ─── */
interface Tmpl { name: string; desc: string; price: number; serialized: boolean; source: 'Manufactured' | 'Purchased'; lot: boolean; }

const BASE_VEHICLES: Tmpl[] = [
  { name: 'Ford Transit 350 HD Cutaway Chassis', desc: 'Cutaway cab-chassis with 178" wheelbase, 10,360 GVWR, 3.5L EcoBoost V6, heavy-duty alternator, prep-wired for ambulance module.', price: 42500, serialized: true, source: 'Purchased', lot: false },
  { name: 'Ford E-450 Super Duty Stripped Chassis', desc: 'E-450 stripped chassis, 176" wheelbase, 7.3L V8, dual rear wheels, 16,000 GVWR, ambulance prep package with reinforced frame.', price: 48200, serialized: true, source: 'Purchased', lot: false },
  { name: 'Ram ProMaster 3500 Extended High Roof', desc: 'ProMaster 3500 extended 159" WB, high-roof body, front-wheel drive, 3.6L Pentastar V6, commercial-grade interior prep.', price: 39800, serialized: true, source: 'Purchased', lot: false },
  { name: 'Chevrolet Express 3500 Cutaway', desc: 'Express 3500 cutaway with 159" WB, 6.6L V8, heavy-duty suspension, ambulance prep package, dual batteries.', price: 44100, serialized: true, source: 'Purchased', lot: false },
  { name: 'Ford F-550 4x4 Crew Cab Chassis', desc: 'F-550 4x4 crew cab, 84" CA, 7.3L V8, 19,500 GVWR, PTO-ready, ideal for rescue/utility body mounting.', price: 58900, serialized: true, source: 'Purchased', lot: false },
  { name: 'Ford F-350 SRW XL 4x4 Regular Cab', desc: 'F-350 single rear wheel, 4x4, 6.7L Power Stroke diesel, 60" CA, tow-ready, police/utility upfit platform.', price: 46500, serialized: true, source: 'Purchased', lot: false },
  { name: 'Chevrolet Silverado 5500 HD Chassis', desc: '5500 HD regular cab, 4x2, 6.6L Duramax diesel, Allison 10-speed auto, 19,500 GVWR, flat bed ready.', price: 52300, serialized: true, source: 'Purchased', lot: false },
  { name: 'Dodge Durango Pursuit AWD', desc: 'Pursuit-rated Durango AWD, 5.7L HEMI, heavy-duty brakes, police idle management, ballistic door panel prep.', price: 41200, serialized: true, source: 'Purchased', lot: false },
  { name: 'Ford Police Interceptor Utility (Explorer)', desc: 'Explorer-based PI Utility AWD, 3.3L hybrid V6, police calibrated stability control, column shifter, vinyl rear seat.', price: 43800, serialized: true, source: 'Purchased', lot: false },
  { name: 'Mercedes-Benz Sprinter 3500XD Chassis', desc: 'Sprinter 3500XD with 170" WB, 3.0L turbo diesel, 14,050 GVWR, ambulance-ready wiring, dual A/C prep.', price: 54600, serialized: true, source: 'Purchased', lot: false },
  { name: 'International CV 4x2 Medium Duty', desc: 'International CV day cab, 4x2, Cummins B6.7 diesel, Allison 2500 auto, air brakes, 25,500 GVWR, rescue body ready.', price: 68500, serialized: true, source: 'Purchased', lot: false },
  { name: 'Ford Transit 250 Cargo Van Low Roof', desc: 'Transit 250 low roof 130" WB, 3.5L V6, cargo partition, fleet-ready mobile command/utility upfit base.', price: 36200, serialized: true, source: 'Purchased', lot: false },
  { name: 'Chevrolet Tahoe PPV (Police Pursuit)', desc: 'Tahoe PPV, 5.3L V8, police suspension, heavy-duty transmission cooler, spot lamp prep, prisoner partition mount.', price: 44900, serialized: true, source: 'Purchased', lot: false },
  { name: 'Ram 5500 Tradesman 4x4 Chassis Cab', desc: 'Ram 5500 chassis cab, 4x4, 6.7L Cummins turbo diesel, AISIN AS69RC auto, 60" CA, 19,500 GVWR.', price: 56700, serialized: true, source: 'Purchased', lot: false },
  { name: 'Ford E-350 Cutaway 138" WB', desc: 'E-350 cutaway, 138" WB, 7.3L V8, 12,500 GVWR, Type III ambulance platform with dual rear wheel setup.', price: 41800, serialized: true, source: 'Purchased', lot: false },
];

const AMBULANCE_MODULES: Tmpl[] = [
  { name: 'Type I Ambulance Module - Standard', desc: 'Modular aluminum body for truck chassis mount, 150" patient compartment, 72" headroom, FMVSS/KKK-A-1822F compliant.', price: 89500, serialized: true, source: 'Manufactured', lot: false },
  { name: 'Type I Ambulance Module - Extended', desc: 'Extended 168" patient compartment module, walk-through design, reinforced subframe, climate-sealed construction.', price: 108000, serialized: true, source: 'Manufactured', lot: false },
  { name: 'Type II Van Conversion Shell', desc: 'Van body conversion package for Transit/Sprinter. Includes roof raise, bulkhead modification, and structural reinforcement.', price: 52000, serialized: true, source: 'Manufactured', lot: false },
  { name: 'Type III Ambulance Module - Standard', desc: 'Cutaway-mount modular body, 152" compartment, 72" headroom, full walk-through cab access, aluminum/composite construction.', price: 94200, serialized: true, source: 'Manufactured', lot: false },
  { name: 'Type III Ambulance Module - Bariatric', desc: 'Wide-body Type III module with 96" interior width, reinforced floor rated for 1,600 lb stretcher load, bariatric ready.', price: 118500, serialized: true, source: 'Manufactured', lot: false },
  { name: 'Medium Rescue Body - Walk-In', desc: 'Walk-in rescue body, 14ft length, full-height compartments both sides, roll-up doors, 50,000 lumens scene lighting.', price: 78500, serialized: true, source: 'Manufactured', lot: false },
  { name: 'Light Rescue/Squad Body', desc: 'Non-walk-in rescue body for F-550/5500 class chassis, 11ft length, 8 compartments, transverse storage, LED scene lights.', price: 48200, serialized: true, source: 'Manufactured', lot: false },
  { name: 'Mobile Command Center Module', desc: 'Expandable command vehicle module with dual slide-outs, A/V workstations, satellite uplink prep, generator compartment.', price: 165000, serialized: true, source: 'Manufactured', lot: false },
  { name: 'CCT/Neonatal Transport Module', desc: 'Critical Care Transport module with isolette mounting, 4-outlet medical gas, enhanced HVAC, vibration-dampened floor.', price: 125000, serialized: true, source: 'Manufactured', lot: false },
  { name: 'Fire Department Utility Body', desc: 'Custom utility body for fire department SUV/truck, compartmentalized with SCBA storage, hose bed, and tool mounts.', price: 32500, serialized: true, source: 'Manufactured', lot: false },
];

const EMERGENCY_LIGHTING: Tmpl[] = [
  { name: 'Whelen Liberty II LED Lightbar 54"', desc: '54" full-size LED lightbar with 16 modules, red/blue split, integrated alley/takedown, programmable flash patterns.', price: 3250, serialized: false, source: 'Purchased', lot: false },
  { name: 'Federal Signal Integrity LED Lightbar 48"', desc: '48" LED lightbar, dual-color red/white, SignalMaster arrow, built-in intersection clearing, low-profile aerodynamic housing.', price: 2950, serialized: false, source: 'Purchased', lot: false },
  { name: 'Whelen M9 LED Surface Mount (pair)', desc: 'M9 series linear LED surface mount lights, red/white, synchronizable, 12-pattern flash, polycarbonate lens.', price: 285, serialized: false, source: 'Purchased', lot: true },
  { name: 'Code 3 LED X 2100 Rear Warning', desc: 'Dual-stack LED rear warning light with integrated flasher, red/amber, DOT compliant, surface or flush mount.', price: 195, serialized: false, source: 'Purchased', lot: true },
  { name: 'Whelen Pioneer Plus Scene Light', desc: 'High-output LED scene light, 28,000 lumens, 120VAC/12VDC dual input, manual tilt, powder-coated aluminum housing.', price: 685, serialized: false, source: 'Purchased', lot: false },
  { name: 'Federal Signal MicroPulse Ultra LED Grille (set of 6)', desc: 'Ultra-thin grille/surface mount LEDs, red/blue, 18 flash patterns per head, sync-ready, IP67 sealed.', price: 420, serialized: false, source: 'Purchased', lot: true },
  { name: 'Whelen 500 Series TIR6 LED (each)', desc: 'Round 500 series TIR6 super-LED module, versatile red/white, for compartment, step, or perimeter warning.', price: 145, serialized: false, source: 'Purchased', lot: true },
  { name: 'LED Patient Compartment Dome Light Assembly', desc: 'Recessed LED dome light for ambulance patient area, dual-color white/red, dimmable, splash-proof, 4,200 lumens.', price: 320, serialized: false, source: 'Manufactured', lot: false },
  { name: 'Whelen ION T-Series Dash Light (pair)', desc: 'Compact dash/deck mount LED warning light, split red/blue, 23 patterns, magnetic or permanent mount.', price: 185, serialized: false, source: 'Purchased', lot: true },
  { name: 'LED Intersection/Side Warning Kit (4 heads)', desc: 'Four T-Series LED heads with flasher module for intersection clearing, amber/white, surface mount hardware included.', price: 520, serialized: false, source: 'Purchased', lot: true },
  { name: 'Compartment Strip LED Lighting Kit', desc: 'Waterproof LED strip kit for body compartment illumination, 12V, magnetic door switch activation, 6 strips.', price: 165, serialized: false, source: 'Purchased', lot: true },
  { name: 'Whelen LINZ6 Super-LED 6" Round (each)', desc: 'Flush-mount 6" round super-LED, available in red, blue, amber, white, or split colors, polycarbonate lens.', price: 128, serialized: false, source: 'Purchased', lot: true },
  { name: 'Scene Lighting Tower - Pneumatic 8ft', desc: 'Pneumatic telescoping light tower, 8ft extension, 4x LED heads totaling 80,000 lumens, 12V compressor operated.', price: 4200, serialized: true, source: 'Manufactured', lot: false },
  { name: 'Under-Body Perimeter LED Kit (12 modules)', desc: '12-module under-body perimeter warning system, red/blue, synchronized flash, DOT-rated wiring harness.', price: 780, serialized: false, source: 'Purchased', lot: true },
  { name: 'LED Tail/Brake/Turn Conversion Kit', desc: 'Drop-in LED replacement for OEM taillights, integrated flasher compatible, DOT/SAE compliant, plug-and-play.', price: 245, serialized: false, source: 'Purchased', lot: true },
];

const SIRENS_WARNING: Tmpl[] = [
  { name: 'Federal Signal Pathfinder Siren/PA 200W', desc: '200-watt electronic siren with PA, wail/yelp/phaser/hi-lo tones, radio rebroadcast input, backlit controls.', price: 685, serialized: false, source: 'Purchased', lot: false },
  { name: 'Whelen 295SLSA6 Siren Amplifier', desc: '200W remote siren amplifier with 6-button control head, 6 siren tones, park-kill, and light control integration.', price: 625, serialized: false, source: 'Purchased', lot: false },
  { name: 'Federal Signal ES100 Slim-Line Speaker', desc: '100W compact siren speaker, composite housing, stainless bracket, fits behind grille or under bumper.', price: 195, serialized: false, source: 'Purchased', lot: false },
  { name: 'Whelen SA315P Projector Speaker 100W', desc: '100W cast-aluminum projector siren speaker, chrome or black, universal mounting bracket, weather-sealed.', price: 210, serialized: false, source: 'Purchased', lot: false },
  { name: 'Q2B Mechanical Siren with Chrome Bell', desc: 'Electromechanical Q-siren with chrome bell, 12VDC motor, classic fire truck tone, bracket hardware included.', price: 1850, serialized: true, source: 'Purchased', lot: false },
  { name: 'Air Horn Assembly - Dual Trumpet', desc: 'Dual chrome trumpet air horn, 12V compressor, 150 dB output, mounting hardware, relay and tubing kit.', price: 425, serialized: false, source: 'Purchased', lot: false },
  { name: 'Backup Alarm 107 dB - Self-Adjusting', desc: 'Self-adjusting backup alarm, 82-107 dB output, SAE J994 compliant, flush mount, automatic ambient sensing.', price: 65, serialized: false, source: 'Purchased', lot: true },
  { name: 'Whelen HOWLER Low-Frequency Siren', desc: 'Intersection-clearing low-frequency siren system, 12V, produces physical vibration felt through nearby vehicles.', price: 950, serialized: false, source: 'Purchased', lot: false },
];

const COMMUNICATION: Tmpl[] = [
  { name: 'Motorola APX 8500 All-Band Mobile Radio', desc: 'Multi-band P25 Phase II mobile radio, VHF/UHF/700/800 MHz, TDMA, AES 256 encryption, GPS, Bluetooth, OTAP ready.', price: 7850, serialized: true, source: 'Purchased', lot: false },
  { name: 'Motorola APX 6000 Portable Radio', desc: 'P25 Phase II portable, 700/800 MHz, IP68, intrinsically safe option, FIPS 140-2, mission-critical audio.', price: 4200, serialized: true, source: 'Purchased', lot: false },
  { name: 'Kenwood TK-5910 P25 Mobile Radio', desc: 'P25 conventional/trunked mobile, VHF, 110W output, built-in GPS, emergency button, scan/priority channel.', price: 2450, serialized: true, source: 'Purchased', lot: false },
  { name: 'Antenna Specialists ASP7795 800MHz', desc: 'Low-profile 800MHz mobile antenna, NMO mount, 3 dBi gain, ground plane independent, with 17ft RG-58 cable.', price: 85, serialized: false, source: 'Purchased', lot: true },
  { name: 'Havis Console - Ford PI Utility', desc: 'Vehicle-specific center console for Ford Police Interceptor Utility, accepts radio, siren, laptop mount, switches.', price: 1250, serialized: false, source: 'Purchased', lot: false },
  { name: 'Gamber-Johnson Laptop/MDT Dock Mount', desc: 'Articulating laptop dock arm with 75/100mm VESA mount, adjustable angle and height, integrated power/data.', price: 685, serialized: false, source: 'Purchased', lot: false },
  { name: 'Panasonic Toughbook CF-33 Rugged Laptop', desc: '12" fully rugged 2-in-1, Intel i5, 8GB RAM, 256GB SSD, hot-swappable battery, sunlight readable, MIL-STD-810H.', price: 3950, serialized: true, source: 'Purchased', lot: false },
  { name: 'Cradlepoint IBR1700 Mobile Router', desc: '5G-ready mobile router, dual SIM, FirstNet ready, GPS, WiFi 6, 5x Ethernet, vehicle-optimized firmware.', price: 1650, serialized: true, source: 'Purchased', lot: false },
  { name: 'Wilson Electronics 4G/LTE In-Vehicle Booster', desc: 'Mobile cellular signal booster, all carriers, 50 dB gain, magnetic roof antenna, vehicle DC power adapter.', price: 475, serialized: false, source: 'Purchased', lot: false },
  { name: 'Motorola WAVE PTX Push-to-Talk License (annual)', desc: 'Annual broadband push-to-talk subscription, interop with P25 LMR, Android/iOS/desktop, GPS location sharing.', price: 320, serialized: false, source: 'Purchased', lot: false },
];

const INTERIOR_UPFITTING: Tmpl[] = [
  { name: 'Stryker Power-PRO XT Stretcher', desc: 'Powered hydraulic stretcher, 700 lb capacity, battery operated, auto-loading mechanism, isokinetic lowering.', price: 18500, serialized: true, source: 'Purchased', lot: false },
  { name: 'Ferno 35A Proflexx Stretcher', desc: 'Manual stretcher, 650 lb capacity, auto-cot retention system compatible, x-frame, padded surface, dual-lock.', price: 4200, serialized: true, source: 'Purchased', lot: false },
  { name: 'Stretcher Mount - Powered Fastener System', desc: 'Stryker Power-LOAD cot fastening system, automatic loading/unloading, floor rail integration, interlock safety.', price: 12500, serialized: true, source: 'Manufactured', lot: false },
  { name: 'Attendant Seat - Forward-Facing (Captain)', desc: 'Forward-facing captain seat with 3-point harness, CPR-compatible armrest, antimicrobial vinyl, swivel base.', price: 1850, serialized: false, source: 'Manufactured', lot: false },
  { name: 'Attendant Seat - Side-Facing Squad Bench', desc: 'Side-facing bench seat for 2 attendants, 5-point harness per position, under-seat storage, antimicrobial cover.', price: 2400, serialized: false, source: 'Manufactured', lot: false },
  { name: 'Overhead Cabinet Assembly - Patient Side', desc: 'Full-length overhead cabinetry for patient compartment, aluminum frame, polycarbonate doors, LED under-cabinet lights.', price: 3200, serialized: false, source: 'Manufactured', lot: false },
  { name: 'Street-Side Cabinetry Module', desc: 'Modular street-side cabinet system with ALS supply drawers, waste bin, sharps container mount, IV pole socket.', price: 2800, serialized: false, source: 'Manufactured', lot: false },
  { name: 'Action Area Console - Head of Stretcher', desc: 'Head-wall action console with switch panel, 12V outlets, USB ports, clock, thermometer, and equipment rail.', price: 1950, serialized: false, source: 'Manufactured', lot: false },
  { name: 'Partition Wall - Walk-Through with Door', desc: 'Cab-to-module partition with sliding door, window, pass-through communication, climate seal gasket, locking hardware.', price: 1650, serialized: false, source: 'Manufactured', lot: false },
  { name: 'Interior Grab Rail Kit - Stainless', desc: 'Stainless steel grab rail set (6 pieces) for patient compartment, anti-microbial coating, meets FMVSS 217.', price: 420, serialized: false, source: 'Manufactured', lot: true },
  { name: 'Rear Door Step & Grab Handle Assembly', desc: 'Heavy-duty fold-down rear entry step with diamond plate, lighted, and dual stainless grab handles.', price: 650, serialized: false, source: 'Manufactured', lot: false },
  { name: 'ALS Supply Cabinet - 5-Drawer Modular', desc: 'Five-drawer ALS supply cabinet, full-extension ball-bearing slides, auto-latch, color-coded labels, antimicrobial.', price: 1450, serialized: false, source: 'Manufactured', lot: false },
  { name: 'Backboard/Stokes Basket Mount', desc: 'Interior wall-mount bracket for long spine board or Stokes basket, quick-release cam-lock, 2 mounting points.', price: 285, serialized: false, source: 'Manufactured', lot: false },
  { name: 'Prisoner Transport Partition - SUV', desc: 'Full polycarbonate prisoner partition for Tahoe/Explorer, lower steel panel, recessed window, coated steel frame.', price: 1350, serialized: false, source: 'Manufactured', lot: false },
  { name: 'K-9 Transport Insert - Dual Compartment', desc: 'Dual-compartment K-9 insert for SUV, thermostatically controlled fans, auto heat alert, water dish, escape-proof.', price: 3800, serialized: false, source: 'Manufactured', lot: false },
];

const ELECTRICAL_SYSTEMS: Tmpl[] = [
  { name: 'Kussmaul Auto Eject Shoreline (20A)', desc: 'Automatic shoreline power inlet, auto-eject on engine start, 20A 120VAC, weatherproof, with exterior receptacle.', price: 485, serialized: false, source: 'Purchased', lot: false },
  { name: 'Kussmaul Auto Eject Shoreline (30A)', desc: '30A automatic shoreline system for high-demand modules, dual-pole auto-disconnect, NEMA 14-30 plug standard.', price: 645, serialized: false, source: 'Purchased', lot: false },
  { name: 'AIMS 3000W Pure Sine Inverter/Charger', desc: '3000W pure sine wave inverter with 75A battery charger, auto transfer switch, remote panel, 12VDC input.', price: 1650, serialized: true, source: 'Purchased', lot: false },
  { name: 'Xantrex Freedom XC 2000W Inverter/Charger', desc: '2000W true sine wave inverter, 80A battery charger, automatic transfer relay, compact design for ambulance install.', price: 1250, serialized: true, source: 'Purchased', lot: false },
  { name: 'Dual Battery Isolator System (200A)', desc: '200A smart battery isolator with automatic voltage sensing, prevents chassis battery drain, LED status indicator.', price: 285, serialized: false, source: 'Purchased', lot: false },
  { name: 'AGM Deep Cycle Battery Group 31 (each)', desc: '105Ah absorbed glass mat battery, deep cycle rated, maintenance-free, 800 CCA, vibration resistant, 36mo warranty.', price: 295, serialized: false, source: 'Purchased', lot: true },
  { name: 'Auxiliary Wiring Harness - Full Module', desc: 'Complete wiring harness for patient compartment, pre-terminated, labeled circuits, fuse panel, ground bus, connectors.', price: 1850, serialized: false, source: 'Manufactured', lot: false },
  { name: 'Multiplex Electrical System - V-MUX', desc: 'Weldon V-MUX multiplex wiring system, programmable I/O modules, CAN bus, diagnostic tablet interface, reduces wire count 60%.', price: 4500, serialized: true, source: 'Purchased', lot: false },
  { name: '12V Distribution Panel - 24 Circuit', desc: '24-circuit fused distribution panel for module electrical, labeled breakers, LED indicators, DIN rail mount.', price: 385, serialized: false, source: 'Manufactured', lot: false },
  { name: 'High-Output Alternator 320A', desc: '320-amp high-output alternator, direct bolt-on replacement for Ford/GM platforms, dual rectifier, extended duty rated.', price: 950, serialized: true, source: 'Purchased', lot: false },
  { name: '120VAC Duplex Outlet Kit (set of 4)', desc: 'Four hospital-grade 120VAC duplex outlets with GFI protection, weather covers, pre-wired 10ft pigtails.', price: 165, serialized: false, source: 'Purchased', lot: true },
  { name: 'USB Charging Station - 6 Port Panel', desc: 'Flush-mount 6-port USB charging panel (4x USB-A, 2x USB-C), 60W total output, backlit, 12V direct input.', price: 95, serialized: false, source: 'Purchased', lot: true },
  { name: 'LED Load Manager / Timer System', desc: 'Programmable load management relay center, manages battery draw, auto-shed non-critical loads at low voltage.', price: 520, serialized: false, source: 'Purchased', lot: false },
  /* Genuine length-set products — names spell out the spool/roll
     measurement so the UoM data layer routes them to the length
     set (Foot / Yard / Roll). The capsule dropdown surfaces those
     units with a "Primary" pill on Foot. */
  { name: '14 AWG Stranded Primary Wire - 500 ft Spool', desc: 'GPT-rated 14 AWG stranded copper primary wire, 105°C insulation, abrasion-resistant PVC jacket, 500 ft spool. Sold per foot.', price: 95, serialized: false, source: 'Purchased', lot: true },
  { name: '4-Conductor Trailer Cable - 100 ft Spool', desc: 'Color-coded 4-conductor 16 AWG trailer wire spool, PVC jacket, UV-stabilized, 100 ft, for module sub-harnesses. Sold per foot.', price: 145, serialized: false, source: 'Purchased', lot: true },
];

const HVAC_CLIMATE: Tmpl[] = [
  { name: 'Patient Compartment A/C System - Roof Mount', desc: 'Roof-mount A/C unit for ambulance module, 24,000 BTU, R-134a, thermostat controlled, ducted distribution.', price: 5200, serialized: true, source: 'Manufactured', lot: false },
  { name: 'Patient Compartment Heater - Hydronic', desc: 'Hot water heater core system, 40,000 BTU, uses engine coolant, adjustable blower speed, rear-mounted radiator.', price: 2800, serialized: false, source: 'Manufactured', lot: false },
  { name: 'Webasto Air Top Evo 5500 Diesel Heater', desc: '5.5kW diesel-fired air heater for idle-free patient compartment heating, programmable timer, fuel-sipping 0.18 GPH.', price: 3200, serialized: true, source: 'Purchased', lot: false },
  { name: 'HVAC Ducting Kit - Full Module', desc: 'Complete ducting kit for patient compartment, insulated flexible duct, registers, return air grilles, hardware.', price: 650, serialized: false, source: 'Manufactured', lot: false },
  { name: 'Climate Control Panel - Digital', desc: 'Digital thermostat panel for patient compartment, dual-zone, LCD display, fan speed control, temperature readout.', price: 485, serialized: false, source: 'Purchased', lot: false },
  { name: 'Roof-Mount Condenser Unit', desc: 'Standalone condenser for split A/C system, weather-sealed housing, vibration isolators, quick-connect fittings.', price: 1850, serialized: false, source: 'Manufactured', lot: false },
  { name: 'Cab A/C Upgrade Kit - Rear Evaporator', desc: 'Auxiliary cab A/C evaporator, mounts behind rear seat or headliner, 12,000 BTU supplement, OEM integration.', price: 1200, serialized: false, source: 'Purchased', lot: false },
  { name: 'Insulation Kit - Patient Compartment', desc: 'Closed-cell foam insulation kit for module walls and ceiling, R-11 value, vapor barrier, fire retardant rated.', price: 850, serialized: false, source: 'Manufactured', lot: true },
];

const MEDICAL_EQUIPMENT: Tmpl[] = [
  { name: 'Oxygen System - Cascade (3 Cylinder)', desc: '3-cylinder cascade O2 system with manifold, regulator, quick-connect outlets (4), pressure gauge, 2,200 PSI rated.', price: 4500, serialized: true, source: 'Manufactured', lot: false },
  { name: 'On-Board Oxygen Generator (Molecular Sieve)', desc: 'Self-generating O2 concentrator producing 93% oxygen at 10 LPM continuous, 12VDC powered, eliminates cylinder refills.', price: 8900, serialized: true, source: 'Purchased', lot: false },
  { name: 'Suction Unit - Installed (SSCOR)', desc: 'SSCOR QuickDraw permanent mount suction unit, 40 LPM free flow, splash guard canister, easy-clean design.', price: 1250, serialized: true, source: 'Purchased', lot: false },
  { name: 'Monitor Mount - Articulating Arm', desc: 'Universal patient monitor mount arm, 20 lb capacity, full articulation, quick-release VESA plate, lockable positions.', price: 650, serialized: false, source: 'Manufactured', lot: false },
  { name: 'IV Pole - Ceiling Mount (dual hook)', desc: 'Ceiling-recessed IV pole with dual hooks, spring-loaded retract, stainless steel, 10 lb capacity per hook.', price: 285, serialized: false, source: 'Manufactured', lot: false },
  { name: 'Medical Gas Outlet Panel (O2/Air/Suction)', desc: 'Flush-mount triple gas outlet panel, DISS fittings, color-coded per NFPA 99, aluminum faceplate.', price: 425, serialized: false, source: 'Manufactured', lot: false },
  { name: 'Sharps Container Wall Mount (5 qt)', desc: 'Locking wall-mount sharps container, 5 quart capacity, clear lid for fill-level visibility, bracket included.', price: 38, serialized: false, source: 'Purchased', lot: true },
  { name: 'Defibrillator Mount Bracket - Lifepak', desc: 'Quick-release wall mount bracket for Lifepak 15 or Philips HeartStart, anti-vibration base, tether strap.', price: 395, serialized: false, source: 'Manufactured', lot: false },
  { name: 'Ventilator Mount - Ceiling Rail', desc: 'Ceiling-track ventilator mount, compatible with Hamilton/Zoll/LTV, quick-detach, anti-vibration, articulating arm.', price: 575, serialized: false, source: 'Manufactured', lot: false },
  { name: 'CPAP/BiPAP Shelf - Secured', desc: 'Padded shelf with retaining strap for portable CPAP/BiPAP units, 12V power outlet integrated, foam-lined.', price: 185, serialized: false, source: 'Manufactured', lot: false },
];

const PAINT_GRAPHICS: Tmpl[] = [
  { name: 'Full Ambulance Paint - Single Stage White', desc: 'Complete exterior single-stage white paint job, prep/prime/paint/clear, body and cab color match, includes masking.', price: 6500, serialized: false, source: 'Manufactured', lot: false },
  { name: 'Chevron Reflective Striping Kit - Rear', desc: 'NFPA 1901 compliant rear chevron kit, alternating fluorescent yellow-green and red retroreflective, pre-cut panels.', price: 850, serialized: false, source: 'Purchased', lot: false },
  { name: 'Full Vehicle Reflective Stripe Package', desc: 'Complete reflective stripe package per FMVSS 108, side and rear, 3M Diamond Grade material, layout per spec.', price: 1450, serialized: false, source: 'Purchased', lot: false },
  { name: 'Custom Livery Design & Application', desc: 'Custom graphic design, vinyl print and laminate, professional application of agency livery including logos and text.', price: 3200, serialized: false, source: 'Manufactured', lot: false },
  { name: 'Star of Life Decal Set (6 decals)', desc: 'Set of 6 Star of Life decals, reflective blue on white, 12" diameter, 3M IJ180 vinyl with 8519 laminate.', price: 145, serialized: false, source: 'Purchased', lot: true },
  { name: 'Unit Number / ID Lettering (per side)', desc: 'Custom-cut vinyl unit number and ID text, reflective material, applied per customer specification, per side.', price: 185, serialized: false, source: 'Manufactured', lot: false },
  { name: 'Cab Accent Paint - Two-Tone', desc: 'Two-tone cab accent painting, customer color match, includes masking, prep, primer, basecoat, and clearcoat.', price: 2800, serialized: false, source: 'Manufactured', lot: false },
  { name: 'Anti-Graffiti / UV Protective Clear Coat', desc: 'Sacrificial anti-graffiti clear coat for painted surfaces, UV protective, self-healing, 3-year durability.', price: 950, serialized: false, source: 'Purchased', lot: false },
];

const SUSPENSION_BRAKES: Tmpl[] = [
  { name: 'Liquid Spring Rear Suspension System', desc: 'Compressible liquid spring rear suspension, eliminates body roll, self-leveling, 25% better ride quality.', price: 8500, serialized: true, source: 'Purchased', lot: false },
  { name: 'Kelderman Air Ride Rear Suspension Kit', desc: 'Bolt-on air ride conversion for Ford F-450/F-550, adjustable ride height, on-board compressor, digital controller.', price: 6200, serialized: true, source: 'Purchased', lot: false },
  { name: 'Heavy-Duty Front Coil Spring Upgrade', desc: 'Upgraded front coil springs rated for ambulance GVW, maintains ride height with module weight, set of 2.', price: 850, serialized: false, source: 'Purchased', lot: false },
  { name: 'Rear Stabilizer Bar Kit - Ambulance', desc: 'Heavy-duty rear sway bar kit, reduces body roll by 40%, polyurethane bushings, powder-coated, bolt-on install.', price: 425, serialized: false, source: 'Purchased', lot: false },
  { name: 'Front Disc Brake Upgrade Kit', desc: 'Oversized front disc brake upgrade, vented rotors, ceramic pads, stainless lines, 15% shorter stopping distance.', price: 1250, serialized: false, source: 'Purchased', lot: false },
  { name: 'Exhaust Brake / Engine Retarder', desc: 'Variable-geometry turbo exhaust brake, integrated with tow/haul mode, significantly reduces service brake wear.', price: 1850, serialized: false, source: 'Purchased', lot: false },
  { name: 'Steering Stabilizer - Heavy Duty', desc: 'Dual steering stabilizer kit for heavy-duty trucks, progressive valving, reduces road wander under load.', price: 320, serialized: false, source: 'Purchased', lot: false },
  { name: 'Shock Absorber Set - Bilstein HD (set of 4)', desc: 'Bilstein heavy-duty monotube shocks, valved for ambulance weight, improved damping, 46mm bore, set of 4.', price: 680, serialized: false, source: 'Purchased', lot: false },
];

const STORAGE_ORG: Tmpl[] = [
  { name: 'Exterior Compartment Tray - Full Depth', desc: 'Full-depth slide-out tray for body compartment, 500 lb capacity, ball-bearing slides, aluminum diamond plate.', price: 450, serialized: false, source: 'Manufactured', lot: false },
  { name: 'Adjustable Shelf Kit - Compartment', desc: 'Adjustable aluminum shelf kit for exterior compartments, tool-free height adjustment, non-slip surface, set of 3.', price: 285, serialized: false, source: 'Manufactured', lot: true },
  { name: 'SCBA Bottle Bracket - Exterior', desc: 'Exterior-mount SCBA cylinder bracket, holds 2 cylinders, quick-release cam lock, powder-coated steel.', price: 195, serialized: false, source: 'Manufactured', lot: false },
  { name: 'Backboard Storage - Exterior (2-board)', desc: 'Exterior vertical storage for 2 spine boards, weather cover, quick-release latch, stainless mounting hardware.', price: 385, serialized: false, source: 'Manufactured', lot: false },
  { name: 'Tool Board Mount Panel - Compartment', desc: 'Pegboard-style tool mounting panel for compartment interior, powder-coated steel, includes assorted hooks/holders.', price: 165, serialized: false, source: 'Manufactured', lot: false },
  { name: 'Drug Box Organizer - Modular', desc: '8-compartment modular drug organizer, clear lids, tamper-evident seals, stackable design, antimicrobial ABS.', price: 245, serialized: false, source: 'Purchased', lot: true },
  { name: 'Portable Equipment Platform - Slide-Out', desc: 'Slide-out equipment platform rated for 300 lbs, locking in/out positions, rubber mat surface, 36" extension.', price: 650, serialized: false, source: 'Manufactured', lot: false },
  { name: 'Helmet Storage Rack - Interior 4-Place', desc: 'Interior-mount 4-place helmet storage rack, padded dividers, quick-access design, fire helmet compatible.', price: 175, serialized: false, source: 'Manufactured', lot: false },
];

const FLOORING_INSULATION: Tmpl[] = [
  { name: 'Ambulance Flooring - Seamless Polymer', desc: 'One-piece seamless polymer floor with integral coving, antimicrobial, chemical resistant, non-slip texture, custom fit.', price: 2800, serialized: false, source: 'Manufactured', lot: false },
  { name: 'Altro Transflor Safety Flooring', desc: 'Commercial-grade safety vinyl flooring, R10 slip resistance, 2mm thickness, welded seams, 15-year warranty.', price: 1650, serialized: false, source: 'Purchased', lot: false },
  { name: 'Subfloor Panel - Marine Grade Plywood', desc: '3/4" marine-grade plywood subfloor, sealed edges, moisture barrier backing, pre-drilled for stretcher rail mount.', price: 450, serialized: false, source: 'Manufactured', lot: false },
  { name: 'Floor Drain Assembly - Stainless', desc: 'Recessed stainless steel floor drain for patient compartment, bio-seal cap, 2" NPT outlet, flush-mount grate.', price: 165, serialized: false, source: 'Manufactured', lot: false },
  { name: 'Sound Deadening Mat Kit - Module', desc: 'Butyl rubber sound deadening mat, 80 mil thickness, peel-and-stick, reduces road noise 50%, covers 40 sq ft.', price: 285, serialized: false, source: 'Purchased', lot: true },
  { name: 'Thermal Barrier Insulation - Module Walls', desc: 'Reflective foil-faced foam insulation, 1" thickness, R-7 value, fire-rated, installed in wall cavities.', price: 520, serialized: false, source: 'Manufactured', lot: true },
  { name: 'Cab Floor Mat Set - Custom Molded', desc: 'Heavy-duty custom-molded floor mats for cab, all-weather rubber, raised edges, driver and passenger, logo optional.', price: 125, serialized: false, source: 'Purchased', lot: true },
];

const POWER_MGMT: Tmpl[] = [
  { name: 'Onan QD 6000 Diesel Generator', desc: '6kW diesel generator, liquid-cooled, 120/240VAC, auto-start, sound-attenuated enclosure, 5,000-hour service interval.', price: 9500, serialized: true, source: 'Purchased', lot: false },
  { name: 'Honda EU3000is Portable Generator', desc: '3000W portable inverter generator, super quiet 49 dB, fuel injected, electric start, companion ready.', price: 2350, serialized: true, source: 'Purchased', lot: false },
  { name: 'Shore Power Transfer Switch - 50A', desc: '50A automatic transfer switch, seamless shore-to-generator changeover, surge protection, NEMA 14-50 inlet.', price: 850, serialized: false, source: 'Purchased', lot: false },
  { name: 'Lithium Battery Bank - 200Ah 12V', desc: '200Ah lithium iron phosphate (LiFePO4) battery bank, built-in BMS, 5000+ cycles, 1/3 the weight of AGM.', price: 2200, serialized: true, source: 'Purchased', lot: false },
  { name: 'Solar Panel Kit - 400W Roof Mount', desc: '4x 100W rigid solar panels with MPPT charge controller, roof mounting brackets, wiring harness, MC4 connectors.', price: 1450, serialized: false, source: 'Purchased', lot: false },
  { name: 'Battery Monitor / State-of-Charge Display', desc: 'Digital battery monitor with 500A shunt, displays voltage, current, Ah consumed, time remaining, Bluetooth app.', price: 185, serialized: false, source: 'Purchased', lot: false },
  { name: 'Idle Mitigation System - ZeroRPM', desc: 'Automatic engine start/stop system, maintains HVAC and electrical loads without idling, configurable thresholds.', price: 3500, serialized: true, source: 'Purchased', lot: false },
  { name: 'Power Distribution Module - 12V/24V', desc: 'Centralized power distribution module, 12V and 24V outputs, fused and relay-controlled, CAN bus integration.', price: 725, serialized: false, source: 'Manufactured', lot: false },
];

const SAFETY_COMPLIANCE: Tmpl[] = [
  { name: 'Fire Extinguisher Bracket & ABC 10lb', desc: '10-lb ABC dry chemical extinguisher with quick-release vehicle bracket, DOT rated, annual inspection tag.', price: 95, serialized: false, source: 'Purchased', lot: true },
  { name: 'DOT Reflective Tape Kit - FMVSS 108', desc: 'Complete DOT-C2 retroreflective conspicuity tape kit, alternating red/white, pre-cut for body type, 3M Diamond Grade.', price: 185, serialized: false, source: 'Purchased', lot: true },
  { name: 'First Aid Kit - OSHA Industrial', desc: '25-person OSHA-compliant first aid kit in metal case, wall-mount bracket, includes CPR mask and eye wash.', price: 65, serialized: false, source: 'Purchased', lot: true },
  { name: 'Emergency Triangle Kit (set of 3)', desc: 'DOT-approved reflective warning triangles, set of 3, weighted base, folding design, carrying case included.', price: 42, serialized: false, source: 'Purchased', lot: true },
  { name: 'Mud Flaps - Heavy Duty (set of 4)', desc: 'Heavy-duty rubber mud flaps with stainless anti-sail brackets, fits dually and single rear wheel, set of 4.', price: 125, serialized: false, source: 'Purchased', lot: true },
  { name: 'Wheel Chocks - Aluminum (pair)', desc: 'Aircraft-grade aluminum wheel chocks with rope handles, non-sparking, OSHA compliant, fits tires up to 42" dia.', price: 85, serialized: false, source: 'Purchased', lot: true },
  { name: 'Infection Control Barrier - Cab/Module', desc: 'Clear polycarbonate barrier between cab and patient compartment, sealed edges, pass-through flap, antimicrobial.', price: 650, serialized: false, source: 'Manufactured', lot: false },
  { name: 'KKK-A-1822F Compliance Certification', desc: 'Federal specification compliance testing and certification for ambulance build per KKK-A-1822F requirements.', price: 2500, serialized: false, source: 'Manufactured', lot: false },
  { name: 'NFPA 1917 Compliance Inspection', desc: 'Third-party NFPA 1917 standard compliance inspection and reporting for completed ambulance, includes documentation.', price: 1800, serialized: false, source: 'Manufactured', lot: false },
];

const TOWING_RECOVERY: Tmpl[] = [
  { name: 'Class V Receiver Hitch (2.5")', desc: '2.5" receiver hitch, 20,000 lb GTW / 2,700 lb tongue weight, bolt-on installation, includes hardware.', price: 450, serialized: false, source: 'Purchased', lot: false },
  { name: 'Warn Zeon 12-S Platinum Winch', desc: '12,000 lb capacity winch, synthetic rope, wireless remote, waterproof IP68, thermal overload protection.', price: 2200, serialized: true, source: 'Purchased', lot: false },
  { name: 'Front Push Bumper - Steel', desc: 'Heavy-duty steel push bumper for SUV/truck, wrap-around design, integrated light mounts, powder-coated black.', price: 1650, serialized: false, source: 'Manufactured', lot: false },
  { name: 'Tow Strap Recovery Kit', desc: 'Recovery kit with 30ft tow strap (20,000 lb), D-ring shackles (2), snatch block, storage bag.', price: 145, serialized: false, source: 'Purchased', lot: true },
  { name: 'Pintle Hitch - Combination (2")', desc: 'Combination pintle/ball hitch, 16,000 lb GTW, 2" ball, forged steel, military-style, replaceable ball.', price: 185, serialized: false, source: 'Purchased', lot: false },
  { name: 'Trailer Brake Controller - Proportional', desc: 'Proportional trailer brake controller, auto-calibrating, plug-and-play for Ford/GM/Ram, LED status display.', price: 165, serialized: false, source: 'Purchased', lot: false },
];

const FLEET_TELEMATICS: Tmpl[] = [
  { name: 'GPS Tracking Unit - CalAmp LMU-5530', desc: 'OBD-II GPS tracking device, cellular LTE, real-time location, geofencing, engine diagnostics, tamper alert.', price: 195, serialized: true, source: 'Purchased', lot: false },
  { name: 'Dual-Lens Dash Camera System', desc: 'Forward + interior dual-lens dash camera, 1080p each, GPS overlay, G-sensor event recording, cloud upload.', price: 425, serialized: true, source: 'Purchased', lot: false },
  { name: 'Backup Camera System - 7" Monitor', desc: '7" color TFT monitor with waterproof IR backup camera, auto-activation in reverse, parking grid overlay.', price: 350, serialized: false, source: 'Purchased', lot: false },
  { name: '360-Degree Bird-Eye Camera System', desc: 'Four-camera surround-view system with top-down 360 display, blind-spot detection, 10" integrated monitor.', price: 1250, serialized: true, source: 'Purchased', lot: false },
  { name: 'RFID Driver Authentication Module', desc: 'RFID key fob driver ID system, prevents unauthorized use, logs driver assignment, integrates with fleet software.', price: 285, serialized: false, source: 'Purchased', lot: false },
  { name: 'Samsara VG54 Vehicle Gateway', desc: 'All-in-one telematics gateway, GPS, OBD-II diagnostics, WiFi hotspot, dash cam integration, AI safety scoring.', price: 450, serialized: true, source: 'Purchased', lot: false },
  { name: 'Tire Pressure Monitoring System (6 wheels)', desc: 'TPMS for 6-wheel vehicles, wireless sensors, cab-mounted display, low-pressure and high-temp alerts, replaceable batteries.', price: 320, serialized: false, source: 'Purchased', lot: false },
  { name: 'Electronic Logging Device (ELD) Compliant', desc: 'FMCSA-certified ELD, hours-of-service tracking, DVIR electronic inspections, Bluetooth printer support, driver app.', price: 275, serialized: true, source: 'Purchased', lot: false },
];

const LABOR_SERVICES: Tmpl[] = [
  { name: 'Type I Ambulance Build Labor', desc: 'Complete labor for Type I ambulance conversion, includes module mounting, all systems integration, 600+ labor hours.', price: 32000, serialized: false, source: 'Manufactured', lot: false },
  { name: 'Type III Ambulance Build Labor', desc: 'Full Type III ambulance build labor on cutaway chassis, cab modification, module integration, 500+ labor hours.', price: 28000, serialized: false, source: 'Manufactured', lot: false },
  { name: 'Police Vehicle Upfit Labor', desc: 'Complete police vehicle upfit labor including console, lighting, radio, cage, push bumper, graphics, 40-60 hours.', price: 4500, serialized: false, source: 'Manufactured', lot: false },
  { name: 'Electrical System Integration', desc: 'Complete electrical integration service: wiring, multiplex programming, load testing, documentation, 80+ hours.', price: 6500, serialized: false, source: 'Manufactured', lot: false },
  { name: 'Paint & Graphics Application Labor', desc: 'Body prep, prime, paint, and graphics installation labor for complete vehicle, includes booth time and materials prep.', price: 5200, serialized: false, source: 'Manufactured', lot: false },
  { name: 'Final QC Inspection & Road Test', desc: 'Comprehensive quality control inspection: 200+ checkpoint list, road test, weight certification, fluid levels, documentation.', price: 1200, serialized: false, source: 'Manufactured', lot: false },
  { name: 'PDI - Pre-Delivery Inspection', desc: 'Pre-delivery inspection and customer walk-through, operational demo of all systems, documentation handoff.', price: 500, serialized: false, source: 'Manufactured', lot: false },
  { name: 'Extended Warranty - Module (5 year)', desc: 'Five-year comprehensive warranty covering ambulance module structure, paint, and installed systems beyond OEM.', price: 8500, serialized: false, source: 'Manufactured', lot: false },
  { name: 'Operator Training Program (8 hours)', desc: '8-hour on-site operator training covering vehicle systems, patient compartment equipment, maintenance procedures.', price: 1500, serialized: false, source: 'Manufactured', lot: false },
  { name: 'Annual Preventive Maintenance Contract', desc: '12-month PM contract: 2 scheduled services, multi-point inspection, fluid top-off, filter replacement, report.', price: 2200, serialized: false, source: 'Manufactured', lot: false },
];

const CONSUMABLES: Tmpl[] = [
  /* Genuine liquid-set products — names spell out the container
     size (Gallon / Drum) so the UoM data layer routes them to the
     liquid set (Liter / Gallon / Drum). The capsule dropdown
     surfaces those units with a "Primary" pill on Liter. */
  { name: 'DEF Fluid - 2.5 Gallon', desc: 'Diesel exhaust fluid (DEF), API certified, 32.5% urea solution, meets ISO 22241, for SCR-equipped vehicles. Sold per liter.', price: 18, serialized: false, source: 'Purchased', lot: true },
  { name: 'Hydraulic Fluid AW-46 - 5 Gallon', desc: 'Premium anti-wear hydraulic fluid, AW-46 viscosity, zinc-based additive package, suitable for stretcher systems. Sold per liter.', price: 45, serialized: false, source: 'Purchased', lot: true },
  { name: 'Long-Life Coolant 50/50 - 1 Gallon', desc: 'OAT extended-life engine coolant pre-mixed 50/50 with deionised water, meets ASTM D3306, low-silicate formula. Sold per liter.', price: 22, serialized: false, source: 'Purchased', lot: true },
  { name: 'Synthetic Motor Oil 15W-40 - 55 Gallon Drum', desc: 'CK-4 synthetic blend diesel engine oil 15W-40 in a 55-gallon drum, API CK-4 / SN, meets Cummins CES 20086. Sold per liter.', price: 1450, serialized: false, source: 'Purchased', lot: true },
  { name: 'Dielectric Grease - 3oz Tube', desc: 'Silicone dielectric grease for electrical connections, prevents corrosion, waterproof, -60F to 400F range.', price: 8, serialized: false, source: 'Purchased', lot: true },
  { name: 'Wire Loom & Harness Tape Assortment', desc: 'Assortment of split wire loom (1/4" to 1"), harness tape, and cable ties for wiring installations.', price: 35, serialized: false, source: 'Purchased', lot: true },
  { name: 'Structural Adhesive - 3M 8115 (10oz)', desc: 'Two-part urethane structural adhesive for bonding body panels, 15-minute working time, 5,000 PSI shear strength.', price: 42, serialized: false, source: 'Purchased', lot: true },
  { name: 'Rivet Assortment - Stainless (500pc)', desc: '500-piece stainless steel blind rivet assortment, 3/16" and 1/4" diameter, various grip lengths, dome head.', price: 28, serialized: false, source: 'Purchased', lot: true },
  { name: 'Sealant - Sikaflex 221 Polyurethane (10oz)', desc: 'One-component polyurethane sealant/adhesive, paintable, UV resistant, for body seams and penetrations.', price: 15, serialized: false, source: 'Purchased', lot: true },
  { name: 'Touch-Up Paint Kit - OEM Match', desc: 'OEM color-matched touch-up paint kit, includes primer, basecoat, clearcoat, and applicator brushes.', price: 65, serialized: false, source: 'Purchased', lot: true },
  { name: 'Fuse & Relay Assortment Kit', desc: '200-piece fuse and relay assortment: ATO/ATC fuses 5A-30A, mini fuses, 30/40A relays, fuse pullers.', price: 48, serialized: false, source: 'Purchased', lot: true },
  { name: 'Oxygen Regulator Gasket Set (10 pack)', desc: 'CGA-870 yoke regulator gasket seals, PTFE, pack of 10, for cylinder-to-regulator connections.', price: 12, serialized: false, source: 'Purchased', lot: true },
];

const EXTERIOR_ACCESSORIES: Tmpl[] = [
  { name: 'Running Boards - Lighted Aluminum', desc: 'Full-length aluminum running boards with integrated LED courtesy lights, anti-slip tread, powder-coated black.', price: 850, serialized: false, source: 'Manufactured', lot: false },
  { name: 'Roof Rack - Low Profile Utility', desc: 'Low-profile aluminum roof rack, 500 lb static capacity, crossbar kit, fairing for aerodynamics, black anodized.', price: 1250, serialized: false, source: 'Purchased', lot: false },
  { name: 'Rear Step Bumper - Chrome', desc: 'Chrome steel rear step bumper with integrated corner steps, D-ring tie-downs, and license plate bracket.', price: 650, serialized: false, source: 'Manufactured', lot: false },
  { name: 'Fender Flares - OE Style (set of 4)', desc: 'OE-style bolt-on fender flares, matte black textured finish, covers wider tires/wheels, set of 4.', price: 385, serialized: false, source: 'Purchased', lot: false },
  { name: 'Rain Guards - Side Window (4-piece)', desc: 'In-channel rain guards for front and rear side windows, dark smoke, reduces wind noise, set of 4 pieces.', price: 65, serialized: false, source: 'Purchased', lot: true },
  { name: 'Brush Guard - Stainless Steel', desc: 'Stainless steel brush guard / grille protector, push bar compatible, integrated auxiliary light mounts.', price: 1100, serialized: false, source: 'Manufactured', lot: false },
  { name: 'Spray-In Bedliner - Full Truck Bed', desc: 'Professional spray-in polyurea bedliner, UV stable, impact resistant, custom color available, lifetime warranty.', price: 550, serialized: false, source: 'Manufactured', lot: false },
  { name: 'Mud Flap Extension - Ambulance Module', desc: 'Extended rubber mud flaps for ambulance module rear, stainless anti-sail brackets, wide-body compatible.', price: 145, serialized: false, source: 'Manufactured', lot: false },
  // Lot-serialized sample — both per-unit serial numbers AND batch/lot
  // tracking. Used to exercise the lot+serial allocation flow in line
  // items. Appended at the end of the last hand-crafted category so the
  // template gets a deterministic ID (000-100-195) without shifting any
  // existing product IDs.
  { name: 'AED Defibrillator with Smart Battery Pack', desc: 'Field-ready AED with traceable battery. Unique serial per unit and lot-numbered battery cells for recall + expiration management. FDA Class III, CE marked, 8-year shelf life.', price: 2150, serialized: true, source: 'Purchased', lot: true },
];

/* ─── Assemble all templates ─── */
const ALL_TEMPLATES: [string, Tmpl[]][] = [
  ['Base Vehicles', BASE_VEHICLES],
  ['Ambulance Modules', AMBULANCE_MODULES],
  ['Emergency Lighting', EMERGENCY_LIGHTING],
  ['Sirens & Warning', SIRENS_WARNING],
  ['Communication', COMMUNICATION],
  ['Interior Upfitting', INTERIOR_UPFITTING],
  ['Electrical Systems', ELECTRICAL_SYSTEMS],
  ['HVAC & Climate', HVAC_CLIMATE],
  ['Medical Equipment', MEDICAL_EQUIPMENT],
  ['Paint & Graphics', PAINT_GRAPHICS],
  ['Suspension & Brakes', SUSPENSION_BRAKES],
  ['Storage & Organization', STORAGE_ORG],
  ['Flooring & Insulation', FLOORING_INSULATION],
  ['Power Management', POWER_MGMT],
  ['Safety & Compliance', SAFETY_COMPLIANCE],
  ['Towing & Recovery', TOWING_RECOVERY],
  ['Fleet Telematics', FLEET_TELEMATICS],
  ['Labor & Services', LABOR_SERVICES],
  ['Consumables', CONSUMABLES],
  ['Exterior Accessories', EXTERIOR_ACCESSORIES],
];

/* ─── Build the 511-item catalog ─── */
const rng = seededRng(7);

function fmtId(n: number): string {
  const s = String(n).padStart(9, '0');
  return `${s.slice(0, 3)}-${s.slice(3, 6)}-${s.slice(6)}`;
}

const built: Product[] = [];
let seq = 100001;

// First pass: add all hand-crafted templates (~200 items)
for (const [cat, templates] of ALL_TEMPLATES) {
  for (const t of templates) {
    const abbr = t.name.split(/[\s-]+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
    built.push({
      id: fmtId(seq),
      name: t.name,
      description: t.desc,
      category: cat,
      unitPrice: Math.min(t.price, 1500),
      images: imgFor(cat, abbr),
      stockQuantity: Math.floor(rng() * 120) + 2,
      badges: [],
      isSerialized: t.serialized,
      sourceType: t.source,
      isLotControlled: t.lot,
      isRecentlyOrdered: rng() < 0.3,
      sku: `SKU-${cat.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase()}-${String(seq).slice(-4)}`,
    });
    seq++;
  }
}

// Second pass: generate variants/extras to reach 511.
//
// Variants jump to a different ID range ("001-100-…" onwards) so the
// catalogue isn't a wall of "000-100-XXX" — searches for "001-100",
// "002-100", etc. now return real hits. The first 200 IDs stay on the
// "000-100-…" range because pricing-rules data, linked transactions,
// and ConvertToSOModal hardcode references in that range (max id
// touched today is "000-100-195"). Variant ids spread across blocks
// of 100 so each block produces a distinct prefix:
//
//   built[200…299]  → seq 1100001…1100100 → "001-100-001…001-100-100"
//   built[300…399]  → seq 2100001…2100100 → "002-100-001…002-100-100"
//   built[400…499]  → seq 3100001…3100100 → "003-100-001…003-100-100"
//   built[500…510]  → seq 4100001…4100011 → "004-100-001…004-100-011"
const VARIANT_PREFIXES = ['Standard', 'Heavy-Duty', 'Compact', 'Economy', 'Premium', 'Wide-Body', 'Narrow', 'Extended', 'Short', 'Deluxe'];
const VARIANT_SUFFIXES = ['Series II', 'Gen 3', 'v2', 'Mk II', 'Pro', 'Ultra', 'Lite', 'XL', 'HD', 'EMS-Grade'];

const TARGET_TOTAL = 511;
const VARIANT_BLOCKS = [1100001, 2100001, 3100001, 4100001];
let blockIdx = 0;
let variantSeq = VARIANT_BLOCKS[0];

while (built.length < TARGET_TOTAL) {
  /* Rotate to the next "0XX-100-…" prefix every 100 items so the
     catalogue spans 001-, 002-, 003-, 004- ranges. */
  const positionInBlock = (variantSeq - VARIANT_BLOCKS[blockIdx]);
  if (positionInBlock >= 100 && blockIdx < VARIANT_BLOCKS.length - 1) {
    blockIdx += 1;
    variantSeq = VARIANT_BLOCKS[blockIdx];
  }
  const catIdx = Math.floor(rng() * ALL_TEMPLATES.length);
  const [cat, templates] = ALL_TEMPLATES[catIdx];
  const tmpl = templates[Math.floor(rng() * templates.length)];
  const prefix = VARIANT_PREFIXES[Math.floor(rng() * VARIANT_PREFIXES.length)];
  const suffix = VARIANT_SUFFIXES[Math.floor(rng() * VARIANT_SUFFIXES.length)];
  const priceMult = 0.7 + rng() * 0.6; // 70%-130% of base price
  const variantName = `${prefix} ${tmpl.name.split(' ').slice(0, 4).join(' ')} ${suffix}`;
  const abbr = variantName.split(/[\s-]+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  built.push({
    id: fmtId(variantSeq),
    name: variantName,
    description: `Variant of ${tmpl.name}. ${tmpl.desc}`,
    category: cat,
    unitPrice: Math.min(Math.round(tmpl.price * priceMult), 1500),
    images: imgFor(cat, abbr),
    stockQuantity: Math.floor(rng() * 80) + 1,
    badges: [],
    isSerialized: tmpl.serialized,
    sourceType: tmpl.source,
    isLotControlled: tmpl.lot,
    isRecentlyOrdered: rng() < 0.2,
    sku: `SKU-${cat.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase()}-${String(variantSeq).slice(-4)}`,
  });
  variantSeq++;
}

// Mark the first ~30 items as recently ordered so the default catalog view isn't empty
for (let i = 0; i < 30; i++) built[i].isRecentlyOrdered = true;

/* Always surface the genuine liquid + length containers/spools in the
   no-search Recently Ordered panel so the UoM set variety (Liter /
   Gallon / Drum, Foot / Yard / Roll) is visible without the user
   having to type a search. Without this the items sit deep in the
   catalogue where the default `slice(0, 12)` never reaches them. */
const LIQUID_LENGTH_NAME_PATTERNS = [
  /\b\d+(?:\.\d+)?\s*-?\s*gallon\b/i,
  /\b\d+\s*ft\b\s*spool\b/i,
];
for (const p of built) {
  if (LIQUID_LENGTH_NAME_PATTERNS.some((pat) => pat.test(p.name))) {
    p.isRecentlyOrdered = true;
  }
}

export const PRODUCTS: Product[] = built;
