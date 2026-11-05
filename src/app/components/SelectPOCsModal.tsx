import React, { useCallback, useEffect, useMemo, useState } from "react";
import { X, Maximize2, Minimize2, Users, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { TooltipProvider } from "./ui/tooltip";
import { FONT } from "./designTokens";
import { ContactsDirectoryPage } from "./ContactsDirectoryPage";
import {
  CONTACT_DICTIONARY,
  type ContactPerson,
} from "./pocDirectoryData";

/**
 * SelectPOCsModal — verbatim port of Partners'
 * `SelectPocDictionaryModal` (`Partners/.../PocModals.tsx:301-411`).
 *
 * This is the modal that opens from the "Contact Directory" button on
 * Partners' Vendor Detail → Point of Contact → All POCs tab. The shell
 * mirrors Partners 1:1:
 *   - Header: `Select Point of Contact` title + tagline ("Choose from your
 *     saved contacts or create a new one to assign to <contextLabel>") +
 *     `Full view` ↔ `Exit full` toggle + X close.
 *   - Body: edge-to-edge slim toolbar (Search + Create New) over the POC
 *     directory table. The table itself comes from `POCDirectoryTable`
 *     (already a verbatim port of `ContactsDirectoryPage`'s row/column
 *     recipe).
 *   - Footer: live selection-count pill (Users icon + count + "selected")
 *     on the left, `Cancel` + `Confirm Selection` buttons on the right.
 *
 * Sizing class matches Partners' `modalSizeClass`: max-w 70vw capped at
 * 1320px in the normal state, edge-to-edge with 2rem inset in full view.
 *
 * Wiring (PO Detail page):
 *   - `initialSelectedNames` resolves to row ids on open so the picker
 *     pre-checks contacts already attached to the PO (primary + secondary).
 *   - `lockedNames` keeps the primary contact merged into the selected set
 *     so the picker can't strip it.
 *   - `onApply(picked)` returns the full `ContactPerson[]` so the host can
 *     update `po.secondaryContactNames` via the existing `updatePOContacts`
 *     store action.
 */

export interface SelectPOCsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Names of contacts already attached to the PO Detail page — used to pre-check rows. */
  initialSelectedNames?: string[];
  /** Names that should be locked (e.g. the primary contact already on the PO). Locked rows
   *  cannot be unchecked from the picker. */
  lockedNames?: string[];
  /** Optional context label rendered in the tagline, e.g. "this purchase order" or "PO #X". */
  contextLabel?: string;
  /** Fired when the user clicks "Confirm Selection" — host wires this to its store. */
  onApply: (contacts: ContactPerson[]) => void;
}

