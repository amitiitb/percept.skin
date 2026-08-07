import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { logV2 } from "@/lib/v2/log";
import { verifySupabaseUser } from "@/lib/supabase/verifyRequest";

const resend = new Resend(process.env.RESEND_API_KEY);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function accountExistsForEmail(email: string): Promise<boolean> {
  const target = email.trim().toLowerCase();
  // Supabase Admin currently offers pagination but no server-side email
  // filter. Walk the pages in batches so anonymous-user conversion can detect
  // a duplicate before updateUserById collapses it into the opaque
  // "Database error updating user" seen on mobile.
  let page = 1;
  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      logV2.warn("v2_signup_existing_email_lookup_failed", { message: error.message, status: error.status ?? null });
      return false;
    }
    if (data.users.some((user) => user.email?.trim().toLowerCase() === target && !user.is_anonymous)) return true;
    if (!data.nextPage || data.users.length === 0) return false;
    page = data.nextPage;
  }
}

export async function POST(req: NextRequest) {
  const { name, email, password } = await req.json();

  if (!name || !email || !password) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  if (String(password).length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  if (await accountExistsForEmail(cleanEmail)) {
    return NextResponse.json(
      { error: "An account with this email has already been created. Please log in.", code: "ACCOUNT_EXISTS" },
      { status: 409 },
    );
  }

  const auth = await verifySupabaseUser(req);
  let error: { message: string; status?: number; code?: string } | null = null;

  if (auth) {
    const { data: existing, error: lookupError } = await supabaseAdmin.auth.admin.getUserById(auth.userId);
    if (lookupError) error = lookupError;
    else if (existing.user?.is_anonymous) {
      const result = await supabaseAdmin.auth.admin.updateUserById(auth.userId, {
        email: cleanEmail,
        password,
        email_confirm: true,
        user_metadata: { ...existing.user.user_metadata, name },
      });
      error = result.error;
    } else {
      return NextResponse.json({ error: "You already have an account. Please sign in." }, { status: 409 });
    }
  }

  if (!auth) {
    const result = await supabaseAdmin.auth.admin.createUser({
      email: cleanEmail, password, email_confirm: true, user_metadata: { name },
    });
    error = result.error;
  }

  if (auth && !error) {
    const { data: refreshed } = await supabaseAdmin.auth.admin.getUserById(auth.userId);
    if (refreshed.user?.is_anonymous) {
      return NextResponse.json({ error: "Please refresh the page and try again." }, { status: 409 });
    }
  }

  if (error) {
    // Supabase's Auth admin API has been intermittently returning a genuinely
    // empty/malformed error body (error.message literally the 2-char string
    // "{}") — not a code bug here, a real upstream issue, but showing that
    // raw text to a user is useless. Log the real error server-side, show a
    // real message client-side.
    logV2.error("v2_signup_create_user_failed", { email: cleanEmail, message: error.message, status: error.status ?? null });
    const raw = error.message ?? "";
    const looksHuman = raw.length > 0 && raw.length < 200 && raw !== "{}" && !raw.startsWith("{");
    // GoTrue normally returns email_exists/user_already_exists, but some
    // deployments return an empty body with status 422 for the same duplicate
    // email conflict. Treat all of those shapes consistently.
    const accountExists = error.status === 422 ||
      /email_exists|user_already_exists/i.test(error.code ?? "") ||
      /already|registered|exists/i.test(raw);
    const msg = accountExists
      ? "An account with this email has already been created. Please log in."
      : looksHuman ? raw : "Something went wrong creating your account. Please try again in a moment.";
    return NextResponse.json(
      { error: msg, code: accountExists ? "ACCOUNT_EXISTS" : "SIGNUP_FAILED" },
      { status: accountExists ? 409 : 400 },
    );
  }

  // Welcome email — fire and forget, never blocks signup
  resend.emails.send({
    from: "Percept <noreply@superapp.digital>",
    to: cleanEmail,
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
