"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";
import { Check, Info, TriangleAlert, X } from "lucide-react";

/* Omne toast design (ported from vendor-invoicing) — white card with a soft
   per-type gradient wash radiating from the icon corner, a solid colored icon
   circle, bold title, muted description, and a top-right close X.
   Gradient + close-button placement live in index.css
   (.toast-grad-* / [data-close-button]). */

export function IconCircle({ bg, halo, children }: { bg: string; halo: string; children: React.ReactNode }) {
  return (
    <span
      className="w-5 h-5 rounded-full flex items-center justify-center text-white shrink-0"
      style={{ backgroundColor: bg, boxShadow: `0 0 0 4px ${halo}` }}
    >
      {children}
    </span>
  );
}

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      closeButton
      icons={{
        success: (
          <IconCircle bg="rgb(var(--success))" halo="rgba(31, 152, 96, 0.14)">
            <Check className="w-3 h-3" strokeWidth={3.5} />
          </IconCircle>
        ),
        info: (
          <IconCircle bg="rgb(var(--primary))" halo="rgba(10, 119, 255, 0.13)">
            <Info className="w-3 h-3" strokeWidth={3} />
          </IconCircle>
        ),
        warning: (
          <IconCircle bg="rgb(var(--warning))" halo="rgba(219, 119, 6, 0.14)">
            <TriangleAlert className="w-3 h-3" strokeWidth={3} />
          </IconCircle>
        ),
        error: (
          <IconCircle bg="rgb(var(--destructive))" halo="rgba(220, 40, 40, 0.13)">
            <X className="w-3 h-3" strokeWidth={3.5} />
          </IconCircle>
        ),
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-white/95 group-[.toaster]:backdrop-blur-md group-[.toaster]:text-foreground group-[.toaster]:border group-[.toaster]:border-black/5 group-[.toaster]:shadow-[0_10px_40px_-10px_rgba(15,23,42,0.25)] group-[.toaster]:rounded-2xl group-[.toaster]:items-start group-[.toaster]:gap-2.5 group-[.toaster]:px-3.5 group-[.toaster]:py-3",
          title: "group-[.toast]:text-[13px] group-[.toast]:font-semibold group-[.toast]:text-foreground group-[.toast]:leading-snug",
          description: "group-[.toast]:text-slate-500 group-[.toast]:text-[12px] group-[.toast]:leading-snug",
          icon: "group-[.toast]:mt-px",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success: "toast-grad-success",
          info: "toast-grad-info",
          warning: "toast-grad-warning",
          error: "toast-grad-error",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
