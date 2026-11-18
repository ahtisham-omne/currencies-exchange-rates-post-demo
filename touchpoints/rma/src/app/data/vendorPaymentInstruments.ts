/**
 * A vendor's saved payment methods, in the partner module's own shape.
 *
 * Ported from `payment-methods/types.ts` and `helpers.ts` in omne-frontend:
 * one entry type carrying every method's fields as siblings, the card reading
 * only the ones its `type` cares about. The values are synthesized per vendor
 * and method the way the purchase order synthesizes a vendor's contact
 * details, so the same vendor always reads the same.
 */

import {
  AlertCircle,
  Banknote,
  Building2,
  CircleDollarSign,
  CreditCard,
  FileText,
  Hash,
  Landmark,
  type LucideIcon,
  MapPin,
  Phone,
  Receipt,
  User,
  Wallet,
} from 'lucide-react';

export type PaymentMethodType =
  | 'ach'
  | 'wire'
  | 'card'
  | 'digital_wallet'
  | 'check'
  | 'cash'
  | 'other';

export type PaymentTypeCategory = 'Bank' | 'Card' | 'Digital' | 'Traditional' | 'Other';

export interface PaymentTypeMeta {
  id: PaymentMethodType;
  label: string;
  description: string;
  icon: LucideIcon;
  category: PaymentTypeCategory;
}

export const PAYMENT_TYPE_CARDS: readonly PaymentTypeMeta[] = [
  {
    id: 'ach',
    label: 'ACH / Direct Deposit',
    description: 'Electronic bank transfer through the ACH network. Common for US-based vendors.',
    icon: CircleDollarSign,
    category: 'Bank',
  },
  {
    id: 'wire',
    label: 'Wire Transfer',
    description:
      'Direct bank-to-bank transfer. Suitable for domestic or international payments where ACH is not available.',
    icon: Landmark,
    category: 'Bank',
  },
  {
    id: 'card',
    label: 'Credit / Debit Card',
    description: 'Card payment via Visa, Mastercard, Amex, or other card networks.',
    icon: CreditCard,
    category: 'Card',
  },
  {
    id: 'digital_wallet',
    label: 'Digital Wallet',
    description:
      'Payment through platforms such as PayPal, Venmo, Stripe, Apple Pay, or Google Pay.',
    icon: Wallet,
    category: 'Digital',
  },
  {
    id: 'check',
    label: 'Check (Paper)',
    description: 'Physical paper check sent by mail. Used when electronic payment is not accepted.',
    icon: Receipt,
    category: 'Traditional',
  },
  {
    id: 'cash',
    label: 'Cash',
    description: 'Physical cash payment collected at a designated collection point.',
    icon: Banknote,
    category: 'Traditional',
  },
  {
    id: 'other',
    label: 'Other (Record Only)',
    description:
      'A custom payment method for record-keeping only. No transaction is processed through the system.',
    icon: FileText,
    category: 'Other',
  },
];

export const PAYMENT_TYPE_CATEGORIES: readonly PaymentTypeCategory[] = [
  'Bank',
  'Card',
  'Digital',
  'Traditional',
  'Other',
];

/** Per-category colour, as the source's `PAYMENT_CATEGORY_STYLE`. */
export const PAYMENT_CATEGORY_STYLE: Record<
  PaymentTypeCategory,
  { chipBg: string; chipFg: string; badgeBg: string; badgeFg: string }
> = {
  Bank: { chipBg: '#EBF3FF', chipFg: '#0A77FF', badgeBg: '#EBF3FF', badgeFg: '#0A77FF' },
  Card: { chipBg: '#FFFBEB', chipFg: '#B45309', badgeBg: '#FFFBEB', badgeFg: '#B45309' },
  Digital: { chipBg: '#ECFDF5', chipFg: '#047857', badgeBg: '#ECFDF5', badgeFg: '#047857' },
  Traditional: { chipBg: '#F0EBFF', chipFg: '#7C3AED', badgeBg: '#F0EBFF', badgeFg: '#7C3AED' },
  Other: { chipBg: '#F1F5F9', chipFg: '#475569', badgeBg: '#F1F5F9', badgeFg: '#475569' },
};

export function paymentTypeMeta(type: PaymentMethodType): PaymentTypeMeta {
  return PAYMENT_TYPE_CARDS.find((t) => t.id === type) ?? PAYMENT_TYPE_CARDS[6]!;
}

