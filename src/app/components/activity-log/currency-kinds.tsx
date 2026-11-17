import { ActorLink, Hit, Lead, PersonValue, Sep, StatusPillNode, TextFromTo } from "./activity-log";
import type { ExtraKindSpec } from "./activity-profile";
import type { FxEvent, FxRow, FxSegment } from "./activity-data";
import { CurrencyLink } from "./currency-entity-links";

/* Mahreen Ghafoor's Currency & Exchange Rates entries ("Activity Logs:
 * Currency & Exchange Rates", 16 Nov 2026), built from the shared log's
 * pieces. Each entry is one change with its facts, so its rows are never cut:
 * one row renders bare, several as the dotted list. */

const Dot = () => <span className="mx-1.5 text-muted-foreground">·</span>;

const Value = ({ text, query }: { text: string; query: string }) => (
  <span className="font-medium text-foreground">
    <Hit text={text} query={query} />
  </span>
);

const segText = (s: FxSegment) => ("t" in s ? s.t : "v" in s ? s.v : "person" in s ? s.person : s.currency);

function segNode(s: FxSegment, i: number, query: string) {
  if ("t" in s) return <Hit key={i} text={s.t} query={query} />;
  if ("v" in s) return <Value key={i} text={s.v} query={query} />;
  if ("person" in s) return <PersonValue key={i} name={s.person} query={query} />;
  return <CurrencyLink key={i} code={s.currency} query={query} />;
}

const isActive = (label: string) => label === "Active";

const rowText = (r: FxRow): string =>
  r.kind === "sentence"
    ? r.parts.map(segText).join("")
    : r.kind === "note"
      ? r.text
      : r.kind === "pair"
        ? `${r.field} updated from ${r.before} to ${r.after}`
        : `Status updated from ${r.before} to ${r.after}`;

function rowNode(r: FxRow, query: string) {
  switch (r.kind) {
    case "sentence":
      return <>{r.parts.map((s, i) => segNode(s, i, query))}</>;
    case "note":
      return <Hit text={r.text} query={query} />;
    case "pair":
      return (
        <>
          <Hit text={r.field} query={query} /> updated <Lead before="text" query={query} />
          <TextFromTo before={r.before} after={r.after} query={query} />
        </>
      );
    case "status":
      return (
        <>
          <Hit text="Status" query={query} /> updated <Lead before="status" query={query} />
          <span className="inline-flex flex-wrap items-center align-middle">
            <StatusPillNode label={r.before} active={isActive(r.before)} query={query} />
            <Sep before="status" after="status" query={query} />
            <StatusPillNode label={r.after} active={isActive(r.after)} query={query} />
          </span>
        </>
      );
  }
}

function head(e: FxEvent, query: string) {
  return (
    <>
      <ActorLink name={e.actor} query={query} /> <Hit text={e.verb} query={query} />
      {e.value &&
        (e.value.middot ? (
          <>
            <Dot />
            <Value text={e.value.text} query={query} />
          </>
        ) : (
          <>
            {" "}
            <Value text={e.value.text} query={query} />
          </>
        ))}
    </>
  );
}

const headText = (e: FxEvent) => [e.verb, e.value?.text].filter(Boolean).join(e.value?.middot ? " · " : " ");

export const FX_KINDS: Record<string, ExtraKindSpec> = {
  fx: {
    parts: (e: FxEvent, { query }) => {
      const rows = e.rows.map((r) => ({ node: rowNode(r, query), text: rowText(r) }));
      return {
        head: head(e, query),
        longRow: rows.length === 1 ? rows[0].node : null,
        subRows: rows.length > 1 ? rows : undefined,
      };
    },
    searchText: (e: FxEvent) => [headText(e), ...e.rows.map(rowText), ...(e.trigger ? [e.trigger] : [])],
    subRowText: (e: FxEvent) => (e.rows.length > 1 ? e.rows.map(rowText) : []),
    // The edited note is the shared long-text entry, filed under its key; a
    // note added or removed files under the same one, so Notes is one option.
    changedFields: (e: FxEvent) => [e.changed === "notes" ? "description" : e.changed],
    eventKind: (e: FxEvent) => e.filter,
    singleChange: true,
  },
};
