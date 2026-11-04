/**
 * Formats a date for rate tooltips, e.g. "March 23, 2026 19:30 pm".
 * Accepts an ISO timestamp (preferred — preserves time) or a plain
 * YYYY-MM-DD date string (falls back to midnight local time).
 */
export function formatRateUpdatedAs(input: string | Date | undefined | null): string {
  if (!input) return "";
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return "";

  const datePart = d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const hours24 = d.getHours();
  const minutes = d.getMinutes();
  const hh = String(hours24).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const suffix = hours24 >= 12 ? "pm" : "am";

  return `${datePart} ${hh}:${mm} ${suffix}`;
}
