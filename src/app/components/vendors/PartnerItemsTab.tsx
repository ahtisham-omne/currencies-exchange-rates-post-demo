import React, { useState, useMemo, useCallback, useEffect, cloneElement, useRef } from "react";
import { createPortal } from "react-dom";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import {
  Search,
  X,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Plus,
  SlidersHorizontal,
  AlignJustify,
  List as ListIcon,
  LayoutGrid,
  Package,
  Maximize2,
  Minimize2,
  Sparkles,
  Tag,
  ShoppingCart,
  MoreHorizontal,
  Eye,
  Pencil,
  Archive,
  Trash2,
  AlertTriangle,
  GripVertical,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react";
import { toast } from "sonner";
import type { Vendor } from "../../data/vendors";
import { ColumnSelector, ColumnSelectorTrigger, type ColumnConfig } from "./ColumnSelector";
import {
  ColumnHeaderMenu,
  type SortConfig,
} from "./ColumnHeaderMenu";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface PartnerItemData {
  id: string;
  partNo: string;
  description: string;
  manufacturer: string;
  sku: string;
  category: string;
  additionalCategory: string;
  itemType: "Parts" | "Equipment - Capital" | "Equipment - Non-Capital" | "Miscellaneous";
  itemControlType: "Serialized" | "Non-Serialized";
  stockStatus: "In Stock" | "Low Stock" | "Out of Stock";
  onHand: number;
  onHandUnit: string;
  altUnits: string;
  inboundLocation: string;
  outboundLocation: string;
  acquisitionMethods: ("Purchased" | "Manufactured" | "Purchase")[];
  status: "Active" | "Inactive";
  tradeDirection: "sell" | "purchase" | "both";
  image: string;
  hasBlueDot: boolean;
}

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

const ITEM_TYPES = ["Parts", "Equipment - Capital", "Equipment - Non-Capital", "Miscellaneous"] as const;

const STOCK_STATUS_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  "In Stock": { color: "#065F46", bg: "#ECFDF5", border: "#A7F3D0" },
  "Low Stock": { color: "#92400E", bg: "#FFFBEB", border: "#FDE68A" },
  "Out of Stock": { color: "#991B1B", bg: "#FEF2F2", border: "#FECACA" },
};

const ACQ_BADGE_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  "Purchased": { color: "#1E40AF", bg: "#EFF6FF", border: "#BFDBFE" },
  "Manufactured": { color: "#5B21B6", bg: "#F5F3FF", border: "#DDD6FE" },
  "Purchase": { color: "#1E40AF", bg: "#EFF6FF", border: "#BFDBFE" },
};

const STATUS_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  "Active": { color: "#065F46", bg: "#ECFDF5", border: "#A7F3D0" },
  "Inactive": { color: "#92400E", bg: "#FFFBEB", border: "#FDE68A" },
};

const ITEM_IMAGES = [
  "https://images.unsplash.com/photo-1772209049802-cd0e0ff1a5d3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoZXglMjBib2x0JTIwc2NyZXclMjBoYXJkd2FyZXxlbnwxfHx8fDE3NzMyNDY5OTd8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  "https://images.unsplash.com/photo-1713575882582-8938739db351?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdGFpbmxlc3MlMjBzdGVlbCUyMGJhbGwlMjB2YWx2ZSUyMHBsdW1iaW5nfGVufDF8fHx8MTc3MzI0Njk5OHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  "https://images.unsplash.com/photo-1737223450913-2af6885945e1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxydWJiZXIlMjBvLXJpbmclMjBzZWFsJTIwZ2Fza2V0fGVufDF8fHx8MTc3MzI0Njk5OXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  "https://images.unsplash.com/photo-1759159091728-e2c87b9d9315?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbmQlMjBtaWxsJTIwY3V0dGluZyUyMHRvb2wlMjBjYXJiaWRlfGVufDF8fHx8MTc3MzI0Njk5OXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  "https://images.unsplash.com/photo-1661069387900-54d5843b704d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhbHVtaW51bSUyMHNoZWV0JTIwbWV0YWwlMjBpbmR1c3RyaWFsfGVufDF8fHx8MTc3MzI0Njk5OXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  "https://images.unsplash.com/photo-1758873263527-ca53b938fbd4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiYWxsJTIwYmVhcmluZyUyMG1lY2hhbmljYWwlMjBjb21wb25lbnR8ZW58MXx8fHwxNzczMjQ2OTk5fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
];

const ITEM_DEFS = [
  { partNo: "FAST-HEX-001", desc: "Zinc-Plated Hex Head Screw, 1/4\"-20 x 1\"", mfr: "BoltMaster Inc.", sku: "BM-2520-100", cat: "Fasteners", addCat: "Hardware", ctrl: "Non-Serialized" as const, stock: "In Stock" as const, onHand: 15400, unit: "ea", alt: "Box (100)", inLoc: "Warehouse A, Row 01, Sh...", outLoc: "Warehouse A, Row 01, Sh...", acq: ["Purchased"] as ("Purchased" | "Manufactured" | "Purchase")[] },
  { partNo: "VALV-BAL-316", desc: "316 Stainless Steel Ball Valve, 2-Piece, 1\"", mfr: "FlowControl", sku: "SS-BV-100", cat: "Plumbing", addCat: "Industrial", ctrl: "Serialized" as const, stock: "Low Stock" as const, onHand: 12, unit: "ea", alt: "Carton (10)", inLoc: "Warehouse B, Row 04, Sh...", outLoc: "Warehouse B, Row 04, Sh...", acq: ["Purchased", "Manufactured"] as ("Purchased" | "Manufactured" | "Purchase")[] },
  { partNo: "SEAL-OR-012", desc: "Buna-N O-Ring, Dash Number 012, Hard", mfr: "SealTech", sku: "BN-70-012", cat: "Seals", addCat: "Rubber Goods", ctrl: "Non-Serialized" as const, stock: "In Stock" as const, onHand: 5000, unit: "pk", alt: "Bag (100)", inLoc: "Warehouse C, Bin 12", outLoc: "Warehouse C, Bin 12", acq: ["Purchased"] as ("Purchased" | "Manufactured" | "Purchase")[] },
  { partNo: "TOOL-EM-050", desc: "Solid Carbide Square End Mill, 1/2\" Cutti", mfr: "PrecisionTools", sku: "SC-EM-4F-500", cat: "Tools", addCat: "Carbide", ctrl: "Non-Serialized" as const, stock: "In Stock" as const, onHand: 45, unit: "ea", alt: "Tube (1)", inLoc: "Tool Room, Cabinet 5, Dra...", outLoc: "Tool Room, Cabinet 5, Dra...", acq: ["Purchase"] as ("Purchased" | "Manufactured" | "Purchase")[] },
  { partNo: "MAT-AL-6061", desc: "6061-T6 Aluminum Sheet, 12\" x 24\" x 0.", mfr: "AluSupply", sku: "AL-6061-125", cat: "Raw Materials", addCat: "Sheet Stock", ctrl: "Non-Serialized" as const, stock: "Out of Stock" as const, onHand: 0, unit: "sh", alt: "Pallet (50)", inLoc: "Yard, Rack 01", outLoc: "Yard, Rack 01", acq: ["Purchased", "Manufactured"] as ("Purchased" | "Manufactured" | "Purchase")[] },
  { partNo: "MECH-BRG-6204", desc: "Deep Groove Ball Bearing, 6204-2RS, St", mfr: "MotionPro", sku: "6204-2RS", cat: "Power Trans", addCat: "Mechanical", ctrl: "Serialized" as const, stock: "In Stock" as const, onHand: 240, unit: "ea", alt: "Box (10)", inLoc: "Parts Room, Row 02, Bin 12", outLoc: "Parts Room, Row 02, Bin 12", acq: ["Purchased"] as ("Purchased" | "Manufactured" | "Purchase")[] },
];

