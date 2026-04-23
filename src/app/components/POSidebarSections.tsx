import React, { useState } from "react";
import {
  ChevronDown,
  Pencil,
  MapPin,
  CreditCard,
  Users,
  WalletMinimal,
  Phone,
  Mail,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "./ui/collapsible";
import { FONT } from "./designTokens";
import type { POVendor, PORecipient, POPaymentDelivery } from "./poStore";
import { getVendorContacts } from "./catalogData";
import type { VendorEntity } from "./catalogData";
import { resolvePaymentTermByName } from "./PaymentTermsDialog";
import type { PaymentTermType } from "./PaymentTermsDialog";

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
   Clean, consistent header with chevron toggle.
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
    <div className="rounded-[var(--radius-lg)] border border-border bg-card overflow-hidden">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-secondary/30 transition-colors">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center size-6 rounded-[var(--radius-sm)] bg-primary/8 shrink-0">
                <Icon className="size-3 text-primary" />
              </div>
              <span className="text-foreground" style={s.sectionTitle}>{title}</span>
              {badgeContent}
            </div>
            <ChevronDown
              className={`size-3.5 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-border">{children}</div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

/* ── Inline edit pencil button ── */
function EditButton({ onClick, className = "" }: { onClick: () => void; className?: string }) {
  return (
    <button
      className={`flex items-center justify-center size-6 rounded-[var(--radius-sm)] text-foreground/20 hover:text-primary hover:bg-primary/8 transition-all cursor-pointer shrink-0 ${className}`}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      <Pencil className="size-3" />
    </button>
  );
}

/* ── Inner accordion for sub-sections ── */
function InnerAccordion({
  icon: Icon,
  title,
  children,
  defaultOpen = false,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-secondary/20 transition-colors">
          <div className="flex items-center gap-2">
            <Icon className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
            <span className="text-foreground/70" style={s.accordionTitle}>{title}</span>
          </div>
          <ChevronDown
            className={`size-3 text-muted-foreground/60 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {children}
      </CollapsibleContent>
    </Collapsible>
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

/* ── Location accent border colors ── */
const LOCATION_ACCENTS: Record<string, string> = {
  "Pay To": "var(--primary)",
  "Ship To": "var(--chart-3)",
  "Funded By": "var(--accent)",
};

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
}) {
  const contacts = getVendorContacts(vendor.name);
  const vendorInitials = getInitials(vendor.name);

  /* Resolve secondary contacts from names */
  const secondaryContacts = contacts.filter((c) =>
    secondaryContactNames.includes(c.name) && c.name !== recipient.name
  );

  /* Resolve location display info */
  const payToInfo = resolveVendorDisplay(payment.payTo, payToVendors, "Not Set");
  const shipToInfo = resolveVendorDisplay(payment.shippedTo, shippedToVendors, "Not Set");
  const fundedByInfo = resolveVendorDisplay(payment.fundedBy, fundedByVendors, "Not Set");

  /* Resolve payment terms info */
  const termInfo = resolvePaymentTermByName(payment.paymentTerms);
  const TYPE_COLORS: Record<PaymentTermType, { bg: string; text: string }> = {
    NET: { bg: "var(--avatar-1-bg)", text: "var(--primary)" },
    Pre: { bg: "var(--avatar-4-bg)", text: "var(--chart-4)" },
    Split: { bg: "var(--avatar-3-bg)", text: "var(--chart-3)" },
  };
  const termBadge = termInfo ? TYPE_COLORS[termInfo.type] : null;

  return (
    <CollapsibleSection icon={Users} title="Vendor Information" defaultOpen={defaultOpen}>
      {/* ═══ ALWAYS VISIBLE: Vendor + POC ═══ */}

      {/* ─── Vendor identity ─── */}
      <div className="px-4 pt-3 pb-2.5">
        <div className="flex items-center gap-3">
          {/* Vendor avatar */}
          <div
            className="flex items-center justify-center size-9 rounded-full shrink-0"
            style={{ backgroundColor: "var(--avatar-3-bg)" }}
          >
            <span style={{ ...s.initials, fontSize: "11px", color: "var(--avatar-3-text)" }}>
              {vendorInitials}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-foreground block truncate" style={s.vendorNameLarge}>
              {vendor.name}
            </span>
            <span className="text-muted-foreground block mt-px" style={s.vendorLabel}>
              Vendor
            </span>
          </div>
          {/* Vendor is immutable — no edit button here */}
        </div>
      </div>

      {/* ─── Point of Contacts ─── */}
      <div className="px-4 pb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-muted-foreground/60 uppercase" style={s.groupLabel}>
            Point of Contacts
          </span>
          {canEdit && onEditContact && <EditButton onClick={onEditContact} />}
        </div>

        {/* Primary contact card */}
        <POCCard
          contact={recipient}
          label="PRIMARY"
          colorIndex={0}
          isPrimary
        />

        {/* Secondary contacts — compact inline rows */}
        {secondaryContacts.length > 0 && (
          <div className="mt-2.5">
            <span className="text-muted-foreground/50 uppercase block mb-1.5" style={s.groupLabel}>
              Secondary ({secondaryContacts.length})
            </span>
            <div className="flex flex-col gap-0">
              {secondaryContacts.map((contact, idx) => (
                <div
                  key={contact.name}
                  className="flex items-center gap-2.5 py-1.5 group"
                >
                  {/* Small avatar */}
                  <div
                    className="flex items-center justify-center size-6 rounded-full shrink-0"
                    style={{
                      backgroundColor: AVATAR_BG_COLORS[(idx + 1) % AVATAR_BG_COLORS.length],
                    }}
                  >
                    <span
                      style={{
                        ...s.initials,
                        fontSize: "8px",
                        color: AVATAR_TEXT_COLORS[(idx + 1) % AVATAR_TEXT_COLORS.length],
                      }}
                    >
                      {getInitials(contact.name)}
                    </span>
                  </div>
                  {/* Name + role inline */}
                  <div className="min-w-0 flex-1 flex items-center gap-1.5">
                    <span className="text-foreground truncate" style={s.contactName}>
                      {contact.name}
                    </span>
                    <span className="text-muted-foreground/50 hidden group-hover:inline truncate" style={s.vendorLabel}>
                      {contact.role}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state when no secondary contacts */}
        {secondaryContacts.length === 0 && canEdit && (
          <button
            className="mt-2 w-full py-2.5 rounded-[var(--radius-md)] border border-dashed border-border/60 text-muted-foreground/50 hover:text-primary hover:border-primary/30 hover:bg-primary/[0.03] transition-all cursor-pointer"
            style={s.showMore}
            onClick={onEditContact}
          >
            + Add secondary contacts
          </button>
        )}
      </div>

      {/* ═══ ACCORDION 1: Locations ═══ */}
      <div className="border-t border-border/40">
        <InnerAccordion icon={MapPin} title="Shipping / Billing Locations">
          <div className="px-4 pb-3 flex flex-col gap-2">
            {/* Pay To location card */}
            <LocationCard
              label="Pay To"
              displayName={payToInfo.displayName}
              address={payToInfo.address}
              accentColor={LOCATION_ACCENTS["Pay To"]}
              canEdit={canEdit}
              onEdit={onEditPayTo}
            />
            {/* Ship To location card */}
            <LocationCard
              label="Ship To"
              displayName={shipToInfo.displayName}
              address={shipToInfo.address}
              accentColor={LOCATION_ACCENTS["Ship To"]}
              canEdit={canEdit}
              onEdit={onEditShipTo}
            />
            {/* Funded By location card */}
            <LocationCard
              label="Funded By"
              displayName={fundedByInfo.displayName}
              address={fundedByInfo.address}
              accentColor={LOCATION_ACCENTS["Funded By"]}
              canEdit={canEdit}
              onEdit={onEditFundedBy}
            />
          </div>
        </InnerAccordion>
      </div>

      {/* ═══ ACCORDION 2: Payment & Shipping ═══ */}
      <div className="border-t border-border/40">
        <InnerAccordion icon={CreditCard} title="Payment & Shipping">
          <div className="px-4 pb-4 flex flex-col gap-0">
            {/* Payment Terms */}
            <div className="py-2.5 border-b border-border/30">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground" style={s.payFieldLabel}>Payment Terms</span>
                {canEdit && onEditPaymentTerms && <EditButton onClick={onEditPaymentTerms} />}
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                {termBadge && termInfo && (
                  <span
                    className="inline-flex items-center px-1.5 py-0.5 rounded-[var(--radius-sm)] shrink-0"
                    style={{ backgroundColor: termBadge.bg, color: termBadge.text, ...s.badge }}
                  >
                    {termInfo.type}
                  </span>
                )}
                <span className="text-foreground truncate" style={s.payFieldValue}>
                  {payment.paymentTerms}
                </span>
              </div>
            </div>

            {/* Payment Method */}
            <div className="py-2.5">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground" style={s.payFieldLabel}>Payment Method</span>
                {canEdit && onEditPaymentMethod && <EditButton onClick={onEditPaymentMethod} />}
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <div
                  className="flex items-center justify-center size-5 rounded-[var(--radius-sm)] shrink-0"
                  style={{ backgroundColor: "var(--avatar-4-bg)" }}
                >
                  <WalletMinimal className="size-2.5" style={{ color: "var(--chart-4)" }} />
                </div>
                <span className="text-foreground truncate" style={s.payFieldValue}>
                  {payment.paymentMethod}
                </span>
              </div>
            </div>
          </div>
        </InnerAccordion>
      </div>
    </CollapsibleSection>
  );
}

/* ── Location card with colored left accent border ── */
function LocationCard({
  label,
  displayName,
  address,
  accentColor,
  canEdit,
  onEdit,
}: {
  label: string;
  displayName: string;
  address: string;
  accentColor: string;
  canEdit: boolean;
  onEdit?: () => void;
}) {
  const addressLines = address.split("\n").filter(Boolean);

  return (
    <div
      className="rounded-[var(--radius-md)] border border-border/50 bg-card overflow-hidden"
    >
      <div className="flex">
        {/* Colored left accent bar */}
        <div
          className="w-[3px] shrink-0 rounded-l-[var(--radius-md)]"
          style={{ backgroundColor: accentColor }}
        />
        <div className="flex-1 px-3 py-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              {/* Label with icon */}
              <div className="flex items-center gap-1.5 mb-1">
                <Users className="size-3 text-muted-foreground/50" strokeWidth={1.5} />
                <span className="text-muted-foreground/70 uppercase" style={s.groupLabel}>
                  {label}
                </span>
              </div>
              {/* Location name */}
              <span className="text-foreground block" style={s.locationName}>
                {displayName}
              </span>
              {/* Address lines */}
              {addressLines.length > 0 && (
                <div className="mt-1">
                  {addressLines.map((line, i) => (
                    <span key={i} className="text-muted-foreground block" style={s.locationAddress}>
                      {line}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {canEdit && onEdit && <EditButton onClick={onEdit} />}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Point of Contact card ── */
function POCCard({
  contact,
  label,
  colorIndex,
  isPrimary,
}: {
  contact: { name: string; role?: string; phone?: string; email?: string };
  label: "PRIMARY" | "SECONDARY";
  colorIndex: number;
  isPrimary: boolean;
}) {
  const avatarBg = AVATAR_BG_COLORS[colorIndex % AVATAR_BG_COLORS.length];
  const avatarText = AVATAR_TEXT_COLORS[colorIndex % AVATAR_TEXT_COLORS.length];
  const badgeStyle = isPrimary
    ? { backgroundColor: "var(--avatar-1-bg)", color: "var(--primary)" }
    : { backgroundColor: "var(--secondary)", color: "var(--muted-foreground)" };

  return (
    <div className="rounded-[var(--radius-md)] border border-border/60 bg-card px-3 py-2.5">
      <div className="flex items-start gap-2.5">
        {/* Avatar */}
        <div
          className="flex items-center justify-center size-9 rounded-full shrink-0 mt-0.5"
          style={{ backgroundColor: avatarBg }}
        >
          <span style={{ ...s.initials, fontSize: "11px", color: avatarText }}>
            {getInitials(contact.name)}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          {/* Name + badge */}
          <div className="flex items-center gap-1.5">
            <span className="text-foreground truncate" style={s.contactName}>
              {contact.name}
            </span>
            <span
              className="inline-flex items-center px-1.5 py-px rounded-[var(--radius-sm)] shrink-0"
              style={{ ...s.badge, ...badgeStyle }}
            >
              {label}
            </span>
          </div>
          {/* Role */}
          {contact.role && (
            <span className="text-muted-foreground block mt-0.5" style={s.vendorLabel}>
              {contact.role}
            </span>
          )}
          {/* Phone */}
          {contact.phone && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <Phone className="size-3 text-muted-foreground/40" strokeWidth={1.5} />
              <span className="text-muted-foreground" style={s.locationAddress}>
                {contact.phone}
              </span>
            </div>
          )}
          {/* Email */}
          {contact.email && (
            <div className="flex items-center gap-1.5 mt-1">
              <Mail className="size-3 text-muted-foreground/40" strokeWidth={1.5} />
              <span className="text-muted-foreground" style={s.locationAddress}>
                {contact.email}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}



/* ══════════════════════════════════════════════════════════════
   EXPORTS
   ═══════════════════════════════════════════════════════════════ */

export { CollapsibleSection };