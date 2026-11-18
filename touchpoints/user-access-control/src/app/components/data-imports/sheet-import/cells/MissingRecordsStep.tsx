import { useMemo } from "react";
import { ExternalLink, Package } from "lucide-react";
import { BaseModal } from "./BaseModal";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/app/components/ui/hover-card";
import { ENTITY_META } from "./importCatalog";
import type { EntityGap, EntityKind } from "./importModel";

/**
 * What this file needs that Omne does not have yet.
 *
 * The prerequisite list used to be a static lecture before the upload: every
 * module a template can reference, whether or not the file touched it. Read
 * once, ignored after, and no help at all in deciding what to go and create.
 *
 * This replaces it, and it only exists because the file has been read by now.
 * It names the entities the file actually references and Omne actually lacks,
 * with a count per entity, the values behind that count on hover, and a route
 * into the module that owns them. If nothing is missing, this step does not
 * appear at all: there is nothing to teach someone whose file already fits.
 */

const ROWS_LABEL = (n: number) => `${n} ${n === 1 ? "cell" : "cells"}`;

export function MissingRecordsStep({
  open,
  gaps,
  recordNoun,
  recordNounPlural,
  onContinue,
  onClose,
}: {
  open: boolean;
  /** Every unresolved dependency in the file, grouped by value already. */
  gaps: EntityGap[];
  /** What one record of this module is called, e.g. "quote". */
  recordNoun: string;
  recordNounPlural: string;
  onContinue: () => void;
  onClose: () => void;
}) {
  /* One card per entity, biggest first: someone with 35 unknown items wants to
     see that before a single unknown payment term. */
  const groups = useMemo(() => {
    const byEntity = new Map<EntityKind, EntityGap[]>();
    for (const g of gaps) {
      const list = byEntity.get(g.entity) ?? [];
      list.push(g);
      byEntity.set(g.entity, list);
    }
    return [...byEntity.entries()]
      .map(([entity, list]) => ({
        entity,
        values: list.map((g) => g.rawValue).filter(Boolean),
        cells: list.reduce((n, g) => n + g.occurrences, 0),
        records: new Set(list.flatMap((g) => g.recordIds)).size,
      }))
      .sort((a, b) => b.values.length - a.values.length);
  }, [gaps]);

  const totalValues = groups.reduce((n, g) => n + g.values.length, 0);

  return (
    <BaseModal
      isOpen={open}
      onClose={onClose}
      title="Records this file needs first"
      subtitle={`Your file names ${totalValues} ${totalValues === 1 ? "record" : "records"} Omne does not hold. This import matches records and never creates them, so create these in their own modules, then bring the file back. You can carry on now; the rows that need them stay behind, kept.`}
      icon={<Package />}
      width="lg"
      zIndex={12290}
      bodyClassName="flex-1 min-h-0 overflow-y-auto bg-slate-50 px-4 lg:px-5 py-4"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center px-4 h-9 rounded-lg border border-border bg-white text-[13px] text-slate-500 hover:text-foreground hover:border-slate-300 transition-all cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onContinue}
            autoFocus
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary hover:bg-primary/90 text-white text-[13px] shadow-sm transition-colors cursor-pointer"
            style={{ fontWeight: 600 }}
          >
            Continue to review
          </button>
        </>
      }
    >
      <div className="flex flex-col" style={{ gap: 8 }}>
        {groups.map((group) => {
          const meta = ENTITY_META[group.entity];
          const noun = group.values.length === 1 ? meta.noun : `${meta.noun}s`;
          return (
            <div key={group.entity} className="flex items-start gap-3 rounded-xl border border-border bg-white px-3.5 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* The count is the affordance: hovering it lists what is
                      actually missing, which no flat card could hold. */}
                  <HoverCard openDelay={120} closeDelay={80}>
                    <HoverCardTrigger asChild>
                      <span
                        className="inline-flex items-center h-[22px] px-2 rounded-full border border-red-200 bg-red-50 text-red-700 cursor-help"
                        style={{ fontSize: "11.5px", fontWeight: 600 }}
                      >
                        {group.values.length} {noun}
                      </span>
                    </HoverCardTrigger>
                    <HoverCardContent
                      side="bottom"
                      align="start"
                      sideOffset={8}
                      className="w-[300px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden z-[12500]"
                    >
                      <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-3.5 py-2.5">
                        <p className="text-[12px] text-white" style={{ fontWeight: 600, letterSpacing: "0.01em" }}>
                          Missing {noun}
                        </p>
                      </div>
                      <div className="bg-white px-3.5 py-3" style={{ maxHeight: 240, overflowY: "auto" }}>
                        <ul className="flex flex-col" style={{ gap: 5, margin: 0, padding: 0, listStyle: "none" }}>
                          {group.values.slice(0, 40).map((v) => (
                            <li key={v} className="text-[11.5px] text-slate-600 break-words">{v}</li>
                          ))}
                        </ul>
                        {group.values.length > 40 && (
                          <p className="text-[11px] text-slate-400 mt-2" style={{ margin: "8px 0 0" }}>
                            and {group.values.length - 40} more, all listed in the review sheet.
                          </p>
                        )}
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                  <p className="text-[13px] text-foreground" style={{ fontWeight: 600, margin: 0 }}>
                    {meta.noun.charAt(0).toUpperCase() + meta.noun.slice(1)}s
                  </p>
                </div>
                <p className="text-[12px] text-slate-500 mt-1" style={{ lineHeight: 1.5, margin: 0 }}>
                  Named in {ROWS_LABEL(group.cells)} across {group.records} {group.records === 1 ? recordNoun : recordNounPlural}. Matched by{" "}
                  {group.entity === "item" ? "SKU" : "name"}, so each one has to exist in {meta.module} first.
                </p>
              </div>
              <button
                type="button"
                onClick={() => window.open(meta.createHref, "_blank", "noopener")}
                className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-white text-[12px] text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
                style={{ fontWeight: 500 }}
              >
                Create in {meta.module}
                <ExternalLink className="w-3 h-3 opacity-60" />
              </button>
            </div>
          );
        })}
      </div>
    </BaseModal>
  );
}
