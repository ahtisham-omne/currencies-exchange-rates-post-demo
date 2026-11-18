import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Calendar, ChevronsUpDown } from "lucide-react";

interface DatePickerInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function parseDateStr(str: string): Date | null {
  const match = str.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) return null;
  const d = parseInt(match[1], 10);
  const m = parseInt(match[2], 10) - 1;
  const y = parseInt(match[3], 10);
  const date = new Date(y, m, d);
  if (date.getFullYear() === y && date.getMonth() === m && date.getDate() === d) return date;
  return null;
}

function formatDate(date: Date): string {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${m}/${d}/${y}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

type PickerView = "days" | "months" | "years";

export function DatePickerInput({ value, onChange, placeholder = "MM/DD/YYYY", className = "" }: DatePickerInputProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const parsed = useMemo(() => parseDateStr(value), [value]);
  const today = useMemo(() => new Date(), []);

  const [viewYear, setViewYear] = useState(parsed ? parsed.getFullYear() : today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed ? parsed.getMonth() : today.getMonth());
  const [pickerView, setPickerView] = useState<PickerView>("days");

  // Position state
  const [pos, setPos] = useState({ top: 0, left: 0, openUp: false });

  // Calculate position
  const updatePosition = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dropdownH = 360;
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < dropdownH && spaceAbove > spaceBelow;

    setPos({
      top: openUp ? rect.top - dropdownH - 4 : rect.bottom + 4,
      left: rect.left,
      openUp,
    });
  }, []);

  useEffect(() => {
    if (open) {
      if (parsed) {
        setViewYear(parsed.getFullYear());
        setViewMonth(parsed.getMonth());
      } else {
        // For DOB, default to ~25 years ago
        setViewYear(today.getFullYear() - 25);
        setViewMonth(today.getMonth());
      }
      setPickerView("days");
      updatePosition();
    }
  }, [open, parsed, today, updatePosition]);

  // Reposition on scroll/resize
  useEffect(() => {
    if (!open) return;
    const handler = () => updatePosition();
    window.addEventListener("scroll", handler, true);
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("scroll", handler, true);
      window.removeEventListener("resize", handler);
    };
  }, [open, updatePosition]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current?.contains(e.target as Node) ||
        dropdownRef.current?.contains(e.target as Node)
      ) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const prevMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 0) { setViewYear((y) => y - 1); return 11; }
      return m - 1;
    });
  }, []);

  const nextMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 11) { setViewYear((y) => y + 1); return 0; }
      return m + 1;
    });
  }, []);

  const selectDate = useCallback((day: number) => {
    const date = new Date(viewYear, viewMonth, day);
    onChange(formatDate(date));
    setOpen(false);
  }, [viewYear, viewMonth, onChange]);

  const selectMonth = useCallback((month: number) => {
    setViewMonth(month);
    setPickerView("days");
  }, []);

  const selectYear = useCallback((year: number) => {
    setViewYear(year);
    setPickerView("months");
  }, []);

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

  const calendarDays = useMemo(() => {
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    return days;
  }, [firstDay, daysInMonth]);

  const isSelected = (day: number) =>
    parsed !== null && parsed.getFullYear() === viewYear && parsed.getMonth() === viewMonth && parsed.getDate() === day;

  const isToday = (day: number) =>
    today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === day;

  const isFutureDate = (day: number) => {
    const date = new Date(viewYear, viewMonth, day);
    return date > today;
  };

  // Year range for DOB (100 years back)
  const yearRange = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let y = currentYear; y >= currentYear - 100; y--) years.push(y);
    return years;
  }, []);

  // Decade range for year grid
  const yearDecadeStart = Math.floor(viewYear / 20) * 20;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          className={className}
        />
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-[#94A3B8] hover:text-[#64748B] transition-colors cursor-pointer"
          tabIndex={-1}
        >
          <Calendar className="w-4 h-4" />
        </button>
      </div>

      {open && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[100] bg-white border border-[#E2E8F0] rounded-xl overflow-hidden"
          style={{
            top: pos.top,
            left: pos.left,
            width: 296,
            boxShadow: "0 8px 30px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)",
            animation: pos.openUp
              ? "slideDown 0.15s ease-out"
              : "slideUp 0.15s ease-out",
          }}
        >
          {pickerView === "years" ? (
            /* ── Year Grid ── */
            <div className="p-3">
              <div className="flex items-center justify-between mb-2.5">
                <button
                  onClick={() => setViewYear((y) => y - 20)}
                  className="w-7 h-7 rounded-md flex items-center justify-center text-[#64748B] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-[13px] text-[#0F172A]" style={{ fontWeight: 600 }}>
                  {yearDecadeStart} – {yearDecadeStart + 19}
                </span>
                <button
                  onClick={() => setViewYear((y) => y + 20)}
                  className="w-7 h-7 rounded-md flex items-center justify-center text-[#64748B] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-1 max-h-[240px] overflow-y-auto">
                {yearRange.filter(y => y >= yearDecadeStart && y < yearDecadeStart + 20).length > 0
                  ? Array.from({ length: 20 }, (_, i) => yearDecadeStart + i).reverse().map((y) => (
                    <button
                      key={y}
                      onClick={() => selectYear(y)}
                      className={`py-2 rounded-[8px] text-[12.5px] transition-all cursor-pointer ${
                        y === viewYear
                          ? "bg-[#007FFF] text-white shadow-sm"
                          : y === today.getFullYear()
                          ? "bg-[#EDF4FF] text-[#007FFF]"
                          : y > today.getFullYear()
                          ? "text-[#CBD5E1] cursor-not-allowed"
                          : "hover:bg-[#F1F5F9] text-[#334155]"
                      }`}
                      style={{ fontWeight: y === viewYear ? 600 : 450 }}
                      disabled={y > today.getFullYear()}
                    >
                      {y}
                    </button>
                  ))
                  : yearRange.slice(0, 20).map((y) => (
                    <button
                      key={y}
                      onClick={() => selectYear(y)}
                      className={`py-2 rounded-[8px] text-[12.5px] transition-all cursor-pointer ${
                        y === viewYear ? "bg-[#007FFF] text-white shadow-sm" : "hover:bg-[#F1F5F9] text-[#334155]"
                      }`}
                      style={{ fontWeight: y === viewYear ? 600 : 450 }}
                    >
                      {y}
                    </button>
                  ))
                }
              </div>
            </div>
          ) : pickerView === "months" ? (
            /* ── Month Grid ── */
            <div className="p-3">
              <div className="flex items-center justify-between mb-2.5">
                <button
                  onClick={() => setViewYear((y) => y - 1)}
                  className="w-7 h-7 rounded-md flex items-center justify-center text-[#64748B] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPickerView("years")}
                  className="text-[13px] text-[#0F172A] hover:text-[#007FFF] transition-colors cursor-pointer flex items-center gap-1"
                  style={{ fontWeight: 600 }}
                >
                  {viewYear}
                  <ChevronsUpDown className="w-3 h-3 text-[#94A3B8]" />
                </button>
                <button
                  onClick={() => setViewYear((y) => y + 1)}
                  className="w-7 h-7 rounded-md flex items-center justify-center text-[#64748B] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
                  disabled={viewYear >= today.getFullYear()}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {MONTHS_SHORT.map((m, i) => {
                  const isFuture = viewYear === today.getFullYear() && i > today.getMonth();
                  return (
                    <button
                      key={m}
                      onClick={() => !isFuture && selectMonth(i)}
                      disabled={isFuture}
                      className={`py-2.5 rounded-[8px] text-[12.5px] transition-all cursor-pointer ${
                        i === viewMonth && viewYear === (parsed?.getFullYear() ?? -1)
                          ? "bg-[#007FFF] text-white shadow-sm"
                          : i === today.getMonth() && viewYear === today.getFullYear()
                          ? "bg-[#EDF4FF] text-[#007FFF]"
                          : isFuture
                          ? "text-[#CBD5E1] cursor-not-allowed"
                          : "hover:bg-[#F1F5F9] text-[#334155]"
                      }`}
                      style={{ fontWeight: i === viewMonth ? 560 : 450 }}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* ── Day Grid ── */
            <>
              {/* Header with month/year drill-down */}
              <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[#F1F5F9]">
                <button
                  onClick={prevMonth}
                  className="w-7 h-7 rounded-md flex items-center justify-center text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A] transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPickerView("months")}
                    className="text-[13px] text-[#007FFF] bg-[#EDF4FF] hover:bg-[#D6E8FF] transition-colors cursor-pointer px-2 py-1 rounded-md"
                    style={{ fontWeight: 580 }}
                  >
                    {MONTHS[viewMonth]}
                  </button>
                  <button
                    onClick={() => setPickerView("years")}
                    className="text-[13px] text-[#007FFF] bg-[#EDF4FF] hover:bg-[#D6E8FF] transition-colors cursor-pointer px-2 py-1 rounded-md"
                    style={{ fontWeight: 580 }}
                  >
                    {viewYear}
                  </button>
                </div>
                <button
                  onClick={nextMonth}
                  className="w-7 h-7 rounded-md flex items-center justify-center text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A] transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Day names */}
              <div className="grid grid-cols-7 px-3 pt-2">
                {DAYS.map((d) => (
                  <div key={d} className="text-center py-1 text-[10.5px] text-[#94A3B8]" style={{ fontWeight: 500 }}>
                    {d}
                  </div>
                ))}
              </div>

              {/* Day grid */}
              <div className="grid grid-cols-7 px-3 pb-2.5">
                {calendarDays.map((day, i) =>
                  day === null ? (
                    <div key={`empty-${i}`} />
                  ) : (
                    <button
                      key={day}
                      onClick={() => !isFutureDate(day) && selectDate(day)}
                      disabled={isFutureDate(day)}
                      className={`w-full aspect-square rounded-[8px] flex items-center justify-center text-[12.5px] transition-all cursor-pointer ${
                        isSelected(day)
                          ? "bg-[#007FFF] text-white shadow-sm"
                          : isToday(day)
                          ? "bg-[#EDF4FF] text-[#007FFF]"
                          : isFutureDate(day)
                          ? "text-[#CBD5E1] cursor-not-allowed"
                          : "text-[#334155] hover:bg-[#F1F5F9]"
                      }`}
                      style={{ fontWeight: isSelected(day) ? 600 : isToday(day) ? 550 : 430 }}
                    >
                      {day}
                    </button>
                  )
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-[#F1F5F9] px-3.5 py-2 flex items-center justify-between">
                <button
                  onClick={() => {
                    onChange(formatDate(today));
                    setOpen(false);
                  }}
                  className="text-[11.5px] text-[#007FFF] hover:underline cursor-pointer"
                  style={{ fontWeight: 500 }}
                >
                  Today
                </button>
                {value && (
                  <button
                    onClick={() => { onChange(""); setOpen(false); }}
                    className="text-[11.5px] text-[#94A3B8] hover:text-[#64748B] cursor-pointer"
                    style={{ fontWeight: 450 }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
