import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
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
      // Inter everywhere — mono intentionally maps to Inter so no element
      // (including <pre>) can fall back to a system monospace stack.
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
      },
      colors: {
        border: "rgb(var(--border) / <alpha-value>)",
        input: "rgb(var(--input) / <alpha-value>)",
        ring: "rgb(var(--ring) / <alpha-value>)",
        background: "rgb(var(--background) / <alpha-value>)",
        foreground: "rgb(var(--foreground) / <alpha-value>)",
        primary: {
          DEFAULT: "rgb(var(--primary) / <alpha-value>)",
          foreground: "rgb(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "rgb(var(--secondary) / <alpha-value>)",
          foreground: "rgb(var(--secondary-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "rgb(var(--destructive) / <alpha-value>)",
          foreground: "rgb(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "rgb(var(--muted) / <alpha-value>)",
          foreground: "rgb(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          foreground: "rgb(var(--accent-foreground) / <alpha-value>)",
        },
        success: {
          DEFAULT: "rgb(var(--success) / <alpha-value>)",
          foreground: "rgb(var(--success-foreground) / <alpha-value>)",
        },
        warning: {
          DEFAULT: "rgb(var(--warning) / <alpha-value>)",
          foreground: "rgb(var(--warning-foreground) / <alpha-value>)",
        },
        violet: {
          DEFAULT: "rgb(var(--violet) / <alpha-value>)",
          foreground: "rgb(var(--violet-foreground) / <alpha-value>)",
        },
        orange: {
          DEFAULT: "rgb(var(--orange) / <alpha-value>)",
          foreground: "rgb(var(--orange-foreground) / <alpha-value>)",
        },
        purple: {
          DEFAULT: "rgb(var(--purple) / <alpha-value>)",
          foreground: "rgb(var(--purple-foreground) / <alpha-value>)",
        },
        fuchsia: {
          DEFAULT: "rgb(var(--fuchsia) / <alpha-value>)",
          foreground: "rgb(var(--fuchsia-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "rgb(var(--popover) / <alpha-value>)",
          foreground: "rgb(var(--popover-foreground) / <alpha-value>)",
        },
        card: {
          DEFAULT: "rgb(var(--card) / <alpha-value>)",
          foreground: "rgb(var(--card-foreground) / <alpha-value>)",
        },
        sidebar: {
          DEFAULT: "rgb(var(--sidebar-background) / <alpha-value>)",
          foreground: "rgb(var(--sidebar-foreground) / <alpha-value>)",
          primary: "rgb(var(--sidebar-primary) / <alpha-value>)",
          "primary-foreground": "rgb(var(--sidebar-primary-foreground) / <alpha-value>)",
          accent: "rgb(var(--sidebar-accent) / <alpha-value>)",
          "accent-foreground": "rgb(var(--sidebar-accent-foreground) / <alpha-value>)",
          border: "rgb(var(--sidebar-border) / <alpha-value>)",
          ring: "rgb(var(--sidebar-ring) / <alpha-value>)",
        },
        // ── Omne DS v2.0 blue ramp (blue/500 = #0A77FF = primary) ──
        // Overrides Tailwind's default #3B82F6-based blue so every
        // `blue-*` utility across the app matches the DS primary and
        // its tints/shades. `sky` mirrors it (DS sky is also #0A77FF).
        blue: {
          50: "#EBF3FF",
          100: "#CFE6FF",
          200: "#A8D2FF",
          300: "#7AB8FF",
          400: "#3D98FF",
          500: "#0A77FF",
          600: "#086AE6",
          700: "#094D9F",
          800: "#0548A3",
          900: "#052E5C",
          950: "#172554",
        },
        sky: {
          50: "#EAF4FF",
          100: "#CFE6FF",
          200: "#A8D2FF",
          300: "#7FBFFF",
          400: "#4DA3FF",
          500: "#0A77FF",
          600: "#086AE6",
          700: "#075CCC",
          800: "#0548A3",
          900: "#033266",
        },
      },
      // ── DS border-radius scale (px) ──
      borderRadius: {
        none: "0px",
        xs: "var(--radius-xs)",   /* 2px */
        sm: "var(--radius-sm)",   /* 6px */
        md: "var(--radius-md)",   /* 8px */
        lg: "var(--radius-lg)",   /* 8px */
        xl: "var(--radius-xl)",   /* 14px */
        "2xl": "var(--radius-2xl)", /* 16px */
        "3xl": "var(--radius-3xl)", /* 24px */
        "4xl": "var(--radius-4xl)", /* 32px */
        full: "9999px",
      },
      // ── DS type ramp extras (standard sizes match Tailwind) ──
      fontSize: {
        "3xs": ["10px", { lineHeight: "14px" }],
        "2xs": ["11px", { lineHeight: "15px" }],
        "xs-sm": ["13px", { lineHeight: "18px" }],
        "sm-base": ["15px", { lineHeight: "22px" }],
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/container-queries")],
} satisfies Config;
