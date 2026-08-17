// What happens *after* a payment is confirmed, independent of who took the
// money. Extracted from the PayPal capture routes when the Razorpay path was
// added: verifying a payment is provider-specific (PayPal capture semantics
// vs. Razorpay signature + order status), but everything downstream of "the
// money is confirmed" — which rows get written, what a combined report +
// consultation purchase implies, who gets told about a paid lead — is not.
// Keeping one copy is what stops the two providers drifting into writing
// subtly different purchase records.
//
// Note on `amount_paid`: it stays the USD list price for every provider, since
// the column has no companion currency and existing rows are all USD — making
// it provider-dependent would silently corrupt any revenue sum across the
// table. The rupees actually charged are recoverable from Razorpay via
// `provider_order_id`, and are logged at verification time.

import type { SupabaseClient } from "@supabase/supabase-js";
import { priceFor, DOCTOR_CONSULTATION_PRICE, type ModuleId } from "@/lib/v2/reportModules";
import { sendConsultationLead } from "@/lib/v2/consultationLead";
import { logV2 } from "@/lib/v2/log";

// "promo" is a server-validated code redemption (see
// app/api/report-purchase/redeem-promo), not a real payment — used for
// investor/sales demos where a real gateway charge isn't the point. It goes
// through the exact same fulfilment path as a paid order so nothing about
// report generation, email, or the purchased-modules gate has to know the
// difference.
export type PaymentProvider = "paypal" | "razorpay" | "promo";

export interface ReportPurchaseFulfilment {
  supabase: SupabaseClient;
  userId: string;
  sessionId: string;
  modules: ModuleId[];
  includeConsultation: boolean;
  contactPhone: string | null;
  provider: PaymentProvider;
  providerOrderId: string;
}

/**
 * Records a paid report purchase, plus the consultation that came bundled with
 * it when the buyer chose the combined checkout.
 *
 * Returns the USD amount written, for logging by the caller.
 */
export async function fulfilReportPurchase({
  supabase, userId, sessionId, modules, includeConsultation, contactPhone, provider, providerOrderId,
}: ReportPurchaseFulfilment): Promise<{ amount: number }> {
  const amount = priceFor(modules);

  const { error } = await supabase.from("report_purchases_v2").upsert({
    session_id: sessionId, user_id: userId, modules, amount_paid: amount,
    provider, provider_order_id: providerOrderId,
  }, { onConflict: "session_id" });
  if (error) throw error;

  // One payment covers both, one atomic combined checkout instead of the two
  // separate charges the "combo" path used to require. Written best-effort: if
  // this write fails, the report purchase above already succeeded and must not
  // be rolled back over it — log loudly instead.
  if (includeConsultation) {
    const { error: consultErr } = await supabase.from("doctor_consultations_v2").upsert({
      session_id: sessionId, user_id: userId,
      contact_phone: contactPhone,
      amount_paid: DOCTOR_CONSULTATION_PRICE, provider, provider_order_id: providerOrderId,
    }, { onConflict: "provider_order_id" });
    if (consultErr) {
      logV2.error("v2_combo_consultation_write_failed", { user_id: userId, session_id: sessionId, order_id: providerOrderId, provider, message: consultErr.message });
    }
    // A combo buyer is a paid consultation lead too, and previously nothing
    // told anyone about it, so the report email went out while the promised
    // callback had no owner.
    await sendConsultationLead({
      supabase, userId, sessionId,
      contactPhone,
      amountPaid: DOCTOR_CONSULTATION_PRICE, orderId: providerOrderId,
    });
  }

  return { amount };
}

export interface ConsultationFulfilment {
  supabase: SupabaseClient;
  userId: string;
  sessionId: string | null;
  contactPhone: string | null;
  provider: PaymentProvider;
  providerOrderId: string;
}

/**
 * Records a paid standalone consultation and hands the lead to a human.
 */
export async function fulfilConsultation({
  supabase, userId, sessionId, contactPhone, provider, providerOrderId,
}: ConsultationFulfilment): Promise<void> {
  const { error } = await supabase.from("doctor_consultations_v2").upsert({
    session_id: sessionId,
    user_id: userId,
    contact_phone: contactPhone,
    amount_paid: DOCTOR_CONSULTATION_PRICE,
    provider,
    provider_order_id: providerOrderId,
  }, { onConflict: "provider_order_id" });
  if (error) throw error;

  // Awaited but internally guarded, so a mail failure logs loudly without
  // failing a verification whose money already moved.
  await sendConsultationLead({
    supabase, userId, sessionId, contactPhone,
    amountPaid: DOCTOR_CONSULTATION_PRICE, orderId: providerOrderId,
  });
}
