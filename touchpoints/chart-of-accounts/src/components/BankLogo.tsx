import { useEffect, useState } from 'react'
import { getBankLogoUrls } from '../lib/bankInstitutions'
import { cn } from '../lib/utils'

// Shared bank logo tile. Walks the ordered logo sources (Clearbit → Google
// favicon) and, if none load, falls back to a brand-coloured monogram. Used by
// the bank combobox, the connect-feed modal, and the partner screen so every
// banking surface renders institutions identically.
export function BankLogo({
  bankName, domain, initials, color, size = 36, rounded = 'rounded-lg',
}: {
  bankName: string
  domain?: string
  initials?: string
  color?: string
  size?: number
  rounded?: string
}) {
  const sources = getBankLogoUrls(domain)
  const [idx, setIdx] = useState(0)
  useEffect(() => { setIdx(0) }, [domain])

  const px = `${size}px`
  const mono = (initials || fallbackInitials(bankName)).slice(0, 2).toUpperCase()

  if (!sources.length || idx >= sources.length) {
    return (
      <span
        className={cn(rounded, 'flex items-center justify-center text-white shrink-0')}
        style={{ width: px, height: px, backgroundColor: color || '#0A77FF', fontWeight: 700, fontSize: Math.round(size * 0.34) }}
      >
        {mono}
      </span>
    )
  }
  return (
    <span
      className={cn(rounded, 'flex items-center justify-center bg-white border border-border shrink-0 overflow-hidden')}
      style={{ width: px, height: px }}
    >
      <img
        src={sources[idx]}
        alt=""
        onError={() => setIdx(i => i + 1)}
        style={{ width: Math.round(size * 0.66), height: Math.round(size * 0.66), objectFit: 'contain' }}
      />
    </span>
  )
}

function fallbackInitials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return parts[0][0] + parts[1][0]
  return name.slice(0, 2)
}
