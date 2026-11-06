import { useMemo, useState, useEffect } from 'react';
import {
  Send, X, Mail, Check, CheckCheck, Settings2,
  Printer, EyeOff,
} from 'lucide-react';
import { StateTransitionOverlay } from '@/app/components/shared/StateTransitionOverlay';
import { Avatar } from '@/app/components/shared/Avatar';
import { PdfDocument } from '@/app/components/shared/pdfDocument';
import { Switch } from '@/app/components/ui/switch';
import { adaptQuoteToPdfData, type LegacyQuoteInput } from './quotePdfAdapter';
import type { Quote } from '@/app/types/quote';
import { FIELD_RULES, FieldErrorText, FIELD_ERROR_STYLE } from '@/app/components/shared/fieldRequirements';

/* ── Visibility options ── */
interface VisibilityOption { key: string; label: string; description: string; icon: string; enabled: boolean; }

const DEFAULT_OPTIONS: VisibilityOption[] = [
  { key: 'header', label: 'Company Logo & Header', description: 'Show your company branding at the top.', icon: '🏢', enabled: true },
  { key: 'pricing', label: 'Pricing Rules', description: 'Calculation details and adjustments.', icon: '💰', enabled: true },
  { key: 'adjustments', label: 'Adjustments', description: 'Item-level and order-level adjustments.', icon: '⚙️', enabled: true },
  { key: 'attachments', label: 'Attachments', description: 'Include uploaded files or link references.', icon: '📎', enabled: true },
  { key: 'charges', label: 'Payment Charges', description: 'Fees based on payment method.', icon: '💳', enabled: false },
  { key: 'notes', label: 'Notes', description: 'Internal notes visible to customer.', icon: '📝', enabled: true },
  { key: 'terms', label: 'Terms & Conditions', description: 'Standard terms and payment policies.', icon: '📃', enabled: true },
];

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!enabled)} className="relative shrink-0 rounded-full transition-colors"
      style={{ width: 40, height: 22, backgroundColor: enabled ? 'var(--primary)' : 'var(--border)' }}>
      <div className="absolute top-[2px] rounded-full bg-card transition-transform"
        style={{ width: 18, height: 18, transform: enabled ? 'translateX(20px)' : 'translateX(2px)', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }} />
    </button>
  );
}

/* ── Recipient data ── */
interface Contact { name: string; email: string; title: string; primary: boolean; }
const MOCK_CONTACTS: Contact[] = [
  { name: 'Sarah Moore', email: 'sarah.moore@example.com', title: 'Procurement Manager', primary: true },
  { name: 'Tom Mitchell', email: 'tom.m@example.com', title: 'Fleet Manager', primary: false },
  { name: 'Ben Parker', email: 'ben.parker@example.com', title: 'Procurement Officer', primary: false },
  { name: 'Lisa Huang', email: 'lisa.h@example.com', title: 'Finance Director', primary: false },
];

const AVATAR_COLORS = [
  { bg: 'rgba(10,119,255,0.12)', fg: 'var(--primary)' },
  { bg: 'rgba(239,162,47,0.14)', fg: 'var(--warning)' },
  { bg: 'rgba(39,185,115,0.12)', fg: '#059650' },
  { bg: 'rgba(87,78,250,0.14)', fg: '#4338E6' },
];
function getAvatarColor(name: string) { let h = 0; for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h); return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]; }
function getInitials(name: string) { return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2); }

/* ── Props ── */
export type SendModalMode = 'send' | 'print';

