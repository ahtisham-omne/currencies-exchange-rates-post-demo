interface HighlightTextProps {
  text: string | null | undefined;
  searchTerm: string | null | undefined;
  className?: string;
}

/* Yellow-mark search-match span. Defensive against:
   · `text` arriving as undefined/null (renders empty string, no
     crash on `.split`),
   · `searchTerm` arriving as undefined/null (renders the raw text
     so the component still degrades gracefully),
   · `searchTerm` containing regex metacharacters (e.g. `Net (30)`)
     which would otherwise blow up `new RegExp(...)`.
   Earlier the regex wasn't escaped, which is why any user typing
   parentheses, brackets, or other special chars crashed the modal. */
export function HighlightText({ text, searchTerm, className = '' }: HighlightTextProps) {
  const safeText = text == null ? '' : String(text);
  const safeTerm = searchTerm == null ? '' : String(searchTerm);
  if (!safeTerm.trim() || !safeText) {
    return <span className={className}>{safeText}</span>;
  }

  const escapedTerm = safeTerm.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = safeText.split(new RegExp(`(${escapedTerm})`, 'gi'));

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.toLowerCase() === safeTerm.trim().toLowerCase()) {
          return (
            <span
              key={index}
              style={{
                backgroundColor: '#FEFCE8',
                color: '#854D0E',
                padding: '1px 2px',
                borderRadius: '2px',
                fontWeight: 500,
              }}
            >
              {part}
            </span>
          );
        }
        return part;
      })}
    </span>
  );
}
