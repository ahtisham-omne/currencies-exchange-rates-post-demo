import type { ReactNode, MouseEvent } from "react";

/* ─────────────────────────────────────────────────────────────
 * LinkedUserName
 * ─────────────────────────────────────────────────────────────
 * System-wide treatment for any user name that should navigate
 * to the user's detail page.
 *
 *   • Default state: inherits surrounding text color, no underline.
 *   • Hover state: text becomes #0A77FF + underline.
 *   • Click: ALWAYS opens the detail page in a new tab.
 *                    Never navigates the current view.
 *
 * Pass `disabled` for archived/deactivated users, renders plain
 * text with no link affordance.
 * ──────────────────────────────────────────────────────────── */

interface LinkedUserNameProps {
  userId: number | string | null | undefined;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
  /** Optional inline style passthrough (e.g. fontWeight, color) */
  style?: React.CSSProperties;
  /** Whether to stop click propagation (defaults to true so it doesn't trigger row clicks). */
  stopPropagation?: boolean;
}

export function LinkedUserName({
  userId,
  children,
  disabled = false,
  className = "",
  style,
  stopPropagation = true,
}: LinkedUserNameProps) {
  if (disabled || userId == null) {
    return (
      <span className={className} style={style}>
        {children}
      </span>
    );
  }

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (stopPropagation) e.stopPropagation();
  };

  return (
    <a
      href={`/company-settings/user-access-control/user/${userId}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className={`linked-entity ${className}`}
      style={style}
    >
      {children}
    </a>
  );
}
