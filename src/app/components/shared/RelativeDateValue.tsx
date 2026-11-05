import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/app/components/ui/hover-card';

/**
 * A date that is set relative to an event, shown as a date.
 *
 * "30 days after sent" tells the reader the rule but not the day, which is the
 * thing they came to read. So the card shows the day the rule currently lands
 * on, marks it with a blue asterisk, and keeps the rule in a hover card. The
 * date and asterisk are the trigger (help cursor); there is no info icon. The asterisk is the signal that this value moves: the date is
 * what it resolves to today, not a date someone typed.
 */
export function RelativeDateValue({
  display,
  rule,
  anchor,
  showResolved = true,
}: {
  /** The resolved date, formatted the way the surrounding card formats dates. */
  display: string;
  /** The rule in plain words, e.g. "30 days after the quote is sent". */
  rule: string;
  /** What the rule counts from, e.g. "the date the quote is sent". */
  anchor: string;
  /** Set false when the value is anchored to an event that has not happened
   *  yet, so there is no day to resolve it to. */
  showResolved?: boolean;
}) {
  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <span className="inline-flex items-baseline" style={{ gap: 3, cursor: 'help' }}>
          <span>{display}</span>
          <span style={{ color: 'var(--primary)', fontWeight: 600 }} aria-hidden>*</span>
          <span className="sr-only">Relative date. {rule}</span>
        </span>
      </HoverCardTrigger>
      <HoverCardContent
        side="bottom"
        align="start"
        sideOffset={8}
        className="w-[280px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden z-[12600]"
      >
        <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-3.5 py-2.5 relative overflow-hidden">
          <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
          <p className="relative text-[12px] text-white" style={{ fontWeight: 600, letterSpacing: '0.01em' }}>
            Relative date
          </p>
        </div>
        <div className="bg-white px-3.5 py-3 flex flex-col" style={{ gap: 8 }}>
          <p className="text-[12px] text-slate-600" style={{ lineHeight: 1.55, margin: 0 }}>
            This date is not fixed. It is {rule}, so it moves whenever {anchor} moves.
          </p>
          {showResolved && (
            <div className="flex items-start gap-2 min-w-0">
              <span className="text-[11px] text-slate-400 shrink-0" style={{ fontWeight: 600, width: 62 }}>Today</span>
              <span className="text-[11.5px] text-foreground min-w-0" style={{ fontWeight: 500 }}>{display}</span>
            </div>
          )}
          <p className="text-[11.5px] text-slate-400" style={{ lineHeight: 1.5, margin: 0 }}>
            The asterisk marks a date that is calculated. Open the card to set a fixed date instead.
          </p>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
