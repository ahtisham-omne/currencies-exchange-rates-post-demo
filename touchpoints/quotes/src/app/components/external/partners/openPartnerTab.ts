/* ═══════════════════════════════════════════════════════════════════════
 *  openPartnerTab — open the Partner Management shell in a new browser
 *  tab, pre-armed with an action (create-customer / create-poc /
 *  create-location). When the user finishes the create flow in the
 *  partner tab, that tab postMessage's the payload back via
 *  window.opener and closes itself; the originating Quote/SO tab
 *  resolves the returned promise so the host can continue its
 *  creation pipeline (StateTransitionOverlay → insert into list →
 *  toast).
 *
 *  Cross-tab handshake:
 *  - Opener generates a transactionId, posts it in the URL hash and
 *    sets up a window 'message' listener filtered on that id.
 *  - Partner tab reads the id from its URL hash, fires
 *    postMessage({ type, transactionId, payload }) on save, then
 *    window.close().
 *  - Opener resolves the promise with `payload`. If the user closes
 *    the partner tab without saving, the promise resolves with null
 *    (detected via a periodic `closed` poll).
 * ═══════════════════════════════════════════════════════════════════════ */

export type PartnerTabAction =
  | 'create-customer'
  | 'create-poc'
  | 'create-location';

export interface PartnerTabResult<T = Record<string, unknown>> {
  /** The action the user completed in the new tab. */
  action: PartnerTabAction;
  /** Raw payload echoed back by the partner tab's modal. Shape
   *  matches the adapter payload types (CreatedCustomerPayload,
   *  CreatedContactPayload, CreatedLocationPayload). */
  payload: T;
}

interface OpenPartnerTabOptions {
  /** Pre-fills the name field on the opened modal (typed search query
   *  that routed the user here). */
  seedName?: string;
  /** create-poc / create-location use this to pre-pin the
   *  customer/partner the new record attaches to. */
  customerId?: string;
  customerName?: string;
  /** Optional: where the user came from. Pure display in the partner
   *  tab's URL — not strictly necessary for the IPC. */
  origin?: 'quote' | 'so';
}

const PARTNER_TAB_MESSAGE_TYPE = 'partner-tab:result';

/**
 * Open the partner shell tab for the requested action and return a
 * promise that resolves with the created payload (or null if the user
 * closed the tab without saving).
 */
export function openPartnerTab<T = Record<string, unknown>>(
  action: PartnerTabAction,
  options: OpenPartnerTabOptions = {},
): Promise<PartnerTabResult<T> | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(null);
      return;
    }

    const transactionId = `pt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const params = new URLSearchParams();
    params.set('action', action);
    params.set('tx', transactionId);
    if (options.seedName) params.set('seed', options.seedName);
    if (options.customerId) params.set('customerId', options.customerId);
    if (options.customerName) params.set('customerName', options.customerName);
    if (options.origin) params.set('origin', options.origin);

    const url = `/partners?${params.toString()}`;
    /* Omit the features string entirely. Any window.open features
       string that mentions `noopener` (even as `noopener=no`) makes
       the browser strip `window.opener` from the new tab, which
       would break our postMessage handshake. The default behaviour
       — new tab with opener access — is exactly what we want. */
    const tab = window.open(url, '_blank');
    if (!tab) {
      /* Popup blocked. Surface null so the caller can fall back to
         a same-tab modal if they want, or just toast the failure. */
      resolve(null);
      return;
    }

    let resolved = false;

    const onMessage = (e: MessageEvent) => {
      if (!e.data || typeof e.data !== 'object') return;
      const data = e.data as { type?: string; transactionId?: string; payload?: T; action?: PartnerTabAction };
      if (data.type !== PARTNER_TAB_MESSAGE_TYPE) return;
      if (data.transactionId !== transactionId) return;
      cleanup();
      resolve({ action: (data.action || action) as PartnerTabAction, payload: (data.payload || {}) as T });
    };

    /* Poll the tab's closed state — if the user closes it without
       firing the message, resolve with null so the caller can clean
       up its UI (e.g. clear the seedName state). */
    const pollClosed = window.setInterval(() => {
      if (tab.closed) {
        cleanup();
        resolve(null);
      }
    }, 400);

    const cleanup = () => {
      if (resolved) return;
      resolved = true;
      window.removeEventListener('message', onMessage);
      window.clearInterval(pollClosed);
    };

    window.addEventListener('message', onMessage);
  });
}

/** Helper used by the partner shell page when its create modal fires
 *  onCreated. Posts the result back to window.opener and closes the
 *  current tab so the originating Quote/SO flow can continue without
 *  the user having to switch tabs manually. */
export function postPartnerTabResult<T = Record<string, unknown>>(
  action: PartnerTabAction,
  payload: T,
): void {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  const transactionId = params.get('tx');
  if (!transactionId) return;
  if (window.opener) {
    try {
      window.opener.postMessage(
        { type: PARTNER_TAB_MESSAGE_TYPE, transactionId, action, payload },
        window.location.origin,
      );
    } catch {
      /* postMessage to a different-origin opener can throw. The
         partner shell is always same-origin in our setup, so this
         catch is defensive-only. */
    }
  }
  /* Close on next microtask so the postMessage has a chance to flush
     before the tab dies. */
  setTimeout(() => window.close(), 50);
}
