"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
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

export function SalesOverTimeChart({ data }: Props) {
  return (
    <ChartShell
      title="Sales over time"
      description="Paid order revenue by day"
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
            formatter={(value) => {
              const n = typeof value === "number" ? value : Number(value);
              return [`$${(Number.isFinite(n) ? n : 0).toFixed(2)}`, "Sales"];
            }}
            labelClassName="text-zinc-600"
            contentStyle={{ borderRadius: "8px", border: "1px solid #e4e4e7" }}
          />
          <Line
            type="monotone"
            dataKey="value"
            name="Sales"
            stroke="#059669"
            strokeWidth={2}
            dot={{ r: 3, fill: "#059669" }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}
