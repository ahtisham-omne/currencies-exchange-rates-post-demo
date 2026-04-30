import { useState, useEffect, useRef } from 'react';
import { Search, Check, Star, X, ChevronDown, FileText, RefreshCw } from 'lucide-react';

export interface SalesRepOption {
  id: string;
  name: string;
  initials: string;
  isCurrentUser?: boolean;
  isCustomerDefault?: boolean;
}

export interface SelectedSalesRep {
  id: string;
  name: string;
  initials: string;
  isPrimary: boolean;
  isCurrentUser?: boolean;
  isCustomerDefault?: boolean;
}

interface PrimaryChangeConfirmation {
  repId: string;
  repName: string;
}

interface SalesRepSelectorProps {
  availableReps: SalesRepOption[];
  selectedReps: SelectedSalesRep[];
  onSelectedRepsChange: (reps: SelectedSalesRep[]) => void;
  dropdownDirection?: 'up' | 'down';
  label?: string;
  fullWidth?: boolean;
}

const getAvatarColor = (initials: string) => {
  const colors = [
    { bg: '#FDE68A', text: '#92400E' }, { bg: '#DBEAFE', text: '#1E40AF' },
    { bg: '#FED7AA', text: '#9A3412' }, { bg: '#C7D2FE', text: '#3730A3' },
    { bg: '#FCA5A5', text: '#991B1B' }, { bg: '#D1FAE5', text: '#065F46' },
    { bg: '#E9D5FF', text: '#6B21A8' }, { bg: '#FBCFE8', text: '#831843' },
  ];
  const hash = initials.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

export function SalesRepSelector({
  availableReps, selectedReps, onSelectedRepsChange, dropdownDirection = 'up', label = 'Sales Representative', fullWidth = false,
}: SalesRepSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [confirmPrimary, setConfirmPrimary] = useState<PrimaryChangeConfirmation | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredReps = availableReps.filter((rep) => rep.name.toLowerCase().includes(search.toLowerCase()));
  const primaryRep = selectedReps.find((r) => r.isPrimary) || selectedReps[0];
  const otherReps = selectedReps.filter((r) => r.id !== primaryRep?.id);
  const customerDefaultRep = availableReps.find((r) => r.isCustomerDefault);
  const rowMode = Boolean(label);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => { if (containerRef.current && !containerRef.current.contains(e.target as Node)) { setIsOpen(false); setSearch(''); } };
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handler); };
  }, [isOpen]);

  const isSelected = (repId: string) => selectedReps.some((r) => r.id === repId);

  const toggleRep = (rep: SalesRepOption) => {
    if (isSelected(rep.id)) {
      const current = selectedReps.find((r) => r.id === rep.id);
      if (current?.isPrimary || selectedReps.length <= 1) return;
      onSelectedRepsChange(selectedReps.filter((r) => r.id !== rep.id));
    } else {
      onSelectedRepsChange([...selectedReps, { id: rep.id, name: rep.name, initials: rep.initials, isPrimary: selectedReps.length === 0, isCurrentUser: rep.isCurrentUser, isCustomerDefault: rep.isCustomerDefault }]);
    }
  };

  const handleSetPrimary = (repId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const rep = selectedReps.find((r) => r.id === repId);
    if (!rep || rep.isPrimary) return;
    const isNewPrimaryCustomerDefault = customerDefaultRep?.id === repId;
    if (!isNewPrimaryCustomerDefault && customerDefaultRep) setConfirmPrimary({ repId, repName: rep.name });
    else applyPrimaryChange(repId);
  };

  const applyPrimaryChange = (repId: string) => { onSelectedRepsChange(selectedReps.map((r) => ({ ...r, isPrimary: r.id === repId }))); };

  const removeRep = (repId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const rep = selectedReps.find((r) => r.id === repId);
    if (rep?.isPrimary || selectedReps.length <= 1) return;
    onSelectedRepsChange(selectedReps.filter((r) => r.id !== repId));
  };

  return (
    <>
      <div ref={containerRef} style={{ position: 'relative', width: (label || fullWidth) ? '100%' : 'fit-content' }}>
        {/* Trigger Row */}
        <div
          className="group"
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: label ? 'space-between' : 'flex-start',
            gap: 8,
            padding: rowMode ? '8px 10px' : '0 12px',
            minHeight: rowMode ? 36 : 32,
            height: rowMode ? 'auto' : 32,
            borderRadius: 6,
            border: rowMode ? 'none' : '1px solid var(--border)',
            backgroundColor: 'var(--card)', cursor: 'pointer', transition: 'border-color 150ms, background-color 150ms',
            width: (label || fullWidth) ? '100%' : 'auto',
          }}
          onMouseEnter={(e) => { if (!rowMode) e.currentTarget.style.borderColor = 'hsl(var(--primary) / 0.3)'; e.currentTarget.style.backgroundColor = '#F9FAFB'; }}
          onMouseLeave={(e) => { if (!rowMode) e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.backgroundColor = 'var(--card)'; }}
          onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        >
          {label && <span style={{ fontSize: 'var(--text-caption)', color: '#6B7280', fontWeight: 400, flexShrink: 0 }}>{label}</span>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              {primaryRep && (() => {
                const c = getAvatarColor(primaryRep.initials);
                return (
                  <>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', backgroundColor: c.bg, color: c.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 600, flexShrink: 0 }}>{primaryRep.initials}</div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1F2937', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{primaryRep.name}{primaryRep.isCurrentUser ? ' (You)' : ''}</span>
                  </>
                );
              })()}
              {otherReps.length > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', height: 18, padding: '0 6px', fontSize: 11, fontWeight: 500, color: '#6B7280', backgroundColor: '#F3F4F6', borderRadius: 9, flexShrink: 0 }}>+{otherReps.length}</span>}
            </div>
            <ChevronDown className="group-hover:text-primary" style={{ width: 14, height: 14, color: '#9CA3AF', transition: 'color 150ms', flexShrink: 0 }} />
          </div>
        </div>

        {/* Dropdown */}
        {isOpen && (
          <div onClick={(e) => e.stopPropagation()} style={{
            position: 'absolute', ...(label ? { right: 0 } : { left: 0 }),
            ...(dropdownDirection === 'up' ? { bottom: '100%', marginBottom: 4 } : { top: '100%', marginTop: 4 }),
            width: 380, border: '1px solid var(--border)', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 50,
            backgroundColor: 'var(--card)', borderRadius: 8, overflow: 'hidden',
          }}>
            {/* Search */}
            <div style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
              <div style={{ position: 'relative' }}>
                <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--muted-foreground)' }} />
                <input type="text" placeholder="Search sales representatives..." value={search} onChange={(e) => setSearch(e.target.value)} autoFocus
                  style={{ width: '100%', paddingLeft: 36, paddingRight: 12, height: 32, fontSize: 13, color: 'var(--foreground)', border: '1px solid var(--border)', borderRadius: 6, outline: 'none', background: 'var(--card)' }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'hsl(var(--primary) / 0.3)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                />
              </div>
            </div>

            {/* Selected Reps Summary */}
            {selectedReps.length > 0 && (
              <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--secondary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Assigned ({selectedReps.length})</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {selectedReps.map((rep) => {
                    const c = getAvatarColor(rep.initials);
                    return (
                      <div key={rep.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px 4px 4px', borderRadius: 9999, backgroundColor: rep.isPrimary ? 'hsl(var(--primary) / 0.08)' : 'var(--secondary)', border: `1px solid ${rep.isPrimary ? 'hsl(var(--primary) / 0.2)' : 'var(--border)'}`, fontSize: 12, fontWeight: 500, color: 'var(--foreground)' }}>
                        <div style={{ width: 20, height: 20, borderRadius: '50%', backgroundColor: c.bg, color: c.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 600, flexShrink: 0 }}>{rep.initials}</div>
                        <span style={{ whiteSpace: 'nowrap' }}>{rep.name.split(' ')[0]}</span>
                        {rep.isPrimary && <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--primary)', backgroundColor: 'hsl(var(--primary) / 0.1)', padding: '1px 5px', borderRadius: 4 }}>Primary</span>}
                        {!rep.isPrimary && selectedReps.length > 1 && (
                          <button onClick={(e) => removeRep(rep.id, e)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 14, height: 14, borderRadius: '50%', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', padding: 0 }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--destructive)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted-foreground)'; }}
                          ><X style={{ width: 10, height: 10 }} /></button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Rep List */}
            <div style={{ maxHeight: 240, overflowY: 'auto' }}>
              {filteredReps.map((rep) => {
                const selected = isSelected(rep.id);
                const isPrimary = selectedReps.find((r) => r.id === rep.id)?.isPrimary;
                const c = getAvatarColor(rep.initials);
                return (
                  <div key={rep.id} onClick={() => toggleRep(rep)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', cursor: 'pointer', backgroundColor: selected ? 'hsl(var(--primary) / 0.03)' : 'transparent', transition: 'background-color 100ms' }}
                    onMouseEnter={(e) => { if (!selected) e.currentTarget.style.backgroundColor = 'var(--secondary)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = selected ? 'hsl(var(--primary) / 0.03)' : 'transparent'; }}
                  >
                    <div style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${selected ? 'var(--primary)' : 'var(--border)'}`, backgroundColor: selected ? 'var(--primary)' : 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 150ms' }}>
                      {selected && <Check style={{ width: 10, height: 10, color: 'var(--primary-foreground)' }} />}
                    </div>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: c.bg, color: c.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>{rep.initials}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>{rep.name}</span>
                        {rep.isCurrentUser && <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>(You)</span>}
                        {rep.isCustomerDefault && <span style={{ display: 'inline-flex', alignItems: 'center', height: 16, padding: '0 6px', fontSize: 10, fontWeight: 500, color: 'var(--primary)', backgroundColor: 'hsl(var(--primary) / 0.1)', borderRadius: 4 }}>Customer Default</span>}
                      </div>
                    </div>
                    {selected && (
                      <button onClick={(e) => handleSetPrimary(rep.id, e)} title={isPrimary ? 'Primary sales rep' : 'Set as primary'}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, border: 'none', backgroundColor: 'transparent', cursor: isPrimary ? 'default' : 'pointer', padding: 0, transition: 'all 150ms', color: isPrimary ? '#F59E0B' : 'var(--border)', flexShrink: 0 }}
                        onMouseEnter={(e) => { if (!isPrimary) { e.currentTarget.style.backgroundColor = '#FEF3C7'; e.currentTarget.style.color = '#F59E0B'; } }}
                        onMouseLeave={(e) => { if (!isPrimary) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--border)'; } }}
                      >
                        <Star style={{ width: 14, height: 14 }} fill={isPrimary ? '#F59E0B' : 'none'} />
                      </button>
                    )}
                  </div>
                );
              })}
              {filteredReps.length === 0 && <div style={{ padding: '16px 12px', textAlign: 'center', fontSize: 13, color: 'var(--muted-foreground)' }}>No representatives found</div>}
            </div>
          </div>
        )}
      </div>

      {/* Primary Change Confirmation */}
      {confirmPrimary && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={() => setConfirmPrimary(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 420, backgroundColor: 'var(--card)', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px 0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Star style={{ width: 18, height: 18, color: '#F59E0B' }} fill="#F59E0B" />
                </div>
                <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--foreground)' }}>Change Primary Sales Rep</span>
              </div>
              <button onClick={() => setConfirmPrimary(null)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: 'var(--muted-foreground)', padding: 0 }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--secondary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              ><X style={{ width: 16, height: 16 }} /></button>
            </div>
            <div style={{ padding: '16px 24px 24px 24px' }}>
              <p style={{ fontSize: 13, color: 'var(--muted-foreground)', lineHeight: 1.6, marginBottom: 20, marginTop: 0 }}>
                You're setting <strong style={{ color: 'var(--foreground)', fontWeight: 600 }}>{confirmPrimary.repName}</strong> as the primary sales representative.
                {customerDefaultRep ? <> This is different from the customer's default rep (<strong style={{ color: 'var(--foreground)', fontWeight: 600 }}>{customerDefaultRep.name}</strong>).</> : null}
              </p>
              <button onClick={() => { applyPrimaryChange(confirmPrimary.repId); setConfirmPrimary(null); }}
                className="w-full text-left mb-2.5 transition-all hover:border-primary/30 hover:bg-secondary/50"
                style={{ padding: '14px 16px', border: '1px solid var(--border)', borderRadius: 8, backgroundColor: 'var(--card)', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 12 }}
              >
                <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                  <FileText style={{ width: 16, height: 16, color: 'var(--muted-foreground)' }} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', marginBottom: 4 }}>This order only</div>
                  <div style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.4 }}>Change the primary rep for this order. The customer's default will stay the same.</div>
                </div>
              </button>
              <button onClick={() => { applyPrimaryChange(confirmPrimary.repId); setConfirmPrimary(null); }}
                className="w-full text-left transition-all hover:border-primary/30 hover:bg-secondary/50"
                style={{ padding: '14px 16px', border: '1px solid var(--border)', borderRadius: 8, backgroundColor: 'var(--card)', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 12 }}
              >
                <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'hsl(var(--primary) / 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                  <RefreshCw style={{ width: 16, height: 16, color: 'var(--primary)' }} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', marginBottom: 4 }}>All future orders</div>
                  <div style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.4 }}>Update the customer's default sales rep. This will apply to all new orders.</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
