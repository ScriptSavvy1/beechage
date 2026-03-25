import type { ReactNode } from "react";
import { formErrorClassName, formLabelClassName } from "@/lib/ui/form-classes";

type Props = {
  label: string;
  htmlFor?: string;
  error?: string;
  children: ReactNode;
  required?: boolean;
};

export function FormField({ label, htmlFor, error, children, required }: Props) {
  return (
    <div>
      <label htmlFor={htmlFor} className={formLabelClassName}>
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      {children}
      {error ? <p className={formErrorClassName}>{error}</p> : null}
    </div>
  );
}
