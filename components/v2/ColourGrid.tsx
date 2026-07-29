"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import type { ColourAnalysis } from "@/lib/v2/types";

// Replaces the old CSS-tinted "draping" cards, which layered a flat colour
// block under the user's photo. Those were cheap to render but obviously fake,
// and gave no real sense of a colour against someone's skin. This shows one
// genuinely generated image of the user wearing the recommended colours.
//
// Panel order is deliberately NOT labelled: the model does not honour a
// requested panel count reliably (a 6-panel ask has returned 9), so labelling
// positionally would mislabel colours. The swatch list below carries the names.
export function ColourGrid({
  sessionId, photo, analysis,
}: { sessionId: string; photo: string | null; analysis: ColourAnalysis }) {
  const existing = analysis.drapings ?? null;
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");
  const supabase = createClient();

  // A stored grid needs a fresh signed URL; storage paths are persisted, not
  // signed URLs, because those expire.
  const [resolved, setResolved] = useState(false);
  if (existing && !resolved && !url) {
    setResolved(true);
    supabase.storage.from("photos_v2").createSignedUrl(existing.storagePath, 60 * 60 * 24 * 7)
      .then(({ data }) => { if (data?.signedUrl) setUrl(data.signedUrl); });
  }

  async function generate() {
    if (!photo) return;
    setState("loading"); setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Please log in again.");
      const res = await fetch("/api/colour-analysis/draping", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ sessionId, photoDataUrl: photo }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not generate your colour previews");
      setUrl(body.url);
      setState("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setState("error");
    }
  }

  if (url) {
    return (
      <div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="You wearing your recommended colours" style={{ width: "100%", borderRadius: "1.2rem", display: "block" }} />
        <p style={{ fontSize: "1.3rem", color: "var(--muted)", marginTop: "1.2rem", lineHeight: 1.5 }}>
          Generated from your own photo. Shades shown are drawn from your palette below.
        </p>
      </div>
    );
  }

  return (
    <div style={{ textAlign: "center", padding: "1.2rem 0" }}>
      <p style={{ fontSize: "1.5rem", color: "var(--secondary)", lineHeight: 1.6, marginBottom: "2rem" }}>
        See your {analysis.sub_season} palette on your own photo, side by side.
      </p>
      {state === "error" && <p style={{ color: "#C8503A", fontSize: "1.4rem", marginBottom: "1.4rem" }}>{error}</p>}
      <PrimaryButton fullWidth={false} onClick={generate} loading={state === "loading"} disabled={!photo}>
        {state === "loading" ? "Generating your previews…" : "Show these colours on me →"}
      </PrimaryButton>
      {state === "loading" && (
        <p style={{ fontSize: "1.3rem", color: "var(--muted)", marginTop: "1.2rem" }}>This takes around 15 seconds.</p>
      )}
    </div>
  );
}
