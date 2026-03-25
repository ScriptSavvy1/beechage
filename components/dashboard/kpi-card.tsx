import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  value: ReactNode;
  footnote?: string;
  tone?: "default" | "positive" | "negative" | "neutral";
};

const toneBorder: Record<NonNullable<Props["tone"]>, string> = {
  default: "border-zinc-200",
  positive: "border-emerald-200",
  negative: "border-rose-200",
  neutral: "border-sky-200",
};

export function KpiCard({ title, subtitle, value, footnote, tone = "default" }: Props) {
  return (
    <div
      className={`rounded-2xl border bg-white p-5 shadow-sm ${toneBorder[tone]}`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</p>
      {subtitle ? <p className="mt-0.5 text-xs text-zinc-400">{subtitle}</p> : null}
      <p className="mt-3 text-2xl font-semibold tracking-tight text-zinc-900 tabular-nums">{value}</p>
      {footnote ? <p className="mt-2 text-xs text-zinc-500">{footnote}</p> : null}
    </div>
  );
}
