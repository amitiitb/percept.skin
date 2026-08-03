import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { verifySupabaseUser } from "@/lib/supabase/verifyRequest";
import { captureOrderRaw } from "@/lib/v2/paypal";
import { priceFor, DOCTOR_CONSULTATION_PRICE, type ModuleId } from "@/lib/v2/reportModules";
import { logV2 } from "@/lib/v2/log";
import { checkRateLimit } from "@/lib/v2/rateLimit";
import { sendConsultationLead } from "@/lib/v2/consultationLead";

const resend = new Resend(process.env.RESEND_API_KEY);

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

function buildReportReadyEmail(sessionId: string, consultationIncluded: boolean): string {
  const upsellHtml = consultationIncluded
    ? `<p style="margin-bottom:0">Your dermatologist consultation is included, our team will reach out within 24 hours with a real plan.</p>`
    : `<p style="margin-bottom:0">Want a real dermatologist's take too? Add a consultation for just $${DOCTOR_CONSULTATION_PRICE}, a certified dermatologist reviews your case and follows up directly.</p>`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Your Percept report is ready</title>
<style>
  body { margin:0; padding:0; background:#E8E7E5; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; color:#003934; }
  .wrap { max-width:560px; margin:0 auto; padding:48px 24px; }
  .logo { font-size:22px; font-weight:600; letter-spacing:-0.02em; color:#003934; }
  .logo span { color:#1A9E8F; }
  .card { background:#fff; border:1px solid #D6D3CD; border-radius:12px; padding:48px 40px; margin-top:32px; }
  h1 { font-size:26px; font-weight:300; line-height:1.2; letter-spacing:-0.02em; margin:0 0 12px; }
  p { font-size:15px; line-height:1.65; color:#4D6560; margin:0 0 24px; }
  .btn { display:inline-block; background:#003934; color:#fff; font-size:16px; font-weight:500; padding:16px 36px; border-radius:9999px; text-decoration:none; letter-spacing:-0.01em; }
  .upsell { margin-top:8px; padding-top:24px; border-top:1px solid #D6D3CD; }
  .footer { margin-top:40px; font-size:12px; color:#8C9B97; }
</style>
</head>
<body>
<div class="wrap">
  <div class="logo">Percept</div>
  <div class="card">
    <h1>Your report is ready.</h1>
    <p>Your Percept Score and full breakdown are ready to view now.</p>
    <a href="${process.env.NEXT_PUBLIC_SITE_URL}/report/${sessionId}" class="btn">View my report →</a>
    <div class="upsell">
      ${upsellHtml}
    </div>
  </div>
  <div class="footer">
    © 2026 Percept · AI-powered skin analysis
  </div>
</div>
</body>
</html>`;
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

    // Confirmation email, fire and forget, never blocks the response. The
    // report page itself already handles "still finishing" gracefully (polls
    // until analyse completes), so it's fine if this lands slightly before
    // the analysis is fully done.
    supabase.auth.admin.getUserById(auth.userId).then(({ data }) => {
      const email = data.user?.email;
      if (!email) return;
      return resend.emails.send({
        from: "Percept <noreply@superapp.digital>",
        to: email,
        subject: "Your Percept report is ready",
        html: buildReportReadyEmail(sessionId, includeConsultation),
      });
    }).catch(() => { /* non-fatal */ });

    return NextResponse.json({ status: "complete", modules, includeConsultation });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logV2.error("v2_report_purchase_capture_failed", { user_id: auth.userId, order_id: orderId, message });
    return NextResponse.json({ error: "Payment verification failed. Please contact support if you were charged" }, { status: 500 });
  }
}
