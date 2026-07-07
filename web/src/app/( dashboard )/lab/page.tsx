"use client";

import { useEffect, useState, useCallback } from "react";
import { API_URL } from "@/lib/utils";
import { LabOrder, ProductionStage } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Loader2,
  Download,
  Minus,
  Plus,
  User,
  CalendarClock,
  CheckCircle2,
  History,
  Factory,
} from "lucide-react";

// Ordered production stages shown as the stepper. Labels match the BatchEvent
// notes the API writes (see api/src/lab/lab.service.ts).
const STAGES: { value: ProductionStage; label: string }[] = [
  { value: "RECEIVED", label: "Recibida" },
  { value: "PRINTING_MODELS", label: "Impresión de modelos" },
  { value: "THERMOFORMING", label: "Termoformado" },
  { value: "TRIMMING_POLISHING", label: "Recorte y pulido" },
  { value: "PACKAGING", label: "Empaque" },
  { value: "COMPLETED", label: "Completada" },
];

const stageIndex = (stage?: ProductionStage | null) =>
  stage ? STAGES.findIndex((s) => s.value === stage) : -1;

function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function OrderCard({
  order,
  onUpdated,
}: {
  order: LabOrder;
  onUpdated: (updated: LabOrder) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [notes, setNotes] = useState(order.technicianNotes ?? "");
  const [showHistory, setShowHistory] = useState(false);

  const currentIdx = stageIndex(order.productionStage);
  const models = order.modelsPrinted ?? 0;

  const patchProduction = async (body: {
    productionStage?: ProductionStage;
    modelsPrinted?: number;
    technicianNotes?: string;
  }) => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/lab/orders/${order.id}/production`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || "No se pudo guardar el avance");
      }
      const updated: LabOrder = await res.json();
      onUpdated(updated);
      toast.success("Avance guardado");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`${API_URL}/lab/orders/${order.id}/download-url`, {
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || "No se pudo generar el enlace de descarga");
      }
      const { downloadUrl } = await res.json();
      window.open(downloadUrl, "_blank", "noopener");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDownloading(false);
    }
  };

  const setModels = (value: number) => {
    const clamped = Math.max(0, value);
    if (clamped !== models) patchProduction({ modelsPrinted: clamped });
  };

  return (
    <Card className="bg-white shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-wide text-[#6469FC]">
              {order.orderNumber}
            </p>
            <p className="font-semibold text-gray-900 flex items-center gap-1.5 mt-0.5">
              <User className="w-4 h-4 text-gray-400" />
              {order.patient.fullName}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Lote #{order.batchNumber} · {order.alignerCount} alineadores
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            {order.status === "ORDER_SENT" ? (
              <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Nueva</Badge>
            ) : (
              <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">
                En producción
              </Badge>
            )}
            {order.expectedDeliveryDate && (
              <span className="text-[11px] text-gray-500 flex items-center gap-1">
                <CalendarClock className="w-3 h-3" />
                Entrega: {formatDate(order.expectedDeliveryDate)}
              </span>
            )}
          </div>
        </div>

        {/* Stage stepper */}
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">Etapa de producción</p>
          <div className="flex flex-wrap gap-1.5">
            {STAGES.map((stage, idx) => {
              const isCurrent = idx === currentIdx;
              const isDone = idx < currentIdx;
              return (
                <button
                  key={stage.value}
                  disabled={saving || isCurrent}
                  onClick={() => patchProduction({ productionStage: stage.value })}
                  title={`Marcar: ${stage.label}`}
                  className={`text-[11px] px-2.5 py-1.5 rounded-full border font-medium transition-colors disabled:cursor-default ${
                    isCurrent
                      ? "bg-gradient-to-br from-[#A066F8] to-[#6469FC] text-white border-transparent shadow-sm"
                      : isDone
                        ? "bg-[#6469FC]/10 text-[#6469FC] border-[#6469FC]/20"
                        : "bg-white text-gray-500 border-gray-200 hover:border-[#6469FC]/50 hover:text-[#6469FC]"
                  }`}
                >
                  {isDone && <CheckCircle2 className="w-3 h-3 inline mr-1 -mt-0.5" />}
                  {stage.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Models printed counter */}
        <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2.5">
          <p className="text-sm text-gray-700 font-medium">Modelos impresos</p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 w-7 p-0"
              disabled={saving || models <= 0}
              onClick={() => setModels(models - 1)}
            >
              <Minus className="w-3.5 h-3.5" />
            </Button>
            <span className="text-sm font-semibold text-gray-900 min-w-[52px] text-center tabular-nums">
              {models} / {order.alignerCount}
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 w-7 p-0"
              disabled={saving}
              onClick={() => setModels(models + 1)}
            >
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Notes */}
        <div>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notas del técnico (materiales, incidencias, etc.)"
            className="text-sm min-h-[64px]"
          />
          {notes !== (order.technicianNotes ?? "") && (
            <Button
              size="sm"
              variant="secondary"
              className="mt-2 h-7 text-xs"
              disabled={saving}
              onClick={() => patchProduction({ technicianNotes: notes })}
            >
              Guardar notas
            </Button>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between border-t border-gray-100 pt-3">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1"
          >
            <History className="w-3.5 h-3.5" />
            {showHistory ? "Ocultar historial" : "Historial"}
          </button>
          <Button
            size="sm"
            className="h-8 text-xs"
            disabled={!order.hasFiles || downloading}
            onClick={handleDownload}
            title={order.hasFiles ? "Descargar archivos de impresión" : "Sin archivos subidos"}
          >
            {downloading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                <Download className="w-3.5 h-3.5 mr-1.5" /> Archivos (.zip)
              </>
            )}
          </Button>
        </div>

        {showHistory && (
          <div className="space-y-1.5 rounded-lg bg-gray-50/60 border border-gray-100 p-3 max-h-48 overflow-y-auto">
            {(order.batchEvents?.length ?? 0) === 0 && (
              <p className="text-xs text-gray-400">Sin eventos registrados</p>
            )}
            {order.batchEvents?.map((event) => (
              <div key={event.id} className="text-xs text-gray-600 flex gap-2">
                <span className="text-gray-400 shrink-0 tabular-nums">
                  {formatDate(event.createdAt)}
                </span>
                <span>{event.note || `${event.fromStatus ?? ""} → ${event.toStatus}`}</span>
              </div>
            ))}
          </div>
        )}

        {saving && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Loader2 className="w-3 h-3 animate-spin" /> Guardando…
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function LabPage() {
  const [active, setActive] = useState<LabOrder[]>([]);
  const [recent, setRecent] = useState<LabOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/lab/orders`, { credentials: "include" });
      if (!res.ok) throw new Error("No se pudieron cargar las órdenes");
      const data = await res.json();
      setActive(data.active ?? []);
      setRecent(data.recentlyCompleted ?? []);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleUpdated = (updated: LabOrder) => {
    setActive((prev) => prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[30px] font-extrabold tracking-tight text-[#1B1B1B] flex items-center gap-3">
            <Factory className="w-7 h-7 text-[#6469FC]" />
            Laboratorio
          </h1>
          <p className="text-[#7c7c84] text-sm mt-1">
            Órdenes de producción de alineadores — actualiza etapa, modelos impresos y notas
          </p>
        </div>
        <Badge variant="secondary" className="text-sm px-3 py-1">
          {active.length} {active.length === 1 ? "orden activa" : "órdenes activas"}
        </Badge>
      </div>

      {active.length === 0 ? (
        <div className="text-center py-16 text-sm text-gray-400 font-medium border-2 border-dashed border-gray-200 rounded-xl">
          No hay órdenes en producción
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {active.map((order) => (
            <OrderCard key={order.id} order={order} onUpdated={handleUpdated} />
          ))}
        </div>
      )}

      {recent.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            Entregadas recientemente (últimos 30 días)
          </h2>
          <div className="rounded-xl border border-gray-100 bg-white divide-y divide-gray-50">
            {recent.map((order) => (
              <div key={order.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs font-semibold text-[#6469FC] shrink-0">
                    {order.orderNumber}
                  </span>
                  <span className="text-gray-700 truncate">{order.patient.fullName}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0 text-xs text-gray-400">
                  <span>{order.alignerCount} alineadores</span>
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                    {order.status === "HANDED_TO_PATIENT" ? "Entregado a paciente" : "En clínica"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
