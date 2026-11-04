import { X, Search, MapPin, Building2, Plus, Users, Star, Check } from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';

interface Location {
  id: string;
  name: string;
  address: string;
  isDefault: boolean;
  pocCount?: number;
  primaryContact?: string;
}

interface LocationSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (location: Location) => void;
  currentLocationId: string;
  customerName: string;
  locations?: Location[];
}

// Mock customer locations - simulate 20+ locations
const MOCK_LOCATIONS: Location[] = [
  {
    id: 'loc1',
    name: 'Torrance, CA (Headquarters)',
    address: '2972 Westheimer Rd. Santa Ana, Illinois 85486',
    isDefault: true,
    pocCount: 4,
    primaryContact: 'Sarah Chen',
  },
  {
    id: 'loc2',
    name: 'Chicago, IL (Manufacturing Plant)',
    address: '4521 Industrial Way, Chicago, IL 60601',
    isDefault: false,
    pocCount: 2,
    primaryContact: 'James Liu',
  },
  {
    id: 'loc3',
    name: 'Austin, TX (Distribution Center)',
    address: '789 Warehouse Blvd, Austin, TX 78701',
    isDefault: false,
    pocCount: 3,
    primaryContact: 'Carlos Mendez',
  },
  {
    id: 'loc4',
    name: 'Seattle, WA (Regional Office)',
    address: '123 Tech Drive, Seattle, WA 98101',
    isDefault: false,
    pocCount: 1,
    primaryContact: 'Emily Park',
  },
  {
    id: 'loc5',
    name: 'Boston, MA (R&D Center)',
    address: '456 Innovation Way, Boston, MA 02101',
    isDefault: false,
    pocCount: 5,
    primaryContact: 'David Kim',
  },
  {
    id: 'loc6',
    name: 'Dallas, TX (Logistics Hub)',
    address: '789 Commerce Blvd, Dallas, TX 75201',
    isDefault: false,
    pocCount: 2,
    primaryContact: 'Mike Torres',
  },
  {
    id: 'loc7',
    name: 'Miami, FL (Sales Office)',
    address: '321 Ocean Drive, Miami, FL 33101',
    isDefault: false,
    pocCount: 1,
    primaryContact: 'Anna Reyes',
  },
  {
    id: 'loc8',
    name: 'Denver, CO (Operations Center)',
    address: '654 Mountain View, Denver, CO 80201',
    isDefault: false,
    pocCount: 3,
    primaryContact: 'Raj Patel',
  },
  {
    id: 'loc9',
    name: 'Atlanta, GA (Service Center)',
    address: '987 Peachtree St, Atlanta, GA 30301',
    isDefault: false,
    pocCount: 2,
    primaryContact: 'Lisa Wang',
  },
  {
    id: 'loc10',
    name: 'Phoenix, AZ (Warehouse)',
    address: '234 Desert Road, Phoenix, AZ 85001',
    isDefault: false,
    pocCount: 1,
    primaryContact: 'Tom Harris',
  },
  {
    id: 'loc11',
    name: 'Portland, OR (Tech Hub)',
    address: '567 Pioneer Square, Portland, OR 97201',
    isDefault: false,
    pocCount: 4,
    primaryContact: 'Sophie Lin',
  },
  {
    id: 'loc12',
    name: 'Minneapolis, MN (Regional Office)',
    address: '890 Lake Street, Minneapolis, MN 55401',
    isDefault: false,
    pocCount: 2,
    primaryContact: 'Mark Johnson',
  },
];

