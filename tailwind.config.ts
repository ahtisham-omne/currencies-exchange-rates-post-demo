import type { Config } from "tailwindcss";

/* Theme is Chart of Accounts' (chart-of-accounts-v2.1/tailwind.config.js), so the
   Currency & Exchange screens match it exactly; container, the 3xl screen, the
   accordion animations and the plugins are this app's own. */
export default {
  darkMode: ['class'],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      screens: {
        "3xl": "1921px",
      },
      colors: {
        /* ─── Omnesoft ERP design tokens (HSL vars in index.css) ───
           Mirrors the Partner Management — Vendors token system so the
           Chart of Accounts module lives inside the same shell. */
        border: {
          DEFAULT: 'hsl(var(--border))',
          subtle: 'hsl(var(--border))',
          strong: 'var(--border-strong)',
        },
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        violet: { DEFAULT: 'hsl(var(--violet))', foreground: 'hsl(var(--violet-foreground))' },
        orange: { DEFAULT: 'hsl(var(--orange))', foreground: 'hsl(var(--orange-foreground))' },
        purple: {
          DEFAULT: 'hsl(var(--purple))', foreground: 'hsl(var(--purple-foreground))',
          50: '#FAF5FF', 100: '#F3E8FF', 500: '#A855F7', 600: '#9333EA', 700: '#7E22CE',
        },
        fuchsia: { DEFAULT: 'hsl(var(--fuchsia))', foreground: 'hsl(var(--fuchsia-foreground))' },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },

        /* ─── Backward-compat aliases (remapped onto the ERP palette) ───
           Existing Chart of Accounts pages reference these names; they now
           resolve to the shared Omnesoft tokens so the whole app picks up
           the blue palette with no per-page edits. */
        bg: {
          DEFAULT: 'hsl(var(--background))',
          subtle: 'hsl(var(--muted))',
          muted: 'hsl(var(--muted))',
        },
        fg: {
          DEFAULT: 'hsl(var(--foreground))',
          muted: 'hsl(var(--muted-foreground))',
          subtle: 'hsl(var(--muted-foreground))',
          inverted: 'hsl(var(--primary-foreground))',
        },
        /* brand → primary blue scale (was violet) */
        brand: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
          50: '#F0FDF4', 100: '#DCFCE7', 500: '#22C55E', 600: '#16A34A', 700: '#15803D',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
          50: '#FFFBEB', 100: '#FEF3C7', 500: '#F59E0B', 600: '#D97706', 700: '#B45309',
        },
        danger: { 50: '#FEF2F2', 100: '#FEE2E2', 500: '#EF4444', 600: '#DC2626', 700: '#B91C1C' },
        info: { 50: '#EFF6FF', 100: '#DBEAFE', 500: '#3B82F6', 600: '#2563EB', 700: '#1D4ED8' },
        teal: { 50: '#F0FDFA', 100: '#CCFBF1', 500: '#14B8A6', 600: '#0D9488', 700: '#0F766E' },
      },
      fontFamily: {
        // Single typeface everywhere — no monospace. `mono` intentionally maps to
        // the same Inter sans stack so any residual `font-mono` renders in the
        // standard font (numbers included); use `tabular-nums` for digit alignment.
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['11px', '14px'],
        // Omne DS in-between sizes (mirrors the Partners module scale) so the
        // ported Insights/KPI UI sizes match exactly.
        '10': ['10px', { lineHeight: '14px' }],
        '11': ['11px', { lineHeight: '16px' }],
        '13': ['13px', { lineHeight: '18px' }],
        '15': ['15px', { lineHeight: '20px' }],
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '8px',
        lg: '10px',
        xl: '12px',
        '2xl': '16px',
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgba(0, 0, 0, 0.04)',
        sm: '0 1px 3px 0 rgba(0, 0, 0, 0.06), 0 1px 2px -1px rgba(0, 0, 0, 0.04)',
        DEFAULT: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.04)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.06), 0 4px 6px -4px rgba(0, 0, 0, 0.04)',
        xl: '0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
        panel: '0 0 0 1px rgba(0, 0, 0, 0.04), 0 1px 2px 0 rgba(0, 0, 0, 0.04)',
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        // Modal + overlay open animations, mirroring the Cash Management
        // (shadcn/tailwindcss-animate) fade + zoom-in feel.
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'modal-in': {
          from: { opacity: '0', transform: 'translateY(8px) scale(0.97)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(24px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        // Per-step content transition (wizard steps + landing steps).
        'step-in': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        // Page entrance — a gentle fade + rise when a listing page mounts.
        'page-in': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        // Dropdown panels. Two directions because a panel that flips above its
        // trigger has to grow upward out of the same edge, or it reads as
        // arriving from somewhere the click didn't happen. Shorter and smaller
        // travel than 'modal-in': a menu is a response to a click on a nearby
        // thing, not a new surface, so it should land before the pointer moves.
        // Both end on `none`, not on the identity transform: these animations run
        // with fill-mode `both`, so a `scale(1)` end state would stay applied and
        // leave the panel as the containing block for any fixed-position
        // descendant - which would silently re-anchor a nested popover.
        'popover-down': {
          from: { opacity: '0', transform: 'translateY(-4px) scale(0.98)' },
          to: { opacity: '1', transform: 'none' },
        },
        'popover-up': {
          from: { opacity: '0', transform: 'translateY(4px) scale(0.98)' },
          to: { opacity: '1', transform: 'none' },
        },
        // A row arriving in the group above it - answering a dimension moves it
        // from "Available, not applied" to "Set on this account", and the move
        // is the whole of what applying looks like. The tint holds for a beat
        // and then clears: it marks the arrival, and a row left highlighted
        // would be saying something about the row instead.
        'row-applied': {
          '0%': { opacity: '0', transform: 'translateY(-6px)', backgroundColor: 'rgb(219 234 254)' },
          '30%': { opacity: '1', transform: 'translateY(0)', backgroundColor: 'rgb(219 234 254)' },
          '100%': { opacity: '1', transform: 'translateY(0)', backgroundColor: 'transparent' },
        },
        // The bob on an empty state's icon tile. The only motion in the module
        // that never settles, which is deliberate: it marks a surface as waiting
        // rather than broken, and there is nothing underneath it to distract from.
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        'row-applied': 'row-applied 700ms cubic-bezier(0.32,0.72,0,1) both',
        'fade-in': 'fade-in 200ms ease-out both',
        'overlay-in': 'fade-in 200ms ease-out both',
        'modal-in': 'modal-in 280ms cubic-bezier(0.32,0.72,0,1) both',
        'slide-in-right': 'slide-in-right 320ms cubic-bezier(0.32,0.72,0,1) both',
        'step-in': 'step-in 260ms ease-out both',
        'page-in': 'page-in 420ms cubic-bezier(0.32,0.72,0,1) both',
        'popover-down': 'popover-down 150ms cubic-bezier(0.16,1,0.3,1) both',
        'popover-up': 'popover-up 150ms cubic-bezier(0.16,1,0.3,1) both',
        float: 'float 4s ease-in-out infinite',
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/container-queries")],
} satisfies Config;
