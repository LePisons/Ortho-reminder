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

/** Size of an angle's reading, in stage units. Shared with the PDF exporter. */
export const ANGLE_LABEL_SIZE = 40;

const nx = (x: number) => x * SLIDE_W;
const ny = (y: number) => y * SLIDE_H;

/**
 * Everything an angle annotation needs to be drawn, in stage units.
 *
 * The reading is derived here rather than stored on the annotation, so the
 * number can never drift from the geometry it labels. Stage units are used
 * (not normalized ones) because 1600×900 is the same 16:9 as the slide box:
 * an angle measured on the stage is the angle the clinician sees on the photo.
 * The PDF exporter calls this too, so both draw the identical arc.
 */
export function angleGeometry(a: {
  a: [number, number];
  vertex: [number, number];
  b: [number, number];
}) {
  const V: [number, number] = [nx(a.vertex[0]), ny(a.vertex[1])];
  const A: [number, number] = [nx(a.a[0]), ny(a.a[1])];
  const B: [number, number] = [nx(a.b[0]), ny(a.b[1])];

  const angA = Math.atan2(A[1] - V[1], A[0] - V[0]);
  const angB = Math.atan2(B[1] - V[1], B[0] - V[0]);
  // Signed difference wrapped into (−π, π] — always the angle actually enclosed
  // by the two rays, never its reflex twin.
  let delta = angB - angA;
  while (delta <= -Math.PI) delta += 2 * Math.PI;
  while (delta > Math.PI) delta -= 2 * Math.PI;

  const reach = Math.min(
    Math.hypot(A[0] - V[0], A[1] - V[1]),
    Math.hypot(B[0] - V[0], B[1] - V[1])
  );
  // The arc has to stay inside the shorter ray, but still be readable when the
  // rays are long.
  const radius = Math.max(34, Math.min(130, reach * 0.42));
  const mid = angA + delta / 2;

  return {
    V,
    A,
    B,
    degrees: Math.abs(delta) * (180 / Math.PI),
    radius,
    angA,
    delta,
    start: [
      V[0] + Math.cos(angA) * radius,
      V[1] + Math.sin(angA) * radius,
    ] as [number, number],
    end: [V[0] + Math.cos(angB) * radius, V[1] + Math.sin(angB) * radius] as [
      number,
      number,
    ],
    /** SVG sweep flag; the arc is never the long way round, so large-arc is 0. */
    sweep: delta > 0 ? 1 : 0,
    labelAt: [
      V[0] + Math.cos(mid) * (radius + 46),
      V[1] + Math.sin(mid) * (radius + 46),
    ] as [number, number],
  };
}

export function formatDegrees(degrees: number): string {
  return `${degrees.toFixed(1)}°`;
}

/** Radius of a point marker, in stage units. */
export const pointRadius = (width: number) => width * 1.15 + 4;

/**
 * How long a laser mark survives. A stroke is long enough to finish a sentence
 * while pointing; a typed note or a measurement costs effort to make and is
 * meant to be read, so it stays until the explanation moves on.
 */
