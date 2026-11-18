import type { ReadingRoomSection } from "../../ui/reading-room";

/** A parsed/authored block in a guide section, ready for rendering. The TXT
 *  parser in ImportSetupStep produces the same shape, so authored content and
 *  fetched content render identically. */
export type GuideBlock =
  | { kind: "subheader"; text: string }
  | { kind: "labeled"; label: string; body: string }
  | { kind: "paragraph"; text: string };

/** Renders a run of guide blocks as drawer prose. */
export function GuideBlocks({ blocks }: { blocks: GuideBlock[] }) {
  return (
    <div>
      {blocks.map((b, idx) => {
        const prev = blocks[idx - 1];
        let marginTop: number;
        if (idx === 0) marginTop = 0;
        else if (b.kind === "subheader") marginTop = 18;
        else if (b.kind === "labeled" && prev?.kind === "labeled") marginTop = 6;
        else marginTop = 10;

        if (b.kind === "subheader") {
          return (
            <h4
              key={idx}
              style={{
                margin: `${marginTop}px 0 8px 0`,
                fontSize: 13.5,
                fontWeight: 600,
                color: "rgb(15, 23, 42)",
              }}
            >
              {b.text}
            </h4>
          );
        }
        if (b.kind === "labeled") {
          return (
            <p key={idx} style={{ margin: `${marginTop}px 0 0 0` }}>
              <strong style={{ fontWeight: 600, color: "rgb(15, 23, 42)" }}>
                {b.label}:
              </strong>
              {" "}
              {b.body}
            </p>
          );
        }
        return (
          <p key={idx} style={{ margin: `${marginTop}px 0 0 0` }}>
            {b.text}
          </p>
        );
      })}
    </div>
  );
}

/** Shorthands so the authored content below stays readable. */
const p = (text: string): GuideBlock => ({ kind: "paragraph", text });
const h = (text: string): GuideBlock => ({ kind: "subheader", text });
const l = (label: string, body: string): GuideBlock => ({ kind: "labeled", label, body });

function section(title: string, blocks: GuideBlock[]): ReadingRoomSection {
  /* `blocks` rides along for the How This Works panel, which lays the same
   * copy out as cards and term tables. */
  return { title, body: <GuideBlocks blocks={blocks} />, blocks } as ReadingRoomSection;
}

/* ────────────────────────────────────────────────────────────────────────
 * Authored drawer copy.
 *
 * This is the "How This Works" drawer content, and it is deliberately NOT
 * the shipped TXT guide. The TXT is the CSV companion, it goes out with the
 * CSV download and reads as a plain-text reference for a spreadsheet that
 * carries no instructions of its own. The drawer is the in-product read:
 * shorter, format-neutral, and true of the Excel template and the CSV alike.
 * Keep it that way, do not reintroduce CSV-only wording here.
 * ──────────────────────────────────────────────────────────────────────── */

export const USERS_GUIDE_SECTIONS: ReadingRoomSection[] = [
  section("Overview", [
    p(
      "Importing brings a batch of people into Omne in one pass. Download the template, fill in one user per row, and upload it back. Omne checks every row and shows you the results before anything is saved."
    ),
    p(
      "Excel and CSV carry the same 28 columns and import the same way, so pick whichever you work in. Three columns are required, First Name, Last Name and Email. The other 25 are optional."
    ),
    p(
      "The Excel file opens on its Data Entry sheet and keeps Instructions, Field Reference and Valid Values on sheets beside it. The CSV has no room for that, so it downloads with a plain-text guide alongside it."
    ),
  ]),

  section("Quick start", [
    l("Step 1", "Download the template in the format you prefer, Excel or CSV."),
    l(
      "Step 2",
      "Delete the two example rows. They are there to show the expected format, not to be imported."
    ),
    l(
      "Step 3",
      "Enter your users, one per row. First Name, Last Name and Email cannot be left blank. Leave the column headers exactly as they are."
    ),
    l(
      "Step 4",
      "For columns that hold a list, such as Assigned Roles, Languages and Citizenships, separate each value with a pipe character ( | ). The pipe sits above the backslash key, typed with Shift. For example: Administrator | Warehouse Manager"
    ),
    l(
      "Step 5",
      "Save the file and upload it here. In Excel, keep only the Data Entry sheet before you upload, Omne reads a single sheet."
    ),
  ]),

  section("How users are matched", [
    p(
      "Omne matches each row by email and then decides whether to create a user or update one. The email is the matching key and is never changed by an import. What a few columns do depends on which case a row lands in."
    ),
    h("A new user"),
    p(
      "The email is not in Omne yet, so a user is created in the Draft state. A license is applied if you give one, and a blank License means No License. Status is not read, new users always start as Draft. Enter Yes under Invite to mark them to be invited. Roles are attached, but they only take effect once the user holds a license that covers them."
    ),
    h("An existing user"),
    p(
      "The email already belongs to a user, so that user is updated with the values you provide and a blank cell leaves the current value alone. A blank License keeps their current license. Status is never changed by an import. Invite does not apply, the user is already in Omne."
    ),
    h("An archived user"),
    p(
      "The email belongs to an archived user. The row is flagged and Omne asks whether to restore that user into Draft. Restored users join your other new drafts, and you choose after the import whether to invite them."
    ),
  ]),

  section("Nothing is saved until you confirm", [
    p(
      "After the upload, Omne validates every row and shows you what it found before writing anything. Rows with errors do not import until you fix them. Rows with warnings do import and stay flagged, for example when a role name cannot be found. You confirm the import yourself, and only then are the changes saved."
    ),
    p(
      "Invitations are handled in the review step that follows, so you can still change your mind about who gets invited and who stays in Draft."
    ),
  ]),

  section("Dates, phone numbers and lists", [
    l(
      "Dates",
      "Enter Date of Birth in year-month-day order, for example 1992-03-15. That one order reads the same everywhere, so the day and the month are never confused. Omne exports dates the same way, so a file exported from Omne, edited and imported back needs no change."
    ),
    l(
      "Phone numbers",
      "Enter them as you already have them, including any plus sign or country code. They are kept as text, so there is nothing to reformat or split."
    ),
    l(
      "Addresses",
      "One address per cell, on a single line. There is no need to split the street, city or postcode into separate columns."
    ),
    l(
      "Lists",
      "Assigned Roles, Languages and Citizenships can each hold several values, separated with a pipe character ( | ). Each role name must match a role that already exists in Omne. Matching is not case sensitive."
    ),
  ]),

  section("Copying from another system", [
    p(
      "Both formats are plain tabular data, so you can paste straight in from an export of your old system. Line your old columns up with these columns, fill in anything your old system did not have, and paste."
    ),
    p(
      "These columns cover what most people bring across, up to three phone numbers, one personal email, a home and a work address, and one emergency contact. If a user has more than that, import what fits here and add the rest to their profile afterwards."
    ),
  ]),

  section("File limits", [
    p(
      "Upload an Excel (.xlsx) or CSV (.csv) file up to 10 MB. Omne reads a single sheet, so keep only the Data Entry sheet in an Excel file before uploading."
    ),
  ]),
];

