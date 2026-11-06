import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, Check, Star, X, ChevronDown, Pencil, FileText, RefreshCw } from 'lucide-react';
import { Avatar } from '@/app/components/shared/Avatar';

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
  /** Label shown in the trigger row */
  label?: string;
  /** Force full width regardless of label */
  fullWidth?: boolean;
  /** Render only the dropdown panel inline (no trigger row). Use for embedding in overlays. */
  renderDropdownOnly?: boolean;
  /** Called when user clicks outside (only used with renderDropdownOnly). */
  onClose?: () => void;
  /** `pencil` renders the trigger as a plain value with a pencil, the way the
   *  other configuration rows read. `chevron` keeps the bordered control. */
  affordance?: 'chevron' | 'pencil';
}

const getAvatarColor = (initials: string) => {
  const colors = [
    { bg: '#FDE68A', text: '#92400E' },
    { bg: '#DBEAFE', text: '#1E40AF' },
    { bg: '#FED7AA', text: '#9A3412' },
    { bg: '#C7D2FE', text: '#3730A3' },
    { bg: '#FCA5A5', text: '#991B1B' },
    { bg: '#D1FAE5', text: '#065F46' },
    { bg: '#E9D5FF', text: '#6B21A8' },
    { bg: '#FBCFE8', text: '#831843' },
  ];
  const hash = initials.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

export function SalesRepSelector({
  availableReps,
  selectedReps,
  onSelectedRepsChange,
  dropdownDirection = 'up',
  label = 'Sales Representative',
  fullWidth = false,
  renderDropdownOnly = false,
  onClose,
  affordance = 'chevron',
}: SalesRepSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [confirmPrimary, setConfirmPrimary] = useState<PrimaryChangeConfirmation | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelPos, setPanelPos] = useState<{ top?: number; bottom?: number; left: number; width: number } | null>(null);

  // Position panel via portal — escapes any clipping parent (modal h-scroll, sidebar overflow, etc.)
  useLayoutEffect(() => {
    if (renderDropdownOnly || !isOpen || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const panelW = 380;
    const panelH = 420; // approx max
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - panelW - 8));
    if (dropdownDirection === 'up') {
      setPanelPos({ bottom: window.innerHeight - rect.top + 4, left, width: panelW });
    } else {
      const wouldOverflow = rect.bottom + 4 + panelH > window.innerHeight;
      setPanelPos(wouldOverflow
        ? { bottom: window.innerHeight - rect.top + 4, left, width: panelW }
        : { top: rect.bottom + 4, left, width: panelW });
    }
  }, [isOpen, dropdownDirection, renderDropdownOnly]);

  const filteredReps = availableReps.filter((rep) =>
    rep.name.toLowerCase().includes(search.toLowerCase())
  );

  const primaryRep = selectedReps.find((r) => r.isPrimary) || selectedReps[0];
  const otherReps = selectedReps.filter((r) => r.id !== primaryRep?.id);
  const customerDefaultRep = availableReps.find((r) => r.isCustomerDefault);

  useEffect(() => {
    if (renderDropdownOnly) {
      // In dropdown-only mode, handle outside clicks to call onClose
      const handler = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          onClose?.();
        }
      };
      const t = setTimeout(() => document.addEventListener('mousedown', handler), 0);
      return () => {
        clearTimeout(t);
        document.removeEventListener('mousedown', handler);
      };
    }
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      const inTrigger = containerRef.current?.contains(t);
      const inPanel = panelRef.current?.contains(t);
      if (!inTrigger && !inPanel) {
        setIsOpen(false);
        setSearch('');
      }
    };
    const tm = setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => {
      clearTimeout(tm);
      document.removeEventListener('mousedown', handler);
    };
  }, [isOpen, renderDropdownOnly, onClose]);

  const isSelected = (repId: string) => selectedReps.some((r) => r.id === repId);

  const toggleRep = (rep: SalesRepOption) => {
    if (isSelected(rep.id)) {
      // Don't remove last rep or primary rep
      const current = selectedReps.find((r) => r.id === rep.id);
      if (current?.isPrimary || selectedReps.length <= 1) return;
      onSelectedRepsChange(selectedReps.filter((r) => r.id !== rep.id));
    } else {
      onSelectedRepsChange([
        ...selectedReps,
        {
          id: rep.id,
          name: rep.name,
          initials: rep.initials,
          isPrimary: selectedReps.length === 0,
          isCurrentUser: rep.isCurrentUser,
          isCustomerDefault: rep.isCustomerDefault,
        },
      ]);
    }
  };

  const handleSetPrimary = (repId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const rep = selectedReps.find((r) => r.id === repId);
    if (!rep || rep.isPrimary) return;

    // Check if new primary is different from customer default
    const isNewPrimaryCustomerDefault = customerDefaultRep?.id === repId;
    const wasPreviousPrimaryCustomerDefault = customerDefaultRep?.id === primaryRep?.id;

    if (!isNewPrimaryCustomerDefault && customerDefaultRep) {
      // Show confirmation
      setConfirmPrimary({ repId, repName: rep.name });
    } else {
      // Just set primary directly
      applyPrimaryChange(repId);
    }
  };

  const applyPrimaryChange = (repId: string) => {
    onSelectedRepsChange(
      selectedReps.map((r) => ({
        ...r,
        isPrimary: r.id === repId,
      }))
    );
  };

  const handleConfirmPrimaryThisQuote = () => {
    if (confirmPrimary) {
      applyPrimaryChange(confirmPrimary.repId);
      setConfirmPrimary(null);
    }
  };

  const handleConfirmPrimaryAllFuture = () => {
    if (confirmPrimary) {
      applyPrimaryChange(confirmPrimary.repId);
      // In a real app, this would call an API to update partner records
      console.log(`Updating customer default sales rep to ${confirmPrimary.repName} in partner records.`);
      setConfirmPrimary(null);
    }
  };

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
        {!renderDropdownOnly && (
          <div
            ref={triggerRef}
            className="group"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: label ? 'space-between' : 'flex-start',
              gap: '8px',
              padding: affordance === 'pencil' ? '0' : '0 12px',
              height: affordance === 'pencil' ? 'auto' : '32px',
              borderRadius: '6px',
              borderWidth: affordance === 'pencil' ? '0' : '1px',
              borderStyle: 'solid',
              borderColor: affordance === 'pencil' ? 'transparent' : '#E5E7EB',
              backgroundColor: affordance === 'pencil' ? 'transparent' : '#FFFFFF',
              cursor: 'pointer',
              transition: 'border-color 150ms, background-color 150ms',
              width: (label || fullWidth) ? '100%' : 'auto',
            }}
            onMouseEnter={(e) => {
              if (affordance === 'pencil') return;
              e.currentTarget.style.borderColor = '#BFDBFE';
              e.currentTarget.style.backgroundColor = '#F9FAFB';
            }}
            onMouseLeave={(e) => {
              if (affordance === 'pencil') return;
              e.currentTarget.style.borderColor = '#E5E7EB';
              e.currentTarget.style.backgroundColor = '#FFFFFF';
            }}
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(!isOpen);
            }}
          >
            {label && <span style={{ fontSize: '13px', color: '#6B7280', fontWeight: 400, flexShrink: 0 }}>{label}</span>}
            <div style={{ display: 'flex', alignItems: 'center', gap: affordance === 'pencil' ? '6px' : '8px', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                {primaryRep && (
                  <>
                    <Avatar name={primaryRep.name} size={20} initials={primaryRep.initials} />
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#1F2937',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {primaryRep.name}
                      {primaryRep.isCurrentUser ? ' (You)' : ''}
                    </span>
                  </>
                )}
                {otherReps.length > 0 && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      height: '18px',
                      padding: '0 6px',
                      fontSize: '11px',
                      fontWeight: 500,
                      color: '#6B7280',
                      backgroundColor: '#F3F4F6',
                      borderRadius: '9px',
                      flexShrink: 0,
                    }}
                  >
                    +{otherReps.length}
                  </span>
                )}
              </div>
              {affordance === 'pencil' ? (
                <Pencil
                  className="text-slate-300 group-hover:text-primary transition-colors"
                  style={{ width: '14px', height: '14px', flexShrink: 0 }}
                />
              ) : (
                <ChevronDown
                  className="group-hover:!text-[#1B6EF3]"
                  style={{ width: '14px', height: '14px', color: '#9CA3AF', transition: 'color 150ms', flexShrink: 0 }}
                />
              )}
            </div>
          </div>
        )}

        {/* Dropdown panel — rendered inline when renderDropdownOnly,
            portaled to document.body otherwise (escapes any clipping parent
            like a modal with horizontal scroll or a sidebar with overflow). */}
        {(isOpen || renderDropdownOnly) && (() => {
          const panel = (
          <div
            ref={panelRef}
            onClick={(e) => e.stopPropagation()}
            style={{
              ...(renderDropdownOnly
                ? { width: '100%' }
                : panelPos
                  ? {
                      position: 'fixed' as const,
                      left: panelPos.left,
                      ...(panelPos.top != null ? { top: panelPos.top } : {}),
                      ...(panelPos.bottom != null ? { bottom: panelPos.bottom } : {}),
                      width: panelPos.width,
                      /* CreateQuoteModal sits at zIndex 10000. The
                         dropdown rendered "drop-up" inside the
                         creation form so it was opening behind the
                         modal at 9999 — needs to clear the modal. */
                      zIndex: 10500,
                      border: '1px solid #E5E7EB',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    }
                  : { display: 'none' }),
              backgroundColor: '#FFFFFF',
              borderRadius: '8px',
              overflow: 'hidden',
              fontFamily: 'Inter, system-ui, sans-serif',
            }}
          >
            {/* Search */}
            <div style={{ padding: '12px', borderBottom: '1px solid #E5E7EB' }}>
              <div style={{ position: 'relative' }}>
                <Search
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '14px',
                    height: '14px',
                    color: '#9CA3AF',
                  }}
                />
                <input
                  type="text"
                  placeholder="Search sales representatives..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                  style={{
                    width: '100%',
                    paddingLeft: '36px',
                    paddingRight: '12px',
                    height: '32px',
                    fontSize: '13px',
                    color: '#1F2937',
                    border: '1px solid #E5E7EB',
                    borderRadius: '6px',
                    outline: 'none',
                    fontFamily: 'Inter, system-ui, sans-serif',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#93C5FD';
                    e.currentTarget.style.boxShadow = '0 0 0 2px rgba(147,197,253,0.3)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#E5E7EB';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>
            </div>

            {/* Selected Reps Summary */}
            {selectedReps.length > 0 && (
              <div
                style={{
                  padding: '10px 12px',
                  borderBottom: '1px solid #E5E7EB',
                  backgroundColor: '#FAFBFC',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '8px',
                  }}
                >
                  <span style={{ fontSize: '11px', fontWeight: 500, color: '#9CA3AF', textTransform: 'none' }}>
                    Assigned ({selectedReps.length})
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {selectedReps.map((rep) => {
                    return (
                      <div
                        key={rep.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 8px 4px 4px',
                          borderRadius: '9999px',
                          backgroundColor: rep.isPrimary ? '#EFF6FF' : '#F3F4F6',
                          border: `1px solid ${rep.isPrimary ? '#BFDBFE' : '#E5E7EB'}`,
                          fontSize: '12px',
                          fontWeight: 500,
                          color: '#1F2937',
                        }}
                      >
                        <Avatar name={rep.name} size={20} initials={rep.initials} />
                        <span style={{ whiteSpace: 'nowrap' }}>{rep.name}</span>
                        {rep.isPrimary && (
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 500,
                              color: '#1E40AF',
                              backgroundColor: '#DBEAFE',
                              padding: '1px 5px',
                              borderRadius: '4px',
                            }}
                          >
                            Primary
                          </span>
                        )}
                        {!rep.isPrimary && selectedReps.length > 1 && (
                          <button
                            onClick={(e) => removeRep(rep.id, e)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '14px',
                              height: '14px',
                              borderRadius: '50%',
                              backgroundColor: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              color: '#9CA3AF',
                              padding: 0,
                              transition: 'color 150ms',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = '#EF4444';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = '#9CA3AF';
                            }}
                          >
                            <X style={{ width: '10px', height: '10px' }} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Rep List */}
            <div style={{ maxHeight: '240px', overflowY: 'auto', scrollbarWidth: 'thin' }}>
              {filteredReps.map((rep) => {
                const selected = isSelected(rep.id);
                const isPrimary = selectedReps.find((r) => r.id === rep.id)?.isPrimary;
                return (
                  <div
                    key={rep.id}
                    onClick={() => toggleRep(rep)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 12px',
                      cursor: 'pointer',
                      backgroundColor: selected ? '#F8FAFF' : 'transparent',
                      transition: 'background-color 100ms',
                      fontFamily: 'Inter, system-ui, sans-serif',
                    }}
                    onMouseEnter={(e) => {
                      if (!selected) e.currentTarget.style.backgroundColor = '#F9FAFB';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = selected ? '#F8FAFF' : 'transparent';
                    }}
                  >
                    {/* Checkbox */}
                    <div
                      style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '4px',
                        border: `1.5px solid ${selected ? '#1B6EF3' : '#D1D5DB'}`,
                        backgroundColor: selected ? '#1B6EF3' : '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        transition: 'all 150ms',
                      }}
                    >
                      {selected && <Check style={{ width: '10px', height: '10px', color: '#FFFFFF' }} />}
                    </div>

                    {/* Avatar */}
                    <Avatar name={rep.name} size={32} initials={rep.initials} />

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '13px', fontWeight: 500, color: '#1F2937' }}>{rep.name}</span>
                        {rep.isCurrentUser && (
                          <span style={{ fontSize: '11px', color: '#9CA3AF' }}>(You)</span>
                        )}
                        {rep.isCustomerDefault && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              height: '16px',
                              padding: '0 6px',
                              fontSize: '10px',
                              fontWeight: 500,
                              color: '#1E40AF',
                              backgroundColor: '#DBEAFE',
                              borderRadius: '4px',
                            }}
                          >
                            Customer Default
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Primary star */}
                    {selected && (
                      <button
                        onClick={(e) => handleSetPrimary(rep.id, e)}
                        title={isPrimary ? 'Primary sales rep' : 'Set as primary'}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '28px',
                          height: '28px',
                          borderRadius: '6px',
                          border: 'none',
                          backgroundColor: 'transparent',
                          cursor: isPrimary ? 'default' : 'pointer',
                          padding: 0,
                          transition: 'all 150ms',
                          color: isPrimary ? '#F59E0B' : '#D1D5DB',
                          flexShrink: 0,
                        }}
                        onMouseEnter={(e) => {
                          if (!isPrimary) {
                            e.currentTarget.style.backgroundColor = '#FEF3C7';
                            e.currentTarget.style.color = '#F59E0B';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isPrimary) {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = '#D1D5DB';
                          }
                        }}
                      >
                        <Star
                          style={{ width: '14px', height: '14px' }}
                          fill={isPrimary ? '#F59E0B' : 'none'}
                        />
                      </button>
                    )}
                  </div>
                );
              })}
              {filteredReps.length === 0 && (
                <div style={{ padding: '16px 12px', textAlign: 'center', fontSize: '13px', color: '#9CA3AF' }}>
                  No representatives found
                </div>
              )}
            </div>
          </div>
          );
          return renderDropdownOnly ? panel : createPortal(panel, document.body);
        })()}
      </div>

      {/* Primary Change Confirmation Modal */}
      {confirmPrimary && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
          onClick={() => setConfirmPrimary(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '420px',
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '20px 24px 0 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: '#FEF3C7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Star style={{ width: '18px', height: '18px', color: '#F59E0B' }} fill="#F59E0B" />
                </div>
                <span style={{ fontSize: '16px', fontWeight: 600, color: '#111827' }}>Change Primary Sales Rep</span>
              </div>
              <button
                onClick={() => setConfirmPrimary(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  color: '#9CA3AF',
                  padding: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#F3F4F6';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <X style={{ width: '16px', height: '16px' }} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '16px 24px 24px 24px' }}>
              <p style={{ fontSize: '13px', color: '#6B7280', lineHeight: '1.6', marginBottom: '20px', marginTop: 0 }}>
                You're setting <strong style={{ color: '#1F2937', fontWeight: 600 }}>{confirmPrimary.repName}</strong> as the primary sales representative. This is different from the customer's default rep
                {customerDefaultRep ? (
                  <> (<strong style={{ color: '#1F2937', fontWeight: 600 }}>{customerDefaultRep.name}</strong>)</>
                ) : null}
                . Would you like to apply this change to:
              </p>

              {/* Option 1 — This Quote Only */}
              <button
                onClick={handleConfirmPrimaryThisQuote}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                  backgroundColor: '#FFFFFF',
                  cursor: 'pointer',
                  textAlign: 'left',
                  marginBottom: '10px',
                  transition: 'all 150ms',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#BFDBFE';
                  e.currentTarget.style.backgroundColor = '#F0F7FF';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#E5E7EB';
                  e.currentTarget.style.backgroundColor = '#FFFFFF';
                }}
              >
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    backgroundColor: '#F3F4F6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: '1px',
                  }}
                >
                  <FileText style={{ width: '16px', height: '16px', color: '#6B7280' }} />
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#1F2937', marginBottom: '4px' }}>
                    This quote only
                  </div>
                  <div style={{ fontSize: '12px', color: '#9CA3AF', lineHeight: '1.4' }}>
                    Change the primary rep for this quote. The customer's default will stay the same.
                  </div>
                </div>
              </button>

              {/* Option 2 — All Future Quotes */}
              <button
                onClick={handleConfirmPrimaryAllFuture}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                  backgroundColor: '#FFFFFF',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 150ms',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#BFDBFE';
                  e.currentTarget.style.backgroundColor = '#F0F7FF';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#E5E7EB';
                  e.currentTarget.style.backgroundColor = '#FFFFFF';
                }}
              >
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    backgroundColor: '#EFF6FF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: '1px',
                  }}
                >
                  <RefreshCw style={{ width: '16px', height: '16px', color: '#1B6EF3' }} />
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#1F2937', marginBottom: '4px' }}>
                    All future quotes
                  </div>
                  <div style={{ fontSize: '12px', color: '#9CA3AF', lineHeight: '1.4' }}>
                    Update the customer's default sales rep in partner records. This will apply to all new quotes.
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}