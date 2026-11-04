import { Calendar, Clock, Pencil, Info } from 'lucide-react';

interface DateConfigCardsProps {
  requestDateType: 'absolute' | 'relative';
  requestDateValue: string;
  requestUnit: string;
  effectiveWhenSent: boolean;
  effectiveDateType: 'absolute' | 'relative';
  effectiveDateValue: string;
  effectiveUnit: string;
  hasExpiry: boolean;
  expiryType: 'absolute' | 'relative';
  expiryValue: string;
  expiryUnit: string;
  onEdit: (card: 'request' | 'effective' | 'expiry') => void;
}

export function DateConfigCards({
  requestDateType,
  requestDateValue,
  requestUnit,
  effectiveWhenSent,
  effectiveDateType,
  effectiveDateValue,
  effectiveUnit,
  hasExpiry,
  expiryType,
  expiryValue,
  expiryUnit,
  onEdit,
}: DateConfigCardsProps) {
  const fmtNow = () => {
    const d = new Date();
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
  };

  const getRequestDisplay = () => {
    if (requestDateType === 'absolute') {
      return requestDateValue || fmtNow();
    }
    return `${requestDateValue} ${requestUnit} before today`;
  };

  const getEffectiveDisplay = () => {
    if (effectiveWhenSent) {
      return 'When quote is sent';
    }
    if (effectiveDateType === 'absolute') {
      return effectiveDateValue || fmtNow();
    }
    return `${effectiveDateValue} ${effectiveUnit} after sent`;
  };

  const getExpiryDisplay = () => {
    if (!hasExpiry) {
      return 'Never expires';
    }
    if (expiryType === 'absolute') {
      return expiryValue || fmtNow();
    }
    return `${expiryValue} ${expiryUnit} after sent`;
  };

  return (
    <div className="grid grid-cols-3 gap-3">
      {/* Request Date Card - Read Only */}
      <div
        className="group cursor-pointer"
        onClick={() => onEdit('request')}
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '6px',
          padding: '12px',
          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
          border: '1px solid #E5E7EB',
          transition: 'all 150ms'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#BFDBFE';
          e.currentTarget.style.backgroundColor = '#F0F7FF';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = '#E5E7EB';
          e.currentTarget.style.backgroundColor = '#FFFFFF';
        }}
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#9CA3AF]" />
            <label className="text-[11px] text-[#9CA3AF] uppercase tracking-wide" style={{ fontWeight: 500, letterSpacing: '0.5px' }}>
              Request Date
            </label>
          </div>
          <Pencil className="w-3 h-3 text-[#9CA3AF] group-hover:text-[#1B6EF3] transition-colors" />
        </div>
        <div className="text-[14px] text-[#1F2937] leading-tight" style={{ fontWeight: 500 }}>
          {getRequestDisplay()}
        </div>
      </div>

      {/* Effective From Card - Read Only */}
      <div
        className="group cursor-pointer"
        onClick={() => onEdit('effective')}
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '6px',
          padding: '12px',
          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
          border: '1px solid #E5E7EB',
          transition: 'all 150ms'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#BFDBFE';
          e.currentTarget.style.backgroundColor = '#F0F7FF';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = '#E5E7EB';
          e.currentTarget.style.backgroundColor = '#FFFFFF';
        }}
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#9CA3AF]" />
            <label className="text-[11px] text-[#9CA3AF] uppercase tracking-wide" style={{ fontWeight: 500, letterSpacing: '0.5px' }}>
              Effective From
            </label>
          </div>
          <Pencil className="w-3 h-3 text-[#9CA3AF] group-hover:text-[#1B6EF3] transition-colors" />
        </div>
        <div className="text-[14px] text-[#1F2937] leading-tight" style={{ fontWeight: 500 }}>
          {getEffectiveDisplay()}
        </div>
      </div>

      {/* Expiry Date Card - Read Only */}
      <div
        className="group cursor-pointer"
        onClick={() => onEdit('expiry')}
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '6px',
          padding: '12px',
          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
          border: '1px solid #E5E7EB',
          transition: 'all 150ms'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#BFDBFE';
          e.currentTarget.style.backgroundColor = '#F0F7FF';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = '#E5E7EB';
          e.currentTarget.style.backgroundColor = '#FFFFFF';
        }}
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-[#9CA3AF]" />
            <label className="text-[11px] text-[#9CA3AF] uppercase tracking-wide" style={{ fontWeight: 500, letterSpacing: '0.5px' }}>
              Expiry Date
            </label>
          </div>
          <Pencil className="w-3 h-3 text-[#9CA3AF] group-hover:text-[#1B6EF3] transition-colors" />
        </div>
        <div className="text-[14px] text-[#1F2937] leading-tight" style={{ fontWeight: 500 }}>
          {getExpiryDisplay()}
        </div>
      </div>
    </div>
  );
}