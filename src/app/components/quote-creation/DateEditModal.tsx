import { X, Calendar, Clock, Info } from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { format } from 'date-fns';

interface DateEditModalProps {
  type: 'request' | 'respond' | 'effective' | 'expiry';
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: any) => void;
  initialConfig: any;
}

export function DateEditModal({ type, isOpen, onClose, onSave, initialConfig }: DateEditModalProps) {
  const [dateType, setDateType] = useState(initialConfig.dateType || 'absolute');
  const [absoluteValue, setAbsoluteValue] = useState(initialConfig.absoluteValue || '');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    initialConfig.absoluteValue ? new Date(initialConfig.absoluteValue.split('/').reverse().join('-')) : new Date()
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedHour, setSelectedHour] = useState('12');
  const [selectedMinute, setSelectedMinute] = useState('00');
  const [relativeValue, setRelativeValue] = useState(initialConfig.relativeValue || '7');
  const [relativeUnit, setRelativeUnit] = useState(initialConfig.relativeUnit || 'days');
  const [whenSent, setWhenSent] = useState(initialConfig.whenSent !== undefined ? initialConfig.whenSent : false);
  const [hasExpiry, setHasExpiry] = useState(initialConfig.hasExpiry !== undefined ? initialConfig.hasExpiry : true);

  if (!isOpen) return null;

  const titles = {
    request: 'Request Date Configuration',
    respond: 'Respond By Configuration',
    effective: 'Effective From Configuration',
    expiry: 'Expiry Date Configuration'
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      const formattedDate = format(date, 'dd/MM/yyyy');
      setAbsoluteValue(`${formattedDate} ${selectedHour}:${selectedMinute}`);
    }
  };

  const handleTimeChange = (hour: string, minute: string) => {
    setSelectedHour(hour);
    setSelectedMinute(minute);
    if (selectedDate) {
      const formattedDate = format(selectedDate, 'dd/MM/yyyy');
      setAbsoluteValue(`${formattedDate} ${hour}:${minute}`);
    }
  };

  const handleSave = () => {
    onSave({
      dateType,
      absoluteValue,
      relativeValue,
      relativeUnit,
      whenSent,
      hasExpiry
    });
    onClose();
  };

  return createPortal(
    <>
      {/* Backdrop - Click to close */}
      <div
        className="fixed inset-0 flex items-center justify-center"
        onClick={onClose}
        style={{ zIndex: 10001, backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(1px)' }}
      >
        {/* White overlay card - Stop propagation to prevent closing when clicking inside */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="bg-white p-6 w-full"
          style={{
            borderRadius: '12px',
            maxWidth: '480px'
          }}
        >
          {/* Title and description */}
          <div className="mb-4">
            <h2 className="text-[14px] text-[#1F2937] mb-1" style={{ fontWeight: 600 }}>
              {titles[type]}
            </h2>
            <p className="text-[12px] text-[#6B7280]">
              {type === 'request' && 'The date the customer originally requested this quote'}
              {type === 'respond' && 'Deadline for internal team to send the quote to the customer'}
              {type === 'effective' && 'The date from which this quote\'s pricing and terms are valid'}
              {type === 'expiry' && 'The date after which this quote is no longer valid'}
            </p>
          </div>

          {/* Content */}
          <div className="space-y-4">
            {/* Effective Date: When Sent Toggle */}
            {type === 'effective' && (
              <div className="mb-4">
                <div className="flex items-center justify-between py-2.5 px-3 bg-[#F9FAFB] rounded">
                  <label className="text-[13px] text-[#1F2937]" style={{ fontWeight: 500 }}>
                    Effective when sent
                  </label>
                  <button
                    onClick={() => setWhenSent(!whenSent)}
                    className="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none"
                    style={{
                      backgroundColor: whenSent ? '#1B6EF3' : '#E5E7EB'
                    }}
                  >
                    <span
                      className="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out"
                      style={{
                        transform: whenSent ? 'translateX(16px)' : 'translateX(0)'
                      }}
                    />
                  </button>
                </div>
                {whenSent && (
                  <div className="flex items-start gap-2 py-2.5 px-3 bg-[#F0F7FF] border border-[#BFDBFE] rounded mt-3">
                    <Info className="w-4 h-4 text-[#1B6EF3] flex-shrink-0 mt-0.5" />
                    <p className="text-[12px] text-[#1F2937]">
                      Quote will be effective immediately when sent to the customer
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Expiry: No Expiry Toggle */}
            {type === 'expiry' && (
              <div className="mb-4">
                <div className="flex items-center justify-between py-2.5 px-3 bg-[#F9FAFB] rounded">
                  <label className="text-[13px] text-[#1F2937]" style={{ fontWeight: 500 }}>
                    No expiry date
                  </label>
                  <button
                    onClick={() => setHasExpiry(!hasExpiry)}
                    className="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none"
                    style={{
                      backgroundColor: !hasExpiry ? '#1B6EF3' : '#E5E7EB'
                    }}
                  >
                    <span
                      className="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out"
                      style={{
                        transform: !hasExpiry ? 'translateX(16px)' : 'translateX(0)'
                      }}
                    />
                  </button>
                </div>
                {!hasExpiry && (
                  <div className="flex items-start gap-2 py-2.5 px-3 bg-[#F0F7FF] border border-[#BFDBFE] rounded mt-3">
                    <Info className="w-4 h-4 text-[#1B6EF3] flex-shrink-0 mt-0.5" />
                    <p className="text-[12px] text-[#1F2937]">
                      Quote will remain valid indefinitely without an expiry date
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Show date configuration if not "when sent" and has expiry */}
            {((type !== 'effective' || !whenSent) && (type !== 'expiry' || hasExpiry)) && (
              <div className="space-y-4">
                {/* For Request Date: Only show absolute date input with picker (no toggle) */}
                {(type === 'request' || type === 'respond') ? (
                  <div>
                    <label className="block text-[11px] text-[#6B7280] uppercase mb-2" style={{ fontWeight: 500, letterSpacing: '0.5px' }}>
                      Select Date & Time
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="dd/mm/yyyy hh:mm"
                        value={absoluteValue}
                        onChange={(e) => setAbsoluteValue(e.target.value)}
                        className="w-full pl-3 pr-10 py-2.5 text-[13px] text-[#1F2937] border border-[#E5E7EB] rounded focus:outline-none focus:ring-2 focus:ring-[#93C5FD] focus:border-transparent placeholder:text-[#D1D5DB]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowDatePicker(!showDatePicker)}
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
                              setSelectedMonth(Number(e.target.value));
                              const newDate = new Date(selectedYear, Number(e.target.value), selectedDate?.getDate() || 1);
                              setSelectedDate(newDate);
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
                              setSelectedYear(Number(e.target.value));
                              const newDate = new Date(Number(e.target.value), selectedMonth, selectedDate?.getDate() || 1);
                              setSelectedDate(newDate);
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
                            .custom-date-picker .rdp-day_selected {
                              background-color: #1B6EF3 !important;
                              color: white !important;
                            }
                            .custom-date-picker .rdp-day_today {
                              font-weight: 600;
                            }
                            .custom-date-picker .rdp-button:hover:not(.rdp-day_selected) {
                              background-color: #F9FAFB;
                            }
                            .custom-date-picker .rdp {
                              margin: 0;
                              font-size: 13px;
                            }
                            .custom-date-picker .rdp-caption {
                              display: none;
                            }
                            .custom-date-picker .rdp-head_cell {
                              color: #6B7280;
                              font-size: 11px;
                              font-weight: 500;
                              text-transform: uppercase;
                            }
                          `}</style>
                          <DayPicker
                            mode="single"
                            selected={selectedDate}
                            onSelect={handleDateSelect}
                            month={new Date(selectedYear, selectedMonth)}
                            className="custom-date-picker"
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
                              onChange={(e) => handleTimeChange(e.target.value, selectedMinute)}
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
                              onChange={(e) => handleTimeChange(selectedHour, e.target.value)}
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
                          onClick={() => setShowDatePicker(false)}
                          className="w-full mt-3 px-3 py-1.5 text-[13px] text-white bg-[#1B6EF3] rounded hover:bg-[#0D5ED7] transition-colors"
                          style={{ fontWeight: 500 }}
                        >
                          Apply
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Date Type Toggle - Only for effective and expiry */}
                    <div>
                      <label className="block text-[11px] text-[#6B7280] uppercase mb-2" style={{ fontWeight: 500, letterSpacing: '0.5px' }}>
                        Date Type
                      </label>
                      <div className="flex gap-0.5 bg-[#F3F4F6] p-0.5 rounded">
                        <button
                          onClick={() => setDateType('absolute')}
                          className={`flex-1 px-3 py-2 text-[13px] rounded transition-colors ${
                            dateType === 'absolute'
                              ? 'bg-white text-[#1F2937] shadow-sm'
                              : 'text-[#6B7280] hover:text-[#1F2937]'
                          }`}
                          style={{ fontWeight: 500 }}
                        >
                          Absolute Date
                        </button>
                        <button
                          onClick={() => setDateType('relative')}
                          className={`flex-1 px-3 py-2 text-[13px] rounded transition-colors ${
                            dateType === 'relative'
                              ? 'bg-white text-[#1F2937] shadow-sm'
                              : 'text-[#6B7280] hover:text-[#1F2937]'
                          }`}
                          style={{ fontWeight: 500 }}
                        >
                          Relative Date
                        </button>
                      </div>
                    </div>

                    {/* Date Input - Conditional based on type */}
                    {dateType === 'absolute' ? (
                      <div>
                        <label className="block text-[11px] text-[#6B7280] uppercase mb-2" style={{ fontWeight: 500, letterSpacing: '0.5px' }}>
                          Select Date & Time
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="dd/mm/yyyy hh:mm"
                            value={absoluteValue}
                            onChange={(e) => setAbsoluteValue(e.target.value)}
                            className="w-full pl-3 pr-10 py-2.5 text-[13px] text-[#1F2937] border border-[#E5E7EB] rounded focus:outline-none focus:ring-2 focus:ring-[#93C5FD] focus:border-transparent placeholder:text-[#D1D5DB]"
                          />
                          <button
                            type="button"
                            onClick={() => setShowDatePicker(!showDatePicker)}
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
                                  setSelectedMonth(Number(e.target.value));
                                  const newDate = new Date(selectedYear, Number(e.target.value), selectedDate?.getDate() || 1);
                                  setSelectedDate(newDate);
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
                                  setSelectedYear(Number(e.target.value));
                                  const newDate = new Date(Number(e.target.value), selectedMonth, selectedDate?.getDate() || 1);
                                  setSelectedDate(newDate);
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
                                .custom-date-picker .rdp-day_selected {
                                  background-color: #1B6EF3 !important;
                                  color: white !important;
                                }
                                .custom-date-picker .rdp-day_today {
                                  font-weight: 600;
                                }
                                .custom-date-picker .rdp-button:hover:not(.rdp-day_selected) {
                                  background-color: #F9FAFB;
                                }
                                .custom-date-picker .rdp {
                                  margin: 0;
                                  font-size: 13px;
                                }
                                .custom-date-picker .rdp-caption {
                                  display: none;
                                }
                                .custom-date-picker .rdp-head_cell {
                                  color: #6B7280;
                                  font-size: 11px;
                                  font-weight: 500;
                                  text-transform: uppercase;
                                }
                              `}</style>
                              <DayPicker
                                mode="single"
                                selected={selectedDate}
                                onSelect={handleDateSelect}
                                month={new Date(selectedYear, selectedMonth)}
                                className="custom-date-picker"
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
                                  onChange={(e) => handleTimeChange(e.target.value, selectedMinute)}
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
                                  onChange={(e) => handleTimeChange(selectedHour, e.target.value)}
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
                              onClick={() => setShowDatePicker(false)}
                              className="w-full mt-3 px-3 py-1.5 text-[13px] text-white bg-[#1B6EF3] rounded hover:bg-[#0D5ED7] transition-colors"
                              style={{ fontWeight: 500 }}
                            >
                              Apply
                            </button>
                          </div>
                        )}
                      </div>
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
                            <option value="days">Days</option>
                            <option value="weeks">Weeks</option>
                            <option value="months">Months</option>
                          </select>
                        </div>
                        <p className="text-[12px] text-[#6B7280] mt-2">
                          {relativeValue} {relativeUnit} after sent
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer - Action buttons */}
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
    </>
  , document.body);
}