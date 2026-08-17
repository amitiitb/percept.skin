import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import { verifySupabaseUser } from "@/lib/supabase/verifyRequest";
import { fulfilReportPurchase } from "@/lib/v2/fulfilPurchase";
import { type ModuleId } from "@/lib/v2/reportModules";
import { checkRateLimit } from "@/lib/v2/rateLimit";
import { logV2 } from "@/lib/v2/log";

// Unlocks a report without a real payment, for investor/sales demos where
// walking the real checkout UI matters but a real gateway charge does not.
// Deliberately NOT "make the price ₹0/$0 through Razorpay or PayPal" —
// neither accepts a zero-amount order (Razorpay rejects anything under 100
// paise, PayPal requires a positive amount), so this bypasses the gateway
// entirely rather than trying to force one through it. It calls the exact
// same fulfilReportPurchase() the webhooks and verify routes call, so
// report generation, email, and the purchased-modules gate all behave
// identically to a real purchase — the only difference is provider:"promo"
// on the row, which the invoice generator (lib/v2/reportReadyEmail.ts)
// reads to print "no charge was made" instead of a fabricated amount.
//
// Requires REPORT_DEMO_PROMO_CODE to be set (server-only, never
// NEXT_PUBLIC_) — with it unset, every redemption attempt is rejected
// rather than silently accepted, same fail-closed shape as the webhook
// signature checks.

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// Constant-time compare so a brute-force attempt can't learn how many
// leading characters it got right from response timing.
function safeCodeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function POST(req: NextRequest) {
  const auth = await verifySupabaseUser(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId, modules, includeConsultation, contactPhone, code } = await req.json() as {
    sessionId?: string; modules?: ModuleId[]; includeConsultation?: boolean;
    contactPhone?: string; code?: string;
  };
  if (!sessionId || !modules?.length || !code) {
    return NextResponse.json({ error: "sessionId, modules and code are required" }, { status: 400 });
  }

  const supabase = serviceClient();

  // Tight limit — this endpoint exists to be guessed against, unlike a
  // normal purchase flow. 5 attempts per 10 minutes per account.
  const withinLimit = await checkRateLimit(supabase, auth.userId, "redeem_promo", 5, 600);
  if (!withinLimit) return NextResponse.json({ error: "Too many attempts, try again in a few minutes" }, { status: 429 });

  const validCode = process.env.REPORT_DEMO_PROMO_CODE;
  if (!validCode) {
    logV2.error("v2_redeem_promo_not_configured", { user_id: auth.userId });
    return NextResponse.json({ error: "Promo codes are not enabled" }, { status: 503 });
  }

  if (!safeCodeEquals(code.trim(), validCode)) {
    logV2.warn("v2_redeem_promo_invalid_code", { user_id: auth.userId, session_id: sessionId });
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  // Owns the session, same check every purchase route makes before
  // unlocking anything.
  const { data: session } = await supabase.from("analysis_sessions_v2")
    .select("id").eq("id", sessionId).eq("user_id", auth.userId).maybeSingle();
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  try {
    // Unique per session (report_purchases_v2 upserts on session_id anyway,
    // so this only has to be a stable, readable marker, not globally unique).
    const providerOrderId = `promo_${sessionId}`;
    const { amount } = await fulfilReportPurchase({
      supabase,
      userId: auth.userId,
      sessionId,
      modules,
      includeConsultation: !!includeConsultation,
      contactPhone: contactPhone ? contactPhone.trim() : null,
      provider: "promo",
      providerOrderId,
    });

    logV2.info("v2_redeem_promo_completed", {
      user_id: auth.userId, session_id: sessionId, modules: modules.join(","),
      list_amount_usd: amount, include_consultation: !!includeConsultation,
    });

    return NextResponse.json({ status: "complete", modules, includeConsultation: !!includeConsultation });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logV2.error("v2_redeem_promo_failed", { user_id: auth.userId, session_id: sessionId, message });
    return NextResponse.json({ error: "Could not redeem code, please try again" }, { status: 500 });
  }
}
