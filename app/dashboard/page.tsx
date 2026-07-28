"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useFunnelV2Store } from "@/store/funnelV2";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

const RING_RADIUS = 70;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

// Waiting-state ring — deliberately does NOT count up to a number (there's
// no score yet). A rotating arc instead of a static empty circle, so the
// spot where the real Glow Score will live reads as "about to happen"
// rather than just blank UI.
function WaitingRing() {
  return (
    <div style={{ position: "relative", width: "14rem", height: "14rem", flexShrink: 0 }}>
      <svg width="100%" height="100%" viewBox="0 0 160 160">
        <circle cx="80" cy="80" r={RING_RADIUS} fill="none" stroke="var(--line)" strokeWidth="7" />
        <motion.circle
          cx="80" cy="80" r={RING_RADIUS} fill="none" stroke="var(--rose)" strokeWidth="7"
          strokeLinecap="round" strokeDasharray={`${RING_CIRCUMFERENCE * 0.22} ${RING_CIRCUMFERENCE}`}
          style={{ transformOrigin: "80px 80px" }}
          animate={{ rotate: 360 }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
        <span style={{ fontSize: "1.1rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Glow Score</span>
        <span style={{ fontSize: "1.4rem", color: "var(--secondary)", marginTop: "0.3rem" }}>...</span>
      </div>
    </div>
  );
}

const FIRST_SCAN_FACTS = [
  { icon: "20+", label: "Real metrics scored", body: "Skin, face, and hair, each broken out individually, not one vague grade." },
  { icon: "2-4m", label: "Guided, not guesswork", body: "A short photo sequence tells you exactly what to capture, step by step." },
  { icon: "+5%", label: "Why it's worth doing", body: "Peer-reviewed research: people rated above average in appearance earn measurably more, every occupation studied." },
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
    <div style={{ minHeight: "100dvh", background: "var(--canvas)", padding: "6rem 3.2rem" }}>
      <div style={{ maxWidth: "108rem", margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1.6rem", marginBottom: "3.2rem" }}>
          <div>
            <h1 style={{ fontSize: "3.6rem", fontWeight: 400, color: "var(--primary)", margin: "0 0 0.8rem" }}>
              Hey{name ? `, ${name.split(" ")[0]}` : ""}
            </h1>
          </div>
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

        <div style={{ marginBottom: "3.2rem" }}>
          <PrimaryButton fullWidth={false} onClick={startNewAnalysis}>Start New Analysis →</PrimaryButton>
        </div>

        {!latest ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            style={{ background: "var(--primary)", borderRadius: "2rem", padding: "3.6rem", position: "relative", overflow: "hidden" }}
          >
            <div aria-hidden style={{ position: "absolute", top: "-30%", right: "-10%", width: "36rem", height: "36rem", borderRadius: "50%", background: "radial-gradient(circle, var(--rose) 0%, transparent 70%)", opacity: 0.16, filter: "blur(50px)" }} />
            <div className="v2-empty-hero" style={{ position: "relative", display: "flex", alignItems: "center", gap: "3.2rem", marginBottom: "3.2rem", flexWrap: "wrap" }}>
              <WaitingRing />
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--rose)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "0.8rem" }}>
                  No analyses yet
                </p>
                <h2 style={{ fontSize: "2.4rem", fontWeight: 400, color: "#fff", lineHeight: 1.2, marginBottom: "1.2rem" }}>
                  Your first Glow Score is a few minutes away
                </h2>
                <PrimaryButton fullWidth={false} onClick={startNewAnalysis}>Start your first scan →</PrimaryButton>
              </div>
            </div>

            <div className="v2-empty-facts" style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.6rem", paddingTop: "3.2rem", borderTop: "1px solid rgba(255,255,255,0.12)" }}>
              {FIRST_SCAN_FACTS.map((f, i) => (
                <motion.div
                  key={f.label}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.15 + i * 0.08 }}
                >
                  <p style={{ fontSize: "2rem", fontWeight: 700, color: "var(--rose)", marginBottom: "0.6rem" }}>{f.icon}</p>
                  <p style={{ fontSize: "1.5rem", fontWeight: 500, color: "#fff", marginBottom: "0.4rem" }}>{f.label}</p>
                  <p style={{ fontSize: "1.3rem", color: "rgba(255,255,255,0.65)", lineHeight: 1.5 }}>{f.body}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
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
                    <PrimaryButton variant="outline" fullWidth={false} onClick={() => router.push(`/report/${latest.id}`)}>View report →</PrimaryButton>
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
        @media (max-width: 700px) { .v2-empty-facts { grid-template-columns: 1fr !important; } }
        @media (max-width: 560px) { .v2-empty-hero { flex-direction: column !important; text-align: center; } }
      `}</style>
    </div>
  );
}
