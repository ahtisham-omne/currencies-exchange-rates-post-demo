import React, { useState } from 'react';
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
  ArrowRight
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
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
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '../ui/hover-card';
import { AddQualifiedVendorDialog } from './AddQualifiedVendorDialog';
import { CurrencyFlag } from './CurrencyFlag';
import {
  BASE_CURRENCY,
  BASE_CURRENCY_NAME,
  RATE_LAST_SYNC_ISO,
  RATE_SOURCE,
  RATE_TYPE_HEX,
  RATE_TYPE_LABEL,
  formatPartnerAmount,
  formatRateUpdatedAs,
  getLibraryCurrency,
  rateToBase,
} from '../../data/rateConstants';

// Pricing Rules Data
const PRICING_RULES = [
    { id: 'pr-1', name: 'Standard Discount', type: 'Discount', summary: '15% off on orders of 100+ units', details: 'Min Qty: 100 EA', value: '15%' },
    { id: 'pr-2', name: 'Volume-Based Tier', type: 'Volume', summary: 'Tiered pricing structure', details: 'Max Tier: 12% Off', value: 'Variable' },
    { id: 'pr-3', name: 'Seasonal Promo Q3', type: 'Promotion', summary: 'Limited time offer (Jul-Sep)', details: 'Valid: Q3 2026', value: '10%' },
    { id: 'pr-4', name: 'Contracted Rate', type: 'Fixed Price', summary: 'Agreed fixed rate per unit', details: 'Price/Unit', value: '$12.50' },
    { id: 'pr-5', name: 'New Partner Intro', type: 'One-time', summary: 'Flat discount on first order', details: 'One-time use', value: '-$50.00' },
];

interface QualifiedVendorsTabProps {
  partNumber: string;
}

