import { AdminHeader } from "@/components/admin/admin-header";
import { requireRole } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole(["ADMIN"]);

  return (
    <div className="min-h-screen bg-zinc-50">
      <AdminHeader />
      {children}
    </div>
  );
}
