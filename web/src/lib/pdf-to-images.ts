/**
 * Rasterizes a PDF in the browser so it can be stored and shown like any other
 * record. Cephalometric software (Ricketts, Steiner, Wits…) exports its
 * analysis as a PDF far more often than as an image, and a slide can only
 * display pixels — so the conversion happens here, at upload time, and the API
 * keeps its "images only" contract.
 *
 * pdf.js is imported dynamically: it is ~450 KB and only a case with a PDF
 * analysis ever pays for it.
 *
 * The worker is served from /public rather than resolved through the bundler:
 * `new URL(...)` against a bare package specifier isn't portable across
 * webpack (`next build`) and Turbopack (`next dev`). If pdfjs-dist is
 * upgraded, re-copy `node_modules/pdfjs-dist/build/pdf.worker.min.mjs` —
 * pdf.js refuses to run against a mismatched worker version.
 */
const WORKER_SRC = "/pdfjs/pdf.worker.min.mjs";

export const isPdf = (file: File) =>
  file.type === "application/pdf" || /\.pdf$/i.test(file.name);

/**
 * One PNG per page, at `maxEdge` on the longest side — enough to read the
 * numbers on an analysis when the slide is projected, without carrying a
 * print-resolution scan around.
 */
export async function pdfPagesToImages(
  file: File,
  maxEdge = 2000
): Promise<Blob[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = WORKER_SRC;

  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjs.getDocument({ data });
  const doc = await task.promise;
  const pages: Blob[] = [];

  try {
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(2, maxEdge / Math.max(base.width, base.height));
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("No se pudo procesar el PDF");
      // Analyses are printed on white; without this the transparent areas of
      // the page render black on the slide.
      context.fillStyle = "#FFFFFF";
      context.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvas, canvasContext: context, viewport }).promise;
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png")
      );
      if (blob) pages.push(blob);
      page.cleanup();
    }
  } finally {
    // Tears down the worker too, so a one-off conversion doesn't leave a
    // thread alive for the rest of the session.
    await task.destroy();
  }

  if (pages.length === 0) throw new Error("El PDF no tiene páginas legibles");
  return pages;
}
