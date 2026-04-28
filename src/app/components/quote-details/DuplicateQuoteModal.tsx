import { useState, useRef, useEffect } from 'react';
import { X, Search, Building2, MapPin, Check, Copy, Lock, RefreshCw, Settings2 } from 'lucide-react';
import { activeRateSnapshot, BASE_CURRENCY, getLibraryCurrency } from '../../data/currencyLibrary';

interface Customer {
  id: string;
  name: string;
  location: string;
}

const CUSTOMERS: Customer[] = [
  { id: 'CUST-001', name: 'Tri-County EMS Authority', location: 'Springfield, IL' },
  { id: 'CUST-002', name: 'TechStart Industries', location: 'California HQ' },
  { id: 'CUST-003', name: 'Global Solutions Ltd', location: 'New York Office' },
  { id: 'CUST-004', name: 'Innovation Labs', location: 'Austin Branch' },
  { id: 'CUST-005', name: 'Enterprise Systems Inc', location: 'Boston HQ' },
  { id: 'CUST-006', name: 'Digital Dynamics', location: 'Seattle Office' },
  { id: 'CUST-007', name: 'Future Tech Group', location: 'Miami Plant' },
  { id: 'CUST-008', name: 'Quantum Industries', location: 'Denver Facility' },
  { id: 'CUST-009', name: 'NextGen Solutions', location: 'Portland Branch' },
  { id: 'CUST-010', name: 'Prime Manufacturing', location: 'Detroit Plant' },
  { id: 'CUST-011', name: 'Stellar Enterprises', location: 'Phoenix Office' },
  { id: 'CUST-012', name: 'Apex Technologies', location: 'Atlanta HQ' },
  { id: 'CUST-013', name: 'Horizon Corp', location: 'Dallas Branch' },
  { id: 'CUST-014', name: 'Velocity Systems', location: 'San Diego Office' },
  { id: 'CUST-015', name: 'Phoenix Industries', location: 'Chicago Plant' },
];

/** What rate to seed the duplicated quote with. */
export type DuplicateRateOption = 'locked' | 'today' | 'change-pair';

interface DuplicateQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (customerId: string, customerName: string, rateOption: DuplicateRateOption) => void;
  currentCustomer?: string;
  quoteNumber?: string;
  /** Original quote's currency. Drives the rate-option preview copy. */
  quoteCurrency?: string;
  /** Original quote's locked customer→base rate. Surfaces in the "Use locked rate" option. */
  quoteLockedRate?: number;
  /** Caller wires this to open the Currency Configurator when the user picks "Change currency pair". */
  onChangeCurrencyPair?: () => void;
}

