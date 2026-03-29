"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { z } from "zod";
import { AlertBanner } from "@/components/forms/alert-banner";
import { FormField } from "@/components/forms/form-field";
import { createServiceItem, updateServiceItem } from "@/lib/actions/service-catalog";
import { formInputClassName } from "@/lib/ui/form-classes";
import {
  serviceItemFormSchema,
  updateServiceItemSchema,
  type ServiceItemFormInput,
} from "@/lib/validations/service-catalog";

type EditFormValues = z.infer<typeof updateServiceItemSchema>;

type Props =
  | { mode: "create"; categoryId: string }
  | {
      mode: "edit";
      categoryId: string;
      itemId: string;
      defaultValues: ServiceItemFormInput;
    };

export function ServiceItemForm(props: Props) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const mergedDefaults: ServiceItemFormInput =
    props.mode === "edit"
      ? props.defaultValues
      : {
          name: "",
          defaultPrice: 0.01,
          pricingType: "FIXED",
          sortOrder: 10,
          isActive: true,
        };

  const resolver =
    props.mode === "edit" ? zodResolver(updateServiceItemSchema) : zodResolver(serviceItemFormSchema);

  const defaultValues: ServiceItemFormInput | EditFormValues =
    props.mode === "edit"
      ? {
          id: props.itemId,
          serviceCategoryId: props.categoryId,
          ...mergedDefaults,
        }
      : mergedDefaults;

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ServiceItemFormInput | EditFormValues>({
    resolver: resolver as Resolver<ServiceItemFormInput | EditFormValues>,
    defaultValues,
  });

  const watchedPricingType = useWatch({ control, name: "pricingType" }) ?? "FIXED";

  const onSubmit = (data: ServiceItemFormInput | EditFormValues) => {
    setServerError(null);
    startTransition(async () => {
      if (props.mode === "create") {
        const result = await createServiceItem(props.categoryId, data as ServiceItemFormInput);
        if (result.ok) {
          router.push(`/admin/services/${props.categoryId}/edit`);
          router.refresh();
          return;
        }
        setServerError(result.error);
        return;
      }
      const result = await updateServiceItem(data as EditFormValues);
      if (result.ok) {
        router.push(`/admin/services/${props.categoryId}/edit`);
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
          {props.mode === "create" ? "New catalog item" : "Edit item"}
        </h2>

        <div className="mt-6 space-y-5">
          <FormField label="Name" htmlFor="name" error={errors.name?.message} required>
            <input id="name" className={formInputClassName} disabled={isPending} {...register("name")} />
          </FormField>

          <FormField label="Pricing type" htmlFor="pricingType" error={errors.pricingType?.message} required>
            <select id="pricingType" className={formInputClassName} disabled={isPending} {...register("pricingType")}>
              <option value="FIXED">Fixed price</option>
              <option value="PER_KG">Per kilogram (⚖️)</option>
            </select>
          </FormField>

          {watchedPricingType === "PER_KG" && (
            <div className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">
              💡 The price you set below is the <strong>rate per kilogram</strong>. The final price will be calculated when the laundry staff weighs the items.
            </div>
          )}

          <FormField
            label={watchedPricingType === "PER_KG" ? "Price per KG (USD)" : "Default price (USD)"}
            htmlFor="defaultPrice"
            error={errors.defaultPrice?.message}
            required
          >
            <input
              id="defaultPrice"
              type="number"
              min={0.01}
              step={0.01}
              className={formInputClassName}
              disabled={isPending}
              {...register("defaultPrice", { valueAsNumber: true })}
            />
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
            <input type="checkbox" className="rounded border-zinc-300" disabled={isPending} {...register("isActive")} />
            Active (shown when creating orders)
          </label>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-zinc-800 disabled:opacity-60"
          >
            {isPending ? "Saving…" : props.mode === "create" ? "Create item" : "Save"}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => router.push(`/admin/services/${props.categoryId}/edit`)}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}
