"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { enqueueImageGeneration } from "@/lib/v2/clientGenerationQueue";

interface Props {
  sessionId: string;
  photo: string | null;
  isPremium: boolean;
  onRequirePremium: () => void;
}

// Same 4 style names as the canvas/live try-on catalog (GlassesVirtualTryOn.tsx)
// so the AI-generated previews stay consistent with what the real-time overlay
// already shows — just rendered photorealistically instead of composited.
// Five distinct silhouettes and materials. Tortoiseshell is included because
// it is the shade that suits the widest range of warm/autumn palettes, which
// is what the colour analysis most often returns.
const FRAME_STYLES = [
  { name: "Clubmaster", prompt: "black and gold Clubmaster-style browline eyeglasses with a thick acetate top rim and thin metal bottom rim" },
  { name: "Aviator", prompt: "classic gold-metal aviator eyeglasses with thin wire frames and teardrop-shaped lenses" },
  { name: "Wayfarer", prompt: "matte black Wayfarer-style acetate eyeglasses with a bold rectangular frame" },
  { name: "Round", prompt: "thin gold-metal round eyeglasses with a minimalist vintage look" },
  { name: "Tortoiseshell", prompt: "warm tortoiseshell acetate eyeglasses with a soft rounded-square frame and visible amber and brown mottling" },
];

type GenState = "idle" | "loading" | "done" | "error";

// AI photorealistic frame preview (Gemini) — a separate, higher-fidelity option
// alongside the existing real-time canvas/live-camera try-on (GlassesVirtualTryOn),
// which stays untouched. Gated behind an explicit tap per style (real billed
// generation, same pattern as HairstylePanel).
export default function FrameAIPanel({ sessionId, photo, isPremium, onRequirePremium }: Props) {
  const supabase = createClient();
  const [active, setActive] = useState<string | null>(null);
  const [state, setState] = useState<GenState>("idle");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function tryFrame(frameName: string, framePrompt: string) {
    if (!isPremium) { onRequirePremium(); return; }
    if (!photo) { setError("No photo available for this scan."); return; }
    setActive(frameName);
    setState("loading");
    setError("");
    setResultUrl(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Please log in again.");
      const res = await enqueueImageGeneration(() => fetch("/api/frame-tryon/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ sessionId, frameName, framePrompt, photoDataUrl: photo }),
      }));
      const body = await res.json() as { imageUrl?: string; error?: string };
      if (!res.ok) throw new Error(body.error ?? "Frame preview generation failed");
      setResultUrl(body.imageUrl ?? null);
      setState("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setState("error");
    }
  }

  return (
    <div style={{ marginTop: "2.4rem" }}>
      <p style={{ fontSize: "1.3rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1.2rem" }}>
        AI Photorealistic Preview
      </p>
      <p style={{ fontSize: "1.4rem", color: "var(--secondary)", marginBottom: "2rem", lineHeight: 1.5 }}>
        Studio-quality generated preview of each frame on your own photo, like a retail virtual try-on. Illustrative only.
      </p>

      <div style={{ display: "flex", gap: "1.2rem", flexWrap: "wrap", marginBottom: "2.4rem" }}>
        {FRAME_STYLES.map((f) => (
          <button
            key={f.name}
            onClick={() => tryFrame(f.name, f.prompt)}
            disabled={state === "loading" && active === f.name}
            style={{
              padding: "1.2rem 2rem", borderRadius: "9999px", fontSize: "1.4rem", fontWeight: 500,
              border: `1px solid ${active === f.name ? "var(--primary)" : "var(--line)"}`,
              background: active === f.name ? "var(--btn-fill)" : "var(--canvas)",
              color: active === f.name ? "var(--btn-fill-ink)" : "var(--secondary)",
              cursor: "pointer",
            }}
          >
            {state === "loading" && active === f.name ? "Generating…" : f.name}
          </button>
        ))}
      </div>

      {error && <p style={{ color: "var(--rose)", fontSize: "1.4rem", marginBottom: "1.6rem" }}>{error}</p>}

      {state === "loading" && (
        <div style={{ background: "var(--wash)", borderRadius: "1.2rem", padding: "6rem 2rem", textAlign: "center" }}>
          <p style={{ fontSize: "1.5rem", color: "var(--secondary)" }}>Generating your {active} preview, this takes a few seconds…</p>
        </div>
      )}

      {state === "done" && resultUrl && (
        <div style={{ maxWidth: "40rem" }}>
          <img src={resultUrl} alt={`${active} AI preview`} style={{ width: "100%", borderRadius: "1.2rem", border: "1px solid var(--line)" }} />
          <p style={{ fontSize: "1.3rem", color: "var(--muted)", marginTop: "1rem" }}>AI-generated preview: {active}</p>
        </div>
      )}
    </div>
  );
}
