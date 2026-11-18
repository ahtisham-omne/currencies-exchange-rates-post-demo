/* ─── Phone number formatter ───
 *
 * Single source of truth for how we render the local part of a phone number
 * (everything after the dial code). Used by the PhoneInput component as the
 * user types, and by every display site that surfaces a stored number, so
 * what the user sees while editing matches what shows up on detail/overview
 * cards.
 *
 * The formatter is idempotent: passing an already-formatted string back in
 * yields the same string, because we strip non-digits and re-apply the
 * pattern. That lets us be lazy about whether `phone.number` in storage is
 * "(390) 412-9029" or "3904129029", both render identically.
 */

/** Per-dial-code grouping pattern. Each entry is an array of group sizes
 *  applied left-to-right; separators are inserted as the pattern is filled.
 *  Patterns intentionally over-allocate (max digits), short input just stops
 *  partway. Unknown dial codes fall back to spaced groups of 3. */
const PHONE_PATTERNS: Record<string, { groups: number[]; separators: string[]; max: number }> = {
  // North America (NANP): (XXX) XXX-XXXX
  "+1":   { groups: [3, 3, 4],    separators: ["(", ") ", "-", ""], max: 10 },
  // UK: XXXX XXX XXXX
  "+44":  { groups: [4, 3, 4],    separators: ["", " ", " ", ""],   max: 11 },
  // Germany: XXX XXXXXXXX
  "+49":  { groups: [3, 8],       separators: ["", " ", ""],         max: 11 },
  // France: X XX XX XX XX
  "+33":  { groups: [1, 2, 2, 2, 2], separators: ["", " ", " ", " ", " ", ""], max: 9 },
  // Japan: XX XXXX XXXX
  "+81":  { groups: [2, 4, 4],    separators: ["", " ", " ", ""],   max: 10 },
  // India: XXXXX XXXXX
  "+91":  { groups: [5, 5],       separators: ["", " ", ""],         max: 10 },
  // China: XXX XXXX XXXX
  "+86":  { groups: [3, 4, 4],    separators: ["", " ", " ", ""],   max: 11 },
  // Australia: X XXXX XXXX
  "+61":  { groups: [1, 4, 4],    separators: ["", " ", " ", ""],   max: 9 },
  // UAE: X XXX XXXX
  "+971": { groups: [1, 3, 4],    separators: ["", " ", " ", ""],   max: 8 },
  // Brazil: XX XXXXX XXXX
  "+55":  { groups: [2, 5, 4],    separators: ["", " ", " ", ""],   max: 11 },
  // Mexico: XX XXXX XXXX
  "+52":  { groups: [2, 4, 4],    separators: ["", " ", " ", ""],   max: 10 },
  // South Korea: XX XXXX XXXX
  "+82":  { groups: [2, 4, 4],    separators: ["", " ", " ", ""],   max: 10 },
  // Italy: XXX XXX XXXX
  "+39":  { groups: [3, 3, 4],    separators: ["", " ", " ", ""],   max: 10 },
  // Spain: XXX XXX XXX
  "+34":  { groups: [3, 3, 3],    separators: ["", " ", " ", ""],   max: 9 },
};

const FALLBACK_PATTERN = { groups: [3, 3, 3, 3], separators: ["", " ", " ", " ", ""], max: 15 };

/** Strip everything that isn't a digit. */
export function digitsOnly(input: string | null | undefined): string {
  if (!input) return "";
  return input.replace(/\D+/g, "");
}

/**
 * Format the local part of a phone number for the given country dial code.
 * Pass any string, already-formatted or raw digits, and get back the
 * canonical formatted representation for that country.
 */
export function formatPhone(input: string | null | undefined, countryCode: string): string {
  const digits = digitsOnly(input);
  if (!digits) return "";

  const pattern = PHONE_PATTERNS[countryCode] ?? FALLBACK_PATTERN;
  const trimmed = digits.slice(0, pattern.max);

  let out = "";
  let cursor = 0;
  const groupCount = pattern.groups.length;
  for (let g = 0; g < groupCount; g++) {
    const size = pattern.groups[g];
    const slice = trimmed.slice(cursor, cursor + size);
    if (slice.length === 0) break;
    out += pattern.separators[g] + slice;
    cursor += slice.length;
    if (slice.length < size) break; // partial group → stop here
    // Final group fully filled, emit closing separator (e.g. "" for "+1").
    // Inter-group separators are emitted as the *next* group's opener when
    // the user types its first digit; deferring them this way keeps
    // backspace deletes feeling natural (no "ghost" separator that the
    // formatter would otherwise re-add).
    if (g === groupCount - 1) {
      out += pattern.separators[g + 1] ?? "";
    }
  }
  return out;
}

/**
 * Format a full phone (dial code + local) as a single human-readable string,
 * e.g. `+1 (390) 412-9029`. Returns an empty string if the local part is
 * empty so callers can short-circuit empty rows.
 */
export function formatFullPhone(countryCode: string, number: string | null | undefined): string {
  const local = formatPhone(number, countryCode);
  if (!local) return "";
  return `${countryCode} ${local}`;
}

/** Maximum character length the formatted local part can reach for the given
 *  dial code. Used by PhoneInput as the `maxLength` cap so the input simply
 *  stops accepting keystrokes once the number is complete. */
export function maxFormattedLength(countryCode: string): number {
  const pattern = PHONE_PATTERNS[countryCode] ?? FALLBACK_PATTERN;
  const digits = pattern.groups.reduce((a, b) => a + b, 0);
  const separators = pattern.separators.reduce((a, b) => a + b.length, 0);
  return digits + separators;
}
