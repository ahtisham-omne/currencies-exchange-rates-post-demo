/* LinkPickerPopover — surfaced from every notes surface (External /
 * Internal / Item / adjustment internal) when the user taps "Attach
 * a link". Shows the document-scoped repository list from
 * `linksRepository`, lets the user attach an existing link with a
 * click, remove a link from the repository via a hover Trash, and
 * offers an "Add new link" affordance that opens the shared
 * AddExternalLinkModal.
 *
 * Rendered via createPortal to document.body with position:fixed so
 * it escapes any ancestor overflow: hidden / stacking-context clipping
 * (the Item Notes card in the line configurator sets overflow: hidden
 * for its rounded chrome). Position is measured off an anchor element
 * the caller wires in, and refreshed on window resize / scroll. */
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link2, Plus, Search, Trash2 } from 'lucide-react';
import {
  addLinkForId,
  getLinksForId,
  removeLinkForId,
  subscribeToLinksRepository,
  type ExternalLink,
} from '../../data/linksRepository';
import { AddExternalLinkModal } from './AddExternalLinkModal';

interface LinkPickerPopoverProps {
  /** Anchor element the popover measures its position off. Callers
   *  attach a ref to the trigger button and pass `.current` here. */
  anchor: HTMLElement | null;
  /** Document id (quote / order id) — scopes the repository. */
  docId: string;
  /** Which link ids are already attached at the call site. The picker
   *  greys those out so the user does not attach the same link twice. */
  attachedIds: string[];
  /** Current user, forwarded to `addLinkForId` when a new link is
   *  created inline. */
  currentUser: string;
  /** Called when the user picks a link (existing or newly created). */
  onPick: (link: ExternalLink) => void;
  /** Close the popover from the parent. */
  onClose: () => void;
}

const POPOVER_WIDTH = 320;
const POPOVER_MAX_HEIGHT = 380;
const POPOVER_GAP = 6;

