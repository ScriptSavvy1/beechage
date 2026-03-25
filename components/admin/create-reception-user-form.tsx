"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { AlertBanner } from "@/components/forms/alert-banner";
import { FormField } from "@/components/forms/form-field";
import { createReceptionUser } from "@/lib/actions/admin-users";
import { formInputClassName } from "@/lib/ui/form-classes";
import { createReceptionUserSchema, type CreateReceptionUserInput } from "@/lib/validations/admin-users";

export function CreateReceptionUserForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateReceptionUserInput>({
    resolver: zodResolver(createReceptionUserSchema),
    defaultValues: { email: "", name: "", password: "" },
  });

  const onSubmit = (data: CreateReceptionUserInput) => {
    setServerError(null);
    startTransition(async () => {
      const result = await createReceptionUser(data);
      if (result.ok) {
        router.push("/admin");
        router.refresh();
        return;
      }
      setServerError(result.error);
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-lg space-y-6">
      {serverError ? <AlertBanner tone="error">{serverError}</AlertBanner> : null}

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">New reception user</h2>
        <p className="mt-1 text-sm text-zinc-600">They can sign in and create orders only.</p>

        <div className="mt-6 space-y-5">
          <FormField label="Email" htmlFor="email" error={errors.email?.message} required>
            <input id="email" type="email" autoComplete="off" className={formInputClassName} disabled={isPending} {...register("email")} />
          </FormField>

          <FormField label="Display name" htmlFor="name" error={errors.name?.message}>
            <input id="name" className={formInputClassName} disabled={isPending} {...register("name")} />
          </FormField>

          <FormField label="Temporary password" htmlFor="password" error={errors.password?.message} required>
            <input id="password" type="password" autoComplete="new-password" className={formInputClassName} disabled={isPending} {...register("password")} />
          </FormField>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-zinc-800 disabled:opacity-60"
          >
            {isPending ? "Creating…" : "Create user"}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => router.push("/admin")}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}
