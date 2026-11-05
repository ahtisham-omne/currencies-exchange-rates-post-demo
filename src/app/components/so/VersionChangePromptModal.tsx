import React from 'react';
import { GitBranch, FileText, X } from 'lucide-react';

interface VersionChangePromptModalProps {
  isOpen: boolean;
  fieldLabel: string;
  changeDescription: string;
  currentVersion: number;
  onCreateNewVersion: () => void;
  onKeepCurrentVersion: () => void;
  onCancel: () => void;
}

export function VersionChangePromptModal({
  isOpen, fieldLabel, changeDescription, currentVersion,
  onCreateNewVersion, onKeepCurrentVersion, onCancel,
}: VersionChangePromptModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 50000, backgroundColor: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(1px)' }}
      onClick={onCancel}
    >
      <div onClick={e => e.stopPropagation()} className="bg-card"
        style={{ width: '440px', maxWidth: '90vw', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--elevation-3)', overflow: 'hidden' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border" style={{ padding: '16px 20px' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'rgba(10,119,255,0.08)', border: '1px solid rgba(10,119,255,0.2)' }}>
              <GitBranch style={{ width: '15px', height: '15px', color: '#2563EB' }} />
            </div>
            <div>
              <div className="text-foreground" style={{ fontSize: '14px', fontWeight: 600 }}>Create a new version?</div>
              <div className="text-muted-foreground" style={{ fontSize: '12px', marginTop: '2px' }}>{fieldLabel} change detected</div>
            </div>
          </div>
          <button onClick={onCancel} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-secondary transition-colors">
            <X style={{ width: '14px', height: '14px' }} className="text-foreground/25" />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 20px' }}>
          <div className="flex items-center gap-2 rounded-md"
            style={{ padding: '10px 12px', backgroundColor: 'var(--secondary)', border: '1px solid var(--border)', marginBottom: '16px' }}>
            <FileText style={{ width: '13px', height: '13px', color: '#6B7280', flexShrink: 0 }} />
            <span style={{ fontSize: '12px', color: '#374151', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {changeDescription}
            </span>
          </div>

          <p className="text-foreground/50" style={{ fontSize: '13px', lineHeight: 1.6, margin: '0 0 4px 0' }}>
            This change to <strong className="text-foreground" style={{ fontWeight: 600 }}>{fieldLabel.toLowerCase()}</strong> can either:
          </p>

          {/* Option cards */}
          <div className="flex flex-col gap-2 mt-3">
            <button onClick={onCreateNewVersion}
              className="flex items-center gap-3 w-full text-left transition-all rounded-lg"
              style={{ padding: '12px 14px', border: '1px solid #BFDBFE', backgroundColor: '#F0F7FF' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#3B82F6'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.1)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#BFDBFE'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: '#DBEAFE' }}>
                <GitBranch style={{ width: '13px', height: '13px', color: '#1D4ED8' }} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#1E40AF', lineHeight: 1.2 }}>Create Version {currentVersion + 1}</div>
                <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '2px' }}>Material change — customer-visible revision</div>
              </div>
            </button>

            <button onClick={onKeepCurrentVersion}
              className="flex items-center gap-3 w-full text-left transition-all rounded-lg"
              style={{ padding: '12px 14px', border: '1px solid #E5E7EB', backgroundColor: '#FFFFFF' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.backgroundColor = '#F9FAFB'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
            >
              <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: '#F3F4F6' }}>
                <FileText style={{ width: '13px', height: '13px', color: '#6B7280' }} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151', lineHeight: 1.2 }}>Keep V{currentVersion} — record only</div>
                <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '2px' }}>Internal update — logged in activity, no version bump</div>
              </div>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-border" style={{ padding: '12px 20px' }}>
          <button onClick={onCancel}
            className="border border-border rounded-md hover:bg-secondary transition-colors text-muted-foreground"
            style={{ height: '32px', padding: '0 14px', fontSize: '13px', fontWeight: 500 }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
