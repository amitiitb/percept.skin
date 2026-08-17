import { SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { jsPDF } from "jspdf";
import { logV2 } from "@/lib/v2/log";
import { DOCTOR_CONSULTATION_PRICE, moduleLabel, type ModuleId } from "@/lib/v2/reportModules";
import { usdToPaise } from "@/lib/v2/inrPricing";
import { fetchOrder as fetchRazorpayOrder } from "@/lib/v2/razorpay";
import { PAYPAL_ENVIRONMENT } from "@/lib/v2/paypal";

// Extracted from app/api/report-preparation/complete/route.ts so both the
// live browser-driven flow and the abandoned-report cron sweep
// (app/api/cron/finish-abandoned-reports/route.ts) send the exact same
// email from one place, instead of two copies drifting apart.

const resend = new Resend(process.env.RESEND_API_KEY);

function safeFilePart(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

function reportFilename(name: string, createdAt: string) {
  const date = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    .format(new Date(createdAt)).replace(/\s+/g, "-");
  return ["Percept-Report", safeFilePart(name), date].filter(Boolean).join("-") + ".pdf";
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
}

type MetricRow = { category: string; metric_name: string; score: number | null; label: string | null; recommendation: string | null };

function buildPdf(name: string, session: { overall_score: number | null; skin_age: number | null; created_at: string }, metrics: MetricRow[], modules: ModuleId[]) {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const width = pdf.internal.pageSize.getWidth();
  const margin = 48;
  let y = 58;
  const line = (text: string, size: number, colour = "#334F47", weight: "normal" | "bold" = "normal") => {
    pdf.setFont("helvetica", weight); pdf.setFontSize(size); pdf.setTextColor(colour);
    const rows = pdf.splitTextToSize(text, width - margin * 2) as string[];
    pdf.text(rows, margin, y); y += rows.length * size * 1.35;
  };
  const ensure = (height: number) => { if (y + height > 790) { pdf.addPage(); y = 52; } };

  pdf.setFillColor("#0D3028"); pdf.roundedRect(30, 28, width - 60, 150, 14, 14, "F");
  y = 65; line("PERCEPT", 12, "#70E1CD", "bold");
  line(`${name || "Your"} personalised report`, 26, "#FFFFFF", "bold");
  line(new Date(session.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }), 11, "#D7E7E2");
  y = 215;
  line(`${session.overall_score ?? "—"} / 100`, 34, "#0D3028", "bold");
  line("Percept Score", 13, "#5F746D", "bold");
  if (session.skin_age !== null) line(`Estimated skin age: ${session.skin_age}`, 12);
  y += 10;
  line("Included in your report", 16, "#0D3028", "bold");
  line(modules.map((module) => ({ skin: "Skin & face", hairstyle: "Hair, hairstyle & beard", colour: "Colour & clothing", frame: "Frame try-on" }[module])).join("  •  "), 11);

  for (const category of ["skin", "face", "hair"]) {
    const rows = metrics.filter((metric) => metric.category === category);
    if (!rows.length) continue;
    ensure(90); y += 16; line(category === "hair" ? "Hair & scalp" : `${category[0].toUpperCase()}${category.slice(1)} analysis`, 18, "#0D3028", "bold");
    for (const metric of rows) {
      ensure(62);
      line(`${metric.metric_name}  ${metric.score ?? "Not assessed"}${metric.score === null ? "" : "/100"}`, 12, "#173E35", "bold");
      if (metric.recommendation) line(metric.recommendation, 9.5, "#5F746D");
      y += 5;
    }
  }
  ensure(80); y += 18;
  line("Your complete visual report", 16, "#0D3028", "bold");
  line("Open the secure report link in your email to view your generated hairstyle, beard, clothing-colour and frame previews.", 11);
  return Buffer.from(pdf.output("arraybuffer"));
}

function emailHtml(name: string, reportUrl: string) {
  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(reportUrl);
  return `<!doctype html><html><body style="margin:0;background:#eef1ef;font-family:Arial,sans-serif;color:#0d3028"><div style="max-width:580px;margin:auto;padding:42px 20px"><p style="font-weight:800;letter-spacing:.12em;color:#168d78">PERCEPT</p><div style="background:#fff;border:1px solid #d6dfdb;border-radius:18px;padding:40px"><p style="margin:0 0 8px;color:#168d78;font-weight:700">REPORT COMPLETE</p><h1 style="font-size:30px;line-height:1.15;margin:0 0 16px">${safeName ? `${safeName}, your` : "Your"} personalised report is ready.</h1><p style="font-size:16px;line-height:1.6;color:#4d6560">Your analysis and visual recommendations have finished. Your report PDF and payment invoice are attached, and your full interactive report is available securely online.</p><a href="${safeUrl}" style="display:inline-block;margin-top:12px;padding:16px 28px;border-radius:999px;background:#0d3028;color:#fff;text-decoration:none;font-weight:700">Open my full report →</a><p style="margin:28px 0 0;padding-top:22px;border-top:1px solid #e2e7e4;font-size:12px;color:#81908b">This report is personal to your Percept account. Please do not forward it if you prefer to keep your results private.</p></div></div></body></html>`;
}

type Purchase = {
  modules: ModuleId[];
  amount_paid: number;
  provider: "paypal" | "razorpay";
  provider_order_id: string;
  created_at: string;
};

async function invoiceAmount(purchase: Purchase, includesConsultation: boolean) {
  const totalUsd = Number(purchase.amount_paid) + (includesConsultation ? DOCTOR_CONSULTATION_PRICE : 0);
  if (purchase.provider === "razorpay") {
    try {
      const order = await fetchRazorpayOrder(purchase.provider_order_id);
      const keyId = process.env.RAZORPAY_KEY_ID ?? process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "";
      return { amount: order.amount / 100, currency: order.currency, test: keyId.startsWith("rzp_test_") };
    } catch {
      return { amount: usdToPaise(totalUsd) / 100, currency: "INR", test: true };
    }
  }
  return { amount: totalUsd, currency: "USD", test: PAYPAL_ENVIRONMENT === "sandbox" };
}

function buildInvoice(
  name: string,
  email: string,
  purchase: Purchase,
  includesConsultation: boolean,
  charge: { amount: number; currency: string; test: boolean },
) {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const money = new Intl.NumberFormat("en", { style: "currency", currency: charge.currency }).format(charge.amount);
  const invoiceNumber = `PER-${purchase.provider_order_id.slice(-12).toUpperCase()}`;
  pdf.setFillColor("#0D3028"); pdf.rect(0, 0, 595, 112, "F");
  pdf.setTextColor("#70E1CD"); pdf.setFont("helvetica", "bold"); pdf.setFontSize(14); pdf.text("PERCEPT", 48, 48);
  pdf.setTextColor("#FFFFFF"); pdf.setFontSize(25); pdf.text("Payment invoice / receipt", 48, 82);
  let y = 152;
  const row = (label: string, value: string) => {
    pdf.setFontSize(10); pdf.setTextColor("#71827D"); pdf.setFont("helvetica", "normal"); pdf.text(label, 48, y);
    pdf.setTextColor("#173E35"); pdf.setFont("helvetica", "bold"); pdf.text(value, 190, y); y += 24;
  };
  row("Invoice number", invoiceNumber);
  row("Payment date", new Date(purchase.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }));
  row("Billed to", name || email);
  if (name) row("Account email", email);
  row("Payment provider", purchase.provider === "razorpay" ? "Razorpay" : "PayPal");
  row("Transaction reference", purchase.provider_order_id);
  if (charge.test) row("Payment mode", "TEST / SANDBOX — no real charge");
  y += 22;
  pdf.setDrawColor("#D6DFDB"); pdf.line(48, y, 547, y); y += 34;
  pdf.setFontSize(12); pdf.setTextColor("#0D3028"); pdf.setFont("helvetica", "bold"); pdf.text("Description", 48, y); pdf.text("Amount", 470, y);
  y += 26;
  pdf.setFont("helvetica", "normal"); pdf.setTextColor("#334F47");
  pdf.text(`Personalised report: ${purchase.modules.map(moduleLabel).join(", ")}`, 48, y, { maxWidth: 390 });
  if (includesConsultation) { y += 34; pdf.text("Dermatologist consultation", 48, y); }
  y += 42; pdf.line(48, y, 547, y); y += 34;
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(15); pdf.text("Total paid", 365, y); pdf.text(money, 470, y);
  y += 60; pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.setTextColor("#71827D");
  pdf.text(charge.test ? "This document records a test transaction and is not a tax invoice." : "This receipt confirms payment for the services listed above.", 48, y);
  return Buffer.from(pdf.output("arraybuffer"));
}