export function QualifiedVendorsTab({ partNumber }: QualifiedVendorsTabProps) {
  const [addVendorDialogOpen, setAddVendorDialogOpen] = useState(false);

  // State for managing vendors list
  const [vendors, setVendors] = useState([
    {
      name: 'Global Supplies Ltd.',
      sku: 'GS-5512-A',
      uom: 'Box',
      baseUnit: 'EA',
      conversionFactor: 100,
      price: 2450.00,
      currency: 'USD',
      minOrderQty: 5,
      maxOrderQty: 500,
      orderMultiples: 5,
      deviation: 2.5,
      priority: 1,
      preferred: true,
      rating: 4.8,
      rules: ['pr-4', 'pr-2'],
      leadTime: 7,
      vendorId: 'VND-01000'
    },
    {
      name: 'Acme Corp',
      sku: 'ACM-992-B1',
      uom: 'Case',
      baseUnit: 'EA',
      conversionFactor: 500,
      price: 11750.00,
      currency: 'USD',
      minOrderQty: 2,
      maxOrderQty: 200,
      orderMultiples: 2,
      deviation: 3.0,
      priority: 2,
      preferred: false,
      rating: 4.2,
      rules: ['pr-1'],
      leadTime: 10,
      vendorId: 'VND-01001'
    },
    {
      name: 'Tech Components Ltd',
      sku: 'TCL-2201',
      uom: 'Each',
      baseUnit: 'EA',
      conversionFactor: 1,
      price: 26.00,
      currency: 'EUR',
      minOrderQty: 100,
      maxOrderQty: 10000,
      orderMultiples: 50,
      deviation: 1.5,
      priority: 3,
      preferred: false,
      rating: 4.9,
      rules: ['pr-3'],
      leadTime: 5,
      vendorId: 'VND-01002'
    },
    {
      name: 'FastTrack Logistics',
      sku: 'FT-101-X',
      uom: 'Pallet',
      baseUnit: 'EA',
      conversionFactor: 2000,
      price: 52000.00,
      currency: 'USD',
      minOrderQty: 1,
      maxOrderQty: 50,
      orderMultiples: 1,
      deviation: 5.0,
      priority: 4,
      preferred: false,
      rating: 3.9,
      rules: [],
      leadTime: 14,
      vendorId: 'VND-01003'
    },
    {
      name: 'Precision Parts Inc.',
      sku: 'PPI-8844',
      uom: 'Box',
      baseUnit: 'EA',
      conversionFactor: 250,
      price: 6125.00,
      currency: 'GBP',
      minOrderQty: 4,
      maxOrderQty: 400,
      orderMultiples: 4,
      deviation: 2.0,
      priority: 5,
      preferred: false,
      rating: 4.5,
      rules: ['pr-5'],
      leadTime: 8,
      vendorId: 'VND-01004'
    },
  ]);

  const handleAddVendor = (vendorData: any) => {
    // Create new vendor object with all required fields
    const newVendor = {
      name: vendorData.vendorName,
      sku: 'N/A', // Since we removed SKU from the form
      uom: vendorData.uom,
      baseUnit: 'EA',
      conversionFactor: 1,
      price: parseFloat(vendorData.pricePerUom) || 0,
      currency: vendorData.currency || 'USD',
      minOrderQty: parseInt(vendorData.minOrderQty) || 0,
      maxOrderQty: parseInt(vendorData.maxOrderQty) || 0,
      orderMultiples: parseInt(vendorData.multiples) || 1,
      deviation: parseFloat(vendorData.deviation) || 2.5,
      priority: vendorData.priority || vendors.length + 1,
      preferred: false,
      rating: 0, // New vendors start with no rating
      rules: vendorData.pricingRules || [],
      leadTime: parseInt(vendorData.leadTime) || 0,
      vendorId: vendorData.vendorId
    };

    // Add the new vendor to the list
    setVendors([...vendors, newVendor]);
    setAddVendorDialogOpen(false);
  };

  return (
    <>
    <Card className="rounded-[12px] border border-border shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between p-6 pb-4 border-b border-border">
        <div>
          <CardTitle className="text-lg font-semibold">Qualified Vendors</CardTitle>
          <CardDescription className="text-sm text-muted-foreground mt-1">
            Approved vendors with pricing, priority, and deviation tolerances for {partNumber}.
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
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-secondary/20">
              <TableRow className="hover:bg-transparent border-b border-border">
                <TableHead className="w-[50px] font-semibold text-muted-foreground text-xs uppercase tracking-wider pl-6">Priority</TableHead>
                <TableHead className="w-[240px] font-semibold text-muted-foreground text-xs uppercase tracking-wider">Vendor Name</TableHead>
                <TableHead className="w-[100px] font-semibold text-muted-foreground text-xs uppercase tracking-wider text-center">Lead Time</TableHead>
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
              {vendors.map((vendor, i) => {
                const appliedRules = PRICING_RULES.filter(rule => vendor.rules.includes(rule.id));
                
                return (
                  <TableRow key={i} className="group hover:bg-muted/30 border-b border-border/50">
                    {/* Priority */}
                    <TableCell className="pl-6">
                      <div className="flex items-center justify-center">
                        <div className={cn(
                          "h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold border-2",
                          vendor.priority === 1 && "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-700",
                          vendor.priority === 2 && "bg-slate-50 text-slate-600 border-slate-300 dark:bg-slate-950/30 dark:text-slate-400 dark:border-slate-700",
                          vendor.priority === 3 && "bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-700",
                          vendor.priority > 3 && "bg-secondary text-muted-foreground border-border"
                        )}>
                          {vendor.priority}
                        </div>
                      </div>
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
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <Clock size={12} className="text-muted-foreground" />
                        <span className="text-xs font-medium text-foreground">{vendor.leadTime}</span>
                        <span className="text-[10px] text-muted-foreground">days</span>
                      </div>
                    </TableCell>
                    
                    {/* UOM (Read-only, linked to base unit) */}
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
                      {(() => {
                        const partner = getLibraryCurrency(vendor.currency);
                        const partnerRate = rateToBase(vendor.currency);
                        const showHover =
                          vendor.price > 0 &&
                          !!partner &&
                          partnerRate !== undefined &&
                          vendor.currency !== BASE_CURRENCY;
                        const partnerValue = partnerRate ? vendor.price / partnerRate : 0;
                        const partnerSymbol = partner?.symbol ?? vendor.currency;
                        const trigger = (
                          <span className="inline-flex flex-col items-end gap-0.5">
                            <span className="inline-flex items-baseline whitespace-nowrap tabular-nums text-sm font-semibold text-foreground">
                              <span
                                className={cn(
                                  'mr-1',
                                  showHover && 'border-b border-dotted border-slate-400 leading-none pb-[1px]',
                                )}
                              >
                                Rs
                              </span>
                              <span>
                                {vendor.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </span>
                            <span className="text-[10px] text-muted-foreground">per {vendor.uom}</span>
                          </span>
                        );
                        if (!showHover) return trigger;
                        const ariaLabel = `${BASE_CURRENCY_NAME} (${BASE_CURRENCY}) Rs ${vendor.price} per ${vendor.uom}`;
                        return (
                          <HoverCard openDelay={150} closeDelay={80}>
                            <HoverCardTrigger asChild>
                              <button
                                type="button"
                                aria-label={ariaLabel}
                                className="inline-flex cursor-help bg-transparent p-0 m-0 border-0 text-right"
                                style={{ font: 'inherit', color: 'inherit', letterSpacing: 'inherit', lineHeight: 'inherit' }}
                              >
                                {trigger}
                              </button>
                            </HoverCardTrigger>
                            <HoverCardContent
                              side="top"
                              align="end"
                              className="rounded-lg border border-slate-200 shadow-lg bg-white w-auto min-w-[260px] max-w-[320px] p-3"
                            >
                              {/* Header — flag + name + code + "— base currency" tail */}
                              <div className="flex items-baseline gap-2 text-[13px] font-semibold text-slate-900">
                                <span className="self-center">
                                  <CurrencyFlag country="pk" size={20} />
                                </span>
                                <span>
                                  {BASE_CURRENCY_NAME} ({BASE_CURRENCY})
                                </span>
                                <span className="text-slate-500 font-normal">— base currency</span>
                              </div>
                              <div className="border-t border-slate-100 my-2" />
                              {/* Partner-currency equivalent */}
                              <div className="text-[12px] text-slate-700">
                                Partner currency: {partnerSymbol} {formatPartnerAmount(partnerValue)} {vendor.currency}
                              </div>
                              {/* RateLine — current rate + type badge + source + updated */}
                              <div className="mt-1.5 px-2 py-1.5 rounded-md bg-slate-50 border border-slate-100">
                                <div className="text-[11px] text-slate-700 tabular-nums leading-4">
                                  <span className="text-slate-500" style={{ fontWeight: 500 }}>Current rate: </span>
                                  1 {vendor.currency} = Rs {formatPartnerAmount(partnerRate!)} {BASE_CURRENCY}
                                </div>
                                <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                                  <span
                                    className="inline-block w-1.5 h-1.5 rounded-full"
                                    style={{ backgroundColor: RATE_TYPE_HEX }}
                                  />
                                  <span style={{ color: RATE_TYPE_HEX, fontWeight: 600 }}>{RATE_TYPE_LABEL}</span>
                                  <span className="text-slate-400">· Source: {RATE_SOURCE}</span>
                                </div>
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  Updated as of {formatRateUpdatedAs(RATE_LAST_SYNC_ISO)}
                                </div>
                              </div>
                            </HoverCardContent>
                          </HoverCard>
                        );
                      })()}
                    </TableCell>
                    
                    {/* Min Order Qty */}
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="text-xs font-medium text-foreground">{vendor.minOrderQty}</span>
                        <span className="text-[10px] text-muted-foreground">{vendor.uom}</span>
                      </div>
                    </TableCell>
                    
                    {/* Max Order Qty */}
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="text-xs font-medium text-foreground">{vendor.maxOrderQty}</span>
                        <span className="text-[10px] text-muted-foreground">{vendor.uom}</span>
                      </div>
                    </TableCell>
                    
                    {/* Multiples */}
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="text-xs font-medium text-foreground">{vendor.orderMultiples}</span>
                        <span className="text-[10px] text-muted-foreground">{vendor.uom}</span>
                      </div>
                    </TableCell>
                    
                    {/* Accepted Deviation */}
                    <TableCell className="text-center">
                      <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-secondary/30 border border-border/50">
                        <Weight size={12} className={cn(
                          vendor.deviation <= 2 ? "text-emerald-600" : 
                          vendor.deviation <= 3 ? "text-blue-600" : 
                          "text-amber-600"
                        )} />
                        <span className={cn(
                          "text-xs font-medium",
                          vendor.deviation <= 2 ? "text-emerald-600" : 
                          vendor.deviation <= 3 ? "text-blue-600" : 
                          "text-amber-600"
                        )}>
                          ±{vendor.deviation}%
                        </span>
                      </div>
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
                            "text-xs font-bold",
                            vendor.rating >= 4.5 ? "text-emerald-600" : 
                            vendor.rating >= 4.0 ? "text-blue-600" : 
                            "text-amber-600"
                          )}>
                            {vendor.rating}
                          </span>
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map(star => (
                              <Star 
                                key={star} 
                                size={10} 
                                className={cn(
                                  star <= Math.round(vendor.rating) ? "fill-amber-400 text-amber-400" : "fill-muted text-muted"
                                )} 
                              />
                            ))}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">New</span>
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
                            Set as Preferred
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="gap-2 text-destructive cursor-pointer">
                            <Trash2 size={14} />
                            Remove Vendor
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      <div className="border-t border-border p-3 flex items-center justify-between bg-card rounded-b-[12px]">
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

    <AddQualifiedVendorDialog
      open={addVendorDialogOpen}
      onOpenChange={setAddVendorDialogOpen}
      onAdd={handleAddVendor}
      baseUom="Each"
      existingVendorCount={vendors.length}
    />
    </>
  );
}