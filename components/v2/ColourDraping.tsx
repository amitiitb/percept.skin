"use client";
import { useEffect, useRef, useState } from "react";
import type { ColourAnalysis, ColourSwatch } from "@/lib/v2/types";

/**
 * Colour draping — composites the user's front photo with a fabric "drape"
 * drawn on canvas in each palette colour. The drape is anchored to the
 * detected chin position (MediaPipe Face Landmarker) so it sits naturally
 * on the neck/shoulders for any selfie. Pure client-side, no image API.
 */

const CAPTIONS = [
  "brightens and harmonizes",
  "adds depth and richness",
  "enhances natural colour",
  "anchors the look",
  "adds polished elegance",
  "softly illuminates",
  "brings fresh harmony",
  "creates clean definition",
  "soothes and complements",
  "clarifies and refreshes",
];

function captionFor(index: number) {
  return CAPTIONS[index % CAPTIONS.length];
}

/** Drape anchor in normalized (0–1) coords of a 4:5 cover-fitted canvas. */
interface DrapeAnchor {
  cx: number;    // face centre x
  topY: number;  // where the fabric's top edge should sit (below chin)
  faceW: number; // face width, for shadow sizing
  /* Face box in normalized IMAGE coords (unmirrored) — used for circle crops */
  imgCx: number;
  imgCy: number;
  imgFaceW: number;
}

const DEFAULT_ANCHOR: DrapeAnchor = {
  cx: 0.5, topY: 0.70, faceW: 0.42,
  imgCx: 0.5, imgCy: 0.42, imgFaceW: 0.45,
};

/** Map a normalized image-landmark to normalized canvas coords (cover fit + mirror). */
function makeMapper(nw: number, nh: number, W: number, H: number) {
  const scale = Math.max(W / nw, H / nh);
  const dw = nw * scale;
  const dh = nh * scale;
  const ox = (W - dw) / 2;
  const oy = (H - dh) / 2;
  return (lx: number, ly: number) => ({
    x: (W - (ox + lx * nw * scale)) / W, // mirrored
    y: (oy + ly * nh * scale) / H,
  });
}

async function detectAnchor(img: HTMLImageElement): Promise<DrapeAnchor | null> {
  try {
    const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm",
    );
    const detector = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
      },
      runningMode: "IMAGE",
      numFaces: 1,
    });
    const result = detector.detect(img);
    detector.close();

    const lm = result.faceLandmarks?.[0];
    if (!lm) return null;

    // Virtual 4:5 canvas — all tiles share this aspect ratio
    const map = makeMapper(img.naturalWidth, img.naturalHeight, 400, 500);
    const chin = map(lm[152].x, lm[152].y);      // chin bottom
    const top = map(lm[10].x, lm[10].y);         // forehead top
    const left = map(lm[234].x, lm[234].y);      // face side
    const right = map(lm[454].x, lm[454].y);     // face side

    const faceH = Math.abs(chin.y - top.y);
    const faceW = Math.abs(left.x - right.x);
    const cx = (left.x + right.x) / 2;

    return {
      cx: Math.min(0.75, Math.max(0.25, cx)),
      // Fabric top edge sits on the neck, just below the chin
      topY: Math.min(0.82, chin.y + faceH * 0.12),
      faceW: Math.min(0.7, Math.max(0.25, faceW)),
      imgCx: (lm[234].x + lm[454].x) / 2,
      imgCy: (lm[10].y + lm[152].y) / 2,
      imgFaceW: Math.abs(lm[454].x - lm[234].x),
    };
  } catch {
    return null;
  }
}

/**
 * Auto-enhance for dim selfies: measure average luminance of the centre
 * region and return a CSS canvas filter that lifts brightness/contrast.
 */
function computeEnhanceFilter(img: HTMLImageElement): string {
  try {
    const s = 64;
    const off = document.createElement("canvas");
    off.width = s;
    off.height = s;
    const octx = off.getContext("2d", { willReadFrequently: true });
    if (!octx) return "none";
    octx.drawImage(img, 0, 0, s, s);
    const { data } = octx.getImageData(s * 0.25, s * 0.15, s * 0.5, s * 0.6);
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
    const avg = sum / (data.length / 4);
    // Target a bright, editorial look (~150/255) without blowing out
    const brightness = Math.min(1.35, Math.max(1, 150 / Math.max(avg, 1)));
    return `brightness(${brightness.toFixed(2)}) contrast(1.05) saturate(1.06)`;
  } catch {
    return "none"; // tainted canvas or decode issue — draw unenhanced
  }
}

