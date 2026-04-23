import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Search,
  Package,
  DollarSign,
  TrendingUp,
  Tags,
  Info,
  ChevronDown,
  Clock,
  Plus
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogHeader,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
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
import { Checkbox } from '../ui/checkbox';
import { Badge } from '../ui/badge';
import { cn } from '../../../lib/utils';
import { CurrencySymbol } from './CurrencySymbol';

// Mock vendor data
const MOCK_VENDORS = [
  { id: 'VND-01000', name: 'Global Supplies Ltd.', rating: 4.8 },
  { id: 'VND-01001', name: 'Acme Corp', rating: 4.5 },
  { id: 'VND-01002', name: 'Tech Components Ltd', rating: 4.9 },
  { id: 'VND-01003', name: 'FastTrack Logistics', rating: 4.3 },
  { id: 'VND-01004', name: 'Precision Parts Inc.', rating: 4.7 },
  { id: 'VND-01005', name: 'BulkBuy Wholesale', rating: 4.2 },
  { id: 'VND-01006', name: 'Quality Components Ltd', rating: 4.6 },
  { id: 'VND-01007', name: 'Metro Manufacturing Supply', rating: 4.4 },
];

// Pricing Rules Data
const PRICING_RULES = [
  { id: 'pr-1', name: 'Standard Discount', type: 'Discount', summary: '15% off on orders of 100+ units' },
  { id: 'pr-2', name: 'Volume-Based Tier', type: 'Volume', summary: 'Tiered pricing structure' },
  { id: 'pr-3', name: 'Seasonal Promo Q3', type: 'Promotion', summary: 'Limited time offer (Jul-Sep)' },
  { id: 'pr-4', name: 'Contracted Rate', type: 'Fixed Price', summary: 'Agreed fixed rate per unit' },
  { id: 'pr-5', name: 'New Partner Intro', type: 'One-time', summary: 'Flat discount on first order' },
];

interface VendorData {
  vendorId: string;
  vendorName: string;
  leadTime: string;
  uom: string;
  pricePerUom: string;
  minOrderQty: string;
  maxOrderQty: string;
  multiples: string;
  deviation: string;
  pricingRules: string[];
  priority?: number;
}

interface AddQualifiedVendorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (vendor: VendorData) => void;
  baseUom?: string;
  existingVendorCount?: number;
}