export const ROLES_GUIDE_SECTIONS: ReadingRoomSection[] = [
  section("Overview", [
    p(
      "Importing creates or updates roles and places existing users in them. Download the template, enter one role per row, and upload it back. Omne checks every row and shows you the results before anything is saved."
    ),
    p(
      "Excel and CSV carry the same four columns and import the same way, so pick whichever you work in. Only Role Name is required. Description, Role Owner and Assigned Users are optional."
    ),
    p(
      "The Excel file opens on its Data Entry sheet and keeps Instructions, Field Reference and Valid Values on sheets beside it. The CSV has no room for that, so it downloads with a plain-text guide alongside it."
    ),
  ]),

  section("What this template does, and what it does not", [
    p(
      "This template brings roles in and puts users in them. It does not set permissions, and it has no license column."
    ),
    p(
      "A role's permissions are chosen in the role builder in Omne, and Omne works out the license those permissions require. That is why neither appears here. Bring the role in first, then set its permissions in Omne. Until you do, an imported role grants nothing."
    ),
  ]),

  section("Quick start", [
    l("Step 1", "Download the template in the format you prefer, Excel or CSV."),
    l(
      "Step 2",
      "Delete the two example rows. They are there to show the expected format, not to be imported."
    ),
    l(
      "Step 3",
      "Enter your roles, one per row. Only Role Name is required. Leave the column headers exactly as they are."
    ),
    l(
      "Step 4",
      "To place more than one user in a role, separate the emails with a pipe character ( | ). The pipe sits above the backslash key, typed with Shift. For example: priya.sharma@acme.com | marcus.lee@acme.com"
    ),
    l(
      "Step 5",
      "Save the file and upload it here. In Excel, keep only the Data Entry sheet before you upload, Omne reads a single sheet."
    ),
  ]),

  section("How roles are matched", [
    p(
      "Omne matches each row by role name. A name it does not recognise creates a new role. A name that matches an existing custom role updates that role, and blank cells leave the current values alone. The role name itself is never changed by an import."
    ),
    p(
      "Predefined system roles cannot be created or changed this way. A row whose Role Name matches a system role is rejected."
    ),
    p("Each role name must also be unique within the file."),
  ]),

  section("Nothing is saved until you confirm", [
    p(
      "After the upload, Omne validates every row and shows you what it found before writing anything. Rows with errors do not import until you fix them. Rows with warnings do import and stay flagged, for example when an assigned user cannot be found. You confirm the import yourself, and only then are the changes saved."
    ),
  ]),

  section("Column reference", [
    l(
      "Role Name",
      "Required. The unique name of the role, and the matching key. A matching name updates that role, any other name creates a new one. It must not match a predefined system role."
    ),
    l("Description", "Optional. What the role is for. Free text."),
    l(
      "Role Owner",
      "Optional. A single owner, given as the email or the full name of a user who already exists in Omne. If the owner cannot be found, the role still imports, is flagged with a warning, and you can set the owner later."
    ),
    l(
      "Assigned Users",
      "Optional. Existing Omne users to place in the role, as pipe-separated emails. An email that cannot be found imports with a warning and that user is left out. This column adds users to a role, it does not create them. Use the Users import for that."
    ),
    l(
      "Permissions and license",
      "Not set here. There is no permissions column and no license column. Both are handled in the role builder in Omne."
    ),
  ]),

  section("Copying from another system", [
    p(
      "Both formats are plain tabular data, so you can paste straight in from an export of your old system. Line your old columns up with these columns and paste, rather than typing each role by hand."
    ),
  ]),

  section("File limits", [
    p(
      "Upload an Excel (.xlsx) or CSV (.csv) file up to 10 MB. Omne reads a single sheet, so keep only the Data Entry sheet in an Excel file before uploading."
    ),
  ]),
];
