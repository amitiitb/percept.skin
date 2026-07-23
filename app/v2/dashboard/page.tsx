"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useFunnelV2Store } from "@/store/funnelV2";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { LockedCard } from "@/components/v2/LockedCard";
import { PLANS } from "@/lib/v2/paypal";

interface LatestSession {
  id: string;
  overall_score: number | null;
  skin_age: number | null;
  status: string;
  created_at: string;
}

export default function V2DashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const { reset } = useFunnelV2Store();

  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [isPremium, setIsPremium] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);
  const [latest, setLatest] = useState<LatestSession | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/auth/login?next=/v2/dashboard"); return; }

      const [{ data: profile }, { data: sub }, { data: sessions, count }] = await Promise.all([
        supabase.from("user_profiles_v2").select("name").eq("user_id", user.id).maybeSingle(),
        supabase.from("subscriptions_v2").select("status").eq("user_id", user.id).eq("status", "active").maybeSingle(),
        supabase.from("analysis_sessions_v2").select("id, overall_score, skin_age, status, created_at", { count: "exact" }).eq("user_id", user.id).order("created_at", { ascending: false }).limit(1),
      ]);

      setName(profile?.name ?? "");
      setIsPremium(!!sub);
      setSessionCount(count ?? 0);
      setLatest((sessions?.[0] as LatestSession) ?? null);
      setLoading(false);
    });
  }, []);

  function startNewAnalysis() {
    reset();
    router.push("/v2/scan-prep");
  }

  if (loading) {
    return <div style={{ minHeight: "100dvh", background: "var(--canvas)" }} />;
  }

  return (
    <div style={{ minHeight: "100dvh", background: "var(--canvas)", padding: "6rem 3.2rem" }}>
      <div style={{ maxWidth: "108rem", margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1.6rem", marginBottom: "3.2rem" }}>
          <div>
            <h1 style={{ fontSize: "3.6rem", fontWeight: 400, color: "var(--primary)", margin: "0 0 0.8rem" }}>
              Hey{name ? `, ${name.split(" ")[0]}` : ""}
            </h1>
            <p style={{ fontSize: "1.6rem", color: "var(--secondary)", margin: 0 }}>
              {isPremium ? "Glowmetry Premium" : "Free plan"}
            </p>
          </div>
          <button
            onClick={() => router.push("/v2/settings")}
            aria-label="Settings"
            style={{ width: "4.8rem", height: "4.8rem", flexShrink: 0, borderRadius: "50%", border: "1px solid var(--line)", background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
          >
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>

        <div style={{ marginBottom: "3.2rem" }}>
          <PrimaryButton fullWidth={false} onClick={startNewAnalysis}>Start New Analysis →</PrimaryButton>
        </div>

        {!latest ? (
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "1.6rem", padding: "6rem 3.2rem", textAlign: "center" }}>
            <p style={{ fontSize: "2rem", color: "var(--primary)", marginBottom: "1rem" }}>No analyses yet</p>
            <p style={{ fontSize: "1.5rem", color: "var(--secondary)" }}>Start your first guided scan to see your Glow Score here.</p>
          </div>
        ) : (
          <div className="v2-dash-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
            <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "1.6rem", padding: "3.2rem" }}>
              <p style={{ fontSize: "1.3rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1.2rem" }}>Latest Glow Score</p>
              {latest.status === "complete" ? (
                <>
                  <strong style={{ fontSize: "6.4rem", fontWeight: 300, color: "var(--primary)" }}>{latest.overall_score}</strong>
                  {latest.skin_age !== null && (
                    <p style={{ fontSize: "1.5rem", color: "var(--secondary)", marginTop: "0.8rem" }}>Skin age estimate: {latest.skin_age}</p>
                  )}
                  <div style={{ marginTop: "2rem" }}>
                    <PrimaryButton variant="outline" fullWidth={false} onClick={() => router.push(`/v2/report/${latest.id}`)}>View report →</PrimaryButton>
                  </div>
                </>
              ) : (
                <p style={{ fontSize: "1.7rem", color: "var(--secondary)" }}>Your last scan is still processing.</p>
              )}
            </div>

            <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "1.6rem", padding: "3.2rem" }}>
              <p style={{ fontSize: "1.3rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1.2rem" }}>Scan history</p>
              <strong style={{ fontSize: "3.2rem", fontWeight: 400, color: "var(--primary)" }}>{sessionCount}</strong>
              <span style={{ fontSize: "1.5rem", color: "var(--secondary)" }}> {sessionCount === 1 ? "analysis" : "analyses"}</span>
              <div style={{ marginTop: "2rem" }}>
                <PrimaryButton variant="outline" fullWidth={false} onClick={() => router.push("/v2/history")}>View all →</PrimaryButton>
              </div>
            </div>

            {!isPremium && (
              <div style={{ gridColumn: "1 / -1" }}>
                <LockedCard title="Progress tracking" description={`See how your Glow Score, skin age, and individual metrics change scan over scan. Premium from $${PLANS.monthly.price}/mo · cancel anytime.`} onUnlock={() => router.push("/v2/plans")} />
              </div>
            )}
          </div>
        )}
      </div>
      <style>{`@media (max-width: 800px) { .v2-dash-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
