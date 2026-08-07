"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ModuleId } from "@/lib/v2/reportModules";

type Status = "waiting" | "active" | "done" | "skipped" | "error";
type StepId = "analysis" | "hairstyle" | "beard" | "colour" | "frame";
type Step = { id: StepId; label: string; detail: string; status: Status };

const BASE_STEPS: Step[] = [
  { id: "analysis", label: "Skin and face analysis", detail: "Reading your captured photos", status: "waiting" },
  { id: "hairstyle", label: "Hairstyle recommendations", detail: "Creating six distinct styles", status: "waiting" },
  { id: "beard", label: "Beard recommendations", detail: "Included only when appropriate for the scanned subject", status: "waiting" },
  { id: "colour", label: "Colour and clothing analysis", detail: "Building your palette and outfit previews", status: "waiting" },
  { id: "frame", label: "Frame recommendations", detail: "Fitting six frame styles to your face", status: "waiting" },
];

const INSIGHTS = [
  { kind: "sun", eyebrow: "Skin insight", title: "Daily SPF is your strongest long-term habit", body: "Broad-spectrum SPF 30 or higher helps protect against premature visible ageing as well as sun damage." },
  { kind: "water", eyebrow: "Hydration insight", title: "Hydration supports normal skin function", body: "Drink enough fluid for your body and climate. Extra water is not a cure-all, but dehydration can make skin and the under-eye area look less refreshed." },
  { kind: "moisture", eyebrow: "Routine insight", title: "Moisturizer works best on slightly damp skin", body: "Applying it soon after cleansing helps trap water in the skin and supports a smoother-looking barrier." },
  { kind: "food", eyebrow: "Nutrition insight", title: "A balanced plate usually beats a beauty supplement", body: "For most healthy adults, varied whole foods are the safest first source of nutrients that support skin, hair, and nails." },
  { kind: "cleanse", eyebrow: "Skin insight", title: "Gentle cleansing beats aggressive scrubbing", body: "Scrubbing can irritate skin and make concerns such as acne or sensitivity look worse. Use fingertips and lukewarm water." },
  { kind: "hair", eyebrow: "Hair insight", title: "Wet hair needs a lighter touch", body: "Hair is more vulnerable when wet. Blot instead of rubbing, detangle gently, and limit unnecessary heat." },
  { kind: "frame", eyebrow: "Frame insight", title: "Comfort starts with fit, not just frame weight", body: "A well-sized bridge and balanced temples distribute pressure better. Lightweight materials can add comfort for long daily wear." },
] as const;

function InsightIcon({ kind }: { kind: typeof INSIGHTS[number]["kind"] }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (kind === "sun") return <svg viewBox="0 0 32 32"><circle {...common} cx="16" cy="16" r="5"/><path {...common} d="M16 3v4m0 18v4M3 16h4m18 0h4M7 7l3 3m12 12 3 3M25 7l-3 3M10 22l-3 3"/></svg>;
  if (kind === "water") return <svg viewBox="0 0 32 32"><path {...common} d="M16 3S7 14 7 20a9 9 0 0 0 18 0c0-6-9-17-9-17Z"/><path {...common} d="M11 21c1 3 3 4 6 4"/></svg>;
  if (kind === "moisture") return <svg viewBox="0 0 32 32"><path {...common} d="M6 24c4-8 8-12 12-12 5 0 8 4 8 8 0 5-4 8-9 8H8"/><path {...common} d="M11 14V7h9v5M13 7V4h5v3"/></svg>;
  if (kind === "food") return <svg viewBox="0 0 32 32"><path {...common} d="M7 16h18a9 9 0 0 1-18 0Z"/><path {...common} d="M11 12c0-3 2-5 5-5m0 5c0-4 3-7 7-7"/></svg>;
  if (kind === "cleanse") return <svg viewBox="0 0 32 32"><path {...common} d="M9 13h14l-2 14H11L9 13Z"/><path {...common} d="M13 13V8h6v5M23 5l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2Z"/></svg>;
  if (kind === "hair") return <svg viewBox="0 0 32 32"><path {...common} d="M8 27V14C8 7 12 3 17 3c6 0 9 5 8 12-3-4-6-6-10-6-3 0-5 2-7 5"/><path {...common} d="M12 11c2 4 2 9-1 14m6-16c2 5 2 11 0 17m5-14c1 5 0 10-2 14"/></svg>;
  return <svg viewBox="0 0 32 32"><rect {...common} x="3" y="10" width="11" height="9" rx="4"/><rect {...common} x="18" y="10" width="11" height="9" rx="4"/><path {...common} d="M14 13c2-2 2-2 4 0M3 13l-2-1m28 1 2-1"/></svg>;
}

