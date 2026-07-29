import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logV2 } from "@/lib/v2/log";

const resend = new Resend(process.env.RESEND_API_KEY);

// Where paid consultation leads get sent. Without this set, a purchase still
// records correctly in doctor_consultations_v2 but nobody is told about it,
// which is how a paying customer ends up waiting on a call that was never
// scheduled. Logged loudly rather than failing silently for that reason.
const LEAD_INBOX = process.env.CONSULTATION_LEAD_EMAIL;

interface LeadInput {
  supabase: SupabaseClient;
  userId: string;
  sessionId: string | null;
  contactPhone: string | null;
  amountPaid: number;
  orderId: string;
}

/**
 * Notifies the team that someone paid for a dermatologist consultation, with
 * everything needed to actually make contact. Fire and forget: a mail failure
 * must never fail the payment capture, since the money has already moved and
 * the DB row is the source of truth.
 */
export async function sendConsultationLead(input: LeadInput): Promise<void> {
  const { supabase, userId, sessionId, contactPhone, amountPaid, orderId } = input;

  if (!LEAD_INBOX) {
    logV2.error("v2_consultation_lead_no_inbox", {
      user_id: userId, session_id: sessionId, order_id: orderId,
      message: "CONSULTATION_LEAD_EMAIL is not set, paid consultation lead was not delivered to anyone",
    });
    return;
  }

  try {
    const { data } = await supabase.auth.admin.getUserById(userId);
    const email = data.user?.email ?? "unknown";
    const name = (data.user?.user_metadata as { name?: string } | undefined)?.name ?? "Not provided";
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
    const reportLink = sessionId ? `${site}/report/${sessionId}` : "No scan attached (standalone consultation)";

    await resend.emails.send({
      from: "Glowmetry <noreply@superapp.digital>",
      to: LEAD_INBOX,
      replyTo: email !== "unknown" ? email : undefined,
      subject: `New consultation lead: ${name}`,
      html: `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#003934">
<h2 style="margin:0 0 16px">Paid consultation, contact within 24 hours</h2>
<table cellpadding="6" style="font-size:15px;border-collapse:collapse">
  <tr><td><strong>Name</strong></td><td>${name}</td></tr>
  <tr><td><strong>Email</strong></td><td><a href="mailto:${email}">${email}</a></td></tr>
  <tr><td><strong>Phone</strong></td><td>${contactPhone ?? "Not provided"}</td></tr>
  <tr><td><strong>Paid</strong></td><td>$${amountPaid}</td></tr>
  <tr><td><strong>Report</strong></td><td>${sessionId ? `<a href="${reportLink}">${reportLink}</a>` : reportLink}</td></tr>
  <tr><td><strong>Order</strong></td><td>${orderId}</td></tr>
</table>
<p style="font-size:13px;color:#4D6560">Mark this consultation <code>contacted</code> in doctor_consultations_v2 once you have reached them.</p>
</body></html>`,
    });

    logV2.info("v2_consultation_lead_sent", { user_id: userId, session_id: sessionId, order_id: orderId, has_phone: !!contactPhone });
  } catch (err) {
    // The purchase itself already succeeded, so this must not throw. It is
    // logged at error level because it means a real lead may go unworked.
    logV2.error("v2_consultation_lead_failed", {
      user_id: userId, session_id: sessionId, order_id: orderId,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
