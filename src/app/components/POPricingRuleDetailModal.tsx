/* ═══════════════════════════════════════════════════════════════════════════
 *  POPricingRuleDetailModal — Sales Orders V5 "Pricing Rule Detail" port
 *  ────────────────────────────────────────────────────────────────────────
 *  Faithful port of `PricingRuleDetailModal.tsx` from Sales Orders V5
 *  (buyer 2026-07-22: "on clicking on the card we need to open the detail
 *  modal check from the sales order"). Same structure, adapted to our
 *  `VendorPricingRule` shape.
 *
 *    · Header — back arrow · themed avatar with big % · title + type
 *      pill (Discount/Premium + Volume-Based) + status pill + TEMPLATE
 *      /CUSTOM badge · right-side Edit / Archive / Disable / expand /
 *      close actions.
 *    · Tabs — Overview · Items · Categories · Partners · Notes ·
 *      Attachments · Recent Activity.
 *    · Overview — read-only banner · Pricing Rule Type selector card
 *      (Discount vs Premium, only the rule's type is active) · Pricing
 *      Rule Details form (name / basis / description / valid dates) ·
 *      Discount Tiers table · created-by metadata.
 *    · Other tabs — placeholder content until each table is wired.
 *    · Footer — "Reviewing: {name}".
 * ═══════════════════════════════════════════════════════════════════════════ */

