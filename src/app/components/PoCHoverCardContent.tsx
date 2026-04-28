import { PointOfContact } from '@/app/types/quote';
import { Mail, Phone, User, Briefcase, Users } from 'lucide-react';

interface PoCHoverCardContentProps {
  contacts: PointOfContact[];
}

export function PoCHoverCardContent({ contacts }: PoCHoverCardContentProps) {
  const primaryContact = contacts.find(c => c.isPrimary) || contacts[0];
  const additionalContacts = contacts.filter(c => c.id !== primaryContact.id);

  return (
    <div className="p-4">
      {/* Primary Contact Header */}
      <div className="flex items-start gap-3 mb-4 pb-4 border-b border-[#E5E7EB]">
        <div className="w-10 h-10 rounded-full bg-[#E7F3FF] flex items-center justify-center flex-shrink-0">
          <User className="w-5 h-5 text-[#1B6EF3]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-[14px] font-semibold text-[#1F2937] truncate" style={{ fontWeight: 600 }}>
              {primaryContact.name}
            </h4>
            {primaryContact.isPrimary && (
              <span className="text-[10px] bg-[#D1FAE5] text-[#065F46] px-1.5 py-0.5 rounded font-medium flex-shrink-0" style={{ fontWeight: 500, borderRadius: '3px' }}>
                Primary
              </span>
            )}
          </div>
          {primaryContact.role && (
            <div className="flex items-center gap-1.5 text-[12px] text-[#6B7280] mb-2">
              <Briefcase className="w-3.5 h-3.5" />
              <span>{primaryContact.role}</span>
            </div>
          )}
        </div>
      </div>

      {/* Primary Contact Details */}
      <div className="space-y-2.5 mb-4">
        <div className="flex items-center gap-2.5">
          <Mail className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" />
          <a 
            href={`mailto:${primaryContact.email}`}
            className="text-[13px] text-[#1B6EF3] hover:underline truncate"
            onClick={(e) => e.stopPropagation()}
          >
            {primaryContact.email}
          </a>
        </div>
        
        {primaryContact.phone && (
          <div className="flex items-center gap-2.5">
            <Phone className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" />
            <a 
              href={`tel:${primaryContact.phone}`}
              className="text-[13px] text-[#1B6EF3] hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {primaryContact.phone}
            </a>
          </div>
        )}

        {primaryContact.username && (
          <div className="flex items-center gap-2.5">
            <User className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" />
            <span className="text-[13px] text-[#6B7280]">
              @{primaryContact.username}
            </span>
          </div>
        )}
      </div>

      {/* Additional Contacts Summary */}
      {additionalContacts.length > 0 && (
        <div className="pt-3 border-t border-[#E5E7EB]">
          <div className="flex items-center gap-2 text-[12px] text-[#6B7280]">
            <Users className="w-4 h-4" />
            <span>
              +{additionalContacts.length} additional contact{additionalContacts.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}