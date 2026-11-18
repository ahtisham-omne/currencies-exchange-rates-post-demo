/* Columns panel search (ERP-5144 AC9, ERP-6899 AC12): letters match in order,
 * case insensitive, and need not sit next to each other. */
import { describe, it, expect } from "vitest";
import { matchesSubsequence, subsequenceMatchIndices } from "../app/lib/subsequence-match";
import { USERS_COLUMNS } from "../app/data/users-table-config";

/* The names the Columns panel searches, derived the way DataTable does: the
 * label when it is text, else the filter label, else the key. */
const USER_COLUMN_NAMES = USERS_COLUMNS.map((c) =>
  typeof c.label === "string" ? c.label : (c.filter?.filterLabel ?? c.key)
);
const search = (q: string) => USER_COLUMN_NAMES.filter((n) => matchesSubsequence(n, q));

describe("Columns panel search", () => {
  it('"iao" finds Invite Accepted On', () => {
    expect(search("iao")).toEqual(["Invite Accepted On"]);
  });

  it('"inv" finds Invited By and Invite Accepted On', () => {
    expect(search("inv")).toEqual(expect.arrayContaining(["Invited By", "Invite Accepted On"]));
  });

  it('"xyz" finds nothing', () => {
    expect(search("xyz")).toEqual([]);
  });

  it("is case insensitive and ignores spaces in the query", () => {
    expect(matchesSubsequence("Invite Accepted On", "IAO")).toBe(true);
    expect(matchesSubsequence("Invite Accepted On", "invite acc")).toBe(true);
  });

  it("needs the letters in order", () => {
    expect(matchesSubsequence("Invite Accepted On", "oai")).toBe(false);
  });

  it("returns the matched letter positions for highlighting", () => {
    // I(0), A(7) of Accepted, O(16) of On
    expect(subsequenceMatchIndices("Invite Accepted On", "iao")).toEqual([0, 7, 16]);
    expect(subsequenceMatchIndices("Invited By", "inv")).toEqual([0, 1, 2]);
    expect(subsequenceMatchIndices("Status", "xyz")).toBeNull();
  });
});
