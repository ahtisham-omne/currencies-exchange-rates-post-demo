/**
 * Pricing Rule Detail Modal — read-only-by-default detail view of a pricing
 * rule preset. Ported from Partner Management's `PricingRuleDetailModal`
 * (`PricingRulesTab.tsx` ~1004). Captures the visible structure: title row
 * with type/basis/status/template pills + header actions; tabs row
 * (Overview / Items / Categories / Partners / Notes / Attachments / Recent
 * Activity); Overview body with the system-template notice, Pricing Rule
 * Type radio cards, Pricing Rule Details form, Tiers list, and a created-by
 * footer note. Footer carries the "Reviewing: <name>" + Duplicate button.
 *
 * System templates render the form in disabled state — the only mutating
 * action allowed is Duplicate (which spins up a custom rule pre-filled).
 */
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X, Maximize2, Minimize2, Pencil, Archive, CircleSlash, Lock,
  TrendingDown, TrendingUp, ChevronLeft, Copy, Info, Calendar,
  Package, Layers, Users, FileText, Paperclip, Clock,
} from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "../ui/tooltip";
import { TitledSection } from "./TitledSection";
import type { PricingRulePreset } from "./pricingRulePresets";

interface PricingRuleDetailModalProps {
  rule: PricingRulePreset | null;
  open: boolean;
  onClose: () => void;
  /** Duplicate the current rule as a new custom one. Caller spawns the
   *  CreatePricingRuleModal pre-filled. */
  onDuplicate?: (rule: PricingRulePreset) => void;
  /** For non-template rules: open the create modal in edit mode. */
  onEdit?: (rule: PricingRulePreset) => void;
  /** Disable / archive the rule (custom only). */
  onDisable?: (rule: PricingRulePreset) => void;
  /** "view" shows Edit/Archive/Disable header actions; "create" (opened from
   *  the library) shows no header actions — the modal is read-only. */
  mode?: "view" | "create";
}

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "items", label: "Items", icon: Package },
  { id: "categories", label: "Categories", icon: Layers },
  { id: "partners", label: "Partners", icon: Users },
  { id: "notes", label: "Notes", icon: FileText },
  { id: "attachments", label: "Attachments", icon: Paperclip },
  { id: "activity", label: "Recent Activity", icon: Clock },
] as const;

type TabId = typeof TABS[number]["id"];

