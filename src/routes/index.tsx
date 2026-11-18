import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Root route — always redirects to /supply-chain. The Supply Chain
 * Management overview is the first screen users see when they open the
 * app; the old "RMA Web Builder" landing was removed per design.
 */
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/supply-chain" });
  },
});
