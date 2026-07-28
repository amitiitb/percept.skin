"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { MODULES, BUNDLE_PRICE, INDIVIDUAL_TOTAL, BUNDLE_SAVINGS, BUNDLE_DISCOUNT_PCT, DOCTOR_CONSULTATION_PRICE, priceFor, type ModuleId } from "@/lib/v2/reportModules";

// Real backend stages written by app/api/analyse/route.ts — not decoration.
// Order matters: it's also the step-counter denominator (index + 1 of 4).
const STAGES = ["fetching_photos", "analyzing", "scoring", "personalizing"] as const;
type Stage = typeof STAGES[number] | "complete" | "failed";

const STAGE_COPY: Record<typeof STAGES[number], { skin: string; hair: string; bundle: string }> = {
  fetching_photos: { skin: "Loading your photos…", hair: "Loading your photos…", bundle: "Loading your photos…" },
  analyzing: {
    skin: "Reading your skin's texture and tone…",
    hair: "Reading your scalp and hairline…",
    bundle: "Analyzing your face, scalp, and hair…",
  },
  scoring: {
    skin: "Scoring against your baseline…",
    hair: "Scoring your hair and scalp health…",
    bundle: "Scoring your results…",
  },
  personalizing: {
    skin: "Building your skincare routine…",
    hair: "Building your haircare routine…",
    bundle: "Building your personalized routine…",
  },
};

const POLL_INTERVAL_MS = 4000;
const POLL_MAX_WAIT_MS = 3 * 60 * 1000;

type PayState = "idle" | "confirming" | "success" | "failed" | "cancelled";

const CONFETTI = Array.from({ length: 14 }, (_, i) => ({
  x: (i / 14) * 100 + (i % 2 === 0 ? -3 : 3),
  delay: (i % 7) * 0.08,
  color: i % 3 === 0 ? "var(--rose)" : i % 3 === 1 ? "#fff" : "rgba(255,255,255,0.5)",
}));

declare global {
  interface Window { paypal?: { Buttons: (opts: unknown) => { render: (el: HTMLElement) => void } }; }
}

