"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

import { cn } from "./utils";

function Popover({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger({
  children,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  // Filter out Figma inspector props (_fg*) that cause React DOM warnings when passed through asChild
  const filteredProps = Object.fromEntries(
    Object.entries(props).filter(([key]) => !key.startsWith("_fg"))
  );
  // When asChild is used, also strip _fg* props from the child element
  let safeChildren = children;
  if (props.asChild && React.isValidElement(children)) {
    const childProps = (children as React.ReactElement<Record<string, unknown>>).props;
    const cleanChildProps = Object.fromEntries(
      Object.entries(childProps).filter(([key]) => !key.startsWith("_fg"))
    );
    safeChildren = React.cloneElement(children as React.ReactElement, cleanChildProps);
  }
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...filteredProps}>{safeChildren}</PopoverPrimitive.Trigger>;
}

function PopoverContent({
  className,
  align = "center",
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-[200] w-72 origin-(--radix-popover-content-transform-origin) rounded-md border p-4 shadow-md outline-hidden",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

function PopoverAnchor({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
  return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />;
}

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor };