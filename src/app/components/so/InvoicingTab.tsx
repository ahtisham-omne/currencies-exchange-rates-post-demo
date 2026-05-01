import { useState, useMemo } from "react";
import {
  ChevronDown, ChevronRight,
  FileText, Plus, Check, AlertTriangle, Upload,
  X, DollarSign, Paperclip, Copy, Receipt, CreditCard, Pencil, Banknote,
  Calendar, CalendarPlus, ArrowUpRight, Clock, ExternalLink, History,
  Ban, Printer, Download,
} from "lucide-react";
import { HighlightText, TabSearchBar, FilterPills } from "./SearchHighlight";
import { ThTooltip, Tooltip } from "./Tooltip";
import { useModalShortcuts, KbdHint, ModalShell } from "./ModalKeyboard";
import { Button } from "./ui/Button";
import type { SalesOrder } from "./types";
import { makeFormatOrderMoney } from "../currency/formatOrderMoney";

/* ═══ Invoice types ═══ */
export type InvoiceStatus = "Paid" | "Pending" | "Overdue" | "Draft" | "Partially Paid" | "Voided";

export interface Invoice {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  amount: number;
  paidAmount: number;
  status: InvoiceStatus;
  description?: string;
  lineItems: { itemCode: string; itemName: string; qty: number; unitPrice: number }[];
  paymentMethod?: string;
  paymentDate?: string;
  receiptFiles?: string[];
  notes?: string;
  createdBy: string;
  createdByInitials: string;
  paymentHistory?: { date: string; amount: number; method: string; reference?: string; receiptFile?: string }[];
  scheduledPayments?: { date: string; amount: number; note?: string }[];
}

/* ═══ Mock invoice data generator ═══ */
function generateMockInvoices(so: SalesOrder): Invoice[] {
  const subtotal = so.lines.reduce((s, l) => s + l.orderedQty * l.unitPrice, 0);
  const invoices: Invoice[] = [];

  if (subtotal > 0) {
    const depositAmt = Math.round(subtotal * 0.6);
    invoices.push({
      id: `INV-${so.id}-1`,
      invoiceNumber: `INV-${so.soNumber.replace("SO-", "")}-001`,
      issueDate: so.createdDate,
      dueDate: "2026/02/15",
      amount: depositAmt,
      paidAmount: depositAmt,
      status: "Paid",
      description: "Initial deposit — 60% of order value",
      lineItems: so.lines.slice(0, Math.min(3, so.lines.length)).map(l => ({
        itemCode: l.itemCode, itemName: l.itemName, qty: l.orderedQty, unitPrice: l.unitPrice,
      })),
      paymentMethod: "Wire Transfer",
      paymentDate: "2026/02/12",
      receiptFiles: ["Payment_Receipt_001.pdf"],
      createdBy: "Sarah Chen",
      createdByInitials: "SC",
      paymentHistory: [
        { date: "2026/01/28", amount: Math.round(depositAmt * 0.5), method: "Wire Transfer", reference: "WT-20260128-4391", receiptFile: "Receipt_Deposit_50pct.pdf" },
        { date: "2026/02/12", amount: Math.round(depositAmt * 0.5), method: "Wire Transfer", reference: "WT-20260212-7724", receiptFile: "Payment_Receipt_001.pdf" },
      ],
    });

    const milestoneAmt = Math.round(subtotal * 0.25);
    invoices.push({
      id: `INV-${so.id}-2`,
      invoiceNumber: `INV-${so.soNumber.replace("SO-", "")}-002`,
      issueDate: "2026/02/20",
      dueDate: "2026/03/20",
      amount: milestoneAmt,
      paidAmount: 0,
      status: "Pending",
      description: "Milestone 2 — manufacturing complete",
      lineItems: so.lines.slice(0, 2).map(l => ({
        itemCode: l.itemCode, itemName: l.itemName, qty: Math.ceil(l.orderedQty * 0.5), unitPrice: l.unitPrice,
      })),
      createdBy: "Tom Mitchell",
      createdByInitials: "TM",
    });

    const finalAmt = subtotal - depositAmt - milestoneAmt;
    if (finalAmt > 0) {
      invoices.push({
        id: `INV-${so.id}-3`,
        invoiceNumber: `INV-${so.soNumber.replace("SO-", "")}-003`,
        issueDate: "2026/01/10",
        dueDate: "2026/02/10",
        amount: finalAmt,
        paidAmount: Math.round(finalAmt * 0.4),
        status: "Partially Paid",
        description: "Final balance — remaining allocation",
        lineItems: so.lines.slice(0, 1).map(l => ({
          itemCode: l.itemCode, itemName: l.itemName, qty: l.orderedQty, unitPrice: l.unitPrice,
        })),
        paymentMethod: "ACH",
        paymentDate: "2026/02/08",
        createdBy: "Ben Parker",
        createdByInitials: "BP",
        paymentHistory: [
          { date: "2026/02/08", amount: Math.round(finalAmt * 0.4), method: "ACH", reference: "ACH-20260208-1155" },
        ],
        scheduledPayments: [
          { date: "2026/03/15", amount: Math.round(finalAmt * 0.35), note: "Milestone 2 payment" },
          { date: "2026/04/10", amount: finalAmt - Math.round(finalAmt * 0.4) - Math.round(finalAmt * 0.35), note: "Final balance" },
        ],
      });
    }

    const overdueAmt = Math.round(subtotal * 0.08);
    if (overdueAmt > 0) {
      invoices.push({
        id: `INV-${so.id}-4`,
        invoiceNumber: `INV-${so.soNumber.replace("SO-", "")}-004`,
        issueDate: "2025/12/15",
        dueDate: "2026/01/15",
        amount: overdueAmt,
        paidAmount: 0,
        status: "Overdue",
        description: "Overdue balance from prior shipment",
        lineItems: so.lines.slice(0, 1).map(l => ({
          itemCode: l.itemCode, itemName: l.itemName, qty: Math.ceil(l.orderedQty * 0.1), unitPrice: l.unitPrice,
        })),
        createdBy: "Lisa Nguyen",
        createdByInitials: "LN",
      });
    }

    const draftAmt1 = Math.round(subtotal * 0.05);
    if (draftAmt1 > 0) {
      invoices.push({
        id: `INV-${so.id}-5`,
        invoiceNumber: `INV-${so.soNumber.replace("SO-", "")}-005`,
        issueDate: "2026/03/08",
        dueDate: "2026/04/08",
        amount: draftAmt1,
        paidAmount: 0,
        status: "Draft",
        lineItems: so.lines.slice(0, 2).map(l => ({
          itemCode: l.itemCode, itemName: l.itemName, qty: Math.ceil(l.orderedQty * 0.15), unitPrice: l.unitPrice,
        })),
        createdBy: "Sarah Chen",
        createdByInitials: "SC",
      });
    }

    const draftAmt2 = Math.round(subtotal * 0.03);
    if (draftAmt2 > 0) {
      invoices.push({
        id: `INV-${so.id}-6`,
        invoiceNumber: `INV-${so.soNumber.replace("SO-", "")}-006`,
        issueDate: "2026/03/10",
        dueDate: "2026/04/10",
        amount: draftAmt2,
        paidAmount: 0,
        status: "Draft",
        description: "Pending final line item confirmation",
        lineItems: so.lines.slice(0, 1).map(l => ({
          itemCode: l.itemCode, itemName: l.itemName, qty: Math.ceil(l.orderedQty * 0.05), unitPrice: l.unitPrice,
        })),
        notes: "Pending final line item confirmation",
        createdBy: "Tom Mitchell",
        createdByInitials: "TM",
      });
    }
  }

  return invoices;
}

/* ═══ Status badge styles ═══ */
const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  Paid: { bg: "bg-accent/10", text: "text-accent" },
  Pending: { bg: "bg-chart-3/10", text: "text-chart-3" },
  Overdue: { bg: "bg-destructive/10", text: "text-destructive" },
  Draft: { bg: "bg-secondary", text: "text-foreground/70" },
  "Partially Paid": { bg: "bg-primary/10", text: "text-primary" },
  Voided: { bg: "bg-secondary", text: "text-foreground/50" },
};

