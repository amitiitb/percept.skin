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
import { IconFaceScan, IconSparkle, IconClock, IconArrowRight } from "@/components/ui/icons";

const GOLD = "#D9A62E";

const TIPS = [
  "Retake your scan every 2-3 weeks. That is the smallest gap where real change actually shows up.",
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

  const lastScanDate = latest ? new Date(latest.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "";
  const nextScanDate = latest ? new Date(new Date(latest.created_at).getTime() + 21 * 24 * 60 * 60 * 1000).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "";

  if (loading) {
    return <div style={{ minHeight: "100dvh", background: "var(--canvas)" }} />;
  }

  return (
    <div className="v2-dash-page" style={{ minHeight: "100dvh", background: "var(--canvas)" }}>
      <div className="v2-dash-shell">
        <header className="v2-dash-header">
          <Logo height="clamp(3.4rem, 3vw, 4.4rem)" className="v2-dash-logo" />
          <div className="v2-dash-tools">
            <ThemeToggle />
            <button
              onClick={() => router.push("/")}
              aria-label="Visit percept.skin"
              className="v2-tool-button"
            >
              <svg width="19" height="19" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 11.5L12 4l9 7.5M5 10v9a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1v-9" />
              </svg>
            </button>
            <button onClick={() => router.push("/settings")} aria-label="Settings" className="v2-tool-button">
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>
        </header>

        <section className="v2-dash-intro">
          <div className="v2-dash-intro-copy">
            <p className="v2-dash-kicker">Your appearance dashboard</p>
            <h1 className="v2-dash-greeting" style={{ fontSize: "3.6rem", fontWeight: 400, color: "var(--primary)", margin: "0.6rem 0 0" }}>
              Hey{name ? `, ${name.split(" ")[0]}` : ""}
            </h1>
            <p className="v2-dash-subtitle">Your personal appearance insights, progress and next steps in one place.</p>
          </div>
          {latest && <div className="v2-dash-primary-action">
            <PrimaryButton fullWidth={false} onClick={startNewAnalysis}>Start New Analysis →</PrimaryButton>
            <span><i /> Guided capture takes only a few minutes</span>
          </div>}
        </section>

        {!latest ? (
          <DashboardEmptyState onStart={startNewAnalysis} />
        ) : (
          <div className="v2-dash-grid" style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "2rem" }}>
            <motion.div className="v2-score-card"
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
                  {/* PerceptGPT's own entry point is the floating button below —
                      having it here too collided with that fixed-position
                      button on mobile, and duplicated the same destination. */}
                  <div style={{ marginTop: "2.4rem" }}>
                    <PrimaryButton variant="outline" fullWidth={false} onClick={() => router.push(`/report/${latest.id}`)}>View report →</PrimaryButton>
                  </div>
                </div>
              ) : (
                <p style={{ position: "relative", fontSize: "1.7rem", color: "var(--secondary)" }}>Your last scan is still processing.</p>
              )}
            </motion.div>

            <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
              <motion.div
                className="v2-history-summary"
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

              <motion.div className="v2-next-checkin" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.08 }}>
                <div className="v2-next-checkin-icon"><IconClock size={1.8} /></div>
                <div><span>Progress checkpoint</span><strong>{nextScanDate}</strong><p>Repeat in similar lighting to create a meaningful comparison.</p></div>
              </motion.div>

              <motion.div
                className="v2-dashboard-tip"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                style={{ display: "flex", gap: "1.4rem", background: "var(--panel)", borderRadius: "1.8rem", padding: "2.4rem" }}
              >
                <span aria-hidden style={{ flexShrink: 0, width: "3.2rem", height: "3.2rem", borderRadius: "1rem", background: "rgba(232,96,79,0.14)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--rose)" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 2v2m0 16v2M4.2 4.2l1.4 1.4m12.8 12.8l1.4 1.4M2 12h2m16 0h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M12 8a4 4 0 100 8 4 4 0 000-8z" /></svg>
                </span>
                <p style={{ fontSize: "1.4rem", color: "rgba(255,255,255,0.9)", lineHeight: 1.55 }}>
                  {TIPS[sessionCount % TIPS.length]}
                </p>
              </motion.div>
            </div>
          </div>
        )}

        {latest?.status === "complete" && (
          <motion.section className="v2-next-actions" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .45, delay: .16 }}>
            <div className="v2-next-actions-heading"><div><p>Continue your journey</p><h2>What would you like to do next?</h2></div><span>Last scan · {lastScanDate}</span></div>
            <div className="v2-action-grid">
              <button onClick={() => router.push(`/report/${latest.id}`)}><span><IconFaceScan size={2} /></span><div><strong>Explore your report</strong><p>Review priorities, category scores and your personal routine.</p></div><IconArrowRight size={1.6} /></button>
              <button onClick={() => router.push(`/perceptgpt?session=${latest.id}`)}><span><IconSparkle size={2} /></span><div><strong>Ask PerceptGPT</strong><p>Turn your report into clear answers and practical guidance.</p></div><IconArrowRight size={1.6} /></button>
              <button onClick={() => router.push("/scan-prep")}><span><IconClock size={2} /></span><div><strong>Prepare your next scan</strong><p>Use consistent light and angles for reliable progress tracking.</p></div><IconArrowRight size={1.6} /></button>
            </div>
          </motion.section>
        )}
      </div>
      {/* Floating entry point to PerceptGPT — the embedded "Ask PerceptGPT"
          button inside the score card is easy to miss on a long page, so
          this stays visible (and animated) regardless of scroll position.
          Only shown once there's a completed scan to chat about — matches
          the gating on the button above and on /perceptgpt itself. */}
      {latest?.status === "complete" && (
        <motion.button
          onClick={() => router.push(`/perceptgpt?session=${latest.id}`)}
          aria-label="Ask PerceptGPT"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.5 }}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          style={{
            position: "fixed", bottom: "2.4rem", right: "2.4rem", zIndex: 40,
            width: "5.8rem", height: "5.8rem", borderRadius: "50%", border: "1px solid rgba(255,255,255,.7)",
            background: "var(--rose)", color: "#fff", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 1.2rem 3rem -0.8rem rgba(12,92,81,0.55), 0 0 0 .8rem rgba(26,158,143,.12)",
          }}
        >
          <motion.span
            aria-hidden
            animate={{ scale: [1, 1.7, 1.7], opacity: [0.55, 0, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut" }}
            style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "var(--rose)" }}
          />
          <svg style={{ position: "relative" }} width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 18.5 4 20l1-3.6A7.5 7.5 0 0 1 4 12.7C4 8.45 7.58 5 12 5s8 3.45 8 7.7-3.58 7.3-8 7.3c-1.65 0-3.18-.43-4.5-1.5Z" />
            <path strokeLinecap="round" d="M8.2 12.6h.01M12 12.6h.01M15.8 12.6h.01" strokeWidth="2.4" />
            <path strokeLinecap="round" d="M12 2.5v2" />
          </svg>
        </motion.button>
      )}
      <style>{`
        .v2-dash-page { padding: clamp(2.4rem, 3vw, 4rem); background-image: radial-gradient(circle at 8% 0%, rgba(26,158,143,.09), transparent 32rem), radial-gradient(circle at 92% 10%, rgba(217,166,46,.07), transparent 30rem); }
        .v2-dash-shell { width: min(100%, 124rem); margin: 0 auto; }
        .v2-dash-header { display: flex; align-items: center; justify-content: space-between; gap: 2rem; padding-bottom: 1.8rem; border-bottom: 1px solid var(--line); }
        .v2-dash-tools { display: flex; align-items: center; gap: .7rem; }
        .v2-tool-button { display: grid; place-items: center; width: 4.2rem; height: 4.2rem; flex-shrink: 0; border: 1px solid var(--line); background: var(--surface); color: var(--primary); transition: border-color .2s, transform .2s, background .2s; }
        .v2-tool-button:hover { transform: translateY(-2px); border-color: var(--rose); background: var(--wash); }
        .v2-dash-intro { display: flex; align-items: end; justify-content: space-between; gap: 4rem; padding: clamp(2.6rem, 4vw, 4.4rem) 0 2.6rem; }
        .v2-dash-intro-copy { min-width: 0; }
        .v2-dash-kicker { margin: 0 0 .7rem; color: var(--rose); font-size: 1.05rem; font-weight: 800; letter-spacing: .11em; text-transform: uppercase; }
        .v2-dash-subtitle { max-width: 48rem; margin: .8rem 0 0; color: var(--secondary); font-size: 1.35rem; line-height: 1.55; }
        .v2-dash-primary-action { display: flex; align-items: center; justify-content: flex-end; gap: 1.5rem; flex-wrap: wrap; }
        .v2-dash-primary-action > span { display: inline-flex; align-items: center; gap: .65rem; color: var(--muted); font-size: 1.15rem; }
        .v2-dash-primary-action i { width: .7rem; height: .7rem; border-radius: 50%; background: #3D937C; box-shadow: 0 0 0 .4rem rgba(61,147,124,.1); }
        .v2-dash-grid { grid-template-columns: minmax(0, 1.05fr) minmax(36rem, .95fr) !important; gap: 1.6rem !important; align-items: stretch; }
        .v2-score-card { min-height: 42rem; display: flex; flex-direction: column; justify-content: space-between; background: linear-gradient(145deg, var(--surface) 0%, color-mix(in srgb, var(--surface) 84%, #E8C66A) 100%) !important; }
        .v2-history-summary { min-height: 0; }
        .v2-next-checkin { display: flex; align-items: center; gap: 1.3rem; padding: 2rem 2.2rem; border: 1px solid var(--line); border-radius: 1.6rem; background: linear-gradient(135deg, var(--surface), var(--wash)); }
        .v2-next-checkin-icon { display: grid; place-items: center; width: 4.2rem; height: 4.2rem; flex: 0 0 auto; border-radius: 1.2rem; background: rgba(26,158,143,.12); color: var(--rose); }
        .v2-next-checkin span { display: block; color: var(--muted); font-size: 1rem; font-weight: 800; letter-spacing: .09em; text-transform: uppercase; }
        .v2-next-checkin strong { display: block; margin: .25rem 0; color: var(--primary); font-size: 1.8rem; }
        .v2-next-checkin p { margin: 0; color: var(--secondary); font-size: 1.15rem; line-height: 1.45; }
        .v2-next-actions { margin-top: 1.6rem; padding: 2.8rem 3.2rem; border: 1px solid var(--line); border-radius: 1.8rem; background: var(--surface); }
        .v2-next-actions-heading { display: flex; align-items: end; justify-content: space-between; gap: 2rem; margin-bottom: 2rem; padding-bottom: 1.6rem; border-bottom: 1px solid var(--line); }
        .v2-next-actions-heading p { margin: 0 0 .4rem; color: var(--rose); font-size: 1.05rem; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
        .v2-next-actions-heading h2 { margin: 0; color: var(--primary); font-size: 2.1rem; font-weight: 550; }
        .v2-next-actions-heading > span { padding: .6rem 1rem; border-radius: 9999px; background: var(--wash); color: var(--secondary); font-size: 1.05rem; white-space: nowrap; }
        .v2-action-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; }
        .v2-action-grid button { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 1.2rem; padding: 1.7rem; border: 1px solid var(--line); border-radius: 1.3rem; background: var(--canvas); color: var(--primary); text-align: left; cursor: pointer; transition: transform .2s ease, border-color .2s ease, box-shadow .2s ease; }
        .v2-action-grid button:hover { transform: translateY(-3px); border-color: rgba(26,158,143,.4); box-shadow: 0 1.4rem 3rem -2.3rem rgba(12,92,81,.55); }
        .v2-action-grid button > span { display: grid; place-items: center; width: 4.4rem; height: 4.4rem; border-radius: 1.2rem; background: rgba(26,158,143,.11); color: var(--rose); }
        .v2-action-grid strong { display: block; margin-bottom: .35rem; color: var(--primary); font-size: 1.3rem; }
        .v2-action-grid p { margin: 0; color: var(--secondary); font-size: 1.08rem; line-height: 1.45; }
        @media (max-width: 900px) {
          .v2-dash-intro { align-items: flex-start; flex-direction: column; gap: 2rem; }
          .v2-dash-primary-action { justify-content: flex-start; }
          .v2-dash-grid { grid-template-columns: 1fr !important; }
          .v2-score-card { min-height: 0; }
        }
        /* 6rem of top padding plus the greeting left roughly a third of a phone
           screen empty before any content began. */
        @media (max-width: 640px) {
          /* Extra bottom clearance: the floating PerceptGPT button is fixed
             to the viewport, and without this the score card's own CTA row
             ends up sitting right underneath it on first load. */
          .v2-dash-page { padding: 3.2rem 2rem 11rem !important; }
          .v2-dash-greeting { font-size: 2.8rem !important; }
          .v2-dash-subtitle { font-size: 1.2rem; }
          .v2-dash-header { padding-bottom: 1.5rem; }
          .v2-dash-tools { gap: .5rem; }
          .v2-dash-primary-action { align-items: flex-start; flex-direction: column; }
          .v2-history-summary { padding: 2.2rem !important; }
          .v2-dashboard-tip { padding: 2rem !important; background: #0c5c51 !important; }
          .v2-dashboard-tip p { color: #fff !important; }
          .v2-dashboard-tip > span { background: rgba(255,255,255,0.12) !important; }
          .v2-dashboard-tip svg { stroke: #6fe0d0 !important; }
          .v2-next-actions { padding: 2rem 1.5rem; }
          .v2-next-actions-heading { display: block; }
          .v2-next-actions-heading > span { display: inline-block; margin-top: 1rem; }
          .v2-action-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
