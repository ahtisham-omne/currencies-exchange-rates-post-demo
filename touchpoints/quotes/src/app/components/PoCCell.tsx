import { useState } from 'react';
import { HoverCard } from '@/app/components/HoverCard';
import { PoCHoverCardContent } from '@/app/components/PoCHoverCardContent';
import { HighlightText } from '@/app/components/HighlightText';

interface Contact {
  id: string;
  name: string;
  username?: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  isPrimary: boolean;
  role?: string;
}

interface PoCCellProps {
  contacts: Contact[];
  onClick?: (contactId: string) => void;
  searchTerm?: string;
}

export function PoCCell({ contacts, onClick, searchTerm = '' }: PoCCellProps) {
  const [showPopover, setShowPopover] = useState(false);
  
  if (contacts.length === 0) return null;

  const primaryContact = contacts.find(c => c.isPrimary) || contacts[0];
  const additionalContacts = contacts.filter(c => c.id !== primaryContact.id);

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        {/* Avatar or Initials - 28px */}
        <ContactAvatar contact={primaryContact} size={28} />

        {/* Contact Info - Name and Primary Badge Only */}
        <div className="flex-1 min-w-0 overflow-hidden flex items-center gap-1.5">
          <HighlightText
            text={primaryContact.name}
            searchTerm={searchTerm}
            className="text-[13px] text-[#374151] truncate"
          />
          {primaryContact.isPrimary && (
            <span 
              className="inline-flex items-center h-[18px] px-1.5 bg-[#DBEAFE] text-[#1E40AF] text-[10px] font-medium rounded whitespace-nowrap flex-shrink-0"
              style={{ borderRadius: '4px', fontWeight: 500 }}
            >
              Primary
            </span>
          )}
          
          {/* Additional Contacts Link */}
          {additionalContacts.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowPopover(!showPopover);
              }}
              className="text-[11px] text-[#1B6EF3] hover:text-[#0D5ED7] hover:underline flex-shrink-0"
            >
              +{additionalContacts.length}
            </button>
          )}
        </div>
      </div>

      {/* Popover for Additional Contacts */}
      {showPopover && additionalContacts.length > 0 && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setShowPopover(false)}
          />
          <div 
            className="absolute left-0 top-full mt-1 w-[280px] bg-white border border-[#E5E7EB] rounded shadow-lg z-20"
            style={{ borderRadius: '8px' }}
          >
            <div className="p-2">
              {/* Primary Contact */}
              <ContactRow 
                contact={primaryContact} 
                onClick={onClick}
                highlighted
              />
              
              {/* Divider */}
              <div className="my-1 border-t border-[#E5E7EB]" />

              {/* Additional Contacts */}
              {additionalContacts.map(contact => (
                <ContactRow 
                  key={contact.id}
                  contact={contact} 
                  onClick={onClick}
                  searchTerm={searchTerm}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

interface ContactAvatarProps {
  contact: Contact;
  size: number;
}

function ContactAvatar({ contact, size }: ContactAvatarProps) {
  const initials = contact.name
    .split(' ')
    .map(n => n.charAt(0))
    .join('')
    .substring(0, 2)
    .toUpperCase();

  // Diverse color themes based on first letter
  const getColorTheme = (name: string) => {
    const firstChar = name.charAt(0).toUpperCase();
    const themes = [
      { bg: '#DBEAFE', text: '#1E40AF' }, // Blue
      { bg: '#FEE2E2', text: '#991B1B' }, // Red
      { bg: '#FEF3C7', text: '#92400E' }, // Yellow
      { bg: '#D1FAE5', text: '#065F46' }, // Green
      { bg: '#E9D5FF', text: 'hsl(var(--primary))' }, // Purple
      { bg: '#FECACA', text: '#991B1B' }, // Light Red
      { bg: '#BAE6FD', text: '#075985' }, // Sky Blue
      { bg: '#FED7AA', text: '#9A3412' }, // Orange
    ];
    
    const index = firstChar.charCodeAt(0) % themes.length;
    return themes[index];
  };

  if (contact.avatarUrl) {
    return (
      <img 
        src={contact.avatarUrl} 
        alt={contact.name}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }

  const theme = getColorTheme(contact.name);
  const fontSize = size === 28 ? 12 : size === 24 ? 11 : 10;

  return (
    <div 
      className="rounded-full flex items-center justify-center flex-shrink-0"
      style={{ 
        width: size, 
        height: size,
        backgroundColor: theme.bg
      }}
    >
      <span 
        className="font-semibold" 
        style={{ 
          fontSize: `${fontSize}px`,
          color: theme.text,
          fontWeight: 600
        }}
      >
        {initials}
      </span>
    </div>
  );
}

interface ContactRowProps {
  contact: Contact;
  onClick?: (contactId: string) => void;
  highlighted?: boolean;
  searchTerm?: string;
}

function ContactRow({ contact, onClick, highlighted, searchTerm = '' }: ContactRowProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(contact.id);
      }}
      className={`w-full flex items-center gap-2 p-2 rounded transition-colors ${
        highlighted 
          ? 'bg-[#F0F9FF]' 
          : 'hover:bg-[#F9FAFB]'
      }`}
      style={{ borderRadius: '6px' }}
    >
      <ContactAvatar contact={contact} size={24} />
      
      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-1">
          <HighlightText
            text={contact.name}
            searchTerm={searchTerm}
            className="text-[12px] text-[#374151] font-medium truncate"
          />
          {contact.isPrimary && (
            <span className="text-[10px] text-[#1E40AF]">(Primary)</span>
          )}
        </div>
        <div className="text-[11px] text-[#9CA3AF] truncate">
          <HighlightText text={contact.email} searchTerm={searchTerm} />
        </div>
        {contact.role && (
          <div className="text-[10px] text-[#9CA3AF] truncate">{contact.role}</div>
        )}
      </div>
    </button>
  );
}