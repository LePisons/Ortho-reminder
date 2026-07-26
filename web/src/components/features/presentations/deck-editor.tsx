"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowUpRight,
  Camera,
  Check,
  Circle,
  CircleDot,
  Copy,
  DraftingCompass,
  FileDown,
  Library,
  Loader2,
  Minus,
  MousePointer2,
  Pencil,
  Play,
  Plus,
  Square,
  Trash2,
  Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ModelSet, PatientImage } from "@/lib/types";
import {
  LAYOUT_LABELS,
  LayoutId,
  Presentation,
  PresentationAsset,
  PresentationsApi,
  Slide,
  SlideItem,
  emptySlide,
  framesForLayout,
} from "@/lib/api/presentations.api";
import { SlideCanvas } from "./slide-canvas";
import { ANNOTATION_COLORS, Tool } from "./annotation-layer";
import { MediaPicker } from "./media-picker";
import { SlideLibraryDialog } from "./slide-library";

const TOOLS: { id: Tool; label: string; icon: typeof MousePointer2 }[] = [
  { id: "select", label: "Seleccionar", icon: MousePointer2 },
  { id: "arrow", label: "Flecha", icon: ArrowUpRight },
  { id: "line", label: "Línea recta", icon: Minus },
  { id: "point", label: "Punto", icon: CircleDot },
  {
    id: "angle",
    label: "Medir ángulo (3 clics: punto, vértice, punto)",
    icon: DraftingCompass,
  },
  { id: "ellipse", label: "Círculo", icon: Circle },
  { id: "rect", label: "Rectángulo", icon: Square },
  { id: "freehand", label: "Lápiz", icon: Pencil },
  { id: "label", label: "Texto", icon: Type },
];

const LAYOUT_OPTIONS = Object.keys(LAYOUT_LABELS) as LayoutId[];

/** Both live-scan frames: a patient's ModelSet, or an external case's STLs. */
const is3d = (
  f: SlideItem | null | undefined
): f is Extract<SlideItem, { kind: "model3d" | "assetModel3d" }> =>
  f?.kind === "model3d" || f?.kind === "assetModel3d";

interface DeckEditorProps {
  deck: Presentation;
  patientName: string;
  images: PatientImage[];
  modelSets: ModelSet[];
  /** External cases only: the deck's own records, in place of a chart. */
  assets?: PresentationAsset[];
  onBack: () => void;
  onDeckChange?: (deck: Presentation) => void;
}

