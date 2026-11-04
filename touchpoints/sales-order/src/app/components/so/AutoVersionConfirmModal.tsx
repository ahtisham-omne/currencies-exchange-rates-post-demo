import React from 'react';
import { GitBranch, AlertTriangle, Undo2, X } from 'lucide-react';

interface AutoVersionConfirmModalProps {
  isOpen: boolean;
  fieldLabel: string;
  oldValue?: string;
  newValue?: string;
  currentVersion: number;
  fromStatus: string;
  onConfirm: () => void;
  onDiscard: () => void;
}

export function AutoVersionConfirmModal({
  isOpen, fieldLabel, oldValue, newValue, currentVersion, fromStatus, onConfirm, onDiscard,
}: AutoVersionConfirmModalProps) {
  if (!isOpen) return null;
  const newVersion = currentVersion + 1;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 'var(--z-modal)', backgroundColor: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(1px)' }}
      onClick={onDiscard}
    >
      <div onClick={e => e.stopPropagation()} className="bg-card" style={{ width: '440px', maxWidth: '90vw', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--elevation-3)', overflow: 'hidden' }}>
        <div className="flex items-center justify-between border-b border-border" style={{ padding: '16px 20px' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)' }}>
              <AlertTriangle style={{ width: '15px', height: '15px', color: '#D97706' }} />
            </div>
            <div>
              <div className="text-foreground" style={{ fontSize: '14px', fontWeight: 600 }}>Create New Version?</div>
              <div className="text-foreground/40" style={{ fontSize: '12px', marginTop: '2px' }}>Material change detected</div>
            </div>
          </div>
          <button onClick={onDiscard} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-secondary transition-colors">
            <X style={{ width: '14px', height: '14px' }} className="text-foreground/25" />
          </button>
        </div>
        <div style={{ padding: '16px 20px' }}>
          <div className="rounded-md" style={{ padding: '10px 12px', backgroundColor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', marginBottom: '14px' }}>
            <div className="text-foreground/50 uppercase tracking-wider" style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.3px', marginBottom: '6px' }}>Change</div>
            <div className="text-foreground" style={{ fontSize: '13px', fontWeight: 600 }}>{fieldLabel}</div>
            {(oldValue || newValue) && (
              <div className="flex items-center gap-1.5 mt-1.5">
                {oldValue && <span className="line-through" style={{ fontSize: '12px', fontWeight: 500, padding: '2px 6px', borderRadius: '3px', backgroundColor: 'rgba(239,68,68,0.1)', color: '#991B1B' }}>{oldValue}</span>}
                {oldValue && newValue && <span className="text-foreground/25" style={{ fontSize: '11px' }}>→</span>}
                {newValue && <span style={{ fontSize: '12px', fontWeight: 500, padding: '2px 6px', borderRadius: '3px', backgroundColor: 'rgba(5,150,105,0.1)', color: '#065F46' }}>{newValue}</span>}
              </div>
            )}
          </div>
          <p className="text-foreground/50" style={{ fontSize: '13px', lineHeight: 1.6, margin: 0 }}>
            The order is currently <strong className="text-foreground" style={{ fontWeight: 600 }}>{fromStatus}</strong>.
            This change requires creating a new draft version (V{newVersion}).
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border" style={{ padding: '12px 20px' }}>
          <button onClick={onDiscard} className="flex items-center gap-1.5 text-foreground/40 border border-border rounded-md hover:bg-secondary transition-colors" style={{ height: '32px', padding: '0 14px', fontSize: '13px', fontWeight: 500 }}>
            <Undo2 style={{ width: '13px', height: '13px' }} /> Discard Change
          </button>
          <button onClick={onConfirm} className="flex items-center gap-1.5 text-white rounded-md transition-colors" style={{ height: '32px', padding: '0 16px', fontSize: '13px', fontWeight: 500, backgroundColor: 'var(--primary)', border: 'none' }}>
            <GitBranch style={{ width: '13px', height: '13px' }} /> Create V{newVersion} Draft
          </button>
        </div>
      </div>
    </div>
  );
}
