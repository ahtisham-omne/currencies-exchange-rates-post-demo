import React, { useState, useRef, useEffect } from 'react';
import {
  Upload, Link2, FileText, Image as ImageIcon,
  Download, Trash2, ExternalLink, MoreHorizontal, X, Paperclip,
  ChevronDown, ChevronRight, Eye, EyeOff, FolderOpen, FileSpreadsheet,
  FileType, Package, Calendar, User, Check, ArrowRightLeft, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getPreQuoteDocs,
  subscribePreQuoteDocs,
  PreQuoteDocument,
} from '../../data/quoteStore';
import { SearchInput } from '../shared/SearchInput';
import { NumberPill } from '../shared/NumberPill';
import { FiltersButton } from '../shared/FiltersButton';
import { FilterPill } from '../shared/FilterPill';

// ── Types ──────────────────────────────────────────────────────────
type DocCategory = 'pre-quote' | 'quote-attachment' | 'item-attachment' | 'external-link' | 'sales-order';

interface ItemRef {
  id: string;
  label: string;
}

interface LinkedDocument {
  id: string;
  name: string;
  category: DocCategory;
  type: 'pdf' | 'xlsx' | 'docx' | 'png' | 'jpg' | 'url' | 'csv';
  size?: string;
  url?: string;
  uploadedBy: string;
  uploadedAt: string;
  itemRefs?: ItemRef[];
  tags?: string[];
  includedInPdf: boolean;
}

// ── Line items for association picker ──────────────────────────────
interface QuoteLineItem {
  id: string;
  itemNumber: string;
  productName: string;
  quantity: number;
  uom: string;
}

const QUOTE_LINE_ITEMS: QuoteLineItem[] = [
  { id: '1', itemNumber: '000-100-002', productName: 'Ford E-450 Stripped Chassis', quantity: 2, uom: 'EA' },
  { id: '1b', itemNumber: '000-100-019', productName: 'Type III Ambulance Module', quantity: 3, uom: 'EA' },
  { id: '2', itemNumber: '000-100-049', productName: 'Motorola APX 8500 Radio', quantity: 3, uom: 'EA' },
  { id: '3', itemNumber: '000-100-059', productName: 'Stryker Power-PRO XT Stretcher', quantity: 3, uom: 'EA' },
  { id: '3b', itemNumber: '000-100-081', productName: 'AIMS 3000W Inverter/Charger', quantity: 3, uom: 'EA' },
];

// ── Mock data ──────────────────────────────────────────────────────
const MOCK_DOCUMENTS: LinkedDocument[] = [
  { id: 'D000a', name: 'RFQ-2026-TC-0042_Original_Request.pdf', category: 'pre-quote', type: 'pdf', size: '1.8 MB', uploadedBy: 'Sarah Chen', uploadedAt: '2026-01-15', includedInPdf: false, tags: ['rfq/rfp'] },
  { id: 'D000b', name: 'Tri-County_Fleet_Requirements_Spec.xlsx', category: 'pre-quote', type: 'xlsx', size: '340 KB', uploadedBy: 'Sarah Chen', uploadedAt: '2026-01-15', includedInPdf: false, tags: ['rfq/rfp'] },
  { id: 'D001', name: 'Quote_Q-2026-0142_v3.pdf', category: 'quote-attachment', type: 'pdf', size: '2.4 MB', uploadedBy: 'Sarah Chen', uploadedAt: '2026-02-05', includedInPdf: true },
  { id: 'D002', name: 'Pricing_Approval_Internal.xlsx', category: 'quote-attachment', type: 'xlsx', size: '890 KB', uploadedBy: 'Michael Rodriguez', uploadedAt: '2026-02-04', includedInPdf: false },
  { id: 'D003', name: 'Terms_and_Conditions_2026.pdf', category: 'quote-attachment', type: 'pdf', size: '1.1 MB', uploadedBy: 'Sarah Chen', uploadedAt: '2026-01-28', includedInPdf: true },
  { id: 'D004', name: 'Type_III_Module_Specifications.pdf', category: 'item-attachment', type: 'pdf', size: '4.7 MB', uploadedBy: 'Sarah Chen', uploadedAt: '2026-01-25', itemRefs: [{ id: '000-100-019', label: 'Type III Ambulance Module' }], includedInPdf: true },
  { id: 'D005', name: 'KKK_Compliance_Checklist.pdf', category: 'item-attachment', type: 'pdf', size: '3.2 MB', uploadedBy: 'Sarah Chen', uploadedAt: '2026-01-25', itemRefs: [{ id: '000-100-019', label: 'Type III Ambulance Module' }, { id: '000-100-002', label: 'Ford E-450 Chassis' }], includedInPdf: true },
  { id: 'D006', name: 'APX_8500_Programming_Template.cfg', category: 'item-attachment', type: 'pdf', size: '1.8 MB', uploadedBy: 'Michael Rodriguez', uploadedAt: '2026-01-22', itemRefs: [{ id: '000-100-049', label: 'Motorola APX 8500 Radio' }], includedInPdf: false },
  { id: 'D007', name: 'Stryker_Warranty_Certificate.pdf', category: 'item-attachment', type: 'pdf', size: '520 KB', uploadedBy: 'Sarah Chen', uploadedAt: '2026-01-22', itemRefs: [{ id: '000-100-059', label: 'Stryker Power-PRO XT' }, { id: '000-100-081', label: 'AIMS 3000W Inverter' }], includedInPdf: true },
  { id: 'D008', name: 'Tri-County EMS — Master Agreement', category: 'external-link', type: 'url', url: 'https://docs.tricountyems.gov/agreements/MA-2025-001', uploadedBy: 'Sarah Chen', uploadedAt: '2026-01-20', includedInPdf: false },
  { id: 'D009', name: 'NFPA 1917 Compliance Matrix', category: 'external-link', type: 'url', url: 'https://sharepoint.company.com/safety/nfpa1917-matrix', uploadedBy: 'Michael Rodriguez', uploadedAt: '2026-01-18', includedInPdf: false },
  { id: 'D010', name: 'Tri-County EMS Credit Check Report', category: 'external-link', type: 'url', url: 'https://creditcheck.internal/reports/tricounty-2026', uploadedBy: 'Sarah Chen', uploadedAt: '2026-01-15', tags: ['confidential'], includedInPdf: false },
];

const CATEGORY_CONFIG: Record<DocCategory, { label: string; icon: any; emptyText: string }> = {
  'pre-quote': { label: 'Pre-Quote Documents (RFQ/RFP)', icon: FileText, emptyText: 'No pre-quote documents yet — upload RFQ/RFP files from the Deal Information tab' },
  'quote-attachment': { label: 'Quote Attachments', icon: FileText, emptyText: 'No quote-level attachments yet' },
  'item-attachment': { label: 'Item Attachments', icon: Package, emptyText: 'No item-level attachments yet' },
  'external-link': { label: 'External Links', icon: Link2, emptyText: 'No external links added yet' },
  'sales-order': { label: 'Sales Order Documents', icon: FolderOpen, emptyText: 'Documents will appear here after conversion to SO' },
};

const FILE_ICONS: Record<string, { icon: any; color: string; bg: string }> = {
  pdf: { icon: FileText, color: 'var(--destructive)', bg: 'rgba(220, 38, 38, 0.1)' },
  xlsx: { icon: FileSpreadsheet, color: 'var(--success)', bg: 'rgba(5, 150, 105, 0.1)' },
  csv: { icon: FileSpreadsheet, color: 'var(--success)', bg: 'rgba(5, 150, 105, 0.1)' },
  docx: { icon: FileType, color: 'var(--primary)', bg: 'var(--accent)' },
  png: { icon: ImageIcon, color: 'var(--primary)', bg: '#F5F3FF' },
  jpg: { icon: ImageIcon, color: 'var(--primary)', bg: '#F5F3FF' },
  url: { icon: ExternalLink, color: '#0891B2', bg: '#ECFEFF' },
};

type FilterType = 'all' | DocCategory | 'pdf' | 'image' | 'spreadsheet';
type DateRangeFilter = 'any' | 'today' | 'this-week' | 'this-month' | 'older';

const CURRENT_USER = 'Sarah Chen';

// ── Shared table grid columns (no Linked Items column) ─────────────
const TABLE_GRID = 'minmax(200px, 1fr) 80px 100px 80px 52px 40px';

// ── Reusable table header row ──────────────────────────────────────
function TableHeader() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: TABLE_GRID,
        padding: '0 16px',
        height: '32px',
        alignItems: 'center',
        borderBottom: '1px solid var(--muted)',
        backgroundColor: '#FAFBFC',
      }}
    >
      <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'none', lineHeight: '1' }}>Name</span>
      <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'none', lineHeight: '1' }}>Size</span>
      <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'none', lineHeight: '1' }}>Uploaded by</span>
      <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'none', lineHeight: '1' }}>Created On</span>
      <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'none', lineHeight: '1', textAlign: 'center' }}>In Quote</span>
      <span />
    </div>
  );
}

