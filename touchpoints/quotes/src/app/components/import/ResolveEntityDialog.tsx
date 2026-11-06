import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Search, X, ExternalLink, AlertCircle, Check } from "lucide-react";
import { toast } from "sonner";
import { CATALOG, resolveEntity, suggestions, unitsForItem } from "./importCatalog";
import type { CatalogKey } from "./importCatalog";
import { Checkbox } from "@/app/components/ui/checkbox";
import { ENTITY_META } from "./importSpec";
import type { EntityGap } from "./importModel";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/app/components/ui/hover-card";
import { getLineItemImage } from "@/app/data/lineItemImage";
import { ItemTypeBadge } from "@/app/components/shared/ItemTypeBadge";
import { InactiveItemPill } from "../shared/InactiveItemPill";
import { ItemDescription } from "@/app/components/shared/ItemDescription";
import { ITEM_BY_CODE, type CatalogItemRow } from "./importCatalog";

/**
 * Resolve one unmatched dependency.
 *
 * This is where this importer parts company with the User Access Control
 * one. There, an unknown role is picked from a dropdown and the row is
 * fixed. Here the value names a record in another module and this import
 * is not allowed to create it, so the dialog offers the only two honest
 * moves:
 *
 *   · Point the cell at a record that does exist. Near-matches lead, so
 *     "Tri-Countty EMS Authorty" surfaces "Tri-County EMS Authority"
 *     without the user searching for it.
 *   · Go create it in its own module. That opens the module in a new tab
 *     and leaves these records failed, to be finished from Company Setup
 *     once the record exists.
 *
 * The bulk switch is the reason the dialog works on a gap rather than a
 * cell: one misspelling usually appears on many rows, and fixing it once
 * should clear all of them.
 */
