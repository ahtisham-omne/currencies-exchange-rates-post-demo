// @ts-nocheck
import React, { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Upload, 
  Search, 
  Check, 
  CheckCircle2, 
  Paperclip,
  Cpu,
  Wrench,
  Cog,
  Zap,
  Wind,
  Shield,
  Factory,
  Package,
  Layers,
  Box,
  CircleDot,
  Info,
  Star,
  File as FileIcon,
  Trash2,
  FileText,
  Image as ImageIcon,
  Settings2,
  Users,
  BarChart3,
  AlertTriangle,
  DollarSign,
  Truck,
  ArrowRight,
  TrendingUp,
  Barcode,
  MapPin,
  Clock,
  Link as LinkIcon,
  Lightbulb,
  Tags,
  Globe,
  Lock,
  QrCode,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  ClipboardList,
  Activity,
  Archive,
  ShoppingCart,
  ArrowLeft,
  UserCircle2,
  ChevronUp,
  AlertCircle,
  Plus,
  Eye,
  Warehouse,
  Boxes,
  Building2,
  Receipt,
  Gavel,
  FileImage,
  FileSpreadsheet,
  FileCode,
  FileArchive,
  RefreshCw,
  LayoutTemplate,
  Tag,
  ScanLine,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Switch } from '../ui/switch';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import { InitialAvatar } from '../items-v3/InitialAvatar';
import { ItemStatusBadge } from '../items-v3/ItemStatusBadge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../ui/popover";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../ui/tabs";
import { cn } from '../../../lib/utils';
import { AddQualifiedVendorDialog } from './AddQualifiedVendorDialog';
import { QualifiedVendorsTab } from './QualifiedVendorsTab';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
// Info already imported from lucide-react above (line 22)
import { ItemDefinitionSummaryStrip, StockLogisticsSummaryStrip, ProcurementSummaryStrip, SellingSummaryStrip, CycleCountingSummaryStrip } from './ConfigSummaryStrips';
import { MaterialHandlingSection } from './MaterialHandlingSection';
import { CategoryChipsRow } from './CategoryChipsRow';
// Slice render-path unification — shared section components mounted by both
// CreateItemModal (Step 2 → Customize Configuration) AND ItemConfigurationMaster
// (Detail page → Configurations tab). Single source of truth for tab bodies.
import { ItemDefinitionSection } from './ItemDefinitionSection';
import { StockLogisticsSection } from './StockLogisticsSection';
import { ProcurementSection } from './ProcurementSection';
import { SellingSection } from './SellingSection';
import { GovernanceSection } from './GovernanceSection';

// --- Mock Data & Constants ---

const generateCategories = () => {
  const icons = [Cpu, Wrench, Cog, Zap, Wind, Shield, Factory, Package, Layers, Box, CircleDot];
  const categories = [];
  
  const baseCategories = [
    { name: 'Electronics', desc: 'Circuit boards, sensors, and electronic components.' },
    { name: 'Hardware', desc: 'Nuts, bolts, screws, and other fasteners.' },
    { name: 'Mechanical', desc: 'Gears, bearings, shafts, and mechanical parts.' },
    { name: 'Motors', desc: 'AC/DC motors, servos, and steppers.' },
    { name: 'Pneumatics', desc: 'Cylinders, valves, air hoses, and fittings.' },
    { name: 'Safety', desc: 'PPE, guards, sensors, and safety equipment.' },
    { name: 'Raw Materials', desc: 'Steel, aluminum, plastic stock, and raw sheets.' },
    { name: 'Hydraulics', desc: 'Pumps, hoses, fluids, and hydraulic cylinders.' },
    { name: 'Tools', desc: 'Hand tools, power tools, and machining bits.' },
    { name: 'Consumables', desc: 'Lubricants, glues, tape, and cleaning supplies.' },
  ];

  for (let i = 0; i < 50; i++) {
    const base = baseCategories[i % baseCategories.length];
    categories.push({
      id: `cat-${i + 1}`,
      name: i < 10 ? base.name : `${base.name} - Type ${Math.floor(i / 10)}`,
      description: base.desc,
      icon: icons[i % icons.length],
      count: Math.floor(Math.random() * 1000) + 50
    });
  }
  return categories;
};

const CATEGORIES = generateCategories();

// Mock items associated with each category
const CATEGORY_ITEMS: Record<string, Array<{ id: string; partNumber: string; description: string; status: string }>> = {
  'cat-1': [
    { id: 'item-1', partNumber: 'ELEC-001', description: 'Arduino Uno R3 Microcontroller Board', status: 'Active' },
    { id: 'item-2', partNumber: 'ELEC-002', description: 'DHT22 Temperature & Humidity Sensor', status: 'Active' },
    { id: 'item-3', partNumber: 'ELEC-003', description: 'HC-SR04 Ultrasonic Distance Sensor', status: 'Active' },
    { id: 'item-4', partNumber: 'ELEC-004', description: 'L298N Dual H-Bridge Motor Driver', status: 'Active' },
    { id: 'item-5', partNumber: 'ELEC-005', description: '16x2 LCD Display Module with I2C', status: 'Inactive' },
  ],
  'cat-2': [
    { id: 'item-6', partNumber: 'HW-001', description: 'M6 x 20mm Hex Bolt - Stainless Steel', status: 'Active' },
    { id: 'item-7', partNumber: 'HW-002', description: 'M8 Lock Washer - Zinc Plated', status: 'Active' },
    { id: 'item-8', partNumber: 'HW-003', description: 'M10 Nyloc Nut - Grade 8', status: 'Active' },
  ],
  'cat-3': [
    { id: 'item-9', partNumber: 'MECH-001', description: '608 Deep Groove Ball Bearing', status: 'Active' },
    { id: 'item-10', partNumber: 'MECH-002', description: '20T Spur Gear - 5mm Bore', status: 'Active' },
    { id: 'item-11', partNumber: 'MECH-003', description: '12mm Linear Shaft - 400mm Length', status: 'Active' },
    { id: 'item-12', partNumber: 'MECH-004', description: 'GT2 Timing Belt - 6mm Width', status: 'Inactive' },
  ],
  'cat-4': [
    { id: 'item-13', partNumber: 'MOT-001', description: 'NEMA 17 Stepper Motor - 1.8° Step', status: 'Active' },
    { id: 'item-14', partNumber: 'MOT-002', description: '12V DC Brushless Motor - 5000 RPM', status: 'Active' },
    { id: 'item-15', partNumber: 'MOT-003', description: 'SG90 Micro Servo Motor - 180°', status: 'Active' },
    { id: 'item-16', partNumber: 'MOT-004', description: '24V AC Induction Motor - 3-Phase', status: 'Active' },
    { id: 'item-17', partNumber: 'MOT-005', description: 'High Torque Gearbox Motor - 12V', status: 'Inactive' },
  ],
  'cat-5': [
    { id: 'item-18', partNumber: 'PNEU-001', description: 'Double Acting Air Cylinder - 50mm Bore', status: 'Active' },
    { id: 'item-19', partNumber: 'PNEU-002', description: '5/2 Way Solenoid Valve - 24V DC', status: 'Active' },
    { id: 'item-20', partNumber: 'PNEU-003', description: 'Polyurethane Air Hose - 8mm OD', status: 'Active' },
  ],
  'cat-6': [
    { id: 'item-21', partNumber: 'SAFE-001', description: 'Safety Glasses - Anti-Fog Coating', status: 'Active' },
    { id: 'item-22', partNumber: 'SAFE-002', description: 'Cut Resistant Gloves - Level 5', status: 'Active' },
    { id: 'item-23', partNumber: 'SAFE-003', description: 'Emergency Stop Button - Red 40mm', status: 'Active' },
    { id: 'item-24', partNumber: 'SAFE-004', description: 'Light Curtain Safety Sensor - Type 4', status: 'Active' },
  ],
  'cat-7': [
    { id: 'item-25', partNumber: 'RAW-001', description: 'Aluminum Sheet 6061-T6 - 4x8ft', status: 'Active' },
    { id: 'item-26', partNumber: 'RAW-002', description: 'Carbon Steel Round Bar - 25mm Dia', status: 'Active' },
    { id: 'item-27', partNumber: 'RAW-003', description: 'ABS Plastic Sheet - 3mm Thickness', status: 'Active' },
  ],
  'cat-8': [
    { id: 'item-28', partNumber: 'HYD-001', description: 'Hydraulic Gear Pump - 16 GPM', status: 'Active' },
    { id: 'item-29', partNumber: 'HYD-002', description: 'Hydraulic Cylinder - 3" Bore x 12" Stroke', status: 'Active' },
    { id: 'item-30', partNumber: 'HYD-003', description: 'High Pressure Hose - 1/2" SAE 100R2', status: 'Active' },
  ],
  'cat-9': [
    { id: 'item-31', partNumber: 'TOOL-001', description: 'Digital Caliper - 0-150mm Range', status: 'Active' },
    { id: 'item-32', partNumber: 'TOOL-002', description: 'Torque Wrench - 10-150 Nm', status: 'Active' },
    { id: 'item-33', partNumber: 'TOOL-003', description: 'Cordless Drill - 18V Lithium', status: 'Active' },
    { id: 'item-34', partNumber: 'TOOL-004', description: 'End Mill Set - 4 Flute HSS', status: 'Inactive' },
  ],
  'cat-10': [
    { id: 'item-35', partNumber: 'CONS-001', description: 'Industrial Lubricant - 5L Container', status: 'Active' },
    { id: 'item-36', partNumber: 'CONS-002', description: 'Thread Locker - Medium Strength', status: 'Active' },
    { id: 'item-37', partNumber: 'CONS-003', description: 'Industrial Tape - 2" x 60yd', status: 'Active' },
  ],
};

const STATUS_OPTIONS = [
  { value: 'Active', label: 'Active', description: 'Item is currently in use, available for sale, or included in ongoing projects.' },
  { value: 'Draft', label: 'Draft', description: 'Item is in R&D or review. Neither active nor inactive.' },
  { value: 'Inactive', label: 'Inactive', description: 'Item is no longer in use, discontinued, or temporarily taken out of circulation.' }
];

const MOCK_USERS = [
  { id: 'u1', name: 'Alice Smith', role: 'Engineer', initials: 'AS', color: 'bg-blue-100 text-blue-700' },
  { id: 'u2', name: 'Bob Jones', role: 'Purchasing', initials: 'BJ', color: 'bg-green-100 text-green-700' },
  { id: 'u3', name: 'Charlie Day', role: 'Scheduler', initials: 'CD', color: 'bg-amber-100 text-amber-700' },
  { id: 'u4', name: 'Diana Prince', role: 'Sales', initials: 'DP', color: 'bg-purple-100 text-purple-700' },
  { id: 'u5', name: 'Evan Peters', role: 'Finance', initials: 'EP', color: 'bg-rose-100 text-rose-700' },
  { id: 'u6', name: 'Frank Reynolds', role: 'Manager', initials: 'FR', color: 'bg-slate-100 text-slate-700' },
  { id: 'u7', name: 'Grace Hopper', role: 'QA', initials: 'GH', color: 'bg-cyan-100 text-cyan-700' },
];

