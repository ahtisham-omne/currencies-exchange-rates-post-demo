// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, ChevronDown, Trash2, Truck, Factory, Box, ArrowRight, ShoppingCart, Wrench, Barcode, Layers, Check, Info, ShieldCheck, Tags, Star,
} from 'lucide-react';
import { CfgField, RadioOption, CheckboxControl } from './configAtoms';
import { cn } from '../../../lib/utils';
import { VisualHeader, CONFIG_GROUPS, ConfigCard, ConfigSelect, UOMS } from './CreateItemModal';
import { GovernanceSection } from './GovernanceSection';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Checkbox } from '../ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { ItemDefinitionSummaryStrip, StockLogisticsSummaryStrip, ProcurementSummaryStrip, SellingSummaryStrip, CycleCountingSummaryStrip } from './ConfigSummaryStrips';
import { MaterialHandlingSection } from './MaterialHandlingSection';
// Slice render-path unification — same shared sections used in CreateItemModal
import { ItemDefinitionSection } from './ItemDefinitionSection';
import { StockLogisticsSection } from './StockLogisticsSection';
import { ProcurementSection } from './ProcurementSection';
import { SellingSection } from './SellingSection';

// Re-export types
export interface AdvancedConfig {
  inventoryType: 'Stock' | 'Non-stock' | 'Asset';
  controlType: 'Serialized' | 'Non-serialized';
  acquisitionMethod: string[];
  uom: string;
  alternativeUnits?: Array<{ id: string; unit: string; conversionFactor: string }>;

  // Lot tracking
  lotControlEnabled?: boolean;
  lotIdSource?: 'system' | 'vendor';
  shelfLifeEnabled?: boolean;
  lotPrefix?: string;

  minStock: string;
  maxStock: string;
  stockUom: string;
  inboundLocation: string[];
  outboundLocation: string[];
  defaultInboundLocation?: string;
  defaultOutboundLocation?: string;

  minPurchase: string;
  maxPurchase: string;
  purchaseUom: string;
  multiples: string;

  cycleDeviation?: string;
  cycleRecurrence?: string;
  cycleApproval?: boolean;

  // Slice M.3 — Material Handling (Category parity)
  cycleTolerance?: string;
  approvers?: string[];
  scanLocation?: boolean;
  scanItem?: boolean;
  scanLot?: boolean;
  scanSerial?: boolean;
  primaryAcquisition?: 'Purchased' | 'Manufactured';

  engineeringOwner: string[];
  purchasingOwner: string[];
  schedulingOwner: string[];
  salesOwner: string[];
  arOwner: string[];

  sellingScope: 'all' | 'specific';
  specificPartners: string[];
  partnerRules?: Record<string, string[]>;
  pricing: Array<{ id: string; price: string; uom: string }>;

  vendorScope?: 'all' | 'specific';
  specificVendors?: string[];
  vendorRules?: Record<string, string[]>;
  vendorCosts?: Array<{ id: string; cost: string; uom: string }>;

  valuationMethod: 'fifo' | 'lifo' | 'wac' | 'specific';
}

export type ConfigSectionType = 'definition' | 'inventory' | 'procurement' | 'fulfillment' | 'governance' | 'materialHandling';
export type ConfigVariant = 'creation' | 'detail';

interface ItemConfigurationMasterProps {
  config: AdvancedConfig;
  onConfigChange: (updates: Partial<AdvancedConfig>) => void;
  partNumber?: string;
  /** "detail" shows all 5 tabs (default); "creation" hides Item Definition (it lives inline in Step 2 — see Slice C.2). */
  variant?: ConfigVariant;
}

