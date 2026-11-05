// @ts-nocheck
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { toCategoryCode } from '@/app/lib/categoryCode';
import { motion, AnimatePresence } from 'framer-motion';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { 
  Search, 
  Plus, 
  MoreHorizontal, 
  Download, 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn,
  LayoutGrid, 
  AlignJustify, 
  List,
  SlidersHorizontal,
  X,
  ArrowUpDown,
  Package,
  AlertTriangle,
  Archive,
  ArrowUpRight,
  ChevronsLeft,
  ChevronsRight,
  UserCircle2,
  Users,
  Factory,
  ShoppingCart,
  Columns,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  CheckCircle2
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Badge } from '../ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '../ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { cn } from '../../../lib/utils';
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group"
import { CreateItemModal } from './CreateItemModal';


// --- Types ---

interface Item {
  id: string;
  partNumber: string;
  description: string;
  status: 'In Stock' | 'Low Stock' | 'Out of Stock' | 'Discontinued';
  images: string[];
  inventoryControlType: 'Serialized' | 'Non-Serialized';
  primaryCategory: string;
  additionalCategories: string[];
  onHandQty: number;
  unit: string;
  alternativeStockingUnits: string;
  inboundLocations: string[];
  outboundLocations: string[];
  acquisitionMethod: 'Purchase' | 'Manufactured';
  manufacturer: string;
  mpn: string;
  ownerId: string; // 'current-user' or other
}

type ViewMode = 'comfort' | 'compact' | 'grid';

interface FilterState {
  status: string[];
  manufacturer: string[];
  category: string[];
  stockLevel: 'all' | 'positive' | 'zero';
  ownership: 'all' | 'me';
}

type ColumnId = 'description' | 'status' | 'inventoryControlType' | 'primaryCategory' | 'additionalCategories' | 'onHandQty' | 'alternativeStockingUnits' | 'inboundLocations' | 'outboundLocations' | 'acquisitionMethod';

interface ColumnDef {
    id: ColumnId;
    label: string;
    minWidth: string;
    align?: 'left' | 'right' | 'center';
}

const AVAILABLE_COLUMNS: ColumnDef[] = [
    { id: 'description', label: 'Description', minWidth: '280px' },
    { id: 'status', label: 'Status', minWidth: '120px' },
    { id: 'inventoryControlType', label: 'Control Type', minWidth: '150px' },
    { id: 'primaryCategory', label: 'Primary Cat.', minWidth: '160px' },
    { id: 'additionalCategories', label: 'Additional Cat.', minWidth: '200px' },
    { id: 'onHandQty', label: 'On-Hand', minWidth: '120px', align: 'right' },
    { id: 'alternativeStockingUnits', label: 'Alt. Units', minWidth: '150px' },
    { id: 'inboundLocations', label: 'Inbound Loc.', minWidth: '200px' },
    { id: 'outboundLocations', label: 'Outbound Loc.', minWidth: '200px' },
    { id: 'acquisitionMethod', label: 'Acquisition', minWidth: '150px' },
];

// --- Data ---

const CURRENT_USER_ID = 'user-123';

// --- Sub-Components ---

const ItemType = {
  COLUMN: 'COLUMN',
};

