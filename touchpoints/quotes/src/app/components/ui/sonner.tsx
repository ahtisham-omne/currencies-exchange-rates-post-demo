"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      /* zIndex must clear the heaviest modal stack (manage at 12000,
         items sub-modal at 12250, confirmation at 12300). */
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          zIndex: 13000,
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
