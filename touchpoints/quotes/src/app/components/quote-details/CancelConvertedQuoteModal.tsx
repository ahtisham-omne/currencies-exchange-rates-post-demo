import ReactDOM from 'react-dom';
import { AlertTriangle, Package, ExternalLink, Ban, X, Link2, Archive } from 'lucide-react';

interface CancelConvertedQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  quoteNumber: string;
  salesOrderNumber: string;
  onNavigateToSO?: () => void;
  /** Whether this modal is for an archive action instead of cancel */
  actionType?: 'cancel' | 'archive';
}

export function CancelConvertedQuoteModal({
  isOpen,
  onClose,
  quoteNumber,
  salesOrderNumber,
  onNavigateToSO,
  actionType = 'cancel',
}: CancelConvertedQuoteModalProps) {
  if (!isOpen) return null;

  const isArchive = actionType === 'archive';
  const actionLabel = isArchive ? 'Archive' : 'Cancel';
  const ActionIcon = isArchive ? Archive : Ban;

  return ReactDOM.createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10001,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(2px)',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          width: '500px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            padding: '20px 24px 0 24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: '#FEE2E2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ActionIcon style={{ width: '18px', height: '18px', color: '#DC2626' }} />
            </div>
            <div>
              <h3
                style={{
                  fontSize: '15px',
                  fontWeight: 600,
                  color: '#1F2937',
                  margin: 0,
                  lineHeight: '1.3',
                }}
              >
                Cannot {actionLabel} Quote
              </h3>
              <span style={{ fontSize: '12px', color: '#6B7280' }}>{quoteNumber}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              color: '#9CA3AF',
              transition: 'all 120ms',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#F3F4F6';
              e.currentTarget.style.color = '#374151';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#9CA3AF';
            }}
          >
            <X style={{ width: '16px', height: '16px' }} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 24px' }}>
          {/* Warning callout */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              padding: '12px 14px',
              borderRadius: '8px',
              backgroundColor: '#FEF2F2',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: '#FECACA',
              marginBottom: '16px',
            }}
          >
            <AlertTriangle
              style={{
                width: '16px',
                height: '16px',
                color: '#DC2626',
                flexShrink: 0,
                marginTop: '1px',
              }}
            />
            <div style={{ fontSize: '13px', color: '#991B1B', lineHeight: '1.5' }}>
              This quote is associated with an active Sales Order and cannot be
              {isArchive ? ' archived' : ' cancelled'} directly. You must cancel the Sales Order first.
            </div>
          </div>

          {/* SO association card */}
          <div
            style={{
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: '#E5E7EB',
              borderRadius: '8px',
              overflow: 'hidden',
            }}
          >
            {/* Card header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                backgroundColor: '#F9FAFB',
                borderBottom: '1px solid #E5E7EB',
              }}
            >
              <Link2 style={{ width: '12px', height: '12px', color: '#9CA3AF' }} />
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#6B7280',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Linked Sales Order
              </span>
            </div>

            {/* Card body */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '6px',
                    backgroundColor: '#D1FAE5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Package
                    style={{ width: '15px', height: '15px', color: '#059669' }}
                  />
                </div>
                <div>
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#1F2937',
                      lineHeight: '1',
                      marginBottom: '5px',
                    }}
                  >
                    {salesOrderNumber}
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: '#6B7280',
                      lineHeight: '1',
                    }}
                  >
                    Active · Created from {quoteNumber}
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  onNavigateToSO?.();
                  onClose();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  height: '28px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: '#E5E7EB',
                  backgroundColor: '#FFFFFF',
                  color: '#374151',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  lineHeight: '1',
                  transition: 'all 120ms',
                  whiteSpace: 'nowrap',
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
                <ExternalLink style={{ width: '12px', height: '12px' }} />
                View Sales Order
              </button>
            </div>
          </div>

          {/* Steps explanation */}
          <div style={{ marginTop: '16px' }}>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: '#6B7280',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '14px',
              }}
            >
              To {actionLabel.toLowerCase()} this quote
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {[
                {
                  step: 1,
                  text: `Navigate to Sales Order ${salesOrderNumber}`,
                  sub: 'Open the linked sales order',
                },
                {
                  step: 2,
                  text: 'Cancel the Sales Order',
                  sub: 'This will disassociate it from this quote',
                },
                {
                  step: 3,
                  text: `Return here and ${actionLabel.toLowerCase()} the quote`,
                  sub: `The ${actionLabel.toLowerCase()} option will become available`,
                },
              ].map((item) => (
                <div
                  key={item.step}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                  }}
                >
                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      backgroundColor: '#F3F4F6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '10px',
                      fontWeight: 700,
                      color: '#6B7280',
                      flexShrink: 0,
                    }}
                  >
                    {item.step}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '12px',
                        fontWeight: 500,
                        color: '#1F2937',
                        lineHeight: '1.2',
                        marginBottom: '4px',
                      }}
                    >
                      {item.text}
                    </div>
                    <div
                      style={{
                        fontSize: '11px',
                        color: '#9CA3AF',
                        lineHeight: '1.2',
                      }}
                    >
                      {item.sub}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 24px',
            borderTop: '1px solid #E5E7EB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: '11px', color: '#9CA3AF' }}>
            Sales Order integration coming soon
          </span>
          <button
            onClick={onClose}
            style={{
              height: '32px',
              padding: '0 16px',
              borderRadius: '6px',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: '#E5E7EB',
              backgroundColor: '#FFFFFF',
              color: '#374151',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'Inter, system-ui, sans-serif',
              transition: 'all 120ms',
              lineHeight: '1',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#F9FAFB';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#FFFFFF';
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}