export interface PaymentMethodEntry {
  id: string;
  type: PaymentMethodType;
  isPrimary: boolean;
  status: 'Active' | 'Inactive';
  nickname: string;
  bankName: string;
  accountTitle: string;
  accountNumber: string;
  routingNumber: string;
  swiftCode: string;
  accountType: string;
  cardholderName: string;
  cardNumber: string;
  expiryDate: string;
  cvv: string;
  billingAddress: string;
  walletProvider: string;
  walletId: string;
  payeeName: string;
  mailingAddress: string;
  recipientName: string;
  collectionPoint: string;
  methodName: string;
  description: string;
  countryCode: string;
  phone: string;
  specialInstructions: string;
  applyDiscount: boolean;
  discountValue: string;
  discountMode: 'percent' | 'fixed';
  additionalCharges: string;
  additionalChargesMode: 'percent' | 'fixed';
}

/** The source's `maskValue`. */
export function maskValue(value: string): string {
  const clean = value.replace(/\s/g, '');
  if (clean.length <= 4) return clean;
  return `•••• ${clean.slice(-4)}`;
}

/** The source's `getEntrySummary`: the card's title. */
export function getEntrySummary(e: PaymentMethodEntry): string {
  if (e.nickname) return e.nickname;
  if (e.bankName) return e.bankName;
  if (e.cardholderName) return e.cardholderName;
  if (e.walletProvider) return e.walletProvider;
  if (e.payeeName) return e.payeeName;
  if (e.recipientName) return e.recipientName;
  if (e.methodName) return e.methodName;
  return paymentTypeMeta(e.type).label;
}

export interface PaymentDataRow {
  icon: LucideIcon;
  label: string;
  value: string;
  sensitive?: boolean;
}

/** The source's `getEntryDataRows`. */
export function getEntryDataRows(e: PaymentMethodEntry): PaymentDataRow[] {
  const rows: PaymentDataRow[] = [];
  if (e.type === 'ach' || e.type === 'wire') {
    if (e.bankName) rows.push({ icon: Building2, label: 'Bank', value: e.bankName });
    if (e.accountTitle) rows.push({ icon: User, label: 'Account', value: e.accountTitle });
    if (e.accountNumber)
      rows.push({ icon: Hash, label: 'Acct #', value: e.accountNumber, sensitive: true });
    if (e.routingNumber)
      rows.push({ icon: Hash, label: 'Routing', value: e.routingNumber, sensitive: true });
    if (e.type === 'ach' && e.accountType)
      rows.push({ icon: FileText, label: 'Type', value: e.accountType });
    if (e.type === 'wire' && e.swiftCode)
      rows.push({ icon: Hash, label: 'SWIFT', value: e.swiftCode, sensitive: true });
  }
  if (e.type === 'card') {
    if (e.cardholderName) rows.push({ icon: User, label: 'Holder', value: e.cardholderName });
    if (e.cardNumber)
      rows.push({ icon: CreditCard, label: 'Card #', value: e.cardNumber, sensitive: true });
    if (e.expiryDate) rows.push({ icon: FileText, label: 'Expiry', value: e.expiryDate });
    if (e.billingAddress) rows.push({ icon: MapPin, label: 'Billing', value: e.billingAddress });
  }
  if (e.type === 'digital_wallet') {
    if (e.walletProvider) rows.push({ icon: Wallet, label: 'Provider', value: e.walletProvider });
    if (e.walletId) rows.push({ icon: Hash, label: 'Wallet ID', value: e.walletId, sensitive: true });
  }
  if (e.type === 'check') {
    if (e.payeeName) rows.push({ icon: User, label: 'Payee', value: e.payeeName });
    if (e.mailingAddress) rows.push({ icon: MapPin, label: 'Address', value: e.mailingAddress });
  }
  if (e.type === 'cash') {
    if (e.recipientName) rows.push({ icon: User, label: 'Recipient', value: e.recipientName });
    if (e.collectionPoint) rows.push({ icon: MapPin, label: 'Location', value: e.collectionPoint });
  }
  if (e.type === 'other') {
    if (e.methodName) rows.push({ icon: FileText, label: 'Method', value: e.methodName });
    if (e.description) rows.push({ icon: FileText, label: 'Desc', value: e.description });
  }
  if (e.phone) rows.push({ icon: Phone, label: 'Phone', value: `${e.countryCode} ${e.phone}` });
  if (e.specialInstructions)
    rows.push({ icon: AlertCircle, label: 'Notes', value: e.specialInstructions });
  return rows;
}

export function formatDiscountValue(value: string, mode: 'percent' | 'fixed'): string {
  if (!value) return '';
  return mode === 'fixed' ? `$${value}` : `${value}%`;
}

