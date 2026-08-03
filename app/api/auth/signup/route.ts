import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { logV2 } from "@/lib/v2/log";

const resend = new Resend(process.env.RESEND_API_KEY);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Instant signup — no email-verification wall. Unlike the legacy version,
// there's no anonymous-session upgrade path: v2 requires an account before
// any scan starts, so every signup here is a fresh user.
export async function POST(req: NextRequest) {
  const { name, email, password } = await req.json();

  if (!name || !email || !password) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  if (String(password).length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const { error } = await supabaseAdmin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { name },
  });

  if (error) {
    // Supabase's Auth admin API has been intermittently returning a genuinely
    // empty/malformed error body (error.message literally the 2-char string
    // "{}") — not a code bug here, a real upstream issue, but showing that
    // raw text to a user is useless. Log the real error server-side, show a
    // real message client-side.
    logV2.error("v2_signup_create_user_failed", { email, message: error.message, status: error.status ?? null });
    const raw = error.message ?? "";
    const looksHuman = raw.length > 0 && raw.length < 200 && raw !== "{}" && !raw.startsWith("{");
    const msg = /already|registered|exists/i.test(raw)
      ? "An account with this email already exists. Try logging in instead."
      : looksHuman ? raw : "Something went wrong creating your account. Please try again in a moment.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // Welcome email — fire and forget, never blocks signup
  resend.emails.send({
    from: "Percept <noreply@superapp.digital>",
    to: email,
    subject: "Welcome to Percept",
    html: buildWelcomeEmail(name),
  }).catch(() => { /* non-fatal */ });

  return NextResponse.json({ ok: true });
}

function buildWelcomeEmail(name: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Welcome to Percept</title>
<style>
  body { margin:0; padding:0; background:#E8E7E5; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; color:#003934; }
  .wrap { max-width:560px; margin:0 auto; padding:48px 24px; }
  .logo { font-size:22px; font-weight:600; letter-spacing:-0.02em; color:#003934; }
  .logo span { color:#1A9E8F; }
  .card { background:#fff; border:1px solid #D6D3CD; border-radius:12px; padding:48px 40px; margin-top:32px; }
  h1 { font-size:26px; font-weight:300; line-height:1.2; letter-spacing:-0.02em; margin:0 0 12px; }
  p { font-size:15px; line-height:1.65; color:#4D6560; margin:0 0 24px; }
  .btn { display:inline-block; background:#003934; color:#fff; font-size:16px; font-weight:500; padding:16px 36px; border-radius:9999px; text-decoration:none; letter-spacing:-0.01em; }
  .footer { margin-top:40px; font-size:12px; color:#8C9B97; }
</style>
</head>
<body>
<div class="wrap">
  <div class="logo">Percept</div>
  <div class="card">
    <h1>Hi ${name}, your account is ready.</h1>
    <p>Log in any time to start a guided scan, review your report, or track progress.</p>
    <a href="${process.env.NEXT_PUBLIC_SITE_URL}/dashboard" class="btn">Go to my dashboard →</a>
  </div>
  <div class="footer">
    © 2026 Percept · AI-powered skin analysis
  </div>
</div>
</body>
</html>`;
}
