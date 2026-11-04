import { Customer } from '@/app/types/quote';
import { MapPin, Building2, Users } from 'lucide-react';

interface CustomerHoverCardContentProps {
  customer: Customer;
  pocCount?: number;
  additionalLocationsCount?: number;
}

export function CustomerHoverCardContent({ 
  customer, 
  pocCount = 0,
  additionalLocationsCount = 0 
}: CustomerHoverCardContentProps) {
  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-[#F3F4F6] flex items-center justify-center flex-shrink-0">
          <Building2 className="w-5 h-5 text-[#6B7280]" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-[14px] font-semibold text-[#1F2937] mb-1 truncate" style={{ fontWeight: 600 }}>
            {customer.name}
          </h4>
          <p className="text-[11px] text-[#9CA3AF] uppercase font-medium tracking-wide" style={{ fontWeight: 500, letterSpacing: '0.5px' }}>
            Customer ID: {customer.id}
          </p>
        </div>
      </div>

      {/* Location Info */}
      {customer.location && (
        <div className="mb-4 p-3 bg-[#FAFBFC] rounded border border-[#E5E7EB]" style={{ borderRadius: '6px' }}>
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-[#1B6EF3] mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[13px] font-medium text-[#1F2937]" style={{ fontWeight: 500 }}>
                  {customer.location.name}
                </span>
                {customer.location.isPrimary && (
                  <span className="text-[10px] bg-[#1B6EF3] text-white px-1.5 py-0.5 rounded font-medium" style={{ fontWeight: 500, borderRadius: '3px' }}>
                    Primary
                  </span>
                )}
              </div>
              {additionalLocationsCount > 0 && (
                <p className="text-[11px] text-[#6B7280]">
                  +{additionalLocationsCount} more location{additionalLocationsCount !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-2.5 bg-[#F9FAFB] rounded" style={{ borderRadius: '6px' }}>
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-3.5 h-3.5 text-[#9CA3AF]" />
            <span className="text-[11px] text-[#9CA3AF] font-medium" style={{ fontWeight: 500 }}>
              Contacts
            </span>
          </div>
          <p className="text-[16px] font-semibold text-[#1F2937]" style={{ fontWeight: 600 }}>
            {pocCount}
          </p>
        </div>

        <div className="p-2.5 bg-[#F9FAFB] rounded" style={{ borderRadius: '6px' }}>
          <div className="flex items-center gap-2 mb-1">
            <MapPin className="w-3.5 h-3.5 text-[#9CA3AF]" />
            <span className="text-[11px] text-[#9CA3AF] font-medium" style={{ fontWeight: 500 }}>
              Locations
            </span>
          </div>
          <p className="text-[16px] font-semibold text-[#1F2937]" style={{ fontWeight: 600 }}>
            {1 + additionalLocationsCount}
          </p>
        </div>
      </div>
    </div>
  );
}
