import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from "./ui/alert-dialog";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "./ui/tooltip";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import {
  ArrowLeft,
  X,
  Pencil,
  Archive,
  Maximize2,
  Minimize2,
  Building2,
  FileText,
  Paperclip,
  Clock,
  Copy,
  Check,
  Receipt,
  Lock,
  Ban,
  CalendarDays,
  SquareSplitHorizontal,
  MessageSquare,
  Activity,
  Banknote,
  ArrowUpDown,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import {
  type PaymentTermPreset,
  CREATE_PT_TYPES,
} from "./paymentTermPresets";
import { usePaymentTermStatus } from "./paymentTermStatusContext";
import { getAvatarTint } from "./avatarTints";

/* ──────────────────────────────────────────────────────────────────
   PaymentTermDetailModal — ported from the Partners app
   (`Partners/.../PaymentTermDetailModal.tsx`).

   Scope adaptations for the PO Detail page:
   • Overview tab — ported in full. The form fields render with the
     term's values; preset templates are read-only with tooltips
     explaining why; custom terms can be unlocked via the header Edit
     button.
   • Partners tab — empty-state placeholder ("No partners using this
     term yet"). The Partners app populates this from VendorContext
     which the PO Detail page doesn't carry.
   • Chat / Attachments / Activity tabs — friendly "Available with
     backend integration" placeholders mirroring the original's
     copy. Re-enable by porting SubmoduleChatTab / AttachmentsTab /
     ActivityFeed when those systems land here.

   The lifecycle AlertDialog (Archive / Disable / Enable / Restore)
   is ported in full and works via the local PaymentTermStatusContext.
   ──────────────────────────────────────────────────────────────── */

/* ─── Parse split-term milestones from the description ─── */
function parseSplitMilestones(description: string): { pct: string; label: string }[] {
  if (!description) return [];
  const re = /(\d+)%\s+(?:is\s+)?(?:due\s+)?(?:at\s+|on\s+|upon\s+)?([^,.;]+)/gi;
  const out: { pct: string; label: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(description)) !== null) {
    const pct = `${m[1]}%`;
    const rawLabel = m[2].trim();
    if (!rawLabel) continue;
    const label = rawLabel
      .replace(/\s+/g, " ")
      .split(" ")
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
      .join(" ");
    out.push({ pct, label });
  }
  return out;
}

const PT_DETAIL_TABS = [
  { id: "setup", label: "Overview", icon: FileText },
  { id: "vendors", label: "Partners", icon: Building2 },
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "attachments", label: "Attachments", icon: Paperclip },
  { id: "activity", label: "Recent Activity", icon: Clock },
];

interface PaymentTermDetailModalProps {
  term: PaymentTermPreset | null;
  open: boolean;
  onClose: () => void;
  /** "view" = read-only on details page, "create" = inside picker with Apply button */
  mode?: "view" | "create";
  onApply?: (term: PaymentTermPreset) => void;
  onDuplicate?: (term: PaymentTermPreset) => void;
}

