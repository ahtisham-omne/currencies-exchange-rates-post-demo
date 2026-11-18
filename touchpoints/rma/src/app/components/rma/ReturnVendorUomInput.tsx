/**
 * `UomInput`, lifted from the shipment wizard.
 *
 * `shipment-details-page/src/list/components/create-shipment-wizard.tsx:328`
 * verbatim, minus the overship hover card, which has no counterpart on a
 * return. 118x32 at 8px radius, a slate hairline that turns #0A77FF with a
 * 3px ring on focus, the figure left in 12/500, the unit behind a divider in
 * 12/700 opening its own small dropdown.
 *
 * The unit list here is the part's own shelves rather than a global constant,
 * since a return is written on a shelf that was actually received in.
 */

import { useEffect, useRef, useState } from 'react';

const f = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

export function ReturnVendorUomInput({
  value,
  unit,
  units = [],
  disabled = false,
  ariaLabel,
  onValueChange,
  onUnitChange,
}: {
  value: number;
  unit: string;
  units?: string[];
  disabled?: boolean;
  ariaLabel: string;
  onValueChange: (v: number) => void;
  onUnitChange?: ((u: string) => void) | undefined;
}) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [focused, setFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node))
        setShowDropdown(false);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const borderColor = !disabled && focused ? '#0A77FF' : '#E2E8F0';
  const ring =
    !disabled && focused ? '0 0 0 3px rgba(10,119,255,0.15)' : '0 1px 2px rgba(15,23,42,0.04)';
  const pickable = units.length > 1 && onUnitChange !== undefined && !disabled;

  return (
    <div
      ref={containerRef}
      className="inline-flex items-stretch relative"
      style={{
        width: 118,
        height: 32,
        borderRadius: 8,
        border: `1px solid ${borderColor}`,
        boxShadow: ring,
        overflow: 'hidden',
        backgroundColor: disabled ? '#F8FAFC' : '#FFFFFF',
        opacity: disabled ? 0.65 : 1,
        transition: 'border-color 150ms, box-shadow 150ms',
      }}
    >
      <input
        type="number"
        value={value === 0 ? '' : value}
        placeholder="Enter"
        aria-label={ariaLabel}
        onChange={(e) => {
          const v = parseInt(e.target.value) || 0;
          onValueChange(Math.max(v, 0));
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        disabled={disabled}
        className="flex-1 min-w-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-slate-400"
        style={{
          fontFamily: f,
          fontSize: 12,
          fontWeight: 500,
          textAlign: 'left',
          padding: '0 10px',
          border: 'none',
          outline: 'none',
          backgroundColor: 'transparent',
          color: '#0F172A',
          cursor: disabled ? 'not-allowed' : 'text',
        }}
        min={0}
      />
      <button
        type="button"
        onClick={() => pickable && setShowDropdown(!showDropdown)}
        disabled={!pickable}
        aria-label={`Unit for ${ariaLabel}`}
        className="flex items-center justify-center gap-1"
        style={{
          fontFamily: f,
          fontSize: 12,
          fontWeight: 700,
          color: '#0F172A',
          backgroundColor: disabled ? '#F1F5F9' : '#FFFFFF',
          padding: '0 10px',
          minWidth: 44,
          borderLeft: `1px solid ${borderColor}`,
          cursor: pickable ? 'pointer' : 'default',
          transition: 'background-color 150ms',
        }}
      >
        {unit}
      </button>
      {showDropdown && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            zIndex: 10,
            marginTop: 4,
            backgroundColor: '#fff',
            border: '1px solid #E2E8F0',
            borderRadius: 8,
            boxShadow: '0 12px 24px -8px rgba(0,0,0,0.12)',
            minWidth: 80,
            maxHeight: 200,
            overflowY: 'auto',
            padding: 4,
          }}
        >
          {units.map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => {
                onUnitChange?.(u);
                setShowDropdown(false);
              }}
              className="w-full text-left cursor-pointer border-none bg-transparent transition-colors"
              style={{
                fontFamily: f,
                fontSize: 12,
                color: u === unit ? '#0A77FF' : '#0F172A',
                fontWeight: u === unit ? 600 : 400,
                padding: '6px 12px',
                borderRadius: 6,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#F1F5F9';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {u}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
