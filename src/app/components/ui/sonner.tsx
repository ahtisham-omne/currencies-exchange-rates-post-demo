import * as React from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      style={
        {
          "--normal-bg": "hsl(var(--popover))",
          "--normal-text": "hsl(var(--popover-foreground))",
          "--normal-border": "hsl(var(--border))",
        } as React.CSSProperties
      }
      toastOptions={{
        style: {
          fontFamily: "'Inter', sans-serif",
          animation: "modal-enter 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
