"use client";

/**
 * 3D viewer for a pair of dental STL models (upper/lower jaw).
 * Client-only — always load via next/dynamic with ssr: false.
 *
 * Scanner STL pairs exported in bite position share coordinates, so rendering
 * both meshes as-is shows the occlusion; the meshes are grouped and the group
 * is centered on the combined bounding box (never per-jaw, which would break
 * the bite alignment).
 */

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

// Ref type of drei's OrbitControls, derived from the component so we don't
// import three-stdlib directly (it's only a transitive dep under pnpm).
type OrbitControlsImpl = NonNullable<
  React.ComponentRef<typeof OrbitControls>
>;
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { Button } from "@/components/ui/button";
import {
  Camera,
  Grid3x3,
  Loader2,
  AlertTriangle,
} from "lucide-react";

// ─── Camera sync (compare mode) ─────────────────────────────────────────────

export interface CameraPose {
  position: [number, number, number];
  target: [number, number, number];
  sourceId: string;
}

/** Shared bus so two side-by-side viewers can mirror camera movement. */
export interface CameraSyncChannel {
  listeners: Set<(pose: CameraPose) => void>;
  enabled: boolean;
}

export function createCameraSyncChannel(): CameraSyncChannel {
  return { listeners: new Set(), enabled: true };
}

// ─── STL loading ────────────────────────────────────────────────────────────

