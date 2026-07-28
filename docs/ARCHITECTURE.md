# Glowmetry — Architecture

Status: reflects the shipped codebase as of 2026-07-28. See `TECH_STACK.md` for tooling choices and `PRD.md` for product scope.

---

## Part 1 — High-level architecture

### System diagram

```
┌───────────────────────────────────────────────────────────────────────────┐
│  Browser (Next.js client)                                                  │
│  MediaPipe FaceLandmarker runs here — live mesh + quality gate,             │
│  never sent server-side                                                    │
└───────────────────────────────┬─────────────────────────────────────────┘
                                 │  HTTPS
                                 ▼
┌───────────────────────────────────────────────────────────────────────────┐
│  Next.js app (App Router, auto-deployed on push to main)                    │
│  ┌─────────────────┐   ┌────────────────────┐   ┌─────────────────────┐  │
│  │ app/* pages        │   │ app/api/*           │   │ lib/v2/*             │  │
│  │ (splash, onboard, │──▶│ route handlers      │──▶│ aiProvider, paypal,  │  │
│  │  capture, bundle,  │   │ (serverless)        │   │ gemini, rateLimit,   │  │
│  │  report, dashboard)│   │                     │   │ log, reportModules   │  │
│  └─────────────────┘   └──────────┬─────────┘   └──────────┬──────────┘  │
└──────────────────────────────────┼────────────────────────┼───────────────┘
                                    │                          │
              ┌─────────────────────┼──────────────┐            │
              ▼                     ▼              ▼            ▼
    ┌──────────────────┐  ┌──────────────────┐  ┌─────────┐  ┌──────────┐
    │ Supabase          │  │ Anthropic Claude   │  │ PayPal   │  │ Gemini   │
    │ Postgres + Auth +  │  │ (vision analysis)  │  │ Orders   │  │ (image   │
    │ Storage (photos_v2)│  │ claude-sonnet-4-6  │  │ v2 API   │  │ generate)│
    └──────────────────┘  └──────────────────┘  └─────────┘  └──────────┘
                                                        │
                                                        ▼
                                                  ┌──────────┐
                                                  │ Resend    │
                                                  │ (email)   │
                                                  └──────────┘
```

### Route map

**Pages** (`app/*`): `/splash → /onboard → /profile-setup → /scan-prep → /capture/[step] → /bundle/[sessionId] → /report/[id] (+ /print) → /dashboard, /history, /settings, /checkout, /plans`

**API** (`app/api/*`): `auth/signup`, `analyse`, `account/delete`, `colour-analysis`, `hairstyle/generate`, `frame-tryon/generate`, `paypal/{create-order,capture,webhook}`, `report-purchase/{create-order,capture}`, `consultation/{create-order,capture}`

Route paths are clean (no `/v2` prefix) — that segment only ever existed to keep this build isolated from the pre-rewrite app while both existed side by side; the old app is gone now (see below), so the prefix was dropped from every page and API path on 2026-07-28. `lib/v2/*`, `components/v2/*`, and the `_v2`-suffixed database tables keep their internal naming (implementation detail, not user-facing).

### The one deliberate architectural decision that shapes everything else

