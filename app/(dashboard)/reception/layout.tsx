import { ReceptionHeader } from "@/components/reception/reception-header";
import { requireRole } from "@/lib/auth/server";
import { Role } from "@prisma/client";

export default async function ReceptionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole(Role.RECEPTION);

  return (
    <div className="min-h-screen bg-zinc-50">
      <ReceptionHeader />
      {children}
    </div>
  );
}
