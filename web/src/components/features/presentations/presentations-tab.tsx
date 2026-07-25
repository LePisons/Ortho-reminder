"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Pencil, Play, Plus, Presentation, Sparkles, Trash2 } from "lucide-react";
import { API_URL } from "@/lib/utils";
import { ModelSet, Patient, PatientImage } from "@/lib/types";
import {
  Presentation as Deck,
  PresentationSummary,
  PresentationsApi,
} from "@/lib/api/presentations.api";
import { autoGenerateSlides } from "./auto-generate";
import { DeckEditor } from "./deck-editor";

interface PresentationsTabProps {
  patient: Patient;
  images: PatientImage[];
}

export function PresentationsTab({ patient, images }: PresentationsTabProps) {
  const [decks, setDecks] = useState<PresentationSummary[]>([]);
  const [modelSets, setModelSets] = useState<ModelSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Deck | null>(null);
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PresentationSummary | null>(
    null
  );

  const load = useCallback(async () => {
    try {
      // Model sets are needed both for the deck list's 3D slides and for the
      // auto-generator, so they're fetched alongside the decks.
      const [deckList, setsRes] = await Promise.all([
        PresentationsApi.list(patient.id),
        fetch(`${API_URL}/model-sets?patientId=${patient.id}`, {
          credentials: "include",
        }),
      ]);
      setDecks(deckList);
      if (setsRes.ok) setModelSets(await setsRes.json());
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [patient.id]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (auto: boolean) => {
    setCreating(true);
    try {
      const slides = auto
        ? autoGenerateSlides({ patient, images, modelSets })
        : [];
      const deck = await PresentationsApi.create({
        patientId: patient.id,
        title: auto
          ? `Presentación — ${format(new Date(), "dd/MM/yyyy")}`
          : "Presentación sin título",
        slides,
      });
      setEditing(deck);
      if (auto) {
        toast.success(
          `${slides.length} diapositivas creadas a partir de sus registros`
        );
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const open = async (summary: PresentationSummary) => {
    try {
      setEditing(await PresentationsApi.get(summary.id));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

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

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-[#6469FC]" />
      </div>
    );
  }

  if (editing) {
    return (
      <DeckEditor
        deck={editing}
        patientName={patient.fullName}
        images={images}
        modelSets={modelSets}
        onBack={() => {
          setEditing(null);
          load();
        }}
        onDeckChange={setEditing}
      />
    );
  }

  const hasRecords = images.length > 0 || modelSets.length > 0;

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-bold">Presentaciones</h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => create(false)}
            disabled={creating}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            En blanco
          </Button>
          <Button
            size="sm"
            onClick={() => create(true)}
            disabled={creating || !hasRecords}
            title={
              hasRecords
                ? undefined
                : "Sube fotos, radiografías o modelos 3D para generar una automáticamente"
            }
            className="bg-gradient-to-r from-[#A066F8] to-[#6469FC] text-white"
          >
            {creating ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 h-4 w-4" />
            )}
            Generar automáticamente
          </Button>
        </div>
      </div>

      {decks.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-gray-500">
          <Presentation className="h-10 w-10" />
          <p className="text-sm">Aún no hay presentaciones para este paciente.</p>
          <p className="max-w-md text-center text-xs">
            «Generar automáticamente» arma un borrador con sus fotos,
            radiografías y modelos 3D. Después puedes editarlo, marcar sobre las
            imágenes y presentarlo en pantalla completa.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {decks.map((deck) => (
            <Card key={deck.id} className="transition-shadow hover:shadow-md">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-semibold">{deck.title}</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {deck.slideCount}{" "}
                    {deck.slideCount === 1 ? "diapositiva" : "diapositivas"} ·
                    Editada el {format(new Date(deck.updatedAt), "dd/MM/yyyy HH:mm")}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="outline" onClick={() => open(deck)}>
                    <Pencil className="mr-1.5 h-4 w-4" />
                    Editar
                  </Button>
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

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta presentación?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará «{pendingDelete?.title}» y las imágenes que hayas
              subido dentro de ella. Las fotos, radiografías y modelos del
              paciente no se tocan.
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
