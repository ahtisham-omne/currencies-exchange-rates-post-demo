/* Proves the "also needs a license" note in the inactive/unlicensed warning
 * modal renders exactly when a user is passed in licenseDeficientIds, and is
 * absent otherwise, guarding the note that the recent copy/spacing edit
 * touched. Renders with react-dom/client into jsdom (no extra test deps). */
import { describe, it, expect, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { InactiveOrUnlicensedWarningModal } from "../app/components/shared/InactiveOrUnlicensedWarningModal";
import type { AtRiskUser } from "../app/components/shared/InactiveOrUnlicensedWarningModal";

const jayvon: AtRiskUser = {
  id: 18,
  fullName: "Jayvon Mccall",
  email: "gerlo@att.net",
  status: "Inactive",
  license: "No License",
};
const miguel: AtRiskUser = {
  id: 99,
  fullName: "Miguel Torres",
  email: "mtorres@omnesoft.com",
  status: "Active",
  license: "No License",
};

const NOTE = "also needs a license, handle at activation.";

let container: HTMLDivElement | null = null;
let root: Root | null = null;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  container = null;
  root = null;
});

function renderModal(licenseDeficientIds: number[]): string {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(
      <InactiveOrUnlicensedWarningModal
        open
        users={[jayvon, miguel]}
        assignmentLabel="Warehouse Manager"
        licenseDeficientIds={licenseDeficientIds}
        onContinue={() => {}}
        onGoBack={() => {}}
      />,
    );
  });
  // Portal renders into document.body, so read the whole document.
  return document.body.textContent ?? "";
}

function noteCount(text: string): number {
  return text.split(NOTE).length - 1;
}

describe("Warning modal license note", () => {
  it("shows the note for every license-deficient user (Full Access role)", () => {
    expect(noteCount(renderModal([jayvon.id, miguel.id]))).toBe(2);
  });

  it("omits the note when no user is license-deficient (Field User role)", () => {
    const text = renderModal([]);
    expect(text).toContain("Jayvon Mccall"); // modal still renders the users
    expect(noteCount(text)).toBe(0);
  });

  it("shows the note only for the deficient subset", () => {
    expect(noteCount(renderModal([jayvon.id]))).toBe(1);
  });
});
