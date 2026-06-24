"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DentalinkApi, type RosterPatient } from "@/lib/api/dentalink.api";

interface ManageDentalinkPatientsDialogProps {
  /** Called after the roster changes so the parent can refresh the controles list. */
  onChanged: () => void;
}

export function ManageDentalinkPatientsDialog({
  onChanged,
}: ManageDentalinkPatientsDialogProps) {
  const [open, setOpen] = useState(false);
  const [roster, setRoster] = useState<RosterPatient[]>([]);
  const [loading, setLoading] = useState(false);
  const [id, setId] = useState("");
  const [nombre, setNombre] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const loadRoster = useCallback(() => {
    setLoading(true);
    DentalinkApi.listPatients()
      .then(setRoster)
      .catch(() => toast.error("No se pudo cargar la lista de pacientes"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (open) loadRoster();
  }, [open, loadRoster]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedId = Number(id.trim());
    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      toast.warning("ID inválido", {
        description: "Ingresa el ID numérico del paciente en Dentalink.",
      });
      return;
    }
    setSubmitting(true);
    try {
      const added = await DentalinkApi.addPatient({
        id: parsedId,
        nombre: nombre.trim() || undefined,
      });
      toast.success("Paciente agregado", { description: added.nombre });
      setId("");
      setNombre("");
      loadRoster();
      onChanged();
    } catch (err) {
      toast.error("No se pudo agregar", {
        description: err instanceof Error ? err.message : "Error desconocido",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (patient: RosterPatient) => {
    if (
      !window.confirm(
        `¿Quitar a ${patient.nombre} de la lista de controles de Dentalink?`,
      )
    )
      return;
    setRemovingId(patient.id);
    try {
      await DentalinkApi.removePatient(patient.id);
      toast.success("Paciente eliminado");
      loadRoster();
      onChanged();
    } catch {
      toast.error("No se pudo eliminar el paciente");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          className="gap-2 rounded-lg bg-gradient-to-br from-[#A066F8] to-[#6469FC] px-4 text-[13px] font-bold text-white shadow-[0_8px_22px_rgba(100,105,252,0.32)] hover:brightness-105 hover:shadow-[0_10px_26px_rgba(100,105,252,0.45)]"
          size="sm"
        >
          <UserPlus className="w-4 h-4" strokeWidth={2.4} />
          Agregar paciente
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#1B1B1B]">Pacientes de Dentalink</DialogTitle>
          <DialogDescription>
            Agrega pacientes por su <span className="font-semibold">ID de Dentalink</span>.
            El nombre se completa automáticamente desde Dentalink.
          </DialogDescription>
        </DialogHeader>

        {/* Add form */}
        <form
          onSubmit={handleAdd}
          className="rounded-xl border border-gray-100 bg-gray-50/60 p-4 space-y-3"
        >
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-1">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                ID
              </label>
              <Input
                value={id}
                onChange={(e) => setId(e.target.value)}
                inputMode="numeric"
                placeholder="1416"
                className="mt-1 bg-white"
                autoFocus
              />
            </div>
            <div className="col-span-2">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                Nombre (opcional)
              </label>
              <Input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Se completa automáticamente"
                className="mt-1 bg-white"
              />
            </div>
          </div>
          <Button
            type="submit"
            disabled={submitting}
            className="w-full gap-2 rounded-lg bg-gradient-to-br from-[#A066F8] to-[#6469FC] font-bold text-white shadow-[0_8px_22px_rgba(100,105,252,0.32)] hover:brightness-105 disabled:opacity-60"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" strokeWidth={2.4} />
            )}
            Agregar a controles
          </Button>
        </form>

        {/* Current roster */}
        <div>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
            Sincronizados {roster.length > 0 && `(${roster.length})`}
          </p>
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-gray-400 py-4 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
              Cargando…
            </div>
          ) : roster.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">
              Aún no hay pacientes sincronizados.
            </p>
          ) : (
            <div className="max-h-60 overflow-y-auto rounded-xl border border-gray-100 divide-y divide-gray-50">
              {roster.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {p.nombre}
                    </p>
                    <p className="text-[11px] text-gray-400">ID {p.id}</p>
                  </div>
                  <button
                    onClick={() => handleRemove(p)}
                    disabled={removingId === p.id}
                    title="Quitar"
                    className="shrink-0 grid place-items-center w-8 h-8 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50"
                  >
                    {removingId === p.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
