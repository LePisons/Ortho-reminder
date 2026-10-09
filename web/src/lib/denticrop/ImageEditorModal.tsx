"use client";

import { useEffect, useRef, useState } from "react";
import type { DentalImage, ImageEdit } from "./types";
import ReactCrop, { type PercentCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import {
  X,
  RotateCcw,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Undo,
  Redo,
  Save,
  Loader2,
  Move,
  Crop as CropIcon,
  Grid3x3,
  Crosshair,
} from "lucide-react";
import messages from "./editor-messages.json";
const t = (key: keyof typeof messages) => messages[key];
import {
  drawEditedImage,
  exportEdit,
  loadEditorImage,
} from "./utils/editorCanvas";
import { fitEdit, flipEdit, panEdit } from "./utils/editorGeometry";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  image: DentalImage | null;
  onSave: (
    id: string,
    blob: Blob,
    edit: ImageEdit,
    source: Blob,
  ) => Promise<void>;
  aaoEnabled?: boolean;
}
type Size = { width: number; height: number };
function frameFor(edit: ImageEdit, size: Size): PercentCrop {
  const scale = Math.min(
    (size.width * 0.78) / edit.width,
    (size.height * 0.78) / edit.height,
  );
  const width = ((edit.width * scale) / size.width) * 100;
  const height = ((edit.height * scale) / size.height) * 100;
  return {
    unit: "%",
    x: (100 - width) / 2,
    y: (100 - height) / 2,
    width,
    height,
  };
}
const sameEdit = (a: ImageEdit, b: ImageEdit) =>
  JSON.stringify(a) === JSON.stringify(b);

export function ImageEditorModal(props: Props) {
  if (!props.isOpen || !props.image) return null;
  // A fresh draft on each opening; cancelling never changes the ready result.
  return <Editor key={props.image.id} {...props} image={props.image} />;
}

