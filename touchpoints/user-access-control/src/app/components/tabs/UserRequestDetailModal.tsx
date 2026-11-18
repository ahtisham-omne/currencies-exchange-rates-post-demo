import { useState, useMemo } from "react";
import { toast } from "sonner";
import { ModalShell } from "../shared/ModalShell";
import { X, CheckCircle2, XCircle, Maximize2, Minimize2, User, KeyRound, FileText, Clock } from "lucide-react";
import type { UserRequestRow } from "../../data/user-requests-data";
import { PERMISSION_MODULES, type Permission } from "../../data/permissions-data";
import { getAvatarTint, getInitials } from "../../lib/avatar";
import { users as allUsers } from "../../data/users-data";
import { USER_AVATAR_MAP } from "../../data/user-avatars";
import { LicenseBadge } from "../table-cells";
import { useAccessMode } from "../access-mode";

/* ─── Status pill config (matches card view) ─── */
const STATUS_CONFIG: Record<
  string,
  { bg: string; text: string; dot: string; border: string; label: string }
> = {
  Accepted: { bg: "#ECFDF5", text: "#065F46", dot: "#059669", border: "#A7F3D0", label: "Approved" },
  Pending:  { bg: "#FFFBEB", text: "#92400E", dot: "#D97706", border: "#FDE68A", label: "Pending Review" },
  Rejected: { bg: "#FEF2F2", text: "#991B1B", dot: "#EF4444", border: "#FECACA", label: "Rejected" },
};

/* ─── Access type chip: a requested permission is either View or Edit ─── */
type ActionType = "View" | "Edit";
const ACTION_TYPE_CONFIG: Record<ActionType, { bg: string; text: string; border: string }> = {
  View: { bg: "#ECFDF5", text: "#047857", border: "#A7F3D0" },
  Edit: { bg: "#FFFBEB", text: "#B45309", border: "#FDE68A" },
};

function inferActionType(permName: string, permId?: string): ActionType {
  const s = `${permName} ${permId ?? ""}`.toLowerCase();
  // Anything that implies changing data is "Edit"; everything else is "View".
  if (/\b(edit|create|update|modify|record|send|over-?receive|delete|remove|void|cancel|deactivate|approve|manage|admin|assign|invite|configure|policy|govern|allocate|execute|grant)\b/.test(s))
    return "Edit";
  return "View";
}

function ActionChip({ type }: { type: ActionType }) {
  const c = ACTION_TYPE_CONFIG[type];
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] border shrink-0"
      style={{ backgroundColor: c.bg, color: c.text, borderColor: c.border, fontWeight: 600 }}
    >
      {type}
    </span>
  );
}

/* ─── Section card: header (icon + title, slate-50 bg, divider) + content.
   Mirrors the Export modal's Partner-Details section pattern. ─── */
function SectionCard({
  icon: Icon,
  title,
  children,
  contentClassName = "px-4 py-3.5",
  headerRight,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
  contentClassName?: string;
  /** Optional element pinned to the right edge of the section header. */
  headerRight?: React.ReactNode;
}) {
  return (
    <div className="rounded-[12px] border bg-white overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
      {/* Section header */}
      <div className="px-4 py-2.5 flex items-center gap-2" style={{ backgroundColor: "#F8FAFC" }}>
        <Icon className="w-4 h-4 shrink-0" style={{ color: "#64748B" }} />
        <h3 className="text-[13px]" style={{ color: "#0F172A", fontWeight: 600 }}>
          {title}
        </h3>
        {headerRight && <div className="ml-auto shrink-0">{headerRight}</div>}
      </div>
      {/* Full-width divider */}
      <div className="border-t" style={{ borderColor: "#E2E8F0" }} />
      {/* Content */}
      <div className={contentClassName}>{children}</div>
    </div>
  );
}

/* ─── Resolve requester profile from users-data ─── */
function resolveRequester(name: string, fallback: { email: string; role: string }) {
  const u = allUsers.find((x) => x.fullName === name);
  if (u) {
    return {
      name: u.fullName,
      email: u.email,
      role: fallback.role || u.assignedRoles[0] || "Team Member",
      license: u.license,
      avatarUrl: USER_AVATAR_MAP[u.id] ?? null,
    };
  }
  return {
    name,
    email: fallback.email,
    role: fallback.role,
    license: "Field User",
    avatarUrl: null as string | null,
  };
}

/* ═══════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════ */
interface UserRequestDetailModalProps {
  request: UserRequestRow;
  onClose: () => void;
  /** Lifts approve action so the parent can update the row's status in place. */
  onApprove?: (request: UserRequestRow) => void;
  /** Lifts reject action so the parent can update the row's status in place. */
  onReject?: (request: UserRequestRow) => void;
}

