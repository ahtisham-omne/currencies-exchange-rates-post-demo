// @ts-nocheck
import React, { useState, useEffect, useCallback, CSSProperties, ReactNode } from 'react';
import {
  Pencil,
  ArrowRight,
  CreditCard,
  Truck,
  Clock,
  ChevronDown,
  Users,
  DollarSign,
  MapPinned,
  CalendarDays,
  AlertCircle,
  AlertTriangle,
  X,
  Plus,
  UserCircle,
} from 'lucide-react';
import { DateEditModal } from '../quote-creation/DateEditModal';
import { AddressSelectionModal } from '../quote-creation/AddressSelectionModal';
import { PaymentTermsLibrary } from '../quote-creation/PaymentTermsLibrary';
import { PaymentMethodSelectionModal } from '../quote-creation/PaymentMethodSelectionModal';
import { RecipientsSelectionModal } from '../quote-creation/RecipientsSelectionModal';
import { LocationSelectionModal } from '../quote-creation/LocationSelectionModal';
import { SearchOverlay } from '../quote-creation/SearchOverlay';
import { MOCK_CUSTOMERS, MOCK_CONTACTS } from '../quote-creation/Step1CustomerSelection';
import { QuoteMoney } from '../currency/QuoteMoney';
import { BASE_CURRENCY, convertBetween, getLibraryCurrency, rateTypeLabel } from '../../data/currencyLibrary';
import { useRateContext } from '../../context/RateContext';
import { Lock as LockIcon, Settings2 as Settings2Icon } from 'lucide-react';
import { QuoteLifecycleStatus } from './ModernStatusStepper';
import { ManageAdjustmentsModal, AddQuoteLevelAdjustmentModal } from './ManageAdjustmentsModal';
import { PricingRulesManageModal } from './PricingRulesManageModal';
import { SalesRepSelector, SelectedSalesRep, SalesRepOption } from '../shared/SalesRepSelector';
import { toast } from 'sonner';

const SIDEBAR_SALES_REPS: SalesRepOption[] = [
  { id: 'rep1', name: 'Sarah Chen', initials: 'SC', isCurrentUser: true, isCustomerDefault: false },
  { id: 'rep2', name: 'Mike Johnson', initials: 'MJ', isCurrentUser: false, isCustomerDefault: false },
  { id: 'rep3', name: 'Emily Williams', initials: 'EW', isCurrentUser: false, isCustomerDefault: true },
  { id: 'rep4', name: 'David Chen', initials: 'DC', isCurrentUser: false, isCustomerDefault: false },
  { id: 'rep5', name: 'Yahya Naveed', initials: 'YN', isCurrentUser: false, isCustomerDefault: false },
];

// ─── Shared hover-edit row (SO V5 pattern — CSS-variable based) ──────────────
function HoverEditRow({
  children,
  onEdit,
  editable = true,
  style,
}: {
  children: ReactNode;
  onEdit?: () => void;
  editable?: boolean;
  style?: CSSProperties;
}) {
  const [hovered, setHovered] = useState(false);
  const { border, ...restStyle } = style || {};

  let baseBorderWidth = '0px';
  let baseBorderStyle = 'solid';
  let baseBorderColor = 'transparent';
  if (border) {
    const parts = (border as string).split(' ');
    if (parts.length >= 1) baseBorderWidth = parts[0];
    if (parts.length >= 2) baseBorderStyle = parts[1];
    if (parts.length >= 3) baseBorderColor = parts[2];
  }

  return (
    <div
      role={editable ? "button" : undefined}
      tabIndex={editable ? 0 : undefined}
      aria-label={editable ? "Edit" : undefined}
      onKeyDown={(e) => { if (editable && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onEdit?.(); } }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => { if (editable && onEdit) onEdit(); }}
      className={`relative transition-all ${editable ? 'cursor-pointer' : ''}`}
      style={{
        ...restStyle,
        borderWidth: baseBorderWidth,
        borderStyle: baseBorderStyle,
        borderColor: hovered && editable ? 'var(--ring)' : baseBorderColor,
      }}
    >
      {/* Translucent blue hover overlay */}
      <div
        className={`absolute inset-0 rounded-[inherit] transition-colors pointer-events-none ${hovered && editable ? 'bg-primary/5' : ''}`}
      />
      <div className="relative">{children}</div>
      {editable && (
        <div
          className={`absolute right-[10px] top-1/2 -translate-y-1/2 flex items-center justify-center transition-all ${hovered ? 'text-primary opacity-100' : 'text-foreground/25 opacity-100'}`}
        >
          <Pencil style={{ width: 12, height: 12 }} />
        </div>
      )}
    </div>
  );
}

