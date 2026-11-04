import { describe, it, expect } from "vitest";
import { detectRateChange } from "../app/components/poStore";

describe("detectRateChange", () => {
  const baseSnap = {
    rateType: "market" as const,
    lockedRate: 278,
    lockedAt: "2026-04-01T00:00:00.000Z",
    locked: false,
  };

  it("returns null when nothing changed", () => {
    expect(detectRateChange(baseSnap, { ...baseSnap }, "USD")).toBeNull();
  });

  it("returns null when the vendor invoices in base currency", () => {
    const next = { ...baseSnap, lockedRate: 1.05 };
    // Base PKR vendor — no FX info worth surfacing regardless of the diff.
    expect(detectRateChange(baseSnap, next, "PKR")).toBeNull();
  });

  it("returns null when there is no previous version", () => {
    expect(detectRateChange(undefined, baseSnap, "USD")).toBeNull();
  });

  it("emits a record when only the locked rate changed", () => {
    const next = { ...baseSnap, lockedRate: 281.5 };
    const rec = detectRateChange(baseSnap, next, "USD");
    expect(rec).not.toBeNull();
    expect(rec!.type).toBe("exchange-rate-changed");
    expect(rec!.action).toBe("Changed");
    expect(rec!.subject).toBe("Exchange rate updated");
    expect(rec!.detail).toBe(
      "1 USD = 278.00 PKR → 1 USD = 281.50 PKR (Mid-market)",
    );
  });

  it("emits a record when only the rate type changed", () => {
    const next = { ...baseSnap, rateType: "corporate" as const };
    const rec = detectRateChange(baseSnap, next, "USD");
    expect(rec).not.toBeNull();
    // Same rate value but the type label flipped — keep both labels visible.
    expect(rec!.detail).toBe(
      "1 USD = 278.00 PKR (Mid-market) → 1 USD = 278.00 PKR (Corporate)",
    );
  });

  it("emits a record when both rate and type changed", () => {
    const next = {
      ...baseSnap,
      rateType: "corporate" as const,
      lockedRate: 280,
    };
    const rec = detectRateChange(baseSnap, next, "USD");
    expect(rec!.detail).toBe(
      "1 USD = 278.00 PKR (Mid-market) → 1 USD = 280.00 PKR (Corporate)",
    );
  });

  it("ignores sub-microcent differences (floating point noise)", () => {
    const next = { ...baseSnap, lockedRate: 278 + 1e-9 };
    expect(detectRateChange(baseSnap, next, "USD")).toBeNull();
  });
});
