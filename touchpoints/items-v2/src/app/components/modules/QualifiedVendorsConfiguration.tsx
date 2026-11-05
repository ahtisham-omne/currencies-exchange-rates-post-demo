import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../../lib/utils';
import {
  Plus,
  ShoppingCart,
  Package,
  Weight,
  Tags,
  ChevronDown,
  Clock,
  Star,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  ArrowLeft,
  ArrowRight,
  Search,
  Filter,
  Download,
  Upload,
  LayoutGrid,
  LayoutList,
  TrendingUp,
  TrendingDown,
  Minus,
  GripVertical,
  Building2,
  MapPin,
  Phone,
  Mail,
  Globe,
  FileText,
  AlertCircle,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { AddQualifiedVendorDialog } from './AddQualifiedVendorDialog';
import { Money } from '../currency/Money';
import { BASE_CURRENCY } from '../../currency/currencies';
import { formatMoney } from '../../currency/money';
import { priceInBase, vendorCurrencyFor, vendorRate } from '../../currency/vendorFx';

// Pricing Rules Data
const PRICING_RULES = [
  { id: 'pr-1', name: 'Standard Discount', type: 'Discount', summary: '15% off on orders of 100+ units', details: 'Min Qty: 100 EA', value: '15%' },
  { id: 'pr-2', name: 'Volume-Based Tier', type: 'Volume', summary: 'Tiered pricing structure', details: 'Max Tier: 12% Off', value: 'Variable' },
  { id: 'pr-3', name: 'Seasonal Promo Q3', type: 'Promotion', summary: 'Limited time offer (Jul-Sep)', details: 'Valid: Q3 2026', value: '10%' },
  { id: 'pr-4', name: 'Contracted Rate', type: 'Fixed Price', summary: 'Agreed fixed rate per unit', details: 'Price/Unit', value: '$12.50' },
  { id: 'pr-5', name: 'New Partner Intro', type: 'One-time', summary: 'Flat discount on first order', details: 'One-time use', value: '-$50.00' },
];

interface Vendor {
  id: string;
  name: string;
  vendorId: string;
  leadTime: number; // in days
  uom: string;
  baseUnit: string;
  conversionFactor: number;
  price: number;
  minOrderQty?: number;
  maxOrderQty?: number;
  orderMultiples?: number;
  deviation?: number;
  priority: number;
  preferred: boolean;
  rating: number;
  rules: string[];
  location?: string;
  contact?: string;
  email?: string;
  phone?: string;
  status: 'active' | 'inactive' | 'pending';
}

const MOCK_VENDORS: Vendor[] = [
  {
    id: '1',
    name: 'Global Supplies Ltd.',
    vendorId: 'VND-01000',
    leadTime: 5,
    uom: 'Box',
    baseUnit: 'EA',
    conversionFactor: 100,
    price: 2450.00,
    minOrderQty: 5,
    maxOrderQty: 500,
    orderMultiples: 5,
    deviation: 2.5,
    priority: 1,
    preferred: true,
    rating: 4.8,
    rules: ['pr-4', 'pr-2'],
    location: 'New York, NY',
    contact: 'John Smith',
    email: 'j.smith@globalsupplies.com',
    phone: '+1 (555) 123-4567',
    status: 'active'
  },
  {
    id: '2',
    name: 'Acme Corp',
    vendorId: 'VND-01001',
    leadTime: 7,
    uom: 'Case',
    baseUnit: 'EA',
    conversionFactor: 500,
    price: 11750.00,
    minOrderQty: 2,
    maxOrderQty: 200,
    orderMultiples: 2,
    deviation: 3.0,
    priority: 2,
    preferred: false,
    rating: 4.2,
    rules: ['pr-1'],
    location: 'Los Angeles, CA',
    contact: 'Sarah Johnson',
    email: 's.johnson@acmecorp.com',
    phone: '+1 (555) 234-5678',
    status: 'active'
  },
  {
    id: '3',
    name: 'Tech Components Ltd',
    vendorId: 'VND-01002',
    leadTime: 3,
    uom: 'Each',
    baseUnit: 'EA',
    conversionFactor: 1,
    price: 26.00,
    minOrderQty: 100,
    maxOrderQty: 10000,
    orderMultiples: 50,
    deviation: 1.5,
    priority: 3,
    preferred: false,
    rating: 4.9,
    rules: ['pr-3'],
    location: 'Chicago, IL',
    contact: 'Mike Davis',
    email: 'm.davis@techcomponents.com',
    phone: '+1 (555) 345-6789',
    status: 'active'
  },
  {
    id: '4',
    name: 'FastTrack Logistics',
    vendorId: 'VND-01003',
    leadTime: 14,
    uom: 'Pallet',
    baseUnit: 'EA',
    conversionFactor: 2000,
    price: 52000.00,
    minOrderQty: 1,
    maxOrderQty: 50,
    orderMultiples: 1,
    deviation: 5.0,
    priority: 4,
    preferred: false,
    rating: 3.9,
    rules: [],
    location: 'Houston, TX',
    contact: 'Emily Brown',
    email: 'e.brown@fasttrack.com',
    phone: '+1 (555) 456-7890',
    status: 'active'
  },
  {
    id: '5',
    name: 'Precision Parts Inc.',
    vendorId: 'VND-01004',
    leadTime: 10,
    uom: 'Box',
    baseUnit: 'EA',
    conversionFactor: 250,
    price: 6125.00,
    minOrderQty: 4,
    maxOrderQty: 400,
    orderMultiples: 4,
    deviation: 2.0,
    priority: 5,
    preferred: false,
    rating: 4.5,
    rules: ['pr-5'],
    location: 'Phoenix, AZ',
    contact: 'Robert Wilson',
    email: 'r.wilson@precisionparts.com',
    phone: '+1 (555) 567-8901',
    status: 'active'
  },
];

interface QualifiedVendorsConfigurationProps {
  onBack: () => void;
}

export function QualifiedVendorsConfiguration({ onBack }: QualifiedVendorsConfigurationProps) {
  const [vendors, setVendors] = useState<Vendor[]>(MOCK_VENDORS);
  const [addVendorDialogOpen, setAddVendorDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const handleAddVendor = (vendorData: any) => {
    const newVendor: Vendor = {
      id: String(vendors.length + 1),
      name: vendorData.vendorName,
      vendorId: vendorData.vendorId,
      leadTime: Number(vendorData.leadTime) || 0,
      uom: vendorData.uom,
      baseUnit: 'EA',
      conversionFactor: 100,
      price: Number(vendorData.pricePerUom) || 0,
      minOrderQty: vendorData.minOrderQty ? Number(vendorData.minOrderQty) : undefined,
      maxOrderQty: vendorData.maxOrderQty ? Number(vendorData.maxOrderQty) : undefined,
      orderMultiples: vendorData.multiples ? Number(vendorData.multiples) : undefined,
      deviation: vendorData.deviation ? Number(vendorData.deviation) : undefined,
      priority: vendorData.priority || vendors.length + 1,
      preferred: false,
      rating: 0,
      rules: vendorData.pricingRules || [],
      status: 'active'
    };
    setVendors([...vendors, newVendor]);
  };

  const handlePriorityChange = (vendorId: string, newPriority: number) => {
    setVendors(vendors.map(v => 
      v.id === vendorId ? { ...v, priority: newPriority } : v
    ).sort((a, b) => a.priority - b.priority));
  };

  const handleDeleteVendor = (vendorId: string) => {
    setVendors(vendors.filter(v => v.id !== vendorId));
  };

  const filteredVendors = vendors.filter(vendor => {
    const matchesSearch = vendor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         vendor.vendorId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPriority = filterPriority === 'all' || vendor.priority === Number(filterPriority);
    const matchesStatus = filterStatus === 'all' || vendor.status === filterStatus;
    return matchesSearch && matchesPriority && matchesStatus;
  });

  const getPriorityBadgeClass = (priority: number) => {
    if (priority === 1) return 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-700';
    if (priority === 2) return 'bg-slate-50 text-slate-600 border-slate-300 dark:bg-slate-950/30 dark:text-slate-400 dark:border-slate-700';
    if (priority === 3) return 'bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-700';
    return 'bg-secondary text-muted-foreground border-border';
  };

  const getPriorityLabel = (priority: number) => {
    if (priority === 1) return '1st';
    if (priority === 2) return '2nd';
    if (priority === 3) return '3rd';
    return `${priority}th`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="w-full"
    >
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="mb-4 gap-2 text-muted-foreground hover:text-foreground -ml-2"
        >
          <ArrowLeft size={14} />
          Back to Procurement
        </Button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground mb-2">Qualified Vendors</h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Manage approved vendors with pricing, lead times, and priority settings for procurement operations.
              Configure vendor relationships and establish ordering parameters.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2">
              <Download size={14} />
              Export
            </Button>
            <Button variant="outline" size="sm" className="gap-2">
              <Upload size={14} />
              Import
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="border border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Total Vendors</p>
                <p className="text-2xl font-semibold text-foreground">{vendors.length}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Building2 size={20} className="text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Preferred Vendors</p>
                <p className="text-2xl font-semibold text-foreground">
                  {vendors.filter(v => v.preferred).length}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center">
                <Star size={20} className="text-amber-600 dark:text-amber-400 fill-amber-600 dark:fill-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Avg Lead Time</p>
                <p className="text-2xl font-semibold text-foreground">
                  {Math.round(vendors.reduce((sum, v) => sum + v.leadTime, 0) / vendors.length)} days
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center">
                <Clock size={20} className="text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Active Vendors</p>
                <p className="text-2xl font-semibold text-foreground">
                  {vendors.filter(v => v.status === 'active').length}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
                <CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Card */}
      <Card className="rounded-[12px] border border-border shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between p-6 pb-4 border-b border-border">
          <div>
            <CardTitle className="text-lg font-semibold">Vendor List</CardTitle>
            <CardDescription className="text-sm text-muted-foreground mt-1">
              {filteredVendors.length} vendor{filteredVendors.length !== 1 ? 's' : ''} configured
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setAddVendorDialogOpen(true)}
            >
              <Plus size={14} />
              Add Vendor
            </Button>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm gap-2">
              <ShoppingCart size={14} />
              Create PO
            </Button>
          </div>
        </CardHeader>

        {/* Filters & View Toggle */}
        <div className="p-4 border-b border-border bg-background-base-third">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-1 max-w-2xl">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search vendors by name or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger className="w-[140px] h-9">
                  <Filter size={14} className="mr-2" />
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="1">1st Priority</SelectItem>
                  <SelectItem value="2">2nd Priority</SelectItem>
                  <SelectItem value="3">3rd Priority</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[120px] h-9">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1 bg-secondary/50 rounded-md p-1">
              <Button
                variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setViewMode('table')}
              >
                <LayoutList size={14} />
              </Button>
              <Button
                variant={viewMode === 'cards' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setViewMode('cards')}
              >
                <LayoutGrid size={14} />
              </Button>
            </div>
          </div>
        </div>

        {/* Table View */}
        {viewMode === 'table' && (
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-secondary/20">
                  <TableRow className="hover:bg-transparent border-b border-border">
                    <TableHead className="w-[50px] font-semibold text-muted-foreground text-xs uppercase tracking-wider pl-6"></TableHead>
                    <TableHead className="w-[100px] font-semibold text-muted-foreground text-xs uppercase tracking-wider">Priority</TableHead>
                    <TableHead className="w-[240px] font-semibold text-muted-foreground text-xs uppercase tracking-wider">Vendor Name</TableHead>
                    <TableHead className="w-[120px] font-semibold text-muted-foreground text-xs uppercase tracking-wider">Lead Time</TableHead>
                    <TableHead className="w-[100px] font-semibold text-muted-foreground text-xs uppercase tracking-wider">UOM</TableHead>
                    <TableHead className="w-[140px] font-semibold text-muted-foreground text-xs uppercase tracking-wider text-right">Price per UOM</TableHead>
                    <TableHead className="w-[110px] font-semibold text-muted-foreground text-xs uppercase tracking-wider text-right">Min Order Qty</TableHead>
                    <TableHead className="w-[110px] font-semibold text-muted-foreground text-xs uppercase tracking-wider text-right">Max Order Qty</TableHead>
                    <TableHead className="w-[100px] font-semibold text-muted-foreground text-xs uppercase tracking-wider text-right">Multiples</TableHead>
                    <TableHead className="w-[120px] font-semibold text-muted-foreground text-xs uppercase tracking-wider text-center">Deviation</TableHead>
                    <TableHead className="w-[200px] font-semibold text-muted-foreground text-xs uppercase tracking-wider">Pricing Rules</TableHead>
                    <TableHead className="w-[100px] font-semibold text-muted-foreground text-xs uppercase tracking-wider text-center">Rating</TableHead>
                    <TableHead className="w-[70px] pr-6"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVendors.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={13} className="text-center py-12">
                        <div className="flex flex-col items-center gap-2">
                          <AlertCircle className="h-8 w-8 text-muted-foreground/50" />
                          <p className="text-sm text-muted-foreground">No vendors found</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredVendors.map((vendor) => {
                      const appliedRules = PRICING_RULES.filter(rule => vendor.rules.includes(rule.id));

                      return (
                        <TableRow key={vendor.id} className="group hover:bg-muted/30 border-b border-border/50">
                          {/* Drag Handle */}
                          <TableCell className="pl-6">
                            <div className="flex items-center justify-center cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity">
                              <GripVertical size={14} className="text-muted-foreground" />
                            </div>
                          </TableCell>

                          {/* Priority Selector */}
                          <TableCell>
                            <Select
                              value={String(vendor.priority)}
                              onValueChange={(value) => handlePriorityChange(vendor.id, Number(value))}
                            >
                              <SelectTrigger className={cn(
                                'h-8 w-20 text-xs font-bold border-2',
                                getPriorityBadgeClass(vendor.priority)
                              )}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1">1st</SelectItem>
                                <SelectItem value="2">2nd</SelectItem>
                                <SelectItem value="3">3rd</SelectItem>
                                <SelectItem value="4">4th</SelectItem>
                                <SelectItem value="5">5th</SelectItem>
                                <SelectItem value="6">6th</SelectItem>
                                <SelectItem value="7">7th</SelectItem>
                                <SelectItem value="8">8th</SelectItem>
                                <SelectItem value="9">9th</SelectItem>
                                <SelectItem value="10">10th</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>

                          {/* Vendor Name */}
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm text-foreground">{vendor.name}</span>
                                {vendor.preferred && (
                                  <Badge variant="outline" className="text-[9px] text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800 px-1.5 py-0 h-4 gap-0.5">
                                    <Star size={8} className="fill-emerald-600 dark:fill-emerald-400" /> Preferred
                                  </Badge>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground">ID: {vendor.vendorId}</span>
                            </div>
                          </TableCell>

                          {/* Lead Time */}
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className={cn(
                                'h-6 w-6 rounded-full flex items-center justify-center',
                                vendor.leadTime <= 5 ? 'bg-emerald-50 dark:bg-emerald-950/30' :
                                vendor.leadTime <= 10 ? 'bg-blue-50 dark:bg-blue-950/30' :
                                'bg-amber-50 dark:bg-amber-950/30'
                              )}>
                                <Clock size={12} className={cn(
                                  vendor.leadTime <= 5 ? 'text-emerald-600 dark:text-emerald-400' :
                                  vendor.leadTime <= 10 ? 'text-blue-600 dark:text-blue-400' :
                                  'text-amber-600 dark:text-amber-400'
                                )} />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-xs font-medium text-foreground">{vendor.leadTime} days</span>
                                <span className="text-[10px] text-muted-foreground">
                                  {vendor.leadTime <= 5 ? 'Fast' : vendor.leadTime <= 10 ? 'Standard' : 'Extended'}
                                </span>
                              </div>
                            </div>
                          </TableCell>

                          {/* UOM */}
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <div className="h-6 w-6 rounded bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                                <Package size={12} className="text-primary" />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-xs font-medium text-foreground">{vendor.uom}</span>
                                <span className="text-[10px] text-muted-foreground">{vendor.conversionFactor} {vendor.baseUnit}</span>
                              </div>
                            </div>
                          </TableCell>

                          {/* Price per UOM */}
                          <TableCell className="text-right">
                            {/* The vendor's currency, the base equivalent underneath (spec 4.1). */}
                            <div className="flex flex-col items-end gap-0.5">
                              <span className="text-sm font-semibold text-foreground">
                                <Money value={vendor.price} currency={vendorCurrencyFor(vendor.location)} fx={vendorRate(vendorCurrencyFor(vendor.location))} />
                              </span>
                              <span className="text-[10px] text-muted-foreground">per {vendor.uom} · ≈ {formatMoney(priceInBase(vendor.price, vendorRate(vendorCurrencyFor(vendor.location)).rate), BASE_CURRENCY)}</span>
                            </div>
                          </TableCell>

                          {/* Min Order Qty */}
                          <TableCell className="text-right">
                            {vendor.minOrderQty ? (
                              <div className="flex flex-col items-end gap-0.5">
                                <span className="text-xs font-medium text-foreground">{vendor.minOrderQty}</span>
                                <span className="text-[10px] text-muted-foreground">{vendor.uom}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>

                          {/* Max Order Qty */}
                          <TableCell className="text-right">
                            {vendor.maxOrderQty ? (
                              <div className="flex flex-col items-end gap-0.5">
                                <span className="text-xs font-medium text-foreground">{vendor.maxOrderQty}</span>
                                <span className="text-[10px] text-muted-foreground">{vendor.uom}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>

                          {/* Multiples */}
                          <TableCell className="text-right">
                            {vendor.orderMultiples ? (
                              <div className="flex flex-col items-end gap-0.5">
                                <span className="text-xs font-medium text-foreground">{vendor.orderMultiples}</span>
                                <span className="text-[10px] text-muted-foreground">{vendor.uom}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>

                          {/* Accepted Deviation */}
                          <TableCell className="text-center">
                            {vendor.deviation ? (
                              <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-secondary/30 border border-border/50">
                                <Weight size={12} className={cn(
                                  vendor.deviation <= 2 ? 'text-emerald-600' :
                                  vendor.deviation <= 3 ? 'text-blue-600' :
                                  'text-amber-600'
                                )} />
                                <span className={cn(
                                  'text-xs font-medium',
                                  vendor.deviation <= 2 ? 'text-emerald-600' :
                                  vendor.deviation <= 3 ? 'text-blue-600' :
                                  'text-amber-600'
                                )}>
                                  ±{vendor.deviation}%
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>

                          {/* Pricing Rules */}
                          <TableCell>
                            {appliedRules.length > 0 ? (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button className="flex items-center gap-1.5 text-xs text-primary hover:underline cursor-pointer">
                                    <Tags size={12} />
                                    <span className="font-medium">{appliedRules.length} rule{appliedRules.length > 1 ? 's' : ''}</span>
                                    <ChevronDown size={10} />
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[320px] p-0" align="start">
                                  <div className="p-3 border-b border-border bg-secondary/20">
                                    <h4 className="font-semibold text-sm">Applied Pricing Rules</h4>
                                  </div>
                                  <div className="p-2">
                                    {appliedRules.map((rule) => (
                                      <div key={rule.id} className="p-2 rounded-md hover:bg-secondary/50 transition-colors mb-1 last:mb-0">
                                        <div className="flex items-start justify-between gap-2 mb-1">
                                          <span className="font-medium text-xs text-foreground">{rule.name}</span>
                                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">
                                            {rule.type}
                                          </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground mb-1">{rule.summary}</p>
                                        <div className="flex items-center justify-between">
                                          <span className="text-[10px] text-muted-foreground">{rule.details}</span>
                                          <span className="text-xs font-semibold text-primary">{rule.value}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            ) : (
                              <span className="text-xs text-muted-foreground">No rules</span>
                            )}
                          </TableCell>

                          {/* Rating */}
                          <TableCell className="text-center">
                            {vendor.rating > 0 ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <span className={cn(
                                  'text-xs font-bold',
                                  vendor.rating >= 4.5 ? 'text-emerald-600' :
                                  vendor.rating >= 4.0 ? 'text-blue-600' :
                                  'text-amber-600'
                                )}>
                                  {vendor.rating}
                                </span>
                                <div className="flex gap-0.5">
                                  {[1, 2, 3, 4, 5].map(star => (
                                    <Star
                                      key={star}
                                      size={10}
                                      className={cn(
                                        star <= Math.round(vendor.rating) ? 'fill-amber-400 text-amber-400' : 'fill-muted text-muted'
                                      )}
                                    />
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">Not rated</span>
                            )}
                          </TableCell>

                          {/* Actions */}
                          <TableCell className="pr-6">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                                  <MoreVertical size={14} />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-[180px]">
                                <DropdownMenuItem className="gap-2 cursor-pointer">
                                  <Eye size={14} />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem className="gap-2 cursor-pointer">
                                  <ShoppingCart size={14} />
                                  Create PO
                                </DropdownMenuItem>
                                <DropdownMenuItem className="gap-2 cursor-pointer">
                                  <Edit size={14} />
                                  Edit Association
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="gap-2 cursor-pointer">
                                  <Star size={14} />
                                  {vendor.preferred ? 'Remove Preferred' : 'Set as Preferred'}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="gap-2 text-destructive cursor-pointer"
                                  onClick={() => handleDeleteVendor(vendor.id)}
                                >
                                  <Trash2 size={14} />
                                  Remove Vendor
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
          </CardContent>
        )}

        {/* Card View */}
        {viewMode === 'cards' && (
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredVendors.length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center py-12">
                  <AlertCircle className="h-12 w-12 text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">No vendors found</p>
                </div>
              ) : (
                filteredVendors.map((vendor) => {
                  const appliedRules = PRICING_RULES.filter(rule => vendor.rules.includes(rule.id));

                  return (
                    <Card key={vendor.id} className="border border-border hover:shadow-md transition-shadow group">
                      <CardHeader className="p-4 pb-3 border-b border-border">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-sm text-foreground truncate">{vendor.name}</h3>
                              {vendor.preferred && (
                                <Star size={12} className="text-amber-600 dark:text-amber-400 fill-amber-600 dark:fill-amber-400 shrink-0" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">{vendor.vendorId}</p>
                          </div>
                          <Select
                            value={String(vendor.priority)}
                            onValueChange={(value) => handlePriorityChange(vendor.id, Number(value))}
                          >
                            <SelectTrigger className={cn(
                              'h-7 w-16 text-xs font-bold border-2',
                              getPriorityBadgeClass(vendor.priority)
                            )}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">1st</SelectItem>
                              <SelectItem value="2">2nd</SelectItem>
                              <SelectItem value="3">3rd</SelectItem>
                              <SelectItem value="4">4th</SelectItem>
                              <SelectItem value="5">5th</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {vendor.rating > 0 && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-foreground">{vendor.rating}</span>
                            <div className="flex gap-0.5">
                              {[1, 2, 3, 4, 5].map(star => (
                                <Star
                                  key={star}
                                  size={10}
                                  className={cn(
                                    star <= Math.round(vendor.rating) ? 'fill-amber-400 text-amber-400' : 'fill-muted text-muted'
                                  )}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </CardHeader>
                      <CardContent className="p-4 space-y-3">
                        {/* Lead Time */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Clock size={14} className="text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Lead Time</span>
                          </div>
                          <span className="text-xs font-semibold text-foreground">{vendor.leadTime} days</span>
                        </div>

                        {/* Price */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Package size={14} className="text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Price per {vendor.uom}</span>
                          </div>
                          <span className="text-xs font-semibold text-foreground">
                            {formatMoney(vendor.price, vendorCurrencyFor(vendor.location))}
                          </span>
                        </div>

                        {/* Min/Max Order */}
                        {(vendor.minOrderQty || vendor.maxOrderQty) && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Order Range</span>
                            <span className="text-xs font-medium text-foreground">
                              {vendor.minOrderQty || '—'} - {vendor.maxOrderQty || '—'} {vendor.uom}
                            </span>
                          </div>
                        )}

                        {/* Deviation */}
                        {vendor.deviation && (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Weight size={14} className="text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">Deviation</span>
                            </div>
                            <span className="text-xs font-semibold text-foreground">±{vendor.deviation}%</span>
                          </div>
                        )}

                        {/* Pricing Rules */}
                        {appliedRules.length > 0 && (
                          <div className="pt-2 border-t border-border">
                            <div className="flex items-center gap-1.5 mb-2">
                              <Tags size={12} className="text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">{appliedRules.length} Pricing Rule{appliedRules.length > 1 ? 's' : ''}</span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {appliedRules.map(rule => (
                                <Badge key={rule.id} variant="outline" className="text-[9px] px-1.5 py-0 h-4">
                                  {rule.name}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2 pt-2">
                          <Button variant="outline" size="sm" className="flex-1 h-8 text-xs gap-1">
                            <Eye size={12} />
                            View
                          </Button>
                          <Button size="sm" className="flex-1 h-8 text-xs gap-1">
                            <ShoppingCart size={12} />
                            Create PO
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="icon" className="h-8 w-8">
                                <MoreVertical size={14} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem className="gap-2 cursor-pointer">
                                <Edit size={14} />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="gap-2 text-destructive cursor-pointer"
                                onClick={() => handleDeleteVendor(vendor.id)}
                              >
                                <Trash2 size={14} />
                                Remove
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </CardContent>
        )}

        {/* Pagination */}
        <div className="border-t border-border p-3 flex items-center justify-between bg-card rounded-b-[12px]">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Records per page</span>
            <Select defaultValue="20">
              <SelectTrigger className="h-7 w-[60px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled>
              <ArrowLeft size={12} />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-xs font-medium">
              Prev
            </Button>
            <Button variant="secondary" className="h-7 w-7 p-0 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90">
              1
            </Button>
            <Button variant="ghost" className="h-7 w-7 p-0 text-xs font-medium">
              2
            </Button>
            <span className="px-1">...</span>
            <Button variant="ghost" className="h-7 w-7 p-0 text-xs font-medium">
              5
            </Button>
            <Button variant="ghost" className="h-7 w-7 p-0 text-xs font-medium">
              6
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-xs font-medium">
              Next
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <ArrowRight size={12} />
            </Button>
          </div>
        </div>
      </Card>

      {/* Add Vendor Dialog */}
      <AddQualifiedVendorDialog
        open={addVendorDialogOpen}
        onOpenChange={setAddVendorDialogOpen}
        onAdd={handleAddVendor}
        existingVendorCount={vendors.length}
      />
    </motion.div>
  );
}