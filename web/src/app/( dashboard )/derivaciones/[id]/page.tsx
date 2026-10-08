"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  CaseWorkflow,
  SetupVersions,
} from "@/components/features/referrals/case-workflow";
import { PhotoWorkspace } from "@/components/features/referrals/photo-workspace";
import {
  panel,
  primaryAction,
  secondaryAction,
  TreatmentSummary,
} from "@/components/features/referrals/referral-ui";
import { ReferralForm } from "@/components/features/referrals/referral-form";
import {
  fileKinds,
  ReferralDetail,
  referralRequest,
  referralStages,
} from "@/lib/api/referrals.api";
import { API_URL } from "@/lib/utils";
import {
  ArrowLeft,
  Download,
  FileBox,
  Send,
  ClipboardList,
  Camera,
  MessageSquare,
} from "lucide-react";

type Duplicate = {
  id: string;
  fullName: string;
  rut: string;
  deletedAt: string | null;
};
const StlViewer = dynamic(
  () => import("@/components/features/models/stl-viewer"),
  { ssr: false, loading: () => <p>Cargando visor 3D…</p> },
);

export default function ReferralDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const admin = user?.role === "ADMIN";
  const [record, setRecord] = useState<ReferralDetail | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [kind, setKind] = useState("STL_UPPER");
  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [comment, setComment] = useState("");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [duplicates, setDuplicates] = useState<Duplicate[] | null>(null);
  const [patientId, setPatientId] = useState("");
  const [preview, setPreview] = useState(false);
  const [section, setSection] = useState("treatment");

  const load = useCallback(async () => {
    try {
      setRecord(await referralRequest<ReferralDetail>(`/${id}`));
    } catch (e) {
      setRecord(null);
      setError(e instanceof Error ? e.message : "No se pudo cargar el caso.");
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);
  async function action(work: () => Promise<void>, message?: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
      await load();
      if (message) setNotice(message);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo completar la operación.",
      );
    } finally {
      setBusy(false);
    }
  }
  const editable = record && ["DRAFT", "NEEDS_INFO"].includes(record.status);
  const bothStls =
    record?.files.some((f) => f.kind === "STL_UPPER") &&
    record.files.some((f) => f.kind === "STL_LOWER");
  const active = record && !record.revokedAt;
  const latestStl = (kind: string) => {
    const asset = record?.files.filter((f) => f.kind === kind).at(-1);
    return asset ? `${API_URL}/referrals/${id}/files/${asset.id}` : null;
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <Link
        href="/derivaciones"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={16} />
        Volver a derivaciones
      </Link>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {error}{" "}
          <button className="underline" onClick={() => void load()}>
            Reintentar
          </button>
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800"
        >
          {notice}
        </p>
      )}
      {!record ? (
        !error && <p role="status">Cargando caso…</p>
      ) : (
        <>
          <header className="flex flex-wrap justify-between gap-5 rounded-2xl border bg-card p-6 sm:p-8">
            <div>
              <p className="mb-3 inline-flex rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
                {record.revokedAt
                  ? "Acceso del colega revocado"
                  : referralStages[record.stage]}
              </p>
              <h1 className="text-3xl font-semibold tracking-tight">
                {record.fullName}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Derivado por {record.referrer.name || record.referrer.email}
              </p>
            </div>
            <div className="flex flex-wrap items-start gap-2">
              {admin && record.patientId && (
                <Button asChild variant="outline">
                  <Link href={`/patients/${record.patientId}`}>
                    Abrir ficha interna
                  </Link>
                </Button>
              )}
              {admin && active && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        "¿Revocar el acceso del colega a este caso y sus archivos?",
                      )
                    )
                      void action(async () => {
                        await referralRequest(`/${id}/revoke`, "POST");
                      }, "Acceso revocado.");
                  }}
                >
                  Revocar acceso
                </Button>
              )}
              {!admin && editable && active && (
                <Button
                  className={primaryAction}
                  disabled={busy || !bothStls || !record.checklist?.canSubmit}
                  onClick={() => {
                    if (
                      record.checklist.items.some(
                        (i) => !i.required && !i.complete,
                      ) &&
                      !window.confirm(
                        "Hay fotografías o radiografías pendientes. ¿Enviar con los antecedentes disponibles?",
                      )
                    )
                      return;
                    void action(async () => {
                      await referralRequest(`/${id}/submit`, "POST");
                      setEditing(false);
                    }, "Derivación enviada para revisión.");
                  }}
                >
                  <Send size={16} />
                  Enviar derivación
                </Button>
              )}
            </div>
          </header>
          {!admin && editable && (
            <p className="text-sm text-muted-foreground">
              Guarda los datos y adjunta los STL superior e inferior para enviar
              el caso. Puedes volver más tarde para completar el borrador.
            </p>
          )}
          <CaseWorkflow
            record={record}
            admin={admin}
            busy={busy}
            action={action}
            onSection={setSection}
          />
          <nav
            aria-label="Secciones del caso"
            className="flex flex-wrap gap-2 rounded-2xl border bg-card p-2"
          >
            {[
              {
                key: "treatment",
                label: "Solicitud de tratamiento",
                icon: ClipboardList,
              },
              { key: "files", label: "STL y radiografías", icon: FileBox },
              { key: "photos", label: "Fotografías", icon: Camera },
              { key: "comments", label: "Conversación", icon: MessageSquare },
            ].map((item) => (
              <button
                key={item.key}
                onClick={() => setSection(item.key)}
                aria-current={section === item.key ? "page" : undefined}
                className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-primary ${section === item.key ? "bg-brand-blue-strong text-white" : "text-foreground/70 hover:bg-secondary"}`}
              >
                <item.icon size={17} />
                {item.label}
              </button>
            ))}
          </nav>
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-8">
              <section
                hidden={section !== "treatment"}
                className={`${panel} space-y-5`}
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">
                    Solicitud de tratamiento
                  </h2>
                  {editable && active && (
                    <Button
                      className={secondaryAction}
                      variant="outline"
                      onClick={() => setEditing(!editing)}
                    >
                      {editing ? "Cancelar edición" : "Editar datos"}
                    </Button>
                  )}
                </div>
                {editing ? (
                  <ReferralForm
                    initial={record}
                    busy={busy}
                    onSave={(data) =>
                      action(async () => {
                        await referralRequest(`/${id}`, "PATCH", {
                          fullName: data.fullName,
                          rut: data.rut,
                          email: data.email,
                          phone: data.phone,
                          reason: data.reason,
                          treatment: data.treatment,
                        });
                        setEditing(false);
                      }, "Datos guardados.")
                    }
                  />
                ) : (
                  <>
                    <dl className="grid gap-4 rounded-xl bg-muted/40 p-5 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-muted-foreground">RUT</dt>
                        <dd className="mt-1">{record.rut}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Teléfono</dt>
                        <dd className="mt-1">{record.phone}</dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-muted-foreground">Correo</dt>
                        <dd className="mt-1 break-all">{record.email}</dd>
                      </div>
                    </dl>
                    <h3 className="text-sm font-semibold">
                      Motivo de consulta y antecedentes
                    </h3>
                    <p className="whitespace-pre-wrap break-words text-sm leading-7 text-foreground/70">
                      {record.reason}
                    </p>
                    <div className="border-t pt-5">
                      <TreatmentSummary value={record.treatment} />
                    </div>
                  </>
                )}
              </section>
              <section
                hidden={section !== "files"}
                className={`${panel} space-y-4`}
              >
                <h2 className="text-lg font-semibold">STL y radiografías</h2>
                <p className="text-sm text-muted-foreground">
                  Los archivos de esta sección son compartidos. Conservamos los
                  originales; los nuevos archivos se agregan al historial.
                </p>
                {record.files.some((f) => f.kind.startsWith("STL_")) && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setPreview(!preview)}
                    >
                      {preview ? "Cerrar visor 3D" : "Ver últimos STL en 3D"}
                    </Button>
                    {preview && (
                      <StlViewer
                        upperUrl={latestStl("STL_UPPER")}
                        lowerUrl={latestStl("STL_LOWER")}
                      />
                    )}
                  </>
                )}
                <div className="flex flex-wrap gap-2">
                  {["STL_UPPER", "STL_LOWER"].map((k) => (
                    <span
                      key={k}
                      className={`rounded-full px-3 py-1 text-xs ${record.files.some((f) => f.kind === k) ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-900"}`}
                    >
                      {fileKinds[k]}:{" "}
                      {record.files.some((f) => f.kind === k)
                        ? "adjunto"
                        : "pendiente"}
                    </span>
                  ))}
                </div>
                {record.files.filter((f) => f.kind !== "PHOTO").length === 0 ? (
                  <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                    <FileBox className="mx-auto mb-2" />
                    Adjunta el primer registro del caso.
                  </div>
                ) : (
                  <ul className="divide-y rounded-xl border">
                    {record.files
                      .filter((f) => f.kind !== "PHOTO")
                      .map((f) => (
                        <li
                          key={f.id}
                          className="flex justify-between gap-3 p-4"
                        >
                          <div className="min-w-0">
                            <p className="break-all text-sm font-medium">
                              {f.name}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {fileKinds[f.kind]} ·{" "}
                              {(f.size / 1024 / 1024).toFixed(1)} MB ·{" "}
                              {f.uploadedBy === record.referrer.id
                                ? "Colega"
                                : "Especialista"}{" "}
                              ·{" "}
                              {new Date(f.createdAt).toLocaleDateString(
                                "es-CL",
                              )}
                            </p>
                          </div>
                          <a
                            className="inline-flex shrink-0 items-center gap-1 text-sm underline underline-offset-4"
                            href={`${API_URL}/referrals/${id}/files/${f.id}`}
                          >
                            <Download size={15} />
                            <span className="sr-only">Descargar </span>
                            <span>Descargar</span>
                          </a>
                        </li>
                      ))}
                  </ul>
                )}
                {active && (
                  <form
                    className="space-y-3 rounded-xl border p-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!file) return;
                      if (file.size > 60 * 1024 * 1024) {
                        setError("El archivo supera el máximo de 60 MB.");
                        return;
                      }
                      void action(async () => {
                        const data = new FormData();
                        data.append("kind", kind);
                        data.append("file", file);
                        await referralRequest(`/${id}/files`, "POST", data);
                        setFile(null);
                        setFileInputKey((k) => k + 1);
                      }, "Archivo adjuntado.");
                    }}
                  >
                    <label className="block space-y-2 text-sm">
                      Tipo de registro
                      <select
                        className="block w-full rounded-md border bg-background p-2"
                        value={kind}
                        onChange={(e) => {
                          setKind(e.target.value);
                          setFile(null);
                          setFileInputKey((k) => k + 1);
                        }}
                      >
                        {Object.entries(fileKinds)
                          .filter(([key]) => key !== "PHOTO")
                          .map(([k, label]) => (
                            <option key={k} value={k}>
                              {label}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label className="block space-y-2 text-sm">
                      Archivo (máximo 60 MB)
                      <Input
                        key={fileInputKey}
                        required
                        type="file"
                        accept={
                          kind.startsWith("STL")
                            ? ".stl"
                            : ".jpg,.jpeg,.png,.webp"
                        }
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                      />
                    </label>
                    <Button className={primaryAction} disabled={busy || !file}>
                      {busy ? "Procesando…" : "Adjuntar archivo"}
                    </Button>
                  </form>
                )}
              </section>
              <div hidden={section !== "photos"}>
                <PhotoWorkspace record={record} onRefresh={load} />
              </div>
              <section
                hidden={section !== "comments"}
                className={`${panel} space-y-4`}
              >
                <h2 className="text-lg font-semibold">
                  Comentarios y seguimiento
                </h2>
                <p className="text-sm text-muted-foreground">
                  Todo lo que escribas aquí será visible para ambas partes.
                </p>
                {record.comments.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Todavía no hay comentarios.
                  </p>
                )}
                {record.comments.map((c) => (
                  <article
                    key={c.id}
                    className="border-l-2 border-[#6469FC]/30 pl-4"
                  >
                    <div className="flex flex-wrap justify-between gap-2 text-xs">
                      <span className="font-semibold">{c.authorName}</span>
                      <time className="text-muted-foreground">
                        {new Date(c.createdAt).toLocaleString("es-CL")}
                      </time>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">
                      {c.content}
                    </p>
                  </article>
                ))}
                {active && (
                  <form
                    className="space-y-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void action(async () => {
                        await referralRequest(`/${id}/comments`, "POST", {
                          content: comment,
                        });
                        setComment("");
                      }, "Comentario publicado.");
                    }}
                  >
                    <label className="block text-sm space-y-2">
                      Nuevo comentario
                      <Textarea
                        required
                        maxLength={5000}
                        rows={3}
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        className={primaryAction}
                        disabled={busy || !comment.trim()}
                      >
                        Publicar comentario
                      </Button>
                      {admin &&
                        ["SUBMITTED", "NEEDS_INFO"].includes(record.status) && (
                          <Button
                            type="button"
                            variant="outline"
                            disabled={busy || !comment.trim()}
                            onClick={() =>
                              void action(async () => {
                                await referralRequest(
                                  `/${id}/request-info`,
                                  "POST",
                                  { content: comment },
                                );
                                setComment("");
                              }, "Solicitud de antecedentes registrada.")
                            }
                          >
                            Solicitar estos antecedentes
                          </Button>
                        )}
                    </div>
                  </form>
                )}
              </section>
            </div>
            <aside className="space-y-6">
              {record.sharedProgress && (
                <section className="space-y-2 rounded-2xl border bg-card p-5">
                  <h2 className="font-semibold">Avance compartido</h2>
                  <p className="text-sm">
                    {{
                      ACTIVE: "Tratamiento activo",
                      PAUSED: "Tratamiento en pausa",
                      FINISHED: "Tratamiento finalizado",
                    }[record.sharedProgress.status] ||
                      record.sharedProgress.status}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {record.sharedProgress.totalAligners > 0
                      ? `Alineador ${record.sharedProgress.currentAligner} de ${record.sharedProgress.totalAligners}`
                      : "Sin secuencia de alineadores iniciada"}
                  </p>
                </section>
              )}
              {admin && record.status === "SUBMITTED" && active && (
                <section className="space-y-4 rounded-xl border border-[#6469FC]/30 bg-[#6469FC]/5 p-5">
                  <h2 className="font-semibold">Revisar e incorporar</h2>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Acepta la derivación como paciente en pausa o vincúlala a
                    una ficha existente. No activa recordatorios ni órdenes.
                  </p>
                  {duplicates === null ? (
                    <Button
                      disabled={busy}
                      onClick={() =>
                        void action(async () => {
                          setDuplicates(
                            await referralRequest<Duplicate[]>(
                              `/${id}/duplicates`,
                            ),
                          );
                        })
                      }
                    >
                      Revisar coincidencias
                    </Button>
                  ) : (
                    <div className="space-y-3">
                      <label className="block space-y-2 text-sm">
                        Ficha de destino
                        <select
                          className="block w-full rounded-md border bg-background p-2"
                          value={patientId}
                          onChange={(e) => setPatientId(e.target.value)}
                        >
                          <option value="">Crear paciente nuevo</option>
                          {duplicates
                            .filter((p) => !p.deletedAt)
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.fullName} — {p.rut}
                              </option>
                            ))}
                        </select>
                      </label>
                      <p className="text-xs text-muted-foreground">
                        {duplicates.length
                          ? "Hay coincidencias de RUT o contacto. Revisa antes de aceptar."
                          : "No se encontraron coincidencias de RUT o contacto."}
                      </p>
                      {duplicates.some((p) => p.deletedAt) && (
                        <p className="text-xs text-amber-800">
                          Existe una ficha eliminada coincidente. Revisa ese
                          registro antes de continuar.
                        </p>
                      )}
                      <Button
                        disabled={busy}
                        onClick={() => {
                          if (
                            window.confirm(
                              patientId
                                ? "¿Vincular esta derivación al paciente seleccionado?"
                                : "¿Crear una ficha de paciente en pausa con estos datos?",
                            )
                          )
                            void action(async () => {
                              await referralRequest(
                                `/${id}/accept`,
                                "POST",
                                patientId ? { patientId } : {},
                              );
                            }, "Derivación aceptada. Los registros siguen disponibles en este caso.");
                        }}
                      >
                        Aceptar derivación
                      </Button>
                    </div>
                  )}
                </section>
              )}
              <section className="space-y-4 rounded-2xl border bg-card p-5">
                <h2 className="font-semibold">Setups de Titan Dental Design</h2>
                <p className="text-sm text-muted-foreground">
                  Propuestas compartidas por el especialista, con su historial
                  de versiones.
                </p>
                {record.setups.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Aún no hay un setup compartido.
                  </p>
                )}
                <SetupVersions
                  record={record}
                  admin={admin}
                  busy={busy}
                  action={action}
                />
                {admin &&
                  active &&
                  record.status === "ACCEPTED" &&
                  !["MANUFACTURING", "DELIVERED"].includes(record.stage) && (
                    <form
                      className="space-y-3 border-t pt-4"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void action(async () => {
                          await referralRequest(`/${id}/setups`, "POST", {
                            title,
                            url,
                          });
                          setTitle("");
                          setUrl("");
                        }, "Setup compartido.");
                      }}
                    >
                      <label className="block space-y-2 text-sm">
                        Nombre y versión
                        <Input
                          required
                          minLength={2}
                          maxLength={160}
                          placeholder="Setup inicial — versión 1"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                        />
                      </label>
                      <label className="block space-y-2 text-sm">
                        Enlace HTTPS
                        <Input
                          required
                          type="url"
                          maxLength={2048}
                          placeholder="https://…"
                          value={url}
                          onChange={(e) => setUrl(e.target.value)}
                        />
                      </label>
                      <Button
                        className={`${primaryAction} w-full`}
                        disabled={busy}
                      >
                        Compartir setup
                      </Button>
                    </form>
                  )}
              </section>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