// ── Synthesis ────────────────────────────────────────────────────────────

const BANKS = ['JPMorgan Chase', 'Wells Fargo', 'PNC Bank', 'Citizens Bank', 'US Bank'];
const CARD_BRANDS = ['Visa', 'Mastercard', 'American Express'];
const WALLETS = ['PayPal', 'Stripe', 'Wise'];

function seedOf(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Which of the seven types a method name is. */
export function typeForMethodName(name: string): PaymentMethodType {
  const n = name.toLowerCase();
  if (n.includes('ach') || n.includes('direct deposit')) return 'ach';
  if (n.includes('wire') || n.includes('bank transfer')) return 'wire';
  if (n.includes('card')) return 'card';
  if (n.includes('wallet') || n.includes('paypal') || n.includes('pay')) return 'digital_wallet';
  if (n.includes('check') || n.includes('cheque')) return 'check';
  if (n.includes('cash')) return 'cash';
  return 'other';
}

function empty(id: string, type: PaymentMethodType): PaymentMethodEntry {
  return {
    id,
    type,
    isPrimary: false,
    status: 'Active',
    nickname: '',
    bankName: '',
    accountTitle: '',
    accountNumber: '',
    routingNumber: '',
    swiftCode: '',
    accountType: '',
    cardholderName: '',
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    billingAddress: '',
    walletProvider: '',
    walletId: '',
    payeeName: '',
    mailingAddress: '',
    recipientName: '',
    collectionPoint: '',
    methodName: '',
    description: '',
    countryCode: '+1',
    phone: '',
    specialInstructions: '',
    applyDiscount: false,
    discountValue: '',
    discountMode: 'percent',
    additionalCharges: '',
    additionalChargesMode: 'percent',
  };
}

/** One saved method, filled in for the vendor that holds it. */
export function paymentEntryFor(
  vendorName: string,
  methodName: string,
  isPrimary = false,
): PaymentMethodEntry {
  const type = typeForMethodName(methodName);
  const seed = seedOf(`${vendorName}|${methodName}`);
  const four = String(1000 + (seed % 9000));
  const e = empty(`pm-${seedOf(methodName)}-${seed}`, type);
  e.isPrimary = isPrimary;
  e.nickname = methodName;
  e.phone = `(${200 + (seed % 700)}) ${100 + ((seed >> 5) % 900)}-${String((seed >> 11) % 10000).padStart(4, '0')}`;

  if (type === 'ach' || type === 'wire') {
    e.bankName = BANKS[seed % BANKS.length]!;
    e.accountTitle = vendorName;
    e.accountNumber = `${10000000 + (seed % 89999999)}${four}`;
    e.routingNumber = String(110000000 + (seed % 800000000));
    if (type === 'ach') e.accountType = seed % 3 === 0 ? 'Savings' : 'Checking';
    if (type === 'wire') e.swiftCode = `${['CHAS', 'WFBI', 'PNCC'][seed % 3]}US33${four.slice(0, 3)}`;
  }
  if (type === 'card') {
    e.cardholderName = vendorName;
    e.cardNumber = `${CARD_BRANDS[seed % 3] === 'American Express' ? '3782' : '4111'} 1111 1111 ${four}`;
    e.expiryDate = `${String(1 + (seed % 12)).padStart(2, '0')}/2${8 + (seed % 2)}`;
    e.cvv = String(100 + (seed % 900));
    e.billingAddress = 'Billing address on the partner record';
  }
  if (type === 'digital_wallet') {
    e.walletProvider = WALLETS[seed % WALLETS.length]!;
    e.walletId = `${vendorName.split(' ')[0]!.toLowerCase()}-${four}`;
  }
  if (type === 'check') {
    e.payeeName = vendorName;
    e.mailingAddress = 'Remittance address on the partner record';
  }
  if (type === 'cash') {
    e.recipientName = vendorName;
    e.collectionPoint = 'Accounts payable desk';
  }
  if (type === 'other') {
    e.methodName = methodName;
    e.description = 'Recorded against the account, nothing processed here.';
  }
  // A discount arrangement on roughly one method in three, which is what
  // gives the strip something to show.
  if (seed % 3 === 0) {
    e.applyDiscount = true;
    e.discountValue = String(1 + (seed % 3));
    e.additionalCharges = '';
  }
  return e;
}

/** Every method a vendor accepts, primary first. */
export function paymentEntriesFor(
  vendorName: string,
  methods: string[],
  primary: string | undefined,
): PaymentMethodEntry[] {
  return methods.map((m) => paymentEntryFor(vendorName, m, m === primary));
}