function drawDrape(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  colour: string,
  anchor: DrapeAnchor,
  enhance: string = "none",
) {
  const W = canvas.width;
  const H = canvas.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  /* Photo — cover fit, mirrored to match the selfie view used elsewhere */
  const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.save();
  ctx.filter = enhance;
  ctx.translate(W, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
  ctx.restore();

  const cx = anchor.cx * W;
  const topC = anchor.topY * H;          // centre of the neckline
  const shoulderY = topC + H * 0.022;    // edges barely lower — near-straight edge
  const faceW = anchor.faceW * W;

  /* Drape outline: near-straight top edge with a gentle dip under the chin */
  const drape = () => {
    ctx.beginPath();
    ctx.moveTo(-4, H + 4);
    ctx.lineTo(-4, shoulderY);
    ctx.bezierCurveTo(
      cx - faceW * 1.2, shoulderY - H * 0.004,
      cx - faceW * 0.55, topC + H * 0.002,
      cx, topC,
    );
    ctx.bezierCurveTo(
      cx + faceW * 0.55, topC + H * 0.002,
      cx + faceW * 1.2, shoulderY - H * 0.004,
      W + 4, shoulderY,
    );
    ctx.lineTo(W + 4, H + 4);
    ctx.closePath();
  };

  /* Soft drop shadow above the fabric edge (fabric casts onto neck/bg) */
  ctx.save();
  drape();
  ctx.shadowColor = "rgba(0,0,0,0.28)";
  ctx.shadowBlur = W * 0.03;
  ctx.shadowOffsetY = -W * 0.008;
  ctx.fillStyle = colour;
  ctx.fill();
  ctx.restore();

  /* Everything below clips to the drape */
  ctx.save();
  drape();
  ctx.clip();

  /* Base shading: darker toward the bottom + sides for volume */
  const base = ctx.createLinearGradient(0, topC, 0, H);
  base.addColorStop(0, "rgba(255,255,255,0.10)");
  base.addColorStop(0.35, "rgba(255,255,255,0)");
  base.addColorStop(1, "rgba(0,0,0,0.22)");
  ctx.fillStyle = base;
  ctx.fillRect(0, topC - 10, W, H - topC + 10);

  const sideL = ctx.createLinearGradient(0, 0, W * 0.28, 0);
  sideL.addColorStop(0, "rgba(0,0,0,0.20)");
  sideL.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = sideL;
  ctx.fillRect(0, topC - 10, W * 0.28, H - topC + 10);

  const sideR = ctx.createLinearGradient(W, 0, W * 0.72, 0);
  sideR.addColorStop(0, "rgba(0,0,0,0.20)");
  sideR.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = sideR;
  ctx.fillRect(W * 0.72, topC - 10, W * 0.28, H - topC + 10);

  /* Fabric folds: soft blurred strokes fanning down from the neckline */
  const folds = [
    { fx: cx - faceW * 0.85, sway: -0.06, light: false },
    { fx: cx - faceW * 0.45, sway: -0.03, light: true  },
    { fx: cx - faceW * 0.12, sway: -0.01, light: false },
    { fx: cx + faceW * 0.12, sway:  0.01, light: true  },
    { fx: cx + faceW * 0.45, sway:  0.03, light: false },
    { fx: cx + faceW * 0.85, sway:  0.06, light: true  },
  ];
  ctx.filter = `blur(${Math.max(4, W * 0.02)}px)`;
  for (const f of folds) {
    ctx.beginPath();
    ctx.moveTo(f.fx, topC + H * 0.01);
    ctx.quadraticCurveTo(f.fx + f.sway * W, topC + (H - topC) * 0.55, f.fx + f.sway * W * 2.2, H);
    ctx.strokeStyle = f.light ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.20)";
    ctx.lineWidth = W * (f.light ? 0.035 : 0.045);
    ctx.stroke();
  }
  ctx.filter = "none";

  /* Chin / neck shadow cast onto the fabric */
  const shadow = ctx.createRadialGradient(cx, topC + H * 0.015, faceW * 0.05, cx, topC + H * 0.015, faceW * 0.75);
  shadow.addColorStop(0, "rgba(0,0,0,0.30)");
  shadow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = shadow;
  ctx.fillRect(cx - faceW, topC - 10, faceW * 2, H * 0.3);

  /* Rolled edge highlight along the neckline */
  ctx.filter = `blur(${Math.max(2, W * 0.008)}px)`;
  ctx.beginPath();
  ctx.moveTo(0, shoulderY + H * 0.018);
  ctx.bezierCurveTo(cx - faceW * 0.72, topC + H * 0.02, cx - faceW * 0.3, topC + H * 0.012, cx, topC + H * 0.012);
  ctx.bezierCurveTo(cx + faceW * 0.3, topC + H * 0.012, cx + faceW * 0.72, topC + H * 0.02, W, shoulderY + H * 0.018);
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = W * 0.012;
  ctx.stroke();
  ctx.filter = "none";

  ctx.restore();
}

