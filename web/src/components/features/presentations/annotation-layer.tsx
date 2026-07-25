"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Annotation, AnnotationKind } from "@/lib/api/presentations.api";

// The SVG works in a fixed 1600×900 space and scales with its container, so a
// single set of normalized (0–1) coordinates renders identically in the editor,
// on a projector, and in the PDF export.
export const SLIDE_W = 1600;
export const SLIDE_H = 900;

export const ANNOTATION_COLORS = [
  { value: "#EF4444", label: "Rojo" },
  { value: "#FACC15", label: "Amarillo" },
  { value: "#22C55E", label: "Verde" },
  { value: "#3B82F6", label: "Azul" },
  { value: "#FFFFFF", label: "Blanco" },
];

export type Tool = AnnotationKind | "select";

const nx = (x: number) => x * SLIDE_W;
const ny = (y: number) => y * SLIDE_H;

/**
 * Arrowhead as an explicit triangle rather than an SVG `marker`, so the shape
 * is computed the same way here and in the PDF exporter.
 */
function arrowHead(
  from: [number, number],
  to: [number, number],
  width: number
): string {
  const x1 = nx(from[0]);
  const y1 = ny(from[1]);
  const x2 = nx(to[0]);
  const y2 = ny(to[1]);
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const len = Math.max(18, width * 4);
  const spread = 0.42;
  const p1 = [
    x2 - len * Math.cos(angle - spread),
    y2 - len * Math.sin(angle - spread),
  ];
  const p2 = [
    x2 - len * Math.cos(angle + spread),
    y2 - len * Math.sin(angle + spread),
  ];
  return `${x2},${y2} ${p1[0]},${p1[1]} ${p2[0]},${p2[1]}`;
}

