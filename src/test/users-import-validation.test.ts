/* The review grid's required-field set has to match the template the customer
 * is handed, because the template is the contract. Two rules had drifted from
 * it in opposite directions, and both failed silently:
 *
 *   - Last Name carries an asterisk in OMNE_Users_Import_Template.csv and is
 *     named in the guide's three required columns, but was never checked, so a
 *     row with no surname imported clean and produced a one-word user.
 *   - License carries no asterisk and the guide calls it optional, but a blank
 *     one hard-failed a create row, blocking an import the template says is
 *     legal.
 *
 * Both the review grid and the import log run this same validator, so pinning
 * it here covers both surfaces. */
import { describe, it, expect } from "vitest";
import { validateRows } from "../app/components/data-imports/import-review/validation";
import type { UserReviewRow } from "../app/components/data-imports/import-review/usersReviewMockData";

function row(over: Partial<UserReviewRow> = {}): UserReviewRow {
  return {
    firstName: "Robert",
    lastName: "Patel",
    emailAddress: "robert.patel@acme.com",
    licenseType: "Full Access",
    status: "",
    assignedRoles: "",
    username: "",
    gender: "",
    dateOfBirth: "",
    preferredName: "",
    pronouns: "",
    jobTitle: "",
    personalEmail: "",
    mobile: "",
    workPhone: "",
    homeAddress: "",
    workAddress: "",
    ...over,
  };
}

const EXISTING = { existingEmails: new Set(["robert.patel@acme.com"]) };

/** Issues raised against one field on the first row. */
function issuesFor(r: UserReviewRow, field: keyof UserReviewRow, ctx = {}) {
  return validateRows([r], ctx).rows[0].byField[field] ?? [];
}

describe("Last Name is required, like the template says", () => {
  it("errors on a create row with no last name", () => {
    const issues = issuesFor(row({ lastName: "" }), "lastName");
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("error");
    expect(issues[0].code).toBe("REQUIRED_EMPTY");
    expect(issues[0].message).toContain("Last Name");
  });

  it("whitespace does not satisfy it", () => {
    expect(issuesFor(row({ lastName: "   " }), "lastName")[0]?.severity).toBe("error");
  });

  it("marks the whole row as an error, so the import is blocked", () => {
    const v = validateRows([row({ lastName: "" })], {});
    expect(v.rows[0].status).toBe("error");
    expect(v.errorRowCount).toBe(1);
  });

  it("stays optional on an update row, where blank means leave it alone", () => {
    expect(issuesFor(row({ lastName: "" }), "lastName", EXISTING)).toHaveLength(0);
  });

  it("a complete row is clean", () => {
    expect(validateRows([row()], {}).rows[0].status).toBe("ready");
  });
});

describe("License is optional, like the template says", () => {
  it("warns rather than errors when blank on a create row", () => {
    const issues = issuesFor(row({ licenseType: "" }), "licenseType");
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("warning");
    expect(issues[0].code).toBe("MISSING_LICENSE");
    // The message has to say where the user actually lands
    expect(issues[0].message).toContain("No License");
  });

  it("a blank license does not block the import", () => {
    const v = validateRows([row({ licenseType: "" })], {});
    expect(v.rows[0].status).toBe("warning");
    expect(v.errorRowCount).toBe(0);
    expect(v.warningRowCount).toBe(1);
  });

  it("an unrecognised value warns too, and names the accepted values", () => {
    const issues = issuesFor(row({ licenseType: "Fll Access" }), "licenseType");
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("warning");
    expect(issues[0].message).toContain("Full Access");
    expect(validateRows([row({ licenseType: "Fll Access" })], {}).errorRowCount).toBe(0);
  });

  it("says nothing at all when blank on an update row", () => {
    expect(issuesFor(row({ licenseType: "" }), "licenseType", EXISTING)).toHaveLength(0);
  });

  it("accepts each of the three valid values silently", () => {
    for (const l of ["Full Access", "Field User", "No License"]) {
      expect(issuesFor(row({ licenseType: l }), "licenseType"), l).toHaveLength(0);
    }
  });
});

describe("the required set is exactly the template's three asterisked columns", () => {
  it("First Name, Last Name and Email each error when blank on a create row", () => {
    for (const field of ["firstName", "lastName", "emailAddress"] as const) {
      const v = validateRows([row({ [field]: "" })], {});
      expect(v.rows[0].status, field).toBe("error");
    }
  });

  it("nothing else blocks a create row: only the asterisked three do", () => {
    const optional: (keyof UserReviewRow)[] = [
      "licenseType", "status", "assignedRoles", "username", "gender",
      "dateOfBirth", "preferredName", "pronouns", "jobTitle",
      "personalEmail", "mobile", "workPhone", "homeAddress", "workAddress",
    ];
    for (const field of optional) {
      const v = validateRows([row({ [field]: "" })], {});
      expect(v.errorRowCount, `blank ${field} should not be an error`).toBe(0);
    }
  });
});
