import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Truck, Check, DollarSign, Layers, User } from 'lucide-react';
import { SwitchFreightModeConfirm, splitEvenly } from '@/app/components/shared/SwitchFreightModeConfirm';
import { FreightSplitOverlay } from '@/app/components/shared/FreightSplitOverlay';
import { getLineItemImage } from '../../data/lineItemImage';

/**
 * Freight Charges breakdown modal.
 *
 * Side-layout pattern mirrors the ShipmentMethodModal: a 272-px rail
 * on the left carries radio cards for the charge mode (Order-level /
 * Per-line); the right column adapts to the selected mode. The modal
 * has a fixed height so it does not resize between modes — short
 * content sits on whitespace, long content scrolls inside the right
 * column.
 *
 * Customer-pickup awareness:
 *  • When the order-level shipment method is customer-pickup, no
 *    freight is billable. Order-level mode hides the cost input and
 *    shows a "No freight charged" notice in its place.
 *  • In per-line mode, lines whose effective shipment method is
 *    customer-pickup render with a disabled cost input and a small
 *    "Customer pickup" indicator instead of a number.
 */

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

const fmtMoneyInput = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

type ShipmentMethodLite = 'courier-pickup' | 'courier-dropby' | 'customer-pickup';

export interface FreightLine {
  id: string;
  code: string;
  description: string;
  subtotal: number;
  thumbColor?: string;
  overrideCost: number | undefined;
  /** Per-line shipment method. When customer-pickup, the line's
   *  freight input is disabled — pickup orders are not billed for
   *  freight. Absent value means the line inherits the order-level
   *  method (see `defaultMethod` on the modal). */
  shipmentMethod?: ShipmentMethodLite;
}

export interface FreightBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCost: number;
  lines: FreightLine[];
  onToggleLine: (lineId: string, next: number | undefined) => void;
  onChangeLineCost: (lineId: string, next: number) => void;
  onChangeDefault: (next: number) => void;
  scopeLabel?: string;
  /** Order-level shipment method. When customer-pickup, the modal
   *  hides the cost input in Order-level mode and treats lines
   *  without their own method as customer-pickup. */
  defaultMethod?: ShipmentMethodLite;
}

type Mode = 'default' | 'per-line';

