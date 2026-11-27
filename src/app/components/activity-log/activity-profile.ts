/* Currency & Exchange Rates' two logs: a currency's and an exchange rate's
 * (Mahreen Ghafoor, "Activity Logs: Currency & Exchange Rates", 16 Nov 2026).
 * The types below are the shared log's; the profiles at the end are ours. */
import type { ReactNode } from "react";

import { SIGNED_IN, type ActivityEvent, type AttachmentFile } from "./activity-data";
import { FX_KINDS } from "./currency-kinds";

/**
 * What makes one module's activity log read as THAT module's. The renderer is
 * generic over value kinds (text, code, status, person, tags, attachments,
 * entity) and over the shared event kinds (created, childAdded,
 * childStatusChanged, attachmentsChanged, fields, descriptionEdited,
 * descriptionRewritten); everything module-specific — the nouns in the
 * sentences, which fields the Changed pill offers, and any event kind only
 * this module can log — lives here and is passed in as a prop, so every
 * module runs the same component with the same logic and interactions.
 */
export type EntityProfile = {
  /** Lower-case noun used in sentences: "created this warehouse". */
  /** The module's hover card for a linked entity, by its name; undefined
   * when the module has none for it (the link renders bare). */
  entityHover?: (text: string, link: ReactNode) => ReactNode | undefined;
  entityNoun: string;
  /** The Event filter's options, when a module has other than the four
   * (Added, Created, Removed, Updated), e.g. Deleted. */
  eventOptions?: ("created" | "added" | "removed" | "updated" | "deleted")[];
  /** Capitalised label for the person dialog's stat cell and the attachment preview's source line. */
  entityLabel: string;
  /** The child entity this record can contain: "added the location LOC-…", "updated the status of the location …". */
  childNoun: string;
  /** Changed-pill key and label for child-entity events. */
  childChangedKey: string;
  childChangedLabel: string;
  /** The signed-in user of this module, as shown in its top bar — what Me mode filters on. */
  currentUser?: string;
  /** false = status is one plain field whose every change is a pair
   * ("updated the status from Active to Archived"), never the archive /
   * restore verbs. Defaults to true. */
  statusVerbs?: boolean;
  /** Folds child-record entries into this log behind an "Include {childNoun}
   * changes" switch, off on open: returns the child an entry happened on, or
   * undefined for the record's own entries. Absent = no switch. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  childOf?: (event: any) => { name: string; href: string } | undefined;
  /** The record's long-text field ("description", "notes"): gets the marked passage and Show Comparison. Defaults to "description". */
  longTextNoun?: string;
  /** Field names as the data writes them (lower-cased) -> Changed-pill key. Merged over the generic defaults. */
  fieldToChangedKey: Record<string, string>;
  /** Changed-pill key -> label. Merged over the generic defaults. */
  changedLabels: Record<string, string>;
  /** Event kinds only this module logs, keyed by `event.kind`. */
  extraKinds: Record<string, ExtraKindSpec>;
};

/** One dotted sub-row of a custom kind: the node the card renders and the
 * plain-text form search reads. */
export type SubRow = { node: ReactNode; text: string };
export type EventParts = {
  head: ReactNode;
  longRow: ReactNode | null;
  /** Independent edits that shared a save — rendered as the generic
   * sub-row list (dots, rail, "Show N more"), never a layout of their own. */
  subRows?: SubRow[];
};

export type ExtraKindContext = {
  query: string;
  highlight: boolean;
  onOpenCompare?: () => void;
  onOpenAttachment?: (file: AttachmentFile) => void;
};

/** One module-unique event kind. `parts` builds the sentence from the leaf
 * primitives the renderer exports (ActorLink, EntityLink, StatusPillNode,
 * Lead, Sep, LabelledFromTo, …) so it looks and behaves like every built-in
 * kind; the other three keep search, the Event pill and the Changed pill
 * working for it. */
export type ExtraKindSpec = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parts: (event: any, ctx: ExtraKindContext) => EventParts;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  searchText: (event: any) => string[];
  /** Plain text per sub-row, same order as parts().subRows — lets search open a card whose match sits past "Show N more". */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  subRowText?: (event: any) => string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  changedFields: (event: any) => string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  eventKind: (event: any) => "created" | "added" | "removed" | "updated" | "deleted";
  /** One change with its facts, never a multi-change save: its rows never
   * collapse behind "Show N more". Defaults to false. A function decides
   * per event, for a kind where some actions act on several records. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  singleChange?: boolean | ((event: any) => boolean);
  /** Provenance for the timestamp line, in appliedFrom's slot: metadata
   * about where a change came from, never a change itself. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  provenance?: (event: any) => string | undefined;
};

/** Generic defaults every module inherits; a profile only lists what it adds. */
export const GENERIC_FIELD_TO_CHANGED_KEY: Record<string, string> = {
  status: "status",
  tags: "tags",
  attachments: "attachments",
  description: "description",
  name: "name",
  code: "code",
};

export const GENERIC_CHANGED_LABELS: Record<string, string> = {
  status: "Status",
  tags: "Tags",
  attachments: "Attachments",
  description: "Description",
  name: "Name",
  code: "Code",
};

/* Both logs: Event keeps the four fixed buckets (the BA's document); Changed
 * offers only the groups a log holds, in the document's words. A note is the
 * shared long-text field ("updated the note"), so every note entry, added,
 * edited or removed, files under its key and reads "Notes". */

/** A currency's own log: status, notes, attachments and the base currency. */
export const CURRENCY_PROFILE: EntityProfile = {
  entityNoun: "currency",
  entityLabel: "Currency",
  currentUser: SIGNED_IN,
  childNoun: "",
  childChangedKey: "",
  childChangedLabel: "",
  longTextNoun: "note",
  fieldToChangedKey: {},
  changedLabels: { description: "Notes", baseCurrency: "Base currency" },
  extraKinds: FX_KINDS,
};

/** An exchange rate's own log (USD to PKR): both of its rates, its notes and
 * attachments. The mid-market and corporate views show the same log. */
export const EXCHANGE_RATE_PROFILE: EntityProfile = {
  entityNoun: "exchange rate",
  entityLabel: "Exchange Rate",
  currentUser: SIGNED_IN,
  childNoun: "",
  childChangedKey: "",
  childChangedLabel: "",
  longTextNoun: "note",
  fieldToChangedKey: {},
  changedLabels: { description: "Notes", corporateRate: "Corporate rate", midMarketRate: "Daily market rate" },
  extraKinds: FX_KINDS,
};

/** The profile this copy of the renderer runs with — the one identifier the stamp script never has to touch. */
export const MODULE_PROFILE: EntityProfile = CURRENCY_PROFILE;

export type { ActivityEvent };
