import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifySupabaseUser } from "@/lib/supabase/verifyRequest";
import { captureOrderRaw } from "@/lib/v2/paypal";
import { priceFor, DOCTOR_CONSULTATION_PRICE, type ModuleId } from "@/lib/v2/reportModules";
import { logV2 } from "@/lib/v2/log";
import { checkRateLimit } from "@/lib/v2/rateLimit";
import { sendConsultationLead } from "@/lib/v2/consultationLead";

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function POST(req: NextRequest) {
  const auth = await verifySupabaseUser(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orderId } = await req.json() as { orderId?: string };
  if (!orderId) return NextResponse.json({ error: "orderId is required" }, { status: 400 });

  const withinLimit = await checkRateLimit(serviceClient(), auth.userId, "report_purchase_capture", 30, 600);
  if (!withinLimit) return NextResponse.json({ error: "Too many requests, try again in a few minutes" }, { status: 429 });

  try {
    const { status, customId } = await captureOrderRaw(orderId);

    if (status !== "COMPLETED") {
      logV2.warn("v2_report_purchase_not_completed", { user_id: auth.userId, order_id: orderId, status });
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
      logV2.warn("v2_report_purchase_capture_empty_custom_id", { user_id: auth.userId, order_id: orderId, status });
      return NextResponse.json({ status: "complete" });
    }

    // consultFlag/contactPhoneRaw are absent on any order created before this
    // combined-purchase option existed — undefined splits to "-", read as
    // "no consultation", so old in-flight orders still capture correctly.
    const [userId, sessionId, modulesRaw, consultFlag, contactPhoneRaw] = customId.split("|");
    if (userId !== auth.userId) {
      logV2.error("v2_report_purchase_user_mismatch", { auth_user: auth.userId, order_user: userId, order_id: orderId });
      return NextResponse.json({ error: "Order does not belong to this account" }, { status: 403 });
    }

    const modules = modulesRaw.split(",") as ModuleId[];
    const amount = priceFor(modules);
    const includeConsultation = consultFlag === "1";

    const supabase = serviceClient();
    const { error } = await supabase.from("report_purchases_v2").upsert({
      session_id: sessionId, user_id: auth.userId, modules, amount_paid: amount,
      provider: "paypal", provider_order_id: orderId,
    }, { onConflict: "session_id" });
    if (error) throw error;

    // Same PayPal order pays for both, one atomic combined checkout instead
    // of the two separate charges the "combo" path used to require. Written
    // best-effort: if this write fails, the report purchase above already
    // succeeded and must not be rolled back over it, log loudly instead.
    if (includeConsultation) {
      const { error: consultErr } = await supabase.from("doctor_consultations_v2").upsert({
        session_id: sessionId, user_id: auth.userId,
        contact_phone: contactPhoneRaw && contactPhoneRaw !== "-" ? contactPhoneRaw : null,
        amount_paid: DOCTOR_CONSULTATION_PRICE, provider: "paypal", provider_order_id: orderId,
      }, { onConflict: "provider_order_id" });
      if (consultErr) {
        logV2.error("v2_combo_consultation_write_failed", { user_id: auth.userId, session_id: sessionId, order_id: orderId, message: consultErr.message });
      }
      // A combo buyer is a paid consultation lead too, and previously nothing
      // told anyone about it, so the report email went out while the promised
      // callback had no owner.
      await sendConsultationLead({
        supabase, userId: auth.userId, sessionId,
        contactPhone: contactPhoneRaw && contactPhoneRaw !== "-" ? contactPhoneRaw : null,
        amountPaid: DOCTOR_CONSULTATION_PRICE, orderId,
      });
    }

    logV2.info("v2_report_purchase_completed", { user_id: auth.userId, session_id: sessionId, modules: modules.join(","), amount, include_consultation: includeConsultation });

    return NextResponse.json({ status: "complete", modules, includeConsultation });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logV2.error("v2_report_purchase_capture_failed", { user_id: auth.userId, order_id: orderId, message });
    return NextResponse.json({ error: "Payment verification failed. Please contact support if you were charged" }, { status: 500 });
  }
}