const generatePartners = () => {
    const partners = [
        { id: 'p1', name: 'Acme Corp' },
        { id: 'p2', name: 'Globex Inc' },
        { id: 'p3', name: 'Soylent Corp' },
        { id: 'p4', name: 'Initech' },
        { id: 'p5', name: 'Umbrella Corp' },
        { id: 'p6', name: 'Stark Ind' },
        { id: 'p7', name: 'Cyberdyne Systems' },
        { id: 'p8', name: 'Wayne Enterprises' },
        { id: 'p9', name: 'Massive Dynamic' },
        { id: 'p10', name: 'Hooli' },
        { id: 'p11', name: 'Vehement Capital' },
        { id: 'p12', name: 'Pied Piper' },
        { id: 'p13', name: 'Aperture Science' },
        { id: 'p14', name: 'Black Mesa' },
        { id: 'p15', name: 'Tyrell Corp' },
        { id: 'p16', name: 'Weyland-Yutani' },
        { id: 'p17', name: 'Dharma Initiative' },
        { id: 'p18', name: 'Gekko & Co' },
        { id: 'p19', name: 'Pierce & Pierce' },
        { id: 'p20', name: 'Duke & Duke' },
        { id: 'p21', name: 'Omni Consumer Products' },
        { id: 'p22', name: 'Buy n Large' },
        { id: 'p23', name: 'Oscorp' },
        { id: 'p24', name: 'Roxxon Energy' },
        { id: 'p25', name: 'Stark Industries' },
        { id: 'p26', name: 'Pym Technologies' },
        { id: 'p27', name: 'Hammer Industries' },
        { id: 'p28', name: 'Trask Industries' },
        { id: 'p29', name: 'Worthington Labs' },
        { id: 'p30', name: 'Essex Corp' },
        { id: 'p31', name: 'Alchemax' },
        { id: 'p32', name: 'Life Foundation' },
        { id: 'p33', name: 'Parker Industries' },
        { id: 'p34', name: 'Rand Enterprises' },
        { id: 'p35', name: 'Fujikawa Industries' },
        { id: 'p36', name: 'Stane International' },
        { id: 'p37', name: 'Advanced Idea Mechanics' },
        { id: 'p38', name: 'Roxxon Corp' },
        { id: 'p39', name: 'Midland Circle' },
        { id: 'p40', name: 'Alias Investigations' },
    ];
    return partners;
};
const MOCK_PARTNERS = generatePartners();

const PRICING_RULES = [
    { id: 'pr-1', name: 'Standard Discount', type: 'Discount', summary: '15% off on orders of 100+ units', details: 'Min Qty: 100 EA', value: '15%' },
    { id: 'pr-2', name: 'Volume-Based Tier', type: 'Volume', summary: 'Tiered pricing structure', details: 'Max Tier: 12% Off', value: 'Variable' },
    { id: 'pr-3', name: 'Seasonal Promo Q3', type: 'Promotion', summary: 'Limited time offer (Jul-Sep)', details: 'Valid: Q3 2026', value: '10%' },
    { id: 'pr-4', name: 'Contracted Rate', type: 'Fixed Price', summary: 'Agreed fixed rate per unit', details: 'Price/Unit', value: '$12.50' },
    { id: 'pr-5', name: 'New Partner Intro', type: 'One-time', summary: 'Flat discount on first order', details: 'One-time use', value: '-$50.00' },
];

const generateLocations = () => {
    return [
        'Warehouse A - Main Hall', 'Warehouse B - Cold Storage', 'Production Line 1 - Assembly', 'Returns Dock', 
        'Quarantine Zone - Hazardous', 'Distribution Center - East Wing', 'Overflow Storage - Offsite', 'Cold Storage Unit 4',
        'Warehouse C - Electronics', 'Warehouse D - Raw Materials', 'Production Line 2 - Packaging', 'Shipping Dock 1',
        'Shipping Dock 2', 'Receiving Dock A', 'Receiving Dock B', 'Quality Control Lab', 'R&D Workshop',
        'Showroom Storage', 'Archive Room B1', 'Maintenance Shed', 'Chemical Storage Locker', 'High Security Vault',
        'Automated Storage System', 'Rack 45 - Aisle 3', 'Bin 102-A', 'Pallet Zone C', 'Staging Area 1', 'Staging Area 2'
    ];
};
const LOCATIONS = generateLocations();

const UOMS = ['Each', 'Box', 'Case', 'Pallet', 'kg', 'm', 'Liter', 'Roll', 'Pair', 'Roll100m', 'Meter'];

// --- Types ---

interface CreateItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (newItem?: any) => void;
}

type Step = 'categories' | 'basic' | 'success';

type ConfigSectionType = 
  | 'definition'
  | 'inventory'
  | 'procurement'
  | 'fulfillment'
  | 'governance';

interface AdvancedConfig {
  inventoryType: string;
  uom: string;
  acquisitionMethod: string[];
  controlType: string;
  
  // Lot Control Extension
  lotControlEnabled: boolean;
  lotIdSource: 'system' | 'vendor';
  vendorLotCapture: 'optional' | 'required';
  shelfLifeEnabled: boolean;
  lotPrefix: string;

  // Alternative Units
  alternativeUnits?: { id: string; unit: string; conversionFactor: string }[];

  minStock: string;
  maxStock: string;
  stockUom: string;
  inboundLocation: string[];
  outboundLocation: string[];
  defaultInboundLocation: string;
  defaultOutboundLocation: string;
  
  // Handling & Hazards
  handlingInstructions: string;
  hazardClass: string;
  requiredScanning: boolean;

  minPurchase: string;
  maxPurchase: string;
  purchaseUom: string;
  multiples: string;
  
  cycleDeviation: string;
  cycleRecurrence: string;
  cycleApproval: boolean;

  // Material Handling (Slice M.3 — Category parity)
  cycleTolerance?: string;
  approvers?: string[];
  scanLocation?: boolean;
  scanItem?: boolean;
  scanLot?: boolean;
  scanSerial?: boolean;

  // Primary acquisition (Slice M.3 — Category BuyMakeToggle parity)
  primaryAcquisition?: 'Purchased' | 'Manufactured';

  // Ownership
  engineeringOwner: string[];
  purchasingOwner: string[];
  schedulingOwner: string[];
  salesOwner: string[];
  arOwner: string[];
  
  // Fulfillment Updates
  sellingScope: 'all' | 'specific';
  specificPartners: string[]; // New
  partnerRules: Record<string, string[]>; // New
  pricing: { price: string; uom: string; id: string }[]; // New
  
  vendorScope?: 'all' | 'specific';
  specificVendors?: string[];
  vendorRules?: Record<string, string[]>;
  vendorCosts?: { cost: string; uom: string; id: string }[];
  qualifiedVendors?: {
    vendorId: string;
    vendorName: string;
    vendorSku: string;
    uom: string;
    pricePerUom: string;
    minOrderQty: string;
    maxOrderQty: string;
    multiples: string;
    deviation: string;
    pricingRules: string[];
    priority: number;
  }[];
  
  // Deprecated/Legacy (kept for type safety during migration if needed, but unused in UI)
  customPrice: string;
  
  valuationMethod: 'fifo' | 'wac' | 'lifo' | 'specific';
}

interface FormData {
  partNumber: string;
  description: string;
  status: string;
  tags: string[];
  attachments: File[];
  selectedCategories: string[];
  primaryCategory: string | null;
  config: AdvancedConfig;
}

const DEFAULT_CONFIG: AdvancedConfig = {
  inventoryType: 'Stock',
  uom: 'Each',
  acquisitionMethod: ['Purchased'],
  controlType: 'Non-serialized',
  
  lotControlEnabled: false,
  lotIdSource: 'system',
  vendorLotCapture: 'optional',
  shelfLifeEnabled: false,
  lotPrefix: 'LOT-',

  alternativeUnits: [],

  minStock: '10',
  maxStock: '1000',
  stockUom: 'Each',
  inboundLocation: ['Warehouse A - Main Hall'],
  outboundLocation: ['Warehouse A - Main Hall'],
  defaultInboundLocation: 'Warehouse A - Main Hall',
  defaultOutboundLocation: 'Warehouse A - Main Hall',
  
  handlingInstructions: '',
  hazardClass: 'None',
  requiredScanning: true,

  minPurchase: '50',
  maxPurchase: '5000',
  purchaseUom: 'Each',
  multiples: '10',
  
  cycleDeviation: '5',
  cycleRecurrence: 'Monthly',
  cycleApproval: false,

  // Slice M.3 — Material Handling defaults
  cycleTolerance: '5',
  approvers: [],
  scanLocation: false,
  scanItem: false,
  scanLot: false,
  scanSerial: false,

  // Slice M.3 — primaryAcquisition initialized from first selected method
  primaryAcquisition: 'Purchased',

  engineeringOwner: [],
  purchasingOwner: [],
  schedulingOwner: [],
  salesOwner: [],
  arOwner: [],
  
  sellingScope: 'all',
  specificPartners: [],
  partnerRules: {},
  pricing: [{ price: '0.00', uom: 'Each', id: '1' }],
  
  vendorScope: 'all',
  specificVendors: [],
  vendorCosts: [],
  qualifiedVendors: [],
  
  customPrice: '',
  valuationMethod: 'fifo',
};

// Slice M.3 — added Material Handling tab; Item Definition stays visible in both variants.
const CONFIG_GROUPS = [
  { id: 'definition', label: 'Item Definition', icon: Box, description: 'Core identity, UOM, and tracking method.' },
  { id: 'inventory', label: 'Stock & Logistics', icon: Layers, description: 'Stock levels, locations, and counting rules.' },
  { id: 'procurement', label: 'Procurement', icon: ShoppingCart, description: 'Purchasing rules, limits, and suppliers.' },
  { id: 'fulfillment', label: 'Selling', icon: Truck, description: 'Selling scope, partners, and pricing.' },
  { id: 'governance', label: 'Governance', icon: Shield, description: 'Ownership, valuation, and compliance.' },
  { id: 'materialHandling', label: 'Material Handling', icon: ScanLine, description: 'Cycle counting, variance, and scan rules.' },
];

// --- Helper Functions ---

const getFileIcon = (file: File) => {
  const type = file.type;
  const name = file.name.toLowerCase();
  
  if (type.startsWith('image/')) return FileImage;
  if (type === 'application/pdf') return FileText;
  if (name.endsWith('.csv') || name.endsWith('.xlsx') || name.endsWith('.xls')) return FileSpreadsheet;
  if (name.endsWith('.zip') || name.endsWith('.rar') || name.endsWith('.7z')) return Archive;
  if (name.endsWith('.json') || name.endsWith('.xml') || name.endsWith('.html')) return FileCode;
  
  return FileIcon;
};

// --- Reusable Components ---

