// @ts-nocheck
/**
 * ConfigSummaryStrips — Per-section summary strips for the configuration modal.
 * Lifted literally from Category project (edda1394-233a-42be-be90-58ae0a04db60)
 * src/app/components/ConfigureCategory.tsx — Slice M.3.
 *
 * Note: Category has NO GovernanceSummaryStrip. Mounting omitted for that tab.
 * Items' fields differ slightly (e.g. inboundLocation vs inboundLocations,
 * stockUom vs stockLimitUom, multiples vs orderMultiples). Adapted at read sites.
 */
import React from 'react';
import {
  ArrowDownRight, ArrowUpRight, Globe, Users, DollarSign, ScanLine, ShieldCheck,
  Package, ShoppingCart, Wrench, Check,
} from 'lucide-react';
import type { AdvancedConfig } from './ItemConfigurationMaster';

const FONT = 'Inter, system-ui, sans-serif';

/* ══════════════════════════════════════════════════════════════
   ItemDefinitionSummaryStrip — literal Category lift
   (ConfigureCategory.tsx lines 370-466). Items field name is
   `acquisitionMethod` (singular) instead of `acquisitionMethods`.
   ══════════════════════════════════════════════════════════════ */

export function BuyMakeToggle({ hasPurchased, hasManufactured, primaryAcquisition }: {
  hasPurchased: boolean;
  hasManufactured: boolean;
  primaryAcquisition?: string;
}) {
  const PURCHASE_COLOR = 'var(--primary)';
  const MANUFACTURE_COLOR = '#D97706';
  const bothSelected = hasPurchased && hasManufactured;
  return (
    <div className="flex items-center justify-center relative" style={{
      width: bothSelected ? 88 : 64, height: 64, borderRadius: 14,
      border: '1.5px dashed var(--border)',
      backgroundColor: 'var(--card)',
      overflow: 'hidden',
      transition: 'width 0.2s ease',
    }}>
      {hasPurchased && hasManufactured ? (
        <div className="flex items-center w-full h-full">
          <div className="flex-1 h-full flex items-center justify-center relative" style={{
            backgroundColor: primaryAcquisition === 'Purchased' ? 'hsl(var(--primary) / 0.06)' : 'transparent',
          }}>
            <ShoppingCart style={{ width: 20, height: 20, color: PURCHASE_COLOR }} />
            {primaryAcquisition === 'Purchased' && (
              <div className="absolute" style={{ top: 4, left: 4, width: 7, height: 7, borderRadius: '50%', backgroundColor: PURCHASE_COLOR }} />
            )}
          </div>
          <div style={{ width: 1, height: '60%', backgroundColor: 'var(--border)' }} />
          <div className="flex-1 h-full flex items-center justify-center relative" style={{
            backgroundColor: primaryAcquisition === 'Manufactured' ? 'rgba(217, 119, 6, 0.06)' : 'transparent',
          }}>
            <Wrench style={{ width: 20, height: 20, color: MANUFACTURE_COLOR }} />
            {primaryAcquisition === 'Manufactured' && (
              <div className="absolute" style={{ top: 4, right: 4, width: 7, height: 7, borderRadius: '50%', backgroundColor: MANUFACTURE_COLOR }} />
            )}
          </div>
        </div>
      ) : hasPurchased ? (
        <ShoppingCart style={{ width: 24, height: 24, color: PURCHASE_COLOR }} />
      ) : hasManufactured ? (
        <Wrench style={{ width: 24, height: 24, color: MANUFACTURE_COLOR }} />
      ) : (
        <Package style={{ width: 24, height: 24, color: 'var(--foreground)', opacity: 0.3 }} />
      )}
    </div>
  );
}

