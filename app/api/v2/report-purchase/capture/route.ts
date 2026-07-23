import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifySupabaseUser } from "@/lib/supabase/verifyRequest";
import { captureOrderRaw } from "@/lib/v2/paypal";
import { priceFor, type ModuleId } from "@/lib/v2/reportModules";
import { logV2 } from "@/lib/v2/log";

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function POST(req: NextRequest) {
  const auth = await verifySupabaseUser(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orderId } = await req.json() as { orderId?: string };
  if (!orderId) return NextResponse.json({ error: "orderId is required" }, { status: 400 });

  try {
    const { status, customId } = await captureOrderRaw(orderId);

    if (status !== "COMPLETED") {
      logV2.warn("v2_report_purchase_not_completed", { user_id: auth.userId, order_id: orderId, status });
      return NextResponse.json({ error: "Payment could not be verified" }, { status: 402 });
    }

    if (!customId) {
      // Idempotent double-submit (ORDER_ALREADY_CAPTURED) — the purchase row
      // from the first successful capture already exists, nothing new to write.
      return NextResponse.json({ status: "complete" });
    }

    const [userId, sessionId, modulesRaw] = customId.split("|");
    if (userId !== auth.userId) {
      logV2.error("v2_report_purchase_user_mismatch", { auth_user: auth.userId, order_user: userId, order_id: orderId });
      return NextResponse.json({ error: "Order does not belong to this account" }, { status: 403 });
    }

    const modules = modulesRaw.split(",") as ModuleId[];
    const amount = priceFor(modules);

    const supabase = serviceClient();
    const { error } = await supabase.from("report_purchases_v2").upsert({
      session_id: sessionId, user_id: auth.userId, modules, amount_paid: amount,
      provider: "paypal", provider_order_id: orderId,
    }, { onConflict: "session_id" });
    if (error) throw error;

    logV2.info("v2_report_purchase_completed", { user_id: auth.userId, session_id: sessionId, modules: modules.join(","), amount });
    return NextResponse.json({ status: "complete", modules });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logV2.error("v2_report_purchase_capture_failed", { user_id: auth.userId, order_id: orderId, message });
    return NextResponse.json({ error: "Payment verification failed — please contact support if you were charged" }, { status: 500 });
  }
}
