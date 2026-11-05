import type { ActivityEntry } from "./types";
import { ComingSoonBanner } from "@/app/components/shared/ComingSoonBanner";

export function ActivityTab(_props: { entries: ActivityEntry[] }) {
  return (
    <ComingSoonBanner
      title="Activity log"
      message="A timeline of every change to this order — who edited what and when — is on the roadmap."
    />
  );
}
