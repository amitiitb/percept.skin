import { NextRequest, NextResponse } from "next/server";
import { verifySupabaseUser } from "@/lib/supabase/verifyRequest";
import { createOrder, RazorpayApiError } from "@/lib/v2/razorpay";
import { usdToPaise } from "@/lib/v2/inrPricing";
import { DOCTOR_CONSULTATION_PRICE } from "@/lib/v2/reportModules";
import { logV2 } from "@/lib/v2/log";

// Rupee twin of app/api/consultation/create-order (PayPal/USD).
export async function POST(req: NextRequest) {
  const auth = await verifySupabaseUser(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId, contactPhone } = await req.json() as { sessionId?: string; contactPhone?: string };

  // Enforced server-side, not only in the form: a paid consultation with no
  // phone number is a lead nobody can act on, and by verification time the user
  // has already been charged.
  if (!contactPhone || contactPhone.trim().length < 6) {
    return NextResponse.json({ error: "A phone number is required so the dermatologist can reach you" }, { status: 400 });
  }

  const amountPaise = usdToPaise(DOCTOR_CONSULTATION_PRICE);
  const receipt = `con_${(sessionId ?? "none").slice(0, 8)}_${Date.now().toString(36)}`;

  const notes: Record<string, string> = {
    kind: "consultation",
    user_id: auth.userId,
    session_id: sessionId ?? "",
    contact_phone: contactPhone.trim(),
  };

  try {
    const order = await createOrder(amountPaise, receipt, notes);
    logV2.info("v2_razorpay_consultation_order_created", {
      user_id: auth.userId, session_id: sessionId,
      amount_usd: DOCTOR_CONSULTATION_PRICE, amount_paise: amountPaise, order_id: order.id,
    });
    return NextResponse.json({ orderId: order.id, amount: order.amount, currency: order.currency });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logV2.error("v2_razorpay_consultation_order_create_failed", { user_id: auth.userId, message });
    if (err instanceof RazorpayApiError && err.status === 401) {
      return NextResponse.json({ error: "Payment service is not configured correctly" }, { status: 401 });
    }
    return NextResponse.json({ error: "Payment service unavailable, try again shortly" }, { status: 500 });
  }
}
