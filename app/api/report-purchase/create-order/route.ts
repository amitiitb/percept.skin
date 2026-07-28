import { NextRequest, NextResponse } from "next/server";
import { verifySupabaseUser } from "@/lib/supabase/verifyRequest";
import { createCustomOrder } from "@/lib/v2/paypal";
import { MODULES, priceFor, DOCTOR_CONSULTATION_PRICE, type ModuleId } from "@/lib/v2/reportModules";
import { logV2 } from "@/lib/v2/log";

export async function POST(req: NextRequest) {
  const auth = await verifySupabaseUser(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId, modules, includeConsultation, contactPhone } = await req.json() as {
    sessionId?: string; modules?: ModuleId[]; includeConsultation?: boolean; contactPhone?: string;
  };
  if (!sessionId || !modules?.length) return NextResponse.json({ error: "sessionId and at least one module are required" }, { status: 400 });

  const validIds = new Set(MODULES.map((m) => m.id));
  if (!modules.every((m) => validIds.has(m))) return NextResponse.json({ error: "Invalid module selection" }, { status: 400 });

  const reportAmount = priceFor(modules);
  const amount = reportAmount + (includeConsultation ? DOCTOR_CONSULTATION_PRICE : 0);
  // custom_id round-trips user + session + module selection + (optionally) the
  // combined-purchase consultation flag/phone, so capture doesn't have to trust
  // a second client-supplied payload — same defense-in-depth pattern as the
  // subscription order flow. "0"/"-" keep the pipe-delimited shape stable when
  // a combo purchase wasn't requested (plain report-only order).
  const customId = `${auth.userId}|${sessionId}|${modules.join(",")}|${includeConsultation ? "1" : "0"}|${contactPhone ?? "-"}`;

  try {
    const description = `Glowmetry Report: ${modules.length === MODULES.length ? "Complete Bundle" : modules.join(", ")}${includeConsultation ? " + Doctor Consultation" : ""}`;
    const { orderId } = await createCustomOrder(amount, description, customId);
    logV2.info("v2_report_purchase_order_created", { user_id: auth.userId, session_id: sessionId, modules: modules.join(","), amount, include_consultation: !!includeConsultation, order_id: orderId });
    return NextResponse.json({ orderId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logV2.error("v2_report_purchase_order_create_failed", { user_id: auth.userId, session_id: sessionId, message });
    return NextResponse.json({ error: "Payment service unavailable, try again shortly" }, { status: 502 });
  }
}
