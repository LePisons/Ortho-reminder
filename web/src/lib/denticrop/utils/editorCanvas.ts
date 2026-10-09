import type { ImageEdit } from "../types";

export function loadEditorImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load source image"));
    image.src = url;
  });
}

/** Shared transform for preview and export. No intermediate clipped bitmap. */
export function drawEditedImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  edit: ImageEdit,
  centerX: number,
  centerY: number,
  scale: number,
) {
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.scale(scale, scale);
  ctx.rotate((edit.rotation * Math.PI) / 180);
  ctx.scale(edit.flipX ? -1 : 1, edit.flipY ? -1 : 1);
  ctx.drawImage(image, -edit.centerX, -edit.centerY);
  ctx.restore();
}

export async function exportEdit(
  image: HTMLImageElement,
  edit: ImageEdit,
  format: string,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(edit.width));
  canvas.height = Math.max(1, Math.floor(edit.height));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  // Account for integer output dimensions without shifting the crop edges.
  ctx.scale(canvas.width / edit.width, canvas.height / edit.height);
  drawEditedImage(ctx, image, edit, edit.width / 2, edit.height / 2, 1);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Image export failed"));
      },
      format,
      0.95,
    ),
  );
}
