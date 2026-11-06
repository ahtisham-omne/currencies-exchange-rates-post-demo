import { useState } from "react";
import { AlertTriangle, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";

/**
 * The cell editor for a column whose values are a closed set.
 *
 * Status and priority are states the module defines; they are not free text
 * anywhere else in either module and they should not be here either. So this
 * cell has no input at all: clicking it opens the module's own list and a
 * pick commits. Same shape as the unit-of-measure cell next to it, which is
 * UAC's set-valued sheet cell: the cell is the trigger, the panel is a
 * portalled popover, escape cancels.
 *
 * A legacy file that carries some other word keeps showing it, in red, with
 * the reason above the list. That value cannot be typed here, only replaced,
 * which is the whole point.
 */
export function SetCellDropdown({
  value,
  options,
  label,
  onCommit,
  onCancel,
}: {
  value: string;
  /** The module's own list, in the order the module shows it. */
  options: readonly string[];
  /** The column's label, for the placeholder and the invalid-value note. */
  label: string;
  onCommit: (next: string) => void;
  onCancel: () => void;
}) {
  const [open, setOpen] = useState(true);
  const current = value.trim();
  const known = options.some((o) => o.toLowerCase() === current.toLowerCase());

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
          <span className={known || !current ? "text-foreground" : "text-destructive"} style={{ fontWeight: known || !current ? 400 : 500 }}>
            {current || <span className="text-muted-foreground">Select {label.toLowerCase()}</span>}
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
        {!known && current && (
          <div className="flex items-start gap-2 px-2.5 py-2 mb-1 rounded-lg border border-red-200 bg-red-50">
            <AlertTriangle className="w-3.5 h-3.5 text-destructive mt-0.5 shrink-0" />
            <p className="text-[11.5px] text-red-700 leading-relaxed">
              "{current}" is not {/^[aeiou]/i.test(label) ? "an" : "a"} {label.toLowerCase()} in Omne. Pick one below.
            </p>
          </div>
        )}

        <p
          className="px-2.5 pt-1.5 pb-1 text-muted-foreground uppercase"
          style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.04em" }}
        >
          {label}
        </p>
        {options.map((o) => {
          const selected = o.toLowerCase() === current.toLowerCase();
          return (
            <button
              key={o}
              type="button"
              onClick={() => close(o)}
              className="flex items-center gap-2 w-full text-left px-2.5 py-2 rounded-lg hover:bg-accent transition-colors cursor-pointer"
              style={{ fontSize: "12.5px" }}
            >
              <span className={selected ? "text-primary" : "text-foreground"} style={{ fontWeight: selected ? 600 : 400 }}>
                {o}
              </span>
              {selected && <Check className="w-3.5 h-3.5 text-primary ml-auto" />}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
