"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TimeSeriesPoint } from "@/lib/dashboard/types";
import { ChartShell } from "@/components/dashboard/chart-shell";

type Props = {
  data: TimeSeriesPoint[];
};

export function ExpensesOverTimeChart({ data }: Props) {
  return (
    <ChartShell title="Expenses over time" description="Recorded expenses by day">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="expFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e11d48" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#e11d48" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#71717a" />
          <YAxis
            tick={{ fontSize: 11 }}
            stroke="#71717a"
            tickFormatter={(v) => `$${Number(v).toLocaleString()}`}
          />
          <Tooltip
            formatter={(value) => {
              const n = typeof value === "number" ? value : Number(value);
              return [`$${(Number.isFinite(n) ? n : 0).toFixed(2)}`, "Expenses"];
            }}
            contentStyle={{ borderRadius: "8px", border: "1px solid #e4e4e7" }}
          />
          <Area
            type="monotone"
            dataKey="value"
            name="Expenses"
            stroke="#be123c"
            fill="url(#expFill)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}