// ─── Section header (PO-style — centered icon+title, separator inside content) ─────────────
function SectionHeader({
  icon: Icon,
  label,
  collapsed,
  onToggle,
}: {
  icon: React.ComponentType<{ style?: CSSProperties; className?: string }>;
  label: string;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  const isCollapsible = onToggle !== undefined;
  return (
    <button
      onClick={isCollapsible ? onToggle : undefined}
      className={`w-full flex items-center justify-between hover:bg-secondary/30 transition-colors ${isCollapsible ? 'cursor-pointer' : ''}`}
      style={{
        gap: 8,
        minHeight: 44,
        padding: '10px 0',
        border: 'none',
        background: 'none',
      }}
      aria-expanded={isCollapsible ? !collapsed : undefined}
    >
      <div className="flex items-center" style={{ gap: 8 }}>
        <div className="flex items-center justify-center shrink-0" style={{
          width: 24, height: 24, borderRadius: 'var(--radius-sm, 5px)',
          backgroundColor: 'rgba(10,119,255,0.08)',
        }}>
          <Icon style={{ width: 12, height: 12, color: '#3B82F6' }} />
        </div>
        <span className="text-foreground" style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}>
          {label}
        </span>
      </div>
      {isCollapsible && (
        <ChevronDown
          className="shrink-0 text-muted-foreground transition-transform duration-200"
          style={{ width: 14, height: 14, transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)' }}
        />
      )}
    </button>
  );
}

// ─── Subsection header (SO V5 pattern — compact collapsible) ─────────────────
function SubsectionHeader({
  icon: Icon,
  label,
  expanded,
  onToggle,
}: {
  icon: React.ComponentType<{ style?: CSSProperties; className?: string; strokeWidth?: string | number }>;
  label: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between bg-transparent border-none cursor-pointer hover:bg-secondary/20 transition-colors"
      style={{
        minHeight: 36,
        padding: '8px 0',
        gap: 8,
      }}
      aria-expanded={expanded}
    >
      <div className="flex items-center min-w-0" style={{ gap: 8 }}>
        <Icon style={{ width: 13, height: 13, color: 'var(--muted-foreground)', flexShrink: 0 }} strokeWidth={1.5} />
        <span
          className="truncate text-foreground"
          style={{
            fontSize: 12,
            fontWeight: 500,
            letterSpacing: '0.01em',
            lineHeight: 1.2,
          }}
        >
          {label}
        </span>
      </div>
      <ChevronDown
        className="text-muted-foreground"
        style={{
          width: 12,
          height: 12,
          transition: 'transform 200ms',
          transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          flexShrink: 0,
        }}
      />
    </button>
  );
}

// ─── Summary info row with pencil (SO V5 pattern) ───────────────────────────
function SummaryInfoRow({ label, onClick }: { label: string; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`flex items-center transition-all border-none cursor-pointer ${hovered ? 'bg-primary/5' : 'bg-transparent'}`}
      style={{ gap: 4, marginTop: 6, padding: '3px 6px', marginLeft: -6, borderRadius: 4 }}
    >
      <span className={`transition-colors ${hovered ? 'text-primary' : 'text-foreground/40'}`} style={{ fontSize: 11, lineHeight: 1 }}>
        {label}
      </span>
      <Pencil
        className={`shrink-0 transition-all ${hovered ? 'text-primary opacity-100' : 'text-foreground/20 opacity-0'}`}
        style={{ width: 10, height: 10 }}
      />
    </button>
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────
type DateKey = 'created' | 'request' | 'respond' | 'effective' | 'expiry' | 'sentOn' | 'confirmedOn' | 'convertedOn' | 'shipBy' | 'delivery';

// ─── Timeline date row (SO V5 pattern — dot + connector + hover) ────────────
function TimelineDateRow({
  entry,
  datesEditable,
  onEdit,
  isLast,
}: {
  entry: { key: DateKey; label: string; value: string; color: string; dotColor: string; dotFill?: boolean; editable?: boolean };
  datesEditable: boolean;
  onEdit: (key: DateKey) => void;
  isLast: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const isEditable = datesEditable && (entry.editable !== false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => isEditable && onEdit(entry.key)}
      className={`flex items-center transition-colors ${isEditable ? 'cursor-pointer' : ''} ${hovered && isEditable ? 'bg-primary/5' : ''}`}
      style={{ gap: 10, padding: '5px 6px', margin: '0 -6px', borderRadius: 5 }}
    >
      {/* Dot column with connector line */}
      <div className="relative shrink-0" style={{ width: 11, height: 11 }}>
        <div
          className="relative rounded-full"
          style={{
            width: 11, height: 11,
            backgroundColor: entry.dotFill ? entry.dotColor : 'var(--card)',
            borderWidth: '2.5px', borderStyle: 'solid', borderColor: entry.dotColor,
            zIndex: 1,
          }}
        />
        {!isLast && (
          <div
            className="absolute bg-border"
            style={{ left: '50%', top: 11, transform: 'translateX(-50%)', width: 1.5, height: 16 }}
          />
        )}
      </div>
      {/* Content — label + value + pencil */}
      <div className="flex items-center justify-between flex-1 min-w-0" style={{ gap: 8 }}>
        <span className="text-foreground/40 whitespace-nowrap" style={{ fontSize: 11, fontWeight: 500, lineHeight: 1 }}>
          {entry.label}
        </span>
        <div className="flex items-center">
          <span className="whitespace-nowrap text-right" style={{ fontSize: 12, fontWeight: 600, lineHeight: 1, color: entry.color }}>
            {entry.value}
          </span>
          <div className="shrink-0 flex justify-end" style={{ width: 17 }}>
            {isEditable && (
              <Pencil
                className={`shrink-0 transition-all ${hovered ? 'text-primary opacity-100' : 'text-foreground/15 opacity-0'}`}
                style={{ width: 11, height: 11 }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
// ─── POC colors ──────────────────────────────────────────────────────────────
const getPoCColor = (initials: string) => {
  const colors = [
    { bg: '#FDE68A', text: '#92400E' }, { bg: '#DBEAFE', text: '#1E40AF' },
    { bg: '#FED7AA', text: '#9A3412' }, { bg: '#C7D2FE', text: '#3730A3' },
    { bg: '#FCA5A5', text: '#991B1B' }, { bg: '#D1FAE5', text: '#065F46' },
    { bg: '#E9D5FF', text: '#6B21A8' }, { bg: '#FBCFE8', text: '#831843' },
  ];
  const hash = initials.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

// ─── Mock data ───────────────────────────────────────────────────────────────
const INITIAL_POCS = [
  { id: 'p1', initials: 'KR', name: 'Karen Rodriguez', title: 'EMS Division Chief' },
  { id: 'p2', initials: 'TM', name: 'Tom Mitchell', title: 'Fleet Manager' },
  { id: 'p3', initials: 'BP', name: 'Brian Park', title: 'Procurement Officer' },
  { id: 'p4', initials: 'LH', name: 'Lisa Huang', title: 'Finance Director' },
  { id: 'p5', initials: 'AK', name: 'Anna Kim', title: 'Operations' },
  { id: 'p6', initials: 'DC', name: 'David Chen', title: 'Engineering' },
];

// ─── Props ───────────────────────────────────────────────────────────────────
interface RightSidebarProps {
  subtotal?: number;
  pricingRules?: number;
  adjustments?: number;
  adjustmentCount?: number;
  pricingRuleCount?: number;
  grandTotal?: number;
  activeTab?: string;
  onNavigateToTab?: (tab: string) => void;
  quoteStatus?: QuoteLifecycleStatus;
  expiryDate?: Date;
  createdDate?: Date;
  readOnly?: boolean;
  customerName?: string;
  contactName?: string;
  quoteId?: string;
  salesRep?: string;
  /** Customer's quote currency (ISO 4217). Drives the Currency block + Money cells. */
  customerCurrency?: string;
  /** Currency we settle into our books. Defaults to base when omitted. */
  settlementCurrency?: string;
  /** Page-level Base ↔ Customer view-mode toggle. */
  viewMode?: 'base' | 'customer';
  /** Wired from QuoteDetails — opens the Currency Configurator modal. */
  onOpenCurrencyConfig?: () => void;
  /** Called when a material field changes (customer, ship to, bill to, expiry, payment terms) */
  onMaterialChange?: (fieldKey: string, fieldLabel: string, oldValue?: string, newValue?: string) => void;
  /** Called when a non-material field changes (sales rep, payment method, contact) */
  onNonMaterialChange?: (fieldKey: string, fieldLabel: string, oldValue?: string, newValue?: string) => void;
  /** Called when an attachment/instruction changes (prompt user) */
  onAskUserChange?: (fieldKey: string, fieldLabel: string, changeDescription: string) => void;
}

export function RightSidebar({
  subtotal = 87000,
  pricingRules = 7425,
  adjustments = 1700,
  adjustmentCount = 4,
  pricingRuleCount = 3,
  grandTotal = 81275,
  activeTab,
  onNavigateToTab,
  quoteStatus = 'sent',
  expiryDate: propExpiryDate,
  createdDate: propCreatedDate,
  readOnly = false,
  customerName: propCustomerName = 'Unknown Customer',
  contactName: propContactName = 'Unknown Contact',
  salesRep: _propSalesRep,
  customerCurrency,
  settlementCurrency,
  viewMode = 'base',
  onOpenCurrencyConfig,
  onMaterialChange,
  onNonMaterialChange,
  onAskUserChange,
}: RightSidebarProps) {
  // ── Collapse state (sub-sections) ──
  const [showAddressDetail, setShowAddressDetail] = useState(false);
  const [showPaymentShipping, setShowPaymentShipping] = useState(false);
  const [showManageAdjustmentsModal, setShowManageAdjustmentsModal] = useState(false);

  // ── Sidebar card collapse state ──
  const [customerCollapsed, setCustomerCollapsed] = useState(false);
  const [quoteSummaryCollapsed, setQuoteSummaryCollapsed] = useState(false);
  const [timelineCollapsed, setTimelineCollapsed] = useState(false);
  const [salesRepCollapsed, setSalesRepCollapsed] = useState(false);
  const [showPricingRulesManageModal, setShowPricingRulesManageModal] = useState(false);
  const [showAddQuoteLevelAdjModal, setShowAddQuoteLevelAdjModal] = useState(false);

  // ── Sidebar section highlight animation state ──
  const [highlightSection, setHighlightSection] = useState<string | null>(null);
  const highlightTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerHighlight = useCallback((section: string) => {
    setHighlightSection(section);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setHighlightSection(null), 2000);
  }, []);
  const getHighlightStyle = (section: string): CSSProperties => {
    if (highlightSection !== section) return {};
    return {
      animation: 'sidebarHighlight 2s ease-out',
      boxShadow: '0 0 0 2px rgba(59,130,246,0.15)',
      borderRadius: '6px',
    };
  };

  // ── Live pricing rules state (updated by PricingRulesManageModal) ──
  const [livePricingRulesAmount, setLivePricingRulesAmount] = useState(pricingRules);
  const [livePricingRuleCount, setLivePricingRuleCount] = useState(pricingRuleCount);
  const handlePricingRulesChange = useCallback((totalAmount: number, ruleCount: number) => {
    setLivePricingRulesAmount(totalAmount);
    setLivePricingRuleCount(ruleCount);
    triggerHighlight('pricingRules');
  }, [triggerHighlight]);

  // ── Dates state ──
  const [requestDate, setRequestDate] = useState(new Date(2026, 0, 28));
  const [respondDate, setRespondDate] = useState(new Date(2026, 1, 16));
  // If quote has already been sent and no explicit effective date was set, resolve to sent date
  const [effectiveDate, setEffectiveDate] = useState<Date | null>(
    (quoteStatus === 'sent' || quoteStatus === 'confirmed' || quoteStatus === 'converted' || quoteStatus === 'expired')
      ? new Date(2026, 1, 10) // resolved from "When sent" to the sent date
      : null
  );
  // Track whether effective date was auto-resolved from "When sent"
  const [effectiveAutoResolved, setEffectiveAutoResolved] = useState(
    (quoteStatus === 'sent' || quoteStatus === 'confirmed' || quoteStatus === 'converted' || quoteStatus === 'expired')
  );
  const [expiryDate, setExpiryDate] = useState(propExpiryDate || new Date(2026, 1, 28));
  const [editingDateType, setEditingDateType] = useState<DateKey | null>(null);

  // ── Lifecycle milestone dates ──
  const [sentDate, setSentDate] = useState<Date | null>(
    (quoteStatus === 'sent' || quoteStatus === 'confirmed' || quoteStatus === 'converted' || quoteStatus === 'expired')
      ? new Date(2026, 1, 10) : null
  );
  const [confirmedDate, setConfirmedDate] = useState<Date | null>(
    (quoteStatus === 'confirmed' || quoteStatus === 'converted')
      ? new Date(2026, 1, 14) : null
  );
  const [convertedDate, setConvertedDate] = useState<Date | null>(
    quoteStatus === 'converted' ? new Date(2026, 1, 16) : null
  );
  const createdDate = propCreatedDate || new Date(2026, 1, 5);

  // ── Mock line-item-derived dates ──
  const shipByDate = new Date(2026, 3, 15); // earliest ship date from items
  const deliveryRangeStart = new Date(2026, 3, 22);
  const deliveryRangeEnd = new Date(2026, 4, 10);

  // Update milestone dates when status changes
  useEffect(() => {
    const now = new Date();
    if ((quoteStatus === 'sent' || quoteStatus === 'confirmed' || quoteStatus === 'converted' || quoteStatus === 'expired') && !sentDate) {
      setSentDate(now);
      // When sent, set effective date to now if it was "When sent"
      if (!effectiveDate) {
        setEffectiveDate(now);
        setEffectiveAutoResolved(true);
      }
    }
    if ((quoteStatus === 'confirmed' || quoteStatus === 'converted') && !confirmedDate) {
      setConfirmedDate(now);
    }
    if (quoteStatus === 'converted' && !convertedDate) {
      setConvertedDate(now);
    }
  }, [quoteStatus]);

  // ── Customer state ──
  const [customerName, setCustomerName] = useState(propCustomerName);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [pendingCustomerSelection, setPendingCustomerSelection] = useState<{
    customerId: string;
    customerName: string;
    contactName: string;
    contactId?: string;
    contactInitials?: string;
    contactTitle?: string;
    locations: { id: string; name: string; city: string; address: string; isDefault: boolean }[];
    isSameCustomer: boolean;
  } | null>(null);
  const [pendingChange, setPendingChange] = useState<{
    newCustomerName: string;
    newLocation: string;
    newContactName: string;
    isSameCustomer: boolean;
  } | null>(null);

  // ── Contact / POC ──
  const [contactName, setContactName] = useState(propContactName);
  const [pocs, setPocs] = useState(INITIAL_POCS);
  const [showRecipientsModal, setShowRecipientsModal] = useState(false);
  const [recipientsEditTarget, setRecipientsEditTarget] = useState<'primary' | 'pocs'>('primary');

  // ── Sales Rep ──
  const [selectedSalesReps, setSelectedSalesReps] = useState<SelectedSalesRep[]>([
    { id: 'rep1', name: 'Sarah Chen', initials: 'SC', isPrimary: true, isCurrentUser: true, isCustomerDefault: false },
    { id: 'rep2', name: 'Mike Johnson', initials: 'MJ', isPrimary: false, isCurrentUser: false, isCustomerDefault: false },
    { id: 'rep3', name: 'Emily Williams', initials: 'EW', isPrimary: false, isCurrentUser: false, isCustomerDefault: true },
  ]);
  const [showSalesRepModal, setShowSalesRepModal] = useState(false);

  // ── Address ──
  const [billingAddress, setBillingAddress] = useState({
    id: 'addr1', label: 'Headquarters', street: '6145 Logistics Center Blvd', city: 'Rockford', state: 'IL', zip: '61101', country: 'United States', isDefault: true,
  });
  const [shippingAddress, setShippingAddress] = useState({
    id: 'addr2', label: 'Main Depot', street: '4200 Industrial Blvd, Suite 300', city: 'Houston', state: 'TX', zip: '77073', country: 'United States', isDefault: false,
  });
  const [addressModalType, setAddressModalType] = useState<'billing' | 'shipping' | null>(null);

  // ── Payment ──
  const [paymentTerms, setPaymentTerms] = useState({ id: 'net30', name: 'Net 30' });
  const [showPaymentTermsModal, setShowPaymentTermsModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState({ id: 'ach', name: 'ACH/Direct Deposit', icon: 'CreditCard' as const });
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
  const [shippingMethod] = useState({ name: 'Courier Pickup', carrier: 'FedEx' });

  // ── Derived ──
  const today = new Date(2026, 1, 16);
  const respondDiff = Math.ceil((respondDate.getTime() - today.getTime()) / 86400000);
  const expiryDiff = Math.ceil((expiryDate.getTime() - today.getTime()) / 86400000);
  const respondOverdue = respondDiff < 0;
  const respondDueToday = respondDiff === 0;
  const respondDueSoon = respondDiff > 0 && respondDiff <= 7;
  const expiryPast = expiryDiff < 0;
  const expiryDueSoon = expiryDiff >= 0 && expiryDiff <= 14;
  const shipByDiff = Math.ceil((shipByDate.getTime() - today.getTime()) / 86400000);
  const shipByNear = shipByDiff >= 0 && shipByDiff <= 14;
  const shipByPast = shipByDiff < 0;
  // Editable until Converted to SO (then read-only; can only duplicate or cancel)
  const canEdit = !readOnly && quoteStatus !== 'converted' && quoteStatus !== 'cancelled' && quoteStatus !== 'archived' && quoteStatus !== 'expired';
  const datesEditable = canEdit;

  // ── Formatters ──
  const fmtShort = (d: Date) => `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
  const fmtFull = (d: Date) => `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
  const pl = (n: number, w: string) => `${Math.abs(n)} ${w}${Math.abs(n) === 1 ? '' : 's'}`;

  // ── Status pill — context-aware, actionable copy ──
  const getStatusPill = (): { text: string; color: string; bg: string; icon: 'clock' | 'alert' } | null => {
    if (quoteStatus === 'confirmed' || quoteStatus === 'converted') return null;

    if (quoteStatus === 'expired') {
      return { text: `Quote expired ${pl(Math.abs(expiryDiff), 'day')} ago — reactivate to resume`, color: '#D97706', bg: '#FEF3C7', icon: 'alert' as const };
    }

    if (quoteStatus === 'draft') {
      if (respondDiff > 7) return { text: `Respond by ${fmtShort(respondDate)}`, color: '#3B82F6', bg: '#F0F7FF', icon: 'clock' };
      if (respondDiff > 0) return { text: `Response due in ${pl(respondDiff, 'day')}`, color: '#D97706', bg: '#FFFBEB', icon: 'clock' };
      if (respondDueToday) return { text: 'Response due today — send now', color: '#EA580C', bg: '#FFF7ED', icon: 'alert' };
      return { text: `Response overdue by ${pl(respondDiff, 'day')}`, color: '#DC2626', bg: '#FEF2F2', icon: 'alert' };
    }

    // sent
    if (respondOverdue) return { text: `Response overdue by ${pl(respondDiff, 'day')}`, color: '#DC2626', bg: '#FEF2F2', icon: 'alert' };
    if (respondDueToday) return { text: 'Response due today', color: '#EA580C', bg: '#FFF7ED', icon: 'alert' };
    if (respondDueSoon) return { text: `Response due in ${pl(respondDiff, 'day')}`, color: '#D97706', bg: '#FFFBEB', icon: 'clock' };
    if (expiryPast) return { text: `Quote expired ${pl(expiryDiff, 'day')} ago`, color: '#DC2626', bg: '#FEF2F2', icon: 'alert' };
    if (expiryDiff <= 14) return { text: `Quote expires in ${pl(expiryDiff, 'day')}`, color: '#D97706', bg: '#FFFBEB', icon: 'clock' };
    return { text: `Valid for ${pl(expiryDiff, 'day')}`, color: '#3B82F6', bg: '#F0F7FF', icon: 'clock' };
  };
  const statusPill = getStatusPill();

  // ── Date modal helpers ──
  const dateFmtForModal = (d: Date) => {
    const dd = d.getDate().toString().padStart(2, '0');
    const mm = (d.getMonth() + 1).toString().padStart(2, '0');
    return `${dd}/${mm}/${d.getFullYear()}`;
  };

  const getModalConfig = (key: DateKey) => {
    const editableKeys: DateKey[] = ['request', 'respond', 'effective', 'expiry'];
    if (!editableKeys.includes(key)) return { dateType: 'absolute', absoluteValue: '', relativeValue: '7', relativeUnit: 'days', whenSent: false };
    const map: Record<string, Date | null> = { request: requestDate, respond: respondDate, effective: effectiveDate, expiry: expiryDate };
    const d = map[key];
    return {
      dateType: key === 'effective' && !d ? 'relative' : 'absolute',
      absoluteValue: d ? dateFmtForModal(d) : '',
      relativeValue: '7',
      relativeUnit: 'days',
      whenSent: key === 'effective' && !d,
    };
  };

  const handleDateSave = (key: DateKey, config: any) => {
    if (key === 'effective' && config.whenSent) {
      setEffectiveDate(null);
      setEffectiveAutoResolved(false);
      setEditingDateType(null);
      toast.success('Effective date set to "When sent"', { position: 'top-right' });
      return;
    }
    let nd: Date | null = null;
    if (config.absoluteValue) {
      const parts = config.absoluteValue.split(' ')[0].split('/');
      if (parts.length === 3) {
        nd = new Date(+parts[2], +parts[1] - 1, +parts[0]);
        if (isNaN(nd.getTime())) nd = null;
      }
    } else if (config.relativeValue && config.relativeUnit) {
      nd = new Date(today);
      const v = parseInt(config.relativeValue);
      if (config.relativeUnit === 'days') nd.setDate(nd.getDate() + v);
      else if (config.relativeUnit === 'weeks') nd.setDate(nd.getDate() + v * 7);
      else if (config.relativeUnit === 'months') nd.setMonth(nd.getMonth() + v);
    }
    if (nd) {
      const labels: Record<string, string> = { request: 'Request date', respond: 'Respond by date', effective: 'Effective date', expiry: 'Expires on date' };
      const fmtDate = (d: Date) => `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
      const oldDate = ({ request: requestDate, respond: respondDate, effective: effectiveDate, expiry: expiryDate } as any)[key];
      ({ request: setRequestDate, respond: setRespondDate, effective: setEffectiveDate, expiry: setExpiryDate } as any)[key]?.(nd);
      // Clear auto-resolved flag when user explicitly sets effective date
      if (key === 'effective') {
        setEffectiveAutoResolved(false);
      }
      toast.success(`${labels[key] || 'Date'} updated`, { position: 'top-right' });
      // Expiry and respond-by are material changes
      if (key === 'expiry') {
        onMaterialChange?.('expiry_date', 'Expiry Date', oldDate ? fmtDate(oldDate) : '—', fmtDate(nd));
      } else if (key === 'respond') {
        onMaterialChange?.('due_by_date', 'Respond-By Date', oldDate ? fmtDate(oldDate) : '—', fmtDate(nd));
      }
    }
    setEditingDateType(null);
  };

  // ── Customer visual ──
  const customerInitials = customerName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const custColor = getPoCColor(customerInitials);

  // ── Timeline entries — dynamic based on status ──
  const buildTimelineEntries = () => {
    const entries: { key: DateKey; label: string; value: string; color: string; dotColor: string; dotFill?: boolean; editable?: boolean }[] = [];

    // Request Date — customer requests before quote is created (earliest)
    entries.push({
      key: 'request', label: 'Request Date', value: fmtShort(requestDate),
      color: '#6B7280', dotColor: '#D1D5DB',
    });

    // Created — always shown, never editable
    entries.push({
      key: 'created', label: 'Created', value: fmtShort(createdDate),
      color: '#6B7280', dotColor: '#D1D5DB', dotFill: true, editable: false,
    });

    // Respond By — only shown in draft state (when sent, it's considered responded)
    if (quoteStatus === 'draft') {
      // Only highlight if due soon (≤7 days), due today, or overdue
      const respondNeedsAttention = respondOverdue || respondDueToday || respondDueSoon;
      entries.push({
        key: 'respond', label: 'Respond By',
        value: fmtShort(respondDate),
        color: respondOverdue ? '#DC2626' : respondDueToday ? '#EA580C' : respondDueSoon ? '#D97706' : '#6B7280',
        dotColor: respondNeedsAttention ? (respondOverdue ? '#EF4444' : '#F59E0B') : '#D1D5DB',
      });
    }

    // Effective From — shown in draft/sent (but not when confirmed)
    if (quoteStatus === 'draft' || quoteStatus === 'sent') {
      const effValue = effectiveDate
        ? (effectiveAutoResolved ? `${fmtShort(effectiveDate)}*` : fmtShort(effectiveDate))
        : 'When sent';
      entries.push({
        key: 'effective', label: 'Effective From',
        value: effValue,
        color: '#6B7280', dotColor: '#D1D5DB',
      });
    }

    // Sent On — shown when status >= sent (historical milestone, no highlight)
    if (sentDate && (quoteStatus === 'sent' || quoteStatus === 'confirmed' || quoteStatus === 'converted' || quoteStatus === 'expired')) {
      entries.push({
        key: 'sentOn', label: 'Sent On', value: fmtShort(sentDate),
        color: '#6B7280', dotColor: '#D1D5DB', dotFill: true, editable: false,
      });
    }

    // Confirmed On — shown when confirmed or converted (historical milestone)
    if (confirmedDate && (quoteStatus === 'confirmed' || quoteStatus === 'converted')) {
      entries.push({
        key: 'confirmedOn', label: 'Confirmed On', value: fmtShort(confirmedDate),
        color: '#6B7280', dotColor: '#D1D5DB', dotFill: true, editable: false,
      });
    }

    // Converted On — shown when converted (historical milestone)
    if (convertedDate && quoteStatus === 'converted') {
      entries.push({
        key: 'convertedOn', label: 'Converted On', value: fmtShort(convertedDate),
        color: '#6B7280', dotColor: '#D1D5DB', dotFill: true, editable: false,
      });
    }

    // Ship By — only highlight if near (≤14 days) or past
    entries.push({
      key: 'shipBy', label: 'Ship By', value: fmtShort(shipByDate),
      color: shipByPast ? '#DC2626' : shipByNear ? '#D97706' : '#6B7280',
      dotColor: shipByPast ? '#EF4444' : shipByNear ? '#F59E0B' : '#D1D5DB',
      editable: false,
    });

    // Expected Delivery — shown when confirmed or converted
    if (quoteStatus === 'confirmed' || quoteStatus === 'converted') {
      entries.push({
        key: 'delivery', label: 'Est. Delivery',
        value: `${fmtShort(deliveryRangeStart)} – ${fmtShort(deliveryRangeEnd)}`,
        color: '#6B7280', dotColor: '#D1D5DB', editable: false,
      });
    }

    // Expires On — only highlight if near (≤14 days) or past
    entries.push({
      key: 'expiry', label: 'Expires On', value: fmtShort(expiryDate),
      color: expiryPast ? '#DC2626' : expiryDueSoon ? '#D97706' : '#6B7280',
      dotColor: expiryPast ? '#EF4444' : expiryDueSoon ? '#F59E0B' : '#D1D5DB',
    });

    return entries;
  };

  const dateEntries = buildTimelineEntries();

  // ── Card style (PO-style — Collapsible section wrapper) ──
  const cardStyle: CSSProperties = {
    backgroundColor: 'var(--card)',
    borderRadius: 'var(--radius-lg, 10px)',
    borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border)',
    boxShadow: 'var(--elevation-1, 0 1px 3px rgba(0,0,0,0.06))',
    padding: '4px 16px 12px',
    overflow: 'hidden',
  };

  // ── Adjustment data-aware flags ──
  const hasAdjustments = adjustmentCount > 0;
  const hasPricingRules = livePricingRuleCount > 0;

  // Net adjustment color: positive (premium) = red, negative (discount) = green
  const adjustmentNet = adjustments; // positive = premium net, displayed as +
  const pricingRulesNet = -livePricingRulesAmount; // pricing rules reduce price

  // Compute live grand total
  const liveGrandTotal = subtotal - livePricingRulesAmount - adjustments;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', position: 'sticky', top: '24px', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <style>{`
        @keyframes sidebarHighlight {
          0% { background-color: #DBEAFE; }
          30% { background-color: #EFF6FF; }
          100% { background-color: transparent; }
        }
      `}</style>

      {/* ═══════ 1. CUSTOMER INFORMATION ═══════ */}
      <div style={cardStyle}>
        <SectionHeader icon={Users} label="Customer Information" collapsed={customerCollapsed} onToggle={() => setCustomerCollapsed(!customerCollapsed)} />

        {!customerCollapsed && <>
        <div style={{ borderTop: '1px solid var(--border)' }} />
        <HoverEditRow editable={canEdit} onEdit={() => setShowCustomerModal(true)}
          style={{ padding: '8px 10px', borderRadius: '6px', margin: '0 -4px 8px -4px', border: '1px solid transparent' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingRight: canEdit ? '28px' : '0' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              backgroundColor: custColor.bg, color: custColor.text,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '12px', fontWeight: 700, flexShrink: 0,
            }}>{customerInitials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#1F2937', lineHeight: '1.2', display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{customerName}</span>
                {customerCurrency && (() => {
                  const cur = getLibraryCurrency(customerCurrency);
                  const sym = cur?.symbol ?? customerCurrency;
                  return (
                    <span
                      title={`Customer's primary currency · ${cur?.name ?? customerCurrency}`}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '3px',
                        padding: '1px 6px', borderRadius: '999px',
                        backgroundColor: '#F1F5F9', color: '#475569',
                        fontSize: '10px', fontWeight: 600, flexShrink: 0,
                        cursor: 'help',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {sym} {customerCurrency.toUpperCase()}
                    </span>
                  );
                })()}
              </div>
              <div style={{ fontSize: '11px', color: '#9CA3AF', lineHeight: '1', marginTop: '3px' }}>Customer</div>
            </div>
          </div>
        </HoverEditRow>

        {/* Point of Contacts Heading */}
        <div style={{ 
          fontSize: '11px', 
          fontWeight: 600, 
          color: '#6B7280', 
          textTransform: 'uppercase', 
          letterSpacing: '0.4px',
          marginBottom: '8px',
        }}>
          Point of Contacts
        </div>

        {/* Primary Contact + POCs — grouped, single edit action */}
        <HoverEditRow editable={canEdit} onEdit={() => { setRecipientsEditTarget('primary'); setShowRecipientsModal(true); }}
          style={{ padding: '8px 10px', borderRadius: '6px', margin: '0 -4px 8px -4px', backgroundColor: '#F9FAFB', border: '1px solid #F3F4F6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingRight: canEdit ? '28px' : '0' }}>
            {/* Primary contact avatar */}
            {(() => {
              const contactInitials = contactName.split(' ').map(w => w[0]).join('').slice(0, 2);
              const c = getPoCColor(contactInitials);
              return (
                <div style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  backgroundColor: c.bg, color: c.text,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '10px', fontWeight: 600, flexShrink: 0,
                  borderWidth: '2px', borderStyle: 'solid', borderColor: '#3B82F6',
                }}>{contactInitials}</div>
              );
            })()}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#1F2937', lineHeight: '1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {contactName}
                </span>
                <span style={{
                  fontSize: '9px', fontWeight: 600, color: '#1E40AF', backgroundColor: '#DBEAFE',
                  padding: '1px 5px', borderRadius: '3px', flexShrink: 0, lineHeight: '1.4',
                  textTransform: 'uppercase', letterSpacing: '0.3px',
                }}>Primary</span>
              </div>
              {/* Secondary POC avatars inline */}
              {pocs.length > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0', marginTop: '5px' }}>
                  {pocs.slice(1, 4).map((poc, idx) => {
                    const c = getPoCColor(poc.initials);
                    return (
                      <div key={poc.id} title={`${poc.name} · ${poc.title}`} style={{
                        width: '20px', height: '20px', borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '8px', fontWeight: 600,
                        backgroundColor: c.bg, color: c.text,
                        borderWidth: '1.5px', borderStyle: 'solid', borderColor: '#F9FAFB',
                        marginLeft: idx > 0 ? '-4px' : '0',
                        position: 'relative', zIndex: 5 - idx, flexShrink: 0,
                      }}>{poc.initials}</div>
                    );
                  })}
                  {pocs.length > 4 && (
                    <div style={{
                      width: '20px', height: '20px', borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '8px', fontWeight: 600,
                      backgroundColor: '#E5E7EB', color: '#6B7280',
                      borderWidth: '1.5px', borderStyle: 'solid', borderColor: '#F9FAFB',
                      marginLeft: '-4px', position: 'relative', zIndex: 0, flexShrink: 0,
                    }}>+{pocs.length - 4}</div>
                  )}
                  <span style={{ fontSize: '11px', color: '#9CA3AF', marginLeft: '5px', lineHeight: '1', whiteSpace: 'nowrap' }}>
                    +{pocs.length - 1} more
                  </span>
                </div>
              )}
            </div>
          </div>
        </HoverEditRow>

        <div style={{ borderBottom: '1px solid var(--border)', margin: '8px 0 0' }} />

        {/* ── Addresses — SO V5 SubsectionHeader pattern ── */}
        <SubsectionHeader
          icon={MapPinned}
          label="Shipping / Billing Locations"
          expanded={showAddressDetail}
          onToggle={() => setShowAddressDetail(!showAddressDetail)}
        />

        {showAddressDetail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px 0 4px 0' }}>
            {/* Billing Address */}
            {billingAddress.street ? (
              <HoverEditRow editable={canEdit} onEdit={() => setAddressModalType('billing')}
                style={{ borderRadius: '6px', border: '1px solid #E5E7EB', overflow: 'hidden' }}>
                <div style={{ display: 'flex' }}>
                  <div style={{ width: '3px', flexShrink: 0, backgroundColor: '#3B82F6' }} />
                  <div style={{ flex: 1, padding: '10px 12px', paddingRight: canEdit ? '32px' : '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
                      <MapPinned style={{ width: '12px', height: '12px', color: '#9CA3AF' }} />
                      <span style={{ fontSize: '10px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Bill To</span>
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#1F2937', lineHeight: '1.3', marginBottom: '4px' }}>{billingAddress.label}</div>
                    <div style={{ fontSize: '12px', color: '#6B7280', lineHeight: '1.4' }}>{billingAddress.street}</div>
                    <div style={{ fontSize: '12px', color: '#6B7280', lineHeight: '1.4' }}>{billingAddress.city}, {billingAddress.state} {billingAddress.zip}</div>
                  </div>
                </div>
              </HoverEditRow>
            ) : (
              <div
                onClick={() => canEdit && setAddressModalType('billing')}
                style={{
                  borderRadius: '6px', overflow: 'hidden', cursor: canEdit ? 'pointer' : 'default',
                  borderWidth: '1px', borderStyle: 'dashed', borderColor: '#D1D5DB',
                  display: 'flex', transition: 'all 150ms',
                }}
                onMouseEnter={e => { if (canEdit) { e.currentTarget.style.borderColor = '#93C5FD'; e.currentTarget.style.backgroundColor = '#F0F7FF'; }}}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <div style={{ width: '3px', flexShrink: 0, backgroundColor: '#93C5FD' }} />
                <div style={{ flex: 1, padding: '14px 12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#EFF6FF',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <MapPinned style={{ width: '14px', height: '14px', color: '#93C5FD' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '3px' }}>Bill To</div>
                    <div style={{ fontSize: '12px', color: '#9CA3AF', lineHeight: '1.3' }}>
                      {canEdit ? 'Click to assign billing address' : 'No billing address assigned'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Shipping Address */}
            {shippingAddress.street ? (
              <HoverEditRow editable={canEdit} onEdit={() => setAddressModalType('shipping')}
                style={{ borderRadius: '6px', border: '1px solid #E5E7EB', overflow: 'hidden' }}>
                <div style={{ display: 'flex' }}>
                  <div style={{ width: '3px', flexShrink: 0, backgroundColor: '#F59E0B' }} />
                  <div style={{ flex: 1, padding: '10px 12px', paddingRight: canEdit ? '32px' : '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
                      <MapPinned style={{ width: '12px', height: '12px', color: '#9CA3AF' }} />
                      <span style={{ fontSize: '10px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Ship To</span>
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#1F2937', lineHeight: '1.3', marginBottom: '4px' }}>{shippingAddress.label}</div>
                    <div style={{ fontSize: '12px', color: '#6B7280', lineHeight: '1.4' }}>{shippingAddress.street}</div>
                    <div style={{ fontSize: '12px', color: '#6B7280', lineHeight: '1.4' }}>{shippingAddress.city}, {shippingAddress.state} {shippingAddress.zip}</div>
                  </div>
                </div>
              </HoverEditRow>
            ) : (
              <div
                onClick={() => canEdit && setAddressModalType('shipping')}
                style={{
                  borderRadius: '6px', overflow: 'hidden', cursor: canEdit ? 'pointer' : 'default',
                  borderWidth: '1px', borderStyle: 'dashed', borderColor: '#D1D5DB',
                  display: 'flex', transition: 'all 150ms',
                }}
                onMouseEnter={e => { if (canEdit) { e.currentTarget.style.borderColor = '#FCD34D'; e.currentTarget.style.backgroundColor = '#FFFBEB'; }}}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <div style={{ width: '3px', flexShrink: 0, backgroundColor: '#FCD34D' }} />
                <div style={{ flex: 1, padding: '14px 12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#FFFBEB',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Truck style={{ width: '14px', height: '14px', color: '#FCD34D' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '3px' }}>Ship To</div>
                    <div style={{ fontSize: '12px', color: '#9CA3AF', lineHeight: '1.3' }}>
                      {canEdit ? 'Click to assign shipping address' : 'No shipping address assigned'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ borderBottom: '1px solid var(--border)', margin: '0' }} />

        {/* ── Payment & Shipping — SO V5 SubsectionHeader pattern ── */}
        <SubsectionHeader
          icon={CreditCard}
          label="Payment & Shipping"
          expanded={showPaymentShipping}
          onToggle={() => setShowPaymentShipping(!showPaymentShipping)}
        />

        {showPaymentShipping && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0', padding: '4px 0 2px 0' }}>
            <HoverEditRow editable={canEdit} onEdit={() => setShowPaymentTermsModal(true)}
              style={{ padding: '8px 10px', margin: '0 -4px', borderRadius: '6px', border: '1px solid transparent' }}>
              <div style={{ paddingRight: canEdit ? '28px' : '0' }}>
                <div style={{ fontSize: '11px', fontWeight: 500, color: '#9CA3AF', lineHeight: '1', marginBottom: '5px' }}>Payment Terms</div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#1F2937', lineHeight: '1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{paymentTerms.name}</div>
              </div>
            </HoverEditRow>
            <div style={{ height: '1px', backgroundColor: '#F3F4F6', margin: '0 6px' }} />

            <HoverEditRow editable={canEdit} onEdit={() => setShowPaymentMethodModal(true)}
              style={{ padding: '8px 10px', margin: '0 -4px', borderRadius: '6px', border: '1px solid transparent' }}>
              <div style={{ paddingRight: canEdit ? '28px' : '0' }}>
                <div style={{ fontSize: '11px', fontWeight: 500, color: '#9CA3AF', lineHeight: '1', marginBottom: '5px' }}>Payment Method</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', overflow: 'hidden' }}>
                  <CreditCard style={{ width: '12px', height: '12px', color: '#3B82F6', flexShrink: 0 }} />
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#1F2937', lineHeight: '1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{paymentMethod.name}</span>
                </div>
              </div>
            </HoverEditRow>
            <div style={{ height: '1px', backgroundColor: '#F3F4F6', margin: '0 6px' }} />

            <HoverEditRow editable={canEdit} onEdit={() => toast.info('Shipping method editor coming soon', { position: 'top-right' })}
              style={{ padding: '8px 10px', margin: '0 -4px', borderRadius: '6px', border: '1px solid transparent' }}>
              <div style={{ paddingRight: canEdit ? '28px' : '0' }}>
                <div style={{ fontSize: '11px', fontWeight: 500, color: '#9CA3AF', lineHeight: '1', marginBottom: '5px' }}>Shipping Method</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', overflow: 'hidden' }}>
                  <Truck style={{ width: '12px', height: '12px', color: '#3B82F6', flexShrink: 0 }} />
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#1F2937', lineHeight: '1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shippingMethod.name}</span>
                  <span style={{ fontSize: '11px', color: '#9CA3AF', lineHeight: '1', flexShrink: 0 }}>· {shippingMethod.carrier}</span>
                </div>
              </div>
            </HoverEditRow>
          </div>
        )}

        </>}
      </div>

      {/* ═══════ 2. QUOTE SUMMARY ═══════ */}
      <div style={{ ...cardStyle }}>
        <SectionHeader icon={DollarSign} label="Quote Summary" collapsed={quoteSummaryCollapsed} onToggle={() => setQuoteSummaryCollapsed(!quoteSummaryCollapsed)} />

        {!quoteSummaryCollapsed && <><div style={{ borderTop: '1px solid var(--border)' }} /><div style={{ display: 'flex', flexDirection: 'column', padding: '0 0 12px' }}>
          {/* Currency block — what customer pays in / billed in / base equivalent + rate type. */}
          <CurrencySummaryBlock
            customerCurrency={customerCurrency}
            settlementCurrency={settlementCurrency}
            quoteStatus={quoteStatus}
            createdDate={propCreatedDate}
            onOpenCurrencyConfig={onOpenCurrencyConfig}
          />

          {/* Subtotal */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 0',
            borderBottomWidth: '1px', borderBottomStyle: 'dashed', borderBottomColor: '#E5E7EB',
          }}>
            <span style={{ fontSize: '13px', color: '#1F2937', fontWeight: 500, lineHeight: '1' }}>
              Subtotal <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(5 items)</span>
            </span>
            <span style={{ fontSize: '13px', color: '#1F2937', fontWeight: 600, lineHeight: '1' }}>
              <QuoteMoney valuePKR={subtotal} customerCurrency={customerCurrency} view={viewMode} />
            </span>
          </div>

          {/* Pricing Rules Applied sub-section */}
          <div style={{
            padding: '12px 0',
            borderBottomWidth: '1px', borderBottomStyle: 'dashed', borderBottomColor: '#E5E7EB',
            ...getHighlightStyle('pricingRules'),
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: '#6B7280', fontWeight: 400, lineHeight: '1' }}>
                Pricing Rules Applied
              </span>
              <span style={{ fontSize: '13px', color: pricingRulesNet >= 0 ? '#DC2626' : '#059669', fontWeight: 500, lineHeight: '1' }}>
                <span style={{ marginRight: 2 }}>{pricingRulesNet >= 0 ? '+' : '-'}</span>
                <QuoteMoney valuePKR={Math.abs(pricingRulesNet)} customerCurrency={customerCurrency} view={viewMode} />
              </span>
            </div>
            {hasPricingRules ? (
              <SummaryInfoRow
                label={`${livePricingRuleCount} rules · applied to 5 items`}
                onClick={() => setShowPricingRulesManageModal(true)}
              />
            ) : canEdit ? (
              <button
                onClick={() => setShowPricingRulesManageModal(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  marginTop: '7px', padding: '5px 8px',
                  borderRadius: '5px', cursor: 'pointer',
                  borderWidth: '1px', borderStyle: 'dashed', borderColor: '#BFDBFE',
                  backgroundColor: '#FFFFFF',
                  fontSize: '11px', fontWeight: 500, color: '#1B6EF3',
                  lineHeight: '1', transition: 'all 150ms',
                  fontFamily: 'Inter, system-ui, sans-serif',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F0F7FF'; e.currentTarget.style.borderColor = '#93C5FD'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; e.currentTarget.style.borderColor = '#BFDBFE'; }}
              >
                <Plus style={{ width: '11px', height: '11px' }} />
                Add pricing rule
              </button>
            ) : null}
          </div>

          {/* One-Time Discounts/Premiums sub-section (renamed from Adjustments) */}
          <div style={{ padding: '12px 0', ...getHighlightStyle('adjustments') }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: '#6B7280', fontWeight: 400, lineHeight: '1' }}>One-Time Discounts/Premiums</span>
              <span style={{ fontSize: '13px', color: adjustmentNet > 0 ? '#DC2626' : adjustmentNet < 0 ? '#059669' : '#6B7280', fontWeight: 500, lineHeight: '1' }}>
                <span style={{ marginRight: 2 }}>{adjustmentNet > 0 ? '+' : adjustmentNet < 0 ? '-' : ''}</span>
                <QuoteMoney valuePKR={Math.abs(adjustmentNet)} customerCurrency={customerCurrency} view={viewMode} />
              </span>
            </div>
            {hasAdjustments ? (
              <SummaryInfoRow
                label={`${adjustmentCount} discounts/premiums · 2 quote-level`}
                onClick={() => setShowManageAdjustmentsModal(true)}
              />
            ) : canEdit ? (
              <button
                onClick={() => setShowAddQuoteLevelAdjModal(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  marginTop: '7px', padding: '5px 8px',
                  borderRadius: '5px', cursor: 'pointer',
                  borderWidth: '1px', borderStyle: 'dashed', borderColor: '#BFDBFE',
                  backgroundColor: '#FFFFFF',
                  fontSize: '11px', fontWeight: 500, color: '#1B6EF3',
                  lineHeight: '1', transition: 'all 150ms',
                  fontFamily: 'Inter, system-ui, sans-serif',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F0F7FF'; e.currentTarget.style.borderColor = '#93C5FD'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; e.currentTarget.style.borderColor = '#BFDBFE'; }}
              >
                <Plus style={{ width: '11px', height: '11px' }} />
                Add quote-level discount/premium
              </button>
            ) : null}
          </div>

          {/* Grand Total */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '14px 0 4px 0',
            marginTop: '4px',
            borderTopWidth: '1px', borderTopStyle: 'solid', borderTopColor: '#E5E7EB',
          }}>
            <span style={{ fontSize: '14px', color: '#1F2937', fontWeight: 600, lineHeight: '1' }}>Grand Total</span>
            <span style={{ fontSize: '16px', color: '#1F2937', fontWeight: 700, lineHeight: '1' }}>
              <QuoteMoney valuePKR={liveGrandTotal} customerCurrency={customerCurrency} view={viewMode} />
            </span>
          </div>
        </div></>}
      </div>

      {/* ═══════ 3. TIMELINE ═══════ */}
      <div style={cardStyle}>
        <SectionHeader icon={CalendarDays} label="Timeline" collapsed={timelineCollapsed} onToggle={() => setTimelineCollapsed(!timelineCollapsed)} />

        {!timelineCollapsed && <>
        <div style={{ borderTop: '1px solid var(--border)' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px 0 12px' }}>
          {dateEntries.map((entry, idx) => (
            <TimelineDateRow
              key={entry.key}
              entry={entry}
              datesEditable={datesEditable}
              onEdit={(key) => {
                // Only open modal for editable date keys
                if (['request', 'respond', 'effective', 'expiry'].includes(key)) {
                  setEditingDateType(key);
                }
              }}
              isLast={idx === dateEntries.length - 1}
            />
          ))}
        </div>

        {/* Status pill */}
        {statusPill && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            marginTop: '10px', padding: '6px 10px', borderRadius: '6px',
            backgroundColor: statusPill.bg,
          }}>
            {statusPill.icon === 'alert'
              ? <AlertCircle style={{ width: '12px', height: '12px', color: statusPill.color }} />
              : <Clock style={{ width: '12px', height: '12px', color: statusPill.color }} />
            }
            <span style={{ fontSize: '11px', fontWeight: 600, lineHeight: '1', color: statusPill.color }}>
              {statusPill.text}
            </span>
          </div>
        )}
        </>}
      </div>

      {/* ═══════ 4. QUOTE INFORMATION ═══════ */}
      <div style={cardStyle}>
        <SectionHeader icon={UserCircle} label="Quote Information" collapsed={salesRepCollapsed} onToggle={() => setSalesRepCollapsed(!salesRepCollapsed)} />

        {!salesRepCollapsed && <>
        <div style={{ borderTop: '1px solid var(--border)' }} />

        {/* Created On / Created By — vertical layout with spacing separators */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '10px' }}>
          <div style={{ padding: '0 6px' }}>
            <div style={{ fontSize: '11px', fontWeight: 500, color: '#9CA3AF', lineHeight: '1', marginBottom: '6px' }}>Created On</div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#1F2937', lineHeight: '1' }}>{fmtFull(createdDate)}</div>
          </div>
          <div style={{ padding: '0 6px' }}>
            <div style={{ fontSize: '11px', fontWeight: 500, color: '#9CA3AF', lineHeight: '1', marginBottom: '6px' }}>Created By</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {(() => {
                const c = getPoCColor('SC');
                return (
                  <div style={{
                    width: '20px', height: '20px', borderRadius: '50%',
                    backgroundColor: c.bg, color: c.text,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '8px', fontWeight: 600, flexShrink: 0,
                  }}>SC</div>
                );
              })()}
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#1F2937', lineHeight: '1' }}>Sarah Chen</span>
            </div>
          </div>
        </div>

        <div style={{ height: '18px' }} />

        {/* Sales Rep sub-heading — smaller label style */}
        <div style={{
          fontSize: '11px', fontWeight: 500, color: '#9CA3AF',
          lineHeight: '1', marginBottom: '8px', padding: '0 6px',
        }}>
          Sales Representatives
        </div>

        {/* Sales rep — compact single line with inline overlay */}
        <div style={{ position: 'relative' }}>
          <HoverEditRow editable={canEdit} onEdit={() => setShowSalesRepModal(true)}
            style={{ padding: '6px 10px', borderRadius: '6px', margin: '0 -4px 0 -4px', backgroundColor: '#F9FAFB', border: '1px solid #F3F4F6' }}>
            {(() => {
              const primary = selectedSalesReps.find(r => r.isPrimary) || selectedSalesReps[0];
              const others = selectedSalesReps.filter(r => r.id !== primary?.id);
              if (!primary) return null;
              const pc = getPoCColor(primary.initials);
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingRight: canEdit ? '28px' : '0', minWidth: 0 }}>
                  {/* Primary avatar */}
                  <div style={{
                    width: '22px', height: '22px', borderRadius: '50%',
                    backgroundColor: pc.bg, color: pc.text,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '8px', fontWeight: 600, flexShrink: 0,
                    borderWidth: '1.5px', borderStyle: 'solid', borderColor: '#3B82F6',
                  }}>{primary.initials}</div>
                  {/* Primary name */}
                  <span style={{ fontSize: '12px', fontWeight: 500, color: '#1F2937', lineHeight: '1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                    {primary.name}{primary.isCurrentUser ? ' (You)' : ''}
                  </span>
                  {/* Secondary avatars stacked inline */}
                  {others.length > 0 && (
                    <>
                      <span style={{ fontSize: '10px', color: '#D1D5DB', lineHeight: '1', flexShrink: 0 }}>·</span>
                      <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                        {others.slice(0, 3).map((rep, idx) => {
                          const c = getPoCColor(rep.initials);
                          return (
                            <div key={rep.id} title={rep.name} style={{
                              width: '18px', height: '18px', borderRadius: '50%',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '7px', fontWeight: 600,
                              backgroundColor: c.bg, color: c.text,
                              borderWidth: '1.5px', borderStyle: 'solid', borderColor: '#F9FAFB',
                              marginLeft: idx > 0 ? '-4px' : '0',
                              position: 'relative', zIndex: 5 - idx, flexShrink: 0,
                            }}>{rep.initials}</div>
                          );
                        })}
                      </div>
                      {others.length > 0 && (
                        <span style={{ fontSize: '10px', color: '#9CA3AF', lineHeight: '1', whiteSpace: 'nowrap', flexShrink: 0 }}>
                          +{others.length}
                        </span>
                      )}
                    </>
                  )}
                </div>
              );
            })()}
          </HoverEditRow>

          {/* Inline upward overlay */}
          {showSalesRepModal && (
            <div style={{
              position: 'absolute',
              bottom: '100%',
              left: '-4px',
              right: '-4px',
              marginBottom: '4px',
              zIndex: 50,
              backgroundColor: '#FFFFFF',
              borderRadius: '8px',
              border: '1px solid #E5E7EB',
              boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
              overflow: 'hidden',
            }}>
              <SalesRepSelector
                availableReps={SIDEBAR_SALES_REPS}
                selectedReps={selectedSalesReps}
                onSelectedRepsChange={(newReps) => {
                  const oldPrimary = selectedSalesReps.find(r => r.isPrimary)?.name || 'None';
                  const newPrimary = newReps.find(r => r.isPrimary)?.name || newReps[0]?.name || 'None';
                  setSelectedSalesReps(newReps);
                  if (oldPrimary !== newPrimary || selectedSalesReps.length !== newReps.length) {
                    onNonMaterialChange?.('assigned_salesperson', 'Sales Representative', oldPrimary, newPrimary);
                  }
                }}
                renderDropdownOnly
                onClose={() => setShowSalesRepModal(false)}
                fullWidth
              />
            </div>
          )}
        </div>
        </>}
      </div>

      {/* ═══════ MODALS ═══════ */}

      {/* Pricing Rules Manage Modal */}
      {showPricingRulesManageModal && (
        <PricingRulesManageModal
          isOpen
          onClose={() => { setShowPricingRulesManageModal(false); triggerHighlight('pricingRules'); }}
          readOnly={readOnly}
          onRulesChange={handlePricingRulesChange}
        />
      )}

      {/* Manage Adjustments Modal */}
      {showManageAdjustmentsModal && (
        <ManageAdjustmentsModal
          isOpen
          onClose={() => { setShowManageAdjustmentsModal(false); triggerHighlight('adjustments'); }}
          readOnly={readOnly}
        />
      )}

      {/* Add Quote-Level Adjustment Modal (direct add, not manage) */}
      <AddQuoteLevelAdjustmentModal
        isOpen={showAddQuoteLevelAdjModal}
        onClose={() => { setShowAddQuoteLevelAdjModal(false); triggerHighlight('adjustments'); }}
      />

      {/* Per-date edit modals */}
      {editingDateType && ['request', 'respond', 'effective', 'expiry'].includes(editingDateType) && (
        <DateEditModal
          type={editingDateType as any}
          isOpen
          onClose={() => setEditingDateType(null)}
          onSave={(config) => handleDateSave(editingDateType, config)}
          initialConfig={getModalConfig(editingDateType)}
        />
      )}

      {/* Recipients / POC */}
      {showRecipientsModal && (
        <RecipientsSelectionModal isOpen onClose={() => setShowRecipientsModal(false)}
          onSelect={(recipients, primaryPoCId) => {
            const primary = recipients.find(r => r.id === primaryPoCId) || recipients[0];
            if (primary) setContactName(primary.name);
            const newPocs = recipients.map(r => ({
              id: r.id,
              initials: r.initials || r.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
              name: r.name,
              title: r.role || r.department || 'Contact',
            }));
            if (newPocs.length > 0) setPocs(newPocs);
            toast.success(
              recipientsEditTarget === 'primary'
                ? `Primary contact updated to ${primary?.name || 'Unknown'}`
                : `Updated ${recipients.length} contacts`,
              { position: 'top-right' },
            );
            onNonMaterialChange?.('contact_person', 'Contact Person', contactName, primary?.name || 'Unknown');
            setShowRecipientsModal(false);
          }}
          currentCustomerId="cust1" currentCustomerName={customerName}
          selectedRecipients={pocs.map(p => ({
            id: p.id, name: p.name,
            email: `${p.name.toLowerCase().replace(' ', '.')}@company.com`,
            phone: '(555) 000-0000', role: p.title, department: '',
            initials: p.initials, avatarColor: '#DBEAFE',
          }))}
          primaryPoCId={pocs[0]?.id}
        />
      )}

      {/* Address */}
      {addressModalType && (
        <AddressSelectionModal isOpen onClose={() => setAddressModalType(null)}
          onSelect={(address, _p, _s) => {
            if (addressModalType === 'billing') {
              const oldLabel = billingAddress.label;
              setBillingAddress(address);
              toast.success(`Billing address updated to ${address.label}`, { position: 'top-right' });
              onMaterialChange?.('bill_to', 'Bill To', oldLabel, address.label);
            } else {
              const oldLabel = shippingAddress.label;
              setShippingAddress(address);
              toast.success(`Shipping address updated to ${address.label}`, { position: 'top-right' });
              onMaterialChange?.('ship_to', 'Ship To', oldLabel, address.label);
            }
            setAddressModalType(null);
          }}
          type={addressModalType} customerName={customerName}
          currentCustomer={{ id: 'partner1', name: customerName, type: 'Customer', location: `${billingAddress.city}, ${billingAddress.state}` }}
          currentAddress={addressModalType === 'billing' ? billingAddress : shippingAddress}
        />
      )}

      {/* Payment Terms */}
      {showPaymentTermsModal && (
        <PaymentTermsLibrary isOpen onClose={() => setShowPaymentTermsModal(false)}
          onSelect={(term, _s) => {
            const oldTerms = paymentTerms.name;
            setPaymentTerms({ id: term.id, name: term.name });
            toast.success(`Payment terms updated to ${term.name}`, { position: 'top-right' });
            onMaterialChange?.('payment_terms', 'Payment Terms', oldTerms, term.name);
            setShowPaymentTermsModal(false);
          }}
          currentTermId={paymentTerms.id} customerName={customerName} />
      )}

      {/* Payment Method */}
      {showPaymentMethodModal && (
        <PaymentMethodSelectionModal isOpen onClose={() => setShowPaymentMethodModal(false)}
          onSelect={(method, _s) => {
            const oldMethod = paymentMethod.name;
            setPaymentMethod({ id: method.id, name: method.name, icon: method.icon });
            toast.success(`Payment method updated to ${method.name}`, { position: 'top-right' });
            onNonMaterialChange?.('payment_method', 'Payment Method', oldMethod, method.name);
            setShowPaymentMethodModal(false);
          }}
          currentMethodId={paymentMethod.id} customerName={customerName} />
      )}

      {/* Change Customer — Step 1: Search overlay (no locations tab) */}
      {showCustomerModal && (
        <SearchOverlay
          isOpen
          onClose={() => setShowCustomerModal(false)}
          customers={MOCK_CUSTOMERS}
          contacts={MOCK_CONTACTS}
          currentCustomerName={customerName}
          hideLocationsTab
          onSelectCustomer={(selectedCust) => {
            const isSame = selectedCust.name === customerName;
            const custContacts = MOCK_CONTACTS.filter(c => c.customerId === selectedCust.id);
            const primaryContact = custContacts.find(c => c.isPrimary) || custContacts[0];
            setPendingCustomerSelection({
              customerId: selectedCust.id,
              customerName: selectedCust.name,
              contactName: primaryContact?.name || (isSame ? contactName : 'Unassigned'),
              contactId: primaryContact?.id,
              contactInitials: primaryContact?.initials,
              contactTitle: primaryContact?.title,
              locations: selectedCust.locations,
              isSameCustomer: isSame,
            });
            setShowCustomerModal(false);
          }}
          onSelectContact={(contact) => {
            const isSame = contact.customerName === customerName;
            const selectedCustomer = MOCK_CUSTOMERS.find(c => c.id === contact.customerId);
            if (isSame) {
              setContactName(contact.name);
              setPocs([{
                id: contact.id,
                initials: contact.initials,
                name: contact.name,
                title: contact.title,
              }]);
              toast.success(`Primary contact updated to ${contact.name}`, { position: 'top-right' });
              setShowCustomerModal(false);
            } else {
              setPendingCustomerSelection({
                customerId: contact.customerId,
                customerName: contact.customerName,
                contactName: contact.name,
                contactId: contact.id,
                contactInitials: contact.initials,
                contactTitle: contact.title,
                locations: selectedCustomer?.locations || [],
                isSameCustomer: false,
              });
              setShowCustomerModal(false);
            }
          }}
        />
      )}

      {/* Change Customer — Step 2: Location selection */}
      {pendingCustomerSelection && (
        <LocationSelectionModal
          isOpen
          onClose={() => setPendingCustomerSelection(null)}
          onSelect={(location) => {
            if (pendingCustomerSelection.isSameCustomer) {
              toast.success(`Location updated to ${location.name.split('(')[0].trim()}`, { position: 'top-right' });
              setPendingCustomerSelection(null);
            } else {
              setPendingChange({
                newCustomerName: pendingCustomerSelection.customerName,
                newLocation: location.name,
                newContactName: pendingCustomerSelection.contactName,
                isSameCustomer: false,
              });
              setPendingCustomerSelection(null);
            }
          }}
          currentLocationId=""
          customerName={pendingCustomerSelection.customerName}
          locations={pendingCustomerSelection.locations}
        />
      )}

      {/* Customer change confirmation dialog */}
      {pendingChange && !pendingChange.isSameCustomer && (
        <>
          <div
            className="fixed inset-0 z-50"
            style={{ backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(1px)' }}
            onClick={() => setPendingChange(null)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ pointerEvents: 'none' }}>
            <div
              style={{
                width: '440px', pointerEvents: 'auto',
                backgroundColor: '#FFFFFF', borderRadius: '12px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
                fontFamily: 'Inter, system-ui, sans-serif',
                display: 'flex', flexDirection: 'column', overflow: 'hidden',
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div style={{
                padding: '20px 24px 16px', display: 'flex', alignItems: 'flex-start', gap: '14px',
              }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#FEF3C7',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <AlertTriangle style={{ width: '20px', height: '20px', color: '#F59E0B' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1F2937', margin: 0, lineHeight: '1.3' }}>
                    Change Customer?
                  </h3>
                  <p style={{ fontSize: '13px', color: '#6B7280', margin: '4px 0 0 0', lineHeight: '1.5' }}>
                    Switching to <strong>{pendingChange.newCustomerName}</strong> will reset contacts, addresses, payment terms, and pricing rules.
                  </p>
                </div>
                <button
                  onClick={() => setPendingChange(null)}
                  style={{
                    width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: '6px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer',
                    color: '#9CA3AF', padding: 0, flexShrink: 0,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#F3F4F6'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <X style={{ width: '16px', height: '16px' }} />
                </button>
              </div>

              {/* Transition visual */}
              <div style={{
                padding: '0 24px 16px', display: 'flex', alignItems: 'center', gap: '12px',
              }}>
                <div style={{
                  flex: 1, padding: '8px 10px', borderRadius: '6px', backgroundColor: '#F9FAFB',
                  borderWidth: '1px', borderStyle: 'solid', borderColor: '#E5E7EB', opacity: 0.6,
                }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#6B7280', textDecoration: 'line-through', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{customerName}</div>
                  <div style={{ fontSize: '10px', color: '#9CA3AF', marginTop: '2px' }}>Current</div>
                </div>
                <ArrowRight style={{ width: '14px', height: '14px', color: '#9CA3AF', flexShrink: 0 }} />
                <div style={{
                  flex: 1, padding: '8px 10px', borderRadius: '6px', backgroundColor: '#F0F7FF',
                  borderWidth: '1.5px', borderStyle: 'solid', borderColor: '#BFDBFE',
                }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#1F2937', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pendingChange.newCustomerName}</div>
                  <div style={{ fontSize: '10px', color: '#1B6EF3', marginTop: '2px', fontWeight: 500 }}>{pendingChange.newContactName} · {pendingChange.newLocation}</div>
                </div>
              </div>

              {/* Actions */}
              <div style={{
                padding: '12px 24px 20px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px',
              }}>
                <button
                  onClick={() => setPendingChange(null)}
                  style={{
                    height: '32px', padding: '0 16px', borderRadius: '6px',
                    borderWidth: '1px', borderStyle: 'solid', borderColor: '#E5E7EB',
                    backgroundColor: '#FFFFFF', fontSize: '13px', fontWeight: 500, color: '#6B7280',
                    cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', transition: 'all 150ms',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#F9FAFB'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
                >Cancel</button>
                <button
                  onClick={() => {
                    setCustomerName(pendingChange.newCustomerName);
                    setContactName(pendingChange.newContactName);
                    setPocs(pendingChange.newContactName !== 'Unassigned' ? [{
                      id: 'new_primary', initials: pendingChange.newContactName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
                      name: pendingChange.newContactName, title: 'Primary Contact',
                    }] : []);
                    setBillingAddress({
                      id: 'new_bill', label: '', street: '',
                      city: '', state: '', zip: '',
                      country: 'United States', isDefault: true,
                    });
                    setShippingAddress({
                      id: 'new_ship', label: '', street: '',
                      city: '', state: '', zip: '',
                      country: 'United States', isDefault: false,
                    });
                    setPaymentTerms({ id: 'net30', name: 'Net 30' });
                    setPaymentMethod({ id: 'ach', name: 'ACH/Direct Deposit', icon: 'CreditCard' });
                    toast.success(
                      `Customer changed to ${pendingChange.newCustomerName}. Contacts, addresses, and pricing rules have been reset.`,
                      { position: 'top-right', duration: 5000 },
                    );
                    onMaterialChange?.('customer', 'Customer / Partner', customerName, pendingChange.newCustomerName);
                    setPendingChange(null);
                  }}
                  style={{
                    height: '32px', padding: '0 16px', borderRadius: '6px', border: 'none',
                    backgroundColor: '#F59E0B', fontSize: '13px', fontWeight: 500, color: '#FFFFFF',
                    cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', transition: 'all 150ms',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#D97706'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#F59E0B'; }}
                >Confirm &amp; Reset Data</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Currency Summary Block ──────────────────────────────────────────────────
// Shows what the customer pays in, what they're billed in (settlement), the
// base equivalent rate, the active rate type, a lock chip when sent, and a
// "View configuration" link that reopens the Currency Configurator.
function CurrencySummaryBlock({
  customerCurrency,
  settlementCurrency,
  quoteStatus,
  createdDate,
  onOpenCurrencyConfig,
}: {
  customerCurrency?: string;
  settlementCurrency?: string;
  quoteStatus?: QuoteLifecycleStatus;
  createdDate?: Date;
  onOpenCurrencyConfig?: () => void;
}) {
  const { rateType, snapshot } = useRateContext();
  const baseSym = getLibraryCurrency(BASE_CURRENCY)?.symbol ?? BASE_CURRENCY;
  const cur = (customerCurrency || BASE_CURRENCY).toUpperCase();
  const settlement = (settlementCurrency || BASE_CURRENCY).toUpperCase();
  const customerCur = getLibraryCurrency(cur);
  const settlementCur = getLibraryCurrency(settlement);
  const customerSym = customerCur?.symbol ?? cur;
  const settlementSym = settlementCur?.symbol ?? settlement;

  const customerIsBase = cur === BASE_CURRENCY;
  const settlementIsBase = settlement === BASE_CURRENCY;
  const isLocked = quoteStatus !== 'draft';
  const lockedAtText = createdDate
    ? createdDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  const typeHex = rateType === 'market' ? '#7c3aed' : '#d97706';
  const typeBg = rateType === 'market'
    ? 'color-mix(in srgb, #7c3aed 8%, transparent)'
    : 'color-mix(in srgb, #d97706 10%, transparent)';

  // Skip the block entirely when everything is base — no FX context to show.
  if (customerIsBase && settlementIsBase) return null;

  const customerToBase = customerIsBase ? 1 : convertBetween(1, cur, BASE_CURRENCY);

  return (
    <div style={{
      padding: '10px 0 10px',
      borderBottomWidth: '1px',
      borderBottomStyle: 'dashed',
      borderBottomColor: '#E5E7EB',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}>
      {/* Header: section label + rate-type badge + lock chip */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <span style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
          Currency
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            title={rateType === 'market'
              ? `Mid-market rates from ${snapshot.source}.`
              : `Treasury-locked corporate rates from ${snapshot.source}.`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              padding: '1px 6px', borderRadius: 999,
              backgroundColor: typeBg, color: typeHex,
              fontSize: 10, fontWeight: 600, cursor: 'help',
            }}
          >
            <span style={{ width: 4, height: 4, borderRadius: '50%', backgroundColor: typeHex }} />
            {rateTypeLabel(rateType)}
          </span>
          {isLocked && (
            <span
              title={lockedAtText ? `Rate locked when sent on ${lockedAtText}` : 'Rate locked'}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                padding: '1px 6px', borderRadius: 999,
                backgroundColor: '#ECFDF5', color: '#047857',
                border: '1px solid #A7F3D0',
                fontSize: 10, fontWeight: 600, cursor: 'help',
              }}
            >
              <LockIcon style={{ width: 9, height: 9 }} />
              Locked
            </span>
          )}
        </div>
      </div>

      {/* Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {!customerIsBase && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: '#6B7280' }}>Customer pays in</span>
            <span style={{ color: '#1F2937', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {customerSym} {cur}
            </span>
          </div>
        )}
        {!settlementIsBase && settlement !== cur && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: '#6B7280' }}>Customer billed in</span>
            <span style={{ color: '#1F2937', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {settlementSym} {settlement}
            </span>
          </div>
        )}
        {!customerIsBase && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: '#6B7280' }}>Base equivalent</span>
            <span style={{ color: '#1F2937', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {baseSym} {BASE_CURRENCY}
            </span>
          </div>
        )}
        {/* Rate line */}
        {!customerIsBase && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9CA3AF', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>
            <span>Rate</span>
            <span>1 {cur} = {baseSym} {customerToBase.toFixed(2)} {BASE_CURRENCY}</span>
          </div>
        )}
      </div>

      {/* View configuration link */}
      {onOpenCurrencyConfig && (
        <button
          type="button"
          onClick={onOpenCurrencyConfig}
          style={{
            alignSelf: 'flex-end',
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: 0, border: 'none', background: 'transparent',
            fontSize: 11, color: '#6B7280', cursor: 'pointer', fontWeight: 500,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#1B6EF3'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#6B7280'; }}
        >
          <Settings2Icon style={{ width: 11, height: 11 }} />
          View configuration
        </button>
      )}
    </div>
  );
}