/* ═══ Avatar color helper ═══ */
const AVATAR_COLORS = [
  { bg: "bg-accent/10", text: "text-accent" }, { bg: "bg-chart-3/10", text: "text-chart-3" },
  { bg: "bg-primary/10", text: "text-primary" }, { bg: "bg-chart-4/10", text: "text-chart-4" },
  { bg: "bg-chart-3/15", text: "text-chart-3" }, { bg: "bg-destructive/10", text: "text-destructive" },
];
function avatarColor(initials: string) {
  let h = 0;
  for (let i = 0; i < initials.length; i++) h = initials.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

type InvFilter = "all" | "Paid" | "Pending" | "Overdue" | "Partially Paid" | "Draft";

/* ═══ Shared: Payment Schedule Component ═══ */
function PaymentScheduleSection({
  remainingAfter,
  showSchedule,
  toggleSchedule,
  scheduleRows,
  addScheduleRow,
  removeScheduleRow,
  updateScheduleRow,
  scheduleTotal,
}: {
  remainingAfter: number;
  showSchedule: boolean;
  toggleSchedule: () => void;
  scheduleRows: { date: string; amount: string; note: string }[];
  addScheduleRow: () => void;
  removeScheduleRow: (idx: number) => void;
  updateScheduleRow: (idx: number, field: "date" | "amount" | "note", value: string) => void;
  scheduleTotal: number;
}) {
  if (remainingAfter <= 0) return null;
  return (
    <div>
      <button
        onClick={toggleSchedule}
        className={`flex items-center w-full border rounded-md transition-colors ${showSchedule ? "border-primary/30 bg-primary/5" : "border-border hover:bg-secondary"}`}
        style={{ gap: 8, padding: "8px var(--space-inline-gap)" }}
      >
        <CalendarPlus className={`w-3.5 h-3.5 shrink-0 ${showSchedule ? "text-primary" : "text-foreground/35"}`} />
        <span className={`text-caption font-medium ${showSchedule ? "text-primary" : "text-foreground/60"}`}>
          Schedule Future Payments
        </span>
        <span className="text-foreground/25 text-small ml-auto">{showSchedule ? "Enabled" : "Optional"}</span>
        {showSchedule ? <ChevronDown className="w-3 h-3 text-primary" /> : <ChevronRight className="w-3 h-3 text-foreground/35" />}
      </button>
      {showSchedule && (
        <div className="border border-border rounded-md" style={{ marginTop: 8, overflow: "hidden" }}>
          <div className="bg-secondary flex items-center" style={{ padding: "6px var(--space-inline-gap)", gap: 8 }}>
            <Calendar className="w-3.5 h-3.5 text-foreground/40" />
            <span className="text-foreground/50 text-micro font-semibold tracking-wider">PLANNED INSTALLMENTS</span>
            <span className="ml-auto text-small text-foreground/40 font-medium">
              {scheduleTotal === remainingAfter
                ? <span className="text-accent">Fully allocated</span>
                : <span className="text-chart-3">${(remainingAfter - scheduleTotal).toLocaleString()} unallocated</span>
              }
            </span>
          </div>
          <div className="bg-card" style={{ padding: "var(--space-inline-gap)" }}>
            <div className="flex flex-col" style={{ gap: 6 }}>
              {scheduleRows.map((row, idx) => (
                <div key={idx} className="flex items-center" style={{ gap: 8 }}>
                  <div className="flex items-center border border-border rounded-md bg-input-background" style={{ padding: "0 8px", flex: "0 0 130px" }}>
                    <Calendar className="w-3 h-3 text-foreground/25 shrink-0" />
                    <input type="text" value={row.date} onChange={e => updateScheduleRow(idx, "date", e.target.value)} className="bg-transparent text-foreground outline-none text-small font-medium w-full" style={{ padding: "8px 4px" }} placeholder="YYYY/MM/DD" />
                  </div>
                  <div className="flex items-center border border-border rounded-md bg-input-background" style={{ padding: "0 8px", flex: "0 0 110px" }}>
                    <DollarSign className="w-3 h-3 text-foreground/25 shrink-0" />
                    <input type="text" value={row.amount} onChange={e => updateScheduleRow(idx, "amount", e.target.value)} className="bg-transparent text-foreground outline-none text-small font-medium w-full" style={{ padding: "8px 4px" }} placeholder="0" />
                  </div>
                  <input type="text" value={row.note} onChange={e => updateScheduleRow(idx, "note", e.target.value)} className="flex-1 border border-border rounded-md bg-input-background text-foreground outline-none text-small font-medium min-w-0" style={{ padding: "6px 8px" }} placeholder="Note (optional)" />
                  <button onClick={() => removeScheduleRow(idx)} className="w-6 h-6 rounded flex items-center justify-center hover:bg-secondary text-foreground/25 hover:text-foreground/50 transition-colors shrink-0"><X className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
            <button onClick={addScheduleRow} className="flex items-center text-primary hover:text-primary/80 transition-colors text-caption font-medium" style={{ gap: 4, marginTop: 8 }}>
              <Plus className="w-3 h-3" /> Add installment
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══ Hook: Payment schedule state ═══ */
function usePaymentSchedule(remainingAfter: number, existing?: { date: string; amount: number; note?: string }[]) {
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleRows, setScheduleRows] = useState<{ date: string; amount: string; note: string }[]>(() => {
    if (existing && existing.length > 0) return existing.map(sp => ({ date: sp.date, amount: sp.amount.toString(), note: sp.note || "" }));
    return [];
  });
  const toggleSchedule = () => {
    const next = !showSchedule;
    setShowSchedule(next);
    if (next && scheduleRows.length === 0 && remainingAfter > 0) {
      const half = Math.round(remainingAfter / 2);
      setScheduleRows([
        { date: "2026/04/10", amount: half.toString(), note: "Installment 1" },
        { date: "2026/05/10", amount: (remainingAfter - half).toString(), note: "Final balance" },
      ]);
    }
  };
  const addScheduleRow = () => setScheduleRows(prev => [...prev, { date: "", amount: "", note: "" }]);
  const removeScheduleRow = (idx: number) => setScheduleRows(prev => prev.filter((_, i) => i !== idx));
  const updateScheduleRow = (idx: number, field: "date" | "amount" | "note", value: string) =>
    setScheduleRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  const scheduleTotal = scheduleRows.reduce((s, r) => s + (parseInt(r.amount.replace(/\D/g, "")) || 0), 0);
  const getScheduleData = () => showSchedule && scheduleRows.length > 0 ? scheduleRows.filter(r => r.date && r.amount).map(r => ({ date: r.date, amount: parseInt(r.amount.replace(/\D/g, "")) || 0, note: r.note || undefined })) : undefined;
  return { showSchedule, toggleSchedule, scheduleRows, addScheduleRow, removeScheduleRow, updateScheduleRow, scheduleTotal, getScheduleData };
}

/* ═══ Shared: Receipt Upload ═══ */
function ReceiptUploadSection({ files, setFiles }: { files: string[]; setFiles: React.Dispatch<React.SetStateAction<string[]>> }) {
  const handleAddFile = () => setFiles(prev => [...prev, `Receipt_${prev.length + 1}.pdf`]);
  return (
    <div>
      <div className="text-foreground/50 text-micro font-semibold" style={{ letterSpacing: "0.04em", marginBottom: 6 }}>CONFIRMATION RECEIPT</div>
      <div className="text-foreground/35 text-caption" style={{ marginBottom: 8 }}>
        Upload payment confirmation, bank receipt, or transaction screenshot.
      </div>
      <div onClick={handleAddFile} className="border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary/30 transition-colors" style={{ padding: "var(--space-card-padding)" }}>
        <Upload className="w-5 h-5 text-foreground/25" style={{ marginBottom: 8 }} />
        <span className="text-foreground/50 text-caption font-medium">Drop receipt files here</span>
        <span className="text-foreground/35 text-caption">
          or <span className="text-primary cursor-pointer font-medium">Browse</span>
        </span>
      </div>
      {files.length > 0 && (
        <div className="flex flex-col" style={{ gap: 4, marginTop: 8 }}>
          {files.map((f, i) => (
            <div key={i} className="flex items-center bg-secondary rounded-md" style={{ gap: 8, padding: "6px var(--space-inline-gap)" }}>
              <Paperclip className="w-3 h-3 text-foreground/35 shrink-0" />
              <span className="text-foreground/70 flex-1 text-caption font-medium">{f}</span>
              <button onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-foreground/25 hover:text-foreground/50"><X className="w-3 h-3" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══ Record Payment Modal ═══ */
function MarkAsPaidModal({ invoice, onConfirm, onClose }: {
  invoice: Invoice;
  onConfirm: (files: string[], method: string, notes: string, paymentAmount: number, schedule?: { date: string; amount: number; note?: string }[]) => void;
  onClose: () => void;
}) {
  const [files, setFiles] = useState<string[]>([]);
  const [method, setMethod] = useState("Wire Transfer");
  const [notes, setNotes] = useState("");
  const remaining = invoice.amount - invoice.paidAmount;
  const [paymentType, setPaymentType] = useState<"full" | "partial">("full");
  const [partialAmount, setPartialAmount] = useState(remaining.toString());
  const effectiveAmount = paymentType === "full" ? remaining : Math.min(parseInt(partialAmount.replace(/\D/g, "")) || 0, remaining);
  const remainingAfter = remaining - effectiveAmount;
  const schedule = usePaymentSchedule(remainingAfter, invoice.scheduledPayments);
  const doConfirm = () => { if (effectiveAmount > 0) onConfirm(files, method, notes, effectiveAmount, schedule.getScheduleData()); };
  useModalShortcuts({ onConfirm: doConfirm, onClose, confirmDisabled: effectiveAmount <= 0 });

  return (
    <ModalShell onClose={onClose} maxWidth={640}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border shrink-0" style={{ padding: "var(--space-card-padding)" }}>
          <div className="flex items-center" style={{ gap: "var(--space-inline-gap)" }}>
            <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-accent" />
            </div>
            <div>
              <div className="text-foreground text-label font-semibold">Confirm Payment</div>
              <div className="text-foreground/50 text-caption font-medium">{invoice.invoiceNumber}</div>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-secondary transition-colors">
            <X className="w-4 h-4 text-foreground/50" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto" style={{ padding: "var(--space-card-padding)", display: "flex", flexDirection: "column", gap: "var(--space-stack-gap)" }}>
          {/* Amount summary */}
          <div className="border border-border rounded-lg" style={{ padding: "var(--space-inline-gap) var(--space-card-padding)" }}>
            <div className="flex justify-between text-caption font-medium">
              <span className="text-foreground/50">Invoice Amount</span>
              <span className="text-foreground font-semibold">${invoice.amount.toLocaleString()}</span>
            </div>
            {invoice.paidAmount > 0 && (
              <div className="flex justify-between text-caption font-medium" style={{ marginTop: 6 }}>
                <span className="text-foreground/50">Already Paid</span>
                <span className="text-accent">-${invoice.paidAmount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-border text-caption font-semibold" style={{ marginTop: 8, paddingTop: 8 }}>
              <span className="text-foreground">Outstanding (Balance)</span>
              <span className="text-chart-3">${remaining.toLocaleString()}</span>
            </div>
          </div>

          {/* Payment type toggle */}
          <div>
            <div className="text-foreground/50 text-micro font-semibold" style={{ letterSpacing: "0.04em", marginBottom: 6 }}>PAYMENT TYPE</div>
            <div className="flex rounded-lg border border-border overflow-hidden">
              {(["full", "partial"] as const).map(t => (
                <button key={t} onClick={() => setPaymentType(t)} className={`flex-1 text-caption font-medium transition-colors ${paymentType === t ? "bg-primary text-primary-foreground" : "bg-card text-foreground/60 hover:bg-secondary"}`} style={{ padding: "8px 12px" }}>
                  {t === "full" ? "Full Payment" : "Partial Payment"}
                </button>
              ))}
            </div>
          </div>

          {/* Payment amount */}
          <div>
            <div className="text-foreground/50 text-micro font-semibold" style={{ letterSpacing: "0.04em", marginBottom: 6 }}>PAYMENT AMOUNT</div>
            {paymentType === "full" ? (
              <div className="flex items-center border border-border rounded-md bg-secondary/40" style={{ padding: "8px var(--space-inline-gap)" }}>
                <DollarSign className="w-3.5 h-3.5 text-foreground/35" />
                <span className="text-foreground font-semibold text-caption" style={{ marginLeft: 4 }}>{remaining.toLocaleString()}</span>
                <span className="text-foreground/35 text-small ml-auto">Full balance</span>
              </div>
            ) : (
              <div className="flex items-center border border-border rounded-md bg-input-background focus-within:border-primary/50 transition-colors" style={{ padding: "0 var(--space-inline-gap)" }}>
                <DollarSign className="w-3.5 h-3.5 text-foreground/35" />
                <input type="text" value={partialAmount} onChange={e => setPartialAmount(e.target.value)} className="flex-1 bg-transparent text-foreground outline-none text-caption font-medium" style={{ padding: "8px 6px" }} placeholder="0" autoFocus />
                <span className="text-foreground/35 text-small shrink-0">of ${remaining.toLocaleString()}</span>
              </div>
            )}
            {paymentType === "partial" && remainingAfter > 0 && (
              <div className="flex items-center text-chart-3 text-small font-medium" style={{ marginTop: 6, gap: 4 }}>
                <AlertTriangle className="w-3 h-3 shrink-0" />
                ${remainingAfter.toLocaleString()} will remain outstanding after this payment
              </div>
            )}
          </div>

          {/* Payment Schedule */}
          {paymentType === "partial" && (
            <PaymentScheduleSection remainingAfter={remainingAfter} {...schedule} />
          )}

          {/* Payment Method */}
          <div>
            <div className="text-foreground/50 text-micro font-semibold" style={{ letterSpacing: "0.04em", marginBottom: 6 }}>PAYMENT METHOD</div>
            <select value={method} onChange={e => setMethod(e.target.value)} className="w-full border border-border rounded-md bg-input-background text-foreground outline-none focus:border-primary/50 transition-colors text-caption font-medium" style={{ padding: "8px var(--space-inline-gap)" }}>
              {["Wire Transfer", "ACH", "Credit Card", "Check", "Cash", "PayPal", "Other"].map(m => (<option key={m}>{m}</option>))}
            </select>
          </div>

          {/* Receipt Upload */}
          <ReceiptUploadSection files={files} setFiles={setFiles} />

          {/* Notes */}
          <div>
            <div className="flex items-baseline" style={{ gap: 8 }}>
              <span className="text-foreground/50 text-micro font-semibold" style={{ letterSpacing: "0.04em" }}>REFERENCE / NOTES</span>
              <span className="text-foreground/35 text-caption">(optional)</span>
            </div>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g., Reference number, bank transaction ID..." className="w-full border border-border rounded-md bg-input-background text-foreground placeholder:text-foreground/30 outline-none focus:border-primary/50 transition-colors resize-none text-caption font-medium" style={{ padding: "8px var(--space-inline-gap)", marginTop: 6 }} rows={2} />
          </div>

          {/* Warning */}
          {files.length === 0 && (
            <div className="flex items-center bg-chart-3/8 rounded-md" style={{ gap: 8, padding: "8px var(--space-inline-gap)" }}>
              <AlertTriangle className="w-3.5 h-3.5 text-chart-3 shrink-0" />
              <span className="text-chart-3 text-caption font-medium">
                Upload a payment receipt for audit compliance. You can skip and add later.
              </span>
            </div>
          )}
        </div>

        {/* Footer — stacked on narrow, inline on wide */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-t border-border shrink-0" style={{ padding: "var(--space-card-padding)", gap: "var(--space-inline-gap)" }}>
          <span className="text-foreground/50 text-caption font-medium shrink-0">
            Recording <span className="text-foreground font-semibold">${effectiveAmount.toLocaleString()}</span>
            {paymentType === "partial" && <span className="text-foreground/35"> · {remainingAfter > 0 ? `$${remainingAfter.toLocaleString()} remaining` : "fully paid"}</span>}
          </span>
          <div className="flex items-center shrink-0 self-end sm:self-auto" style={{ gap: "var(--space-inline-gap)" }}>
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cancel <KbdHint keys="Esc" />
            </Button>
            <Button variant="accent" size="sm" onClick={doConfirm} disabled={effectiveAmount <= 0} icon={<Check className="w-3.5 h-3.5" />}>
              {paymentType === "partial" ? "Record Partial" : "Confirm Payment"}
              <KbdHint keys="⌘↵" variant="light" />
            </Button>
          </div>
        </div>
    </ModalShell>
  );
}

/* ═══ Create Invoice Modal (enhanced) ═══ */
function CreateInvoiceModal({ so, onClose, onCreate }: {
  so: SalesOrder;
  onClose: () => void;
  onCreate: (inv: Invoice) => void;
}) {
  const subtotal = so.lines.filter(l => !l.cancelled).reduce((s, l) => s + l.orderedQty * l.unitPrice, 0);
  const [amount, setAmount] = useState(Math.round(subtotal * 0.15).toString());
  const [dueDate, setDueDate] = useState("2026/04/15");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<InvoiceStatus>("Pending");
  const [paymentMethod, setPaymentMethod] = useState("Wire Transfer");
  const [reference, setReference] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const parsedAmount = parseInt(amount.replace(/\D/g, "")) || 0;
  const [paidAmountStr, setPaidAmountStr] = useState(parsedAmount.toString());
  const paidAmount = status === "Paid" ? parsedAmount : status === "Partially Paid" ? Math.min(parseInt(paidAmountStr.replace(/\D/g, "")) || 0, parsedAmount) : 0;
  const remainingAfter = parsedAmount - paidAmount;

  const isPaidStatus = status === "Paid" || status === "Partially Paid";
  const schedule = usePaymentSchedule(remainingAfter);
  const doCreate = () => {
    if (parsedAmount <= 0) return;
    const newInv: Invoice = {
      id: `INV-${so.id}-${Date.now()}`,
      invoiceNumber: `INV-${so.soNumber.replace("SO-", "")}-${String(Date.now()).slice(-3)}`,
      issueDate: "2026/03/10",
      dueDate,
      amount: parsedAmount,
      paidAmount,
      status,
      description: description || undefined,
      lineItems: so.lines.filter(l => !l.cancelled).slice(0, 3).map(l => ({
        itemCode: l.itemCode, itemName: l.itemName, qty: l.orderedQty, unitPrice: l.unitPrice,
      })),
      paymentMethod: isPaidStatus ? paymentMethod : undefined,
      paymentDate: isPaidStatus ? "2026/03/10" : undefined,
      receiptFiles: files.length > 0 ? files : undefined,
      createdBy: "Sarah Chen",
      createdByInitials: "SC",
      paymentHistory: isPaidStatus ? [{ date: "2026/03/10", amount: paidAmount, method: paymentMethod, reference: reference || undefined, receiptFile: files.length > 0 ? files[0] : undefined }] : undefined,
      scheduledPayments: schedule.getScheduleData(),
    };
    onCreate(newInv);
  };
  useModalShortcuts({ onConfirm: doCreate, onClose, confirmDisabled: parsedAmount <= 0 });

  return (
    <ModalShell onClose={onClose} maxWidth={600}>
        <div className="flex items-center justify-between border-b border-border shrink-0" style={{ padding: "var(--space-card-padding)" }}>
          <div className="flex items-center" style={{ gap: "var(--space-inline-gap)" }}>
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="w-4 h-4 text-primary" />
            </div>
            <div>
              <div className="text-foreground text-label font-semibold">Create Invoice</div>
              <div className="text-foreground/50 text-caption font-medium">{so.soNumber}</div>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-secondary transition-colors">
            <X className="w-4 h-4 text-foreground/50" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto" style={{ padding: "var(--space-card-padding)", display: "flex", flexDirection: "column", gap: "var(--space-stack-gap)" }}>
          {/* Amount + Due Date row */}
          <div className="grid grid-cols-2" style={{ gap: "var(--space-inline-gap)" }}>
            <div>
              <div className="text-foreground/50 text-micro font-semibold" style={{ letterSpacing: "0.04em", marginBottom: 6 }}>INVOICE AMOUNT</div>
              <div className="flex items-center border border-border rounded-md bg-input-background" style={{ padding: "0 var(--space-inline-gap)" }}>
                <DollarSign className="w-3.5 h-3.5 text-foreground/35" />
                <input type="text" value={amount} onChange={e => setAmount(e.target.value)} className="flex-1 bg-transparent text-foreground outline-none text-caption font-medium" style={{ padding: "8px 6px" }} />
              </div>
            </div>
            <div>
              <div className="text-foreground/50 text-micro font-semibold" style={{ letterSpacing: "0.04em", marginBottom: 6 }}>DUE DATE</div>
              <div className="flex items-center border border-border rounded-md bg-input-background" style={{ padding: "0 var(--space-inline-gap)" }}>
                <Calendar className="w-3.5 h-3.5 text-foreground/35" />
                <input type="text" value={dueDate} onChange={e => setDueDate(e.target.value)} className="flex-1 bg-transparent text-foreground outline-none text-caption font-medium" style={{ padding: "8px 6px" }} />
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <div className="flex items-baseline" style={{ gap: 8 }}>
              <span className="text-foreground/50 text-micro font-semibold" style={{ letterSpacing: "0.04em" }}>DESCRIPTION</span>
              <span className="text-foreground/35 text-caption">(optional)</span>
            </div>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g., Deposit invoice for Phase 1 delivery" className="w-full border border-border rounded-md bg-input-background text-foreground placeholder:text-foreground/30 outline-none focus:border-primary/50 transition-colors text-caption font-medium" style={{ padding: "8px var(--space-inline-gap)", marginTop: 6 }} />
          </div>

          {/* Payment Status */}
          <div>
            <div className="text-foreground/50 text-micro font-semibold" style={{ letterSpacing: "0.04em", marginBottom: 6 }}>INITIAL STATUS</div>
            <div className="flex rounded-lg border border-border overflow-hidden">
              {(["Draft", "Pending", "Paid", "Partially Paid"] as InvoiceStatus[]).map(s => {
                const ss = STATUS_STYLES[s] || STATUS_STYLES.Draft;
                return (
                  <button key={s} onClick={() => setStatus(s)} className={`flex-1 text-small font-medium transition-colors border-r border-border last:border-r-0 ${status === s ? `${ss.bg} ${ss.text}` : "bg-card text-foreground/50 hover:bg-secondary"}`} style={{ padding: "7px 6px" }}>
                    {s}
                  </button>
                );
              })}
            </div>
            <div className="text-foreground/30 text-small font-medium" style={{ marginTop: 4 }}>
              {status === "Paid" && "Record a fully pre-paid invoice for bookkeeping."}
              {status === "Partially Paid" && "Record an invoice with a partial pre-payment already received."}
              {status === "Pending" && "Invoice will be sent to customer for payment."}
              {status === "Draft" && "Invoice will be saved as draft and not sent yet."}
            </div>
          </div>

          {/* Partial paid amount */}
          {status === "Partially Paid" && (
            <div>
              <div className="text-foreground/50 text-micro font-semibold" style={{ letterSpacing: "0.04em", marginBottom: 6 }}>AMOUNT ALREADY PAID</div>
              <div className="flex items-center border border-border rounded-md bg-input-background focus-within:border-primary/50 transition-colors" style={{ padding: "0 var(--space-inline-gap)" }}>
                <DollarSign className="w-3.5 h-3.5 text-foreground/35" />
                <input type="text" value={paidAmountStr} onChange={e => setPaidAmountStr(e.target.value)} className="flex-1 bg-transparent text-foreground outline-none text-caption font-medium" style={{ padding: "8px 6px" }} placeholder="0" />
                <span className="text-foreground/35 text-small shrink-0">of ${parsedAmount.toLocaleString()}</span>
              </div>
            </div>
          )}

          {/* Payment method + reference for paid statuses */}
          {isPaidStatus && (
            <>
              <div className="grid grid-cols-2" style={{ gap: "var(--space-inline-gap)" }}>
                <div>
                  <div className="text-foreground/50 text-micro font-semibold" style={{ letterSpacing: "0.04em", marginBottom: 6 }}>PAYMENT METHOD</div>
                  <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full border border-border rounded-md bg-input-background text-foreground outline-none focus:border-primary/50 transition-colors text-caption font-medium" style={{ padding: "8px var(--space-inline-gap)" }}>
                    {["Wire Transfer", "ACH", "Credit Card", "Check", "Cash", "PayPal", "Other"].map(m => (<option key={m}>{m}</option>))}
                  </select>
                </div>
                <div>
                  <div className="text-foreground/50 text-micro font-semibold" style={{ letterSpacing: "0.04em", marginBottom: 6 }}>REFERENCE</div>
                  <input type="text" value={reference} onChange={e => setReference(e.target.value)} placeholder="Transaction ID, check number..." className="w-full border border-border rounded-md bg-input-background text-foreground placeholder:text-foreground/30 outline-none focus:border-primary/50 transition-colors text-caption font-medium" style={{ padding: "8px var(--space-inline-gap)" }} />
                </div>
              </div>
              <ReceiptUploadSection files={files} setFiles={setFiles} />
            </>
          )}

          {/* Payment schedule for partially paid */}
          {status === "Partially Paid" && remainingAfter > 0 && (
            <PaymentScheduleSection remainingAfter={remainingAfter} {...schedule} />
          )}

          {/* Info bar */}
          <div className="bg-secondary/60 border border-border rounded-md text-foreground/60 text-caption" style={{ padding: "8px var(--space-inline-gap)" }}>
            Order total: <span className="text-foreground font-semibold">${subtotal.toLocaleString()}</span> — this invoice covers a portion of the balance.
          </div>
        </div>

        <div className="flex items-center justify-end border-t border-border shrink-0" style={{ padding: "var(--space-card-padding)", gap: "var(--space-inline-gap)" }}>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Discard <KbdHint keys="Esc" />
          </Button>
          <Button variant="primary" size="sm" onClick={doCreate} disabled={parsedAmount <= 0} icon={<FileText className="w-3.5 h-3.5" />}>
            Create Invoice
            <KbdHint keys="⌘↵" variant="light" />
          </Button>
        </div>
    </ModalShell>
  );
}

/* ═══ Edit Invoice Modal ═══ */
function EditInvoiceModal({ invoice, fmtMoney, onClose, onSave }: {
  invoice: Invoice;
  fmtMoney: (n: number) => string;
  onClose: () => void;
  onSave: (updated: Partial<Invoice>) => void;
}) {
  const [amount, setAmount] = useState(invoice.amount.toString());
  const [dueDate, setDueDate] = useState(invoice.dueDate);
  const [description, setDescription] = useState(invoice.description || "");
  const [notes, setNotes] = useState(invoice.notes || "");
  const doSave = () => onSave({ amount: parseInt(amount.replace(/\D/g, "")) || invoice.amount, dueDate, description: description || undefined, notes: notes || undefined });
  useModalShortcuts({ onConfirm: doSave, onClose });

  return (
    <ModalShell onClose={onClose} maxWidth={520}>
        <div className="flex items-center justify-between border-b border-border shrink-0" style={{ padding: "var(--space-card-padding)" }}>
          <div className="flex items-center" style={{ gap: "var(--space-inline-gap)" }}>
            <div className="w-9 h-9 rounded-lg bg-chart-3/10 flex items-center justify-center">
              <Pencil className="w-4 h-4 text-chart-3" />
            </div>
            <div>
              <div className="text-foreground text-label font-semibold">Edit Invoice</div>
              <div className="text-foreground/50 text-caption font-medium">{invoice.invoiceNumber}</div>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-secondary transition-colors">
            <X className="w-4 h-4 text-foreground/50" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto" style={{ padding: "var(--space-card-padding)", display: "flex", flexDirection: "column", gap: "var(--space-stack-gap)" }}>
          <div className="grid grid-cols-2" style={{ gap: "var(--space-inline-gap)" }}>
            <div>
              <div className="text-foreground/50 text-micro font-semibold" style={{ letterSpacing: "0.04em", marginBottom: 6 }}>INVOICE AMOUNT</div>
              <div className="flex items-center border border-border rounded-md bg-input-background" style={{ padding: "0 var(--space-inline-gap)" }}>
                <DollarSign className="w-3.5 h-3.5 text-foreground/35" />
                <input type="text" value={amount} onChange={e => setAmount(e.target.value)} className="flex-1 bg-transparent text-foreground outline-none text-caption font-medium" style={{ padding: "8px 6px" }} />
              </div>
            </div>
            <div>
              <div className="text-foreground/50 text-micro font-semibold" style={{ letterSpacing: "0.04em", marginBottom: 6 }}>DUE DATE</div>
              <div className="flex items-center border border-border rounded-md bg-input-background" style={{ padding: "0 var(--space-inline-gap)" }}>
                <Calendar className="w-3.5 h-3.5 text-foreground/35" />
                <input type="text" value={dueDate} onChange={e => setDueDate(e.target.value)} className="flex-1 bg-transparent text-foreground outline-none text-caption font-medium" style={{ padding: "8px 6px" }} />
              </div>
            </div>
          </div>
          <div>
            <div className="flex items-baseline" style={{ gap: 8 }}>
              <span className="text-foreground/50 text-micro font-semibold" style={{ letterSpacing: "0.04em" }}>DESCRIPTION</span>
              <span className="text-foreground/35 text-caption">(optional)</span>
            </div>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description of this invoice" className="w-full border border-border rounded-md bg-input-background text-foreground placeholder:text-foreground/30 outline-none focus:border-primary/50 transition-colors text-caption font-medium" style={{ padding: "8px var(--space-inline-gap)", marginTop: 6 }} />
          </div>
          <div>
            <div className="flex items-baseline" style={{ gap: 8 }}>
              <span className="text-foreground/50 text-micro font-semibold" style={{ letterSpacing: "0.04em" }}>NOTES</span>
              <span className="text-foreground/35 text-caption">(optional)</span>
            </div>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Internal notes..." className="w-full border border-border rounded-md bg-input-background text-foreground placeholder:text-foreground/30 outline-none focus:border-primary/50 transition-colors resize-none text-caption font-medium" style={{ padding: "8px var(--space-inline-gap)", marginTop: 6 }} rows={2} />
          </div>

          {/* Current status info */}
          <div className="border border-border rounded-md" style={{ padding: "var(--space-inline-gap) var(--space-card-padding)" }}>
            <div className="flex justify-between text-caption">
              <span className="text-foreground/50">Status</span>
              <span className={`font-medium ${(STATUS_STYLES[invoice.status] || STATUS_STYLES.Draft).text}`}>{invoice.status}</span>
            </div>
            <div className="flex justify-between text-caption" style={{ marginTop: 4 }}>
              <span className="text-foreground/50">Paid</span>
              <span className="text-accent font-medium">{fmtMoney(invoice.paidAmount)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end border-t border-border shrink-0" style={{ padding: "var(--space-card-padding)", gap: "var(--space-inline-gap)" }}>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel <KbdHint keys="Esc" />
          </Button>
          <Button variant="accent" size="sm" onClick={doSave} icon={<Check className="w-3.5 h-3.5" />}>
            Save Changes
            <KbdHint keys="⌘↵" variant="light" />
          </Button>
        </div>
    </ModalShell>
  );
}

/* ═══ Invoice Detail Modal — replaces expanded rows ═══ */
function InvoiceDetailModal({ invoice, fmtMoney, onClose, onRecordPayment, onEdit, onVoid }: {
  invoice: Invoice;
  fmtMoney: (n: number) => string;
  onClose: () => void;
  onRecordPayment: () => void;
  onEdit: () => void;
  onVoid: () => void;
}) {
  const ss = STATUS_STYLES[invoice.status] || STATUS_STYLES.Draft;
  const ac = avatarColor(invoice.createdByInitials);
  const remaining = invoice.amount - invoice.paidAmount;
  const canMarkPaid = invoice.status === "Pending" || invoice.status === "Overdue" || invoice.status === "Partially Paid";
  const collectedPct = invoice.amount > 0 ? Math.round((invoice.paidAmount / invoice.amount) * 100) : 0;
  const [activeSection, setActiveSection] = useState<"overview" | "history">("overview");
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);
  const canVoid = invoice.status !== "Voided" && invoice.status !== "Paid";
  useModalShortcuts({ onClose });

  return (
    <ModalShell onClose={onClose} maxWidth={720}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border shrink-0" style={{ padding: "var(--space-card-padding)" }}>
          <div className="flex items-center" style={{ gap: "var(--space-inline-gap)" }}>
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Receipt className="w-4 h-4 text-primary" />
            </div>
            <div>
              <div className="flex items-center" style={{ gap: 8 }}>
                <span className="text-foreground text-label font-semibold">{invoice.invoiceNumber}</span>
                <span className={`inline-flex items-center px-2 py-[2px] rounded text-small font-medium ${ss.bg} ${ss.text}`}>{invoice.status}</span>
              </div>
              {invoice.description && (
                <div className="text-foreground/50 text-caption" style={{ marginTop: 1 }}>{invoice.description}</div>
              )}
            </div>
          </div>
          <div className="flex items-center" style={{ gap: 8 }}>
            {canMarkPaid && (
              <Button variant="accent" size="sm" onClick={() => { onClose(); onRecordPayment(); }} icon={<Banknote className="w-3.5 h-3.5" />}>
                Record Payment
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={() => { onClose(); onEdit(); }} icon={<Pencil className="w-3 h-3" />}>
              Edit
            </Button>
            {canVoid && (
              <Button variant="destructive" size="sm" onClick={() => setShowVoidConfirm(true)} icon={<Ban className="w-3 h-3" />}>
                Void
              </Button>
            )}
            <button onClick={onClose} className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-secondary transition-colors">
              <X className="w-4 h-4 text-foreground/50" />
            </button>
          </div>
        </div>

        {/* Section tabs */}
        <div className="flex border-b border-border shrink-0" style={{ padding: "0 var(--space-card-padding)" }}>
          {([
            { key: "overview" as const, label: "Overview", icon: FileText },
            { key: "history" as const, label: "Payment History", icon: History },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveSection(tab.key)}
              className={`flex items-center text-caption font-medium transition-colors border-b-2 ${activeSection === tab.key ? "border-primary text-primary" : "border-transparent text-foreground/50 hover:text-foreground/70"}`}
              style={{ gap: 8, padding: "12px 16px" }}
            >
              <tab.icon className="w-3.5 h-3.5" /> {tab.label}
              {tab.key === "history" && invoice.paymentHistory && invoice.paymentHistory.length > 0 && (
                <span className="text-micro bg-border rounded-full px-1.5 py-px min-w-[16px] text-center text-foreground/50 font-semibold">{invoice.paymentHistory.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto" style={{ padding: "var(--space-card-padding)" }}>
          {activeSection === "overview" ? (
            <div className="flex flex-col" style={{ gap: "var(--space-stack-gap)" }}>
              {/* Financial summary */}
              <div className="grid grid-cols-3" style={{ gap: "var(--space-inline-gap)" }}>
                {[
                  { label: "Invoice Amount", value: fmtMoney(invoice.amount), color: "text-foreground" },
                  { label: "Paid", value: fmtMoney(invoice.paidAmount), color: "text-accent" },
                  { label: "Outstanding", value: fmtMoney(remaining), color: remaining > 0 ? "text-chart-3" : "text-accent" },
                ].map(item => (
                  <div key={item.label} className="border border-border rounded-lg text-center" style={{ padding: "8px var(--space-inline-gap)" }}>
                    <div className="text-foreground/40 text-micro font-semibold tracking-wider" style={{ marginBottom: 3 }}>{item.label}</div>
                    <div className={`font-semibold ${item.color}`} style={{ fontSize: "var(--text-label)" }}>{item.value}</div>
                  </div>
                ))}
              </div>

              {/* Progress bar */}
              {invoice.amount > 0 && (
                <div>
                  <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                    <span className="text-foreground/40 text-small font-medium">Collection Progress</span>
                    <span className="text-foreground text-caption font-semibold">{collectedPct}%</span>
                  </div>
                  <div className="flex rounded-full overflow-hidden" style={{ height: 6, background: "var(--secondary)" }}>
                    {collectedPct > 0 && <div style={{ width: `${collectedPct}%`, backgroundColor: "var(--accent)", transition: "width 400ms ease" }} />}
                  </div>
                </div>
              )}

              {/* Details grid */}
              <div className="grid grid-cols-2" style={{ gap: "var(--space-inline-gap)" }}>
                <div className="border border-border rounded-lg" style={{ padding: "var(--space-inline-gap) var(--space-card-padding)" }}>
                  <div className="text-micro text-foreground/40 font-semibold tracking-wider" style={{ marginBottom: 8 }}>INVOICE DETAILS</div>
                  <div className="flex flex-col" style={{ gap: 6 }}>
                    {[
                      { l: "Issued", v: invoice.issueDate },
                      { l: "Due Date", v: invoice.dueDate, warn: invoice.status === "Overdue" },
                      { l: "Method", v: invoice.paymentMethod || "\u2014" },
                      { l: "Last Paid", v: invoice.paymentDate || "\u2014" },
                    ].map(r => (
                      <div key={r.l} className="flex items-center justify-between">
                        <span className="text-caption text-foreground/50">{r.l}</span>
                        <span className={`text-caption font-medium ${r.warn ? "text-destructive" : "text-foreground"}`}>{r.v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border border-border rounded-lg" style={{ padding: "var(--space-inline-gap) var(--space-card-padding)" }}>
                  <div className="text-micro text-foreground/40 font-semibold tracking-wider" style={{ marginBottom: 8 }}>CREATED BY</div>
                  <div className="flex items-center" style={{ gap: 12, marginBottom: 12 }}>
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-small font-semibold ${ac.bg} ${ac.text}`}>{invoice.createdByInitials}</span>
                    <div>
                      <div className="text-foreground text-caption font-medium">{invoice.createdBy}</div>
                      <div className="text-foreground/40 text-small">{invoice.issueDate}</div>
                    </div>
                  </div>
                  {invoice.receiptFiles && invoice.receiptFiles.length > 0 && (
                    <>
                      <div className="text-micro text-foreground/40 font-semibold tracking-wider" style={{ marginBottom: 6 }}>RECEIPTS</div>
                      <div className="flex flex-col" style={{ gap: 4 }}>
                        {invoice.receiptFiles.map((f, i) => (
                          <div key={i} className="flex items-center" style={{ gap: 6 }}>
                            <Paperclip className="w-3 h-3 text-foreground/25 shrink-0" />
                            <span className="text-caption text-primary font-medium">{f}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Line items */}
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="bg-secondary" style={{ padding: "8px var(--space-card-padding)" }}>
                  <span className="text-micro text-foreground/40 font-semibold tracking-wider">LINE ITEMS</span>
                </div>
                <div style={{ padding: "var(--space-inline-gap) var(--space-card-padding)" }}>
                  <div className="flex flex-col" style={{ gap: 8 }}>
                    {invoice.lineItems.map((li, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <div className="flex items-center min-w-0" style={{ gap: 12 }}>
                          <span className="text-caption text-primary font-medium">{li.itemCode}</span>
                          <span className="text-caption text-foreground/50 truncate">{li.itemName}</span>
                        </div>
                        <div className="flex items-center shrink-0" style={{ gap: 8 }}>
                          <span className="text-small text-foreground/40">{li.qty} × {fmtMoney(li.unitPrice)}</span>
                          <span className="text-caption text-foreground font-semibold">{fmtMoney(li.qty * li.unitPrice)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Scheduled payments */}
              {invoice.scheduledPayments && invoice.scheduledPayments.length > 0 && (
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="bg-secondary flex items-center" style={{ padding: "8px var(--space-card-padding)", gap: 8 }}>
                    <CalendarPlus className="w-3.5 h-3.5 text-foreground/40" />
                    <span className="text-micro text-foreground/40 font-semibold tracking-wider">SCHEDULED PAYMENTS</span>
                  </div>
                  <div style={{ padding: "var(--space-inline-gap) var(--space-card-padding)" }}>
                    <div className="flex flex-col" style={{ gap: 8 }}>
                      {invoice.scheduledPayments.map((sp, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                          <div className="flex items-center" style={{ gap: 8 }}>
                            <div className="w-2 h-2 rounded-full border-2 border-chart-3/40" />
                            <span className="text-caption text-foreground/50 font-medium">{sp.note || `Payment ${idx + 1}`}</span>
                          </div>
                          <div className="flex items-center" style={{ gap: 12 }}>
                            <span className="text-small text-foreground/40">{sp.date}</span>
                            <span className="text-caption text-foreground font-semibold">{fmtMoney(sp.amount)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ── Payment History section ── */
            <div className="flex flex-col" style={{ gap: "var(--space-stack-gap)" }}>
              {(!invoice.paymentHistory || invoice.paymentHistory.length === 0) ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center" style={{ marginBottom: 12 }}>
                    <History className="w-5 h-5 text-foreground/25" />
                  </div>
                  <div className="text-foreground/50 text-caption font-medium">No payments recorded yet</div>
                  <div className="text-foreground/30 text-caption" style={{ marginTop: 4 }}>Payments will appear here as they are collected.</div>
                  {canMarkPaid && (
                    <button onClick={() => { onClose(); onRecordPayment(); }} className="inline-flex items-center rounded-md bg-accent text-accent-foreground hover:bg-accent/90 transition-colors text-caption font-medium" style={{ gap: 5, padding: "6px 12px", marginTop: 16 }}>
                      <Banknote className="w-3.5 h-3.5" /> Record First Payment
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {/* Summary strip */}
                  <div className="flex items-center justify-between border border-border rounded-lg" style={{ padding: "var(--space-inline-gap) var(--space-card-padding)" }}>
                    <div className="flex items-center" style={{ gap: 10 }}>
                      <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                        <Check className="w-4 h-4 text-accent" />
                      </div>
                      <div>
                        <div className="text-foreground text-label font-semibold">{fmtMoney(invoice.paidAmount)}</div>
                        <div className="text-foreground/40 text-small">collected across {invoice.paymentHistory.length} payment{invoice.paymentHistory.length > 1 ? "s" : ""}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-label font-semibold ${remaining > 0 ? "text-chart-3" : "text-accent"}`}>
                        {remaining > 0 ? `${fmtMoney(remaining)} due` : "Fully paid"}
                      </div>
                      <div className="text-foreground/40 text-small">{collectedPct}% collected</div>
                    </div>
                  </div>

                  {/* Export / Print toolbar */}
                  <div className="flex items-center justify-end" style={{ gap: 6 }}>
                    <button
                      onClick={() => window.print()}
                      className="inline-flex items-center rounded-md border border-border bg-card text-foreground/50 hover:text-foreground hover:bg-secondary transition-colors text-small font-medium"
                      style={{ gap: 5, padding: "5px 10px" }}
                    >
                      <Printer className="w-3 h-3" /> Print Report
                    </button>
                    <button
                      className="inline-flex items-center rounded-md border border-border bg-card text-foreground/50 hover:text-foreground hover:bg-secondary transition-colors text-small font-medium"
                      style={{ gap: 5, padding: "5px 10px" }}
                    >
                      <Download className="w-3 h-3" /> Export CSV
                    </button>
                  </div>

                  {/* Timeline */}
                  <div className="relative" style={{ paddingLeft: 24 }}>
                    {/* Timeline line */}
                    <div className="absolute bg-border" style={{ left: 8, top: 8, width: 2, bottom: invoice.scheduledPayments && invoice.scheduledPayments.length > 0 ? 0 : 16, borderRadius: 1 }} />
                    <div className="flex flex-col" style={{ gap: 0 }}>
                      {invoice.paymentHistory.map((ph, phIdx) => (
                        <div key={phIdx} className="relative group" style={{ paddingBottom: 24 }}>
                          {/* Timeline dot */}
                          <div className="absolute rounded-full bg-accent" style={{ width: 12, height: 12, left: -24 + 2, top: 4, border: "3px solid var(--card)" }} />
                          <div className="border border-border rounded-lg hover:border-primary/20 transition-colors" style={{ padding: "var(--space-inline-gap) var(--space-card-padding)" }}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center" style={{ gap: 8 }}>
                                <span className="text-foreground text-label font-semibold">{fmtMoney(ph.amount)}</span>
                                <span className="text-small text-foreground/40 border border-border rounded px-1.5 py-px font-medium">{ph.method}</span>
                              </div>
                              <span className="text-foreground/40 text-caption font-medium">{ph.date}</span>
                            </div>
                            {ph.reference && (
                              <div className="flex items-center" style={{ gap: 6, marginTop: 6 }}>
                                <span className="text-micro text-foreground/30 font-semibold tracking-wider">REF</span>
                                <span className="text-caption text-foreground/60 font-medium">{ph.reference}</span>
                                <button className="w-5 h-5 rounded flex items-center justify-center hover:bg-secondary opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Copy className="w-2.5 h-2.5 text-foreground/30" />
                                </button>
                              </div>
                            )}
                            {ph.receiptFile && (
                              <div className="flex items-center bg-secondary rounded-md" style={{ gap: 6, padding: "4px 8px", marginTop: 6, display: "inline-flex" }}>
                                <Paperclip className="w-3 h-3 text-foreground/25" />
                                <span className="text-caption text-primary font-medium">{ph.receiptFile}</span>
                                <ExternalLink className="w-3 h-3 text-primary/50" />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}

                      {/* Scheduled payments on timeline */}
                      {invoice.scheduledPayments && invoice.scheduledPayments.length > 0 && (
                        <>
                          <div className="relative" style={{ paddingBottom: 12 }}>
                            <div className="absolute rounded-sm bg-chart-3/30" style={{ width: 12, height: 3, left: -24 + 2, top: 8 }} />
                            <span className="text-micro text-foreground/30 font-semibold tracking-widest">UPCOMING</span>
                          </div>
                          {invoice.scheduledPayments.map((sp, spIdx) => (
                            <div key={`sp-${spIdx}`} className="relative" style={{ paddingBottom: 20 }}>
                              <div className="absolute rounded-full border-2 border-chart-3/40 bg-card" style={{ width: 12, height: 12, left: -24 + 2, top: 4 }} />
                              <div className="border border-dashed border-border rounded-lg" style={{ padding: "var(--space-inline-gap) var(--space-card-padding)" }}>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center" style={{ gap: 8 }}>
                                    <span className="text-foreground/50 text-label font-semibold">{fmtMoney(sp.amount)}</span>
                                    {sp.note && <span className="text-small text-foreground/35 font-medium">{sp.note}</span>}
                                  </div>
                                  <div className="flex items-center" style={{ gap: 6 }}>
                                    <Clock className="w-3 h-3 text-chart-3/60" />
                                    <span className="text-foreground/40 text-caption font-medium">{sp.date}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Void confirmation inline */}
        {showVoidConfirm && (
          <div className="border-t border-destructive/20 bg-destructive/5 shrink-0" style={{ padding: "var(--space-inline-gap) var(--space-card-padding)" }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center" style={{ gap: 8 }}>
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                <div>
                  <div className="text-destructive text-caption font-semibold">Void this invoice?</div>
                  <div className="text-destructive/60 text-small">This will mark {invoice.invoiceNumber} as voided. Outstanding balance will be zeroed.</div>
                </div>
              </div>
              <div className="flex items-center shrink-0" style={{ gap: 8 }}>
                <button onClick={() => setShowVoidConfirm(false)} className="inline-flex items-center rounded-md border border-border bg-card text-foreground/70 hover:bg-secondary transition-colors text-caption font-medium" style={{ padding: "5px 12px" }}>
                  Cancel
                </button>
                <button onClick={() => { onVoid(); onClose(); }} className="inline-flex items-center rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors text-caption font-semibold" style={{ gap: 5, padding: "5px 12px" }}>
                  <Ban className="w-3 h-3" /> Confirm Void
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border shrink-0" style={{ padding: "var(--space-card-padding)" }}>
          <div className="flex items-center" style={{ gap: 8 }}>
            <Tooltip text="Copy invoice number" position="top">
              <button className="w-8 h-8 rounded-md flex items-center justify-center border border-border hover:bg-secondary transition-colors" aria-label="Copy invoice number">
                <Copy className="w-3.5 h-3.5 text-foreground/40" />
              </button>
            </Tooltip>
          </div>
          <button onClick={onClose} className="inline-flex items-center justify-center border border-border rounded-md bg-card text-foreground/70 hover:bg-secondary hover:text-foreground transition-colors text-caption font-medium whitespace-nowrap" style={{ padding: "6px 14px", gap: 6 }}>
            Close <KbdHint keys="Esc" />
          </button>
        </div>
    </ModalShell>
  );
}

/* ═══ Main Component ═══ */
export function InvoicingTab({ so, viewMode = "base" }: { so: SalesOrder; viewMode?: "base" | "customer" }) {
  const fmtMoney = makeFormatOrderMoney(so.currency, viewMode);
  const [invoices, setInvoices] = useState<Invoice[]>(() => generateMockInvoices(so));
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<InvFilter>("all");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [markPaidInvoice, setMarkPaidInvoice] = useState<Invoice | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null);
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);

  const toggle = (k: string) => setCollapsed(p => ({ ...p, [k]: !p[k] }));

  const totalInvoiced = invoices.reduce((s, inv) => s + inv.amount, 0);
  const totalPaid = invoices.reduce((s, inv) => s + inv.paidAmount, 0);
  const totalPending = totalInvoiced - totalPaid;
  const paidPct = totalInvoiced > 0 ? Math.round((totalPaid / totalInvoiced) * 100) : 0;

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    invoices.forEach(inv => { counts[inv.status] = (counts[inv.status] || 0) + 1; });
    return counts;
  }, [invoices]);

  const paidInvoices = useMemo(() => invoices.filter(inv => inv.status === "Paid"), [invoices]);
  const overdueInvoices = useMemo(() => invoices.filter(inv => inv.status === "Overdue"), [invoices]);

  const filteredInvoices = useMemo(() => {
    let list = invoices;
    if (filter !== "all") list = list.filter(inv => inv.status === filter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(inv =>
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.createdBy.toLowerCase().includes(q) ||
        (inv.description || "").toLowerCase().includes(q) ||
        inv.lineItems.some(li => li.itemCode.toLowerCase().includes(q) || li.itemName.toLowerCase().includes(q))
      );
    }
    return list;
  }, [invoices, filter, search]);

  const pills: { key: InvFilter; label: string; count: number }[] = [
    { key: "all", label: "All", count: invoices.length },
    { key: "Paid", label: "Paid", count: statusCounts["Paid"] || 0 },
    { key: "Pending", label: "Pending", count: statusCounts["Pending"] || 0 },
    { key: "Partially Paid", label: "Partial", count: statusCounts["Partially Paid"] || 0 },
    { key: "Overdue", label: "Overdue", count: statusCounts["Overdue"] || 0 },
    { key: "Draft", label: "Draft", count: statusCounts["Draft"] || 0 },
  ].filter((p): p is { key: InvFilter; label: string; count: number } => p.key === "all" || p.count > 0);

  const handleMarkPaid = (inv: Invoice, files: string[], method: string, _notes: string, paymentAmount: number, schedule?: { date: string; amount: number; note?: string }[]) => {
    setInvoices(prev => prev.map(i => {
      if (i.id !== inv.id) return i;
      const newPaid = i.paidAmount + paymentAmount;
      const fullyPaid = newPaid >= i.amount;
      const historyEntry = { date: "2026/03/10", amount: paymentAmount, method, reference: `${method.replace(/\s/g, "").slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-8)}`, receiptFile: files.length > 0 ? files[0] : undefined };
      return {
        ...i,
        status: (fullyPaid ? "Paid" : "Partially Paid") as InvoiceStatus,
        paidAmount: Math.min(newPaid, i.amount),
        paymentMethod: method,
        paymentDate: "2026/03/10",
        receiptFiles: files.length > 0 ? [...(i.receiptFiles || []), ...files] : i.receiptFiles,
        paymentHistory: [...(i.paymentHistory || []), historyEntry],
        scheduledPayments: schedule && schedule.length > 0 ? schedule : i.scheduledPayments,
      };
    }));
    setMarkPaidInvoice(null);
  };

  const handleCreateInvoice = (inv: Invoice) => {
    setInvoices(prev => [...prev, inv]);
    setShowCreateModal(false);
  };

  const handleEditSave = (invId: string, updates: Partial<Invoice>) => {
    setInvoices(prev => prev.map(i => i.id === invId ? { ...i, ...updates } : i));
    setEditInvoice(null);
  };

  const handleVoidInvoice = (invId: string) => {
    setInvoices(prev => prev.map(i => i.id === invId ? { ...i, status: "Voided" as InvoiceStatus, paidAmount: 0 } : i));
  };

  const receiptSection = paidInvoices.filter(inv =>
    inv.receiptFiles && inv.receiptFiles.length > 0 &&
    (filter === "all" || filter === "Paid") &&
    (!search || inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) || inv.createdBy.toLowerCase().includes(search.toLowerCase()))
  );

  if (invoices.length === 0) {
    return <div className="bg-card rounded-xl border border-border p-8 text-center text-foreground/50 text-caption shadow-elevation-sm" role="status">No invoices yet. Create an invoice to start tracking payments for this order.</div>;
  }

  return (
    <>
      <div className="bg-card rounded-xl border border-border" role="region" aria-label="Invoicing">
        <TabSearchBar
          search={search}
          onSearchChange={setSearch}
          placeholder="Search invoices..."
          leftContent={
            <span
              className="text-foreground/50"
              style={{ fontSize: "var(--text-small)", fontWeight: "var(--font-weight-medium)" }}
            >
              {filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? "s" : ""} · {fmtMoney(totalInvoiced)}
            </span>
          }
        >
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            style={{ gap: 5, padding: "6px 10px", fontSize: "var(--text-small)", fontWeight: "var(--font-weight-medium)" }}
          >
            <Plus className="w-3 h-3" /> New Invoice
          </button>
        </TabSearchBar>

        <FilterPills pills={pills} active={filter} onSelect={setFilter} />

        {/* Collection Progress + Tables */}
        <div style={{ padding: "0 var(--space-card-padding) var(--space-card-padding)" }} className="space-y-3">
        <div className="border border-border rounded-lg overflow-hidden shadow-elevation-sm">
          <div className="bg-secondary px-3 py-1.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <DollarSign className="w-3 h-3 text-foreground/50" aria-hidden="true" />
              <span className="text-small text-foreground font-semibold">Collection Progress</span>
              <span className="text-micro text-foreground/50 bg-border rounded-full px-1.5 py-[1px] min-w-[16px] text-center font-medium">{paidPct}%</span>
            </div>
            <span className="text-small text-foreground/70 font-medium">{fmtMoney(totalPaid)} of {fmtMoney(totalInvoiced)}</span>
          </div>
          <div className="bg-card px-3 py-2.5">
            <div className="flex rounded-full overflow-hidden" style={{ height: 5, background: "var(--secondary)" }}>
              {paidPct > 0 && <div style={{ width: `${paidPct}%`, backgroundColor: "var(--accent)", transition: "width 400ms ease" }} />}
              {paidPct < 100 && <div style={{ width: `${100 - paidPct}%`, backgroundColor: "var(--chart-3)", opacity: 0.25, transition: "width 400ms ease" }} />}
            </div>
            <div className="flex items-center gap-3 mt-1.5">
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                <span className="text-micro text-foreground/50 font-medium">Paid</span>
                <span className="text-small text-accent font-semibold">{fmtMoney(totalPaid)}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-chart-3/40" />
                <span className="text-micro text-foreground/50 font-medium">Outstanding</span>
                <span className="text-small text-chart-3 font-semibold">{fmtMoney(totalPending)}</span>
              </div>
            </div>

            {overdueInvoices.length > 0 && (
              <div className="border-t border-border" style={{ marginTop: 8, paddingTop: 8 }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
                  <div className="flex items-center" style={{ gap: 4 }}>
                    <AlertTriangle className="w-2.5 h-2.5 text-destructive" />
                    <span className="text-micro text-destructive font-semibold">
                      {overdueInvoices.length} Overdue — Record Collection
                    </span>
                  </div>
                  <span className="text-micro text-destructive/60 font-medium">
                    {fmtMoney(overdueInvoices.reduce((s, inv) => s + (inv.amount - inv.paidAmount), 0))} total
                  </span>
                </div>
                <div className="flex flex-col" style={{ gap: 3 }}>
                  {overdueInvoices.map(inv => {
                    const bal = inv.amount - inv.paidAmount;
                    return (
                      <div key={inv.id} className="flex items-center justify-between bg-destructive/5 rounded group" style={{ padding: "4px 8px" }}>
                        <div className="flex items-center" style={{ gap: 6 }}>
                          <span className="text-small text-primary font-medium">{inv.invoiceNumber}</span>
                          <span className="text-micro text-foreground/40">Due {inv.dueDate}</span>
                        </div>
                        <div className="flex items-center" style={{ gap: 6 }}>
                          <span className="text-small text-destructive font-semibold">{fmtMoney(bal)}</span>
                          <button
                            onClick={() => setMarkPaidInvoice(inv)}
                            className="inline-flex items-center rounded bg-accent text-accent-foreground hover:bg-accent/90 transition-colors opacity-60 group-hover:opacity-100 text-micro font-semibold"
                            style={{ gap: 3, padding: "2px 6px" }}
                          >
                            <Banknote className="w-2.5 h-2.5" /> Record
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

          {/* Invoices table */}
          {filteredInvoices.length > 0 && (() => {
            const open = collapsed["invoices"] !== true;
            return (
              <div className="border border-border rounded-lg overflow-hidden shadow-elevation-sm">
                <div className="flex items-center justify-between bg-secondary px-3">
                  <button onClick={() => toggle("invoices")} className="flex items-center gap-1.5 py-2 text-left hover:opacity-80 transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" aria-expanded={open} aria-controls="lt-invoices">
                    {open ? <ChevronDown className="w-3.5 h-3.5 text-foreground/50" aria-hidden="true" /> : <ChevronRight className="w-3.5 h-3.5 text-foreground/50" aria-hidden="true" />}
                    <Receipt className="w-3.5 h-3.5 text-foreground/50" aria-hidden="true" />
                    <span className="text-small text-foreground font-semibold">Invoices</span>
                    <span className="text-micro text-foreground/50 bg-border rounded-full px-1.5 py-[1px] min-w-[16px] text-center font-medium">{filteredInvoices.length}</span>
                  </button>
                  <span className="text-small text-foreground font-medium">{fmtMoney(filteredInvoices.reduce((s, inv) => s + inv.amount, 0))}</span>
                </div>
                {open && (
                  <div className="overflow-x-auto bg-card" id="lt-invoices">
                    <table className="w-full text-small table-fixed" role="table" aria-label="Invoices list">
                      <thead>
                        <tr className="border-b border-border bg-secondary/30">
                          {[
                            { col: "NUMBER", tip: "Invoice reference number", hide: "", align: "text-left", width: "18%" },
                            { col: "STATUS", tip: "Current payment status", hide: "", align: "text-left", width: "11%" },
                            { col: "ISSUED", tip: "Date the invoice was issued", hide: "hidden md:table-cell", align: "text-left", width: "11%" },
                            { col: "DUE", tip: "Payment due date", hide: "", align: "text-left", width: "11%" },
                            { col: "AMOUNT", tip: "Total invoiced amount", hide: "", align: "text-right", width: "12%" },
                            { col: "PAID", tip: "Amount collected so far", hide: "", align: "text-right", width: "17%" },
                            { col: "CREATED BY", tip: "User who created this invoice", hide: "hidden lg:table-cell", align: "text-left", width: "12%" },
                          ].map(c => (
                            <th key={c.col} scope="col" className={`py-1.5 px-3 text-micro text-foreground/40 whitespace-nowrap font-semibold tracking-wider ${c.align} ${c.hide}`} style={{ width: c.width }}>
                              <ThTooltip label={c.col} tooltip={c.tip} />
                            </th>
                          ))}
                          <th style={{ width: "8%" }}><span className="sr-only">Actions</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredInvoices.map(inv => {
                          const ss = STATUS_STYLES[inv.status] || STATUS_STYLES.Draft;
                          const ac = avatarColor(inv.createdByInitials);
                          const remaining = inv.amount - inv.paidAmount;
                          const canMarkPaid = inv.status === "Pending" || inv.status === "Overdue" || inv.status === "Partially Paid";

                          return (
                            <tr
                              key={inv.id}
                              className="border-b border-border/60 hover:bg-secondary/50 transition-colors group cursor-pointer"
                              onClick={() => setDetailInvoice(inv)}
                            >
                              <td className="py-2 px-3 pr-2">
                                <button className="inline-flex items-center text-primary text-small hover:underline font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" style={{ gap: 3 }} aria-label={`View ${inv.invoiceNumber}`} onClick={e => { e.stopPropagation(); setDetailInvoice(inv); }}>
                                  <HighlightText text={inv.invoiceNumber} search={search} />
                                  <ArrowUpRight className="w-2.5 h-2.5 text-primary/40 group-hover:text-primary/70 transition-colors" />
                                </button>
                              </td>
                              <td className="py-2 px-3 pr-2">
                                <span className={`inline-flex items-center px-1.5 py-[1px] rounded text-micro font-medium ${ss.bg} ${ss.text}`}>{inv.status}</span>
                              </td>
                              <td className="py-2 px-3 pr-2 text-small text-foreground/50 whitespace-nowrap hidden md:table-cell">{inv.issueDate}</td>
                              <td className="py-2 px-3 pr-2 text-small whitespace-nowrap">
                                <span className={inv.status === "Overdue" ? "text-destructive font-medium" : "text-foreground/50"}>{inv.dueDate}</span>
                              </td>
                              <td className="py-2 px-3 pr-2 text-small text-foreground whitespace-nowrap text-right font-medium">{fmtMoney(inv.amount)}</td>
                              <td className="py-2 px-3 pr-2 text-small whitespace-nowrap text-right">
                                {inv.paidAmount > 0 ? (
                                  <span className="text-accent font-medium">{fmtMoney(inv.paidAmount)}</span>
                                ) : (
                                  <span className="text-foreground/20">&mdash;</span>
                                )}
                                {remaining > 0 && inv.paidAmount > 0 && (
                                  <span className="text-chart-3/70 ml-1 text-micro">({fmtMoney(remaining)} due)</span>
                                )}
                              </td>
                              <td className="py-2 px-3 pr-2 hidden lg:table-cell">
                                <div className="flex items-center gap-1">
                                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-micro shrink-0 font-semibold ${ac.bg} ${ac.text}`} style={{ fontSize: 8 }} aria-hidden="true">{inv.createdByInitials}</span>
                                  <span className="text-small text-foreground truncate max-w-[70px]"><HighlightText text={inv.createdBy.split(" ")[0]} search={search} /></span>
                                </div>
                              </td>
                              <td className="py-2 px-3">
                                <div className="flex items-center gap-0.5">
                                  <Tooltip text="Edit invoice" position="top">
                                    <button className="w-5 h-5 rounded flex items-center justify-center hover:bg-secondary transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" aria-label={`Edit ${inv.invoiceNumber}`} onClick={e => { e.stopPropagation(); setEditInvoice(inv); }}>
                                      <Pencil className="w-2.5 h-2.5 text-foreground/35" />
                                    </button>
                                  </Tooltip>
                                  {canMarkPaid ? (
                                    <Tooltip text="Record payment" position="top">
                                      <button className="w-5 h-5 rounded flex items-center justify-center hover:bg-accent/10 transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" aria-label={`Record payment for ${inv.invoiceNumber}`} onClick={e => { e.stopPropagation(); setMarkPaidInvoice(inv); }}>
                                        <Banknote className="w-3 h-3 text-foreground/35" />
                                      </button>
                                    </Tooltip>
                                  ) : (
                                    <span className="w-5 h-5 shrink-0" aria-hidden="true" />
                                  )}
                                  <Tooltip text="Copy invoice number" position="top">
                                    <button className="w-5 h-5 rounded flex items-center justify-center hover:bg-secondary transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" aria-label={`Copy ${inv.invoiceNumber}`} onClick={e => e.stopPropagation()}>
                                      <Copy className="w-2.5 h-2.5 text-foreground/35" />
                                    </button>
                                  </Tooltip>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Payment Receipts section */}
          {receiptSection.length > 0 && (() => {
            const open = collapsed["receipts"] !== true;
            return (
              <div className="border border-border rounded-lg overflow-hidden shadow-elevation-sm">
                <div className="flex items-center justify-between bg-secondary px-3">
                  <button onClick={() => toggle("receipts")} className="flex items-center gap-1.5 py-2 text-left hover:opacity-80 transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" aria-expanded={open} aria-controls="lt-receipts">
                    {open ? <ChevronDown className="w-3.5 h-3.5 text-foreground/50" aria-hidden="true" /> : <ChevronRight className="w-3.5 h-3.5 text-foreground/50" aria-hidden="true" />}
                    <CreditCard className="w-3.5 h-3.5 text-foreground/50" aria-hidden="true" />
                    <span className="text-small text-foreground font-semibold">Payment Receipts</span>
                    <span className="text-micro text-foreground/50 bg-border rounded-full px-1.5 py-[1px] min-w-[16px] text-center font-medium">{receiptSection.length}</span>
                  </button>
                  <span className="text-small text-foreground font-medium">{fmtMoney(receiptSection.reduce((s, inv) => s + inv.paidAmount, 0))}</span>
                </div>
                {open && (
                  <div className="overflow-x-auto bg-card" id="lt-receipts">
                    <table className="w-full text-small table-fixed" role="table" aria-label="Payment Receipts list">
                      <thead>
                        <tr className="border-b border-border bg-secondary/30">
                          {[
                            { col: "INVOICE", tip: "Invoice this payment was applied to", hide: "", align: "text-left", width: "20%" },
                            { col: "METHOD", tip: "Payment method used", hide: "", align: "text-left", width: "18%" },
                            { col: "PAID ON", tip: "Date payment was received", hide: "", align: "text-left", width: "16%" },
                            { col: "AMOUNT", tip: "Payment amount received", hide: "", align: "text-right", width: "16%" },
                            { col: "FILES", tip: "Attached receipt or proof", hide: "", align: "text-left", width: "14%" },
                            { col: "CREATED BY", tip: "User who recorded this payment", hide: "hidden lg:table-cell", align: "text-left", width: "16%" },
                          ].map(c => (
                            <th key={c.col} scope="col" className={`py-1.5 px-3 text-micro text-foreground/40 whitespace-nowrap font-semibold tracking-wider ${c.align} ${c.hide}`} style={{ width: c.width }}>
                              <ThTooltip label={c.col} tooltip={c.tip} />
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {receiptSection.map(inv => {
                          const ac = avatarColor(inv.createdByInitials);
                          return (
                            <tr key={`rcpt-${inv.id}`} className="border-b border-border/60 hover:bg-secondary/50 transition-colors group">
                              <td className="py-2 px-3 pr-2">
                                <button className="text-primary text-small hover:underline font-medium"><HighlightText text={inv.invoiceNumber} search={search} /></button>
                              </td>
                              <td className="py-2 px-3 pr-2 text-small text-foreground">{inv.paymentMethod || "\u2014"}</td>
                              <td className="py-2 px-3 pr-2 text-small text-foreground/50 whitespace-nowrap">{inv.paymentDate || "\u2014"}</td>
                              <td className="py-2 px-3 pr-2 text-small text-accent whitespace-nowrap text-right font-medium">{fmtMoney(inv.paidAmount)}</td>
                              <td className="py-2 px-3 pr-2">
                                {inv.receiptFiles && inv.receiptFiles.length > 0 ? (
                                  <div className="flex items-center gap-1">
                                    <Paperclip className="w-2.5 h-2.5 text-foreground/35" />
                                    <span className="text-small text-primary font-medium">{inv.receiptFiles.length} file{inv.receiptFiles.length > 1 ? "s" : ""}</span>
                                  </div>
                                ) : (
                                  <span className="text-foreground/20 text-small">&mdash;</span>
                                )}
                              </td>
                              <td className="py-2 px-3 pr-2 hidden lg:table-cell">
                                <div className="flex items-center gap-1">
                                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-micro shrink-0 font-semibold ${ac.bg} ${ac.text}`} style={{ fontSize: 8 }} aria-hidden="true">{inv.createdByInitials}</span>
                                  <span className="text-small text-foreground truncate max-w-[70px]"><HighlightText text={inv.createdBy.split(" ")[0]} search={search} /></span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Modals */}
      {markPaidInvoice && (
        <MarkAsPaidModal
          invoice={markPaidInvoice}
          onConfirm={(files, method, notes, paymentAmount, schedule) => handleMarkPaid(markPaidInvoice, files, method, notes, paymentAmount, schedule)}
          onClose={() => setMarkPaidInvoice(null)}
        />
      )}
      {showCreateModal && (
        <CreateInvoiceModal so={so} onClose={() => setShowCreateModal(false)} onCreate={handleCreateInvoice} />
      )}
      {detailInvoice && (
        <InvoiceDetailModal
          invoice={detailInvoice}
          fmtMoney={fmtMoney}
          onClose={() => setDetailInvoice(null)}
          onRecordPayment={() => { setDetailInvoice(null); setMarkPaidInvoice(detailInvoice); }}
          onEdit={() => { setDetailInvoice(null); setEditInvoice(detailInvoice); }}
          onVoid={() => handleVoidInvoice(detailInvoice.id)}
        />
      )}
      {editInvoice && (
        <EditInvoiceModal
          invoice={editInvoice}
          fmtMoney={fmtMoney}
          onClose={() => setEditInvoice(null)}
          onSave={(updates) => handleEditSave(editInvoice.id, updates)}
        />
      )}
    </>
  );
}

/**
 * Compact invoice summary for the sidebar — horizontal stacked bar with paid/pending breakdown.
 */
export function InvoiceSidebarSummary({ so, viewMode = "base", onOpenInvoicing }: { so: SalesOrder; viewMode?: "base" | "customer"; onOpenInvoicing?: () => void }) {
  const invoices = generateMockInvoices(so);
  const totalInvoiced = invoices.reduce((s, inv) => s + inv.amount, 0);
  const totalPaid = invoices.reduce((s, inv) => s + inv.paidAmount, 0);
  const totalPending = totalInvoiced - totalPaid;
  const overdueCount = invoices.filter(inv => inv.status === "Overdue").length;
  const fmt = makeFormatOrderMoney(so.currency, viewMode);

  if (totalInvoiced === 0) return null;

  return (
    <div className="flex flex-col" style={{ gap: 6 }}>
      <div className="flex items-center justify-between">
        <span className="text-foreground/50" style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" }}>Invoiced</span>
        <span className="text-foreground" style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-semibold)" }}>{fmt(totalInvoiced)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-foreground/50" style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" }}>Paid</span>
        <span className="text-accent" style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-semibold)" }}>{fmt(totalPaid)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-foreground/50" style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" }}>Outstanding (Balance)</span>
        <span className="text-chart-3" style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-semibold)" }}>{fmt(totalPending)}</span>
      </div>
      {overdueCount > 0 && (
        <div className="flex items-center justify-between rounded-lg" style={{ gap: 6, padding: "8px 12px", marginTop: 4, backgroundColor: "rgba(255, 69, 58, 0.08)" }}>
          <div className="flex items-center" style={{ gap: 6 }}>
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" style={{ color: "#DC2626" }} />
            <span style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-semibold)", color: "#DC2626" }}>{overdueCount} overdue invoice{overdueCount > 1 ? "s" : ""}</span>
          </div>
          {onOpenInvoicing && (
            <button
              onClick={onOpenInvoicing}
              className="hover:underline transition-colors shrink-0 flex items-center"
              style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-bold)", background: "transparent", border: "none", cursor: "pointer", padding: 0, gap: 3, color: "#DC2626" }}
            >
              View <ArrowUpRight className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