**v2 is a fully isolated build**: its own route tree, its own database tables (all suffixed `_v2`), its own storage bucket. It shares exactly two things with anything that came before it — Supabase Auth (`auth.users`) and CSS design tokens. This was intentional from the first build plan (a bug in v2 can't corrupt anything else, and rollback is a straight table-drop). The pre-rewrite app this was isolated *from* has since been fully retired: its tables were dropped and its entire codebase deleted from the working environment. The isolation pattern is now just "how this app is structured," not an active migration-in-progress concern.

### Auth & authorization model

Every API route starts with `verifySupabaseUser(req)` (validates the bearer JWT against Supabase Auth). From there, two different Supabase client shapes are used depending on what the route needs to do:

- **Scoped client** — anon key + the caller's JWT attached. RLS applies as that real user. Used for anything a user should only ever touch their own rows in (sessions, photos, metrics).
- **Service-role client** — bypasses RLS entirely. Used only for the handful of writes an ordinary user must never make directly: flipping `subscriptions_v2`/`report_purchases_v2`/`doctor_consultations_v2` to paid status (only after independently re-verifying the PayPal order server-side), and writing to the internal `rate_limits_v2`/`error_logs_v2` tables.

### Data isolation

All 12 tables have row-level security enabled. Two tables (`analysis_photos_v2`, `analysis_metrics_v2`) are keyed by `session_id` rather than `user_id`; rather than an RLS policy that subqueries through the parent session (slower, more complex), `user_id` is denormalized onto the child row at insert time and the RLS policy checks it directly. `subscriptions_v2`, `report_purchases_v2`, and `doctor_consultations_v2` have a `select` policy for the owning user but **no insert/update/delete policy for regular users at all** — those rows can only be written by the service-role client, and only after the server has independently re-verified the PayPal order.

---

## Part 2 — Low-level architecture

### Database schema (12 tables, all RLS-enabled)

```
user_profiles_v2          — 1 per user. name, age_range, gender, skin_type, skin_concerns[],
                             hair_type, hair_concerns[], consent_given (gates capture),
                             subscription_status/plan (denormalized read-through, see below)

analysis_sessions_v2      — 1 per scan. status (pending|capturing|analyzing|complete|failed),
                             stage + fail_reason + stage_updated_at (fine-grained progress used
                             for the idempotency claim, see Analysis flow below),
                             overall_score, skin_age, image_quality_score,
                             positive_observations[], priority_concerns[], recommendations (jsonb),
                             limitations[]

analysis_photos_v2        — child of a session. photo_type (7-value enum), storage_path,
                             quality_status, quality_issues[]. user_id denormalized (see above).

analysis_metrics_v2       — child of a session. category (skin|face|hair — CHECK constraint),
                             metric_name, score, label, confidence, explanation, recommendation,
                             is_premium. user_id denormalized. Upserted on
                             (session_id, category, metric_name) — safe to re-run.

subscriptions_v2          — 1 per user (dormant feature, see PRD §5). provider_subscription_id,
                             plan, status, current_period_start/end. select-only for users.

colour_analysis_v2        — 1 per session (unique). data: jsonb (season/undertone/palette/etc).

hairstyle_generations_v2  — N per session. style_name, storage_path (photos_v2 bucket).

frame_generations_v2      — N per session. frame_name, storage_path.

report_purchases_v2       — 1 per session (unique). modules[] (subset of skin/colour/
                             hairstyle/frame), amount_paid, provider_order_id. select-only
                             for users — this row is what gates report-page rendering.

doctor_consultations_v2   — N per user. session_id nullable (can be bought standalone),
                             contact_phone, status (pending|contacted|completed), amount_paid,
                             provider_order_id (unique). select-only for users.

rate_limits_v2            — fixed-window counters. (user_id, route, window_start) unique,
                             incremented via increment_rate_limit_v2() RPC (security definer,
                             atomic — no read-then-write race). Service-role only.

error_logs_v2             — interim error tracker (level, event, fields jsonb), written from
                             lib/v2/log.ts alongside console output. Service-role only.
```

Every `user_id`/`session_id` column is a real foreign key (`references ... on delete cascade` for user-owned data), so deleting an `auth.users` row cascades every dependent row across all 12 tables in one operation.

### Capture flow

7 steps defined in `lib/v2/captureSteps.ts`, phase-grouped and rendered by a single dynamic route (`app/capture/[step]/page.tsx`):

- **Face** (4 steps): front, left, right, one combined close-up. During these steps, MediaPipe's `FaceLandmarker` runs live in the browser — draws the real face-mesh tesselation, a corner-bracket reticle that changes color when a face is locked on, a scanning-line sweep, and cycles a small callout label across real landmark positions (forehead/cheeks/jawline — deliberately not ears, since MediaPipe has no ear landmarks).
- **Hair & Scalp** (3 steps): hairline & temples, top & crown, parting close-up. No face-mesh (not applicable); instead static framing guides (dashed band/circle/line) since MediaPipe can't detect scalp/hair landmarks.
- Before a photo is accepted, `lib/v2/qualityChecks.ts` runs a client-side gate (`runQualityChecks`, face-detection only on face-phase steps): rejects on no face / multiple faces / too dark / too blurry, falls back to "skip check" (not "block capture") if the MediaPipe model itself fails to load.
- Capture state persists to `localStorage` via the `funnelV2` Zustand store, so closing the tab mid-flow resumes where the user left off.

### Analysis flow (`POST /api/analyse`)

1. Verify JWT, rate-limit check (15 requests / 10 min per user — this endpoint triggers a real, paid Claude call every time).
2. **Idempotency claim**: a single conditional `UPDATE ... WHERE stage IS NULL OR stage = 'failed' OR stage_updated_at < (now - 5min)`. This is one atomic statement, not a read-then-write — two concurrent requests for the same session (double tab, double click) can't both kick off a paid Claude call. Zero rows updated means another request already owns it; the client just polls `stage` rather than treating that as an error.
3. Fetch the session's photos, sign each storage URL (7-day expiry), fetch the user's profile (skin type/concerns/age range) for context.
4. Call `lib/v2/aiProvider.ts`'s `AnalysisProvider.analyse()` — the real implementation calls Claude (`claude-sonnet-4-6`) with the signed image URLs and profile context, parses the JSON response, validates it against a Zod schema, and runs `stripEmDash()` recursively across every string in the result (defensive — Claude doesn't reliably follow the "no em dash" system-prompt instruction).
5. Upsert all metrics (`analysis_metrics_v2`, keyed so re-running is safe), then update the session with `overall_score`, `skin_age`, and — in a separate best-effort update — the richer content (`positive_observations`, `priority_concerns`, `recommendations`, `limitations`) so a pre-migration environment still completes the core analysis even if those columns don't exist yet.
6. On any failure: the session is marked `stage = 'failed'` with a real `fail_reason` (never a silent hang), and the error is logged (console + `error_logs_v2`).