// ── Reusable document row ──────────────────────────────────────────
function DocRow({ doc, onTogglePdf, onDelete, contextMenu, setContextMenu, setConvertModal, formatDate }: {
  doc: LinkedDocument;
  onTogglePdf: (id: string) => void;
  onDelete: (id: string) => void;
  contextMenu: { id: string; x: number; y: number } | null;
  setContextMenu: (v: { id: string; x: number; y: number } | null) => void;
  setConvertModal: (v: { doc: LinkedDocument; direction: 'to-quote' | 'to-item' } | null) => void;
  formatDate: (iso: string) => string;
}) {
  const fi = FILE_ICONS[doc.type] || FILE_ICONS.pdf;
  const FIcon = fi.icon;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: TABLE_GRID,
        padding: '0 16px',
        minHeight: '40px',
        alignItems: 'center',
        borderBottom: '1px solid var(--muted)',
        transition: 'background-color 150ms',
        cursor: 'pointer',
      }}
      onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--muted)'; }}
      onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
    >
      {/* Name cell */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, paddingRight: '12px' }}>
        <div
          style={{
            width: '28px', height: '28px', borderRadius: '6px',
            backgroundColor: fi.bg, display: 'flex', alignItems: 'center',
            justifyContent: 'center', flexShrink: 0,
          }}
        >
          <FIcon style={{ width: '13px', height: '13px', color: fi.color }} />
        </div>
        <span
          style={{
            fontSize: '13px', fontWeight: 500,
            color: doc.type === 'url' ? 'var(--primary)' : 'var(--foreground)',
            lineHeight: '1.3', overflow: 'hidden', textOverflow: 'ellipsis',
            whiteSpace: 'nowrap', minWidth: 0, flex: 1,
          }}
          title={doc.name}
        >
          {doc.name}
        </span>
        {doc.tags && doc.tags.length > 0 && (
          <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
            {doc.tags.map(tag => (
              <span key={tag} style={{
                fontSize: '10px', fontWeight: 500,
                color: tag === 'confidential' ? 'var(--destructive)' : 'var(--muted-foreground)',
                backgroundColor: tag === 'confidential' ? 'rgba(220, 38, 38, 0.1)' : 'var(--muted)',
                padding: '2px 6px', borderRadius: '4px', lineHeight: '1',
                border: `1px solid ${tag === 'confidential' ? 'rgba(220, 38, 38, 0.3)' : 'var(--border)'}`,
              }}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Size */}
      <span style={{ fontSize: '12px', color: 'var(--muted-foreground)', lineHeight: '1' }}>{doc.size || '—'}</span>
      {/* Uploaded by */}
      <span style={{ fontSize: '12px', color: 'var(--muted-foreground)', lineHeight: '1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.uploadedBy}</span>
      {/* Date */}
      <span style={{ fontSize: '12px', color: 'var(--muted-foreground)', lineHeight: '1' }}>{formatDate(doc.uploadedAt)}</span>
      {/* PDF inclusion toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <button
          onClick={(e) => { e.stopPropagation(); onTogglePdf(doc.id); }}
          title={doc.includedInPdf ? 'Visible in Quote — click to hide' : 'Hidden from Quote — click to show'}
          style={{
            width: '24px', height: '24px', borderRadius: '4px', border: 'none',
            backgroundColor: 'transparent', cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center', transition: 'background-color 100ms',
          }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--muted)'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          {doc.includedInPdf
            ? <Eye style={{ width: '14px', height: '14px', color: 'var(--primary)' }} />
            : <EyeOff style={{ width: '14px', height: '14px', color: 'var(--border)' }} />
          }
        </button>
      </div>
      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', position: 'relative' }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setContextMenu(contextMenu?.id === doc.id ? null : { id: doc.id, x: e.clientX, y: e.clientY });
          }}
          style={{
            width: '28px', height: '28px', borderRadius: '6px', border: 'none',
            backgroundColor: 'transparent', cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center', transition: 'background-color 100ms',
          }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--muted)'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          <MoreHorizontal style={{ width: '14px', height: '14px', color: 'var(--muted-foreground)' }} />
        </button>
        {contextMenu?.id === doc.id && (
          <ContextMenuDropdown
            doc={doc}
            onTogglePdf={onTogglePdf}
            onDelete={onDelete}
            setContextMenu={setContextMenu}
            setConvertModal={setConvertModal}
          />
        )}
      </div>
    </div>
  );
}

// ── Context menu dropdown ──────────────────────────────────────────
function ContextMenuDropdown({ doc, onTogglePdf, onDelete, setContextMenu, setConvertModal }: {
  doc: LinkedDocument;
  onTogglePdf: (id: string) => void;
  onDelete: (id: string) => void;
  setContextMenu: (v: { id: string; x: number; y: number } | null) => void;
  setConvertModal: (v: { doc: LinkedDocument; direction: 'to-quote' | 'to-item' } | null) => void;
}) {
  const menuItems: { icon: any; label: string; action: () => void; danger?: boolean; dividerBefore?: boolean }[] = [
    { icon: Eye, label: 'Preview', action: () => { setContextMenu(null); toast.info('Preview opened'); } },
    { icon: Download, label: 'Download', action: () => { setContextMenu(null); toast.success('Download started'); } },
    ...(doc.type === 'url' ? [{ icon: ExternalLink, label: 'Open Link', action: () => { setContextMenu(null); toast.info('Opening link...'); } }] : []),
    { icon: doc.includedInPdf ? EyeOff : Eye, label: doc.includedInPdf ? 'Hide from Quote' : 'Show in Quote', dividerBefore: true, action: () => onTogglePdf(doc.id) },
    /* "Move to Quote Level" retained for item-scoped files. "Move to
       Item Level" and "Rename" removed per updated spec so the menu
       stays lean across every attachment surface. */
    ...(doc.category === 'item-attachment'
      ? [{ icon: ArrowRightLeft, label: 'Move to Quote Level', action: () => { setContextMenu(null); setConvertModal({ doc, direction: 'to-quote' as const }); } }]
      : []
    ),
    { icon: Trash2, label: 'Delete', action: () => onDelete(doc.id), danger: true, dividerBefore: true },
  ];

  return (
    <div
      style={{
        position: 'absolute', right: 0, top: '100%', marginTop: '4px',
        backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid var(--border)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.1)', padding: '4px', minWidth: '180px',
        zIndex: 50,
      }}
    >
      {menuItems.map(item => {
        const IIcon = item.icon;
        return (
          <div key={item.label}>
            {item.dividerBefore && <div style={{ height: '1px', backgroundColor: 'var(--muted)', margin: '3px 0' }} />}
            <button
              onClick={(e) => { e.stopPropagation(); item.action(); }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                padding: '7px 10px', fontSize: '12px', fontWeight: 500,
                color: item.danger ? 'var(--destructive)' : 'var(--foreground)',
                backgroundColor: 'transparent', border: 'none', borderRadius: '6px',
                cursor: 'pointer', transition: 'background-color 100ms',
                fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1',
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = item.danger ? 'rgba(220, 38, 38, 0.1)' : 'var(--muted)'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <IIcon style={{ width: '13px', height: '13px' }} />
              {item.label}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ── Item Attachments grouped by line item ──────────────────────────

// ── Child attachment row for item-attachment section (grid-based) ───
function ItemAttachmentChildRow({ doc, onTogglePdf, onDelete, contextMenu, setContextMenu, setConvertModal, formatDate }: {
  doc: LinkedDocument;
  onTogglePdf: (id: string) => void;
  onDelete: (id: string) => void;
  contextMenu: { id: string; x: number; y: number } | null;
  setContextMenu: (v: { id: string; x: number; y: number } | null) => void;
  setConvertModal: (v: { doc: LinkedDocument; direction: 'to-quote' | 'to-item' } | null) => void;
  formatDate: (iso: string) => string;
}) {
  const fi = FILE_ICONS[doc.type] || FILE_ICONS.pdf;
  const FIcon = fi.icon;
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: TABLE_GRID,
        padding: '0 16px',
        minHeight: '40px',
        alignItems: 'center',
        borderBottom: '1px solid var(--muted)',
        transition: 'background-color 150ms',
        cursor: 'pointer',
      }}
      onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--muted)'; }}
      onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
    >
      {/* Name cell – indented for child hierarchy */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, paddingLeft: '34px', paddingRight: '12px' }}>
        <div
          style={{
            width: '28px', height: '28px', borderRadius: '6px',
            backgroundColor: fi.bg, display: 'flex', alignItems: 'center',
            justifyContent: 'center', flexShrink: 0,
          }}
        >
          <FIcon style={{ width: '13px', height: '13px', color: fi.color }} />
        </div>
        <span
          style={{
            fontSize: '13px', fontWeight: 500, color: 'var(--foreground)',
            lineHeight: '1.3', overflow: 'hidden', textOverflow: 'ellipsis',
            whiteSpace: 'nowrap', minWidth: 0, flex: 1,
          }}
          title={doc.name}
        >
          {doc.name}
        </span>
      </div>
      {/* Size */}
      <span style={{ fontSize: '12px', color: 'var(--muted-foreground)', lineHeight: '1' }}>{doc.size || '—'}</span>
      {/* Uploaded by */}
      <span style={{ fontSize: '12px', color: 'var(--muted-foreground)', lineHeight: '1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.uploadedBy}</span>
      {/* Date */}
      <span style={{ fontSize: '12px', color: 'var(--muted-foreground)', lineHeight: '1' }}>{formatDate(doc.uploadedAt)}</span>
      {/* PDF inclusion toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <button
          onClick={(e) => { e.stopPropagation(); onTogglePdf(doc.id); }}
          title={doc.includedInPdf ? 'Visible in Quote — click to hide' : 'Hidden from Quote — click to show'}
          style={{
            width: '24px', height: '24px', borderRadius: '4px', border: 'none',
            backgroundColor: 'transparent', cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center', transition: 'background-color 100ms',
          }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--muted)'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          {doc.includedInPdf
            ? <Eye style={{ width: '14px', height: '14px', color: 'var(--primary)' }} />
            : <EyeOff style={{ width: '14px', height: '14px', color: 'var(--border)' }} />
          }
        </button>
      </div>
      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', position: 'relative' }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setContextMenu(contextMenu?.id === doc.id ? null : { id: doc.id, x: e.clientX, y: e.clientY });
          }}
          style={{
            width: '28px', height: '28px', borderRadius: '6px', border: 'none',
            backgroundColor: 'transparent', cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center', transition: 'background-color 100ms',
          }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--muted)'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          <MoreHorizontal style={{ width: '14px', height: '14px', color: 'var(--muted-foreground)' }} />
        </button>
        {contextMenu?.id === doc.id && (
          <ContextMenuDropdown
            doc={doc}
            onTogglePdf={onTogglePdf}
            onDelete={onDelete}
            setContextMenu={setContextMenu}
            setConvertModal={setConvertModal}
          />
        )}
      </div>
    </div>
  );
}

function ItemAttachmentGrouped({ docs, onTogglePdf, onDelete, contextMenu, setContextMenu, setConvertModal, formatDate }: {
  docs: LinkedDocument[];
  onTogglePdf: (id: string) => void;
  onDelete: (id: string) => void;
  contextMenu: { id: string; x: number; y: number } | null;
  setContextMenu: (v: { id: string; x: number; y: number } | null) => void;
  setConvertModal: (v: { doc: LinkedDocument; direction: 'to-quote' | 'to-item' } | null) => void;
  formatDate: (iso: string) => string;
  readOnly?: boolean;
}) {
  // Build grouped map: itemRefId → { label, docs[] }
  const grouped = new Map<string, { label: string; docs: LinkedDocument[] }>();

  // Ensure items appear in the QUOTE_LINE_ITEMS order
  for (const li of QUOTE_LINE_ITEMS) {
    for (const doc of docs) {
      if (doc.itemRefs?.some(r => r.id === li.itemNumber)) {
        if (!grouped.has(li.itemNumber)) {
          grouped.set(li.itemNumber, { label: li.productName, docs: [] });
        }
        const entry = grouped.get(li.itemNumber)!;
        if (!entry.docs.find(d => d.id === doc.id)) {
          entry.docs.push(doc);
        }
      }
    }
  }

  // Also handle docs with no matching line item (orphaned refs)
  for (const doc of docs) {
    if (doc.itemRefs) {
      for (const ref of doc.itemRefs) {
        if (!grouped.has(ref.id)) {
          grouped.set(ref.id, { label: ref.label, docs: [] });
        }
        const entry = grouped.get(ref.id)!;
        if (!entry.docs.find(d => d.id === doc.id)) {
          entry.docs.push(doc);
        }
      }
    }
  }

  // Docs with no itemRefs at all (shouldn't happen but safety)
  const unlinkedDocs = docs.filter(d => !d.itemRefs || d.itemRefs.length === 0);

  const entries = Array.from(grouped.entries());

  return (
    <div>
      {/* Standard table header with all columns */}
      <TableHeader />

      {entries.map(([itemId, { label, docs: itemDocs }]) => (
        <div key={itemId}>
          {/* ── Item parent row (grid, NAME col populated, rest empty) ── */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: TABLE_GRID,
              padding: '0 16px',
              minHeight: '40px',
              alignItems: 'center',
              borderBottom: '1px solid var(--muted)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, paddingRight: '12px' }}>
              <div
                style={{
                  width: '24px', height: '24px', borderRadius: '50%',
                  backgroundColor: 'var(--muted)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', flexShrink: 0,
                }}
              >
                <Package style={{ width: '12px', height: '12px', color: 'var(--muted-foreground)' }} />
              </div>
              <span style={{
                fontSize: '12px', fontWeight: 600, color: 'var(--primary)',
                lineHeight: '1', flexShrink: 0,
              }}>
                {itemId}
              </span>
              <span style={{
                fontSize: '13px', fontWeight: 400, color: 'var(--foreground)', lineHeight: '1',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                flex: 1, minWidth: 0,
              }}>
                {label}
              </span>
            </div>
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>

          {/* ── Child attachment rows ── */}
          {itemDocs.map(doc => (
            <ItemAttachmentChildRow
              key={`${itemId}-${doc.id}`}
              doc={doc}
              onTogglePdf={onTogglePdf}
              onDelete={onDelete}
              contextMenu={contextMenu}
              setContextMenu={setContextMenu}
              setConvertModal={setConvertModal}
              formatDate={formatDate}
            />
          ))}
        </div>
      ))}

      {/* Unlinked docs (no itemRefs) */}
      {unlinkedDocs.length > 0 && (
        <div>
          {/* Unlinked parent row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: TABLE_GRID,
              padding: '0 16px',
              minHeight: '40px',
              alignItems: 'center',
              borderBottom: '1px solid var(--muted)',
              borderTop: entries.length > 0 ? '1px solid var(--border)' : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, paddingRight: '12px' }}>
              <div
                style={{
                  width: '24px', height: '24px', borderRadius: '50%',
                  backgroundColor: 'rgba(217, 119, 6, 0.2)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', flexShrink: 0,
                }}
              >
                <AlertTriangle style={{ width: '12px', height: '12px', color: 'var(--warning)' }} />
              </div>
              <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--warning)', lineHeight: '1' }}>
                Unlinked files
              </span>
              <span style={{
                fontSize: '10px', fontWeight: 600, color: 'var(--muted-foreground)',
                backgroundColor: 'var(--muted)', padding: '2px 6px',
                borderRadius: '4px', lineHeight: '1',
              }}>
                {unlinkedDocs.length}
              </span>
            </div>
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
          {unlinkedDocs.map(doc => (
            <ItemAttachmentChildRow
              key={`unlinked-${doc.id}`}
              doc={doc}
              onTogglePdf={onTogglePdf}
              onDelete={onDelete}
              contextMenu={contextMenu}
              setContextMenu={setContextMenu}
              setConvertModal={setConvertModal}
              formatDate={formatDate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface LinkedTransactionsTabProps {
  quoteNumber?: string;
  customerName?: string;
  readOnly?: boolean;
  /** Called when attachment changes occur (ask user whether to version) */
  onAskUserChange?: (fieldKey: string, fieldLabel: string, changeDescription: string) => void;
}

export function LinkedTransactionsTab({ quoteNumber = 'Q-000-000-000', customerName = 'Tri-County EMS Authority', readOnly = false, onAskUserChange }: LinkedTransactionsTabProps) {
  const [localDocuments, setLocalDocuments] = useState<LinkedDocument[]>(MOCK_DOCUMENTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [collapsedSections, setCollapsedSections] = useState<Set<DocCategory>>(new Set());
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [convertModal, setConvertModal] = useState<{ doc: LinkedDocument; direction: 'to-quote' | 'to-item' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Shared pre-quote docs from the store (synced with OverviewTab uploads) ──
  const storeKey = quoteNumber;
  const [storePreQuoteDocs, setStorePreQuoteDocs] = useState<PreQuoteDocument[]>(() => getPreQuoteDocs(storeKey));

  useEffect(() => {
    setStorePreQuoteDocs(getPreQuoteDocs(storeKey));
    const unsub = subscribePreQuoteDocs(storeKey, () => {
      setStorePreQuoteDocs(getPreQuoteDocs(storeKey));
    });
    return unsub;
  }, [storeKey]);

  // Merge local docs with store pre-quote docs (converted to LinkedDocument shape)
  // Store docs get IDs prefixed so they don't collide with mock data
  const mapDocType = (ext: string): LinkedDocument['type'] => {
    const m: Record<string, LinkedDocument['type']> = { pdf: 'pdf', xlsx: 'xlsx', xls: 'xlsx', csv: 'csv', docx: 'docx', doc: 'docx', png: 'png', jpg: 'jpg', jpeg: 'jpg' };
    return m[ext] || 'pdf';
  };

  const storeDocsAsLinked: LinkedDocument[] = storePreQuoteDocs.map(d => ({
    id: d.id,
    name: d.name,
    category: 'pre-quote' as DocCategory,
    type: mapDocType(d.type),
    size: d.size,
    uploadedBy: d.uploadedBy,
    uploadedAt: d.uploadedAt,
    includedInPdf: false,
    tags: ['rfq/rfp'],
  }));

  // Filter out mock pre-quote docs whose IDs start with 'D000' (static mock data)
  // and combine with local docs + store docs
  const documents = [...storeDocsAsLinked, ...localDocuments];
  const setDocuments = setLocalDocuments;

  // Advanced filters
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [dateRangeFilter, setDateRangeFilter] = useState<DateRangeFilter>('any');
  const [uploaderFilter, setUploaderFilter] = useState<string>('all');
  const filterRef = useRef<HTMLDivElement>(null);

  const activeFilterCount = (dateRangeFilter !== 'any' ? 1 : 0) + (uploaderFilter !== 'all' ? 1 : 0);
  const uploaders = [...new Set(documents.map(d => d.uploadedBy))];

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setShowFilterDropdown(false);
      }
    };
    if (showFilterDropdown) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showFilterDropdown]);

  // Close context menu on outside click
  React.useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [contextMenu]);

  const matchesDateRange = (iso: string) => {
    if (dateRangeFilter === 'any') return true;
    const d = new Date(iso + 'T00:00:00');
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today); monthAgo.setMonth(monthAgo.getMonth() - 1);
    if (dateRangeFilter === 'today') return d >= today;
    if (dateRangeFilter === 'this-week') return d >= weekAgo;
    if (dateRangeFilter === 'this-month') return d >= monthAgo;
    if (dateRangeFilter === 'older') return d < monthAgo;
    return true;
  };

  const filteredDocs = documents.filter(doc => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery ||
      doc.name.toLowerCase().includes(q) ||
      doc.itemRefs?.some(r => r.id.includes(q) || r.label.toLowerCase().includes(q)) ||
      doc.uploadedBy.toLowerCase().includes(q);

    let matchesType = true;
    if (activeFilter === 'pre-quote' || activeFilter === 'quote-attachment' || activeFilter === 'item-attachment' || activeFilter === 'external-link' || activeFilter === 'sales-order') {
      matchesType = doc.category === activeFilter;
    } else if (activeFilter === 'pdf') {
      matchesType = doc.type === 'pdf';
    } else if (activeFilter === 'image') {
      matchesType = doc.type === 'png' || doc.type === 'jpg';
    } else if (activeFilter === 'spreadsheet') {
      matchesType = doc.type === 'xlsx' || doc.type === 'csv';
    }

    const matchesUploader = uploaderFilter === 'all' || doc.uploadedBy === uploaderFilter;
    const matchesDate = matchesDateRange(doc.uploadedAt);

    return matchesSearch && matchesType && matchesUploader && matchesDate;
  });

  const groupedDocs: Record<DocCategory, LinkedDocument[]> = {
    'pre-quote': filteredDocs.filter(d => d.category === 'pre-quote'),
    'quote-attachment': filteredDocs.filter(d => d.category === 'quote-attachment'),
    'item-attachment': filteredDocs.filter(d => d.category === 'item-attachment'),
    'external-link': filteredDocs.filter(d => d.category === 'external-link'),
    'sales-order': filteredDocs.filter(d => d.category === 'sales-order'),
  };

  const toggleSection = (cat: DocCategory) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  const handleDelete = (docId: string) => {
    setDocuments(prev => prev.filter(d => d.id !== docId));
    setContextMenu(null);
    toast.success('Document removed');
  };

  const handleTogglePdf = (docId: string) => {
    setDocuments(prev => prev.map(d => {
      if (d.id !== docId) return d;
      const next = !d.includedInPdf;
      toast.success(next ? 'Visible in Quote' : 'Hidden from Quote');
      return { ...d, includedInPdf: next };
    }));
    setContextMenu(null);
  };

  const handleConvertToQuote = (docId: string) => {
    setDocuments(prev => prev.map(d =>
      d.id === docId
        ? { ...d, category: 'quote-attachment' as DocCategory, itemRefs: undefined }
        : d
    ));
    setConvertModal(null);
    toast.success('Moved to quote-level attachments');
  };

  const handleConvertToItem = (docId: string, selectedItems: ItemRef[]) => {
    setDocuments(prev => prev.map(d =>
      d.id === docId
        ? { ...d, category: 'item-attachment' as DocCategory, itemRefs: selectedItems }
        : d
    ));
    setConvertModal(null);
    toast.success(`Linked to ${selectedItems.length} item${selectedItems.length !== 1 ? 's' : ''}`);
  };

  const handleUpload = (files: FileList | null, category: DocCategory, selectedItems: ItemRef[]) => {
    if (!files || files.length === 0) return;
    Array.from(files).forEach(file => {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf';
      const newDoc: LinkedDocument = {
        id: `D${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: file.name,
        category,
        type: (ext === 'pdf' || ext === 'xlsx' || ext === 'docx' || ext === 'png' || ext === 'jpg' || ext === 'csv' ? ext : 'pdf') as LinkedDocument['type'],
        size: `${(file.size / 1024).toFixed(0)} KB`,
        uploadedBy: CURRENT_USER,
        uploadedAt: (() => { const d = new Date(); return `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}/${d.getFullYear()}`; })(),
        itemRefs: category === 'item-attachment' && selectedItems.length > 0 ? selectedItems : undefined,
        includedInPdf: false,
      };
      setDocuments(prev => [newDoc, ...prev]);
    });
    setShowUploadModal(false);
    toast.success(`${files.length} file${files.length > 1 ? 's' : ''} uploaded`);
    onAskUserChange?.('attachment_quote', 'Quote Attachment', `Uploaded ${files.length} file${files.length > 1 ? 's' : ''}`);
  };

  const filters: { key: FilterType; label: string; count?: number }[] = [
    { key: 'all', label: 'All', count: documents.length },
    { key: 'pre-quote', label: 'Pre-Quote', count: documents.filter(d => d.category === 'pre-quote').length },
    { key: 'quote-attachment', label: 'Quote', count: documents.filter(d => d.category === 'quote-attachment').length },
    { key: 'item-attachment', label: 'Item', count: documents.filter(d => d.category === 'item-attachment').length },
    { key: 'external-link', label: 'Links', count: documents.filter(d => d.category === 'external-link').length },
    { key: 'pdf', label: 'PDF' },
    { key: 'image', label: 'Images' },
    { key: 'spreadsheet', label: 'Sheets' },
  ];

  const formatDate = (iso: string) => {
    const d = new Date(iso + 'T00:00:00');
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  };

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* ── Toolbar card — sticky to mirror ItemsTab pattern ── */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid var(--border)',
          overflow: 'visible',
          boxShadow: '0 1px 2px 0 rgba(15, 23, 42, 0.04), 0 1px 3px 0 rgba(15, 23, 42, 0.04)',
        }}
      >
      {/* ── Toolbar area ── */}
      <div
        style={{
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        {/* Row 1: Search + Filters button + action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search documents..."
            widthClassName="w-[260px] shrink-0"
          />

          {/* Filter button */}
          <div ref={filterRef} style={{ position: 'relative', flexShrink: 0 }}>
            <FiltersButton
              count={activeFilterCount}
              active={showFilterDropdown}
              onClick={() => setShowFilterDropdown(p => !p)}
            />

            {showFilterDropdown && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, marginTop: '4px', zIndex: 20,
                backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid var(--border)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)', width: '260px',
                fontFamily: 'Inter, system-ui, sans-serif',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--muted)' }}>
                  <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--foreground-soft)' }}>Filters</span>
                  {activeFilterCount > 0 && (
                    <button
                      onClick={() => { setDateRangeFilter('any'); setUploaderFilter('all'); }}
                      style={{ fontSize: '11px', fontWeight: 500, color: 'var(--destructive)', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', padding: '2px 6px', borderRadius: '4px', transition: 'background-color 100ms' }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(220, 38, 38, 0.1)'; }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      Clear all
                    </button>
                  )}
                </div>
                {/* Date range */}
                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--muted)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <Calendar style={{ width: '12px', height: '12px', color: 'var(--muted-foreground)' }} />
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'none' }}>Upload Date</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {([
                      { key: 'any' as DateRangeFilter, label: 'Any Time' },
                      { key: 'today' as DateRangeFilter, label: 'Today' },
                      { key: 'this-week' as DateRangeFilter, label: 'This Week' },
                      { key: 'this-month' as DateRangeFilter, label: 'This Month' },
                      { key: 'older' as DateRangeFilter, label: 'Older' },
                    ]).map(d => {
                      const active = dateRangeFilter === d.key;
                      return (
                        <button key={d.key} onClick={() => setDateRangeFilter(d.key)} style={{
                          height: '26px', padding: '0 10px', fontSize: '11px', fontWeight: 500,
                          color: active ? 'var(--primary)' : 'var(--muted-foreground)', backgroundColor: active ? 'var(--accent)' : 'var(--muted)',
                          border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '6px',
                          cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1', transition: 'all 100ms',
                        }}>
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {/* Uploaded by */}
                <div style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <User style={{ width: '12px', height: '12px', color: 'var(--muted-foreground)' }} />
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'none' }}>Uploaded By</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <button onClick={() => setUploaderFilter('all')} style={{
                      display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '6px 8px',
                      fontSize: '12px', fontWeight: uploaderFilter === 'all' ? 600 : 400,
                      color: uploaderFilter === 'all' ? 'var(--primary)' : 'var(--foreground)',
                      backgroundColor: uploaderFilter === 'all' ? 'var(--accent)' : 'transparent',
                      border: 'none', borderRadius: '6px', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
                      textAlign: 'left', transition: 'background-color 100ms',
                    }}
                      onMouseEnter={e => { if (uploaderFilter !== 'all') e.currentTarget.style.backgroundColor = 'var(--muted)'; }}
                      onMouseLeave={e => { if (uploaderFilter !== 'all') e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      Everyone
                    </button>
                    {uploaders.map(u => {
                      const active = uploaderFilter === u;
                      const isYou = u === CURRENT_USER;
                      return (
                        <button key={u} onClick={() => setUploaderFilter(u)} style={{
                          display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '6px 8px',
                          fontSize: '12px', fontWeight: active ? 600 : 400, color: active ? 'var(--primary)' : 'var(--foreground)',
                          backgroundColor: active ? 'var(--accent)' : 'transparent', border: 'none', borderRadius: '6px',
                          cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', textAlign: 'left', transition: 'background-color 100ms',
                        }}
                          onMouseEnter={e => { if (!active) e.currentTarget.style.backgroundColor = 'var(--muted)'; }}
                          onMouseLeave={e => { if (!active) e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                          {u}{isYou && <span style={{ fontSize: '10px', color: 'var(--muted-foreground)', fontWeight: 400 }}>(you)</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={{ flex: 1 }} />

          {/* Action buttons */}
          {!readOnly && <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <button
              onClick={() => setShowLinkModal(true)}
              style={{
                height: '36px', padding: '0 14px', fontSize: '13px', fontWeight: 500,
                color: 'var(--foreground)', backgroundColor: '#FFFFFF', border: '1px solid var(--border)',
                borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center',
                gap: '6px', transition: 'all 150ms', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1',
                boxShadow: '0 1px 2px 0 rgba(15, 23, 42, 0.05)',
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--muted)'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
            >
              <Link2 style={{ width: '14px', height: '14px' }} />
              Add External URL
            </button>
            <button
              onClick={() => setShowUploadModal(true)}
              style={{
                height: '36px', padding: '0 14px', fontSize: '13px', fontWeight: 600,
                color: '#FFFFFF', backgroundColor: 'var(--primary)', border: 'none', borderRadius: '8px',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                transition: 'background-color 150ms', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1',
                boxShadow: '0 1px 2px 0 rgba(15, 23, 42, 0.08)',
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#0862D0'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--primary)'; }}
            >
              <Upload style={{ width: '14px', height: '14px' }} />
              Upload
            </button>
          </div>}
        </div>

        {/* Row 2: Quick filter pills + active filter tags */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {filters.map(f => (
            <FilterPill
              key={f.key}
              label={f.label}
              count={f.count}
              active={activeFilter === f.key}
              onClick={() => setActiveFilter(f.key)}
            />
          ))}

          {activeFilterCount > 0 && (
            <>
              <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--border)', flexShrink: 0 }} />
              {dateRangeFilter !== 'any' && (
                <span style={{
                  display: 'flex', alignItems: 'center', gap: '4px', height: '24px', padding: '0 6px 0 8px',
                  fontSize: '11px', fontWeight: 500, color: 'var(--primary)', backgroundColor: 'var(--accent)',
                  borderRadius: '6px', whiteSpace: 'nowrap', lineHeight: '1',
                }}>
                  {dateRangeFilter === 'today' ? 'Today' : dateRangeFilter === 'this-week' ? 'This Week' : dateRangeFilter === 'this-month' ? 'This Month' : 'Older'}
                  <button onClick={() => setDateRangeFilter('any')} style={{ width: '14px', height: '14px', borderRadius: '3px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                    <X style={{ width: '10px', height: '10px', color: 'var(--primary)' }} />
                  </button>
                </span>
              )}
              {uploaderFilter !== 'all' && (
                <span style={{
                  display: 'flex', alignItems: 'center', gap: '4px', height: '24px', padding: '0 6px 0 8px',
                  fontSize: '11px', fontWeight: 500, color: 'var(--primary)', backgroundColor: 'var(--accent)',
                  borderRadius: '6px', whiteSpace: 'nowrap', lineHeight: '1',
                }}>
                  {uploaderFilter === CURRENT_USER ? 'You' : uploaderFilter}
                  <button onClick={() => setUploaderFilter('all')} style={{ width: '14px', height: '14px', borderRadius: '3px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                    <X style={{ width: '10px', height: '10px', color: 'var(--primary)' }} />
                  </button>
                </span>
              )}
            </>
          )}
        </div>
      </div>
      </div>{/* close toolbar card */}

      {/* Bottom gradient fade — soft edge below sticky toolbar (mirrors ItemsTabTableClean) */}
      <div
        aria-hidden
        className="pointer-events-none"
        style={{
          position: 'sticky',
          top: 64,
          zIndex: 19,
          height: 8,
          marginBottom: -8,
          background:
            'linear-gradient(to bottom, rgba(244,246,250,0.85) 0%, rgba(244,246,250,0.45) 40%, rgba(244,246,250,0) 100%)',
        }}
      />

      {/* ── Document sections — each is its own white card ── */}
      {(Object.keys(CATEGORY_CONFIG) as DocCategory[]).map((cat) => {
        const config = CATEGORY_CONFIG[cat];
        const docs = groupedDocs[cat];
        const isCollapsed = collapsedSections.has(cat);
        const CatIcon = config.icon;

        if (cat === 'sales-order' && docs.length === 0) return null;

        return (
          <div key={cat} style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            overflow: 'hidden',
          }}>
            {/* Section header — Partner DashInfoCard title chrome (icon chip + title + count + chevron) */}
            <button
              type="button"
              onClick={() => toggleSection(cat)}
              className="w-full px-3.5 py-2.5 flex items-center gap-2 cursor-pointer hover:bg-[#FAFBFC] transition-colors"
              style={{ borderBottom: !isCollapsed ? '1px solid #F1F5F9' : 'none', fontFamily: 'Inter, system-ui, sans-serif' }}
            >
              <div className="w-6 h-6 rounded-md bg-accent flex items-center justify-center shrink-0">
                <CatIcon className="w-3 h-3 text-primary" />
              </div>
              <span className="text-[12px] text-slate-700 text-left" style={{ fontWeight: 600 }}>
                {config.label}
              </span>
              <NumberPill count={docs.length} />
              {cat === 'sales-order' && docs.length === 0 && (
                <span className="text-[11px] text-muted-foreground italic">Future scope</span>
              )}
              <ChevronDown
                className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-auto transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
              />
            </button>

            {/* Section content */}
            {!isCollapsed && (
              <div style={{ borderTop: '1px solid var(--muted)' }}>
                {docs.length === 0 ? (
                  <div style={{ padding: '24px 16px', textAlign: 'center' }}>
                    <Paperclip style={{ width: '20px', height: '20px', color: 'var(--border)', margin: '0 auto 8px' }} />
                    <div style={{ fontSize: '12px', color: 'var(--muted-foreground)', lineHeight: '1.4' }}>
                      {config.emptyText}
                    </div>
                  </div>
                ) : cat === 'item-attachment' ? (
                  <ItemAttachmentGrouped
                    docs={docs}
                    onTogglePdf={handleTogglePdf}
                    onDelete={handleDelete}
                    contextMenu={contextMenu}
                    setContextMenu={setContextMenu}
                    setConvertModal={setConvertModal}
                    formatDate={formatDate}
                    readOnly={readOnly}
                  />
                ) : (
                  <div>
                    <TableHeader />
                    {docs.map(doc => (
                      <DocRow
                        key={doc.id}
                        doc={doc}
                        onTogglePdf={handleTogglePdf}
                        onDelete={handleDelete}
                        contextMenu={contextMenu}
                        setContextMenu={setContextMenu}
                        setConvertModal={setConvertModal}
                        formatDate={formatDate}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* ── Convert Scope Modal ──────────────────────────────── */}
      {convertModal && (
        <ConvertScopeModal
          doc={convertModal.doc}
          direction={convertModal.direction}
          onClose={() => setConvertModal(null)}
          onConvertToQuote={handleConvertToQuote}
          onConvertToItem={handleConvertToItem}
        />
      )}

      {/* ── Upload Modal ──────────────────────────────────────── */}
      {showUploadModal && (
        <UploadModal
          onClose={() => setShowUploadModal(false)}
          onUpload={handleUpload}
          dragOver={dragOver}
          setDragOver={setDragOver}
          fileInputRef={fileInputRef}
        />
      )}

      {/* ── Add External URL Modal ─────────────────────────────── */}
      {showLinkModal && (
        <LinkUrlModal
          onClose={() => setShowLinkModal(false)}
          onLink={(name, url) => {
            const newDoc: LinkedDocument = {
              id: `D${Date.now()}`,
              name,
              category: 'external-link',
              type: 'url',
              url,
              uploadedBy: CURRENT_USER,
              uploadedAt: (() => { const d = new Date(); return `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}/${d.getFullYear()}`; })(),
              includedInPdf: false,
            };
            setDocuments(prev => [newDoc, ...prev]);
            setShowLinkModal(false);
            toast.success('External link added');
          }}
        />
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={e => {
          // This is only used as a fallback ref; the modal handles its own file input
        }}
      />
    </div>
  );
}

// ── Upload Modal with Item Selection ──────────────────────────────
function UploadModal({ onClose, onUpload, dragOver, setDragOver, fileInputRef }: {
  onClose: () => void;
  onUpload: (files: FileList | null, category: DocCategory, selectedItems: ItemRef[]) => void;
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [uploadCategory, setUploadCategory] = useState<DocCategory>('quote-attachment');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [stagedFiles, setStagedFiles] = useState<FileList | null>(null);
  const [step, setStep] = useState<'upload' | 'select-items'>('upload');
  const [itemSearch, setItemSearch] = useState('');
  const localFileRef = useRef<HTMLInputElement>(null);

  const toggleItem = (itemId: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
      return next;
    });
  };

  const filteredLineItems = QUOTE_LINE_ITEMS.filter(item =>
    !itemSearch ||
    item.itemNumber.includes(itemSearch) ||
    item.productName.toLowerCase().includes(itemSearch.toLowerCase())
  );

  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (uploadCategory === 'item-attachment') {
      setStagedFiles(files);
      setStep('select-items');
    } else {
      onUpload(files, uploadCategory, []);
    }
  };

  const handleConfirmUpload = () => {
    const items: ItemRef[] = QUOTE_LINE_ITEMS
      .filter(li => selectedItems.has(li.id))
      .map(li => ({ id: li.itemNumber, label: li.productName }));
    onUpload(stagedFiles, uploadCategory, items);
  };

  if (step === 'select-items') {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)' }} onClick={onClose} />
        <div style={{ position: 'relative', backgroundColor: 'var(--card)', borderRadius: '12px', width: '520px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)', fontFamily: 'Inter, system-ui, sans-serif' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                onClick={() => { setStep('upload'); setStagedFiles(null); }}
                style={{
                  width: '28px', height: '28px', borderRadius: '6px', border: '1px solid var(--border)',
                  backgroundColor: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', transition: 'background-color 100ms',
                }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--muted)'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
              >
                <ChevronRight style={{ width: '14px', height: '14px', color: 'var(--muted-foreground)', transform: 'rotate(180deg)' }} />
              </button>
              <div>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--foreground)', lineHeight: '1' }}>Link to Line Items</span>
                <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginTop: '4px', lineHeight: '1' }}>
                  {stagedFiles ? `${stagedFiles.length} file${stagedFiles.length > 1 ? 's' : ''} ready` : ''}
                  {selectedItems.size > 0 && ` · ${selectedItems.size} item${selectedItems.size > 1 ? 's' : ''} selected`}
                </div>
              </div>
            </div>
            <button onClick={onClose} style={{ width: '28px', height: '28px', borderRadius: '6px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X style={{ width: '16px', height: '16px', color: 'var(--muted-foreground)' }} />
            </button>
          </div>

          {/* Search */}
          <div style={{ padding: '12px 20px 8px', flexShrink: 0 }}>
            <div style={{ position: 'relative' }}>
              <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: 'var(--muted-foreground)', pointerEvents: 'none' }} />
              <input
                value={itemSearch}
                onChange={e => setItemSearch(e.target.value)}
                placeholder="Search line items..."
                style={{
                  width: '100%', height: '32px', padding: '0 12px 0 32px', fontSize: '13px',
                  fontWeight: 400, color: 'var(--foreground)', border: '1px solid var(--border)', borderRadius: '6px',
                  outline: 'none', backgroundColor: '#FFFFFF', fontFamily: 'Inter, system-ui, sans-serif',
                  boxSizing: 'border-box', transition: 'border-color 150ms',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(10, 119, 255, 0.4)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
              />
            </div>
          </div>

          {/* Line items list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 12px 12px', minHeight: 0 }}>
            {/* Select all */}
            <button
              onClick={() => {
                if (selectedItems.size === QUOTE_LINE_ITEMS.length) {
                  setSelectedItems(new Set());
                } else {
                  setSelectedItems(new Set(QUOTE_LINE_ITEMS.map(i => i.id)));
                }
              }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                padding: '8px', fontSize: '12px', fontWeight: 500, color: 'var(--muted-foreground)',
                backgroundColor: 'transparent', border: 'none', borderRadius: '6px',
                cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
                transition: 'background-color 100ms', marginBottom: '2px',
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--muted)'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <div style={{
                width: '16px', height: '16px', borderRadius: '4px',
                border: `1.5px solid ${selectedItems.size === QUOTE_LINE_ITEMS.length ? 'var(--primary)' : 'var(--border)'}`,
                backgroundColor: selectedItems.size === QUOTE_LINE_ITEMS.length ? 'var(--primary)' : '#FFFFFF',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 150ms', flexShrink: 0,
              }}>
                {selectedItems.size === QUOTE_LINE_ITEMS.length && <Check style={{ width: '10px', height: '10px', color: '#FFFFFF' }} />}
              </div>
              Select all items ({QUOTE_LINE_ITEMS.length})
            </button>

            <div style={{ height: '1px', backgroundColor: 'var(--muted)', margin: '4px 0' }} />

            {filteredLineItems.map(item => {
              const isChecked = selectedItems.has(item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => toggleItem(item.id)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 8px', fontSize: '13px', fontWeight: 400, color: 'var(--foreground)',
                    backgroundColor: isChecked ? 'var(--accent)' : 'transparent',
                    border: 'none', borderRadius: '6px', cursor: 'pointer',
                    fontFamily: 'Inter, system-ui, sans-serif',
                    transition: 'background-color 100ms', textAlign: 'left',
                  }}
                  onMouseEnter={e => { if (!isChecked) e.currentTarget.style.backgroundColor = 'var(--muted)'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = isChecked ? 'var(--accent)' : 'transparent'; }}
                >
                  <div style={{
                    width: '16px', height: '16px', borderRadius: '4px',
                    border: `1.5px solid ${isChecked ? 'var(--primary)' : 'var(--border)'}`,
                    backgroundColor: isChecked ? 'var(--primary)' : '#FFFFFF',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 150ms', flexShrink: 0,
                  }}>
                    {isChecked && <Check style={{ width: '10px', height: '10px', color: '#FFFFFF' }} />}
                  </div>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '3px',
                    height: '20px', padding: '0 6px', fontSize: '10px', fontWeight: 600,
                    color: 'var(--primary)', backgroundColor: 'var(--accent)', border: '1px solid var(--accent)',
                    borderRadius: '4px', lineHeight: '1', flexShrink: 0,
                  }}>
                    <span style={{ fontSize: '8px', color: 'rgba(10, 119, 255, 0.4)', lineHeight: '1' }}>#</span>
                    {item.itemNumber}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--foreground)', lineHeight: '1.3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.productName}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', lineHeight: '1', marginTop: '2px' }}>
                      Qty: {item.quantity} {item.uom}
                    </div>
                  </div>
                </button>
              );
            })}

            {filteredLineItems.length === 0 && (
              <div style={{ padding: '24px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>No matching line items</div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
            <div style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>
              {selectedItems.size === 0 && (
                <span style={{ color: 'var(--warning)' }}>Select at least one item, or upload as quote-level</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => {
                  onUpload(stagedFiles, 'quote-attachment', []);
                }}
                style={{
                  height: '32px', padding: '0 12px', fontSize: '13px', fontWeight: 500, color: 'var(--muted-foreground)',
                  backgroundColor: '#FFFFFF', border: '1px solid var(--border)', borderRadius: '6px',
                  cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1',
                  transition: 'all 150ms',
                }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--muted)'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
              >
                Skip — Quote Level
              </button>
              <button
                disabled={selectedItems.size === 0}
                onClick={handleConfirmUpload}
                style={{
                  height: '32px', padding: '0 16px', fontSize: '13px', fontWeight: 500,
                  color: '#FFFFFF', backgroundColor: selectedItems.size > 0 ? 'var(--primary)' : 'var(--border)',
                  border: 'none', borderRadius: '6px', cursor: selectedItems.size > 0 ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', gap: '5px',
                  fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1', transition: 'background-color 150ms',
                }}
                onMouseEnter={e => { if (selectedItems.size > 0) e.currentTarget.style.backgroundColor = '#0D5ED7'; }}
                onMouseLeave={e => { if (selectedItems.size > 0) e.currentTarget.style.backgroundColor = 'var(--primary)'; }}
              >
                <Upload style={{ width: '13px', height: '13px' }} />
                Upload ({selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''})
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)' }} onClick={onClose} />
      <div style={{ position: 'relative', backgroundColor: 'var(--card)', borderRadius: '12px', width: '480px', boxShadow: '0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)', fontFamily: 'Inter, system-ui, sans-serif' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Upload style={{ width: '16px', height: '16px', color: 'var(--primary)' }} />
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--foreground)', lineHeight: '1' }}>Upload Documents</span>
          </div>
          <button onClick={onClose} style={{ width: '28px', height: '28px', borderRadius: '6px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X style={{ width: '16px', height: '16px', color: 'var(--muted-foreground)' }} />
          </button>
        </div>

        <div style={{ padding: '20px' }}>
          {/* Category selector */}
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'none', display: 'block', marginBottom: '6px', lineHeight: '1' }}>
            Attach to
          </label>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
            {(['quote-attachment', 'item-attachment'] as DocCategory[]).map(cat => (
              <button
                key={cat}
                onClick={() => setUploadCategory(cat)}
                style={{
                  height: '28px', padding: '0 10px', fontSize: '12px', fontWeight: 500,
                  color: uploadCategory === cat ? 'var(--primary)' : 'var(--muted-foreground)',
                  backgroundColor: uploadCategory === cat ? '#E7F3FF' : '#FFFFFF',
                  border: `1px solid ${uploadCategory === cat ? 'var(--primary)' : 'var(--border)'}`,
                  borderRadius: '6px', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1',
                  transition: 'all 150ms',
                }}
              >
                {cat === 'quote-attachment' ? 'Quote Level' : 'Item Level'}
              </button>
            ))}
          </div>

          {/* Info hint for item-level */}
          {uploadCategory === 'item-attachment' && (
            <div style={{
              paddingLeft: '12px', marginBottom: '16px',
              borderLeft: '2px solid var(--border)',
            }}>
              <span style={{ fontSize: '11px', color: 'var(--muted-foreground)', lineHeight: '1.4' }}>
                After selecting files, you'll choose which line items to associate them with.
              </span>
            </div>
          )}

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleFilesSelected(e.dataTransfer.files); }}
            onClick={() => localFileRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? 'var(--primary)' : 'var(--border)'}`,
              borderRadius: '8px',
              padding: '32px',
              textAlign: 'center',
              cursor: 'pointer',
              backgroundColor: dragOver ? 'var(--accent)' : '#FAFBFC',
              transition: 'all 150ms',
            }}
          >
            <Upload style={{ width: '24px', height: '24px', color: dragOver ? 'var(--primary)' : 'var(--border)', margin: '0 auto 8px' }} />
            <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--foreground)', lineHeight: '1', marginBottom: '4px' }}>
              Drop files here or <span style={{ color: 'var(--primary)' }}>browse</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', lineHeight: '1.4' }}>
              Documents, Spreadsheets, Images · Max 25 MB per file
            </div>
          </div>
        </div>
      </div>
      <input
        ref={localFileRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={e => handleFilesSelected(e.target.files)}
      />
    </div>
  );
}

// ── Add External URL Modal ────────────────────────────────────────
function LinkUrlModal({ onClose, onLink }: {
  onClose: () => void;
  onLink: (name: string, url: string) => void;
}) {
  const [linkName, setLinkName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  const isValid = linkName.trim() && linkUrl.trim();

  const inputStyle: React.CSSProperties = {
    width: '100%', height: '32px', padding: '0 12px', fontSize: '13px', fontWeight: 400,
    color: 'var(--foreground)', border: '1px solid var(--border)', borderRadius: '6px', outline: 'none',
    backgroundColor: '#FFFFFF', fontFamily: 'Inter, system-ui, sans-serif', boxSizing: 'border-box',
    transition: 'border-color 150ms',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)' }} onClick={onClose} />
      <div style={{ position: 'relative', backgroundColor: 'var(--card)', borderRadius: '12px', width: '440px', boxShadow: '0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)', fontFamily: 'Inter, system-ui, sans-serif' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Link2 style={{ width: '16px', height: '16px', color: 'var(--primary)' }} />
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--foreground)', lineHeight: '1' }}>Add External URL</span>
          </div>
          <button onClick={onClose} style={{ width: '28px', height: '28px', borderRadius: '6px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X style={{ width: '16px', height: '16px', color: 'var(--muted-foreground)' }} />
          </button>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'none', display: 'block', marginBottom: '6px', lineHeight: '1' }}>
              Display Name
            </label>
            <input
              value={linkName}
              onChange={e => setLinkName(e.target.value)}
              placeholder="e.g., Master Agreement — Tri-County EMS"
              style={inputStyle}
              autoFocus
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(10, 119, 255, 0.4)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
            />
          </div>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'none', display: 'block', marginBottom: '6px', lineHeight: '1' }}>
              URL
            </label>
            <input
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              placeholder="https://..."
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(10, 119, 255, 0.4)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
            />
          </div>
          {/* Hint */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 10px', backgroundColor: 'var(--muted)', borderRadius: '6px',
            border: '1px solid var(--muted)',
          }}>
            <ExternalLink style={{ width: '12px', height: '12px', color: 'var(--muted-foreground)', flexShrink: 0 }} />
            <span style={{ fontSize: '11px', color: 'var(--muted-foreground)', lineHeight: '1.4' }}>
              This link will appear under the External Links section
            </span>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
          <button
            onClick={onClose}
            style={{
              height: '36px', padding: '0 16px', fontSize: '13px', fontWeight: 500, color: 'var(--muted-foreground)',
              backgroundColor: '#FFFFFF', border: '1px solid var(--border)', borderRadius: '8px',
              cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1',
              transition: 'all 150ms',
            }}
          >
            Cancel
          </button>
          <button
            disabled={!isValid}
            onClick={() => isValid && onLink(linkName.trim(), linkUrl.trim())}
            style={{
              height: '32px', padding: '0 16px', fontSize: '13px', fontWeight: 500,
              color: '#FFFFFF', backgroundColor: isValid ? 'var(--primary)' : 'var(--border)',
              border: 'none', borderRadius: '6px', cursor: isValid ? 'pointer' : 'not-allowed',
              fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1', transition: 'background-color 150ms',
            }}
          >
            Add External URL
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Convert Scope Modal ───────────────────────────────────────────
function ConvertScopeModal({ doc, direction, onClose, onConvertToQuote, onConvertToItem }: {
  doc: LinkedDocument;
  direction: 'to-quote' | 'to-item';
  onClose: () => void;
  onConvertToQuote: (docId: string) => void;
  onConvertToItem: (docId: string, items: ItemRef[]) => void;
}) {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [itemSearch, setItemSearch] = useState('');

  const toggleItem = (itemId: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
      return next;
    });
  };

  const filteredLineItems = QUOTE_LINE_ITEMS.filter(item =>
    !itemSearch ||
    item.itemNumber.includes(itemSearch) ||
    item.productName.toLowerCase().includes(itemSearch.toLowerCase())
  );

  const fi = FILE_ICONS[doc.type] || FILE_ICONS.pdf;
  const FIcon = fi.icon;

  // ── To-Quote Confirmation ──
  if (direction === 'to-quote') {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)' }} onClick={onClose} />
        <div style={{ position: 'relative', backgroundColor: 'var(--card)', borderRadius: '12px', width: '440px', boxShadow: '0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)', fontFamily: 'Inter, system-ui, sans-serif' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ArrowRightLeft style={{ width: '16px', height: '16px', color: 'var(--primary)' }} />
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--foreground)', lineHeight: '1' }}>Move to Quote Level</span>
            </div>
            <button onClick={onClose} style={{ width: '28px', height: '28px', borderRadius: '6px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X style={{ width: '16px', height: '16px', color: 'var(--muted-foreground)' }} />
            </button>
          </div>

          <div style={{ padding: '20px' }}>
            {/* Document preview card */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px', padding: '12px',
              backgroundColor: 'var(--muted)', borderRadius: '8px', border: '1px solid var(--muted)',
              marginBottom: '16px',
            }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '6px', backgroundColor: fi.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <FIcon style={{ width: '15px', height: '15px', color: fi.color }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--foreground)', lineHeight: '1.3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {doc.name}
                </div>
                {doc.size && (
                  <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', lineHeight: '1', marginTop: '3px' }}>{doc.size}</div>
                )}
              </div>
            </div>

            {/* Current item associations */}
            {doc.itemRefs && doc.itemRefs.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'none', marginBottom: '8px', lineHeight: '1' }}>
                  Current Item Associations
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {doc.itemRefs.map(ref => (
                    <span
                      key={ref.id}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '3px',
                        height: '20px', padding: '0 6px', fontSize: '10px', fontWeight: 600,
                        color: 'var(--primary)', backgroundColor: 'var(--accent)', border: '1px solid var(--accent)',
                        borderRadius: '4px', lineHeight: '1',
                      }}
                    >
                      <span style={{ fontSize: '8px', color: 'rgba(10, 119, 255, 0.4)', lineHeight: '1' }}>#</span>
                      {ref.id}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Warning */}
            <div style={{
              display: 'flex', gap: '10px', padding: '10px 12px',
              backgroundColor: 'rgba(217, 119, 6, 0.1)', borderRadius: '8px', border: '1px solid rgba(217, 119, 6, 0.3)',
            }}>
              <AlertTriangle style={{ width: '14px', height: '14px', color: 'var(--warning)', flexShrink: 0, marginTop: '1px' }} />
              <div style={{ fontSize: '12px', color: 'var(--warning)', lineHeight: '1.5' }}>
                This will remove all item associations and move the document to quote-level attachments. This action can be reversed later.
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
            <button
              onClick={onClose}
              style={{
                height: '36px', padding: '0 16px', fontSize: '13px', fontWeight: 500, color: 'var(--muted-foreground)',
                backgroundColor: '#FFFFFF', border: '1px solid var(--border)', borderRadius: '8px',
                cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1',
                transition: 'all 150ms',
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--muted)'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
            >
              Cancel
            </button>
            <button
              onClick={() => onConvertToQuote(doc.id)}
              style={{
                height: '32px', padding: '0 16px', fontSize: '13px', fontWeight: 500,
                color: '#FFFFFF', backgroundColor: 'var(--primary)', border: 'none', borderRadius: '6px',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1', transition: 'background-color 150ms',
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#0D5ED7'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--primary)'; }}
            >
              <ArrowRightLeft style={{ width: '13px', height: '13px' }} />
              Move to Quote Level
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── To-Item: Item Picker ──
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)' }} onClick={onClose} />
      <div style={{ position: 'relative', backgroundColor: 'var(--card)', borderRadius: '12px', width: '520px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)', fontFamily: 'Inter, system-ui, sans-serif' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ArrowRightLeft style={{ width: '16px', height: '16px', color: 'var(--primary)' }} />
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--foreground)', lineHeight: '1' }}>Move to Item Level</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginTop: '6px', lineHeight: '1', paddingLeft: '24px' }}>
              Select which line items to associate with this document
            </div>
          </div>
          <button onClick={onClose} style={{ width: '28px', height: '28px', borderRadius: '6px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X style={{ width: '16px', height: '16px', color: 'var(--muted-foreground)' }} />
          </button>
        </div>

        {/* Document preview */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--muted)', flexShrink: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
            backgroundColor: 'var(--muted)', borderRadius: '8px', border: '1px solid var(--muted)',
          }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '6px', backgroundColor: fi.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <FIcon style={{ width: '13px', height: '13px', color: fi.color }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--foreground)', lineHeight: '1.3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {doc.name}
              </div>
            </div>
            <span style={{
              fontSize: '10px', fontWeight: 500, color: 'var(--muted-foreground)', backgroundColor: 'var(--muted)',
              padding: '3px 8px', borderRadius: '4px', lineHeight: '1', flexShrink: 0,
            }}>
              {doc.category === 'external-link' ? 'External Link' : 'Quote Level'}
            </span>
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: '12px 20px 8px', flexShrink: 0 }}>
          <div style={{ position: 'relative' }}>
            <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: 'var(--muted-foreground)', pointerEvents: 'none' }} />
            <input
              value={itemSearch}
              onChange={e => setItemSearch(e.target.value)}
              placeholder="Search line items..."
              style={{
                width: '100%', height: '32px', padding: '0 12px 0 32px', fontSize: '13px',
                fontWeight: 400, color: 'var(--foreground)', border: '1px solid var(--border)', borderRadius: '6px',
                outline: 'none', backgroundColor: '#FFFFFF', fontFamily: 'Inter, system-ui, sans-serif',
                boxSizing: 'border-box', transition: 'border-color 150ms',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(10, 119, 255, 0.4)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
            />
          </div>
        </div>

        {/* Line items list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 12px 12px', minHeight: 0 }}>
          {/* Select all */}
          <button
            onClick={() => {
              if (selectedItems.size === QUOTE_LINE_ITEMS.length) {
                setSelectedItems(new Set());
              } else {
                setSelectedItems(new Set(QUOTE_LINE_ITEMS.map(i => i.id)));
              }
            }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
              padding: '8px', fontSize: '12px', fontWeight: 500, color: 'var(--muted-foreground)',
              backgroundColor: 'transparent', border: 'none', borderRadius: '6px',
              cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
              transition: 'background-color 100ms', marginBottom: '2px',
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--muted)'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <div style={{
              width: '16px', height: '16px', borderRadius: '4px',
              border: `1.5px solid ${selectedItems.size === QUOTE_LINE_ITEMS.length ? 'var(--primary)' : 'var(--border)'}`,
              backgroundColor: selectedItems.size === QUOTE_LINE_ITEMS.length ? 'var(--primary)' : '#FFFFFF',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 150ms', flexShrink: 0,
            }}>
              {selectedItems.size === QUOTE_LINE_ITEMS.length && <Check style={{ width: '10px', height: '10px', color: '#FFFFFF' }} />}
            </div>
            Select all items ({QUOTE_LINE_ITEMS.length})
          </button>

          <div style={{ height: '1px', backgroundColor: 'var(--muted)', margin: '4px 0' }} />

          {filteredLineItems.map(item => {
            const isChecked = selectedItems.has(item.id);
            return (
              <button
                key={item.id}
                onClick={() => toggleItem(item.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 8px', fontSize: '13px', fontWeight: 400, color: 'var(--foreground)',
                  backgroundColor: isChecked ? 'var(--accent)' : 'transparent',
                  border: 'none', borderRadius: '6px', cursor: 'pointer',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  transition: 'background-color 100ms', textAlign: 'left',
                }}
                onMouseEnter={e => { if (!isChecked) e.currentTarget.style.backgroundColor = 'var(--muted)'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = isChecked ? 'var(--accent)' : 'transparent'; }}
              >
                <div style={{
                  width: '16px', height: '16px', borderRadius: '4px',
                  border: `1.5px solid ${isChecked ? 'var(--primary)' : 'var(--border)'}`,
                  backgroundColor: isChecked ? 'var(--primary)' : '#FFFFFF',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 150ms', flexShrink: 0,
                }}>
                  {isChecked && <Check style={{ width: '10px', height: '10px', color: '#FFFFFF' }} />}
                </div>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '3px',
                  height: '20px', padding: '0 6px', fontSize: '10px', fontWeight: 600,
                  color: 'var(--primary)', backgroundColor: 'var(--accent)', border: '1px solid var(--accent)',
                  borderRadius: '4px', lineHeight: '1', flexShrink: 0,
                }}>
                  <span style={{ fontSize: '8px', color: 'rgba(10, 119, 255, 0.4)', lineHeight: '1' }}>#</span>
                  {item.itemNumber}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--foreground)', lineHeight: '1.3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.productName}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', lineHeight: '1', marginTop: '2px' }}>
                    Qty: {item.quantity} {item.uom}
                  </div>
                </div>
              </button>
            );
          })}

          {filteredLineItems.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>No matching line items</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>
            {selectedItems.size === 0 && (
              <span style={{ color: 'var(--warning)' }}>Select at least one item</span>
            )}
            {selectedItems.size > 0 && (
              <span>{selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={onClose}
              style={{
                height: '36px', padding: '0 16px', fontSize: '13px', fontWeight: 500, color: 'var(--muted-foreground)',
                backgroundColor: '#FFFFFF', border: '1px solid var(--border)', borderRadius: '8px',
                cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1',
                transition: 'all 150ms',
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--muted)'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
            >
              Cancel
            </button>
            <button
              disabled={selectedItems.size === 0}
              onClick={() => {
                const items: ItemRef[] = QUOTE_LINE_ITEMS
                  .filter(li => selectedItems.has(li.id))
                  .map(li => ({ id: li.itemNumber, label: li.productName }));
                onConvertToItem(doc.id, items);
              }}
              style={{
                height: '32px', padding: '0 16px', fontSize: '13px', fontWeight: 500,
                color: '#FFFFFF', backgroundColor: selectedItems.size > 0 ? 'var(--primary)' : 'var(--border)',
                border: 'none', borderRadius: '6px', cursor: selectedItems.size > 0 ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', gap: '6px',
                fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1', transition: 'background-color 150ms',
              }}
              onMouseEnter={e => { if (selectedItems.size > 0) e.currentTarget.style.backgroundColor = '#0D5ED7'; }}
              onMouseLeave={e => { if (selectedItems.size > 0) e.currentTarget.style.backgroundColor = 'var(--primary)'; }}
            >
              <ArrowRightLeft style={{ width: '13px', height: '13px' }} />
              Move to Item Level
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
