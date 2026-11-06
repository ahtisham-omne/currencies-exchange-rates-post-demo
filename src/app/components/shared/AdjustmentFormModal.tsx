import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { ChevronDown, Check, Package, Paperclip, X, FileText, Image as ImageIcon, File, Upload, Search, TrendingUp, TrendingDown, Trash2, Maximize2, Minimize2, Link2 } from 'lucide-react';
import { ConfirmDiscardModal } from './ConfirmDiscardModal';
import { ItemTypeBadge } from './ItemTypeBadge';
import { InactiveItemPill } from './InactiveItemPill';
import { AttachedLinkChip } from './AttachedLinkChip';
import { LinkPickerPopover } from './LinkPickerPopover';
import { getLineItemImage } from '../../data/lineItemImage';
import { getLinksForId, subscribeToLinksRepository, type ExternalLink } from '../../data/linksRepository';

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

/* Centralised color tokens. Bridges the Partner-faithful design-system
   tokens (`var(--border)`, `var(--primary)`, etc.) with the literal
   neutrals this modal needs that aren't yet in either module's token
   set. Pulled to the top so a future theme/dark-mode pass has a single
   surface to touch instead of dozens of inline hex strings.

   The discount/premium accents stay literal — they're semantic
   (green = saves money, violet = adds cost) and not represented in
   the Partner token catalogue. */
const FIELD_BORDER = 'var(--border)';
const INPUT_FOCUS_BORDER = '#0A77FF';
const INPUT_FOCUS_RING = '0 0 0 3px rgba(10,119,255,0.12)';
const TEXT_BODY = 'var(--foreground)';
const TEXT_LABEL = '#374151';
const TEXT_MUTED = '#9CA3AF';
const TEXT_DIM = '#6B7280';
const SURFACE_WHITE = '#FFFFFF';
const SURFACE_TONED = '#F9FAFB';
const SURFACE_PANEL = '#FAFBFC';
const PRIMARY_BG = 'var(--primary)';
const PRIMARY_BG_HOVER = '#0862D0';
const PRIMARY_BG_DISABLED = '#E5E7EB';

const ACCENT_DISCOUNT = { text: '#047857', bg: '#ECFDF5', border: '#D1FAE5', strong: '#059669' };
const ACCENT_PREMIUM = { text: '#6D28D9', bg: '#F5F3FF', border: '#EDE9FE', strong: '#6D28D9' };

export interface LineItemForSelection {
  /** Stable row id — used internally for matching applied-to references. */
  id: string;
  /** Product / SKU code (e.g. "000-100-002"). Displayed in the Part Number
   *  column when present; falls back to `id` for legacy callers. */
  code?: string;
  description: string;
  subtotal: number;
  thumbColor?: string;
  qty?: number;
  type?: 'Serialized' | 'Non-Serialized' | 'Lot Serialized' | 'Lot Non-Serialized';
}

/** A file attached to the adjustment's internal notes. */
export interface AdjustmentAttachment { id: string; name: string; size: string; type: string }

export interface AdjustmentFormData {
  id?: string;
  label: string;
  type: 'discount' | 'premium';
  amountType: '$' | '%';
  amount: number;
  scope: 'item' | 'quote';
  appliedTo?: string[];
  internalNotes?: string;
  /** Ids of external links attached to the internal notes body.
   *  Links themselves live in the shared `linksRepository` keyed by
   *  the parent record so the same URL can be referenced from
   *  multiple surfaces without duplication. */
  internalNoteLinks?: string[];
  /** Files attached to the internal notes. Saved with the adjustment so
   *  they are still listed when the form is reopened to edit it. */
  attachments?: AdjustmentAttachment[];
}

interface AdjustmentFormModalProps {
  mode: 'add' | 'edit';
  scope: 'quote' | 'item';
  initial?: AdjustmentFormData;
  lineItems?: LineItemForSelection[];
  /** Per-module label substituted into the subtitle and the
   *  attachments helper text. The scope value stays `'quote'` for the
   *  document-wide variant (legacy data shape); this prop is purely a
   *  copy switch so the SO module reads as "...to this order" and
   *  "Attachments will also appear in the order's Attachments tab".
   *  Defaults to `'quote'` for back-compat with existing call sites. */
  recordLabel?: 'quote' | 'order';
  /** Parent record id (quote / SO). When provided, the internal-notes
   *  body renders a link-picker affordance backed by the shared
   *  `linksRepository`. Omitted for legacy callers so the picker is
   *  additive without churning existing screens. */
  docId?: string;
  /** Current user's display name, forwarded to `addLinkForId` when a
   *  new link is created inline via the picker. */
  currentUser?: string;
  onSave: (adj: AdjustmentFormData) => void;
  onCancel: () => void;
}

