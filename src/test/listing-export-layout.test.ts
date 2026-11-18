import { describe, expect, it } from "vitest";
import { buildUsersWorkbook, USERS_TEMPLATE_FIELD_HELP } from "../app/lib/users-export";
import { buildRolesWorkbook } from "../app/lib/roles-export";
import { users as usersData } from "../app/data/users-data";
import { roles as rolesData } from "../app/data/roles-data";

describe("listing export workbooks (shared exportLayout.mjs)", () => {
  it("Users: band, filtered header in row 2, frozen under it, Glossary tab", async () => {
    const ids = ["full_name", "email", "add.gender"];
    const labels = ["Full Name", "Email", "Gender"];
    const help = ["Always included. The user's full name as it appears in Omne.", "The address the user signs in with and where Omne sends their notifications.", USERS_TEMPLATE_FIELD_HELP["add.gender"]];
    const wb = await buildUsersWorkbook(usersData.slice(0, 3), ids, labels, help);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Users", "Glossary"]);
    const ws = wb.getWorksheet("Users")!;
    expect(ws.views[0]).toMatchObject({ state: "frozen", ySplit: 2, xSplit: 1 });
    expect(String(ws.getCell("A1").value)).toMatch(/^OMNE {2}· {2}Users Export/);
    expect(ws.getCell("A2").value).toBe("Full Name");
    expect(ws.autoFilter).toEqual({ from: { row: 2, column: 1 }, to: { row: 5, column: 3 } });
    const g = wb.getWorksheet("Glossary")!;
    expect([g.getCell("B9").value, g.getCell("C9").value]).toEqual(["Gender", "The user's gender."]);
  });

  it("Roles: same layout", async () => {
    const wb = await buildRolesWorkbook(rolesData.slice(0, 2), ["role_name"], ["Role Name"], ["Always included. The name of the role as it appears in Omne."]);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Roles", "Glossary"]);
    expect(wb.getWorksheet("Roles")!.getCell("A2").value).toBe("Role Name");
  });
});
