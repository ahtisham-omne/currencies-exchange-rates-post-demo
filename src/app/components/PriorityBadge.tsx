import { Priority } from '@/app/types/quote';

/**
 * Quote priority pill — Partner-aligned chrome (rounded-full + colored border).
 */
interface PriorityBadgeProps {
  priority: Priority;
}

const priorityStyles: Record<string, { bg: string; text: string; border: string }> = {
  High:     { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA' },
  Standard: { bg: '#EFF6FF', text: '#1E40AF', border: '#BFDBFE' },
  Low:      { bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' },
};

// Legacy term mapping — older mock data and stored quotes may still carry
// 'Urgent' / 'Medium' values. Normalise to the canonical three terms.
function normalize(priority: string): 'High' | 'Standard' | 'Low' {
  if (priority === 'Urgent') return 'High';
  if (priority === 'Medium') return 'Standard';
  return (priority as 'High' | 'Standard' | 'Low');
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const label = normalize(priority);
  const cfg = priorityStyles[label] ?? priorityStyles.Low;
  return (
    <span
      className="inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-xs whitespace-nowrap shrink-0"
      style={{
        fontWeight: 500,
        backgroundColor: cfg.bg,
        color: cfg.text,
        borderColor: cfg.border,
      }}
    >
      {label}
    </span>
  );
}
