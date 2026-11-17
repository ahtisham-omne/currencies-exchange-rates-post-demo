/* Currency & Exchange Rates' own logs: Mahreen Ghafoor's "Activity Logs:
 * Currency & Exchange Rates" (16 Nov 2026). Every sentence and row is hers,
 * word for word, except where the shared log's own entry decides the words
 * (an attachment added or removed, a note edited), and the rows her Facts
 * name without wording, which are written as sentences from them. Both kinds
 * of difference are listed in the handover note to the BA.
 *
 * One record of each kind carries the showcase (rules-since-2.6, 12 Nov):
 * the currency MXN (currency use cases 1 to 9, the base currency halves
 * included) and the exchange rate USD to PKR (exchange rate use cases 1 to
 * 13). PKR and USD carry their own halves of the same base currency change.
 * Exchange rate use case 6 has no shape yet and waits for the activity-log
 * designer, so it is not here.
 *
 * This file holds the entries no store in the app holds. Every record's log
 * also carries what the app already knows about it, in the same use cases'
 * words (pages/recordTabs/activityHistory.ts): status changes, notes, files,
 * corporate rate changes and the daily syncs. */

/** A file as it appears in an attachment chip or the preview modal: its size
 * is a display string, since nothing in this prototype stores bytes. */
export type AttachmentFile = { name: string; size: string };

export type FieldValue =
  | { kind: "text"; text: string }
  | { kind: "code"; text: string }
  | { kind: "status"; label: string; active: boolean }
  /** null = no one: "removed" on AFTER, "not set" on BEFORE. */
  | { kind: "person"; name: string | null }
  | { kind: "tags"; items: string[] }
  | { kind: "attachments"; items: AttachmentFile[] }
  | { kind: "entity"; text: string; href: string };

export type FieldChange = {
  field: string;
  before: FieldValue;
  after: FieldValue;
};

/** The shared log's own kinds, as the renderer draws them. */
export type GenericActivityEvent = {
  id: string;
  actor: string;
  timestamp: string;
} & (
  | { kind: "created"; initial: { field: string; value: FieldValue }[] }
  | { kind: "childAdded"; childCode: string; href: string }
  | {
      kind: "childStatusChanged";
      childCode: string;
      href: string;
      before: { label: string; active: boolean };
      after: { label: string; active: boolean };
    }
  | { kind: "attachmentsChanged"; added: AttachmentFile[]; removed: AttachmentFile[] }
  | { kind: "fields"; changes: FieldChange[]; section?: string }
  | { kind: "descriptionEdited"; before: string; after: string }
  | { kind: "descriptionRewritten"; beforeText: string; beforeWords: number; afterText: string; afterWords: number }
);

/** One piece of a row's sentence: words, a value (medium weight), a person
 * (avatar and name, with their card) or a currency (a link with its card). */
export type FxSegment = { t: string } | { v: string } | { person: string } | { currency: string };

/** One row under an entry. Every row is a sentence. */
export type FxRow =
  /** A sentence, in pieces so each value carries its weight. */
  | { kind: "sentence"; parts: FxSegment[] }
  /** A note's own words: bare prose, no label and no prefix. */
  | { kind: "note"; text: string }
  /** "<Field> updated from <before> to <after>", the changed characters marked. */
  | { kind: "pair"; field: string; before: string; after: string }
  /** "Status updated from <pill> to <pill>", in the product's pill colours. */
  | { kind: "status"; before: string; after: string };

/** The module's one custom kind: a sentence in the BA's words and its rows. */
export type FxEvent = {
  id: string;
  actor: string;
  timestamp: string;
  kind: "fx";
  /** The sentence after the actor's name, word for word. */
  verb: string;
  /** The one value the sentence carries: behind a middot ("· 279.0000") or
   * closing it ("for May 1, 2026"). */
  value?: { text: string; middot: boolean };
  /** What set off an entry the system wrote, beside the time: "daily sync". */
  trigger?: string;
  rows: FxRow[];
  /** The Event filter's bucket. */
  filter: "added" | "removed" | "updated";
  /** The Changed filter's group, a key the profile labels. */
  changed: "status" | "notes" | "baseCurrency" | "corporateRate" | "midMarketRate";
};

/** The name every stamped copy of the renderer imports. */
export type ActivityEvent = GenericActivityEvent | FxEvent;

export type ActorInfo = {
  /** Who or what acted. Anything but a person gets the grey icon disc and no hover card. */
  kind?: "person" | "system" | "carrier" | "integration";
  initials: string;
  avatarBg: string;
  avatarFg: string;
  role: string;
  department: string;
  phone: string;
  email: string;
};

/** The signed-in user, as the app's own account menu names him. */
export const SIGNED_IN = "Ahtisham Ahmad";