/** Face in a circle, surrounded by a fabric-coloured ring — palette sheet style. */
function drawCircleTile(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  colour: string,
  anchor: DrapeAnchor,
  enhance: string = "none",
) {
  const S = canvas.width; // square
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, S, S);

  const cx = S / 2;
  const cy = S / 2;
  const rOuter = S * 0.48;
  const rInner = S * 0.335;

  /* Fabric disc */
  ctx.beginPath();
  ctx.arc(cx, cy, rOuter, 0, Math.PI * 2);
  ctx.fillStyle = colour;
  ctx.fill();

  /* Ring shading: soft volume, darker rim outside (fabric sits BEHIND the face) */
  const ring = ctx.createRadialGradient(cx, cy, rInner * 0.9, cx, cy, rOuter);
  ring.addColorStop(0, "rgba(255,255,255,0.10)");
  ring.addColorStop(0.75, "rgba(0,0,0,0)");
  ring.addColorStop(1, "rgba(0,0,0,0.22)");
  ctx.beginPath();
  ctx.arc(cx, cy, rOuter, 0, Math.PI * 2);
  ctx.fillStyle = ring;
  ctx.fill();

  /* Radial fabric folds on the ring */
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, rOuter, 0, Math.PI * 2);
  ctx.arc(cx, cy, rInner, 0, Math.PI * 2, true);
  ctx.clip("evenodd");
  ctx.filter = `blur(${Math.max(3, S * 0.015)}px)`;
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI * 2 * i) / 10 + 0.35;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * rInner * 0.98, cy + Math.sin(a) * rInner * 0.98);
    ctx.lineTo(cx + Math.cos(a + 0.09) * rOuter * 1.02, cy + Math.sin(a + 0.09) * rOuter * 1.02);
    ctx.strokeStyle = i % 2 === 0 ? "rgba(0,0,0,0.16)" : "rgba(255,255,255,0.12)";
    ctx.lineWidth = S * 0.03;
    ctx.stroke();
  }
  ctx.filter = "none";
  /* Sheen highlight top-left of the ring */
  const sheen = ctx.createLinearGradient(cx - rOuter, cy - rOuter, cx + rOuter, cy + rOuter);
  sheen.addColorStop(0, "rgba(255,255,255,0.16)");
  sheen.addColorStop(0.5, "rgba(255,255,255,0)");
  sheen.addColorStop(1, "rgba(0,0,0,0.10)");
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, S, S);
  ctx.restore();

  /* Face circle casts a soft shadow onto the fabric — reads as in-front */
  const drop = ctx.createRadialGradient(cx, cy + S * 0.008, rInner * 0.96, cx, cy + S * 0.008, rInner * 1.16);
  drop.addColorStop(0, "rgba(0,0,0,0.30)");
  drop.addColorStop(1, "rgba(0,0,0,0)");
  ctx.beginPath();
  ctx.arc(cx, cy + S * 0.008, rInner * 1.16, 0, Math.PI * 2);
  ctx.fillStyle = drop;
  ctx.fill();

  /* Face crop on top of the fabric disc */
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, rInner, 0, Math.PI * 2);
  ctx.clip();

  // Scale so the detected face spans most of the inner circle
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  const targetFaceW = rInner * 2 * 0.72;
  const scale = targetFaceW / (anchor.imgFaceW * nw);
  const dw = nw * scale;
  const dh = nh * scale;

  ctx.filter = enhance;
  ctx.translate(S, 0);
  ctx.scale(-1, 1); // mirror to match selfie view
  const dx = S / 2 - anchor.imgCx * dw;
  const dy = cy - anchor.imgCy * dh;
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();

  /* Subtle light edge so the face circle reads as a layer on top */
  ctx.beginPath();
  ctx.arc(cx, cy, rInner, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = Math.max(1.5, S * 0.008);
  ctx.stroke();
}

