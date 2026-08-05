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
          style={{ display: "flex", alignItems: "center", gap: "0.8rem", background: "none", border: "none", color: "var(--secondary)", fontSize: "1.4rem", cursor: "pointer", padding: 0, marginBottom: "2.4rem" }}
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          Dashboard
        </button>
        <h1 style={{ fontSize: "3.2rem", fontWeight: 400, color: "var(--primary)", marginBottom: "0.8rem" }}>Scan history</h1>
        {delta !== null && (
          <p style={{ fontSize: "1.6rem", color: delta >= 0 ? "#4C8C5F" : "#C8503A", marginBottom: "2rem" }}>
            {delta >= 0 ? "+" : ""}{delta} Percept Score since your first scan
          </p>
        )}
        <p style={{ fontSize: "1.3rem", color: "var(--muted)", marginBottom: "3.2rem" }}>
          For the most accurate trend, repeat scans under similar lighting.
        </p>

        {rows.length === 0 ? (
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "1.6rem", padding: "6rem 3.2rem", textAlign: "center" }}>
            <p style={{ fontSize: "1.8rem", color: "var(--primary)", marginBottom: "1.6rem" }}>No scans yet</p>
            <PrimaryButton fullWidth={false} onClick={() => router.push("/scan-prep")}>Start your first analysis →</PrimaryButton>
          </div>
        ) : (
          <div className="history-list">
            {rows.map((r, index) => (
              <button key={r.id} className="history-card" onClick={() => r.status === "complete" && router.push(`/report/${r.id}`)} disabled={r.status !== "complete"}>
                <div className="history-card-top">
                  <span className="history-number">Scan {rows.length - index}</span>
                  <span className={`history-status ${r.status}`}>{r.status === "complete" ? "Ready" : "Processing"}</span>
                </div>
                <div className="history-card-body">
                  <div><small>Completed</small><strong>{new Date(r.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</strong></div>
                  {r.overall_score !== null && <div><small>Percept Score</small><strong>{r.overall_score}<span>/100</span></strong></div>}
                  {r.skin_age !== null && <div><small>Skin age</small><strong>{r.skin_age}</strong></div>}
                </div>
                <div className="history-card-action"><span>{r.status === "complete" ? "Open full report" : "Analysis in progress"}</span><span aria-hidden>→</span></div>
              </button>
            ))}
          </div>
        )}
      </div>
      <style jsx global>{`
        .history-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.2rem; }
        .history-card { padding: 2.2rem; border: 1px solid var(--line); border-radius: 1.4rem; background: var(--surface); color: var(--primary); text-align: left; cursor: pointer; }
        .history-card:disabled { cursor: default; }
        .history-card-top, .history-card-action { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
        .history-number { color: var(--muted); font-size: 1.1rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
        .history-status { padding: 0.45rem 0.9rem; border-radius: 999px; background: rgba(76,140,95,0.12); color: #39734a; font-size: 1.05rem; font-weight: 700; }
        .history-status.processing { background: rgba(217,166,46,0.14); color: #956c12; }
        .history-card-body { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; padding: 2.4rem 0; }
        .history-card-body div { min-width: 0; }
        .history-card-body small, .history-card-body strong { display: block; }
        .history-card-body small { margin-bottom: 0.5rem; color: var(--muted); font-size: 1.05rem; }
        .history-card-body strong { color: var(--primary); font-size: 1.45rem; font-weight: 500; }
        .history-card-body strong span { color: var(--muted); font-size: 1rem; }
        .history-card-action { padding-top: 1.4rem; border-top: 1px solid var(--line); color: var(--rose); font-size: 1.2rem; font-weight: 600; }
        @media (max-width: 700px) {
          .history-page { padding: 3.2rem 2rem 6rem !important; }
          .history-list { grid-template-columns: 1fr; }
          .history-card { width: 100%; padding: 1.8rem; }
          .history-card-body { grid-template-columns: 1.4fr 1fr 0.8fr; padding: 2rem 0; }
          .history-card-body strong { font-size: 1.35rem; }
        }
      `}</style>
    </div>
  );
}
