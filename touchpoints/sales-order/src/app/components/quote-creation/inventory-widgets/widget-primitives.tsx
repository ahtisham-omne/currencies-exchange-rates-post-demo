/**
 * Widget Primitives — reusable card wrappers, headers & controls.
 *
 * Ported from Physical Inventory's `widgets/widget-primitives.tsx`.
 *
 * Modifications (per user direction):
 *   1. Removed `HeaderControls` + `WidgetControlsContext` (the size-segmented
 *      tabs + delete button rendered on hover). We do not manage these
 *      widgets in a sidebar, so the orchestration affordance is unnecessary.
 *   2. Removed `KpiCard` (not used by the three inventory cards we surface).
 *
 * Everything else (WidgetHeader chrome, InfoTooltip, SmallSelect + the
 * MiniRangeCalendar for Custom Date) is a 1:1 mirror of the source.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import ReactDOM from "react-dom";
import { ChevronDown, ChevronLeft, ChevronRight, Check, Info, Calendar, TrendingDown, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { FONT } from "./widget-utils";

/* ══════════════════════════════════════════════════════════════════════
 *  InfoTooltip — 12px info icon with hover popover description
 * ══════════════════════════════════════════════════════════════════════ */
export function InfoTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const iconRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const open = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 6, left: rect.left + rect.width / 2 });
    }
    setShow(true);
  }, []);

  const close = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setShow(false), 120);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return (
    <>
      <span
        ref={iconRef}
        onMouseEnter={open}
        onMouseLeave={close}
        onClick={(e) => { e.preventDefault(); open(); }}
        className="inline-flex items-center justify-center shrink-0 cursor-help"
        style={{ width: 18, height: 18, padding: 3 }}
      >
        <Info size={12} style={{ color: "var(--text-tertiary)" }} />
      </span>
      {show &&
        ReactDOM.createPortal(
          <div
            onMouseEnter={() => { if (timerRef.current) clearTimeout(timerRef.current); }}
            onMouseLeave={close}
            style={{
              position: "fixed",
              top: `${pos.top}px`,
              left: `${pos.left}px`,
              transform: "translateX(-50%)",
              zIndex: 12100,
              maxWidth: "280px",
              padding: "var(--spacing-2-5) var(--spacing-3)",
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              boxShadow: "var(--elevation-sm)",
              fontFamily: FONT,
              fontWeight: "var(--font-weight-normal)" as any,
              fontSize: "var(--text-caption)",
              color: "var(--text-secondary)",
              lineHeight: 1.45,
              pointerEvents: "auto",
            }}
          >
            <span
              aria-hidden
              style={{
                position: "absolute",
                top: -5,
                left: "50%",
                transform: "translateX(-50%) rotate(45deg)",
                width: 9,
                height: 9,
                background: "var(--card)",
                borderTop: "1px solid var(--border)",
                borderLeft: "1px solid var(--border)",
              }}
            />
            <div style={{ lineHeight: 1.5 }}>{text}</div>
          </div>,
          document.body,
        )}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════
 *  Snapshot data shape + SnapshotIcon — same idea as InfoTooltip but
 *  renders the rich rows/formula popover the source's KpiCard uses for
 *  metrics with breakdowns (Available, ATP, Projected Available, ...).
 * ══════════════════════════════════════════════════════════════════════ */
export interface StatSnapshot {
  title: string;
  description?: string;
  rows: { label: string; value: string | number; indent?: boolean; highlight?: boolean }[];
  formulas?: string[];
}

export function SnapshotIcon({ snapshot }: { snapshot: StatSnapshot }) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const iconRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const open = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 6, left: rect.left + rect.width / 2 });
    }
    setShow(true);
  }, []);

  const close = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setShow(false), 120);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return (
    <>
      <span
        ref={iconRef}
        onMouseEnter={open}
        onMouseLeave={close}
        onClick={(e) => { e.preventDefault(); open(); }}
        className="inline-flex items-center justify-center shrink-0 cursor-help"
        style={{ width: 18, height: 18, padding: 3 }}
      >
        <Info size={12} style={{ color: "var(--text-tertiary)" }} />
      </span>
      {show &&
        ReactDOM.createPortal(
          <div
            onMouseEnter={() => { if (timerRef.current) clearTimeout(timerRef.current); }}
            onMouseLeave={close}
            style={{
              position: "fixed",
              top: `${pos.top}px`,
              left: `${pos.left}px`,
              transform: "translateX(-50%)",
              zIndex: 12100,
              width: "320px",
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              boxShadow: "var(--elevation-sm)",
              fontFamily: FONT,
              overflow: "visible",
              pointerEvents: "auto",
            }}
          >
            <span
              aria-hidden
              style={{
                position: "absolute",
                top: -5,
                left: "50%",
                transform: "translateX(-50%) rotate(45deg)",
                width: 9,
                height: 9,
                background: "var(--card)",
                borderTop: "1px solid var(--border)",
                borderLeft: "1px solid var(--border)",
              }}
            />
            <div style={{ padding: "var(--spacing-2-5) var(--spacing-3)", borderBottom: "1px solid var(--border)" }}>
              <div className="flex items-center" style={{ gap: "var(--spacing-1-5)" }}>
                <Info size={14} style={{ color: "var(--text-secondary)" }} />
                <span style={{ fontWeight: "var(--font-weight-semibold)" as any, fontSize: "var(--text-body-sm)", color: "var(--foreground)", textTransform: "uppercase" as const, letterSpacing: "0.03em" }}>{snapshot.title}</span>
              </div>
            </div>
            <div style={{ padding: "var(--spacing-1-5) 0" }}>
              {snapshot.rows.map((row, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between"
                  style={{
                    padding: "var(--spacing-1-5) var(--spacing-3)",
                    paddingLeft: row.indent ? "var(--spacing-6)" : "var(--spacing-3)",
                    background: row.highlight ? "var(--status-active-bg)" : "transparent",
                    borderTop: row.highlight ? "1px solid var(--status-active-border)" : undefined,
                    borderBottom: row.highlight ? "1px solid var(--status-active-border)" : undefined,
                  }}
                >
                  <span style={{
                    fontSize: row.indent ? "var(--text-caption)" : "var(--text-body-sm)",
                    fontWeight: (row.highlight || !row.indent) ? "var(--font-weight-semibold)" as any : "var(--font-weight-normal)" as any,
                    color: row.indent ? "var(--text-secondary)" : "var(--foreground)",
                  }}>
                    {row.label}
                  </span>
                  <span style={{
                    fontSize: "var(--text-body-sm)",
                    fontWeight: "var(--font-weight-semibold)" as any,
                    color: row.highlight ? "var(--status-active-text)" : "var(--foreground)",
                  }}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
            {(snapshot.description || (snapshot.formulas && snapshot.formulas.length > 0)) && (
              <div style={{ padding: "var(--spacing-2) var(--spacing-3)" }}>
                {snapshot.description && (
                  <p style={{ fontFamily: FONT, fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-normal)" as any, color: "var(--text-secondary)", lineHeight: 1.45, margin: 0 }}>
                    {snapshot.description}
                  </p>
                )}
                {snapshot.formulas && snapshot.formulas.length > 0 && (
                  <div style={{ marginTop: snapshot.description ? "var(--spacing-2)" : 0 }}>
                    {snapshot.formulas.map((f, i) => (
                      <div key={i} style={{
                        fontFamily: "'SF Mono', 'Fira Code', monospace",
                        fontSize: "var(--text-caption)",
                        fontWeight: "var(--font-weight-medium)" as any,
                        color: "var(--primary)",
                        background: "var(--primary-50)",
                        borderRadius: "var(--radius-sm)",
                        padding: "5px 8px",
                        marginTop: i > 0 ? 4 : 0,
                        lineHeight: 1.5,
                      }}>
                        {f}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════
 *  WidgetHeader — consistent title / right-slot layout
 * ══════════════════════════════════════════════════════════════════════ */
export function WidgetHeader({
  title,
  right,
  icon: Icon,
}: {
  title: string;
  subtitle?: string;
  description?: string;
  right?: React.ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div style={{ marginLeft: "calc(-1 * var(--spacing-4))", marginRight: "calc(-1 * var(--spacing-4))", marginBottom: "var(--spacing-4)" }}>
      <div
        className="flex items-center justify-between gap-2"
        style={{ padding: "0 var(--spacing-4)", paddingBottom: "var(--spacing-2-5)" }}
      >
        <div className="flex items-center min-w-0 flex-1" style={{ gap: "var(--spacing-2)" }}>
          {Icon && (
            <div
              className="flex items-center justify-center shrink-0"
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "var(--radius-lg)",
                background: "#EDF4FF",
              }}
            >
              <Icon size={14} style={{ color: "#0A77FF" }} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center" style={{ gap: "var(--spacing-1-5)" }}>
              <p
                className="whitespace-nowrap"
                style={{
                  margin: 0,
                  fontFamily: FONT,
                  fontWeight: "var(--font-weight-semibold)" as any,
                  fontSize: "var(--text-body-sm)",
                  color: "var(--foreground)",
                  lineHeight: 1.4,
                  minWidth: 0,
                }}
              >
                {title}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {right && (
            <div className="shrink-0 opacity-0 group-hover/widget:opacity-100 transition-opacity duration-200">
              {right}
            </div>
          )}
        </div>
      </div>
      <div style={{ height: 1, background: "var(--border)", opacity: 0.6 }} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
 *  SmallSelect — portal-rendered popover dropdown
 * ══════════════════════════════════════════════════════════════════════ */
const DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function MiniRangeCalendar({
  from,
  to,
  onSelect,
}: {
  from: Date | null;
  to: Date | null;
  onSelect: (d: Date) => void;
}) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(from?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(from?.getMonth() ?? today.getMonth());

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const blanks: null[] = Array(firstDay).fill(null);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const cells = [...blanks, ...days];

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  };

  const dateForDay = (day: number) => new Date(viewYear, viewMonth, day);

  const isSameDay = (a: Date | null, b: Date) =>
    a != null && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const isInRange = (day: number) => {
    if (!from || !to) return false;
    const d = dateForDay(day).getTime();
    const s = Math.min(from.getTime(), to.getTime());
    const e = Math.max(from.getTime(), to.getTime());
    return d > s && d < e;
  };

  const isStart = (day: number) => isSameDay(from, dateForDay(day));
  const isEnd = (day: number) => isSameDay(to, dateForDay(day));
  const isToday = (day: number) =>
    today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === day;

  const monthLabel = new Date(viewYear, viewMonth).toLocaleString("default", { month: "long", year: "numeric" });

  return (
    <div style={{ padding: "var(--spacing-1) 0" }}>
      <div style={{ fontFamily: FONT, fontSize: "var(--text-caption)", color: "var(--text-tertiary)", textAlign: "center", marginBottom: "var(--spacing-1)" }}>
        {!from ? "Select start date" : !to ? "Select end date" : ""}
      </div>
      <div className="flex items-center justify-between" style={{ padding: "0 var(--spacing-1)", marginBottom: "var(--spacing-1-5)" }}>
        <button
          type="button"
          onClick={prevMonth}
          className="cursor-pointer flex items-center justify-center transition-colors"
          style={{ width: 24, height: 24, borderRadius: "var(--radius-sm)", border: "none", background: "transparent", color: "var(--text-secondary)" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--surface-secondary)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        >
          <ChevronLeft size={14} />
        </button>
        <span style={{ fontFamily: FONT, fontSize: "var(--text-body-sm)", fontWeight: "var(--font-weight-medium)" as any, color: "var(--foreground)" }}>
          {monthLabel}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="cursor-pointer flex items-center justify-center transition-colors"
          style={{ width: 24, height: 24, borderRadius: "var(--radius-sm)", border: "none", background: "transparent", color: "var(--text-secondary)" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--surface-secondary)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        >
          <ChevronRight size={14} />
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0 }}>
        {DOW.map((d) => (
          <div
            key={d}
            className="flex items-center justify-center"
            style={{ height: 26, fontFamily: FONT, fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" as any, color: "var(--text-tertiary)" }}
          >
            {d}
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0 }}>
        {cells.map((day, idx) => {
          if (day === null) return <div key={`b-${idx}`} style={{ height: 28 }} />;
          const start = isStart(day);
          const end = isEnd(day);
          const inR = isInRange(day);
          const sel = start || end;
          const tod = isToday(day);
          return (
            <button
              key={day}
              type="button"
              onClick={() => onSelect(dateForDay(day))}
              className="flex items-center justify-center cursor-pointer transition-colors"
              style={{
                height: 28,
                width: "100%",
                borderRadius: sel ? "var(--radius-sm)" : inR ? 0 : "var(--radius-sm)",
                border: "none",
                fontFamily: FONT,
                fontSize: "var(--text-caption)",
                fontWeight: sel ? ("var(--font-weight-semibold)" as any) : ("var(--font-weight-normal)" as any),
                color: sel ? "white" : tod ? "var(--primary)" : "var(--foreground)",
                background: sel ? "var(--primary)" : inR ? "var(--primary-50)" : "transparent",
              }}
              onMouseEnter={(e) => { if (!sel && !inR) (e.currentTarget as HTMLElement).style.background = "var(--primary-50)"; }}
              onMouseLeave={(e) => { if (!sel && !inR) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function formatDateShort(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function SmallSelect({
  options,
  defaultValue,
  onChange,
  value: controlledValue,
  prefix,
}: {
  options: string[];
  defaultValue?: string;
  onChange?: (value: string) => void;
  value?: string;
  prefix?: string;
}) {
  const [internalSelected, setInternalSelected] = useState(defaultValue || options[0]);
  const selected = controlledValue ?? internalSelected;
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; minWidth: number }>({ top: 0, left: 0, minWidth: 0 });

  const [showCustom, setShowCustom] = useState(false);
  const [customFrom, setCustomFrom] = useState<Date | null>(null);
  const [customTo, setCustomTo] = useState<Date | null>(null);
  const [customLabel, setCustomLabel] = useState<string | null>(null);

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 4,
      left: rect.right,
      minWidth: Math.max(rect.width, 160),
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePos();
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => {
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [open, updatePos]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      )
        return;
      setOpen(false);
      setShowCustom(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSelect = (o: string) => {
    if (o === "Custom Date") {
      setShowCustom(true);
      setCustomFrom(null);
      setCustomTo(null);
      return;
    }
    setInternalSelected(o);
    setCustomLabel(null);
    setShowCustom(false);
    setOpen(false);
    onChange?.(o);
  };

  const handleRangeSelect = (d: Date) => {
    if (!customFrom || customTo) {
      setCustomFrom(d);
      setCustomTo(null);
    } else {
      const from = d < customFrom ? d : customFrom;
      const to = d < customFrom ? customFrom : d;
      setCustomFrom(from);
      setCustomTo(to);
      const label = `${formatDateShort(from)} – ${formatDateShort(to)}`;
      setCustomLabel(label);
      setInternalSelected("Custom Date");
      setShowCustom(false);
      setOpen(false);
      onChange?.("Custom Date");
    }
  };

  const displayLabel = selected === "Custom Date" && customLabel ? customLabel : selected;

  const standardOptions = options.filter((o) => o !== "Custom Date");
  const hasCustom = options.includes("Custom Date");

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => { setOpen(!open); if (open) { setShowCustom(false); } }}
        className="flex items-center border border-border transition-colors hover:border-primary/40 cursor-pointer"
        style={{
          fontFamily: FONT,
          fontWeight: "var(--font-weight-medium)" as any,
          fontSize: "var(--text-body-sm)",
          borderRadius: "var(--radius-sm)",
          padding: "var(--spacing-1) var(--spacing-2)",
          paddingRight: "var(--spacing-1-5)",
          color: "var(--text-secondary)",
          background: open ? "var(--surface-secondary)" : "var(--card)",
          gap: "var(--spacing-1-5)",
          whiteSpace: "nowrap",
          lineHeight: 1.4,
        }}
      >
        {prefix && (
          <span
            style={{
              fontFamily: FONT,
              fontSize: "var(--text-caption)",
              fontWeight: "var(--font-weight-normal)" as any,
              color: "var(--text-tertiary)",
            }}
          >
            {prefix}
          </span>
        )}
        {displayLabel}
        <ChevronDown
          size={14}
          style={{
            color: "var(--text-tertiary)",
            transition: "transform 0.15s ease",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            flexShrink: 0,
          }}
        />
      </button>

      {open &&
        ReactDOM.createPortal(
          <div
            ref={panelRef}
            style={{
              position: "fixed",
              top: `${pos.top}px`,
              left: `${pos.left}px`,
              transform: "translateX(-100%)",
              zIndex: 12100,
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              padding: "var(--spacing-1)",
              minWidth: `${pos.minWidth}px`,
              boxShadow:
                "0 8px 24px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06)",
            }}
          >
            {!showCustom ? (
              <>
                {standardOptions.map((o) => {
                  const isActive = o === selected && !customLabel;
                  return (
                    <button
                      key={o}
                      onClick={() => handleSelect(o)}
                      className="flex items-center w-full transition-colors cursor-pointer"
                      style={{
                        fontFamily: FONT,
                        fontSize: "var(--text-body-sm)",
                        fontWeight: isActive
                          ? ("var(--font-weight-medium)" as any)
                          : ("var(--font-weight-normal)" as any),
                        color: isActive
                          ? "var(--primary)"
                          : "var(--text-secondary)",
                        background: isActive
                          ? "var(--primary-50)"
                          : "transparent",
                        border: "none",
                        borderRadius: "var(--radius-sm)",
                        padding: "var(--spacing-1-5) var(--spacing-2-5)",
                        gap: "var(--spacing-2)",
                        textAlign: "left",
                        whiteSpace: "nowrap",
                        lineHeight: 1.5,
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive)
                          (e.currentTarget as HTMLElement).style.background =
                            "var(--surface-secondary)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background =
                          isActive ? "var(--primary-50)" : "transparent";
                      }}
                    >
                      {isActive && (
                        <Check
                          size={14}
                          style={{ color: "var(--primary)", flexShrink: 0 }}
                        />
                      )}
                      {!isActive && (
                        <span
                          style={{
                            display: "inline-block",
                            width: "14px",
                            height: "14px",
                            flexShrink: 0,
                          }}
                        />
                      )}
                      {o}
                    </button>
                  );
                })}
                {hasCustom && (
                  <>
                    <div style={{ height: 1, background: "var(--border)", margin: "var(--spacing-1) 0" }} />
                    {(() => {
                      const isActive = selected === "Custom Date" && !!customLabel;
                      return (
                        <button
                          onClick={() => handleSelect("Custom Date")}
                          className="flex items-center w-full transition-colors cursor-pointer"
                          style={{
                            fontFamily: FONT,
                            fontSize: "var(--text-body-sm)",
                            fontWeight: isActive
                              ? ("var(--font-weight-medium)" as any)
                              : ("var(--font-weight-normal)" as any),
                            color: isActive
                              ? "var(--primary)"
                              : "var(--text-secondary)",
                            background: isActive
                              ? "var(--primary-50)"
                              : "transparent",
                            border: "none",
                            borderRadius: "var(--radius-sm)",
                            padding: "var(--spacing-1-5) var(--spacing-2-5)",
                            gap: "var(--spacing-2)",
                            textAlign: "left",
                            whiteSpace: "nowrap",
                            lineHeight: 1.5,
                          }}
                          onMouseEnter={(e) => {
                            if (!isActive)
                              (e.currentTarget as HTMLElement).style.background =
                                "var(--surface-secondary)";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.background =
                              isActive ? "var(--primary-50)" : "transparent";
                          }}
                        >
                          {isActive && (
                            <Check
                              size={14}
                              style={{ color: "var(--primary)", flexShrink: 0 }}
                            />
                          )}
                          {!isActive && (
                            <Calendar
                              size={14}
                              style={{ color: "var(--text-tertiary)", flexShrink: 0 }}
                            />
                          )}
                          {customLabel ? customLabel : "Custom Date"}
                        </button>
                      );
                    })()}
                  </>
                )}
              </>
            ) : (
              <div style={{ width: 260, padding: "var(--spacing-1)" }}>
                <div className="flex items-center" style={{ gap: "var(--spacing-2)", marginBottom: "var(--spacing-1)" }}>
                  <button
                    type="button"
                    onClick={() => { setShowCustom(false); }}
                    className="cursor-pointer flex items-center justify-center transition-colors"
                    style={{ width: 24, height: 24, borderRadius: "var(--radius-sm)", border: "none", background: "transparent", color: "var(--text-secondary)" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--surface-secondary)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span style={{ fontFamily: FONT, fontSize: "var(--text-body-sm)", fontWeight: "var(--font-weight-medium)" as any, color: "var(--foreground)" }}>
                    Select Range
                  </span>
                </div>
                <MiniRangeCalendar
                  from={customFrom}
                  to={customTo}
                  onSelect={handleRangeSelect}
                />
              </div>
            )}
          </div>,
          document.body
        )}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════
 *  KpiCard — compact metric card with optional trend / badge / snapshot.
 *
 *  Ported verbatim from Physical Inventory's `widgets/widget-primitives.tsx`.
 *  Used here to render the ATP (Available to Promise) callout above the
 *  Stock Health widget.
 * ══════════════════════════════════════════════════════════════════════ */
export function KpiCard({
  label,
  description,
  value,
  icon: Icon,
  trend,
  trendDirection,
  badgeText,
  badgeBg,
  badgeColor,
  badgeBorder,
  snapshot,
}: {
  label: string;
  description?: string;
  value: string;
  icon?: LucideIcon;
  trend?: string;
  trendDirection?: "up" | "down";
  badgeText?: string;
  badgeBg?: string;
  badgeColor?: string;
  badgeBorder?: string;
  snapshot?: { title: string; description?: string; rows: { label: string; value: string | number; indent?: boolean; highlight?: boolean }[]; formulas?: string[] };
}) {
  const [snapOpen, setSnapOpen] = useState(false);
  const [snapPos, setSnapPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const cardRef = useRef<HTMLDivElement>(null);
  const snapIconRef = useRef<HTMLSpanElement>(null);
  const snapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const closeSnap = useCallback(() => {
    if (snapTimer.current) clearTimeout(snapTimer.current);
    snapTimer.current = setTimeout(() => setSnapOpen(false), 150);
  }, []);

  useEffect(() => () => { if (snapTimer.current) clearTimeout(snapTimer.current); }, []);

  return (
    <>
      <div
        ref={cardRef}
        className="flex flex-col justify-between border border-border transition-all duration-200 ease-out hover:border-primary/20 cursor-default group/kpi"
        style={{
          padding: "var(--spacing-2) var(--spacing-3)",
          background: "var(--card)",
          fontFamily: FONT,
          borderRadius: "var(--radius-md)",
        }}
      >
        <div
          className="flex items-center justify-between"
          style={{ marginBottom: "var(--spacing-1)" }}
        >
          <div className="flex items-center" style={{ gap: "var(--spacing-1)" }}>
            <span
              style={{
                fontSize: "var(--text-caption)",
                fontWeight: "var(--font-weight-medium)" as any,
                color: "var(--text-secondary)",
                fontFamily: FONT,
              }}
            >
              {label}
            </span>
            {description && !snapshot && <InfoTooltip text={description} />}
            {snapshot && (
              <span
                ref={snapIconRef}
                onMouseEnter={() => {
                  if (snapTimer.current) clearTimeout(snapTimer.current);
                  snapTimer.current = setTimeout(() => {
                    if (snapIconRef.current) {
                      const rect = snapIconRef.current.getBoundingClientRect();
                      setSnapPos({ top: rect.bottom + 6, left: rect.left + rect.width / 2 });
                    }
                    setSnapOpen(true);
                  }, 200);
                }}
                onMouseLeave={closeSnap}
                className="inline-flex items-center justify-center shrink-0 cursor-help"
                style={{ width: "12px", height: "12px" }}
              >
                <Info size={12} style={{ color: "var(--text-tertiary)" }} />
              </span>
            )}
          </div>
          {Icon && (
            <div
              className="flex items-center justify-center rounded-[var(--radius-sm)] transition-all duration-200 group-hover/kpi:bg-primary/10"
              style={{ width: "20px", height: "20px" }}
            >
              <Icon
                size={13}
                className="transition-colors duration-200 group-hover/kpi:text-primary"
                style={{ color: "var(--text-tertiary)" }}
              />
            </div>
          )}
        </div>
        <div className="flex items-center" style={{ gap: "var(--spacing-1-5)" }}>
          {trend && trendDirection === "down" && (
            <TrendingDown size={13} style={{ color: "var(--destructive)" }} />
          )}
          {trend && trendDirection === "up" && (
            <TrendingUp size={13} style={{ color: "#27B973" }} />
          )}
          {badgeText ? (
            <span
              className="inline-flex items-center w-fit rounded-[var(--radius-sm)]"
              style={{
                fontFamily: FONT,
                fontWeight: "var(--font-weight-medium)" as any,
                fontSize: "var(--text-body-sm)",
                background: badgeBg || "var(--primary-50)",
                color: badgeColor || "var(--primary)",
                border: badgeBorder
                  ? `1px solid ${badgeBorder}`
                  : "1px solid var(--primary-200)",
                padding: "var(--spacing-0-5) var(--spacing-1-5)",
              }}
            >
              {badgeText}
            </span>
          ) : (
            <span
              style={{
                fontSize: "15px",
                fontWeight: "var(--font-weight-semibold)" as any,
                color: "var(--foreground)",
                fontFamily: FONT,
                lineHeight: 1.2,
              }}
            >
              {value}
            </span>
          )}
        </div>
      </div>

      {snapshot && snapOpen && ReactDOM.createPortal(
        <div
          onMouseEnter={() => { if (snapTimer.current) clearTimeout(snapTimer.current); }}
          onMouseLeave={closeSnap}
          style={{
            position: "fixed",
            top: `${snapPos.top}px`,
            left: `${snapPos.left}px`,
            transform: "translateX(-50%)",
            zIndex: 12100,
            width: "320px",
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--elevation-sm)",
            fontFamily: FONT,
            overflow: "visible",
          }}
        >
          <span
            aria-hidden
            style={{
              position: "absolute",
              top: -5,
              left: "50%",
              transform: "translateX(-50%) rotate(45deg)",
              width: 9,
              height: 9,
              background: "var(--card)",
              borderTop: "1px solid var(--border)",
              borderLeft: "1px solid var(--border)",
            }}
          />
          <div style={{ padding: "var(--spacing-2-5) var(--spacing-3)", borderBottom: "1px solid var(--border)", background: "var(--card)", borderTopLeftRadius: "var(--radius-md)", borderTopRightRadius: "var(--radius-md)" }}>
            <div className="flex items-center" style={{ gap: "var(--spacing-1-5)" }}>
              <Info size={14} style={{ color: "var(--text-secondary)" }} />
              <span style={{ fontWeight: "var(--font-weight-semibold)" as any, fontSize: "var(--text-body-sm)", color: "var(--foreground)", textTransform: "uppercase" as const, letterSpacing: "0.03em" }}>{snapshot.title}</span>
            </div>
          </div>
          <div style={{ padding: "var(--spacing-1-5) 0" }}>
            {snapshot.rows.map((row, i) => (
              <div
                key={i}
                className="flex items-center justify-between"
                style={{
                  padding: "var(--spacing-1-5) var(--spacing-3)",
                  paddingLeft: row.indent ? "var(--spacing-6)" : "var(--spacing-3)",
                  background: row.highlight ? "var(--status-active-bg)" : "transparent",
                  borderTop: row.highlight ? "1px solid var(--status-active-border)" : undefined,
                  borderBottom: row.highlight ? "1px solid var(--status-active-border)" : undefined,
                }}
              >
                <span style={{
                  fontSize: row.indent ? "var(--text-caption)" : "var(--text-body-sm)",
                  fontWeight: (row.highlight || !row.indent) ? "var(--font-weight-semibold)" as any : "var(--font-weight-normal)" as any,
                  color: row.indent ? "var(--text-secondary)" : "var(--foreground)",
                }}>
                  {row.label}
                </span>
                <span style={{
                  fontSize: "var(--text-body-sm)",
                  fontWeight: "var(--font-weight-semibold)" as any,
                  color: row.highlight ? "var(--status-active-text)" : "var(--foreground)",
                }}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>
          {(snapshot.description || (snapshot.formulas && snapshot.formulas.length > 0)) && (
            <div style={{ padding: "var(--spacing-2) var(--spacing-3)" }}>
              {snapshot.description && (
                <p style={{ fontFamily: FONT, fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-normal)" as any, color: "var(--text-secondary)", lineHeight: 1.45, margin: 0 }}>
                  {snapshot.description}
                </p>
              )}
              {snapshot.formulas && snapshot.formulas.length > 0 && (
                <div style={{ marginTop: snapshot.description ? "var(--spacing-2)" : 0 }}>
                  {snapshot.formulas.map((f, i) => (
                    <div key={i} style={{
                      fontFamily: "'SF Mono', 'Fira Code', monospace",
                      fontSize: "var(--text-caption)",
                      fontWeight: "var(--font-weight-medium)" as any,
                      color: "var(--primary)",
                      background: "var(--primary-50)",
                      borderRadius: "var(--radius-sm)",
                      padding: "5px 8px",
                      marginTop: i > 0 ? 4 : 0,
                      lineHeight: 1.5,
                      transition: "background 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease",
                      cursor: "default",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "hsl(213, 97%, 90%)";
                      (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 8px -2px rgba(10, 119, 255, 0.18)";
                      (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "var(--primary-50)";
                      (e.currentTarget as HTMLElement).style.boxShadow = "none";
                      (e.currentTarget as HTMLElement).style.transform = "none";
                    }}
                    >
                      {f}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
