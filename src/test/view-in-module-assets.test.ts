/* Guards the View-in-Module simulator's real-screenshot set.
 *
 * An entry can declare imageOn / imageOff pointing at a file that was never
 * added, renamed, or got clobbered by a re-capture. Nothing catches that at
 * build time: Vite does not resolve /public paths, so a bad path only shows up
 * as a broken preview in the modal at runtime. These tests resolve every
 * declared path against public/ instead.
 *
 * Users & Roles is the module the team owns directly, so it is the one held to
 * full coverage: every permission must have a real ON and OFF capture. Other
 * modules are still filling in and are deliberately not pinned here. */
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { PERMISSION_MODULES } from "../app/data/permissions-data";
import { VIEW_IN_MODULE_DATA } from "../app/data/view-in-module-data";

const PUBLIC = join(process.cwd(), "public");

describe("view-in-module assets", () => {
  it("every declared screenshot exists on disk", () => {
    const missing: string[] = [];
    for (const [id, entry] of Object.entries(VIEW_IN_MODULE_DATA)) {
      for (const p of [entry.imageOn, entry.imageOff]) {
        if (!p) continue;
        if (!existsSync(join(PUBLIC, p.replace(/^\//, "")))) missing.push(`${id} → ${p}`);
      }
    }
    expect(missing, "declared screenshots with no file").toEqual([]);
  });

  it("an entry declaring one image declares both", () => {
    const half: string[] = [];
    for (const [id, entry] of Object.entries(VIEW_IN_MODULE_DATA)) {
      if (!!entry.imageOn !== !!entry.imageOff) half.push(id);
    }
    expect(half, "entries with only one of imageOn / imageOff").toEqual([]);
  });

  /* The ERP-5550 module is fully captured. This is the assertion that would
   * have failed while Deactivate User, Bulk Deactivate Users, and the three
   * role-lifecycle permissions had no capture. */
  it("every Users and Roles permission has a real ON and OFF capture", () => {
    const ur = PERMISSION_MODULES.find((m) => m.id === "users-roles")!.permissions;
    const uncaptured = ur
      .filter((p) => {
        const e = VIEW_IN_MODULE_DATA[p.id];
        return !e?.imageOn || !e?.imageOff;
      })
      .map((p) => `${p.id} (${p.name})`);
    expect(uncaptured, "Users and Roles permissions with no screenshot").toEqual([]);
  });

  /* Each capture owns its own image stem. Two entries sharing one pair is how
   * the old Archive user entry ended up pointing at the Deactivate user files,
   * which then broke when Deactivate user was captured for real. */
  it("no two Users and Roles entries share an image", () => {
    const ur = PERMISSION_MODULES.find((m) => m.id === "users-roles")!.permissions;
    const seen = new Map<string, string>();
    for (const p of ur) {
      const e = VIEW_IN_MODULE_DATA[p.id];
      if (!e?.imageOn) continue;
      const prev = seen.get(e.imageOn);
      expect(prev, `${p.id} reuses the capture already used by ${prev}`).toBeUndefined();
      seen.set(e.imageOn, p.id);
    }
  });

  /* Hotspots are percentages of the image, so a zero box or a negative origin
   * is a bad measurement rather than a highlight. Applies to every module. */
  it("hotspots are positive boxes with a non-negative origin", () => {
    for (const [id, entry] of Object.entries(VIEW_IN_MODULE_DATA)) {
      for (const h of [entry.hotspotOn, entry.hotspotOff]) {
        if (!h) continue;
        expect(h.width, `${id} hotspot width`).toBeGreaterThan(0);
        expect(h.height, `${id} hotspot height`).toBeGreaterThan(0);
        expect(h.left, `${id} hotspot left`).toBeGreaterThanOrEqual(0);
        expect(h.top, `${id} hotspot top`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  /* Staying inside the frame is checked for Users and Roles only, because those
   * hotspots are measured from the live DOM at the capture viewport and so are
   * known-good. One entry elsewhere is out of bounds today: cat-access is
   * 82.47 + 26.4 = 108.87 wide, overflowing the right edge by ~9%. It predates
   * this guard, sits in a module that is still filling in its captures, and the
   * correct box cannot be derived without re-measuring that screen, so it is
   * left alone rather than fixed to a guessed number. */
  it("Users and Roles hotspots stay inside the frame", () => {
    const ur = PERMISSION_MODULES.find((m) => m.id === "users-roles")!.permissions;
    for (const p of ur) {
      const entry = VIEW_IN_MODULE_DATA[p.id];
      for (const h of [entry?.hotspotOn, entry?.hotspotOff]) {
        if (!h) continue;
        expect(h.left + h.width, `${p.id} hotspot overflows right edge`).toBeLessThanOrEqual(100.5);
        expect(h.top + h.height, `${p.id} hotspot overflows bottom edge`).toBeLessThanOrEqual(100.5);
      }
    }
  });
});
