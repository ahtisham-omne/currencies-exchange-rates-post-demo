/**
 * Vendor Information, as the purchase order detail page draws it.
 *
 * A direct port of the order's own card rather than a card that resembles it:
 * `apps/omne-erp/src/shared/components/orders/party-information/` in
 * omne-frontend, which the PO detail sidebar renders through
 * `VendorInformationCard` → `PartyInformationCard`. Its shape, in the order the
 * source has it:
 *
 *   - an identity hero: square seeded avatar, the vendor's name in semibold,
 *     and a sublabel under it saying what they are to this document;
 *   - `Contact`, open by default: the primary contact on a violet gradient
 *     avatar with an online dot, their name with a star, their role, then
 *     phone and email as tinted rows;
 *   - `Shipping & Billing`: where the goods go and who is paid;
 *   - `Payment Method` with its type chip. There is no Payment Terms row:
 *     terms govern when an invoice is paid, and a return is not paid on
 *     terms, so the order's row has no counterpart here.
 *
 * Each section is a disclosure under an uppercase label on a top divider, with
 * a chevron that rotates closed. The source's design-system tokens are
 * translated to this repo's palette, and the purchase order's fields are read
 * as a return reads them: the refund account is where the credit settles.
 */

import { useState } from 'react';
import {
  Banknote,
  ChevronDown,
  CreditCard,
  FileText,
  Landmark,
  type LucideIcon,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Star,
  Truck,
  Users,
} from 'lucide-react';
import { getAvatarTint } from '@/app/utils/avatarTints';

export interface RMAVendorContact {
  name: string;
  initials: string;
  role: string;
  email: string;
  phone: string;
}

/** The design system's own type ramp, at the sizes these cards use it:
 *  `text-microcopy` 10px/500, `text-caption` 12px/400, `text-meta` 12px/500,
 *  `text-default` 14px/400. Written out here because this repo has no token
 *  layer to borrow, and a card ported at the wrong size is not the card. */
const TYPE = {
  microcopy: { fontSize: 10, lineHeight: '15.75px', fontWeight: 500 },
  caption: { fontSize: 12, lineHeight: '16px', fontWeight: 400 },
  captionSemibold: { fontSize: 12, lineHeight: '16px', fontWeight: 600 },
  defaultSemibold: { fontSize: 14, lineHeight: '20px', fontWeight: 600 },
} as const;

/** `Avatar size="sm" shape="square"` — 24px, seeded fill, initials at 9px.
 *  `md` is the 32px the identity row wears. */
function SquareAvatar({
  name,
  size = 'sm',
  logoUrl,
  initials,
}: {
  name: string;
  size?: 'sm' | 'md';
  logoUrl?: string | undefined;
  /** The source's address and funding cards take the first two characters of
   *  the label rather than a person's initials, because the label is a place
   *  or an account and "1010 · JPMorgan Operating" has no initials. */
  initials?: string;
}) {
  const tint = getAvatarTint(name || '–');
  const px = size === 'md' ? 32 : 24;
  const letters =
    initials ??
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md"
      style={{
        width: px,
        height: px,
        backgroundColor: logoUrl ? '#FFFFFF' : tint.bg,
        border: logoUrl ? '1px solid #E2E8F0' : undefined,
      }}
    >
      {logoUrl ? (
        <img src={logoUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        <span style={{ color: tint.fg, fontSize: size === 'md' ? 11 : 9, fontWeight: 600 }}>
          {letters}
        </span>
      )}
    </span>
  );
}

/** Row wrapper that reveals an edit pencil on hover, the source's
 *  `HoverEditRow`. Read-only when there is nothing to edit: a pencil with
 *  nothing behind it is never drawn. */
