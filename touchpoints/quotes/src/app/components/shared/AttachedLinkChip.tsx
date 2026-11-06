/* Compact chip used inline under a note textarea to represent an
 * attached external link. Clicking the label opens the URL in a new
 * tab; clicking the trailing X detaches it from the note (the link
 * itself remains in the shared repository). */
import { Link2, X } from 'lucide-react';
import { type ExternalLink } from '../../data/linksRepository';

interface AttachedLinkChipProps {
  link: ExternalLink;
  onRemove?: () => void;
}

export function AttachedLinkChip({ link, onRemove }: AttachedLinkChipProps) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full"
      style={{
        padding: '2px 4px 2px 8px',
        border: '1px solid var(--border)',
        background: 'var(--accent)',
        color: 'var(--primary)',
        fontSize: 11.5,
        fontWeight: 500,
        maxWidth: 240,
      }}
    >
      <Link2 style={{ width: 11, height: 11, flexShrink: 0 }} />
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        title={link.url}
        className="truncate hover:underline"
        style={{ color: 'inherit', textDecoration: 'none', minWidth: 0 }}
      >
        {link.label}
      </a>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Detach ${link.label}`}
          className="inline-flex items-center justify-center rounded-full hover:bg-white/70 transition-colors"
          style={{ width: 16, height: 16, border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer', flexShrink: 0 }}
        >
          <X style={{ width: 10, height: 10 }} />
        </button>
      )}
    </span>
  );
}
