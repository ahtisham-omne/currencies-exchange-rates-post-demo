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
import { CfgField, StepperInput, LocationMultiSelect } from './configAtoms';
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
              <CfgField label="Min Level" hint="" tooltip="The minimum quantity that should be in stock at any time. When stock reaches this level, the system raises a replenishment recommendation.">
                <StepperInput value={config.minStock} onChange={(v: string) => onConfigChange('minStock', v)} placeholder="0" />
              </CfgField>
              <CfgField label="Max Level" hint="" tooltip="The maximum quantity that should be held in stock. If stock exceeds this level, the system raises an overstock alert.">
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

            <CfgField label="Stock Limit UOM" hint="Inherited from base unit of measure">
              <div className="mt-2 px-3 flex items-center border border-border" style={{ height: 40, borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--foreground)', cursor: 'default' }}>
                <span style={{ fontWeight: 500 }}>{config.uom || 'Each'}</span>
              </div>
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
          </div>
        </ConfigCard>
      </div>
    </div>
  );
}