export default function ItemConfigurationMaster({
  config,
  onConfigChange,
  partNumber,
  variant = 'detail',
}: ItemConfigurationMasterProps) {
  // Slice M.3: Item Definition is now visible in BOTH variants. `variant` prop kept
  // as a parameter for future use but no longer drives sidebar filtering.
  const visibleGroups = CONFIG_GROUPS;

  const [activeSectionId, setActiveSectionId] = useState<ConfigSectionType>(
    visibleGroups[0].id as ConfigSectionType
  );
  const [lotControlOpen, setLotControlOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [localConfig, setLocalConfig] = useState(config);

  // If variant flips and active section is no longer visible, snap to first visible
  useEffect(() => {
    if (!visibleGroups.some((g: any) => g.id === activeSectionId)) {
      setActiveSectionId(visibleGroups[0].id as ConfigSectionType);
    }
  }, [variant]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update local state when config prop changes
  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  // Helper to handle config changes
  const handleConfigChange = (key: keyof AdvancedConfig, value: any) => {
    const updates = { [key]: value };
    setLocalConfig(prev => ({ ...prev, ...updates }));
    onConfigChange(updates);
  };

  // setFormData helper to match CreateItemModal API
  const setFormData = (fn: any) => {
    setLocalConfig((prev: any) => {
      const next = fn({ config: prev });
      const newConfig = next.config;
      onConfigChange(newConfig);
      return newConfig;
    });
  };

  // Toggle owner
  const toggleOwner = (roleKey: string, userId: string) => {
    const currentOwners = config[roleKey as keyof AdvancedConfig] as string[] || [];
    const newOwners = currentOwners.includes(userId)
      ? currentOwners.filter(id => id !== userId)
      : [...currentOwners, userId];
    handleConfigChange(roleKey as keyof AdvancedConfig, newOwners);
  };

  // Toggle partner
  const togglePartner = (partnerId: string) => {
    const current = config.specificPartners || [];
    const updated = current.includes(partnerId)
      ? current.filter(id => id !== partnerId)
      : [...current, partnerId];
    handleConfigChange('specificPartners', updated);
  };

  // Update per-partner rule list (mirrors CreateItemModal helper)
  const updatePartnerRules = (partnerId: string, ruleIds: string[]) => {
    const next = { ...(config.partnerRules || {}), [partnerId]: ruleIds };
    handleConfigChange('partnerRules', next);
  };

  // Toggle location
  const toggleLocation = (type: 'inbound' | 'outbound', locationId: string) => {
    const key = type === 'inbound' ? 'inboundLocation' : 'outboundLocation';
    const current = config[key] || [];
    const updated = current.includes(locationId)
      ? current.filter(id => id !== locationId)
      : [...current, locationId];
    handleConfigChange(key, updated);
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex h-full">
        {/* Sidebar Navigation — Slice M.3: Category-literal styling, all 6 tabs */}
        <TooltipProvider delayDuration={300}>
        <div className="shrink-0 border-r border-border flex flex-col gap-1 p-3 overflow-y-auto bg-white" style={{ width: '250px' }}>
          {visibleGroups.map((group: any) => {
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
          {activeSectionId === 'definition' && <ItemDefinitionSummaryStrip config={config} />}
          {activeSectionId === 'inventory' && <StockLogisticsSummaryStrip config={config} />}
          {activeSectionId === 'procurement' && <ProcurementSummaryStrip config={config} />}
          {activeSectionId === 'fulfillment' && <SellingSummaryStrip config={config} />}
          {activeSectionId === 'materialHandling' && <CycleCountingSummaryStrip config={config} />}

          <div className="max-w-4xl mx-auto px-8 py-8 pb-24 space-y-8">
            {/* Material Handling — Slice M.3 */}
            {activeSectionId === 'materialHandling' && (
              <MaterialHandlingSection config={config} onConfigChange={handleConfigChange} />
            )}
            {/* Item Definition — unified shared component */}
            {activeSectionId === 'definition' && (
              <ItemDefinitionSection
                config={config}
                onConfigChange={handleConfigChange}
                setFormData={setFormData}
              />
            )}
            {/* Stock & Logistics — unified shared component */}
            {activeSectionId === 'inventory' && (
              <StockLogisticsSection
                config={config}
                onConfigChange={handleConfigChange}
                toggleLocation={toggleLocation}
              />
            )}
            {/* Procurement — unified shared component */}
            {activeSectionId === 'procurement' && (
              <ProcurementSection
                config={config}
                onConfigChange={handleConfigChange}
                partNumber={partNumber}
              />
            )}
            {/* Selling — unified shared component */}
            {activeSectionId === 'fulfillment' && (
              <SellingSection
                config={config}
                onConfigChange={handleConfigChange}
                togglePartner={togglePartner}
                updatePartnerRules={updatePartnerRules}
              />
            )}
            {/* Governance — Slice Pair C: unified Category-literal styling */}
            {activeSectionId === 'governance' && (
              <GovernanceSection config={config} onConfigChange={handleConfigChange} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ItemDefinitionContent + ItemDefinitionSummaryStrip removed in unification slice.
   Definition body now lives in ItemDefinitionSection.tsx (single source of truth
   for both Create modal and Detail page render paths). */