function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }

export default function PrepareReportPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;
  const runId = useRef(0);
  const [steps, setSteps] = useState(BASE_STEPS);
  const [error, setError] = useState("");
  const [runKey, setRunKey] = useState(0);
  const [insightIndex, setInsightIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setInsightIndex((index) => (index + 1) % INSIGHTS.length), 6200);
    return () => clearInterval(timer);
  }, []);

  function mark(id: StepId, status: Status, detail?: string) {
    setSteps((current) => current.map((step) => step.id === id ? { ...step, status, detail: detail ?? step.detail } : step));
  }

  useEffect(() => {
    const currentRun = ++runId.current;
    let cancelled = false;

    async function run() {
      setError("");
      const supabase = createClient();
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (cancelled || currentRun !== runId.current) return;
      if (!authSession?.access_token) { router.replace(`/auth/login?next=/prepare/${sessionId}`); return; }
      const userId = authSession.user.id;
      const headers = { "Content-Type": "application/json", Authorization: `Bearer ${authSession.access_token}` };
      const body = JSON.stringify({ sessionId, photoDataUrl: "use-session-photo" });

      const call = async (url: string) => {
        const response = await fetch(url, { method: "POST", headers, body });
        const result = await response.json() as { error?: string };
        if (!response.ok) throw new Error(result.error ?? "Generation failed");
        return result;
      };

      try {
        const { data: purchase } = await supabase.from("report_purchases_v2").select("modules")
          .eq("session_id", sessionId).eq("user_id", userId).maybeSingle();
        if (cancelled || currentRun !== runId.current) return;
        if (!purchase) { router.replace(`/bundle/${sessionId}`); return; }
        const modules = new Set((purchase.modules ?? []) as ModuleId[]);

        // The core scan can still be finishing when PayPal returns. Its own API
        // persists progress, so polling here makes this page safe to refresh.
        mark("analysis", "active", "Completing your skin, face and hair measurements");
        let restartedFailedAnalysis = false;
        for (;;) {
          const { data: scan } = await supabase.from("analysis_sessions_v2").select("status, stage, fail_reason")
            .eq("id", sessionId).eq("user_id", userId).maybeSingle();
          if (!scan) throw new Error("This scan could not be found.");
          if (scan.status === "complete") break;
          if (scan.status === "failed" || scan.stage === "failed") {
            if (restartedFailedAnalysis) throw new Error(scan.fail_reason ?? "The scan analysis failed.");
            restartedFailedAnalysis = true;
            mark("analysis", "active", "The first reading was incomplete. Re-running it now");
            await call("/api/analyse");
            continue;
          }
          await sleep(3000);
          if (cancelled || currentRun !== runId.current) return;
        }
        mark("analysis", "done", "Analysis complete");

        if (modules.has("hairstyle")) {
          const { count: hairCount } = await supabase.from("hairstyle_generations_v2").select("id", { count: "exact", head: true })
            .eq("session_id", sessionId).eq("user_id", userId).eq("style_name", "Style grid");
          if (!hairCount) {
            mark("hairstyle", "active", "Creating six distinct hairstyle recommendations");
            await call("/api/hairstyle/grid");
          }
          mark("hairstyle", "done", "Hairstyle recommendations complete");

          const subjectResponse = await fetch("/api/report-preparation/subject", {
            method: "POST", headers, body: JSON.stringify({ sessionId }),
          });
          const subject = await subjectResponse.json() as { beardEligible?: boolean; error?: string };
          if (!subjectResponse.ok) throw new Error(subject.error ?? "Could not determine whether beard recommendations apply.");
          if (subject.beardEligible) {
            const { count: beardCount } = await supabase.from("grooming_generations_v2").select("id", { count: "exact", head: true })
              .eq("session_id", sessionId).eq("user_id", userId).eq("kind", "beard");
            if (!beardCount) {
              mark("beard", "active", "Creating six distinct beard styles");
              await call("/api/beard/grid");
            }
            mark("beard", "done", "Beard recommendations complete");
          } else {
            mark("beard", "skipped", "Not applicable to this scanned subject");
          }
        } else {
          mark("hairstyle", "skipped", "Not included in this purchase");
          mark("beard", "skipped", "Not included in this purchase");
        }

        if (modules.has("colour")) {
          let { data: colourRow } = await supabase.from("colour_analysis_v2").select("data")
            .eq("session_id", sessionId).eq("user_id", userId).maybeSingle();
          if (!colourRow?.data) {
            mark("colour", "active", "Finding your season and best clothing colours");
            await call("/api/colour-analysis");
            ({ data: colourRow } = await supabase.from("colour_analysis_v2").select("data")
              .eq("session_id", sessionId).eq("user_id", userId).maybeSingle());
          }
          const colourData = colourRow?.data as { drapings?: unknown } | null;
          if (!colourData?.drapings) {
            mark("colour", "active", "Creating clothing previews in your palette");
            await call("/api/colour-analysis/draping");
          }
          mark("colour", "done", "Colour and clothing analysis complete");
        } else mark("colour", "skipped", "Not included in this purchase");

        if (modules.has("frame")) {
          const { count: frameCount } = await supabase.from("frame_generations_v2").select("id", { count: "exact", head: true })
            .eq("session_id", sessionId).eq("user_id", userId).eq("frame_name", "Frame grid");
          if (!frameCount) {
            mark("frame", "active", "Fitting six distinct frame styles to your face");
            await call("/api/frame-tryon/grid");
          }
          mark("frame", "done", "Frame recommendations complete");
        } else mark("frame", "skipped", "Not included in this purchase");

        if (!cancelled) {
          await sleep(900);
          router.replace(`/report/${sessionId}`);
        }
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Something went wrong while preparing your report.";
        setError(message);
        setSteps((current) => current.map((step) => step.status === "active" ? { ...step, status: "error" } : step));
      }
    }

    run();
    return () => { cancelled = true; };
  }, [runKey, router, sessionId]);

  const complete = steps.filter((step) => step.status === "done" || step.status === "skipped").length;
  const active = steps.some((step) => step.status === "active") ? 0.35 : 0;
  const progress = Math.round(((complete + active) / steps.length) * 100);

  return (
    <main style={{ minHeight: "100dvh", background: "var(--canvas)", padding: "clamp(3rem, 8vw, 7rem) 2rem" }}>
      <div style={{ width: "min(112rem, 100%)", margin: "0 auto" }}>
        <header className="v2-prepare-header">
          <p style={{ color: "var(--rose)", fontSize: "1.25rem", fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "1rem" }}>✓ Payment confirmed</p>
          <h1 style={{ color: "var(--primary)", fontSize: "clamp(3.2rem, 7vw, 4.8rem)", fontWeight: 750, lineHeight: 1.04, letterSpacing: "-0.045em", margin: 0 }}>Your personalised report is taking shape</h1>
          <p style={{ color: "var(--secondary)", fontSize: "1.6rem", fontWeight: 500, lineHeight: 1.55, margin: "1.5rem 0 3rem", maxWidth: "64rem" }}>We&apos;re turning your latest scan into tailored analysis and visual recommendations. Each completed step is saved automatically.</p>
        </header>

        <div className="v2-prepare-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} style={{ height: "0.8rem", background: "var(--line)", borderRadius: "999px", overflow: "hidden", marginBottom: "1rem" }}>
          <div style={{ width: `${progress}%`, height: "100%", background: "linear-gradient(90deg,var(--rose),#E2A82A)", borderRadius: "inherit", transition: "width 400ms ease", boxShadow: "0 0 1.2rem rgba(200,80,58,.25)" }} />
        </div>
        <p className="v2-prepare-percent" style={{ color: "var(--muted)", fontSize: "1.25rem", textAlign: "right", margin: "0 0 2rem" }}>{progress}% complete</p>

        <div className="v2-prepare-content">
        <section style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "2rem", padding: "1rem clamp(1.4rem, 4vw, 2.6rem)" }}>
          {steps.map((step, index) => (
            <div key={step.id} style={{ position: "relative", display: "grid", gridTemplateColumns: "3.6rem 1fr", gap: "1.2rem", alignItems: "center", margin: step.status === "active" ? "0.6rem -1rem" : 0, padding: step.status === "active" ? "1.5rem 1rem" : "1.8rem 0", borderRadius: step.status === "active" ? "1.2rem" : 0, background: step.status === "active" ? "linear-gradient(90deg,rgba(200,80,58,.1),rgba(226,168,42,.05))" : "transparent", borderLeft: step.status === "active" ? "4px solid var(--rose)" : "4px solid transparent", transition: "all 250ms ease" }}>
              <span className="v2-step-node-wrap" aria-hidden>
                <span style={{ position: "relative", zIndex: 2, width: "3.2rem", height: "3.2rem", borderRadius: "50%", display: "grid", placeItems: "center", fontSize: "1.35rem", fontWeight: 800, color: step.status === "active" ? "#fff" : "var(--primary)", background: step.status === "done" ? "#DDEDE4" : step.status === "skipped" ? "var(--wash)" : step.status === "error" ? "#F8DEDA" : step.status === "active" ? "var(--rose)" : "var(--canvas)", boxShadow: step.status === "done" ? "0 0 0 .35rem rgba(38,139,92,.08)" : undefined, animation: step.status === "active" ? "v2-prepare-pulse 1.4s ease-in-out infinite" : undefined }}>
                  {step.status === "done" ? "✓" : step.status === "skipped" ? "–" : step.status === "error" ? "!" : index + 1}
                </span>
                {index < steps.length - 1 && <span className={`v2-step-connector ${step.status === "done" || step.status === "skipped" ? "is-complete" : ""}`}>{step.status === "done" && <i>✓</i>}</span>}
              </span>
              <div>
                <div className="v2-step-heading"><strong style={{ color: "var(--primary)", fontSize: step.status === "active" ? "1.65rem" : "1.5rem", fontWeight: step.status === "active" ? 850 : 700 }}>{step.label}</strong>{step.status === "active" && <span className="v2-active-status"><i /><i /><i /><b>In progress</b></span>}</div>
                <span style={{ display: "block", marginTop: ".3rem", color: step.status === "error" ? "#A83E2E" : step.status === "active" ? "var(--secondary)" : "var(--muted)", fontSize: "1.25rem", fontWeight: step.status === "active" ? 600 : 400, lineHeight: 1.4 }}>{step.detail}</span>
              </div>
            </div>
          ))}
        </section>

        <aside className="v2-prepare-aside">
        <section className="v2-insight-card" aria-label="Helpful insight while your report is prepared">
          <div className="v2-insight-art" aria-hidden><InsightIcon kind={INSIGHTS[insightIndex].kind} /></div>
          <div key={insightIndex} className="v2-insight-copy">
            <p>{INSIGHTS[insightIndex].eyebrow}</p>
            <h2>{INSIGHTS[insightIndex].title}</h2>
            <span>{INSIGHTS[insightIndex].body}</span>
          </div>
          <div className="v2-insight-controls" aria-label="Choose an insight">
            {INSIGHTS.map((insight, index) => <button key={insight.title} type="button" aria-label={`Show insight ${index + 1}`} aria-current={index === insightIndex} onClick={() => setInsightIndex(index)} />)}
          </div>
        </section>

        {error && <div style={{ marginTop: "2rem", padding: "1.6rem", borderRadius: "1.2rem", background: "#F8DEDA", color: "#8C3024", fontSize: "1.35rem" }}><p style={{ margin: "0 0 1rem" }}>{error}</p><button type="button" onClick={() => setRunKey((key) => key + 1)} style={{ border: 0, borderRadius: "999px", background: "var(--primary)", color: "#fff", padding: "0.9rem 1.5rem", fontWeight: 700, cursor: "pointer" }}>Retry preparation</button></div>}
        </aside>
        </div>
      </div>
      <style>{`
        .v2-prepare-header { max-width:76rem; }
        .v2-prepare-progress,.v2-prepare-percent { width:min(76rem,68%); }
        .v2-prepare-content { display:grid; grid-template-columns:minmax(0,1.65fr) minmax(28rem,.85fr); gap:2.4rem; align-items:start; }
        .v2-prepare-aside { position:sticky; top:2rem; }
        .v2-step-node-wrap { position:relative; align-self:stretch; display:flex; align-items:center; justify-content:center; min-height:4rem; }
        .v2-step-connector { position:absolute; z-index:1; top:calc(50% + 1.6rem); left:50%; width:.28rem; height:calc(100% + 1.6rem); transform:translateX(-50%); border-radius:999px; background:var(--line); overflow:visible; }
        .v2-step-connector.is-complete { background:linear-gradient(#278B5C,#55B77F); box-shadow:0 0 .7rem rgba(39,139,92,.22); }
        .v2-step-connector i { position:absolute; left:50%; top:0; width:1.35rem; height:1.35rem; display:grid; place-items:center; border-radius:50%; transform:translate(-50%,-20%); background:#278B5C; color:#fff; font-size:.75rem; font-style:normal; font-weight:900; box-shadow:0 0 0 .25rem var(--surface); animation:v2-check-travel 1.8s ease-in-out infinite; }
        .v2-step-heading { display:flex; align-items:center; justify-content:space-between; gap:1.2rem; width:100%; }
        .v2-active-status { flex-shrink:0; display:inline-flex; align-items:center; justify-content:center; gap:.25rem; min-width:10.5rem; min-height:2.25rem; padding:.38rem .9rem .38rem .65rem; border:2px solid rgba(19,168,151,.38); border-radius:999px; background:#fff; color:#08796E; box-shadow:0 .35rem 1rem rgba(19,168,151,.12); }
        .v2-active-status i { width:.28rem; height:.95rem; border-radius:999px; background:#13A897; animation:v2-status-bars .9s ease-in-out infinite; }
        .v2-active-status i:nth-child(2) { animation-delay:.14s; }.v2-active-status i:nth-child(3) { animation-delay:.28s; }
        .v2-active-status b { margin-left:.3rem; font-size:1rem; font-weight:950; letter-spacing:.09em; text-transform:uppercase; }
        .v2-insight-card { position:relative; display:grid; grid-template-columns:1fr; gap:1.5rem; align-items:start; min-height:27rem; margin-top:0; padding:2.6rem 2.5rem 3rem; overflow:hidden; border:1px solid rgba(19,168,151,.24); border-radius:2rem; background:linear-gradient(145deg,#EAF8F3 0%,#FFF8E8 58%,#FCEDE8 100%); box-shadow:0 .8rem 2.5rem rgba(23,76,64,.07); }
        .v2-insight-card:after { content:""; position:absolute; width:13rem; height:13rem; right:-5rem; top:-7rem; border-radius:50%; background:rgba(226,168,42,.14); filter:blur(.2rem); }
        .v2-insight-art { width:6.4rem; height:6.4rem; display:grid; place-items:center; border-radius:1.6rem; background:#fff; color:#08796E; box-shadow:0 .55rem 1.5rem rgba(8,121,110,.13); }
        .v2-insight-art svg { width:3.2rem; height:3.2rem; }
        .v2-insight-copy { position:relative; z-index:1; animation:v2-insight-enter .55s ease both; }
        .v2-insight-copy p { margin:0 0 .35rem; color:#0E8E80; font-size:1rem; font-weight:900; letter-spacing:.12em; text-transform:uppercase; }
        .v2-insight-copy h2 { margin:0 0 .7rem; color:var(--primary); font-size:1.9rem; font-weight:850; line-height:1.2; letter-spacing:-.02em; }
        .v2-insight-copy span { display:block; color:var(--secondary); font-size:1.35rem; font-weight:500; line-height:1.55; }
        .v2-insight-controls { position:absolute; z-index:2; left:2.5rem; bottom:1.25rem; display:flex; gap:.38rem; }
        .v2-insight-controls button { width:.48rem; height:.48rem; padding:0; border:0; border-radius:999px; background:rgba(8,121,110,.2); cursor:pointer; transition:width .2s ease,background .2s ease; }
        .v2-insight-controls button[aria-current="true"] { width:1.5rem; background:#0E8E80; }
        @keyframes v2-prepare-pulse { 0%,100% { transform:scale(1); opacity:1; } 50% { transform:scale(.92); opacity:.72; } }
        @keyframes v2-status-bars { 0%,100% { transform:scaleY(.35); opacity:.4; } 50% { transform:scaleY(1); opacity:1; } }
        @keyframes v2-check-travel { 0% { top:0; opacity:0; } 20% { opacity:1; } 80% { opacity:1; } 100% { top:88%; opacity:0; } }
        @keyframes v2-insight-enter { from { opacity:0; transform:translateY(.5rem); } to { opacity:1; transform:translateY(0); } }
        @media (max-width:900px) { .v2-prepare-progress,.v2-prepare-percent { width:100%; } .v2-prepare-content { grid-template-columns:1fr; } .v2-prepare-aside { position:static; } .v2-insight-card { grid-template-columns:5.4rem 1fr; min-height:0; padding:2rem 2.2rem 2.3rem; } .v2-insight-controls { left:9.1rem; bottom:.75rem; } }
        @media (max-width:520px) { .v2-step-heading { align-items:flex-start; } .v2-active-status { min-width:9.3rem; } .v2-insight-card { grid-template-columns:4.4rem 1fr; padding:1.6rem 1.5rem 2.3rem; } .v2-insight-art { width:4.4rem; height:4.4rem; }.v2-insight-art svg { width:2.7rem; height:2.7rem; }.v2-insight-controls { left:7.4rem; } }
        @media (prefers-reduced-motion:reduce) { .v2-step-connector i,.v2-active-status i,.v2-insight-copy { animation:none; } }
      `}</style>
    </main>
  );
}
