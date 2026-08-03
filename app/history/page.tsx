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
    <div style={{ minHeight: "100dvh", background: "var(--canvas)", padding: "6rem 3.2rem" }}>
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
          <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
            {rows.map((r) => (
              <div key={r.id} onClick={() => r.status === "complete" && router.push(`/report/${r.id}`)}
                style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "1.2rem", padding: "2.4rem", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: r.status === "complete" ? "pointer" : "default" }}>
                <div>
                  <p style={{ fontSize: "1.5rem", color: "var(--primary)", margin: 0 }}>{new Date(r.created_at).toLocaleDateString()}</p>
                  <p style={{ fontSize: "1.3rem", color: "var(--secondary)", margin: "0.4rem 0 0" }}>{r.status === "complete" ? "Complete" : "Processing"}</p>
                </div>
                {r.overall_score !== null && (
                  <strong style={{ fontSize: "2.8rem", fontWeight: 300, color: "var(--primary)" }}>{r.overall_score}</strong>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
