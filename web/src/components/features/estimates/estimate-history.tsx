"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  EstimatesApi,
  type EstimateData,
  type EstimateStatus,
  type EstimateSummary,
} from "@/lib/api/estimates.api";
import { formatClp } from "./pdf/build-estimate-pdf";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Copy, Download, Link2, Trash2 } from "lucide-react";

const STATUS_LABELS: Record<EstimateStatus, string> = {
  DRAFT: "Borrador",
  SENT: "Enviado",
  ACCEPTED: "Aceptado",
  REJECTED: "Rechazado",
  EXPIRED: "Vencido",
};

const STATUS_STYLES: Record<EstimateStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-600 border-slate-200",
  SENT: "bg-blue-50 text-blue-700 border-blue-200",
  ACCEPTED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  REJECTED: "bg-red-50 text-red-600 border-red-200",
  EXPIRED: "bg-amber-50 text-amber-700 border-amber-200",
};

export function EstimateHistory({
  onDuplicate,
  refreshKey,
}: {
  onDuplicate: (data: EstimateData) => void;
  refreshKey: number;
}) {
  const [estimates, setEstimates] = useState<EstimateSummary[] | null>(null);
  const [toDelete, setToDelete] = useState<EstimateSummary | null>(null);

  const load = useCallback(() => {
    EstimatesApi.list()
      .then(setEstimates)
      .catch(() => toast.error("No se pudieron cargar los presupuestos"));
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const changeStatus = async (id: string, status: EstimateStatus) => {
    const prev = estimates;
    setEstimates((list) =>
      list ? list.map((e) => (e.id === id ? { ...e, status } : e)) : list,
    );
    try {
      await EstimatesApi.updateStatus(id, status);
    } catch {
      setEstimates(prev ?? null);
      toast.error("No se pudo actualizar el estado");
    }
  };

  const download = async (id: string) => {
    try {
      const url = await EstimatesApi.getDownloadUrl(id);
      window.open(url, "_blank");
    } catch {
      toast.error("No se pudo obtener el PDF");
    }
  };

  const duplicate = async (id: string) => {
    try {
      const full = await EstimatesApi.get(id);
      onDuplicate(full.data);
    } catch {
      toast.error("No se pudo cargar el presupuesto");
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await EstimatesApi.remove(toDelete.id);
      setEstimates((list) => (list ? list.filter((e) => e.id !== toDelete.id) : list));
      toast.success("Presupuesto eliminado");
    } catch {
      toast.error("No se pudo eliminar el presupuesto");
    } finally {
      setToDelete(null);
    }
  };

  if (estimates === null) {
    return (
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (estimates.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-200 py-10 text-center text-sm text-muted-foreground">
        Aún no hay presupuestos guardados. Cree uno en la pestaña “Nuevo”.
      </p>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Paciente</TableHead>
              <TableHead className="hidden sm:table-cell">Fecha</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="w-36">Estado</TableHead>
              <TableHead className="w-28 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {estimates.map((est) => (
              <TableRow key={est.id}>
                <TableCell className="font-medium">
                  <span className="flex items-center gap-1.5">
                    {est.patientName}
                    {est.patientId && (
                      <Link2 className="h-3 w-3 shrink-0 text-brand-blue" aria-label="Paciente vinculado" />
                    )}
                  </span>
                </TableCell>
                <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                  {new Date(est.createdAt).toLocaleDateString("es-CL")}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {est.totalClp != null ? formatClp(est.totalClp) : "—"}
                </TableCell>
                <TableCell>
                  <Select
                    value={est.status}
                    onValueChange={(v) => changeStatus(est.id, v as EstimateStatus)}
                  >
                    <SelectTrigger className="h-8 border-none bg-transparent p-0 shadow-none focus:ring-0 [&>svg]:h-3 [&>svg]:w-3">
                      <Badge variant="outline" className={STATUS_STYLES[est.status]}>
                        {STATUS_LABELS[est.status]}
                      </Badge>
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(STATUS_LABELS) as EstimateStatus[]).map((s) => (
                        <SelectItem key={s} value={s}>
                          {STATUS_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => download(est.id)}
                      className="text-muted-foreground transition-colors hover:text-brand-blue"
                      title="Descargar PDF"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => duplicate(est.id)}
                      className="text-muted-foreground transition-colors hover:text-brand-blue"
                      title="Duplicar y editar"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setToDelete(est)}
                      className="text-muted-foreground transition-colors hover:text-red-500"
                      title="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar presupuesto?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará el presupuesto de {toDelete?.patientName} y su PDF. Esta acción no se
              puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
