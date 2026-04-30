import { useState, useMemo } from "react";
import { ClipboardList, User, MapPin, Clock, Package, ChevronDown, ChevronUp, Check, AlertTriangle, Info } from "lucide-react";
import { HighlightText, TabSearchBar, FilterPills } from "./SearchHighlight";
import { ProgressFractionCell } from "./ProgressFractionCell";
import type { SalesOrder, PickRecord } from "./types";

/* ═══ Typography — CSS variable tokens only, Inter font ═══ */
const font: React.CSSProperties = {};
const micro: React.CSSProperties = { ...font, fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-semibold)" };
const microNormal: React.CSSProperties = { ...font, fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-normal)" };
const caption: React.CSSProperties = { ...font, fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" };
const captionSemi: React.CSSProperties = { ...font, fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-semibold)" };
const labelSemi: React.CSSProperties = { ...font, fontSize: "var(--text-label)", fontWeight: "var(--font-weight-semibold)" };

interface Props {
  so: SalesOrder;
}

type PickFilter = "all" | "complete" | "in-progress" | "ready" | "pending";

/* ═══ Compact mini-gauge for the summary row ═══ */
function MiniGauge({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  const isFull = value >= total && total > 0;
  const barColor = isFull ? "var(--accent)" : value > 0 ? color : "transparent";

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      {/* Label row */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ ...micro, color: "var(--foreground)", opacity: 0.4, letterSpacing: "0.04em", textTransform: "uppercase" }}>
          {label}
        </span>
        <span style={{
          ...captionSemi,
          color: isFull ? "var(--accent)" : value > 0 ? "var(--foreground)" : "var(--foreground)",
          opacity: value > 0 ? 1 : 0.25,
        }}>
          {value}<span style={{ ...microNormal, color: "var(--foreground)", opacity: 0.3 }}>/{total}</span>
        </span>
      </div>
      {/* Bar */}
      <div style={{
        height: 3, borderRadius: 2, overflow: "hidden",
        background: "var(--secondary)",
      }}>
        <div style={{
          height: "100%", borderRadius: 2,
          width: `${pct}%`, background: barColor,
          transition: "width 400ms ease",
        }} />
      </div>
    </div>
  );
}

/* ═══ Compact stat chip ═══ */
function StatChip({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  const hasValue = value > 0;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "6px 10px",
      borderRadius: 8,
      background: hasValue ? "var(--secondary)" : "var(--secondary)",
      border: `1px solid var(--border)`,
    }}>
      <span style={{
        ...captionSemi,
        color: hasValue ? color : "var(--foreground)",
        opacity: hasValue ? 1 : 0.25,
      }}>
        {value}
      </span>
      <span style={{ ...microNormal, color: "var(--foreground)", opacity: 0.4 }}>{unit}</span>
      <span style={{ ...micro, color: "var(--foreground)", opacity: 0.3, textTransform: "uppercase", letterSpacing: "0.03em", marginLeft: "auto" }}>
        {label}
      </span>
    </div>
  );
}

