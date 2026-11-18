// Calendar dates travel as 'yyyy-MM-dd' strings (DateOnly in the API) and are handled as strings
// in the app: they compare and sort correctly as text, and there's no time zone to get wrong.
//
// Built from the local date parts on purpose. toISOString() converts to UTC first, so at 00:30
// in Madrid it would return yesterday's date - a classic off-by-one-day bug.

export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d); // local midnight, no UTC conversion
}

export function today(): string {
  return toIsoDate(new Date());
}

export function addDays(iso: string, days: number): string {
  const date = parseIsoDate(iso);
  date.setDate(date.getDate() + days); // setDate handles month/year overflow
  return toIsoDate(date);
}

export function eachDay(from: string, to: string): string[] {
  const result: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) result.push(d);
  return result;
}

export function isWeekend(iso: string): boolean {
  const day = parseIsoDate(iso).getDay();
  return day === 0 || day === 6;
}

// ---------- Months (calendar views) ----------

export function startOfMonth(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export function addMonths(iso: string, months: number): string {
  const date = parseIsoDate(startOfMonth(iso));
  date.setMonth(date.getMonth() + months);
  return toIsoDate(date);
}

export function endOfMonth(iso: string): string {
  return addDays(addMonths(iso, 1), -1);
}

export function daysBetween(from: string, to: string): number {
  // Math.round: protects against the 23/25-hour days of daylight saving changes.
  return Math.round((parseIsoDate(to).getTime() - parseIsoDate(from).getTime()) / 86_400_000);
}
