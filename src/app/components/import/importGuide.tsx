import type { ReadingRoomSection } from "./reading-room";
import { COLUMNS, RECORD_LABEL, RECORD_NOUN, RECORD_NOUN_PLURAL } from "./importSpec";

/**
 * The importer's "How this works" guide.
 *
 * UAC ships one as a TXT it fetches and parses into Reading Room sections.
 * Ours is written here instead, because the things worth explaining are the
 * ones this template does differently: a record spans as many rows as it has
 * line items, dependencies point at records this import may not create, and
 * everything arrives as version 1.
 */

const required = COLUMNS.filter((c) => c.requirement === "required").length;
const conditional = COLUMNS.filter((c) => c.requirement === "conditional").length;
const optional = COLUMNS.filter((c) => c.requirement === "optional").length;

export const GUIDE_TITLE = `${RECORD_LABEL}s Import Guide`;

const RAW: { title: string; body: string }[] = [
  {
    title: "Overview",
    body: `This guide explains how to fill in the ${RECORD_NOUN} import sheet: the columns, how one ${RECORD_NOUN} spreads across several rows, and what happens to a row that points at something this import cannot create.\n\nThe template has ${required} required columns, ${conditional} that are required in certain cases, and ${optional} optional ones.`,
  },
  {
    title: "Quick start",
    body: `Step 1: Download the template above, as Excel or CSV. The first row is the column headers. Below it are worked examples: the first few are complete and correct, and the rest deliberately carry a warning or an error so you can see what the review step does with each. Every example says which it is in Internal Notes. Delete all of them before you import your own data.\n\nStep 2: Fill in your ${RECORD_NOUN_PLURAL}. Required columns are marked with an asterisk and cannot be left blank.\n\nStep 3: Give every ${RECORD_NOUN} its own number in the Quote No column. Keep the number your old system used; nothing in the number marks the record as imported, the header pill does that.\n\nStep 4: For columns that hold a list, such as Secondary Sales Reps or Tags, separate each value with a pipe ( | ). Example: [ Ambulance Build | grant-funded ]\n\nStep 5: Upload the file and review it. Rows with errors are held back, not imported half-way.`,
  },
  {
    title: `One ${RECORD_NOUN}, several rows`,
    body: `A ${RECORD_NOUN} occupies one row per line item. Fill the record-level columns on the group's FIRST row only, and leave them blank underneath; the Line / columns are filled on every row of the group.\n\nRows are grouped by the ${RECORD_NOUN} number, so all rows of one ${RECORD_NOUN} must repeat nothing except their own line values. The review sheet then shows one row per ${RECORD_NOUN}, with its line items behind a summary cell you can open and fix.`,
  },
  {
    title: "Things this import points at, but never creates",
    body: `Customers, contacts, locations, items, units of measure, pricing rules and payment terms all belong to their own modules. This import matches them by name, description or SKU and never creates them.\n\nIf a value does not match, the row becomes an error with two ways out: point the cell at something that does exist, or open the owning module and create it there, then re-import. Fixing one misspelling can fix every row that shares it, in one step.`,
  },
  {
    title: "Discounts and premiums",
    body: `One-time discounts and premiums travel as Label:Value, several separated by a pipe. A minus is a discount, a plus is a premium, and a percentage ends in %.\n\nExample: [ Returning Customer Credit:-2500 | Expedited Build Schedule:+4500 ]\n\nThe record-level column applies to the whole ${RECORD_NOUN}; the Line / Discount/Premium column applies to that line only. In the review sheet, either cell opens the module's own adjustments editor.`,
  },
  {
    title: "Versions and what lands",
    body: `Everything imports as version 1 and carries a Legacy Import pill on its detail page, so an imported record is never mistaken for one created here.\n\nA number that already exists in the listing is refused rather than overwritten: renumber the row, or drop it. Rows held back are kept, so they can be finished later from Company Setup, Data Imports.`,
  },
];

/* ── UAC's guide renderer ──────────────────────────────────────────────
   Ported from `GuideBody` in their ImportSetupStep: paragraphs separated by
   a blank line, a line that opens with "Something:" becoming a bold lead
   label, and their exact margins between block kinds. */

type GuideBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "labeled"; label: string; body: string };

function parseGuideBody(text: string): GuideBlock[] {
  const blocks: GuideBlock[] = [];
  for (const chunk of text.split("\n\n")) {
    const line = chunk.replace(/\s+/g, " ").trim();
    if (!line) continue;
    const m = line.match(/^([A-Za-z][^:]{0,40}):\s+(.+)$/);
    if (m) blocks.push({ kind: "labeled", label: m[1], body: m[2] });
    else blocks.push({ kind: "paragraph", text: line });
  }
  return blocks;
}

export function GuideBody({ text }: { text: string }) {
  const blocks = parseGuideBody(text);
  return (
    <div>
      {blocks.map((b, idx) => {
        const prev = blocks[idx - 1];
        const marginTop = idx === 0 ? 0 : b.kind === "labeled" && prev?.kind === "labeled" ? 6 : 10;
        if (b.kind === "labeled") {
          return (
            <p key={idx} style={{ margin: `${marginTop}px 0 0 0` }}>
              <strong style={{ fontWeight: 600, color: "rgb(15, 23, 42)" }}>{b.label}:</strong>{" "}
              {b.body}
            </p>
          );
        }
        return <p key={idx} style={{ margin: `${marginTop}px 0 0 0` }}>{b.text}</p>;
      })}
    </div>
  );
}

export const GUIDE_SECTIONS: ReadingRoomSection[] = RAW.map((s) => ({
  title: s.title,
  body: <GuideBody text={s.body} />,
}));
