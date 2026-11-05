/* ═══════════════════════════════════════════════════════════════
   Purchase Request — detail view (requester side)

   Layout ported from this repo's own PO detail page
   (`PurchaseOrderDraft.tsx`) — the direct-fit template Ahtisham
   asked us to reuse. Same shell as Partners' VendorDetailsPage:

     ┌ AppShell ─────────────────────────────────────────────┐
     │  Single scroll container (bg-slate-50)                │
     │  ┌ Sticky unified card ─────────────────────────────┐ │
     │  │  Row 1: BackButton + 44×44 item avatar + PR#     │ │
     │  │          + Status pill + Urgency pill + actions  │ │
     │  │  Middle: Horizontal progress stepper             │ │
     │  └───────────────────────────────────────────────────┘ │
     │  ┌ Body — 1fr / 300px sidebar grid ─────────────────┐ │
     │  │  Left column      │  Right column                 │ │
     │  │  - Item card      │  - Requester chip             │ │
     │  │  - Attachments    │  - Details meta card          │ │
     │  │                   │  - Reason                     │ │
     │  │                   │  - Configuration flag         │ │
     │  │                   │  - PO-created success (if any)│ │
     │  └───────────────────────────────────────────────────┘ │
     └───────────────────────────────────────────────────────┘

   The stepper is a PR-flavoured LifecycleTracker: three steps
   (Submitted → Buyer review → PO Created) with the middle step
   rendered as Deferred / Denied when the buyer has acted but no
   PO exists yet.
   ═══════════════════════════════════════════════════════════════ */

"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Clock,
  XCircle,
  PauseCircle,
  ClipboardEdit,
  Package,
  Calendar,
  Info,
  Paperclip,
  ExternalLink,
  Wrench,
  ArrowRight,
  FileText,
  Maximize2,
  Minimize2,
  User,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";
import { FONT, typography } from "./designTokens";
import { CATALOG } from "./catalogData";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import TruncatedItemName from "./TruncatedItemName";
import AppShell from "./layout/AppShell";
import TopBar from "./layout/TopBar";
import { toast } from "sonner";
import {
  getPRById,
  updatePRStatus,
  URGENCY_META,
  STATUS_META,
  CONFIG_TARGET_LABEL,
  formatPRDate,
  formatPRDateRange,
  type PRStatus,
  type PurchaseRequest,
} from "./prData";
import { createPOFromBuyNow } from "./poStore";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";

/* ═══════════════════════════════════════════════════════════════
   Layout tokens — same values PurchaseOrderDraft.tsx uses so the
   two detail pages line up when opened side-by-side.
   ═══════════════════════════════════════════════════════════════ */

const DETAIL_PX = "px-4 lg:px-6 xl:px-8";
const MAX_WIDTH_NORMAL = "max-w-[1520px]";
const MAX_WIDTH_FULL = "max-w-none";
const MORPH_TRANSITION = "all 250ms cubic-bezier(0.4, 0, 0.2, 1)";

/* Column-header typography — Partners' compact-table caption ladder.
   Verbatim from `PurchaseOrderDraft.tsx:1220`. */
const COL_HEADER: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  lineHeight: "16px",
  fontFamily: FONT,
  letterSpacing: "0.04em",
  textTransform: "uppercase" as const,
  color: "#64748B",
};

/* ═══════════════════════════════════════════════════════════════
   Progress stepper — 3 steps modelled on `LifecycleTracker`.
   ═══════════════════════════════════════════════════════════════ */

interface StepDef {
  key: "submitted" | "po-created";
  label: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}

/* Two-node timeline: request lifecycle is Submitted → PO Created.
   The old three-step model (Submitted · Buyer review · PO Created)
   turned the middle node into a shape-shifter — Deferred / Denied /
   Buyer review all rode on the same dot. The buyer-review state
   isn't a discrete stage, and terminal states (Deferred / Denied)
   are better surfaced as a chip on the connector than as a fake
   step. See `ProgressStepper` for the terminal-chip treatment. */
const STEPS: StepDef[] = [
  { key: "submitted", label: "Submitted", icon: Clock },
  { key: "po-created", label: "PO Created", icon: CheckCircle2 },
];

interface StatusPalette {
  solid: string;
  tint: string;
  glow: string;
}

const STATUS_PALETTES: Record<PRStatus, StatusPalette> = {
  submitted: {
    solid: "hsl(var(--primary))",
    tint: "color-mix(in srgb, hsl(var(--primary)) 12%, transparent)",
    glow: "color-mix(in srgb, hsl(var(--primary)) 16%, transparent)",
  },
  deferred: {
    solid: "#B45309",
    tint: "color-mix(in srgb, #B45309 10%, transparent)",
    glow: "color-mix(in srgb, #B45309 16%, transparent)",
  },
  denied: {
    solid: "hsl(var(--destructive))",
    tint: "color-mix(in srgb, hsl(var(--destructive)) 10%, transparent)",
    glow: "color-mix(in srgb, hsl(var(--destructive)) 16%, transparent)",
  },
  "po-created": {
    solid: "hsl(var(--success))",
    tint: "color-mix(in srgb, hsl(var(--success)) 12%, transparent)",
    glow: "color-mix(in srgb, hsl(var(--success)) 16%, transparent)",
  },
};

