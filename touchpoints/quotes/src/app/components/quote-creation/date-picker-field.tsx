// @ts-nocheck
/* DatePickerField + TimePickerField — based on the Cycle Count Web
   pickers (`src/app/components/date-picker-field.tsx`), with one
   adaptation for our modal context: the open popover panels are
   `createPortal`-ed to `document.body` with fixed positioning so
   they escape the parent modal's `overflow: hidden` boundary and
   never get clipped at the modal edge.

   Notable choices preserved from the source:
     • MM/DD/YYYY trigger format.
     • Custom month + year dropdowns (white buttons with chevrons —
       no native `<select>` chrome).
     • 24-hour HH:MM time picker with hour column + 5-minute step
       minute column.
     • Pure inline-style implementation; no react-day-picker, no
       Radix Popover. */
import { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";

const FONT = "Inter, sans-serif";

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY_HEADERS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

const HOVER_STYLES = `
.dpf-day:not(:disabled):not(.dpf-selected):hover { background: var(--primary-50, rgba(59,130,246,0.08)) !important; }
.dpf-nav:hover { background: var(--surface-secondary, rgba(0,0,0,0.04)) !important; color: var(--foreground) !important; }
.dpf-hdr:hover { background: var(--surface-secondary, rgba(0,0,0,0.04)) !important; }
.dpf-dd-item:hover { background: var(--primary-50, rgba(59,130,246,0.08)) !important; color: var(--primary) !important; }
.tpf-item:hover { background: var(--primary-50, rgba(59,130,246,0.08)) !important; color: var(--primary) !important; }
`;

function daysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function startDayOfWeek(y: number, m: number) { return new Date(y, m, 1).getDay(); }
function sameDay(a: Date, b: Date) { return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }

type PopoverPos = { top: number; left: number; flipUp: boolean };

/* Compute a `position: fixed` placement for an overlay anchored at
   the given trigger. Flips upward when there isn't enough room
   below the trigger to fit the panel. Clamps horizontally so the
   panel never falls off either viewport edge. */
function computeAnchoredPos(trigger: HTMLElement, panelW: number, panelH: number): PopoverPos {
  const rect = trigger.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom;
  const flipUp = spaceBelow < panelH + 12 && rect.top > panelH + 12;
  const top = flipUp ? rect.top - 6 - panelH : rect.bottom + 6;
  let left = rect.left;
  if (left + panelW > window.innerWidth - 8) left = window.innerWidth - panelW - 8;
  if (left < 8) left = 8;
  return { top, left, flipUp };
}

interface DatePickerFieldProps {
  value?: Date;
  onChange: (d: Date | undefined) => void;
  minDate?: Date;
  placeholder?: string;
}

export function DatePickerField({ value, onChange, minDate, placeholder = "Select date" }: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const [focused, setFocused] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(value ? value.getMonth() : today.getMonth());
  const [viewYear, setViewYear] = useState(value ? value.getFullYear() : today.getFullYear());
  const [monthOpen, setMonthOpen] = useState(false);
  const [yearOpen, setYearOpen] = useState(false);
  const monthRef = useRef<HTMLDivElement>(null);
  const yearRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<PopoverPos>({ top: 0, left: 0, flipUp: false });

  const PANEL_W = 280;
  const PANEL_H = 360;

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    setPos(computeAnchoredPos(triggerRef.current, PANEL_W, PANEL_H));
  }, []);

  /* Layout effect, not effect: the panel mounts at whatever coordinates the
     last open left behind, so measuring after paint let it flash in the wrong
     place and jump. Measuring in the same commit removes that. */
  useLayoutEffect(() => {
    if (!open) return;
    updatePos();
    const onScroll = () => updatePos();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, updatePos]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      const insideTrigger = wrapRef.current?.contains(t);
      const insidePanel = panelRef.current?.contains(t);
      if (open && !insideTrigger && !insidePanel) {
        setOpen(false); setMonthOpen(false); setYearOpen(false);
      }
      if (monthOpen && monthRef.current && !monthRef.current.contains(t)) setMonthOpen(false);
      if (yearOpen && yearRef.current && !yearRef.current.contains(t)) setYearOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, monthOpen, yearOpen]);

  useEffect(() => {
    if (open && value) { setViewMonth(value.getMonth()); setViewYear(value.getFullYear()); }
  }, [open]);

  const dim = daysInMonth(viewYear, viewMonth);
  const sdow = startDayOfWeek(viewYear, viewMonth);
  const prevDim = daysInMonth(viewYear, viewMonth - 1);
  const totalCells = Math.ceil((sdow + dim) / 7) * 7;

  const yearRange = useMemo(() => { const base = today.getFullYear(); const ys: number[] = []; for (let y = base - 5; y <= base + 10; y++) ys.push(y); return ys; }, []);

  const isDisabled = (d: Date) => {
    if (!minDate) return false;
    const a = new Date(d); a.setHours(0,0,0,0);
    const m = new Date(minDate); m.setHours(0,0,0,0);
    return a < m;
  };

  const goPrev = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); } else setViewMonth(viewMonth - 1); };
  const goNext = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); } else setViewMonth(viewMonth + 1); };

  const display = value ? `${String(value.getMonth()+1).padStart(2,"0")}/${String(value.getDate()).padStart(2,"0")}/${value.getFullYear()}` : "";

  const ddBtn: React.CSSProperties = { display:"flex", alignItems:"center", gap:"4px", padding:"4px 8px", borderRadius:"6px", border:"none", background:"transparent", cursor:"pointer", fontFamily:FONT, fontSize:"13px", fontWeight:500 as any, color:"var(--foreground)" };
  const ddPanel: React.CSSProperties = { position:"absolute", top:"calc(100% + 4px)", left:0, zIndex:60, background:"#FFFFFF", border:"1px solid var(--border)", borderRadius:"8px", boxShadow:"var(--elevation-popover, 0 8px 24px rgba(0,0,0,0.12))", maxHeight:"200px", overflowY:"auto", padding:"4px", minWidth:"100px" };
  const ddItem = (active: boolean): React.CSSProperties => ({ display:"block", width:"100%", padding:"6px 10px", borderRadius:"4px", border:"none", background: active?"var(--primary-50, rgba(59,130,246,0.08))":"transparent", cursor:"pointer", fontFamily:FONT, fontSize:"13px", fontWeight: active?600 as any:400 as any, color: active?"var(--primary)":"var(--foreground)", textAlign:"left" as const });

  return (
    <div ref={wrapRef} className="relative" style={{ width:"100%" }}>
      <style>{HOVER_STYLES}</style>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="flex items-center justify-between w-full transition-colors"
        style={{
          gap:"8px", padding:"8px 12px",
          borderRadius:"8px",
          border: focused || open ? "1.5px solid var(--primary)" : hover ? "1px solid var(--text-tertiary, #94A3B8)" : "1px solid var(--border)",
          background: "#FFFFFF",
          boxShadow: focused || open ? "0 0 0 3px rgba(59,130,246,0.15)" : "none",
          cursor:"pointer", fontFamily:FONT,
          height:"36px",
        }}
      >
        <span style={{ fontSize:"13px", color: value?"var(--foreground)":"var(--text-tertiary, #94A3B8)", fontFamily:FONT }}>
          {value ? display : placeholder}
        </span>
        <CalendarIcon size={14} style={{ color:"var(--text-tertiary, #94A3B8)", flexShrink:0 }} />
      </button>
      {open && createPortal(
        <div
          ref={panelRef}
          style={{
            position:"fixed", top: pos.top, left: pos.left, zIndex:12500,
            width: PANEL_W, background:"#FFFFFF",
            border:"1px solid var(--border)", borderRadius:"12px",
            boxShadow:"var(--elevation-popover, 0 8px 24px rgba(0,0,0,0.12))",
            padding:"12px",
          }}
        >
          <style>{HOVER_STYLES}</style>
          {/* Header */}
          <div className="flex items-center justify-between" style={{ marginBottom:"8px" }}>
            <button type="button" onClick={goPrev} className="dpf-nav transition-colors" style={{ display:"flex", alignItems:"center", justifyContent:"center", width:"28px", height:"28px", borderRadius:"6px", border:"none", background:"transparent", cursor:"pointer", color:"var(--text-secondary, #64748B)" }}>
              <ChevronLeft size={16} />
            </button>
            <div className="flex items-center" style={{ gap:"4px" }}>
              <div ref={monthRef} className="relative">
                <button type="button" onClick={() => { setMonthOpen(!monthOpen); setYearOpen(false); }} className="dpf-hdr transition-colors" style={ddBtn}>
                  <span>{MONTH_SHORT[viewMonth]}</span>
                  <ChevronDown size={12} style={{ color:"var(--text-tertiary, #94A3B8)" }} />
                </button>
                {monthOpen && (
                  <div style={ddPanel} className="scrollbar-thin scrollbar-auto-hide">
                    {MONTH_NAMES.map((m,i) => (
                      <button key={m} type="button" onClick={() => { setViewMonth(i); setMonthOpen(false); }} className="dpf-dd-item transition-colors" style={ddItem(viewMonth===i)}>{m}</button>
                    ))}
                  </div>
                )}
              </div>
              <div ref={yearRef} className="relative">
                <button type="button" onClick={() => { setYearOpen(!yearOpen); setMonthOpen(false); }} className="dpf-hdr transition-colors" style={ddBtn}>
                  <span>{viewYear}</span>
                  <ChevronDown size={12} style={{ color:"var(--text-tertiary, #94A3B8)" }} />
                </button>
                {yearOpen && (
                  <div style={ddPanel} className="scrollbar-thin scrollbar-auto-hide">
                    {yearRange.map((y) => (
                      <button key={y} type="button" onClick={() => { setViewYear(y); setYearOpen(false); }} className="dpf-dd-item transition-colors" style={ddItem(viewYear===y)}>{y}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <button type="button" onClick={goNext} className="dpf-nav transition-colors" style={{ display:"flex", alignItems:"center", justifyContent:"center", width:"28px", height:"28px", borderRadius:"6px", border:"none", background:"transparent", cursor:"pointer", color:"var(--text-secondary, #64748B)" }}>
              <ChevronRight size={16} />
            </button>
          </div>
          {/* Day headers */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7, 1fr)", marginBottom:"4px" }}>
            {DAY_HEADERS.map((d) => (
              <div key={d} style={{ textAlign:"center", fontSize:"12px", fontWeight:500 as any, color:"var(--text-tertiary, #94A3B8)", fontFamily:FONT, padding:"4px 0" }}>{d}</div>
            ))}
          </div>
          {/* Day grid */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7, 1fr)", gap:"2px" }}>
            {Array.from({ length: totalCells }).map((_, idx) => {
              const dayNum = idx - sdow + 1;
              let d: Date;
              let inMonth = true;
              if (dayNum < 1) { d = new Date(viewYear, viewMonth - 1, prevDim + dayNum); inMonth = false; }
              else if (dayNum > dim) { d = new Date(viewYear, viewMonth + 1, dayNum - dim); inMonth = false; }
              else { d = new Date(viewYear, viewMonth, dayNum); }
              const selected = value && sameDay(d, value);
              const isToday = sameDay(d, today);
              const disabled = isDisabled(d);
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={disabled}
                  className={`dpf-day transition-colors${selected ? " dpf-selected" : ""}`}
                  onClick={() => { if (disabled) return; onChange(d); setOpen(false); }}
                  style={{
                    display:"flex", alignItems:"center", justifyContent:"center",
                    width:"100%", height:"32px",
                    borderRadius:"9999px", border:"none",
                    background: selected ? "var(--primary)" : "transparent",
                    color: selected ? "var(--primary-foreground)" : !inMonth ? "var(--text-tertiary, #94A3B8)" : disabled ? "var(--text-tertiary, #94A3B8)" : "var(--foreground)",
                    opacity: disabled ? 0.4 : !inMonth ? 0.5 : 1,
                    cursor: disabled ? "not-allowed" : "pointer",
                    fontFamily:FONT, fontSize:"13px",
                    fontWeight: (selected || isToday) ? 600 as any : 400 as any,
                  }}
                >{d.getDate()}</button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

interface TimePickerFieldProps {
  value: string; // "HH:mm" or ""
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function TimePickerField({ value, onChange, disabled, placeholder = "--:--" }: TimePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hover, setHover] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<PopoverPos>({ top: 0, left: 0, flipUp: false });

  const PANEL_W = 140;
  const PANEL_H = 200;

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    setPos(computeAnchoredPos(triggerRef.current, PANEL_W, PANEL_H));
  }, []);

  /* Layout effect, not effect: the panel mounts at whatever coordinates the
     last open left behind, so measuring after paint let it flash in the wrong
     place and jump. Measuring in the same commit removes that. */
  useLayoutEffect(() => {
    if (!open) return;
    updatePos();
    const onScroll = () => updatePos();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, updatePos]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      const insideTrigger = wrapRef.current?.contains(t);
      const insidePanel = panelRef.current?.contains(t);
      if (open && !insideTrigger && !insidePanel) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const [h, m] = value ? value.split(":").map((x) => parseInt(x, 10)) : [null, null];
  const display = value ? `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}` : "";

  const colStyle: React.CSSProperties = { flex:1, maxHeight:"180px", overflowY:"auto", padding:"4px 0" };
  const itemStyle = (active: boolean): React.CSSProperties => ({
    display:"block", width:"100%", padding:"6px 0", textAlign:"center" as const,
    border:"none", background: active?"var(--primary-50, rgba(59,130,246,0.08))":"transparent",
    color: active?"var(--primary)":"var(--foreground)",
    cursor:"pointer", fontFamily:FONT, fontSize:"13px",
    fontWeight: active?600 as any:400 as any,
  });

  return (
    <div ref={wrapRef} className="relative" style={{ width:"100%" }}>
      <style>{HOVER_STYLES}</style>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className="flex items-center justify-between w-full transition-all"
        style={{
          gap:"8px", padding:"8px 12px",
          borderRadius:"8px",
          border: focused || open ? "1.5px solid var(--primary)" : hover && !disabled ? "1px solid var(--text-tertiary, #94A3B8)" : "1px solid var(--border)",
          background: disabled ? "#F8FAFC" : "#FFFFFF",
          cursor: disabled ? "not-allowed" : "pointer",
          fontFamily:FONT, height:"36px",
          boxShadow: focused || open ? "0 0 0 3px rgba(59,130,246,0.15)" : "none",
        }}
      >
        <span style={{ fontSize:"13px", color: value?"var(--foreground)":"var(--text-tertiary, #94A3B8)", fontFamily:FONT }}>
          {value ? display : placeholder}
        </span>
      </button>
      {open && !disabled && createPortal(
        <div
          ref={panelRef}
          style={{
            position:"fixed", top: pos.top, left: pos.left, zIndex:12500,
            width: PANEL_W,
            background:"#FFFFFF", border:"1px solid var(--border)",
            borderRadius:"8px", boxShadow:"var(--elevation-popover, 0 8px 24px rgba(0,0,0,0.12))",
            display:"flex", padding:"4px",
          }}
        >
          <style>{HOVER_STYLES}</style>
          <div style={colStyle} className="scrollbar-thin">
            {Array.from({ length: 24 }).map((_, hh) => (
              <button key={hh} type="button" className="tpf-item transition-colors" onClick={() => onChange(`${String(hh).padStart(2,"0")}:${String(m ?? 0).padStart(2,"0")}`)} style={itemStyle(h===hh)}>{String(hh).padStart(2,"0")}</button>
            ))}
          </div>
          <div style={{ width:"1px", background:"var(--border)" }} />
          <div style={colStyle} className="scrollbar-thin">
            {[0,5,10,15,20,25,30,35,40,45,50,55].map((mm) => (
              <button key={mm} type="button" className="tpf-item transition-colors" onClick={() => { onChange(`${String(h ?? 0).padStart(2,"0")}:${String(mm).padStart(2,"0")}`); setOpen(false); }} style={itemStyle(m===mm)}>{String(mm).padStart(2,"0")}</button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
