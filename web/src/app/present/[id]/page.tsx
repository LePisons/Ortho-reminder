"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleDot,
  DraftingCompass,
  Eraser,
  Loader2,
  Maximize,
  Minimize,
  Minus,
  MousePointer2,
  Pencil,
  Save,
  Square,
  Type,
  X,
} from "lucide-react";
import { API_URL } from "@/lib/utils";
import { ModelSet } from "@/lib/types";
import {
  Presentation,
  PresentationsApi,
  Slide,
} from "@/lib/api/presentations.api";
import { SlideCanvas } from "@/components/features/presentations/slide-canvas";
import {
  ANNOTATION_COLORS,
  Tool,
} from "@/components/features/presentations/annotation-layer";

const DRAW_TOOLS: { id: Tool; label: string; icon: typeof Circle; key: string }[] =
  [
    { id: "select", label: "Puntero", icon: MousePointer2, key: "v" },
    { id: "arrow", label: "Flecha", icon: ArrowUpRight, key: "a" },
    { id: "line", label: "Línea recta", icon: Minus, key: "n" },
    { id: "point", label: "Punto", icon: CircleDot, key: "o" },
    {
      id: "angle",
      label: "Medir ángulo (3 clics)",
      icon: DraftingCompass,
      key: "g",
    },
    { id: "ellipse", label: "Círculo", icon: Circle, key: "c" },
    { id: "rect", label: "Rectángulo", icon: Square, key: "r" },
    { id: "freehand", label: "Lápiz", icon: Pencil, key: "p" },
    { id: "label", label: "Texto", icon: Type, key: "t" },
  ];

