"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { IconRefresh } from "@/components/ui/icons";
import type { ColourAnalysis } from "@/lib/v2/types";
import { MAX_GENERATIONS } from "@/lib/v2/generationBudget";
import { GenerationLoader } from "@/components/v2/GenerationLoader";
import { ImageLightbox } from "@/components/v2/ImageLightbox";
import { enqueueImageGeneration } from "@/lib/v2/clientGenerationQueue";

// Replaces the old CSS-tinted "draping" cards, which layered a flat colour
// block under the user's photo. Those were cheap to render but obviously fake,
// and gave no real sense of a colour against someone's skin. This shows one
// genuinely generated image of the user wearing the recommended colours.
//
// Panel order is deliberately NOT labelled: the model does not honour a
// requested panel count reliably (a 6-panel ask has returned 9), so labelling
// positionally would mislabel colours. The swatch list below carries the names.
const OCCASION_LABELS = ["Casual / friendly meet-up", "Travel day", "Everyday office", "Investor meeting", "Office party", "Wedding / festive"];

export function ColourGrid({
  sessionId, photo, analysis,
}: { sessionId: string; photo: string | null; analysis: ColourAnalysis }) {
  const existing = analysis.drapings ?? null;
  // The count rides in the stored analysis rather than a table of its own, so
  // it is derived here. A grid saved before the counter existed counts as one.
  const [remaining, setRemaining] = useState(
    MAX_GENERATIONS - (existing ? (existing.generations ?? 1) : 0),
  );
  const [url, setUrl] = useState<string | null>(null);
  const [occasions, setOccasions] = useState<string[]>([]);
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
      const res = await enqueueImageGeneration(() => fetch("/api/colour-analysis/draping", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ sessionId, photoDataUrl: photo }),
      }));
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not generate your colour previews");
      setUrl(body.url); setOccasions(body.occasions ?? []);
      if (typeof body.remaining === "number") setRemaining(body.remaining);
      setState("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setState("error");
    }
  }

  if (url) {
    return (
      <div id="v2-result-colour" className="v2-result-anchor">
        {/* height:auto + a max-height cap with object-fit:contain means a
            generated grid that comes back an unusual shape shrinks to fit
            instead of ever having any part of it clipped. */}
        <ImageLightbox src={url} alt="You wearing your recommended colours" style={{ width: "100%", height: "auto", maxHeight: "85vh", objectFit: "contain", borderRadius: "1.2rem", display: "block" }} />
        {occasions.length > 0 && (
          <div style={{ marginTop: "1.4rem" }}>
          <p style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 0.8rem" }}>Generated to cover</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
            {(occasions.length ? occasions : OCCASION_LABELS).map((o, i) => (
              <span key={i} style={{ fontSize: "1.25rem", color: "var(--primary)", background: "var(--wash)", borderRadius: "9999px", padding: "0.5rem 1.2rem" }}>
                {o.charAt(0).toUpperCase() + o.slice(1)}
              </span>
            ))}
          </div>
        </div>
        )}
        <p style={{ fontSize: "1.3rem", color: "var(--muted)", marginTop: "1.2rem", lineHeight: 1.5 }}>
          Generated from your own photo, using shades from your palette below.
        </p>
        {remaining > 0 && (
          <div style={{ marginTop: "1.6rem" }}>
            <button
              type="button"
              onClick={generate}
              disabled={state === "loading"}
              style={{
                display: "inline-flex", alignItems: "center", gap: "0.7rem", padding: "0.8rem 1.6rem",
                borderRadius: "9999px", border: "1px solid var(--line)", background: "var(--surface)",
                cursor: state === "loading" ? "default" : "pointer", fontSize: "1.3rem", fontWeight: 600,
                color: "var(--primary)", opacity: state === "loading" ? 0.6 : 1,
              }}
            >
              <IconRefresh size={1.5} strokeWidth={2} />
              {state === "loading" ? "Generating a new set…" : `Try a different set (${remaining} left)`}
            </button>
          </div>
        )}

      </div>
    );
  }

  return (
    <div id="v2-result-colour" className="v2-result-anchor" style={{ textAlign: "center", padding: "3.2rem 0", background: "var(--canvas)", borderRadius: "1.2rem" }}>
      {state === "error" ? (
        <>
          <p style={{ color: "#C8503A", fontSize: "1.4rem", marginBottom: "1.4rem" }}>{error}</p>
          <PrimaryButton fullWidth={false} onClick={generate}>Try again</PrimaryButton>
        </>
      ) : (
        <GenerationLoader kind="colour" title={`Dressing you in your ${analysis.sub_season} palette…`} detail="Creating occasion-ready looks from your recommended colours." />
      )}
    </div>
  );
}