const EXTRA_DEFS = [
  { partNo: "ELEC-RLY-024", desc: "24V DC Relay, SPDT, 10A Contact Rating", mfr: "CircuitPro", sku: "RL-24-SPDT", cat: "Electrical", addCat: "Controls", ctrl: "Non-Serialized" as const },
  { partNo: "HYDR-CYL-350", desc: "Hydraulic Cylinder, 3.5\" Bore x 24\" Stroke", mfr: "HydraForce", sku: "HC-3524-D", cat: "Hydraulics", addCat: "Actuators", ctrl: "Serialized" as const },
  { partNo: "PNEU-FTG-038", desc: "Push-to-Connect Fitting, 3/8\" Tube OD", mfr: "AirLine", sku: "PTC-038-NPT", cat: "Pneumatics", addCat: "Fittings", ctrl: "Non-Serialized" as const },
  { partNo: "WELD-ROD-309", desc: "309L Stainless Welding Rod, 3/32\" x 36\"", mfr: "WeldPro", sku: "WR-309L-332", cat: "Welding", addCat: "Consumables", ctrl: "Non-Serialized" as const },
  { partNo: "ABRS-DSC-045", desc: "Flap Disc 4.5\" x 7/8\" Zirconia, 60 Grit", mfr: "GrindMaster", sku: "FD-45-Z60", cat: "Abrasives", addCat: "Discs", ctrl: "Non-Serialized" as const },
  { partNo: "SFTY-GLV-XL", desc: "Cut-Resistant Gloves, ANSI A4, XL, 12pk", mfr: "SafeHand", sku: "CR-A4-XL-12", cat: "Safety", addCat: "PPE", ctrl: "Non-Serialized" as const },
  { partNo: "LUBR-GRS-EP2", desc: "EP2 Lithium Complex Grease, 14oz Cart", mfr: "LubeTech", sku: "LC-EP2-14", cat: "Lubricants", addCat: "Grease", ctrl: "Non-Serialized" as const },
  { partNo: "FILT-HYD-010", desc: "Hydraulic Return Filter Element, 10 Micron", mfr: "FilterMax", sku: "HF-RET-10M", cat: "Filters", addCat: "Hydraulic", ctrl: "Non-Serialized" as const },
  { partNo: "BELT-VEE-B68", desc: "Classical V-Belt, B68, 71\" Outside Length", mfr: "DrivePro", sku: "VB-B68-71", cat: "Power Trans", addCat: "Belts", ctrl: "Non-Serialized" as const },
  { partNo: "SENS-PROX-M12", desc: "Inductive Proximity Sensor, M12, NPN, 4mm", mfr: "SenseLogic", sku: "IPS-M12-4N", cat: "Electrical", addCat: "Sensors", ctrl: "Serialized" as const },
  { partNo: "SPRI-COMP-25", desc: "Compression Spring, .750 OD x 2.5\" FL", mfr: "SpringWorks", sku: "CS-750-25", cat: "Hardware", addCat: "Springs", ctrl: "Non-Serialized" as const },
  { partNo: "SEAL-LIP-030", desc: "Double Lip Oil Seal, 30mm ID x 47mm OD", mfr: "SealTech", sku: "DL-3047-7", cat: "Seals", addCat: "Oil Seals", ctrl: "Non-Serialized" as const },
  { partNo: "CPLG-JAW-L99", desc: "Jaw Coupling Hub, L099, 3/4\" Bore, Keyway", mfr: "CouplingPro", sku: "JC-L99-075K", cat: "Power Trans", addCat: "Couplings", ctrl: "Non-Serialized" as const },
  { partNo: "CSTR-SWV-475", desc: "Heavy Duty Swivel Caster, 4\" x 2\", 750lb", mfr: "RollRight", sku: "HD-SWV-42", cat: "Material Handling", addCat: "Casters", ctrl: "Non-Serialized" as const },
  { partNo: "INSUL-FBR-R19", desc: "Fiberglass Insulation Batt, R-19, 6.25\"", mfr: "ThermoShield", sku: "FB-R19-23", cat: "Insulation", addCat: "Thermal", ctrl: "Non-Serialized" as const },
  { partNo: "PIPE-SS-150", desc: "304 Stainless Pipe, 1.5\" Sch 40, 20ft", mfr: "PipePro", sku: "SS304-150-40", cat: "Plumbing", addCat: "Pipe", ctrl: "Non-Serialized" as const },
  { partNo: "WIRE-THHN-12", desc: "THHN Wire, 12 AWG, Stranded, Black, 500ft", mfr: "WireTech", sku: "THHN-12-BK", cat: "Electrical", addCat: "Wire", ctrl: "Non-Serialized" as const },
  { partNo: "ADHV-EPXY-ST", desc: "Structural Epoxy Adhesive, 50ml Dual Cart", mfr: "BondMax", sku: "SE-50-DC", cat: "Adhesives", addCat: "Structural", ctrl: "Non-Serialized" as const },
  // Extended realistic items for 500+ total
  { partNo: "MOTR-AC-075", desc: "AC Induction Motor, 3/4 HP, 1725 RPM, TEFC", mfr: "MotorDrive", sku: "AC-075-TEFC", cat: "Motors", addCat: "AC Motors", ctrl: "Serialized" as const },
  { partNo: "PUMP-CENT-200", desc: "Centrifugal Pump, 2\" NPT, Cast Iron, 5HP", mfr: "FlowMaster", sku: "CP-200-CI5", cat: "Pumps", addCat: "Centrifugal", ctrl: "Serialized" as const },
  { partNo: "VALV-SOL-12V", desc: "12V DC Solenoid Valve, 2-Way, 1/4\" NPT", mfr: "FlowControl", sku: "SV-12V-025", cat: "Valves", addCat: "Solenoid", ctrl: "Non-Serialized" as const },
  { partNo: "BEAR-PILL-204", desc: "Pillow Block Bearing, UCP204, 20mm Bore", mfr: "MotionPro", sku: "UCP204-20", cat: "Bearings", addCat: "Mounted", ctrl: "Serialized" as const },
  { partNo: "GEAR-SPUR-48P", desc: "Steel Spur Gear, 48 Pitch, 24 Teeth, 1/4\" Bore", mfr: "GearWorks", sku: "SG-48P-24T", cat: "Power Trans", addCat: "Gears", ctrl: "Non-Serialized" as const },
  { partNo: "CHAIN-RLR-40", desc: "Roller Chain, #40, Single Strand, 10ft", mfr: "ChainPro", sku: "RC-40-10FT", cat: "Power Trans", addCat: "Chains", ctrl: "Non-Serialized" as const },
  { partNo: "SPKT-40B-15", desc: "Sprocket, #40 Chain, 15 Teeth, 5/8\" Bore", mfr: "ChainPro", sku: "SP-40B-15T", cat: "Power Trans", addCat: "Sprockets", ctrl: "Non-Serialized" as const },
  { partNo: "CYLD-PNEU-32", desc: "Pneumatic Cylinder, 32mm Bore, 100mm Stroke", mfr: "AirLine", sku: "PC-32-100", cat: "Pneumatics", addCat: "Cylinders", ctrl: "Serialized" as const },
  { partNo: "GASK-SPIR-4IN", desc: "Spiral Wound Gasket, 4\" 150#, 304/Graphite", mfr: "SealTech", sku: "SWG-4-150", cat: "Seals", addCat: "Gaskets", ctrl: "Non-Serialized" as const },
  { partNo: "FLNG-WN-4IN", desc: "Weld Neck Flange, 4\" 150#, A105 Carbon Steel", mfr: "PipePro", sku: "WNF-4-150", cat: "Plumbing", addCat: "Flanges", ctrl: "Non-Serialized" as const },
  { partNo: "ELEC-CB-30A", desc: "Miniature Circuit Breaker, 30A, 2-Pole, C-Curve", mfr: "CircuitPro", sku: "MCB-30A-2P", cat: "Electrical", addCat: "Breakers", ctrl: "Non-Serialized" as const },
  { partNo: "ELEC-VFD-5HP", desc: "Variable Frequency Drive, 5HP, 480V, 3-Phase", mfr: "MotorDrive", sku: "VFD-5HP-480", cat: "Electrical", addCat: "Drives", ctrl: "Serialized" as const },
  { partNo: "TOOL-TAP-M10", desc: "Spiral Point Tap, M10 x 1.5, HSS-E TiN Coated", mfr: "PrecisionTools", sku: "SPT-M10-15", cat: "Tools", addCat: "Threading", ctrl: "Non-Serialized" as const },
  { partNo: "TOOL-DRL-8MM", desc: "Cobalt Jobber Drill Bit, 8mm, 135-Degree Split Pt", mfr: "PrecisionTools", sku: "CDB-8MM-135", cat: "Tools", addCat: "Drill Bits", ctrl: "Non-Serialized" as const },
  { partNo: "ABRS-BELT-36", desc: "Sanding Belt, 4\" x 36\", Aluminum Oxide, 80 Grit", mfr: "GrindMaster", sku: "SB-436-80", cat: "Abrasives", addCat: "Belts", ctrl: "Non-Serialized" as const },
  { partNo: "SFTY-HELM-WHT", desc: "Hard Hat, Type I Class E, Ratchet Adjust, White", mfr: "SafeHand", sku: "HH-TI-CE-W", cat: "Safety", addCat: "Head Protection", ctrl: "Non-Serialized" as const },
  { partNo: "SFTY-GOGL-AF", desc: "Safety Goggles, Anti-Fog, Indirect Vent, Clear", mfr: "SafeHand", sku: "SG-AF-CLR", cat: "Safety", addCat: "Eye Protection", ctrl: "Non-Serialized" as const },
  { partNo: "LUBR-OIL-HYD", desc: "Hydraulic Oil AW-46, 5 Gallon Pail", mfr: "LubeTech", sku: "HO-AW46-5G", cat: "Lubricants", addCat: "Oils", ctrl: "Non-Serialized" as const },
  { partNo: "FILT-AIR-HEPA", desc: "HEPA Air Filter, 24\" x 24\" x 12\", 99.97%", mfr: "FilterMax", sku: "HEPA-2424-12", cat: "Filters", addCat: "Air Filters", ctrl: "Non-Serialized" as const },
  { partNo: "MATL-SS-316L", desc: "316L Stainless Round Bar, 1\" Dia x 6ft", mfr: "AluSupply", sku: "SS316L-1R-6", cat: "Raw Materials", addCat: "Round Bar", ctrl: "Non-Serialized" as const },
  { partNo: "MATL-CU-110", desc: "C110 Copper Sheet, 12\" x 12\" x 0.032\"", mfr: "AluSupply", sku: "CU110-12-032", cat: "Raw Materials", addCat: "Sheet Stock", ctrl: "Non-Serialized" as const },
  { partNo: "FAST-SOC-M8", desc: "Socket Head Cap Screw, M8 x 1.25 x 30mm, A2", mfr: "BoltMaster Inc.", sku: "SHCS-M8-30", cat: "Fasteners", addCat: "Socket Head", ctrl: "Non-Serialized" as const },
  { partNo: "FAST-NUT-M12", desc: "Hex Nut, M12 x 1.75, Grade 8, Zinc Plated", mfr: "BoltMaster Inc.", sku: "HN-M12-G8", cat: "Fasteners", addCat: "Nuts", ctrl: "Non-Serialized" as const },
  { partNo: "FAST-WSHR-516", desc: "Flat Washer, 5/16\", SAE, Zinc Plated, 100pk", mfr: "BoltMaster Inc.", sku: "FW-516-100", cat: "Fasteners", addCat: "Washers", ctrl: "Non-Serialized" as const },
  { partNo: "HOSE-HYD-38", desc: "Hydraulic Hose, 3/8\" ID, 4000 PSI, 10ft", mfr: "HydraForce", sku: "HH-38-4K-10", cat: "Hydraulics", addCat: "Hoses", ctrl: "Non-Serialized" as const },
  { partNo: "CONTR-PLC-16", desc: "Micro PLC, 16 I/O, Ethernet, 24V DC", mfr: "SenseLogic", sku: "MPLC-16IO-E", cat: "Electrical", addCat: "PLCs", ctrl: "Serialized" as const },
  { partNo: "CONTR-HMI-7IN", desc: "HMI Touch Panel, 7\" Color TFT, Ethernet", mfr: "SenseLogic", sku: "HMI-7C-ETH", cat: "Electrical", addCat: "HMIs", ctrl: "Serialized" as const },
  { partNo: "WELD-WIRE-ER70", desc: "MIG Wire ER70S-6, .035\", 33lb Spool", mfr: "WeldPro", sku: "MW-ER70-035", cat: "Welding", addCat: "MIG Wire", ctrl: "Non-Serialized" as const },
  { partNo: "WELD-GAS-C25", desc: "Shielding Gas C25, 75% Ar / 25% CO2, 80cf", mfr: "WeldPro", sku: "SG-C25-80CF", cat: "Welding", addCat: "Gas", ctrl: "Non-Serialized" as const },
  { partNo: "MATL-HDPE-SHT", desc: "HDPE Sheet, Natural, 1/2\" x 24\" x 48\"", mfr: "ThermoShield", sku: "HDPE-12-2448", cat: "Raw Materials", addCat: "Plastics", ctrl: "Non-Serialized" as const },
  { partNo: "ELEC-XFMR-1KV", desc: "Control Transformer, 1KVA, 480V to 120V", mfr: "CircuitPro", sku: "CT-1KVA-480", cat: "Electrical", addCat: "Transformers", ctrl: "Serialized" as const },
  { partNo: "TOOL-REAM-10", desc: "Chucking Reamer, 10mm, HSS, Straight Flute", mfr: "PrecisionTools", sku: "CR-10MM-HSS", cat: "Tools", addCat: "Reamers", ctrl: "Non-Serialized" as const },
  { partNo: "PNEU-REG-14", desc: "Air Pressure Regulator, 1/4\" NPT, 0-150 PSI", mfr: "AirLine", sku: "APR-14-150", cat: "Pneumatics", addCat: "Regulators", ctrl: "Non-Serialized" as const },
  { partNo: "PNEU-TUBE-8", desc: "Polyurethane Tubing, 8mm OD, Blue, 100m", mfr: "AirLine", sku: "PU-8MM-BL", cat: "Pneumatics", addCat: "Tubing", ctrl: "Non-Serialized" as const },
  { partNo: "MATL-NYLON-ROD", desc: "Nylon 6/6 Rod, 2\" Dia x 4ft, Natural", mfr: "ThermoShield", sku: "NY66-2R-4FT", cat: "Raw Materials", addCat: "Plastics", ctrl: "Non-Serialized" as const },
  { partNo: "BEAR-THRST-512", desc: "Thrust Ball Bearing, 51200 Series, 10mm ID", mfr: "MotionPro", sku: "TB-51200-10", cat: "Bearings", addCat: "Thrust", ctrl: "Non-Serialized" as const },
  { partNo: "FAST-RVET-316", desc: "Pop Rivet, 3/16\" x 1/4\", Aluminum, 500pk", mfr: "BoltMaster Inc.", sku: "PR-316-500", cat: "Fasteners", addCat: "Rivets", ctrl: "Non-Serialized" as const },
  { partNo: "ELEC-CNDL-34", desc: "Rigid Conduit, 3/4\", Galvanized Steel, 10ft", mfr: "WireTech", sku: "RC-34-GS-10", cat: "Electrical", addCat: "Conduit", ctrl: "Non-Serialized" as const },
  { partNo: "TOOL-CLMP-6IN", desc: "Bar Clamp, 6\" Capacity, Quick-Release", mfr: "PrecisionTools", sku: "BC-6QR", cat: "Tools", addCat: "Clamps", ctrl: "Non-Serialized" as const },
  { partNo: "SFTY-RESP-P100", desc: "Half Facepiece Respirator, P100 Filters, Med", mfr: "SafeHand", sku: "HFR-P100-M", cat: "Safety", addCat: "Respiratory", ctrl: "Non-Serialized" as const },
  { partNo: "HYDR-FILT-RET", desc: "Hydraulic Return Line Filter, 25 Micron, 3/4\"", mfr: "FilterMax", sku: "HRL-25M-075", cat: "Filters", addCat: "Hydraulic", ctrl: "Non-Serialized" as const },
  { partNo: "MATL-BRASS-360", desc: "360 Brass Hex Bar, 3/4\" AF x 3ft", mfr: "AluSupply", sku: "BR360-075H", cat: "Raw Materials", addCat: "Hex Bar", ctrl: "Non-Serialized" as const },
  { partNo: "MOTR-SERV-400", desc: "AC Servo Motor, 400W, 3000 RPM, w/ Encoder", mfr: "MotorDrive", sku: "SRV-400W-3K", cat: "Motors", addCat: "Servo", ctrl: "Serialized" as const },
  { partNo: "PUMP-DIAP-1IN", desc: "Air-Operated Diaphragm Pump, 1\" Poly, 53 GPM", mfr: "FlowMaster", sku: "DP-1P-53GPM", cat: "Pumps", addCat: "Diaphragm", ctrl: "Serialized" as const },
  { partNo: "VALV-GATE-2IN", desc: "Gate Valve, 2\", 150# Flanged, WCB Body", mfr: "FlowControl", sku: "GV-2-150-WCB", cat: "Valves", addCat: "Gate", ctrl: "Non-Serialized" as const },
  { partNo: "ADHV-THREAD-M", desc: "Medium Strength Threadlocker, Blue, 50ml", mfr: "BondMax", sku: "TL-MED-BL-50", cat: "Adhesives", addCat: "Threadlocker", ctrl: "Non-Serialized" as const },
  { partNo: "INSUL-TAPE-EL", desc: "Electrical Tape, 3/4\" x 66ft, Black, 10pk", mfr: "WireTech", sku: "ET-075-66-10", cat: "Insulation", addCat: "Tape", ctrl: "Non-Serialized" as const },
  { partNo: "TOOL-WRCH-SET", desc: "Combination Wrench Set, 12pc, SAE, Chrome", mfr: "PrecisionTools", sku: "CWS-12SAE", cat: "Tools", addCat: "Wrenches", ctrl: "Non-Serialized" as const },
  { partNo: "TOOL-SOCK-38", desc: "Socket Set, 3/8\" Drive, 22pc, 6-Point, Metric", mfr: "PrecisionTools", sku: "SS-38-22M", cat: "Tools", addCat: "Sockets", ctrl: "Non-Serialized" as const },
];

const ALT_UNITS_LIST = ["Box (100)", "Carton (10)", "Bag (100)", "Tube (1)", "Pallet (50)", "Box (10)", "Case (24)", "Pack (12)", "Drum (55gal)", "Spool (1000ft)"];
const LOCATIONS = [
  "Warehouse A, Row 01, Sh...", "Warehouse B, Row 04, Sh...", "Warehouse C, Bin 12",
  "Tool Room, Cabinet 5, Dra...", "Yard, Rack 01", "Parts Room, Row 02, Bin 12",
  "Warehouse D, Bin 08", "Maint Shop, Cabinet 3", "Receiving Dock 2",
];

