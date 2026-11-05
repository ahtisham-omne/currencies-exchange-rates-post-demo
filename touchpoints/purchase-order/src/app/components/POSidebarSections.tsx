import React, { useState } from "react";
import {
  ChevronDown,
  Pencil,
  Users,
  WalletMinimal,
  Receipt,
  Clock,
  SquareSplitHorizontal,
  Phone,
  Mail,
  Star,
  Truck,
  Landmark,
  MapPin,
  Info,
  Building2,
  CreditCard,
  FileText,
  Hash,
  User,
  AlertCircle,
  Eye,
  EyeOff,
  Percent,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "./ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "./ui/tooltip";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "./ui/hover-card";
import { FONT } from "./designTokens";
import type { POVendor, PORecipient, POPaymentDelivery } from "./poStore";
import { getVendorContacts, VENDOR_PROFILES } from "./catalogData";
import type { VendorEntity } from "./catalogData";
import { resolvePaymentTermByName } from "./PaymentTermsDialog";
import type { PaymentTermTemplate } from "./PaymentTermsDialog";
import { resolvePaymentMethodByName } from "./PaymentMethodDialog";
import type { PaymentMethod, PaymentMethodType } from "./PaymentMethodDialog";
import { PARTNER_LOCATION_ITEMS } from "./partnerLocationData";
import { CurrencyFlag } from "./currency/CurrencyChip";
import { getCurrency } from "@/app/currency/currencies";
import { vendorCurrency } from "@/app/currency/poFx";

/* ═══════════════════════════════════════════════════════════════
   TYPOGRAPHY — CSS variable-bound, Inter only
   ═══════════════════════════════════════════════════════════════ */

const s = {
  sectionTitle: {
    fontSize: "var(--text-label)",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "1.45",
    fontFamily: FONT,
  } as React.CSSProperties,

  vendorNameLarge: {
    fontSize: "var(--text-base)",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "1.4",
    fontFamily: FONT,
    letterSpacing: "-0.005em",
  } as React.CSSProperties,

  groupLabel: {
    fontSize: "10px",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "1.35",
    fontFamily: FONT,
    letterSpacing: "0.04em",
    textTransform: "uppercase" as const,
  } as React.CSSProperties,

  contactName: {
    fontSize: "12px",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "1.4",
    fontFamily: FONT,
  } as React.CSSProperties,

  badge: {
    fontSize: "10px",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "1.3",
    fontFamily: FONT,
    letterSpacing: "0.03em",
  } as React.CSSProperties,

  initials: {
    fontSize: "10px",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "1",
    fontFamily: FONT,
  } as React.CSSProperties,

  showMore: {
    fontSize: "11px",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "1.35",
    fontFamily: FONT,
  } as React.CSSProperties,

  payFieldLabel: {
    fontSize: "11px",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "1.35",
    fontFamily: FONT,
  } as React.CSSProperties,

  payFieldValue: {
    fontSize: "12px",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "1.4",
    fontFamily: FONT,
  } as React.CSSProperties,

  locationName: {
    fontSize: "12px",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "1.4",
    fontFamily: FONT,
  } as React.CSSProperties,

  locationAddress: {
    fontSize: "11px",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "1.45",
    fontFamily: FONT,
  } as React.CSSProperties,

  accordionTitle: {
    fontSize: "11px",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "1.35",
    fontFamily: FONT,
    letterSpacing: "0.03em",
    textTransform: "uppercase" as const,
  } as React.CSSProperties,

  vendorLabel: {
    fontSize: "11px",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "1.35",
    fontFamily: FONT,
  } as React.CSSProperties,
};

/* ── Helper: generate initials from name ── */
function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/* ── Avatar background colors (CSS-variable-based, subtle tints) ── */
const AVATAR_BG_COLORS = [
  "var(--avatar-1-bg)",
  "var(--avatar-3-bg)",
  "var(--avatar-4-bg)",
  "var(--avatar-2-bg)",
  "var(--avatar-5-bg)",
  "var(--avatar-6-bg)",
  "var(--avatar-7-bg)",
];
const AVATAR_TEXT_COLORS = [
  "var(--avatar-1-text)",
  "var(--avatar-3-text)",
  "var(--avatar-4-text)",
  "var(--avatar-2-text)",
  "var(--avatar-5-text)",
  "var(--avatar-6-text)",
  "var(--avatar-7-text)",
];

/* ═══════════════════════════════════════════════════════════════
   COLLAPSIBLE SECTION WRAPPER
   ───────────────────────────────────────────────────────────────
   1:1 visual port of the Partners DashInfoCard
   (`Partners/.../VendorDetailsPage.tsx:3780–3838`) so the PO detail
   sidebar reads as part of the same surface system:
     - rounded-xl bordered white card with a soft shadow
     - 6×6 rounded-md accent icon box + 12px / 600 slate-700 title
     - hover wash `#FAFBFC`
     - header bottom border `#F1F5F9` while open
     - chevron rotates 0deg (open) / -90deg (closed)
   Inner content padding stays the responsibility of each section
   so existing Order Summary / Credit / Timeline layouts don't need
   to change.
   ═══════════════════════════════════════════════════════════════ */

function CollapsibleSection({
  icon: Icon,
  title,
  badge: badgeContent,
  children,
  defaultOpen = true,
}: {
  icon: React.ElementType;
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-border bg-white overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button
            className="w-full px-3.5 py-2.5 flex items-center gap-2 cursor-pointer hover:bg-[#FAFBFC] transition-colors"
            style={{ borderBottom: open ? "1px solid #F1F5F9" : "none" }}
          >
            <div className="w-6 h-6 rounded-md bg-accent flex items-center justify-center shrink-0">
              <Icon className="w-3 h-3 text-primary" />
            </div>
            <span
              className="text-slate-700 text-left"
              style={{ fontSize: 12, fontWeight: 600, fontFamily: FONT }}
            >
              {title}
            </span>
            <span className="ml-auto flex items-center gap-1.5">
              {badgeContent}
              <ChevronDown
                className="w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
              />
            </span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>{children}</CollapsibleContent>
      </Collapsible>
    </div>
  );
}

/* Inline edit affordances are now per-field on the `FieldRow` helper,
   so the page-level `EditButton` component was removed in the
   Partner-Information compression pass. */

/* ── InnerAccordion — collapsible sub-section inside the Vendor
   Information DashInfoCard. Visual recipe mirrors the outer DashInfoCard
   header (`VendorDetailsPage.tsx:3795-3825`) at a smaller scale so the
   hierarchy reads as "card → sub-section → field":
     · Top border `border-t border-muted` separates each accordion from
       the previous one
     · Header `py-2.5` with no horizontal padding (parent card already
       provides `px-3.5`)
     · Title `11px / 600` slate-700 + uppercase tracking for clear
       sub-section feel vs the 12px parent-card title
     · Chevron rotates 0deg (open) / -90deg (closed) on the same
       300ms cubic-bezier easing as the outer card
     · Content slides open with `pt-1 pb-3` (no top padding needed; the
       header's bottom-border carries the visual gap)
   The accordion preserves all child edit affordances — pencils still
   fade in on per-row hover inside the expanded content. ── */
function InnerAccordion({
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
    <div className="border-t border-muted">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full py-2.5 flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity"
      >
        <span
          className="text-slate-700 uppercase"
          style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.04em", fontFamily: FONT }}
        >
          {title}
        </span>
        <ChevronDown
          className="w-3 h-3 text-slate-400 shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
        />
      </button>
      {open && (
        <div className="pb-3 -mt-0.5">
          {children}
        </div>
      )}
    </div>
  );
}

/* ═════════════════════════════════════════���════════════════════
   UNIFIED VENDOR INFO CARD
   Combines vendor, contacts, locations, and payment into one card.
   
   Structure:
   - Always visible: Vendor identity + POC (primary + secondary avatars)
   - Accordion 1: Locations (Pay To, Ship To, Funded By) — closed
   - Accordion 2: Payment & Shipping — closed
   ═══════════════════════════════════════════════════════════════ */

/** Helper to resolve a vendor entity's display info */
function resolveVendorDisplay(
  name: string,
  vendorList: VendorEntity[],
  fallbackName: string
): { displayName: string; locationName: string; address: string; abbr: string } {
  const entity = vendorList.find((v) => v.name === name);
  if (entity) {
    const loc = entity.locations.find((l) => l.isDefault) || entity.locations[0];
    return {
      displayName: loc?.name || entity.name,
      locationName: loc?.name || "",
      address: loc?.description || "",
      abbr: entity.abbr,
    };
  }
  return { displayName: name || fallbackName, locationName: "", address: "", abbr: (name || fallbackName).charAt(0).toUpperCase() };
}

/* `LOCATION_ACCENTS` was used to color a small dot next to each location
   row but was removed in this pass — Partners' Financial Summary location
   rows don't use accent dots, so neither do we now. */

export function VendorInfoCard({
  vendor,
  recipient,
  payment,
  canEdit,
  secondaryContactNames,
  onEditContact,
  onEditPayTo,
  onEditShipTo,
  onEditFundedBy,
  onEditPaymentTerms,
  onEditPaymentMethod,
  payToVendors,
  shippedToVendors,
  fundedByVendors,
  defaultOpen = true,
  poCurrency,
}: {
  vendor: POVendor;
  recipient: PORecipient;
  payment: POPaymentDelivery;
  canEdit: boolean;
  secondaryContactNames: string[];
  onEditContact?: () => void;
  onEditPayTo?: () => void;
  onEditShipTo?: () => void;
  onEditFundedBy?: () => void;
  onEditPaymentTerms?: () => void;
  onEditPaymentMethod?: () => void;
  payToVendors: VendorEntity[];
  shippedToVendors: VendorEntity[];
  fundedByVendors: VendorEntity[];
  defaultOpen?: boolean;
  /** The PO's currency, to say whether it is still the vendor's default. */
  poCurrency?: string;
}) {
  const contacts = getVendorContacts(vendor.name);
  /* The vendor's default currency, from the partner record (spec 4.2): the
     reason the PO opened in it. */
  const defaultCurrency = vendorCurrency(vendor.name);
  const vendorInitials = getInitials(vendor.name);

  /* Resolve secondary contacts from names */
  const secondaryContacts = contacts.filter((c) =>
    secondaryContactNames.includes(c.name) && c.name !== recipient.name
  );

  /* Resolve location display info */
  let payToInfo = resolveVendorDisplay(payment.payTo, payToVendors, "Not Set");
  let shipToInfo = resolveVendorDisplay(payment.shippedTo, shippedToVendors, "Not Set");
  let fundedByInfo = resolveVendorDisplay(payment.fundedBy, fundedByVendors, "Not Set");

  /* Pay To / Ship To / Funded By all draw from the Partners-aligned
     SelectPartnerLocationDialog (PO Detail page). When the chosen name
     matches an item in the canonical dataset, we merge in its
     `location` so the LocationCard's address line renders the same
     address the user saw in the picker. Falls back gracefully for
     legacy names not present in the Partners dataset. */
  const payToPartner = PARTNER_LOCATION_ITEMS.find((i) => i.name === payment.payTo);
  if (payToPartner) {
    payToInfo = {
      ...payToInfo,
      address: payToInfo.address || payToPartner.location || "",
      abbr: payToPartner.logoText || payToInfo.abbr,
    };
  }
  const shipToPartner = PARTNER_LOCATION_ITEMS.find((i) => i.name === payment.shippedTo);
  if (shipToPartner) {
    shipToInfo = {
      ...shipToInfo,
      address: shipToInfo.address || shipToPartner.location || "",
      abbr: shipToPartner.logoText || shipToInfo.abbr,
    };
  }
  const fundedByPartner = PARTNER_LOCATION_ITEMS.find((i) => i.name === payment.fundedBy);
  if (fundedByPartner) {
    fundedByInfo = {
      ...fundedByInfo,
      address: fundedByInfo.address || fundedByPartner.location || "",
      abbr: fundedByPartner.logoText || fundedByInfo.abbr,
    };
  }
  /* Pay To and Funded By are partner-level only (ERP-4790, ERP-6264):
     show the partner name, never a default location name. */
  if (payment.payTo) payToInfo = { ...payToInfo, displayName: payment.payTo, locationName: "" };
  if (payment.fundedBy) fundedByInfo = { ...fundedByInfo, displayName: payment.fundedBy, locationName: "" };

  /* Resolve payment terms info. The inline pill below picks colors per-type
     so the legacy `TYPE_COLORS` map + `termBadge` were dropped in the
     Partner-Information compression pass. */
  const termInfo = resolvePaymentTermByName(payment.paymentTerms);

  // Compact-layout helpers — single integer days extracted from term name
  // (mirrors Partners' rule at `PaymentTermCard.tsx:156`).
  const ptDays = termInfo?.name.match(/\d+/)?.[0] || "30";
  const pill = termInfo
    ? termInfo.type === "NET"
      ? { text: "#0A77FF", bg: "#EFF6FF", border: "#DBEAFE", Icon: Receipt, label: "NET" }
      : termInfo.type === "Pre"
        ? { text: "#6D28D9", bg: "#F5F3FF", border: "#EDE9FE", Icon: Clock, label: "Pre" }
        : { text: "#B45309", bg: "#FFFBEB", border: "#FDE68A", Icon: SquareSplitHorizontal, label: "Split" }
    : null;

  return (
    <CollapsibleSection icon={Users} title="Vendor Information" defaultOpen={defaultOpen}>
      {/* Card body modelled on Partners' "Partner Information" DashInfoCard
          (`VendorDetailsPage.tsx:3361-3482`): a single flat stack of compact
          key/value rows in a 2-column grid, broken up by hairline
          `border-t border-muted` dividers — no inner section headers and no
          inner cards. Edit affordances live as hover-pencils on the per-row
          DashInfoLabels so every edit handler (`onEditContact`, `onEditPayTo`,
          `onEditShipTo`, `onEditFundedBy`, `onEditPaymentTerms`,
          `onEditPaymentMethod`) is preserved in place. */}
      <div className="px-3.5 py-3">

        {/* ── HERO — vendor identity (40px gradient avatar + name + meta) ── */}
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: "linear-gradient(135deg, #EBF3FF 0%, #DBEAFE 100%)",
              color: "hsl(var(--primary))",
              fontSize: 12,
              fontWeight: 700,
              fontFamily: FONT,
            }}
          >
            {vendorInitials}
          </div>
          <div className="min-w-0 flex-1">
            {/* Vendor name — 13px / 600 / foreground, matching Partners'
                Primary Contact card name spec verbatim
                (`VendorDetailsPage.tsx:6332`). */}
            <p
              className="text-foreground truncate"
              style={{ fontSize: 13, fontWeight: 600, fontFamily: FONT, lineHeight: 1.3 }}
              title={vendor.name}
            >
              {vendor.name}
            </p>
            {/* Meta line — contact count · payment term. The locations
                segment was removed 2026-08-07 per buyer: too noisy in
                the header. */}
            {(() => {
              const contactCount = 1 + secondaryContacts.length;
              const contactPart = `${contactCount} contact${contactCount !== 1 ? "s" : ""}`;
              const termPart = termInfo?.name ?? null;

              return (
                <p
                  className="text-slate-500 truncate"
                  style={{ fontSize: 11, fontWeight: 400, fontFamily: FONT, lineHeight: 1.4, marginTop: 2 }}
                >
                  {contactPart}
                  {termPart ? ` · ${termPart}` : ""}
                </p>
              );
            })()}
          </div>
        </div>

        {/* ── Default currency (spec 4.2) — the partner record's, so the
            buyer can see why the PO opened in it. DashInfoLabel row recipe:
            10/500 slate-400 label, 12/500 slate-700 value. ── */}
        <div className="mt-3 flex items-start justify-between gap-3 border-t border-muted pt-2.5">
          <div className="min-w-0">
            <p className="text-slate-400" style={{ fontSize: 10, fontWeight: 500, fontFamily: FONT }}>
              Default currency
            </p>
            <p className="text-slate-500 truncate" style={{ fontSize: 10, fontWeight: 400, fontFamily: FONT, marginTop: 2 }}>
              {!poCurrency || poCurrency === defaultCurrency
                ? "This PO opened in it"
                : `This PO was changed to ${poCurrency}`}
            </p>
          </div>
          <p
            className="flex items-center gap-1.5 text-slate-700 shrink-0"
            style={{ fontSize: 12, fontWeight: 500, fontFamily: FONT }}
            title={getCurrency(defaultCurrency)?.name}
          >
            <CurrencyFlag code={defaultCurrency} />
            {defaultCurrency}
            <span className="text-slate-500" style={{ fontWeight: 400 }}>{getCurrency(defaultCurrency)?.name}</span>
          </p>
        </div>

        {/* ── Three collapsible sub-sections: Contact / Shipping & Billing /
            Payment. Contact is open by default (highest-frequency lookup);
            the other two are closed so the card reads short out of the box.
            Each accordion preserves the inline per-field edit pencils. ── */}
        <div className="mt-3">

          {/* CONTACT */}
          <InnerAccordion title="Contact" defaultOpen={true}>
            {/* Primary Contact card — verbatim port of Partners' location-detail
                Primary Contact card body (`Partners/.../VendorDetailsPage.tsx:5983-6006`).
                Recipe choices preserved 1:1 from Partners:
                  - 40×40 rounded-xl gradient avatar `linear-gradient(135deg, #EBF3FF 0%, #DBEAFE 100%)`
                    with hsl(var(--primary)) initials at 12/700.
                  - 14×14 emerald-500 online-dot anchored bottom-right of the
                    avatar with a 2px white ring.
                  - Name 12/600 slate-700, designation 10/400 slate-500.
                  - Phone + email rows: `rounded-lg bg-slate-50 border border-muted`
                    with `Phone`/`Mail` icons in `#B0BEC5` (slate hint) that
                    transition to primary on hover; hover swaps the row to
                    `bg-accent border-blue-100`.
                Additions for our PO surface: a small blue Star next to the
                name (matches the reference screenshot, marks the contact as
                Primary) + hover-pencil edit affordance preserved on the
                avatar row. */}
            <div className="group/contact-card">
              {/* Avatar + name + Star + designation */}
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{
                      // Violet contact-avatar palette — port of Partners' canonical
                      // "people / contact" semantic (the violet chip Partners uses
                      // for the contact-widget header at
                      // `Partners/.../VendorDetailsPage.tsx:5978-5980`). Swapped from
                      // the primary-blue gradient so the contact avatar visually
                      // separates from the primary-blue vendor avatar that sits
                      // directly above it in the same Vendor Information card —
                      // otherwise both avatars stack as identical blue chips and
                      // the buyer can't tell vendor from contact at a glance.
                      background:
                        "linear-gradient(135deg, #F0EBFF 0%, #E9DFFF 100%)",
                      color: "#6D28D9" /* violet-700 — readable contrast on the
                                            light violet gradient */,
                      fontSize: 12,
                      fontWeight: 700,
                      fontFamily: FONT,
                    }}
                  >
                    {getInitials(recipient.name)}
                  </div>
                  {/* Online dot — emerald-500, 2px white ring (Partners verbatim) */}
                  <div
                    className="absolute w-3.5 h-3.5 rounded-full"
                    style={{
                      bottom: -2,
                      right: -2,
                      backgroundColor: "#10B981" /* emerald-500 */,
                      border: "2px solid #FFFFFF",
                    }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <p
                      className="text-slate-700 truncate"
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        fontFamily: FONT,
                        lineHeight: 1.35,
                      }}
                      title={recipient.name}
                    >
                      {recipient.name}
                    </p>
                    {/* Blue Star — marks this contact as the Primary
                        (matches the reference screenshot). Partners' canonical
                        Primary marker uses blue-800 fill (`PrimaryPill.tsx:28`). */}
                    <Star
                      className="shrink-0 fill-blue-800 text-blue-800"
                      style={{ width: 12, height: 12 }}
                      aria-label="Primary contact"
                    />
                  </div>
                  {recipient.role && (
                    <p
                      className="text-slate-500 truncate"
                      style={{
                        fontSize: 10,
                        fontWeight: 400,
                        fontFamily: FONT,
                        lineHeight: 1.4,
                        marginTop: 2,
                      }}
                    >
                      {recipient.role}
                    </p>
                  )}
                </div>
                {/* Hover-pencil — preserved from prior FieldRow `onEdit` so the
                    swap-contact flow still fires. Hidden until row hover. */}
                {canEdit && onEditContact && (
                  <button
                    type="button"
                    onClick={onEditContact}
                    className="shrink-0 opacity-0 group-hover/contact-card:opacity-100 transition-opacity rounded-md flex items-center justify-center"
                    style={{
                      width: 24,
                      height: 24,
                      color: "hsl(var(--muted-foreground))",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "hsl(var(--accent))";
                      e.currentTarget.style.color = "hsl(var(--primary))";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                      e.currentTarget.style.color = "hsl(var(--muted-foreground))";
                    }}
                    aria-label="Change primary contact"
                  >
                    <Pencil style={{ width: 12, height: 12 }} strokeWidth={2} />
                  </button>
                )}
              </div>

              {/* Phone + email — `rounded-lg bg-slate-50 border border-muted`
                  rows with slate-400 icons that swap to primary on hover.
                  Verbatim port of Partners' contact-info rows
                  (`VendorDetailsPage.tsx:5995-6003`). */}
              {(recipient.phone || recipient.email) && (
                <div className="mt-3 space-y-1.5">
                  {recipient.phone && (
                    <ContactInfoRow icon={Phone} value={recipient.phone} />
                  )}
                  {recipient.email && (
                    <ContactInfoRow icon={Mail} value={recipient.email} />
                  )}
                </div>
              )}
            </div>

            {secondaryContacts.length > 0 && (
              <SecondaryContactsToggle contacts={secondaryContacts} />
            )}
            {secondaryContacts.length === 0 && canEdit && (
              <button
                className="mt-2.5 w-full py-1.5 rounded-md border border-dashed border-border text-muted-foreground/70 hover:text-primary hover:border-primary/30 hover:bg-primary/[0.03] transition-all cursor-pointer"
                style={{ fontSize: 11, fontWeight: 500, fontFamily: FONT }}
                onClick={onEditContact}
              >
                + Add secondary contacts
              </button>
            )}
          </InnerAccordion>

          {/* SHIPPING & BILLING — Partners "Configure Vendor" modal recipe
              (`Partners/.../CreatePartnerModal.tsx:5320-5526`). Each of Pay To
              / Ship To / Funded By renders as a Partners-aligned card with:
                - White surface, `border-[#E8ECF1]` rounded-xl shell.
                - Hover: `border-slate-300` + 2-layer Partners shadow.
                - Header row: small slate-400 icon + 11/500 slate-500 label
                  + Info tooltip + hover-Pencil affordance (opacity 0→1 on
                  card hover).
                - Body row: 36×36 PartnerLogo (hash-coloured filled square
                  with white initials) + 13/600 foreground name. Ship To
                  adds an address line with MapPin → Google Maps link.
                - Click anywhere on the card opens the dialog (the existing
                  `onEditPayTo` / `onEditShipTo` / `onEditFundedBy` handlers
                  are kept verbatim).
              Stacked single-column because the PO detail sidebar is 300px;
              Partners' 2×2 grid works in their modal width but would crush
              each card under 140px here. */}
          <InnerAccordion title="Shipping & Billing" defaultOpen={false}>
            <div className="flex flex-col gap-2.5">
              <LocationCard
                label="Pay To"
                icon={Receipt}
                tooltip="The entity that receives payment for this purchase order. Defaults to the vendor; change this if payments go to a different party such as a parent company or billing agent."
                info={payToInfo}
                canEdit={canEdit}
                onEdit={onEditPayTo}
                emptyLabel="Select recipient"
              />
              <LocationCard
                label="Ship To"
                icon={Truck}
                tooltip="The default delivery destination for goods on this purchase order. Defaults to your company; change this if items are regularly shipped to a different location."
                info={shipToInfo}
                canEdit={canEdit}
                onEdit={onEditShipTo}
                emptyLabel="Select destination"
                showAddress
              />
              <LocationCard
                label="Funded By"
                icon={Landmark}
                tooltip="The entity that funds purchases on this order. Defaults to your company; change this only if another entity (such as a parent company or partner) is responsible for financing this transaction."
                info={fundedByInfo}
                canEdit={canEdit}
                onEdit={onEditFundedBy}
                emptyLabel="Select funding source"
              />
            </div>
          </InnerAccordion>

          {/* PAYMENT TERMS — own accordion (split from the prior combined
              "Payment" accordion 2026-05). Card surface comes from Partners'
              canonical `PaymentTermCard` recipe. */}
          <InnerAccordion title="Payment Terms" defaultOpen={false}>
            {termInfo ? (
              <PaymentTermCard
                term={termInfo}
                onClick={canEdit && onEditPaymentTerms ? onEditPaymentTerms : undefined}
                showEditPencil={canEdit && !!onEditPaymentTerms}
              />
            ) : (
              <FieldRow
                label="Payment Terms"
                onEdit={canEdit && onEditPaymentTerms ? onEditPaymentTerms : undefined}
              >
                <span
                  className="text-slate-700 truncate"
                  style={{ fontSize: 12, fontWeight: 500, fontFamily: FONT }}
                >
                  {payment.paymentTerms || "—"}
                </span>
              </FieldRow>
            )}
          </InnerAccordion>

          {/* PAYMENT METHOD — separate accordion, surfaced beside the
              terms accordion above so the two payment surfaces are
              independently collapsible. Card surface ported verbatim
              from Partners' Configure Vendor modal saved-method card
              (`Partners/.../PaymentMethodsSection.tsx:652-803`). */}
          <InnerAccordion title="Payment Method" defaultOpen={false}>
            {(() => {
              const methodObj = resolvePaymentMethodByName(payment.paymentMethod);
              const handleEdit = canEdit && onEditPaymentMethod ? onEditPaymentMethod : undefined;
              return methodObj ? (
                <PaymentMethodCard
                  method={methodObj}
                  onClick={handleEdit}
                  showEditPencil={!!handleEdit}
                />
              ) : payment.paymentMethod ? (
                <PaymentMethodCard
                  method={null}
                  fallbackName={payment.paymentMethod}
                  onClick={handleEdit}
                  showEditPencil={!!handleEdit}
                />
              ) : (
                <FieldRow
                  label="Payment Method"
                  onEdit={handleEdit}
                >
                  <span
                    className="text-slate-500"
                    style={{ fontSize: 12, fontWeight: 500, fontFamily: FONT }}
                  >
                    —
                  </span>
                </FieldRow>
              );
            })()}
          </InnerAccordion>
        </div>
      </div>
    </CollapsibleSection>
  );
}

