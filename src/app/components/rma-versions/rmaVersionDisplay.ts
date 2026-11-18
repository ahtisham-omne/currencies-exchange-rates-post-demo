/**
 * Shared display config for the RMA version-history UI.
 *
 * Ported from the Purchase Order module's `poVersionDisplay.ts`. The slate
 * ladder and the change-type action semantics (added=emerald, removed=red,
 * modified=amber) are kept as-is so the two modules read alike; the status
 * tints follow the return's own lifecycle rather than the PO's.
 */

import type React from 'react';
import {
  Plus,
  Trash2,
  Edit,
  DollarSign,
  Tag,
  Send,
  CheckCircle2,
  FileText,
  Truck,
  Paperclip,
  Scale,
  PackageCheck,
  Ban,
} from 'lucide-react';

import type { RMAChangeType, RMAVersionStatus } from '@/app/data/rmaVersions';

export const changeTypeConfig: Record<
  RMAChangeType,
  { icon: React.ElementType; color: string; bg: string; border: string; label: string }
> = {
  'line-item-added':       { icon: Plus,       color: '#065F46', bg: '#ECFDF5', border: '#A7F3D0', label: 'Line added' },
  'line-item-removed':     { icon: Trash2,     color: '#991B1B', bg: '#FEF2F2', border: '#FECACA', label: 'Line removed' },
  'line-item-modified':    { icon: Edit,       color: '#92400E', bg: '#FFFBEB', border: '#FDE68A', label: 'Line changed' },
  'authorization-changed': { icon: Scale,      color: '#6D28D9', bg: '#F5F3FF', border: '#DDD6FE', label: 'Authorization' },
  'value-changed':         { icon: DollarSign, color: '#1E40AF', bg: '#EFF6FF', border: '#BFDBFE', label: 'Value' },
  'logistics-changed':     { icon: Truck,      color: '#0F766E', bg: '#F0FDFA', border: '#99F6E4', label: 'Logistics' },
  'vendor-changed':        { icon: Edit,       color: '#5B21B6', bg: '#F5F3FF', border: '#DDD6FE', label: 'Vendor' },
  'config-changed':        { icon: Tag,        color: '#475569', bg: '#F1F5F9', border: '#E2E8F0', label: 'Details' },
  'attachment-added':      { icon: Paperclip,  color: '#0F766E', bg: '#F0FDFA', border: '#99F6E4', label: 'Attachment' },
};

export const versionStatusConfig: Record<
  RMAVersionStatus,
  { label: string; bg: string; color: string; border: string; icon: React.ElementType }
> = {
  draft:     { label: 'Draft',            bg: '#F1F5F9', color: '#334155', border: '#E2E8F0', icon: FileText },
  sent:      { label: 'Sent',             bg: '#EFF6FF', color: '#1E40AF', border: '#BFDBFE', icon: Send },
  approved:  { label: 'Approved',         bg: '#ECFDF5', color: '#065F46', border: '#A7F3D0', icon: CheckCircle2 },
  shipped:   { label: 'Shipped to Vendor', bg: '#FFFBEB', color: '#92400E', border: '#FDE68A', icon: Truck },
  closed:    { label: 'Closed',           bg: '#F0FDFA', color: '#0F766E', border: '#99F6E4', icon: PackageCheck },
  cancelled: { label: 'Cancelled',        bg: '#FEF2F2', color: '#991B1B', border: '#FECACA', icon: Ban },
};

/** Standard slate ladder used throughout the version UI. Defined once so the
 *  tokens stay consistent across the tab, the dropdown and the modals. */
export const versionPalette = {
  border: '#E2E8F0',
  divider: '#F1F5F9',
  text900: '#0F172A',
  text700: '#334155',
  text600: '#475569',
  text500: '#64748B',
  text400: '#94A3B8',
  muted: '#F8FAFC',
  accent: '#D97706',
  accentBg: '#FFFBEB',
};

/** The morph the rest of the module animates on. */
export const VERSION_TRANSITION = 'all 250ms cubic-bezier(0.4, 0, 0.2, 1)';

export const formatVersionCurrency = (n: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

export function formatVersionDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatVersionDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
}
