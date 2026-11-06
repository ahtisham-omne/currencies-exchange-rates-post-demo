import React from "react";
import { Pencil } from "lucide-react";

/**
 * Small action / status card — Partner's "Select from Contact Directory" pattern.
 *
 * Layout:
 *   ┌──────────────────────────────────────────┐
 *   │  ⚙  Title                              ✏ │
 *   │     Subtitle / value text                │
 *   └──────────────────────────────────────────┘
 *
 * Used wherever a labeled card surfaces a value or a CTA in modals,
 * creation steps, side panels, etc. Replaces the older uppercase-heading
 * pattern (e.g. "EXPIRY DATE / 30 days after sent").
 */
interface SmallCardProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ElementType;
  /** Tailwind text color class for the icon. Defaults to `text-primary`. */
  iconColorClass?: string;
  /** Tailwind bg class for the icon chip. Defaults to `bg-accent`. */
  iconBgClass?: string;
  title: string;
  /** Text, or a node when the value needs a marker (a relative date). */
  subtitle?: React.ReactNode;
  /** Optional right-side adornment (badge, kbd hint, etc.). Falls back to a pencil if `editable`. */
  trailing?: React.ReactNode;
  /** When true (default), shows a subtle pencil affordance on the right. */
  editable?: boolean;
  /** Use to render rich content (chips, value rows) below title instead of a plain subtitle. */
  children?: React.ReactNode;
  /** Active state — applies a tinted background like Partner's selected cards. */
  active?: boolean;
  /** `field` renders the compact configuration-card chrome the Sales Order
   *  creation step uses: a small grey icon beside a grey label on the first
   *  line, a pencil at the right, and the value underneath. Use it for the
   *  date and priority cards so both modules read the same. */
  variant?: 'card' | 'field';
}

/* Forward the ref so Radix `Slot`-based parents (PopoverTrigger,
 * DropdownMenuTrigger, etc.) can attach to the underlying DOM node
 * without React warning that function components cannot receive refs. */
export const SmallCard = React.forwardRef<HTMLDivElement, SmallCardProps>(function SmallCard(
  {
    icon: Icon,
    iconColorClass = "text-primary",
    iconBgClass = "bg-accent",
    title,
    subtitle,
    trailing,
    editable = true,
    onClick,
    className,
    children,
    active = false,
    variant = 'card',
    ...rest
  },
  ref,
) {
  const clickable = !!onClick;

  if (variant === 'field') {
    /* Same measurements as the Sales Order configuration cards. */
    return (
      <div
        {...rest}
        ref={ref}
        role={clickable ? 'button' : undefined}
        tabIndex={clickable ? 0 : undefined}
        onKeyDown={(e) => {
          if (clickable && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick?.(e as unknown as React.MouseEvent<HTMLDivElement>); }
        }}
        onClick={onClick}
        className={`group relative ${clickable ? 'cursor-pointer' : ''} ${className ?? ''}`}
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '10px',
          padding: '10px 12px',
          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
          border: '1px solid #E5E7EB',
          transition: 'all 150ms',
        }}
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            {Icon && <Icon className="w-3.5 h-3.5 text-[#9CA3AF]" />}
            <label className="text-[11px] text-[#9CA3AF] tracking-wide" style={{ fontWeight: 500 }}>
              {title}
            </label>
          </div>
          {editable && <Pencil className="w-3 h-3 text-[#9CA3AF] group-hover:text-[#1B6EF3] transition-colors" />}
        </div>
        <div className="text-[14px] text-[#1F2937] leading-tight" style={{ fontWeight: 500 }}>
          {children ?? subtitle}
        </div>
      </div>
    );
  }

  return (
    <div
      {...rest}
      ref={ref}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={(e) => {
        if (clickable && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick?.(e as unknown as React.MouseEvent<HTMLDivElement>);
        }
      }}
      onClick={onClick}
      className={`group flex items-start gap-3 px-3.5 py-3 rounded-lg border transition-all ${
        active
          ? "border-primary/30 bg-[#EFF6FF]"
          : "border-border bg-white hover:bg-[#F0F7FF]"
      } ${clickable ? "cursor-pointer" : ""} ${className ?? ""}`}
      style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}
    >
      {Icon && (
        <div
          className={`w-9 h-9 rounded-lg ${iconBgClass} flex items-center justify-center shrink-0 mt-0.5`}
        >
          <Icon className={`w-4 h-4 ${iconColorClass}`} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div
          className="text-[13px] text-foreground truncate"
          style={{ fontWeight: 600, lineHeight: 1.3 }}
        >
          {title}
        </div>
        {subtitle && !children && (
          <div
            className="text-[12px] text-muted-foreground mt-0.5 truncate"
            style={{ lineHeight: 1.4 }}
          >
            {subtitle}
          </div>
        )}
        {children && <div className="mt-0.5">{children}</div>}
      </div>
      {trailing !== undefined ? (
        <div className="shrink-0 flex items-center" onClick={(e) => e.stopPropagation()}>
          {trailing}
        </div>
      ) : editable && clickable ? (
        <Pencil
          className="w-3.5 h-3.5 text-slate-300 group-hover:text-primary transition-colors shrink-0 mt-1"
          aria-hidden
        />
      ) : null}
    </div>
  );
});
