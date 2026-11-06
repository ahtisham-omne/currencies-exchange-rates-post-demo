/**
 * Create New Pricing Rule Modal — two-step wizard ported from Partner
 * Management's `PricingRulesTab.tsx` ~3087.
 *
 * Step 1 — Rule Setup:
 *   - Pricing Rule Type (Discount / Premium radio cards)
 *   - Basis toggle (Volume-Based / Value-Based)
 *   - Pricing Rule Details: Name, Description, Limit Rule to Date Range
 *   - Tiers list with Discount Rate (% / $), optional Order Value Limits,
 *     Add Tier
 *
 * Step 2 — Items & Attachments:
 *   - Items / Categories pickers + Attachments dropzone (placeholder UI;
 *     Partner has rich pickers that we stub here for the visual baseline).
 *
 * On Save, the modal calls `onSave` with a normalised draft so the host
 * (configurator / quote-level manager) can append it to the user's custom
 * rule list.
 */
import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  X, Maximize2, Minimize2, Info, ChevronRight, Plus, Trash2,
  TrendingDown, TrendingUp, Calendar, Package, Layers, Paperclip,
  ArrowLeft, Check, FileText,
} from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "../ui/tooltip";
import { TitledSection } from "./TitledSection";
import type {
  PricingRulePreset,
  PricingRuleBasis,
  PricingRuleTier,
} from "./pricingRulePresets";

export interface CreatePricingRuleDraft {
  name: string;
  description: string;
  category: "discount" | "premium";
  basis: PricingRuleBasis;
  validFrom?: string;
  validTo?: string;
  hasDateLimit: boolean;
  tiers: PricingRuleTier[];
  /** Scope: which side of the deal this rule fires on. */
  scope: "vendor" | "customer";
}

interface CreatePricingRuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (draft: CreatePricingRuleDraft) => void;
  /** When set, opens the wizard pre-filled with this preset's data — used by
   *  the "Duplicate as Custom" flow to seed a new rule from an existing one. */
  prefill?: PricingRulePreset;
  /** Side of the deal: drives the small pill in the title row. Defaults to
   *  "customer" since Quote rules apply to customer–item pairs. */
  scope?: "vendor" | "customer";
}

interface DraftTier {
  discount: string;
  amountType: "%" | "$";
  qtyLimits: boolean;
  minQty: string;
  maxQty: string;
}

function makeEmptyTier(): DraftTier {
  return { discount: "", amountType: "%", qtyLimits: false, minQty: "", maxQty: "" };
}

function tierFromPreset(t: PricingRuleTier): DraftTier {
  // Best-effort parse of a preset tier ("$1,000" / "100 EA" / "10%").
  const stripPct = t.discount.replace("%", "").trim();
  const amountType: "%" | "$" = t.discount.includes("%") ? "%" : "$";
  return {
    discount: stripPct.replace(/[^0-9.]/g, ""),
    amountType,
    qtyLimits: true,
    minQty: t.minValue,
    maxQty: t.maxValue,
  };
}

