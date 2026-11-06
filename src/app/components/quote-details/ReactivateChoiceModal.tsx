import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { RotateCcw, ArrowRight, Calendar as CalendarIcon } from 'lucide-react';
import { DateEditModal } from '../quote-creation/DateEditModal';
import { RelativeDateValue } from '@/app/components/shared/RelativeDateValue';

/**
 * ReactivateQuoteModal — reactivation confirmation. Both dates
 * render as regular input-styled fields, but clicking either one
 * opens the shared `DateEditModal` (Absolute vs Relative + the
 * special-state toggles) instead of a popover calendar. The field
 * always shows the resolved date so absolute and relative
 * configurations read the same way visually.
 *
 * Parent sits at `zIndex: 11900` so `DateEditModal` (BaseModal's
 * default 12000) opens above it.
 */

interface DateConfig {
  dateType: 'absolute' | 'relative';
  absoluteValue: string;       // DD/MM/YYYY
  relativeValue: string;       // N
  relativeUnit: string;        // days | weeks | months
  hasExpiry?: boolean;
  whenSent?: boolean;
}

interface Props {
  isOpen: boolean;
  recordLabel: string;
  newVersionNumber: number;
  defaultEffectiveFrom: Date;
  defaultValidTill: Date;
  onConfirm: (effectiveFrom: string, expirationDate: string) => void;
  onCancel: () => void;
}

const toDDMMYYYY = (d: Date): string =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
const toISODate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fromDDMMYYYY = (v: string): Date | undefined => {
  if (!v) return undefined;
  const [dd, mm, yyyy] = v.split('/').map((n) => Number(n));
  if (!yyyy) return undefined;
  return new Date(yyyy, (mm ?? 1) - 1, dd ?? 1);
};
const resolveRelative = (base: Date, value: string, unit: string): Date => {
  const n = Number(value) || 0;
  const d = new Date(base);
  if (unit === 'weeks') d.setDate(d.getDate() + n * 7);
  else if (unit === 'months') d.setMonth(d.getMonth() + n);
  else d.setDate(d.getDate() + n);
  return d;
};

type FieldDisplay = { text: string; muted?: boolean; relative?: { rule: string; anchor: string } };

/** Resolve the config into a single Date + a human-facing label
 *  that fits inside a normal input field. Relative dates always show a
 *  date (the day they land on if the quote is sent today) with the
 *  asterisk; the hover card explains the rule. */
function displayFor(
  field: 'effective' | 'expiry',
  config: DateConfig,
  base?: Date,
): FieldDisplay {
  if (field === 'effective' && config.whenSent) {
    return { text: toDDMMYYYY(new Date()), relative: { rule: 'set to the day the quote is sent', anchor: 'the send date' } };
  }
  if (field === 'expiry' && config.hasExpiry === false) return { text: 'No expiry', muted: true };
  if (config.dateType === 'relative') {
    const resolved = resolveRelative(base ?? new Date(), config.relativeValue, config.relativeUnit);
    return {
      text: toDDMMYYYY(resolved),
      relative: { rule: `${config.relativeValue} ${config.relativeUnit} after the quote is sent`, anchor: 'the send date' },
    };
  }
  return { text: config.absoluteValue || 'Pick a date', muted: !config.absoluteValue };
}

function resolveDate(field: 'effective' | 'expiry', config: DateConfig, base?: Date): Date | undefined {
  if (field === 'effective' && config.whenSent) return undefined;
  if (field === 'expiry' && config.hasExpiry === false) return undefined;
  if (config.dateType === 'relative') {
    return base ? resolveRelative(base, config.relativeValue, config.relativeUnit) : undefined;
  }
  return fromDDMMYYYY(config.absoluteValue);
}

