"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, Check, Images, Upload, X, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  photoViews,
  ReferralDetail,
  referralRequest,
} from "@/lib/api/referrals.api";
import { runBatch } from "@/lib/denticrop/batch";
import { DenticropWorkspace } from "./denticrop-workspace";
import { API_URL } from "@/lib/utils";
import {
  panel,
  primaryAction,
  secondaryAction,
  SectionHeading,
} from "./referral-ui";

type Photo = ReferralDetail["files"][number];
type Pending = {
  id: string;
  file: File;
  view: string;
  preview: string;
  error?: string;
  uploading?: boolean;
};

function PrivatePhoto({
  url,
  name,
  className,
}: {
  url: string;
  name: string;
  className?: string;
}) {
  const [source, setSource] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl = "";
    setSource("");
    setFailed(false);
    fetch(url, {
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return response.blob();
      })
      .then((blob) => {
        if (!controller.signal.aborted) {
          objectUrl = URL.createObjectURL(blob);
          setSource(objectUrl);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);
  if (!source)
    return (
      <span className="p-4 text-center text-xs text-foreground/65">
        {failed
          ? "No se pudo cargar la imagen. Vuelve a abrir la galería."
          : "Cargando foto…"}
      </span>
    );
  // Private authenticated blobs must not pass through an image optimization server.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={source} alt={name} className={className} />;
}

export function PhotoWorkspace({
  record,
  onRefresh,
}: {
  record: ReferralDetail;
  onRefresh: () => Promise<void>;
}) {
  const photos = record.files.filter((f) => f.kind === "PHOTO");
  const active = !record.revokedAt;
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<Pending[]>([]);
  const [targetView, setTargetView] = useState("UNASSIGNED");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Photo | null>(null);
  const localFiles = useRef(new Map<string, File>());
  const picker = useRef<HTMLInputElement>(null);
  const objectUrls = useRef(new Set<string>());
  useEffect(() => {
    const urls = objectUrls.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);
  const fileUrl = (photo: Photo) =>
    `${API_URL}/referrals/${record.id}/files/${photo.id}`;
  function choose(view: string) {
    setTargetView(view);
    picker.current?.click();
  }
  function enqueue(files: FileList | null) {
    if (!files) return;
    setError("");
    if (files.length + pending.length + record.files.length > 60) {
      setError("Máximo 60 archivos por caso. Selecciona menos fotografías.");
      return;
    }
    const valid: Pending[] = [];
    const invalid: string[] = [];
    for (const file of Array.from(files)) {
      if (
        !/\.(jpe?g|png|webp)$/i.test(file.name) ||
        file.size > 60 * 1024 * 1024 ||
        file.size === 0
      ) {
        invalid.push(file.name);
        continue;
      }
      const preview = URL.createObjectURL(file);
      objectUrls.current.add(preview);
      valid.push({ id: crypto.randomUUID(), file, view: targetView, preview });
    }
    setPending((previous) => [...previous, ...valid]);
    if (invalid.length)
      setError(
        `No se añadieron: ${invalid.join(", ")}. Usa JPG, PNG o WebP de hasta 60 MB.`,
      );
  }
  function remove(item: Pending) {
    URL.revokeObjectURL(item.preview);
    objectUrls.current.delete(item.preview);
    setPending((rows) => rows.filter((row) => row.id !== item.id));
  }
  async function upload() {
    setBusy(true);
    setError("");
    let completed = 0;
    const failed: Pending[] = [];
    let finished = 0;
    await runBatch(pending, 2, async (item) => {
      setPending((rows) =>
        rows.map((r) =>
          r.id === item.id ? { ...r, uploading: true, error: undefined } : r,
        ),
      );
      try {
        const data = new FormData();
        data.append("kind", "PHOTO");
        data.append("photoView", item.view);
        data.append("file", item.file);
        const asset = await referralRequest<Photo>(
          `/${record.id}/files`,
          "POST",
          data,
        );
        localFiles.current.set(asset.id, item.file);
        completed++;
        setPending((rows) => rows.filter((row) => row.id !== item.id));
        URL.revokeObjectURL(item.preview);
        objectUrls.current.delete(item.preview);
      } catch (e) {
        failed.push({
          ...item,
          uploading: false,
          error: e instanceof Error ? e.message : "No se pudo subir.",
        });
      } finally {
        finished++;
        setProgress(`${finished} de ${pending.length} fotos completadas`);
      }
    });
    setPending(failed);
    setProgress(
      `${completed} fotografía${completed === 1 ? "" : "s"} guardada${completed === 1 ? "" : "s"}.`,
    );
    if (failed.length)
      setError(
        "Algunas fotos no se subieron. Se conservaron en la selección para que puedas reintentarlo; las guardadas no se repetirán.",
      );
    try {
      await onRefresh();
    } catch {
      setError(
        "Las fotos guardadas se conservan. Actualiza el caso para verlas en la galería.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function classify(photo: Photo, view: string) {
    setBusy(true);
    setError("");
    try {
      await referralRequest(`/${record.id}/files/${photo.id}/view`, "PATCH", {
        photoView: view,
      });
      await onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cambiar la vista.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={panel}>
      <SectionHeading
        title="Fotografías"
        description="Organiza las vistas clínicas en una galería. Los archivos originales se conservan."
        action={
          <Button className={primaryAction} onClick={() => setOpen(true)}>
            <Images size={18} />
            Abrir galería{photos.length > 0 && ` (${photos.length})`}
          </Button>
        }
      />
      <div className="mt-5 flex flex-wrap gap-2">
        {["OCCLUSAL_UPPER", "OCCLUSAL_LOWER", "INTRAORAL_FRONT"].map((view) => (
          <span
            key={view}
            className="inline-flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-xs text-secondary-foreground"
          >
            {photos.some((p) => p.photoView === view) ? (
              <Check size={14} />
            ) : (
              <Camera size={14} />
            )}
            {photoViews[view]}
          </span>
        ))}
        <span className="self-center text-xs text-foreground/65">
          {
            photos.filter((p) => !p.photoView || p.photoView === "UNASSIGNED")
              .length
          }{" "}
          sin clasificar
        </span>
      </div>
      <DenticropWorkspace
        record={record}
        onRefresh={onRefresh}
        localFiles={localFiles.current}
      />
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!busy) setOpen(next);
        }}
      >
        <DialogContent
          className="sm:max-w-6xl bg-background p-0"
          showCloseButton={false}
        >
          <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b bg-card p-5 sm:p-7">
            <div>
              <DialogTitle className="text-xl sm:text-2xl">
                Fotografías del caso
              </DialogTitle>
              <DialogDescription className="mt-2">
                {record.fullName}. Sube todas juntas o selecciona una vista.
                Puedes cambiar su clasificación después.
              </DialogDescription>
            </div>
            <Button
              variant="outline"
              size="icon"
              disabled={busy}
              aria-label="Cerrar galería"
              onClick={() => setOpen(false)}
            >
              <X size={18} />
            </Button>
          </div>
          <div className="space-y-6 px-5 pb-6 sm:px-7">
            {error && (
              <p
                role="alert"
                className="rounded-xl bg-red-50 p-4 text-sm text-red-800"
              >
                {error}
              </p>
            )}
            {progress && (
              <p
                role="status"
                aria-live="polite"
                className="text-sm text-primary"
              >
                {progress}
              </p>
            )}
            {active && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-blue/25 bg-secondary/50 p-4">
                <div>
                  <h3 className="font-semibold">Carga múltiple</h3>
                  <p className="mt-1 text-sm text-foreground/65">
                    Selecciona varias fotos. JPG, PNG o WebP; hasta 60 MB por
                    archivo.
                  </p>
                </div>
                <Button
                  className={primaryAction}
                  disabled={busy}
                  onClick={() => choose("UNASSIGNED")}
                >
                  <Upload size={17} />
                  Seleccionar fotografías
                </Button>
                <input
                  ref={picker}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  multiple
                  className="sr-only"
                  aria-label="Seleccionar archivos de fotografías"
                  onChange={(e) => {
                    enqueue(e.target.files);
                    e.target.value = "";
                  }}
                />
              </div>
            )}
            {pending.length > 0 && (
              <section className="space-y-3 rounded-xl border bg-card p-4">
                <h3 className="font-semibold">Por subir ({pending.length})</h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {pending.map((item) => (
                    <div
                      key={item.id}
                      className="flex min-w-0 flex-col gap-3 overflow-hidden rounded-xl border bg-card p-3"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.preview}
                        alt="Vista previa del archivo seleccionado"
                        className="aspect-square w-full rounded-lg bg-[#1B1B1B] object-contain"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="break-all text-sm font-medium">
                          {item.file.name}
                        </p>
                        <p className="text-xs text-primary">
                          {item.uploading
                            ? "Subiendo…"
                            : item.error
                              ? "No se pudo subir"
                              : "En espera"}
                        </p>
                        {item.error && (
                          <p className="text-xs text-red-700">{item.error}</p>
                        )}
                      </div>
                      <select
                        aria-label={`Vista de ${item.file.name}`}
                        className="max-w-full rounded-lg border bg-card p-2 text-sm"
                        value={item.view}
                        disabled={busy}
                        onChange={(e) =>
                          setPending((rows) =>
                            rows.map((row) =>
                              row.id === item.id
                                ? { ...row, view: e.target.value }
                                : row,
                            ),
                          )
                        }
                      >
                        {Object.entries(photoViews).map(([key, label]) => (
                          <option value={key} key={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Quitar ${item.file.name} de la selección`}
                        disabled={busy}
                        onClick={() => remove(item)}
                      >
                        <X size={16} />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  className={primaryAction}
                  disabled={busy}
                  onClick={() => void upload()}
                >
                  <Upload size={17} />
                  {busy
                    ? progress
                    : `Subir ${pending.length} fotografía${pending.length === 1 ? "" : "s"}`}
                </Button>
              </section>
            )}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(photoViews)
                .filter(([key]) => key !== "UNASSIGNED")
                .map(([view, label]) => {
                  const group = photos.filter(
                    (photo) => photo.photoView === view,
                  );
                  const latest = group.at(-1);
                  return (
                    <section
                      key={view}
                      className="overflow-hidden rounded-xl border bg-card"
                    >
                      <div className="flex items-center justify-between gap-2 px-4 py-3">
                        <h3 className="text-sm font-semibold">{label}</h3>
                        {latest && <Check size={16} className="text-primary" />}
                      </div>
                      {latest ? (
                        <button
                          className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-secondary/40 focus-visible:outline-2 focus-visible:outline-primary"
                          aria-label={`Ampliar ${label}`}
                          onClick={() => setSelected(latest)}
                        >
                          <PrivatePhoto
                            url={fileUrl(latest)}
                            name={label}
                            className="h-full w-full object-contain"
                          />
                        </button>
                      ) : (
                        <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 bg-secondary/30 text-primary/70">
                          <Camera size={30} strokeWidth={1.3} />
                          <span className="text-xs">Sin fotografía</span>
                        </div>
                      )}
                      <div className="p-3">
                        {active && (
                          <Button
                            className={`${secondaryAction} w-full`}
                            disabled={busy}
                            onClick={() => choose(view)}
                          >
                            <Upload size={15} />
                            {latest ? "Añadir otra" : "Seleccionar foto"}
                          </Button>
                        )}
                        {group.length > 1 && (
                          <p className="mt-2 text-xs text-foreground/65">
                            {group.length} archivos, incluidos recortes; se
                            muestra el último.
                          </p>
                        )}
                      </div>
                    </section>
                  );
                })}
            </div>
            <section className="space-y-3">
              <h3 className="font-semibold">
                Originales y recortes ({photos.length})
              </h3>
              {photos.length === 0 && (
                <p className="text-sm text-foreground/65">
                  Las fotos aparecerán aquí después de subirlas.
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {photos.map((photo) => (
                  <div
                    key={photo.id}
                    className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="break-all text-sm font-medium">
                        {photo.name}
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Ampliar ${photo.name}`}
                        onClick={() => setSelected(photo)}
                      >
                        <ZoomIn size={17} />
                      </Button>
                    </div>
                    <p className="text-xs font-semibold text-primary">
                      {photo.sourceFileId
                        ? "Recorte revisado · original conservado"
                        : "Fotografía original"}
                    </p>
                    {photo.sourceFileId && (
                      <a
                        className="text-xs underline"
                        href={`${API_URL}/referrals/${record.id}/files/${photo.sourceFileId}`}
                      >
                        Descargar original de este recorte
                      </a>
                    )}
                    <select
                      disabled={!active || busy}
                      aria-label={`Clasificar ${photo.name}`}
                      className="w-full rounded-lg border bg-card p-2 text-sm"
                      value={photo.photoView || "UNASSIGNED"}
                      onChange={(e) => void classify(photo, e.target.value)}
                    >
                      {Object.entries(photoViews).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <a
                      className="text-sm font-medium text-primary underline underline-offset-4"
                      href={fileUrl(photo)}
                    >
                      {photo.sourceFileId
                        ? "Descargar recorte"
                        : "Descargar original"}
                    </a>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!selected}
        onOpenChange={(next) => {
          if (!next) setSelected(null);
        }}
      >
        <DialogContent className="sm:max-w-4xl bg-card">
          <DialogTitle className="break-all pr-6">{selected?.name}</DialogTitle>
          <DialogDescription>
            {photoViews[selected?.photoView || "UNASSIGNED"]}
          </DialogDescription>
          {selected && (
            <div className="flex min-h-48 items-center justify-center">
              <PrivatePhoto
                url={fileUrl(selected)}
                name={selected.name}
                className="max-h-[65vh] w-full object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
