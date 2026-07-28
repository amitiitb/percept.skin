import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifySupabaseUser } from "@/lib/supabase/verifyRequest";
import { captureOrder, PLANS, type PlanId } from "@/lib/v2/paypal";
import { logV2 } from "@/lib/v2/log";
import { checkRateLimit } from "@/lib/v2/rateLimit";

// Service-role client — subscriptions_v2 has NO insert/update policy for
// regular users by design (migration comment). Only this server-side path,
// after PayPal order verification, may flip a subscription to active.
function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function POST(req: NextRequest) {
  const auth = await verifySupabaseUser(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orderId } = await req.json() as { orderId?: string };
  if (!orderId) return NextResponse.json({ error: "orderId is required" }, { status: 400 });

  const withinLimit = await checkRateLimit(serviceClient(), auth.userId, "paypal_capture", 30, 600);
  if (!withinLimit) return NextResponse.json({ error: "Too many requests, try again in a few minutes" }, { status: 429 });

  try {
    const { status, planId, userId } = await captureOrder(orderId);

    if (status !== "COMPLETED") {
      logV2.warn("v2_paypal_capture_not_completed", { user_id: auth.userId, order_id: orderId, status });
      return NextResponse.json({ error: "Payment could not be verified" }, { status: 402 });
    }

    // Defense in depth: the custom_id round-tripped from create-order must match
    // the authenticated caller — a capture call can't activate someone else's account.
    if (userId && userId !== auth.userId) {
      logV2.error("v2_paypal_user_mismatch", { auth_user: auth.userId, order_user: userId, order_id: orderId });
      return NextResponse.json({ error: "Order does not belong to this account" }, { status: 403 });
    }

    const resolvedPlan: PlanId = (planId && planId in PLANS) ? planId : "monthly";
    const now = new Date();
    const periodEnd = new Date(now);
    if (resolvedPlan === "monthly") periodEnd.setMonth(periodEnd.getMonth() + 1);
    if (resolvedPlan === "quarterly") periodEnd.setMonth(periodEnd.getMonth() + 3);
    if (resolvedPlan === "annual") periodEnd.setFullYear(periodEnd.getFullYear() + 1);

    const supabase = serviceClient();
    const { error } = await supabase.from("subscriptions_v2").upsert({
      user_id: auth.userId, provider: "paypal", provider_subscription_id: orderId,
      plan: resolvedPlan, status: "active",
      current_period_start: now.toISOString(), current_period_end: periodEnd.toISOString(),
    }, { onConflict: "user_id" });
    if (error) throw error;

    await supabase.from("user_profiles_v2").update({ subscription_status: "active", subscription_plan: resolvedPlan }).eq("user_id", auth.userId);

    logV2.info("v2_subscription_activated", { user_id: auth.userId, order_id: orderId, plan: resolvedPlan });
    return NextResponse.json({ status: "active", plan: resolvedPlan });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logV2.error("v2_paypal_capture_failed", { user_id: auth.userId, order_id: orderId, message });
    return NextResponse.json({ error: "Payment verification failed. Please contact support if you were charged" }, { status: 500 });
  }
}
