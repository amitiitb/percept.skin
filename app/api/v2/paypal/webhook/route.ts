import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/v2/paypal";
import { logV2 } from "@/lib/v2/log";

// No webhook subscription is registered in the PayPal dashboard against this
// app yet (needs a public HTTPS URL + PAYPAL_WEBHOOK_ID) — this route exists
// so the shape is ready, but nothing calls it in practice today. Every event
// is signature-verified before being trusted; unverified events (including
// "no webhook registered yet") are rejected outright rather than logged and
// silently accepted, which was the previous behavior.
export async function POST(req: NextRequest) {
  const transmissionId = req.headers.get("paypal-transmission-id");
  const transmissionTime = req.headers.get("paypal-transmission-time");
  const certUrl = req.headers.get("paypal-cert-url");
  const authAlgo = req.headers.get("paypal-auth-algo");
  const transmissionSig = req.headers.get("paypal-transmission-sig");

  if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
    logV2.warn("v2_paypal_webhook_missing_headers", {});
    return NextResponse.json({ error: "Missing PayPal signature headers" }, { status: 400 });
  }

  const body = await req.text();
  let event: { event_type?: string; id?: string; resource?: { id?: string } };
  try {
    event = JSON.parse(body);
  } catch {
    logV2.warn("v2_paypal_webhook_invalid_json", {});
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const verified = await verifyWebhookSignature(
    { transmissionId, transmissionTime, certUrl, authAlgo, transmissionSig },
    event
  );
  if (!verified) {
    logV2.error("v2_paypal_webhook_signature_failed", { event_type: event.event_type, event_id: event.id });
    return NextResponse.json({ error: "Signature verification failed" }, { status: 401 });
  }

  // Verified — log with full context so a "user paid but data doesn't match"
  // report is reconstructable from logs (docs/V2_PLAN.md Observability
  // requirement). No DB write yet: report_purchases_v2 has no refund/status
  // column, and subscriptions_v2 is unused dead code (see docs/V2_PLAN.md
  // "Bundle-First Purchase Flow") — adding one is a real schema decision,
  // not something to invent silently inside a webhook handler.
  logV2.info("v2_paypal_webhook_verified", {
    event_type: event.event_type,
    event_id: event.id,
    resource_id: event.resource?.id,
  });

  return NextResponse.json({ received: true });
}