export function PickingTab({ so }: Props) {
  const [expandedLines, setExpandedLines] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<PickFilter>("all");
  const [activityOpen, setActivityOpen] = useState(false);

  const activeLines = so.lines.filter(l => !l.cancelled);
  const totalOrdered = activeLines.reduce((s, l) => s + l.orderedQty, 0);
  const totalPicked = activeLines.reduce((s, l) => s + l.pickedQty, 0);
  const totalAllocated = activeLines.reduce((s, l) => s + l.allocatedQty, 0);
  const totalShipped = activeLines.reduce((s, l) => s + l.shippedQty, 0);

  const readyToPickLines = activeLines.filter(l => l.readyToPick && l.pickedQty < l.orderedQty);
  const inProgressLines = activeLines.filter(l => l.pickedQty > 0 && l.pickedQty < l.orderedQty);
  const completedLines = activeLines.filter(l => l.pickedQty >= l.orderedQty && l.orderedQty > 0);
  const pendingLines = activeLines.filter(l => l.pickedQty === 0 && (!l.readyToPick || l.orderedQty === 0));

  const filteredLines = useMemo(() => {
    let lines = activeLines;
    if (filter === "complete") lines = completedLines;
    else if (filter === "in-progress") lines = inProgressLines;
    else if (filter === "ready") lines = readyToPickLines;
    else if (filter === "pending") lines = pendingLines;
    if (search) {
      const q = search.toLowerCase();
      lines = lines.filter(l =>
        l.itemCode.toLowerCase().includes(q) ||
        l.itemName.toLowerCase().includes(q) ||
        l.warehouse.toLowerCase().includes(q)
      );
    }
    return lines;
  }, [activeLines, filter, search, completedLines, inProgressLines, readyToPickLines, pendingLines]);

  const pills: { key: PickFilter; label: string; count: number }[] = [
    { key: "all", label: "All", count: activeLines.length },
    { key: "complete", label: "Pick Complete", count: completedLines.length },
    { key: "in-progress", label: "In Progress", count: inProgressLines.length },
    { key: "ready", label: "Ready to Pick", count: readyToPickLines.length },
    { key: "pending", label: "Pending", count: pendingLines.length },
  ];

  const toggleLine = (lineId: string) => {
    setExpandedLines(prev => { const next = new Set(prev); if (next.has(lineId)) next.delete(lineId); else next.add(lineId); return next; });
  };

  const picksByLine: Record<string, PickRecord[]> = {};
  so.pickRecords.forEach(pr => {
    if (!picksByLine[pr.soLineId]) picksByLine[pr.soLineId] = [];
    picksByLine[pr.soLineId].push(pr);
  });

  const filteredPickRecords = useMemo(() => {
    if (!search) return so.pickRecords;
    const q = search.toLowerCase();
    return so.pickRecords.filter(pr =>
      pr.itemCode.toLowerCase().includes(q) ||
      pr.itemName.toLowerCase().includes(q) ||
      pr.pickedBy.toLowerCase().includes(q) ||
      pr.warehouse.toLowerCase().includes(q) ||
      pr.location.toLowerCase().includes(q)
    );
  }, [so.pickRecords, search]);

  const isPreConfirm = so.status === "Draft" || so.status === "Pending Review";

  return (
    <div className="space-y-4">
      {/* ====== Picking Summary — Modern Compact ====== */}
      <div
        className="bg-card rounded-lg border border-border overflow-hidden"
        style={{ boxShadow: "var(--elevation-1)" }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px var(--space-card-padding)",
            borderBottom: "1px solid var(--border)",
            background: "var(--secondary)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 24, height: 24, borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "var(--secondary)",
            }}>
              <ClipboardList style={{ width: 12, height: 12, color: "var(--chart-3)" }} />
            </div>
            <span style={{ ...captionSemi, color: "var(--foreground)" }}>Picking Summary</span>
          </div>
          {isPreConfirm && (
            <span
              style={{
                ...caption,
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "4px 12px", borderRadius: 6,
                background: "var(--secondary)",
                border: "1px solid var(--border)",
                color: "var(--chart-3)",
              }}
            >
              <Info style={{ width: 11, height: 11 }} />
              Confirm order to enable picking
            </span>
          )}
        </div>

        {/* Body — combined gauges + stats in one compact row */}
        <div style={{ padding: "12px var(--space-card-padding)" }}>
          {/* 3 progress gauges in a row */}
          <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
            <MiniGauge label="Allocated" value={totalAllocated} total={totalOrdered} color="var(--primary)" />
            <MiniGauge label="Picked" value={totalPicked} total={totalOrdered} color="var(--chart-3)" />
            <MiniGauge label="Shipped" value={totalShipped} total={totalOrdered} color="var(--chart-4)" />
          </div>

          {/* 4 compact stat chips */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            <StatChip label="Ready" value={readyToPickLines.length} unit="items" color="var(--primary)" />
            <StatChip label="In Progress" value={inProgressLines.length} unit="items" color="var(--chart-3)" />
            <StatChip label="Shipped" value={completedLines.length} unit={`/ ${activeLines.length}`} color="var(--accent)" />
            <StatChip label="Records" value={so.pickRecords.length} unit="total" color="var(--foreground)" />
          </div>

          {/* Confirm CTA banner */}
          {isPreConfirm && activeLines.length > 0 && (
            <div
              style={{
                display: "flex", alignItems: "center", gap: 8,
                marginTop: 12, padding: "8px 12px", borderRadius: 8,
                background: "var(--secondary)",
                border: "1px solid var(--border)",
              }}
            >
              <Package style={{ width: 14, height: 14, color: "var(--primary)", flexShrink: 0 }} />
              <span style={{ ...caption, color: "var(--primary)" }}>
                Confirm this order to enable warehouse picking. Items with allocated inventory will become ready to pick immediately.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ====== Line-by-Line Picking Detail ====== */}
      <div className="bg-card rounded-xl border border-border" style={{ boxShadow: "var(--elevation-1)" }}>
        <TabSearchBar
          search={search}
          onSearchChange={setSearch}
          placeholder="Search items, warehouse..."
          resultCount={filteredLines.length}
          resultLabel={`of ${activeLines.length} items`}
        />
        <FilterPills pills={pills} active={filter} onSelect={setFilter} />

        <div
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            borderTop: "1px solid var(--border)",
            padding: "var(--space-inline-gap) var(--space-card-padding)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ ...captionSemi, color: "var(--foreground)" }}>Pick Progress by Line Item</span>
            <span style={{ ...caption, color: "var(--foreground)", opacity: 0.35 }}>({filteredLines.length} active items)</span>
          </div>
        </div>

        <div>
          {filteredLines.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 0", ...caption, color: "var(--foreground)", opacity: 0.5 }}>No items match your filters.</div>
          ) : (
            filteredLines.map((line) => {
              const isExpanded = expandedLines.has(line.id);
              const linePickRecords = picksByLine[line.id] || [];
              const isComplete = line.pickedQty >= line.orderedQty;
              const isReady = line.readyToPick && line.pickedQty < line.orderedQty;
              const isInProgress = line.pickedQty > 0 && !isComplete;
              const toShip = Math.max(0, line.orderedQty - line.shippedQty);

              return (
                <div key={line.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  {/* Line summary row */}
                  <button
                    onClick={() => toggleLine(line.id)}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 12,
                      padding: "var(--space-inline-gap) var(--space-card-padding)",
                      background: "transparent", border: "none", cursor: "pointer",
                      textAlign: "left", transition: "background 120ms",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--secondary)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    {/* Status indicator */}
                    <div style={{
                      width: 24, height: 24, borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                      background: isComplete
                        ? "var(--accent)"
                        : isInProgress
                          ? "var(--chart-3)"
                          : isReady
                            ? "var(--primary)"
                            : "var(--secondary)",
                    }}>
                      {isComplete ? (
                        <Check style={{ width: 12, height: 12, color: "var(--accent-foreground)" }} />
                      ) : isInProgress ? (
                        <ClipboardList style={{ width: 12, height: 12, color: "var(--primary-foreground)" }} />
                      ) : isReady ? (
                        <Package style={{ width: 12, height: 12, color: "var(--primary-foreground)" }} />
                      ) : (
                        <Clock style={{ width: 12, height: 12, color: "var(--foreground)", opacity: 0.35 }} />
                      )}
                    </div>

                    {/* Item info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                        <span style={{ ...captionSemi, color: "var(--foreground)" }}>
                          <HighlightText text={line.itemCode} search={search} />
                        </span>
                        <span style={{
                          ...micro, padding: "1px 6px", borderRadius: 4,
                          background: isComplete
                            ? "var(--accent)"
                            : isInProgress
                              ? "var(--chart-3)"
                              : isReady
                                ? "var(--primary)"
                                : "var(--secondary)",
                          color: isComplete
                            ? "var(--accent-foreground)"
                            : isInProgress
                              ? "var(--primary-foreground)"
                              : isReady
                                ? "var(--primary-foreground)"
                                : "var(--foreground)",
                          opacity: isComplete || isInProgress || isReady ? 1 : 0.5,
                        }}>
                          {isComplete ? "PICK COMPLETE" : isInProgress ? "PICKING" : isReady ? "READY TO PICK" : "PENDING"}
                        </span>
                      </div>
                      <div style={{ ...caption, fontWeight: "var(--font-weight-normal)", color: "var(--foreground)", opacity: 0.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <HighlightText text={line.itemName} search={search} />
                      </div>
                    </div>

                    {/* Inline progress cells */}
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexShrink: 0 }}>
                      <div style={{ width: 72 }}>
                        <div style={{ ...micro, color: "var(--foreground)", opacity: 0.35, letterSpacing: "0.04em", textAlign: "right", marginBottom: 2 }}>ALLOC</div>
                        <ProgressFractionCell value={line.allocatedQty} total={toShip} />
                      </div>
                      <div style={{ width: 72 }}>
                        <div style={{ ...micro, color: "var(--foreground)", opacity: 0.35, letterSpacing: "0.04em", textAlign: "right", marginBottom: 2 }}>PICKED</div>
                        <ProgressFractionCell value={line.pickedQty} total={toShip} />
                      </div>
                      <div style={{ width: 72 }}>
                        <div style={{ ...micro, color: "var(--foreground)", opacity: 0.35, letterSpacing: "0.04em", textAlign: "right", marginBottom: 2 }}>SHIPPED</div>
                        <ProgressFractionCell value={line.shippedQty} total={line.orderedQty} altPartialColor />
                      </div>
                    </div>

                    {/* Expand chevron */}
                    <div style={{ flexShrink: 0 }}>
                      {isExpanded
                        ? <ChevronUp style={{ width: 14, height: 14, color: "var(--foreground)", opacity: 0.35 }} />
                        : <ChevronDown style={{ width: 14, height: 14, color: "var(--foreground)", opacity: 0.35 }} />}
                    </div>
                  </button>

                  {/* Expanded pick records */}
                  {isExpanded && (
                    <div style={{ padding: "4px var(--space-card-padding) var(--space-inline-gap)", background: "var(--secondary)" }}>
                      {linePickRecords.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 4 }}>
                          {linePickRecords.map(pr => (
                            <div key={pr.id} style={{
                              display: "flex", alignItems: "center", justifyContent: "space-between",
                              padding: "8px 12px",
                              background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8,
                            }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <div style={{
                                  width: 28, height: 28, borderRadius: "50%",
                                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                                  background: "var(--primary)",
                                  color: "var(--primary-foreground)",
                                  ...micro,
                                }}>
                                  {pr.pickedByInitials}
                                </div>
                                <div>
                                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                                    <span style={{ ...caption, color: "var(--foreground)" }}>
                                      <HighlightText text={pr.pickedBy} search={search} />
                                    </span>
                                    <span style={{ ...microNormal, color: "var(--foreground)", opacity: 0.35 }}>picked</span>
                                    <span style={{ ...captionSemi, color: "var(--foreground)" }}>{pr.pickedQty} EA</span>
                                  </div>
                                  <div style={{ display: "flex", alignItems: "center", gap: 12, ...caption, fontWeight: "var(--font-weight-normal)", color: "var(--foreground)", opacity: 0.5 }}>
                                    <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                                      <MapPin style={{ width: 10, height: 10 }} />
                                      <HighlightText text={`${pr.warehouse} — ${pr.location}`} search={search} />
                                    </span>
                                    <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                                      <Clock style={{ width: 10, height: 10 }} />
                                      {pr.pickedAt}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <Check style={{ width: 12, height: 12, color: "var(--accent)" }} />
                                <span style={{ ...caption, color: "var(--accent)" }}>Confirmed</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{
                          display: "flex", alignItems: "center", gap: 8,
                          padding: "10px 12px",
                          background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8,
                          marginTop: 4,
                        }}>
                          {isReady ? (
                            <>
                              <Package style={{ width: 14, height: 14, color: "var(--primary)", opacity: 0.4 }} />
                              <span style={{ ...caption, color: "var(--primary)", opacity: 0.6 }}>Ready to pick — awaiting warehouse assignment</span>
                            </>
                          ) : (
                            <>
                              <AlertTriangle style={{ width: 14, height: 14, color: "var(--foreground)", opacity: 0.2 }} />
                              <span style={{ ...caption, color: "var(--foreground)", opacity: 0.35 }}>No pick records yet — {line.allocatedQty > 0 ? "awaiting confirmation" : "allocate inventory first"}</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ====== Recent Pick Activity ====== */}
      {so.pickRecords.length > 0 && (
        <div className="bg-card rounded-xl border border-border overflow-hidden" style={{ boxShadow: "var(--elevation-1)" }}>
          <button
            onClick={() => setActivityOpen(!activityOpen)}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "var(--space-inline-gap) var(--space-card-padding)",
              background: "var(--secondary)", border: "none", borderBottom: "1px solid var(--border)",
              cursor: "pointer", transition: "background 120ms",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Clock style={{ width: 12, height: 12, color: "var(--foreground)", opacity: 0.5 }} />
              <span style={{ ...captionSemi, color: "var(--foreground)" }}>Recent Pick Activity</span>
              <span style={{ ...caption, fontWeight: "var(--font-weight-normal)", color: "var(--foreground)", opacity: 0.35 }}>(reverse chronological)</span>
              <span style={{
                ...micro, padding: "1px 7px", borderRadius: 999,
                background: "var(--border)", color: "var(--foreground)", opacity: 0.5,
              }}>
                {filteredPickRecords.length}
              </span>
            </div>
            {activityOpen
              ? <ChevronUp style={{ width: 14, height: 14, color: "var(--foreground)", opacity: 0.35 }} />
              : <ChevronDown style={{ width: 14, height: 14, color: "var(--foreground)", opacity: 0.35 }} />}
          </button>
          {activityOpen && (
            <div style={{ padding: "var(--space-card-padding)" }}>
              <div style={{ position: "relative" }}>
                <div style={{ position: "absolute", left: 11, top: 12, bottom: 12, width: 1, background: "var(--border)" }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {[...filteredPickRecords].reverse().slice(0, 10).map((pr, i) => (
                    <div key={pr.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, position: "relative" }}>
                      <div style={{
                        width: 23, height: 23, borderRadius: "50%",
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                        background: i === 0 ? "var(--accent)" : "var(--card)",
                        border: i === 0 ? "2px solid var(--accent)" : "2px solid var(--border)",
                        zIndex: 1,
                      }}>
                        <User style={{ width: 10, height: 10, color: i === 0 ? "var(--accent-foreground)" : "var(--foreground)", opacity: i === 0 ? 1 : 0.35 }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, ...caption }}>
                          <span style={{ color: "var(--foreground)" }}>
                            <HighlightText text={pr.pickedBy} search={search} />
                          </span>
                          <span style={{ color: "var(--foreground)", opacity: 0.35, fontWeight: "var(--font-weight-normal)" }}>picked</span>
                          <span style={{ ...captionSemi, color: "var(--foreground)" }}>
                            {pr.pickedQty} × <HighlightText text={pr.itemCode} search={search} />
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 2, ...caption, fontWeight: "var(--font-weight-normal)", color: "var(--foreground)", opacity: 0.5 }}>
                          <span><HighlightText text={`${pr.warehouse} — ${pr.location}`} search={search} /></span>
                          <span>{pr.pickedAt}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}