### Purchase flow (bundle-first — the actual paywall)

`app/bundle/[sessionId]/page.tsx` kicks off analysis in the background on mount while showing the module-selection UI (a single sliding-pill segmented control, not separate bordered tiles). Pricing (`lib/v2/reportModules.ts`): $5 per module, flat $10 once all 4 are selected (linear otherwise — no partial discount).

Purchase capture (`report-purchase/capture`, `consultation/capture`, `paypal/capture` — same pattern in all three): rate-limited (30/10min), calls PayPal's real capture endpoint (`captureOrderRaw`/`captureOrder`) with `Prefer: return=representation` (without this header PayPal's minimal response omits `custom_id`, which once caused a real captured payment to leave zero DB row), verifies the returned `custom_id` matches the authenticated caller (defense against capturing someone else's order), then writes the purchase row via the service-role client. A "your report is ready" email fires (Resend, fire-and-forget) after a successful report purchase.

The report page (`app/report/[id]/page.tsx`) requires a `report_purchases_v2` row to exist for the session — no row means a redirect back to the bundle page — and only renders sections for modules actually purchased.

### Paid-generation gating

Colour analysis, hairstyle generation, and frame-tryon generation are real per-call costs (Claude or Gemini). Each route calls `lib/v2/requirePurchase.ts`'s `hasPurchasedModule()` before running — auth alone isn't a payment gate; a request needs both a valid JWT *and* a matching `report_purchases_v2.modules` entry for that session.

### Rate limiting (added 2026-07-28)

Fixed-window counter, Postgres-backed, no external service. `lib/v2/rateLimit.ts`'s `checkRateLimit()` calls the `increment_rate_limit_v2` RPC (a `security definer` Postgres function) with a `(user_id, route, window_start)` key; the RPC does an atomic `insert ... on conflict do update set count = count + 1 returning count`, so two concurrent requests in the same window can't both read stale count and both write the same next value. Fails **open** on infra errors (a rate-limiter outage shouldn't take down paid AI calls or payment capture) — logs the failure instead.

### Observability

`lib/v2/log.ts`'s `logV2.{info,warn,error}` writes structured JSON to console always, and additionally persists `warn`/`error` to `error_logs_v2` (server-side only — dynamically imports the Supabase client and checks `typeof window`, so the client bundle never pays for or attempts this). Interim measure until a real APM is wired up.

### Content safety rule (standing, cross-cutting)

No em dash anywhere in user-facing text — enforced at two levels: hardcoded UI copy is written without them (grepped repeatedly across the codebase), and AI-generated text goes through `stripEmDash()` as a defensive net, since a system-prompt instruction alone isn't reliable enough for model-generated free text.
