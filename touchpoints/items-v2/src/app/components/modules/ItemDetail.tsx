// @ts-nocheck
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ItemOverviewTab } from './itemDetail/ItemOverviewTab';
import { 
  ArrowLeft, 
  ArrowRight,
  Edit, 
  MoreHorizontal, 
  Printer, 
  Copy, 
  Archive, 
  TrendingUp, 
  AlertCircle, 
  History,
  ShoppingCart,
  FileText,
  Tag,
  DollarSign,
  Search,
  ChevronDown,
  Plus,
  Trash2,
  Image as ImageIcon,
  Save,
  Users,
  Settings,
  AlertTriangle,
  Check,
  Info,
  Globe,
  Receipt,
  Layers,
  Wrench,
  Boxes,
  LayoutDashboard,
  Clock,
  MapPin,
  Calendar,
  Share2,
  Factory,
  Hash,
  Box,
  Barcode,
  Building2,
  Truck,
  Paperclip,
  ArrowUpRight,
  ArrowDownLeft,
  Upload,
  RefreshCw,
  MoreVertical,
  Filter,
  Settings2,
  Download,
  X,
  Shield,
  Lightbulb,
  Eye,
  FileSpreadsheet,
  File,
  LayoutGrid,
  List,
  ShieldCheck,
  Lock,
  Star,
  LayoutTemplate,
  Move,
  ClipboardCheck,
  SlidersHorizontal,
  Warehouse,
  Gavel,
  FileImage,
  FileCode,
  FileArchive,
  Cpu,
  Cog,
  Zap,
  Wind,
  Package,
  CircleDot,
  File as FileIcon,
  BarChart3,
  Link as LinkIcon,
  Tags,
  QrCode,
  ClipboardList,
  Activity,
  UserCircle2,
  ChevronUp,
  PieChart as PieChartIcon,
  ScanBarcode,
  Flame,
  Droplets,
  Skull,
  CheckCircle2,
  ShieldAlert
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Separator } from '../ui/separator';
import { Progress } from '../ui/progress';
import { Input } from '../ui/input';
import { Switch } from "../ui/switch";
import { Label } from "../ui/label";
import { Checkbox } from "../ui/checkbox";
import { Textarea } from "../ui/textarea";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { InsightsDrawerContent } from './InsightsDrawerContent';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { cn } from '../../../lib/utils';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
  ReferenceLine
} from 'recharts';
import ItemConfigurationMaster from './ItemConfigurationMaster';
import { QualifiedVendorsTab } from './QualifiedVendorsTab';
import { SalesOverviewPanel } from './SalesOverview/SalesOverviewPanel';
import { ShipmentsTable } from './SalesOverview/ShipmentsTable';
import { QuotesOverview } from './QuotesOverview';
import { ItemDetailHeader } from './itemDetail/ItemDetailHeader';
import { StockHealthWidget } from './itemDetail/StockHealthWidget';
import {
  ColumnSelector,
  ColumnSelectorTrigger,
  TransactionStatusBadge,
  InitialAvatar,
  ComingSoonEmptyState,
} from '../items-v3';
import type { ColumnConfig } from '../items-v3';
import {
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  ChevronRight,
  AlignJustify,
} from 'lucide-react';

// --- Types ---
interface Item {
  id: string;
  partNumber: string;
  description: string;
  status: string;
  images: string[];
  inventoryControlType: string;
  primaryCategory: string;
  additionalCategories: string[];
  onHandQty: number;
  unit: string;
  alternativeStockingUnits: string;
  inboundLocations: string[];
  outboundLocations: string[];
  acquisitionMethod: string;
  manufacturer: string;
  mpn: string;
  ownerId: string;
  // Extended fields for configurations
  cost: number;
  price: number;
  weight: string;
  dimensions: string;
  safetyStock: number;
  reorderPoint: number;
  leadTime: number;
}

interface ItemDetailProps {
  item?: Item;
  onBack: () => void;
  onEdit: () => void;
  scrollContainerRef?: React.RefObject<HTMLDivElement>;
}

// --- Configuration Types & Components ---

type ConfigSectionType = 
  | 'definition'
  | 'inventory'
  | 'procurement'
  | 'fulfillment'
  | 'governance';

const MOCK_CATEGORIES = [
  'Electronics', 'Computers', 'Peripherals', 'Components', 'Cables', 'Networking', 'Storage', 'Accessories',
  'Office Supplies', 'Furniture', 'Raw Materials', 'Finished Goods', 'Packaging', 'Safety Equipment'
];

interface AdvancedConfig {
  inventoryType: string;
  uom: string;
  acquisitionMethod: string[];
  controlType: string;
  
  // Categorization
  primaryCategory: string;
  additionalCategories: string[];

  // Lot Control Extension
  lotControlEnabled: boolean;
  lotIdSource: 'system' | 'vendor';
  vendorLotCapture: 'optional' | 'required';
  shelfLifeEnabled: boolean;
  lotPrefix: string;

  minStock: string;
  maxStock: string;
  stockUom: string;
  inboundLocation: string[];
  outboundLocation: string[];
  
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
  
  // Ownership
  engineeringOwner: string[];
  purchasingOwner: string[];
  schedulingOwner: string[];
  salesOwner: string[];
  arOwner: string[];
  
  // Fulfillment Updates
  sellingScope: 'all' | 'specific';
  specificPartners: string[]; 
  partnerRules: Record<string, string[]>;
  pricing: { price: string; uom: string; id: string }[]; 
  
  valuationMethod: 'fifo' | 'wac' | 'lifo' | 'specific';
}

const DEFAULT_CONFIG: AdvancedConfig = {
  inventoryType: 'Stock',
  uom: 'Each',
  acquisitionMethod: ['Purchased'],
  controlType: 'Non-serialized',
  
  primaryCategory: 'Electronics',
  additionalCategories: ['Components'],

  lotControlEnabled: false,
  lotIdSource: 'system',
  vendorLotCapture: 'optional',
  shelfLifeEnabled: false,
  lotPrefix: 'LOT-',

  minStock: '10',
  maxStock: '1000',
  stockUom: 'Each',
  inboundLocation: ['Warehouse A - Main Hall'],
  outboundLocation: ['Warehouse A - Main Hall'],
  
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
  
  engineeringOwner: [],
  purchasingOwner: [],
  schedulingOwner: [],
  salesOwner: [],
  arOwner: [],
  
  sellingScope: 'all',
  specificPartners: [],
  partnerRules: {},
  pricing: [{ price: '0.00', uom: 'Each', id: '1' }],
  
  valuationMethod: 'fifo',
};

const CONFIG_GROUPS = [
  { id: 'definition', label: 'Item Definition', icon: Box, description: 'Core identity, UOM, and tracking method.' },
  { id: 'inventory', label: 'Stock & Logistics', icon: Layers, description: 'Stock levels, locations, and counting rules.' },
  { id: 'procurement', label: 'Procurement', icon: ShoppingCart, description: 'Purchasing rules, limits, and suppliers.' },
  { id: 'fulfillment', label: 'Fulfillment & Logistics', icon: Truck, description: 'Selling scope, partners, and pricing.' },
  { id: 'governance', label: 'Governance', icon: Shield, description: 'Ownership, valuation, and compliance.' }
];

const LOCATIONS = [
    'Warehouse A - Main Hall', 'Warehouse B - Cold Storage', 'Production Line 1 - Assembly', 'Returns Dock', 
    'Quarantine Zone - Hazardous', 'Distribution Center - East Wing', 'Overflow Storage - Offsite', 'Cold Storage Unit 4',
    'Warehouse C - Electronics', 'Warehouse D - Raw Materials', 'Production Line 2 - Packaging', 'Shipping Dock 1'
];

const UOMS = ['Each', 'Box', 'Case', 'Pallet', 'kg', 'm', 'Liter', 'Roll', 'Pair', 'Roll100m', 'Meter'];

