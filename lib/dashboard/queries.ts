import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  dayKey,
  eachDayInRange,
  formatRangeLabel,
  shortDayLabel,
} from "./range";
import type {
  DashboardFilterOptions,
  DashboardFilters,
  DashboardKpis,
  DashboardSnapshot,
  NamedValue,
  RecentExpenseRow,
  RecentOrderRow,
  TimeSeriesPoint,
} from "./types";

function toNumber(d: Prisma.Decimal | null | undefined): number {
  if (d === null || d === undefined) return 0;
  return d.toNumber();
}

function userLabel(name: string | null, email: string): string {
  return name?.trim() ? name : email;
}

/** Sales: sum of all order totals in range (no payment filter). */
function buildSalesOrderWhere(f: DashboardFilters): Prisma.OrderWhereInput {
  return {
    createdAt: { gte: f.from, lte: f.to },
    ...(f.userId ? { createdById: f.userId } : {}),
    ...(f.serviceCategoryId
      ? { items: { some: { serviceCategoryId: f.serviceCategoryId } } }
      : {}),
  };
}

function buildAnyOrderWhere(f: DashboardFilters): Prisma.OrderWhereInput {
  return buildSalesOrderWhere(f);
}

function buildExpenseWhere(f: DashboardFilters): Prisma.ExpenseWhereInput {
  return {
    expenseDate: { gte: f.from, lte: f.to },
    ...(f.userId ? { createdById: f.userId } : {}),
    ...(f.expenseCategoryId ? { expenseCategoryId: f.expenseCategoryId } : {}),
  };
}

async function computeSalesTotal(f: DashboardFilters): Promise<number> {
  if (f.serviceCategoryId) {
    const agg = await prisma.orderItem.aggregate({
      where: {
        serviceCategoryId: f.serviceCategoryId,
        order: {
          createdAt: { gte: f.from, lte: f.to },
          ...(f.userId ? { createdById: f.userId } : {}),
        },
      },
      _sum: { lineTotal: true },
    });
    return toNumber(agg._sum.lineTotal);
  }
  const agg = await prisma.order.aggregate({
    where: buildSalesOrderWhere(f),
    _sum: { totalAmount: true },
  });
  return toNumber(agg._sum.totalAmount);
}

async function computeExpensesTotal(f: DashboardFilters): Promise<number> {
  const agg = await prisma.expense.aggregate({
    where: buildExpenseWhere(f),
    _sum: { amount: true },
  });
  return toNumber(agg._sum.amount);
}

async function computeOrderCount(f: DashboardFilters): Promise<number> {
  return prisma.order.count({ where: buildAnyOrderWhere(f) });
}

async function getKpis(f: DashboardFilters): Promise<DashboardKpis> {
  const [sales, expenses, orderCount] = await Promise.all([
    computeSalesTotal(f),
    computeExpensesTotal(f),
    computeOrderCount(f),
  ]);
  return {
    sales,
    expenses,
    netProfit: sales - expenses,
    orderCount,
  };
}

function bucketSalesByDay(
  orders: { createdAt: Date; totalAmount: Prisma.Decimal }[],
  days: Date[],
): TimeSeriesPoint[] {
  const map = new Map<string, number>();
  for (const d of days) map.set(dayKey(d), 0);
  for (const o of orders) {
    const k = dayKey(o.createdAt);
    if (!map.has(k)) continue;
    map.set(k, (map.get(k) ?? 0) + toNumber(o.totalAmount));
  }
  return days.map((d) => ({
    date: dayKey(d),
    label: shortDayLabel(d),
    value: map.get(dayKey(d)) ?? 0,
  }));
}

function bucketLineSalesByDay(
  rows: { lineTotal: Prisma.Decimal; order: { createdAt: Date } }[],
  days: Date[],
): TimeSeriesPoint[] {
  const map = new Map<string, number>();
  for (const d of days) map.set(dayKey(d), 0);
  for (const r of rows) {
    const k = dayKey(r.order.createdAt);
    if (!map.has(k)) continue;
    map.set(k, (map.get(k) ?? 0) + toNumber(r.lineTotal));
  }
  return days.map((d) => ({
    date: dayKey(d),
    label: shortDayLabel(d),
    value: map.get(dayKey(d)) ?? 0,
  }));
}

function bucketExpensesByDay(
  rows: { expenseDate: Date; amount: Prisma.Decimal }[],
  days: Date[],
): TimeSeriesPoint[] {
  const map = new Map<string, number>();
  for (const d of days) map.set(dayKey(d), 0);
  for (const r of rows) {
    const k = dayKey(r.expenseDate);
    if (!map.has(k)) continue;
    map.set(k, (map.get(k) ?? 0) + toNumber(r.amount));
  }
  return days.map((d) => ({
    date: dayKey(d),
    label: shortDayLabel(d),
    value: map.get(dayKey(d)) ?? 0,
  }));
}