// Seeded RNG for deterministic data
function seededRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function generateItemsFromVendor(vendor: Vendor): PartnerItemData[] {
  const rng = seededRng(vendor.companyName.length * 31 + 7);
  const items: PartnerItemData[] = [];

  // First 6 use the detailed ITEM_DEFS
  for (let i = 0; i < ITEM_DEFS.length; i++) {
    const d = ITEM_DEFS[i];
    items.push({
      id: `item-${d.partNo}-${i}`,
      partNo: d.partNo,
      description: d.desc,
      manufacturer: d.mfr,
      sku: d.sku,
      category: d.cat,
      additionalCategory: d.addCat,
      itemType: ITEM_TYPES[Math.floor(rng() * ITEM_TYPES.length)],
      itemControlType: d.ctrl,
      stockStatus: d.stock,
      onHand: d.onHand,
      onHandUnit: d.unit,
      altUnits: d.alt,
      inboundLocation: d.inLoc,
      outboundLocation: d.outLoc,
      acquisitionMethods: d.acq,
      status: rng() > 0.1 ? "Active" : "Inactive",
      tradeDirection: (["sell", "purchase", "both"] as const)[Math.floor(rng() * 3)],
      image: ITEM_IMAGES[i % ITEM_IMAGES.length],
      hasBlueDot: rng() > 0.6,
    });
  }

  // Generate 494 extra items (total ~500) using EXTRA_DEFS + random data
  const extraCount = 494;
  for (let i = 0; i < extraCount; i++) {
    const r = rng;
    const def = EXTRA_DEFS[i % EXTRA_DEFS.length];
    const suffix = Math.floor(i / EXTRA_DEFS.length);
    const partNo = suffix === 0 ? def.partNo : `${def.partNo}-${String(suffix).padStart(2, "0")}`;
    const stockStatuses: ("In Stock" | "Low Stock" | "Out of Stock")[] = ["In Stock", "In Stock", "In Stock", "Low Stock", "Out of Stock"];
    const acqOptions: ("Purchased" | "Manufactured" | "Purchase")[][] = [
      ["Purchased"], ["Manufactured"], ["Purchased", "Manufactured"], ["Purchase"], ["Purchased"],
    ];
    items.push({
      id: `item-${partNo}-${i + 6}`,
      partNo,
      description: def.desc,
      manufacturer: def.partNo.split("-")[0] + "Corp",
      sku: def.sku,
      category: def.cat,
      additionalCategory: def.addCat,
      itemType: ITEM_TYPES[Math.floor(r() * ITEM_TYPES.length)],
      itemControlType: def.ctrl,
      stockStatus: stockStatuses[Math.floor(r() * stockStatuses.length)],
      onHand: Math.floor(r() * 20000),
      onHandUnit: (["ea", "pk", "sh", "ft", "lb", "gal"] as const)[Math.floor(r() * 6)],
      altUnits: ALT_UNITS_LIST[Math.floor(r() * ALT_UNITS_LIST.length)],
      inboundLocation: LOCATIONS[Math.floor(r() * LOCATIONS.length)],
      outboundLocation: LOCATIONS[Math.floor(r() * LOCATIONS.length)],
      acquisitionMethods: acqOptions[Math.floor(r() * acqOptions.length)],
      status: r() > 0.12 ? "Active" : "Inactive",
      tradeDirection: (["sell", "purchase", "both"] as const)[Math.floor(r() * 3)],
      image: ITEM_IMAGES[Math.floor(r() * ITEM_IMAGES.length)],
      hasBlueDot: r() > 0.65,
    });
  }

  return items;
}

// Inventory items for the "Add Item" modal
function generateInventoryItems(): PartnerItemData[] {
  const rng = seededRng(42);
  const items: PartnerItemData[] = [];
  const allDefs = [...EXTRA_DEFS.slice(6), ...EXTRA_DEFS, ...EXTRA_DEFS.slice(0, 6)];
  for (let i = 0; i < 60; i++) {
    const r = rng;
    const def = allDefs[i % allDefs.length];
    const partNo = `INV-${def.partNo.split("-").slice(0, 2).join("-")}-${String(i).padStart(3, "0")}`;
    items.push({
      id: `inv-${partNo}-${i}`,
      partNo,
      description: def.desc,
      manufacturer: def.partNo.split("-")[0] + "Corp",
      sku: def.sku,
      category: def.cat,
      additionalCategory: def.addCat,
      itemType: ITEM_TYPES[Math.floor(r() * ITEM_TYPES.length)],
      itemControlType: def.ctrl,
      stockStatus: r() > 0.3 ? "In Stock" : (r() > 0.5 ? "Low Stock" : "Out of Stock"),
      onHand: Math.floor(r() * 15000),
      onHandUnit: "ea",
      altUnits: ALT_UNITS_LIST[Math.floor(r() * ALT_UNITS_LIST.length)],
      inboundLocation: LOCATIONS[Math.floor(r() * LOCATIONS.length)],
      outboundLocation: LOCATIONS[Math.floor(r() * LOCATIONS.length)],
      acquisitionMethods: ["Purchased"],
      status: "Active",
      tradeDirection: (["sell", "purchase", "both"] as const)[Math.floor(r() * 3)],
      image: ITEM_IMAGES[Math.floor(r() * ITEM_IMAGES.length)],
      hasBlueDot: false,
    });
  }
  return items;
}

const INVENTORY_ITEMS = generateInventoryItems();

// ──────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────

function StockStatusDot({ status }: { status: string }) {
  const s = STOCK_STATUS_STYLES[status] || STOCK_STATUS_STYLES["In Stock"];
  return (
    <span className="inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-xs whitespace-nowrap shrink-0" style={{ fontWeight: 500, backgroundColor: s.bg, color: s.color, borderColor: s.border }}>
      {status}
    </span>
  );
}

function AcqBadge({ method }: { method: string }) {
  const s = ACQ_BADGE_STYLES[method] || ACQ_BADGE_STYLES["Purchased"];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] whitespace-nowrap border"
      style={{ color: s.color, backgroundColor: s.bg, borderColor: s.border, fontWeight: 500 }}
    >
      {method}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES["Active"];
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] whitespace-nowrap border"
      style={{ color: style.color, backgroundColor: style.bg, borderColor: style.border, fontWeight: 600 }}
    >
      {status}
    </span>
  );
}

function CategoryPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] whitespace-nowrap bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]" style={{ fontWeight: 500 }}>
      {label}
    </span>
  );
}

// ──────────────────────────────────────────────
// Column configuration
// ──────────────────────────────────────────────

const ITEM_COLUMN_DEFS: (ColumnConfig & { minWidth: string; sortable?: boolean; align?: "left" | "right" })[] = [
  { key: "item", label: "Item", minWidth: "200px", sortable: true },
  { key: "description", label: "Description", minWidth: "260px", sortable: true },
  { key: "stock_status", label: "Stock Status", minWidth: "120px", sortable: true },
  { key: "item_type", label: "Item Type", minWidth: "160px", sortable: true },
  { key: "control_type", label: "Control Type", minWidth: "140px", sortable: true },
  { key: "category", label: "Primary Cat.", minWidth: "130px", sortable: true },
  { key: "additional_category", label: "Additional Cat.", minWidth: "140px" },
  { key: "on_hand", label: "On-Hand", minWidth: "110px", sortable: true, align: "right" },
  { key: "alt_units", label: "Alt. Units", minWidth: "110px" },
  { key: "inbound_location", label: "Inbound Loc.", minWidth: "160px" },
  { key: "outbound_location", label: "Outbound Loc.", minWidth: "160px" },
  { key: "acquisition", label: "Acquisition", minWidth: "160px" },
  { key: "status", label: "Status", minWidth: "100px", sortable: true },
];

const DEFAULT_COLUMN_ORDER = ITEM_COLUMN_DEFS.map((c) => c.key);
const DEFAULT_COLUMN_VISIBILITY: Record<string, boolean> = Object.fromEntries(
  ITEM_COLUMN_DEFS.map((c) => [c.key, true])
);
const LOCKED_COLUMNS = ["item"];
const DEFAULT_COLUMN_WIDTHS: Record<string, number> = Object.fromEntries(
  ITEM_COLUMN_DEFS.map((c) => [c.key, parseInt(c.minWidth, 10)])
);
const MIN_COL_WIDTH = 1;
const CHECKBOX_COL_WIDTH = 40;
const ACTIONS_COL_WIDTH = 60;

// ──────────────────────────────────────────────
// Add Item Modal
// ──────────────────────────────────────────────

type ModalView = "browse" | "added";

