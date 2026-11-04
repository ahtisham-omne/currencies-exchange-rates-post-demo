import { Mail, MapPin, Phone, X, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/app/components/ui/dialog';
import { partnerVendorUrl } from '@/app/data/mockVendors';
import { customerByName } from '@/app/data/ar/mockCustomers';
import { palette } from '@/styles/tokens';

/* ─── Customer full-detail modal — the vendor listing's VendorFullCard
 *  (InvoiceDataTable) forked verbatim for Customer Invoicing: gradient
 *  hero with centered initials, title, four-column stats, connect rows
 *  and a footer CTA to the partner record. Only nouns and data differ:
 *  the billing contact's email comes from the customer master when the
 *  customer is known. */

export function openCustomerPartner(customerName: string) {
  window.open(partnerVendorUrl(customerName), '_blank', 'noopener');
}

/** Deterministic mock stats (the vendor quick/full card recipe). */
export function getCustomerStats(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  const abs = Math.abs(h);
  return {
    totalInvoices: (abs % 80) + 10,
    outstanding: ((abs >> 3) % 90000) + 10000,
    paid: ((abs >> 5) % 250000) + 50000,
    addressLine: `${(abs % 900) + 100} Commerce Way`,
    city: ['Denver, CO', 'Portland, OR', 'Nashville, TN', 'Columbus, OH', 'Phoenix, AZ'][abs % 5],
    // Division, not bit-shift (vendor VI-24 fix): segments stay positive.
    phone: `+1 (${(abs % 800) + 200}) ${(Math.floor(abs / 7) % 800) + 200}-${String(Math.floor(abs / 13) % 10000).padStart(4, '0')}`,
  };
}

function getContactDetails(name: string) {
  const c = customerByName(name);
  if (c) return { email: c.billingContact.email };
  return { email: `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@company.com` };
}

interface CustomerFullCardProps {
  customer: string;
  open: boolean;
  onClose: () => void;
}

/** Hash-derived avatar tint for the large hero avatar — uses the existing
 *  PersonAvatar tint palette so the gradient and avatar share a deterministic
 *  family per vendor. */
function heroGradientFor(name: string): string {
  // Pull a deterministic accent hue from the name so each vendor's hero
  // feels a little different (matches partner's Kimora-Avila modal where
  // the gradient picks up the avatar's color family). Each gradient is
  // built from three palette stops so it stays tokenized.
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  const g = (a: string, b: string, c: string) =>
    `linear-gradient(135deg, ${a} 0%, ${b} 50%, ${c} 100%)`;
  const hues = [
    g(palette.blue[100], palette.indigo[100], palette.violet[100]),     // blue → indigo → violet
    g(palette.green[100], palette.emerald[100], palette.teal[100]),     // emerald → teal
    g(palette.amber[100], palette.amber[200], palette.orange[200]),     // amber → orange
    g(palette.pink[100], palette.pink[200], palette.fuchsia[200]),      // pink → fuchsia
    g(palette.sky[100], palette.cyan[100], palette.blue[100]),          // sky → cyan → blue
    g(palette.violet[100], palette.violet[200], palette.purple[200]),   // violet → purple
  ];
  return hues[Math.abs(h) % hues.length];
}

/** Customer full-detail modal — matches partner module's Contact-modal pattern
 *  (Kimora Avila reference): large gradient hero with centered avatar +
 *  initials, status pill top-left, circular close top-right, then name + role,
 *  company/dept pills, 4-column stats grid, connect section, footer with CTA.
 *  Width = 460px. Animates from center via the `modal-pop-center` keyframe
 *  defined in src/index.css. */
export function CustomerFullCard({ customer: vendor, open, onClose }: CustomerFullCardProps) {
  const stats = getCustomerStats(vendor);
  const contact = getContactDetails(vendor);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-[460px] p-0 overflow-hidden border-0 rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.18)] bg-white"
        // Skip the default top-right X — we render a custom circular close
        // button in the hero band. Without this we'd have two X icons stacked.
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">{vendor}, customer details</DialogTitle>
        <DialogDescription className="sr-only">
          Quick reference for the {vendor} customer: address, phone, invoice counts,
          billing contact, and a link to the full customer page.
        </DialogDescription>

        {/* ─── 1. Hero band — large gradient with centered avatar ─── */}
        <div className="relative h-[180px] overflow-hidden">
          <div className="absolute inset-0" style={{ background: heroGradientFor(vendor) }} />
          {/* Soft decorative orbs */}
          <div
            className="absolute -top-16 -right-16 w-56 h-56 rounded-full"
            style={{ background: 'radial-gradient(closest-side, rgba(255,255,255,0.55), transparent)' }}
          />
          <div
            className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full"
            style={{ background: 'radial-gradient(closest-side, rgba(255,255,255,0.30), transparent)' }}
          />

          {/* Status pill (top-left) — partner reference: rounded-full,
              light-green bg, dark-green text. No dot — just the label. */}
          <span
            className="absolute top-3 left-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] shadow-sm border"
            style={{
              backgroundColor: palette.emerald[50],
              color: palette.emerald[800],
              borderColor: palette.emerald[200],
              fontWeight: 600,
            }}
          >
            Active
          </span>

          {/* Close button (top-right) */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center bg-white/90 hover:bg-white shadow-sm text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          {/* Centered large avatar — pointer-events-none so it doesn't steal
              clicks from the status pill / close button stacked above it. */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="rounded-full bg-white/95 shadow-[0_8px_22px_rgba(0,0,0,0.10)] p-1.5">
              <div
                className="w-[72px] h-[72px] rounded-full flex items-center justify-center"
                style={{
                  backgroundColor: 'hsl(var(--card))',
                  color: 'hsl(var(--foreground))',
                  fontSize: 20,
                  fontWeight: 600,
                  letterSpacing: '0.02em',
                }}
              >
                {vendor
                  .split(/\s+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((p) => p[0])
                  .join('')
                  .toUpperCase()}
              </div>
            </div>
          </div>
        </div>

        {/* ─── 2. Title — name + role left-aligned (partner Tanya-Bailey ref) ─── */}
        <div className="px-5 pt-4 pb-2">
          <p
            className="text-[19px] truncate"
            style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}
          >
            {vendor}
          </p>
          <p className="text-[12px] text-muted-foreground truncate mt-0.5">
            Customer · {stats.city}
          </p>
        </div>

        {/* Partner + Dept pills removed per design — the vendor name + city
            subtitle above already convey the affiliation, and the 4-col
            stats card below carries the "Partners" cell, so the duplicate
            pill row was redundant. */}

        {/* ─── 4. Four-column stats grid — column 1 = partner/vendor name
            (text, label "Partners"), columns 2-4 = numeric stats. Mirrors
            partner Tanya-Bailey reference. ─── */}
        <div className="px-5 pb-3.5">
          <div className="grid grid-cols-4 gap-0 rounded-xl border border-border/60 bg-slate-50/60 overflow-hidden">
            <div className="px-2.5 py-2 text-center">
              <p
                className="text-[13px] text-foreground truncate"
                style={{ fontWeight: 600 }}
                title={vendor}
              >
                {vendor.split(/\s+/)[0]}
              </p>
              <p
                className="text-[10px] text-muted-foreground mt-0.5"
                style={{ fontWeight: 600 }}
              >
                Partners
              </p>
            </div>
            <div className="px-2.5 py-2 text-center border-l border-border/40">
              <p className="text-[16px] text-foreground " style={{ fontWeight: 600 }}>
                {stats.totalInvoices}
              </p>
              <p
                className="text-[10px] text-muted-foreground mt-0.5"
                style={{ fontWeight: 600 }}
              >
                Invoices&nbsp;Issued
              </p>
            </div>
            <div className="px-2.5 py-2 text-center border-l border-border/40">
              <p className="text-[16px] text-foreground " style={{ fontWeight: 600 }}>
                ${(stats.outstanding / 1000).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}K
              </p>
              <p
                className="text-[10px] text-muted-foreground mt-0.5"
                style={{ fontWeight: 600 }}
              >
                Outstanding
              </p>
            </div>
            <div className="px-2.5 py-2 text-center border-l border-border/40">
              <p className="text-[16px] text-foreground " style={{ fontWeight: 600 }}>
                ${(stats.paid / 1000).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}K
              </p>
              <p
                className="text-[10px] text-muted-foreground mt-0.5"
                style={{ fontWeight: 600 }}
              >
                Collected
              </p>
            </div>
          </div>
        </div>

        {/* ─── 5. Connect section (address / email / phone) ─── */}
        <div className="px-5 pb-4">
          <p
            className="text-[10px] text-muted-foreground mb-1.5"
            style={{ fontWeight: 600 }}
          >
            Connect
          </p>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">
                {stats.addressLine}, {stats.city}
              </span>
            </div>
            <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
              <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{contact.email}</span>
            </div>
            <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
              <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="">{stats.phone}</span>
            </div>
          </div>
        </div>

        {/* ─── 6. Footer ─── */}
        <div className="bg-slate-50/70 border-t border-border/60 px-5 py-3 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="text-[12px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              openCustomerPartner(vendor);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-[12px] text-white bg-primary hover:bg-primary/90 transition-colors cursor-pointer shadow-sm"
            style={{ fontWeight: 500 }}
          >
            View Customer Details
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
