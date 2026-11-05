// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, ChevronDown, Trash2, Truck, Factory, Box, ArrowRight, ShoppingCart, Wrench, Barcode, Layers, Check, Info, ShieldCheck, Tags, Star, Pencil, AlertTriangle,
} from 'lucide-react';
import { CfgField, RadioOption, CheckboxControl, ConfigEditContext } from './configAtoms';
import { cn } from '../../../lib/utils';
import { VisualHeader, CONFIG_GROUPS, ConfigCard, ConfigSelect, UOMS, CONFIG_TRACKED_FIELDS } from './CreateItemModal';
import { getItemFieldLocks } from './itemFieldLocks';
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

  // Pioneer 3-slot Ownership.
  // Resolution chain: owners (item override) → inheritedOwners (category default) → unassigned.
  owners: {
    materialHandling: string[];   // multi-user, fully wired
    purchasing: string | null;    // single-user, data only (Billy Bob wires later)
    finance: string | null;       // single-user, data only (Billy Bob wires later)
  };
  inheritedOwners?: {
    materialHandling?: string[];
    purchasing?: string;
    finance?: string;
  };

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
  /** Detail page starts read-only; the inline Edit button unlocks an edit
   *  session (draft + Save/Cancel) right here in the section. */
  readOnly?: boolean;
  /** Persisted item — feeds lifecycle field-locks while editing (edit mode only). */
  item?: any;
}

