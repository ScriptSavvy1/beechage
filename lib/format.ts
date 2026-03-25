export function formatCurrency(
  value: number | string | { toNumber: () => number } | null | undefined,
): string {
  if (value === null || value === undefined) return "—";
  const n =
    typeof value === "object" && value !== null && typeof value.toNumber === "function"
      ? value.toNumber()
      : Number(value);
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}
