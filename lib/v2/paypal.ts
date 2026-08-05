// Thin PayPal REST wrapper. Sandbox is the safe default and live mode must be
// selected explicitly with PAYPAL_ENVIRONMENT=live. Plain HTTP, no SDK dependency
// (PayPal's Orders v2 API is REST; the client-side button uses PayPal's
// hosted JS SDK via a script tag, not an npm package — that script already
// points at www.paypal.com, which auto-detects sandbox vs. live from
// whichever client-id it's given, so no separate swap was needed there).
//
// Still outstanding before this is fully production-ready:
// - NEXT_PUBLIC_PAYPAL_CLIENT_ID and PAYPAL_SECRET must come from the same
//   PayPal environment selected by PAYPAL_ENVIRONMENT.
// - Register a webhook subscription in the PayPal dashboard against the
//   live domain and set PAYPAL_WEBHOOK_ID (verifyWebhookSignature below is
//   ready; nothing is registered yet, so nothing calls this endpoint today)
// - These "plans" are one-time /v2/checkout/orders captures, not PayPal
//   Subscriptions, so India-domestic recurring-billing restrictions don't
//   apply here — but confirm the live business entity/country is otherwise
//   in good standing to receive checkout payments before relying on this.

export type PlanId = "monthly" | "quarterly" | "annual";

export const PLANS: Record<PlanId, { label: string; price: string; period: string }> = {
  monthly: { label: "Monthly", price: "9.99", period: "1 month" },
  quarterly: { label: "Quarterly", price: "24.99", period: "3 months" },
  annual: { label: "Annual", price: "79.99", period: "12 months" },
};

export const PAYPAL_ENVIRONMENT = process.env.PAYPAL_ENVIRONMENT === "live" ? "live" : "sandbox";
export const PAYPAL_API_BASE = PAYPAL_ENVIRONMENT === "live"
  ? "https://api-m.paypal.com"
  : "https://api-m.sandbox.paypal.com";

