"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useFunnelV2Store } from "@/store/funnelV2";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { CAPTURE_STEPS, TOTAL_STEPS, isPhaseTransition } from "@/lib/v2/captureSteps";
import { runQualityChecks, ISSUE_MESSAGES, type QualityIssue } from "@/lib/v2/qualityChecks";
import { compressImage } from "@/lib/v2/imageCompress";
import { logV2 } from "@/lib/v2/log";

// Live face-mesh overlay during capture — ported from the legacy capture flow
// (app/(legacy)/capture/page.tsx), duplicated here rather than shared since
// v2's report/capture code is intentionally decoupled from legacy's. Face
// steps only: hair/scalp steps point the camera away from the face, so
// running the detector there would just burn battery for no signal.
const EYE_L = [33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7, 33];
const EYE_R = [263, 466, 388, 387, 386, 385, 384, 398, 362, 382, 381, 380, 374, 373, 390, 249, 263];
const BROW_L = [336, 296, 334, 293, 300, 285, 295, 282, 283, 276];
const BROW_R = [107, 66, 105, 63, 70, 55, 65, 52, 53, 46];
const LIPS_O = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146, 61];
const LIPS_I = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95, 78];
const NOSE = [168, 6, 197, 195, 5, 4, 1, 2, 98, 327, 326, 2, 94, 19, 1];

// Single-point anchors for the feature-label callouts, drawn only from real
// MediaPipe canonical face-mesh indices — no fabricated positions. Ears are
// deliberately not included: the 468-point face mesh has no ear landmarks at
// all (it only models the frontal face), so "detecting" them would be a lie.
const FOREHEAD = 10;
const CHEEK_L = 234;
const CHEEK_R = 454;
const CHIN = 152;
const NOSE_TIP = 4;

type LM = { x: number; y: number; z?: number; visibility?: number };
type MeshConnector = { start: number; end: number };

function mapLandmarks(lm: LM[]) {
  return lm.map((point) => ({ ...point, z: point.z ?? 0, visibility: point.visibility ?? 1 }));
}

