import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyWebhookSignature } from "@/lib/v2/paypal";
import { fulfilReportPurchase, fulfilConsultation } from "@/lib/v2/fulfilPurchase";
import { type ModuleId } from "@/lib/v2/reportModules";
import { logV2 } from "@/lib/v2/log";

// Safety net for the case the browser-driven capture routes cannot cover: the
// buyer closes the tab (or loses connectivity) between PayPal taking the money
// and /api/report-purchase/capture landing. Without this, that is money taken
// with no purchase row and nothing unlocked.
//
// This does NOT replace the capture routes — those stay the fast path, since
// they can answer the waiting browser and unlock the UI immediately. Both call
// the same fulfilReportPurchase / fulfilConsultation helpers, whose writes are
// upserts keyed on session_id / provider_order_id, so a webhook arriving after
// a successful capture is a harmless no-op, not a duplicate purchase.
//
// Registration (PayPal Developer Dashboard → your live app → Webhooks):
//   URL:    https://<your-domain>/api/paypal/webhook
//   Events: PAYMENT.CAPTURE.COMPLETED
//   Then copy the generated Webhook ID into PAYPAL_WEBHOOK_ID.
// Every event is signature-verified before being trusted; unverified events
// (including "no webhook registered yet") are rejected rather than accepted.

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

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
  let event: {
    event_type?: string;
    id?: string;
    resource?: {
      id?: string;
      custom_id?: string;
      supplementary_data?: { related_ids?: { order_id?: string } };
    };
  };
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

  logV2.info("v2_paypal_webhook_verified", {
    event_type: event.event_type,
    event_id: event.id,
    resource_id: event.resource?.id,
  });

  // Only a completed capture means money actually moved. Other verified
  // events (refunds, disputes) are acknowledged with 200 so PayPal stops
  // retrying, but deliberately not acted on: report_purchases_v2 has no
  // refund/status column, and inventing one inside a webhook handler is a
  // schema decision, not a detail to slip in silently.
  if (event.event_type !== "PAYMENT.CAPTURE.COMPLETED") {
    return NextResponse.json({ received: true });
  }

  // The purchase rows key on the PayPal *order* id (that is what the capture
  // routes store as provider_order_id), not the capture id in resource.id.
  const orderId = event.resource?.supplementary_data?.related_ids?.order_id;
  const customId = event.resource?.custom_id ?? "";
  if (!orderId || !customId) {
    logV2.error("v2_paypal_webhook_missing_ids", { event_id: event.id, has_order: !!orderId, has_custom: !!customId });
    return NextResponse.json({ error: "Missing order_id or custom_id" }, { status: 422 });
  }

  // The two flows encode different custom_id shapes (see the create-order
  // routes): a report purchase is
  //   userId|sessionId|modules|consultFlag|contactPhone   (5 fields)
  // and a standalone consultation is
  //   userId|sessionId|contactPhone                       (3 fields)
  // so field count is what distinguishes them.
  const parts = customId.split("|");
  const userId = parts[0];
  if (!userId) {
    logV2.error("v2_paypal_webhook_custom_id_unparsed", { event_id: event.id, order_id: orderId });
    return NextResponse.json({ error: "Unparsable custom_id" }, { status: 422 });
  }

  try {
    const supabase = serviceClient();

    if (parts.length >= 5) {
      const [, sessionId, modulesRaw, consultFlag, contactPhoneRaw] = parts;
      if (!sessionId || !modulesRaw) {
        logV2.error("v2_paypal_webhook_report_custom_id_incomplete", { user_id: userId, order_id: orderId });
        return NextResponse.json({ error: "Incomplete custom_id" }, { status: 422 });
      }
      const { amount } = await fulfilReportPurchase({
        supabase,
        userId,
        sessionId,
        modules: modulesRaw.split(",") as ModuleId[],
        includeConsultation: consultFlag === "1",
        contactPhone: contactPhoneRaw && contactPhoneRaw !== "-" ? contactPhoneRaw : null,
        provider: "paypal",
        providerOrderId: orderId,
      });
      logV2.info("v2_paypal_webhook_report_purchase_fulfilled", {
        user_id: userId, session_id: sessionId, order_id: orderId, amount, modules: modulesRaw,
      });
      return NextResponse.json({ status: "fulfilled" });
    }

    if (parts.length === 3) {
      const [, sessionIdRaw, contactPhoneRaw] = parts;
      await fulfilConsultation({
        supabase,
        userId,
        sessionId: sessionIdRaw && sessionIdRaw !== "-" ? sessionIdRaw : null,
        contactPhone: contactPhoneRaw && contactPhoneRaw !== "-" ? contactPhoneRaw : null,
        provider: "paypal",
        providerOrderId: orderId,
      });
      logV2.info("v2_paypal_webhook_consultation_fulfilled", { user_id: userId, order_id: orderId });
      return NextResponse.json({ status: "fulfilled" });
    }

    // A subscription-plan order (custom_id is "userId:planId", no pipes) or
    // anything else this app didn't create — money moved, so it is logged
    // loudly rather than silently unlocked on a guess.
    logV2.warn("v2_paypal_webhook_unrecognised_custom_id", { order_id: orderId, field_count: parts.length });
    return NextResponse.json({ status: "ignored" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // 500 so PayPal retries — a transient DB failure would otherwise strand a
    // paid order with no purchase row.
    logV2.error("v2_paypal_webhook_fulfil_failed", { user_id: userId, order_id: orderId, message });
    return NextResponse.json({ error: "Fulfilment failed" }, { status: 500 });
  }
}
