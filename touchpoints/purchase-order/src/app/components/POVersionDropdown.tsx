import { useState, useRef, useEffect } from 'react';
import { ChevronDown, FileText, RotateCcw, Eye, Send, CheckCircle2, Clock } from 'lucide-react';
import type { POVersionEntry, POStatus, POVersionStatus } from './poStore';

/* ── Status config — borders added 2026-05 so the mini-pill inside the
   compact trigger reads as a defined chip (not a fuzzy color wash). Palette
   shifted to Partners' canonical status tints:
     - draft   → slate-100 / slate-700 / slate-200 (neutral, matches "Latest")
     - sent    → Partners Vendor-blue (#EFF6FF / #1E40AF / #BFDBFE)
     - confirmed → Partners Active-emerald (#ECFDF5 / #065F46 / #A7F3D0)
     - partial → Partners Inactive-amber (#FFFBEB / #92400E / #FDE68A)
   Softer surfaces + crisper text contrast so the mini-pill is legible
   inside the parent compact trigger. */
const statusConfig: Record<POVersionStatus, { label: string; bg: string; color: string; border: string; icon: typeof Send }> = {
  draft:                 { label: 'Draft',     bg: '#F1F5F9', color: '#334155', border: '#E2E8F0', icon: FileText },
  sent:                  { label: 'Sent',      bg: '#EFF6FF', color: '#1E40AF', border: '#BFDBFE', icon: Send },
  confirmed:             { label: 'Confirmed', bg: '#ECFDF5', color: '#065F46', border: '#A7F3D0', icon: CheckCircle2 },
  'partially-received':  { label: 'Partial',   bg: '#FFFBEB', color: '#92400E', border: '#FDE68A', icon: Clock },
};

/* ── Map PO lifecycle status → version status ── */
function mapPOStatus(s: POStatus): POVersionStatus {
  switch (s) {
    case 'Draft': return 'draft';
    case 'Sent': return 'sent';
    case 'Confirmed': return 'confirmed';
    case 'Partially Received':
    case 'Active with Cancellations':
      return 'partially-received';
    default: return 'confirmed';
  }
}

interface LocalVersion {
  version: number;
  versionStatus: POVersionStatus;
  date: string;
  sentAt?: string;
  confirmedAt?: string;
  author: string;
  summary: string;
  isRevert?: boolean;
  revertedFrom?: number;
}

interface POVersionDropdownProps {
  currentVersion: number;
  currentStatus: POStatus;
  viewingVersion: number | null;
  onViewVersion: (version: number | null) => void;
  onEditAsDraft?: (fromVersion: number) => void;
  materialChangesCount?: number;
  versions: POVersionEntry[];
  /** Scroll-morphed compact variant — tighter padding + smaller text inside
   *  the compound pill. Matches the rest of the header's `isScrolled` morph. */
  compact?: boolean;
}

function toLocalVersion(v: POVersionEntry): LocalVersion {
  const d = new Date(v.createdAt);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return {
    version: v.version,
    versionStatus: v.versionStatus,
    date: `${mm}/${dd}/${d.getFullYear()}`,
    author: v.createdBy,
    summary: v.reason || `Version ${v.version}`,
    isRevert: v.isRevert,
    revertedFrom: v.revertedFrom,
  };
}

