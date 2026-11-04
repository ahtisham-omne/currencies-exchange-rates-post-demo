import { Priority } from '@/app/types/quote';

interface PriorityBadgeProps {
  priority: Priority;
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const getPriorityStyles = (priority: Priority) => {
    switch (priority) {
      case 'Urgent':
        return 'bg-[#FEE2E2] text-[#991B1B]';
      case 'Medium':
        return 'bg-[#DBEAFE] text-[#1E40AF]';
      case 'Low':
        return 'bg-[#F3F4F6] text-[#6B7280]';
      default:
        return 'bg-[#F3F4F6] text-[#6B7280]';
    }
  };

  return (
    <span 
      className={`inline-flex items-center justify-center h-5 px-2 rounded text-[11px] font-medium whitespace-nowrap ${getPriorityStyles(priority)}`}
      style={{ borderRadius: '4px', fontWeight: 500 }}
    >
      {priority}
    </span>
  );
}
