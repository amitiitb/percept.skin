import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifySupabaseUser } from "@/lib/supabase/verifyRequest";
import { verifyCheckoutSignature, fetchOrder } from "@/lib/v2/razorpay";
import { fulfilConsultation } from "@/lib/v2/fulfilPurchase";
import { logV2 } from "@/lib/v2/log";
import { checkRateLimit } from "@/lib/v2/rateLimit";

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// Rupee twin of app/api/consultation/capture (PayPal). See the report-purchase
// verify route for why both the signature and the order status are checked.
export async function POST(req: NextRequest) {
  const auth = await verifySupabaseUser(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json() as {
    razorpay_order_id?: string; razorpay_payment_id?: string; razorpay_signature?: string;
  };
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return NextResponse.json({ error: "razorpay_order_id, razorpay_payment_id and razorpay_signature are required" }, { status: 400 });
  }

  const withinLimit = await checkRateLimit(serviceClient(), auth.userId, "razorpay_consultation_verify", 30, 600);
  if (!withinLimit) return NextResponse.json({ error: "Too many requests, try again in a few minutes" }, { status: 429 });

  try {
    if (!verifyCheckoutSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
      logV2.error("v2_razorpay_consultation_signature_mismatch", { user_id: auth.userId, order_id: razorpay_order_id, payment_id: razorpay_payment_id });
      return NextResponse.json({ error: "Payment could not be verified" }, { status: 400 });
    }

    const order = await fetchOrder(razorpay_order_id);
    if (order.status !== "paid") {
      logV2.warn("v2_razorpay_consultation_not_paid", { user_id: auth.userId, order_id: razorpay_order_id, status: order.status });
      return NextResponse.json({ error: "Payment could not be verified" }, { status: 402 });
    }

    const notes = order.notes ?? {};
    const userId = notes.user_id;
    if (!userId) {
      logV2.error("v2_razorpay_consultation_notes_missing", { user_id: auth.userId, order_id: razorpay_order_id });
      return NextResponse.json({ error: "Payment verification failed. Please contact support if you were charged" }, { status: 500 });
    }
    if (userId !== auth.userId) {
      logV2.error("v2_razorpay_consultation_user_mismatch", { auth_user: auth.userId, order_user: userId, order_id: razorpay_order_id });
      return NextResponse.json({ error: "Order does not belong to this account" }, { status: 403 });
    }

    await fulfilConsultation({
      supabase: serviceClient(),
      userId: auth.userId,
      sessionId: notes.session_id ? notes.session_id : null,
      contactPhone: notes.contact_phone ? notes.contact_phone : null,
      provider: "razorpay",
      providerOrderId: razorpay_order_id,
    });

    logV2.info("v2_razorpay_consultation_completed", {
      user_id: auth.userId, order_id: razorpay_order_id, payment_id: razorpay_payment_id, amount_paise: order.amount,
    });
    return NextResponse.json({ status: "complete" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logV2.error("v2_razorpay_consultation_verify_failed", { user_id: auth.userId, order_id: razorpay_order_id, message });
    return NextResponse.json({ error: "Payment verification failed. Please contact support if you were charged" }, { status: 500 });
  }
}
