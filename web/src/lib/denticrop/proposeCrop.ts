import {
  DentalImage,
  ImageEdit,
  LetterboxInfo,
  RoboflowResponse,
  RoboflowPrediction,
} from "./types";
import { expandBoxToRatio, getStandardRatio } from "./utils/aaoRatios";
import { exportEdit, loadEditorImage } from "./utils/editorCanvas";
import { mapDetectionEdit } from "./utils/editorGeometry";

export async function proposeCrop(
  imageItem: DentalImage,
  endpoint: string,
): Promise<DentalImage> {
  try {
    // Step A: Letterbox locally to 640x640 for Inference
    const { blob: inferenceBlob, info: letterboxInfo } =
      await createInferenceBlob(imageItem.file);

    // Step B: Convert to Base64
    const form = new FormData();
    form.append("consent", "true");
    form.append("file", inferenceBlob, "preview.jpg");

    // Step C: Send to Next.js API Proxy
    const response = await fetch(endpoint, {
      method: "POST",
      credentials: "include",
      body: form,
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.message || "No se pudo obtener el recorte.");
    }

    const data: RoboflowResponse = await response.json();

    if (!data.predictions || data.predictions.length === 0) {
      throw new Error(
        "No se detectó un encuadre seguro. Usa el editor manual.",
      );
    }

    // Step D: Crop the ORIGINAL high-res image using predictions
    // We take the first prediction for now
    const prediction = data.predictions[0];
    // Optional AAO standard ratio (extraoral 3:4, intraoral 3:2), opt-in per image
    const targetRatio = imageItem.applyAaoRatio
      ? getStandardRatio(prediction.class)
      : null;
    const {
      blob: cropBlob,
      isMirrored,
      edit,
    } = await cropOriginalImage(
      imageItem.file,
      prediction,
      letterboxInfo,
      imageItem.format,
      targetRatio,
      imageItem.editSource,
      imageItem.sourceRotation,
    );

    // Mirror and inferior occlusal orientation are part of the saved recipe.

    const resultUrl = URL.createObjectURL(cropBlob);

    return {
      ...imageItem,
      status: "success",
      resultBlob: cropBlob,
      resultUrl: resultUrl,
      prediction: prediction,
      className: prediction.class,
      automaticEdit: edit,
      edit,
      isMirrored: isMirrored,
    };
  } catch (error) {
    return {
      ...imageItem,
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
// --- Helper Functions (Ported from app.js) ---

/**
 * Resizes image to 640x640 with black padding (Letterbox)
 */
async function createInferenceBlob(
  file: File,
): Promise<{ blob: Blob; info: LetterboxInfo }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.src = url;

    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      const targetSize = 640;
      canvas.width = targetSize;
      canvas.height = targetSize;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas context null"));

      // Fill black
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, targetSize, targetSize);

      // Calculate scale
      const scale = Math.min(
        targetSize / img.naturalWidth,
        targetSize / img.naturalHeight,
      );
      const w = img.naturalWidth * scale;
      const h = img.naturalHeight * scale;
      const dx = (targetSize - w) / 2;
      const dy = (targetSize - h) / 2;

      ctx.drawImage(img, dx, dy, w, h);

      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error("Blob creation failed"));
          resolve({
            blob,
            info: {
              scale,
              dx,
              dy,
              targetSize,
              originalWidth: img.naturalWidth,
              originalHeight: img.naturalHeight,
            },
          });
        },
        "image/jpeg",
        0.8,
      );
    };
    img.onerror = (e) => reject(e);
  });
}

/**
 * Crops the ORIGINAL file based on 640x640 letterbox predictions
 */
async function cropOriginalImage(
  file: File,
  pred: RoboflowPrediction,
  info: LetterboxInfo,
  format: "image/jpeg" | "image/png" = "image/jpeg",
  targetRatio: number | null = null,
  originalSource?: Blob,
  sourceRotation = 0,
): Promise<{ blob: Blob; isMirrored: boolean; edit: ImageEdit }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.src = url;

    img.onload = () => {
      URL.revokeObjectURL(url);
      // 1. Recover coordinates
      // Roboflow gives x,y (center), width, height in 640 space
      const x_640 = pred.x;
      const y_640 = pred.y;
      const w_640 = pred.width;
      const h_640 = pred.height;

      // 2. Remove padding (dx, dy)
      const x_img_scaled = x_640 - info.dx;
      const y_img_scaled = y_640 - info.dy;

      // 3. Upscale to original resolution
      const invScale = 1 / info.scale;
      const w_orig = w_640 * invScale;
      const h_orig = h_640 * invScale;
      const x_orig = x_img_scaled * invScale; // center X
      const y_orig = y_img_scaled * invScale; // center Y

      // 4. Calculate Top-Left for drawImage
      let cutX = x_orig - w_orig / 2;
      let cutY = y_orig - h_orig / 2;
      let cutW = w_orig;
      let cutH = h_orig;

      // Leave modest working room around extraoral anatomy before manual rotation.
      if (pred.class.toLowerCase().startsWith("extraoral")) {
        cutX -= w_orig * 0.04;
        cutY -= h_orig * 0.04;
        cutW *= 1.08;
        cutH *= 1.08;
      }
      const right = Math.min(img.naturalWidth, cutX + cutW);
      const bottom = Math.min(img.naturalHeight, cutY + cutH);
      cutX = Math.max(0, cutX);
      cutY = Math.max(0, cutY);
      cutW = right - cutX;
      cutH = bottom - cutY;
      if (
        ![cutX, cutY, cutW, cutH].every(Number.isFinite) ||
        cutW < 1 ||
        cutH < 1
      ) {
        reject(new Error("Invalid detection bounds"));
        return;
      }

      // Optionally expand the detection box to the AAO standard ratio,
      // growing outward around the detection so anatomy stays inside
      if (targetRatio) {
        const expanded = expandBoxToRatio(
          { x: cutX, y: cutY, width: cutW, height: cutH },
          targetRatio,
          img.naturalWidth,
          img.naturalHeight,
        );
        cutX = expanded.x;
        cutY = expanded.y;
        cutW = expanded.width;
        cutH = expanded.height;
      }

      // 5. check for mirror (oclusal)
      // TODO: Make this configurable or imported constants
      const MIRROR_CLASSES = ["oclusal", "occlusal"];
      const isMirrored = MIRROR_CLASSES.some((c) =>
        pred.class.toLowerCase().includes(c),
      );

      const edit: ImageEdit = {
        centerX: cutX + cutW / 2,
        centerY: cutY + cutH / 2,
        width: cutW,
        height: cutH,
        rotation:
          pred.class.toLowerCase() === "intraoral_oclusal_inferior" ? 180 : 0,
        flipX: isMirrored,
        flipY: false,
      };
      const finish = async () => {
        if (!originalSource || !sourceRotation) {
          return {
            blob: await exportEdit(img, edit, format),
            isMirrored,
            edit,
          };
        }
        const sourceUrl = URL.createObjectURL(originalSource);
        try {
          const original = await loadEditorImage(sourceUrl);
          const mapped = mapDetectionEdit(
            edit,
            sourceRotation,
            img.naturalWidth,
            img.naturalHeight,
            original.naturalWidth,
            original.naturalHeight,
          );
          return {
            blob: await exportEdit(original, mapped, format),
            isMirrored,
            edit: mapped,
          };
        } finally {
          URL.revokeObjectURL(sourceUrl);
        }
      };
      finish().then(resolve, reject);
    };
    img.onerror = (e) => reject(e);
  });
}
