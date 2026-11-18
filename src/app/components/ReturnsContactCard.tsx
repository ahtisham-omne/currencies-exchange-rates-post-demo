import { useState } from 'react';
import { Mail, Phone, Star } from 'lucide-react';

import { returnsContactFor } from '@/app/data/mockRMAs';

/** Phone / email row. Hover swaps the slate surface for the accent one so the
 *  row reads as reachable rather than as a static label. */
function ContactInfoRow({ icon: Icon, value }: { icon: React.ElementType; value: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="flex items-center gap-2.5 rounded-lg cursor-pointer transition-all duration-150"
      style={{
        padding: '6px 10px',
        backgroundColor: hovered ? 'hsl(var(--accent))' : '#F8FAFC',
        border: `1px solid ${hovered ? '#DBEAFE' : 'hsl(var(--muted))'}`,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Icon
        className="shrink-0 transition-colors"
        style={{ width: 12, height: 12, color: hovered ? 'hsl(var(--primary))' : '#B0BEC5' }}
        strokeWidth={2}
      />
      <span
        className="text-muted-foreground truncate"
        style={{ fontSize: 10, fontWeight: 500, lineHeight: 1.4 }}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}

/** The vendor's returns desk. Violet avatar rather than the primary-blue one
 *  the vendor identity wears elsewhere, so a person never reads as a company. */
export function ReturnsContactCard({ vendor }: { vendor: string }) {
  const contact = returnsContactFor(vendor);
  const initials = contact.name
    .split(' ')
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2);
  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #F0EBFF 0%, #E9DFFF 100%)',
              color: '#6D28D9',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {initials}
          </div>
          <div
            className="absolute w-3.5 h-3.5 rounded-full"
            style={{ bottom: -2, right: -2, backgroundColor: '#10B981', border: '2px solid #FFFFFF' }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <p
              className="text-slate-700 truncate"
              style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.35 }}
              title={contact.name}
            >
              {contact.name}
            </p>
            <Star
              className="shrink-0 fill-blue-800 text-blue-800"
              style={{ width: 12, height: 12 }}
              aria-label="Primary contact"
            />
          </div>
          <p
            className="text-slate-500 truncate"
            style={{ fontSize: 10, fontWeight: 400, lineHeight: 1.4, marginTop: 2 }}
          >
            {contact.role}
          </p>
        </div>
      </div>
      <div className="mt-3 space-y-1.5">
        <ContactInfoRow icon={Phone} value={contact.phone} />
        <ContactInfoRow icon={Mail} value={contact.email} />
      </div>
    </div>
  );
}
