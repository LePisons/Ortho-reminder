"use client";

import {
  Inbox,
  ClipboardList,
  ScanLine,
  BadgeCheck,
  Settings2,
  PackageCheck,
  ArrowRight,
  CircleAlert,
  PencilLine,
} from "lucide-react";
import {
  ReferralDetail,
  referralNextStep,
  referralStages,
} from "@/lib/api/referrals.api";

const steps = [
  { key: "RECEIVED", title: "Recibido", owner: "Especialista", icon: Inbox },
  {
    key: "PLANNING",
    title: "Planificación",
    owner: "Especialista",
    icon: ScanLine,
  },
  {
    key: "REVIEW",
    title: "Revisión",
    owner: "Colega derivador",
    icon: ClipboardList,
  },
  {
    key: "APPROVED",
    title: "Aprobado",
    owner: "Especialista",
    icon: BadgeCheck,
  },
  {
    key: "MANUFACTURING",
    title: "Fabricación",
    owner: "Especialista",
    icon: Settings2,
  },
  {
    key: "DELIVERED",
    title: "Entregado",
    owner: "Entrega registrada",
    icon: PackageCheck,
  },
];

export function CaseProgress({ record }: { record: ReferralDetail }) {
  const draft = record.stage === "DRAFT";
  const missing = record.stage === "NEEDS_INFO";
  const index = steps.findIndex(
    (step) => step.key === (missing ? "RECEIVED" : record.stage),
  );
  const latest = record.setups[0];
  const changes =
    record.stage === "PLANNING" && latest?.decision === "CHANGES_REQUESTED";
  const responsible =
    draft || missing || record.stage === "REVIEW"
      ? "Colega derivador"
      : "Especialista";
  const Icon = draft
    ? PencilLine
    : missing || changes
      ? CircleAlert
      : steps[index]?.icon || Inbox;
  return (
    <div className="space-y-5 px-5 pb-5 pt-5 sm:px-6 sm:pt-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-sm font-medium text-muted-foreground">
            Seguimiento de la derivación
          </p>
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {referralStages[record.stage] || "Estado del caso"}
          </h2>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-[#6469FC]/20 bg-[#6469FC]/[0.07] px-3 py-1.5 text-xs font-semibold text-[#5559d9]">
          <span className="h-2 w-2 rounded-full bg-[#6469FC]" />
          {record.revokedAt
            ? "Acceso revocado"
            : draft
              ? "Aún no enviado"
              : missing || changes
                ? "Requiere información"
                : record.stage === "DELIVERED"
                  ? "Entrega registrada"
                  : "En curso"}
        </span>
      </div>
      <ol
        aria-label="Etapas de la derivación"
        className="grid gap-0 sm:grid-cols-6"
      >
        {steps.map((step, i) => {
          const current = i === index;
          const prior = index > i;
          const StepIcon = step.icon;
          return (
            <li
              key={step.key}
              aria-current={current ? "step" : undefined}
              className="relative flex min-h-14 items-center gap-3 sm:flex-col sm:gap-2 sm:text-center"
            >
              {i < steps.length - 1 && (
                <span
                  aria-hidden="true"
                  className={`absolute bottom-0 left-[19px] top-10 w-0.5 sm:bottom-auto sm:left-[calc(50%+24px)] sm:top-5 sm:h-0.5 sm:w-[calc(100%-48px)] ${prior ? "bg-[#A066F8]/60" : "bg-[#1B1B1B]/10 dark:bg-white/15"}`}
                />
              )}
              <span
                className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${current ? "bg-gradient-to-br from-[#A066F8] to-[#6469FC] text-white shadow-[0_4px_16px_#6469fc35] ring-4 ring-[#6469FC]/10" : prior ? "bg-[#6469FC]/10 text-[#5559d9]" : "bg-[#F0EEE9] text-[#797780]"}`}
              >
                <StepIcon size={20} strokeWidth={current ? 2 : 1.6} />
              </span>
              <div className="flex min-w-0 flex-1 items-center justify-between gap-2 sm:block sm:pb-1">
                <p
                  className={`text-sm ${current ? "font-bold text-[#5559d9]" : "font-medium text-foreground/75"}`}
                >
                  {step.title}
                </p>
                <p
                  className={`text-xs sm:mt-1 ${current ? "font-semibold text-[#5559d9]" : "text-muted-foreground"}`}
                >
                  {current
                    ? missing
                      ? "Faltan antecedentes"
                      : "Estás aquí"
                    : prior
                      ? "Etapa anterior"
                      : "Por venir"}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="flex items-start gap-3 rounded-xl border border-[#6469FC]/15 bg-gradient-to-r from-[#A066F8]/[0.09] to-[#6469FC]/[0.04] p-4">
        <Icon size={21} className="mt-0.5 shrink-0 text-[#5559d9]" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className="text-sm font-semibold">
              {record.revokedAt
                ? "Acceso del colega revocado"
                : record.stage === "DELIVERED"
                  ? "Entrega registrada"
                  : missing
                    ? "Completar antecedentes"
                    : changes
                      ? "Revisar los cambios solicitados"
                      : "Siguiente paso"}
            </h3>
            {!record.revokedAt && record.stage !== "DELIVERED" && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-[#5559d9]">
                <ArrowRight size={12} />
                {responsible}
              </span>
            )}
          </div>
          <p className="mt-1.5 max-w-3xl text-sm leading-6 text-foreground/75">
            {record.revokedAt
              ? "El colega no puede acceder a este caso. Se conserva el historial registrado."
              : referralNextStep[record.stage]}
          </p>
          {(missing || changes) && (
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {missing
                ? "Consulta la solicitud en Conversación. Al reenviar, el caso vuelve a recepción."
                : "Consulta las observaciones del último setup. Comparte una nueva versión para retomar la revisión."}
            </p>
          )}
          {draft && (
            <p className="mt-2 text-xs text-muted-foreground">
              El seguimiento comienza cuando se envía la derivación.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
