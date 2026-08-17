import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyWebhookSignature, type RazorpayOrder } from "@/lib/v2/razorpay";
import { fulfilReportPurchase, fulfilConsultation } from "@/lib/v2/fulfilPurchase";
import { type ModuleId } from "@/lib/v2/reportModules";
import { logV2 } from "@/lib/v2/log";

// Safety net for the one case the browser-driven verify routes cannot cover:
// the buyer closes the tab (or loses connectivity) in the window between
// Razorpay debiting them and /api/razorpay/*/verify landing. Without this,
// that is money taken with no purchase row and nothing unlocked — the exact
// failure lib/v2/razorpay.ts's header flagged as outstanding before live.
//
// This does NOT replace the verify routes: those stay the fast path, because
// they can respond to the waiting browser and unlock the UI immediately. This
// only catches what they miss. Both call the same fulfilReportPurchase /
// fulfilConsultation helpers, whose writes are upserts keyed on
// session_id / provider_order_id — so a webhook arriving after a successful
// verify is a harmless no-op rather than a duplicate purchase.
//
// Registration (Razorpay Dashboard → Settings → Webhooks):
//   URL:    https://<your-domain>/api/razorpay/webhook
//   Events: order.paid
//   Secret: must match RAZORPAY_WEBHOOK_SECRET in the environment

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

interface RazorpayWebhookEvent {
  event?: string;
  payload?: {
    order?: { entity?: RazorpayOrder };
    payment?: { entity?: { id?: string } };
  };
}

export async function POST(req: NextRequest) {
  const signature = req.headers.get("x-razorpay-signature");
  if (!signature) {
    logV2.warn("v2_razorpay_webhook_missing_signature", {});
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  // Raw text, not req.json() — the HMAC is over the exact bytes sent, so
  // parsing and re-serialising would break verification.
  const rawBody = await req.text();

  if (!verifyWebhookSignature(rawBody, signature)) {
    logV2.error("v2_razorpay_webhook_signature_failed", {});
    return NextResponse.json({ error: "Signature verification failed" }, { status: 401 });
  }

  let event: RazorpayWebhookEvent;
  try {
    event = JSON.parse(rawBody) as RazorpayWebhookEvent;
  } catch {
    logV2.warn("v2_razorpay_webhook_invalid_json", {});
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Only order.paid matters for fulfilment. Anything else is acknowledged with
  // 200 so Razorpay stops retrying a delivery we deliberately ignore.
  if (event.event !== "order.paid") {
    logV2.info("v2_razorpay_webhook_ignored_event", { event: event.event ?? "unknown" });
    return NextResponse.json({ status: "ignored" });
  }

  const order = event.payload?.order?.entity;
  if (!order?.id) {
    logV2.warn("v2_razorpay_webhook_no_order", { event: event.event });
    return NextResponse.json({ error: "No order in payload" }, { status: 400 });
  }

  const notes = order.notes ?? {};
  const userId = notes.user_id;
  const sessionId = notes.session_id;
  if (!userId) {
    // An order created outside our create-order routes, or notes lost. The
    // money moved, so this needs a human rather than a guessed unlock.
    logV2.error("v2_razorpay_webhook_notes_missing", { order_id: order.id, kind: notes.kind ?? "unknown" });
    return NextResponse.json({ error: "Order notes missing" }, { status: 422 });
  }

  try {
    const supabase = serviceClient();

    if (notes.kind === "consultation") {
      await fulfilConsultation({
        supabase,
        userId,
        sessionId: sessionId ? sessionId : null,
        contactPhone: notes.contact_phone ? notes.contact_phone : null,
        provider: "razorpay",
        providerOrderId: order.id,
      });
      logV2.info("v2_razorpay_webhook_consultation_fulfilled", { user_id: userId, session_id: sessionId ?? null, order_id: order.id });
      return NextResponse.json({ status: "fulfilled" });
    }

    if (notes.kind === "report_purchase") {
      if (!sessionId || !notes.modules) {
        logV2.error("v2_razorpay_webhook_report_notes_incomplete", { user_id: userId, order_id: order.id });
        return NextResponse.json({ error: "Order notes incomplete" }, { status: 422 });
      }
      const { amount } = await fulfilReportPurchase({
        supabase,
        userId,
        sessionId,
        modules: notes.modules.split(",") as ModuleId[],
        includeConsultation: notes.include_consultation === "1",
        contactPhone: notes.contact_phone ? notes.contact_phone : null,
        provider: "razorpay",
        providerOrderId: order.id,
      });
      logV2.info("v2_razorpay_webhook_report_purchase_fulfilled", {
        user_id: userId, session_id: sessionId, order_id: order.id,
        amount, modules: notes.modules,
      });
      return NextResponse.json({ status: "fulfilled" });
    }

    logV2.warn("v2_razorpay_webhook_unknown_kind", { order_id: order.id, kind: notes.kind ?? "unset" });
    return NextResponse.json({ status: "ignored" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // 500 so Razorpay retries — a transient DB failure here would otherwise
    // permanently strand a paid order with no purchase row.
    logV2.error("v2_razorpay_webhook_fulfil_failed", { user_id: userId, order_id: order.id, message });
    return NextResponse.json({ error: "Fulfilment failed" }, { status: 500 });
  }
}