function CircleTile({
  img, colour, anchor, enhance, size = 220,
}: { img: HTMLImageElement | null; colour: string; anchor: DrapeAnchor; enhance: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (ref.current && img) drawCircleTile(ref.current, img, colour, anchor, enhance);
  }, [img, colour, anchor, enhance]);

  return (
    <canvas
      ref={ref}
      width={size}
      height={size}
      style={{ width: "100%", height: "auto", display: "block" }}
    />
  );
}

function DrapedPhoto({
  img, colour, anchor, enhance, width = 300, height = 375,
}: { img: HTMLImageElement | null; colour: string; anchor: DrapeAnchor; enhance: string; width?: number; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (ref.current && img) drawDrape(ref.current, img, colour, anchor, enhance);
  }, [img, colour, anchor, enhance]);

  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      style={{ width: "100%", height: "auto", display: "block", borderRadius: "0.8rem", background: "var(--wash)" }}
    />
  );
}

// Shared photo-load + face-anchor-detection state, used by both the "suits
// you" and "avoid" draped sections below so the (expensive) MediaPipe
// detection only runs once per photo, not once per section.
function useDrapeState(photo: string | null) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [imgError, setImgError] = useState(false);
  const [anchor, setAnchor] = useState<DrapeAnchor>(DEFAULT_ANCHOR);
  const [enhance, setEnhance] = useState("none");

  useEffect(() => {
    if (!photo) return;
    let cancelled = false;
    const el = new Image();
    if (photo.startsWith("http")) el.crossOrigin = "anonymous";
    el.onload = async () => {
      if (cancelled) return;
      setEnhance(computeEnhanceFilter(el)); // brighten dim photos
      setImg(el);
      const detected = await detectAnchor(el);
      if (!cancelled && detected) setAnchor(detected);
    };
    el.onerror = () => setImgError(true);
    el.src = photo;
    return () => { cancelled = true; };
  }, [photo]);

  return { img, imgError, anchor, enhance };
}

