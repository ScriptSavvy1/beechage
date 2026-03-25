import type { DashboardFilters } from "./types";

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function parseYmd(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, day] = s.split("-").map(Number);
  const d = new Date(y, m - 1, day);
  if (d.getFullYear() !== y || d.getMonth() !== m - 1 || d.getDate() !== day) return null;
  return d;
}

export function defaultDashboardRange(): { from: Date; to: Date } {
  const to = startOfDay(new Date());
  const from = addDays(to, -29);
  return { from, to };
}

export function parseDashboardFilters(
  raw: Record<string, string | string[] | undefined>,
): DashboardFilters {
  const pick = (k: string): string | undefined => {
    const v = raw[k];
    if (Array.isArray(v)) return v[0];
    return v;
  };

  const def = defaultDashboardRange();
  const fromStr = pick("from");
  const toStr = pick("to");

  let fromDate = fromStr ? parseYmd(fromStr) ?? def.from : def.from;
  let toDate = toStr ? parseYmd(toStr) ?? def.to : def.to;
  if (fromDate > toDate) {
    const swap = fromDate;
    fromDate = toDate;
    toDate = swap;
  }

  const serviceCategoryId =
    pick("serviceCategoryId") || pick("orderCategoryId") || null;

  return {
    from: startOfDay(fromDate),
    to: endOfDay(toDate),
    userId: pick("userId") || null,
    serviceCategoryId,
    expenseCategoryId: pick("expenseCategoryId") || null,
  };
}

export function formatRangeLabel(from: Date, to: Date): string {
  const sameDay = from.toDateString() === to.toDateString();
  const fmt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });
  if (sameDay) return fmt.format(from);
  return `${fmt.format(from)} – ${fmt.format(to)}`;
}

/** Iterate calendar days between from and to (inclusive), as start-of-day Date. */
export function eachDayInRange(from: Date, to: Date): Date[] {
  const days: Date[] = [];
  const start = startOfDay(from);
  const end = startOfDay(to);
  for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
    days.push(new Date(d));
  }
  return days;
}

export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function shortDayLabel(d: Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d);
}
