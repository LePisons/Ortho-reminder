"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Box,
  Camera,
  FileText,
  ImagePlus,
  Loader2,
  Plus,
  Scan,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ASSET_ROLE,
  EXTERNAL_PHOTO_SLOTS,
  XRAY_CATEGORY,
  categoryLabel,
} from "@/lib/photo-categories";
import {
  Presentation,
  PresentationAsset,
  PresentationsApi,
  assetFileUrl,
} from "@/lib/api/presentations.api";
import { isPdf, pdfPagesToImages } from "@/lib/pdf-to-images";
import { autoGenerateExternalSlides } from "./auto-generate";

/** Analyses clinicians here actually ask for, offered as autocomplete. */
const ANALYSIS_SUGGESTIONS = [
  "Ricketts",
  "Steiner",
  "Wits",
  "McNamara",
  "Jarabak",
  "Tweed",
];

const XRAY_SLOTS = [XRAY_CATEGORY.PANORAMIC, XRAY_CATEGORY.LATERAL];

const formatSize = (bytes: number) =>
  bytes > 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;

// ─── One record slot ────────────────────────────────────────────────────────

interface SlotProps {
  label: string;
  asset?: PresentationAsset;
  uploading: boolean;
  accept: string;
  onPick: (file: File) => void;
  onRemove: () => void;
  /** STL has nothing to show; the file's name and weight stand in. */
  variant?: "image" | "file";
}

