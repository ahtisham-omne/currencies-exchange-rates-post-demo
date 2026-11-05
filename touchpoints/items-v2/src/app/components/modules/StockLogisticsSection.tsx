// @ts-nocheck
/**
 * StockLogisticsSection — Slice Pair A render-path unification.
 * Literal extraction of the `inventory` branch from ConfigurationSections.tsx
 * (lines 512-583). No markup changes — single source of truth for both render
 * paths (Create modal + Detail page).
 *
 * Source of original Category lift: ConfigureCategory.tsx StockLogisticsSection
 * (lines 1159-1240).
 */
import React from 'react';
import { AlertTriangle, Gauge, MapPin } from 'lucide-react';
import { CfgField, StepperInput, LocationMultiSelect, UnitDisplayCard } from './configAtoms';
import { ConfigCard, LOCATIONS } from './CreateItemModal';
import type { AdvancedConfig } from './ItemConfigurationMaster';

interface StockLogisticsSectionProps {
  config: AdvancedConfig;
  onConfigChange: (key: keyof AdvancedConfig, value: any) => void;
  toggleLocation: (type: 'inbound' | 'outbound', locationId: string) => void;
}

export function StockLogisticsSection({ config, onConfigChange, toggleLocation }: StockLogisticsSectionProps) {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Info banner — Category literal */}
      <div className="flex items-start gap-3 p-4" style={{ borderRadius: '8px', backgroundColor: 'rgba(234, 179, 8, 0.06)', border: '1px solid rgba(234, 179, 8, 0.2)' }}>
        <AlertTriangle style={{ width: 16, height: 16, color: '#D97706', flexShrink: 0, marginTop: 2 }} />
        <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--foreground)', lineHeight: 1.5 }}>
          Setting accurate min/max thresholds automates replenishment triggers and prevents stockouts.
        </span>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Inventory Stock Limits */}
        <ConfigCard title="Inventory Stock Limits" icon={Gauge} tooltip="Set minimum and maximum stock levels to trigger replenishment recommendations and overstock alerts for this item.">
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-4">
              <CfgField label="Min Level" hint="" fieldKey="minStock" tooltip="The minimum quantity that should be in stock at any time. When stock reaches this level, the system raises a replenishment recommendation.">
                <StepperInput value={config.minStock} onChange={(v: string) => onConfigChange('minStock', v)} placeholder="0" />
              </CfgField>
              <CfgField label="Max Level" hint="" fieldKey="maxStock" tooltip="The maximum quantity that should be held in stock. If stock exceeds this level, the system raises an overstock alert.">
                <StepperInput value={config.maxStock} onChange={(v: string) => onConfigChange('maxStock', v)} placeholder="0" />
              </CfgField>
            </div>

            {config.minStock && config.maxStock &&
             parseFloat(config.minStock) >= parseFloat(config.maxStock) && (
              <div className="flex items-start gap-2 p-2.5" style={{ borderRadius: 6, backgroundColor: 'hsl(var(--destructive) / 0.05)', border: '1px solid hsl(var(--destructive) / 0.2)' }}>
                <AlertTriangle style={{ width: 14, height: 14, color: 'var(--destructive)', flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 12, color: 'var(--foreground)', opacity: 0.7 }}>Min level must be less than max level</span>
              </div>
            )}

            <CfgField
              label="Stock Limit UOM"
              tooltip="Automatically set to match your Base Unit of Measure. Change the base unit in Item Definition to update this value."
            >
              <UnitDisplayCard unit={config.uom || 'Each'} />
            </CfgField>
            <span style={{ fontSize: 12, color: 'var(--foreground)', opacity: 0.45 }}>Define minimum and maximum stock levels to trigger alerts.</span>
          </div>
        </ConfigCard>

        {/* Inventory Location */}
        <ConfigCard title="Inventory Location" icon={MapPin} tooltip="Define the default warehouse locations for receiving (inbound) and dispatching (outbound) this item.">
          <div className="flex flex-col gap-6">
            <LocationMultiSelect
              label="Inbound Locations"
              tooltip="The warehouse location where items are placed when received against a Purchase Order. Setting a default ensures the receiving team knows where to put stock when a delivery arrives."
              placeholder="Select inbound locations..."
              options={LOCATIONS as any}
              selected={config.inboundLocation || []}
              defaultValue={config.defaultInboundLocation || ''}
              onToggle={(loc: string) => toggleLocation('inbound', loc)}
              onDefaultChange={(loc: string) => onConfigChange('defaultInboundLocation', loc)}
            />
            <LocationMultiSelect
              label="Outbound Locations"
              tooltip="The warehouse location where items are staged once packed and ready for dispatch. The logistics team collects from here to fulfill shipments."
              placeholder="Select outbound locations..."
              options={LOCATIONS as any}
              selected={config.outboundLocation || []}
              defaultValue={config.defaultOutboundLocation || ''}
              onToggle={(loc: string) => toggleLocation('outbound', loc)}
              onDefaultChange={(loc: string) => onConfigChange('defaultOutboundLocation', loc)}
            />
            <LocationMultiSelect
              label="Receiving Staging Locations"
              tooltip="Temporary staging area where received goods are placed before being put away to their final inbound location."
              dataOnly
              dataOnlyNote="Receiving staging is captured in this prototype but not yet wired to the receiving flow."
              placeholder="Select receiving staging locations..."
              options={LOCATIONS as any}
              selected={(config as any).receivingStagingLocation || []}
              defaultValue={(config as any).defaultReceivingStagingLocation || ''}
              onToggle={(loc: string) => {
                const current = (config as any).receivingStagingLocation || [];
                const updated = current.includes(loc) ? current.filter((l: string) => l !== loc) : [...current, loc];
                onConfigChange('receivingStagingLocation' as any, updated);
              }}
              onDefaultChange={(loc: string) => onConfigChange('defaultReceivingStagingLocation' as any, loc)}
            />
            <LocationMultiSelect
              label="Shipping Staging Locations"
              tooltip="Temporary staging area where outbound goods are gathered before being loaded for shipment."
              dataOnly
              dataOnlyNote="Shipping staging is captured in this prototype but not yet wired to the shipping flow."
              placeholder="Select shipping staging locations..."
              options={LOCATIONS as any}
              selected={(config as any).shippingStagingLocation || []}
              defaultValue={(config as any).defaultShippingStagingLocation || ''}
              onToggle={(loc: string) => {
                const current = (config as any).shippingStagingLocation || [];
                const updated = current.includes(loc) ? current.filter((l: string) => l !== loc) : [...current, loc];
                onConfigChange('shippingStagingLocation' as any, updated);
              }}
              onDefaultChange={(loc: string) => onConfigChange('defaultShippingStagingLocation' as any, loc)}
            />
          </div>
        </ConfigCard>
      </div>
    </div>
  );
}
