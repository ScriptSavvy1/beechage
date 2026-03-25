import Link from "next/link";
import { SalesOverTimeChart } from "@/components/dashboard/charts/sales-over-time-chart";
import { ExpensesOverTimeChart } from "@/components/dashboard/charts/expenses-over-time-chart";
import { SalesVsExpensesChart } from "@/components/dashboard/charts/sales-vs-expenses-chart";
import { TopCategoriesCharts } from "@/components/dashboard/charts/top-categories-charts";
import { DashboardFiltersBar } from "@/components/dashboard/dashboard-filters";
import { KpiGrid } from "@/components/dashboard/kpi-grid";
import { RecentExpensesTable } from "@/components/dashboard/recent-expenses-table";
import { RecentOrdersTable } from "@/components/dashboard/recent-orders-table";
import { SignOutButton } from "@/components/sign-out-button";
import { auth } from "@/lib/auth";
import { dayKey, getDashboardSnapshot, parseDashboardFilters } from "@/lib/dashboard";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminDashboardPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const filters = parseDashboardFilters(sp);
  const data = await getDashboardSnapshot(filters);
  const session = await auth();

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-emerald-800">Admin</p>
          <h1 className="mt-1 text-2xl font-semibold text-zinc-900">Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-600">{session?.user?.email ?? ""}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/admin/expenses"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50"
          >
            Expenses
          </Link>
          <SignOutButton />
        </div>
      </div>

      <DashboardFiltersBar
        options={data.filterOptions}
        from={dayKey(data.filters.from)}
        to={dayKey(data.filters.to)}
        userId={data.filters.userId ?? ""}
        serviceCategoryId={data.filters.serviceCategoryId ?? ""}
        expenseCategoryId={data.filters.expenseCategoryId ?? ""}
      />

      <KpiGrid
        kpis={data.kpis}
        rangeLabel={data.rangeLabel}
        salesFootnote="All orders in range count toward sales and net profit."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <SalesOverTimeChart data={data.salesByDay} />
        <ExpensesOverTimeChart data={data.expensesByDay} />
      </div>

      <SalesVsExpensesChart data={data.combinedSeries} />

      <TopCategoriesCharts
        itemCategories={data.topItemCategories}
        expenseCategories={data.topExpenseCategories}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <RecentOrdersTable orders={data.recentOrders} />
        <RecentExpensesTable expenses={data.recentExpenses} />
      </div>
    </main>
  );
}