/* ── FieldRow — Partners DashInfoLabel + value pattern with an optional
   hover-only edit pencil. Used everywhere in the compressed Vendor
   Information card to preserve the edit flows without taking visual
   space. The pencil mirrors Partners' inline `EditButton` style — 12px
   slate-400 by default, primary on hover. ── */
function FieldRow({
  label,
  onEdit,
  children,
}: {
  label: string;
  onEdit?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 group/field">
      <div className="flex items-center gap-1 mb-px">
        <p
          className="text-slate-400"
          style={{ fontSize: 10, fontWeight: 500, fontFamily: FONT }}
        >
          {label}
        </p>
        {onEdit && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="size-3.5 inline-flex items-center justify-center rounded text-slate-400 hover:text-primary hover:bg-slate-50 opacity-0 group-hover/field:opacity-100 transition-all cursor-pointer"
            title={`Edit ${label.toLowerCase()}`}
          >
            <Pencil className="size-2.5" />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

/* ── LocationCard — Partners "Configure Vendor" modal card recipe
   (verbatim port of `Partners/.../CreatePartnerModal.tsx:5424-5491`).
   Replaces the prior `LocationField` (2-col `FieldRow` grid) used in
   the Shipping & Billing accordion. Used for Pay To, Ship To, and
   Funded By — each shares the same shell so the trio reads as one
   coordinated control system.

   Recipe choices preserved 1:1 from Partners:
     - Shell: `group relative rounded-xl border border-[#E8ECF1] bg-white
       hover:border-slate-300 hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)]
       transition-all duration-200 cursor-pointer p-3 flex flex-col gap-2.5`.
     - Header: 14×14 slate-400 icon + 11/500 slate-500 label + Info
       tooltip + 12×12 slate-300 Pencil (opacity 0 → group-hover 100).
     - Body: 36×36 PartnerLogo (white initials over hash-derived color
       fill) + 13/600 foreground name. `showAddress` (Ship To only)
       toggles a MapPin → Google Maps link rendered beneath the name.
     - Empty state: 36×36 slate-50 dashed square with the section icon
       + 12/500 slate-400 "Select …" prompt.

   The whole card is clickable (entire surface dispatches `onEdit`);
   the Info tooltip swallows its own click so hovering the (i) does
   not open the dialog. */
function LocationCard({
  label,
  icon: Icon,
  tooltip,
  info,
  canEdit,
  onEdit,
  emptyLabel,
  showAddress = false,
}: {
  label: string;
  icon: React.ElementType;
  tooltip: string;
  info: { displayName: string; locationName: string; address: string; abbr: string };
  canEdit: boolean;
  onEdit?: () => void;
  emptyLabel: string;
  showAddress?: boolean;
}) {
  const hasValue = info.displayName && info.displayName !== "Not Set";
  const addressLines = info.address.split("\n").map((l) => l.trim()).filter(Boolean);
  const addressOneLine = addressLines.join(", ");
  const handleClick = canEdit && onEdit ? onEdit : undefined;

  return (
    <div
      onClick={handleClick}
      className={`group relative rounded-xl border bg-white transition-all duration-200 ${
        handleClick ? "cursor-pointer hover:border-slate-300 hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)]" : ""
      }`}
      style={{
        borderColor: "#E8ECF1",
        padding: 12,
      }}
    >
      {/* Header row — small icon + label + Info tooltip + hover-Pencil */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: "#94A3B8" /* slate-400 */ }} strokeWidth={2} />
          <span
            className="text-slate-500"
            style={{ fontSize: 11, fontWeight: 500, fontFamily: FONT, lineHeight: 1.4 }}
          >
            {label}
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center justify-center cursor-help shrink-0"
                aria-label={`${label} info`}
              >
                <Info
                  className="w-3 h-3"
                  style={{ color: "#CBD5E1" /* slate-300 */ }}
                  strokeWidth={2}
                />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6} className="max-w-[240px]">
              <span style={{ fontSize: 11, fontWeight: 400, fontFamily: FONT, lineHeight: 1.5 }}>
                {tooltip}
              </span>
            </TooltipContent>
          </Tooltip>
        </div>
        {canEdit && onEdit && (
          <Pencil
            className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            style={{ color: "#CBD5E1" /* slate-300 */ }}
            strokeWidth={2}
          />
        )}
      </div>

      {/* Body row */}
      <div className="mt-2.5">
        {hasValue ? (
          <div className={`flex ${showAddress ? "items-start" : "items-center"} gap-2.5`}>
            {/* Avatar — 26×26 (Partners' modal uses 36, but our 300px sidebar
                column makes 36 dominate the card; 26 keeps the logo legible
                while leaving more room for the partner name on a single
                line). The empty-state placeholder below uses the same size
                so toggling between configured / empty states doesn't shift
                the body row height. */}
            <PartnerLogo abbr={info.abbr || info.displayName.charAt(0)} size={26} />
            <div className="min-w-0 flex-1">
              <p
                className="text-foreground truncate"
                style={{ fontSize: 13, fontWeight: 600, fontFamily: FONT, lineHeight: 1.35 }}
                title={info.displayName}
              >
                {info.displayName}
              </p>
              {showAddress && addressOneLine && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressOneLine)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-start gap-1 mt-1 text-slate-500 hover:text-primary hover:underline transition-colors"
                  style={{ fontSize: 11, fontWeight: 400, lineHeight: 1.45, fontFamily: FONT }}
                >
                  <MapPin
                    className="w-3 h-3 shrink-0"
                    style={{ marginTop: 2, color: "#94A3B8" /* slate-400 */ }}
                    strokeWidth={2}
                  />
                  <span className="break-words">{addressOneLine}</span>
                </a>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <div
              className="rounded-md flex items-center justify-center shrink-0"
              style={{
                width: 26,
                height: 26,
                backgroundColor: "#F8FAFC" /* slate-50 */,
                border: "1px dashed #CBD5E1" /* slate-300 */,
              }}
            >
              <Icon className="w-3 h-3" style={{ color: "#CBD5E1" /* slate-300 */ }} strokeWidth={2} />
            </div>
            <p style={{ fontSize: 12, fontWeight: 500, color: "#94A3B8", fontFamily: FONT }}>
              {emptyLabel}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── PartnerLogo — 36×36 (default) filled square with the partner's
   `abbr` rendered in white. Verbatim port of Partners' `PartnerLogo`
   fallback recipe (`CreatePartnerModal.tsx:4981-4985`); we always use
   the fallback path because our `VendorEntity` doesn't carry image URLs.
   The fill colour is derived deterministically from a small palette so
   the same partner always gets the same colour across sessions. */
const LOGO_COLOR_PALETTE = [
  "#1E293B" /* slate-800 — matches the Toyota "T" in the reference */,
  "#8B5CF6" /* violet-500 — matches the FR Conversions "FR" in the ref */,
  "#0A77FF" /* primary blue */,
  "#10B981" /* emerald-500 */,
  "#F59E0B" /* amber-500 */,
  "#EC4899" /* pink-500 */,
  "#0891B2" /* cyan-600 */,
  "#65A30D" /* lime-600 */,
];

function getLogoColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return LOGO_COLOR_PALETTE[hash % LOGO_COLOR_PALETTE.length];
}

function PartnerLogo({ abbr, size = 36 }: { abbr: string; size?: number }) {
  const text = abbr.toUpperCase().slice(0, 2);
  const color = getLogoColor(text);
  return (
    <div
      className="rounded-lg flex items-center justify-center text-white shrink-0"
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        fontWeight: 700,
        fontSize: Math.round(size * 0.3),
        fontFamily: FONT,
        lineHeight: 1,
      }}
    >
      {text}
    </div>
  );
}

/* ── PaymentTermCard — Verbatim port of Partners' canonical
   `PaymentTermCard` (`Partners/.../PaymentTermCard.tsx:139-337`), the
   same card Partners renders inside their Payment Terms `DashInfoCard`
   on the vendor detail right-sidebar (`VendorDetailsPage.tsx:3624-3636`).

   Recipe choices preserved 1:1 from Partners:
     - Shell: `bg-white border rounded-xl border-[#E8ECF1] shadow-[0_1px_3px_rgba(0,0,0,0.03)]`
       with hover `border-blue-200 shadow-[0_4px_16px_-4px_rgba(10,119,255,0.10)]`.
     - Row 1: two-half pill — colour-coded NET / Pre / Split half with
       category icon (`Receipt` / `Clock` / `SquareSplitHorizontal`) +
       white half showing the trigger event. Palette matches Partners:
         NET   → primary blue   (`#0A77FF` text on `#EFF6FF`, `#DBEAFE` border)
         Pre   → violet-700     (`#6D28D9` text on `#F5F3FF`, `#EDE9FE` border)
         Split → amber-700      (`#B45309` text on `#FFFBEB`, `#FDE68A` border)
     - Row 2: 13/600 foreground name.
     - Row 3: 11/400 slate-500 description, line-clamp-2.
     - Row 4: hero 22/600 tabular-nums days + "days" sublabel + "N in use"
       chip on the right (Building2 + count).
   Wrapped in an optional `onClick` so the entire card surface dispatches
   the existing `onEditPaymentTerms` handler. */
function PaymentTermCard({
  term,
  onClick,
  showEditPencil = false,
}: {
  term: PaymentTermTemplate;
  onClick?: () => void;
  /** Render the hover-only edit pencil in the top-right corner. Mirrors
   *  the LocationCard pattern: opacity-0 → opacity-100 on `group` hover. */
  showEditPencil?: boolean;
}) {
  // Days extraction:
  // Names like "2/10 Net 30 Post Shipping" have a discount segment ("2/10")
  // *before* the net-days number, so a naïve `\d+` regex returns "2" (wrong).
  // Prefer the number that follows "Net " when present, and only fall back
  // to the first digit run for non-NET shapes (Pre/Split names like
  // "30/70 Split: …" still surface "30"). Final fallback "30" keeps the
  // hero non-empty for shapes with no digits ("Due on Receipt").
  const netMatch = term.name.match(/net\s+(\d+)/i);
  const ptDays = netMatch?.[1] || term.name.match(/\d+/)?.[0] || "30";
  const pill =
    term.type === "NET"
      ? { text: "#0A77FF", bg: "#EFF6FF", border: "#DBEAFE", Icon: Receipt }
      : term.type === "Pre"
        ? { text: "#6D28D9", bg: "#F5F3FF", border: "#EDE9FE", Icon: Clock }
        : { text: "#B45309", bg: "#FFFBEB", border: "#FDE68A", Icon: SquareSplitHorizontal };

  return (
    <div
      onClick={onClick}
      className={`group bg-white rounded-xl border transition-all duration-200 flex flex-col relative ${
        onClick
          ? "cursor-pointer hover:border-blue-200 hover:shadow-[0_4px_16px_-4px_rgba(10,119,255,0.10)]"
          : ""
      }`}
      style={{
        borderColor: "#E8ECF1",
        boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
        padding: 12,
      }}
    >
      {/* Row 1: Type pill + hover-only edit pencil */}
      <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
        <span
          className="inline-flex items-stretch rounded-full overflow-hidden border shrink-0 max-w-full"
          style={{ borderColor: pill.border }}
        >
          <span
            className="inline-flex items-center gap-1 px-2 py-[2px]"
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: pill.text,
              backgroundColor: pill.bg,
              fontFamily: FONT,
              lineHeight: 1.4,
            }}
          >
            <pill.Icon className="w-3 h-3" strokeWidth={2} />
            {term.type}
          </span>
          <span
            className="inline-flex items-center px-2 py-[2px] bg-white text-slate-500 border-l max-w-[160px]"
            style={{
              fontSize: 10,
              fontWeight: 500,
              borderColor: pill.border,
              fontFamily: FONT,
              lineHeight: 1.4,
            }}
          >
            <span className="truncate">{term.triggerEvent}</span>
          </span>
        </span>
        {showEditPencil && (
          <Pencil
            className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            style={{ color: "#CBD5E1" /* slate-300 */ }}
            strokeWidth={2}
            aria-label="Edit payment terms"
          />
        )}
      </div>

      {/* Row 2: Name */}
      <div className="shrink-0 mb-1">
        <p
          className="text-foreground truncate"
          style={{ fontSize: 13, fontWeight: 600, fontFamily: FONT, lineHeight: 1.35 }}
          title={term.name}
        >
          {term.name}
        </p>
      </div>

      {/* Row 3: Description */}
      <div className="shrink-0 mb-2">
        <p
          className="text-slate-500 line-clamp-2"
          style={{ fontSize: 11, fontWeight: 400, fontFamily: FONT, lineHeight: 1.5 }}
        >
          {term.description}
        </p>
      </div>

      {/* Row 4: Hero days value + in-use chip */}
      <div className="flex items-baseline justify-between shrink-0">
        <div className="flex items-baseline gap-2">
          <span
            className="text-foreground tabular-nums tracking-tight"
            style={{ fontSize: 22, fontWeight: 600, lineHeight: 1, fontFamily: FONT }}
          >
            {ptDays}
          </span>
          <span
            className="text-slate-400"
            style={{ fontSize: 11, fontWeight: 500, fontFamily: FONT, lineHeight: 1 }}
          >
            days
          </span>
        </div>
        <span
          className="inline-flex items-center gap-1 text-slate-400 tabular-nums"
          style={{ fontSize: 10, fontWeight: 500, fontFamily: FONT, lineHeight: 1 }}
        >
          <Building2 className="w-3 h-3" strokeWidth={2} />
          {term.vendorsApplied} in use
        </span>
      </div>
    </div>
  );
}