function HoverEditRow({
  onEdit,
  editLabel,
  editable = true,
  className,
  children,
}: {
  onEdit?: (() => void) | undefined;
  editLabel: string;
  editable?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  if (!editable || !onEdit) return <div className={className}>{children}</div>;
  return (
    <div className={`group relative rounded-lg transition-colors hover:bg-slate-100/40 ${className ?? ''}`}>
      <div className="pr-7">{children}</div>
      {/* `HoverIconButton` size sm, tone neutral: a 24px square that is
          invisible until the row is hovered or focused, muted until it is
          itself hovered, when it takes the surface-variant fill. No border,
          no shadow -- the pencil I had drawn was a floating button, which is
          a different affordance. */}
      <button
        type="button"
        aria-label={`Edit ${editLabel}`}
        onClick={onEdit}
        className="absolute right-1 top-1 inline-flex w-6 h-6 cursor-pointer items-center justify-center rounded-md text-slate-600 opacity-0 outline-none transition-all hover:bg-slate-100 hover:text-slate-900 focus-visible:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/** A disclosure inside the card: uppercase label over a top divider, chevron
 *  rotating closed. The source's `Section`. */
function Section({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-[#F1F5F9]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer items-center justify-between py-2.5 text-left outline-none transition-opacity hover:opacity-80"
      >
        <span className="uppercase tracking-wide text-slate-900" style={TYPE.captionSemibold}>
          {title}
        </span>
        <ChevronDown
          className={`w-3 h-3 shrink-0 text-slate-400 transition-transform ${open ? '' : '-rotate-90'}`}
        />
      </button>
      {open && <div className="pb-3">{children}</div>}
    </div>
  );
}

/** A phone or email row: tinted surface, icon that brightens on hover. */
function ContactInfoRow({ icon: Icon, value }: { icon: LucideIcon; value: string }) {
  return (
    <div className="group flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-100 bg-slate-100 px-2.5 py-1.5 transition-colors hover:border-primary/20 hover:bg-blue-50/60">
      <Icon className="w-3 h-3 shrink-0 text-slate-400 transition-colors group-hover:text-primary" />
      <span className="truncate text-slate-500" style={TYPE.microcopy} title={value}>
        {value}
      </span>
    </div>
  );
}

/** A billing or shipping location, as `AddressCard.tsx` draws it: the label
 *  row, the site on a square seeded avatar, and a Google-Maps-linked address
 *  line. Unset, the source's dashed placeholder that names what pressing it
 *  does, brand-accented for billing and amber for shipping. */
function AddressCard({
  type,
  label,
  site,
  line = null,
  hint,
  editable = true,
  onEdit,
}: {
  type: 'billing' | 'shipping';
  label: string;
  site: string | null;
  line?: string | null;
  /** One line under the card saying what the field is for. */
  hint?: string;
  editable?: boolean;
  onEdit?: (() => void) | undefined;
}) {
  const Icon = type === 'billing' ? CreditCard : Truck;

  if (!site) {
    return (
      <button
        type="button"
        onClick={editable ? onEdit : undefined}
        disabled={!editable || !onEdit}
        className={`flex w-full items-center gap-2.5 rounded-xl border border-dashed p-3 text-left transition-colors ${
          editable && onEdit ? 'cursor-pointer' : 'cursor-default'
        } ${
          type === 'billing'
            ? 'border-primary/40 hover:bg-blue-50/60'
            : 'border-amber-400 hover:bg-amber-50'
        }`}
      >
        <span
          className={`inline-flex w-8 h-8 shrink-0 items-center justify-center rounded-lg ${
            type === 'billing' ? 'bg-blue-50' : 'bg-amber-50'
          }`}
        >
          <Icon
            className={`w-3.5 h-3.5 ${type === 'billing' ? 'text-primary' : 'text-amber-600'}`}
          />
        </span>
        <span className="min-w-0">
          <span className="block text-slate-600" style={{ ...TYPE.microcopy, fontWeight: 600 }}>
            {label}
          </span>
          <span className="block text-slate-600" style={TYPE.caption}>
            Click to assign {type} address
          </span>
        </span>
      </button>
    );
  }

  return (
    <HoverEditRow
      editLabel={`${type} address`}
      editable={editable}
      onEdit={onEdit}
      className="rounded-xl border border-slate-200 p-3"
    >
      <div className="mb-2 flex items-center gap-1.5">
        <Icon className="w-[13px] h-[13px] shrink-0 text-neutral-500" />
        <span className="text-slate-500" style={TYPE.microcopy}>
          {label}
        </span>
      </div>
      <div className="mb-1.5 flex items-center gap-2">
        <SquareAvatar name={site} initials={site.slice(0, 2).toUpperCase()} />
        <span
          className="truncate text-slate-900"
          style={TYPE.captionSemibold}
          title={site}
        >
          {site}
        </span>
      </div>
      {/* The maps link is for a place. An account is not one, and a site whose
          address we do not hold would only repeat its own name. */}
      {line && line !== site && (
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(line)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-1.5 leading-snug text-slate-500 transition-colors hover:text-[#1D4ED8] hover:underline"
          style={TYPE.microcopy}
        >
          <MapPin className="mt-0.5 w-3 h-3 shrink-0 text-neutral-500" />
          <span className="min-w-0">{line}</span>
        </a>
      )}
      {hint && (
        <p className="mt-1 text-slate-400" style={TYPE.microcopy}>
          {hint}
        </p>
      )}
    </HoverEditRow>
  );
}

/** Subtle tinted fill, the source's `tint()` with our palette. */
const TINTS = {
  brand: { bg: 'rgba(10,119,255,0.12)', fg: '#0A77FF' },
  violet: { bg: 'rgba(139,92,246,0.12)', fg: '#7C3AED' },
  warning: { bg: 'rgba(245,158,11,0.14)', fg: '#B45309' },
  success: { bg: 'rgba(5,150,105,0.12)', fg: '#047857' },
  slate: { bg: 'rgba(100,116,139,0.12)', fg: '#475569' },
} as const;

/** The source's `isUnset`: a name that is missing, or the dash a missing one
 *  is written as. */
const isUnset = (name: string) => !name || name === '—';

/** The method's own icon and accent. */
function methodVisual(name: string): { Icon: LucideIcon; tint: keyof typeof TINTS } {
  const n = name.toLowerCase();
  if (n.includes('card')) return { Icon: CreditCard, tint: 'warning' };
  if (n.includes('ach') || n.includes('wire') || n.includes('bank')) {
    return { Icon: Landmark, tint: 'brand' };
  }
  if (n.includes('check') || n.includes('cheque')) return { Icon: FileText, tint: 'violet' };
  if (n.includes('cash')) return { Icon: Banknote, tint: 'success' };
  if (n.includes('mobile') || n.includes('wallet') || n.includes('pay')) {
    return { Icon: Banknote, tint: 'success' };
  }
  return { Icon: CreditCard, tint: 'slate' };
}

export function RMAVendorInformationCard({
  vendorName,
  vendorLogoUrl,
  vendorAddress,
  contact,
  shipTo,
  payTo,
  paymentMethod,
  paymentMethodCard,
  onOpenVendor,
  shipToPartner = null,
  shipToAddress = null,
  editable = false,
  onEditShipTo,
  onEditPayTo,
  onEditMethod,
}: {
  vendorName: string;
  vendorLogoUrl?: string | undefined;
  vendorAddress: string | null;
  contact: RMAVendorContact | null;
  /** Where the goods are going back to. */
  shipTo: string | null;
  /** Where the money lands when the credit settles. */
  payTo: string | null;
  /** The term drawn as the partner module draws it, which is a card rather
   *  than a line: type pill and trigger, name, description, the days as a
   *  hero figure, and the early-payment strip when the term carries one. The
   *  badge row below stands in only when no template matches. */
  paymentMethod: string;
  /** The method drawn as the partner module draws it: icon chip, name and
   *  category, with its own details masked underneath. The chip row below
   *  stands in only when there is nothing to draw. */
  paymentMethodCard?: React.ReactNode | undefined;
  /** Opens the partner record, the way a vendor name opens it everywhere. */
  onOpenVendor?: string | undefined;
  /** Who owns the address the goods are going to, which is not always the
   *  vendor they came from. */
  shipToPartner?: string | null;
  /** Where that site actually is, when the partner record knows. */
  shipToAddress?: string | null;
  /** Hover-to-edit on every row the document still allows changing. */
  editable?: boolean;
  onEditShipTo?: (() => void) | undefined;
  onEditPayTo?: (() => void) | undefined;
  onEditMethod?: (() => void) | undefined;
}) {
  const [cardOpen, setCardOpen] = useState(true);
  const method = methodVisual(paymentMethod);
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      {/* `DashInfoCard`'s header, which is what the order's card is wrapped
          in: a 24px brand-tinted icon chip, the title at text-caption
          semibold, and a chevron that rotates closed. */}
      <button
        type="button"
        onClick={() => setCardOpen((v) => !v)}
        aria-expanded={cardOpen}
        className={`flex w-full cursor-pointer items-center gap-2 px-3.5 py-2.5 transition-colors hover:bg-slate-100/40 ${
          cardOpen ? 'border-b border-slate-100' : ''
        }`}
      >
        <span className="inline-flex w-6 h-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Users className="w-3 h-3" />
        </span>
        <span className="text-left text-slate-900" style={TYPE.captionSemibold}>
          Vendor Information
        </span>
        <ChevronDown
          className="ml-auto w-[13px] h-[13px] shrink-0 text-slate-400 transition-transform duration-300"
          style={{ transform: cardOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}
        />
      </button>

      {cardOpen && (
      <div className="px-3.5 py-3">
        {/* Identity hero. */}
        <div className="flex items-center gap-2.5 p-1.5">
          <SquareAvatar
            name={vendorName}
            size="md"
            {...(vendorLogoUrl ? { logoUrl: vendorLogoUrl } : {})}
          />
          <div className="min-w-0">
            {onOpenVendor ? (
              <a
                href={onOpenVendor}
                target="_blank"
                rel="noopener noreferrer"
                title={`Open ${vendorName} in Partners`}
                className="block truncate text-slate-900 transition-colors hover:text-primary"
                style={TYPE.defaultSemibold}
              >
                {vendorName}
              </a>
            ) : (
              <div className="truncate text-slate-900" style={TYPE.defaultSemibold} title={vendorName}>
                {vendorName}
              </div>
            )}
            <div className="text-slate-600" style={TYPE.microcopy}>
              Vendor
            </div>
          </div>
        </div>

        <div className="mt-2">
          <Section title="Contact" defaultOpen>
            {contact ? (
              <div>
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <div
                      className="flex w-10 h-10 items-center justify-center rounded-xl"
                      style={{
                        background:
                          'linear-gradient(135deg, rgba(139,92,246,0.14) 0%, rgba(139,92,246,0.26) 100%)',
                        color: '#7C3AED',
                        ...TYPE.caption,
                        fontWeight: 700,
                      }}
                    >
                      {contact.initials}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white bg-emerald-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span
                        className="truncate text-slate-900"
                        style={TYPE.captionSemibold}
                        title={contact.name}
                      >
                        {contact.name}
                      </span>
                      <Star className="w-3 h-3 shrink-0 fill-primary text-primary" aria-label="Primary contact" />
                    </div>
                    <p className="m-0 mt-0.5 truncate text-slate-400" style={TYPE.microcopy}>
                      {contact.role}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-col gap-1.5">
                  <ContactInfoRow icon={Phone} value={contact.phone} />
                  <ContactInfoRow icon={Mail} value={contact.email} />
                </div>
              </div>
            ) : (
              <p className="m-0 text-slate-400" style={TYPE.microcopy}>
                No contact assigned
              </p>
            )}
          </Section>

          <Section title="Shipping & Billing">
            <div className="flex flex-col gap-2">
              {/* Where the goods go. The partner that owns that address was
                  its own card beside it, and on a return it is the same name
                  nine times in ten, so the address card carries it alone. */}
              <AddressCard
                type="shipping"
                label="Ship To"
                site={shipTo}
                line={shipToAddress ?? null}
                editable={editable}
                onEdit={onEditShipTo}
              />
              <AddressCard
                type="billing"
                label="Refund account"
                hint="Where the vendor's refund lands: the currency configuration's Deposited to, an account in PKR or the return's currency."
                site={payTo}
                editable={editable}
                onEdit={onEditPayTo}
              />
              {/* The vendor's own address is off this block: it reads at
                  the top of the card, under their name, and a second copy of
                  it under the refund account was the same fact twice. */}
            </div>
          </Section>

          <Section title="Payment Method">
            <HoverEditRow
              editLabel="payment method"
              editable={editable && !paymentMethodCard}
              onEdit={onEditMethod}
              className={paymentMethodCard ? '' : 'rounded-xl border border-slate-200 p-3'}
            >
              {isUnset(paymentMethod) ? (
                <span className="text-slate-600" style={TYPE.caption}>
                  Not set
                </span>
              ) : paymentMethodCard ? (
                paymentMethodCard
              ) : (
                <div className="flex items-center gap-2">
                  <span
                    className="flex w-6 h-6 shrink-0 items-center justify-center rounded-md"
                    style={{ backgroundColor: TINTS[method.tint].bg, color: TINTS[method.tint].fg }}
                  >
                    <method.Icon className="w-[13px] h-[13px]" />
                  </span>
                  <span
                    className="truncate text-slate-900"
                    style={TYPE.captionSemibold}
                    title={paymentMethod}
                  >
                    {paymentMethod}
                  </span>
                </div>
              )}
            </HoverEditRow>
          </Section>
        </div>
      </div>
      )}
    </div>
  );
}