export function ItemDefinitionSummaryStrip({ config }: { config: AdvancedConfig }) {
  const inventoryLabel = (config.inventoryType || '').toUpperCase();
  const acquisitionMethods = config.acquisitionMethod || [];
  const hasPurchased = acquisitionMethods.includes('Purchased');
  const hasManufactured = acquisitionMethods.includes('Manufactured');

  return (
    <div className="flex items-center justify-center gap-6 px-8 py-7" style={{ backgroundColor: '#FDFDFD', borderBottom: '1px solid #E5E7EB' }}>
      {/* Inventory Type — UOM pill above tile */}
      <div className="flex flex-col items-center gap-2.5 relative">
        <div className="flex items-center justify-center relative" style={{
          width: 64, height: 64, borderRadius: 14,
          border: '1.5px dashed var(--border)',
          backgroundColor: 'var(--card)',
          color: 'var(--primary)',
        }}>
          <Package style={{ width: 24, height: 24 }} />
          <span className="absolute whitespace-nowrap px-2 py-0.5" style={{
            top: -8, right: -10,
            fontSize: 10, fontWeight: 600, fontFamily: FONT,
            color: 'white',
            backgroundColor: '#0A77FF',
            borderRadius: 6,
            lineHeight: 1.2,
          }}>
            {config.uom}
          </span>
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', fontFamily: FONT, color: 'var(--foreground)', opacity: 0.5 }}>{inventoryLabel}</span>
      </div>

      <span style={{ fontSize: 18, color: 'var(--foreground)', opacity: 0.15, fontWeight: 300 }}>→</span>

      {/* Acquisition Method – Buy/Make Toggle */}
      <div className="flex flex-col items-center gap-2.5 relative">
        <BuyMakeToggle
          hasPurchased={hasPurchased}
          hasManufactured={hasManufactured}
          primaryAcquisition={config.primaryAcquisition}
        />
        <div className="flex items-center gap-1.5">
          {hasPurchased && (
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', fontFamily: FONT, color: 'var(--primary)' }}>PURCHASE</span>
          )}
          {hasPurchased && hasManufactured && (
            <span style={{ fontSize: 10, color: 'var(--foreground)', opacity: 0.25 }}>/</span>
          )}
          {hasManufactured && (
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', fontFamily: FONT, color: '#D97706' }}>MANUFACTURE</span>
          )}
          {!hasPurchased && !hasManufactured && (
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', fontFamily: FONT, color: 'var(--foreground)', opacity: 0.35 }}>SOURCE</span>
          )}
        </div>
      </div>

      <span style={{ fontSize: 18, color: 'var(--foreground)', opacity: 0.15, fontWeight: 300 }}>→</span>

      {/* Control Type */}
      <div className="flex flex-col items-center gap-2.5 relative">
        <div className="flex items-center justify-center relative" style={{
          width: 64, height: 64, borderRadius: 14,
          border: '1.5px dashed var(--border)',
          backgroundColor: 'var(--card)',
        }}>
          <div className="relative flex items-center justify-center" style={{ width: 28, height: 28 }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect x="3" y="4" width="2.5" height="20" rx="1" fill={config.controlType === 'Serialized' ? '#0A77FF' : '#94A3B8'} />
              <rect x="8" y="4" width="1.5" height="20" rx="0.75" fill={config.controlType === 'Serialized' ? '#0A77FF' : '#94A3B8'} />
              <rect x="12" y="4" width="3" height="20" rx="1" fill={config.controlType === 'Serialized' ? '#0A77FF' : '#94A3B8'} />
              <rect x="17.5" y="4" width="1.5" height="20" rx="0.75" fill={config.controlType === 'Serialized' ? '#0A77FF' : '#94A3B8'} />
              <rect x="22" y="4" width="2.5" height="20" rx="1" fill={config.controlType === 'Serialized' ? '#0A77FF' : '#94A3B8'} />
              {config.controlType !== 'Serialized' && (
                <line x1="2" y1="26" x2="26" y2="2" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" />
              )}
            </svg>
          </div>
          {config.lotControlEnabled && (
            <div className="absolute" style={{ top: -3, right: -3, width: 10, height: 10, borderRadius: '50%', backgroundColor: '#22C55E', border: '2px solid var(--card)' }} />
          )}
        </div>
        <div className="flex flex-col items-center">
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', fontFamily: FONT, color: 'var(--foreground)', opacity: 0.5 }}>
            {config.controlType === 'Serialized' ? 'SERIALIZED' : 'NON-SERIALIZED'}
          </span>
          {config.lotControlEnabled && (
            <span className="flex items-center gap-1" style={{ fontSize: 9, fontWeight: 600, color: '#22C55E', fontFamily: FONT, marginTop: 2 }}>
              <Check style={{ width: 10, height: 10 }} /> LOT TRACKED
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function StockLogisticsSummaryStrip({ config }: { config: AdvancedConfig }) {
  const minVal = config.minStock || '—';
  const maxVal = config.maxStock || '—';
  const inCount = (config.inboundLocation || []).length;
  const outCount = (config.outboundLocation || []).length;

  return (
    <div className="flex items-center justify-center gap-12 px-8 py-8" style={{ backgroundColor: '#FDFDFD', borderBottom: '1px solid #E5E7EB' }}>
      <div className="flex flex-col items-center gap-3">
        <div style={{ width: 220, height: 70, borderRadius: 12, border: '1px solid #E5E7EB', backgroundColor: 'white', padding: '8px 12px', overflow: 'hidden' }}>
          <svg width="100%" height="100%" viewBox="0 0 196 54" fill="none" preserveAspectRatio="none">
            <rect x="0" y="0" width="196" height="22" fill="#0A77FF" opacity="0.06" />
            <rect x="0" y="32" width="196" height="22" fill="#EF4444" opacity="0.06" />
            <line x1="0" y1="16" x2="196" y2="16" stroke="#0A77FF" strokeWidth="2" />
            <circle cx="30" cy="16" r="4" fill="#0A77FF" />
            <circle cx="98" cy="16" r="4" fill="#0A77FF" />
            <circle cx="166" cy="16" r="4" fill="#0A77FF" />
            <line x1="0" y1="38" x2="196" y2="38" stroke="#EF4444" strokeWidth="2" />
            <circle cx="30" cy="38" r="4" fill="#EF4444" />
            <circle cx="98" cy="38" r="4" fill="#EF4444" />
            <circle cx="166" cy="38" r="4" fill="#EF4444" />
          </svg>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div style={{ width: 8, height: 8, backgroundColor: '#EF4444', borderRadius: '50%' }} />
            <span style={{ fontSize: 11, fontWeight: 600, fontFamily: FONT, color: '#64748B' }}>Min: {minVal}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div style={{ width: 8, height: 8, backgroundColor: '#0A77FF', borderRadius: '50%' }} />
            <span style={{ fontSize: 11, fontWeight: 600, fontFamily: FONT, color: '#64748B' }}>Max: {maxVal}</span>
          </div>
          <span className="px-2 py-0.5" style={{ fontSize: 11, fontWeight: 600, fontFamily: FONT, color: '#1E293B', backgroundColor: 'white', borderRadius: 4, border: '1px solid #E5E7EB' }}>{config.stockUom}</span>
        </div>
      </div>

      <div className="flex items-center gap-5">
        <div className="flex flex-col items-center gap-2">
          <div className="relative flex items-center justify-center" style={{ width: 56, height: 56, borderRadius: '50%', backgroundColor: 'rgba(34, 197, 94, 0.07)' }}>
            <ArrowDownRight style={{ width: 24, height: 24, color: '#22C55E' }} />
            <span className="absolute flex items-center justify-center" style={{ top: -2, right: -2, width: 22, height: 22, borderRadius: '50%', backgroundColor: '#0A77FF', fontSize: 11, fontWeight: 700, color: 'white', fontFamily: FONT }}>{inCount}</span>
          </div>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.5px', fontFamily: FONT, color: '#64748B' }}>Inbound</span>
        </div>
        <div style={{ width: 36, borderTop: '2px dashed #D1D5DB' }} />
        <div className="flex flex-col items-center gap-2">
          <div className="relative flex items-center justify-center" style={{ width: 56, height: 56, borderRadius: '50%', backgroundColor: 'rgba(10, 119, 255, 0.07)' }}>
            <ArrowUpRight style={{ width: 24, height: 24, color: '#0A77FF' }} />
            <span className="absolute flex items-center justify-center" style={{ top: -2, right: -2, width: 22, height: 22, borderRadius: '50%', backgroundColor: '#0A77FF', fontSize: 11, fontWeight: 700, color: 'white', fontFamily: FONT }}>{outCount}</span>
          </div>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.5px', fontFamily: FONT, color: '#64748B' }}>Outbound</span>
        </div>
      </div>
    </div>
  );
}

export function ProcurementSummaryStrip({ config }: { config: AdvancedConfig }) {
  const minVal = config.minPurchase || '0';
  const maxVal = config.maxPurchase || '0';
  const multVal = config.multiples || '1';
  const minN = parseInt(minVal) || 0;
  const maxN = parseInt(maxVal) || 0;
  const maxBar = Math.max(minN, maxN, 1);
  const maxContainerH = 80;
  const minFillH = Math.max(10, (minN / maxBar) * maxContainerH);
  const maxFillH = Math.max(10, (maxN / maxBar) * maxContainerH);

  return (
    <div className="flex items-center justify-center gap-14 px-8 py-8" style={{ backgroundColor: '#FDFDFD', borderBottom: '1px solid #E5E7EB' }}>
      <div className="flex items-end gap-4">
        <div className="flex flex-col items-center gap-1">
          <span style={{ fontSize: 11, fontWeight: 600, fontFamily: FONT, color: '#64748B' }}>Min Order</span>
          <div style={{ position: 'relative', width: 52, height: maxContainerH, borderRadius: '6px 6px 0 0', border: '1.5px dashed #D8B4FE', backgroundColor: 'white' }}>
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              height: minFillH,
              background: 'linear-gradient(180deg, #C4B5FD 0%, #D8B4FE 100%)',
              borderRadius: '0 0 4px 4px',
              transition: 'height 0.3s',
            }} />
          </div>
          <span className="px-2.5 py-0.5" style={{ fontSize: 11, fontWeight: 700, fontFamily: FONT, color: '#7C3AED', backgroundColor: '#F3E8FF', borderRadius: 4 }}>{minVal}</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span style={{ fontSize: 11, fontWeight: 600, fontFamily: FONT, color: '#64748B' }}>Max Order</span>
          <div style={{ position: 'relative', width: 52, height: maxContainerH, borderRadius: '6px 6px 0 0', border: '1.5px dashed #C4B5FD', backgroundColor: 'white' }}>
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              height: maxFillH,
              background: 'linear-gradient(180deg, #8B5CF6 0%, #A78BFA 100%)',
              borderRadius: '0 0 4px 4px',
              transition: 'height 0.3s',
            }} />
          </div>
          <span className="px-2.5 py-0.5" style={{ fontSize: 11, fontWeight: 700, fontFamily: FONT, color: '#7C3AED', backgroundColor: '#F3E8FF', borderRadius: 4 }}>{maxVal}</span>
        </div>
        <div className="flex items-end pb-3 ml-1">
          <span className="px-3 py-1" style={{ fontSize: 13, fontWeight: 600, fontFamily: FONT, color: '#1E293B', backgroundColor: 'white', borderRadius: 6, border: '1px solid #E5E7EB', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>{config.uom}</span>
        </div>
      </div>

      <div style={{ width: 1, height: 100, backgroundColor: '#E5E7EB' }} />

      <div className="flex flex-col items-center gap-2.5">
        <div className="relative flex items-center justify-center" style={{ width: 76, height: 76, borderRadius: 16, backgroundColor: 'rgba(245, 158, 11, 0.06)', border: '1.5px dashed rgba(245, 158, 11, 0.3)' }}>
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <circle cx="18" cy="18" r="5" fill="#F59E0B" />
            <circle cx="18" cy="6" r="3.5" fill="#F59E0B" opacity="0.7" />
            <line x1="18" y1="13" x2="18" y2="9.5" stroke="#F59E0B" strokeWidth="1.5" />
            <circle cx="8" cy="28" r="3.5" fill="#F59E0B" opacity="0.7" />
            <line x1="14.5" y1="21.5" x2="10.5" y2="25.5" stroke="#F59E0B" strokeWidth="1.5" />
            <circle cx="28" cy="28" r="3.5" fill="#F59E0B" opacity="0.7" />
            <line x1="21.5" y1="21.5" x2="25.5" y2="25.5" stroke="#F59E0B" strokeWidth="1.5" />
            <circle cx="7" cy="12" r="3" fill="#F59E0B" opacity="0.5" />
            <line x1="13.5" y1="16" x2="9.5" y2="13.5" stroke="#F59E0B" strokeWidth="1.2" />
            <circle cx="29" cy="12" r="3" fill="#F59E0B" opacity="0.5" />
            <line x1="22.5" y1="16" x2="26.5" y2="13.5" stroke="#F59E0B" strokeWidth="1.2" />
          </svg>
          <span className="absolute flex items-center justify-center" style={{ top: -6, right: -6, width: 28, height: 28, borderRadius: '50%', backgroundColor: '#F97316', fontSize: 11, fontWeight: 800, color: 'white', fontFamily: FONT }}>x{multVal}</span>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.3px', fontFamily: FONT, color: '#374151' }}>Order Multiples</span>
      </div>
    </div>
  );
}

export function SellingSummaryStrip({ config }: { config: AdvancedConfig }) {
  const isGlobal = config.sellingScope === 'all';
  const partnerCount = (config.specificPartners || []).length;
  const priceCount = (config.pricing || []).filter((p: any) => p.price).length;

  return (
    <div className="flex items-center justify-center gap-12 px-8 py-8" style={{ backgroundColor: '#FDFDFD', borderBottom: '1px solid #E5E7EB' }}>
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center justify-center" style={{ width: 64, height: 64, borderRadius: 14, backgroundColor: isGlobal ? 'rgba(10, 119, 255, 0.07)' : 'rgba(245, 158, 11, 0.07)' }}>
          {isGlobal ? (
            <Globe style={{ width: 32, height: 32, color: '#0A77FF' }} />
          ) : (
            <Users style={{ width: 32, height: 32, color: '#F59E0B' }} />
          )}
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', fontFamily: FONT, color: '#374151' }}>
          {isGlobal ? 'GLOBAL MARKET' : `${partnerCount} PARTNERS`}
        </span>
      </div>

      <div style={{ width: 1, height: 80, backgroundColor: '#E5E7EB' }} />

      <div className="flex flex-col items-center gap-2">
        <div className="relative flex items-center justify-center" style={{ width: 64, height: 64, borderRadius: 14, backgroundColor: 'rgba(34, 197, 94, 0.07)' }}>
          <DollarSign style={{ width: 32, height: 32, color: '#22C55E' }} />
          <span className="absolute flex items-center justify-center" style={{ top: -4, right: -4, width: 22, height: 22, borderRadius: '50%', backgroundColor: '#22C55E', fontSize: 11, fontWeight: 700, color: 'white', fontFamily: FONT }}>{priceCount}</span>
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', fontFamily: FONT, color: '#374151' }}>PRICE POINTS</span>
      </div>
    </div>
  );
}

export function CycleCountingSummaryStrip({ config }: { config: AdvancedConfig }) {
  const tolerance = config.cycleTolerance || config.cycleDeviation || '0';
  const approverCount = (config.approvers || []).length;
  const scanCount = [config.scanLocation, config.scanItem, config.scanLot, config.scanSerial].filter(Boolean).length;

  return (
    <div className="flex items-center justify-center gap-6 px-8 py-7" style={{ backgroundColor: '#FDFDFD', borderBottom: '1px solid #E5E7EB' }}>
      {/* Variance Tolerance */}
      <div className="flex flex-col items-center gap-2.5 relative">
        <div className="flex items-center justify-center relative" style={{
          width: 64, height: 64, borderRadius: 14,
          border: '1.5px dashed var(--border)',
          backgroundColor: 'var(--card)',
        }}>
          <span style={{ fontSize: 26, fontWeight: 800, fontFamily: FONT, color: '#F59E0B', lineHeight: 1 }}>±</span>
          <span className="absolute whitespace-nowrap px-2 py-0.5" style={{
            top: -8, right: -10,
            fontSize: 10, fontWeight: 600, fontFamily: FONT,
            color: 'white',
            backgroundColor: '#F59E0B',
            borderRadius: 6,
            lineHeight: 1.2,
          }}>
            {tolerance}%
          </span>
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', fontFamily: FONT, color: 'var(--foreground)', opacity: 0.5 }}>VARIANCE</span>
      </div>

      <span style={{ fontSize: 18, color: 'var(--foreground)', opacity: 0.15, fontWeight: 300 }}>→</span>

      {/* Approver */}
      <div className="flex flex-col items-center gap-2.5 relative">
        <div className="flex items-center justify-center relative" style={{
          width: 64, height: 64, borderRadius: 14,
          border: '1.5px dashed var(--border)',
          backgroundColor: 'var(--card)',
          color: 'var(--primary)',
        }}>
          <ShieldCheck style={{ width: 26, height: 26 }} />
          {approverCount > 0 && (
            <span className="absolute whitespace-nowrap px-2 py-0.5" style={{
              top: -8, right: -10,
              fontSize: 10, fontWeight: 600, fontFamily: FONT,
              color: 'white',
              backgroundColor: '#0A77FF',
              borderRadius: 6,
              lineHeight: 1.2,
            }}>
              {approverCount}
            </span>
          )}
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', fontFamily: FONT, color: 'var(--foreground)', opacity: 0.5 }}>APPROVERS</span>
      </div>

      <span style={{ fontSize: 18, color: 'var(--foreground)', opacity: 0.15, fontWeight: 300 }}>→</span>

      {/* Scan Enforcement */}
      <div className="flex flex-col items-center gap-2.5 relative">
        <div className="flex items-center justify-center relative" style={{
          width: 64, height: 64, borderRadius: 14,
          border: '1.5px dashed var(--border)',
          backgroundColor: 'var(--card)',
          color: scanCount > 0 ? 'var(--primary)' : '#94A3B8',
        }}>
          <ScanLine style={{ width: 26, height: 26 }} />
          <span className="absolute whitespace-nowrap px-2 py-0.5" style={{
            top: -8, right: -10,
            fontSize: 10, fontWeight: 600, fontFamily: FONT,
            color: 'white',
            backgroundColor: scanCount > 0 ? '#0A77FF' : '#94A3B8',
            borderRadius: 6,
            lineHeight: 1.2,
          }}>
            {scanCount}/4
          </span>
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', fontFamily: FONT, color: 'var(--foreground)', opacity: 0.5 }}>SCAN RULES</span>
      </div>
    </div>
  );
}
