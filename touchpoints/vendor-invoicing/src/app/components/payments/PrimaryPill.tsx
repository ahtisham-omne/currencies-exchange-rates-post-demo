import { Star } from 'lucide-react';

/**
 * "Primary" badge for saved payment methods, a 1:1 port of the partner
 * module's PrimaryPill (blue-800 ink + filled star on the blue-50 / blue-200
 * tint ramp, which resolves to the DS blue family derived from #0A77FF).
 */
export function PrimaryPill({ size = 'sm', className = '' }: { size?: 'sm' | 'xs'; className?: string }) {
  const text = size === 'xs' ? 'text-[9px]' : 'text-[10px]';
  const padX = size === 'xs' ? 'px-1.5' : 'px-2';
  const padY = size === 'xs' ? 'py-[1px]' : 'py-[2px]';
  return (
    <span
      className={`inline-flex items-center gap-1 ${padX} ${padY} rounded-md text-blue-800 bg-blue-50 border border-blue-200 ${text} whitespace-nowrap ${className}`}
      style={{ fontWeight: 600 }}
    >
      <Star className="w-2.5 h-2.5 fill-blue-800 text-blue-800" />
      Primary
    </span>
  );
}
