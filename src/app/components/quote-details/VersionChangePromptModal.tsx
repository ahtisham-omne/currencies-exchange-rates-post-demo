import React from 'react';
import { GitBranch, FileText, X } from 'lucide-react';

interface VersionChangePromptModalProps {
  isOpen: boolean;
  fieldLabel: string;        // e.g. "Quote Attachment" or "Item Instruction"
  changeDescription: string; // e.g. "Added spec_sheet.pdf"
  currentVersion: number;
  onCreateNewVersion: () => void;
  onKeepCurrentVersion: () => void;
  onCancel: () => void;
}

export function VersionChangePromptModal({
  isOpen,
  fieldLabel,
  changeDescription,
  currentVersion,
  onCreateNewVersion,
  onKeepCurrentVersion,
  onCancel,
}: VersionChangePromptModalProps) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.35)',
        backdropFilter: 'blur(1px)',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
      onClick={onCancel}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '440px', maxWidth: '90vw',
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.08)',
          overflow: 'hidden',
          animation: 'slideUp 200ms ease-out',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid #F3F4F6',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px',
              backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <GitBranch style={{ width: '15px', height: '15px', color: '#2563EB' }} />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827', lineHeight: 1.2 }}>
                Create a new version?
              </div>
              <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>
                {fieldLabel} change detected
              </div>
            </div>
          </div>
          <button
            onClick={onCancel}
            style={{
              width: '28px', height: '28px', borderRadius: '6px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', backgroundColor: 'transparent', cursor: 'pointer',
              color: '#9CA3AF', transition: 'all 120ms',
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#F3F4F6'; e.currentTarget.style.color = '#374151'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#9CA3AF'; }}
          >
            <X style={{ width: '14px', height: '14px' }} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 20px' }}>
          {/* Change description */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 12px', borderRadius: '6px',
            backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB',
            marginBottom: '16px',
          }}>
            <FileText style={{ width: '13px', height: '13px', color: '#6B7280', flexShrink: 0 }} />
            <span style={{
              fontSize: '12px', color: '#374151', fontWeight: 500,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {changeDescription}
            </span>
          </div>

          <p style={{ fontSize: '13px', color: '#4B5563', lineHeight: 1.6, margin: '0 0 4px 0' }}>
            This change to <strong style={{ fontWeight: 600 }}>{fieldLabel.toLowerCase()}</strong> can either:
          </p>

          {/* Option cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
            {/* Option 1: New version */}
            <button
              onClick={onCreateNewVersion}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px 14px', borderRadius: '8px',
                border: '1px solid #BFDBFE', backgroundColor: '#F0F7FF',
                cursor: 'pointer', textAlign: 'left', transition: 'all 120ms',
                width: '100%',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#3B82F6'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.1)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#BFDBFE'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div style={{
                width: '28px', height: '28px', borderRadius: '6px',
                backgroundColor: '#DBEAFE', display: 'flex',
                alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <GitBranch style={{ width: '13px', height: '13px', color: '#1D4ED8' }} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#1E40AF', lineHeight: 1.2 }}>
                  Create Version {currentVersion + 1}
                </div>
                <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '2px' }}>
                  Material change — customer-visible revision
                </div>
              </div>
            </button>

            {/* Option 2: Record only */}
            <button
              onClick={onKeepCurrentVersion}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px 14px', borderRadius: '8px',
                border: '1px solid #E5E7EB', backgroundColor: '#FFFFFF',
                cursor: 'pointer', textAlign: 'left', transition: 'all 120ms',
                width: '100%',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.backgroundColor = '#F9FAFB'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
            >
              <div style={{
                width: '28px', height: '28px', borderRadius: '6px',
                backgroundColor: '#F3F4F6', display: 'flex',
                alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <FileText style={{ width: '13px', height: '13px', color: '#6B7280' }} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151', lineHeight: 1.2 }}>
                  Keep V{currentVersion} — record only
                </div>
                <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '2px' }}>
                  Internal update — logged in activity, no version bump
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: '8px',
          padding: '12px 20px', borderTop: '1px solid #F3F4F6',
        }}>
          <button
            onClick={onCancel}
            style={{
              height: '32px', padding: '0 14px', borderRadius: '6px',
              border: '1px solid #E5E7EB', backgroundColor: '#FFFFFF',
              color: '#6B7280', fontSize: '13px', fontWeight: 500,
              cursor: 'pointer', transition: 'all 120ms',
              fontFamily: 'Inter, system-ui, sans-serif',
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#F9FAFB'; e.currentTarget.style.borderColor = '#D1D5DB'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#FFFFFF'; e.currentTarget.style.borderColor = '#E5E7EB'; }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
