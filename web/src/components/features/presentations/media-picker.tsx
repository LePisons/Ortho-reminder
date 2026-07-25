"use client";

import { useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Box, Camera, Loader2, Scan, Type, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ModelSet, PatientImage } from "@/lib/types";
import { categoryLabel } from "@/lib/photo-categories";
import {
  PresentationsApi,
  SlideItem,
  slideItemUrl,
} from "@/lib/api/presentations.api";

type TabId = "PHOTO" | "XRAY" | "MODEL" | "TEXT";

const TABS: { id: TabId; label: string; icon: typeof Camera }[] = [
  { id: "PHOTO", label: "Fotos", icon: Camera },
  { id: "XRAY", label: "Radiografías", icon: Scan },
  { id: "MODEL", label: "Modelos 3D", icon: Box },
  { id: "TEXT", label: "Texto", icon: Type },
];

interface MediaPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  images: PatientImage[];
  modelSets: ModelSet[];
  /** Uploads are filed under this deck; omit to store in the slide library. */
  presentationId?: string;
  onPick: (item: SlideItem) => void;
}

export function MediaPicker({
  open,
  onOpenChange,
  images,
  modelSets,
  presentationId,
  onPick,
}: MediaPickerProps) {
  const [tab, setTab] = useState<TabId>("PHOTO");
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const sessions = useMemo(() => {
    const type = tab === "XRAY" ? "XRAY" : "PHOTO";
    const groups = new Map<string, PatientImage[]>();
    for (const img of images) {
      if (img.type !== type) continue;
      const key = format(new Date(img.date), "yyyy-MM-dd");
      const bucket = groups.get(key);
      if (bucket) bucket.push(img);
      else groups.set(key, [img]);
    }
    return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [images, tab]);

  const choose = (item: SlideItem) => {
    onPick(item);
    onOpenChange(false);
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const asset = await PresentationsApi.uploadAsset(
        file,
        presentationId,
        file.name
      );
      choose({ kind: "asset", assetId: asset.id, fit: "contain" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Elegir contenido</DialogTitle>
          <DialogDescription>
            Usa los registros del paciente o sube una imagen nueva.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-1 border-b">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                tab === t.id
                  ? "border-[#6469FC] text-[#6469FC]"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>

        <div className="max-h-[55vh] min-h-[16rem] overflow-y-auto pr-1">
          {(tab === "PHOTO" || tab === "XRAY") && (
            <div className="space-y-5">
              {sessions.length === 0 && (
                <p className="py-10 text-center text-sm text-gray-500">
                  Este paciente aún no tiene{" "}
                  {tab === "PHOTO" ? "fotos" : "radiografías"}.
                </p>
              )}
              {sessions.map(([dateKey, imgs]) => (
                <div key={dateKey}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    {format(new Date(`${dateKey}T12:00:00`), "dd/MM/yyyy")}
                  </p>
                  <div className="grid grid-cols-4 gap-3">
                    {imgs.map((img) => (
                      <button
                        key={img.id}
                        onClick={() =>
                          choose({
                            kind: "patientImage",
                            imageId: img.id,
                            fit: "contain",
                          })
                        }
                        className="group overflow-hidden rounded-lg border transition-all hover:border-[#6469FC] hover:shadow-md"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={
                            slideItemUrl({
                              kind: "patientImage",
                              imageId: img.id,
                            })!
                          }
                          alt={img.category ?? ""}
                          className="aspect-square w-full bg-gray-50 object-contain"
                        />
                        <span className="block truncate px-1.5 py-1 text-[11px] text-gray-500">
                          {categoryLabel(img.category)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "MODEL" && (
            <div className="space-y-2">
              {modelSets.length === 0 && (
                <p className="py-10 text-center text-sm text-gray-500">
                  Este paciente aún no tiene modelos 3D.
                </p>
              )}
              {modelSets.map((set) => (
                <div
                  key={set.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      {format(new Date(set.takenAt), "dd/MM/yyyy")}
                      {set.label ? ` — ${set.label}` : ""}
                    </p>
                    <p className="text-xs text-gray-500">
                      Se mostrará en vivo, girable durante la presentación.
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    {(
                      [
                        { v: "both", label: "Oclusión" },
                        { v: "upper", label: "Superior" },
                        { v: "lower", label: "Inferior" },
                      ] as const
                    ).map((o) => (
                      <Button
                        key={o.v}
                        size="sm"
                        variant="outline"
                        disabled={
                          (o.v === "upper" && !set.upperKey) ||
                          (o.v === "lower" && !set.lowerKey) ||
                          (o.v === "both" && !(set.upperKey && set.lowerKey))
                        }
                        onClick={() =>
                          choose({
                            kind: "model3d",
                            modelSetId: set.id,
                            view: o.v,
                          })
                        }
                      >
                        {o.label}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "TEXT" && (
            <div className="space-y-3 py-2">
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={5}
                placeholder="Ej: Con los alineadores moveremos primero los dientes de arriba."
              />
              <Button
                disabled={!text.trim()}
                onClick={() => {
                  choose({ kind: "text", body: text.trim() });
                  setText("");
                }}
              >
                Agregar texto
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t pt-3">
          <p className="text-xs text-gray-500">
            También puedes usar una imagen desde tu computador.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
            }}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-1.5 h-4 w-4" />
            )}
            Subir imagen
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
