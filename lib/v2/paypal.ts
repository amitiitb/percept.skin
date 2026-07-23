// Thin PayPal REST wrapper — Sandbox only. Plain HTTP, no SDK dependency
// (PayPal's Orders v2 API is REST; the client-side button uses PayPal's
// hosted JS SDK via a script tag, not an npm package).
//
// TODO before production:
// - Swap PAYPAL_API_BASE to the live endpoint and use production credentials
// - Verify webhook signatures (see app/api/v2/paypal/webhook/route.ts)
// - Handle subscription renewal, cancellation, and refund webhooks
// - Confirm PayPal supports recurring billing for Glowmetry's actual business
//   entity/country (flagged in the eng review — the existing /plan page implies
//   an India-based entity, and PayPal restricts India-domestic recurring billing)

export type PlanId = "monthly" | "quarterly" | "annual";

export const PLANS: Record<PlanId, { label: string; price: string; period: string }> = {
  monthly: { label: "Monthly", price: "9.99", period: "1 month" },
  quarterly: { label: "Quarterly", price: "24.99", period: "3 months" },
  annual: { label: "Annual", price: "79.99", period: "12 months" },
};

export const PAYPAL_API_BASE = "https://api-m.sandbox.paypal.com"; // TODO: swap for production

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
        description: `Glowmetry Premium — ${plan.label}`,
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
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
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
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
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
