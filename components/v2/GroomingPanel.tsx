"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { IconRefresh } from "@/components/ui/icons";

interface GridProps {
  sessionId: string;
  photo: string | null;
  isPremium: boolean;
  onRequirePremium: () => void;
  kind: "beard" | "eyebrow";
  endpoint: string;
  title: string;
  blurb: string;
  styleLabels: readonly string[];
  initialPath?: string | null;
  initialRemaining?: number;
}

// Same visual language as HairstylePanel's grid, but generation is opt-in
// (a "Generate" button) rather than auto-triggered on mount — the hairstyle
// grid already fires automatically once a scan is purchased, and adding two
// more auto-fired, real-money generations to every existing report view
// wasn't something to slip in silently. Each of the two grooming previews
// here is its own explicit click.
function GroomingGrid({ sessionId, photo, isPremium, onRequirePremium, kind, endpoint, title, blurb, styleLabels, initialPath, initialRemaining = 0 }: GridProps) {
  const supabase = createClient();
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [remaining, setRemaining] = useState(initialRemaining);
  const [error, setError] = useState("");

  const [resolved, setResolved] = useState(false);
  if (initialPath && !resolved && !url) {
    setResolved(true);
    supabase.storage.from("photos_v2").createSignedUrl(initialPath, 60 * 60 * 24 * 7)
      .then(({ data }) => { if (data?.signedUrl) setUrl(data.signedUrl); });
  }

  async function generate() {
    if (!isPremium) { onRequirePremium(); return; }
    if (!photo) { setError("No photo available for this scan."); return; }
    setState("loading"); setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Please log in again.");
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ sessionId, photoDataUrl: photo }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `Could not generate your ${kind} previews`);
      setUrl(body.url);
      if (typeof body.remaining === "number") setRemaining(body.remaining);
      setState("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setState("error");
    }
  }

  return (
    <div style={{ marginBottom: "3.2rem" }}>
      <h3 style={{ fontSize: "1.7rem", fontWeight: 500, color: "var(--primary)", marginBottom: "0.6rem" }}>{title}</h3>
      <p style={{ fontSize: "1.4rem", color: "var(--secondary)", lineHeight: 1.5, marginBottom: "1.8rem" }}>{blurb}</p>

      {url ? (
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={`${title} previews on your photo`} style={{ width: "100%", borderRadius: "1.2rem", display: "block" }} />
          <div style={{ marginTop: "1.4rem" }}>
            <p style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 0.8rem" }}>Generated to cover</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
              {styleLabels.map((s, i) => (
                <span key={i} style={{ fontSize: "1.25rem", color: "var(--primary)", background: "var(--wash)", borderRadius: "9999px", padding: "0.5rem 1.2rem" }}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
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
      ) : (
        <div style={{ textAlign: "center", padding: "3.2rem 0", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "1.2rem" }}>
          {state === "loading" ? (
            <>
              <p style={{ fontSize: "1.5rem", color: "var(--primary)", fontWeight: 500, margin: "0 0 0.6rem" }}>Creating your {kind} previews…</p>
              <p style={{ fontSize: "1.3rem", color: "var(--muted)", margin: 0 }}>This takes around 15 seconds.</p>
            </>
          ) : state === "error" ? (
            <>
              <p style={{ color: "#C8503A", fontSize: "1.4rem", marginBottom: "1.4rem" }}>{error}</p>
              <button type="button" onClick={generate} style={{ padding: "1.2rem 2.4rem", borderRadius: "9999px", border: "none", background: "var(--btn-fill)", color: "var(--btn-fill-ink)", fontSize: "1.4rem", fontWeight: 600, cursor: "pointer" }}>Try again</button>
            </>
          ) : (
            <button type="button" onClick={generate} style={{ padding: "1.2rem 2.4rem", borderRadius: "9999px", border: "none", background: "var(--btn-fill)", color: "var(--btn-fill-ink)", fontSize: "1.4rem", fontWeight: 600, cursor: "pointer" }}>
              {`Generate ${kind} previews →`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface Props {
  sessionId: string;
  photo: string | null;
  isPremium: boolean;
  onRequirePremium: () => void;
  initialBeardPath?: string | null;
  initialBeardRemaining?: number;
}

const BEARD_LABELS = ["Clean-shaven", "Light stubble", "Short boxed beard", "Full classic beard", "Goatee", "Mustache only"];

// Eyebrow-shape simulation was tried and dropped (not shipped): two rounds of
// real generations, including a prompt rewritten to explicitly demand
// exaggerated, obvious differences, both came back with all 6 panels showing
// near-identical brows. The image-edit model doesn't reliably alter eyebrow
// shape the way it reliably alters beard presence/coverage or hairstyle — a
// model/capability limit, not a wording problem, so shipping it would mean
// six copies of the same photo labeled as six different looks.
export default function GroomingPanel({ sessionId, photo, isPremium, onRequirePremium, initialBeardPath, initialBeardRemaining }: Props) {
  return (
    <div style={{ marginTop: "4rem", paddingTop: "4rem", borderTop: "1px solid var(--line)" }}>
      <h2 style={{ fontSize: "2rem", fontWeight: 500, color: "var(--primary)", marginBottom: "0.8rem" }}>Simulate</h2>
      <p style={{ fontSize: "1.5rem", color: "var(--secondary)", lineHeight: 1.5, marginBottom: "2.8rem" }}>
        See yourself with different looks before you commit. Illustrative only, actual results vary.
      </p>

      <GroomingGrid
        sessionId={sessionId} photo={photo} isPremium={isPremium} onRequirePremium={onRequirePremium}
        kind="beard" endpoint="/api/beard/grid" title="Beard Styles"
        blurb="From clean-shaven to a full beard, previewed on your own face."
        styleLabels={BEARD_LABELS} initialPath={initialBeardPath} initialRemaining={initialBeardRemaining}
      />
    </div>
  );
}
