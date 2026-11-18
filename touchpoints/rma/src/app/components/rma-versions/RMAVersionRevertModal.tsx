import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from '@/app/components/ui/alert-dialog';

/**
 * Revert-to-version confirmation. Ported from the Purchase Order module's
 * `POVersionRevertModal.tsx`.
 *
 * Built on the Radix AlertDialog primitive so the layer stack routes pointer
 * events correctly when this opens over another dialog.
 */

/* Kills shadcn's translate-50% centering and re-centers inline, since
   tailwind-merge can drop the layout classes when defaults are overridden. */
const positioningStyle: React.CSSProperties = {
  position: 'fixed',
  top: '50%',
  left: '50%',
  right: 'auto',
  bottom: 'auto',
  translate: 'none',
  transform: 'translate(-50%, -50%)',
  margin: 0,
  width: 'calc(100% - 2rem)',
  height: 'auto',
  maxWidth: 440,
  maxHeight: 'calc(100dvh - 2rem)',
  backgroundColor: '#FFFFFF',
  borderRadius: 16,
  boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)',
  zIndex: 14000,
};

export default function RMAVersionRevertModal({
  version,
  onClose,
  onConfirm,
}: {
  version: number;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');

  return (
    <AlertDialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <AlertDialogContent
        className="p-0 gap-0 overflow-hidden border-0"
        style={positioningStyle}
      >
        <div
          className="relative flex flex-col items-center pt-10 pb-6"
          style={{
            background:
              'linear-gradient(180deg, #FEF2F2 0%, rgba(254,242,242,0.3) 70%, transparent 100%)',
          }}
        >
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 rounded-full blur-[50px] opacity-25"
            style={{ width: 180, height: 80, backgroundColor: '#EF4444' }}
          />
          <div
            className="relative flex items-center justify-center"
            style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: '#FEE2E2' }}
          >
            <AlertTriangle style={{ width: 32, height: 32, color: 'hsl(var(--destructive))' }} />
          </div>
          <span
            className="mt-4 rounded-full"
            style={{
              padding: '4px 12px',
              fontSize: 11,
              fontWeight: 600,
              color: '#991B1B',
              backgroundColor: '#FEF2F2',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Revert to V{version}
          </span>
        </div>

        <div className="flex flex-col items-center text-center px-8 pb-8">
          <AlertDialogHeader className="p-0 gap-0 text-center">
            <AlertDialogTitle
              className="tracking-[-0.02em]"
              style={{ fontSize: 18, fontWeight: 600, color: '#0F172A' }}
            >
              Revert to V{version}?
            </AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription
            className="mt-2 mx-auto"
            style={{ fontSize: 13, color: '#64748B', lineHeight: 1.65, maxWidth: 320 }}
          >
            V{version} becomes the current version again, with the lines and details it
            recorded. The status stays where it is and no new version is made. The
            versions in between stay in the history.
          </AlertDialogDescription>

          <div className="w-full mt-5 text-left">
            <label
              className="block"
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#64748B',
                marginBottom: 6,
                lineHeight: 1,
              }}
            >
              Reason for revert{' '}
              <span style={{ color: '#94A3B8', fontWeight: 400 }}>(optional)</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Vendor withdrew the authorization and asked for the original request"
              rows={3}
              className="w-full"
              style={{
                fontSize: 13,
                fontWeight: 400,
                color: '#0F172A',
                border: '1px solid #E2E8F0',
                borderRadius: 8,
                padding: '10px 12px',
                outline: 'none',
                resize: 'none',
                lineHeight: 1.5,
                boxSizing: 'border-box',
                transition: 'border-color 150ms, box-shadow 150ms',
                backgroundColor: '#FFFFFF',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'rgba(10,119,255,0.4)';
                e.currentTarget.style.boxShadow = '0 0 0 2px rgba(10,119,255,0.15)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#E2E8F0';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>

          <div className="w-full mt-7 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => onConfirm(reason.trim())}
              className="w-full transition-all"
              style={{
                height: 44,
                fontSize: 14,
                fontWeight: 600,
                borderRadius: 12,
                border: 0,
                backgroundColor: 'hsl(var(--destructive))',
                color: '#FFFFFF',
                cursor: 'pointer',
              }}
            >
              Revert to V{version}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full transition-colors hover:opacity-90"
              style={{
                height: 44,
                fontSize: 14,
                fontWeight: 500,
                borderRadius: 12,
                border: 0,
                backgroundColor: '#F1F5F9',
                color: '#334155',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