function DrapedRow({
  swatches, img, anchor, enhance, captionBg, captionColor, badgeLabel, badgeColor,
}: {
  swatches: ColourSwatch[]; img: HTMLImageElement | null; anchor: DrapeAnchor; enhance: string;
  captionBg: string; captionColor: string; badgeLabel: string; badgeColor: string;
}) {
  if (swatches.length === 0) return null;
  return (
    <div className="drape-heroes" style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(swatches.length, 3)}, 1fr)`, gap: "1.6rem" }}>
      {swatches.map((c, i) => (
        <figure key={c.hex + i} style={{ margin: 0 }}>
          <p style={{ fontSize: "1.2rem", fontWeight: 700, color: badgeColor, textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 1rem", textAlign: "center" }}>
            {badgeLabel}
          </p>
          <div style={{ borderRadius: "1rem", overflow: "hidden", border: "1px solid var(--line)" }}>
            <DrapedPhoto img={img} colour={c.hex} anchor={anchor} enhance={enhance} width={360} height={450} />
            <figcaption style={{ background: captionBg, color: captionColor, fontSize: "1.3rem", fontStyle: "italic", textAlign: "center", padding: "0.9rem 1.2rem" }}>
              {captionFor(i)}
            </figcaption>
          </div>
          <p style={{ fontSize: "1.4rem", fontWeight: 500, color: "var(--primary)", textAlign: "center", margin: "1rem 0 0" }}>
            {c.name} <span style={{ color: "var(--muted)", fontWeight: 400 }}>{c.hex.toUpperCase()}</span>
          </p>
        </figure>
      ))}
    </div>
  );
}

/** "Colours that suit you" — draped photo, top best colours only (report-style, not a full catalogue). */
export function SuitsYouDraping({ photo, analysis }: { photo: string | null; analysis: ColourAnalysis }) {
  const { img, imgError, anchor, enhance } = useDrapeState(photo);
  if (!photo || imgError) return null;
  const heroes = analysis.best_colours.slice(0, 3);
  return (
    <DrapedRow swatches={heroes} img={img} anchor={anchor} enhance={enhance}
      captionBg="var(--primary)" captionColor="rgba(255,255,255,0.92)" badgeLabel="Suits you" badgeColor="var(--primary)" />
  );
}

/** "Colours to avoid" — same draped treatment, worst colours, warning-toned caption. */
export function AvoidDraping({ photo, analysis }: { photo: string | null; analysis: ColourAnalysis }) {
  const { img, imgError, anchor, enhance } = useDrapeState(photo);
  if (!photo || imgError) return null;
  const worst = analysis.worst_colours.slice(0, 3);
  return (
    <DrapedRow swatches={worst} img={img} anchor={anchor} enhance={enhance}
      captionBg="#8C3A2E" captionColor="rgba(255,255,255,0.92)" badgeLabel="Avoid" badgeColor="#8C3A2E" />
  );
}

// Legacy default export — kept for the old (pre-v2) app, unchanged behaviour.
export default function ColourDraping({
  photo, analysis,
}: { photo: string | null; analysis: ColourAnalysis }) {
  const { img, imgError, anchor, enhance } = useDrapeState(photo);
  if (!photo || imgError) return null;

  const heroes: ColourSwatch[] = analysis.best_colours.slice(0, 3);
  const rest: ColourSwatch[] = [
    ...analysis.best_colours.slice(3),
    ...analysis.neutrals,
  ];

  return (
    <div style={{ marginTop: "4rem" }}>
      <p style={{ fontSize: "1.3rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.8rem" }}>
        Colour Draping
      </p>
      <p style={{ fontSize: "1.6rem", color: "var(--secondary)", lineHeight: 1.55, margin: "0 0 2.4rem" }}>
        See your best colours on you, your photo draped in the {analysis.sub_season} palette.
      </p>

      <div className="drape-heroes" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.6rem", marginBottom: "2.4rem" }}>
        {heroes.map((c, i) => (
          <figure key={c.hex + i} style={{ margin: 0 }}>
            <p style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 1rem", textAlign: "center" }}>
              Best colour
            </p>
            <div style={{ borderRadius: "1rem", overflow: "hidden", border: "1px solid var(--line)" }}>
              <DrapedPhoto img={img} colour={c.hex} anchor={anchor} enhance={enhance} width={360} height={450} />
              <figcaption style={{ background: "var(--primary)", color: "rgba(255,255,255,0.92)", fontSize: "1.3rem", fontStyle: "italic", textAlign: "center", padding: "0.9rem 1.2rem" }}>
                {captionFor(i)}
              </figcaption>
            </div>
            <p style={{ fontSize: "1.4rem", fontWeight: 500, color: "var(--primary)", textAlign: "center", margin: "1rem 0 0" }}>
              {c.name} <span style={{ color: "var(--muted)", fontWeight: 400 }}>{c.hex.toUpperCase()}</span>
            </p>
          </figure>
        ))}
      </div>

      {rest.length > 0 && (
        <>
          <p style={{ fontSize: "1.5rem", color: "var(--secondary)", fontStyle: "italic", textAlign: "center", margin: "0 0 1.6rem" }}>
            {analysis.sub_season} palette on you
          </p>
          <div className="drape-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(13rem, 1fr))", gap: "1.4rem" }}>
            {rest.map((c, i) => (
              <figure key={c.hex + i} style={{ margin: 0 }}>
                <div style={{ borderRadius: "0.8rem", overflow: "hidden", border: "1px solid var(--line)" }}>
                  <DrapedPhoto img={img} colour={c.hex} anchor={anchor} enhance={enhance} width={200} height={250} />
                </div>
                <p style={{ fontSize: "1.3rem", fontWeight: 500, color: "var(--primary)", textAlign: "center", margin: "0.8rem 0 0", lineHeight: 1.3 }}>
                  {c.name}
                  <br />
                  <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: "1.1rem" }}>{c.hex.toUpperCase()}</span>
                  <br />
                  <span style={{ color: "var(--secondary)", fontWeight: 400, fontSize: "1.1rem", fontStyle: "italic" }}>{captionFor(i + 3)}</span>
                </p>
              </figure>
            ))}
          </div>
        </>
      )}

      {rest.length > 0 && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "1.2rem", padding: "3.2rem 2.4rem", marginTop: "2.4rem" }}>
          <p style={{ fontSize: "1.8rem", color: "var(--primary)", fontWeight: 500, textAlign: "center", margin: "0 0 2.4rem" }}>
            {analysis.sub_season} palette · quick reference
          </p>
          <div className="drape-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(14rem, 1fr))", gap: "2rem 1.4rem" }}>
            {[...heroes, ...rest].map((c, i) => (
              <figure key={c.hex + i} style={{ margin: 0 }}>
                <CircleTile img={img} colour={c.hex} anchor={anchor} enhance={enhance} size={240} />
                <p style={{ fontSize: "1.3rem", fontWeight: 600, color: "var(--primary)", textAlign: "center", margin: "1rem 0 0", lineHeight: 1.4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {c.name}
                  <br />
                  <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: "1.1rem", textTransform: "none", letterSpacing: 0 }}>{c.hex.toUpperCase()}</span>
                </p>
              </figure>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 640px) {
          .drape-heroes { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
