import { AdminHeader } from "@/components/admin/admin-header";
import { requireRole } from "@/lib/auth/server";
import { Role } from "@prisma/client";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole(Role.ADMIN);

  return (
    <div className="min-h-screen bg-zinc-50">
      <AdminHeader />
      {children}
    </div>
  );
}
