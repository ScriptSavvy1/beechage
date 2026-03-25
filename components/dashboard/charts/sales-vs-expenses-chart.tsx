"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartShell } from "@/components/dashboard/chart-shell";

export type CombinedPoint = {
  date: string;
  label: string;
  sales: number;
  expenses: number;
};

type Props = {
  data: CombinedPoint[];
};

export function SalesVsExpensesChart({ data }: Props) {
  return (
    <ChartShell
      title="Sales vs expenses"
      description="Daily paid revenue compared to expenses"
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#71717a" />
          <YAxis
            tick={{ fontSize: 11 }}
            stroke="#71717a"
            tickFormatter={(v) => `$${Number(v).toLocaleString()}`}
          />
          <Tooltip
            formatter={(value, name) => {
              const n = typeof value === "number" ? value : Number(value);
              const label =
                name === "sales" ? "Sales" : name === "expenses" ? "Expenses" : String(name ?? "");
              return [`$${(Number.isFinite(n) ? n : 0).toFixed(2)}`, label];
            }}
            contentStyle={{ borderRadius: "8px", border: "1px solid #e4e4e7" }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="sales"
            name="Sales"
            stroke="#059669"
            strokeWidth={2}
            dot={{ r: 2 }}
          />
          <Line
            type="monotone"
            dataKey="expenses"
            name="Expenses"
            stroke="#be123c"
            strokeWidth={2}
            dot={{ r: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}