export default function ItemConfigurationMaster({
  config,
  onConfigChange,
  partNumber,
  variant = 'detail',
  readOnly = false,
  item,
}: ItemConfigurationMasterProps) {
  // Slice M.3: Item Definition is now visible in BOTH variants. `variant` prop kept
  // as a parameter for future use but no longer drives sidebar filtering.
  const visibleGroups = CONFIG_GROUPS;

  const [activeSectionId, setActiveSectionId] = useState<ConfigSectionType>(
    visibleGroups[0].id as ConfigSectionType
  );
  const [lotControlOpen, setLotControlOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');

  /* ── Inline edit lifecycle (detail page) ──────────────────────────────────
     The Configurations tab is read-only until the user clicks Edit. In edit mode
     every change accumulates in a local `draft`; nothing reaches the parent until
     Save (Cancel discards). `baseline` is the snapshot taken when the edit session
     opens — it drives the Category-parity diff: per-field Modified badges, sidebar
     section pills, the unsaved-changes banner, and field/section/all revert. */
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<AdvancedConfig>(config);
  const [baseline, setBaseline] = useState<AdvancedConfig>(config);

  // Mirror the draft to the committed config whenever we're NOT editing, so an
  // edit session always opens from the latest values.
  useEffect(() => {
    if (!editMode) setDraft(config);
  }, [config, editMode]);

  // If variant flips and active section is no longer visible, snap to first visible
  useEffect(() => {
    if (!visibleGroups.some((g: any) => g.id === activeSectionId)) {
      setActiveSectionId(visibleGroups[0].id as ConfigSectionType);
    }
  }, [variant]); // eslint-disable-line react-hooks/exhaustive-deps

  const enterEdit = () => { setBaseline(config); setDraft(config); setEditMode(true); };
  const cancelEdit = () => { setEditMode(false); setDraft(config); };
  const saveEdit = () => { onConfigChange(draft); setBaseline(draft); setEditMode(false); };

  // All field writes route to the draft via writeDraft, which doubles as the
  // SECOND touch point into editing: on the detail page the section is read-only
  // until the user clicks "Edit configuration" OR directly edits any control. The
  // first such write arms an edit session (snapshotting the baseline) AND applies
  // the change in one touch; guard on !editMode so later writes don't wipe the
  // diff. Lifecycle-locked controls block their own writes, so they never arm.
  const writeDraft = (updater: any) => {
    if (!editMode) enterEdit();
    setDraft(updater);
  };
  const handleConfigChange = (key: keyof AdvancedConfig, value: any) => {
    writeDraft((prev: any) => ({ ...prev, [key]: value }));
  };
  const setFormData = (fn: any) => {
    writeDraft((prev: any) => fn({ config: prev }).config);
  };
  const toggleOwner = (roleKey: string, userId: string) => {
    writeDraft((prev: any) => {
      const cur = (prev[roleKey] as string[]) || [];
      const next = cur.includes(userId) ? cur.filter((id: string) => id !== userId) : [...cur, userId];
      return { ...prev, [roleKey]: next };
    });
  };
  const togglePartner = (partnerId: string) => {
    writeDraft((prev: any) => {
      const cur = prev.specificPartners || [];
      const next = cur.includes(partnerId) ? cur.filter((id: string) => id !== partnerId) : [...cur, partnerId];
      return { ...prev, specificPartners: next };
    });
  };
  const updatePartnerRules = (partnerId: string, ruleIds: string[]) => {
    writeDraft((prev: any) => ({ ...prev, partnerRules: { ...(prev.partnerRules || {}), [partnerId]: ruleIds } }));
  };
  const toggleLocation = (type: 'inbound' | 'outbound', locationId: string) => {
    const key = type === 'inbound' ? 'inboundLocation' : 'outboundLocation';
    writeDraft((prev: any) => {
      const cur = prev[key] || [];
      const next = cur.includes(locationId) ? cur.filter((id: string) => id !== locationId) : [...cur, locationId];
      return { ...prev, [key]: next };
    });
  };

  /* ── Category-parity edit diff + revert (mirrors CreateItemModal) ── */
  const editConfigChanges = useMemo(() => {
    const changes: { key: string; label: string; section: string }[] = [];
    const live: any = draft;
    const base: any = baseline;
    for (const f of CONFIG_TRACKED_FIELDS) {
      if (f.conditional && !f.conditional(base) && !f.conditional(live)) continue;
      if (JSON.stringify(base?.[f.key]) !== JSON.stringify(live?.[f.key])) {
        changes.push({ key: f.key, label: f.label, section: f.section });
      }
    }
    return changes;
  }, [draft, baseline]);
  const modifiedKeys = useMemo(() => new Set(editConfigChanges.map(c => c.key)), [editConfigChanges]);
  const changesBySection = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of editConfigChanges) m.set(c.section, (m.get(c.section) ?? 0) + 1);
    return m;
  }, [editConfigChanges]);
  const totalConfigChanges = editConfigChanges.length;
  const sectionsTouched = changesBySection.size;
  const activeSectionChangeCount = changesBySection.get(activeSectionId) ?? 0;

  const revertConfigFields = (keys: string[]) => {
    if (keys.length === 0) return;
    setDraft((prev: any) => {
      const next: any = { ...prev };
      const base: any = baseline;
      for (const k of keys) next[k] = base?.[k];
      return next;
    });
  };
  const onRevertField = (key: string) => revertConfigFields([key]);
  const onRevertSection = (section: string) =>
    revertConfigFields(editConfigChanges.filter(c => c.section === section).map(c => c.key));
  const onRevertAll = () => revertConfigFields(editConfigChanges.map(c => c.key));

  // Lifecycle field-locks reflect the persisted item (both view and edit mode) so
  // the Edit-Item modal, so e.g. Base UOM / control type lock once txns exist.
  const fieldLocks = useMemo(() => (item ? getItemFieldLocks(item) : undefined), [item]);
  // Diff badges/locks are an edit-mode affordance only — expose an empty set in
  // view mode so a just-saved field never keeps a stale "Modified" badge.
  const configEditCtx = useMemo(
    () => ({ modifiedKeys: editMode ? modifiedKeys : new Set<string>(), onRevertField, readOnly: !editMode, fieldLocks }),
    [modifiedKeys, baseline, fieldLocks, editMode], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Detail page: controls stay interactive in read-only view so the first edit to
  // any control opens an edit session (see writeDraft); the "Edit configuration"
  // button remains the primary entry point.

  return (
    <div
      className="flex flex-col h-full bg-white"
      style={{ boxShadow: editMode ? 'inset 0 0 0 2px #0A77FF' : undefined, transition: 'box-shadow 0.15s ease', borderRadius: 'inherit' }}
    >
      {/* ── Edit header band (detail page) ──────────────────────────────────
          View: slim header with the Edit-configuration entry button.
          Edit: blue band (dot + Cancel / Save changes); the section stroke turns
          blue to signal you're editing. Hidden when the section isn't read-only
          (e.g. embedded fully-editable). */}
      {readOnly && (
        editMode ? (
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b shrink-0" style={{ backgroundColor: '#EDF4FF', borderColor: '#BFDBFE' }}>
            <div className="flex items-center gap-2 min-w-0">
              <span style={{ width: 8, height: 8, borderRadius: 9999, backgroundColor: '#0A77FF', flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#0A77FF' }}>Editing configuration</span>
              <span className="hidden sm:inline" style={{ fontSize: 12, color: '#1E40AF', opacity: 0.75 }}>Changes apply when you save.</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={cancelEdit}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-white text-[13px] text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer"
                style={{ fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEdit}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13px] bg-primary text-white hover:bg-[#0862D0] shadow-sm transition-colors cursor-pointer"
                style={{ fontWeight: 600 }}
              >
                Save changes
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border bg-white shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Configuration</span>
              <span className="hidden sm:inline" style={{ fontSize: 12, color: '#94A3B8' }}>Read only</span>
            </div>
            <button
              type="button"
              onClick={enterEdit}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13px] bg-primary text-white hover:bg-[#0862D0] shadow-sm transition-colors cursor-pointer"
              style={{ fontWeight: 600 }}
            >
              <Pencil className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Edit configuration</span>
            </button>
          </div>
        )
      )}

      <div className="flex flex-1 min-h-0">
        {/* Sidebar Navigation — Slice M.3: Category-literal styling, all 6 tabs */}
        <TooltipProvider delayDuration={300}>
        <div className="shrink-0 border-r border-border flex flex-col gap-1 p-3 overflow-y-auto bg-white" style={{ width: '250px' }}>
          {visibleGroups.map((group: any) => {
            const isActive = activeSectionId === group.id;
            const sectionChanges = editMode ? (changesBySection.get(group.id) ?? 0) : 0;
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
                  <div className="flex items-center gap-1.5">
                    <span style={{ fontSize: '13px', fontWeight: isActive ? 600 : 500, color: '#374151', lineHeight: 1.3 }}>{group.label}</span>
                    {sectionChanges > 0 && (
                      <span
                        title={`${sectionChanges} field${sectionChanges === 1 ? '' : 's'} modified`}
                        style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.2, color: '#92400E', backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 9999, padding: '1px 6px', lineHeight: 1.3 }}
                      >
                        Modified
                      </span>
                    )}
                  </div>
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
        <ConfigEditContext.Provider value={configEditCtx}>
        <div className="flex-1 overflow-y-auto bg-white">
          {/* Sticky section header: unsaved-changes banner (edit mode) + the active
              section's summary strip stay pinned while only the content scrolls. */}
          <div className="sticky top-0 z-20 bg-white">
          {/* Unsaved-changes banner (revert section / revert all) — edit mode only */}
          {editMode && totalConfigChanges > 0 && (
            <div className="flex items-center justify-between gap-3" style={{ padding: '8px 16px', backgroundColor: '#FFFBEB', borderBottom: '1px solid #FDE68A' }}>
              <div className="flex items-center gap-2 min-w-0">
                <AlertTriangle style={{ width: 14, height: 14, color: '#B45309', flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#92400E' }}>
                  {totalConfigChanges} unsaved change{totalConfigChanges === 1 ? '' : 's'}
                </span>
                <span style={{ fontSize: 12, color: '#A16207' }}>
                  across {sectionsTouched} section{sectionsTouched === 1 ? '' : 's'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {activeSectionChangeCount > 0 && (
                  <button
                    type="button"
                    onClick={() => onRevertSection(activeSectionId)}
                    className="inline-flex items-center gap-1 transition-colors"
                    style={{ height: 26, padding: '0 10px', borderRadius: 6, fontSize: 12, fontWeight: 500, color: '#92400E', backgroundColor: 'transparent', border: '1px solid #FCD34D', cursor: 'pointer' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#FEF3C7'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    Revert this section ({activeSectionChangeCount})
                  </button>
                )}
                <button
                  type="button"
                  onClick={onRevertAll}
                  className="inline-flex items-center gap-1 transition-colors"
                  style={{ height: 26, padding: '0 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, color: '#FFFFFF', backgroundColor: '#B45309', border: '1px solid #B45309', cursor: 'pointer' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#92400E'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#B45309'; }}
                >
                  Revert all
                </button>
              </div>
            </div>
          )}
          {/* Per-section summary strips — Slice M.3 (no GovernanceSummaryStrip, matches Category) */}
          {activeSectionId === 'definition' && <ItemDefinitionSummaryStrip config={draft} />}
          {activeSectionId === 'inventory' && <StockLogisticsSummaryStrip config={draft} />}
          {activeSectionId === 'procurement' && <ProcurementSummaryStrip config={draft} />}
          {activeSectionId === 'fulfillment' && <SellingSummaryStrip config={draft} />}
          {activeSectionId === 'materialHandling' && <CycleCountingSummaryStrip config={draft} />}
          </div>

          <div className="w-full px-8 py-8 pb-24 space-y-8">
            {/* Material Handling — Slice M.3 */}
            {activeSectionId === 'materialHandling' && (
              <MaterialHandlingSection config={draft} onConfigChange={handleConfigChange} />
            )}
            {/* Item Definition — unified shared component */}
            {activeSectionId === 'definition' && (
              <ItemDefinitionSection
                config={draft}
                onConfigChange={handleConfigChange}
                setFormData={setFormData}
              />
            )}
            {/* Stock & Logistics — unified shared component */}
            {activeSectionId === 'inventory' && (
              <StockLogisticsSection
                config={draft}
                onConfigChange={handleConfigChange}
                toggleLocation={toggleLocation}
              />
            )}
            {/* Procurement — unified shared component */}
            {activeSectionId === 'procurement' && (
              <ProcurementSection
                config={draft}
                onConfigChange={handleConfigChange}
                partNumber={partNumber}
              />
            )}
            {/* Selling — unified shared component */}
            {activeSectionId === 'fulfillment' && (
              <SellingSection
                config={draft}
                onConfigChange={handleConfigChange}
                togglePartner={togglePartner}
                updatePartnerRules={updatePartnerRules}
              />
            )}
            {/* Governance — Slice Pair C: unified Category-literal styling */}
            {activeSectionId === 'governance' && (
              <GovernanceSection config={draft} onConfigChange={handleConfigChange} />
            )}
          </div>
        </div>
        </ConfigEditContext.Provider>
      </div>
    </div>
  );
}

/* ItemDefinitionContent + ItemDefinitionSummaryStrip removed in unification slice.
   Definition body now lives in ItemDefinitionSection.tsx (single source of truth
   for both Create modal and Detail page render paths). */

