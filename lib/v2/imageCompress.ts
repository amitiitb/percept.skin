// Client-side photo compression, tuned for color fidelity (Design/Eng review Decision #9).
// Size reduction comes primarily from dimension capping, not aggressive JPEG quality
// reduction — high quality (0.92) minimizes chroma-subsampling artifacts that would
// otherwise shift skin-tone/undertone readings before the AI ever sees the image.
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.92;

export async function compressImage(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return blob; // canvas unavailable — fall back to uploading the original

  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  return new Promise((resolve) => {
    canvas.toBlob(
      (out) => resolve(out ?? blob),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
}