export function ReactivateChoiceModal({
  isOpen,
  recordLabel,
  newVersionNumber,
  defaultEffectiveFrom,
  defaultValidTill,
  onConfirm,
  onCancel,
}: Props) {
  const [effectiveConfig, setEffectiveConfig] = useState<DateConfig>({
    dateType: 'absolute', absoluteValue: toDDMMYYYY(defaultEffectiveFrom),
    relativeValue: '0', relativeUnit: 'days', whenSent: false,
  });
  const [expiryConfig, setExpiryConfig] = useState<DateConfig>({
    dateType: 'absolute', absoluteValue: toDDMMYYYY(defaultValidTill),
    relativeValue: '30', relativeUnit: 'days', hasExpiry: true,
  });
  const [editingField, setEditingField] = useState<'effective' | 'expiry' | null>(null);

  useEffect(() => {
    if (isOpen) {
      setEffectiveConfig({
        dateType: 'absolute', absoluteValue: toDDMMYYYY(defaultEffectiveFrom),
        relativeValue: '0', relativeUnit: 'days', whenSent: false,
      });
      setExpiryConfig({
        dateType: 'absolute', absoluteValue: toDDMMYYYY(defaultValidTill),
        relativeValue: '30', relativeUnit: 'days', hasExpiry: true,
      });
      setEditingField(null);
    }
  }, [isOpen, defaultEffectiveFrom, defaultValidTill]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !editingField) onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onCancel, editingField]);

  if (!isOpen) return null;

  const resolvedEffective = resolveDate('effective', effectiveConfig);
  const resolvedExpiry = resolveDate('expiry', expiryConfig, resolvedEffective);

  const submit = () => {
    onConfirm(
      resolvedEffective ? toISODate(resolvedEffective) : '',
      resolvedExpiry ? toISODate(resolvedExpiry) : '',
    );
  };

  const effectiveDisplay = displayFor('effective', effectiveConfig);
  const expiryDisplay = displayFor('expiry', expiryConfig, resolvedEffective);

  return createPortal(
    <>
      <div
        className="fixed inset-0 flex items-center justify-center"
        style={{ zIndex: 11900, backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}
        onClick={onCancel}
      >
        <div
          className="relative flex flex-col overflow-hidden bg-white"
          style={{
            width: 'min(500px, calc(100vw - 32px))',
            borderRadius: 16,
            boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="relative flex flex-col items-center"
            style={{ padding: '36px 0 22px', background: 'linear-gradient(180deg, #EBF3FF 0%, rgba(239,246,255,0.3) 70%, transparent 100%)' }}
          >
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2"
              style={{ width: 180, height: 80, borderRadius: 9999, filter: 'blur(50px)', opacity: 0.25, backgroundColor: '#3B82F6' }}
            />
            <div
              className="relative flex items-center justify-center"
              style={{ width: 60, height: 60, borderRadius: 16, backgroundColor: '#DBEAFE' }}
            >
              <RotateCcw style={{ width: 26, height: 26, color: '#1D4ED8' }} strokeWidth={2} />
            </div>
            <span
              className="mt-3"
              style={{
                padding: '4px 12px', borderRadius: 9999, fontSize: 11, fontWeight: 600,
                backgroundColor: '#EFF6FF', color: '#1E40AF',
                textTransform: 'uppercase', letterSpacing: '0.05em',
              }}
            >
              Reactivate · V{newVersionNumber}
            </span>
          </div>

          <div className="flex flex-col text-center" style={{ padding: '0 32px 28px' }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--foreground)', letterSpacing: '-0.02em', margin: 0 }}>
              Reactivate {recordLabel} as a new draft?
            </h3>
            <p style={{ fontSize: 13, color: 'var(--muted-foreground)', marginTop: 8, lineHeight: 1.55, margin: '8px auto 0', maxWidth: 400 }}>
              A new V{newVersionNumber} draft will be created. Adjust the validity window if needed. Both dates are optional.
            </p>

            <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, textAlign: 'left' }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', marginBottom: 6 }}>
                  Effective From
                </label>
                <DateFieldButton
                  display={effectiveDisplay}
                  onClick={() => setEditingField('effective')}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', marginBottom: 6 }}>
                  Expiration Date
                </label>
                <DateFieldButton
                  display={expiryDisplay}
                  onClick={() => setEditingField('expiry')}
                />
              </div>
            </div>

            <div className="w-full flex flex-col" style={{ marginTop: 22, gap: 10 }}>
              <button
                onClick={submit}
                className="w-full cursor-pointer transition-colors hover:opacity-90"
                style={{
                  height: 44, borderRadius: 12, fontSize: 14, fontWeight: 600,
                  backgroundColor: 'var(--primary)', color: '#FFFFFF', border: 0,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                Reactivate as V{newVersionNumber}
                <ArrowRight style={{ width: 14, height: 14 }} />
              </button>
              <button
                onClick={onCancel}
                className="w-full cursor-pointer transition-colors"
                style={{
                  height: 40, borderRadius: 12, fontSize: 13, fontWeight: 500,
                  backgroundColor: 'var(--muted)', color: '#334155', border: 0,
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>

      {editingField && (
        <DateEditModal
          type={editingField}
          isOpen
          onClose={() => setEditingField(null)}
          initialConfig={editingField === 'effective' ? effectiveConfig : expiryConfig}
          onSave={(config: DateConfig) => {
            if (editingField === 'effective') setEffectiveConfig(config);
            else setExpiryConfig(config);
          }}
        />
      )}
    </>,
    document.body,
  );
}

/** Input-styled button — matches `DatePickerField`'s trigger chrome
 *  (36px height, border, calendar icon, MM/DD/YYYY text) but opens
 *  `DateEditModal` instead of a popover calendar. */
function DateFieldButton({ display, onClick }: { display: FieldDisplay; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full cursor-pointer transition-colors"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        width: '100%', height: 36, padding: '0 12px',
        border: '1px solid var(--border)', borderRadius: 8,
        background: '#FFFFFF',
        outline: 'none',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#CBD5E1'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
      onFocus={(e) => { e.currentTarget.style.borderColor = '#0A77FF'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(10, 119, 255, 0.12)'; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      <span
        style={{
          fontSize: 13, fontWeight: 500,
          color: display.muted ? 'var(--muted-foreground)' : 'var(--foreground)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}
      >
        {display.relative
          ? <RelativeDateValue display={display.text} rule={display.relative.rule} anchor={display.relative.anchor} />
          : display.text}
      </span>
      <CalendarIcon style={{ width: 14, height: 14, color: 'var(--muted-foreground)', flexShrink: 0 }} />
    </button>
  );
}