export type SendReportReadyEmailResult =
  | { ok: true }
  | { ok: false; status: 404 | 409; error: string };

/** `supabase` must be a service-role (admin) client — every query here is scoped by an explicit user_id filter, not RLS. */
export async function sendReportReadyEmail(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
  siteOrigin: string,
): Promise<SendReportReadyEmailResult> {
  const [{ data: purchase }, { data: session }, { data: profile }, { data: metrics }, { data: userData }] = await Promise.all([
    supabase.from("report_purchases_v2").select("modules, amount_paid, provider, provider_order_id, created_at").eq("session_id", sessionId).eq("user_id", userId).maybeSingle(),
    supabase.from("analysis_sessions_v2").select("status, overall_score, skin_age, created_at").eq("id", sessionId).eq("user_id", userId).maybeSingle(),
    supabase.from("user_profiles_v2").select("name").eq("user_id", userId).maybeSingle(),
    supabase.from("analysis_metrics_v2").select("category, metric_name, score, label, recommendation").eq("session_id", sessionId).eq("user_id", userId),
    supabase.auth.admin.getUserById(userId),
  ]);
  if (!purchase || !session) return { ok: false, status: 404, error: "Report not found" };
  if (session.status !== "complete") return { ok: false, status: 409, error: "Report analysis is still processing" };
  const email = userData.user?.email;
  if (!email) return { ok: false, status: 409, error: "No account email is available" };

  const modules = purchase.modules as ModuleId[];
  const name = profile?.name ?? "";
  const pdf = buildPdf(name, session, (metrics ?? []) as MetricRow[], modules);
  const siteUrl = siteOrigin.replace(/\/$/, "");
  const reportUrl = `${siteUrl}/report/${sessionId}`;
  const filename = reportFilename(name, session.created_at);
  const { data: consultation } = await supabase.from("doctor_consultations_v2").select("id")
    .eq("provider_order_id", purchase.provider_order_id).maybeSingle();
  const typedPurchase = { ...purchase, modules } as Purchase;
  const charge = await invoiceAmount(typedPurchase, !!consultation);
  const invoice = buildInvoice(name, email, typedPurchase, !!consultation, charge);
  const invoiceFilename = `Percept-Invoice-${purchase.provider_order_id}.pdf`;

  const { error } = await resend.emails.send({
    from: "Percept <noreply@percept.skin>", to: email,
    subject: `${name ? `${name}, your` : "Your"} Percept report is ready`,
    html: emailHtml(name, reportUrl),
    text: `Your Percept report is ready. Open it securely: ${reportUrl}`,
    attachments: [{ filename, content: pdf }, { filename: invoiceFilename, content: invoice }],
  }, { idempotencyKey: `report-ready-${sessionId}` });
  if (error) throw new Error(error.message);

  logV2.info("v2_report_ready_email_sent", { user_id: userId, session_id: sessionId, filename });
  return { ok: true };
}
