import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { jsPDF } from "jspdf";
import { verifySupabaseUser } from "@/lib/supabase/verifyRequest";
import { logV2 } from "@/lib/v2/log";
import type { ModuleId } from "@/lib/v2/reportModules";

export const maxDuration = 60;

const resend = new Resend(process.env.RESEND_API_KEY);

function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

function safeFilePart(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

function reportFilename(name: string, createdAt: string) {
  const date = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    .format(new Date(createdAt)).replace(/\s+/g, "-");
  return ["Percept-Report", safeFilePart(name), date].filter(Boolean).join("-") + ".pdf";
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
  return `<!doctype html><html><body style="margin:0;background:#eef1ef;font-family:Arial,sans-serif;color:#0d3028"><div style="max-width:580px;margin:auto;padding:42px 20px"><p style="font-weight:800;letter-spacing:.12em;color:#168d78">PERCEPT</p><div style="background:#fff;border:1px solid #d6dfdb;border-radius:18px;padding:40px"><p style="margin:0 0 8px;color:#168d78;font-weight:700">REPORT COMPLETE</p><h1 style="font-size:30px;line-height:1.15;margin:0 0 16px">${name ? `${name}, your` : "Your"} personalised report is ready.</h1><p style="font-size:16px;line-height:1.6;color:#4d6560">Your analysis and visual recommendations have finished. A PDF summary is attached, and your full interactive report is available securely online.</p><a href="${reportUrl}" style="display:inline-block;margin-top:12px;padding:16px 28px;border-radius:999px;background:#0d3028;color:#fff;text-decoration:none;font-weight:700">Open my full report →</a><p style="margin:28px 0 0;padding-top:22px;border-top:1px solid #e2e7e4;font-size:12px;color:#81908b">This report is personal to your Percept account. Please do not forward it if you prefer to keep your results private.</p></div></div></body></html>`;
}

export async function POST(req: NextRequest) {
  const auth = await verifySupabaseUser(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { sessionId } = await req.json() as { sessionId?: string };
  if (!sessionId) return NextResponse.json({ error: "sessionId is required" }, { status: 400 });

  const supabase = adminClient();
  const [{ data: purchase }, { data: session }, { data: profile }, { data: metrics }, { data: userData }] = await Promise.all([
    supabase.from("report_purchases_v2").select("modules").eq("session_id", sessionId).eq("user_id", auth.userId).maybeSingle(),
    supabase.from("analysis_sessions_v2").select("status, overall_score, skin_age, created_at").eq("id", sessionId).eq("user_id", auth.userId).maybeSingle(),
    supabase.from("user_profiles_v2").select("name").eq("user_id", auth.userId).maybeSingle(),
    supabase.from("analysis_metrics_v2").select("category, metric_name, score, label, recommendation").eq("session_id", sessionId).eq("user_id", auth.userId),
    supabase.auth.admin.getUserById(auth.userId),
  ]);
  if (!purchase || !session) return NextResponse.json({ error: "Report not found" }, { status: 404 });
  if (session.status !== "complete") return NextResponse.json({ error: "Report analysis is still processing" }, { status: 409 });
  const email = userData.user?.email;
  if (!email) return NextResponse.json({ error: "No account email is available" }, { status: 409 });

  const modules = purchase.modules as ModuleId[];
  const name = profile?.name ?? "";
  const pdf = buildPdf(name, session, (metrics ?? []) as MetricRow[], modules);
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? req.nextUrl.origin).replace(/\/$/, "");
  const reportUrl = `${siteUrl}/report/${sessionId}`;
  const filename = reportFilename(name, session.created_at);

  try {
    const { error } = await resend.emails.send({
      from: "Percept <noreply@superapp.digital>", to: email,
      subject: `${name ? `${name}, your` : "Your"} Percept report is ready`,
      html: emailHtml(name, reportUrl),
      text: `Your Percept report is ready. Open it securely: ${reportUrl}`,
      attachments: [{ filename, content: pdf }],
    }, { idempotencyKey: `report-ready-${sessionId}` });
    if (error) throw new Error(error.message);
    logV2.info("v2_report_ready_email_sent", { user_id: auth.userId, session_id: sessionId, filename });
    return NextResponse.json({ status: "sent" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logV2.error("v2_report_ready_email_failed", { user_id: auth.userId, session_id: sessionId, message });
    return NextResponse.json({ error: "Your report is ready, but the email could not be sent yet" }, { status: 502 });
  }
}