export function ResolveEntityDialog({
  gap,
  onApply,
  onClose,
}: {
  gap: EntityGap;
  /** `scope: "all"` rewrites every cell holding this value. */
  onApply: (replacement: string, scope: "all" | "one") => void;
  onClose: () => void;
}) {
  const kind = gap.entity as CatalogKey;
  const meta = ENTITY_META[gap.entity];
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [applyToAll, setApplyToAll] = useState(true);
  const isItem = kind === "item";
  /* Opened from a cell that is already valid, this is a picker; opened from an
     error, it is a fix. Only the copy differs. */
  const valueExists = !!gap.rawValue.trim() && !!resolveEntity(kind, gap.rawValue);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const near = useMemo(() => suggestions(kind, gap.rawValue), [kind, gap.rawValue]);
  const all = CATALOG[kind].options;
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((o) => {
      if (o.toLowerCase().includes(q)) return true;
      /* Items are searchable by their words too, since almost nobody
         remembers a SKU but everybody remembers "lightbar". */
      const item = ITEM_BY_CODE[o];
      return !!item && (item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q));
    });
  }, [all, query]);

  const multi = gap.occurrences > 1;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 12400, background: "rgba(15,23,42,0.55)", backdropFilter: "blur(2px)" }}
      onClick={onClose}
    >
      <div
        className="flex flex-col bg-white"
        style={{ width: isItem ? "min(720px, calc(100vw - 32px))" : "min(560px, calc(100vw - 32px))", maxHeight: "82vh", borderRadius: 14,
                 boxShadow: "0 24px 80px -12px rgba(0,0,0,0.28)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-5 pt-5 pb-4">
          <div className="min-w-0">
            <h3 className="text-[16px] text-slate-900" style={{ fontWeight: 650 }}>
              {valueExists ? `Choose a ${meta.noun}` : `Fix this ${meta.noun}`}
            </h3>
            <p className="text-[12.5px] text-slate-500 mt-1 leading-relaxed">
              {valueExists ? (
                <>
                  This cell points at{" "}
                  <span className="text-slate-900" style={{ fontWeight: 600 }}>"{gap.rawValue}"</span>. Pick another{" "}
                  {meta.noun} from {meta.module}, or leave it as it is.
                </>
              ) : (
                <>
                  <span className="text-slate-900" style={{ fontWeight: 600 }}>"{gap.rawValue}"</span>{" "}
                  is not a {meta.noun} in Omne
                  {multi ? <> and appears in <span style={{ fontWeight: 600 }}>{gap.occurrences}</span> cells</> : null}.
                  This import cannot create {meta.noun}s, so point it at one that exists or create it in {meta.module}.
                </>
              )}
            </p>
          </div>
          <button onClick={onClose} className="shrink-0 w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center cursor-pointer">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {near.length > 0 && (
          <div className="px-5 pb-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-400 mb-2" style={{ fontWeight: 600 }}>
              Did you mean
            </p>
            <div className="flex flex-wrap gap-2">
              {near.map((n) => {
                const active = picked === n;
                return (
                  <button
                    key={n}
                    onClick={() => setPicked(n)}
                    className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-[12.5px] cursor-pointer transition-colors ${
                      active
                        ? "border-primary bg-accent text-primary"
                        : "border-border bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                    style={{ fontWeight: active ? 600 : 500 }}
                  >
                    {active && <Check className="w-3 h-3" />}
                    {n}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="px-5 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${meta.noun}s in Omne...`}
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-border bg-white text-[13px] text-foreground placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5" style={{ minHeight: 120, maxHeight: 260 }}>
          {results.length === 0 ? (
            <div className="py-10 text-center">
              <AlertCircle className="w-5 h-5 mx-auto text-slate-300" />
              <p className="text-[12.5px] text-slate-500 mt-2">
                No {meta.noun} matches "{query}".
              </p>
            </div>
          ) : (
            <div className="flex flex-col py-1">
              {results.map((o) => {
                const active = picked === o;
                const item = isItem ? ITEM_BY_CODE[o] : undefined;
                if (item) {
                  return (
                    <ItemOptionRow
                      key={o}
                      item={item}
                      active={active}
                      onPick={() => setPicked(o)}
                    />
                  );
                }
                return (
                  <button
                    key={o}
                    onClick={() => setPicked(o)}
                    className={`flex items-center gap-2 px-2.5 h-9 rounded-lg text-left text-[13px] cursor-pointer transition-colors ${
                      active ? "bg-accent text-primary" : "text-slate-700 hover:bg-slate-50"
                    }`}
                    style={{ fontWeight: active ? 600 : 400 }}
                  >
                    <span className="w-4 shrink-0">{active && <Check className="w-3.5 h-3.5" />}</span>
                    <span className="truncate">{o}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-muted mt-2">
          {multi && (
            <label className="flex items-start gap-2 cursor-pointer mb-3">
              {/* The shared Checkbox primitive, the one Partners' pickers
                  use, rather than a bare native input. */}
              <span className="mt-0.5">
                <Checkbox checked={applyToAll} onCheckedChange={(v) => setApplyToAll(v === true)} />
              </span>
              <span className="text-[12.5px] text-slate-600 leading-relaxed">
                Apply to all <span className="text-slate-900" style={{ fontWeight: 600 }}>{gap.occurrences}</span> cells
                holding "{gap.rawValue}"
                <span className="text-slate-400"> ({gap.recordIds.length} records)</span>
              </span>
            </label>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                window.open(meta.createHref, "_blank", "noopener");
                toast.info(`Opening ${meta.module} to create "${gap.rawValue}". These records stay failed until it exists, then finish them from Company Setup, Data Imports.`);
                onClose();
              }}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-white text-[12.5px] text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
              style={{ fontWeight: 500 }}
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              Create in {meta.module}
            </button>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={onClose}
                className="h-9 px-3.5 rounded-lg border border-border bg-white text-[12.5px] text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
                style={{ fontWeight: 500 }}
              >
                Cancel
              </button>
              <button
                disabled={!picked}
                onClick={() => picked && onApply(picked, multi && applyToAll ? "all" : "one")}
                className="h-9 px-4 rounded-lg text-[12.5px] text-white cursor-pointer disabled:cursor-not-allowed transition-colors"
                style={{ fontWeight: 600, background: picked ? "var(--primary)" : "var(--muted)",
                         color: picked ? "#FFFFFF" : "var(--muted-foreground)" }}
              >
                {multi && applyToAll ? `Replace ${gap.occurrences} cells` : "Replace"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
/* ── Item rows ─────────────────────────────────────────────────────
   Items get the row shape the line-item tables use, not a bare code:
   a clickable 40px thumbnail that peeks the item, then the code with
   its inventory-type badge, then the long name clamped to a line with
   the `more` toggle. A picker listing forty raw SKUs tells the reader
   nothing; this is the same row they already read on the line grid. */
function ItemOptionRow({
  item, active, onPick,
}: {
  item: CatalogItemRow;
  active: boolean;
  onPick: () => void;
}) {
  return (
    <div
      onClick={onPick}
      className={`flex items-start gap-3 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${
        active ? "bg-accent" : "hover:bg-slate-50"
      }`}
    >
      <span className="w-4 shrink-0 mt-3">{active && <Check className="w-3.5 h-3.5 text-primary" />}</span>
      {/* Clickable thumbnail, same 40px tile and hover ring as the line
          tables. Peeks the item instead of selecting it, so a reader can
          check what a code is before committing the cell to it. */}
      <HoverCard openDelay={140} closeDelay={80}>
        <HoverCardTrigger asChild>
      <button
        type="button"
        onClick={(e) => e.stopPropagation()}
        aria-label={`Preview ${item.code}`}
        style={{
          width: 40, height: 40, borderRadius: 6, border: "1px solid var(--border)",
          padding: 0, flexShrink: 0, cursor: "pointer", background: "transparent",
          overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(27, 110, 243, 0.45)"; e.currentTarget.style.boxShadow = "0 0 0 2px rgba(27, 110, 243, 0.10)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none"; }}
      >
        <img
          src={getLineItemImage(item.code)}
          alt={item.description}
          loading="lazy"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          draggable={false}
        />
      </button>
        </HoverCardTrigger>
        {/* Same 280px preview the line grid hangs off its thumbnail, so a
            reader can check what a code actually is before pointing a cell
            at it. A HoverCard rather than the quick-view modal: a second
            modal over this dialog fought its own backdrop, and a hover
            preview is the lighter move inside a picker. */}
        <HoverCardContent
          side="right" align="start" sideOffset={10}
          className="w-[280px] p-0 rounded-xl border-0 overflow-hidden"
          style={{ zIndex: 12500, boxShadow: "0 8px 30px rgba(0,0,0,0.12)" }}
        >
          <img
            src={getLineItemImage(item.code)}
            alt={item.description}
            style={{ width: "100%", height: 132, objectFit: "cover", display: "block" }}
            draggable={false}
          />
          <div className="p-3 flex flex-col gap-2 bg-white">
            <div className="flex items-center gap-2 flex-wrap">
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{item.code}</span>
              <InactiveItemPill code={item.code} size="md" noun="quote" />
              <ItemTypeBadge type={item.type as never} />
            </div>
            <p className="text-[12px] text-slate-600" style={{ lineHeight: 1.5 }}>{item.description}</p>
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11.5px] text-slate-400">Units: {unitsForItem(item.code).join(", ")}</span>
              <span className="text-[12px] text-slate-700" style={{ fontWeight: 600 }}>
                ${item.price.toLocaleString()}
                <span className="text-slate-400 ml-1" style={{ fontWeight: 400 }}>/ unit</span>
              </span>
            </div>
          </div>
        </HoverCardContent>
      </HoverCard>
      <div className="min-w-0 flex-1">
        <div className="flex items-center flex-wrap" style={{ gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground-soft)", lineHeight: 1 }}>
            {item.code}
          </span>
          <InactiveItemPill code={item.code} size="md" noun="quote" />
          <ItemTypeBadge type={item.type as never} />
        </div>
        <ItemDescription text={item.name} maxLines={1} />
      </div>
    </div>
  );
}


