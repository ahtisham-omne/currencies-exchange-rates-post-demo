/**
 * DevCategoryReconcileHarness — a DEV-ONLY floating panel to exercise the
 * "Change Primary Category" reconciliation step without hunting for the right
 * item + category by hand.
 *
 * For each scenario it shows the LIVE row breakdown computed by the real
 * `computeCategoryConfigRows` against the real seed items (push / held / no-
 * change per configuration under the tier/upstream rules), a button that opens
 * the ACTUAL 2-step ChangeCategoryReconcileModal, and a deep-link to run the
 * true end-to-end edit flow on that item.
 *
 * Mounted unconditionally in App.tsx (deployed build included) so the flow can
 * be exercised from the live link, not just `vite dev`. Delete this file + its
 * mount in App.tsx to remove it everywhere.
 */
import React, { useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { FlaskConical, X, ExternalLink, ChevronDown, ChevronUp, Star } from "lucide-react";
import { INITIAL_ITEMS } from "@/app/context/ItemsContext";
import { toCategoryCode } from "@/app/lib/categoryCode";
import {
  computeCategoryConfigRows,
  itemHasTransactions,
  type ReconcileFieldKey,
  type ConfigRow,
} from "./categoryReconcile";
import {
  ChangeCategoryReconcileModal,
  type ReviewRow,
  type ReviewSection,
} from "./ChangeCategoryReconcileModal";

interface Scenario {
  n: number;
  label: string;
  itemId: string;
  itemName: string;
  catId: string;
  catCode: string;
  expect: string;
}

/* Item → category pairs that exercise the rules. Item "2" (VALV-BAL-316) has
   NO transactions; item "1" (FAST-HEX-001) HAS transactions. */
const SCENARIOS: Scenario[] = [
  { n: 1, label: "No transactions", itemId: "2", itemName: "VALV-BAL-316", catId: "cat-2", catCode: "C-1002", expect: "No transactions — every differing configuration pushes." },
  { n: 2, label: "Has txns · tightening", itemId: "1", itemName: "FAST-HEX-001", catId: "cat-1", catCode: "C-1001", expect: "Tier 2 pushes (Non-serialized→Serialized, Lot Off→On), Tier 3 pushes, Tier 1 (UOM) held." },
  { n: 3, label: "Has txns · mixed", itemId: "1", itemName: "FAST-HEX-001", catId: "cat-5", catCode: "C-1005", expect: "Tier 3 (Valuation) pushes; Tier 1 (UOM) held; Tier 2 per direction." },
  { n: 4, label: "Has txns · loosening held", itemId: "1", itemName: "FAST-HEX-001", catId: "cat-3", catCode: "C-1003", expect: "Any loosening Tier 2 (e.g. Lot On→Off) held; only upstream + Tier 3 push." },
];

/* Worst case for the review table — the FULL configuration taxonomy, every
   section and every inner field changed at once. No transactions, so all push.
   Mirrors the app's six config groups (Item Definition, Stock & Logistics,
   Procurement, Selling, Governance, Material Handling) with their inner fields,
   so the demo matches the real sections. Synthetic on purpose: guarantees the
   grouped all-changed layout regardless of seed data. */
const chg = (key: string, label: string, from: string, to: string): ReviewRow => ({
  key, label, currentDisplay: from, newDisplay: to, status: "pushed",
});

/* Emerald "new value" chip for the worst-case demo's acquisition-method cell.
   Multi-value cells (locations, units, partners, people) use ReviewRow.newItems /
   newPeople instead, rendered by the modal's own overflow components. */
function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[11px] leading-none text-emerald-700"
      style={{ fontWeight: 600 }}
    >
      {children}
    </span>
  );
}
const EXTREME_SECTIONS: ReviewSection[] = [
  {
    id: "definition", label: "Item Definition", color: "#1E40AF",
    rows: [
      chg("inventoryType", "Inventory Type", "Stock", "Asset"),
      chg("controlType", "Control Type", "Non-serialized", "Serialized"),
      chg("lotControlEnabled", "Lot Tracking", "Off", "On"),
      chg("lotIdSource", "Lot ID Assignment", "System", "Vendor"),
      chg("shelfLifeEnabled", "Shelf Life", "Off", "180 days"),
      chg("uom", "Base Unit of Measure", "ea", "box"),
      {
        ...chg("alternativeUnits", "Alternative Units", "None", "4 units (case, pallet, box, drum)"),
        newItems: ["case", "pallet", "box", "drum"],
      },
      {
        ...chg("acquisitionMethod", "Acquisition Method", "Purchased", "Purchased, Manufactured (Purchased preferred)"),
        newNode: (
          <div className="flex flex-wrap gap-1">
            <Chip>
              <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-500" />
              Purchased
            </Chip>
            <Chip>Manufactured</Chip>
          </div>
        ),
      },
    ],
  },
  {
    id: "inventory", label: "Stock & Logistics", color: "#5B21B6",
    rows: [
      chg("minStock", "Min Level", "50", "100"),
      chg("maxStock", "Max Level", "500", "1,000"),
      {
        ...chg("inboundLocation", "Inbound Locations", "1 location", "3 locations"),
        newItems: ["Main WH", "East DC", "Dock 3"],
      },
      {
        ...chg("outboundLocation", "Outbound Locations", "1 location", "2 locations"),
        newItems: ["Ship Dock", "West Hub"],
      },
    ],
  },
  {
    id: "procurement", label: "Procurement", color: "#9A3412",
    rows: [
      chg("minPurchase", "Min Order Qty", "10", "25"),
      chg("maxPurchase", "Max Order Qty", "1,000", "2,500"),
      chg("multiples", "Order Multiples", "1", "5"),
    ],
  },
  {
    id: "fulfillment", label: "Selling", color: "#065F46",
    rows: [
      chg("sellingScope", "Selling Scope", "All partners", "Specific partners"),
      {
        ...chg("specificPartners", "Specific Partners", "None", "4 partners"),
        newItems: ["Acme Corp", "Globex", "Initech", "Umbrella"],
      },
    ],
  },
  {
    id: "governance", label: "Governance", color: "#9F1239",
    rows: [
      chg("valuationMethod", "Inventory Valuation", "Weighted Avg", "FIFO"),
      {
        ...chg("owners", "Ownership", "Unassigned", "3 owners"),
        newPeople: ["James Mitchell", "Linda Martinez", "Sarah Garcia"],
      },
    ],
  },
  {
    id: "materialHandling", label: "Material Handling", color: "#0E7490",
    rows: [
      chg("cycleTolerance", "Acceptable Variance %", "2%", "5%"),
      {
        ...chg("approvers", "Approvers", "1 approver", "3 approvers"),
        newPeople: ["Robert Chen", "Emily Anderson", "Michael Nguyen"],
      },
    ],
  },
];

