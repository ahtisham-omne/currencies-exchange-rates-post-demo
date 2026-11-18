import { useEffect, useState, useSyncExternalStore } from "react";
import {
  buildIncomingAlert,
  buildInitialInbox,
  type ActionChoice,
  type InboxAlert,
} from "../data/alerts-inbox-data";

/* ─── Alerts inbox store ───
 *
 * Module-scope external store, the same shape as `access-mode.tsx`: the bell,
 * the dropdown panel, and the full page all read one snapshot, so a read in
 * the panel is a read on the page and the badge agrees with both.
 *
 * Delivery is modelled as push (NP-11): nothing here exposes a refresh. The
 * prototype delivers one alert live a little after load so the badge, the
 * panel, and the page can be seen reacting without a reload.
 *
 * Read state is per recipient (NP-08, NP-13). It syncs across this browser's
 * tabs through a BroadcastChannel, which stands in for the cross-device sync
 * the real service will do. It is deliberately not persisted, so every load
 * starts from the seeded inbox.
 *
 * PROTOTYPE SCENARIOS. Append `?alerts=error` to any URL to load into the
 * failure state, or `?alerts=empty` for the no-alerts state. Nothing in the UI
 * exposes these; they exist so the states in PRD section 07 can be reviewed. */

export type LoadStatus = "loading" | "ready" | "error";

export interface AlertsInboxState {
  status: LoadStatus;
  alerts: InboxAlert[];
}

let state: AlertsInboxState = { status: "loading", alerts: [] };
const listeners = new Set<() => void>();
let started = false;
let loadTimer: ReturnType<typeof setTimeout> | undefined;
let incomingTimer: ReturnType<typeof setTimeout> | undefined;
let incomingDelivered = false;

function emit() {
  listeners.forEach((l) => l());
}

function setState(patch: Partial<AlertsInboxState>) {
  state = { ...state, ...patch };
  emit();
}

function patchAlert(id: string, patch: Partial<InboxAlert> | ((a: InboxAlert) => Partial<InboxAlert>)) {
  setState({
    alerts: state.alerts.map((a) =>
      a.id === id ? { ...a, ...(typeof patch === "function" ? patch(a) : patch) } : a,
    ),
  });
}

function readScenario(): "normal" | "error" | "empty" {
  if (typeof window === "undefined") return "normal";
  try {
    const v = new URLSearchParams(window.location.search).get("alerts");
    if (v === "error" || v === "empty") return v;
  } catch {
    /* ignore */
  }
  return "normal";
}

/* ─── Cross-tab read-state sync ─── */
const channel: BroadcastChannel | null =
  typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("omne:alerts-read-state") : null;

channel?.addEventListener("message", (e: MessageEvent<{ readIds?: string[] }>) => {
  const ids = e.data?.readIds;
  if (!ids?.length) return;
  const set = new Set(ids);
  setState({ alerts: state.alerts.map((a) => (set.has(a.id) && !a.read ? { ...a, read: true } : a)) });
});

function broadcastRead(ids: string[]) {
  try {
    channel?.postMessage({ readIds: ids });
  } catch {
    /* ignore */
  }
}

/* ─── Loading ─── */

const LOAD_DELAY_MS = 650;
const INCOMING_DELAY_MS = 30_000;
const ACTION_DELAY_MS = 900;

export function loadAlerts() {
  started = true;
  clearTimeout(loadTimer);
  setState({ status: "loading" });
  loadTimer = setTimeout(() => {
    const scenario = readScenario();
    if (scenario === "error") {
      setState({ status: "error", alerts: [] });
      return;
    }
    setState({ status: "ready", alerts: scenario === "empty" ? [] : buildInitialInbox() });
    scheduleIncoming();
  }, LOAD_DELAY_MS);
}

function scheduleIncoming() {
  if (incomingDelivered || incomingTimer || readScenario() === "empty") return;
  incomingTimer = setTimeout(() => {
    incomingTimer = undefined;
    incomingDelivered = true;
    deliverAlert(buildIncomingAlert());
  }, INCOMING_DELAY_MS);
}

/** Push delivery: a fired alert lands at the top, unread, and the badge moves. */
export function deliverAlert(alert: InboxAlert) {
  if (state.status !== "ready") return;
  setState({ alerts: [alert, ...state.alerts].sort((a, b) => b.firedAt - a.firedAt) });
}

/* ─── Read state (NP-07, NP-08, NP-09) ─── */

export function markRead(id: string) {
  const target = state.alerts.find((a) => a.id === id);
  if (!target || target.read) return;
  patchAlert(id, { read: true });
  broadcastRead([id]);
}

export function markManyRead(ids: string[]) {
  const set = new Set(ids);
  const changed: string[] = [];
  setState({
    alerts: state.alerts.map((a) => {
      if (set.has(a.id) && !a.read) {
        changed.push(a.id);
        return { ...a, read: true };
      }
      return a;
    }),
  });
  if (changed.length) broadcastRead(changed);
}

/* ─── Card actions (NP-04) ─── */

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function performCardAction(id: string, choice: ActionChoice): Promise<void> {
  const alert = state.alerts.find((a) => a.id === id);
  if (!alert?.cardAction) return;
  if (alert.actionState.status === "pending" || alert.actionState.status === "done") return;

  patchAlert(id, { actionState: { status: "pending", choice } });
  await wait(ACTION_DELAY_MS);

  const fresh = state.alerts.find((a) => a.id === id);
  if (!fresh) return;

  if (fresh.failFirstAttempt) {
    /* Failure reports on the card and the alert stays unread (PRD 07). */
    patchAlert(id, { failFirstAttempt: false, actionState: { status: "failed", choice } });
    return;
  }

  /* Success, including the case where the same decision was already taken in
   * the record: the control resolves to a completed state rather than failing. */
  patchAlert(id, {
    read: true,
    actionState: { status: "done", choice, at: Date.now(), alreadyInRecord: Boolean(fresh.decidedInRecord) },
  });
  broadcastRead([id]);
}

/* ─── React bindings ─── */

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!started) loadAlerts();
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return state;
}

export function useAlertsInbox(): AlertsInboxState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Unread count for the badge. `null` while loading or after a failed load, so
 *  the bell suppresses the badge rather than showing a false zero (PRD 07). */
export function useUnreadCount(): number | null {
  const s = useAlertsInbox();
  if (s.status !== "ready") return null;
  return s.alerts.reduce((n, a) => n + (a.read ? 0 : 1), 0);
}

/** A ticking "now" so relative times stay honest while a surface is open. */
export function useNow(intervalMs: number = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/* ─── Test hooks ─── */
export function __resetAlertsInboxForTests(next?: Partial<AlertsInboxState>) {
  clearTimeout(loadTimer);
  clearTimeout(incomingTimer);
  incomingTimer = undefined;
  incomingDelivered = false;
  started = true;
  state = { status: "ready", alerts: [], ...next };
  emit();
}
