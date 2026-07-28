import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { verifySupabaseUser } from "@/lib/supabase/verifyRequest";
import { captureOrderRaw } from "@/lib/v2/paypal";
import { priceFor, DOCTOR_CONSULTATION_PRICE, type ModuleId } from "@/lib/v2/reportModules";
import { logV2 } from "@/lib/v2/log";

const resend = new Resend(process.env.RESEND_API_KEY);

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

function buildReportReadyEmail(sessionId: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Your Glowmetry report is ready</title>
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
  <div class="logo">Glow<span>metry</span></div>
  <div class="card">
    <h1>Your report is ready.</h1>
    <p>Your Glow Score and full breakdown are ready to view now.</p>
    <a href="${process.env.NEXT_PUBLIC_SITE_URL}/v2/report/${sessionId}" class="btn">View my report →</a>
    <div class="upsell">
      <p style="margin-bottom:0">Want a real dermatologist's take too? Add a consultation for just $${DOCTOR_CONSULTATION_PRICE}, a certified dermatologist reviews your case and follows up directly.</p>
    </div>
  </div>
  <div class="footer">
    © 2026 Glowmetry · AI-powered skin analysis
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

    // Confirmation email, fire and forget, never blocks the response. The
    // report page itself already handles "still finishing" gracefully (polls
    // until analyse completes), so it's fine if this lands slightly before
    // the analysis is fully done.
    supabase.auth.admin.getUserById(auth.userId).then(({ data }) => {
      const email = data.user?.email;
      if (!email) return;
      return resend.emails.send({
        from: "Glowmetry <noreply@superapp.digital>",
        to: email,
        subject: "Your Glowmetry report is ready",
        html: buildReportReadyEmail(sessionId),
      });
    }).catch(() => { /* non-fatal */ });

    return NextResponse.json({ status: "complete", modules });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logV2.error("v2_report_purchase_capture_failed", { user_id: auth.userId, order_id: orderId, message });
    return NextResponse.json({ error: "Payment verification failed. Please contact support if you were charged" }, { status: 500 });
  }
}