const EXTREME_TOTAL = EXTREME_SECTIONS.reduce((n, s) => n + s.rows.length, 0);

const STATUS_TAG: Record<ConfigRow["status"], { txt: string; cls: string }> = {
  pushed: { txt: "push", cls: "bg-emerald-500/15 text-emerald-300" },
  held: { txt: "held", cls: "bg-amber-500/15 text-amber-300" },
  unchanged: { txt: "same", cls: "bg-slate-500/20 text-slate-300" },
};

export function DevCategoryReconcileHarness() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [rows, setRows] = useState<ConfigRow[]>([]);
  const [oldCat, setOldCat] = useState("");
  const [newCat, setNewCat] = useState("");
  const [hasTx, setHasTx] = useState(false);
  const [sections, setSections] = useState<ReviewSection[] | undefined>(undefined);

  const previewWith = (r: ConfigRow[], oldCode: string, newCode: string, tx: boolean) => {
    setSections(undefined); // scenario rows are flat (no grouped taxonomy)
    setRows(r);
    setOldCat(oldCode);
    setNewCat(newCode);
    setHasTx(tx);
    setModalOpen(true);
  };

  const preview = (s: Scenario) => {
    const item = INITIAL_ITEMS.find((i) => i.id === s.itemId);
    if (!item) return;
    previewWith(
      computeCategoryConfigRows(item, s.catId),
      toCategoryCode(item.primaryCategory || "") || "Uncategorized",
      s.catCode,
      itemHasTransactions(item),
    );
  };

  /* Worst case: a no-transaction move where every configuration in every
     section changes at once (full taxonomy, grouped review). */
  const previewExtreme = () => {
    setSections(EXTREME_SECTIONS);
    setRows([]); // sections drive the grouped review + tallies
    setOldCat("C-1002");
    setNewCat("C-1001");
    setHasTx(false);
    setModalOpen(true);
  };

  const confirm = (applied: { key: ReconcileFieldKey; newValue: string | boolean }[]) => {
    toast.success(
      applied.length > 0
        ? `${applied.length} configuration${applied.length === 1 ? "" : "s"} would apply on save.`
        : `Category would change to ${newCat} (configurations unchanged).`,
    );
    setModalOpen(false);
  };

  return createPortal(
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-4 left-4 z-[200] inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-slate-900 text-white text-[12px] shadow-lg hover:bg-slate-800"
          style={{ fontWeight: 600 }}
        >
          <FlaskConical className="w-3.5 h-3.5 text-emerald-400" />
          Category Reconcile DEV
        </button>
      )}

      {open && (
        <div className="fixed bottom-4 left-4 z-[200] w-[368px] bg-slate-900 text-slate-100 rounded-xl shadow-2xl border border-slate-700 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-700/80 bg-slate-950/40">
            <FlaskConical className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-[12px] flex-1" style={{ fontWeight: 700 }}>
              Change-Category Reconcile · DEV
            </span>
            <button onClick={() => setCollapsed((c) => !c)} className="text-slate-400 hover:text-white">
              {collapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {!collapsed && (
            <div className="p-2.5 flex flex-col gap-2 max-h-[60vh] overflow-y-auto">
              {SCENARIOS.map((s) => {
                const item = INITIAL_ITEMS.find((i) => i.id === s.itemId);
                const r = item ? computeCategoryConfigRows(item, s.catId) : [];
                const tx = item ? itemHasTransactions(item) : false;
                const push = r.filter((x) => x.status === "pushed").length;
                const held = r.filter((x) => x.status === "held").length;
                return (
                  <div key={s.n} className="rounded-lg border border-slate-700/70 bg-slate-800/40 p-2.5">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-300 text-[11px]" style={{ fontWeight: 700 }}>
                        {s.n}
                      </span>
                      <span className="text-[12px]" style={{ fontWeight: 600 }}>{s.label}</span>
                      <span className="ml-auto text-[10.5px] text-slate-400 tabular-nums">
                        {push} push · {held} held
                      </span>
                    </div>
                    <div className="text-[10.5px] text-slate-400 mt-1">
                      <span className="text-slate-300">{s.itemName}</span> → <span className="text-slate-300">{s.catCode}</span>
                      <span className={`ml-2 ${tx ? "text-amber-300" : "text-emerald-300"}`}>{tx ? "has txns" : "no txns"}</span>
                    </div>
                    <div className="mt-1.5 flex flex-col gap-0.5">
                      {r.map((x) => (
                        <div key={x.key} className="flex items-center gap-1.5 text-[10.5px]">
                          <span className="text-slate-300 w-[92px] shrink-0">{x.label}</span>
                          <span className="text-slate-500 truncate flex-1">{x.currentDisplay} → {x.newDisplay}</span>
                          <span className={`shrink-0 px-1.5 rounded ${STATUS_TAG[x.status].cls}`} style={{ fontWeight: 600 }}>
                            T{x.tier} {STATUS_TAG[x.status].txt}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="text-[10.5px] text-slate-400 mt-1.5 leading-relaxed">{s.expect}</div>
                    <div className="flex items-center gap-1.5 mt-2">
                      <button
                        onClick={() => preview(s)}
                        className="flex-1 text-[11px] px-2 py-1 rounded-md bg-emerald-500 text-slate-900 hover:bg-emerald-400"
                        style={{ fontWeight: 600 }}
                      >
                        Preview modal
                      </button>
                      <button
                        onClick={() => { setOpen(false); navigate(`/items/${s.itemId}`); }}
                        className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-slate-600 text-slate-200 hover:bg-slate-700"
                      >
                        Open item <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Worst case — synthetic, every configuration changes at once. */}
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[9.5px] uppercase tracking-wider text-slate-500" style={{ fontWeight: 700 }}>
                  Worst case
                </span>
                <div className="flex-1 h-px bg-slate-700/60" />
              </div>

              <div className="rounded-lg border border-rose-500/40 bg-rose-500/[0.06] p-2.5">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-rose-500/20 text-rose-300 text-[12px]" style={{ fontWeight: 700 }}>
                    !
                  </span>
                  <span className="text-[12px]" style={{ fontWeight: 600 }}>Every configuration changes</span>
                  <span className="ml-auto text-[10.5px] text-slate-400 tabular-nums">{EXTREME_TOTAL} push · 0 held</span>
                </div>
                <div className="text-[10.5px] text-slate-400 mt-1">
                  <span className="text-slate-300">C-1002</span> → <span className="text-slate-300">C-1001</span>
                  <span className="ml-2 text-emerald-300">no txns</span>
                </div>
                <div className="mt-1.5 flex flex-col gap-0.5">
                  {EXTREME_SECTIONS.map((sec) => (
                    <div key={sec.id} className="flex items-center gap-1.5 text-[10.5px]">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: sec.color }} />
                      <span className="text-slate-300 flex-1 truncate">{sec.label}</span>
                      <span className="text-slate-500 tabular-nums">{sec.rows.length} fields</span>
                    </div>
                  ))}
                </div>
                <div className="text-[10.5px] text-slate-400 mt-1.5 leading-relaxed">
                  The full taxonomy across all six sections, every field changed (no transactions). Exercises the grouped all-changed review layout.
                </div>
                <button
                  onClick={previewExtreme}
                  className="w-full mt-2 text-[11px] px-2 py-1 rounded-md bg-rose-500 text-white hover:bg-rose-400"
                  style={{ fontWeight: 600 }}
                >
                  Preview worst case
                </button>
              </div>

              <div className="text-[10px] text-slate-500 leading-relaxed mt-0.5 px-0.5">
                <span className="text-slate-400" style={{ fontWeight: 600 }}>End-to-end:</span> Open item → Edit →
                Category step → set a different primary → Continue. The modal fires before the next screen.
                "Preview modal" renders the real 2-step modal directly from the live classifier.
              </div>
            </div>
          )}
        </div>
      )}

      <ChangeCategoryReconcileModal
        open={modalOpen}
        oldCategoryCode={oldCat}
        newCategoryCode={newCat}
        hasTransactions={hasTx}
        rows={rows}
        sections={sections}
        onConfirm={confirm}
        onCancel={() => setModalOpen(false)}
      />
    </>,
    document.body,
  );
}
