"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useFunnelV2Store } from "@/store/funnelV2";
import { V2Layout } from "@/components/v2/V2Layout";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Card } from "@/components/ui/Card";
import type { SkinConcern, SkinType } from "@/lib/v2/types";

const SKIN_TYPES: { value: SkinType; label: string }[] = [
  { value: "dry", label: "Dry" }, { value: "oily", label: "Oily" },
  { value: "combination", label: "Combination" }, { value: "normal", label: "Normal" },
  { value: "sensitive", label: "Sensitive" }, { value: "not_sure", label: "Not sure" },
];

const CONCERNS: { value: SkinConcern; label: string }[] = [
  { value: "acne", label: "Acne or blemishes" }, { value: "fine_lines", label: "Fine lines" },
  { value: "wrinkles", label: "Wrinkles" }, { value: "dark_spots", label: "Dark spots" },
  { value: "uneven_tone", label: "Uneven skin tone" }, { value: "redness", label: "Redness" },
  { value: "dryness", label: "Dryness" }, { value: "enlarged_pores", label: "Enlarged pores" },
  { value: "under_eye", label: "Under-eye concerns" }, { value: "hair_thinning", label: "Hair thinning" },
  { value: "hair_fall", label: "Hair fall" }, { value: "scalp_visibility", label: "Scalp visibility" },
  { value: "dandruff", label: "Dandruff or flaking" },
];

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: "1rem 1.8rem", borderRadius: "9999px", fontSize: "1.4rem", fontWeight: 500,
      border: `1px solid ${selected ? "var(--primary)" : "var(--line)"}`,
      background: selected ? "var(--btn-fill)" : "var(--canvas)",
      color: selected ? "var(--btn-fill-ink)" : "var(--secondary)",
      cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap",
    }}>
      {children}
    </button>
  );
}