export function LinkPickerPopover({ anchor, docId, attachedIds, currentUser, onPick, onClose }: LinkPickerPopoverProps) {
  const [query, setQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [version, setVersion] = useState(0);
  const [rect, setRect] = useState<{ top: number; left: number } | null>(null);
  /* Container node held as state (not ref) so the positioning effect
     re-runs the moment the popover mounts. Once we have a node we can
     measure its real height and reposition — otherwise a short list
     would flip above the anchor using the 380px MAX estimate and
     appear floating far above the button. */
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);

  /* Re-render when the shared repository mutates so a link added from
     any other surface appears here without a manual refresh. */
  useEffect(() => subscribeToLinksRepository(() => setVersion((v) => v + 1)), []);

  /* Measure the anchor + reflow on scroll/resize/content-change.
     Position sits under the anchor, right-aligned to its right edge,
     and flips above when it would overflow the viewport bottom. Uses
     the container's measured offsetHeight once it mounts so a short
     popover sits tight against the anchor when flipped upward. */
  useLayoutEffect(() => {
    if (!anchor) return;
    const recompute = () => {
      const r = anchor.getBoundingClientRect();
      const h = containerEl?.offsetHeight ?? POPOVER_MAX_HEIGHT;
      let top = r.bottom + POPOVER_GAP;
      const viewportH = window.innerHeight;
      if (top + h > viewportH - 8) {
        top = Math.max(8, r.top - POPOVER_GAP - h);
      }
      let left = r.right - POPOVER_WIDTH;
      if (left < 8) left = 8;
      if (left + POPOVER_WIDTH > window.innerWidth - 8) {
        left = window.innerWidth - POPOVER_WIDTH - 8;
      }
      setRect({ top, left });
    };
    recompute();
    window.addEventListener('resize', recompute);
    window.addEventListener('scroll', recompute, true);
    /* Watch the container itself so filtering / repo mutations that
       change the list height reposition the popover in place. */
    let ro: ResizeObserver | null = null;
    if (containerEl && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(recompute);
      ro.observe(containerEl);
    }
    return () => {
      window.removeEventListener('resize', recompute);
      window.removeEventListener('scroll', recompute, true);
      ro?.disconnect();
    };
  }, [anchor, containerEl]);

  /* Dismiss on outside click. Skip when the add-link modal is up so
     clicking that modal's inputs does not close the popover behind. */
  useEffect(() => {
    if (showAddModal) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerEl && !containerEl.contains(target) && anchor && !anchor.contains(target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showAddModal, onClose, anchor, containerEl]);

  const links = useMemo(() => {
    const all = getLinksForId(docId);
    if (!query.trim()) return all;
    const q = query.toLowerCase();
    return all.filter((l) => l.label.toLowerCase().includes(q) || l.url.toLowerCase().includes(q));
    // `version` intentionally in deps below to trigger recompute on repo change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId, query, version]);

  const attachedSet = new Set(attachedIds);

  const handleAdd = (label: string, url: string) => {
    const link = addLinkForId(docId, { label, url, addedBy: currentUser });
    setShowAddModal(false);
    onPick(link);
  };

  if (!anchor || !rect) return null;

  return createPortal(
    <>
      <div
        ref={setContainerEl}
        className="flex flex-col"
        style={{
          position: 'fixed',
          top: rect.top,
          left: rect.left,
          width: POPOVER_WIDTH,
          maxHeight: POPOVER_MAX_HEIGHT,
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 12px 32px -8px rgba(15,23,42,0.14), 0 2px 6px -2px rgba(15,23,42,0.08)',
          overflow: 'hidden',
          /* Sits above every host modal in the app (highest today is
             OutdatedConfigsModal at 16000). Anywhere the picker opens
             it needs to escape both regular section overflow AND any
             stacking modal above it. */
          zIndex: 16700,
        }}
      >
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', background: '#FAFBFC' }}>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" style={{ width: 13, height: 13 }} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search links"
              autoFocus
              style={{
                width: '100%',
                height: 32,
                padding: '0 10px 0 30px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: 'var(--card)',
                fontSize: 12.5,
                color: 'var(--foreground)',
              }}
            />
          </div>
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: 260 }}>
          {links.length === 0 && (
            <div className="px-3 py-6 text-center" style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
              {query.trim() ? 'No links match your search.' : 'No links in this repository yet.'}
            </div>
          )}
          {links.map((l) => {
            const isAttached = attachedSet.has(l.id);
            return (
              <div
                key={l.id}
                className="group w-full flex items-start gap-2 px-3 py-2 hover:bg-slate-50 transition-colors"
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                <button
                  type="button"
                  disabled={isAttached}
                  onClick={() => { if (!isAttached) onPick(l); }}
                  className="flex-1 min-w-0 flex items-start gap-2 text-left disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ border: 0, background: 'transparent', padding: 0, cursor: isAttached ? 'not-allowed' : 'pointer' }}
                >
                  <span
                    className="inline-flex items-center justify-center rounded-md shrink-0"
                    style={{ width: 24, height: 24, background: 'var(--accent)', color: 'var(--primary)', marginTop: 1 }}
                  >
                    <Link2 style={{ width: 12, height: 12 }} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] truncate" style={{ fontWeight: 500, color: 'var(--foreground)' }}>
                      {l.label}
                    </div>
                    <div className="text-[11px] truncate" style={{ color: 'var(--muted-foreground)' }}>
                      {l.url}
                    </div>
                  </div>
                </button>
                {isAttached ? (
                  <span className="text-[10px] uppercase tracking-wider shrink-0" style={{ fontWeight: 600, color: 'var(--muted-foreground)', marginTop: 4 }}>
                    Attached
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeLinkForId(docId, l.id); }}
                    aria-label={`Remove ${l.label} from repository`}
                    title="Remove from repository"
                    className="opacity-0 group-hover:opacity-100 shrink-0 inline-flex items-center justify-center rounded-md hover:bg-slate-100 transition-opacity"
                    style={{ width: 22, height: 22, border: 0, background: 'transparent', color: 'var(--muted-foreground)', cursor: 'pointer', marginTop: 1 }}
                  >
                    <Trash2 style={{ width: 12, height: 12 }} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-3 hover:bg-slate-50"
          style={{ height: 36, borderTop: '1px solid var(--border)', background: '#FAFBFC', color: 'var(--primary)', fontSize: 12.5, fontWeight: 600 }}
        >
          <Plus style={{ width: 13, height: 13 }} />
          Add new link
        </button>
      </div>

      <AddExternalLinkModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAdd}
        title="Add a new link"
      />
    </>,
    document.body,
  );
}