export function AdjustmentFormModal({
  mode,
  scope,
  initial,
  lineItems,
  recordLabel = 'quote',
  docId,
  currentUser = 'Sarah Chen',
  onSave,
  onCancel,
}: AdjustmentFormModalProps) {
  // Determine if we should show the items selection panel
  const showItemsPanel = scope === 'item' && lineItems && lineItems.length > 0;

  const [type, setType] = useState<'discount' | 'premium'>(initial?.type || 'discount');
  // Starts empty so the "0" placeholder never becomes a leading digit ("01.23").
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  const [amountType, setAmountType] = useState<'$' | '%'>(initial?.amountType || '%');
  const [label, setLabel] = useState(initial?.label || '');
  const [selectedItems, setSelectedItems] = useState<string[]>(
    initial?.appliedTo || (showItemsPanel && lineItems ? lineItems.map(i => i.id) : [])
  );

  // Internal notes + attachments (always visible)
  const [internalNotes, setInternalNotes] = useState(initial?.internalNotes || '');
  const [noteAttachments, setNoteAttachments] = useState<AdjustmentAttachment[]>(initial?.attachments || []);
  /* Ids of external links attached to internal notes. Rendered as
     chips under the textarea; the picker is only surfaced when a
     `docId` is provided so legacy callers stay opt-in. */
  const [internalNoteLinkIds, setInternalNoteLinkIds] = useState<string[]>(initial?.internalNoteLinks || []);
  const [showLinkPicker, setShowLinkPicker] = useState(false);
  const [linkPickerAnchor, setLinkPickerAnchor] = useState<HTMLButtonElement | null>(null);
  /* Re-render on repo mutation so a link added inline via the picker
     appears in the chip row immediately. */
  const [linksRepoVersion, setLinksRepoVersion] = useState(0);
  useEffect(() => subscribeToLinksRepository(() => setLinksRepoVersion((v) => v + 1)), []);
  void linksRepoVersion;
  const repoLinks: ExternalLink[] = docId ? getLinksForId(docId) : [];
  const attachedLinks: ExternalLink[] = internalNoteLinkIds
    .map((id) => repoLinks.find((l) => l.id === id))
    .filter((l): l is ExternalLink => Boolean(l));
  const [itemSearch, setItemSearch] = useState('');
  const [isDragActive, setIsDragActive] = useState(false);
  const [hoveredAttachmentId, setHoveredAttachmentId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files).map(f => ({
      id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: f.name,
      size: f.size < 1024 * 1024 ? `${(f.size / 1024).toFixed(0)} KB` : `${(f.size / (1024 * 1024)).toFixed(1)} MB`,
      type: f.name.split('.').pop()?.toLowerCase() || 'file',
    }));
    setNoteAttachments(prev => [...prev, ...newFiles]);
  };

  const removeAttachment = (id: string) => {
    setNoteAttachments(prev => prev.filter(a => a.id !== id));
  };

  const getFileIcon = (type: string) => {
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(type)) return ImageIcon;
    if (['pdf', 'doc', 'docx'].includes(type)) return FileText;
    return File;
  };

  /* PI-style file-type → background color map. Mirrors Physical
     Inventory's `FILE_THUMB` so the attachment chrome in this modal
     reads as the same family as the Attachments tab. Tokens stay
     literal here because PI's `var(--tx-type-negative-bg)` etc. don't
     exist in the Quote/SO theme yet — when those land, swap the
     values without touching the call sites. */
  const getFileChip = (type: string) => {
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(type))
      return { bg: '#CCFBF1', color: '#0F766E' };          // teal — image
    if (['pdf'].includes(type))
      return { bg: '#FEE2E2', color: '#B91C1C' };          // red — pdf
    if (['xlsx', 'xls', 'csv'].includes(type))
      return { bg: '#D1FAE5', color: '#047857' };          // green — spreadsheet
    if (['doc', 'docx', 'txt'].includes(type))
      return { bg: '#DBEAFE', color: '#1E40AF' };          // blue — document
    return { bg: '#F1F5F9', color: '#475569' };            // slate — other
  };

  const canSave = parseFloat(amount) > 0 && (!showItemsPanel || selectedItems.length > 0);

  /* Multi-line-impact gate. When the user is about to save an
     adjustment that targets more than one line item we surface a
     warning confirm so the multi-line ripple to unit totals and
     order total is intentional. Single-line saves go through
     untouched. */
  const [showMultiConfirm, setShowMultiConfirm] = useState(false);
  /* Full-view toggle — mirrors the parent `ManageAdjustmentsModal` so
     the items table can stretch to the full viewport when the user
     wants more room to pick items. The toggle button lives next to
     the X close in the header. */
  const [fullView, setFullView] = useState(false);
  const pendingDataRef = useRef<AdjustmentFormData | null>(null);

  const handleSave = () => {
    if (!canSave) return;
    const data: AdjustmentFormData = {
      id: initial?.id,
      label: label.trim(),
      type,
      amountType,
      amount: parseFloat(amount) || 0,
      scope,
      appliedTo: scope === 'item' ? selectedItems : initial?.appliedTo,
      internalNotes,
      internalNoteLinks: internalNoteLinkIds.length ? internalNoteLinkIds : undefined,
      attachments: noteAttachments.length ? noteAttachments : undefined,
    };
    const appliedTo = data.appliedTo ?? [];
    if (appliedTo.length > 1) {
      pendingDataRef.current = data;
      setShowMultiConfirm(true);
      return;
    }
    onSave(data);
  };

  const toggleItem = (itemId: string) => {
    setSelectedItems(prev => {
      if (prev.includes(itemId)) {
        if (prev.length <= 1) return prev; // keep at least one
        return prev.filter(id => id !== itemId);
      }
      return [...prev, itemId];
    });
  };

  const toggleAll = () => {
    if (!lineItems || lineItems.length === 0) return;
    if (selectedItems.length === lineItems.length) {
      setSelectedItems([lineItems[0].id]); // keep at least one
    } else {
      setSelectedItems(lineItems.map(i => i.id));
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (canSave) handleSave();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });

  // Color semantics: emerald for discount (saves money), violet for
  // premium (adds cost). Action buttons always use the system primary
  // blue — never the accent — so the save CTA stays consistent.
  const isDiscount = type === 'discount';

  const title = mode === 'add'
    ? `Add One-Time ${isDiscount ? 'Discount' : 'Premium'}`
    : `Edit ${isDiscount ? 'Discount' : 'Premium'}`;
  const subtitle = scope === 'item'
    ? `Apply a custom ${isDiscount ? 'discount' : 'premium'} to selected line items`
    : `Apply a custom ${isDiscount ? 'discount' : 'premium'} to this ${recordLabel}`;

  // ── Notes & Attachments Section (shared) ──
  // Margin removed — the section now lives in its own white card with
  // gap spacing from the parent layout.
  const notesAndAttachmentsSection = (
    <div>
      <label style={{ fontSize: 13, fontWeight: 500, color: TEXT_LABEL, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <Paperclip style={{ width: 13, height: 13, color: TEXT_MUTED }} />
        Internal Notes
        <span style={{ fontSize: 11, fontWeight: 400, color: TEXT_MUTED }}>(optional)</span>
      </label>
      <textarea
        value={internalNotes}
        onChange={(e) => setInternalNotes(e.target.value)}
        placeholder="Internal justification, approval references, pricing rationale..."
        style={{
          width: '100%', height: 72, padding: '8px 12px',
          fontSize: 13, color: TEXT_BODY,
          borderWidth: 1, borderStyle: 'solid', borderColor: FIELD_BORDER,
          borderRadius: 8, outline: 'none',
          fontFamily: 'Inter, system-ui, sans-serif',
          boxSizing: 'border-box' as const,
          resize: 'vertical',
          lineHeight: 1.5,
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = INPUT_FOCUS_BORDER; e.currentTarget.style.boxShadow = INPUT_FOCUS_RING; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = FIELD_BORDER; e.currentTarget.style.boxShadow = 'none'; }}
      />
      {/* Attach-link affordance disabled — chip render + picker code
          preserved as a commented block so we can reintroduce the
          per-note attach flow later.
          {docId && (
            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
              {attachedLinks.map((link) => (
                <AttachedLinkChip
                  key={link.id}
                  link={link}
                  onRemove={() => setInternalNoteLinkIds((prev) => prev.filter((id) => id !== link.id))}
                />
              ))}
              <button
                ref={setLinkPickerAnchor}
                type="button"
                onClick={() => setShowLinkPicker((v) => !v)}
                className="inline-flex items-center gap-1 rounded-full hover:bg-slate-50 transition-colors"
                style={{ padding: '2px 10px', border: '1px dashed var(--border)', background: 'var(--card)',
                  color: 'var(--muted-foreground)', fontSize: 11.5, fontWeight: 500, cursor: 'pointer' }}
              >
                <Link2 style={{ width: 11, height: 11 }} />
                Attach a link
              </button>
              {showLinkPicker && (
                <LinkPickerPopover
                  anchor={linkPickerAnchor}
                  docId={docId}
                  attachedIds={internalNoteLinkIds}
                  currentUser={currentUser}
                  onPick={(link) => {
                    setInternalNoteLinkIds((prev) => (prev.includes(link.id) ? prev : [...prev, link.id]));
                    setShowLinkPicker(false);
                  }}
                  onClose={() => setShowLinkPicker(false)}
                />
              )}
            </div>
          )}
      */}
      {/* Attachment area — mirrors Physical Inventory's
          `ModalAttachmentsField` chrome: a dashed-border dropzone with
          icon tile + "Click to upload or drag and drop" CTA, plus
          drag-active styling that flips border + tile background to
          the primary accent. File rows below pick up PI's hover-to-
          reveal delete affordance with red-on-hover. */}
      <div style={{ marginTop: '10px' }}>
        {/* Dashed dropzone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragActive(true); }}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDragLeave={(e) => {
            /* Only flip off when leaving the dropzone itself, not a
               child element — without this the tile flickers as the
               cursor crosses the inner icon. */
            if (e.currentTarget === e.target) setIsDragActive(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragActive(false);
            handleFileSelect(e.dataTransfer.files);
          }}
          style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '10px 12px',
            borderWidth: '2px', borderStyle: 'dashed',
            borderColor: isDragActive ? PRIMARY_BG : FIELD_BORDER,
            borderRadius: '8px',
            backgroundColor: isDragActive ? 'rgba(10,119,255,0.06)' : SURFACE_WHITE,
            cursor: 'pointer',
            transition: 'all 120ms ease',
            boxSizing: 'border-box' as const,
          }}
          onMouseEnter={(e) => {
            if (!isDragActive) {
              e.currentTarget.style.borderColor = '#CBD5E1';
              e.currentTarget.style.backgroundColor = SURFACE_PANEL;
            }
          }}
          onMouseLeave={(e) => {
            if (!isDragActive) {
              e.currentTarget.style.borderColor = FIELD_BORDER;
              e.currentTarget.style.backgroundColor = SURFACE_WHITE;
            }
          }}
        >
          <div
            style={{
              width: 36, height: 36, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: isDragActive ? '#D6E8FF' : 'var(--muted)',
              color: isDragActive ? PRIMARY_BG : '#94A3B8',
              transition: 'all 120ms ease',
              flexShrink: 0,
            }}
          >
            <Upload style={{ width: 16, height: 16 }} />
          </div>
          <div style={{ minWidth: 0, lineHeight: 1.4 }}>
            <div style={{ fontSize: 13, color: TEXT_LABEL, fontWeight: 500 }}>
              <span style={{ color: PRIMARY_BG }}>Click to upload</span> or drag and drop
            </div>
            <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 2 }}>
              Any file type, up to multiple files at once
            </div>
          </div>
        </div>

        {/* File rows */}
        {noteAttachments.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
            {noteAttachments.map((att) => {
              const FIcon = getFileIcon(att.type);
              const chip = getFileChip(att.type);
              const isHover = hoveredAttachmentId === att.id;
              return (
                <div
                  key={att.id}
                  onMouseEnter={() => setHoveredAttachmentId(att.id)}
                  onMouseLeave={() => setHoveredAttachmentId(null)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 10px',
                    backgroundColor: isHover ? SURFACE_PANEL : SURFACE_WHITE,
                    border: `1px solid ${FIELD_BORDER}`,
                    borderRadius: 8,
                    transition: 'background-color 100ms',
                  }}
                >
                  {/* File-type icon tile — matches PI's per-extension color. */}
                  <div
                    style={{
                      width: 28, height: 28, borderRadius: 6,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      backgroundColor: chip.bg, color: chip.color,
                      flexShrink: 0,
                    }}
                  >
                    <FIcon style={{ width: 14, height: 14 }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0, lineHeight: 1.3 }}>
                    <div
                      title={att.name}
                      style={{
                        fontSize: 12.5, color: TEXT_LABEL, fontWeight: 500,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}
                    >
                      {att.name}
                    </div>
                    <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 1 }}>
                      {att.size} · .{att.type.toUpperCase()}
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeAttachment(att.id); }}
                    style={{
                      width: 26, height: 26, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: 'none', background: 'none', cursor: 'pointer',
                      borderRadius: 6, padding: 0,
                      color: TEXT_DIM,
                      opacity: isHover ? 1 : 0,
                      transition: 'opacity 120ms, background-color 100ms, color 100ms',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#FEE2E2';
                      e.currentTarget.style.color = '#DC2626';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = TEXT_DIM;
                    }}
                    title="Remove attachment"
                    aria-label={`Remove ${att.name}`}
                  >
                    <Trash2 style={{ width: 13, height: 13 }} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <input
          type="file"
          ref={fileInputRef}
          multiple
          onChange={(e) => { handleFileSelect(e.target.files); e.target.value = ''; }}
          style={{ display: 'none' }}
        />
        <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 8, lineHeight: 1.4 }}>
          Attachments will also appear in the {recordLabel}'s Attachments tab under Item Attachments.
        </div>
      </div>
    </div>
  );

  // ── Amount unit segmented control — Partner-style two-button
  //    selector (% / $) replacing the cramped single toggle with an
  //    `ArrowUpDown` glyph. Reads as a real segmented control: the
  //    active option highlights, the inactive option dims. ──
  const amountToggleButton = (
    <div
      role="radiogroup"
      aria-label="Amount unit"
      style={{
        display: 'inline-flex',
        height: 38, flexShrink: 0,
        border: `1px solid ${FIELD_BORDER}`,
        borderLeftWidth: 0,
        borderTopRightRadius: 8, borderBottomRightRadius: 8,
        backgroundColor: SURFACE_TONED,
        overflow: 'hidden',
      }}
    >
      {(['%', '$'] as const).map((unit) => {
        const active = amountType === unit;
        return (
          <button
            key={unit}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setAmountType(unit)}
            style={{
              width: 30,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 600,
              color: active ? TEXT_BODY : TEXT_MUTED,
              backgroundColor: active ? SURFACE_WHITE : 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'Inter, system-ui, sans-serif',
              transition: 'background-color 100ms, color 100ms',
              boxShadow: active ? `inset 0 0 0 1px ${FIELD_BORDER}` : 'none',
            }}
            title={unit === '%' ? 'Percentage' : 'Fixed amount'}
          >
            {unit}
          </button>
        );
      })}
    </div>
  );

  // ── Form fields (Type, Amount, Label) ──
  const formFieldsSection = (
    <>
      {/* Type + Amount row — side by side */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        {/* Type dropdown */}
        <div style={{ width: 140, flexShrink: 0 }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: TEXT_LABEL, display: 'block', marginBottom: 6 }}>
            Type
          </label>
          <div style={{ position: 'relative' }}>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as 'discount' | 'premium')}
              style={{
                width: '100%', height: 38, padding: '0 32px 0 12px',
                fontSize: 13, fontWeight: 500,
                color: isDiscount ? ACCENT_DISCOUNT.strong : ACCENT_PREMIUM.strong,
                borderWidth: 1, borderStyle: 'solid', borderColor: FIELD_BORDER,
                borderRadius: 8, outline: 'none',
                fontFamily: 'Inter, system-ui, sans-serif',
                backgroundColor: SURFACE_WHITE,
                appearance: 'none', WebkitAppearance: 'none',
                cursor: 'pointer',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = INPUT_FOCUS_BORDER; e.currentTarget.style.boxShadow = INPUT_FOCUS_RING; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = FIELD_BORDER; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <option value="discount" style={{ color: ACCENT_DISCOUNT.strong }}>Discount</option>
              <option value="premium" style={{ color: ACCENT_PREMIUM.strong }}>Premium</option>
            </select>
            <ChevronDown style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              width: 14, height: 14, color: TEXT_MUTED, pointerEvents: 'none',
            }} />
          </div>
        </div>

        {/* Amount with $/% toggle */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: TEXT_LABEL, display: 'block', marginBottom: 6 }}>
            Amount
          </label>
          <div style={{ display: 'flex' }}>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/^0+(?=\d)/, ''))}
              placeholder="0"
              min="0"
              style={{
                flex: 1, minWidth: 0, height: 38, padding: '0 12px',
                fontSize: 13, fontWeight: 500, color: TEXT_BODY,
                borderWidth: 1, borderStyle: 'solid', borderColor: FIELD_BORDER,
                borderTopLeftRadius: 8, borderBottomLeftRadius: 8,
                borderTopRightRadius: 0, borderBottomRightRadius: 0,
                borderRightWidth: 0,
                outline: 'none', fontFamily: 'Inter, system-ui, sans-serif',
                boxSizing: 'border-box' as const,
                MozAppearance: 'textfield' as any,
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = INPUT_FOCUS_BORDER; e.currentTarget.style.boxShadow = INPUT_FOCUS_RING; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = FIELD_BORDER; e.currentTarget.style.boxShadow = 'none'; }}
            />
            {amountToggleButton}
          </div>
        </div>
      </div>

      {/* Label/Description */}
      <div>
        <label style={{ fontSize: 13, fontWeight: 500, color: TEXT_LABEL, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          Label/Description
          <span style={{ fontSize: 11, fontWeight: 400, color: TEXT_MUTED }}>(optional)</span>
        </label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={isDiscount ? 'e.g., Returning customer credit' : 'e.g., Expedited build surcharge'}
          autoFocus
          style={{
            width: '100%', height: 38, padding: '0 12px',
            fontSize: 13, color: TEXT_BODY,
            borderWidth: 1, borderStyle: 'solid', borderColor: FIELD_BORDER,
            borderRadius: 8, outline: 'none',
            fontFamily: 'Inter, system-ui, sans-serif',
            boxSizing: 'border-box',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = INPUT_FOCUS_BORDER; e.currentTarget.style.boxShadow = INPUT_FOCUS_RING; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = FIELD_BORDER; e.currentTarget.style.boxShadow = 'none'; }}
        />
      </div>
    </>
  );

  // ── Items selection panel ──
  const safeLineItems = lineItems || [];
  const searchLower = itemSearch.toLowerCase();
  const filteredItems = itemSearch
    ? safeLineItems.filter(item =>
        item.id.toLowerCase().includes(searchLower) ||
        item.description.toLowerCase().includes(searchLower)
      )
    : safeLineItems;

  const itemsSelectionPanel = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Section header — Partner step pattern (icon-circle + title) */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-md bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
            <Package className="w-3 h-3 text-primary" />
          </div>
          <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Apply to items</span>
          <span
            className="inline-flex items-center px-1.5 py-[1px] rounded-md border text-[10px] shrink-0"
            style={{ fontWeight: 600, color: '#475569', backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }}
          >
            {selectedItems.length}/{safeLineItems.length}
          </span>
        </div>
        <button
          type="button"
          onClick={toggleAll}
          className="text-[11px] text-primary hover:bg-blue-50 transition-colors cursor-pointer px-2 py-1 rounded-md"
          style={{ fontWeight: 500 }}
        >
          {selectedItems.length === safeLineItems.length ? 'Deselect all' : 'Select all'}
        </button>
      </div>
      {/* Search input — Library-style */}
      <div className="relative mb-2">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/70 pointer-events-none" />
        <input
          type="text"
          value={itemSearch}
          onChange={(e) => setItemSearch(e.target.value)}
          placeholder={`Search ${safeLineItems.length} items...`}
          className="w-full pl-9 pr-8 h-9 text-[12.5px] bg-white border border-border/80 rounded-lg shadow-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors placeholder:text-muted-foreground/50"
        />
        {itemSearch && (
          <button
            type="button"
            onClick={() => setItemSearch('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {/* Items list — Partner-style data table (matches summary rules
          sub-modal). Columns: select · Code · Description · Type · Qty
          · Total. Hover/select states identical to the items sub-modal. */}
      <div
        className="bg-white border border-border rounded-xl overflow-hidden flex-1 min-h-0 overflow-y-auto shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
        style={{ scrollbarWidth: 'thin' }}
      >
        {filteredItems.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#9CA3AF', fontSize: '12px' }}>
            {itemSearch ? 'No items match your search' : 'No items available'}
          </div>
        ) : (
          <table className="w-full text-[12px]" style={{ borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 44 }} />
              <col style={{ width: 56 }} />
              <col style={{ width: 130 }} />
              <col />
              {/* Type column was 110px which clipped the two-segment
                  Lot Non-Serialized tag and pushed the pill into the
                  Qty column. 180px holds the widest tag with the
                  trailing gutter intact. */}
              <col style={{ width: 180 }} />
              <col style={{ width: 64 }} />
              <col style={{ width: 96 }} />
            </colgroup>
            <thead className="sticky top-0 z-10">
              <tr style={{ backgroundColor: '#FAFBFC' }}>
                <th className="text-left pl-4 pr-2 h-9" style={{ backgroundColor: '#FAFBFC', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #EEF2F6' }}>
                  <button
                    type="button"
                    onClick={toggleAll}
                    aria-label={selectedItems.length === safeLineItems.length ? 'Deselect all' : 'Select all'}
                    className="w-4 h-4 rounded-[3px] border flex items-center justify-center transition-colors cursor-pointer"
                    style={{
                      borderColor: selectedItems.length === safeLineItems.length ? '#1B6EF3' : '#D1D5DB',
                      backgroundColor: selectedItems.length === safeLineItems.length ? '#1B6EF3' : selectedItems.length > 0 ? '#1B6EF3' : '#FFFFFF',
                      borderWidth: selectedItems.length > 0 ? 0 : 1.5,
                    }}
                  >
                    {selectedItems.length === safeLineItems.length && <Check style={{ width: 10, height: 10, color: '#FFFFFF' }} strokeWidth={3} />}
                    {selectedItems.length > 0 && selectedItems.length < safeLineItems.length && <div style={{ width: 8, height: 2, backgroundColor: '#FFFFFF' }} />}
                  </button>
                </th>
                {/* Excel-style row gutter — zero-padded position of the
                    line in the full quote, NOT of the filtered view, so the
                    number stays stable while the user searches. */}
                <th className="text-left px-2 h-9 text-[11px] text-slate-500 whitespace-nowrap" style={{ fontWeight: 600, backgroundColor: '#FAFBFC', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #EEF2F6' }}>#</th>
                <th className="text-left px-3 h-9 text-[11px] text-slate-600 whitespace-nowrap" style={{ fontWeight: 600, backgroundColor: '#FAFBFC', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #EEF2F6' }}>Part Number</th>
                <th className="text-left px-3 h-9 text-[11px] text-slate-600" style={{ fontWeight: 600, backgroundColor: '#FAFBFC', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #EEF2F6' }}>Description</th>
                <th className="text-left pl-3 pr-5 h-9 text-[11px] text-slate-600 whitespace-nowrap" style={{ fontWeight: 600, backgroundColor: '#FAFBFC', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #EEF2F6', minWidth: 160 }}>Type</th>
                <th className="text-left px-3 h-9 text-[11px] text-slate-600 whitespace-nowrap" style={{ fontWeight: 600, backgroundColor: '#FAFBFC', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #EEF2F6' }}>Item Status</th>
                <th className="text-right pl-5 pr-3 h-9 text-[11px] text-slate-600 whitespace-nowrap" style={{ fontWeight: 600, backgroundColor: '#FAFBFC', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #EEF2F6' }}>Qty</th>
                <th className="text-right pr-4 pl-3 h-9 text-[11px] text-slate-600 whitespace-nowrap" style={{ fontWeight: 600, backgroundColor: '#FAFBFC', borderBottom: '1px solid #E2E8F0' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => {
                const isSelected = selectedItems.includes(item.id);
                const cellBorder = '1px solid #EEF2F6';
                /* Row position in the source list (stable across searches). */
                const indexInSource = safeLineItems.findIndex((i) => i.id === item.id) + 1;
                const indexLabel = String(indexInSource).padStart(3, '0');
                /* Part Number = product/SKU code; falls back to row id for
                   legacy callers that don't pass `code`. */
                const itemCode = item.code ?? item.id;
                return (
                  <tr
                    key={item.id}
                    onClick={() => toggleItem(item.id)}
                    className="group hover:bg-[#F8FAFC] cursor-pointer"
                    style={{
                      backgroundColor: isSelected ? '#F0F7FF' : '#FFFFFF',
                      transition: 'background-color 120ms',
                    }}
                  >
                    <td className="pl-4 pr-2 py-3 align-middle" style={{ borderBottom: cellBorder, borderRight: cellBorder }}>
                      <div
                        className="w-4 h-4 rounded-[3px] border flex items-center justify-center transition-colors"
                        style={{
                          borderColor: isSelected ? '#1B6EF3' : '#D1D5DB',
                          backgroundColor: isSelected ? '#1B6EF3' : '#FFFFFF',
                          borderWidth: isSelected ? 0 : 1.5,
                        }}
                      >
                        {isSelected && <Check style={{ width: 10, height: 10, color: '#FFFFFF' }} strokeWidth={3} />}
                      </div>
                    </td>
                    <td className="px-2 py-3 align-middle text-left text-[11px] text-slate-400 tabular-nums whitespace-nowrap" style={{ fontWeight: 500, borderBottom: cellBorder, borderRight: cellBorder }}>
                      {indexLabel}
                    </td>
                    <td className="px-3 py-3 align-middle" style={{ borderBottom: cellBorder, borderRight: cellBorder, maxWidth: 0 }}>
                      <div className="flex items-center gap-2 min-w-0">
                        {/* Real product thumbnail via the shared
                            `getLineItemImage` helper, matching the
                            main Quote line-items grid. Falls back to
                            the deterministic tint if the image errors
                            so the row never renders a blank square. */}
                        <img
                          src={getLineItemImage(itemCode)}
                          alt=""
                          className="w-6 h-6 rounded-md shrink-0 object-cover"
                          style={{ backgroundColor: item.thumbColor || '#F3F4F6' }}
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
                          }}
                        />
                        <span className="text-[12px] text-slate-700 tabular-nums truncate" style={{ fontWeight: 500 }} title={itemCode}>
                          {itemCode}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 align-middle" style={{ borderBottom: cellBorder, borderRight: cellBorder }}>
                      <p className="text-[12px] text-slate-600 truncate" title={item.description}>
                        {item.description}
                      </p>
                    </td>
                    <td className="pl-3 pr-5 py-3 align-middle whitespace-nowrap" style={{ borderBottom: cellBorder, borderRight: cellBorder, minWidth: 160 }}>
                      {/* Shared `ItemTypeBadge` chrome — same component
                          the line items table uses. Extra right
                          padding + a min-width keep the pill from
                          kissing the Qty column when the row is dense. */}
                      {item.type ? (
                        <ItemTypeBadge type={item.type} />
                      ) : (
                        <span className="text-[11px] text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 align-middle whitespace-nowrap" style={{ borderBottom: cellBorder, borderRight: cellBorder }}>
                      <InactiveItemPill code={itemCode} variant="badge" showActive />
                    </td>
                    <td className="pl-5 pr-3 py-3 align-middle text-right text-[12px] text-slate-700 tabular-nums whitespace-nowrap" style={{ fontWeight: 500, borderBottom: cellBorder, borderRight: cellBorder }}>
                      {item.qty ?? '—'}
                    </td>
                    <td className="pr-4 pl-3 py-3 align-middle text-right text-[12px] text-slate-700 tabular-nums whitespace-nowrap" style={{ fontWeight: 500, borderBottom: cellBorder }}>
                      {fmtCurrency(item.subtotal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '6px' }}>
        {selectedItems.length} of {safeLineItems.length} items selected
        {itemSearch && filteredItems.length !== safeLineItems.length && (
          <span> · {filteredItems.length} shown</span>
        )}
      </div>
    </div>
  );

  /* Partner pricing-rule semantic colors for the category pill — green
     for Discount, violet/purple for Premium. Used as a pill only, not
     on action buttons (those stay system blue). Pulled from the
     ACCENT_* constants at the top of the file. */
  const catPill = isDiscount ? ACCENT_DISCOUNT : ACCENT_PREMIUM;

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 13000, backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(2px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="relative bg-white flex flex-col overflow-hidden border border-border"
        style={{
          width: fullView ? '100vw' : (showItemsPanel ? 'min(1180px, calc(100vw - 2rem))' : '440px'),
          maxWidth: '100vw',
          height: fullView ? '100vh' : (showItemsPanel ? 'min(88vh, 820px)' : 'auto'),
          maxHeight: fullView ? '100vh' : '90vh',
          ...(showItemsPanel && !fullView ? { minHeight: 560 } : {}),
          borderRadius: fullView ? 0 : 16,
          boxShadow: fullView ? 'none' : '0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — Partner-faithful: category pill + title + subtitle on the
            left, rounded-lg X close button on the right. */}
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-border bg-white shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="inline-flex items-center gap-1 px-2 py-[2px] rounded-full text-[10.5px] border shrink-0"
                style={{ fontWeight: 600, color: catPill.text, backgroundColor: catPill.bg, borderColor: catPill.border }}
              >
                {isDiscount ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                {isDiscount ? 'Discount' : 'Premium'}
              </span>
              <h3 className="text-[15px] text-foreground truncate" style={{ fontWeight: 700, lineHeight: 1.3, margin: 0 }}>
                {title}
              </h3>
            </div>
            <p className="text-[12px] text-slate-500 mt-1" style={{ marginBottom: 0, lineHeight: 1.45 }}>
              {subtitle}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Full-view toggle — matches the canonical recipe used by
                `ManageAdjustmentsModal` / `RecipientsSelectionModal` /
                `PricingRulesManageModal`: bordered outline at rest so
                the affordance reads without a hover, slate-50 hover wash. */}
            <button
              type="button"
              onClick={() => setFullView(v => !v)}
              aria-label={fullView ? 'Exit full view' : 'Enter full view'}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-white text-xs text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
              style={{ fontWeight: 500 }}
            >
              {fullView ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              {fullView ? 'Exit full' : 'Full view'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              aria-label="Close"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Form body — Partner-faithful gray container (#FAFBFC) with
            white card surfaces inside, mirroring the ShipmentMethodModal
            and FreightLogistics modal chrome. */}
        {showItemsPanel ? (
          /* Two-column layout — left column scrolls fields+notes, right
             column hosts the items table (which scrolls independently).
             Body wrapper itself is non-scrolling so each column can
             bound the inner scrollers. */
          <div className="flex-1 min-h-0 overflow-hidden" style={{ padding: '16px 20px', backgroundColor: SURFACE_PANEL }}>
            <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '16px', height: '100%', minHeight: 0 }}>
              {/* Left column: form fields + notes (scrolls if tall) */}
              <div style={{ minWidth: 0, overflowY: 'auto', minHeight: 0, scrollbarWidth: 'thin', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ backgroundColor: SURFACE_WHITE, border: `1px solid ${FIELD_BORDER}`, borderRadius: 12, padding: 16 }}>
                  {formFieldsSection}
                </div>
                <div style={{ backgroundColor: SURFACE_WHITE, border: `1px solid ${FIELD_BORDER}`, borderRadius: 12, padding: 16 }}>
                  {notesAndAttachmentsSection}
                </div>
              </div>
              {/* Right column: items panel (the table inside scrolls) */}
              <div style={{ minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                {itemsSelectionPanel}
              </div>
            </div>
          </div>
        ) : (
          /* Single-column layout — body scrolls naturally. */
          <div className="flex-1 overflow-y-auto" style={{ padding: '16px 20px', scrollbarWidth: 'thin', backgroundColor: SURFACE_PANEL }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, padding: 16 }}>
                {formFieldsSection}
              </div>
              <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, padding: 16 }}>
                {notesAndAttachmentsSection}
              </div>
            </div>
          </div>
        )}

        {/* Footer — Partner pattern: outline Cancel + primary blue Save. */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-white shrink-0">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border border-border bg-white text-[13px] text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            Cancel
            <span className="text-[11px] text-slate-400" style={{ fontWeight: 400 }}>Esc</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-white text-[13px] transition-colors cursor-pointer disabled:cursor-not-allowed shadow-sm"
            style={{
              fontWeight: 600,
              backgroundColor: canSave ? PRIMARY_BG : PRIMARY_BG_DISABLED,
              color: canSave ? '#FFFFFF' : TEXT_MUTED,
            }}
            onMouseEnter={(e) => { if (canSave) e.currentTarget.style.backgroundColor = PRIMARY_BG_HOVER; }}
            onMouseLeave={(e) => { if (canSave) e.currentTarget.style.backgroundColor = PRIMARY_BG; }}
          >
            {mode === 'add' ? `Add ${isDiscount ? 'Discount' : 'Premium'}` : 'Save Changes'}
            <span className="text-[11px] opacity-80">&#8984;S</span>
          </button>
        </div>
      </div>

      {/* Multi-line-impact confirm. Surfaces only when the save will
          touch more than one line item so the multi-line ripple to
          unit totals and the order total is intentional. */}
      <ConfirmDiscardModal
        open={showMultiConfirm}
        onOpenChange={(o) => { if (!o) setShowMultiConfirm(false); }}
        variant="warning"
        badge="Multi-line change"
        title={`Apply to ${(pendingDataRef.current?.appliedTo?.length ?? selectedItems.length)} line items?`}
        description={`This adjustment will update ${(pendingDataRef.current?.appliedTo?.length ?? selectedItems.length)} line items at once. Their unit totals and the order total will recalculate. Confirm only if this change was intended.`}
        confirmLabel={`Apply to ${(pendingDataRef.current?.appliedTo?.length ?? selectedItems.length)} items`}
        cancelLabel="Review selection"
        onConfirm={() => {
          const data = pendingDataRef.current;
          pendingDataRef.current = null;
          setShowMultiConfirm(false);
          if (data) onSave(data);
        }}
      />
    </div>,
    document.body
  );
}