function Slot({
  label,
  asset,
  uploading,
  accept,
  onPick,
  onRemove,
  variant = "image",
}: SlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-1">
      <div
        className={`group relative flex aspect-square items-center justify-center overflow-hidden rounded-xl border-2 transition-colors ${
          asset
            ? "border-[#6469FC]/40 bg-white"
            : "border-dashed border-gray-300 bg-gray-50 hover:border-[#6469FC] hover:bg-[#6469FC]/5"
        }`}
      >
        {uploading ? (
          <Loader2 className="h-6 w-6 animate-spin text-[#6469FC]" />
        ) : asset ? (
          <>
            {variant === "image" ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={assetFileUrl(asset.id)}
                alt={label}
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center gap-1 text-gray-500">
                <Box className="h-7 w-7 text-[#6469FC]" />
                <span className="text-[11px]">{formatSize(asset.size)}</span>
              </div>
            )}
            <button
              type="button"
              onClick={onRemove}
              title="Quitar"
              className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-gray-400"
          >
            {variant === "image" ? (
              <Camera className="h-6 w-6" />
            ) : (
              <Box className="h-6 w-6" />
            )}
            <span className="text-[11px]">Subir</span>
          </button>
        )}
      </div>
      <p className="truncate text-center text-xs text-gray-600" title={label}>
        {label}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  hint,
  children,
}: {
  icon: typeof Camera;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-white p-5">
      <div className="mb-4 flex items-baseline gap-2">
        <Icon className="h-4 w-4 shrink-0 translate-y-0.5 text-[#6469FC]" />
        <h2 className="font-bold">{title}</h2>
        {hint && <p className="text-xs text-gray-500">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

// ─── Page body ──────────────────────────────────────────────────────────────

export function ExternalCaseIntake() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [deck, setDeck] = useState<Presentation | null>(null);
  const [assets, setAssets] = useState<PresentationAsset[]>([]);
  const [creating, setCreating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [analysisLabel, setAnalysisLabel] = useState(ANALYSIS_SUGGESTIONS[0]);
  /** Roles with an upload in flight — one slot can be busy while others aren't. */
  const [busy, setBusy] = useState<string[]>([]);
  const extraRef = useRef<HTMLInputElement>(null);
  const analysisRef = useRef<HTMLInputElement>(null);

  const byRole = (role: string) => assets.filter((a) => a.role === role);
  const first = (role: string) => byRole(role)[0];
  const isBusy = (role: string) => busy.includes(role);

  const start = async () => {
    const subject = name.trim();
    if (!subject) return;
    setCreating(true);
    try {
      // The deck is created up front so every upload has somewhere to live;
      // an abandoned case is just an empty presentation in the list.
      setDeck(
        await PresentationsApi.create({ subjectName: subject, title: subject })
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const renameCase = async () => {
    const subject = name.trim();
    if (!deck || !subject || subject === deck.subjectName) return;
    try {
      setDeck(
        await PresentationsApi.update(deck.id, {
          subjectName: subject,
          title: subject,
        })
      );
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  /** Upload one file into a role. PDFs become one image per page. */
  const upload = async (file: File, role: string, label?: string) => {
    if (!deck) return;
    setBusy((b) => [...b, role]);
    try {
      const uploaded: PresentationAsset[] = [];
      if (isPdf(file)) {
        const pages = await pdfPagesToImages(file);
        for (const [i, page] of pages.entries()) {
          uploaded.push(
            await PresentationsApi.uploadAsset(
              page,
              deck.id,
              `${file.name.replace(/\.pdf$/i, "")}-${i + 1}.png`,
              {
                role,
                label:
                  pages.length > 1 && label
                    ? `${label} (${i + 1}/${pages.length})`
                    : label,
              }
            )
          );
        }
      } else {
        uploaded.push(
          await PresentationsApi.uploadAsset(file, deck.id, file.name, {
            role,
            label,
          })
        );
      }
      setAssets((prev) => [...prev, ...uploaded]);
    } catch (e) {
      toast.error((e as Error).message || "No se pudo subir el archivo");
    } finally {
      setBusy((b) => b.filter((r) => r !== role));
    }
  };

  /** Single-slot roles replace rather than accumulate. */
  const uploadSingle = async (file: File, role: string) => {
    const existing = first(role);
    if (existing) await remove(existing.id);
    await upload(file, role);
  };

  const remove = async (assetId: string) => {
    setAssets((prev) => prev.filter((a) => a.id !== assetId));
    try {
      await PresentationsApi.removeAsset(assetId);
    } catch {
      // The file is already gone from the deck's records as far as the user is
      // concerned; a stray object in storage isn't worth an error toast.
    }
  };

  const generate = async () => {
    if (!deck) return;
    setGenerating(true);
    try {
      const slides = autoGenerateExternalSlides({
        subjectName: name.trim() || "Caso externo",
        assets,
      });
      await PresentationsApi.update(deck.id, { slides });
      toast.success(`${slides.length} diapositivas creadas`);
      router.push(`/presentaciones/${deck.id}`);
    } catch (e) {
      toast.error((e as Error).message);
      setGenerating(false);
    }
  };

  // ── Step 1: name the case ────────────────────────────────────────────────

  if (!deck) {
    return (
      <div className="mx-auto max-w-lg space-y-6 py-10">
        <div>
          <h1 className="text-2xl font-bold">Nuevo caso externo</h1>
          <p className="mt-1 text-sm text-gray-500">
            Arma una presentación para alguien que no está registrado como
            paciente: subes sus registros aquí y se quedan dentro de la
            presentación.
          </p>
        </div>
        <div className="space-y-3 rounded-2xl border bg-white p-6">
          <label className="text-xs font-semibold text-gray-500">
            Nombre del caso
          </label>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && start()}
            placeholder="Ej: Camila Rojas"
          />
          <Button
            onClick={start}
            disabled={!name.trim() || creating}
            className="w-full bg-gradient-to-r from-[#A066F8] to-[#6469FC] text-white"
          >
            {creating ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-1.5 h-4 w-4" />
            )}
            Continuar
          </Button>
        </div>
      </div>
    );
  }

  // ── Step 2: the records ──────────────────────────────────────────────────

  const analyses = byRole(ASSET_ROLE.CEPH_ANALYSIS);
  const extras = byRole(ASSET_ROLE.EXTRA_PHOTO);

  return (
    <div className="space-y-5 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => router.push("/presentaciones")}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Presentaciones
          </Button>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={renameCase}
            className="h-9 w-56 font-semibold"
          />
        </div>
        <Button
          onClick={generate}
          disabled={generating || assets.length === 0}
          title={
            assets.length === 0
              ? "Sube al menos un registro para armar la presentación"
              : undefined
          }
          className="bg-gradient-to-r from-[#A066F8] to-[#6469FC] text-white"
        >
          {generating ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-1.5 h-4 w-4" />
          )}
          Generar presentación
        </Button>
      </div>

      <Section
        icon={Camera}
        title="Fotografías"
        hint="La misma serie que usamos con los pacientes."
      >
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {EXTERNAL_PHOTO_SLOTS.map((role) => (
            <Slot
              key={role}
              label={categoryLabel(role)}
              asset={first(role)}
              uploading={isBusy(role)}
              accept="image/*"
              onPick={(file) => uploadSingle(file, role)}
              onRemove={() => {
                const a = first(role);
                if (a) remove(a.id);
              }}
            />
          ))}
        </div>

        <div className="mt-5 border-t pt-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-gray-500">
              Otras fotos {extras.length > 0 && `(${extras.length})`}
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={isBusy(ASSET_ROLE.EXTRA_PHOTO)}
              onClick={() => extraRef.current?.click()}
            >
              {isBusy(ASSET_ROLE.EXTRA_PHOTO) ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <ImagePlus className="mr-1.5 h-4 w-4" />
              )}
              Agregar
            </Button>
            <input
              ref={extraRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={async (e) => {
                const files = [...(e.target.files ?? [])];
                e.target.value = "";
                for (const file of files) {
                  await upload(file, ASSET_ROLE.EXTRA_PHOTO);
                }
              }}
            />
          </div>
          {extras.length === 0 ? (
            <p className="text-xs text-gray-400">
              Sonrisa antigua, primeros planos, lo que necesites mostrar.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6 lg:grid-cols-8">
              {extras.map((asset) => (
                <div
                  key={asset.id}
                  className="group relative aspect-square overflow-hidden rounded-xl border bg-white"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={assetFileUrl(asset.id)}
                    alt=""
                    className="h-full w-full object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => remove(asset.id)}
                    className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Section>

      <Section icon={Scan} title="Radiografías">
        <div className="grid grid-cols-2 gap-3 sm:max-w-md">
          {XRAY_SLOTS.map((role) => (
            <Slot
              key={role}
              label={categoryLabel(role)}
              asset={first(role)}
              uploading={isBusy(role)}
              accept="image/*,application/pdf"
              onPick={(file) => uploadSingle(file, role)}
              onRemove={() => {
                const a = first(role);
                if (a) remove(a.id);
              }}
            />
          ))}
        </div>
      </Section>

      <Section
        icon={FileText}
        title="Análisis cefalométrico"
        hint="Imagen o PDF; cada página queda como una diapositiva."
      >
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <label className="text-xs text-gray-500">Análisis</label>
            <Input
              value={analysisLabel}
              onChange={(e) => setAnalysisLabel(e.target.value)}
              list="analysis-suggestions"
              className="h-9 w-44"
              placeholder="Ricketts"
            />
            <datalist id="analysis-suggestions">
              {ANALYSIS_SUGGESTIONS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <Button
            variant="outline"
            disabled={isBusy(ASSET_ROLE.CEPH_ANALYSIS)}
            onClick={() => analysisRef.current?.click()}
          >
            {isBusy(ASSET_ROLE.CEPH_ANALYSIS) ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-1.5 h-4 w-4" />
            )}
            Subir análisis
          </Button>
          <input
            ref={analysisRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file)
                upload(
                  file,
                  ASSET_ROLE.CEPH_ANALYSIS,
                  analysisLabel.trim() || undefined
                );
            }}
          />
        </div>

        {analyses.length > 0 && (
          <ul className="mt-4 space-y-2">
            {analyses.map((asset) => (
              <li
                key={asset.id}
                className="flex items-center gap-3 rounded-lg border p-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={assetFileUrl(asset.id)}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded bg-gray-50 object-contain"
                />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {asset.label || "Análisis"}
                </span>
                <span className="shrink-0 text-xs text-gray-400">
                  {formatSize(asset.size)}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-500 hover:bg-red-50"
                  onClick={() => remove(asset.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        icon={Box}
        title="Modelos 3D"
        hint="Opcional — archivos STL del escáner, girables durante la presentación."
      >
        <div className="grid grid-cols-2 gap-3 sm:max-w-xs">
          {(
            [
              { role: ASSET_ROLE.MODEL_UPPER, label: "Superior" },
              { role: ASSET_ROLE.MODEL_LOWER, label: "Inferior" },
            ] as const
          ).map(({ role, label }) => (
            <Slot
              key={role}
              variant="file"
              label={label}
              asset={first(role)}
              uploading={isBusy(role)}
              accept=".stl,model/stl"
              onPick={(file) => uploadSingle(file, role)}
              onRemove={() => {
                const a = first(role);
                if (a) remove(a.id);
              }}
            />
          ))}
        </div>
      </Section>
    </div>
  );
}