/* ── PaymentMethodCard — Verbatim port of Partners' Configure Vendor
   modal saved payment method card (`Partners/.../PaymentMethodsSection.tsx:652-803`).
   Used in the PO detail sidebar's Payment Method accordion.

   Recipe choices preserved 1:1 from Partners:
     - Shell: `bg-white rounded-xl border-border` + Partners' canonical
       hover lift (`hover:border-slate-300 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06)]`).
       If `isDefault`, the shell upgrades to primary-tinted border + glow
       (`border-[1.5px] border-primary/40 shadow-[0_2px_12px_-4px_rgba(10,119,255,0.12)]`).
     - Header row: 28×28 rounded-lg category-tinted icon chip
       (`bg/color` driven by `CAT_PALETTE`) + 12/600 method name + small
       category mini-pill (9/600) on the same colour ladder.
     - Right side: Primary star pill (`#EFF6FF/#1E40AF/#BFDBFE`) when
       default, plus a hover-only edit Pencil — matches the LocationCard
       and PaymentTermCard interaction pattern.
     - Data rows panel: slate-50 `#FAFBFC` bg + slate-100 border + 11/500
       label · 11/600 tabular-nums value rows. Shows IBAN ••••last4 +
       contact name + phone.
     - Discount strip (only when `discountPct > 0`): Partners' compact
       inline "Discount X%" badge with `Percent` icon.

   `method` may be `null` (legacy / unresolved). In that case the card
   renders a degraded variant: icon chip derived from `fallbackName` +
   the name itself, no data rows. */

