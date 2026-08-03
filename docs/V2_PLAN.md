# Percept V2 — Phase 1 Build Plan

Status: REVIEWED (HOLD SCOPE) — ready for /plan-eng-review before implementation.
Generated: 2026-07-22 via /plan-ceo-review.
Approach: **new `/v2` route tree + new Supabase tables + new `photos_v2` storage bucket.**
The live app (`/onboard → /capture → /results → /plan` etc.) is untouched until you explicitly confirm cutover.

## Decisions locked this review

| # | Decision | Choice |
|---|----------|--------|
| 1 | Build isolation | New `/v2` routes, new DB tables (not shared with `reports`/`sessions`) |
| 2 | Review posture | Hold scope — harden the spec as given, no scope added/cut |
| 3 | PayPal activation | Server-confirms order before flipping `subscriptions_v2.status=active`; never trust client callback alone |
| 4 | Photo storage | New `photos_v2` bucket, not the existing `photos` bucket |
| 5 | Report download | Print-optimized web view (`@media print`) this phase; real PDF lib deferred to TODOS |

## What already exists (reuse map)

| Sub-problem | Existing code | Reused as-is? |
|---|---|---|
| Supabase auth (signup/login/session) | `lib/supabase/client.ts`, `server.ts`, `verifyRequest.ts`, `app/api/auth/signup/route.ts` | Yes — v2 auth screens call the same auth helpers, just new UI |
| Face detection / quality signal | `@mediapipe/tasks-vision` `FaceLandmarker`, already wired in `components/report/ColourDraping.tsx` | Yes — same library powers capture-time "face detected / well framed" checks |
| Claude vision call pattern | `app/api/analyse/route.ts` (image-block construction, JSON-extraction, error handling) | Pattern reused, prompt/schema rewritten (medical framing removed) |
| Zustand funnel store pattern | `store/funnel.ts` | Pattern reused for a new `store/funnelV2.ts` — kept separate so old funnel's persisted localStorage shape is never touched |
| PrimaryButton / design tokens | `components/ui/PrimaryButton.tsx`, `app/globals.css` CSS vars | Reused directly — new screens inherit the same visual language, not a new design system |
| Report list/detail card patterns | `app/my-reports/page.tsx`, `app/my-reports/[id]/page.tsx` (score-color coding, card layout) | Pattern reused for `/v2/history` |

## NOT in scope (this phase)

- Retiring or modifying the old funnel — explicitly deferred until you confirm cutover.
- Real PayPal production credentials / live webhook verification — sandbox only; TODO for production hardening.
- Real PDF generation — print-view now, PDF lib is a TODO.
- Migrating old `reports` rows into the new schema — no migration planned; these stay two parallel histories until cutover.
- Consolidating `ColourAnalysis` (existing) with the new `AnalysisMetric` model — existing colour-analysis feature is untouched; v2 report ships its own skin/face/hair metrics independently.

## Dream state delta

```
CURRENT STATE                     THIS PLAN (v2, parallel)              12-MONTH IDEAL
skin-only, 6 photos,     --->     +hair/scalp +face domains,   --->     one unified funnel,
INR consultation paywall,         15-photo guided capture,              PayPal live + verified,
clinical AI copy,                 USD PayPal subscriptions,             one true 12-metric
no persisted profile              non-clinical AI copy,                 AI schema, old funnel
                                   persisted profile,                    retired, real progress
                                   parallel to live app                 tracking with real history
```

---

## 1. Architecture

### System diagram

```
                         ┌─────────────────────────────────────────┐
                         │              Existing (untouched)         │
                         │  /onboard /capture /results /plan ...      │
                         │  tables: sessions, reports, photos(bucket) │
                         └─────────────────────────────────────────┘
                                          (no shared code/state)
┌──────────────────────────────────────────────────────────────────────────┐
│                                  Percept V2                              │
│                                                                            │
│  /v2/splash → /v2/onboard(1-3) → /v2/auth → /v2/profile-setup            │
│       → /v2/dashboard → /v2/scan-prep → /v2/capture(1..15)               │
│       → /v2/processing → /v2/report/[id] → /v2/plans → /v2/checkout      │
│       → /v2/checkout/success|cancel|failed → /v2/history → /v2/settings  │
│                                                                            │
│  ┌────────────────┐   ┌───────────────────┐   ┌─────────────────────┐  │
│  │ store/funnelV2  │──▶│ lib/v2/aiProvider  │──▶│ Claude Sonnet API    │  │
│  │ (Zustand)        │   │  (interface)       │   │ (mock provider first)│  │
│  └────────────────┘   └───────────────────┘   └─────────────────────┘  │
│           │                      │                                       │
│           ▼                      ▼                                       │
│  ┌────────────────┐   ┌───────────────────┐   ┌─────────────────────┐  │
│  │ Supabase Auth    │   │ photos_v2 (bucket) │   │ Supabase Postgres:   │  │
│  │ (shared/reused)  │   │                    │   │ user_profiles_v2     │  │
│  └────────────────┘   └───────────────────┘   │ analysis_sessions_v2 │  │
│                                                  │ analysis_photos_v2   │  │
│  ┌────────────────┐   ┌───────────────────┐   │ analysis_metrics_v2  │  │
│  │ /api/v2/paypal/* │──▶│ PayPal Sandbox API │   │ subscriptions_v2      │  │
│  │ create-order      │   └───────────────────┘   └─────────────────────┘  │
│  │ capture           │                                                    │
│  │ webhook (stub)     │                                                    │
│  └────────────────┘                                                      │
└──────────────────────────────────────────────────────────────────────────┘
```

### Coupling analysis
New code shares exactly two things with the live app: Supabase Auth (same `auth.users`) and design tokens (CSS vars, `PrimaryButton`). Everything else — funnel state, DB tables, storage bucket, AI provider, payment logic — is new and independent. This is intentional (Decision #1) and means a bug in v2 cannot corrupt live-app state; a bug in the live app cannot corrupt v2 state either.

### Single points of failure
- **Supabase Auth** is shared — if it's down, both old and new funnels are down. Not new risk, already true today.
- **Claude API** — if down, v2 processing fails same as today's `/processing`. Needs the same graceful-degradation pattern already used today (see Error & Rescue Registry below) rather than a silent mock fallback presented as real data (a gap flagged in your existing `docs/USER_FLOW.md` for the old funnel — do not repeat it here).
- **PayPal Sandbox API** — new SPOF. If down during checkout, user sees a clear "payment service unavailable, try again" state, not a hang.

### Rollback posture
Because v2 is entirely new routes/tables/bucket: rollback = revert the deploy (routes disappear) and optionally `DROP TABLE ... _v2` / delete the bucket. Zero risk to old-funnel data. This is the cleanest possible rollback story — a direct benefit of Decision #1.

---

## 2. Error & Rescue Registry

```
METHOD/CODEPATH                    | WHAT CAN GO WRONG              | EXCEPTION CLASS
------------------------------------|----------------------------------|--------------------
lib/v2/aiProvider.mockProvider      | n/a (deterministic)              | —
lib/v2/aiProvider.claudeProvider    | Claude API timeout               | TimeoutError
                                     | Claude API 429                   | RateLimitError
                                     | Claude returns non-JSON / refusal | SchemaParseError
                                     | Claude returns JSON missing keys | SchemaValidationError
/api/v2/photos/upload                | Supabase storage quota/error     | StorageWriteError
                                     | File too large / wrong mime      | InvalidPhotoError
/api/v2/paypal/create-order          | PayPal API down/timeout          | PayPalUnavailableError
                                     | Invalid plan id                  | InvalidPlanError
/api/v2/paypal/capture               | Order already captured (double-click) | DuplicateCaptureError
                                     | Order not found/expired          | OrderNotFoundError
/api/v2/paypal/webhook (stub)        | Signature verification fails (TODO) | WebhookAuthError
capture quality check (client)       | MediaPipe model fails to load    | ModelLoadError
                                     | No face detected                 | NoFaceDetectedError
                                     | Multiple faces detected          | MultipleFacesError

EXCEPTION CLASS            | RESCUED? | RESCUE ACTION                                  | USER SEES
----------------------------|----------|--------------------------------------------------|------------------------------------------
TimeoutError                | Y        | Retry once, then fail with retry button          | "Analysis is taking longer than usual — retry?"
RateLimitError               | Y        | Backoff + retry (max 2)                          | Nothing if resolved; else same as Timeout
SchemaParseError             | Y        | Fail loudly, log raw response, offer retry       | "Couldn't read your results — retry?" (never a fabricated fallback score)
SchemaValidationError        | Y        | Same as above                                    | Same as above
StorageWriteError            | Y        | Retry once, then block progression with message  | "Upload failed — check connection and retry"
InvalidPhotoError            | Y        | Reject client-side before upload where possible  | "Image too large / wrong format"
PayPalUnavailableError       | Y        | Show retry, do not advance to success state      | "Payment service unavailable — try again shortly"
InvalidPlanError             | Y        | 400, log, block checkout                         | "Something went wrong — please reselect a plan"
DuplicateCaptureError        | Y        | Treat as idempotent success (order already captured → check DB for existing active sub) | Normal success screen
OrderNotFoundError            | Y        | Block, do not unlock                             | "We couldn't verify this payment — contact support"
WebhookAuthError              | Y (stub) | Reject request, log, alert — TODO real signature verification before production | n/a (server-only; no user impact yet since sandbox)
ModelLoadError                | Y        | Fall back to "skip quality check, allow manual review" rather than blocking capture | "Live quality check unavailable — you can still continue"
NoFaceDetectedError           | Y        | Block capture, show retake with tip              | "We couldn't detect a face — try better lighting"
MultipleFacesError            | Y        | Block capture, show retake with tip              | "More than one face detected — make sure you're alone in frame"
```

**Critical rule enforced across all AI failure paths:** no silent mock-fallback-shown-as-real-data. This was a flagged gap in the *existing* funnel (`MOCK_FALLBACK`, score 71) — v2 must not repeat it. Every AI failure surfaces as a visible retry state, never a fabricated result.

---

## 3. Security & Threat Model

| Finding | Threat | Likelihood | Impact | Mitigated by plan? |
|---|---|---|---|---|
| Premium route access | Free user manually navigates to `/v2/report/[id]` premium sections via URL | Med | Med | **Yes** — server-side check in each premium route/API against `subscriptions_v2.status`, not a client-only flag |
| Direct object reference on reports | User A guesses/edits a session id to view User B's `analysis_sessions_v2` row | Med | High | **Yes** — every v2 query filters `.eq("user_id", session.user.id)`, same pattern as existing `my-reports` (already does this correctly — reuse it) |
| PayPal webhook spoofing | Attacker POSTs a fake "payment succeeded" webhook to mark themselves premium for free | Low (sandbox stage) | High | **Partially** — stub route exists with clear `// TODO: verify PayPal webhook signature before production` comment; must not ship to production without this |
| Photo upload abuse | Oversized/malicious file uploaded as a "photo" | Low | Med | **Yes** — client + server-side mime/size validation before storage write |
| Consent bypass | Photos processed without the consent checkbox from Section 4 of your spec | Low | Med (legal/trust) | **Yes** — `/v2/profile-setup` blocks progression without `consentGiven=true`; API rejects analysis requests if the session's profile lacks consent |
| Secrets in frontend | PayPal client ID is intentionally public (required for PayPal JS SDK); secret key must never reach client | Med if misconfigured | High | **Yes** — `PAYPAL_CLIENT_ID` (public, used client-side) vs `PAYPAL_SECRET` (server-only env var, used only in `/api/v2/paypal/*`) — documented in `.env.example` |

No High-likelihood/High-impact unmitigated findings. The one deliberate gap (webhook signature verification) is sandbox-appropriate and explicitly TODO'd, not silently skipped.

---

## 4. Data Flow & Interaction Edge Cases

### Data flow: guided capture → AI analysis (with shadow paths)

```
CAPTURE PHOTO ──▶ CLIENT QUALITY CHECK ──▶ UPLOAD ──▶ PERSIST ROW ──▶ AI ANALYSIS ──▶ REPORT
     │                    │                    │            │              │              │
     ▼                    ▼                    ▼            ▼              ▼              ▼
 [camera denied?]   [no face detected?]  [upload fails?] [dup insert?] [Claude down?] [partial metrics?]
 → permission        → block, retake tip  → retry once,   → upsert on   → retry, then   → show what's
   denied state         with reason         then error       (session,     visible retry   available,
                                             banner           angle) key   (never fake)    flag rest as
                                                                                            "needs better
                                                                                             photo"
```

### Interaction edge cases

```
INTERACTION              | EDGE CASE                        | HANDLED?
--------------------------|-----------------------------------|----------
15-step capture           | User navigates away mid-flow      | Yes — funnelV2 (Zustand) persists to localStorage, resume where left off (same pattern as existing store/funnel.ts)
15-step capture           | Retake same photo repeatedly       | Yes — no step-count penalty, just overwrites the local blob until "Continue" is pressed
Processing screen         | User closes tab mid-analysis       | Session row stays "analyzing"; on next visit, /v2/dashboard shows "resume analysis" rather than pretending it's done
PayPal checkout           | Double-click "Pay Now"             | Idempotent — DuplicateCaptureError path checks for existing active sub before erroring
PayPal checkout           | User cancels PayPal popup          | /v2/checkout/cancel state, funnel keeps them on the plan-selection screen, no partial charge
Report history list       | Zero scans yet                     | Explicit empty state with CTA, not a blank screen
Settings → delete account | Confirms then backend fails partway | Must be transactional or clearly communicate partial failure — flagged as Implementation Task (see below)
```

---

## 5. Code Quality
Greenfield code — no DRY violations to flag yet. One naming note: keep `analysis_metrics_v2.category` as an enum (`"skin" | "face" | "hair"`) matching your spec's three domains, not a free string, so the report renderer can switch on it exhaustively (TypeScript will catch missing cases).

No over-engineering risk identified — the provider-interface pattern for AI (Section 23 of your spec) is exactly right-sized: one interface, one mock implementation, one real implementation, no premature abstraction beyond that.

---

## 6. Test Plan

```
NEW UX FLOWS: 15-step guided capture, profile setup, PayPal checkout, report history, settings/delete
NEW DATA FLOWS: photo upload→v2 bucket, AI provider call→metrics persist, PayPal order→subscription flip
NEW CODEPATHS: quality-check gating, premium-route guard, webhook stub
NEW INTEGRATIONS: PayPal Sandbox SDK, (optionally) real Claude call for v2 schema
NEW ERROR PATHS: all rows in the Error & Rescue Registry above
```

| Item | Test type | Happy path | Failure path | Edge case |
|---|---|---|---|---|
| Capture quality check | Unit | Face detected, well-lit → pass | MediaPipe fails to load → check skipped, not blocked | Two faces in frame → rejected |
| AI provider (mock) | Unit | Returns full valid schema | n/a (deterministic) | Missing photo type → still returns partial schema with `limitations` populated |
| AI provider (Claude) | Integration | Valid JSON parsed → metrics saved | Malformed JSON → SchemaParseError surfaced, not swallowed | Empty response → same |
| Premium route guard | Integration | Premium user sees full report | Free user redirected/blurred | Expired subscription (past `currentPeriodEnd`) → treated as free |
| PayPal capture | Integration | Server verifies order → subscription active | PayPal API down → error state, no unlock | Double-submit → idempotent, no duplicate row |
| Report history | E2E | Lists all v2 sessions for user | Zero results → empty state | Session belongs to another user → 403/redirect |

**2am-Friday test:** the PayPal capture endpoint under a duplicate/replayed request — this is the one codepath where a bug directly costs money or gives away premium access for free.
**Hostile QA test:** attempt to hit `/v2/report/[someone-elses-id]` while logged in as a different user, and attempt to call `/api/v2/paypal/capture` twice with the same order id.

---

## 7. Performance
- Claude Sonnet vision calls with up to 15 images per session — significantly larger payload than today's 6-photo call. Recommend client-side downscale/compress before upload (existing capture flow doesn't appear to do this — worth checking `app/capture/page.tsx` for existing compression before v2 duplicates the same oversight).
- New tables need indexes on `(user_id)` for all four new tables, and `(session_id)` on `analysis_photos_v2`/`analysis_metrics_v2` — standard, low-risk, must be in the migration.
- No caching need identified yet (each analysis is a one-time compute per session).

