"use client";

// Trail camera photos are large. Before storing an upload we downscale it to a
// sensible maximum edge and re-encode as JPEG so a season of photos stays within
// a reasonable amount of on-device storage while remaining clear enough to review.

const MAX_EDGE_PIXELS = 1600;
const JPEG_QUALITY = 0.82;

export type ProcessedImage = {
  blob: Blob;
  width: number;
  height: number;
};

export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

export async function processImageFile(file: File): Promise<ProcessedImage> {
  const source = await loadImageSource(file);
  const { width: sourceWidth, height: sourceHeight } = source;

  if (!sourceWidth || !sourceHeight) {
    releaseImageSource(source);
    throw new Error("Could not read image dimensions.");
  }

  const scale = Math.min(
    1,
    MAX_EDGE_PIXELS / Math.max(sourceWidth, sourceHeight),
  );
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    releaseImageSource(source);
    throw new Error("Canvas is not supported in this browser.");
  }

  context.drawImage(source.element, 0, 0, width, height);
  releaseImageSource(source);

  const blob = await canvasToBlob(canvas);

  return { blob, width, height };
}

type ImageSource = {
  element: CanvasImageSource & { width: number; height: number };
  width: number;
  height: number;
  bitmap?: ImageBitmap;
  objectUrl?: string;
};

async function loadImageSource(file: File): Promise<ImageSource> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image",
      });

      return {
        element: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        bitmap,
      };
    } catch {
      // Fall back to an <img> element below.
    }
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadHtmlImage(objectUrl);

    return {
      element: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      objectUrl,
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

function releaseImageSource(source: ImageSource) {
  source.bitmap?.close();
  if (source.objectUrl) URL.revokeObjectURL(source.objectUrl);
}

function loadHtmlImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load the selected image."));
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Could not encode the image."));
        }
      },
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
}
