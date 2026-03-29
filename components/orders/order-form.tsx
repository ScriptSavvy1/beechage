"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import type { FieldErrors, UseFormRegister, UseFormSetValue } from "react-hook-form";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { createOrder, updateOrder } from "@/lib/actions/orders";
import type { ServiceCatalogCategory } from "@/lib/actions/orders";
import { formatCurrency } from "@/lib/format";
import { createOrderSchema, type CreateOrderInput, type UpdateOrderInput, type OrderLineInput } from "@/lib/validations/order";

type Props = {
  catalog: ServiceCatalogCategory[];
  mode?: "create" | "edit";
  orderId?: string;
  defaultValues?: {
    customerName: string;
    customerPhone: string;
    notes: string;
    items: OrderLineInput[];
  };
};

function defaultLine(catalog: ServiceCatalogCategory[]): OrderLineInput {
  const first = catalog[0];
  if (!first) {
    return { kind: "catalog", serviceCategoryId: "", serviceItemId: "", quantity: 1 };
  }
  if (first.allowsCustomPricing) {
    return {
      kind: "custom",
      serviceCategoryId: first.id,
      customItemName: "",
      unitPrice: 0.01,
      quantity: 1,
    };
  }
  return {
    kind: "catalog",
    serviceCategoryId: first.id,
    serviceItemId: first.items[0]?.id ?? "",
    quantity: 1,
  };
}

