"use client";

import { defaultDashboardRange, dayKey } from "@/lib/dashboard/range";
import type { DashboardFilterOptions } from "@/lib/dashboard/types";
import { formInputClassName, formLabelClassName } from "@/lib/ui/form-classes";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useTransition } from "react";

type Props = {
  options: DashboardFilterOptions;
  /** YYYY-MM-DD */
  from: string;
  to: string;
  userId: string;
  serviceCategoryId: string;
  expenseCategoryId: string;
};

function setRangeDays(end: Date, daysBack: number): { from: string; to: string } {
  const to = new Date(end);
  to.setHours(0, 0, 0, 0);
  const from = new Date(to);
  from.setDate(from.getDate() - daysBack);
  return { from: dayKey(from), to: dayKey(to) };
}

export function DashboardFiltersBar({
  options,
  from,
  to,
  userId,
  serviceCategoryId,
  expenseCategoryId,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const presets = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return {
      today: setRangeDays(today, 0),
      week: setRangeDays(today, 6),
      month: setRangeDays(today, 29),
    };
  }, []);

  function buildHref(overrides: Record<string, string | undefined>): string {
    const params = new URLSearchParams();
    const merged = {
      from,
      to,
      userId: userId || undefined,
      serviceCategoryId: serviceCategoryId || undefined,
      expenseCategoryId: expenseCategoryId || undefined,
      ...overrides,
    };
    Object.entries(merged).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    const q = params.toString();
    return q ? `/admin?${q}` : "/admin";
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Filters</h2>
          <p className="mt-1 text-xs text-zinc-500">Refine KPIs, charts, and tables.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={buildHref(presets.today)}
            className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-100"
          >
            Today
          </Link>
          <Link
            href={buildHref(presets.week)}
            className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-100"
          >
            Last 7 days
          </Link>
          <Link
            href={buildHref(presets.month)}
            className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-100"
          >
            Last 30 days
          </Link>
          <Link
            href={(() => {
              const d = defaultDashboardRange();
              return buildHref({
                from: dayKey(d.from),
                to: dayKey(d.to),
                userId: "",
                serviceCategoryId: "",
                expenseCategoryId: "",
              });
            })()}
            className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-100"
          >
            Default range
          </Link>
        </div>
      </div>

      <form
        className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const next = {
            from: String(fd.get("from") ?? ""),
            to: String(fd.get("to") ?? ""),
            userId: String(fd.get("userId") ?? ""),
            serviceCategoryId: String(fd.get("serviceCategoryId") ?? ""),
            expenseCategoryId: String(fd.get("expenseCategoryId") ?? ""),
          };
          startTransition(() => {
            router.push(buildHref(next));
          });
        }}
      >
        <div>
          <label htmlFor="from" className={formLabelClassName}>
            From
          </label>
          <input
            id="from"
            name="from"
            type="date"
            defaultValue={from}
            className={formInputClassName}
            disabled={pending}
            required
          />
        </div>
        <div>
          <label htmlFor="to" className={formLabelClassName}>
            To
          </label>
          <input id="to" name="to" type="date" defaultValue={to} className={formInputClassName} disabled={pending} required />
        </div>
        <div>
          <label htmlFor="userId" className={formLabelClassName}>
            User
          </label>
          <select
            id="userId"
            name="userId"
            className={formInputClassName}
            defaultValue={userId}
            disabled={pending}
          >
            <option value="">All staff</option>
            {options.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name || u.email} ({u.role})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="serviceCategoryId" className={formLabelClassName}>
            Service category
          </label>
          <select
            id="serviceCategoryId"
            name="serviceCategoryId"
            className={formInputClassName}
            defaultValue={serviceCategoryId}
            disabled={pending}
          >
            <option value="">All services</option>
            {options.serviceCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="expenseCategoryId" className={formLabelClassName}>
            Expense category
          </label>
          <select
            id="expenseCategoryId"
            name="expenseCategoryId"
            className={formInputClassName}
            defaultValue={expenseCategoryId}
            disabled={pending}
          >
            <option value="">All expense types</option>
            {options.expenseCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-zinc-800 disabled:opacity-60"
          >
            {pending ? "Applying…" : "Apply"}
          </button>
        </div>
      </form>
    </div>
  );
}
