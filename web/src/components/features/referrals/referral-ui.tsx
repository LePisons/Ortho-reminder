import { ReactNode } from "react";
import { treatmentFields, TreatmentRequest } from "@/lib/api/referrals.api";

export const primaryAction =
  "min-h-11 rounded-xl bg-brand-blue-strong px-5 text-white font-semibold shadow-sm hover:bg-[#4e53dc]";
export const secondaryAction =
  "min-h-11 rounded-xl border border-brand-blue/30 bg-card px-4 text-primary font-semibold hover:bg-secondary";
export const panel = "rounded-2xl border border-border bg-card p-5 sm:p-7";

export function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {description && (
          <p className="mt-1 max-w-2xl text-sm leading-6 text-foreground/65">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
export function TreatmentSummary({
  value,
}: {
  value?: TreatmentRequest | null;
}) {
  return (
    <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
      {treatmentFields.map((field) => (
        <div
          key={field.key}
          className={field.key === "goals" ? "sm:col-span-2" : ""}
        >
          <h3 className="text-sm font-semibold">{field.label}</h3>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-foreground/65">
            {value?.[field.key]?.trim() || "Sin indicación registrada"}
          </p>
        </div>
      ))}
    </div>
  );
}
