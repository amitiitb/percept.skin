"use client";
import React, { useEffect, useRef, useState, useCallback, CSSProperties } from "react";
import Image from "next/image";
import LiveEyewearTryOn from "./LiveEyewearTryOn";
import { IconSparkle, IconPhoto, IconLiveCamera, IconGlasses, IconSun, IconEye, IconCheck } from "@/components/ui/icons";
import {
  LENS_TEXTURES, RIGHT_EYE_UPPER, RIGHT_EYE_LOWER, LEFT_EYE_UPPER, LEFT_EYE_LOWER, drawContactLensEye,
} from "./contactLens";

interface FrameDef {
  id: string;
  name: string;
  file: string;
  lx: number;
  ly: number;
  rx: number;
  ry: number;
  precision?: boolean;
  /** Defaults to "eyeglasses" when omitted — every asset before the sunglasses
   *  set was clear-lens eyewear and had no reason to carry this field. */
  lens?: "eyeglasses" | "sunglasses";
}

const FRAMES: FrameDef[] = [
  { id: "clubmaster",  name: "Clubmaster", file: "/frames/photo/clubmaster.png", lx: 0.272, ly: 0.508, rx: 0.728, ry: 0.508, precision: true },
  { id: "hexagonal",   name: "Hexagonal",  file: "/frames/photo/hexagonal.png",  lx: 0.266, ly: 0.512, rx: 0.734, ry: 0.512, precision: true },
  { id: "boston",      name: "Boston",     file: "/frames/photo/boston.png",     lx: 0.277, ly: 0.514, rx: 0.723, ry: 0.514, precision: true },
  { id: "wire-oval",   name: "Wire Oval",  file: "/frames/photo/wire-oval.png",  lx: 0.263, ly: 0.513, rx: 0.737, ry: 0.513, precision: true },
  { id: "square-thick",name: "Square",     file: "/frames/photo/square.png",     lx: 0.286, ly: 0.512, rx: 0.714, ry: 0.512, precision: true },
  { id: "aviator",     name: "Aviator",    file: "/frames/photo/aviator-graphite.png", lx: 0.266, ly: 0.500, rx: 0.734, ry: 0.500, precision: true },
  { id: "wayfarer",    name: "Wayfarer",   file: "/frames/photo/wayfarer-espresso.png", lx: 0.281, ly: 0.496, rx: 0.719, ry: 0.496, precision: true },
  { id: "round-smoke", name: "Round",      file: "/frames/photo/round-smoke.png", lx: 0.278, ly: 0.492, rx: 0.722, ry: 0.492, precision: true },
  { id: "cat-eye",     name: "Cat Eye",    file: "/frames/photo/cat-eye-cherry.png", lx: 0.277, ly: 0.505, rx: 0.723, ry: 0.505, precision: true },
  { id: "rimless",     name: "Rimless",    file: "/frames/photo/rimless-champagne.png", lx: 0.263, ly: 0.497, rx: 0.737, ry: 0.497, precision: true },
  // Replaces the earlier navigator/panto-olive/geometric/slim-rect/crystal/
  // double-bridge set, which all had visible temple-arm remnants from an
  // in-house pixel-mask removal attempt. These were generated directly
  // without arms by ChatGPT/gpt-image-1, transparent background included.
  // lx/ly/rx/ry measured as the opacity-weighted centroid of each frame
  // half (see the sunglasses comment below for the same method) — not yet
  // spot-checked against a real face photo, so nudge if any sits off.
  // "geometric" has no ChatGPT replacement yet, so it's dropped from the
  // set (and from SHAPE_FRAMES/SEASON_FRAMES below) until one exists.
  { id: "round-tortoise", name: "Round Tortoise", file: "/frames/photo/round-tortoise.png", lx: 0.243, ly: 0.458, rx: 0.757, ry: 0.459, precision: true },
  { id: "navigator",   name: "Navigator",  file: "/frames/photo/navigator-gunmetal.png", lx: 0.277, ly: 0.457, rx: 0.723, ry: 0.456, precision: true },
  { id: "panto-olive", name: "Panto Olive",file: "/frames/photo/panto-olive.png", lx: 0.253, ly: 0.444, rx: 0.747, ry: 0.443, precision: true },
  { id: "slim-rect",   name: "Slim Rect",  file: "/frames/photo/slim-rectangle-black.png", lx: 0.249, ly: 0.409, rx: 0.776, ry: 0.392, precision: true },
  { id: "crystal",     name: "Crystal",    file: "/frames/photo/crystal-smoke.png", lx: 0.238, ly: 0.457, rx: 0.761, ry: 0.456, precision: true },
  { id: "double-bridge", name: "Double Bridge", file: "/frames/photo/double-bridge-champagne.png", lx: 0.292, ly: 0.450, rx: 0.708, ry: 0.450, precision: true },
  // Sunglasses — generated via lib/v2/gemini.ts's generateProductShot (see
  // scripts/generate-sunglasses.cjs) to match this same catalogue-photo style,
  // rather than reusing the flat vector icons already sitting unused in
  // public/frames/*.svg, which would have looked like a sticker pasted onto a
  // real face next to these photoreal cutouts. lx/ly/rx/ry are estimated from
  // each image's measured product bounding box against the established
  // First-pass anchors here were rough bounding-box guesses and put
  // round/wayfarer up on the forehead when actually tested against a real
  // face photo — these are the corrected values, measured as the opacity-
  // weighted centroid of each frame's left/right half (see
  // scripts/generate-sunglasses.cjs's header for the shadow-removal and
  // colour-decontamination passes that had to happen before this measurement
  // was trustworthy). Verified by compositing onto a real captured photo
  // using the same scale/anchor formula as redraw() below, not just eyeballed.
  { id: "aviator-sun", name: "Aviator Sun",  file: "/frames/photo/aviator-sunglasses.png", lx: 0.294, ly: 0.480, rx: 0.710, ry: 0.479, precision: true, lens: "sunglasses" },
  // wayfarer/round/cateye below were regenerated by ChatGPT (arm-free,
  // transparent background) same as the eyeglasses set above — anchors
  // re-measured by the same opacity-centroid method, not yet spot-checked
  // on a real face.
  { id: "wayfarer-sun",name: "Wayfarer Sun", file: "/frames/photo/wayfarer-sunglasses.png", lx: 0.250, ly: 0.476, rx: 0.749, ry: 0.476, precision: true, lens: "sunglasses" },
  { id: "round-sun",   name: "Round Sun",    file: "/frames/photo/round-sunglasses.png", lx: 0.251, ly: 0.484, rx: 0.750, ry: 0.485, precision: true, lens: "sunglasses" },
  { id: "shield-sun",  name: "Shield Sun",   file: "/frames/photo/shield-sunglasses.png", lx: 0.325, ly: 0.492, rx: 0.677, ry: 0.489, precision: true, lens: "sunglasses" },
  { id: "cateye-sun",  name: "Cat Eye Sun",  file: "/frames/photo/cateye-sunglasses.png", lx: 0.245, ly: 0.468, rx: 0.755, ry: 0.468, precision: true, lens: "sunglasses" },
  // New tortoise-acetate round style — a 6th sunglasses option, not a
  // replacement for round-sun (gunmetal wire) since the two don't overlap.
  { id: "round-tortoise-sun", name: "Tortoise Round Sun", file: "/frames/photo/round-tortoise-sunglasses.png", lx: 0.250, ly: 0.474, rx: 0.748, ry: 0.474, precision: true, lens: "sunglasses" },
];

