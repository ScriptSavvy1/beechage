"use client";

import { useActionState } from "react";
import { loginAction, type LoginResult } from "@/lib/actions/login";

export function LoginForm() {
  const [state, formAction, isPending] = useActionState<LoginResult | null, FormData>(
    loginAction,
    null,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium text-zinc-700">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 shadow-sm outline-none ring-zinc-400 focus:ring-2"
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium text-zinc-700">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 shadow-sm outline-none ring-zinc-400 focus:ring-2"
        />
      </div>
      {state?.ok === false && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-700">{state.error}</p>
        </div>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-zinc-800 disabled:opacity-60"
      >
        {isPending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
