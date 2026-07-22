import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

/**
 * Objective page-fill metric: how far the content extends toward the bottom
 * of page 1, as a fraction of page height. PDF y=0 is the bottom edge, so
 * fill = (height - lowestTextBaseline) / height. A full page is ~0.92-0.96
 * (bottom margin); a half-filled page is ~0.5.
 */
export async function pageFill(pdf: Buffer): Promise<number> {
  const task = getDocument({ data: new Uint8Array(pdf), verbosity: 0 });
  const doc = await task.promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 1 });
  const tc = await page.getTextContent();
  let minY = Infinity;
  for (const item of tc.items) {
    const y = (item as { transform: number[] }).transform[5];
    if (y < minY) minY = y;
  }
  await task.destroy();
  if (!isFinite(minY)) return 0;
  return (viewport.height - minY) / viewport.height;
}
