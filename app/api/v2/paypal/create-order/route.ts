import { NextRequest, NextResponse } from "next/server";
import { verifySupabaseUser } from "@/lib/supabase/verifyRequest";
import { createOrder, PLANS, type PlanId } from "@/lib/v2/paypal";
import { logV2 } from "@/lib/v2/log";

export async function POST(req: NextRequest) {
  const auth = await verifySupabaseUser(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { planId } = await req.json() as { planId?: PlanId };
  if (!planId || !(planId in PLANS)) return NextResponse.json({ error: "Invalid plan" }, { status: 400 });

  try {
    const { orderId } = await createOrder(planId, auth.userId);
    logV2.info("v2_paypal_order_created", { user_id: auth.userId, plan_id: planId, order_id: orderId });
    return NextResponse.json({ orderId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logV2.error("v2_paypal_order_create_failed", { user_id: auth.userId, message });
    return NextResponse.json({ error: "Payment service unavailable, try again shortly" }, { status: 502 });
  }
}
