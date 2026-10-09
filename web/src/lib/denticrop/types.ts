export interface RoboflowPrediction {
  x: number;
  y: number;
  width: number;
  height: number;
  class: string;
  confidence: number;
  image_path?: string;
  prediction_type?: string;
}

export interface RoboflowResponse {
  predictions: RoboflowPrediction[];
  // Dimensions of the image sent to inference (usually 640x640)
  image: {
    width: number;
    height: number;
  };
}

export type ProcessingStatus =
  | "idle"
  | "rotating"
  | "processing"
  | "success"
  | "error";

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface LetterboxInfo {
  scale: number;
  dx: number;
  dy: number;
  targetSize: number;
  originalWidth: number;
  originalHeight: number;
}

export interface DentalImage {
  id: string;
  batchId: string; // which patient batch this image belongs to
  file: File;
  previewUrl: string;
  status: ProcessingStatus;
  originalDims?: ImageDimensions;
  resultBlob?: Blob;
  resultUrl?: string; // URL for the processed blob
  prediction?: RoboflowPrediction;
  error?: string;
  className?: string; // e.g. "oclusal", "lateral"
  customName?: string; // User-defined name override
  isMirrored?: boolean; // Legacy: replaced by flipX/flipY in editor
  format?: "image/jpeg" | "image/png";
  applyAaoRatio?: boolean; // Expand AI crop to AAO standard ratio (3:4 / 3:2)
  // Recipes refer to the full source file, never to the exported result.
  automaticEdit?: ImageEdit;
  edit?: ImageEdit;
  editSource?: Blob; // Immutable uploaded source, also retained after automatic rotation.
  sourceRotation?: number; // Rotation used only for the detection input.

  // Edit History
  rotation?: number; // degrees
  flipX?: boolean;
  flipY?: boolean;
}

export interface ImageEdit {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
}
