import type { Config } from "tailwindcss";
import { tokens } from "./src/styles/tokens";

/**
 * Tailwind theme extends — the full palette / spacing / radius / shadow
 * scales mirror src/styles/tokens.ts. shadcn semantic colors stay wired
 * through hsl(var(--token)) so dark-mode keeps working, but every raw
 * palette stop is also exposed so `bg-blue-500` / `text-emerald-700` /
 * `rounded-token-xl` / `shadow-token-modal` resolve to design-system values.
 */
export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      screens: { "3xl": "1921px" },
      // Raw palette (every hue at 50–900) — exposed under each hue name so
      // `bg-blue-500` / `text-emerald-700` resolve via design-system tokens.
      colors: {
        ...tokens.palette,
        // Partner-specific accent tints — exposed as named utilities so
        // `bg-accent-row-hover` / `bg-accent-pill-active` etc. resolve to
        // the same hex constants defined in src/styles/tokens.ts under
        // `accent`. Replaces all the `bg-[#F0F7FF]`-style arbitrary class
        // strings that previously littered the codebase.
        "accent-row-hover":    tokens.accent.rowHover,    // #F0F7FF
        "accent-row-selected": tokens.accent.rowSelected, // #F8FAFF
        "accent-pill-hover":   tokens.accent.pillHover,   // #D6E8FF
        "accent-pill-active":  tokens.accent.pillActive,  // #ADD1FF
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        "input-background": "hsl(var(--input-background))",
        "switch-background": "hsl(var(--switch-background))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success) / <alpha-value>)",
          foreground: "hsl(var(--success-foreground) / <alpha-value>)",
        },
        warning: {
          DEFAULT: "hsl(var(--warning) / <alpha-value>)",
          foreground: "hsl(var(--warning-foreground) / <alpha-value>)",
        },
        violet: {
          DEFAULT: "hsl(var(--violet))",
          foreground: "hsl(var(--violet-foreground))",
        },
        orange: {
          DEFAULT: "hsl(var(--orange))",
          foreground: "hsl(var(--orange-foreground))",
        },
        purple: {
          DEFAULT: "hsl(var(--purple))",
          foreground: "hsl(var(--purple-foreground))",
        },
        fuchsia: {
          DEFAULT: "hsl(var(--fuchsia))",
          foreground: "hsl(var(--fuchsia-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
      },
      // Corner radius — `rounded-token-X` resolves to design-system tokens.
      // The existing `rounded-lg/md/sm/xl` keys keep the shadcn ladder
      // (var(--radius) ± steps) intact for compatibility.
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 4px)",
        "token-none":    tokens.radius.none,
        "token-xs":      tokens.radius.xs,
        "token-sm":      tokens.radius.sm,
        "token-md":      tokens.radius.md,
        "token-default": tokens.radius.default,
        "token-lg":      tokens.radius.lg,
        "token-xl":      tokens.radius.xl,
        "token-2xl":     tokens.radius["2xl"],
        "token-full":    tokens.radius.full,
      },

      // Box shadow — design-system elevation steps + named modal / sticky
      // patterns (used by the DataTable shell + modals).
      boxShadow: {
        "token-none": tokens.shadow.none,
        "token-xs":   tokens.shadow.xs,
        "token-sm":   tokens.shadow.sm,
        "token-md":   tokens.shadow.md,
        "token-lg":   tokens.shadow.lg,
        "token-xl":   tokens.shadow.xl,
        "token-modal": tokens.shadow.modal,
        "token-sticky-left":  tokens.shadow.stickyLeftEdge,
        "token-sticky-right": tokens.shadow.stickyRightEdge,
      },

      // Typography — Inter family + design-system size scale + named
      // heading weights. Existing Tailwind defaults (text-sm/base/xl/...)
      // remain available; the `text-token-X` aliases pin to the design system.
      fontFamily: {
        sans: tokens.font.family.sans.split(',').map((s) => s.trim().replace(/^"|"$/g, '')),
        mono: tokens.font.family.mono.split(',').map((s) => s.trim().replace(/^"|"$/g, '')),
      },
      fontSize: {
        "token-2xs":  [tokens.font.size["2xs"].rem,  { lineHeight: tokens.font.size["2xs"].lineHeight }],
        "token-xs":   [tokens.font.size.xs.rem,    { lineHeight: tokens.font.size.xs.lineHeight }],
        "token-sm":   [tokens.font.size.sm.rem,    { lineHeight: tokens.font.size.sm.lineHeight }],
        "token-base": [tokens.font.size.base.rem,  { lineHeight: tokens.font.size.base.lineHeight }],
        "token-md":   [tokens.font.size.md.rem,    { lineHeight: tokens.font.size.md.lineHeight }],
        "token-lg":   [tokens.font.size.lg.rem,    { lineHeight: tokens.font.size.lg.lineHeight }],
        "token-xl":   [tokens.font.size.xl.rem,    { lineHeight: tokens.font.size.xl.lineHeight }],
        "token-2xl":  [tokens.font.size["2xl"].rem, { lineHeight: tokens.font.size["2xl"].lineHeight }],
        "token-3xl":  [tokens.font.size["3xl"].rem, { lineHeight: tokens.font.size["3xl"].lineHeight }],
      },
      fontWeight: {
        "token-normal":   String(tokens.font.weight.normal),
        "token-medium":   String(tokens.font.weight.medium),
        "token-semibold": String(tokens.font.weight.semibold),
        "token-bold":     String(tokens.font.weight.bold),
      },

      // Transition tokens — keeps motion consistent with src/styles/tokens.ts
      transitionDuration: {
        "token-instant": tokens.motion.duration.instant,
        "token-fast":    tokens.motion.duration.fast,
        "token-base":    tokens.motion.duration.base,
        "token-slow":    tokens.motion.duration.slow,
      },
      transitionTimingFunction: {
        "token-standard": tokens.motion.ease.standard,
        "token-out":      tokens.motion.ease.out,
        "token-in":       tokens.motion.ease.in,
        "token-bounce":   tokens.motion.ease.bounce,
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
      },
      animation: {
        "accordion-down": "accordion-down 0.3s cubic-bezier(0.32,0.72,0,1)",
        "accordion-up": "accordion-up 0.3s cubic-bezier(0.32,0.72,0,1)",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/container-queries")],
} satisfies Config;
