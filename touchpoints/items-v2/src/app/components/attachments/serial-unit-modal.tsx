/* Minimal stubs for Item v2 attachments port.
 * PI's serial-unit-modal is 3600+ lines; we only need a few exports for the
 * attachments feature to compile. Transaction drill-through is a non-op here. */

import React from "react";

export const PERSON_AVATARS: Record<string, string> = {
  "Daniel Adams": "https://images.unsplash.com/photo-1672685667592-0392f458f46f?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&w=200&h=200&q=80",
  "Maya Thompson": "https://images.unsplash.com/photo-1655249493799-9cee4fe983bb?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&w=200&h=200&q=80",
  "Sarah Chen": "https://images.unsplash.com/photo-1580489944761-15a19d654956?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&w=200&h=200&q=80",
  "James Wilson": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&w=200&h=200&q=80",
  "Maria Garcia": "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&w=200&h=200&q=80",
  "Bruce Xavier": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&w=200&h=200&q=80",
  "Ahtisham Ahmad": "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&w=200&h=200&q=80",
  "Lisa Park": "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&w=200&h=200&q=80",
  "Robert Kim": "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&w=200&h=200&q=80",
  "Emily Torres": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&w=200&h=200&q=80",
  "Colin Trevors": "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&w=200&h=200&q=80",
  "Frank Green": "https://images.unsplash.com/photo-1560250097-0b93528c311a?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&w=200&h=200&q=80",
  "Jonas Summers": "https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&w=200&h=200&q=80",
  "Liam Chen": "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&w=200&h=200&q=80",
  "Lisa Steve": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&w=200&h=200&q=80",
  "Marshall Mathews": "https://images.unsplash.com/photo-1504257432389-52343af06ae3?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&w=200&h=200&q=80",
  "Rashada Jones": "https://images.unsplash.com/photo-1589156280159-27698a70f29e?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&w=200&h=200&q=80",
  "Sofia Patel": "https://images.unsplash.com/photo-1607746882042-944635dfe10e?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&w=200&h=200&q=80",
  "Sydney Stone": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&w=200&h=200&q=80",
  "Branby Grey": "https://images.unsplash.com/photo-1566492031773-4f4e44671857?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&w=200&h=200&q=80",
  "Rachel Wong": "https://images.unsplash.com/photo-1551836022-d5d88e9218df?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&w=200&h=200&q=80",
  "Kevin Ogutu": "https://images.unsplash.com/photo-1543610892-0b1f7e6d8ac1?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&w=200&h=200&q=80",
  "Priya Sharma": "https://images.unsplash.com/photo-1614644147724-2d4785d69962?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&w=200&h=200&q=80",
};

export function PersonAvatar({ name, size = 16 }: { name: string; size?: number }) {
  const url = PERSON_AVATARS[name];
  const style: React.CSSProperties = { width: `${size}px`, height: `${size}px` };
  return url ? (
    <img src={url} alt={name} className="rounded-full shrink-0 object-cover" style={style} title={name} />
  ) : (
    <div
      className="rounded-full shrink-0 flex items-center justify-center"
      style={{
        ...style,
        background: "var(--primary-200)",
        color: "var(--piw-primary)",
        fontFamily: "var(--font-inter)",
        fontWeight: 600,
        fontSize: `${Math.round(size * 0.5)}px`,
      }}
      title={name}
    >
      {name.split(" ").map((n) => n[0]).join("")}
    </div>
  );
}

export type TransactionDetail = Record<string, any>;

export function enrichTransactionDetail<T extends Record<string, any>>(base: T, _opts?: { txId?: string; date?: string; time?: string }): T {
  return base;
}

export function TransactionDetailModal({
  onClose,
}: {
  onClose: () => void;
  [key: string]: any;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--piw-card)",
          border: "1px solid var(--piw-border)",
          borderRadius: "var(--radius-lg)",
          padding: "24px",
          minWidth: "320px",
          fontFamily: "var(--font-inter)",
        }}
      >
        <h3 style={{ margin: "0 0 8px", fontSize: "var(--text-h5)", fontWeight: 600 }}>Transaction details</h3>
        <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "var(--text-body-sm)" }}>
          Full transaction view is not available in this module.
        </p>
        <button
          onClick={onClose}
          style={{
            marginTop: "16px",
            padding: "8px 16px",
            background: "var(--piw-primary)",
            color: "var(--piw-primary-foreground)",
            border: "none",
            borderRadius: "var(--radius-sm)",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