function useStlGeometry(url?: string | null) {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    url ? "loading" : "idle"
  );

  useEffect(() => {
    if (!url) {
      setGeometry(null);
      setStatus("idle");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    fetch(url, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .then((buffer) => {
        if (cancelled) return;
        const geo = new STLLoader().parse(buffer);
        geo.computeVertexNormals();
        setGeometry(geo);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  // Free GPU memory when the geometry is replaced or the viewer unmounts.
  useEffect(() => {
    return () => {
      geometry?.dispose();
    };
  }, [geometry]);

  return { geometry, status };
}

// ─── Scene ──────────────────────────────────────────────────────────────────

export type JawView = "both" | "upper" | "lower";

interface ViewPreset {
  label: string;
  dir: [number, number, number];
}

const VIEW_PRESETS: ViewPreset[] = [
  { label: "Frente", dir: [0, 0, 1] },
  { label: "Atrás", dir: [0, 0, -1] },
  { label: "Izq.", dir: [-1, 0, 0] },
  { label: "Der.", dir: [1, 0, 0] },
  { label: "Arriba", dir: [0, 1, 0.001] },
  { label: "Abajo", dir: [0, -1, 0.001] },
];

const JAW_MATERIAL = {
  upper: "#f3e9da", // ivory
  lower: "#ecdcc8", // slightly warmer so the arches read apart
};

interface SceneProps {
  upperGeometry: THREE.BufferGeometry | null;
  lowerGeometry: THREE.BufferGeometry | null;
  view: JawView;
  upperOpacity: number;
  lowerOpacity: number;
  wireframe: boolean;
  openBite: number; // mm the upper jaw is lifted (cosmetic)
  presetCommand: { dir: [number, number, number]; nonce: number } | null;
  sync?: CameraSyncChannel;
  onReady: (gl: THREE.WebGLRenderer) => void;
}

function Scene({
  upperGeometry,
  lowerGeometry,
  view,
  upperOpacity,
  lowerOpacity,
  wireframe,
  openBite,
  presetCommand,
  sync,
  onReady,
}: SceneProps) {
  const { camera, gl } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const fitRadius = useRef(60);
  const applyingRemotePose = useRef(false);
  const viewerId = useMemo(() => Math.random().toString(36).slice(2), []);

  useEffect(() => {
    onReady(gl);
  }, [gl, onReady]);

  // Center the group on the combined bounding box and fit the camera.
  // Re-runs when either geometry changes (e.g. switching sets in compare).
  useEffect(() => {
    const group = groupRef.current;
    if (!group || (!upperGeometry && !lowerGeometry)) return;
    group.position.set(0, 0, 0);
    const box = new THREE.Box3().setFromObject(group);
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    group.position.copy(center.negate());
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    fitRadius.current = Math.max(sphere.radius, 1);
    camera.position.set(0, 0, fitRadius.current * 2.4);
    camera.near = fitRadius.current / 100;
    camera.far = fitRadius.current * 20;
    camera.updateProjectionMatrix();
    controlsRef.current?.target.set(0, 0, 0);
    controlsRef.current?.update();
  }, [upperGeometry, lowerGeometry, camera]);

  // Camera preset buttons.
  useEffect(() => {
    if (!presetCommand) return;
    const d = new THREE.Vector3(...presetCommand.dir).normalize();
    camera.position.copy(d.multiplyScalar(fitRadius.current * 2.4));
    controlsRef.current?.target.set(0, 0, 0);
    controlsRef.current?.update();
  }, [presetCommand, camera]);

  // Mirror remote camera poses (compare mode).
  useEffect(() => {
    if (!sync) return;
    const listener = (pose: CameraPose) => {
      if (pose.sourceId === viewerId || !sync.enabled) return;
      applyingRemotePose.current = true;
      camera.position.set(...pose.position);
      controlsRef.current?.target.set(...pose.target);
      controlsRef.current?.update();
      applyingRemotePose.current = false;
    };
    sync.listeners.add(listener);
    return () => {
      sync.listeners.delete(listener);
    };
  }, [sync, camera, viewerId]);

  const broadcastPose = useCallback(() => {
    if (!sync || !sync.enabled || applyingRemotePose.current) return;
    const target = controlsRef.current?.target ?? new THREE.Vector3();
    const pose: CameraPose = {
      position: [camera.position.x, camera.position.y, camera.position.z],
      target: [target.x, target.y, target.z],
      sourceId: viewerId,
    };
    sync.listeners.forEach((l) => l(pose));
  }, [sync, camera, viewerId]);

  return (
    <>
      <hemisphereLight args={["#ffffff", "#8899aa", 1.1]} />
      <directionalLight position={[1, 2, 3]} intensity={1.4} />
      <directionalLight position={[-2, -1, -2]} intensity={0.5} />
      <group ref={groupRef}>
        {upperGeometry && (
          <mesh
            geometry={upperGeometry}
            visible={view !== "lower"}
            position={[0, view === "both" ? openBite : 0, 0]}
          >
            <meshStandardMaterial
              color={JAW_MATERIAL.upper}
              roughness={0.45}
              metalness={0.05}
              transparent
              opacity={upperOpacity}
              wireframe={wireframe}
            />
          </mesh>
        )}
        {lowerGeometry && (
          <mesh geometry={lowerGeometry} visible={view !== "upper"}>
            <meshStandardMaterial
              color={JAW_MATERIAL.lower}
              roughness={0.45}
              metalness={0.05}
              transparent
              opacity={lowerOpacity}
              wireframe={wireframe}
            />
          </mesh>
        )}
      </group>
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping={false}
        onChange={broadcastPose}
      />
    </>
  );
}

// ─── Viewer (canvas + toolbar) ──────────────────────────────────────────────

export interface StlViewerProps {
  /** URLs returning raw STL bytes (fetched with credentials). */
  upperUrl?: string | null;
  lowerUrl?: string | null;
  sync?: CameraSyncChannel;
  /** Hide the per-viewer toolbar (compare mode renders a shared one). */
  compact?: boolean;
  className?: string;
}

export default function StlViewer({
  upperUrl,
  lowerUrl,
  sync,
  compact = false,
  className,
}: StlViewerProps) {
  const { geometry: upperGeometry, status: upperStatus } =
    useStlGeometry(upperUrl);
  const { geometry: lowerGeometry, status: lowerStatus } =
    useStlGeometry(lowerUrl);

  const [view, setView] = useState<JawView>("both");
  const [upperOpacity, setUpperOpacity] = useState(1);
  const [lowerOpacity, setLowerOpacity] = useState(1);
  const [wireframe, setWireframe] = useState(false);
  const [openBite, setOpenBite] = useState(0);
  const [presetCommand, setPresetCommand] = useState<{
    dir: [number, number, number];
    nonce: number;
  } | null>(null);
  const glRef = useRef<THREE.WebGLRenderer | null>(null);

  const loading = upperStatus === "loading" || lowerStatus === "loading";
  const failed = upperStatus === "error" || lowerStatus === "error";
  const hasUpper = !!upperGeometry;
  const hasLower = !!lowerGeometry;

  const screenshot = () => {
    const gl = glRef.current;
    if (!gl) return;
    const link = document.createElement("a");
    link.download = `modelo-3d-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = gl.domElement.toDataURL("image/png");
    link.click();
  };

  return (
    <div className={`flex flex-col gap-3 ${className ?? ""}`}>
      <div className="relative rounded-xl overflow-hidden border bg-gradient-to-b from-slate-100 to-slate-200 aspect-[4/3]">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60">
            <Loader2 className="w-8 h-8 animate-spin text-[#6469FC]" />
          </div>
        )}
        {failed && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-white/80 text-sm text-red-600">
            <AlertTriangle className="w-6 h-6" />
            No se pudo cargar el modelo STL
          </div>
        )}
        <Canvas
          camera={{ fov: 40, position: [0, 0, 150] }}
          gl={{ preserveDrawingBuffer: true, antialias: true }}
        >
          <Scene
            upperGeometry={upperGeometry}
            lowerGeometry={lowerGeometry}
            view={view}
            upperOpacity={upperOpacity}
            lowerOpacity={lowerOpacity}
            wireframe={wireframe}
            openBite={openBite}
            presetCommand={presetCommand}
            sync={sync}
            onReady={(gl) => {
              glRef.current = gl;
            }}
          />
        </Canvas>

        {/* Jaw visibility — always available, overlaid on the canvas */}
        <div className="absolute top-2 left-2 z-10 flex gap-1 bg-white/80 backdrop-blur rounded-lg p-1 shadow-sm">
          {(
            [
              { value: "both", label: "Oclusión", disabled: !hasUpper || !hasLower },
              { value: "upper", label: "Superior", disabled: !hasUpper },
              { value: "lower", label: "Inferior", disabled: !hasLower },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              disabled={opt.disabled}
              onClick={() => setView(opt.value)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                view === opt.value
                  ? "bg-gradient-to-r from-[#A066F8] to-[#6469FC] text-white shadow"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {!compact && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-xs text-gray-600">
          {/* Camera presets */}
          <div className="flex gap-1">
            {VIEW_PRESETS.map((p) => (
              <Button
                key={p.label}
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() =>
                  setPresetCommand({ dir: p.dir, nonce: Date.now() })
                }
              >
                {p.label}
              </Button>
            ))}
          </div>

          {hasUpper && (
            <label className="flex items-center gap-2">
              Opacidad sup.
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={upperOpacity}
                onChange={(e) => setUpperOpacity(Number(e.target.value))}
                className="w-24 accent-[#6469FC]"
              />
            </label>
          )}
          {hasLower && (
            <label className="flex items-center gap-2">
              Opacidad inf.
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={lowerOpacity}
                onChange={(e) => setLowerOpacity(Number(e.target.value))}
                className="w-24 accent-[#6469FC]"
              />
            </label>
          )}
          {hasUpper && hasLower && view === "both" && (
            <label className="flex items-center gap-2">
              Abrir mordida
              <input
                type="range"
                min={0}
                max={30}
                step={1}
                value={openBite}
                onChange={(e) => setOpenBite(Number(e.target.value))}
                className="w-24 accent-[#6469FC]"
              />
            </label>
          )}

          <Button
            variant="outline"
            size="sm"
            className={`h-7 px-2 text-xs ${wireframe ? "bg-gray-100" : ""}`}
            onClick={() => setWireframe((w) => !w)}
          >
            <Grid3x3 className="w-3.5 h-3.5 mr-1" />
            Malla
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={screenshot}
          >
            <Camera className="w-3.5 h-3.5 mr-1" />
            Captura
          </Button>
        </div>
      )}
    </div>
  );
}
