"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useFunnelV2Store } from "@/store/funnelV2";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { DashboardEmptyState } from "@/components/v2/DashboardEmptyState";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

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
  const [sessionCount, setSessionCount] = useState(0);
  const [latest, setLatest] = useState<LatestSession | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/auth/login?next=/dashboard"); return; }

      const [{ data: profile }, { data: sessions, count }] = await Promise.all([
        supabase.from("user_profiles_v2").select("name").eq("user_id", user.id).maybeSingle(),
        supabase.from("analysis_sessions_v2").select("id, overall_score, skin_age, status, created_at", { count: "exact" }).eq("user_id", user.id).order("created_at", { ascending: false }).limit(1),
      ]);

      setName(profile?.name ?? "");
      setSessionCount(count ?? 0);
      setLatest((sessions?.[0] as LatestSession) ?? null);
      setLoading(false);
    });
  }, []);

  function startNewAnalysis() {
    reset();
    router.push("/scan-prep");
  }

  if (loading) {
    return <div style={{ minHeight: "100dvh", background: "var(--canvas)" }} />;
  }

  return (
    <div className="v2-dash-page" style={{ minHeight: "100dvh", background: "var(--canvas)", padding: "6rem 3.2rem" }}>
      <div style={{ maxWidth: "108rem", margin: "0 auto" }}>
        <div className="v2-dash-header" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1.6rem", marginBottom: "3.2rem" }}>
          <div>
            <h1 className="v2-dash-greeting" style={{ fontSize: "3.6rem", fontWeight: 400, color: "var(--primary)", margin: "0 0 0.8rem" }}>
              Hey{name ? `, ${name.split(" ")[0]}` : ""}
            </h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.8rem", flexShrink: 0 }}>
          <ThemeToggle />
          <button
            onClick={() => router.push("/settings")}
            aria-label="Settings"
            style={{ width: "4.8rem", height: "4.8rem", flexShrink: 0, borderRadius: "50%", border: "1px solid var(--line)", background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
          >
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
          </div>
        </div>

        {/* Only shown once there is history. Before the first scan the empty
            state below already carries the single, clearer call to action, and
            two buttons firing the same function read as a layout mistake. */}
        {latest && (
          <div style={{ marginBottom: "3.2rem" }}>
            <PrimaryButton fullWidth={false} onClick={startNewAnalysis}>Start New Analysis →</PrimaryButton>
          </div>
        )}

        {!latest ? (
          <DashboardEmptyState onStart={startNewAnalysis} />
        ) : (
          <div className="v2-dash-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
            <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "1.6rem", padding: "3.2rem" }}>
              <p style={{ fontSize: "1.3rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1.2rem" }}>Latest Percept Score</p>
              {latest.status === "complete" ? (
                <>
                  <strong style={{ fontSize: "6.4rem", fontWeight: 300, color: "var(--primary)" }}>{latest.overall_score}</strong>
                  {latest.skin_age !== null && (
                    <p style={{ fontSize: "1.5rem", color: "var(--secondary)", marginTop: "0.8rem" }}>Skin age estimate: {latest.skin_age}</p>
                  )}
                  <div style={{ marginTop: "2rem", display: "flex", gap: "1.2rem", flexWrap: "wrap" }}>
                    <PrimaryButton variant="outline" fullWidth={false} onClick={() => router.push(`/report/${latest.id}`)}>View report →</PrimaryButton>
                    <PrimaryButton fullWidth={false} onClick={() => router.push(`/perceptgpt?session=${latest.id}`)}>Ask PerceptGPT →</PrimaryButton>
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
                <PrimaryButton variant="outline" fullWidth={false} onClick={() => router.push("/history")}>View all →</PrimaryButton>
              </div>
            </div>
          </div>
        )}
      </div>
      <style>{`
        @media (max-width: 800px) { .v2-dash-grid { grid-template-columns: 1fr !important; } }
        /* 6rem of top padding plus the greeting left roughly a third of a phone
           screen empty before any content began. */
        @media (max-width: 640px) {
          .v2-dash-page { padding: 3.2rem 2rem 4rem !important; }
          .v2-dash-greeting { font-size: 2.8rem !important; }
          .v2-dash-header { margin-bottom: 2.4rem !important; }
        }
      `}</style>
    </div>
  );
}
