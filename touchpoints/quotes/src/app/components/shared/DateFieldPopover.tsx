import { useState, type ReactNode } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/app/components/ui/popover';
import { Calendar } from '@/app/components/ui/calendar';
import { Settings2 } from 'lucide-react';

/**
 * Lightweight date-picker popover for the common case: pick an
 * absolute date without spinning up a full modal.
 *
 * Uses the same `<Calendar />` UI primitive as the Partner module so
 * day-cells, navigation, today highlight, etc. all look identical
 * across the apps. When the date field has advanced config (relative
 * mode, "Effective when sent", "Never expires"), the caller can pass
 * an `onAdvanced` callback — a small "Advanced settings →" link
 * appears at the bottom of the popover and routes the user into the
 * existing modal-based editor.
 *
 * Triggers via children rendered through `asChild` so the caller can
 * use whatever surface they like (SmallCard, row, button, etc.).
 */
export interface DateFieldPopoverProps {
  value?: Date;
  onChange: (date: Date) => void;
  children: ReactNode;
  /** Optional CTA at the bottom of the popover for relative/toggle modes. */
  onAdvanced?: () => void;
  advancedLabel?: string;
  /** Disable date selection (e.g. when an override toggle has the field locked). */
  disabled?: boolean;
}

export function DateFieldPopover({
  value,
  onChange,
  children,
  onAdvanced,
  advancedLabel = 'Advanced settings',
  disabled,
}: DateFieldPopoverProps) {
  const [open, setOpen] = useState(false);

  if (disabled) {
    // Disabled — just render the trigger surface without popover wiring.
    return <>{children}</>;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="p-0 w-auto rounded-xl border bg-white overflow-hidden"
        style={{
          zIndex: 11000,
          boxShadow: '0 12px 32px -8px rgba(15, 23, 42, 0.18), 0 0 0 1px rgba(15, 23, 42, 0.04)',
        }}
      >
        <Calendar
          mode="single"
          selected={value}
          onSelect={(d) => {
            if (!d) return;
            onChange(d);
            setOpen(false);
          }}
          initialFocus
        />
        {onAdvanced && (
          <div
            className="flex items-center justify-end"
            style={{
              padding: '8px 12px',
              borderTop: '1px solid #EEF2F6',
              backgroundColor: '#FAFBFC',
            }}
          >
            <button
              type="button"
              onClick={() => { setOpen(false); onAdvanced(); }}
              className="inline-flex items-center gap-1.5 rounded-md transition-colors cursor-pointer"
              style={{
                height: 26,
                padding: '0 8px',
                fontSize: 11,
                fontWeight: 600,
                color: '#0A77FF',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#EFF6FF'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <Settings2 className="w-3 h-3" />
              {advancedLabel}
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
