import { X, Search, MapPin, Plus, Users, Check, Package, Clock, MoreHorizontal, Globe } from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';

interface Location {
  id: string;
  name: string;
  address: string;
  isDefault: boolean;
  pocCount?: number;
  primaryContact?: string;
  city?: string;
  state?: string;
  country?: string;
  status?: 'active' | 'inactive';
  contacts?: number;
  items?: number;
  image?: string;
  createdBy?: { name: string; initials: string; bgColor: string; fgColor: string };
  lastUpdated?: string;
}

interface LocationSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (location: Location) => void;
  currentLocationId: string;
  customerName: string;
  locations?: Location[];
}

const LOCATION_IMAGES = [
  'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400&h=200&fit=crop',
  'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&h=200&fit=crop',
  'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&h=200&fit=crop',
  'https://images.unsplash.com/photo-1565008447742-97f6f38c985c?w=400&h=200&fit=crop',
  'https://images.unsplash.com/photo-1587293852726-70cdb56c2866?w=400&h=200&fit=crop',
  'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=400&h=200&fit=crop',
  'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=400&h=200&fit=crop',
];

const MOCK_LOCATIONS: Location[] = [
  { id: 'loc1', name: 'Huntsville, AL (Headquarters)', address: '1000 Business Park Dr', city: 'Huntsville', state: 'Alabama', country: 'United States', isDefault: true, status: 'active', contacts: 21, items: 211, pocCount: 4, primaryContact: 'Jane Ellison', image: LOCATION_IMAGES[0], createdBy: { name: 'Lisa Anderson', initials: 'LA', bgColor: '#DCFCE7', fgColor: '#166534' }, lastUpdated: 'Mar 06, 2026' },
  { id: 'loc2', name: 'Charlotte, NC (Station 12)', address: '1000 Business Park Dr', city: 'Charlotte', state: 'North Carolina', country: 'United States', isDefault: false, status: 'active', contacts: 13, items: 250, pocCount: 2, primaryContact: 'Robert Johnson', image: LOCATION_IMAGES[1], createdBy: { name: 'Maria Garcia', initials: 'MG', bgColor: '#E0E7FF', fgColor: '#3730A3' }, lastUpdated: 'Dec 21, 2025' },
  { id: 'loc3', name: 'Daxton, GA (Regional Office)', address: '1000 Business Park Dr', city: 'Daxton', state: 'Georgia', country: 'United States', isDefault: false, status: 'active', contacts: 18, items: 261, pocCount: 3, primaryContact: 'Braelyn Miller', image: LOCATION_IMAGES[2], createdBy: { name: 'Maria Garcia', initials: 'MG', bgColor: '#E0E7FF', fgColor: '#3730A3' }, lastUpdated: 'Dec 14, 2025' },
  { id: 'loc4', name: 'Georgetown, KY (Distribution Center)', address: '1000 Business Park Dr', city: 'Georgetown', state: 'Kentucky', country: 'United States', isDefault: false, status: 'active', contacts: 24, items: 216, pocCount: 1, primaryContact: 'Mary Miller', image: LOCATION_IMAGES[3], createdBy: { name: 'Maria Garcia', initials: 'MG', bgColor: '#E0E7FF', fgColor: '#3730A3' }, lastUpdated: 'Apr 22, 2025' },
  { id: 'loc5', name: 'San Antonio, TX (Fleet Yard)', address: '1000 Business Park Dr', city: 'San Antonio', state: 'Texas', country: 'United States', isDefault: false, status: 'active', contacts: 16, items: 255, pocCount: 5, primaryContact: 'Marcus Webb', image: LOCATION_IMAGES[4], createdBy: { name: 'Lisa Anderson', initials: 'LA', bgColor: '#DCFCE7', fgColor: '#166534' }, lastUpdated: 'Feb 06, 2026' },
  { id: 'loc6', name: 'Santa Ana, IN (Maintenance Facility)', address: '1000 Business Park Dr', city: 'Santa Ana', state: 'Indiana', country: 'United States', isDefault: false, status: 'inactive', contacts: 4, items: 284, pocCount: 2, primaryContact: 'Sandra Lee', image: LOCATION_IMAGES[5], createdBy: { name: 'Ahtisham Ahmad', initials: 'AA', bgColor: '#FEF3C7', fgColor: '#92400E' }, lastUpdated: 'Jan 06, 2026' },
  { id: 'loc7', name: 'Denver, CO (Training Center)', address: '1000 Business Park Dr', city: 'Denver', state: 'Colorado', country: 'United States', isDefault: false, status: 'active', contacts: 18, items: 316, pocCount: 1, primaryContact: 'Lisa Chen', image: LOCATION_IMAGES[6], createdBy: { name: 'Maria Garcia', initials: 'MG', bgColor: '#E0E7FF', fgColor: '#3730A3' }, lastUpdated: 'Nov 09, 2025' },
];