function Editor({ image, onClose, onSave }: Props & { image: DentalImage }) {
  const [source, setSource] = useState<HTMLImageElement | null>(null);
  const [edit, setEdit] = useState<ImageEdit | null>(null);
  const editRef = useRef<ImageEdit | null>(null);
  const [automatic, setAutomatic] = useState<ImageEdit | null>(null);
  const [frame, setFrame] = useState<PercentCrop>({
    unit: "%",
    x: 10,
    y: 10,
    width: 80,
    height: 80,
  });
  const [size, setSize] = useState<Size>({ width: 1, height: 1 });
  const sizeRef = useRef(size);
  const viewport = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"move" | "crop">("move");
  const [aspect, setAspect] = useState<number | undefined>();
  const [thirds, setThirds] = useState(false);
  const [crosshair, setCrosshair] = useState(false);
  const [compare, setCompare] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [baseRotation, setBaseRotation] = useState(0);
  const [past, setPast] = useState<ImageEdit[]>([]);
  const [future, setFuture] = useState<ImageEdit[]>([]);
  const gesture = useRef<ImageEdit | null>(null);
  const rotationAnchor = useRef<ImageEdit | null>(null);
  const drag = useRef<{
    x: number;
    y: number;
    edit: ImageEdit;
    scale: number;
  } | null>(null);
  const sourceBlob =
    image.editSource ||
    (image.edit ? image.file : image.resultBlob || image.file);

  useEffect(() => {
    let cancelled = false;
    // Legacy results are already transformed; do not reapply legacy angles.
    const url = URL.createObjectURL(sourceBlob);
    loadEditorImage(url)
      .then((img) => {
        if (cancelled) return;
        const fallback: ImageEdit = {
          centerX: img.naturalWidth / 2,
          centerY: img.naturalHeight / 2,
          width: img.naturalWidth,
          height: img.naturalHeight,
          rotation: 0,
          flipX: false,
          flipY: false,
        };
        const initial = image.edit || fallback;
        setAutomatic(image.automaticEdit || initial);
        editRef.current = initial;
        setSource(img);
        setEdit(initial);
        setFrame(frameFor(initial, sizeRef.current));
        setAspect(initial.width / initial.height);
        setBaseRotation(Math.round(initial.rotation / 90) * 90);
      })
      .catch(() => {
        if (!cancelled) setError(t("loadError"));
      });
    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
  }, [image, sourceBlob, t]);

  useEffect(() => {
    if (!viewport.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width < 1 || height < 1) return;
      const next = { width, height };
      sizeRef.current = next;
      setSize(next);
      if (editRef.current) setFrame(frameFor(editRef.current, next));
    });
    observer.observe(viewport.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);

  useEffect(() => {
    if (!source || !edit || !canvas.current) return;
    const target = canvas.current;
    const request = requestAnimationFrame(() => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      target.width = Math.round(size.width * dpr);
      target.height = Math.round(size.height * dpr);
      const ctx = target.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      ctx.fillStyle = "#181818";
      ctx.fillRect(0, 0, size.width, size.height);
      const shown = compare ? automatic! : edit;
      const shownFrame = compare ? frameFor(shown, size) : frame;
      const scale = ((shownFrame.width / 100) * size.width) / shown.width;
      drawEditedImage(
        ctx,
        source,
        shown,
        ((shownFrame.x + shownFrame.width / 2) / 100) * size.width,
        ((shownFrame.y + shownFrame.height / 2) / 100) * size.height,
        scale,
      );
    });
    return () => cancelAnimationFrame(request);
  }, [source, edit, frame, size, compare, automatic]);

  function remember(previous: ImageEdit, next: ImageEdit) {
    if (sameEdit(previous, next)) return;
    setPast((items) => [...items.slice(-99), previous]);
    setFuture([]);
  }
  function update(
    next: ImageEdit,
    record = true,
    reframe = false,
    rotating = false,
  ) {
    if (!source || !editRef.current) return;
    const fitted = fitEdit(next, source.naturalWidth, source.naturalHeight);
    if (!rotating) rotationAnchor.current = null;
    if (record) remember(editRef.current, fitted);
    editRef.current = fitted;
    setEdit(fitted);
    if (reframe) setFrame(frameFor(fitted, sizeRef.current));
  }
  function beginGesture() {
    gesture.current ??= editRef.current;
  }
  function endGesture() {
    if (gesture.current && editRef.current)
      remember(gesture.current, editRef.current);
    gesture.current = null;
  }
  function restore(next: ImageEdit) {
    rotationAnchor.current = null;
    editRef.current = next;
    setEdit(next);
    setFrame(frameFor(next, sizeRef.current));
    setBaseRotation(Math.round(next.rotation / 90) * 90);
    setAspect(next.width / next.height);
  }
  function undo() {
    if (!past.length || !edit) return;
    setFuture((items) => [...items, edit]);
    setPast(past.slice(0, -1));
    restore(past[past.length - 1]);
  }
  function redo() {
    if (!future.length || !edit) return;
    setPast((items) => [...items, edit]);
    setFuture(future.slice(0, -1));
    restore(future[future.length - 1]);
  }
  function rotate(degrees: number) {
    if (!edit) return;
    update(
      {
        ...edit,
        rotation: edit.rotation + degrees,
        width: edit.height,
        height: edit.width,
      },
      true,
      true,
    );
    setBaseRotation((value) => value + degrees);
    if (aspect) setAspect(1 / aspect);
  }
  function changeCrop(next: PercentCrop) {
    if (!edit || next.width < 2 || next.height < 2) return;
    beginGesture();
    const scale = ((frame.width / 100) * size.width) / edit.width;
    const dx =
      (((next.x + next.width / 2 - frame.x - frame.width / 2) / 100) *
        size.width) /
      scale;
    const dy =
      (((next.y + next.height / 2 - frame.y - frame.height / 2) / 100) *
        size.height) /
      scale;
    const proposed = {
      ...panEdit(edit, dx, dy),
      width: ((next.width / 100) * size.width) / scale,
      height: ((next.height / 100) * size.height) / scale,
    };
    const fitted = fitEdit(
      proposed,
      source!.naturalWidth,
      source!.naturalHeight,
    );
    // Stop a handle at source boundaries without moving the photograph.
    if (
      Math.abs(fitted.width - proposed.width) > 0.01 ||
      Math.abs(fitted.height - proposed.height) > 0.01 ||
      Math.abs(fitted.centerX - proposed.centerX) > 0.01 ||
      Math.abs(fitted.centerY - proposed.centerY) > 0.01
    )
      return;
    setFrame(next);
    update(proposed, false);
  }
  async function save() {
    if (!source || !edit || saving) return;
    setSaving(true);
    setError("");
    try {
      const blob =
        image.resultBlob && image.edit && sameEdit(image.edit, edit)
          ? image.resultBlob
          : await exportEdit(source, edit, image.format || "image/jpeg");
      await onSave(image.id, blob, edit, sourceBlob);
      onClose();
    } catch {
      setError(t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  const button =
    "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-white/85 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-violet-400 disabled:opacity-35 disabled:cursor-not-allowed";
  const zoom =
    edit && automatic
      ? Math.sqrt(
          (automatic.width * automatic.height) / (edit.width * edit.height),
        )
      : 1;
  const busy = saving || !edit || compare;
  return (
    <div className="fixed inset-0 z-[100] bg-black/80 p-2 sm:p-5 flex items-center justify-center">
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-title"
        tabIndex={-1}
        className="w-full max-w-7xl h-[95dvh] bg-[#202020] text-white rounded-xl flex flex-col overflow-hidden shadow-2xl outline-none"
        onKeyDown={(event) => {
          if (event.key === "Escape" && !saving) onClose();
          if (
            (event.ctrlKey || event.metaKey) &&
            event.key.toLowerCase() === "z" &&
            !busy
          ) {
            event.preventDefault();
            if (event.shiftKey) redo();
            else undo();
          }
          if (event.key === "Tab") {
            const focusable = dialog.current?.querySelectorAll<HTMLElement>(
              "button:not(:disabled), input:not(:disabled), select:not(:disabled)",
            );
            if (!focusable?.length) return;
            const first = focusable[0],
              last = focusable[focusable.length - 1];
            if (
              event.shiftKey &&
              (document.activeElement === first ||
                document.activeElement === dialog.current)
            ) {
              event.preventDefault();
              last.focus();
            } else if (
              !event.shiftKey &&
              (document.activeElement === last ||
                document.activeElement === dialog.current)
            ) {
              event.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10">
          <div className="min-w-0">
            <h2 id="editor-title" className="font-semibold">
              {t("title")}
            </h2>
            <p className="text-xs text-white/55 truncate">
              {image.customName || image.file.name}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className={button}
              disabled={busy || !past.length}
              onClick={undo}
              title={t("undo")}
              aria-label={t("undo")}
            >
              <Undo size={19} />
            </button>
            <button
              type="button"
              className={button}
              disabled={busy || !future.length}
              onClick={redo}
              title={t("redo")}
              aria-label={t("redo")}
            >
              <Redo size={19} />
            </button>
            <button
              type="button"
              className={button}
              disabled={saving}
              onClick={onClose}
              aria-label={t("cancel")}
            >
              <X size={21} />
            </button>
          </div>
        </header>
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-auto">
          <div className="flex-1 flex flex-col min-w-0 min-h-[260px]">
            <div
              ref={viewport}
              className="relative flex-1 min-h-[220px] overflow-hidden bg-[#181818]"
              style={{ touchAction: "none" }}
              onPointerDown={(event) => {
                if (mode !== "move" || busy || !edit) return;
                event.preventDefault();
                beginGesture();
                event.currentTarget.setPointerCapture(event.pointerId);
                drag.current = {
                  x: event.clientX,
                  y: event.clientY,
                  edit,
                  scale: ((frame.width / 100) * size.width) / edit.width,
                };
              }}
              onPointerMove={(event) => {
                if (!drag.current) return;
                const start = drag.current;
                update(
                  panEdit(
                    start.edit,
                    -(event.clientX - start.x) / start.scale,
                    -(event.clientY - start.y) / start.scale,
                  ),
                  false,
                );
              }}
              onPointerUp={() => {
                drag.current = null;
                endGesture();
              }}
              onPointerCancel={() => {
                drag.current = null;
                endGesture();
              }}
            >
              {!edit && !error ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2
                    className="animate-spin"
                    aria-label={t("applying")}
                  />
                </div>
              ) : null}
              <ReactCrop
                crop={compare && automatic ? frameFor(automatic, size) : frame}
                onChange={(_, next) => changeCrop(next)}
                onComplete={endGesture}
                aspect={aspect}
                disabled={mode === "move" || busy}
                ruleOfThirds={thirds}
                className={mode === "move" ? "!cursor-grab" : ""}
                renderSelectionAddon={() =>
                  crosshair ? (
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute left-1/2 inset-y-0 w-px bg-cyan-300/80" />
                      <div className="absolute top-1/2 inset-x-0 h-px bg-cyan-300/80" />
                    </div>
                  ) : null
                }
              >
                <canvas
                  ref={canvas}
                  aria-label={t("preview")}
                  style={{
                    width: size.width,
                    height: size.height,
                    display: "block",
                  }}
                />
              </ReactCrop>
            </div>
            <p className="text-center text-xs text-white/60 px-4 py-2">
              {compare
                ? t("comparing")
                : mode === "move"
                  ? t("panHint")
                  : t("cropHint")}
            </p>
          </div>
          <fieldset
            disabled={busy}
            className="lg:w-72 shrink-0 border-t lg:border-t-0 lg:border-l border-white/10 p-4 space-y-5 overflow-y-auto"
          >
            <div className="flex rounded-lg bg-black/20 p-1">
              <button
                type="button"
                className={`${button} flex-1 ${mode === "move" ? "bg-white/15" : ""}`}
                aria-pressed={mode === "move"}
                onClick={() => setMode("move")}
              >
                <Move size={17} />
                {t("move")}
              </button>
              <button
                type="button"
                className={`${button} flex-1 ${mode === "crop" ? "bg-white/15" : ""}`}
                aria-pressed={mode === "crop"}
                onClick={() => setMode("crop")}
              >
                <CropIcon size={17} />
                {t("crop")}
              </button>
            </div>
            <label className="block text-sm space-y-2">
              <span>
                {t("rotation")}{" "}
                <span className="float-right tabular-nums">
                  {edit ? (edit.rotation - baseRotation).toFixed(1) : "0.0"}°
                </span>
              </span>
              <input
                aria-label={t("rotation")}
                className="w-full accent-violet-400"
                type="range"
                min="-45"
                max="45"
                step="0.1"
                value={edit ? edit.rotation - baseRotation : 0}
                onPointerDown={beginGesture}
                onPointerUp={endGesture}
                onPointerCancel={endGesture}
                onKeyDown={beginGesture}
                onKeyUp={endGesture}
                onBlur={endGesture}
                onChange={(event) => {
                  beginGesture();
                  if (edit) {
                    rotationAnchor.current ??= edit;
                    update(
                      {
                        ...rotationAnchor.current,
                        rotation: baseRotation + Number(event.target.value),
                      },
                      false,
                      false,
                      true,
                    );
                  }
                }}
              />
            </label>
            <label className="block text-sm space-y-2">
              <span>
                {t("zoom")}{" "}
                <span className="float-right tabular-nums">
                  {zoom.toFixed(2)}×
                </span>
              </span>
              <input
                aria-label={t("zoom")}
                className="w-full accent-violet-400"
                type="range"
                min="0.25"
                max={Math.max(4, zoom)}
                step="0.01"
                value={zoom}
                onPointerDown={beginGesture}
                onPointerUp={endGesture}
                onPointerCancel={endGesture}
                onKeyDown={beginGesture}
                onKeyUp={endGesture}
                onBlur={endGesture}
                onChange={(event) => {
                  beginGesture();
                  if (edit) {
                    const factor = zoom / Number(event.target.value);
                    update(
                      {
                        ...edit,
                        width: edit.width * factor,
                        height: edit.height * factor,
                      },
                      false,
                    );
                  }
                }}
              />
            </label>
            <label className="block text-sm space-y-2">
              <span>{t("aspect")}</span>
              <select
                aria-label={t("aspect")}
                className="block w-full bg-[#333333] rounded-lg px-3 py-2"
                value={aspect === undefined ? "free" : "current"}
                onChange={(event) => {
                  if (!edit) return;
                  if (event.target.value === "free") {
                    setAspect(undefined);
                    return;
                  }
                  const ratio =
                    event.target.value === "auto"
                      ? automatic!.width / automatic!.height
                      : Number(event.target.value);
                  setAspect(ratio);
                  update(
                    {
                      ...edit,
                      width: Math.max(edit.width, edit.height * ratio),
                      height: Math.max(edit.height, edit.width / ratio),
                    },
                    true,
                    true,
                  );
                }}
              >
                {aspect !== undefined && (
                  <option value="current">
                    {t("locked")} ({aspect.toFixed(2)})
                  </option>
                )}
                <option value="free">{t("freeCrop")}</option>
                <option value="auto">{t("automaticRatio")}</option>
                <option value="0.75">3:4</option>
                <option value="1.5">3:2</option>
                <option value="1">1:1</option>
                <option value="1.3333333333333333">4:3</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                className={button}
                onClick={() => rotate(-90)}
              >
                <RotateCcw size={18} />
                {t("left")}
              </button>
              <button
                type="button"
                className={button}
                onClick={() => rotate(90)}
              >
                <RotateCw size={18} />
                {t("right")}
              </button>
              <button
                type="button"
                className={button}
                onClick={() => {
                  if (edit) {
                    update(flipEdit(edit, "x"));
                    setBaseRotation(-baseRotation);
                  }
                }}
              >
                <FlipHorizontal size={18} />
                {t("flipH")}
              </button>
              <button
                type="button"
                className={button}
                onClick={() => {
                  if (edit) {
                    update(flipEdit(edit, "y"));
                    setBaseRotation(-baseRotation);
                  }
                }}
              >
                <FlipVertical size={18} />
                {t("flipV")}
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                className={`${button} ${thirds ? "bg-white/15" : ""}`}
                aria-pressed={thirds}
                onClick={() => setThirds(!thirds)}
              >
                <Grid3x3 size={17} />
                {t("showThirds")}
              </button>
              <button
                type="button"
                className={`${button} ${crosshair ? "bg-white/15" : ""}`}
                aria-pressed={crosshair}
                onClick={() => setCrosshair(!crosshair)}
              >
                <Crosshair size={17} />
                {t("showCrosshair")}
              </button>
            </div>
            <button
              type="button"
              className={`${button} w-full border border-white/15`}
              onClick={() => {
                if (!automatic) return;
                update(automatic, true, true);
                setBaseRotation(Math.round(automatic.rotation / 90) * 90);
                setAspect(automatic.width / automatic.height);
              }}
            >
              {t("resetAutomatic")}
            </button>
          </fieldset>
        </div>
        <footer className="border-t border-white/10 p-3 sm:px-5 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            className={button}
            disabled={saving || !edit}
            aria-pressed={compare}
            onClick={() => setCompare(!compare)}
          >
            {compare ? t("backToEdit") : t("compareAutomatic")}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              className={button}
              disabled={saving}
              onClick={onClose}
            >
              {t("cancel")}
            </button>
            <button
              type="button"
              className={`${button} !bg-[#5a5ff2] hover:!bg-[#4e53dc] !text-white`}
              disabled={busy}
              onClick={save}
            >
              {saving ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <Save size={17} />
              )}{" "}
              {saving ? t("saving") : t("save")}
            </button>
          </div>
          {error && (
            <p role="alert" className="w-full text-sm text-red-300">
              {error}
            </p>
          )}
        </footer>
      </div>
    </div>
  );
}
