/** ISO 3166-1 alpha-2 codes; display names come from Intl so they stay localized and current. */
const CODES =
  "AD AE AF AG AI AL AM AO AR AT AU AW AZ BA BB BD BE BF BG BH BI BJ BM BN BO BR BS BT BW BY BZ CA CD CF CG CH CI CL CM CN CO CR CU CV CW CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FM FR GA GB GD GE GG GH GI GM GN GQ GR GT GW GY HK HN HR HT HU ID IE IL IM IN IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MH MK ML MM MN MO MR MT MU MV MW MX MY MZ NA NE NG NI NL NO NP NR NZ OM PA PE PG PH PK PL PR PS PT PW PY QA RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TG TH TJ TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VG VN VU WS XK YE ZA ZM ZW".split(" ");

let names: Intl.DisplayNames | null = null;

export function countryName(code: string): string {
  try {
    names ??= new Intl.DisplayNames(["en"], { type: "region" });
    return names.of(code) ?? code;
  } catch {
    return code;
  }
}

export const COUNTRIES: { code: string; name: string }[] = CODES.map((code) => ({ code, name: countryName(code) })).sort((a, b) =>
  a.name.localeCompare(b.name),
);
