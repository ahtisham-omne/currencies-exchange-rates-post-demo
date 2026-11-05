import { useCallback } from "react";
import { usePartnerGroups } from "@/app/context/PartnerGroupsContext";
import { partnerCurrencyInfo, type PartnerCurrency } from "./partnerCurrency";

type Partner = Parameters<typeof partnerCurrencyInfo>[0];

/** A partner's currency, reading groups from the store (so a group's currency
 *  changed or set in this session is what its partners inherit). */
export function usePartnerCurrencyInfo(): (partner: Partner) => PartnerCurrency {
  const { groups } = usePartnerGroups();
  return useCallback((partner: Partner) => partnerCurrencyInfo(partner, groups), [groups]);
}

/** As usePartnerCurrencyInfo, the code alone. */
export function usePartnerCurrencyOf(): (partner: Partner) => string {
  const info = usePartnerCurrencyInfo();
  return useCallback((partner: Partner) => info(partner).code, [info]);
}
