import { InfoTooltip } from '../ui/info-tooltip';

/**
 * Small heading rendered at the top of each detail-page tab body.
 * Mirrors the "Dashboard" label pattern from Partner Management:
 * muted slate caption + lucide Info icon + Partner-style white hover
 * card that explains what the tab is.
 */
export function TabSectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex items-center" style={{ gap: 6, marginBottom: 12 }}>
      <span className="text-sm text-muted-foreground" style={{ fontWeight: 500 }}>{title}</span>
      <InfoTooltip side="bottom">{description}</InfoTooltip>
    </div>
  );
}
