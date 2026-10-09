"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Crop, WandSparkles } from "lucide-react";
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
};

export function DenticropWorkspace({
  record,
  onRefresh,
}: {
  record: ReferralDetail;
  onRefresh: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false),
    [rows, setRows] = useState<Row[]>([]),
    [editing, setEditing] = useState<DentalImage | null>(null);
  const [busy, setBusy] = useState(false),
    [consent, setConsent] = useState(false),
    [available, setAvailable] = useState(false),
    [message, setMessage] = useState("");
  const urls = useRef(new Set<string>());
  useEffect(() => {
    const owned = urls.current;
    return () => owned.forEach((url) => URL.revokeObjectURL(url));
  }, []);
  function own(url: string) {
    urls.current.add(url);
    return url;
  }
  function release() {
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
          selected: false,
          view: photo.photoView || "UNASSIGNED",
        })),
    );
    setOpen(true);
    try {
      const config = await referralRequest<{ available: boolean }>(
        `/${record.id}/crop-config`,
      );
      setAvailable(config.available);
    } catch {
      setMessage(
        "No se pudo consultar la propuesta automática. Puedes recortar manualmente.",
      );
    }
  }
  async function load(row: Row): Promise<DentalImage> {
    if (row.image) return row.image;
    const response = await fetch(
      `${API_URL}/referrals/${record.id}/files/${row.photo.id}`,
      { credentials: "include", cache: "no-store" },
    );
    if (!response.ok)
      throw new Error("No se pudo cargar el original. Actualiza el caso.");
    const blob = await response.blob();
    const file = new File([blob], "original", { type: blob.type });
    return {
      id: row.photo.id,
      batchId: record.id,
      file,
      editSource: file,
      previewUrl: own(URL.createObjectURL(blob)),
      status: "idle",
      format: "image/jpeg",
    };
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
      for (const [index, row] of selected.entries()) {
        setMessage(`Preparando ${index + 1} de ${selected.length}…`);
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
                ? { ...r, image, reviewed: false, error: image.error }
                : r,
            ),
          );
        } catch (e) {
          setRows((current) =>
            current.map((r) =>
              r.photo.id === row.photo.id
                ? {
                    ...r,
                    error:
                      e instanceof Error ? e.message : "No se pudo preparar.",
                  }
                : r,
            ),
          );
        }
      }
      setMessage(
        "Propuestas preparadas. Abre cada imagen para revisar el encuadre y la orientación antes de guardarla.",
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
        <DialogContent className="min-w-0 sm:max-w-5xl">
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((row) => (
              <article
                key={row.photo.id}
                className="space-y-3 rounded-xl border bg-card p-4"
              >
                <label className="flex items-start gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={row.selected}
                    disabled={busy || row.saved}
                    onChange={(e) =>
                      setRows((current) =>
                        current.map((r) =>
                          r.photo.id === row.photo.id
                            ? { ...r, selected: e.target.checked }
                            : r,
                        ),
                      )
                    }
                  />
                  <span className="break-all">{row.photo.name}</span>
                </label>
                {row.image ? (
                  /* eslint-disable-next-line @next/next/no-img-element */ <img
                    src={row.image.resultUrl || row.image.previewUrl}
                    alt="Recorte propuesto para revisar"
                    className="h-36 w-full rounded-lg bg-muted object-contain"
                  />
                ) : (
                  <div className="flex h-24 items-center justify-center rounded-lg bg-secondary/40 text-sm text-muted-foreground">
                    Original disponible
                  </div>
                )}
                <p className="text-xs font-semibold text-primary">
                  {row.saved
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
                <label className="block text-xs">
                  Vista de la fotografía
                  <select
                    className="mt-1 block w-full rounded-lg border bg-card p-2 text-sm"
                    value={row.view}
                    disabled={busy || row.saved}
                    onChange={(e) =>
                      setRows((current) =>
                        current.map((r) =>
                          r.photo.id === row.photo.id
                            ? { ...r, view: e.target.value }
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
                  className="w-full"
                  disabled={busy || row.saved}
                  onClick={() => void edit(row)}
                >
                  Revisar / recortar
                </Button>
              </article>
            ))}
          </div>
          <Button
            className={`${primaryAction} h-auto min-h-10 whitespace-normal`}
            disabled={
              busy || !rows.some((r) => r.selected && r.reviewed && !r.saved)
            }
            onClick={() => void save()}
          >
            {busy
              ? "Procesando…"
              : `Guardar seleccionados revisados (${rows.filter((r) => r.selected && r.reviewed && !r.saved).length})`}
          </Button>
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
