import {
  CreditCard,
  Landmark,
  Receipt,
  Banknote,
  ArrowLeftRight,
  CircleDollarSign,
} from 'lucide-react';

/* ─── Payment-method catalog ───────────────────────────────────────────────
 *
 * Mirrors the Partners module → Vendor → Payment Methods tab. Each rail the
 * Partner module supports (PAYMENT_TYPE_CARDS) is described here with the same
 * label, category, and "how it works" copy, plus the set of fields that tab
 * captures and the governing data-handling rule from the Payment Methods field
 * sensitivity classification (PCI DSS / NACHA·GLBA / PII). The Method-column
 * hover quick-card reads from this so the vendor-invoicing surface tells the
 * same story as the partner record. */

export type PaymentMethodCategory = 'Bank' | 'Card' | 'Traditional';

export interface PaymentMethodTypeInfo {
  /** The method string stored on a Payment (matches mockPayments `methods`). */
  key: string;
  /** Full partner-module label. */
  label: string;
  category: PaymentMethodCategory;
  icon: typeof CreditCard;
  /** How this rail works — verbatim from the partner type catalog. */
  description: string;
  /** Fields the partner Payment Methods tab captures for this type. */
  fields: string[];
  /** Governing standard for the type's sensitive fields. */
  governance: string;
  /** One-line data-handling rule (the "store last-N" / "never store" verdict). */
  security: string;
}

export const PAYMENT_METHOD_CATALOG: Record<string, PaymentMethodTypeInfo> = {
  ACH: {
    key: 'ACH',
    label: 'ACH / Direct Deposit',
    category: 'Bank',
    icon: CircleDollarSign,
    description:
      'Electronic bank transfer through the ACH network. Common for US-based vendors.',
    fields: ['Bank Name', 'Account Title', 'Account Number', 'Routing (ABA)', 'Account Type'],
    governance: 'NACHA · GLBA',
    security: 'Account number stored last 4 only.',
  },
  Wire: {
    key: 'Wire',
    label: 'Wire Transfer',
    category: 'Bank',
    icon: Landmark,
    description:
      'Direct bank-to-bank transfer. Suitable for domestic or international payments where ACH is not available.',
    fields: ['Bank Name', 'Account Title', 'Account Number', 'Routing (ABA)', 'SWIFT / BIC'],
    governance: 'NACHA · GLBA',
    security: 'Account number stored last 4 only.',
  },
  'Bank Transfer': {
    key: 'Bank Transfer',
    label: 'Bank Transfer',
    category: 'Bank',
    icon: ArrowLeftRight,
    description:
      'Electronic bank-to-bank transfer settled through the local clearing network.',
    fields: ['Bank Name', 'Account Title', 'Account Number', 'Bank Code'],
    governance: 'NACHA · GLBA',
    security: 'Account number stored last 4 only.',
  },
  Card: {
    key: 'Card',
    label: 'Credit / Debit Card',
    category: 'Card',
    icon: CreditCard,
    description: 'Card payment via Visa, Mastercard, Amex, or other card networks.',
    fields: ['Cardholder Name', 'Card Number', 'Expiry', 'Billing Address'],
    governance: 'PCI DSS',
    security: 'Card stored last 4 only · CVV never stored.',
  },
  Check: {
    key: 'Check',
    label: 'Check (Paper)',
    category: 'Traditional',
    icon: Receipt,
    description: 'Physical paper check sent by mail. Used when electronic payment is not accepted.',
    fields: ['Payee Name', 'Mailing Address'],
    governance: 'PII',
    security: 'No bank or card data captured.',
  },
  Cash: {
    key: 'Cash',
    label: 'Cash',
    category: 'Traditional',
    icon: Banknote,
    description: 'Physical cash payment collected at a designated collection point.',
    fields: ['Recipient Name', 'Collection Point'],
    governance: 'PII',
    security: 'No account data captured.',
  },
};

export function paymentMethodInfo(method: string): PaymentMethodTypeInfo {
  return PAYMENT_METHOD_CATALOG[method] ?? PAYMENT_METHOD_CATALOG.ACH;
}

/* ─── Category avatar colors ────────────────────────────────────────────────
 * Mirrors the partner module's payment-type picker (catColor / catBg):
 * each method type renders its icon in a soft colored square tinted by
 * category. Semantic tokens where a role exists (primary/warning/violet),
 * primitive tints for the soft backgrounds. */

