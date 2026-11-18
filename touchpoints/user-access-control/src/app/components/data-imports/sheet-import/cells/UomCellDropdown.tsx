import { useMemo } from "react";
import { ChoiceCellDropdown, SEARCH_THRESHOLD } from "../../import-review/ChoiceCellDropdown";
import { UOM_CODES, UOM_FULL_NAMES, unitsForItem } from "./importCatalog";

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
 * The list is sectioned: units the line's item can actually be sold in come
 * first; the rest are still reachable but marked, since a legacy file may name
 * a unit the item no longer carries. It renders the shared ChoiceCellDropdown,
 * so it reads like every other Data Imports cell list.
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
  const { allowed, others } = useMemo(() => {
    const permitted = itemCode ? unitsForItem(itemCode) : [...UOM_CODES];
    const lower = new Set(permitted.map((u) => u.toLowerCase()));
    return {
      allowed: permitted,
      others: UOM_CODES.filter((u) => !lower.has(u.toLowerCase())),
    };
  }, [itemCode]);
  const describe = (u: string) => ({ value: u, description: UOM_FULL_NAMES[u] });
  const groups = [
    { label: itemCode ? `Allowed for ${itemCode}` : "Units", options: allowed.map(describe) },
    ...(others.length ? [{ label: "Not sold in this unit", options: others.map(describe) }] : []),
  ];

  /* The shared cell dropdown, sectioned: the item's own units first. */
  return (
    <ChoiceCellDropdown
      value={value}
      groups={groups}
      searchable={allowed.length + others.length > SEARCH_THRESHOLD}
      label="Unit of Measure"
      onCommit={(next) => onCommit(next)}
      onCancel={onCancel}
    />
  );
}