const generatePartners = () => {
    const partners = [
        { id: 'p1', name: 'Acme Corporation' },
        { id: 'p2', name: 'Globex Industries' },
        { id: 'p3', name: 'Soylent Corp' },
        { id: 'p4', name: 'Initech Solutions' },
        { id: 'p5', name: 'Umbrella Corporation' },
        { id: 'p6', name: 'Stark Industries' },
        { id: 'p7', name: 'Wayne Enterprises' },
        { id: 'p8', name: 'Oscorp Industries' },
        { id: 'p9', name: 'Cyberdyne Systems' },
        { id: 'p10', name: 'Tyrell Corporation' },
        { id: 'p11', name: 'Massive Dynamic' },
        { id: 'p12', name: 'Wonka Industries' },
        { id: 'p13', name: 'Bluth Company' },
        { id: 'p14', name: 'Dunder Mifflin' },
        { id: 'p15', name: 'Sterling Cooper' },
        { id: 'p16', name: 'Pied Piper' },
        { id: 'p17', name: 'Hooli Inc' },
        { id: 'p18', name: 'Aviato' },
        { id: 'p19', name: 'Vehement Capital' },
        { id: 'p20', name: 'Raviga Capital' },
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

const MOCK_USERS = [
  { id: 'u1', name: 'Alice Smith', role: 'Engineer', initials: 'AS' },
  { id: 'u2', name: 'Bob Jones', role: 'Purchasing', initials: 'BJ' },
  { id: 'u3', name: 'Charlie Day', role: 'Scheduler', initials: 'CD' }
];

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
                                {isDefault && <span className="text-xs text-[var(--muted-foreground)] ml-1 font-medium">(Default)</span>}
                                <div className="w-px h-3 bg-[var(--border)] mx-1" />
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
                            <div className="h-6 w-6 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center text-xs font-semibold border border-[var(--primary)]/20">
                                {user.initials}
                            </div>
                            <div className="flex flex-col flex-1 min-w-0">
                                <span className="text-sm font-medium truncate">{user.name}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
};

const ConfigSelect = ({ value, onValueChange, options, placeholder }: { value: string, onValueChange: (v: string) => void, options: string[], placeholder: string }) => {
  return (
    <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="w-full h-9 bg-background border-border hover:border-primary/50 transition-colors focus:ring-1 focus:ring-primary/20"><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>
            {options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
    </Select>
  );
};

const InfoBanner = ({ icon: Icon, colorClass, text }: { icon: any, colorClass: string, text: string }) => (
    <div className={cn("flex items-center gap-3 p-4 rounded-lg border mb-6 bg-opacity-10", colorClass)}>
        <Icon size={18} />
        <p className="text-sm font-medium">{text}</p>
    </div>
);

const ConfigCard = ({ title, children }: { title: string, children: React.ReactNode }) => (
    <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-sm overflow-hidden h-full hover:border-[var(--border)] transition-colors">
        <div className="px-6 py-4 border-b border-[var(--border)]">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">{title}</h4>
        </div>
        <div className="p-6">{children}</div>
    </div>
);

const VisualHeader = ({ type, data }: { type: ConfigSectionType, data: AdvancedConfig }) => {
  const isPurchased = data.acquisitionMethod.includes('Purchased');
  const isManufactured = data.acquisitionMethod.includes('Manufactured');
  const inboundCount = Array.isArray(data.inboundLocation) ? data.inboundLocation.length : 0;
  const outboundCount = Array.isArray(data.outboundLocation) ? data.outboundLocation.length : 0;
  const pricingCount = Array.isArray(data.pricing) ? data.pricing.filter(p => p.price && p.price !== '0.00').length : 0;

  return (
    <div className="w-full h-40 bg-secondary/10 border-b border-border relative overflow-x-auto">
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, var(--primary) 1px, transparent 0)', backgroundSize: '24px 24px' }} />
      <div className="h-full min-w-max flex items-center justify-center p-6 mx-auto relative z-10">
      
      {type === 'definition' && (
        <div className="flex items-center gap-12 relative z-10">
          <div className="flex flex-col items-center gap-2">
            <div className="h-16 w-16 bg-[var(--background)] rounded-xl border border-[var(--primary)]/30 shadow-sm flex items-center justify-center relative">
               <Box size={28} className="text-[var(--primary)]" />
               <div className="absolute -top-2 -right-2 bg-[var(--primary)] text-[var(--primary-foreground)] text-[10px] font-semibold px-2 py-1 rounded-full shadow-sm">{data.uom}</div>
            </div>
            <span className="text-xs font-medium uppercase text-[var(--muted-foreground)] tracking-wide">{data.inventoryType}</span>
          </div>
          <ArrowRight className="text-border" />
          <div className="flex gap-2">
             {isPurchased && (<div className="flex flex-col items-center gap-2"><div className="h-10 w-10 bg-[var(--primary)]/10 border border-[var(--primary)]/20 rounded-lg flex items-center justify-center text-[var(--primary)]"><ShoppingCart size={18} /></div><span className="text-xs font-medium text-[var(--primary)]">Buy</span></div>)}
             {isManufactured && (<div className="flex flex-col items-center gap-2"><div className="h-10 w-10 bg-[var(--chart-3)]/10 border border-[var(--chart-3)]/20 rounded-lg flex items-center justify-center text-[var(--chart-3)]"><Wrench size={18} /></div><span className="text-xs font-medium text-[var(--chart-3)]">Make</span></div>)}
          </div>
          <ArrowRight className="text-border" />
          <div className="flex flex-col items-center gap-2">
             <div className="h-16 w-16 bg-background rounded-xl border border-border shadow-sm flex items-center justify-center relative overflow-hidden">
                {data.controlType === 'Serialized' ? <Barcode size={28} className="text-[var(--foreground)] opacity-80" /> : <Layers size={28} className="text-[var(--foreground)] opacity-80" />}
                {data.lotControlEnabled && <div className="absolute top-0 right-0 p-1"><div className="h-2 w-2 rounded-full bg-[var(--accent)] border border-[var(--background)] ring-1 ring-[var(--accent)]/20" /></div>}
             </div>
             <div className="flex flex-col items-center">
               <span className="text-[10px] font-semibold text-foreground">{data.controlType}</span>
               {data.lotControlEnabled && <span className="text-[9px] text-emerald-600 font-medium flex items-center gap-0.5"><Check size={8} /> Lot Tracked</span>}
             </div>
          </div>
        </div>
      )}

      {type === 'inventory' && (
        <div className="flex items-center gap-16 relative z-10">
            <div className="flex items-end gap-3 group">
                <div className="flex flex-col items-center gap-2"><div className="text-xs font-medium text-[var(--muted-foreground)]">Min</div><div className="w-14 bg-[var(--secondary)]/30 rounded-t-md relative overflow-hidden border border-[var(--border)] border-b-0 h-16 flex items-end justify-center"><div className="w-full bg-[var(--chart-3)]/60 h-[30%]" /><div className="absolute bottom-1.5 text-xs font-semibold text-[var(--foreground)] z-10">{data.minStock}</div></div></div>
                <div className="flex flex-col items-center gap-2"><div className="text-xs font-medium text-[var(--muted-foreground)]">Max</div><div className="w-14 bg-[var(--secondary)]/30 rounded-t-md relative overflow-hidden border border-[var(--border)] border-b-0 h-24 flex items-end justify-center"><div className="w-full bg-[var(--primary)]/60 h-[80%]" /><div className="absolute bottom-1.5 text-xs font-semibold text-[var(--foreground)] z-10">{data.maxStock}</div></div></div>
            </div>
            <div className="h-12 w-px bg-[var(--border)]" />
            <div className="flex items-center gap-6">
                <div className="flex flex-col items-center gap-2"><div className="relative"><div className="h-10 w-10 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center text-[var(--accent)] shadow-sm"><ArrowRight size={16} className="rotate-45" /></div>{inboundCount > 0 && <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center rounded-full bg-[var(--accent)] border-2 border-[var(--background)] text-xs font-semibold">{inboundCount}</Badge>}</div><span className="text-xs font-medium text-[var(--foreground)]">Inbound</span></div>
                <div className="h-1 w-12 border-t-2 border-dashed border-[var(--border)]" />
                <div className="flex flex-col items-center gap-2"><div className="relative"><div className="h-10 w-10 rounded-full bg-[var(--primary)]/10 border border-[var(--primary)]/20 flex items-center justify-center text-[var(--primary)] shadow-sm"><ArrowRight size={16} className="-rotate-45" /></div>{outboundCount > 0 && <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center rounded-full bg-[var(--primary)] border-2 border-[var(--background)] text-xs font-semibold">{outboundCount}</Badge>}</div><span className="text-xs font-medium text-[var(--foreground)]">Outbound</span></div>
            </div>
        </div>
      )}
      
      {type === 'procurement' && (
        <div className="flex items-center gap-16 relative z-10">
            <div className="flex items-end gap-3 group">
                <div className="flex flex-col items-center gap-2"><div className="text-xs font-medium text-[var(--muted-foreground)]">Min Order</div><div className="w-14 bg-[var(--secondary)]/30 rounded-t-md relative overflow-hidden border border-[var(--border)] border-b-0 h-16 flex items-end justify-center"><div className="w-full bg-[var(--chart-4)]/60 h-[40%]" /><div className="absolute bottom-1.5 text-xs font-semibold text-[var(--foreground)] z-10">{data.minPurchase}</div></div></div>
                <div className="flex flex-col items-center gap-2"><div className="text-xs font-medium text-[var(--muted-foreground)]">Max Order</div><div className="w-14 bg-[var(--secondary)]/30 rounded-t-md relative overflow-hidden border border-[var(--border)] border-b-0 h-24 flex items-end justify-center"><div className="w-full bg-[var(--chart-1)]/60 h-[90%]" /><div className="absolute bottom-1.5 text-xs font-semibold text-[var(--foreground)] z-10">{data.maxPurchase}</div></div></div>
            </div>
            <div className="h-12 w-px bg-[var(--border)]" />
            <div className="flex flex-col items-center gap-2">
                <div className="relative"><div className="h-14 w-14 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-600 shadow-sm"><Boxes size={24} /></div><Badge className="absolute -top-2 -right-2 h-6 min-w-[24px] p-0 px-1.5 flex items-center justify-center rounded-full bg-orange-600 border-2 border-white text-xs">x{data.multiples}</Badge></div>
                <span className="text-[10px] font-semibold text-foreground">Order Multiples</span>
            </div>
        </div>
      )}

      {type === 'fulfillment' && (
        <div className="flex items-center gap-16 relative z-10">
             <div className="flex flex-col items-center gap-2"><div className="relative"><div className={cn("h-16 w-16 rounded-xl border flex items-center justify-center shadow-sm transition-colors", data.sellingScope === 'all' ? "bg-[var(--primary)]/10 border-[var(--primary)]/20 text-[var(--primary)]" : "bg-[var(--chart-4)]/10 border-[var(--chart-4)]/20 text-[var(--chart-4)]")}>{data.sellingScope === 'all' ? <Globe size={32} strokeWidth={1.5} /> : <Building2 size={32} strokeWidth={1.5} />}</div></div><span className="text-xs font-medium text-[var(--foreground)] uppercase tracking-wide">{data.sellingScope === 'all' ? 'Global Market' : 'Partner Only'}</span></div>
             <div className="h-12 w-px bg-[var(--border)]" />
             <div className="flex flex-col items-center gap-2"><div className="relative group"><div className="h-14 w-14 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center text-[var(--accent)] shadow-sm"><DollarSign size={28} /></div><Badge className="absolute -top-2 -right-2 h-6 min-w-[24px] p-0 px-1.5 flex items-center justify-center rounded-full bg-[var(--accent)] border-2 border-[var(--background)] text-xs font-semibold">{pricingCount}</Badge></div><span className="text-xs font-medium text-[var(--foreground)] uppercase tracking-wide">Price Points</span></div>
        </div>
      )}
      </div>
    </div>
  );
};

// --- Mock Data ---
const inventoryTrendData = [
  { month: 'Jan', onHand: 1100, available: 850, onOrder: 400 },
  { month: 'Feb', onHand: 1050, available: 800, onOrder: 450 },
  { month: 'Mar', onHand: 1200, available: 950, onOrder: 380 },
  { month: 'Apr', onHand: 1150, available: 900, onOrder: 420 },
  { month: 'May', onHand: 1300, available: 1000, onOrder: 500 },
  { month: 'Jun', onHand: 1247, available: 892, onOrder: 500 },
];

const uomData = [
  { name: 'Each (EA)',     qty: 450,  value: 450, color: 'hsl(var(--chart-1))' },
  { name: 'Box (2 EA)',    qty: 50,   value: 100, color: 'hsl(var(--chart-2))' },
  { name: 'Carton (8 EA)', qty: 15,   value: 120, color: 'hsl(var(--chart-3))' },
  { name: 'Pallet (80 EA)', qty: 1.87, value: 150, color: 'hsl(var(--chart-4))' },
];

const weeklyActivityData = [
  { day: '17 Sep, Wed', increase: 35, decrease: 60 },
  { day: '18 Sep, Thurs', increase: 20, decrease: 25 },
  { day: '19 Sep, Fri', increase: 45, decrease: 15 },
  { day: '20 Sep, Sat', increase: 30, decrease: 40 },
  { day: '21 Sep, Sun', increase: 35, decrease: 20 },
  { day: '22 Sep, Mon', increase: 35, decrease: 10 },
  { day: '23 Sep, Tues', increase: 35, decrease: 10 },
];

// --- Custom Widgets ---

const CumulativeStockHealthWidget = ({ item }: { item: Item }) => {
    // Stock Health — clean half-circle SVG gauge (180° sweep, left→right).
    // Three zones: destructive (low) · success (healthy) · warning (over).
    // Color mirrors Partners' Credit Health palette and is consistent with
    // recharts tokens used in the other widgets.
    const onHand = Number(item.onHandQty) || 0;
    const minQty = 200;
    const maxQty = 3000;
    const span = Math.max(maxQty - minQty, 1);
    const pct = Math.max(0, Math.min(1, (onHand - minQty) / span));
    const status = pct < 0.20 ? "Low" : pct > 0.85 ? "Over" : "Healthy";
    const statusColor =
      status === "Low" ? "hsl(var(--destructive))"
      : status === "Over" ? "hsl(var(--warning))"
      : "hsl(var(--success))";

    // Half-circle geometry — sweep from 180° (left) to 360°/0° (right).
    const svgW = 220;
    const svgH = 130;
    const cx = svgW / 2;
    const cy = svgH - 14;
    const r = 92;
    const thickness = 16;
    const totalDeg = 180;
    const startDeg = 180;
    const midR = r - thickness / 2;

    const zones = [
      { key: "low",     pct: 20, color: "hsl(var(--destructive) / 0.55)" },
      { key: "healthy", pct: 65, color: "hsl(var(--success))"            },
      { key: "over",    pct: 15, color: "hsl(var(--warning) / 0.65)"     },
    ];

    const polar = (deg: number) => {
      const rad = (deg * Math.PI) / 180;
      return { x: cx + midR * Math.cos(rad), y: cy + midR * Math.sin(rad) };
    };
    const describeArc = (sDeg: number, eDeg: number) => {
      const a = startDeg + sDeg;
      const b = startDeg + eDeg;
      const p1 = polar(a);
      const p2 = polar(b);
      const largeArc = b - a > 180 ? 1 : 0;
      return `M ${p1.x} ${p1.y} A ${midR} ${midR} 0 ${largeArc} 1 ${p2.x} ${p2.y}`;
    };
    let cum = 0;
    const segs = zones.map((z, i) => {
      const segStart = cum;
      const segEnd = cum + (z.pct / 100) * totalDeg;
      cum = segEnd;
      return { ...z, d: describeArc(segStart, segEnd), isFirst: i === 0, isLast: i === zones.length - 1 };
    });
    // Needle: -90° (vertical up) at pct 0.5; sweep ±90°.
    const needleAngle = -90 + pct * 180;

    const stats = [
      { label: "Available",           value: "400 EA" },
      { label: "Allocated",           value: "50 EA" },
      { label: "On Order",            value: "2,000 EA" },
      { label: "Quarantined",         value: "0" },
      { label: "In Production",       value: "0" },
      { label: "Projected Available", value: "2,400 EA" },
    ];
    return (
      <div className="flex flex-col gap-3 h-full">
        {/* Gauge */}
        <div className="flex justify-center w-full">
          <div className="relative max-w-full" style={{ width: svgW, height: svgH }}>
            <svg width="100%" height="100%" viewBox={`0 0 ${svgW} ${svgH}`} preserveAspectRatio="xMidYMid meet">
              {segs.map((z) => (
                <path
                  key={z.key}
                  d={z.d}
                  fill="none"
                  stroke={z.color}
                  strokeWidth={thickness}
                  strokeLinecap={z.isFirst || z.isLast ? "round" : "butt"}
                />
              ))}
              {/* Needle */}
              <g
                style={{
                  transform: `rotate(${needleAngle}deg)`,
                  transformOrigin: `${cx}px ${cy}px`,
                  transition: "transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)",
                }}
              >
                <line
                  x1={cx}
                  y1={cy - 6}
                  x2={cx}
                  y2={cy - r + thickness + 18}
                  stroke="hsl(var(--foreground))"
                  strokeWidth={2}
                  strokeLinecap="round"
                />
                <circle cx={cx} cy={cy} r={4} fill="hsl(var(--foreground))" />
              </g>
            </svg>
            {/* Center text */}
            <div
              className="absolute flex flex-col items-center"
              style={{ bottom: -2, left: "50%", transform: "translateX(-50%)", pointerEvents: "none" }}
            >
              <span className="text-[20px] text-foreground leading-none" style={{ fontWeight: 600 }}>
                {onHand.toLocaleString()}
              </span>
              <span className="text-[10px] text-muted-foreground mt-0.5" style={{ fontWeight: 500 }}>
                EA On-Hand
              </span>
            </div>
          </div>
        </div>

        {/* Min / status / Max row */}
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] text-muted-foreground" style={{ fontWeight: 500 }}>Min · {minQty} EA</span>
          <span
            className="text-[11px] inline-flex items-center gap-1 px-2 py-0.5 rounded-md"
            style={{ fontWeight: 600, color: statusColor, background: `${statusColor.replace(")", " / 0.1)")}` }}
          >
            {status}
          </span>
          <span className="text-[11px] text-muted-foreground" style={{ fontWeight: 500 }}>Max · {maxQty.toLocaleString()} EA</span>
        </div>

        {/* Detail grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 pt-3 border-t border-muted">
          {stats.map((s) => (
            <div key={s.label} className="min-w-0">
              <p className="text-[10px] text-muted-foreground truncate" style={{ fontWeight: 500 }}>{s.label}</p>
              <p className="text-[12px] text-foreground truncate" style={{ fontWeight: 600 }}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>
    );
}

const TopLocationsWidget = () => {
    // Location Distribution — horizontal bar list. All rows share the same
    // bar height (h-2.5) — only width varies by qty. Single primary color
    // with stepped opacity to keep the visual hierarchy without rainbow.
    const rows = [
      { name: "Zone A-02",     qty: 140 },
      { name: "Zone B-05",     qty: 100 },
      { name: "Rack C-11",     qty: 85 },
      { name: "Jonas Summers", qty: 50 },
      { name: "Others",        qty: 58 },
    ];
    const total = rows.reduce((s, r) => s + r.qty, 0);
    const max   = Math.max(...rows.map((r) => r.qty));
    const alphas = [1, 0.85, 0.7, 0.55, 0.4];
    return (
      <div className="flex-1 flex flex-col justify-center space-y-3">
        {rows.map((r, i) => {
          const widthPct = (r.qty / max) * 100;
          const sharePct = Math.round((r.qty / total) * 100);
          return (
            <div key={r.name} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2 min-w-0">
                <span className="text-[11px] text-muted-foreground truncate" style={{ fontWeight: 500 }} title={r.name}>
                  {r.name}
                </span>
                <span className="text-[11px] text-foreground tabular-nums shrink-0" style={{ fontWeight: 600 }}>
                  {r.qty} EA
                  <span className="ml-1 text-muted-foreground" style={{ fontWeight: 500 }}>({sharePct}%)</span>
                </span>
              </div>
              <div className="relative h-2.5 rounded-full bg-muted/50 overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                  style={{ width: `${widthPct}%`, background: `hsl(var(--primary) / ${alphas[i] ?? 0.3})` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
}

const UOMWidget = ({ item }: { item: Item }) => {
    // On-Hand by Unit of Measure — Physical Inventory parity: pure SVG donut
    // (no Recharts) with centered total, expanded legend rows showing both
    // unit qty → converted EA and percentage. Items' chart tokens win over PI's.
    const totalConverted = uomData.reduce((s, d) => s + d.value, 0);

    /* SVG donut params */
    const cx = 70, cy = 70, r = 52, thickness = 14;
    const circumference = 2 * Math.PI * r;
    let cumOffset = 0;
    const segments = uomData.map((entry) => {
      const pct = entry.value / totalConverted;
      const dashLen = pct * circumference;
      const gapLen = circumference - dashLen;
      const offset = -cumOffset;
      cumOffset += dashLen;
      return { ...entry, dashLen, gapLen, offset };
    });

    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-center relative">
          <svg width={140} height={140} viewBox={`0 0 ${cx * 2} ${cy * 2}`}>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="hsl(var(--border))" strokeWidth={thickness} opacity={0.4} />
            {segments.map((seg) => (
              <circle
                key={seg.name}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth={thickness}
                strokeDasharray={`${seg.dashLen} ${seg.gapLen}`}
                strokeDashoffset={seg.offset}
                strokeLinecap="butt"
                style={{ transform: "rotate(-90deg)", transformOrigin: `${cx}px ${cy}px` }}
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[18px] text-foreground leading-none" style={{ fontWeight: 600 }}>
              {totalConverted}
            </span>
            <span className="text-[10px] text-muted-foreground mt-0.5" style={{ fontWeight: 500 }}>
              Total EA
            </span>
          </div>
        </div>

        {/* Legend rows */}
        <div className="flex flex-col gap-1.5">
          {uomData.map((d) => {
            const pct = Math.round((d.value / totalConverted) * 100);
            return (
              <div
                key={d.name}
                className="flex items-center justify-between rounded-md px-1.5 py-0.5 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="text-[12px] text-foreground truncate" style={{ fontWeight: 500 }}>{d.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[12px] text-foreground tabular-nums" style={{ fontWeight: 600 }}>
                    {d.value}
                  </span>
                  <span
                    className="inline-flex items-center justify-center text-[10px] text-muted-foreground rounded bg-muted/60 tabular-nums"
                    style={{ fontWeight: 600, minWidth: 32, padding: "1px 6px" }}
                  >
                    {pct}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
}

const ActivityWidget = () => {
    // Transaction Activity — PI structure (grouped bars + summary header)
    // re-skinned to Partners' Order Activity palette: `hsl(var(--primary))`
    // for Increase + `#F59E0B` (amber) for Decrease. Axis text `#94A3B8`,
    // grid stroke `hsl(var(--muted))`, barSize 18, radius [4,4,0,0].
    const totalInc = weeklyActivityData.reduce((s, d) => s + d.increase, 0);
    const totalDec = weeklyActivityData.reduce((s, d) => s + d.decrease, 0);
    const net = totalInc - totalDec;
    const ttStyle = {
      borderRadius: 8,
      border: "1px solid hsl(var(--border))",
      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
      fontSize: 12,
      background: "hsl(var(--card))",
    };
    return (
      <div className="flex flex-col h-full">
        {/* Summary row — PI idiom */}
        <div className="flex items-center flex-wrap gap-x-5 gap-y-1.5 mb-3">
          <div className="flex items-center gap-1.5">
            <span className="rounded-[2px]" style={{ width: 8, height: 8, background: "hsl(var(--primary))" }} />
            <span className="text-[11px] text-muted-foreground" style={{ fontWeight: 500 }}>Increase</span>
            <span className="text-[12px] text-foreground tabular-nums" style={{ fontWeight: 600 }}>{totalInc} EA</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="rounded-[2px]" style={{ width: 8, height: 8, background: "#F59E0B" }} />
            <span className="text-[11px] text-muted-foreground" style={{ fontWeight: 500 }}>Decrease</span>
            <span className="text-[12px] text-foreground tabular-nums" style={{ fontWeight: 600 }}>{totalDec} EA</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground" style={{ fontWeight: 500 }}>Net</span>
            <span
              className="inline-flex items-center rounded-md tabular-nums"
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: net >= 0 ? "hsl(var(--success))" : "hsl(var(--destructive))",
                background: net >= 0 ? "hsl(var(--success) / 0.10)" : "hsl(var(--destructive) / 0.10)",
                padding: "1px 6px",
              }}
            >
              {net >= 0 ? "+" : ""}{net} EA
            </span>
          </div>
        </div>

        {/* Chart */}
        <div className="flex-1 min-h-[180px] -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyActivityData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 11, fill: "#94A3B8" }}
                axisLine={false}
                tickLine={false}
                tickMargin={6}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#94A3B8" }}
                axisLine={false}
                tickLine={false}
                width={32}
              />
              <Tooltip cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} contentStyle={ttStyle} />
              <Bar dataKey="increase" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={18} name="Increase" />
              <Bar dataKey="decrease" fill="#F59E0B"             radius={[4, 4, 0, 0]} barSize={18} name="Decrease" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
}

const TopCustomersWidget = () => {
    // Top Customers — Partners list-widget idiom: name + $ + inline progress bar.
    const PIE = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];
    const rows = [
      { name: "Acme Corp",     amount: "$45,230", share: 32 },
      { name: "Globex Inc",    amount: "$28,400", share: 21 },
      { name: "Soylent Corp",  amount: "$15,100", share: 12 },
      { name: "Initech",       amount: "$12,050", share: 9 },
      { name: "Umbrella Corp", amount: "$8,200",  share: 6 },
    ];
    return (
      <div className="space-y-2.5">
        {rows.map((c, i) => (
          <div key={c.name} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: PIE[i % PIE.length] }} />
                <span className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 500 }}>{c.name}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[12px] text-slate-700" style={{ fontWeight: 600 }}>{c.amount}</span>
                <span className="text-[11px] text-slate-400 w-8 text-right" style={{ fontWeight: 500 }}>{c.share}%</span>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${c.share}%`, backgroundColor: PIE[i % PIE.length] }} />
            </div>
          </div>
        ))}
      </div>
    );
}

const PrimaryVendorWidget = () => {
    // Primary Vendor — keep the rich content (rating, sub-cards, CTA).
    // Outer Card shell removed (now provided by WidgetShell). Sub-cards keep
    // their own borders for the card-in-card treatment.
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0" style={{ fontWeight: 600, fontSize: 18 }}>
            G
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] text-foreground leading-tight" style={{ fontWeight: 600 }}>Global Supplies Ltd.</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] text-muted-foreground">V-99281</span>
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-success/10 text-success border border-success/20" style={{ fontWeight: 500 }}>
                <Check size={9} /> Preferred
              </span>
            </div>
            <div className="flex items-center gap-1 mt-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star key={star} size={11} className={star <= 4 ? "fill-amber-500 text-amber-500" : "fill-muted text-muted"} />
              ))}
              <span className="text-[11px] text-muted-foreground ml-1" style={{ fontWeight: 500 }}>4.2 / 5</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-border bg-slate-50/60 p-2.5">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide" style={{ fontWeight: 500 }}>Spend YTD</div>
            <div className="text-[15px] text-foreground mt-0.5" style={{ fontWeight: 700 }}>$124K</div>
            <div className="flex items-center gap-1 mt-0.5 text-[10px] text-success" style={{ fontWeight: 500 }}>
              <TrendingUp size={10} /> +12%
            </div>
          </div>
          <div className="rounded-lg border border-border bg-slate-50/60 p-2.5">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide" style={{ fontWeight: 500 }}>Lead Time</div>
            <div className="text-[15px] text-foreground mt-0.5" style={{ fontWeight: 700 }}>14 Days</div>
            <div className="flex items-center gap-1 mt-0.5 text-[10px] text-success" style={{ fontWeight: 500 }}>
              <Check size={10} /> On Target
            </div>
          </div>
        </div>

        <Button variant="outline" className="w-full h-8 text-[12px] gap-1.5">
          <List size={12} /> View Performance
        </Button>
      </div>
    );
}

// --- Widget Definitions ---

type WidgetType = 'kpi' | 'chart' | 'list' | 'complex';

interface WidgetDef {
    id: string;
    label: string;
    type: WidgetType;
    defaultSpan?: number;
    icon?: any;
    render: (item: Item) => React.ReactNode;
}

/* ────────────────────────────────────────────────────────────────
 * InvCard — Partners-literal card shell for Inventory Overview
 * Severity palette mapped to Partners' existing hex set (no new tokens):
 *   warning  amber  text #92400E · bg #FFFBEB · border #FDE68A
 *   info     blue   text #1E40AF · bg #EFF6FF · border #DBEAFE
 *   audit    violet text #5B21B6 · bg #F5F3FF · border #EDE9FE
 *   critical red    text #991B1B · bg #FEF2F2 · border #FECACA
 *   healthy  green  text #15803D · bg #F0FDF4 · border #BBF7D0
 * ──────────────────────────────────────────────────────────────── */
const SEVERITY_PALETTE: Record<string, { text: string; bg: string; border: string }> = {
    warning:  { text: '#92400E', bg: '#FFFBEB', border: '#FDE68A' },
    info:     { text: '#1E40AF', bg: '#EFF6FF', border: '#DBEAFE' },
    audit:    { text: '#5B21B6', bg: '#F5F3FF', border: '#EDE9FE' },
    critical: { text: '#991B1B', bg: '#FEF2F2', border: '#FECACA' },
    healthy:  { text: '#15803D', bg: '#F0FDF4', border: '#BBF7D0' },
};

function InvCard(props: any) {
    const {
        severity = 'info',
        pillIcon: PillIcon,
        pillSegA,
        pillSegB,
        rightBadge,
        name,
        description,
        heroValue,
        heroLabel,
        heroWarning,
        detailLeft,
        detailRight,
        bodyType, // undefined | 'list' | 'metrics'
        listRows,
        metricRows,
        recommendation,
        footerMeta = [],
        footerStatus,
        footerLink,
    } = props;

    const p = SEVERITY_PALETTE[severity] || SEVERITY_PALETTE.info;

    return (
        <div
            className="bg-white border border-border rounded-xl group transition-all duration-200 flex flex-col relative h-[260px]"
            onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#BFDBFE';
                e.currentTarget.style.boxShadow = '0 4px 16px -4px rgba(10,119,255,0.10), 0 0 0 1px #BFDBFE';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'hsl(var(--border))';
                e.currentTarget.style.boxShadow = 'none';
            }}
        >
            <div className="p-3.5 flex-1 flex flex-col min-h-0 overflow-hidden">
                {/* Row 1 — Corner pill (2 segments) + right severity badge */}
                <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
                    <span className="inline-flex items-stretch rounded-full overflow-hidden border shrink-0" style={{ borderColor: p.border }}>
                        <span
                            className="inline-flex items-center gap-1 px-2 py-[2px] text-[10px]"
                            style={{ fontWeight: 600, color: p.text, backgroundColor: p.bg }}
                        >
                            {PillIcon ? <PillIcon className="w-3 h-3" /> : null}
                            {pillSegA}
                        </span>
                        <span
                            className="inline-flex items-center px-2 py-[2px] text-[10px] bg-white text-slate-500 border-l"
                            style={{ fontWeight: 500, borderColor: p.border }}
                        >
                            {pillSegB}
                        </span>
                    </span>
                    {rightBadge && (
                        <span
                            className="inline-flex items-center px-1.5 py-[3px] rounded-md border border-slate-300 bg-white text-[9px] text-muted-foreground"
                            style={{ fontWeight: 600 }}
                        >
                            {rightBadge}
                        </span>
                    )}
                </div>

                {/* Row 2 — Name */}
                <div className="shrink-0 mb-1">
                    <p className="text-[13px] text-slate-700 truncate" style={{ fontWeight: 600 }}>{name}</p>
                </div>

                {/* Row 3 — Description (fixed 2-line) */}
                <div className="h-[32px] shrink-0 mb-2">
                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed" style={{ fontWeight: 400 }}>{description}</p>
                </div>

                {/* Row 4 — Hero value */}
                <div className="flex items-baseline gap-2 shrink-0">
                    <span className="text-[22px] text-slate-700 tabular-nums leading-none tracking-tight" style={{ fontWeight: 600 }}>{heroValue}</span>
                    <span className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>{heroLabel}</span>
                    {heroWarning && (
                        <span className="ml-auto"><AlertTriangle className="w-3.5 h-3.5" style={{ color: '#F59E0B' }} /></span>
                    )}
                </div>

                {/* Row 5 — Body region (mt-auto pinned to bottom) */}
                <div className="mt-auto pt-2 shrink-0 min-w-0">
                    {bodyType === 'list' && Array.isArray(listRows) && (
                        <div className="rounded-lg border border-[#E8ECF1] bg-[#FAFBFC] overflow-hidden">
                            {listRows.map((r: any, i: number) => {
                                const tonePal = SEVERITY_PALETTE[r.tone] || SEVERITY_PALETTE.info;
                                return (
                                    <div
                                        key={i}
                                        className={`flex items-center justify-between px-3 py-[6px] text-[11px] tabular-nums ${i > 0 ? 'border-t border-[#E8ECF1]' : ''}`}
                                    >
                                        <span style={{ fontWeight: 600, color: tonePal.text }}>{r.label}</span>
                                        <span className="tabular-nums" style={{ fontWeight: 600, color: tonePal.text }}>{r.value}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    {bodyType === 'metrics' && Array.isArray(metricRows) && (
                        <div className="rounded-lg border border-[#E8ECF1] bg-[#FAFBFC] overflow-hidden">
                            {metricRows.map((r: any, i: number) => {
                                const Icon = r.icon;
                                const tone = r.tone || 'neutral';
                                const valColor = tone === 'critical' ? '#991B1B' : tone === 'healthy' ? '#15803D' : tone === 'warning' ? '#92400E' : '#334155';
                                return (
                                    <div
                                        key={i}
                                        className={`flex items-center justify-between px-3 py-[6px] text-[11px] ${i > 0 ? 'border-t border-[#E8ECF1]' : ''}`}
                                    >
                                        <span className="inline-flex items-center gap-1.5 text-slate-500" style={{ fontWeight: 500 }}>
                                            {Icon ? <Icon className="w-3 h-3" /> : null}
                                            {r.label}
                                        </span>
                                        <span className="inline-flex items-center gap-1 tabular-nums" style={{ fontWeight: 600, color: valColor }}>
                                            {r.showCheck && <Check className="w-3 h-3" />}
                                            {r.value}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    {!bodyType && (detailLeft || detailRight) && (
                        <div className="flex items-center justify-between px-3 py-[6px] rounded-lg border border-[#E8ECF1] bg-[#FAFBFC] text-[11px] tabular-nums min-w-0">
                            <div className="flex items-center gap-1.5 text-slate-500 min-w-0 truncate" style={{ fontWeight: 400 }}>{detailLeft}</div>
                            <span className="shrink-0 ml-2 text-slate-700 truncate" style={{ fontWeight: 600 }}>{detailRight}</span>
                        </div>
                    )}
                    {recommendation && (
                        <div className="flex gap-2 mt-2 px-3 py-2 rounded-lg border border-[#E8ECF1] bg-white text-[11px] text-slate-500" style={{ fontWeight: 400 }}>
                            <Info className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                            <p>{recommendation}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer — pinned, divided meta + ml-auto status pill / link */}
            <div className="flex items-center gap-2 px-3.5 py-2.5 border-t border-muted shrink-0">
                {footerMeta.map((m: any, i: number) => {
                    const Icon = m.icon;
                    return (
                        <React.Fragment key={i}>
                            {i > 0 && <span className="w-px h-3 bg-[#E8ECF1]" />}
                            <span className="inline-flex items-center gap-1 text-[10px] text-slate-400" style={{ fontWeight: 500 }}>
                                {Icon ? <Icon className="w-3 h-3" /> : null}
                                {m.value}
                            </span>
                        </React.Fragment>
                    );
                })}
                {footerLink && (
                    <button
                        type="button"
                        className="ml-auto text-[11px] text-primary hover:underline cursor-pointer"
                        style={{ fontWeight: 500 }}
                    >
                        {footerLink}
                    </button>
                )}
                {footerStatus && (
                    <span
                        className="ml-auto px-2 py-[2px] rounded-full text-[10px] border"
                        style={{
                            fontWeight: 500,
                            color: p.text,
                            backgroundColor: p.bg,
                            borderColor: p.border,
                        }}
                    >
                        {footerStatus}
                    </span>
                )}
            </div>
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Transactions sub-tab panel — visual parity with ItemsListPageV3 toolbar/table
 * (Slice: search + pill filter + ColumnSelector + density + literal pagination).
 * Per-column ColumnHeaderMenu / ActiveFiltersBar deferred to the generalization
 * slice that refactors the Item-coupled primitives.
 * ────────────────────────────────────────────────────────────────────────── */

type TxRow = {
    serial: string;
    status: string;
    price: number;
    method: string;
    source: string;
    link: string;
    location: string;
    reason: string;
    addedOn: string;
    type: string;
    user: string;
    attachment: string;
};

const TX_ROWS: TxRow[] = [
    { serial: '100219-42', status: 'On-Hand Available', price: 22.50, method: 'Real Cost', source: 'Receiving Doc#...', link: '#', location: 'Zone A-01', reason: '-', addedOn: '10/23/2025 • 2:00 PM', type: 'Purchased', user: 'Maya Thompson', attachment: '-' },
    { serial: '100219-40', status: 'Out of stock Consumed', price: 22.50, method: 'Real Cost', source: 'Receiving Doc#...', link: '#', location: 'Zone A-01', reason: '-', addedOn: '10/23/2025 • 2:00 PM', type: 'Purchased', user: 'Maya Thompson', attachment: '-' },
    { serial: '100219-38', status: 'Quarantine Allocated', price: 22.50, method: 'Real Cost', source: 'Receiving Doc#...', link: '#', location: 'Zone A-01', reason: '-', addedOn: '10/23/2025 • 2:00 PM', type: 'Purchased', user: 'Maya Thompson', attachment: '-' },
    { serial: '100219-37', status: 'Quarantine Allocated', price: 22.50, method: 'Real Cost', source: 'Adjustment -009', link: '#', location: 'WH1-1-L2', reason: '-', addedOn: '10/30/2025 • 13:00 PM', type: 'Purchased', user: 'Maya Thompson', attachment: '-' },
    { serial: '100219-35', status: 'Quarantine Allocated', price: 22.50, method: 'Real Cost', source: 'Receiving Doc#...', link: '#', location: 'Zone A-01', reason: '-', addedOn: '10/23/2025 • 2:00 PM', type: 'Purchased', user: 'Maya Thompson', attachment: '-' },
    { serial: '100219-33', status: 'Quarantine Quarantined', price: 22.50, method: 'Real Cost', source: 'WO-6546', link: '#', location: 'Zone TR-012', reason: '-', addedOn: '10/25/2025 • 14:00 PM', type: 'Manufactured', user: 'Maya Thompson', attachment: '-' },
    { serial: '100219-25', status: 'Quarantine Checked Out', price: 22.50, method: 'Real Cost', source: 'Receiving Doc#...', link: '#', location: 'Zone A-01', reason: '-', addedOn: '10/23/2025 • 2:00 PM', type: 'Purchased', user: 'Maya Thompson', attachment: '-' },
    { serial: '100219-22', status: 'Quarantine Checked Out', price: 0, method: 'Real Cost', source: 'Receiving Doc#...', link: '#', location: 'Zone A-01', reason: '-', addedOn: '10/23/2025 • 2:00 PM', type: 'Purchased', user: 'Maya Thompson', attachment: '-' },
    { serial: '100219-20', status: 'Out of stock Scrapped', price: 0, method: 'Real Cost', source: 'Receiving Doc#...', link: '#', location: 'Zone A-01', reason: '-', addedOn: '10/23/2025 • 2:00 PM', type: 'Purchased', user: 'Maya Thompson', attachment: '-' },
    { serial: '100219-19', status: 'Out of stock Consumed', price: 0, method: 'Real Cost', source: 'Receiving Doc#...', link: '#', location: 'Zone A-01', reason: '-', addedOn: '10/23/2025 • 2:00 PM', type: 'Purchased', user: 'Maya Thompson', attachment: '-' },
    { serial: '100219-18', status: 'Quarantine Checked Out', price: 0, method: 'Real Cost', source: 'WO -0076', link: '#', location: 'Zone A-01', reason: '-', addedOn: '10/23/2025 • 2:00 PM', type: 'Manufactured', user: 'Maya Thompson', attachment: '-' },
    { serial: '100219-17', status: 'Quarantine Allocated', price: 22.50, method: 'Real Cost', source: 'Receiving Doc#...', link: '#', location: 'Zone A-01', reason: '-', addedOn: '10/23/2025 • 2:00 PM', type: 'Purchased', user: 'Maya Thompson', attachment: '-' },
    { serial: '100219-16', status: 'Quarantine Allocated', price: 0, method: 'Real Cost', source: 'Receiving Doc#...', link: '#', location: 'Zone A-01', reason: '-', addedOn: '10/23/2025 • 2:00 PM', type: 'Purchased', user: 'Maya Thompson', attachment: '-' },
    { serial: '100219-15', status: 'Out of stock Shipped', price: 22.50, method: 'Real Cost', source: 'Receiving Doc#...', link: '#', location: 'Zone A-01', reason: '-', addedOn: '10/23/2025 • 2:00 PM', type: 'Purchased', user: 'Maya Thompson', attachment: '-' },
    { serial: '100219-14', status: 'Out of stock Lost', price: 22.50, method: 'Real Cost', source: 'Receiving Doc#...', link: '#', location: 'Zone A-01', reason: '-', addedOn: '10/23/2025 • 2:00 PM', type: 'Purchased', user: 'Maya Thompson', attachment: '-' },
    { serial: '100219-13', status: 'Out of stock Shipped', price: 22.50, method: 'Real Cost', source: 'Receiving Doc#...', link: '#', location: 'Zone A-01', reason: '-', addedOn: '10/23/2025 • 2:00 PM', type: 'Purchased', user: 'Maya Thompson', attachment: '-' },
    { serial: '100219-12', status: 'On-Hand Available', price: 22.50, method: 'Real Cost', source: 'Receiving Doc#...', link: '#', location: 'Zone A-01', reason: '-', addedOn: '10/23/2025 • 2:00 PM', type: 'Purchased', user: 'Maya Thompson', attachment: '-' },
    { serial: '100219-11', status: 'On-Hand Available', price: 22.50, method: 'Real Cost', source: 'Receiving Doc#...', link: '#', location: 'Zone A-01', reason: '-', addedOn: '10/23/2025 • 2:00 PM', type: 'Purchased', user: 'Maya Thompson', attachment: '-' },
    { serial: '100219-10', status: 'On-Hand Available', price: 22.50, method: 'Real Cost', source: 'Receiving Doc#...', link: '#', location: 'Zone A-01', reason: '-', addedOn: '10/23/2025 • 2:00 PM', type: 'Purchased', user: 'Maya Thompson', attachment: '-' },
];

const TRANSACTION_COLUMNS: ColumnConfig[] = [
    { key: 'serial',     label: 'Serial No.' },
    { key: 'status',     label: 'Unit Status' },
    { key: 'price',      label: 'Price/Unit' },
    { key: 'method',     label: 'Costing Methodology' },
    { key: 'source',     label: 'Source Link' },
    { key: 'location',   label: 'Current Location' },
    { key: 'reason',     label: 'Adjustment Reason' },
    { key: 'addedOn',    label: 'Added On' },
    { key: 'type',       label: 'Acquisition Type' },
    { key: 'user',       label: 'Added By' },
    { key: 'attachment', label: 'Attachment' },
];
/* Per-column widths (mirrors ItemsListPageV3 ITEM_COLUMN_WIDTHS pattern, line 122). */
const TRANSACTION_COLUMN_WIDTHS: Record<string, number> = {
    serial:     120,
    status:     200,
    price:      110,
    method:     160,
    source:     180,
    location:   160,
    reason:     140,
    addedOn:    180,
    type:       140,
    user:       180,
    attachment:  80,
};
const TX_LOCKED_COLUMNS = ['serial'];
const TX_QUICK_FILTERS = ['All', 'On Hand', 'Quarantine', 'Out of Stock'] as const;
type TxQuickFilter = (typeof TX_QUICK_FILTERS)[number];

type TxDensity = 'condensed' | 'comfort';
const TX_DENSITY_CONFIG: { key: TxDensity; label: string; description: string; icon: 'align-justify' | 'list' }[] = [
    { key: 'condensed', label: 'Condensed', description: 'Compact view',  icon: 'align-justify' },
    { key: 'comfort',   label: 'Comfort',   description: 'Spacious view', icon: 'list' },
];

function txMatchesQuickFilter(row: TxRow, qf: TxQuickFilter): boolean {
    if (qf === 'All') return true;
    const s = row.status.toLowerCase();
    if (qf === 'On Hand') return s.startsWith('on-hand') || s.startsWith('on hand');
    if (qf === 'Quarantine') return s.startsWith('quarantine');
    if (qf === 'Out of Stock') return s.startsWith('out of stock');
    return true;
}

function txMatchesSearch(row: TxRow, q: string): boolean {
    if (!q) return true;
    const needle = q.toLowerCase();
    return Object.values(row).some((v) => String(v).toLowerCase().includes(needle));
}

function TransactionsPanel() {
    const [txSearch, setTxSearch] = useState('');
    const [txQuickFilter, setTxQuickFilter] = useState<TxQuickFilter>('All');
    const [txColumnOrder, setTxColumnOrder] = useState<string[]>(TRANSACTION_COLUMNS.map((c) => c.key));
    const [txColumnVisibility, setTxColumnVisibility] = useState<Record<string, boolean>>(
        Object.fromEntries(TRANSACTION_COLUMNS.map((c) => [c.key, true]))
    );
    const [txColumnsOpen, setTxColumnsOpen] = useState(false);
    const [txDensity, setTxDensity] = useState<TxDensity>('condensed');
    const [txPage, setTxPage] = useState(1);
    const [txPageSize, setTxPageSize] = useState(20);

    const txFilteredRows = useMemo(() => {
        return TX_ROWS.filter((r) => txMatchesQuickFilter(r, txQuickFilter) && txMatchesSearch(r, txSearch));
    }, [txSearch, txQuickFilter]);

    const totalRows = TX_ROWS.length;
    const filteredCount = txFilteredRows.length;
    const totalPages = Math.max(1, Math.ceil(filteredCount / txPageSize));
    const currentPage = Math.min(txPage, totalPages);
    const startIdx = (currentPage - 1) * txPageSize;
    const pagedRows = txFilteredRows.slice(startIdx, startIdx + txPageSize);

    const visibleColumns = txColumnOrder
        .map((k) => TRANSACTION_COLUMNS.find((c) => c.key === k))
        .filter((c): c is ColumnConfig => !!c && txColumnVisibility[c.key] !== false);
    const visibleCount = visibleColumns.length;

    const isRelaxed = txDensity === 'comfort';
    const cellPadY = isRelaxed ? 'py-3' : 'py-1.5';
    const cellTextSize = isRelaxed ? 'text-[13.5px]' : 'text-xs';

    const getPageNumbers = (): (number | '...')[] => {
        const pages: (number | '...')[] = [];
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1);
            if (currentPage > 3) pages.push('...');
            const start = Math.max(2, currentPage - 1);
            const end = Math.min(totalPages - 1, currentPage + 1);
            for (let i = start; i <= end; i++) pages.push(i);
            if (currentPage < totalPages - 2) pages.push('...');
            pages.push(totalPages);
        }
        return pages;
    };

    const renderCell = (col: ColumnConfig, row: TxRow) => {
        switch (col.key) {
            case 'serial':
                return <span className="font-mono text-xs text-foreground font-medium">{row.serial}</span>;
            case 'status':
                return <TransactionStatusBadge status={row.status} />;
            case 'price':
                return (
                    <span className={`${cellTextSize} font-medium text-foreground tabular-nums`}>
                        ${row.price.toFixed(2)}
                    </span>
                );
            case 'source':
                return (
                    <a href={row.link} className={`${cellTextSize} inline-flex items-center gap-1 text-primary hover:underline decoration-primary/30 underline-offset-2`}>
                        {row.source}
                        <ArrowUpRight size={10} />
                    </a>
                );
            case 'type':
                return (
                    <Badge
                        variant="outline"
                        className={cn(
                            'text-[10px] px-2 h-5 font-medium border-primary/20 bg-primary/5 text-primary',
                            row.type === 'Manufactured' && 'border-amber-200 bg-amber-50 text-amber-700'
                        )}
                    >
                        {row.type}
                    </Badge>
                );
            case 'user':
                return (
                    <div className="flex items-center gap-2.5">
                        <InitialAvatar name={row.user} size={isRelaxed ? "md" : "sm"} />
                        <span className="text-sm truncate" style={{ fontWeight: 500, color: '#1E293B' }}>{row.user}</span>
                    </div>
                );
            case 'attachment':
                return <span className={`${cellTextSize} text-muted-foreground`}>{row.attachment}</span>;
            default:
                return <span className={`${cellTextSize} text-muted-foreground`}>{(row as any)[col.key] ?? '-'}</span>;
        }
    };

    return (
        <div className="flex flex-1 min-w-0 flex-col">
            {/* Toolbar Row 1: Search + Filters | count + Density + Columns */}
            <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2 shrink-0 flex-wrap">
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <div className="relative flex-1 max-w-xs">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
                        <Input
                            placeholder="Search transactions..."
                            value={txSearch}
                            onChange={(e) => { setTxSearch(e.target.value); setTxPage(1); }}
                            className="pl-9 h-9 text-sm bg-white border-border/80 shadow-sm placeholder:text-muted-foreground/50 focus-visible:border-primary focus-visible:ring-primary/20"
                        />
                    </div>
                    <button
                        type="button"
                        className="inline-flex items-center justify-center h-9 gap-1.5 px-3 rounded-lg border bg-white shadow-sm hover:bg-muted/50 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50 shrink-0 text-foreground border-border/80"
                    >
                        <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-sm" style={{ fontWeight: 500 }}>Filters</span>
                    </button>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-sm tabular-nums mr-1 hidden sm:inline" style={{ fontWeight: 500 }}>
                        {filteredCount !== totalRows ? (
                            <>
                                <span className="text-foreground">{filteredCount}</span>
                                <span className="text-muted-foreground/60"> of </span>
                                <span className="text-muted-foreground">{totalRows}</span>
                                <span className="text-muted-foreground/70"> units</span>
                            </>
                        ) : (
                            <>
                                <span className="text-foreground">{totalRows}</span>
                                <span className="text-muted-foreground/70"> units</span>
                            </>
                        )}
                    </span>

                    <div className="w-px h-5 bg-border/60 mx-1 hidden sm:block" />

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                className="inline-flex items-center justify-center h-9 gap-2 px-3 rounded-lg border border-border bg-white text-foreground shadow-sm hover:bg-muted/40 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                            >
                                {txDensity === 'condensed' && <AlignJustify className="w-[18px] h-[18px] text-muted-foreground/80" />}
                                {txDensity === 'comfort' && <List className="w-[18px] h-[18px] text-muted-foreground/80" />}
                                <span className="text-sm hidden md:inline" style={{ fontWeight: 500 }}>
                                    {TX_DENSITY_CONFIG.find((d) => d.key === txDensity)?.label}
                                </span>
                                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/60" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[230px] p-1.5">
                            {TX_DENSITY_CONFIG.map((opt) => (
                                <DropdownMenuItem
                                    key={opt.key}
                                    className="flex items-center gap-3 py-2.5 px-3 cursor-pointer rounded-md"
                                    onSelect={() => setTxDensity(opt.key)}
                                >
                                    {opt.icon === 'align-justify' && <AlignJustify className="w-5 h-5 text-muted-foreground shrink-0" />}
                                    {opt.icon === 'list' && <List className="w-5 h-5 text-muted-foreground shrink-0" />}
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm" style={{ fontWeight: 500 }}>{opt.label}</div>
                                        <div className="text-xs text-muted-foreground">{opt.description}</div>
                                    </div>
                                    {txDensity === opt.key && <Check className="w-4 h-4 shrink-0" style={{ color: '#0A77FF' }} />}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <ColumnSelectorTrigger
                        visibleCount={visibleCount}
                        active={txColumnsOpen}
                        onClick={() => setTxColumnsOpen(!txColumnsOpen)}
                    />
                </div>
            </div>

            {/* Toolbar Row 2: Quick filter pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto px-4 pb-3 shrink-0">
                {TX_QUICK_FILTERS.map((qf) => {
                    const isActive = txQuickFilter === qf;
                    return (
                        <button
                            key={qf}
                            onClick={() => { setTxQuickFilter(qf); setTxPage(1); }}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                                isActive
                                    ? 'border-primary bg-[#EDF4FF] hover:bg-[#D6E8FF] active:bg-[#ADD1FF]'
                                    : 'border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30 active:bg-muted'
                            }`}
                            style={{
                                fontWeight: isActive ? 500 : 400,
                                color: isActive ? '#0A77FF' : undefined,
                            }}
                        >
                            {qf}
                        </button>
                    );
                })}
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader className="sticky top-0 z-10 bg-card">
                        <TableRow
                            className={cn(
                                'bg-muted/30 hover:bg-muted/30 border-b border-border',
                                isRelaxed ? '[&>th]:h-9' : '[&>th]:h-8'
                            )}
                        >
                            <TableHead className="pl-4" style={{ width: 40, minWidth: 40, maxWidth: 40 }}>
                                <Checkbox className="scale-75" />
                            </TableHead>
                            {visibleColumns.map((col) => {
                                const isPrice = col.key === 'price';
                                const isAttachment = col.key === 'attachment';
                                const width = TRANSACTION_COLUMN_WIDTHS[col.key] ?? 160;
                                return (
                                    <TableHead
                                        key={col.key}
                                        className={cn(
                                            'whitespace-nowrap',
                                            isPrice && 'text-right',
                                            isAttachment && 'text-center'
                                        )}
                                        style={{
                                            width: `${width}px`,
                                            minWidth: `${width}px`,
                                            maxWidth: `${width}px`,
                                            overflow: 'hidden',
                                        }}
                                    >
                                        <span className="text-[13px] text-muted-foreground" style={{ fontWeight: 500 }}>
                                            {col.label}
                                        </span>
                                    </TableHead>
                                );
                            })}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {pagedRows.map((row, i) => (
                            <TableRow
                                key={`${row.serial}-${i}`}
                                className="group border-b border-border/50 hover:bg-[#F0F7FF] transition-colors"
                            >
                                <TableCell className={cn('pl-4', cellPadY)} style={{ width: 40, minWidth: 40, maxWidth: 40 }}>
                                    <Checkbox className="scale-75" />
                                </TableCell>
                                {visibleColumns.map((col) => {
                                    const isPrice = col.key === 'price';
                                    const isAttachment = col.key === 'attachment';
                                    const width = TRANSACTION_COLUMN_WIDTHS[col.key] ?? 160;
                                    return (
                                        <TableCell
                                            key={col.key}
                                            className={cn(
                                                cellPadY,
                                                isPrice && 'text-right',
                                                isAttachment && 'text-center'
                                            )}
                                            style={{
                                                width: `${width}px`,
                                                minWidth: `${width}px`,
                                                maxWidth: `${width}px`,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            {renderCell(col, row)}
                                        </TableCell>
                                    );
                                })}
                            </TableRow>
                        ))}
                        {pagedRows.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={visibleColumns.length + 1} className="text-center py-12 text-sm text-muted-foreground">
                                    No transactions match the current filters.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination — literal from ItemsListPageV3 */}
            {filteredCount > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-center px-4 py-3 border-t border-border gap-3 shrink-0">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>Records per page</span>
                        <Select
                            value={String(txPageSize)}
                            onValueChange={(val) => { setTxPageSize(Number(val)); setTxPage(1); }}
                        >
                            <SelectTrigger className="w-[70px] h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="10">10</SelectItem>
                                <SelectItem value="20">20</SelectItem>
                                <SelectItem value="50">50</SelectItem>
                                <SelectItem value="100">100</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={currentPage === 1} onClick={() => setTxPage(1)}>
                            <ChevronsLeft className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 gap-1 text-sm text-muted-foreground" disabled={currentPage === 1} onClick={() => setTxPage((p) => Math.max(1, p - 1))}>
                            <ChevronLeft className="w-3.5 h-3.5" />
                            Prev
                        </Button>
                        {getPageNumbers().map((pg, idx) =>
                            pg === '...' ? (
                                <span key={`dots-${idx}`} className="px-1 text-sm text-muted-foreground">...</span>
                            ) : (
                                <Button
                                    key={pg}
                                    variant={currentPage === pg ? 'default' : 'ghost'}
                                    size="sm"
                                    className={`h-8 w-8 p-0 text-sm ${currentPage === pg ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                                    onClick={() => setTxPage(pg as number)}
                                >
                                    {pg}
                                </Button>
                            )
                        )}
                        <Button variant="ghost" size="sm" className="h-8 gap-1 text-sm text-muted-foreground" disabled={currentPage === totalPages} onClick={() => setTxPage((p) => Math.min(totalPages, p + 1))}>
                            Next
                            <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={currentPage === totalPages} onClick={() => setTxPage(totalPages)}>
                            <ChevronsRight className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Column Selector Side Drawer */}
            <ColumnSelector
                columns={TRANSACTION_COLUMNS}
                columnOrder={txColumnOrder}
                columnVisibility={txColumnVisibility}
                onColumnOrderChange={setTxColumnOrder}
                onColumnVisibilityChange={setTxColumnVisibility}
                lockedColumns={TX_LOCKED_COLUMNS}
                open={txColumnsOpen}
                onOpenChange={setTxColumnsOpen}
            />
        </div>
    );
}

export function ItemDetail({ item: initialItem, onBack, onEdit, scrollContainerRef }: ItemDetailProps) {
  // Use local state for item to support editing mock
  const [item, setItem] = useState<Item | undefined>(initialItem ? {
      ...initialItem,
      cost: 24.50,
      price: 49.99,
      weight: '2.5 lbs',
      dimensions: '12 x 12 x 24 in',
      safetyStock: 50,
      reorderPoint: 150,
      leadTime: 14
  } : undefined);

  const [activeTab, setActiveTab] = useState('overview');
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fallbackScrollRef = useRef<HTMLDivElement>(null);
  const effectiveScrollRef = scrollContainerRef ?? fallbackScrollRef;

  // Config State
  const [activeSectionId, setActiveSectionId] = useState<ConfigSectionType>('definition');
  const [lotControlOpen, setLotControlOpen] = useState(true);
  
  // Initialize config from item properties or defaults
  const [config, setConfig] = useState<AdvancedConfig>(() => ({
      ...DEFAULT_CONFIG,
      // Override defaults with item specific data where applicable
      uom: initialItem?.unit || DEFAULT_CONFIG.uom,
      stockUom: initialItem?.alternativeStockingUnits || DEFAULT_CONFIG.stockUom,
      minStock: initialItem?.safetyStock?.toString() || DEFAULT_CONFIG.minStock,
      maxStock: initialItem?.reorderPoint?.toString() || DEFAULT_CONFIG.maxStock, // Approximation
      inventoryType: initialItem?.inventoryControlType === 'Serialized' ? 'Asset' : 'Stock',
      controlType: initialItem?.inventoryControlType === 'Serialized' ? 'Serialized' : 'Non-serialized',
      acquisitionMethod: initialItem?.acquisitionMethod ? [initialItem.acquisitionMethod === 'Purchase' ? 'Purchased' : 'Manufactured'] : DEFAULT_CONFIG.acquisitionMethod,
      pricing: [{ price: initialItem?.price?.toFixed(2) || '0.00', uom: initialItem?.unit || 'Each', id: '1' }]
  }));

  // Attachments State
  const [attachments, setAttachments] = useState([
      { id: '1', name: 'Product_Front.png', size: '2.4 MB', type: 'image/png', category: 'media', uploadedBy: 'Alice S.', date: '2 days ago', url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30' },
      { id: '2', name: 'Specs_v2.pdf', size: '1.2 MB', type: 'application/pdf', category: 'document', uploadedBy: 'Bob J.', date: '1 week ago' },
      { id: '3', name: 'Vendor_Agreement.docx', size: '450 KB', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', category: 'module', moduleContext: 'purchasing', uploadedBy: 'Charlie D.', date: '2 weeks ago' },
      { id: '4', name: 'Q3_Forecast.xlsx', size: '890 KB', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', category: 'module', moduleContext: 'sales', uploadedBy: 'Diana P.', date: '3 days ago' },
  ]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [newFileCategory, setNewFileCategory] = useState('document');
  const [newFileModule, setNewFileModule] = useState('purchasing');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const getFileIcon = (type: string) => {
      if (type.startsWith('image/')) return ImageIcon;
      if (type.includes('pdf')) return FileText;
      if (type.includes('spreadsheet') || type.includes('xlsx')) return FileSpreadsheet;
      return File;
  };
  
  const getFileColor = (type: string) => {
       if (type.startsWith('image/')) return "bg-purple-100 text-purple-600 border-purple-200";
       if (type.includes('pdf')) return "bg-rose-100 text-rose-600 border-rose-200";
       if (type.includes('spreadsheet') || type.includes('xlsx')) return "bg-emerald-100 text-emerald-600 border-emerald-200";
       return "bg-slate-100 text-slate-600 border-slate-200";
  };

  const handleConfigChange = <K extends keyof AdvancedConfig>(key: K, value: AdvancedConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const toggleLocation = (type: 'inbound' | 'outbound', location: string) => {
    setConfig(prev => {
        const key = type === 'inbound' ? 'inboundLocation' : 'outboundLocation';
        const rawValue = prev[key];
        const currentList = Array.isArray(rawValue) ? rawValue : [];
        const newList = currentList.includes(location) ? currentList.filter(l => l !== location) : [...currentList, location];
        return { ...prev, [key]: newList };
    });
  };

  const toggleAcquisitionMethod = (method: string) => {
    setConfig(prev => {
        const currentMethods = prev.acquisitionMethod;
        const newMethods = currentMethods.includes(method) ? currentMethods.filter(m => m !== method) : [...currentMethods, method];
        return { ...prev, acquisitionMethod: newMethods.length ? newMethods : [method] };
    });
  };

  const togglePartner = (partnerId: string) => {
      setConfig(prev => {
          const current = prev.specificPartners || [];
          const newPartners = current.includes(partnerId) ? current.filter(p => p !== partnerId) : [...current, partnerId];
          return { ...prev, specificPartners: newPartners };
      });
  };

  const addPrice = () => {
      setConfig(prev => ({
          ...prev, 
          pricing: [...prev.pricing, { id: Math.random().toString(36).substr(2, 9), price: '', uom: 'Each' }]
      }));
  };

  const updatePrice = (id: string, field: 'price' | 'uom', val: string) => {
      setConfig(prev => ({
          ...prev,
          pricing: prev.pricing.map(p => p.id === id ? { ...p, [field]: val } : p)
      }));
  };

  const removePrice = (id: string) => {
      setConfig(prev => ({
          ...prev,
          pricing: prev.pricing.filter(p => p.id !== id)
      }));
  };

  const toggleOwner = (roleKey: keyof AdvancedConfig, userId: string) => {
    setConfig(prev => {
       const currentOwners = prev[roleKey] as string[];
       const newOwners = currentOwners.includes(userId) ? currentOwners.filter(id => id !== userId) : [...currentOwners, userId];
       return { ...prev, [roleKey]: newOwners };
    });
  };

  const updateRules = (partnerId: string, rules: string[]) => {
    setConfig(prev => ({
      ...prev,
      partnerRules: {
        ...prev.partnerRules,
        [partnerId]: rules
      }
    }));
  };

  // Category search state for partner selection
  const [categorySearch, setCategorySearch] = useState('');

  // Widget State
  const [visibleWidgets, setVisibleWidgets] = useState<string[]>([
      'kpi-open-po', 'kpi-open-so', 'kpi-last-price', 'kpi-lead-time',
      'widget-stock-health', 'widget-top-customers', 
      'widget-uom', 'widget-primary-vendor', 'widget-locations',
      'widget-activity'
  ]);
  const [insightsDrawerOpen, setInsightsDrawerOpen] = useState(false);

  const toggleWidget = (id: string) => {
      setVisibleWidgets(prev => 
          prev.includes(id) ? prev.filter(w => w !== id) : [...prev, id]
      );
  };

  if (!item) {
      return (
          <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-4">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <AlertCircle className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                  <h3 className="text-lg font-medium">Item not found</h3>
                  <p className="text-muted-foreground">The requested item details could not be loaded.</p>
              </div>
              <Button onClick={onBack}>Back to Library</Button>
          </div>
      );
  }

  // Determine status color
  const getStatusColor = (status: string) => {
      switch(status) {
          case 'In Stock': return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800";
          case 'Low Stock': return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800";
          case 'Out of Stock': return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800";
          default: return "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/20 dark:text-slate-400 dark:border-slate-800";
      }
  };

  // --- Widgets Definition ---
  const ALL_WIDGETS: WidgetDef[] = [
      {
          id: 'kpi-open-po',
          label: 'Open Purchase Orders',
          type: 'kpi',
          icon: ShoppingCart,
          render: () => (
            <Card className="border-[var(--border)] shadow-sm h-full rounded-xl overflow-hidden">
                <CardHeader className="px-4 pt-4 pb-2">
                    <CardTitle className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Open Purchase Orders</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0">
                    <div className="flex items-baseline justify-between gap-2">
                        <span className="text-3xl font-semibold text-[var(--foreground)] tracking-tight">3</span>
                        <span className="text-xs font-medium text-[var(--primary)] flex items-center gap-1 bg-[var(--primary)]/10 px-2 py-1 rounded-md">Active</span>
                    </div>
                    <p className="text-xs text-[var(--muted-foreground)] mt-2">Value: $12,500</p>
                </CardContent>
            </Card>
          )
      },
      {
          id: 'kpi-open-so',
          label: 'Open Sales Orders',
          type: 'kpi',
          icon: Users,
          render: () => (
            <Card className="border-[var(--border)] shadow-sm h-full rounded-xl overflow-hidden">
                <CardHeader className="px-4 pt-4 pb-2">
                    <CardTitle className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Open Sales Orders</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0">
                    <div className="flex items-baseline justify-between gap-2">
                        <span className="text-3xl font-semibold text-[var(--foreground)] tracking-tight">5</span>
                        <span className="text-xs font-medium text-[var(--accent)] flex items-center gap-1 bg-[var(--accent)]/10 px-2 py-1 rounded-md">
                            <TrendingUp size={12} /> High
                        </span>
                    </div>
                    <p className="text-xs text-[var(--muted-foreground)] mt-2">Total Demand: 450 EA</p>
                </CardContent>
            </Card>
          )
      },
      {
          id: 'kpi-last-price',
          label: 'Last Purchase Price',
          type: 'kpi',
          icon: DollarSign,
          render: () => (
            <Card className="border-[var(--border)] shadow-sm h-full rounded-xl overflow-hidden">
                <CardHeader className="px-4 pt-4 pb-2">
                    <CardTitle className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Last Purchase Price</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0">
                    <div className="flex items-baseline justify-between gap-2">
                        <span className="text-3xl font-semibold text-[var(--foreground)] tracking-tight">$24.50</span>
                        <span className="text-xs font-medium text-[var(--destructive)] flex items-center gap-1 bg-[var(--destructive)]/10 px-2 py-1 rounded-md">
                            <ArrowUpRight size={12} /> +2%
                        </span>
                    </div>
                    <p className="text-xs text-[var(--muted-foreground)] mt-2">vs Avg $24.00</p>
                </CardContent>
            </Card>
          )
      },
      {
          id: 'kpi-lead-time',
          label: 'Average Lead Time',
          type: 'kpi',
          icon: Clock,
          render: () => (
            <Card className="border-[var(--border)] shadow-sm h-full rounded-xl overflow-hidden">
                <CardHeader className="px-4 pt-4 pb-2">
                    <CardTitle className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Average Lead Time</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0">
                    <div className="flex items-baseline justify-between gap-2">
                        <span className="text-3xl font-semibold text-[var(--foreground)] tracking-tight">14</span>
                        <span className="text-xs font-medium text-[var(--accent)] flex items-center gap-1 bg-[var(--accent)]/10 px-2 py-1 rounded-md">
                            <Check size={12} /> Target
                        </span>
                    </div>
                    <p className="text-xs text-[var(--muted-foreground)] mt-2">Standard: 15 Days</p>
                </CardContent>
            </Card>
          )
      },
      {
          id: 'widget-top-customers',
          label: 'Top Customers',
          type: 'complex',
          defaultSpan: 1,
          icon: Users,
          render: () => <TopCustomersWidget />
      },
      {
          id: 'widget-primary-vendor',
          label: 'Primary Vendor',
          type: 'complex',
          defaultSpan: 1,
          icon: Factory,
          render: () => <PrimaryVendorWidget />
      },
      {
          id: 'widget-stock-health',
          label: 'Stock Health',
          type: 'complex',
          defaultSpan: 2,
          icon: BarChart3,
          render: (item) => <StockHealthWidget item={item} />
      },
      {
          id: 'widget-locations',
          label: 'Location Distribution',
          type: 'complex',
          defaultSpan: 1,
          icon: MapPin,
          render: () => <TopLocationsWidget />
      },
      {
          id: 'widget-uom',
          label: 'On-Hand by Unit of Measure',
          type: 'complex',
          defaultSpan: 1,
          icon: PieChartIcon,
          render: (item) => <UOMWidget item={item} />
      },
       {
          id: 'widget-activity',
          label: 'Transaction Activity',
          type: 'complex',
          defaultSpan: 3,
          icon: History,
          render: () => <ActivityWidget />
      },
  ];

  const activeKPIs = ALL_WIDGETS.filter(w => w.type === 'kpi' && visibleWidgets.includes(w.id));
  const activeMainWidgets = ALL_WIDGETS.filter(w => w.type !== 'kpi' && visibleWidgets.includes(w.id));

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col min-h-full w-full"
    >
      {/* New Vendor-style sticky morphing header */}
      <ItemDetailHeader
        item={item}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onBack={onBack}
        onEdit={onEdit}
        isFullscreen={isFullscreen}
        onFullscreenChange={setIsFullscreen}
        scrollContainerRef={effectiveScrollRef}
        activeImageIndex={activeImageIndex}
      />

      {/* Body wrapper — centered container, fullscreen-aware. Holds Tabs + all 7 TabsContent blocks below. */}
      <div className="flex-1">
        <div className={`mx-auto px-4 lg:px-6 xl:px-8 pt-3 pb-20 transition-all duration-300 ${isFullscreen ? "max-w-full" : "max-w-[1440px] 2xl:max-w-[1600px]"}`}>

      {/* 3. Tabs Area — shell only, header drives the tab bar.
          Legacy "Add Insights" Sheet was removed in D1b — its role is taken
          over by the Customize Widgets drawer inside the Overview body. */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">

          <TabsContent value="overview" className="space-y-6 focus-visible:outline-none animate-in fade-in slide-in-from-bottom-2 duration-300">
               {/* Vendor-style Overview: info bar + draggable KPI strip + widget grid.
                   Widget renderers come from the legacy ALL_WIDGETS catalog so we
                   keep using the existing widget bodies (Top Customers, Primary
                   Vendor, Stock Health, Locations, UOM, Activity). */}
               <ItemOverviewTab
                   item={item}
                   widgetRenderers={ALL_WIDGETS.reduce((acc, w) => {
                       if (w.type !== 'kpi') acc[w.id] = w.render;
                       return acc;
                   }, {} as Record<string, (item: any) => React.ReactNode>)}
                   widgetLabels={ALL_WIDGETS.reduce((acc, w) => {
                       acc[w.id] = w.label;
                       return acc;
                   }, {} as Record<string, string>)}
                   widgetMeta={{
                       'widget-stock-health':   { icon: BarChart3,    tooltip: 'Stock balance vs min/max thresholds. Includes On Hand, Allocated, Quarantined, Available, In Production, On Order, Projected Available, and Undergoing Movement.' },
                       'widget-uom':            { icon: PieChartIcon, tooltip: 'Distribution of on-hand quantity across units of measure (Each, Box, Pallet), all converted to the base UOM (EA).' },
                       'widget-locations':      { icon: MapPin,       tooltip: 'Top stocking locations for this item by quantity, with each location’s share of the total on-hand.' },
                       'widget-top-customers':  { icon: Users,        tooltip: 'Highest-revenue customers purchasing this item over the selected period.' },
                       'widget-primary-vendor': { icon: Factory,      tooltip: 'Preferred supplier for this item with rating, year-to-date spend, and target lead time.' },
                       'widget-activity':       { icon: History,      tooltip: 'Weekly stock movement: Increases (Receiving, Adjustment In, Manufactured) vs Decreases (Shipping, Adjustment Out, Consumed).' },
                   }}
               />
          </TabsContent>

          <TabsContent value="inventory" className="focus-visible:outline-none animate-in fade-in slide-in-from-bottom-2 duration-300">
               <Tabs defaultValue="overview" className="w-full">
                   {/* Outer Partners panel wrapper — sub-tab strip + sections live inside one bordered box */}
                   <div className="border border-border rounded-xl bg-card overflow-clip flex flex-col">
                       {/* Sub-tab strip — Partners literal segmented pill + right-side toolbar */}
                       <div className="flex items-center justify-between gap-3 px-4 pt-2.5 pb-2 border-b border-border">
                           {/* LEFT — segmented pill */}
                           <TabsList className="inline-flex items-center rounded-lg bg-muted p-0.5 h-auto">
                               {([
                                   { key: "overview", label: "Inventory Overview", icon: Boxes, color: "#1E40AF" },
                                   { key: "transactions", label: "Transactions", icon: History, color: "#5B21B6" },
                               ] as const).map((t) => (
                                   <TabsTrigger
                                       key={t.key}
                                       value={t.key}
                                       className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-md text-[13px] transition-all cursor-pointer text-slate-500 hover:text-slate-700 data-[state=active]:bg-white data-[state=active]:shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)] data-[state=active]:font-semibold"
                                       style={{ ['--active-color' as any]: t.color }}
                                   >
                                       <t.icon className="w-3.5 h-3.5" style={{ color: t.color }} />
                                       <span style={{ color: 'inherit' }}>{t.label}</span>
                                   </TabsTrigger>
                               ))}
                           </TabsList>

                           {/* RIGHT — alert count + divider + 3 action buttons */}
                           <div className="flex items-center gap-2 shrink-0">
                               <span className="text-sm tabular-nums hidden sm:inline" style={{ fontWeight: 500 }}>
                                   <span className="text-foreground">5</span>
                                   <span className="text-muted-foreground/70"> alerts</span>
                               </span>
                               <div className="w-px h-5 bg-border/60 hidden sm:block" />
                               <button
                                   type="button"
                                   className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-blue-100 bg-blue-50 text-primary hover:bg-blue-100 text-[13px] transition-colors cursor-pointer"
                                   style={{ fontWeight: 500 }}
                               >
                                   <Move className="w-3.5 h-3.5" />
                                   <span className="hidden sm:inline">Initiate Movement</span>
                               </button>
                               <button
                                   type="button"
                                   className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-blue-100 bg-blue-50 text-primary hover:bg-blue-100 text-[13px] transition-colors cursor-pointer"
                                   style={{ fontWeight: 500 }}
                               >
                                   <SlidersHorizontal className="w-3.5 h-3.5" />
                                   <span className="hidden sm:inline">Adjust Stock</span>
                               </button>
                               <button
                                   type="button"
                                   className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary hover:bg-[#0862D0] text-white text-[13px] shadow-sm transition-colors cursor-pointer"
                                   style={{ fontWeight: 600 }}
                               >
                                   <ClipboardCheck className="w-3.5 h-3.5" />
                                   <span className="hidden sm:inline">Initiate Cycle Count</span>
                               </button>
                           </div>
                       </div>

                       {/* Overview Tab — Partners-literal sectioned card grid */}
                       <TabsContent value="overview" className="p-4 mt-0 focus-visible:outline-none">
                           <div className="space-y-5">
                               {/* SECTION 1 — STOCK STATUS */}
                               <div>
                                   <div className="flex items-center gap-1.5 mb-2.5">
                                       <Activity className="w-3 h-3 text-slate-400" />
                                       <span className="text-[10px] text-slate-400 uppercase tracking-wider" style={{ fontWeight: 600 }}>Stock Status</span>
                                       <span className="text-[10px] text-primary bg-accent px-1.5 py-0.5 rounded-full" style={{ fontWeight: 600 }}>3</span>
                                   </div>
                                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                       {/* Low Stock Alert */}
                                       <InvCard
                                           severity="warning"
                                           pillIcon={AlertTriangle}
                                           pillSegA="Stock"
                                           pillSegB="Low"
                                           rightBadge="ALERT"
                                           name="Low Stock Alert"
                                           description="Reorder point reached 2 days ago"
                                           heroValue="150"
                                           heroLabel="EA"
                                           heroWarning
                                           detailLeft="Reorder point"
                                           detailRight="200 EA"
                                           footerMeta={[
                                               { icon: Package, value: "150 EA" },
                                               { icon: Clock, value: "2d ago" },
                                           ]}
                                           footerStatus="Below Min"
                                       />
                                       {/* Overstock Warning */}
                                       <InvCard
                                           severity="info"
                                           pillIcon={Layers}
                                           pillSegA="Stock"
                                           pillSegB="High"
                                           rightBadge="WARNING"
                                           name="Overstock Warning"
                                           description="Projected slow down in Q4"
                                           heroValue="2,500"
                                           heroLabel="EA"
                                           detailLeft="Max threshold"
                                           detailRight="2,000 EA"
                                           footerMeta={[
                                               { icon: Layers, value: "2,500 EA" },
                                               { icon: TrendingUp, value: "+500" },
                                           ]}
                                           footerStatus="+500 vs Max"
                                       />
                                       {/* Pending Cycle Counts */}
                                       <InvCard
                                           severity="audit"
                                           pillIcon={ClipboardCheck}
                                           pillSegA="Cycle"
                                           pillSegB="Audit"
                                           rightBadge="OVERDUE"
                                           name="Pending Cycle Counts"
                                           description="Zone A-01, Zone B-12 due"
                                           heroValue="2"
                                           heroLabel="Zones"
                                           detailLeft="Zones overdue"
                                           detailRight="A-01, B-12"
                                           footerMeta={[
                                               { icon: MapPin, value: "2 zones" },
                                               { icon: Clock, value: "Overdue" },
                                           ]}
                                           footerStatus="Overdue"
                                       />
                                   </div>
                               </div>

                               {/* SECTION 2 — INVENTORY HEALTH */}
                               <div>
                                   <div className="flex items-center gap-1.5 mb-2.5">
                                       <ShieldAlert className="w-3 h-3 text-slate-400" />
                                       <span className="text-[10px] text-slate-400 uppercase tracking-wider" style={{ fontWeight: 600 }}>Inventory Health</span>
                                       <span className="text-[10px] text-primary bg-accent px-1.5 py-0.5 rounded-full" style={{ fontWeight: 600 }}>2</span>
                                   </div>
                                   <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                       {/* Lots Requiring Action — list-body card */}
                                       <InvCard
                                           severity="critical"
                                           pillIcon={Calendar}
                                           pillSegA="Lots"
                                           pillSegB="Action"
                                           rightBadge="CRITICAL"
                                           name="Lots Requiring Action"
                                           description="Expired and near-expiry lots tracked across all locations"
                                           heroValue="7"
                                           heroLabel="lots flagged"
                                           bodyType="list"
                                           listRows={[
                                               { label: "Expired", value: "2", tone: "critical" },
                                               { label: "Near Expiry · 30d", value: "5", tone: "warning" },
                                           ]}
                                           footerMeta={[{ icon: Calendar, value: "7 lots" }]}
                                           footerLink="View All Lots →"
                                       />
                                       {/* Dead Stock Risk Analysis — list-body card with recommendation strip */}
                                       <InvCard
                                           severity="warning"
                                           pillIcon={AlertCircle}
                                           pillSegA="Risk"
                                           pillSegB="Dead Stock"
                                           rightBadge="MEDIUM"
                                           name="Dead Stock Risk Analysis"
                                           description="Risk of obsolescence based on movement, BOM linkage, and order history"
                                           heroValue="Medium"
                                           heroLabel="risk"
                                           bodyType="metrics"
                                           metricRows={[
                                               { icon: History, label: "Last Sales Order", value: "45d ago", tone: "critical" },
                                               { icon: Wrench, label: "Last Work Order", value: "2d ago", tone: "neutral" },
                                               { icon: Boxes, label: "Active BOM", value: "Yes", tone: "healthy", showCheck: true },
                                           ]}
                                           recommendation="Review active BOMs. Consider lowering safety stock if sales trend continues."
                                           footerMeta={[
                                               { icon: Activity, value: "Medium" },
                                               { icon: History, value: "45d" },
                                           ]}
                                           footerStatus="Review"
                                       />
                                   </div>
                               </div>
                           </div>
                       </TabsContent>

                       {/* Transactions sub-tab — toolbar/table parity with ItemsListPageV3 (Slice 1, no per-column menu/sort) */}
                       <TabsContent value="transactions" className="mt-0 focus-visible:outline-none">
                           <TransactionsPanel />
                       </TabsContent>
                   </div>
               </Tabs>
          </TabsContent>

          <TabsContent value="configurations" className="focus-visible:outline-none animate-in fade-in slide-in-from-bottom-2 duration-300 h-[800px] border border-border rounded-xl bg-background overflow-hidden shadow-sm">
               <ItemConfigurationMaster
                   config={config}
                   onConfigChange={(updates) => setConfig({ ...config, ...updates })}
                   partners={MOCK_PARTNERS}
                   users={MOCK_USERS}
                   locations={LOCATIONS}
                   uoms={UOMS}
                   variant="detail"
               />
          </TabsContent>

          <TabsContent value="purchasing" className="space-y-6 focus-visible:outline-none animate-in fade-in slide-in-from-bottom-2 duration-300">
               {/* Purchasing Sub-tabs */}
               <Tabs defaultValue="po" className="w-full">
                   <div className="flex items-center justify-between mb-4">
                       <TabsList className="bg-secondary/50 p-1 rounded-lg h-10">
                           <TabsTrigger 
                               value="po" 
                               className="rounded-md px-4 py-1.5 text-sm font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm text-muted-foreground transition-all"
                           >
                               Purchase Orders
                           </TabsTrigger>
                           <TabsTrigger 
                               value="vendors" 
                               className="rounded-md px-4 py-1.5 text-sm font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm text-muted-foreground transition-all"
                           >
                               Qualified Vendors
                           </TabsTrigger>
                       </TabsList>
                   </div>

                   {/* Purchase Orders Tab */}
                   <TabsContent value="po" className="focus-visible:outline-none mt-0">
                       <Card className="rounded-[12px] border border-border shadow-sm overflow-hidden">
                           <div className="p-0 overflow-x-auto">
                               <Table className="w-full">
                                   <TableHeader className="bg-secondary/20">
                                       <TableRow className="hover:bg-transparent border-b border-border">
                                           <TableHead className="w-[140px] font-medium text-muted-foreground text-xs uppercase tracking-wider pl-4">PO No</TableHead>
                                           <TableHead className="w-[240px] font-medium text-muted-foreground text-xs uppercase tracking-wider">Partner Location</TableHead>
                                           <TableHead className="w-[140px] font-medium text-muted-foreground text-xs uppercase tracking-wider">Status</TableHead>
                                           <TableHead className="w-[200px] font-medium text-muted-foreground text-xs uppercase tracking-wider">Ordered Item(s)</TableHead>
                                           <TableHead className="w-[160px] font-medium text-muted-foreground text-xs uppercase tracking-wider">Point of Contact</TableHead>
                                           <TableHead className="w-[180px] font-medium text-muted-foreground text-xs uppercase tracking-wider">Location</TableHead>
                                           <TableHead className="w-[180px] font-medium text-muted-foreground text-xs uppercase tracking-wider">Created By</TableHead>
                                           <TableHead className="w-[140px] font-medium text-muted-foreground text-xs uppercase tracking-wider">Due Delivery Date</TableHead>
                                           <TableHead className="w-[140px] font-medium text-muted-foreground text-xs uppercase tracking-wider">Order Date</TableHead>
                                           <TableHead className="w-[60px] text-center font-medium text-muted-foreground text-xs uppercase tracking-wider pr-4">Actions</TableHead>
                                       </TableRow>
                                   </TableHeader>
                                   <TableBody>
                                       {[
                                           { po: '395-9825', partner: 'General Motors (GM)', partnerIcon: 'G', status: 'Draft', item: '100219-51-01', contact: 'Jerome Bell', location: 'Pasadena, Oklahoma', created: 'Ahtisham Ahmad', due: 'Dec 23, 2024', order: 'Dec 09, 2024' },
                                           { po: '395-9823', partner: 'Toyota Technical Center (TTC)', partnerIcon: 'T', status: 'Sent', item: '100219-51-01', contact: 'Cameron Williamson', location: 'Great Falls, Maryland', created: 'Faizan Khan', due: 'Nov 25, 2024', order: 'Nov 09, 2024' },
                                           { po: '395-9824', partner: 'Ford Motor Company', partnerIcon: 'F', status: 'Active with Cancellation', item: '100219-51-01', contact: 'Leslie Alexander', location: 'Lansing, Illinois', created: 'Areeb Tanveer', due: 'Oct 29, 2024', order: 'Oct 09, 2024' },
                                           { po: '395-9826', partner: 'Tesla, Inc.', partnerIcon: 'T', status: 'Draft', item: '100219-51-01', contact: 'Jerome Bell', location: 'Pasadena, Oklahoma', created: 'Ahtisham Ahmad', due: 'Dec 23, 2024', order: 'Dec 09, 2024' },
                                           { po: '395-9827', partner: 'Chrysler (Stellantis N.V.)', partnerIcon: 'C', status: 'Sent', item: '100219-51-01', contact: 'Cameron Williamson', location: 'Great Falls, Maryland', created: 'Faizan Khan', due: 'Nov 25, 2024', order: 'Nov 09, 2024' },
                                           { po: '395-9828', partner: 'Rivian Automotive', partnerIcon: 'R', status: 'Active with Cancellation', item: '100219-51-01', contact: 'Leslie Alexander', location: 'Lansing, Illinois', created: 'Areeb Tanveer', due: 'Oct 29, 2024', order: 'Oct 09, 2024' },
                                           { po: '395-9829', partner: 'Lucid Motors', partnerIcon: 'L', status: 'Confirmed', item: '100219-51-01', contact: 'Marvin McKinney', location: 'Portland, Illinois', created: 'Eli Rosenbloom', due: 'Sep 15, 2024', order: 'Sep 09, 2024' },
                                           { po: '395-9830', partner: 'Honda Motor Co., Ltd. (USA)', partnerIcon: 'H', status: 'Partially Received', item: '100219-51-01', contact: 'Brooklyn Simmons', location: 'Lafayette, California', created: 'Nophil Anwer', due: 'Aug 18, 2024', order: 'Aug 09, 2024' },
                                           { po: '395-9831', partner: 'Nissan North America', partnerIcon: 'N', status: 'Cancelled', item: '100219-51-01', contact: 'Savannah Nguyen', location: 'Stockton, New Hampshire', created: 'Irtaza Abid', due: 'Jul 23, 2024', order: 'Jul 09, 2024' },
                                           { po: '395-9832', partner: 'BMW of North America', partnerIcon: 'B', status: 'Fully Received', item: '100219-51-01', contact: 'Jerome Bell', location: 'Pasadena, Oklahoma', created: 'Ahtisham Ahmad', due: 'Jun 14, 2024', order: 'Jun 09, 2024' },
                                       ].map((row, i) => (
                                           <TableRow key={i} className="group hover:bg-muted/30 border-b border-border/50">
                                               <TableCell className="font-mono text-xs text-muted-foreground pl-4">{row.po}</TableCell>
                                               <TableCell>
                                                   <div className="flex items-center gap-2">
                                                       <div className="h-5 w-5 rounded bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                                                            {row.partnerIcon}
                                                       </div>
                                                       <span className="text-sm font-medium text-foreground truncate max-w-[180px]">{row.partner}</span>
                                                   </div>
                                               </TableCell>
                                               <TableCell>
                                                   <Badge 
                                                       variant="secondary" 
                                                       className={cn(
                                                           "rounded-md px-2 py-0.5 text-[10px] font-medium border-0",
                                                           row.status === 'Draft' && "bg-secondary text-muted-foreground",
                                                           row.status === 'Sent' && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                                                           row.status === 'Active with Cancellation' && "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
                                                           row.status === 'Confirmed' && "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
                                                           row.status === 'Partially Received' && "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
                                                           row.status === 'Cancelled' && "bg-red-50 text-red-600 border border-red-100 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900",
                                                           row.status === 'Fully Received' && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                                       )}
                                                   >
                                                       {row.status}
                                                   </Badge>
                                               </TableCell>
                                               <TableCell>
                                                   <div className="flex items-center gap-2">
                                                       <div className="h-6 w-6 rounded bg-secondary/50 border border-border p-0.5 shrink-0">
                                                            <ImageIcon size={12} className="text-muted-foreground w-full h-full opacity-50" />
                                                       </div>
                                                       <div className="flex items-center gap-1.5">
                                                           <span className="text-xs font-mono text-foreground">{row.item}</span>
                                                           <Badge variant="outline" className="text-[9px] h-4 px-1 text-muted-foreground bg-secondary/30">+2 more</Badge>
                                                       </div>
                                                   </div>
                                               </TableCell>
                                               <TableCell>
                                                   <span className="text-xs text-primary hover:underline cursor-pointer font-medium decoration-primary/30 underline-offset-2">{row.contact}</span>
                                               </TableCell>
                                               <TableCell className="text-xs text-muted-foreground">{row.location}</TableCell>
                                               <TableCell>
                                                   <div className="flex items-center gap-2">
                                                       <div className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-bold">
                                                           {row.created.split(' ').map(n => n[0]).join('')}
                                                       </div>
                                                       <span className="text-xs text-foreground">{row.created}</span>
                                                   </div>
                                               </TableCell>
                                               <TableCell className="text-xs text-muted-foreground">{row.due}</TableCell>
                                               <TableCell className="text-xs text-muted-foreground">{row.order}</TableCell>
                                               <TableCell className="pr-4 text-center">
                                                   <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                                                       <MoreHorizontal size={14} />
                                                   </Button>
                                               </TableCell>
                                           </TableRow>
                                       ))}
                                   </TableBody>
                               </Table>
                           </div>
                           <div className="border-t border-border p-3 flex items-center justify-between bg-card">
                               <div className="flex items-center gap-2">
                                   <span className="text-xs text-muted-foreground">Records per page</span>
                                   <Select defaultValue="20">
                                       <SelectTrigger className="h-7 w-[60px] text-xs"><SelectValue /></SelectTrigger>
                                       <SelectContent>
                                           <SelectItem value="10">10</SelectItem>
                                           <SelectItem value="20">20</SelectItem>
                                           <SelectItem value="50">50</SelectItem>
                                       </SelectContent>
                                   </Select>
                               </div>
                               <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                   <Button variant="ghost" size="icon" className="h-7 w-7" disabled><ArrowLeft size={12} /></Button>
                                   <Button variant="ghost" size="icon" className="h-7 w-7 text-xs font-medium">Prev</Button>
                                   <Button variant="secondary" className="h-7 w-7 p-0 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90">1</Button>
                                   <Button variant="ghost" className="h-7 w-7 p-0 text-xs font-medium">2</Button>
                                   <span className="px-1">...</span>
                                   <Button variant="ghost" className="h-7 w-7 p-0 text-xs font-medium">5</Button>
                                   <Button variant="ghost" className="h-7 w-7 p-0 text-xs font-medium">6</Button>
                                   <Button variant="ghost" size="icon" className="h-7 w-7 text-xs font-medium">Next</Button>
                                   <Button variant="ghost" size="icon" className="h-7 w-7"><ArrowRight size={12} /></Button>
                               </div>
                           </div>
                       </Card>
                   </TabsContent>

                   {/* Qualified Vendors Tab */}
                   <TabsContent value="vendors" className="focus-visible:outline-none mt-0">
                       <QualifiedVendorsTab partNumber={item.partNumber} />
                   </TabsContent>
               </Tabs>
          </TabsContent>

          <TabsContent value="production" className="focus-visible:outline-none animate-in fade-in slide-in-from-bottom-2 duration-300">
               <ComingSoonEmptyState
                   icon={Factory}
                   title="Production Module"
                   description="Manufacturing and Bill of Materials (BOM) management features are coming soon."
               />
          </TabsContent>

          <TabsContent value="sales" className="space-y-6 focus-visible:outline-none animate-in fade-in slide-in-from-bottom-2 duration-300">
               <SalesOverviewPanel
                   onCreateShipment={() => { window.location.href = '/shipments/new?item=' + item.partNumber; }}
                   shipmentsContent={<ShipmentsTable />}
               />
          </TabsContent>

          <TabsContent value="attachments" className="focus-visible:outline-none animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">
               <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                   <div>
                       <h3 className="text-lg font-semibold">Files & Assets</h3>
                       <p className="text-sm text-muted-foreground">Manage documentation, media, and module-specific files.</p>
                   </div>
                   <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
                       <DialogTrigger asChild>
                           <Button><Plus size={16} className="mr-2" /> Upload New</Button>
                       </DialogTrigger>
                       <DialogContent className="sm:max-w-[425px]">
                           <DialogHeader>
                               <DialogTitle>{isUploading ? 'Uploading...' : 'Upload Attachment'}</DialogTitle>
                               <DialogDescription>{isUploading ? 'Please wait while your file is being uploaded.' : 'Add a new file to this item. Specify the category to control visibility.'}</DialogDescription>
                           </DialogHeader>
                           {isUploading ? (
                               <div className="py-8 space-y-4">
                                   <div className="flex items-center justify-between text-sm">
                                       <span>{newFileCategory === 'media' ? 'New_Image.png' : 'New_Document.pdf'}</span>
                                       <span className="text-muted-foreground">{uploadProgress}%</span>
                                   </div>
                                   <Progress value={uploadProgress} className="h-2" />
                               </div>
                           ) : (
                               <div className="grid gap-6 py-4">
                                   <div className="border-2 border-dashed border-border rounded-xl h-32 flex flex-col items-center justify-center bg-secondary/10 hover:bg-secondary/20 transition-colors cursor-pointer">
                                       <div className="h-10 w-10 rounded-full bg-background flex items-center justify-center mb-2 shadow-sm">
                                           <Upload size={18} className="text-muted-foreground" />
                                       </div>
                                       <p className="text-sm font-medium">Click to browse or drag file here</p>
                                       <p className="text-xs text-muted-foreground">Max size 10MB</p>
                                   </div>
                                   
                                   <div className="space-y-3">
                                       <Label>File Category</Label>
                                       <RadioGroup value={newFileCategory} onValueChange={setNewFileCategory} className="grid grid-cols-1 gap-3">
                                           <div className={cn("flex items-start space-x-3 border rounded-lg p-3 cursor-pointer transition-all", newFileCategory === 'media' ? "bg-primary/5 border-primary ring-1 ring-primary" : "hover:bg-secondary/20")}>
                                               <RadioGroupItem value="media" id="cat-media" className="mt-1" />
                                               <div className="space-y-1">
                                                    <Label htmlFor="cat-media" className="font-semibold cursor-pointer">Item Gallery & Media</Label>
                                                    <p className="text-xs text-muted-foreground">Public visuals, thumbnails, and product photography.</p>
                                               </div>
                                           </div>
                                           <div className={cn("flex items-start space-x-3 border rounded-lg p-3 cursor-pointer transition-all", newFileCategory === 'document' ? "bg-primary/5 border-primary ring-1 ring-primary" : "hover:bg-secondary/20")}>
                                               <RadioGroupItem value="document" id="cat-doc" className="mt-1" />
                                               <div className="space-y-1">
                                                    <Label htmlFor="cat-doc" className="font-semibold cursor-pointer">General Documentation</Label>
                                                    <p className="text-xs text-muted-foreground">Specs, manuals, and guides available to all users.</p>
                                               </div>
                                           </div>
                                           <div className={cn("flex items-start space-x-3 border rounded-lg p-3 cursor-pointer transition-all", newFileCategory === 'module' ? "bg-primary/5 border-primary ring-1 ring-primary" : "hover:bg-secondary/20")}>
                                               <RadioGroupItem value="module" id="cat-mod" className="mt-1" />
                                               <div className="space-y-1">
                                                    <Label htmlFor="cat-mod" className="font-semibold cursor-pointer">Module Restricted</Label>
                                                    <p className="text-xs text-muted-foreground">Sensitive files linked to specific departments (PO/SO).</p>
                                               </div>
                                           </div>
                                       </RadioGroup>
                                   </div>

                                   {newFileCategory === 'module' && (
                                       <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                           <Label>Select Module Context</Label>
                                           <Select value={newFileModule} onValueChange={setNewFileModule}>
                                               <SelectTrigger><SelectValue /></SelectTrigger>
                                               <SelectContent>
                                                   <SelectItem value="purchasing">Purchasing & Procurement</SelectItem>
                                                   <SelectItem value="sales">Sales & Fulfillment</SelectItem>
                                                   <SelectItem value="production">Production & Engineering</SelectItem>
                                                   <SelectItem value="finance">Finance & Accounting</SelectItem>
                                               </SelectContent>
                                           </Select>
                                       </div>
                                   )}
                               </div>
                           )}
                           <DialogFooter>
                               <Button variant="outline" onClick={() => setUploadOpen(false)} disabled={isUploading}>Cancel</Button>
                               <Button disabled={isUploading} onClick={() => {
                                   setIsUploading(true);
                                   setUploadProgress(0);
                                   
                                   // Simulation
                                   let progress = 0;
                                   const interval = setInterval(() => {
                                       progress += 10;
                                       setUploadProgress(progress);
                                       if (progress >= 100) {
                                           clearInterval(interval);
                                           setTimeout(() => {
                                                const newFile = {
                                                   id: Math.random().toString(),
                                                   name: newFileCategory === 'media' ? 'New_Image.png' : 'New_Document.pdf',
                                                   size: '1.5 MB',
                                                   type: newFileCategory === 'media' ? 'image/png' : 'application/pdf',
                                                   category: newFileCategory,
                                                   moduleContext: newFileCategory === 'module' ? newFileModule : undefined,
                                                   uploadedBy: 'Current User',
                                                   date: 'Just now',
                                                   url: newFileCategory === 'media' ? 'https://images.unsplash.com/photo-1586769852044-692d6e3703f0?auto=format&fit=crop&q=80&w=500' : undefined
                                               };
                                               setAttachments(prev => [...prev, newFile]);
                                               setIsUploading(false);
                                               setUploadOpen(false);
                                           }, 500);
                                       }
                                   }, 150);
                               }}>
                                   {isUploading ? 'Uploading...' : 'Upload File'}
                               </Button>
                           </DialogFooter>
                       </DialogContent>
                   </Dialog>
               </div>

               {/* 1. Item Media Gallery */}
               <div className="space-y-3">
                   <div className="flex items-center gap-2">
                       <ImageIcon size={16} className="text-muted-foreground" />
                       <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Item Gallery</h4>
                   </div>
                   <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                       {attachments.filter(a => a.category === 'media').map(file => (
                           <div key={file.id} className="group relative aspect-square rounded-xl border border-border bg-secondary/10 overflow-hidden cursor-pointer hover:shadow-md transition-all">
                               <img src={file.url} alt={file.name} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                               <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                                   <p className="text-white text-xs font-medium truncate">{file.name}</p>
                                   <p className="text-white/80 text-[10px]">{file.size}</p>
                               </div>
                               <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                   <Button size="icon" variant="secondary" className="h-6 w-6 rounded-full"><MoreHorizontal size={14} /></Button>
                               </div>
                           </div>
                       ))}
                       {/* Add Button Placeholder */}
                       <div onClick={() => { setUploadOpen(true); setNewFileCategory('media'); }} className="aspect-square rounded-xl border-2 border-dashed border-border bg-secondary/5 flex flex-col items-center justify-center text-muted-foreground hover:bg-secondary/20 hover:text-foreground cursor-pointer transition-colors">
                           <Plus size={24} className="mb-2 opacity-50" />
                           <span className="text-xs font-medium">Add Media</span>
                       </div>
                   </div>
               </div>
               
               <Separator />

               {/* 2. General Documents */}
               <div className="space-y-3">
                   <div className="flex items-center gap-2">
                       <FileText size={16} className="text-muted-foreground" />
                       <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">General Documentation</h4>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                       {attachments.filter(a => a.category === 'document').map(file => {
                           const Icon = getFileIcon(file.type);
                           const colorClass = getFileColor(file.type);
                           return (
                               <div key={file.id} className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-accent/50 transition-colors group">
                                   <div className={cn("h-12 w-12 rounded-lg flex items-center justify-center shrink-0", colorClass)}>
                                       <Icon size={24} />
                                   </div>
                                   <div className="flex-1 min-w-0">
                                       <div className="flex items-center gap-2">
                                           <p className="font-medium text-sm truncate">{file.name}</p>
                                            <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-normal text-muted-foreground">Global</Badge>
                                       </div>
                                       <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                           <span>{file.size}</span>
                                           <span>•</span>
                                           <span>{file.date}</span>
                                           <span>•</span>
                                           <span>{file.uploadedBy}</span>
                                       </div>
                                   </div>
                                   <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity"><Download size={16} /></Button>
                               </div>
                           );
                       })}
                       {attachments.filter(a => a.category === 'document').length === 0 && (
                            <div className="col-span-full py-8 text-center border-2 border-dashed border-border rounded-xl bg-secondary/5">
                                <p className="text-sm text-muted-foreground">No general documents attached.</p>
                                <Button variant="link" size="sm" onClick={() => { setUploadOpen(true); setNewFileCategory('document'); }}>Upload Document</Button>
                            </div>
                       )}
                   </div>
               </div>

               <Separator />

               {/* 3. Module Restricted */}
               <div className="space-y-3">
                   <div className="flex items-center gap-2">
                       <ShieldCheck size={16} className="text-muted-foreground" />
                       <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Module Restricted Assets</h4>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       {['purchasing', 'sales', 'production', 'finance'].map(module => {
                           const moduleFiles = attachments.filter(a => a.category === 'module' && a.moduleContext === module);
                           if (moduleFiles.length === 0) return null;
                           
                           return (
                               <Card key={module} className="overflow-hidden border-border shadow-sm rounded-[12px]">
                                   <div className="px-4 py-4 bg-secondary/20 border-b border-border flex items-center justify-between">
                                       <div className="flex items-center gap-2">
                                            {module === 'purchasing' && <ShoppingCart size={14} />}
                                            {module === 'sales' && <TrendingUp size={14} />}
                                            {module === 'production' && <Factory size={14} />}
                                            {module === 'finance' && <DollarSign size={14} />}
                                            <span className="text-xs font-bold uppercase tracking-wide">{module}</span>
                                       </div>
                                       <Badge variant="secondary" className="h-5 text-[10px] gap-1"><Lock size={8} /> Restricted</Badge>
                                   </div>
                                   <div className="p-4 space-y-1">
                                       {moduleFiles.map(file => {
                                           const Icon = getFileIcon(file.type);
                                           return (
                                               <div key={file.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer group">
                                                   <div className="h-8 w-8 rounded bg-background border border-border flex items-center justify-center text-muted-foreground shrink-0">
                                                       <Icon size={14} />
                                                   </div>
                                                   <div className="flex-1 min-w-0">
                                                       <p className="text-sm font-medium truncate">{file.name}</p>
                                                       <p className="text-[10px] text-muted-foreground">{file.size} • Uploaded by {file.uploadedBy}</p>
                                                   </div>
                                                   <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100"><MoreHorizontal size={14} /></Button>
                                               </div>
                                           );
                                       })}
                                   </div>
                               </Card>
                           );
                       })}
                       {attachments.filter(a => a.category === 'module').length === 0 && (
                            <div className="col-span-full py-8 text-center border-2 border-dashed border-border rounded-xl bg-secondary/5">
                                <p className="text-sm text-muted-foreground">No restricted module assets found.</p>
                                <Button variant="link" size="sm" onClick={() => { setUploadOpen(true); setNewFileCategory('module'); }}>Add Restricted File</Button>
                            </div>
                       )}
                   </div>
               </div>
          </TabsContent>
      </Tabs>
        </div>
      </div>
    </motion.div>
  );
}
