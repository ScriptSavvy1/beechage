import { requireSession } from "@/lib/auth/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSession();
  return <div className="min-h-screen">{children}</div>;
}
