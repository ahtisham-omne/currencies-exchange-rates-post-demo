import { useMemo, useState } from "react";
import { ExternalLink, Plus } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
import { SalesRepSelector, type SalesRepOption, type SelectedSalesRep } from "@/app/components/shared/SalesRepSelector";
import { USER_EMAILS } from "./importCatalog";

/* The options are the users this import validates against, not the quote
   module's own rep roster: those two fixture sets use different domains, and a
   pick that fails the very validation that opened the picker is worse than no
   picker at all. Names and initials are derived so the selector still shows a
   person rather than an address. */
const SALES_REP_ROSTER = USER_EMAILS.map((email) => {
  const parts = email.split("@")[0].split(".");
  const name = parts.filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
  return {
    id: email,
    name,
    email,
    initials: name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(),
    isCurrentUser: false,
  };
});
import { ENTITY_META } from "./importSpec";

/**
 * The sales-rep cell.
 *
 * The module's rep selector goes straight into the cell, not into a modal
 * wrapped around it: a list of six people does not need a dialog, and the
 * sheet already has a place to put a panel. So this is the same popover shape
 * the unit and status cells use, with the module's own selector as the body,
 * its avatars, its search, its primary star, its checkboxes.
 *
 * Selection follows the column. The Sales Rep column holds one rep, so the
 * primary is what lands. Secondary Sales Reps is a list column, so every
 * selection lands, pipe-separated, which is the notation the template uses
 * everywhere else.
 *
 * The create route is the one thing the module's selector has no reason to
 * carry, so the cell adds it under the panel.
 */
export function RepCellDropdown({
  value,
  multiple,
  onCommit,
  onCancel,
}: {
  value: string;
  /** True for the list column, where every pick is kept. */
  multiple: boolean;
  onCommit: (next: string) => void;
  onCancel: () => void;
}) {
  const meta = ENTITY_META.user;

  const available: SalesRepOption[] = useMemo(
    () => SALES_REP_ROSTER.map((r) => ({
      id: r.id, name: r.name, initials: r.initials, isCurrentUser: !!r.isCurrentUser, isCustomerDefault: false,
    })),
    [],
  );

  /* The file identifies reps by email or by name; both resolve here. */
  const [selected, setSelected] = useState<SelectedSalesRep[]>(() => {
    const wanted = value.split("|").map((v) => v.trim().toLowerCase()).filter(Boolean);
    return SALES_REP_ROSTER
      .filter((r) => wanted.includes(r.name.toLowerCase()) || wanted.includes(r.email.toLowerCase()))
      .map((r, i) => ({ id: r.id, name: r.name, initials: r.initials, isPrimary: i === 0 })) as SelectedSalesRep[];
  });

  const serialize = (reps: SelectedSalesRep[]) => {
    const emails = reps
      .map((rep) => SALES_REP_ROSTER.find((r) => r.id === rep.id)?.email ?? rep.name)
      .filter(Boolean);
    if (!multiple) {
      const primary = reps.find((r) => r.isPrimary) ?? reps[0];
      const email = primary ? SALES_REP_ROSTER.find((r) => r.id === primary.id)?.email ?? primary.name : "";
      return email;
    }
    return emails.join("|");
  };

  const close = (commit: boolean) => {
    if (commit) onCommit(serialize(selected));
    else onCancel();
  };

  return (
    <Popover open onOpenChange={(next) => { if (!next) close(true); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full text-left outline-none cursor-pointer"
          style={{ padding: "8px 12px", fontSize: "12.5px" }}
        >
          {selected.length
            ? selected.map((r) => r.name).join(", ")
            : <span className="text-muted-foreground">Select {multiple ? "reps" : "a rep"}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={5}
        collisionPadding={12}
        className="p-0 rounded-xl"
        style={{ zIndex: 12420, width: 340 }}
        onEscapeKeyDown={() => close(false)}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SalesRepSelector
          availableReps={available}
          selectedReps={selected}
          onSelectedRepsChange={(next) => {
            /* One rep for the single column: the latest pick becomes the
               primary and the rest fall away, so the cell never shows two
               names it cannot store. */
            setSelected(multiple ? next : next.slice(-1).map((r) => ({ ...r, isPrimary: true })));
          }}
          renderDropdownOnly
          fullWidth
        />
        <div className="border-t border-border p-1.5">
          <button
            type="button"
            onClick={() => {
              window.open(meta.createHref, "_blank", "noopener");
              toast.info(`Opening ${meta.module} to add a user. This row stays failed until it exists.`);
            }}
            className="flex items-center gap-2 w-full text-left px-2.5 py-2 rounded-lg text-primary hover:bg-accent transition-colors cursor-pointer"
            style={{ fontSize: "12.5px", fontWeight: 500 }}
          >
            <Plus className="w-3.5 h-3.5" />
            Create in {meta.module}
            <ExternalLink className="w-3 h-3 ml-auto opacity-60" />
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
