import { useState } from 'react';
import { X, Search, User, CheckCircle2 } from 'lucide-react';

interface AssignSalesRepModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAssign: (salesRep: string) => void;
  selectedCount: number;
}

const SALES_REPS = [
  { id: '1', name: 'Sarah Chen', email: 'sarah.chen@company.com', team: 'Enterprise', avatar: 'SC' },
  { id: '2', name: 'Michael Rodriguez', email: 'michael.r@company.com', team: 'SMB', avatar: 'MR' },
  { id: '3', name: 'Emily Watson', email: 'emily.watson@company.com', team: 'Enterprise', avatar: 'EW' },
  { id: '4', name: 'David Park', email: 'david.park@company.com', team: 'Mid-Market', avatar: 'DP' },
  { id: '5', name: 'Lisa Anderson', email: 'lisa.a@company.com', team: 'Enterprise', avatar: 'LA' },
  { id: '6', name: 'James Wilson', email: 'james.wilson@company.com', team: 'SMB', avatar: 'JW' },
];

export function AssignSalesRepModal({ isOpen, onClose, onAssign, selectedCount }: AssignSalesRepModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRep, setSelectedRep] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredReps = SALES_REPS.filter(rep => 
    rep.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rep.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rep.team.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAssign = () => {
    if (selectedRep) {
      onAssign(selectedRep);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onClose}
    >
      <div 
        className="bg-white"
        style={{ 
          borderRadius: '12px',
          width: '540px',
          maxHeight: '80vh',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div 
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: '#E5E7EB' }}
        >
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#111827' }}>
              Assign Sales Rep
            </h2>
            <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '2px' }}>
              Assign {selectedCount} quote{selectedCount === 1 ? '' : 's'} to a sales representative
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center transition-colors"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              backgroundColor: 'transparent',
              color: '#6B7280',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #E5E7EB' }}>
          <div className="relative">
            <Search 
              className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" 
              style={{ color: '#9CA3AF' }}
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search sales reps..."
              className="w-full pl-10 pr-3"
              style={{
                height: '36px',
                fontSize: '13px',
                border: '1px solid #E5E7EB',
                borderRadius: '6px',
                outline: 'none',
                color: '#111827',
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = '#3B82F6'}
              onBlur={(e) => e.currentTarget.style.borderColor = '#E5E7EB'}
            />
          </div>
        </div>

        {/* Sales Reps List */}
        <div 
          style={{ 
            maxHeight: '400px', 
            overflowY: 'auto',
            padding: '8px',
          }}
        >
          {filteredReps.map((rep) => {
            const isSelected = selectedRep === rep.name;
            return (
              <button
                key={rep.id}
                onClick={() => setSelectedRep(rep.name)}
                className="w-full flex items-center gap-3 p-3 rounded transition-all"
                style={{
                  backgroundColor: isSelected ? '#F3F7FF' : 'transparent',
                  border: isSelected ? '1px solid #3B82F6' : '1px solid transparent',
                  marginBottom: '4px',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = '#F9FAFB';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                {/* Avatar */}
                <div 
                  className="flex items-center justify-center flex-shrink-0"
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    backgroundColor: isSelected ? '#3B82F6' : '#E0E7FF',
                    color: isSelected ? '#FFFFFF' : '#3730A3',
                    fontSize: '14px',
                    fontWeight: 600,
                  }}
                >
                  {rep.avatar}
                </div>

                {/* Info */}
                <div className="flex-1 text-left">
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                    {rep.name}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6B7280' }}>
                    {rep.email} · {rep.team}
                  </div>
                </div>

                {/* Checkmark */}
                {isSelected && (
                  <CheckCircle2 className="w-5 h-5" style={{ color: '#3B82F6' }} />
                )}
              </button>
            );
          })}

          {filteredReps.length === 0 && (
            <div className="text-center py-8">
              <User className="w-12 h-12 mx-auto mb-3" style={{ color: '#D1D5DB' }} />
              <p style={{ fontSize: '14px', color: '#6B7280' }}>
                No sales reps found
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div 
          className="flex items-center justify-end gap-3 px-6 py-4 border-t"
          style={{ borderColor: '#E5E7EB' }}
        >
          <button
            onClick={onClose}
            className="px-4 transition-colors"
            style={{
              height: '36px',
              fontSize: '13px',
              fontWeight: 500,
              color: '#6B7280',
              border: '1px solid #E5E7EB',
              borderRadius: '6px',
              backgroundColor: '#FFFFFF',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#F9FAFB';
              e.currentTarget.style.borderColor = '#D1D5DB';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#FFFFFF';
              e.currentTarget.style.borderColor = '#E5E7EB';
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={!selectedRep}
            className="px-4 transition-colors"
            style={{
              height: '36px',
              fontSize: '13px',
              fontWeight: 500,
              color: '#FFFFFF',
              borderRadius: '6px',
              backgroundColor: selectedRep ? '#3B82F6' : '#D1D5DB',
              border: 'none',
              cursor: selectedRep ? 'pointer' : 'not-allowed',
            }}
            onMouseEnter={(e) => {
              if (selectedRep) {
                e.currentTarget.style.backgroundColor = '#2563EB';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedRep) {
                e.currentTarget.style.backgroundColor = '#3B82F6';
              }
            }}
          >
            Assign to {selectedCount} quote{selectedCount === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </div>
  );
}
