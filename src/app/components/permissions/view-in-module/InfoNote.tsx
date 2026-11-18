import { Info, Shield, type LucideIcon } from "lucide-react";

type InfoNoteVariant = "blue" | "slate" | "amber";

const VARIANT_STYLES: Record<InfoNoteVariant, { container: string; icon: string; title: string; text: string; iconBg: string }> = {
  blue: {
    container: "bg-blue-50/70 border-blue-100",
    icon: "text-blue-500",
    iconBg: "",
    title: "text-blue-900",
    text: "text-blue-800",
  },
  slate: {
    container: "bg-slate-50 border-slate-200",
    icon: "text-slate-500",
    iconBg: "bg-slate-50 border border-slate-200 rounded-[8px] p-2",
    title: "text-slate-800",
    text: "text-slate-600",
  },
  amber: {
    container: "bg-amber-50 border-amber-200",
    icon: "text-amber-600",
    iconBg: "bg-white border border-amber-200 rounded-[8px] p-2",
    title: "text-amber-900",
    text: "text-amber-800",
  },
};

/* ─── Toggle-based variant (original API) ─── */
interface ToggleInfoNoteProps {
  noteOn: string;
  noteOff: string;
  isOn: boolean;
  variant?: InfoNoteVariant;
  icon?: LucideIcon;
}

/* ─── Static banner variant ─── */
interface BannerInfoNoteProps {
  title: string;
  description: string;
  variant?: InfoNoteVariant;
  icon?: LucideIcon;
}

type InfoNoteProps = ToggleInfoNoteProps | BannerInfoNoteProps;

function isBanner(props: InfoNoteProps): props is BannerInfoNoteProps {
  return "title" in props;
}

export function InfoNote(props: InfoNoteProps) {
  const variant = props.variant ?? "blue";
  const styles = VARIANT_STYLES[variant];
  const IconComponent = props.icon ?? (variant === "amber" ? Shield : Info);

  if (isBanner(props)) {
    return (
      <div className={`flex items-start gap-3 rounded-[8px] border px-4 py-3.5 ${styles.container}`}>
        <div className={`shrink-0 ${styles.iconBg}`}>
          <IconComponent size={16} className={styles.icon} />
        </div>
        <div className="flex flex-col gap-0.5">
          <p className={`text-[13px] font-semibold leading-snug ${styles.title}`}>
            {props.title}
          </p>
          <p className={`text-[13px] leading-relaxed ${styles.text}`}>
            {props.description}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-start gap-3 rounded-[8px] border px-4 py-3 ${styles.container}`}>
      <IconComponent size={16} className={`${styles.icon} shrink-0 mt-0.5`} />
      <p className={`text-[13px] leading-relaxed ${styles.text}`}>
        {props.isOn ? props.noteOn : props.noteOff}
      </p>
    </div>
  );
}
