/**
 * Omne Design System v2.0 — Tokenized Design Foundation
 *
 * Source of truth for every visual primitive (color / spacing / radius /
 * shadow / typography / opacity / motion) in the vendor-invoicing app.
 * Transcribed from the Figma file's Variables panel at:
 *   https://www.figma.com/design/4XilIqpnxtWLQis7bRwvOc/Omne-Design-System-v2.0
 *
 * Figma file structure mirrored below:
 *   Collection 1 — Primitives (451 vars)
 *     spacing · width · min-width · max-width · height · breakpoint
 *     border-radius · border-width · stroke-width · opacity · line-height
 *     Colors (244 stops: base, slate, gray, zinc, neutral, stone, red,
 *            orange, amber, yellow, lime, green, emerald, teal, cyan, sky,
 *            blue, indigo, violet, purple, fuchsia, pink, rose)
 *
 *   Collection 2 — Theme (221 vars) — Material-3-style semantic roles with
 *     light + dark mode pairs. surface / on-surface / secondary-container /
 *     outline / error / success / warning / orange / purple / violet /
 *     fuchsia + text-xs..9xl + font-weight (9 stops) + radius (8) +
 *     shadow (55) + container (13) + breakpoint (5)
 *
 *   Collection 3 — Mode (38 vars) — light/dark mode resolutions
 *
 *   Collection 4 — Custom (28 vars) — display-large/medium · headline-large/
 *     medium · container-padding-{x,y} · section-padding-y · section-title-
 *     gap-{xl,lg,md,sm}
 *
 *   Collection 5 — Icon Library (5 vars) — Lucide (default) · Tabler · Hugeicons ·
 *     Phosphor · Remix Icon
 *
 * Two consumers read from this file:
 *   1. src/styles/tokens.css — emits CSS custom properties (--color-*, --space-*, …)
 *   2. tailwind.config.ts — extends theme scales so utilities resolve to tokens
 *
 * Hand-mirrored: edits to tokens.ts must be repeated in tokens.css.
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. PRIMITIVES — COLOR PALETTE (244 stops across 23 hues)
// ─────────────────────────────────────────────────────────────────────────────

export const palette = {
  // Brand blue — every stop tonally derived from primary #0A77FF (h=212-214).
  // Replaces the Tailwind default ladder (which was centered on #3B82F6 and
  // felt visually disconnected from our primary). Stops 50/100/200 match the
  // partner module's exact accent / pill-hover / pill-active values so
  // tinted surfaces (active tabs, hovered chips, soft cards) read as the
  // same blue family across both apps.
  blue: {
    50:  '#EBF3FF',  // partner --accent (hsl 214 100% 96%)
    100: '#D6E8FF',  // partner pill hover
    200: '#ADD1FF',  // partner pill active
    300: '#80B5FF',
    400: '#4998FF',
    500: '#0A77FF',  // base — primary CTA
    600: '#0866E0',
    700: '#0654BC',
    800: '#044394',
    900: '#02326F',
  },
  // Cool slate — surfaces, text, borders (primary neutral)
  slate: {
    50: '#F8FAFC', 100: '#F1F5F9', 200: '#E2E8F0', 300: '#CBD5E1',
    400: '#94A3B8', 500: '#64748B', 600: '#475569', 700: '#334155',
    800: '#1E293B', 900: '#0F172A',
  },
  // Cool gray — slightly warmer alternative neutral
  gray: {
    50: '#F9FAFB', 100: '#F3F4F6', 200: '#E5E7EB', 300: '#D1D5DB',
    400: '#9CA3AF', 500: '#6B7280', 600: '#4B5563', 700: '#374151',
    800: '#1F2937', 900: '#111827',
  },
  // Cool zinc — flat neutral, less blue than slate
  zinc: {
    50: '#FAFAFA', 100: '#F4F4F5', 200: '#E4E4E7', 300: '#D4D4D8',
    400: '#A1A1AA', 500: '#71717A', 600: '#52525B', 700: '#3F3F46',
    800: '#27272A', 900: '#18181B',
  },
  // True neutral — fully grayscale
  neutral: {
    50: '#FAFAFA', 100: '#F5F5F5', 200: '#E5E5E5', 300: '#D4D4D4',
    400: '#A3A3A3', 500: '#737373', 600: '#525252', 700: '#404040',
    800: '#262626', 900: '#171717',
  },
  // Warm stone — earthy neutral
  stone: {
    50: '#FAFAF9', 100: '#F5F5F4', 200: '#E7E5E4', 300: '#D6D3D1',
    400: '#A8A29E', 500: '#78716C', 600: '#57534E', 700: '#44403C',
    800: '#292524', 900: '#1C1917',
  },
  // Reds — destructive / cancelled / exception
  red: {
    50: '#FEF2F2', 100: '#FEE2E2', 200: '#FECACA', 300: '#FCA5A5',
    400: '#F87171', 500: '#EF4444', 600: '#DC2626', 700: '#B91C1C',
    800: '#991B1B', 900: '#7F1D1D',
  },
  // Rose — softer red alternative
  rose: {
    50: '#FFF1F2', 100: '#FFE4E6', 200: '#FECDD3', 300: '#FDA4AF',
    400: '#FB7185', 500: '#F43F5E', 600: '#E11D48', 700: '#BE123C',
    800: '#9F1239', 900: '#881337',
  },
  // Oranges — exception / urgent attention
  orange: {
    50: '#FFF7ED', 100: '#FFEDD5', 200: '#FED7AA', 300: '#FDBA74',
    400: '#FB923C', 500: '#F97316', 600: '#EA580C', 700: '#C2410C',
    800: '#9A3412', 900: '#7C2D12',
  },
  // Amber — pending / waiting
  amber: {
    50: '#FFFBEB', 100: '#FEF3C7', 200: '#FDE68A', 300: '#FCD34D',
    400: '#FBBF24', 500: '#F59E0B', 600: '#D97706', 700: '#B45309',
    800: '#92400E', 900: '#78350F',
  },
  // Yellow — payment hold / pre-invoice
  yellow: {
    50: '#FEFCE8', 100: '#FEF9C3', 200: '#FEF08A', 300: '#FDE047',
    400: '#FACC15', 500: '#EAB308', 600: '#CA8A04', 700: '#A16207',
    800: '#854D0E', 900: '#713F12',
  },
  // Lime — partial / in motion
  lime: {
    50: '#F7FEE7', 100: '#ECFCCB', 200: '#D9F99D', 300: '#BEF264',
    400: '#A3E635', 500: '#84CC16', 600: '#65A30D', 700: '#4D7C0F',
    800: '#3F6212', 900: '#365314',
  },
  // Green — success
  green: {
    50: '#F0FDF4', 100: '#DCFCE7', 200: '#BBF7D0', 300: '#86EFAC',
    400: '#4ADE80', 500: '#22C55E', 600: '#16A34A', 700: '#15803D',
    800: '#166534', 900: '#14532D',
  },
  // Emerald — deeper success
  emerald: {
    50: '#ECFDF5', 100: '#D1FAE5', 200: '#A7F3D0', 300: '#6EE7B7',
    400: '#34D399', 500: '#10B981', 600: '#059669', 700: '#047857',
    800: '#065F46', 900: '#064E3B',
  },
  // Teal
  teal: {
    50: '#F0FDFA', 100: '#CCFBF1', 200: '#99F6E4', 300: '#5EEAD4',
    400: '#2DD4BF', 500: '#14B8A6', 600: '#0D9488', 700: '#0F766E',
    800: '#115E59', 900: '#134E4A',
  },
  // Cyan
  cyan: {
    50: '#ECFEFF', 100: '#CFFAFE', 200: '#A5F3FC', 300: '#67E8F9',
    400: '#22D3EE', 500: '#06B6D4', 600: '#0891B2', 700: '#0E7490',
    800: '#155E75', 900: '#164E63',
  },
  // Sky
  sky: {
    50: '#F0F9FF', 100: '#E0F2FE', 200: '#BAE6FD', 300: '#7DD3FC',
    400: '#38BDF8', 500: '#0EA5E9', 600: '#0284C7', 700: '#0369A1',
    800: '#075985', 900: '#0C4A6E',
  },
  // Indigo
  indigo: {
    50: '#EEF2FF', 100: '#E0E7FF', 200: '#C7D2FE', 300: '#A5B4FC',
    400: '#818CF8', 500: '#6366F1', 600: '#4F46E5', 700: '#4338CA',
    800: '#3730A3', 900: '#312E81',
  },
  // Violet
  violet: {
    50: '#F5F3FF', 100: '#EDE9FE', 200: '#DDD6FE', 300: '#C4B5FD',
    400: '#A78BFA', 500: '#8B5CF6', 600: '#7C3AED', 700: '#6D28D9',
    800: '#5B21B6', 900: '#4C1D95',
  },
  // Purple — separate hue family from violet
  purple: {
    50: '#FAF5FF', 100: '#F3E8FF', 200: '#E9D5FF', 300: '#D8B4FE',
    400: '#C084FC', 500: '#A855F7', 600: '#9333EA', 700: '#7E22CE',
    800: '#6B21A8', 900: '#581C87',
  },
  // Fuchsia
  fuchsia: {
    50: '#FDF4FF', 100: '#FAE8FF', 200: '#F5D0FE', 300: '#F0ABFC',
    400: '#E879F9', 500: '#D946EF', 600: '#C026D3', 700: '#A21CAF',
    800: '#86198F', 900: '#701A75',
  },
  // Pink
  pink: {
    50: '#FDF2F8', 100: '#FCE7F3', 200: '#FBCFE8', 300: '#F9A8D4',
    400: '#F472B6', 500: '#EC4899', 600: '#DB2777', 700: '#BE185D',
    800: '#9D174D', 900: '#831843',
  },
  // Absolutes
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
} as const;

/**
 * Partner-specific accent stops that don't map cleanly to a standard
 * 50–900 ladder. These are interaction tints (row hover / row selected /
 * pill hover / pill active) lifted from the partner module's exact
 * partner.ts. Kept under `accent` so consumers can pick them by intent
 * (e.g. `accent.rowHover`) instead of memorizing the hex.
 */