// Same shape-flattering logic the eyeglasses already follow — each sunglasses
// id joins the shape group its silhouette matches (aviator-sun with aviator,
// cateye-sun with cat-eye, etc.), not a separate rule set.
const SHAPE_FRAMES: Record<string, string[]> = {
  Oval:    ["clubmaster","hexagonal","boston","wire-oval","square-thick","aviator","wayfarer","round-smoke","cat-eye","rimless","round-tortoise","navigator","panto-olive","slim-rect","crystal","double-bridge","aviator-sun","wayfarer-sun","round-sun","shield-sun","cateye-sun","round-tortoise-sun"],
  Round:   ["square-thick","wayfarer","aviator","clubmaster","cat-eye","navigator","slim-rect","aviator-sun","wayfarer-sun","cateye-sun","shield-sun"],
  Square:  ["round-smoke","boston","wire-oval","rimless","cat-eye","round-tortoise","panto-olive","crystal","double-bridge","round-sun","cateye-sun","round-tortoise-sun"],
  Heart:   ["cat-eye","boston","round-smoke","rimless","round-tortoise","panto-olive","crystal","cateye-sun","round-sun","round-tortoise-sun"],
  Diamond: ["cat-eye","clubmaster","boston","aviator","navigator","panto-olive","double-bridge","cateye-sun","aviator-sun"],
  Oblong:  ["wayfarer","clubmaster","square-thick","aviator","navigator","slim-rect","crystal","wayfarer-sun","aviator-sun","shield-sun"],
};

const SEASON_FRAMES: Record<string, string[]> = {
  Spring:  ["boston","wire-oval","round-smoke","cat-eye","double-bridge","crystal","round-sun","cateye-sun","round-tortoise-sun"],
  // Sunglasses lean hardest into Summer on purpose — it is the one season
  // where "which sunglasses" is a more useful recommendation than "which
  // eyeglasses".
  Summer:  ["wire-oval","hexagonal","rimless","aviator","crystal","navigator","aviator-sun","wayfarer-sun","shield-sun"],
  Autumn:  ["clubmaster","boston","wayfarer","cat-eye","round-tortoise","panto-olive","wayfarer-sun","cateye-sun"],
  Winter:  ["square-thick","hexagonal","aviator","rimless","navigator","slim-rect","aviator-sun","shield-sun"],
};

