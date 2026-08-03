# Percept — User Messaging Reference

Every message, email, notification, and error the user can actually see, and the exact condition that triggers it. Written from the live code as of 2026-07-28. See `ARCHITECTURE.md` for the systems behind these; this doc is the messaging layer only.

---

## 1. Emails

Two channels: our own Resend-sent emails (custom HTML templates), and Supabase's own built-in auth emails (default Supabase templates, outside our code). Different systems, worth telling apart when debugging "user says they didn't get an email."

### 1.1 Our emails (Resend)

| Trigger | Subject | Sent from | Fire-and-forget? |
|---|---|---|---|
| Signup completes (`POST /api/auth/signup` succeeds) | "Welcome to Percept" | `app/api/auth/signup/route.ts` | Yes — never blocks the signup response |
| Report purchase capture succeeds (`POST /api/report-purchase/capture`) | "Your Percept report is ready" | `app/api/report-purchase/capture/route.ts` | Yes — never blocks the capture response |

**Report-ready email content varies by whether consultation was bundled in the same purchase:**
- Combined purchase (report + consultation together): "Your dermatologist consultation is included, our team will reach out within 24 hours with a real plan."
- Report only: upsell line, "Want a real dermatologist's take too? Add a consultation for just $10..."

**Known gap:** no email is sent for a **standalone** consultation purchase (`/api/consultation/capture`), and no email is sent for the dormant subscription flow (`/api/paypal/capture`). A user who buys only the consultation gets an in-app "Confirmed" message and nothing else — no paper trail in their inbox. Worth fixing before this becomes the primary purchase path for consultations.

### 1.2 Supabase's own emails (not our templates)

| Trigger | What Supabase sends |
|---|---|
| `POST /auth/forgot-password` (via `supabase.auth.resetPasswordForEmail`) | Supabase's default "reset your password" email, links to `/auth/reset-password` |

This is a **separate delivery path** from our Resend emails — different sender, different template, configured in the Supabase dashboard (Auth → Email Templates), not in this codebase. If Supabase's Auth service has issues (as it did earlier this session — see the `on_auth_user_created` trigger incident in git history), this path can silently fail the same way, independent of whether Resend itself is healthy.

---

## 2. In-app success / confirmation messages

| Screen | Message | When |
|---|---|---|
| Forgot password | "Check your email. We sent a password reset link to `{email}`." | After `resetPasswordForEmail` resolves without error |
| Bundle checkout | Full-screen confetti + "Payment successful" + "Your report is ready, and our team will reach out about your consultation within 24 hours" (combo) or "Your Complete Beauty Report is ready to view" (report only) | Report-purchase or combo capture succeeds |
| Consultation-only checkout | "Confirmed / Our team will contact you within 24 hours." | `consultation/capture` succeeds, `purchasePath === "consultation"` |
| Settings — delete account | Button copy changes to "Deleting…" while in flight | `handleDeleteAccount` running |

---

## 3. In-app error messages

### 3.1 Auth (signup / login / password)

| Condition | Message |
|---|---|
| Password under 8 characters (signup, reset) | "Password must be at least 8 characters." |
| Passwords don't match (reset) | "Passwords do not match." |
| Login: Supabase returns "Invalid login credentials" | "Incorrect email or password." |
| Login: any other Supabase auth error | The raw `error.message` from Supabase, shown as-is |
| Signup: link had `?error=` in the query string | "That link is invalid or has expired. Please try again." |
| Signup: account creation fails, upstream message looks human-readable | That message, verbatim (e.g. duplicate-email check) |
| Signup: account creation fails, upstream message is empty/garbage (e.g. literally `"{}"`) | "Something went wrong creating your account. Please try again in a moment." — added 2026-07-28 after a real incident (see §5) |
| Signup: email already registered | "An account with this email already exists. Try logging in instead." |
| Settings: delete account fails | The raw `error.message`, or "Something went wrong." if not an `Error` instance |

### 3.2 Capture / quality check (`lib/v2/qualityChecks.ts`)

| Issue | Message shown |
|---|---|
| `no_face` | "We couldn't detect a face. Try better lighting and face the camera directly." |
| `multiple_faces` | "More than one face detected. Make sure you're alone in frame." |
| `too_dark` | "This photo is too dark. Move to a well-lit area and retake." |
| `too_blurry` | "This photo looks blurry. Hold steady and retake." |
| `model_unavailable` | "Live quality check unavailable. You can still continue, we'll review during processing." (fails open, never blocks capture) |
| Upload to storage/DB fails after capture | "Upload failed. Check your connection and retry." |

### 3.3 Analysis (`POST /api/analyse`)

| Condition | Message |
|---|---|
| Claude call times out | "Taking longer than usual, try again" |
| Claude rate-limited (429 from Anthropic) | "High demand right now, try again in a minute" |
| Claude response isn't valid/matching JSON | "Something went wrong reading your results, try again" |
| Anything else unexpected | "Something went wrong, try again" |
| Session not found for the given ID | "Session not found" (404) |
| Caller already has an analysis in flight for this session | No error — client just polls `stage`, silent no-op (`alreadyRunning: true`) |
| Rate limit hit (15 requests / 10 min) | "Too many requests, try again in a few minutes" (429) |

### 3.4 Payments (report-purchase / consultation / paypal capture — same 3 messages across all three routes)

| Condition | Message | HTTP status |
|---|---|---|
| PayPal reports the order isn't `COMPLETED` | "Payment could not be verified" | 402 |
| `custom_id` on the order doesn't match the authenticated caller | "Order does not belong to this account" | 403 |
| Any other capture failure | "Payment verification failed. Please contact support if you were charged" | 500 |
| Rate limit hit (30 requests / 10 min) | "Too many requests, try again in a few minutes" | 429 |
| PayPal SDK itself fails to load / errors client-side | "Payment service unavailable, try again shortly" | — |
| User closes the PayPal popup without paying | "Payment cancelled. No charge was made." | — |
| Capture request in flight | "Confirming payment…" (button dims, disabled) | — |

---

## 4. Notifications the user does *not* get (gaps worth knowing about)

- **No push notifications or SMS** anywhere in the product — every touchpoint above is either an email or an in-app message the user must be looking at the screen to see.
- **No "your consultation follow-up is overdue" reminder** — `doctor_consultations_v2.status` has a `pending → contacted → completed` lifecycle in the schema, but nothing currently emails or notifies staff/users based on it; it's manual.
- **No email receipt for the standalone consultation or subscription paths** (see §1.1).
- **No "payment succeeded but report still processing" follow-up email** — if a user pays and closes the tab before the report finishes generating, there's no email nudging them back; they'd have to notice on their own via the dashboard.

---

## 5. Real incident this session (for context on the "{}" error message)

A real production bug produced the literal text `"{}"` as a signup error message: a leftover trigger on `auth.users` from the pre-rewrite app (`on_auth_user_created` → `handle_new_user()`) still tried to insert into `public.profiles`, a table dropped earlier the same day. Every signup failed with an empty/malformed error from Supabase's Auth service until the trigger was dropped (`supabase/migrations/20260728000002_drop_legacy_signup_trigger.sql`). The defensive fallback in §3.1 ("Something went wrong creating your account...") is what now prevents any future upstream garbage from reaching a user verbatim, but the trigger itself was the real root cause, not a code bug in this repo.
