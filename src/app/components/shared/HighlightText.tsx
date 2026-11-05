/**
 * Yellow-highlight search-match span — Partner v7 chrome.
 *
 * `<mark>`-style highlight with the same tokens Partner uses
 * (`#FEFCE8` bg / `#854D0E` text / weight 500 / 2-px rounded). Splits on a
 * case-insensitive regex of the search term so all occurrences get marked.
 */
interface HighlightTextProps {
  text: string;
  searchTerm: string;
  className?: string;
}

export function HighlightText({ text, searchTerm, className = '' }: HighlightTextProps) {
  if (!searchTerm.trim()) {
    return <span className={className}>{text}</span>;
  }

  const term = searchTerm.trim();
  const parts = text.split(new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));

  return (
    <span className={className}>
      {parts.map((part, index) =>
        part.toLowerCase() === term.toLowerCase() ? (
          <span
            key={index}
            style={{
              backgroundColor: '#FEFCE8',
              color: '#854D0E',
              padding: '1px 2px',
              borderRadius: 2,
              fontWeight: 500,
            }}
          >
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </span>
  );
}
