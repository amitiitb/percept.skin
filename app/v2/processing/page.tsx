"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useFunnelV2Store } from "@/store/funnelV2";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

const STAGES = [
  "Checking image quality",
  "Mapping facial regions",
  "Evaluating visible skin features",
  "Reviewing hair and scalp images",
  "Preparing your Glowmetry report",
];

const TIPS = [
  "Drinking enough water supports visible skin hydration over time.",
  "Daily sunscreen is one of the most effective anti-aging habits.",
  "Consistent lighting across scans makes your progress trend more accurate.",
];

export default function V2ProcessingPage() {
  const router = useRouter();
  const supabase = createClient();
  const { currentSessionId } = useFunnelV2Store();

  const [stage, setStage] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!currentSessionId) { router.replace("/v2/dashboard"); return; }
    const stageTimer = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 2000);
    const tipTimer = setInterval(() => setTipIndex((t) => (t + 1) % TIPS.length), 4000);
    return () => { clearInterval(stageTimer); clearInterval(tipTimer); };
  }, []);

  useEffect(() => {
    if (!currentSessionId || startedRef.current) return;
    startedRef.current = true;
    runAnalysis();
  }, [currentSessionId]);

  async function runAnalysis() {
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Please log in again.");
      const res = await fetch("/api/v2/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ sessionId: currentSessionId }),
      });
      if (!res.ok) throw new Error((await res.json() as { error?: string }).error ?? "Analysis failed");
      router.push(`/v2/report/${currentSessionId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong during analysis.");
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--canvas)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "4rem 2.4rem", textAlign: "center" }}>
      {error ? (
        <>
          <p style={{ fontSize: "2rem", color: "var(--primary)", marginBottom: "1.2rem" }}>We hit a snag</p>
          <p style={{ fontSize: "1.6rem", color: "var(--secondary)", marginBottom: "3.2rem", maxWidth: "44rem" }}>{error}</p>
          <div style={{ display: "flex", gap: "1.2rem" }}>
            <PrimaryButton fullWidth={false} onClick={() => { startedRef.current = false; runAnalysis(); }}>Retry</PrimaryButton>
            <PrimaryButton fullWidth={false} variant="outline" onClick={() => router.push("/v2/dashboard")}>Back to dashboard</PrimaryButton>
          </div>
        </>
      ) : (
        <>
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }} style={{ width: "5.6rem", height: "5.6rem", borderRadius: "50%", border: "3px solid var(--line)", borderTopColor: "var(--primary)", marginBottom: "3.2rem" }} />
          <AnimatePresence mode="wait">
            <motion.p key={stage} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} style={{ fontSize: "2rem", color: "var(--primary)", marginBottom: "4rem" }}>
              {STAGES[stage]}…
            </motion.p>
          </AnimatePresence>
          <AnimatePresence mode="wait">
            <motion.p key={tipIndex} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ fontSize: "1.4rem", color: "var(--muted)", maxWidth: "40rem" }}>
              {TIPS[tipIndex]}
            </motion.p>
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