export interface MethodCategoryColors {
  /** Icon / accent ink. */
  color: string;
  /** Soft avatar background. */
  bg: string;
}

const METHOD_CATEGORY_COLORS: Record<PaymentMethodCategory, MethodCategoryColors> = {
  Bank: { color: 'hsl(var(--primary))', bg: 'hsl(var(--accent))' },
  Card: { color: 'hsl(var(--warning))', bg: 'var(--color-amber-50)' },
  Traditional: { color: 'hsl(var(--violet))', bg: 'var(--color-violet-50)' },
};

export function methodCategoryColors(category: PaymentMethodCategory): MethodCategoryColors {
  return METHOD_CATEGORY_COLORS[category] ?? METHOD_CATEGORY_COLORS.Bank;
}

/* ─── Deterministic per-payment detail ──────────────────────────────────────
 * The standalone app has no live partner records, so the masked detail rows
 * shown on the hover card are synthesized deterministically from the vendor +
 * method (stable across reloads), formatted exactly like the partner saved
 * card (e.g. "••••3021"), so the card reads like a real stored method. */

const BANKS = ['Chase Bank', 'Bank of America', 'Wells Fargo', 'Citibank', 'PNC Bank', 'U.S. Bank'];
const CARD_NETWORKS = ['Visa', 'Mastercard', 'Amex'];
const CITIES = [
  'New York, NY',
  'Chicago, IL',
  'Dallas, TX',
  'Atlanta, GA',
  'Seattle, WA',
  'Denver, CO',
];
const ACCOUNT_TYPES = ['Checking', 'Savings'];
const COLLECTION_POINTS = ['Front office', 'Finance desk', 'Reception', 'Mailroom'];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (s.charCodeAt(i) + ((h << 5) - h)) | 0;
  return Math.abs(h);
}

export interface PaymentMethodDetail {
  /** Saved-method nickname shown as the card's bold title. */
  nickname: string;
  /** Label/value rows rendered in the card body. */
  rows: { label: string; value: string }[];
}

export function paymentMethodDetail(method: string, vendor: string): PaymentMethodDetail {
  const h = hash(`${vendor}|${method}`);
  const last4 = String(1000 + (h % 9000));
  const bank = BANKS[h % BANKS.length];
  const acctType = ACCOUNT_TYPES[h % ACCOUNT_TYPES.length];
  const city = CITIES[h % CITIES.length];
  const routing = String(100000000 + ((h * 7) % 899999999));

  switch (method) {
    case 'ACH':
      return {
        nickname: 'Primary ACH',
        rows: [
          { label: 'Bank', value: bank },
          { label: 'Account', value: `••••${last4}` },
          { label: 'Routing', value: routing },
          { label: 'Type', value: acctType },
        ],
      };
    case 'Wire':
      return {
        nickname: 'Wire account',
        rows: [
          { label: 'Bank', value: bank },
          { label: 'Account', value: `••••${last4}` },
          { label: 'SWIFT', value: `${bank.slice(0, 4).toUpperCase()}US33` },
        ],
      };
    case 'Bank Transfer':
      return {
        nickname: 'Bank transfer',
        rows: [
          { label: 'Bank', value: bank },
          { label: 'Account', value: `••••${last4}` },
          { label: 'Type', value: acctType },
        ],
      };
    case 'Card':
      return {
        nickname: `${CARD_NETWORKS[h % CARD_NETWORKS.length]} card`,
        rows: [
          { label: 'Cardholder', value: vendor },
          { label: 'Card', value: `••••${last4}` },
          { label: 'Expiry', value: `${String(1 + (h % 12)).padStart(2, '0')}/${27 + (h % 3)}` },
        ],
      };
    case 'Check':
      return {
        nickname: 'Mailed check',
        rows: [
          { label: 'Payee', value: vendor },
          { label: 'Mail To', value: city },
        ],
      };
    case 'Cash':
      return {
        nickname: 'Cash payout',
        rows: [
          { label: 'Recipient', value: vendor },
          { label: 'Collect At', value: COLLECTION_POINTS[h % COLLECTION_POINTS.length] },
        ],
      };
    default:
      return { nickname: method, rows: [] };
  }
}
