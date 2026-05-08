/**
 * Backend stores UTC as naive datetimes (no tz in JSON). Parse as UTC, show in the browser's local zone.
 */
export function formatApiUtcAsLocal(iso: string | null | undefined): string {
  if (iso == null || !String(iso).trim()) return "";
  let s = String(iso).trim();
  if (/Z$/i.test(s)) return new Date(s).toLocaleString();
  if (/[+-]\d{2}:?\d{2}$/.test(s)) return new Date(s).toLocaleString();
  const norm = s.includes("T") ? s : s.replace(" ", "T");
  const d = new Date(`${norm}Z`);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString();
}