export function PricingRuleDetailModal({
  rule,
  open,
  onClose,
  onDuplicate,
  onEdit,
  onDisable,
  mode = "view",
}: PricingRuleDetailModalProps) {
  const [tab, setTab] = useState<TabId>("overview");
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!open) return;
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
  }, [open, onClose]);

  // Reset tab + fullscreen when the rule changes (open-with-new-rule)
  useEffect(() => {
    if (open) setTab("overview");
  }, [open, rule?.id]);

  if (!open || !rule) return null;

  const isDis = rule.category === "discount";
  const isPreset = rule.isPreset !== false;
  const status: "Active" | "Inactive" = "Active"; // stub; presets are conceptually active
  const t0 = rule.tiers[0];

  // Type pill colors — Partner exact tokens.
  const pill = isDis
    ? { text: "#047857", bg: "#ECFDF5", border: "#D1FAE5" }
    : { text: "#6D28D9", bg: "#F5F3FF", border: "#EDE9FE" };

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
        aria-label={`Pricing rule details — ${rule.name}`}
        onClick={(e) => e.stopPropagation()}
        className={`relative bg-white flex flex-col overflow-hidden shadow-2xl transition-[max-width,max-height,border-radius] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          fullscreen
            ? "fixed inset-0 max-w-full max-h-full rounded-none border-0"
            : "rounded-2xl border border-border w-[calc(100%-2rem)] sm:w-[1000px] max-h-[88vh]"
        }`}
        style={{
          animation: "modal-pop-center 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        }}
      >
        <TooltipProvider delayDuration={200}>

          {/* Header */}
          <div className="shrink-0 px-4 sm:px-5 pt-4 pb-3 border-b border-border flex items-center gap-3">
            <button
              onClick={() => { onClose(); setFullscreen(false); }}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
              title="Back"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Hero icon — % chip in pill color */}
            <div
              className="shrink-0 flex flex-col items-center justify-center rounded-xl"
              style={{
                width: 44,
                height: 44,
                backgroundColor: pill.bg,
                border: `1px solid ${pill.border}`,
                color: pill.text,
              }}
            >
              {isDis ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
              <span className="text-[10px] tabular-nums leading-none mt-0.5" style={{ fontWeight: 700 }}>
                {t0?.discount ?? "—"}
              </span>
            </div>

            {/* Title block */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-[16px] text-slate-900 truncate" style={{ fontWeight: 700 }}>{rule.name}</h2>
                {/* Type pill */}
                <span
                  className="inline-flex items-center gap-1 text-[10.5px] px-1.5 py-0.5 rounded-md shrink-0"
                  style={{ fontWeight: 600, color: pill.text, backgroundColor: pill.bg, border: `1px solid ${pill.border}` }}
                >
                  {isDis ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                  {isDis ? "Discount" : "Premium"}
                </span>
                {/* Basis pill */}
                <span
                  className="inline-flex items-center text-[10.5px] px-1.5 py-0.5 rounded-md text-slate-600 bg-slate-50 border border-border shrink-0"
                  style={{ fontWeight: 500 }}
                >
                  {rule.basis === "value" ? "Value-Based" : "Volume-Based"}
                </span>
                {/* Status pill */}
                <span
                  className="inline-flex items-center text-[10.5px] px-2 py-0.5 rounded-full shrink-0"
                  style={{
                    fontWeight: 600,
                    color: status === "Active" ? "#047857" : "#92400E",
                    backgroundColor: status === "Active" ? "#F0FDF4" : "#FFFBEB",
                    border: `1px solid ${status === "Active" ? "#BBF7D0" : "#FDE68A"}`,
                  }}
                >
                  {status}
                </span>
                {/* Template / Custom badge */}
                {isPreset ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-[3px] rounded-md bg-muted border border-slate-300 text-[9px] text-slate-500 shrink-0" style={{ fontWeight: 600 }}>
                    <Lock className="w-2.5 h-2.5" /> TEMPLATE
                  </span>
                ) : (
                  <span className="inline-flex items-center px-1.5 py-[3px] rounded-md border border-slate-300 bg-white text-[9px] text-muted-foreground shrink-0" style={{ fontWeight: 600 }}>
                    CUSTOM
                  </span>
                )}
              </div>
              <p className="text-[12px] text-slate-500 mt-1 truncate">{rule.description}</p>
            </div>

            {/* Header actions — Apply removed: when opened from the library
                (mode === "create") the detail modal is read-only browsing,
                not an action surface. Apply / Deactivate happens on the
                library cards themselves and on the rule cards in the
                Pricing Rules Manage modal, not here. */}
            <div className="flex items-center gap-1.5 shrink-0">
              {mode !== "create" && (
                <>
                  <HeaderIconButton
                    label="Edit"
                    Icon={Pencil}
                    disabled={isPreset || !onEdit}
                    disabledHelp="System templates can't be edited. Duplicate first to create a custom version."
                    onClick={() => onEdit?.(rule)}
                  />
                  <HeaderIconButton
                    label="Archive"
                    Icon={Archive}
                    disabled={isPreset || !onDisable}
                    disabledHelp="System templates can't be archived because they ship with the software."
                    onClick={() => onDisable?.(rule)}
                  />
                  <HeaderIconButton
                    label={status === "Active" ? "Disable" : "Enable"}
                    Icon={CircleSlash}
                    disabled={false}
                    onClick={() => onDisable?.(rule)}
                    tone="warning"
                  />
                </>
              )}
              <button
                onClick={() => setFullscreen((f) => !f)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                title={fullscreen ? "Exit full view" : "Full view"}
              >
                {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button
                onClick={() => { onClose(); setFullscreen(false); }}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Tabs row */}
          <div className="shrink-0 flex items-center px-4 sm:px-5 border-b border-border overflow-x-auto">
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className="relative inline-flex items-center gap-1.5 px-3 py-2.5 text-[12px] transition-colors cursor-pointer shrink-0"
                  style={{
                    fontWeight: active ? 600 : 500,
                    color: active ? "var(--primary)" : "#64748B",
                  }}
                >
                  {t.label}
                  {active && (
                    <span
                      className="absolute bottom-0 left-2 right-2"
                      style={{ height: 2, backgroundColor: "var(--primary)", borderRadius: "1px 1px 0 0" }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 bg-[#FAFBFC]">
            {tab === "overview" ? (
              <OverviewTabContent rule={rule} isPreset={isPreset} pill={pill} />
            ) : (
              <ComingSoonPlaceholder tabLabel={TABS.find((t) => t.id === tab)?.label ?? ""} />
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 px-4 sm:px-5 py-3 border-t border-border flex items-center justify-between gap-3 bg-white">
            <div className="text-[12px] text-slate-500 truncate">
              <span style={{ fontWeight: 500 }}>Reviewing:</span>{" "}
              <span className="text-slate-700" style={{ fontWeight: 600 }}>{rule.name}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {onDuplicate && (
                <button
                  onClick={() => { onDuplicate(rule); }}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-border bg-white text-[12px] text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer"
                  style={{ fontWeight: 600 }}
                >
                  <Copy className="w-3.5 h-3.5" />
                  Duplicate
                </button>
              )}
            </div>
          </div>
        </TooltipProvider>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}

/* ─── Header icon button ─── */

function HeaderIconButton({
  label, Icon, disabled, disabledHelp, onClick, tone,
}: {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  disabled: boolean;
  disabledHelp?: string;
  onClick?: () => void;
  tone?: "default" | "warning";
}) {
  const button = (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-[12px] transition-colors ${
        disabled
          ? "border-border text-slate-300 cursor-not-allowed bg-white"
          : tone === "warning"
            ? "border-[#FDE68A] text-[#92400E] bg-[#FFFBEB] hover:bg-[#FEF3C7] cursor-pointer"
            : "border-border text-slate-700 bg-white hover:bg-slate-50 hover:border-slate-300 cursor-pointer"
      }`}
      style={{ fontWeight: 500 }}
    >
      <Icon className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
  if (disabled && disabledHelp) {
    return (
      <Tooltip>
        <TooltipTrigger asChild><span className="inline-flex">{button}</span></TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[260px] z-[12300]">
          <p className="text-xs">{disabledHelp}</p>
        </TooltipContent>
      </Tooltip>
    );
  }
  return button;
}

/* ─── Overview tab content ─── */

function OverviewTabContent({ rule, isPreset, pill }: { rule: PricingRulePreset; isPreset: boolean; pill: { text: string; bg: string; border: string } }) {
  const isDis = rule.category === "discount";
  return (
    <div className="space-y-5 max-w-[820px] mx-auto">
      {/* System template notice */}
      {isPreset && (
        <div className="bg-white border border-border rounded-xl px-3.5 py-3 flex items-start gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-slate-50 border border-border flex items-center justify-center shrink-0">
            <Lock className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] text-slate-700" style={{ fontWeight: 600 }}>System template (read-only)</p>
            <p className="text-[12px] text-slate-500 mt-0.5">
              This rule ships with the software, so it can&apos;t be edited or archived. Duplicate it to create a customizable version.
            </p>
          </div>
        </div>
      )}

      {/* Pricing Rule Type */}
      <TitledSection title="Pricing Rule Type" icon={isDis ? TrendingDown : TrendingUp}>
        <div className="grid grid-cols-2 gap-3">
          <TypeRadioCard
            selected={isDis}
            disabled={isPreset}
            color="#047857"
            bg="#ECFDF5"
            border="#D1FAE5"
            Icon={TrendingDown}
            title="Discount"
            subtitle="Lower price adjustment"
          />
          <TypeRadioCard
            selected={!isDis}
            disabled={isPreset}
            color="#6D28D9"
            bg="#F5F3FF"
            border="#EDE9FE"
            Icon={TrendingUp}
            title="Premium"
            subtitle="Higher price adjustment"
          />
        </div>
      </TitledSection>

      {/* Pricing Rule Details */}
      <TitledSection title="Pricing Rule Details" icon={FileText}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <FieldReadOnly label={`${isDis ? "Discount" : "Premium"} Name`} value={rule.name} />
            <FieldReadOnly label="Calculation Basis" value={rule.basis === "value" ? "Value-Based" : "Volume-Based"} />
          </div>
          <FieldReadOnly label="Description" value={rule.description} />
          <div className="grid grid-cols-2 gap-4">
            <FieldReadOnly label="Valid From" value="20 Mar 2025" leadingIcon={Calendar} />
            <FieldReadOnly label="Valid To" value="20 Sep 2025" leadingIcon={Calendar} />
          </div>
        </div>
      </TitledSection>

      {/* Tiers */}
      <TitledSection
        title={`${isDis ? "Discount" : "Premium"} Tiers`}
        icon={Layers}
        trailing={
          <span className="inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 rounded-full text-[10px] tabular-nums" style={{ fontWeight: 600, color: pill.text, backgroundColor: pill.bg, border: `1px solid ${pill.border}` }}>
            {rule.tiers.length}
          </span>
        }
        bodyClassName="px-0 pb-0"
      >
        <div className="divide-y divide-border overflow-hidden rounded-b-lg">
          {rule.tiers.map((tier, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 text-[13px] tabular-nums">
              <span
                className="inline-flex items-center justify-center w-6 h-6 rounded-md text-[11px] shrink-0"
                style={{ fontWeight: 600, color: pill.text, backgroundColor: pill.bg, border: `1px solid ${pill.border}` }}
              >
                {i + 1}
              </span>
              <span className="text-slate-600">{tier.minValue}</span>
              <span className="text-slate-300">—</span>
              <span className="text-slate-600">{tier.maxValue}</span>
              <span className="ml-auto text-slate-700" style={{ fontWeight: 700 }}>{tier.discount}</span>
            </div>
          ))}
        </div>
      </TitledSection>

      {/* Created by */}
      <div className="flex items-center gap-2 text-[11.5px] text-slate-500 pt-2">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-50 text-[10px] text-primary" style={{ fontWeight: 700 }}>
          {(rule.createdBy ?? "OS").split(" ").map((s) => s[0]).slice(0, 2).join("")}
        </span>
        <span>
          Created by <span className="text-slate-700" style={{ fontWeight: 600 }}>{rule.createdBy ?? "Omnesoft"}</span>
        </span>
        <span className="text-slate-300">•</span>
        <span>Created <span className="text-slate-700" style={{ fontWeight: 600 }}>15 Mar 2025</span></span>
      </div>
    </div>
  );
}

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

function TypeRadioCard({
  selected, disabled, color, bg, border, Icon, title, subtitle,
}: {
  selected: boolean;
  disabled: boolean;
  color: string;
  bg: string;
  border: string;
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
}) {
  return (
    <div
      className={`relative bg-white rounded-xl px-4 py-3.5 flex items-center gap-3 transition-colors ${disabled ? "opacity-90" : ""}`}
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
        className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${selected ? "" : ""}`}
        style={{
          backgroundColor: selected ? color : "#FFFFFF",
          borderColor: selected ? color : "hsl(var(--border))",
        }}
      >
        {selected && <span className="w-2 h-2 rounded-full bg-white" />}
      </span>
    </div>
  );
}

function FieldReadOnly({ label, value, leadingIcon: LeadingIcon }: { label: string; value: string; leadingIcon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div>
      <label className="block text-[11px] text-slate-500 mb-1" style={{ fontWeight: 500 }}>{label}</label>
      <div className="bg-slate-50 border border-border rounded-lg px-3 py-2 text-[12.5px] text-slate-700 flex items-center gap-2 truncate">
        {LeadingIcon && <LeadingIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
        <span className="truncate" style={{ fontWeight: 500 }}>{value || "—"}</span>
      </div>
    </div>
  );
}

function ComingSoonPlaceholder({ tabLabel }: { tabLabel: string }) {
  return (
    <div className="bg-white border border-border rounded-xl p-12 text-center">
      <div className="w-12 h-12 rounded-xl bg-slate-50 border border-border flex items-center justify-center mx-auto mb-3">
        <FileText className="w-5 h-5 text-slate-400" />
      </div>
      <p className="text-[13px] text-slate-700 mb-1" style={{ fontWeight: 600 }}>{tabLabel}</p>
      <p className="text-[11.5px] text-slate-500 max-w-[320px] mx-auto">
        Detailed {tabLabel.toLowerCase()} for this rule will surface here. The view ports from Partner Management — wiring on this side is in progress.
      </p>
    </div>
  );
}
