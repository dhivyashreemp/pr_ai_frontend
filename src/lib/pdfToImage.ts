import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

async function tryExtractEmbeddedImage(page: pdfjsLib.PDFPageProxy): Promise<Blob | null> {
  try {
    const opList = await page.getOperatorList();
    const OPS = pdfjsLib.OPS;

    const imageNames: string[] = [];
    for (let i = 0; i < opList.fnArray.length; i++) {
      if (opList.fnArray[i] === OPS.paintImageXObject) {
        const name = opList.argsArray[i][0] as string;
        if (!imageNames.includes(name)) imageNames.push(name);
      }
    }
    if (imageNames.length === 0) return null;

    const imageObjects = await Promise.all(
      imageNames.map(name =>
        new Promise<{ width: number; height: number; data: Uint8ClampedArray; kind: number } | null>(resolve => {
          page.objs.get(name, (img: any) => {
            if (img?.width && img?.height && img?.data) {
              resolve({ width: img.width, height: img.height, data: img.data, kind: img.kind ?? 2 });
            } else {
              resolve(null);
            }
          });
        })
      )
    );

    const valid = imageObjects.filter(Boolean) as NonNullable<typeof imageObjects[0]>[];
    if (valid.length === 0) return null;

    const largest = valid.reduce((a, b) => a.width * a.height > b.width * b.height ? a : b);

    // Convert to RGBA (kind 2 = RGB_24BPP, kind 3 = RGBA_32BPP)
    let rgba: Uint8ClampedArray;
    if (largest.kind === 3) {
      rgba = largest.data;
    } else {
      rgba = new Uint8ClampedArray(largest.width * largest.height * 4);
      for (let i = 0; i < largest.width * largest.height; i++) {
        rgba[i * 4]     = largest.data[i * 3];
        rgba[i * 4 + 1] = largest.data[i * 3 + 1];
        rgba[i * 4 + 2] = largest.data[i * 3 + 2];
        rgba[i * 4 + 3] = 255;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = largest.width;
    canvas.height = largest.height;
    canvas.getContext('2d')!.putImageData(new ImageData(rgba, largest.width, largest.height), 0, 0);

    return new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/png')
    );
  } catch {
    return null;
  }
}

export async function pdfToImage(file: File, pageNumber = 1): Promise<string> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const page = await pdf.getPage(pageNumber);

  const embedded = await tryExtractEmbeddedImage(page);
  if (embedded) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(embedded);
    });
  }

  const viewport = page.getViewport({ scale: 2.0 });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get 2D canvas context");

  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  return canvas.toDataURL("image/png");
}

/** Returns the total number of pages in a PDF file. */
export async function pdfPageCount(file: File): Promise<number> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  return pdf.numPages;
}

/**
 * Renders every page of a PDF to a PNG File.
 * Output files are named `${baseName}_page${N}.png` (N is 1-indexed).
 */
export async function pdfToImageFiles(file: File): Promise<File[]> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const baseName = file.name.replace(/\.pdf$/i, "");
  const files: File[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);

    const embedded = await tryExtractEmbeddedImage(page);
    if (embedded) {
      files.push(new File([embedded], `${baseName}_page${pageNumber}.png`, { type: "image/png" }));
      continue;
    }

    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get 2D canvas context");

    await page.render({ canvasContext: ctx, viewport, canvas }).promise;

    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("canvas.toBlob returned null"))),
        "image/png"
      );
    });

    files.push(new File([blob], `${baseName}_page${pageNumber}.png`, { type: "image/png" }));
  }

  return files;
}

export const isPdfFile = (file?: File | null): boolean =>
  !!file && (file.type === "application/pdf" || /\.pdf$/i.test(file.name));
