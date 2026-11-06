import { useState } from 'react';
import { MessageCircle } from 'lucide-react';

interface UnreadIndicatorProps {
  count: number;
  onClick: () => void;
}

export function UnreadIndicator({ count, onClick }: UnreadIndicatorProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (count === 0) return null;

  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="relative flex items-center justify-center w-[10px] h-[10px] bg-[#EF4444] rounded-full cursor-pointer group"
        style={{
          animation: 'pulse-subtle 2s ease-in-out infinite'
        }}
      >
        {count > 1 && (
          <span className="absolute inset-0 flex items-center justify-center text-[8px] font-semibold text-white" style={{ fontWeight: 700 }}>
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {showTooltip && (
        <div 
          className="absolute right-0 top-full mt-1 px-2 py-1 bg-[#1F2937] text-white text-[11px] rounded whitespace-nowrap z-30"
          style={{ borderRadius: '4px' }}
        >
          {count} unread message{count !== 1 ? 's' : ''}
        </div>
      )}

      <style>{`
        @keyframes pulse-subtle {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.1);
            opacity: 0.9;
          }
        }
      `}</style>
    </div>
  );
}

// Alternative speech bubble version
export function UnreadIndicatorBubble({ count, onClick }: UnreadIndicatorProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (count === 0) return null;

  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="relative"
      >
        <MessageCircle className="w-4 h-4 text-[#6B7280]" />
        <span 
          className="absolute -top-1 -right-1 w-[10px] h-[10px] bg-[#EF4444] rounded-full flex items-center justify-center"
          style={{ animation: 'pulse-subtle 2s ease-in-out infinite' }}
        >
          {count > 1 && (
            <span className="text-[7px] font-semibold text-white" style={{ fontWeight: 700 }}>
              {count > 9 ? '9' : count}
            </span>
          )}
        </span>
      </button>

      {showTooltip && (
        <div 
          className="absolute right-0 top-full mt-1 px-2 py-1 bg-[#1F2937] text-white text-[11px] rounded whitespace-nowrap z-30"
          style={{ borderRadius: '4px' }}
        >
          {count} unread message{count !== 1 ? 's' : ''}
        </div>
      )}

      <style>{`
        @keyframes pulse-subtle {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.1);
            opacity: 0.9;
          }
        }
      `}</style>
    </div>
  );
}