export default function V2BundlePage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.sessionId as string;
  const supabase = createClient();

  const [authChecked, setAuthChecked] = useState(false);
  const [selected, setSelected] = useState<Set<ModuleId>>(new Set(MODULES.map((m) => m.id)));
  const [purchasePath, setPurchasePath] = useState<"report" | "consultation" | "combo">("report");
  const [stage, setStage] = useState<Stage | null>(null);
  const [failReason, setFailReason] = useState<string | null>(null);
  const [payState, setPayState] = useState<PayState>("idle");
  const [payError, setPayError] = useState("");

  // Doctor Consultation — separate paid tier, own PayPal button + state,
  // independent of the report-module purchase above (unless purchasePath is
  // "combo", see comboButtonRef below).
  const [consultPhone, setConsultPhone] = useState("");
  const [consultPayState, setConsultPayState] = useState<PayState | "success">("idle");
  const [consultPayError, setConsultPayError] = useState("");
  // PayPal's createOrder callback closes over whatever `consultPhone` was at
  // render time, so a phone typed after the button rendered would otherwise
  // be silently dropped from the order — read the ref instead for the real
  // current value regardless of when the button instance was created.
  const consultPhoneRef = useRef("");

  const buttonRef = useRef<HTMLDivElement>(null);
  const consultButtonRef = useRef<HTMLDivElement>(null);
  // Combined report + consultation checkout — one PayPal order/capture
  // instead of the two sequential charges the "combo" path used to require.
  const comboButtonRef = useRef<HTMLDivElement>(null);
  const scriptLoadedRef = useRef(false);
  const analysisKickedRef = useRef(false);
  const analysisReadyRef = useRef(false);

  const isBundle = selected.size === MODULES.length;
  const price = priceFor([...selected]);

  // Auth + existing-purchase guard — don't let a user pay twice for the same session.
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace(`/auth/login?next=/bundle/${sessionId}`); return; }
      const { data: existing } = await supabase.from("report_purchases_v2").select("id").eq("session_id", sessionId).eq("user_id", user.id).maybeSingle();
      if (existing) { router.replace(`/report/${sessionId}`); return; }
      setAuthChecked(true);
    });
  }, [sessionId]);

  async function kickOffAnalysis() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch("/api/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ sessionId }),
      });
      analysisReadyRef.current = res.ok;
      if (!res.ok) {
        // Don't wait on the DB poll to notice this — the fetch response
        // itself is definitive proof the request failed. Setting `stage`
        // straight from here is what actually closes the silent-failure
        // bug; relying solely on a server-side DB write to flip it (which
        // can itself fail, e.g. pre-migration) would just reintroduce the
        // same bug one layer down.
        const body = await res.json().catch(() => ({} as { error?: string }));
        setFailReason(body.error ?? "Something went wrong, try again");
        setStage("failed");
      }
    } catch {
      analysisReadyRef.current = false;
      setFailReason("Something went wrong, try again");
      setStage("failed");
    }
  }

  // Kick off analysis in the background the moment we land here — the user
  // browses the purchase screen while this runs, never blocking on it.
  useEffect(() => {
    if (!authChecked || analysisKickedRef.current) return;
    analysisKickedRef.current = true;
    kickOffAnalysis();
  }, [authChecked, sessionId]);

  function retryAnalysis() {
    setFailReason(null);
    setStage(null);
    kickOffAnalysis();
  }

  // Poll the real stage the backend is writing (app/api/analyse/route.ts)
  // instead of cycling decorative placeholder text — this is what makes the
  // progress indicator true, not decoration. Read-only; the fetch above is
  // still what actually drives the work.
  useEffect(() => {
    if (stage === "complete" || stage === "failed") return;
    const startedAt = Date.now();
    const poll = async () => {
      if (Date.now() - startedAt > POLL_MAX_WAIT_MS) return;
      const { data } = await supabase.from("analysis_sessions_v2").select("stage, fail_reason").eq("id", sessionId).maybeSingle();
      if (data?.stage) setStage(data.stage as Stage);
      if (data?.fail_reason) setFailReason(data.fail_reason);
    };
    poll();
    const t = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [sessionId, stage]);

  // Celebration screen auto-advances so the payment doesn't feel like a dead
  // end if the user never taps the button — the tap just gets there sooner.
  useEffect(() => {
    if (payState !== "success") return;
    const t = setTimeout(() => router.push(`/report/${sessionId}`), 3400);
    return () => clearTimeout(t);
  }, [payState, sessionId]);

  // PayPal SDK — loaded exactly once for the whole page (two separate script
  // tags/instances make the SDK throw "zoid destroyed all components" on the
  // second load), then both the report-purchase and consultation buttons
  // render off that single window.paypal.
  useEffect(() => {
    if (!authChecked || scriptLoadedRef.current) return;
    scriptLoadedRef.current = true;
    const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
    if (!clientId) return;
    if (window.paypal) { renderButton(); renderConsultButton(); renderComboButton(); return; }
    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD`;
    script.onload = () => { renderButton(); renderConsultButton(); renderComboButton(); };
    document.body.appendChild(script);
  }, [authChecked]);

  // Re-render the PayPal button whenever the selection changes so createOrder
  // always captures the current module set / price.
  useEffect(() => {
    if (window.paypal && buttonRef.current) {
      buttonRef.current.innerHTML = "";
      renderButton();
    }
    if (window.paypal && comboButtonRef.current) {
      comboButtonRef.current.innerHTML = "";
      renderComboButton();
    }
  }, [selected]);

  function renderButton() {
    if (!window.paypal || !buttonRef.current) return;
    window.paypal.Buttons({
      createOrder: async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error("Please log in again.");
        const res = await fetch("/api/report-purchase/create-order", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ sessionId, modules: [...selected] }),
        });
        if (!res.ok) { setPayState("failed"); setPayError("Payment service unavailable, try again shortly"); throw new Error("create-order failed"); }
        const data = await res.json() as { orderId: string };
        return data.orderId;
      },
      onApprove: async (data: { orderID: string }) => {
        setPayState("confirming");
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.access_token) throw new Error("Not authenticated");
          const res = await fetch("/api/report-purchase/capture", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ orderId: data.orderID }),
          });
          if (!res.ok) {
            const body = await res.json() as { error?: string };
            setPayError(body.error ?? "We couldn't verify this payment.");
            setPayState("failed");
            return;
          }
          // Analysis may still be finishing — wait briefly rather than landing
          // on a "still processing" report page immediately after paying.
          for (let i = 0; i < 20 && !analysisReadyRef.current; i++) {
            await new Promise((r) => setTimeout(r, 500));
          }
          setPayState("success");
        } catch {
          setPayError("We couldn't verify this payment. Contact support if you were charged.");
          setPayState("failed");
        }
      },
      onCancel: () => setPayState("cancelled"),
      onError: () => { setPayError("Payment service unavailable, try again shortly"); setPayState("failed"); },
    }).render(buttonRef.current);
  }

  function renderConsultButton() {
    if (!window.paypal || !consultButtonRef.current) return;
    window.paypal.Buttons({
      createOrder: async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error("Please log in again.");
        const res = await fetch("/api/consultation/create-order", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ sessionId, contactPhone: consultPhoneRef.current || undefined }),
        });
        if (!res.ok) { setConsultPayState("failed"); setConsultPayError("Payment service unavailable, try again shortly"); throw new Error("create-order failed"); }
        const data = await res.json() as { orderId: string };
        return data.orderId;
      },
      onApprove: async (data: { orderID: string }) => {
        setConsultPayState("confirming");
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.access_token) throw new Error("Not authenticated");
          const res = await fetch("/api/consultation/capture", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ orderId: data.orderID }),
          });
          if (!res.ok) {
            const body = await res.json() as { error?: string };
            setConsultPayError(body.error ?? "We couldn't verify this payment.");
            setConsultPayState("failed");
            return;
          }
          setConsultPayState("success");
        } catch {
          setConsultPayError("We couldn't verify this payment. Contact support if you were charged.");
          setConsultPayState("failed");
        }
      },
      onCancel: () => setConsultPayState("cancelled"),
      onError: () => { setConsultPayError("Payment service unavailable, try again shortly"); setConsultPayState("failed"); },
    }).render(consultButtonRef.current);
  }

  // Combined checkout: one PayPal order for report + consultation together,
  // one capture writes both report_purchases_v2 and doctor_consultations_v2.
  function renderComboButton() {
    if (!window.paypal || !comboButtonRef.current) return;
    window.paypal.Buttons({
      createOrder: async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error("Please log in again.");
        const res = await fetch("/api/report-purchase/create-order", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ sessionId, modules: [...selected], includeConsultation: true, contactPhone: consultPhoneRef.current || undefined }),
        });
        if (!res.ok) { setPayState("failed"); setPayError("Payment service unavailable, try again shortly"); throw new Error("create-order failed"); }
        const data = await res.json() as { orderId: string };
        return data.orderId;
      },
      onApprove: async (data: { orderID: string }) => {
        setPayState("confirming");
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.access_token) throw new Error("Not authenticated");
          const res = await fetch("/api/report-purchase/capture", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ orderId: data.orderID }),
          });
          if (!res.ok) {
            const body = await res.json() as { error?: string };
            setPayError(body.error ?? "We couldn't verify this payment.");
            setPayState("failed");
            return;
          }
          for (let i = 0; i < 20 && !analysisReadyRef.current; i++) {
            await new Promise((r) => setTimeout(r, 500));
          }
          setPayState("success");
        } catch {
          setPayError("We couldn't verify this payment. Contact support if you were charged.");
          setPayState("failed");
        }
      },
      onCancel: () => setPayState("cancelled"),
      onError: () => { setPayError("Payment service unavailable, try again shortly"); setPayState("failed"); },
    }).render(comboButtonRef.current);
  }

  function toggleModule(id: ModuleId) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { if (next.size > 1) next.delete(id); } else next.add(id);
      return next;
    });
  }

  function selectBundle() {
    setSelected(new Set(MODULES.map((m) => m.id)));
  }

  // /api/analyse only ever produces skin/face/hair metrics (colour and
  // frame previews are separate endpoints entirely) — so "personalize by
  // module" for this specific progress indicator means: did the user buy
  // Skin, Hairstyle, both, or neither of those two.
  const hasSkin = selected.has("skin");
  const hasHair = selected.has("hairstyle");
  const moduleKey: "skin" | "hair" | "bundle" = hasSkin && !hasHair ? "skin" : hasHair && !hasSkin ? "hair" : "bundle";
  const stageIndex = stage && stage !== "complete" && stage !== "failed" ? STAGES.indexOf(stage) : -1;
  const stageCopy = stageIndex >= 0 ? STAGE_COPY[STAGES[stageIndex]][moduleKey] : "Getting started…";

  if (!authChecked) return <div style={{ minHeight: "100dvh", background: "var(--canvas)" }} />;

  return (
    <>
      <AnimatePresence>
        {payState === "success" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{
              position: "fixed", inset: 0, zIndex: 200, background: "var(--primary)",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              padding: "3.2rem", overflow: "hidden",
            }}
          >
            {CONFETTI.map((c, i) => (
              <motion.span
                key={i}
                aria-hidden
                initial={{ y: "-10vh", x: `${c.x}vw`, opacity: 0, rotate: 0 }}
                animate={{ y: "110vh", opacity: [0, 1, 1, 0], rotate: 360 }}
                transition={{ duration: 2.6, delay: c.delay, ease: "easeIn" }}
                style={{ position: "absolute", top: 0, left: 0, width: "0.8rem", height: "0.8rem", borderRadius: "2px", background: c.color, pointerEvents: "none" }}
              />
            ))}

            <motion.div
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.1 }}
              style={{
                width: "8rem", height: "8rem", borderRadius: "50%", background: "var(--rose)",
                display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "3.2rem",
              }}
            >
              <motion.svg
                width="40" height="40" viewBox="0 0 24 24" fill="none"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, delay: 0.4 }}
              >
                <motion.path d="M4 12l6 6L20 6" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </motion.svg>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.4 }}
              style={{ fontSize: "clamp(2.6rem, 6vw, 3.6rem)", fontWeight: 400, color: "#fff", textAlign: "center", letterSpacing: "-0.02em", marginBottom: "1.2rem" }}
            >
              Payment successful
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.4 }}
              style={{ fontSize: "1.6rem", color: "rgba(255,255,255,0.7)", textAlign: "center", marginBottom: "4rem", maxWidth: "44rem" }}
            >
              {purchasePath === "combo"
                ? "Your report is ready, and our team will reach out about your consultation within 24 hours."
                : "Your Complete Beauty Report is ready to view."}
            </motion.p>

            <motion.button
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.4 }}
              onClick={() => router.push(`/report/${sessionId}`)}
              style={{
                background: "var(--rose)", color: "#fff", fontSize: "1.6rem", fontWeight: 500,
                border: "none", borderRadius: "9999px", padding: "1.6rem 3.6rem", cursor: "pointer",
              }}
            >
              View My Report →
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

    <div style={{ minHeight: "100dvh", background: "var(--canvas)", padding: "4rem 2rem 8rem" }}>
      <div style={{ maxWidth: "72rem", margin: "0 auto" }}>

        {/* Real analysis progress — reads the actual stage app/api/analyse/route.ts
            is writing, not a decorative timed loop. */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "3.2rem" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "1rem", borderRadius: "9999px", padding: "1rem 2rem",
            background: stage === "failed" ? "#FBEAE7" : "var(--surface)",
            border: `1px solid ${stage === "failed" ? "#E8B4AA" : "var(--line)"}`,
          }}>
            {stage === "complete" ? (
              <span style={{ width: "1.6rem", height: "1.6rem", borderRadius: "50%", background: "#4C8C5F", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
            ) : stage === "failed" ? (
              <span style={{ width: "1.6rem", height: "1.6rem", borderRadius: "50%", background: "#C8503A", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "1.1rem", fontWeight: 700 }}>!</span>
            ) : (
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }} style={{ width: "1.6rem", height: "1.6rem", borderRadius: "50%", border: "2px solid var(--line)", borderTopColor: "var(--primary)", flexShrink: 0 }} />
            )}
            <AnimatePresence mode="wait">
              <motion.span key={stage ?? "start"} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ fontSize: "1.4rem", color: stage === "failed" ? "#A83E2E" : "var(--secondary)" }}>
                {stage === "complete"
                  ? "Your report is ready"
                  : stage === "failed"
                  ? (failReason ?? "Something went wrong, try again")
                  : `${stageCopy}${stageIndex >= 0 ? ` (Step ${stageIndex + 1} of ${STAGES.length})` : ""}`}
              </motion.span>
            </AnimatePresence>
            {stage === "failed" && (
              <button onClick={retryAnalysis} style={{ fontSize: "1.3rem", fontWeight: 600, color: "#A83E2E", textDecoration: "underline", cursor: "pointer", flexShrink: 0 }}>
                Retry
              </button>
            )}
          </div>
        </div>

        <div style={{ textAlign: "center", marginBottom: "3.2rem" }}>
          <h1 style={{ fontSize: "clamp(2.8rem, 6vw, 3.8rem)", fontWeight: 400, color: "var(--primary)", letterSpacing: "-0.02em", marginBottom: "1.2rem" }}>
            Choose your report
          </h1>
          <p style={{ fontSize: "1.6rem", color: "var(--secondary)" }}>Unlock the insights that matter to you</p>
          {stage === "complete" && (
            <button
              onClick={() => router.push(`/report/${sessionId}`)}
              style={{ marginTop: "1.2rem", background: "none", border: "none", color: "var(--rose)", fontSize: "1.4rem", fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}
            >
              Peek at your score first →
            </button>
          )}
        </div>

        {/* ── 3 clear paths: report only, consultation only, or both. Picking
            a segment toggles which checkout section is visible below — both
            sections stay permanently mounted (never unmount buttonRef/
            consultButtonRef) so the PayPal SDK buttons already rendered into
            them don't need to be re-rendered on every switch. One continuous
            segmented pill (shared-layout sliding highlight) instead of 3
            separate boxed tiles — reads as one deliberate control, not a
            grid of rectangles. ── */}
        <div className="v2-purchase-path-tiles" style={{ position: "relative", marginBottom: "3.6rem" }}>
          <span style={{
            position: "absolute", top: "-1.1rem", left: "66.6%", width: "33.3%", textAlign: "center",
            fontSize: "1.05rem", fontWeight: 700, color: "var(--rose)", letterSpacing: "0.04em", zIndex: 2,
          }}>
            ★ BEST VALUE
          </span>
          <div style={{ position: "relative", display: "flex", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "9999px", padding: "0.6rem" }}>
            {([
              { key: "report" as const, label: "Just the Report", price: BUNDLE_PRICE },
              { key: "consultation" as const, label: "Just a Consultation", price: DOCTOR_CONSULTATION_PRICE },
              { key: "combo" as const, label: "Report + Consultation", price: BUNDLE_PRICE + DOCTOR_CONSULTATION_PRICE },
            ]).map((tile) => {
              const active = purchasePath === tile.key;
              return (
                <button
                  key={tile.key}
                  onClick={() => setPurchasePath(tile.key)}
                  style={{
                    position: "relative", flex: 1, zIndex: 1, cursor: "pointer", background: "none", border: "none",
                    padding: "2rem 1rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem",
                  }}
                >
                  {active && (
                    <motion.div
                      layoutId="planPill"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                      style={{ position: "absolute", inset: "0.2rem", background: "var(--primary)", borderRadius: "9999px", zIndex: -1 }}
                    />
                  )}
                  <span style={{ fontSize: "1.4rem", fontWeight: 700, color: active ? "#fff" : "var(--primary)", lineHeight: 1.2, transition: "color 0.2s" }}>{tile.label}</span>
                  <span style={{ fontSize: "2.2rem", fontWeight: 800, color: active ? "#fff" : "var(--primary)", transition: "color 0.2s" }}>${tile.price}</span>
                </button>
              );
            })}
          </div>
        </div>

        {purchasePath === "combo" && (
          <p style={{ fontSize: "1.3rem", color: "var(--muted)", textAlign: "center", marginTop: "-2rem", marginBottom: "3.2rem" }}>
            One payment covers both, the report and the consultation.
          </p>
        )}

        <div style={{ display: purchasePath === "report" || purchasePath === "combo" ? "block" : "none" }}>
        {purchasePath === "combo" && (
          <p style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1.6rem" }}>Report modules</p>
        )}
        {/* ── Premium bundle card ── */}
        <motion.button
          onClick={selectBundle}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{
            position: "relative", width: "100%", textAlign: "left", cursor: "pointer",
            background: "var(--primary)", borderRadius: "2rem", padding: "3.2rem",
            border: isBundle ? "2px solid var(--rose)" : "2px solid transparent",
            overflow: "hidden", marginBottom: "2.4rem",
          }}
        >
          {/* animated glow */}
          <motion.div
            aria-hidden
            animate={{ opacity: [0.25, 0.5, 0.25] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
            style={{ position: "absolute", top: "-30%", right: "-10%", width: "40rem", height: "40rem", borderRadius: "50%", background: "radial-gradient(circle, var(--rose) 0%, transparent 70%)", filter: "blur(30px)", pointerEvents: "none" }}
          />
          {/* shimmer sweep */}
          <motion.div
            aria-hidden
            animate={{ x: ["-120%", "220%"] }}
            transition={{ duration: 3, repeat: Infinity, repeatDelay: 1.5, ease: "easeInOut" }}
            style={{ position: "absolute", top: 0, bottom: 0, width: "30%", background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)", pointerEvents: "none" }}
          />

          <div style={{ position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1.2rem", marginBottom: "2rem" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "0.8rem", fontSize: "1.8rem", fontWeight: 500, color: "#fff" }}>
                <span style={{ fontSize: "2rem" }}>⭐</span> Complete Beauty Report
              </span>
              <motion.span
                animate={{ opacity: [1, 0.55, 1], y: [0, -3, 0] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                style={{ background: "var(--rose)", color: "#fff", fontSize: "1.3rem", fontWeight: 700, borderRadius: "9999px", padding: "0.6rem 1.6rem", whiteSpace: "nowrap" }}
              >
                {BUNDLE_DISCOUNT_PCT}% OFF · Save ${BUNDLE_SAVINGS}
              </motion.span>
            </div>

            <div className="v2-bundle-modules-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem 2rem", marginBottom: "2.4rem", minWidth: 0 }}>
              {MODULES.map((m) => (
                <div key={m.id} style={{ display: "flex", alignItems: "center", gap: "1rem", minWidth: 0 }}>
                  <span style={{ width: "2rem", height: "2rem", borderRadius: "50%", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </span>
                  <span style={{ fontSize: "1.5rem", color: "rgba(255,255,255,0.92)", overflowWrap: "break-word" }}>{m.label}</span>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "baseline", gap: "1.2rem" }}>
              <span style={{ fontSize: "1.8rem", color: "rgba(255,255,255,0.4)", textDecoration: "line-through" }}>${INDIVIDUAL_TOTAL}</span>
              <span style={{ fontSize: "3.6rem", fontWeight: 300, color: "#fff" }}>${BUNDLE_PRICE}</span>
              {isBundle && <span style={{ fontSize: "1.3rem", color: "var(--rose)", fontWeight: 600 }}>✓ Selected</span>}
            </div>
          </div>
        </motion.button>

        {/* ── Individual module selection ── */}
        <p style={{ fontSize: "1.3rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1.6rem" }}>
          Or choose individual modules
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem", marginBottom: "3.2rem" }}>
          {MODULES.map((m) => {
            const checked = selected.has(m.id);
            return (
              <button
                key={m.id}
                className="v2-module-tile"
                onClick={() => toggleModule(m.id)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1.6rem",
                  background: "var(--surface)", border: `1px solid ${checked ? "var(--primary)" : "var(--line)"}`,
                  borderRadius: "1.2rem", padding: "1.8rem 2rem", cursor: "pointer", textAlign: "left",
                  transition: "border-color 0.15s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "1.6rem", minWidth: 0 }}>
                  <span style={{
                    width: "2.4rem", height: "2.4rem", borderRadius: "0.6rem", flexShrink: 0,
                    border: `2px solid ${checked ? "var(--primary)" : "var(--line-strong)"}`,
                    background: checked ? "var(--primary)" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {checked && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: "1.6rem", color: "var(--primary)", margin: 0, fontWeight: 500 }}>{m.label}</p>
                    <p className="v2-module-tile-desc" style={{ fontSize: "1.3rem", color: "var(--secondary)", margin: "0.3rem 0 0" }}>{m.description}</p>
                  </div>
                </div>
                <span style={{ fontSize: "1.6rem", color: "var(--primary)", fontWeight: 500, flexShrink: 0 }}>${m.price}</span>
              </button>
            );
          })}
        </div>

        {/* ── Price summary ── */}
        <div style={{ background: "var(--wash)", borderRadius: "1.2rem", padding: "2rem 2.4rem", marginBottom: "2.4rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <p style={{ fontSize: "1.4rem", color: "var(--secondary)", margin: 0 }}>{selected.size} of {MODULES.length} modules selected</p>
            {!isBundle && (
              <p style={{ fontSize: "1.3rem", color: "#C8503A", margin: "0.4rem 0 0" }}>
                Select all 4 to save ${BUNDLE_SAVINGS} with the bundle
              </p>
            )}
          </div>
          <strong style={{ fontSize: "2.8rem", fontWeight: 300, color: "var(--primary)" }}>${price}</strong>
        </div>

        {purchasePath === "report" && (
          <>
            {payState === "failed" && <p style={{ color: "#C8503A", fontSize: "1.4rem", marginBottom: "1.6rem", textAlign: "center" }}>{payError}</p>}
            {payState === "cancelled" && <p style={{ color: "var(--muted)", fontSize: "1.4rem", marginBottom: "1.6rem", textAlign: "center" }}>Payment cancelled. No charge was made.</p>}
            {payState === "confirming" && <p style={{ color: "var(--secondary)", fontSize: "1.4rem", marginBottom: "1.6rem", textAlign: "center" }}>Confirming payment…</p>}

            <div style={{ opacity: payState === "confirming" ? 0.4 : 1, pointerEvents: payState === "confirming" ? "none" : "auto" }}>
              <div ref={buttonRef} />
            </div>

            <p style={{ fontSize: "1.2rem", color: "var(--muted)", textAlign: "center", marginTop: "2.4rem" }}>
              Sandbox mode · no real charge · secure checkout via PayPal
            </p>
          </>
        )}
        </div>

        {/* ── Doctor Consultation — separate paid tier, not part of the report bundle ── */}
        <div style={{ display: purchasePath === "consultation" || purchasePath === "combo" ? "block" : "none", marginTop: purchasePath === "combo" ? "3.6rem" : 0 }}>
        {purchasePath === "combo" && (
          <p style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1.6rem", textAlign: "center" }}>Consultation details</p>
        )}
        <div style={{ paddingTop: purchasePath === "combo" ? 0 : "4rem", borderTop: purchasePath === "combo" ? "none" : "1px solid var(--line)" }}>
          {purchasePath !== "combo" && (
            <p style={{ fontSize: "1.3rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1.6rem", textAlign: "center" }}>
              Talk to a real dermatologist
            </p>
          )}
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "1.6rem", padding: "3.2rem", maxWidth: "56rem", margin: "0 auto" }}>
            <h2 style={{ fontSize: "2rem", fontWeight: 500, color: "var(--primary)", margin: "0 0 0.8rem" }}>Doctor Consultation</h2>
            <p style={{ fontSize: "1.4rem", color: "var(--secondary)", lineHeight: 1.5, marginBottom: "2rem" }}>
              A certified dermatologist reviews your case and follows up directly. No AI, a real person. We&apos;ll contact you within 24 hours after payment.
            </p>

            {consultPayState === "success" && purchasePath === "consultation" ? (
              <div style={{ background: "var(--wash)", borderRadius: "1.2rem", padding: "2rem", textAlign: "center" }}>
                <p style={{ fontSize: "1.6rem", color: "var(--primary)", fontWeight: 500, margin: "0 0 0.4rem" }}>Confirmed</p>
                <p style={{ fontSize: "1.4rem", color: "var(--secondary)", margin: 0 }}>Our team will contact you within 24 hours.</p>
              </div>
            ) : (
              <>
                <label style={{ display: "block", fontSize: "1.3rem", color: "var(--muted)", marginBottom: "0.6rem" }}>Phone number (optional, for follow-up)</label>
                <input
                  type="tel"
                  value={consultPhone}
                  onChange={(e) => { setConsultPhone(e.target.value); consultPhoneRef.current = e.target.value; }}
                  placeholder="+1 555 000 0000"
                  style={{ width: "100%", padding: "1.2rem 1.6rem", fontSize: "1.5rem", border: "1px solid var(--line)", borderRadius: "0.8rem", marginBottom: "2rem", background: "var(--canvas)", color: "var(--primary)" }}
                />

                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "2rem" }}>
                  <span style={{ fontSize: "1.5rem", color: "var(--secondary)" }}>One-time consultation</span>
                  <strong style={{ fontSize: "2.4rem", fontWeight: 300, color: "var(--primary)" }}>${DOCTOR_CONSULTATION_PRICE}</strong>
                </div>

                {purchasePath === "consultation" && (
                  <>
                    {consultPayState === "failed" && <p style={{ color: "#C8503A", fontSize: "1.4rem", marginBottom: "1.6rem", textAlign: "center" }}>{consultPayError}</p>}
                    {consultPayState === "cancelled" && <p style={{ color: "var(--muted)", fontSize: "1.4rem", marginBottom: "1.6rem", textAlign: "center" }}>Payment cancelled. No charge was made.</p>}
                    {consultPayState === "confirming" && <p style={{ color: "var(--secondary)", fontSize: "1.4rem", marginBottom: "1.6rem", textAlign: "center" }}>Confirming payment…</p>}

                    <div style={{ opacity: consultPayState === "confirming" ? 0.4 : 1, pointerEvents: consultPayState === "confirming" ? "none" : "auto" }}>
                      <div ref={consultButtonRef} />
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
        </div>

        {/* ── Combined checkout — one PayPal order/capture for report + consultation together ── */}
        {purchasePath === "combo" && (
          <div style={{ marginTop: "3.6rem" }}>
            <div style={{ background: "var(--wash)", borderRadius: "1.2rem", padding: "2rem 2.4rem", marginBottom: "2.4rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
              <div>
                <p style={{ fontSize: "1.4rem", color: "var(--secondary)", margin: 0 }}>Report ({selected.size} of {MODULES.length} modules) + consultation</p>
              </div>
              <strong style={{ fontSize: "2.8rem", fontWeight: 300, color: "var(--primary)" }}>${price + DOCTOR_CONSULTATION_PRICE}</strong>
            </div>

            {payState === "failed" && <p style={{ color: "#C8503A", fontSize: "1.4rem", marginBottom: "1.6rem", textAlign: "center" }}>{payError}</p>}
            {payState === "cancelled" && <p style={{ color: "var(--muted)", fontSize: "1.4rem", marginBottom: "1.6rem", textAlign: "center" }}>Payment cancelled. No charge was made.</p>}
            {payState === "confirming" && <p style={{ color: "var(--secondary)", fontSize: "1.4rem", marginBottom: "1.6rem", textAlign: "center" }}>Confirming payment…</p>}

            <div style={{ opacity: payState === "confirming" ? 0.4 : 1, pointerEvents: payState === "confirming" ? "none" : "auto" }}>
              <div ref={comboButtonRef} />
            </div>

            <p style={{ fontSize: "1.2rem", color: "var(--muted)", textAlign: "center", marginTop: "2.4rem" }}>
              Sandbox mode · no real charge · secure checkout via PayPal
            </p>
          </div>
        )}
      </div>
      <style>{`
        @media (max-width: 480px) {
          .v2-bundle-modules-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 640px) {
          .v2-purchase-path-tiles button { padding: 1.4rem 0.6rem !important; }
          .v2-purchase-path-tiles button span:first-child { font-size: 1.15rem !important; }
          .v2-purchase-path-tiles button span:last-child { font-size: 1.7rem !important; }
        }
        @media (max-width: 520px) {
          .v2-module-tile { padding: 1.2rem 1.4rem !important; }
          .v2-module-tile-desc { display: none !important; }
        }
      `}</style>
    </div>
    </>
  );
}
