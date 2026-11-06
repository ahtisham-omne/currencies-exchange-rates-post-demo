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
        backgroundColor: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(2px)',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--background)',
          borderRadius: '12px',
          width: '500px',
          boxShadow: '0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)',
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
                backgroundColor: 'rgba(220, 38, 38, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ActionIcon style={{ width: '18px', height: '18px', color: 'var(--destructive)' }} />
            </div>
            <div>
              <h3
                style={{
                  fontSize: '15px',
                  fontWeight: 600,
                  color: 'var(--foreground)',
                  margin: 0,
                  lineHeight: '1.3',
                }}
              >
                Cannot {actionLabel} Quote
              </h3>
              <span style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>{quoteNumber}</span>
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
              color: 'var(--muted-foreground)',
              transition: 'all 120ms',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--muted)';
              e.currentTarget.style.color = 'var(--foreground)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--muted-foreground)';
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
              backgroundColor: 'rgba(220, 38, 38, 0.1)',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: 'rgba(220, 38, 38, 0.3)',
              marginBottom: '16px',
            }}
          >
            <AlertTriangle
              style={{
                width: '16px',
                height: '16px',
                color: 'var(--destructive)',
                flexShrink: 0,
                marginTop: '1px',
              }}
            />
            <div style={{ fontSize: '13px', color: 'var(--destructive)', lineHeight: '1.5' }}>
              This quote is associated with an active Sales Order and cannot be
              {isArchive ? ' archived' : ' cancelled'} directly. You must cancel the Sales Order first.
            </div>
          </div>

          {/* SO association card */}
          <div
            style={{
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: 'var(--border)',
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
                backgroundColor: 'var(--muted)',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <Link2 style={{ width: '12px', height: '12px', color: 'var(--muted-foreground)' }} />
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--muted-foreground)',
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
                    backgroundColor: 'rgba(5, 150, 105, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Package
                    style={{ width: '15px', height: '15px', color: 'var(--success)' }}
                  />
                </div>
                <div>
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 500, color: 'var(--foreground-soft)',
                      lineHeight: '1',
                      marginBottom: '5px',
                    }}
                  >
                    {salesOrderNumber}
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--muted-foreground)',
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
                  borderColor: 'var(--border)',
                  backgroundColor: 'var(--background)',
                  color: 'var(--foreground)',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  lineHeight: '1',
                  transition: 'all 120ms',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--muted)';
                  e.currentTarget.style.borderColor = 'var(--border)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--background)';
                  e.currentTarget.style.borderColor = 'var(--border)';
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
                color: 'var(--muted-foreground)',
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
                      backgroundColor: 'var(--muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '10px',
                      fontWeight: 700,
                      color: 'var(--muted-foreground)',
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
                        color: 'var(--foreground)',
                        lineHeight: '1.2',
                        marginBottom: '4px',
                      }}
                    >
                      {item.text}
                    </div>
                    <div
                      style={{
                        fontSize: '11px',
                        color: 'var(--muted-foreground)',
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
            borderTop: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: '11px', color: 'var(--muted-foreground)' }}>
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
              borderColor: 'var(--border)',
              backgroundColor: 'var(--background)',
              color: 'var(--foreground)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'Inter, system-ui, sans-serif',
              transition: 'all 120ms',
              lineHeight: '1',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--muted)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--background)';
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