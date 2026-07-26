"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { ImageOff, Loader2, Plus } from "lucide-react";
import { API_URL } from "@/lib/utils";
import { ModelSet } from "@/lib/types";
import {
  LayoutId,
  Slide,
  SlideItem,
  assetFileUrl,
  slideItemUrl,
} from "@/lib/api/presentations.api";
import { AnnotationLayer, SLIDE_H, SLIDE_W, Tool } from "./annotation-layer";

// three.js stays out of the main bundle; only slides that need it pull it in.
const StlViewer = dynamic(
  () => import("@/components/features/models/stl-viewer"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#6469FC]" />
      </div>
    ),
  }
);

/** Tailwind grid classes per layout, applied to the frame container. */
const LAYOUT_GRID: Record<LayoutId, string> = {
  title: "",
  text: "",
  full: "grid-cols-1",
  duo: "grid-cols-2",
  trio: "grid-cols-3",
  quad: "grid-cols-2 grid-rows-2",
  grid9: "grid-cols-3 grid-rows-3",
  compare: "grid-cols-2",
};

function modelFileUrl(set: ModelSet, jaw: "upper" | "lower"): string | null {
  const key = jaw === "upper" ? set.upperKey : set.lowerKey;
  return key ? `${API_URL}/model-sets/${set.id}/file?jaw=${jaw}` : null;
}

// ─── One media frame ────────────────────────────────────────────────────────

interface FrameProps {
  item: SlideItem | null;
  modelSets: ModelSet[];
  /** Render live 3D. Off for thumbnails, where dozens of WebGL contexts would
   *  exhaust the browser's limit. */
  interactive3d: boolean;
  editable: boolean;
  active: boolean;
  onClick?: () => void;
  label?: string;
}