export default function POVersionDropdown({
  currentVersion,
  currentStatus,
  viewingVersion,
  onViewVersion,
  onEditAsDraft,
  materialChangesCount,
  versions: poVersions,
  compact = false,
}: POVersionDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Derive local versions from PO store versions
  const versions: LocalVersion[] = [...poVersions]
    .sort((a, b) => b.version - a.version)
    .map(toLocalVersion);

  // Sync latest version status with current PO status
  if (versions.length > 0) {
    const mapped = mapPOStatus(currentStatus);
    versions[0] = { ...versions[0], versionStatus: mapped };
  }

  const lastApproved = null;
  const lastApprovedVersionNum = -1;
  const latestVersion = versions[0];

  const isViewingOld = viewingVersion != null && latestVersion && viewingVersion !== latestVersion.version;
  const displayVersion = isViewingOld
    ? versions.find(v => v.version === viewingVersion) || latestVersion
    : latestVersion;

  // Click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  if (!displayVersion || !latestVersion) return null;

  // Surfaced metadata in the trigger: status icon + V# + status-mini-pill + date.
  // The 2026-05 rewrite collapsed the outer chrome to Partners' compact-pill
  // recipe (11/600, 2px 8px, rounded-md, border-border, white bg) so the trigger
  // reads as one cohesive element instead of a row of disconnected chunks.
  const dsCfg = statusConfig[displayVersion.versionStatus];
  const DSIcon = dsCfg.icon;
  const isLatest = displayVersion.version === latestVersion.version;
  // Inner status-mini-pill label/colors. "Latest" wins when this is the most
  // recent version and not currently being viewed as historic; "Viewing" wins
  // when the buyer drilled into an older version; otherwise we surface the
  // version's own lifecycle status (Draft / Sent / Confirmed / Partial).
  // All three branches use the new status palette (slate / blue / emerald /
  // amber) for consistent border + bg + text contrast.
  const miniPill = isViewingOld
    ? { label: 'Viewing', color: '#92400E', bg: '#FEF3C7', border: '#FDE68A' }
    : isLatest && displayVersion.versionStatus === 'draft'
      ? { label: 'Latest', color: '#334155', bg: '#F1F5F9', border: '#E2E8F0' }
      : { label: isLatest ? dsCfg.label : dsCfg.label, color: dsCfg.color, bg: dsCfg.bg, border: dsCfg.border };

  // Trigger is a compact pill matching Partners' PartnerGroupHoverPill recipe
  // (`Partners/.../VendorDetailsPage.tsx:1517-1544`):
  //   `inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] border
  //    border-border bg-white text-muted-foreground` + `fontWeight: 600`.
  // Surfaced detail in the title row collapses to just `V{n}` + a small chevron;
  // status/date/changes counters move into the popover panel so the title row
  // doesn't compete with the StatusBadge for attention. Amber-tinted variant
  // when viewing a non-latest version (eye-icon affordance retained).
  // Outer trigger surface: white normally, soft amber when viewing a historic
  // version. Border + text are slate-200/slate-700 for crisper contrast than
  // the previous `--border` / `--foreground` token combo (which resolved muddy
  // against the white surface). Padding + fontSize morph when `compact`.
  const triggerBaseStyle: React.CSSProperties = {
    padding: compact ? '2px 6px' : '3px 8px',
    fontSize: compact ? 10 : 11,
    fontWeight: 600,
    lineHeight: 1.35,
    fontFamily: 'inherit',
    borderRadius: 6,
    border: '1px solid',
    backgroundColor: isViewingOld ? '#FFFBEB' : '#FFFFFF',
    borderColor: isViewingOld ? '#FDE68A' : '#E2E8F0' /* slate-200 */,
    color: isViewingOld ? '#92400E' : '#0F172A' /* slate-900 */,
    cursor: 'pointer',
    // Single 250ms cubic-bezier — matches the canonical morph transition used
    // by every other element in the title row (BackButton, h1, Actions, etc).
    transition: 'all 250ms cubic-bezier(0.4, 0, 0.2, 1)',
  };

  return (
    <div className="relative" ref={dropdownRef} style={{ fontFamily: 'inherit' }}>
      {/* ── Trigger — compound compact pill:
            [icon] v3  [Latest]  05/24/2026  ▾
          Color ladder (refined 2026-05):
            - Outer pill bg/border:  white / slate-200       (or amber-50 / amber-200 when viewing historic)
            - Outer pill text:       slate-900               (or amber-800 when viewing)
            - Status icon:           status palette tint     (Send blue / Check emerald / Clock amber / FileText slate)
            - Mini-pill:             status bg + border + text (Partners' canonical tints)
            - Date:                  slate-500               (was slate-400 — too faded vs white surface)
            - Material counter:      primary bg + white text  (small but visible signal)
            - Chevron:               slate-400               (passive affordance) */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Version ${displayVersion.version} (${miniPill.label}, ${displayVersion.date})`}
        title={isViewingOld ? `Viewing V${displayVersion.version} · ${displayVersion.date}` : `V${displayVersion.version} · ${miniPill.label} · ${displayVersion.date}`}
        className="inline-flex items-center gap-1.5 transition-colors duration-150 hover:bg-slate-50 shrink-0"
        style={triggerBaseStyle}
      >
        {/* Status / Viewing icon — 11px to balance against the 11/600 V# */}
        {isViewingOld ? (
          <Eye style={{ width: 11, height: 11, color: '#D97706', flexShrink: 0 }} />
        ) : (
          <DSIcon style={{ width: 11, height: 11, color: dsCfg.color, flexShrink: 0 }} />
        )}

        {/* Version number — trigger anchor. 11/600 in slate-900 for crispness
            (was inheriting the previous muddy `--foreground` token). */}
        <span style={{ color: isViewingOld ? '#92400E' : '#0F172A' }}>v{displayVersion.version}</span>

        {/* Status mini-pill — Latest / Draft / Sent / Confirmed / Partial / Viewing.
            10/600 with status bg + 1px status-border so it reads as a defined
            chip inside the outer pill (previously a fuzzy fill-only blob). */}
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

        {/* Date — secondary metadata. Slate-500 (`#64748B`) gives a softer-than-
            label but still readable contrast against the white surface. Bumped
            from the prior slate-400 which faded into the background. */}
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: isViewingOld ? '#B45309' : '#64748B' /* slate-500 */,
            lineHeight: 1.2,
          }}
        >
          {displayVersion.date}
        </span>

        {/* Material-changes counter — only when this is a Draft latest with
            pending diffs vs the previous sent version. 9/700 white on `--primary`,
            pill-shaped so multi-digit counts still fit. */}
        {!isViewingOld && materialChangesCount != null && materialChangesCount > 0 && displayVersion.versionStatus === 'draft' && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: '#FFFFFF',
              backgroundColor: 'hsl(var(--primary))',
              minWidth: 14,
              height: 14,
              padding: '0 4px',
              borderRadius: 7,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
            }}
            title={`${materialChangesCount} material change${materialChangesCount === 1 ? '' : 's'}`}
          >
            {materialChangesCount}
          </span>
        )}

        <ChevronDown
          className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
          style={{ width: 12, height: 12, color: isViewingOld ? '#D97706' : '#94A3B8' /* slate-400 */ }}
        />
      </button>

      {/* ── Dropdown panel ── */}
      {isOpen && (
        <div
          className="absolute top-full left-0 mt-1 bg-white z-50"
          style={{
            width: 400,
            borderRadius: 10,
            border: '1px solid #E5E7EB',
            boxShadow: '0 8px 24px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid #F3F4F6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', lineHeight: '1', marginBottom: 4 }}>
                Version History
              </div>
              <div style={{ fontSize: 11, color: '#9CA3AF', lineHeight: '1' }}>
                {versions.length} versions
              </div>
            </div>
            {isViewingOld && (
              <button
                onClick={() => { onViewVersion(null); setIsOpen(false); }}
                style={{
                  fontSize: 11, fontWeight: 600, color: '#FFFFFF', backgroundColor: '#1B6EF3',
                  padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', lineHeight: '1',
                  fontFamily: 'Inter, system-ui, sans-serif',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#0D5ED7'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#1B6EF3'; }}
              >
                Back to Latest
              </button>
            )}
          </div>

          {/* Version list */}
          <div style={{ maxHeight: 360, overflowY: 'auto', scrollbarWidth: 'thin' }}>
            {versions.map((version, index) => {
              const isLatestVer = index === 0;
              const isBeingViewed = isViewingOld && version.version === viewingVersion;
              const isLastApprovedVer = false;
              const vsCfg = statusConfig[version.versionStatus];
              const VSIcon = vsCfg.icon;
              const canEditAsDraft = !isLatestVer && onEditAsDraft;

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
                    borderBottom: index < versions.length - 1 ? '1px solid #F7F8F9' : 'none',
                    transition: 'background-color 100ms',
                    borderLeft: isBeingViewed ? '3px solid #D97706' : '3px solid transparent',
                  }}
                  onClick={() => {
                    if (isLatestVer) onViewVersion(null);
                    else onViewVersion(version.version);
                    setIsOpen(false);
                  }}
                  onMouseEnter={(e) => { if (!isBeingViewed) e.currentTarget.style.backgroundColor = '#FAFBFC'; }}
                  onMouseLeave={(e) => { if (!isBeingViewed) e.currentTarget.style.backgroundColor = isBeingViewed ? '#FFFBEB' : 'transparent'; }}
                >
                  {/* Version icon */}
                  <div style={{
                    width: 24, height: 24, borderRadius: 6,
                    backgroundColor: isBeingViewed ? '#FEF3C7' : isLastApprovedVer ? '#CCFBF1' : version.versionStatus === 'sent' ? '#DBEAFE' : version.isRevert ? '#FFFBEB' : '#F9FAFB',
                    border: `1px solid ${isBeingViewed ? '#FDE68A' : isLastApprovedVer ? '#5EEAD4' : version.versionStatus === 'sent' ? '#93C5FD' : version.isRevert ? '#FDE68A' : '#F3F4F6'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {isBeingViewed ? (
                      <Eye style={{ width: 11, height: 11, color: '#D97706' }} />
                    ) : version.isRevert ? (
                      <RotateCcw style={{ width: 11, height: 11, color: '#D97706' }} />
                    ) : isLastApprovedVer ? (
                      <CheckCircle2 style={{ width: 12, height: 12, color: '#0D9488' }} />
                    ) : version.versionStatus === 'sent' ? (
                      <Send style={{ width: 11, height: 11, color: '#2563EB' }} />
                    ) : (
                      <FileText style={{ width: 12, height: 12, color: '#9CA3AF' }} />
                    )}
                  </div>

                  {/* Content — single header row now that the version
                      reason line is gone (2026-07-22). No `marginBottom`
                      on the header, else the empty space below it shifts
                      the flex-centered date out of vertical alignment
                      with the V# / status pills. */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#1F2937', lineHeight: '1' }}>
                        V{version.version}
                      </span>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 3,
                        fontSize: 10, fontWeight: 600, color: vsCfg.color, backgroundColor: vsCfg.bg,
                        padding: '2px 5px', borderRadius: 3, lineHeight: '1',
                      }}>
                        <VSIcon style={{ width: 9, height: 9 }} />
                        {vsCfg.label}
                      </span>
                      {isLatestVer && (
                        <span style={{
                          fontSize: 10, fontWeight: 600, color: '#374151', backgroundColor: '#F3F4F6',
                          padding: '2px 5px', borderRadius: 3, lineHeight: '1', border: '1px solid #E5E7EB',
                        }}>Latest</span>
                      )}
                      {isBeingViewed && (
                        <span style={{
                          fontSize: 10, fontWeight: 600, color: '#92400E', backgroundColor: '#FEF3C7',
                          padding: '2px 5px', borderRadius: 3, lineHeight: '1', border: '1px solid #FDE68A',
                        }}>Viewing</span>
                      )}
                      {version.isRevert && (
                        <span style={{
                          fontSize: 10, fontWeight: 500, color: '#D97706', backgroundColor: '#FFFBEB',
                          padding: '2px 5px', borderRadius: 3, lineHeight: '1', border: '1px solid #FDE68A',
                        }}>Revert</span>
                      )}
                    </div>
                  </div>

                  {/* Date + revert */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <span style={{ fontSize: 11, color: '#9CA3AF', lineHeight: '1' }}>{version.date}</span>
                    {canEditAsDraft && (
                      <button
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditAsDraft?.(version.version);
                          setIsOpen(false);
                        }}
                        title={`Edit as draft from V${version.version}`}
                        style={{
                          width: 22, height: 22, borderRadius: 4, border: '1px solid #E5E7EB',
                          backgroundColor: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#FEF3C7'; e.currentTarget.style.borderColor = '#FDE68A'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; e.currentTarget.style.borderColor = '#E5E7EB'; }}
                      >
                        <RotateCcw style={{ width: 10, height: 10, color: '#D97706' }} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