export default function PaymentTermDetailModal({
  term,
  open,
  onClose,
  mode = "create",
  onApply,
  onDuplicate,
}: PaymentTermDetailModalProps) {
  const [tab, setTab] = useState("setup");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [pendingAction, setPendingAction] = useState<"disable" | "enable" | "archive" | "restore" | null>(null);
  const { getStatus, setStatus } = usePaymentTermStatus();

  if (!term) return null;

  const ptDuration = term.duration || (term.name.match(/\d+/) ? term.name.match(/\d+/)![0] : "30");
  const pill =
    term.category === "net"
      ? { text: "#0A77FF", bg: "#EFF6FF", border: "#DBEAFE" }
      : term.category === "prepayment"
        ? { text: "#6D28D9", bg: "#F5F3FF", border: "#EDE9FE" }
        : { text: "#B45309", bg: "#FFFBEB", border: "#FDE68A" };
  const isCustom = term.id.startsWith("pt-custom-");
  const isPreset = !isCustom;
  const runtimeStatus = isPreset ? "active" : getStatus(term.id);
  const statusBadge =
    runtimeStatus === "inactive"
      ? { label: "Inactive", bg: "#FFFBEB", text: "#92400E", border: "#FDE68A" }
      : runtimeStatus === "archived"
        ? { label: "Archived", bg: "#FEF2F2", text: "#991B1B", border: "#FECACA" }
        : { label: "Active", bg: "#ECFDF5", text: "#065F46", border: "#A7F3D0" };

  const modalBaseTransition = "transition-[max-width,max-height,border-radius] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]";
  const modalSizeClass = isFullscreen
    ? `!fixed !inset-0 !translate-x-0 !translate-y-0 !m-auto !w-full !h-full ${modalBaseTransition} !max-w-[calc(100%-1rem)] sm:!max-w-[calc(100%-1.5rem)] lg:!max-w-[calc(100%-2rem)] !max-h-[calc(100%-1rem)] sm:!max-h-[calc(100%-1.5rem)] lg:!max-h-[calc(100%-2rem)] !rounded-2xl`
    : `!fixed !inset-0 !translate-x-0 !translate-y-0 !m-auto !w-full !h-full ${modalBaseTransition} !max-w-[100%] sm:!max-w-[min(70vw,1480px)] !max-h-[100dvh] sm:!max-h-[min(88vh,1180px)] sm:!min-h-[640px] rounded-none sm:!rounded-2xl`;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); setIsFullscreen(false); setIsEditing(false); setTab("setup"); } }}>
      <DialogContent
        // `[&>button.absolute]:hidden` hides the shadcn-baked DialogPrimitive.Close
        // (`absolute top-4 right-4` X icon injected by `ui/dialog.tsx`). The header
        // already renders its own contextual X next to fullscreen/edit affordances,
        // so the baked-in one was duplicating the close affordance.
        className={`flex flex-col p-0 gap-0 border-0 sm:border z-[220] [&>button.absolute]:hidden ${modalSizeClass}`}
        style={{ boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)" }}
      >
        <DialogTitle className="sr-only">Payment Term Details — {term.name}</DialogTitle>
        <DialogDescription className="sr-only">Detailed view of payment term {term.name}</DialogDescription>

        {/* ─── Header ─── */}
        <div className="shrink-0 bg-white rounded-t-none sm:rounded-t-2xl border-b border-border">
          <div className="px-4 sm:px-5 pt-3 pb-3">
            <div className="flex items-start gap-3">
              <button onClick={onClose} className="w-8 h-8 rounded-lg border border-border bg-white flex items-center justify-center hover:bg-slate-50 transition-colors cursor-pointer shrink-0 mt-0.5">
                <ArrowLeft className="w-3.5 h-3.5 text-slate-700" />
              </button>
              <div
                className="w-[52px] h-[52px] rounded-xl flex flex-col items-center justify-center shrink-0 gap-0.5"
                style={{ backgroundColor: pill.bg, border: `1px solid ${pill.border}` }}
              >
                {term.category === "net" ? (
                  <Receipt className="w-4 h-4" style={{ color: pill.text }} />
                ) : term.category === "prepayment" ? (
                  <Clock className="w-4 h-4" style={{ color: pill.text }} />
                ) : (
                  <SquareSplitHorizontal className="w-4 h-4" style={{ color: pill.text }} />
                )}
                <span className="text-[11px] tabular-nums leading-none" style={{ color: pill.text, fontWeight: 700 }}>
                  {term.category === "net" ? ptDuration : term.typeBadge}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center flex-wrap gap-2">
                  <h1 className="text-[17px] text-foreground truncate" style={{ fontWeight: 700 }}>{term.name}</h1>
                  <span className="inline-flex items-stretch rounded-full overflow-hidden border shrink-0" style={{ borderColor: pill.border }}>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10.5px]" style={{ fontWeight: 600, color: pill.text, backgroundColor: pill.bg }}>
                      {term.category === "net" ? (
                        <Receipt className="w-3 h-3" />
                      ) : term.category === "prepayment" ? (
                        <Clock className="w-3 h-3" />
                      ) : (
                        <SquareSplitHorizontal className="w-3 h-3" />
                      )}
                      {term.typeBadge}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10.5px] bg-white text-slate-500 border-l" style={{ fontWeight: 500, borderColor: pill.border }}>
                      <CalendarDays className="w-3 h-3" />
                      {term.trigger || "Shipping"}
                    </span>
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] border" style={{ fontWeight: 500, backgroundColor: statusBadge.bg, color: statusBadge.text, borderColor: statusBadge.border }}>
                    {statusBadge.label}
                  </span>
                  <span className={`inline-flex items-center gap-1 px-1.5 py-[3px] rounded-md border text-[9px] ${isCustom ? "border-slate-300 bg-white text-slate-500" : "bg-muted border-slate-300 text-slate-500"}`} style={{ fontWeight: 600 }}>
                    {isCustom ? "CUSTOM" : <><Lock className="w-2.5 h-2.5" /> TEMPLATE</>}
                  </span>
                </div>
                <p className="text-[12px] text-slate-500 mt-2 leading-relaxed line-clamp-2">
                  {term.description || `Payment is due ${ptDuration} days after the ${(term.trigger || "invoice date").toLowerCase()}.`}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0} className="hidden sm:inline-flex">
                      <button
                        onClick={() => { if (isCustom) { setIsEditing(true); setTab("setup"); } }}
                        disabled={isPreset}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-white text-xs text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:pointer-events-none"
                        style={{ fontWeight: 500 }}
                      >
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </button>
                    </span>
                  </TooltipTrigger>
                  {isPreset && (
                    <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-center leading-relaxed">
                      This term ships as a system template, so it can&rsquo;t be edited directly. Use <span className="font-semibold">Duplicate</span> to create a custom copy you can edit.
                    </TooltipContent>
                  )}
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0} className="hidden sm:inline-flex">
                      <button
                        onClick={() => {
                          if (!isCustom) return;
                          setPendingAction(runtimeStatus === "archived" ? "restore" : "archive");
                        }}
                        disabled={isPreset}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-xs text-destructive hover:bg-red-100 hover:border-[#FCA5A5] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-red-50 disabled:pointer-events-none"
                        style={{ fontWeight: 500 }}
                      >
                        <Archive className="w-3.5 h-3.5" />{runtimeStatus === "archived" ? "Restore" : "Archive"}
                      </button>
                    </span>
                  </TooltipTrigger>
                  {isPreset && (
                    <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-center leading-relaxed">
                      System templates can&rsquo;t be archived because they ship with the software. <span className="font-semibold">Duplicate</span> the template if you need a version you can manage.
                    </TooltipContent>
                  )}
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0} className="hidden sm:inline-flex">
                      <button
                        onClick={() => {
                          if (!isCustom) return;
                          setPendingAction(runtimeStatus === "inactive" ? "enable" : "disable");
                        }}
                        disabled={isPreset || runtimeStatus === "archived"}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-800 hover:bg-[#FEF3C7] hover:border-[#FCD34D] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-amber-50 disabled:pointer-events-none"
                        style={{ fontWeight: 500 }}
                      >
                        <Ban className="w-3.5 h-3.5" />{runtimeStatus === "inactive" ? "Enable" : "Disable"}
                      </button>
                    </span>
                  </TooltipTrigger>
                  {isPreset && (
                    <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-center leading-relaxed">
                      System templates can&rsquo;t be disabled. <span className="font-semibold">Duplicate</span> the template to create a custom copy you can disable.
                    </TooltipContent>
                  )}
                </Tooltip>
                <button onClick={() => setIsFullscreen(!isFullscreen)} className="w-8 h-8 rounded-lg border border-border bg-white flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-all cursor-pointer">
                  {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => { onClose(); setIsFullscreen(false); setIsEditing(false); setTab("setup"); }} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-all cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Body ─── */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
            {/* Tabs */}
            <div className="flex items-center border-b border-border shrink-0 px-1 bg-white">
              {PT_DETAIL_TABS.map((t) => {
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`inline-flex items-center px-4 py-3 text-xs border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                      active ? "border-primary text-primary font-semibold" : "border-transparent text-slate-500 hover:text-slate-700 font-medium"
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            {tab === "setup" && (
              <PaymentTermSetupTab term={term} isEditing={isEditing} onStopEditing={() => setIsEditing(false)} />
            )}

            {tab === "vendors" && (
              <TabPlaceholder
                icon={Building2}
                title="No partners using this term yet"
                body="When partners are configured with this payment term, they'll be listed here with their status, locations, and points of contact."
              />
            )}

            {tab === "chat" && (
              <TabPlaceholder
                icon={MessageSquare}
                title="Chat available with backend integration"
                body={`Conversation history for the "${term.name}" payment term will surface here once the chat submodule is wired up.`}
              />
            )}

            {tab === "attachments" && (
              <TabPlaceholder
                icon={Paperclip}
                title="Attachments available with backend integration"
                body="Supporting documents linked to this payment term will appear here once attachments storage is connected."
              />
            )}

            {tab === "activity" && (
              <TabPlaceholder
                icon={Activity}
                title="Activity available with backend integration"
                body="Full activity log — creation, edits, applications across partners — will appear here once the activity feed is wired up."
              />
            )}
          </div>
        </div>

        {/* ─── Footer ─── */}
        <div className="shrink-0 border-t border-border bg-white rounded-b-none sm:rounded-b-2xl">
          <div className="px-5 py-2.5 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">Reviewing: <span className="text-foreground" style={{ fontWeight: 600 }}>{term.name}</span></span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { if (term && onDuplicate) { onDuplicate(term); onClose(); } else { toast.info("Duplicate coming soon"); } }}
                className="h-8 px-3.5 rounded-lg border border-border bg-white text-xs text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer inline-flex items-center gap-1.5" style={{ fontWeight: 500 }}
              >
                <Copy className="w-3.5 h-3.5" /> Duplicate
              </button>
              {mode === "create" && (
                <button
                  onClick={() => { if (term && onApply) { onApply(term); onClose(); } }}
                  className="h-8 px-3.5 rounded-lg bg-primary text-white text-xs hover:bg-primary/90 transition-colors cursor-pointer inline-flex items-center gap-1.5" style={{ fontWeight: 500 }}
                >
                  <Check className="w-3.5 h-3.5" /> Apply
                </button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>

      {/* Lifecycle confirmation */}
      <AlertDialog open={!!pendingAction} onOpenChange={(v) => { if (!v) setPendingAction(null); }}>
        <AlertDialogContent
          className="sm:max-w-[520px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
          style={{ zIndex: 240 }}
          onInteractOutside={() => setPendingAction(null)}
        >
          {(() => {
            const cfg = pendingAction === "archive"
              ? { iconBg: "#FEE2E2", iconColor: "hsl(var(--destructive))", icon: <Archive className="w-8 h-8" />, title: `Archive ${term.name}?`, body: "This term is removed from active templates. Partners that already use it keep it; you won't be able to apply it to new partners. The term can be restored from the archive at any time.", confirm: "Archive term", confirmBg: "hsl(var(--destructive))", cancel: "Keep active" }
              : pendingAction === "restore"
                ? { iconBg: "#DCFCE7", iconColor: "#15803D", icon: <Archive className="w-8 h-8" />, title: `Restore ${term.name}?`, body: "Bring this term back to active status. Partners will be able to apply it again on new purchase orders.", confirm: "Restore term", confirmBg: "#15803D", cancel: "Keep archived" }
                : pendingAction === "disable"
                  ? { iconBg: "#FEF3C7", iconColor: "#B45309", icon: <Ban className="w-8 h-8" />, title: `Disable ${term.name}?`, body: "Partners with this term already configured keep it. New partners won't see it in the picker until you re-enable.", confirm: "Disable term", confirmBg: "#B45309", cancel: "Keep active" }
                  : { iconBg: "#DCFCE7", iconColor: "#15803D", icon: <Check className="w-8 h-8" />, title: `Enable ${term.name}?`, body: "Bring this term back into the picker so new partners can apply it again.", confirm: "Enable term", confirmBg: "#15803D", cancel: "Keep disabled" };
            const handleConfirm = () => {
              if (!pendingAction) return;
              if (pendingAction === "archive") setStatus(term.id, "archived");
              if (pendingAction === "restore") setStatus(term.id, "active");
              if (pendingAction === "disable") setStatus(term.id, "inactive");
              if (pendingAction === "enable") setStatus(term.id, "active");
              toast.success(`${term.name} ${pendingAction === "archive" ? "archived" : pendingAction === "restore" ? "restored" : pendingAction === "disable" ? "disabled" : "enabled"}.`);
              setPendingAction(null);
            };
            return (
              <>
                <AlertDialogHeader className="px-6 pt-6 pb-2 items-center text-center gap-3">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: cfg.iconBg, color: cfg.iconColor }}>
                    {cfg.icon}
                  </div>
                  <AlertDialogTitle className="text-[16px]" style={{ fontWeight: 700 }}>{cfg.title}</AlertDialogTitle>
                  <AlertDialogDescription className="text-[12.5px] text-slate-500 leading-relaxed max-w-[400px]">
                    {cfg.body}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="px-6 pb-5 pt-2 flex flex-col gap-2">
                  <button
                    onClick={handleConfirm}
                    className="w-full h-10 rounded-lg text-white text-[13px] hover:opacity-90 transition-opacity cursor-pointer"
                    style={{ backgroundColor: cfg.confirmBg, fontWeight: 600 }}
                  >
                    {cfg.confirm}
                  </button>
                  <button
                    onClick={() => setPendingAction(null)}
                    className="w-full h-10 rounded-lg border border-border bg-white text-[13px] text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                    style={{ fontWeight: 500 }}
                  >
                    {cfg.cancel}
                  </button>
                </div>
              </>
            );
          })()}
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

function TabPlaceholder({ icon: Icon, title, body }: { icon: React.ElementType; title: string; body: string }) {
  return (
    <div className="flex-1 overflow-auto p-6 flex items-center justify-center">
      <div className="max-w-[360px] text-center">
        <div className="w-12 h-12 rounded-xl bg-accent/40 border border-border flex items-center justify-center mx-auto mb-3">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>{title}</p>
        <p className="text-[11.5px] text-slate-500 mt-1.5 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

function PaymentTermSetupTab({ term, isEditing = false, onStopEditing }: { term: PaymentTermPreset; isEditing?: boolean; onStopEditing?: () => void }) {
  const isCustom = term.id.startsWith("pt-custom-");
  const isPreset = !isCustom;
  const isTemplateDerived = isCustom;
  const splitMilestones = parseSplitMilestones(term.description);
  const triggerLabel = term.trigger || "Shipping";
  const creatorTint = getAvatarTint("Omnesoft");

  const [editName, setEditName] = useState(term.name);
  const [editDuration, setEditDuration] = useState(term.duration || "");
  const [editDiscountPct, setEditDiscountPct] = useState(term.discountPercent || "");
  const [editDiscountPeriod, setEditDiscountPeriod] = useState(term.discountPeriod || "");
  const [editDescription, setEditDescription] = useState(term.description);

  const [dirty, setDirty] = useState(false);
  const [versionPromptOpen, setVersionPromptOpen] = useState(false);
  const [versionAcknowledged, setVersionAcknowledged] = useState(false);

  const guardEdit = () => {
    if (isPreset) return false;
    if (isTemplateDerived && !versionAcknowledged) {
      setVersionPromptOpen(true);
      return true;
    }
    setDirty(true);
    return false;
  };
  const onChangeName = (v: string) => { if (!guardEdit()) setEditName(v); };
  const onChangeDuration = (v: string) => { if (!guardEdit()) setEditDuration(v); };
  const onChangeDiscountPct = (v: string) => { if (!guardEdit()) setEditDiscountPct(v); };
  const onChangeDiscountPeriod = (v: string) => { if (!guardEdit()) setEditDiscountPeriod(v); };
  const onChangeDescription = (v: string) => { if (!guardEdit()) setEditDescription(v); };

  const acknowledgeVersion = () => {
    setVersionAcknowledged(true);
    setVersionPromptOpen(false);
    setDirty(true);
  };
  const handleSave = () => {
    toast.success(isTemplateDerived ? "New version saved." : "Changes saved.");
    setDirty(false);
    onStopEditing?.();
  };
  const handleDiscard = () => {
    setEditName(term.name);
    setEditDuration(term.duration || "");
    setEditDiscountPct(term.discountPercent || "");
    setEditDiscountPeriod(term.discountPeriod || "");
    setEditDescription(term.description);
    setDirty(false);
    onStopEditing?.();
  };

  const fieldsDisabled = isPreset || !isEditing;

  const LockedField = ({ children }: { children: React.ReactNode }) => {
    if (!fieldsDisabled) return <>{children}</>;
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div>{children}</div>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6} className="max-w-[260px] text-center leading-relaxed text-xs">
          {isPreset
            ? <>This is a system template and can&rsquo;t be edited. Use <span className="font-semibold">Duplicate</span> to make a custom version.</>
            : <>Click <span className="font-semibold">Edit</span> in the header to modify this term.</>}
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAFBFC]">
      <div className="max-w-[820px] mx-auto px-4 sm:px-6 py-5 space-y-5">

        {/* Mode banner */}
        <div className={`rounded-lg border px-3.5 py-2.5 flex items-start gap-2.5 ${isPreset ? "border-[#E8ECF1] bg-white" : isEditing ? "border-[#BFDBFE] bg-[#EFF6FF]" : "border-[#E8ECF1] bg-white"}`}>
          <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${isPreset ? "bg-slate-50 border border-[#E8ECF1] text-slate-500" : isEditing ? "bg-white border border-[#BFDBFE] text-primary" : "bg-slate-50 border border-[#E8ECF1] text-slate-500"}`}>
            {isPreset ? <Lock className="w-3.5 h-3.5" /> : isEditing ? <Pencil className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
          </div>
          <div className="min-w-0">
            <p className="text-[12.5px] text-foreground" style={{ fontWeight: 600 }}>
              {isPreset ? "System template (read-only)" : isEditing ? "Editing mode" : "Custom term (read-only)"}
            </p>
            <p className="text-[11.5px] text-slate-500 mt-0.5 leading-relaxed">
              {isPreset
                ? "This term ships with the software, so it can't be edited or archived. Duplicate it to create a customizable version."
                : isEditing
                  ? isTemplateDerived
                    ? "You're editing this term. Saving will create a new version so the original template stays intact."
                    : "You're editing this term. Save when you're done."
                  : "Click Edit in the header to modify this term's details."}
            </p>
          </div>
        </div>

        {/* Payment Term Type */}
        <div>
          <div className="flex items-center gap-1.5 mb-3">
            <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>Payment Term Type</span>
            <Tooltip>
              <TooltipTrigger asChild><span><Info className="w-3.5 h-3.5 text-slate-300 cursor-help" /></span></TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                <p className="text-slate-500">Type is fixed once a term is created. To change it, duplicate this term and pick a new type.</p>
              </TooltipContent>
            </Tooltip>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {CREATE_PT_TYPES.map((t) => {
              const isActive = term.category === t.id;
              const icon = t.id === "net" ? <Clock className="w-[18px] h-[18px]" /> : t.id === "prepayment" ? <Banknote className="w-[18px] h-[18px]" /> : <ArrowUpDown className="w-[18px] h-[18px]" />;
              const shortLabel = t.id === "net" ? "NET Terms" : t.id === "prepayment" ? "Prepayment" : "Split Payment";
              const shortDesc = t.id === "net" ? "Pay after X days" : t.id === "prepayment" ? "Pay before delivery" : "Multiple installments";
              const accentColor = t.id === "net" ? "hsl(var(--primary))" : t.id === "prepayment" ? "hsl(var(--violet))" : "hsl(var(--warning))";
              const accentBg = t.id === "net" ? "#EFF6FF" : t.id === "prepayment" ? "#F5F3FF" : "#FFFBEB";
              const accentBorder = t.id === "net" ? "#93C5FD" : t.id === "prepayment" ? "#C4B5FD" : "#FCD34D";
              const activeBorderClass = t.id === "net" ? "border-[#93C5FD]/70" : t.id === "prepayment" ? "border-[#C4B5FD]/70" : "border-[#FCD34D]/70";
              const circleActiveBg = t.id === "net" ? "#3B82F6" : t.id === "prepayment" ? "#8B5CF6" : "#F59E0B";
              const circleActiveShadow = t.id === "net" ? "rgba(59,130,246,0.15)" : t.id === "prepayment" ? "rgba(139,92,246,0.15)" : "rgba(245,158,11,0.15)";
              return (
                <div
                  key={t.id}
                  className={`relative rounded-xl overflow-hidden border transition-all duration-200 ${
                    isActive
                      ? `${activeBorderClass} bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)]`
                      : "border-border bg-white opacity-50"
                  }`}
                >
                  {isActive && (
                    <div className="absolute inset-0 pointer-events-none" style={{ background: `linear-gradient(135deg, ${accentBg}80 0%, transparent 70%)` }} />
                  )}
                  <div className="relative flex items-center gap-3 pl-3.5 pr-3 py-3">
                    <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: `linear-gradient(135deg, ${accentBg}, ${accentBorder}40)`, color: accentColor }}>
                      {icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px]" style={{ fontWeight: 600, color: isActive ? accentColor : "#475569" }}>{shortLabel}</p>
                      <p className="text-[11px] mt-0.5 truncate" style={{ color: isActive ? accentColor : "#94A3B8" }}>{shortDesc}</p>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${isActive ? "" : "border-[1.5px] border-[#D1D5DB] bg-white"}`}
                      style={isActive ? { backgroundColor: circleActiveBg, boxShadow: `0 0 0 2px ${circleActiveShadow}` } : {}}
                    >
                      {isActive && <Check className="w-3 h-3 text-white" strokeWidth={2.5} />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Payment Term Details */}
        <div>
          <div className="flex items-center gap-1.5 mb-3">
            <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>Payment Term Details</span>
            <Tooltip>
              <TooltipTrigger asChild><span><Info className="w-3.5 h-3.5 text-slate-300 cursor-help" /></span></TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                <p className="text-slate-500">Name, duration, and trigger as they appear on POs and invoices.</p>
              </TooltipContent>
            </Tooltip>
          </div>

          <div className="rounded-xl border border-[#E8ECF1] bg-white p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
              <div>
                <Label className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>
                  {term.category === "net" ? "NET Term Name" : term.category === "prepayment" ? "Prepayment Term Name" : "Split Term Name"}
                </Label>
                <LockedField>
                  <Input
                    value={editName}
                    disabled={fieldsDisabled}
                    onChange={(e) => onChangeName(e.target.value)}
                    className="mt-1 !h-10 text-sm"
                  />
                </LockedField>
              </div>

              <div>
                <Label className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>Trigger Event</Label>
                <Input value={triggerLabel} disabled className="mt-1 !h-10 text-sm" />
              </div>

              {term.category === "net" && (
                <div>
                  <Label className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>NET Duration (Days)</Label>
                  <LockedField>
                    <Input
                      value={editDuration}
                      type="number"
                      inputMode="numeric"
                      disabled={fieldsDisabled}
                      onChange={(e) => onChangeDuration(e.target.value)}
                      className="mt-1 !h-10 text-sm tabular-nums"
                    />
                  </LockedField>
                </div>
              )}

              <div className={term.category === "net" ? "" : "sm:col-span-2"}>
                <Label className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>Description</Label>
                <LockedField>
                  <Input
                    value={editDescription}
                    disabled={fieldsDisabled}
                    onChange={(e) => onChangeDescription(e.target.value)}
                    placeholder="Brief summary of payment term purpose or context."
                    className="mt-1 !h-10 text-sm"
                  />
                </LockedField>
              </div>
            </div>
          </div>
        </div>

        {/* Split milestones */}
        {term.category === "split" && splitMilestones.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>Split Milestones</span>
            </div>
            <div className="rounded-xl border border-[#E8ECF1] bg-white p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {splitMilestones.map((m, i) => (
                <div key={i} className="rounded-lg border border-[#E8ECF1] bg-[#FAFBFC] px-3 py-2 flex items-center justify-between">
                  <span className="text-[11.5px] text-slate-600">{m.label}</span>
                  <span className="text-[12.5px] text-foreground tabular-nums" style={{ fontWeight: 600 }}>{m.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Early Payment Discount */}
        {term.category === "net" && (() => {
          const hasDiscount = !!(term.applyDiscount || term.discountPercent);
          return (
            <div>
              <div className="flex items-center gap-1.5 mb-3">
                <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>Early Payment Discount</span>
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9.5px] border ${hasDiscount ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-slate-50 border-slate-200 text-slate-500"}`} style={{ fontWeight: 600 }}>
                  {hasDiscount ? "Enabled" : "Not configured"}
                </span>
                <Tooltip>
                  <TooltipTrigger asChild><span><Info className="w-3.5 h-3.5 text-slate-300 cursor-help" /></span></TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                    <p className="text-slate-500">Reward early payment with a percent discount applied within a defined window.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="rounded-xl border border-[#E8ECF1] bg-white p-4 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                <div>
                  <Label className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>Discount</Label>
                  <LockedField>
                    <div className="relative mt-1">
                      <Input
                        value={editDiscountPct}
                        type="number"
                        inputMode="decimal"
                        disabled={fieldsDisabled}
                        onChange={(e) => onChangeDiscountPct(e.target.value)}
                        placeholder={hasDiscount ? "" : "—"}
                        className="!h-10 text-sm pr-8 tabular-nums"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400">%</span>
                    </div>
                  </LockedField>
                  <p className="text-[10.5px] text-slate-400 mt-1">Payment-term discounts are percent-only.</p>
                </div>
                <div>
                  <Label className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>Eligible Payment Period</Label>
                  <LockedField>
                    <div className="relative mt-1">
                      <Input
                        value={editDiscountPeriod}
                        type="number"
                        inputMode="numeric"
                        disabled={fieldsDisabled}
                        onChange={(e) => onChangeDiscountPeriod(e.target.value)}
                        placeholder={hasDiscount ? "" : "—"}
                        className="!h-10 text-sm pr-12 tabular-nums"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400">days</span>
                    </div>
                  </LockedField>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Metadata footer */}
        <div className="flex items-center gap-3 pt-2 text-[11.5px] text-slate-500" style={{ fontWeight: 500 }}>
          <span className="inline-flex items-center gap-2">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px]" style={{ backgroundColor: creatorTint.bg, color: creatorTint.fg, fontWeight: 700 }}>OS</div>
            <span>Created by <span className="text-slate-700" style={{ fontWeight: 600 }}>Omnesoft</span></span>
          </span>
          <span className="w-1 h-1 rounded-full bg-slate-300" />
          <span>Updated <span className="text-slate-700" style={{ fontWeight: 600 }}>Dec 15, 2025</span></span>
        </div>

        {/* Save bar — only when editing */}
        {!isPreset && isEditing && (
          <div className="sticky bottom-0 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-white border-t border-[#E8ECF1] flex items-center justify-end gap-2">
            <button
              onClick={handleDiscard}
              className="h-9 px-4 rounded-lg border border-border bg-white text-[13px] text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              style={{ fontWeight: 500 }}
            >
              Discard
            </button>
            <button
              onClick={handleSave}
              className="h-9 px-4 rounded-lg bg-primary text-white text-[13px] hover:bg-primary/90 transition-colors cursor-pointer inline-flex items-center gap-1.5"
              style={{ fontWeight: 600 }}
            >
              <Check className="w-3.5 h-3.5" /> {isTemplateDerived ? "Save as new version" : "Save changes"}
            </button>
          </div>
        )}
      </div>

      <AlertDialog open={versionPromptOpen} onOpenChange={setVersionPromptOpen}>
        <AlertDialogContent className="sm:max-w-[420px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Create a new version?</AlertDialogTitle>
            <AlertDialogDescription>
              This term was derived from a template. Editing it will save your changes as a new version so the original template stays intact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center justify-end gap-2 mt-4">
            <button
              onClick={() => setVersionPromptOpen(false)}
              className="h-9 px-4 rounded-lg border border-border bg-white text-[13px] text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              style={{ fontWeight: 500 }}
            >
              Cancel
            </button>
            <button
              onClick={acknowledgeVersion}
              className="h-9 px-4 rounded-lg bg-primary text-white text-[13px] hover:bg-primary/90 transition-colors cursor-pointer"
              style={{ fontWeight: 600 }}
            >
              Continue editing
            </button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