function getRecommended(shape: string, season: string | null): Set<string> {
  const byShape  = new Set(SHAPE_FRAMES[shape] ?? FRAMES.map(f => f.id));
  const bySeason = season ? new Set(SEASON_FRAMES[season] ?? []) : null;
  const result   = new Set<string>();
  for (const id of byShape) { if (!bySeason || bySeason.has(id)) result.add(id); }
  return result.size > 0 ? result : byShape;
}

function detectFaceShape(lm: { x: number; y: number }[]): string {
  const d = (a: number, b: number) => Math.hypot(lm[a].x - lm[b].x, lm[a].y - lm[b].y);
  const faceW = d(234, 454); const faceH = d(10, 152);
  const jawW  = d(172, 397); const foreW  = d(54, 284);
  const lenR  = faceH / Math.max(faceW, 0.001);
  const jawR  = jawW  / Math.max(faceW, 0.001);
  const foreR = foreW / Math.max(faceW, 0.001);
  if (lenR > 1.55)              return "Oblong";
  if (jawR > 0.88 && foreR > 0.88) return "Square";
  if (lenR < 1.15)              return "Round";
  if (foreR > jawR + 0.12)     return "Heart";
  if (jawR > foreR + 0.10)     return "Diamond";
  return "Oval";
}

// photoUrl is nullable: the free report reaches this tab before any usable
// front capture exists, and the render below already falls back to the live
// camera in that case. Typing it non-null only hid that from callers.
interface Props { photoUrl: string | null; seasonalColour?: string | null; }

