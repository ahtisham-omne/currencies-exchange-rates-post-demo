import { GitBranch } from 'lucide-react';
import { StateTransitionOverlay } from '@/app/components/shared/StateTransitionOverlay';

/* ════════════════════════════════════════════════════════════════
   Thin Quote-side wrapper around the unified StateTransitionOverlay
   used when a material change auto-creates a new draft version.

   The overlay uses the `version` tone (violet) so it reads as a
   neutral version-creation event, distinct from a status transition.
   ═══════════════════════════════════════════════════════════════ */

interface AutoVersionOverlayProps {
  show: boolean;
  newVersion: number;
  fromStatus: string;
  onComplete: () => void;
}

export function AutoVersionOverlay({ show, newVersion, fromStatus, onComplete }: AutoVersionOverlayProps) {
  const previousVersion = Math.max(1, newVersion - 1);
  return (
    <StateTransitionOverlay
      isActive={show}
      fromLabel={`V${previousVersion} · ${fromStatus}`}
      toLabel={`V${newVersion} Draft Created`}
      tone="version"
      Icon={GitBranch}
      heading="Creating New Version"
      meta={`V${previousVersion} → V${newVersion}`}
      duration={2200}
      onComplete={onComplete}
    />
  );
}
