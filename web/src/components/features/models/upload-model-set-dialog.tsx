"use client";

import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { API_URL } from "@/lib/utils";
import { ModelSet } from "@/lib/types";
import { FileUp, Loader2, X } from "lucide-react";

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

interface JawSlotProps {
  label: string;
  file: File | null;
  onSelect: (file: File | null) => void;
}

function JawSlot({ label, file, onSelect }: JawSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex-1">
      <input
        ref={inputRef}
        type="file"
        accept=".stl"
        className="hidden"
        onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
      />
      {file ? (
        <div className="border rounded-lg p-3 flex items-center justify-between gap-2 bg-gray-50">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{file.name}</p>
            <p className="text-xs text-gray-500">
              {label} • {formatBytes(file.size)}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0 h-7 w-7 p-0"
            onClick={() => {
              onSelect(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full border-2 border-dashed rounded-lg p-4 flex flex-col items-center gap-1 text-gray-500 hover:border-[#6469FC] hover:text-[#6469FC] transition-colors"
        >
          <FileUp className="w-5 h-5" />
          <span className="text-sm font-medium">{label}</span>
          <span className="text-xs">Archivo .stl</span>
        </button>
      )}
    </div>
  );
}

interface UploadModelSetDialogProps {
  patientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploaded: (set: ModelSet) => void;
}

export function UploadModelSetDialog({
  patientId,
  open,
  onOpenChange,
  onUploaded,
}: UploadModelSetDialogProps) {
  const [upper, setUpper] = useState<File | null>(null);
  const [lower, setLower] = useState<File | null>(null);
  const [takenAt, setTakenAt] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [label, setLabel] = useState("");
  const [uploading, setUploading] = useState(false);

  const reset = () => {
    setUpper(null);
    setLower(null);
    setLabel("");
    setTakenAt(new Date().toISOString().slice(0, 10));
  };

  const submit = async () => {
    if (!upper && !lower) {
      toast.error("Selecciona al menos un archivo STL (superior o inferior)");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("patientId", patientId);
      form.append("takenAt", new Date(takenAt).toISOString());
      if (label.trim()) form.append("label", label.trim());
      if (upper) form.append("upper", upper);
      if (lower) form.append("lower", lower);

      const res = await fetch(`${API_URL}/model-sets`, {
        method: "POST",
        body: form,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || "Error al subir los modelos");
      }
      const set: ModelSet = await res.json();
      toast.success("Modelos 3D guardados");
      onUploaded(set);
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !uploading && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Subir modelos 3D</DialogTitle>
          <DialogDescription>
            Exporta los STL desde tu escáner en posición de mordida para que la
            oclusión se muestre correctamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-3">
            <JawSlot label="Superior" file={upper} onSelect={setUpper} />
            <JawSlot label="Inferior" file={lower} onSelect={setLower} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="model-set-date">Fecha del escaneo</Label>
              <Input
                id="model-set-date"
                type="date"
                value={takenAt}
                onChange={(e) => setTakenAt(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="model-set-label">Etiqueta (opcional)</Label>
              <Input
                id="model-set-label"
                placeholder="Ej: Registro inicial"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={uploading}
          >
            Cancelar
          </Button>
          <Button
            onClick={submit}
            disabled={uploading || (!upper && !lower)}
            className="bg-gradient-to-r from-[#A066F8] to-[#6469FC] text-white"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Subiendo…
              </>
            ) : (
              "Subir"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
