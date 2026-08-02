"use client";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { IconRefresh } from "@/components/ui/icons";

interface Props {
  sessionId: string;
  photo: string | null;
  isPremium: boolean;
  onRequirePremium: () => void;
  /** Storage path of a grid generated on an earlier visit, if any. */
  initialPath?: string | null;
  /** Regenerations left for this scan, from the stored generation count. */
  initialRemaining?: number;
}

// One generated grid instead of a style-picker that billed a separate
// generation per tap. Same reasoning as the colour grid: cheaper, one wait
// instead of five, and every panel is lit and framed identically.
const OCCASION_LABELS = ["Office", "Wedding / formal", "Everyday casual", "Evening party", "Short & low-maintenance", "Textured everyday"];

// Short, practical guidance. Deliberately brief: the report already carries
// the scored hair metrics and their reference material, so this is the
// "what do I actually do" layer, not another wall of explanation.
const CARE_TIPS: Array<{ heading: string; body: string }> = [
  { heading: "Wash", body: "Two to three times a week for most hair types. Daily washing strips the natural oils that protect the lengths." },
  { heading: "Heat", body: "The single biggest cause of visible damage. Use heat protection every time, and keep tools below 180C." },
  { heading: "Condition", body: "Through the mid-lengths and ends, not the scalp. Conditioner on the roots flattens volume and can clog follicles." },
  { heading: "Handle wet hair gently", body: "Hair is at its weakest when wet. Blot rather than rub, and use a wide-tooth comb instead of a brush." },
  { heading: "If density is dropping", body: "Act early, hair responds far better to early intervention. Check iron and vitamin D, avoid tight styles that pull on the hairline, and see a dermatologist rather than guessing with topicals." },
  { heading: "Trim", body: "Every eight to twelve weeks. Split ends travel upward and cannot be repaired once they start." },
];

export default function HairstylePanel({ sessionId, photo, isPremium, onRequirePremium, initialPath, initialRemaining = 0 }: Props) {
  const supabase = createClient();
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  // Regenerations left for this scan. The route is the authority and returns an
  // updated figure with every generation; this only decides whether the button
  // is worth showing.
  const [remaining, setRemaining] = useState(initialRemaining);

  const [error, setError] = useState("");

  async function generate() {
    if (!isPremium) { onRequirePremium(); return; }
    if (!photo) { setError("No photo available for this scan."); return; }
    setState("loading"); setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Please log in again.");
      const res = await fetch("/api/hairstyle/grid", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ sessionId, photoDataUrl: photo }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not generate your hairstyle previews");
      setUrl(body.url);
      if (typeof body.remaining === "number") setRemaining(body.remaining);
      setState("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setState("error");
    }
  }

  // A grid generated on an earlier visit is stored, so re-sign it rather than
  // paying for the same image again. Without this the panel billed a fresh
  // generation on every report view, and once the report gained tabs, on every
  // switch back to this tab. Signed URLs expire, so only the path is persisted.
  const [resolved, setResolved] = useState(false);
  if (initialPath && !resolved && !url) {
    setResolved(true);
    supabase.storage.from("photos_v2").createSignedUrl(initialPath, 60 * 60 * 24 * 7)
      .then(({ data }) => { if (data?.signedUrl) setUrl(data.signedUrl); });
  }

  // Already paid for, so it should not need a second click to unlock.
  // Ref guard prevents React's dev double-mount billing two generations.
  const kicked = useRef(false);
  useEffect(() => {
    if (kicked.current || url || initialPath || !photo || !isPremium) return;
    kicked.current = true;
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo, isPremium, initialPath]);

  return (
    <div style={{ marginTop: "4rem", paddingTop: "4rem", borderTop: "1px solid var(--line)" }}>
      <h2 style={{ fontSize: "2rem", fontWeight: 500, color: "var(--primary)", marginBottom: "0.8rem" }}>Hairstyles For You</h2>
      <p style={{ fontSize: "1.5rem", color: "var(--secondary)", lineHeight: 1.5, marginBottom: "2.4rem" }}>
        A look for each occasion, previewed on your own photo. Illustrative only, actual results vary by stylist.
      </p>

      {url ? (
        <div style={{ marginBottom: "3.2rem" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="Hairstyle previews on your photo" style={{ width: "100%", borderRadius: "1.2rem", display: "block" }} />
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
      ) : (
        <div style={{ textAlign: "center", padding: "3.2rem 0", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "1.2rem", marginBottom: "3.2rem" }}>
          {state === "error" ? (
            <>
              <p style={{ color: "#C8503A", fontSize: "1.4rem", marginBottom: "1.4rem" }}>{error}</p>
              <PrimaryButton fullWidth={false} onClick={generate}>Try again</PrimaryButton>
            </>
          ) : (
            <>
              <p style={{ fontSize: "1.5rem", color: "var(--primary)", fontWeight: 500, margin: "0 0 0.6rem" }}>Creating your hairstyle previews…</p>
              <p style={{ fontSize: "1.3rem", color: "var(--muted)", margin: 0 }}>This takes around 15 seconds.</p>
            </>
          )}
        </div>
      )}

      <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "1.6rem", padding: "2.8rem 3.2rem" }}>
        <p style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 1.8rem" }}>
          Looking after your hair
        </p>
        <div className="v2-care-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.8rem 3.2rem" }}>
          {CARE_TIPS.map((t) => (
            <div key={t.heading}>
              <p style={{ fontSize: "1.4rem", fontWeight: 600, color: "var(--primary)", margin: "0 0 0.4rem" }}>{t.heading}</p>
              <p style={{ fontSize: "1.35rem", color: "var(--secondary)", lineHeight: 1.55, margin: 0 }}>{t.body}</p>
            </div>
          ))}
        </div>
      </div>

      <style>{`@media (max-width: 700px) { .v2-care-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
