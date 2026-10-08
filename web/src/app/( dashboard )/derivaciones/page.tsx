"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ReferralForm } from "@/components/features/referrals/referral-form";
import {
  Colleague,
  ReferralSummary,
  referralRequest,
  referralStatus,
} from "@/lib/api/referrals.api";
import { primaryAction } from "@/components/features/referrals/referral-ui";
import { Plus, ArrowUpRight, Users, FolderOpen } from "lucide-react";

export default function ReferralsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const admin = user?.role === "ADMIN";
  const allowed = admin || user?.role === "REFERRER";
  const [cases, setCases] = useState<ReferralSummary[]>([]);
  const [colleagues, setColleagues] = useState<Colleague[]>([]);
  const [tab, setTab] = useState<"cases" | "colleagues">("cases");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [credential, setCredential] = useState<{
    email: string;
    password: string;
  } | null>(null);
  const [sharing, setSharing] = useState(false);
  const [patients, setPatients] = useState<{ id: string; fullName: string }[]>(
    [],
  );
  const [patientId, setPatientId] = useState("");
  const [referrerId, setReferrerId] = useState("");
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    if (!allowed) {
      setLoading(false);
      return;
    }
    setError("");
    try {
      const rows = await referralRequest<ReferralSummary[]>("");
      setCases(rows);
      if (admin)
        setColleagues(await referralRequest<Colleague[]>("/colleagues"));
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "No se pudieron cargar las derivaciones.",
      );
    } finally {
      setLoading(false);
    }
  }, [admin, allowed]);
  useEffect(() => {
    void load();
  }, [load]);

  async function action(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo completar la operación.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function openShare() {
    await action(async () => {
      setPatients(
        await referralRequest<{ id: string; fullName: string }[]>(
          "/shareable-patients",
        ),
      );
      setPatientId(
        new URLSearchParams(window.location.search).get("patientId") || "",
      );
      setSharing(true);
    });
  }

  if (!allowed)
    return (
      <p>
        Esta sección está disponible para administradores y colegas derivadores.
      </p>
    );
  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-5 rounded-2xl border bg-card p-6 sm:p-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {admin ? "Derivaciones" : "Mis derivaciones"}
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            {admin
              ? "Revisa los nuevos casos y comparte avances con tus colegas."
              : "Envía los registros de tus pacientes y sigue cada caso con el especialista."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {admin ? (
            <Button
              className={primaryAction}
              disabled={busy}
              onClick={() => void openShare()}
            >
              Compartir paciente existente
            </Button>
          ) : (
            <Button
              className={primaryAction}
              onClick={() => setCreating(!creating)}
            >
              <Plus size={16} />
              Nueva derivación
            </Button>
          )}
          <Link
            className="self-center rounded-lg px-3 py-2 text-sm text-foreground/65 underline underline-offset-4"
            href="/cambiar-clave"
          >
            Cambiar contraseña
          </Link>
        </div>
      </header>
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {error}{" "}
          <button className="underline" onClick={() => void load()}>
            Actualizar
          </button>
        </div>
      )}
      {credential && (
        <section className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-5 text-amber-950">
          <h2 className="font-semibold">
            Credencial inicial para {credential.email}
          </h2>
          <p className="text-sm">
            Se muestra una sola vez. Entrégala personalmente por un canal
            privado. El colega deberá cambiarla al entrar.
          </p>
          <code className="block break-all select-all rounded bg-white p-3 text-base">
            {credential.password}
          </code>
          <p className="text-sm">
            Autoriza también este correo en Cloudflare Access antes de que
            intente ingresar.
          </p>
          <Button variant="outline" onClick={() => setCredential(null)}>
            Ya guardé la credencial
          </Button>
        </section>
      )}
      {creating && (
        <section className="space-y-5 rounded-xl border bg-card p-6">
          <div className="flex justify-between">
            <h2 className="text-xl font-semibold">Nueva derivación</h2>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              Cerrar
            </Button>
          </div>
          <ReferralForm
            busy={busy}
            onSave={(data) =>
              action(async () => {
                const record = await referralRequest<{ id: string }>(
                  "",
                  "POST",
                  data,
                );
                router.push(`/derivaciones/${record.id}`);
              })
            }
          />
        </section>
      )}
      {sharing && (
        <section className="space-y-5 rounded-xl border bg-card p-6">
          <div className="flex justify-between">
            <h2 className="text-xl font-semibold">Compartir paciente</h2>
            <Button variant="ghost" onClick={() => setSharing(false)}>
              Cerrar
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Compartirás nombre, RUT, correo, teléfono y el resumen que escribas
            aquí. La ficha clínica, notas internas y archivos previos permanecen
            privados; adjunta al caso solo lo que quieras compartir.
          </p>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void action(async () => {
                const row = await referralRequest<{ id: string }>(
                  "/share",
                  "POST",
                  { patientId, referrerId, reason },
                );
                router.push(`/derivaciones/${row.id}`);
              });
            }}
          >
            <label className="block text-sm space-y-2">
              Paciente
              <select
                required
                className="block w-full rounded-md border bg-background p-2"
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
              >
                <option value="">Selecciona un paciente</option>
                {patients.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.fullName}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm space-y-2">
              Colega
              <select
                required
                className="block w-full rounded-md border bg-background p-2"
                value={referrerId}
                onChange={(e) => setReferrerId(e.target.value)}
              >
                <option value="">Selecciona un colega</option>
                {colleagues
                  .filter((c) => !c.disabledAt)
                  .map((c) => (
                    <option value={c.id} key={c.id}>
                      {c.name} ({c.email})
                    </option>
                  ))}
              </select>
            </label>
            <label className="block text-sm space-y-2">
              Resumen visible para el colega
              <Textarea
                required
                minLength={5}
                maxLength={5000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <Button className={primaryAction} disabled={busy}>
              Compartir caso
            </Button>
          </form>
        </section>
      )}
      {admin && (
        <nav
          className="inline-flex gap-2 rounded-2xl border bg-card p-2"
          aria-label="Secciones de derivaciones"
        >
          {(
            [
              { key: "cases", label: "Casos", icon: FolderOpen },
              { key: "colleagues", label: "Colegas", icon: Users },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              aria-current={tab === t.key ? "page" : undefined}
              className={`flex min-h-11 items-center gap-2 rounded-xl px-6 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-primary ${tab === t.key ? "bg-brand-blue-strong text-white" : "text-foreground/65 hover:bg-secondary"}`}
            >
              <t.icon size={17} />
              {t.label}
            </button>
          ))}
        </nav>
      )}
      {tab === "cases" ? (
        <section className="space-y-4">
          <label className="block max-w-md text-sm space-y-2">
            Buscar por paciente o colega
            <Input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Nombre del paciente o colega"
            />
          </label>
          {loading ? (
            <p role="status">Cargando derivaciones…</p>
          ) : cases.length === 0 ? (
            <div className="rounded-2xl border bg-card px-6 py-12 text-center">
              <FolderOpen className="mx-auto mb-4 h-12 w-12 rounded-xl bg-secondary p-3 text-primary" />
              <h2 className="font-medium">Todavía no hay derivaciones</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {admin
                  ? "Crea una cuenta en Colegas para recibir el primer caso."
                  : "Crea una derivación, guarda los datos y adjunta los STL superior e inferior."}
              </p>
            </div>
          ) : (
            <div className="divide-y rounded-xl border bg-card">
              {cases
                .filter((c) =>
                  `${c.fullName} ${c.referrer.name} ${c.referrer.email}`
                    .toLowerCase()
                    .includes(filter.toLowerCase()),
                )
                .map((c) => (
                  <Link
                    href={`/derivaciones/${c.id}`}
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-4 p-5 transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-[#6469FC]"
                  >
                    <div className="min-w-0">
                      <h2 className="font-semibold">{c.fullName}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {admin && `${c.referrer.name || c.referrer.email} · `}
                        {c._count.files} archivos · {c._count.comments}{" "}
                        comentarios
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${c.revokedAt ? "bg-red-50 text-red-800" : c.status === "SUBMITTED" ? "bg-indigo-50 text-indigo-800" : "bg-muted"}`}
                      >
                        {c.revokedAt
                          ? "Acceso revocado"
                          : referralStatus[c.status]}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-lg bg-secondary px-3 py-2 text-xs font-semibold text-primary">
                        Abrir caso <ArrowUpRight size={15} />
                      </span>
                    </div>
                  </Link>
                ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Se muestran hasta 200 casos, ordenados por actividad reciente.
          </p>
        </section>
      ) : (
        <section className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold">Invitar a un colega</h2>
            <p className="mt-1 text-sm text-foreground/65">
              Crea su acceso personal para recibir pacientes y compartir los
              avances.
            </p>
          </div>
          <form
            className="grid items-end gap-4 rounded-xl border bg-card p-5 sm:grid-cols-[1fr_1fr_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              void action(async () => {
                const created = await referralRequest<
                  Colleague & { temporaryPassword: string }
                >("/colleagues", "POST", { name, email });
                setCredential({
                  email: created.email,
                  password: created.temporaryPassword,
                });
                setName("");
                setEmail("");
                await load();
              });
            }}
          >
            <label className="space-y-2 text-sm">
              Nombre del colega
              <Input
                required
                minLength={2}
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="space-y-2 text-sm">
              Correo personal
              <Input
                required
                type="email"
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <Button className={primaryAction} disabled={busy}>
              <Plus size={17} />
              Crear cuenta
            </Button>
          </form>
          <p className="text-sm text-muted-foreground">
            Cada colega tiene su propia cuenta y solo puede consultar sus casos.
            Deshabilitar la cuenta cierra su acceso en la siguiente solicitud.
          </p>
          <div className="divide-y rounded-xl border">
            {colleagues.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 p-5"
              >
                <div>
                  <h3 className="font-medium">{c.name}</h3>
                  <p className="text-sm text-muted-foreground">{c.email}</p>
                  <p className="mt-1 text-xs">
                    {c.disabledAt
                      ? "Deshabilitada"
                      : c.mustChangePassword
                        ? "Pendiente de cambiar contraseña"
                        : "Habilitada"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          `¿${c.disabledAt ? "Habilitar" : "Deshabilitar"} el acceso de ${c.name}?`,
                        )
                      )
                        void action(async () => {
                          await referralRequest(
                            `/colleagues/${c.id}/access`,
                            "PATCH",
                            { enabled: !!c.disabledAt },
                          );
                          await load();
                        });
                    }}
                  >
                    {c.disabledAt ? "Habilitar" : "Deshabilitar"}
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          `¿Reemplazar la contraseña de ${c.name} y cerrar sus sesiones?`,
                        )
                      )
                        void action(async () => {
                          const result = await referralRequest<{
                            temporaryPassword: string;
                          }>(`/colleagues/${c.id}/reset-password`, "POST");
                          setCredential({
                            email: c.email,
                            password: result.temporaryPassword,
                          });
                          await load();
                        });
                    }}
                  >
                    Restablecer contraseña
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
