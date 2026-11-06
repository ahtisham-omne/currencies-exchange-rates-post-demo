import React from "react";
import { Info } from "lucide-react";

/**
 * Partner Management's canonical "titled section card" pattern.
 *
 * White body, light-gray header strip with icon chip + title + optional
 * REQUIRED tag, soft border + light shadow.
 *
 * Use this for ANY titled section inside a modal, drawer, or tab content
 * area. Do NOT re-implement the chrome inline.
 *
 * Reference: Partner's CreatePartnerModal "Partner Details" section.
 */
export function TitledSection({
  title,
  icon: Icon = Info,
  required,
  trailing,
  bodyClassName,
  className,
  children,
}: {
  title: string;
  icon?: React.ElementType;
  required?: boolean;
  trailing?: React.ReactNode;
  bodyClassName?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border border-border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] ${className ?? ""}`}
    >
      <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-b border-[#EEF2F6] flex items-center gap-2 bg-[#FAFBFC] rounded-t-xl">
        <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="w-3.5 h-3.5 text-primary" />
        </div>
        <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
          <span
            className="text-xs sm:text-[13px] text-foreground truncate"
            style={{ fontWeight: 600 }}
          >
            {title}
          </span>
          {required && (
            <span
              className="text-[9px] sm:text-[10px] text-slate-400 tracking-wider uppercase hidden min-[480px]:inline"
              style={{ fontWeight: 500 }}
            >
              Required
            </span>
          )}
        </div>
        {trailing && <div className="shrink-0 ml-auto inline-flex items-center">{trailing}</div>}
      </div>
      <div className={bodyClassName ?? "px-2.5 sm:px-3 pt-2 sm:pt-2.5 pb-1.5 sm:pb-2"}>
        {children}
      </div>
    </div>
  );
}