function AddItemModal({
  open,
  onOpenChange,
  existingItemIds,
  existingItems,
  onItemsAdded,
  onItemRemoved,
  activeSubTab,
  generic,
  contextLabel,
  contextType,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existingItemIds: Set<string>;
  existingItems: PartnerItemData[];
  onItemsAdded: (items: PartnerItemData[]) => void;
  onItemRemoved: (id: string) => void;
  activeSubTab: "sell" | "purchase";
  generic?: boolean;
  contextLabel?: string;
  contextType?: "discount" | "premium";
}) {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [addedSelectedIds, setAddedSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [view, setView] = useState<ModalView>("browse");
  const [addedSearch, setAddedSearch] = useState("");
  const [addedPage, setAddedPage] = useState(1);
  const perPage = 15;

  useEffect(() => {
    if (open) {
      setSearch("");
      setSelectedIds(new Set());
      setAddedSelectedIds(new Set());
      setPage(1);
      setView("browse");
      setAddedSearch("");
      setAddedPage(1);
    }
  }, [open]);

  const available = useMemo(() => {
    return INVENTORY_ITEMS.filter((it) => !existingItemIds.has(it.id));
  }, [existingItemIds]);

  const filtered = useMemo(() => {
    if (!search.trim()) return available;
    const q = search.toLowerCase();
    return available.filter(
      (it) =>
        it.partNo.toLowerCase().includes(q) ||
        it.description.toLowerCase().includes(q) ||
        it.category.toLowerCase().includes(q) ||
        it.manufacturer.toLowerCase().includes(q)
    );
  }, [available, search]);

  // Already added items — filtered for current sub-tab direction
  const addedFiltered = useMemo(() => {
    let list = existingItems;
    if (addedSearch.trim()) {
      const q = addedSearch.toLowerCase();
      list = list.filter(
        (it) =>
          it.partNo.toLowerCase().includes(q) ||
          it.description.toLowerCase().includes(q) ||
          it.category.toLowerCase().includes(q) ||
          it.manufacturer.toLowerCase().includes(q)
      );
    }
    return list;
  }, [existingItems, addedSearch]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const addedTotalPages = Math.max(1, Math.ceil(addedFiltered.length / perPage));
  const addedPaginated = addedFiltered.slice((addedPage - 1) * perPage, addedPage * perPage);

  function toggleItem(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAddedItem(id: string) {
    setAddedSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleAdd() {
    const items = INVENTORY_ITEMS.filter((it) => selectedIds.has(it.id));
    onItemsAdded(items);
    onOpenChange(false);
    toast.success(generic
      ? `${items.length} item${items.length !== 1 ? "s" : ""} added`
      : `${items.length} item${items.length !== 1 ? "s" : ""} added to ${activeSubTab === "sell" ? "items they sell" : "items they purchase"}`);
  }

  const [bulkRemoveConfirmOpen, setBulkRemoveConfirmOpen] = useState(false);

  function handleBulkRemove() {
    const count = addedSelectedIds.size;
    addedSelectedIds.forEach((id) => onItemRemoved(id));
    toast.success(generic
      ? `${count} item${count !== 1 ? "s" : ""} removed`
      : `${count} item${count !== 1 ? "s" : ""} removed from ${activeSubTab === "sell" ? "items they sell" : "items they purchase"}`);
    setAddedSelectedIds(new Set());
    setBulkRemoveConfirmOpen(false);
  }

  const tradeLabel = generic ? "Items" : (activeSubTab === "sell" ? "Items They Sell" : "Items They Purchase");
  const tradeShort = generic ? "" : (activeSubTab === "sell" ? "They Sell" : "They Purchase");
  const tradeIcon = activeSubTab === "sell" ? Tag : ShoppingCart;
  const TradeIcon = tradeIcon;

  // Modal sort state
  const [modalSort, setModalSort] = useState<string>("all");

  // Counts for sort pills
  const browseSortCounts = useMemo(() => {
    const src = filtered;
    return {
      all: src.length,
      in_stock: src.filter((it) => it.stockStatus === "In Stock").length,
      low_stock: src.filter((it) => it.stockStatus === "Low Stock").length,
      serialized: src.filter((it) => it.itemControlType === "Serialized").length,
      non_serialized: src.filter((it) => it.itemControlType === "Non-Serialized").length,
    };
  }, [filtered]);

  const addedSortCounts = useMemo(() => {
    const src = addedFiltered;
    return {
      all: src.length,
      active: src.filter((it) => it.status === "Active").length,
      inactive: src.filter((it) => it.status === "Inactive").length,
      serialized: src.filter((it) => it.itemControlType === "Serialized").length,
      non_serialized: src.filter((it) => it.itemControlType === "Non-Serialized").length,
    };
  }, [addedFiltered]);

  const MODAL_SORT_OPTIONS = view === "browse"
    ? [
        { key: "all", label: "All", count: browseSortCounts.all },
        { key: "in_stock", label: "In Stock", count: browseSortCounts.in_stock },
        { key: "low_stock", label: "Low Stock", count: browseSortCounts.low_stock },
        { key: "serialized", label: "Serialized", count: browseSortCounts.serialized },
        { key: "non_serialized", label: "Non-Serialized", count: browseSortCounts.non_serialized },
      ]
    : [
        { key: "all", label: "All", count: addedSortCounts.all },
        { key: "active", label: "Active", count: addedSortCounts.active },
        { key: "inactive", label: "Inactive", count: addedSortCounts.inactive },
        { key: "serialized", label: "Serialized", count: addedSortCounts.serialized },
        { key: "non_serialized", label: "Non-Serialized", count: addedSortCounts.non_serialized },
      ];

  // Reset sort when switching views
  useEffect(() => { setModalSort("all"); }, [view]);

  // Apply sorting filter
  const sortedBrowse = useMemo(() => {
    let list = filtered;
    if (modalSort === "in_stock") list = list.filter((it) => it.stockStatus === "In Stock");
    else if (modalSort === "low_stock") list = list.filter((it) => it.stockStatus === "Low Stock");
    else if (modalSort === "serialized") list = list.filter((it) => it.itemControlType === "Serialized");
    else if (modalSort === "non_serialized") list = list.filter((it) => it.itemControlType === "Non-Serialized");
    return list;
  }, [filtered, modalSort]);

  const sortedAdded = useMemo(() => {
    let list = addedFiltered;
    if (modalSort === "active") list = list.filter((it) => it.status === "Active");
    else if (modalSort === "inactive") list = list.filter((it) => it.status === "Inactive");
    else if (modalSort === "serialized") list = list.filter((it) => it.itemControlType === "Serialized");
    else if (modalSort === "non_serialized") list = list.filter((it) => it.itemControlType === "Non-Serialized");
    return list;
  }, [addedFiltered, modalSort]);

  const browseTotalPages = Math.max(1, Math.ceil(sortedBrowse.length / perPage));
  const browsePaginated = sortedBrowse.slice((page - 1) * perPage, page * perPage);
  const addedSortedTotalPages = Math.max(1, Math.ceil(sortedAdded.length / perPage));
  const addedSortedPaginated = sortedAdded.slice((addedPage - 1) * perPage, addedPage * perPage);

  const modalBaseClass = "!fixed !inset-0 !translate-x-0 !translate-y-0 !m-auto !w-full !h-full transition-[max-width,max-height,border-radius] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]";
  const modalSizeClass = isFullScreen
    ? `${modalBaseClass} !max-w-[calc(100%-1rem)] sm:!max-w-[calc(100%-1.5rem)] lg:!max-w-[calc(100%-2rem)] !max-h-[calc(100%-1rem)] sm:!max-h-[calc(100%-1.5rem)] lg:!max-h-[calc(100%-2rem)] !rounded-2xl`
    : `${modalBaseClass} !max-w-[100%] sm:!max-w-[960px] lg:!max-w-[1040px] !max-h-[100dvh] sm:!max-h-[88vh] rounded-none sm:!rounded-2xl`;

  // Shared table row renderer for both views
  const renderItemRow = (item: PartnerItemData, mode: "browse" | "added") => {
    const isSelected = mode === "browse" ? selectedIds.has(item.id) : false;
    const isAddedSelected = mode === "added" ? addedSelectedIds.has(item.id) : false;
    return (
      <TableRow
        key={item.id}
        className={`cursor-pointer group bg-white hover:bg-[#F0F7FF] [&>td]:py-1 [&>td]:pl-3 [&>td]:pr-2 ${isSelected || isAddedSelected ? "!bg-[#EDF4FF]/60" : ""}`}
        onClick={() => mode === "browse" ? toggleItem(item.id) : toggleAddedItem(item.id)}
      >
        {/* Checkbox */}
        <TableCell className="sticky left-0 z-10 bg-white group-hover:bg-[#F0F7FF] !pl-2 !pr-0" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={mode === "browse" ? isSelected : addedSelectedIds.has(item.id)}
            onCheckedChange={() => mode === "browse" ? toggleItem(item.id) : toggleAddedItem(item.id)}
          />
        </TableCell>
        <TableCell className="bg-white group-hover:bg-[#F0F7FF]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#F1F5F9] overflow-hidden shrink-0 border border-[#E8ECF1]">
              <img src={item.image} alt="" className="w-full h-full object-cover" />
            </div>
            <span className="text-sm font-mono whitespace-nowrap" style={{ fontWeight: 500, color: '#1E293B' }}>{item.partNo}</span>
          </div>
        </TableCell>
        <TableCell className="bg-white group-hover:bg-[#F0F7FF]">
          <p className="text-sm text-[#334155] truncate" style={{ fontWeight: 400 }}>{item.description}</p>
        </TableCell>
        <TableCell className="bg-white group-hover:bg-[#F0F7FF]"><StockStatusDot status={item.stockStatus} /></TableCell>
        <TableCell className="bg-white group-hover:bg-[#F0F7FF]"><span className="text-[13px] text-[#334155] whitespace-nowrap">{item.itemControlType}</span></TableCell>
        <TableCell className="bg-white group-hover:bg-[#F0F7FF]"><span className="text-[13px] text-[#334155] whitespace-nowrap">{item.category}</span></TableCell>
        <TableCell className="bg-white group-hover:bg-[#F0F7FF]"><CategoryPill label={item.additionalCategory} /></TableCell>
        <TableCell className="text-right !pr-3 bg-white group-hover:bg-[#F0F7FF]">
          <span className="text-[14px] text-[#334155] tabular-nums" style={{ fontWeight: 600 }}>{item.onHand.toLocaleString()}</span>
          <p className="text-[10px] text-muted-foreground">{item.onHandUnit}</p>
        </TableCell>
        <TableCell className="bg-white group-hover:bg-[#F0F7FF]"><span className="text-[13px] text-[#334155] whitespace-nowrap">{item.altUnits}</span></TableCell>
        <TableCell className="bg-white group-hover:bg-[#F0F7FF]"><span className="text-[13px] text-[#334155] truncate block max-w-[140px]">{item.inboundLocation}</span></TableCell>
        <TableCell className="bg-white group-hover:bg-[#F0F7FF]"><span className="text-[13px] text-[#334155] truncate block max-w-[140px]">{item.outboundLocation}</span></TableCell>
        <TableCell className="bg-white group-hover:bg-[#F0F7FF]">
          <div className="flex items-center gap-1 flex-wrap">
            {item.acquisitionMethods.map((m) => <AcqBadge key={m} method={m} />)}
          </div>
        </TableCell>
        {/* Actions — remove button on right for added view */}
        {mode === "added" && (
          <TableCell className="sticky right-0 z-10 bg-white group-hover:bg-[#F0F7FF] !px-0" style={{ boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.08)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-center w-full h-full">
              <button
                onClick={() => onItemRemoved(item.id)}
                className="w-7 h-7 rounded-md flex items-center justify-center text-[#94A3B8] hover:text-[#DC2626] hover:bg-[#FEF2F2] transition-colors cursor-pointer"
                title="Remove item"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </TableCell>
        )}
      </TableRow>
    );
  };

  const currentSearch = view === "browse" ? search : addedSearch;
  const setCurrentSearch = view === "browse" ? setSearch : setAddedSearch;
  const currentPage = view === "browse" ? page : addedPage;
  const setCurrentPage = view === "browse" ? setPage : setAddedPage;
  const currentTotalPages = view === "browse" ? browseTotalPages : addedSortedTotalPages;
  const currentPaginated = view === "browse" ? browsePaginated : addedSortedPaginated;
  const currentTotal = view === "browse" ? sortedBrowse.length : sortedAdded.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`flex flex-col p-0 gap-0 border-0 sm:border ${generic ? "z-[230]" : ""} ${modalSizeClass}`}
        hideCloseButton
        overlayClassName={generic ? "z-[225]" : undefined}
        style={{ boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)" }}
      >
        <DialogTitle className="sr-only">{generic ? "Manage Items" : (activeSubTab === "sell" ? "Manage Items They Sell" : "Manage Items They Purchase")}</DialogTitle>
        <DialogDescription className="sr-only">Add or remove {tradeLabel.toLowerCase()}.</DialogDescription>

        {/* Header */}
        <div className="px-3 sm:px-5 pt-3 sm:pt-4 pb-2.5 sm:pb-3 shrink-0 bg-white rounded-t-none sm:rounded-t-2xl border-b border-[#EEF2F6]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <h2 className="text-[15px] sm:text-[17px] text-[#0F172A]" style={{ fontWeight: 700 }}>
                  {generic ? "Manage Items" : (activeSubTab === "sell" ? "Manage Items They Sell" : "Manage Items They Purchase")}
                </h2>
                {/* Trade direction indicator — hidden in generic mode */}
                {!generic && (
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] border"
                  style={{
                    fontWeight: 600,
                    backgroundColor: activeSubTab === "sell" ? "#EFF6FF" : "#F5F3FF",
                    color: activeSubTab === "sell" ? "#1E40AF" : "#5B21B6",
                    borderColor: activeSubTab === "sell" ? "#BFDBFE" : "#DDD6FE",
                  }}
                >
                  <TradeIcon className="w-3 h-3" />
                  {tradeLabel}
                </span>
                )}
                {/* Context label — e.g. pricing rule name, colored by type */}
                {generic && contextLabel && (
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] border whitespace-nowrap shrink-0"
                  style={{
                    fontWeight: 600,
                    backgroundColor: contextType === "premium" ? "#F5F3FF" : "#ECFDF5",
                    color: contextType === "premium" ? "#6D28D9" : "#047857",
                    borderColor: contextType === "premium" ? "#DDD6FE" : "#A7F3D0",
                  }}
                >
                  {contextType === "premium" ? "Premium" : "Discount"}
                  <span className="text-[10px] opacity-60">·</span>
                  {contextLabel}
                </span>
                )}
              </div>
              <p className="text-[11px] sm:text-xs text-[#64748B] mt-1" style={{ fontWeight: 400 }}>
                {generic
                  ? "Browse inventory to add items, or manage already added items."
                  : activeSubTab === "sell"
                  ? "Browse inventory to add items they sell, or manage already added items."
                  : "Browse inventory to add items they purchase, or manage already added items."}
              </p>
            </div>
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              <button
                onClick={() => setIsFullScreen(!isFullScreen)}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-xs text-[#475569] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-all cursor-pointer"
                style={{ fontWeight: 500 }}
              >
                {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                {isFullScreen ? "Exit full" : "Full view"}
              </button>
              <button
                onClick={() => onOpenChange(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#94A3B8] hover:text-[#64748B] hover:bg-[#F1F5F9] transition-all cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Search + View tabs + Sorting pills */}
        <div className="px-3 sm:px-5 pt-2 bg-white shrink-0">
          {/* Row: Search + View toggle + Count */}
          <div className="flex items-center gap-3">
            {/* Search — leftmost */}
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
              <Input
                placeholder={view === "browse" ? "Search inventory..." : "Search added items..."}
                value={currentSearch}
                onChange={(e) => { setCurrentSearch(e.target.value); setCurrentPage(1); }}
                className="pl-9 pr-8 h-8 text-[13px] bg-white border-border/80 shadow-sm placeholder:text-muted-foreground/50 focus-visible:border-primary focus-visible:ring-primary/20"
              />
              {currentSearch && (
                <button
                  onClick={() => { setCurrentSearch(""); setCurrentPage(1); }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* View toggle — after search */}
            <div className="inline-flex items-center rounded-lg bg-[#F1F5F9] p-0.5 shrink-0">
              <button
                onClick={() => setView("browse")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] transition-all cursor-pointer ${
                  view === "browse" ? "bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)] text-[#0F172A]" : "text-[#64748B] hover:text-[#334155]"
                }`}
                style={{ fontWeight: view === "browse" ? 600 : 500 }}
              >
                <Package className={`w-3.5 h-3.5 ${view === "browse" ? "text-[#0A77FF]" : "text-[#94A3B8]"}`} />
                Browse Inventory
                <span className={`text-[10px] rounded-full px-1.5 py-px min-w-[16px] text-center ${view === "browse" ? "bg-[#EDF4FF] text-[#0A77FF]" : "bg-[#E2E8F0] text-[#64748B]"}`} style={{ fontWeight: 600 }}>
                  {available.length}
                </span>
              </button>
              <button
                onClick={() => setView("added")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] transition-all cursor-pointer ${
                  view === "added" ? "bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)] text-[#0F172A]" : "text-[#64748B] hover:text-[#334155]"
                }`}
                style={{ fontWeight: view === "added" ? 600 : 500 }}
              >
                <Check className={`w-3.5 h-3.5 ${view === "added" ? "text-[#059669]" : "text-[#94A3B8]"}`} />
                Added Items
                <span className={`text-[10px] rounded-full px-1.5 py-px min-w-[16px] text-center ${view === "added" ? "bg-[#ECFDF5] text-[#059669]" : "bg-[#E2E8F0] text-[#64748B]"}`} style={{ fontWeight: 600 }}>
                  {existingItems.length}
                </span>
              </button>
            </div>

            {/* Selection count / total */}
            <div className="flex items-center gap-2 ml-auto shrink-0">
              {view === "browse" && selectedIds.size > 0 && (
                <span className="text-xs text-[#0A77FF] shrink-0" style={{ fontWeight: 600 }}>
                  {selectedIds.size} selected
                </span>
              )}
              <span className="text-xs text-muted-foreground shrink-0" style={{ fontWeight: 500 }}>
                {currentTotal} {view === "browse" ? "available" : "items"}
              </span>
            </div>
          </div>

          {/* Sorting pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pt-2.5 pb-2.5">
            {MODAL_SORT_OPTIONS.map((opt) => {
              const isActive = modalSort === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() => { setModalSort(opt.key); setCurrentPage(1); }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? "border-primary bg-[#EDF4FF] hover:bg-[#D6E8FF] active:bg-[#ADD1FF]"
                      : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30 active:bg-muted"
                  }`}
                  style={{ fontWeight: isActive ? 500 : 400, color: isActive ? "#0A77FF" : undefined }}
                >
                  {opt.label}
                  <span
                    className={`text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center ${isActive ? "bg-primary/10" : "bg-muted"}`}
                    style={{ fontWeight: 600, color: isActive ? "#0A77FF" : "#475569" }}
                  >
                    {opt.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 min-h-0 overflow-auto bg-white">
          <Table style={{ tableLayout: "fixed", minWidth: view === "added" ? 1560 : 1500 }}>
            <TableHeader className="sticky top-0 z-20 bg-white">
              <TableRow className="bg-[#FAFBFC] hover:bg-[#FAFBFC] [&>th]:h-8">
                <TableHead className="sticky left-0 z-20 bg-[#FAFBFC] w-[40px] min-w-[40px] max-w-[40px] !pl-2 !pr-0">
                  {view === "browse" ? (
                    <Checkbox
                      checked={currentPaginated.length > 0 && currentPaginated.every((it) => selectedIds.has(it.id)) ? true : currentPaginated.some((it) => selectedIds.has(it.id)) ? "indeterminate" : false}
                      onCheckedChange={() => {
                        const allSelected = currentPaginated.every((it) => selectedIds.has(it.id));
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          currentPaginated.forEach((it) => allSelected ? next.delete(it.id) : next.add(it.id));
                          return next;
                        });
                      }}
                    />
                  ) : (
                    <Checkbox
                      checked={currentPaginated.length > 0 && currentPaginated.every((it) => addedSelectedIds.has(it.id)) ? true : currentPaginated.some((it) => addedSelectedIds.has(it.id)) ? "indeterminate" : false}
                      onCheckedChange={() => {
                        const allSelected = currentPaginated.every((it) => addedSelectedIds.has(it.id));
                        setAddedSelectedIds((prev) => {
                          const next = new Set(prev);
                          currentPaginated.forEach((it) => allSelected ? next.delete(it.id) : next.add(it.id));
                          return next;
                        });
                      }}
                    />
                  )}
                </TableHead>
                <TableHead className="text-[13px] text-foreground !pl-3" style={{ fontWeight: 600, width: 180 }}>Item</TableHead>
                <TableHead className="text-[13px] text-foreground !pl-3" style={{ fontWeight: 600, width: 260 }}>Description</TableHead>
                <TableHead className="text-[13px] text-foreground !pl-3" style={{ fontWeight: 600, width: 100 }}>Status</TableHead>
                <TableHead className="text-[13px] text-foreground !pl-3" style={{ fontWeight: 600, width: 130 }}>Control Type</TableHead>
                <TableHead className="text-[13px] text-foreground !pl-3" style={{ fontWeight: 600, width: 130 }}>Primary Cat.</TableHead>
                <TableHead className="text-[13px] text-foreground !pl-3" style={{ fontWeight: 600, width: 130 }}>Additional Cat.</TableHead>
                <TableHead className="text-[13px] text-foreground !pl-3 text-right" style={{ fontWeight: 600, width: 100 }}>On-Hand</TableHead>
                <TableHead className="text-[13px] text-foreground !pl-3" style={{ fontWeight: 600, width: 100 }}>Alt. Units</TableHead>
                <TableHead className="text-[13px] text-foreground !pl-3" style={{ fontWeight: 600, width: 150 }}>Inbound Loc.</TableHead>
                <TableHead className="text-[13px] text-foreground !pl-3" style={{ fontWeight: 600, width: 150 }}>Outbound Loc.</TableHead>
                <TableHead className="text-[13px] text-foreground !pl-3" style={{ fontWeight: 600, width: 200 }}>Acquisition</TableHead>
                {view === "added" && (
                  <TableHead className="sticky right-0 z-20 bg-[#FAFBFC] w-[60px] min-w-[60px] max-w-[60px] !pl-2 !pr-2" style={{ boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.08)" }}>
                    <span className="text-[13px]" />
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentPaginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={view === "added" ? 13 : 12} className="text-center py-16 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Package className="w-8 h-8" />
                      <p className="text-sm">{view === "browse" ? "No items found" : "No items added yet"}</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                currentPaginated.map((item) => renderItemRow(item, view))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination — matches main items table */}
        <div className="flex flex-col sm:flex-row items-center justify-center px-4 py-2.5 border-t border-border gap-3 shrink-0 bg-white">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(1)}
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-[13px] text-muted-foreground"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            >
              <ChevronLeft className="w-3 h-3" />
              Prev
            </Button>

            {(() => {
              const pages: (number | "...")[] = [];
              if (currentTotalPages <= 7) { for (let i = 1; i <= currentTotalPages; i++) pages.push(i); }
              else { pages.push(1); if (currentPage > 3) pages.push("..."); for (let i = Math.max(2, currentPage - 1); i <= Math.min(currentTotalPages - 1, currentPage + 1); i++) pages.push(i); if (currentPage < currentTotalPages - 2) pages.push("..."); pages.push(currentTotalPages); }
              return pages.map((p, idx) => p === "..." ? (
                <span key={`d${idx}`} className="px-1 text-muted-foreground text-[13px]">...</span>
              ) : (
                <Button
                  key={p}
                  variant={currentPage === p ? "default" : "ghost"}
                  size="sm"
                  className={`h-7 w-7 p-0 text-[13px] ${
                    currentPage === p
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground"
                  }`}
                  onClick={() => setCurrentPage(p as number)}
                >
                  {p}
                </Button>
              ));
            })()}

            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-[13px] text-muted-foreground"
              disabled={currentPage === currentTotalPages}
              onClick={() => setCurrentPage(Math.min(currentTotalPages, currentPage + 1))}
            >
              Next
              <ChevronRight className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              disabled={currentPage === currentTotalPages}
              onClick={() => setCurrentPage(currentTotalPages)}
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Footer — actions */}
        <div className="shrink-0 border-t border-[#EEF2F6] bg-white px-3 sm:px-5 py-2.5 flex items-center justify-between sm:rounded-b-2xl">
          <div className="flex items-center gap-2 text-[12px] text-[#64748B]">
            <span style={{ fontWeight: 500 }}>{existingItems.length} {tradeLabel.toLowerCase()} added</span>
            {view === "browse" && selectedIds.size > 0 && (
              <>
                <span className="text-[#CBD5E1]">·</span>
                <span className="text-[#0A77FF]" style={{ fontWeight: 600 }}>{selectedIds.size} ready to add</span>
              </>
            )}
            {view === "added" && addedSelectedIds.size > 0 && (
              <>
                <span className="text-[#CBD5E1]">·</span>
                <span className="text-[#DC2626]" style={{ fontWeight: 600 }}>{addedSelectedIds.size} selected</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-lg px-4 text-xs h-9 bg-white border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A]"
            >
              Cancel
            </Button>
            {view === "added" && addedSelectedIds.size > 0 && (
              <Button
                onClick={() => setBulkRemoveConfirmOpen(true)}
                className="gap-1.5 rounded-lg px-4 text-xs h-9 bg-[#DC2626] text-white hover:bg-[#B91C1C] shadow-sm"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remove {addedSelectedIds.size} Item{addedSelectedIds.size !== 1 ? "s" : ""}
              </Button>
            )}
            {view === "added" && addedSelectedIds.size === 0 && (
              <Button
                onClick={() => onOpenChange(false)}
                className="rounded-lg px-4 text-xs h-9 bg-[#0A77FF] text-white hover:bg-[#0862D0] shadow-sm"
              >
                Done
              </Button>
            )}
            {view === "browse" && (
              <Button
                onClick={handleAdd}
                disabled={selectedIds.size === 0}
                className="gap-1.5 rounded-lg px-4 text-xs h-9 bg-[#0A77FF] text-white hover:bg-[#0862D0] shadow-sm disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                Add {selectedIds.size > 0 ? `${selectedIds.size} Item${selectedIds.size !== 1 ? "s" : ""} ${tradeShort}` : `Items ${tradeShort}`}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>

      {/* Bulk remove confirmation — gradient style */}
      <AlertDialog open={bulkRemoveConfirmOpen} onOpenChange={setBulkRemoveConfirmOpen}>
        <AlertDialogContent
          className={`sm:max-w-[420px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)] ${generic ? "z-[240]" : ""}`}
          overlayClassName={generic ? "z-[235]" : undefined}
          onInteractOutside={() => setBulkRemoveConfirmOpen(false)}
        >
          {/* Gradient header */}
          <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #FEF2F2 0%, rgba(254,242,242,0.3) 70%, transparent 100%)" }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#EF4444" }} />
            <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#FEE2E2" }}>
              <Trash2 className="w-8 h-8" style={{ color: "#DC2626" }} />
            </div>
            <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: "#FEF2F2", color: "#991B1B", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
              Remove Items
            </span>
          </div>
          {/* Content */}
          <div className="flex flex-col items-center text-center px-8 pb-8">
            <AlertDialogHeader className="p-0 gap-0 text-center">
              <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "#0F172A" }}>
                Remove {addedSelectedIds.size} item{addedSelectedIds.size !== 1 ? "s" : ""}?
              </AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogDescription asChild>
              <div className="text-[13px] mt-2 max-w-[340px] mx-auto" style={{ color: "#475569", lineHeight: "1.65" }}>
                <p>The following items will be removed. You can add them back later.</p>
                {/* Items list */}
                <div className="mt-3 max-h-[120px] overflow-y-auto text-left rounded-lg border border-[#E2E8F0] bg-[#F8FAFC]">
                  {Array.from(addedSelectedIds).slice(0, 10).map((id) => {
                    const item = existingItems.find((it) => it.id === id);
                    return item ? (
                      <div key={id} className="flex items-center gap-2 px-3 py-1.5 border-b border-[#F1F5F9] last:border-0">
                        <Package className="w-3 h-3 text-[#94A3B8] shrink-0" />
                        <span className="text-[12px] text-[#334155] font-mono truncate" style={{ fontWeight: 500 }}>{item.partNo}</span>
                        <span className="text-[11px] text-[#64748B] truncate">{item.description}</span>
                      </div>
                    ) : null;
                  })}
                  {addedSelectedIds.size > 10 && (
                    <div className="px-3 py-1.5 text-[11px] text-[#94A3B8] text-center" style={{ fontWeight: 500 }}>
                      +{addedSelectedIds.size - 10} more items
                    </div>
                  )}
                </div>
              </div>
            </AlertDialogDescription>
            <div className="w-full mt-7 flex flex-col gap-2.5">
              <AlertDialogAction
                onClick={handleBulkRemove}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                style={{ fontWeight: 600, backgroundColor: "#DC2626", color: "#fff" }}
              >
                Remove {addedSelectedIds.size} Item{addedSelectedIds.size !== 1 ? "s" : ""}
              </AlertDialogAction>
              <AlertDialogCancel
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                style={{ fontWeight: 500, backgroundColor: "#F1F5F9", color: "#334155" }}
              >
                Cancel
              </AlertDialogCancel>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

// ──────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────

type SubTab = "sell" | "purchase";
type Density = "condensed" | "comfort" | "card";
type ItemFilter = "all" | "Active" | "Inactive" | "Serialized" | "Non-Serialized";

const DENSITY_CONFIG: { key: Density; label: string; description: string; icon: "align-justify" | "list" | "layout-grid" }[] = [
  { key: "condensed", label: "Condensed", description: "Compact view", icon: "align-justify" },
  { key: "comfort", label: "Comfort", description: "Spacious view", icon: "list" },
  { key: "card", label: "Card View", description: "Grid layout", icon: "layout-grid" },
];

export function PartnerItemsTab({ vendor, hideHeader, compact, contextLabel, contextType }: { vendor: Vendor; hideHeader?: boolean; compact?: boolean; contextLabel?: string; contextType?: "discount" | "premium" }) {
  const generatedItems = useMemo(() => generateItemsFromVendor(vendor), [vendor]);
  const [addedItems, setAddedItems] = useState<PartnerItemData[]>([]);
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());

  const allItems = useMemo(() => [...addedItems, ...generatedItems], [addedItems, generatedItems]);

  const [subTab, setSubTab] = useState<SubTab>("sell");
  const [searchQuery, setSearchQuery] = useState("");
  const [itemFilter, setItemFilter] = useState<ItemFilter>("all");
  const [density, setDensity] = useState<Density>("condensed");
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(20);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null);

  // Column state
  const [columnOrder, setColumnOrder] = useState<string[]>([...DEFAULT_COLUMN_ORDER]);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({ ...DEFAULT_COLUMN_VISIBILITY });
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({ ...DEFAULT_COLUMN_WIDTHS });
  const [frozenColumns, setFrozenColumns] = useState<Set<string>>(new Set(["item"]));
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [columnDrawerOpen, setColumnDrawerOpen] = useState(false);
  const [draggingColumnKey, setDraggingColumnKey] = useState<string | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [resizingColumnKey, setResizingColumnKey] = useState<string | null>(null);

  // Column drag reorder refs
  const colDragRef = useRef<{
    columnKey: string;
    startX: number;
    startY: number;
    isDragging: boolean;
    lastSwapTime: number;
  } | null>(null);
  const suppressNextClickRef = useRef(false);
  const ghostElRef = useRef<HTMLDivElement>(null);

  // Column resize ref
  const resizeRef = useRef<{
    columnKey: string;
    startX: number;
    startWidth: number;
  } | null>(null);

  // Helper to get column def
  const colDef = (key: string) => ITEM_COLUMN_DEFS.find((c) => c.key === key)!;

  // Valid column keys set
  const validColumnKeys = useMemo(() => new Set(ITEM_COLUMN_DEFS.map((c) => c.key)), []);

  // Visible columns in user-defined order
  const visibleColumns = useMemo(() => {
    const ordered = columnOrder.filter(
      (key) => validColumnKeys.has(key) && columnVisibility[key] !== false
    );
    if (!ordered.includes("item")) {
      ordered.unshift("item");
    } else if (ordered[0] !== "item") {
      const idx = ordered.indexOf("item");
      ordered.splice(idx, 1);
      ordered.unshift("item");
    }
    return ordered;
  }, [columnOrder, columnVisibility, validColumnKeys]);

  // Frozen offsets
  const frozenOffsets = useMemo(() => {
    const offsets: Record<string, number> = {};
    let cumLeft = CHECKBOX_COL_WIDTH;
    for (const key of visibleColumns) {
      if (frozenColumns.has(key)) {
        offsets[key] = cumLeft;
        cumLeft += columnWidths[key] ?? parseInt(colDef(key).minWidth, 10);
      }
    }
    return offsets;
  }, [visibleColumns, frozenColumns, columnWidths]);

  // Last frozen key
  const lastFrozenKey = useMemo(() => {
    let last = "";
    for (const key of visibleColumns) {
      if (frozenColumns.has(key)) last = key;
    }
    return last;
  }, [visibleColumns, frozenColumns]);

  // Column drag handler
  const handleHeaderMouseDown = useCallback((e: React.MouseEvent, columnKey: string) => {
    if (LOCKED_COLUMNS.includes(columnKey)) return;
    if (isResizing) return;
    if (e.button !== 0) return;

    const startX = e.clientX;
    const startY = e.clientY;
    colDragRef.current = { columnKey, startX, startY, isDragging: false, lastSwapTime: 0 };

    const DRAG_THRESHOLD = 5;
    const SWAP_SETTLE_MS = 60;

    const onMove = (moveEvt: MouseEvent) => {
      if (!colDragRef.current) return;
      const dx = moveEvt.clientX - colDragRef.current.startX;
      const dy = moveEvt.clientY - colDragRef.current.startY;

      if (!colDragRef.current.isDragging) {
        if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return;
        colDragRef.current.isDragging = true;
        document.body.style.userSelect = "none";
        document.body.style.cursor = "grabbing";
        setDraggingColumnKey(colDragRef.current.columnKey);
      }

      const ghost = ghostElRef.current;
      if (ghost) {
        ghost.style.transform = `translate(${moveEvt.clientX}px, ${moveEvt.clientY}px)`;
      }

      const now = performance.now();
      if (now - colDragRef.current.lastSwapTime < SWAP_SETTLE_MS) return;

      const cursorX = moveEvt.clientX;
      const draggedKey = colDragRef.current.columnKey;

      const draggedTh = document.querySelector<HTMLElement>(`th[data-col-drag-key="${draggedKey}"]`);
      if (!draggedTh) return;
      const draggedRect = draggedTh.getBoundingClientRect();

      if (cursorX >= draggedRect.left && cursorX <= draggedRect.right) return;

      const allThs = document.querySelectorAll<HTMLElement>("th[data-col-drag-key]");
      for (const th of allThs) {
        const rect = th.getBoundingClientRect();
        if (cursorX < rect.left || cursorX > rect.right) continue;
        const k = th.getAttribute("data-col-drag-key");
        if (!k || k === draggedKey || LOCKED_COLUMNS.includes(k)) break;

        setColumnOrder((prev) => {
          const srcIdx = prev.indexOf(draggedKey);
          const tgtIdx = prev.indexOf(k);
          if (srcIdx === -1 || tgtIdx === -1 || srcIdx === tgtIdx) return prev;
          const next = [...prev];
          next.splice(srcIdx, 1);
          next.splice(tgtIdx, 0, draggedKey);
          return next;
        });
        colDragRef.current.lastSwapTime = now;
        break;
      }
    };

    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";

      if (colDragRef.current?.isDragging) {
        suppressNextClickRef.current = true;
        requestAnimationFrame(() => { suppressNextClickRef.current = false; });
      }

      colDragRef.current = null;
      setDraggingColumnKey(null);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [isResizing]);

  // Column resize handler
  const handleResizeStart = useCallback((e: React.MouseEvent, columnKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    const startWidth = columnWidths[columnKey] ?? parseInt(colDef(columnKey).minWidth, 10);
    resizeRef.current = { columnKey, startX: e.clientX, startWidth };
    setIsResizing(true);
    setResizingColumnKey(columnKey);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!resizeRef.current) return;
      const delta = moveEvent.clientX - resizeRef.current.startX;
      const newWidth = Math.max(MIN_COL_WIDTH, resizeRef.current.startWidth + delta);
      setColumnWidths((prev) => ({ ...prev, [resizeRef.current!.columnKey]: newWidth }));
    };

    const handleMouseUp = () => {
      resizeRef.current = null;
      setIsResizing(false);
      setResizingColumnKey(null);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [columnWidths]);

  // Sort handler
  const handleSort = useCallback((key: string, direction: "asc" | "desc" | null) => {
    if (direction === null) {
      setSortConfig(null);
    } else {
      setSortConfig({ key, direction });
    }
    setCurrentPage(1);
  }, []);

  // Hide column handler
  const handleHideColumn = useCallback((columnKey: string) => {
    setColumnVisibility((prev) => ({ ...prev, [columnKey]: false }));
    setSortConfig((prev) => (prev?.key === columnKey ? null : prev));
    setFrozenColumns((prev) => {
      if (!prev.has(columnKey)) return prev;
      const next = new Set(prev);
      next.delete(columnKey);
      return next;
    });
  }, []);

  // Freeze column handler
  const handleFreezeColumn = useCallback((columnKey: string) => {
    setFrozenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(columnKey) && columnKey !== "item") {
        next.delete(columnKey);
      } else {
        next.add(columnKey);
      }
      return next;
    });
  }, []);

  // Sub-tab filtered
  const subTabFiltered = useMemo(() => {
    if (subTab === "sell") return allItems.filter((it) => it.tradeDirection === "sell" || it.tradeDirection === "both");
    if (subTab === "purchase") return allItems.filter((it) => it.tradeDirection === "purchase" || it.tradeDirection === "both");
    return allItems;
  }, [allItems, subTab]);

  // Quick filter counts
  const filterCounts = useMemo(() => {
    const c: Record<string, number> = { all: subTabFiltered.length };
    c["Active"] = subTabFiltered.filter((it) => it.status === "Active").length;
    c["Inactive"] = subTabFiltered.filter((it) => it.status === "Inactive").length;
    c["Serialized"] = subTabFiltered.filter((it) => it.itemControlType === "Serialized").length;
    c["Non-Serialized"] = subTabFiltered.filter((it) => it.itemControlType === "Non-Serialized").length;
    return c;
  }, [subTabFiltered]);

  // Apply filters + sort
  const filtered = useMemo(() => {
    let list = subTabFiltered;
    if (itemFilter === "Active") list = list.filter((it) => it.status === "Active");
    else if (itemFilter === "Inactive") list = list.filter((it) => it.status === "Inactive");
    else if (itemFilter === "Serialized") list = list.filter((it) => it.itemControlType === "Serialized");
    else if (itemFilter === "Non-Serialized") list = list.filter((it) => it.itemControlType === "Non-Serialized");

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (it) =>
          it.partNo.toLowerCase().includes(q) ||
          it.description.toLowerCase().includes(q) ||
          it.category.toLowerCase().includes(q) ||
          it.manufacturer.toLowerCase().includes(q) ||
          it.sku.toLowerCase().includes(q)
      );
    }

    // Sorting
    if (sortConfig) {
      list = [...list].sort((a, b) => {
        const dir = sortConfig.direction === "asc" ? 1 : -1;
        let aVal: string | number;
        let bVal: string | number;
        switch (sortConfig.key) {
          case "item": aVal = a.partNo; bVal = b.partNo; break;
          case "description": aVal = a.description; bVal = b.description; break;
          case "stock_status": aVal = a.stockStatus; bVal = b.stockStatus; break;
          case "item_type": aVal = a.itemType; bVal = b.itemType; break;
          case "control_type": aVal = a.itemControlType; bVal = b.itemControlType; break;
          case "category": aVal = a.category; bVal = b.category; break;
          case "on_hand": aVal = a.onHand; bVal = b.onHand; break;
          case "status": aVal = a.status; bVal = b.status; break;
          default: aVal = ""; bVal = "";
        }
        if (typeof aVal === "string" && typeof bVal === "string") {
          return dir * aVal.localeCompare(bVal);
        }
        return dir * ((aVal > bVal ? 1 : aVal < bVal ? -1 : 0));
      });
    }

    return list;
  }, [subTabFiltered, itemFilter, searchQuery, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / recordsPerPage));

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const paginated = filtered.slice((currentPage - 1) * recordsPerPage, currentPage * recordsPerPage);

  const allPageSelected = paginated.length > 0 && paginated.every((it) => selectedRows.has(it.id));
  const somePageSelected = paginated.some((it) => selectedRows.has(it.id));

  const handleSelectRow = useCallback((id: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        paginated.forEach((it) => next.delete(it.id));
      } else {
        paginated.forEach((it) => next.add(it.id));
      }
      return next;
    });
  }, [allPageSelected, paginated]);

  const existingItemIds = useMemo(() => new Set(allItems.map((it) => it.id)), [allItems]);

  const handleItemsAdded = useCallback((items: PartnerItemData[]) => {
    setAddedItems((prev) => [...items, ...prev]);
    const newIds = new Set(items.map((it) => it.id));
    setHighlightedIds(newIds);
    setItemFilter("all");
    setSearchQuery("");
    setCurrentPage(1);
    setTimeout(() => setHighlightedIds(new Set()), 3500);
  }, []);

  const handleItemRemoved = useCallback((id: string) => {
    setAddedItems((prev) => prev.filter((it) => it.id !== id));
    toast.success("Item removed");
  }, []);

  const highlightText = (text: string) => {
    if (!searchQuery.trim()) return text;
    const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <span key={i} className="bg-[#FEF08A] rounded-sm px-px">{part}</span>
      ) : (
        part
      )
    );
  };

  const QUICK_FILTERS: { key: ItemFilter; label: string; count: number }[] = [
    { key: "all", label: "All Items", count: filterCounts["all"] || 0 },
    { key: "Active", label: "Active", count: filterCounts["Active"] || 0 },
    { key: "Inactive", label: "Inactive", count: filterCounts["Inactive"] || 0 },
    { key: "Serialized", label: "Serialized", count: filterCounts["Serialized"] || 0 },
    { key: "Non-Serialized", label: "Non-Serialized", count: filterCounts["Non-Serialized"] || 0 },
  ];

  const getPageNumbers = () => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  // Total table width for fixed layout
  const tableWidth = CHECKBOX_COL_WIDTH + visibleColumns.reduce((sum, key) => sum + (columnWidths[key] ?? parseInt(colDef(key).minWidth, 10)), 0) + ACTIONS_COL_WIDTH;

  // Cell renderer for each dynamic column key
  const renderCell = (item: PartnerItemData, colKey: string) => {
    const isComfort = density === "comfort";
    switch (colKey) {
      case "item":
        return (
          <TableCell key={colKey}>
            <div className={`flex items-center ${isComfort ? "gap-3" : "gap-2.5"}`}>
              <div className={`${isComfort ? "w-9 h-9" : "w-7 h-7"} rounded-lg bg-[#F1F5F9] overflow-hidden shrink-0 border border-[#E8ECF1]`}>
                <img src={item.image} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="min-w-0">
                <span className={`${isComfort ? "text-[13.5px]" : "text-sm"} font-mono whitespace-nowrap block`} style={{ fontWeight: 500, color: '#1E293B' }}>
                  {highlightText(item.partNo)}
                </span>
                {isComfort && <span className="text-xs text-muted-foreground block">{item.manufacturer}</span>}
              </div>
            </div>
          </TableCell>
        );
      case "description":
        return (
          <TableCell key={colKey}>
            <div className="min-w-0">
              <p className={`${isComfort ? "text-[13px]" : "text-sm"} text-[#334155] truncate`} style={{ fontWeight: 400 }}>
                {highlightText(item.description)}
              </p>
              {isComfort && (
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                  SKU: {item.sku}
                </p>
              )}
            </div>
          </TableCell>
        );
      case "stock_status":
        return (
          <TableCell key={colKey}>
            <StockStatusDot status={item.stockStatus} />
          </TableCell>
        );
      case "item_type":
        return (
          <TableCell key={colKey}>
            <span className="text-[13px] text-[#334155] whitespace-nowrap">{item.itemType}</span>
          </TableCell>
        );
      case "control_type":
        return (
          <TableCell key={colKey}>
            <span className="text-[13px] text-[#334155] whitespace-nowrap">{item.itemControlType}</span>
          </TableCell>
        );
      case "category":
        return (
          <TableCell key={colKey}>
            <span className="text-[13px] text-[#334155] whitespace-nowrap">{highlightText(item.category)}</span>
          </TableCell>
        );
      case "additional_category":
        return (
          <TableCell key={colKey}>
            <div className="flex items-center gap-1">
              <CategoryPill label={item.additionalCategory} />
              {item.category !== item.additionalCategory && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-xs border cursor-default" style={{ fontWeight: 600, backgroundColor: "#F1F5F9", color: "#475569", borderColor: "#E2E8F0" }}>+1</span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="z-[300]">
                    <span className="text-[11px]">{item.category}</span>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </TableCell>
        );
      case "on_hand":
        return (
          <TableCell key={colKey} className="text-right !pr-3">
            <div className="text-right">
              <span className="text-[14px] text-[#334155] tabular-nums" style={{ fontWeight: 600 }}>
                {item.onHand.toLocaleString()}
              </span>
              <p className="text-[10px] text-muted-foreground mt-px" style={{ fontWeight: 400 }}>{item.onHandUnit}</p>
            </div>
          </TableCell>
        );
      case "alt_units":
        return (
          <TableCell key={colKey}>
            <span className="text-[13px] text-[#334155] whitespace-nowrap">{item.altUnits}</span>
          </TableCell>
        );
      case "inbound_location":
        return (
          <TableCell key={colKey}>
            <span className="text-[13px] text-[#334155] truncate block max-w-[180px]">{item.inboundLocation}</span>
          </TableCell>
        );
      case "outbound_location":
        return (
          <TableCell key={colKey}>
            <span className="text-[13px] text-[#334155] truncate block max-w-[180px]">{item.outboundLocation}</span>
          </TableCell>
        );
      case "acquisition":
        return (
          <TableCell key={colKey}>
            <div className="flex items-center gap-1 flex-wrap">
              {item.acquisitionMethods.map((m) => (
                <AcqBadge key={m} method={m} />
              ))}
            </div>
          </TableCell>
        );
      case "status":
        return (
          <TableCell key={colKey}>
            <StatusBadge status={item.status} />
          </TableCell>
        );
      default:
        return (<TableCell key={colKey}>{"\u2013"}</TableCell>);
    }
  };

  return (
    <>
      <div className={`bg-card overflow-clip flex flex-1 min-h-0 ${compact ? "elevated-z" : "border border-border rounded-xl"}`} style={compact ? undefined : { minHeight: 400 }}>
        <div className="flex-1 min-w-0 overflow-clip flex flex-col">

          {/* Header: Sub-tabs + Toolbar */}
          <div className="bg-card shrink-0">
            {/* Sub-tabs row — hidden when hideHeader is true */}
            {!hideHeader && (
            <div className="flex items-center justify-between gap-3 px-4 pt-2.5 pb-2 border-b border-border">
              <div className="inline-flex items-center rounded-lg bg-[#F1F5F9] p-0.5">
              {([
                { key: "sell" as SubTab, label: "Items They Sell", icon: Tag, color: "#1E40AF", bg: "#EFF6FF" },
                { key: "purchase" as SubTab, label: "Items They Purchase", icon: ShoppingCart, color: "#5B21B6", bg: "#F5F3FF" },
              ]).map((t) => {
                const isActive = subTab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => { setSubTab(t.key); setCurrentPage(1); }}
                    className={`inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-md text-[13px] transition-all cursor-pointer ${
                      isActive ? "bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)]" : "text-[#64748B] hover:text-[#334155]"
                    }`}
                    style={{ fontWeight: isActive ? 600 : 500, color: isActive ? t.color : undefined }}
                  >
                    <t.icon className="w-3.5 h-3.5" style={{ color: isActive ? t.color : "#94A3B8" }} />
                    {t.label}
                  </button>
                );
              })}
              </div>

              {/* Add Item Button — tinted CTA matching active sub-tab */}
              <button
                type="button"
                onClick={() => setAddModalOpen(true)}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-[13px] transition-colors cursor-pointer"
                style={{
                  fontWeight: 600,
                  backgroundColor: subTab === "sell" ? "#EFF6FF" : "#F5F3FF",
                  borderColor: subTab === "sell" ? "#BFDBFE" : "#DDD6FE",
                  color: subTab === "sell" ? "#1E40AF" : "#5B21B6",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = subTab === "sell" ? "#DBEAFE" : "#EDE9FE"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = subTab === "sell" ? "#EFF6FF" : "#F5F3FF"; }}
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{subTab === "sell" ? "Add Items They Sell" : "Add Items They Purchase"}</span>
              </button>
            </div>
            )}

            {/* Toolbar row: Search + Filters ... Count + Density + ColumnSelector */}
            <div className="flex items-center justify-between gap-3 px-4 py-2">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
                <Input
                  placeholder="Search items..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  className="pl-9 pr-8 h-9 text-sm bg-white border-border/80 shadow-sm placeholder:text-muted-foreground/50 focus-visible:border-primary focus-visible:ring-primary/20"
                />
                {searchQuery && (
                  <button
                    onClick={() => { setSearchQuery(""); setCurrentPage(1); }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => toast.info("Advanced filters coming soon!")}
                className="inline-flex items-center justify-center h-9 gap-1.5 px-3 rounded-lg border border-border/80 bg-white shadow-sm hover:bg-muted/50 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50 shrink-0 text-foreground"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-sm" style={{ fontWeight: 500 }}>Filters</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-sm tabular-nums mr-1 hidden sm:inline" style={{ fontWeight: 500 }}>
                {filtered.length !== allItems.length ? (
                  <>
                    <span className="text-foreground">{filtered.length}</span>
                    <span className="text-muted-foreground/60"> of </span>
                    <span className="text-muted-foreground">{allItems.length}</span>
                    <span className="text-muted-foreground/70"> items</span>
                  </>
                ) : (
                  <>
                    <span className="text-foreground">{allItems.length}</span>
                    <span className="text-muted-foreground/70"> items</span>
                  </>
                )}
              </span>

              <div className="w-px h-5 bg-border/60 mx-0.5 hidden sm:block" />

              {!compact && (
              <>
              {/* Density dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center h-9 gap-2 px-3 rounded-lg border border-border bg-white text-foreground shadow-sm hover:bg-muted/40 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    {density === "condensed" && <AlignJustify className="w-[18px] h-[18px] text-muted-foreground/80" />}
                    {density === "comfort" && <ListIcon className="w-[18px] h-[18px] text-muted-foreground/80" />}
                    {density === "card" && <LayoutGrid className="w-[18px] h-[18px] text-muted-foreground/80" />}
                    <span className="text-sm hidden md:inline" style={{ fontWeight: 500 }}>
                      {DENSITY_CONFIG.find((d) => d.key === density)?.label}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/60" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[230px] p-1.5">
                  {DENSITY_CONFIG.map((opt) => (
                    <DropdownMenuItem
                      key={opt.key}
                      className="flex items-center gap-3 py-2.5 px-3 cursor-pointer rounded-md"
                      onSelect={() => setDensity(opt.key)}
                    >
                      {opt.icon === "align-justify" && <AlignJustify className="w-5 h-5 text-muted-foreground shrink-0" />}
                      {opt.icon === "list" && <ListIcon className="w-5 h-5 text-muted-foreground shrink-0" />}
                      {opt.icon === "layout-grid" && <LayoutGrid className="w-5 h-5 text-muted-foreground shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm" style={{ fontWeight: 500 }}>{opt.label}</p>
                        <p className="text-xs text-muted-foreground">{opt.description}</p>
                      </div>
                      {density === opt.key && <Check className="w-4 h-4 text-primary shrink-0" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Column Selector Trigger */}
              <ColumnSelectorTrigger
                visibleCount={visibleColumns.length}
                active={columnDrawerOpen}
                onClick={() => setColumnDrawerOpen(!columnDrawerOpen)}
              />
              </>
              )}

              {/* Add Item — shown in compact mode */}
              {compact && (
                <button
                  type="button"
                  onClick={() => setAddModalOpen(true)}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-[#0A77FF] hover:bg-[#0862D0] text-white text-sm shadow-sm transition-colors cursor-pointer"
                  style={{ fontWeight: 600 }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Item
                </button>
              )}
            </div>
          </div>

          {/* Quick Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto px-4 pb-3 shrink-0">
            {QUICK_FILTERS.map((f) => {
              const isActive = itemFilter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => { setItemFilter(f.key); setCurrentPage(1); }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? "border-primary bg-[#EDF4FF] hover:bg-[#D6E8FF] active:bg-[#ADD1FF]"
                      : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30 active:bg-muted"
                  }`}
                  style={{ fontWeight: isActive ? 500 : 400, color: isActive ? "#0A77FF" : undefined }}
                >
                  {f.label}
                  <span
                    className={`text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center ${isActive ? "bg-primary/10" : "bg-muted"}`}
                    style={{ fontWeight: 600, color: isActive ? "#0A77FF" : "#475569" }}
                  >
                    {f.count}
                  </span>
                </button>
              );
            })}
          </div>
          </div>

          {/* Content */}
          {density === "card" && !compact ? (
            /* Card View */
            <div className="p-4 min-h-0 overflow-y-auto flex-1">
              {paginated.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
                  <Package className="w-8 h-8" />
                  <p className="text-sm">No items found</p>
                  {searchQuery && (
                    <Button variant="link" size="sm" onClick={() => { setSearchQuery(""); setCurrentPage(1); }}>
                      Clear search
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                  {paginated.map((item) => {
                    const isHighlighted = highlightedIds.has(item.id);
                    return (
                      <div
                        key={item.id}
                        className={`bg-white border rounded-xl cursor-pointer hover:shadow-[0_4px_16px_-4px_rgba(10,119,255,0.10),0_1px_3px_-1px_rgba(0,0,0,0.04)] hover:border-[#93B8F7]/50 transition-all duration-200 group/card flex flex-col overflow-hidden ${
                          isHighlighted
                            ? "border-[#0A77FF] shadow-[0_0_0_2px_rgba(10,119,255,0.15)]"
                            : "border-[#E2E8F0]"
                        }`}
                      >
                        {/* Image banner — location card style (160px) */}
                        <div className="relative w-full h-[160px] overflow-hidden bg-[#F1F5F9]">
                          <img src={item.image} alt="" className="w-full h-full object-cover transition-transform duration-300 group-hover/card:scale-105" />
                          {/* Bottom-left: Status + Control pills on image */}
                          <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 z-10">
                            {isHighlighted && (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] tracking-wider uppercase shadow-sm backdrop-blur-sm"
                                style={{ fontWeight: 700, backgroundColor: "rgba(10,119,255,0.9)", color: "#fff" }}
                              >
                                <Sparkles className="w-3 h-3" />
                                NEW
                              </span>
                            )}
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] shadow-sm backdrop-blur-sm border"
                              style={{
                                fontWeight: 600,
                                backgroundColor: item.stockStatus === "In Stock" ? "rgba(236,253,245,0.92)" : item.stockStatus === "Low Stock" ? "rgba(255,251,235,0.92)" : "rgba(254,242,242,0.92)",
                                color: STOCK_STATUS_STYLES[item.stockStatus]?.color || "#065F46",
                                borderColor: STOCK_STATUS_STYLES[item.stockStatus]?.border || "#A7F3D0",
                              }}
                            >
                              {item.stockStatus}
                            </span>
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] shadow-sm backdrop-blur-sm border"
                              style={{
                                fontWeight: 500,
                                backgroundColor: "rgba(241,245,249,0.92)",
                                color: "#334155",
                                borderColor: "#CBD5E1",
                              }}
                            >
                              {item.itemControlType}
                            </span>
                          </div>
                          {/* 3-dot menu on image */}
                          <div className="absolute top-2.5 right-2.5">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  className="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-white/80 backdrop-blur-sm text-[#475569] opacity-0 group-hover/card:opacity-100 hover:bg-white hover:text-[#0F172A] transition-all cursor-pointer shadow-sm"
                                >
                                  <MoreHorizontal className="w-4 h-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className={compact ? "z-[230]" : ""} onClick={(e) => e.stopPropagation()}>
                                <DropdownMenuItem onClick={() => toast.info("View item details coming soon!")}>
                                  <Eye className="w-4 h-4 mr-2" /> View Details
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-[#DC2626] focus:text-[#DC2626] focus:bg-[#FEF2F2]" onClick={() => setRemoveConfirmId(item.id)}>
                                  <Trash2 className="w-4 h-4 mr-2 text-[#DC2626]" /> Remove Item
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>

                        {/* Card Body */}
                        <div className="flex flex-col flex-1">
                          {/* Title + Manufacturer */}
                          <div className="px-3.5 pt-2.5 pb-0">
                            <p className="text-[14px] text-[#334155] truncate" style={{ fontWeight: 600, lineHeight: "20px" }}>{item.description}</p>
                            <p className="text-[12px] text-[#64748B] truncate mt-0.5" style={{ lineHeight: "18px" }}>
                              <span className="text-[#0A77FF] font-mono" style={{ fontWeight: 600 }}>{item.partNo}</span>
                              <span className="text-[#CBD5E1] mx-1.5">·</span>
                              {item.manufacturer}
                            </p>
                          </div>

                          {/* Stats — inline compact row (like location card) */}
                          <div className="px-3.5 pt-3 pb-3 flex-1 flex items-end">
                            <div className="flex items-center gap-3 text-[11.5px]">
                              <div className="flex items-center gap-1">
                                <Package className="w-3 h-3 text-[#94A3B8]" />
                                <span className="text-[#334155] tabular-nums" style={{ fontWeight: 600 }}>{item.onHand.toLocaleString()}</span>
                                <span className="text-[#94A3B8] text-[10px]">{item.onHandUnit}</span>
                              </div>
                              <div className="w-px h-3 bg-[#E2E8F0]" />
                              <div className="flex items-center gap-1">
                                {item.acquisitionMethods.map((m) => <AcqBadge key={m} method={m} />)}
                              </div>
                            </div>
                          </div>

                          {/* Footer — categories + status */}
                          <div className="px-3.5 py-2.5 border-t border-[#F1F5F9] flex items-center justify-between">
                            <div className="flex items-center gap-1 min-w-0">
                              <CategoryPill label={item.category} />
                              {item.additionalCategory !== item.category && <CategoryPill label={item.additionalCategory} />}
                            </div>
                            <StatusBadge status={item.status} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Table View — Condensed / Comfort */
            <div className={`min-h-0 overflow-auto flex-1 ${isResizing || draggingColumnKey ? "select-none" : ""}`}>
              <Table style={{ tableLayout: "fixed", width: `${tableWidth}px` }}>
                <TableHeader className="sticky top-0 z-20 bg-card">
                  <TableRow className={`bg-muted/30 hover:bg-muted/30 ${density === "condensed" ? "[&>th]:h-8" : "[&>th]:h-9"}`}>
                    {/* Checkbox column — sticky leftmost */}
                    <TableHead
                      className="sticky left-0 z-20 bg-[#f8fafc] w-[40px] min-w-[40px] max-w-[40px] !pl-2 !pr-0"
                    >
                      <Checkbox
                        checked={allPageSelected ? true : somePageSelected ? "indeterminate" : false}
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all rows"
                      />
                    </TableHead>
                    {/* Dynamic columns */}
                    {visibleColumns.map((key) => {
                      const def = colDef(key);
                      const isFrozen = frozenColumns.has(key);
                      const isLocked = LOCKED_COLUMNS.includes(key);
                      const isDraggable = !isLocked;
                      const currentColSort: "asc" | "desc" | null =
                        sortConfig?.key === key ? sortConfig.direction : null;
                      const width = columnWidths[key] ?? parseInt(def.minWidth, 10);
                      const isBeingDragged = draggingColumnKey === key;

                      return (
                        <TableHead
                          key={key}
                          data-col-drag-key={key}
                          onMouseDown={isDraggable ? (e) => handleHeaderMouseDown(e, key) : undefined}
                          onClickCapture={isDraggable ? (e) => {
                            if (suppressNextClickRef.current) {
                              e.stopPropagation();
                              e.preventDefault();
                            }
                          } : undefined}
                          className={`whitespace-nowrap relative group/colheader ${isFrozen ? "sticky bg-[#f8fafc] z-20" : ""} ${isDraggable ? "cursor-grab" : ""} ${def.align === "right" ? "text-right" : ""}`}
                          style={{
                            width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px`,
                            overflow: "hidden",
                            ...(isFrozen ? { left: `${frozenOffsets[key] ?? 0}px` } : {}),
                            ...(key === lastFrozenKey && !isBeingDragged ? { boxShadow: "inset -1px 0 0 0 rgba(0,0,0,0.08), 3px 0 6px -2px rgba(0,0,0,0.06)" } : {}),
                            ...(isBeingDragged ? {
                              background: "linear-gradient(180deg, rgba(10,119,255,0.08) 0%, rgba(10,119,255,0.03) 100%)",
                            } : {}),
                          }}
                        >
                          {/* Blue accent bar on top edge of dragged column header */}
                          {isBeingDragged && (
                            <div className="absolute top-0 left-0 right-0 h-[2px] rounded-b-full" style={{ backgroundColor: "#0A77FF" }} />
                          )}
                          {/* Drag grip icon */}
                          {isDraggable && (
                            <GripVertical className={`absolute left-1 top-1/2 -translate-y-1/2 w-3 h-3 transition-opacity z-[5] pointer-events-none ${isBeingDragged ? "opacity-100 text-primary" : "opacity-0 group-hover/colheader:opacity-100 text-muted-foreground/40"}`} />
                          )}

                          <div className={`flex items-center ${def.align === "right" ? "w-full" : ""}`}>
                            <ColumnHeaderMenu
                              columnKey={key}
                              label={def.label}
                              sortable={def.sortable}
                              sortConfig={sortConfig}
                              onSort={handleSort}
                              onAddFilter={() => {}}
                              onHideColumn={handleHideColumn}
                              onFreezeColumn={handleFreezeColumn}
                              isFrozen={isFrozen}
                              isLocked={isLocked}
                              hasActiveFilter={false}
                            >
                              <div className={`inline-flex items-center gap-1 ${def.align === "right" ? "w-full justify-end" : ""}`}>
                                <span className="text-[13px]" style={currentColSort ? { color: "#0A77FF" } : undefined}>{def.label}</span>
                                {currentColSort === "asc" && (
                                  <ArrowUp className="w-3 h-3 shrink-0" style={{ color: "#0A77FF" }} />
                                )}
                                {currentColSort === "desc" && (
                                  <ArrowDown className="w-3 h-3 shrink-0" style={{ color: "#0A77FF" }} />
                                )}
                                {!currentColSort && def.sortable && (
                                  <ArrowUpDown className="w-3 h-3 shrink-0 text-muted-foreground opacity-0 group-hover/colheader:opacity-100 transition-opacity" />
                                )}
                              </div>
                            </ColumnHeaderMenu>
                          </div>

                          {/* Resize handle — right edge */}
                          <div
                            onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(e, key); }}
                            onClick={(e) => e.stopPropagation()}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              setColumnWidths((prev) => ({
                                ...prev,
                                [key]: parseInt(def.minWidth, 10),
                              }));
                            }}
                            className="absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize z-10 group/resize"
                            style={{ touchAction: "none" }}
                          >
                            <div className={`absolute right-0 top-1 bottom-1 w-[2px] rounded-full transition-colors ${resizingColumnKey === key ? "bg-primary" : "bg-transparent group-hover/resize:bg-primary/40"}`} />
                          </div>
                        </TableHead>
                      );
                    })}
                    {/* Actions column — sticky right */}
                    <TableHead className="whitespace-nowrap w-[60px] sticky right-0 bg-[#f8fafc] z-20 !pl-2 !pr-2" style={{ boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.08)" }}>
                      <span className="text-[13px]">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={visibleColumns.length + 2} className="text-center py-16 text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <Package className="w-8 h-8" />
                          <p className="text-sm">No items found</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginated.map((item) => {
                      const isHighlighted = highlightedIds.has(item.id);
                      const isComfort = density === "comfort";
                      return (
                        <TableRow
                          key={item.id}
                          className={`group hover:bg-[#F0F7FF] ${
                            isComfort
                              ? "[&>td]:py-2 [&>td]:pl-3 [&>td]:pr-2"
                              : "[&>td]:py-1 [&>td]:pl-3 [&>td]:pr-2"
                          } ${isHighlighted ? "animate-row-flash bg-[#EDF4FF]/60" : ""}`}
                        >
                          {/* Checkbox cell — sticky leftmost */}
                          <TableCell
                            className="sticky left-0 z-10 bg-card group-hover:bg-[#F0F7FF] w-[40px] min-w-[40px] max-w-[40px] !pl-2 !pr-0"
                          >
                            <Checkbox
                              checked={selectedRows.has(item.id)}
                              onCheckedChange={() => handleSelectRow(item.id)}
                              onClick={(e) => e.stopPropagation()}
                              aria-label={`Select ${item.partNo}`}
                            />
                          </TableCell>
                          {visibleColumns.map((key) => {
                            const cell = renderCell(item, key);
                            const w = columnWidths[key] ?? parseInt(colDef(key).minWidth, 10);
                            const isDraggedCol = draggingColumnKey === key;
                            const cellWidthStyle: React.CSSProperties = {
                              width: `${w}px`, minWidth: `${w}px`, maxWidth: `${w}px`, overflow: "hidden", textOverflow: "ellipsis",
                              ...(isDraggedCol ? {
                                backgroundColor: "rgba(10,119,255,0.035)",
                              } : {}),
                            };
                            if (frozenColumns.has(key)) {
                              const defAlign = colDef(key).align;
                              return cloneElement(cell, {
                                className: `${cell.props.className || ""} sticky z-10 bg-card group-hover:bg-[#F0F7FF] ${defAlign === "right" ? "text-right" : ""}`.trim(),
                                style: {
                                  ...cell.props.style,
                                  ...cellWidthStyle,
                                  left: `${frozenOffsets[key] ?? 0}px`,
                                  ...(key === lastFrozenKey ? { boxShadow: "inset -1px 0 0 0 rgba(0,0,0,0.08), 3px 0 6px -2px rgba(0,0,0,0.06)" } : {}),
                                },
                              });
                            }
                            const defAlign = colDef(key).align;
                            return cloneElement(cell, {
                              className: `${cell.props.className || ""} ${defAlign === "right" ? "text-right" : ""}`.trim(),
                              style: { ...cell.props.style, ...cellWidthStyle },
                            });
                          })}
                          {/* Actions — always last, always sticky */}
                          <TableCell className="sticky right-0 bg-card group-hover:bg-[#F0F7FF] z-10 !pl-2 !pr-2" style={{ boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.08)" }}>
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                asChild
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors cursor-pointer"
                                >
                                  <MoreHorizontal className="w-4 h-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                className={`w-[180px] ${compact ? "z-[230]" : ""}`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <DropdownMenuItem onClick={() => toast.info("View Details — coming soon")}>
                                  <Eye className="w-4 h-4 mr-2" /> View Details
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-[#DC2626] focus:text-[#DC2626] focus:bg-[#FEF2F2]"
                                  onClick={() => setRemoveConfirmId(item.id)}
                                >
                                  <Trash2 className="w-4 h-4 mr-2 text-[#DC2626]" /> Remove Item
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination — partner listing style */}
          {filtered.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-center px-4 py-3 border-t border-border gap-3 shrink-0">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Records per page</span>
                <Select
                  value={String(recordsPerPage)}
                  onValueChange={(val) => {
                    setRecordsPerPage(Number(val));
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-[70px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(1)}
                >
                  <ChevronsLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1 text-sm text-muted-foreground"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Prev
                </Button>

                {getPageNumbers().map((page, idx) =>
                  page === "..." ? (
                    <span key={`dots-${idx}`} className="px-1 text-sm text-muted-foreground">
                      ...
                    </span>
                  ) : (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "ghost"}
                      size="sm"
                      className={`h-8 w-8 p-0 text-sm ${
                        currentPage === page
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground"
                      }`}
                      onClick={() => setCurrentPage(page as number)}
                    >
                      {page}
                    </Button>
                  )
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1 text-sm text-muted-foreground"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                >
                  <ChevronsRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Column Selector Side Drawer — hidden in compact mode */}
        {!compact && (
        <ColumnSelector
          columns={ITEM_COLUMN_DEFS}
          columnOrder={columnOrder}
          columnVisibility={columnVisibility}
          onColumnOrderChange={setColumnOrder}
          onColumnVisibilityChange={setColumnVisibility}
          lockedColumns={LOCKED_COLUMNS}
          open={columnDrawerOpen}
          onOpenChange={setColumnDrawerOpen}
        />
        )}
      </div>

      {/* Column drag ghost — positioned via ref for zero re-renders during mousemove */}
      {createPortal(
        <div
          ref={ghostElRef}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            zIndex: 9999,
            pointerEvents: "none",
            opacity: draggingColumnKey ? 1 : 0,
            transition: "opacity 80ms ease-out",
            willChange: "transform",
          }}
        >
          {draggingColumnKey && (() => {
            const ghostSort = sortConfig?.key === draggingColumnKey ? sortConfig.direction : null;
            return (
              <div
                className="flex items-center gap-1.5 h-[32px] pl-2 pr-3 rounded-md whitespace-nowrap"
                style={{
                  marginLeft: 12,
                  marginTop: -14,
                  backgroundColor: "rgba(255,255,255,0.92)",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                  border: "1px solid rgba(10,119,255,0.3)",
                  boxShadow: "0 1px 3px rgba(10,119,255,0.08), 0 6px 20px rgba(0,0,0,0.10)",
                }}
              >
                <GripVertical className="w-3 h-3 shrink-0" style={{ color: "#0A77FF" }} />
                <span className="text-[13px]" style={{ color: "#0A77FF", fontWeight: 500 }}>
                  {colDef(draggingColumnKey)?.label}
                </span>
                {ghostSort === "asc" && <ArrowUp className="w-3 h-3 shrink-0" style={{ color: "#0A77FF" }} />}
                {ghostSort === "desc" && <ArrowDown className="w-3 h-3 shrink-0" style={{ color: "#0A77FF" }} />}
              </div>
            );
          })()}
        </div>,
        document.body
      )}

      {/* Add Item Modal */}
      <AddItemModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        existingItemIds={existingItemIds}
        existingItems={allItems}
        onItemsAdded={handleItemsAdded}
        onItemRemoved={handleItemRemoved}
        activeSubTab={subTab}
        generic={compact}
        contextLabel={contextLabel}
        contextType={contextType}
      />

      {/* Remove item confirmation — gradient style */}
      <AlertDialog open={!!removeConfirmId} onOpenChange={(open) => { if (!open) setRemoveConfirmId(null); }}>
        <AlertDialogContent
          className={`sm:max-w-[400px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)] ${compact ? "z-[240]" : ""}`}
          overlayClassName={compact ? "z-[235]" : undefined}
          onInteractOutside={() => setRemoveConfirmId(null)}
        >
          {(() => {
            const removeItem = removeConfirmId ? allItems.find((it) => it.id === removeConfirmId) : null;
            return (
              <>
                {/* Gradient header */}
                <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #FEF2F2 0%, rgba(254,242,242,0.3) 70%, transparent 100%)" }}>
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#EF4444" }} />
                  <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#FEE2E2" }}>
                    <AlertTriangle className="w-8 h-8" style={{ color: "#DC2626" }} />
                  </div>
                  <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: "#FEF2F2", color: "#991B1B", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
                    Caution
                  </span>
                </div>
                {/* Content */}
                <div className="flex flex-col items-center text-center px-8 pb-8">
                  <AlertDialogHeader className="p-0 gap-0 text-center">
                    <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "#0F172A" }}>
                      Remove this item?
                    </AlertDialogTitle>
                  </AlertDialogHeader>
                  <AlertDialogDescription className="text-[13px] mt-2 max-w-[300px] mx-auto" style={{ color: "#475569", lineHeight: "1.65" }}>
                    {removeItem && (
                      <>
                        <span style={{ fontWeight: 600, color: "#1E293B" }}>{removeItem.partNo}</span>
                        {" "}will be removed{compact ? "" : ` from ${subTab === "sell" ? "items they sell" : "items they purchase"}`}. You can add it back later from the inventory.
                      </>
                    )}
                  </AlertDialogDescription>
                  <div className="w-full mt-7 flex flex-col gap-2.5">
                    <AlertDialogAction
                      onClick={() => {
                        if (removeConfirmId) {
                          handleItemRemoved(removeConfirmId);
                          setRemoveConfirmId(null);
                        }
                      }}
                      className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                      style={{ fontWeight: 600, backgroundColor: "#DC2626", color: "#fff" }}
                    >
                      Remove Item
                    </AlertDialogAction>
                    <AlertDialogCancel
                      className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                      style={{ fontWeight: 500, backgroundColor: "#F1F5F9", color: "#334155" }}
                    >
                      Cancel
                    </AlertDialogCancel>
                  </div>
                </div>
              </>
            );
          })()}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
