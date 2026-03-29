import Link from "next/link";
import { CreateReceptionUserForm } from "@/components/admin/create-reception-user-form";
import { requireTenantAdmin } from "@/lib/tenant";

export default async function NewReceptionUserPage() {
  const ctx = await requireTenantAdmin();

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link href="/admin/users" className="text-sm font-medium text-emerald-800 hover:underline">
        ← Back to users
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-zinc-900">Create new user</h1>
      <div className="mt-8">
        <CreateReceptionUserForm callerRole={ctx.role} />
      </div>
    </main>
  );
}
