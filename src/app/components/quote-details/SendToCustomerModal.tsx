import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Send, X, Mail, Check, Settings2, Loader2,
  Printer, ChevronLeft, ChevronRight, EyeOff,
} from 'lucide-react';

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
  { bg: 'rgba(10,119,255,0.12)', fg: '#1D4ED8' },
  { bg: 'rgba(239,162,47,0.14)', fg: '#B45309' },
  { bg: 'rgba(39,185,115,0.12)', fg: '#059650' },
  { bg: 'rgba(87,78,250,0.14)', fg: '#4338E6' },
];
function getAvatarColor(name: string) { let h = 0; for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h); return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]; }
function getInitials(name: string) { return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2); }

/* ── PDF page images ── */
const PDF_PAGES = [
  '/quote-pdf/page1-1.jpg',
  '/quote-pdf/page2-1.jpg',
  '/quote-pdf/page3-1.jpg',
];

/* ── Props ── */
export type SendModalMode = 'send' | 'print';

interface SendToCustomerModalProps {
  isOpen: boolean;
  quoteNumber?: string;
  customerName?: string;
  isResend?: boolean;
  mode?: SendModalMode;
  onClose: () => void;
  onSend: () => void;
}

/* ── Styling tokens ── */
const caption: React.CSSProperties = { fontSize: 12, fontWeight: 500 };
const captionSemi: React.CSSProperties = { fontSize: 12, fontWeight: 600 };
const micro: React.CSSProperties = { fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' as const };

export function SendToCustomerModal({ isOpen, quoteNumber = 'Q-000-000-000', customerName, isResend, mode = 'send', onClose, onSend }: SendToCustomerModalProps) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set(MOCK_CONTACTS.filter(c => c.primary).map(c => c.email)));
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = PDF_PAGES.length;

  const isPrint = mode === 'print';

  useEffect(() => {
    if (isOpen) { setSending(false); setSent(false); setShowOptions(false); setOptions(DEFAULT_OPTIONS); setCurrentPage(1); }
  }, [isOpen]);

  const toggleOption = (key: string) => setOptions(prev => prev.map(o => o.key === key ? { ...o, enabled: !o.enabled } : o));
  const toggleContact = (email: string) => setSelectedContacts(prev => { const n = new Set(prev); if (n.has(email)) n.delete(email); else n.add(email); return n; });

  if (!isOpen) return null;

  function handleAction() {
    if (isPrint) {
      window.print();
      onSend();
      return;
    }
    setSending(true);
    setTimeout(() => { setSending(false); setSent(true); setTimeout(() => onSend(), 1200); }, 2500);
  }

  const modalTitle = isPrint ? 'Print Quote' : isResend ? 'Resend to Customer' : 'Send to Customer';
  const modalSubtitle = isPrint ? 'Preview before printing — customize what\'s visible' : 'Preview before sending — customize what\'s visible';
  const ModalIcon = isPrint ? Printer : Send;

  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 200, backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }} onClick={onClose}>

      {/* Sending / Sent overlays */}
      <AnimatePresence>
        {sending && (
          <motion.div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 50001, backgroundColor: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="flex flex-col items-center gap-4">
              <motion.div className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'var(--primary)' }}
                animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                <Send className="w-7 h-7 text-white" />
              </motion.div>
              <span className="text-foreground" style={{ fontSize: 16, fontWeight: 600 }}>Sending to customer...</span>
              <div className="flex items-center gap-2" style={{ opacity: 0.6 }}>
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--primary)' }} />
                <span className="text-muted-foreground" style={{ fontSize: 12 }}>Preparing PDF and sending email</span>
              </div>
            </div>
          </motion.div>
        )}
        {sent && (
          <motion.div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 50001, backgroundColor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="flex flex-col items-center gap-3">
              <motion.div className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'rgba(39, 185, 115, 1)' }}
                initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
                <Check className="w-8 h-8 text-white" strokeWidth={3} />
              </motion.div>
              <span style={{ fontSize: 16, fontWeight: 600, color: 'rgba(39, 185, 115, 1)' }}>Sent Successfully</span>
              <span className="text-muted-foreground" style={{ fontSize: 12 }}>{quoteNumber} sent to {selectedContacts.size} recipient{selectedContacts.size !== 1 ? 's' : ''}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal */}
      <div className="bg-card rounded-xl border border-border flex flex-col"
        style={{
          boxShadow: '0 16px 48px rgba(0,0,0,0.15)',
          width: showOptions ? 1060 : 780,
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
            <button onClick={() => setShowOptions(!showOptions)}
              className={`flex items-center rounded-lg border transition-colors ${showOptions ? 'text-white' : 'border-border hover:bg-secondary'}`}
              style={{ ...caption, gap: 8, padding: '8px 12px', backgroundColor: showOptions ? 'var(--primary)' : undefined, borderColor: showOptions ? 'var(--primary)' : undefined, color: showOptions ? 'white' : 'var(--muted-foreground)', cursor: 'pointer' }}>
              {showOptions ? <><EyeOff className="w-3.5 h-3.5" /> Hide Options</> : <><Settings2 className="w-3.5 h-3.5" /> Visibility Options</>}
            </button>
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
                  <div className="flex flex-col gap-1.5">
                    {MOCK_CONTACTS.map(contact => {
                      const selected = selectedContacts.has(contact.email);
                      const ac = getAvatarColor(contact.name);
                      return (
                        <button key={contact.email} onClick={() => toggleContact(contact.email)}
                          className="flex items-center gap-2.5 w-full text-left transition-all rounded-lg"
                          style={{ padding: '7px 8px', border: selected ? '1px solid color-mix(in srgb, var(--primary) 25%, transparent)' : '1px solid var(--border)', backgroundColor: selected ? 'color-mix(in srgb, var(--primary) 3%, transparent)' : 'transparent', cursor: 'pointer' }}
                          onMouseEnter={e => { if (!selected) e.currentTarget.style.backgroundColor = 'var(--secondary)'; }}
                          onMouseLeave={e => { e.currentTarget.style.backgroundColor = selected ? 'color-mix(in srgb, var(--primary) 3%, transparent)' : 'transparent'; }}>
                          <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${selected ? 'var(--primary)' : 'var(--border)'}`, backgroundColor: selected ? 'var(--primary)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {selected && <Check style={{ width: 11, height: 11, color: 'white', strokeWidth: 3 }} />}
                          </div>
                          <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: ac.bg }}>
                            <span style={{ fontSize: 8, fontWeight: 700, color: ac.fg }}>{getInitials(contact.name)}</span>
                          </div>
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
                </>
              )}
            </div>
          )}

          {/* Preview area with page navigation */}
          <div className="flex-1 flex flex-col min-h-0" style={{ background: 'var(--secondary)' }}>
            {/* Page indicator + nav arrows */}
            <div className="flex items-center justify-between shrink-0" style={{ padding: '10px 16px 6px' }}>
              <span className="text-muted-foreground" style={micro}>PREVIEW</span>
              <div className="flex items-center" style={{ gap: 8 }}>
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="flex items-center justify-center rounded-md border border-border transition-colors hover:bg-card disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ width: 28, height: 28, backgroundColor: 'var(--card)', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
                >
                  <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                </button>
                <span className="text-muted-foreground" style={{ fontSize: 12, fontWeight: 500, minWidth: 70, textAlign: 'center' }}>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="flex items-center justify-center rounded-md border border-border transition-colors hover:bg-card disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ width: 28, height: 28, backgroundColor: 'var(--card)', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
                >
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* Page content — PDF image preview */}
            <div className="flex-1 overflow-y-auto" style={{ padding: '0 16px 16px' }}>
              <div className="bg-card rounded-lg border border-border overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)', minHeight: 500 }}>
                <img
                  src={PDF_PAGES[currentPage - 1]}
                  alt={`Quote page ${currentPage}`}
                  style={{ width: '100%', display: 'block' }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between border-t border-border" style={{ padding: '12px 20px' }}>
          <div className="text-muted-foreground" style={{ ...caption, fontWeight: 400 }}>
            {isPrint ? 'Visibility changes only affect this printout.' : 'Changes only affect this export — they won\'t modify the quote.'}
          </div>
          <div className="flex items-center" style={{ gap: 8 }}>
            <button onClick={onClose}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card text-muted-foreground hover:bg-secondary transition-colors"
              style={{ height: 32, padding: '0 12px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
            {!isPrint && (
              <button onClick={handleAction}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-card text-foreground hover:bg-secondary transition-colors"
                style={{ height: 32, padding: '0 12px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                <Mail className="w-3.5 h-3.5" /> Email to Customer
              </button>
            )}
            <button onClick={handleAction}
              disabled={!isPrint && selectedContacts.size === 0}
              className="flex items-center gap-1.5 rounded-lg text-white transition-colors disabled:opacity-50"
              style={{ height: 32, padding: '0 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', backgroundColor: 'rgba(39, 185, 115, 1)', border: 'none' }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(30, 160, 98, 1)'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(39, 185, 115, 1)'; }}>
              {isPrint ? <Printer className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
              {isPrint ? 'Print' : isResend ? 'Resend' : 'Send to Customer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
