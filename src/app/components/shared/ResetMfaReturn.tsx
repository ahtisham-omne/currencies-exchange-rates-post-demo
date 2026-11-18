import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { users as allUsersData } from "../../data/users-data";
import { CONFIRMED_AT_PARAM, RESET_PARAM, markConfirmed } from "../../lib/mfaReauth";
import { ResetMfaModal } from "./ResetMfaModal";

/* Back from the sign-in page after Reset User MFA (ERP-5179, 12 Nov 2026): the
 * page the admin left gets ?mfaReset=<user id>&confirmedAt=<ms> handed back.
 * Mounted once, beside the routes, so it works whichever page Reset MFA was
 * opened from (the users listing, a user's page, the quick view): it starts the
 * "confirmed recently" window, takes the hand-back off the address and opens
 * the modal on its done stage. */
export function ResetMfaReturn() {
  const [params, setParams] = useSearchParams();
  const [userId, setUserId] = useState<number | null>(null);

  useEffect(() => {
    const raw = params.get(RESET_PARAM);
    if (!raw) return;
    const at = Number(params.get(CONFIRMED_AT_PARAM));
    if (at) markConfirmed(at);
    setUserId(Number(raw));
    const next = new URLSearchParams(params);
    next.delete(RESET_PARAM);
    next.delete(CONFIRMED_AT_PARAM);
    setParams(next, { replace: true });
  }, [params, setParams]);

  const user = userId === null ? undefined : allUsersData.find((u) => u.id === userId);
  if (!user) return null;
  return (
    <ResetMfaModal
      open
      initialStage="done"
      onClose={() => setUserId(null)}
      userName={user.fullName}
      userEmail={user.email}
      userId={user.id}
    />
  );
}
