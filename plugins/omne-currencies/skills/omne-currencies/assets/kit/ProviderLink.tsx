import * as React from 'react';
import { ExternalLink } from 'lucide-react';
import { RATE_PROVIDER } from './rates';

/* ── The rate provider, as a link ─────────────────────────────────────
 * "Open Exchange Rates" links to its site wherever it is shown on screen
 * (Mahreen, 2026-11-19), the way the Currency & Exchange Rates pages already
 * link it (SourceLink there): the name, an external-link mark, a new tab.
 * Printed documents, message text and plain tooltips keep the name as text.
 *
 * Shared file. Do not edit it in a module. */

export const RATE_PROVIDER_NAME = RATE_PROVIDER;
export const RATE_PROVIDER_URL = 'https://openexchangerates.org';

export function ProviderLink({ className, style }: { className?: string | undefined; style?: React.CSSProperties | undefined }) {
  return (
    <a
      href={RATE_PROVIDER_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex items-center gap-0.5 underline-offset-2 hover:underline ${className ?? ''}`}
      style={{ color: '#0A77FF', fontWeight: 500, ...style }}
    >
      {RATE_PROVIDER_NAME}
      <ExternalLink style={{ width: '0.85em', height: '0.85em' }} aria-hidden />
    </a>
  );
}

/** Text with the provider's name in it, the name as a link. Anything else is
 *  returned as it is. */
export function linkProvider(text: React.ReactNode): React.ReactNode {
  if (typeof text !== 'string' || !text.includes(RATE_PROVIDER_NAME)) return text;
  const parts = text.split(RATE_PROVIDER_NAME);
  return parts.map((part, i) => (
    <React.Fragment key={i}>
      {part}
      {i < parts.length - 1 && <ProviderLink />}
    </React.Fragment>
  ));
}
