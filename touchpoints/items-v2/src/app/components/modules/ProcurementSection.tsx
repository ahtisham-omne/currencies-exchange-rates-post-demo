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
import { ShoppingCart, Users, Plus, SlidersHorizontal, Bell } from 'lucide-react';
import { toast } from 'sonner';
import { CfgField, StepperInput, UnitDisplayCard } from './configAtoms';
import { ConfigCard } from './CreateItemModal';
import { QualifiedVendorsPanel } from './purchasing/QualifiedVendorsPanel';
import { AddQualifiedVendorModal, buildQualifiedVendor } from './purchasing/AddQualifiedVendorModal';
import { usePurchasing } from '../../context/PurchasingContext';
import type { QualifiedVendor } from '../../context/purchasing/types';
import type { AdvancedConfig } from './ItemConfigurationMaster';

const FONT = 'Inter, system-ui, sans-serif';

/* Inventory Shortage Notification Rules — single-select. Drives when the system
   recommends a Purchase Order to replenish this item. */
const SHORTAGE_RULES = [
  { id: 'demand', title: 'Recommend based on demand', desc: 'Triggers when stock is reserved for demand, e.g. a scheduled Work Order.' },
  { id: 'min', title: 'Recommend when stock hits min. threshold', desc: 'Triggers when available stock falls to or below the minimum threshold.' },
  { id: 'zero', title: 'Recommend if stock falls below zero', desc: 'Triggers when available stock falls below zero. Stock sitting at zero is normal, so it will not trigger.' },
  { id: 'off', title: 'Disable Purchase Order Recommendations', desc: 'No recommendations. Monitor shortages and replenish manually.' },
];

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
      <div className="inline-flex items-center rounded-lg p-0.5" style={{ backgroundColor: '#F1F5F9', width: 'fit-content' }}>
        {[
          { id: 'parameters' as const, label: 'Purchase Parameters', icon: SlidersHorizontal },
          { id: 'vendors' as const, label: 'Qualified Vendors', icon: Users },
        ].map(tab => {
          const Icon = tab.icon;
          const active = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubTab(tab.id)}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-md transition-all"
              style={{
                fontSize: 13, fontWeight: 600, fontFamily: FONT,
                backgroundColor: active ? '#FFFFFF' : 'transparent',
                color: active ? '#1E40AF' : '#71717A',
                boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)' : 'none',
                cursor: active ? 'default' : 'pointer',
              }}
            >
              <Icon className="w-3.5 h-3.5" style={{ color: active ? '#1E40AF' : '#71717A' }} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeSubTab === 'parameters' && (
        <div className="grid grid-cols-2 gap-6" style={{ alignItems: 'start' }}>
          <ConfigCard
            title="Purchase Parameters"
            icon={ShoppingCart}
            tooltip="Configure minimum and maximum order quantities, and order multiples for purchasing this item."
          >
            <div className="flex flex-col gap-5">
              {/* Purchase UOM — read-only, inherits from base UOM */}
              <CfgField
                label="Purchase UOM"
                tooltip="Automatically set to match your Base Unit of Measure. Change the base unit in Item Definition to update this value."
              >
                <UnitDisplayCard unit={config.purchaseUom || config.uom || 'Each'} />
              </CfgField>

              <div className="grid grid-cols-2 gap-4">
                <CfgField
                  label="Min Order Qty"
                  fieldKey="minPurchase"
                  tooltip={"The smallest quantity that can be ordered in a single PO. Typically set based on vendor minimums. If the recommended quantity falls below this, the system rounds up to meet the minimum.\n\nExample: Min Order Qty set to 50 — even if only 20 units are needed, the PO recommendation will be for at least 50."}
                >
                  <StepperInput value={config.minPurchase} onChange={(v) => onConfigChange('minPurchase', v)} placeholder="0" />
                </CfgField>
                <CfgField
                  label="Max Order Qty"
                  fieldKey="maxPurchase"
                  tooltip={"The largest quantity that can be ordered in a single PO. The recommended order quantity will never exceed this value.\n\nExample: Max Order Qty set to 500 — even if stock is critically low, no single PO recommendation will exceed 500 units."}
                >
                  <StepperInput value={config.maxPurchase} onChange={(v) => onConfigChange('maxPurchase', v)} placeholder="0" />
                </CfgField>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <CfgField
                  label="Order Multiples"
                  fieldKey="multiples"
                  hint="Case pack, pallet qty, etc."
                  tooltip={"Forces ordered quantities to align with fixed increments — typically driven by how a vendor packs or ships the item. The system rounds the recommended quantity up to the defined multiple, while keeping it within Min and Max Order Qty.\n\nExample: Order Multiple set to 12 (case pack) — if 20 units are needed, the PO recommendation becomes 24. If 50 are needed, it becomes 60."}
                >
                  <StepperInput value={config.multiples} onChange={(v) => onConfigChange('multiples', v)} placeholder="1" />
                </CfgField>
                <div />
              </div>
            </div>
          </ConfigCard>

          {/* Inventory Shortage Notification Rules — second card, mirrors the
              Material Handling two-card layout. Single-select radio cards. */}
          <ConfigCard
            title="PO Recommendation Rules"
            icon={Bell}
            tooltip="Choose the rule that governs when the system recommends a Purchase Order to restock this item. Only one rule applies at a time."
          >
            <div className="flex flex-col gap-3">
              <p style={{ fontSize: 12, color: '#64748B', fontFamily: FONT, lineHeight: 1.5 }}>
                Select the rule that determines when a Purchase Order is recommended to restock this item.
              </p>
              {SHORTAGE_RULES.map(opt => {
                const selected = (config.shortageRule || 'demand') === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onConfigChange('shortageRule', opt.id)}
                    className="w-full text-left flex items-start gap-3 rounded-lg border transition-colors"
                    style={{
                      padding: '12px 14px',
                      borderColor: selected ? '#0A77FF' : '#E2E8F0',
                      backgroundColor: selected ? 'rgba(10,119,255,0.04)' : '#FFFFFF',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => { if (!selected) (e.currentTarget as HTMLElement).style.borderColor = '#CBD5E1'; }}
                    onMouseLeave={(e) => { if (!selected) (e.currentTarget as HTMLElement).style.borderColor = '#E2E8F0'; }}
                  >
                    <span
                      className="shrink-0 flex items-center justify-center"
                      style={{ width: 16, height: 16, marginTop: 2, borderRadius: '50%', border: '1.5px solid', borderColor: selected ? '#0A77FF' : '#CBD5E1', transition: 'border-color 0.15s' }}
                    >
                      {selected && <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#0A77FF' }} />}
                    </span>
                    <div className="flex flex-col min-w-0">
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', fontFamily: FONT }}>{opt.title}</span>
                      <span style={{ fontSize: 12, color: '#64748B', fontFamily: FONT, lineHeight: 1.5, marginTop: 2 }}>{opt.desc}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </ConfigCard>
        </div>
      )}

      {activeSubTab === 'vendors' && (
        <CategoryStyleQualifiedVendors itemId={partNumber || 'new-item'} />
      )}
    </div>
  );
}

/* ── CategoryStyleQualifiedVendors — mirrors the Category project's
   `CategoryQualifiedVendors`: a `QualifiedVendorsPanel` rendered with a
   custom header slot (segmented "Qualified Vendors" pill on the left +
   "Add vendor" pill button on the right) plus the Add Vendor wizard. ── */
function CategoryStyleQualifiedVendors({ itemId }: { itemId: string }) {
  const { qvsByItem, deleteQV, reorderQVs } = usePurchasing();
  const qvs = qvsByItem[itemId] ?? qvsByItem['item-1'] ?? [];
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editVendor, setEditVendor] = useState<QualifiedVendor | null>(null);
  /* Edit-all: open the modal straight in the Configure master-detail so any
     existing vendor can be edited; a row's "Edit Configuration" focuses it. */
  const [editAllOpen, setEditAllOpen] = useState(false);
  const [editAllFocusId, setEditAllFocusId] = useState<string | null>(null);

  const num = (s) => { const n = parseFloat(s ?? ''); return Number.isFinite(n) ? n : 0; };
  const fieldsFromConfig = (config) => ({
    pricePerUnit: num(config.pricePerUnit),
    lastPOPricePerUnit: num(config.pricePerUnit),
    averagePricePerUnit: num(config.pricePerUnit),
    vendorUOM: config.uom || 'Each',
    acceptedDeviation: num(config.acceptedDeviationPct),
    lastPOLeadTime: num(config.leadTimeDays),
    averageLeadTime: num(config.leadTimeDays),
    minOrderQty: config.minOrderQty ? num(config.minOrderQty) : undefined,
    maxOrderQty: config.maxOrderQty ? num(config.maxOrderQty) : undefined,
    multiples: config.multiples ? num(config.multiples) : undefined,
    config,
  });

  const handleVendorsAdded = (
    entries: any[],
    existingPriority?: Record<string, { priority: number; isDefault: boolean; config?: any }>,
    order?: string[],
  ) => {
    const norm = entries.map((e) => (e && e.vendor ? e : { vendor: e, config: undefined }));
    let autoCursor = qvs.reduce((m, q) => Math.max(m, q.priority), 0);
    const built = norm.map(({ vendor, config }, i) => {
      const base = buildQualifiedVendor({ itemId, vendor, priority: 0, seq: i });
      const merged = config ? { ...base, ...fieldsFromConfig(config) } : base;
      const rank = config && config.priority && config.priority !== 'auto' ? parseInt(config.priority, 10) : NaN;
      return {
        ...merged,
        priority: Number.isFinite(rank) ? rank : (autoCursor += 1),
        isPrimary: !!(config && config.isDefault),
      };
    });
    const newDefault = built.some((q) => q.isPrimary);
    const combined = [
      // Apply the roster's re-ranked priority/default to existing vendors, plus
      // any inline-edited config; otherwise just clear a stale default if a new
      // vendor took it.
      ...qvs.map((q) => {
        const ep = existingPriority?.[q.id];
        if (ep) {
          const base = ep.config ? { ...q, ...fieldsFromConfig(ep.config) } : q;
          return { ...base, priority: ep.priority, isPrimary: ep.isDefault };
        }
        return newDefault ? { ...q, isPrimary: false } : q;
      }),
      ...built,
    ];
    // Honor the roster's within-tie order when the editAll modal supplies it.
    const ordered = order && order.length
      ? [...combined].sort((a, b) => {
          const ia = order.indexOf(a.id); const ib = order.indexOf(b.id);
          return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib);
        })
      : combined;
    reorderQVs(itemId, ordered);
    // Only announce added vendors; pure editAll config saves are toasted by the modal.
    if (norm.length > 0) toast.success(`${norm.length} vendor${norm.length === 1 ? '' : 's'} added as qualified`);
  };

  const handleRemoveVendor = (qv: QualifiedVendor) => {
    deleteQV(itemId, qv.id);
    toast.success(`${qv.vendorName} removed`);
  };

  /* Row → "Edit Configuration": open the full Edit Vendors modal focused on the
     clicked vendor (matches ItemPurchasingTab), so its config is front and center
     while every other vendor stays editable too. */
  const handleEditConfig = (qv: QualifiedVendor) => { setEditAllFocusId(qv.id); setEditAllOpen(true); };
  const handleEditSave = (qvId: string, config: any) => {
    const rank = config.priority && config.priority !== 'auto' ? parseInt(config.priority, 10) : NaN;
    const makeDefault = !!config.isDefault;
    const updated = qvs.map((q) => {
      if (q.id === qvId) {
        return {
          ...q,
          ...fieldsFromConfig(config),
          ...(Number.isFinite(rank) ? { priority: rank } : {}),
          isPrimary: makeDefault ? true : q.isPrimary,
        };
      }
      return makeDefault ? { ...q, isPrimary: false } : q;
    });
    reorderQVs(itemId, updated);
    setEditVendor(null);
  };

  const addVendorButton = (
    <button
      type="button"
      onClick={() => setWizardOpen(true)}
      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-[13px] cursor-pointer transition-colors"
      style={{ fontWeight: 600, backgroundColor: '#EFF6FF', borderColor: '#BFDBFE', color: '#1E40AF' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#DBEAFE'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#EFF6FF'; }}
    >
      <Plus className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">Add vendor</span>
    </button>
  );

  // With vendors: a flex column with a 600px floor so the table has room.
  // Empty: a fixed, modest height so the centered empty state fits a short modal
  // without scrolling. (The panel's column-selector drawer has tall intrinsic
  // content that would otherwise stretch the card to full height.)
  return (
    <div className="flex flex-col" style={qvs.length > 0 ? { minHeight: 600 } : { height: 360 }}>
      <QualifiedVendorsPanel itemId={itemId} qvs={qvs} toolbarRightSlot={addVendorButton} onEditConfig={handleEditConfig} onAddVendor={() => setWizardOpen(true)} />
      <AddQualifiedVendorModal
        open={wizardOpen || editVendor !== null || editAllOpen}
        onOpenChange={(o) => { if (!o) { setWizardOpen(false); setEditVendor(null); setEditAllOpen(false); setEditAllFocusId(null); } }}
        existingVendors={qvs}
        onAdd={handleVendorsAdded}
        onRemove={handleRemoveVendor}
        editMode={editVendor !== null}
        editVendor={editVendor}
        editAll={editAllOpen}
        editAllFocusVendorId={editAllFocusId}
        onEditSave={handleEditSave}
      />
    </div>
  );
}
