import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifySupabaseUser } from "@/lib/supabase/verifyRequest";
import { captureOrderRaw } from "@/lib/v2/paypal";
import { DOCTOR_CONSULTATION_PRICE } from "@/lib/v2/reportModules";
import { logV2 } from "@/lib/v2/log";
import { checkRateLimit } from "@/lib/v2/rateLimit";

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function POST(req: NextRequest) {
  const auth = await verifySupabaseUser(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orderId } = await req.json() as { orderId?: string };
  if (!orderId) return NextResponse.json({ error: "orderId is required" }, { status: 400 });

  const withinLimit = await checkRateLimit(serviceClient(), auth.userId, "consultation_capture", 30, 600);
  if (!withinLimit) return NextResponse.json({ error: "Too many requests, try again in a few minutes" }, { status: 429 });

  try {
    const { status, customId } = await captureOrderRaw(orderId);

    if (status !== "COMPLETED") {
      logV2.warn("v2_consultation_not_completed", { user_id: auth.userId, order_id: orderId, status });
      return NextResponse.json({ error: "Payment could not be verified" }, { status: 402 });
    }

    if (!customId) {
      // Expected only via the 422 ORDER_ALREADY_CAPTURED branch in
      // captureOrderRaw (real double-submit, row already exists). Reaching
      // here on a fresh 200 capture means custom_id didn't come back on the
      // response — log loudly rather than silently assuming success, since
      // that exact gap once caused a real captured payment to leave zero
      // purchase row (fixed by adding Prefer: return=representation, but
      // this stays as a tripwire in case PayPal's response shape changes again).
      logV2.warn("v2_consultation_capture_empty_custom_id", { user_id: auth.userId, order_id: orderId, status });
      return NextResponse.json({ status: "complete" });
    }

    const [userId, sessionIdRaw, contactPhoneRaw] = customId.split("|");
    if (userId !== auth.userId) {
      logV2.error("v2_consultation_user_mismatch", { auth_user: auth.userId, order_user: userId, order_id: orderId });
      return NextResponse.json({ error: "Order does not belong to this account" }, { status: 403 });
    }

    const supabase = serviceClient();
    const { error } = await supabase.from("doctor_consultations_v2").upsert({
      session_id: sessionIdRaw === "-" ? null : sessionIdRaw,
      user_id: auth.userId,
      contact_phone: contactPhoneRaw === "-" ? null : contactPhoneRaw,
      amount_paid: DOCTOR_CONSULTATION_PRICE,
      provider: "paypal",
      provider_order_id: orderId,
    }, { onConflict: "provider_order_id" });
    if (error) throw error;

    logV2.info("v2_consultation_completed", { user_id: auth.userId, order_id: orderId });
    return NextResponse.json({ status: "complete" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logV2.error("v2_consultation_capture_failed", { user_id: auth.userId, order_id: orderId, message });
    return NextResponse.json({ error: "Payment verification failed. Please contact support if you were charged" }, { status: 500 });
  }
}
