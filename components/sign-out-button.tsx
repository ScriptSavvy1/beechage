"use client";

import { logoutAction } from "@/lib/actions/logout";

export function SignOutButton() {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50"
      >
        Sign out
      </button>
    </form>
  );
}
