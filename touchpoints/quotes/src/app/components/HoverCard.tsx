// @ts-nocheck
import { ReactNode, useState, useRef, useEffect } from 'react';

interface HoverCardProps {
  children: ReactNode;
  content: ReactNode;
  delay?: number;
}

export function HoverCard({ children, content, delay = 500 }: HoverCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<'top' | 'bottom'>('bottom');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => {
      setIsOpen(true);
      
      // Calculate position after render
      requestAnimationFrame(() => {
        if (triggerRef.current && contentRef.current) {
          const triggerRect = triggerRef.current.getBoundingClientRect();
          const contentRect = contentRef.current.getBoundingClientRect();
          const spaceBelow = window.innerHeight - triggerRect.bottom;
          const spaceAbove = triggerRect.top;
          
          // Show above if not enough space below
          if (spaceBelow < contentRect.height + 10 && spaceAbove > contentRect.height + 10) {
            setPosition('top');
          } else {
            setPosition('bottom');
          }
        }
      });
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsOpen(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div 
      ref={triggerRef}
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      
      {isOpen && (
        <div
          ref={contentRef}
          className="fixed animate-in fade-in duration-200"
          style={{
            top: position === 'bottom' 
              ? `${triggerRef.current?.getBoundingClientRect().bottom + 8}px`
              : 'auto',
            bottom: position === 'top'
              ? `${window.innerHeight - (triggerRef.current?.getBoundingClientRect().top || 0) + 8}px`
              : 'auto',
            left: `${(triggerRef.current?.getBoundingClientRect().left || 0) + ((triggerRef.current?.getBoundingClientRect().width || 0) / 2)}px`,
            transform: 'translateX(-50%)',
            minWidth: '280px',
            maxWidth: '360px',
            pointerEvents: 'none',
            zIndex: 10000
          }}
        >
          <div className="bg-white rounded-lg shadow-xl border border-[#E5E7EB] overflow-hidden">
            {content}
          </div>
          
          {/* Arrow */}
          <div
            className="absolute left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-[#E5E7EB] rotate-45"
            style={{
              [position === 'top' ? 'bottom' : 'top']: '-6px',
              borderWidth: position === 'top' ? '0 1px 1px 0' : '1px 0 0 1px',
              zIndex: 9999
            }}
          />
        </div>
      )}
    </div>
  );
}