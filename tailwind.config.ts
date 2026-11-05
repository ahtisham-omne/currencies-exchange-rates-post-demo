import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
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
        /* Override Tailwind's default `2xl: 1536px` → 2049px so every laptop
           (14" MBP, 15/16" MBP, 17" LG Gram Pro, most 1080p laptops) lands
           on the SMALL side of our binary responsive pivot. Only true
           desktop monitors (27" 1440p at 2560 native, 4K, ultrawide) trip
           the `2xl:` big-screen variants. Sync with the CSS media query in
           `index.css` (`--planner-cell-fs` uses max-width: 2048px). */
        "2xl": "2049px",
        "3xl": "2561px",
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        "input-background": "hsl(var(--input-background))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          tint: "hsl(var(--primary-tint))",
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
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
          tint: "hsl(var(--success-tint))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
          tint: "hsl(var(--warning-tint))",
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
        danger: "hsl(var(--danger))",
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
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 4px)",
      },
      boxShadow: {
        "elevation-sm": "var(--elevation-sm)",
        "elevation-md": "var(--elevation-md)",
        "elevation-lg": "var(--elevation-lg)",
        "elevation-drag": "var(--elevation-drag)",
        "elevation-card": "var(--elevation-card)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0", opacity: "0" },
          to: { height: "var(--radix-accordion-content-height)", opacity: "1" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)", opacity: "1" },
          to: { height: "0", opacity: "0" },
        },
        "modal-enter": {
          from: { opacity: "0", transform: "translate(-50%, -50%) scale(0.96)" },
          to: { opacity: "1", transform: "translate(-50%, -50%) scale(1)" },
        },
        "modal-exit": {
          from: { opacity: "1", transform: "translate(-50%, -50%) scale(1)" },
          to: { opacity: "0", transform: "translate(-50%, -50%) scale(0.96)" },
        },
        "lightbox-enter": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "overlay-enter": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "overlay-exit": {
          from: { opacity: "1" },
          to: { opacity: "0" },
        },
        "dropdown-enter": {
          from: { opacity: "0", transform: "scaleY(0.96) translateY(-4px)" },
          to: { opacity: "1", transform: "scaleY(1) translateY(0)" },
        },
        "page-fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-in-from-right-subtle": {
          from: { opacity: "0", transform: "translateX(30px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "tab-fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        "accordion-up": "accordion-up 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        "modal-enter": "modal-enter 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        "lightbox-enter": "lightbox-enter 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        "modal-exit": "modal-exit 0.15s cubic-bezier(0.4, 0, 1, 1)",
        "overlay-enter": "overlay-enter 0.2s ease-out",
        "overlay-exit": "overlay-exit 0.15s ease-in",
        "dropdown-enter": "dropdown-enter 0.15s cubic-bezier(0.16, 1, 0.3, 1)",
        "page-fade-in": "page-fade-in 0.2s ease-out",
        "slide-in-right": "slide-in-from-right-subtle 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        "tab-fade-in": "tab-fade-in 0.15s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/container-queries")],
} satisfies Config;
