/* Shared "Add External Link" modal — extracted verbatim from the
 * legacy LinkUrlModal inside AttachmentsTab so every link-picker
 * surface (Deal Info Links section, External Notes composer,
 * Adjustment internal notes) shares one confirmation chrome instead
 * of re-implementing its own. Matches the Partner card-modal chrome
 * used elsewhere in the module: rounded body, muted header separator,
 * primary Add button. */
import { useState } from 'react';
import { X } from 'lucide-react';

interface AddExternalLinkModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (label: string, url: string) => void;
  /** Header label — defaults to "Add External URL" but callers can
   *  reword to match their surface (e.g. "Attach a link to this
   *  note"). */
  title?: string;
  /** Primary button label. Defaults to "Add Link". */
  confirmLabel?: string;
}

export function AddExternalLinkModal({
  open,
  onClose,
  onAdd,
  title = 'Add External URL',
  confirmLabel = 'Add Link',
}: AddExternalLinkModalProps) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');

  if (!open) return null;

  const valid = name.trim() && /^https?:\/\//i.test(url.trim());

  const handleAdd = () => {
    if (!valid) return;
    onAdd(name.trim(), url.trim());
    setName('');
    setUrl('');
  };

  const handleClose = () => {
    setName('');
    setUrl('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 16500, background: 'rgba(0,0,0,0.55)' }}
      onClick={handleClose}
    >
      <div
        className="flex flex-col"
        style={{
          width: 'min(440px, calc(100vw - 32px))',
          background: 'var(--card)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: 'var(--foreground)' }}>{title}</h3>
          <button
            onClick={handleClose}
            style={{ width: 32, height: 32, borderRadius: 8, border: 0, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            className="hover:bg-[var(--surface-secondary)]"
          >
            <X size={18} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>
        <div className="flex flex-col" style={{ padding: 20, gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Display name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Compliance dashboard"
              style={{ width: '100%', height: 36, padding: '0 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', fontSize: 13, color: 'var(--foreground)' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              style={{ width: '100%', height: 36, padding: '0 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', fontSize: 13, color: 'var(--foreground)' }}
            />
          </div>
          <div className="flex" style={{ gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button
              onClick={handleClose}
              className="hover:bg-[var(--surface-secondary)]"
              style={{ height: 36, padding: '0 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', fontSize: 13, fontWeight: 500, color: 'var(--foreground)', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={!valid}
              className="hover:bg-[#0862D0]"
              style={{ height: 36, padding: '0 16px', borderRadius: 8, border: 0, background: valid ? 'var(--primary)' : 'var(--muted)', color: valid ? '#FFFFFF' : 'var(--muted-foreground)', fontSize: 13, fontWeight: 600, cursor: valid ? 'pointer' : 'not-allowed' }}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