export function FreightBreakdownModal({
  isOpen, onClose, defaultCost, lines, onToggleLine, onChangeLineCost, onChangeDefault, scopeLabel, defaultMethod,
}: FreightBreakdownModalProps) {
  const [mode, setMode] = useState<Mode>('default');
  const [draftDefault, setDraftDefault] = useState(defaultCost);
  const [draftLines, setDraftLines] = useState<Record<string, number | undefined>>({});
  const [pendingSwitch, setPendingSwitch] = useState<Mode | null>(null);
  const [splitOverlay, setSplitOverlay] = useState<null | { direction: 'split' | 'merge'; total: number; lineCount: number }>(null);

  useEffect(() => {
    if (!isOpen) return;
    setDraftDefault(defaultCost);
    const initial: Record<string, number | undefined> = {};
    for (const l of lines) initial[l.id] = l.overrideCost;
    setDraftLines(initial);
    setMode(lines.some((l) => typeof l.overrideCost === 'number') ? 'per-line' : 'default');
  }, [isOpen, defaultCost, lines]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleDone(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, draftLines, draftDefault, mode]);

  const isPerLine = mode === 'per-line';
  const isDefaultCustomerPickup = defaultMethod === 'customer-pickup';
  /* Effective per-line method: prefer the line's own method, fall
     back to the order-level default. Customer-pickup lines render
     disabled regardless of mode. */
  const effectiveLineMethod = (line: FreightLine): ShipmentMethodLite | undefined =>
    line.shipmentMethod ?? defaultMethod;

  const perLineSum = useMemo(
    () => lines.reduce((acc, l) => {
      // Lines on customer-pickup contribute 0 to the freight total
      // even if a stale cost was set previously — pickup orders
      // never bill freight.
      if (effectiveLineMethod(l) === 'customer-pickup') return acc;
      return acc + (typeof draftLines[l.id] === 'number' ? (draftLines[l.id] as number) : 0);
    }, 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lines, draftLines, defaultMethod],
  );
  const inheritCount = useMemo(() => lines.filter((l) => typeof draftLines[l.id] !== 'number').length, [lines, draftLines]);
  const overrideCount = lines.length - inheritCount;

  function handleLineCost(lineId: string, next: number) {
    setDraftLines((prev) => ({ ...prev, [lineId]: next }));
  }

  function requestModeSwitch(target: Mode) {
    if (target === mode) return;
    if (target === 'per-line') {
      const hasDefault = draftDefault > 0 && lines.length > 0;
      if (!hasDefault) { setMode('per-line'); return; }
      setPendingSwitch('per-line');
    } else {
      const hasAnyOverride = lines.some((l) => typeof draftLines[l.id] === 'number');
      if (!hasAnyOverride) { setMode('default'); return; }
      setPendingSwitch('default');
    }
  }

  function confirmSwitch() {
    if (pendingSwitch === 'per-line') {
      const split = splitEvenly(draftDefault, lines.length);
      const next: Record<string, number | undefined> = {};
      lines.forEach((l, i) => { next[l.id] = split[i]; });
      setDraftLines(next);
      setMode('per-line');
      setSplitOverlay({ direction: 'split', total: draftDefault, lineCount: lines.length });
    } else if (pendingSwitch === 'default') {
      const collapsedTotal = perLineSum;
      setDraftDefault(collapsedTotal);
      setDraftLines({});
      setMode('default');
      setSplitOverlay({ direction: 'merge', total: collapsedTotal, lineCount: lines.length });
    }
    setPendingSwitch(null);
  }

  function cancelSwitch() { setPendingSwitch(null); }

  const previewSplit = useMemo(() => splitEvenly(draftDefault, lines.length), [draftDefault, lines.length]);
  const previewBase = previewSplit[0] ?? 0;
  const previewRemainderCount = previewSplit.filter((v) => v !== previewBase).length;

  function handleDone() {
    if (isPerLine) {
      onChangeDefault(draftDefault);
      for (const l of lines) {
        // Customer-pickup lines never carry a freight cost — clear any
        // stale override on save.
        if (effectiveLineMethod(l) === 'customer-pickup') {
          if (typeof l.overrideCost === 'number') onToggleLine(l.id, undefined);
          continue;
        }
        const next = typeof draftLines[l.id] === 'number' ? draftLines[l.id] : draftDefault;
        if (next !== l.overrideCost) onToggleLine(l.id, next);
        if (typeof next === 'number') onChangeLineCost(l.id, next);
      }
    } else {
      onChangeDefault(draftDefault);
      for (const l of lines) {
        if (typeof l.overrideCost === 'number') onToggleLine(l.id, undefined);
      }
    }
    onClose();
  }

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 12200, backgroundColor: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(2px)' }}
      onClick={handleDone}
    >
      <div
        className="bg-white flex flex-col"
        style={{
          /* Fixed height so the dialog does not resize between modes.
             Right column scrolls when its content overflows; short
             content sits on whitespace. Matches ShipmentMethodModal
             so the two surfaces feel consistent. */
          width: 'min(1080px, calc(100% - 32px))',
          height: 'min(720px, calc(100vh - 64px))',
          borderRadius: 16,
          boxShadow: '0 24px 80px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)',
          overflow: 'hidden',
          fontFamily: 'Inter, system-ui, sans-serif',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — Partner Configure-modal stacked title pattern. */}
        <div className="shrink-0 bg-white" style={{ padding: '12px 20px', borderBottom: '1px solid #EEF2F6' }}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate" style={{ fontSize: 15, fontWeight: 600, color: '#0F172A', lineHeight: 1.3 }}>
                Freight Charges
              </h2>
              <p className="truncate" style={{ fontSize: 11, color: '#94A3B8', marginTop: 2, lineHeight: 1.4 }}>
                {scopeLabel ?? 'Quote / SO default'}
              </p>
            </div>
            <button
              onClick={handleDone}
              aria-label="Close"
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer shrink-0"
              style={{ color: '#94A3B8' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F1F5F9'; e.currentTarget.style.color = '#64748B'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#94A3B8'; }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Side-layout body — left rail with mode radio cards, right
            content adapts to the selected mode. */}
        <div className="flex-1 min-h-0 flex flex-row" style={{ backgroundColor: '#FAFBFC' }}>
          {/* Left sidebar — charge mode. Same chrome as the freight
              modal's method picker: heading row, list of radio items
              with icon bubble + name + description + radio dot. */}
          <aside
            className="shrink-0 flex flex-col"
            style={{ width: 272, backgroundColor: '#FFFFFF', borderRight: '1px solid #EEF2F6' }}
          >
            <div className="shrink-0" style={{ padding: '12px 14px 8px', borderBottom: '1px solid #EEF2F6' }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#0F172A' }}>
                Charge Mode
              </span>
              <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 4, lineHeight: 1.45 }}>
                Pick how freight is billed. Settings on the right adapt to this choice.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto" style={{ padding: 10 }}>
              <div className="flex flex-col" style={{ gap: 4 }}>
                <ModeRadio
                  icon={Truck}
                  name="Order-level"
                  description="One charge for the whole order"
                  active={!isPerLine}
                  onClick={() => requestModeSwitch('default')}
                />
                <ModeRadio
                  icon={Layers}
                  name="Per line item"
                  description={`Each line item carries its own freight charge${overrideCount ? ` · ${overrideCount}/${lines.length} set` : ''}`}
                  active={isPerLine}
                  onClick={() => requestModeSwitch('per-line')}
                />
              </div>
            </div>

            <div className="shrink-0" style={{ padding: '10px 14px', borderTop: '1px solid #EEF2F6' }}>
              <p style={{ fontSize: 10, color: '#94A3B8', lineHeight: 1.5 }}>
                Switching modes seeds the other mode with the current total — confirm before changes apply.
              </p>
            </div>
          </aside>

          {/* Right content — single scroll container. The table no
              longer carries its own overflow, so the right column is
              the only scroll surface (avoids the double scrollbar). */}
          <div className="flex-1 min-w-0 overflow-y-auto" style={{ padding: '16px 20px' }}>
            <div className="mb-3">
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', lineHeight: 1.3 }}>
                {isPerLine ? 'Per line item freight' : 'Order-level freight'}
              </h3>
              <p style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>
                {isPerLine
                  ? 'Set a freight charge for each line item. The summary total is the sum of all line charges.'
                  : 'A single freight charge for the entire order. Every line inherits this total.'}
              </p>
            </div>

            {/* Order-level mode: editable cost field (or customer-pickup
                notice). In per-line mode we don't render this card at
                all — the rollup total surfaces inline above the table
                so the modal doesn't waste vertical space on a separate
                read-only summary card. */}
            {!isPerLine && (
              <SectionCard
                icon={Truck}
                title="Order-level freight"
                subtitle="Applies to every line on this order"
              >
                {isDefaultCustomerPickup ? (
                  <CustomerPickupNotice
                    message="No freight charged — customer pickup"
                    detail="The customer collects the goods at our facility, so this order is not billed for freight. Switch the shipment method to a carrier option to enter a freight charge."
                  />
                ) : (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                      Single freight charge (USD)
                    </div>
                    <input
                      type="text"
                      value={fmtMoneyInput(draftDefault)}
                      onChange={(e) => {
                        const cleaned = e.target.value.replace(/[^0-9.]/g, '');
                        setDraftDefault(Math.max(0, parseFloat(cleaned) || 0));
                      }}
                      className="w-full h-9 px-3 text-[13px] text-right outline-none"
                      style={{
                        border: '1px solid #E2E8F0',
                        borderRadius: 8,
                        fontWeight: 500,
                        color: '#0F172A',
                        backgroundColor: '#FFFFFF',
                      }}
                    />
                  </div>
                )}
              </SectionCard>
            )}

            {/* Per-line table. The rollup total lives in the section
                header on the right edge as a read-only chip, so the
                separate "Total from line costs" card is gone. Lines
                on customer-pickup render with a disabled input + small
                pill indicator instead of a numeric cell. */}
            {isPerLine && (
              <SectionCard
                icon={Package}
                title="Line Items"
                subtitle={`${lines.length} total · ${overrideCount} with custom freight`}
                trailing={
                  <span
                    className="inline-flex items-center"
                    style={{
                      gap: 6,
                      padding: '4px 10px',
                      borderRadius: 999,
                      fontSize: 11.5, fontWeight: 600,
                      backgroundColor: 'rgba(10, 119, 255, 0.08)',
                      color: '#0A77FF',
                    }}
                    title="Auto-computed sum of all per-line charges"
                  >
                    Total {fmtMoneyInput(perLineSum)}
                  </span>
                }
                bodyPadding={0}
              >
                {lines.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: '#94A3B8' }}>
                    No line items on this order yet.
                  </div>
                ) : (
                  <table className="w-full text-[12px]" style={{ borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed' }}>
                    <colgroup>
                      <col style={{ width: 44 }} />
                      <col style={{ width: 180 }} />
                      <col />
                      <col style={{ width: 100 }} />
                      <col style={{ width: 170 }} />
                    </colgroup>
                    <thead className="sticky top-0 z-10">
                      <tr style={{ backgroundColor: '#FAFBFC' }}>
                        <th className="text-right px-2 h-9 text-[11px] text-slate-500 whitespace-nowrap" style={{ fontWeight: 600, backgroundColor: '#FAFBFC', borderBottom: '1px solid #E2E8F0' }}>#</th>
                        <th className="text-left px-3 h-9 text-[11px] text-slate-600 whitespace-nowrap" style={{ fontWeight: 600, backgroundColor: '#FAFBFC', borderBottom: '1px solid #E2E8F0' }}>Part Number</th>
                        <th className="text-left px-3 h-9 text-[11px] text-slate-600" style={{ fontWeight: 600, backgroundColor: '#FAFBFC', borderBottom: '1px solid #E2E8F0' }}>Description</th>
                        <th className="text-right px-3 h-9 text-[11px] text-slate-600 whitespace-nowrap" style={{ fontWeight: 600, backgroundColor: '#FAFBFC', borderBottom: '1px solid #E2E8F0' }}>Subtotal</th>
                        <th className="text-right pr-4 pl-3 h-9 text-[11px] text-slate-600 whitespace-nowrap" style={{ fontWeight: 600, backgroundColor: '#FAFBFC', borderBottom: '1px solid #E2E8F0' }}>Freight Charge</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line, idx) => {
                        const draftCost = draftLines[line.id];
                        const effective = typeof draftCost === 'number' ? draftCost : draftDefault;
                        const cellBorder = '1px solid #EEF2F6';
                        const indexLabel = String(idx + 1).padStart(3, '0');
                        const lineMethod = effectiveLineMethod(line);
                        const isPickupLine = lineMethod === 'customer-pickup';
                        return (
                          <tr
                            key={line.id}
                            className="group hover:bg-[#F8FAFC]"
                            style={{ backgroundColor: '#FFFFFF', transition: 'background-color 120ms' }}
                          >
                            <td className="px-2 py-3 align-middle text-right text-[11px] text-slate-400 tabular-nums whitespace-nowrap" style={{ fontWeight: 500, borderBottom: cellBorder }}>
                              {indexLabel}
                            </td>
                            <td className="px-3 py-3 align-middle whitespace-nowrap" style={{ borderBottom: cellBorder }}>
                              <div className="flex items-center gap-2 min-w-0">
                                {/* Real product thumbnail via the
                                    shared `getLineItemImage` helper so
                                    the freight breakdown reads the
                                    same as the main line-items grid. */}
                                <img
                                  src={getLineItemImage(line.code)}
                                  alt=""
                                  className="w-6 h-6 rounded-md shrink-0 object-cover"
                                  style={{ backgroundColor: line.thumbColor || '#F3F4F6' }}
                                  onError={(e) => {
                                    (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
                                  }}
                                />
                                <span className="text-[12px] text-slate-700 tabular-nums" style={{ fontWeight: 500 }}>
                                  {line.code}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-3 align-middle" style={{ borderBottom: cellBorder }}>
                              <p className="text-[12px] text-slate-600 truncate" title={line.description}>
                                {line.description}
                              </p>
                            </td>
                            <td className="px-3 py-3 align-middle text-right text-[12px] text-slate-700 tabular-nums whitespace-nowrap" style={{ fontWeight: 500, borderBottom: cellBorder }}>
                              {fmtCurrency(line.subtotal)}
                            </td>
                            <td className="pr-4 pl-3 py-3 align-middle text-right" style={{ borderBottom: cellBorder }}>
                              {isPickupLine ? (
                                <span
                                  className="inline-flex items-center gap-1 px-1.5 py-[2px] rounded-md text-[10px] border whitespace-nowrap"
                                  style={{ fontWeight: 500, color: '#475569', backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' }}
                                  title="No freight is billed when the customer picks up at our facility."
                                >
                                  <User className="w-2.5 h-2.5" /> Customer pickup
                                </span>
                              ) : (
                                <input
                                  type="text"
                                  value={fmtMoneyInput(effective)}
                                  onChange={(e) => {
                                    const cleaned = e.target.value.replace(/[^0-9.]/g, '');
                                    handleLineCost(line.id, Math.max(0, parseFloat(cleaned) || 0));
                                  }}
                                  className="text-[12px] outline-none text-right"
                                  style={{
                                    width: '100%', height: 28, padding: '0 8px',
                                    border: '1px solid #E2E8F0', borderRadius: 6,
                                    backgroundColor: '#FFFFFF',
                                    color: '#0F172A',
                                    fontWeight: 500,
                                    cursor: 'text',
                                  }}
                                />
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </SectionCard>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-end gap-2 bg-white" style={{ padding: '12px 20px', borderTop: '1px solid #EEF2F6' }}>
          <button
            onClick={handleDone}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg cursor-pointer"
            style={{ fontSize: 13, fontWeight: 600, color: '#FFFFFF', backgroundColor: '#0A77FF' }}
          >
            <Check className="w-3.5 h-3.5" />
            Done
          </button>
        </div>

        {/* Switch-mode confirmation */}
        {pendingSwitch && (
          <SwitchFreightModeConfirm
            target={pendingSwitch}
            defaultCost={draftDefault}
            perLineSum={perLineSum}
            lineCount={lines.length}
            previewBase={previewBase}
            previewRemainderCount={previewRemainderCount}
            onCancel={cancelSwitch}
            onConfirm={confirmSwitch}
          />
        )}
        {splitOverlay && (
          <FreightSplitOverlay
            show
            direction={splitOverlay.direction}
            total={splitOverlay.total}
            lineCount={splitOverlay.lineCount}
            onComplete={() => setSplitOverlay(null)}
          />
        )}
      </div>
    </div>,
    document.body
  );
}

function ModeRadio({
  icon: Icon, name, description, active, onClick,
}: {
  icon: any; name: string; description: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="radio"
      aria-checked={active}
      className="w-full flex items-center text-left transition-all cursor-pointer"
      style={{
        gap: 10,
        padding: '8px 10px',
        borderRadius: 10,
        backgroundColor: active ? 'rgba(10,119,255,0.08)' : 'transparent',
        boxShadow: active ? 'inset 0 0 0 1px rgba(10,119,255,0.15)' : 'none',
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.backgroundColor = 'transparent'; }}
    >
      <div
        className="flex items-center justify-center shrink-0 rounded-lg"
        style={{
          width: 32, height: 32,
          backgroundColor: active ? '#DBEAFE' : '#F1F5F9',
          color: active ? '#0A77FF' : '#94A3B8',
        }}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="truncate" style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', lineHeight: 1.3 }}>
          {name}
        </div>
        <div className="truncate" style={{ fontSize: 10.5, color: '#64748B', marginTop: 1, lineHeight: 1.4 }}>
          {description}
        </div>
      </div>
      <PartnerRadio active={active} />
    </button>
  );
}

function PartnerRadio({ active }: { active: boolean }) {
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0"
      style={{
        width: 16, height: 16,
        borderWidth: 2, borderStyle: 'solid',
        borderColor: active ? 'rgba(10,119,255,0.6)' : '#CBD5E1',
        backgroundColor: 'transparent',
      }}
    >
      {active && <div className="rounded-full" style={{ width: 8, height: 8, backgroundColor: '#0A77FF' }} />}
    </div>
  );
}

function SectionCard({
  icon: Icon, title, subtitle, trailing, children, bodyPadding = 14,
}: {
  icon: any;
  title: string;
  subtitle?: string;
  trailing?: any;
  children: any;
  bodyPadding?: number;
}) {
  return (
    <div className="flex flex-col" style={{ gap: 8 }}>
      <div className="flex items-center justify-between" style={{ gap: 8 }}>
        <div className="flex items-center min-w-0" style={{ gap: 8 }}>
          {Icon && <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: '#64748B' }} />}
          <span className="text-xs shrink-0" style={{ fontWeight: 600, color: '#0F172A' }}>{title}</span>
          {subtitle && <span className="truncate" style={{ fontSize: 11, color: '#94A3B8', fontWeight: 400 }}>{subtitle}</span>}
        </div>
        {trailing && <div className="shrink-0">{trailing}</div>}
      </div>
      <div
        className="bg-white rounded-xl overflow-hidden"
        style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)', padding: bodyPadding }}
      >
        {children}
      </div>
    </div>
  );
}

function CustomerPickupNotice({ message, detail }: { message: string; detail: string }) {
  return (
    <div
      className="flex items-start"
      style={{
        gap: 10,
        padding: '10px 12px',
        borderRadius: 8,
        backgroundColor: '#F8FAFC',
        border: '1px dashed #CBD5E1',
      }}
    >
      <div
        className="flex items-center justify-center shrink-0 rounded-md"
        style={{ width: 24, height: 24, backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}
      >
        <User className="w-3.5 h-3.5" style={{ color: '#64748B' }} />
      </div>
      <div className="min-w-0">
        <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0F172A', lineHeight: 1.3 }}>{message}</div>
        <div style={{ fontSize: 11, color: '#64748B', marginTop: 2, lineHeight: 1.5 }}>{detail}</div>
      </div>
    </div>
  );
}
