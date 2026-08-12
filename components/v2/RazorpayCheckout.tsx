"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { formatInr } from "@/lib/v2/inrPricing";

// Razorpay's hosted Standard Checkout. Deliberately generic over which order
// it is paying for (report bundle, consultation, or the combined checkout), so
// the three call sites on the bundle page differ only by the two paths and the
// request body — the same arrangement the three PayPal buttons there have.
//
// Mirrors the PayPal button's contract exactly: create the order server-side,
// hand the modal an order id it cannot tamper with, and never treat the
// browser's success callback as proof of payment — the server re-verifies with
// Razorpay before anything unlocks.

const CHECKOUT_SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

interface RazorpaySuccess {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayFailure {
  error?: { description?: string; reason?: string };
}

interface RazorpayInstance {
  open: () => void;
  on: (event: string, handler: (payload: RazorpayFailure) => void) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

export type RazorpayPayState = "idle" | "confirming" | "success" | "failed" | "cancelled";

interface Props {
  /** Server route that creates the Razorpay order. */
  createOrderPath: string;
  /** Server route that verifies the signature and unlocks the purchase. */
  verifyPath: string;
  /**
   * Read at click time rather than passed as a prop, so a value the user
   * changed after this component rendered (module selection, phone number)
   * still reaches the order — the same stale-closure trap the PayPal button
   * works around with a ref.
   */
  buildBody: () => Record<string, unknown>;
  /** Shown inside the Razorpay modal as the line item. */
  description: string;
  /** Rupee total, for the button label. Must match what the server charges. */
  amountInr: number;
  disabled?: boolean;
  onState: (state: RazorpayPayState, message?: string) => void;
  /** Runs after the server confirms the payment, before "success" is shown. */
  onSuccess: () => void | Promise<void>;
}

// One shared load for the whole page — a second <script> tag for an SDK that
// is already present just races the first.
let scriptPromise: Promise<boolean> | null = null;
function loadCheckoutScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<boolean>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CHECKOUT_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(!!window.Razorpay));
      existing.addEventListener("error", () => resolve(false));
      return;
    }
    const script = document.createElement("script");
    script.src = CHECKOUT_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve(!!window.Razorpay);
    script.onerror = () => {
      // Let a later attempt retry rather than caching the failure forever —
      // this is usually a transient network drop, not a permanent one.
      scriptPromise = null;
      resolve(false);
    };
    document.body.appendChild(script);
  });
  return scriptPromise;
}

export function RazorpayCheckout({
  createOrderPath, verifyPath, buildBody, description, amountInr, disabled, onState, onSuccess,
}: Props) {
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  // Guards against a second modal being opened while the first is still
  // resolving — two live modals can produce two orders for one purchase.
  const openRef = useRef(false);

  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

  // Warm the SDK up front so the first tap opens the modal immediately
  // instead of waiting on a cold network fetch.
  useEffect(() => { loadCheckoutScript(); }, []);

  async function handleClick() {
    if (openRef.current || disabled) return;
    if (!keyId) {
      onState("failed", "Payment service is not configured yet.");
      return;
    }

    openRef.current = true;
    setBusy(true);
    onState("idle");
    // The guard is only meant to cover a *live* modal. Every path that bails
    // before one opens has to release it, or the button stays permanently
    // dead after a single transient failure.
    let modalOpened = false;

    try {
      const scriptReady = await loadCheckoutScript();
      if (!scriptReady) {
        onState("failed", "Payment service unavailable, try again shortly");
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        onState("failed", "Please log in again.");
        return;
      }

      // Snapshot once: buildBody() reads live component state, and calling it
      // again later could describe a different purchase than the one ordered.
      const body = buildBody();

      const res = await fetch(createOrderPath, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const failure = await res.json().catch(() => ({})) as { error?: string };
        onState("failed", failure.error ?? "Payment service unavailable, try again shortly");
        return;
      }
      const order = await res.json() as { orderId: string; amount: number; currency: string };

      // Razorpay closes the modal itself once `handler` has been invoked, and
      // that close can also fire `ondismiss`. Without this flag a completed
      // payment would land on "Payment cancelled. No charge was made." moments
      // after the success screen — the most alarming possible thing to tell
      // someone who was just charged.
      let settled = false;

      const rzp = new window.Razorpay!({
        key: keyId,
        // Amount and currency are echoed from the order for display only —
        // Razorpay bills whatever the order was created for server-side, so
        // these cannot be tampered with into a different charge.
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: "Percept",
        description,
        prefill: {
          email: session.user?.email ?? "",
          contact: typeof body.contactPhone === "string" ? body.contactPhone : "",
        },
        theme: { color: "#0C5C51" },
        handler: async (response: RazorpaySuccess) => {
          settled = true;
          onState("confirming");
          try {
            const { data: { session: fresh } } = await supabase.auth.getSession();
            if (!fresh?.access_token) throw new Error("Not authenticated");
            const verifyRes = await fetch(verifyPath, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${fresh.access_token}` },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            if (!verifyRes.ok) {
              const failure = await verifyRes.json().catch(() => ({})) as { error?: string };
              onState("failed", failure.error ?? "We couldn't verify this payment.");
              return;
            }
            await onSuccess();
            onState("success");
          } catch {
            onState("failed", "We couldn't verify this payment. Contact support if you were charged.");
          } finally {
            openRef.current = false;
          }
        },
        modal: {
          ondismiss: () => {
            openRef.current = false;
            // A payment already in flight owns the state from here on.
            if (settled) return;
            onState("cancelled");
          },
        },
      });

      // Razorpay keeps the modal open after a failed attempt so the user can
      // try another method — surface why it failed without tearing it down.
      rzp.on("payment.failed", (payload) => {
        onState("failed", payload.error?.description ?? "That payment didn't go through. Try another method.");
      });

      rzp.open();
      modalOpened = true;
    } catch {
      onState("failed", "Payment service unavailable, try again shortly");
    } finally {
      setBusy(false);
      // Once the modal is up, only its own handler/ondismiss may release the
      // guard — releasing here would let a second tap open a rival modal.
      if (!modalOpened) openRef.current = false;
    }
  }

  return (
    <PrimaryButton onClick={handleClick} disabled={disabled} loading={busy}>
      Pay {formatInr(amountInr)} · UPI, Cards, Netbanking
    </PrimaryButton>
  );
}
