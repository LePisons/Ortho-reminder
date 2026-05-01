"use client";

import { useState } from "react";
import { Patient } from "@/lib/types";
import { API_URL } from "@/lib/utils";
import { toast } from "sonner";
import { Settings2, X, ChevronDown } from "lucide-react";

const PIPELINE_STAGES = [
  { value: "REQUIRED_FILES", label: "Archivos Requeridos", color: "bg-orange-100 text-orange-800" },
  { value: "IN_PRODUCTION", label: "En Producción", color: "bg-blue-100 text-blue-800" },
  { value: "READY_FOR_PICKUP", label: "Listo para Entrega", color: "bg-purple-100 text-purple-800" },
  { value: "IN_TREATMENT", label: "En Tratamiento", color: "bg-green-100 text-green-800" },
  { value: "ENDING_SOON", label: "Finalizando Pronto", color: "bg-amber-100 text-amber-800" },
  { value: "REEVALUATION", label: "Reevaluación", color: "bg-rose-100 text-rose-800" },
] as const;

interface PipelineStageSelectorProps {
  patient: Patient;
  onUpdate: () => void;
}

export function PipelineStageSelector({ patient, onUpdate }: PipelineStageSelectorProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const currentStage = PIPELINE_STAGES.find((s) => s.value === patient.pipelineStage);
  const isManual = patient.pipelineIsManual;

  const handleSelect = async (stage: string | null) => {
    setSaving(true);
    setOpen(false);
    try {
      const res = await fetch(`${API_URL}/patients/${patient.id}/pipeline-override`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ stage }),
      });
      if (!res.ok) throw new Error("Error al actualizar el pipeline");
      toast.success(stage ? `Pipeline movido a "${PIPELINE_STAGES.find(s => s.value === stage)?.label}"` : "Stage automático restaurado");
      onUpdate();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-1.5">
        {/* Current stage badge */}
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
            currentStage?.color ?? "bg-gray-100 text-gray-600"
          }`}
        >
          {currentStage?.label ?? "Sin stage"}
          {isManual && (
            <span className="bg-white/60 text-current px-1 rounded text-[10px] font-bold uppercase tracking-wide">
              MANUAL
            </span>
          )}
        </span>

        {/* Clear manual override button */}
        {isManual && (
          <button
            onClick={() => handleSelect(null)}
            disabled={saving}
            className="w-5 h-5 rounded-full flex items-center justify-center text-gray-400 hover:text-rose-500 hover:bg-rose-50 transition-all"
            title="Restaurar stage automático"
          >
            <X className="w-3 h-3" />
          </button>
        )}

        {/* Override picker trigger */}
        <button
          onClick={() => setOpen((o) => !o)}
          disabled={saving}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 border border-gray-200 hover:border-gray-300 rounded-lg px-2 py-1 transition-all"
          title="Mover manualmente en el pipeline"
        >
          <Settings2 className="w-3 h-3" />
          <span>Mover</span>
          <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* Dropdown */}
      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1.5 z-50 bg-white border border-gray-200 rounded-xl shadow-lg py-1.5 min-w-[210px]">
            <p className="px-3 py-1 text-[10px] font-bold uppercase text-gray-400 tracking-wider">
              Mover a stage
            </p>
            {PIPELINE_STAGES.map((stage) => (
              <button
                key={stage.value}
                onClick={() => handleSelect(stage.value)}
                className={`w-full text-left flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                  patient.pipelineStage === stage.value ? "font-semibold" : ""
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${stage.color.split(" ")[0].replace("bg-", "bg-")}`} />
                {stage.label}
                {patient.pipelineStage === stage.value && (
                  <span className="ml-auto text-[10px] text-gray-400">actual</span>
                )}
              </button>
            ))}
            {isManual && (
              <>
                <div className="my-1.5 border-t border-gray-100" />
                <button
                  onClick={() => handleSelect(null)}
                  className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-rose-500 hover:bg-rose-50 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  Restaurar automático
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