function fadeLife(a: Annotation): number {
  return a.kind === "label" || a.kind === "angle" || a.kind === "point"
    ? 8000
    : 1600;
}

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
    case "line":
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
          <line
            {...common}
            strokeWidth={a.width}
            x1={nx(a.from[0])}
            y1={ny(a.from[1])}
            x2={nx(a.to[0])}
            y2={ny(a.to[1])}
          />
        </g>
      );
    case "point": {
      const r = pointRadius(a.width);
      return (
        <g>
          {/* A dark ring, then the coloured dot: readable on enamel and on the
              near-black of a radiograph without changing colour. */}
          <circle
            cx={nx(a.x)}
            cy={ny(a.y)}
            r={r + 2}
            fill="none"
            stroke="rgba(0,0,0,0.45)"
            strokeWidth={4}
          />
          <circle
            cx={nx(a.x)}
            cy={ny(a.y)}
            r={r}
            fill={a.color}
            stroke="rgba(255,255,255,0.75)"
            strokeWidth={2}
            onPointerDown={onPointerDown}
            style={glow}
          />
        </g>
      );
    }
    case "angle": {
      const g = angleGeometry(a);
      const rays = `M ${g.A[0]} ${g.A[1]} L ${g.V[0]} ${g.V[1]} L ${g.B[0]} ${g.B[1]}`;
      const arc = `M ${g.start[0]} ${g.start[1]} A ${g.radius} ${g.radius} 0 0 ${g.sweep} ${g.end[0]} ${g.end[1]}`;
      const arcWidth = Math.max(2.5, a.width * 0.7);
      return (
        <g>
          <path {...halo} strokeWidth={a.width + 4} d={rays} />
          <path {...halo} strokeWidth={arcWidth + 4} d={arc} />
          <path {...common} strokeWidth={a.width} d={rays} />
          <path {...common} strokeWidth={arcWidth} d={arc} />
          <circle
            cx={g.V[0]}
            cy={g.V[1]}
            r={Math.max(4, a.width * 0.6)}
            fill={a.color}
          />
          <text
            x={g.labelAt[0]}
            y={g.labelAt[1]}
            fill={a.color}
            fontSize={ANGLE_LABEL_SIZE}
            fontFamily="var(--font-geist-sans), Montserrat, sans-serif"
            fontWeight={700}
            stroke="rgba(0,0,0,0.5)"
            strokeWidth={ANGLE_LABEL_SIZE / 9}
            paintOrder="stroke"
            textAnchor="middle"
            dominantBaseline="central"
            onPointerDown={onPointerDown}
            style={glow}
          >
            {formatDegrees(g.degrees)}
          </text>
        </g>
      );
    }
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
  /**
   * The angle tool is the one tool that isn't a single gesture: it collects
   * three clicks (first point, vertex, second point) with a live preview
   * between them.
   */
  const [pending, setPending] = useState<{
    points: [number, number][];
    cursor: [number, number];
  } | null>(null);

  const drawing = !!tool && tool !== "select";

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
        setTimeout(
          () => setFading((prev) => prev.filter((f) => f.id !== a.id)),
          fadeLife(a)
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
      // Also allowed while presenting: `commit` routes it to the fading marks,
      // so a typed note behaves like every other laser stroke.
      setEditingLabel({ id, x, y });
      return;
    }
    if (tool === "point") {
      commit({ id, kind: "point", x, y, color, width });
      return;
    }
    if (tool === "angle") {
      const points: [number, number][] = [
        ...(pending?.points ?? []),
        [x, y] as [number, number],
      ];
      if (points.length === 3) {
        commit({
          id,
          kind: "angle",
          a: points[0],
          vertex: points[1],
          b: points[2],
          color,
          width,
        });
        setPending(null);
      } else {
        setPending({ points, cursor: [x, y] });
      }
      return;
    }
    if (tool === "arrow" || tool === "line") {
      setDraft({ id, kind: tool, from: [x, y], to: [x, y], color, width });
    } else if (tool === "rect" || tool === "ellipse") {
      setDraft({ id, kind: tool, x, y, w: 0, h: 0, color, width });
    } else if (tool === "freehand") {
      setDraft({ id, kind: "freehand", points: [[x, y]], color, width });
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (pending) {
      const cursor = point(e);
      setPending((p) => (p ? { ...p, cursor } : p));
      return;
    }
    if (!draft) return;
    const [x, y] = point(e);
    setDraft((d) => {
      if (!d) return d;
      if (d.kind === "arrow" || d.kind === "line") return { ...d, to: [x, y] };
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
    // A click that never moved is a misfire, not a zero-length line.
    if (
      (final.kind === "arrow" || final.kind === "line") &&
      Math.hypot(final.to[0] - final.from[0], final.to[1] - final.from[1]) < 0.02
    )
      return setDraft(null);

    commit(final);
    setDraft(null);
  };

  // Switching tools abandons a half-placed angle rather than leaving stray
  // clicks waiting to be finished by the next tool.
  useEffect(() => setPending(null), [tool]);

  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPending(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending]);

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
    // The wrapper never eats clicks: when the layer is read-only (thumbnails,
    // presenter playback) or the select tool is active, taps have to reach the
    // frames underneath so a slide's media stays clickable.
    <div className={`pointer-events-none absolute inset-0 ${className ?? ""}`}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${SLIDE_W} ${SLIDE_H}`}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        style={{
          // Only a drawing tool claims the whole surface. With the pointer
          // (or no tool at all) the shapes below opt back in individually,
          // leaving the gaps between them clickable.
          pointerEvents: drawing ? "auto" : "none",
          cursor: drawing ? "crosshair" : undefined,
          touchAction: drawing ? "none" : undefined,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Clicking empty space clears the selection — but only while something
            is selected, so an idle pointer doesn't shadow the frames below. */}
        {tool === "select" && selectedId && (
          <rect
            x={0}
            y={0}
            width={SLIDE_W}
            height={SLIDE_H}
            fill="transparent"
            style={{ pointerEvents: "auto" }}
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
          <g
            key={a.id}
            style={{
              animation: `fadeOut ${fadeLife(a)}ms ease-out forwards`,
            }}
          >
            <Shape a={a} />
          </g>
        ))}

        {draft && <Shape a={draft} />}

        {/* Angle in progress: the clicks placed so far, plus a live preview of
            what the next click would produce. */}
        {pending && (
          <g opacity={0.9}>
            {pending.points.length === 1 && (
              <Shape
                a={{
                  id: "pending-ray",
                  kind: "line",
                  from: pending.points[0],
                  to: pending.cursor,
                  color,
                  width,
                }}
              />
            )}
            {pending.points.length === 2 && (
              <Shape
                a={{
                  id: "pending-angle",
                  kind: "angle",
                  a: pending.points[0],
                  vertex: pending.points[1],
                  b: pending.cursor,
                  color,
                  width,
                }}
              />
            )}
            {pending.points.map((p, i) => (
              <Shape
                key={i}
                a={{ id: `pending-${i}`, kind: "point", x: p[0], y: p[1], color, width }}
              />
            ))}
          </g>
        )}
      </svg>

      {/* The angle tool is the only multi-click gesture, so it says what it
          wants next instead of leaving the user guessing. */}
      {pending && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white">
          {pending.points.length === 1
            ? "Ahora marca el vértice"
            : "Ahora marca el tercer punto"}
          <span className="ml-2 text-white/50">Esc para cancelar</span>
        </div>
      )}

      {/* Inline text entry for the label tool, positioned where you clicked. */}
      {editingLabel && (
        <input
          autoFocus
          className="pointer-events-auto absolute z-20 rounded border-2 border-[#6469FC] bg-white/95 px-2 py-1 text-sm font-semibold text-gray-900 shadow-lg outline-none"
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