export function AddQualifiedVendorDialog({
  open,
  onOpenChange,
  onAdd,
  baseUom = 'Each',
  existingVendorCount = 0,
}: AddQualifiedVendorDialogProps) {
  const [step, setStep] = useState<'select' | 'configure'>('select');
  const [vendorSearch, setVendorSearch] = useState('');
  const [selectedVendor, setSelectedVendor] = useState<typeof MOCK_VENDORS[0] | null>(null);
  const [formData, setFormData] = useState<VendorData>({
    vendorId: '',
    vendorName: '',
    leadTime: '',
    uom: baseUom,
    pricePerUom: '',
    minOrderQty: '',
    maxOrderQty: '',
    multiples: '1',
    deviation: '2.5',
    pricingRules: [],
  });

  const handleVendorSelect = (vendor: typeof MOCK_VENDORS[0]) => {
    setSelectedVendor(vendor);
    setFormData({
      ...formData,
      vendorId: vendor.id,
      vendorName: vendor.name,
    });
    setStep('configure');
  };

  const handleFieldChange = (field: keyof VendorData, value: string | string[]) => {
    setFormData({ ...formData, [field]: value });
  };

  const togglePricingRule = (ruleId: string) => {
    const current = formData.pricingRules || [];
    if (current.includes(ruleId)) {
      handleFieldChange('pricingRules', current.filter(id => id !== ruleId));
    } else {
      handleFieldChange('pricingRules', [...current, ruleId]);
    }
  };

  const handleSubmit = () => {
    if (!formData.vendorId) {
      return;
    }
    onAdd({
      ...formData,
      priority: existingVendorCount + 1,
    });
    handleClose();
  };

  const handleClose = () => {
    setStep('select');
    setSelectedVendor(null);
    setVendorSearch('');
    setFormData({
      vendorId: '',
      vendorName: '',
      leadTime: '',
      uom: baseUom,
      pricePerUom: '',
      minOrderQty: '',
      maxOrderQty: '',
      multiples: '1',
      deviation: '2.5',
      pricingRules: [],
    });
    onOpenChange(false);
  };

  const filteredVendors = MOCK_VENDORS.filter(v =>
    v.name.toLowerCase().includes(vendorSearch.toLowerCase()) ||
    v.id.toLowerCase().includes(vendorSearch.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-8 pt-7 pb-5 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-semibold">
                {step === 'select' ? 'Select Vendor' : 'Configure Vendor Details'}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-2">
                {step === 'select'
                  ? 'Choose a vendor to add to the qualified vendor list'
                  : `Configure pricing and ordering parameters for ${selectedVendor?.name}`}
              </DialogDescription>
            </div>
            {step === 'configure' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep('select')}
                className="text-xs gap-1.5"
              >
                Change Vendor
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {step === 'select' ? (
            <div className="p-8">
              {/* Search */}
              <div className="mb-5">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search vendors by name or ID..."
                    value={vendorSearch}
                    onChange={(e) => setVendorSearch(e.target.value)}
                    className="pl-9 h-11 border-[1.5px] border-[var(--border)]"
                  />
                </div>
              </div>

              {/* Vendor List */}
              <div className="space-y-3">
                {filteredVendors.length > 0 ? (
                  filteredVendors.map((vendor) => (
                    <button
                      key={vendor.id}
                      onClick={() => handleVendorSelect(vendor)}
                      className="w-full flex items-center justify-between p-5 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 transition-all group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 text-primary flex items-center justify-center text-sm font-bold border border-primary/20">
                          {vendor.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="text-left">
                          <div className="font-medium text-sm text-foreground mb-0.5">{vendor.name}</div>
                          <div className="text-xs text-muted-foreground">{vendor.id}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          Rating: {vendor.rating}
                        </Badge>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="text-center py-16 text-muted-foreground text-sm">
                    No vendors found matching your search
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-8 space-y-8">
              {/* Vendor Info Banner */}
              <div className="flex items-center gap-4 p-5 rounded-lg border border-border bg-secondary/20">
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 text-primary flex items-center justify-center text-sm font-bold border border-primary/20 shrink-0">
                  {selectedVendor?.name.substring(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-base text-foreground">{selectedVendor?.name}</div>
                  <div className="text-sm text-muted-foreground mt-0.5">{selectedVendor?.id}</div>
                </div>
                <Badge variant="outline" className="text-xs shrink-0">
                  Rating: {selectedVendor?.rating}
                </Badge>
              </div>

              {/* Primary Information Section */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 pb-2 border-b border-border">
                  <Clock className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">Primary Information</h3>
                </div>

                {/* Lead Time - Most Important */}
                <div className="space-y-2.5">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    Lead Time
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 h-5">
                      Optional
                    </Badge>
                  </Label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      placeholder="0"
                      value={formData.leadTime}
                      onChange={(e) => handleFieldChange('leadTime', e.target.value)}
                      className="flex-1 h-11 text-base border-[1.5px] border-[var(--border)]"
                    />
                    <span className="text-sm text-muted-foreground font-medium min-w-[60px]">days</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Expected delivery time from order placement</p>
                </div>

                {/* Price Per UOM */}
                <div className="space-y-2.5">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    Price per UOM
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 h-5">
                      Optional
                    </Badge>
                  </Label>
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <CurrencySymbol
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-semibold"
                      />
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={formData.pricePerUom}
                        onChange={(e) => handleFieldChange('pricePerUom', e.target.value)}
                        className="pl-12 h-11 text-base border-[1.5px] border-[var(--border)]"
                      />
                    </div>
                    <div className="text-sm text-muted-foreground font-medium min-w-[60px]">per {formData.uom}</div>
                  </div>
                </div>

                {/* UOM (View Only) */}
                <div className="space-y-2.5">
                  <Label className="text-xs font-semibold uppercase text-muted-foreground">Purchase UOM</Label>
                  <div className="h-11 px-4 flex items-center rounded-md border border-border bg-muted/20 text-sm text-muted-foreground">
                    {formData.uom}
                  </div>
                  <p className="text-xs text-muted-foreground/70">Based on basic unit of measure</p>
                </div>
              </div>

              {/* Order Parameters Section */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 pb-2 border-b border-border">
                  <Package className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">Order Parameters</h3>
                </div>

                {/* Order Quantities */}
                <div className="grid grid-cols-3 gap-5">
                  <div className="space-y-2.5">
                    <Label className="text-sm font-semibold">Min Order Qty</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={formData.minOrderQty}
                      onChange={(e) => handleFieldChange('minOrderQty', e.target.value)}
                      className="h-11 text-base border-[1.5px] border-[var(--border)]"
                    />
                    <p className="text-xs text-muted-foreground">{formData.uom}</p>
                  </div>
                  <div className="space-y-2.5">
                    <Label className="text-sm font-semibold">Max Order Qty</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={formData.maxOrderQty}
                      onChange={(e) => handleFieldChange('maxOrderQty', e.target.value)}
                      className="h-11 text-base border-[1.5px] border-[var(--border)]"
                    />
                    <p className="text-xs text-muted-foreground">{formData.uom}</p>
                  </div>
                  <div className="space-y-2.5">
                    <Label className="text-sm font-semibold">Multiples</Label>
                    <Input
                      type="number"
                      placeholder="1"
                      value={formData.multiples}
                      onChange={(e) => handleFieldChange('multiples', e.target.value)}
                      className="h-11 text-base border-[1.5px] border-[var(--border)]"
                    />
                    <p className="text-xs text-muted-foreground">{formData.uom}</p>
                  </div>
                </div>

                {/* Accepted Deviation */}
                <div className="space-y-2.5">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    Accepted Deviation
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  </Label>
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="50.00"
                        value={formData.deviation}
                        onChange={(e) => handleFieldChange('deviation', e.target.value)}
                        className="pl-10 h-11 text-base border-[1.5px] border-[var(--border)]"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Maximum price variance allowed from quoted price
                  </p>
                </div>
              </div>

              {/* Advanced Options Section */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 pb-2 border-b border-border">
                  <Tags className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">Advanced Options</h3>
                </div>

                {/* Pricing Rules */}
                <div className="space-y-2.5">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    Pricing Rules
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 h-5">
                      Optional
                    </Badge>
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-between text-sm h-11"
                      >
                        <span className="text-muted-foreground">
                          {formData.pricingRules.length > 0
                            ? `${formData.pricingRules.length} rule${formData.pricingRules.length > 1 ? 's' : ''} selected`
                            : 'Select pricing rules'}
                        </span>
                        <ChevronDown className="h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[420px] p-0" align="start">
                      <div className="p-4 border-b border-border bg-secondary/20">
                        <h4 className="font-semibold text-sm">Available Pricing Rules</h4>
                      </div>
                      <div className="p-3 max-h-[280px] overflow-y-auto">
                        {PRICING_RULES.map((rule) => {
                          const isSelected = formData.pricingRules.includes(rule.id);
                          return (
                            <div
                              key={rule.id}
                              onClick={() => togglePricingRule(rule.id)}
                              className={cn(
                                'flex items-start gap-3 p-3 rounded-md hover:bg-secondary/50 cursor-pointer transition-colors mb-2 last:mb-0',
                                isSelected && 'bg-secondary/50'
                              )}
                            >
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => togglePricingRule(rule.id)}
                                className="mt-0.5"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <span className="font-medium text-xs text-foreground">
                                    {rule.name}
                                  </span>
                                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">
                                    {rule.type}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">{rule.summary}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </PopoverContent>
                  </Popover>
                  {formData.pricingRules.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {formData.pricingRules.map((ruleId) => {
                        const rule = PRICING_RULES.find((r) => r.id === ruleId);
                        if (!rule) return null;
                        return (
                          <Badge key={ruleId} variant="secondary" className="text-xs gap-1.5 py-1 px-2.5">
                            {rule.name}
                            <button
                              onClick={() => togglePricingRule(ruleId)}
                              className="ml-0.5 hover:text-destructive"
                            >
                              <X size={12} />
                            </button>
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Info Banner */}
              <div className="flex items-start gap-3 p-4 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-700 dark:text-blue-200">
                  This vendor will be assigned priority <strong>#{existingVendorCount + 1}</strong>. You can adjust
                  priorities later by reordering vendors in the table.
                </div>
              </div>
            </div>
          )}
        </div>

        {step === 'configure' && (
          <DialogFooter className="px-8 py-5 border-t border-border bg-secondary/10">
            <Button variant="outline" onClick={handleClose} className="h-10 px-5">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!formData.vendorId}
              className="gap-2 h-10 px-5"
            >
              <Plus size={14} />
              Add Vendor
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}