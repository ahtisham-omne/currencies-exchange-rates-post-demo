// @ts-nocheck
/**
 * ProcurementSection — Slice Pair B render-path unification.
 * Literal extraction of `ProcurementBody` from ConfigurationSections.tsx
 * (lines 743-832). No markup changes.
 *
 * Source of original Category lift: ConfigureCategory.tsx ProcurementSection
 * (lines 1343-1406). Items state binds: minPurchase, maxPurchase, multiples,
 * purchaseUom (fallback `uom`).
 */
import React, { useState } from 'react';
import { ShoppingCart } from 'lucide-react';
import { CfgField, StepperInput } from './configAtoms';
import { ConfigCard } from './CreateItemModal';
import { QualifiedVendorsTab } from './QualifiedVendorsTab';
import type { AdvancedConfig } from './ItemConfigurationMaster';

const FONT = 'Inter, system-ui, sans-serif';

interface ProcurementSectionProps {
  config: AdvancedConfig;
  onConfigChange: (key: keyof AdvancedConfig, value: any) => void;
  partNumber?: string;
}

export function ProcurementSection({ config, onConfigChange, partNumber }: ProcurementSectionProps) {
  const [activeSubTab, setActiveSubTab] = useState<'parameters' | 'vendors'>('parameters');

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Sub-tabs — Category literal segmented pill row */}
      <div className="flex gap-1 p-1" style={{ backgroundColor: 'var(--secondary)', borderRadius: 8, width: 'fit-content' }}>
        {[
          { id: 'parameters' as const, label: 'Purchase Parameters' },
          { id: 'vendors' as const, label: 'Qualified Vendors' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className="px-4 py-2 transition-all"
            style={{
              borderRadius: 6, fontSize: 13, fontWeight: 500, fontFamily: FONT,
              backgroundColor: activeSubTab === tab.id ? 'var(--card)' : 'transparent',
              color: activeSubTab === tab.id ? 'var(--foreground)' : '#71717A',
              boxShadow: activeSubTab === tab.id ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeSubTab === 'parameters' && (
        <div className="grid grid-cols-2 gap-6">
          <ConfigCard
            title="Purchase Parameters"
            icon={ShoppingCart}
            tooltip="Configure minimum and maximum order quantities, and order multiples for purchasing this item."
          >
            <div className="flex flex-col gap-5">
              {/* Purchase UOM — read-only, inherits from base UOM */}
              <CfgField label="Purchase UOM" hint="Inherited from base unit of measure">
                <div className="mt-2 px-3 flex items-center border border-border" style={{ height: 40, borderRadius: 'var(--radius)', fontSize: 13, fontFamily: FONT, color: 'var(--foreground)', cursor: 'default' }}>
                  <span style={{ fontWeight: 500 }}>{config.purchaseUom || config.uom || 'Each'}</span>
                </div>
              </CfgField>

              <div className="grid grid-cols-2 gap-4">
                <CfgField
                  label="Min Order Qty"
                  tooltip={"The smallest quantity that can be ordered in a single PO. Typically set based on vendor minimums. If the recommended quantity falls below this, the system rounds up to meet the minimum.\n\nExample: Min Order Qty set to 50 — even if only 20 units are needed, the PO recommendation will be for at least 50."}
                >
                  <StepperInput value={config.minPurchase} onChange={(v) => onConfigChange('minPurchase', v)} placeholder="0" />
                </CfgField>
                <CfgField
                  label="Max Order Qty"
                  tooltip={"The largest quantity that can be ordered in a single PO. The recommended order quantity will never exceed this value.\n\nExample: Max Order Qty set to 500 — even if stock is critically low, no single PO recommendation will exceed 500 units."}
                >
                  <StepperInput value={config.maxPurchase} onChange={(v) => onConfigChange('maxPurchase', v)} placeholder="0" />
                </CfgField>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <CfgField
                  label="Order Multiples"
                  hint="Case pack, pallet qty, etc."
                  tooltip={"Forces ordered quantities to align with fixed increments — typically driven by how a vendor packs or ships the item. The system rounds the recommended quantity up to the defined multiple, while keeping it within Min and Max Order Qty.\n\nExample: Order Multiple set to 12 (case pack) — if 20 units are needed, the PO recommendation becomes 24. If 50 are needed, it becomes 60."}
                >
                  <StepperInput value={config.multiples} onChange={(v) => onConfigChange('multiples', v)} placeholder="1" />
                </CfgField>
                <div />
              </div>
            </div>
          </ConfigCard>
        </div>
      )}

      {activeSubTab === 'vendors' && (
        <QualifiedVendorsTab partNumber={partNumber || 'New Item'} />
      )}
    </div>
  );
}