function Shape({
  a,
  selected,
  onPointerDown,
}: {
  a: Annotation;
  selected?: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
}) {
  // A dark halo under every stroke keeps yellow and white readable on the
  // bright enamel and pale gingiva that fill most intraoral photos.
  const halo = {
    stroke: "rgba(0,0,0,0.35)",
    fill: "none" as const,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  const glow = selected
    ? { filter: "drop-shadow(0 0 6px rgba(100,105,252,0.9))" }
    : undefined;
  const common = {
    stroke: a.kind === "label" ? undefined : (a as { color: string }).color,
    fill: "none" as const,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    style: glow,
    onPointerDown,
  };

  switch (a.kind) {
    case "arrow":
      return (
        <g>
          <line
            {...halo}
            strokeWidth={a.width + 4}
            x1={nx(a.from[0])}
            y1={ny(a.from[1])}
            x2={nx(a.to[0])}
            y2={ny(a.to[1])}
          />
          <polygon {...halo} strokeWidth={a.width + 4} points={arrowHead(a.from, a.to, a.width)} />
          <line
            {...common}
            strokeWidth={a.width}
            x1={nx(a.from[0])}
            y1={ny(a.from[1])}
            x2={nx(a.to[0])}
            y2={ny(a.to[1])}
          />
          <polygon
            points={arrowHead(a.from, a.to, a.width)}
            fill={a.color}
            stroke={a.color}
            strokeWidth={a.width}
            strokeLinejoin="round"
            onPointerDown={onPointerDown}
            style={glow}
          />
        </g>
      );
    case "rect":
      return (
        <g>
          <rect
            {...halo}
            strokeWidth={a.width + 4}
            x={nx(a.x)}
            y={ny(a.y)}
            width={nx(a.w)}
            height={ny(a.h)}
            rx={8}
          />
          <rect
            {...common}
            strokeWidth={a.width}
            x={nx(a.x)}
            y={ny(a.y)}
            width={nx(a.w)}
            height={ny(a.h)}
            rx={8}
          />
        </g>
      );
    case "ellipse":
      return (
        <g>
          <ellipse
            {...halo}
            strokeWidth={a.width + 4}
            cx={nx(a.x + a.w / 2)}
            cy={ny(a.y + a.h / 2)}
            rx={Math.abs(nx(a.w / 2))}
            ry={Math.abs(ny(a.h / 2))}
          />
          <ellipse
            {...common}
            strokeWidth={a.width}
            cx={nx(a.x + a.w / 2)}
            cy={ny(a.y + a.h / 2)}
            rx={Math.abs(nx(a.w / 2))}
            ry={Math.abs(ny(a.h / 2))}
          />
        </g>
      );
    case "freehand": {
      const d = a.points
        .map((p, i) => `${i === 0 ? "M" : "L"} ${nx(p[0])} ${ny(p[1])}`)
        .join(" ");
      return (
        <g>
          <path {...halo} strokeWidth={a.width + 4} d={d} />
          <path {...common} strokeWidth={a.width} d={d} />
        </g>
      );
    }
    case "label":
      return (
        <text
          x={nx(a.x)}
          y={ny(a.y)}
          fill={a.color}
          fontSize={a.size}
          fontFamily="var(--font-geist-sans), Montserrat, sans-serif"
          fontWeight={700}
          stroke="rgba(0,0,0,0.45)"
          strokeWidth={a.size / 10}
          paintOrder="stroke"
          dominantBaseline="hanging"
          onPointerDown={onPointerDown}
          style={glow}
        >
          {a.text}
        </text>
      );
  }
}

interface AnnotationLayerProps {
  annotations: Annotation[];
  /** Omit to render read-only (presenter playback, thumbnails, export preview). */
  tool?: Tool | null;
  color?: string;
  width?: number;
  onChange?: (next: Annotation[]) => void;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  /**
   * Laser mode: strokes are drawn and fade away after a moment instead of being
   * saved. Used while presenting to point at something without editing the deck.
   */
  ephemeral?: boolean;
  className?: string;
}

export function AnnotationLayer({
  annotations,
  tool = null,
  color = ANNOTATION_COLORS[0].value,
  width = 8,
  onChange,
  selectedId,
  onSelect,
  ephemeral = false,
  className,
}: AnnotationLayerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [draft, setDraft] = useState<Annotation | null>(null);
  const [fading, setFading] = useState<Annotation[]>([]);
  const [editingLabel, setEditingLabel] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);

  const drawing = !!tool && tool !== "select";
  const interactive = !!tool;

  // Pointer position as normalized 0–1, independent of the rendered scale.
  const point = useCallback((e: React.PointerEvent): [number, number] => {
    const rect = svgRef.current!.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    ];
  }, []);

  const commit = useCallback(
    (a: Annotation) => {
      if (ephemeral) {
        setFading((prev) => [...prev, a]);
        // Long enough to finish a sentence while pointing, short enough that
        // the slide clears itself before the next explanation.
        setTimeout(
          () => setFading((prev) => prev.filter((f) => f.id !== a.id)),
          1600
        );
        return;
      }
      onChange?.([...annotations, a]);
    },
    [annotations, onChange, ephemeral]
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!drawing) return;
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const [x, y] = point(e);
    const id = crypto.randomUUID();

    if (tool === "label") {
      if (ephemeral) return;
      setEditingLabel({ id, x, y });
      return;
    }
    if (tool === "arrow") {
      setDraft({ id, kind: "arrow", from: [x, y], to: [x, y], color, width });
    } else if (tool === "rect" || tool === "ellipse") {
      setDraft({ id, kind: tool, x, y, w: 0, h: 0, color, width });
    } else if (tool === "freehand") {
      setDraft({ id, kind: "freehand", points: [[x, y]], color, width });
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draft) return;
    const [x, y] = point(e);
    setDraft((d) => {
      if (!d) return d;
      if (d.kind === "arrow") return { ...d, to: [x, y] };
      if (d.kind === "rect" || d.kind === "ellipse")
        return { ...d, w: x - d.x, h: y - d.y };
      if (d.kind === "freehand")
        return { ...d, points: [...d.points, [x, y] as [number, number]] };
      return d;
    });
  };

  const handlePointerUp = () => {
    if (!draft) return;
    let final = draft;
    // Normalize negative-size boxes so `w`/`h` stay positive for the exporter.
    if (final.kind === "rect" || final.kind === "ellipse") {
      const { x, y, w, h } = final;
      final = {
        ...final,
        x: w < 0 ? x + w : x,
        y: h < 0 ? y + h : y,
        w: Math.abs(w),
        h: Math.abs(h),
      };
      if (final.w < 0.01 && final.h < 0.01) return setDraft(null);
    }
    if (final.kind === "freehand" && final.points.length < 2)
      return setDraft(null);
    if (
      final.kind === "arrow" &&
      Math.hypot(final.to[0] - final.from[0], final.to[1] - final.from[1]) < 0.02
    )
      return setDraft(null);

    commit(final);
    setDraft(null);
  };

  // Delete the selected shape with the keyboard, like any drawing tool.
  useEffect(() => {
    if (!selectedId || !onChange || ephemeral) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        onChange(annotations.filter((a) => a.id !== selectedId));
        onSelect?.(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, annotations, onChange, onSelect, ephemeral]);

  const saveLabel = (text: string) => {
    if (editingLabel && text.trim()) {
      commit({
        id: editingLabel.id,
        kind: "label",
        x: editingLabel.x,
        y: editingLabel.y,
        text: text.trim(),
        color,
        size: 44,
      });
    }
    setEditingLabel(null);
  };

  return (
    <div className={`absolute inset-0 ${className ?? ""}`}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${SLIDE_W} ${SLIDE_H}`}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        style={{
          pointerEvents: interactive ? "auto" : "none",
          cursor: drawing ? "crosshair" : interactive ? "default" : undefined,
          touchAction: drawing ? "none" : undefined,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Clicking empty space clears the selection. */}
        {tool === "select" && (
          <rect
            x={0}
            y={0}
            width={SLIDE_W}
            height={SLIDE_H}
            fill="transparent"
            onPointerDown={() => onSelect?.(null)}
          />
        )}

        {annotations.map((a) => (
          <g
            key={a.id}
            style={{ pointerEvents: tool === "select" ? "auto" : "none" }}
          >
            <Shape
              a={a}
              selected={selectedId === a.id}
              onPointerDown={
                tool === "select"
                  ? (e) => {
                      e.stopPropagation();
                      onSelect?.(a.id);
                    }
                  : undefined
              }
            />
          </g>
        ))}

        {fading.map((a) => (
          <g key={a.id} className="animate-[fadeOut_1.6s_ease-out_forwards]">
            <Shape a={a} />
          </g>
        ))}

        {draft && <Shape a={draft} />}
      </svg>

      {/* Inline text entry for the label tool, positioned where you clicked. */}
      {editingLabel && (
        <input
          autoFocus
          className="absolute z-20 rounded border-2 border-[#6469FC] bg-white/95 px-2 py-1 text-sm font-semibold text-gray-900 shadow-lg outline-none"
          style={{
            left: `${editingLabel.x * 100}%`,
            top: `${editingLabel.y * 100}%`,
            minWidth: "9rem",
          }}
          placeholder="Escribe y presiona Enter"
          onBlur={(e) => saveLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveLabel(e.currentTarget.value);
            if (e.key === "Escape") setEditingLabel(null);
            e.stopPropagation();
          }}
        />
      )}

      <style jsx global>{`
        @keyframes fadeOut {
          0% {
            opacity: 1;
          }
          60% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
