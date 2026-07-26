import { NextRequest, NextResponse } from "next/server";
import { verifySupabaseUser } from "@/lib/supabase/verifyRequest";
import { createCustomOrder } from "@/lib/v2/paypal";
import { MODULES, priceFor, type ModuleId } from "@/lib/v2/reportModules";
import { logV2 } from "@/lib/v2/log";

export async function POST(req: NextRequest) {
  const auth = await verifySupabaseUser(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId, modules } = await req.json() as { sessionId?: string; modules?: ModuleId[] };
  if (!sessionId || !modules?.length) return NextResponse.json({ error: "sessionId and at least one module are required" }, { status: 400 });

  const validIds = new Set(MODULES.map((m) => m.id));
  if (!modules.every((m) => validIds.has(m))) return NextResponse.json({ error: "Invalid module selection" }, { status: 400 });

  const amount = priceFor(modules);
  // custom_id round-trips user + session + module selection so capture doesn't
  // have to trust a second client-supplied payload — same defense-in-depth
  // pattern as the subscription order flow.
  const customId = `${auth.userId}|${sessionId}|${modules.join(",")}`;

  try {
    const { orderId } = await createCustomOrder(amount, `Glowmetry Report: ${modules.length === MODULES.length ? "Complete Bundle" : modules.join(", ")}`, customId);
    logV2.info("v2_report_purchase_order_created", { user_id: auth.userId, session_id: sessionId, modules: modules.join(","), amount, order_id: orderId });
    return NextResponse.json({ orderId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logV2.error("v2_report_purchase_order_create_failed", { user_id: auth.userId, session_id: sessionId, message });
    return NextResponse.json({ error: "Payment service unavailable, try again shortly" }, { status: 502 });
  }
}
