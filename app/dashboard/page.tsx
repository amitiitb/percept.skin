"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useFunnelV2Store } from "@/store/funnelV2";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { DashboardEmptyState } from "@/components/v2/DashboardEmptyState";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ScoreReveal } from "@/components/v2/ScoreReveal";
import { Logo } from "@/components/ui/Logo";

const GOLD = "#D9A62E";

const TIPS = [
  "Retake your scan every 2-3 weeks — that's the smallest gap where real change actually shows up.",
  "Same lighting and angle each time makes your trend line mean something. Guided capture handles both for you.",
  "A metric moving a few points either way is normal. Look at the trend across scans, not one number alone.",
];

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
        <div className="v2-dash-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1.6rem", marginBottom: "3.2rem" }}>
          <div>
            <Logo height="1.5rem" className="v2-dash-logo" />
            <h1 className="v2-dash-greeting" style={{ fontSize: "3.6rem", fontWeight: 400, color: "var(--primary)", margin: "0.6rem 0 0" }}>
              Hey{name ? `, ${name.split(" ")[0]}` : ""}
            </h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.8rem", flexShrink: 0 }}>
          <ThemeToggle />
          <button
            onClick={() => router.push("/")}
            aria-label="Visit percept.skin"
            style={{ width: "4.2rem", height: "4.2rem", flexShrink: 0, borderRadius: "50%", border: "1px solid var(--line)", background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
          >
            <svg width="19" height="19" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 11.5L12 4l9 7.5M5 10v9a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1v-9" />
            </svg>
          </button>
          <button
            onClick={() => router.push("/settings")}
            aria-label="Settings"
            style={{ width: "4.2rem", height: "4.2rem", flexShrink: 0, borderRadius: "50%", border: "1px solid var(--line)", background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
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
          <div className="v2-dash-grid" style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "2rem" }}>
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              style={{ position: "relative", overflow: "hidden", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "1.8rem", padding: "3.2rem" }}
            >
              <div aria-hidden style={{ position: "absolute", top: "-30%", right: "-15%", width: "24rem", height: "24rem", borderRadius: "50%", background: GOLD, opacity: 0.14, filter: "blur(60px)", pointerEvents: "none" }} />
              <p style={{ position: "relative", fontSize: "1.3rem", fontWeight: 700, color: "var(--rose)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1.6rem" }}>Latest Percept Score</p>
              {latest.status === "complete" ? (
                <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
                  <ScoreReveal score={latest.overall_score ?? 0} ringColor={GOLD} />
                  {latest.skin_age !== null && (
                    <span style={{ marginTop: "1.2rem", fontSize: "1.3rem", fontWeight: 600, color: "var(--primary)", background: "rgba(217,166,46,0.14)", borderRadius: "9999px", padding: "0.6rem 1.6rem" }}>
                      Skin age estimate: {latest.skin_age}
                    </span>
                  )}
                  <div style={{ marginTop: "2.4rem", display: "flex", gap: "1.2rem", flexWrap: "wrap", justifyContent: "center" }}>
                    <PrimaryButton variant="outline" fullWidth={false} onClick={() => router.push(`/report/${latest.id}`)}>View report →</PrimaryButton>
                    <PrimaryButton fullWidth={false} onClick={() => router.push(`/perceptgpt?session=${latest.id}`)}>Ask PerceptGPT →</PrimaryButton>
                  </div>
                </div>
              ) : (
                <p style={{ position: "relative", fontSize: "1.7rem", color: "var(--secondary)" }}>Your last scan is still processing.</p>
              )}
            </motion.div>

            <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.05 }}
                style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "1.8rem", padding: "3.2rem" }}
              >
                <p style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--rose)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1.2rem" }}>Scan history</p>
                <strong style={{ fontSize: "3.2rem", fontWeight: 400, color: "var(--primary)" }}>{sessionCount}</strong>
                <span style={{ fontSize: "1.5rem", color: "var(--secondary)" }}> {sessionCount === 1 ? "analysis" : "analyses"}</span>
                <div style={{ marginTop: "2rem" }}>
                  <PrimaryButton variant="outline" fullWidth={false} onClick={() => router.push("/history")}>View all →</PrimaryButton>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                style={{ display: "flex", gap: "1.4rem", background: "var(--panel)", borderRadius: "1.8rem", padding: "2.4rem" }}
              >
                <span aria-hidden style={{ flexShrink: 0, width: "3.2rem", height: "3.2rem", borderRadius: "1rem", background: "rgba(232,96,79,0.14)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--rose)" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 2v2m0 16v2M4.2 4.2l1.4 1.4m12.8 12.8l1.4 1.4M2 12h2m16 0h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M12 8a4 4 0 100 8 4 4 0 000-8z" /></svg>
                </span>
                <p style={{ fontSize: "1.4rem", color: "var(--secondary)", lineHeight: 1.55 }}>
                  {TIPS[sessionCount % TIPS.length]}
                </p>
              </motion.div>
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