function drawGroup(ctx: CanvasRenderingContext2D, lm: LM[], indices: number[], cw: number, ch: number) {
  ctx.beginPath();
  let moved = false;
  for (const idx of indices) {
    const p = lm[idx];
    if (!p) continue;
    const x = p.x * cw, y = p.y * ch;
    if (!moved) { ctx.moveTo(x, y); moved = true; } else ctx.lineTo(x, y);
  }
  ctx.stroke();
  for (const idx of indices) {
    const p = lm[idx];
    if (!p) continue;
    ctx.beginPath();
    ctx.arc(p.x * cw, p.y * ch, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function centroid(lm: LM[], indices: number[]): { x: number; y: number } | null {
  let sx = 0, sy = 0, n = 0;
  for (const idx of indices) {
    const p = lm[idx];
    if (!p) continue;
    sx += p.x; sy += p.y; n++;
  }
  return n ? { x: sx / n, y: sy / n } : null;
}

// Draws a small pill-labeled callout at a normalized (0-1) landmark position.
// The canvas element itself is CSS-mirrored (scaleX(-1)) to match the
// selfie-view video, which is fine for the symmetric dots/lines elsewhere on
// this canvas but would render text backwards — so text gets a local
// counter-flip around its own anchor point to cancel just that, without
// touching the outer mirror the rest of the mesh relies on.
function drawLabel(ctx: CanvasRenderingContext2D, text: string, nx: number, ny: number, cw: number, ch: number, dpr: number) {
  const x = nx * cw, y = ny * ch;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(-1, 1);
  ctx.font = `${11 * dpr}px -apple-system, sans-serif`;
  const padX = 6 * dpr, padY = 3 * dpr;
  const w = ctx.measureText(text).width + padX * 2;
  const h = 14 * dpr + padY;
  ctx.fillStyle = "rgba(8,28,26,0.55)";
  const r = h / 2;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, r);
  ctx.fill();
  ctx.fillStyle = "rgba(160,235,255,0.95)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 0, 0.5 * dpr);
  ctx.restore();
}

export default function V2CapturePage() {
  const router = useRouter();
  const params = useParams();
  const supabase = createClient();
  const index = Number(params.step);
  const step = CAPTURE_STEPS[index];

  const { currentSessionId, setSessionId, setPhoto, stepIndex, setStepIndex } = useFunnelV2Store();

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const meshCanvasRef = useRef<HTMLCanvasElement>(null);
  const detectorRef = useRef<{ detectForVideo: (v: HTMLVideoElement, ts: number) => { faceLandmarks?: LM[][] }; close: () => void } | null>(null);
  const meshRafRef = useRef<number>(0);

  const [showPhaseTransition, setShowPhaseTransition] = useState(isPhaseTransition(index));
  const [captured, setCaptured] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [issues, setIssues] = useState<QualityIssue[]>([]);
  const [saving, setSaving] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Real-time "locked on" feedback for the scan UI below — driven by whether
  // MediaPipe actually found a face this frame, not decorative. Compared
  // against a ref (not just prior state) so the ~20fps detection loop only
  // triggers a re-render on the rare frame where lock status actually flips.
  const [faceLocked, setFaceLocked] = useState(false);
  const faceLockedRef = useRef(false);

  useEffect(() => {
    if (!step) { router.replace("/v2/dashboard"); return; }
    setStepIndex(index);
  }, [index]);

  useEffect(() => {
    if (showPhaseTransition || captured) return;
    let cancelled = false;
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
    }).then((stream) => {
      if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    }).catch(() => setCameraError("Camera permission denied. You can still upload a photo from your gallery."));

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [showPhaseTransition, captured]);

  // Live face-mesh overlay — face steps only, live camera view only.
  useEffect(() => {
    if (showPhaseTransition || captured || cameraError || step?.phase !== "face") return;
    let cancelled = false;

    async function loadMesh() {
      try {
        const { DrawingUtils, FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
        const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm");
        const det = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "CPU",
          },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false,
        });
        if (cancelled) { det.close(); return; }
        detectorRef.current = det;

        const video = videoRef.current;
        const canvas = meshCanvasRef.current;
        if (!video || !canvas) return;

        let lastTs = 0;
        function loop(ts: number) {
          if (cancelled) return;
          meshRafRef.current = requestAnimationFrame(loop);
          if (ts - lastTs < 50 || !video || !canvas) return; // ~20fps — saves battery on mobile
          // Video can report 0x0 before its first frame decodes (or if the
          // stream stalls) — detectForVideo throws internally on a zero-size
          // ROI in that case, spamming MediaPipe errors every frame.
          if (!video.videoWidth || !video.videoHeight) return;
          lastTs = ts;

          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          const result = det.detectForVideo(video, ts);
          const lm = result.faceLandmarks?.[0];
          if (!lm) {
            if (faceLockedRef.current) { faceLockedRef.current = false; setFaceLocked(false); }
            return;
          }
          if (!faceLockedRef.current) { faceLockedRef.current = true; setFaceLocked(true); }

          const cw = canvas.width, ch = canvas.height;
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          const mappedLm = mapLandmarks(lm);
          const drawing = new DrawingUtils(ctx);

          drawing.drawConnectors(mappedLm, FaceLandmarker.FACE_LANDMARKS_TESSELATION as MeshConnector[], { color: "rgba(135,215,255,0.32)", lineWidth: 0.65 * dpr });
          drawing.drawConnectors(mappedLm, FaceLandmarker.FACE_LANDMARKS_CONTOURS as MeshConnector[], { color: "rgba(238,248,255,0.72)", lineWidth: 1.15 * dpr });
          drawing.drawConnectors(mappedLm, FaceLandmarker.FACE_LANDMARKS_FACE_OVAL as MeshConnector[], { color: "rgba(255,255,255,0.88)", lineWidth: 1.35 * dpr });
          drawing.drawConnectors(mappedLm, FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS as MeshConnector[], { color: "rgba(80,220,255,0.9)", lineWidth: 1.35 * dpr });
          drawing.drawConnectors(mappedLm, FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS as MeshConnector[], { color: "rgba(80,220,255,0.9)", lineWidth: 1.35 * dpr });

          ctx.strokeStyle = "rgba(80,220,255,0.75)"; ctx.fillStyle = "rgba(80,220,255,0.85)"; ctx.lineWidth = 1.2;
          drawGroup(ctx, lm, EYE_L, cw, ch); drawGroup(ctx, lm, EYE_R, cw, ch);

          ctx.strokeStyle = "rgba(200,220,255,0.55)"; ctx.fillStyle = "rgba(200,220,255,0.65)"; ctx.lineWidth = 1;
          drawGroup(ctx, lm, BROW_L, cw, ch); drawGroup(ctx, lm, BROW_R, cw, ch);

          ctx.strokeStyle = "rgba(255,150,180,0.7)"; ctx.fillStyle = "rgba(255,150,180,0.8)"; ctx.lineWidth = 1.2;
          drawGroup(ctx, lm, LIPS_O, cw, ch); drawGroup(ctx, lm, LIPS_I, cw, ch);

          ctx.strokeStyle = "rgba(120,200,255,0.5)"; ctx.fillStyle = "rgba(120,200,255,0.6)"; ctx.lineWidth = 1;
          drawGroup(ctx, lm, NOSE, cw, ch);

          // Cycles through one region callout at a time (real landmark
          // positions, not scripted) — reads as an active scan sweeping
          // across the face rather than a static label dump.
          const labels: Array<{ name: string; p: { x: number; y: number } | null }> = [
            { name: "Forehead", p: lm[FOREHEAD] ?? null },
            { name: "Left cheek", p: lm[CHEEK_L] ?? null },
            { name: "Right cheek", p: lm[CHEEK_R] ?? null },
            { name: "Eyes", p: centroid(lm, [...EYE_L, ...EYE_R]) },
            { name: "Brows", p: centroid(lm, [...BROW_L, ...BROW_R]) },
            { name: "Nose", p: lm[NOSE_TIP] ?? null },
            { name: "Lips", p: centroid(lm, LIPS_O) },
            { name: "Jawline", p: lm[CHIN] ?? null },
          ];
          const active = labels[Math.floor(ts / 650) % labels.length];
          if (active.p) drawLabel(ctx, active.name, active.p.x, active.p.y, cw, ch, dpr);
        }
        meshRafRef.current = requestAnimationFrame(loop);
      } catch {
        // silently fail — landmark overlay is optional, capture still works without it
      }
    }
    loadMesh();
    return () => {
      cancelled = true;
      cancelAnimationFrame(meshRafRef.current);
      detectorRef.current?.close();
      detectorRef.current = null;
      faceLockedRef.current = false;
      setFaceLocked(false);
    };
  }, [showPhaseTransition, captured, cameraError, step]);

  const ensureSession = useCallback(async (): Promise<string> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    if (currentSessionId) {
      // Don't trust a cached session id blindly — it can go stale (deleted
      // server-side, another device, admin purge). Verify before reusing it;
      // an orphaned id here silently fails every future insert via RLS
      // instead of self-healing.
      const { data: existing } = await supabase.from("analysis_sessions_v2").select("id").eq("id", currentSessionId).eq("user_id", user.id).maybeSingle();
      if (existing) return currentSessionId;
      logV2.warn("v2_stale_session_id_discarded", { stale_session_id: currentSessionId });
    }

    const { data, error } = await supabase.from("analysis_sessions_v2").insert({ user_id: user.id, status: "capturing" }).select("id").single();
    if (error) throw error;
    setSessionId(data.id);
    logV2.info("v2_session_started", { session_id: data.id });
    return data.id;
  }, [currentSessionId]);

  async function checkFrame(dataUrl: string) {
    setChecking(true);
    const img = new Image();
    img.src = dataUrl;
    await new Promise((r) => { img.onload = r; });
    const result = await runQualityChecks(img, step?.phase === "face");
    setIssues(result.issues);
    setChecking(false);
  }

  function handleCapture() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Mirror for a natural selfie-style capture
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
    setCaptured(dataUrl);
    checkFrame(dataUrl);
  }

  function handleGalleryFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setCaptured(dataUrl);
      checkFrame(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  function retake() {
    setCaptured(null);
    setIssues([]);
    setSaveError(null);
  }

  async function handleContinue() {
    if (!captured) return;
    setSaving(true);
    setSaveError(null);
    try {
      const sessionId = await ensureSession();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const blob = await (await fetch(captured)).blob();
      const compressed = await compressImage(blob);
      const path = `${user.id}/${sessionId}/${step.photoType}.jpg`;

      const { error: upErr } = await supabase.storage.from("photos_v2").upload(path, compressed, { contentType: "image/jpeg", upsert: true });
      if (upErr) throw upErr;

      const { error: rowErr } = await supabase.from("analysis_photos_v2").upsert({
        session_id: sessionId, user_id: user.id, photo_type: step.photoType,
        storage_path: path, quality_status: issues.length === 0 ? "passed" : "failed", quality_issues: issues,
      }, { onConflict: "session_id,photo_type" });
      if (rowErr) throw rowErr;

      setPhoto(step.photoType, captured);
      logV2.info("v2_photo_captured", { session_id: sessionId, photo_type: step.photoType, issues: issues.join(",") });

      if (index + 1 >= TOTAL_STEPS) {
        // Bundle-first purchase flow replaces the old "show results free,
        // paywall individual sections" model — analysis runs in the background
        // while the user picks/pays for report modules (app/v2/bundle).
        router.push(`/v2/bundle/${sessionId}`);
      } else {
        router.push(`/v2/capture/${index + 1}`);
      }
    } catch (e) {
      logV2.error("v2_photo_save_failed", { message: e instanceof Error ? e.message : String(e) });
      setSaving(false);
      setSaveError("Upload failed. Check your connection and retry.");
    }
  }

  if (!step) return null;

  if (showPhaseTransition) {
    return (
      <div style={{ minHeight: "100dvh", background: "var(--primary)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "4rem", textAlign: "center" }}>
        <p style={{ fontSize: "1.4rem", color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "1.6rem" }}>Face done!</p>
        <h1 style={{ fontSize: "clamp(2.8rem, 6vw, 4rem)", fontWeight: 400, color: "#fff", marginBottom: "1.6rem" }}>Now hair &amp; scalp</h1>
        <p style={{ fontSize: "1.6rem", color: "rgba(255,255,255,0.7)", marginBottom: "4rem" }}>About a minute more.</p>
        <div style={{ maxWidth: "32rem", width: "100%" }}>
          <PrimaryButton onClick={() => setShowPhaseTransition(false)}>Continue →</PrimaryButton>
        </div>
      </div>
    );
  }

  const primaryIssue = issues[0];
  const chipColor = checking ? "var(--muted)" : issues.length === 0 ? "#4C8C5F" : "#C8503A";
  const chipText = checking ? "Checking..." : issues.length === 0 ? "Good lighting" : ISSUE_MESSAGES[primaryIssue];

  return (
    <div style={{ minHeight: "100dvh", background: "var(--canvas)", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.2rem 2rem" }}>
        <button onClick={() => router.back()} aria-label="Go back" style={{ width: "4rem", height: "4rem", borderRadius: "50%", border: "1px solid var(--line)", background: "none", cursor: "pointer" }}>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ margin: "auto" }}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <span style={{ fontSize: "1.5rem", fontWeight: 600, color: "var(--primary)" }}>
          {step.phase === "face" ? "Face" : "Hair & Scalp"} · {step.phaseIndex} of {step.phaseTotal}
        </span>
        <div style={{ width: "4rem" }} />
      </div>
      <div style={{ height: "4px", background: "var(--line)" }}>
        <div style={{ height: "100%", width: `${(step.phaseIndex / step.phaseTotal) * 100}%`, background: "var(--primary)", transition: "width 0.3s" }} />
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "1.6rem 2rem 1.2rem", maxWidth: "56rem", margin: "0 auto", width: "100%" }}>
        <p style={{ fontSize: "1.6rem", color: "var(--primary)", textAlign: "center", marginBottom: "1.2rem" }}>{step.instruction}</p>

        <div style={{ position: "relative", width: "100%", aspectRatio: "3/3.4", borderRadius: "1.6rem", overflow: "hidden", background: "#000" }}>
          {captured ? (
            <img src={captured} alt="Captured photo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : cameraError ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#fff", padding: "2rem", textAlign: "center", fontSize: "1.4rem" }}>{cameraError}</div>
          ) : (
            <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />
          )}
          {!captured && !cameraError && step.phase === "face" && (
            <canvas
              ref={meshCanvasRef}
              aria-hidden
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none", transform: "scaleX(-1)" }}
            />
          )}
          {/* No static oval guide for face steps — the live mesh already
              draws a real FACE_OVAL contour from actual landmarks, which
              made the plain white placeholder oval redundant. */}
          {/* Scan reticle — corner brackets + sweeping line, always present
              while actively composing a shot (both phases). Real feedback,
              not just decoration: brackets and the status pill switch to
              faceLocked's actual value during face steps, so "locked" means
              MediaPipe genuinely found a face this frame. */}
          {!captured && !cameraError && (
            <>
              {(["tl", "tr", "bl", "br"] as const).map((corner) => {
                const active = step.phase !== "face" || faceLocked;
                const vertical = corner[0] === "t" ? { top: "3%" } : { bottom: "3%" };
                const horizontal = corner[1] === "l" ? { left: "3%" } : { right: "3%" };
                const borderSide = {
                  borderTop: corner[0] === "t" ? `2.5px solid ${active ? "rgba(120,220,255,0.95)" : "rgba(255,255,255,0.55)"}` : undefined,
                  borderBottom: corner[0] === "b" ? `2.5px solid ${active ? "rgba(120,220,255,0.95)" : "rgba(255,255,255,0.55)"}` : undefined,
                  borderLeft: corner[1] === "l" ? `2.5px solid ${active ? "rgba(120,220,255,0.95)" : "rgba(255,255,255,0.55)"}` : undefined,
                  borderRight: corner[1] === "r" ? `2.5px solid ${active ? "rgba(120,220,255,0.95)" : "rgba(255,255,255,0.55)"}` : undefined,
                };
                return (
                  <div key={corner} aria-hidden style={{
                    position: "absolute", width: "2.4rem", height: "2.4rem",
                    transition: "border-color 0.2s", ...vertical, ...horizontal, ...borderSide,
                  }} />
                );
              })}
              <div aria-hidden className="v2-scan-line" style={{ position: "absolute", left: "4%", right: "4%", height: "2px", background: "linear-gradient(90deg, transparent, rgba(120,220,255,0.9), transparent)", opacity: faceLocked && step.phase === "face" ? 0 : 0.85, transition: "opacity 0.3s" }} />
              {step.phase === "face" && (
                <div role="status" aria-live="polite" style={{
                  position: "absolute", top: "3%", left: "50%", transform: "translateX(-50%)",
                  display: "flex", alignItems: "center", gap: "0.6rem", background: "rgba(0,0,0,0.45)",
                  borderRadius: "9999px", padding: "0.5rem 1.2rem",
                }}>
                  <span aria-hidden style={{ width: "0.7rem", height: "0.7rem", borderRadius: "50%", background: faceLocked ? "#4fe0a8" : "rgba(255,255,255,0.6)", transition: "background 0.2s" }} />
                  <span style={{ fontSize: "1.2rem", color: "#fff", fontWeight: 500 }}>{faceLocked ? "Face locked" : "Scanning…"}</span>
                </div>
              )}
            </>
          )}
          {/* Hair-phase framing guides — a face-shaped oval made no sense for
              these shots (crown looks down at a round scalp, hairline is a
              horizontal band, parting is a thin close-up line), so each hair
              step gets a guide matching its actual framing instead of reusing
              the face oval or showing nothing at all. */}
          {!captured && !cameraError && step.phase === "hair" && step.photoType === "hairline_front" && (
            <div aria-hidden style={{ position: "absolute", top: "18%", left: "10%", right: "10%", height: "22%", border: "2px dashed rgba(255,255,255,0.7)", borderRadius: "9999px" }} />
          )}
          {!captured && !cameraError && step.phase === "hair" && step.photoType === "scalp_crown" && (
            <div aria-hidden style={{ position: "absolute", inset: "10% 10%", border: "2px dashed rgba(255,255,255,0.7)", borderRadius: "50%" }} />
          )}
          {!captured && !cameraError && step.phase === "hair" && step.photoType === "hair_parting" && (
            <div aria-hidden style={{ position: "absolute", top: "15%", bottom: "15%", left: "50%", width: "2px", background: "rgba(255,255,255,0.7)", transform: "translateX(-1px)" }} />
          )}
        </div>
        <canvas ref={canvasRef} style={{ display: "none" }} />

        {captured && (
          <div role="status" aria-live="polite" style={{ display: "flex", alignItems: "center", gap: "0.8rem", marginTop: "2rem" }}>
            <span style={{ width: "1rem", height: "1rem", borderRadius: "50%", background: chipColor, flexShrink: 0 }} />
            <span style={{ fontSize: "1.4rem", color: "var(--secondary)" }}>{chipText}</span>
          </div>
        )}

        {saveError && (
          <p role="alert" style={{ color: "var(--rose)", fontSize: "1.4rem", marginTop: "1.6rem", textAlign: "center" }}>{saveError}</p>
        )}

        {/* Shutter + gallery-upload sit just below the frame, not overlaid on
            top of it — overlaying them on the video made the shutter read as
            "inside" the oval/guide, which looked wrong. Kept compact (no
            extra vertical filler) so this still fits without scrolling. */}
        <div style={{ marginTop: "1rem", width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.4rem" }}>
          {captured ? (
            <div style={{ width: "100%", display: "flex", alignItems: "center", gap: "1.2rem" }}>
              <PrimaryButton onClick={handleContinue} loading={saving} disabled={checking}>{saveError ? "Retry →" : "Continue →"}</PrimaryButton>
              <button
                onClick={retake}
                disabled={saving}
                aria-label="Retake photo"
                style={{ flexShrink: 0, width: "5.2rem", height: "5.2rem", borderRadius: "50%", border: "1px solid var(--line)", background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.5 : 1 }}
              >
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="var(--primary)" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 12a8 8 0 0114-5.3M20 12a8 8 0 01-14 5.3M4 4v5h5M20 20v-5h-5" /></svg>
              </button>
            </div>
          ) : (
            <>
              <button onClick={handleCapture} aria-label="Capture photo" style={{ width: "7.2rem", height: "7.2rem", borderRadius: "50%", background: "var(--primary)", border: "4px solid var(--canvas)", boxShadow: "0 0 0 2px var(--primary)", cursor: "pointer" }} />
              <button onClick={() => fileInputRef.current?.click()} style={{ background: "none", border: "none", color: "var(--secondary)", fontSize: "1.4rem", cursor: "pointer", padding: "0.6rem" }}>
                Upload from gallery →
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleGalleryFile} style={{ display: "none" }} />
            </>
          )}
        </div>
      </div>
      <style jsx>{`
        .v2-scan-line { top: 6%; animation: v2-scan-sweep 2.8s ease-in-out infinite; }
        @keyframes v2-scan-sweep {
          0%, 100% { top: 6%; }
          50% { top: 92%; }
        }
        @media (prefers-reduced-motion: reduce) {
          .v2-scan-line { animation: none; top: 50%; }
        }
      `}</style>
    </div>
  );
}
