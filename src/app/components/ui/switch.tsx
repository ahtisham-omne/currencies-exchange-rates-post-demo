"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";

import { cn } from "./utils";

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-[18px] w-8 shrink-0 items-center rounded-full transition-colors duration-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-[hsl(214,20%,80%)] data-[state=unchecked]:hover:bg-[hsl(214,15%,65%)]",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block h-[14px] w-[14px] rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 data-[state=checked]:translate-x-[14px] data-[state=unchecked]:translate-x-[2px]",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
