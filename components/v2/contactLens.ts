// Shared between GlassesVirtualTryOn (still photo) and LiveEyewearTryOn
// (live camera) — the lens texture catalogue, MediaPipe eyelid-contour
// landmark indices, and the per-eye compositing routine, so the live path
// doesn't reimplement (and drift from) the photo path's rendering.

export interface LensTexture { id: string; name: string; file: string; fill: number; }

// Real lens-texture swatches (radial fibre pattern, soft ring, chroma-keyed
// transparent background + transparent pupil hole + feathered outer edge)
// rather than a flat procedural colour fill. A first version tried tinting
// the photo's own iris with a canvas blend-mode gradient; tested side by
// side against a synthetic eye before shipping and it read as exactly what
// it was, a flat coloured dot. These textures composite directly over the
// eye instead, the same way a real lens sits on top of the natural iris.
//
// `fill` is the fraction of the square texture's width the lens disc
// actually occupies — measured per image (each generation renders the disc
// at a slightly different size), used to scale the whole image so the ring
// itself, not the canvas, ends up sized to the detected iris diameter.
// Trimmed off black and pink — they read as costume lenses rather than
// something most people would actually pick — then expanded back out to 10
// total with four more shades from the same natural family.
export const LENS_TEXTURES: LensTexture[] = [
  { id: "gray",      name: "Gray",      file: "/frames/lens/gray.png",      fill: 0.451 },
  { id: "brown",     name: "Brown",     file: "/frames/lens/brown.png",     fill: 0.424 },
  { id: "blue",      name: "Blue",      file: "/frames/lens/blue.png",      fill: 0.475 },
  { id: "green",     name: "Green",     file: "/frames/lens/green.png",     fill: 0.496 },
  { id: "hazel",     name: "Hazel",     file: "/frames/lens/hazel.png",     fill: 0.455 },
  { id: "honey",     name: "Honey",     file: "/frames/lens/honey.png",     fill: 0.455 },
  { id: "turquoise", name: "Turquoise", file: "/frames/lens/turquoise.png", fill: 0.580 },
  { id: "amber",     name: "Amber",     file: "/frames/lens/amber.png",     fill: 0.546 },
  { id: "violet",    name: "Violet",    file: "/frames/lens/violet.png",    fill: 0.481 },
  { id: "charcoal",  name: "Charcoal",  file: "/frames/lens/charcoal.png",  fill: 0.466 },
];

// MediaPipe's 478-point face mesh, iris refinement enabled: canonical eyelid
// contour indices per eye (outer corner -> upper lid -> inner corner, and
// outer corner -> lower lid -> inner corner). Used to build the actual eye
// aperture the lens must be clipped to, instead of drawing a full circle.
export const RIGHT_EYE_UPPER = [33, 246, 161, 160, 159, 158, 157, 173, 133];
export const RIGHT_EYE_LOWER = [33, 7, 163, 144, 145, 153, 154, 155, 133];
export const LEFT_EYE_UPPER  = [362, 398, 384, 385, 386, 387, 388, 466, 263];
export const LEFT_EYE_LOWER  = [362, 382, 381, 380, 374, 373, 390, 249, 263];

export function bboxOfPoints(points: { x: number; y: number }[], pad: number) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y;
  }
  return { x: minX - pad, y: minY - pad, w: (maxX - minX) + pad * 2, h: (maxY - minY) + pad * 2 };
}

/**
 * Composites a lens texture into one eye, clipped to that eye's own eyelid
 * aperture (not a full circle) so the lids naturally occlude whatever part
 * of the iris they cover. Every argument — centre, radius, rotation, lid
 * contour — is specific to this one eye; called twice with independently
 * measured values per eye, never a mirrored/shared transform. Used for both
 * a single still-photo pass and, every rAF tick, the live video loop.
 *
 * Pipeline: render the lens texture at this eye's angle/scale -> punch it
 * through a blurred eyelid-shaped mask (feathers the aperture-intersection
 * edge instead of a hard cutout) -> re-light it using the *real* frame's own
 * luminosity at each pixel (so shadow/highlight from the actual scene
 * carries over instead of the texture looking flatly lit) -> lift the
 * original corneal catchlight back on top (a specular reflection belongs to
 * the cornea's curvature and the room light, not the iris colour under it).
 */