export function OrderForm({ catalog, mode = "create", orderId, defaultValues: editDefaults }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isEdit = mode === "edit" && !!orderId;

  const defaultValues: CreateOrderInput = editDefaults
    ? {
        notes: editDefaults.notes,
        customerName: editDefaults.customerName,
        customerPhone: editDefaults.customerPhone,
        items: editDefaults.items.length > 0 ? editDefaults.items : [defaultLine(catalog)],
      }
    : {
        notes: "",
        customerName: "",
        customerPhone: "",
        items: [defaultLine(catalog)],
      };

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CreateOrderInput>({
    resolver: zodResolver(createOrderSchema),
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  const watchedItems = useWatch({ control, name: "items" }) ?? defaultValues.items;

  // Find which items are PER_KG for display logic
  const getItemPricingType = (row: OrderLineInput | undefined) => {
    if (!row || row.kind === "custom") return "FIXED";
    const cat = catalog.find((c) => c.id === row.serviceCategoryId);
    const item = cat?.items.find((i) => i.id === row.serviceItemId);
    return item?.pricingType ?? "FIXED";
  };

  const { grandTotal, hasPendingKg } = useMemo(() => {
    let total = 0;
    let pending = false;
    for (const row of watchedItems) {
      if (!row) continue;
      const q = Number(row.quantity) || 0;
      if (row.kind === "custom") {
        const p = Number(row.unitPrice) || 0;
        total += q * p;
      } else {
        const cat = catalog.find((c) => c.id === row.serviceCategoryId);
        const item = cat?.items.find((i) => i.id === row.serviceItemId);
        if (item?.pricingType === "PER_KG") {
          pending = true;
          // Don't add to total — price TBD
        } else {
          const p = item?.defaultPrice ?? 0;
          total += q * p;
        }
      }
    }
    return { grandTotal: total, hasPendingKg: pending };
  }, [watchedItems, catalog]);

  const onSubmit = (data: CreateOrderInput) => {
    setError(null);
    startTransition(async () => {
      if (isEdit) {
        const editData: UpdateOrderInput = { ...data, orderId: orderId! };
        const result = await updateOrder(editData);
        if (result.ok) {
          router.push(`/reception/orders/${orderId}`);
          router.refresh();
          return;
        }
        setError(result.error);
      } else {
        const result = await createOrder(data);
        if (result.ok) {
          router.push(`/reception/orders/${result.orderId}`);
          router.refresh();
          return;
        }
        setError(result.error);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pb-32 sm:space-y-8 lg:pb-0">
      <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:gap-8">
        <div className="space-y-4 sm:space-y-6">
          <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold text-zinc-900">Order details</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-1">
                <label className="mb-1 block text-sm font-medium text-zinc-700">Customer name</label>
                <input
                  type="text"
                  placeholder="Customer full name"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm text-zinc-900 shadow-sm outline-none ring-zinc-400 focus:ring-2"
                  {...register("customerName")}
                />
                {errors.customerName && (
                  <p className="mt-1 text-sm text-red-600">{errors.customerName.message}</p>
                )}
              </div>
              <div className="sm:col-span-1">
                <label className="mb-1 block text-sm font-medium text-zinc-700">Customer phone</label>
                <input
                  type="tel"
                  placeholder="e.g. +1 555 123 4567"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm text-zinc-900 shadow-sm outline-none ring-zinc-400 focus:ring-2"
                  {...register("customerPhone")}
                />
                {errors.customerPhone && (
                  <p className="mt-1 text-sm text-red-600">{errors.customerPhone.message}</p>
                )}
              </div>
            </div>
            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-zinc-700">Notes</label>
              <textarea
                rows={3}
                placeholder="Pickup instructions, stains, fabric care…"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm text-zinc-900 shadow-sm outline-none ring-zinc-400 focus:ring-2"
                {...register("notes")}
              />
              {errors.notes && <p className="mt-1 text-sm text-red-600">{errors.notes.message}</p>}
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-zinc-900">Line items</h2>
              <button
                type="button"
                onClick={() => append(defaultLine(catalog))}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50"
              >
                + Add row
              </button>
            </div>

            {errors.items?.message && (
              <p className="mt-2 text-sm text-red-600">{errors.items.message}</p>
            )}

            <div className="mt-4 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    <th className="pb-2 pr-3">Category</th>
                    <th className="pb-2 pr-3">Item</th>
                    <th className="pb-2 pr-3">Qty</th>
                    <th className="pb-2 pr-3">Unit price</th>
                    <th className="pb-2 pr-3 text-right">Line total</th>
                    <th className="pb-2 w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {fields.map((field, index) => (
                    <OrderItemRow
                      key={field.id}
                      index={index}
                      catalog={catalog}
                      register={register}
                      setValue={setValue}
                      errors={errors}
                      watchedItems={watchedItems}
                      canRemove={fields.length > 1}
                      onRemove={() => remove(index)}
                      getItemPricingType={getItemPricingType}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Desktop sidebar */}
        <aside className="hidden h-fit lg:sticky lg:top-20 lg:block">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-900 p-6 text-white shadow-lg">
            <p className="text-sm font-medium text-zinc-300">Order total</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">{formatCurrency(grandTotal)}</p>
            {hasPendingKg && (
              <p className="mt-2 rounded-md bg-amber-500/20 px-2 py-1 text-xs text-amber-200">
                ⚖️ + pending per-KG items (priced after weighing)
              </p>
            )}
            <p className="mt-2 text-xs text-zinc-400">
              Totals are recalculated on the server when you save.
            </p>
            {error && (
              <p className="mt-4 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-100">{error}</p>
            )}
            <button
              type="submit"
              disabled={isPending || catalog.length === 0}
              className="mt-6 w-full rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 shadow transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Saving…" : isEdit ? "Update order" : "Save order"}
            </button>
          </div>
        </aside>
      </div>

      {/* Mobile sticky bottom bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-zinc-900 px-4 py-3 lg:hidden">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-4">
          <div className="text-white">
            <p className="text-xs text-zinc-400">Total</p>
            <p className="text-xl font-semibold tracking-tight">
              {formatCurrency(grandTotal)}
              {hasPendingKg && <span className="ml-1 text-xs text-amber-300">+ pending</span>}
            </p>
          </div>
          {error && <p className="text-xs text-red-300">{error}</p>}
          <button
            type="submit"
            disabled={isPending || catalog.length === 0}
            className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-zinc-900 shadow transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Saving…" : isEdit ? "Update" : "Save order"}
          </button>
        </div>
      </div>
    </form>
  );
}

function OrderItemRow({
  index,
  catalog,
  register,
  setValue,
  errors,
  watchedItems,
  canRemove,
  onRemove,
  getItemPricingType,
}: {
  index: number;
  catalog: ServiceCatalogCategory[];
  register: UseFormRegister<CreateOrderInput>;
  setValue: UseFormSetValue<CreateOrderInput>;
  errors: FieldErrors<CreateOrderInput>;
  watchedItems: CreateOrderInput["items"];
  canRemove: boolean;
  onRemove: () => void;
  getItemPricingType: (row: OrderLineInput | undefined) => string;
}) {
  const row = watchedItems[index];
  const cat = row ? catalog.find((c) => c.id === row.serviceCategoryId) : undefined;
  const qty = Number(row?.quantity) || 0;
  const pricingType = getItemPricingType(row);
  const isPerKg = pricingType === "PER_KG";

  let unitPriceDisplay = 0;
  let lineTotal = 0;
  if (row?.kind === "custom") {
    unitPriceDisplay = Number(row.unitPrice) || 0;
    lineTotal = qty * unitPriceDisplay;
  } else if (row?.kind === "catalog" && cat) {
    const item = cat.items.find((i) => i.id === row.serviceItemId);
    unitPriceDisplay = item?.defaultPrice ?? 0;
    if (!isPerKg) {
      lineTotal = qty * unitPriceDisplay;
    }
  }

  const rawItems = errors.items as unknown;
  const itemErrors = Array.isArray(rawItems) ? rawItems[index] : undefined;

  function onCategoryChange(categoryId: string) {
    const next = catalog.find((c) => c.id === categoryId);
    if (!next) return;
    if (next.allowsCustomPricing) {
      setValue(`items.${index}.kind`, "custom");
      setValue(`items.${index}.serviceCategoryId`, categoryId);
      setValue(`items.${index}.customItemName`, "");
      setValue(`items.${index}.unitPrice`, 0.01);
      setValue(`items.${index}.quantity`, row?.quantity ?? 1);
      return;
    }
    setValue(`items.${index}.kind`, "catalog");
    setValue(`items.${index}.serviceCategoryId`, categoryId);
    setValue(`items.${index}.serviceItemId`, next.items[0]?.id ?? "");
    setValue(`items.${index}.quantity`, row?.quantity ?? 1);
  }

  return (
    <tr className={isPerKg ? "bg-blue-50/40" : ""}>
      <td className="py-3 pr-3 align-top">
        <input type="hidden" {...register(`items.${index}.kind` as const)} />
        <select
          className="w-full min-w-[140px] rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm text-zinc-900 shadow-sm outline-none ring-zinc-400 focus:ring-2"
          value={row?.serviceCategoryId ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            setValue(`items.${index}.serviceCategoryId`, v);
            onCategoryChange(v);
          }}
        >
          <option value="">Select category</option>
          {catalog.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {itemErrors?.serviceCategoryId && (
          <p className="mt-1 text-xs text-red-600">{String(itemErrors.serviceCategoryId.message)}</p>
        )}
      </td>
      <td className="py-3 pr-3 align-top">
        {row?.kind === "custom" ? (
          <div className="flex min-w-[200px] flex-col gap-2">
            <input
              type="text"
              placeholder="Item name"
              className="w-full rounded-lg border border-zinc-300 px-2 py-2 text-sm"
              {...register(`items.${index}.customItemName` as const)}
            />
            <input
              type="number"
              min={0.01}
              step={0.01}
              className="w-full rounded-lg border border-zinc-300 px-2 py-2 text-sm"
              {...register(`items.${index}.unitPrice` as const, { valueAsNumber: true })}
            />
            {itemErrors?.customItemName && (
              <p className="text-xs text-red-600">{String(itemErrors.customItemName.message)}</p>
            )}
            {itemErrors?.unitPrice && (
              <p className="text-xs text-red-600">{String(itemErrors.unitPrice.message)}</p>
            )}
          </div>
        ) : (
          <>
            <select
              className="w-full min-w-[180px] rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm text-zinc-900 shadow-sm outline-none ring-zinc-400 focus:ring-2"
              {...register(`items.${index}.serviceItemId` as const)}
              disabled={!cat || cat.items.length === 0}
            >
              <option value="">Select item</option>
              {(cat?.items ?? []).map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} {i.pricingType === "PER_KG" ? `(⚖️ ${formatCurrency(i.defaultPrice)}/kg)` : `(${formatCurrency(i.defaultPrice)})`}
                </option>
              ))}
            </select>
            {itemErrors?.serviceItemId && (
              <p className="mt-1 text-xs text-red-600">{String(itemErrors.serviceItemId.message)}</p>
            )}
          </>
        )}
      </td>
      <td className="py-3 pr-3 align-top">
        {isPerKg ? (
          <span className="inline-flex items-center rounded-md bg-blue-100 px-2 py-1.5 text-xs font-medium text-blue-800">
            ⚖️ By weight
          </span>
        ) : (
          <>
            <input
              type="number"
              min={1}
              step={1}
              className="w-20 rounded-lg border border-zinc-300 px-2 py-2 text-sm text-zinc-900 shadow-sm outline-none ring-zinc-400 focus:ring-2"
              {...register(`items.${index}.quantity` as const, { valueAsNumber: true })}
            />
            {itemErrors?.quantity && (
              <p className="mt-1 text-xs text-red-600">{String(itemErrors.quantity.message)}</p>
            )}
          </>
        )}
      </td>
      <td className="py-3 pr-3 align-top">
        {row?.kind === "custom" ? (
          <span className="text-xs text-zinc-500">entered above</span>
        ) : isPerKg ? (
          <span className="text-xs font-medium text-blue-700">{formatCurrency(unitPriceDisplay)}/kg</span>
        ) : (
          <span className="font-medium tabular-nums text-zinc-900">{formatCurrency(unitPriceDisplay)}</span>
        )}
      </td>
      <td className="py-3 pr-3 text-right align-top font-medium tabular-nums text-zinc-900">
        {isPerKg ? (
          <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">TBD</span>
        ) : (
          formatCurrency(lineTotal)
        )}
      </td>
      <td className="py-3 align-top">
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="rounded p-1 text-xs font-medium text-red-600 hover:bg-red-50"
            aria-label="Remove row"
          >
            ✕
          </button>
        )}
      </td>
    </tr>
  );
}
