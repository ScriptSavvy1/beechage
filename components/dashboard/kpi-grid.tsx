import { formatCurrency } from "@/lib/format";
import type { DashboardKpis } from "@/lib/dashboard/types";
import { KpiCard } from "./kpi-card";

type Props = {
  kpis: DashboardKpis;
  rangeLabel: string;
  salesFootnote?: string;
};

export function KpiGrid({ kpis, rangeLabel, salesFootnote }: Props) {
  const netTone =
    kpis.netProfit > 0 ? "positive" : kpis.netProfit < 0 ? "negative" : "neutral";

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        title="Sales"
        subtitle={`Order revenue · ${rangeLabel}`}
        value={formatCurrency(kpis.sales)}
        footnote={salesFootnote}
      />
      <KpiCard title="Expenses" subtitle={rangeLabel} value={formatCurrency(kpis.expenses)} />
      <KpiCard
        title="Net profit"
        subtitle="Sales − expenses"
        value={formatCurrency(kpis.netProfit)}
        tone={netTone}
      />
      <KpiCard
        title="Orders"
        subtitle="All statuses in range"
        value={kpis.orderCount.toLocaleString()}
      />
    </div>
  );
}