interface SendToCustomerModalProps {
  isOpen: boolean;
  quoteNumber?: string;
  customerName?: string;
  /** Preferred: full Quote object so the preview shows real data
   *  (addresses, sales rep, dates, items, etc). When absent, the
   *  legacy `quoteNumber` + `customerName` fields are used and the
   *  adapter falls back to deterministic mock content keyed off the
   *  quote number. */
  quote?: Quote | LegacyQuoteInput;
  /** Optional detail-page state — used when the modal is opened from
   *  a fully-hydrated Quote detail so we can surface primary contact,
   *  billing / shipping addresses, and expiry dates in the preview. */
  detail?: {
    contactName?: string;
    contactPhone?: string;
    contactEmail?: string;
    salesRepName?: string;
    salesRepContact?: string;
    billingAddress?: { line?: string; cityStateZip?: string };
    shippingAddress?: { line?: string; cityStateZip?: string };
    paymentMethod?: string;
    paymentTerms?: string;
    createdDateDisplay?: string;
    expiryDateDisplay?: string;
    requestedDateDisplay?: string;
    deliveryDateDisplay?: string;
  };
  isResend?: boolean;
  mode?: SendModalMode;
  onClose: () => void;
  onSend: () => void;
}

/* ── Styling tokens ── */
const caption: React.CSSProperties = { fontSize: 12, fontWeight: 500 };
const captionSemi: React.CSSProperties = { fontSize: 12, fontWeight: 600 };
const micro: React.CSSProperties = { fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' as const };

export function SendToCustomerModal({ isOpen, quoteNumber = 'Q-000-000-000', customerName, quote, detail, isResend, mode = 'send', onClose, onSend }: SendToCustomerModalProps) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  /* Which action triggered the active overlay — drives the heading
     and meta line so the user sees the right narrative for the path
     they chose (email send vs. mark as sent from external share). */
  const [actionMode, setActionMode] = useState<'send' | 'mark'>('send');
  const [showOptions, setShowOptions] = useState(false);
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
  /* Visibility Options is hidden for now per product. The state + side
     panel stay wired up so nothing else has to change when product
     re-enables the flow later by flipping VISIBILITY_OPTIONS_ENABLED
     to true. Matches the gate used in PDFPreviewModal / ExportSOModal /
     SO SendToCustomerModal. */
  const VISIBILITY_OPTIONS_ENABLED = false;
  /* Recipients come from the quote's own contacts when a full quote
     record is passed. A quote with no point of contact lists nobody;
     the placeholder roster is only for callers without a record. */
  const contacts: Contact[] = useMemo(() => {
    const q = quote as Quote | undefined;
    if (!q || !('id' in q)) return MOCK_CONTACTS;
    const list: Contact[] = [];
    if (q.primaryPoC?.name) list.push({ name: q.primaryPoC.name, email: q.primaryPoC.email || '', title: (q.primaryPoC as any).role || '', primary: true });
    (q.additionalPoCs ?? []).filter((c) => c?.name).forEach((c) => list.push({ name: c.name, email: c.email || '', title: (c as any).role || '', primary: false }));
    return list;
  }, [quote]);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(() => new Set(contacts.filter(c => c.primary).map(c => c.email || c.name)));
  /* Partner validation pattern: Send stays enabled; clicking it with
     nobody selected outlines the recipients list instead. */
  const [showRecipientError, setShowRecipientError] = useState(false);
  const isPrint = mode === 'print';
  /* Include-attachments toggle — when true, the send/download would
     bundle the quote's attachments alongside the PDF (zip). UI only
     for now. */
  const [includeAttachments, setIncludeAttachments] = useState(false);

  useEffect(() => {
    if (isOpen) { setSending(false); setSent(false); setActionMode('send'); setShowOptions(false); setOptions(DEFAULT_OPTIONS); setIncludeAttachments(false); setShowRecipientError(false); }
  }, [isOpen]);

  /* Build the shared PdfDocumentData from the caller's Quote when
     provided; otherwise fall back to the legacy shape supported by
     `adaptQuoteToPdfData`. The adapter is the single source of truth
     for the preview payload so this modal + PDFPreviewModal always
     render identical content. */
  const pdfData = useMemo(() => {
    const fallbackQuote = quote ?? { quoteNumber, customerName: customerName || '' };
    return adaptQuoteToPdfData(fallbackQuote, detail);
  }, [quote, quoteNumber, customerName, detail]);

  const toggleOption = (key: string) => setOptions(prev => prev.map(o => o.key === key ? { ...o, enabled: !o.enabled } : o));
  const toggleContact = (email: string) => setSelectedContacts(prev => { const n = new Set(prev); if (n.has(email)) n.delete(email); else n.add(email); return n; });

  if (!isOpen) return null;

  function handleAction() {
    if (isPrint) {
      window.print();
      onSend();
      return;
    }
    if (selectedContacts.size === 0) {
      setShowRecipientError(true);
      return;
    }
    setActionMode('send');
    setSending(true);
    setTimeout(() => { setSending(false); setSent(true); setTimeout(() => onSend(), 1200); }, 2500);
  }

  /* Mark-as-Sent — for cases where the quote was shared to the
     customer via an out-of-system medium (printed handoff, in-person
     review, third-party portal, etc). Skips the email send but runs
     the same status-transition animation so the document still lands
     in the Sent state. No recipient selection required. */
  function handleMarkAsSent() {
    setActionMode('mark');
    setSending(true);
    setTimeout(() => { setSending(false); setSent(true); setTimeout(() => onSend(), 1200); }, 1600);
  }

  const modalTitle = isPrint ? 'Print Quote' : isResend ? 'Resend to Customer' : 'Send to Customer';
  const modalSubtitle = isPrint
    ? 'Review the quote document the way it will print.'
    : 'Review the quote document the customer will receive.';
  const ModalIcon = isPrint ? Printer : Send;

  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 200, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }} onClick={onClose}>

      {/* Sending / Sent overlay — unified StateTransitionOverlay.
          Narrative branches on actionMode so the user sees the right
          framing: "Sending" for the email path, "Marking as Sent" for
          the out-of-system handoff path. End state is the same Sent
          status either way. */}
      <StateTransitionOverlay
        isActive={sending || sent}
        fromLabel="Draft"
        toLabel={
          sent
            ? 'Sent to Customer'
            : actionMode === 'mark'
              ? 'Marking as Sent'
              : 'Sending to Customer'
        }
        tone={sent ? 'success' : 'info'}
        Icon={sent ? Check : actionMode === 'mark' ? CheckCheck : Send}
        heading={
          sent
            ? 'Sent to Customer'
            : actionMode === 'mark'
              ? 'Marking as Sent'
              : 'Sending to Customer'
        }
        meta={
          sent
            ? actionMode === 'mark'
              ? `${quoteNumber} · Marked as sent (shared externally)`
              : `${quoteNumber} · ${selectedContacts.size} recipient${selectedContacts.size !== 1 ? 's' : ''}`
            : undefined
        }
        duration={sent ? 1100 : 60000}
      />

      {/* Modal */}
      <div className="bg-card rounded-xl border border-border flex flex-col"
        style={{
          boxShadow: '0 16px 48px rgba(0,0,0,0.15)',
          width: showOptions ? 1180 : 920,
          maxWidth: '95vw',
          maxHeight: '90vh',
          transition: 'width 300ms ease',
        }}
        onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-border" style={{ padding: '14px 20px' }}>
          <div className="flex items-center" style={{ gap: 12 }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 10%, transparent)' }}>
              <ModalIcon className="w-4 h-4" style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <div className="text-foreground" style={{ ...captionSemi, fontSize: 14 }}>{modalTitle}</div>
              <div style={{ ...caption, color: 'var(--muted-foreground)' }}>{modalSubtitle}</div>
            </div>
          </div>
          <div className="flex items-center" style={{ gap: 8 }}>
            {VISIBILITY_OPTIONS_ENABLED && <button onClick={() => setShowOptions(!showOptions)}
              className={`flex items-center rounded-lg border transition-colors ${showOptions ? 'text-white' : 'border-border hover:bg-secondary'}`}
              style={{ ...caption, gap: 8, padding: '8px 12px', backgroundColor: showOptions ? 'var(--primary)' : undefined, borderColor: showOptions ? 'var(--primary)' : undefined, color: showOptions ? 'white' : 'var(--muted-foreground)', cursor: 'pointer' }}>
              {showOptions ? <><EyeOff className="w-3.5 h-3.5" /> Hide Options</> : <><Settings2 className="w-3.5 h-3.5" /> Visibility Options</>}
            </button>}
            <button onClick={onClose} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-secondary transition-colors" style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* Visibility panel */}
          {showOptions && (
            <div className="border-r border-border overflow-y-auto" style={{ width: 280, flexShrink: 0, padding: 16 }}>
              <div className="flex items-center" style={{ gap: 6, marginBottom: 12 }}>
                <Settings2 className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-foreground" style={micro}>VISIBILITY SETTINGS</span>
              </div>
              <div className="text-muted-foreground" style={{ ...caption, fontWeight: 400, marginBottom: 16 }}>
                Choose what {isPrint ? 'to include in the printout' : 'your customer will see'}.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {options.map(opt => (
                  <div key={opt.key} className="flex items-start justify-between" style={{ gap: 12 }}>
                    <div className="flex items-start" style={{ gap: 10 }}>
                      <span style={{ fontSize: 14, lineHeight: 1, marginTop: 2 }}>{opt.icon}</span>
                      <div>
                        <div className="text-foreground" style={captionSemi}>{opt.label}</div>
                        <div className="text-muted-foreground" style={{ ...caption, fontWeight: 400 }}>{opt.description}</div>
                      </div>
                    </div>
                    <Toggle enabled={opt.enabled} onChange={() => toggleOption(opt.key)} />
                  </div>
                ))}
              </div>

              {/* Recipient section for send mode */}
              {!isPrint && (
                <>
                  <div style={{ height: 1, backgroundColor: 'var(--border)', margin: '20px 0' }} />
                  <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                    <div className="flex items-center" style={{ gap: 6 }}>
                      <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-foreground" style={micro}>RECIPIENTS</span>
                    </div>
                    <span className="text-muted-foreground" style={{ fontSize: 10 }}>{selectedContacts.size} selected</span>
                  </div>
                  <div className="flex flex-col gap-1.5 rounded-lg" data-field="poc" style={showRecipientError && selectedContacts.size === 0 ? { ...FIELD_ERROR_STYLE, border: '1px solid #F87171', padding: 4 } : undefined}>
                    {contacts.length === 0 && (
                      <div className="text-muted-foreground" style={{ fontSize: 11, padding: '7px 8px' }}>{FIELD_RULES.poc.emptyLabel}</div>
                    )}
                    {contacts.map(contact => {
                      const key = contact.email || contact.name;
                      const selected = selectedContacts.has(key);
                      return (
                        <button key={key} onClick={() => toggleContact(key)}
                          className="flex items-center gap-2.5 w-full text-left transition-all rounded-lg"
                          style={{ padding: '7px 8px', border: selected ? '1px solid color-mix(in srgb, var(--primary) 25%, transparent)' : '1px solid var(--border)', backgroundColor: selected ? 'color-mix(in srgb, var(--primary) 3%, transparent)' : 'transparent', cursor: 'pointer' }}
                          onMouseEnter={e => { if (!selected) e.currentTarget.style.backgroundColor = 'var(--secondary)'; }}
                          onMouseLeave={e => { e.currentTarget.style.backgroundColor = selected ? 'color-mix(in srgb, var(--primary) 3%, transparent)' : 'transparent'; }}>
                          <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${selected ? 'var(--primary)' : 'var(--border)'}`, backgroundColor: selected ? 'var(--primary)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {selected && <Check style={{ width: 11, height: 11, color: 'white', strokeWidth: 3 }} />}
                          </div>
                          <Avatar name={contact.name} size={24} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-foreground truncate" style={{ fontSize: 11, fontWeight: 600 }}>{contact.name}</span>
                              {contact.primary && <span style={{ fontSize: 8, fontWeight: 600, color: 'var(--primary)', backgroundColor: 'color-mix(in srgb, var(--primary) 8%, transparent)', padding: '1px 4px', borderRadius: 3, textTransform: 'uppercase' }}>Primary</span>}
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                              <Mail style={{ width: 10, height: 10, color: '#a1a1aa' }} />
                              <span className="text-muted-foreground truncate" style={{ fontSize: 10 }}>{contact.email}</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {showRecipientError && selectedContacts.size === 0 && (
                    <FieldErrorText>{FIELD_RULES.poc.missingMessage}</FieldErrorText>
                  )}
                </>
              )}
            </div>
          )}

          {/* Preview area — renders the live shared PdfDocument so both
              Send-to-Customer and the standalone PDF preview show the
              exact same document. Static JPEG mockups previously used
              here have been retired. */}
          <div
            className="flex-1 flex flex-col min-h-0"
            data-pdf-scroll-root
            style={{ background: 'var(--secondary)' }}
          >
            <div className="flex items-center shrink-0" style={{ padding: '10px 16px 6px' }}>
              <span className="text-muted-foreground" style={micro}>PREVIEW</span>
            </div>
            <style>{`
              @media print {
                body * { visibility: hidden; }
                [data-pdf-scroll-root], [data-pdf-scroll-root] * { visibility: visible; }
                [data-pdf-scroll-root] {
                  position: absolute !important;
                  top: 0; left: 0; right: 0;
                  background: #FFFFFF !important;
                  overflow: visible !important;
                }
              }
            `}</style>
            <div className="flex-1 overflow-auto">
              <PdfDocument data={pdfData} />
            </div>
          </div>
        </div>

        {/* ── Footer ── Include-attachments toggle on the left,
            primary + secondary CTAs anchored bottom-right per Partner
            modal chrome. Print mode drops the toggle (nothing to zip
            when the user is going to a printer). */}
        <div className="flex items-center justify-between border-t border-[#EEF2F6] bg-white px-3 sm:px-4 lg:px-5 py-2.5 sm:py-3 gap-3 shrink-0">
          <div className="flex items-center shrink-0">
            <label className="flex items-center gap-2 cursor-pointer select-none" title={isPrint ? "Print the attachments alongside the PDF." : "Include the quote's attachments in the send — they'll be zipped with the PDF."}>
              <Switch
                checked={includeAttachments}
                onCheckedChange={setIncludeAttachments}
                aria-label="Include attachments"
              />
              <span className="text-muted-foreground" style={{ fontSize: 12, fontWeight: 500 }}>
                Include attachments
              </span>
            </label>
          </div>
          {/* The recipient picker lives in the (currently hidden)
              visibility panel, so a quote with no point of contact
              surfaces the requirement here, next to the action. */}
          {!isPrint && showRecipientError && selectedContacts.size === 0 && (
            <div className="flex-1 min-w-0 text-right [&>p]:mt-0">
              <FieldErrorText>{FIELD_RULES.poc.missingMessage}</FieldErrorText>
            </div>
          )}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white text-slate-500 hover:bg-slate-50 hover:text-foreground hover:border-slate-300 transition-colors shadow-sm h-9 px-4 text-[13px]"
              style={{ fontWeight: 500, cursor: 'pointer' }}
            >
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
            {!isPrint && (
              <button
                onClick={handleMarkAsSent}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-sm h-9 px-4 text-[13px] whitespace-nowrap"
                style={{ fontWeight: 500, cursor: 'pointer' }}
                title="Mark this quote as Sent without emailing — use when you've shared it through another medium (printed handoff, in-person review, third-party portal, etc)."
              >
                <CheckCheck className="w-3.5 h-3.5" /> Mark as Sent
              </button>
            )}
            <button
              onClick={handleAction}
              className="inline-flex items-center gap-1.5 rounded-lg text-white transition-colors shadow-sm h-9 px-4 text-[13px] whitespace-nowrap"
              style={{ fontWeight: 600, cursor: 'pointer', backgroundColor: 'rgba(39, 185, 115, 1)', border: 'none' }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(30, 160, 98, 1)'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(39, 185, 115, 1)'; }}
            >
              {isPrint ? <Printer className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
              {isPrint ? 'Print' : isResend ? 'Resend' : 'Send to Customer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
