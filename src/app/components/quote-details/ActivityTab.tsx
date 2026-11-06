import { ComingSoonBanner } from '../shared/ComingSoonBanner';

interface ActivityTabProps {
  quoteNumber?: string;
  customerName?: string;
  contactName?: string;
}

export function ActivityTab(_props: ActivityTabProps) {
  return (
    <ComingSoonBanner
      title="Activity log"
      message="A timeline of every change to this quote — who edited what and when — is on the roadmap."
    />
  );
}
