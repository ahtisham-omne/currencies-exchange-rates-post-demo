import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * Reusable Button component adhering to the design system.
 * All spacing uses 4px grid, CSS variables only, Inter font.
 */

type ButtonVariant = "primary" | "secondary" | "accent" | "destructive" | "ghost" | "success";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconPosition?: "left" | "right";
  children?: ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90 border-primary",
  secondary: "bg-card text-foreground/70 hover:bg-secondary hover:text-foreground border-border",
  accent: "bg-accent text-accent-foreground hover:bg-accent/90 border-accent",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 border-destructive",
  ghost: "bg-transparent text-foreground/70 hover:bg-secondary hover:text-foreground border-transparent",
  success: "text-white border-[#16A34A] hover:border-[#15803D]",
};

const sizeStyles: Record<ButtonSize, { padding: string; fontSize: string; gap: string }> = {
  sm: { padding: "4px 12px", fontSize: "var(--text-caption)", gap: "4px" },
  md: { padding: "8px 16px", fontSize: "var(--text-label)", gap: "8px" },
  lg: { padding: "12px 20px", fontSize: "var(--text-base)", gap: "8px" },
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", icon, iconPosition = "left", children, className = "", disabled, ...props }, ref) => {
    const variantClass = variantStyles[variant];
    const sizeStyle = sizeStyles[size];
    const isBordered = variant === "secondary" || variant === "ghost";
    const isSuccess = variant === "success";
    const isGhost = variant === "ghost";

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={`inline-flex items-center justify-center rounded-lg border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap ${variantClass} ${className}`}
        style={{
          fontWeight: "var(--font-weight-medium)",
          fontSize: sizeStyle.fontSize,
          padding: sizeStyle.padding,
          gap: sizeStyle.gap,
          ...(isGhost ? {} : { boxShadow: "var(--elevation-1)" }),
          ...(isSuccess ? { backgroundColor: "#16A34A" } : {}),
        }}
        onMouseEnter={isSuccess ? (e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#15803D"; } : undefined}
        onMouseLeave={isSuccess ? (e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#16A34A"; } : undefined}
        {...props}
      >
        {icon && iconPosition === "left" && icon}
        {children}
        {icon && iconPosition === "right" && icon}
      </button>
    );
  }
);

Button.displayName = "Button";