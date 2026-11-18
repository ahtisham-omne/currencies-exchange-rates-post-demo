import type { FlagOption } from "../currency/CurrencyDropdown";

/* ── Countries for the Country of Legal Registration picker ─────────────
 * Every ISO 3166 country that has a flag in the shell's flag set (250), named
 * in English by the browser. The currency list can't stand in: a currency
 * names one country, so the eurozone's members aren't in it. */

const CODES =
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW";

const regionName = (() => {
  try {
    const dn = new Intl.DisplayNames(["en"], { type: "region" });
    return (code: string) => dn.of(code) ?? code;
  } catch {
    return (code: string) => code;
  }
})();

/** Options keyed by country name, which is what the profile stores. */
export const COUNTRY_OPTIONS: FlagOption[] = CODES.split(" ")
  .map((code) => ({ id: regionName(code), label: regionName(code), flag: code.toLowerCase(), keywords: code }))
  .sort((a, b) => a.label.localeCompare(b.label));

export const countryFlag = (name: string) => COUNTRY_OPTIONS.find((c) => c.id === name)?.flag ?? null;

/** The phone field's dialling codes, flagged as the page shows a saved number. */
const DIAL_FLAGS: Record<string, string> = {
  "+1": "us",
  "+44": "gb",
  "+49": "de",
  "+81": "jp",
  "+91": "in",
  "+33": "fr",
  "+86": "cn",
  "+61": "au",
  "+971": "ae",
  "+55": "br",
  "+52": "mx",
  "+82": "kr",
  "+39": "it",
  "+34": "es",
};
export const dialFlag = (code: string) => DIAL_FLAGS[code] ?? null;
