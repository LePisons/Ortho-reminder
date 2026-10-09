"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { detectedPhotoView } from "@/lib/denticrop/photoView";
import { runBatch } from "@/lib/denticrop/batch";
import { Crop, WandSparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { API_URL } from "@/lib/utils";
import {
  photoViews,
  ReferralDetail,
  referralRequest,
} from "@/lib/api/referrals.api";
import type { DentalImage, ImageEdit } from "@/lib/denticrop/types";
import { primaryAction } from "./referral-ui";

const ImageEditor = dynamic(
  () =>
    import("@/lib/denticrop/ImageEditorModal").then((m) => m.ImageEditorModal),
  { ssr: false },
);
type Photo = ReferralDetail["files"][number];
type Row = {
  photo: Photo;
  selected: boolean;
  image?: DentalImage;
  reviewed?: boolean;
  saved?: boolean;
  view: string;
  error?: string;
  processing?: boolean;
  viewEdited?: boolean;
};

export function DenticropWorkspace({
  record,
  onRefresh,
  localFiles,
}: {
  record: ReferralDetail;
  onRefresh: () => Promise<void>;
  localFiles: Map<string, File>;
}) {
  const [open, setOpen] = useState(false),
    [rows, setRows] = useState<Row[]>([]),
    [editing, setEditing] = useState<DentalImage | null>(null);
  const [busy, setBusy] = useState(false),
    [consent, setConsent] = useState(false),
    [available, setAvailable] = useState(false),
    [message, setMessage] = useState("");
  const loads = useRef(new Map<string, Promise<DentalImage>>());
  const generation = useRef(0);
  const urls = useRef(new Set<string>());
  useEffect(() => {
    const owned = urls.current;
    return () => {
      generation.current++;
      owned.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);
  function own(url: string) {
    urls.current.add(url);
    return url;
  }
  function release() {
    generation.current++;
    loads.current.clear();
    urls.current.forEach((url) => URL.revokeObjectURL(url));
    urls.current.clear();
    setRows([]);
    setEditing(null);
    setConsent(false);
  }
  async function start() {
    release();
    setMessage("");
    setAvailable(false);
    setRows(
      record.files
        .filter((photo) => photo.kind === "PHOTO" && !photo.sourceFileId)
        .map((photo) => ({
          photo,
          selected: true,
          view: photo.photoView || "UNASSIGNED",
        })),
    );
    setOpen(true);
    const currentGeneration = generation.current;
    void runBatch(
      record.files.filter((p) => p.kind === "PHOTO" && !p.sourceFileId),
      3,
      async (photo) => {
        if (generation.current !== currentGeneration) return;
        try {
          const image = await load({
            photo,
            selected: true,
            view: photo.photoView || "UNASSIGNED",
          });
          if (generation.current === currentGeneration)
            setRows((rows) =>
              rows.map((r) =>
                r.photo.id === photo.id && !r.image ? { ...r, image } : r,
              ),
            );
        } catch {
          /* The row can retry loading when opened. */
        }
      },
    );
    try {
      const config = await referralRequest<{ available: boolean }>(
        `/${record.id}/crop-config`,
      );
      if (generation.current === currentGeneration)
        setAvailable(config.available);
    } catch {
      setMessage(
        "No se pudo consultar la propuesta automática. Puedes recortar manualmente.",
      );
    }
  }
  async function load(row: Row): Promise<DentalImage> {
    if (row.image) return row.image;
    const existing = loads.current.get(row.photo.id);
    if (existing) return existing;
    const version = generation.current;
    const promise = (async () => {
      let file = localFiles.get(row.photo.id);
      if (!file) {
        const response = await fetch(
          `${API_URL}/referrals/${record.id}/files/${row.photo.id}`,
          { credentials: "include", cache: "no-store" },
        );
        if (!response.ok)
          throw new Error("No se pudo cargar el original. Actualiza el caso.");
        const blob = await response.blob();
        file = new File([blob], row.photo.name, { type: blob.type });
      }
      if (version !== generation.current) throw new Error("Ventana cerrada.");
      return {
        id: row.photo.id,
        batchId: record.id,
        file,
        editSource: file,
        previewUrl: own(URL.createObjectURL(file)),
        status: "idle" as const,
        format: "image/jpeg" as const,
      };
    })();
    loads.current.set(row.photo.id, promise);
    try {
      return await promise;
    } catch (error) {
      loads.current.delete(row.photo.id);
      throw error;
    }
  }

  async function edit(row: Row) {
    setBusy(true);
    setMessage("");
    try {
      const image = await load(row);
      setRows((current) =>
        current.map((r) => (r.photo.id === row.photo.id ? { ...r, image } : r)),
      );
      setEditing(image);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "No se pudo abrir.");
    } finally {
      setBusy(false);
    }
  }
  async function propose() {
    if (!consent || !available) return;
    setBusy(true);
    const selected = rows.filter((row) => row.selected && !row.saved);
    try {
      const { proposeCrop } = await import("@/lib/denticrop/proposeCrop");
      let completed = 0;
      await runBatch(selected, 3, async (row) => {
        setRows((rows) =>
          rows.map((r) =>
            r.photo.id === row.photo.id
              ? { ...r, processing: true, error: undefined }
              : r,
          ),
        );
        try {
          const source = await load(row);
          const image = await proposeCrop(
            source,
            `${API_URL}/referrals/${record.id}/files/${row.photo.id}/crop-proposal`,
          );
          if (image.resultUrl) own(image.resultUrl);
          setRows((current) =>
            current.map((r) =>
              r.photo.id === row.photo.id
                ? {
                    ...r,
                    image,
                    view:
                      !r.viewEdited && r.view === "UNASSIGNED"
                        ? detectedPhotoView(image.className) || r.view
                        : r.view,
                    processing: false,
                    reviewed: false,
                    error: image.error,
                  }
                : r,
            ),
          );
        } catch (e) {
          setRows((current) =>
            current.map((r) =>
              r.photo.id === row.photo.id
                ? {
                    ...r,
                    processing: false,
                    error:
                      e instanceof Error ? e.message : "No se pudo preparar.",
                  }
                : r,
            ),
          );
        } finally {
          completed++;
          setMessage(`${completed} de ${selected.length} fotos procesadas`);
        }
      });
      setMessage(
        "Lote terminado. Revisa los encuadres y confirma las seleccionadas para guardarlas. Abre el editor solo si necesitas ajustar una foto.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function review(id: string, blob: Blob, edit: ImageEdit) {
    const resultUrl = own(URL.createObjectURL(blob));
    setRows((current) =>
      current.map((row) =>
        row.photo.id === id
          ? {
              ...row,
              reviewed: true,
              error: undefined,
              image: {
                ...row.image!,
                edit,
                resultBlob: blob,
                resultUrl,
                status: "success",
              },
            }
          : row,
      ),
    );
    setEditing(null);
  }
  async function save() {
    setBusy(true);
    let saved = 0,
      failed = 0;
    try {
      for (const row of rows.filter(
        (r) => r.selected && r.reviewed && !r.saved,
      )) {
        try {
          if (!row.image?.resultBlob || !row.image.edit)
            throw new Error("Revisa el recorte antes de guardar.");
          const form = new FormData();
          form.append("photoView", row.view);
          form.append("recipe", JSON.stringify(row.image.edit));
          form.append("file", row.image.resultBlob, "recorte.jpg");
          await referralRequest(
            `/${record.id}/files/${row.photo.id}/crops`,
            "POST",
            form,
          );
          saved++;
          setRows((current) =>
            current.map((r) =>
              r.photo.id === row.photo.id
                ? { ...r, saved: true, selected: false }
                : r,
            ),
          );
        } catch (e) {
          failed++;
          setRows((current) =>
            current.map((r) =>
              r.photo.id === row.photo.id
                ? {
                    ...r,
                    error:
                      e instanceof Error ? e.message : "No se pudo guardar.",
                  }
                : r,
            ),
          );
        }
      }
      try {
        await onRefresh();
      } catch {
        setMessage(
          `${saved} recortes guardados. No se pudo actualizar la galería; cierra esta ventana y actualiza el caso. Los originales se conservan.`,
        );
        return;
      }
      setMessage(
        `${saved} ${saved === 1 ? "recorte guardado" : "recortes guardados"}.${failed ? " Algunos no se guardaron; revisa los errores y reintenta." : ""} Los originales se conservan.`,
      );
    } finally {
      setBusy(false);
    }
  }
  const originals = record.files.filter(
    (photo) => photo.kind === "PHOTO" && !photo.sourceFileId,
  );
  return (
    <>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#6469FC]/20 bg-gradient-to-r from-[#A066F8]/10 to-[#6469FC]/5 p-4">
        <div>
          <h3 className="font-semibold">Denticrop · Recortes revisables</h3>
          <p className="mt-1 text-sm text-foreground/70">
            Prepara las fotos, ajusta el encuadre y guarda una versión sin
            reemplazar el original.
          </p>
        </div>
        <Button
          className={primaryAction}
          disabled={!!record.revokedAt || !originals.length}
          onClick={() => void start()}
        >
          <Crop size={17} />
          Preparar fotografías
        </Button>
        {!originals.length && (
          <p className="text-xs text-muted-foreground">
            Sube primero las fotos desde la galería.
          </p>
        )}
      </div>
      <Dialog
        open={open && !editing}
        onOpenChange={(next) => {
          if (!busy) {
            if (
              !next &&
              rows.some((r) => r.reviewed && !r.saved) &&
              !window.confirm(
                "Hay recortes revisados sin guardar. ¿Cerrar y descartar estos ajustes?",
              )
            )
              return;
            setOpen(next);
            if (!next) release();
          }
        }}
      >
        <DialogContent className="min-w-0 sm:max-w-6xl">
          <DialogTitle>Preparar fotografías con Denticrop</DialogTitle>
          <DialogDescription>
            Selecciona originales, revisa cada propuesta y guarda los recortes
            elegidos. Los archivos del caso solo cambian al guardar.
          </DialogDescription>
          <div className="space-y-3 rounded-xl border bg-secondary/30 p-4">
            {available ? (
              <label className="flex items-start gap-3 text-sm leading-6">
                <input
                  className="mt-1.5 accent-[#6469FC]"
                  type="checkbox"
                  checked={consent}
                  disabled={busy}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                <span>
                  Autorizo enviar una copia reducida de las fotos seleccionadas
                  a Roboflow para proponer el encuadre. No se enviarán el
                  nombre, RUT ni los datos de la ficha. La imagen puede
                  identificar al paciente. El recorte manual no usa este
                  servicio.
                </span>
              </label>
            ) : (
              <p className="text-sm">
                La propuesta automática no está configurada. El editor manual ya
                está disponible.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  setRows((current) =>
                    current.map((row) => ({ ...row, selected: !row.saved })),
                  )
                }
              >
                Seleccionar todos
              </Button>
              <Button
                variant="outline"
                disabled={
                  busy ||
                  !available ||
                  !consent ||
                  !rows.some((r) => r.selected && !r.saved)
                }
                onClick={() => void propose()}
              >
                <WandSparkles size={16} />
                Proponer recortes
              </Button>
            </div>
          </div>
          {message && (
            <p role="status" className="text-sm text-primary">
              {message}
            </p>
          )}
          <h3 className="text-lg font-semibold">
            Cola de procesamiento ({rows.length})
          </h3>
          <p className="text-sm text-muted-foreground">
            Haz clic en una foto si necesitas ajustar el encuadre o la
            orientación.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {rows.map((row) => (
              <article
                key={row.photo.id}
                className="min-w-0 space-y-3 overflow-hidden rounded-2xl border bg-card pb-3 shadow-sm"
              >
                <button
                  type="button"
                  aria-label={`Editar ${row.photo.name}`}
                  disabled={busy || row.saved}
                  onClick={() => void edit(row)}
                  className="relative flex aspect-square w-full items-center justify-center bg-[#1B1B1B] focus-visible:outline-2 focus-visible:outline-[#6469FC]"
                >
                  {row.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={row.image.resultUrl || row.image.previewUrl}
                      alt={row.photo.name}
                      className={`h-full w-full object-contain ${row.processing ? "opacity-50" : ""}`}
                    />
                  ) : (
                    <span className="text-xs text-white/80">
                      Cargando vista previa…
                    </span>
                  )}
                  {row.processing && (
                    <span className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-white">
                      <Loader2 className="motion-safe:animate-spin" size={20} />
                      Procesando
                    </span>
                  )}
                </button>
                <label className="flex items-center gap-2 px-3 text-xs font-medium">
                  <input
                    type="checkbox"
                    checked={row.selected}
                    disabled={busy || row.saved}
                    onChange={(e) =>
                      setRows((rows) =>
                        rows.map((r) =>
                          r.photo.id === row.photo.id
                            ? { ...r, selected: e.target.checked }
                            : r,
                        ),
                      )
                    }
                  />
                  <span className="truncate" title={row.photo.name}>
                    {row.photo.name}
                  </span>
                </label>
                <p className="mx-3 w-fit rounded-full bg-[#6469FC]/10 px-2 py-1 text-xs font-semibold text-primary">
                  {row.processing
                    ? "Procesando…"
                    : row.error
                      ? "Necesita atención"
                      : row.saved
                        ? "Guardado"
                        : row.reviewed
                          ? "Revisado · listo para guardar"
                          : row.image?.resultBlob
                            ? "Propuesta · requiere revisión"
                            : "Sin preparar"}
                </p>
                {row.error && (
                  <p role="alert" className="text-xs text-red-700">
                    {row.error}
                  </p>
                )}
                {row.image?.className && (
                  <p className="px-3 text-xs text-muted-foreground">
                    Detectado:{" "}
                    {photoViews[detectedPhotoView(row.image.className) || ""] ||
                      row.image.className}
                    {!detectedPhotoView(row.image.className) &&
                      " · elige la vista"}
                  </p>
                )}
                <label className="block px-3 text-xs">
                  Vista de la fotografía
                  <select
                    className="mt-1 block w-full rounded-lg border bg-card p-2 text-sm"
                    value={row.view}
                    disabled={busy || row.saved}
                    onChange={(e) =>
                      setRows((current) =>
                        current.map((r) =>
                          r.photo.id === row.photo.id
                            ? { ...r, view: e.target.value, viewEdited: true }
                            : r,
                        ),
                      )
                    }
                  >
                    {Object.entries(photoViews).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                  variant="outline"
                  className="mx-3 w-[calc(100%-1.5rem)]"
                  disabled={busy || row.saved}
                  onClick={() => void edit(row)}
                >
                  Revisar / recortar
                </Button>
              </article>
            ))}
          </div>
          <div className="sticky -bottom-6 z-10 -mx-6 -mb-6 space-y-3 border-t bg-card p-4 shadow-[0_-4px_16px_#0000000a]">
            <p className="text-sm text-muted-foreground">
              Revisa los encuadres y las vistas en la cuadrícula. Puedes abrir
              solo las fotos que necesiten ajustes.
            </p>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button
                variant="outline"
                disabled={
                  busy ||
                  !rows.some(
                    (r) =>
                      r.selected &&
                      !r.saved &&
                      !r.reviewed &&
                      !r.error &&
                      r.image?.resultBlob &&
                      r.image.edit,
                  )
                }
                onClick={() =>
                  setRows((current) =>
                    current.map((r) =>
                      r.selected &&
                      !r.saved &&
                      !r.error &&
                      r.image?.resultBlob &&
                      r.image.edit
                        ? { ...r, reviewed: true }
                        : r,
                    ),
                  )
                }
              >
                Confirmar revisión de las seleccionadas
              </Button>
              <Button
                className={`${primaryAction} h-auto min-h-10 whitespace-normal`}
                disabled={
                  busy ||
                  !rows.some((r) => r.selected && r.reviewed && !r.saved)
                }
                onClick={() => void save()}
              >
                {busy
                  ? "Procesando…"
                  : `Guardar recortes (${rows.filter((r) => r.selected && r.reviewed && !r.saved).length})`}
              </Button>
            </div>
            {!busy &&
              rows.some((r) => !r.saved) &&
              !rows.some((r) => r.selected && r.reviewed && !r.saved) && (
                <p role="status" className="text-xs text-muted-foreground">
                  Para habilitar el guardado, selecciona fotos procesadas y
                  confirma su revisión aquí o en el editor.
                </p>
              )}
          </div>
        </DialogContent>
      </Dialog>
      <ImageEditor
        isOpen={!!editing}
        image={editing}
        onClose={() => setEditing(null)}
        onSave={review}
      />
    </>
  );
}
