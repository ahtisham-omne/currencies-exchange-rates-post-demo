import { describe, expect, it } from "vitest";
import { findSearchSuggestion } from "../searchSuggestion";
import { resolveTableEmptyKind } from "../../components/ui/table-empty-state";

const corpus = ["Toyota Motors", "Acme Industries", "Bosch GmbH", "jane@toyota.com", "Lahore", "Karachi"];

describe("findSearchSuggestion", () => {
  it("fixes a doubled letter", () => {
    expect(findSearchSuggestion("toyotaa", corpus)).toBe("Toyota");
  });
  it("fixes a transposition", () => {
    expect(findSearchSuggestion("bsoch", corpus)).toBe("Bosch");
  });
  it("fixes a typo inside a phrase", () => {
    expect(findSearchSuggestion("acme indstries", corpus)).toBe("Acme Industries");
  });
  it("tolerates a typo in a partial word", () => {
    expect(findSearchSuggestion("karchi", corpus)).toBe("Karachi");
  });
  it("returns null for short or unrelated queries", () => {
    expect(findSearchSuggestion("zz", corpus)).toBeNull();
    expect(findSearchSuggestion("zzqx-no-such-contact", corpus)).toBeNull();
  });
  it("respects the yieldsResults guard", () => {
    expect(findSearchSuggestion("toyotaa", corpus, { yieldsResults: () => false })).toBeNull();
  });
});

describe("resolveTableEmptyKind", () => {
  const base = { totalCount: 10, filteredCount: 0, pageCount: 0 };
  it("never confuses a failed load with an empty search", () => {
    expect(resolveTableEmptyKind({ ...base, loadState: "error", searchQuery: "x" })).toBe("error");
  });
  it("picks the search / filter variants", () => {
    expect(resolveTableEmptyKind({ ...base, searchQuery: "x" })).toBe("no-results");
    expect(resolveTableEmptyKind({ ...base, filterCount: 2 })).toBe("no-filter-results");
    expect(resolveTableEmptyKind({ ...base, searchQuery: "x", filterCount: 1 })).toBe("no-results-filtered");
  });
  it("detects first use and empty pages", () => {
    expect(resolveTableEmptyKind({ totalCount: 0, filteredCount: 0 })).toBe("no-data");
    expect(resolveTableEmptyKind({ totalCount: 30, filteredCount: 30, pageCount: 0 })).toBe("page-empty");
    expect(resolveTableEmptyKind({ totalCount: 30, filteredCount: 30, pageCount: 10 })).toBeNull();
  });
});
