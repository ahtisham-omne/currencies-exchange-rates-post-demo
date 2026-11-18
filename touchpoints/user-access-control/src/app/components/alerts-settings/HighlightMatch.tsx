interface HighlightMatchProps {
  text: string;
  query?: string;
  /** Tailwind classes applied to the <mark> element. Defaults to the original
   *  amber-tint with inherited text color so existing callers keep their look. */
  matchClassName?: string;
}

const DEFAULT_MATCH_CLASS = "bg-[#FEF3C7] text-inherit rounded-sm px-0.5";

export function HighlightMatch({ text, query, matchClassName = DEFAULT_MATCH_CLASS }: HighlightMatchProps) {
  const q = (query ?? "").trim();
  if (!q) return <>{text}</>;
  const lower = text.toLowerCase();
  const ql = q.toLowerCase();
  const parts: { t: string; match: boolean }[] = [];
  let i = 0;
  while (i < text.length) {
    const idx = lower.indexOf(ql, i);
    if (idx === -1) {
      parts.push({ t: text.slice(i), match: false });
      break;
    }
    if (idx > i) parts.push({ t: text.slice(i, idx), match: false });
    parts.push({ t: text.slice(idx, idx + ql.length), match: true });
    i = idx + ql.length;
  }
  return (
    <>
      {parts.map((p, k) =>
        p.match ? (
          <mark key={k} className={matchClassName}>
            {p.t}
          </mark>
        ) : (
          <span key={k}>{p.t}</span>
        )
      )}
    </>
  );
}