export async function getAccessToken(): Promise<string> {
  // Client ID is intentionally public (NEXT_PUBLIC_ — same value the browser
  // SDK script uses); PAYPAL_SECRET must never reach client-side code.
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_SECRET;
  if (!clientId || !secret) throw new Error("PayPal credentials not configured");

  const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal auth failed: ${res.status}`);
  const data = await res.json() as { access_token: string };
  return data.access_token;
}

export async function createOrder(planId: PlanId, userId: string): Promise<{ orderId: string }> {
  const token = await getAccessToken();
  const plan = PLANS[planId];
  const res = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      intent: "CAPTURE",
      // custom_id round-trips the plan + user so capture doesn't have to trust
      // a client-supplied planId a second time.
      purchase_units: [{
        amount: { currency_code: "USD", value: plan.price },
        description: `Percept Premium: ${plan.label}`,
        custom_id: `${userId}:${planId}`,
      }],
    }),
  });
  if (!res.ok) throw new Error(`PayPal order creation failed: ${res.status}`);
  const data = await res.json() as { id: string };
  return { orderId: data.id };
}

// Fetches the order directly — used when a capture attempt reports the order
// as already captured (PayPal's hosted checkout can complete the capture on
// its own side before our server's explicit capture call lands, so "already
// captured" does not mean *our* server ever recorded it). GET always returns
// the real custom_id and current status regardless of who performed the
// capture, so this is the source of truth for the idempotent-fallback path.
async function getOrder(orderId: string): Promise<{ status: string; customId: string }> {
  const token = await getAccessToken();
  const res = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`PayPal order lookup failed: ${res.status}`);
  const data = await res.json() as { status: string; purchase_units?: Array<{ custom_id?: string }> };
  return { status: data.status, customId: data.purchase_units?.[0]?.custom_id ?? "" };
}

export async function captureOrder(orderId: string): Promise<{ status: string; planId: PlanId | null; userId: string | null }> {
  const token = await getAccessToken();
  const res = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    // Without this, PayPal's v2 capture endpoint returns a MINIMAL response
    // (id, status, payment_source, links only) that omits purchase_units
    // entirely — including custom_id. The code below reads custom_id from the
    // capture response and treats an empty value as "already captured,
    // nothing to write" (see 422 branch above); without this header, EVERY
    // real first-time capture hits that same empty-string path and silently
    // skips persisting the purchase. Confirmed live: a real sandbox payment
    // returned 200 with no row ever written to the DB.
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=representation" },
  });
  // 422 UNPROCESSABLE_ENTITY with ORDER_ALREADY_CAPTURED means the order was
  // captured through some path other than this exact call — not necessarily
  // by a prior call to this endpoint (PayPal's hosted checkout can capture on
  // its own before our explicit call lands). Look up the real order state
  // rather than assuming a row already exists for it.
  if (res.status === 422) {
    const body = await res.json() as { details?: Array<{ issue?: string }> };
    if (body.details?.some((d) => d.issue === "ORDER_ALREADY_CAPTURED")) {
      const order = await getOrder(orderId);
      const [userId, planId] = order.customId.split(":");
      return { status: order.status, planId: (planId as PlanId) ?? null, userId: userId ?? null };
    }
  }
  if (!res.ok) throw new Error(`PayPal capture failed: ${res.status}`);
  const data = await res.json() as {
    status: string;
    purchase_units?: Array<{ custom_id?: string }>;
  };
  const customId = data.purchase_units?.[0]?.custom_id ?? "";
  const [userId, planId] = customId.split(":");
  return { status: data.status, planId: (planId as PlanId) ?? null, userId: userId ?? null };
}

// ── Generic one-time order helpers — used by the report-module bundle
// purchase flow (app/api/v2/report-purchase/*), distinct from the
// subscription-specific createOrder/captureOrder above so neither has to
// know about the other's custom_id shape.

export async function createCustomOrder(amountUsd: number, description: string, customId: string): Promise<{ orderId: string }> {
  const token = await getAccessToken();
  const res = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{
        amount: { currency_code: "USD", value: amountUsd.toFixed(2) },
        description,
        custom_id: customId,
      }],
    }),
  });
  if (!res.ok) throw new Error(`PayPal order creation failed: ${res.status}`);
  const data = await res.json() as { id: string };
  return { orderId: data.id };
}

export async function captureOrderRaw(orderId: string): Promise<{ status: string; customId: string }> {
  const token = await getAccessToken();
  const res = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    // See captureOrder above — without this header the response omits
    // custom_id, and a genuinely first-time capture gets misread as an
    // already-captured no-op, silently skipping the purchase-row write.
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=representation" },
  });
  // See captureOrder above — "already captured" doesn't imply our server ever
  // recorded it, so look up the real order instead of returning an empty customId.
  if (res.status === 422) {
    const body = await res.json() as { details?: Array<{ issue?: string }> };
    if (body.details?.some((d) => d.issue === "ORDER_ALREADY_CAPTURED")) {
      return getOrder(orderId);
    }
  }
  if (!res.ok) throw new Error(`PayPal capture failed: ${res.status}`);
  const data = await res.json() as { status: string; purchase_units?: Array<{ custom_id?: string }> };
  return { status: data.status, customId: data.purchase_units?.[0]?.custom_id ?? "" };
}

// ── Webhook signature verification ──
// Without this, any POST to /api/v2/paypal/webhook claiming to be a
// "payment succeeded" event would be trusted at face value — a spoofing
// vector flagged in docs/V2_PLAN.md's threat model. Verifies via PayPal's
// own /v1/notifications/verify-webhook-signature endpoint rather than
// re-implementing signature crypto locally (PayPal's cert rotation makes a
// local implementation a maintenance trap).
export interface WebhookHeaders {
  transmissionId: string;
  transmissionTime: string;
  certUrl: string;
  authAlgo: string;
  transmissionSig: string;
}

export async function verifyWebhookSignature(headers: WebhookHeaders, webhookEvent: unknown): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return false; // Fail closed — no webhook is registered against this app yet.

  const token = await getAccessToken();
  const res = await fetch(`${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      transmission_id: headers.transmissionId,
      transmission_time: headers.transmissionTime,
      cert_url: headers.certUrl,
      auth_algo: headers.authAlgo,
      transmission_sig: headers.transmissionSig,
      webhook_id: webhookId,
      webhook_event: webhookEvent,
    }),
  });
  if (!res.ok) return false;
  const data = await res.json() as { verification_status: string };
  return data.verification_status === "SUCCESS";
}