async function getSalesSeries(f: DashboardFilters, days: Date[]): Promise<TimeSeriesPoint[]> {
  if (f.serviceCategoryId) {
    const rows = await prisma.orderItem.findMany({
      where: {
        serviceCategoryId: f.serviceCategoryId,
        order: {
          createdAt: { gte: f.from, lte: f.to },
          ...(f.userId ? { createdById: f.userId } : {}),
        },
      },
      select: { lineTotal: true, order: { select: { createdAt: true } } },
    });
    return bucketLineSalesByDay(rows, days);
  }
  const orders = await prisma.order.findMany({
    where: buildSalesOrderWhere(f),
    select: { createdAt: true, totalAmount: true },
  });
  return bucketSalesByDay(orders, days);
}

async function getExpensesSeries(f: DashboardFilters, days: Date[]): Promise<TimeSeriesPoint[]> {
  const rows = await prisma.expense.findMany({
    where: buildExpenseWhere(f),
    select: { expenseDate: true, amount: true },
  });
  return bucketExpensesByDay(rows, days);
}

async function getTopItemCategories(f: DashboardFilters, take = 8): Promise<NamedValue[]> {
  const grouped = await prisma.orderItem.groupBy({
    by: ["categoryName"],
    where: {
      ...(f.serviceCategoryId ? { serviceCategoryId: f.serviceCategoryId } : {}),
      order: {
        createdAt: { gte: f.from, lte: f.to },
        ...(f.userId ? { createdById: f.userId } : {}),
        ...(f.serviceCategoryId
          ? { items: { some: { serviceCategoryId: f.serviceCategoryId } } }
          : {}),
      },
    },
    _sum: { lineTotal: true },
    orderBy: { _sum: { lineTotal: "desc" } },
  });
  return grouped
    .slice(0, take)
    .map((g) => ({
      name: g.categoryName,
      value: toNumber(g._sum.lineTotal),
    }))
    .filter((x) => x.value > 0);
}

async function getTopExpenseCategories(f: DashboardFilters, take = 8): Promise<NamedValue[]> {
  const grouped = await prisma.expense.groupBy({
    by: ["categoryName"],
    where: buildExpenseWhere(f),
    _sum: { amount: true },
    orderBy: { _sum: { amount: "desc" } },
  });
  return grouped
    .slice(0, take)
    .map((g) => ({
      name: g.categoryName,
      value: toNumber(g._sum.amount),
    }))
    .filter((x) => x.value > 0);
}

async function getRecentOrders(f: DashboardFilters, take = 8): Promise<RecentOrderRow[]> {
  const rows = await prisma.order.findMany({
    where: buildAnyOrderWhere(f),
    orderBy: { createdAt: "desc" },
    take,
    include: { createdBy: { select: { name: true, email: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    orderNumber: r.orderNumber,
    createdAt: r.createdAt.toISOString(),
    totalAmount: r.totalAmount.toNumber(),
    orderStatus: r.orderStatus,
    createdByLabel: userLabel(r.createdBy.name, r.createdBy.email),
  }));
}

async function getRecentExpenses(f: DashboardFilters, take = 8): Promise<RecentExpenseRow[]> {
  const rows = await prisma.expense.findMany({
    where: buildExpenseWhere(f),
    orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
    take,
    include: { createdBy: { select: { name: true, email: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    categoryName: r.categoryName,
    amount: r.amount.toNumber(),
    expenseDate: r.expenseDate.toISOString(),
    description: r.description,
    createdByLabel: userLabel(r.createdBy.name, r.createdBy.email),
  }));
}

async function getFilterOptions(): Promise<DashboardFilterOptions> {
  const [users, serviceCategories, expenseCategories] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true, role: { in: ["ADMIN", "RECEPTION"] } },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      select: { id: true, name: true, email: true, role: true },
    }),
    prisma.serviceCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.expenseCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);
  return { users, serviceCategories, expenseCategories };
}

/** Public entry: load full dashboard snapshot (admin-only callers should guard route). */
export async function getDashboardSnapshot(filters: DashboardFilters): Promise<DashboardSnapshot> {
  const days = eachDayInRange(filters.from, filters.to);
  const [
    kpis,
    salesByDay,
    expensesByDay,
    topItemCategories,
    topExpenseCategories,
    recentOrders,
    recentExpenses,
    filterOptions,
  ] = await Promise.all([
    getKpis(filters),
    getSalesSeries(filters, days),
    getExpensesSeries(filters, days),
    getTopItemCategories(filters),
    getTopExpenseCategories(filters),
    getRecentOrders(filters),
    getRecentExpenses(filters),
    getFilterOptions(),
  ]);

  const combinedSeries = salesByDay.map((s, i) => ({
    date: s.date,
    label: s.label,
    sales: s.value,
    expenses: expensesByDay[i]?.value ?? 0,
  }));

  return {
    filters,
    rangeLabel: formatRangeLabel(filters.from, filters.to),
    kpis,
    salesByDay,
    expensesByDay,
    combinedSeries,
    topItemCategories,
    topExpenseCategories,
    recentOrders,
    recentExpenses,
    filterOptions,
  };
}
