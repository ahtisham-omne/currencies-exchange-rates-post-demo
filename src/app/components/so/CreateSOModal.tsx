import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Search, X, Package, ArrowLeftRight, Phone, Mail, Pencil,
  Calendar, Clock, Users, Plus, Check, ArrowLeft, ArrowRight,
  Building2, MapPin, Copy, CreditCard, ChevronDown, Flag, Tag,
} from "lucide-react";
import { LocationSelectionModal, type Location as CustomerLocation } from "./LocationSelectionModal";
import { CreateSOStep2, EXTENDED_CATALOG, type SOLineItem } from "./CreateSOStep2";
import { useModalShortcuts, KbdHint } from "./ModalKeyboard";
import { Button } from "./ui/Button";
import { useDiscardGuard } from "./ui/DiscardChangesDialog";
import { DateEditModal, type SODateType, type DateConfig } from "./ui/DateEditModal";
import { DateConfigCards } from "./DateConfigCards";
import { AddressSelectionModal, type Address, type Partner } from "./AddressSelectionModal";
import { PaymentTermsLibrary, type PaymentTerm } from "./PaymentTermsLibrary";
import { PaymentMethodSelectionModal, type PaymentMethod } from "./PaymentMethodSelectionModal";

import { RecipientsSelectionModal, type PoC as RecipientPoC } from "./RecipientsSelectionModal";
import { SalesRepSelector, type SalesRepOption, type SelectedSalesRep } from "./SalesRepSelector";
import { OrderCurrencyPicker } from "../currency/OrderCurrencyPicker";

