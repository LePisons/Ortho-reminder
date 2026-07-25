"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Library, Loader2, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slide, SlideTemplate, SlideTemplatesApi } from "@/lib/api/presentations.api";
import { SlideCanvas } from "./slide-canvas";

interface SlideLibraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (slide: Slide) => void;
}

/**
 * The clinician's reusable explainer slides. Inserting copies the slide into the
 * deck by value, so editing it there never touches the library original — and
 * editing the library never rewrites a deck already presented to a patient.
 */
export function SlideLibraryDialog({
  open,
  onOpenChange,
  onInsert,
}: SlideLibraryDialogProps) {
  const [templates, setTemplates] = useState<SlideTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTemplates(await SlideTemplatesApi.list());
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const remove = async (id: string) => {
    try {
      await SlideTemplatesApi.remove(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      toast.success("Diapositiva eliminada de la biblioteca");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Biblioteca de diapositivas</DialogTitle>
          <DialogDescription>
            Explicaciones que preparas una vez y reutilizas con cualquier
            paciente. Guarda una diapositiva aquí desde el editor.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-7 w-7 animate-spin text-[#6469FC]" />
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-gray-500">
            <Library className="h-9 w-9 opacity-40" />
            <p className="text-sm">Tu biblioteca está vacía.</p>
            <p className="text-xs">
              Arma una diapositiva y usa «Guardar en biblioteca» para reutilizarla.
            </p>
          </div>
        ) : (
          <div className="grid max-h-[60vh] grid-cols-2 gap-4 overflow-y-auto pr-1 md:grid-cols-3">
            {templates.map((t) => (
              <div key={t.id} className="group space-y-1.5">
                <div className="overflow-hidden rounded-lg border transition-shadow group-hover:shadow-md">
                  <SlideCanvas slide={t.slide} />
                </div>
                <div className="flex items-center gap-1">
                  <p className="min-w-0 flex-1 truncate text-xs font-medium">
                    {t.title}
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-red-500 hover:bg-red-50"
                    onClick={() => remove(t.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    onInsert(t.slide);
                    onOpenChange(false);
                  }}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Insertar
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
