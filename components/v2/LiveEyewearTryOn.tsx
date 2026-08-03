"use client";
import { useEffect, useRef, useState } from "react";
import { IconPhoto } from "@/components/ui/icons";

interface FrameDef {
  id: string; name: string; file: string;
  lx: number; ly: number; rx: number; ry: number;
  precision?: boolean;
}

export default function LiveEyewearTryOn({ frame }: { frame: FrameDef }) {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const rafRef      = useRef<number>(0);
  const streamRef   = useRef<MediaStream | null>(null);
  const detectorRef = useRef<{ detectForVideo: (v: HTMLVideoElement, ts: number) => { faceLandmarks?: { x: number; y: number }[][] }; close: () => void } | null>(null);
  const frameImgRef = useRef<HTMLImageElement | null>(null);
  const frameRef    = useRef(frame);
  const [status, setStatus] = useState<"starting" | "active" | "denied" | "error">("starting");

  useEffect(() => {
    frameRef.current = frame;
    const img = new window.Image();
    img.onload = () => { frameImgRef.current = img; };
    img.src = frame.file;
  }, [frame]);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } } });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        const video = videoRef.current!;
        video.srcObject = stream;
        video.setAttribute("playsinline", "true");
        video.muted = true;
        await new Promise<void>(res => { video.onloadedmetadata = () => res(); });
        await video.play();
        const canvas = canvasRef.current!;
        canvas.width  = video.videoWidth  || 640;
        canvas.height = video.videoHeight || 480;
        const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
        const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm");
        const det = await FaceLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task", delegate: "CPU" }, runningMode: "VIDEO", numFaces: 1, outputFaceBlendshapes: false, outputFacialTransformationMatrixes: false });
        if (cancelled) { det.close(); stream.getTracks().forEach(t => t.stop()); return; }
        detectorRef.current = det;
        setStatus("active");
        function loop(ts: number) {
          if (cancelled) return;
          const ctx = canvas.getContext("2d")!; const cw = canvas.width; const ch = canvas.height;
          ctx.save(); ctx.translate(cw, 0); ctx.scale(-1, 1); ctx.drawImage(video, 0, 0, cw, ch); ctx.restore();
          const result = det.detectForVideo(video, ts);
          const lm = result.faceLandmarks?.[0];
          const fImg = frameImgRef.current; const fd = frameRef.current;
          if (lm && fImg) {
            function ec(irisIdx: number, fallback: number[]) {
              const p = lm![irisIdx];
              const raw = p ? { x: p.x, y: p.y } : (() => { const pts = fallback.map(i => lm![i]).filter(Boolean); return { x: pts.reduce((s,q)=>s+q.x,0)/pts.length, y: pts.reduce((s,q)=>s+q.y,0)/pts.length }; })();
              return { x: (1-raw.x)*cw, y: raw.y*ch };
            }
            const e468 = ec(468, [33,133,159,145]); const e473 = ec(473, [263,362,386,374]);
            const [le,re] = e468.x < e473.x ? [e468,e473] : [e473,e468];
            const angle = Math.atan2(re.y-le.y, re.x-le.x); const pd = Math.hypot(re.x-le.x, re.y-le.y);
            const mx = (le.x+re.x)/2; const my = (le.y+re.y)/2;
            const iw = fImg.naturalWidth; const ih = fImg.naturalHeight;
            const precisionScale = pd / ((fd.rx - fd.lx) * iw);
            const legacyScale = (pd * 1.15) / ((fd.rx - fd.lx) * iw);
            const scale = fd.precision
              ? Math.min(precisionScale, (cw * 0.96) / iw, (ch * 0.42) / ih)
              : Math.min(legacyScale, (cw * 0.72) / iw, (ch * 0.35) / ih);
            const dw=iw*scale; const dh=ih*scale;
            ctx.save(); ctx.translate(mx,my); ctx.rotate(angle);
            if (fd.precision) {
              const anchorX = ((fd.lx + fd.rx) / 2) * dw;
              const anchorY = ((fd.ly + fd.ry) / 2) * dh;
              ctx.drawImage(fImg, -anchorX, -anchorY, dw, dh);
            } else {
              ctx.drawImage(fImg,-pd/2-fd.lx*dw,-fd.ly*dh,dw,dh);
            }
            ctx.restore();
          }
          rafRef.current = requestAnimationFrame(loop);
        }
        rafRef.current = requestAnimationFrame(loop);
      } catch (e: unknown) {
        if (cancelled) return;
        const name = (e as { name?: string }).name ?? "";
        setStatus(name === "NotAllowedError" || name === "PermissionDeniedError" || name === "NotFoundError" ? "denied" : "error");
      }
    }
    start();
    return () => { cancelled = true; cancelAnimationFrame(rafRef.current); detectorRef.current?.close(); detectorRef.current = null; streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null; };
  }, []);

  return (
    <>
      <div style={{ position: "relative", borderRadius: "0.6rem", overflow: "hidden", background: "#000", aspectRatio: "3/4", maxHeight: "70vh" }}>
        <video ref={videoRef} style={{ display: "none" }} playsInline muted />
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        {(status === "starting" || status === "denied" || status === "error") && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "1.6rem", background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: "1.5rem", textAlign: "center", padding: "2rem" }}>
            {status === "starting" && <><div style={{ width: "3.2rem", height: "3.2rem", border: "3px solid rgba(255,255,255,0.2)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /><p>Starting camera…</p></>}
            {status === "denied"   && <p>Camera access denied.<br />Allow camera in browser settings.</p>}
            {status === "error"    && <p>Could not start camera.</p>}
          </div>
        )}
        {status === "active" && (
          <div style={{ position: "absolute", top: "1.2rem", left: "1.2rem", display: "flex", alignItems: "center", gap: "0.6rem", background: "rgba(0,0,0,0.5)", borderRadius: "9999px", padding: "0.4rem 1rem" }}>
            <span style={{ width: "0.8rem", height: "0.8rem", borderRadius: "50%", background: "#f00", boxShadow: "0 0 6px #f00" }} />
            <span style={{ fontSize: "1.1rem", color: "#fff", fontWeight: 600, letterSpacing: "0.06em" }}>LIVE</span>
          </div>
        )}
      </div>
      {status === "active" && (
        <button
          onClick={() => { const a = document.createElement("a"); a.href = canvasRef.current?.toDataURL("image/jpeg",0.92) ?? ""; a.download = `percept-live-${frame.id}.jpg`; a.click(); }}
          style={{ marginTop: "1.2rem", height: "4.8rem", padding: "0 2.8rem", background: "var(--btn-fill)", color: "var(--btn-fill-ink)", border: "none", borderRadius: "9999px", fontSize: "1.5rem", fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.8rem" }}
        >
          <IconPhoto size={1.6} />
          Capture
        </button>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
