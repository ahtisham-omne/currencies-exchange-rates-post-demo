// Ported from chart-of-accounts-v2.1/src/components/comms/ModifyTagModal.tsx; adapted: the modules, owners and picker copy are the Currency Library and the Exchange Rate Library (currencies and their rates) instead of the chart and the ledger.
/* Ported from the reporting module's comms cluster (its ModifyTagModal.tsx):
   the "move this conversation onto another record" dialog behind the thread
   menu's "Link email conversation to another record".

   Two things about this file differ from the rest of the port, both forced:

   1. Colour. Every other ported comms file names the source's primitives
      directly (var(--color-slate-500) and friends), which resolve because the
      tab root carries `data-comms`. This dialog is portalled to <body> by
      `Modal`, outside that element, so those custom properties do not resolve
      here. It uses the module's own utilities instead - `text-fg`,
      `text-fg-muted`, `border-border`, `bg-accent`, `text-primary`,
      `bg-success-50` - which work anywhere. The one literal hex is #CBD5E1, the
      source's --color-slate-300, for the two decorative glyphs: nothing in the
      module's scale is that light, and a mid-grey arrow reads as a control.

   2. The dropdown panels are portalled and measured against their trigger. The
      source hangs them off an `absolute` parent inside a dialog body with
      `overflow: visible`; `Modal`'s body is the dialog's one scroll container,
      so an absolute panel would be clipped at the fold instead of overhanging
      the dialog. */
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X, Check, Search, FileText, ChevronDown, Mail, Ban, CircleDashed, Info, ArrowDown, Folder, Link2, Coins, ArrowLeftRight } from 'lucide-react'
import { Button, ConfirmModal, Modal, Tooltip } from '../ui'
import { cn, fmtNumber } from '../../lib/utils'
import { useStore } from '../../store'
import {
  currencyOwners, ownersForModule, getOwnerSubRecords,
  type RecordOwner, type RecordOwnerKind, type RecordSource, type RecordSubRecord,
} from './recordDirectory'

interface ModifyTagModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm?: (targetModule: string, targetRecord: string) => void;
  currentQuoteNumber: string;
  /** Label for the source module. Accepted because the call site passes it;
   *  the source derives it and renders it nowhere, and neither does this. */
  sourceModuleLabel?: string;
  threadSender?: string;
  threadSubject?: string;
  /** Override the modal heading. Defaults to "Link email conversation to another record". */
  title?: string;
  /** Override the heading's subtitle (the one-liner under the title). */
  subtitle?: string;
  /** Override the Confirm button label. Defaults to "Confirm transfer". */
  confirmLabel?: string;
  /** Hide the From/Subject thread-info card under the heading. Useful when
   *  the modal is reused for a non-email flow (e.g. tagging a chat). */
  hideThreadInfo?: boolean;
  /** Hide the "Linked record" pill (where the email/thread is currently
   *  attached). Used when the source isn't a single record being moved. */
  hideCurrentLocation?: boolean;
  /** Label for the destination-module section. Defaults to "Move email
   *  conversation to a module"; passing "Add location" or similar adapts
   *  the modal to add-flows. */
  destinationLabel?: string;
}

// Alphabetical by label so the picker reads predictably regardless of how
// new modules are added.
/* The source listed its own app's modules. A thread on a currency screen can
 * only be filed against something these screens have: a currency, or one of
 * the exchange rates quoted for it. */
export const TAG_MODULES = [
  { key: 'currency-library', label: 'Currency Library', icon: Coins },
  { key: 'exchange-rates', label: 'Exchange Rates', icon: ArrowLeftRight },
];

/** Sentinel value emitted by `onConfirm` when the user picked "No record"
 *  in the destination module's record dropdown. Callers should detect
 *  this and route the transferred thread to the centralised Comms inbox
 *  under the Unmatched bucket instead of attaching it to a record. */
export const NO_RECORD_SENTINEL = "__NO_RECORD__";

/** What one row of the record picker states. */
interface PickerRecord { id: string; name: string; status: string }

const toPickerRecord = (o: RecordOwner): PickerRecord => ({ id: o.ref, name: o.name, status: o.status });

/* The library holds every ISO currency and a rate for each, so the open list
   renders a page of them and says so. The source's pool was small enough to render whole. */
const RENDER_CAP = 50;

function statusTint(status: string): string {
  if (status === 'Active') return 'bg-success-50 text-success-600';
  if (status === 'Archived') return 'bg-danger-50 text-danger-600';
  return 'bg-bg-subtle text-fg-muted';
}

// ─── Owner sub-record flow ────────────────────────────────────────────────

const ownerRecordTypes: { key: RecordOwnerKind; label: string; icon: typeof FileText }[] = [
  { key: 'rate', label: 'Exchange Rates', icon: ArrowLeftRight },
];

/* The source generated a partner's POs / SOs / Quotes / Contacts / Locations
 * here with a seeded pseudo-random helper. This module's equivalent hierarchy
 * (a currency owns the rates quoted for it) is real data, so the sub-list
 * comes from recordDirectory instead of being synthesised.
 *
 * NOTE: this feeds the sub-flow at `isOwnerFlow` below, which is
 * UNREACHABLE in the source too - see the comment there. */