export function DuplicateQuoteModal({ isOpen, onClose, onConfirm, currentCustomer = 'Tri-County EMS Authority', quoteNumber, quoteCurrency, quoteLockedRate, onChangeCurrencyPair }: DuplicateQuoteModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [useSameCustomer, setUseSameCustomer] = useState(true);
  const [rateOption, setRateOption] = useState<DuplicateRateOption>('locked');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSelectedCustomer(null);
      setUseSameCustomer(true);
      setRateOption('locked');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredCustomers = CUSTOMERS.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleConfirm = () => {
    if (useSameCustomer) {
      onConfirm('', currentCustomer, rateOption);
    } else if (selectedCustomer) {
      onConfirm(selectedCustomer.id, selectedCustomer.name, rateOption);
    }
  };

  // Rate-option metadata
  const cur = (quoteCurrency || BASE_CURRENCY).toUpperCase();
  const showFx = cur !== BASE_CURRENCY;
  const baseSym = getLibraryCurrency(BASE_CURRENCY)?.symbol ?? BASE_CURRENCY;
  const todaySnapshot = activeRateSnapshot();
  const todayRate = todaySnapshot.rates[cur] ?? 0;
  const todayRateInverse = todayRate ? (1 / todayRate) : 0;
  const lockedRate = quoteLockedRate ?? 0;
  const drift = lockedRate ? Math.round(((todayRate - lockedRate) / lockedRate) * 1000) / 10 : 0;

  const canConfirm = useSameCustomer || selectedCustomer !== null;

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(1px)' }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF', borderRadius: '12px', width: '480px', maxWidth: '95vw', maxHeight: '80vh',
          display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #E5E7EB', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Copy style={{ width: '16px', height: '16px', color: '#3B82F6' }} />
              <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#1F2937', lineHeight: '1', margin: 0 }}>
                Duplicate Quote
              </h2>
            </div>
            <button onClick={onClose} style={{ width: '28px', height: '28px', borderRadius: '6px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#F3F4F6'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
              <X style={{ width: '16px', height: '16px', color: '#6B7280' }} />
            </button>
          </div>
          <p style={{ fontSize: '12px', color: '#6B7280', margin: 0, lineHeight: '1.4' }}>
            {quoteNumber ? `Create a copy of ${quoteNumber}` : 'Create a copy of this quote'} — choose which customer to assign it to.
          </p>
        </div>

        {/* Content */}
        <div style={{ padding: '16px 24px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Same customer option */}
          <button
            onClick={() => { setUseSameCustomer(true); setSelectedCustomer(null); }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px',
              borderRadius: '8px', cursor: 'pointer', textAlign: 'left',
              border: useSameCustomer ? '2px solid #3B82F6' : '1px solid #E5E7EB',
              backgroundColor: useSameCustomer ? '#F0F7FF' : '#FFFFFF',
              fontFamily: 'Inter, system-ui, sans-serif', transition: 'all 150ms',
            }}
            onMouseEnter={e => { if (!useSameCustomer) e.currentTarget.style.borderColor = '#D1D5DB'; }}
            onMouseLeave={e => { if (!useSameCustomer) e.currentTarget.style.borderColor = '#E5E7EB'; }}
          >
            <div style={{
              width: '18px', height: '18px', borderRadius: '50%', flexShrink: 0,
              border: useSameCustomer ? 'none' : '2px solid #D1D5DB',
              backgroundColor: useSameCustomer ? '#3B82F6' : '#FFFFFF',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {useSameCustomer && (
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#FFFFFF' }} />
              )}
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 500, color: '#1F2937', lineHeight: '1', marginBottom: '4px' }}>
                Same customer
              </div>
              <div style={{ fontSize: '12px', color: '#6B7280', lineHeight: '1', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Building2 style={{ width: '11px', height: '11px' }} />
                {currentCustomer}
              </div>
            </div>
          </button>

          {/* Different customer option */}
          <button
            onClick={() => { setUseSameCustomer(false); setTimeout(() => searchRef.current?.focus(), 100); }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px',
              borderRadius: '8px', cursor: 'pointer', textAlign: 'left',
              border: !useSameCustomer ? '2px solid #3B82F6' : '1px solid #E5E7EB',
              backgroundColor: !useSameCustomer ? '#F0F7FF' : '#FFFFFF',
              fontFamily: 'Inter, system-ui, sans-serif', transition: 'all 150ms',
            }}
            onMouseEnter={e => { if (useSameCustomer) e.currentTarget.style.borderColor = '#D1D5DB'; }}
            onMouseLeave={e => { if (useSameCustomer) e.currentTarget.style.borderColor = '#E5E7EB'; }}
          >
            <div style={{
              width: '18px', height: '18px', borderRadius: '50%', flexShrink: 0,
              border: !useSameCustomer ? 'none' : '2px solid #D1D5DB',
              backgroundColor: !useSameCustomer ? '#3B82F6' : '#FFFFFF',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {!useSameCustomer && (
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#FFFFFF' }} />
              )}
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 500, color: '#1F2937', lineHeight: '1' }}>
                Different customer
              </div>
            </div>
          </button>

          {/* Customer search — shown when "Different customer" is selected */}
          {!useSameCustomer && (
            <div style={{ marginTop: '4px' }}>
              <div style={{ position: 'relative', marginBottom: '8px' }}>
                <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: '#9CA3AF', pointerEvents: 'none' }} />
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Search customers..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%', height: '32px', paddingLeft: '32px', paddingRight: '12px',
                    fontSize: '13px', border: '1px solid #E5E7EB', borderRadius: '6px',
                    outline: 'none', backgroundColor: '#FFFFFF', fontFamily: 'Inter, system-ui, sans-serif', boxSizing: 'border-box',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#93C5FD'; e.currentTarget.style.boxShadow = '0 0 0 2px #DBEAFE'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.boxShadow = 'none'; }}
                />
              </div>
              <div style={{ border: '1px solid #E5E7EB', borderRadius: '8px', maxHeight: '240px', overflowY: 'auto', scrollbarWidth: 'thin' }}>
                {filteredCustomers.map((customer, idx) => {
                  const isSelected = selectedCustomer?.id === customer.id;
                  return (
                    <button
                      key={customer.id}
                      onClick={() => setSelectedCustomer(customer)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 12px', border: 'none',
                        borderTop: idx > 0 ? '1px solid #F3F4F6' : 'none',
                        backgroundColor: isSelected ? '#F0F7FF' : '#FFFFFF',
                        cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', textAlign: 'left',
                        transition: 'background-color 100ms',
                      }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = '#F9FAFB'; }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = isSelected ? '#F0F7FF' : '#FFFFFF'; }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '6px', backgroundColor: '#F3F4F6',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                          <Building2 style={{ width: '14px', height: '14px', color: '#6B7280' }} />
                        </div>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 500, color: '#1F2937', lineHeight: '1', marginBottom: '5px' }}>
                            {customer.name}
                          </div>
                          <div style={{ fontSize: '11px', color: '#9CA3AF', lineHeight: '1', display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <MapPin style={{ width: '10px', height: '10px' }} />
                            {customer.location}
                          </div>
                        </div>
                      </div>
                      {isSelected && (
                        <div style={{
                          width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#3B82F6',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                          <Check style={{ width: '12px', height: '12px', color: '#FFFFFF' }} strokeWidth={3} />
                        </div>
                      )}
                    </button>
                  );
                })}
                {filteredCustomers.length === 0 && (
                  <div style={{ padding: '20px', textAlign: 'center' }}>
                    <span style={{ fontSize: '12px', color: '#9CA3AF' }}>No customers found</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Currency section — three rate options + "What will be different" preview ── */}
          {showFx && (
            <>
              <div style={{ borderTop: '1px solid #F3F4F6', margin: '4px -24px 4px -24px' }} />
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '8px' }}>
                  Currency
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {/* Option 1: Use locked rate */}
                  <RateOptionCard
                    selected={rateOption === 'locked'}
                    onSelect={() => setRateOption('locked')}
                    icon={<Lock style={{ width: 12, height: 12, color: '#047857' }} />}
                    title="Use the locked rate from the original quote"
                    detail={lockedRate
                      ? `1 ${cur} = ${baseSym} ${lockedRate.toFixed(2)} ${BASE_CURRENCY}`
                      : 'Carry forward the rate captured at original quote send time.'}
                  />
                  {/* Option 2: Use today's mid-market */}
                  <RateOptionCard
                    selected={rateOption === 'today'}
                    onSelect={() => setRateOption('today')}
                    icon={<RefreshCw style={{ width: 12, height: 12, color: '#7c3aed' }} />}
                    title="Use today's Mid-market rate"
                    detail={todayRate
                      ? `1 ${cur} = ${baseSym} ${todayRate.toFixed(2)} ${BASE_CURRENCY}${drift !== 0 && lockedRate ? ` · ${drift > 0 ? '+' : ''}${drift}% vs locked` : ''}`
                      : 'Pull the latest live mid-market rate.'}
                  />
                  {/* Option 3: Change pair */}
                  <RateOptionCard
                    selected={rateOption === 'change-pair'}
                    onSelect={() => {
                      setRateOption('change-pair');
                      onChangeCurrencyPair?.();
                    }}
                    icon={<Settings2 style={{ width: 12, height: 12, color: '#1B6EF3' }} />}
                    title="Change currency pair"
                    detail="Open the Currency Configurator to pick different customer / settlement currencies."
                  />
                </div>
              </div>

              {/* What will be different */}
              <div style={{
                marginTop: '4px',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #E0E7FF',
                backgroundColor: '#F8FAFF',
                display: 'flex', flexDirection: 'column', gap: 4,
              }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#3730A3', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  What will be different
                </div>
                <ul style={{ margin: 0, paddingLeft: 16, fontSize: '12px', color: '#1F2937', lineHeight: 1.5 }}>
                  <li>Customer: <strong>{useSameCustomer ? currentCustomer : (selectedCustomer?.name ?? 'Pick one above')}</strong></li>
                  <li>
                    Currency pair:{' '}
                    {rateOption === 'change-pair' ? (
                      <strong>To be configured</strong>
                    ) : (
                      <strong>{cur} → {BASE_CURRENCY} (unchanged)</strong>
                    )}
                  </li>
                  <li>
                    Exchange rate:{' '}
                    {rateOption === 'locked' && lockedRate
                      ? <strong>Locked at 1 {cur} = {baseSym} {lockedRate.toFixed(2)} {BASE_CURRENCY}</strong>
                      : rateOption === 'today' && todayRate
                        ? <>
                            <strong>Today's mid-market: 1 {cur} = {baseSym} {todayRate.toFixed(2)} {BASE_CURRENCY}</strong>
                            {lockedRate && drift !== 0 && (
                              <span style={{ marginLeft: 6, color: drift > 0 ? '#92400E' : '#065F46' }}>
                                ({drift > 0 ? '+' : ''}{drift}% vs locked rate)
                              </span>
                            )}
                          </>
                        : <strong>Set in the Currency Configurator</strong>}
                  </li>
                </ul>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '14px 24px', borderTop: '1px solid #E5E7EB', flexShrink: 0 }}>
          <button onClick={onClose} style={{
            height: '32px', padding: '0 14px', fontSize: '13px', fontWeight: 500, color: '#6B7280',
            backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '6px', cursor: 'pointer',
            fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1',
          }}>
            Cancel
          </button>
          <button onClick={handleConfirm} disabled={!canConfirm} style={{
            height: '32px', padding: '0 16px', fontSize: '13px', fontWeight: 500, color: '#FFFFFF',
            backgroundColor: canConfirm ? '#3B82F6' : '#93C5FD', border: 'none', borderRadius: '6px',
            cursor: canConfirm ? 'pointer' : 'not-allowed',
            fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1', transition: 'background-color 150ms',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}
            onMouseEnter={e => { if (canConfirm) e.currentTarget.style.backgroundColor = '#2563EB'; }}
            onMouseLeave={e => { if (canConfirm) e.currentTarget.style.backgroundColor = '#3B82F6'; }}>
            <Copy style={{ width: '13px', height: '13px' }} />
            Duplicate
          </button>
        </div>
      </div>
    </div>
  );
}

/** Compact radio-card for a single Duplicate-flow rate option. */
function RateOptionCard({ selected, onSelect, icon, title, detail }: {
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        width: '100%', display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px',
        borderRadius: '8px', cursor: 'pointer', textAlign: 'left',
        border: selected ? '2px solid #3B82F6' : '1px solid #E5E7EB',
        backgroundColor: selected ? '#F0F7FF' : '#FFFFFF',
        fontFamily: 'Inter, system-ui, sans-serif', transition: 'all 150ms',
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.borderColor = '#D1D5DB'; }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.borderColor = '#E5E7EB'; }}
    >
      <div style={{
        width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0,
        border: selected ? 'none' : '2px solid #D1D5DB',
        backgroundColor: selected ? '#3B82F6' : '#FFFFFF',
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2,
      }}>
        {selected && <div style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#FFFFFF' }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          {icon}
          <span style={{ fontSize: '13px', fontWeight: 500, color: '#1F2937', lineHeight: '1' }}>{title}</span>
        </div>
        <div style={{ fontSize: '11.5px', color: '#6B7280', lineHeight: '1.45', fontVariantNumeric: 'tabular-nums' }}>
          {detail}
        </div>
      </div>
    </button>
  );
}
