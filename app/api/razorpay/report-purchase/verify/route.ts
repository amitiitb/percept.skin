import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifySupabaseUser } from "@/lib/supabase/verifyRequest";
import { verifyCheckoutSignature, waitForPaidOrder } from "@/lib/v2/razorpay";
import { fulfilReportPurchase } from "@/lib/v2/fulfilPurchase";
import { type ModuleId } from "@/lib/v2/reportModules";
import { logV2 } from "@/lib/v2/log";
import { checkRateLimit } from "@/lib/v2/rateLimit";

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// Rupee twin of app/api/report-purchase/capture (PayPal). Razorpay has no
// separate "capture" step for us to call — the order is auto-captured on the
// Razorpay side — so the equivalent server-side gate is: prove the success
// payload is genuine (signature), then confirm with Razorpay that the order is
// actually paid before anything is unlocked.
export async function POST(req: NextRequest) {
  const auth = await verifySupabaseUser(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json() as {
    razorpay_order_id?: string; razorpay_payment_id?: string; razorpay_signature?: string;
  };
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return NextResponse.json({ error: "razorpay_order_id, razorpay_payment_id and razorpay_signature are required" }, { status: 400 });
  }

  const withinLimit = await checkRateLimit(serviceClient(), auth.userId, "razorpay_report_purchase_verify", 30, 600);
  if (!withinLimit) return NextResponse.json({ error: "Too many requests, try again in a few minutes" }, { status: 429 });

  try {
    // Gate one: only the holder of the key secret can produce this HMAC, so a
    // forged "payment succeeded" POST dies here without ever reaching Razorpay
    // or the database.
    if (!verifyCheckoutSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
      logV2.error("v2_razorpay_report_purchase_signature_mismatch", { user_id: auth.userId, order_id: razorpay_order_id, payment_id: razorpay_payment_id });
      return NextResponse.json({ error: "Payment could not be verified" }, { status: 400 });
    }

    // Gate two: the signature proves this payment belongs to this order, not
    // that the order was paid in full. Only Razorpay can say that, and it is
    // also the trustworthy source of the notes written at order-creation time.
    const order = await waitForPaidOrder(razorpay_order_id);
    if (order.status !== "paid") {
      logV2.warn("v2_razorpay_report_purchase_not_paid", { user_id: auth.userId, order_id: razorpay_order_id, status: order.status });
      return NextResponse.json({ error: "Payment could not be verified" }, { status: 402 });
    }

    const notes = order.notes ?? {};
    const userId = notes.user_id;
    const sessionId = notes.session_id;
    const modulesRaw = notes.modules;
    if (!userId || !sessionId || !modulesRaw) {
      // Only reachable if an order was created outside this route, or if notes
      // were lost. Never unlock on a guess — the money moved, so this needs a
      // human, not a silent success.
      logV2.error("v2_razorpay_report_purchase_notes_missing", { user_id: auth.userId, order_id: razorpay_order_id });
      return NextResponse.json({ error: "Payment verification failed. Please contact support if you were charged" }, { status: 500 });
    }

    if (userId !== auth.userId) {
      logV2.error("v2_razorpay_report_purchase_user_mismatch", { auth_user: auth.userId, order_user: userId, order_id: razorpay_order_id });
      return NextResponse.json({ error: "Order does not belong to this account" }, { status: 403 });
    }

    const modules = modulesRaw.split(",") as ModuleId[];
    const includeConsultation = notes.include_consultation === "1";
    const contactPhone = notes.contact_phone ? notes.contact_phone : null;

    const { amount } = await fulfilReportPurchase({
      supabase: serviceClient(),
      userId: auth.userId,
      sessionId,
      modules,
      includeConsultation,
      contactPhone,
      provider: "razorpay",
      providerOrderId: razorpay_order_id,
    });

    logV2.info("v2_razorpay_report_purchase_completed", {
      user_id: auth.userId, session_id: sessionId, modules: modules.join(","),
      amount, amount_paise: order.amount, include_consultation: includeConsultation,
      order_id: razorpay_order_id, payment_id: razorpay_payment_id,
    });

    return NextResponse.json({ status: "complete", modules, includeConsultation });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logV2.error("v2_razorpay_report_purchase_verify_failed", { user_id: auth.userId, order_id: razorpay_order_id, message });
    return NextResponse.json({ error: "Payment verification failed. Please contact support if you were charged" }, { status: 500 });
  }
}
