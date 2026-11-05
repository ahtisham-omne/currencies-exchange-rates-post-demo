/* Guards the shared Excel text measure (textMeasure.mjs). Every expected line
 * count below is what real Excel AutoFit produced for that text and width
 * (Arial 10, wrap, indent 1), checked 2026-09-30 with a private Excel instance. */
import { describe, it, expect } from "vitest";
import { lineCount, usableWidth } from "./textMeasure.mjs";

const UNIT_FACTOR =
  "Enter Unit=factor pairs separated with a pipe character ( | ), for example [ Box=12 | Pallet=480 ]. The factor is how many base units make one alternative unit and must be above 0. The unit must be from a different category than the base unit.";

describe("textMeasure", () => {
  it("measures a known one-line string as 1 line", () => {
    expect(lineCount("New name", 30)).toBe(1);
    expect(lineCount("Steel parts", 28)).toBe(1);
  });

  it("measures known wrapped strings the way Excel wraps them", () => {
    expect(lineCount("Steel parts for ram pro master 2500", 28)).toBe(2);
    expect(lineCount("Units from the Valid Values sheet, factor above 0", 30)).toBe(2);
    expect(lineCount(UNIT_FACTOR, 100)).toBe(3);
  });

  it("counts explicit newlines as line breaks", () => {
    expect(lineCount("a\nb", 30)).toBe(2);
    expect(lineCount("a\nb\nc", 100)).toBe(3);
    expect(lineCount("", 30)).toBe(1);
  });

  it("sums the pixels of a merged range", () => {
    expect(usableWidth([30, 100])).toBeGreaterThan(usableWidth(130));
    expect(lineCount(UNIT_FACTOR, [30, 100])).toBe(2);
  });
});
