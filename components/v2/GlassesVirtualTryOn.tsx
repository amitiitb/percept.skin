"use client";
import React, { useEffect, useRef, useState, useCallback, CSSProperties } from "react";
import Image from "next/image";
import LiveEyewearTryOn from "./LiveEyewearTryOn";

interface FrameDef {
  id: string;
  name: string;
  file: string;
  lx: number;
  ly: number;
  rx: number;
  ry: number;
  precision?: boolean;
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
];

const SHAPE_FRAMES: Record<string, string[]> = {
  Oval:    ["clubmaster","hexagonal","boston","wire-oval","square-thick","aviator","wayfarer","round-smoke","cat-eye","rimless"],
  Round:   ["square-thick","wayfarer","aviator","clubmaster","cat-eye"],
  Square:  ["round-smoke","boston","wire-oval","rimless","cat-eye"],
  Heart:   ["cat-eye","boston","round-smoke","rimless"],
  Diamond: ["cat-eye","clubmaster","boston","aviator"],
  Oblong:  ["wayfarer","clubmaster","square-thick","aviator"],
};

const SEASON_FRAMES: Record<string, string[]> = {
  Spring:  ["boston","wire-oval","round-smoke","cat-eye"],
  Summer:  ["wire-oval","hexagonal","rimless","aviator"],
  Autumn:  ["clubmaster","boston","wayfarer","cat-eye"],
  Winter:  ["square-thick","hexagonal","aviator","rimless"],
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

interface Props { photoUrl: string; seasonalColour?: string | null; }

export default function GlassesVirtualTryOn({ photoUrl, seasonalColour }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const photoRef   = useRef<HTMLImageElement | null>(null);
  const eyeRef     = useRef<{ lEye: {x:number;y:number}; rEye: {x:number;y:number}; faceW: number } | null>(null);
  const frameImgs  = useRef<Record<string, HTMLImageElement>>({});

  const [frameIdx,  setFrameIdx]  = useState(0);
  const [status,    setStatus]    = useState<"loading"|"ready"|"noface"|"error">("loading");
  const [faceShape, setFaceShape] = useState("Oval");
  const [mode,      setMode]      = useState<"photo"|"live">("photo");

  const frame       = FRAMES[frameIdx];
  const recommended = getRecommended(faceShape, seasonalColour ?? null);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current; const photo = photoRef.current;
    const eyes = eyeRef.current; const fImg = frameImgs.current[frame.id];
    if (!canvas || !photo) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(photo, 0, 0, canvas.width, canvas.height);
    if (!eyes || !fImg) return;
    const cw = canvas.width; const ch = canvas.height;
    const lx = eyes.lEye.x*cw; const ly = eyes.lEye.y*ch;
    const rx = eyes.rEye.x*cw; const ry = eyes.rEye.y*ch;
    const angle = Math.atan2(ry-ly, rx-lx);
    const pd    = Math.hypot(rx-lx, ry-ly);
    const mx = (lx+rx)/2; const my = (ly+ry)/2;
    const iw = fImg.naturalWidth; const ih = fImg.naturalHeight;
    const precisionScale = pd / ((frame.rx - frame.lx) * iw);
    const legacyScale = (pd * 1.15) / ((frame.rx - frame.lx) * iw);
    const scale = frame.precision
      ? Math.min(precisionScale, (cw * 0.96) / iw, (ch * 0.42) / ih)
      : Math.min(legacyScale, (cw * 0.72) / iw, (ch * 0.35) / ih);
    const dw=iw*scale; const dh=ih*scale;
    ctx.save(); ctx.translate(mx,my); ctx.rotate(angle);
    if (frame.precision) {
      const anchorX = ((frame.lx + frame.rx) / 2) * dw;
      const anchorY = ((frame.ly + frame.ry) / 2) * dh;
      ctx.drawImage(fImg, -anchorX, -anchorY, dw, dh);
    } else {
      ctx.drawImage(fImg,-pd/2-frame.lx*dw,-frame.ly*dh,dw,dh);
    }
    ctx.restore();
  }, [frame]);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        setStatus("loading");
        const photo = new window.Image();
        photo.crossOrigin = "anonymous";
        await new Promise<void>((res,rej) => { photo.onload=()=>res(); photo.onerror=rej; photo.src=photoUrl; });
        if (cancelled) return;
        photoRef.current = photo;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const s = Math.min(1, 960/photo.naturalWidth);
        canvas.width = photo.naturalWidth*s; canvas.height = photo.naturalHeight*s;
        canvas.getContext("2d")?.drawImage(photo, 0, 0, canvas.width, canvas.height);
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
        eyeRef.current = { lEye: eyeCenter(468,[33,133,159,145]), rEye: eyeCenter(473,[263,362,386,374]), faceW: Math.abs((lm[454]?.x??0)-(lm[234]?.x??0)) };
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

  const download = () => { const canvas = canvasRef.current; if (!canvas) return; const a = document.createElement("a"); a.href=canvas.toDataURL("image/jpeg",0.92); a.download=`glowmetry-${frame.id}.jpg`; a.click(); };

  const btnStyle = (active: boolean, rec: boolean): CSSProperties => ({
    display: "flex", flexDirection: "column", alignItems: "center", gap: "0.6rem",
    padding: "1.2rem 1.6rem",
    border: `1px solid ${active ? "var(--primary)" : rec ? "var(--accent-muted)" : "var(--line)"}`,
    background: active ? "var(--primary)" : "var(--canvas)",
    borderRadius: "0.6rem",
    cursor: "pointer",
    transition: "all 0.15s",
    position: "relative",
  });

  return (
    <div style={{ borderTop: "1px solid var(--line)", paddingTop: "4rem" }}>
      {/* Mode toggle */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "2.4rem" }}>
        {(["photo","live"] as const).map(m => (
          <button key={m} onClick={() => setMode(m)} style={{
            height: "4rem", padding: "0 2rem",
            background: mode===m ? "var(--primary)" : "var(--wash)",
            color: mode===m ? "#fff" : "var(--secondary)",
            border: `1px solid ${mode===m ? "var(--primary)" : "var(--line)"}`,
            borderRadius: "9999px", fontSize: "1.4rem", fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
          }}>
            {m === "photo" ? "📷 Photo" : "🎥 Live Camera"}
          </button>
        ))}
      </div>

      {/* Canvas / live */}
      {mode === "live" ? (
        <LiveEyewearTryOn frame={frame} />
      ) : photoUrl && !photoUrl.includes("glowmetry-scan-portrait") ? (
        <div style={{ position: "relative", borderRadius: "0.6rem", overflow: "hidden", background: "#111", lineHeight: 0 }}>
          <canvas ref={canvasRef} style={{ width: "100%", display: "block" }} />
          {(status === "loading" || status === "noface" || status === "error") && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "1.6rem", background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: "1.5rem", textAlign: "center", padding: "2rem" }}>
              {status === "loading" && <><div style={{ width: "3.2rem", height: "3.2rem", border: "3px solid rgba(255,255,255,0.2)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /><p>Detecting face…</p></>}
              {status === "noface" && <p>Face not detected. Try Live Camera instead.</p>}
              {status === "error"  && <p>Could not load face detection.<br />Try Live Camera.</p>}
            </div>
          )}
        </div>
      ) : (
        <div style={{ borderRadius: "0.6rem", background: "var(--wash)", border: "1px solid var(--line)", padding: "4rem 2rem", textAlign: "center", color: "var(--secondary)", fontSize: "1.5rem" }}>
          <p style={{ marginBottom: "1.2rem" }}>No photo captured yet.</p>
          <p style={{ fontSize: "1.3rem", color: "var(--muted)" }}>Use <strong>Live Camera</strong> above to try on frames in real time.</p>
        </div>
      )}

      {/* Frame selector — shown in both photo and live modes */}
      {(status === "ready" || mode === "live") && (
        <div style={{ marginTop: "2.4rem" }}>
          <div style={{ display: "flex", gap: "0.8rem", marginBottom: "1.6rem" }}>
            <span style={{ fontSize: "1.3rem", fontWeight: 600, padding: "0.4rem 1.2rem", background: "var(--wash)", color: "var(--secondary)", borderRadius: "9999px" }}>
              {faceShape} face
            </span>
            {seasonalColour && (
              <span style={{ fontSize: "1.3rem", fontWeight: 600, padding: "0.4rem 1.2rem", background: "var(--wash)", color: "var(--secondary)", borderRadius: "9999px" }}>
                {seasonalColour} season
              </span>
            )}
            <span style={{ fontSize: "1.3rem", color: "var(--muted)", padding: "0.4rem 0" }}>Highlighted = best for you</span>
          </div>

          {/* Horizontal scroll slider */}
          <div style={{ display: "flex", gap: "0.8rem", overflowX: "auto", paddingBottom: "0.8rem", scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}>
            {FRAMES.map((f, i) => {
              const isRec  = recommended.has(f.id);
              const active = i === frameIdx;
              return (
                <button key={f.id} onClick={() => setFrameIdx(i)}
                  style={{ ...btnStyle(active, isRec), flexShrink: 0, scrollSnapAlign: "start", minWidth: "10rem" }}>
                  {isRec && <span style={{ position: "absolute", top: "-0.6rem", right: "-0.6rem", width: "1.6rem", height: "1.6rem", borderRadius: "50%", background: "var(--accent-muted)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem" }}>✦</span>}
                  <Image
                    src={f.file}
                    alt={f.name}
                    width={92}
                    height={38}
                    style={{
                      width: "9.2rem",
                      height: "3.8rem",
                      padding: "0.3rem 0.5rem",
                      objectFit: "contain",
                      background: "rgba(255,255,255,0.96)",
                      borderRadius: "0.4rem",
                      filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.12))",
                    }}
                    unoptimized
                  />
                  <span style={{ fontSize: "1.1rem", color: active ? "#fff" : "var(--secondary)", fontWeight: 500 }}>{f.name}</span>
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: "1.6rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "1.6rem", fontWeight: 600, color: "var(--primary)" }}>{frame.name}</span>
            {mode === "photo" && status === "ready" && (
              <button onClick={download} style={{ height: "4.4rem", padding: "0 2.4rem", background: "var(--wash)", color: "var(--primary)", border: "1px solid var(--line)", borderRadius: "9999px", fontSize: "1.4rem", fontWeight: 600, cursor: "pointer" }}>
                ↓ Save photo
              </button>
            )}
          </div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
