import { useCallback } from "react";
import { usePartnerGroups } from "@/app/context/PartnerGroupsContext";
import { partnerCurrencyInfo, partnerRateTypeInfo, type PartnerCurrency, type PartnerRateType } from "./partnerCurrency";

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

/** A partner's default exchange rate (its own, else its group's), reading groups from the store. */
export function usePartnerRateTypeInfo(): (partner: Partner) => PartnerRateType {
  const { groups } = usePartnerGroups();
  return useCallback((partner: Partner) => partnerRateTypeInfo(partner, groups), [groups]);
}
