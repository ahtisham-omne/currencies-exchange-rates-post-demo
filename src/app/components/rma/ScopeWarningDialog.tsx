/**
 * The purchase order's scope confirmation, ported.
 *
 * `PriceWarningShell` in `Purchase-Order/src/app/components/
 * PriceConfirmationDialog.tsx` is the dialog that stands between the buyer and
 * a decision that could reach further than the document they are on: a price
 * that could become the vendor's default, an item that could be qualified
 * against a partner rather than this one order. It asks the same question
 * every time -- here only, or everywhere from now on -- and it asks it the
 * same way, which is why the purchase order has one shell and four callers.
 *
 * Brought over as it stands: the tinted wash fading to nothing, the blurred
 * glow behind a rounded icon tile, the uppercase chip under it, a centered
 * title and a narrow line of copy, then two full-width stacked buttons, the
 * scoped one filled and the far-reaching one quiet beneath it.
 *
 * Three things had to change and nothing else did. This repo's CSS variables
 * hold bare HSL triplets, so `var(--foreground)` is read through `hsl()`; the
 * purchase order names its typeface on every element, which this app sets once
 * at the root; and this repo's `AlertDialogContent` does not forward
 * `onInteractOutside`, because an alert dialog is a question to answer rather
 * than a panel to click away from. Escape still closes it, as it does there.
 */

import * as React from 'react';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog';

/* Tone palettes, as the purchase order sets them: amber for a warning that
   preserves data, red for a destructive removal, blue for an addition, so the
   entry point reads as constructive rather than as something gone wrong. */
const AMBER = {
  wash: '#FFFBEB',
  washSoft: 'rgba(255,251,235,0.3)',
  glow: '#F59E0B',
  iconBg: '#FEF3C7',
  iconColor: '#B45309',
  chipBg: '#FFFBEB',
  chipFg: '#92400E',
  primaryBg: '#F59E0B',
};
const RED = {
  wash: '#FEF2F2',
  washSoft: 'rgba(254,242,242,0.3)',
  glow: '#EF4444',
  iconBg: '#FEE2E2',
  iconColor: '#DC2626',
  chipBg: '#FEF2F2',
  chipFg: '#991B1B',
  primaryBg: '#DC2626',
};
const BLUE = {
  wash: '#EFF6FF',
  washSoft: 'rgba(239,246,255,0.3)',
  glow: '#3B82F6',
  iconBg: '#DBEAFE',
  iconColor: 'hsl(var(--primary))',
  chipBg: '#EFF6FF',
  chipFg: '#1E40AF',
  primaryBg: 'hsl(var(--primary))',
};

export type ScopeWarningTone = 'amber' | 'red' | 'blue';

export interface ScopeWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chipLabel: string;
  title: string;
  description: React.ReactNode;
  primaryLabel: string;
  secondaryLabel: string;
  onPrimary: () => void;
  onSecondary: () => void;
  tone?: ScopeWarningTone;
  /** Dialogs opened from inside the create flow's overlay have to clear it. */
  zIndex?: number;
}

export function ScopeWarningDialog({
  open,
  onOpenChange,
  chipLabel,
  title,
  description,
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
  tone = 'amber',
  zIndex = 300,
}: ScopeWarningDialogProps) {
  const palette = tone === 'red' ? RED : tone === 'blue' ? BLUE : AMBER;
  const Icon = tone === 'red' ? Trash2 : tone === 'blue' ? Plus : AlertTriangle;
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className="sm:max-w-[440px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
        style={{ zIndex, backgroundColor: '#FFFFFF' }}
      >
        <div
          className="relative flex flex-col items-center pt-10 pb-6"
          style={{
            background: `linear-gradient(180deg, ${palette.wash} 0%, ${palette.washSoft} 70%, transparent 100%)`,
          }}
        >
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25"
            style={{ backgroundColor: palette.glow }}
          />
          <div
            className="relative w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: palette.iconBg }}
          >
            <Icon className="w-8 h-8" style={{ color: palette.iconColor }} />
          </div>
          <span
            className="mt-4 px-3 py-1 rounded-full text-[11px]"
            style={{
              fontWeight: 600,
              backgroundColor: palette.chipBg,
              color: palette.chipFg,
              textTransform: 'uppercase' as const,
              letterSpacing: '0.05em',
            }}
          >
            {chipLabel}
          </span>
        </div>

        <div className="flex flex-col items-center text-center px-8 pb-8">
          <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
            <AlertDialogTitle
              className="text-[18px] tracking-[-0.02em]"
              style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}
            >
              {title}
            </AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription
            className="text-[13px] mt-2 max-w-[340px] mx-auto"
            style={{ color: 'hsl(var(--muted-foreground))', lineHeight: '1.65' }}
          >
            {description}
          </AlertDialogDescription>
          <div className="w-full mt-7 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => {
                onPrimary();
                onOpenChange(false);
              }}
              className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
              style={{
                fontWeight: 600,
                backgroundColor: palette.primaryBg,
                color: '#fff',
              }}
            >
              {primaryLabel}
            </button>
            <button
              type="button"
              onClick={() => {
                onSecondary();
                onOpenChange(false);
              }}
              className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:bg-slate-100"
              style={{
                fontWeight: 500,
                backgroundColor: 'hsl(var(--muted))',
                color: '#334155',
              }}
            >
              {secondaryLabel}
            </button>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
