interface HighlightTextProps {
  text: string;
  searchTerm: string;
  className?: string;
}

export function HighlightText({ text, searchTerm, className = '' }: HighlightTextProps) {
  if (!searchTerm.trim()) {
    return <span className={className}>{text}</span>;
  }

  const parts = text.split(new RegExp(`(${searchTerm})`, 'gi'));
  
  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.toLowerCase() === searchTerm.toLowerCase()) {
          return (
            <span
              key={index}
              className="bg-[#FEF08A] text-[#1F2937]"
              style={{
                padding: '1px 2px',
                borderRadius: '2px',
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