function Frame({
  item,
  modelSets,
  interactive3d,
  editable,
  active,
  onClick,
  label,
}: FrameProps) {
  const [broken, setBroken] = useState(false);

  useEffect(() => setBroken(false), [item]);

  const ring = active
    ? "ring-4 ring-[#6469FC] ring-offset-2 ring-offset-transparent"
    : "";

  if (!item) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={!editable}
        className={`flex h-full w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300/70 bg-black/[0.02] text-gray-400 transition-colors ${
          editable ? "cursor-pointer hover:border-[#6469FC] hover:text-[#6469FC]" : ""
        } ${ring}`}
      >
        {editable && (
          <>
            <Plus className="h-8 w-8" />
            <span className="text-xl font-medium">Agregar</span>
          </>
        )}
      </button>
    );
  }

  if (item.kind === "text") {
    return (
      <div
        onClick={onClick}
        className={`flex h-full w-full items-center justify-center rounded-lg bg-black/[0.03] p-8 text-center text-3xl leading-snug ${ring}`}
      >
        {item.body}
      </div>
    );
  }

  if (item.kind === "model3d" || item.kind === "assetModel3d") {
    // A patient's scan lives in a ModelSet; an external case's is a pair of
    // STLs uploaded into the deck. Same viewer, different source.
    let upperUrl: string | null = null;
    let lowerUrl: string | null = null;
    let orientation: number[] | null | undefined;
    let key: string;

    if (item.kind === "model3d") {
      const set = modelSets.find((s) => s.id === item.modelSetId);
      if (!set) return <MissingMedia label="Escaneo no disponible" />;
      upperUrl = modelFileUrl(set, "upper");
      lowerUrl = modelFileUrl(set, "lower");
      orientation = set.orientation;
      key = `${set.id}-${item.view}`;
    } else {
      upperUrl = item.upperAssetId ? assetFileUrl(item.upperAssetId) : null;
      lowerUrl = item.lowerAssetId ? assetFileUrl(item.lowerAssetId) : null;
      if (!upperUrl && !lowerUrl)
        return <MissingMedia label="Escaneo no disponible" />;
      key = `${item.upperAssetId ?? ""}-${item.lowerAssetId ?? ""}-${item.view}`;
    }

    if (!interactive3d) {
      return (
        <div
          onClick={onClick}
          className={`flex h-full w-full flex-col items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-slate-100 to-slate-300 text-slate-500 ${ring}`}
        >
          <span className="text-2xl font-semibold">Modelo 3D</span>
        </div>
      );
    }
    return (
      <div
        onClick={onClick}
        className={`h-full w-full overflow-hidden rounded-lg ${ring}`}
      >
        <StlViewer
          key={key}
          upperUrl={upperUrl}
          lowerUrl={lowerUrl}
          orientation={orientation}
          initialView={item.view}
          compact
          fill
        />
      </div>
    );
  }

  const url = slideItemUrl(item);
  if (!url || broken) return <MissingMedia label="Imagen no disponible" />;

  return (
    <div
      onClick={onClick}
      className={`relative h-full w-full overflow-hidden rounded-lg bg-black/5 ${
        editable ? "cursor-pointer" : ""
      } ${ring}`}
    >
      {/* Plain <img>: these stream from the API with cookies, and next/image
          would proxy them through the optimizer for no benefit. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={label ?? ""}
        onError={() => setBroken(true)}
        className={`h-full w-full ${
          item.fit === "cover" ? "object-cover" : "object-contain"
        }`}
      />
    </div>
  );
}

/**
 * A slide keeps working when the record behind it changes — deleting a photo
 * mid-treatment must not break a deck you're about to present.
 */
function MissingMedia({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 text-gray-400">
      <ImageOff className="h-8 w-8" />
      <span className="text-lg">{label}</span>
    </div>
  );
}

// ─── Slide ──────────────────────────────────────────────────────────────────

export interface SlideCanvasProps {
  slide: Slide;
  modelSets?: ModelSet[];
  patientName?: string;
  /** Live-orbit 3D slides. Leave off for thumbnails. */
  interactive3d?: boolean;
  /** Show "Agregar" affordances and let frames be clicked. */
  editable?: boolean;
  activeFrame?: number | null;
  onFrameClick?: (index: number) => void;
  // Annotation layer passthrough
  tool?: Tool | null;
  color?: string;
  strokeWidth?: number;
  onAnnotationsChange?: (next: Slide["annotations"]) => void;
  selectedAnnotationId?: string | null;
  onSelectAnnotation?: (id: string | null) => void;
  ephemeralAnnotations?: boolean;
  className?: string;
}

export function SlideCanvas({
  slide,
  modelSets = [],
  patientName,
  interactive3d = false,
  editable = false,
  activeFrame = null,
  onFrameClick,
  tool = null,
  color,
  strokeWidth,
  onAnnotationsChange,
  selectedAnnotationId,
  onSelectAnnotation,
  ephemeralAnnotations,
  className,
}: SlideCanvasProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  // Everything inside is authored against a fixed 1600×900 stage and scaled to
  // fit, so type size, padding and gaps stay proportional at any display size —
  // from a 200px rail thumbnail to a projector.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setScale(entry.contentRect.width / SLIDE_W);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const dark = slide.theme === "dark";
  const isTitle = slide.layout === "title";

  return (
    <div
      ref={boxRef}
      className={`relative aspect-video w-full overflow-hidden ${
        dark ? "bg-[#1B1B1B] text-white" : "bg-white text-[#1B1B1B]"
      } ${className ?? ""}`}
    >
      {scale > 0 && (
        <div
          style={{
            width: SLIDE_W,
            height: SLIDE_H,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
          className="absolute left-0 top-0"
        >
          {isTitle ? (
            <TitleSlide slide={slide} patientName={patientName} />
          ) : slide.layout === "text" ? (
            <TextSlide slide={slide} />
          ) : (
            <div className="flex h-full flex-col px-14 pb-12 pt-12">
              {slide.title && (
                <h2 className="mb-6 shrink-0 text-5xl font-bold tracking-tight">
                  {slide.title}
                </h2>
              )}
              <div
                className={`grid min-h-0 flex-1 gap-5 ${LAYOUT_GRID[slide.layout]}`}
              >
                {slide.frames.map((item, i) => (
                  <div key={i} className="relative flex min-h-0 flex-col">
                    {slide.layout === "compare" && (
                      <span
                        className={`mb-3 self-start rounded-full px-5 py-1.5 text-2xl font-bold ${
                          i === 0
                            ? "bg-gray-200 text-gray-700"
                            : "bg-gradient-to-r from-[#A066F8] to-[#6469FC] text-white"
                        }`}
                      >
                        {slide.compareLabels?.[i] ?? (i === 0 ? "Antes" : "Ahora")}
                      </span>
                    )}
                    <div className="min-h-0 flex-1">
                      <Frame
                        item={item}
                        modelSets={modelSets}
                        interactive3d={interactive3d}
                        editable={editable}
                        active={activeFrame === i}
                        onClick={onFrameClick ? () => onFrameClick(i) : undefined}
                      />
                    </div>
                  </div>
                ))}
              </div>
              {slide.caption && (
                <p className="mt-6 shrink-0 text-3xl leading-snug text-gray-500">
                  {slide.caption}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <AnnotationLayer
        annotations={slide.annotations}
        tool={tool}
        color={color}
        width={strokeWidth}
        onChange={onAnnotationsChange}
        selectedId={selectedAnnotationId}
        onSelect={onSelectAnnotation}
        ephemeral={ephemeralAnnotations}
      />
    </div>
  );
}

// ─── Text-only layouts ──────────────────────────────────────────────────────

function TitleSlide({
  slide,
  patientName,
}: {
  slide: Slide;
  patientName?: string;
}) {
  return (
    <div className="relative flex h-full flex-col justify-center bg-gradient-to-br from-[#A066F8] to-[#6469FC] px-24 text-white">
      <Image
        src="/alnix-logo-white.svg"
        alt="Alnix"
        width={220}
        height={34}
        className="absolute right-20 top-16 h-9 w-auto opacity-90"
      />
      <h1 className="text-8xl font-bold leading-tight tracking-tight">
        {slide.title || "Tu tratamiento"}
      </h1>
      {(slide.caption || patientName) && (
        <p className="mt-8 text-4xl font-medium text-white/80">
          {slide.caption || patientName}
        </p>
      )}
    </div>
  );
}

function TextSlide({ slide }: { slide: Slide }) {
  return (
    <div className="flex h-full flex-col justify-center px-24">
      {slide.title && (
        <h2 className="mb-10 text-7xl font-bold tracking-tight">
          {slide.title}
        </h2>
      )}
      <p className="whitespace-pre-wrap text-4xl leading-relaxed text-gray-600">
        {slide.caption}
      </p>
    </div>
  );
}
