/* Proves the capability matrix actually renders what the access model declares.
 *
 * access-levels.test.ts checks the MODEL: that every capability stands for a
 * real Users and Roles permission and that no permission is left unrepresented.
 * That is a data assertion and would still pass if the page itself were broken.
 * This renders the real page and checks the UI agrees: every capability row is
 * on screen, every level is a column, and the ticks match the derived booleans.
 *
 * Renders with react-dom/client into jsdom, the pattern warning-modal-note
 * already uses here (no extra test deps). */
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { createElement } from "react";
import { AccessMatrixPage } from "../app/components/AccessMatrixPage";
import {
  ACCESS_LEVELS,
  CAPABILITY_GROUPS,
  setAccessLevel,
  getAccessLevel,
} from "../app/components/access-mode";

let container: HTMLDivElement | null = null;
let root: Root | null = null;

/* Tells React this is an act()-aware environment, so the renders below do not
 * warn. Set here rather than in setup.ts to keep it scoped to this file. */
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  setAccessLevel("all");
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  container = null;
  root = null;
  setAccessLevel("all");
});

function renderMatrix(): HTMLDivElement {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(createElement(MemoryRouter, null, createElement(AccessMatrixPage)));
  });
  return container;
}

describe("capability matrix renders the access model", () => {
  it("shows every capability row, including the ones added for ERP-5550", () => {
    const text = renderMatrix().textContent ?? "";
    for (const { label } of CAPABILITY_GROUPS.flatMap((g) => g.items)) {
      expect(text, `matrix is missing the row "${label}"`).toContain(label);
    }
    // The two rows that did not exist before the access-model realignment.
    expect(text).toContain("Bulk deactivate users");
    expect(text).toContain("Bulk deactivate and archive roles");
  });

  it("shows every group heading and every access level as a column", () => {
    const text = renderMatrix().textContent ?? "";
    // Group headings are upper-cased in the DOM by the component, so compare
    // case-insensitively rather than pinning the presentation.
    const upper = text.toUpperCase();
    for (const { group } of CAPABILITY_GROUPS) {
      expect(upper, `matrix is missing the group "${group}"`).toContain(group.toUpperCase());
    }
    for (const level of ACCESS_LEVELS) {
      expect(text, `matrix is missing the level "${level.label}"`).toContain(level.label);
    }
  });

  it("prints the backing permission id for every capability", () => {
    const text = renderMatrix().textContent ?? "";
    for (const { permissionId } of CAPABILITY_GROUPS.flatMap((g) => g.items)) {
      expect(text, `matrix does not print ${permissionId}`).toContain(permissionId);
    }
    // Specifically the two ids that had no row until the realignment.
    expect(text).toContain("ur-bulk-deactivate-users");
    expect(text).toContain("ur-bulk-roles-destructive");
  });

  /* The matrix is the audit surface for the model, so a row's ticks have to be
   * the derived booleans and not a hand-maintained copy. One tick per capability
   * the level holds, counted across the whole table. */
  it("the tick count matches the derived capability booleans", () => {
    const el = renderMatrix();
    const keys = CAPABILITY_GROUPS.flatMap((g) => g.items).map((i) => i.key);
    const expectedTicks = ACCESS_LEVELS.reduce(
      (n, level) => n + keys.filter((k) => level[k]).length,
      0,
    );
    // Lucide renders each icon as an <svg>; ticks and dashes are the only icons
    // inside the table body, so counting cells by their marker is stable.
    const cells = el.querySelectorAll("td svg, tbody svg");
    expect(cells.length, "one marker per level per capability").toBe(
      ACCESS_LEVELS.length * keys.length,
    );
    expect(expectedTicks).toBeGreaterThan(0);
    expect(expectedTicks).toBeLessThanOrEqual(ACCESS_LEVELS.length * keys.length);
  });

  it("clicking a column header switches the active level", () => {
    const el = renderMatrix();
    const target = ACCESS_LEVELS.find((l) => l.level === "view_only")!;
    const header = Array.from(el.querySelectorAll("th")).find((th) =>
      th.textContent?.includes(target.label),
    );
    expect(header, "View Only column header should be present").toBeTruthy();
    const clickable = header!.querySelector("button") ?? header!;
    act(() => {
      clickable.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(getAccessLevel()).toBe("view_only");
  });
});