export function drawContactLensEye(opts: {
  mainCtx: CanvasRenderingContext2D;
  texture: HTMLImageElement;
  textureFill: number;
  cx: number; cy: number; rPx: number; angle: number;
  lidPoly: { x: number; y: number }[];
}) {
  const { mainCtx, texture, textureFill, cx, cy, rPx, angle, lidPoly } = opts;
  if (rPx <= 0 || lidPoly.length < 3) return;

  const irisCorners = [
    { x: cx - rPx, y: cy - rPx }, { x: cx + rPx, y: cy + rPx },
    { x: cx - rPx, y: cy + rPx }, { x: cx + rPx, y: cy - rPx },
  ];
  const box = bboxOfPoints([...lidPoly, ...irisCorners], Math.max(4, rPx * 0.15));
  const bx = Math.floor(box.x), by = Math.floor(box.y);
  const bw = Math.max(4, Math.ceil(box.w)), bh = Math.max(4, Math.ceil(box.h));

  // Snapshot the untouched frame under this eye before drawing anything —
  // this is what makes the illumination match and the highlight lift-back
  // possible; both need the real scene pixels, not the synthetic texture.
  let srcData: ImageData;
  try { srcData = mainCtx.getImageData(bx, by, bw, bh); } catch { return; }

  const iris = document.createElement("canvas"); iris.width = bw; iris.height = bh;
  const ictx = iris.getContext("2d");
  if (!ictx) return;
  ictx.save();
  ictx.translate(cx - bx, cy - by);
  ictx.rotate(angle);
  const drawSize = (2 * rPx) / textureFill;
  ictx.drawImage(texture, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
  ictx.restore();

  // Eyelid aperture mask, blurred so the lid boundary feathers into the iris
  // instead of cutting it with a hard edge.
  const mask = document.createElement("canvas"); mask.width = bw; mask.height = bh;
  const mctx = mask.getContext("2d");
  if (!mctx) return;
  mctx.filter = `blur(${Math.max(1, rPx * 0.05)}px)`;
  mctx.fillStyle = "#000";
  mctx.beginPath();
  lidPoly.forEach((p, i) => {
    const x = p.x - bx, y = p.y - by;
    if (i === 0) mctx.moveTo(x, y); else mctx.lineTo(x, y);
  });
  mctx.closePath();
  mctx.fill();
  ictx.globalCompositeOperation = "destination-in";
  ictx.drawImage(mask, 0, 0);
  ictx.globalCompositeOperation = "source-over";

  // Illumination match: keep the texture's own hue/saturation but pull
  // luminosity from the real frame, so this eye's actual shadowing (lid
  // shape, head angle, room light) carries onto the synthetic iris.
  const srcCanvas = document.createElement("canvas"); srcCanvas.width = bw; srcCanvas.height = bh;
  const sctx = srcCanvas.getContext("2d");
  if (!sctx) return;
  sctx.putImageData(srcData, 0, 0);
  ictx.globalCompositeOperation = "luminosity";
  ictx.globalAlpha = 0.65;
  ictx.drawImage(srcCanvas, 0, 0);
  ictx.globalAlpha = 1;
  ictx.globalCompositeOperation = "source-over";

  // Lift the real corneal catchlight back on top — thresholded from the
  // same snapshot, so only genuinely bright pixels (the specular glint,
  // not general iris brightness) survive.
  const hlCanvas = document.createElement("canvas"); hlCanvas.width = bw; hlCanvas.height = bh;
  const hctx = hlCanvas.getContext("2d");
  if (!hctx) return;
  const hlData = hctx.createImageData(bw, bh);
  for (let i = 0; i < srcData.data.length; i += 4) {
    const r = srcData.data[i], g = srcData.data[i + 1], b = srcData.data[i + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (lum > 205) {
      const t = Math.min(1, (lum - 205) / 50);
      hlData.data[i] = r; hlData.data[i + 1] = g; hlData.data[i + 2] = b;
      hlData.data[i + 3] = Math.round(255 * t);
    }
  }
  hctx.putImageData(hlData, 0, 0);
  ictx.drawImage(hlCanvas, 0, 0);

  mainCtx.drawImage(iris, bx, by);
}
