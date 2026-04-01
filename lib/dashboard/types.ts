import { OrderStatus, Role } from "@/lib/types/enums";

/** Resolved filter set used by dashboard queries (admin dashboard). */
export type DashboardFilters = {
  from: Date;
  to: Date;
  userId: string | null;
  /** Service category filter (order must include a line in this category). */
  serviceCategoryId: string | null;
  expenseCategoryId: string | null;
};

export type DashboardKpis = {
  sales: number;
  expenses: number;
  netProfit: number;
  orderCount: number;
  totalDiscounts: number;
};

export type TimeSeriesPoint = {
  date: string;
  label: string;
  value: number;
};

export type NamedValue = {
  name: string;
  value: number;
};

export type RecentOrderRow = {
  id: string;
  orderNumber: string;
  createdAt: string;
  totalAmount: number;
  orderStatus: OrderStatus;
  createdByLabel: string;
};

export type RecentExpenseRow = {
  id: string;
  categoryName: string;
  amount: number;
  expenseDate: string;
  description: string | null;
  createdByLabel: string;
};

export type DashboardFilterOptions = {
  users: { id: string; name: string | null; email: string; role: Role }[];
  serviceCategories: { id: string; name: string }[];
  expenseCategories: { id: string; name: string }[];
};

export type DashboardSnapshot = {
  filters: DashboardFilters;
  rangeLabel: string;
  kpis: DashboardKpis;
  salesByDay: TimeSeriesPoint[];
  expensesByDay: TimeSeriesPoint[];
  /** For Recharts combined line chart */
  combinedSeries: { date: string; label: string; sales: number; expenses: number }[];
  topItemCategories: NamedValue[];
  topExpenseCategories: NamedValue[];
  recentOrders: RecentOrderRow[];
  recentExpenses: RecentExpenseRow[];
  filterOptions: DashboardFilterOptions;
};