/* Category palette — driven by PaymentMethodType, maps each method
   to Partners' colour ladder (Bank/Card/Traditional/Digital/Other). */
const PAYMENT_METHOD_CAT: Record<PaymentMethodType, {
  category: string;
  color: string;
  bg: string;
  Icon: React.ElementType;
}> = {
  "Wire Transfer": {
    category: "Bank",
    color: "hsl(var(--primary))",
    bg: "#EFF6FF" /* primary-50 */,
    Icon: Building2,
  },
  ACH: {
    category: "Bank",
    color: "hsl(var(--primary))",
    bg: "#EFF6FF",
    Icon: Building2,
  },
  Check: {
    category: "Traditional",
    color: "#6D28D9" /* violet-700 */,
    bg: "#F0EBFF",
    Icon: FileText,
  },
  "Credit Card": {
    category: "Card",
    color: "#B45309" /* amber-700 */,
    bg: "#FEF3C7",
    Icon: CreditCard,
  },
};

function PaymentMethodCard({
  method,
  fallbackName,
  onClick,
  showEditPencil = false,
}: {
  method: PaymentMethod | null;
  /** Used when `method` is null — the raw string we have on file. */
  fallbackName?: string;
  onClick?: () => void;
  showEditPencil?: boolean;
}) {
  // Sensitive-data toggle — masks the IBAN by default (••••last4) and
  // reveals the full number when the buyer clicks the Eye icon next to
  // the row. Mirrors Partners' DataRow sensitive-reveal pattern verbatim
  // (`PaymentMethodsSection.tsx` DataRow uses an Eye/EyeOff toggle per
  // sensitive field).
  const [revealIban, setRevealIban] = useState(false);

  // Resolve palette. If we don't know the type (legacy data), fall back
  // to a neutral slate palette + generic wallet glyph so the card still
  // reads as a real surface, not a placeholder.
  const type: PaymentMethodType | null = method?.type ?? null;
  const palette = type
    ? PAYMENT_METHOD_CAT[type]
    : { category: "Other", color: "#64748B" /* slate-500 */, bg: "#F1F5F9" /* slate-100 */, Icon: WalletMinimal };

  const isDefault = !!method?.isDefault;
  const displayName = method?.bankName ?? fallbackName ?? "—";
  const typeLabel = method?.type ?? "Payment Method";

  // IBAN masking: render `••••last4` when hidden, full IBAN when revealed.
  // Spaces stripped for last-4 derivation so "DE89 3704 0044 0532 0130 00"
  // still yields "0 00" → "0000" → last 4 = "3000" cleanly.
  const ibanRaw = method?.iban ?? "";
  const ibanCompact = ibanRaw.replace(/\s+/g, "");
  const last4 = ibanCompact ? ibanCompact.slice(-4) : "";
  const ibanDisplay = revealIban ? ibanRaw : (last4 ? `••••${last4}` : "");

  // Has any "details" content beyond the header? Used to gate the
  // rounded slate-50 data panel so it only renders when there's
  // something to put inside.
  const hasDetails = method && (ibanDisplay || method.contactName || method.contactPhone);
  const hasFinance = method && (method.discountPct > 0 || method.additionalChargesPct > 0);

  return (
    <div
      onClick={onClick}
      className={`group bg-white rounded-xl transition-all duration-200 flex flex-col relative ${
        onClick ? "cursor-pointer" : ""
      } ${
        isDefault
          ? "border-[1.5px] hover:shadow-[0_4px_20px_-4px_rgba(10,119,255,0.18)]"
          : "border hover:border-slate-300 hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06)]"
      }`}
      style={{
        borderColor: isDefault
          ? "color-mix(in srgb, hsl(var(--primary)) 40%, transparent)"
          : "#E8ECF1",
        boxShadow: isDefault
          ? "0 2px 12px -4px rgba(10,119,255,0.12)"
          : "0 1px 3px rgba(0,0,0,0.03)",
        padding: 12,
      }}
    >
      <div className="flex flex-col gap-2">
        {/* Header — icon chip + name (+ order chip) + category pill +
            (Primary pill / edit pencil) */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div
              className="rounded-lg flex items-center justify-center shrink-0"
              style={{ width: 28, height: 28, backgroundColor: palette.bg }}
            >
              <palette.Icon className="w-3.5 h-3.5" style={{ color: palette.color }} strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <p
                  className="text-foreground truncate"
                  style={{ fontSize: 12, fontWeight: 600, fontFamily: FONT, lineHeight: 1.35 }}
                  title={displayName}
                >
                  {displayName}
                </p>
                {method?.order && method.order > 0 && (
                  <span
                    className="inline-flex items-center rounded shrink-0 tabular-nums"
                    style={{
                      padding: "0 4px",
                      fontSize: 9,
                      fontWeight: 600,
                      color: "#64748B" /* slate-500 */,
                      backgroundColor: "#F1F5F9" /* slate-100 */,
                      fontFamily: FONT,
                      lineHeight: 1.5,
                    }}
                    title={`Order #${method.order}`}
                  >
                    #{method.order}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className="inline-flex items-center rounded-full"
                  style={{
                    padding: "1px 6px",
                    fontSize: 9,
                    fontWeight: 600,
                    color: palette.color,
                    backgroundColor: palette.bg,
                    fontFamily: FONT,
                    lineHeight: 1.5,
                  }}
                >
                  {typeLabel}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            {isDefault && (
              <span
                className="inline-flex items-center gap-1 rounded-md border"
                style={{
                  padding: "1px 6px",
                  fontSize: 9.5,
                  fontWeight: 600,
                  backgroundColor: "#EFF6FF",
                  color: "#1E40AF",
                  borderColor: "#BFDBFE",
                  fontFamily: FONT,
                  lineHeight: 1.5,
                }}
                title="Default payment method"
              >
                <Star className="w-2.5 h-2.5 fill-current" />
                Primary
              </span>
            )}
            {showEditPencil && (
              <Pencil
                className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                style={{ color: "#CBD5E1" /* slate-300 */ }}
                strokeWidth={2}
                aria-label="Edit payment method"
              />
            )}
          </div>
        </div>

        {/* Data rows panel — IBAN (with reveal toggle) + contact name +
            phone. Only renders when we have at least one row of content,
            so the card body never shows an empty slate-50 box. */}
        {hasDetails && (
          <div
            className="flex flex-col gap-[5px]"
            style={{
              padding: "6px 8px",
              borderRadius: 8,
              backgroundColor: "#FAFBFC",
              border: "1px solid hsl(var(--muted))",
            }}
          >
            {ibanDisplay && (
              <PaymentDataRow
                icon={Hash}
                label="IBAN"
                value={ibanDisplay}
                tabularNums
                /* Eye/EyeOff toggle — only shown when there's something
                   to mask. Click swallows propagation so it doesn't fire
                   the parent onClick (edit dialog). */
                trailing={
                  ibanCompact ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRevealIban((v) => !v);
                      }}
                      className="flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                      style={{
                        width: 16,
                        height: 16,
                        color: revealIban ? "hsl(var(--primary))" : "#94A3B8",
                      }}
                      aria-label={revealIban ? "Hide IBAN" : "Reveal IBAN"}
                      title={revealIban ? "Hide IBAN" : "Reveal IBAN"}
                    >
                      {revealIban ? (
                        <EyeOff className="w-2.5 h-2.5" strokeWidth={2} />
                      ) : (
                        <Eye className="w-2.5 h-2.5" strokeWidth={2} />
                      )}
                    </button>
                  ) : null
                }
              />
            )}
            {method?.contactName && (
              <PaymentDataRow icon={User} label="Contact" value={method.contactName} />
            )}
            {method?.contactPhone && (
              <PaymentDataRow icon={Phone} label="Phone" value={method.contactPhone} />
            )}
          </div>
        )}

        {/* Reference / payment-instructions note — Partners surfaces this
            as `specialInstructions` with an AlertCircle icon. We render
            it as a slate-50 / amber-tinted note panel below the data
            rows so the buyer notices the transfer instructions when
            initiating payment. */}
        {method?.referenceNote && (
          <div
            className="flex items-start gap-1.5"
            style={{
              padding: "6px 8px",
              borderRadius: 8,
              backgroundColor: "#FFFBEB" /* amber-50 — Partners' notes tint */,
              border: "1px solid #FDE68A" /* amber-200 */,
            }}
          >
            <AlertCircle
              className="shrink-0"
              style={{ width: 11, height: 11, color: "#B45309" /* amber-700 */, marginTop: 1 }}
              strokeWidth={2}
            />
            <div className="min-w-0 flex-1">
              <p
                className="text-amber-900"
                style={{ fontSize: 9.5, fontWeight: 600, fontFamily: FONT, lineHeight: 1.4, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 1 }}
              >
                Reference Note
              </p>
              <p
                className="text-slate-700"
                style={{ fontSize: 11, fontWeight: 400, fontFamily: FONT, lineHeight: 1.45 }}
              >
                {method.referenceNote}
              </p>
            </div>
          </div>
        )}

        {/* Discount / charges strip — Partners' compact inline recipe.
            Only renders when at least one of the rates is > 0. */}
        {hasFinance && (
          <div
            className="flex items-center gap-2 flex-wrap"
            style={{
              padding: "4px 8px",
              borderRadius: 6,
              backgroundColor: "#FAFBFC",
              border: "1px solid hsl(var(--muted))",
            }}
          >
            {method!.discountPct > 0 && (
              <div className="flex items-center gap-1 min-w-0">
                <Percent
                  className="w-2.5 h-2.5 shrink-0"
                  style={{ color: "hsl(var(--success))" /* discount = good */ }}
                  strokeWidth={2}
                />
                <span
                  className="text-slate-500"
                  style={{ fontSize: 10, fontWeight: 500, fontFamily: FONT, lineHeight: 1.4 }}
                >
                  Early-pay discount
                </span>
                <span
                  className="tabular-nums"
                  style={{ fontSize: 10, fontWeight: 600, fontFamily: FONT, lineHeight: 1.4, color: "hsl(var(--success))" }}
                >
                  {method!.discountPct}%
                </span>
              </div>
            )}
            {method!.discountPct > 0 && method!.additionalChargesPct > 0 && (
              <span className="text-slate-300" style={{ fontSize: 10 }}>|</span>
            )}
            {method!.additionalChargesPct > 0 && (
              <div className="flex items-center gap-1 min-w-0">
                <Percent
                  className="w-2.5 h-2.5 shrink-0"
                  style={{ color: "hsl(var(--warning))" /* surcharge = caution */ }}
                  strokeWidth={2}
                />
                <span
                  className="text-slate-500"
                  style={{ fontSize: 10, fontWeight: 500, fontFamily: FONT, lineHeight: 1.4 }}
                >
                  Surcharge
                </span>
                <span
                  className="tabular-nums"
                  style={{ fontSize: 10, fontWeight: 600, fontFamily: FONT, lineHeight: 1.4, color: "hsl(var(--warning))" }}
                >
                  {method!.additionalChargesPct}%
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── PaymentDataRow — icon + label + value strip used inside the
   payment method card data panel. Mirrors Partners' `DataRow`
   (`PaymentMethodsSection.tsx`).
   `trailing` slot lets a caller append an action (e.g. Eye/EyeOff
   reveal toggle) on the right edge without breaking the layout. */
function PaymentDataRow({
  icon: Icon,
  label,
  value,
  tabularNums = false,
  trailing,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  tabularNums?: boolean;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <Icon className="w-2.5 h-2.5 shrink-0" style={{ color: "#94A3B8" /* slate-400 */ }} strokeWidth={2} />
      <span
        className="text-slate-500 shrink-0"
        style={{ fontSize: 10, fontWeight: 500, fontFamily: FONT, lineHeight: 1.4 }}
      >
        {label}
      </span>
      <span
        className={`text-foreground truncate ml-auto ${tabularNums ? "tabular-nums" : ""}`}
        style={{ fontSize: 10, fontWeight: 600, fontFamily: FONT, lineHeight: 1.4 }}
        title={value}
      >
        {value}
      </span>
      {trailing}
    </div>
  );
}

/* ── ContactInfoRow — Phone / Mail row used inside the Primary Contact
   card. Verbatim port of Partners' contact-info row
   (`Partners/.../VendorDetailsPage.tsx:5999-6003`):
     - `rounded-lg bg-slate-50 border border-muted` shell.
     - `text-[10px] text-muted-foreground` value at fontWeight 500.
     - `Phone` / `Mail` icon at `#B0BEC5` (Partners slate hint colour);
       on hover the whole row swaps to `bg-accent border-blue-100` and
       the icon flips to `hsl(var(--primary))`.
   Kept as a standalone component so the recipe stays DRY across the
   primary + (future) secondary contact surfaces. */
function ContactInfoRow({
  icon: Icon,
  value,
}: {
  icon: React.ElementType;
  value: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="flex items-center gap-2.5 rounded-lg cursor-pointer transition-all"
      style={{
        padding: "6px 10px",
        backgroundColor: hovered ? "hsl(var(--accent))" : "#F8FAFC" /* slate-50 */,
        border: `1px solid ${hovered ? "#DBEAFE" /* blue-100 */ : "hsl(var(--muted))"}`,
        transitionDuration: "150ms",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Icon
        className="shrink-0 transition-colors"
        style={{
          width: 12,
          height: 12,
          color: hovered ? "hsl(var(--primary))" : "#B0BEC5" /* slate hint */,
        }}
        strokeWidth={2}
      />
      <span
        className="text-muted-foreground truncate"
        style={{
          fontSize: 10,
          fontWeight: 500,
          fontFamily: FONT,
          lineHeight: 1.4,
        }}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}

/* ── SecondaryContactsToggle — "+N more" expandable list. Hidden by
   default so the POC section reads as a one-row primary; click to
   expand inline (no popover / modal). Matches Partners' progressive-
   disclosure pattern in the Contacts tab. ── */
function SecondaryContactsToggle({
  contacts,
}: {
  contacts: { name: string; role?: string }[];
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
        style={{ fontSize: 11, fontWeight: 500, fontFamily: FONT }}
      >
        <ChevronDown
          className="size-3 transition-transform"
          style={{ transform: expanded ? "rotate(0deg)" : "rotate(-90deg)" }}
        />
        {expanded ? "Hide" : "Show"} {contacts.length} secondary contact{contacts.length !== 1 ? "s" : ""}
      </button>
      {expanded && (
        <div className="mt-1.5 flex flex-col gap-1 pl-4">
          {contacts.map((contact, idx) => (
            <div key={contact.name} className="flex items-center gap-1.5 min-w-0">
              <div
                className="flex items-center justify-center size-4 rounded-full shrink-0"
                style={{
                  backgroundColor: AVATAR_BG_COLORS[(idx + 1) % AVATAR_BG_COLORS.length],
                }}
              >
                <span
                  style={{
                    fontSize: 7,
                    fontWeight: 700,
                    color: AVATAR_TEXT_COLORS[(idx + 1) % AVATAR_TEXT_COLORS.length],
                    fontFamily: FONT,
                  }}
                >
                  {getInitials(contact.name)}
                </span>
              </div>
              <div className="min-w-0 flex-1 flex items-baseline gap-1.5">
                <span
                  className="text-foreground truncate"
                  style={{ fontSize: 11.5, fontWeight: 500, fontFamily: FONT }}
                >
                  {contact.name}
                </span>
                {contact.role && (
                  <span
                    className="text-muted-foreground/70 truncate"
                    style={{ fontSize: 10, fontWeight: 500, fontFamily: FONT }}
                  >
                    {contact.role}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* Removed dead helpers in the Partner-Information compression pass:
   - PaymentTermsCard / LocationRow / SectionLabel / POCCard.
   The new flat layout in VendorInfoCard renders POC, Shipping & Billing
   and Payment as 2-col key/value rows via FieldRow + LocationField, so
   none of these helpers are reachable any more. */

/* ══════════════════════════════════════════════════════════════
   EXPORTS
   ═══════════════════════════════════════════════════════════════ */

export { CollapsibleSection };