import { Calendar, CalendarDays, Clock3, Info, Zap, Infinity as InfinityIcon } from 'lucide-react';
import { useState } from 'react';
import { DatePickerField } from './date-picker-field';
import { format } from 'date-fns';
import { Switch } from '../ui/switch';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { BaseModal, ModalSecondaryButton, ModalPrimaryButton } from '@/app/components/shared/BaseModal';
import { RelativeDateValue } from '@/app/components/shared/RelativeDateValue';

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
  const [relativeValue, setRelativeValue] = useState(initialConfig.relativeValue || '7');
  const [relativeUnit, setRelativeUnit] = useState(initialConfig.relativeUnit || 'days');
  const [whenSent, setWhenSent] = useState(initialConfig.whenSent !== undefined ? initialConfig.whenSent : false);
  const [hasExpiry, setHasExpiry] = useState(initialConfig.hasExpiry !== undefined ? initialConfig.hasExpiry : true);

  if (!isOpen) return null;

  const titles = {
    request: 'Request Date Configuration',
    respond: 'Respond By Configuration',
    effective: 'Effective From Configuration',
    expiry: 'Expiration Date Configuration'
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      setAbsoluteValue(format(date, 'dd/MM/yyyy'));
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

  const subtitle =
    type === 'request' ? 'The date the customer originally requested this quote'
    : type === 'respond' ? 'Deadline for internal team to send the quote to the customer'
    : type === 'effective' ? 'The date from which this quote\'s pricing and terms are valid'
    : 'The date after which this quote is no longer valid';

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={titles[type]}
      subtitle={subtitle}
      icon={<Calendar />}
      width="md"
      footer={
        <>
          <ModalSecondaryButton onClick={onClose}>Cancel</ModalSecondaryButton>
          <ModalPrimaryButton onClick={handleSave}>Save Changes</ModalPrimaryButton>
        </>
      }
    >
          {/* Content */}
          <div className="space-y-4">
            {/* Partner-style toggle card: rounded-xl container that
                tints primary when active, with an icon badge on the
                left, label + helper text in the middle, and the Switch
                on the right. Mirrors Partner Management's section
                toggles (e.g. "Apply Early Payment Discount"). */}
            {type === 'effective' && (
              <div className="mb-4">
                <div
                  className="rounded-lg border p-4 transition-all duration-200"
                  style={{
                    background: '#FFFFFF',
                    borderColor: whenSent ? 'rgba(10,119,255,0.25)' : 'var(--border)',
                    boxShadow: whenSent ? '0 1px 2px rgba(15,23,42,0.05)' : 'none',
                  }}
                >
                  <div className="flex items-center" style={{ gap: 12 }}>
                    <div
                      className="flex items-center justify-center shrink-0 transition-all duration-200"
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: whenSent
                          ? 'linear-gradient(135deg, #DBEAFE 0%, #BFDBFE 100%)'
                          : 'linear-gradient(135deg, var(--accent) 0%, #DBEAFE 100%)',
                        color: whenSent ? '#1D4ED8' : 'var(--primary)',
                      }}
                    >
                      <Zap style={{ width: 18, height: 18 }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h5 className="text-[13px] text-foreground" style={{ fontWeight: 600, margin: 0 }}>
                        Effective when sent
                      </h5>
                      <p className="text-[11px] text-slate-500 mt-0.5" style={{ margin: 0, marginTop: 2 }}>
                        Make the quote effective the moment it lands with the customer.
                      </p>
                    </div>
                    <Switch checked={whenSent} onCheckedChange={setWhenSent} />
                  </div>
                </div>
              </div>
            )}

            {type === 'expiry' && (
              <div className="mb-4">
                <div
                  className="rounded-lg border p-4 transition-all duration-200"
                  style={{
                    background: '#FFFFFF',
                    borderColor: !hasExpiry ? 'rgba(10,119,255,0.25)' : 'var(--border)',
                    boxShadow: !hasExpiry ? '0 1px 2px rgba(15,23,42,0.05)' : 'none',
                  }}
                >
                  <div className="flex items-center" style={{ gap: 12 }}>
                    <div
                      className="flex items-center justify-center shrink-0 transition-all duration-200"
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: !hasExpiry
                          ? 'linear-gradient(135deg, #DBEAFE 0%, #BFDBFE 100%)'
                          : 'linear-gradient(135deg, var(--accent) 0%, #DBEAFE 100%)',
                        color: !hasExpiry ? '#1D4ED8' : 'var(--primary)',
                      }}
                    >
                      <InfinityIcon style={{ width: 18, height: 18 }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h5 className="text-[13px] text-foreground" style={{ fontWeight: 600, margin: 0 }}>
                        No expiry date
                      </h5>
                      <p className="text-[11px] text-slate-500 mt-0.5" style={{ margin: 0, marginTop: 2 }}>
                        Leave the quote valid indefinitely until manually closed.
                      </p>
                    </div>
                    <Switch checked={!hasExpiry} onCheckedChange={(v) => setHasExpiry(!v)} />
                  </div>
                </div>
              </div>
            )}

            {/* Date configuration card. Always rendered so the
                hierarchy is visible — when one of the toggles above
                overrides the manual date, the entire card dims so the
                user can still see what's there but knows it's inactive. */}
            {(() => {
              const overridden = (type === 'effective' && whenSent) || (type === 'expiry' && !hasExpiry);
              return (
              <div
                className="rounded-lg border bg-white p-4 transition-opacity duration-200"
                style={{
                  borderColor: 'var(--border)',
                  opacity: overridden ? 0.45 : 1,
                  pointerEvents: overridden ? 'none' : 'auto',
                }}
                aria-disabled={overridden}
              >
                {overridden && (
                  <div className="flex items-start gap-2 mb-3" style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                    <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    <span>
                      Controlled by the toggle above. Turn it off to set a specific date below.
                    </span>
                  </div>
                )}
              <div className="space-y-4">
                {/* For Request Date: Only show absolute date input with picker (no toggle) */}
                {(type === 'request' || type === 'respond') ? (
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-2" style={{ fontWeight: 500 }}>
                      Select Date
                    </label>
                    <DatePickerField
                      value={selectedDate}
                      onChange={(d) => handleDateSelect(d)}
                      placeholder="MM/DD/YYYY"
                    />
                  </div>
                ) : (
                  <>
                    {/* Date Type — Partner-style radio cards. Same look
                        as the customer/vendor selector in Partner
                        creation: two side-by-side cards with a tinted
                        border + soft outer glow on the selected card. */}
                    <div>
                      <label className="block text-[11px] text-muted-foreground mb-2" style={{ fontWeight: 500 }}>
                        Date Type
                      </label>
                      <div className="grid grid-cols-2" style={{ gap: 10 }}>
                        {(['absolute', 'relative'] as const).map(dt => {
                          const selected = dateType === dt;
                          const meta = dt === 'absolute'
                            ? { label: 'Absolute Date', desc: 'Pick a specific calendar date and time.', Icon: CalendarDays }
                            : { label: 'Relative Date', desc: 'N days, weeks or months after the quote is sent.', Icon: Clock3 };
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

                    {/* Date Input - Conditional based on type */}
                    {dateType === 'absolute' ? (
                      <div>
                        <label className="block text-[11px] text-muted-foreground mb-2" style={{ fontWeight: 500 }}>
                          Select Date
                        </label>
                        <DatePickerField
                          value={selectedDate}
                          onChange={(d) => handleDateSelect(d)}
                          placeholder="MM/DD/YYYY"
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="block text-[11px] text-muted-foreground mb-2" style={{ fontWeight: 500 }}>
                          Relative Duration
                        </label>
                        <div className="grid grid-cols-[80px_1fr] gap-2">
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
                              <SelectItem value="days">Days</SelectItem>
                              <SelectItem value="weeks">Weeks</SelectItem>
                              <SelectItem value="months">Months</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {/* The inputs already state the rule, so the line under
                            them shows the day it lands on, carrying the same
                            marker the cards use for a relative date. */}
                        <p className="text-[12px] text-muted-foreground mt-2 flex items-center gap-1.5">
                          <span>Resolves to</span>
                          <RelativeDateValue
                            display={resolveRelative(relativeValue, relativeUnit)}
                            rule={`${relativeValue} ${relativeUnit} after the quote is sent`}
                            anchor="the send date"
                          />
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
              </div>
              );
            })()}
          </div>

    </BaseModal>
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