export function LocationSelectionModal({
  isOpen, onClose, onSelect, currentLocationId, customerName, locations,
}: LocationSelectionModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState(currentLocationId);

  if (!isOpen) return null;

  const allLocations = locations || MOCK_LOCATIONS;
  const filteredLocations = allLocations.filter(
    (location) =>
      location.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      location.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (location.city || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = () => {
    const location = allLocations.find((loc) => loc.id === selectedLocationId);
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
          className="w-full pointer-events-auto"
          style={{
            maxWidth: 960,
            maxHeight: 'calc(100vh - 80px)',
            margin: '0 24px',
            backgroundColor: 'var(--card)',
            borderRadius: 12,
            border: '1px solid var(--border)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
            display: 'flex',
            flexDirection: 'column',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
            <div>
              <h2 className="text-[14px] text-[#1F2937]" style={{ fontWeight: 600 }}>
                Change Location
              </h2>
              <p className="text-[11px] text-[#6B7280] mt-0.5">Select a location for {customerName}</p>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[#F3F4F6] transition-colors"
            >
              <X className="w-4 h-4 text-[#6B7280]" />
            </button>
          </div>

          {/* Search Bar + Count */}
          <div className="px-5 py-3 flex items-center gap-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
              <input
                type="text"
                placeholder="Search by location name, city, or address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-3 py-2 text-[13px] text-[#1F2937] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#93C5FD] focus:border-transparent placeholder:text-[#D1D5DB]"
                style={{ border: '1px solid var(--border)', background: 'var(--input-background)' }}
                autoFocus
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-[#F3F4F6]">
                  <X className="w-3 h-3 text-[#9CA3AF]" />
                </button>
              )}
            </div>
            <span className="text-[12px] text-[#6B7280] shrink-0" style={{ fontWeight: 500 }}>
              {filteredLocations.length} location{filteredLocations.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Location Cards Grid */}
          <div className="flex-1 overflow-y-auto p-4" style={{ minHeight: 0 }}>
            {filteredLocations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <MapPin className="w-12 h-12 text-[#E5E7EB] mb-3" />
                <p className="text-[13px] text-[#6B7280] text-center">
                  No locations found matching &ldquo;{searchQuery}&rdquo;
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredLocations.map((location) => {
                  const isSelected = selectedLocationId === location.id;
                  const isActive = location.status !== 'inactive';
                  return (
                    <div
                      key={location.id}
                      onClick={() => setSelectedLocationId(location.id)}
                      className={`border rounded-xl cursor-pointer transition-all duration-200 group/card flex flex-col overflow-hidden ${
                        isSelected
                          ? 'border-[#0A77FF] shadow-[0_0_0_2px_rgba(10,119,255,0.15),0_4px_16px_-4px_rgba(10,119,255,0.10)]'
                          : 'border-[#E2E8F0] hover:shadow-[0_4px_16px_-4px_rgba(10,119,255,0.10)] hover:border-[#93B8F7]/50'
                      }`}
                      style={{ backgroundColor: 'var(--card)' }}
                    >
                      {/* Location Image */}
                      <div className="relative w-full h-[130px] overflow-hidden bg-[#F1F5F9]">
                        {location.image ? (
                          <img
                            src={location.image}
                            alt={location.name}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover/card:scale-105"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#F1F5F9] to-[#E2E8F0]">
                            <MapPin className="w-8 h-8 text-[#94A3B8]" />
                          </div>
                        )}
                        {/* Bottom-left: Status + Country pills on image */}
                        <div className="absolute bottom-2 left-2 flex items-center gap-1.5 z-10">
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] shadow-sm backdrop-blur-sm border"
                            style={{
                              fontWeight: 600,
                              backgroundColor: isActive ? 'rgba(236,253,245,0.92)' : 'rgba(254,242,242,0.92)',
                              color: isActive ? '#065F46' : '#991B1B',
                              borderColor: isActive ? '#A7F3D0' : '#FECACA',
                            }}
                          >
                            <span className="w-[5px] h-[5px] rounded-full" style={{ backgroundColor: isActive ? '#059669' : '#DC2626' }} />
                            {isActive ? 'Active' : 'Inactive'}
                          </span>
                          {location.country && (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] shadow-sm backdrop-blur-sm border"
                              style={{ fontWeight: 500, backgroundColor: 'rgba(241,245,249,0.92)', color: '#334155', borderColor: '#CBD5E1' }}
                            >
                              <Globe className="w-3 h-3" />
                              {location.country}
                            </span>
                          )}
                        </div>
                        {/* Selected check */}
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#0A77FF] flex items-center justify-center shadow-sm z-10">
                            <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                          </div>
                        )}
                      </div>

                      {/* Card Body */}
                      <div className="flex flex-col flex-1">
                        <div className="px-3.5 pt-2 pb-0">
                          <p className="text-[13px] text-[#0F172A] truncate" style={{ fontWeight: 600, lineHeight: '18px' }}>{location.name}</p>
                          <p className="text-[11px] text-[#64748B] truncate mt-0.5" style={{ lineHeight: '16px' }}>
                            {location.address}{location.city ? `, ${location.city}` : ''}{location.state ? `, ${location.state}` : ''}
                          </p>
                        </div>

                        {/* Stats */}
                        <div className="px-3.5 pt-2.5 pb-2.5 flex-1 flex items-end">
                          <div className="flex items-center gap-3 text-[11px]">
                            <div className="flex items-center gap-1">
                              <Users className="w-3 h-3 text-[#94A3B8]" />
                              <span className="text-[#334155] tabular-nums" style={{ fontWeight: 600 }}>{location.contacts ?? location.pocCount ?? 0}</span>
                            </div>
                            <div className="w-px h-3 bg-[#E2E8F0]" />
                            <div className="flex items-center gap-1">
                              <Package className="w-3 h-3 text-[#94A3B8]" />
                              <span className="text-[#334155] tabular-nums" style={{ fontWeight: 600 }}>{location.items ?? 0}</span>
                            </div>
                            {location.isDefault && (
                              <>
                                <div className="w-px h-3 bg-[#E2E8F0]" />
                                <span className="text-[10px] px-1.5 py-px rounded bg-[#DBEAFE] text-[#1E40AF]" style={{ fontWeight: 500 }}>Default</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Footer */}
                        <div className="px-3.5 py-2 border-t border-[#F1F5F9] flex items-center justify-between text-[10px] text-[#94A3B8]">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {location.createdBy && (
                              <>
                                <div
                                  className="w-5 h-5 rounded-md flex items-center justify-center text-[8px] shrink-0 border border-[#E8ECF1]"
                                  style={{ backgroundColor: location.createdBy.bgColor, fontWeight: 600 }}
                                >
                                  <span style={{ color: location.createdBy.fgColor }}>{location.createdBy.initials}</span>
                                </div>
                                <span className="text-[#475569] truncate" style={{ fontWeight: 500 }}>{location.createdBy.name}</span>
                              </>
                            )}
                          </div>
                          {location.lastUpdated && (
                            <div className="flex items-center gap-1 shrink-0 ml-2">
                              <Clock className="w-3 h-3 text-[#CBD5E1]" />
                              <span className="text-[#64748B]" style={{ fontWeight: 500 }}>{location.lastUpdated}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Add New Location Card */}
                <div
                  className="border-2 border-dashed border-[#E5E7EB] hover:border-[#BFDBFE] hover:bg-[#FAFCFF] rounded-xl cursor-pointer transition-all duration-200 flex flex-col items-center justify-center"
                  style={{ minHeight: 200 }}
                  onClick={() => alert('Add New Location form — coming soon')}
                >
                  <div className="w-10 h-10 bg-[#F0F7FF] rounded-lg flex items-center justify-center mb-3">
                    <Plus className="w-5 h-5 text-[#1B6EF3]" />
                  </div>
                  <span className="text-[13px] text-[#1B6EF3]" style={{ fontWeight: 500 }}>Add New Location</span>
                  <p className="text-[11px] text-[#9CA3AF] mt-1">for {customerName}</p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 px-5 py-3 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
            <span className="text-[12px] text-[#6B7280]">
              {selectedLocationId && allLocations.find(l => l.id === selectedLocationId)
                ? `Selected: ${allLocations.find(l => l.id === selectedLocationId)!.name}`
                : 'No location selected'}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-3.5 py-1.5 text-[13px] text-[#6B7280] rounded-lg hover:bg-[#F9FAFB] transition-colors"
                style={{ fontWeight: 500, border: '1px solid var(--border)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSelect}
                className="px-3.5 py-1.5 text-[13px] text-white bg-[#1B6EF3] rounded-lg hover:bg-[#0D5ED7] transition-colors"
                style={{ fontWeight: 500 }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

export type { Location };
