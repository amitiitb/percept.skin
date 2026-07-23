import { NextRequest, NextResponse } from "next/server";
import { verifySupabaseUser } from "@/lib/supabase/verifyRequest";
import { createCustomOrder } from "@/lib/v2/paypal";
import { DOCTOR_CONSULTATION_PRICE } from "@/lib/v2/reportModules";
import { logV2 } from "@/lib/v2/log";

export async function POST(req: NextRequest) {
  const auth = await verifySupabaseUser(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId, contactPhone } = await req.json() as { sessionId?: string; contactPhone?: string };

  // custom_id round-trips user + session + phone so capture doesn't have to
  // trust a second client-supplied payload — same pattern as report-purchase.
  // "-" placeholders keep the pipe-delimited shape stable when a field is absent.
  const customId = `${auth.userId}|${sessionId ?? "-"}|${contactPhone ?? "-"}`;

  try {
    const { orderId } = await createCustomOrder(DOCTOR_CONSULTATION_PRICE, "Glowmetry — Doctor Consultation", customId);
    logV2.info("v2_consultation_order_created", { user_id: auth.userId, session_id: sessionId, order_id: orderId });
    return NextResponse.json({ orderId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logV2.error("v2_consultation_order_create_failed", { user_id: auth.userId, message });
    return NextResponse.json({ error: "Payment service unavailable — try again shortly" }, { status: 502 });
  }
}
