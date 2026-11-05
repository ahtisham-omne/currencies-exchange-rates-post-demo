import { useMemo, useState } from "react";
import { Check, ExternalLink, Plus, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
import { UOM_CODES, unitsForItem } from "./importCatalog";
import { UOM_FULL_NAMES } from "./importCatalog";
import { ENTITY_META } from "./importSpec";

/**
 * Unit-of-measure cell editor.
 *
 * Free text was the wrong control here. A unit is a closed set, and which
 * units are legal depends on the item on the same line, so typing invites
 * exactly the error the review sheet then has to report. This is a
 * dropdown instead, on the shape the User Access Control sheet uses for
 * its own set-valued cells: the cell itself is the trigger, the panel is a
 * portalled popover, escape cancels and a pick commits.
 *
 * Two things it adds over UAC's, because our sets are not flat:
 *
 *   · The list is sectioned. Units the line's item can actually be sold
 *     in come first; the rest are still reachable but marked, since a
 *     legacy file may name a unit the item no longer carries and the
 *     reader needs to see why it is being refused.
 *   · A create route. Units live in Company Setup and this import may not
 *     create them, so the footer opens that module rather than pretending
 *     the cell can conjure one.
 */
export function UomCellDropdown({
  value,
  itemCode,
  onCommit,
  onCancel,
}: {
  value: string;
  /** The item on this line. Decides which units are legal. */
  itemCode: string;
  onCommit: (next: string) => void;
  onCancel: () => void;
}) {
  const [open, setOpen] = useState(true);
  const meta = ENTITY_META.uom;

  const { allowed, others } = useMemo(() => {
    const permitted = itemCode ? unitsForItem(itemCode) : [...UOM_CODES];
    const lower = new Set(permitted.map((u) => u.toLowerCase()));
    return {
      allowed: permitted,
      others: UOM_CODES.filter((u) => !lower.has(u.toLowerCase())),
    };
  }, [itemCode]);

  const known = [...allowed, ...others].some((u) => u.toLowerCase() === value.trim().toLowerCase());

  const close = (commit?: string) => {
    setOpen(false);
    if (commit != null) onCommit(commit);
    else onCancel();
  };

  return (
    <Popover open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center justify-between gap-1.5 w-full text-left outline-none cursor-pointer"
          style={{ padding: "8px 12px", fontSize: "12.5px" }}
        >
          <span className={known ? "text-foreground" : "text-destructive"} style={{ fontWeight: known ? 400 : 500 }}>
            {value || <span className="text-muted-foreground">Select a unit</span>}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={5}
        collisionPadding={12}
        className="w-[268px] p-1.5 rounded-xl"
        style={{ zIndex: 12420 }}
        onEscapeKeyDown={() => close()}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {!known && value.trim() && (
          <div className="flex items-start gap-2 px-2.5 py-2 mb-1 rounded-lg border border-red-200 bg-red-50">
            <AlertTriangle className="w-3.5 h-3.5 text-destructive mt-0.5 shrink-0" />
            <p className="text-[11.5px] text-red-700 leading-relaxed">
              "{value}" is not a unit in Omne.
            </p>
          </div>
        )}

        <Section label={itemCode ? `Allowed for ${itemCode}` : "Units"} />
        {allowed.map((u) => (
          <UomOption key={u} unit={u} selected={u.toLowerCase() === value.trim().toLowerCase()} onPick={() => close(u)} />
        ))}

        {others.length > 0 && (
          <>
            <Section label="Not sold in this unit" />
            {others.map((u) => (
              <UomOption
                key={u}
                unit={u}
                muted
                selected={u.toLowerCase() === value.trim().toLowerCase()}
                onPick={() => close(u)}
              />
            ))}
          </>
        )}

        <div className="mt-1 pt-1.5 border-t border-border">
          <button
            type="button"
            onClick={() => {
              window.open(meta.createHref, "_blank", "noopener");
              toast.info(`Opening ${meta.module} to add a unit. This line stays failed until the unit exists.`);
              close();
            }}
            className="flex items-center gap-2 w-full text-left px-2.5 py-2 rounded-lg text-primary hover:bg-accent transition-colors cursor-pointer"
            style={{ fontSize: "12.5px", fontWeight: 500 }}
          >
            <Plus className="w-3.5 h-3.5" />
            Create a unit in {meta.module}
            <ExternalLink className="w-3 h-3 ml-auto opacity-60" />
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Section({ label }: { label: string }) {
  return (
    <p
      className="px-2.5 pt-1.5 pb-1 text-muted-foreground uppercase"
      style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.04em" }}
    >
      {label}
    </p>
  );
}

function UomOption({
  unit, selected, muted, onPick,
}: { unit: string; selected: boolean; muted?: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={`flex items-center justify-between gap-3 w-full text-left px-2.5 py-2 rounded-lg transition-colors cursor-pointer ${
        selected ? "bg-accent" : "hover:bg-slate-50"
      }`}
      style={{ fontSize: "13px" }}
    >
      <span className="min-w-0">
        <span className={muted ? "text-muted-foreground" : "text-foreground"} style={{ fontWeight: 500 }}>{unit}</span>
        <span className="text-muted-foreground ml-1.5" style={{ fontSize: "11.5px" }}>
          {UOM_FULL_NAMES[unit] ?? ""}
        </span>
      </span>
      {selected && <Check className="w-4 h-4 shrink-0 text-primary" />}
    </button>
  );
}
