/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@/lib/supabase/server";
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

function toNumber(d: any): number {
  if (d === null || d === undefined) return 0;
  return Number(d);
}

function userLabel(name: string | null, email: string): string {
  return name?.trim() ? name : email;
}

// ─── KPIs ────────────────────────────────────────────────────

async function computeSalesTotal(f: DashboardFilters): Promise<number> {
  const supabase = await createClient();

  if (f.serviceCategoryId) {
    // Sum lineTotal from OrderItems where serviceCategoryId matches
    // and the parent order is in date range
    const { data: items } = await supabase
      .from("OrderItem")
      .select("lineTotal, orderId")
      .eq("serviceCategoryId", f.serviceCategoryId);

    if (!items || items.length === 0) return 0;

    // Get matching orders in date range
    let orderQuery = supabase
      .from("Order")
      .select("id")
      .gte("createdAt", f.from.toISOString())
      .lte("createdAt", f.to.toISOString());

    if (f.userId) orderQuery = orderQuery.eq("createdById", f.userId);

    const { data: orders } = await orderQuery;
    if (!orders) return 0;

    const orderIds = new Set(orders.map(o => o.id));
    return items
      .filter(i => orderIds.has(i.orderId))
      .reduce((sum, i) => sum + toNumber(i.lineTotal), 0);
  }

  // No category filter: sum order totalAmounts
  let query = supabase
    .from("Order")
    .select("totalAmount")
    .gte("createdAt", f.from.toISOString())
    .lte("createdAt", f.to.toISOString());

  if (f.userId) query = query.eq("createdById", f.userId);

  // If serviceCategoryId filter via items.some — we handle above
  const { data: orders } = await query;
  if (!orders) return 0;

  return orders.reduce((sum, o) => sum + toNumber(o.totalAmount), 0);
}

async function computeExpensesTotal(f: DashboardFilters): Promise<number> {
  const supabase = await createClient();
  let query = supabase
    .from("Expense")
    .select("amount")
    .gte("expenseDate", f.from.toISOString())
    .lte("expenseDate", f.to.toISOString());

  if (f.userId) query = query.eq("createdById", f.userId);
  if (f.expenseCategoryId) query = query.eq("expenseCategoryId", f.expenseCategoryId);

  const { data: expenses } = await query;
  if (!expenses) return 0;

  return expenses.reduce((sum, e) => sum + toNumber(e.amount), 0);
}