import { useState } from "react";
import {
  X,
  ArrowLeft,
  Maximize2,
  Minimize2,
  Pencil,
  Archive,
  Lock,
  Info,
  Check,
  TrendingDown,
  TrendingUp,
  Search,
  Plus,
  Package,
  FolderOpen,
  Users,
  FileText,
  Paperclip,
  Clock,
  BookOpen,
  CircleSlash,
  Download,
  FileSpreadsheet,
  FileImage,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "./ui/tooltip";
import {
  evaluateRuleForLine,
  type VendorPricingRule,
} from "./poPricingRulesData";
import type { POLineItem } from "./poStore";

/* ─── Seeded content for Notes / Attachments / Activity tabs ─────────
   Matches SO's PricingRulesLibrary PR_DUMMY_* pattern — small hand-
   authored set so the tabs read as "populated" instead of empty. Ties
   to the rule via the `ruleId` filter (rules without seeded content
   fall back to the empty state). */
interface RuleNote {
  id: string;
  author: string;
  initials: string;
  color: string;
  date: string;
  text: string;
}
interface RuleAttachment {
  id: string;
  name: string;
  size: string;
  type: "pdf" | "xlsx" | "docx" | "png";
  date: string;
  uploadedBy: string;
}
interface RuleActivity {
  id: string;
  action: string;
  target?: string;
  user: string;
  date: string;
  type: "create" | "edit" | "apply" | "deactivate" | "attach";
}

const DUMMY_NOTES: RuleNote[] = [
  { id: "n1", author: "Areeb Tanvir", initials: "AT", color: "#3B82F6", date: "Mar 28, 2026", text: "Rule approved for Q2. Applies to all fastener categories on this vendor." },
  { id: "n2", author: "Nophil Anwer", initials: "NA", color: "#F59E0B", date: "Mar 22, 2026", text: "Increased discount tier from 10% to 15% for orders over 500 units per vendor request." },
  { id: "n3", author: "Irtaza Abid", initials: "IA", color: "#10B981", date: "Mar 18, 2026", text: "Added quantity limit tiers based on supplier feedback." },
];
const DUMMY_ATTACHMENTS: RuleAttachment[] = [
  { id: "a1", name: "Vendor_Rate_Agreement_Q2_2026.pdf", size: "312 KB", type: "pdf", date: "Mar 28, 2026", uploadedBy: "Areeb Tanvir" },
  { id: "a2", name: "Volume_Discount_Schedule.xlsx", size: "156 KB", type: "xlsx", date: "Mar 20, 2026", uploadedBy: "Nophil Anwer" },
  { id: "a3", name: "Supplier_Rate_Card.pdf", size: "98 KB", type: "pdf", date: "Mar 12, 2026", uploadedBy: "Irtaza Abid" },
];
const DUMMY_ACTIVITY: RuleActivity[] = [
  { id: "act1", type: "apply", action: "Pricing rule applied", target: "Purchase Order 395-9900", user: "Areeb Tanvir", date: "Mar 28, 2026 · 3:15 PM" },
  { id: "act2", type: "edit", action: "Discount tier updated", target: "Tier 2: 10% → 15%", user: "Nophil Anwer", date: "Mar 22, 2026 · 10:45 AM" },
  { id: "act3", type: "attach", action: "Attachment added", target: "Supplier_Rate_Card.pdf", user: "Irtaza Abid", date: "Mar 18, 2026 · 2:30 PM" },
  { id: "act4", type: "create", action: "Pricing rule created", user: "Omnesoft", date: "Mar 15, 2026 · 9:00 AM" },
];

interface POPricingRuleDetailModalProps {
  rule: VendorPricingRule | null;
  isActive?: boolean;
  isOpen: boolean;
  onClose: () => void;
  onDeactivate?: () => void;
  onActivate?: () => void;
  /** Header "Edit" CTA — opens the Create wizard in edit mode. Gated
   *  off for template rules. Wired 2026-07-29 (buyer bug: "Edit
   *  coming soon"). */
  onEdit?: () => void;
  /** Current PO's line items — when present, the Items tab pins the
   *  rule to the PO's actual lines: which of them the rule touches,
   *  the computed impact per line, and (via `onToggleRuleForLine`) a
   *  per-line activation switch. Wired 2026-07-29 (buyer bug:
   *  "pricing-rule detail view isn't wired to the line item"). */
  lineItems?: POLineItem[];
  /** Line ids where this rule is currently active on the PO. When
   *  omitted, every eligible line reads as active. */
  activatedLineIds?: Set<string>;
  /** Toggle the rule on / off for one specific line item. */
  onToggleRuleForLine?: (lineId: string, active: boolean) => void;
}

export function POPricingRuleDetailModal({
  rule,
  isActive = true,
  isOpen,
  onClose,
  onDeactivate,
  onActivate,
  onEdit,
  lineItems,
  activatedLineIds,
  onToggleRuleForLine,
}: POPricingRuleDetailModalProps) {
  const [tab, setTab] = useState<string>("overview");
  const [isFullscreen, setIsFullscreen] = useState(false);

  if (!rule) return null;
  const isDis = rule.type === "discount";
  const isPreset = rule.source === "template";
  const theme = isDis
    ? { text: "#047857", pillBg: "#ECFDF5", pillBorder: "#D1FAE5" }
    : { text: "#6D28D9", pillBg: "#F5F3FF", pillBorder: "#EDE9FE" };

  /* Big % chip on the avatar — first tier's rate. */
  const heroRate = rule.tiers[0]
    ? `${rule.tiers[0].rate}${rule.tiers[0].unit === "%" ? "%" : ""}`
    : "—";

  const tabs: Array<{ id: string; label: string; icon: React.ElementType; count?: number }> = [
    { id: "overview", label: "Overview", icon: FileText },
    { id: "items", label: "Items", icon: Package, count: rule.appliesToItemCodes.length },
    { id: "categories", label: "Categories", icon: FolderOpen },
    { id: "partners", label: "Partners", icon: Users, count: rule.vendors.length },
    { id: "notes", label: "Notes", icon: BookOpen, count: DUMMY_NOTES.length },
    { id: "attachments", label: "Attachments", icon: Paperclip, count: DUMMY_ATTACHMENTS.length },
    { id: "activity", label: "Recent Activity", icon: Clock },
  ];

  const close = () => {
    onClose();
    setIsFullscreen(false);
    setTab("overview");
  };

  const status = isActive ? "Active" : "Deactivated";

  return (
    <TooltipProvider delayDuration={150}>
      <Dialog open={isOpen} onOpenChange={(v) => { if (!v) close(); }}>
        <DialogContent
          overlayClassName="z-[12150]"
          className={`flex flex-col p-0 gap-0 border-0 sm:border !z-[12151] [&>[data-slot=dialog-close]]:hidden [&>button.absolute]:hidden transition-[max-width,max-height,border-radius] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
            isFullscreen
              ? "!fixed !inset-0 !translate-x-0 !translate-y-0 !m-auto !w-full !h-full !max-w-[calc(100%-1rem)] sm:!max-w-[calc(100%-1.5rem)] lg:!max-w-[calc(100%-2rem)] !max-h-[calc(100%-1rem)] sm:!max-h-[calc(100%-1.5rem)] lg:!max-h-[calc(100%-2rem)] !rounded-2xl"
              : "!fixed !inset-0 !translate-x-0 !translate-y-0 !m-auto !w-full !h-full !max-w-[100%] sm:!max-w-[min(75vw,1480px)] !max-h-[100dvh] sm:!max-h-[min(88vh,1180px)] sm:!min-h-[640px] rounded-none sm:!rounded-2xl"
          }`}
          style={{ boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)" }}
        >
          <DialogTitle className="sr-only">Pricing Rule Details — {rule.name}</DialogTitle>
          <DialogDescription className="sr-only">
            Detailed view of pricing rule {rule.name}
          </DialogDescription>

          {/* Header */}
          <div className="shrink-0 bg-white rounded-t-none sm:rounded-t-2xl border-b border-slate-200">
            <div className="px-4 sm:px-5 pt-3 pb-3">
              <div className="flex items-start gap-3">
                <button
                  onClick={close}
                  className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-50 transition-colors cursor-pointer shrink-0 mt-0.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-slate-700" />
                </button>
                {/* Themed avatar */}
                <div
                  className="w-[52px] h-[52px] rounded-xl flex flex-col items-center justify-center shrink-0 gap-0.5"
                  style={{ backgroundColor: theme.pillBg, border: `1px solid ${theme.pillBorder}` }}
                >
                  {isDis ? (
                    <TrendingDown className="w-4 h-4" style={{ color: theme.text }} />
                  ) : (
                    <TrendingUp className="w-4 h-4" style={{ color: theme.text }} />
                  )}
                  <span
                    className="text-[11px] tabular-nums leading-none"
                    style={{ color: theme.text, fontWeight: 700 }}
                  >
                    {heroRate}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center flex-wrap gap-2">
                    <h1 className="text-[17px] text-slate-900 truncate" style={{ fontWeight: 700 }}>
                      {rule.name}
                    </h1>
                    {/* Type + basis segmented pill */}
                    <span
                      className="inline-flex items-stretch rounded-full overflow-hidden border shrink-0"
                      style={{ borderColor: theme.pillBorder }}
                    >
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-[10.5px]"
                        style={{ fontWeight: 600, color: theme.text, backgroundColor: theme.pillBg }}
                      >
                        {isDis ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                        {isDis ? "Discount" : "Premium"}
                      </span>
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-[10.5px] bg-white text-slate-500 border-l"
                        style={{ fontWeight: 500, borderColor: theme.pillBorder }}
                      >
                        Volume-Based
                      </span>
                    </span>
                    {/* Status */}
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] border"
                      style={{
                        fontWeight: 500,
                        backgroundColor: isActive ? "#ECFDF5" : "#FFFBEB",
                        color: isActive ? "#065F46" : "#92400E",
                        borderColor: isActive ? "#A7F3D0" : "#FDE68A",
                      }}
                    >
                      {status}
                    </span>
                    {/* Template / Custom marker */}
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-[3px] rounded-md border text-[9px] ${
                        isPreset
                          ? "bg-slate-100 border-slate-300 text-slate-500"
                          : "border-slate-300 bg-white text-slate-500"
                      }`}
                      style={{ fontWeight: 600 }}
                    >
                      {isPreset ? (
                        <>
                          <Lock className="w-2.5 h-2.5" /> TEMPLATE
                        </>
                      ) : (
                        "CUSTOM"
                      )}
                    </span>
                  </div>
                  {rule.description && (
                    <p className="text-[12px] text-slate-500 mt-1.5 leading-relaxed line-clamp-1">
                      {rule.description}
                    </p>
                  )}
                </div>

                {/* Right-side actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span tabIndex={0} className="hidden sm:inline-flex">
                        <button
                          onClick={() => {
                            if (isPreset) return;
                            if (onEdit) {
                              /* Close detail first so the wizard opens
                                 on a clean stack (buyer 2026-07-29
                                 bug fix). */
                              onClose();
                              onEdit();
                            }
                          }}
                          disabled={isPreset || !onEdit}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:pointer-events-none"
                          style={{ fontWeight: 500 }}
                        >
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                      </span>
                    </TooltipTrigger>
                    {isPreset && (
                      <TooltipContent
                        side="bottom"
                        sideOffset={6}
                        className="max-w-[260px] text-center leading-relaxed z-[12200]"
                      >
                        This rule ships as a system template, so it can&rsquo;t be edited directly. Use <span className="font-semibold">Duplicate</span> to create a custom copy you can edit.
                      </TooltipContent>
                    )}
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span tabIndex={0} className="hidden sm:inline-flex">
                        <button
                          onClick={() => !isPreset && toast.info(`"${rule.name}" archived`)}
                          disabled={isPreset}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-xs text-red-700 hover:bg-red-100 hover:border-[#FCA5A5] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-red-50 disabled:pointer-events-none"
                          style={{ fontWeight: 500 }}
                        >
                          <Archive className="w-3.5 h-3.5" /> Archive
                        </button>
                      </span>
                    </TooltipTrigger>
                    {isPreset && (
                      <TooltipContent
                        side="bottom"
                        sideOffset={6}
                        className="max-w-[260px] text-center leading-relaxed z-[12200]"
                      >
                        System templates can&rsquo;t be archived because they ship with the software.
                      </TooltipContent>
                    )}
                  </Tooltip>
                  <button
                    onClick={() => {
                      if (isActive) {
                        onDeactivate?.();
                        toast.success(`${rule.name} deactivated.`);
                      } else {
                        onActivate?.();
                        toast.success(`${rule.name} reactivated.`);
                      }
                    }}
                    className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-800 hover:bg-[#FEF3C7] hover:border-[#FCD34D] transition-colors cursor-pointer"
                    style={{ fontWeight: 500 }}
                  >
                    <CircleSlash className="w-3.5 h-3.5" /> {isActive ? "Deactivate" : "Reactivate"}
                  </button>
                  <button
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-all cursor-pointer"
                  >
                    {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={close}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-all cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Body — tabs */}
          <div className="flex flex-1 overflow-hidden min-h-0">
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
              <div className="flex items-center border-b border-slate-200 shrink-0 px-1 bg-white overflow-x-auto">
                {tabs.map((t) => {
                  const active = tab === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTab(t.id)}
                      className={`inline-flex items-center px-4 py-3 text-xs border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                        active ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-700"
                      }`}
                      style={{ fontWeight: active ? 600 : 500 }}
                    >
                      {t.label}
                      {t.count !== undefined && (
                        <span
                          className={`ml-1.5 text-[10px] rounded-full px-1.5 py-0.5 ${
                            active ? "bg-primary/10 text-primary" : "bg-slate-100 text-slate-500"
                          }`}
                          style={{ fontWeight: 600 }}
                        >
                          {t.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Overview Tab */}
              {tab === "overview" && (
                <div className="flex-1 overflow-y-auto" style={{ backgroundColor: "#FAFBFC" }}>
                  <div className="max-w-[820px] mx-auto px-4 sm:px-6 py-5 space-y-5">
                    {/* Mode banner */}
                    <div className="rounded-lg border border-[#E8ECF1] bg-white px-3.5 py-2.5 flex items-start gap-2.5">
                      <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 bg-slate-50 border border-[#E8ECF1] text-slate-500">
                        <Lock className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[12.5px] text-slate-900" style={{ fontWeight: 600 }}>
                          {isPreset ? "System template (read-only)" : "Custom rule (read-only)"}
                        </p>
                        <p className="text-[11.5px] text-slate-500 mt-0.5 leading-relaxed">
                          {isPreset
                            ? "This rule ships with the software, so it can't be edited or archived. Duplicate it to create a customizable version."
                            : "Click Edit in the header to modify this rule's details."}
                        </p>
                      </div>
                    </div>

                    {/* Pricing Rule Type */}
                    <div>
                      <div className="flex items-center gap-1.5 mb-3">
                        <span className="text-sm text-slate-900" style={{ fontWeight: 600 }}>
                          Pricing Rule Type
                        </span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Info className="w-3.5 h-3.5 text-slate-300 cursor-help" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent
                            side="bottom"
                            sideOffset={6}
                            className="max-w-[260px] text-[11px] leading-[1.5] z-[12200]"
                          >
                            <p className="text-slate-500">
                              Type is fixed once a rule is created. To change it, duplicate and pick a new type.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {([
                          {
                            key: "discount" as const,
                            label: "Discount",
                            desc: "Lower price adjustment",
                            icon: TrendingDown,
                            color: "#047857",
                            bg: "#ECFDF5",
                            border: "#D1FAE5",
                            activeBg: "#16A34A",
                          },
                          {
                            key: "premium" as const,
                            label: "Premium",
                            desc: "Higher price adjustment",
                            icon: TrendingUp,
                            color: "#6D28D9",
                            bg: "#F5F3FF",
                            border: "#EDE9FE",
                            activeBg: "#8B5CF6",
                          },
                        ]).map((t) => {
                          const isTypeActive = rule.type === t.key;
                          return (
                            <div
                              key={t.key}
                              className={`relative rounded-xl overflow-hidden border transition-all duration-200 ${
                                isTypeActive
                                  ? "bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)]"
                                  : "border-slate-200 bg-white opacity-50"
                              }`}
                              style={isTypeActive ? { borderColor: `${t.border}b3` } : undefined}
                            >
                              {isTypeActive && (
                                <div
                                  className="absolute inset-0 pointer-events-none"
                                  style={{ background: `linear-gradient(135deg, ${t.bg}80 0%, transparent 70%)` }}
                                />
                              )}
                              <div className="relative flex items-center gap-3 pl-3.5 pr-3 py-3">
                                <div
                                  className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
                                  style={{ background: `linear-gradient(135deg, ${t.bg}, ${t.border}40)`, color: t.color }}
                                >
                                  <t.icon className="w-[18px] h-[18px]" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p
                                    className="text-[13px]"
                                    style={{ fontWeight: 600, color: isTypeActive ? t.color : "#475569" }}
                                  >
                                    {t.label}
                                  </p>
                                  <p
                                    className="text-[11px] mt-0.5 truncate"
                                    style={{ color: isTypeActive ? t.color : "#94A3B8" }}
                                  >
                                    {t.desc}
                                  </p>
                                </div>
                                <div
                                  className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                                    isTypeActive ? "" : "border-[1.5px] border-[#D1D5DB] bg-white"
                                  }`}
                                  style={
                                    isTypeActive
                                      ? { backgroundColor: t.activeBg, boxShadow: `0 0 0 2px ${t.activeBg}26` }
                                      : {}
                                  }
                                >
                                  {isTypeActive && <Check className="w-3 h-3 text-white" strokeWidth={2.5} />}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Pricing Rule Details */}
                    <div>
                      <div className="flex items-center gap-1.5 mb-3">
                        <span className="text-sm text-slate-900" style={{ fontWeight: 600 }}>
                          Pricing Rule Details
                        </span>
                      </div>
                      <div className="rounded-xl border border-[#E8ECF1] bg-white p-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                          <div>
                            <label className="text-[12px] text-slate-900 block" style={{ fontWeight: 500 }}>
                              {isDis ? "Discount" : "Premium"} Name
                            </label>
                            <Input value={rule.name} disabled className="mt-1 !h-10 text-sm" />
                          </div>
                          <div>
                            <label className="text-[12px] text-slate-900 block" style={{ fontWeight: 500 }}>
                              Calculation Basis
                            </label>
                            <Input value="Volume-Based" disabled className="mt-1 !h-10 text-sm" />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="text-[12px] text-slate-900 block" style={{ fontWeight: 500 }}>
                              Description
                            </label>
                            <Input
                              value={rule.description || ""}
                              disabled
                              placeholder="—"
                              className="mt-1 !h-10 text-sm"
                            />
                          </div>
                          {rule.validTo && (
                            <>
                              <div>
                                <label className="text-[12px] text-slate-900 block" style={{ fontWeight: 500 }}>
                                  Valid From
                                </label>
                                <Input value={rule.validFrom} disabled className="mt-1 !h-10 text-sm" />
                              </div>
                              <div>
                                <label className="text-[12px] text-slate-900 block" style={{ fontWeight: 500 }}>
                                  Valid To
                                </label>
                                <Input value={rule.validTo} disabled className="mt-1 !h-10 text-sm" />
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Tier Details */}
                    <div>
                      <div className="flex items-center gap-1.5 mb-3">
                        <span className="text-sm text-slate-900" style={{ fontWeight: 600 }}>
                          {isDis ? "Discount" : "Premium"} Tiers
                        </span>
                        <span
                          className="text-[10px] rounded-full px-1.5 py-0.5 bg-slate-100 text-slate-500"
                          style={{ fontWeight: 600 }}
                        >
                          {rule.tiers.length}
                        </span>
                      </div>
                      <div className="rounded-xl border border-[#E8ECF1] bg-white p-4 space-y-2">
                        {rule.tiers.map((tier, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-[#E8ECF1]"
                            style={{ backgroundColor: "#FAFBFC" }}
                          >
                            <div className="flex items-center gap-2.5 text-[12px]">
                              <span
                                className="w-5 h-5 rounded flex items-center justify-center text-[10px] shrink-0"
                                style={{ backgroundColor: theme.pillBg, color: theme.text, fontWeight: 700 }}
                              >
                                {idx + 1}
                              </span>
                              <span className="text-slate-500 tabular-nums">{tier.minQty}</span>
                              <span className="text-slate-300">–</span>
                              <span className="text-slate-500 tabular-nums">
                                {tier.maxQty === null ? "∞" : tier.maxQty}
                              </span>
                            </div>
                            <span
                              className="text-[12px] text-slate-900 tabular-nums"
                              style={{ fontWeight: 600 }}
                            >
                              {tier.rate}
                              {tier.unit === "%" ? "%" : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Metadata footer */}
                    <div
                      className="flex items-center gap-3 pt-2 text-[11.5px] text-slate-500"
                      style={{ fontWeight: 500 }}
                    >
                      <span className="inline-flex items-center gap-2">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px]"
                          style={{
                            fontWeight: 700,
                            backgroundColor: isPreset ? "#E7F0FF" : theme.pillBg,
                            color: isPreset ? "#0A77FF" : theme.text,
                          }}
                        >
                          {isPreset ? "OS" : "AT"}
                        </div>
                        <span>
                          Created by{" "}
                          <span className="text-slate-700" style={{ fontWeight: 600 }}>
                            {isPreset ? "Omnesoft" : "Areeb Tanvir"}
                          </span>
                        </span>
                      </span>
                      <span className="w-1 h-1 rounded-full bg-slate-300" />
                      <span>
                        Valid from{" "}
                        <span className="text-slate-700" style={{ fontWeight: 600 }}>
                          {rule.validFrom}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Non-Overview tabs — edge-to-edge like Partners' detail
                  modal. Only Overview keeps the narrow centered column
                  (its content is a form-style stack that reads better
                  narrow); every other tab is a data list that benefits
                  from the full modal width. */}
              {tab !== "overview" && (
                <div className="flex-1 overflow-y-auto bg-white">
                  <div className="px-6 sm:px-8 py-5">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="relative flex-1 max-w-xs">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <Input
                          placeholder={`Search ${tab}...`}
                          className="pl-9 rounded-lg border-slate-200 bg-slate-50 text-[13px] h-9"
                        />
                      </div>
                      {(tab === "items" || tab === "categories" || tab === "partners") && (
                        <button
                          onClick={() => toast.info("Wire data source to enable.")}
                          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-primary hover:bg-[#0862D0] text-white text-[12px] shadow-sm transition-colors cursor-pointer"
                          style={{ fontWeight: 600 }}
                        >
                          <Plus className="w-3.5 h-3.5" />{" "}
                          Add {tab === "items" ? "Item" : tab === "categories" ? "Category" : "Partner"}
                        </button>
                      )}
                    </div>
                    {tab === "items" && (() => {
                      /* Items tab — split into "On this PO" (buyer
                         2026-07-29 bug: "pricing-rule detail view
                         isn't wired to the line item") and "All
                         matching items" (catalog view). The on-this-PO
                         group shows qty, unit price, per-line impact,
                         and a toggle so the buyer can activate/
                         deactivate the rule for a specific line
                         without leaving the detail modal. */
                      const poMatched = (lineItems ?? []).filter((li) =>
                        rule.appliesToItemCodes.includes(li.itemNumber),
                      );
                      const poMatchedCodes = new Set(poMatched.map((li) => li.itemNumber));
                      const otherCodes = rule.appliesToItemCodes.filter(
                        (c) => !poMatchedCodes.has(c),
                      );
                      const fmt = (n: number) =>
                        `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                      return (
                        <div className="space-y-4">
                          {poMatched.length > 0 && (
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                  On this PO ({poMatched.length})
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  Toggle to apply / skip this rule per line
                                </span>
                              </div>
                              <div className="rounded-lg border border-[#E8ECF1] bg-white overflow-hidden">
                                {poMatched.map((li, i) => {
                                  const effUnitPrice = li.unitPrice * (1 - li.discount / 100);
                                  const evalRes = evaluateRuleForLine(rule, {
                                    itemCode: li.itemNumber,
                                    orderedQty: li.quantity,
                                    unitPrice: effUnitPrice,
                                  });
                                  const activeOnLine = activatedLineIds
                                    ? activatedLineIds.has(li.id)
                                    : true;
                                  const impactSign = rule.type === "discount" ? "−" : "+";
                                  const impactColor = rule.type === "discount" ? "#047857" : "#7C3AED";
                                  return (
                                    <div
                                      key={li.id}
                                      className={`flex items-center gap-3 px-4 py-2.5 ${
                                        i > 0 ? "border-t border-slate-100" : ""
                                      }`}
                                    >
                                      <div className="w-7 h-7 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                                        <Package className="w-3.5 h-3.5 text-slate-400" />
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                          <span className="text-[12px] font-mono text-slate-800">
                                            {li.itemNumber}
                                          </span>
                                          {!activeOnLine && (
                                            <span
                                              className="inline-flex items-center rounded px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide"
                                              style={{
                                                backgroundColor: "#FEF3C7",
                                                color: "#92400E",
                                              }}
                                            >
                                              Skipped
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-[11px] text-slate-500 truncate">
                                          {li.description || li.descriptiveName}
                                        </div>
                                        <div className="text-[10.5px] text-slate-400 mt-0.5 tabular-nums">
                                          {li.quantity} × {fmt(effUnitPrice)}
                                          {evalRes.applies && activeOnLine && (
                                            <span
                                              className="ml-2"
                                              style={{ color: impactColor, fontWeight: 500 }}
                                            >
                                              {impactSign}{fmt(evalRes.amount)}
                                            </span>
                                          )}
                                          {evalRes.applies && !activeOnLine && (
                                            <span className="ml-2 text-slate-400 line-through">
                                              {impactSign}{fmt(evalRes.amount)}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      {onToggleRuleForLine && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            onToggleRuleForLine(li.id, !activeOnLine)
                                          }
                                          className="shrink-0 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition-colors cursor-pointer"
                                          style={{
                                            fontWeight: 500,
                                            backgroundColor: activeOnLine ? "#EFF6FF" : "#FFFFFF",
                                            borderColor: activeOnLine ? "#BFDBFE" : "#E5E7EB",
                                            color: activeOnLine ? "#1E40AF" : "#475569",
                                          }}
                                        >
                                          {activeOnLine ? "Applied" : "Skipped"}
                                        </button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          {otherCodes.length > 0 && (
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                  {poMatched.length > 0
                                    ? `Also covers (${otherCodes.length})`
                                    : `Covered items (${otherCodes.length})`}
                                </span>
                                {poMatched.length > 0 && (
                                  <span className="text-[10px] text-slate-400">
                                    Not on this PO
                                  </span>
                                )}
                              </div>
                              <div className="rounded-lg border border-[#E8ECF1] bg-white overflow-hidden">
                                {otherCodes.map((code, i) => (
                                  <div
                                    key={code}
                                    className={`flex items-center justify-between px-4 py-2.5 ${
                                      i > 0 ? "border-t border-slate-100" : ""
                                    }`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="w-7 h-7 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-center">
                                        <Package className="w-3.5 h-3.5 text-slate-400" />
                                      </div>
                                      <span className="text-[13px] text-slate-800 font-mono">{code}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {poMatched.length === 0 && otherCodes.length === 0 && (
                            <div className="py-8 text-center text-[12px] text-slate-500">
                              No items assigned to this rule yet.
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {tab === "partners" && (
                      <div className="rounded-lg border border-[#E8ECF1] bg-white overflow-hidden">
                        {rule.vendors.map((v, i) => (
                          <div
                            key={v}
                            className={`flex items-center gap-3 px-4 py-2.5 ${
                              i > 0 ? "border-t border-slate-100" : ""
                            }`}
                          >
                            <div className="w-7 h-7 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-center">
                              <Users className="w-3.5 h-3.5 text-slate-400" />
                            </div>
                            <span className="text-[13px] text-slate-800">{v}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {tab === "categories" && (
                      <div className="py-12 text-center">
                        <div className="w-12 h-12 rounded-xl bg-slate-50 border border-[#E8ECF1] flex items-center justify-center mx-auto mb-3">
                          <FolderOpen className="w-5 h-5 text-slate-400" />
                        </div>
                        <p className="text-[13px] text-slate-700 mb-1" style={{ fontWeight: 600 }}>
                          No categories linked
                        </p>
                        <p className="text-[11px] text-slate-400 max-w-[320px] mx-auto">
                          This rule scopes by item codes directly. Categories aren&rsquo;t used on this rule.
                        </p>
                      </div>
                    )}

                    {/* Notes tab — Partner-details soft cards with author footer */}
                    {tab === "notes" && (
                      <div className="rounded-lg border border-[#E8ECF1] bg-white p-3 space-y-2">
                        {DUMMY_NOTES.map((note) => (
                          <div
                            key={note.id}
                            className="rounded-md border border-slate-100 p-3"
                            style={{ backgroundColor: "#FAFBFC" }}
                          >
                            <p className="text-[12px] text-slate-600 leading-relaxed whitespace-pre-wrap">
                              {note.text}
                            </p>
                            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-2">
                              <div
                                className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] text-white shrink-0"
                                style={{ backgroundColor: note.color, fontWeight: 700 }}
                              >
                                {note.initials}
                              </div>
                              <span className="text-[11px] text-slate-500">
                                <span className="text-slate-700" style={{ fontWeight: 500 }}>
                                  {note.author}
                                </span>{" "}
                                · {note.date}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Attachments tab — file rows with type icon, size, uploader, download */}
                    {tab === "attachments" && (
                      <div className="rounded-lg border border-[#E8ECF1] bg-white overflow-hidden">
                        {DUMMY_ATTACHMENTS.map((a, i) => {
                          const iconMap = {
                            pdf: FileText,
                            xlsx: FileSpreadsheet,
                            docx: FileText,
                            png: FileImage,
                          } as const;
                          const bgMap = {
                            pdf: "#FEF2F2",
                            xlsx: "#ECFDF5",
                            docx: "#EFF6FF",
                            png: "#F5F3FF",
                          } as const;
                          const colorMap = {
                            pdf: "#DC2626",
                            xlsx: "#059669",
                            docx: "#2563EB",
                            png: "#7C3AED",
                          } as const;
                          const Icon = iconMap[a.type];
                          return (
                            <div
                              key={a.id}
                              className={`flex items-center justify-between gap-3 px-4 py-2.5 ${
                                i > 0 ? "border-t border-slate-100" : ""
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div
                                  className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
                                  style={{ backgroundColor: bgMap[a.type] }}
                                >
                                  <Icon className="w-4 h-4" style={{ color: colorMap[a.type] }} />
                                </div>
                                <div className="min-w-0">
                                  <div className="text-[13px] text-slate-800 truncate" style={{ fontWeight: 500 }}>
                                    {a.name}
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-0.5">
                                    {a.size} · Uploaded by{" "}
                                    <span className="text-slate-700" style={{ fontWeight: 500 }}>
                                      {a.uploadedBy}
                                    </span>{" "}
                                    · {a.date}
                                  </div>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => toast.info(`Downloading ${a.name}`)}
                                className="inline-flex items-center justify-center w-8 h-8 rounded-md text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer shrink-0"
                                title="Download"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Recent Activity tab — timeline feed */}
                    {tab === "activity" && (
                      <div className="rounded-lg border border-[#E8ECF1] bg-white p-3">
                        <div className="space-y-3">
                          {DUMMY_ACTIVITY.map((act, i) => {
                            const iconMap = {
                              create: Plus,
                              edit: Pencil,
                              apply: CheckCircle2,
                              deactivate: CircleSlash,
                              attach: Paperclip,
                            } as const;
                            const bgMap = {
                              create: "#ECFDF5",
                              edit: "#EFF6FF",
                              apply: "#ECFDF5",
                              deactivate: "#FFFBEB",
                              attach: "#F5F3FF",
                            } as const;
                            const colorMap = {
                              create: "#059669",
                              edit: "#2563EB",
                              apply: "#059669",
                              deactivate: "#92400E",
                              attach: "#7C3AED",
                            } as const;
                            const Icon = iconMap[act.type];
                            return (
                              <div key={act.id} className="flex items-start gap-3">
                                <div className="relative flex flex-col items-center shrink-0">
                                  <div
                                    className="w-7 h-7 rounded-full flex items-center justify-center"
                                    style={{ backgroundColor: bgMap[act.type] }}
                                  >
                                    <Icon
                                      className="w-3.5 h-3.5"
                                      style={{ color: colorMap[act.type] }}
                                    />
                                  </div>
                                  {i < DUMMY_ACTIVITY.length - 1 && (
                                    <div className="w-px flex-1 bg-slate-200 mt-1" style={{ minHeight: 24 }} />
                                  )}
                                </div>
                                <div className="min-w-0 flex-1 pb-2">
                                  <div className="text-[12.5px] text-slate-800">
                                    <span style={{ fontWeight: 500 }}>{act.action}</span>
                                    {act.target && (
                                      <>
                                        {" · "}
                                        <span className="text-slate-600">{act.target}</span>
                                      </>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-0.5">
                                    <span className="text-slate-700" style={{ fontWeight: 500 }}>
                                      {act.user}
                                    </span>{" "}
                                    · {act.date}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="mt-2 pt-3 border-t border-slate-100 text-center">
                          <p className="text-[11px] text-slate-400">
                            Full activity log available once the backend is wired.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="shrink-0 border-t border-[#EEF2F6] bg-white px-4 sm:px-5 py-3 flex items-center justify-between gap-2 sm:rounded-b-2xl">
            <p className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>
              Reviewing:{" "}
              <span className="text-slate-700" style={{ fontWeight: 600 }}>
                {rule.name}
              </span>
            </p>
            <div className="flex items-center gap-2" />
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
