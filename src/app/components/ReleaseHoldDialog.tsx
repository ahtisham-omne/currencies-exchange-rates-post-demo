import { useEffect, useRef, useState } from 'react';
import { Lock, Paperclip, RotateCcw, Upload, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/app/components/ui/dialog';
import { DiscardConfirm } from '@/app/components/ui/discard-guard';
import { NotifyToggleCard } from '@/app/components/vendors/SearchableUserPicker';
import { SYSTEM_ROLES, SYSTEM_USERS } from '@/app/data/systemUsers';
import { formatUsDate } from '@/app/lib/dueBucket';

/** Recipient ids (users + roles) → people's names, role members expanded
 *  and deduped — the picker's count math, so names always equal the count
 *  (Nophil 9/22). */
export function releaseRecipientNames(ids: Iterable<string>): string[] {
  const people = new Map<string, string>();
  for (const id of ids) {
    const user = SYSTEM_USERS.find((u) => u.id === id);
    if (user) {
      people.set(user.id, user.name);
      continue;
    }
    const role = SYSTEM_ROLES.find((r) => r.id === id);
    if (role) {
      SYSTEM_USERS.filter((u) => u.role === role.name && u.status === 'Active').forEach((u) => people.set(u.id, u.name));
    }
  }
  return Array.from(people.values());
}

export interface ReleaseHoldResult {
  notes: string;
  /** Set only when Notify is on. */
  recipientIds?: string[];
  recipientNames: string[];
  attachments?: string[];
}

/* ── Release hold confirm — one dialog for invoices and payment runs
 * (user 10/22/26). The capture-modal family recipe (user 9/22): 680px,
 * Release notes ∥ Supporting documents at the locked 104px pair height,
 * NotifyToggleCard closing the form — identical bones to the exception /
 * payment-hold reason modals, worn in the release's emerald. Release
 * recordation (9/4/26 Eli, BB-24); notify offered, never forced (meeting
 * feedback 7/17/26), seeded with the hold's own recipients (Eli 9/23). */
export function ReleaseHoldDialog({
  open,
  onOpenChange,
  description,
  holdBy,
  holdAt,
  seedRecipientIds = [],
  notifyHelper = 'Hold recipients are included. Add anyone else.',
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** One line under the title (user 10/4) naming what the release does. */
  description: string;
  /** Hold provenance chip (user 10/4): who placed the hold and when. */
  holdBy?: string;
  holdAt?: string;
  /** The people notified when the hold was placed, pre-selected. */
  seedRecipientIds?: string[];
  notifyHelper?: string;
  onConfirm: (result: ReleaseHoldResult) => void;
}) {
  const [notify, setNotify] = useState(true);
  const [notes, setNotes] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [recipients, setRecipients] = useState<Set<string>>(new Set());
  const [discardOpen, setDiscardOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const seedKey = [...seedRecipientIds].sort().join(',');

  // Fresh record every time it opens.
  useEffect(() => {
    if (!open) return;
    setNotify(true);
    setNotes('');
    setAttachments([]);
    setRecipients(new Set(seedRecipientIds));
    setDiscardOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Outside-click standard (user 9/22): pristine closes, dirty warns.
  // Recipients arrive pre-seeded, so dirty compares against the seed.
  const dirty = () => !!notes.trim() || attachments.length > 0 || Array.from(recipients).sort().join(',') !== seedKey;
  const guard = (e: Event) => {
    if (dirty()) {
      e.preventDefault();
      setDiscardOpen(true);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 overflow-hidden gap-0 rounded-2xl border-0 max-w-[calc(100%-2rem)] sm:max-w-[680px] bg-white"
        style={{ boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)' }}
        showCloseButton={false}
        onInteractOutside={guard}
        onEscapeKeyDown={guard}
      >
        <div
          className="relative flex flex-col items-center pt-6 pb-4 shrink-0"
          style={{ background: 'linear-gradient(180deg, #ECFDF5 0%, rgba(236,253,245,0.3) 70%, transparent 100%)' }}
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[200px] h-[90px] rounded-full opacity-25 pointer-events-none" style={{ backgroundColor: '#047857', filter: 'blur(50px)' }} />
          <div className="relative w-[56px] h-[56px] rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#D1FAE5' }}>
            <RotateCcw className="w-7 h-7" style={{ color: '#047857', strokeWidth: 2 }} />
          </div>
          <span className="mt-2.5 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: '#ECFDF5', color: '#047857' }}>
            Release Hold
          </span>
        </div>
        <div className="flex flex-col items-center text-center px-6 shrink-0">
          <DialogTitle className="text-[20px] tracking-[-0.02em] text-foreground" style={{ fontWeight: 600, lineHeight: 1.3 }}>
            Release this hold?
          </DialogTitle>
          <DialogDescription className="text-[13px] mt-1.5 mx-auto text-muted-foreground" style={{ lineHeight: 1.6, maxWidth: '440px' }}>
            {description}
          </DialogDescription>
          {holdBy && holdAt && (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] mt-2.5"
              style={{ fontWeight: 500, backgroundColor: '#ECFDF5', borderColor: '#A7F3D0', color: '#047857' }}
            >
              <Lock className="w-3.5 h-3.5" />
              Hold placed by {holdBy} · {formatUsDate(holdAt.slice(0, 10))}
            </span>
          )}
        </div>
        <div className="px-5 sm:px-6 pt-3.5 space-y-3 text-left">
          {/* Release notes ∥ Supporting documents (user 9/9 arrangement):
              the family's parallel evidence pair at the locked height. */}
          <div className="grid sm:grid-cols-2 gap-3 items-start">
            <div className="space-y-1">
              <span className="block text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Release Notes</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Why are you releasing the hold?"
                rows={4}
                className="w-full h-[104px] text-[11px] rounded-md border border-slate-200 bg-white px-3 py-2 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 placeholder:text-[11px] placeholder:text-slate-400 resize-none"
              />
            </div>
            <div className="space-y-1">
              <span className="block text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Supporting Documents</span>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setAttachments((prev) => [...prev, file.name]);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full h-[104px] flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 bg-white px-3 hover:border-primary/50 hover:bg-accent/50 transition-colors cursor-pointer"
              >
                <span className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                  <Upload className="w-4 h-4 text-slate-500" />
                </span>
                <span className="text-[11px] text-slate-600 mt-0.5" style={{ fontWeight: 500 }}>
                  <span className="text-primary" style={{ fontWeight: 600 }}>Click to upload</span> or drag and drop
                </span>
                <span className="text-[10px] text-slate-400">PDF, DOC, XLS, PNG, JPG up to 10MB</span>
              </button>
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {attachments.map((name, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-[11px] text-slate-600" style={{ fontWeight: 500 }}>
                      <Paperclip className="w-2.5 h-2.5 text-slate-400" />
                      <span className="truncate max-w-[140px]">{name}</span>
                      <button
                        type="button"
                        onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                        className="ml-0.5 p-0.5 hover:bg-red-50 rounded-sm text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          {/* Notify closes the form, full width — the system's one
              notify interaction (user 9/9). */}
          <div className="pt-0.5">
            <NotifyToggleCard
              title="Notify People"
              helper={notifyHelper}
              checked={notify}
              onCheckedChange={(v) => setNotify(v === true)}
              selectedIds={recipients}
              onSelectionChange={setRecipients}
              accentColor="#047857"
              accentBg="#ECFDF5"
              accentBorder="#A7F3D0"
              accentText="#047857"
            />
          </div>
        </div>
        <div className="px-5 sm:px-6 pt-3.5 pb-5 flex flex-col gap-2 shrink-0">
          <button
            type="button"
            onClick={() =>
              onConfirm({
                notes: notes.trim(),
                recipientIds: notify ? Array.from(recipients) : undefined,
                recipientNames: notify ? releaseRecipientNames(recipients) : [],
                attachments: attachments.length > 0 ? attachments : undefined,
              })
            }
            className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-opacity hover:opacity-90"
            style={{ fontWeight: 600, backgroundColor: '#047857', color: '#fff' }}
          >
            Release Hold
          </button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors mt-0"
            style={{ fontWeight: 500, backgroundColor: '#F8FAFC', color: '#334155' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F1F5F9'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
          >
            Keep on Hold
          </button>
        </div>
      </DialogContent>
      <DiscardConfirm
        open={discardOpen}
        what="this release record"
        onKeepEditing={() => setDiscardOpen(false)}
        onDiscard={() => {
          setDiscardOpen(false);
          onOpenChange(false);
        }}
      />
    </Dialog>
  );
}