function getOwnerSubRecordsFor(owner: RecordOwner, src: RecordSource): RecordSubRecord[] {
  return getOwnerSubRecords(owner, 'rate', src);
}

/* One dropdown panel, portalled and pinned under its trigger at the trigger's
   own width. `cap` is the source's max-height for that panel; the panel takes
   the lesser of it and the room actually left on screen, and flips above the
   trigger when there is more room there. */
function PickerMenu({ anchor, cap, header, children }: {
  anchor: React.RefObject<HTMLElement>;
  cap: number;
  header?: ReactNode;
  children: ReactNode;
}) {
  const [box, setBox] = useState<{ left: number; width: number; top?: number; bottom?: number; listMax: number } | null>(null);
  useLayoutEffect(() => {
    const el = anchor.current;
    if (!el) return;
    const place = () => {
      const r = el.getBoundingClientRect();
      const below = window.innerHeight - r.bottom - 8;
      const above = r.top - 8;
      const flip = below < 220 && above > below;
      const room = flip ? above : below;
      const listMax = Math.max(140, Math.min(cap, room - (header ? 52 : 8)));
      setBox({
        left: r.left,
        width: r.width,
        listMax,
        ...(flip ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }),
      });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [anchor, cap, header]);
  if (!box) return null;
  return createPortal(
    <div
      className="fixed z-[200] bg-white border border-border rounded-lg shadow-lg overflow-hidden animate-popover-down motion-reduce:animate-none"
      style={{ left: box.left, width: box.width, top: box.top, bottom: box.bottom }}
    >
      {header}
      <div className="overflow-y-auto py-1 scrollbar-thin" style={{ maxHeight: box.listMax }}>{children}</div>
    </div>,
    document.body,
  );
}

/* The search box shared by the module and owner panels. */
function PanelSearch({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="p-2 border-b border-border">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-fg-muted pointer-events-none" />
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="w-full h-8 pl-8 pr-3 text-[13px] border border-border rounded-md bg-white outline-none focus:border-primary"
          autoFocus
        />
      </div>
    </div>
  );
}

export function ModifyTagModal({ open, onClose, onConfirm, currentQuoteNumber, threadSender, threadSubject, title, subtitle, confirmLabel, hideThreadInfo, hideCurrentLocation, destinationLabel }: ModifyTagModalProps) {
  const currencies = useStore(s => s.currencies);
  const midMarketRates = useStore(s => s.midMarketRates);
  const standardRates = useStore(s => s.standardRates);

  const [selectedModule, setSelectedModule] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<string | null>(null);
  const [recordSearchQuery, setRecordSearchQuery] = useState('');
  const [moduleSearchQuery, setModuleSearchQuery] = useState('');
  const [moduleDropdownOpen, setModuleDropdownOpen] = useState(false);
  const [recordDropdownOpen, setRecordDropdownOpen] = useState(false);

  // ── Owner sub-flow state ──
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null);
  const [ownerSearchQuery, setOwnerSearchQuery] = useState('');
  const [ownerDropdownOpen, setOwnerDropdownOpen] = useState(false);
  const [ownerRecordType, setRecordOwnerKind] = useState<RecordOwnerKind>('rate');

  const moduleTriggerRef = useRef<HTMLButtonElement>(null);
  const recordFieldRef = useRef<HTMLDivElement>(null);
  const ownerTriggerRef = useRef<HTMLButtonElement>(null);

  /* Built once the picker is open, not on the record page's every render: the
     library runs to every ISO currency and nothing needs grouping until
     somebody asks to move a thread. */
  const pools = useMemo<Record<string, PickerRecord[]>>(() => {
    if (!open) return {};
    const src: RecordSource = { currencies, midMarketRates, standardRates };
    return Object.fromEntries(TAG_MODULES.map(m => [m.key, ownersForModule(m.key, src).map(toPickerRecord)]));
  }, [open, currencies, midMarketRates, standardRates]);
  const owners = useMemo(() => (open ? currencyOwners(currencies) : []), [open, currencies]);
  const selectedOwner = owners.find(o => o.id === selectedOwnerId) ?? null;
  const ownerSubRecords = useMemo(
    () => (selectedOwner ? getOwnerSubRecordsFor(selectedOwner, { currencies, midMarketRates, standardRates }) : []),
    [selectedOwner, currencies, midMarketRates, standardRates],
  );

  // ── Detach-confirm overlay ──
  // Driven by clicking the × on the current-linked-record chip. Same
  // "are you sure?" flow as the discard-draft confirmation in the
  // Compose popouts so the destructive action requires a deliberate
  // second click.
  const [detachConfirmOpen, setDetachConfirmOpen] = useState(false);

  // ── Animated placeholder for the record search input ──
  // Typewriter-style cycle through "Link a <thing>" examples so empty,
  // idle field still hints at what the user can do. Only used when the
  // user hasn't picked a module, typed a query, or selected a record —
  // any of those replace the placeholder with a more specific cue.
  const animatedPhrases = [
    'Link a currency',
    'Link an exchange rate',
  ];
  const [animatedPlaceholder, setAnimatedPlaceholder] = useState(animatedPhrases[0]);
  const placeholderIdle = open && !selectedModule && !selectedRecord && !recordSearchQuery;
  useEffect(() => {
    if (!placeholderIdle) return;
    let phraseIdx = 0;
    let charIdx = 0;
    let phase: 'typing' | 'holding' | 'erasing' | 'paused' = 'typing';
    let timer: ReturnType<typeof setTimeout> | null = null;
    const TYPE_MS = 55;
    const ERASE_MS = 30;
    const HOLD_MS = 1500;
    const PAUSE_MS = 320;
    const tick = () => {
      const phrase = animatedPhrases[phraseIdx];
      if (phase === 'typing') {
        charIdx += 1;
        setAnimatedPlaceholder(phrase.slice(0, charIdx));
        if (charIdx >= phrase.length) {
          phase = 'holding';
          timer = setTimeout(tick, HOLD_MS);
        } else {
          timer = setTimeout(tick, TYPE_MS);
        }
      } else if (phase === 'holding') {
        phase = 'erasing';
        timer = setTimeout(tick, ERASE_MS);
      } else if (phase === 'erasing') {
        charIdx -= 1;
        setAnimatedPlaceholder(phrase.slice(0, Math.max(0, charIdx)));
        if (charIdx <= 0) {
          phase = 'paused';
          timer = setTimeout(tick, PAUSE_MS);
        } else {
          timer = setTimeout(tick, ERASE_MS);
        }
      } else if (phase === 'paused') {
        phraseIdx = (phraseIdx + 1) % animatedPhrases.length;
        charIdx = 0;
        phase = 'typing';
        timer = setTimeout(tick, TYPE_MS);
      }
    };
    setAnimatedPlaceholder('');
    timer = setTimeout(tick, TYPE_MS);
    return () => { if (timer) clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeholderIdle]);

  if (!open) return null;

  /* UNREACHABLE, and it is unreachable in the source too. `selectedModule` is
   * only ever set from a TAG_MODULES key, from directIdSuggestion.moduleKey or
   * from a cross-module row - never to 'owner-subrecords', a string that
   * appears nowhere else in the source repo either. The three-step
   * owner -> sub-record picker below is therefore structurally present and
   * never rendered. Kept rather than deleted so this file stays a clean diff
   * against the source; retargeted onto currencies so it compiles honestly. */
  const isOwnerFlow = selectedModule === 'owner-subrecords';

  const getRecords = (moduleKey: string): PickerRecord[] => (moduleKey ? pools[moduleKey] ?? [] : []);

  const records = getRecords(selectedModule);
  const filteredRecords = recordSearchQuery
    ? records.filter(r =>
        r.id.toLowerCase().includes(recordSearchQuery.toLowerCase()) ||
        r.name.toLowerCase().includes(recordSearchQuery.toLowerCase())
      )
    : records;

  // Cross-module search pool — used when the record field is typed into
  // without a module being picked first. Each entry carries its source
  // module key so selecting one can populate both `selectedModule` and
  // `selectedRecord` in one go.
  const crossModuleResults = recordSearchQuery
    ? TAG_MODULES
        .flatMap(m => getRecords(m.key).map(r => ({ ...r, moduleKey: m.key, moduleLabel: m.label })))
        .filter(r =>
          r.id.toLowerCase().includes(recordSearchQuery.toLowerCase()) ||
          r.name.toLowerCase().includes(recordSearchQuery.toLowerCase()),
        )
        .slice(0, 25)
    : [];

  // Direct-ID suggestion — if the user types something that looks like a
  // record id (e.g. "CUR-USD", "CR-USD/PKR", "MR-EUR/PKR") AND it doesn't
  // already match an existing record, surface a "Link to <Module> <id>" row so
  // they can confirm without browsing. The module is inferred from the id
  // prefix using the same mapping a thread's ref is written with.
  const directIdSuggestion = (() => {
    const q = recordSearchQuery.trim().toUpperCase();
    if (!q) return null;
    // Loose pattern: uppercase prefix (1+ letters) + "-" + at least one
    // alphanumeric. Matches CUR-USD, CR-USD/PKR, MR-EUR/PKR.
    if (!/^[A-Z]+-[A-Z0-9][\w/-]*$/.test(q)) return null;
    const prefixToModule: Record<string, { moduleKey: string; moduleLabel: string }> = {
      'CUR': { moduleKey: 'currency-library', moduleLabel: 'Currency Library'      },
      'CR':  { moduleKey: 'exchange-rates',   moduleLabel: 'Exchange Rates' },
      'MR':  { moduleKey: 'exchange-rates',   moduleLabel: 'Exchange Rates' },
    };
    const prefix = q.split('-')[0];
    const meta = prefixToModule[prefix];
    if (!meta) return null;
    // If the typed id is already present in the current pool of results,
    // don't double-list it — the matching row will surface itself.
    const alreadyListed = (selectedModule
      ? filteredRecords.some(r => r.id.toUpperCase() === q)
      : crossModuleResults.some(r => r.id.toUpperCase() === q));
    if (alreadyListed) return null;
    return { id: q, ...meta };
  })();

  const selectedMod = TAG_MODULES.find(m => m.key === selectedModule);
  const SelectedIcon = selectedMod?.icon ?? FileText;
  const filteredModules = moduleSearchQuery
    ? TAG_MODULES.filter(m => m.label.toLowerCase().includes(moduleSearchQuery.toLowerCase()))
    : TAG_MODULES;

  const selectedRecordData = records.find(r => r.id === selectedRecord);

  // ── Owner sub-flow derived values ──
  const filteredOwners = ownerSearchQuery
    ? owners.filter(o =>
        o.name.toLowerCase().includes(ownerSearchQuery.toLowerCase()) ||
        o.ref.toLowerCase().includes(ownerSearchQuery.toLowerCase())
      )
    : owners;
  // Always keep the "No record" sentinel visible regardless of the search
  // query — it's the canonical opt-out and shouldn't disappear on a typo.
  const filteredRecordSubRecords = recordSearchQuery
    ? ownerSubRecords.filter(r =>
        r.isNoRecord ||
        r.id.toLowerCase().includes(recordSearchQuery.toLowerCase()) ||
        r.label.toLowerCase().includes(recordSearchQuery.toLowerCase())
      )
    : ownerSubRecords;
  const selectedRecordSubRecord = ownerSubRecords.find(r => r.id === selectedRecord) ?? null;

  const resetOwnerSubFlow = () => {
    setSelectedOwnerId(null);
    setOwnerSearchQuery('');
    setOwnerDropdownOpen(false);
    setRecordOwnerKind('rate');
  };

  const handleClose = () => {
    setSelectedModule('');
    setSelectedRecord(null);
    setRecordSearchQuery('');
    setModuleSearchQuery('');
    setModuleDropdownOpen(false);
    setRecordDropdownOpen(false);
    resetOwnerSubFlow();
    onClose();
  };

  const handleConfirm = () => {
    if (selectedRecord) {
      onConfirm?.(selectedModule, selectedRecord);
    }
    handleClose();
  };

  const handleDetachConfirm = () => {
    setDetachConfirmOpen(false);
    // Detach by routing the email to the unmatched bucket via the
    // existing NO_RECORD_SENTINEL contract — callers already handle
    // this (compose popout flips to "None" chip; hub routes to the
    // central inbox / unmatched).
    onConfirm?.(selectedModule || '', NO_RECORD_SENTINEL);
    // handleClose, not the source's bare onClose: a picker left holding the
    // record just detached would greet the next open with it still selected.
    handleClose();
  };

  return (
    <>
      <Modal
        open={open}
        onClose={handleClose}
        width="lg"
        title={title ?? "Link Email Conversation to Another Record"}
        subtitle={subtitle ?? "Move this conversation and link it to another record. One conversation is linked to a record"}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!selectedRecord || selectedRecord === currentQuoteNumber}
              onClick={handleConfirm}
            >
              {confirmLabel ?? "Confirm Transfer"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {/* Thread info */}
          {!hideThreadInfo && (threadSender || threadSubject) && (
            <div className="p-3 rounded-md border border-border bg-bg-subtle/50 text-sm space-y-1">
              {threadSender && (
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-fg-muted shrink-0" />
                  <span className="text-fg-muted font-medium shrink-0">From:</span>
                  <span className="text-fg">{threadSender}</span>
                </div>
              )}
              {threadSubject && (
                <div className="flex items-center gap-2">
                  <div className="w-3.5 shrink-0" />
                  <span className="text-fg-muted font-medium shrink-0">Subject:</span>
                  <span className="text-fg truncate">{threadSubject}</span>
                </div>
              )}
            </div>
          )}

          {/* Section 1 — Current linked record. Boxed card matching the
              Partner-module section pattern (light slate header strip +
              white body). The "What is a record?" Info icon sits inline
              next to the field label and reveals a white Partners-style
              tooltip on hover (no purple, no click). */}
          {!hideCurrentLocation && (
            <div className="rounded-lg border border-border bg-white shadow-xs">
              <div className="px-4 py-2.5 border-b border-border flex items-center gap-2 bg-bg-subtle/60 rounded-t-lg">
                <div className="w-6 h-6 rounded-md bg-accent flex items-center justify-center shrink-0">
                  <Link2 className="w-3.5 h-3.5 text-primary" />
                </div>
                <span id="modify-tag-linked-record-label" className="text-[13px] text-fg" style={{ fontWeight: 600 }}>Current Linked Record</span>
                <Tooltip
                  rich
                  align="left"
                  content={
                    <div className="max-w-[300px] px-4 py-3">
                      <p className="text-[12px] font-semibold text-fg mb-1">What is a record?</p>
                      <p className="text-[12px] leading-relaxed text-fg-muted">
                        A record is any created entity in Omne: a currency, an exchange rate, a report, etc.
                      </p>
                    </div>
                  }
                >
                  <button
                    type="button"
                    className="w-4 h-4 inline-flex items-center justify-center rounded text-fg-muted/60 hover:text-fg-muted transition-colors cursor-help"
                    aria-label="What is a record?"
                  >
                    <Info className="w-3.5 h-3.5" />
                  </button>
                </Tooltip>
              </div>
              <div className="px-4 py-3">
                {currentQuoteNumber ? (
                  <div
                    className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-primary/20 bg-accent"
                    aria-labelledby="modify-tag-linked-record-label"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 shrink-0 text-primary" />
                      <span className="text-[13px] font-semibold truncate text-primary">{currentQuoteNumber}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDetachConfirmOpen(true)}
                      className="w-6 h-6 inline-flex items-center justify-center rounded-md text-primary hover:bg-primary/10 transition-colors cursor-pointer shrink-0"
                      title="Detach record"
                      aria-label="Detach record"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border bg-bg-subtle/50"
                    aria-labelledby="modify-tag-linked-record-label"
                  >
                    {/* #CBD5E1 is the source's --color-slate-300; see the file header. */}
                    <CircleDashed className="w-4 h-4 text-[#CBD5E1] shrink-0" aria-hidden="true" />
                    <span className="text-[13px] text-fg-muted italic">None</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Illustrative arrow — light slate, decorative only. Sits
              between the two sections so the user reads the flow as
              "this record  →  move it here". */}
          {!hideCurrentLocation && (
            <div className="flex justify-center py-1" aria-hidden="true">
              <ArrowDown className="w-7 h-7 text-[#CBD5E1]" strokeWidth={1.75} />
            </div>
          )}

          {/* Section 2 — Move this conversation to a module. Same
              boxed-card pattern as Section 1, but the icon container
              uses the "destination/action" green palette so the two
              sections visually carry different roles. */}
          <div className="rounded-lg border border-border bg-white shadow-xs">
            <div className="px-4 py-2.5 border-b border-border flex items-center gap-2 bg-bg-subtle/60 rounded-t-lg">
              <div className="w-6 h-6 rounded-md bg-success-50 flex items-center justify-center shrink-0">
                <Folder className="w-3.5 h-3.5 text-success-600" />
              </div>
              <span className="text-[13px] text-fg" style={{ fontWeight: 600 }}>{destinationLabel ?? "Move Email Conversation to a Module"}</span>
              <Tooltip
                rich
                align="left"
                content={
                  <div className="max-w-[300px] px-4 py-3">
                    <p className="text-[12px] font-semibold text-fg mb-1">Where does the linked email move to?</p>
                    <p className="text-[12px] leading-relaxed text-fg-muted">
                      When an email is linked to a record, it appears in that record's communications history tab so anyone working on it is in the loop.
                    </p>
                    <p className="text-[12px] leading-relaxed text-fg-muted mt-2">
                      Unlinked emails only live in the central inbox.
                    </p>
                  </div>
                }
              >
                <button
                  type="button"
                  className="w-4 h-4 inline-flex items-center justify-center rounded text-fg-muted/60 hover:text-fg-muted transition-colors cursor-help"
                  aria-label="Where does the linked email move to?"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </Tooltip>
            </div>
            <div className="px-4 py-3 space-y-4">
          {/* Module dropdown — label now lives in the section header above. */}
          <div>
            <div className="relative">
              <button
                ref={moduleTriggerRef}
                type="button"
                onClick={() => { setModuleDropdownOpen(v => !v); setRecordDropdownOpen(false); }}
                aria-haspopup="listbox"
                aria-expanded={moduleDropdownOpen}
                aria-label="Select"
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors text-left',
                  moduleDropdownOpen ? 'border-primary ring-1 ring-primary/20' : 'border-border hover:border-border-strong'
                )}
              >
                <SelectedIcon className={cn('w-4 h-4', selectedMod ? 'text-primary' : 'text-fg-muted')} />
                <span className={cn('text-[13px] flex-1', selectedMod ? 'font-medium text-fg' : 'text-fg-muted')}>
                  {selectedMod?.label ?? 'Select...'}
                </span>
                <ChevronDown className={cn('w-4 h-4 text-fg-muted transition-transform', moduleDropdownOpen && 'rotate-180')} />
              </button>
              {moduleDropdownOpen && (
                <PickerMenu
                  anchor={moduleTriggerRef}
                  cap={360}
                  header={<PanelSearch value={moduleSearchQuery} onChange={setModuleSearchQuery} placeholder="Search..." />}
                >
                  {filteredModules.length === 0 ? (
                    <p className="text-sm text-fg-muted text-center py-4">No matches found</p>
                  ) : (
                    filteredModules.map(mod => {
                      const Icon = mod.icon;
                      const isSelected = selectedModule === mod.key;
                      return (
                        <button
                          key={mod.key}
                          onClick={() => { setSelectedModule(mod.key); setModuleDropdownOpen(false); setModuleSearchQuery(''); setSelectedRecord(null); setRecordSearchQuery(''); resetOwnerSubFlow(); }}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-2 text-left transition-colors',
                            isSelected ? 'bg-accent' : 'hover:bg-bg-subtle'
                          )}
                        >
                          <Icon className={cn('w-4 h-4 shrink-0', isSelected ? 'text-primary' : 'text-fg-muted')} />
                          <span className={cn('text-[13px] flex-1', isSelected ? 'font-semibold text-primary' : 'text-fg')}>{mod.label}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                        </button>
                      );
                    })
                  )}
                </PickerMenu>
              )}
            </div>
          </div>

          {/* Record selection — branches for the owner sub-flow */}
          {isOwnerFlow ? (
            <>
              {/* Owner dropdown */}
              <div>
                <p className="text-[12px] text-fg-muted mb-1.5 font-medium">Select Currency</p>
                <div className="relative">
                  <button
                    ref={ownerTriggerRef}
                    type="button"
                    onClick={() => { setOwnerDropdownOpen(v => !v); setRecordDropdownOpen(false); setModuleDropdownOpen(false); }}
                    aria-haspopup="listbox"
                    aria-expanded={ownerDropdownOpen}
                    aria-label="Select currency"
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors text-left',
                      ownerDropdownOpen ? 'border-primary ring-1 ring-primary/20' : 'border-border hover:border-border-strong'
                    )}
                  >
                    <Coins className="w-4 h-4 text-primary shrink-0" />
                    {selectedOwner ? (
                      <span className="flex-1 min-w-0 flex items-center gap-2">
                        <span className="text-[13px] font-medium text-fg truncate">{selectedOwner.name}</span>
                        <span className="text-[11px] text-fg-muted shrink-0">{selectedOwner.ref}</span>
                      </span>
                    ) : (
                      <span className="text-[13px] text-fg-muted flex-1">Choose a currency…</span>
                    )}
                    <ChevronDown className={cn('w-4 h-4 text-fg-muted transition-transform shrink-0', ownerDropdownOpen && 'rotate-180')} />
                  </button>
                  {ownerDropdownOpen && (
                    <PickerMenu
                      anchor={ownerTriggerRef}
                      cap={400}
                      header={<PanelSearch value={ownerSearchQuery} onChange={setOwnerSearchQuery} placeholder="Search currencies…" />}
                    >
                      {filteredOwners.length === 0 ? (
                        <p className="text-[13px] text-fg-muted text-center py-6">No currencies found</p>
                      ) : (
                        filteredOwners.slice(0, RENDER_CAP).map(o => {
                          const isSelected = selectedOwnerId === o.id;
                          return (
                            <button
                              key={o.id}
                              onClick={() => { setSelectedOwnerId(o.id); setOwnerDropdownOpen(false); setOwnerSearchQuery(''); setSelectedRecord(null); setRecordSearchQuery(''); }}
                              className={cn(
                                'w-full flex items-center justify-between gap-3 px-3 py-2 text-left transition-colors',
                                isSelected ? 'bg-accent' : 'hover:bg-bg-subtle'
                              )}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className={cn('text-[13px] font-medium truncate', isSelected ? 'text-primary' : 'text-fg')}>{o.name}</span>
                                </div>
                                <p className="text-[11px] text-fg-muted mt-0.5">{o.ref} · {o.meta}</p>
                              </div>
                              {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                            </button>
                          );
                        })
                      )}
                    </PickerMenu>
                  )}
                </div>
              </div>

              {/* Record-type pills + sub-record dropdown — only after an owner is
                  selected. A leading "No record" pill lets the user attach the
                  thread to the currency itself without drilling into its rates. */}
              {selectedOwner && (
                <>
                  <div>
                    <p className="text-[12px] text-fg-muted mb-1.5 font-medium">Record Type</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(() => {
                        const ownerScopedNoRecordId = selectedOwner.ref;
                        const noRecordActive = selectedRecord === ownerScopedNoRecordId;
                        return (
                          <button
                            key="norecord"
                            onClick={() => {
                              setSelectedRecord(ownerScopedNoRecordId);
                              setRecordSearchQuery('');
                              setRecordDropdownOpen(false);
                            }}
                            className={cn(
                              'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[12px] transition-colors',
                              noRecordActive
                                ? 'border-primary bg-accent text-primary'
                                : 'border-border bg-white text-fg hover:border-border-strong'
                            )}
                            style={{ fontWeight: 500 }}
                          >
                            <Ban className="w-3.5 h-3.5" />
                            No Record
                          </button>
                        );
                      })()}
                      {ownerRecordTypes.map(rt => {
                        const Icon = rt.icon;
                        const isActive = ownerRecordType === rt.key && selectedRecord !== selectedOwner.ref;
                        return (
                          <button
                            key={rt.key}
                            onClick={() => { setRecordOwnerKind(rt.key); setSelectedRecord(null); setRecordSearchQuery(''); setRecordDropdownOpen(false); }}
                            className={cn(
                              'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[12px] transition-colors',
                              isActive
                                ? 'border-primary bg-accent text-primary'
                                : 'border-border bg-white text-fg hover:border-border-strong'
                            )}
                            style={{ fontWeight: 500 }}
                          >
                            <Icon className="w-3.5 h-3.5" />
                            {rt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {selectedRecord !== selectedOwner.ref && (
                  <div>
                    <p className="text-[12px] text-fg-muted mb-1.5 font-medium">
                      Select {ownerRecordTypes.find(rt => rt.key === ownerRecordType)?.label} in {selectedOwner.name}
                    </p>
                    <div className="relative" ref={recordFieldRef}>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-fg-muted pointer-events-none" />
                        <input
                          type="text"
                          value={selectedRecord && !recordDropdownOpen ? `${selectedRecord} · ${selectedRecordSubRecord?.label ?? ''}` : recordSearchQuery}
                          onChange={e => { setRecordSearchQuery(e.target.value); setRecordDropdownOpen(true); setSelectedRecord(null); }}
                          onFocus={() => { setRecordDropdownOpen(true); setOwnerDropdownOpen(false); if (selectedRecord) { setRecordSearchQuery(''); setSelectedRecord(null); } }}
                          onBlur={() => { setTimeout(() => setRecordDropdownOpen(false), 200); }}
                          placeholder="Search records…"
                          aria-label="Search the currency's rates"
                          aria-haspopup="listbox"
                          aria-expanded={recordDropdownOpen}
                          className={cn(
                            'w-full h-10 pl-9 pr-3 text-[13px] border rounded-lg bg-white outline-none transition-colors',
                            recordDropdownOpen ? 'border-primary ring-1 ring-primary/20' : 'border-border'
                          )}
                        />
                      </div>
                      {recordDropdownOpen && (
                        <PickerMenu anchor={recordFieldRef} cap={400}>
                          {filteredRecordSubRecords.length === 0 ? (
                            <p className="text-[13px] text-fg-muted text-center py-6">No records found</p>
                          ) : (
                            filteredRecordSubRecords.slice(0, RENDER_CAP).map((r, idx) => {
                              const isSelected = selectedRecord === r.id;
                              const nextIsRegular = filteredRecordSubRecords[idx + 1] && !filteredRecordSubRecords[idx + 1].isNoRecord;
                              return (
                                <Fragment key={r.id}>
                                  <button
                                    onMouseDown={(e) => { e.preventDefault(); setSelectedRecord(r.id); setRecordSearchQuery(''); setRecordDropdownOpen(false); }}
                                    className={cn(
                                      'w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors',
                                      isSelected ? 'bg-accent' : 'hover:bg-bg-subtle',
                                    )}
                                  >
                                    <div className="min-w-0">
                                      {r.isNoRecord ? (
                                        <>
                                          <span className={cn('text-[13px] font-medium', isSelected ? 'text-primary' : 'text-fg')}>No Record</span>
                                          <p className="text-[11px] text-fg-muted mt-0.5">
                                            Attach the thread to {selectedOwner?.name ?? 'this record'} without linking a specific record.
                                          </p>
                                        </>
                                      ) : (
                                        <>
                                          <div className="flex items-center gap-2">
                                            <span className={cn('text-[13px] font-medium', isSelected ? 'text-primary' : 'text-fg')}>{r.id}</span>
                                            {r.status && (
                                              <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', statusTint(r.status))}>
                                                {r.status}
                                              </span>
                                            )}
                                          </div>
                                          <p className="text-[11px] text-fg-muted mt-0.5">{r.label}</p>
                                        </>
                                      )}
                                    </div>
                                    {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                                  </button>
                                  {r.isNoRecord && nextIsRegular && (
                                    <div className="border-t border-border mx-3 my-1" />
                                  )}
                                </Fragment>
                              );
                            })
                          )}
                          {filteredRecordSubRecords.length > RENDER_CAP && (
                            <p className="text-[11px] text-fg-muted text-center py-2 px-3">
                              Showing the first {RENDER_CAP} of {fmtNumber(filteredRecordSubRecords.length)}. Keep typing to narrow the list.
                            </p>
                          )}
                        </PickerMenu>
                      )}
                    </div>
                  </div>
                  )}
                </>
              )}
            </>
          ) : (
            /* Record dropdown */
            <div>
              <p className="text-[12px] text-fg-muted mb-1.5 font-medium">Select Record</p>
              <div className="relative" ref={recordFieldRef}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-fg-muted pointer-events-none" />
                  <input
                    type="text"
                    value={
                      selectedRecord && !recordDropdownOpen
                        ? (selectedRecord === NO_RECORD_SENTINEL
                            ? "No Record"
                            : `${selectedRecord} · ${selectedRecordData?.name ?? ''}`)
                        : recordSearchQuery
                    }
                    onChange={e => { setRecordSearchQuery(e.target.value); setRecordDropdownOpen(true); setSelectedRecord(null); }}
                    onFocus={() => { setRecordDropdownOpen(true); setModuleDropdownOpen(false); if (selectedRecord) { setRecordSearchQuery(''); setSelectedRecord(null); } }}
                    onBlur={() => { setTimeout(() => setRecordDropdownOpen(false), 200); }}
                    placeholder={selectedMod ? `Search ${selectedMod.label}...` : `${animatedPlaceholder}${animatedPlaceholder.length > 0 ? ' ' : ''}`}
                    aria-label={`Search ${selectedMod?.label ?? 'records'}`}
                    aria-haspopup="listbox"
                    aria-expanded={recordDropdownOpen}
                    className={cn(
                      'w-full h-10 pl-9 pr-3 text-[13px] border rounded-lg bg-white outline-none transition-colors',
                      recordDropdownOpen ? 'border-primary ring-1 ring-primary/20' : 'border-border'
                    )}
                  />
                </div>
                {recordDropdownOpen && (
                  <PickerMenu anchor={recordFieldRef} cap={400}>
                    {/* When a module is picked: show the in-module "No
                        record" sentinel + the module-scoped records. When
                        no module is picked: search across every module so
                        the user can find a record without choosing the
                        module first — selecting one will auto-populate
                        the module field above. */}
                    {/* Direct-ID suggestion — surfaces when the typed
                        query parses as a record id but isn't already in
                        the result pool. Selecting it links to that exact
                        id (handy for ids not in the pool, e.g. an entry
                        the user already knows by number). */}
                    {directIdSuggestion && (
                      <Fragment>
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setSelectedModule(directIdSuggestion.moduleKey);
                            setSelectedRecord(directIdSuggestion.id);
                            setRecordSearchQuery('');
                            setRecordDropdownOpen(false);
                          }}
                          className="w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-accent"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[13px] font-medium text-primary">Link to {directIdSuggestion.id}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-accent text-primary">
                                {directIdSuggestion.moduleLabel}
                              </span>
                            </div>
                            <p className="text-[11px] text-fg-muted mt-0.5">Use this exact ID — module is inferred from the prefix.</p>
                          </div>
                        </button>
                        <div className="border-t border-border mx-3 my-1" />
                      </Fragment>
                    )}
                    {selectedModule ? (
                      <>
                        {(() => {
                          const isSelected = selectedRecord === NO_RECORD_SENTINEL;
                          return (
                            <Fragment>
                              <button
                                onMouseDown={(e) => { e.preventDefault(); setSelectedRecord(NO_RECORD_SENTINEL); setRecordSearchQuery(''); setRecordDropdownOpen(false); }}
                                className={cn(
                                  'w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors',
                                  isSelected ? 'bg-accent' : 'hover:bg-bg-subtle',
                                )}
                              >
                                <div className="min-w-0">
                                  <span className={cn('text-[13px] font-medium', isSelected ? 'text-primary' : 'text-fg')}>No Record</span>
                                  <p className="text-[11px] text-fg-muted mt-0.5">
                                    Tag in {selectedMod?.label ?? 'this module'} without linking a specific record.
                                  </p>
                                </div>
                                {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                              </button>
                              {filteredRecords.length > 0 && <div className="border-t border-border mx-3 my-1" />}
                            </Fragment>
                          );
                        })()}
                        {filteredRecords.slice(0, RENDER_CAP).map((record) => {
                          const isCurrent = record.id === currentQuoteNumber;
                          const isSelected = selectedRecord === record.id;
                          return (
                            <button
                              key={record.id}
                              onMouseDown={(e) => { e.preventDefault(); setSelectedRecord(record.id); setRecordSearchQuery(''); setRecordDropdownOpen(false); }}
                              className={cn(
                                'w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors',
                                isSelected ? 'bg-accent' : 'hover:bg-bg-subtle',
                              )}
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={cn('text-[13px] font-medium', isSelected ? 'text-primary' : 'text-fg')}>{record.id}</span>
                                  {isCurrent && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-subtle text-fg-muted font-medium">Current</span>
                                  )}
                                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', statusTint(record.status))}>
                                    {record.status}
                                  </span>
                                </div>
                                <p className="text-[11px] text-fg-muted mt-0.5">{record.name}</p>
                              </div>
                              {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                            </button>
                          );
                        })}
                        {filteredRecords.length > RENDER_CAP && (
                          <p className="text-[11px] text-fg-muted text-center py-2 px-3">
                            Showing the first {RENDER_CAP} of {fmtNumber(filteredRecords.length)}. Keep typing to narrow the list.
                          </p>
                        )}
                      </>
                    ) : recordSearchQuery ? (
                      crossModuleResults.length === 0 ? (
                        directIdSuggestion ? null : (
                          <p className="text-[12px] text-fg-muted text-center py-6 px-3">
                            No records match "{recordSearchQuery}". Pick a module above to browse all records.
                          </p>
                        )
                      ) : (
                        crossModuleResults.map((record) => {
                          const isCurrent = record.id === currentQuoteNumber;
                          const isSelected = selectedRecord === record.id;
                          return (
                            <button
                              key={`${record.moduleKey}:${record.id}`}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setSelectedModule(record.moduleKey);
                                setSelectedRecord(record.id);
                                setRecordSearchQuery('');
                                setRecordDropdownOpen(false);
                              }}
                              className={cn(
                                'w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors',
                                isSelected ? 'bg-accent' : 'hover:bg-bg-subtle',
                              )}
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={cn('text-[13px] font-medium', isSelected ? 'text-primary' : 'text-fg')}>{record.id}</span>
                                  {isCurrent && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-subtle text-fg-muted font-medium">Current</span>
                                  )}
                                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-accent text-primary">
                                    {record.moduleLabel}
                                  </span>
                                </div>
                                <p className="text-[11px] text-fg-muted mt-0.5">{record.name}</p>
                              </div>
                              {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                            </button>
                          );
                        })
                      )
                    ) : (
                      <p className="text-[12px] text-fg-muted text-center py-6 px-3">
                        Start typing a record ID (e.g. CUR-USD) or pick a module above to browse.
                      </p>
                    )}
                  </PickerMenu>
                )}
              </div>
            </div>
          )}
            </div>{/* /Section 2 body */}
          </div>{/* /Section 2 card */}
        </div>
      </Modal>

      {/* Detach confirm — the module's confirmation pattern rather than the
          source's inline card, so a destructive action asks the way every
          other destructive action in the module asks. */}
      <ConfirmModal
        open={detachConfirmOpen}
        tone="danger"
        icon={<Link2 size={26} className="text-danger-600" />}
        title="Detach this record?"
        description={
          <>
            This email will no longer be linked to <span className="font-medium text-fg">{currentQuoteNumber}</span>. You can re-link it any time.
          </>
        }
        confirmLabel="Detach"
        dismissLabel="Keep Linked"
        onConfirm={handleDetachConfirm}
        onDismiss={() => setDetachConfirmOpen(false)}
      />
    </>
  );
}
