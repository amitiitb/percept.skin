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
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function deleteScan(id: string) {
    if (!window.confirm("Delete this scan? This can't be undone.")) return;
    setDeletingId(id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch("/api/scan-session/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ sessionId: id }),
      });
      if (res.ok) setRows((prev) => prev.filter((r) => r.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/auth/login?next=/history"); return; }
      const { data } = await supabase.from("analysis_sessions_v2")
        .select("id, overall_score, skin_age, status, created_at")
        .eq("user_id", user.id).order("created_at", { ascending: false });
      const sessions = (data as Row[]) ?? [];
      setRows(sessions);
      setLoading(false);

      // Best-effort thumbnail pass, kept separate from the row fetch above so
      // a signing failure only leaves cards without a photo rather than
      // blocking the whole list from rendering.
      if (sessions.length) {
        const { data: photoRows } = await supabase.from("analysis_photos_v2")
          .select("session_id, photo_type, storage_path")
          .in("session_id", sessions.map((s) => s.id))
          .in("photo_type", ["face_front", "face_detail"]);
        if (photoRows?.length) {
          // One photo per session — face_front over face_detail when a
          // session has both, same preference order as lib/v2/sessionPhoto.ts.
          const bestPerSession = new Map<string, { photo_type: string; storage_path: string }>();
          for (const p of photoRows) {
            const existing = bestPerSession.get(p.session_id);
            if (!existing || (existing.photo_type !== "face_front" && p.photo_type === "face_front")) {
              bestPerSession.set(p.session_id, p);
            }
          }
          const entries = await Promise.all(
            Array.from(bestPerSession.entries()).map(async ([sessionId, p]) => {
              const { data: signed } = await supabase.storage.from("photos_v2").createSignedUrl(p.storage_path, 60 * 60 * 24 * 7);
              return signed?.signedUrl ? [sessionId, signed.signedUrl] as const : null;
            }),
          );
          const map: Record<string, string> = {};
          for (const e of entries) { if (e) map[e[0]] = e[1]; }
          setThumbs(map);
        }
      }
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
                const isComplete = r.status === "complete";
                const isFailed = r.status === "failed";
                const openReport = () => { if (isComplete) router.push(`/report/${r.id}`); };
                return (
                  <div
                    key={r.id}
                    className="history-card"
                    role={isComplete ? "button" : undefined}
                    tabIndex={isComplete ? 0 : undefined}
                    data-disabled={isComplete ? undefined : true}
                    onClick={openReport}
                    onKeyDown={(e) => { if (isComplete && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openReport(); } }}
                  >
                    <div className="history-photo">
                      {thumbs[r.id] ? (
                        // eslint-disable-next-line @next/next/no-img-element -- signed Supabase URLs expire; next/image's remote-pattern allowlist and cache don't suit a URL that rotates every fetch.
                        <img className="history-thumb" src={thumbs[r.id]} alt="" />
                      ) : (
                        <span className="history-thumb history-thumb-empty" aria-hidden />
                      )}
                      <span className="history-photo-badge" aria-hidden>{scanNumber}</span>
                      {index === 0 && <span className="history-latest">Latest</span>}
                    </div>
                    <div className="history-card-content">
                      <div className="history-card-top">
                        <div className="history-card-title">
                          <strong className="history-number">Scan {scanNumber}</strong>
                          <span className="history-date">
                            {new Date(r.created_at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                            {" · "}
                            {new Date(r.created_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                          </span>
                        </div>
                        <span className={`history-status ${r.status}`}>{isComplete ? "Ready" : isFailed ? "Failed" : "Processing"}</span>
                      </div>

                      {isComplete ? (
                        <div className="history-card-body">
                          <div className="history-score-block">
                            <small>Percept Score</small>
                            <strong>{r.overall_score ?? "—"}<span>{r.overall_score !== null ? "/100" : ""}</span></strong>
                            <div className="history-score-track" aria-hidden><i style={{ width: `${r.overall_score ?? 0}%` }} /></div>
                          </div>
                          <span className="history-stat-divider" aria-hidden />
                          <div className="history-stat">
                            <small>Change</small>
                            <strong className={scoreChange !== null && scoreChange < 0 ? "negative" : "positive"}>
                              {scoreChange === null ? "First scan" : `${scoreChange >= 0 ? "+" : ""}${scoreChange} pts`}
                            </strong>
                          </div>
                          <span className="history-stat-divider" aria-hidden />
                          <div className="history-stat"><small>Skin age</small><strong>{r.skin_age ?? "—"}</strong></div>
                        </div>
                      ) : isFailed ? (
                        <div className="history-processing-copy history-failed-copy"><span>Something went wrong analysing this scan. Delete it and try again.</span></div>
                      ) : (
                        <div className="history-processing-copy"><i /><span>Your photos are being analysed. Results will appear here when ready.</span></div>
                      )}

                      <div className="history-card-action">
                        <span>{isComplete ? "Open full report" : isFailed ? "Analysis failed" : "Analysis in progress"}</span>
                        <span className="history-card-action-right">
                          {isComplete && <span aria-hidden>→</span>}
                          <button
                            type="button"
                            className="history-delete-btn"
                            disabled={deletingId === r.id}
                            onClick={(e) => { e.stopPropagation(); deleteScan(r.id); }}
                          >
                            {deletingId === r.id ? "Deleting…" : "Delete"}
                          </button>
                        </span>
                      </div>
                    </div>
                  </div>
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
        .history-list { display: flex; flex-direction: column; gap: 1.4rem; }
        .history-card { position: relative; display: grid; grid-template-columns: 14rem minmax(0, 1fr); width: 100%; min-height: 15.5rem; padding: 0; overflow: hidden; border: 1px solid var(--line-strong); border-radius: 1.8rem; background: var(--surface); color: var(--primary); text-align: left; cursor: pointer; transition: border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease; }
        .history-card:not([data-disabled]):hover { border-color: var(--primary); box-shadow: 0 1rem 2.8rem rgba(13, 61, 51, 0.1); transform: translateY(-2px); }
        .history-card:focus-visible { outline: 3px solid rgba(20, 155, 132, 0.3); outline-offset: 3px; }
        .history-card[data-disabled] { cursor: default; }
        /* Full-height photo panel — sized generously and cropped only at the
           very top/bottom so a normal front-facing capture shows the whole
           face, not a thin cropped strip. */
        .history-photo { position: relative; background: var(--wash); border-right: 1px solid var(--line); }
        .history-thumb { display: block; width: 100%; height: 100%; object-fit: cover; object-position: 50% 25%; }
        .history-thumb-empty { display: block; }
        .history-photo-badge { position: absolute; top: 1rem; left: 1rem; display: flex; align-items: center; justify-content: center; min-width: 2.6rem; height: 2.6rem; padding: 0 0.4rem; border-radius: 999px; background: rgba(13, 48, 40, 0.62); backdrop-filter: blur(3px); color: #fff; font-size: 1.2rem; font-weight: 750; }
        .history-photo .history-latest { position: absolute; top: 1rem; right: 1rem; padding: 0.3rem 0.75rem; border-radius: 999px; background: rgba(255,255,255,0.92); color: #087F70; font-size: 0.95rem; font-weight: 750; text-transform: uppercase; letter-spacing: 0.05em; }
        .history-card-content { display: flex; flex-direction: column; min-width: 0; padding: 2rem 2.4rem 1.6rem; }
        .history-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: 0.4rem; }
        .history-card-title { display: flex; flex-direction: column; gap: 0.35rem; }
        .history-number { color: var(--primary); font-size: 1.7rem; font-weight: 750; letter-spacing: -0.01em; }
        .history-date { color: var(--secondary); font-size: 1.2rem; font-weight: 550; }
        .history-status { flex-shrink: 0; padding: 0.5rem 1rem; border-radius: 999px; background: rgba(47,112,71,0.13); color: #235C38; font-size: 1.05rem; font-weight: 750; }
        .history-status.processing, .history-status.pending, .history-status.capturing, .history-status.analyzing { background: rgba(172,115,9,0.14); color: #785006; }
        .history-status.failed { background: rgba(166,63,48,0.14); color: #7A2A1D; }
        .history-card-body { display: flex; align-items: stretch; gap: 1.8rem; flex: 1; padding: 1.6rem 0; }
        .history-score-block, .history-stat { display: flex; flex-direction: column; justify-content: center; min-width: 0; }
        .history-score-block { flex: 1.4; }
        .history-stat { flex: 1; }
        .history-stat-divider { flex-shrink: 0; width: 1px; background: var(--line); }
        .history-score-block small, .history-stat small, .history-score-block strong, .history-stat strong { display: block; }
        .history-score-block small, .history-stat small { margin-bottom: 0.55rem; color: var(--secondary); font-size: 1.05rem; font-weight: 600; }
        .history-score-block strong, .history-stat strong { color: var(--primary); font-size: 1.6rem; font-weight: 700; }
        .history-score-block strong span { color: var(--secondary); font-size: 1rem; font-weight: 550; }
        .history-score-track { width: 100%; max-width: 18rem; height: 0.5rem; margin-top: 0.8rem; overflow: hidden; border-radius: 999px; background: var(--wash); }
        .history-score-track i { display: block; height: 100%; border-radius: inherit; background: #168271; }
        .history-processing-copy { display: flex; align-items: center; gap: 0.9rem; flex: 1; min-height: 6.5rem; color: var(--secondary); font-size: 1.25rem; font-weight: 550; }
        .history-processing-copy i { width: 0.9rem; height: 0.9rem; border-radius: 50%; background: #AC7309; box-shadow: 0 0 0 0.45rem rgba(172,115,9,0.12); flex-shrink: 0; }
        .history-failed-copy { color: #A63F30; }
        .history-card-action { padding-top: 1.4rem; border-top: 1px solid var(--line-strong); color: #087F70; font-size: 1.22rem; font-weight: 750; display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
        .history-card-action-right { flex-shrink: 0; display: flex; align-items: center; gap: 1.2rem; }
        .history-delete-btn { flex-shrink: 0; padding: 0.6rem 1.4rem; border: 1px solid var(--line-strong); border-radius: 999px; background: var(--surface); color: #A63F30; font-size: 1.15rem; font-weight: 700; cursor: pointer; transition: background 150ms ease, border-color 150ms ease; }
        .history-delete-btn:hover:not(:disabled) { background: rgba(166,63,48,0.08); border-color: #A63F30; }
        .history-delete-btn:disabled { opacity: 0.6; cursor: default; }
        @media (max-width: 700px) {
          .history-page { padding: 3.2rem 2rem 6rem !important; }
          .history-summary { grid-template-columns: repeat(2, 1fr); gap: 1.8rem 0; padding: 1.8rem; }
          .history-summary > div { padding: 0 1.4rem; }
          .history-summary > div:nth-child(2) { border-right: 0; }
          .history-summary > div:nth-child(3) { padding-left: 0; }
          .history-card { grid-template-columns: 1fr; min-height: 0; }
          .history-photo { height: 16rem; border-right: 0; border-bottom: 1px solid var(--line); }
          .history-card-content { padding: 1.7rem 1.6rem 1.4rem; }
          .history-card-body { flex-wrap: wrap; gap: 1.4rem 1.8rem; }
          .history-score-block { flex-basis: 100%; }
          .history-stat-divider { display: none; }
          .history-score-block strong, .history-stat strong { font-size: 1.4rem; }
        }
      `}</style>
    </div>
  );
}