/**
 * Interaction-state aliases for partner-style row / chip hover behavior.
 * After the blue palette was retoned to #0A77FF, pillHover and pillActive
 * are now identical to palette.blue[100] and palette.blue[200] respectively,
 * but we keep the semantic names so consumers can pick by intent
 * (`accent.rowHover`) instead of by stop.
 */
export const accent = {
  /** Row hover background — softest blue, slightly more subtle than blue-50 */
  rowHover: '#F0F7FF',
  /** Selected row background — almost-white blue */
  rowSelected: '#F8FAFF',
  /** Pill / chip hover — = palette.blue[100] */
  pillHover: '#D6E8FF',
  /** Pill / chip active — = palette.blue[200] */
  pillActive: '#ADD1FF',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// 1. PRIMITIVES — SPACING SCALE (4px base unit, matches Figma's spacing/0 → spacing/16)
// ─────────────────────────────────────────────────────────────────────────────

export const spacing = {
  0: '0',
  px: '1px',
  0.5: '0.125rem',  // 2px
  1: '0.25rem',     // 4px
  1.5: '0.375rem',  // 6px
  2: '0.5rem',      // 8px
  2.5: '0.625rem',  // 10px
  3: '0.75rem',     // 12px
  3.5: '0.875rem',  // 14px
  4: '1rem',        // 16px
  5: '1.25rem',     // 20px
  6: '1.5rem',      // 24px
  7: '1.75rem',     // 28px
  8: '2rem',        // 32px
  9: '2.25rem',     // 36px
  10: '2.5rem',     // 40px
  11: '2.75rem',    // 44px
  12: '3rem',       // 48px
  14: '3.5rem',     // 56px
  16: '4rem',       // 64px
  20: '5rem',       // 80px
  24: '6rem',       // 96px
  28: '7rem',       // 112px
  32: '8rem',       // 128px
  36: '9rem',
  40: '10rem',
  44: '11rem',
  48: '12rem',
  52: '13rem',
  56: '14rem',
  60: '15rem',
  64: '16rem',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// 1. PRIMITIVES — RADIUS (10 stops in Figma's border-radius)
// ─────────────────────────────────────────────────────────────────────────────

export const radius = {
  none: '0',
  xs: '0.125rem',     // 2px — micro chips
  sm: '0.25rem',      // 4px — type pills
  md: '0.375rem',     // 6px — checkbox / small button
  default: '0.5rem',  // 8px — base card / button
  lg: '0.75rem',      // 12px — toolbar buttons / large inputs
  xl: '1rem',         // 16px — modal containers / panel cards
  '2xl': '1.5rem',    // 24px — hero dialogs
  '3xl': '2rem',      // 32px
  full: '9999px',     // pills / circular avatars
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// 1. PRIMITIVES — BORDER WIDTH (9 stops)
// ─────────────────────────────────────────────────────────────────────────────

export const borderWidth = {
  0: '0',
  px: '1px',
  1: '1px',
  1.5: '1.5px',
  2: '2px',
  3: '3px',
  4: '4px',
  6: '6px',
  8: '8px',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// 1. PRIMITIVES — STROKE WIDTH (12 stops)
// ─────────────────────────────────────────────────────────────────────────────

export const strokeWidth = {
  0: '0',
  0.5: '0.5px',
  1: '1px',
  1.25: '1.25px',
  1.5: '1.5px',
  1.75: '1.75px',
  2: '2px',
  2.5: '2.5px',
  3: '3px',
  4: '4px',
  6: '6px',
  8: '8px',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// 1. PRIMITIVES — OPACITY (21 stops at 5% intervals)
// ─────────────────────────────────────────────────────────────────────────────

export const opacity = {
  0: '0',
  5: '0.05',
  10: '0.1',
  15: '0.15',
  20: '0.2',
  25: '0.25',
  30: '0.3',
  35: '0.35',
  40: '0.4',
  45: '0.45',
  50: '0.5',
  55: '0.55',
  60: '0.6',
  65: '0.65',
  70: '0.7',
  75: '0.75',
  80: '0.8',
  85: '0.85',
  90: '0.9',
  95: '0.95',
  100: '1',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// 1. PRIMITIVES — LINE HEIGHT (20 stops)
// ─────────────────────────────────────────────────────────────────────────────

export const lineHeight = {
  none: '1',
  tight: '1.125',
  snug: '1.25',
  normal: '1.4',
  relaxed: '1.5',
  loose: '1.625',
  3: '0.75rem',     // 12px
  4: '1rem',        // 16px
  5: '1.25rem',     // 20px
  6: '1.5rem',      // 24px
  7: '1.75rem',     // 28px
  8: '2rem',        // 32px
  9: '2.25rem',     // 36px
  10: '2.5rem',     // 40px
  12: '3rem',       // 48px
  14: '3.5rem',     // 56px
  16: '4rem',       // 64px
  20: '5rem',       // 80px
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// 1. PRIMITIVES — BREAKPOINTS (5 stops)
// ─────────────────────────────────────────────────────────────────────────────

export const breakpoint = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// 1. PRIMITIVES — WIDTH/HEIGHT scales (subset; full scale = 33+33+14+15 vars)
// ─────────────────────────────────────────────────────────────────────────────

export const sizing = {
  /** Common card / panel widths */
  card: { sm: '20rem', md: '24rem', lg: '32rem', xl: '40rem' },
  /** Modal max widths matching shadcn/partner conventions */
  modal: { sm: '24rem', md: '32rem', lg: '40rem', xl: '48rem', '2xl': '60rem', full: '90vw' },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// 2. THEME — SEMANTIC COLOR ROLES (Material 3 style, light + dark pairs)
// Each role resolves to a palette stop. Light first, dark second.
// ─────────────────────────────────────────────────────────────────────────────

export const themeColors = {
  /** Surfaces (page background + cards) */
  surface:                  { light: palette.slate[50],   dark: palette.slate[900] },
  surfaceContainer:         { light: palette.white,       dark: palette.slate[800] },
  surfaceContainerLow:      { light: palette.slate[50],   dark: palette.slate[800] },
  surfaceContainerHigh:     { light: palette.slate[100],  dark: palette.slate[700] },
  onSurface:                { light: palette.slate[900],  dark: palette.slate[100] },
  onSurfaceVariant:         { light: palette.slate[600],  dark: palette.slate[400] },
  onSurfaceContainer:       { light: palette.slate[900],  dark: palette.slate[100] },

  /** Borders / outlines */
  outline:                  { light: palette.slate[200],  dark: palette.slate[700] },
  outlineVariant:           { light: palette.slate[100],  dark: palette.slate[800] },

  /** Brand */
  primary:                  { light: palette.blue[500],   dark: palette.blue[400] },
  onPrimary:                { light: palette.white,       dark: palette.white },
  primaryContainer:         { light: palette.blue[50],    dark: palette.blue[900] },
  onPrimaryContainer:       { light: palette.blue[700],   dark: palette.blue[100] },

  /** Secondary container = neutral accent (Figma: secondary-container/blue 50-900) */
  secondaryContainer:       { light: palette.blue[50],    dark: palette.blue[900] },
  onSecondaryContainer:     { light: palette.blue[700],   dark: palette.blue[300] },

  /** Status — light mode 600, dark mode 400 (mirrors Figma's success-light/dark, etc.) */
  error:                    { light: palette.red[600],    dark: palette.red[400] },
  onError:                  { light: palette.white,       dark: palette.red[900] },
  errorContainer:           { light: palette.red[50],     dark: palette.red[900] },
  onErrorContainer:         { light: palette.red[700],    dark: palette.red[100] },

  success:                  { light: palette.green[600],  dark: palette.green[400] },
  onSuccess:                { light: palette.white,       dark: palette.green[900] },
  successContainer:         { light: palette.green[50],   dark: palette.green[900] },
  onSuccessContainer:       { light: palette.green[700],  dark: palette.green[100] },

  warning:                  { light: palette.amber[600],  dark: palette.amber[400] },
  onWarning:                { light: palette.white,       dark: palette.amber[900] },
  warningContainer:         { light: palette.amber[50],   dark: palette.amber[900] },
  onWarningContainer:       { light: palette.amber[700],  dark: palette.amber[100] },

  /** Extended brand hues — orange/purple/violet/fuchsia (from Figma theme) */
  orange:                   { light: palette.orange[600], dark: palette.orange[400] },
  onOrange:                 { light: palette.white,       dark: palette.orange[900] },
  orangeContainer:          { light: palette.orange[50],  dark: palette.orange[900] },
  onOrangeContainer:        { light: palette.orange[700], dark: palette.orange[100] },

  violet:                   { light: palette.violet[600], dark: palette.violet[400] },
  onViolet:                 { light: palette.white,       dark: palette.violet[900] },
  violetContainer:          { light: palette.violet[50],  dark: palette.violet[900] },
  onVioletContainer:        { light: palette.violet[700], dark: palette.violet[100] },

  purple:                   { light: palette.purple[600], dark: palette.purple[400] },
  onPurple:                 { light: palette.white,       dark: palette.purple[900] },
  purpleContainer:          { light: palette.purple[50],  dark: palette.purple[900] },
  onPurpleContainer:        { light: palette.purple[700], dark: palette.purple[100] },

  fuchsia:                  { light: palette.fuchsia[600], dark: palette.fuchsia[400] },
  onFuchsia:                { light: palette.white,        dark: palette.fuchsia[900] },
  fuchsiaContainer:         { light: palette.fuchsia[50],  dark: palette.fuchsia[900] },
  onFuchsiaContainer:       { light: palette.fuchsia[700], dark: palette.fuchsia[100] },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// 2. THEME — SHORT-FORM SEMANTIC ALIASES (legacy code-paths)
// ─────────────────────────────────────────────────────────────────────────────

export const color = {
  // Brand
  primary: palette.blue[500],
  primaryHover: palette.blue[600],
  primaryForeground: palette.white,

  // Surface
  background: '#F4F6FA',
  foreground: palette.slate[900],
  card: palette.white,
  cardForeground: palette.slate[900],
  popover: palette.white,
  popoverForeground: palette.slate[900],

  // Secondary / muted / accent
  secondary: palette.slate[100],
  secondaryForeground: palette.slate[900],
  muted: palette.slate[100],
  mutedForeground: palette.slate[600],
  accent: palette.blue[50],
  accentForeground: palette.blue[800],

  // Borders, inputs, ring
  border: palette.slate[200],
  input: palette.slate[200],
  inputBackground: palette.slate[100],
  ring: '#7BBAFC',

  // Status
  success: palette.emerald[600],
  successForeground: palette.white,
  warning: palette.amber[600],
  warningForeground: palette.white,
  destructive: palette.red[600],
  destructiveForeground: palette.white,

  // Extended hues
  violet: palette.violet[600],
  violetForeground: palette.white,
  orange: palette.orange[700],
  orangeForeground: palette.white,
  purple: palette.purple[600],
  purpleForeground: palette.white,
  fuchsia: palette.fuchsia[600],
  fuchsiaForeground: palette.white,

  // Charts
  chart: {
    1: palette.blue[500],
    2: palette.emerald[600],
    3: palette.amber[500],
    4: palette.violet[600],
    5: palette.red[500],
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// SEMANTIC DOMAIN TOKENS — Invoice status / type pill palettes
// ─────────────────────────────────────────────────────────────────────────────

export const invoiceStatusTokens = {
  'Pending Approval': { bg: palette.indigo[50], fg: palette.indigo[700], border: palette.indigo[200] },
  Approved:           { bg: palette.emerald[50], fg: palette.emerald[700], border: palette.emerald[200] },
  'Partially Paid':   { bg: palette.orange[50], fg: palette.orange[700], border: palette.orange[200] },
  'Paid in Full':     { bg: palette.emerald[100], fg: palette.emerald[800], border: palette.emerald[300] },
  Exception:          { bg: palette.red[100], fg: palette.red[800], border: palette.red[300] },
  'Payment Hold':     { bg: palette.yellow[100], fg: palette.yellow[800], border: palette.yellow[200] },
  Cancelled:          { bg: palette.red[50], fg: palette.red[700], border: palette.red[200] },
} as const;

export const invoiceTypeTokens = {
  'PO-based':        { bg: palette.blue[50],   fg: palette.blue[700],   border: palette.blue[200],   label: 'PO Invoice' },
  'Receiving-based': { bg: palette.green[50],  fg: palette.green[700],  border: palette.green[200],  label: 'Receiving' },
  'GRN-based':       { bg: palette.green[50],  fg: palette.green[700],  border: palette.green[200],  label: 'Receiving' },
  Standalone:        { bg: palette.purple[50], fg: palette.violet[600], border: palette.violet[200], label: 'Standalone' },
  'Pre-Invoice':     { bg: palette.yellow[50], fg: palette.yellow[700], border: palette.yellow[200], label: 'Pre-Invoice' },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// 2. THEME — SHADOWS (55 in Figma; key elevation stops here)
// ─────────────────────────────────────────────────────────────────────────────

export const shadow = {
  none: 'none',
  xs: '0 1px 2px rgba(0,0,0,0.04)',
  sm: '0 1px 2px rgba(0,0,0,0.04), 0 1px 4px rgba(0,0,0,0.04)',
  md: '0 2px 6px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)',
  lg: '0 4px 12px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.08)',
  xl: '0 8px 20px rgba(0,0,0,0.08), 0 24px 48px rgba(0,0,0,0.12)',
  '2xl': '0 24px 48px rgba(0,0,0,0.16), 0 36px 72px rgba(0,0,0,0.18)',
  inner: 'inset 0 2px 4px rgba(0,0,0,0.05)',
  /** Partner QuickViewPanel modal shadow */
  modal: '0 0 0 1px rgba(0,0,0,0.03), 0 8px 20px rgba(0,0,0,0.08), 0 24px 56px rgba(0,0,0,0.14)',
  /** Soft inset for sticky-column right edge */
  stickyLeftEdge: 'inset -1px 0 0 0 rgba(0,0,0,0.08), 3px 0 6px -2px rgba(0,0,0,0.06)',
  /** Soft inset for sticky-actions left edge */
  stickyRightEdge: 'inset 1px 0 0 0 rgba(0,0,0,0.08)',
  /** Focus ring (light) */
  focusRing: '0 0 0 2px hsl(var(--ring) / 0.25)',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// 2. THEME — TYPOGRAPHY (font scale xs → 9xl, 9 weights)
// ─────────────────────────────────────────────────────────────────────────────

export const font = {
  family: {
    sans: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
    display: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  features: '"cv01", "cv02", "cv03", "cv04", "cv11", "ss01", "ss03"',
  /** 9 weight stops (Figma font-weight count = 9) */
  weight: {
    thin: 100,
    extralight: 200,
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
    black: 900,
  },
  /** Font sizes xs → 9xl. Each has a paired line-height per Figma. */
  size: {
    '2xs':  { px: 10, rem: '0.625rem',  lineHeight: '0.875rem' },
    xs:     { px: 11, rem: '0.6875rem', lineHeight: '1rem' },
    sm:     { px: 13, rem: '0.8125rem', lineHeight: '1.125rem' },
    base:   { px: 14, rem: '0.875rem',  lineHeight: '1.25rem' },
    md:     { px: 15, rem: '0.9375rem', lineHeight: '1.375rem' },
    lg:     { px: 17, rem: '1.0625rem', lineHeight: '1.5rem' },
    xl:     { px: 19, rem: '1.1875rem', lineHeight: '1.5rem' },
    '2xl':  { px: 24, rem: '1.5rem',    lineHeight: '1.75rem' },
    '3xl':  { px: 30, rem: '1.875rem',  lineHeight: '2.25rem' },
    '4xl':  { px: 36, rem: '2.25rem',   lineHeight: '2.5rem' },
    '5xl':  { px: 48, rem: '3rem',      lineHeight: '1' },
    '6xl':  { px: 60, rem: '3.75rem',   lineHeight: '1' },
    '7xl':  { px: 72, rem: '4.5rem',    lineHeight: '1' },
    '8xl':  { px: 96, rem: '6rem',      lineHeight: '1' },
    '9xl':  { px: 128, rem: '8rem',     lineHeight: '1' },
  },
  /** Heading-level shorthands kept for existing CSS layer in index.css */
  heading: {
    h1: { fontSize: '1.5rem', fontWeight: 500, lineHeight: 1.5, letterSpacing: '-0.025em' },
    h2: { fontSize: '1.25rem', fontWeight: 500, lineHeight: 1.5, letterSpacing: '-0.02em' },
    h3: { fontSize: '1.125rem', fontWeight: 500, lineHeight: 1.5, letterSpacing: '-0.015em' },
    h4: { fontSize: '1rem', fontWeight: 500, lineHeight: 1.5, letterSpacing: '-0.01em' },
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// 4. CUSTOM — Typography presets (display-large/medium, headline-large/medium)
// and structural padding (container/section/title-gap) — Figma "Custom" collection
// ─────────────────────────────────────────────────────────────────────────────

export const typography = {
  /** Display large — used for hero numbers/marketing headers */
  displayLarge: {
    fontFamily: font.family.sans,
    fontSize: { desktop: font.size['6xl'].rem, mobile: font.size['5xl'].rem },
    lineHeight: { desktop: font.size['6xl'].lineHeight, mobile: font.size['5xl'].lineHeight },
    fontWeight: font.weight.semibold,
    letterSpacing: { desktop: '-1.5px', mobile: '-1.2px' },
  },
  /** Display medium */
  displayMedium: {
    fontFamily: font.family.sans,
    fontSize: { desktop: font.size['5xl'].rem, mobile: font.size['4xl'].rem },
    lineHeight: { desktop: font.size['5xl'].lineHeight, mobile: font.size['4xl'].lineHeight },
    fontWeight: font.weight.semibold,
    letterSpacing: { desktop: '-1.2px', mobile: '-0.9px' },
  },
  /** Headline large — page titles */
  headlineLarge: {
    fontFamily: font.family.sans,
    fontSize: { desktop: font.size['5xl'].rem, mobile: font.size['4xl'].rem },
    lineHeight: { desktop: font.size['5xl'].lineHeight, mobile: font.size['4xl'].lineHeight },
    fontWeight: font.weight.semibold,
    letterSpacing: { desktop: '-1px', mobile: '-0.7px' },
  },
  /** Headline medium — section titles */
  headlineMedium: {
    fontFamily: font.family.sans,
    fontSize: { desktop: font.size['4xl'].rem, mobile: font.size['3xl'].rem },
    lineHeight: { desktop: font.size['4xl'].lineHeight, mobile: font.size['3xl'].lineHeight },
    fontWeight: font.weight.semibold,
    letterSpacing: { desktop: '-0.8px', mobile: '-0.5px' },
  },
} as const;

export const layout = {
  /** Page container horizontal padding (Custom collection: container-padding-x) */
  containerPaddingX: { desktop: spacing[8], mobile: spacing[4] },
  /** Major-section vertical padding (Custom collection: section-padding-y) */
  sectionPaddingY:   { desktop: spacing[24], mobile: spacing[16] },
  /** Section-title gap (Custom collection: section-title-gap-{xl|lg|md|sm}) */
  sectionTitleGap: {
    xl: { desktop: spacing[6], mobile: spacing[5] },
    lg: { desktop: spacing[5], mobile: spacing[4] },
    md: { desktop: spacing[5], mobile: spacing[4] },
    sm: { desktop: spacing[4], mobile: spacing[4] },
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// MOTION
// ─────────────────────────────────────────────────────────────────────────────

export const motion = {
  duration: {
    instant: '100ms',
    fast: '150ms',
    base: '200ms',
    slow: '300ms',
    deliberate: '500ms',
  },
  ease: {
    standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
    out: 'cubic-bezier(0.16, 1, 0.3, 1)',
    in: 'cubic-bezier(0.4, 0, 1, 1)',
    bounce: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    spring: 'cubic-bezier(0.5, 1.5, 0.5, 1)',
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// 5. ICON LIBRARY — Lucide is the default per Figma's Icon Library collection
// ─────────────────────────────────────────────────────────────────────────────

export const iconLibrary = {
  default: 'lucide',
  available: ['lucide', 'tabler', 'hugeicons', 'phosphor', 'remix'] as const,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// SINGLE OBJECT EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export const tokens = {
  palette,
  accent,
  themeColors,
  color,
  invoiceStatusTokens,
  invoiceTypeTokens,
  spacing,
  radius,
  borderWidth,
  strokeWidth,
  opacity,
  lineHeight,
  breakpoint,
  sizing,
  shadow,
  font,
  typography,
  layout,
  motion,
  iconLibrary,
} as const;

export type Tokens = typeof tokens;
export default tokens;