---

## 8. Observability
- Log at minimum: capture-step-completed, quality-check-failed (with reason), AI-analysis-started/completed/failed, PayPal-order-created/captured/failed, subscription-status-changed.
- One metric that tells you v2 is healthy: analysis success rate (completed / started) over a rolling window. One metric that tells you it's broken: AI analysis failure rate spike, or PayPal capture failure rate spike.
- Debuggability check: if a user reports "I paid but I'm not premium" 3 weeks later, can you reconstruct it from logs? Requires logging the PayPal order id alongside the internal subscription row from day one — add this explicitly to the implementation tasks.

---

## 9. Deployment & Rollout
- Migration order: create new tables + bucket first (additive, zero risk to existing schema), deploy code second.
- No feature flag needed beyond "the routes are new" — nobody reaches `/v2/*` unless explicitly linked, which you control by not adding nav entry points until you're ready.
- Rollback: revert deploy; optionally drop `_v2` tables/bucket. No impact on live app either direction.
- Post-deploy smoke test: sign up a fresh test account, run one full capture→PayPal sandbox→report cycle end to end before calling it done.

---

## 10. Long-Term Trajectory
- Reversibility: 5/5 — this is about as reversible as a build gets, by design (Decision #1).
- Technical debt introduced: two parallel report schemas (`ColourAnalysis`/`reports` vs new `analysis_metrics_v2`) until you confirm cutover and consolidate. This is intentional debt, tracked, not accidental.
- 1-year question: a new engineer reading this in 12 months should immediately understand `/v2` was the deliberate rebuild surface and `reports`/`sessions`/`photos` (no suffix) is legacy — recommend a one-line comment at the top of each new file's directory (or a `README.md` in `app/v2/`) saying exactly that, so the "why two schemas" question never needs re-asking.

---

## 11. Design & UX
Heavy UI scope (this is basically the whole spec). Interaction-state coverage required per screen:

```
FEATURE            | LOADING | EMPTY | ERROR | SUCCESS | PARTIAL
--------------------|---------|-------|-------|---------|--------
Splash              | n/a     | n/a   | n/a   | Yes     | n/a
Onboarding (3 screens)| n/a   | n/a   | n/a   | Yes     | n/a
Auth                 | Yes    | n/a   | Yes   | Yes     | n/a (guest preview = a distinct state, not "empty")
Profile setup        | Yes    | n/a   | Yes   | Yes     | n/a
Dashboard            | Yes    | Yes (no scans yet) | Yes | Yes | Yes (free-tier locked sections)
Scan prep            | n/a    | n/a   | Yes (camera denied) | Yes | n/a
Guided capture        | Yes (model loading) | n/a | Yes (quality fail) | Yes | n/a
Processing           | Yes    | n/a   | Yes (retry) | Yes | Yes (partial analysis) |
Report               | Yes    | n/a   | Yes   | Yes     | Yes (locked premium sections for free users)
Plans/Checkout       | Yes    | n/a   | Yes (PayPal down, cancelled, failed) | Yes | n/a
History              | Yes    | Yes (no scans) | Yes | Yes | n/a
Settings             | Yes    | n/a   | Yes (delete failure) | Yes | n/a
```

All cells accounted for — no silent blank-screen states. Recommend running **/plan-design-review** after implementation for a pixel-level pass; this section confirms intentionality, not visual polish.

---

## TODOS.md candidates (proposed, not yet added — your call)

1. **PayPal production hardening** (P1, blocks real launch) — webhook signature verification, real client/secret rotation, renewal/cancellation/refund handling. Effort: human ~2-3 days / CC ~2-3 hrs.
2. **Real PDF report export** (P2) — swap print-view for `@react-pdf/renderer` or a server-render route once v2 direction is validated. Effort: human ~1 day / CC ~1 hr.
3. **Real Claude prompts for hair/face domains** (P1, blocks real analysis) — currently mock provider only; needs prompt design + eval cases before replacing mock. Effort: human ~2 days / CC ~1-2 hrs.
4. **Client-side photo compression before upload** (P2) — check if `app/capture/page.tsx` already does this; if not, add for both old and new capture flows (15 photos will be slow/expensive uncompressed). Effort: human ~half day / CC ~30 min.
5. **Old/new report schema consolidation** (P3, post-cutover) — once you confirm switching to v2, decide whether to migrate old `reports` rows or let them age out. Effort: TBD, depends on your cutover decision.

---

## Implementation Tasks

- [ ] **T1 (P1, human: ~1d / CC: ~30min)** — DB — Create `user_profiles_v2`, `analysis_sessions_v2`, `analysis_photos_v2`, `analysis_metrics_v2`, `subscriptions_v2` tables + indexes on `user_id`/`session_id`
  - Surfaced by: Section 1 (Architecture), Section 7 (Performance — indexes)
  - Files: new `supabase/migrations/*_v2_schema.sql` (or dashboard-applied SQL, documented in repo)
  - Verify: migration runs clean against a fresh Supabase project; RLS policies scope every table to `user_id = auth.uid()`

- [ ] **T2 (P1, human: ~1d / CC: ~45min)** — Storage — Create `photos_v2` bucket with RLS scoped per-user
  - Surfaced by: Storage isolation decision
  - Files: Supabase dashboard config, documented in `docs/V2_PLAN.md`
  - Verify: user A cannot read user B's `photos_v2` objects via signed URL guessing

- [ ] **T3 (P1, human: ~2d / CC: ~1h)** — AI — `lib/v2/aiProvider.ts` interface + mock provider returning full skin/face/hair schema per spec Section 23
  - Surfaced by: spec Section 23, Architecture
  - Files: `lib/v2/aiProvider.ts`, `lib/v2/types.ts`
  - Verify: mock output validates against a Zod schema before any UI renders it

- [ ] **T4 (P1, human: ~3d / CC: ~1.5h)** — Capture — 15-step guided capture flow with MediaPipe-based quality checks (face detected, brightness, blur, single-face)
  - Surfaced by: spec Section 7, Error & Rescue Registry
  - Files: `app/v2/capture/[step]/page.tsx`, `lib/v2/captureSteps.ts`, `lib/v2/qualityChecks.ts`
  - Verify: manual test with glasses on, low light, two people in frame — each produces the documented retake message

- [ ] **T5 (P1, human: ~1d / CC: ~30min)** — Onboarding/Auth/Profile — `/v2/splash`, `/v2/onboard(1-3)`, `/v2/auth`, `/v2/profile-setup` with consent gate
  - Surfaced by: spec Sections 1-4, Security finding (consent bypass)
  - Files: new `app/v2/*` routes
  - Verify: cannot reach `/v2/capture` without `consentGiven=true` persisted

- [ ] **T6 (P1, human: ~2d / CC: ~1h)** — Report — `/v2/report/[id]` rendering skin/face/hair cards + free/premium gating (server-side check)
  - Surfaced by: spec Sections 9-13, Security finding (premium route access)
  - Files: `app/v2/report/[id]/page.tsx`, `app/api/v2/report/[id]/route.ts` (or server component data fetch with auth check)
  - Verify: free-tier test account sees locked sections; direct API call for premium metric fields returns 403/redacted

- [ ] **T7 (P1, human: ~3d / CC: ~1.5h)** — PayPal — `/v2/plans`, `/v2/checkout`, `/api/v2/paypal/create-order`, `/api/v2/paypal/capture`, `/api/v2/paypal/webhook` (stub + TODO), success/cancel/failed states
  - Surfaced by: spec Section 15, Security finding (webhook spoofing), PayPal UX decision
  - Files: `lib/v2/paypal.ts`, `app/v2/plans/page.tsx`, `app/v2/checkout/*`, `app/api/v2/paypal/*`
  - Verify: sandbox end-to-end purchase flips `subscriptions_v2.status` only after server-side order verification; double-submit does not double-charge or double-activate

- [ ] **T8 (P2, human: ~1d / CC: ~30min)** — Report download — print-optimized `/v2/report/[id]/print` view with `@media print` CSS
  - Surfaced by: Report download decision
  - Files: new print route or print-mode toggle on report page
  - Verify: browser print preview shows clean single-column layout, no nav/buttons

- [ ] **T9 (P2, human: ~1d / CC: ~30min)** — History/Settings — `/v2/history` (scan list + Glow Score trend placeholder), `/v2/settings` (profile edit, notification prefs, subscription mgmt, delete account/photos)
  - Surfaced by: spec Sections 17-18
  - Files: `app/v2/history/page.tsx`, `app/v2/settings/page.tsx`
  - Verify: delete-account/delete-photos actually removes `photos_v2` storage objects, not just DB rows

- [ ] **T10 (P2, human: ~half day / CC: ~20min)** — Observability — structured logging for capture/analysis/payment lifecycle events (see Section 8)
  - Surfaced by: Section 8
  - Files: shared `lib/v2/log.ts` helper used across new API routes
  - Verify: a simulated "user paid but not premium" scenario is fully reconstructable from logs alone

---

## Eng Review Addendum (2026-07-22, /plan-eng-review)

Deeper architecture/test/performance pass on top of the CEO review. Decisions locked:

| # | Decision | Choice |
|---|----------|--------|
| 6 | Row-level security | DB-level Postgres RLS policies on all 5 new tables + `photos_v2` bucket, not app-filtering alone |
| 7 | RLS on child tables | Denormalize a `user_id` column onto `analysis_photos_v2` and `analysis_metrics_v2` (they're keyed by `session_id`, not `user_id` — a subquery-through-parent approach was rejected as slower/more complex) |
| 8 | Storage path convention | `{user_id}/{session_id}/{photo_type}.jpg` (bucket name already provides v2 isolation, no redundant prefix), RLS policy matches `storage.foldername(name)[1] = auth.uid()::text` |
| 9 | Photo compression | Client-side (Decision from CEO review), tuned for color fidelity: cap JPEG quality ~0.9, rely on dimension downscaling rather than aggressive quality reduction, avoid heavy 4:2:0 chroma subsampling — must be validated with a before/after AI-accuracy test pass before trusting it |
| 10 | Guest preview | Dropped from Phase 1 — every v2 route assumes an authenticated user; a real anonymous path is new scope (rate-limiting, abuse prevention) not required for Phase 1 to be complete |
| 11 | Phase 1 sequencing | Held as fully scoped (not split into 1a/1b) — CEO review's HOLD SCOPE decision stands; nothing prevents implementing/testing capture+report before PayPal within this same plan |

### Outside voice findings (Claude subagent — Codex CLI binary was broken locally, ENOENT on the native binary)

1. **PayPal + India business-model risk** — existing `/plan` page implies an India-based entity; PayPal restricts India-domestic recurring billing. Resolved: added as pre-production TODO (see below), does not block sandbox-stage Phase 1 work.
2. **RLS user_id mismatch on session_id-keyed tables** — real bug in the original T1 wording. Resolved: Decision #7 above.
3. **Storage path convention undefined** — Resolved: Decision #8 above.
4. **Client-side compression color-accuracy risk** — direct tension with the CEO review's Performance decision. Resolved: Decision #9 above.
5. **Guest preview phantom feature** — appeared only in the Design state table with no real backing. Resolved: Decision #10 above.
6. **Sequencing critique** (capture+report first, defer PayPal/history/settings) — genuine strategic tension with HOLD SCOPE. Resolved: Decision #11 above (held as-is).
7. **Dual contradictory colour verdicts** (old `ColourAnalysis` vs new `analysis_metrics_v2`, same authenticated user) — already tracked as debt in "Long-Term Trajectory"; noted here as more trust-eroding than a pure debt item deserves — worth surfacing to the user post-launch, not just pre-cutover.
8. Document status-bookkeeping note (Eng Review row showing "not run yet" while this addendum exists) was a write-order artifact, not a real contradiction — corrected in the table below.

### TODOS.md updates (new, from this eng review)

6. **Verify PayPal viability for your actual business entity/country before production** (P1, blocks real launch, new from outside voice) — confirm PayPal supports recurring billing for wherever Percept is legally billing from; if not, the PayPal integration shell can be re-pointed at Razorpay (already used by the old `/plan` page) with minimal UI change. Effort: human ~1 day research / CC ~1-2 hrs to swap providers if needed.
7. **Before/after AI-accuracy test for client-side compression** (P1, blocks trusting T-compress) — compare AI analysis output on compressed vs. original photos to confirm color-based metrics (skin tone, undertone) don't shift. Effort: human ~half day / CC ~30 min.

### Updated Implementation Tasks (supersedes/extends T1-T2 from CEO review)

- [ ] **T1 (P1)** — DB — Create 5 tables with RLS: `user_profiles_v2`, `analysis_sessions_v2` (RLS: `user_id = auth.uid()`), `analysis_photos_v2` + `analysis_metrics_v2` (denormalized `user_id` column, same RLS check), `subscriptions_v2` (RLS: `user_id = auth.uid()`)
  - Verify: a second test user cannot read another user's rows via direct API call, even with a guessed UUID
- [ ] **T2 (P1)** — Storage — `photos_v2` bucket, path convention `{user_id}/{session_id}/{photo_type}.jpg` (bucket name already provides v2 isolation, no redundant prefix), RLS matching first path segment
  - Verify: signed URL for user A's object rejected when requested under user B's session
- [ ] **T-compress (P1, new)** — Capture — client-side compression tuned for color fidelity (quality ~0.9, dimension cap, avoid aggressive chroma subsampling)
  - Verify: AI-accuracy test (TODO #7) shows no meaningful skin-tone/undertone drift vs. uncompressed

### Worktree Parallelization Strategy

| Step | Modules touched | Depends on |
|------|-----------------|------------|
| DB/Storage foundation (T1, T2) | supabase migrations, storage config | — |
| Auth/Onboarding/Profile-setup | `app/v2/splash`, `app/v2/onboard`, `app/v2/auth`, `app/v2/profile-setup` | DB/Storage foundation |
| Guided capture + quality checks + compression | `app/v2/capture`, `lib/v2/qualityChecks.ts`, `lib/v2/imageCompress.ts` | DB/Storage foundation |
| AI provider | `lib/v2/aiProvider.ts`, `lib/v2/types.ts` | DB/Storage foundation |
| PayPal | `lib/v2/paypal.ts`, `app/v2/plans`, `app/v2/checkout`, `app/api/v2/paypal/*` | DB/Storage foundation |
| History/Settings | `app/v2/history`, `app/v2/settings` | DB/Storage foundation |
| Report rendering + gating | `app/v2/report` | AI provider (needs output shape), Auth pattern |
| Observability | `lib/v2/log.ts` | — (can start immediately, used by all API routes) |

**Execution order:** Launch DB/Storage foundation first (blocks everything). Once merged, launch Auth/Onboarding, Capture, AI provider, PayPal, and History/Settings **in parallel worktrees** — none share a module directory. Report rendering waits on AI provider landing (needs its output types). Observability can run in parallel with the foundation step itself.

**Conflict flag:** Capture and Report both may touch `lib/v2/types.ts` if photo/metric types are shared — low risk since it's purely additive, but coordinate the two lanes on that one file.

## Design Review Addendum (2026-07-22, /plan-design-review)

No mockup tool available (OpenAI key not configured for the gstack designer) — this was a text-based review, all 7 passes.

### Ratings (before → after this pass)

| Pass | Before | After | Notes |
|---|---|---|---|
| 1. Information Architecture | 2/10 | 8/10 | Hierarchy now specified for Report and Capture (below) |
| 2. Interaction State Coverage | 4/10 | 8/10 | Locked-section and loading states now concrete, not just "Yes" |
| 3. User Journey & Emotional Arc | 3/10 | 8/10 | Pre-auth value preview added, phase-grouped capture progress added |
| 4. AI Slop Risk | 7/10 | 7/10 | Already low risk — no card grids, no generic hero copy in original spec; no change needed |
| 5. Design System Alignment | 3/10 | 3/10 | No DESIGN.md exists — reuses existing tokens/PrimaryButton correctly, but no formal system. Recommend `/design-consultation` as a follow-up, not blocking |
| 6. Responsive & Accessibility | 2/10 | 7/10 | A11y requirements added (below); responsive breakpoints inherited from existing app patterns already in place |
| 7. Unresolved Decisions | — | 0 unresolved | All forks below resolved this session |

**Overall design score: 4/10 → 8/10.**

### Outside voice (Claude subagent — independent, no prior context)

Converged strongly with this review's own findings before any fix was applied: flagged the same two hierarchy gaps (capture, report), the same shallow state table, and the same two emotional-arc breaks (auth-before-value, report-then-paywall). No cross-model tension — both agreed on every point, which is why the fixes below proceeded without needing an A/B reconciliation step.

### Decisions locked this pass

| # | Decision | Choice |
|---|----------|--------|
| 12 | Report page hierarchy | Glow Score is the single largest element, top-of-page. Verdict label beneath it. Then: skin age vs actual age, hair summary, top-3 strongest/priority areas, then detail cards (skin/face/hair), then locked premium sections last |
| 13 | Capture progress | Phase-grouped: "Face · 3 of 9" then "Hair & Scalp · 2 of 6", with a brief phase-complete transition screen between the two ("Face done! Now hair & scalp — about 2 minutes") |
| 14 | Locked premium sections | Blur real content + centered "Unlock full report" CTA overlay — not a greyed placeholder. Free-tier API responses still include the real values (needed to render the blur), so the premium gate must be enforced client-side visually AND the values must not be extractable via devtools/API inspection for a determined free user — flagged as an implementation constraint, not just a visual one |
| 15 | Pre-auth value preview | Add a 4th onboarding beat: a static/illustrative sample report screen (placeholder Glow Score + a few metric cards) shown before the auth screen, using fake data, no backend call |
| 16 | Accessibility scope | Specified now, not deferred — see below |

### Information Architecture — Capture screen (step N of 15)

```
┌─────────────────────────────────┐
│ ← back      Face · 3 of 9        │  ← phase label + count (Decision #13)
│ ▓▓▓▓▓▓▓░░░░░░░░░░  (segment bar) │
│                                   │
│  "Position your forehead inside  │  ← 1-line instruction, above frame
│   the guide"                     │
│  ┌───────────────────────────┐   │
│  │                           │   │
│  │      [oval guide ring]    │   │  ← primary focal element
│  │      live camera feed      │   │
│  │                           │   │
│  └───────────────────────────┘   │
│  ● Good lighting                 │  ← quality chip, live, aria-live (below)
│                                   │
│         ( ● capture )            │  ← primary action, 44px+ target
│      Upload from gallery →        │  ← secondary, text-link weight
└─────────────────────────────────┘
```
Primary: camera frame + guide ring. Secondary: instruction text + quality chip. Tertiary: progress/phase label, capture button, gallery link.

### Information Architecture — Report page

```
┌─────────────────────────────────┐
│  [Glow Score: 78]  ← largest element (Decision #12)
│  "Good" verdict                  │
│  Skin age 26 vs actual age 29    │
│  Hair health summary (1 line)    │
│  Top 3 strongest · Top 3 priority│
├─────────────────────────────────┤
│  Skin detail cards (free tier:   │
│   full; scored per metric)       │
│  Face detail cards               │
│  Hair/scalp detail cards         │
├─────────────────────────────────┤
│  [Blurred premium cards + CTA]   │  ← locked sections last (Decision #14)
└─────────────────────────────────┘
```

### Interaction States (concrete, replaces the generic table from the CEO/eng addenda)

```
FEATURE                | LOADING                          | EMPTY            | ERROR                              | SUCCESS                        | PARTIAL
------------------------|-----------------------------------|-------------------|-------------------------------------|---------------------------------|------------------------------------
Guided capture          | Camera frame visible immediately; | n/a               | Full-screen message + retake, not a  | Green quality chip, capture    | n/a
                        | MediaPipe model loads silently in |                   | toast — quality failures block       | button enabled                 |
                        | background, quality chip shows    |                   | progress until resolved              |                                 |
                        | "Checking..." until ready         |                   |                                       |                                 |
Processing              | Staged copy (per spec Section 8), | n/a               | Full-screen retry state, names what  | Auto-advance to report         | Report renders with a visible
                        | subtle animation, no fake %       |                   | failed in plain language             |                                 | "some results need better photos"
                        |                                    |                   |                                       |                                 | banner, not silent
Report — premium locked | n/a                                | n/a               | n/a                                   | n/a                             | Blur + centered CTA overlay
                        |                                    |                   |                                       |                                 | (Decision #14)
Dashboard               | Skeleton cards matching final     | "No analyses yet" | Inline retry, not full-page          | Latest report + score shown    | Free-tier: locked section
                        | layout shape                      | + primary CTA     |                                       |                                 | uses same blur+CTA pattern
Checkout                | Button shows spinner, disabled    | n/a               | "Payment service unavailable — try   | Redirect to unlocked report     | n/a
                        | (prevents double-click per Eng     |                   | again" inline, not a popup            | after server verification       |
                        | review's idempotency finding)      |                   |                                       |                                 |
```

### User Journey Storyboard

```
STEP                        | USER DOES              | USER FEELS                  | PLAN SPECIFIES?
-----------------------------|-------------------------|------------------------------|----------------
Splash → onboarding 1-3      | Reads value prop        | Curious, mildly skeptical    | Yes — text/illustration screens
Onboarding 4 (NEW, Dec #15)  | Sees sample report      | "Oh, that's what I'd get"   | Yes — this pass added it
Auth                         | Signs up                | Committed but not yet sold  | Yes — standard Supabase auth UI
Profile setup                | Answers concern/type Qs | Being understood, not interrogated | Yes — chips/sliders per spec, not long forms
Guided capture (15 steps)    | Takes photos in 2 phases| Face phase: routine. Hair phase: "almost done" | Yes — phase-grouped (Dec #13)
Processing                   | Waits ~10-30s           | Anticipation, not anxiety   | Yes — educational tip cards per spec
Report reveal                | Sees Glow Score first   | Payoff moment               | Yes — score-first hierarchy (Dec #12)
Locked sections              | Sees blurred premium    | "I can see what I'm missing"| Yes — blur+CTA, not a wall (Dec #14)
Checkout                     | Pays via PayPal sandbox | Trust-testing moment        | Yes — server-verified, no fake instant-unlock (per Eng review Dec #3)
```

### Accessibility (Decision #16)

- Capture/checkout primary buttons: 44px minimum touch target.
- Quality-check status (`face detected`, `too dark`, `multiple faces`) announced via an `aria-live="polite"` region tied to the same chip — a screen-reader user attempting self-capture must hear the same feedback a sighted user sees, not just a color change.
- Capture retake/continue fully keyboard-operable (no camera-only interaction trap).
- Visible focus states use the existing `--line-strong` / `--primary` tokens already defined in `app/globals.css` — no new focus-ring system needed.
- Locked-section blur overlay: the "Unlock full report" CTA must be a real focusable button (not a div with an onClick), and the blurred content underneath must have `aria-hidden="true"` so screen readers don't announce blurred numbers as if they were visible.
- Color contrast: report score/verdict text must hit 4.5:1 minimum against `var(--canvas)`/`var(--surface)` — verify with existing tokens before implementation, don't assume.

### AI Slop Check

No hard-rejection patterns present in the spec: no generic 3-column feature grid (only 2 pricing tiers, not 3), no carousel, no stock medical imagery (explicitly forbidden by the user's own spec), no purple/violet gradients (existing palette is warm cream/charcoal/rose/sage). Onboarding is 3-4 sequential screens, not a symmetric grid. Low risk overall — the original 25-section spec's own explicit "avoid neon, avoid clinical, avoid emoji icons" instructions already function as effective anti-slop guardrails.

### NOT in scope (design)

- Pixel-level visual QA (colors rendered correctly, exact spacing) — deferred to `/design-review` after implementation, since that requires a live site to inspect.
- Formal DESIGN.md / design system documentation — recommended as a follow-up (`/design-consultation`), not blocking Phase 1.
- Illustration/icon set for onboarding and capture guide overlays — implementer's choice of concrete asset style, not a review-blocking decision.

### What already exists (design)

Confirmed reuse (no new system introduced): CSS custom properties in `app/globals.css` (`--primary`, `--secondary`, `--canvas`, `--surface`, `--line`, `--line-strong`, `--wash`, `--rose`, `--muted`), `PrimaryButton` component with its existing hover/focus/variant states, card-hover pattern (border-color + shadow lift) from `my-reports`/`profile` pages, and the fluid-typography `clamp()` pattern in `globals.css` that fixed the "text too small" bug earlier this project — v2 screens must use the same `rem`+`clamp()` approach, not fixed px, to avoid reintroducing that exact bug.

### Design TODOS (not added — informational)

1. **Run `/design-consultation` to formalize DESIGN.md** (P3, not blocking) — this review proceeded on universal principles + existing token reuse; a real design system doc would make future reviews faster and catch drift automatically.

## Cherry-Picked Additions (2026-07-22/23, post-implementation)

After the initial v2 build shipped and was smoke-tested, 4 additional features were cherry-picked and built (SELECTIVE EXPANSION continuation, not a new full review cycle):

1. **Colour analysis port** — `app/api/v2/colour-analysis/route.ts` + `components/v2/ColourAnalysisPanel.tsx`. Reuses `ColourDraping.tsx` and the Claude prompt pattern from the live app as-is, wired to v2 auth/session. New table: `colour_analysis_v2`.
2. **Frame try-on port** — `GlassesVirtualTryOn.tsx` + `LiveEyewearTryOn.tsx` imported into the v2 report page unmodified (fully self-contained, no old-store dependency). Self-detects face shape client-side.
3. **Gemini hairstyle suggestions** (new capability) — `lib/v2/gemini.ts` + `app/api/v2/hairstyle/generate/route.ts` + `components/v2/HairstylePanel.tsx`. Uses `gemini-2.5-flash-image`, gated behind Premium + an explicit per-style tap (never auto-runs). New table: `hairstyle_generations_v2`.
4. **Real PayPal credentials** — wired into `.env.local` (not committed), verified: `create-order` succeeds and opens a real PayPal Sandbox popup. Full purchase completion needs a PayPal sandbox buyer login, which wasn't available to test — everything up to that point is confirmed working.

**Money-making UX pass**: added a persistent pricing banner at the top of the report (before any content) for free-tier users — exact price, "cancel anytime, no hidden fees" — plus matching copy on the dashboard's locked card and the checkout page. Previously the only unlock CTA was a single card after all metric sections, with no price shown anywhere on the report itself.

**Bugs found and fixed during smoke testing:**
- `ensureSession()` in the capture flow trusted a cached `currentSessionId` from localStorage without checking it still existed — an admin purge or any server-side deletion left every future photo upload silently failing RLS instead of self-healing. Fixed: verify the session exists and belongs to the user before reusing it, otherwise create a fresh one.
- Colour-analysis and hairstyle-generation routes both assumed the client would pass a base64 data URL, but the report page actually has a Supabase **signed URL** (`https://...`). Both fixed to fetch the remote URL server-side and encode it, rather than treating the URL string itself as image bytes.
- Gemini hairstyle generation surfaced a generic "try again shortly" for what was actually a permanent quota/billing block (image generation needs billing enabled on the Google Cloud project, unlike text-only Gemini calls which work on the free tier). Fixed: detect the specific `RESOURCE_EXHAUSTED` quota error and tell the user it needs billing, not a retry.

**Full data purge performed** (user-requested, explicit confirmation given full scope): all rows in `reports`, `sessions`, `photos` (old app, 39 rows across 4 accounts) and `analysis_sessions_v2` + cascaded children (v2 test data) deleted, plus all storage objects in both `photos` and `photos_v2` buckets (394 files). Verified empty via row-count checks post-delete, not just response codes. `user_profiles_v2` and `subscriptions_v2` were explicitly left untouched (not "reports").

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | CLEAR | Hold scope, 3 decisions resolved, 0 critical gaps |
| Codex Review | `/codex review` | Independent 2nd opinion | 2 (fallback both times) | ISSUES FOUND → RESOLVED | Eng pass: 9 findings, 6 resolved. Design pass: 0 tension, findings converged and fixed directly |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 6 new decisions (RLS x3, compression, guest preview, sequencing), 19-path test coverage plan written, 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAR | Score 4/10 → 8/10, 5 new decisions (hierarchy x2, locked-section treatment, pre-auth preview, a11y scope), 0 unresolved |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | not run |

**CROSS-MODEL:** Design review's outside voice (Claude subagent) fully converged with the primary review's own findings — no tension to reconcile, both independently caught the same hierarchy/journey gaps before any fix was applied.

**VERDICT:** CEO + ENG + DESIGN CLEARED — ready to implement.

NO UNRESOLVED DECISIONS

## Bundle-First Purchase Flow (2026-07-23, post-implementation)

Replaced the "free score + subscription unlock" model with a "pay before any results, per-module or bundle" model, for new scans. Existing subscription code (`/v2/plans`, `/v2/checkout`, `subscriptions_v2`) is untouched — stays as a potential future "VIP skip the paywall" perk, not wired to anything currently.

**Decisions:**
- New flow replaces the old paywall entirely for new scans (existing subscription code kept, unused for now).
- "Skin Analysis" module = skin + face metric categories (Face isn't a standalone purchasable item). "Hairstyle Recommendations" module = Hair & Scalp metrics + the Gemini style-preview generator. Same merge logic both times: no metric category orphaned outside the 4 purchasable modules.
- 4 modules ($4 each, $16 total) — Skin, Color, Hairstyle, Frame. Bundle price $10 (all 4) — anything less than all 4 is linear ($4 × count), no partial discount.

**New:** `report_purchases_v2` table (session_id, user_id, modules[], amount_paid, provider_order_id — RLS same pattern as `subscriptions_v2`, server-only writes). `lib/v2/reportModules.ts` (module defs + pricing). `lib/v2/paypal.ts` extended with generic `createCustomOrder`/`captureOrderRaw` (separate from the subscription-specific `createOrder`/`captureOrder`, different `custom_id` shape). `app/api/v2/report-purchase/{create-order,capture}`. `app/v2/bundle/[sessionId]/page.tsx` — analysis kicks off in the background on mount while the premium bundle-selection UI (animated glow/shimmer card, dynamic pricing, PayPal button) is shown.

**Flow change:** last capture step now routes to `/v2/bundle/{sessionId}` instead of `/v2/processing`. Report page requires a `report_purchases_v2` row to exist — redirects to the bundle page if not, and only renders sections for modules actually purchased (no locked/empty sections). Print/download route filters the same way.

**Verified via smoke test:** redirect-when-unpurchased works; dynamic pricing (4→$10, 3→$12, discount-loss messaging) works; partial purchase (skin+colour only) correctly shows only those sections, no Hair/Frame/Hairstyle leakage; PayPal `create-order` succeeds with real sandbox credentials (full purchase completion needs a sandbox buyer login, not available to test automatically). One mobile bug found and fixed: the bundle card's 4-module grid clipped text at 390px width — added a single-column breakpoint at 480px.

**Not yet done:** the actual live end-to-end PayPal capture (needs a human to complete sandbox checkout at least once); no "restore purchase" UI if a user's payment succeeded but the capture call failed client-side (PayPal has the money, DB row missing) — same class of risk flagged for the subscription flow's production hardening TODO, applies here too.