export default function V2ProfileSetupPage() {
  const router = useRouter();
  const supabase = createClient();
  const { name, ageRange, country, skinType, skinConcerns, consentGiven, setProfile } = useFunnelV2Store();

  const [authLoading, setAuthLoading] = useState(true);
  const [form, setForm] = useState({ name, ageRange, country, skinType, skinConcerns });
  const [consent, setConsent] = useState(consentGiven);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionStorage.getItem("percept_photo_consent") === "true") setConsent(true);
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace("/auth/login?next=/profile-setup"); return; }
      // Signup already asked for the name (auth/signup's "Full name" field,
      // saved to user_metadata) — don't make them type it again here if we
      // already have it and they haven't started filling this form yet.
      const metaName = typeof user.user_metadata?.name === "string" ? user.user_metadata.name : "";
      if (metaName) setForm((f) => (f.name ? f : { ...f, name: metaName }));
      setAuthLoading(false);
    });
  }, []);

  const valid = form.name.trim().length > 0 && form.ageRange && consent;

  function toggleConcern(c: SkinConcern) {
    setForm((f) => ({ ...f, skinConcerns: f.skinConcerns.includes(c) ? f.skinConcerns.filter((x) => x !== c) : [...f.skinConcerns, c] }));
  }

  async function handleContinue() {
    setSaving(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Please log in again.");

      setProfile({ ...form, consentGiven: consent });

      const { error: dbErr } = await supabase.from("user_profiles_v2").upsert({
        user_id: user.id,
        name: form.name.trim(),
        age_range: form.ageRange,
        country: form.country,
        skin_type: form.skinType,
        skin_concerns: form.skinConcerns,
        consent_given: consent,
      }, { onConflict: "user_id" });
      if (dbErr) throw dbErr;

      const sessionId = new URLSearchParams(window.location.search).get("session");
      router.push(sessionId ? `/bundle/${sessionId}` : "/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong saving your profile.");
    } finally {
      setSaving(false);
    }
  }

  if (authLoading) {
    return <div style={{ minHeight: "100dvh", background: "var(--canvas)" }} />;
  }

  return (
    <V2Layout headline="A few quick details" sub="This helps personalise your report. Nothing here is shared or sold." progress={20} showBack={false}>
      <div style={{ width: "100%", maxWidth: "64rem" }}>
        <p style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--rose)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "1rem" }}>
          Your profile
        </p>
        <h1 style={{ fontSize: "clamp(2.6rem, 5vw, 3.6rem)", fontWeight: 400, color: "var(--primary)", marginBottom: "0.8rem" }}>
          A few quick details
        </h1>
        <p style={{ fontSize: "1.5rem", color: "var(--secondary)", lineHeight: 1.5, marginBottom: "3.2rem" }}>
          This helps personalise your report. Nothing here is shared or sold.
        </p>

        <Card eyebrow="Personal info">
          <div style={{ display: "flex", flexDirection: "column", gap: "2.4rem" }}>
            <div>
              <label style={{ fontSize: "1.2rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Your name"
                style={{ width: "100%", marginTop: "0.8rem", background: "transparent", border: "none", borderBottom: "1px solid var(--line)", padding: "1rem 0", fontSize: "1.8rem", color: "var(--primary)", outline: "none" }}
              />
            </div>

            <div>
              <label style={{ fontSize: "1.2rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Age range</label>
              <div style={{ display: "flex", gap: "1rem", marginTop: "1rem", flexWrap: "wrap" }}>
                {["18-24", "25-34", "35-44", "45-54", "55+"].map((r) => (
                  <Chip key={r} selected={form.ageRange === r} onClick={() => setForm((f) => ({ ...f, ageRange: r }))}>{r}</Chip>
                ))}
              </div>
            </div>

            <div>
              <label style={{ fontSize: "1.2rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Country</label>
              <input
                value={form.country}
                onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                placeholder="United States"
                style={{ width: "100%", marginTop: "0.8rem", background: "transparent", border: "none", borderBottom: "1px solid var(--line)", padding: "1rem 0", fontSize: "1.8rem", color: "var(--primary)", outline: "none" }}
              />
            </div>
          </div>
        </Card>

        <Card eyebrow="Skin profile">
          <div style={{ display: "flex", flexDirection: "column", gap: "2.4rem" }}>
            <div>
              <label style={{ fontSize: "1.2rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Skin type</label>
              <div style={{ display: "flex", gap: "1rem", marginTop: "1rem", flexWrap: "wrap" }}>
                {SKIN_TYPES.map((s) => (
                  <Chip key={s.value} selected={form.skinType === s.value} onClick={() => setForm((f) => ({ ...f, skinType: s.value }))}>{s.label}</Chip>
                ))}
              </div>
            </div>

            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                <label style={{ fontSize: "1.2rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Primary concerns</label>
                <span style={{ fontSize: "1.1rem", color: "var(--muted)" }}>Swipe for more →</span>
              </div>
              <div className="percept-concerns-scroll" style={{
                display: "flex", flexDirection: "column", rowGap: "1rem", marginTop: "1rem",
                overflowX: "auto", width: "100%", scrollSnapType: "x proximity",
                paddingBottom: "0.4rem", paddingRight: "2rem",
              }}>
                {[0, 1].map((row) => (
                  // Two independent flex rows instead of a CSS-grid column-flow —
                  // grid would size each column to its widest stacked item (a
                  // short chip under a long one), leaving a big dead gap before
                  // the next column. Plain flex rows size each chip on its own.
                  <div key={row} style={{ display: "flex", gap: "1rem" }}>
                    {CONCERNS.filter((_, i) => i % 2 === row).map((c) => (
                      <div key={c.value} style={{ scrollSnapAlign: "start", flexShrink: 0 }}>
                        <Chip selected={form.skinConcerns.includes(c.value)} onClick={() => toggleConcern(c.value)}>{c.label}</Chip>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <button
          type="button"
          role="checkbox"
          aria-checked={consent}
          onClick={() => setConsent((v) => !v)}
          style={{ display: "flex", gap: "1.2rem", cursor: "pointer", background: "none", border: "none", padding: 0, textAlign: "left", marginBottom: "3.2rem" }}
        >
          <span aria-hidden style={{ flexShrink: 0, marginTop: "0.2rem", width: "2rem", height: "2rem", borderRadius: "0.4rem", border: `2px solid ${consent ? "var(--btn-fill)" : "var(--line-strong)"}`, background: consent ? "var(--btn-fill)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {consent && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          </span>
          <span style={{ fontSize: "1.4rem", color: "var(--secondary)", lineHeight: 1.55 }}>
            I consent to Percept processing my uploaded photographs to generate my analysis, as described in the{" "}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: "var(--primary)", fontWeight: 500 }}>Privacy Policy</a>.
            Photos are never used to train AI models without separate explicit consent.
          </span>
        </button>

        {error && <p style={{ color: "var(--rose)", fontSize: "1.4rem", marginBottom: "1.6rem" }}>{error}</p>}

        <PrimaryButton onClick={handleContinue} disabled={!valid} loading={saving}>
          Continue →
        </PrimaryButton>
      </div>
      <style jsx global>{`
        .percept-concerns-scroll { scrollbar-width: none; -ms-overflow-style: none; }
        .percept-concerns-scroll::-webkit-scrollbar { display: none; }
      `}</style>
    </V2Layout>
  );
}
