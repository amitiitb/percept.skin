import { NextRequest, NextResponse } from "next/server";
import { logV2 } from "@/lib/v2/log";

// STUB — not production-ready. Present so the endpoint exists and the shape is
// clear, but signature verification is NOT implemented yet.
//
// TODO before production:
// - Verify the PayPal webhook signature (PAYPAL-TRANSMISSION-SIG header +
//   `/v1/notifications/verify-webhook-signature` API call) before trusting
//   ANY payload from this endpoint. Right now this route intentionally does
//   nothing with incoming events beyond logging, because an unverified
//   webhook is a spoofing vector (flagged in the eng review's threat model).
// - Handle BILLING.SUBSCRIPTION.RENEWED, .CANCELLED, .PAYMENT.FAILED events
// - Handle refund events (PAYMENT.CAPTURE.REFUNDED) — flip subscription to
//   cancelled and note the refund reason
// - Store PAYPAL_WEBHOOK_ID (from PayPal dashboard) as an env var for
//   signature verification
export async function POST(req: NextRequest) {
  const body = await req.text();
  logV2.warn("v2_paypal_webhook_received_unverified", { length: body.length });
  return NextResponse.json({ received: true, note: "signature verification not yet implemented — see TODO in route source" });
}