const SearchableMultiSelect = ({ 
    options, 
    selected, 
    onChange, 
    placeholder, 
    label,
    defaultValue,
    onDefaultChange
}: { 
    options: string[] | {id: string, name: string}[], 
    selected: string[], 
    onChange: (val: string) => void, 
    placeholder: string,
    label: string,
    defaultValue?: string,
    onDefaultChange?: (id: string) => void
}) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');

    const normalizedOptions = useMemo(() => {
        return options.map(o => typeof o === 'string' ? { id: o, name: o } : o);
    }, [options]);

    const filtered = normalizedOptions.filter(o => o.name.toLowerCase().includes(search.toLowerCase()));

    const selectedItems = normalizedOptions.filter(o => selected.includes(o.id));

    return (
        <div className="space-y-2">
            <Label className="text-sm font-semibold">{label}</Label>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <button className="flex h-10 w-full items-center justify-between rounded-md border border-[var(--border)] bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-muted-foreground font-normal text-left">
                        <span className={cn("truncate", selected.length > 0 && "text-foreground")}>
                            {selected.length > 0 
                                ? `${selected.length} selected` 
                                : placeholder}
                        </span>
                        <ChevronDown size={14} className="opacity-50 shrink-0 ml-2" />
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                    <div className="p-2 border-b border-[var(--border)] sticky top-0 bg-background z-10">
                        <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input 
                                className="h-8 pl-8 text-xs bg-secondary/20 border-transparent focus-visible:ring-0 focus-visible:bg-secondary/40" 
                                placeholder="Search..." 
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="max-h-[250px] overflow-y-auto p-1">
                         {filtered.length === 0 && <div className="text-xs text-muted-foreground p-3 text-center">No results found</div>}
                         {filtered.map(opt => (
                             <div 
                                key={opt.id} 
                                className="flex items-start space-x-2 p-2 hover:bg-secondary rounded cursor-pointer group" 
                                onClick={() => onChange(opt.id)}
                             >
                                 <Checkbox 
                                    checked={selected.includes(opt.id)} 
                                    className="mt-0.5"
                                 />
                                 <span className="text-sm leading-tight break-words line-clamp-2">{opt.name}</span>
                             </div>
                         ))}
                    </div>
                </PopoverContent>
            </Popover>
            
            {/* Selected Items View */}
            {selectedItems.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                    {selectedItems.map(item => {
                        const isDefault = defaultValue === item.id;
                        return (
                            <Badge 
                                key={item.id} 
                                variant="secondary" 
                                className={cn(
                                    "pl-2 pr-1 py-1 text-xs font-normal border bg-secondary/30 flex items-center gap-1 max-w-full transition-all group",
                                    isDefault ? "border-primary/50 ring-1 ring-primary/20 bg-primary/5" : "border-border"
                                )}
                            >
                                {onDefaultChange && (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onDefaultChange(item.id); }}
                                        className={cn(
                                            "mr-1 h-4 w-4 flex items-center justify-center rounded-full hover:bg-background transition-colors", 
                                            isDefault ? "text-primary" : "text-muted-foreground opacity-50 hover:opacity-100 hover:text-primary"
                                        )}
                                        title="Set as default"
                                    >
                                        <Star size={10} className={cn(isDefault && "fill-primary")} />
                                    </button>
                                )}
                                <span className={cn("truncate max-w-[200px]", isDefault && "font-medium text-foreground")}>{item.name}</span>
                                {isDefault && <span className="text-[9px] text-muted-foreground ml-1 font-medium">(Default)</span>}
                                <div className="w-px h-3 bg-border mx-1" />
                                <button 
                                    onClick={() => onChange(item.id)}
                                    className="h-4 w-4 rounded-full hover:bg-destructive/10 hover:text-destructive flex items-center justify-center transition-colors"
                                >
                                    <X size={10} />
                                </button>
                            </Badge>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// --- Visual & Animation Components ---

const VisualHeader = ({ type, data }: { type: ConfigSectionType, data: AdvancedConfig }) => {
  const isPurchased = data.acquisitionMethod.includes('Purchased');
  const isManufactured = data.acquisitionMethod.includes('Manufactured');
  
  const inboundCount = Array.isArray(data.inboundLocation) ? data.inboundLocation.length : 0;
  const outboundCount = Array.isArray(data.outboundLocation) ? data.outboundLocation.length : 0;
  
  const partnerCount = Array.isArray(data.specificPartners) ? data.specificPartners.length : 0;
  const pricingCount = Array.isArray(data.pricing) ? data.pricing.filter(p => p.price && p.price !== '0.00').length : 0;

  return (
    <div className="w-full h-40 bg-[var(--secondary)]/10 border-b border-[var(--border)] relative overflow-hidden flex items-center justify-center p-6">
      <div className="absolute inset-0 opacity-10" style={{ 
        backgroundImage: 'radial-gradient(circle at 2px 2px, var(--primary) 1px, transparent 0)',
        backgroundSize: '24px 24px' 
      }} />
      
      {/* Definition Visual */}
      {type === 'definition' && (
        <div className="flex items-center gap-12 relative z-10">
          <motion.div layout className="flex flex-col items-center gap-2">
            <div className="h-16 w-16 bg-[var(--background)] rounded-xl border border-[var(--primary)]/30 shadow-sm flex items-center justify-center relative">
               <Box size={28} className="text-[var(--primary)]" />
               <div className="absolute -top-2 -right-2 bg-[var(--primary)] text-[var(--primary-foreground)] text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">
                 {data.uom}
               </div>
            </div>
            <span className="text-[10px] font-semibold uppercase text-[var(--muted-foreground)] tracking-wide">{data.inventoryType}</span>
          </motion.div>
          <ArrowRight className="text-[var(--border)]" />
          <motion.div layout className="flex gap-2">
             {isPurchased && (
                <div className="flex flex-col items-center gap-1">
                   <div className="h-10 w-10 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center justify-center text-blue-600 dark:text-blue-400">
                     <ShoppingCart size={18} />
                   </div>
                   <span className="text-[9px] font-medium text-blue-600 dark:text-blue-400">Buy</span>
                </div>
             )}
             {isManufactured && (
                <div className="flex flex-col items-center gap-1">
                   <div className="h-10 w-10 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center justify-center text-amber-600 dark:text-amber-400">
                     <Wrench size={18} />
                   </div>
                   <span className="text-[9px] font-medium text-amber-600 dark:text-amber-400">Make</span>
                </div>
             )}
          </motion.div>
          <ArrowRight className="text-[var(--border)]" />
          <motion.div layout className="flex flex-col items-center gap-2">
             <div className="h-16 w-16 bg-[var(--background)] rounded-xl border border-[var(--border)] shadow-sm flex items-center justify-center relative overflow-hidden">
                {data.controlType === 'Serialized' ? (
                   <Barcode size={28} className="text-[var(--foreground)] opacity-80" />
                ) : (
                   <Layers size={28} className="text-[var(--foreground)] opacity-80" />
                )}
                {data.lotControlEnabled && (
                  <div className="absolute top-0 right-0 p-1">
                     <div className="h-2 w-2 rounded-full bg-emerald-500 border border-[var(--background)] ring-1 ring-emerald-100" />
                  </div>
                )}
             </div>
             <div className="flex flex-col items-center">
               <span className="text-[10px] font-semibold text-[var(--foreground)]">{data.controlType}</span>
               {data.lotControlEnabled && (
                  <span className="text-[9px] text-emerald-600 font-medium flex items-center gap-0.5">
                    <Check size={8} /> Lot Tracked
                  </span>
               )}
             </div>
          </motion.div>
        </div>
      )}

      {/* Inventory Visual */}
      {type === 'inventory' && (
        <div className="flex items-center gap-16 relative z-10">
            {/* Stacked Line Chart */}
            <div className="flex flex-col gap-3">
                <div className="relative h-16 w-80 bg-[var(--secondary)]/10 rounded-lg border border-[var(--border)]/30 p-3 shadow-sm overflow-hidden">
                    {/* Dot pattern overlay */}
                    <div className="absolute inset-0 opacity-5" style={{ 
                        backgroundImage: 'radial-gradient(circle at 2px 2px, var(--primary) 1px, transparent 0)',
                        backgroundSize: '16px 16px' 
                    }} />
                    
                    {data.minStock && data.maxStock && parseFloat(data.minStock) < parseFloat(data.maxStock) ? (
                        <svg className="w-full h-full relative z-10" viewBox="0 0 300 40" preserveAspectRatio="none">
                            {/* Grid lines */}
                            <line x1="0" y1="10" x2="300" y2="10" stroke="var(--border)" strokeWidth="0.5" strokeDasharray="2,2" opacity="0.3" />
                            <line x1="0" y1="20" x2="300" y2="20" stroke="var(--border)" strokeWidth="0.5" strokeDasharray="2,2" opacity="0.3" />
                            <line x1="0" y1="30" x2="300" y2="30" stroke="var(--border)" strokeWidth="0.5" strokeDasharray="2,2" opacity="0.3" />
                            
                            {/* Stacked areas */}
                            {/* Bottom area (Min level) */}
                            <path
                                d="M 0 40 L 0 35 Q 75 33 150 32 T 300 30 L 300 40 Z"
                                fill="var(--destructive)"
                                opacity="0.2"
                            />
                            <path
                                d="M 0 35 Q 75 33 150 32 T 300 30"
                                stroke="var(--destructive)"
                                strokeWidth="2"
                                fill="none"
                            />
                            
                            {/* Top area (Max level stacked on min) */}
                            <path
                                d="M 0 35 L 0 10 Q 75 8 150 7 T 300 5 L 300 30 Q 225 32 150 32 T 0 35 Z"
                                fill="var(--primary)"
                                opacity="0.15"
                            />
                            <path
                                d="M 0 10 Q 75 8 150 7 T 300 5"
                                stroke="var(--primary)"
                                strokeWidth="2"
                                fill="none"
                            />
                            
                            {/* Data points */}
                            <circle cx="0" cy="35" r="2.5" fill="var(--destructive)" />
                            <circle cx="150" cy="32" r="2.5" fill="var(--destructive)" />
                            <circle cx="300" cy="30" r="2.5" fill="var(--destructive)" />
                            
                            <circle cx="0" cy="10" r="2.5" fill="var(--primary)" />
                            <circle cx="150" cy="7" r="2.5" fill="var(--primary)" />
                            <circle cx="300" cy="5" r="2.5" fill="var(--primary)" />
                        </svg>
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center z-10">
                            <span className="text-[10px] text-[var(--muted-foreground)]">Set min & max levels</span>
                        </div>
                    )}
                </div>
                {/* Legend */}
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-[var(--destructive)]" />
                        <span className="text-[10px] text-[var(--muted-foreground)]">Min: {data.minStock || '—'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-[var(--primary)]" />
                        <span className="text-[10px] text-[var(--muted-foreground)]">Max: {data.maxStock || '—'}</span>
                    </div>
                    <div className="text-[10px] font-bold text-[var(--foreground)] bg-[var(--background)] px-2 py-0.5 rounded border border-[var(--border)] shadow-sm">
                        {data.stockUom}
                    </div>
                </div>
            </div>
            <div className="h-12 w-px bg-[var(--border)]" />
            <div className="flex items-center gap-6">
                <div className="flex flex-col items-center gap-2">
                    <div className="relative">
                        <div className="h-10 w-10 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-sm">
                            <ArrowRight size={16} className="rotate-45" />
                        </div>
                        {inboundCount > 0 && (
                            <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center rounded-full bg-emerald-600 border-2 border-white">
                                {inboundCount}
                            </Badge>
                        )}
                    </div>
                    <span className="text-[10px] font-semibold text-[var(--foreground)]">Inbound</span>
                </div>
                <div className="h-1 w-12 border-t-2 border-dashed border-[var(--border)]" />
                <div className="flex flex-col items-center gap-2">
                    <div className="relative">
                        <div className="h-10 w-10 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-sm">
                            <ArrowRight size={16} className="-rotate-45" />
                        </div>
                        {outboundCount > 0 && (
                            <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center rounded-full bg-blue-600 border-2 border-white">
                                {outboundCount}
                            </Badge>
                        )}
                    </div>
                    <span className="text-[10px] font-semibold text-[var(--foreground)]">Outbound</span>
                </div>
            </div>
        </div>
      )}
      
      {/* Procurement Visual */}
      {type === 'procurement' && (
        <div className="flex items-center gap-16 relative z-10">
            <div className="flex items-end gap-2 group">
                <div className="flex flex-col items-center gap-1.5">
                    <div className="text-[9px] font-medium text-[var(--muted-foreground)]">Min Order</div>
                    <div className="w-12 bg-[var(--secondary)]/30 rounded-t-md relative overflow-hidden border border-[var(--border)] border-b-0 h-16 flex items-end justify-center">
                        <div className="w-full bg-purple-400/80 h-[40%]" />
                        <div className="absolute bottom-1 text-[9px] font-bold text-purple-900 z-10">{data.minPurchase}</div>
                    </div>
                </div>
                <div className="flex flex-col items-center gap-1.5">
                    <div className="text-[9px] font-medium text-[var(--muted-foreground)]">Max Order</div>
                    <div className="w-12 bg-[var(--secondary)]/30 rounded-t-md relative overflow-hidden border border-[var(--border)] border-b-0 h-24 flex items-end justify-center">
                        <div className="w-full bg-indigo-400/80 h-[90%]" />
                        <div className="absolute bottom-1 text-[9px] font-bold text-indigo-900 z-10">{data.maxPurchase}</div>
                    </div>
                </div>
                <div className="ml-2 mb-2 text-[10px] font-bold text-[var(--foreground)] bg-[var(--background)] px-2 py-1 rounded border border-[var(--border)] shadow-sm">
                    {data.purchaseUom}
                </div>
            </div>
            <div className="h-12 w-px bg-[var(--border)]" />
            <div className="flex flex-col items-center gap-2">
                <div className="relative">
                    <div className="h-14 w-14 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-600 shadow-sm">
                        <Boxes size={24} />
                    </div>
                    <Badge className="absolute -top-2 -right-2 h-6 min-w-[24px] p-0 px-1.5 flex items-center justify-center rounded-full bg-orange-600 border-2 border-white text-xs">
                        x{data.multiples}
                    </Badge>
                </div>
                <span className="text-[10px] font-semibold text-[var(--foreground)]">Order Multiples</span>
            </div>
        </div>
      )}

      {/* Fulfillment Visual */}
      {type === 'fulfillment' && (
        <div className="flex items-center gap-16 relative z-10">
             {/* Selling Scope Visual */}
             <div className="flex flex-col items-center gap-2">
                 <div className="relative">
                     <div className={cn("h-16 w-16 rounded-xl border flex items-center justify-center shadow-sm transition-colors", data.sellingScope === 'all' ? "bg-blue-50 border-blue-200 text-blue-600" : "bg-purple-50 border-purple-200 text-purple-600")}>
                        {data.sellingScope === 'all' ? <Globe size={32} strokeWidth={1.5} /> : <Building2 size={32} strokeWidth={1.5} />}
                     </div>
                 </div>
                 <span className="text-[10px] font-semibold text-[var(--foreground)] uppercase tracking-wide">
                    {data.sellingScope === 'all' ? 'Global Market' : 'Partner Only'}
                 </span>
             </div>

             <div className="h-12 w-px bg-[var(--border)]" />

             {/* Pricing Visual */}
             <div className="flex flex-col items-center gap-2">
                 <div className="relative group">
                     <div className="h-14 w-14 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-sm">
                        <DollarSign size={28} />
                     </div>
                     <Badge className="absolute -top-2 -right-2 h-6 min-w-[24px] p-0 px-1.5 flex items-center justify-center rounded-full bg-emerald-600 border-2 border-white text-xs">
                        {pricingCount}
                     </Badge>
                 </div>
                 <span className="text-[10px] font-semibold text-[var(--foreground)] uppercase tracking-wide">Price Points</span>
             </div>
        </div>
      )}
    </div>
  );
};

// --- Config Subcomponents to reduce complexity ---

/**
 * ConfigCard — accepts an optional `icon` + `tooltip`. When `icon` is provided
 * the header strip uses Category's literal treatment (24×24 #EDF4FF tile, 13/600
 * label, optional Info tooltip). Otherwise legacy uppercase header is preserved
 * so existing call sites keep their look untouched.
 * Category source: ConfigureCategory.tsx ConfigCard (lines 2367-2395). Slice Pair A.
 */
const ConfigCard = ({ title, icon: Icon, tooltip, children }: { title: string; icon?: any; tooltip?: string; children: React.ReactNode }) => (
    <div
      className="rounded-lg overflow-hidden"
      style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}
    >
        {Icon ? (
          <div className="flex items-center gap-2" style={{ padding: '10px 16px', borderBottom: '1px solid #EEF2F6', backgroundColor: '#FAFBFC' }}>
            <div className="flex items-center justify-center shrink-0" style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: 'rgba(10,119,255,0.08)' }}>
              <Icon style={{ width: 14, height: 14, color: '#0A77FF' }} />
            </div>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>{title}</span>
            {tooltip && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="shrink-0 flex items-center justify-center cursor-help">
                      <Info style={{ width: 13, height: 13, color: '#94A3B8' }} />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" style={{ maxWidth: 340 }}>
                    <p style={{ fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-line' }}>{tooltip}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        ) : (
          <div className="px-5 py-3" style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}><h4 className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">{title}</h4></div>
        )}
        <div style={{ padding: Icon ? '12px 16px' : undefined }} className={Icon ? '' : 'p-5'}>{children}</div>
    </div>
);

const ConfigSelect = ({ value, onValueChange, options, placeholder }: { value: string, onValueChange: (v: string) => void, options: string[], placeholder: string }) => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredOptions = options.filter(o => o.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex w-full items-center justify-between h-9 bg-background border border-[var(--border)] rounded-md px-3 text-sm font-normal text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <span className={cn("truncate", value && "text-foreground")}>{value || placeholder}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <div className="p-2 border-b border-[var(--border)]">
           <div className="relative">
             <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
             <Input 
                className="h-8 pl-8 text-xs bg-secondary/20 border-transparent focus-visible:ring-0 focus-visible:bg-secondary/40" 
                placeholder="Search..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
             />
           </div>
        </div>
        <div className="max-h-[200px] overflow-y-auto p-1">
            {filteredOptions.length === 0 ? (
               <div className="text-xs text-muted-foreground p-2 text-center">No results</div>
            ) : (
                filteredOptions.map((option) => (
                    <div
                        key={option}
                        className={cn(
                        "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 cursor-pointer",
                        value === option ? "bg-accent text-accent-foreground" : ""
                        )}
                        onClick={() => {
                            onValueChange(option);
                            setOpen(false);
                            setSearchTerm('');
                        }}
                    >
                        <Check
                        className={cn(
                            "mr-2 h-4 w-4",
                            value === option ? "opacity-100" : "opacity-0"
                        )}
                        />
                        {option}
                    </div>
                ))
            )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

const OwnerSelector = ({ roleKey, currentOwners, onToggle, users }: any) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    
    const filteredUsers = users.filter((u: any) => u.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button className="h-8 w-8 rounded-full border border-dashed border-muted-foreground/40 flex items-center justify-center hover:bg-secondary hover:border-primary hover:text-primary transition-all text-muted-foreground">
                    <Plus size={14} />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-[240px] p-0" align="end">
                <div className="p-2 border-b border-[var(--border)]">
                   <div className="relative">
                     <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                     <Input 
                        className="h-8 pl-8 text-xs bg-secondary/20 border-transparent focus-visible:ring-0 focus-visible:bg-secondary/40" 
                        placeholder="Find user..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                     />
                   </div>
                </div>
                <div className="p-1 max-h-[200px] overflow-y-auto">
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Select User</div>
                    {filteredUsers.length === 0 && <div className="text-xs text-muted-foreground px-2 py-2">No users found</div>}
                    {filteredUsers.map((user: any) => (
                        <div 
                            key={user.id} 
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-secondary rounded cursor-pointer text-sm"
                            onClick={() => onToggle(roleKey, user.id)}
                        >
                            <Checkbox checked={currentOwners.includes(user.id)} />
                            <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold border border-blue-200">
                                {user.initials}
                            </div>
                            <div className="flex flex-col flex-1 min-w-0">
                                <span className="text-sm font-medium truncate">{user.name}</span>
                                <span className="text-[10px] text-muted-foreground truncate">{user.role}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
}

const InfoBanner = ({ icon: Icon, colorClass, text }: { icon: any, colorClass: string, text: string }) => (
    <div className={cn("flex items-center gap-3 p-4 rounded-lg border mb-6", colorClass)}>
        <Icon size={18} />
        <p className="text-sm font-medium">{text}</p>
    </div>
);

// --- Export Components for Reuse ---

export { VisualHeader, ConfigCard, ConfigSelect, OwnerSelector, InfoBanner };

// Export Constants
export { CONFIG_GROUPS, PRICING_RULES, MOCK_PARTNERS, MOCK_USERS, LOCATIONS, UOMS, generatePartners };

// --- Item Category Card (Partners GroupCard parity) ---

function ItemCategoryCard({
  category,
  isSelected,
  isPrimary,
  itemCount,
  searchQuery,
  onSelect,
  onSetPrimary,
  onQuickView,
}: {
  category: { id: string; name: string; description: string; icon: any };
  isSelected: boolean;
  isPrimary: boolean;
  itemCount: number;
  searchQuery?: string;
  onSelect: () => void;
  onSetPrimary: (e: React.MouseEvent) => void;
  onQuickView: (e: React.MouseEvent) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const Icon = category.icon;

  const handlePrimaryClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSetPrimary(e);
  };

  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative text-left p-2.5 sm:p-3 rounded-lg border transition-all duration-150 w-full"
      style={{
        borderColor: isSelected ? "#0A77FF" : isHovered ? "#CBD5E1" : "#E2E8F0",
        backgroundColor: isSelected ? "#F5F9FF" : isHovered ? "#FAFCFF" : "#FFFFFF",
        boxShadow: isSelected
          ? "0 0 0 1px rgba(10,119,255,0.15), 0 1px 3px rgba(10,119,255,0.06)"
          : isHovered
            ? "0 2px 8px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)"
            : "none",
      }}
    >
      {/* Top-right actions row */}
      <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
        {isSelected && isHovered && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onQuickView(e);
              }}
              aria-label="Preview associated items"
              className="w-6 h-6 rounded-full flex items-center justify-center text-[#94A3B8] hover:text-[#64748B] hover:bg-white/80 transition-colors cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handlePrimaryClick}
              className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                isPrimary
                  ? "text-[#0A77FF] hover:bg-white/80"
                  : "text-[#94A3B8] hover:text-[#F59E0B] hover:bg-white/80"
              }`}
              title={isPrimary ? "Primary category" : "Set as primary"}
            >
              <Star className={`w-3.5 h-3.5 ${isPrimary ? "fill-[#0A77FF]" : ""}`} />
            </button>
          </>
        )}

        {!isSelected && isHovered && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onQuickView(e);
            }}
            aria-label="Preview associated items"
            className="w-6 h-6 rounded-full flex items-center justify-center text-[#94A3B8] hover:text-[#64748B] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
        )}

        {isPrimary && !isHovered && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#0A77FF] text-white text-[10px]" style={{ fontWeight: 600 }}>
            Primary
          </span>
        )}

        {isSelected && (
          <div className="w-5 h-5 rounded-full bg-[#0A77FF] flex items-center justify-center">
            <Check className="w-3 h-3 text-white" />
          </div>
        )}

        {!isSelected && isHovered && (
          <div className="w-5 h-5 rounded-full border-2 border-[#CBD5E1] bg-white" />
        )}
      </div>

      {/* Icon */}
      <div className={`w-7 h-7 rounded-md flex items-center justify-center mb-1.5 transition-colors ${
        isSelected ? "bg-[#D6E8FF]" : "bg-[#F1F5F9]"
      }`}>
        <Icon className={`w-4 h-4 transition-colors ${
          isSelected ? "text-primary" : "text-[#64748B]"
        }`} />
      </div>

      {/* Name */}
      <p className="text-[13px] text-foreground pr-16 break-words" style={{ fontWeight: isSelected ? 600 : 500 }}>{category.name}</p>

      {/* Description */}
      <p className="text-[11px] text-[#94A3B8] mt-0.5 line-clamp-2 pr-2 break-words">
        {category.description}
      </p>

      {/* Footer: item count */}
      <div className="flex items-center gap-1 mt-1.5 text-[11px] text-[#94A3B8]">
        <Boxes className="w-3 h-3" />
        <span>{itemCount} item{itemCount !== 1 ? "s" : ""}</span>
      </div>
    </button>
  );
}

// ── Quick View Overlay (Associated Items) ──
// Partners-literal port of GroupQuickViewOverlay. Plain fixed overlay (NOT a
// nested Radix Dialog) so it layers cleanly over the parent Create Item modal.
const ITEM_STATUS_TABS = ['All', 'Active', 'Inactive'] as const;
type ItemStatusTab = (typeof ITEM_STATUS_TABS)[number];
const ITEM_ROW_HEIGHT = 44;
const ITEM_PAGE_SIZE = 50;

type CategoryItem = { id: string; partNumber: string; description: string; status: string };

function CategoryItemsQuickViewOverlay({
  category,
  items,
  onClose,
}: {
  category: { id: string; name: string };
  items: CategoryItem[];
  onClose: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState<ItemStatusTab>('All');
  const [visibleCount, setVisibleCount] = useState(ITEM_PAGE_SIZE);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return items.filter((it) => {
      if (statusTab !== 'All' && it.status !== statusTab) return false;
      if (!q) return true;
      return (
        it.id.toLowerCase().includes(q) ||
        it.partNumber.toLowerCase().includes(q) ||
        it.description.toLowerCase().includes(q)
      );
    });
  }, [items, search, statusTab]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 200) {
      setVisibleCount((prev) => Math.min(prev + ITEM_PAGE_SIZE, filtered.length));
    }
  };

  useEffect(() => {
    setVisibleCount(ITEM_PAGE_SIZE);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [search, statusTab]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
    }, 10);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [onClose]);

  const counts = useMemo(() => {
    const c: Record<ItemStatusTab, number> = { All: items.length, Active: 0, Inactive: 0 };
    for (const it of items) {
      if (it.status === 'Active') c.Active++;
      else if (it.status === 'Inactive') c.Inactive++;
    }
    return c;
  }, [items]);

  const visible = filtered.slice(0, visibleCount);

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 animate-in fade-in-0 duration-150">
      <div
        ref={overlayRef}
        className="bg-white rounded-xl shadow-2xl border border-border w-[calc(100%-1rem)] sm:w-full max-w-[700px] max-h-[85vh] sm:max-h-[600px] flex flex-col mx-auto animate-in zoom-in-95 fade-in-0 duration-200"
      >
        {/* Header */}
        <div className="px-4 sm:px-5 pt-4 sm:pt-5 pb-3 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-[13px] sm:text-sm text-foreground truncate" style={{ fontWeight: 600 }}>
                {category.name} — Associated Items
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                {items.length} item{items.length !== 1 ? 's' : ''} in this category
              </p>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center hover:bg-muted transition-colors cursor-pointer"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          {/* Search + Status Tabs */}
          <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search items..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-8 pl-8 pr-8 rounded-lg border border-border bg-slate-50 text-xs text-foreground placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20 focus:outline-none transition-colors"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-border hover:bg-slate-300 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-2.5 h-2.5 text-slate-500" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {ITEM_STATUS_TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setStatusTab(tab)}
                  className={`px-2 py-1 rounded-md text-[11px] border transition-colors cursor-pointer ${
                    statusTab === tab
                      ? 'bg-accent text-primary border-[#ADD1FF]'
                      : 'bg-slate-50 text-slate-500 border-transparent hover:bg-muted'
                  }`}
                  style={{ fontWeight: 500 }}
                >
                  {tab}
                  <span className="ml-1 opacity-75">{counts[tab]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table header */}
        <div className="shrink-0 border-y border-[#EEF2F6] bg-[#FAFBFC] px-4 sm:px-5">
          <div className="grid grid-cols-[72px_1fr_72px] sm:grid-cols-[80px_1.2fr_1.5fr_76px] gap-2 h-8 items-center">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider" style={{ fontWeight: 600 }}>ID</span>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider" style={{ fontWeight: 600 }}>Part Number</span>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider hidden sm:block" style={{ fontWeight: 600 }}>Description</span>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider text-right" style={{ fontWeight: 600 }}>Status</span>
          </div>
        </div>

        {/* Item list — scrollable */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 min-h-0 overflow-y-auto"
        >
          {visible.length > 0 ? (
            <div className="px-4 sm:px-5">
              {visible.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[72px_1fr_72px] sm:grid-cols-[80px_1.2fr_1.5fr_76px] gap-2 items-center py-2.5 border-b border-muted last:border-b-0 hover:bg-slate-50 transition-colors -mx-4 sm:-mx-5 px-4 sm:px-5"
                  style={{ minHeight: ITEM_ROW_HEIGHT }}
                >
                  <span className="text-[11px] text-primary tabular-nums truncate" style={{ fontWeight: 600 }}>
                    {item.id}
                  </span>
                  <div className="min-w-0 flex items-center gap-2">
                    <InitialAvatar name={item.partNumber} size="sm" className="!w-6 !h-6" />
                    <span className="text-[12px] text-foreground truncate" style={{ fontWeight: 500 }}>
                      {item.partNumber}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 truncate hidden sm:block">
                    {item.description}
                  </span>
                  <div className="flex justify-end">
                    <ItemStatusBadge status={item.status} />
                  </div>
                </div>
              ))}
              {visibleCount < filtered.length && (
                <div className="py-3 text-center">
                  <span className="text-[11px] text-slate-400">
                    Showing {visibleCount} of {filtered.length} — scroll for more
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="py-10 text-center">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center mx-auto mb-2.5">
                {search ? (
                  <Search className="w-5 h-5 text-slate-400" />
                ) : (
                  <Package className="w-5 h-5 text-slate-400" />
                )}
              </div>
              <p className="text-[13px] text-slate-700" style={{ fontWeight: 600 }}>
                {search ? 'No matching items' : 'No items yet'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {search
                  ? 'Try adjusting your search or filter.'
                  : "This category doesn't have any associated items."}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-[#EEF2F6] px-4 sm:px-5 py-2.5 flex items-center justify-between bg-[#FAFBFC] rounded-b-xl">
          <span className="text-[11px] text-slate-400">
            {filtered.length === items.length
              ? `${items.length} total`
              : `${filtered.length} of ${items.length} shown`}
          </span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg text-xs text-foreground bg-white border border-border hover:bg-muted transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// --- Component ---

export function CreateItemModal({ open, onOpenChange, onSuccess }: CreateItemModalProps) {
  const [step, setStep] = useState<Step>('categories'); // Changed default to 'categories'
  const [showConfig, setShowConfig] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string>('definition');
  const [configUpdated, setConfigUpdated] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    partNumber: '',
    description: '',
    status: 'Active',
    tags: [],
    attachments: [],
    selectedCategories: [],
    primaryCategory: null,
    config: DEFAULT_CONFIG
  });
  
  const [tagInput, setTagInput] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [vendorSearch, setVendorSearch] = useState('');
  const [lotControlOpen, setLotControlOpen] = useState(true);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const [showPartNumberWarning, setShowPartNumberWarning] = useState(false);
  const [viewCategoryId, setViewCategoryId] = useState<string | null>(null);
  const [viewCategoryItemsOpen, setViewCategoryItemsOpen] = useState(false);
  const [addVendorDialogOpen, setAddVendorDialogOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setStep('categories'); // Reset to categories
      setShowConfig(false);
      setActiveSectionId('definition');
      setConfigUpdated(false);
      setFormData({
        partNumber: '',
        description: '',
        status: 'Active',
        tags: [],
        attachments: [],
        selectedCategories: [],
        primaryCategory: null,
        config: DEFAULT_CONFIG
      });
      setCategorySearch('');
      setTagInput('');
      setLotControlOpen(true);
      setShowPartNumberWarning(false);
    }
  }, [open]);

  const handleClose = () => { onOpenChange(false); };

  const handleBack = () => {
    if (step === 'basic') setStep('categories');
  };

  const handleReset = () => {
    setStep('categories');
    setShowConfig(false);
    setActiveSectionId('definition');
    setConfigUpdated(false);
    setFormData({
        partNumber: '',
        description: '',
        status: '',
        tags: [],
        attachments: [],
        selectedCategories: [],
        primaryCategory: null,
        config: DEFAULT_CONFIG
    });
    setCategorySearch('');
    setTagInput('');
    setShowPartNumberWarning(false);
    setLotControlOpen(true);
  };

  const handleCreate = () => { 
      // Check if part number is empty
      if (!formData.partNumber || formData.partNumber.trim() === '') {
          setShowPartNumberWarning(true);
          setStep('basic'); // Navigate back to basic info step
          setShowConfig(false); // Exit config if user was there
          // Scroll to top of the modal to show warning
          setTimeout(() => {
              const modalContent = document.querySelector('[role="dialog"] .overflow-y-auto');
              if (modalContent) modalContent.scrollTop = 0;
          }, 100);
          return;
      }

      if (formData.partNumber) {
          // Construct the item object to pass back to parent
          // This allows the parent to highlight it even if the modal isn't closed yet, 
          // or right before it is closed.
          const newItem = {
              id: Math.random().toString(36).substr(2, 9),
              partNumber: formData.partNumber,
              description: formData.description,
              status: (formData.status || 'In Stock'),
              // Map other fields as needed for the Item interface in ItemsLibrary
              primaryCategory: CATEGORIES.find(c => c.id === formData.primaryCategory)?.name || 'Uncategorized',
              additionalCategories: formData.selectedCategories
                  .filter(id => id !== formData.primaryCategory)
                  .map(id => CATEGORIES.find(c => c.id === id)?.name || ''),
              inventoryControlType: formData.config.controlType === 'Serialized' ? 'Serialized' : 'Non-Serialized',
              onHandQty: 0, // Default for new item
              unit: formData.config.uom,
              alternativeStockingUnits: formData.config.stockUom,
              inboundLocations: formData.config.inboundLocation,
              outboundLocations: formData.config.outboundLocation,
              acquisitionMethod: formData.config.acquisitionMethod.includes('Manufactured') ? 'Manufactured' : 'Purchase',
              manufacturer: 'Internal', // Default
              mpn: formData.partNumber,
              ownerId: 'current-user', // Default to current user
              images: formData.attachments.length > 0 && formData.attachments[0].type.startsWith('image/') 
                  ? [URL.createObjectURL(formData.attachments[0])] 
                  : ['https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&q=80&w=1000'], // Fallback image
          };
          
          // Call onSuccess with the new item data
          onSuccess?.(newItem);
          
          // Close the modal immediately after creation
          handleClose();
      }
  };
  
  const handleConfigChange = <K extends keyof AdvancedConfig>(key: K, value: AdvancedConfig[K]) => {
    setFormData(prev => ({ ...prev, config: { ...prev.config, [key]: value } }));
  };
  
  const handleSaveConfig = () => {
    setConfigUpdated(true);
    setShowConfig(false);
  };

  // Partner management helpers
  const togglePartner = (partnerId: string) => {
    setFormData(prev => {
      const isSelected = prev.config.specificPartners.includes(partnerId);
      const newPartners = isSelected 
        ? prev.config.specificPartners.filter(id => id !== partnerId)
        : [...prev.config.specificPartners, partnerId];
      
      // Remove rules if partner is deselected
      const newRules = { ...prev.config.partnerRules };
      if (isSelected) {
        delete newRules[partnerId];
      }
      
      return {
        ...prev,
        config: {
          ...prev.config,
          specificPartners: newPartners,
          partnerRules: newRules
        }
      };
    });
  };

  const updatePartnerRules = (partnerId: string, ruleIds: string[]) => {
    setFormData(prev => ({
      ...prev,
      config: {
        ...prev.config,
        partnerRules: {
          ...prev.config.partnerRules,
          [partnerId]: ruleIds
        }
      }
    }));
  };
  
  const handleAddTag = (e: React.KeyboardEvent) => { if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) { e.preventDefault(); if (!formData.tags.includes(tagInput.trim())) { setFormData(prev => ({ ...prev, tags: [...prev.tags, tagInput.trim()] })); } setTagInput(''); } else if (e.key === 'Backspace' && !tagInput && formData.tags.length > 0) { setFormData(prev => ({ ...prev, tags: prev.tags.slice(0, -1) })); } };
  const removeTag = (tag: string) => { setFormData(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) })); };
  
  // Restore Multi-Select Logic
  const toggleCategory = (catId: string) => {
    setFormData(prev => {
      const isSelected = prev.selectedCategories.includes(catId);
      const newSelected = isSelected ? prev.selectedCategories.filter(id => id !== catId) : [...prev.selectedCategories, catId];
      let newPrimary = prev.primaryCategory;
      if (isSelected && prev.primaryCategory === catId) newPrimary = newSelected.length > 0 ? newSelected[0] : null;
      else if (!isSelected && newSelected.length === 1) newPrimary = catId;
      return { ...prev, selectedCategories: newSelected, primaryCategory: newPrimary };
    });
  };

  const setPrimaryCategory = (catId: string, e?: React.MouseEvent) => { 
      if(e) e.stopPropagation(); 
      setFormData(prev => ({ ...prev, primaryCategory: catId })); 
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files && e.target.files.length > 0) setFormData(prev => ({ ...prev, attachments: [...prev.attachments, ...Array.from(e.target.files || [])] })); };
  const removeFile = (fileToRemove: File) => { setFormData(prev => ({...prev, attachments: prev.attachments.filter(f => f !== fileToRemove)})); };

  const toggleAcquisitionMethod = (method: string) => {
    setFormData(prev => {
        const currentMethods = prev.config.acquisitionMethod;
        const newMethods = currentMethods.includes(method) ? currentMethods.filter(m => m !== method) : [...currentMethods, method];
        return { ...prev, config: { ...prev.config, acquisitionMethod: newMethods.length ? newMethods : [method] } };
    });
  };

  const filteredCategories = useMemo(() => CATEGORIES.filter(cat => cat.name.toLowerCase().includes(categorySearch.toLowerCase()) || cat.description.toLowerCase().includes(categorySearch.toLowerCase())), [categorySearch]);
  const imageAttachments = useMemo(() => formData.attachments.filter(f => f.type.startsWith('image/')), [formData.attachments]);
  const docAttachments = useMemo(() => formData.attachments.filter(f => !f.type.startsWith('image/')), [formData.attachments]);
  const primaryCategory = formData.primaryCategory ? CATEGORIES.find(c => c.id === formData.primaryCategory) : null;

  // Helper function for toggling locations (using the new SearchableMultiSelect structure)
  const toggleLocation = (type: 'inbound' | 'outbound', location: string) => {
    setFormData(prev => {
        const key = type === 'inbound' ? 'inboundLocation' : 'outboundLocation';
        const defaultKey = type === 'inbound' ? 'defaultInboundLocation' : 'defaultOutboundLocation';
        const rawValue = prev.config[key];
        const currentList = Array.isArray(rawValue) ? rawValue : [];
        
        let newList;
        let newDefault = prev.config[defaultKey];

        if (currentList.includes(location)) {
            // Removing
            newList = currentList.filter(l => l !== location);
            if (newDefault === location) {
                newDefault = newList.length > 0 ? newList[0] : '';
            }
        } else {
            // Adding
            newList = [...currentList, location];
            if (!newDefault) {
                newDefault = location; // Auto-set default if it was empty
            }
        }
        
        return { 
            ...prev, 
            config: { 
                ...prev.config, 
                [key]: newList,
                [defaultKey]: newDefault
            } 
        };
    });
  };

  // Helper for toggle user ownership
  const toggleOwner = (roleKey: keyof AdvancedConfig, userId: string) => {
    setFormData(prev => {
       const currentOwners = prev.config[roleKey] as string[];
       const newOwners = currentOwners.includes(userId) ? currentOwners.filter(id => id !== userId) : [...currentOwners, userId];
       return { ...prev, config: { ...prev.config, [roleKey]: newOwners } };
    });
  };

  const addPrice = () => {
      setFormData(prev => ({
          ...prev, 
          config: { ...prev.config, pricing: [...prev.config.pricing, { id: Math.random().toString(36).substr(2, 9), price: '', uom: 'Each' }] }
      }));
  };

  const updatePrice = (id: string, field: 'price' | 'uom', val: string) => {
      setFormData(prev => ({
          ...prev,
          config: { ...prev.config, pricing: prev.config.pricing.map(p => p.id === id ? { ...p, [field]: val } : p) }
      }));
  };

  const removePrice = (id: string) => {
      setFormData(prev => ({
          ...prev,
          config: { ...prev.config, pricing: prev.config.pricing.filter(p => p.id !== id) }
      }));
  };

  const addVendorCost = () => {
      setFormData(prev => ({
          ...prev, 
          config: { ...prev.config, vendorCosts: [...(prev.config.vendorCosts || []), { id: Math.random().toString(36).substr(2, 9), cost: '', uom: 'Each' }] }
      }));
  };

  const updateVendorCost = (id: string, field: 'cost' | 'uom', val: string) => {
      setFormData(prev => ({
          ...prev,
          config: { ...prev.config, vendorCosts: (prev.config.vendorCosts || []).map(c => c.id === id ? { ...c, [field]: val } : c) }
      }));
  };

  const removeVendorCost = (id: string) => {
      setFormData(prev => ({
          ...prev,
          config: { ...prev.config, vendorCosts: (prev.config.vendorCosts || []).filter(c => c.id !== id) }
      }));
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50"
          aria-hidden="true"
        />
      )}
      <DialogContent
        className="flex flex-col p-0 gap-0 border-0 sm:border !fixed !inset-0 !z-50 !translate-x-0 !translate-y-0 !m-auto !w-full !h-full !max-w-[100%] sm:!max-w-[960px] lg:!max-w-[1040px] !max-h-[100dvh] sm:!max-h-[88vh] rounded-none sm:!rounded-2xl sm:overflow-hidden"
        hideCloseButton
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        style={{ boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)" }}
      >
        {/* Always present for accessibility */}
        {showConfig ? (
          <>
            <DialogTitle className="sr-only">Configure Item</DialogTitle>
            <DialogDescription className="sr-only">Configure the advanced settings for this item.</DialogDescription>
          </>
        ) : (
          <>
            <DialogTitle className="sr-only">Create New Item</DialogTitle>
            <DialogDescription className="sr-only">Configure the details and settings for the new item.</DialogDescription>
          </>
        )}

        {/* Header */}
        {step !== 'success' && !showConfig && (
          <div className="px-3 sm:px-4 lg:px-5 pt-3 sm:pt-4 pb-0 shrink-0 bg-white rounded-t-none sm:rounded-t-2xl border-b border-[#EEF2F6]">
            {/* Title row */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-[15px] sm:text-[17px] text-[#0F172A]" style={{ fontWeight: 700 }}>Create New Item</h2>
                <p className="text-[11px] sm:text-xs text-[#64748B] mt-0.5" style={{ fontWeight: 400 }}>
                  Configure the details and settings for the new item.
                </p>
              </div>
              <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                <button
                  onClick={handleClose}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-[#94A3B8] hover:text-[#64748B] hover:bg-[#F1F5F9] transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Step tabs */}
            <div className="flex items-center gap-4 sm:gap-6 mt-3 sm:mt-3.5 overflow-x-auto -mb-px">
              {[
                { key: 'categories', num: 1, label: 'Category Selection', shortLabel: 'Category' },
                { key: 'basic', num: 2, label: 'Basic Information', shortLabel: 'Details' },
              ].map((tab) => {
                const isActive = step === tab.key;
                const isCompleted = tab.key === 'categories' && step === 'basic';
                const canNavigate = tab.key === 'categories' || tab.key === 'basic';
                return (
                  <div
                    key={tab.key}
                    className={`relative flex items-center gap-2 pb-2.5 sm:pb-3 ${canNavigate ? 'cursor-pointer' : 'cursor-default'}`}
                    onClick={() => { if (canNavigate) setStep(tab.key as Step); }}
                  >
                    <div
                      className={`w-[22px] h-[22px] sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[11px] sm:text-[12px] shrink-0 transition-all duration-200 ${
                        isCompleted
                          ? "bg-[#10B981] text-white"
                          : isActive
                          ? "bg-[#0A77FF] text-white"
                          : "border-[1.5px] border-[#CBD5E1] text-[#64748B] bg-white"
                      }`}
                      style={{ fontWeight: 600 }}
                    >
                      {isCompleted ? <Check className="w-3 h-3" /> : tab.num}
                    </div>
                    <span
                      className={`text-[12px] sm:text-[13px] whitespace-nowrap transition-colors ${
                        isActive
                          ? "text-[#0A77FF]"
                          : isCompleted
                          ? "text-[#10B981]"
                          : "text-[#334155]"
                      }`}
                      style={{ fontWeight: isActive || isCompleted ? 600 : 500 }}
                    >
                      <span className="hidden sm:inline">{tab.label}</span>
                      <span className="sm:hidden">{tab.shortLabel}</span>
                    </span>
                    {(isActive || isCompleted) && (
                      <div className={`absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full ${isCompleted ? "bg-[#10B981]" : "bg-[#0A77FF]"}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col relative bg-[#FAFBFC] scrollbar-hide">
          <AnimatePresence mode="wait" initial={false}>
            
            {/* Step 1: Categories */}
            {step === 'categories' && (
                <motion.div key="step-categories" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="flex-1 overflow-y-auto scrollbar-hide">
                    <div className="px-3 sm:px-4 lg:px-5 pt-1">
                      {/* Sticky header: label + search + chips + results count */}
                      <div className="sticky top-0 z-10 bg-[#FAFBFC] pb-2 -mx-3 sm:-mx-4 lg:-mx-5 px-3 sm:px-4 lg:px-5 pt-1">
                        {/* Section label */}
                        <div className="mb-2">
                          <h4 className="text-[13px] sm:text-sm text-foreground" style={{ fontWeight: 600 }}>Select Categories</h4>
                          <p className="text-[11px] sm:text-xs text-[#94A3B8] mt-0.5">
                            Choose one or more categories. Mark one as primary to drive item defaults.
                          </p>
                        </div>

                        {/* Search */}
                        <div className="relative mb-2">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                          <Input
                            placeholder="Search categories..."
                            value={categorySearch}
                            onChange={(e) => setCategorySearch(e.target.value)}
                            className="pl-9 bg-white border-[#E2E8F0] focus:border-[#0A77FF] focus:ring-1 focus:ring-[#0A77FF]/20 h-8 sm:h-9 text-sm"
                          />
                          {categorySearch && (
                            <button
                              onClick={() => setCategorySearch("")}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Selected chips — hidden when empty */}
                        {formData.selectedCategories.length > 0 && (
                          <CategoryChipsRow
                            selectedCategories={formData.selectedCategories
                              .map(id => CATEGORIES.find(c => c.id === id))
                              .filter((c): c is typeof CATEGORIES[number] => Boolean(c))
                              .map(c => ({ id: c.id, name: c.name, description: c.description, count: c.count, icon: c.icon }))}
                            primaryCategoryId={formData.primaryCategory}
                            onRemove={(c) => toggleCategory(c.id)}
                          />
                        )}

                        {/* Results count */}
                        <p className="text-xs text-muted-foreground">
                          {categorySearch.trim()
                            ? `${filteredCategories.length} result${filteredCategories.length !== 1 ? "s" : ""} for "${categorySearch}"`
                            : `${filteredCategories.length} categor${filteredCategories.length !== 1 ? "ies" : "y"} available`}
                        </p>

                        {/* Bottom edge line */}
                        <div className="absolute bottom-0 left-0 right-0 h-px bg-[#E2E8F0]/60" />
                      </div>

                      {/* Grid */}
                      <div className="pt-2 pb-4 relative z-0">
                        <div
                          className="grid gap-1.5 sm:gap-2"
                          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}
                        >
                          {filteredCategories.map(cat => (
                            <ItemCategoryCard
                              key={cat.id}
                              category={cat}
                              isSelected={formData.selectedCategories.includes(cat.id)}
                              isPrimary={formData.primaryCategory === cat.id}
                              itemCount={CATEGORY_ITEMS[cat.id]?.length || 0}
                              searchQuery={categorySearch}
                              onSelect={() => toggleCategory(cat.id)}
                              onSetPrimary={(e) => setPrimaryCategory(cat.id, e)}
                              onQuickView={(e) => {
                                e.stopPropagation();
                                setViewCategoryId(cat.id);
                                setViewCategoryItemsOpen(true);
                              }}
                            />
                          ))}
                        </div>

                        {filteredCategories.length === 0 && (
                          <div className="py-10 sm:py-14 text-center">
                            <div className="w-11 h-11 rounded-xl bg-[#F1F5F9] flex items-center justify-center mx-auto mb-3">
                              <Search className="w-5 h-5 text-[#94A3B8]" />
                            </div>
                            <p className="text-[13px] text-[#334155]" style={{ fontWeight: 600 }}>No categories found</p>
                            <p className="text-xs text-[#94A3B8] mt-1">Try adjusting your search terms.</p>
                          </div>
                        )}
                      </div>
                    </div>
                </motion.div>
            )}

            {/* Step 2: Basic Info OR Advanced Config */}
            {step === 'basic' && (
               !showConfig ? (
                  <motion.div key="step-basic" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="flex-1 overflow-y-auto scrollbar-hide bg-[#FAFBFC] px-3 sm:px-4 lg:px-5 pt-3 pb-4">
                    <div className="space-y-3 sm:space-y-4">

                      {/* ── Inheritance Banner — subtle, Partners-idiom ── */}
                      {primaryCategory ? (
                        <div className="rounded-lg bg-white border border-[#0A77FF]/25 shadow-[0_1px_4px_rgba(10,119,255,0.06),0_4px_12px_-2px_rgba(0,0,0,0.06)] overflow-hidden">
                          <div className="flex items-center justify-between gap-2 px-2.5 sm:px-3 py-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-6 h-6 rounded-md bg-[#0A77FF]/8 flex items-center justify-center shrink-0 relative">
                                <primaryCategory.icon className="w-3.5 h-3.5 text-[#0A77FF]" />
                                {configUpdated && (
                                  <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                                  </span>
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs sm:text-[13px] text-[#0F172A]" style={{ fontWeight: 600 }}>
                                    {primaryCategory.name}
                                  </span>
                                  {!configUpdated ? (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] bg-[#0A77FF]/8 text-[#0A77FF]" style={{ fontWeight: 600 }}>
                                      Inheriting Defaults
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] bg-amber-100 text-amber-800 border border-amber-200" style={{ fontWeight: 600 }}>
                                      Custom Configuration
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-[#94A3B8] mt-0.5">
                                  {configUpdated
                                    ? "Category defaults have been manually overridden for this item."
                                    : "Applying standard operational rules inherited from this category."}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => { setActiveSectionId('inventory'); setShowConfig(true); }}
                              className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-[#475569] hover:border-[#0A77FF] hover:text-[#0A77FF] hover:bg-[#EDF4FF] transition-all shrink-0 text-[11px] sm:text-xs cursor-pointer"
                              style={{ fontWeight: 600 }}
                            >
                              <Settings2 className="w-3 h-3" />
                              <span className="hidden min-[400px]:inline">Customize Configuration</span>
                            </button>
                          </div>
                          {/* Selected categories chips row */}
                          {formData.selectedCategories.length > 0 && (
                            <div className="px-2.5 sm:px-3 pb-2 flex flex-wrap gap-1.5">
                              {formData.selectedCategories.map(catId => {
                                const c = CATEGORIES.find(x => x.id === catId);
                                if (!c) return null;
                                const isPrimary = formData.primaryCategory === catId;
                                return (
                                  <span
                                    key={catId}
                                    className={`inline-flex items-center gap-1.5 pl-2 pr-2 py-1 rounded-lg text-[11px] border ${
                                      isPrimary
                                        ? "bg-[#EDF4FF] text-[#0A77FF] border-[#0A77FF]/25"
                                        : "bg-[#F8FAFC] text-[#475569] border-[#E2E8F0]"
                                    }`}
                                    style={{ fontWeight: 500 }}
                                  >
                                    {isPrimary && <Star className="w-2.5 h-2.5 fill-[#0A77FF] text-[#0A77FF]" />}
                                    {c.name}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="rounded-lg bg-white border border-[#E2E8F0] shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden">
                          <div className="flex items-center justify-between gap-2 px-2.5 sm:px-3 py-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-6 h-6 rounded-md bg-[#F1F5F9] flex items-center justify-center shrink-0">
                                <AlertCircle className="w-3.5 h-3.5 text-[#94A3B8]" />
                              </div>
                              <div className="min-w-0">
                                <span className="text-xs sm:text-[13px] text-[#0F172A]" style={{ fontWeight: 600 }}>
                                  Creating item without category association
                                </span>
                                <p className="text-[11px] text-[#94A3B8] mt-0.5">
                                  Item will be created without category-specific defaults.
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => setStep('categories')}
                              className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-[#475569] hover:border-[#0A77FF] hover:text-[#0A77FF] hover:bg-[#EDF4FF] transition-all shrink-0 text-[11px] sm:text-xs cursor-pointer"
                              style={{ fontWeight: 600 }}
                            >
                              Select Category
                            </button>
                          </div>
                        </div>
                      )}

                      {/* ── Item Details — boxed card ── */}
                      <div className="rounded-lg border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                        <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-b border-[#EEF2F6] flex items-center gap-2 bg-[#FAFBFC] rounded-t-lg">
                          <div className="w-6 h-6 rounded-md bg-[#0A77FF]/8 flex items-center justify-center shrink-0">
                            <Info className="w-3.5 h-3.5 text-[#0A77FF]" />
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs sm:text-[13px] text-[#0F172A]" style={{ fontWeight: 600 }}>Item Details</span>
                            <span className="text-[9px] sm:text-[10px] text-[#94A3B8] tracking-wider uppercase hidden min-[480px]:inline" style={{ fontWeight: 500 }}>Required</span>
                          </div>
                        </div>
                        <div className="px-3 sm:px-4 pt-3 pb-3 sm:pb-4 space-y-3 sm:space-y-4">

                          {/* Part Number Warning Alert */}
                          <AnimatePresence>
                            {showPartNumberWarning && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.15 }}
                                className="flex items-start gap-2 p-2.5 rounded-md border border-[#FCA5A5]/60 bg-[#FEF2F2]"
                              >
                                <AlertCircle className="w-3.5 h-3.5 text-[#DC2626] shrink-0 mt-0.5" />
                                <p className="text-[11px] text-[#7F1D1D] leading-relaxed flex-1">
                                  Please enter a Part Number to continue. This field is required.
                                </p>
                                <button
                                  onClick={() => setShowPartNumberWarning(false)}
                                  className="shrink-0 p-0.5 rounded text-[#DC2626]/70 hover:text-[#DC2626] transition-colors"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                            <div className="space-y-1.5">
                              <Label className="text-[12px] sm:text-[13px] text-[#334155]" style={{ fontWeight: 500 }}>
                                Part Number <span className="text-[#DC2626]">*</span>
                              </Label>
                              <Input
                                value={formData.partNumber}
                                onChange={(e) => {
                                  setFormData(prev => ({ ...prev, partNumber: e.target.value }));
                                  if (showPartNumberWarning && e.target.value.trim() !== '') {
                                    setShowPartNumberWarning(false);
                                  }
                                }}
                                autoFocus
                                className={cn(
                                  "h-8 sm:h-9 text-sm bg-white transition-colors",
                                  showPartNumberWarning
                                    ? "border-[#FCA5A5] focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626]/20"
                                    : "border-[#E2E8F0] focus:border-[#0A77FF] focus:ring-1 focus:ring-[#0A77FF]/20"
                                )}
                                placeholder="e.g. ELEC-001"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-[12px] sm:text-[13px] text-[#334155]" style={{ fontWeight: 500 }}>Status</Label>
                              <Select value={formData.status} onValueChange={(val) => setFormData(prev => ({ ...prev, status: val }))}>
                                <SelectTrigger className="h-8 sm:h-9 text-sm bg-white border-[#E2E8F0] focus:border-[#0A77FF] focus:ring-1 focus:ring-[#0A77FF]/20">
                                  <SelectValue placeholder="Select status..." />
                                </SelectTrigger>
                                <SelectContent>{STATUS_OPTIONS.map((option) => (<SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>))}</SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-[12px] sm:text-[13px] text-[#334155]" style={{ fontWeight: 500 }}>Description</Label>
                            <Textarea
                              value={formData.description}
                              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                              className="min-h-[90px] text-sm bg-white border-[#E2E8F0] focus:border-[#0A77FF] focus:ring-1 focus:ring-[#0A77FF]/20 resize-y"
                              placeholder="Enter a detailed description of the item..."
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-[12px] sm:text-[13px] text-[#334155]" style={{ fontWeight: 500 }}>Tags</Label>
                            <div
                              className="min-h-[36px] p-1.5 rounded-md border border-[#E2E8F0] bg-white flex flex-wrap gap-1.5 items-center focus-within:border-[#0A77FF] focus-within:ring-1 focus-within:ring-[#0A77FF]/20 transition-colors"
                              onClick={() => tagInputRef.current?.focus()}
                            >
                              {formData.tags.map(tag => (
                                <div
                                  key={tag}
                                  className="inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-lg text-[11px] border bg-[#F8FAFC] text-[#475569] border-[#E2E8F0]"
                                  style={{ fontWeight: 500 }}
                                >
                                  <span>{tag}</span>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
                                    className="w-4 h-4 rounded flex items-center justify-center hover:bg-black/10 transition-colors"
                                  >
                                    <X className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                              ))}
                              <input
                                ref={tagInputRef}
                                value={tagInput}
                                onChange={(e) => setTagInput(e.target.value)}
                                onKeyDown={handleAddTag}
                                className="flex-1 bg-transparent border-none outline-none text-sm h-7 min-w-[120px] px-1 placeholder:text-[#94A3B8]"
                                placeholder={formData.tags.length === 0 ? "Type tags..." : ""}
                              />
                            </div>
                            <p className="text-[11px] text-[#94A3B8]">Press enter or comma to add tags.</p>
                          </div>
                        </div>
                      </div>

                      {/* ── Attachments — boxed card ── */}
                      <div className="rounded-lg border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                        <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-b border-[#EEF2F6] flex items-center gap-2 bg-[#FAFBFC] rounded-t-lg">
                          <div className="w-6 h-6 rounded-md bg-[#0A77FF]/8 flex items-center justify-center shrink-0">
                            <Paperclip className="w-3.5 h-3.5 text-[#0A77FF]" />
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs sm:text-[13px] text-[#0F172A]" style={{ fontWeight: 600 }}>Attachments</span>
                            <span className="text-[9px] sm:text-[10px] text-[#94A3B8] tracking-wider uppercase hidden min-[480px]:inline" style={{ fontWeight: 500 }}>Optional</span>
                          </div>
                        </div>
                        <div className="px-3 sm:px-4 pt-3 pb-3 sm:pb-4 space-y-3">
                          {/* Drop area */}
                          <div className="relative group border border-dashed border-[#E2E8F0] hover:border-[#0A77FF]/50 hover:bg-[#FAFCFF] rounded-md h-20 flex items-center justify-center transition-colors cursor-pointer overflow-hidden">
                            <input type="file" multiple className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleFileChange} />
                            <div className="flex items-center gap-2.5 pointer-events-none">
                              <div className="w-8 h-8 rounded-md bg-[#F1F5F9] flex items-center justify-center text-[#64748B] group-hover:text-[#0A77FF] transition-colors">
                                <Upload className="w-4 h-4" />
                              </div>
                              <div className="text-left">
                                <p className="text-[12px] sm:text-[13px] text-[#0F172A]" style={{ fontWeight: 600 }}>Upload Files</p>
                                <p className="text-[11px] text-[#94A3B8]">Drop files here or click to browse</p>
                              </div>
                            </div>
                          </div>

                          {/* Images grid */}
                          {imageAttachments.length > 0 && (
                            <div className="space-y-1.5">
                              <Label className="text-[10px] text-[#94A3B8] tracking-wider uppercase" style={{ fontWeight: 500 }}>
                                Images ({imageAttachments.length})
                              </Label>
                              <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-1.5">
                                {imageAttachments.map((file, i) => {
                                  const url = URL.createObjectURL(file);
                                  return (
                                    <div key={i} className="relative group h-12 w-12 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] overflow-hidden">
                                      <img src={url} alt={file.name} className="w-full h-full object-cover" />
                                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <button
                                          onClick={() => removeFile(file)}
                                          className="w-5 h-5 rounded-full bg-white/90 text-[#DC2626] flex items-center justify-center hover:bg-white transition-colors"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Documents list */}
                          {docAttachments.length > 0 && (
                            <div className="space-y-1.5">
                              <Label className="text-[10px] text-[#94A3B8] tracking-wider uppercase" style={{ fontWeight: 500 }}>
                                Documents ({docAttachments.length})
                              </Label>
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5">
                                {docAttachments.map((file, i) => {
                                  const FileIconComponent = getFileIcon(file);
                                  return (
                                    <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-[#E2E8F0] bg-white group hover:border-[#0A77FF]/30 transition-colors">
                                      <div className="w-7 h-7 rounded bg-[#F1F5F9] flex items-center justify-center text-[#64748B] shrink-0">
                                        <FileIconComponent className="w-3.5 h-3.5" />
                                      </div>
                                      <div className="flex-1 min-w-0 overflow-hidden">
                                        <p className="text-[12px] truncate text-[#0F172A]" style={{ fontWeight: 500 }}>{file.name}</p>
                                        <p className="text-[10px] text-[#94A3B8]">{(file.size / 1024).toFixed(1)} KB</p>
                                      </div>
                                      <button
                                        onClick={() => removeFile(file)}
                                        className="w-6 h-6 rounded-full flex items-center justify-center text-[#94A3B8] hover:text-[#DC2626] hover:bg-[#FEF2F2] transition-colors opacity-0 group-hover:opacity-100"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                    </div>
                  </motion.div>
               ) : (
                  // Advanced Configuration View
                  <motion.div key="config-view" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="flex flex-col h-full bg-background overflow-hidden rounded-none sm:rounded-2xl">
                        {/* Config Header — M.4: white chrome, Category-literal Save button */}
                        <div className="flex items-center justify-between px-8 py-4 border-b border-[#EEF2F6] bg-white z-20 sm:rounded-t-2xl">
                            <div className="flex items-center gap-4">
                                <Button variant="ghost" size="icon" onClick={() => setShowConfig(false)} className="rounded-full hover:bg-secondary"><ArrowLeft size={20} /></Button>
                                <div><h2 className="text-lg font-semibold tracking-tight text-foreground">Configure {primaryCategory?.name}</h2><div className="flex items-center gap-2 text-xs text-muted-foreground"><Badge variant="outline" className="h-4 px-1 rounded-[4px] font-normal">Template</Badge><span>Inheriting from category defaults</span></div></div>
                            </div>
                            <Button onClick={handleSaveConfig} className="bg-[#0A77FF] hover:bg-[#0862D0] text-white shadow-sm rounded-lg px-5 text-[13px] h-9">Save Configuration</Button>
                        </div>

                        <div className="flex flex-1 overflow-hidden">
                            {/* Navigation Sidebar — Slice M.3: Category-literal styling, all 6 tabs incl. Item Definition */}
                            <TooltipProvider delayDuration={300}>
                            <div className="shrink-0 border-r border-border flex flex-col gap-1 p-3 overflow-y-auto bg-white" style={{ width: '250px' }}>
                                {CONFIG_GROUPS.map(group => {
                                    const isActive = activeSectionId === group.id;
                                    return (
                                        <button
                                            key={group.id}
                                            onClick={() => setActiveSectionId(group.id as ConfigSectionType)}
                                            className={`flex items-center gap-3 w-full text-left px-3 py-2.5 transition-all relative cursor-pointer ${!isActive ? 'hover:bg-[#F1F5F9] hover:shadow-[0_1px_2px_rgba(0,0,0,0.04)]' : ''}`}
                                            style={{
                                                borderRadius: '8px',
                                                backgroundColor: isActive ? '#EDF4FF' : 'transparent',
                                                borderLeft: isActive ? '3px solid var(--primary)' : '3px solid transparent',
                                                boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                                            }}
                                        >
                                            <div
                                                className={`shrink-0 flex items-center justify-center transition-all duration-200 ${isActive ? 'bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]' : 'bg-[#F1F5F9]'}`}
                                                style={{ width: '36px', height: '36px', borderRadius: '10px' }}
                                            >
                                                <group.icon style={{ width: '17px', height: '17px', color: isActive ? 'var(--primary)' : '#64748B' }} />
                                            </div>
                                            <div className="flex flex-col min-w-0 flex-1">
                                                <span style={{ fontSize: '13px', fontWeight: isActive ? 600 : 500, color: '#374151', lineHeight: 1.3 }}>{group.label}</span>
                                                <span style={{ fontSize: '11px', fontWeight: 400, color: '#94A3B8', lineHeight: 1.3, marginTop: 2 }}>{group.description}</span>
                                            </div>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div className="shrink-0 flex items-center justify-center cursor-help" onClick={(e) => e.stopPropagation()}>
                                                        <Info style={{ width: 13, height: 13, color: isActive ? 'var(--primary)' : '#94A3B8', opacity: 0.6 }} />
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent side="right">
                                                    <p style={{ fontSize: 12, lineHeight: 1.5 }}>{group.description}</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </button>
                                    );
                                })}
                            </div>
                            </TooltipProvider>

                            {/* Main Content Area */}
                            <div className="flex-1 overflow-y-auto bg-white">
                                {/* Per-section summary strips — Slice M.3 (no GovernanceSummaryStrip, matches Category) */}
                                {activeSectionId === 'definition' && <ItemDefinitionSummaryStrip config={formData.config} />}
                                {activeSectionId === 'inventory' && <StockLogisticsSummaryStrip config={formData.config} />}
                                {activeSectionId === 'procurement' && <ProcurementSummaryStrip config={formData.config} />}
                                {activeSectionId === 'fulfillment' && <SellingSummaryStrip config={formData.config} />}
                                {activeSectionId === 'materialHandling' && <CycleCountingSummaryStrip config={formData.config} />}

                                <div className="max-w-4xl mx-auto px-8 py-8 pb-24 space-y-8">
                                    {/* Material Handling — Slice M.3 */}
                                    {activeSectionId === 'materialHandling' && (
                                        <MaterialHandlingSection config={formData.config} onConfigChange={handleConfigChange} />
                                    )}
                                    {/* Definition Section */}

                                    {/* Definition — unified shared component */}
                                    {activeSectionId === 'definition' && (
                                        <ItemDefinitionSection
                                            config={formData.config}
                                            onConfigChange={handleConfigChange}
                                            setFormData={setFormData}
                                        />
                                    )}

                                    {/* Inventory Section */}
                                    {/* Stock & Logistics — unified shared component */}
                                    {activeSectionId === 'inventory' && (
                                        <StockLogisticsSection
                                            config={formData.config}
                                            onConfigChange={handleConfigChange}
                                            toggleLocation={toggleLocation}
                                        />
                                    )}

                                    {/* Procurement Section */}
                                    {/* Procurement — unified shared component */}
                                    {activeSectionId === 'procurement' && (
                                        <ProcurementSection
                                            config={formData.config}
                                            onConfigChange={handleConfigChange}
                                            partNumber={formData.partNumber}
                                        />
                                    )}

                                    {/* Fulfillment Section */}
                                    {/* Selling — unified shared component */}
                                    {activeSectionId === 'fulfillment' && (
                                        <SellingSection
                                            config={formData.config}
                                            onConfigChange={handleConfigChange}
                                            togglePartner={togglePartner}
                                            updatePartnerRules={updatePartnerRules}
                                        />
                                    )}

                                    {/* Accounting Section */}
                                    {activeSectionId === 'accounting' && (
                                        <div className="space-y-6">
                                            <ConfigCard title="ACCOUNTS">
                                                <div className="space-y-4">Accounting configuration here</div>
                                            </ConfigCard>
                                        </div>
                                    )}

                                    {/* Governance — Slice Pair C: unified Category-literal styling */}
                                    {activeSectionId === 'governance' && (
                                        <GovernanceSection
                                            config={formData.config}
                                            onConfigChange={handleConfigChange}
                                        />
                                    )}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        {!showConfig && step !== 'success' && (
          <div className="shrink-0 border-t border-[#EEF2F6] bg-white px-3 sm:px-4 lg:px-5 py-2.5 sm:py-3 flex items-center justify-end gap-2 sm:gap-2.5 sm:rounded-b-2xl">
            {step === 'categories' ? (
              <>
                <Button variant="outline" onClick={handleClose} className="border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A] hover:border-[#CBD5E1] rounded-lg px-3 sm:px-5 text-xs sm:text-[13px] h-8 sm:h-9">
                  Cancel
                </Button>
                <Button
                  onClick={() => setStep('basic')}
                  disabled={formData.selectedCategories.length === 0}
                  className="gap-1.5 rounded-lg px-3 sm:px-5 text-xs sm:text-[13px] h-8 sm:h-9 shadow-sm"
                >
                  Continue
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </>
            ) : (
              <>
                <button
                  onClick={handleBack}
                  className="inline-flex items-center gap-1.5 text-xs sm:text-[13px] text-[#64748B] hover:text-[#0F172A] transition-colors mr-auto"
                  style={{ fontWeight: 500 }}
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Back</span>
                </button>
                <Button variant="outline" onClick={handleClose} className="border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A] hover:border-[#CBD5E1] rounded-lg px-3 sm:px-5 text-xs sm:text-[13px] h-8 sm:h-9">
                  Cancel
                </Button>
                <Button onClick={handleCreate} className="gap-1.5 rounded-lg px-3 sm:px-5 text-xs sm:text-[13px] h-8 sm:h-9 shadow-sm">
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Create Item</span>
                  <span className="sm:hidden">Create</span>
                </Button>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>

    {/* Category Items Quick View — Partners-literal overlay (no nested Radix Dialog) */}
    {viewCategoryItemsOpen && viewCategoryId && (
      <CategoryItemsQuickViewOverlay
        category={CATEGORIES.find(c => c.id === viewCategoryId)!}
        items={CATEGORY_ITEMS[viewCategoryId] ?? []}
        onClose={() => { setViewCategoryItemsOpen(false); setViewCategoryId(null); }}
      />
    )}

    <AddQualifiedVendorDialog
      open={addVendorDialogOpen}
      onOpenChange={setAddVendorDialogOpen}
      onAdd={(vendor) => {
        const currentVendors = formData.config.qualifiedVendors || [];
        handleConfigChange('qualifiedVendors', [...currentVendors, vendor]);
        setAddVendorDialogOpen(false);
      }}
      baseUom={formData.config.uom}
      existingVendorCount={formData.config.qualifiedVendors?.length || 0}
    />
    </>
  );
}