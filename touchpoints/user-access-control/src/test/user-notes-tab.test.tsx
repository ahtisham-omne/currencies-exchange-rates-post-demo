/* ERP-5167 AC3: the user page's Notes tab, the shared notes design (ERP-8136).
 * Renders with react-dom/client into jsdom (no extra test deps), like the
 * other component tests here. */
import { describe, it, expect, afterEach, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UserNotesTab } from "../app/components/user-detail/UserNotesTab";
import type { UserNote } from "../app/data/user-notes";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NOTE: UserNote = {
  id: "n-1",
  text: "Moved to the night shift from Monday.",
  author: "Andrea Davis",
  timestamp: "2026-07-24T15:42:00",
};

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

function renderTab(notes: UserNote[], opts: { readOnly?: boolean } = {}) {
  const onNotesChange = vi.fn();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() =>
    root!.render(
      <TooltipProvider>
        <UserNotesTab
          notes={notes}
          onNotesChange={onNotesChange}
          author="Abdullah Malik"
          recordName="Jane Doe"
          placeholder="Add a note about this user"
          readOnly={opts.readOnly}
          now={() => new Date("2026-11-13T10:00:00Z")}
        />
      </TooltipProvider>,
    ),
  );
  return onNotesChange;
}

const text = () => document.body.textContent ?? "";
const button = (label: string) =>
  [...document.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === label || b.getAttribute("aria-label") === label,
  ) as HTMLButtonElement | undefined;

function type(el: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
  act(() => {
    el.focus();
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("UserNotesTab", () => {
  it('shows "No notes yet." with no notes', () => {
    renderTab([]);
    expect(text()).toContain("No notes yet.");
    expect(text()).toContain("0 notes");
  });

  it("adds a note newest first, signed by the author", () => {
    const onNotesChange = renderTab([NOTE]);
    type(document.querySelector("textarea")!, "  Needs forklift training.  ");
    act(() => button("Add Note")!.click());
    const next = onNotesChange.mock.calls[0][0] as UserNote[];
    expect(next).toHaveLength(2);
    expect(next[0]).toMatchObject({ text: "Needs forklift training.", author: "Abdullah Malik" });
    expect(next[1]).toBe(NOTE);
  });

  it("does not add an empty note", () => {
    const onNotesChange = renderTab([]);
    act(() => button("Add Note")!.click());
    expect(onNotesChange).not.toHaveBeenCalled();
  });

  it("deletes only after the confirm", () => {
    const onNotesChange = renderTab([NOTE]);
    act(() => button("Delete note")!.click());
    expect(onNotesChange).not.toHaveBeenCalled();
    expect(text()).toContain("Delete this note?");
    expect(text()).toContain("will be permanently removed. This action cannot be undone.");
    act(() => button("Delete Note")!.click());
    expect(onNotesChange).toHaveBeenCalledWith([]);
  });

  it("is read-only for an archived user: no composer, no trash", () => {
    renderTab([NOTE], { readOnly: true });
    expect(document.querySelector("textarea")).toBeNull();
    expect(button("Delete note")).toBeUndefined();
    expect(text()).toContain(NOTE.text);
  });
});