export function CreatePricingRuleModal({
  isOpen,
  onClose,
  onSave,
  prefill,
  scope = "customer",
}: CreatePricingRuleModalProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  // ── Form state ──
  const [category, setCategory] = useState<"discount" | "premium">("discount");
  const [basis, setBasis] = useState<PricingRuleBasis>("value");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [hasDateLimit, setHasDateLimit] = useState(false);
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");
  const [tiers, setTiers] = useState<DraftTier[]>([makeEmptyTier()]);

  // Reset when opened or prefill changes
  useEffect(() => {
    if (!isOpen) return;
    if (prefill) {
      setCategory(prefill.category);
      setBasis(prefill.basis);
      setName(`${prefill.name} (Copy)`);
      setDescription(prefill.description);
      setHasDateLimit(false);
      setTiers(prefill.tiers.map(tierFromPreset));
    } else {
      setCategory("discount");
      setBasis("value");
      setName("");
      setDescription("");
      setHasDateLimit(false);
      setValidFrom("");
      setValidTo("");
      setTiers([makeEmptyTier()]);
    }
    setStep(1);
  }, [isOpen, prefill]);

  // Body scroll lock + Esc to close
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); setFullscreen(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, onClose]);

  const isDis = category === "discount";
  const accent = isDis
    ? { color: "#047857", bg: "#ECFDF5", border: "#A7F3D0" }
    : { color: "#6D28D9", bg: "#F5F3FF", border: "#DDD6FE" };

  const canContinue = useMemo(() => name.trim().length > 0 && tiers.length > 0, [name, tiers]);

  const addTier = () => setTiers((prev) => [...prev, makeEmptyTier()]);
  const removeTier = (i: number) => setTiers((prev) => prev.filter((_, idx) => idx !== i));
  const patchTier = (i: number, patch: Partial<DraftTier>) =>
    setTiers((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));

  const handleSave = () => {
    const draft: CreatePricingRuleDraft = {
      name: name.trim(),
      description: description.trim(),
      category,
      basis,
      hasDateLimit,
      validFrom: hasDateLimit ? validFrom : undefined,
      validTo: hasDateLimit ? validTo : undefined,
      scope,
      tiers: tiers.map((t) => ({
        minValue: t.qtyLimits ? t.minQty : (basis === "value" ? "$0" : "1 EA"),
        maxValue: t.qtyLimits ? t.maxQty : (basis === "value" ? "∞" : "∞"),
        discount: t.amountType === "%" ? `${t.discount || 0}%` : `$${t.discount || 0}`,
      })),
    };
    onSave(draft);
  };

  if (!isOpen) return null;

  const overlay = (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{
        zIndex: 12200,
        backgroundColor: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(2px)",
        animation: "modal-overlay-in 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards",
      }}
      onClick={() => { onClose(); setFullscreen(false); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Create new pricing rule"
        onClick={(e) => e.stopPropagation()}
        className={`relative bg-white flex flex-col overflow-hidden shadow-2xl transition-[max-width,max-height,border-radius] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          fullscreen
            ? "fixed inset-0 max-w-full max-h-full rounded-none border-0"
            : "rounded-2xl border border-border w-[calc(100%-2rem)] sm:w-[840px] max-h-[90vh]"
        }`}
        style={{
          animation: "modal-pop-center 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        }}
      >
        <TooltipProvider delayDuration={200}>
          {/* Header */}
          <div className="shrink-0 px-5 pt-4 pb-3 border-b border-border">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-[15px] text-foreground" style={{ fontWeight: 700 }}>Create New Pricing Rule</h2>
                  <span className="inline-flex items-center gap-1 text-[10.5px] px-1.5 py-0.5 rounded-md text-slate-600 bg-slate-50 border border-border" style={{ fontWeight: 500 }}>
                    <Layers className="w-3 h-3" />
                    {scope === "vendor" ? "Vendor" : "Customer"} Pricing Rule
                  </span>
                </div>
                <p className="text-[12px] text-slate-400 mt-0.5">Configure the type, tiers, and assign items for the new rule.</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setFullscreen((f) => !f)}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-white text-[12px] text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer"
                  style={{ fontWeight: 500 }}
                >
                  {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">{fullscreen ? "Exit full view" : "Full view"}</span>
                </button>
                <button
                  onClick={() => { onClose(); setFullscreen(false); }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-3">
              <StepPill index={1} label="Rule Setup" active={step === 1} done={step === 2} onClick={() => setStep(1)} />
              <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
              <StepPill index={2} label="Items & Attachments" active={step === 2} done={false} onClick={() => canContinue && setStep(2)} />
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 bg-[#FAFBFC]">
            {step === 1 ? (
              <Step1
                category={category}
                setCategory={setCategory}
                basis={basis}
                setBasis={setBasis}
                name={name}
                setName={setName}
                description={description}
                setDescription={setDescription}
                hasDateLimit={hasDateLimit}
                setHasDateLimit={setHasDateLimit}
                validFrom={validFrom}
                setValidFrom={setValidFrom}
                validTo={validTo}
                setValidTo={setValidTo}
                tiers={tiers}
                addTier={addTier}
                removeTier={removeTier}
                patchTier={patchTier}
                accent={accent}
              />
            ) : (
              <Step2 isDis={isDis} />
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 px-5 py-3 border-t border-border flex items-center justify-end gap-2 bg-white">
            {step === 2 && (
              <button
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-border bg-white text-[13px] text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer mr-auto"
                style={{ fontWeight: 500 }}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </button>
            )}
            <button
              onClick={() => { onClose(); setFullscreen(false); }}
              className="inline-flex items-center justify-center h-9 px-4 rounded-lg border border-border bg-white text-[13px] text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer"
              style={{ fontWeight: 500 }}
            >
              Cancel
            </button>
            {step === 1 ? (
              <button
                onClick={() => canContinue && setStep(2)}
                disabled={!canContinue}
                className={`inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-lg text-[13px] transition-colors ${
                  canContinue
                    ? "bg-primary text-white hover:bg-[#0862D0] cursor-pointer"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                }`}
                style={{ fontWeight: 600 }}
              >
                Continue
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={handleSave}
                className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-lg bg-primary text-white text-[13px] hover:bg-[#0862D0] transition-colors cursor-pointer"
                style={{ fontWeight: 600 }}
              >
                <Check className="w-3.5 h-3.5" />
                Save Rule
              </button>
            )}
          </div>
        </TooltipProvider>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}

/* ─── Step indicator pill ─── */

function StepPill({ index, label, active, done, onClick }: { index: number; label: string; active: boolean; done: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 transition-colors cursor-pointer"
      style={{ background: "none", border: "none", padding: 0 }}
    >
      <span
        className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10.5px]"
        style={{
          fontWeight: 700,
          backgroundColor: active ? "var(--primary)" : (done ? "#DBEAFE" : "#F1F5F9"),
          color: active ? "#FFFFFF" : (done ? "var(--primary)" : "#94A3B8"),
        }}
      >
        {done ? <Check className="w-3 h-3" strokeWidth={3} /> : index}
      </span>
      <span className="text-[12.5px]" style={{ fontWeight: active ? 600 : 500, color: active ? "var(--primary)" : "#475569" }}>
        {label}
      </span>
    </button>
  );
}

/* ─── Step 1 ─── */

function Step1({
  category, setCategory, basis, setBasis, name, setName, description, setDescription,
  hasDateLimit, setHasDateLimit, validFrom, setValidFrom, validTo, setValidTo,
  tiers, addTier, removeTier, patchTier, accent,
}: {
  category: "discount" | "premium";
  setCategory: (c: "discount" | "premium") => void;
  basis: PricingRuleBasis;
  setBasis: (b: PricingRuleBasis) => void;
  name: string;
  setName: (s: string) => void;
  description: string;
  setDescription: (s: string) => void;
  hasDateLimit: boolean;
  setHasDateLimit: (v: boolean) => void;
  validFrom: string;
  setValidFrom: (s: string) => void;
  validTo: string;
  setValidTo: (s: string) => void;
  tiers: DraftTier[];
  addTier: () => void;
  removeTier: (i: number) => void;
  patchTier: (i: number, patch: Partial<DraftTier>) => void;
  accent: { color: string; bg: string; border: string };
}) {
  const isDis = category === "discount";
  return (
    <div className="space-y-5 max-w-[760px] mx-auto">
      {/* Pricing Rule Type */}
      <TitledSection title="Pricing Rule Type" icon={isDis ? TrendingDown : TrendingUp}>
        <div className="grid grid-cols-2 gap-3">
          <TypeCard
            selected={isDis}
            color="#047857"
            bg="#ECFDF5"
            border="#A7F3D0"
            Icon={TrendingDown}
            title="Discount"
            subtitle="Lower price adjustment"
            onClick={() => setCategory("discount")}
          />
          <TypeCard
            selected={!isDis}
            color="#6D28D9"
            bg="#F5F3FF"
            border="#DDD6FE"
            Icon={TrendingUp}
            title="Premium"
            subtitle="Higher price adjustment"
            onClick={() => setCategory("premium")}
          />
        </div>

        {/* Basis toggle */}
        <div className="flex items-center gap-2 mt-3">
          <span className="text-[12px] text-slate-500" style={{ fontWeight: 500 }}>Basis:</span>
          <BasisToggle basis={basis} setBasis={setBasis} accent={accent} />
        </div>
      </TitledSection>

      {/* Pricing Rule Details */}
      <TitledSection title="Pricing Rule Details" icon={FileText}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <Field label={`${isDis ? "Discount" : "Premium"} Name`}>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={isDis ? "e.g. Volume Discount for Q4" : "e.g. Rush Order Premium"}
                className="w-full h-9 rounded-lg border border-border bg-white px-3 text-[13px] outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
              />
            </Field>
            <Field label="Description">
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 5000))}
                placeholder="Brief summary of pricing rule purpose or context."
                className="w-full h-9 rounded-lg border border-border bg-white px-3 text-[13px] outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
              />
            </Field>
          </div>
          <ToggleRow
            label="Limit Rule to Date Range"
            checked={hasDateLimit}
            onChange={setHasDateLimit}
          />
          {hasDateLimit && (
            <div className="grid grid-cols-2 gap-4 pt-1">
              <Field label="Valid From">
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    value={validFrom}
                    onChange={(e) => setValidFrom(e.target.value)}
                    placeholder="DD MMM YYYY"
                    className="w-full h-9 rounded-lg border border-border bg-white pl-9 pr-3 text-[13px] outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </Field>
              <Field label="Valid To">
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    value={validTo}
                    onChange={(e) => setValidTo(e.target.value)}
                    placeholder="DD MMM YYYY"
                    className="w-full h-9 rounded-lg border border-border bg-white pl-9 pr-3 text-[13px] outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </Field>
            </div>
          )}
        </div>
      </TitledSection>

      {/* Tiers */}
      <TitledSection
        title={`${isDis ? "Discount" : "Premium"} Tiers`}
        icon={Layers}
        trailing={
          <span className="inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 rounded-full text-[10px] tabular-nums" style={{ fontWeight: 600, color: accent.color, backgroundColor: accent.bg, border: `1px solid ${accent.border}` }}>
            {tiers.length}
          </span>
        }
        bodyClassName="px-0 pb-0"
      >
        <div className="divide-y divide-border overflow-hidden">
          {tiers.map((tier, i) => (
            <TierRow
              key={i}
              index={i}
              tier={tier}
              isDis={isDis}
              accent={accent}
              canRemove={tiers.length > 1}
              onRemove={() => removeTier(i)}
              onPatch={(patch) => patchTier(i, patch)}
            />
          ))}
          <button
            onClick={addTier}
            className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 text-[12px] text-primary hover:bg-blue-50 transition-colors cursor-pointer rounded-b-lg"
            style={{ fontWeight: 600 }}
          >
            <Plus className="w-3.5 h-3.5" />
            Add Tier
          </button>
        </div>
      </TitledSection>
    </div>
  );
}

/* ─── Step 2 (placeholder) ─── */

function Step2({ isDis }: { isDis: boolean }) {
  const [activeSubTab, setActiveSubTab] = useState<"items" | "categories" | "attachments">("items");
  return (
    <div className="space-y-4 max-w-[760px] mx-auto">
      <div className="flex items-center gap-1 border-b border-border">
        {([
          { key: "items" as const, label: "Items", Icon: Package },
          { key: "categories" as const, label: "Categories", Icon: Layers },
          { key: "attachments" as const, label: "Attachments", Icon: Paperclip },
        ]).map((t) => {
          const active = activeSubTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveSubTab(t.key)}
              className="relative inline-flex items-center gap-1.5 px-3 py-2 text-[12px] cursor-pointer"
              style={{ fontWeight: active ? 600 : 500, color: active ? "var(--primary)" : "#64748B" }}
            >
              <t.Icon className="w-3.5 h-3.5" />
              {t.label}
              {active && (
                <span className="absolute bottom-0 left-2 right-2" style={{ height: 2, backgroundColor: "var(--primary)", borderRadius: "1px 1px 0 0" }} />
              )}
            </button>
          );
        })}
      </div>
      <div className="bg-white border border-border rounded-xl px-4 py-12 text-center">
        <div className="w-12 h-12 rounded-xl bg-slate-50 border border-border flex items-center justify-center mx-auto mb-3">
          {activeSubTab === "items" ? <Package className="w-5 h-5 text-slate-400" /> : activeSubTab === "categories" ? <Layers className="w-5 h-5 text-slate-400" /> : <Paperclip className="w-5 h-5 text-slate-400" />}
        </div>
        <p className="text-[13px] text-slate-700 mb-1" style={{ fontWeight: 600 }}>
          Assign {activeSubTab === "items" ? "items" : activeSubTab === "categories" ? "categories" : "attachments"}
        </p>
        <p className="text-[11.5px] text-slate-500 max-w-[360px] mx-auto">
          Pick the {activeSubTab === "items" ? "specific SKUs" : activeSubTab === "categories" ? "item categories" : "supporting docs"} this {isDis ? "discount" : "premium"} should apply to.
          The Partner-side picker is being ported; you can save the rule now and assign later.
        </p>
      </div>
    </div>
  );
}

/* ─── Atoms ─── */

function SectionLabel({ label, tooltip }: { label: string; tooltip?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <h3 className="text-[13px] text-slate-700" style={{ fontWeight: 600 }}>{label}</h3>
      {tooltip && (
        <Tooltip>
          <TooltipTrigger asChild><span><Info className="w-3 h-3 text-slate-300 cursor-help" /></span></TooltipTrigger>
          <TooltipContent side="top" className="max-w-[260px] z-[12300]"><p className="text-xs">{tooltip}</p></TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

function Field({ label, children, rightSlot }: { label: string; children: React.ReactNode; rightSlot?: React.ReactNode }) {
  return (
    <label className="block">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>{label}</span>
        {rightSlot}
      </div>
      {children}
    </label>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className="relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors cursor-pointer"
        style={{ backgroundColor: checked ? "var(--primary)" : "#E2E8F0" }}
        aria-pressed={checked}
      >
        <span
          className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"
          style={{ transform: checked ? "translateX(18px)" : "translateX(2px)" }}
        />
      </button>
      <span className="text-[12.5px] text-slate-700" style={{ fontWeight: 500 }}>{label}</span>
    </div>
  );
}

function TypeCard({ selected, color, bg, border, Icon, title, subtitle, onClick }: {
  selected: boolean;
  color: string;
  bg: string;
  border: string;
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-white rounded-xl px-4 py-3.5 flex items-center gap-3 transition-colors cursor-pointer text-left"
      style={{
        border: `1px solid ${selected ? border : "hsl(var(--border))"}`,
        boxShadow: selected ? `0 0 0 2px ${color}1A, 0 1px 2px rgba(0,0,0,0.03)` : "0 1px 2px rgba(0,0,0,0.03)",
      }}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: selected ? bg : "#F8FAFC", color: selected ? color : "#94A3B8", border: `1px solid ${selected ? border : "hsl(var(--border))"}` }}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px]" style={{ fontWeight: 600, color: selected ? color : "#475569" }}>{title}</p>
        <p className="text-[11px] text-slate-500">{subtitle}</p>
      </div>
      <span
        className="w-5 h-5 rounded-full border flex items-center justify-center shrink-0"
        style={{ backgroundColor: selected ? color : "#FFFFFF", borderColor: selected ? color : "hsl(var(--border))" }}
      >
        {selected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
      </span>
    </button>
  );
}

function BasisToggle({ basis, setBasis, accent }: { basis: PricingRuleBasis; setBasis: (b: PricingRuleBasis) => void; accent: { color: string; bg: string; border: string } }) {
  return (
    <div className="inline-flex items-center rounded-lg bg-slate-50 border border-border/60 p-0.5">
      {([
        { key: "volume" as const, label: "Volume-Based", Icon: Layers },
        { key: "value" as const, label: "Value-Based", Icon: () => <span className="text-[11px]" style={{ fontWeight: 700 }}>$</span> },
      ]).map((opt) => {
        const active = basis === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => setBasis(opt.key)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] transition-all cursor-pointer ${active ? "shadow-sm" : "hover:bg-white/60"}`}
            style={{
              fontWeight: active ? 600 : 500,
              color: active ? accent.color : "#334155",
              backgroundColor: active ? accent.bg : undefined,
            }}
          >
            <opt.Icon className="w-3.5 h-3.5" />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function TierRow({ index, tier, isDis, accent, canRemove, onRemove, onPatch }: {
  index: number;
  tier: DraftTier;
  isDis: boolean;
  accent: { color: string; bg: string; border: string };
  canRemove: boolean;
  onRemove: () => void;
  onPatch: (patch: Partial<DraftTier>) => void;
}) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-3 mb-2.5">
        <span
          className="inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-md"
          style={{ fontWeight: 600, color: accent.color, backgroundColor: accent.bg, border: `1px solid ${accent.border}` }}
        >
          <span className="tabular-nums">{index + 1}</span>
          Tier {index + 1}
        </span>
        {canRemove && (
          <button
            onClick={onRemove}
            className="ml-auto inline-flex items-center justify-center w-6 h-6 rounded-md text-slate-400 hover:text-destructive hover:bg-destructive/5 transition-colors cursor-pointer"
            title="Remove tier"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>{isDis ? "Discount" : "Premium"} Rate</span>
            <div className="inline-flex items-center rounded-md bg-slate-50 border border-border/60 p-0.5">
              {(["%", "$"] as const).map((opt) => {
                const active = tier.amountType === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => onPatch({ amountType: opt })}
                    className={`inline-flex items-center justify-center w-6 h-5 rounded-sm text-[10.5px] cursor-pointer transition-colors ${active ? "shadow-sm" : "hover:bg-white"}`}
                    style={{ fontWeight: 600, color: active ? "var(--primary)" : "#64748B", backgroundColor: active ? "#FFFFFF" : "transparent" }}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="relative">
            <input
              type="number"
              value={tier.discount}
              onChange={(e) => onPatch({ discount: e.target.value })}
              placeholder="e.g. 50"
              className="w-full h-9 rounded-lg border border-border bg-white px-3 pr-8 text-[13px] tabular-nums outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400" style={{ fontWeight: 500 }}>
              {tier.amountType}
            </span>
          </div>
        </div>
        <div className="flex flex-col">
          <label className="inline-flex items-center gap-2 mb-2 cursor-pointer">
            <span
              onClick={() => onPatch({ qtyLimits: !tier.qtyLimits })}
              className="relative inline-flex h-4 w-4 shrink-0 rounded border bg-white transition-colors items-center justify-center"
              style={{ borderColor: tier.qtyLimits ? "var(--primary)" : "hsl(var(--border))", backgroundColor: tier.qtyLimits ? "var(--primary)" : "#FFFFFF" }}
            >
              {tier.qtyLimits && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
            </span>
            <span className="text-[12px] text-slate-700" style={{ fontWeight: 500 }}>Order Value Limits</span>
            <Tooltip>
              <TooltipTrigger asChild><span><Info className="w-3 h-3 text-slate-300 cursor-help" /></span></TooltipTrigger>
              <TooltipContent side="top" className="max-w-[240px] z-[12300]"><p className="text-xs">Restrict this tier to orders inside a min/max range. Leave off to apply to any order.</p></TooltipContent>
            </Tooltip>
          </label>
          {tier.qtyLimits && (
            <div className="grid grid-cols-2 gap-2">
              <input
                value={tier.minQty}
                onChange={(e) => onPatch({ minQty: e.target.value })}
                placeholder="Min"
                className="w-full h-9 rounded-lg border border-border bg-white px-3 text-[13px] tabular-nums outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
              />
              <input
                value={tier.maxQty}
                onChange={(e) => onPatch({ maxQty: e.target.value })}
                placeholder="Max"
                className="w-full h-9 rounded-lg border border-border bg-white px-3 text-[13px] tabular-nums outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
