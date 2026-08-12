import { NextRequest, NextResponse } from "next/server";
import { verifySupabaseUser } from "@/lib/supabase/verifyRequest";
import { createOrder, RazorpayApiError } from "@/lib/v2/razorpay";
import { usdToPaise } from "@/lib/v2/inrPricing";
import { MODULES, priceFor, DOCTOR_CONSULTATION_PRICE, type ModuleId } from "@/lib/v2/reportModules";
import { logV2 } from "@/lib/v2/log";

// Rupee twin of app/api/report-purchase/create-order (PayPal/USD). Same
// validation rules, same request body — only the provider and currency differ,
// so the bundle page can offer either without a second set of client rules.
export async function POST(req: NextRequest) {
  const auth = await verifySupabaseUser(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId, modules, includeConsultation, contactPhone } = await req.json() as {
    sessionId?: string; modules?: ModuleId[]; includeConsultation?: boolean; contactPhone?: string;
  };
  if (!sessionId || !modules?.length) return NextResponse.json({ error: "sessionId and at least one module are required" }, { status: 400 });

  const validIds = new Set(MODULES.map((m) => m.id));
  if (!modules.every((m) => validIds.has(m))) return NextResponse.json({ error: "Invalid module selection" }, { status: 400 });

  // Same rule as every other order route: if this purchase includes a
  // consultation, a reachable phone number is mandatory before charging.
  if (includeConsultation && (!contactPhone || contactPhone.trim().length < 6)) {
    return NextResponse.json({ error: "A phone number is required so the dermatologist can reach you" }, { status: 400 });
  }

  const amountUsd = priceFor(modules) + (includeConsultation ? DOCTOR_CONSULTATION_PRICE : 0);
  const amountPaise = usdToPaise(amountUsd);

  // Razorpay caps `receipt` at 40 chars, so the session uuid can't go in whole
  // — the full id lives in `notes` below, which is what verification reads.
  const receipt = `rpt_${sessionId.slice(0, 8)}_${Date.now().toString(36)}`;

  // notes round-trips user + session + module selection + the combined-purchase
  // consultation flag/phone, so verification doesn't have to trust a second
  // client-supplied payload — same defence-in-depth as the PayPal custom_id.
  const notes: Record<string, string> = {
    kind: "report_purchase",
    user_id: auth.userId,
    session_id: sessionId,
    modules: modules.join(","),
    include_consultation: includeConsultation ? "1" : "0",
    contact_phone: contactPhone?.trim() ?? "",
  };

  try {
    const order = await createOrder(amountPaise, receipt, notes);
    logV2.info("v2_razorpay_report_purchase_order_created", {
      user_id: auth.userId, session_id: sessionId, modules: modules.join(","),
      amount_usd: amountUsd, amount_paise: amountPaise,
      include_consultation: !!includeConsultation, order_id: order.id,
    });
    // amount/currency come back from Razorpay rather than being echoed from the
    // request, so the modal always opens on the figure the order was actually
    // created for.
    return NextResponse.json({ orderId: order.id, amount: order.amount, currency: order.currency });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logV2.error("v2_razorpay_report_purchase_order_create_failed", { user_id: auth.userId, session_id: sessionId, message });
    // A bad/missing key pair is our misconfiguration, not a transient outage —
    // surfacing it as 401 keeps it out of the "try again shortly" bucket that
    // would otherwise have users retrying a payment that can never succeed.
    if (err instanceof RazorpayApiError && err.status === 401) {
      return NextResponse.json({ error: "Payment service is not configured correctly" }, { status: 401 });
    }
    return NextResponse.json({ error: "Payment service unavailable, try again shortly" }, { status: 500 });
  }
}