/* Ahtisham Ahmad is the prototype's Controller (the BA's document) and the
 * account the app is signed in as (its account menu gives the email). The
 * app holds no department or phone for him, so none is invented. The others
 * write the notes and files the app seeds on every currency and pair; their
 * details are the app's own (coa/components/comms/peopleData.ts, and
 * AuditCells.tsx for Marcus Lee). The rate provider's sync and a scheduled
 * rate taking effect are the System's. */
export const ACTORS: Record<string, ActorInfo> = {
  [SIGNED_IN]: {
    initials: "AA",
    avatarBg: "#6366f1",
    avatarFg: "#ffffff",
    role: "Controller",
    department: "",
    phone: "",
    email: "admin@omnesoft.com",
  },
  "Ayesha Khan": {
    initials: "AK",
    avatarBg: "#e3f3f0",
    avatarFg: "#2a7a6b",
    role: "Controller",
    department: "Accounting",
    phone: "+1 (512) 555-0113",
    email: "ayesha.khan@omne.example",
  },
  "Marcus Lee": {
    initials: "ML",
    avatarBg: "#ece8fb",
    avatarFg: "#5b4aa6",
    role: "Accountant",
    department: "Accounting",
    phone: "(512) 555-0171",
    email: "marcus.lee@omnesoft.com",
  },
  "Daniel Osei": {
    initials: "DO",
    avatarBg: "#fdeee3",
    avatarFg: "#9a5b2a",
    role: "Accountant",
    department: "Payables",
    phone: "+1 (512) 555-0124",
    email: "daniel.osei@omne.example",
  },
  System: { kind: "system", initials: "", avatarBg: "", avatarFg: "", role: "", department: "", phone: "", email: "" },
};

/** A time as the BA wrote it: company time, Pakistan (UTC+5), as the app's
 * own rate and audit times are kept. */
function at(year: number, month: number, day: number, hour: number, minute: number): string {
  return new Date(Date.UTC(year, month - 1, day, hour - 5, minute, 0)).toISOString();
}

const AA = SIGNED_IN;

/* ── The currency: MXN, Mexican Peso ─────────────────────────────────── */

const MXN_NOTE = "Activated for the Monterrey supplier. Invoices from April will be in pesos.";
const MXN_NOTE_EDITED = "Activated for the Monterrey supplier. Invoices from May will be in pesos.";
const SUPPLY_AGREEMENT: AttachmentFile = { name: "Monterrey supply agreement.pdf", size: "1.2 MB" };

/** Currency use cases 1 to 9, in date order. The base currency change runs
 * USD to MXN to PKR on 5 January, so MXN carries both halves (use cases 8
 * and 9) and the story still reads as one. */
const MXN_EVENTS: ActivityEvent[] = [
  {
    id: "MXN-8", actor: AA, timestamp: at(2026, 1, 5, 9, 0), kind: "fx",
    verb: "set this currency as the base currency",
    rows: [{ kind: "sentence", parts: [{ t: "Replaced " }, { currency: "USD" }] }],
    filter: "updated", changed: "baseCurrency",
  },
  {
    id: "MXN-9", actor: AA, timestamp: at(2026, 1, 5, 9, 20), kind: "fx",
    verb: "replaced this currency as the base currency",
    rows: [{ kind: "sentence", parts: [{ t: "Replaced by " }, { currency: "PKR" }] }],
    filter: "updated", changed: "baseCurrency",
  },
  {
    id: "MXN-1", actor: AA, timestamp: at(2026, 2, 10, 10, 15), kind: "fx",
    verb: "deactivated this currency",
    rows: [{ kind: "status", before: "Active", after: "Inactive" }],
    filter: "updated", changed: "status",
  },
  {
    id: "MXN-2", actor: AA, timestamp: at(2026, 3, 15, 9, 40), kind: "fx",
    verb: "activated this currency",
    rows: [{ kind: "status", before: "Inactive", after: "Active" }],
    filter: "updated", changed: "status",
  },
  {
    id: "MXN-3", actor: AA, timestamp: at(2026, 3, 15, 9, 42), kind: "fx",
    verb: "added a note",
    rows: [{ kind: "note", text: MXN_NOTE }],
    filter: "added", changed: "notes",
  },
  // The shared edited-text entry: the note as it now reads, the change marked in place.
  { id: "MXN-4", actor: AA, timestamp: at(2026, 3, 18, 11, 5), kind: "descriptionEdited", before: MXN_NOTE, after: MXN_NOTE_EDITED },
  { id: "MXN-5", actor: AA, timestamp: at(2026, 3, 18, 11, 10), kind: "attachmentsChanged", added: [SUPPLY_AGREEMENT], removed: [] },
  { id: "MXN-6", actor: AA, timestamp: at(2026, 6, 3, 16, 20), kind: "attachmentsChanged", added: [], removed: [SUPPLY_AGREEMENT] },
  {
    id: "MXN-7", actor: AA, timestamp: at(2026, 6, 10, 15, 0), kind: "fx",
    verb: "removed a note",
    rows: [
      { kind: "note", text: MXN_NOTE_EDITED },
      { kind: "sentence", parts: [{ t: "Written by " }, { person: AA }, { t: " on " }, { v: "March 15, 2026" }] },
    ],
    filter: "removed", changed: "notes",
  },
];