export function UserRequestDetailModal({ request, onClose, onApprove, onReject }: UserRequestDetailModalProps) {
  const access = useAccessMode();
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const module = useMemo(
    () => PERMISSION_MODULES.find((m) => m.name === request.requestedFor),
    [request.requestedFor],
  );

  /* Resolve permissions, fallback to synthesized list when module/ids miss */
  const requestedPermissions = useMemo<Array<{ id: string; name: string }>>(() => {
    const ids = request.requestedPermissionIds ?? [];
    if (module) {
      const matched = ids
        .map((id) => module.permissions.find((p) => p.id === id))
        .filter((p): p is Permission => !!p)
        .map((p) => ({ id: p.id, name: p.name }));
      if (matched.length > 0) return matched;
    }
    // Fallback synthesized
    const base = [
      { id: "syn-1", name: `Access ${request.requestedFor} Module` },
      { id: "syn-2", name: "Create and Edit Records" },
      { id: "syn-3", name: "Approve and Manage Workflow" },
      { id: "syn-4", name: "Export and Bulk Actions" },
    ];
    const count = Math.max(1, Math.min(ids.length || 2, base.length));
    return base.slice(0, count);
  }, [module, request.requestedPermissionIds, request.requestedFor]);

  const requester = useMemo(
    () => resolveRequester(request.requestedBy, {
      email: request.email,
      role: request.role,
    }),
    [request.requestedBy, request.email, request.role],
  );

  const status = STATUS_CONFIG[request.status];
  const tint = getAvatarTint(requester.name);
  const initials = getInitials(requester.name);
  /* A persona that can view the queue but not act on it reads the request as a
   * resolved record: no decision footer, just the detail. */
  const isPending = request.status === "Pending" && access.canApproveRequests;

  const handleApprove = () => {
    if (onApprove) {
      onApprove(request);
    } else {
      toast.success(`Permission request approved`, {
        description: `Access to ${request.requestedFor} granted to ${requester.name}.`,
      });
    }
    onClose();
  };

  const confirmReject = () => {
    if (onReject) {
      onReject(request);
    } else {
      toast.error(`Permission request rejected`, {
        description: `Access to ${request.requestedFor} denied for ${requester.name}.`,
      });
    }
    setShowRejectConfirm(false);
    onClose();
  };

  const mainModal = (
    <ModalShell open={true} onClose={onClose}>
      <div
        className={`flex flex-col overflow-hidden transition-[max-width,max-height,width,height,border-radius] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          isFullScreen
            ? "w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] h-[calc(100vh-1.5rem)] max-h-[calc(100vh-1.5rem)] rounded-2xl lg:w-[calc(100vw-2rem)] lg:max-w-[calc(100vw-2rem)] lg:h-[calc(100vh-2rem)] lg:max-h-[calc(100vh-2rem)]"
            : "w-[720px] max-w-[calc(100vw-48px)] max-h-[min(820px,calc(100vh-48px))] rounded-2xl"
        }`}
        style={{
          boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)",
          backgroundColor: "#F8FAFC",
        }}
      >
        {/* ── Layer 1: HEADER (white) ── */}
        <div
          className="flex items-center justify-between px-5 py-3.5 shrink-0"
          style={{ backgroundColor: "#FFFFFF", borderBottom: "1px solid #EEF2F6" }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <h3 className="text-[16px] truncate" style={{ fontWeight: 500, color: "#0F172A" }}>
              Permission Request
            </h3>
            <span
              className="inline-flex items-center px-2.5 py-0.5 rounded-full border text-xs"
              style={{
                backgroundColor: status.bg,
                borderColor: status.border,
                color: status.text,
                fontWeight: 500,
              }}
            >
              {status.label}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setIsFullScreen((v) => !v)}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] border border-[#E2E8F0] bg-white text-xs text-[#475569] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-colors cursor-pointer"
              style={{ fontWeight: 500 }}
            >
              {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              {isFullScreen ? "Exit full" : "Full view"}
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[#94A3B8] hover:text-[#64748B] hover:bg-[#F1F5F9] transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Layer 2: CONTENT (slate) ── */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3">
          {/* Card 1: Requested By */}
          <SectionCard
            icon={User}
            title="Requested By"
            headerRight={
              <span
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border bg-white text-[11px]"
                style={{
                  borderColor: "#E2E8F0",
                  color: "#475569",
                  fontWeight: 500,
                  boxShadow: "0 1px 2px rgba(15,23,42,0.06)",
                }}
              >
                <Clock className="w-3 h-3 shrink-0" style={{ color: "#64748B" }} />
                Requested on {request.requestedOn}
              </span>
            }
          >
            <div className="flex items-center gap-3">
              {requester.avatarUrl ? (
                <img
                  src={requester.avatarUrl}
                  alt={requester.name}
                  className="w-10 h-10 rounded-full object-cover shrink-0"
                />
              ) : (
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-[12px]"
                  style={{ backgroundColor: tint.bg, color: tint.fg, fontWeight: 700 }}
                >
                  {initials}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[14px] truncate" style={{ fontWeight: 600, color: "#0F172A" }}>
                    {requester.name}
                  </span>
                  <LicenseBadge license={requester.license} showNoLicense />
                </div>
                <p
                  className="text-[12px] mt-0.5 truncate"
                  style={{ color: "#64748B", fontWeight: 400 }}
                >
                  {requester.email}
                </p>
              </div>
            </div>
          </SectionCard>

          {/* Card 2: Requested For */}
          <SectionCard icon={KeyRound} title="Requested For">
            <div className="text-[14px] mb-2.5" style={{ fontWeight: 500, color: "#0F172A" }}>
              {request.requestedFor}
            </div>
            <div className="flex flex-wrap gap-2">
              {requestedPermissions.map((perm) => {
                const action = inferActionType(perm.name, perm.id);
                return (
                  <div
                    key={perm.id}
                    className="inline-flex items-center gap-2 rounded-[8px] px-3 py-1.5"
                    style={{ backgroundColor: "#F8FAFC", border: "1px solid #F1F5F9" }}
                  >
                    <span
                      className="text-[13px]"
                      style={{ color: "#334155", fontWeight: 400 }}
                    >
                      {perm.name}
                    </span>
                    <ActionChip type={action} />
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {/* Card 3: Reason */}
          <SectionCard icon={FileText} title="Reason">
            <p
              className="text-[13px]"
              style={{ color: "#334155", lineHeight: 1.5, fontWeight: 400 }}
            >
              {request.reason}
            </p>
          </SectionCard>

        </div>

        {/* ── Layer 3: FOOTER (white) ── */}
        <div
          className="flex items-center justify-between gap-2.5 px-5 py-3.5 shrink-0"
          style={{ backgroundColor: "#FFFFFF", borderTop: "1px solid #EEF2F6" }}
        >
          {isPending ? (
            <>
              <button
                onClick={onClose}
                className="text-[13px] text-[#64748B] hover:text-[#0F172A] transition-colors cursor-pointer"
                style={{ fontWeight: 500 }}
              >
                Cancel
              </button>
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setShowRejectConfirm(true)}
                  className="h-9 px-4 rounded-[8px] text-[13px] text-white transition-all cursor-pointer shadow-sm"
                  style={{ backgroundColor: "#DC2626", fontWeight: 600 }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#B91C1C")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#DC2626")}
                >
                  Reject
                </button>
                <button
                  onClick={handleApprove}
                  className="h-9 px-4 rounded-[8px] text-[13px] text-white transition-all cursor-pointer shadow-sm inline-flex items-center gap-1.5"
                  style={{ backgroundColor: "#059669", fontWeight: 600 }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#047857")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#059669")}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Approve Request
                </button>
              </div>
            </>
          ) : (
            <>
              <div />
              <button
                onClick={onClose}
                className="h-9 px-4 rounded-[8px] border border-[#E2E8F0] bg-white text-[13px] text-[#334155] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                style={{ fontWeight: 500 }}
              >
                Close
              </button>
            </>
          )}
        </div>
      </div>
    </ModalShell>
  );

  return (
    <>
      {mainModal}
      <ModalShell open={showRejectConfirm} onClose={() => setShowRejectConfirm(false)} z={80}>
        <div
          className="bg-white rounded-xl border border-gray-200 overflow-hidden"
          style={{ width: 440, maxWidth: "calc(100vw - 48px)", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}
        >
          <div className="px-5 pt-5 pb-4 border-b border-[#F1F5F9] flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-[8px] flex items-center justify-center shrink-0"
              style={{ backgroundColor: "#FEF2F2" }}
            >
              <XCircle className="w-4 h-4" style={{ color: "#DC2626" }} />
            </div>
            <h3 style={{ fontSize: "15px", fontWeight: 600, color: "#0F172A" }}>Reject Request?</h3>
          </div>
          <div className="px-5 py-5">
            <p style={{ fontSize: "13.5px", color: "#334155", lineHeight: "1.6" }}>
              Rejecting this request will deny {requester.name}&apos;s access to {request.requestedFor}.
              You can reverse this decision at any time.
            </p>
          </div>
          <div
            className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t"
            style={{ borderColor: "#F1F5F9", backgroundColor: "#FAFBFC" }}
          >
            <button
              onClick={() => setShowRejectConfirm(false)}
              className="h-9 px-4 rounded-[8px] border border-[#E2E8F0] bg-white text-[13px] text-[#334155] cursor-pointer hover:bg-[#F8FAFC] transition-colors"
              style={{ fontWeight: 500 }}
            >
              Cancel
            </button>
            <button
              onClick={confirmReject}
              className="h-9 px-4 rounded-[8px] text-[13px] text-white cursor-pointer transition-colors"
              style={{ backgroundColor: "#DC2626", fontWeight: 600 }}
            >
              Reject Request
            </button>
          </div>
        </div>
      </ModalShell>
    </>
  );
}