async function computeOrderCount(f: DashboardFilters): Promise<number> {
  const supabase = await createClient();
  let query = supabase
    .from("Order")
    .select("id", { count: "exact", head: true })
    .gte("createdAt", f.from.toISOString())
    .lte("createdAt", f.to.toISOString());

  if (f.userId) query = query.eq("createdById", f.userId);

  if (f.serviceCategoryId) {
    // Get order IDs that have items in this category
    const { data: items } = await supabase
      .from("OrderItem")
      .select("orderId")
      .eq("serviceCategoryId", f.serviceCategoryId);

    if (!items || items.length === 0) return 0;

    const orderIds = [...new Set(items.map(i => i.orderId))];
    query = query.in("id", orderIds);
  }

  const { count } = await query;
  return count ?? 0;
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

// ─── Time series ─────────────────────────────────────────────

function bucketByDay(
  rows: { date: Date; value: number }[],
  days: Date[],
): TimeSeriesPoint[] {
  const map = new Map<string, number>();
  for (const d of days) map.set(dayKey(d), 0);
  for (const r of rows) {
    const k = dayKey(r.date);
    if (!map.has(k)) continue;
    map.set(k, (map.get(k) ?? 0) + r.value);
  }
  return days.map((d) => ({
    date: dayKey(d),
    label: shortDayLabel(d),
    value: map.get(dayKey(d)) ?? 0,
  }));
}

async function getSalesSeries(f: DashboardFilters, days: Date[]): Promise<TimeSeriesPoint[]> {
  const supabase = await createClient();

  if (f.serviceCategoryId) {
    // Get line items for this category with their order's createdAt
    const { data: items } = await supabase
      .from("OrderItem")
      .select("lineTotal, order:Order(createdAt, createdById)")
      .eq("serviceCategoryId", f.serviceCategoryId);

    if (!items) return bucketByDay([], days);

    const rows = items
      .filter((i: any) => {
        const order = Array.isArray(i.order) ? i.order[0] : i.order;
        if (!order) return false;
        const d = new Date(order.createdAt);
        if (d < f.from || d > f.to) return false;
        if (f.userId && order.createdById !== f.userId) return false;
        return true;
      })
      .map((i: any) => {
        const order = Array.isArray(i.order) ? i.order[0] : i.order;
        return { date: new Date(order.createdAt), value: toNumber(i.lineTotal) };
      });

    return bucketByDay(rows, days);
  }

  let query = supabase
    .from("Order")
    .select("createdAt, totalAmount")
    .gte("createdAt", f.from.toISOString())
    .lte("createdAt", f.to.toISOString());

  if (f.userId) query = query.eq("createdById", f.userId);

  const { data: orders } = await query;
  if (!orders) return bucketByDay([], days);

  const rows = orders.map((o: any) => ({
    date: new Date(o.createdAt),
    value: toNumber(o.totalAmount),
  }));

  return bucketByDay(rows, days);
}

async function getExpensesSeries(f: DashboardFilters, days: Date[]): Promise<TimeSeriesPoint[]> {
  const supabase = await createClient();
  let query = supabase
    .from("Expense")
    .select("expenseDate, amount")
    .gte("expenseDate", f.from.toISOString())
    .lte("expenseDate", f.to.toISOString());

  if (f.userId) query = query.eq("createdById", f.userId);
  if (f.expenseCategoryId) query = query.eq("expenseCategoryId", f.expenseCategoryId);

  const { data: expenses } = await query;
  if (!expenses) return bucketByDay([], days);

  const rows = expenses.map((e: any) => ({
    date: new Date(e.expenseDate),
    value: toNumber(e.amount),
  }));

  return bucketByDay(rows, days);
}

// ─── Top categories (groupBy equivalent) ─────────────────────

async function getTopItemCategories(f: DashboardFilters, take = 8): Promise<NamedValue[]> {
  const supabase = await createClient();

  // Get order items with their order info for filtering
  let itemQuery = supabase
    .from("OrderItem")
    .select("categoryName, lineTotal, order:Order(createdAt, createdById)");

  if (f.serviceCategoryId) {
    itemQuery = itemQuery.eq("serviceCategoryId", f.serviceCategoryId);
  }

  const { data: items } = await itemQuery;
  if (!items) return [];

  // Filter by date range and user
  const filteredItems = items.filter((i: any) => {
    const order = Array.isArray(i.order) ? i.order[0] : i.order;
    if (!order) return false;
    const d = new Date(order.createdAt);
    if (d < f.from || d > f.to) return false;
    if (f.userId && order.createdById !== f.userId) return false;
    return true;
  });

  // Group by categoryName and sum lineTotal
  const grouped = new Map<string, number>();
  for (const item of filteredItems) {
    const current = grouped.get(item.categoryName) ?? 0;
    grouped.set(item.categoryName, current + toNumber(item.lineTotal));
  }

  return [...grouped.entries()]
    .map(([name, value]) => ({ name, value }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, take);
}

async function getTopExpenseCategories(f: DashboardFilters, take = 8): Promise<NamedValue[]> {
  const supabase = await createClient();
  let query = supabase
    .from("Expense")
    .select("categoryName, amount")
    .gte("expenseDate", f.from.toISOString())
    .lte("expenseDate", f.to.toISOString());

  if (f.userId) query = query.eq("createdById", f.userId);
  if (f.expenseCategoryId) query = query.eq("expenseCategoryId", f.expenseCategoryId);

  const { data: expenses } = await query;
  if (!expenses) return [];

  // Group by categoryName and sum amount
  const grouped = new Map<string, number>();
  for (const e of expenses) {
    const current = grouped.get(e.categoryName) ?? 0;
    grouped.set(e.categoryName, current + toNumber(e.amount));
  }

  return [...grouped.entries()]
    .map(([name, value]) => ({ name, value }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, take);
}

// ─── Recent rows ─────────────────────────────────────────────

async function getRecentOrders(f: DashboardFilters, take = 8): Promise<RecentOrderRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("Order")
    .select("id, orderNumber, createdAt, totalAmount, orderStatus, createdBy:users(name, email)")
    .gte("createdAt", f.from.toISOString())
    .lte("createdAt", f.to.toISOString())
    .order("createdAt", { ascending: false })
    .limit(take);

  if (f.userId) query = query.eq("createdById", f.userId);

  if (f.serviceCategoryId) {
    const { data: items } = await supabase
      .from("OrderItem")
      .select("orderId")
      .eq("serviceCategoryId", f.serviceCategoryId);

    if (!items || items.length === 0) return [];
    const orderIds = [...new Set(items.map(i => i.orderId))];
    query = query.in("id", orderIds);
  }

  const { data: rows } = await query;
  if (!rows) return [];

  return rows.map((r: any) => {
    const createdBy = Array.isArray(r.createdBy) ? r.createdBy[0] : r.createdBy;
    return {
      id: r.id,
      orderNumber: r.orderNumber,
      createdAt: new Date(r.createdAt).toISOString(),
      totalAmount: toNumber(r.totalAmount),
      orderStatus: r.orderStatus,
      createdByLabel: userLabel(createdBy?.name, createdBy?.email ?? ""),
    };
  });
}

async function getRecentExpenses(f: DashboardFilters, take = 8): Promise<RecentExpenseRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("Expense")
    .select("id, categoryName, amount, expenseDate, description, createdBy:users(name, email)")
    .gte("expenseDate", f.from.toISOString())
    .lte("expenseDate", f.to.toISOString())
    .order("expenseDate", { ascending: false })
    .order("createdAt", { ascending: false })
    .limit(take);

  if (f.userId) query = query.eq("createdById", f.userId);
  if (f.expenseCategoryId) query = query.eq("expenseCategoryId", f.expenseCategoryId);

  const { data: rows } = await query;
  if (!rows) return [];

  return rows.map((r: any) => {
    const createdBy = Array.isArray(r.createdBy) ? r.createdBy[0] : r.createdBy;
    return {
      id: r.id,
      categoryName: r.categoryName,
      amount: toNumber(r.amount),
      expenseDate: new Date(r.expenseDate).toISOString(),
      description: r.description,
      createdByLabel: userLabel(createdBy?.name, createdBy?.email ?? ""),
    };
  });
}

// ─── Filter options ──────────────────────────────────────────

async function getFilterOptions(): Promise<DashboardFilterOptions> {
  const supabase = await createClient();

  const [usersRes, serviceCatsRes, expenseCatsRes] = await Promise.all([
    supabase
      .from("users")
      .select("id, name, email, role")
      .eq("isActive", true)
      .in("role", ["ADMIN", "RECEPTION"])
      .order("name", { ascending: true })
      .order("email", { ascending: true }),
    supabase
      .from("ServiceCategory")
      .select("id, name")
      .eq("isActive", true)
      .order("sortOrder", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("ExpenseCategory")
      .select("id, name")
      .eq("isActive", true)
      .order("sortOrder", { ascending: true })
      .order("name", { ascending: true }),
  ]);

  return {
    users: usersRes.data ?? [],
    serviceCategories: serviceCatsRes.data ?? [],
    expenseCategories: expenseCatsRes.data ?? [],
  };
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
