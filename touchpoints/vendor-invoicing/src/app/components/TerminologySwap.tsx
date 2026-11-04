import { useEffect } from 'react';

// ══════════════════════════════════════════════════════════════════
// AR terminology layer (7/17/26)
// Customer Invoicing / Customer Payments reuse the ENTIRE vendor module
// (same screens, same flows, same mock data). The only difference is
// wording: the AR side deals with customers and sales orders where the
// AP side says vendors and purchase orders. Rather than forking a dozen
// large components, this layer rewrites the rendered text while a
// customer module is active — text nodes plus the visible attributes —
// covering every surface at once: listings, detail pages, creation
// flows, dropdown portals, dialogs and toasts.
//
// Mechanics:
//  - Rules are word-bounded and idempotent (the replacement never
//    matches its own output), so re-processing converges instead of
//    looping.
//  - The observer watches document.body so Radix portals (dropdowns,
//    dialogs, popovers, toasts) are covered; anything inside a
//    [data-term-keep] element (the sidebar, which lists BOTH modules by
//    name) is left alone.
//  - Screens are keyed per module in App.tsx, so switching back to the
//    vendor module remounts them with pristine AP wording.
// ══════════════════════════════════════════════════════════════════

const RULES: Array<[RegExp, string]> = [
  // ── AR ledger inversion (7/20/26) ────────────────────────────────
  // Phrase rules first — they must run before the generic word swaps
  // below would eat their anchor words. On the AR side we COLLECT
  // money, we don't pay it out.
  [/\bInvoices to pay\b/g, 'Invoices to collect'],
  [/\binvoices to pay\b/g, 'invoices to collect'],
  [/\bReady to pay\b/g, 'Ready to collect'],
  [/\bready to pay\b/g, 'ready to collect'],
  [/\bAmount to pay\b/g, 'Amount to receive'],
  [/\bNet to pay\b/g, 'Net to receive'],
  [/\bpay run\b/g, 'collection run'],
  [/\bapprove, and pay\b/g, 'approve, and collect'],
  [/\bCash out\b/g, 'Cash in'],
  // Title Case labels (capitalization standard v1.3) swap the same way.
  [/\bInvoices to Pay\b/g, 'Invoices to Collect'],
  [/\bReady to Pay\b/g, 'Ready to Collect'],
  [/\bAmount to Pay\b/g, 'Amount to Receive'],
  [/\bNet to Pay\b/g, 'Net to Receive'],
  [/\bPay Run\b/g, 'Collection Run'],
  [/\bCash Out\b/g, 'Cash In'],
  // GL account codes flip with the ledger: the 2xxx payable liabilities
  // become 1xxx receivable assets; vendor prepayment assets become
  // customer deposit liabilities.
  [/\b2000([-\s])Accounts Payable\b/g, '1200$1Accounts Receivable'],
  [/\b2100([-\s])Accounts Payable\b/g, '1200$1Accounts Receivable'],
  [/\b2100-AP\b/g, '1100-AR'],
  [/\b2110-AP\b/g, '1110-AR'],
  [/\b2120-AP\b/g, '1120-AR'],
  [/\b2130-AP\b/g, '1130-AR'],
  [/\b2140-AP\b/g, '1140-AR'],
  [/\b1300-Vendor Prepayments\b/g, '2400-Customer Deposits'],
  // Generic ledger words.
  [/\bAccounts Payable\b/g, 'Accounts Receivable'],
  [/\baccounts payable\b/g, 'accounts receivable'],
  [/\bACCOUNTS PAYABLE\b/g, 'ACCOUNTS RECEIVABLE'],
  [/\bA\/P\b/g, 'A/R'],
  [/\bAP\b/g, 'AR'],
  [/\bPayables\b/g, 'Receivables'],
  [/\bpayables\b/g, 'receivables'],
  [/\bPayable\b/g, 'Receivable'],
  [/\bpayable\b/g, 'receivable'],
  // ── Vendor → customer, purchase → sales ──────────────────────────
  [/\bVendors\b/g, 'Customers'],
  [/\bvendors\b/g, 'customers'],
  [/\bVENDORS\b/g, 'CUSTOMERS'],
  [/\bVendor\b/g, 'Customer'],
  [/\bvendor\b/g, 'customer'],
  [/\bVENDOR\b/g, 'CUSTOMER'],
  [/\bPurchase Orders\b/g, 'Sales Orders'],
  [/\bPurchase orders\b/g, 'Sales orders'],
  [/\bpurchase orders\b/g, 'sales orders'],
  [/\bPurchase Order\b/g, 'Sales Order'],
  [/\bpurchase order\b/g, 'sales order'],
  [/\bPOs\b/g, 'SOs'],
  [/\bPO\b/g, 'SO'],
];

const SWAP_ATTRS = ['placeholder', 'title', 'aria-label'];

function swapText(value: string): string {
  let out = value;
  for (const [re, rep] of RULES) out = out.replace(re, rep);
  return out;
}

function skipped(el: Element | null): boolean {
  return !!el?.closest('[data-term-keep]');
}

function processTextNode(node: Text) {
  if (skipped(node.parentElement)) return;
  const value = node.nodeValue ?? '';
  const next = swapText(value);
  if (next !== value) node.nodeValue = next;
}

function processElementAttrs(el: Element) {
  if (skipped(el)) return;
  for (const attr of SWAP_ATTRS) {
    const value = el.getAttribute(attr);
    if (!value) continue;
    const next = swapText(value);
    if (next !== value) el.setAttribute(attr, next);
  }
}

function walk(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) {
    processTextNode(root as Text);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  processElementAttrs(root as Element);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let node: Node | null = walker.nextNode();
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) processTextNode(node as Text);
    else processElementAttrs(node as Element);
    node = walker.nextNode();
  }
}

/** Mount once; rewrites AP wording to AR wording while `active`. */
export function TerminologySwap({ active }: { active: boolean }) {
  useEffect(() => {
    if (!active) return;
    walk(document.body);
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === 'characterData') {
          processTextNode(record.target as Text);
        } else if (record.type === 'attributes') {
          processElementAttrs(record.target as Element);
        } else {
          record.addedNodes.forEach((n) => walk(n));
        }
      }
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: SWAP_ATTRS,
    });
    return () => observer.disconnect();
  }, [active]);
  return null;
}