function ProgressStepper({ pr }: { pr: PurchaseRequest }) {
  const isCompleted = pr.status === "po-created";
  const isDenied = pr.status === "denied";
  const isDeferred = pr.status === "deferred";
  const isTerminal = isDenied || isDeferred;

  const doneSolid = isCompleted ? "hsl(var(--success))" : "hsl(var(--primary))";
  const doneTint = isCompleted
    ? "color-mix(in srgb, hsl(var(--success)) 12%, transparent)"
    : "color-mix(in srgb, hsl(var(--primary)) 12%, transparent)";
  const submittedPalette = STATUS_PALETTES.submitted;

  /* Connector tone reflects the PR's live state:
       · submitted  → primary dashed (in progress toward PO)
       · po-created → success solid   (both nodes done)
       · deferred   → amber dashed + Deferred chip
       · denied     → destructive dashed + Denied chip */
  const connectorSolid =
    pr.status === "po-created"
      ? "hsl(var(--success))"
      : isDenied
        ? "hsl(var(--destructive))"
        : isDeferred
          ? "#B45309"
          : "hsl(var(--primary))";
  const connectorGlow =
    pr.status === "po-created"
      ? "color-mix(in srgb, hsl(var(--success)) 16%, transparent)"
      : isDenied
        ? "color-mix(in srgb, hsl(var(--destructive)) 16%, transparent)"
        : isDeferred
          ? "color-mix(in srgb, #B45309 16%, transparent)"
          : "color-mix(in srgb, hsl(var(--primary)) 16%, transparent)";
  const chipLabel = isDenied ? "Denied" : isDeferred ? "Deferred" : null;
  const ChipIcon = isDenied ? XCircle : isDeferred ? PauseCircle : null;

  return (
    <div className="relative w-full" style={{ minHeight: 48 }}>
      <div className="relative flex items-center w-full h-full py-2 gap-0">
        {STEPS.map((step, idx) => {
          const isLeft = idx === 0;
          const isRight = idx === STEPS.length - 1;
          /* Submitted node is done as soon as the PR exists; PO
             Created node is done only when status flips to po-created.
             In terminal states (Deferred / Denied) Submitted is done
             but PO Created stays pending — the chip on the connector
             explains why. There's no "current" (blue-active) styling
             for the future node: two-step model means every node is
             either done (blue/green) or pending (grey outline).
             Feedback (2026-07-08): PO Created was reading as
             selected/active when the PR was still Submitted — grey
             pending is the truthful signal. */
          const done = isLeft ? true : isCompleted;
          const current = false;
          const StepIcon = step.icon;
          const activePalette = isRight ? submittedPalette : submittedPalette;

          return (
            <React.Fragment key={step.key}>
              <div className="flex items-center gap-2 shrink-0">
                <div
                  className="flex items-center justify-center rounded-full shrink-0"
                  style={{
                    width: current ? 24 : done ? 22 : 20,
                    height: current ? 24 : done ? 22 : 20,
                    ...(done
                      ? {
                          backgroundColor: doneSolid,
                          boxShadow: `0 2px 6px ${doneTint}`,
                        }
                      : current
                        ? {
                            backgroundColor: activePalette.solid,
                            boxShadow: `0 0 0 3px ${activePalette.glow}, 0 2px 8px color-mix(in srgb, hsl(var(--foreground)) 8%, transparent)`,
                          }
                        : {
                            backgroundColor: "transparent",
                            border: "1.5px solid hsl(var(--border))",
                          }),
                    transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                >
                  {done ? (
                    <Check
                      className="size-2.5"
                      style={{ color: "hsl(var(--primary-foreground))", strokeWidth: 3 }}
                    />
                  ) : current ? (
                    <StepIcon
                      className="size-3"
                      style={{ color: "hsl(var(--primary-foreground))", strokeWidth: 2.5 }}
                    />
                  ) : (
                    <StepIcon
                      className="size-2.5"
                      style={{
                        color: "hsl(var(--muted-foreground))",
                        opacity: 0.35,
                        strokeWidth: 2,
                      }}
                    />
                  )}
                </div>
                <span
                  className="whitespace-nowrap"
                  style={{
                    fontSize: 12.5,
                    fontFamily: FONT,
                    fontWeight: done || current ? 600 : 500,
                    color: done
                      ? doneSolid
                      : current
                        ? "hsl(var(--foreground))"
                        : isTerminal && isRight
                          ? "hsl(var(--muted-foreground))"
                          : "hsl(var(--muted-foreground))",
                    opacity: done || current ? 1 : 0.65,
                    letterSpacing: "0.005em",
                    transition: "all 0.3s ease",
                  }}
                >
                  {step.label}
                </span>
              </div>
              {!isRight && (
                <div
                  className="flex-1 mx-3 min-w-[80px] relative"
                  style={{ height: 20 }}
                >
                  {/* Base connector line — solid green when done, else
                      a dashed lane in the current state's colour. */}
                  <div
                    className="absolute inset-x-0"
                    style={{
                      top: "50%",
                      transform: "translateY(-50%)",
                      height: isCompleted ? 2 : 2.5,
                      backgroundColor: connectorSolid,
                      opacity: isCompleted ? 1 : isTerminal ? 0.5 : 0.55,
                      borderRadius: 999,
                      ...(!isCompleted && {
                        WebkitMaskImage:
                          "repeating-linear-gradient(90deg, black 0px, black 8px, transparent 8px, transparent 14px)",
                        maskImage:
                          "repeating-linear-gradient(90deg, black 0px, black 8px, transparent 8px, transparent 14px)",
                      }),
                    }}
                  />
                  {/* Terminal chip — sits centred on the connector for
                      Deferred / Denied. Explains WHY PO Created hasn't
                      happened without needing a fake middle step. */}
                  {chipLabel && ChipIcon && (
                    <div
                      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 inline-flex items-center gap-1 rounded-full px-2 py-0.5"
                      style={{
                        backgroundColor: "hsl(var(--card))",
                        border: `1px solid ${connectorSolid}`,
                        boxShadow: `0 1px 4px ${connectorGlow}`,
                        fontFamily: FONT,
                      }}
                    >
                      <ChipIcon
                        className="size-3"
                        style={{ color: connectorSolid, strokeWidth: 2.5 }}
                      />
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 600,
                          letterSpacing: "0.02em",
                          color: connectorSolid,
                          lineHeight: "14px",
                        }}
                      >
                        {chipLabel}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Header gradient — status-tinted radial wash on the card, same
   recipe PurchaseOrderDraft uses (bottom-anchored ellipse + soft
   linear).
   ═══════════════════════════════════════════════════════════════ */

function getHeaderGradient(status: PRStatus): string | null {
  const palette = STATUS_PALETTES[status];
  if (!palette) return null;
  // Center anchor tracks the "progress" — submitted early, po-created late
  const anchor =
    status === "submitted" ? 20 : status === "po-created" ? 85 : 50;
  return `
    radial-gradient(
      ellipse 90% 60% at ${anchor}% 100%,
      color-mix(in srgb, ${palette.solid} 5%, transparent) 0%,
      color-mix(in srgb, ${palette.solid} 2%, transparent) 55%,
      transparent 90%
    ),
    linear-gradient(180deg,
      color-mix(in srgb, ${palette.solid} 1%, transparent) 0%,
      color-mix(in srgb, ${palette.solid} 1.5%, transparent) 55%,
      color-mix(in srgb, ${palette.solid} 3%, transparent) 100%
    )`;
}

/* ═══════════════════════════════════════════════════════════════
   SectionCard — verbatim port of PurchaseOrderDraft.tsx's
   `SectionCard`. Header uses the "icon-tile + 13/600 title"
   pattern from Partners. Right-side action slot mirrors PO's
   Add-Items / edit CTAs. Body has zero inner padding by default
   so consumers can hang tables (line items) flush to the edges.
   ═══════════════════════════════════════════════════════════════ */

function SectionCard({
  icon: Icon,
  title,
  action,
  children,
  bodyPadded = true,
  collapsible = false,
  defaultOpen = true,
  toneBorderColor,
  toneHeaderBg,
  toneTitleColor,
  toneIconBg,
  toneIconColor,
}: {
  icon: React.ElementType;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  /** When false, body renders flush (no padding) so tables can hang. */
  bodyPadded?: boolean;
  /** When true, header becomes a click target that toggles a chevron
   *  and slides the body open/closed — mirrors PO sidebar's
   *  `CollapsibleSection`. */
  collapsible?: boolean;
  defaultOpen?: boolean;
  /** Optional status-tinted overrides (used by the amber
   *  Configuration-flag + emerald PO-created cards). */
  toneBorderColor?: string;
  toneHeaderBg?: string;
  toneTitleColor?: string;
  toneIconBg?: string;
  toneIconColor?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const headerContents = (
    <>
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className={`flex items-center justify-center w-7 h-7 rounded-md shrink-0 ${
            toneIconBg ? "" : "bg-accent"
          }`}
          style={toneIconBg ? { backgroundColor: toneIconBg } : undefined}
        >
          <Icon
            className="size-3.5"
            style={{ color: toneIconColor ?? "hsl(var(--primary))" }}
          />
        </div>
        <span
          className="truncate"
          style={{
            fontSize: 13,
            fontWeight: 600,
            lineHeight: 1.35,
            fontFamily: FONT,
            color: toneTitleColor ?? "hsl(var(--foreground))",
          }}
        >
          {title}
        </span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {action}
        {collapsible && (
          <ChevronDown
            className="w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
          />
        )}
      </div>
    </>
  );

  const shellStyle: React.CSSProperties = {
    borderColor: toneBorderColor ?? "hsl(var(--border))",
  };

  const headerBorderColor = toneBorderColor ?? "hsl(var(--border))";

  if (collapsible) {
    return (
      <div
        className="rounded-xl border bg-card overflow-hidden"
        style={{
          ...shellStyle,
          backgroundColor: toneHeaderBg ? undefined : undefined,
        }}
      >
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <button
              className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-[#FAFBFC] transition-colors cursor-pointer"
              style={{
                borderBottom: open ? `1px solid ${headerBorderColor}` : "none",
                backgroundColor: toneHeaderBg ?? undefined,
              }}
            >
              {headerContents}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className={bodyPadded ? "p-4" : ""}>{children}</div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden" style={shellStyle}>
      <div
        className="flex items-center justify-between gap-3 px-4 py-3 border-b"
        style={{ borderColor: headerBorderColor, backgroundColor: toneHeaderBg ?? undefined }}
      >
        {headerContents}
      </div>
      <div className={bodyPadded ? "p-4" : ""}>{children}</div>
    </div>
  );
}

/* ── Small sidebar field row — mirrors PO's `FieldRow` recipe
       (10/500 slate-400 label + 13/500 value beneath). Used inside
       the right-column meta cards so labels stay compact and
       values remain the primary read. ─────────────────────────── */

function SidebarField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <p
        className="text-slate-400"
        style={{ fontSize: 10, fontWeight: 500, fontFamily: FONT, letterSpacing: "0.02em" }}
      >
        {label}
      </p>
      <div className="text-foreground" style={{ fontSize: 13, fontWeight: 500, lineHeight: "18px", fontFamily: FONT }}>
        {children}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Page
   ═══════════════════════════════════════════════════════════════ */

export default function PurchaseRequestDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  /* Buyer-side context — set by the planner's source pill when it
     routes here with `?from=planner`. Governs whether the Defer /
     Deny / Create PO action cluster surfaces in the header. */
  const fromPlanner = searchParams.get("from") === "planner";
  /* Reactive PR snapshot — bumped after any updatePRStatus call so
     the page re-renders with the new status without needing a
     navigation. `bumpRev` counts state transitions we've made
     locally; the underlying MY_PRS array is the source of truth. */
  const [rev, setRev] = useState(0);
  const pr = useMemo(() => (id ? getPRById(id) : undefined), [id, rev]);
  /* Reason-prompt modal state for Defer + Deny. Create PO doesn't
     need a reason prompt — it acts immediately (Buy Now-style). */
  const [reasonModal, setReasonModal] = useState<null | {
    mode: "defer" | "deny";
  }>(null);
  const [reasonText, setReasonText] = useState("");
  const [submittingAction, setSubmittingAction] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  /* Fullscreen toggle — mirrors PO detail page's isFullscreen state.
     Swaps the max-width cap on the header card + body so the content
     expands to fill the viewport when on. */
  const [isFullscreen, setIsFullscreen] = useState(false);
  const maxWidthClass = isFullscreen ? MAX_WIDTH_FULL : MAX_WIDTH_NORMAL;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => setIsScrolled(!entry.isIntersecting));
      },
      { threshold: 0 },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [pr]);

  /* Only submitted PRs are actionable from the planner. Any other
     status renders the timeline / reason banner instead of the
     buyer-side actions cluster. */
  const canAct = fromPlanner && pr?.status === "submitted";

  const submitReasonAction = () => {
    if (!pr || !reasonModal) return;
    const trimmed = reasonText.trim();
    if (!trimmed) {
      toast.error("Add a short note explaining the decision", {
        style: { fontFamily: FONT },
      });
      return;
    }
    setSubmittingAction(true);
    setTimeout(() => {
      const nextStatus: PRStatus =
        reasonModal.mode === "defer" ? "deferred" : "denied";
      updatePRStatus(pr.id, nextStatus, { note: trimmed });
      toast.success(
        nextStatus === "deferred"
          ? "Request deferred"
          : "Request denied",
        {
          description: `${pr.id} · note saved to the request history`,
          style: { fontFamily: FONT },
        },
      );
      setReasonModal(null);
      setReasonText("");
      setSubmittingAction(false);
      setRev((n) => n + 1);
    }, 160);
  };

  const handleCreatePO = () => {
    if (!pr) return;
    /* Pick the first catalogue-backed line item — for MVP the
       generated Draft PO carries one item; new-item lines are noted
       and skipped. A future iteration can bulk-create per line. */
    const firstCat = pr.lineItems.find((li) => li.itemId);
    if (!firstCat || !firstCat.itemId) {
      toast.error(
        "No catalog items on this request. Create a PO manually.",
        { style: { fontFamily: FONT } },
      );
      return;
    }
    const cat = CATALOG.find((c) => c.id === firstCat.itemId);
    if (!cat) {
      toast.error("Item not found in the catalog", {
        style: { fontFamily: FONT },
      });
      return;
    }
    setSubmittingAction(true);
    setTimeout(() => {
      const now = new Date();
      const shipBy = new Date(now.getTime() + 7 * 86400000);
      const dueDelivery = new Date(pr.needBy + "T00:00:00");
      const fmt = (d: Date) => d.toISOString().split("T")[0];
      const po = createPOFromBuyNow(
        {
          id: cat.id,
          itemNumber: cat.itemNumber,
          descriptiveName: cat.descriptiveName,
          image: cat.image,
          unitPrice: firstCat.estimatedUnitPrice ?? cat.listPriceUsd ?? cat.unitPrice,
          vendorUOM: cat.vendorUOM,
          vendorUOMQty: cat.vendorUOMQty,
          defaultUOM: cat.defaultUOM,
          discount: cat.discount,
          partnerLocation:
            firstCat.preferredVendor || cat.partnerLocation,
          category: cat.category,
        },
        {
          vendorQty: firstCat.quantity,
          quantity: firstCat.quantity,
          shipByDate: fmt(shipBy),
          shipmentMethod: "Ground",
          needByDate: isNaN(dueDelivery.getTime())
            ? fmt(new Date(now.getTime() + 14 * 86400000))
            : fmt(dueDelivery),
          inboundLocation: "Main Warehouse",
          contactName: pr.requester.name,
          contactEmail: "",
          contactPhone: "",
          notes: `Created from ${pr.id} — ${pr.reason}`,
          totalPrice:
            firstCat.quantity *
            (firstCat.estimatedUnitPrice ?? cat.listPriceUsd ?? cat.unitPrice),
        },
        // Request prices are USD estimates; the PO converts them to the vendor's currency.
        "USD",
      );
      updatePRStatus(pr.id, "po-created", { poRef: po.id });
      toast.success(`Draft PO ${po.poNumber} created`, {
        description: `${pr.id} marked as PO Created`,
        style: { fontFamily: FONT },
      });
      setSubmittingAction(false);
      setRev((n) => n + 1);
      navigate(`/purchase-orders/${po.id}`);
    }, 180);
  };

  if (!pr) {
    return (
      <AppShell>
        <TopBar
          breadcrumbs={[
            { label: "Supply Chain Management", onClick: () => navigate("/") },
            { label: "Purchase Requests", onClick: () => navigate("/purchase-requests") },
            { label: "Not found" },
          ]}
          showSearch
          searchPlaceholder="Search..."
          showCreateButton={false}
        />
        <div className="flex-1 flex items-center justify-center bg-slate-50" style={{ fontFamily: FONT }}>
          <div className="flex flex-col items-center gap-3 max-w-[400px] text-center px-6">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center bg-card"
              style={{ color: "hsl(var(--muted-foreground))" }}
            >
              <ClipboardEdit className="w-5 h-5" />
            </div>
            <h1 style={{ ...typography.heading, color: "hsl(var(--foreground))" }}>
              Request not found
            </h1>
            <p style={{ ...typography.uiCaption, color: "hsl(var(--muted-foreground))" }}>
              This purchase request no longer exists, or the URL is off.
            </p>
            <button
              type="button"
              onClick={() => navigate("/purchase-requests")}
              className="mt-2 h-9 px-3 rounded-lg text-white"
              style={{
                backgroundColor: "hsl(var(--primary))",
                ...typography.uiLabel,
                fontWeight: 600,
              }}
            >
              Back to Purchase Requests
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  /* Aggregate helpers — the detail page shows the first item in
     the sticky-header summary and iterates all line items in the
     table below. */
  const lineItems = pr.lineItems;
  const firstLine = lineItems[0];
  const firstItem = firstLine?.itemId
    ? CATALOG.find((c) => c.id === firstLine.itemId)
    : undefined;
  const displayName =
    firstItem?.descriptiveName.split(" — ")[0] ?? firstLine?.newItemName ?? "—";
  const totalUnits = lineItems.reduce((sum, li) => sum + li.quantity, 0);
  const totalEstimated = lineItems.reduce(
    (sum, li) => sum + (li.estimatedUnitPrice ?? 0) * li.quantity,
    0,
  );
  const uniquePreferredVendors = Array.from(
    new Set(lineItems.map((li) => li.preferredVendor).filter(Boolean)),
  ) as string[];

  const urgencyMeta = URGENCY_META[pr.urgency];
  const statusMeta = STATUS_META[pr.status];
  const statusPalette = STATUS_PALETTES[pr.status];
  const headerGradient = getHeaderGradient(pr.status);
  const cardBorderColor = statusPalette
    ? `color-mix(in srgb, ${statusPalette.solid} 15%, hsl(var(--border)))`
    : "hsl(var(--border))";

  const poCreatedEntry = pr.history.find((h) => h.status === "po-created");
  const buyerNoteEntry = pr.history.find(
    (h) => h.status === "denied" || h.status === "deferred",
  );

  return (
    <AppShell>
      <TopBar
        breadcrumbs={[
          { label: "Supply Chain Management", onClick: () => navigate("/") },
          { label: "Purchase Requests", onClick: () => navigate("/purchase-requests") },
          { label: pr.id },
        ]}
        showSearch
        searchPlaceholder="Search..."
        showCreateButton={false}
      />
      <div
        ref={scrollContainerRef}
        className="flex flex-col h-full bg-slate-50 overflow-y-auto animate-page-fade-in"
        style={{ fontFamily: FONT }}
      >
        {/* IntersectionObserver sentinel — drives the header morph */}
        <div ref={sentinelRef} className="shrink-0 h-px" />

        {/* ══════════ STICKY HEADER CARD ══════════ */}
        <div className="shrink-0 sticky top-0 z-20 bg-slate-50">
          <div className={`${DETAIL_PX} pt-3 pb-1 lg:pt-4 lg:pb-1`}>
            <div className={`${maxWidthClass} mx-auto`}>
              <div
                className="rounded-xl"
                style={{
                  overflow: "visible",
                  background: headerGradient
                    ? `${headerGradient}, hsl(var(--card))`
                    : "hsl(var(--card))",
                  border: `1px solid ${cardBorderColor}`,
                  boxShadow: "0 1px 3px 0 rgba(0,0,0,0.04), 0 1px 2px -1px rgba(0,0,0,0.03)",
                  transition: MORPH_TRANSITION,
                }}
              >
                {/* Row 1 — Back + Avatar + Title + Pills + Actions */}
                <div
                  className="px-4 lg:px-5"
                  style={{
                    paddingTop: isScrolled ? 8 : 12,
                    paddingBottom: isScrolled ? 8 : 12,
                    borderRadius: "12px 12px 0 0",
                    transition: MORPH_TRANSITION,
                  }}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Back button — Partners' 44/32 morph */}
                      <button
                        type="button"
                        onClick={() => navigate("/purchase-requests")}
                        className="flex-shrink-0 flex items-center justify-center rounded-xl border border-border bg-white hover:bg-slate-50 shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_1px_2px_-1px_rgba(0,0,0,0.03)]"
                        style={{
                          width: isScrolled ? 32 : 44,
                          height: isScrolled ? 32 : 44,
                          transition: MORPH_TRANSITION,
                        }}
                        aria-label="Back to Purchase Requests"
                      >
                        <ChevronLeft
                          className="text-slate-400"
                          style={{
                            width: isScrolled ? 16 : 20,
                            height: isScrolled ? 16 : 20,
                            transition: MORPH_TRANSITION,
                          }}
                        />
                      </button>

                      {/* Item thumbnail — first line item stands in for
                          the whole PR in the sticky header. */}
                      {firstItem ? (
                        <img
                          src={firstItem.image}
                          alt=""
                          className="flex-shrink-0 rounded-xl object-cover border border-border shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_1px_2px_-1px_rgba(0,0,0,0.03)]"
                          style={{
                            width: isScrolled ? 32 : 44,
                            height: isScrolled ? 32 : 44,
                            transition: MORPH_TRANSITION,
                          }}
                        />
                      ) : (
                        <div
                          className="flex-shrink-0 flex items-center justify-center rounded-xl"
                          style={{
                            width: isScrolled ? 32 : 44,
                            height: isScrolled ? 32 : 44,
                            backgroundColor: "hsl(var(--accent))",
                            border: "1px solid hsl(var(--border))",
                            boxShadow: "0 1px 3px 0 rgba(0,0,0,0.04), 0 1px 2px -1px rgba(0,0,0,0.03)",
                            transition: MORPH_TRANSITION,
                          }}
                        >
                          <Package
                            style={{
                              width: isScrolled ? 14 : 20,
                              height: isScrolled ? 14 : 20,
                              color: "hsl(var(--primary))",
                              transition: MORPH_TRANSITION,
                            }}
                          />
                        </div>
                      )}

                      {/* Info block */}
                      <div
                        className="flex items-center flex-wrap min-w-0"
                        style={{ gap: isScrolled ? 6 : 8, transition: MORPH_TRANSITION }}
                      >
                        <h1
                          className="flex-shrink-0 truncate text-foreground"
                          style={{
                            fontSize: isScrolled ? 13 : 16,
                            fontWeight: isScrolled ? 600 : 700,
                            lineHeight: isScrolled ? "18px" : "22px",
                            fontFamily: FONT,
                            margin: 0,
                            transition: MORPH_TRANSITION,
                          }}
                        >
                          {pr.id}
                        </h1>
                        {/* Status pill */}
                        <span
                          className="inline-flex items-center gap-1 rounded-md border"
                          style={{
                            padding: isScrolled ? "1px 6px" : "2px 8px",
                            fontSize: isScrolled ? 10 : 11,
                            fontWeight: 600,
                            lineHeight: 1.35,
                            backgroundColor: statusMeta.bg,
                            color: statusMeta.fg,
                            borderColor: statusMeta.border,
                            fontFamily: FONT,
                            transition: MORPH_TRANSITION,
                          }}
                        >
                          {statusMeta.label}
                        </span>
                        {/* Urgency pill */}
                        <span
                          className="inline-flex items-center gap-1 rounded-md border"
                          style={{
                            padding: isScrolled ? "1px 6px" : "2px 8px",
                            fontSize: isScrolled ? 10 : 11,
                            fontWeight: 600,
                            lineHeight: 1.35,
                            backgroundColor: urgencyMeta.bg,
                            color: urgencyMeta.fg,
                            borderColor: urgencyMeta.border,
                            fontFamily: FONT,
                            transition: MORPH_TRANSITION,
                          }}
                        >
                          {urgencyMeta.label} urgency
                        </span>
                        {/* Subtitle — only expanded */}
                        {!isScrolled && (
                          <span
                            className="text-slate-500 truncate"
                            style={{ fontSize: 12, fontFamily: FONT }}
                          >
                            · {displayName}
                            {lineItems.length > 1
                              ? ` +${lineItems.length - 1} more`
                              : firstLine
                                ? ` · ${firstLine.quantity} ${firstLine.uom}`
                                : ""}
                            {" · Need by "}
                            {formatPRDateRange(pr.needBy, pr.needByEnd)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right — action buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Planner-source actions — only when the buyer
                          navigated here from the planner's Request pill
                          and the PR is still Submitted. Once deferred/
                          denied/po-created they disappear (the status
                          banner takes over). */}
                      {canAct && (
                        <>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setReasonText("");
                              setReasonModal({ mode: "defer" });
                            }}
                            disabled={submittingAction}
                            className="h-9 gap-1.5 rounded-lg border-amber-200 bg-amber-50 text-amber-800 hover:bg-[#FEF3C7] hover:border-[#FCD34D] cursor-pointer text-[12.5px] shrink-0"
                            style={{ fontWeight: 600 }}
                            title="Defer this request"
                          >
                            <PauseCircle className="w-3.5 h-3.5" />
                            Defer
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setReasonText("");
                              setReasonModal({ mode: "deny" });
                            }}
                            disabled={submittingAction}
                            className="h-9 gap-1.5 rounded-lg border-red-200 bg-red-50 text-destructive hover:bg-red-100 hover:border-[#FCA5A5] cursor-pointer text-[12.5px] shrink-0"
                            style={{ fontWeight: 600 }}
                            title="Deny this request"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Deny
                          </Button>
                          <Button
                            onClick={handleCreatePO}
                            disabled={submittingAction}
                            className="h-9 gap-1.5 rounded-lg cursor-pointer text-[12.5px] shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{ fontWeight: 600 }}
                            title="Create a draft PO from this request"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Create PO
                          </Button>
                          <div className="w-px h-5 bg-border/60 shrink-0" />
                        </>
                      )}
                      {/* Fullscreen toggle — verbatim from PO detail
                          page. Swaps the max-width cap on the header
                          card + body so the content expands to fill
                          the viewport when on. Icon toggles Maximize2
                          ↔ Minimize2 to match. */}
                      <button
                        type="button"
                        onClick={() => setIsFullscreen((v) => !v)}
                        className="rounded-lg border border-border bg-white hover:bg-slate-50 flex items-center justify-center shadow-sm shrink-0"
                        style={{
                          width: isScrolled ? 32 : 36,
                          height: isScrolled ? 32 : 36,
                          transition: MORPH_TRANSITION,
                        }}
                        aria-label={isFullscreen ? "Exit full screen" : "Full screen"}
                        title={isFullscreen ? "Exit full screen" : "Full screen"}
                      >
                        {isFullscreen ? (
                          <Minimize2
                            className="text-slate-500"
                            style={{
                              width: isScrolled ? 14 : 16,
                              height: isScrolled ? 14 : 16,
                              transition: MORPH_TRANSITION,
                            }}
                          />
                        ) : (
                          <Maximize2
                            className="text-slate-500"
                            style={{
                              width: isScrolled ? 14 : 16,
                              height: isScrolled ? 14 : 16,
                              transition: MORPH_TRANSITION,
                            }}
                          />
                        )}
                      </button>
                      {poCreatedEntry?.poRef && (
                        <a
                          href={`/purchase-orders/${poCreatedEntry.poRef}`}
                          className="inline-flex items-center gap-1.5 rounded-lg text-white shadow-sm"
                          style={{
                            height: isScrolled ? 32 : 36,
                            padding: isScrolled ? "0 12px" : "0 14px",
                            fontSize: isScrolled ? 12 : 13,
                            fontWeight: 600,
                            backgroundColor: "#166534",
                            fontFamily: FONT,
                            transition: MORPH_TRANSITION,
                          }}
                        >
                          <ExternalLink
                            style={{
                              width: isScrolled ? 12 : 14,
                              height: isScrolled ? 12 : 14,
                            }}
                          />
                          View {poCreatedEntry.poRef}
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Middle — Progress stepper (same slot as PO's LifecycleTracker) */}
                <div className="px-5 pb-2.5 pt-0.5">
                  <ProgressStepper pr={pr} />
                </div>
              </div>
            </div>
          </div>

          {/* Bottom gradient fade — same recipe as PO detail page */}
          <div
            className="pointer-events-none transition-opacity duration-300"
            style={{
              height: 8,
              background:
                "linear-gradient(to bottom, rgba(248,250,252,0.8) 0%, rgba(248,250,252,0.4) 40%, rgba(248,250,252,0) 100%)",
              opacity: isScrolled ? 1 : 0,
            }}
          />
        </div>

        {/* ══════════ BUYER-ACTION BANNER (Denied / Deferred) ══════════ */}
        {buyerNoteEntry?.note && (
          <div className={DETAIL_PX}>
            <div className={`${maxWidthClass} mx-auto pt-4`}>
              <div
                className="flex items-start gap-3 rounded-md border bg-white shadow-sm px-4 py-3"
                style={{ borderColor: "hsl(var(--border))" }}
              >
                <div
                  className="flex items-center justify-center shrink-0 rounded-md border"
                  style={{
                    width: 28,
                    height: 28,
                    backgroundColor: statusMeta.bg,
                    borderColor: statusMeta.border,
                    marginTop: 1,
                  }}
                >
                  {pr.status === "denied" ? (
                    <XCircle style={{ width: 14, height: 14, color: statusMeta.fg }} />
                  ) : (
                    <PauseCircle style={{ width: 14, height: 14, color: statusMeta.fg }} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span
                    className="text-foreground block"
                    style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4, fontFamily: FONT }}
                  >
                    Purchasing owner {pr.status === "denied" ? "denied" : "deferred"} this request on{" "}
                    {formatPRDate(buyerNoteEntry.at)}
                  </span>
                  <span
                    className="block mt-0.5"
                    style={{
                      fontSize: 12,
                      fontWeight: 400,
                      color: "#64748B",
                      lineHeight: 1.4,
                      fontFamily: FONT,
                    }}
                  >
                    {buyerNoteEntry.note}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════ BODY — 2-column grid (matches PO detail page) ══════════ */}
        <div className="flex-1">
          <div className={`${DETAIL_PX} pt-3 pb-5`}>
            <div
              className={`${maxWidthClass} mx-auto grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 items-start`}
            >
              {/* ━━━━━━ LEFT COLUMN ━━━━━━ */}
              <div className="flex flex-col gap-5 min-w-0 overflow-hidden">
                {/* ── Line Items — one row per PRLineItem. Header shows
                     item / units counter chips; body is a grid table
                     with row-number + thumbnail + item# + description
                     + right-aligned qty/price/total. Est. total row
                     sums each line's price × qty. */}
                {(() => {
                  const counterChips = (
                    <div className="flex items-center gap-1.5">
                      <span
                        className="inline-flex items-center rounded-md tabular-nums"
                        style={{
                          padding: "1px 6px",
                          backgroundColor: "#F1F5F9",
                          color: "#475569",
                          fontSize: 10,
                          fontWeight: 600,
                          fontFamily: FONT,
                          lineHeight: 1.4,
                        }}
                      >
                        {lineItems.length} item{lineItems.length === 1 ? "" : "s"}
                      </span>
                      <span
                        className="inline-flex items-center rounded-md tabular-nums"
                        style={{
                          padding: "1px 6px",
                          backgroundColor: "#F1F5F9",
                          color: "#475569",
                          fontSize: 10,
                          fontWeight: 600,
                          fontFamily: FONT,
                          lineHeight: 1.4,
                        }}
                      >
                        {totalUnits.toLocaleString()} unit{totalUnits === 1 ? "" : "s"}
                      </span>
                    </div>
                  );
                  return (
                    <SectionCard
                      icon={Package}
                      title="Line Items"
                      action={counterChips}
                      collapsible
                      bodyPadded={false}
                    >
                      {/* Column header strip — matches PO's `bg-muted/30` + 10/600 uppercase */}
                      <div
                        className="grid items-center px-4 py-2 border-b border-border"
                        style={{
                          gridTemplateColumns: "1fr 100px 120px 120px",
                          backgroundColor:
                            "color-mix(in srgb, hsl(var(--muted)) 30%, transparent)",
                        }}
                      >
                        <span style={COL_HEADER}>Line Item</span>
                        <span style={{ ...COL_HEADER, textAlign: "right" }}>Qty</span>
                        <span style={{ ...COL_HEADER, textAlign: "right" }}>
                          Est. Unit Price
                        </span>
                        <span style={{ ...COL_HEADER, textAlign: "right" }}>Est. Total</span>
                      </div>

                      {/* Rows */}
                      {lineItems.map((li, idx) => {
                        const catalogItem = li.itemId
                          ? CATALOG.find((c) => c.id === li.itemId)
                          : undefined;
                        const rowName =
                          catalogItem?.descriptiveName.split(" — ")[0] ??
                          li.newItemName ??
                          "—";
                        const rowSku = catalogItem?.itemNumber ?? (li.isNewItem ? "New item" : "—");
                        const rowFullDescription = catalogItem
                          ? [catalogItem.descriptiveName, catalogItem.category].filter(Boolean).join(" — ")
                          : li.newItemName ?? "";
                        const lineTotal =
                          typeof li.estimatedUnitPrice === "number"
                            ? li.estimatedUnitPrice * li.quantity
                            : undefined;
                        return (
                          <div
                            key={li.id}
                            className="grid px-4 py-3"
                            style={{
                              gridTemplateColumns: "1fr 100px 120px 120px",
                              alignItems: "start",
                              borderTop: idx > 0 ? "1px solid hsl(var(--border))" : undefined,
                            }}
                          >
                            {/* Line Item column */}
                            <div className="flex gap-3 min-w-0 pr-4">
                              {/* Row number */}
                              <span
                                className="shrink-0 w-[28px] text-right flex items-center justify-end tabular-nums"
                                style={{
                                  fontSize: 11,
                                  fontWeight: 500,
                                  lineHeight: "16px",
                                  fontFamily: FONT,
                                  color: "#94A3B8",
                                  minHeight: "44px",
                                }}
                              >
                                {String(idx + 1).padStart(3, "0")}
                              </span>
                              {/* Thumbnail */}
                              <div
                                className="relative shrink-0 rounded-md overflow-hidden"
                                style={{
                                  width: 44,
                                  height: 44,
                                  backgroundColor: "hsl(var(--secondary))",
                                  border: "1px solid hsl(var(--border))",
                                }}
                              >
                                {catalogItem ? (
                                  <ImageWithFallback
                                    src={catalogItem.image}
                                    alt={rowName}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div
                                    className="w-full h-full flex items-center justify-center"
                                    style={{ color: "hsl(var(--primary))" }}
                                  >
                                    <Package className="w-5 h-5" />
                                  </div>
                                )}
                              </div>
                              {/* Text content */}
                              <div className="flex flex-col min-w-0 gap-0.5 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span
                                    className="text-foreground"
                                    style={{
                                      fontSize: "var(--text-label)",
                                      fontWeight: "var(--font-weight-semibold)",
                                      lineHeight: "18px",
                                      fontFamily: FONT,
                                    }}
                                  >
                                    {rowSku}
                                  </span>
                                  {li.isNewItem && (
                                    <span
                                      className="inline-flex items-center rounded-md border shrink-0"
                                      style={{
                                        padding: "1px 6px",
                                        backgroundColor: "#EFF6FF",
                                        color: "#1E40AF",
                                        borderColor: "#BFDBFE",
                                        fontSize: 10,
                                        fontWeight: 600,
                                        lineHeight: 1.4,
                                        fontFamily: FONT,
                                      }}
                                    >
                                      New item
                                    </span>
                                  )}
                                  {catalogItem?.category && (
                                    <span
                                      className="inline-flex items-center rounded-md border shrink-0"
                                      style={{
                                        padding: "1px 6px",
                                        backgroundColor: "#F1F5F9",
                                        color: "#475569",
                                        borderColor: "#E2E8F0",
                                        fontSize: 10,
                                        fontWeight: 600,
                                        lineHeight: 1.4,
                                        fontFamily: FONT,
                                      }}
                                    >
                                      {catalogItem.category}
                                    </span>
                                  )}
                                  {li.preferredVendor && (
                                    <span
                                      className="inline-flex items-center rounded-md border shrink-0"
                                      style={{
                                        padding: "1px 6px",
                                        backgroundColor: "#F8FAFC",
                                        color: "#64748B",
                                        borderColor: "#E2E8F0",
                                        fontSize: 10,
                                        fontWeight: 500,
                                        lineHeight: 1.4,
                                        fontFamily: FONT,
                                      }}
                                    >
                                      {li.preferredVendor}
                                    </span>
                                  )}
                                </div>
                                <TruncatedItemName
                                  name={rowFullDescription}
                                  maxChars={80}
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 400,
                                    lineHeight: "18px",
                                    color: "#475569",
                                  }}
                                  className=""
                                />
                                {/* Vendor notes block removed — line-item
                                    level notes are no longer captured on
                                    the request form. */}
                              </div>
                            </div>

                            {/* Qty column */}
                            <div className="flex flex-col items-end pt-0.5">
                              <span
                                className="text-foreground tabular-nums"
                                style={{
                                  fontSize: 13,
                                  fontWeight: 500,
                                  lineHeight: "18px",
                                  fontFamily: FONT,
                                }}
                              >
                                {li.quantity}
                              </span>
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 500,
                                  lineHeight: "12px",
                                  fontFamily: FONT,
                                  color: "#64748B",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.04em",
                                }}
                              >
                                {li.uom}
                              </span>
                            </div>

                            {/* Est. unit price column */}
                            <div className="text-right pt-0.5">
                              {typeof li.estimatedUnitPrice === "number" ? (
                                <span
                                  className="text-foreground tabular-nums"
                                  style={{
                                    fontSize: 13,
                                    fontWeight: 500,
                                    lineHeight: "18px",
                                    fontFamily: FONT,
                                  }}
                                >
                                  ${li.estimatedUnitPrice.toFixed(2)}
                                </span>
                              ) : (
                                <span
                                  className="tabular-nums"
                                  style={{
                                    fontSize: 13,
                                    fontWeight: 400,
                                    lineHeight: "18px",
                                    fontFamily: FONT,
                                    color: "#94A3B8",
                                  }}
                                >
                                  —
                                </span>
                              )}
                            </div>

                            {/* Est. total column */}
                            <div className="text-right pt-0.5">
                              {typeof lineTotal === "number" ? (
                                <span
                                  className="text-foreground tabular-nums"
                                  style={{
                                    fontSize: 13,
                                    fontWeight: 600,
                                    lineHeight: "18px",
                                    fontFamily: FONT,
                                  }}
                                >
                                  ${lineTotal.toFixed(2)}
                                </span>
                              ) : (
                                <span
                                  className="tabular-nums"
                                  style={{
                                    fontSize: 13,
                                    fontWeight: 400,
                                    lineHeight: "18px",
                                    fontFamily: FONT,
                                    color: "#94A3B8",
                                  }}
                                >
                                  —
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* Grand total footer — only when at least one line has a price */}
                      {totalEstimated > 0 && (
                        <div
                          className="grid px-4 py-2.5 border-t"
                          style={{
                            gridTemplateColumns: "1fr 100px 120px 120px",
                            borderColor: "hsl(var(--border))",
                            backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 30%, transparent)",
                          }}
                        >
                          <span
                            className="col-span-3 text-right"
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: "#64748B",
                              fontFamily: FONT,
                              letterSpacing: "0.04em",
                              textTransform: "uppercase",
                              gridColumn: "1 / 4",
                            }}
                          >
                            Estimated Total
                          </span>
                          <span
                            className="text-right tabular-nums text-foreground"
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              fontFamily: FONT,
                            }}
                          >
                            ${totalEstimated.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </SectionCard>
                  );
                })()}

                {/* Attachments */}
                {pr.attachments.length > 0 && (
                  <SectionCard icon={Paperclip} title="Attachments" collapsible>
                    <ul className="flex flex-col gap-2">
                      {pr.attachments.map((a) => (
                        <li
                          key={a.id}
                          className="flex items-center justify-between rounded-md border px-3 py-2"
                          style={{ borderColor: "hsl(var(--border))" }}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Paperclip className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span
                              className="truncate text-foreground"
                              style={{
                                fontSize: 13,
                                fontWeight: 500,
                                lineHeight: "18px",
                                fontFamily: FONT,
                              }}
                            >
                              {a.filename}
                            </span>
                          </div>
                          <span
                            className="tabular-nums"
                            style={{
                              fontSize: 11,
                              fontWeight: 500,
                              color: "#64748B",
                              fontFamily: FONT,
                            }}
                          >
                            {a.sizeKb} KB
                          </span>
                        </li>
                      ))}
                    </ul>
                  </SectionCard>
                )}
              </div>

              {/* ━━━━━━ RIGHT COLUMN (sidebar, 300px) ━━━━━━ */}
              <aside className="flex flex-col gap-5 min-w-0">
                {/* Requester */}
                <SectionCard icon={User} title="Requested by" collapsible>
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-white shrink-0"
                      style={{
                        backgroundColor: pr.requester.avatarColor,
                        fontFamily: FONT,
                        fontWeight: 600,
                        fontSize: 13,
                      }}
                    >
                      {pr.requester.initials}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span
                        className="text-foreground truncate"
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          lineHeight: "18px",
                          fontFamily: FONT,
                        }}
                      >
                        {pr.requester.name}
                      </span>
                      <span
                        className="truncate"
                        style={{
                          fontSize: 11,
                          fontWeight: 500,
                          color: "#64748B",
                          fontFamily: FONT,
                        }}
                      >
                        {pr.requester.role}
                      </span>
                    </div>
                  </div>
                </SectionCard>

                {/* Details / meta — grid of SidebarField rows */}
                <SectionCard icon={ClipboardEdit} title="Details" collapsible>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-4">
                    <SidebarField label="Need by">
                      <span className="tabular-nums">
                        {formatPRDateRange(pr.needBy, pr.needByEnd)}
                      </span>
                    </SidebarField>
                    <SidebarField label="Urgency">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-md border"
                        style={{
                          backgroundColor: urgencyMeta.bg,
                          color: urgencyMeta.fg,
                          borderColor: urgencyMeta.border,
                          fontFamily: FONT,
                          fontSize: 11,
                          fontWeight: 600,
                          lineHeight: 1.4,
                        }}
                      >
                        {urgencyMeta.label}
                      </span>
                    </SidebarField>
                    <SidebarField label="Submitted">
                      <span
                        className="tabular-nums"
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: "hsl(var(--muted-foreground))",
                          fontFamily: FONT,
                        }}
                      >
                        {formatPRDate(pr.submittedAt)}
                      </span>
                    </SidebarField>
                    {uniquePreferredVendors.length > 0 && (
                      <SidebarField
                        label={
                          uniquePreferredVendors.length === 1
                            ? "Preferred vendor"
                            : "Preferred vendors"
                        }
                      >
                        <span className="block">{uniquePreferredVendors.join(", ")}</span>
                      </SidebarField>
                    )}
                  </div>
                </SectionCard>

                {/* Reason — same section card recipe as the rest of the sidebar */}
                <SectionCard icon={Info} title="Reason" collapsible>
                  <p
                    className="text-foreground"
                    style={{
                      fontSize: 13,
                      fontWeight: 400,
                      lineHeight: "20px",
                      fontFamily: FONT,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {pr.reason}
                  </p>
                  {pr.referenceDoc && (
                    <a
                      href="#"
                      onClick={(e) => e.preventDefault()}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 border max-w-full"
                      style={{
                        borderColor: "hsl(var(--border))",
                        color: "hsl(var(--primary))",
                        fontSize: 11,
                        fontWeight: 500,
                        fontFamily: FONT,
                      }}
                    >
                      <FileText className="w-3 h-3 shrink-0" />
                      <span className="truncate">{pr.referenceDoc}</span>
                    </a>
                  )}
                </SectionCard>

                {/* Configuration flag — updated design (multi-issue
                    era). Shows the human-readable target as a chip,
                    then a before → after strip so the "what needs
                    changing" reads at a glance. The reason-note lives
                    in its own block below. */}
                {pr.configFlag && (
                  <SectionCard
                    icon={Wrench}
                    title="Configuration flag"
                    collapsible
                    toneBorderColor="#FDE68A"
                    toneHeaderBg="#FFFBEB"
                    toneTitleColor="#92400E"
                    toneIconBg="#FEF3C7"
                    toneIconColor="#B45309"
                  >
                    <div className="flex flex-col gap-4">
                      {/* Target chip */}
                      <div className="flex flex-col gap-1.5">
                        <p
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: "#B45309",
                            fontFamily: FONT,
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                          }}
                        >
                          What's incorrect
                        </p>
                        <span
                          className="inline-flex items-center gap-1.5 self-start rounded-md border px-2 py-1"
                          style={{
                            backgroundColor: "#FFFFFF",
                            borderColor: "#FDE68A",
                            fontFamily: FONT,
                          }}
                        >
                          <Wrench
                            className="w-3 h-3"
                            style={{ color: "#B45309" }}
                          />
                          <span
                            style={{
                              fontSize: 12.5,
                              fontWeight: 600,
                              color: "#78350F",
                            }}
                          >
                            {CONFIG_TARGET_LABEL[pr.configFlag.target] ??
                              pr.configFlag.target}
                          </span>
                        </span>
                      </div>

                      {/* Before → After comparison */}
                      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-stretch">
                        <div
                          className="rounded-md border px-3 py-2 flex flex-col gap-0.5"
                          style={{
                            backgroundColor: "#FFFFFF",
                            borderColor: "#FDE68A",
                          }}
                        >
                          <p
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: "#B45309",
                              fontFamily: FONT,
                              letterSpacing: "0.06em",
                              textTransform: "uppercase",
                            }}
                          >
                            Currently shows
                          </p>
                          <p
                            className="tabular-nums"
                            style={{
                              fontSize: 15,
                              fontWeight: 700,
                              color: "#78350F",
                              fontFamily: FONT,
                              lineHeight: "20px",
                              letterSpacing: "-0.005em",
                            }}
                          >
                            {pr.configFlag.currentValue || "—"}
                          </p>
                        </div>
                        <div
                          className="flex items-center justify-center px-1"
                          aria-hidden
                        >
                          <ArrowRight
                            className="w-4 h-4"
                            style={{ color: "#B45309", opacity: 0.6 }}
                          />
                        </div>
                        <div
                          className="rounded-md border px-3 py-2 flex flex-col gap-0.5"
                          style={{
                            backgroundColor: "#F0FDF4",
                            borderColor: "#BBF7D0",
                          }}
                        >
                          <p
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: "#166534",
                              fontFamily: FONT,
                              letterSpacing: "0.06em",
                              textTransform: "uppercase",
                            }}
                          >
                            Should be
                          </p>
                          <p
                            className="tabular-nums"
                            style={{
                              fontSize: 15,
                              fontWeight: 700,
                              color: "#166534",
                              fontFamily: FONT,
                              lineHeight: "20px",
                              letterSpacing: "-0.005em",
                            }}
                          >
                            {pr.configFlag.correctValue || "—"}
                          </p>
                        </div>
                      </div>

                      {/* Explanation */}
                      {pr.configFlag.explanation && (
                        <div className="flex flex-col gap-1">
                          <p
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: "#B45309",
                              fontFamily: FONT,
                              letterSpacing: "0.06em",
                              textTransform: "uppercase",
                            }}
                          >
                            Explanation
                          </p>
                          <div
                            className="rounded-md px-3 py-2"
                            style={{
                              backgroundColor: "#FFFFFF",
                              border: "1px solid #FDE68A",
                            }}
                          >
                            <p
                              style={{
                                fontSize: 12.5,
                                fontWeight: 400,
                                lineHeight: "18px",
                                color: "#78350F",
                                fontFamily: FONT,
                              }}
                            >
                              {pr.configFlag.explanation}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </SectionCard>
                )}

                {/* PO-created success — emerald-toned SectionCard, collapsible */}
                {poCreatedEntry?.poRef && (
                  <SectionCard
                    icon={CheckCircle2}
                    title="A PO was raised"
                    collapsible
                    toneBorderColor="#BBF7D0"
                    toneHeaderBg="#F0FDF4"
                    toneTitleColor="#166534"
                    toneIconBg="#DCFCE7"
                    toneIconColor="#166534"
                  >
                    <div className="flex flex-col gap-3">
                      <p
                        style={{
                          fontSize: 12,
                          fontWeight: 400,
                          lineHeight: "18px",
                          color: "#166534",
                          fontFamily: FONT,
                        }}
                      >
                        Your request is being fulfilled through the purchase order below.
                      </p>
                      <a
                        href={`/purchase-orders/${poCreatedEntry.poRef}`}
                        className="h-9 rounded-md inline-flex items-center justify-center gap-1.5 text-white shadow-sm"
                        style={{
                          backgroundColor: "#166534",
                          fontFamily: FONT,
                          fontSize: 13,
                          fontWeight: 600,
                        }}
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> View {poCreatedEntry.poRef}
                      </a>
                    </div>
                  </SectionCard>
                )}
              </aside>
            </div>
          </div>
        </div>
      </div>

      {/* Reason-prompt modal for Defer / Deny — small dialog with a
          required textarea; on confirm updates PR status + appends a
          history entry. Same shell shape as the cash-management
          reason dialog (`PaymentTermDetailModal`) so the two feel
          like siblings. */}
      <Dialog
        open={reasonModal !== null}
        onOpenChange={(o) => {
          if (!o) {
            setReasonModal(null);
            setReasonText("");
          }
        }}
      >
        <DialogContent
          className="sm:max-w-[520px] p-0 gap-0 overflow-hidden rounded-2xl"
          style={{ fontFamily: FONT }}
        >
          {reasonModal && (
            <>
              <div className="flex items-start gap-3 px-5 pt-5 pb-4 border-b border-[#EEF2F6]">
                <div
                  className="shrink-0 flex items-center justify-center rounded-md border"
                  style={{
                    width: 36,
                    height: 36,
                    backgroundColor:
                      reasonModal.mode === "defer" ? "#FFFBEB" : "#FEF2F2",
                    borderColor:
                      reasonModal.mode === "defer" ? "#FDE68A" : "#FECACA",
                  }}
                >
                  {reasonModal.mode === "defer" ? (
                    <PauseCircle
                      style={{ width: 18, height: 18, color: "#92400E" }}
                    />
                  ) : (
                    <XCircle
                      style={{ width: 18, height: 18, color: "#B91C1C" }}
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <DialogTitle
                    className="text-foreground"
                    style={{ fontSize: 15, fontWeight: 700 }}
                  >
                    {reasonModal.mode === "defer"
                      ? "Defer this request"
                      : "Deny this request"}
                  </DialogTitle>
                  <DialogDescription
                    className="mt-0.5 text-slate-500"
                    style={{ fontSize: 12 }}
                  >
                    Tell the requester why — the note is stored on the
                    request history and shown on the detail page.
                  </DialogDescription>
                </div>
              </div>
              <div className="px-5 py-4">
                <textarea
                  value={reasonText}
                  onChange={(e) => setReasonText(e.target.value)}
                  placeholder={
                    reasonModal.mode === "defer"
                      ? "e.g. Vendor lead time exceeds the need-by date — revisit in 2 weeks."
                      : "e.g. Item is already flagged Below Minimum — file a config issue instead."
                  }
                  rows={4}
                  autoFocus
                  className="w-full rounded-md border border-border bg-white px-3 py-2 text-[13px] text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  style={{ fontFamily: FONT }}
                />
              </div>
              <div
                className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[#EEF2F6]"
                style={{ backgroundColor: "#FAFBFC" }}
              >
                <Button
                  variant="outline"
                  onClick={() => {
                    setReasonModal(null);
                    setReasonText("");
                  }}
                  disabled={submittingAction}
                  className="h-9 px-4 text-[13px]"
                >
                  Cancel
                </Button>
                <Button
                  onClick={submitReasonAction}
                  disabled={submittingAction || reasonText.trim().length === 0}
                  className="h-9 px-4 text-[13px] gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ fontWeight: 600 }}
                >
                  {reasonModal.mode === "defer" ? (
                    <>
                      <PauseCircle className="w-3.5 h-3.5" />
                      {submittingAction ? "Deferring…" : "Defer request"}
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5" />
                      {submittingAction ? "Denying…" : "Deny request"}
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
