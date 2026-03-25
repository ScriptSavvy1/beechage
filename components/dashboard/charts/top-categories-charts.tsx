"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { NamedValue } from "@/lib/dashboard/types";
import { ChartShell } from "@/components/dashboard/chart-shell";

function HorizontalCategoryChart({
  title,
  description,
  data,
  fill,
}: {
  title: string;
  description: string;
  data: NamedValue[];
  fill: string;
}) {
  const chartData = [...data].reverse();

  if (data.length === 0) {
    return (
      <ChartShell title={title} description={description}>
        <p className="flex h-full items-center justify-center text-sm text-zinc-500">
          No data in this range
        </p>
      </ChartShell>
    );
  }

  return (
    <ChartShell title={title} description={description}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={chartData}
          margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal className="stroke-zinc-200" />
          <XAxis
            type="number"
            tick={{ fontSize: 11 }}
            stroke="#71717a"
            tickFormatter={(v) => `$${Number(v).toLocaleString()}`}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={100}
            tick={{ fontSize: 11 }}
            stroke="#71717a"
          />
          <Tooltip
            formatter={(value) => {
              const n = typeof value === "number" ? value : Number(value);
              return [`$${(Number.isFinite(n) ? n : 0).toFixed(2)}`, "Amount"];
            }}
            contentStyle={{ borderRadius: "8px", border: "1px solid #e4e4e7" }}
          />
          <Bar dataKey="value" name="Amount" fill={fill} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

type Props = {
  itemCategories: NamedValue[];
  expenseCategories: NamedValue[];
};

export function TopCategoriesCharts({ itemCategories, expenseCategories }: Props) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <HorizontalCategoryChart
        title="Top service categories"
        description="Paid order line revenue by category"
        data={itemCategories}
        fill="#059669"
      />
      <HorizontalCategoryChart
        title="Top expense categories"
        description="Spend by category"
        data={expenseCategories}
        fill="#be123c"
      />
    </div>
  );
}
