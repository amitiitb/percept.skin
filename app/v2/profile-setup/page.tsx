"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useFunnelV2Store } from "@/store/funnelV2";
import { V2Layout } from "@/components/v2/V2Layout";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
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
      background: selected ? "var(--primary)" : "var(--canvas)",
      color: selected ? "#fff" : "var(--secondary)",
      cursor: "pointer", transition: "all 0.15s",
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
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.replace("/auth/login?next=/v2/profile-setup");
      else setAuthLoading(false);
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

      router.push("/v2/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong saving your profile.");
    } finally {
      setSaving(false);
    }
  }

  if (authLoading) {
    return <div style={{ minHeight: "100vh", background: "var(--canvas)" }} />;
  }

  return (
    <V2Layout headline="A few quick details" sub="This helps personalise your report — nothing here is shared or sold." progress={20} showBack={false}>
      <div style={{ display: "flex", flexDirection: "column", gap: "3.2rem", maxWidth: "64rem" }}>
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
            {["under18", "18-24", "25-34", "35-44", "45-54", "55+"].map((r) => (
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

        <div>
          <label style={{ fontSize: "1.2rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Skin type</label>
          <div style={{ display: "flex", gap: "1rem", marginTop: "1rem", flexWrap: "wrap" }}>
            {SKIN_TYPES.map((s) => (
              <Chip key={s.value} selected={form.skinType === s.value} onClick={() => setForm((f) => ({ ...f, skinType: s.value }))}>{s.label}</Chip>
            ))}
          </div>
        </div>

        <div>
          <label style={{ fontSize: "1.2rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Primary concerns</label>
          <div style={{ display: "flex", gap: "1rem", marginTop: "1rem", flexWrap: "wrap" }}>
            {CONCERNS.map((c) => (
              <Chip key={c.value} selected={form.skinConcerns.includes(c.value)} onClick={() => toggleConcern(c.value)}>{c.label}</Chip>
            ))}
          </div>
        </div>

        <div onClick={() => setConsent((v) => !v)} style={{ display: "flex", gap: "1.2rem", cursor: "pointer" }}>
          <span style={{ flexShrink: 0, marginTop: "0.2rem", width: "2rem", height: "2rem", borderRadius: "0.4rem", border: `2px solid ${consent ? "var(--primary)" : "var(--line-strong)"}`, background: consent ? "var(--primary)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {consent && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          </span>
          <span style={{ fontSize: "1.4rem", color: "var(--secondary)", lineHeight: 1.55 }}>
            I consent to Glowmetry processing my uploaded photographs to generate my analysis. Photos are never used to train AI models without separate explicit consent.
          </span>
        </div>

        {error && <p style={{ color: "var(--rose)", fontSize: "1.4rem" }}>{error}</p>}

        <PrimaryButton onClick={handleContinue} disabled={!valid} loading={saving}>
          Continue →
        </PrimaryButton>
      </div>
    </V2Layout>
  );
}
