import type { ReactNode } from "react";

type Props = {
  title: string;
  description?: string;
  children: ReactNode;
};

export function ChartShell({ title, description, children }: Props) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
      {description ? <p className="mt-1 text-xs text-zinc-500">{description}</p> : null}
      <div className="mt-4 h-[300px] w-full min-w-0">{children}</div>
    </div>
  );
}
