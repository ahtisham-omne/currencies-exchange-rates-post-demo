import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, RotateCcw, Eye } from 'lucide-react';

import type { RMAVersionEntry } from '@/app/data/rmaVersions';
import { formatVersionDate, versionStatusConfig } from './rmaVersionDisplay';

/**
 * The version pill that sits in the detail header, and the panel it opens.
 *
 * Ported from the Purchase Order module's `POVersionDropdown.tsx`. Picking an
 * older version puts the page into a read-only viewing state; the pill turns
 * amber and reads "Viewing" until the user goes back to the latest.
 */
export default function RMAVersionDropdown({
  versions,
  currentVersion,
  viewingVersion,
  onViewVersion,
  onRevertToVersion,
  compact = false,
}: {
  versions: RMAVersionEntry[];
  currentVersion: number;
  /** The version being read, or null when reading the current one. */
  viewingVersion: number | null;
  onViewVersion: (version: number | null) => void;
  onRevertToVersion?: (version: number) => void;
  /** Scroll-morphed compact variant, matching the rest of the header. */
  compact?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  /* The detail header card clips its children so the status rail keeps its
     rounded corners, so the panel is rendered to <body> and pinned to the
     trigger rather than positioned inside it. */
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const place = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) setAnchor({ top: rect.bottom + 4, left: rect.left });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (dropdownRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const sorted = [...versions].sort((a, b) => b.version - a.version);
  const latest = sorted.find((v) => v.version === currentVersion) ?? sorted[0];
  if (!latest) return null;

  const isViewingOld = viewingVersion != null && viewingVersion !== latest.version;
  const displayVersion = isViewingOld
    ? (sorted.find((v) => v.version === viewingVersion) ?? latest)
    : latest;

  const dsCfg = versionStatusConfig[displayVersion.versionStatus];
  const DSIcon = dsCfg.icon;
  const isLatest = displayVersion.version === latest.version;

  /* The header already carries the return's status pill, so the trigger says
     what the dropdown adds: whether this is the version in force. */
  const miniPill = isViewingOld
    ? { label: 'Viewing', color: '#92400E', bg: '#FEF3C7', border: '#FDE68A' }
    : isLatest
      ? { label: 'Latest', color: '#334155', bg: '#F1F5F9', border: '#E2E8F0' }
      : { label: dsCfg.label, color: dsCfg.color, bg: dsCfg.bg, border: dsCfg.border };

  // The company date, the one the list and the tabs write. This printed
  // 09/10/2026 in the page header, a stride away from "Sep 10, 2026" in the
  // column underneath it.
  const dateOf = formatVersionDate;

  return (
    <div className="relative" style={{ fontFamily: 'inherit' }}>
      <button
        type="button"
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Version ${displayVersion.version} (${miniPill.label})`}
        title={
          isViewingOld
            ? `Viewing V${displayVersion.version} · ${dateOf(displayVersion.createdAt)}`
            : `V${displayVersion.version} · ${miniPill.label} · ${dateOf(displayVersion.createdAt)}`
        }
        className="inline-flex items-center gap-1.5 transition-colors duration-150 hover:bg-slate-50 shrink-0"
        style={{
          padding: compact ? '2px 6px' : '3px 8px',
          fontSize: compact ? 10 : 11,
          fontWeight: 600,
          lineHeight: 1.35,
          borderRadius: 6,
          border: '1px solid',
          backgroundColor: isViewingOld ? '#FFFBEB' : '#FFFFFF',
          borderColor: isViewingOld ? '#FDE68A' : '#E2E8F0',
          color: isViewingOld ? '#92400E' : '#0F172A',
          cursor: 'pointer',
          transition: 'all 250ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {isViewingOld ? (
          <Eye style={{ width: 11, height: 11, color: '#D97706', flexShrink: 0 }} />
        ) : (
          <DSIcon style={{ width: 11, height: 11, color: dsCfg.color, flexShrink: 0 }} />
        )}

        <span style={{ color: isViewingOld ? '#92400E' : '#0F172A' }}>
          v{displayVersion.version}
        </span>

        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: miniPill.color,
            backgroundColor: miniPill.bg,
            border: `1px solid ${miniPill.border}`,
            padding: '0 5px',
            borderRadius: 3,
            lineHeight: 1.4,
          }}
        >
          {miniPill.label}
        </span>

        {!compact && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: isViewingOld ? '#B45309' : '#64748B',
              lineHeight: 1.2,
            }}
          >
            {dateOf(displayVersion.createdAt)}
          </span>
        )}

        <ChevronDown
          className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
          style={{ width: 12, height: 12, color: isViewingOld ? '#D97706' : '#94A3B8' }}
        />
      </button>

      {isOpen && anchor && createPortal(
        <div
          ref={dropdownRef}
          className="fixed bg-white z-[60]"
          style={{
            top: anchor.top,
            left: anchor.left,
            width: 400,
            borderRadius: 10,
            border: '1px solid #E5E7EB',
            boxShadow: '0 8px 24px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid #F3F4F6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#111827',
                  lineHeight: 1,
                  marginBottom: 4,
                }}
              >
                Version History
              </div>
              <div style={{ fontSize: 11, color: '#9CA3AF', lineHeight: 1 }}>
                {sorted.length} {sorted.length === 1 ? 'version' : 'versions'}
              </div>
            </div>
            {isViewingOld && (
              <button
                type="button"
                onClick={() => {
                  onViewVersion(null);
                  setIsOpen(false);
                }}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#FFFFFF',
                  backgroundColor: 'hsl(var(--primary))',
                  padding: '5px 12px',
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  lineHeight: 1,
                }}
              >
                Back to Latest
              </button>
            )}
          </div>

          <div style={{ maxHeight: 360, overflowY: 'auto', scrollbarWidth: 'thin' }}>
            {sorted.map((version, index) => {
              const isCurrentVer = version.version === currentVersion;
              const isBeingViewed = isViewingOld && version.version === viewingVersion;
              const vsCfg = versionStatusConfig[version.versionStatus];
              const VSIcon = vsCfg.icon;
              const canRevert = !isCurrentVer && onRevertToVersion;

              return (
                <div
                  key={version.version}
                  className="group"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 16px',
                    cursor: 'pointer',
                    backgroundColor: isBeingViewed ? '#FFFBEB' : 'transparent',
                    borderBottom: index < sorted.length - 1 ? '1px solid #F7F8F9' : 'none',
                    transition: 'background-color 100ms',
                    borderLeft: isBeingViewed ? '3px solid #D97706' : '3px solid transparent',
                  }}
                  onClick={() => {
                    onViewVersion(isCurrentVer ? null : version.version);
                    setIsOpen(false);
                  }}
                  onMouseEnter={(e) => {
                    if (!isBeingViewed) e.currentTarget.style.backgroundColor = '#FAFBFC';
                  }}
                  onMouseLeave={(e) => {
                    if (!isBeingViewed) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      backgroundColor: isBeingViewed
                        ? '#FEF3C7'
                        : version.isRevert
                          ? '#FFFBEB'
                          : vsCfg.bg,
                      border: `1px solid ${
                        isBeingViewed ? '#FDE68A' : version.isRevert ? '#FDE68A' : vsCfg.border
                      }`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {isBeingViewed ? (
                      <Eye style={{ width: 11, height: 11, color: '#D97706' }} />
                    ) : version.isRevert ? (
                      <RotateCcw style={{ width: 11, height: 11, color: '#D97706' }} />
                    ) : (
                      <VSIcon style={{ width: 12, height: 12, color: vsCfg.color }} />
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{ fontSize: 13, fontWeight: 600, color: '#1F2937', lineHeight: 1 }}
                      >
                        V{version.version}
                      </span>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                          fontSize: 10,
                          fontWeight: 600,
                          color: vsCfg.color,
                          backgroundColor: vsCfg.bg,
                          padding: '2px 5px',
                          borderRadius: 3,
                          lineHeight: 1,
                        }}
                      >
                        <VSIcon style={{ width: 9, height: 9 }} />
                        {vsCfg.label}
                      </span>
                      {isCurrentVer && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            color: '#374151',
                            backgroundColor: '#F3F4F6',
                            padding: '2px 5px',
                            borderRadius: 3,
                            lineHeight: 1,
                            border: '1px solid #E5E7EB',
                          }}
                        >
                          Current
                        </span>
                      )}
                      {isBeingViewed && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            color: '#92400E',
                            backgroundColor: '#FEF3C7',
                            padding: '2px 5px',
                            borderRadius: 3,
                            lineHeight: 1,
                            border: '1px solid #FDE68A',
                          }}
                        >
                          Viewing
                        </span>
                      )}
                      {version.isRevert && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 500,
                            color: '#D97706',
                            backgroundColor: '#FFFBEB',
                            padding: '2px 5px',
                            borderRadius: 3,
                            lineHeight: 1,
                            border: '1px solid #FDE68A',
                          }}
                        >
                          Revert
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <span style={{ fontSize: 11, color: '#9CA3AF', lineHeight: 1 }}>
                      {dateOf(version.createdAt)}
                    </span>
                    {canRevert && (
                      <button
                        type="button"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRevertToVersion?.(version.version);
                          setIsOpen(false);
                        }}
                        title={`Revert to V${version.version}`}
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 4,
                          border: '1px solid #E5E7EB',
                          backgroundColor: '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        <RotateCcw style={{ width: 10, height: 10, color: '#D97706' }} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
