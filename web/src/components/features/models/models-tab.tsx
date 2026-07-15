"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { format } from "date-fns";
import { toast } from "sonner";
import { API_URL } from "@/lib/utils";
import { ModelSet } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  ArrowLeft,
  Box,
  GitCompareArrows,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { UploadModelSetDialog } from "./upload-model-set-dialog";
import { CompareView } from "./compare-view";

// three.js stays out of the main bundle; the viewer only loads on demand.
const StlViewer = dynamic(() => import("./stl-viewer"), {
  ssr: false,
  loading: () => (
    <div className="aspect-[4/3] flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-[#6469FC]" />
    </div>
  ),
});

function formatBytes(bytes?: number | null): string | null {
  if (!bytes) return null;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileUrl(set: ModelSet, jaw: "upper" | "lower"): string | null {
  const key = jaw === "upper" ? set.upperKey : set.lowerKey;
  return key ? `${API_URL}/model-sets/${set.id}/file?jaw=${jaw}` : null;
}

type Mode = { kind: "list" } | { kind: "viewer"; set: ModelSet } | { kind: "compare" };

interface ModelsTabProps {
  patientId: string;
}

export function ModelsTab({ patientId }: ModelsTabProps) {
  const [sets, setSets] = useState<ModelSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [uploadOpen, setUploadOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ModelSet | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchSets = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/model-sets?patientId=${patientId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("No se pudieron cargar los modelos");
      setSets(await res.json());
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    fetchSets();
  }, [fetchSets]);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_URL}/model-sets/${pendingDelete.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("No se pudo eliminar el set de modelos");
      setSets((prev) => prev.filter((s) => s.id !== pendingDelete.id));
      toast.success("Set de modelos eliminado");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="py-16 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#6469FC]" />
      </div>
    );
  }

  // ── Viewer / compare modes ────────────────────────────────────────────────
  if (mode.kind !== "list") {
    return (
      <div className="mt-6 space-y-4">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMode({ kind: "list" })}
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Volver a la lista
          </Button>
          {mode.kind === "viewer" && (
            <p className="text-sm text-gray-500">
              {format(new Date(mode.set.takenAt), "dd/MM/yyyy")}
              {mode.set.label ? ` — ${mode.set.label}` : ""}
            </p>
          )}
        </div>
        {mode.kind === "viewer" ? (
          <StlViewer
            upperUrl={fileUrl(mode.set, "upper")}
            lowerUrl={fileUrl(mode.set, "lower")}
            orientation={mode.set.orientation}
            onSaveOrientation={async (quaternion) => {
              const res = await fetch(`${API_URL}/model-sets/${mode.set.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orientation: quaternion }),
                credentials: "include",
              });
              if (!res.ok) {
                toast.error("No se pudo guardar la orientación");
                return;
              }
              const updated: ModelSet = await res.json();
              setSets((prev) =>
                prev.map((s) => (s.id === updated.id ? updated : s))
              );
              setMode({ kind: "viewer", set: updated });
              toast.success("Orientación guardada");
            }}
          />
        ) : (
          <CompareView sets={sets} />
        )}
      </div>
    );
  }

  // ── List mode ─────────────────────────────────────────────────────────────
  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-bold">Modelos 3D</h3>
        <div className="flex gap-2">
          {sets.length >= 2 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMode({ kind: "compare" })}
            >
              <GitCompareArrows className="w-4 h-4 mr-1.5" />
              Comparar
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => setUploadOpen(true)}
            className="bg-gradient-to-r from-[#A066F8] to-[#6469FC] text-white"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Subir modelos
          </Button>
        </div>
      </div>

      {sets.length === 0 ? (
        <div className="py-16 flex flex-col items-center gap-3 text-gray-500">
          <Box className="w-10 h-10" />
          <p className="text-sm">
            Aún no hay modelos 3D para este paciente.
          </p>
          <Button variant="outline" size="sm" onClick={() => setUploadOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Subir el primer escaneo
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {sets.map((set) => (
            <Card key={set.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {format(new Date(set.takenAt), "dd/MM/yyyy")}
                    {set.label && (
                      <span className="font-normal text-gray-600">
                        {" "}
                        — {set.label}
                      </span>
                    )}
                  </p>
                  <div className="flex gap-1.5 mt-1.5">
                    {set.upperKey && (
                      <Badge variant="secondary" className="text-xs">
                        Superior{formatBytes(set.upperSize) ? ` · ${formatBytes(set.upperSize)}` : ""}
                      </Badge>
                    )}
                    {set.lowerKey && (
                      <Badge variant="secondary" className="text-xs">
                        Inferior{formatBytes(set.lowerSize) ? ` · ${formatBytes(set.lowerSize)}` : ""}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setMode({ kind: "viewer", set })}
                  >
                    <Box className="w-4 h-4 mr-1.5" />
                    Ver 3D
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={() => setPendingDelete(set)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <UploadModelSetDialog
        patientId={patientId}
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUploaded={(set) =>
          setSets((prev) =>
            [set, ...prev].sort(
              (a, b) =>
                new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime()
            )
          )
        }
      />

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && !deleting && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este set de modelos?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán permanentemente los archivos STL
              {pendingDelete
                ? ` del ${format(new Date(pendingDelete.takenAt), "dd/MM/yyyy")}`
                : ""}
              . Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Eliminar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
