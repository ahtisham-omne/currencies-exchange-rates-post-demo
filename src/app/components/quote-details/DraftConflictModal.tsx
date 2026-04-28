import { useState } from 'react';
import ReactDOM from 'react-dom';
import { AlertTriangle, RotateCcw, FileText, Pencil, X, ArrowRight } from 'lucide-react';

interface DraftConflictModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingDraftVersion: number;
  revertFromVersion: number;
  onOverwrite: () => void;
  onCreateNew: () => void;
}

export function DraftConflictModal({
  isOpen,
  onClose,
  existingDraftVersion,
  revertFromVersion,
  onOverwrite,
  onCreateNew,
}: DraftConflictModalProps) {
  const [hoveredOption, setHoveredOption] = useState<'overwrite' | 'create' | null>(null);

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10001,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(2px)',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          width: '480px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            padding: '20px 24px 0 24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
              <AlertTriangle style={{ width: '18px', height: '18px', color: '#D97706' }} />
            </div>
            <div>
              <h3
                style={{
                  fontSize: '15px',
                  fontWeight: 600,
                  color: '#1F2937',
                  margin: 0,
                  lineHeight: '1.3',
                }}
              >
                Draft Already Exists
              </h3>
              <span style={{ fontSize: '12px', color: '#6B7280' }}>
                V{existingDraftVersion} is currently a draft
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              color: '#9CA3AF',
              transition: 'all 120ms',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#F3F4F6';
              e.currentTarget.style.color = '#374151';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#9CA3AF';
            }}
          >
            <X style={{ width: '16px', height: '16px' }} />
          </button>
        </div>

        {/* Info callout */}
        <div style={{ padding: '16px 24px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              padding: '10px 14px',
              borderRadius: '8px',
              backgroundColor: '#FFFBEB',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: '#FDE68A',
              marginBottom: '16px',
            }}
          >
            <RotateCcw
              style={{
                width: '14px',
                height: '14px',
                color: '#D97706',
                flexShrink: 0,
                marginTop: '1px',
              }}
            />
            <div style={{ fontSize: '12px', color: '#92400E', lineHeight: '1.5' }}>
              You're reverting from <strong>V{revertFromVersion}</strong> but there's
              already an active draft (<strong>V{existingDraftVersion}</strong>).
              Choose how to proceed:
            </div>
          </div>

          {/* Option cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Overwrite option */}
            <button
              onClick={onOverwrite}
              onMouseEnter={() => setHoveredOption('overwrite')}
              onMouseLeave={() => setHoveredOption(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 14px',
                borderRadius: '8px',
                borderWidth: '1.5px',
                borderStyle: 'solid',
                borderColor: hoveredOption === 'overwrite' ? '#3B82F6' : '#E5E7EB',
                backgroundColor: hoveredOption === 'overwrite' ? '#F0F7FF' : '#FFFFFF',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 150ms',
                fontFamily: 'Inter, system-ui, sans-serif',
                width: '100%',
              }}
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: hoveredOption === 'overwrite' ? '#DBEAFE' : '#F3F4F6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'background-color 150ms',
                }}
              >
                <Pencil
                  style={{
                    width: '16px',
                    height: '16px',
                    color: hoveredOption === 'overwrite' ? '#2563EB' : '#6B7280',
                    transition: 'color 150ms',
                  }}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#1F2937',
                    lineHeight: '1',
                    marginBottom: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  Update Draft V{existingDraftVersion}
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 500,
                      color: '#3B82F6',
                      backgroundColor: '#EFF6FF',
                      padding: '2px 6px',
                      borderRadius: '3px',
                      lineHeight: '1',
                    }}
                  >
                    Recommended
                  </span>
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    color: '#6B7280',
                    lineHeight: '1.3',
                  }}
                >
                  Replace V{existingDraftVersion}'s data with V{revertFromVersion}'s content.
                  Same version number, updated content.
                </div>
              </div>
              <ArrowRight
                style={{
                  width: '14px',
                  height: '14px',
                  color: hoveredOption === 'overwrite' ? '#3B82F6' : '#D1D5DB',
                  flexShrink: 0,
                  transition: 'color 150ms',
                }}
              />
            </button>

            {/* Create new option */}
            <button
              onClick={onCreateNew}
              onMouseEnter={() => setHoveredOption('create')}
              onMouseLeave={() => setHoveredOption(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 14px',
                borderRadius: '8px',
                borderWidth: '1.5px',
                borderStyle: 'solid',
                borderColor: hoveredOption === 'create' ? '#3B82F6' : '#E5E7EB',
                backgroundColor: hoveredOption === 'create' ? '#F0F7FF' : '#FFFFFF',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 150ms',
                fontFamily: 'Inter, system-ui, sans-serif',
                width: '100%',
              }}
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: hoveredOption === 'create' ? '#DBEAFE' : '#F3F4F6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'background-color 150ms',
                }}
              >
                <FileText
                  style={{
                    width: '16px',
                    height: '16px',
                    color: hoveredOption === 'create' ? '#2563EB' : '#6B7280',
                    transition: 'color 150ms',
                  }}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#1F2937',
                    lineHeight: '1',
                    marginBottom: '4px',
                  }}
                >
                  Create New Draft V{existingDraftVersion + 1}
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    color: '#6B7280',
                    lineHeight: '1.3',
                  }}
                >
                  Discard V{existingDraftVersion} draft and create a new version from V{revertFromVersion}.
                </div>
              </div>
              <ArrowRight
                style={{
                  width: '14px',
                  height: '14px',
                  color: hoveredOption === 'create' ? '#3B82F6' : '#D1D5DB',
                  flexShrink: 0,
                  transition: 'color 150ms',
                }}
              />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 24px',
            borderTop: '1px solid #E5E7EB',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onClose}
            style={{
              height: '32px',
              padding: '0 14px',
              borderRadius: '6px',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: '#E5E7EB',
              backgroundColor: '#FFFFFF',
              color: '#6B7280',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'Inter, system-ui, sans-serif',
              transition: 'all 120ms',
              lineHeight: '1',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#F9FAFB';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#FFFFFF';
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
