import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Sign in</h1>
          <p className="mt-2 text-sm text-zinc-600">Laundry management — staff access</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