/** The other halves of the 5 January change, on the currencies they land on. */
const CURRENCY_EVENTS: Record<string, ActivityEvent[]> = {
  MXN: MXN_EVENTS,
  USD: [
    {
      id: "USD-9", actor: AA, timestamp: at(2026, 1, 5, 9, 0), kind: "fx",
      verb: "replaced this currency as the base currency",
      rows: [{ kind: "sentence", parts: [{ t: "Replaced by " }, { currency: "MXN" }] }],
      filter: "updated", changed: "baseCurrency",
    },
  ],
  PKR: [
    {
      id: "PKR-8", actor: AA, timestamp: at(2026, 1, 5, 9, 20), kind: "fx",
      verb: "set this currency as the base currency",
      rows: [{ kind: "sentence", parts: [{ t: "Replaced " }, { currency: "MXN" }] }],
      filter: "updated", changed: "baseCurrency",
    },
  ],
};

/* ── The exchange rate: USD to PKR ───────────────────────────────────── */

const PAIR_NOTE = "Review this rate at the end of each quarter.";
const PAIR_NOTE_EDITED = "Review this rate at the end of each month.";
const BANK_CONFIRMATION: AttachmentFile = { name: "Bank rate confirmation May 2026.pdf", size: "248 KB" };

/** Exchange rate use cases 7, 8, 9, 12 and 13: USD to PKR's notes and file,
 * which no store holds. Its rate entries (use cases 1 to 5, 10 and 11) are
 * built from the app's own rate history and syncs, which carry the BA's
 * values (pages/recordTabs/activityHistory.ts), and come out word for word.
 * The mid-market and corporate views share this one log. */
const USD_PKR_EVENTS: ActivityEvent[] = [
  {
    id: "FX-7", actor: AA, timestamp: at(2026, 5, 4, 10, 0), kind: "fx",
    verb: "added a note",
    rows: [{ kind: "note", text: PAIR_NOTE }],
    filter: "added", changed: "notes",
  },
  { id: "FX-8", actor: AA, timestamp: at(2026, 5, 5, 9, 15), kind: "descriptionEdited", before: PAIR_NOTE, after: PAIR_NOTE_EDITED },
  { id: "FX-9", actor: AA, timestamp: at(2026, 5, 5, 9, 20), kind: "attachmentsChanged", added: [BANK_CONFIRMATION], removed: [] },
  { id: "FX-12", actor: AA, timestamp: at(2026, 6, 3, 16, 25), kind: "attachmentsChanged", added: [], removed: [BANK_CONFIRMATION] },
  {
    id: "FX-13", actor: AA, timestamp: at(2026, 6, 10, 15, 5), kind: "fx",
    verb: "removed a note",
    rows: [
      { kind: "note", text: PAIR_NOTE_EDITED },
      { kind: "sentence", parts: [{ t: "Written by " }, { person: AA }, { t: " on " }, { v: "May 4, 2026" }] },
    ],
    filter: "removed", changed: "notes",
  },
];

/** Each pair's log, by its source currency. */
const EXCHANGE_RATE_EVENTS: Record<string, ActivityEvent[]> = { USD: USD_PKR_EVENTS };

/** The records whose pages are drawn to end where their logs end: no notes
 * or files left on them (both were added and then removed). */
export const SHOWCASE_CURRENCY = "MXN";
export const SHOWCASE_PAIR = "USD";

const byNewest = (a: { timestamp: string }, b: { timestamp: string }) => +new Date(b.timestamp) - +new Date(a.timestamp);

/** A currency's own log. A currency the document gives no entries has an empty one. */
export const getCurrencyActivity = (code: string): ActivityEvent[] => [...(CURRENCY_EVENTS[code] ?? [])].sort(byNewest);

/** An exchange rate's own log, by its source currency (USD for USD to PKR). */
export const getExchangeRateActivity = (code: string): ActivityEvent[] => [...(EXCHANGE_RATE_EVENTS[code] ?? [])].sort(byNewest);

/** Module-neutral name every stamped copy of the renderer calls. */
export const getActivity = (code: string): ActivityEvent[] => getCurrencyActivity(code);