export function LocationSelectionModal({
  isOpen,
  onClose,
  onSelect,
  currentLocationId,
  customerName,
  locations,
}: LocationSelectionModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState(currentLocationId);

  if (!isOpen) return null;

  const filteredLocations = (locations || MOCK_LOCATIONS).filter(
    (location) =>
      location.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      location.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = () => {
    const location = (locations || MOCK_LOCATIONS).find((loc) => loc.id === selectedLocationId);
    if (location) {
      onSelect(location);
      onClose();
    }
  };

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0"
        style={{ zIndex: 10001, backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(1px)' }}
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 10001 }}>
        <div
          className="w-full max-w-3xl bg-white rounded-lg shadow-xl border border-[#E5E7EB] pointer-events-auto"
          style={{
            maxHeight: 'calc(100vh - 120px)',
            margin: '0 24px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
            display: 'flex',
            flexDirection: 'column',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header - Compact like parent modal */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#E5E7EB] flex-shrink-0">
            <div>
              <h2 className="text-[13px] text-[#1F2937]" style={{ fontWeight: 600 }}>
                Select Customer Location
              </h2>
              <p className="text-[11px] text-[#6B7280] mt-0.5">
                {customerName}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#F3F4F6] transition-colors"
            >
              <X className="w-4 h-4 text-[#6B7280]" />
            </button>
          </div>

          {/* Search Bar */}
          <div className="px-4 py-3 border-b border-[#E5E7EB] flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
              <input
                type="text"
                placeholder="Search by location name or address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-3 py-2 text-[13px] text-[#1F2937] border border-[#E5E7EB] rounded focus:outline-none focus:ring-2 focus:ring-[#93C5FD] focus:border-transparent placeholder:text-[#D1D5DB]"
                autoFocus
              />
            </div>
          </div>

          {/* Locations List */}
          <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
            {filteredLocations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <MapPin className="w-12 h-12 text-[#E5E7EB] mb-3" />
                <p className="text-[13px] text-[#6B7280] text-center">
                  No locations found matching "{searchQuery}"
                </p>
                {/* Smart suggestive Add New */}
                {searchQuery.trim() && (
                  <button
                    className="mt-4 flex items-center gap-2 px-4 py-2 rounded-md border-2 border-dashed border-[#BFDBFE] bg-[#FAFCFF] hover:bg-[#F0F7FF] transition-colors cursor-pointer"
                    onClick={() => alert('Add New Location form — coming soon')}
                  >
                    <Plus className="w-4 h-4 text-[#1B6EF3]" />
                    <span className="text-[13px] text-[#1B6EF3]" style={{ fontWeight: 500 }}>
                      Add &ldquo;{searchQuery.trim()}&rdquo; as New Location
                    </span>
                  </button>
                )}
              </div>
            ) : (
              <div className="p-3">
                {filteredLocations.map((location) => (
                  <div
                    key={location.id}
                    onClick={() => setSelectedLocationId(location.id)}
                    className={`px-3 py-3 rounded-md cursor-pointer transition-colors mb-1 ${
                      selectedLocationId === location.id
                        ? 'bg-[#F0F7FF] border border-[#BFDBFE]'
                        : 'border border-transparent hover:bg-[#F9FAFB] hover:border-[#E5E7EB]'
                    }`}
                    style={{ transition: 'all 150ms ease' }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-[#F9FAFB] rounded flex items-center justify-center flex-shrink-0">
                        <MapPin className="w-4 h-4 text-[#6B7280]" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[13px] text-[#1F2937] truncate" style={{ fontWeight: 600 }}>
                            {location.name}
                          </span>
                          {location.isDefault && (
                            <span className="inline-flex items-center h-4 px-1.5 text-[10px] bg-[#DBEAFE] text-[#1E40AF] rounded flex-shrink-0" style={{ fontWeight: 500 }}>
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-[12px] text-[#6B7280] truncate">
                          {location.address}
                        </p>
                        {/* Contact info */}
                        {(location.pocCount != null && location.pocCount > 0) && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <Users className="w-3 h-3 text-[#9CA3AF] flex-shrink-0" />
                            <span className="text-[11px] text-[#9CA3AF]" style={{ fontWeight: 500 }}>
                              {location.pocCount} {location.pocCount === 1 ? 'contact' : 'contacts'}
                            </span>
                            {location.primaryContact && (
                              <>
                                <span className="text-[11px] text-[#D1D5DB]">·</span>
                                <span className="text-[11px] text-[#6B7280] truncate">
                                  {location.primaryContact}
                                </span>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {selectedLocationId === location.id && (
                        <div className="w-4 h-4 rounded-full bg-[#1B6EF3] flex items-center justify-center flex-shrink-0 mt-0.5">
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Add New Location — always at bottom */}
                <div
                  className="px-3 py-3 rounded-md cursor-pointer transition-colors mb-1 border-2 border-dashed border-[#E5E7EB] hover:border-[#BFDBFE] hover:bg-[#FAFCFF] flex items-center gap-3"
                  onClick={() => alert('Add New Location form — coming soon')}
                >
                  <div className="w-8 h-8 bg-[#F0F7FF] rounded flex items-center justify-center flex-shrink-0">
                    <Plus className="w-4 h-4 text-[#1B6EF3]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] text-[#1B6EF3]" style={{ fontWeight: 500 }}>
                      {searchQuery.trim()
                        ? <>Add &ldquo;{searchQuery.trim()}&rdquo; as New Location</>
                        : 'Add New Location'
                      }
                    </span>
                    <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                      for {customerName}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer - Compact like parent modal */}
          <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-t border-[#E5E7EB] flex-shrink-0">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-[13px] text-[#6B7280] border border-[#E5E7EB] rounded hover:bg-[#F9FAFB] transition-colors"
              style={{ fontWeight: 500 }}
            >
              Cancel
            </button>
            <button
              onClick={handleSelect}
              className="px-3 py-1.5 text-[13px] text-white bg-[#1B6EF3] rounded hover:bg-[#0D5ED7] transition-colors"
              style={{ fontWeight: 500 }}
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </>
  , document.body);
}