import Link from "next/link";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { UserActions } from "@/components/admin/user-actions";

export default async function AdminUsersPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return null;

  const supabase = await createClient();
  const { data: users } = await supabase
    .from("users")
    .select("id, email, name, role, isActive, createdAt")
    .order("createdAt", { ascending: true });

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Users</h1>
          <p className="mt-0.5 text-sm text-zinc-600">Manage staff accounts.</p>
        </div>
        <Link
          href="/admin/users/new"
          className="inline-flex items-center rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-zinc-800"
        >
          + New user
        </Link>
      </div>

      {!users || users.length === 0 ? (
        <p className="text-sm text-zinc-500">No users found.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {users.map((user) => (
                <tr key={user.id} className={user.isActive ? "" : "bg-zinc-50 text-zinc-400"}>
                  <td className="px-4 py-3 font-medium text-zinc-900">{user.name || "—"}</td>
                  <td className="px-4 py-3">{user.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                      user.role === "ADMIN"
                        ? "bg-purple-100 text-purple-800"
                        : "bg-sky-100 text-sky-800"
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                      user.isActive
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-zinc-200 text-zinc-600"
                    }`}>
                      {user.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {user.id !== session.user.id && (
                      <UserActions userId={user.id} isActive={user.isActive} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