export default function PresentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [deck, setDeck] = useState<Presentation | null>(null);
  const [modelSets, setModelSets] = useState<ModelSet[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [tool, setTool] = useState<Tool>("select");
  const [color, setColor] = useState(ANNOTATION_COLORS[0].value);
  // Laser: marks fade on their own and are never written to the deck. This is
  // the default while presenting — you point at things far more often than you
  // want to permanently annotate a slide mid-consultation.
  const [laser, setLaser] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [uiVisible, setUiVisible] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const slides = deck?.slides ?? [];
  const current = slides[index];

  // ── Load ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const loaded = await PresentationsApi.get(id);
        setDeck(loaded);
        // An external case has no chart: its scans are deck assets, which the
        // slide reads by id on its own.
        if (loaded.patientId) {
          const res = await fetch(
            `${API_URL}/model-sets?patientId=${loaded.patientId}`,
            { credentials: "include" }
          );
          if (res.ok) setModelSets(await res.json());
        }
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [id]);

  // ── Navigation ───────────────────────────────────────────────────────────
  const go = useCallback(
    (delta: number) =>
      setIndex((i) => Math.min(slides.length - 1, Math.max(0, i + delta))),
    [slides.length]
  );

  const toggleFullscreen = useCallback(async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen().catch(() => {});
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const patchSlide = useCallback(
    (slideIndex: number, patch: Partial<Slide>) => {
      setDeck((prev) =>
        prev
          ? {
              ...prev,
              slides: prev.slides.map((s, i) =>
                i === slideIndex ? { ...s, ...patch } : s
              ),
            }
          : prev
      );
      setDirty(true);
    },
    []
  );

  const save = useCallback(async () => {
    if (!deck) return;
    setSaving(true);
    try {
      await PresentationsApi.update(deck.id, { slides: deck.slides });
      setDirty(false);
      toast.success("Marcas guardadas");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }, [deck]);

  // ── Keyboard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;

      switch (e.key) {
        case "ArrowRight":
        case "PageDown":
        case " ":
          e.preventDefault();
          go(1);
          return;
        case "ArrowLeft":
        case "PageUp":
          e.preventDefault();
          go(-1);
          return;
        case "Home":
          setIndex(0);
          return;
        case "End":
          setIndex(slides.length - 1);
          return;
        case "f":
          toggleFullscreen();
          return;
        case "l":
          setLaser((l) => !l);
          return;
        case "s":
          if (dirty) save();
          return;
        case "Escape":
          // The browser eats the first Escape to leave fullscreen; a second
          // one closes the presenter.
          if (!document.fullscreenElement) router.back();
          return;
      }

      const shortcut = DRAW_TOOLS.find((t) => t.key === e.key);
      if (shortcut) setTool(shortcut.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, slides.length, toggleFullscreen, router, dirty, save]);

  // Chrome stays out of the way until the mouse moves.
  useEffect(() => {
    const onMove = () => {
      setUiVisible(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setUiVisible(false), 2800);
    };
    onMove();
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-[#1B1B1B] text-white">
        <p className="text-sm text-red-400">{error}</p>
        <button
          onClick={() => router.back()}
          className="rounded-lg border border-white/20 px-4 py-2 text-sm hover:bg-white/10"
        >
          Volver
        </button>
      </div>
    );
  }

  if (!deck) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#1B1B1B]">
        <Loader2 className="h-8 w-8 animate-spin text-[#6469FC]" />
      </div>
    );
  }

  if (!current) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-[#1B1B1B] text-white">
        <p className="text-sm text-white/60">
          Esta presentación no tiene diapositivas.
        </p>
        <button
          onClick={() => router.back()}
          className="rounded-lg border border-white/20 px-4 py-2 text-sm hover:bg-white/10"
        >
          Volver
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-[#0d0d0d]">
      {/* Slide stage — letterboxed so 16:9 always fits without cropping. */}
      <div className="flex min-h-0 flex-1 items-center justify-center p-2 sm:p-6">
        <div className="w-full max-w-[calc((100vh-4rem)*16/9)] shadow-2xl">
          <SlideCanvas
            key={current.id}
            slide={current}
            modelSets={modelSets}
            patientName={deck.title}
            interactive3d
            tool={tool}
            color={color}
            strokeWidth={9}
            ephemeralAnnotations={laser}
            onAnnotationsChange={
              laser
                ? undefined
                : (annotations) => patchSlide(index, { annotations })
            }
            className="rounded-lg"
          />
        </div>
      </div>

      {/* Chrome */}
      <div
        className={`pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center p-4 transition-opacity duration-300 ${
          uiVisible ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-2xl bg-black/70 px-3 py-2 text-white backdrop-blur">
          <button
            onClick={() => go(-1)}
            disabled={index === 0}
            className="rounded-lg p-2 hover:bg-white/10 disabled:opacity-30"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="min-w-[4rem] text-center text-sm tabular-nums">
            {index + 1} / {slides.length}
          </span>
          <button
            onClick={() => go(1)}
            disabled={index === slides.length - 1}
            className="rounded-lg p-2 hover:bg-white/10 disabled:opacity-30"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div className="mx-1 h-6 w-px bg-white/20" />

          {DRAW_TOOLS.map((t) => (
            <button
              key={t.id}
              title={`${t.label} (${t.key})`}
              onClick={() => setTool(t.id)}
              className={`rounded-lg p-2 transition-colors ${
                tool === t.id
                  ? "bg-gradient-to-r from-[#A066F8] to-[#6469FC]"
                  : "hover:bg-white/10"
              }`}
            >
              <t.icon className="h-4 w-4" />
            </button>
          ))}

          {ANNOTATION_COLORS.map((c) => (
            <button
              key={c.value}
              title={c.label}
              onClick={() => setColor(c.value)}
              className={`h-5 w-5 rounded-full border-2 transition-transform ${
                color === c.value ? "scale-110 border-white" : "border-white/30"
              }`}
              style={{ backgroundColor: c.value }}
            />
          ))}

          <div className="mx-1 h-6 w-px bg-white/20" />

          <button
            title="Marcas temporales — se borran solas (l)"
            onClick={() => setLaser((l) => !l)}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
              laser
                ? "bg-gradient-to-r from-[#A066F8] to-[#6469FC]"
                : "hover:bg-white/10"
            }`}
          >
            <Eraser className="h-4 w-4" />
            Temporal
          </button>

          {dirty && (
            <button
              title="Guardar las marcas en la presentación (s)"
              onClick={save}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-white/15 px-2.5 py-2 text-xs font-medium hover:bg-white/25"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Guardar
            </button>
          )}

          <button
            title="Pantalla completa (f)"
            onClick={toggleFullscreen}
            className="rounded-lg p-2 hover:bg-white/10"
          >
            {fullscreen ? (
              <Minimize className="h-4 w-4" />
            ) : (
              <Maximize className="h-4 w-4" />
            )}
          </button>
          <button
            title="Salir"
            onClick={() => router.back()}
            className="rounded-lg p-2 hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Click-through zones for advancing without touching the toolbar. Off
          while drawing, where a click means "start a shape". */}
      {tool === "select" && (
        <>
          <button
            aria-label="Anterior"
            onClick={() => go(-1)}
            className="fixed inset-y-0 left-0 z-10 w-[12vw] cursor-w-resize"
          />
          <button
            aria-label="Siguiente"
            onClick={() => go(1)}
            className="fixed inset-y-0 right-0 z-10 w-[12vw] cursor-e-resize"
          />
        </>
      )}
    </div>
  );
}