/* ═══ Typography — CSS variable tokens only ═══ */
const font: React.CSSProperties = {};
const labelStyle: React.CSSProperties = { fontSize: "var(--text-label)", fontWeight: "var(--font-weight-medium)" };
const labelNormal: React.CSSProperties = { fontSize: "var(--text-label)", fontWeight: "var(--font-weight-normal)" };
const labelSemi: React.CSSProperties = { fontSize: "var(--text-label)", fontWeight: "var(--font-weight-semibold)" };
const captionStyle: React.CSSProperties = { fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" };
const captionNormal: React.CSSProperties = { fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-normal)" };
const captionSemi: React.CSSProperties = { fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-semibold)" };
const microStyle: React.CSSProperties = { fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-semibold)", letterSpacing: "0.05em", textTransform: "uppercase" as const };

/* ═══ Constants ═══ */
const MODAL_WIDTH = '72vw';
const MODAL_MAX_WIDTH = 960;
const MODAL_HEIGHT = '80vh';
const MODAL_MAX_HEIGHT = '85vh';

/* ═══ Mock Data ═══ */
interface Customer {
  id: string;
  name: string;
  initials: string;
  contactCount: number;
  address: string;
  phone: string;
  fax: string;
  email: string;
  status: string[];
  pocs: POC[];
}

interface POC {
  id: string;
  name: string;
  initials: string;
  isPrimary: boolean;
  role: string;
  phone: string;
  extension: string;
  email: string;
}

const MOCK_CUSTOMERS: Customer[] = [
  {
    id: "C-001", name: "Metro City Fire & Rescue", initials: "MC", contactCount: 131,
    address: "1000 Business Park Dr, Huntsville, Alabama 35806",
    phone: "(302) 611-6611", fax: "(618) 830-8073 Ext. 718", email: "business@dcptechnical.com",
    status: ["Customer", "Temecula, CA", "Active"],
    pocs: [
      { id: "P-001", name: "Jane Ellison", initials: "JE", isPrimary: true, role: "Finance Director | Fire Chief", phone: "(718) 264-8918", extension: "Ext. 8391", email: "jane.ellison@metrocityfire.gov" },
      { id: "P-002", name: "Patricia Williams", initials: "PW", isPrimary: false, role: "Operations Chief | Maintenance Supe...", phone: "(590) 243-5486", extension: "Ext. 3004", email: "patricia.williams@metrocityfire.gov" },
      { id: "P-003", name: "Jennifer Hooper", initials: "JH", isPrimary: false, role: "Captain | Procurement Officer", phone: "(093) 136-8536", extension: "Ext. 7004", email: "jennifer.hooper@metrocityfire.gov" },
      { id: "P-004", name: "Leila Wilkins", initials: "LW", isPrimary: false, role: "Fleet Manager | Shift Director", phone: "(192) 601-4188", extension: "Ext. 1347", email: "leila.wilkins@metrocityfire.gov" },
      { id: "P-M01", name: "Sherry Miller", initials: "SM", isPrimary: false, role: "Logistics Coordinator", phone: "(941) 988-5035", extension: "Ext. 146", email: "sherry.miller@metrocityfire.gov" },
      { id: "P-M02", name: "Peyton Miller", initials: "PM", isPrimary: false, role: "Administrative Assistant | Captain", phone: "(765) 672-9597", extension: "Ext. 8147", email: "peyton.miller@metrocityfire.gov" },
      { id: "P-M03", name: "Michael Miller", initials: "MM", isPrimary: false, role: "Deputy Chief | Operations Chief", phone: "(830) 818-7655", extension: "Ext. 6388", email: "michael.miller@metrocityfire.gov" },
      { id: "P-M04", name: "Sherry Miller", initials: "SM", isPrimary: false, role: "Fire Chief | Operations Chief", phone: "(746) 598-9521", extension: "Ext. 1805", email: "sherry.miller2@metrocityfire.gov" },
      { id: "P-M05", name: "Michael Miller", initials: "MM", isPrimary: false, role: "Admin | Finance Director", phone: "(544) 797-1529", extension: "Ext. 9632", email: "michael.miller2@metrocityfire.gov" },
      { id: "P-M06", name: "Jennifer Miller", initials: "JM", isPrimary: false, role: "Deputy Chief | Captain", phone: "(659) 460-8910", extension: "Ext. 3318", email: "jennifer.miller@metrocityfire.gov" },
      { id: "P-M07", name: "John Miller", initials: "JM", isPrimary: true, role: "Fire Chief | Maintenance Supervisor", phone: "(519) 975-2730", extension: "Ext. 161", email: "john.miller@metrocityfire.gov" },
      { id: "P-M08", name: "Robert Miller", initials: "RM", isPrimary: false, role: "Admin | Fleet Manager", phone: "(411) 228-1814", extension: "Ext. 9596", email: "robert.miller@metrocityfire.gov" },
    ],
  },
  {
    id: "C-002", name: "Tri-County EMS Authority", initials: "TE", contactCount: 77,
    address: "1000 Business Park Dr, Daxton, Georgia 30319",
    phone: "(404) 555-0200", fax: "(404) 555-0201", email: "orders@tricountyems.org",
    status: ["Active"],
    pocs: [
      { id: "P-005", name: "Braelyn Miller", initials: "BM", isPrimary: true, role: "EMS Director | Captain", phone: "(568) 530-1789", extension: "Ext. 1368", email: "braelyn.miller@tricountyems.org" },
      { id: "P-006", name: "Janna Rodriguez", initials: "JR", isPrimary: false, role: "Captain | Engineer", phone: "(270) 393-8736", extension: "Ext. 1362", email: "janna.rodriguez@tricountyems.org" },
      { id: "P-007", name: "Sherry Garcia", initials: "SG", isPrimary: false, role: "Deputy Officer | Procurement Officer", phone: "(288) 781-4952", extension: "Ext. 564", email: "sherry.garcia@tricountyems.org" },
      { id: "P-008", name: "Janna Davis", initials: "JD", isPrimary: false, role: "Fire Chief | Administrative Assistant", phone: "(559) 537-4426", extension: "Ext. 2307", email: "janna.davis@tricountyems.org" },
    ],
  },
  {
    id: "C-003", name: "Lakewood Community Hospital", initials: "LC", contactCount: 63,
    address: "1000 Business Park Dr, Georgetown, Kentucky 40324",
    phone: "(207) 555-0300", fax: "(207) 555-0301", email: "supply@lakewoodhosp.org",
    status: ["Active", "Net 45"],
    pocs: [
      { id: "P-009", name: "Mary Miller", initials: "MM", isPrimary: false, role: "Procurement Officer | Medical Director", phone: "(485) 489-1887", extension: "Ext. 3343", email: "mary.miller@lakewoodcommunity.org" },
      { id: "P-010", name: "Elizabeth Miller", initials: "EM", isPrimary: false, role: "EMS Director | Deputy Chief", phone: "(577) 391-4153", extension: "Ext. 4180", email: "elizabeth.miller@lakewoodcommunity.org" },
      { id: "P-011", name: "Patricia Miller", initials: "PM", isPrimary: true, role: "Finance Director | Procurement", phone: "(351) 490-6003", extension: "Ext. 1894", email: "patricia.miller@lakewoodcommunity.org" },
    ],
  },
  {
    id: "C-004", name: "Pinecrest Volunteer Fire Dept", initials: "PV", contactCount: 49,
    address: "1000 Business Park Dr, Charlotte, North Carolina 28202",
    phone: "(704) 555-0400", fax: "(704) 555-0401", email: "chief@pinecrestvfd.org",
    status: ["Active"],
    pocs: [
      { id: "P-012", name: "Robert Johnson", initials: "RJ", isPrimary: true, role: "Fire Chief | Station Commander", phone: "(704) 555-0401", extension: "Ext. 100", email: "rjohnson@pinecrestvfd.org" },
    ],
  },
  {
    id: "C-005", name: "Summit Regional Medical Center", initials: "SR", contactCount: 85,
    address: "1000 Business Park Dr, Huntsville, Alabama 35806",
    phone: "(256) 555-0500", fax: "(256) 555-0501", email: "purchasing@summitmed.org",
    status: ["Active", "Priority"],
    pocs: [
      { id: "P-013", name: "Angela Torres", initials: "AT", isPrimary: true, role: "Director of Emergency Services", phone: "(256) 555-0501", extension: "Ext. 3200", email: "atorres@summitmed.org" },
      { id: "P-014", name: "Daniel Kim", initials: "DK", isPrimary: false, role: "Procurement Manager", phone: "(256) 555-0502", extension: "Ext. 3201", email: "dkim@summitmed.org" },
    ],
  },
  {
    id: "C-006", name: "Eagle County Sheriff's Office", initials: "EC", contactCount: 66,
    address: "1000 Business Park Dr, San Antonio, Texas 78045",
    phone: "(601) 555-0600", fax: "(601) 555-0601", email: "fleet@eaglecounty.gov",
    status: ["Active"],
    pocs: [
      { id: "P-015", name: "Marcus Webb", initials: "MW", isPrimary: true, role: "Fleet Manager | Undersheriff", phone: "(601) 555-0601", extension: "Ext. 400", email: "mwebb@eaglecounty.gov" },
    ],
  },
  {
    id: "C-007", name: "Pacific Northwest Ambulance Co.", initials: "PN", contactCount: 68,
    address: "1000 Business Park Dr, Corporación, Colorado 81722",
    phone: "(815) 555-0700", fax: "(815) 555-0701", email: "ops@pacnwamb.com",
    status: ["Active"],
    pocs: [
      { id: "P-016", name: "Lisa Chen", initials: "LC", isPrimary: true, role: "Operations Director", phone: "(815) 555-0701", extension: "Ext. 210", email: "lchen@pacnwamb.com" },
    ],
  },
  {
    id: "C-008", name: "Riverside Utility District", initials: "RU", contactCount: 102,
    address: "1000 Business Park Dr, Santa Ana, Indiana 46204",
    phone: "(317) 555-0800", fax: "(317) 555-0801", email: "admin@riversideud.gov",
    status: ["Active", "Government"],
    pocs: [
      { id: "P-017", name: "Sandra Lee", initials: "SL", isPrimary: true, role: "District Manager | Safety Officer", phone: "(317) 555-0801", extension: "Ext. 500", email: "slee@riversideud.gov" },
      { id: "P-018", name: "James Park", initials: "JP", isPrimary: false, role: "Purchasing Agent", phone: "(317) 555-0802", extension: "Ext. 501", email: "jpark@riversideud.gov" },
    ],
  },
];

/* ═══ Avatar — pastel squircle with CSS variable palette ═══ */
const PASTEL_PALETTE = [
  { bg: "#EDF4FF", color: "#0A77FF" },
  { bg: "#F0FDF4", color: "#16A34A" },
  { bg: "#F5F3FF", color: "#7C3AED" },
  { bg: "#FFF7ED", color: "#EA580C" },
  { bg: "#ECFEFF", color: "#0891B2" },
];

function getPastelIndex(initials: string): number {
  const hash = initials.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return hash % PASTEL_PALETTE.length;
}

function Avatar({ initials, size = 36 }: { initials: string; size?: number }) {
  const palette = PASTEL_PALETTE[getPastelIndex(initials)];
  return (
    <div
      style={{
        width: size, height: size, minWidth: size,
        borderRadius: "50%",
        backgroundColor: palette.bg,
        color: palette.color,
        display: "flex", alignItems: "center", justifyContent: "center",
        ...font,
        fontSize: size < 28 ? "var(--text-micro)" : "var(--text-caption)",
        fontWeight: "var(--font-weight-semibold)",
        letterSpacing: "0.02em",
      }}
    >
      {initials}
    </div>
  );
}

/* ── light-blue hover helper (consistent across entire modal) ── */
const hoverBlue = {
  onMouseEnter: (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.backgroundColor = "var(--primary-hover-bg)"; },
  onMouseLeave: (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.backgroundColor = ""; },
};

/* ═══ Props ═══ */
export interface SOCreationPayload {
  customer: string;
  customerInitials: string;
  customerAddress: string;
  pocName: string;
  pocEmail: string;
  priority: "Low" | "Standard" | "High";
  tags: string[];
  /** Customer-facing transaction currency for this order. Defaults to the customer's default. */
  currency: string;
  lineItems: { catalogCode: string; itemCode: string; itemName: string; itemType: "Serialized" | "Non-Serialized" | "Lot Controlled"; unitPrice: number; qty: number }[];
}

interface CreateSOModalProps {
  open: boolean;
  onClose: () => void;
  onContinue?: (payload: SOCreationPayload) => void;
}

export function CreateSOModal({ open, onClose, onContinue }: CreateSOModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedPOC, setSelectedPOC] = useState<POC | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [search, setSearch] = useState("");
  const [searchTab, setSearchTab] = useState<"All" | "Customers" | "Point of Contact">("All");
  const [showInactive, setShowInactive] = useState(false);
  const [priority, setPriority] = useState<"Low" | "Standard" | "High">("Standard");
  const [tags, setTags] = useState<string[]>(["Engine Companies", "Hydraulics"]);
  const [tagInput, setTagInput] = useState("");
  const [selectedItems, setSelectedItems] = useState<SOLineItem[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  /* ── Location selection state ── */
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{ id: string; name: string; address: string; isDefault: boolean } | null>(null);

  /* ── New modal states ── */
  const [showRecipientsModal, setShowRecipientsModal] = useState(false);
  const [selectedRecipients, setSelectedRecipients] = useState<RecipientPoC[]>([]);
  const [recipientPrimaryId, setRecipientPrimaryId] = useState<string>("");
  const [addressModalType, setAddressModalType] = useState<'billing' | 'shipping' | null>(null);
  const [selectedBillingAddress, setSelectedBillingAddress] = useState<string | null>(null);
  const [selectedShippingAddress, setSelectedShippingAddress] = useState<string | null>(null);
  const [showPaymentTerms, setShowPaymentTerms] = useState(false);
  const [selectedPaymentTerms, setSelectedPaymentTerms] = useState<string>("Net 30");
  const [selectedPaymentTermId, setSelectedPaymentTermId] = useState<string>("net30");
  const [showPaymentMethod, setShowPaymentMethod] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("ACH/Direct Deposit");
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string>("ach");
  /* Currency — defaults to the customer's default currency (mock: EUR). Used as the order's transaction currency. */
  const [selectedCurrency, setSelectedCurrency] = useState<string>("EUR");

  const AVAILABLE_REPS: SalesRepOption[] = [
    { id: 'rep1', name: 'Yahya Naveed', initials: 'YN', isCurrentUser: true, isCustomerDefault: true },
    { id: 'rep2', name: 'Sarah Chen', initials: 'SC' },
    { id: 'rep3', name: 'Michael Torres', initials: 'MT' },
    { id: 'rep4', name: 'Emily Park', initials: 'EP' },
  ];
  const [selectedReps, setSelectedReps] = useState<SelectedSalesRep[]>([
    { id: 'rep1', name: 'Yahya Naveed', initials: 'YN', isPrimary: true, isCurrentUser: true, isCustomerDefault: true },
  ]);
  const [customerVerificationVariant, setCustomerVerificationVariant] = useState<1 | 2 | 3>(3);

  /* Reset on open/close */
  useEffect(() => {
    if (!open) {
      setStep(1);
      setSelectedCustomer(null);
      setSelectedPOC(null);
      setShowSearch(false);
      setSearch("");
      setSearchTab("All");
      setShowInactive(false);
      setSelectedItems([]);
    }
  }, [open]);

  /* Focus search when overlay opens */
  useEffect(() => {
    if (showSearch) {
      requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  }, [showSearch]);

  /* Build the creation payload from modal state */
  const buildPayload = useCallback((): SOCreationPayload | null => {
    if (!selectedCustomer || !selectedPOC || selectedItems.length === 0) return null;
    return {
      customer: selectedCustomer.name,
      customerInitials: selectedCustomer.initials,
      customerAddress: selectedCustomer.address,
      pocName: selectedPOC.name,
      pocEmail: selectedPOC.email,
      priority,
      tags,
      currency: selectedCurrency,
      lineItems: selectedItems.map(si => {
        const cat = EXTENDED_CATALOG.find(c => c.code === si.productId);
        return {
          catalogCode: si.productId,
          itemCode: cat?.code || si.productId,
          itemName: cat?.name || si.name,
          itemType: (cat?.type || "Non-Serialized") as "Serialized" | "Non-Serialized" | "Lot Controlled",
          unitPrice: si.unitPrice,
          qty: si.quantity,
        };
      }),
    };
  }, [selectedCustomer, selectedPOC, selectedItems, priority, tags, selectedCurrency]);

  /* Dirty state — any user selections/entries means unsaved changes */
  const isDirty = !!selectedCustomer || !!selectedPOC || selectedItems.length > 0
    || priority !== "Standard" || tags.length !== 2 || tagInput.length > 0;

  const { guardedClose, discardDialog } = useDiscardGuard(isDirty, onClose);

  /* Keyboard shortcuts */
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowSearch(true);
      }
      if (e.key === "Escape") {
        if (showSearch) { setShowSearch(false); setSearch(""); }
        else guardedClose();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (step === 1 && selectedCustomer && selectedPOC) setStep(2);
        else if (step === 2) { const p = buildPayload(); if (p) onContinue?.(p); }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, showSearch, selectedCustomer, selectedPOC, selectedItems, step, guardedClose, onContinue, buildPayload]);

  /* Filter customers by search */
  const filteredCustomers = useMemo(() => {
    if (!search.trim()) return MOCK_CUSTOMERS;
    const q = search.toLowerCase();
    return MOCK_CUSTOMERS.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.address.toLowerCase().includes(q) ||
      c.pocs.some(p => p.name.toLowerCase().includes(q))
    );
  }, [search]);

  /* Filter POCs by search */
  const filteredPOCGroups = useMemo(() => {
    if (!search.trim()) return MOCK_CUSTOMERS.slice(0, 3);
    const q = search.toLowerCase();
    return MOCK_CUSTOMERS.filter(c =>
      c.pocs.some(p => p.name.toLowerCase().includes(q) || p.role.toLowerCase().includes(q) || p.email.toLowerCase().includes(q))
    ).map(c => ({
      ...c,
      pocs: c.pocs.filter(p => p.name.toLowerCase().includes(q) || p.role.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)),
    }));
  }, [search]);

  const handleSelectCustomer = useCallback((customer: Customer) => {
    setSelectedCustomer(customer);
    const primary = customer.pocs.find(p => p.isPrimary) || customer.pocs[0];
    setSelectedPOC(primary || null);
    setShowSearch(false);
    setSearch("");
  }, []);

  const handleSelectPOC = useCallback((customer: Customer, poc: POC) => {
    setSelectedCustomer(customer);
    setSelectedPOC(poc);
    setShowSearch(false);
    setSearch("");
  }, []);

  const clearSelection = () => {
    setSelectedCustomer(null);
    setSelectedPOC(null);
    setSelectedLocation(null);
    setSelectedRecipients([]);
    setRecipientPrimaryId("");
    setSelectedBillingAddress(null);
    setSelectedShippingAddress(null);
    setSelectedPaymentTerms("Net 30");
    setSelectedPaymentTermId("net30");
    setSelectedPaymentMethod("ACH/Direct Deposit");
    setSelectedPaymentMethodId("ach");
    setSelectedCurrency("EUR");
    setSelectedReps([{ id: 'rep1', name: 'Yahya Naveed', initials: 'YN', isPrimary: true, isCurrentUser: true, isCustomerDefault: true }]);
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput("");
  };

  if (!open) return null;

  const hasSelection = !!selectedCustomer && !!selectedPOC;

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: "var(--z-modal)" as any, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {/* Backdrop */}
      <div
        style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0, 0, 0, 0.4)", backdropFilter: "blur(1px)" }}
        onClick={guardedClose}
      />
      {discardDialog}

      {/* Modal — fixed width + height, consistent across all states */}
      <div style={{
        position: "relative",
        width: MODAL_WIDTH,
        maxWidth: MODAL_MAX_WIDTH,
        height: MODAL_HEIGHT,
        maxHeight: MODAL_MAX_HEIGHT,
        display: "flex",
        flexDirection: "column",
        background: "var(--card)",
        borderRadius: 16,
        boxShadow: "0 24px 48px -12px rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(0, 0, 0, 0.05)",
        overflow: "hidden",
      }}>

        {/* ── Header ── */}
        <div style={{ borderBottom: "1px solid #EEF2F6", flexShrink: 0, background: "white", borderRadius: "16px 16px 0 0" }}>
          <div style={{ padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #EEF2F6" }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", lineHeight: 1 }}>Create New Sales Order</div>
              <div style={{ fontSize: 11, fontWeight: 400, color: "#94A3B8", marginTop: 4 }}>Configure the details and line items for the new sales order.</div>
            </div>
            <button
              onClick={guardedClose}
              className="flex items-center justify-center transition-all"
              style={{ width: 32, height: 32, borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", color: "#94A3B8" }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#F1F5F9"; e.currentTarget.style.color = "#64748B"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "#94A3B8"; }}
            >
              <X style={{ width: 16, height: 16 }} />
            </button>
          </div>

          {/* Step Tabs — matching Partner Management */}
          <div style={{ padding: "0 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
              <StepTab stepNum={1} label="Select Recipient" active={step === 1} done={step === 2} onClick={step === 2 ? () => setStep(1) : undefined} />
              <StepTab stepNum={2} label="Add Line Items" active={step === 2} />
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        {step === 1 ? (
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 48px 16px 48px", background: hasSelection ? "#FAFBFC" : "white" }}>
            {/* Toggle moved to fixed viewport position */}

            {!hasSelection && (
              <>
                <div style={{ ...labelSemi, color: "var(--foreground)", marginBottom: 2 }}>Select Customer and Recipient</div>
                <div style={{ ...captionNormal, color: "#6B7280", marginBottom: 14 }}>
                  Choose a contact or create a new one to create this sales order.{" "}
                  <span style={{ color: "var(--primary)", cursor: "pointer" }}>Learn more ↗</span>
                </div>
              </>
            )}

            {/* Search Bar */}
            {!hasSelection && (
              <div
                onClick={() => setShowSearch(true)}
                className="transition-all"
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "0 16px", borderRadius: 8,
                  border: "1px solid #E5E7EB",
                  background: "white",
                  cursor: "text",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                  height: 44,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#1B6EF3"; e.currentTarget.style.boxShadow = "0 4px 10px rgba(0,0,0,0.06)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.05)"; }}
              >
                <Search style={{ width: 18, height: 18, color: "#9CA3AF", flexShrink: 0 }} />
                <span style={{ fontSize: 14, fontWeight: 400, color: "#9CA3AF", flex: 1 }}>
                  Search for the customer or contact to create a sales order for...
                </span>
                <kbd style={{
                  fontSize: 11, fontWeight: 500, padding: "4px 10px",
                  borderRadius: 4, border: "1px solid #E5E7EB", background: "#F3F4F6",
                  color: "#6B7280",
                }}>⌘K</kbd>
              </div>
            )}

            {/* Empty State */}
            {!hasSelection && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 0 32px" }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--secondary)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                  <Search style={{ width: 18, height: 18, color: "var(--foreground)", opacity: 0.2 }} />
                </div>
                <div style={{ ...labelSemi, color: "var(--foreground)", marginBottom: 3 }}>No Recipient Selected.</div>
                <div style={{ ...captionNormal, color: "#6B7280" }}>Select the contact you need to create sales order for</div>
              </div>
            )}

            {/* Selected State */}
            {hasSelection && selectedCustomer && selectedPOC && (
              <SelectedState
                customer={selectedCustomer}
                poc={selectedPOC}
                customerAddress={selectedLocation?.address || selectedCustomer.address}
                onClear={clearSelection}
                onChangeLocation={() => setShowLocationModal(true)}
                priority={priority}
                onPriorityChange={setPriority}
                tags={tags}
                tagInput={tagInput}
                onTagInputChange={setTagInput}
                onAddTag={addTag}
                onRemoveTag={(t) => setTags(tags.filter(x => x !== t))}
                onOpenRecipients={() => setShowRecipientsModal(true)}
                onOpenAddress={(type) => setAddressModalType(type)}
                onOpenPaymentTerms={() => setShowPaymentTerms(true)}
                onOpenPaymentMethod={() => setShowPaymentMethod(true)}
                paymentTerms={selectedPaymentTerms}
                paymentMethod={selectedPaymentMethod}
                billingAddress={selectedBillingAddress}
                shippingAddress={selectedShippingAddress}
                selectedReps={selectedReps}
                availableReps={AVAILABLE_REPS}
                onRepsChange={setSelectedReps}
                currency={selectedCurrency}
                onCurrencyChange={setSelectedCurrency}
                customerDefaultCurrency="EUR"
                variant={customerVerificationVariant}
              />
            )}
          </div>
        ) : (
          <CreateSOStep2
            lineItems={selectedItems}
            onLineItemsChange={setSelectedItems}
            hasCustomer={!!selectedCustomer}
            customerCurrency={selectedCurrency}
          />
        )}

        {/* ── Footer ── */}
        {step === 1 ? (
          <div style={{ position: "sticky", bottom: 0, background: "white", borderTop: "1px solid #EEF2F6", padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "flex-end", flexShrink: 0, borderRadius: "0 0 16px 16px" }}>
            <button
              onClick={() => { if (hasSelection) setStep(2); }}
              disabled={!hasSelection}
              className={`px-4 h-9 text-[13px] transition-colors flex items-center gap-2 ${hasSelection ? 'bg-[#0A77FF] text-white hover:bg-[#0862D0] shadow-sm' : 'bg-[#E5E7EB] text-[#9CA3AF] cursor-not-allowed'}`}
              style={{ borderRadius: 8, fontWeight: 600 }}
            >
              Continue
              <ArrowRight style={{ width: 14, height: 14 }} />
            </button>
          </div>
        ) : (
          <div style={{ position: "sticky", bottom: 0, background: "white", borderTop: "1px solid #EEF2F6", padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, borderRadius: "0 0 16px 16px" }}>
            <button
              onClick={() => setStep(1)}
              className="text-[13px] text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC] flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all"
              style={{ fontWeight: 500 }}
            >
              <ArrowLeft style={{ width: 14, height: 14 }} />
              Back
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                className="px-4 h-9 border border-[#E2E8F0] text-[13px] text-[#64748B] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-all flex items-center gap-2"
                style={{ borderRadius: 8, fontWeight: 500 }}
                type="button"
              >
                Save Draft
              </button>
              <button
                onClick={() => { const p = buildPayload(); if (p) onContinue?.(p); }}
                disabled={selectedItems.length === 0}
                className={`px-4 h-9 text-[13px] transition-all flex items-center gap-2 shadow-sm ${selectedItems.length > 0 ? 'bg-[#0A77FF] text-white hover:bg-[#0862D0]' : 'bg-[#E5E7EB] text-[#9CA3AF] cursor-not-allowed'}`}
                style={{ borderRadius: 8, fontWeight: 600 }}
              >
                Create SO
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ═══ Search Overlay ═══ */}
      {showSearch && (
        <SearchOverlay
          search={search}
          onSearchChange={setSearch}
          searchTab={searchTab}
          onSearchTabChange={setSearchTab}
          filteredCustomers={filteredCustomers}
          filteredPOCGroups={filteredPOCGroups}
          onSelectCustomer={handleSelectCustomer}
          onSelectPOC={handleSelectPOC}
          onClose={() => { setShowSearch(false); setSearch(""); }}
          inputRef={searchInputRef}
          showInactive={showInactive}
          onShowInactiveChange={setShowInactive}
        />
      )}

      {/* ═══ Modal portals ═══ */}
      {showRecipientsModal && selectedCustomer && (
        <RecipientsSelectionModal
          isOpen={showRecipientsModal}
          onClose={() => setShowRecipientsModal(false)}
          currentCustomerId={selectedCustomer.id}
          currentCustomerName={selectedCustomer.name}
          selectedRecipients={selectedRecipients}
          primaryPoCId={recipientPrimaryId}
          onSelect={(recipients, primaryId) => {
            setSelectedRecipients(recipients);
            setRecipientPrimaryId(primaryId);
            setShowRecipientsModal(false);
          }}
        />
      )}

      <AddressSelectionModal
        isOpen={addressModalType !== null}
        onClose={() => setAddressModalType(null)}
        type={addressModalType || 'billing'}
        customerName={selectedCustomer?.name || ''}
        currentCustomer={{ id: selectedCustomer?.id || '', name: selectedCustomer?.name || '', type: 'Customer', location: '' }}
        currentAddress={null}
        onSelect={(address, _partner) => {
          const addrStr = `${address.street}, ${address.city}, ${address.state} ${address.zip}`;
          if (addressModalType === 'billing') setSelectedBillingAddress(addrStr);
          else setSelectedShippingAddress(addrStr);
          setAddressModalType(null);
        }}
      />

      <PaymentTermsLibrary
        isOpen={showPaymentTerms}
        onClose={() => setShowPaymentTerms(false)}
        onSelect={(term) => {
          setSelectedPaymentTerms(term.name);
          setSelectedPaymentTermId(term.id);
          setShowPaymentTerms(false);
        }}
        currentTermId={selectedPaymentTermId}
        customerName={selectedCustomer?.name || ''}
      />

      <PaymentMethodSelectionModal
        isOpen={showPaymentMethod}
        onClose={() => setShowPaymentMethod(false)}
        onSelect={(method) => {
          setSelectedPaymentMethod(method.name);
          setSelectedPaymentMethodId(method.id);
          setShowPaymentMethod(false);
        }}
        currentMethodId={selectedPaymentMethodId}
        customerName={selectedCustomer?.name || ''}
      />


      {/* ═══ Fixed viewport variant toggle ═══ */}
      {hasSelection && step === 1 && (
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999, display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.12)" }}>
          <span style={{ fontSize: 11, fontWeight: 500, color: "var(--foreground)", opacity: 0.7 }}>Step 1b UX</span>
          <select
            value={String(customerVerificationVariant)}
            onChange={(e) => setCustomerVerificationVariant(Number(e.target.value) as 1 | 2 | 3)}
            style={{ height: 26, borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", fontSize: 11, padding: "0 8px", outline: "none", cursor: "pointer" }}
          >
            <option value="1">Variant 1</option>
            <option value="2">Variant 2</option>
            <option value="3">Variant 3</option>
          </select>
        </div>
      )}

      {showLocationModal && selectedCustomer && (
        <LocationSelectionModal
          isOpen={showLocationModal}
          onClose={() => setShowLocationModal(false)}
          onSelect={(location) => {
            setSelectedLocation({
              id: location.id,
              name: location.name,
              address: location.address,
              isDefault: location.isDefault,
            });
            setShowLocationModal(false);
          }}
          currentLocationId={selectedLocation?.id || 'loc1'}
          customerName={selectedCustomer.name}
        />
      )}
    </div>,
    document.body
  );
}

/* ═══════════════════════════════════════════════════════
   Step Tab
   ═══════════════════════════════════════════════════════ */
function StepTab({ stepNum, label, active, done, onClick }: { stepNum: number; label: string; active: boolean; done?: boolean; onClick?: () => void }) {
  return (
    <div
      className={`relative flex items-center gap-2 pb-3 ${done ? "cursor-pointer" : active ? "cursor-default" : "cursor-default"}`}
      onClick={onClick}
      style={{ opacity: active || done ? 1 : 0.4 }}
    >
      <div
        className="shrink-0 flex items-center justify-center transition-all duration-200"
        style={{
          width: 22, height: 22, borderRadius: "50%",
          fontSize: 12, fontWeight: 600,
          ...(done
            ? { background: "#10B981", color: "white" }
            : active
            ? { background: "#0A77FF", color: "white" }
            : { border: "1.5px solid #CBD5E1", color: "#64748B", background: "white" }),
        }}
      >
        {done ? <Check style={{ width: 12, height: 12, strokeWidth: 3 }} /> : stepNum}
      </div>
      <span
        className="whitespace-nowrap transition-colors"
        style={{
          fontSize: 13,
          fontWeight: active || done ? 600 : 500,
          color: active ? "#0A77FF" : done ? "#10B981" : "#334155",
        }}
      >
        {label}
      </span>
      {(active || done) && (
        <div
          className="absolute bottom-0 left-0 right-0 rounded-t-full"
          style={{ height: 2, background: done ? "#10B981" : "#0A77FF" }}
        />
      )}
    </div>
  );
}

/* ════════════════════════════════════════════���══════════
   Search Overlay — matches modal width
   ═══════════════════════════════════════════════════════ */
interface SearchOverlayProps {
  search: string;
  onSearchChange: (v: string) => void;
  searchTab: "All" | "Customers" | "Point of Contact";
  onSearchTabChange: (v: "All" | "Customers" | "Point of Contact") => void;
  filteredCustomers: Customer[];
  filteredPOCGroups: (Customer & { pocs: POC[] })[];
  onSelectCustomer: (c: Customer) => void;
  onSelectPOC: (c: Customer, p: POC) => void;
  onClose: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  showInactive: boolean;
  onShowInactiveChange: (v: boolean) => void;
}

function SearchOverlay({
  search, onSearchChange, searchTab, onSearchTabChange,
  filteredCustomers, filteredPOCGroups,
  onSelectCustomer, onSelectPOC, onClose, inputRef,
  showInactive, onShowInactiveChange,
}: SearchOverlayProps) {
  const TABS: ("All" | "Customers" | "Point of Contact")[] = ["All", "Customers", "Point of Contact"];
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => setExpandedGroups(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 animate-in fade-in duration-200"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(1px)', zIndex: 10001 }}
        onClick={onClose}
      />

      {/* Search Overlay Container — Quotes-style split layout */}
      <div className="fixed inset-0 flex flex-col items-center pt-12 pb-12 px-4 pointer-events-none" style={{ zIndex: 10001 }}>
        <div className="w-full flex flex-col gap-3 pointer-events-auto animate-in fade-in zoom-in-95 duration-200" style={{ maxWidth: '1200px', maxHeight: 'calc(100vh - 96px)' }}>
          {/* Search Bar Section */}
          <div className="flex gap-3">
            <div className="flex-1 bg-white rounded-lg shadow-2xl px-3 py-2" onClick={(e) => e.stopPropagation()}>
              <div className="relative flex items-center">
                <Search className="absolute left-0 w-4 h-4 text-[#9CA3AF]" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Search for a customer or a point of contact..."
                  value={search}
                  onChange={(e) => onSearchChange(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
                  className="w-full pl-8 pr-20 py-1 text-[13px] text-[#1F2937] bg-transparent focus:outline-none placeholder:text-[#9CA3AF]"
                />
                <div className="absolute right-0 px-2 py-0.5 bg-[#F3F4F6] border border-[#E5E7EB] rounded text-[11px] text-[#6B7280]" style={{ fontWeight: 500 }}>
                  esc
                </div>
              </div>
            </div>
            {/* Close Button */}
            <button
              onClick={onClose}
              className="h-10 w-10 flex items-center justify-center bg-white hover:bg-[#F9FAFB] rounded-lg shadow-2xl transition-colors"
            >
              <X className="w-4 h-4 text-[#6B7280]" />
            </button>
          </div>

          {/* Results Section (Separate Box) */}
          <div className="bg-white rounded-xl shadow-2xl flex flex-col flex-1 overflow-hidden" onClick={(e) => e.stopPropagation()} style={{ minHeight: '500px' }}>
            {/* Tabs */}
            <div className="px-4 pt-3 flex gap-4 border-b border-[#E5E7EB]">
              {TABS.map(tab => (
                <button
                  key={tab}
                  onClick={() => onSearchTabChange(tab)}
                  className={`pb-2.5 px-1 text-[13px] transition-colors border-b-2 ${
                    searchTab === tab
                      ? 'border-[#1B6EF3] text-[#1B6EF3]'
                      : 'border-transparent text-[#6B7280] hover:text-[#1F2937]'
                  }`}
                  style={{ fontWeight: searchTab === tab ? 600 : 400 }}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Results Area */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-4">
                {/* Customers section */}
                {(searchTab === "All" || searchTab === "Customers") && (
                  <>
                    <h3 className="text-[11px] text-[#9CA3AF] mb-3 px-3" style={{ fontWeight: 500, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                      Recently Searched Customers
                    </h3>
                    <div className="space-y-1">
                      {filteredCustomers.map(c => (
                        <button
                          key={c.id}
                          onClick={() => onSelectCustomer(c)}
                          className="w-full px-3 py-2 rounded-lg transition-colors text-left flex items-start gap-3 hover:bg-[#F9FAFB]"
                        >
                          <Avatar initials={c.initials} size={36} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                              <HighlightName name={c.name} search={search} style={{ fontSize: '13px', fontWeight: 500, color: '#1F2937' }} />
                              <span className="inline-flex items-center gap-1 text-[11px] text-[#6B7280]">
                                <Users style={{ width: 11, height: 11 }} /> {c.contactCount}
                              </span>
                            </div>
                            <p className="text-[12px] text-[#6B7280]">{c.address}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {/* POC section */}
                {(searchTab === "All" || searchTab === "Point of Contact") && (
                  <>
                    <div className="flex items-center justify-between mt-5 mb-3 px-3">
                      <h3 className="text-[11px] text-[#9CA3AF]" style={{ fontWeight: 500, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                        Recent Point of Contacts
                      </h3>
                      <button
                        onClick={() => onShowInactiveChange(!showInactive)}
                        className="flex items-center gap-2 text-[13px] text-[#6B7280]"
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
                      >
                        Show Inactive
                        <div style={{
                          width: 30, height: 16, borderRadius: 999, padding: 2,
                          background: showInactive ? "var(--primary)" : "#E5E7EB",
                          transition: "background 200ms", display: "flex", alignItems: "center",
                        }}>
                          <div style={{
                            width: 12, height: 12, borderRadius: "50%", background: "white",
                            boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                            transition: "transform 200ms",
                            transform: showInactive ? "translateX(14px)" : "translateX(0)",
                          }} />
                        </div>
                      </button>
                    </div>
                    {filteredPOCGroups.map(group => {
                      const visiblePocs = expandedGroups[group.id] ? group.pocs : group.pocs.slice(0, 4);
                      const hasMore = group.pocs.length > 4;
                      const remaining = group.pocs.length - 4;

                      return (
                        <div key={group.id} className="mb-4">
                          {/* Customer header */}
                          <div className="flex items-center gap-2.5 px-3 py-1.5 mb-1">
                            <Avatar initials={group.initials} size={30} />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-[13px] text-[#1F2937]" style={{ fontWeight: 600 }}>{group.name}</span>
                                <span className="inline-flex items-center gap-1 text-[11px] text-[#6B7280]">
                                  <Users style={{ width: 11, height: 11 }} /> {group.contactCount}
                                </span>
                              </div>
                              <p className="text-[11px] text-[#6B7280]">{group.address}</p>
                            </div>
                          </div>

                          {/* POC cards grid — nested under customer with left accent */}
                          <div style={{ marginLeft: 18, paddingLeft: 16 }}>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8, paddingTop: 4 }}>
                              {visiblePocs.map(poc => (
                                <POCCard
                                  key={poc.id}
                                  poc={poc}
                                  search={search}
                                  onClick={() => onSelectPOC(group, poc)}
                                />
                              ))}
                            </div>

                            {hasMore && (
                              <div className="flex justify-between items-center mt-1.5">
                                <button
                                  onClick={() => toggleExpand(group.id)}
                                  className="text-[13px] text-[#1B6EF3] hover:opacity-80 transition-opacity"
                                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px 8px', fontWeight: 500 }}
                                >
                                  {expandedGroups[group.id] ? "Show less" : `Show ${remaining} more`}
                                </button>
                                <span className="text-[11px] text-[#9CA3AF]">{group.pocs.length} total</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}

                {/* Create new customer link */}
                <div className="border-t border-[#E5E7EB] pt-3 mt-1.5">
                  <button
                    className="flex items-center gap-1.5 text-[13px] text-[#1B6EF3] hover:opacity-80 transition-opacity px-3 py-1.5"
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 500 }}
                  >
                    <Plus style={{ width: 14, height: 14 }} />
                    {search ? `Create a new point of contact '${search}'` : "Create a new customer"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════
   POC Card
   ═══════════════════════════════════════════════════════ */
function POCCard({ poc, search, onClick }: { poc: POC; search: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="transition-all cursor-pointer text-left relative group/card"
      style={{
        padding: "8px 10px",
        borderRadius: 8,
        border: "1px solid #E5E7EB",
        background: "white",
        display: "flex", flexDirection: "column", gap: 4,
        minWidth: 0,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#BFDBFE"; e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.08)"; e.currentTarget.style.backgroundColor = "#F9FAFB"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.backgroundColor = "white"; }}
    >
      {/* PRIMARY badge - upper right */}
      {poc.isPrimary && (
        <span className="absolute top-2 right-2 inline-flex items-center px-1 py-0.5 bg-[#DBEAFE] text-[#1E40AF] rounded text-[9px]" style={{ fontWeight: 600 }}>
          PRIMARY
        </span>
      )}

      {/* Avatar + Name Row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <Avatar initials={poc.initials} size={28} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="truncate" style={{ fontSize: 13, fontWeight: 500, color: "#1F2937" }} title={poc.name}>
            <HighlightName name={poc.name} search={search} style={{ fontSize: 13, fontWeight: 500, color: "#1F2937" }} />
          </div>
          <div className="truncate" style={{ fontSize: 11, color: "#6B7280", marginTop: 1 }} title={poc.role}>
            {poc.role}
          </div>
        </div>
      </div>

      {/* Contact details */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#6B7280" }}>
          <Phone style={{ width: 12, height: 12, flexShrink: 0 }} />
          <span className="truncate">{poc.phone}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#6B7280" }}>
          <Copy style={{ width: 12, height: 12, flexShrink: 0 }} />
          <span className="truncate">{poc.extension}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#6B7280", minWidth: 0 }}>
          <Mail style={{ width: 12, height: 12, flexShrink: 0 }} />
          <span className="truncate">{poc.email}</span>
        </div>
      </div>
    </button>
  );
}

/* Highlight matching text in name */
function HighlightName({ name, search, style: s }: { name: string; search: string; style: React.CSSProperties }) {
  if (!search.trim()) return <span style={s}>{name}</span>;
  const idx = name.toLowerCase().indexOf(search.toLowerCase());
  if (idx === -1) return <span style={s}>{name}</span>;
  return (
    <span style={s}>
      {name.slice(0, idx)}
      <mark style={{ backgroundColor: '#FEF08A', color: 'inherit', padding: 0, borderRadius: 2 }}>{name.slice(idx, idx + search.length)}</mark>
      {name.slice(idx + search.length)}
    </span>
  );
}

/* ═══ Date Config Cards with inline modal ═══ */
function DateConfigCardsWithModal({ priorityCard }: { priorityCard?: React.ReactNode }) {
  const [editingDate, setEditingDate] = useState<SODateType | null>(null);
  const [requestDate, setRequestDate] = useState("03/16/2026");
  const [estShipConfig, setEstShipConfig] = useState<DateConfig>({ dateType: "absolute", absoluteValue: "03/26/2026", relativeValue: "", relativeUnit: "__disable_relative__" });

  const handleSave = (config: DateConfig) => {
    if (editingDate === "request") setRequestDate(config.absoluteValue || requestDate);
    else if (editingDate === "estShip") setEstShipConfig({ ...config, dateType: "absolute", relativeUnit: "__disable_relative__" });
    setEditingDate(null);
  };

  const getInitialConfig = (): DateConfig => {
    if (editingDate === "request") return { dateType: "absolute", absoluteValue: requestDate, relativeValue: "", relativeUnit: "days" };
    if (editingDate === "estShip") return estShipConfig;
    return { dateType: "absolute", absoluteValue: "", relativeValue: "", relativeUnit: "days" };
  };

  return (
    <>
      <DateConfigCards
        requestDateValue={requestDate}
        estShipType={estShipConfig.dateType}
        estShipValue={estShipConfig.dateType === 'absolute' ? estShipConfig.absoluteValue : estShipConfig.relativeValue}
        estShipUnit={estShipConfig.relativeUnit}
        onEdit={setEditingDate}
        trailingElement={priorityCard}
      />
      {editingDate && (
        <DateEditModal
          type={editingDate}
          isOpen={true}
          onClose={() => setEditingDate(null)}
          onSave={handleSave}
          initialConfig={getInitialConfig()}
        />
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════
   Selected State — matches Quote module Step 2 layout
   ════════════════════════════���══════════════════════════ */
interface SelectedStateProps {
  customer: Customer;
  poc: POC;
  variant: 1 | 2 | 3;
  customerAddress: string;
  onClear: () => void;
  onChangeLocation: () => void;
  priority: "Low" | "Standard" | "High";
  onPriorityChange: (p: "Low" | "Standard" | "High") => void;
  tags: string[];
  tagInput: string;
  onTagInputChange: (v: string) => void;
  onAddTag: () => void;
  onRemoveTag: (t: string) => void;
  /* Modal triggers */
  onOpenRecipients: () => void;
  onOpenAddress: (type: 'billing' | 'shipping') => void;
  onOpenPaymentTerms: () => void;
  onOpenPaymentMethod: () => void;
  /* Display values */
  paymentTerms: string;
  paymentMethod: string;
  billingAddress: string | null;
  shippingAddress: string | null;
  /* Sales rep */
  selectedReps: SelectedSalesRep[];
  availableReps: SalesRepOption[];
  onRepsChange: (reps: SelectedSalesRep[]) => void;
  /* Currency */
  currency: string;
  onCurrencyChange: (code: string) => void;
  customerDefaultCurrency: string;
}

function SelectedState({
  customer, poc, variant, customerAddress, onClear, onChangeLocation,
  priority, onPriorityChange,
  tags, tagInput, onTagInputChange, onAddTag, onRemoveTag,
  onOpenRecipients, onOpenAddress, onOpenPaymentTerms, onOpenPaymentMethod,
  paymentTerms, paymentMethod,
  billingAddress, shippingAddress,
  selectedReps, availableReps, onRepsChange,
  currency, onCurrencyChange, customerDefaultCurrency,
}: SelectedStateProps) {
  if (variant === 1) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 16 }}>
        <div style={{ borderRadius: 10, border: "1px solid var(--border)", overflow: "hidden", background: "var(--secondary)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderBottom: "1px solid var(--border)", background: "color-mix(in srgb, var(--secondary) 85%, var(--card))" }}>
            <span style={{ ...labelSemi, color: "var(--foreground)" }}>Selected Customer and Recipient</span>
            <button onClick={onClear} style={{ border: "none", background: "transparent", color: "var(--destructive)", cursor: "pointer", fontSize: 12, fontWeight: 500 }}>Clear All</button>
          </div>
          <div style={{ padding: 12, background: "var(--card)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div style={{ display: "flex", gap: 10, flex: 1, minWidth: 0 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--secondary)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Building2 style={{ width: 18, height: 18, color: "var(--foreground)", opacity: 0.4 }} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ ...labelSemi, color: "var(--foreground)", marginBottom: 3 }}>{customer.name}</div>
                  <div style={{ ...captionNormal, color: "var(--foreground)", opacity: 0.6 }}>{customerAddress}</div>
                  <button onClick={onChangeLocation} style={{ marginTop: 4, border: "none", background: "transparent", color: "var(--primary)", cursor: "pointer", padding: 0, fontSize: 11, fontWeight: 500 }}>Change location</button>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                <div style={{ ...captionNormal, color: "var(--foreground)", opacity: 0.6 }}>{customer.phone}</div>
                <div style={{ ...captionNormal, color: "var(--foreground)", opacity: 0.6 }}>{customer.email}</div>
              </div>
            </div>

            <button onClick={onOpenRecipients} style={{ marginTop: 10, width: "100%", borderRadius: 8, border: "1px solid var(--border)", background: "var(--card)", padding: "8px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--primary-hover-bg)"; e.currentTarget.style.borderColor = "var(--primary)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--card)"; e.currentTarget.style.borderColor = "var(--border)"; }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Avatar initials={poc.initials} size={26} />
                <div style={{ textAlign: "left" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ ...captionSemi, color: "var(--foreground)" }}>{poc.name}</span>
                    <span style={{ fontSize: 9, fontWeight: 600, padding: "1px 5px", borderRadius: 3, backgroundColor: "#DBEAFE", color: "#1E40AF" }}>PRIMARY</span>
                  </div>
                  <div style={{ ...captionNormal, color: "var(--foreground)", opacity: 0.55 }}>{poc.role.split("|")[0].trim()}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {/* Overlapping PoC circles */}
                {(() => {
                  const others = customer.pocs.filter(p => p.id !== poc.id);
                  if (others.length === 0) return null;
                  const MAX_SHOWN = 3;
                  const shown = others.slice(0, MAX_SHOWN);
                  const overflowCount = others.length - MAX_SHOWN;
                  return (
                    <div style={{ display: "flex", alignItems: "center" }}>
                      {shown.map((p, i) => {
                        const pal = PASTEL_PALETTE[getPastelIndex(p.initials)];
                        return (
                          <div key={p.id} style={{
                            width: 24, height: 24, borderRadius: "50%",
                            backgroundColor: pal.bg, color: pal.color,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 9, fontWeight: 600,
                            border: "2px solid var(--card)",
                            marginLeft: i > 0 ? -6 : 0,
                            position: "relative", zIndex: MAX_SHOWN - i,
                          }}>
                            {p.initials}
                          </div>
                        );
                      })}
                      {overflowCount > 0 && (
                        <span style={{ fontSize: 11, color: "var(--primary)", fontWeight: 500, marginLeft: 4 }}>+{overflowCount} more</span>
                      )}
                    </div>
                  );
                })()}
                <span style={{ fontSize: 12, color: "var(--primary)", fontWeight: 500 }}>Manage Point of Contacts</span>
              </div>
            </button>
          </div>
        </div>

        <div style={{ borderRadius: 10, border: "1px solid var(--border)", overflow: "hidden", background: "var(--secondary)" }}>
          <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", background: "color-mix(in srgb, var(--secondary) 85%, var(--card))" }}>
            <span style={{ ...labelSemi, color: "var(--foreground)" }}>Billing, Shipping & Payment Configurations</span>
          </div>
          <div style={{ padding: 12, background: "var(--card)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 }}>
              <AddressCard label="BILL TO" name={customer.name} address={billingAddress || customer.address} onClick={() => onOpenAddress('billing')} />
              <AddressCard label="SHIP TO" name={customer.name} address={shippingAddress || customer.address} onClick={() => onOpenAddress('shipping')} />
            </div>
            <CurrencyConfigRow currency={currency} onChange={onCurrencyChange} customerDefault={customerDefaultCurrency} />
            <ConfigRow label="Payment terms" value={paymentTerms} onClick={onOpenPaymentTerms} />
            <ConfigRow label="Payment method" value={paymentMethod} hasIcon onClick={onOpenPaymentMethod} />
            <SalesRepSelector selectedReps={selectedReps} availableReps={availableReps} onSelectedRepsChange={onRepsChange} />
          </div>
        </div>

        <DateConfigCardsWithModal priorityCard={<PriorityCard priority={priority} onPriorityChange={onPriorityChange} />} />
        <TagsCard tags={tags} tagInput={tagInput} onTagInputChange={onTagInputChange} onAddTag={onAddTag} onRemoveTag={onRemoveTag} />
      </div>
    );
  }

  if (variant === 2) {
    const primaryPoc = poc;
    const otherPocs = customer.pocs.filter(p => p.id !== poc.id);

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 16 }}>
        {/* Section 1: Customer & Contacts */}
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ ...labelSemi, color: "var(--foreground)" }}>Customer & Contacts</span>
            <button onClick={onClear} className="transition-colors" style={{ display: "flex", alignItems: "center", gap: 4, ...captionStyle, color: "var(--destructive)", border: "none", background: "transparent", cursor: "pointer", padding: "4px 8px", borderRadius: 6 }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--destructive-hover-bg)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ""; }}
            >
              <X style={{ width: 11, height: 11 }} /> Clear All
            </button>
          </div>

          {/* Customer row */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "var(--secondary)", borderRadius: 8, marginBottom: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 8, background: "var(--card)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "1px solid var(--border)" }}>
              <Building2 style={{ width: 18, height: 18, color: "var(--foreground)", opacity: 0.35 }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ ...labelSemi, color: "var(--foreground)", marginBottom: 2 }}>{customer.name}</div>
              <div style={{ ...captionNormal, color: "#6B7280" }}>{customerAddress}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flexShrink: 0 }}>
              <div style={{ ...captionNormal, color: "#6B7280", display: "flex", alignItems: "center", gap: 4 }}>
                <Phone style={{ width: 11, height: 11, color: "#9CA3AF" }} /> {customer.phone}
              </div>
              <button onClick={onChangeLocation} style={{ border: "none", background: "transparent", color: "var(--primary)", cursor: "pointer", padding: 0, fontSize: 11, fontWeight: 500, display: "flex", alignItems: "center", gap: 3 }}>
                <ArrowLeftRight style={{ width: 10, height: 10 }} /> Change location
              </button>
            </div>
          </div>

          {/* Primary PoC + other PoCs row */}
          <div
            className="group cursor-pointer transition-all"
            onClick={onOpenRecipients}
            style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", transition: "all 150ms ease" }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--primary-hover-bg)"; e.currentTarget.style.borderColor = "var(--primary)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ""; e.currentTarget.style.borderColor = "var(--border)"; }}
          >
            {/* Primary */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
              <Avatar initials={primaryPoc.initials} size={28} />
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ ...captionSemi, color: "var(--foreground)" }}>{primaryPoc.name}</span>
                  <span style={{ fontSize: 9, fontWeight: 600, padding: "1px 5px", borderRadius: 3, backgroundColor: "#DBEAFE", color: "#1E40AF" }}>PRIMARY</span>
                </div>
                <div style={{ ...captionNormal, color: "#6B7280" }}>{primaryPoc.role.split("|")[0].trim()}</div>
              </div>
            </div>

            {/* Overlapping other PoC circles */}
            {otherPocs.length > 0 && (
              <div style={{ display: "flex", alignItems: "center" }}>
                {otherPocs.slice(0, 3).map((p, i) => {
                  const pal = PASTEL_PALETTE[getPastelIndex(p.initials)];
                  return (
                    <div key={p.id} style={{
                      width: 26, height: 26, borderRadius: "50%",
                      backgroundColor: pal.bg, color: pal.color,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 9, fontWeight: 600,
                      border: "2px solid var(--card)",
                      marginLeft: i > 0 ? -6 : 0,
                      position: "relative", zIndex: 3 - i,
                    }}>
                      {p.initials}
                    </div>
                  );
                })}
                {otherPocs.length > 3 && (
                  <span style={{ fontSize: 11, color: "var(--primary)", fontWeight: 500, marginLeft: 4 }}>+{otherPocs.length - 3} more</span>
                )}
              </div>
            )}

            <Pencil className="group-hover:text-primary transition-colors" style={{ width: 12, height: 12, color: "var(--foreground)", opacity: 0.3, flexShrink: 0 }} />
          </div>
        </div>

        {/* Section 2: Order Configuration */}
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px" }}>
          <div style={{ ...labelSemi, color: "var(--foreground)", marginBottom: 10 }}>Order Configuration</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 }}>
            <AddressCard label="BILL TO" name={customer.name} address={billingAddress || customer.address} onClick={() => onOpenAddress('billing')} />
            <AddressCard label="SHIP TO" name={customer.name} address={shippingAddress || customer.address} onClick={() => onOpenAddress('shipping')} />
          </div>
          <CurrencyConfigRow currency={currency} onChange={onCurrencyChange} customerDefault={customerDefaultCurrency} />
          <ConfigRow label="Payment terms" value={paymentTerms} onClick={onOpenPaymentTerms} />
          <ConfigRow label="Payment method" value={paymentMethod} hasIcon onClick={onOpenPaymentMethod} />
          <SalesRepSelector selectedReps={selectedReps} availableReps={availableReps} onSelectedRepsChange={onRepsChange} />
          <div style={{ marginTop: 10 }}>
            <DateConfigCardsWithModal priorityCard={<PriorityCard priority={priority} onPriorityChange={onPriorityChange} />} />
          </div>
          <div style={{ marginTop: 10 }}>
            <TagsCard tags={tags} tagInput={tagInput} onTagInputChange={onTagInputChange} onAddTag={onAddTag} onRemoveTag={onRemoveTag} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 16 }}>

      {/* ── Main White Card Container ── */}
      <div style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "12px 16px",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ ...labelSemi, color: "var(--foreground)" }}>Selected Customer and Recipient</span>
          <button
            onClick={onClear}
            className="transition-colors"
            style={{
              display: "flex", alignItems: "center", gap: 4,
              ...captionStyle, color: "var(--destructive)", border: "none",
              background: "transparent", cursor: "pointer", padding: "4px 10px",
              borderRadius: "calc(var(--radius) - 4px)",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--destructive-hover-bg)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ""; }}
          >
            <X style={{ width: 12, height: 12 }} /> Clear All
          </button>
        </div>

        {/* Gray container with two white sub-boxes */}
        <div style={{
          background: "var(--secondary)",
          border: "1px solid var(--border)",
          borderRadius: "calc(var(--radius) - 4px)",
          padding: 10,
        }}>
          {/* ── White Sub-box 1: Customer Details + Recipients ── */}
          <div style={{
            background: "var(--card)",
            borderRadius: "calc(var(--radius) - 4px)",
            padding: 10,
            marginBottom: 10,
            boxShadow: "var(--elevation-1)",
          }}>
            {/* Customer Details Row */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 8 }}>
              {/* Left: Icon + Company */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flex: 1, minWidth: 0 }}>
                {/* Building icon */}
                <div style={{
                  width: 40, height: 40, borderRadius: "calc(var(--radius) - 4px)",
                  background: "var(--secondary)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <Building2 style={{ width: 20, height: 20, color: "var(--foreground)", opacity: 0.35 }} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Customer name */}
                  <div style={{ ...labelSemi, color: "var(--foreground)", marginBottom: 4 }}>
                    {customer.name}
                  </div>
                  {/* Address + Change link */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                    <span style={{ ...captionNormal, color: "#6B7280" }}>
                      {customerAddress}
                    </span>
                    <button
                      onClick={onChangeLocation}
                      className="flex-shrink-0"
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 3,
                        ...font, fontSize: "var(--text-small)", fontWeight: "var(--font-weight-medium)" as any,
                        color: "var(--primary)", border: "none",
                        background: "transparent", cursor: "pointer", padding: 0,
                        borderBottom: "1px dotted var(--primary)",
                      }}
                    >
                      <ArrowLeftRight style={{ width: 11, height: 11 }} /> Change
                    </button>
                  </div>
                  {/* Status tags — pastel */}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {customer.status.map(s => {
                      const isActive = s === "Active";
                      return (
                        <span
                          key={s}
                          style={{
                            display: "inline-flex", alignItems: "center", height: 20,
                            fontSize: 10, fontWeight: 500,
                            padding: "0 8px", borderRadius: 4,
                            backgroundColor: isActive ? "#D1FAE5" : "#DBEAFE",
                            border: `1px solid ${isActive ? "#A7F3D0" : "#93C5FD"}`,
                            color: isActive ? "#065F46" : "#1E40AF",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {s}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right: Contact Info */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, ...captionNormal, color: "#6B7280" }}>
                  <Phone style={{ width: 12, height: 12, flexShrink: 0, color: "#9CA3AF" }} />
                  <span>{customer.phone}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, ...captionNormal, color: "#6B7280" }}>
                  <Phone style={{ width: 12, height: 12, flexShrink: 0, color: "#9CA3AF" }} />
                  <span>{customer.fax}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, ...captionNormal, color: "#6B7280" }}>
                  <Mail style={{ width: 12, height: 12, flexShrink: 0, color: "#9CA3AF" }} />
                  <span>{customer.email}</span>
                </div>
              </div>
            </div>

            {/* Recipients Row — entire row hovers blue */}
            <div
              className="group cursor-pointer transition-all"
              onClick={onOpenRecipients}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "8px 10px",
                borderRadius: "calc(var(--radius) - 4px)",
                border: "1px solid var(--border)",
                marginTop: 4,
                transition: "all 150ms ease",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--primary-hover-bg)"; e.currentTarget.style.borderColor = "var(--primary)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ""; e.currentTarget.style.borderColor = "var(--border)"; }}
            >
              <span style={{ ...font, fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-normal)" as any, color: "#6B7280" }}>Recipients</span>

              {/* Primary recipient pill — fully rounded */}
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "4px 12px 4px 4px",
                borderRadius: 999,
                background: "var(--secondary)",
              }}>
                <Avatar initials={poc.initials} size={28} />
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ ...captionStyle, color: "var(--foreground)" }}>{poc.name}</span>
                    {poc.isPrimary && (
                      <span style={{
                        fontSize: 10, fontWeight: 500,
                        padding: "1px 6px", borderRadius: 4,
                        backgroundColor: '#1B6EF3', color: "#FFFFFF",
                      }}>Primary</span>
                    )}
                  </div>
                  <span style={{ ...font, fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-normal)" as any, color: "#9CA3AF" }}>
                    {poc.role.split("|")[0].trim()}
                  </span>
                </div>
              </div>

              {/* Secondary recipient overlapping circles — pastel, with +X blue circle on top */}
              {(() => {
                const others = customer.pocs.filter(p => p.id !== poc.id);
                if (others.length === 0) return null;
                const MAX_SHOWN = 2;
                const shown = others.slice(0, MAX_SHOWN);
                const overflowCount = others.length - MAX_SHOWN;
                return (
                  <div style={{ display: "flex", alignItems: "center" }}>
                    {shown.map((p, i) => {
                      const pal = PASTEL_PALETTE[getPastelIndex(p.initials)];
                      return (
                        <div key={p.id} style={{
                          width: 28, height: 28, borderRadius: "50%",
                          backgroundColor: pal.bg, color: pal.color,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          ...font, fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-semibold)" as any,
                          border: "2px solid var(--card)",
                          marginLeft: i > 0 ? -8 : 0,
                          position: "relative",
                          zIndex: MAX_SHOWN - i,
                        }}>
                          {p.initials}
                        </div>
                      );
                    })}
                    {overflowCount > 0 && (
                      <div style={{
                        width: 28, height: 28, borderRadius: "50%",
                        backgroundColor: "#EDF4FF", color: "#0A77FF",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        ...font, fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-semibold)" as any,
                        border: "2px solid var(--card)",
                        marginLeft: -8,
                        position: "relative",
                        zIndex: MAX_SHOWN + 1,
                      }}>
                        +{overflowCount}
                      </div>
                    )}
                  </div>
                );
              })()}

              <div style={{ flex: 1 }} />
              <Pencil className="group-hover:text-primary transition-colors" style={{ width: 12, height: 12, color: "var(--foreground)", opacity: 0.3 }} />
            </div>
          </div>

          {/* ── White Sub-box 2: Billing, Shipping & Payment ── */}
          <div style={{
            background: "var(--card)",
            borderRadius: "calc(var(--radius) - 4px)",
            padding: 10,
            boxShadow: "var(--elevation-1)",
          }}>
            <div style={{ fontSize: "var(--text-caption)", fontWeight: 550, color: "#4B5563", marginBottom: 8 }}>
              Billing, Shipping &amp; Payment Configurations
            </div>

            {/* Bill To / Ship To grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 }}>
              <AddressCard label="BILL TO" name={customer.name} address={billingAddress || customer.address} onClick={() => onOpenAddress('billing')} />
              <AddressCard label="SHIP TO" name={customer.name} address={shippingAddress || customer.address} onClick={() => onOpenAddress('shipping')} />
            </div>

            {/* Config rows */}
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              <CurrencyConfigRow currency={currency} onChange={onCurrencyChange} customerDefault={customerDefaultCurrency} />
              <ConfigRow label="Payment terms" value={paymentTerms} onClick={onOpenPaymentTerms} />
              <ConfigRow label="Payment method" value={paymentMethod} hasIcon onClick={onOpenPaymentMethod} />
              <SalesRepSelector
                selectedReps={selectedReps}
                availableReps={availableReps}
                onSelectedRepsChange={onRepsChange}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Date Cards + Priority — 3-column grid ── */}
      <DateConfigCardsWithModal priorityCard={<PriorityCard priority={priority} onPriorityChange={onPriorityChange} />} />

      {/* ── Tags — full width bottom row ── */}
      <TagsCard tags={tags} tagInput={tagInput} onTagInputChange={onTagInputChange} onAddTag={onAddTag} onRemoveTag={onRemoveTag} />
    </div>
  );
}

/* ── Address Card — Partner Management style: icon label, initials avatar, clickable map link ── */
function AddressCard({ label, name, address, onClick }: {
  label: string; name: string; address: string; onClick?: () => void;
}) {
  const isBilling = label === "BILL TO";
  const displayLabel = isBilling ? "Bill To" : "Ship To";
  const LabelIcon = isBilling ? CreditCard : Package;
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const avatarBg = isBilling ? "#6366F1" : "#6366F1";

  return (
    <div
      className="group cursor-pointer transition-all"
      onClick={onClick}
      style={{
        borderRadius: 12,
        background: "var(--card)",
        padding: "10px 12px",
        border: "1px solid var(--border)",
        transition: "all 150ms ease",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "color-mix(in srgb, var(--primary) 40%, transparent)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
    >
      {/* Header row: icon + label + info + pencil */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <LabelIcon style={{ width: 13, height: 13, color: "#94A3B8", flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 500, color: "#64748B" }}>{displayLabel}</span>
          <span style={{ fontSize: 10, color: "#CBD5E1" }}>ⓘ</span>
        </div>
        <Pencil className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ width: 12, height: 12, color: "#CBD5E1" }} />
      </div>

      {/* Avatar + Name */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <div style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: avatarBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: "#FFFFFF" }}>{initials}</span>
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} className="truncate" title={name}>{name}</span>
      </div>

      {/* Address with MapPin — clickable to Google Maps */}
      <a
        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="flex items-start gap-1.5 transition-colors hover:text-[#0A77FF] group/map"
        style={{ fontSize: 11, color: "#64748B", lineHeight: 1.5, textDecoration: "none" }}
      >
        <MapPin style={{ width: 12, height: 12, flexShrink: 0, marginTop: 2, color: "#94A3B8" }} />
        <span className="group-hover/map:underline break-words">{address}</span>
      </a>
    </div>
  );
}

/* ── Config Row — hoverable with pencil, no border between rows ── */
/* ── Currency row — matches ConfigRow shape, but the value is an inline currency picker with a flag. ── */
function CurrencyConfigRow({ currency, onChange, customerDefault }: {
  currency: string;
  onChange: (code: string) => void;
  customerDefault: string;
}) {
  return (
    <div
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "5px 10px",
        borderRadius: "calc(var(--radius) - 6px)",
      }}
    >
      <span style={{ ...captionNormal, color: "#6B7280" }}>Currency</span>
      <OrderCurrencyPicker
        value={currency}
        onChange={onChange}
        customerDefaultCurrency={customerDefault}
      />
    </div>
  );
}

function ConfigRow({ label, value, isAvatar, avatarInitials, hasIcon, onClick }: {
  label: string; value: string; isAvatar?: boolean; avatarInitials?: string; hasIcon?: boolean; onClick?: () => void;
}) {
  return (
    <div
      className="group cursor-pointer transition-all"
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "7px 10px",
        borderRadius: "calc(var(--radius) - 6px)",
        transition: "all 150ms ease",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--primary-hover-bg)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ""; }}
    >
      <span style={{ ...captionNormal, color: "#6B7280" }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {isAvatar && avatarInitials && <Avatar initials={avatarInitials} size={22} />}
        {hasIcon && <CreditCard style={{ width: 12, height: 12, color: "var(--primary)" }} />}
        <span style={{ ...captionSemi, color: "var(--foreground)" }}>{value}</span>
        {isAvatar ? (
          <ChevronDown style={{ width: 12, height: 12, color: "var(--foreground)", opacity: 0.3 }} />
        ) : (
          <Pencil className="group-hover:text-primary transition-colors" style={{ width: 12, height: 12, color: "var(--foreground)", opacity: 0.3 }} />
        )}
      </div>
    </div>
  );
}

/* ── Date Card — editable style with pencil icon ── */
function DateCard({ label, date, icon }: {
  label: string; date: string; icon?: "calendar" | "clock";
}) {
  const IconComp = icon === "clock" ? Clock : Calendar;
  return (
    <div
      className="group cursor-pointer transition-all"
      style={{
        borderRadius: "calc(var(--radius) - 2px)",
        background: "var(--card)",
        border: "1px solid var(--border)",
        padding: "10px 12px",
        display: "flex", flexDirection: "column", gap: 4,
        boxShadow: "var(--elevation-1)",
        transition: "all 150ms ease",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--primary-hover-bg)"; e.currentTarget.style.borderColor = "var(--primary)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--card)"; e.currentTarget.style.borderColor = "var(--border)"; }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <IconComp style={{ width: 12, height: 12, color: "var(--foreground)", opacity: 0.35 }} />
          <span style={{ ...font, fontSize: "var(--text-small)", fontWeight: "var(--font-weight-medium)" as any, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
        </div>
        <Pencil className="group-hover:text-primary transition-colors" style={{ width: 12, height: 12, color: "var(--foreground)", opacity: 0.3 }} />
      </div>
      <span style={{ ...labelSemi, color: "var(--foreground)" }}>{date}</span>
    </div>
  );
}

/* ── Priority Card — Quotes-style dropdown ── */
function PriorityCard({ priority, onPriorityChange }: {
  priority: "Low" | "Standard" | "High";
  onPriorityChange: (p: "Low" | "Standard" | "High") => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const priorityColor = (p: string) =>
    p === "High" ? "var(--destructive)" : p === "Standard" ? "var(--primary)" : "var(--foreground)";

  const priorityBgClass = (p: string) =>
    p === "High" ? "bg-destructive/12" : p === "Standard" ? "bg-primary/12" : "bg-secondary";

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div
        className="group cursor-pointer transition-all"
        onClick={() => setOpen(!open)}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--primary-hover-bg)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--card)"; }}
        style={{
          borderRadius: "calc(var(--radius) - 2px)",
          background: "var(--card)",
          border: open ? "1px solid var(--primary)" : "1px solid var(--border)",
          padding: "10px 12px",
          boxShadow: "var(--elevation-1)",
          transition: "all 150ms ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Flag style={{ width: 12, height: 12, color: "#9CA3AF" }} />
            <span style={{ ...font, fontSize: "var(--text-small)", fontWeight: "var(--font-weight-medium)" as any, color: "#6B7280" }}>Priority</span>
          </div>
          <Pencil className="group-hover:text-primary transition-colors" style={{ width: 12, height: 12, color: "var(--foreground)", opacity: 0.3 }} />
        </div>
                <span
                  style={{
                    display: "inline-block",
                    fontSize: 11, fontWeight: 500,
                    padding: "4px 10px", borderRadius: 4,
                    backgroundColor: priority === "High" ? "#FEE2E2" : priority === "Standard" ? "#DBEAFE" : "#F3F4F6",
                    color: priority === "High" ? "#991B1B" : priority === "Standard" ? "#1E40AF" : "#374151",
                  }}
                >
                  {priority}
                </span>
      </div>

      {/* Drop-up */}
      {open && (
        <div style={{
          position: "absolute", bottom: "100%", left: 0, marginBottom: 4,
          minWidth: 140, background: "var(--card)",
          border: "1px solid var(--border)", borderRadius: "calc(var(--radius) - 2px)",
          boxShadow: "var(--elevation-3)", zIndex: 10,
          overflow: "hidden",
        }}>
          {(["High", "Standard", "Low"] as const).map(p => (
            <button
              key={p}
              onClick={() => { onPriorityChange(p); setOpen(false); }}
              className="transition-colors"
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                width: "100%", padding: "8px 12px",
                border: "none",
                background: priority === p ? (p === "High" ? "#FEF2F2" : p === "Standard" ? "#EFF6FF" : "#F9FAFB") : "transparent",
                cursor: "pointer",
                borderBottom: "1px solid #E5E7EB",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#F9FAFB"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = priority === p ? (p === "High" ? "#FEF2F2" : p === "Standard" ? "#EFF6FF" : "#F9FAFB") : "transparent"; }}
            >
              <span style={{
                fontSize: 11, fontWeight: 500,
                padding: "4px 10px", borderRadius: 4,
                backgroundColor: p === "High" ? "#FEE2E2" : p === "Standard" ? "#DBEAFE" : "#F3F4F6",
                color: p === "High" ? "#991B1B" : p === "Standard" ? "#1E40AF" : "#374151",
              }}>
                {p}
              </span>
              {priority === p && <Check style={{ width: 14, height: 14, color: p === "High" ? "#991B1B" : p === "Standard" ? "#1E40AF" : "#374151" }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Tags Card — Quotes-style view/edit toggle ── */
function TagsCard({ tags, tagInput, onTagInputChange, onAddTag, onRemoveTag }: {
  tags: string[];
  tagInput: string;
  onTagInputChange: (v: string) => void;
  onAddTag: () => void;
  onRemoveTag: (t: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) requestAnimationFrame(() => inputRef.current?.focus());
  }, [editing]);

  return (
    <div
      className="group cursor-pointer transition-all"
      onClick={() => { if (!editing) setEditing(true); }}
      onMouseEnter={(e) => { if (!editing) e.currentTarget.style.backgroundColor = "var(--primary-hover-bg)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--card)"; }}
      style={{
        borderRadius: "calc(var(--radius) - 2px)",
        background: "var(--card)",
        border: editing ? "1px solid var(--primary)" : "1px solid var(--border)",
        padding: "10px 12px",
        boxShadow: "var(--elevation-1)",
        transition: "all 150ms ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <Tag style={{ width: 12, height: 12, color: "#9CA3AF" }} />
          <span style={{ ...font, fontSize: "var(--text-small)", fontWeight: "var(--font-weight-medium)" as any, color: "#6B7280" }}>Tags</span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); setEditing(!editing); }}
          style={{
            border: "none", background: "transparent", cursor: "pointer", padding: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: editing ? "var(--primary)" : "var(--foreground)", opacity: editing ? 0.8 : 0.3,
          }}
        >
          <Pencil style={{ width: 12, height: 12 }} />
        </button>
      </div>

      {editing ? (
        /* Edit mode — drop-up: edit area positioned above the card */
        <div onClick={(e) => e.stopPropagation()} style={{ position: "relative" }}>
          {/* Drop-up panel */}
          <div style={{
            position: "absolute", bottom: "100%", left: -14, right: -14, marginBottom: 8,
            background: "var(--card)", border: "1px solid var(--primary)",
            borderRadius: "calc(var(--radius) - 2px)",
            boxShadow: "var(--elevation-3)", zIndex: 10,
            padding: 12,
          }}>
            <div style={{
              display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center",
              padding: "6px 8px",
              border: "1px solid var(--border)",
              borderRadius: "calc(var(--radius) - 4px)",
              background: "var(--input-background)",
              minHeight: 36,
            }}>
              {tags.map(t => (
                <span key={t} style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  ...font, fontSize: "var(--text-small)", fontWeight: "var(--font-weight-medium)" as any,
                  padding: "3px 6px 3px 8px", borderRadius: 4,
                  background: "var(--secondary)", color: "var(--foreground)",
                }}>
                  {t}
                  <button
                    onClick={() => onRemoveTag(t)}
                    className="hover:text-destructive transition-colors"
                    style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--foreground)", opacity: 0.4, display: "flex", padding: 0 }}
                  >
                    <X style={{ width: 10, height: 10 }} />
                  </button>
                </span>
              ))}
              <input
                ref={inputRef}
                value={tagInput}
                onChange={e => onTagInputChange(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); onAddTag(); } }}
                placeholder={tags.length === 0 ? "Add tags..." : ""}
                style={{
                  ...font, fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-normal)" as any,
                  color: "var(--foreground)", border: "none", outline: "none",
                  background: "transparent", flex: 1, minWidth: 80, padding: "3px 4px",
                }}
              />
            </div>
            <div style={{ ...font, fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-normal)" as any, color: "var(--foreground)", opacity: 0.35, marginTop: 4, padding: "0 4px" }}>
              ↵ Enter to add{tags.length >= 5 && <span style={{ color: "var(--destructive)", marginLeft: 12 }}>Max 5 tags</span>}
            </div>
          </div>
          {/* Static tag display below (still visible) */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            {tags.map(t => (
              <span key={t} style={{
                ...font, fontSize: "var(--text-small)", fontWeight: "var(--font-weight-medium)" as any,
                padding: "4px 10px", borderRadius: 4,
                background: "var(--secondary)", color: "var(--foreground)",
                border: "1px solid var(--border)",
                whiteSpace: "nowrap",
              }}>
                {t}
              </span>
            ))}
          </div>
        </div>
      ) : (
        /* View mode — static tag pills */
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          {tags.length > 0 ? (
            <>
              {tags.slice(0, 4).map(t => (
                <span key={t} style={{
                  ...font, fontSize: "var(--text-small)", fontWeight: "var(--font-weight-medium)" as any,
                  padding: "4px 10px", borderRadius: 4,
                  background: "var(--secondary)", color: "var(--foreground)",
                  border: "1px solid var(--border)",
                  whiteSpace: "nowrap",
                }}>
                  {t}
                </span>
              ))}
              {tags.length > 4 && (
                <span style={{
                  ...font, fontSize: "var(--text-small)", fontWeight: "var(--font-weight-medium)" as any,
                  padding: "4px 10px", borderRadius: 4,
                  background: "var(--secondary)", color: "var(--foreground)", opacity: 0.6,
                  whiteSpace: "nowrap",
                }}>
                  +{tags.length - 4} more
                </span>
              )}
            </>
          ) : (
            <span style={{ ...captionNormal, color: "#9CA3AF" }}>No tags</span>
          )}
        </div>
      )}
    </div>
  );
}

export default CreateSOModal;
