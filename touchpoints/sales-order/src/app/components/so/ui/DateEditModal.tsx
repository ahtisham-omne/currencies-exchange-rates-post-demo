import { Calendar, CalendarDays, Clock3 } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { DatePickerField } from '../date-picker-field';
import { format } from 'date-fns';
import { BaseModal, ModalSecondaryButton, ModalPrimaryButton } from '@/app/components/shared/BaseModal';
import { Input } from '@/app/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { RelativeDateValue } from "@/app/components/shared/RelativeDateValue";

export type SODateType = 'request' | 'estShip' | 'dueDelivery';

export interface DateConfig {
  dateType: 'absolute' | 'relative';
  absoluteValue: string;
  relativeValue: string;
  relativeUnit: string;
  /** Used only by `dueDelivery` — Expected Delivery is a date range
   *  (e.g. 05/29 → 05/30 for a 1-2 day Express Air method). When set
   *  the end of the range; otherwise treated as a single date. */
  absoluteEndValue?: string;
}

interface DateEditModalProps {
  type: SODateType;
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: DateConfig) => void;
  initialConfig: DateConfig;
}

const TITLES: Record<SODateType, string> = {
  request: 'Requested On Configuration',
  estShip: 'Estimated Ship Date Configuration',
  dueDelivery: 'Due Delivery Date Configuration',
};

const DESCRIPTIONS: Record<SODateType, string> = {
  request: 'The date this sales order was placed by the customer',
  estShip: 'The estimated date when items will be shipped from the warehouse',
  /* Expected Delivery is a range now — defaults to Ship By + the
     carrier method's transit window (e.g. Express Air 1–2 days).
     Editable, but the default surfaces what the carrier promised. */
  dueDelivery: 'The window in which the customer should receive the goods. Defaults to ship-by plus the carrier method\'s transit days.',
};

function parseMDY(value: string): Date | undefined {
  if (!value) return undefined;
  const parts = value.split(/[/\s]/);
  if (parts.length < 3) return undefined;
  const d = new Date(Number(parts[2]), Number(parts[0]) - 1, Number(parts[1]));
  return isNaN(d.getTime()) ? undefined : d;
}

