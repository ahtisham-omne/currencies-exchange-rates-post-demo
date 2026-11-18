/* A table that passes `persistKey` has to bring back ALL THREE filtering
 * controls on the next visit: the quick pills, Me Mode, and the advanced
 * Filters panel. Restoring only the pills is the bug this guards against, and
 * it is a quiet one: the row count comes back filtered while the toolbar shows
 * two of the three controls as off.
 *
 * Also guards the stale-option prune. A saved advanced selection naming an
 * option that no longer exists would otherwise survive as an invisible filter
 * that matches nothing, and the table would look empty for no stated reason.
 *
 * Renders with react-dom/client into jsdom (no extra test deps), matching
 * warning-modal-note.test.tsx. */
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { DataTable, pruneAdvancedValues } from "../app/components/data-table/DataTable";
import type {
  ColumnDef,
  QuickFilterDef,
  AdvancedFilterConfig,
} from "../app/components/data-table/types";

/* Me Mode is hidden from the current build (SHOW_ME_MODE, lib/feature-flags.ts)
 * but its persistence is still guarded here so it comes back working. Turned
 * on for this file only; me-mode-hidden.test.tsx covers the flag-off build. */
vi.mock("../app/lib/feature-flags", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../app/lib/feature-flags")>()),
  SHOW_ME_MODE: true,
}));

interface Row { id: number; name: string; owner: string }

const DATA: Row[] = [
  { id: 1, name: "Alpha", owner: "me" },
  { id: 2, name: "Beta", owner: "them" },
  { id: 3, name: "Gamma", owner: "them" },
];

const COLUMNS: ColumnDef<Row>[] = [
  { key: "name", label: "Name", width: 200, render: (r) => r.name },
];
const QUICK: QuickFilterDef[] = [
  { key: "all", label: "Show All", showCount: true },
  { key: "mine", label: "Mine", showCount: true, group: "owner" },
];
const ADVANCED: AdvancedFilterConfig<Row> = {
  sections: [
    {
      key: "owner",
      title: "Owner",
      kind: "pills",
      options: [
        { value: "me", label: "Me" },
        { value: "them", label: "Them" },
      ],
    },
  ],
  predicate: (row, values) => {
    const sel = values.owner ?? [];
    return sel.length === 0 || sel.includes(row.owner);
  },
};

const KEY = "test:persistence";

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  container = null;
  root = null;
});

function renderTable(opts: { persist?: boolean; withMeMode?: boolean; withAdvanced?: boolean } = {}) {
  const { persist = true, withMeMode = true, withAdvanced = true } = opts;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(
      <DataTable<Row>
        data={DATA}
        columns={COLUMNS}
        getRowId={(r) => r.id}
        persistKey={persist ? KEY : undefined}
        searchPredicate={(row, q) => row.name.toLowerCase().includes(q)}
        quickFilters={QUICK}
        filterPredicate={(row, key) => (key === "mine" ? row.owner === "me" : true)}
        showMeMode={withMeMode}
        meModePredicate={withMeMode ? (row) => row.owner === "me" : undefined}
        advancedFilter={withAdvanced ? ADVANCED : undefined}
        entityLabel="rows"
      />,
    );
  });
  return container!;
}

/** Find a button by its visible text, and report its aria-pressed state. */
function pressedState(el: HTMLElement, label: string): string | null {
  const btn = Array.from(el.querySelectorAll("button")).find((b) =>
    (b.textContent ?? "").toLowerCase().includes(label.toLowerCase()),
  );
  return btn?.getAttribute("aria-pressed") ?? null;
}

/** Which of the three fixture rows survived the current filters. */
function visibleRows(el: HTMLElement): string[] {
  const text = el.textContent ?? "";
  return ["Alpha", "Beta", "Gamma"].filter((n) => text.includes(n));
}

