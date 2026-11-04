"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";

import { cn } from "./utils";

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    data-slot="dialog-overlay"
    // Stop overlay clicks from bubbling through the React tree to an ancestor
    // onClick (e.g. a clickable table row). The dialog still closes — Radix's
    // outside-dismiss listens on the document, not via React bubbling.
    onClick={(e) => e.stopPropagation()}
    className={cn(
      // z-[200] sits above the highest in-page sticky elements
      // (header card z-20, sidebar z-50) so the dim covers the
      // whole viewport. DialogContent below uses z-[210] so the
      // modal renders ABOVE this overlay — previously the content
      // sat at z-50 and got partially obscured by the dim.
      "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-[200] bg-black/40",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

interface DialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  /** When false, suppresses the default top-right X close button so callers
   *  that ship their own close affordance (e.g. a custom-styled circular
   *  button in a hero band) don't end up with a duplicate. Defaults to true. */
  showCloseButton?: boolean;
  /** A dialog nested inside a higher-z parent (AlertDialog content is
   *  z-[230]) must lift its overlay too, or the dim lands BEHIND the
   *  parent modal and only the page darkens. Pass e.g. "z-[290]" here
   *  whenever the content's z is overridden above 210. */
  overlayClassName?: string;
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, showCloseButton = true, overlayClassName, onInteractOutside, onPointerDownOutside, ...props }, ref) => (
  <DialogPortal data-slot="dialog-portal">
    <DialogOverlay className={overlayClassName} />
    <DialogPrimitive.Content
      ref={ref}
      data-slot="dialog-content"
      // Portaled content still bubbles synthetic events up the React tree, so
      // clicks inside the modal (incl. the close button) would otherwise reach
      // an ancestor row onClick. Contain them here.
      onClick={(e) => e.stopPropagation()}
      // Sonner toasts portal to document.body ABOVE every overlay, so Radix
      // sees a click on a toast (e.g. dismissing it) as an outside
      // interaction and closes the whole modal underneath. Ignore any
      // outside event whose real target lives inside the toaster.
      onInteractOutside={(e) => {
        const target = (e.detail?.originalEvent?.target ?? e.target) as HTMLElement | null;
        if (target?.closest?.("[data-sonner-toaster]")) {
          e.preventDefault();
          return;
        }
        onInteractOutside?.(e);
      }}
      onPointerDownOutside={(e) => {
        const target = (e.detail?.originalEvent?.target ?? e.target) as HTMLElement | null;
        if (target?.closest?.("[data-sonner-toaster]")) {
          e.preventDefault();
          return;
        }
        onPointerDownOutside?.(e);
      }}
      className={cn(
        // The slide-in-from-left-1/2 / slide-in-from-top-1/2 utilities feed
        // a -50%/-50% translate into tailwindcss-animate's keyframe so the
        // dialog stays centered through the zoom animation. Without them,
        // the keyframe overrides the static translate and the modal "slides
        // up from the bottom-right" as it scales in.
        // Viewport clamp (scaling audit, Nophil 9/8): no dialog may
        // exceed the screen — tall content scrolls instead of pushing
        // its CTAs out of view on smaller displays. Callers that manage
        // their own height (flex columns, pinned footers) still win:
        // tailwind-merge keeps their max-h / overflow values.
        "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-1/2 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-1/2 fixed top-[50%] left-[50%] z-[210] grid w-full max-w-[calc(100%-2rem)] max-h-[calc(100dvh-2rem)] overflow-y-auto translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg",
        className,
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4">
          <XIcon />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    data-slot="dialog-title"
    className={cn("text-lg leading-none font-semibold", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    data-slot="dialog-description"
    className={cn("text-muted-foreground text-sm", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
