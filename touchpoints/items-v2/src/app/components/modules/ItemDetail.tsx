// @ts-nocheck
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ItemOverviewTab } from './itemDetail/ItemOverviewTab';
import { baseCompact, baseMoney } from '@/app/currency/itemMoney';
import { BASE_CURRENCY } from '@/app/currency/currencies';
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
  ArrowUp,
  ArrowDown,
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
import { SalesOverviewPanel } from './SalesOverview/SalesOverviewPanel';
import { ItemPurchasingTab } from './purchasing/ItemPurchasingTab';
import { ShipmentsTable } from './SalesOverview/ShipmentsTable';
import { QuotesOverview } from './QuotesOverview';
import { ItemDetailHeader } from './itemDetail/ItemDetailHeader';
import { StockHealthWidget } from './itemDetail/StockHealthWidget';
import { ItemLifecycleModal, type ItemLifecycleAction } from './ItemLifecycleModal';
import { useItems } from '../../context/ItemsContext';
import { toast } from 'sonner';
import {
  ColumnSelector,
  ColumnSelectorTrigger,
  TransactionStatusBadge,
  InitialAvatar,
  ComingSoonEmptyState,
} from '../items-v3';
import type { ColumnConfig } from '../items-v3';
import { AttachmentsTab } from '@/app/components/attachments/attachments-tab';
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
  
  // Pioneer 3-slot Ownership (item override + optional inherited shadow).
  owners: {
    materialHandling: string[];
    purchasing: string | null;
    finance: string | null;
  };
  inheritedOwners?: {
    materialHandling?: string[];
    purchasing?: string;
    finance?: string;
  };
  
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
  
  cycleDeviation: '0',
  cycleRecurrence: 'Monthly',
  cycleApproval: false,
  
  owners: {
    materialHandling: [],
    purchasing: null,
    finance: null,
  },
  
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
    // Top Customers — Partners list-widget idiom: name + amount + inline progress bar.
    // Sales to a customer add up in the base currency (currency/itemMoney.ts).
    const PIE = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];
    const rows = [
      { name: "Acme Corp",     amount: baseCompact(45230), share: 32 },
      { name: "Globex Inc",    amount: baseCompact(28400), share: 21 },
      { name: "Soylent Corp",  amount: baseCompact(15100), share: 12 },
      { name: "Initech",       amount: baseCompact(12050), share: 9 },
      { name: "Umbrella Corp", amount: baseCompact(8200),  share: 6 },
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
            <div className="text-[15px] text-foreground mt-0.5" style={{ fontWeight: 700 }}>{baseCompact(124000)}</div>
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

type TxControlScope = 'Serialized' | 'Lot' | 'Lot-Serialized' | 'Non-Serialized';

type TxRow = {
    id: string;
    txId: string;
    date: string;
    time: string;
    type: string;             // transaction type (Receiving, Consumption, ...)
    sourceLink: string;       // href ('' when none)
    sourceLinkLabel: string;  // display label ('-' when none)
    serial: string;           // primary serial / lot ref
    serialExtra?: string;     // "+N More" pill label
    additionalSerials?: string[];
    plannedQty: number | null;
    processedQty: number | null;
    onHandBefore: number | null;
    onHandAfter: number | null;
    onHandAfterDirection?: 'up' | 'down' | null;
    price: number;            // price per unit
    valuationBefore: number | null;
    valuationAfter: number | null;
    changeInValuation: number | null;
    locations: string[];
    createdBy: string;
    controlScope?: TxControlScope[]; // when set, row only shows for these control types
};

/* Transaction-event rows pulled 1:1 from the Physical Inventory module's
   Transactions tab (transactions-tab.tsx). Rows with no controlScope show for
   every control type; scoped rows (Quarantine / Checked Out / Split LOT
   variants) show only for the listed types, so the Serialized vs Non-serialized
   detail pages see different subsets exactly like PI. */
const TX_ROWS: TxRow[] = [
    { id: 'tx1', txId: 'TX-2025-4561', date: '10/23/2025', time: '5:28 PM', type: 'Adjustment Decrease', sourceLink: '', sourceLinkLabel: '-', serial: 'LI-123141', serialExtra: '+4 More', additionalSerials: ['LI-123142', 'LI-123143', 'LI-123144', 'LI-123145'], plannedQty: null, processedQty: null, onHandBefore: 458, onHandAfter: 450, onHandAfterDirection: 'down', price: 22.5, valuationBefore: 10305.0, valuationAfter: 10125.0, changeInValuation: -180.0, locations: ['Zone A-01'], createdBy: 'Ahtisham Ahmad' },
    { id: 'tx2', txId: 'TX-2025-4552', date: '10/23/2025', time: '2:57 PM', type: 'Consumption', sourceLink: '/wo/7001', sourceLinkLabel: 'WO-7001', serial: 'LI-123141', serialExtra: '+2 More', additionalSerials: ['LI-123142', 'LI-123143'], plannedQty: 5, processedQty: 3, onHandBefore: 463, onHandAfter: 458, onHandAfterDirection: 'down', price: 22.5, valuationBefore: 10417.5, valuationAfter: 10305.0, changeInValuation: -112.5, locations: ['Zone A-01'], createdBy: 'Maya Thompson' },
    { id: 'tx3', txId: 'TX-2025-4553', date: '10/23/2025', time: '2:57 PM', type: 'Receiving', sourceLink: '/receiving/1234', sourceLinkLabel: 'PO-001234', serial: 'LI-123141', serialExtra: '+2 More', additionalSerials: ['LI-123142', 'LI-123143'], plannedQty: 3, processedQty: 3, onHandBefore: 450, onHandAfter: 453, onHandAfterDirection: 'up', price: 22.5, valuationBefore: 10102.5, valuationAfter: 10170.0, changeInValuation: 67.5, locations: ['Zone A-01'], createdBy: 'Ahtisham Ahmad' },
    { id: 'tx4', txId: 'TX-2025-4554', date: '10/23/2025', time: '2:52 PM', type: 'Cycle Count', sourceLink: '/cc/2041', sourceLinkLabel: 'CC-2041', serial: 'LI-123141', serialExtra: '+2 More', additionalSerials: ['LI-123142', 'LI-123143'], plannedQty: 740, processedQty: 735, onHandBefore: 740, onHandAfter: 735, onHandAfterDirection: 'down', price: 22.5, valuationBefore: 16650.0, valuationAfter: 16537.5, changeInValuation: -112.5, locations: ['Zone A-01', 'Zone B-03', 'Zone C-02'], createdBy: 'Maya Thompson' },
    { id: 'tx5', txId: 'TX-2025-4545', date: '10/23/2025', time: '2:40 PM', type: 'Manufactured', sourceLink: '/wo/7001', sourceLinkLabel: 'WO-7001', serial: 'LI-123141', serialExtra: '+1 More', additionalSerials: ['LI-123142'], plannedQty: 10, processedQty: 10, onHandBefore: 440, onHandAfter: 450, onHandAfterDirection: 'up', price: 22.5, valuationBefore: 9900.0, valuationAfter: 10125.0, changeInValuation: 225.0, locations: ['Zone TR-012'], createdBy: 'Ahtisham Ahmad' },
    { id: 'tx6', txId: 'TX-2025-4536', date: '10/23/2025', time: '2:30 PM', type: 'Movement', sourceLink: '/movement/2201', sourceLinkLabel: 'MV-22-0019', serial: 'LI-123141', plannedQty: 25, processedQty: 10, onHandBefore: 465, onHandAfter: 465, onHandAfterDirection: null, price: 22.5, valuationBefore: 10462.5, valuationAfter: 10462.5, changeInValuation: null, locations: ['Zone A-01', 'Staging-1'], createdBy: 'Maya Thompson' },
    { id: 'tx7', txId: 'TX-2025-4517', date: '10/23/2025', time: '2:15 PM', type: 'Consumption', sourceLink: '/wo/7001', sourceLinkLabel: 'WO-7001', serial: 'LI-123145', serialExtra: '+3 More', additionalSerials: ['LI-123146', 'LI-123147', 'LI-123148'], plannedQty: 8, processedQty: 5, onHandBefore: 470, onHandAfter: 465, onHandAfterDirection: 'down', price: 22.5, valuationBefore: 10575.0, valuationAfter: 10462.5, changeInValuation: -112.5, locations: ['WH1-1-L2'], createdBy: 'Daniel Adams' },
    { id: 'tx8', txId: 'TX-2025-4528', date: '10/23/2025', time: '1:45 PM', type: 'Movement', sourceLink: '/movement/2201', sourceLinkLabel: 'MV-22-0018', serial: 'LI-123142', plannedQty: 20, processedQty: 15, onHandBefore: 485, onHandAfter: 485, onHandAfterDirection: null, price: 22.5, valuationBefore: 10912.5, valuationAfter: 10912.5, changeInValuation: null, locations: ['Zone A-01', 'WH1-1-L2', 'Dock-2A'], createdBy: 'Maya Thompson' },
    { id: 'tx9', txId: 'TX-2025-4509', date: '10/22/2025', time: '4:30 PM', type: 'Receiving', sourceLink: '/receiving/1235', sourceLinkLabel: 'PO-001235', serial: 'LI-123150', serialExtra: '+5 More', additionalSerials: ['LI-123151', 'LI-123152', 'LI-123153', 'LI-123154', 'LI-123155'], plannedQty: 15, processedQty: 15, onHandBefore: 470, onHandAfter: 485, onHandAfterDirection: 'up', price: 22.5, valuationBefore: 10575.0, valuationAfter: 10912.5, changeInValuation: 337.5, locations: ['Zone A-01'], createdBy: 'Bruce Xavier' },
    { id: 'tx10', txId: 'TX-2025-4490', date: '10/22/2025', time: '2:48 PM', type: 'Movement', sourceLink: '/movement/2200', sourceLinkLabel: 'MV-22-0017', serial: 'LI-123155', plannedQty: 30, processedQty: 20, onHandBefore: 500, onHandAfter: 500, onHandAfterDirection: null, price: 22.5, valuationBefore: 11250.0, valuationAfter: 11250.0, changeInValuation: null, locations: ['Zone B-05', 'Zone A-01', 'Staging-1', 'Zone C-05'], createdBy: 'Maya Jane Cooper' },
    { id: 'tx11', txId: 'TX-2025-4481', date: '10/22/2025', time: '2:46 PM', type: 'Receiving', sourceLink: '/receiving/1236', sourceLinkLabel: 'PO-001236', serial: 'LI-123160', serialExtra: '+7 More', additionalSerials: ['LI-123161', 'LI-123162', 'LI-123163', 'LI-123164', 'LI-123165', 'LI-123166', 'LI-123167'], plannedQty: 30, processedQty: 30, onHandBefore: 470, onHandAfter: 500, onHandAfterDirection: 'up', price: 22.5, valuationBefore: 10575.0, valuationAfter: 11250.0, changeInValuation: 675.0, locations: ['Zone A-01'], createdBy: 'Marshall Mathews' },
    { id: 'tx12', txId: 'TX-2025-4462', date: '10/22/2025', time: '2:44 PM', type: 'Consumption', sourceLink: '/wo/7002', sourceLinkLabel: 'WO-7002', serial: 'LI-123165', serialExtra: '+1 More', additionalSerials: ['LI-123166'], plannedQty: 12, processedQty: 10, onHandBefore: 480, onHandAfter: 470, onHandAfterDirection: 'down', price: 22.5, valuationBefore: 10800.0, valuationAfter: 10575.0, changeInValuation: -225.0, locations: ['Zone A-01'], createdBy: 'Maya Thompson' },
    { id: 'tx13', txId: 'TX-2025-4473', date: '10/22/2025', time: '2:45 PM', type: 'Movement', sourceLink: '/movement/2199', sourceLinkLabel: 'MV-22-0016', serial: 'LI-123170', plannedQty: 15, processedQty: 10, onHandBefore: 490, onHandAfter: 490, onHandAfterDirection: null, price: 22.5, valuationBefore: 11025.0, valuationAfter: 11025.0, changeInValuation: null, locations: ['Zone A-01', 'Staging-1', 'Zone TR-012'], createdBy: 'Branby Grey' },
    { id: 'tx14', txId: 'TX-2025-4454', date: '10/22/2025', time: '2:43 PM', type: 'Receiving', sourceLink: '/receiving/1237', sourceLinkLabel: 'PO-001237', serial: 'LI-123175', serialExtra: '+4 More', additionalSerials: ['LI-123176', 'LI-123177', 'LI-123178', 'LI-123179'], plannedQty: 10, processedQty: 10, onHandBefore: 480, onHandAfter: 490, onHandAfterDirection: 'up', price: 22.5, valuationBefore: 10800.0, valuationAfter: 11025.0, changeInValuation: 225.0, locations: ['Zone A-01'], createdBy: 'Sydney Stone' },
    { id: 'tx15', txId: 'TX-2025-4445', date: '10/22/2025', time: '1:15 PM', type: 'Adjustment Increase', sourceLink: '/cc/2041', sourceLinkLabel: 'CC-2041', serial: 'LI-123180', serialExtra: '+2 More', additionalSerials: ['LI-123181', 'LI-123182'], plannedQty: null, processedQty: null, onHandBefore: 475, onHandAfter: 480, onHandAfterDirection: 'up', price: 22.5, valuationBefore: 10687.5, valuationAfter: 10800.0, changeInValuation: 112.5, locations: ['Zone B-03'], createdBy: 'Daniel Adams' },
    { id: 'tx16', txId: 'TX-2025-4436', date: '10/22/2025', time: '11:30 AM', type: 'Shipping', sourceLink: '/shipping/3001', sourceLinkLabel: 'SHP-3001', serial: 'LI-123141', serialExtra: '+1 More', additionalSerials: ['LI-123142'], plannedQty: 6, processedQty: 6, onHandBefore: 481, onHandAfter: 475, onHandAfterDirection: 'down', price: 22.5, valuationBefore: 10822.5, valuationAfter: 10687.5, changeInValuation: -135.0, locations: ['Dock-2A'], createdBy: 'Emily Torres' },
    { id: 'tx17', txId: 'TX-2025-4427', date: '10/21/2025', time: '3:45 PM', type: 'Shipping', sourceLink: '/shipping/3002', sourceLinkLabel: 'SHP-3002', serial: 'LI-123155', serialExtra: '+3 More', additionalSerials: ['LI-123156', 'LI-123157', 'LI-123158'], plannedQty: 12, processedQty: 12, onHandBefore: 493, onHandAfter: 481, onHandAfterDirection: 'down', price: 22.5, valuationBefore: 11092.5, valuationAfter: 10822.5, changeInValuation: -270.0, locations: ['Dock-2A'], createdBy: 'Maya Thompson' },
    { id: 'tx18', txId: 'TX-2025-4418', date: '10/21/2025', time: '10:00 AM', type: 'Shipping', sourceLink: '/shipping/3003', sourceLinkLabel: 'SHP-3003', serial: 'LI-123170', plannedQty: 8, processedQty: 8, onHandBefore: 501, onHandAfter: 493, onHandAfterDirection: 'down', price: 22.5, valuationBefore: 11272.5, valuationAfter: 11092.5, changeInValuation: -180.0, locations: ['Dock-2A', 'Zone A-01'], createdBy: 'Daniel Adams' },
    { id: 'tx19s', txId: 'TX-2025-4400', date: '10/21/2025', time: '9:15 AM', type: 'Quarantine Start', sourceLink: '', sourceLinkLabel: '-', serial: 'LI-123181', serialExtra: '+2 More', additionalSerials: ['LI-123182', 'LI-123183'], plannedQty: null, processedQty: 3, onHandBefore: 493, onHandAfter: 493, onHandAfterDirection: null, price: 22.5, valuationBefore: 11092.5, valuationAfter: 11092.5, changeInValuation: null, locations: ['Zone A-01'], createdBy: 'Emily Torres', controlScope: ['Serialized', 'Lot-Serialized'] },
    { id: 'tx19e', txId: 'TX-2025-4400', date: '10/28/2025', time: '9:15 AM', type: 'Quarantine End', sourceLink: '', sourceLinkLabel: '-', serial: 'LI-123181', serialExtra: '+2 More', additionalSerials: ['LI-123182', 'LI-123183'], plannedQty: null, processedQty: 3, onHandBefore: 493, onHandAfter: 493, onHandAfterDirection: null, price: 22.5, valuationBefore: 11092.5, valuationAfter: 11092.5, changeInValuation: null, locations: ['Zone A-01'], createdBy: 'Emily Torres', controlScope: ['Serialized', 'Lot-Serialized'] },
    { id: 'tx20s', txId: 'TX-2025-4391', date: '10/20/2025', time: '4:20 PM', type: 'Quarantine Start', sourceLink: '', sourceLinkLabel: '-', serial: 'LOT-2025-088', plannedQty: null, processedQty: 25, onHandBefore: 493, onHandAfter: 493, onHandAfterDirection: null, price: 22.5, valuationBefore: 11092.5, valuationAfter: 11092.5, changeInValuation: null, locations: ['Zone B-03'], createdBy: 'Maya Thompson', controlScope: ['Lot', 'Non-Serialized'] },
    { id: 'tx20e', txId: 'TX-2025-4391', date: '11/03/2025', time: '4:20 PM', type: 'Quarantine End', sourceLink: '', sourceLinkLabel: '-', serial: 'LOT-2025-088', plannedQty: null, processedQty: 25, onHandBefore: 493, onHandAfter: 493, onHandAfterDirection: null, price: 22.5, valuationBefore: 11092.5, valuationAfter: 11092.5, changeInValuation: null, locations: ['Zone B-03'], createdBy: 'Maya Thompson', controlScope: ['Lot', 'Non-Serialized'] },
    { id: 'tx21s', txId: 'TX-2025-4382', date: '10/20/2025', time: '11:05 AM', type: 'Quarantine Start', sourceLink: '', sourceLinkLabel: '-', serial: 'LI-123190', serialExtra: '+4 More', additionalSerials: ['LI-123191', 'LI-123192', 'LI-123193', 'LI-123194'], plannedQty: null, processedQty: 5, onHandBefore: 493, onHandAfter: 493, onHandAfterDirection: null, price: 22.5, valuationBefore: 11092.5, valuationAfter: 11092.5, changeInValuation: null, locations: ['Zone C-02'], createdBy: 'Daniel Adams', controlScope: ['Serialized', 'Lot-Serialized'] },
    { id: 'tx21e', txId: 'TX-2025-4382', date: '10/27/2025', time: '11:05 AM', type: 'Quarantine End', sourceLink: '', sourceLinkLabel: '-', serial: 'LI-123190', serialExtra: '+4 More', additionalSerials: ['LI-123191', 'LI-123192', 'LI-123193', 'LI-123194'], plannedQty: null, processedQty: 5, onHandBefore: 493, onHandAfter: 493, onHandAfterDirection: null, price: 22.5, valuationBefore: 11092.5, valuationAfter: 11092.5, changeInValuation: null, locations: ['Zone C-02'], createdBy: 'Daniel Adams', controlScope: ['Serialized', 'Lot-Serialized'] },
    { id: 'tx22o', txId: 'TX-2025-4373', date: '10/19/2025', time: '3:30 PM', type: 'Checked Out', sourceLink: '', sourceLinkLabel: '-', serial: 'LI-123200', serialExtra: '+1 More', additionalSerials: ['LI-123201'], plannedQty: null, processedQty: 2, onHandBefore: 493, onHandAfter: 493, onHandAfterDirection: null, price: 22.5, valuationBefore: 11092.5, valuationAfter: 11092.5, changeInValuation: null, locations: ['Zone A-01'], createdBy: 'Maya Thompson', controlScope: ['Serialized', 'Lot-Serialized'] },
    { id: 'tx22i', txId: 'TX-2025-4373', date: '10/22/2025', time: '3:30 PM', type: 'Checked In', sourceLink: '', sourceLinkLabel: '-', serial: 'LI-123200', serialExtra: '+1 More', additionalSerials: ['LI-123201'], plannedQty: null, processedQty: 2, onHandBefore: 493, onHandAfter: 493, onHandAfterDirection: null, price: 22.5, valuationBefore: 11092.5, valuationAfter: 11092.5, changeInValuation: null, locations: ['Zone A-01'], createdBy: 'Maya Thompson', controlScope: ['Serialized', 'Lot-Serialized'] },
    { id: 'tx23o', txId: 'TX-2025-4364', date: '10/19/2025', time: '10:45 AM', type: 'Checked Out', sourceLink: '', sourceLinkLabel: '-', serial: 'LOT-2025-077', plannedQty: null, processedQty: 12, onHandBefore: 493, onHandAfter: 493, onHandAfterDirection: null, price: 22.5, valuationBefore: 11092.5, valuationAfter: 11092.5, changeInValuation: null, locations: ['Zone B-05'], createdBy: 'Daniel Adams', controlScope: ['Lot', 'Non-Serialized'] },
    { id: 'tx23i', txId: 'TX-2025-4364', date: '10/23/2025', time: '10:45 AM', type: 'Checked In', sourceLink: '', sourceLinkLabel: '-', serial: 'LOT-2025-077', plannedQty: null, processedQty: 12, onHandBefore: 493, onHandAfter: 493, onHandAfterDirection: null, price: 22.5, valuationBefore: 11092.5, valuationAfter: 11092.5, changeInValuation: null, locations: ['Zone B-05'], createdBy: 'Daniel Adams', controlScope: ['Lot', 'Non-Serialized'] },
    { id: 'tx24o', txId: 'TX-2025-4355', date: '10/18/2025', time: '2:00 PM', type: 'Checked Out', sourceLink: '', sourceLinkLabel: '-', serial: 'LI-123210', serialExtra: '+2 More', additionalSerials: ['LI-123211', 'LI-123212'], plannedQty: null, processedQty: 3, onHandBefore: 493, onHandAfter: 493, onHandAfterDirection: null, price: 22.5, valuationBefore: 11092.5, valuationAfter: 11092.5, changeInValuation: null, locations: ['WH1-1-L2'], createdBy: 'Emily Torres', controlScope: ['Serialized', 'Lot-Serialized'] },
    { id: 'tx24i', txId: 'TX-2025-4355', date: '10/21/2025', time: '2:00 PM', type: 'Checked In', sourceLink: '', sourceLinkLabel: '-', serial: 'LI-123210', serialExtra: '+2 More', additionalSerials: ['LI-123211', 'LI-123212'], plannedQty: null, processedQty: 3, onHandBefore: 493, onHandAfter: 493, onHandAfterDirection: null, price: 22.5, valuationBefore: 11092.5, valuationAfter: 11092.5, changeInValuation: null, locations: ['WH1-1-L2'], createdBy: 'Emily Torres', controlScope: ['Serialized', 'Lot-Serialized'] },
    { id: 'tx25', txId: 'TX-2025-4346', date: '10/18/2025', time: '11:30 AM', type: 'Split LOT', sourceLink: '', sourceLinkLabel: '-', serial: 'LOT-2025-066', plannedQty: null, processedQty: 40, onHandBefore: 493, onHandAfter: 493, onHandAfterDirection: null, price: 22.5, valuationBefore: 11092.5, valuationAfter: 11092.5, changeInValuation: null, locations: ['Zone A-01'], createdBy: 'Maya Thompson', controlScope: ['Lot', 'Lot-Serialized', 'Non-Serialized'] },
    { id: 'tx26', txId: 'TX-2025-4337', date: '10/17/2025', time: '4:15 PM', type: 'Split LOT', sourceLink: '', sourceLinkLabel: '-', serial: 'LOT-2025-055', plannedQty: null, processedQty: 18, onHandBefore: 493, onHandAfter: 493, onHandAfterDirection: null, price: 22.5, valuationBefore: 11092.5, valuationAfter: 11092.5, changeInValuation: null, locations: ['Zone C-05'], createdBy: 'Daniel Adams', controlScope: ['Lot', 'Lot-Serialized', 'Non-Serialized'] },
];

const TRANSACTION_COLUMNS: ColumnConfig[] = [
    { key: 'txId',              label: 'Transaction ID' },
    { key: 'type',              label: 'Type' },
    { key: 'dateTime',          label: 'Date • Time' },
    { key: 'source',            label: 'Source Link' },
    { key: 'serial',            label: 'Serial Number' },
    { key: 'plannedQty',        label: 'Planned Qty (EA)' },
    { key: 'processedQty',      label: 'Processed Qty (EA)' },
    { key: 'onHandBefore',      label: 'On-Hand Before (EA)' },
    { key: 'onHandAfter',       label: 'On-Hand After (EA)' },
    /* Item amounts are in the base currency, labelled like the (EA) quantities. */
    { key: 'price',             label: `Price (${BASE_CURRENCY})` },
    { key: 'valuationBefore',   label: `Valuation Before (${BASE_CURRENCY})` },
    { key: 'valuationAfter',    label: `Valuation After (${BASE_CURRENCY})` },
    { key: 'changeInValuation', label: `Change in Valuation (${BASE_CURRENCY})` },
    { key: 'location',          label: 'Associated Location(s)' },
    { key: 'user',              label: 'Created By' },
];
/* Per-column widths pulled from the PI Transactions tab column defs. */
const TRANSACTION_COLUMN_WIDTHS: Record<string, number> = {
    txId:              200,
    type:              200,
    dateTime:          190,
    source:            180,
    serial:            180,
    plannedQty:        160,
    processedQty:      170,
    onHandBefore:      170,
    onHandAfter:       170,
    price:             120,
    valuationBefore:   200,
    valuationAfter:    200,
    changeInValuation: 210,
    location:          200,
    user:              180,
};
/* Numeric columns are right-aligned (our table already right-aligns Price). */
const TX_RIGHT_ALIGN = new Set(['plannedQty', 'processedQty', 'onHandBefore', 'onHandAfter', 'price', 'valuationBefore', 'valuationAfter', 'changeInValuation']);
/* Transaction ID + Type stay present (PI keeps them pinned/sticky). */
const TX_LOCKED_COLUMNS = ['txId', 'type'];
const TX_QUICK_FILTERS = ['All', 'Receiving', 'Adjustment', 'Movement', 'Cycle Count', 'Consumption', 'Manufactured', 'Shipping', 'Quarantine', 'Checked Out', 'Split LOT'] as const;
type TxQuickFilter = (typeof TX_QUICK_FILTERS)[number];

type TxDensity = 'condensed' | 'comfort';
const TX_DENSITY_CONFIG: { key: TxDensity; label: string; description: string; icon: 'align-justify' | 'list' }[] = [
    { key: 'condensed', label: 'Condensed', description: 'Compact view',  icon: 'align-justify' },
    { key: 'comfort',   label: 'Comfort',   description: 'Spacious view', icon: 'list' },
];

function txMatchesQuickFilter(row: TxRow, qf: TxQuickFilter): boolean {
    if (qf === 'All') return true;
    const t = row.type;
    switch (qf) {
        case 'Receiving':    return t === 'Receiving';
        case 'Adjustment':   return t === 'Adjustment Increase' || t === 'Adjustment Decrease';
        case 'Movement':     return t === 'Movement';
        case 'Cycle Count':  return t === 'Cycle Count';
        case 'Consumption':  return t === 'Consumption';
        case 'Manufactured': return t === 'Manufactured';
        case 'Shipping':     return t === 'Shipping';
        case 'Quarantine':   return t === 'Quarantine Start' || t === 'Quarantine End';
        case 'Checked Out':  return t === 'Checked Out' || t === 'Checked In';
        case 'Split LOT':    return t === 'Split LOT';
        default:             return true;
    }
}

function txMatchesSearch(row: TxRow, q: string): boolean {
    if (!q) return true;
    const n = q.toLowerCase();
    return (
        row.txId.toLowerCase().includes(n) ||
        row.type.toLowerCase().includes(n) ||
        (row.sourceLinkLabel || '').toLowerCase().includes(n) ||
        (row.serial || '').toLowerCase().includes(n) ||
        row.createdBy.toLowerCase().includes(n) ||
        (row.locations || []).some((l) => l.toLowerCase().includes(n))
    );
}

/* Valuations are in the base currency (₨2,867,617.50 / −₨50,157.00 / "-" for null). */
function txFmtCurrency(v: number | null | undefined): string {
    if (v === null || v === undefined) return '-';
    return baseMoney(v);
}

/* Transaction-type accent within our badge palette (subtle). */
const TX_TYPE_INCREASE = ['Receiving', 'Manufactured', 'Adjustment Increase', 'Checked In'];
const TX_TYPE_DECREASE = ['Consumption', 'Shipping', 'Adjustment Decrease', 'Checked Out'];
function txTypeBadgeClasses(type: string): string {
    if (TX_TYPE_INCREASE.includes(type)) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (TX_TYPE_DECREASE.includes(type)) return 'bg-rose-50 text-rose-700 border-rose-200';
    if (type.startsWith('Quarantine')) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-slate-50 text-slate-600 border-slate-200';
}
function txTypeDotClass(type: string): string {
    if (TX_TYPE_INCREASE.includes(type)) return 'bg-emerald-500';
    if (TX_TYPE_DECREASE.includes(type)) return 'bg-rose-500';
    if (type.startsWith('Quarantine')) return 'bg-amber-500';
    return 'bg-slate-400';
}

function TransactionsPanel({ controlType }: { controlType?: string }) {
    /* Serialized detail page shows the Serial Number column + serialized-scoped
       rows; non-serialized drops the serial column + uses non-serialized-scoped
       rows — mirrors the PI Transactions tab. */
    const isNonSerialized = (controlType || '').toLowerCase().startsWith('non');
    const scope: TxControlScope = isNonSerialized ? 'Non-Serialized' : 'Serialized';
    const effectiveColumns = useMemo(
        () => (isNonSerialized ? TRANSACTION_COLUMNS.filter((c) => c.key !== 'serial') : TRANSACTION_COLUMNS),
        [isNonSerialized]
    );
    const scopedRows = useMemo(
        () => TX_ROWS.filter((r) => !r.controlScope || r.controlScope.includes(scope)),
        [scope]
    );

    const [txSearch, setTxSearch] = useState('');
    const [txQuickFilter, setTxQuickFilter] = useState<TxQuickFilter>('All');
    const [txColumnOrder, setTxColumnOrder] = useState<string[]>(effectiveColumns.map((c) => c.key));
    const [txColumnVisibility, setTxColumnVisibility] = useState<Record<string, boolean>>(
        Object.fromEntries(effectiveColumns.map((c) => [c.key, true]))
    );
    const [txColumnsOpen, setTxColumnsOpen] = useState(false);
    const [txDensity, setTxDensity] = useState<TxDensity>('condensed');
    const [txPage, setTxPage] = useState(1);
    const [txPageSize, setTxPageSize] = useState(20);

    const txFilteredRows = useMemo(() => {
        return scopedRows.filter((r) => txMatchesQuickFilter(r, txQuickFilter) && txMatchesSearch(r, txSearch));
    }, [scopedRows, txSearch, txQuickFilter]);

    const totalRows = scopedRows.length;
    const filteredCount = txFilteredRows.length;
    const totalPages = Math.max(1, Math.ceil(filteredCount / txPageSize));
    const currentPage = Math.min(txPage, totalPages);
    const startIdx = (currentPage - 1) * txPageSize;
    const pagedRows = txFilteredRows.slice(startIdx, startIdx + txPageSize);

    const visibleColumns = txColumnOrder
        .map((k) => effectiveColumns.find((c) => c.key === k))
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
            case 'txId':
                return (
                    <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${txTypeDotClass(row.type)}`} />
                        <span className="text-xs text-foreground font-medium truncate">{row.txId}</span>
                    </div>
                );
            case 'type':
                return (
                    <span
                        className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-[11px] border', txTypeBadgeClasses(row.type))}
                        style={{ fontWeight: 500 }}
                    >
                        {row.type}
                    </span>
                );
            case 'dateTime':
                return (
                    <span className={`${cellTextSize} text-foreground font-medium inline-flex items-center gap-1.5 whitespace-nowrap`}>
                        {row.date}
                        <span className="inline-block w-1 h-1 rounded-full bg-muted-foreground/50 shrink-0" />
                        {row.time}
                    </span>
                );
            case 'source':
                if (!row.sourceLink) return <span className={`${cellTextSize} text-muted-foreground`}>{row.sourceLinkLabel || '-'}</span>;
                return (
                    <a href={row.sourceLink} onClick={(e) => e.preventDefault()} className={`${cellTextSize} inline-flex items-center gap-1 text-foreground hover:text-primary hover:underline underline-offset-2`}>
                        {row.sourceLinkLabel}
                        <ArrowUpRight size={10} />
                    </a>
                );
            case 'serial': {
                if (!row.serial) return <span className={`${cellTextSize} text-muted-foreground`}>-</span>;
                return (
                    <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono text-xs text-foreground font-medium truncate">{row.serial}</span>
                        {row.serialExtra && (
                            <span
                                title={(row.additionalSerials || []).join(', ')}
                                className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] border bg-muted text-muted-foreground border-border cursor-default"
                                style={{ fontWeight: 500 }}
                            >
                                {row.serialExtra}
                            </span>
                        )}
                    </div>
                );
            }
            case 'plannedQty':
                return <span className={`${cellTextSize} text-foreground tabular-nums`}>{row.plannedQty !== null ? row.plannedQty : '-'}</span>;
            case 'processedQty':
                return <span className={`${cellTextSize} text-foreground tabular-nums`}>{row.processedQty !== null ? row.processedQty : '-'}</span>;
            case 'onHandBefore':
                return <span className={`${cellTextSize} text-foreground tabular-nums`}>{row.onHandBefore !== null ? row.onHandBefore : '-'}</span>;
            case 'onHandAfter': {
                if (row.onHandAfter === null) return <span className={`${cellTextSize} text-muted-foreground`}>-</span>;
                const dir = row.onHandAfterDirection;
                const cls = dir === 'up' ? 'text-emerald-600' : dir === 'down' ? 'text-rose-600' : 'text-foreground';
                return (
                    <span className={`${cellTextSize} ${cls} font-medium tabular-nums inline-flex items-center justify-end gap-1`}>
                        {row.onHandAfter}
                        {dir === 'up' && <ArrowUp size={12} className="shrink-0" />}
                        {dir === 'down' && <ArrowDown size={12} className="shrink-0" />}
                    </span>
                );
            }
            case 'price':
                return <span className={`${cellTextSize} font-medium text-foreground tabular-nums`}>{row.price ? baseMoney(row.price) : '-'}</span>;
            case 'valuationBefore':
                return <span className={`${cellTextSize} text-muted-foreground tabular-nums`}>{txFmtCurrency(row.valuationBefore)}</span>;
            case 'valuationAfter':
                return <span className={`${cellTextSize} text-muted-foreground tabular-nums`}>{txFmtCurrency(row.valuationAfter)}</span>;
            case 'changeInValuation': {
                if (row.changeInValuation === null) return <span className={`${cellTextSize} text-muted-foreground`}>-</span>;
                const cv = row.changeInValuation;
                const cls = cv > 0 ? 'text-emerald-600' : cv < 0 ? 'text-rose-600' : 'text-muted-foreground';
                return <span className={`${cellTextSize} ${cls} font-medium tabular-nums`}>{txFmtCurrency(cv)}</span>;
            }
            case 'location': {
                const locs = row.locations || [];
                if (!locs.length) return <span className={`${cellTextSize} text-muted-foreground`}>-</span>;
                return (
                    <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`${cellTextSize} text-foreground truncate`}>{locs[0]}</span>
                        {locs.length > 1 && (
                            <span
                                title={locs.slice(1).join(', ')}
                                className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] border bg-muted text-muted-foreground border-border cursor-default"
                                style={{ fontWeight: 500 }}
                            >
                                +{locs.length - 1}
                            </span>
                        )}
                    </div>
                );
            }
            case 'user':
                return (
                    <div className="flex items-center gap-2.5 group/u cursor-pointer">
                        <InitialAvatar name={row.createdBy} size={isRelaxed ? "md" : "sm"} />
                        <span className="text-sm truncate text-foreground group-hover/u:text-primary group-hover/u:underline transition-colors" style={{ fontWeight: 500 }}>{row.createdBy}</span>
                    </div>
                );
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
                            placeholder={isNonSerialized ? 'Search Transaction ID, Location, User' : 'Search Transaction ID, Serial no., Location, User'}
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
                                <span className="text-muted-foreground/70"> transactions</span>
                            </>
                        ) : (
                            <>
                                <span className="text-foreground">{totalRows}</span>
                                <span className="text-muted-foreground/70"> transactions</span>
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
                            {visibleColumns.map((col) => {
                                const isNum = TX_RIGHT_ALIGN.has(col.key);
                                const width = TRANSACTION_COLUMN_WIDTHS[col.key] ?? 160;
                                return (
                                    <TableHead
                                        key={col.key}
                                        className={cn(
                                            'whitespace-nowrap',
                                            isNum && 'text-right'
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
                                {visibleColumns.map((col) => {
                                    const isNum = TX_RIGHT_ALIGN.has(col.key);
                                    const width = TRANSACTION_COLUMN_WIDTHS[col.key] ?? 160;
                                    return (
                                        <TableCell
                                            key={col.key}
                                            className={cn(
                                                cellPadY,
                                                isNum && 'text-right'
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
                                <TableCell colSpan={visibleColumns.length} className="text-center py-12 text-sm text-muted-foreground">
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
                columns={effectiveColumns}
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
  const [pendingLifecycle, setPendingLifecycle] = useState<ItemLifecycleAction>(null);
  const { updateItem } = useItems() as any;
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
                    <p className="text-xs text-[var(--muted-foreground)] mt-2">Value: {baseCompact(12500)}</p>
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
                        <span className="text-3xl font-semibold text-[var(--foreground)] tracking-tight">{baseMoney(24.5)}</span>
                        <span className="text-xs font-medium text-[var(--destructive)] flex items-center gap-1 bg-[var(--destructive)]/10 px-2 py-1 rounded-md">
                            <ArrowUpRight size={12} /> +2%
                        </span>
                    </div>
                    <p className="text-xs text-[var(--muted-foreground)] mt-2">vs Avg {baseMoney(24)}</p>
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
        onLifecycleAction={(a) => setPendingLifecycle(a)}
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

                           {/* RIGHT — 3 action buttons */}
                           <div className="flex items-center gap-2 shrink-0">
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
                           <TransactionsPanel controlType={item?.inventoryControlType} />
                       </TabsContent>
                   </div>
               </Tabs>
          </TabsContent>

          <TabsContent value="configurations" className="focus-visible:outline-none animate-in fade-in slide-in-from-bottom-2 duration-300 h-[calc(100dvh-250px)] min-h-[800px] max-h-[1100px] border border-border rounded-xl bg-background overflow-hidden shadow-sm">
               <ItemConfigurationMaster
                   config={config}
                   onConfigChange={(updates) => setConfig({ ...config, ...updates })}
                   item={item}
                   partners={MOCK_PARTNERS}
                   users={MOCK_USERS}
                   locations={LOCATIONS}
                   uoms={UOMS}
                   variant="detail"
                   readOnly
               />
          </TabsContent>

          <TabsContent value="purchasing" className="space-y-6 focus-visible:outline-none animate-in fade-in slide-in-from-bottom-2 duration-300">
               <ItemPurchasingTab itemId={item.id} />
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

          <TabsContent value="attachments" className="focus-visible:outline-none animate-in fade-in slide-in-from-bottom-2 duration-300 h-[calc(100dvh-250px)] min-h-[800px] max-h-[1100px] border border-border rounded-xl bg-card overflow-hidden shadow-sm">
            <AttachmentsTab
              itemImages={item?.images}
              itemPartNumber={item?.partNumber}
              currentThumbnailUrl={item?.images?.[0]}
              onSetThumbnail={(url) => {
                if (!item) return;
                const rest = (item.images ?? []).filter((u) => u !== url);
                const nextImages = [url, ...rest];
                setItem((prev) => (prev ? { ...prev, images: nextImages } : prev));
                if (updateItem) updateItem(item.id, { images: nextImages });
              }}
            />
          </TabsContent>
      </Tabs>
        </div>
      </div>
      <ItemLifecycleModal
        open={!!pendingLifecycle}
        action={pendingLifecycle}
        itemName={item?.partNumber ?? 'item'}
        itemId={item?.id ?? ''}
        onHandQty={item?.onHandQty ?? 0}
        onCancel={() => setPendingLifecycle(null)}
        onConfirm={(next) => {
          const nextLabel = next === 'active' ? 'Active' : next === 'inactive' ? 'Inactive' : 'Archived';
          if (item && updateItem) updateItem(item.id, { status: nextLabel });
          setItem((prev) => (prev ? { ...prev, status: nextLabel } : prev));
          const verb = next === 'active' ? 'marked as Active' : next === 'inactive' ? 'marked as Inactive' : 'archived';
          toast.success(`${item?.partNumber ?? 'Item'} ${verb}.`);
          setPendingLifecycle(null);
        }}
      />
    </motion.div>
  );
}
