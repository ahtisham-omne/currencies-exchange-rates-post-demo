import React, { useState, useRef, useEffect } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';

interface ExpandableTextareaProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  maxLength?: number;
  label?: string;
  expandMode?: 'full' | 'contained';
}

export function ExpandableTextarea({
  value,
  onChange,
  placeholder,
  maxLength = 5000,
  label,
  expandMode = 'contained',
}: ExpandableTextareaProps) {
  const [expanded, setExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isContained = expandMode === 'contained';

  useEffect(() => {
    if (expanded && textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [expanded]);

  return (
    <div>
      {label && <label className="text-[12px] text-foreground mb-1.5 block" style={{ fontWeight: 500 }}>{label}</label>}
      <div className="relative" style={{ height: 72 }}>
        {expanded && <div className="fixed inset-0 z-[12200]" onClick={() => setExpanded(false)} />}
        <div
          className="absolute top-0 right-0"
          style={{
            zIndex: expanded ? 12300 : 1,
            left: expanded ? (isContained ? '-2.5%' : '-80%') : 0,
            marginLeft: expanded ? (isContained ? 0 : -12) : 0,
            marginRight: expanded ? (isContained ? '-2.5%' : -12) : 0,
            marginTop: expanded ? (isContained ? -12 : -32) : 0,
            transition: 'left 300ms cubic-bezier(0.16, 1, 0.3, 1), margin 300ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => { if (e.target.value.length <= maxLength) onChange(e.target.value); }}
            onDoubleClick={() => { if (!expanded) setExpanded(true); }}
            placeholder={placeholder}
            className={`w-full rounded-lg bg-white resize-none text-[13px] text-foreground placeholder:text-slate-400 px-3 py-2 border outline-none ${
              expanded
                ? 'border-primary ring-2 ring-primary/15'
                : 'border-border focus:border-primary focus:ring-1 focus:ring-primary/20'
            }`}
            style={{
              height: expanded ? (isContained ? 140 : 190) : 72,
              boxShadow: expanded ? '0 12px 40px -8px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.03)' : 'none',
              transition: 'height 300ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 300ms cubic-bezier(0.16, 1, 0.3, 1), border-color 200ms ease',
            }}
          />
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className={`absolute top-2 right-2 w-6 h-6 rounded-md flex items-center justify-center cursor-pointer ${
              expanded ? 'text-primary hover:bg-blue-50' : 'text-slate-400 hover:text-primary hover:bg-blue-50'
            }`}
            style={{ transition: 'color 200ms ease, background-color 200ms ease' }}
            title={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
          </button>
        </div>
      </div>
    </div>
  );
}