export function DateEditModal({ type, isOpen, onClose, onSave, initialConfig }: DateEditModalProps) {
  const allowRelative = initialConfig.relativeUnit !== '__disable_relative__';
  const [dateType, setDateType] = useState(initialConfig.dateType || 'absolute');
  const [absoluteValue, setAbsoluteValue] = useState(initialConfig.absoluteValue || '');
  /* End-of-range value — only used when type === 'dueDelivery'.
     Seeded from `initialConfig.absoluteEndValue` so the sidebar can
     hand us the carrier-derived delivery window default. */
  const [absoluteEndValue, setAbsoluteEndValue] = useState(initialConfig.absoluteEndValue || '');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(parseMDY(initialConfig.absoluteValue) ?? new Date());
  const [selectedEndDate, setSelectedEndDate] = useState<Date | undefined>(parseMDY(initialConfig.absoluteEndValue));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(selectedDate?.getMonth() ?? new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(selectedDate?.getFullYear() ?? new Date().getFullYear());
  const [relativeValue, setRelativeValue] = useState(initialConfig.relativeValue || '7');
  const [relativeUnit, setRelativeUnit] = useState(initialConfig.relativeUnit || 'days');

  /* Expected Delivery is now a date range — no absolute/relative toggle.
     Defaults to Ship By + carrier method transit days (caller supplies
     the default via initialConfig). Editable, but the inline picker
     mirrors the Freight & Logistics modal's `DatePickerRange`. */
  const isRange = type === 'dueDelivery';

  if (!isOpen) return null;

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      setAbsoluteValue(format(date, 'MM/dd/yyyy'));
    }
  };

  const handleSave = () => {
    if (isRange) {
      /* Date-range save — both fields are absolute, no relative.
         absoluteEndValue carries the second date. */
      onSave({
        dateType: 'absolute',
        absoluteValue,
        absoluteEndValue,
        relativeValue: '',
        relativeUnit: 'days',
      });
    } else {
      onSave({ dateType: allowRelative ? dateType : 'absolute', absoluteValue, relativeValue, relativeUnit: allowRelative ? relativeUnit : 'days' });
    }
    onClose();
  };

  /* Relative toggle now only applies to `estShip`. `dueDelivery` uses
     the date-range UI below; `request` stays absolute-only. */
  const showRelativeToggle = allowRelative && type === 'estShip';

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={TITLES[type]}
      subtitle={DESCRIPTIONS[type]}
      icon={<Calendar />}
      width="md"
      footer={
        <>
          <ModalSecondaryButton onClick={onClose}>Cancel</ModalSecondaryButton>
          <ModalPrimaryButton onClick={handleSave}>Save Changes</ModalPrimaryButton>
        </>
      }
    >
      {/* Wrap form sections in a white card so inputs and selects
          don't blend into the modal body's gray surface. */}
      <div
        className="flex flex-col rounded-lg border bg-white"
        style={{ gap: 16, padding: 16, borderColor: 'var(--border)' }}
      >
        {showRelativeToggle ? (
          <>
            <div>
              <label className="block" style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', marginBottom: 8 }}>
                Date Type
              </label>
              {/* Partner-style radio cards. Same visual language as the
                  customer/vendor selector in the Partner creation flow:
                  two side-by-side cards, primary-tinted border + soft
                  outer glow on the selected card, a radio dot on the
                  left and a short helper sentence below the label. */}
              <div className="grid grid-cols-2" style={{ gap: 10 }}>
                {(['absolute', 'relative'] as const).map(dt => {
                  const selected = dateType === dt;
                  const meta = dt === 'absolute'
                    ? { label: 'Absolute Date', desc: 'Pick a specific calendar date and time.', Icon: CalendarDays }
                    : { label: 'Relative Date', desc: 'N days, weeks or months after the order date.', Icon: Clock3 };
                  const Icon = meta.Icon;
                  return (
                    <button
                      key={dt}
                      type="button"
                      onClick={() => setDateType(dt)}
                      className="group flex items-start text-left transition-all"
                      style={{
                        padding: 12,
                        borderRadius: 10,
                        background: '#FFFFFF',
                        border: selected ? '1px solid var(--primary)' : '1px solid var(--border)',
                        boxShadow: selected
                          ? '0 0 0 3px rgba(10, 119, 255, 0.10)'
                          : '0 1px 2px rgba(15, 23, 42, 0.04)',
                        cursor: 'pointer',
                        gap: 12,
                      }}
                    >
                      {/* Icon badge — Partner customer/vendor card pattern. */}
                      <div
                        className="flex items-center justify-center shrink-0 transition-all duration-200"
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          background: selected
                            ? 'linear-gradient(135deg, #DBEAFE 0%, #BFDBFE 100%)'
                            : 'linear-gradient(135deg, var(--accent) 0%, #DBEAFE 100%)',
                          color: selected ? '#1D4ED8' : 'var(--primary)',
                        }}
                      >
                        <Icon style={{ width: 18, height: 18 }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center" style={{ gap: 8 }}>
                          <span
                            style={{
                              width: 14,
                              height: 14,
                              borderRadius: '50%',
                              border: selected ? '4px solid var(--primary)' : '2px solid #CBD5E1',
                              transition: 'border 0.15s ease',
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ fontSize: 13, fontWeight: 600, color: selected ? 'var(--primary)' : 'var(--foreground)' }}>
                            {meta.label}
                          </span>
                        </div>
                        <p style={{ fontSize: 11, color: selected ? '#60A5FA' : 'var(--muted-foreground)', marginTop: 4, lineHeight: 1.4 }}>
                          {meta.desc}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {dateType === 'absolute' ? (
              <DateInputWithPicker
                absoluteValue={absoluteValue}
                onAbsoluteValueChange={setAbsoluteValue}
                selectedDate={selectedDate}
                onDateSelect={handleDateSelect}
                showDatePicker={showDatePicker}
                onToggleDatePicker={() => setShowDatePicker(!showDatePicker)}
                onCloseDatePicker={() => setShowDatePicker(false)}
                selectedMonth={selectedMonth}
                onMonthChange={setSelectedMonth}
                selectedYear={selectedYear}
                onYearChange={setSelectedYear}
              />
            ) : (
              <div>
                <label className="block" style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', marginBottom: 8 }}>
                  Relative Duration
                </label>
                <div className="grid grid-cols-[80px_1fr]" style={{ gap: 8 }}>
                  <Input
                    type="number"
                    value={relativeValue}
                    onChange={(e) => setRelativeValue(e.target.value)}
                    className="text-center bg-white !h-10 rounded-lg border-border focus:border-primary focus:ring-1 focus:ring-primary/20"
                    min="0"
                  />
                  <Select value={relativeUnit} onValueChange={setRelativeUnit}>
                    <SelectTrigger className="bg-white !h-10 rounded-lg border-border focus:border-primary focus:ring-1 focus:ring-primary/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hours">Hours</SelectItem>
                      <SelectItem value="days">Days after order</SelectItem>
                      <SelectItem value="weeks">Weeks after order</SelectItem>
                      <SelectItem value="months">Months after order</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* The inputs already state the rule, so the line under them
                    shows the day it lands on, carrying the same marker the
                    configuration cards use for a relative date. */}
                <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>Resolves to</span>
                  <RelativeDateValue
                    display={resolveRelative(relativeValue, relativeUnit)}
                    rule={`${relativeValue} ${relativeUnit} after the order date`}
                    anchor="the order date"
                  />
                </p>
              </div>
            )}
          </>
        ) : isRange ? (
          /* Expected Delivery — date range. Two DatePickerFields
             side-by-side, mirroring the Freight & Logistics modal's
             DatePickerRange. End date can't predate the start; both
             default to the caller-provided shipBy + carrier method
             transit window. No relative toggle here. */
          <div>
            <label className="block" style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', marginBottom: 8 }}>
              Delivery window
            </label>
            <div className="flex items-center" style={{ gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <DatePickerField
                  value={selectedDate}
                  onChange={(d) => {
                    setSelectedDate(d);
                    setAbsoluteValue(d ? format(d, 'MM/dd/yyyy') : '');
                  }}
                  placeholder="MM/DD/YYYY"
                />
              </div>
              <span style={{ fontSize: 12, color: '#94A3B8' }}>→</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <DatePickerField
                  value={selectedEndDate}
                  onChange={(d) => {
                    setSelectedEndDate(d);
                    setAbsoluteEndValue(d ? format(d, 'MM/dd/yyyy') : '');
                  }}
                  minDate={selectedDate}
                  placeholder="MM/DD/YYYY"
                />
              </div>
            </div>
            <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 8, lineHeight: 1.4 }}>
              Default range is the Ship By date plus the selected carrier method's transit days.
              Edit either field to override.
            </p>
          </div>
        ) : (
          /* Request/Order date — only absolute */
          <DateInputWithPicker
            absoluteValue={absoluteValue}
            onAbsoluteValueChange={setAbsoluteValue}
            selectedDate={selectedDate}
            onDateSelect={handleDateSelect}
            showDatePicker={showDatePicker}
            onToggleDatePicker={() => setShowDatePicker(!showDatePicker)}
            onCloseDatePicker={() => setShowDatePicker(false)}
            selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
            selectedYear={selectedYear}
            onYearChange={setSelectedYear}
          />
        )}
      </div>
    </BaseModal>
  );
}

