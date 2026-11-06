import { useMemo } from "react";
import { ExternalLink, Info, Lock, Package } from "lucide-react";
import { BaseModal } from "@/app/components/shared/BaseModal";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/app/components/ui/hover-card";
import { ENTITY_META } from "./importSpec";
import { RECORD_NOUN, RECORD_NOUN_PLURAL } from "./importSpec";
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

/* The body carries `min-h-[360px]`: a floor so the modal does not shrink-wrap
   to a single card and read as a different, smaller dialog than the upload
   step before it. Kept as a class rather than a style prop so BaseModal, which
   every modal in the module shares, does not need a wider API for one step. */

export function MissingRecordsStep({
  open,
  gaps,
  onContinue,
  onClose,
}: {
  open: boolean;
  /** Every unresolved dependency in the file, grouped by value already. */
  gaps: EntityGap[];
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
      subtitle={`Your file names ${totalValues} ${totalValues === 1 ? "record" : "records"} Omne does not hold. Create them in their own modules, or carry on and the rows that need them stay behind.`}
      icon={<Package />}
      /* Same width as the upload step, and a floor under the body, so moving
         between steps reads as one modal changing its contents rather than
         two modals of different sizes trading places. */
      width="xl"
      zIndex={12290}
      bodyClassName="flex-1 min-h-[360px] overflow-y-auto bg-slate-50 px-4 lg:px-5 py-4"
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
                  {/* The module is what someone is looking for, so it leads.
                      The count follows it as a pill carrying Partner's ⓘ
                      marker (`ui/info-tooltip`, 93 uses across the module):
                      hovering it explains the count by listing the values
                      behind it. Deliberately not a chevron, which promises a
                      menu of things to pick. */}
                  <p className="text-[13px] text-foreground" style={{ fontWeight: 600, margin: 0 }}>
                    {meta.noun.charAt(0).toUpperCase() + meta.noun.slice(1)}s
                  </p>
                  <HoverCard openDelay={120} closeDelay={80}>
                    <HoverCardTrigger asChild>
                      <span
                        className="inline-flex items-center gap-1 h-[22px] px-2 rounded-full border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:border-red-300 transition-colors cursor-pointer"
                        style={{ fontSize: "11.5px", fontWeight: 600 }}
                      >
                        {group.values.length}
                        <Info className="w-2.5 h-2.5 opacity-70" />
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
                  {meta.canCreate === false && (
                    <span
                      className="inline-flex items-center gap-1 h-[22px] px-2 rounded-md border border-amber-200 bg-amber-50 text-amber-800"
                      style={{ fontSize: "10.5px", fontWeight: 600 }}
                    >
                      <Lock className="w-2.5 h-2.5" />
                      No access
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-slate-500 mt-1" style={{ lineHeight: 1.5, margin: 0 }}>
                  Named in {ROWS_LABEL(group.cells)} across {group.records} {group.records === 1 ? RECORD_NOUN : RECORD_NOUN_PLURAL}. Matched by{" "}
                  {group.entity === "item" ? "SKU" : "name"}, so each one has to exist in {meta.module} first.
                </p>
                {meta.canCreate === false && (
                  <p className="text-[12px] text-amber-800 mt-1.5" style={{ lineHeight: 1.5, margin: "6px 0 0" }}>
                    You do not have permission to create {meta.noun}s. Ask someone who
                    administers {meta.module}, or carry on and these rows stay behind.
                  </p>
                )}
              </div>
              {meta.canCreate === false ? (
                <span
                  className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-slate-50 text-[12px] text-slate-400 cursor-not-allowed select-none"
                  style={{ fontWeight: 500 }}
                  title={`You cannot create ${meta.noun}s`}
                >
                  <Lock className="w-3 h-3" />
                  Create in {meta.module}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => window.open(meta.createHref, "_blank", "noopener")}
                  className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-white text-[12px] text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
                  style={{ fontWeight: 500 }}
                >
                  Create in {meta.module}
                  <ExternalLink className="w-3 h-3 opacity-60" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </BaseModal>
  );
}
