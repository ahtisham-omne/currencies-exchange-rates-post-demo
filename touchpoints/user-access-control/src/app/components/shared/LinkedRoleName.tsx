import type { ReactNode, MouseEvent } from "react";

/* ─────────────────────────────────────────────────────────────
 * LinkedRoleName
 * ─────────────────────────────────────────────────────────────
 * System-wide treatment for any role name that should navigate
 * to the role's detail page.
 *
 *   • Default state: inherits surrounding text color, no underline.
 *   • Hover state: text becomes #0A77FF + underline.
 *   • Click: ALWAYS opens the detail page in a new tab.
 *                    Never navigates the current view.
 *
 * Pass `disabled` to render plain text (no link affordance).
 * ──────────────────────────────────────────────────────────── */

interface LinkedRoleNameProps {
  roleId: number | string | null | undefined;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  stopPropagation?: boolean;
  /** Optional query string appended to the URL, e.g. "?tab=users". */
  query?: string;
}

export function LinkedRoleName({
  roleId,
  children,
  disabled = false,
  className = "",
  style,
  stopPropagation = true,
  query = "",
}: LinkedRoleNameProps) {
  if (disabled || roleId == null) {
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
      href={`/company-settings/user-access-control/role/${roleId}${query}`}
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
