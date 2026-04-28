// @ts-nocheck
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { CreateQuoteModal } from '../components/CreateQuoteModal';

interface EditQuoteProps {
  quoteId?: string;
}

export function EditQuote({ quoteId: propQuoteId }: EditQuoteProps) {
  const navigate = useNavigate();
  const quoteId = propQuoteId || 'unknown';
  const [showModal, setShowModal] = useState(true);

  const handleClose = () => {
    setShowModal(false);
    navigate(`/quotes/${quoteId}`);
  };

  const handleSave = () => {
    toast.success('Quote updated successfully');
    navigate(`/quotes/${quoteId}`);
  };

  return (
    <div className="flex-1 overflow-y-auto" style={{ backgroundColor: '#F9FAFB' }}>
      <div className="max-w-[1400px] mx-auto px-8 py-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={() => navigate('/')}
            className="text-[13px] hover:text-[#111827] transition-colors duration-150"
            style={{ color: '#6B7280', fontWeight: 500 }}
          >
            Quotes
          </button>
          <ChevronRight className="w-4 h-4" style={{ color: '#D1D5DB' }} />
          <button
            onClick={() => navigate(`/quotes/${quoteId}`)}
            className="text-[13px] hover:text-[#111827] transition-colors duration-150"
            style={{ color: '#6B7280', fontWeight: 500 }}
          >
            {quoteId}
          </button>
          <ChevronRight className="w-4 h-4" style={{ color: '#D1D5DB' }} />
          <span className="text-[13px]" style={{ color: '#111827', fontWeight: 600 }}>
            Edit
          </span>
        </div>

        {/* Use CreateQuoteModal in edit mode */}
        <CreateQuoteModal
          isOpen={showModal}
          onClose={handleClose}
          editMode={true}
          existingQuoteId={quoteId}
        />
      </div>
    </div>
  );
}