export function SelectPOCsModal({
  open,
  onOpenChange,
  initialSelectedNames = [],
  lockedNames = [],
  contextLabel = "this purchase order",
  onApply,
}: SelectPOCsModalProps) {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Resolve `initialSelectedNames` → ids on open. Search/density/column-
  // visibility/filter state all lives inside the embedded ContactsDirectoryPage.
  useEffect(() => {
    if (!open) return;
    const initialIds = new Set<string>();
    CONTACT_DICTIONARY.forEach((c) => {
      if (initialSelectedNames.includes(c.name)) initialIds.add(c.id);
    });
    setSelectedIds(initialIds);
  }, [open, initialSelectedNames]);

  // Locked ids — merged back into every selection-change so the table's
  // select-all toggle can't strip the primary contact from the picked set.
  const lockedIds = useMemo(() => {
    const ids = new Set<string>();
    CONTACT_DICTIONARY.forEach((c) => {
      if (lockedNames.includes(c.name)) ids.add(c.id);
    });
    return ids;
  }, [lockedNames]);

  /** Bridge between `ContactsDirectoryPage`'s `onSelectionChange` (new Set<string>)
   *  and our local state. Re-merges locked ids so the table's select-all toggle
   *  can't strip the host's primary contact from the picked set. Memoized so the
   *  embedded directory's effects don't re-fire every render. */
  const handleSelectionChange = useCallback(
    (ids: Set<string>) => {
      const merged = new Set(ids);
      lockedIds.forEach((id) => merged.add(id));
      setSelectedIds(merged);
    },
    [lockedIds],
  );

  const handleApply = () => {
    const picked = CONTACT_DICTIONARY.filter((c) => selectedIds.has(c.id));
    onApply(picked);
    onOpenChange(false);
  };

  // Partners' `modalSizeClass` (`PocModals.tsx:325-327`) — single source of
  // truth for the full-view ↔ normal sizing transitions.
  const modalBaseTransition =
    "transition-[max-width,max-height,border-radius] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]";
  const modalSizeClass = isFullScreen
    ? `!fixed !inset-0 !translate-x-0 !translate-y-0 !m-auto !w-full !h-full ${modalBaseTransition} !max-w-[calc(100%-1rem)] sm:!max-w-[calc(100%-1.5rem)] lg:!max-w-[calc(100%-2rem)] !max-h-[calc(100%-1rem)] sm:!max-h-[calc(100%-1.5rem)] lg:!max-h-[calc(100%-2rem)] !rounded-2xl`
    : `!fixed !top-[50%] !left-[50%] !translate-x-[-50%] !translate-y-[-50%] !w-[calc(100%-2rem)] ${modalBaseTransition} !max-w-[100%] sm:!max-w-[min(70vw,1320px)] !max-h-[100dvh] sm:!max-h-[90vh] rounded-none sm:!rounded-2xl`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        // `[&>button.absolute]:hidden` — hide shadcn's baked-in
        // `DialogPrimitive.Close` so only our custom header X is shown
        // (Partners uses `hideCloseButton` for the same effect).
        className={`flex flex-col p-0 gap-0 border-0 sm:border [&>button.absolute]:hidden ${modalSizeClass}`}
        style={{ zIndex: 210, boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)" }}
      >
        <DialogTitle className="sr-only">Select point of contact</DialogTitle>
        <DialogDescription className="sr-only">
          Choose contacts from the contact directory to associate with {contextLabel}.
        </DialogDescription>

        <TooltipProvider delayDuration={150}>
          {/* ─── Header ─── (verbatim port of Partners `PocModals.tsx:341-365`) */}
          <div className="px-5 pt-4 pb-3 shrink-0 border-b border-border bg-white rounded-t-none sm:rounded-t-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2
                  className="text-[15px] sm:text-[17px] text-foreground"
                  style={{ fontWeight: 700, fontFamily: FONT }}
                >
                  Select Point of Contact
                </h2>
                <p
                  className="text-[12px] text-slate-500 mt-0.5"
                  style={{ fontWeight: 400, fontFamily: FONT }}
                >
                  Choose from your saved contacts or create a new one to assign to {contextLabel}.
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setIsFullScreen((v) => !v)}
                  className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-white text-xs text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
                  style={{ fontWeight: 500, fontFamily: FONT }}
                  title={isFullScreen ? "Exit full view" : "Expand to full view"}
                >
                  {isFullScreen ? (
                    <Minimize2 className="w-3.5 h-3.5" />
                  ) : (
                    <Maximize2 className="w-3.5 h-3.5" />
                  )}
                  {isFullScreen ? "Exit full" : "Full view"}
                </button>
                <button
                  onClick={() => onOpenChange(false)}
                  aria-label="Close"
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all cursor-pointer"
                >
                  <X style={{ width: 18, height: 18 }} />
                </button>
              </div>
            </div>
          </div>

          {/* ─── Body — embedded ContactsDirectoryPage (verbatim port of
                Partners' embed at `PocModals.tsx:367-392`). The directory
                ships its own toolbar (search, density, column drawer,
                filter pills, pagination) so we don't need a separate one
                in the modal chrome. ─── */}
          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
            <ContactsDirectoryPage
              embedded
              embeddedContacts={CONTACT_DICTIONARY}
              selectable
              selectedIds={selectedIds}
              onSelectionChange={handleSelectionChange}
              /* Stakeholder ask: slim the picker down to the five columns
                 needed to identify a contact — Contact, Title, Company,
                 Phone, Email. Everything else (Department, Social, Linked
                 Partners, Linked Entities, Locations, Created By/On,
                 Status) is hidden on mount.
                 `compactToolbar` removes the column-drawer trigger so the
                 user can't re-enable the hidden columns from inside the
                 picker, and `hideActions` strips the sticky-right Actions
                 column (Edit / Archive / etc. aren't relevant when the
                 surface is purely a selection picker). */
              defaultVisibleColumns={["contact_name", "role", "company", "phones", "emails"]}
              compactToolbar
              hideActions
              embeddedToolbarRight={
                <button
                  type="button"
                  onClick={() => {
                    /* Partners shows a Create New POC modal here. Mirroring
                       the button keeps the toolbar identical; wiring the
                       creation flow is a follow-up if you want it next. */
                  }}
                  className="inline-flex items-center justify-center h-9 gap-1.5 px-3 rounded-lg bg-primary text-white shadow-sm hover:bg-[#0960D9] transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  style={{ fontWeight: 500, fontFamily: FONT }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="text-sm">Create New</span>
                </button>
              }
            />
          </div>

          {/* ─── Footer — verbatim port of Partners `PocModals.tsx:395-407`:
                live count pill on the left, Cancel + Confirm Selection on
                the right. ─── */}
          <div className="px-5 py-3 border-t border-border bg-white rounded-b-none sm:rounded-b-2xl flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/8 border border-primary/12">
                <Users className="w-3 h-3 text-primary" />
                <span
                  className="text-[11px] text-primary tabular-nums"
                  style={{ fontWeight: 700, fontFamily: FONT }}
                >
                  {selectedIds.size}
                </span>
              </div>
              <span
                className="text-[13px] text-slate-500"
                style={{ fontWeight: 500, fontFamily: FONT }}
              >
                selected
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => onOpenChange(false)}
                className="px-4 py-2 rounded-lg border border-border bg-white text-[13px] text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                style={{ fontWeight: 500, fontFamily: FONT }}
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                className="px-5 py-2 rounded-lg bg-primary text-[13px] text-white hover:bg-[#0960D9] transition-colors shadow-sm cursor-pointer"
                style={{ fontWeight: 600, fontFamily: FONT }}
              >
                Confirm Selection
              </button>
            </div>
          </div>
        </TooltipProvider>
      </DialogContent>
    </Dialog>
  );
}
