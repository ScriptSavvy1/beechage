import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 text-center sm:mb-8">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-900 text-sm font-bold text-white">
            BH
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">Sign in</h1>
          <p className="mt-1 text-sm text-zinc-600">Laundry management — staff access</p>
        </div>
        <Suspense fallback={<p className="text-center text-sm text-zinc-500">Loading…</p>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
