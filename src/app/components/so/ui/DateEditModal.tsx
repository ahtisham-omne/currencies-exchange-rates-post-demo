import { X, Calendar, Clock, Info } from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { format } from 'date-fns';

export type SODateType = 'request' | 'estShip' | 'dueDelivery';

export interface DateConfig {
  dateType: 'absolute' | 'relative';
  absoluteValue: string;
  relativeValue: string;
  relativeUnit: string;
}

interface DateEditModalProps {
  type: SODateType;
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: DateConfig) => void;
  initialConfig: DateConfig;
}

const TITLES: Record<SODateType, string> = {
  request: 'Order Date Configuration',
  estShip: 'Estimated Ship Date Configuration',
  dueDelivery: 'Due Delivery Date Configuration',
};

const DESCRIPTIONS: Record<SODateType, string> = {
  request: 'The date this sales order was placed by the customer',
  estShip: 'The estimated date when items will be shipped from the warehouse',
  dueDelivery: 'The date by which the customer expects to receive the goods',
};

export function DateEditModal({ type, isOpen, onClose, onSave, initialConfig }: DateEditModalProps) {
  const allowRelative = initialConfig.relativeUnit !== '__disable_relative__';
  const [dateType, setDateType] = useState(initialConfig.dateType || 'absolute');
  const [absoluteValue, setAbsoluteValue] = useState(initialConfig.absoluteValue || '');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    initialConfig.absoluteValue ? (() => {
      // Try parsing dd/mm/yyyy or mm/dd/yyyy format
      const parts = initialConfig.absoluteValue.split(/[/\s]/);
      if (parts.length >= 3) {
        const d = new Date(Number(parts[2]), Number(parts[0]) - 1, Number(parts[1]));
        return isNaN(d.getTime()) ? new Date() : d;
      }
      return new Date();
    })() : new Date()
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(selectedDate?.getMonth() ?? new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(selectedDate?.getFullYear() ?? new Date().getFullYear());
  const [selectedHour, setSelectedHour] = useState('12');
  const [selectedMinute, setSelectedMinute] = useState('00');
  const [relativeValue, setRelativeValue] = useState(initialConfig.relativeValue || '7');
  const [relativeUnit, setRelativeUnit] = useState(initialConfig.relativeUnit || 'days');

  if (!isOpen) return null;

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      const formattedDate = format(date, 'MM/dd/yyyy');
      setAbsoluteValue(`${formattedDate} ${selectedHour}:${selectedMinute}`);
    }
  };

  const handleTimeChange = (hour: string, minute: string) => {
    setSelectedHour(hour);
    setSelectedMinute(minute);
    if (selectedDate) {
      const formattedDate = format(selectedDate, 'MM/dd/yyyy');
      setAbsoluteValue(`${formattedDate} ${hour}:${minute}`);
    }
  };

  const handleSave = () => {
    onSave({ dateType: allowRelative ? dateType : 'absolute', absoluteValue, relativeValue, relativeUnit: allowRelative ? relativeUnit : 'days' });
    onClose();
  };

  const showRelativeToggle = allowRelative && (type === 'estShip' || type === 'dueDelivery');

  return createPortal(
    <>
      <div
        className="fixed inset-0 flex items-center justify-center"
        onClick={onClose}
        style={{ zIndex: 10001, backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(1px)' }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="bg-white p-6 w-full"
          style={{ borderRadius: '12px', maxWidth: '480px' }}
        >
          {/* Title and description */}
          <div className="mb-4">
            <h2 className="text-[14px] text-[#1F2937] mb-1" style={{ fontWeight: 600 }}>
              {TITLES[type]}
            </h2>
            <p className="text-[12px] text-[#6B7280]">
              {DESCRIPTIONS[type]}
            </p>
          </div>

          {/* Content */}
          <div className="space-y-4">
            {showRelativeToggle ? (
              <>
                {/* Date Type Toggle */}
                <div>
                  <label className="block text-[11px] text-[#6B7280] uppercase mb-2" style={{ fontWeight: 500, letterSpacing: '0.5px' }}>
                    Date Type
                  </label>
                  <div className="flex gap-0.5 bg-[#F3F4F6] p-0.5 rounded">
                    {(['absolute', 'relative'] as const).map(dt => (
                      <button
                        key={dt}
                        onClick={() => setDateType(dt)}
                        className={`flex-1 px-3 py-2 text-[13px] rounded transition-colors ${
                          dateType === dt
                            ? 'bg-white text-[#1F2937] shadow-sm'
                            : 'text-[#6B7280] hover:text-[#1F2937]'
                        }`}
                        style={{ fontWeight: 500 }}
                      >
                        {dt === 'absolute' ? 'Absolute Date' : 'Relative Date'}
                      </button>
                    ))}
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
                    selectedHour={selectedHour}
                    selectedMinute={selectedMinute}
                    onTimeChange={handleTimeChange}
                  />
                ) : (
                  <div>
                    <label className="block text-[11px] text-[#6B7280] uppercase mb-2" style={{ fontWeight: 500, letterSpacing: '0.5px' }}>
                      Relative Duration
                    </label>
                    <div className="grid grid-cols-[80px_1fr] gap-2">
                      <input
                        type="number"
                        value={relativeValue}
                        onChange={(e) => setRelativeValue(e.target.value)}
                        className="px-3 py-2.5 text-[13px] text-[#1F2937] border border-[#E5E7EB] rounded focus:outline-none focus:ring-2 focus:ring-[#93C5FD] focus:border-transparent text-center"
                        style={{ fontWeight: 500 }}
                        min="0"
                      />
                      <select
                        value={relativeUnit}
                        onChange={(e) => setRelativeUnit(e.target.value)}
                        className="px-3 py-2.5 text-[13px] text-[#6B7280] border border-[#E5E7EB] rounded focus:outline-none focus:ring-2 focus:ring-[#93C5FD] focus:border-transparent bg-white"
                      >
                        <option value="hours">Hours</option>
                        <option value="days">Days after order</option>
                        <option value="weeks">Weeks after order</option>
                        <option value="months">Months after order</option>
                      </select>
                    </div>
                    <p className="text-[12px] text-[#6B7280] mt-2">
                      {relativeValue} {relativeUnit} after order date
                    </p>
                  </div>
                )}
              </>
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
                selectedHour={selectedHour}
                selectedMinute={selectedMinute}
                onTimeChange={handleTimeChange}
              />
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-2 mt-6">
            <button
              onClick={onClose}
              className="flex-1 h-8 text-[13px] border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F9FAFB] transition-colors"
              style={{ borderRadius: '6px', fontWeight: 500 }}
            >
              Cancel <span className="text-[#9CA3AF] ml-1">Esc</span>
            </button>
            <button
              onClick={handleSave}
              className="flex-1 h-8 text-[13px] bg-[#1B6EF3] text-white hover:bg-[#0D5ED7] transition-colors"
              style={{ borderRadius: '6px', fontWeight: 500 }}
            >
              Save Changes <span className="opacity-75 ml-1">⌘S</span>
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

/* ═══ Shared Date Input + Calendar Picker ═══ */
function DateInputWithPicker({
  absoluteValue, onAbsoluteValueChange,
  selectedDate, onDateSelect,
  showDatePicker, onToggleDatePicker, onCloseDatePicker,
  selectedMonth, onMonthChange,
  selectedYear, onYearChange,
  selectedHour, selectedMinute, onTimeChange,
}: {
  absoluteValue: string;
  onAbsoluteValueChange: (v: string) => void;
  selectedDate: Date | undefined;
  onDateSelect: (d: Date | undefined) => void;
  showDatePicker: boolean;
  onToggleDatePicker: () => void;
  onCloseDatePicker: () => void;
  selectedMonth: number;
  onMonthChange: (m: number) => void;
  selectedYear: number;
  onYearChange: (y: number) => void;
  selectedHour: string;
  selectedMinute: string;
  onTimeChange: (h: string, m: string) => void;
}) {
  return (
    <div>
      <label className="block text-[11px] text-[#6B7280] uppercase mb-2" style={{ fontWeight: 500, letterSpacing: '0.5px' }}>
        Select Date & Time
      </label>
      <div className="relative">
        <input
          type="text"
          placeholder="mm/dd/yyyy hh:mm"
          value={absoluteValue}
          onChange={(e) => onAbsoluteValueChange(e.target.value)}
          className="w-full pl-3 pr-10 py-2.5 text-[13px] text-[#1F2937] border border-[#E5E7EB] rounded focus:outline-none focus:ring-2 focus:ring-[#93C5FD] focus:border-transparent placeholder:text-[#D1D5DB]"
        />
        <button
          type="button"
          onClick={onToggleDatePicker}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded hover:bg-[#F3F4F6] transition-colors"
        >
          <Calendar className="w-4 h-4 text-[#6B7280]" />
        </button>
      </div>

      {/* Date Picker Overlay */}
      {showDatePicker && (
        <div
          className="absolute z-[60] mt-2 bg-white rounded-lg shadow-lg border border-[#E5E7EB] p-4"
          style={{ width: '320px' }}
        >
          {/* Month and Year Selection */}
          <div className="flex gap-2 mb-3">
            <select
              value={selectedMonth}
              onChange={(e) => {
                onMonthChange(Number(e.target.value));
              }}
              className="flex-1 px-2 py-1.5 text-[12px] text-[#1F2937] border border-[#E5E7EB] rounded focus:outline-none focus:ring-2 focus:ring-[#93C5FD] bg-white"
              style={{ fontWeight: 500 }}
            >
              {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((month, idx) => (
                <option key={idx} value={idx}>{month}</option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => {
                onYearChange(Number(e.target.value));
              }}
              className="w-20 px-2 py-1.5 text-[12px] text-[#1F2937] border border-[#E5E7EB] rounded focus:outline-none focus:ring-2 focus:ring-[#93C5FD] bg-white"
              style={{ fontWeight: 500 }}
            >
              {Array.from({ length: 20 }, (_, i) => new Date().getFullYear() - 5 + i).map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          {/* Calendar */}
          <div
            style={{
              '--rdp-accent-color': '#1B6EF3',
              '--rdp-background-color': '#F0F7FF',
            } as any}
          >
            <style>{`
              .so-date-picker .rdp-day_selected {
                background-color: #1B6EF3 !important;
                color: white !important;
              }
              .so-date-picker .rdp-day_today {
                font-weight: 600;
              }
              .so-date-picker .rdp-button:hover:not(.rdp-day_selected) {
                background-color: #F9FAFB;
              }
              .so-date-picker .rdp {
                margin: 0;
                font-size: 13px;
              }
              .so-date-picker .rdp-caption {
                display: none;
              }
              .so-date-picker .rdp-head_cell {
                color: #6B7280;
                font-size: 11px;
                font-weight: 500;
                text-transform: uppercase;
              }
            `}</style>
            <DayPicker
              mode="single"
              selected={selectedDate}
              onSelect={onDateSelect}
              month={new Date(selectedYear, selectedMonth)}
              className="so-date-picker"
            />
          </div>

          {/* Time Selection */}
          <div className="mt-3 pt-3 border-t border-[#E5E7EB]">
            <label className="block text-[11px] text-[#6B7280] uppercase mb-2" style={{ fontWeight: 500, letterSpacing: '0.5px' }}>
              Time
            </label>
            <div className="flex gap-2 items-center">
              <select
                value={selectedHour}
                onChange={(e) => onTimeChange(e.target.value, selectedMinute)}
                className="flex-1 px-2 py-1.5 text-[13px] text-[#1F2937] border border-[#E5E7EB] rounded focus:outline-none focus:ring-2 focus:ring-[#93C5FD] bg-white text-center"
                style={{ fontWeight: 500 }}
              >
                {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map(hour => (
                  <option key={hour} value={hour}>{hour}</option>
                ))}
              </select>
              <span className="text-[#6B7280]">:</span>
              <select
                value={selectedMinute}
                onChange={(e) => onTimeChange(selectedHour, e.target.value)}
                className="flex-1 px-2 py-1.5 text-[13px] text-[#1F2937] border border-[#E5E7EB] rounded focus:outline-none focus:ring-2 focus:ring-[#93C5FD] bg-white text-center"
                style={{ fontWeight: 500 }}
              >
                {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(minute => (
                  <option key={minute} value={minute}>{minute}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Apply Button */}
          <button
            onClick={onCloseDatePicker}
            className="w-full mt-3 px-3 py-1.5 text-[13px] text-white bg-[#1B6EF3] rounded hover:bg-[#0D5ED7] transition-colors"
            style={{ fontWeight: 500 }}
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
