"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Stethoscope, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DentalinkApi,
  type Clinic,
  type ControlSummary,
  type DentalinkCita,
} from "@/lib/api/dentalink.api";
import type { Patient } from "@/lib/types";

function fmtCita(c: DentalinkCita | null | undefined): string {
  if (!c?.fecha) return "Sin cita registrada";
  const hora = c.hora_inicio ? ` ${c.hora_inicio.slice(0, 5)}` : "";
  const estado = c.estado_cita ? ` (${c.estado_cita})` : "";
  return `${c.fecha}${hora}${estado}`;
}

function diasBadge(dias: number | null) {
  if (dias === null)
    return { label: "Sin próximo", color: "bg-gray-100 text-gray-500 border-gray-200" };
  if (dias <= 7)
    return {
      label: `${dias} día${dias === 1 ? "" : "s"}`,
      color: "bg-amber-100 text-amber-700 border-amber-200",
    };
  return {
    label: `${dias} días`,
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };
}

interface PatientControlesCardProps {
  patient: Patient;
  /** Apply a shallow patch to the patient in place (no full refetch). */
  onPatch: (patch: Partial<Patient>) => void;
}

export function PatientControlesCard({ patient, onPatch }: PatientControlesCardProps) {
  const dentalinkId = patient.dentalinkId ?? null;
  const dentalinkClinic = patient.dentalinkClinic ?? null;

  const [summary, setSummary] = useState<ControlSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Link dialog state
  const [linkOpen, setLinkOpen] = useState(false);
  const [idInput, setIdInput] = useState("");
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [clinicInput, setClinicInput] = useState("");
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  const loadSummary = useCallback(async (id: number, clinic: string | null) => {
    setLoading(true);
    setError(null);
    try {
      setSummary(await DentalinkApi.getPatientSummary(id, clinic ?? undefined));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar los controles");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (dentalinkId) loadSummary(dentalinkId, dentalinkClinic);
    else setSummary(null);
  }, [dentalinkId, dentalinkClinic, loadSummary]);

  // Load the clinic options lazily, only when the link dialog opens.
  useEffect(() => {
    if (!linkOpen || clinics.length > 0) return;
    DentalinkApi.listClinics()
      .then((list) => {
        setClinics(list);
        setClinicInput(
          (cur) => cur || (list.find((c) => c.available) ?? list[0])?.key || "",
        );
      })
      .catch(() => {
        /* selector simply won't render; link still defaults server-side */
      });
  }, [linkOpen, clinics.length]);

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedId = Number(idInput.trim());
    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      toast.warning("ID inválido", {
        description: "Ingresa el ID numérico del paciente en Dentalink.",
      });
      return;
    }
    setLinking(true);
    try {
      // linkPatient returns the warm summary — render it immediately and patch
      // the patient in place (no full refetch, no image re-signing).
      const clinic = clinicInput || undefined;
      const linked = await DentalinkApi.linkPatient({
        patientId: patient.id,
        dentalinkId: parsedId,
        clinic,
      });
      setSummary(linked);
      onPatch({ dentalinkId: parsedId, dentalinkClinic: clinic ?? null });
      toast.success("Paciente agregado a controles");
      setLinkOpen(false);
      setIdInput("");
    } catch (err) {
      toast.error("No se pudo vincular", {
        description: err instanceof Error ? err.message : "Error desconocido",
      });
    } finally {
      setLinking(false);
    }
  };

  const handleUnlink = async () => {
    if (
      !window.confirm(
        "¿Quitar a este paciente de controles? Su historial dejará de mostrarse aquí.",
      )
    )
      return;
    setUnlinking(true);
    try {
      await DentalinkApi.unlinkPatient(patient.id);
      setSummary(null);
      onPatch({ dentalinkId: null, dentalinkClinic: null });
      toast.success("Paciente desvinculado de controles");
    } catch {
      toast.error("No se pudo desvincular");
    } finally {
      setUnlinking(false);
    }
  };

  // ── Not linked: show the add button ──────────────────────────────────────
  if (!dentalinkId) {
    return (
      <>
        <div className="bg-white rounded-xl shadow-sm border px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
              <Stethoscope className="w-4 h-4 text-violet-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Controles</p>
              <p className="text-xs text-gray-500">
                Vincula este paciente con Dentalink para ver su historial clínico.
              </p>
            </div>
          </div>
          <Button
            onClick={() => setLinkOpen(true)}
            size="sm"
            className="gap-2 rounded-lg bg-gradient-to-br from-[#A066F8] to-[#6469FC] px-4 text-[13px] font-bold text-white shadow-[0_8px_22px_rgba(100,105,252,0.32)] hover:brightness-105"
          >
            <Plus className="w-4 h-4" strokeWidth={2.4} />
            Agregar a controles
          </Button>
        </div>

        <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Agregar a controles</DialogTitle>
              <DialogDescription>
                Ingresa el <span className="font-semibold">ID de Dentalink</span> de este
                paciente. El nombre se completa automáticamente.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleLink} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                  ID de Dentalink
                </label>
                <Input
                  value={idInput}
                  onChange={(e) => setIdInput(e.target.value)}
                  inputMode="numeric"
                  placeholder="1416"
                  className="mt-1"
                  autoFocus
                />
              </div>
              {clinics.length > 1 && (
                <div>
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                    Clínica
                  </label>
                  <select
                    value={clinicInput}
                    onChange={(e) => setClinicInput(e.target.value)}
                    className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6469FC]/30 focus:border-[#6469FC]"
                  >
                    {clinics.map((c) => (
                      <option key={c.key} value={c.key} disabled={!c.available}>
                        {c.nombre}
                        {c.available ? "" : " (sin token)"}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={linking}
                  className="gap-2 bg-gradient-to-br from-[#A066F8] to-[#6469FC] font-bold text-white"
                >
                  {linking ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" strokeWidth={2.4} />
                  )}
                  Agregar
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // ── Linked: show the last two clinical histories ─────────────────────────
  const badge = summary ? diasBadge(summary.diasRestantes) : null;
  const showConRegistro =
    summary?.ultimoControlConRegistro &&
    summary.ultimoControlConRegistro.id !== summary.ultimoControl?.id;

  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-gray-100">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
            <Stethoscope className="w-4 h-4 text-violet-500" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">Controles</p>
            <p className="text-xs text-gray-500 truncate">
              Próximo: {summary ? fmtCita(summary.proximoControl) : "—"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {badge && (
            <Badge variant="outline" className={`text-[10px] ${badge.color}`}>
              {badge.label}
            </Badge>
          )}
          <button
            onClick={handleUnlink}
            disabled={unlinking}
            title="Quitar de controles"
            className="grid place-items-center w-8 h-8 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50"
          >
            {unlinking ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Unlink className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      <div className="p-5">
        {loading && !summary ? (
          <div className="flex items-center gap-2 text-xs text-gray-400 py-4 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" />
            Cargando controles…
          </div>
        ) : error ? (
          <p className="text-sm text-rose-600">{error}</p>
        ) : summary ? (
          <div className="space-y-3">
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                Último control
              </p>
              <p className="text-sm text-gray-700">{fmtCita(summary.ultimoControl)}</p>
              <p className="text-sm text-gray-600 mt-1.5 whitespace-pre-wrap leading-relaxed bg-gray-50 rounded-lg p-3 border border-gray-100">
                {summary.resumenUltimo || (
                  <span className="text-gray-400 italic">Sin registro de evolución</span>
                )}
              </p>
            </div>

            {showConRegistro && (
              <div>
                <p className="text-[11px] font-bold text-violet-400 uppercase tracking-wider mb-1">
                  Último control con registro
                </p>
                <p className="text-sm text-gray-700">
                  {fmtCita(summary.ultimoControlConRegistro)}
                </p>
                <p className="text-sm text-gray-600 mt-1.5 whitespace-pre-wrap leading-relaxed bg-violet-50/50 rounded-lg p-3 border border-violet-100">
                  {summary.resumenUltimoConRegistro}
                </p>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
