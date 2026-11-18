/* Me Mode is not part of the current build (SHOW_ME_MODE in
 * lib/feature-flags.ts). With the flag off, a table that asks for Me Mode must
 * show no chip, and a saved "on" state from before it was hidden must not come
 * back as an invisible filter.
 *
 * Uses the real flag value, so flipping SHOW_ME_MODE back on is expected to
 * fail this file: delete it then. table-filter-persistence.test.tsx keeps the
 * feature itself covered with the flag mocked on. */
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { DataTable } from "../app/components/data-table/DataTable";
import { DataTableFilterPills } from "../app/components/data-table/DataTableFilterPills";
import type { ColumnDef, QuickFilterDef } from "../app/components/data-table/types";

interface Row { id: number; name: string; owner: string }

const DATA: Row[] = [
  { id: 1, name: "Alpha", owner: "me" },
  { id: 2, name: "Beta", owner: "them" },
];
const COLUMNS: ColumnDef<Row>[] = [
  { key: "name", label: "Name", width: 200, render: (r) => r.name },
];
const QUICK: QuickFilterDef[] = [{ key: "all", label: "Show All", showCount: true }];
const KEY = "test:me-mode-hidden";

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  window.localStorage.clear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  container = null;
  root = null;
});

const hasMeModeChip = (el: HTMLElement) => (el.textContent ?? "").toLowerCase().includes("me mode");

describe("Me Mode hidden from the current build", () => {
  it("a DataTable that opts in renders no Me Mode chip", () => {
    act(() => {
      root!.render(
        <DataTable<Row>
          data={DATA}
          columns={COLUMNS}
          getRowId={(r) => r.id}
          searchPredicate={(row, q) => row.name.toLowerCase().includes(q)}
          quickFilters={QUICK}
          showMeMode
          meModePredicate={(row) => row.owner === "me"}
          meModeTooltip="Only mine"
          entityLabel="rows"
        />,
      );
    });
    expect(hasMeModeChip(container!)).toBe(false);
  });

  it("the pill row renders no Me Mode chip even when asked to", () => {
    act(() => {
      root!.render(
        <DataTableFilterPills
          filters={QUICK}
          activeFilters={new Set()}
          onFilterToggle={() => {}}
          filterCounts={{}}
          showMeMode
          meModeActive
          onMeModeToggle={() => {}}
        />,
      );
    });
    expect(hasMeModeChip(container!)).toBe(false);
  });

  it("a saved Me Mode 'on' state does not filter rows, and is left in storage", () => {
    window.localStorage.setItem(`dt:memode:${KEY}`, JSON.stringify(true));
    act(() => {
      root!.render(
        <DataTable<Row>
          data={DATA}
          columns={COLUMNS}
          getRowId={(r) => r.id}
          persistKey={KEY}
          searchPredicate={(row, q) => row.name.toLowerCase().includes(q)}
          quickFilters={QUICK}
          filterPredicate={() => true}
          showMeMode
          meModePredicate={(row) => row.owner === "me"}
          entityLabel="rows"
        />,
      );
    });
    const text = container!.textContent ?? "";
    expect(text).toContain("Alpha");
    expect(text).toContain("Beta");
    expect(window.localStorage.getItem(`dt:memode:${KEY}`)).toBe("true");
  });
});
