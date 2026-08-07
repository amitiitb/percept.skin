"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

interface Row { id: string; overall_score: number | null; skin_age: number | null; status: string; created_at: string; }

export default function V2HistoryPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/auth/login?next=/history"); return; }
      const { data } = await supabase.from("analysis_sessions_v2")
        .select("id, overall_score, skin_age, status, created_at")
        .eq("user_id", user.id).order("created_at", { ascending: false });
      setRows((data as Row[]) ?? []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div style={{ minHeight: "100dvh", background: "var(--canvas)" }} />;

  const scored = rows.filter((r) => r.status === "complete" && r.overall_score !== null);
  const delta = scored.length >= 2 ? (scored[0].overall_score! - scored[scored.length - 1].overall_score!) : null;

  return (
    <div className="history-page" style={{ minHeight: "100dvh", background: "var(--canvas)", padding: "6rem 3.2rem" }}>
      <div style={{ maxWidth: "88rem", margin: "0 auto" }}>
        <button
          onClick={() => router.push("/dashboard")}
          style={{ display: "flex", alignItems: "center", gap: "0.8rem", background: "none", border: "none", color: "var(--primary)", fontSize: "1.4rem", fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: "2.4rem" }}
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          Dashboard
        </button>
        <h1 style={{ fontSize: "3.2rem", fontWeight: 650, color: "var(--primary)", letterSpacing: "-0.02em", marginBottom: "0.8rem" }}>Scan history</h1>
        {delta !== null && (
          <p style={{ fontSize: "1.6rem", fontWeight: 600, color: delta >= 0 ? "#2F7047" : "#A63F30", marginBottom: "2rem" }}>
            {delta >= 0 ? "+" : ""}{delta} Percept Score since your first scan
          </p>
        )}
        <p style={{ fontSize: "1.35rem", fontWeight: 500, color: "var(--secondary)", lineHeight: 1.5, marginBottom: "3.2rem" }}>
          For the most accurate trend, repeat scans under similar lighting.
        </p>

        {rows.length === 0 ? (
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "1.6rem", padding: "6rem 3.2rem", textAlign: "center" }}>
            <p style={{ fontSize: "1.8rem", color: "var(--primary)", marginBottom: "1.6rem" }}>No scans yet</p>
            <PrimaryButton fullWidth={false} onClick={() => router.push("/scan-prep")}>Start your first analysis →</PrimaryButton>
          </div>
        ) : (
          <>
            <div className="history-summary" aria-label="Scan history summary">
              <div><small>Total scans</small><strong>{rows.length}</strong></div>
              <div><small>Latest score</small><strong>{scored[0]?.overall_score ?? "—"}<span>{scored[0] ? "/100" : ""}</span></strong></div>
              <div><small>Overall change</small><strong className={delta !== null && delta < 0 ? "negative" : "positive"}>{delta === null ? "—" : `${delta >= 0 ? "+" : ""}${delta}`}<span>{delta !== null ? " points" : ""}</span></strong></div>
              <div><small>Latest skin age</small><strong>{scored[0]?.skin_age ?? "—"}</strong></div>
            </div>

            <div className="history-sequence-heading">
              <div>
                <span>Your scan sequence</span>
                <small>Newest scan first</small>
              </div>
            </div>

            <div className="history-list">
              {rows.map((r, index) => {
                const previous = rows.slice(index + 1).find((candidate) => candidate.status === "complete" && candidate.overall_score !== null);
                const scoreChange = r.status === "complete" && r.overall_score !== null && previous?.overall_score !== null && previous?.overall_score !== undefined
                  ? r.overall_score - previous.overall_score
                  : null;
                const scanNumber = rows.length - index;
                return (
                  <button key={r.id} className="history-card" onClick={() => r.status === "complete" && router.push(`/report/${r.id}`)} disabled={r.status !== "complete"}>
                    <span className="history-rail" aria-hidden><i>{scanNumber}</i></span>
                    <div className="history-card-content">
                      <div className="history-card-top">
                        <div>
                          <span className="history-number">Scan {scanNumber}</span>
                          {index === 0 && <span className="history-latest">Latest</span>}
                          <strong className="history-date">{new Date(r.created_at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</strong>
                        </div>
                        <span className={`history-status ${r.status}`}>{r.status === "complete" ? "Ready" : "Processing"}</span>
                      </div>

                      {r.status === "complete" ? (
                        <div className="history-card-body">
                          <div className="history-score-block">
                            <small>Percept Score</small>
                            <strong>{r.overall_score ?? "—"}<span>{r.overall_score !== null ? "/100" : ""}</span></strong>
                            <div className="history-score-track" aria-hidden><i style={{ width: `${r.overall_score ?? 0}%` }} /></div>
                          </div>
                          <div>
                            <small>Change from prior scan</small>
                            <strong className={scoreChange !== null && scoreChange < 0 ? "negative" : "positive"}>
                              {scoreChange === null ? "First result" : `${scoreChange >= 0 ? "+" : ""}${scoreChange} points`}
                            </strong>
                          </div>
                          <div><small>Estimated skin age</small><strong>{r.skin_age ?? "—"}</strong></div>
                        </div>
                      ) : (
                        <div className="history-processing-copy"><i /><span>Your photos are being analysed. Results will appear here when ready.</span></div>
                      )}

                      <div className="history-card-action"><span>{r.status === "complete" ? "Open full report" : "Analysis in progress"}</span><span aria-hidden>→</span></div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
      <style jsx global>{`
        .history-summary { display: grid; grid-template-columns: repeat(4, 1fr); margin-bottom: 3.2rem; padding: 2rem 2.4rem; border: 1px solid var(--line-strong); border-radius: 1.4rem; background: var(--surface); }
        .history-summary > div { padding: 0 2rem; border-right: 1px solid var(--line); }
        .history-summary > div:first-child { padding-left: 0; }
        .history-summary > div:last-child { padding-right: 0; border-right: 0; }
        .history-summary small, .history-summary strong { display: block; }
        .history-summary small { color: var(--secondary); font-size: 1.05rem; font-weight: 650; margin-bottom: 0.5rem; }
        .history-summary strong { color: var(--primary); font-size: 1.8rem; font-weight: 700; }
        .history-summary strong span { color: var(--secondary); font-size: 1rem; font-weight: 550; }
        .positive { color: #2F7047 !important; }
        .negative { color: #A63F30 !important; }
        .history-sequence-heading { display: flex; align-items: end; justify-content: space-between; margin-bottom: 1.2rem; }
        .history-sequence-heading span, .history-sequence-heading small { display: block; }
        .history-sequence-heading span { color: var(--primary); font-size: 1.45rem; font-weight: 700; }
        .history-sequence-heading small { margin-top: 0.3rem; color: var(--secondary); font-size: 1.1rem; font-weight: 550; }
        .history-list { display: flex; flex-direction: column; gap: 1rem; }
        .history-card { position: relative; display: grid; grid-template-columns: 5.2rem minmax(0, 1fr); width: 100%; padding: 0; overflow: hidden; border: 1px solid var(--line-strong); border-radius: 1.4rem; background: var(--surface); color: var(--primary); text-align: left; cursor: pointer; transition: border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease; }
        .history-card:not(:disabled):hover { border-color: var(--primary); box-shadow: 0 0.8rem 2.4rem rgba(13, 61, 51, 0.08); transform: translateY(-1px); }
        .history-card:focus-visible { outline: 3px solid rgba(20, 155, 132, 0.3); outline-offset: 3px; }
        .history-card:disabled { cursor: default; }
        .history-rail { display: flex; align-items: flex-start; justify-content: center; padding-top: 2rem; background: var(--wash); border-right: 1px solid var(--line); }
        .history-rail i { display: flex; align-items: center; justify-content: center; width: 2.8rem; height: 2.8rem; border-radius: 50%; background: var(--primary); color: var(--surface); font-size: 1.15rem; font-style: normal; font-weight: 750; }
        .history-card-content { min-width: 0; padding: 2rem 2.2rem 1.6rem; }
        .history-card-top, .history-card-action { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
        .history-card-top > div { display: flex; align-items: center; flex-wrap: wrap; gap: 0.7rem; }
        .history-number { color: var(--primary); font-size: 1.15rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
        .history-latest { padding: 0.25rem 0.65rem; border-radius: 999px; background: var(--wash); color: #087F70; font-size: 0.95rem; font-weight: 750; text-transform: uppercase; letter-spacing: 0.05em; }
        .history-date { flex-basis: 100%; color: var(--secondary); font-size: 1.18rem; font-weight: 600; }
        .history-status { padding: 0.5rem 1rem; border-radius: 999px; background: rgba(47,112,71,0.13); color: #235C38; font-size: 1.05rem; font-weight: 750; }
        .history-status.processing { background: rgba(172,115,9,0.14); color: #785006; }
        .history-card-body { display: grid; grid-template-columns: 1.3fr 1fr 0.8fr; align-items: end; gap: 2rem; padding: 1.8rem 0; }
        .history-card-body div { min-width: 0; }
        .history-card-body small, .history-card-body strong { display: block; }
        .history-card-body small { margin-bottom: 0.55rem; color: var(--secondary); font-size: 1.08rem; font-weight: 600; }
        .history-card-body strong { color: var(--primary); font-size: 1.5rem; font-weight: 650; }
        .history-card-body strong span { color: var(--secondary); font-size: 1rem; font-weight: 550; }
        .history-score-track { width: 100%; max-width: 18rem; height: 0.45rem; margin-top: 0.7rem; overflow: hidden; border-radius: 999px; background: var(--wash); }
        .history-score-track i { display: block; height: 100%; border-radius: inherit; background: #168271; }
        .history-processing-copy { display: flex; align-items: center; gap: 0.9rem; min-height: 6.5rem; color: var(--secondary); font-size: 1.25rem; font-weight: 550; }
        .history-processing-copy i { width: 0.9rem; height: 0.9rem; border-radius: 50%; background: #AC7309; box-shadow: 0 0 0 0.45rem rgba(172,115,9,0.12); }
        .history-card-action { padding-top: 1.4rem; border-top: 1px solid var(--line-strong); color: #087F70; font-size: 1.22rem; font-weight: 750; }
        @media (max-width: 700px) {
          .history-page { padding: 3.2rem 2rem 6rem !important; }
          .history-summary { grid-template-columns: repeat(2, 1fr); gap: 1.8rem 0; padding: 1.8rem; }
          .history-summary > div { padding: 0 1.4rem; }
          .history-summary > div:nth-child(2) { border-right: 0; }
          .history-summary > div:nth-child(3) { padding-left: 0; }
          .history-card { grid-template-columns: 4.2rem minmax(0, 1fr); }
          .history-card-content { padding: 1.7rem 1.6rem 1.4rem; }
          .history-card-body { grid-template-columns: 1fr 1fr; gap: 1.4rem; padding: 1.6rem 0; }
          .history-score-block { grid-column: 1 / -1; }
          .history-card-body strong { font-size: 1.35rem; }
        }
      `}</style>
    </div>
  );
}
