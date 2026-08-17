"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { IconRefresh } from "@/components/ui/icons";
import { GenerationLoader } from "@/components/v2/GenerationLoader";
import { enqueueImageGeneration } from "@/lib/v2/clientGenerationQueue";

interface Props {
  sessionId: string;
  photo: string | null;
  /** Storage path of a grid generated on an earlier visit, if any. */
  initialPath?: string | null;
  /** Regenerations left for this scan, from the stored generation count. */
  initialRemaining?: number;
}

// Labels live here, not in the generated image: the image model garbles small
// type, and it does not honour a requested panel count reliably, so panels are
// never labelled positionally inside the picture itself.
const OCCASION_LABELS = ["Office", "Evening / party", "Formal & wedding", "Everyday casual", "Minimal rimless", "Sporty everyday"];

// The /api/frame-tryon/grid route already existed and was already persisting
// its output, but nothing on the report ever called it, so the five-frame
// overview the user asked for never rendered. FrameAIPanel below it stays as
// the per-frame, tap-to-generate option.
export function FrameGrid({ sessionId, photo, initialPath, initialRemaining = 0 }: Props) {
  const supabase = createClient();
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  // Regenerations left for this scan. The route is the authority and returns an
  // updated figure with every generation; this only decides whether the button
  // is worth showing.
  const [remaining, setRemaining] = useState(initialRemaining);

  const [error, setError] = useState("");

  // Stored grids are re-signed rather than regenerated: signed URLs expire, so
  // only the storage path is persisted, and a fresh generation would bill again
  // for an image the user has already paid for.
  const [resolved, setResolved] = useState(false);
  if (initialPath && !resolved && !url) {
    setResolved(true);
    supabase.storage.from("photos_v2").createSignedUrl(initialPath, 60 * 60 * 24 * 7)
      .then(({ data }) => { if (data?.signedUrl) setUrl(data.signedUrl); });
  }

  async function generate() {
    if (!photo) { setError("No front-face photo available for this scan."); return; }
    setState("loading"); setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Please log in again.");
      const res = await enqueueImageGeneration(() => fetch("/api/frame-tryon/grid", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ sessionId, photoDataUrl: photo }),
      }));
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not generate your frame previews");
      setUrl(body.url);
      if (typeof body.remaining === "number") setRemaining(body.remaining);
      setState("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setState("error");
    }
  }

  if (url) {
    return (
      <div style={{ marginBottom: "3.2rem" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="Five frame styles previewed on your photo" style={{ width: "100%", borderRadius: "1.2rem", display: "block" }} />
        <div style={{ marginTop: "1.4rem" }}>
          <p style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 0.8rem" }}>Generated to cover</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
            {OCCASION_LABELS.map((o, i) => (
              <span key={i} style={{ fontSize: "1.25rem", color: "var(--primary)", background: "var(--wash)", borderRadius: "9999px", padding: "0.5rem 1.2rem" }}>
                {o.charAt(0).toUpperCase() + o.slice(1)}
              </span>
            ))}
          </div>
        </div>
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
    <div style={{ textAlign: "center", padding: "3.2rem 0", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "1.2rem", marginBottom: "3.2rem" }}>
      {state === "error" ? (
        <>
          <p style={{ color: "#C8503A", fontSize: "1.4rem", marginBottom: "1.4rem" }}>{error}</p>
          <PrimaryButton fullWidth={false} onClick={generate}>Try again</PrimaryButton>
        </>
      ) : state === "loading" ? (
        <GenerationLoader kind="frame" title="Fitting six frame styles to your face…" detail="Matching frame shape, scale and bridge position to your proportions." />
      ) : (
        <>
          <p style={{ color: "var(--secondary)", fontSize: "1.35rem", margin: "0 0 1.35rem" }}>Your preview was not completed during report preparation.</p>
          <PrimaryButton fullWidth={false} onClick={generate}>Generate frame previews</PrimaryButton>
        </>
      )}
    </div>
  );
}