export default function GlassesVirtualTryOn({ photoUrl, seasonalColour }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const photoRef   = useRef<HTMLImageElement | null>(null);
  const eyeRef     = useRef<{
    lEye: {x:number;y:number}; rEye: {x:number;y:number}; faceW: number;
    lIrisR: number; rIrisR: number;
    lLid: {x:number;y:number}[]; rLid: {x:number;y:number}[];
    lAngle: number; rAngle: number;
  } | null>(null);
  const frameImgs  = useRef<Record<string, HTMLImageElement>>({});
  const lensImgs   = useRef<Record<string, HTMLImageElement>>({});
  const redrawRef  = useRef<() => void>(() => {});

  const [frameIdx,  setFrameIdx]  = useState(0);
  const [status,    setStatus]    = useState<"loading"|"ready"|"noface"|"error">("loading");
  const [faceShape, setFaceShape] = useState("Oval");
  const [mode,      setMode]      = useState<"photo"|"live">("photo");
  // Eyeglasses stays the default tab — sunglasses is the newer, smaller set
  // (5 styles vs. 16) and most report readers are here to check how frames
  // read on their actual face, which clear lenses show more honestly than a
  // tinted lens does.
  const [lensType,  setLensType]  = useState<"eyeglasses"|"sunglasses"|"contacts">("eyeglasses");
  const [contactIdx, setContactIdx] = useState(0);

  const frame       = FRAMES[frameIdx];
  const recommended = getRecommended(faceShape, seasonalColour ?? null);
  const visibleFrames = FRAMES.filter((f) => (f.lens ?? "eyeglasses") === lensType);

  // Switching lens type can leave `frameIdx` pointing at a frame from the
  // other type — snap to a sensible choice in the newly-visible set instead
  // of silently rendering a hidden frame's overlay.
  function switchLensType(next: "eyeglasses"|"sunglasses"|"contacts") {
    if (next === lensType) return;
    setLensType(next);
    if (next === "contacts") return;
    const nextVisible = FRAMES.filter((f) => (f.lens ?? "eyeglasses") === next);
    const recIdx = FRAMES.findIndex((f) => nextVisible.includes(f) && recommended.has(f.id));
    setFrameIdx(recIdx >= 0 ? recIdx : FRAMES.indexOf(nextVisible[0]));
  }

  const redraw = useCallback(() => {
    const canvas = canvasRef.current; const photo = photoRef.current;
    const eyes = eyeRef.current; const fImg = frameImgs.current[frame.id];
    if (!canvas || !photo) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(photo, 0, 0, canvas.width, canvas.height);
    if (!eyes) return;
    const cw = canvas.width; const ch = canvas.height;
    if (lensType === "contacts") {
      const activeLens = LENS_TEXTURES[contactIdx];
      if (!activeLens) return;
      const texture = lensImgs.current[activeLens.id];
      if (!texture) {
        // The bulk preload runs once per photo (see the init effect below),
        // keyed off photoUrl/seasonalColour — it does NOT re-run just
        // because LENS_TEXTURES grew, so a tab left open from before a new
        // colour was added would silently no-op here forever otherwise.
        // Lazy-load it on demand and redraw once it's actually in hand.
        const img = new window.Image();
        img.onload = () => { lensImgs.current[activeLens.id] = img; redrawRef.current(); };
        img.src = activeLens.file;
        return;
      }
      const pxScale = (cw + ch) / 2;
      const toPx = (pts: {x:number;y:number}[]) => pts.map(p => ({ x: p.x * cw, y: p.y * ch }));
      // Each call below is independently parameterised from that eye's own
      // measured centre, radius, eyelid contour and axis angle — see
      // drawContactLensEye's own comment for why a full circle isn't drawn.
      drawContactLensEye({
        mainCtx: ctx, texture, textureFill: activeLens.fill,
        cx: eyes.lEye.x * cw, cy: eyes.lEye.y * ch, rPx: eyes.lIrisR * pxScale,
        angle: eyes.lAngle, lidPoly: toPx(eyes.lLid),
      });
      drawContactLensEye({
        mainCtx: ctx, texture, textureFill: activeLens.fill,
        cx: eyes.rEye.x * cw, cy: eyes.rEye.y * ch, rPx: eyes.rIrisR * pxScale,
        angle: eyes.rAngle, lidPoly: toPx(eyes.rLid),
      });
      return;
    }
    if (!fImg) return;
    const lx = eyes.lEye.x*cw; const ly = eyes.lEye.y*ch;
    const rx = eyes.rEye.x*cw; const ry = eyes.rEye.y*ch;
    const angle = Math.atan2(ry-ly, rx-lx);
    const pd    = Math.hypot(rx-lx, ry-ly);
    const mx = (lx+rx)/2; const my = (ly+ry)/2;
    const iw = fImg.naturalWidth; const ih = fImg.naturalHeight;
    // Sunglasses were consistently reading small/tight against the eye line
    // compared to the eyeglasses set — bump their target width a bit rather
    // than touching the shared eyeglasses fit.
    const isSun = frame.lens === "sunglasses";
    const sizeBoost = isSun ? 1.12 : 1;
    const precisionScale = (pd * sizeBoost) / ((frame.rx - frame.lx) * iw);
    const legacyScale = (pd * 1.15) / ((frame.rx - frame.lx) * iw);
    const scale = frame.precision
      ? Math.min(precisionScale, (cw * 0.96) / iw, (ch * (isSun ? 0.46 : 0.42)) / ih)
      : Math.min(legacyScale, (cw * 0.72) / iw, (ch * 0.35) / ih);
    const dw=iw*scale; const dh=ih*scale;
    ctx.save(); ctx.translate(mx,my); ctx.rotate(angle);
    // A frame photographed on a face creates a very small contact shadow at
    // the bridge and rims. Drawing the asset once as a soft shadow gives the
    // transparent product cutout depth without darkening the lenses or face.
    ctx.save();
    ctx.shadowColor = "rgba(18, 12, 9, 0.34)";
    ctx.shadowBlur = Math.max(2, pd * 0.018);
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = Math.max(1, pd * 0.012);
    if (frame.precision) {
      const anchorX = ((frame.lx + frame.rx) / 2) * dw;
      const anchorY = ((frame.ly + frame.ry) / 2) * dh;
      ctx.drawImage(fImg, -anchorX, -anchorY, dw, dh);
    } else {
      ctx.drawImage(fImg,-pd/2-frame.lx*dw,-frame.ly*dh,dw,dh);
    }
    ctx.restore();
    // Crisp second pass keeps the high-resolution frame material and hardware
    // intact; the first pass above contributes only the contact shadow.
    if (frame.precision) {
      const anchorX = ((frame.lx + frame.rx) / 2) * dw;
      const anchorY = ((frame.ly + frame.ry) / 2) * dh;
      ctx.drawImage(fImg, -anchorX, -anchorY, dw, dh);
    } else {
      ctx.drawImage(fImg,-pd/2-frame.lx*dw,-frame.ly*dh,dw,dh);
    }
    ctx.restore();
  }, [frame, lensType, contactIdx]);
  useEffect(() => { redrawRef.current = redraw; }, [redraw]);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        setStatus("loading");
        // No photo means photo mode has nothing to detect against. Bail to the
        // "no photo" state rather than firing an image load at an empty src,
        // which resolves as an error and reports a face-detection failure the
        // user cannot act on.
        if (!photoUrl) { if (!cancelled) setStatus("noface"); return; }
        const photo = new window.Image();
        photo.crossOrigin = "anonymous";
        await new Promise<void>((res,rej) => { photo.onload=()=>res(); photo.onerror=rej; photo.src=photoUrl; });
        if (cancelled) return;
        photoRef.current = photo;
        const canvas = canvasRef.current;
        if (!canvas) return;
        // Sizing the backing store to the *source photo's* resolution (the
        // previous approach, capped at 2048px) still left everything soft:
        // a capture photo commonly comes in around 1280x720, and the CSS
        // `width:100%` below stretches that to whatever the report column
        // actually renders at — often 1800px or more on desktop, and on any
        // 2x/3x display, that CSS box is then upscaled again to physical
        // pixels. Two compounding blurs. Sizing to how large the canvas is
        // actually *displayed* (its real layout width, times device pixel
        // ratio) does the one unavoidable upscale — from the source photo's
        // native detail — inside the canvas itself with high-quality
        // smoothing, once, instead of letting the browser do a second, lower
        // quality stretch on top via CSS. It cannot invent detail the source
        // photo doesn't have, but it stops adding a second layer of blur.
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const displayWidth = canvas.getBoundingClientRect().width || photo.naturalWidth;
        const aspect = photo.naturalHeight / photo.naturalWidth;
        // 2800px ceiling bounds memory on an unusually wide column + 2x
        // display combination rather than growing without limit.
        const targetWidth = Math.min(displayWidth * dpr, 2800);
        canvas.width = Math.round(targetWidth);
        canvas.height = Math.round(targetWidth * aspect);
        const context = canvas.getContext("2d");
        if (context) {
          context.imageSmoothingEnabled = true;
          context.imageSmoothingQuality = "high";
          context.drawImage(photo, 0, 0, canvas.width, canvas.height);
        }
        // Frames only. Lens textures are deliberately NOT preloaded here:
        // eagerly fetching all ten cost every visitor to this tab a download
        // they mostly never use, since Contacts is not the default lens type.
        // redraw() lazy-loads the selected texture on demand instead (and
        // redraws once it lands), so a visitor who never opens Contacts pays
        // nothing for them.
        await Promise.all(FRAMES.map(f => new Promise<void>(res => {
          const img = new window.Image();
          img.onload = () => { frameImgs.current[f.id]=img; res(); };
          img.onerror = () => res();
          img.src = f.file;
        })));
        const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
        const vision  = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm");
        const detector = await FaceLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task", delegate: "CPU" }, runningMode: "IMAGE", numFaces: 1, outputFaceBlendshapes: false, outputFacialTransformationMatrixes: false });
        if (cancelled) { detector.close(); return; }
        const result = detector.detect(photo); detector.close();
        if (!result.faceLandmarks?.length) { setStatus("noface"); return; }
        const lm = result.faceLandmarks[0];
        function eyeCenter(irisIdx: number, corners: number[]) {
          const p = lm[irisIdx];
          if (p) return { x: p.x, y: p.y };
          const pts = corners.map(i => lm[i]).filter(Boolean);
          return { x: pts.reduce((s,p)=>s+p.x,0)/pts.length, y: pts.reduce((s,p)=>s+p.y,0)/pts.length };
        }
        // Iris refinement gives 4 ring points per eye around each centre
        // (469-472 around 468, 474-477 around 473) — average their distance
        // from the centre for a usable iris radius. Falls back to a typical
        // adult iris fraction of eye-corner width when refinement is absent.
        function irisRadius(centerIdx: number, ringIdxs: number[], eyeCorners: number[]) {
          const c = lm[centerIdx];
          const ring = ringIdxs.map(i => lm[i]).filter(Boolean);
          if (c && ring.length) {
            return ring.reduce((s, p) => s + Math.hypot(p.x - c.x, p.y - c.y), 0) / ring.length;
          }
          const pts = eyeCorners.map(i => lm[i]).filter(Boolean);
          if (pts.length >= 2) return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) * 0.22;
          return 0.014;
        }
        // Full eyelid contour per eye (outer corner -> upper lid -> inner
        // corner -> lower lid, reversed, back to outer corner) — this is
        // the actual aperture the lens gets clipped to, so a narrowed or
        // hooded eye shows less iris instead of a full disc regardless of
        // how the lids sit.
        function eyelidPolygon(upperIdx: number[], lowerIdx: number[]) {
          const upper = upperIdx.map(i => lm[i]).filter(Boolean);
          const lowerRev = lowerIdx.slice().reverse().map(i => lm[i]).filter(Boolean);
          return [...upper, ...lowerRev].map(p => ({ x: p.x, y: p.y }));
        }
        // Each eye's own axis angle, from its own outer/inner corners — head
        // tilt and natural per-eye asymmetry mean the two eyes are not
        // guaranteed the same angle, so this is measured independently
        // rather than shared or mirrored between them.
        function eyeAngle(outerIdx: number, innerIdx: number) {
          const o = lm[outerIdx], inn = lm[innerIdx];
          if (!o || !inn) return 0;
          return Math.atan2(inn.y - o.y, inn.x - o.x);
        }
        eyeRef.current = {
          lEye: eyeCenter(468,[33,133,159,145]), rEye: eyeCenter(473,[263,362,386,374]),
          faceW: Math.abs((lm[454]?.x??0)-(lm[234]?.x??0)),
          lIrisR: irisRadius(468,[469,470,471,472],[33,133]),
          rIrisR: irisRadius(473,[474,475,476,477],[263,362]),
          lLid: eyelidPolygon(RIGHT_EYE_UPPER, RIGHT_EYE_LOWER),
          rLid: eyelidPolygon(LEFT_EYE_UPPER, LEFT_EYE_LOWER),
          lAngle: eyeAngle(33, 133),
          rAngle: eyeAngle(263, 362),
        };
        const shape = detectFaceShape(lm as {x:number;y:number}[]);
        setFaceShape(shape);
        const rec = getRecommended(shape, seasonalColour??null);
        const firstRecIdx = FRAMES.findIndex(f => rec.has(f.id));
        if (firstRecIdx >= 0) setFrameIdx(firstRecIdx);
        if (!cancelled) setStatus("ready");
      } catch(e) { console.error(e); if (!cancelled) setStatus("error"); }
    }
    init();
    return () => { cancelled = true; };
  }, [photoUrl, seasonalColour]);

  useEffect(() => { if (status === "ready") redraw(); }, [status, redraw]);

  const download = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const label = lensType === "contacts" ? `contacts-${LENS_TEXTURES[contactIdx].id}` : frame.id;
    const a = document.createElement("a"); a.href=canvas.toDataURL("image/jpeg",0.96); a.download=`percept-${label}-hd.jpg`; a.click();
  };

  // Sidebar picker rows: a horizontal thumbnail-plus-name layout that reads
  // well stacked vertically beside the photo, replacing the old horizontal-
  // scroll strip of column-flex cards that used to sit under the photo.
  // Text colour must come from --btn-fill-ink, not a hardcoded white — in
  // dark mode --btn-fill is a *light* near-white fill (see globals.css), so
  // "#fff" text on it was reading as white-on-white.
  const swatchRowStyle = (active: boolean, rec: boolean): CSSProperties => ({
    display: "flex", alignItems: "center", gap: "1.1rem", width: "100%",
    padding: "0.85rem 1rem",
    border: `1.5px solid ${active ? "var(--btn-fill)" : "var(--line)"}`,
    borderLeft: !active && rec ? "3px solid var(--accent-muted)" : undefined,
    background: active ? "var(--btn-fill)" : "var(--surface)",
    borderRadius: "0.9rem",
    cursor: "pointer",
    textAlign: "left",
    font: "inherit",
    transition: "all 0.15s ease",
    boxShadow: active ? "0 0.3rem 1rem rgba(12, 92, 81, 0.22)" : "none",
    flexShrink: 0,
  });

  const groupLabelStyle: CSSProperties = {
    fontSize: "1.1rem", fontWeight: 700, color: "var(--muted)",
    textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.8rem",
  };
  // Track lives in the styled-jsx block, not here: an inline style object
  // beats a stylesheet rule, so the mobile "let the pill row scroll instead
  // of overflowing the screen" override could never win against it.
  const segmentStyle = (active: boolean): CSSProperties => ({
    height: "3.8rem", padding: "0 1.8rem",
    display: "inline-flex", alignItems: "center", gap: "0.7rem",
    background: active ? "var(--btn-fill)" : "transparent",
    color: active ? "var(--btn-fill-ink)" : "var(--secondary)",
    border: "none", borderRadius: "9999px",
    fontSize: "1.35rem", fontWeight: 600, cursor: "pointer",
    transition: "all 0.15s", whiteSpace: "nowrap",
  });

  return (
    <div style={{ borderTop: "1px solid var(--line)", paddingTop: "4rem" }}>
      {/* Two independent segmented controls, grouped side by side in one
          toolbar row: the mode toggle picks how you're viewing yourself
          (still photo vs. live camera), the lens-type toggle picks which
          5 or 16 frames are on offer. Kept as a single visual block —
          separate floating pill rows read as unrelated/half-finished. */}
      <div className="tryon-toolbar">
        <div>
          <div style={groupLabelStyle}>View</div>
          <div className="tryon-track">
            {(["photo","live"] as const).map(m => (
              <button key={m} onClick={() => setMode(m)} style={segmentStyle(mode===m)}>
                {m === "photo" ? <IconPhoto size={1.6} /> : <IconLiveCamera size={1.6} />}
                {m === "photo" ? "Photo" : "Live Camera"}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div style={groupLabelStyle}>Lens type</div>
          <div className="tryon-track">
            {(["eyeglasses","sunglasses","contacts"] as const).map(t => (
              <button key={t} onClick={() => switchLensType(t)} style={segmentStyle(lensType===t)}>
                {t === "eyeglasses" ? <IconGlasses size={1.6} /> : t === "sunglasses" ? <IconSun size={1.6} /> : <IconEye size={1.6} />}
                {t === "eyeglasses" ? "Eyeglasses" : t === "sunglasses" ? "Sunglasses" : "Contacts"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Photo/live on one side, the swatch picker as a vertical list on the
          other — a tall portrait capture used to push the picker below the
          fold entirely (the taller the photo, the further down it went).
          Putting the picker beside the photo instead of underneath it means
          it's always visible regardless of the photo's aspect ratio. */}
      <div className="tryon-stage">
        <div className="tryon-photo-col">
          {mode === "live" ? (
            <LiveEyewearTryOn frame={frame} lensType={lensType} contactLens={lensType === "contacts" ? LENS_TEXTURES[contactIdx] : undefined} />
          ) : photoUrl && !photoUrl.includes("percept-scan-portrait") ? (
            <div className="tryon-photo-frame">
              <canvas ref={canvasRef} style={{ width: "100%", height: "auto", maxHeight: "64rem", objectFit: "contain", display: "block" }} />
              {(status === "loading" || status === "noface" || status === "error") && (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "1.6rem", background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: "1.5rem", textAlign: "center", padding: "2rem" }}>
                  {status === "loading" && <><div style={{ width: "3.2rem", height: "3.2rem", border: "3px solid rgba(255,255,255,0.2)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /><p>Detecting face…</p></>}
                  {status === "noface" && <p>Face not detected. Try Live Camera instead.</p>}
                  {status === "error"  && <p>Could not load face detection.<br />Try Live Camera.</p>}
                </div>
              )}
            </div>
          ) : (
            <div className="tryon-photo-empty">
              <p style={{ margin: "0 0 1.2rem", fontSize: "1.5rem", color: "var(--secondary)" }}>No photo captured yet.</p>
              <p style={{ margin: 0, fontSize: "1.3rem", color: "var(--muted)" }}>Use <strong>Live Camera</strong> above to try on frames in real time.</p>
            </div>
          )}
        </div>

        {lensType === "contacts" && (status === "ready" || mode === "live") && (
          <div className="tryon-sidebar">
            <div className="tryon-sidebar-header">
              <span className="tryon-sidebar-title">Choose a lens shade</span>
              <p className="tryon-sidebar-subtitle">See how each colour reads against your natural eye.</p>
            </div>

            <div className="tryon-sidebar-list">
              {LENS_TEXTURES.map((l, i) => {
                const active = i === contactIdx;
                return (
                  <button key={l.id} onClick={() => setContactIdx(i)} style={swatchRowStyle(active, false)}>
                    <span style={{
                      width: "4.2rem", height: "4.2rem", borderRadius: "50%", flexShrink: 0,
                      overflow: "hidden", border: `2px solid ${active ? "var(--btn-fill-ink)" : "var(--line-strong)"}`,
                      boxShadow: "0 1px 4px rgba(0,0,0,0.18)", background: "var(--wash)",
                    }}>
                      <Image src={l.file} alt={l.name} width={84} height={84}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }} unoptimized />
                    </span>
                    <span style={{ flex: 1, fontSize: "1.3rem", fontWeight: 700, color: active ? "var(--btn-fill-ink)" : "var(--primary)" }}>{l.name}</span>
                    {active && <span style={{ color: "var(--btn-fill-ink)", flexShrink: 0, display: "flex" }}><IconCheck size={1.5} strokeWidth={2.8} /></span>}
                  </button>
                );
              })}
            </div>

            <div className="tryon-sidebar-footer">
              <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                <span className="tryon-sidebar-selected-label">Selected</span>
                <span className="tryon-sidebar-selected-name">{LENS_TEXTURES[contactIdx].name}</span>
              </div>
              {/* Live mode has its own canvas + Capture button inside
                  LiveEyewearTryOn — this Save reads canvasRef, the photo-mode
                  canvas, which is unrelated/blank while mode is "live". */}
              {mode === "photo" && status === "ready" && (
                <button onClick={download} className="tryon-save-btn">
                  <IconPhoto size={1.5} /> Save photo
                </button>
              )}
            </div>
          </div>
        )}

        {lensType !== "contacts" && (status === "ready" || mode === "live") && (
          <div className="tryon-sidebar">
            <div className="tryon-sidebar-header">
              <span className="tryon-sidebar-title">
                {faceShape} face{seasonalColour ? ` · ${seasonalColour} season` : ""}
              </span>
              <p className="tryon-sidebar-subtitle">
                Styles marked <span className="tryon-rec-tag"><IconSparkle size={0.85} strokeWidth={3} /> Best for you</span> suit your face shape and season.
              </p>
            </div>

            <div className="tryon-sidebar-list">
              {visibleFrames.map((f) => {
                const isRec  = recommended.has(f.id);
                const active = f === frame;
                return (
                  <button key={f.id} onClick={() => setFrameIdx(FRAMES.indexOf(f))} style={swatchRowStyle(active, isRec)}>
                    <Image
                      src={f.file}
                      alt={f.name}
                      width={72}
                      height={30}
                      style={{
                        width: "7.2rem", height: "3rem", flexShrink: 0,
                        padding: "0.2rem 0.4rem",
                        objectFit: "contain",
                        background: "rgba(255,255,255,0.96)",
                        borderRadius: "0.5rem",
                        filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.12))",
                      }}
                      unoptimized
                    />
                    <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.15rem", minWidth: 0 }}>
                      <span style={{ fontSize: "1.3rem", fontWeight: 700, color: active ? "var(--btn-fill-ink)" : "var(--primary)" }}>{f.name}</span>
                      {isRec && (
                        <span style={{ fontSize: "1.05rem", fontWeight: 600, color: active ? "var(--btn-fill-ink)" : "var(--accent-muted)", opacity: active ? 0.85 : 1 }}>
                          Best for you
                        </span>
                      )}
                    </span>
                    {active && <span style={{ color: "var(--btn-fill-ink)", flexShrink: 0, display: "flex" }}><IconCheck size={1.5} strokeWidth={2.8} /></span>}
                  </button>
                );
              })}
            </div>

            <div className="tryon-sidebar-footer">
              <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                <span className="tryon-sidebar-selected-label">Selected</span>
                <span className="tryon-sidebar-selected-name">{frame.name}</span>
              </div>
              {mode === "photo" && status === "ready" && (
                <button onClick={download} className="tryon-save-btn">
                  <IconPhoto size={1.5} /> Save photo
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      <style jsx>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .tryon-toolbar { display: flex; flex-wrap: wrap; gap: 2.8rem; margin-bottom: 2.4rem; }
        .tryon-track { display: inline-flex; gap: 0.2rem; padding: 0.4rem; background: var(--wash); border: 1px solid var(--line); border-radius: 9999px; }
        /* One bordered card holds both columns, so the try-on reads as a
           single component rather than a photo with loose controls floating
           beside it. Verified at 1440 / 1000 / 420px in a static harness
           before landing — earlier passes were changed blind and the photo
           column kept collapsing to a sliver at in-between widths. */
        .tryon-stage {
          display: flex; align-items: stretch; gap: 2rem;
          padding: 2rem; border: 1px solid var(--line); border-radius: 1.6rem;
          background: var(--surface);
        }
        .tryon-photo-col { flex: 1 1 34rem; min-width: 0; display: flex; flex-direction: column; }
        .tryon-photo-frame {
          position: relative; flex: 1; display: flex; align-items: center; justify-content: center;
          background: #111; border-radius: 1.1rem; overflow: hidden;
          min-height: 34rem; max-height: 64rem; line-height: 0;
        }
        .tryon-photo-empty {
          flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
          min-height: 34rem; padding: 4rem 2rem; text-align: center;
          background: var(--wash); border: 1px solid var(--line); border-radius: 1.1rem;
        }
        /* Sidebar gets its own panel treatment so the picker reads as a
           distinct region inside the card, not text dumped next to a photo. */
        .tryon-sidebar {
          display: flex; flex-direction: column; width: 30rem; flex-shrink: 0;
          border: 1px solid var(--line); border-radius: 1.1rem; background: var(--canvas);
          padding: 1.6rem; max-height: 64rem;
        }
        .tryon-sidebar-header { flex-shrink: 0; padding-bottom: 1.2rem; margin-bottom: 1.2rem; border-bottom: 1px solid var(--line); }
        .tryon-sidebar-title { display: block; font-size: 1.45rem; font-weight: 750; color: var(--primary); letter-spacing: -0.01em; }
        .tryon-sidebar-subtitle { margin: 0.45rem 0 0; font-size: 1.15rem; line-height: 1.5; color: var(--secondary); }
        .tryon-rec-tag { display: inline-flex; align-items: center; gap: 0.3rem; color: var(--accent-muted); font-weight: 700; white-space: nowrap; }
        .tryon-sidebar-list { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 0.7rem; padding-right: 0.5rem; margin-right: -0.5rem; }
        .tryon-sidebar-list::-webkit-scrollbar { width: 6px; }
        .tryon-sidebar-list::-webkit-scrollbar-thumb { background: var(--line-strong); border-radius: 99px; }
        .tryon-sidebar-footer { flex-shrink: 0; margin-top: 1.3rem; padding-top: 1.3rem; border-top: 1px solid var(--line); display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
        .tryon-sidebar-selected-label { display: block; font-size: 1rem; font-weight: 700; color: var(--secondary); text-transform: uppercase; letter-spacing: 0.05em; }
        .tryon-sidebar-selected-name { display: block; font-size: 1.55rem; font-weight: 750; color: var(--primary); letter-spacing: -0.01em; margin-top: 0.1rem; }
        .tryon-save-btn { flex-shrink: 0; height: 4.2rem; padding: 0 1.8rem; background: var(--btn-fill); color: var(--btn-fill-ink); border: none; border-radius: 9999px; font-size: 1.25rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 0.6rem; transition: background 0.15s ease; }
        .tryon-save-btn:hover { background: var(--btn-fill-hover); }
        @media (max-width: 900px) {
          .tryon-stage { flex-direction: column; padding: 1.4rem; gap: 1.4rem; }
          .tryon-photo-col { width: 100%; }
          .tryon-photo-frame, .tryon-photo-empty { min-height: 32rem; }
          .tryon-sidebar { width: 100%; max-height: none; }
          .tryon-sidebar-list { max-height: 30rem; }
        }
        @media (max-width: 620px) {
          /* The lens-type pill track was wider than a phone screen, so
             "Contacts" fell off the edge and the whole page scrolled
             sideways. Give the track its own horizontal scroll instead. */
          .tryon-toolbar { gap: 1.6rem; }
          .tryon-toolbar > div { width: 100%; min-width: 0; }
          .tryon-track { display: flex; width: 100%; overflow-x: auto; scrollbar-width: none; }
          .tryon-track::-webkit-scrollbar { display: none; }
        }
      `}</style>
    </div>
  );
}