const DraggableColumnItem = ({ id, index, moveColumn, children }: { id: string, index: number, moveColumn: (dragIndex: number, hoverIndex: number) => void, children: React.ReactNode }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [{ handlerId }, drop] = useDrop({
    accept: ItemType.COLUMN,
    collect(monitor) {
      return {
        handlerId: monitor.getHandlerId(),
      };
    },
    hover(item: any, monitor) {
      if (!ref.current) {
        return;
      }
      const dragIndex = item.index;
      const hoverIndex = index;
      if (dragIndex === hoverIndex) {
        return;
      }
      // Determine rectangle on screen
      const hoverBoundingRect = ref.current?.getBoundingClientRect();
      // Get vertical middle
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      // Determine mouse position
      const clientOffset = monitor.getClientOffset();
      // Get pixels to the top
      const hoverClientY = (clientOffset as any).y - hoverBoundingRect.top;
      // Only perform the move when the mouse has crossed half of the items height
      // When dragging downwards, only move when the cursor is below 50%
      // When dragging upwards, only move when the cursor is above 50%
      // Dragging downwards
      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
        return;
      }
      // Dragging upwards
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
        return;
      }
      moveColumn(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
  });
  const [{ isDragging }, drag] = useDrag({
    type: ItemType.COLUMN,
    item: () => {
      return { id, index };
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });
  drag(drop(ref));
  return (
    <div ref={ref} className={cn("transition-opacity", isDragging ? "opacity-0" : "opacity-100")} data-handler-id={handlerId}>
      {children}
    </div>
  );
};

function StatusBadge({ status, className }: { status: Item['status'], className?: string }) {
    const styles = {
        'In Stock': 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-900/50',
        'Low Stock': 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200/50 dark:border-amber-900/50',
        'Out of Stock': 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 border-rose-200/50 dark:border-rose-900/50',
        'Discontinued': 'bg-slate-50 text-slate-700 dark:bg-slate-900/50 dark:text-slate-400 border-slate-200/50 dark:border-slate-800/50',
    };

    return (
        <span className={cn(`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border whitespace-nowrap`, styles[status] || styles['In Stock'], className)}>
            <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 opacity-60" />
            {status}
        </span>
    );
}

function AcquisitionBadge({ method }: { method: Item['acquisitionMethod'] }) {
    // Handle both old string format and new object format
    const isObjectFormat = typeof method === 'object' && method !== null && 'methods' in method;
    const methods = isObjectFormat ? method.methods : [method];
    const primary = isObjectFormat ? method.primary : method;
    
    // If only one method, show simple badge
    if (methods.length === 1) {
        const singleMethod = methods[0];
        return (
            <Badge variant="secondary" className={cn(
                "font-medium text-[10px] h-5 border px-1.5",
                singleMethod === 'Manufactured' 
                    ? "bg-purple-50 text-purple-700 border-purple-200/50 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800" 
                    : "bg-blue-50 text-blue-700 border-blue-200/50 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800"
            )}>
                {singleMethod === 'Manufactured' ? <Factory className="w-3 h-3 mr-1" /> : <ShoppingCart className="w-3 h-3 mr-1" />}
                {singleMethod}
            </Badge>
        );
    }
    
    // Multiple methods - show both with primary indicator
    return (
        <div className="flex flex-wrap items-center gap-1.5">
            {methods.map((m) => {
                const isPrimary = m === primary;
                return (
                    <Badge 
                        key={m} 
                        variant="secondary" 
                        className={cn(
                            "font-medium text-[10px] h-5 border px-1.5 relative",
                            m === 'Manufactured' 
                                ? "bg-purple-50 text-purple-700 border-purple-200/50 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800" 
                                : "bg-blue-50 text-blue-700 border-blue-200/50 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800",
                            !isPrimary && "opacity-50"
                        )}
                    >
                        {m === 'Manufactured' ? <Factory className="w-3 h-3 mr-1" /> : <ShoppingCart className="w-3 h-3 mr-1" />}
                        {m}
                        {isPrimary && (
                            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[var(--success)] border border-white dark:border-gray-800" title="Primary Method" />
                        )}
                    </Badge>
                );
            })}
        </div>
    );
}

function StatsCard({ title, value, subtext, icon: Icon, trend }: { title: string, value: string, subtext?: string, icon: any, trend?: 'up' | 'down' | 'neutral' }) {
    return (
        <div className="bg-card border border-border/60 rounded-xl p-4 flex items-start justify-between shadow-sm">
            <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-base-second uppercase tracking-wider">{title}</span>
                <span className="text-2xl font-semibold text-foreground tracking-tight">{value}</span>
                {subtext && <span className="text-xs text-base-second/80">{subtext}</span>}
            </div>
            <div className={cn("p-2 rounded-lg bg-secondary/50 text-primary")}>
                <Icon size={18} />
            </div>
        </div>
    );
}

// --- Main Component ---

interface ItemsLibraryProps {
  onBack: () => void;
  onCreate: () => void;
  onViewDetail?: (id: string) => void;
  items: Item[]; // Received from App.tsx
  onItemCreate?: (item: any) => void; // Sync back to App.tsx
}

export function ItemsLibrary({ onBack, onCreate, onViewDetail, items, onItemCreate }: ItemsLibraryProps) {
  // State
  const [viewMode, setViewMode] = useState<ViewMode>('comfort');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItemForImage, setSelectedItemForImage] = useState<Item | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [activeTab, setActiveTab] = useState('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  
  // Highlighting State
  const [newlyCreatedItemId, setNewlyCreatedItemId] = useState<string | null>(null);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(6);
  
  // Filter State
  const [filters, setFilters] = useState<FilterState>({
    status: [],
    manufacturer: [],
    category: [],
    stockLevel: 'all',
    ownership: 'all'
  });

  // Column State
  const [columnOrder, setColumnOrder] = useState<ColumnId[]>(AVAILABLE_COLUMNS.map(c => c.id));
  const [hiddenColumnIds, setHiddenColumnIds] = useState<ColumnId[]>([]);

  // Derived Data (Unique options for filters)
  const uniqueStatuses = Array.from(new Set(items.map(d => d.status)));
  const uniqueManufacturers = Array.from(new Set(items.map(d => d.manufacturer)));
  const uniqueCategories = Array.from(new Set(items.map(d => d.primaryCategory)));

  const activeFilterCount = 
    filters.status.length + 
    filters.manufacturer.length + 
    filters.category.length + 
    (filters.stockLevel !== 'all' ? 1 : 0);

  // Filtering Logic
  const filteredData = useMemo(() => {
    return items.filter(item => {
      // Tab Filter (Pre-filtering based on primary status tabs)
      if (activeTab === 'low-stock' && item.status !== 'Low Stock') return false;
      if (activeTab === 'out-of-stock' && item.status !== 'Out of Stock') return false;
      
      // Ownership Filter
      if (filters.ownership === 'me' && item.ownerId !== CURRENT_USER_ID) return false;

      // Search Term
      const matchesSearch = 
        searchTerm === '' ||
        item.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
        item.partNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.manufacturer.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.mpn.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      // Faceted Filters
      if (filters.status.length > 0 && !filters.status.includes(item.status)) return false;
      if (filters.manufacturer.length > 0 && !filters.manufacturer.includes(item.manufacturer)) return false;
      if (filters.category.length > 0 && !filters.category.includes(item.primaryCategory)) return false;

      // Stock Level Filter
      if (filters.stockLevel === 'positive' && item.onHandQty <= 0) return false;
      if (filters.stockLevel === 'zero' && item.onHandQty > 0) return false;

      return true;
    });
  }, [items, searchTerm, filters, activeTab]);
  
  // Pagination Logic
  const totalItems = filteredData.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  
  const currentData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredData, currentPage, itemsPerPage]);

  // Reset pagination when filters change
  useEffect(() => {
      setCurrentPage(1);
  }, [searchTerm, filters, activeTab]);

  // Clear highlight after delay
  useEffect(() => {
      if (newlyCreatedItemId) {
          const timer = setTimeout(() => {
              setNewlyCreatedItemId(null);
          }, 4000);
          return () => clearTimeout(timer);
      }
  }, [newlyCreatedItemId]);

  // Handlers
  const handleCreateSuccess = (newItem?: any) => {
      if (newItem) {
          // Notify parent (App.tsx) so it can update its state
          onItemCreate?.(newItem);
          // Highlight
          setNewlyCreatedItemId(newItem.id);
      }
  };

  const handleImageClick = (e: React.MouseEvent, item: Item) => {
      e.stopPropagation();
      setSelectedItemForImage(item);
      setActiveImageIndex(0);
  };

  const nextImage = () => {
      if (selectedItemForImage) {
          setActiveImageIndex((prev) => (prev + 1) % selectedItemForImage.images.length);
      }
  };

  const prevImage = () => {
      if (selectedItemForImage) {
          setActiveImageIndex((prev) => (prev - 1 + selectedItemForImage.images.length) % selectedItemForImage.images.length);
      }
  };

  const clearFilters = () => {
    setFilters({
      status: [],
      manufacturer: [],
      category: [],
      stockLevel: 'all',
      ownership: 'all'
    });
    setSearchTerm('');
    setActiveTab('all');
  };

  const toggleColumnVisibility = (id: ColumnId) => {
      setHiddenColumnIds(prev => 
        prev.includes(id) 
            ? prev.filter(c => c !== id) 
            : [...prev, id]
      );
  };

  const reorderColumn = (dragIndex: number, hoverIndex: number) => {
      const newOrder = [...columnOrder];
      const [removed] = newOrder.splice(dragIndex, 1);
      newOrder.splice(hoverIndex, 0, removed);
      setColumnOrder(newOrder);
  };

  const moveColumn = (id: ColumnId, direction: 'up' | 'down') => {
      const index = columnOrder.indexOf(id);
      if (index === -1) return;
      if (direction === 'up' && index === 0) return;
      if (direction === 'down' && index === columnOrder.length - 1) return;

      const newOrder = [...columnOrder];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      
      [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
      setColumnOrder(newOrder);
  };

  // --- Render Helpers ---

  const renderFilterSection = (title: string, options: string[], current: string[], onChange: (val: string) => void) => (
    <div className="space-y-2">
      <h4 className="font-medium text-xs text-base-second uppercase tracking-wider">{title}</h4>
      <div className="space-y-1.5">
        {options.map(opt => (
          <div key={opt} className="flex items-center gap-2">
            <Checkbox 
              id={`${title}-${opt}`} 
              checked={current.includes(opt)}
              onCheckedChange={() => onChange(opt)}
            />
            <Label htmlFor={`${title}-${opt}`} className="text-sm font-normal cursor-pointer leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              {opt}
            </Label>
          </div>
        ))}
      </div>
    </div>
  );

  // Highlight helper function for search terms
  const highlightText = (text: string, highlight: string) => {
    if (!highlight.trim()) {
      return <>{text}</>;
    }
    
    const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
    return (
      <>
        {parts.map((part, i) => 
          part.toLowerCase() === highlight.toLowerCase() ? (
            <mark key={i} className="bg-[var(--primary)]/20 text-[var(--foreground)] rounded-sm px-0.5">
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </>
    );
  };

  const renderCellContent = (item: Item, columnId: ColumnId) => {
      switch (columnId) {
          case 'description':
              return (
                <div className="flex flex-col gap-0.5 max-w-[260px]">
                    <span className="text-foreground line-clamp-1" title={item.description}>{highlightText(item.description, searchTerm)}</span>
                    <div className="flex items-center gap-2 text-[10px] text-base-second/80">
                        <span className="truncate max-w-[120px]">{highlightText(item.manufacturer, searchTerm)}</span>
                        <span className="text-border/60">•</span>
                        <span className="font-mono">{highlightText(item.mpn, searchTerm)}</span>
                    </div>
                </div>
              );
          case 'status':
              return <StatusBadge status={item.status} className={viewMode === 'compact' ? "scale-90 origin-left" : ""} />;
          case 'inventoryControlType':
              return <span className="text-base-second">{item.inventoryControlType}</span>;
          case 'primaryCategory':
              return (
                <Badge variant="secondary" className="font-normal text-xs text-base-second bg-secondary/50 border-border/50 hover:bg-secondary hover:text-foreground w-fit">
                    {toCategoryCode(item.primaryCategory)}
                </Badge>
              );
          case 'additionalCategories':
              return (
                <div className="flex flex-wrap gap-1 max-w-[200px]">
                    {item.additionalCategories.length > 0 ? item.additionalCategories.map((cat, i) => (
                        <span key={i} className="inline-flex text-[10px] px-1.5 py-0.5 rounded-md bg-secondary/30 border border-border/30" title={cat}>
                            {toCategoryCode(cat)}
                        </span>
                    )) : <span className="text-base-second/50">-</span>}
                </div>
              );
          case 'onHandQty':
              return (
                <div className="flex flex-col items-end">
                    <span className="text-sm font-semibold">{item.onHandQty.toLocaleString()}</span>
                    <span className="text-xs text-base-second">{item.unit}</span>
                </div>
              );
          case 'alternativeStockingUnits':
              return <span className="text-base-second">{item.alternativeStockingUnits}</span>;
          case 'inboundLocations':
              return (
                <div className="flex flex-col gap-0.5 max-w-[180px]">
                    {item.inboundLocations.map((loc, i) => (
                        <span key={i} className="truncate text-base-second" title={loc}>{loc}</span>
                    ))}
                </div>
              );
          case 'outboundLocations':
              return (
                <div className="flex flex-col gap-0.5 max-w-[180px]">
                    {item.outboundLocations.map((loc, i) => (
                        <span key={i} className="truncate text-base-second" title={loc}>{loc}</span>
                    ))}
                </div>
              );
          case 'acquisitionMethod':
              return <AcquisitionBadge method={item.acquisitionMethod} />;
          default:
              return null;
      }
  };

  const visibleColumns = columnOrder.filter(id => !hiddenColumnIds.includes(id));

  return (
    <DndProvider backend={HTML5Backend}>
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.3 }}
      className="gap-4 flex flex-col h-full bg-transparent overflow-hidden"
    >
      {/* Top Header Section */}
      <div className="flex flex-col gap-2 shrink-0">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-sm text-base-second mb-0">
                    <span className="cursor-pointer hover:text-foreground transition-colors" onClick={onBack}>Home</span>
                    <ChevronRight size={14} className="opacity-50" />
                    <span className="text-foreground font-medium">Inventory</span>
                </div>
                <h1 className="text-3xl font-semibold text-foreground tracking-tight">Items Library</h1>
                <p className="text-base-second max-w-2xl">Manage your entire product catalog, track stock levels in real-time, and organize inventory across multiple locations.</p>
            </div>
            <div className="flex items-center gap-3">
                <Button variant="outline" className="h-10 gap-2 border-border/60 hover:bg-secondary/50">
                    <Download size={16} />
                    Export
                </Button>
                <Button className="h-10 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20" onClick={() => setIsCreateModalOpen(true)}>
                    <Plus size={18} />
                    Add New Item
                </Button>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <StatsCard title="Total Items" value={totalItems.toLocaleString()} subtext="+12% from last month" icon={Package} />
              <StatsCard title="Low Stock Alerts" value={items.filter(i => i.status === 'Low Stock').length.toString()} subtext="Requires attention" icon={AlertTriangle} />
              <StatsCard title="Out of Stock" value={items.filter(i => i.status === 'Out of Stock').length.toString()} subtext="Restock ordered" icon={Archive} />
              <StatsCard title="Total Value" value="$1.2M" subtext="Inventory valuation" icon={ArrowUpRight} />
          </div>
      </div>

      {/* Main Content Card */}
      <div className="flex flex-col flex-1 min-h-0 bg-card border border-border/60 rounded-xl shadow-sm overflow-hidden">
          
          {/* Tabs & Toolbar */}
          <div className="border-b border-border/60 p-4 space-y-4 bg-background/50 backdrop-blur-sm shrink-0">
              <div className="flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between">
                  <div className="flex items-center gap-2 w-full xl:w-auto overflow-x-auto no-scrollbar">
                     {/* Ownership - Simplified to single button */}
                     <Button 
                        variant={filters.ownership === 'me' ? "secondary" : "ghost"} 
                        size="sm"
                        onClick={() => setFilters(prev => ({ ...prev, ownership: prev.ownership === 'me' ? 'all' : 'me' }))}
                        className={cn("gap-2 h-9 border", filters.ownership === 'me' ? "border-border/50 bg-secondary/50" : "border-transparent text-base-second hover:text-foreground")}
                     >
                        <UserCircle2 size={14} />
                        <span className="hidden sm:inline">My Items</span>
                     </Button>

                     <div className="w-[1px] h-6 bg-border/60 shrink-0 hidden sm:block mx-2" />
                     
                     {/* Tabs - Simplified */}
                     <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto shrink-0">
                          <TabsList className="bg-transparent h-9 p-0 gap-1">
                              <TabsTrigger value="all" className="h-8 rounded-md px-3 text-xs data-[state=active]:bg-secondary data-[state=active]:shadow-none border border-transparent data-[state=active]:border-border/40">All</TabsTrigger>
                              <TabsTrigger value="active" className="h-8 rounded-md px-3 text-xs data-[state=active]:bg-secondary data-[state=active]:shadow-none border border-transparent data-[state=active]:border-border/40">Active</TabsTrigger>
                              <TabsTrigger value="low-stock" className="h-8 rounded-md px-3 text-xs data-[state=active]:bg-amber-50 dark:data-[state=active]:bg-amber-900/20 data-[state=active]:text-amber-700 dark:data-[state=active]:text-amber-400 border border-transparent data-[state=active]:border-amber-200/50">Low Stock</TabsTrigger>
                              <TabsTrigger value="out-of-stock" className="h-8 rounded-md px-3 text-xs data-[state=active]:bg-rose-50 dark:data-[state=active]:bg-rose-900/20 data-[state=active]:text-rose-700 dark:data-[state=active]:text-rose-400 border border-transparent data-[state=active]:border-rose-200/50">Out of Stock</TabsTrigger>
                          </TabsList>
                      </Tabs>
                  </div>

                  <div className="flex items-center gap-2 w-full xl:w-auto">
                      <div className="relative flex-1 xl:w-[240px]">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-base-second" />
                          <Input 
                              placeholder="Search..." 
                              className="pl-9 h-9 bg-background/50 border-border/60 focus:bg-background transition-all"
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                          />
                          {searchTerm && (
                              <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-base-second hover:text-foreground">
                                  <X size={14} />
                              </button>
                          )}
                      </div>
                      
                      {/* Column Picker - Icon Only */}
                      <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 text-base-second hover:text-foreground">
                                <Columns size={16} />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[280px] p-0" align="end">
                            <div className="p-3 border-b border-border/60 bg-secondary/20">
                                <h4 className="font-medium text-sm">Customize Columns</h4>
                            </div>
                            <div className="max-h-[300px] overflow-y-auto p-2 space-y-1">
                                {columnOrder.map((colId, index) => {
                                    const colDef = AVAILABLE_COLUMNS.find(c => c.id === colId);
                                    if (!colDef) return null;
                                    const isHidden = hiddenColumnIds.includes(colId);
                                    
                                    return (
                                        <DraggableColumnItem 
                                            key={colId} 
                                            id={colId} 
                                            index={index} 
                                            moveColumn={reorderColumn}
                                        >
                                            <div className="flex items-center justify-between gap-2 p-2 rounded-md hover:bg-secondary/50 group cursor-grab active:cursor-grabbing">
                                                <div className="flex items-center gap-2.5">
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); toggleColumnVisibility(colId); }}
                                                        className={cn("text-base-second hover:text-primary transition-colors cursor-pointer", isHidden && "opacity-50")}
                                                    >
                                                        {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
                                                    </button>
                                                    <span className={cn("text-sm", isHidden && "text-base-second opacity-70 line-through")}>{colDef.label}</span>
                                                </div>
                                                <div className="text-base-second opacity-0 group-hover:opacity-50 transition-opacity">
                                                    <GripVertical size={14} />
                                                </div>
                                            </div>
                                        </DraggableColumnItem>
                                    );
                                })}
                            </div>
                        </PopoverContent>
                      </Popover>

                      {/* Filter - Icon Only */}
                      <Popover>
                          <PopoverTrigger asChild>
                              <Button variant="ghost" size="icon" className={cn("h-9 w-9 text-base-second hover:text-foreground relative", activeFilterCount > 0 && "text-primary bg-primary/10 hover:bg-primary/20")}>
                                  <SlidersHorizontal size={16} />
                                  {activeFilterCount > 0 && (
                                      <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
                                  )}
                              </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[340px] p-4" align="end">
                              <div className="space-y-4">
                                  <div className="flex items-center justify-between">
                                      <h3 className="font-medium text-sm">Filter Items</h3>
                                      {activeFilterCount > 0 && (
                                          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-base-second hover:text-foreground" onClick={clearFilters}>Reset</Button>
                                      )}
                                  </div>
                                  <div className="h-[1px] bg-border/50" />
                                  <div className="grid grid-cols-2 gap-6">
                                      {renderFilterSection('Status', uniqueStatuses, filters.status, (val) => {
                                          setFilters(prev => ({...prev, status: prev.status.includes(val) ? prev.status.filter(s => s !== val) : [...prev.status, val]}));
                                      })}
                                      {renderFilterSection('Category', uniqueCategories, filters.category, (val) => {
                                          setFilters(prev => ({...prev, category: prev.category.includes(val) ? prev.category.filter(s => s !== val) : [...prev.category, val]}));
                                      })}
                                  </div>
                                  <div className="space-y-2">
                                       <h4 className="font-medium text-xs text-base-second uppercase tracking-wider">Manufacturer</h4>
                                       <Select value={filters.manufacturer[0] || ''} onValueChange={(val) => setFilters(prev => ({ ...prev, manufacturer: val ? [val] : [] }))}>
                                          <SelectTrigger className="h-8 w-full text-xs">
                                              <SelectValue placeholder="Any Manufacturer" />
                                          </SelectTrigger>
                                          <SelectContent>
                                              <SelectItem value="all">Any Manufacturer</SelectItem>
                                              {uniqueManufacturers.map(m => (<SelectItem key={m} value={m}>{m}</SelectItem>))}
                                          </SelectContent>
                                       </Select>
                                  </div>
                              </div>
                          </PopoverContent>
                      </Popover>

                      <div className="h-6 w-[1px] bg-border/60 mx-1 shrink-0 hidden sm:block" />

                      <div className="flex items-center gap-1 shrink-0">
                          <Button variant="ghost" size="icon" className={cn("h-8 w-8 rounded-md", viewMode === 'comfort' ? "bg-secondary text-primary" : "text-base-second hover:text-foreground")} onClick={() => setViewMode('comfort')} title="Comfort View">
                              <AlignJustify size={16} />
                          </Button>
                          <Button variant="ghost" size="icon" className={cn("h-8 w-8 rounded-md", viewMode === 'compact' ? "bg-secondary text-primary" : "text-base-second hover:text-foreground")} onClick={() => setViewMode('compact')} title="Compact View">
                              <List size={16} />
                          </Button>
                          <Button variant="ghost" size="icon" className={cn("h-8 w-8 rounded-md", viewMode === 'grid' ? "bg-secondary text-primary" : "text-base-second hover:text-foreground")} onClick={() => setViewMode('grid')} title="Grid View">
                              <LayoutGrid size={16} />
                          </Button>
                      </div>
                  </div>
              </div>
          </div>

          {/* Table Content */}
          <div className="flex-1 overflow-hidden flex flex-col relative bg-card">
             {filteredData.length === 0 ? (
                 <div className="flex-1 flex flex-col items-center justify-center text-base-second bg-secondary/10 m-4 rounded-xl border border-dashed border-border/60">
                     <Search className="h-10 w-10 opacity-20 mb-3" />
                     <p className="font-medium">No items found</p>
                     <p className="text-sm">Try adjusting your filters or search terms</p>
                     <Button variant="link" onClick={clearFilters} className="mt-2 text-primary">Clear all filters</Button>
                 </div>
             ) : (
                 <>
                    <div className="flex-1 overflow-auto scrollbar-thin">
                        {/* View Modes Logic */}
                        {(viewMode === 'comfort' || viewMode === 'compact') && (
                            <Table className="w-full border-separate border-spacing-0">
                                <TableHeader className="bg-secondary sticky top-0 z-20 shadow-sm">
                                    <TableRow className="hover:bg-transparent border-b border-border/60">
                                        <TableHead className="w-[180px] pl-6 py-3 whitespace-nowrap font-medium text-base-second sticky left-0 z-30 bg-secondary border-r border-border/60 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                            Item
                                        </TableHead>
                                        
                                        {/* Dynamic Columns */}
                                        {visibleColumns.map(colId => {
                                            const colDef = AVAILABLE_COLUMNS.find(c => c.id === colId);
                                            return colDef ? (
                                                <TableHead 
                                                    key={colDef.id} 
                                                    className={cn("py-3 whitespace-nowrap font-medium text-base-second", colDef.align === 'right' ? "text-right" : "")}
                                                    style={{ minWidth: colDef.minWidth }}
                                                >
                                                    {colDef.label}
                                                </TableHead>
                                            ) : null;
                                        })}

                                        <TableHead className="w-[60px] pr-4 py-3 whitespace-nowrap sticky right-0 z-30 bg-secondary border-l border-border/60 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.05)]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {currentData.map((item) => (
                                    <TableRow 
                                        key={item.id} 
                                        className={cn(
                                            "border-b border-border/40 last:border-0 transition-all cursor-pointer group",
                                            "hover:bg-muted",
                                            item.id === newlyCreatedItemId && "bg-emerald-50/60 dark:bg-emerald-900/20 animate-in fade-in duration-500"
                                        )}
                                        onClick={() => onViewDetail?.(item.id)}
                                    >
                                        {/* Fixed First Column (Item Image + Part) */}
                                        <TableCell className={cn("align-middle sticky left-0 z-20 group-hover:bg-muted border-r border-border/60 transition-colors", viewMode === 'compact' ? "py-2 pl-4" : "py-3 pl-6", item.id === newlyCreatedItemId ? "bg-emerald-50/60 dark:bg-emerald-900/20" : "bg-card")}>
                                            <div className="flex items-center gap-3">
                                                <div 
                                                    className={cn("shrink-0 rounded-lg bg-secondary/30 border border-border/40 overflow-hidden relative group/img cursor-zoom-in shadow-sm", viewMode === 'compact' ? "h-8 w-8" : "h-9 w-9")}
                                                    onClick={(e) => handleImageClick(e, item)}
                                                >
                                                    <img src={item.images[0]} alt={item.description} className="h-full w-full object-cover transition-transform duration-500 group-hover/img:scale-110" />
                                                </div>
                                                <div className="flex flex-col gap-0.5">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-mono text-sm font-medium text-foreground">{highlightText(item.partNumber, searchTerm)}</span>
                                                        {item.ownerId === CURRENT_USER_ID && (
                                                            <div title="Assigned to you" className="flex items-center justify-center h-3.5 w-3.5 rounded-full bg-primary/10 text-primary">
                                                                <UserCircle2 size={9} strokeWidth={3} />
                                                            </div>
                                                        )}
                                                        {item.id === newlyCreatedItemId && (
                                                            <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-emerald-200 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800">New</Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </TableCell>

                                        {/* Dynamic Columns Cells */}
                                        {visibleColumns.map(colId => (
                                            <TableCell 
                                                key={colId} 
                                                className={cn("align-middle text-sm", viewMode === 'compact' ? "py-2" : "py-3")}
                                            >
                                                {renderCellContent(item, colId)}
                                            </TableCell>
                                        ))}

                                        {/* Fixed Action Column */}
                                        <TableCell className={cn("pr-4 align-middle sticky right-0 z-20 group-hover:bg-muted border-l border-border/60 transition-colors", viewMode === 'compact' ? "py-2" : "py-3", item.id === newlyCreatedItemId ? "bg-emerald-50/60 dark:bg-emerald-900/20" : "bg-card")}>
                                            <div className="flex justify-end">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-base-second hover:text-foreground hover:bg-secondary">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onViewDetail?.(item.id); }}>View Details</DropdownMenuItem>
                                                        <DropdownMenuItem onClick={(e) => e.stopPropagation()}>Edit Item</DropdownMenuItem>
                                                        <DropdownMenuItem onClick={(e) => e.stopPropagation()}>Adjust Stock</DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem className="text-red-600" onClick={(e) => e.stopPropagation()}>Delete Item</DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}

                        {viewMode === 'grid' && (
                            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {currentData.map((item) => (
                                    <div 
                                        key={item.id}
                                        className={cn(
                                            "bg-card border border-border/60 rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:border-border transition-all cursor-pointer group flex flex-col relative",
                                            item.id === newlyCreatedItemId && "ring-2 ring-emerald-500/50 border-emerald-500/30"
                                        )}
                                        onClick={() => onViewDetail?.(item.id)}
                                    >
                                        {item.ownerId === CURRENT_USER_ID && (
                                            <div className="absolute top-2 left-2 z-10 bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm">
                                                ME
                                            </div>
                                        )}
                                        {item.id === newlyCreatedItemId && (
                                            <div className="absolute top-2 left-2 z-10 bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm flex items-center gap-1 animate-in fade-in zoom-in">
                                                <CheckCircle2 size={10} /> NEW
                                            </div>
                                        )}
                                        {/* Grid Card Content */}
                                        <div className="aspect-[3/2] bg-secondary/30 relative overflow-hidden border-b border-border/40">
                                            <img src={item.images[0]} alt={item.description} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                                            <div className="absolute top-2 right-2">
                                                <StatusBadge status={item.status} className="bg-background/90 backdrop-blur-sm shadow-sm" />
                                            </div>
                                            <button 
                                                className="absolute bottom-2 right-2 p-1.5 rounded-md bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-md"
                                                onClick={(e) => handleImageClick(e, item)}
                                            >
                                                <ZoomIn size={14} />
                                            </button>
                                        </div>
                                        <div className="p-4 flex-1 flex flex-col">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-mono text-base-second">{highlightText(item.partNumber, searchTerm)}</span>
                                                    <h3 className="font-medium text-sm leading-snug text-foreground line-clamp-2 pr-6" title={item.description}>
                                                        {highlightText(item.description, searchTerm)}
                                                    </h3>
                                                </div>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-6 w-6 -mt-1 -mr-2 text-base-second hover:text-foreground">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onViewDetail?.(item.id); }}>View Details</DropdownMenuItem>
                                                        <DropdownMenuItem onClick={(e) => e.stopPropagation()}>Edit</DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                            
                                            <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs flex-1 content-start border-t border-border/50 pt-3 mt-1">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] text-base-second uppercase tracking-wider font-medium">Control</span>
                                                    <span className="text-foreground">{item.inventoryControlType}</span>
                                                </div>
                                                <div className="flex flex-col text-right">
                                                    <span className="text-[10px] text-base-second uppercase tracking-wider font-medium">Category</span>
                                                    <span className="text-foreground truncate" title={item.primaryCategory}>{toCategoryCode(item.primaryCategory)}</span>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] text-base-second uppercase tracking-wider font-medium">Location</span>
                                                    <span className="text-foreground truncate" title={item.inboundLocations[0]}>{item.inboundLocations[0] || '-'}</span>
                                                </div>
                                                <div className="flex flex-col text-right">
                                                    <span className="text-[10px] text-base-second uppercase tracking-wider font-medium">Qty</span>
                                                    <span className="font-semibold text-foreground">{item.onHandQty} <span className="text-base-second font-normal">{item.unit}</span></span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    {/* Pagination */}
                    <div className="p-4 border-t border-border/60 bg-background/50 backdrop-blur-sm shrink-0 flex items-center justify-between">
                        <div className="text-xs text-base-second">
                            Showing <span className="font-medium text-foreground">{((currentPage - 1) * itemsPerPage) + 1}</span> to <span className="font-medium text-foreground">{Math.min(currentPage * itemsPerPage, totalItems)}</span> of <span className="font-medium text-foreground">{totalItems}</span> items
                        </div>
                        <div className="flex items-center gap-2">
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 w-8 p-0" 
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                            >
                                <ChevronLeft size={14} />
                            </Button>
                            <span className="text-xs font-medium text-foreground">Page {currentPage} of {totalPages}</span>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 w-8 p-0" 
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                            >
                                <ChevronRight size={14} />
                            </Button>
                        </div>
                    </div>
                 </>
             )}
          </div>
      </div>
      
      {/* Modals */}
      <CreateItemModal 
        open={isCreateModalOpen} 
        onOpenChange={setIsCreateModalOpen} 
        onSuccess={handleCreateSuccess}
      />

      {/* Image Preview Modal */}
      <AnimatePresence>
        {selectedItemForImage && (
            <Dialog open={!!selectedItemForImage} onOpenChange={(open) => !open && setSelectedItemForImage(null)}>
                <DialogContent className="max-w-4xl p-0 bg-black/95 border-border/20 overflow-hidden">
                    <DialogTitle className="sr-only">Image Preview</DialogTitle>
                    <div className="relative h-[80vh] flex items-center justify-center group">
                        <img 
                            src={selectedItemForImage.images[activeImageIndex]} 
                            alt={selectedItemForImage.description} 
                            className="max-h-full max-w-full object-contain"
                        />
                        <div className="absolute inset-0 flex items-center justify-between p-4 pointer-events-none">
                            <Button variant="ghost" size="icon" className="pointer-events-auto h-12 w-12 rounded-full bg-black/50 text-white hover:bg-black/70 backdrop-blur-sm" onClick={prevImage}>
                                <ChevronLeft size={24} />
                            </Button>
                            <Button variant="ghost" size="icon" className="pointer-events-auto h-12 w-12 rounded-full bg-black/50 text-white hover:bg-black/70 backdrop-blur-sm" onClick={nextImage}>
                                <ChevronRight size={24} />
                            </Button>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 to-transparent text-white">
                            <h3 className="text-lg font-semibold">{selectedItemForImage.description}</h3>
                            <p className="text-sm opacity-80 font-mono mt-1">{selectedItemForImage.partNumber} • {activeImageIndex + 1} / {selectedItemForImage.images.length}</p>
                        </div>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="absolute top-4 right-4 text-white/70 hover:text-white hover:bg-white/10 rounded-full"
                            onClick={() => setSelectedItemForImage(null)}
                        >
                            <X size={20} />
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        )}
      </AnimatePresence>
    </motion.div>
    </DndProvider>
  );
}
