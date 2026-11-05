import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Upload, 
  X, 
  Plus, 
  Image as ImageIcon, 
  Paperclip,
  Trash2,
  Box,
  Layers,
  FileText,
  Tag as TagIcon,
  Settings,
  AlertTriangle,
  ScanBarcode,
  Users,
  DollarSign,
  BarChart,
  Truck,
  Archive,
  ShoppingCart,
  RefreshCw,
  SlidersHorizontal,
  CheckCircle2,
  ArrowRight,
  Factory,
  Package,
  Hash,
  Calendar,
  Flame,
  Skull,
  Droplets,
  Info,
  Check,
  ChevronRight,
  MapPin,
  Search,
  Filter,
  MoreHorizontal
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Textarea } from '../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Switch } from "../ui/switch";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../ui/tabs";
import { cn } from '../../../lib/utils';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator
} from "../ui/dropdown-menu";
import { Separator } from "../ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from "../ui/dialog";
import { Checkbox } from "../ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

// Types
interface Category {
  id: string;
  code: string;
  name: string;
  description: string;
  type: 'Inventory' | 'Service' | 'Non-Inventory';
  itemCount: number;
  owner: string;
  createdOn: string;
  status: 'Active' | 'Inactive';
  color: string;
}

const CATEGORIES: Category[] = [
  { 
      id: 'cat-1', 
      code: 'CAT-FUR',
      name: 'Furniture',
      description: 'Office and home furniture items including chairs, desks, and tables.',
      type: 'Inventory',
      itemCount: 145,
      owner: 'Sarah Chen',
      createdOn: '2023-01-15',
      status: 'Active',
      color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  },
  { 
      id: 'cat-2', 
      code: 'CAT-ELE',
      name: 'Electronics',
      description: 'Computers, peripherals, and electronic components.',
      type: 'Inventory',
      itemCount: 892,
      owner: 'Mike Johnson',
      createdOn: '2023-02-20',
      status: 'Active',
      color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  },
  { 
      id: 'cat-3', 
      code: 'CAT-OFF',
      name: 'Office Supplies',
      description: 'Consumable office materials such as paper, pens, and toner.',
      type: 'Inventory',
      itemCount: 350,
      owner: 'Emily Davis',
      createdOn: '2023-03-10',
      status: 'Active',
      color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
  { 
      id: 'cat-4', 
      code: 'CAT-SER',
      name: 'Services',
      description: 'Labor and service charges.',
      type: 'Service',
      itemCount: 12,
      owner: 'Alex Thompson',
      createdOn: '2023-05-12',
      status: 'Active',
      color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  },
   { 
      id: 'cat-5', 
      code: 'CAT-RAW',
      name: 'Raw Materials',
      description: 'Unprocessed materials used in production.',
      type: 'Inventory',
      itemCount: 204,
      owner: 'Sarah Chen',
      createdOn: '2023-06-01',
      status: 'Inactive',
      color: 'bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300',
  }
];

const MOCK_USERS = [
    { id: 'u1', name: 'Alex Thompson' },
    { id: 'u2', name: 'Sarah Chen' },
    { id: 'u3', name: 'Mike Johnson' },
    { id: 'u4', name: 'Emily Davis' },
    { id: 'u5', name: 'David Wilson' },
];

interface ItemCreationProps {
  onCancel: () => void;
  onSave: () => void;
}

export function ItemCreation({ onCancel, onSave }: ItemCreationProps) {
  const navigate = useNavigate();
  const onBackToOverview = () => navigate('/dashboard');

  // State
  const [viewMode, setViewMode] = useState<'basic' | 'advanced'>('basic');
  
  // Category Selection State
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(['cat-1']);
  const [primaryCategoryId, setPrimaryCategoryId] = useState<string>('cat-1');
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [viewingCategory, setViewingCategory] = useState<Category | null>(null);
  
  const [basicInfo, setBasicInfo] = useState({
    partNumber: '',
    name: '',
    description: '',
    status: 'Draft',
    tags: [] as string[]
  });
  
  const [tagInput, setTagInput] = useState('');
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<{name: string, size: string, type: string}[]>([
      { name: 'safety_cert.pdf', size: '1.2 MB', type: 'PDF' }
  ]);

  const [activeTab, setActiveTab] = useState("basic");

  // Filtered categories for browsing (simple search if needed, currently just all)
  const [categorySearch, setCategorySearch] = useState('');
  const filteredCategories = useMemo(() => {
      return CATEGORIES.filter(c => 
          c.name.toLowerCase().includes(categorySearch.toLowerCase()) || 
          c.code.toLowerCase().includes(categorySearch.toLowerCase())
      );
  }, [categorySearch]);

  const handleToggleCategory = (id: string) => {
      setSelectedCategoryIds(prev => {
          if (prev.includes(id)) {
              const next = prev.filter(c => c !== id);
              // If we removed the primary, reset primary to the first one available or empty
              if (id === primaryCategoryId) {
                   setPrimaryCategoryId(next.length > 0 ? next[0] : '');
              }
              return next;
          } else {
              const next = [...prev, id];
              // If this is the first one, make it primary
              if (next.length === 1) {
                  setPrimaryCategoryId(id);
              }
              return next;
          }
      });
  };

  const handleSetPrimary = (id: string) => {
      if (!selectedCategoryIds.includes(id)) {
          setSelectedCategoryIds(prev => [...prev, id]);
      }
      setPrimaryCategoryId(id);
  };

  // Advanced Configuration State
  const [advancedConfig, setAdvancedConfig] = useState({
      // 1. Basic Configs
      inventoryType: 'Stock',
      uom: 'Each',
      acquisitionMethod: 'Purchased',
      controlType: 'Non-serialized',
      
      // 2. Inventory Management
      minStock: '',
      maxStock: '',
      stockUom: 'Each',
      inboundLoc: '',
      outboundLoc: '',
      
      // 3. Purchasing
      minPurchase: '',
      maxPurchase: '',
      purchaseUom: 'Each',
      purchaseMultiples: '1',
      
      // 4. Cycle Counting
      cycleTolerance: '0',
      cycleRecurrence: 'Monthly',
      cycleApproval: false,
      
      // 5. Owners
      ownerEng: '',
      ownerPurch: '',
      ownerSched: '',
      ownerSales: '',
      ownerAR: '',
      
      // 6. Selling
      sellingScope: 'all',
      customPrice: '',
      priceUom: 'Each',
      
      // 7. Valuation
      valuationMethod: 'FIFO',
      
      // 8. Handling
      handlingInstructions: '',
      hazardClass: 'None',
      msdsFile: null as string | null,
      
      // 9. General
      requireScan: true
  });

  // Handlers
  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      if (!basicInfo.tags.includes(tagInput.trim())) {
        setBasicInfo({ ...basicInfo, tags: [...basicInfo.tags, tagInput.trim()] });
      }
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setBasicInfo({ ...basicInfo, tags: basicInfo.tags.filter(t => t !== tag) });
  };

  const updateConfig = (key: string, value: any) => {
      setAdvancedConfig(prev => ({ ...prev, [key]: value }));
  };

  if (viewMode === 'advanced') {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col h-full bg-background"
        >
            {/* Advanced Header */}
            <div className="flex items-center justify-between py-4 px-6 md:px-8 border-b border-border/50 bg-background z-20 shadow-sm shrink-0">
                 <div className="flex items-center gap-4">
                     <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => setViewMode('basic')}
                        className="h-10 w-10 -ml-2 text-base-second hover:text-foreground rounded-full"
                     >
                        <ArrowLeft size={22} />
                     </Button>
                     <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span className="cursor-pointer hover:text-foreground transition-colors" onClick={onBackToOverview}>Items & Inventory</span>
                            <span className="text-border">/</span>
                            <span className="cursor-pointer hover:text-foreground transition-colors" onClick={onCancel}>Items</span>
                            <span className="text-border">/</span>
                            <span className="cursor-pointer hover:text-foreground transition-colors" onClick={() => setViewMode('basic')}>New Item</span>
                            <span className="text-border">/</span>
                            <span className="font-medium text-foreground">Configuration</span>
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">Advanced Settings</h1>
                     </div>
                 </div>
                 <div className="flex items-center gap-3">
                    <Badge variant="outline" className="px-3 py-1 border-primary/20 bg-primary/5 text-primary hidden sm:flex">
                        {basicInfo.name || "New Item"}
                    </Badge>
                    <Button onClick={() => setViewMode('basic')} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm px-6">
                        Done
                    </Button>
                 </div>
            </div>

            {/* Advanced Content */}
            <div className="flex flex-1 overflow-hidden bg-secondary/5 relative">
                 <Tabs value={activeTab} onValueChange={setActiveTab} orientation="vertical" className="flex flex-col md:flex-row w-full h-full">
                     {/* Sidebar Navigation */}
                     <TabsList className="w-full md:w-[280px] lg:w-[320px] flex-row md:flex-col justify-start items-stretch h-auto md:h-full rounded-none border-b md:border-b-0 md:border-r border-border/50 bg-background/95 backdrop-blur-sm p-0 overflow-x-auto md:overflow-y-auto shrink-0 z-10">
                         <div className="hidden md:flex items-center px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-widest bg-background/50 sticky top-0 z-10 backdrop-blur-sm border-b border-border/20">
                             Settings Groups
                         </div>
                         <div className="flex flex-row md:flex-col p-2 md:p-3 gap-1">
                             {[
                                 { id: 'basic', label: 'Basic Config', icon: Settings, desc: 'Core inventory properties' },
                                 { id: 'inventory', label: 'Inventory Management', icon: Archive, desc: 'Stock levels & locations' },
                                 { id: 'purchasing', label: 'Purchasing', icon: ShoppingCart, desc: 'Reorder rules & suppliers' },
                                 { id: 'cycle', label: 'Cycle Counting', icon: RefreshCw, desc: 'Audits & tolerances' },
                                 { id: 'owners', label: 'Ownership', icon: Users, desc: 'Stakeholder assignment' },
                                 { id: 'selling', label: 'Selling', icon: DollarSign, desc: 'Pricing & sales scope' },
                                 { id: 'valuation', label: 'Valuation', icon: BarChart, desc: 'Costing methods' },
                                 { id: 'handling', label: 'Handling', icon: Truck, desc: 'Safety & compliance' },
                                 { id: 'general', label: 'General', icon: AlertTriangle, desc: 'System behavior' },
                             ].map(tab => (
                                 <TabsTrigger 
                                    key={tab.id} 
                                    value={tab.id}
                                    className="group relative flex flex-col md:flex-row items-center md:items-start justify-center md:justify-start px-3 md:px-4 py-3 gap-3 text-sm font-medium border border-transparent data-[state=active]:bg-primary/5 data-[state=active]:border-primary/10 data-[state=active]:text-primary rounded-lg transition-all outline-none min-w-[100px] md:min-w-0 md:w-full"
                                 >
                                     <div className={`p-2 rounded-md bg-secondary transition-colors group-data-[state=active]:bg-primary group-data-[state=active]:text-primary-foreground`}>
                                        <tab.icon size={18} />
                                     </div>
                                     <div className="flex flex-col items-center md:items-start text-center md:text-left">
                                         <span className="font-semibold leading-tight">{tab.label}</span>
                                         <span className="text-[11px] text-muted-foreground font-normal hidden md:block mt-0.5 line-clamp-1">{tab.desc}</span>
                                     </div>
                                 </TabsTrigger>
                             ))}
                         </div>
                     </TabsList>

                     {/* Content Area */}
                     <div className="flex-1 h-full overflow-y-auto scroll-smooth bg-background md:bg-secondary/5">
                        <div className="max-w-6xl mx-auto w-full p-4 md:p-10 lg:p-12 pb-32">
                         
                         {/* 1. Basic Config */}
                         <TabsContent value="basic" className="space-y-8 mt-0 focus-visible:outline-none animate-in fade-in-30 slide-in-from-bottom-2 duration-500">
                             <div className="flex flex-col gap-2">
                                 <h3 className="text-2xl font-bold tracking-tight">Basic Configuration</h3>
                                 <p className="text-muted-foreground text-base max-w-3xl">Define the fundamental characteristics of the item, including how it is tracked, acquired, and measured.</p>
                             </div>
                             <Separator />
                             
                             <div className="grid grid-cols-1 gap-10">
                                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                     <div className="space-y-4">
                                         <Label className="text-base font-semibold">Inventory Type</Label>
                                         <RadioGroup value={advancedConfig.inventoryType} onValueChange={(v) => updateConfig('inventoryType', v)} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                             {[
                                                 { id: 'Stock', icon: Package, label: 'Stock Item', desc: 'Quantity is tracked' },
                                                 { id: 'Non-stock', icon: FileText, label: 'Non-stock', desc: 'Expensed immediately' }
                                             ].map(type => (
                                                 <div key={type.id} className="h-full">
                                                     <RadioGroupItem value={type.id} id={`t-${type.id}`} className="peer sr-only" />
                                                     <Label
                                                         htmlFor={`t-${type.id}`}
                                                         className="flex flex-col h-full p-5 rounded-xl border-2 border-border bg-card hover:border-primary/50 hover:bg-accent/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 peer-data-[state=checked]:shadow-sm transition-all cursor-pointer"
                                                     >
                                                         <div className="flex items-start justify-between w-full mb-3">
                                                             <div className="p-2.5 rounded-lg bg-secondary text-foreground">
                                                                <type.icon size={20} />
                                                             </div>
                                                             {advancedConfig.inventoryType === type.id && (
                                                                 <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center animate-in zoom-in-50">
                                                                     <Check size={14} strokeWidth={3} />
                                                                 </div>
                                                             )}
                                                         </div>
                                                         <span className="text-base font-bold text-foreground mb-1">{type.label}</span>
                                                         <span className="text-sm text-muted-foreground leading-snug">{type.desc}</span>
                                                     </Label>
                                                 </div>
                                             ))}
                                         </RadioGroup>
                                     </div>

                                     <div className="space-y-4">
                                         <Label className="text-base font-semibold">Control Type</Label>
                                          <RadioGroup value={advancedConfig.controlType} onValueChange={(v) => updateConfig('controlType', v)} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                             {[
                                                 { id: 'Serialized', icon: ScanBarcode, label: 'Serialized', desc: 'Unique ID per unit' },
                                                 { id: 'Non-serialized', icon: Hash, label: 'Standard', desc: 'Quantity only' }
                                             ].map(type => (
                                                 <div key={type.id} className="h-full">
                                                     <RadioGroupItem value={type.id} id={`c-${type.id}`} className="peer sr-only" />
                                                     <Label
                                                         htmlFor={`c-${type.id}`}
                                                         className="flex flex-col h-full p-5 rounded-xl border-2 border-border bg-card hover:border-primary/50 hover:bg-accent/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 peer-data-[state=checked]:shadow-sm transition-all cursor-pointer"
                                                     >
                                                         <div className="flex items-start justify-between w-full mb-3">
                                                             <div className="p-2.5 rounded-lg bg-secondary text-foreground">
                                                                <type.icon size={20} />
                                                             </div>
                                                             {advancedConfig.controlType === type.id && (
                                                                 <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center animate-in zoom-in-50">
                                                                     <Check size={14} strokeWidth={3} />
                                                                 </div>
                                                             )}
                                                         </div>
                                                         <span className="text-base font-bold text-foreground mb-1">{type.label}</span>
                                                         <span className="text-sm text-muted-foreground leading-snug">{type.desc}</span>
                                                     </Label>
                                                 </div>
                                             ))}
                                         </RadioGroup>
                                     </div>
                                 </div>

                                 <Separator className="bg-border/60" />

                                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                     <div className="space-y-4">
                                         <Label className="text-base font-semibold">Acquisition Method</Label>
                                          <RadioGroup value={advancedConfig.acquisitionMethod} onValueChange={(v) => updateConfig('acquisitionMethod', v)} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                             {[
                                                 { id: 'Purchased', icon: Truck, label: 'Purchased', desc: 'Sourced from vendors' },
                                                 { id: 'Manufactured', icon: Factory, label: 'Manufactured', desc: 'Produced internally' }
                                             ].map(type => (
                                                 <div key={type.id} className="h-full">
                                                     <RadioGroupItem value={type.id} id={`a-${type.id}`} className="peer sr-only" />
                                                     <Label
                                                         htmlFor={`a-${type.id}`}
                                                         className="flex flex-col h-full p-5 rounded-xl border-2 border-border bg-card hover:border-primary/50 hover:bg-accent/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 peer-data-[state=checked]:shadow-sm transition-all cursor-pointer"
                                                     >
                                                         <div className="flex items-start justify-between w-full mb-3">
                                                             <div className="p-2.5 rounded-lg bg-secondary text-foreground">
                                                                <type.icon size={20} />
                                                             </div>
                                                             {advancedConfig.acquisitionMethod === type.id && (
                                                                 <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center animate-in zoom-in-50">
                                                                     <Check size={14} strokeWidth={3} />
                                                                 </div>
                                                             )}
                                                         </div>
                                                         <span className="text-base font-bold text-foreground mb-1">{type.label}</span>
                                                         <span className="text-sm text-muted-foreground leading-snug">{type.desc}</span>
                                                     </Label>
                                                 </div>
                                             ))}
                                         </RadioGroup>
                                     </div>

                                     <div className="space-y-4">
                                         <Label className="text-base font-semibold">Unit of Measure</Label>
                                         <div className="p-6 bg-card rounded-xl border border-border shadow-sm h-full flex flex-col justify-center gap-6">
                                             <div className="space-y-2">
                                                <Label className="text-xs uppercase text-muted-foreground font-bold tracking-wider">Base UOM</Label>
                                                <Select value={advancedConfig.uom} onValueChange={(v) => updateConfig('uom', v)}>
                                                    <SelectTrigger className="h-12 bg-background border-border text-base shadow-sm"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Each">Each (EA)</SelectItem>
                                                        <SelectItem value="Box">Box (BX)</SelectItem>
                                                        <SelectItem value="Pallet">Pallet (PLT)</SelectItem>
                                                        <SelectItem value="Kg">Kilogram (KG)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                             </div>
                                             <div className="flex items-start gap-3 p-4 rounded-lg bg-primary/5 text-primary-foreground/90 text-sm leading-relaxed border border-primary/10">
                                                 <Info size={18} className="shrink-0 mt-0.5 text-primary" /> 
                                                 <span className="text-foreground/80">The <strong>Base Unit</strong> is used for all inventory valuation and stock reports. It cannot be changed once transactions exist.</span>
                                             </div>
                                         </div>
                                     </div>
                                 </div>
                             </div>
                         </TabsContent>

                         {/* 2. Inventory Mgmt */}
                         <TabsContent value="inventory" className="space-y-8 mt-0 focus-visible:outline-none animate-in fade-in-30 slide-in-from-bottom-2 duration-500">
                              <div className="flex flex-col gap-2">
                                 <h3 className="text-2xl font-bold tracking-tight">Inventory Management</h3>
                                 <p className="text-muted-foreground text-base max-w-3xl">Set up stocking levels, warehouse locations, and replenishment thresholds.</p>
                                 <Separator />
                             </div>
                             
                             <div className="space-y-8">
                                 <div className="p-8 bg-card rounded-xl border border-border shadow-sm">
                                     <h4 className="text-lg font-semibold text-foreground mb-6 flex items-center gap-2">
                                         <Archive size={20} className="text-primary" /> 
                                         Stock Thresholds
                                     </h4>
                                     <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                          <div className="space-y-3">
                                              <Label className="text-sm font-medium">Minimum Stock</Label>
                                              <Input type="number" value={advancedConfig.minStock} onChange={(e) => updateConfig('minStock', e.target.value)} className="h-12 bg-background shadow-sm" placeholder="0" />
                                              <p className="text-xs text-muted-foreground">Alert when below</p>
                                          </div>
                                          <div className="space-y-3">
                                              <Label className="text-sm font-medium">Maximum Stock</Label>
                                              <Input type="number" value={advancedConfig.maxStock} onChange={(e) => updateConfig('maxStock', e.target.value)} className="h-12 bg-background shadow-sm" placeholder="∞" />
                                              <p className="text-xs text-muted-foreground">Prevent overstock</p>
                                          </div>
                                          <div className="space-y-3">
                                              <Label className="text-sm font-medium">Stocking UOM</Label>
                                              <Select value={advancedConfig.stockUom} onValueChange={(v) => updateConfig('stockUom', v)}>
                                                 <SelectTrigger className="h-12 bg-background shadow-sm"><SelectValue /></SelectTrigger>
                                                 <SelectContent>
                                                     <SelectItem value="Each">EA</SelectItem>
                                                     <SelectItem value="Box">BX</SelectItem>
                                                 </SelectContent>
                                             </Select>
                                          </div>
                                     </div>
                                 </div>
                                 
                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                     <div className="space-y-3">
                                         <Label className="text-base font-semibold">Default Inbound Location</Label>
                                         <div className="relative">
                                             <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                                <MapPin size={18} />
                                             </div>
                                             <Input value={advancedConfig.inboundLoc} onChange={(e) => updateConfig('inboundLoc', e.target.value)} className="h-12 pl-10 shadow-sm" placeholder="e.g. WH-IN-01" />
                                         </div>
                                         <p className="text-xs text-muted-foreground">Receiving zone for new stock.</p>
                                     </div>
                                     <div className="space-y-3">
                                         <Label className="text-base font-semibold">Default Outbound Location</Label>
                                         <div className="relative">
                                             <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                                <MapPin size={18} />
                                             </div>
                                             <Input value={advancedConfig.outboundLoc} onChange={(e) => updateConfig('outboundLoc', e.target.value)} className="h-12 pl-10 shadow-sm" placeholder="e.g. WH-OUT-01" />
                                         </div>
                                         <p className="text-xs text-muted-foreground">Staging zone for shipments.</p>
                                     </div>
                                 </div>
                             </div>
                         </TabsContent>

                         {/* 3. Purchasing */}
                         <TabsContent value="purchasing" className="space-y-8 mt-0 focus-visible:outline-none animate-in fade-in-30 slide-in-from-bottom-2 duration-500">
                              <div className="flex flex-col gap-2">
                                 <h3 className="text-2xl font-bold tracking-tight">Purchasing</h3>
                                 <p className="text-muted-foreground text-base max-w-3xl">Configure automated reordering rules, order multiples, and supplier constraints.</p>
                                 <Separator />
                             </div>
                             
                             <div className="space-y-8">
                                  <div className="p-8 bg-card rounded-xl border border-border shadow-sm">
                                     <h4 className="text-lg font-semibold text-foreground mb-6 flex items-center gap-2">
                                         <ShoppingCart size={20} className="text-primary" /> 
                                         Reorder Rules
                                     </h4>
                                     <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                          <div className="space-y-3">
                                              <Label className="text-sm font-medium">Min Purchase Qty</Label>
                                              <Input type="number" value={advancedConfig.minPurchase} onChange={(e) => updateConfig('minPurchase', e.target.value)} className="h-12 bg-background shadow-sm" placeholder="0" />
                                          </div>
                                          <div className="space-y-3">
                                              <Label className="text-sm font-medium">Max Purchase Qty</Label>
                                              <Input type="number" value={advancedConfig.maxPurchase} onChange={(e) => updateConfig('maxPurchase', e.target.value)} className="h-12 bg-background shadow-sm" placeholder="∞" />
                                          </div>
                                          <div className="space-y-3">
                                              <Label className="text-sm font-medium">Purchase UOM</Label>
                                              <Select value={advancedConfig.purchaseUom} onValueChange={(v) => updateConfig('purchaseUom', v)}>
                                                 <SelectTrigger className="h-12 bg-background shadow-sm"><SelectValue /></SelectTrigger>
                                                 <SelectContent>
                                                     <SelectItem value="Each">EA</SelectItem>
                                                     <SelectItem value="Box">BX</SelectItem>
                                                 </SelectContent>
                                             </Select>
                                          </div>
                                     </div>
                                 </div>
                                 
                                 <div className="max-w-xl space-y-4">
                                     <Label className="text-base font-semibold">Order Multiples</Label>
                                     <div className="flex items-center gap-4">
                                         <Input type="number" value={advancedConfig.purchaseMultiples} onChange={(e) => updateConfig('purchaseMultiples', e.target.value)} className="h-12 text-lg font-medium shadow-sm w-40" />
                                         <span className="text-sm text-muted-foreground">Units per order</span>
                                     </div>
                                     <p className="text-xs text-muted-foreground">Purchase orders must be a multiple of this quantity to align with vendor packaging.</p>
                                 </div>
                             </div>
                         </TabsContent>

                         {/* 4. Cycle Counting */}
                         <TabsContent value="cycle" className="space-y-8 mt-0 focus-visible:outline-none animate-in fade-in-30 slide-in-from-bottom-2 duration-500">
                              <div className="flex flex-col gap-2">
                                 <h3 className="text-2xl font-bold tracking-tight">Cycle Counting</h3>
                                 <p className="text-muted-foreground text-base max-w-3xl">Establish the schedule and rules for periodic inventory audits.</p>
                                 <Separator />
                             </div>
                             
                             <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                                 <div className="space-y-8">
                                     <div className="space-y-4">
                                         <Label className="text-base font-semibold">Deviation Tolerance</Label>
                                         <div className="relative">
                                             <Input className="h-16 pl-6 pr-16 text-3xl font-bold tracking-tight shadow-sm" value={advancedConfig.cycleTolerance} onChange={(e) => updateConfig('cycleTolerance', e.target.value)} />
                                             <span className="absolute right-6 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-xl">%</span>
                                         </div>
                                         <p className="text-sm text-muted-foreground">Acceptable variance before a recount is automatically triggered.</p>
                                     </div>
                                     
                                      <div className="flex items-center justify-between p-6 border border-border rounded-xl bg-card hover:border-primary/30 transition-colors shadow-sm">
                                         <div className="space-y-1">
                                             <Label className="text-base font-semibold cursor-pointer" htmlFor="cycle-approve-switch">Require Approval</Label>
                                             <p className="text-sm text-muted-foreground">Manager approval needed for count adjustments.</p>
                                         </div>
                                         <Switch 
                                             id="cycle-approve-switch"
                                             checked={advancedConfig.cycleApproval}
                                             onCheckedChange={(c) => updateConfig('cycleApproval', c)}
                                             className="scale-110"
                                         />
                                     </div>
                                 </div>

                                 <div className="space-y-4">
                                     <Label className="text-base font-semibold">Recurrence Schedule</Label>
                                     <RadioGroup value={advancedConfig.cycleRecurrence} onValueChange={(v) => updateConfig('cycleRecurrence', v)} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                         {['Weekly', 'Monthly', 'Quarterly', 'Annually'].map(time => (
                                              <div key={time} className="h-full">
                                                  <RadioGroupItem value={time} id={`cycle-${time}`} className="peer sr-only" />
                                                  <Label
                                                      htmlFor={`cycle-${time}`}
                                                      className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-border bg-card hover:bg-accent/50 hover:border-primary/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 peer-data-[state=checked]:shadow-md transition-all cursor-pointer shadow-sm h-full"
                                                  >
                                                      <Calendar size={28} className="mb-3 text-muted-foreground peer-data-[state=checked]:text-primary transition-colors" />
                                                      <span className="text-base font-bold">{time}</span>
                                                  </Label>
                                              </div>
                                          ))}
                                     </RadioGroup>
                                 </div>
                             </div>
                         </TabsContent>

                         {/* 5. Owners */}
                         <TabsContent value="owners" className="space-y-8 mt-0 focus-visible:outline-none animate-in fade-in-30 slide-in-from-bottom-2 duration-500">
                              <div className="flex flex-col gap-2">
                                 <h3 className="text-2xl font-bold tracking-tight">Ownership & Responsibility</h3>
                                 <p className="text-muted-foreground text-base max-w-3xl">Assign stakeholders for accountability across different item lifecycle stages.</p>
                                 <Separator />
                             </div>
                             
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                                 {[
                                     { key: 'ownerEng', label: 'Engineering Owner', desc: 'Responsible for specs & technical data.' },
                                     { key: 'ownerPurch', label: 'Purchasing Owner', desc: 'Responsible for procurement & vendor relations.' },
                                     { key: 'ownerSched', label: 'Scheduling Owner', desc: 'Responsible for demand planning.' },
                                     { key: 'ownerSales', label: 'Sales Owner', desc: 'Responsible for pricing & customer inquiries.' },
                                     { key: 'ownerAR', label: 'Accounts Receivable', desc: 'Responsible for billing & collections.' },
                                 ].map((role) => (
                                     <div key={role.key} className="space-y-3">
                                         <Label className="text-base font-semibold">{role.label}</Label>
                                         <Select 
                                            // @ts-ignore
                                            value={advancedConfig[role.key]} 
                                            onValueChange={(v) => updateConfig(role.key, v)}
                                         >
                                            <SelectTrigger className="h-12 bg-background shadow-sm"><SelectValue placeholder="Select User" /></SelectTrigger>
                                            <SelectContent>
                                                {MOCK_USERS.map(user => (
                                                    <SelectItem key={user.id} value={user.id}>
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-[10px] flex items-center justify-center font-bold">
                                                                {user.name.charAt(0)}
                                                            </div>
                                                            {user.name}
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                         </Select>
                                         <p className="text-xs text-muted-foreground">{role.desc}</p>
                                     </div>
                                 ))}
                             </div>
                         </TabsContent>

                          {/* 6. Selling */}
                          <TabsContent value="selling" className="space-y-8 mt-0 focus-visible:outline-none animate-in fade-in-30 slide-in-from-bottom-2 duration-500">
                              <div className="flex flex-col gap-2">
                                 <h3 className="text-2xl font-bold tracking-tight">Selling Configurations</h3>
                                 <p className="text-muted-foreground text-base max-w-3xl">Define sales channels, customer restrictions, and pricing models.</p>
                                 <Separator />
                             </div>
                             
                             <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                                 <div className="space-y-6">
                                     <Label className="text-base font-semibold">Selling Scope</Label>
                                     <div className="grid grid-cols-1 gap-4">
                                         <div className={cn(
                                             "flex items-start space-x-4 rounded-xl border-2 p-6 transition-all cursor-pointer shadow-sm hover:shadow-md",
                                             advancedConfig.sellingScope === 'all' ? "border-primary bg-primary/5" : "border-border hover:bg-card"
                                         )} onClick={() => updateConfig('sellingScope', 'all')}>
                                             <div className={cn("mt-1 w-5 h-5 rounded-full border border-primary flex items-center justify-center shrink-0", advancedConfig.sellingScope === 'all' ? "bg-primary" : "bg-transparent")}>
                                                 {advancedConfig.sellingScope === 'all' && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                                             </div>
                                             <div className="flex-1">
                                                 <p className="text-base font-bold text-foreground">Sell to All Partners</p>
                                                 <p className="text-sm text-muted-foreground mt-1 leading-relaxed">Item is available in the public catalog for all customers.</p>
                                             </div>
                                         </div>
                                         
                                         <div className={cn(
                                             "flex items-start space-x-4 rounded-xl border-2 p-6 transition-all cursor-pointer shadow-sm hover:shadow-md",
                                             advancedConfig.sellingScope === 'specific' ? "border-primary bg-primary/5" : "border-border hover:bg-card"
                                         )} onClick={() => updateConfig('sellingScope', 'specific')}>
                                              <div className={cn("mt-1 w-5 h-5 rounded-full border border-primary flex items-center justify-center shrink-0", advancedConfig.sellingScope === 'specific' ? "bg-primary" : "bg-transparent")}>
                                                  {advancedConfig.sellingScope === 'specific' && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                                              </div>
                                              <div className="flex-1">
                                                  <p className="text-base font-bold text-foreground">Sell to Specific Partners</p>
                                                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">Restricted to assigned customers or groups only.</p>
                                              </div>
                                          </div>
                                     </div>
                                 </div>
                                 
                                 <div className="space-y-6">
                                     <Label className="text-base font-semibold">Base Price</Label>
                                     <div className="flex gap-4 p-8 bg-card rounded-xl border border-border shadow-sm">
                                         <div className="relative flex-1">
                                             <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold text-xl">$</span>
                                             <Input className="h-16 pl-10 text-2xl font-bold bg-background shadow-sm" placeholder="0.00" value={advancedConfig.customPrice} onChange={(e) => updateConfig('customPrice', e.target.value)} />
                                         </div>
                                         <Select value={advancedConfig.priceUom} onValueChange={(v) => updateConfig('priceUom', v)}>
                                             <SelectTrigger className="h-16 w-[140px] bg-background shadow-sm text-lg"><SelectValue /></SelectTrigger>
                                             <SelectContent>
                                                 <SelectItem value="Each">/ EA</SelectItem>
                                                 <SelectItem value="Box">/ BX</SelectItem>
                                             </SelectContent>
                                         </Select>
                                     </div>
                                     <p className="text-sm text-muted-foreground">This is the default list price. Advanced pricing rules may override this value.</p>
                                 </div>
                             </div>
                         </TabsContent>

                         {/* 7. Valuation */}
                         <TabsContent value="valuation" className="space-y-8 mt-0 focus-visible:outline-none animate-in fade-in-30 slide-in-from-bottom-2 duration-500">
                              <div className="flex flex-col gap-2">
                                 <h3 className="text-2xl font-bold tracking-tight">Inventory Valuation</h3>
                                 <p className="text-muted-foreground text-base max-w-3xl">Method for calculating inventory costs and financial reporting.</p>
                                 <Separator />
                             </div>
                             
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                 {[
                                     { id: 'FIFO', name: 'FIFO', sub: 'First-In, First-Out', desc: 'Assumes oldest inventory items are sold first. Good for perishable goods.' },
                                     { id: 'LIFO', name: 'LIFO', sub: 'Last-In, First-Out', desc: 'Assumes newest inventory items are sold first. Can reduce tax liability.' },
                                     { id: 'WAC', name: 'Weighted Avg', sub: 'Average Cost', desc: 'Blends costs of all available units. Smoothes out price fluctuations.' },
                                     { id: 'Specific', name: 'Specific', sub: 'Specific Identification', desc: 'Tracks cost of individual items uniquely. Used for high-value items.' },
                                 ].map(method => (
                                      <div key={method.id} className={cn(
                                         "relative flex flex-col p-6 rounded-xl border-2 transition-all cursor-pointer h-full hover:shadow-md",
                                         advancedConfig.valuationMethod === method.id 
                                            ? "border-primary bg-primary/5 ring-0" 
                                            : "border-border hover:border-primary/30 hover:bg-card"
                                      )} onClick={() => updateConfig('valuationMethod', method.id)}>
                                         <div className="flex justify-between items-start mb-3">
                                             <span className="font-bold text-xl">{method.name}</span>
                                             {advancedConfig.valuationMethod === method.id ? (
                                                 <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center animate-in zoom-in-50">
                                                     <Check size={14} className="text-white" strokeWidth={3} />
                                                 </div>
                                             ) : (
                                                 <div className="w-6 h-6 rounded-full border-2 border-border" />
                                             )}
                                         </div>
                                         <div className="text-sm font-semibold text-foreground mb-2">{method.sub}</div>
                                         <p className="text-sm text-muted-foreground leading-relaxed">{method.desc}</p>
                                      </div>
                                 ))}
                             </div>
                         </TabsContent>

                         {/* 8. Handling */}
                         <TabsContent value="handling" className="space-y-8 mt-0 focus-visible:outline-none animate-in fade-in-30 slide-in-from-bottom-2 duration-500">
                              <div className="flex flex-col gap-2">
                                 <h3 className="text-2xl font-bold tracking-tight">Handling & Safety</h3>
                                 <p className="text-muted-foreground text-base max-w-3xl">Safety instructions, hazard classifications, and compliance documents.</p>
                                 <Separator />
                             </div>
                             
                             <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                                 <div className="space-y-8">
                                     <div className="space-y-4">
                                         <Label className="text-base font-semibold">Hazard Class</Label>
                                          <RadioGroup value={advancedConfig.hazardClass} onValueChange={(v) => updateConfig('hazardClass', v)} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                             {[
                                                 { id: 'None', icon: CheckCircle2, label: 'None', color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/20' },
                                                 { id: 'Flammable', icon: Flame, label: 'Flammable', color: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900/20' },
                                                 { id: 'Corrosive', icon: Droplets, label: 'Corrosive', color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/20' },
                                                 { id: 'Toxic', icon: Skull, label: 'Toxic', color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/20' }
                                             ].map(hazard => (
                                                 <div key={hazard.id} className="h-full">
                                                     <RadioGroupItem value={hazard.id} id={`h-${hazard.id}`} className="peer sr-only" />
                                                     <Label
                                                         htmlFor={`h-${hazard.id}`}
                                                         className="flex flex-col items-center justify-center p-5 rounded-xl border-2 border-border bg-card hover:border-primary/50 hover:bg-accent/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 peer-data-[state=checked]:shadow-md transition-all cursor-pointer shadow-sm h-full"
                                                     >
                                                         <div className={cn("p-4 rounded-full mb-3 transition-transform hover:scale-110", hazard.bg)}>
                                                            <hazard.icon className={cn("w-8 h-8", hazard.color)} />
                                                         </div>
                                                         <span className="text-base font-bold">{hazard.label}</span>
                                                     </Label>
                                                 </div>
                                             ))}
                                         </RadioGroup>
                                     </div>

                                      <div className="space-y-4">
                                         <Label className="text-base font-semibold">Special Handling Instructions</Label>
                                         <Textarea 
                                             className="min-h-[160px] resize-none text-base p-4 shadow-sm" 
                                             placeholder="e.g. Keep dry, Do not stack, Temperature controlled..."
                                             value={advancedConfig.handlingInstructions}
                                             onChange={(e) => updateConfig('handlingInstructions', e.target.value)}
                                         />
                                     </div>
                                 </div>

                                  <div className="space-y-4">
                                     <Label className="text-base font-semibold">Material Safety Data Sheet (MSDS)</Label>
                                     <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:bg-secondary/20 transition-colors cursor-pointer bg-card h-full flex flex-col items-center justify-center min-h-[300px] group">
                                         {advancedConfig.msdsFile ? (
                                             <div className="flex flex-col items-center gap-4 animate-in zoom-in-50 duration-300">
                                                 <div className="w-24 h-24 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center shadow-sm">
                                                     <FileText size={48} />
                                                 </div>
                                                 <div className="text-xl font-medium">{advancedConfig.msdsFile}</div>
                                                 <Button variant="ghost" onClick={(e) => { e.stopPropagation(); updateConfig('msdsFile', null); }} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                                                     Remove File
                                                 </Button>
                                             </div>
                                         ) : (
                                             <div className="flex flex-col items-center gap-4" onClick={() => updateConfig('msdsFile', 'material_safety.pdf')}>
                                                 <div className="w-24 h-24 rounded-full bg-secondary text-muted-foreground flex items-center justify-center mb-2 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                                    <Upload size={40} />
                                                 </div>
                                                 <div>
                                                    <p className="text-xl font-bold mb-1">Upload MSDS Document</p>
                                                    <p className="text-sm text-muted-foreground">PDF files only, max 5MB</p>
                                                 </div>
                                                 <Button variant="outline" className="mt-2">Select File</Button>
                                             </div>
                                         )}
                                     </div>
                                 </div>
                             </div>
                         </TabsContent>

                         {/* 9. General */}
                         <TabsContent value="general" className="space-y-8 mt-0 focus-visible:outline-none animate-in fade-in-30 slide-in-from-bottom-2 duration-500">
                              <div className="flex flex-col gap-2">
                                 <h3 className="text-2xl font-bold tracking-tight">General Settings</h3>
                                 <p className="text-muted-foreground text-base max-w-3xl">Miscellaneous system behaviors and operational constraints.</p>
                                 <Separator />
                             </div>
                             
                             <div className="space-y-6 max-w-3xl">
                                 <div className="flex items-center justify-between p-8 border border-border rounded-xl bg-card hover:border-primary/40 transition-all shadow-sm">
                                     <div className="flex gap-6">
                                         <div className="mt-1 w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                                             <ScanBarcode size={28} className="text-primary" />
                                         </div>
                                         <div>
                                             <Label className="text-xl font-semibold block mb-2 cursor-pointer" htmlFor="scan-switch">Required Scanning</Label>
                                             <p className="text-base text-muted-foreground leading-relaxed max-w-lg">Force barcode scanning for all inventory transactions involving this item. This improves accuracy but may slow down operations.</p>
                                         </div>
                                     </div>
                                     <Switch 
                                         id="scan-switch"
                                         checked={advancedConfig.requireScan}
                                         onCheckedChange={(c) => updateConfig('requireScan', c)}
                                         className="scale-125"
                                     />
                                 </div>
                             </div>
                         </TabsContent>
                        </div>
                     </div>
                 </Tabs>
            </div>
        </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col min-h-full pb-20"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
           <Button 
            variant="ghost" 
            size="icon" 
            onClick={onCancel}
            className="h-10 w-10 -ml-2 text-base-second hover:text-foreground rounded-full"
           >
                <ArrowLeft size={22} />
           </Button>
           <div>
               <div className="flex items-center gap-2 text-sm text-base-second mb-1">
                    <span className="cursor-pointer hover:text-foreground transition-colors" onClick={onBackToOverview}>Items & Inventory</span>
                    <span className="text-border">/</span>
                    <span className="cursor-pointer hover:text-foreground transition-colors" onClick={onCancel}>Items</span>
                    <span className="text-border">/</span>
                    <span className="text-foreground font-medium">New Item</span>
               </div>
               <div className="flex items-center gap-3">
                   <h1 className="text-3xl font-semibold text-foreground tracking-tight">Create Item</h1>
                   <div className="flex items-center gap-2 text-sm text-base-second px-2 py-0.5 rounded-full bg-secondary/50 border border-border/50">
                        <span className={cn("w-2 h-2 rounded-full bg-amber-400")} />
                        Draft
                   </div>
               </div>
           </div>
        </div>
        <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={onCancel} className="text-base-second hover:text-foreground">
                Discard
            </Button>
            <Button onClick={onSave} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm px-6">
                Save Item
            </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Primary Content (65-70%) */}
        <div className="xl:col-span-8 space-y-6">
            
            {/* Basic Info Card */}
            <div className="bg-card border border-border/60 rounded-xl shadow-sm overflow-hidden">
                <div className="p-6 border-b border-border/40 flex items-center justify-between bg-secondary/5">
                    <h2 className="text-lg font-semibold flex items-center gap-2 text-foreground">
                        <Box size={18} className="text-primary" />
                        Basic Information
                    </h2>
                    <Badge variant="outline" className="font-normal text-base-second bg-background">
                        ID: Auto-generated
                    </Badge>
                </div>
                
                <div className="p-8 space-y-8">
                    {/* Item Name - Primary Focus */}
                    <div className="space-y-3">
                        <Label htmlFor="itemName" className="text-sm font-medium text-foreground">
                            Item Name <span className="text-destructive">*</span>
                        </Label>
                        <Input 
                            id="itemName"
                            placeholder="e.g., Ergonomic Office Chair"
                            value={basicInfo.name}
                            onChange={(e) => setBasicInfo({...basicInfo, name: e.target.value})}
                            className="font-medium text-xl h-14 px-4 border-border bg-input-background focus-visible:border-primary focus-visible:ring-primary/20"
                        />
                        <p className="text-[13px] text-base-second">
                            This will be the primary display name across the system.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Part Number */}
                        <div className="space-y-3">
                            <Label htmlFor="partNumber" className="text-sm font-medium text-foreground">
                                Part Number (SKU) <span className="text-destructive">*</span>
                            </Label>
                            <div className="relative">
                                <Input 
                                    id="partNumber"
                                    placeholder="e.g. FUR-CHR-001"
                                    value={basicInfo.partNumber}
                                    onChange={(e) => setBasicInfo({...basicInfo, partNumber: e.target.value})}
                                    className="font-mono text-base h-12 pl-4 border-border bg-input-background focus-visible:border-primary focus-visible:ring-primary/20"
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <Badge variant="secondary" className="text-[10px] font-normal h-6 bg-secondary text-base-second">Unique</Badge>
                                </div>
                            </div>
                        </div>

                         {/* Status */}
                         <div className="space-y-3">
                            <Label className="text-sm font-medium text-foreground">Initial Status</Label>
                             <Select 
                                value={basicInfo.status} 
                                onValueChange={(val) => setBasicInfo({...basicInfo, status: val})}
                            >
                                <SelectTrigger className="h-12 border-border bg-input-background focus:ring-primary/20">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Draft">Draft</SelectItem>
                                    <SelectItem value="Active">Active</SelectItem>
                                    <SelectItem value="Discontinued">Discontinued</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-3">
                        <Label htmlFor="description" className="text-sm font-medium text-foreground">
                            Description
                        </Label>
                        <Textarea 
                            id="description"
                            placeholder="Enter a detailed description of the item, including specifications, material, and usage instructions..."
                            value={basicInfo.description}
                            onChange={(e) => setBasicInfo({...basicInfo, description: e.target.value})}
                            className="min-h-[160px] resize-y text-base leading-relaxed p-4 border-border bg-input-background focus-visible:border-primary focus-visible:ring-primary/20"
                        />
                    </div>
                </div>
            </div>

             {/* Images & Attachments Container */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-card border border-border/60 rounded-xl shadow-sm overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-border/40 flex items-center justify-between">
                        <h2 className="text-base font-semibold flex items-center gap-2">
                            <ImageIcon size={16} className="text-primary" />
                            Media Gallery
                        </h2>
                    </div>
                    <div className="p-4 flex-1">
                        <div className="grid grid-cols-3 gap-3">
                            {uploadedImages.map((img, i) => (
                                <div key={i} className="group relative aspect-square rounded-lg border border-border bg-background overflow-hidden shadow-sm hover:shadow-md transition-all">
                                    <img src={img} alt="" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                        <Button size="icon" variant="destructive" className="h-6 w-6 rounded-full">
                                            <Trash2 size={12} />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                            <div 
                                onClick={() => setUploadedImages([...uploadedImages, `https://images.unsplash.com/photo-1563456020978-5a5eb63ce380?w=400&q=80`])}
                                className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer flex flex-col items-center justify-center gap-1 text-base-second hover:text-primary"
                            >
                                <Upload size={18} />
                                <span className="text-[10px] font-medium">Add</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-card border border-border/60 rounded-xl shadow-sm overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-border/40 flex items-center justify-between">
                        <h2 className="text-base font-semibold flex items-center gap-2">
                            <Paperclip size={16} className="text-primary" />
                            Attachments
                        </h2>
                    </div>
                    <div className="p-4 flex-1">
                        <div className="space-y-2">
                            {attachments.map((file, i) => (
                                <div key={i} className="flex items-center justify-between p-3 border border-border rounded-lg bg-background hover:bg-secondary/20 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                                            <FileText size={16} />
                                        </div>
                                        <div className="overflow-hidden">
                                            <p className="text-sm font-medium text-foreground truncate max-w-[120px]">{file.name}</p>
                                            <p className="text-[10px] text-base-second">{file.size}</p>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-base-second">
                                        <X size={14} />
                                    </Button>
                                </div>
                            ))}
                             <Button variant="outline" size="sm" className="w-full text-xs h-8 border-dashed">
                                 <Plus size={14} className="mr-2" /> Add Document
                             </Button>
                        </div>
                    </div>
                </div>
             </div>
        </div>

        {/* Right Column: Context & Config (30-35%) */}
        <div className="xl:col-span-4 space-y-6">
            
            {/* Classification Card */}
            <div className="bg-card border border-border/60 rounded-xl shadow-sm overflow-hidden">
                <div className="p-5 border-b border-border/40 bg-secondary/10 flex justify-between items-center">
                    <h3 className="font-semibold text-foreground flex items-center gap-2">
                        <Layers size={16} className="text-base-second" />
                        Classification
                    </h3>
                    {selectedCategoryIds.length > 0 && (
                        <Badge variant="secondary" className="bg-white text-base-second border border-border/50">
                            {selectedCategoryIds.length} Selected
                        </Badge>
                    )}
                </div>
                <div className="p-5 space-y-5">
                    
                    {/* Selected Categories List */}
                    <div className="space-y-3">
                         <div className="flex items-center justify-between">
                            <Label className="text-xs uppercase tracking-wider text-base-second font-medium">Assigned Categories</Label>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-6 text-xs text-primary hover:text-primary/80 px-2"
                                onClick={() => setIsCategoryModalOpen(true)}
                            >
                                Manage
                            </Button>
                         </div>
                         
                         <div className="flex flex-col gap-2">
                             {selectedCategoryIds.map(id => {
                                 const cat = CATEGORIES.find(c => c.id === id);
                                 if (!cat) return null;
                                 const isPrimary = primaryCategoryId === id;
                                 
                                 return (
                                     <div 
                                        key={id} 
                                        className="flex items-center justify-between p-3 rounded-lg border border-border bg-background hover:border-primary/30 transition-colors cursor-pointer group"
                                        onClick={() => setViewingCategory(cat)}
                                     >
                                        <div className="flex items-center gap-3">
                                            <div className={cn("w-2 h-2 rounded-full", cat.color.split(' ')[0])} />
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-foreground">{cat.name}</span>
                                                <span className="text-[10px] text-base-second">{cat.code}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {isPrimary && (
                                                <Badge className="h-5 px-1.5 text-[10px] font-medium bg-primary/10 text-primary hover:bg-primary/20 border-0">Primary</Badge>
                                            )}
                                            <ChevronRight size={14} className="text-base-second opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                     </div>
                                 );
                             })}
                             
                             {selectedCategoryIds.length === 0 && (
                                 <div 
                                    className="border-2 border-dashed border-border rounded-lg p-4 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-secondary/20 transition-colors gap-2"
                                    onClick={() => setIsCategoryModalOpen(true)}
                                 >
                                     <div className="w-8 h-8 rounded-full bg-secondary text-base-second flex items-center justify-center">
                                         <Plus size={16} />
                                     </div>
                                     <span className="text-sm text-base-second font-medium">Select Categories</span>
                                 </div>
                             )}
                         </div>
                    </div>

                    <Separator />

                    <div className="space-y-3 pt-1">
                         <Label className="text-xs uppercase tracking-wider text-base-second font-medium flex items-center gap-2">
                            <TagIcon size={12} /> Tags
                         </Label>
                         <div className="flex flex-wrap gap-2 p-3 bg-secondary/20 rounded-lg border border-border/50 min-h-[80px] content-start">
                            {basicInfo.tags.map(tag => (
                                <Badge key={tag} className="bg-white dark:bg-secondary border shadow-sm text-foreground hover:bg-white pr-1 h-6">
                                    {tag}
                                    <X size={12} className="ml-1 cursor-pointer text-base-second hover:text-destructive" onClick={() => removeTag(tag)} />
                                </Badge>
                            ))}
                            <input 
                                className="bg-transparent text-sm min-w-[60px] outline-none placeholder:text-base-second/70 flex-1"
                                placeholder="Add tag..."
                                value={tagInput}
                                onChange={(e) => setTagInput(e.target.value)}
                                onKeyDown={handleAddTag}
                            />
                         </div>
                    </div>
                </div>
            </div>

            {/* Advanced Configuration Touchpoint */}
             <div className="bg-card border border-border/60 rounded-xl shadow-sm overflow-hidden p-6 flex flex-col items-center text-center space-y-4">
                 <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-2">
                     <SlidersHorizontal size={24} />
                 </div>
                 <div className="space-y-1">
                     <h3 className="font-semibold text-foreground">Advanced Configuration</h3>
                     <p className="text-sm text-base-second max-w-[200px] mx-auto">
                        Configure inventory limits, purchasing rules, cycle counting, and more.
                     </p>
                 </div>
                 <Button 
                    variant="outline" 
                    className="w-full mt-2 border-primary/20 text-primary hover:bg-primary/5 hover:border-primary/50 group"
                    onClick={() => setViewMode('advanced')}
                 >
                     Configure Settings
                     <ArrowRight size={14} className="ml-2 transition-transform group-hover:translate-x-1" />
                 </Button>
             </div>
        </div>
      </div>

      {/* Category Selection Modal */}
      <Dialog open={isCategoryModalOpen} onOpenChange={setIsCategoryModalOpen}>
        <DialogContent className="max-w-[100vw] w-full h-[95vh] flex flex-col p-0 gap-0">
             <DialogHeader className="px-6 py-4 border-b border-border/40 space-y-1">
                 <DialogTitle>Select Categories</DialogTitle>
                 <DialogDescription>
                     Browse and select categories for this item. Identify the primary category for default behavior.
                 </DialogDescription>
             </DialogHeader>
             
             {/* Toolbar */}
             <div className="px-6 py-3 border-b border-border/40 flex items-center justify-between bg-secondary/5">
                 <div className="relative w-72">
                     <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-second" />
                     <Input 
                        placeholder="Search categories..." 
                        className="pl-9 h-9 bg-white dark:bg-black/20" 
                        value={categorySearch}
                        onChange={(e) => setCategorySearch(e.target.value)}
                     />
                 </div>
                 <div className="flex items-center gap-2">
                     <Button variant="outline" size="sm" className="h-9 gap-2">
                         <Filter size={14} /> Filter
                     </Button>
                     <Button size="sm" className="h-9 gap-2" onClick={() => setIsCategoryModalOpen(false)}>
                         Done
                     </Button>
                 </div>
             </div>

             {/* Table */}
             <div className="flex-1 overflow-auto p-0">
                 <Table>
                     <TableHeader className="bg-secondary/20 sticky top-0 z-10">
                         <TableRow className="border-b border-border/60 hover:bg-secondary/20">
                             <TableHead className="w-[50px] text-center">Select</TableHead>
                             <TableHead className="w-[100px]">Code</TableHead>
                             <TableHead className="min-w-[200px]">Category Name</TableHead>
                             <TableHead className="w-[100px] text-center">Primary</TableHead>
                             <TableHead className="w-[120px]">Type</TableHead>
                             <TableHead className="w-[100px]">Items</TableHead>
                             <TableHead className="w-[150px]">Owner</TableHead>
                             <TableHead className="w-[120px]">Created On</TableHead>
                             <TableHead className="w-[100px]">Status</TableHead>
                             <TableHead className="w-[50px]"></TableHead>
                         </TableRow>
                     </TableHeader>
                     <TableBody>
                         {filteredCategories.map(cat => {
                             const isSelected = selectedCategoryIds.includes(cat.id);
                             const isPrimary = primaryCategoryId === cat.id;

                             return (
                                 <TableRow key={cat.id} className={cn("border-b border-border/40 transition-colors", isSelected ? "bg-primary/5" : "hover:bg-secondary/10")}>
                                     <TableCell className="text-center">
                                         <Checkbox 
                                            checked={isSelected}
                                            onCheckedChange={() => handleToggleCategory(cat.id)}
                                         />
                                     </TableCell>
                                     <TableCell className="font-mono text-xs text-base-second">{cat.code}</TableCell>
                                     <TableCell>
                                         <div className="flex flex-col">
                                             <span className="font-medium text-foreground">{cat.name}</span>
                                             <span className="text-xs text-base-second line-clamp-1 max-w-[300px]">{cat.description}</span>
                                         </div>
                                     </TableCell>
                                     <TableCell className="text-center">
                                         <RadioGroup value={primaryCategoryId} onValueChange={handleSetPrimary} className="flex justify-center">
                                             <RadioGroupItem value={cat.id} id={`primary-${cat.id}`} />
                                         </RadioGroup>
                                     </TableCell>
                                     <TableCell className="text-sm">
                                         <Badge variant="outline" className="font-normal">{cat.type}</Badge>
                                     </TableCell>
                                     <TableCell className="text-sm">{cat.itemCount}</TableCell>
                                     <TableCell className="text-sm text-base-second">{cat.owner}</TableCell>
                                     <TableCell className="text-sm text-base-second">{cat.createdOn}</TableCell>
                                     <TableCell>
                                         <Badge variant="secondary" className={cn("font-normal text-xs", cat.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600')}>
                                             {cat.status}
                                         </Badge>
                                     </TableCell>
                                     <TableCell>
                                         <Button variant="ghost" size="icon" className="h-8 w-8 text-base-second" onClick={() => setViewingCategory(cat)}>
                                             <Info size={16} />
                                         </Button>
                                     </TableCell>
                                 </TableRow>
                             );
                         })}
                     </TableBody>
                 </Table>
             </div>
             
             <div className="px-6 py-3 border-t border-border/40 bg-secondary/5 flex justify-between items-center text-xs text-base-second">
                 <span>{selectedCategoryIds.length} categories selected</span>
                 <div className="flex gap-4">
                     <span>Total Items: {filteredCategories.length}</span>
                 </div>
             </div>
        </DialogContent>
      </Dialog>

      {/* Category Detail Modal */}
      <Dialog open={!!viewingCategory} onOpenChange={(open) => !open && setViewingCategory(null)}>
        <DialogContent className="max-w-md">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                    <div className={cn("w-3 h-3 rounded-full", viewingCategory?.color?.split(' ')[0])} />
                    {viewingCategory?.name}
                </DialogTitle>
                <DialogDescription className="font-mono text-xs">
                    {viewingCategory?.code}
                </DialogDescription>
            </DialogHeader>
            
            {viewingCategory && (
                <div className="space-y-6 pt-2">
                    <div className="space-y-1">
                        <Label className="text-xs uppercase text-base-second font-medium">Description</Label>
                        <p className="text-sm text-foreground leading-relaxed">{viewingCategory.description}</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <Label className="text-xs uppercase text-base-second font-medium">Type</Label>
                            <p className="text-sm font-medium">{viewingCategory.type}</p>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs uppercase text-base-second font-medium">Items</Label>
                            <p className="text-sm font-medium">{viewingCategory.itemCount}</p>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs uppercase text-base-second font-medium">Owner</Label>
                            <p className="text-sm font-medium">{viewingCategory.owner}</p>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs uppercase text-base-second font-medium">Created</Label>
                            <p className="text-sm font-medium">{viewingCategory.createdOn}</p>
                        </div>
                    </div>
                    
                    <Separator />
                    
                    <div className="flex justify-between items-center">
                        <Badge className={cn("font-medium", viewingCategory.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600')}>
                            {viewingCategory.status}
                        </Badge>
                        
                        <div className="flex gap-2">
                             {!selectedCategoryIds.includes(viewingCategory.id) ? (
                                 <Button size="sm" onClick={() => { handleToggleCategory(viewingCategory.id); setViewingCategory(null); }}>
                                     Select Category
                                 </Button>
                             ) : (
                                 <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10 border-destructive/20" onClick={() => { handleToggleCategory(viewingCategory.id); setViewingCategory(null); }}>
                                     Remove Selection
                                 </Button>
                             )}
                        </div>
                    </div>
                </div>
            )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
