"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { z } from "zod";
import { AlertBanner } from "@/components/forms/alert-banner";
import { FormField } from "@/components/forms/form-field";
import { createServiceCategory, updateServiceCategory } from "@/lib/actions/service-catalog";
import { formInputClassName } from "@/lib/ui/form-classes";
import {
  serviceCategoryFormSchema,
  updateServiceCategorySchema,
  type ServiceCategoryFormInput,
} from "@/lib/validations/service-catalog";

type EditFormValues = z.infer<typeof updateServiceCategorySchema>;

type Props =
  | { mode: "create" }
  | { mode: "edit"; categoryId: string; defaultValues: ServiceCategoryFormInput };

export function ServiceCategoryForm(props: Props) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const mergedDefaults: ServiceCategoryFormInput =
    props.mode === "edit"
      ? props.defaultValues
      : {
          name: "",
          sortOrder: 99,
          allowsCustomPricing: false,
          isActive: true,
        };

  const resolver =
    props.mode === "edit"
      ? zodResolver(updateServiceCategorySchema)
      : zodResolver(serviceCategoryFormSchema);

  const defaultValues: ServiceCategoryFormInput | EditFormValues =
    props.mode === "edit"
      ? { id: props.categoryId, ...mergedDefaults }
      : mergedDefaults;

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ServiceCategoryFormInput | EditFormValues>({
    resolver: resolver as Resolver<ServiceCategoryFormInput | EditFormValues>,
    defaultValues,
  });

  const allowsCustom = watch("allowsCustomPricing");

  const onSubmit = (data: ServiceCategoryFormInput | EditFormValues) => {
    setServerError(null);
    startTransition(async () => {
      if (props.mode === "create") {
        const result = await createServiceCategory(data as ServiceCategoryFormInput);
        if (result.ok) {
          router.push("/admin/services");
          router.refresh();
          return;
        }
        setServerError(result.error);
        return;
      }
      const result = await updateServiceCategory(data as EditFormValues);
      if (result.ok) {
        router.push("/admin/services");
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
        <h2 className="text-lg font-semibold text-zinc-900">
          {props.mode === "create" ? "New service category" : "Edit category"}
        </h2>

        <div className="mt-6 space-y-5">
          <FormField label="Name" htmlFor="name" error={errors.name?.message} required>
            <input id="name" className={formInputClassName} disabled={isPending} {...register("name")} />
          </FormField>

          <FormField label="Sort order" htmlFor="sortOrder" error={errors.sortOrder?.message} required>
            <input
              id="sortOrder"
              type="number"
              min={0}
              className={formInputClassName}
              disabled={isPending}
              {...register("sortOrder", { valueAsNumber: true })}
            />
          </FormField>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-800">
            <input
              type="checkbox"
              className="rounded border-zinc-300"
              disabled={isPending}
              {...register("allowsCustomPricing")}
            />
            Custom pricing (reception enters item name &amp; price — e.g. &quot;Other&quot;)
          </label>
          {allowsCustom ? (
            <p className="text-xs text-zinc-500">
              Catalog items under this category are hidden at reception. Existing items are deactivated when you save.
            </p>
          ) : null}

          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-800">
            <input type="checkbox" className="rounded border-zinc-300" disabled={isPending} {...register("isActive")} />
            Active (shown in reception &amp; dashboard filters)
          </label>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-zinc-800 disabled:opacity-60"
          >
            {isPending ? "Saving…" : props.mode === "create" ? "Create" : "Save"}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => router.push("/admin/services")}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}
