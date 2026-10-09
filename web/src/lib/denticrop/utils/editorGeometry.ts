import type { ImageEdit } from "../types";

/** Map a displacement in the output back into source-image coordinates. */
export function sourceDelta(x: number, y: number, edit: ImageEdit) {
  const angle = (edit.rotation * Math.PI) / 180;
  const cos = Math.cos(angle),
    sin = Math.sin(angle);
  return {
    x: (cos * x + sin * y) * (edit.flipX ? -1 : 1),
    y: (-sin * x + cos * y) * (edit.flipY ? -1 : 1),
  };
}

/** Keep all four crop corners inside the source, using the actual rotated
 * rectangle rather than discarding a centered band of usable image. */
export function fitEdit(
  edit: ImageEdit,
  imageW: number,
  imageH: number,
): ImageEdit {
  const angle = (edit.rotation * Math.PI) / 180;
  const c = Math.abs(Math.cos(angle)),
    s = Math.abs(Math.sin(angle));
  const width = Math.max(1, edit.width),
    height = Math.max(1, edit.height);
  const extentW = c * width + s * height;
  const extentH = s * width + c * height;
  const factor = Math.min(1, imageW / extentW, imageH / extentH);
  const halfW = (extentW * factor) / 2,
    halfH = (extentH * factor) / 2;
  return {
    ...edit,
    width: width * factor,
    height: height * factor,
    centerX: Math.max(halfW, Math.min(imageW - halfW, edit.centerX)),
    centerY: Math.max(halfH, Math.min(imageH - halfH, edit.centerY)),
  };
}

export function panEdit(edit: ImageEdit, dx: number, dy: number): ImageEdit {
  const delta = sourceDelta(dx, dy, edit);
  return {
    ...edit,
    centerX: edit.centerX + delta.x,
    centerY: edit.centerY + delta.y,
  };
}

/** Screen-axis flip; keep the focal point in the source unchanged. */
export function flipEdit(edit: ImageEdit, axis: "x" | "y"): ImageEdit {
  return {
    ...edit,
    rotation: -edit.rotation,
    flipX: axis === "x" ? !edit.flipX : edit.flipX,
    flipY: axis === "y" ? !edit.flipY : edit.flipY,
  };
}

/** Undo the expanded detection canvas and compose its rotation with the
 * automatic occlusal mirror/rotation, retaining the untouched uploaded source. */
export function mapDetectionEdit(
  edit: ImageEdit,
  sourceRotation: number,
  detectionW: number,
  detectionH: number,
  sourceW: number,
  sourceH: number,
): ImageEdit {
  const delta = sourceDelta(
    edit.centerX - detectionW / 2,
    edit.centerY - detectionH / 2,
    { ...edit, rotation: sourceRotation, flipX: false, flipY: false },
  );
  return fitEdit(
    {
      ...edit,
      centerX: sourceW / 2 + delta.x,
      centerY: sourceH / 2 + delta.y,
      rotation:
        edit.rotation +
        (edit.flipX !== edit.flipY ? -sourceRotation : sourceRotation),
    },
    sourceW,
    sourceH,
  );
}
