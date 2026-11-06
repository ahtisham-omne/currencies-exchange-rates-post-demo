import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../ui/utils";

/**
 * QuoteButton — Quote module's shared button primitive aligned to Partner's
 * canonical inline button specs.
 *
 * Reference: Partner's `EditCta` (VendorDetailsPage.tsx:577-585) and modal
 * footer buttons in `CreatePartnerLocationModal.tsx:986-998`.
 *
 * Use this in place of inline `<button style={{...}}>` in Quote-specific UI.
 * Use shadcn `<Button>` if you want shadcn's built-in variants.
 */
const quoteButtonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg transition-all duration-200 cursor-pointer disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-white hover:bg-[#0862D0] shadow-sm",
        secondary:
          "border border-border bg-white text-slate-700 hover:bg-slate-50 shadow-sm",
        destructive:
          "bg-destructive text-white hover:opacity-90 shadow-sm",
        outline:
          "border border-border text-slate-500 hover:text-foreground hover:border-slate-300 bg-transparent",
        ghost:
          "text-slate-500 hover:text-foreground hover:bg-slate-50 bg-transparent",
        link:
          "text-primary hover:text-[#0862D0] bg-transparent underline-offset-4 hover:underline",
        // For icon-only square buttons in headers/toolbars
        iconOnly:
          "border border-border bg-white text-slate-500 hover:bg-slate-50 hover:text-foreground shadow-sm",
      },
      size: {
        // Default action button — Partner's h-9 px-4 text-[13px]
        default: "h-9 px-4 text-[13px]",
        // Compact action — Partner's h-8 px-3.5 text-[12px]
        sm: "h-8 px-3.5 text-[12px]",
        // Larger action — for stand-alone CTAs
        lg: "h-10 px-5 text-[14px]",
        // Icon-only square sizes (use with variant="iconOnly")
        icon: "w-9 h-9",
        iconSm: "w-8 h-8",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

export interface QuoteButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof quoteButtonVariants> {
  asChild?: boolean;
}

export const QuoteButton = React.forwardRef<HTMLButtonElement, QuoteButtonProps>(
  ({ className, variant, size, asChild = false, style, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(quoteButtonVariants({ variant, size }), className)}
        style={{ fontWeight: variant === "ghost" || variant === "link" ? 500 : 600, ...style }}
        {...props}
      />
    );
  },
);
QuoteButton.displayName = "QuoteButton";

export { quoteButtonVariants };
