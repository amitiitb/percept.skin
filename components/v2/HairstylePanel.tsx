"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Props {
  sessionId: string;
  photo: string | null;
  isPremium: boolean;
  onRequirePremium: () => void;
}

// Five options spanning short to long so there is a realistic choice for any
// starting hair length, rather than four that skew long.
const STYLES = [
  { name: "Long Layers", prompt: "long layered hair with soft waves" },
  { name: "Textured Bob", prompt: "a chin-length textured bob haircut" },
  { name: "Curtain Bangs", prompt: "hair with soft curtain bangs framing the face" },
  { name: "Blunt Lob", prompt: "a blunt shoulder-length lob with a sharp, even hemline" },
  { name: "Buzz Cut", prompt: "a short, clean buzz cut" },
];

type GenState = "idle" | "loading" | "done" | "error";

// New feature (Cherry-pick 3/4) — no existing code to port. Gated behind an
// explicit tap per style (never auto-generates) since each call is a real,
// billed Gemini generation.
export default function HairstylePanel({ sessionId, photo, isPremium, onRequirePremium }: Props) {
  const supabase = createClient();
  const [active, setActive] = useState<string | null>(null);
  const [state, setState] = useState<GenState>("idle");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function tryStyle(styleName: string, stylePrompt: string) {
    if (!isPremium) { onRequirePremium(); return; }
    if (!photo) { setError("No photo available for this scan."); return; }
    setActive(styleName);
    setState("loading");
    setError("");
    setResultUrl(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Please log in again.");
      const res = await fetch("/api/hairstyle/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ sessionId, styleName, stylePrompt, photoDataUrl: photo }),
      });
      const body = await res.json() as { imageUrl?: string; error?: string };
      if (!res.ok) throw new Error(body.error ?? "Style generation failed");
      setResultUrl(body.imageUrl ?? null);
      setState("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setState("error");
    }
  }

  return (
    <div style={{ borderTop: "1px solid var(--line)", paddingTop: "4rem", marginTop: "3.2rem" }}>
      <h2 style={{ fontSize: "2rem", fontWeight: 500, color: "var(--primary)", marginBottom: "0.8rem" }}>Try a Hairstyle</h2>
      <p style={{ fontSize: "1.5rem", color: "var(--secondary)", marginBottom: "2.4rem", lineHeight: 1.5 }}>
        See an AI-generated preview of a new style on your own photo. Illustrative only, actual results vary by stylist.
      </p>

      <div style={{ display: "flex", gap: "1.2rem", flexWrap: "wrap", marginBottom: "2.4rem" }}>
        {STYLES.map((s) => (
          <button
            key={s.name}
            onClick={() => tryStyle(s.name, s.prompt)}
            disabled={state === "loading" && active === s.name}
            style={{
              padding: "1.2rem 2rem", borderRadius: "9999px", fontSize: "1.4rem", fontWeight: 500,
              border: `1px solid ${active === s.name ? "var(--primary)" : "var(--line)"}`,
              background: active === s.name ? "var(--primary)" : "var(--canvas)",
              color: active === s.name ? "#fff" : "var(--secondary)",
              cursor: "pointer",
            }}
          >
            {state === "loading" && active === s.name ? "Generating…" : s.name}
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
          <img src={resultUrl} alt={`${active} preview`} style={{ width: "100%", borderRadius: "1.2rem", border: "1px solid var(--line)" }} />
          <p style={{ fontSize: "1.3rem", color: "var(--muted)", marginTop: "1rem" }}>AI-generated preview: {active}</p>
        </div>
      )}
    </div>
  );
}
