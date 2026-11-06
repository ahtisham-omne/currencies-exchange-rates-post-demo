import React from 'react';
import { GitBranch, FileText, X } from 'lucide-react';

interface VersionChangePromptModalProps {
  isOpen: boolean;
  fieldLabel: string;        // e.g. "Quote Attachment" or "Item Instruction"
  changeDescription: string; // e.g. "Added spec_sheet.pdf"
  currentVersion: number;
  onCreateNewVersion: () => void;
  onCancel: () => void;
}

export function VersionChangePromptModal({
  isOpen,
  fieldLabel,
  changeDescription,
  currentVersion,
  onCreateNewVersion,
  onCancel,
}: VersionChangePromptModalProps) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.35)',
        backdropFilter: 'blur(2px)',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
      onClick={onCancel}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '440px', maxWidth: '90vw',
          backgroundColor: 'var(--background)',
          borderRadius: '12px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.08)',
          overflow: 'hidden',
          animation: 'slideUp 200ms ease-out',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid var(--muted)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px',
              backgroundColor: 'var(--accent)', border: '1px solid var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <GitBranch style={{ width: '15px', height: '15px', color: 'var(--primary)' }} />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--foreground)', lineHeight: 1.2 }}>
                Create a new version?
              </div>
              <div style={{ fontSize: '12px', color: 'var(--muted-foreground)', marginTop: '2px' }}>
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
              color: 'var(--muted-foreground)', transition: 'all 120ms',
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--muted)'; e.currentTarget.style.color = 'var(--foreground)'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--muted-foreground)'; }}
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
            backgroundColor: 'var(--muted)', border: '1px solid var(--border)',
            marginBottom: '16px',
          }}>
            <FileText style={{ width: '13px', height: '13px', color: 'var(--muted-foreground)', flexShrink: 0 }} />
            <span style={{
              fontSize: '12px', color: 'var(--foreground)', fontWeight: 500,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {changeDescription}
            </span>
          </div>

          <p style={{ fontSize: '13px', color: 'var(--foreground)', lineHeight: 1.6, margin: '0 0 4px 0' }}>
            This change to <strong style={{ fontWeight: 600 }}>{fieldLabel.toLowerCase()}</strong> needs a new version to stay consistent across all customer-visible copies of V{currentVersion}.
          </p>

          {/* Single option — record-only is intentionally not offered so
              the customer-visible quote can never diverge from internal
              state within the same version. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
            <button
              onClick={onCreateNewVersion}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px 14px', borderRadius: '8px',
                border: '1px solid var(--accent)', backgroundColor: 'var(--accent)',
                cursor: 'pointer', textAlign: 'left', transition: 'all 120ms',
                width: '100%',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.1)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div style={{
                width: '28px', height: '28px', borderRadius: '6px',
                backgroundColor: 'var(--accent)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <GitBranch style={{ width: '13px', height: '13px', color: 'var(--primary)' }} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--primary)', lineHeight: 1.2 }}>
                  Create Version {currentVersion + 1}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginTop: '2px' }}>
                  Material change — customer-visible revision
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: '8px',
          padding: '12px 20px', borderTop: '1px solid var(--muted)',
        }}>
          <button
            onClick={onCancel}
            style={{
              height: '32px', padding: '0 14px', borderRadius: '6px',
              border: '1px solid var(--border)', backgroundColor: 'var(--background)',
              color: 'var(--muted-foreground)', fontSize: '13px', fontWeight: 500,
              cursor: 'pointer', transition: 'all 120ms',
              fontFamily: 'Inter, system-ui, sans-serif',
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--background)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
