"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Library,
  Loader2,
  Pencil,
  Play,
  Presentation,
  Trash2,
  User,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  PresentationSummary,
  PresentationsApi,
} from "@/lib/api/presentations.api";
import { SlideLibraryDialog } from "@/components/features/presentations/slide-library";

export default function PresentacionesPage() {
  const [decks, setDecks] = useState<PresentationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PresentationSummary | null>(
    null
  );

  const load = useCallback(async () => {
    try {
      setDecks(await PresentationsApi.list());
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await PresentationsApi.remove(pendingDelete.id);
      setDecks((prev) => prev.filter((d) => d.id !== pendingDelete.id));
      toast.success("Presentación eliminada");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPendingDelete(null);
    }
  };

  const filtered = decks.filter((d) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      d.title.toLowerCase().includes(q) || d.patientName.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Presentaciones</h1>
          <p className="text-sm text-gray-500">
            Explica el tratamiento con las fotos, radiografías y modelos del
            paciente.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setLibraryOpen(true)}>
            <Library className="mr-1.5 h-4 w-4" />
            Biblioteca de diapositivas
          </Button>
          {/* Opens in its own tab: the intake is a long form, and it usually
              happens while the patient's own record is still open elsewhere. */}
          <Button
            size="sm"
            onClick={() => window.open("/presentaciones/nuevo-caso", "_blank")}
            className="bg-gradient-to-r from-[#A066F8] to-[#6469FC] text-white"
          >
            <UserPlus className="mr-1.5 h-4 w-4" />
            Caso externo
          </Button>
        </div>
      </div>

      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar por paciente o título…"
        className="max-w-sm"
      />

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#6469FC]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-gray-500">
          <Presentation className="h-10 w-10" />
          <p className="text-sm">
            {decks.length === 0
              ? "Aún no has creado presentaciones."
              : "Ningún resultado para esa búsqueda."}
          </p>
          {decks.length === 0 && (
            <p className="max-w-md text-center text-xs">
              Abre la ficha de un paciente y usa la pestaña «Presentación» para
              generar una a partir de sus registros, o crea un «Caso externo»
              subiendo los registros de alguien que no es paciente.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((deck) => (
            <Card key={deck.id} className="transition-shadow hover:shadow-md">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-semibold">
                    {deck.title}
                    {!deck.patientId && (
                      <span className="rounded-full bg-[#6469FC]/10 px-2 py-0.5 text-[11px] font-semibold text-[#6469FC]">
                        Externo
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-gray-500">
                    <User className="h-3 w-3" />
                    {deck.patientName} · {deck.slideCount}{" "}
                    {deck.slideCount === 1 ? "diapositiva" : "diapositivas"} ·
                    Editada el{" "}
                    {format(new Date(deck.updatedAt), "dd/MM/yyyy HH:mm")}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/presentaciones/${deck.id}`}>
                      <Pencil className="mr-1.5 h-4 w-4" />
                      Editar
                    </Link>
                  </Button>
                  {deck.patientId && (
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/patients/${deck.patientId}?tab=presentacion`}>
                        Abrir ficha
                      </Link>
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={deck.slideCount === 0}
                    onClick={() => window.open(`/present/${deck.id}`, "_blank")}
                  >
                    <Play className="mr-1.5 h-4 w-4" />
                    Presentar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-500 hover:bg-red-50 hover:text-red-600"
                    onClick={() => setPendingDelete(deck)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <SlideLibraryDialog
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        // Nothing to insert into from the index; the library here is for review
        // and cleanup, so a no-op keeps the same component in one place.
        onInsert={() =>
          toast.info("Abre una presentación para insertar esta diapositiva")
        }
      />

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta presentación?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará «{pendingDelete?.title}» de {pendingDelete?.patientName}.{" "}
              {pendingDelete?.patientId
                ? "Las fotos, radiografías y modelos del paciente no se tocan."
                : "Se eliminarán también los registros que subiste dentro de este caso, que no existen en ninguna otra parte."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
