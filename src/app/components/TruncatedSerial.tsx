/**
 * Serial number that collapses to its unique tail behind a ··· pill, ported
 * from the Physical Inventory "Select Serial" modal. A manufacturer serial
 * encodes family, plant and build week before the part that actually names
 * the unit, so the tail is what a picker scans; the pill previews the rest
 * without giving every row the width of its longest serial.
 */
import { useState } from 'react';

const DEFAULT_SUFFIX_LENGTH = 8;

export function TruncatedSerial({
  serial,
  highlight,
  query,
  className,
  style,
  suffixLength = DEFAULT_SUFFIX_LENGTH,
}: {
  serial: string;
  highlight?: (text: string, query: string) => React.ReactNode;
  query?: string;
  className?: string;
  style?: React.CSSProperties;
  /** Trailing characters kept visible when collapsed. */
  suffixLength?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const prefix = serial.length > suffixLength ? serial.slice(0, serial.length - suffixLength) : '';
  const suffix = prefix ? serial.slice(-suffixLength) : serial;

  const render = (text: string) => (highlight && query ? highlight(text, query) : text);

  if (!prefix) {
    return <span className={`${className ?? ''} whitespace-nowrap`} style={style}>{render(serial)}</span>;
  }

  // A search can match the half of the serial the pill is hiding, and then the
  // row appears in the results with nothing on it lit up -- the user is left
  // reading a list of tails wondering what matched. The pill says so: the
  // match is in here, open it.
  const hiddenMatch =
    !!query &&
    query.trim().length > 0 &&
    prefix.toLowerCase().includes(query.trim().toLowerCase()) &&
    !suffix.toLowerCase().includes(query.trim().toLowerCase());

  // The pill sits inside a row that toggles selection, so its click must not
  // reach the row or previewing a serial would also pick the unit.
  const pill = (
    <span
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        setExpanded((p) => !p);
      }}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        e.stopPropagation();
        setExpanded((p) => !p);
      }}
      title={
        expanded
          ? 'Collapse serial number'
          : hiddenMatch
            ? `Matches "${query!.trim()}" in the hidden part: ${serial}`
            : serial
      }
      className={`inline-flex items-center justify-center px-1 mr-1 rounded border text-[10px] leading-[16px] select-none cursor-pointer transition-colors align-baseline ${
        hiddenMatch && !expanded
          ? 'border-amber-300 bg-[#FEF08A] text-amber-900 hover:bg-amber-200'
          : 'border-border bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700'
      }`}
    >
      {expanded ? '↑' : '···'}
    </span>
  );

  if (expanded) {
    return (
      <span className={`${className ?? ''} break-all`} style={style}>
        {pill}
        {render(serial)}
      </span>
    );
  }

  return (
    <span className={`${className ?? ''} truncate whitespace-nowrap`} style={style} title={serial}>
      {pill}
      {render(suffix)}
    </span>
  );
}
