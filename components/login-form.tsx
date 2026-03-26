"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

/**
 * Login form using NextAuth's redirect flow (redirect: true).
 *
 * Why NOT redirect: false?
 *   next-auth@5.0.0-beta.25 has a known issue where the 200 JSON response
 *   from /api/auth/callback/credentials does NOT include the Set-Cookie header,
 *   so the session is never persisted in the browser.
 *
 * Why NOT server actions with useActionState?
 *   The server action imports lib/auth.ts → Prisma + bcrypt, which crashes
 *   during SSR on Windows due to the Prisma DLL lock issue.
 *
 * This approach uses redirect: true (the default). On success, NextAuth
 * sets the cookie via a proper 302 redirect. On failure, it redirects to
 * pages.error ("/login?error=CredentialsSignin") and we display the error.
 */
export function LoginForm() {
  const searchParams = useSearchParams();
  const errorCode = searchParams.get("error");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const errorMessage =
    errorCode === "CredentialsSignin"
      ? "Invalid email or password."
      : errorCode
        ? "Something went wrong. Please try again."
        : null;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    // redirect: true (default) — NextAuth will:
    // 1. POST to /api/auth/callback/credentials
    // 2. Set the session cookie via Set-Cookie header
    // 3. Redirect to callbackUrl on success, or /login?error=... on failure
    await signIn("credentials", {
      email,
      password,
      callbackUrl: "/",
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium text-zinc-700">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
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
          required
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 shadow-sm outline-none ring-zinc-400 focus:ring-2"
        />
      </div>
      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-700">{errorMessage}</p>
        </div>
      )}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-zinc-800 disabled:opacity-60"
      >
        {isSubmitting ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
