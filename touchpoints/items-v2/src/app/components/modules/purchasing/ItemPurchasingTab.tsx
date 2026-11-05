import { useEffect, useMemo, useState } from "react";
import { Users, ShoppingCart, Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { usePurchasing } from "../../../context/PurchasingContext";
import { QualifiedVendorsPanel } from "./QualifiedVendorsPanel";
import { PurchaseOrdersPanel } from "./PurchaseOrdersPanel";
import {
  AddQualifiedVendorModal,
  buildQualifiedVendor,
} from "./AddQualifiedVendorModal";
import type {
  AvailableVendor,
  QualifiedVendor,
  QualifiedVendorConfig,
} from "../../../context/purchasing/types";

interface ItemPurchasingTabProps {
  itemId: string;
}

type PrimaryTab = "qvs" | "pos";

/* One picked vendor + its captured qualify-config (or a bare vendor from the
   legacy direct-add path). */
type AddEntry = { vendor: AvailableVendor; config?: QualifiedVendorConfig } | AvailableVendor;

/* Maps the captured qualify-config (string fields) onto the numeric
   QualifiedVendor row fields, and stashes the full config so the row can
   round-trip back into the Edit Configuration modal. */
function qvFieldsFromConfig(config: QualifiedVendorConfig): Partial<QualifiedVendor> {
  const num = (s?: string) => {
    const n = parseFloat(s ?? "");
    return Number.isFinite(n) ? n : 0;
  };
  const lead = num(config.leadTimeDays);
  /* Location scope: a non-empty locationIds means the vendor was qualified for
     a specific subset of sites, so the qualified row is scoped to them (its
     Partner Locations cell shows just those). Empty = all locations → leave the
     vendor's full partnerLocations untouched. */
  const scopedSites = config.locationIds && config.locationIds.length ? config.locationIds : null;
  const locationScope: Partial<QualifiedVendor> = scopedSites
    ? { location: scopedSites[0], partnerLocations: scopedSites }
    : {};
  return {
    pricePerUnit: num(config.pricePerUnit),
    lastPOPricePerUnit: num(config.pricePerUnit),
    averagePricePerUnit: num(config.pricePerUnit),
    vendorUOM: config.uom || "Each",
    acceptedDeviation: num(config.acceptedDeviationPct),
    lastPOLeadTime: lead,
    averageLeadTime: lead,
    minOrderQty: config.minOrderQty ? num(config.minOrderQty) : undefined,
    maxOrderQty: config.maxOrderQty ? num(config.maxOrderQty) : undefined,
    multiples: config.multiples ? num(config.multiples) : undefined,
    ...locationScope,
    config,
  };
}

/**
 * Purchasing tab — owns the PRIMARY toggle (Qualified Vendors / Purchase Orders)
 * styled per Pricing Rules pattern (icon-pill, prominent, sits at top of tab content).
 * Right of toggle: contextual CTA (+ Add vendor / + Create PO).
 * Secondary toggle (Vendor Priority Table / Vendors Analytics) lives INSIDE
 * QualifiedVendorsPanel's toolbar row.
 */
export function ItemPurchasingTab({ itemId }: ItemPurchasingTabProps) {
  const { qvsByItem, posByItem, deleteQV, reorderQVs } = usePurchasing();
  const [primaryTab, setPrimaryTab] = useState<PrimaryTab>("qvs");
  const [wizardOpen, setWizardOpen] = useState(false);
  /* When set, the Add modal opens in Edit-Configuration mode for this vendor. */
  const [editVendor, setEditVendor] = useState<QualifiedVendor | null>(null);
  /* Edit-all: open the modal straight in the Configure master-detail so any
     existing vendor's pricing, priority, and details can be edited. */
  const [editAllOpen, setEditAllOpen] = useState(false);
  /* When a row's "Edit Configuration" opens Edit-all, the vendor to focus first. */
  const [editAllFocusId, setEditAllFocusId] = useState<string | null>(null);

  const qvs = useMemo(() => qvsByItem[itemId] ?? [], [qvsByItem, itemId]);
  const pos = useMemo(() => posByItem[itemId] ?? [], [posByItem, itemId]);

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log(
      `[Purchasing] item ${itemId} → ${qvs.length} qualified vendors, ${pos.length} purchase orders`,
      { qvs, pos },
    );
  }, [itemId, qvs, pos]);

  const handleAdd = () => {
    if (primaryTab === "qvs") {
      setWizardOpen(true);
    } else {
      toast.info("Create PO wizard coming in slice 2B.");
      // eslint-disable-next-line no-console
      console.log("[Purchasing] Create PO — coming in slice 2B", { itemId });
    }
  };

  /* Commit from the ported Browse → Configure wizard. Each entry carries the
     picked vendor + its captured QualifiedVendorConfig. We map the config onto
     the QV row fields, then INSERT each new row at the priority level chosen in
     the Configure step (config.priority) and commit the whole ordered list via
     reorderQVs — addQV only appends, so it can't honor a chosen slot. "auto"
     rows append after existing in selection order. */
  const handleVendorsAdded = (
    entries: AddEntry[],
    existingPriority?: Record<string, { priority: number; isDefault: boolean; config?: QualifiedVendorConfig }>,
    order?: string[],
  ) => {
    const norm = entries.map((e) =>
      "vendor" in e ? e : { vendor: e as AvailableVendor, config: undefined },
    );
    // Each new vendor carries its chosen tier rank on config.priority (ties
    // allowed) plus an optional default flag; "auto" appends below the current
    // lowest tier. reorderQVs densifies ranks and guarantees one default.
    let autoCursor = qvs.reduce((m, q) => Math.max(m, q.priority), 0);
    const built = norm.map(({ vendor, config }, i) => {
      const base = buildQualifiedVendor({ itemId, vendor, priority: 0, seq: i });
      const merged = config ? { ...base, ...qvFieldsFromConfig(config) } : base;
      const rank = config && config.priority && config.priority !== "auto" ? parseInt(config.priority, 10) : NaN;
      return {
        ...merged,
        priority: Number.isFinite(rank) ? rank : (autoCursor += 1),
        isPrimary: !!(config && config.isDefault),
      };
    });
    const newDefault = built.some((q) => q.isPrimary);
    const combined = [
      // Apply the roster's re-ranked priority/default to existing vendors, plus
      // any inline-edited config; otherwise just clear a stale default if a new
      // vendor took it.
      ...qvs.map((q) => {
        const ep = existingPriority?.[q.id];
        if (ep) {
          const base = ep.config ? { ...q, ...qvFieldsFromConfig(ep.config) } : q;
          return { ...base, priority: ep.priority, isPrimary: ep.isDefault };
        }
        return newDefault ? { ...q, isPrimary: false } : q;
      }),
      ...built,
    ];
    // Honor the roster's flat order so within-tie sequence persists —
    // densifyRanks breaks ties by array index, so order the list here.
    const ordered =
      order && order.length
        ? [...combined].sort((a, b) => {
            const ia = order.indexOf(a.id);
            const ib = order.indexOf(b.id);
            return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib);
          })
        : combined;
    reorderQVs(itemId, ordered);
    // Only announce added vendors; pure editAll config saves are toasted by the modal.
    if (norm.length > 0) {
      toast.success(
        `${norm.length} vendor${norm.length === 1 ? "" : "s"} added as qualified`,
      );
    }
  };

  const handleRemoveVendor = (qv: QualifiedVendor) => {
    deleteQV(itemId, qv.id);
    toast.success(`${qv.vendorName} removed`);
  };

  /* Row → "Edit Configuration": open the SAME Edit Vendors modal as the "Edit
     vendor list" button, focused on the clicked vendor so its config is front
     and center while every other vendor stays editable too. */
  const handleEditConfig = (qv: QualifiedVendor) => { setEditAllFocusId(qv.id); setEditAllOpen(true); };

  const handleEditSave = (qvId: string, config: QualifiedVendorConfig) => {
    // Apply the edited config, honoring a changed tier rank and an optional
    // default star; reorderQVs densifies + enforces the single top default.
    const rank = config.priority && config.priority !== "auto" ? parseInt(config.priority, 10) : NaN;
    const makeDefault = !!config.isDefault;
    const updated = qvs.map((q) => {
      if (q.id === qvId) {
        return {
          ...q,
          ...qvFieldsFromConfig(config),
          ...(Number.isFinite(rank) ? { priority: rank } : {}),
          isPrimary: makeDefault ? true : q.isPrimary,
        };
      }
      return makeDefault ? { ...q, isPrimary: false } : q;
    });
    reorderQVs(itemId, updated);
    setEditVendor(null);
  };

  const PRIMARY_TABS = [
    { key: "qvs" as PrimaryTab, label: "Qualified Vendors", icon: Users, color: "#1E40AF", bg: "#EFF6FF", borderColor: "#BFDBFE", hoverBg: "#DBEAFE" },
    { key: "pos" as PrimaryTab, label: "Purchase Orders", icon: ShoppingCart, color: "#5B21B6", bg: "#F5F3FF", borderColor: "#DDD6FE", hoverBg: "#EDE9FE" },
  ];

  /* Primary toggle row — Pricing Rules pattern. Rendered as Row 1 INSIDE the outer card
     of whichever panel is active (no rounded corners, separated by border-b). Px / py match
     Pricing Rules' literal `px-4 pt-2.5 pb-2`. */
  const primaryToggleRow = (
    <div className="flex items-center justify-between gap-3 px-4 pt-2.5 pb-2">
      <div className="inline-flex items-center rounded-lg bg-muted p-0.5">
        {PRIMARY_TABS.map((t) => {
          const isActive = primaryTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setPrimaryTab(t.key)}
              className={`inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-md text-[13px] transition-all cursor-pointer ${
                isActive
                  ? "bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)]"
                  : "text-slate-500 hover:text-slate-700"
              }`}
              style={{ fontWeight: isActive ? 600 : 500, color: isActive ? t.color : undefined }}
            >
              <t.icon className="w-3.5 h-3.5" style={{ color: isActive ? t.color : "#94A3B8" }} />
              {t.label}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        {primaryTab === "qvs" && (
          <button
            type="button"
            onClick={() => setEditAllOpen(true)}
            disabled={qvs.length === 0}
            title={qvs.length === 0 ? "No qualified vendors to edit yet" : "Edit pricing, priority, and details for any vendor"}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-white text-[13px] text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ fontWeight: 600 }}
          >
            <Pencil className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Edit vendor list</span>
          </button>
        )}
        <button
          type="button"
          onClick={handleAdd}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13px] bg-primary text-white hover:bg-[#0862D0] shadow-sm transition-colors cursor-pointer"
          style={{ fontWeight: 600 }}
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{primaryTab === "qvs" ? "Add vendor" : "Create PO"}</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {primaryTab === "qvs" ? (
        <QualifiedVendorsPanel itemId={itemId} qvs={qvs} headerSlot={primaryToggleRow} onEditConfig={handleEditConfig} onAddVendor={() => setWizardOpen(true)} />
      ) : (
        <PurchaseOrdersPanel
          itemId={itemId}
          pos={pos}
          headerSlot={primaryToggleRow}
          onCreatePO={handleAdd}
        />
      )}

      <AddQualifiedVendorModal
        open={wizardOpen || editVendor !== null || editAllOpen}
        onOpenChange={(o) => { if (!o) { setWizardOpen(false); setEditVendor(null); setEditAllOpen(false); setEditAllFocusId(null); } }}
        existingVendors={qvs}
        onAdd={handleVendorsAdded}
        onRemove={handleRemoveVendor}
        editMode={editVendor !== null}
        editVendor={editVendor}
        editAll={editAllOpen}
        editAllFocusVendorId={editAllFocusId}
        onEditSave={handleEditSave}
      />
    </>
  );
}