/* ═══ Shared Date Input ═══
 * Renders the Cycle Count `DatePickerField` with a label. Time is
 * intentionally not configurable from this surface — timeline
 * dates (Request, Estimated Ship, Due Delivery) only carry a date,
 * not a wall-clock time. Old overlay/portal/time-state props are
 * kept optional so the parent call site doesn't have to change. */
function DateInputWithPicker({
  selectedDate, onDateSelect,
}: {
  absoluteValue?: string;
  onAbsoluteValueChange?: (v: string) => void;
  selectedDate: Date | undefined;
  onDateSelect: (d: Date | undefined) => void;
  showDatePicker?: boolean;
  onToggleDatePicker?: () => void;
  onCloseDatePicker?: () => void;
  selectedMonth?: number;
  onMonthChange?: (m: number) => void;
  selectedYear?: number;
  onYearChange?: (y: number) => void;
  selectedHour?: string;
  selectedMinute?: string;
  onTimeChange?: (h: string, m: string) => void;
}) {
  return (
    <div>
      <label className="block" style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', marginBottom: 8 }}>
        Select Date
      </label>
      <DatePickerField
        value={selectedDate}
        onChange={(d) => onDateSelect(d)}
        placeholder="MM/DD/YYYY"
      />
    </div>
  );
}

/* The day a relative rule lands on when counted from today, so the editor can
   show the resolved date the way the configuration cards do. */
function resolveRelative(value: string, unit: string): string {
  const d = new Date();
  const n = Number(value) || 0;
  if (/week/i.test(unit)) d.setDate(d.getDate() + n * 7);
  else if (/month/i.test(unit)) d.setMonth(d.getMonth() + n);
  else if (/hour/i.test(unit)) d.setHours(d.getHours() + n);
  else d.setDate(d.getDate() + n);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
}