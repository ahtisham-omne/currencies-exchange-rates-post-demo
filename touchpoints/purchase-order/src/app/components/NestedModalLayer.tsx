import React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";

/**
 * Hosts a custom-styled modal (ported Sales Orders modals) as a proper
 * Radix dialog layer. Needed when the modal opens over another Radix
 * Dialog (e.g. the Items Detail Modal): the host's focus trap and
 * outside-click handling would otherwise swallow typing and clicks in a
 * plain `createPortal` modal. Nesting a Radix layer pauses the host's
 * focus scope and joins its dismiss stack — the same mechanism the
 * app's AlertDialog-based confirms already rely on.
 *
 * `children` must be a single element (the modal's full-screen overlay
 * root); it becomes the Radix Content via `asChild`, so the ported
 * markup and styles are untouched. Escape / outside-click are left to
 * the modal's own handlers.
 */
export function NestedModalLayer({ children }: { children: React.ReactElement }) {
  return (
    <DialogPrimitive.Root open modal>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          asChild
          aria-describedby={undefined}
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Accessible title for a NestedModalLayer (wraps the modal's heading). */
export const NestedModalTitle = DialogPrimitive.Title;