describe("table filter persistence", () => {
  /* Each control is asserted by what it actually filters, not by a class name.
   * They are checked one at a time because together they intersect to nothing
   * on this fixture, which would prove less, not more. */

  it("restores the quick pill selection (the case that already worked)", () => {
    window.localStorage.setItem(`dt:filters:${KEY}`, JSON.stringify(["mine"]));
    expect(visibleRows(renderTable())).toEqual(["Alpha"]);
  });

  it("restores Me Mode", () => {
    window.localStorage.setItem(`dt:memode:${KEY}`, JSON.stringify(true));
    const el = renderTable();
    expect(pressedState(el, "Me Mode")).toBe("true");
    expect(visibleRows(el)).toEqual(["Alpha"]);
  });

  it("restores the advanced filter selection", () => {
    window.localStorage.setItem(`dt:advanced:${KEY}`, JSON.stringify({ owner: ["them"] }));
    expect(visibleRows(renderTable())).toEqual(["Beta", "Gamma"]);
  });

  it("persists Me Mode, not just the quick pills", () => {
    const el = renderTable();
    expect(pressedState(el, "Me Mode")).toBe("false");

    const meBtn = Array.from(el.querySelectorAll("button")).find((b) =>
      (b.textContent ?? "").toLowerCase().includes("me mode"),
    )!;
    act(() => meBtn.click());

    expect(window.localStorage.getItem(`dt:memode:${KEY}`)).toBe("true");

    // Remount: the next visit gets it back
    act(() => root?.unmount());
    container?.remove();
    const el2 = renderTable();
    expect(pressedState(el2, "Me Mode")).toBe("true");
  });

  it("writes each control so the next mount reads a hit, not a fallback", () => {
    renderTable();
    expect(window.localStorage.getItem(`dt:filters:${KEY}`)).toBe("[]");
    expect(window.localStorage.getItem(`dt:memode:${KEY}`)).toBe("false");
    expect(window.localStorage.getItem(`dt:advanced:${KEY}`)).toBe("{}");
  });

  it("a table with no persistKey writes nothing", () => {
    renderTable({ persist: false });
    expect(window.localStorage.length).toBe(0);
  });

  it("a table without Me Mode or advanced filters claims neither key", () => {
    renderTable({ withMeMode: false, withAdvanced: false });
    expect(window.localStorage.getItem(`dt:filters:${KEY}`)).toBe("[]");
    expect(window.localStorage.getItem(`dt:memode:${KEY}`)).toBeNull();
    expect(window.localStorage.getItem(`dt:advanced:${KEY}`)).toBeNull();
  });

  it("corrupt stored state falls back to the default instead of throwing", () => {
    window.localStorage.setItem(`dt:filters:${KEY}`, "{not json");
    window.localStorage.setItem(`dt:memode:${KEY}`, JSON.stringify("yes")); // wrong type
    window.localStorage.setItem(`dt:advanced:${KEY}`, JSON.stringify(["wrong", "shape"]));
    let el: HTMLElement | null = null;
    expect(() => { el = renderTable(); }).not.toThrow();
    expect(pressedState(el!, "Me Mode")).toBe("false");
  });

  it("a stale saved advanced option does not come back as an invisible filter", () => {
    window.localStorage.setItem(`dt:advanced:${KEY}`, JSON.stringify({ owner: ["ghost"] }));
    renderTable();
    // Pruned on restore, so what gets written back is empty, not the ghost.
    expect(window.localStorage.getItem(`dt:advanced:${KEY}`)).toBe("{}");
  });
});

describe("pruneAdvancedValues", () => {
  const sections = [
    { key: "owner", options: [{ value: "me" }, { value: "them" }] },
    { key: "dept", options: [{ value: "ops" }] },
  ];

  it("keeps selections that still exist", () => {
    expect(pruneAdvancedValues({ owner: ["me"], dept: ["ops"] }, sections))
      .toEqual({ owner: ["me"], dept: ["ops"] });
  });

  it("drops an option that no longer exists, keeping its live siblings", () => {
    expect(pruneAdvancedValues({ owner: ["me", "ghost"] }, sections)).toEqual({ owner: ["me"] });
  });

  it("drops a section whose every option is gone, rather than leaving a match-nothing filter", () => {
    expect(pruneAdvancedValues({ owner: ["ghost"] }, sections)).toEqual({});
  });

  it("drops a section key that is gone from the config entirely", () => {
    expect(pruneAdvancedValues({ retired: ["x"] }, sections)).toEqual({});
  });

  it("ignores empty and malformed entries", () => {
    expect(pruneAdvancedValues({ owner: [] }, sections)).toEqual({});
    expect(pruneAdvancedValues({ owner: "nope" as unknown as string[] }, sections)).toEqual({});
  });
});
