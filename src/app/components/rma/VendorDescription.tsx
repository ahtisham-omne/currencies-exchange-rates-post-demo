/**
 * A vendor's description under their name, truncated with a `more` toggle.
 *
 * The recipe is the line-items table's item description in
 * `ReturnVendorStep.tsx` -- one truncated line beside a primary-blue `more`
 * with a chevron, expanding in place to the whole text with `Show less`. A
 * description behaves the same way whether it is describing a part or a
 * partner, so it reads the same way too.
 *
 * Its own component because two steps draw this card: merge and split, and
 * credit or refund. They were told to be the same card and this is the part of
 * it that carries state.
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export function VendorDescription({ text, name }: { text: string; name: string }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;

  return (
    <div className="mt-1 w-full min-w-0 text-[12px] leading-snug text-slate-500">
      {open ? (
        <span className="block whitespace-normal break-words">
          {text}{' '}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
            aria-label={`Show less about ${name}`}
            className="inline-flex cursor-pointer items-center gap-0.5 align-baseline text-[12px] text-primary transition-colors hover:text-blue-700"
            style={{ fontWeight: 500 }}
          >
            Show less <ChevronUp className="w-3.5 h-3.5" />
          </button>
        </span>
      ) : (
        <span className="flex w-full min-w-0 items-center gap-1">
          <span className="min-w-0 flex-1 truncate">{text}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(true);
            }}
            aria-label={`Read more about ${name}`}
            className="inline-flex shrink-0 cursor-pointer items-center gap-0.5 text-[12px] text-primary transition-colors hover:text-blue-700"
            style={{ fontWeight: 500 }}
          >
            more <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </span>
      )}
    </div>
  );
}