export function DeckEditor({
  deck,
  patientName,
  images,
  modelSets,
  assets,
  onBack,
  onDeckChange,
}: DeckEditorProps) {
  const router = useRouter();
  const [title, setTitle] = useState(deck.title);
  const [slides, setSlides] = useState<Slide[]>(deck.slides ?? []);
  const [index, setIndex] = useState(0);
  const [tool, setTool] = useState<Tool>("select");
  const [color, setColor] = useState(ANNOTATION_COLORS[0].value);
  const [strokeWidth, setStrokeWidth] = useState(8);
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null);
  const [pickerFrame, setPickerFrame] = useState<number | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const dragFrom = useRef<number | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const current = slides[index];

  // ── Autosave ─────────────────────────────────────────────────────────────
  // Debounced so dragging a slider or typing a caption doesn't hammer the API,
  // but short enough that walking away never loses more than a moment's work.
  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(async () => {
      setSaving(true);
      try {
        const updated = await PresentationsApi.update(deck.id, { title, slides });
        onDeckChange?.(updated);
        setDirty(false);
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setSaving(false);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [dirty, title, slides, deck.id, onDeckChange]);

  // Warn on a hard navigation while an autosave is still pending.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const mutate = useCallback(
    (updater: (slides: Slide[]) => Slide[]) => {
      setSlides((prev) => updater(prev));
      setDirty(true);
    },
    []
  );

  const patchSlide = useCallback(
    (patch: Partial<Slide>) =>
      mutate((prev) =>
        prev.map((s, i) => (i === index ? { ...s, ...patch } : s))
      ),
    [index, mutate]
  );

  // ── Slide operations ─────────────────────────────────────────────────────

  const addSlide = (layout: LayoutId = "full") => {
    mutate((prev) => [
      ...prev.slice(0, index + 1),
      emptySlide(layout),
      ...prev.slice(index + 1),
    ]);
    setIndex((i) => Math.min(i + 1, slides.length));
  };

  const duplicateSlide = () => {
    if (!current) return;
    const copy: Slide = {
      ...structuredClone(current),
      id: crypto.randomUUID(),
      annotations: current.annotations.map((a) => ({
        ...a,
        id: crypto.randomUUID(),
      })),
    };
    mutate((prev) => [...prev.slice(0, index + 1), copy, ...prev.slice(index + 1)]);
    setIndex((i) => i + 1);
  };

  const deleteSlide = () => {
    mutate((prev) => prev.filter((_, i) => i !== index));
    setIndex((i) => Math.max(0, Math.min(i, slides.length - 2)));
  };

  const reorder = (from: number, to: number) => {
    if (from === to) return;
    mutate((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setIndex(to);
  };

  const changeLayout = (layout: LayoutId) => {
    if (!current) return;
    patchSlide({ layout, frames: framesForLayout(layout, current.frames) });
  };

  const setFrame = (frameIndex: number, item: SlideItem | null) =>
    patchSlide({
      frames: current.frames.map((f, i) => (i === frameIndex ? item : f)),
    });

  const insertTemplate = (slide: Slide) => {
    const copy: Slide = {
      ...structuredClone(slide),
      id: crypto.randomUUID(),
      annotations: slide.annotations.map((a) => ({
        ...a,
        id: crypto.randomUUID(),
      })),
    };
    mutate((prev) => [...prev.slice(0, index + 1), copy, ...prev.slice(index + 1)]);
    setIndex((i) => Math.min(i + 1, slides.length));
    toast.success("Diapositiva insertada");
  };

  const saveAsTemplate = async () => {
    if (!current) return;
    const { SlideTemplatesApi } = await import("@/lib/api/presentations.api");
    try {
      await SlideTemplatesApi.create({
        title: current.title || "Diapositiva sin título",
        slide: current,
      });
      toast.success("Guardada en tu biblioteca");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  /**
   * Freeze the current 3D view as an image so the PDF has something to print.
   * The renderer runs with `preserveDrawingBuffer: true`, so reading the canvas
   * element straight out of the DOM is reliable and avoids threading an
   * imperative handle through `next/dynamic`.
   */
  const capture3d = async () => {
    const frameIndex = current?.frames.findIndex((f) => is3d(f));
    if (frameIndex === undefined || frameIndex < 0) return;
    const canvas = canvasRef.current?.querySelector("canvas");
    if (!canvas) {
      toast.error("El modelo 3D aún se está cargando");
      return;
    }
    setCapturing(true);
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png")
      );
      if (!blob) throw new Error("No se pudo capturar la vista");
      const asset = await PresentationsApi.uploadAsset(
        blob,
        deck.id,
        "modelo-3d.png"
      );
      const frame = current.frames[frameIndex];
      if (is3d(frame)) {
        setFrame(frameIndex, { ...frame, snapshotAssetId: asset.id });
      }
      toast.success("Vista 3D guardada para el PDF");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCapturing(false);
    }
  };

  const exportPdf = async () => {
    setExporting(true);
    try {
      const { buildPresentationPdf, presentationFileName } = await import(
        "./pdf/build-presentation-pdf"
      );
      const blob = await buildPresentationPdf({
        title,
        patientName,
        slides,
        modelSets,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = presentationFileName(title, patientName);
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error((e as Error).message || "No se pudo exportar el PDF");
    } finally {
      setExporting(false);
    }
  };

  // Keep the presenter honest: flush pending edits before opening it.
  const present = async () => {
    if (dirty) {
      try {
        await PresentationsApi.update(deck.id, { title, slides });
        setDirty(false);
      } catch (e) {
        toast.error((e as Error).message);
        return;
      }
    }
    router.push(`/present/${deck.id}`);
  };

  const frameCount = current?.frames.length ?? 0;
  const canAnnotate = !!current;

  const rail = useMemo(
    () =>
      slides.map((s, i) => (
        <div
          key={s.id}
          draggable
          onDragStart={() => (dragFrom.current = i)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (dragFrom.current !== null) reorder(dragFrom.current, i);
            dragFrom.current = null;
          }}
          onClick={() => {
            setIndex(i);
            setSelectedAnnotation(null);
          }}
          className={`group relative cursor-pointer rounded-lg border-2 transition-all ${
            i === index
              ? "border-[#6469FC] shadow-md"
              : "border-transparent hover:border-gray-300"
          }`}
        >
          <div className="overflow-hidden rounded-md">
            <SlideCanvas slide={s} modelSets={modelSets} patientName={patientName} />
          </div>
          <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 text-[11px] font-semibold text-white">
            {i + 1}
          </span>
        </div>
      )),
    // `reorder` and `patientName` are stable enough for the rail's purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [slides, index, modelSets, patientName]
  );

  return (
    <div className="mt-6 space-y-4">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Volver
          </Button>
          <Input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setDirty(true);
            }}
            className="h-9 w-64 font-semibold"
          />
          <span className="flex items-center gap-1 text-xs text-gray-400">
            {saving ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" /> Guardando
              </>
            ) : dirty ? (
              "Cambios sin guardar"
            ) : (
              <>
                <Check className="h-3 w-3" /> Guardado
              </>
            )}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setLibraryOpen(true)}>
            <Library className="mr-1.5 h-4 w-4" />
            Biblioteca
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportPdf}
            disabled={exporting || slides.length === 0}
          >
            {exporting ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="mr-1.5 h-4 w-4" />
            )}
            PDF
          </Button>
          <Button
            size="sm"
            onClick={present}
            disabled={slides.length === 0}
            className="bg-gradient-to-r from-[#A066F8] to-[#6469FC] text-white"
          >
            <Play className="mr-1.5 h-4 w-4" />
            Presentar
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[190px_1fr_260px]">
        {/* ── Slide rail ───────────────────────────────────────────────── */}
        <div className="order-2 space-y-2 lg:order-1 lg:max-h-[calc(100vh-13rem)] lg:overflow-y-auto lg:pr-1">
          {rail}
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => addSlide()}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Diapositiva
          </Button>
        </div>

        {/* ── Canvas ───────────────────────────────────────────────────── */}
        <div className="order-1 space-y-3 lg:order-2">
          {current ? (
            <>
              <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-white p-2">
                {TOOLS.map((t) => (
                  <button
                    key={t.id}
                    title={t.label}
                    onClick={() => setTool(t.id)}
                    disabled={!canAnnotate}
                    className={`rounded-md p-2 transition-colors ${
                      tool === t.id
                        ? "bg-gradient-to-r from-[#A066F8] to-[#6469FC] text-white"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    <t.icon className="h-4 w-4" />
                  </button>
                ))}
                <div className="mx-1 h-6 w-px bg-gray-200" />
                {ANNOTATION_COLORS.map((c) => (
                  <button
                    key={c.value}
                    title={c.label}
                    onClick={() => setColor(c.value)}
                    className={`h-6 w-6 rounded-full border-2 transition-transform ${
                      color === c.value
                        ? "scale-110 border-[#1B1B1B]"
                        : "border-gray-300"
                    }`}
                    style={{ backgroundColor: c.value }}
                  />
                ))}
                <div className="mx-1 h-6 w-px bg-gray-200" />
                <label className="flex items-center gap-2 text-xs text-gray-500">
                  Grosor
                  <input
                    type="range"
                    min={3}
                    max={20}
                    value={strokeWidth}
                    onChange={(e) => setStrokeWidth(Number(e.target.value))}
                    className="w-20 accent-[#6469FC]"
                  />
                </label>
                {current.frames.some(is3d) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-auto"
                    disabled={capturing}
                    onClick={capture3d}
                    title="Guarda la vista actual del modelo como imagen para el PDF"
                  >
                    {capturing ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <Camera className="mr-1.5 h-4 w-4" />
                    )}
                    Capturar vista 3D
                  </Button>
                )}
                {selectedAnnotation && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto text-red-500 hover:bg-red-50 hover:text-red-600"
                    onClick={() => {
                      patchSlide({
                        annotations: current.annotations.filter(
                          (a) => a.id !== selectedAnnotation
                        ),
                      });
                      setSelectedAnnotation(null);
                    }}
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" />
                    Borrar marca
                  </Button>
                )}
              </div>

              <div
                ref={canvasRef}
                className="overflow-hidden rounded-xl border shadow-sm"
              >
                <SlideCanvas
                  slide={current}
                  modelSets={modelSets}
                  patientName={patientName}
                  interactive3d
                  editable
                  onFrameClick={setPickerFrame}
                  tool={tool}
                  color={color}
                  strokeWidth={strokeWidth}
                  onAnnotationsChange={(annotations) =>
                    patchSlide({ annotations })
                  }
                  selectedAnnotationId={selectedAnnotation}
                  onSelectAnnotation={setSelectedAnnotation}
                />
              </div>
            </>
          ) : (
            <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed text-gray-500">
              <p className="text-sm">Esta presentación no tiene diapositivas.</p>
              <Button variant="outline" size="sm" onClick={() => addSlide("title")}>
                <Plus className="mr-1.5 h-4 w-4" />
                Agregar la primera
              </Button>
            </div>
          )}
        </div>

        {/* ── Inspector ────────────────────────────────────────────────── */}
        {current && (
          <div className="order-3 space-y-4 rounded-xl border bg-white p-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500">
                Diseño
              </label>
              <Select
                value={current.layout}
                onValueChange={(v) => changeLayout(v as LayoutId)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LAYOUT_OPTIONS.map((l) => (
                    <SelectItem key={l} value={l}>
                      {LAYOUT_LABELS[l]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500">
                Título
              </label>
              <Input
                value={current.title ?? ""}
                onChange={(e) => patchSlide({ title: e.target.value })}
                placeholder="Sin título"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500">
                {current.layout === "text" ? "Contenido" : "Pie de página"}
              </label>
              <Textarea
                value={current.caption ?? ""}
                onChange={(e) => patchSlide({ caption: e.target.value })}
                rows={current.layout === "text" ? 6 : 2}
              />
            </div>

            {frameCount > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500">
                  Contenido ({frameCount} {frameCount === 1 ? "espacio" : "espacios"})
                </label>
                <div className="space-y-1.5">
                  {current.frames.map((f, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 justify-start text-xs"
                        onClick={() => setPickerFrame(i)}
                      >
                        {i + 1}. {describeFrame(f)}
                      </Button>
                      {f && (
                        <>
                          {(f.kind === "patientImage" || f.kind === "asset") && (
                            <Button
                              variant="ghost"
                              size="sm"
                              title={
                                f.fit === "cover"
                                  ? "Mostrar imagen completa"
                                  : "Rellenar el espacio"
                              }
                              className="px-2 text-[11px]"
                              onClick={() =>
                                setFrame(i, {
                                  ...f,
                                  fit: f.fit === "cover" ? "contain" : "cover",
                                })
                              }
                            >
                              {f.fit === "cover" ? "Recortada" : "Completa"}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="px-2 text-red-500 hover:bg-red-50"
                            onClick={() => setFrame(i, null)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500">Fondo</label>
              <div className="flex gap-1.5">
                {(["light", "dark"] as const).map((t) => (
                  <Button
                    key={t}
                    variant="outline"
                    size="sm"
                    className={`flex-1 ${
                      (current.theme ?? "light") === t
                        ? "border-[#6469FC] text-[#6469FC]"
                        : ""
                    }`}
                    onClick={() => patchSlide({ theme: t })}
                  >
                    {t === "light" ? "Claro" : "Oscuro"}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5 border-t pt-3">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={duplicateSlide}
              >
                <Copy className="mr-1.5 h-4 w-4" />
                Duplicar diapositiva
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={saveAsTemplate}
              >
                <Library className="mr-1.5 h-4 w-4" />
                Guardar en biblioteca
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-red-500 hover:bg-red-50 hover:text-red-600"
                onClick={deleteSlide}
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                Eliminar diapositiva
              </Button>
            </div>
          </div>
        )}
      </div>

      <MediaPicker
        open={pickerFrame !== null}
        onOpenChange={(o) => !o && setPickerFrame(null)}
        images={images}
        modelSets={modelSets}
        assets={assets}
        presentationId={deck.id}
        onPick={(item) => {
          if (pickerFrame !== null) setFrame(pickerFrame, item);
          setPickerFrame(null);
        }}
      />

      <SlideLibraryDialog
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        onInsert={insertTemplate}
      />
    </div>
  );
}

function describeFrame(item: SlideItem | null): string {
  if (!item) return "Vacío";
  switch (item.kind) {
    case "patientImage":
      return "Foto del paciente";
    case "asset":
      return "Imagen subida";
    case "model3d":
    case "assetModel3d":
      return "Modelo 3D";
    case "text":
      return item.body.slice(0, 22) || "Texto";
  }
}
