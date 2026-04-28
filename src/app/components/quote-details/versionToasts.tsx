import React from 'react';
import { toast } from 'sonner';
import { GitBranch, FileText } from 'lucide-react';

const TOAST_WIDTH = '340px';

/**
 * Single toast for auto-creating a new draft from a Sent/Confirmed quote.
 * Combines "version created" + "editing as draft" into one notification.
 */
export function showAutoVersionCreatedToast(newVersion: number, fromStatus: string, triggerField: string) {
  toast.custom((id) => (
    <div
      style={{
        display: 'flex', alignItems: 'flex-start', gap: '10px',
        padding: '10px 14px', borderRadius: '8px',
        backgroundColor: '#FFFFFF', border: '1px solid #BFDBFE',
        boxShadow: '0 4px 16px rgba(27,110,243,0.10), 0 1px 4px rgba(0,0,0,0.05)',
        fontFamily: 'Inter, system-ui, sans-serif',
        width: TOAST_WIDTH,
        cursor: 'pointer',
      }}
      onClick={() => toast.dismiss(id)}
    >
      <div style={{
        width: '28px', height: '28px', borderRadius: '6px',
        backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        marginTop: '1px',
      }}>
        <GitBranch style={{ width: '14px', height: '14px', color: '#1D4ED8' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '13px', fontWeight: 600, color: '#1E40AF', lineHeight: 1.2,
          display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          V{newVersion} Draft created
          <span style={{
            fontSize: '9px', fontWeight: 600, color: '#6B7280', backgroundColor: '#F3F4F6',
            padding: '2px 5px', borderRadius: '3px', lineHeight: 1,
          }}>
            was {fromStatus}
          </span>
        </div>
        <div style={{
          fontSize: '11px', color: '#6B7280', marginTop: '3px', lineHeight: 1.3,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {triggerField}
        </div>
      </div>
    </div>
  ), {
    position: 'top-right',
    duration: 4000,
  });
}

/**
 * Toast for non-material change (just logged).
 */
export function showNonMaterialChangeToast(fieldLabel: string) {
  toast.custom((id) => (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '10px 14px', borderRadius: '8px',
        backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB',
        boxShadow: '0 4px 16px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.03)',
        fontFamily: 'Inter, system-ui, sans-serif',
        width: TOAST_WIDTH,
        cursor: 'pointer',
      }}
      onClick={() => toast.dismiss(id)}
    >
      <div style={{
        width: '28px', height: '28px', borderRadius: '6px',
        backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <FileText style={{ width: '14px', height: '14px', color: '#6B7280' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151', lineHeight: 1.2 }}>
          {fieldLabel}
        </div>
        <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '2px', lineHeight: 1.3 }}>
          Logged to activity — no version change
        </div>
      </div>
    </div>
  ), {
    position: 'top-right',
    duration: 2500,
  });
}

/**
 * Toast when user makes changes that accumulate within the current draft version.
 */
export function showMaterialChangeAccumulatedToast(fieldLabel: string, version: number, changeCount: number) {
  toast.custom((id) => (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '10px 14px', borderRadius: '8px',
        backgroundColor: '#FFFFFF', border: '1px solid #BFDBFE',
        boxShadow: '0 4px 16px rgba(27,110,243,0.10), 0 1px 4px rgba(0,0,0,0.05)',
        fontFamily: 'Inter, system-ui, sans-serif',
        width: TOAST_WIDTH,
        cursor: 'pointer',
      }}
      onClick={() => toast.dismiss(id)}
    >
      <div style={{
        width: '28px', height: '28px', borderRadius: '6px',
        backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <GitBranch style={{ width: '14px', height: '14px', color: '#1D4ED8' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '13px', fontWeight: 600, color: '#1E40AF', lineHeight: 1.2,
          display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          {fieldLabel}
          {changeCount > 1 && (
            <span style={{
              fontSize: '9px', fontWeight: 600, color: '#1E40AF', backgroundColor: '#DBEAFE',
              padding: '2px 5px', borderRadius: '3px', lineHeight: 1,
            }}>
              #{changeCount}
            </span>
          )}
        </div>
        <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '2px', lineHeight: 1.3 }}>
          Material change in V{version} draft
        </div>
      </div>
    </div>
  ), {
    position: 'top-right',
    duration: 3000,
  });
}
