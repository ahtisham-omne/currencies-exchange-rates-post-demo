import { useState, useCallback, useMemo, useRef } from "react";
import { X, Search, Plus, LayoutList, Grid2x2, Package, Check, ChevronDown, Trash2, Copy, Settings, Layers } from "lucide-react";
import { useSOStore, CATALOG } from "./store";
import { ItemTypeBadge, DuplicateBadge } from "./StatusBadge";
import { ItemDescription } from "./ItemDescription";
import { useModalShortcuts, KbdHint } from "./ModalKeyboard";
import { Button } from "./ui/Button";
import { toast } from "sonner";
import { useDiscardGuard } from "./ui/DiscardChangesDialog";
import { ATPTooltip } from "./ATPTooltip";
import { AdvancedConfiguratorModal } from "./AdvancedConfiguratorModal";
import type { CatalogItem } from "./types";

/* ═══ Typography — CSS variable tokens only ═══ */
const font: React.CSSProperties = {};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);

interface Props { soId: string; onClose: () => void; }

interface PendingItem {
  instanceId: string;
  item: CatalogItem;
  qty: number;
}

let _pendingCounter = 0;
function nextPendingId() { return `pend-${++_pendingCounter}-${Date.now()}`; }

export function AddLineItemDialog({ soId, onClose }: Props) {
  const store = useSOStore();
  
  const so = store.salesOrders.find(s => s.id === soId);
  const [search, setSearch] = useState("");

  /* Pre-populate pending items from existing SO lines */
  const buildInitialPending = (): PendingItem[] => {
    if (!so) return [];
    return so.lines.filter(l => !l.cancelled).map(l => {
      const catalogItem = CATALOG.find(c => c.code === l.itemCode);
      if (!catalogItem) return null;
      return {
        instanceId: nextPendingId(),
        item: catalogItem,
        qty: l.orderedQty,
      };
    }).filter(Boolean) as PendingItem[];
  };

  const [pending, setPending] = useState<PendingItem[]>(buildInitialPending);
  const [sidebarWidth, setSidebarWidth] = useState<"narrow" | "wide">("narrow");
  const [expandedProductDescs, setExpandedProductDescs] = useState<Set<string>>(new Set());
  const [expandedCardDescs, setExpandedCardDescs] = useState<Set<string>>(new Set());
  const [newlyAddedIds, setNewlyAddedIds] = useState<Set<string>>(new Set());
  const [qtyBumpIds, setQtyBumpIds] = useState<Set<string>>(new Set());
  const [configPendingId, setConfigPendingId] = useState<string | null>(null);
  const newlyAddedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qtyBumpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());

  /* ── Existing item codes on the SO for duplicate detection ── */
  const existingCodeLineMap = new Map<string, number>();
  so?.lines.forEach((l, idx) => {
    if (!existingCodeLineMap.has(l.itemCode)) existingCodeLineMap.set(l.itemCode, idx + 1);
  });

  const filtered = CATALOG.filter(item =>
    item.code.toLowerCase().includes(search.toLowerCase()) ||
    item.name.toLowerCase().includes(search.toLowerCase()) ||
    item.category.toLowerCase().includes(search.toLowerCase())
  );

  /* Counts per code */
  const pendingByCode = useMemo(() => {
    const map: Record<string, PendingItem[]> = {};
    pending.forEach(p => {
      if (!map[p.item.code]) map[p.item.code] = [];
      map[p.item.code].push(p);
    });
    return map;
  }, [pending]);

  const getTotalQtyForCode = (code: string) =>
    (pendingByCode[code] || []).reduce((s, p) => s + p.qty, 0);

  const getLineCountForCode = (code: string) =>
    (pendingByCode[code] || []).length;

  const isCodeAdded = (code: string) => getLineCountForCode(code) > 0;

  /* Flash highlight + scroll helper */
  const flashHighlight = useCallback((id: string) => {
    setNewlyAddedIds(prev => new Set([...prev, id]));
    if (newlyAddedTimer.current) clearTimeout(newlyAddedTimer.current);
    newlyAddedTimer.current = setTimeout(() => setNewlyAddedIds(new Set()), 2500);
    setTimeout(() => {
      const el = cardRefsMap.current.get(id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  }, []);

  const flashQtyBump = useCallback((id: string) => {
    setQtyBumpIds(prev => new Set([...prev, id]));
    if (qtyBumpTimer.current) clearTimeout(qtyBumpTimer.current);
    qtyBumpTimer.current = setTimeout(() => setQtyBumpIds(new Set()), 1800);
    setTimeout(() => {
      const el = cardRefsMap.current.get(id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  }, []);

  /* Add a new item as fresh line */
  const addNewPending = useCallback((item: CatalogItem) => {
    const newId = nextPendingId();
    const existingItems = pending.filter(p => p.item.code === item.code);
    if (existingItems.length > 0) {
      // Insert after last instance of this code
      const lastIdx = pending.map(p => p.item.code).lastIndexOf(item.code);
      setPending(prev => {
        const updated = [...prev];
        updated.splice(lastIdx + 1, 0, { instanceId: newId, item, qty: 1 });
        return updated;
      });
    } else {
      setPending(prev => [...prev, { instanceId: newId, item, qty: 1 }]);
    }
    flashHighlight(newId);
  }, [pending, flashHighlight]);

  /* Add qty to the first existing pending instance */
  const addQtyToPending = useCallback((code: string) => {
    const first = pending.find(p => p.item.code === code);
    if (first) {
      setPending(prev => prev.map(p =>
        p.instanceId === first.instanceId ? { ...p, qty: p.qty + 1 } : p
      ));
      flashQtyBump(first.instanceId);
    }
  }, [pending, flashQtyBump]);

  /* Click handler for catalog row — first add or +1 qty */
  const handleCatalogClick = useCallback((item: CatalogItem) => {
    const exists = pending.some(p => p.item.code === item.code);
    if (!exists) {
      addNewPending(item);
    } else {
      addQtyToPending(item.code);
    }
  }, [pending, addNewPending, addQtyToPending]);

  const removePending = (instanceId: string) => setPending(prev => prev.filter(p => p.instanceId !== instanceId));
  const updatePendingQty = (instanceId: string, qty: number) => setPending(prev => prev.map(p => p.instanceId === instanceId ? { ...p, qty: Math.max(1, qty) } : p));

  /* Duplicate a right-panel pending item */
  const duplicatePending = useCallback((instanceId: string) => {
    const source = pending.find(p => p.instanceId === instanceId);
    if (!source) return;
    const newId = nextPendingId();
    const sourceIndex = pending.findIndex(p => p.instanceId === instanceId);
    setPending(prev => {
      const updated = [...prev];
      updated.splice(sourceIndex + 1, 0, { instanceId: newId, item: source.item, qty: source.qty });
      return updated;
    });
    flashHighlight(newId);
    toast.info(`Duplicated ${source.item.code} (Qty ${source.qty})`);
  }, [pending, flashHighlight]);

  /* Track initial pending IDs to distinguish pre-existing from new */
  const [initialPendingIds] = useState<Set<string>>(() => new Set(buildInitialPending().map(p => p.instanceId)));

  const handleAdd = () => {
    // Delete all existing lines first (we're replacing the full set)
    if (so) {
      so.lines.forEach(l => store.deleteSOLine(soId, l.id));
    }
    // Add all pending items as new lines
    pending.forEach(p => store.addSOLine(soId, {
      itemCode: p.item.code,
      itemName: p.item.name,
      itemType: p.item.type,
      orderedQty: p.qty,
      unitPrice: p.item.unitPrice,
      taxRate: 0.08,
    }));
    toast.success(`Updated order with ${pending.length} item(s)`);
    onClose();
  };

  const isDirty = pending.length > 0;
  const { guardedClose, discardDialog } = useDiscardGuard(isDirty, onClose);
  useModalShortcuts({ onConfirm: handleAdd, onClose: guardedClose, confirmDisabled: pending.length === 0 });
  const subtotal = pending.reduce((s, p) => s + p.qty * p.item.unitPrice, 0);

  // Sequential numbering with duplicate tracking
  const getItemMeta = () => {
    const numbers: Record<string, string> = {};
    const originalItemNumbers: Record<string, number | null> = {};
    const firstOccurrence: Record<string, number> = {};
    pending.forEach((p, index) => {
      const lineNum = index + 1;
      numbers[p.instanceId] = `${lineNum}`;
      if (!(p.item.code in firstOccurrence)) {
        firstOccurrence[p.item.code] = lineNum;
        originalItemNumbers[p.instanceId] = null;
      } else {
        originalItemNumbers[p.instanceId] = firstOccurrence[p.item.code];
      }
    });
    return { numbers, originalItemNumbers };
  };

  const { numbers: itemNumbers, originalItemNumbers } = getItemMeta();

  const sidebarStyle = sidebarWidth === "narrow"
    ? { width: "30%", flexGrow: 0, flexShrink: 0 }
    : { width: "65%", flexGrow: 0, flexShrink: 0 };

  const leftSideClass = sidebarWidth === "wide" ? "" : "flex-1";

  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: "var(--z-modal)" }}>
      <div className="absolute inset-0" style={{ backgroundColor: "rgba(0, 0, 0, 0.4)", backdropFilter: "blur(2px)" }} onClick={guardedClose} />
      {discardDialog}

      <div
        className="relative bg-card border border-border flex flex-col overflow-hidden"
        style={{ width: 1120, maxHeight: "88vh", borderRadius: "var(--radius-xl)", boxShadow: "var(--elevation-3)" }}
      >
        {/* ═══ Header ═══ */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
              <Plus className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 style={{ fontSize: "var(--text-base)", fontWeight: "var(--font-weight-semibold)", color: "var(--foreground)" }}>Add Line Items</h3>
              <div style={{ fontSize: "var(--text-caption)", color: "var(--foreground)", opacity: 0.5 }}>Select products and configure quantities before adding to order</div>
            </div>
          </div>
          <button onClick={guardedClose} className="w-8 h-8 rounded-md border border-border hover:bg-secondary flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-foreground/50" />
          </button>
        </div>

        {/* ═══ Body ═══ */}
        <div className="flex flex-1 overflow-hidden">
          {/* CSS for animations — mirrors CreateSOStep2 */}
          <style>{`
            @keyframes soAddNewCard {
              0% { box-shadow: 0 0 0 2px var(--primary), 0 0 16px 6px var(--primary-glow-medium); background-color: var(--primary-active-bg); border-color: var(--primary); }
              40% { box-shadow: 0 0 0 1.5px var(--primary-ring-soft), 0 0 12px 4px var(--primary-glow-subtle); background-color: var(--primary-tint-card); border-color: var(--primary-border-soft); }
              100% { box-shadow: var(--elevation-1); background-color: var(--card); border-color: var(--border); }
            }
            .so-add-new-card { animation: soAddNewCard 1.5s ease-out forwards !important; }
            @keyframes soAddQtyBump {
              0% { box-shadow: 0 0 0 2px var(--primary), 0 0 12px 4px var(--primary-glow-subtle); }
              50% { box-shadow: 0 0 0 3px var(--primary-ring-soft), 0 0 8px 2px var(--primary-tint-card); }
              100% { box-shadow: var(--elevation-1); }
            }
            .so-add-qty-bump { animation: soAddQtyBump 1s ease-out forwards; }
            @keyframes soAddQtyFlash {
              0% { background-color: var(--primary-glow-subtle); color: var(--primary); }
              60% { background-color: var(--primary-tint-card); }
              100% { background-color: var(--card); color: var(--foreground); }
            }
            .so-add-qty-flash { animation: soAddQtyFlash 1.5s ease-out forwards; }
            .so-add-catalog-card { transition: background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease; box-shadow: var(--elevation-1); }
            .so-add-catalog-card:hover { background-color: var(--primary-tint-card) !important; border-color: var(--primary) !important; box-shadow: var(--elevation-2); transform: translateY(-1px); }
            .so-add-catalog-card-added { background-color: var(--accent-tint-card) !important; }
            .so-add-catalog-card-added:hover { background-color: var(--accent-tint-hover) !important; border-color: var(--accent) !important; }
            .so-add-catalog-card:hover .so-add-hint-btn { opacity: 1 !important; }
            .so-add-sel-card { box-shadow: var(--elevation-1); }
            .so-add-sel-card:hover .so-add-card-action { opacity: 0.6 !important; }
            .so-add-sel-card .so-add-card-action { transition: opacity 150ms ease, background-color 150ms ease, transform 150ms ease; border-radius: 4px; }
            .so-add-sel-card .so-add-card-action:hover { opacity: 1 !important; background-color: var(--secondary); transform: scale(1.1); }
            .so-add-panel-left, .so-add-panel-right { transition: width 350ms cubic-bezier(0.4, 0, 0.2, 1), flex 350ms cubic-bezier(0.4, 0, 0.2, 1), padding 350ms cubic-bezier(0.4, 0, 0.2, 1); }
          `}</style>

          {/* ═══ LEFT — Product Catalog ═══ */}
          <div
            className={`so-add-panel-left flex flex-col overflow-hidden py-5 ${leftSideClass} ${sidebarWidth === "wide" ? "px-5" : "px-6"}`}
            style={{
              borderRight: "1px solid var(--border)",
              background: "var(--card)",
              ...(sidebarWidth === "wide" ? { width: "35%", flexGrow: 0, flexShrink: 0 } : {}),
            }}
          >
            {/* Title + layout toggle */}
            <div style={{ marginBottom: 16 }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
                <h4 style={{ fontSize: "var(--text-h4)", fontWeight: "var(--font-weight-semibold)", color: "var(--foreground)" }}>
                  Add Line Items
                </h4>
                <div className="flex items-center overflow-hidden" style={{ border: "1px solid var(--border)", borderRadius: 6, height: 28, background: "var(--card)" }}>
                  <button
                    onClick={() => setSidebarWidth("narrow")}
                    className={`w-8 h-7 flex items-center justify-center transition-colors ${sidebarWidth === "narrow" ? "bg-primary/12" : "hover:bg-secondary"}`}
                    style={{ borderRight: "1px solid var(--border)", color: sidebarWidth === "narrow" ? "var(--primary)" : "var(--foreground)", opacity: sidebarWidth === "narrow" ? 1 : 0.4 }}
                  >
                    <LayoutList className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setSidebarWidth("wide")}
                    className={`w-8 h-7 flex items-center justify-center transition-colors ${sidebarWidth === "wide" ? "bg-primary/12" : "hover:bg-secondary"}`}
                    style={{ color: sidebarWidth === "wide" ? "var(--primary)" : "var(--foreground)", opacity: sidebarWidth === "wide" ? 1 : 0.4 }}
                  >
                    <Grid2x2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <p style={{ fontSize: "var(--text-caption)", color: "var(--foreground)", opacity: 0.5 }}>
                Add products from the catalog and configure quantities for each line item.
              </p>
            </div>

            {/* Search */}
            <div style={{ marginBottom: 16 }}>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--foreground)", opacity: 0.3 }} />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search products..."
                  className="w-full h-9 pl-10 pr-3 transition-colors"
                  style={{ fontSize: "var(--text-caption)", border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--input-background)", color: "var(--foreground)", outline: "none" }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.boxShadow = "var(--focus-ring-shadow)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none"; }}
                  autoFocus
                />
              </div>
            </div>

            <div style={{ fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-medium)", color: "var(--foreground)", opacity: 0.4, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12 }}>
              {search.trim() ? (
                <>Search Results <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 18, height: 16, padding: "0 5px", background: "var(--secondary)", color: "var(--foreground)", borderRadius: 4, fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-semibold)", lineHeight: 1, verticalAlign: "middle", marginLeft: 4, opacity: 0.6 }}>{filtered.length}</span></>
              ) : "CATALOG"}
            </div>

            {filtered.length === 0 && search.trim() && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Package className="w-12 h-12 mb-3" style={{ color: "var(--foreground)", opacity: 0.15 }} />
                <p style={{ fontSize: "var(--text-caption)", color: "var(--foreground)", opacity: 0.5, marginBottom: 4 }}>No products found</p>
                <p style={{ fontSize: "var(--text-micro)", color: "var(--foreground)", opacity: 0.35 }}>Try a different search term</p>
              </div>
            )}

            <div className={`flex-1 overflow-y-auto ${sidebarWidth === "wide" ? "-mx-5" : "-mx-6"}`}>
              <div className={`space-y-3 pb-3 ${sidebarWidth === "wide" ? "px-5 space-y-2" : "px-6"}`}>
                {filtered.map(item => {
                  const added = isCodeAdded(item.code);
                  const addedQty = getTotalQtyForCode(item.code);
                  const addedLines = getLineCountForCode(item.code);
                  const existingLineNum = existingCodeLineMap.get(item.code);

                  return (
                    <div
                      key={item.code}
                      onClick={() => handleCatalogClick(item)}
                      className={`w-full relative cursor-pointer so-add-catalog-card ${added ? "so-add-catalog-card-added" : ""}`}
                      style={{
                        border: added ? "1px solid var(--accent)" : "1px solid var(--border)",
                        borderRadius: "var(--radius)",
                        background: "var(--card)",
                      }}
                    >
                      <div className={`flex items-start p-3 ${sidebarWidth === "wide" ? "gap-2" : "gap-3"}`}>
                        {/* Circular thumbnail */}
                        <div className="relative shrink-0">
                          <div className={`rounded-full flex items-center justify-center ${sidebarWidth === "wide" ? "w-8 h-8" : "w-10 h-10"}`} style={{ background: "var(--secondary)", border: "1px solid var(--border)" }}>
                            <Package className={sidebarWidth === "wide" ? "w-3 h-3" : "w-4 h-4"} style={{ color: "var(--foreground)", opacity: 0.25 }} />
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Row 1: SKU + type pill + duplicate-of-existing badge + price */}
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                              <span style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-semibold)", color: "var(--foreground)", lineHeight: 1 }}>
                                {item.code}
                              </span>
                              {sidebarWidth === "narrow" && <ItemTypeBadge type={item.type} />}
                              {existingLineNum !== undefined && <DuplicateBadge ofIndex={existingLineNum} />}
                            </div>
                            <div className="text-right shrink-0">
                              <span style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-semibold)", color: "var(--foreground)" }}>
                                {formatCurrency(item.unitPrice)}
                              </span>
                              <span style={{ fontSize: "var(--text-micro)", color: "var(--foreground)", opacity: 0.4, marginLeft: 4 }}>/ EA</span>
                            </div>
                          </div>

                          {/* Row 2: Description */}
                          <div style={{ fontSize: "var(--text-micro)", color: "var(--foreground)", opacity: 0.5, marginBottom: sidebarWidth === "wide" ? 4 : 8, lineHeight: 1.5 }}>
                            {(() => {
                              const truncLen = sidebarWidth === "wide" ? 50 : 80;
                              if (expandedProductDescs.has(item.code)) {
                                return (
                                  <>
                                    {item.name}{" "}
                                    <span
                                      onClick={(e) => { e.stopPropagation(); const n = new Set(expandedProductDescs); n.delete(item.code); setExpandedProductDescs(n); }}
                                      style={{ color: "var(--primary)", cursor: "pointer", fontWeight: "var(--font-weight-medium)", whiteSpace: "nowrap" }}
                                    >see less</span>
                                  </>
                                );
                              }
                              if (item.name.length > truncLen) {
                                return (
                                  <>
                                    {item.name.slice(0, truncLen)}...{" "}
                                    <span
                                      onClick={(e) => { e.stopPropagation(); const n = new Set(expandedProductDescs); n.add(item.code); setExpandedProductDescs(n); }}
                                      className="inline-flex items-center gap-0.5"
                                      style={{ color: "var(--primary)", cursor: "pointer", fontWeight: "var(--font-weight-medium)", whiteSpace: "nowrap" }}
                                    >
                                      more <ChevronDown className="w-3 h-3 inline" />
                                    </span>
                                  </>
                                );
                              }
                              return item.name;
                            })()}
                          </div>

                          {/* Row 3: Stock + actions */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {sidebarWidth === "narrow" && (
                                <span className="inline-flex items-center px-1.5 py-0.5" style={{ fontSize: "var(--text-micro)", background: "var(--secondary)", color: "var(--foreground)", opacity: 0.6, borderRadius: 3, fontWeight: "var(--font-weight-medium)" }}>
                                  {item.category}
                                </span>
                              )}
                              <ATPTooltip product={{ code: item.code, inStock: item.inStock }}>
                                <span
                                  className="cursor-help inline-flex items-center"
                                  style={{
                                    fontSize: "var(--text-micro)",
                                    borderRadius: 9999,
                                    fontWeight: "var(--font-weight-semibold)",
                                    padding: "2px 8px",
                                    backgroundColor: item.inStock <= 5 ? "rgba(234, 88, 12, 0.10)" : "rgba(22, 163, 74, 0.10)",
                                    color: item.inStock <= 5 ? "#EA580C" : "#16A34A",
                                  }}
                                >
                                  {item.inStock} ATP
                                </span>
                              </ATPTooltip>
                            </div>

                            {added ? (
                              <div className="flex items-center gap-1.5">
                                <span className="px-1.5 py-0.5 flex items-center gap-1 bg-accent/12 text-accent" style={{ borderRadius: 3, fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-medium)" }}>
                                  <Check className="w-2.5 h-2.5" />
                                  {addedQty} EA {addedLines === 1 ? "1 line" : `${addedLines} lines`}
                                </span>
                                <span
                                  onClick={(e) => { e.stopPropagation(); addQtyToPending(item.code); }}
                                  className="px-2 py-0.5 flex items-center gap-0.5 cursor-pointer transition-colors"
                                  style={{ borderRadius: 4, fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-semibold)", background: "var(--primary)", color: "var(--primary-foreground)" }}
                                >
                                  <Plus className="w-2.5 h-2.5" />1 EA
                                </span>
                              </div>
                            ) : (
                              <span
                                className="so-add-hint-btn px-2 py-0.5 flex items-center gap-0.5 bg-primary/10 text-primary"
                                style={{ borderRadius: 4, fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-semibold)", opacity: 0, transition: "opacity 150ms ease" }}
                              >
                                <Plus className="w-2.5 h-2.5" />Add
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ═══ RIGHT — Selected Items Panel ═══ */}
          <div className="so-add-panel-right flex flex-col overflow-hidden" style={{ ...sidebarStyle, background: "#FAFBFC" }}>
            <div className={`py-4 shrink-0 ${sidebarWidth === "narrow" ? "px-4" : "px-6"}`} style={{ background: "#FAFBFC" }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: "var(--text-micro)", textTransform: "uppercase", color: "var(--foreground)", opacity: 0.4, fontWeight: "var(--font-weight-medium)", letterSpacing: "0.5px" }}>Order Items</span>
                  {pending.length > 0 && (
                    <div className="inline-flex items-center overflow-hidden" style={{ borderRadius: 4, border: "1px solid var(--border)", background: "var(--card)" }}>
                      <span className="px-2 py-0.5" style={{ fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-semibold)", color: "var(--foreground)" }}>{pending.length}</span>
                    </div>
                  )}
                </div>
                {pending.length > 0 && (
                  <button
                    onClick={() => setPending([])}
                    className="px-3 py-1.5 rounded transition-all"
                    style={{ fontSize: "var(--text-micro)", color: "var(--destructive)", fontWeight: "var(--font-weight-medium)", background: "transparent", border: "1px solid transparent" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "var(--destructive)"; e.currentTarget.style.opacity = "0.08"; e.currentTarget.style.borderColor = "var(--destructive)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.opacity = "1"; e.currentTarget.style.borderColor = "transparent"; }}
                  >
                    Clear All
                  </button>
                )}
              </div>
            </div>

            <div className={`flex-1 overflow-y-auto pb-4 ${sidebarWidth === "narrow" ? "px-4" : "px-6"}`} style={{ background: "#FAFBFC" }}>
              {pending.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mb-3" style={{ background: "var(--card)" }}>
                    <Package className="w-8 h-8" style={{ color: "var(--foreground)", opacity: 0.15 }} />
                  </div>
                  <p style={{ fontSize: "var(--text-caption)", color: "var(--foreground)", opacity: 0.5 }}>No items selected</p>
                  <p style={{ fontSize: "var(--text-micro)", color: "var(--foreground)", opacity: 0.35, marginTop: 4 }}>Click products to add them</p>
                </div>
              ) : (
                <div className={sidebarWidth === "narrow" ? "space-y-3" : "grid gap-3"} style={sidebarWidth === "narrow" ? {} : { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                  {pending.map((p) => {
                    const origNum = originalItemNumbers[p.instanceId];
                    const isNewlyAdded = newlyAddedIds.has(p.instanceId);
                    const isQtyBumped = qtyBumpIds.has(p.instanceId);
                    const existingLineNum = existingCodeLineMap.get(p.item.code);

                    return (
                      <div
                        key={p.instanceId}
                        ref={(el) => { if (el) cardRefsMap.current.set(p.instanceId, el); else cardRefsMap.current.delete(p.instanceId); }}
                        className={`p-3 flex flex-col relative overflow-hidden so-add-sel-card ${isNewlyAdded ? "so-add-new-card" : ""} ${isQtyBumped ? "so-add-qty-bump" : ""}`}
                        style={{
                          borderRadius: "var(--radius)",
                          backgroundColor: "var(--card)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        {/* Item Number Badge - top-left corner */}
                        <div
                          className="absolute top-0 left-0 flex items-center justify-center bg-primary/12 text-primary"
                          style={{ width: 20, height: 20, borderBottomRightRadius: 8, fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-semibold)" }}
                        >
                          {itemNumbers[p.instanceId]}
                        </div>

                        <div className="mb-2 flex-1">
                          <div className="flex items-start justify-between mb-0.5" style={{ paddingLeft: 28 }}>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span style={{ fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-semibold)", color: "var(--foreground)" }}>{p.item.code}</span>
                              <ItemTypeBadge type={p.item.type} />
                              {origNum != null && <DuplicateBadge ofIndex={origNum} />}
                              {existingLineNum !== undefined && origNum == null && <DuplicateBadge ofIndex={existingLineNum} />}
                            </div>
                            <div className="flex items-center gap-1">
                              <button onClick={() => duplicatePending(p.instanceId)} className="shrink-0 p-0.5 transition-colors so-add-card-action" style={{ color: "var(--foreground)", opacity: 0.15, borderRadius: 4 }} title="Duplicate as separate line item">
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => removePending(p.instanceId)} className="shrink-0 transition-colors so-add-card-action" style={{ color: "var(--destructive)", opacity: 0.35 }}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <div className="shrink-0">
                              <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "var(--secondary)", border: "1px solid var(--border)" }}>
                                <Package className="w-3.5 h-3.5" style={{ color: "var(--foreground)", opacity: 0.25 }} />
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div style={{ fontSize: "var(--text-micro)", color: "var(--foreground)", opacity: 0.5, lineHeight: 1.5 }}>
                                {(() => {
                                  if (expandedCardDescs.has(p.instanceId)) {
                                    return (
                                      <>
                                        {p.item.name}{" "}
                                        <button onClick={() => { const n = new Set(expandedCardDescs); n.delete(p.instanceId); setExpandedCardDescs(n); }} style={{ color: "var(--primary)", fontWeight: "var(--font-weight-medium)", fontSize: "var(--text-micro)" }}>see less</button>
                                      </>
                                    );
                                  }
                                  if (p.item.name.length > 80) {
                                    return (
                                      <>
                                        {p.item.name.slice(0, 80)}...{" "}
                                        <button onClick={() => { const n = new Set(expandedCardDescs); n.add(p.instanceId); setExpandedCardDescs(n); }} className="inline-flex items-center gap-0.5 whitespace-nowrap" style={{ color: "var(--primary)", fontWeight: "var(--font-weight-medium)", fontSize: "var(--text-micro)" }}>more <ChevronDown className="w-3 h-3 inline" /></button>
                                      </>
                                    );
                                  }
                                  return p.item.name;
                                })()}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="mt-auto">
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <label style={{ fontSize: "var(--text-micro)", color: "var(--foreground)", opacity: 0.4, fontWeight: "var(--font-weight-medium)" }}>Quantity</label>
                            <label style={{ fontSize: "var(--text-micro)", color: "var(--foreground)", opacity: 0.4, fontWeight: "var(--font-weight-medium)" }}>Item Total</label>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={1}
                              value={p.qty}
                              onChange={e => updatePendingQty(p.instanceId, parseInt(e.target.value) || 1)}
                              className={`w-20 h-8 px-2 ${isQtyBumped ? "so-add-qty-flash" : ""}`}
                              style={{ fontSize: "var(--text-caption)", border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--card)", color: "var(--foreground)", outline: "none" }}
                            />
                            <div className="flex-1 text-right min-w-0">
                              <div className="truncate" style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-semibold)", color: "var(--foreground)" }}>
                                {formatCurrency(p.qty * p.item.unitPrice)} <span style={{ fontWeight: "var(--font-weight-normal)", opacity: 0.5 }}>(EA)</span>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => setConfigPendingId(p.instanceId)}
                            className="w-full h-8 flex items-center justify-center gap-2 transition-colors so-add-card-action"
                            style={{ marginTop: 8, border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: "var(--text-caption)", color: "var(--foreground)", opacity: 0.6, fontWeight: "var(--font-weight-medium)", background: "var(--card)" }}
                          >
                            <Settings className="w-3.5 h-3.5" />
                            Advanced Configuration
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Subtotal bar — no shipping calculation line */}
            {pending.length > 0 && (
              <div className="shrink-0" style={{ borderTop: "1px solid var(--border)", background: "var(--card)", padding: sidebarWidth === "narrow" ? "12px 16px" : "16px 24px" }}>
                <div className="flex items-center justify-between gap-3">
                  <span className="shrink-0" style={{ fontSize: "var(--text-caption)", color: "var(--foreground)", opacity: 0.5, fontWeight: "var(--font-weight-medium)", whiteSpace: "nowrap" }}>
                    Subtotal ({pending.length} item{pending.length !== 1 ? "s" : ""})
                  </span>
                  <span className="shrink-0" style={{ fontSize: "var(--text-base)", fontWeight: "var(--font-weight-semibold)", color: "var(--primary)", whiteSpace: "nowrap" }}>
                    {formatCurrency(subtotal)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ═══ Footer ═══ */}
        <div className="px-5 py-3 border-t border-border flex items-center justify-end gap-2 shrink-0">
          <Button variant="secondary" size="sm" onClick={guardedClose} icon={<X className="w-3.5 h-3.5" />}>
            Cancel <KbdHint keys="Esc" />
          </Button>
          <Button variant="primary" size="sm" onClick={handleAdd} disabled={pending.length === 0} icon={<Plus className="w-3.5 h-3.5" />}>
            Add {pending.length} Items to Order <KbdHint keys="&#8984;&#9166;" variant="light" />
          </Button>
        </div>

        {configPendingId && (() => {
          const selectedPending = pending.find((item) => item.instanceId === configPendingId);
          if (!selectedPending) return null;

          return (
            <AdvancedConfiguratorModal
              line={{
                id: selectedPending.instanceId,
                itemCode: selectedPending.item.code,
                itemName: selectedPending.item.name,
                itemType: selectedPending.item.type,
                warehouse: 'Main Warehouse',
                orderedQty: selectedPending.qty,
                allocatedQty: 0,
                pickedQty: 0,
                shippedQty: 0,
                deliveredQty: 0,
                unitPrice: selectedPending.item.unitPrice,
                taxRate: 0,
                allocations: [],
                cancelled: false,
                cancelledQty: 0,
                readyToPick: false,
              }}
              inventory={store.inventory}
              onClose={() => setConfigPendingId(null)}
              onSave={({ orderedQty, unitPrice }) => {
                setPending(prev => prev.map((item) => item.instanceId === configPendingId
                  ? { ...item, qty: orderedQty, item: { ...item.item, unitPrice } }
                  : item));
                setConfigPendingId(null);
              }}
              onDelete={() => {
                removePending(configPendingId);
                setConfigPendingId(null);
              }}
            />
          );
        })()}
      </div>
    </div>
  );
}