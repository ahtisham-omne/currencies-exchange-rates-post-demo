import type React from "react";

/* ═══════════════════════════════════════════════════════════════
   SHARED DESIGN TOKENS
   Centralized typography & style constants used across all
   components. All values reference CSS variables from
   /src/styles/theme.css so styling can be updated via CSS alone.
   ═══════════════════════════════════════════════════════════════ */

/** System font stack — ONLY use Inter as defined in /src/styles/fonts.css */
export const FONT = "'Inter', sans-serif";

/* ── Typography Style Objects ────────────────────────────────── */

export const typography = {
  /** Page-level heading (H4) */
  pageTitle: {
    fontSize: "var(--text-h4)",
    fontWeight: "var(--font-weight-semibold)" as string,
    lineHeight: "28px",
    fontFamily: FONT,
  } as React.CSSProperties,

  /** Page subtitle / description */
  pageSub: {
    fontSize: "var(--text-label)",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "20px",
    fontFamily: FONT,
  } as React.CSSProperties,

  /** Section label (uppercase, tiny) */
  sectionLabel: {
    fontSize: "var(--text-2xs)",
    fontWeight: "var(--font-weight-semibold)" as string,
    lineHeight: "14px",
    fontFamily: FONT,
    letterSpacing: "0.05em",
    textTransform: "uppercase" as const,
  } as React.CSSProperties,

  /** Section title (label-sized, semibold) */
  sectionTitle: {
    fontSize: "var(--text-label)",
    fontWeight: "var(--font-weight-semibold)" as string,
    lineHeight: "20px",
    fontFamily: FONT,
  } as React.CSSProperties,

  /** Filter / control labels */
  filterLabel: {
    fontSize: "var(--text-sm)",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "16px",
    fontFamily: FONT,
    color: "var(--foreground)",
  } as React.CSSProperties,

  /** Small UI labels (buttons, badges) */
  uiLabel: {
    fontSize: "var(--text-sm)",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "16px",
    fontFamily: FONT,
  } as React.CSSProperties,

  /** Small UI captions */
  uiCaption: {
    fontSize: "var(--text-sm)",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "16px",
    fontFamily: FONT,
  } as React.CSSProperties,

  /** Small UI text (slightly less emphasis) */
  uiSmall: {
    fontSize: "var(--text-sm)",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "16px",
    fontFamily: FONT,
  } as React.CSSProperties,

  /** Card title (part number, item name) */
  cardTitle: {
    fontSize: "var(--text-label)",
    fontWeight: "var(--font-weight-semibold)" as string,
    lineHeight: "18px",
    fontFamily: FONT,
  } as React.CSSProperties,

  /** Card description text */
  cardDesc: {
    fontSize: "var(--text-xs)",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "16px",
    fontFamily: FONT,
  } as React.CSSProperties,

  /** Card metadata (vendor, UOM, small info) */
  cardMeta: {
    fontSize: "var(--text-xs)",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "15px",
    fontFamily: FONT,
  } as React.CSSProperties,

  /** Card metadata bold variant */
  cardMetaBold: {
    fontSize: "var(--text-xs)",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "15px",
    fontFamily: FONT,
  } as React.CSSProperties,

  /** Price display */
  priceTag: {
    fontSize: "var(--text-base)",
    fontWeight: "var(--font-weight-semibold)" as string,
    lineHeight: "18px",
    fontFamily: FONT,
  } as React.CSSProperties,

  /** Price value (larger, used in modals/detail) */
  priceValue: {
    fontSize: "var(--text-base)",
    fontWeight: "var(--font-weight-semibold)" as string,
    lineHeight: "18px",
    fontFamily: FONT,
  } as React.CSSProperties,

  /** Cart quantity badge */
  cartCount: {
    fontSize: "var(--text-sm)",
    fontWeight: "var(--font-weight-semibold)" as string,
    lineHeight: "16px",
    fontFamily: FONT,
  } as React.CSSProperties,

  /** Tiny text (10px, badges, pills) */
  tiny: {
    fontSize: "var(--text-2xs)",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "14px",
    fontFamily: FONT,
  } as React.CSSProperties,

  /** View Details overlay text */
  viewDetail: {
    fontSize: "var(--text-xs)",
    fontWeight: "var(--font-weight-semibold)" as string,
    lineHeight: "15px",
    fontFamily: FONT,
    letterSpacing: "0.02em",
  } as React.CSSProperties,

  /** Field value (bold, used in forms/modals) */
  fieldValueBold: {
    fontSize: "var(--text-label)",
    fontWeight: "var(--font-weight-semibold)" as string,
    lineHeight: "18px",
    fontFamily: FONT,
  } as React.CSSProperties,

  /** Base body text */
  body: {
    fontSize: "var(--text-label)",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "20px",
    fontFamily: FONT,
  } as React.CSSProperties,

  /** Heading-level text for inline sections */
  heading: {
    fontSize: "var(--text-base)",
    fontWeight: "var(--font-weight-semibold)" as string,
    lineHeight: "24px",
    fontFamily: FONT,
  } as React.CSSProperties,
} as const;
