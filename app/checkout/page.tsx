"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PLANS, type PlanId } from "@/lib/v2/paypal";

type CheckoutState = "idle" | "confirming" | "success" | "cancelled" | "failed";

declare global {
  interface Window { paypal?: { Buttons: (opts: unknown) => { render: (el: HTMLElement) => void } }; }
}

export default function V2CheckoutPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100dvh", background: "var(--canvas)" }} />}>
      <V2CheckoutInner />
    </Suspense>
  );
}

function V2CheckoutInner() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();
  const planId = (params.get("plan") as PlanId) || "annual";
  const plan = PLANS[planId];

  const [state, setState] = useState<CheckoutState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const buttonRef = useRef<HTMLDivElement>(null);
  const scriptLoadedRef = useRef(false);

  useEffect(() => {
    if (scriptLoadedRef.current) return;
    scriptLoadedRef.current = true;
    const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
    if (!clientId) { setState("failed"); setErrorMsg("Payment service is not configured yet."); return; }

    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD`;
    script.onload = renderButton;
    script.onerror = () => { setState("failed"); setErrorMsg("Payment service unavailable, try again shortly"); };
    document.body.appendChild(script);
  }, []);

  function renderButton() {
    if (!window.paypal || !buttonRef.current) return;
    window.paypal.Buttons({
      createOrder: async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error("Please log in again.");
        const res = await fetch("/api/paypal/create-order", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ planId }),
        });
        if (!res.ok) { setState("failed"); setErrorMsg("Payment service unavailable, try again shortly"); throw new Error("create-order failed"); }
        const data = await res.json() as { orderId: string };
        return data.orderId;
      },
      onApprove: async (data: { orderID: string }) => {
        // Design/Eng review Decision — show "confirming" while the server
        // verifies with PayPal; never unlock on the client callback alone.
        setState("confirming");
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.access_token) throw new Error("Not authenticated");
          const res = await fetch("/api/paypal/capture", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ orderId: data.orderID }),
          });
          if (!res.ok) {
            const body = await res.json() as { error?: string };
            setErrorMsg(body.error ?? "We couldn't verify this payment.");
            setState("failed");
            return;
          }
          setState("success");
        } catch {
          setErrorMsg("We couldn't verify this payment. Contact support if you were charged.");
          setState("failed");
        }
      },
      onCancel: () => setState("cancelled"),
      onError: () => { setErrorMsg("Payment service unavailable, try again shortly"); setState("failed"); },
    }).render(buttonRef.current);
  }

  if (state === "success") {
    return (
      <div style={{ minHeight: "100dvh", background: "var(--canvas)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "2rem", padding: "4rem", textAlign: "center" }}>
        <p style={{ fontSize: "2.4rem", color: "var(--primary)" }}>You&apos;re Premium 🎉</p>
        <p style={{ fontSize: "1.6rem", color: "var(--secondary)" }}>Your full report is unlocked.</p>
        <button onClick={() => router.push("/dashboard")} style={{ marginTop: "1.2rem", background: "var(--btn-fill)", color: "var(--btn-fill-ink)", border: "none", borderRadius: "9999px", padding: "1.6rem 3.2rem", fontSize: "1.6rem", cursor: "pointer" }}>
          Go to dashboard →
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", background: "var(--canvas)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "4rem 2.4rem", textAlign: "center", position: "relative" }}>
      <button
        onClick={() => router.push("/plans")}
        style={{ position: "absolute", top: "2.4rem", left: "2.4rem", display: "flex", alignItems: "center", gap: "0.8rem", background: "none", border: "none", color: "var(--secondary)", fontSize: "1.4rem", cursor: "pointer", padding: 0 }}
      >
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        Plans
      </button>
      <p style={{ fontSize: "1.4rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1rem" }}>Billing summary</p>
      <h1 style={{ fontSize: "2.8rem", color: "var(--primary)", marginBottom: "0.8rem" }}>Glowmetry Premium: {plan.label}</h1>
      <p style={{ fontSize: "1.8rem", color: "var(--secondary)", marginBottom: "0.8rem" }}>${plan.price} billed every {plan.period} (sandbox)</p>
      <p style={{ fontSize: "1.3rem", color: "var(--muted)", marginBottom: "4rem" }}>Cancel anytime · no hidden fees · you&apos;ll see this exact charge on PayPal&apos;s confirmation screen before it completes</p>

      {state === "confirming" && <p style={{ fontSize: "1.6rem", color: "var(--secondary)", marginBottom: "2rem" }}>Confirming payment…</p>}
      {state === "cancelled" && <p style={{ fontSize: "1.6rem", color: "var(--muted)", marginBottom: "2rem" }}>Payment cancelled. No charge was made.</p>}
      {state === "failed" && <p style={{ fontSize: "1.6rem", color: "var(--rose)", marginBottom: "2rem" }}>{errorMsg}</p>}

      <div style={{ width: "100%", maxWidth: "36rem", opacity: state === "confirming" ? 0.4 : 1, pointerEvents: state === "confirming" ? "none" : "auto" }}>
        <div ref={buttonRef} />
      </div>

      <p style={{ fontSize: "1.2rem", color: "var(--muted)", marginTop: "3.2rem" }}>Sandbox mode · no real charge</p>
    </div>
  );
}
