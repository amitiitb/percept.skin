"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { MODULES, BUNDLE_PRICE, INDIVIDUAL_TOTAL, BUNDLE_SAVINGS, BUNDLE_DISCOUNT_PCT, DOCTOR_CONSULTATION_PRICE, priceFor, type ModuleId } from "@/lib/v2/reportModules";

const ANALYZING_MESSAGES = [
  "Analyzing your facial features…",
  "Mapping skin texture and tone…",
  "Preparing your personalized report…",
];

type PayState = "idle" | "confirming" | "failed" | "cancelled";

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
  const [analyzing, setAnalyzing] = useState(true);
  const [msgIndex, setMsgIndex] = useState(0);
  const [payState, setPayState] = useState<PayState>("idle");
  const [payError, setPayError] = useState("");

  // Doctor Consultation — separate paid tier, own PayPal button + state,
  // independent of the report-module purchase above.
  const [consultPhone, setConsultPhone] = useState("");
  const [consultPayState, setConsultPayState] = useState<PayState | "success">("idle");
  const [consultPayError, setConsultPayError] = useState("");

  const buttonRef = useRef<HTMLDivElement>(null);
  const consultButtonRef = useRef<HTMLDivElement>(null);
  const scriptLoadedRef = useRef(false);
  const analysisKickedRef = useRef(false);
  const analysisReadyRef = useRef(false);

  const isBundle = selected.size === MODULES.length;
  const price = priceFor([...selected]);

  // Auth + existing-purchase guard — don't let a user pay twice for the same session.
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace(`/auth/login?next=/v2/bundle/${sessionId}`); return; }
      const { data: existing } = await supabase.from("report_purchases_v2").select("id").eq("session_id", sessionId).eq("user_id", user.id).maybeSingle();
      if (existing) { router.replace(`/v2/report/${sessionId}`); return; }
      setAuthChecked(true);
    });
  }, [sessionId]);

  // Kick off analysis in the background the moment we land here — the user
  // browses the purchase screen while this runs, never blocking on it.
  useEffect(() => {
    if (!authChecked || analysisKickedRef.current) return;
    analysisKickedRef.current = true;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        const res = await fetch("/api/v2/analyse", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ sessionId }),
        });
        analysisReadyRef.current = res.ok;
      } catch {
        analysisReadyRef.current = false;
      } finally {
        setAnalyzing(false);
      }
    })();
  }, [authChecked, sessionId]);

  useEffect(() => {
    const t = setInterval(() => setMsgIndex((i) => (i + 1) % ANALYZING_MESSAGES.length), 2600);
    return () => clearInterval(t);
  }, []);

  // PayPal SDK — loaded exactly once for the whole page (two separate script
  // tags/instances make the SDK throw "zoid destroyed all components" on the
  // second load), then both the report-purchase and consultation buttons
  // render off that single window.paypal.
  useEffect(() => {
    if (!authChecked || scriptLoadedRef.current) return;
    scriptLoadedRef.current = true;
    const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
    if (!clientId) return;
    if (window.paypal) { renderButton(); renderConsultButton(); return; }
    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD`;
    script.onload = () => { renderButton(); renderConsultButton(); };
    document.body.appendChild(script);
  }, [authChecked]);

  // Re-render the PayPal button whenever the selection changes so createOrder
  // always captures the current module set / price.
  useEffect(() => {
    if (window.paypal && buttonRef.current) {
      buttonRef.current.innerHTML = "";
      renderButton();
    }
  }, [selected]);

  function renderButton() {
    if (!window.paypal || !buttonRef.current) return;
    window.paypal.Buttons({
      createOrder: async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error("Please log in again.");
        const res = await fetch("/api/v2/report-purchase/create-order", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ sessionId, modules: [...selected] }),
        });
        if (!res.ok) { setPayState("failed"); setPayError("Payment service unavailable — try again shortly"); throw new Error("create-order failed"); }
        const data = await res.json() as { orderId: string };
        return data.orderId;
      },
      onApprove: async (data: { orderID: string }) => {
        setPayState("confirming");
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.access_token) throw new Error("Not authenticated");
          const res = await fetch("/api/v2/report-purchase/capture", {
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
          router.push(`/v2/report/${sessionId}`);
        } catch {
          setPayError("We couldn't verify this payment — contact support if you were charged.");
          setPayState("failed");
        }
      },
      onCancel: () => setPayState("cancelled"),
      onError: () => { setPayError("Payment service unavailable — try again shortly"); setPayState("failed"); },
    }).render(buttonRef.current);
  }

  function renderConsultButton() {
    if (!window.paypal || !consultButtonRef.current) return;
    window.paypal.Buttons({
      createOrder: async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error("Please log in again.");
        const res = await fetch("/api/v2/consultation/create-order", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ sessionId, contactPhone: consultPhone || undefined }),
        });
        if (!res.ok) { setConsultPayState("failed"); setConsultPayError("Payment service unavailable — try again shortly"); throw new Error("create-order failed"); }
        const data = await res.json() as { orderId: string };
        return data.orderId;
      },
      onApprove: async (data: { orderID: string }) => {
        setConsultPayState("confirming");
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.access_token) throw new Error("Not authenticated");
          const res = await fetch("/api/v2/consultation/capture", {
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
          setConsultPayError("We couldn't verify this payment — contact support if you were charged.");
          setConsultPayState("failed");
        }
      },
      onCancel: () => setConsultPayState("cancelled"),
      onError: () => { setConsultPayError("Payment service unavailable — try again shortly"); setConsultPayState("failed"); },
    }).render(consultButtonRef.current);
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

  if (!authChecked) return <div style={{ minHeight: "100dvh", background: "var(--canvas)" }} />;

  return (
    <div style={{ minHeight: "100dvh", background: "var(--canvas)", padding: "4rem 2rem 8rem" }}>
      <div style={{ maxWidth: "72rem", margin: "0 auto" }}>

        {/* Subtle, non-blocking analysis indicator */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "3.2rem" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "1rem", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "9999px", padding: "1rem 2rem" }}>
            {analyzing ? (
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }} style={{ width: "1.6rem", height: "1.6rem", borderRadius: "50%", border: "2px solid var(--line)", borderTopColor: "var(--primary)", flexShrink: 0 }} />
            ) : (
              <span style={{ width: "1.6rem", height: "1.6rem", borderRadius: "50%", background: "#4C8C5F", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
            )}
            <AnimatePresence mode="wait">
              <motion.span key={analyzing ? msgIndex : "done"} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ fontSize: "1.4rem", color: "var(--secondary)" }}>
                {analyzing ? ANALYZING_MESSAGES[msgIndex] : "Your report is ready"}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>

        <div style={{ textAlign: "center", marginBottom: "4rem" }}>
          <h1 style={{ fontSize: "clamp(2.8rem, 6vw, 3.8rem)", fontWeight: 400, color: "var(--primary)", letterSpacing: "-0.02em", marginBottom: "1.2rem" }}>
            Choose your report
          </h1>
          <p style={{ fontSize: "1.6rem", color: "var(--secondary)" }}>Unlock the insights that matter to you</p>
        </div>

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
                onClick={() => toggleModule(m.id)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1.6rem",
                  background: "var(--surface)", border: `1px solid ${checked ? "var(--primary)" : "var(--line)"}`,
                  borderRadius: "1.2rem", padding: "1.8rem 2rem", cursor: "pointer", textAlign: "left",
                  transition: "border-color 0.15s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "1.6rem" }}>
                  <span style={{
                    width: "2.4rem", height: "2.4rem", borderRadius: "0.6rem", flexShrink: 0,
                    border: `2px solid ${checked ? "var(--primary)" : "var(--line-strong)"}`,
                    background: checked ? "var(--primary)" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {checked && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </span>
                  <div>
                    <p style={{ fontSize: "1.6rem", color: "var(--primary)", margin: 0, fontWeight: 500 }}>{m.label}</p>
                    <p style={{ fontSize: "1.3rem", color: "var(--secondary)", margin: "0.3rem 0 0" }}>{m.description}</p>
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

        {payState === "failed" && <p style={{ color: "#C8503A", fontSize: "1.4rem", marginBottom: "1.6rem", textAlign: "center" }}>{payError}</p>}
        {payState === "cancelled" && <p style={{ color: "var(--muted)", fontSize: "1.4rem", marginBottom: "1.6rem", textAlign: "center" }}>Payment cancelled — no charge was made.</p>}
        {payState === "confirming" && <p style={{ color: "var(--secondary)", fontSize: "1.4rem", marginBottom: "1.6rem", textAlign: "center" }}>Confirming payment…</p>}

        <div style={{ opacity: payState === "confirming" ? 0.4 : 1, pointerEvents: payState === "confirming" ? "none" : "auto" }}>
          <div ref={buttonRef} />
        </div>

        <p style={{ fontSize: "1.2rem", color: "var(--muted)", textAlign: "center", marginTop: "2.4rem" }}>
          Sandbox mode · no real charge · secure checkout via PayPal
        </p>

        {/* ── Doctor Consultation — separate paid tier, not part of the report bundle ── */}
        <div style={{ marginTop: "5.6rem", paddingTop: "4rem", borderTop: "1px solid var(--line)" }}>
          <p style={{ fontSize: "1.3rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1.6rem", textAlign: "center" }}>
            Or talk to a real dermatologist
          </p>
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "1.6rem", padding: "3.2rem", maxWidth: "56rem", margin: "0 auto" }}>
            <h2 style={{ fontSize: "2rem", fontWeight: 500, color: "var(--primary)", margin: "0 0 0.8rem" }}>Doctor Consultation</h2>
            <p style={{ fontSize: "1.4rem", color: "var(--secondary)", lineHeight: 1.5, marginBottom: "2rem" }}>
              A certified dermatologist reviews your case and follows up directly — no AI, a real person. We&apos;ll contact you within 24 hours after payment.
            </p>

            {consultPayState === "success" ? (
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
                  onChange={(e) => setConsultPhone(e.target.value)}
                  placeholder="+1 555 000 0000"
                  style={{ width: "100%", padding: "1.2rem 1.6rem", fontSize: "1.5rem", border: "1px solid var(--line)", borderRadius: "0.8rem", marginBottom: "2rem", background: "var(--canvas)", color: "var(--primary)" }}
                />

                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "2rem" }}>
                  <span style={{ fontSize: "1.5rem", color: "var(--secondary)" }}>One-time consultation</span>
                  <strong style={{ fontSize: "2.4rem", fontWeight: 300, color: "var(--primary)" }}>${DOCTOR_CONSULTATION_PRICE}</strong>
                </div>

                {consultPayState === "failed" && <p style={{ color: "#C8503A", fontSize: "1.4rem", marginBottom: "1.6rem", textAlign: "center" }}>{consultPayError}</p>}
                {consultPayState === "cancelled" && <p style={{ color: "var(--muted)", fontSize: "1.4rem", marginBottom: "1.6rem", textAlign: "center" }}>Payment cancelled — no charge was made.</p>}
                {consultPayState === "confirming" && <p style={{ color: "var(--secondary)", fontSize: "1.4rem", marginBottom: "1.6rem", textAlign: "center" }}>Confirming payment…</p>}

                <div style={{ opacity: consultPayState === "confirming" ? 0.4 : 1, pointerEvents: consultPayState === "confirming" ? "none" : "auto" }}>
                  <div ref={consultButtonRef} />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <style>{`
        @media (max-width: 480px) {
          .v2-bundle-modules-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
