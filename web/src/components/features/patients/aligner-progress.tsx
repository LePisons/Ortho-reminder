"use client";

import { Patient } from "@/lib/types";
import { format, addDays } from "date-fns";
import { Calendar, Clock, AlertCircle, CheckCircle2, Minus, Plus, Pencil, UserCheck, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { API_URL } from "@/lib/utils";
import { toast } from "sonner";
import { useState } from "react";

interface AlignerProgressProps {
  patient: Patient;
  onUpdate: () => void;
}

// ─── Small inline modal ───────────────────────────────────────────────────────
interface StartTreatmentModalProps {
  patient: Patient;
  onClose: () => void;
  onSave: () => void;
}

function StartTreatmentModal({ patient, onClose, onSave }: StartTreatmentModalProps) {
  const today = format(new Date(), "yyyy-MM-dd");
  const [startingAligner, setStartingAligner] = useState(
    patient.currentAligner && patient.currentAligner > 0 ? patient.currentAligner : 1
  );
  const [startDate, setStartDate] = useState(today);
  const [wearDays, setWearDays] = useState(patient.wearDaysPerAligner ?? 14);
  const [totalAligners, setTotalAligners] = useState(patient.totalAligners ?? 0);
  const [saving, setSaving] = useState(false);

  const isReinit = !!patient.trackingStartedAt;

  const handleSave = async () => {
    if (!startDate) { toast.error("Seleccioná una fecha de inicio"); return; }
    if (startingAligner < 1) { toast.error("El alineador inicial debe ser ≥ 1"); return; }
    setSaving(true);
    try {
      const body: Record<string, unknown> = { startingAligner, startDate };
      if (wearDays !== patient.wearDaysPerAligner) body.wearDaysPerAligner = wearDays;
      if (totalAligners !== patient.totalAligners && totalAligners > 0) body.totalAligners = totalAligners;

      const res = await fetch(`${API_URL}/patients/${patient.id}/start-treatment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Error al iniciar tratamiento");
      toast.success(isReinit ? "Tracking actualizado correctamente" : "¡Tratamiento iniciado!");
      onSave();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl border p-6 w-full max-w-md mx-4 space-y-5">
        <div>
          <h3 className="text-lg font-bold text-gray-900">
            {isReinit ? "Corregir Tracking" : "Iniciar Tratamiento"}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {isReinit
              ? "Actualiza el alineador actual y la fecha de inicio para sincronizar el tracking."
              : "Especificá en qué alineador comienza el paciente y la fecha de inicio."}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase">Fecha de Inicio del Tratamiento</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase">Alineador Inicial</label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setStartingAligner(Math.max(1, startingAligner - 1))}
                className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <input
                type="number"
                min={1}
                max={totalAligners || 999}
                value={startingAligner}
                onChange={(e) => setStartingAligner(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-16 text-center border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <button
                onClick={() => setStartingAligner(Math.min(totalAligners || 999, startingAligner + 1))}
                className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase">Días por Alineador</label>
            <input
              type="number"
              min={1}
              max={30}
              value={wearDays}
              onChange={(e) => setWearDays(parseInt(e.target.value) || 14)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <div className="col-span-2 space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase">Total de Alineadores</label>
            <input
              type="number"
              min={0}
              value={totalAligners}
              onChange={(e) => setTotalAligners(parseInt(e.target.value) || 0)}
              placeholder="Sin cambios"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <p className="text-xs text-gray-400">Dejá en 0 para no modificar el total actual.</p>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-primary hover:bg-primary/90 font-semibold"
          >
            {saving ? "Guardando..." : isReinit ? "Actualizar Tracking" : "Iniciar Tratamiento"}
          </Button>
          <Button variant="outline" onClick={onClose} disabled={saving} className="px-5">
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function AlignerProgress({ patient, onUpdate }: AlignerProgressProps) {
  const { totalAligners = 0, currentAligner = 1, wearDaysPerAligner = 14, urgencyStatus, trackingStartedAt } = patient;
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState(false);
  const [appointmentDateInput, setAppointmentDateInput] = useState("");
  const [showStartModal, setShowStartModal] = useState(false);

  if (totalAligners === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border p-6 flex items-center justify-center text-center h-32">
        <div className="text-gray-400 font-medium flex flex-col items-center gap-2">
          <AlertCircle className="w-6 h-6" />
          Treatment plan not configured
        </div>
      </div>
    );
  }

  const handleAdjustAligner = async (newNumber: number) => {
    if (newNumber < 1 || newNumber > totalAligners) return;
    setIsAdjusting(true);
    try {
      const response = await fetch(`${API_URL}/patients/${patient.id}/adjust-aligner`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ alignerNumber: newNumber }),
      });
      if (!response.ok) throw new Error("Failed to adjust aligner");
      toast.success(`Alineador actualizado a #${newNumber}`);
      onUpdate();
    } catch (e) {
      toast.error("Error al ajustar el alineador");
      console.error(e);
    } finally {
      setIsAdjusting(false);
    }
  };

  const handleSetLastAppointment = async () => {
    if (!appointmentDateInput) return;
    try {
      const response = await fetch(`${API_URL}/patients/${patient.id}/last-appointment`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ date: appointmentDateInput }),
      });
      if (!response.ok) throw new Error("Failed to set last appointment");
      toast.success("Última cita actualizada");
      setEditingAppointment(false);
      onUpdate();
    } catch (e) {
      toast.error("Error al actualizar la cita");
      console.error(e);
    }
  };

  if (!trackingStartedAt) {
    return (
      <>
        {showStartModal && (
          <StartTreatmentModal patient={patient} onClose={() => setShowStartModal(false)} onSave={onUpdate} />
        )}
        <div className="bg-white rounded-xl border-2 border-dashed border-gray-200 p-8 flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-2">
            <Calendar className="w-8 h-8 text-blue-500" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Tracking no iniciado</h3>
            <p className="text-gray-500 max-w-sm mx-auto mb-6 text-sm">
              El tracking inicia automáticamente cuando el paciente escanea su QR. También podés iniciarlo manualmente especificando el alineador y la fecha.
            </p>
          </div>
          <Button
            onClick={() => setShowStartModal(true)}
            className="bg-blue-600 hover:bg-blue-700 font-semibold px-8"
          >
            Iniciar Tratamiento
          </Button>
        </div>
      </>
    );
  }

  const today = new Date();

  const alignersRemaining = Math.max(0, totalAligners - currentAligner + 1);
  const daysRemaining = alignersRemaining * wearDaysPerAligner;
  const predictedEnd = addDays(today, daysRemaining);

  const lastApptDate = patient.lastAppointmentDate ? new Date(patient.lastAppointmentDate) : null;
  const appointmentIntervalDays = wearDaysPerAligner * 2;
  const nextAppointmentEstimate = lastApptDate
    ? addDays(lastApptDate, appointmentIntervalDays)
    : addDays(today, appointmentIntervalDays);

  const getUrgencyBadge = () => {
    switch (urgencyStatus) {
      case "ENDING_SOON":
        return <span className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-xs font-bold tracking-wide">ENDING SOON</span>;
      case "OVERDUE":
        return <span className="bg-rose-100 text-rose-800 px-3 py-1 rounded-full text-xs font-bold tracking-wide">OVERDUE</span>;
      case "AWAITING_REEVALUATION":
        return <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-xs font-bold tracking-wide">AWAITING REEVALUATION</span>;
      case "ON_TRACK":
      default:
        return <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-xs font-bold tracking-wide">ON TRACK</span>;
    }
  };

  const currentPercent = Math.min(100, Math.round((currentAligner / totalAligners) * 100));

  return (
    <>
      {showStartModal && (
        <StartTreatmentModal patient={patient} onClose={() => setShowStartModal(false)} onSave={onUpdate} />
      )}

      <div className="bg-white rounded-xl shadow-sm border p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-primary" />
            Aligner Progress
          </h3>
          <div className="flex items-center gap-2">
            {getUrgencyBadge()}
            <button
              onClick={() => setShowStartModal(true)}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 border border-gray-200 hover:border-gray-300 rounded-lg px-2.5 py-1 transition-all"
              title="Corregir alineador y fecha de inicio del tracking"
            >
              <RefreshCw className="w-3 h-3" />
              Corregir tracking
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 rounded-lg p-4">
          {/* Current Step with +/- controls */}
          <div>
            <p className="text-xs text-gray-500 uppercase font-semibold">Current Step</p>
            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={() => handleAdjustAligner(currentAligner - 1)}
                disabled={isAdjusting || currentAligner <= 1}
                className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:border-gray-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="Retroceder alineador"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <p className="text-xl font-bold text-gray-900">{currentAligner} <span className="text-sm font-medium text-gray-500">of {totalAligners}</span></p>
              <button
                onClick={() => handleAdjustAligner(currentAligner + 1)}
                disabled={isAdjusting || currentAligner >= totalAligners}
                className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:border-gray-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="Avanzar alineador"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase font-semibold">Wear Time</p>
            <p className="text-xl font-bold text-gray-900">{wearDaysPerAligner} <span className="text-sm font-medium text-gray-500">days/pair</span></p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase font-semibold flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Predicted End</p>
            <p className="text-xl font-bold text-gray-900">{format(predictedEnd, "MMM d, yyyy")}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase font-semibold flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Time Remaining</p>
            <p className="text-xl font-bold text-gray-900">{daysRemaining} <span className="text-sm font-medium text-gray-500">days</span></p>
          </div>
        </div>

        {/* Last Appointment & Next Appointment Estimate */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 rounded-lg p-4 border border-slate-100">
          <div>
            <p className="text-xs text-gray-500 uppercase font-semibold flex items-center gap-1 mb-1">
              <UserCheck className="w-3.5 h-3.5" /> Última Cita
            </p>
            {editingAppointment ? (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={appointmentDateInput}
                  onChange={(e) => setAppointmentDateInput(e.target.value)}
                  className="text-sm border rounded-md px-2 py-1 bg-white"
                />
                <button
                  onClick={handleSetLastAppointment}
                  className="text-xs bg-primary text-white px-3 py-1 rounded-md hover:bg-primary/90 transition-colors"
                >
                  Guardar
                </button>
                <button
                  onClick={() => setEditingAppointment(false)}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-lg font-bold text-gray-900">
                  {lastApptDate ? format(lastApptDate, "MMM d, yyyy") : "Sin registro"}
                </p>
                <button
                  onClick={() => {
                    setAppointmentDateInput(lastApptDate ? format(lastApptDate, "yyyy-MM-dd") : format(today, "yyyy-MM-dd"));
                    setEditingAppointment(true);
                  }}
                  className="w-6 h-6 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-all"
                  title="Editar fecha de última cita"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase font-semibold flex items-center gap-1 mb-1">
              <Calendar className="w-3.5 h-3.5" /> Próxima Cita Estimada
            </p>
            <p className="text-lg font-bold text-gray-900">
              {format(nextAppointmentEstimate, "MMM d, yyyy")}
            </p>
            <p className="text-xs text-gray-400">Auto-calculada según progreso</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs font-bold text-gray-400">
            <span>Start</span>
            <span>{currentPercent}% Complete</span>
            <span>Finish</span>
          </div>
          <div className="h-4 bg-gray-100 rounded-full overflow-hidden flex">
            <div
              className="h-full bg-primary transition-all duration-1000 ease-out"
              style={{ width: `${currentPercent}%` }}
            />
          </div>
        </div>
      </div>
    </>
  );
}
