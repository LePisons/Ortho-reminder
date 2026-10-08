"use client";
import { useState } from "react";
import { CheckCircle2, Circle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ReferralDetail,
  referralStages,
  referralNextStep,
  photoViews,
  referralRequest,
} from "@/lib/api/referrals.api";
import { panel, primaryAction } from "./referral-ui";

type Props = {
  record: ReferralDetail;
  admin: boolean;
  busy: boolean;
  action: (work: () => Promise<void>, message?: string) => Promise<void>;
};

export function CaseWorkflow({
  record,
  admin,
  busy,
  action,
  onSection,
}: Props & { onSection: (section: string) => void }) {
  const [note, setNote] = useState("");
  const stage = record.stage;
  const targets =
    stage === "APPROVED"
      ? ["MANUFACTURING", "PLANNING"]
      : stage === "MANUFACTURING"
        ? ["DELIVERED", "PLANNING"]
        : ["REVIEW", "DELIVERED"].includes(stage)
          ? ["PLANNING"]
          : [];
  return (
    <section className={`${panel} space-y-6`} aria-label="Seguimiento del caso">
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-3">
          <h2 className="text-xl font-semibold">
            {referralStages[stage] || "Seguimiento"}
          </h2>
          <p className="max-w-prose text-sm leading-6 text-muted-foreground">
            {record.revokedAt
              ? "El acceso del colega está revocado."
              : referralNextStep[stage]}
          </p>
          {admin &&
            !record.revokedAt &&
            record.status === "ACCEPTED" &&
            targets.length > 0 && (
              <div className="space-y-3 border-l-2 border-[#6469FC] pl-4">
                <label className="block space-y-2 text-sm">
                  Nota del cambio (obligatoria para volver a planificación)
                  <Textarea
                    value={note}
                    maxLength={2000}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  {targets.map((target) => (
                    <Button
                      key={target}
                      disabled={busy || (target === "PLANNING" && !note.trim())}
                      variant={target === "PLANNING" ? "outline" : "default"}
                      onClick={() => {
                        if (
                          !window.confirm(
                            target === "PLANNING"
                              ? "¿Volver a planificación? Tendrás que compartir una nueva versión para obtener otra aprobación."
                              : `¿Registrar el estado «${referralStages[target]}»?`,
                          )
                        )
                          return;
                        void action(async () => {
                          await referralRequest(
                            `/${record.id}/stage`,
                            "PATCH",
                            { stage: target, expectedStage: stage, note },
                          );
                          setNote("");
                        }, "Estado actualizado.");
                      }}
                    >
                      {target === "PLANNING"
                        ? "Volver a planificación"
                        : target === "MANUFACTURING"
                          ? "Registrar fabricación"
                          : "Registrar entrega"}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Registra el avance compartido; no crea órdenes de laboratorio
                  automáticamente.
                </p>
              </div>
            )}
        </div>
        <details
          open={record.status === "DRAFT" || record.status === "NEEDS_INFO"}
          className="rounded-xl border p-4"
        >
          <summary className="cursor-pointer font-semibold">
            Checklist de antecedentes{" "}
            <span className="text-sm font-normal text-muted-foreground">
              {record.checklist?.items.filter((i) => i.complete).length || 0}/
              {record.checklist?.items.length || 0}
            </span>
          </summary>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            Los STL y las indicaciones son obligatorios. Completa las fotos y
            adjunta las radiografías disponibles si corresponden; no es una
            indicación para solicitar nuevos exámenes.
          </p>
          <ul className="mt-3 space-y-2">
            {record.checklist?.items.map((item) => (
              <li key={item.key} className="flex items-start gap-2 text-sm">
                {item.complete ? (
                  <CheckCircle2
                    size={17}
                    className="mt-0.5 shrink-0 text-emerald-700"
                  />
                ) : (
                  <Circle
                    size={17}
                    className="mt-0.5 shrink-0 text-amber-700"
                  />
                )}
                <button
                  className="text-left hover:underline focus-visible:outline focus-visible:outline-2"
                  onClick={() => onSection(item.section)}
                >
                  {photoViews[item.key] || item.label}
                  <span className="block text-xs text-muted-foreground">
                    {item.complete
                      ? "Adjunto / completo"
                      : item.required
                        ? "Pendiente · obligatorio"
                        : "Pendiente · según el caso"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      </div>
      <details className="border-t pt-4">
        <summary className="cursor-pointer text-sm font-semibold">
          Historial de estados y decisiones
        </summary>
        <p className="mt-3 text-xs text-muted-foreground">
          Recibido → Planificación → Revisión → Aprobado → Fabricación →
          Entregado. Las solicitudes de información o cambios quedan registradas
          aquí.
        </p>
        {!record.timeline?.length && (
          <p className="mt-3 text-sm text-muted-foreground">
            Aún no hay cambios registrados en este historial. El estado actual
            aparece arriba.
          </p>
        )}
        <ol className="mt-4 space-y-5 border-l-2 border-[#6469FC]/25 pl-4">
          {record.timeline?.map((event) => (
            <li key={event.id}>
              <p className="text-sm font-semibold">
                {referralStages[event.stage]}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {event.actorName} ·{" "}
                {new Date(event.createdAt).toLocaleString("es-CL")}
              </p>
              {event.note && (
                <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                  {event.note}
                </p>
              )}
            </li>
          ))}
        </ol>
      </details>
    </section>
  );
}

export function SetupVersions({ record, admin, busy, action }: Props) {
  const [note, setNote] = useState("");
  return (
    <div className="space-y-4">
      {record.setups.map((setup, index) => (
        <article key={setup.id} className="space-y-3 rounded-xl border p-4">
          <p className="text-xs font-semibold text-[#5559d9]">
            {index === 0 ? "Última versión" : "Versión anterior"}
          </p>
          <a
            href={setup.url}
            target="_blank"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
            className="flex items-center justify-between gap-2 text-sm font-semibold underline underline-offset-4"
          >
            {setup.title}
            <ExternalLink size={16} className="shrink-0" />
          </a>
          <p className="text-xs text-muted-foreground">
            Compartido el {new Date(setup.createdAt).toLocaleString("es-CL")}
          </p>
          <p
            className={`text-sm font-semibold ${setup.decision === "APPROVED" ? "text-emerald-700" : setup.decision === "CHANGES_REQUESTED" ? "text-amber-800" : "text-muted-foreground"}`}
          >
            {setup.decision === "APPROVED"
              ? "Aprobado"
              : setup.decision === "CHANGES_REQUESTED"
                ? "Cambios solicitados"
                : index === 0 && record.stage === "REVIEW"
                  ? "Pendiente de revisión"
                  : "Sin decisión registrada"}
          </p>
          {setup.decidedAt && (
            <p className="text-xs text-muted-foreground">
              {setup.decidedByName} ·{" "}
              {new Date(setup.decidedAt).toLocaleString("es-CL")}
            </p>
          )}
          {setup.decisionNote && (
            <p className="whitespace-pre-wrap break-words text-sm">
              {setup.decisionNote}
            </p>
          )}
          {!admin &&
            !record.revokedAt &&
            index === 0 &&
            record.stage === "REVIEW" &&
            !setup.decision && (
              <div className="space-y-3 border-t pt-3">
                <label className="block space-y-2 text-sm">
                  Observaciones (obligatorias para solicitar cambios)
                  <Textarea
                    rows={3}
                    maxLength={5000}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </label>
                <p className="text-xs text-muted-foreground">
                  Revisa el enlace antes de responder. Tu decisión quedará
                  asociada a esta versión y no se podrá editar.
                </p>
                <div className="flex flex-wrap gap-2">
                  {["APPROVED", "CHANGES_REQUESTED"].map((decision) => (
                    <Button
                      key={decision}
                      className={decision === "APPROVED" ? primaryAction : ""}
                      variant={decision === "APPROVED" ? "default" : "outline"}
                      disabled={
                        busy ||
                        (decision === "CHANGES_REQUESTED" && !note.trim())
                      }
                      onClick={() => {
                        if (
                          !window.confirm(
                            `${decision === "APPROVED" ? "¿Aprobar" : "¿Solicitar cambios en"} «${setup.title}»? Se guardará tu decisión para esta versión.`,
                          )
                        )
                          return;
                        void action(
                          async () => {
                            await referralRequest(
                              `/${record.id}/setups/${setup.id}/decision`,
                              "POST",
                              { decision, note },
                            );
                            setNote("");
                          },
                          decision === "APPROVED"
                            ? "Setup aprobado."
                            : "Solicitud de cambios enviada.",
                        );
                      }}
                    >
                      {decision === "APPROVED"
                        ? "Aprobar setup"
                        : "Solicitar cambios"}
                    </Button>
                  ))}
                </div>
              </div>
            )}
        </article>
      ))}
    </div>
  );
}
